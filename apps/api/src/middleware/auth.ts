import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { OrganisationModel, RoleModel, TokenRecordModel, UserModel } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { verifyJwt, type JwtPayload } from '../utils/jwt.js';
import { hashBearerToken } from '../utils/tokenHash.js';
import type { TokenAudience, TokenScope, TokenType } from '../utils/tokenTypes.js';
import { inferUserMfaStatus, sanitiseMfaConfig } from '../utils/mfaPolicy.js';
import { featureEnabled } from '../utils/features.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload & {
        permission_keys: string[];
        role_names: string[];
        token_context: {
          token_type: TokenType;
          audience: TokenAudience;
          scopes: TokenScope[];
          token_id?: string | null;
          auth_scheme: 'UserSessionAuth' | 'PersonalAccessTokenAuth' | 'OrganisationApiTokenAuth' | 'BearerAuth';
          mfa_required: boolean;
          mfa_verified: boolean;
          mfa_provider?: string | null;
          mfa_status?: string | null;
          mfa_enforcement_mode?: string | null;
          amr?: string[];
          acr?: string | null;
        };
      };
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new HttpError(401, 'Authentication required. Provide a bearer token.');
    }

    let payload: JwtPayload;
    try {
      payload = verifyJwt(token, env.JWT_SECRET);
    } catch (error) {
      throw new HttpError(401, error instanceof Error ? error.message : 'Invalid token.');
    }

    if (!['user_session_token', 'personal_access_token'].includes(payload.token_type)) {
      throw new HttpError(401, `Token type is not active yet for this guard: ${payload.token_type}`);
    }

    if (payload.audience !== 'internal') {
      throw new HttpError(401, `Token audience is not allowed for this internal route: ${payload.audience}`);
    }

    let storedPersonalAccessTokenScopes: string[] | null = null;
    let authScheme: 'UserSessionAuth' | 'PersonalAccessTokenAuth' = 'UserSessionAuth';

    if (payload.token_type === 'personal_access_token') {
      if (!payload.token_id) {
        throw new HttpError(401, 'Personal access token record id is missing.');
      }

      const tokenRecord = await TokenRecordModel.findOne({
        _id: payload.token_id,
        organisation_id: payload.organisation_id,
        user_id: payload.sub,
        token_type: 'personal_access_token',
        token_hash: hashBearerToken(token)
      });

      if (!tokenRecord) {
        throw new HttpError(401, 'Personal access token record was not found or does not match the provided token.');
      }

      if (tokenRecord.status !== 'active') {
        throw new HttpError(401, `Personal access token is not active: ${tokenRecord.status}`);
      }

      if (tokenRecord.expires_at && tokenRecord.expires_at.getTime() <= Date.now()) {
        tokenRecord.status = 'expired';
        await tokenRecord.save();
        throw new HttpError(401, 'Personal access token has expired.');
      }

      tokenRecord.last_used_at = new Date();
      await tokenRecord.save();
      storedPersonalAccessTokenScopes = tokenRecord.scopes;
      authScheme = 'PersonalAccessTokenAuth';
    }

    const user = await UserModel.findOne({ _id: payload.sub, email_normalised: payload.email.toLowerCase() });

    if (!user) {
      throw new HttpError(401, 'Authenticated user no longer exists.');
    }

    if (user.status !== 'active') {
      throw new HttpError(403, 'Authenticated user is not active.');
    }

    if (String(user.organisation_id) !== payload.organisation_id) {
      throw new HttpError(401, 'Token organisation does not match user organisation.');
    }

    const organisation = await OrganisationModel.findById(user.organisation_id);
    if (!organisation) {
      throw new HttpError(403, 'Authenticated user organisation was not found.');
    }

    if (organisation.status !== 'active') {
      throw new HttpError(403, 'Authenticated user organisation is not active.');
    }

    const organisationMfaConfig = sanitiseMfaConfig(organisation.mfa_config);
    const userMfaStatus = inferUserMfaStatus(organisation.mfa_config, user.auth);
    const tokenMfaVerified = Boolean(payload.mfa_verified);

    const userRoleIds = user.role_ids.map((roleId) => roleId.toString());
    const roles = await RoleModel.find({ _id: { $in: userRoleIds }, organisation_id: user.organisation_id }).lean();
    const permissionKeys = [...new Set(roles.flatMap((role) => role.permission_keys ?? []))].sort();

    const effectiveTokenScopes = storedPersonalAccessTokenScopes ?? payload.scopes;

    req.auth = {
      ...payload,
      role_ids: userRoleIds,
      scopes: effectiveTokenScopes,
      permission_keys: permissionKeys,
      role_names: roles.map((role) => role.name).sort(),
      token_context: {
        token_type: payload.token_type,
        audience: payload.audience,
        scopes: effectiveTokenScopes,
        token_id: payload.token_id ?? null,
        auth_scheme: authScheme,
        mfa_required: organisationMfaConfig.enabled && organisationMfaConfig.enforcement_mode !== 'disabled',
        mfa_verified: tokenMfaVerified,
        mfa_provider: payload.mfa_provider ?? organisationMfaConfig.provider,
        mfa_status: userMfaStatus,
        mfa_enforcement_mode: payload.mfa_enforcement_mode ?? organisationMfaConfig.enforcement_mode,
        amr: payload.amr ?? [],
        acr: payload.acr ?? null
      }
    };

    next();
  } catch (error) {
    next(error);
  }
}



export async function requireOrganisationApiToken(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new HttpError(401, 'Organisation API token required. Provide a bearer token.');
    }

    let payload: JwtPayload;
    try {
      payload = verifyJwt(token, env.JWT_SECRET);
    } catch (error) {
      throw new HttpError(401, error instanceof Error ? error.message : 'Invalid organisation API token.');
    }

    if (payload.token_type !== 'organisation_api_token') {
      throw new HttpError(401, `Organisation API token required. Received: ${payload.token_type}`);
    }

    if (payload.audience !== 'external') {
      throw new HttpError(401, `Organisation API token audience must be external. Received: ${payload.audience}`);
    }

    if (!payload.token_id) {
      throw new HttpError(401, 'Organisation API token record id is missing.');
    }

    const tokenRecord = await TokenRecordModel.findOne({
      _id: payload.token_id,
      organisation_id: payload.organisation_id,
      token_type: 'organisation_api_token',
      token_hash: hashBearerToken(token)
    });

    if (!tokenRecord) {
      throw new HttpError(401, 'Organisation API token record was not found or does not match the provided token.');
    }

    if (tokenRecord.status !== 'active') {
      throw new HttpError(401, `Organisation API token is not active: ${tokenRecord.status}`);
    }

    if (tokenRecord.expires_at && tokenRecord.expires_at.getTime() <= Date.now()) {
      tokenRecord.status = 'expired';
      await tokenRecord.save();
      throw new HttpError(401, 'Organisation API token has expired.');
    }

    const organisation = await OrganisationModel.findById(payload.organisation_id);
    if (!organisation) {
      throw new HttpError(403, 'Organisation API token organisation was not found.');
    }

    if (organisation.status !== 'active') {
      throw new HttpError(403, 'Organisation API token organisation is not active.');
    }

    tokenRecord.last_used_at = new Date();
    await tokenRecord.save();

    req.auth = {
      ...payload,
      role_ids: [],
      scopes: tokenRecord.scopes,
      permission_keys: [],
      role_names: [],
      token_context: {
        token_type: 'organisation_api_token',
        audience: 'external',
        scopes: tokenRecord.scopes,
        token_id: payload.token_id,
        auth_scheme: 'OrganisationApiTokenAuth',
        mfa_required: false,
        mfa_verified: true,
        mfa_provider: null,
        mfa_status: null,
        mfa_enforcement_mode: null,
        amr: [],
        acr: null
      }
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireTokenType(allowedTokenTypes: TokenType[]) {
  return function tokenTypeMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      if (!allowedTokenTypes.includes(req.auth.token_context.token_type)) {
        throw new HttpError(403, `Allowed token types: ${allowedTokenTypes.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}


function tokenScopeAllows(req: Request, requiredScope: string): boolean {
  if (!req.auth) {
    return false;
  }

  if (req.auth.token_context.token_type === 'user_session_token') {
    return true;
  }

  const scopes = req.auth.token_context.scopes;
  const [moduleName] = requiredScope.split('.');

  return scopes.includes('*') || scopes.includes(requiredScope) || scopes.includes(`${moduleName}.*`);
}

export function requireTokenAudience(allowedAudiences: TokenAudience[]) {
  return function tokenAudienceMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      if (!allowedAudiences.includes(req.auth.token_context.audience)) {
        throw new HttpError(403, `Allowed token audiences: ${allowedAudiences.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireTokenScope(requiredScope: TokenScope) {
  return function tokenScopeMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      if (!tokenScopeAllows(req, requiredScope)) {
        throw new HttpError(403, `Token scope required: ${requiredScope}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permissionKey: string) {
  return function permissionMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      if (!req.auth.permission_keys.includes(permissionKey)) {
        throw new HttpError(403, 'You do not have permission to perform this action.', { required_permission: permissionKey });
      }

      if (!tokenScopeAllows(req, permissionKey)) {
        throw new HttpError(403, 'The provided token does not have the required scope.', { required_scope: permissionKey });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}


export function requireAllPermissions(permissionKeys: string[]) {
  return function allPermissionsMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      const missingPermission = permissionKeys.find(
        (permissionKey) => !req.auth?.permission_keys.includes(permissionKey) || !tokenScopeAllows(req, permissionKey)
      );

      if (missingPermission) {
        throw new HttpError(403, 'You do not have permission to perform this action.', { required_permission: missingPermission });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(permissionKeys: string[]) {
  return function anyPermissionMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      const hasPermission = permissionKeys.some(
        (permissionKey) => req.auth?.permission_keys.includes(permissionKey) && tokenScopeAllows(req, permissionKey)
      );
      if (!hasPermission) {
        throw new HttpError(403, 'You do not have permission to perform this action.', { required_any_permission: permissionKeys });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}


export function requireMfaSatisfied() {
  return function mfaSatisfiedMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      if (req.auth.token_context.mfa_required && !req.auth.token_context.mfa_verified) {
        throw new HttpError(403, 'MFA verification is required for this action. v0.9.1 records MFA policy and token state; real challenge flows are implemented in later SSO/MFA builds.');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireOrganisationParamAccess(paramName = 'organisationId') {
  return function organisationParamAccessMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      const requestedOrganisationId = req.params[paramName];
      if (!requestedOrganisationId) {
        throw new HttpError(400, `Missing organisation id parameter: ${paramName}`);
      }

      const canManagePlatform = req.auth.permission_keys.includes('platform.organisations.manage');
      const canViewPlatform = req.auth.permission_keys.includes('platform.organisations.view');
      const isOwnOrganisation = requestedOrganisationId === req.auth.organisation_id;

      if (!isOwnOrganisation && !canManagePlatform && !canViewPlatform) {
        throw new HttpError(403, 'You can only access resources for your own organisation unless you have platform access.', { requested_organisation_id: requestedOrganisationId });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}


export function requireFeature(featureKey: string) {
  return async function featureMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new HttpError(401, 'Authentication required.');
      }

      const organisation = await OrganisationModel.findById(req.auth.organisation_id).lean();
      if (!organisation) {
        throw new HttpError(403, 'Authenticated organisation was not found.');
      }

      if (!featureEnabled(organisation.features, featureKey)) {
        throw new HttpError(403, `Organisation feature is not enabled: ${featureKey}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
