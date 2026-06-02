import mongoose from 'mongoose';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireFeature, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, FileAssetModel, OrganisationModel } from '../../models/index.js';
import { HttpError } from '../../utils/httpError.js';
import {
  bytesToMb,
  decodeBase64File,
  formatFileAsset,
  getEffectiveStorageLimits,
  getFileExtension,
  downloadOrganisationFile,
  deleteOrganisationStoredFile,
  inferFileType,
  sanitiseFileName,
  saveOrganisationFile,
  sha256
} from '../../utils/fileAssets.js';

export const fileRouter = Router();

const uploadFileSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(3).max(150).default('application/octet-stream'),
  content_base64: z.string().min(1),
  visibility: z.enum(['organisation', 'private']).default('organisation'),
  description: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  metadata: z.record(z.unknown()).optional()
});

const querySchema = z.object({
  status: z.enum(['active', 'archived', 'deleted', 'all']).default('active'),
  file_type: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

function assertAuthIds(req: Request) {
  const organisationId = req.auth?.organisation_id;
  const userId = req.auth?.sub;
  if (!organisationId || !mongoose.isValidObjectId(organisationId)) {
    throw new HttpError(401, 'Authenticated organisation context is missing or invalid.');
  }
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, 'Authenticated user context is missing or invalid.');
  }
  return {
    organisationObjectId: new mongoose.Types.ObjectId(organisationId),
    userObjectId: new mongoose.Types.ObjectId(userId),
    organisationId,
    userId
  };
}

async function loadOrganisation(organisationId: string) {
  const organisation = await OrganisationModel.findById(organisationId).lean();
  if (!organisation) throw new HttpError(404, 'Organisation not found.');
  return organisation as any;
}

async function getActiveStorageBytes(organisationObjectId: mongoose.Types.ObjectId) {
  const [row] = await FileAssetModel.aggregate<{ total_bytes: number }>([
    { $match: { organisation_id: organisationObjectId, status: 'active' } },
    { $group: { _id: '$organisation_id', total_bytes: { $sum: '$size_bytes' } } }
  ]);
  return row?.total_bytes ?? 0;
}

async function writeFileAudit(req: Request, action: string, file: { _id: unknown; organisation_id: unknown }, details: Record<string, unknown>) {
  await AuditLogModel.create({
    organisation_id: file.organisation_id,
    actor_user_id: req.auth?.sub ?? null,
    action,
    resource_type: 'file_asset',
    resource_id: String(file._id),
    details,
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null
  });
}

async function loadFileForOrganisation(req: Request, fileId: string) {
  const { organisationObjectId } = assertAuthIds(req);
  if (!mongoose.isValidObjectId(fileId)) {
    throw new HttpError(400, 'fileId must be a valid MongoDB ObjectId.');
  }
  const file = await FileAssetModel.findOne({ _id: fileId, organisation_id: organisationObjectId });
  if (!file) throw new HttpError(404, 'File asset not found for this organisation.');
  return file;
}

fileRouter.post('/', requireAuth, requireFeature('file_uploads'), requirePermission('files.upload'), async (req, res, next) => {
  try {
    const parsed = uploadFileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid file upload request.', parsed.error.flatten());
    }

    const { organisationObjectId, userObjectId, organisationId } = assertAuthIds(req);
    const organisation = await loadOrganisation(organisationId);
    const limits = getEffectiveStorageLimits(organisation);
    const content = decodeBase64File(parsed.data.content_base64);
    if (content.length === 0) throw new HttpError(400, 'Uploaded file content cannot be empty.');

    const fileSizeMb = bytesToMb(content.length);
    if (limits.max_file_size_mb !== null && fileSizeMb > limits.max_file_size_mb) {
      throw new HttpError(403, `File exceeds plan limit. Max file size is ${limits.max_file_size_mb} MB.`);
    }

    const currentStorageBytes = await getActiveStorageBytes(organisationObjectId);
    const projectedStorageGb = (currentStorageBytes + content.length) / (1024 ** 3);
    if (limits.max_storage_gb !== null && projectedStorageGb > limits.max_storage_gb) {
      throw new HttpError(403, `Upload would exceed organisation storage limit of ${limits.max_storage_gb} GB.`);
    }

    const originalFileName = parsed.data.file_name;
    const extension = getFileExtension(originalFileName);
    const safeFileName = sanitiseFileName(originalFileName);
    const fileType = inferFileType(extension, parsed.data.mime_type);
    const fileId = new mongoose.Types.ObjectId();
    const stored = await saveOrganisationFile({ organisationId, fileId: String(fileId), fileName: safeFileName, mimeType: parsed.data.mime_type, content });

    const file = await FileAssetModel.create({
      _id: fileId,
      organisation_id: organisationObjectId,
      uploaded_by_user_id: userObjectId,
      file_name: safeFileName,
      original_file_name: originalFileName,
      mime_type: parsed.data.mime_type,
      file_extension: extension,
      file_type: fileType,
      size_bytes: content.length,
      checksum_sha256: sha256(content),
      storage_provider: stored.storage_provider,
      storage_key: stored.storage_key,
      storage_path: stored.storage_path,
      visibility: parsed.data.visibility,
      status: 'active',
      description: parsed.data.description ?? null,
      tags: parsed.data.tags ?? [],
      metadata: parsed.data.metadata ?? {}
    });

    await writeFileAudit(req, 'file.uploaded', file, {
      file_name: file.file_name,
      original_file_name: file.original_file_name,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      storage_key: file.storage_key,
      plan_limits: limits
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      data: {
        file: formatFileAsset(file),
        limits,
        storage_usage: {
          active_storage_bytes_before_upload: currentStorageBytes,
          active_storage_bytes_after_upload: currentStorageBytes + content.length,
          projected_storage_gb: Number(projectedStorageGb.toFixed(6))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

fileRouter.get('/', requireAuth, requireFeature('file_uploads'), requirePermission('files.view'), async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid file list query.', parsed.error.flatten());

    const { organisationObjectId } = assertAuthIds(req);
    const filter: Record<string, unknown> = { organisation_id: organisationObjectId };
    if (parsed.data.status !== 'all') filter.status = parsed.data.status;
    if (parsed.data.file_type) filter.file_type = parsed.data.file_type.toLowerCase();
    if (parsed.data.search) {
      filter.$or = [
        { file_name: { $regex: parsed.data.search, $options: 'i' } },
        { original_file_name: { $regex: parsed.data.search, $options: 'i' } },
        { tags: { $regex: parsed.data.search, $options: 'i' } }
      ];
    }

    const skip = (parsed.data.page - 1) * parsed.data.limit;
    const [files, total, activeStorageBytes] = await Promise.all([
      FileAssetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parsed.data.limit),
      FileAssetModel.countDocuments(filter),
      getActiveStorageBytes(organisationObjectId)
    ]);

    res.json({
      success: true,
      message: 'Files returned successfully.',
      data: {
        files: files.map(formatFileAsset),
        pagination: { page: parsed.data.page, limit: parsed.data.limit, total },
        storage_usage: {
          active_storage_bytes: activeStorageBytes,
          active_storage_mb: Number(bytesToMb(activeStorageBytes).toFixed(4))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

fileRouter.get('/:fileId', requireAuth, requireFeature('file_uploads'), requirePermission('files.view'), async (req, res, next) => {
  try {
    const file = await loadFileForOrganisation(req, String(req.params.fileId));
    res.json({ success: true, message: 'File asset returned successfully.', data: { file: formatFileAsset(file) } });
  } catch (error) {
    next(error);
  }
});

fileRouter.get('/:fileId/download', requireAuth, requireFeature('file_uploads'), requirePermission('files.view'), async (req, res, next) => {
  try {
    const file = await loadFileForOrganisation(req, String(req.params.fileId));
    if (file.status !== 'active') throw new HttpError(404, `File is not active: ${file.status}`);
    const downloaded = await downloadOrganisationFile(file.storage_provider, file.storage_key, file.storage_path);
    await writeFileAudit(req, 'file.downloaded', file, { file_name: file.file_name, storage_key: file.storage_key, storage_provider: file.storage_provider });
    res.setHeader('Content-Type', downloaded.mime_type || file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_file_name || file.file_name)}"`);
    res.send(downloaded.content);
  } catch (error) {
    next(error);
  }
});

fileRouter.delete('/:fileId', requireAuth, requireFeature('file_uploads'), requirePermission('files.delete'), async (req, res, next) => {
  try {
    const { userObjectId } = assertAuthIds(req);
    const file = await loadFileForOrganisation(req, String(req.params.fileId));
    const before = formatFileAsset(file);
    await deleteOrganisationStoredFile(file.storage_provider, file.storage_key, file.storage_path);
    file.status = 'archived';
    file.archived_at = new Date();
    file.archived_by_user_id = userObjectId;
    await file.save();
    await writeFileAudit(req, 'file.archived', file, { before, after: formatFileAsset(file), stored_object_deleted: true });
    res.json({ success: true, message: 'File archived successfully.', data: { file: formatFileAsset(file) } });
  } catch (error) {
    next(error);
  }
});
