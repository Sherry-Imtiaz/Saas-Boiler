import { Router } from 'express';
import { OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { getMfaOperationalNotes, sanitiseMfaConfig } from '../../utils/mfaPolicy.js';

export const publicOrganisationMfaPolicyRouter = Router();

function normaliseIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

publicOrganisationMfaPolicyRouter.get('/organisation-mfa-policy/:identifier', async (req, res, next) => {
  try {
    const identifier = normaliseIdentifier(req.params.identifier ?? '');
    if (!identifier) {
      throw new HttpError(400, 'Organisation identifier is required.');
    }

    const organisation = await OrganisationModel.findOne({
      $or: [{ slug: identifier }, { 'domains.domain': identifier }]
    });

    if (!organisation || organisation.status !== 'active') {
      throw new HttpError(404, 'Active organisation was not found for the supplied identifier.');
    }

    const mfaPolicy = sanitiseMfaConfig(organisation.mfa_config);

    res.json({
      success: true,
      message: 'Public organisation MFA policy returned successfully.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        mfa_options: {
          enabled: mfaPolicy.enabled,
          provider: mfaPolicy.provider,
          enforcement_mode: mfaPolicy.enforcement_mode,
          idp_enforced: mfaPolicy.enabled && mfaPolicy.enforcement_mode === 'idp_enforced',
          app_checked: mfaPolicy.enabled && mfaPolicy.enforcement_mode === 'app_checked'
        },
        notes: getMfaOperationalNotes(mfaPolicy),
        resolved_by: organisation.slug === identifier ? 'slug' : 'domain'
      }
    });
  } catch (error) {
    next(error);
  }
});
