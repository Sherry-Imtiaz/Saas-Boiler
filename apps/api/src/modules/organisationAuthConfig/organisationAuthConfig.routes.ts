import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel, RoleModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const organisationAuthConfigRouter = Router();

const providerSchema = z.enum(['azure_ad', 'okta', 'google', 'keycloak', 'custom_oidc', 'custom']).nullable().optional();

const authConfigUpdateSchema = z
  .object({
    login_method: z.enum(['native', 'oidc', 'saml', 'mixed']).optional(),
    sso_enabled: z.boolean().optional(),
    provider: providerSchema,
    issuer_url: z.string().trim().url().max(1000).nullable().optional(),
    discovery_url: z.string().trim().url().max(1000).nullable().optional(),
    client_id: z.string().trim().min(1).max(500).nullable().optional(),
    client_secret_ref: z.string().trim().min(1).max(500).nullable().optional(),
    allowed_email_domains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/).max(253)).max(25).optional(),
    auto_provision_users: z.boolean().optional(),
    default_role_id: z.string().trim().nullable().optional(),
    enforce_sso: z.boolean().optional(),
    enforce_mfa: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one auth configuration field is required.');

type AuthConfigLike = {
  login_method?: string;
  sso_enabled?: boolean;
  provider?: string | null;
  issuer_url?: string | null;
  discovery_url?: string | null;
  client_id?: string | null;
  client_secret_ref?: string | null;
  allowed_email_domains?: string[];
  auto_provision_users?: boolean;
  default_role_id?: unknown;
  enforce_sso?: boolean;
  enforce_mfa?: boolean;
};

function assertAuthOrganisationId(req: { auth?: { organisation_id: string } }) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  return new mongoose.Types.ObjectId(organisationId);
}

function sanitiseAuthConfig(authConfig?: AuthConfigLike) {
  return {
    login_method: authConfig?.login_method ?? 'native',
    sso_enabled: Boolean(authConfig?.sso_enabled),
    provider: authConfig?.provider ?? null,
    issuer_url: authConfig?.issuer_url ?? null,
    discovery_url: authConfig?.discovery_url ?? null,
    client_id: authConfig?.client_id ?? null,
    client_secret_ref: authConfig?.client_secret_ref ?? null,
    allowed_email_domains: authConfig?.allowed_email_domains ?? [],
    auto_provision_users: Boolean(authConfig?.auto_provision_users),
    default_role_id: authConfig?.default_role_id ? String(authConfig.default_role_id) : null,
    enforce_sso: Boolean(authConfig?.enforce_sso),
    enforce_mfa: Boolean(authConfig?.enforce_mfa),
    native_login_enabled: ['native', 'mixed'].includes(authConfig?.login_method ?? 'native'),
    sso_login_enabled: Boolean(authConfig?.sso_enabled) || ['oidc', 'saml', 'mixed'].includes(authConfig?.login_method ?? 'native'),
    sso_configured: Boolean((authConfig as any)?.sso_config?.enabled)
  };
}

async function loadOrganisation(req: { auth?: { organisation_id: string } }) {
  const organisationId = assertAuthOrganisationId(req);
  const organisation = await OrganisationModel.findById(organisationId);
  if (!organisation) {
    throw new HttpError(404, 'Organisation not found.');
  }
  return organisation;
}

async function writeAudit(req: Request, action: string, organisation: { _id: unknown }, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: organisation._id,
    actor_user_id: req.auth!.sub,
    action,
    resource_type: 'organisation_auth_config',
    resource_id: String(organisation._id),
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });

  await createSecurityEvent({
    organisationId: String(organisation._id),
    actorUserId: req.auth!.sub,
    eventType: action,
    severity: 'medium',
    status: 'success',
    resourceType: 'organisation_auth_config',
    resourceId: String(organisation._id),
    details,
    request: req
  });
}

async function validateDefaultRole(defaultRoleId: string | null | undefined, organisationId: unknown) {
  if (defaultRoleId === undefined) {
    return undefined;
  }

  if (defaultRoleId === null || defaultRoleId === '') {
    return null;
  }

  if (!mongoose.isValidObjectId(defaultRoleId)) {
    throw new HttpError(400, 'default_role_id must be a valid role id or null.');
  }

  const role = await RoleModel.findOne({ _id: defaultRoleId, organisation_id: organisationId });
  if (!role) {
    throw new HttpError(400, 'default_role_id must reference a role inside the authenticated organisation.');
  }

  return role._id;
}

function validateAuthPolicyPatch(patch: z.infer<typeof authConfigUpdateSchema>) {
  const loginMethod = patch.login_method;

  if ((loginMethod === 'oidc' || loginMethod === 'saml') && patch.sso_enabled === false) {
    throw new HttpError(400, 'sso_enabled cannot be false when login_method is oidc or saml.');
  }

  if (patch.enforce_sso === true && patch.sso_enabled === false) {
    throw new HttpError(400, 'enforce_sso requires sso_enabled to be true.');
  }

  if ((patch.sso_enabled === true || loginMethod === 'oidc' || loginMethod === 'saml' || loginMethod === 'mixed') && patch.provider === null) {
    throw new HttpError(400, 'provider is required when enabling SSO or using an SSO login method.');
  }
}

organisationAuthConfigRouter.get('/', requireAuth, requirePermission('organisation.auth.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    res.json({
      success: true,
      message: 'Organisation auth configuration returned successfully.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        auth_config: sanitiseAuthConfig(organisation.auth_config),
        notes: [
          'Native login is active in this boilerplate build.',
          'OIDC/SAML provider settings are stored but real SSO login is planned for a later build.',
          'MFA enforcement is stored but full MFA setup/verification is planned for a later build.'
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationAuthConfigRouter.patch('/', requireAuth, requirePermission('organisation.auth.manage'), async (req, res, next) => {
  try {
    const parsed = authConfigUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation auth configuration update request.', parsed.error.flatten());
    }

    validateAuthPolicyPatch(parsed.data);

    const organisation = await loadOrganisation(req);
    const before = sanitiseAuthConfig(organisation.auth_config);
    const defaultRole = await validateDefaultRole(parsed.data.default_role_id, organisation._id);
    const patch: Record<string, unknown> = { ...parsed.data };

    if (defaultRole !== undefined) {
      patch.default_role_id = defaultRole;
    }

    if (patch.sso_enabled === true && !patch.login_method) {
      patch.login_method = 'mixed';
    }

    if (patch.login_method === 'native') {
      patch.sso_enabled = false;
      patch.enforce_sso = false;
    }

    if (patch.login_method === 'oidc' || patch.login_method === 'saml') {
      patch.sso_enabled = true;
    }

    Object.assign(organisation.auth_config, patch);
    await organisation.save();

    const after = sanitiseAuthConfig(organisation.auth_config);
    await writeAudit(req, 'organisation.auth_config.update', organisation, { before, patch: parsed.data, after });

    res.json({
      success: true,
      message: 'Organisation auth configuration updated successfully.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        auth_config: after
      }
    });
  } catch (error) {
    next(error);
  }
});
