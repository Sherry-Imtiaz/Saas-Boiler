import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';

export const organisationRouter = Router();

const organisationStatusSchema = z.enum(['active', 'inactive', 'suspended']);

const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers and single hyphens only.');

const domainSchema = z.object({
  domain: z.string().trim().toLowerCase().min(3).max(253),
  verified: z.boolean().optional().default(false),
  is_primary: z.boolean().optional().default(false)
});

const planSchema = z
  .object({
    plan_id: z.string().trim().max(120).nullable().optional(),
    name: z.string().trim().max(120).nullable().optional(),
    billing_status: z.string().trim().max(120).nullable().optional()
  })
  .partial();

const brandingSchema = z
  .object({
    logo_url: z.string().trim().url().nullable().optional(),
    primary_colour: z.string().trim().max(40).nullable().optional(),
    secondary_colour: z.string().trim().max(40).nullable().optional(),
    login_title: z.string().trim().max(160).nullable().optional(),
    login_subtitle: z.string().trim().max(240).nullable().optional(),
    login_background_url: z.string().trim().url().nullable().optional(),
    support_email: z.string().trim().email().nullable().optional()
  })
  .partial();

const storageSchema = z
  .object({
    storage_provider: z.string().trim().max(120).nullable().optional(),
    storage_prefix: z.string().trim().max(500).nullable().optional(),
    max_storage_gb: z.number().min(0).nullable().optional()
  })
  .partial();

const createOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema.optional(),
  status: organisationStatusSchema.optional().default('active'),
  plan: planSchema.optional(),
  branding: brandingSchema.optional(),
  domains: z.array(domainSchema).max(20).optional(),
  features: z.record(z.boolean()).optional(),
  storage: storageSchema.optional()
});

const updateOrganisationSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    slug: slugSchema.optional(),
    plan: planSchema.optional(),
    branding: brandingSchema.optional(),
    domains: z.array(domainSchema).max(20).optional(),
    features: z.record(z.boolean()).optional(),
    storage: storageSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one update field is required.');

const updateOrganisationStatusSchema = z.object({
  status: organisationStatusSchema
});

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || `organisation-${Date.now()}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normaliseDomains(domains?: z.infer<typeof domainSchema>[]) {
  if (!domains || domains.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalised = domains.map((domain, index) => {
    const cleanedDomain = domain.domain.trim().toLowerCase();

    if (seen.has(cleanedDomain)) {
      throw new HttpError(400, `Duplicate domain supplied: ${cleanedDomain}`);
    }

    seen.add(cleanedDomain);

    return {
      domain: cleanedDomain,
      verified: domain.verified ?? false,
      is_primary: domain.is_primary ?? index === 0
    };
  });

  if (!normalised.some((domain) => domain.is_primary)) {
    normalised[0].is_primary = true;
  }

  const primaryDomains = normalised.filter((domain) => domain.is_primary);
  if (primaryDomains.length > 1) {
    throw new HttpError(400, 'Only one organisation domain can be marked as primary.');
  }

  return normalised;
}

function assertValidObjectId(id: string): void {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'Invalid organisation id.');
  }
}

function formatOrganisation(organisation: { toObject: (options?: Record<string, unknown>) => Record<string, unknown>; _id: mongoose.Types.ObjectId } | null) {
  if (!organisation) {
    return null;
  }

  const object = organisation.toObject({ versionKey: false });

  return {
    ...object,
    id: String(object._id),
    _id: String(object._id)
  };
}

async function writeAuditLog(params: {
  organisationId: mongoose.Types.ObjectId;
  action: string;
  resourceId: string;
  details: Record<string, unknown>;
}) {
  await AuditLogModel.create({
    organisation_id: params.organisationId,
    actor_user_id: null,
    action: params.action,
    resource_type: 'organisation',
    resource_id: params.resourceId,
    details: params.details
  });
}

organisationRouter.post('/', requireAuth, requirePermission('platform.organisations.manage'), async (req, res, next) => {
  try {
    const parsed = createOrganisationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation create request.', parsed.error.flatten());
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    const existing = await OrganisationModel.findOne({ slug });

    if (existing) {
      throw new HttpError(409, `Organisation slug already exists: ${slug}`);
    }

    const organisation = await OrganisationModel.create({
      name: parsed.data.name,
      slug,
      status: parsed.data.status,
      plan: parsed.data.plan ?? {},
      branding: parsed.data.branding ?? {},
      domains: normaliseDomains(parsed.data.domains),
      features: parsed.data.features,
      storage: {
        storage_prefix: `organisations/${slug}/`,
        ...(parsed.data.storage ?? {})
      }
    });

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'organisation.create',
      resourceId: organisation._id.toString(),
      details: {
        name: organisation.name,
        slug: organisation.slug,
        status: organisation.status,
        note: 'Created through internal platform organisation API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Organisation created successfully.',
      data: formatOrganisation(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationRouter.get('/', requireAuth, requirePermission('platform.organisations.view'), async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: organisationStatusSchema.optional(),
      search: z.string().trim().max(120).optional()
    });

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation list query.', parsed.error.flatten());
    }

    const filter: Record<string, unknown> = {};

    if (parsed.data.status) {
      filter.status = parsed.data.status;
    }

    if (parsed.data.search) {
      const searchRegex = new RegExp(escapeRegExp(parsed.data.search), 'i');
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }, { 'domains.domain': searchRegex }];
    }

    const skip = (parsed.data.page - 1) * parsed.data.limit;
    const [items, total] = await Promise.all([
      OrganisationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsed.data.limit),
      OrganisationModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items.map((organisation) => formatOrganisation(organisation)),
      pagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
        total_pages: Math.ceil(total / parsed.data.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

organisationRouter.get('/:id', requireAuth, requirePermission('platform.organisations.view'), async (req, res, next) => {
  try {
    const organisationId = String(req.params.id);
    assertValidObjectId(organisationId);

    const organisation = await OrganisationModel.findById(organisationId);

    if (!organisation) {
      throw new HttpError(404, 'Organisation not found.');
    }

    res.json({
      success: true,
      data: formatOrganisation(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationRouter.patch('/:id', requireAuth, requirePermission('platform.organisations.manage'), async (req, res, next) => {
  try {
    const organisationId = String(req.params.id);
    assertValidObjectId(organisationId);

    const parsed = updateOrganisationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation update request.', parsed.error.flatten());
    }

    const organisation = await OrganisationModel.findById(organisationId);

    if (!organisation) {
      throw new HttpError(404, 'Organisation not found.');
    }

    if (parsed.data.slug && parsed.data.slug !== organisation.slug) {
      const existing = await OrganisationModel.findOne({ slug: parsed.data.slug, _id: { $ne: organisation._id } });
      if (existing) {
        throw new HttpError(409, `Organisation slug already exists: ${parsed.data.slug}`);
      }
    }

    const before = {
      name: organisation.name,
      slug: organisation.slug,
      domains: organisation.domains,
      features: organisation.features
    };

    if (parsed.data.name !== undefined) organisation.name = parsed.data.name;
    if (parsed.data.slug !== undefined) organisation.slug = parsed.data.slug;
    if (parsed.data.plan !== undefined) organisation.set('plan', { ...organisation.plan, ...parsed.data.plan });
    if (parsed.data.branding !== undefined) organisation.set('branding', { ...organisation.branding, ...parsed.data.branding });
    if (parsed.data.domains !== undefined) organisation.domains = normaliseDomains(parsed.data.domains);
    if (parsed.data.features !== undefined) organisation.set('features', parsed.data.features);
    if (parsed.data.storage !== undefined) organisation.set('storage', { ...organisation.storage, ...parsed.data.storage });

    await organisation.save();

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'organisation.update',
      resourceId: organisation._id.toString(),
      details: {
        before,
        updated_fields: Object.keys(parsed.data),
        note: 'Updated through internal platform organisation API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.json({
      success: true,
      message: 'Organisation updated successfully.',
      data: formatOrganisation(organisation)
    });
  } catch (error) {
    next(error);
  }
});

organisationRouter.patch('/:id/status', requireAuth, requirePermission('platform.organisations.manage'), async (req, res, next) => {
  try {
    const organisationId = String(req.params.id);
    assertValidObjectId(organisationId);

    const parsed = updateOrganisationStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid organisation status update request.', parsed.error.flatten());
    }

    const organisation = await OrganisationModel.findById(organisationId);

    if (!organisation) {
      throw new HttpError(404, 'Organisation not found.');
    }

    const previousStatus = organisation.status;
    organisation.status = parsed.data.status;
    await organisation.save();

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'organisation.status_update',
      resourceId: organisation._id.toString(),
      details: {
        previous_status: previousStatus,
        new_status: organisation.status,
        note: 'Status updated through internal platform organisation API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.json({
      success: true,
      message: 'Organisation status updated successfully.',
      data: formatOrganisation(organisation)
    });
  } catch (error) {
    next(error);
  }
});
