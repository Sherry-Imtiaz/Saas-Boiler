import { Router } from 'express';
import { z } from 'zod';
import { OrganisationModel } from '../../models/index.js';
import { normaliseTheme } from '../../utils/brandingTheme.js';
import { HttpError } from '../../utils/httpError.js';

export const publicOrganisationLoginRouter = Router();

const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(253)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'Identifier must be an organisation slug or domain.');

function formatPublicLoginConfig(organisation: {
  _id: unknown;
  name: string;
  slug: string;
  status: string;
  branding?: Record<string, unknown>;
  domains?: Array<{ domain: string; verified?: boolean; is_primary?: boolean }>;
  theme?: Record<string, unknown>;
  auth_config?: {
    login_method?: string;
    sso_enabled?: boolean;
    provider?: string | null;
    allowed_email_domains?: string[];
    auto_provision_users?: boolean;
    enforce_sso?: boolean;
    enforce_mfa?: boolean;
  };
}) {
  const theme = normaliseTheme(organisation.theme ?? null);
  return {
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status,
      branding: {
        logo_url: organisation.branding?.logo_url ?? null,
        favicon_url: organisation.branding?.favicon_url ?? null,
        login_background_url: organisation.branding?.login_background_url ?? null,
        sidebar_logo_url: organisation.branding?.sidebar_logo_url ?? null,
        email_logo_url: organisation.branding?.email_logo_url ?? null,
        primary_colour: organisation.branding?.primary_colour ?? theme.primary_colour,
        secondary_colour: organisation.branding?.secondary_colour ?? theme.secondary_colour,
        login_title: organisation.branding?.login_title ?? `Welcome to ${organisation.name}`,
        login_subtitle: organisation.branding?.login_subtitle ?? 'Sign in to continue.',
        support_email: organisation.branding?.support_email ?? null
      },
      theme,
      domains: (organisation.domains ?? []).map((domain) => ({
        domain: domain.domain,
        verified: Boolean(domain.verified),
        is_primary: Boolean(domain.is_primary)
      })),
      auth_config: {
        login_method: organisation.auth_config?.login_method ?? 'native',
        sso_enabled: Boolean(organisation.auth_config?.sso_enabled),
        provider: organisation.auth_config?.provider ?? null,
        allowed_email_domains: organisation.auth_config?.allowed_email_domains ?? [],
        auto_provision_users: Boolean(organisation.auth_config?.auto_provision_users),
        enforce_sso: Boolean(organisation.auth_config?.enforce_sso),
        enforce_mfa: Boolean(organisation.auth_config?.enforce_mfa)
      }
    },
    login_policy: {
      native_login_enabled: ['native', 'mixed'].includes(organisation.auth_config?.login_method ?? 'native'),
      sso_enabled: Boolean(organisation.auth_config?.sso_enabled),
      enforce_sso: Boolean(organisation.auth_config?.enforce_sso),
      enforce_mfa: Boolean(organisation.auth_config?.enforce_mfa)
    }
  };
}

publicOrganisationLoginRouter.get('/:identifier', async (req, res, next) => {
  try {
    const parsed = identifierSchema.safeParse(req.params.identifier);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation login identifier.', parsed.error.flatten());
    }

    const identifier = parsed.data;
    const organisation = await OrganisationModel.findOne({
      $or: [{ slug: identifier }, { 'domains.domain': identifier }]
    }).lean();

    if (!organisation) {
      throw new HttpError(404, 'Organisation login configuration not found.');
    }

    res.json({
      success: true,
      message: 'Organisation login configuration returned successfully.',
      data: {
        ...formatPublicLoginConfig(organisation),
        resolved_by: organisation.slug === identifier ? 'slug' : 'domain'
      }
    });
  } catch (error) {
    next(error);
  }
});
