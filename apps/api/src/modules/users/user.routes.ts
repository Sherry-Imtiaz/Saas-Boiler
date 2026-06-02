import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireOrganisationParamAccess, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, OrganisationModel, RoleModel, UserModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import { hashPassword } from '../../utils/password.js';

export const userRouter = Router({ mergeParams: true });

const userStatusSchema = z.enum(['invited', 'active', 'disabled']);
const userAuthTypeSchema = z.enum(['native', 'oidc', 'saml']);

const objectIdSchema = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid ObjectId value.');

const userProfileSchema = z
  .object({
    avatar_url: z.string().trim().url().nullable().optional(),
    phone: z.string().trim().max(80).nullable().optional(),
    timezone: z.string().trim().max(120).nullable().optional()
  })
  .partial();

const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  first_name: z.string().trim().max(100).nullable().optional(),
  last_name: z.string().trim().max(100).nullable().optional(),
  display_name: z.string().trim().min(1).max(200).optional(),
  status: userStatusSchema.optional().default('invited'),
  auth_type: userAuthTypeSchema.optional().default('native'),
  password: z.string().min(8).max(200).optional(),
  role_ids: z.array(objectIdSchema).optional(),
  profile: userProfileSchema.optional()
});

const updateUserSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    first_name: z.string().trim().max(100).nullable().optional(),
    last_name: z.string().trim().max(100).nullable().optional(),
    display_name: z.string().trim().min(1).max(200).optional(),
    auth_type: userAuthTypeSchema.optional(),
    password: z.string().min(8).max(200).optional(),
    role_ids: z.array(objectIdSchema).optional(),
    profile: userProfileSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one update field is required.');

const updateUserStatusSchema = z.object({
  status: userStatusSchema
});

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildDisplayName(data: { display_name?: string; first_name?: string | null; last_name?: string | null; email: string }) {
  if (data.display_name?.trim()) {
    return data.display_name.trim();
  }

  const fullName = [data.first_name, data.last_name]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .trim();

  return fullName || normaliseEmail(data.email);
}

function assertValidObjectId(id: string, label: string): void {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
}

function getOrganisationId(req: { params: Record<string, unknown> }): string {
  const organisationId = String(req.params.organisationId ?? '');
  if (!organisationId || organisationId === 'undefined') {
    throw new HttpError(400, 'Missing organisation id.');
  }
  return organisationId;
}

async function getOrganisationOrThrow(organisationId: string) {
  assertValidObjectId(organisationId, 'organisation id');

  const organisation = await OrganisationModel.findById(organisationId);

  if (!organisation) {
    throw new HttpError(404, 'Organisation not found.');
  }

  return organisation;
}

async function assertRolesBelongToOrganisation(roleIds: string[] | undefined, organisationId: mongoose.Types.ObjectId) {
  if (!roleIds || roleIds.length === 0) {
    return [] as mongoose.Types.ObjectId[];
  }

  const uniqueRoleIds = [...new Set(roleIds)];
  const objectIds = uniqueRoleIds.map((roleId) => new mongoose.Types.ObjectId(roleId));
  const roleCount = await RoleModel.countDocuments({ _id: { $in: objectIds }, organisation_id: organisationId });

  if (roleCount !== objectIds.length) {
    throw new HttpError(400, 'One or more role_ids do not belong to this organisation.');
  }

  return objectIds;
}

async function resolveRoleIdsForCreate(roleIds: string[] | undefined, organisation: { _id: mongoose.Types.ObjectId; auth_config?: { default_role_id?: mongoose.Types.ObjectId | null } }) {
  if (roleIds !== undefined) {
    return assertRolesBelongToOrganisation(roleIds, organisation._id);
  }

  if (!organisation.auth_config?.default_role_id) {
    return [] as mongoose.Types.ObjectId[];
  }

  const defaultRole = await RoleModel.findOne({ _id: organisation.auth_config.default_role_id, organisation_id: organisation._id });
  return defaultRole ? [defaultRole._id] : [];
}

function formatUser(user: { toObject: (options?: Record<string, unknown>) => Record<string, unknown> } | null) {
  if (!user) {
    return null;
  }

  const object = user.toObject({ versionKey: false });

  return {
    ...object,
    id: String(object._id),
    _id: String(object._id),
    organisation_id: String(object.organisation_id),
    role_ids: Array.isArray(object.role_ids) ? object.role_ids.map((roleId) => String(roleId)) : [],
    auth: {
      ...(typeof object.auth === 'object' && object.auth !== null ? object.auth : {}),
      password_hash: undefined
    }
  };
}

async function writeAuditLog(params: {
  organisationId: mongoose.Types.ObjectId;
  actorUserId?: mongoose.Types.ObjectId | null;
  action: string;
  resourceId: string;
  details: Record<string, unknown>;
}) {
  await AuditLogModel.create({
    organisation_id: params.organisationId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    resource_type: 'user',
    resource_id: params.resourceId,
    details: params.details
  });
}

userRouter.post('/', requireAuth, requireOrganisationParamAccess(), requirePermission('users.create'), async (req, res, next) => {
  try {
    const organisation = await getOrganisationOrThrow(getOrganisationId(req));
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid user create request.', parsed.error.flatten());
    }

    const emailNormalised = normaliseEmail(parsed.data.email);
    const existingUser = await UserModel.findOne({ email_normalised: emailNormalised });

    if (existingUser) {
      throw new HttpError(409, `User email already exists: ${emailNormalised}`);
    }

    const roleObjectIds = await resolveRoleIdsForCreate(parsed.data.role_ids, organisation);

    const user = await UserModel.create({
      organisation_id: organisation._id,
      email: emailNormalised,
      email_normalised: emailNormalised,
      first_name: parsed.data.first_name ?? null,
      last_name: parsed.data.last_name ?? null,
      display_name: buildDisplayName({ ...parsed.data, email: emailNormalised }),
      status: parsed.data.status,
      auth: {
        auth_type: parsed.data.auth_type,
        password_hash: parsed.data.password ? hashPassword(parsed.data.password) : null,
        mfa_enabled: false,
        last_login_at: null
      },
      role_ids: roleObjectIds,
      profile: parsed.data.profile ?? {}
    });

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'user.create',
      resourceId: user._id.toString(),
      details: {
        email: user.email_normalised,
        status: user.status,
        role_ids: roleObjectIds.map((roleId) => roleId.toString()),
        note: 'Created through internal platform organisation-owned user API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully under organisation.',
      data: formatUser(user)
    });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/', requireAuth, requireOrganisationParamAccess(), requirePermission('users.view'), async (req, res, next) => {
  try {
    const organisation = await getOrganisationOrThrow(getOrganisationId(req));

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: userStatusSchema.optional(),
      search: z.string().trim().max(120).optional(),
      role_id: objectIdSchema.optional()
    });

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid user list query.', parsed.error.flatten());
    }

    const filter: Record<string, unknown> = { organisation_id: organisation._id };

    if (parsed.data.status) {
      filter.status = parsed.data.status;
    }

    if (parsed.data.role_id) {
      filter.role_ids = new mongoose.Types.ObjectId(parsed.data.role_id);
    }

    if (parsed.data.search) {
      const searchRegex = new RegExp(parsed.data.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ display_name: searchRegex }, { email_normalised: searchRegex }, { first_name: searchRegex }, { last_name: searchRegex }];
    }

    const skip = (parsed.data.page - 1) * parsed.data.limit;
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsed.data.limit),
      UserModel.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items.map((user) => formatUser(user)),
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

userRouter.get('/:userId', requireAuth, requireOrganisationParamAccess(), requirePermission('users.view'), async (req, res, next) => {
  try {
    const organisation = await getOrganisationOrThrow(getOrganisationId(req));
    const userId = String(req.params.userId);
    assertValidObjectId(userId, 'user id');

    const user = await UserModel.findOne({ _id: userId, organisation_id: organisation._id });

    if (!user) {
      throw new HttpError(404, 'User not found in this organisation.');
    }

    res.json({
      success: true,
      data: formatUser(user)
    });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/:userId', requireAuth, requireOrganisationParamAccess(), requirePermission('users.update'), async (req, res, next) => {
  try {
    const organisation = await getOrganisationOrThrow(getOrganisationId(req));
    const userId = String(req.params.userId);
    assertValidObjectId(userId, 'user id');

    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid user update request.', parsed.error.flatten());
    }

    const user = await UserModel.findOne({ _id: userId, organisation_id: organisation._id });

    if (!user) {
      throw new HttpError(404, 'User not found in this organisation.');
    }

    const before = {
      email: user.email_normalised,
      display_name: user.display_name,
      status: user.status,
      role_ids: user.role_ids.map((roleId) => roleId.toString())
    };

    if (parsed.data.email !== undefined) {
      const emailNormalised = normaliseEmail(parsed.data.email);
      const existingUser = await UserModel.findOne({ email_normalised: emailNormalised, _id: { $ne: user._id } });

      if (existingUser) {
        throw new HttpError(409, `User email already exists: ${emailNormalised}`);
      }

      user.email = emailNormalised;
      user.email_normalised = emailNormalised;
    }

    if (parsed.data.first_name !== undefined) user.first_name = parsed.data.first_name;
    if (parsed.data.last_name !== undefined) user.last_name = parsed.data.last_name;
    if (parsed.data.display_name !== undefined) user.display_name = parsed.data.display_name;
    if (parsed.data.auth_type !== undefined) user.auth.auth_type = parsed.data.auth_type;
    if (parsed.data.password !== undefined) user.auth.password_hash = hashPassword(parsed.data.password);
    if (parsed.data.role_ids !== undefined) user.role_ids = await assertRolesBelongToOrganisation(parsed.data.role_ids, organisation._id);
    if (parsed.data.profile !== undefined) user.set('profile', { ...user.profile, ...parsed.data.profile });

    if (parsed.data.display_name === undefined && (parsed.data.first_name !== undefined || parsed.data.last_name !== undefined)) {
      user.display_name = buildDisplayName({
        email: user.email_normalised,
        first_name: user.first_name,
        last_name: user.last_name
      });
    }

    await user.save();

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'user.update',
      resourceId: user._id.toString(),
      details: {
        before,
        updated_fields: Object.keys(parsed.data),
        note: 'Updated through internal platform organisation-owned user API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: formatUser(user)
    });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/:userId/status', requireAuth, requireOrganisationParamAccess(), requirePermission('users.disable'), async (req, res, next) => {
  try {
    const organisation = await getOrganisationOrThrow(getOrganisationId(req));
    const userId = String(req.params.userId);
    assertValidObjectId(userId, 'user id');

    const parsed = updateUserStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid user status update request.', parsed.error.flatten());
    }

    const user = await UserModel.findOne({ _id: userId, organisation_id: organisation._id });

    if (!user) {
      throw new HttpError(404, 'User not found in this organisation.');
    }

    const previousStatus = user.status;
    user.status = parsed.data.status;
    await user.save();

    await writeAuditLog({
      organisationId: organisation._id,
      action: 'user.status_update',
      resourceId: user._id.toString(),
      details: {
        previous_status: previousStatus,
        new_status: user.status,
        note: 'Status updated through internal platform organisation-owned user API. RBAC and token guards are enforced from v0.6.1; personal access tokens are active from v0.6.2; organisation API tokens are active from v0.6.3.'
      }
    });

    res.json({
      success: true,
      message: 'User status updated successfully.',
      data: formatUser(user)
    });
  } catch (error) {
    next(error);
  }
});
