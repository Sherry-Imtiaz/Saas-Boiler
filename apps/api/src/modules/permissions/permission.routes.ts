import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { PermissionModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';

export const permissionRouter = Router();

const querySchema = z.object({
  module: z.string().trim().max(120).optional(),
  is_active: z.coerce.boolean().optional()
});

permissionRouter.get('/', requireAuth, requirePermission('permissions.view'), async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid permission list query.', parsed.error.flatten());
    }

    const filter: Record<string, unknown> = {};
    if (parsed.data.module) {
      filter.module = parsed.data.module.toLowerCase();
    }
    if (parsed.data.is_active !== undefined) {
      filter.is_active = parsed.data.is_active;
    }

    const permissions = await PermissionModel.find(filter).sort({ module: 1, action: 1, key: 1 }).lean();

    res.json({
      success: true,
      data: permissions.map((permission) => ({
        id: permission._id.toString(),
        key: permission.key,
        module: permission.module,
        action: permission.action,
        description: permission.description ?? null,
        is_active: permission.is_active
      }))
    });
  } catch (error) {
    next(error);
  }
});
