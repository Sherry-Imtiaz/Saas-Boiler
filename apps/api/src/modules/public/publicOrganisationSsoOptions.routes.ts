import { Router } from 'express';
import { z } from 'zod';
import { OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { normaliseSsoConfig } from '../../utils/ssoConfig.js';

export const publicOrganisationSsoOptionsRouter = Router();

const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(253)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'Identifier must be an organisation slug or domain.');

publicOrganisationSsoOptionsRouter.get('/organisation-sso-options/:identifier', async (req, res, next) => {
  try {
    const parsed = identifierSchema.safeParse(req.params.identifier);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation SSO options identifier.', parsed.error.flatten());
    }

    const identifier = parsed.data;
    const organisation = await OrganisationModel.findOne({
      $or: [{ slug: identifier }, { 'domains.domain': identifier }]
    }).lean();

    if (!organisation) {
      throw new HttpError(404, 'Organisation SSO options not found.');
    }

    const ssoConfig = normaliseSsoConfig(organisation.auth_config?.sso_config as never);
    const enabled = Boolean(ssoConfig.enabled && organisation.auth_config?.sso_enabled);

    res.json({
      success: true,
      message: 'Organisation public SSO options returned successfully.',
      data: {
        organisation: {
          id: String(organisation._id),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        sso_options: {
          enabled,
          provider: enabled ? ssoConfig.provider : null,
          protocol: enabled ? ssoConfig.protocol : null,
          login_button_label: enabled ? `Continue with ${ssoConfig.provider}` : null,
          start_url: enabled ? `/api/auth/sso/${organisation.slug}/start` : null,
          pkce_enabled: ssoConfig.pkce_enabled,
          scopes: ssoConfig.scopes,
          require_verified_email: ssoConfig.require_verified_email
        },
        resolved_by: organisation.slug === identifier ? 'slug' : 'domain',
        notes: [
          'This endpoint exposes safe public SSO login metadata only.',
          'Client secret references and provider endpoints are intentionally not exposed publicly.',
          'Use the SSO start URL to begin the active OIDC authorization-code + PKCE login flow.'
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});
