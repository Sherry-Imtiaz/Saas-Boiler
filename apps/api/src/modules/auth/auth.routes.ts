import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AuditLogModel, OrganisationModel, RoleModel, UserModel } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';
import { signJwt } from '../../utils/jwt.js';
import { verifyPassword } from '../../utils/password.js';
import { getDefaultScopesForTokenType, getTokenPolicySummary } from '../../utils/tokenTypes.js';
import { getMfaOperationalNotes, inferUserMfaStatus, sanitiseMfaConfig } from '../../utils/mfaPolicy.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(500),
  organisation_slug: z.string().trim().toLowerCase().min(2).max(120).optional()
});

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toId(value: unknown): string {
  return String(value);
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
  auth: { auth_type: string; mfa_enabled: boolean; mfa_status?: string; mfa_provider?: string | null; last_mfa_at?: Date | null; last_login_at?: Date | null };
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
      mfa_status: user.auth.mfa_status ?? 'not_required',
      mfa_provider: user.auth.mfa_provider ?? null,
      last_mfa_at: user.auth.last_mfa_at ?? null,
      last_login_at: user.auth.last_login_at ?? null
    },
    role_ids: user.role_ids.map((roleId) => toId(roleId)),
    profile: user.profile ?? {}
  };
}

async function getRoleAndPermissionContext(roleIds: string[], organisationId: string) {
  const roles = await RoleModel.find({ _id: { $in: roleIds }, organisation_id: organisationId }).lean();
  const permissionKeys = [...new Set(roles.flatMap((role) => role.permission_keys ?? []))].sort();

  return {
    roles: roles.map((role) => ({
      id: role._id.toString(),
      name: role.name,
      is_system_role: role.is_system_role,
      permission_keys: role.permission_keys
    })),
    permission_keys: permissionKeys
  };
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid login request.', parsed.error.flatten());
    }

    const emailNormalised = normaliseEmail(parsed.data.email);
    const user = await UserModel.findOne({ email_normalised: emailNormalised });

    if (!user || user.auth.auth_type !== 'native' || !verifyPassword(parsed.data.password, user.auth.password_hash)) {
      if (user) {
        await createSecurityEvent({
          organisationId: user.organisation_id,
          actorUserId: user._id,
          eventType: 'auth.login.failed',
          severity: 'medium',
          status: 'failure',
          resourceType: 'user',
          resourceId: user._id.toString(),
          details: { email: emailNormalised, reason: 'invalid_credentials' },
          request: req
        });
      }

      throw new HttpError(401, 'Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new HttpError(403, 'User account is not active.');
    }

    const organisation = await OrganisationModel.findById(user.organisation_id);

    if (!organisation) {
      throw new HttpError(403, 'User organisation was not found.');
    }

    if (organisation.status !== 'active') {
      throw new HttpError(403, 'User organisation is not active.');
    }

    const loginMethod = organisation.auth_config?.login_method ?? 'native';
    if (!['native', 'mixed'].includes(loginMethod) || organisation.auth_config?.enforce_sso) {
      throw new HttpError(403, 'Native login is disabled for this organisation. Use the configured organisation SSO method.');
    }

    if (organisation.auth_config?.allowed_email_domains?.length) {
      const emailDomain = user.email_normalised.split('@')[1];
      if (!organisation.auth_config.allowed_email_domains.includes(emailDomain)) {
        throw new HttpError(403, 'User email domain is not allowed for this organisation login policy.');
      }
    }

    if (parsed.data.organisation_slug && organisation.slug !== parsed.data.organisation_slug) {
      throw new HttpError(403, 'User does not belong to the selected organisation login screen.');
    }

    user.auth.last_login_at = new Date();
    await user.save();

    const roleIds = user.role_ids.map((roleId) => roleId.toString());
    const organisationMfaConfig = sanitiseMfaConfig(organisation.mfa_config);
    const mfaRequired = organisationMfaConfig.enabled && organisationMfaConfig.enforcement_mode !== 'disabled';
    const mfaVerified = !mfaRequired;
    const inferredMfaStatus = inferUserMfaStatus(organisation.mfa_config, user.auth);
    const token = signJwt(
      {
        sub: user._id.toString(),
        organisation_id: user.organisation_id.toString(),
        email: user.email_normalised,
        role_ids: roleIds,
        token_type: 'user_session_token',
        audience: 'internal',
        scopes: getDefaultScopesForTokenType('user_session_token'),
        mfa_required: mfaRequired,
        mfa_verified: mfaVerified,
        mfa_provider: organisationMfaConfig.provider,
        mfa_enforcement_mode: organisationMfaConfig.enforcement_mode,
        amr: mfaVerified ? ['pwd', 'mfa'] : ['pwd'],
        acr: mfaVerified ? 'urn:saas-boilerplate:mfa' : 'urn:saas-boilerplate:password'
      },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN_SECONDS
    );

    await AuditLogModel.create({
      organisation_id: user.organisation_id,
      actor_user_id: user._id,
      action: 'auth.login.success',
      resource_type: 'user',
      resource_id: user._id.toString(),
      details: {
        email: user.email_normalised,
        auth_type: user.auth.auth_type
      },
      ip_address: req.ip,
      user_agent: req.get('user-agent') ?? null
    });

    await createSecurityEvent({
      organisationId: user.organisation_id,
      actorUserId: user._id,
      eventType: 'auth.login.success',
      severity: 'low',
      status: 'success',
      resourceType: 'user',
      resourceId: user._id.toString(),
      details: {
        email: user.email_normalised,
        auth_type: user.auth.auth_type,
        token_type: 'user_session_token',
        mfa_required: mfaRequired,
        mfa_verified: mfaVerified
      },
      request: req
    });

    const roleContext = await getRoleAndPermissionContext(roleIds, user.organisation_id.toString());

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token_type: 'Bearer',
        access_token: token,
        expires_in: env.JWT_EXPIRES_IN_SECONDS,
        token_context: {
          token_type: 'user_session_token',
          audience: 'internal',
          scopes: getDefaultScopesForTokenType('user_session_token'),
          auth_scheme: 'UserSessionAuth',
          mfa_required: mfaRequired,
          mfa_verified: mfaVerified,
          mfa_provider: organisationMfaConfig.provider,
          mfa_status: inferredMfaStatus,
          mfa_enforcement_mode: organisationMfaConfig.enforcement_mode,
          amr: mfaVerified ? ['pwd', 'mfa'] : ['pwd'],
          acr: mfaVerified ? 'urn:saas-boilerplate:mfa' : 'urn:saas-boilerplate:password'
        },
        user: formatUser(user),
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status,
          branding: organisation.branding,
          features: organisation.features,
          auth_config: {
            login_method: organisation.auth_config?.login_method ?? 'native',
            sso_enabled: Boolean(organisation.auth_config?.sso_enabled),
            provider: organisation.auth_config?.provider ?? null,
            enforce_sso: Boolean(organisation.auth_config?.enforce_sso),
            enforce_mfa: Boolean(organisation.auth_config?.enforce_mfa)
          },
          mfa_config: sanitiseMfaConfig(organisation.mfa_config)
        },
        ...roleContext
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const auth = req.auth;
    if (!auth) {
      throw new HttpError(401, 'Authentication required.');
    }

    const user = await UserModel.findById(auth.sub);
    if (!user) {
      throw new HttpError(404, 'Authenticated user not found.');
    }

    const organisation = await OrganisationModel.findById(user.organisation_id);
    if (!organisation) {
      throw new HttpError(404, 'Authenticated user organisation not found.');
    }

    const roleIds = user.role_ids.map((roleId) => roleId.toString());
    const roleContext = await getRoleAndPermissionContext(roleIds, user.organisation_id.toString());

    res.json({
      success: true,
      data: {
        user: formatUser(user),
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status,
          branding: organisation.branding,
          features: organisation.features,
          auth_config: {
            login_method: organisation.auth_config?.login_method ?? 'native',
            sso_enabled: Boolean(organisation.auth_config?.sso_enabled),
            provider: organisation.auth_config?.provider ?? null,
            enforce_sso: Boolean(organisation.auth_config?.enforce_sso),
            enforce_mfa: Boolean(organisation.auth_config?.enforce_mfa)
          },
          mfa_config: sanitiseMfaConfig(organisation.mfa_config)
        },
        ...roleContext
      }
    });
  } catch (error) {
    next(error);
  }
});


authRouter.get('/token-context', requireAuth, async (req, res, next) => {
  try {
    const auth = req.auth;
    if (!auth) {
      throw new HttpError(401, 'Authentication required.');
    }

    res.json({
      success: true,
      data: {
        current_token: auth.token_context,
        mfa_context: {
          mfa_required: auth.token_context.mfa_required,
          mfa_verified: auth.token_context.mfa_verified,
          mfa_provider: auth.token_context.mfa_provider,
          mfa_status: auth.token_context.mfa_status,
          mfa_enforcement_mode: auth.token_context.mfa_enforcement_mode,
          amr: auth.token_context.amr ?? [],
          acr: auth.token_context.acr ?? null
        },
        user_context: {
          user_id: auth.sub,
          organisation_id: auth.organisation_id,
          email: auth.email,
          role_ids: auth.role_ids,
          role_names: auth.role_names,
          permission_keys: auth.permission_keys
        },
        token_policy: getTokenPolicySummary(),
        notes: [
          'v0.6.1 activates user_session_token for internal authenticated APIs.',
          'v0.6.2 activates personal_access_token for scoped user-owned long-lived access.',
          'v0.6.3 activates organisation_api_token for external/system-to-system integration access.',
          'service_account_token is reserved for later service identity requirements.',
          ...getMfaOperationalNotes(undefined)
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const auth = req.auth;
    if (auth) {
      await AuditLogModel.create({
        organisation_id: auth.organisation_id,
        actor_user_id: auth.sub,
        action: 'auth.logout',
        resource_type: 'user',
        resource_id: auth.sub,
        details: {
          note: 'Stateless bearer token logout acknowledged. Client should discard the token.'
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent') ?? null
      });

      await createSecurityEvent({
        organisationId: auth.organisation_id,
        actorUserId: auth.sub,
        eventType: 'auth.logout',
        severity: 'low',
        status: 'success',
        resourceType: 'user',
        resourceId: auth.sub,
        details: { token_type: auth.token_context.token_type },
        request: req
      });
    }

    res.json({
      success: true,
      message: 'Logout acknowledged. Remove the bearer token from the client.'
    });
  } catch (error) {
    next(error);
  }
});
