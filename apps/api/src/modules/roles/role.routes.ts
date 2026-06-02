import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, PermissionModel, RoleModel, UserModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';

export const roleRouter = Router();

const permissionKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.:-]+$/, 'Permission key contains invalid characters.');

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  permission_keys: z.array(permissionKeySchema).default([])
});

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    permission_keys: z.array(permissionKeySchema).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one update field is required.');

function assertAuthOrganisationId(req: { auth?: { organisation_id: string } }) {
  const organisationId = req.auth?.organisation_id;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  return new mongoose.Types.ObjectId(organisationId);
}

function assertValidRoleId(roleId: string | undefined) {
  if (!roleId || !mongoose.isValidObjectId(roleId)) {
    throw new HttpError(400, 'Invalid role id.');
  }
}

async function validatePermissionKeys(permissionKeys: string[]) {
  const uniquePermissionKeys = [...new Set(permissionKeys.map((key) => key.trim().toLowerCase()))].sort();

  if (uniquePermissionKeys.length === 0) {
    return uniquePermissionKeys;
  }

  const activePermissionCount = await PermissionModel.countDocuments({
    key: { $in: uniquePermissionKeys },
    is_active: true
  });

  if (activePermissionCount !== uniquePermissionKeys.length) {
    throw new HttpError(400, 'One or more permission_keys are invalid or inactive.');
  }

  return uniquePermissionKeys;
}

function formatRole(role: { toObject?: (options?: Record<string, unknown>) => Record<string, unknown> }) {
  const object = typeof role.toObject === 'function' ? role.toObject({ versionKey: false }) : (role as Record<string, unknown>);

  return {
    ...object,
    id: String(object._id),
    _id: String(object._id),
    organisation_id: String(object.organisation_id),
    permission_keys: Array.isArray(object.permission_keys) ? object.permission_keys : []
  };
}

async function writeAuditLog(params: {
  organisationId: mongoose.Types.ObjectId;
  actorUserId: string;
  action: string;
  resourceId: string;
  details: Record<string, unknown>;
}) {
  await AuditLogModel.create({
    organisation_id: params.organisationId,
    actor_user_id: new mongoose.Types.ObjectId(params.actorUserId),
    action: params.action,
    resource_type: 'role',
    resource_id: params.resourceId,
    details: params.details
  });
}

roleRouter.get('/', requireAuth, requirePermission('roles.view'), async (req, res, next) => {
  try {
    const organisationId = assertAuthOrganisationId(req);
    const roles = await RoleModel.find({ organisation_id: organisationId }).sort({ is_system_role: -1, name: 1 });

    res.json({
      success: true,
      data: roles.map((role) => formatRole(role))
    });
  } catch (error) {
    next(error);
  }
});

roleRouter.post('/', requireAuth, requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const organisationId = assertAuthOrganisationId(req);
    const parsed = createRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid role create request.', parsed.error.flatten());
    }

    const permissionKeys = await validatePermissionKeys(parsed.data.permission_keys);
    const existingRole = await RoleModel.findOne({ organisation_id: organisationId, name: parsed.data.name });

    if (existingRole) {
      throw new HttpError(409, `Role already exists in this organisation: ${parsed.data.name}`);
    }

    const role = await RoleModel.create({
      organisation_id: organisationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_system_role: false,
      permission_keys: permissionKeys
    });

    await writeAuditLog({
      organisationId,
      actorUserId: req.auth!.sub,
      action: 'role.create',
      resourceId: role._id.toString(),
      details: {
        name: role.name,
        permission_keys: permissionKeys
      }
    });

    res.status(201).json({
      success: true,
      message: 'Role created successfully.',
      data: formatRole(role)
    });
  } catch (error) {
    next(error);
  }
});

roleRouter.get('/:roleId', requireAuth, requirePermission('roles.view'), async (req, res, next) => {
  try {
    const organisationId = assertAuthOrganisationId(req);
    const roleId = String(req.params.roleId);
    assertValidRoleId(roleId);

    const role = await RoleModel.findOne({ _id: roleId, organisation_id: organisationId });
    if (!role) {
      throw new HttpError(404, 'Role not found in this organisation.');
    }

    res.json({
      success: true,
      data: formatRole(role)
    });
  } catch (error) {
    next(error);
  }
});

roleRouter.patch('/:roleId', requireAuth, requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const organisationId = assertAuthOrganisationId(req);
    const roleId = String(req.params.roleId);
    assertValidRoleId(roleId);

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid role update request.', parsed.error.flatten());
    }

    const role = await RoleModel.findOne({ _id: roleId, organisation_id: organisationId });
    if (!role) {
      throw new HttpError(404, 'Role not found in this organisation.');
    }

    const before = {
      name: role.name,
      description: role.description,
      permission_keys: [...role.permission_keys]
    };

    if (parsed.data.name !== undefined) {
      const existingRole = await RoleModel.findOne({ organisation_id: organisationId, name: parsed.data.name, _id: { $ne: role._id } });
      if (existingRole) {
        throw new HttpError(409, `Role already exists in this organisation: ${parsed.data.name}`);
      }
      role.name = parsed.data.name;
    }

    if (parsed.data.description !== undefined) {
      role.description = parsed.data.description ?? null;
    }

    if (parsed.data.permission_keys !== undefined) {
      role.permission_keys = await validatePermissionKeys(parsed.data.permission_keys);
    }

    await role.save();

    await writeAuditLog({
      organisationId,
      actorUserId: req.auth!.sub,
      action: 'role.update',
      resourceId: role._id.toString(),
      details: {
        before,
        after: {
          name: role.name,
          description: role.description,
          permission_keys: role.permission_keys
        }
      }
    });

    res.json({
      success: true,
      message: 'Role updated successfully.',
      data: formatRole(role)
    });
  } catch (error) {
    next(error);
  }
});

roleRouter.delete('/:roleId', requireAuth, requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const organisationId = assertAuthOrganisationId(req);
    const roleId = String(req.params.roleId);
    assertValidRoleId(roleId);

    const role = await RoleModel.findOne({ _id: roleId, organisation_id: organisationId });
    if (!role) {
      throw new HttpError(404, 'Role not found in this organisation.');
    }

    if (role.is_system_role) {
      throw new HttpError(400, 'System roles cannot be deleted. Update permissions instead if required.');
    }

    const assignedUserCount = await UserModel.countDocuments({ organisation_id: organisationId, role_ids: role._id });
    if (assignedUserCount > 0) {
      throw new HttpError(409, 'Role is assigned to one or more users and cannot be deleted.');
    }

    await role.deleteOne();

    await writeAuditLog({
      organisationId,
      actorUserId: req.auth!.sub,
      action: 'role.delete',
      resourceId: role._id.toString(),
      details: {
        name: role.name,
        permission_keys: role.permission_keys
      }
    });

    res.json({
      success: true,
      message: 'Role deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
});
