import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel } from '../../models/index.js';
import { buildFeatureMap, buildFeatureState, FEATURE_CATALOGUE, FEATURE_KEYS, isFeatureKey } from '../../utils/features.js';
import { HttpError } from '../../utils/httpError.js';

export const featureCatalogueRouter = Router();
export const organisationFeatureRouter = Router();

const featurePatchSchema = z
  .object({
    features: z.record(z.boolean()).optional()
  })
  .refine((value) => value.features && Object.keys(value.features).length > 0, 'At least one feature flag must be provided.');

function assertAuthOrganisationId(req: { auth?: { organisation_id: string } }) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  return new mongoose.Types.ObjectId(organisationId);
}

function formatOrganisation(organisation: { _id: unknown; name: string; slug: string; status: string }) {
  return {
    id: String(organisation._id),
    name: organisation.name,
    slug: organisation.slug,
    status: organisation.status
  };
}

function validateFeaturePatch(features: Record<string, boolean>) {
  const invalidKeys = Object.keys(features).filter((key) => !isFeatureKey(key));
  if (invalidKeys.length > 0) {
    throw new HttpError(400, `Unknown feature keys: ${invalidKeys.join(', ')}`);
  }

  return Object.fromEntries(
    Object.entries(features).map(([key, enabled]) => [key, Boolean(enabled)])
  ) as Record<string, boolean>;
}

async function loadOrganisation(req: { auth?: { organisation_id: string } }) {
  const organisationId = assertAuthOrganisationId(req);
  const organisation = await OrganisationModel.findById(organisationId);
  if (!organisation) {
    throw new HttpError(404, 'Organisation not found.');
  }
  return organisation;
}

async function writeFeatureAudit(req: Request, organisation: { _id: unknown }, action: string, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: organisation._id,
    actor_user_id: req.auth!.sub,
    action,
    resource_type: 'organisation_features',
    resource_id: String(organisation._id),
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });
}

featureCatalogueRouter.get('/catalogue', requireAuth, requirePermission('features.view'), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Feature catalogue returned successfully.',
      data: {
        features: FEATURE_CATALOGUE,
        feature_keys: FEATURE_KEYS,
        notes: [
          'Feature entitlements are organisation-level gates.',
          'A user still requires RBAC permission after a feature is enabled.',
          'Future modules should use requireFeature(feature_key) together with requirePermission(permission_key).'
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationFeatureRouter.get('/', requireAuth, requirePermission('features.view'), async (req, res, next) => {
  try {
    const organisation = await loadOrganisation(req);
    const featureMap = buildFeatureMap(organisation.features);
    res.json({
      success: true,
      message: 'Organisation feature entitlements returned successfully.',
      data: {
        organisation: formatOrganisation(organisation),
        features: buildFeatureState(organisation.features),
        feature_map: featureMap,
        enforcement: {
          rule: 'Feature enabled for organisation AND user/token has required permission/scope.',
          helper: 'requireFeature(feature_key)'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationFeatureRouter.patch('/', requireAuth, requirePermission('features.manage'), async (req, res, next) => {
  try {
    const parsed = featurePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation feature update request.', parsed.error.flatten());
    }

    const organisation = await loadOrganisation(req);
    const before = buildFeatureMap(organisation.features);
    const patch = validateFeaturePatch(parsed.data.features ?? {});
    const after = { ...before, ...patch };

    organisation.features = after as never;
    await organisation.save();

    await writeFeatureAudit(req, organisation, 'organisation.features.update', { before, patch, after });

    res.json({
      success: true,
      message: 'Organisation feature entitlements updated successfully.',
      data: {
        organisation: formatOrganisation(organisation),
        features: buildFeatureState(organisation.features),
        feature_map: buildFeatureMap(organisation.features)
      }
    });
  } catch (error) {
    next(error);
  }
});
