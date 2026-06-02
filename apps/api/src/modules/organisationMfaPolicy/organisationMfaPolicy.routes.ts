import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { getMfaOperationalNotes, sanitiseMfaConfig } from '../../utils/mfaPolicy.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const organisationMfaPolicyRouter = Router();

const mfaPolicyUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(['native', 'keycloak', 'azure_ad', 'okta', 'custom_oidc', 'none']).optional(),
    enforcement_mode: z.enum(['disabled', 'app_checked', 'idp_enforced']).optional(),
    required_for_roles: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    required_for_permissions: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
    claim_mapping: z
      .object({
        amr_claim: z.string().trim().min(1).max(80).nullable().optional(),
        acr_claim: z.string().trim().min(1).max(80).nullable().optional(),
        mfa_values: z.array(z.string().trim().min(1).max(80)).min(1).max(20).optional()
      })
      .optional(),
    recovery_policy: z
      .object({
        allow_admin_reset: z.boolean().optional(),
        require_audit_note: z.boolean().optional()
      })
      .optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one MFA policy field is required.');

function assertAuthOrganisationId(req: { auth?: { organisation_id: string } }) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  return new mongoose.Types.ObjectId(organisationId);
}

async function loadOrganisation(req: { auth?: { organisation_id: string } }) {
  const organisation = await OrganisationModel.findById(assertAuthOrganisationId(req));
  if (!organisation) {
    throw new HttpError(404, 'Organisation not found.');
  }
  return organisation;
}

function validateMfaPolicyPatch(patch: z.infer<typeof mfaPolicyUpdateSchema>) {
  const enabled = patch.enabled;
  const provider = patch.provider;
  const mode = patch.enforcement_mode;

  if (enabled === false && mode && mode !== 'disabled') {
    throw new HttpError(400, 'MFA enforcement mode must be disabled when MFA is disabled.');
  }

  if (mode === 'disabled' && enabled === true) {
    throw new HttpError(400, 'MFA cannot be enabled with disabled enforcement mode.');
  }

  if ((mode === 'app_checked' || mode === 'idp_enforced') && (provider === 'none' || provider === undefined) && enabled === true) {
    throw new HttpError(400, 'An MFA provider is required when enabling MFA enforcement.');
  }

  if (mode === 'idp_enforced' && provider === 'native') {
    throw new HttpError(400, 'idp_enforced mode requires an external provider such as keycloak, azure_ad, okta or custom_oidc.');
  }

  if (mode === 'app_checked' && provider && !['native', 'custom_oidc'].includes(provider)) {
    throw new HttpError(400, 'app_checked mode should use native or custom_oidc provider. External providers should normally use idp_enforced.');
  }
}

async function writeAudit(req: Request, action: string, organisation: { _id: unknown }, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: organisation._id,
    actor_user_id: req.auth!.sub,
    action,
    resource_type: 'organisation_mfa_policy',
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
    resourceType: 'organisation_mfa_policy',
    resourceId: String(organisation._id),
    details,
    request: req
  });
}

organisationMfaPolicyRouter.get('/', requireAuth, requirePermission('organisation.mfa.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    const mfa_policy = sanitiseMfaConfig(organisation.mfa_config);

    res.json({
      success: true,
      message: 'Organisation MFA policy returned successfully.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        mfa_policy,
        operational_notes: getMfaOperationalNotes(mfa_policy),
        integration_position: {
          recommended_provider: 'keycloak_or_external_idp_for_mfa_challenge',
          app_responsibility: 'Store policy, expose status, audit changes, and later validate MFA claims on tokens.',
          idp_responsibility: 'Perform the actual MFA challenge such as TOTP, WebAuthn/passkeys or conditional access.'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationMfaPolicyRouter.patch('/', requireAuth, requirePermission('organisation.mfa.manage'), async (req, res, next) => {
  try {
    const parsed = mfaPolicyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation MFA policy update request.', parsed.error.flatten());
    }

    validateMfaPolicyPatch(parsed.data);

    const organisation = await loadOrganisation(req);
    const before = sanitiseMfaConfig(organisation.mfa_config);
    const nextConfig = {
      ...before,
      ...parsed.data,
      claim_mapping: {
        ...before.claim_mapping,
        ...(parsed.data.claim_mapping ?? {})
      },
      recovery_policy: {
        ...before.recovery_policy,
        ...(parsed.data.recovery_policy ?? {})
      }
    };

    if (!nextConfig.enabled) {
      nextConfig.provider = 'none';
      nextConfig.enforcement_mode = 'disabled';
    }

    organisation.mfa_config = nextConfig;
    organisation.auth_config.enforce_mfa = nextConfig.enabled && nextConfig.enforcement_mode !== 'disabled';
    await organisation.save();

    const after = sanitiseMfaConfig(organisation.mfa_config);
    await writeAudit(req, 'organisation.mfa_policy.update', organisation, { before, patch: parsed.data, after });

    res.json({
      success: true,
      message: 'Organisation MFA policy updated successfully.',
      data: {
        organisation: {
          id: organisation._id.toString(),
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status
        },
        mfa_policy: after,
        operational_notes: getMfaOperationalNotes(after)
      }
    });
  } catch (error) {
    next(error);
  }
});
