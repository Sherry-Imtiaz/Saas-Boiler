import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAllPermissions, requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel, PlanModel } from '../../models/index.js';
import { formatPlan, buildPlanAssignment, mergeFeatureDefaults, normalisePlanLimits, readPlainMap } from '../../utils/plans.js';
import { HttpError } from '../../utils/httpError.js';

export const planCatalogueRouter = Router();
export const organisationPlanRouter = Router();
export const platformOrganisationPlanRouter = Router({ mergeParams: true });

const planLimitsSchema = z.object({
  max_users: z.number().nonnegative().nullable().optional(),
  max_storage_gb: z.number().nonnegative().nullable().optional(),
  max_file_size_mb: z.number().nonnegative().nullable().optional(),
  max_personal_access_tokens: z.number().nonnegative().nullable().optional(),
  max_organisation_api_tokens: z.number().nonnegative().nullable().optional(),
  max_compute_jobs_per_month: z.number().nonnegative().nullable().optional(),
  max_concurrent_compute_jobs: z.number().nonnegative().nullable().optional(),
  max_cpu: z.number().nonnegative().nullable().optional(),
  max_memory_mb: z.number().nonnegative().nullable().optional()
}).partial();

const planPricingSchema = z.object({
  currency: z.string().trim().min(3).max(3).optional(),
  monthly_amount_cents: z.number().nonnegative().nullable().optional(),
  yearly_amount_cents: z.number().nonnegative().nullable().optional(),
  billing_note: z.string().trim().max(500).nullable().optional()
}).partial();

const planBodySchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  billing_mode: z.enum(['manual', 'stripe_ready', 'custom']).optional(),
  pricing: planPricingSchema.optional(),
  features: z.record(z.boolean()).optional(),
  limits: planLimitsSchema.optional(),
  is_custom: z.boolean().optional()
});

const createPlanSchema = planBodySchema.extend({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(200)
});

const assignPlanSchema = z.object({
  plan_key: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subscription_status: z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'manual']).default('manual'),
  billing_mode: z.enum(['manual', 'stripe_ready', 'custom']).default('manual'),
  trial_ends_at: z.string().datetime().nullable().optional(),
  current_period_ends_at: z.string().datetime().nullable().optional(),
  apply_feature_defaults: z.boolean().default(false),
  notes: z.string().trim().max(1000).nullable().optional()
});

function assertValidObjectId(value: string, label: string) {
  if (!mongoose.isValidObjectId(value)) {
    throw new HttpError(400, `${label} is not a valid MongoDB ObjectId.`);
  }
  return new mongoose.Types.ObjectId(value);
}

function getAuthOrganisationId(req: Request) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId) throw new HttpError(401, 'Authenticated organisation context is missing.');
  return assertValidObjectId(organisationId, 'Authenticated organisation id');
}

function formatOrganisation(organisation: { _id: unknown; name: string; slug: string; status: string; plan?: Record<string, unknown> | null; features?: unknown }) {
  return {
    id: String(organisation._id),
    name: organisation.name,
    slug: organisation.slug,
    status: organisation.status,
    plan: buildPlanAssignment(organisation),
    features: readPlainMap<boolean>(organisation.features)
  };
}

async function writePlanAudit(req: Request, organisationId: unknown, action: string, resourceType: string, resourceId: string, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: organisationId,
    actor_user_id: req.auth?.sub ?? null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });
}

async function findPlanOrThrow(planKey: string) {
  const plan = await PlanModel.findOne({ key: planKey.toLowerCase() });
  if (!plan) throw new HttpError(404, `Plan not found: ${planKey}`);
  return plan;
}

function buildPlanUpdateFromBody(body: z.infer<typeof planBodySchema>) {
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.status !== undefined) update.status = body.status;
  if (body.billing_mode !== undefined) update.billing_mode = body.billing_mode;
  if (body.pricing !== undefined) update.pricing = body.pricing;
  if (body.features !== undefined) update.features = body.features;
  if (body.limits !== undefined) update.limits = normalisePlanLimits(body.limits);
  if (body.is_custom !== undefined) update.is_custom = body.is_custom;
  return update;
}

planCatalogueRouter.get('/', requireAuth, requirePermission('plans.view'), async (_req, res, next) => {
  try {
    const plans = await PlanModel.find({}).sort({ key: 1 });
    res.json({
      success: true,
      message: 'Plan catalogue returned successfully.',
      data: {
        plans: plans.map(formatPlan),
        billing_statuses: ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'manual'],
        notes: [
          'v0.9.1 is plan/subscription readiness only. No payment gateway, invoices or billing webhooks are active.',
          'Plans define default feature entitlements and future module limits.',
          'Organisation feature gates still enforce runtime access alongside RBAC permissions/scopes.'
        ]
      }
    });
  } catch (error) { next(error); }
});

planCatalogueRouter.post('/', requireAuth, requirePermission('plans.manage'), async (req, res, next) => {
  try {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid plan create request.', parsed.error.flatten());

    const body = parsed.data;
    const plan = await PlanModel.findOneAndUpdate(
      { key: body.key },
      {
        $set: buildPlanUpdateFromBody(body),
        $setOnInsert: { key: body.key }
      },
      { upsert: true, new: true }
    );

    await writePlanAudit(req, req.auth!.organisation_id, 'plan.catalogue.upsert', 'plan', plan.key, { plan: formatPlan(plan) });

    res.status(201).json({ success: true, message: 'Plan created or updated successfully.', data: { plan: formatPlan(plan) } });
  } catch (error) { next(error); }
});

planCatalogueRouter.get('/:planKey', requireAuth, requirePermission('plans.view'), async (req, res, next) => {
  try {
    const plan = await findPlanOrThrow(String(req.params.planKey));
    res.json({ success: true, message: 'Plan returned successfully.', data: { plan: formatPlan(plan) } });
  } catch (error) { next(error); }
});

planCatalogueRouter.patch('/:planKey', requireAuth, requirePermission('plans.manage'), async (req, res, next) => {
  try {
    const parsed = planBodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid plan update request.', parsed.error.flatten());
    const before = await findPlanOrThrow(String(req.params.planKey));
    const beforeFormatted = formatPlan(before);
    const update = buildPlanUpdateFromBody(parsed.data);
    const updated = await PlanModel.findOneAndUpdate({ key: String(req.params.planKey).toLowerCase() }, { $set: update }, { new: true });
    if (!updated) throw new HttpError(404, `Plan not found: ${String(req.params.planKey)}`);
    await writePlanAudit(req, req.auth!.organisation_id, 'plan.catalogue.update', 'plan', updated.key, { before: beforeFormatted, after: formatPlan(updated) });
    res.json({ success: true, message: 'Plan updated successfully.', data: { plan: formatPlan(updated) } });
  } catch (error) { next(error); }
});

organisationPlanRouter.get('/', requireAuth, requirePermission('plans.view'), async (req, res, next) => {
  try {
    const organisation = await OrganisationModel.findById(getAuthOrganisationId(req));
    if (!organisation) throw new HttpError(404, 'Organisation not found.');
    const assignment = buildPlanAssignment(organisation);
    const cataloguePlan = assignment.plan_key ? await PlanModel.findOne({ key: assignment.plan_key }) : null;
    res.json({
      success: true,
      message: 'Organisation plan returned successfully.',
      data: {
        organisation: formatOrganisation(organisation),
        plan_assignment: assignment,
        plan: cataloguePlan ? formatPlan(cataloguePlan) : null,
        effective_limits: assignment.limits,
        effective_features: readPlainMap<boolean>(organisation.features),
        readiness_notes: [
          'This is subscription readiness only. No card payments, invoices or webhooks are active.',
          'Future file and compute modules should read these plan limits before accepting usage.'
        ]
      }
    });
  } catch (error) { next(error); }
});

platformOrganisationPlanRouter.get('/', requireAuth, requireAllPermissions(['platform.organisations.view', 'plans.view']), async (req, res, next) => {
  try {
    const organisation = await OrganisationModel.findById(assertValidObjectId(String(req.params.organisationId), 'Organisation id'));
    if (!organisation) throw new HttpError(404, 'Organisation not found.');
    const assignment = buildPlanAssignment(organisation);
    const cataloguePlan = assignment.plan_key ? await PlanModel.findOne({ key: assignment.plan_key }) : null;
    res.json({ success: true, message: 'Platform organisation plan returned successfully.', data: { organisation: formatOrganisation(organisation), plan_assignment: assignment, plan: cataloguePlan ? formatPlan(cataloguePlan) : null } });
  } catch (error) { next(error); }
});

platformOrganisationPlanRouter.patch('/', requireAuth, requireAllPermissions(['platform.organisations.manage', 'plans.manage']), async (req, res, next) => {
  try {
    const parsed = assignPlanSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid organisation plan assignment request.', parsed.error.flatten());

    const organisation = await OrganisationModel.findById(assertValidObjectId(String(req.params.organisationId), 'Organisation id'));
    if (!organisation) throw new HttpError(404, 'Organisation not found.');
    const plan = await findPlanOrThrow(parsed.data.plan_key);
    const before = { plan: buildPlanAssignment(organisation), features: readPlainMap<boolean>(organisation.features) };
    const planFeatures = readPlainMap<boolean>(plan.features);
    const planLimits = normalisePlanLimits(plan.limits);

    organisation.plan = {
      ...(organisation.plan ?? {}),
      plan_id: plan.key,
      plan_key: plan.key,
      name: plan.name,
      billing_status: parsed.data.subscription_status,
      subscription_status: parsed.data.subscription_status,
      billing_mode: parsed.data.billing_mode,
      trial_ends_at: parsed.data.trial_ends_at ? new Date(parsed.data.trial_ends_at) : null,
      current_period_ends_at: parsed.data.current_period_ends_at ? new Date(parsed.data.current_period_ends_at) : null,
      assigned_at: new Date(),
      assigned_by_user_id: new mongoose.Types.ObjectId(req.auth!.sub),
      limits: planLimits,
      features_from_plan: parsed.data.apply_feature_defaults,
      notes: parsed.data.notes ?? null
    } as never;

    if (parsed.data.apply_feature_defaults) {
      organisation.features = mergeFeatureDefaults(organisation.features, planFeatures) as never;
    }

    await organisation.save();
    const after = { plan: buildPlanAssignment(organisation), features: readPlainMap<boolean>(organisation.features) };

    await writePlanAudit(req, organisation._id, 'organisation.plan.assign', 'organisation_plan', String(organisation._id), { before, plan: formatPlan(plan), after, apply_feature_defaults: parsed.data.apply_feature_defaults });

    res.json({ success: true, message: 'Organisation plan assigned successfully.', data: { organisation: formatOrganisation(organisation), plan_assignment: buildPlanAssignment(organisation), plan: formatPlan(plan), applied_feature_defaults: parsed.data.apply_feature_defaults } });
  } catch (error) { next(error); }
});

platformOrganisationPlanRouter.post('/apply-defaults', requireAuth, requireAllPermissions(['platform.organisations.manage', 'plans.manage']), async (req, res, next) => {
  try {
    const organisation = await OrganisationModel.findById(assertValidObjectId(String(req.params.organisationId), 'Organisation id'));
    if (!organisation) throw new HttpError(404, 'Organisation not found.');
    const assignment = buildPlanAssignment(organisation);
    if (!assignment.plan_key) throw new HttpError(400, 'Organisation does not have a plan assigned.');
    const plan = await findPlanOrThrow(assignment.plan_key);
    const before = readPlainMap<boolean>(organisation.features);
    organisation.features = mergeFeatureDefaults(organisation.features, plan.features) as never;
    if (organisation.plan) {
      organisation.plan.limits = normalisePlanLimits(plan.limits) as never;
      organisation.plan.features_from_plan = true;
    }
    await organisation.save();
    await writePlanAudit(req, organisation._id, 'organisation.plan.apply_defaults', 'organisation_plan', String(organisation._id), { plan_key: plan.key, before_features: before, after_features: readPlainMap<boolean>(organisation.features), limits: normalisePlanLimits(plan.limits) });
    res.json({ success: true, message: 'Plan feature defaults and limits applied successfully.', data: { organisation: formatOrganisation(organisation), plan_assignment: buildPlanAssignment(organisation), plan: formatPlan(plan) } });
  } catch (error) { next(error); }
});
