import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AuditLogModel, OrganisationModel, RoleModel, SsoCallbackExchangeModel, UserModel } from '../../models/index.js';
import type { OrganisationHydratedDocument } from '../../models/organisation.model.js';
import type { UserHydratedDocument } from '../../models/user.model.js';
import { HttpError } from '../../utils/httpError.js';
import { signJwt } from '../../utils/jwt.js';
import { getDefaultScopesForTokenType } from '../../utils/tokenTypes.js';
import { sanitiseMfaConfig } from '../../utils/mfaPolicy.js';
import { createPkcePair, createOidcNonce, signOidcState, verifyOidcState, resolveProviderMetadata, buildAuthorizationUrl, exchangeAuthorizationCode, validateIdToken, claimAsString, claimAsStringArray, safeReturnTo } from '../../utils/oidc.js';
import { normaliseSsoConfig } from '../../utils/ssoConfig.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const oidcAuthRouter = Router();

const startSchema = z.object({
  organisationSlug: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(8000),
  state: z.string().trim().min(1).max(16000)
});

const exchangeSchema = z.object({
  code: z.string().trim().min(32).max(512)
});

const SSO_EXCHANGE_CODE_TTL_SECONDS = 120;

function toId(value: unknown): string {
  return String(value);
}

function buildDisplayName(firstName: string | null, lastName: string | null, fallback: string): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || fallback;
}

type FormattedUser = ReturnType<typeof formatUser>;
type RoleContext = Awaited<ReturnType<typeof getRoleContext>>;
type SsoLoginResponseData = {
  token_type: 'Bearer';
  access_token: string;
  expires_in: number;
  token_context: {
    token_type: 'user_session_token';
    audience: 'internal';
    scopes: string[];
    auth_scheme: 'UserSessionAuth';
    auth_flow: 'oidc_authorization_code_pkce';
    mfa_required: boolean;
    mfa_verified: boolean;
    mfa_provider?: string | null;
    mfa_enforcement_mode?: string | null;
    amr: string[];
    acr?: string | null;
  };
  user: FormattedUser;
  organisation: {
    id: string;
    name: string;
    slug: string;
    status: string;
    branding: unknown;
    features: unknown;
    auth_config: Record<string, unknown>;
    mfa_config: unknown;
  };
  roles: RoleContext['roles'];
  permission_keys: RoleContext['permission_keys'];
  return_to: string | null;
};

function hashExchangeCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function createExchangeCode() {
  return crypto.randomBytes(32).toString('base64url');
}

async function getRoleContext(roleIds: string[], organisationId: string) {
  const roles = await RoleModel.find({ _id: { $in: roleIds }, organisation_id: organisationId }).lean();
  return {
    roles: roles.map((role) => ({
      id: role._id.toString(),
      name: role.name,
      is_system_role: role.is_system_role,
      permission_keys: role.permission_keys
    })),
    permission_keys: [...new Set(roles.flatMap((role) => role.permission_keys ?? []))].sort()
  };
}

function formatUser(user: {
  _id: unknown;
  organisation_id: unknown;
  email: string;
  email_normalised: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
  status: string;
  auth: { auth_type: string; mfa_enabled: boolean; mfa_status?: string; mfa_provider?: string | null; last_mfa_at?: Date | null; last_login_at?: Date | null; last_oidc_at?: Date | null; oidc_provider?: string | null; oidc_subject?: string | null };
  role_ids: unknown[];
  profile?: Record<string, unknown>;
}) {
  return {
    id: toId(user._id),
    organisation_id: toId(user.organisation_id),
    email: user.email,
    email_normalised: user.email_normalised,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    display_name: user.display_name,
    status: user.status,
    auth: {
      auth_type: user.auth.auth_type,
      mfa_enabled: user.auth.mfa_enabled,
      mfa_status: user.auth.mfa_status ?? 'managed_by_idp',
      mfa_provider: user.auth.mfa_provider ?? null,
      oidc_provider: user.auth.oidc_provider ?? null,
      oidc_subject: user.auth.oidc_subject ?? null,
      last_mfa_at: user.auth.last_mfa_at ?? null,
      last_login_at: user.auth.last_login_at ?? null,
      last_oidc_at: user.auth.last_oidc_at ?? null
    },
    role_ids: user.role_ids.map((roleId) => toId(roleId)),
    profile: user.profile ?? {}
  };
}

async function createSsoCallbackExchange(data: SsoLoginResponseData) {
  const code = createExchangeCode();
  await SsoCallbackExchangeModel.create({
    code_hash: hashExchangeCode(code),
    organisation_id: data.organisation.id,
    user_id: data.user.id,
    status: 'active',
    expires_at: new Date(Date.now() + SSO_EXCHANGE_CODE_TTL_SECONDS * 1000),
    return_to: data.return_to,
    token_context: {
      auth_flow: 'oidc_authorization_code_pkce',
      mfa_required: data.token_context.mfa_required,
      mfa_verified: data.token_context.mfa_verified,
      mfa_provider: data.token_context.mfa_provider ?? null,
      mfa_enforcement_mode: data.token_context.mfa_enforcement_mode ?? null,
      amr: data.token_context.amr,
      acr: data.token_context.acr ?? null
    },
    metadata: {
      organisation_slug: data.organisation.slug,
      provider: data.organisation.auth_config.provider ?? null
    }
  });

  return {
    code,
    expires_in: SSO_EXCHANGE_CODE_TTL_SECONDS,
    return_to: data.return_to
  };
}

async function responseOrRedirect(req: Request, res: Response, payload: Record<string, unknown>, status: 'success' | 'failure') {
  const wantsJson = req.accepts(['json', 'html']) === 'json' || req.method === 'POST' || !env.OIDC_FRONTEND_CALLBACK_URL;
  if (wantsJson) {
    res.status(status === 'success' ? 200 : 400).json(payload);
    return;
  }

  const url = new URL(env.OIDC_FRONTEND_CALLBACK_URL);
  url.searchParams.set('sso', status);
  if (status === 'success') {
    const data = payload.data as SsoLoginResponseData;
    const exchange = await createSsoCallbackExchange(data);
    url.searchParams.set('code', exchange.code);
    url.searchParams.set('expires_in', String(exchange.expires_in));
    if (data.organisation?.slug) url.searchParams.set('organisation_slug', data.organisation.slug);
    if (exchange.return_to) url.searchParams.set('return_to', exchange.return_to);
  } else {
    const error = payload.error as { message?: string } | undefined;
    url.searchParams.set('message', error?.message ?? 'SSO login failed.');
  }
  res.redirect(url.toString());
}

async function buildSsoLoginResponse(params: {
  user: UserHydratedDocument | null;
  organisation: OrganisationHydratedDocument;
  ssoProvider?: string | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  mfaProvider?: string | null;
  mfaEnforcementMode?: string | null;
  amr: string[];
  acr?: string | null;
  returnTo?: string | null;
}) {
  const user = params.user;
  if (!user) {
    throw new HttpError(404, 'OIDC user was not found.');
  }

  if (user.status !== 'active') {
    throw new HttpError(403, 'OIDC user account is not active.');
  }

  if (String(user.organisation_id) !== params.organisation._id.toString()) {
    throw new HttpError(403, 'OIDC user no longer belongs to the expected organisation.');
  }

  const roleIds = user.role_ids.map((roleId) => roleId.toString());
  const accessToken = signJwt({
    sub: user._id.toString(),
    organisation_id: user.organisation_id.toString(),
    email: user.email_normalised,
    role_ids: roleIds,
    token_type: 'user_session_token',
    audience: 'internal',
    scopes: getDefaultScopesForTokenType('user_session_token'),
    mfa_required: params.mfaRequired,
    mfa_verified: params.mfaVerified,
    mfa_provider: params.mfaProvider ?? null,
    mfa_enforcement_mode: params.mfaEnforcementMode ?? null,
    amr: params.amr,
    acr: params.acr ?? null
  }, env.JWT_SECRET, env.JWT_EXPIRES_IN_SECONDS);

  const organisationMfaConfig = sanitiseMfaConfig(params.organisation.mfa_config);
  const roleContext = await getRoleContext(roleIds, params.organisation._id.toString());

  return {
    token_type: 'Bearer' as const,
    access_token: accessToken,
    expires_in: env.JWT_EXPIRES_IN_SECONDS,
    token_context: {
      token_type: 'user_session_token' as const,
      audience: 'internal' as const,
      scopes: getDefaultScopesForTokenType('user_session_token'),
      auth_scheme: 'UserSessionAuth' as const,
      auth_flow: 'oidc_authorization_code_pkce' as const,
      mfa_required: params.mfaRequired,
      mfa_verified: params.mfaVerified,
      mfa_provider: params.mfaProvider ?? null,
      mfa_enforcement_mode: params.mfaEnforcementMode ?? null,
      amr: params.amr,
      acr: params.acr ?? null
    },
    user: formatUser(user),
    organisation: {
      id: params.organisation._id.toString(),
      name: params.organisation.name,
      slug: params.organisation.slug,
      status: params.organisation.status,
      branding: params.organisation.branding,
      features: params.organisation.features,
      auth_config: {
        login_method: params.organisation.auth_config.login_method,
        sso_enabled: params.organisation.auth_config.sso_enabled,
        provider: params.ssoProvider ?? params.organisation.auth_config.provider ?? null,
        enforce_sso: params.organisation.auth_config.enforce_sso,
        enforce_mfa: params.organisation.auth_config.enforce_mfa
      },
      mfa_config: organisationMfaConfig
    },
    ...roleContext,
    return_to: params.returnTo ?? null
  };
}

async function exchangeSsoCallbackCode(req: Request, code: string) {
  const now = new Date();
  const codeHash = hashExchangeCode(code);

  await SsoCallbackExchangeModel.updateOne(
    { code_hash: codeHash, status: 'active', expires_at: { $lte: now } },
    { $set: { status: 'expired' } }
  );

  const exchange = await SsoCallbackExchangeModel.findOneAndUpdate(
    { code_hash: codeHash, status: 'active', expires_at: { $gt: now } },
    { $set: { status: 'used', used_at: now } },
    { new: true }
  );

  if (!exchange) {
    throw new HttpError(400, 'SSO exchange code is invalid, expired or already used.');
  }

  const [organisation, user] = await Promise.all([
    OrganisationModel.findById(exchange.organisation_id),
    UserModel.findById(exchange.user_id)
  ]);

  if (!organisation) {
    throw new HttpError(404, 'SSO exchange organisation was not found.');
  }

  if (organisation.status !== 'active') {
    throw new HttpError(403, 'SSO exchange organisation is not active.');
  }

  const data = await buildSsoLoginResponse({
    user,
    organisation,
    ssoProvider: typeof exchange.metadata.provider === 'string' ? exchange.metadata.provider : organisation.auth_config.provider,
    mfaRequired: exchange.token_context.mfa_required,
    mfaVerified: exchange.token_context.mfa_verified,
    mfaProvider: exchange.token_context.mfa_provider ?? null,
    mfaEnforcementMode: exchange.token_context.mfa_enforcement_mode ?? null,
    amr: exchange.token_context.amr ?? [],
    acr: exchange.token_context.acr ?? null,
    returnTo: exchange.return_to ?? null
  });

  await createSecurityEvent({
    organisationId: organisation._id,
    actorUserId: user?._id,
    eventType: 'auth.oidc.exchange.success',
    severity: 'low',
    status: 'success',
    resourceType: 'sso_callback_exchange',
    resourceId: exchange._id.toString(),
    details: {
      organisation_slug: organisation.slug,
      return_to: exchange.return_to ?? null
    },
    request: req
  });

  return data;
}

async function findOrProvisionUser(params: {
  organisation: OrganisationHydratedDocument;
  email: string;
  subject: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  groups: string[];
  provider: string | null;
}) {
  const organisation = params.organisation;
  if (!organisation) {
    throw new HttpError(404, 'Organisation not found for OIDC login.');
  }

  const emailNormalised = params.email.trim().toLowerCase();
  if (organisation.auth_config.allowed_email_domains?.length) {
    const emailDomain = emailNormalised.split('@')[1];
    if (!organisation.auth_config.allowed_email_domains.includes(emailDomain)) {
      throw new HttpError(403, 'OIDC email domain is not allowed for this organisation.');
    }
  }

  let user = await UserModel.findOne({ email_normalised: emailNormalised });
  if (user && String(user.organisation_id) !== organisation._id.toString()) {
    throw new HttpError(403, 'A user with this OIDC email already exists in another organisation.');
  }

  const mappedRoleIds = (organisation.auth_config.sso_config?.group_role_mapping ?? [])
    .filter((mapping: { external_group: string; role_id: unknown }) => params.groups.includes(mapping.external_group))
    .map((mapping: { external_group: string; role_id: unknown }) => mapping.role_id);

  const fallbackRoleIds = organisation.auth_config.default_role_id ? [organisation.auth_config.default_role_id] : [];
  const nextRoleIds = [...new Set([...(user?.role_ids ?? []), ...mappedRoleIds, ...fallbackRoleIds].map((roleId: unknown) => String(roleId)))];

  if (!user) {
    if (!organisation.auth_config.auto_provision_users) {
      throw new HttpError(403, 'OIDC user was not found and auto_provision_users is disabled for this organisation.');
    }

    user = await UserModel.create({
      organisation_id: organisation._id,
      email: emailNormalised,
      email_normalised: emailNormalised,
      first_name: params.firstName,
      last_name: params.lastName,
      display_name: buildDisplayName(params.firstName, params.lastName, params.displayName ?? emailNormalised),
      status: 'active',
      auth: {
        auth_type: 'oidc',
        password_hash: null,
        mfa_enabled: true,
        mfa_status: 'managed_by_idp',
        mfa_provider: (params.provider ?? 'custom_oidc') as never,
        oidc_subject: params.subject,
        oidc_provider: params.provider,
        last_oidc_at: new Date(),
        last_login_at: new Date(),
        last_mfa_at: new Date()
      },
      role_ids: nextRoleIds,
      profile: { timezone: 'UTC' }
    });

    await AuditLogModel.create({
      organisation_id: organisation._id,
      actor_user_id: user._id,
      action: 'auth.oidc.user_provisioned',
      resource_type: 'user',
      resource_id: user._id.toString(),
      details: { email: emailNormalised, provider: params.provider, mapped_groups: params.groups }
    });
  } else {
    user.first_name = params.firstName ?? user.first_name;
    user.last_name = params.lastName ?? user.last_name;
    user.display_name = buildDisplayName(user.first_name ?? null, user.last_name ?? null, params.displayName ?? user.display_name);
    user.status = user.status === 'invited' ? 'active' : user.status;
    user.auth.auth_type = 'oidc';
    user.auth.oidc_subject = params.subject;
    user.auth.oidc_provider = params.provider;
    user.auth.mfa_enabled = true;
    user.auth.mfa_status = 'managed_by_idp';
    user.auth.mfa_provider = (params.provider ?? 'custom_oidc') as never;
    user.auth.last_oidc_at = new Date();
    user.auth.last_login_at = new Date();
    user.auth.last_mfa_at = new Date();
    user.role_ids = nextRoleIds as never;
    await user.save();
  }

  if (user.status !== 'active') {
    throw new HttpError(403, 'OIDC user account is not active.');
  }

  return user;
}

async function completeOidcCallback(req: Request, code: string, state: string) {
  const statePayload = verifyOidcState(state);
  const organisation = await OrganisationModel.findOne({ _id: statePayload.organisation_id, slug: statePayload.organisation_slug });
  if (!organisation) {
    throw new HttpError(404, 'OIDC organisation from state was not found.');
  }

  if (organisation.status !== 'active') {
    throw new HttpError(403, 'OIDC organisation is not active.');
  }

  const ssoConfig = normaliseSsoConfig(organisation.auth_config.sso_config);
  if (!organisation.auth_config.sso_enabled || !ssoConfig.enabled) {
    throw new HttpError(403, 'OIDC SSO is not enabled for this organisation.');
  }

  const metadata = await resolveProviderMetadata(ssoConfig);
  const tokenResponse = await exchangeAuthorizationCode({
    metadata,
    config: ssoConfig,
    code,
    codeVerifier: statePayload.code_verifier
  });

  if (!tokenResponse.id_token || typeof tokenResponse.id_token !== 'string') {
    throw new HttpError(401, 'OIDC token response did not include an id_token.');
  }

  const claims = await validateIdToken({
    idToken: tokenResponse.id_token,
    metadata,
    config: ssoConfig,
    nonce: statePayload.nonce
  });

  const email = claimAsString(claims, ssoConfig.claim_mapping.email) ?? claims.email;
  if (!email) {
    throw new HttpError(401, 'OIDC id_token is missing a usable email claim.');
  }

  const groups = claimAsStringArray(claims, ssoConfig.claim_mapping.groups);
  const user = await findOrProvisionUser({
    organisation,
    email,
    subject: claims.sub,
    firstName: claimAsString(claims, ssoConfig.claim_mapping.first_name),
    lastName: claimAsString(claims, ssoConfig.claim_mapping.last_name),
    displayName: claimAsString(claims, ssoConfig.claim_mapping.display_name),
    groups,
    provider: ssoConfig.provider
  });

  const organisationMfaConfig = sanitiseMfaConfig(organisation.mfa_config);
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  const mfaValues = organisationMfaConfig.claim_mapping.mfa_values;
  const mfaRequired = organisationMfaConfig.enabled && organisationMfaConfig.enforcement_mode !== 'disabled';
  const mfaVerified = !organisationMfaConfig.enabled || organisationMfaConfig.enforcement_mode === 'idp_enforced'
    ? true
    : amr.some((value) => mfaValues.includes(value));

  await AuditLogModel.create({
    organisation_id: organisation._id,
    actor_user_id: user._id,
    action: 'auth.oidc.login.success',
    resource_type: 'user',
    resource_id: user._id.toString(),
    details: { provider: ssoConfig.provider, subject: claims.sub, email: user.email_normalised, groups }
  });

  await createSecurityEvent({
    organisationId: organisation._id,
    actorUserId: user._id,
    eventType: 'auth.oidc.login.success',
    severity: 'low',
    status: 'success',
    resourceType: 'user',
    resourceId: user._id.toString(),
    details: { provider: ssoConfig.provider, subject: claims.sub, email: user.email_normalised, mfa_verified: mfaVerified },
    request: req
  });

  return buildSsoLoginResponse({
    user,
    organisation,
    ssoProvider: ssoConfig.provider,
    mfaRequired,
    mfaVerified,
    mfaProvider: organisationMfaConfig.provider,
    mfaEnforcementMode: organisationMfaConfig.enforcement_mode,
    amr,
    acr: typeof claims.acr === 'string' ? claims.acr : 'urn:saas-boilerplate:oidc',
    returnTo: statePayload.return_to ?? null
  });
}

oidcAuthRouter.get('/sso/:organisationSlug/start', async (req, res, next) => {
  try {
    const parsed = startSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid OIDC organisation slug.', parsed.error.flatten());
    }

    const organisation = await OrganisationModel.findOne({ slug: parsed.data.organisationSlug });
    if (!organisation) {
      throw new HttpError(404, 'Organisation not found for OIDC login.');
    }

    if (organisation.status !== 'active') {
      throw new HttpError(403, 'Organisation is not active.');
    }

    const ssoConfig = normaliseSsoConfig(organisation.auth_config.sso_config);
    if (!organisation.auth_config.sso_enabled || !ssoConfig.enabled) {
      throw new HttpError(403, 'OIDC SSO is not enabled for this organisation.');
    }

    const metadata = await resolveProviderMetadata(ssoConfig);
    const pkce = createPkcePair();
    const nonce = createOidcNonce();
    const now = Math.floor(Date.now() / 1000);
    const state = signOidcState({
      organisation_id: organisation._id.toString(),
      organisation_slug: organisation.slug,
      provider: ssoConfig.provider ?? 'custom_oidc',
      nonce,
      code_verifier: pkce.code_verifier,
      return_to: safeReturnTo(req.query.return_to),
      created_at: now,
      expires_at: now + env.OIDC_STATE_EXPIRES_IN_SECONDS
    });

    const authorization_url = buildAuthorizationUrl({ metadata, config: ssoConfig, state, nonce, codeChallenge: pkce.code_challenge });

    await createSecurityEvent({
      organisationId: organisation._id,
      eventType: 'auth.oidc.start',
      severity: 'low',
      status: 'info',
      resourceType: 'organisation_sso_config',
      resourceId: organisation._id.toString(),
      details: { provider: ssoConfig.provider, organisation_slug: organisation.slug },
      request: req
    });

    if (req.query.redirect === 'false') {
      res.json({
        success: true,
        message: 'OIDC authorization URL generated successfully.',
        data: { authorization_url, expires_in: env.OIDC_STATE_EXPIRES_IN_SECONDS, provider: ssoConfig.provider }
      });
      return;
    }

    res.redirect(authorization_url);
  } catch (error) {
    next(error);
  }
});

oidcAuthRouter.get('/sso/callback', async (req, res, next) => {
  try {
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid OIDC callback request.', parsed.error.flatten());
    }

    const data = await completeOidcCallback(req, parsed.data.code, parsed.data.state);
    await responseOrRedirect(req, res, { success: true, message: 'OIDC login successful.', data }, 'success');
  } catch (error) {
    if (error instanceof HttpError) {
      await responseOrRedirect(req, res, { success: false, error: { message: error.message, details: error.details } }, 'failure');
      return;
    }
    next(error);
  }
});

oidcAuthRouter.post('/sso/exchange', async (req, res, next) => {
  try {
    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid SSO exchange request.', parsed.error.flatten());
    }

    const data = await exchangeSsoCallbackCode(req, parsed.data.code);
    res.json({ success: true, message: 'SSO exchange completed successfully.', data });
  } catch (error) {
    next(error);
  }
});

oidcAuthRouter.post('/sso/callback', async (req, res, next) => {
  try {
    const parsed = callbackQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid OIDC callback request.', parsed.error.flatten());
    }

    const data = await completeOidcCallback(req, parsed.data.code, parsed.data.state);
    res.json({ success: true, message: 'OIDC login successful.', data });
  } catch (error) {
    next(error);
  }
});

oidcAuthRouter.get('/sso/:organisationSlug/logout', async (req, res, next) => {
  try {
    const parsed = startSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid OIDC organisation slug.', parsed.error.flatten());
    }

    const organisation = await OrganisationModel.findOne({ slug: parsed.data.organisationSlug });
    if (!organisation) {
      throw new HttpError(404, 'Organisation not found for OIDC logout.');
    }

    const ssoConfig = normaliseSsoConfig(organisation.auth_config.sso_config);
    const metadata = await resolveProviderMetadata(ssoConfig);
    const logoutEndpoint = metadata.end_session_endpoint ?? ssoConfig.logout_endpoint;
    if (!logoutEndpoint) {
      throw new HttpError(400, 'OIDC provider logout endpoint is not configured.');
    }

    const logoutUrl = new URL(logoutEndpoint);
    if (ssoConfig.post_logout_redirect_uri) {
      logoutUrl.searchParams.set('post_logout_redirect_uri', ssoConfig.post_logout_redirect_uri);
    }

    if (req.query.redirect === 'false') {
      res.json({ success: true, message: 'OIDC logout URL generated successfully.', data: { logout_url: logoutUrl.toString() } });
      return;
    }

    res.redirect(logoutUrl.toString());
  } catch (error) {
    next(error);
  }
});
