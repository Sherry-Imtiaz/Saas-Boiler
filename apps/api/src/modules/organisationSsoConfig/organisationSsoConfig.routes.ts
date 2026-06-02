import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel, RoleModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { normaliseSsoConfig, supportedSsoProviders, validateSsoConfig } from '../../utils/ssoConfig.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const organisationSsoConfigRouter = Router();

const providerSchema = z.enum(['azure_ad', 'okta', 'google', 'keycloak', 'custom_oidc', 'custom']).nullable().optional();
const optionalUrl = z.string().trim().url().max(1000).nullable().optional();
const optionalString = z.string().trim().max(1000).nullable().optional();

const ssoConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  provider: providerSchema,
  protocol: z.enum(['oidc', 'saml']).nullable().optional(),
  issuer_url: optionalUrl,
  discovery_url: optionalUrl,
  authorization_endpoint: optionalUrl,
  token_endpoint: optionalUrl,
  userinfo_endpoint: optionalUrl,
  jwks_uri: optionalUrl,
  logout_endpoint: optionalUrl,
  client_id: z.string().trim().min(1).max(500).nullable().optional(),
  client_secret_ref: z.string().trim().min(1).max(500).nullable().optional(),
  scopes: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  response_type: z.string().trim().min(1).max(80).nullable().optional(),
  pkce_enabled: z.boolean().optional(),
  require_verified_email: z.boolean().optional(),
  redirect_uri: optionalUrl,
  post_logout_redirect_uri: optionalUrl,
  claim_mapping: z.object({
    subject: optionalString,
    email: optionalString,
    first_name: optionalString,
    last_name: optionalString,
    display_name: optionalString,
    groups: optionalString
  }).optional(),
  group_role_mapping: z.array(z.object({
    external_group: z.string().trim().min(1).max(300),
    role_id: z.string().trim().min(1).max(80)
  })).max(100).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one SSO provider configuration field is required.');

function assertAuthOrganisationId(req: { auth?: { organisation_id: string } }) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  return new mongoose.Types.ObjectId(organisationId);
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
    resource_type: 'organisation_sso_config',
    resource_id: String(organisation._id),
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });

  await createSecurityEvent({
    organisationId: String(organisation._id),
    actorUserId: req.auth!.sub,
    eventType: action,
    severity: action.endsWith('.update') ? 'medium' : 'low',
    status: 'success',
    resourceType: 'organisation_sso_config',
    resourceId: String(organisation._id),
    details,
    request: req
  });
}

async function validateGroupRoleMapping(mappings: Array<{ external_group: string; role_id: string }> | undefined, organisationId: unknown) {
  if (!mappings) {
    return undefined;
  }

  const normalised = [];
  for (const mapping of mappings) {
    if (!mongoose.isValidObjectId(mapping.role_id)) {
      throw new HttpError(400, `Invalid role_id for external group ${mapping.external_group}.`);
    }

    const role = await RoleModel.findOne({ _id: mapping.role_id, organisation_id: organisationId });
    if (!role) {
      throw new HttpError(400, `Role for external group ${mapping.external_group} must belong to the authenticated organisation.`);
    }

    normalised.push({ external_group: mapping.external_group, role_id: role._id });
  }

  return normalised;
}

function formatResponse(organisation: { _id: unknown; name: string; slug: string; status: string; auth_config?: { sso_config?: unknown } }) {
  const ssoConfig = normaliseSsoConfig(organisation.auth_config?.sso_config as never);
  return {
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status
    },
    sso_config: ssoConfig,
    validation: validateSsoConfig(ssoConfig),
    supported_providers: supportedSsoProviders,
    redirect_uris: {
      local_callback: 'http://localhost:4000/api/auth/sso/callback',
      local_post_logout: 'http://localhost:5173/login',
      future_start_pattern: `/api/auth/sso/${organisation.slug}/start`
    },
    notes: [
      'v0.12.0 stores SSO provider configuration only. OIDC redirect/callback login is active via /api/auth/sso/{organisationSlug}/start and /api/auth/sso/callback.',
      'Store client_secret_ref only as a secret reference. Do not store raw provider secrets in this MongoDB document.',
      'Keycloak, Entra and Okta should perform MFA when MFA enforcement_mode is idp_enforced.'
    ]
  };
}

organisationSsoConfigRouter.get('/supported-providers', requireAuth, requirePermission('organisation.sso.view'), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Supported SSO providers returned successfully.',
      data: { supported_providers: supportedSsoProviders }
    });
  } catch (error) {
    next(error);
  }
});

organisationSsoConfigRouter.get('/', requireAuth, requirePermission('organisation.sso.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    res.json({
      success: true,
      message: 'Organisation SSO provider configuration returned successfully.',
      data: formatResponse(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationSsoConfigRouter.patch('/', requireAuth, requirePermission('organisation.sso.manage'), async (req, res, next) => {
  try {
    const parsed = ssoConfigUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation SSO provider configuration update request.', parsed.error.flatten());
    }

    const organisation = await loadOrganisation(req);
    const before = normaliseSsoConfig(organisation.auth_config?.sso_config as never);
    const groupRoleMapping = await validateGroupRoleMapping(parsed.data.group_role_mapping, organisation._id);
    const patch: Record<string, unknown> = { ...parsed.data };
    if (groupRoleMapping !== undefined) {
      patch.group_role_mapping = groupRoleMapping;
    }

    const current = normaliseSsoConfig(organisation.auth_config?.sso_config as never);
    const merged = { ...current, ...patch, claim_mapping: { ...current.claim_mapping, ...(parsed.data.claim_mapping ?? {}) } };
    const validation = validateSsoConfig(merged);

    if (validation.errors.length) {
      throw new HttpError(400, 'SSO provider configuration failed validation.', validation);
    }

    organisation.auth_config.sso_config = merged as never;

    // Mirror the high-level auth config fields so existing auth options remain consistent.
    organisation.auth_config.sso_enabled = Boolean(merged.enabled);
    organisation.auth_config.provider = (merged.provider ?? null) as never;
    organisation.auth_config.issuer_url = merged.issuer_url ?? null;
    organisation.auth_config.discovery_url = merged.discovery_url ?? null;
    organisation.auth_config.client_id = merged.client_id ?? null;
    organisation.auth_config.client_secret_ref = merged.client_secret_ref ?? null;
    if (merged.enabled && organisation.auth_config.login_method === 'native') {
      organisation.auth_config.login_method = 'mixed';
    }

    await organisation.save();
    const after = normaliseSsoConfig(organisation.auth_config.sso_config as never);
    await writeAudit(req, 'organisation.sso_config.update', organisation, { before, patch: parsed.data, after, validation });

    res.json({
      success: true,
      message: 'Organisation SSO provider configuration updated successfully.',
      data: formatResponse(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationSsoConfigRouter.post('/test', requireAuth, requirePermission('organisation.sso.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    const validation = validateSsoConfig(organisation.auth_config?.sso_config as never);
    await writeAudit(req, 'organisation.sso_config.test', organisation, { validation });

    res.json({
      success: true,
      message: 'Organisation SSO provider configuration validation completed.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        validation
      }
    });
  } catch (error) {
    next(error);
  }
});
