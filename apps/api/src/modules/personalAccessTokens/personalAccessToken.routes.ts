import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth, requirePermission, requireTokenType } from '../../middleware/auth.js';
import { AuditLogModel, TokenRecordModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { signJwt } from '../../utils/jwt.js';
import { formatTokenPreview, hashBearerToken } from '../../utils/tokenHash.js';
import { createSecurityEvent } from '../../utils/audit.js';

export const personalAccessTokenRouter = Router();

const tokenScopeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.:\-/*]+$/, 'Token scope contains invalid characters.');

const createPersonalAccessTokenSchema = z.object({
  token_name: z.string().trim().min(2).max(160),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(90),
  scopes: z.array(tokenScopeSchema).min(1).max(250).optional()
});

function assertAuth(req: Express.Request) {
  if (!req.auth) {
    throw new HttpError(401, 'Authentication required.');
  }

  return req.auth;
}

function assertValidTokenId(tokenId: string | undefined) {
  if (!tokenId || !mongoose.isValidObjectId(tokenId)) {
    throw new HttpError(400, 'Invalid personal access token id.');
  }
}

function normaliseScopes(scopes: string[]) {
  return [...new Set(scopes.map((scope) => scope.trim().toLowerCase()))].sort();
}

function validateRequestedScopes(requestedScopes: string[] | undefined, allowedPermissionKeys: string[]) {
  const allowed = new Set(allowedPermissionKeys.map((permission) => permission.trim().toLowerCase()));
  const scopes = normaliseScopes(requestedScopes?.length ? requestedScopes : allowedPermissionKeys);

  if (scopes.length === 0) {
    throw new HttpError(400, 'At least one token scope is required.');
  }

  const invalidScopes = scopes.filter((scope) => !allowed.has(scope));
  if (invalidScopes.length > 0) {
    throw new HttpError(400, 'Personal access token scopes cannot exceed the current user permissions.', {
      invalid_scopes: invalidScopes
    });
  }

  return scopes;
}

function formatPersonalAccessToken(record: {
  _id: unknown;
  organisation_id: unknown;
  user_id?: unknown;
  token_name: string;
  token_prefix?: string | null;
  audience: string;
  scopes: string[];
  status: string;
  expires_at?: Date | null;
  last_used_at?: Date | null;
  revoked_at?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(record._id),
    organisation_id: String(record.organisation_id),
    user_id: record.user_id ? String(record.user_id) : null,
    token_type: 'personal_access_token',
    token_name: record.token_name,
    token_preview: record.token_prefix ?? null,
    audience: record.audience,
    scopes: record.scopes,
    status: record.status,
    expires_at: record.expires_at ?? null,
    last_used_at: record.last_used_at ?? null,
    revoked_at: record.revoked_at ?? null,
    created_at: record.createdAt ?? null,
    updated_at: record.updatedAt ?? null
  };
}

async function auditTokenEvent(params: {
  organisationId: string;
  actorUserId: string;
  action: string;
  resourceId: string;
  details: Record<string, unknown>;
  request?: Request;
}) {
  await AuditLogModel.create({
    organisation_id: new mongoose.Types.ObjectId(params.organisationId),
    actor_user_id: new mongoose.Types.ObjectId(params.actorUserId),
    action: params.action,
    resource_type: 'personal_access_token',
    resource_id: params.resourceId,
    details: params.details,
    ip_address: params.request?.ip ?? null,
    user_agent: params.request?.get('user-agent') ?? null
  });

  await createSecurityEvent({
    organisationId: params.organisationId,
    actorUserId: params.actorUserId,
    eventType: params.action,
    severity: params.action.endsWith('.revoke') ? 'medium' : 'low',
    status: 'success',
    resourceType: 'personal_access_token',
    resourceId: params.resourceId,
    details: params.details,
    request: params.request
  });
}

personalAccessTokenRouter.post(
  '/',
  requireAuth,
  requireTokenType(['user_session_token']),
  requirePermission('tokens.personal.manage'),
  async (req, res, next) => {
    try {
      const auth = assertAuth(req);
      const parsed = createPersonalAccessTokenSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new HttpError(400, 'Invalid personal access token create request.', parsed.error.flatten());
      }

      const scopes = validateRequestedScopes(parsed.data.scopes, auth.permission_keys);
      const tokenRecordId = new mongoose.Types.ObjectId();
      const expiresInSeconds = parsed.data.expires_in_days * 24 * 60 * 60;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      const accessToken = signJwt(
        {
          sub: auth.sub,
          organisation_id: auth.organisation_id,
          email: auth.email,
          role_ids: auth.role_ids,
          token_type: 'personal_access_token',
          audience: 'internal',
          scopes,
          token_id: tokenRecordId.toString()
        },
        env.JWT_SECRET,
        expiresInSeconds
      );

      const tokenHash = hashBearerToken(accessToken);
      const tokenPreview = formatTokenPreview(accessToken);

      const record = await TokenRecordModel.create({
        _id: tokenRecordId,
        organisation_id: new mongoose.Types.ObjectId(auth.organisation_id),
        user_id: new mongoose.Types.ObjectId(auth.sub),
        created_by_user_id: new mongoose.Types.ObjectId(auth.sub),
        token_type: 'personal_access_token',
        token_name: parsed.data.token_name,
        token_hash: tokenHash,
        token_prefix: tokenPreview,
        audience: 'internal',
        scopes,
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          created_from: 'api',
          created_in_version: 'v0.11.0',
          note: 'Raw personal access token was returned once at creation time only.'
        }
      });

      await auditTokenEvent({
        organisationId: auth.organisation_id,
        actorUserId: auth.sub,
        action: 'token.personal.create',
        resourceId: record._id.toString(),
        details: {
          token_name: record.token_name,
          scopes,
          expires_at: expiresAt,
          token_preview: tokenPreview
        },
        request: req
      });

      res.status(201).json({
        success: true,
        message: 'Personal access token created. Copy the access_token now; it will not be shown again.',
        data: {
          token_type: 'Bearer',
          access_token: accessToken,
          token: formatPersonalAccessToken(record)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

personalAccessTokenRouter.get('/', requireAuth, requirePermission('tokens.personal.manage'), async (req, res, next) => {
  try {
    const auth = assertAuth(req);
    const records = await TokenRecordModel.find({
      organisation_id: auth.organisation_id,
      user_id: auth.sub,
      token_type: 'personal_access_token'
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: records.map((record) => formatPersonalAccessToken(record))
    });
  } catch (error) {
    next(error);
  }
});

personalAccessTokenRouter.delete('/:tokenId', requireAuth, requirePermission('tokens.personal.manage'), async (req, res, next) => {
  try {
    const auth = assertAuth(req);
    const tokenId = String(req.params.tokenId);
    assertValidTokenId(tokenId);

    const record = await TokenRecordModel.findOne({
      _id: tokenId,
      organisation_id: auth.organisation_id,
      user_id: auth.sub,
      token_type: 'personal_access_token'
    });

    if (!record) {
      throw new HttpError(404, 'Personal access token not found.');
    }

    if (record.status !== 'revoked') {
      record.status = 'revoked';
      record.revoked_at = new Date();
      record.revoked_by_user_id = new mongoose.Types.ObjectId(auth.sub);
      await record.save();

      await auditTokenEvent({
        organisationId: auth.organisation_id,
        actorUserId: auth.sub,
        action: 'token.personal.revoke',
        resourceId: record._id.toString(),
        details: {
          token_name: record.token_name,
          token_preview: record.token_prefix ?? null
        },
        request: req
      });
    }

    res.json({
      success: true,
      message: 'Personal access token revoked successfully.',
      data: formatPersonalAccessToken(record)
    });
  } catch (error) {
    next(error);
  }
});
