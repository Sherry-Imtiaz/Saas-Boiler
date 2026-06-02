import type { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLogModel, SecurityEventModel } from '../models/index.js';
import type { SecurityEventSeverity, SecurityEventStatus } from '../models/securityEvent.model.js';

type ObjectIdInput = string | mongoose.Types.ObjectId | null | undefined;

function toObjectId(value: ObjectIdInput): mongoose.Types.ObjectId | null {
  if (!value) {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.isValidObjectId(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

export function getRequestAuditContext(req: Request) {
  return {
    ip_address: req.ip ?? null,
    user_agent: req.get('user-agent') ?? null
  };
}

export async function createAuditLog(params: {
  organisationId: ObjectIdInput;
  actorUserId?: ObjectIdInput;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  request?: Request;
}) {
  const organisationId = toObjectId(params.organisationId);
  if (!organisationId) {
    return null;
  }

  const requestContext = params.request ? getRequestAuditContext(params.request) : {};

  return AuditLogModel.create({
    organisation_id: organisationId,
    actor_user_id: toObjectId(params.actorUserId),
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    details: params.details ?? {},
    ...requestContext
  });
}

export async function createSecurityEvent(params: {
  organisationId: ObjectIdInput;
  actorUserId?: ObjectIdInput;
  eventType: string;
  severity?: SecurityEventSeverity;
  status?: SecurityEventStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  request?: Request;
}) {
  const organisationId = toObjectId(params.organisationId);
  if (!organisationId) {
    return null;
  }

  const requestContext = params.request ? getRequestAuditContext(params.request) : {};

  return SecurityEventModel.create({
    organisation_id: organisationId,
    actor_user_id: toObjectId(params.actorUserId),
    event_type: params.eventType,
    severity: params.severity ?? 'low',
    status: params.status ?? 'info',
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    details: params.details ?? {},
    ...requestContext
  });
}
