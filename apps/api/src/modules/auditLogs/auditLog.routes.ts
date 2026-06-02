import { Router, type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';

export const organisationAuditLogRouter = Router();
export const platformAuditLogRouter = Router();
export const platformOrganisationAuditLogRouter = Router({ mergeParams: true });

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().trim().toLowerCase().max(160).optional(),
  resource_type: z.string().trim().toLowerCase().max(160).optional(),
  actor_user_id: z.string().trim().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

function assertAuth(req: Request) {
  if (!req.auth) {
    throw new HttpError(401, 'Authentication required.');
  }

  return req.auth;
}

function assertValidObjectId(value: string | undefined, label: string) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
}

function formatAuditLog(record: {
  _id: unknown;
  organisation_id: unknown;
  actor_user_id?: unknown;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(record._id),
    organisation_id: String(record.organisation_id),
    actor_user_id: record.actor_user_id ? String(record.actor_user_id) : null,
    action: record.action,
    resource_type: record.resource_type,
    resource_id: record.resource_id ?? null,
    details: record.details ?? {},
    ip_address: record.ip_address ?? null,
    user_agent: record.user_agent ?? null,
    created_at: record.createdAt ?? null,
    updated_at: record.updatedAt ?? null
  };
}

function buildFilter(query: z.infer<typeof auditLogQuerySchema>, organisationId?: string) {
  const filter: Record<string, unknown> = {};

  if (organisationId) {
    filter.organisation_id = new mongoose.Types.ObjectId(organisationId);
  }

  if (query.action) {
    filter.action = query.action;
  }

  if (query.resource_type) {
    filter.resource_type = query.resource_type;
  }

  if (query.actor_user_id) {
    assertValidObjectId(query.actor_user_id, 'actor_user_id');
    filter.actor_user_id = new mongoose.Types.ObjectId(query.actor_user_id);
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {})
    };
  }

  return filter;
}

async function listAuditLogs(req: Request, res: Response, next: NextFunction, organisationId?: string) {
  try {
    const parsed = auditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid audit log query.', parsed.error.flatten());
    }

    if (organisationId) {
      assertValidObjectId(organisationId, 'organisation id');
    }

    const filter = buildFilter(parsed.data, organisationId);
    const skip = (parsed.data.page - 1) * parsed.data.limit;

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsed.data.limit).lean(),
      AuditLogModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items.map(formatAuditLog),
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
}

async function getAuditLog(req: Request, res: Response, next: NextFunction, organisationId?: string) {
  try {
    const auditLogId = String(req.params.auditLogId);
    assertValidObjectId(auditLogId, 'audit log id');

    if (organisationId) {
      assertValidObjectId(organisationId, 'organisation id');
    }

    const filter: Record<string, unknown> = { _id: auditLogId };
    if (organisationId) {
      filter.organisation_id = new mongoose.Types.ObjectId(organisationId);
    }

    const record = await AuditLogModel.findOne(filter).lean();
    if (!record) {
      throw new HttpError(404, 'Audit log not found.');
    }

    res.json({ success: true, data: formatAuditLog(record) });
  } catch (error) {
    next(error);
  }
}

organisationAuditLogRouter.get('/', requireAuth, requirePermission('audit.view'), async (req, res, next) => {
  const auth = assertAuth(req);
  await listAuditLogs(req, res, next, auth.organisation_id);
});

organisationAuditLogRouter.get('/:auditLogId', requireAuth, requirePermission('audit.view'), async (req, res, next) => {
  const auth = assertAuth(req);
  await getAuditLog(req, res, next, auth.organisation_id);
});

platformAuditLogRouter.get('/', requireAuth, requirePermission('audit.platform.view'), async (req, res, next) => {
  await listAuditLogs(req, res, next);
});

platformAuditLogRouter.get('/:auditLogId', requireAuth, requirePermission('audit.platform.view'), async (req, res, next) => {
  await getAuditLog(req, res, next);
});

platformOrganisationAuditLogRouter.get(
  '/',
  requireAuth,
  requirePermission('audit.platform.view'),
  async (req, res, next) => {
    await listAuditLogs(req, res, next, String(req.params.organisationId));
  }
);
