import { Router, type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { SecurityEventModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';

export const organisationSecurityEventRouter = Router();
export const platformSecurityEventRouter = Router();
export const platformOrganisationSecurityEventRouter = Router({ mergeParams: true });

const securityEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  event_type: z.string().trim().toLowerCase().max(160).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['success', 'failure', 'warning', 'blocked', 'info']).optional(),
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

function formatSecurityEvent(record: {
  _id: unknown;
  organisation_id: unknown;
  actor_user_id?: unknown;
  event_type: string;
  severity: string;
  status: string;
  resource_type?: string | null;
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
    event_type: record.event_type,
    severity: record.severity,
    status: record.status,
    resource_type: record.resource_type ?? null,
    resource_id: record.resource_id ?? null,
    details: record.details ?? {},
    ip_address: record.ip_address ?? null,
    user_agent: record.user_agent ?? null,
    created_at: record.createdAt ?? null,
    updated_at: record.updatedAt ?? null
  };
}

function buildFilter(query: z.infer<typeof securityEventQuerySchema>, organisationId?: string) {
  const filter: Record<string, unknown> = {};

  if (organisationId) {
    filter.organisation_id = new mongoose.Types.ObjectId(organisationId);
  }

  if (query.event_type) {
    filter.event_type = query.event_type;
  }

  if (query.severity) {
    filter.severity = query.severity;
  }

  if (query.status) {
    filter.status = query.status;
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

async function listSecurityEvents(req: Request, res: Response, next: NextFunction, organisationId?: string) {
  try {
    const parsed = securityEventQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid security event query.', parsed.error.flatten());
    }

    if (organisationId) {
      assertValidObjectId(organisationId, 'organisation id');
    }

    const filter = buildFilter(parsed.data, organisationId);
    const skip = (parsed.data.page - 1) * parsed.data.limit;

    const [items, total] = await Promise.all([
      SecurityEventModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsed.data.limit).lean(),
      SecurityEventModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items.map(formatSecurityEvent),
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

async function getSecurityEvent(req: Request, res: Response, next: NextFunction, organisationId?: string) {
  try {
    const securityEventId = String(req.params.securityEventId);
    assertValidObjectId(securityEventId, 'security event id');

    if (organisationId) {
      assertValidObjectId(organisationId, 'organisation id');
    }

    const filter: Record<string, unknown> = { _id: securityEventId };
    if (organisationId) {
      filter.organisation_id = new mongoose.Types.ObjectId(organisationId);
    }

    const record = await SecurityEventModel.findOne(filter).lean();
    if (!record) {
      throw new HttpError(404, 'Security event not found.');
    }

    res.json({ success: true, data: formatSecurityEvent(record) });
  } catch (error) {
    next(error);
  }
}

organisationSecurityEventRouter.get('/', requireAuth, requirePermission('security.events.view'), async (req, res, next) => {
  const auth = assertAuth(req);
  await listSecurityEvents(req, res, next, auth.organisation_id);
});

organisationSecurityEventRouter.get('/:securityEventId', requireAuth, requirePermission('security.events.view'), async (req, res, next) => {
  const auth = assertAuth(req);
  await getSecurityEvent(req, res, next, auth.organisation_id);
});

platformSecurityEventRouter.get('/', requireAuth, requirePermission('security.events.platform.view'), async (req, res, next) => {
  await listSecurityEvents(req, res, next);
});

platformSecurityEventRouter.get('/:securityEventId', requireAuth, requirePermission('security.events.platform.view'), async (req, res, next) => {
  await getSecurityEvent(req, res, next);
});

platformOrganisationSecurityEventRouter.get(
  '/',
  requireAuth,
  requirePermission('security.events.platform.view'),
  async (req, res, next) => {
    await listSecurityEvents(req, res, next, String(req.params.organisationId));
  }
);
