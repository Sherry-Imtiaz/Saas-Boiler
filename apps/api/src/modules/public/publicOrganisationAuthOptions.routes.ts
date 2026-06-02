import { Router } from 'express';
import { z } from 'zod';
import { OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { sanitiseMfaConfig } from '../../utils/mfaPolicy.js';

export const publicOrganisationAuthOptionsRouter = Router();

const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(253)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'Identifier must be an organisation slug or domain.');

function formatAuthOptions(organisation: {
  _id: unknown;
  name: string;
  slug: string;
  status: string;
  auth_config?: {
    login_method?: string;
    sso_enabled?: boolean;
    provider?: string | null;
    allowed_email_domains?: string[];
    auto_provision_users?: boolean;
    enforce_sso?: boolean;
    enforce_mfa?: boolean;
  };
  mfa_config?: unknown;
}) {
  const loginMethod = organisation.auth_config?.login_method ?? 'native';
  const ssoEnabled = Boolean(organisation.auth_config?.sso_enabled) || ['oidc', 'saml', 'mixed'].includes(loginMethod);
  const mfaPolicy = sanitiseMfaConfig(organisation.mfa_config as never);

  return {
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status
    },
    auth_options: {
      login_method: loginMethod,
      native_login_enabled: ['native', 'mixed'].includes(loginMethod) && !organisation.auth_config?.enforce_sso,
      sso_enabled: ssoEnabled,
      sso_provider: organisation.auth_config?.provider ?? null,
      allowed_email_domains: organisation.auth_config?.allowed_email_domains ?? [],
      auto_provision_users: Boolean(organisation.auth_config?.auto_provision_users),
      enforce_sso: Boolean(organisation.auth_config?.enforce_sso),
      enforce_mfa: Boolean(organisation.auth_config?.enforce_mfa),
      mfa: {
        enabled: mfaPolicy.enabled,
        provider: mfaPolicy.provider,
        enforcement_mode: mfaPolicy.enforcement_mode,
        idp_enforced: mfaPolicy.enabled && mfaPolicy.enforcement_mode === 'idp_enforced',
        app_checked: mfaPolicy.enabled && mfaPolicy.enforcement_mode === 'app_checked'
      }
    },
    notes: [
      'This endpoint exposes safe, public login-method metadata only.',
      'Client id, issuer URL and secret references are intentionally not exposed on the public endpoint.',
      'Real OIDC/SAML redirects are planned for a later build.',
      'MFA challenge flows are provider-neutral in v0.9.1 and are expected to run in Keycloak/Entra/Okta when an external IdP is used.'
    ]
  };
}

publicOrganisationAuthOptionsRouter.get('/organisation-auth-options/:identifier', async (req, res, next) => {
  try {
    const parsed = identifierSchema.safeParse(req.params.identifier);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation auth options identifier.', parsed.error.flatten());
    }

    const identifier = parsed.data;
    const organisation = await OrganisationModel.findOne({
      $or: [{ slug: identifier }, { 'domains.domain': identifier }]
    }).lean();

    if (!organisation) {
      throw new HttpError(404, 'Organisation auth options not found.');
    }

    res.json({
      success: true,
      message: 'Organisation auth options returned successfully.',
      data: {
        ...formatAuthOptions(organisation),
        resolved_by: organisation.slug === identifier ? 'slug' : 'domain'
      }
    });
  } catch (error) {
    next(error);
  }
});
