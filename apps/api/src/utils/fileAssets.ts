import crypto from 'node:crypto';
import path from 'node:path';
import type { FileAssetDocument } from '../models/fileAsset.model.js';
import { HttpError } from './httpError.js';
import { buildOrganisationFileStorageKey, getStorageProvider, DEFAULT_LOCAL_STORAGE_ROOT } from './storageProvider.js';
import { buildPlanAssignment } from './plans.js';

export const LOCAL_STORAGE_ROOT = DEFAULT_LOCAL_STORAGE_ROOT;

export const ALLOWED_FILE_EXTENSIONS = new Set([
  'txt', 'csv', 'json', 'yaml', 'yml', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'doc', 'docx', 'xls', 'xlsx'
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt']);
const SPREADSHEET_EXTENSIONS = new Set(['csv', 'xls', 'xlsx']);
const CONFIG_EXTENSIONS = new Set(['json', 'yaml', 'yml']);

export function sanitiseFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return cleaned || `upload-${Date.now()}`;
}

export function getFileExtension(fileName: string) {
  const extension = path.extname(fileName).replace('.', '').toLowerCase();
  if (!extension) throw new HttpError(400, 'Uploaded file must include a file extension.');
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new HttpError(400, `File extension is not allowed: ${extension}`);
  }
  return extension;
}

export function inferFileType(extension: string, mimeType: string) {
  if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith('image/')) return 'image';
  if (SPREADSHEET_EXTENSIONS.has(extension)) return 'spreadsheet';
  if (CONFIG_EXTENSIONS.has(extension)) return 'config';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'other';
}

export function decodeBase64File(contentBase64: string) {
  const match = contentBase64.match(/^data:([^;]+);base64,(.+)$/);
  const base64 = match ? match[2] : contentBase64;
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new HttpError(400, 'content_base64 must be a valid base64 string or data URL.');
  }
}

export function sha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function bytesToMb(bytes: number) {
  return bytes / (1024 * 1024);
}

export function getEffectiveStorageLimits(organisation: { plan?: Record<string, unknown> | null; storage?: Record<string, unknown> | null }) {
  const plan = buildPlanAssignment(organisation);
  const planLimits = plan.limits ?? {};
  const storage = organisation.storage ?? {};
  const maxStorageGb = typeof planLimits.max_storage_gb === 'number'
    ? planLimits.max_storage_gb
    : typeof storage.max_storage_gb === 'number'
      ? storage.max_storage_gb
      : null;
  const maxFileSizeMb = typeof planLimits.max_file_size_mb === 'number' ? planLimits.max_file_size_mb : 25;

  return {
    max_storage_gb: maxStorageGb,
    max_file_size_mb: maxFileSizeMb
  };
}

export async function saveOrganisationFile(options: {
  organisationId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}) {
  const storageKey = buildOrganisationFileStorageKey({
    organisationId: options.organisationId,
    fileId: options.fileId,
    fileName: options.fileName
  });
  return getStorageProvider().uploadFile({ storageKey, content: options.content, mimeType: options.mimeType });
}

export async function downloadOrganisationFile(storageProvider: string, storageKey: string, storagePath?: string | null) {
  return getStorageProvider(storageProvider).downloadFile(storageKey, storagePath);
}

export async function deleteOrganisationStoredFile(storageProvider: string, storageKey: string, storagePath?: string | null) {
  return getStorageProvider(storageProvider).deleteFile(storageKey, storagePath);
}

export function getPublicFileAssetUrl(file: Pick<FileAssetDocument, '_id' | 'metadata'>) {
  return file.metadata?.branding_asset === true ? `/api/public/branding-assets/${String(file._id)}` : null;
}

export function formatFileAsset(file: FileAssetDocument) {
  return {
    id: String(file._id),
    organisation_id: String(file.organisation_id),
    uploaded_by_user_id: String(file.uploaded_by_user_id),
    file_name: file.file_name,
    original_file_name: file.original_file_name,
    mime_type: file.mime_type,
    file_extension: file.file_extension,
    file_type: file.file_type,
    size_bytes: file.size_bytes,
    size_mb: Number(bytesToMb(file.size_bytes).toFixed(4)),
    checksum_sha256: file.checksum_sha256,
    storage_provider: file.storage_provider,
    storage_key: file.storage_key,
    storage_path: file.storage_path,
    public_url: getPublicFileAssetUrl(file),
    visibility: file.visibility,
    status: file.status,
    description: file.description ?? null,
    tags: file.tags ?? [],
    metadata: file.metadata ?? {},
    archived_at: file.archived_at ?? null,
    created_at: file.createdAt,
    updated_at: file.updatedAt
  };
}
