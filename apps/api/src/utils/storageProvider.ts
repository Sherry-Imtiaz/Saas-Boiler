import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const API_ROOT = path.resolve(__dirname, '..', '..');
export const DEFAULT_LOCAL_STORAGE_ROOT = path.resolve(API_ROOT, 'storage');

export type StorageProviderName = 'local' | 'azure_blob';

export interface UploadFileInput {
  storageKey: string;
  content: Buffer;
  mimeType: string;
}

export interface StoredFileResult {
  storage_provider: StorageProviderName;
  storage_key: string;
  storage_path: string;
  container_name?: string | null;
}

export interface DownloadFileResult {
  content: Buffer;
  storage_key: string;
  mime_type?: string | null;
}

export interface StorageProvider {
  providerName: StorageProviderName;
  uploadFile(input: UploadFileInput): Promise<StoredFileResult>;
  downloadFile(storageKey: string, storagePath?: string | null): Promise<DownloadFileResult>;
  deleteFile(storageKey: string, storagePath?: string | null): Promise<void>;
  getFileUrl(storageKey: string): Promise<string | null>;
}

function normaliseStorageKey(storageKey: string) {
  const cleaned = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleaned.includes('..')) throw new HttpError(400, 'storageKey cannot contain parent directory traversal.');
  return cleaned;
}

function getLocalRoot() {
  const configured = env.STORAGE_LOCAL_ROOT || 'apps/api/storage';
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export class LocalStorageProvider implements StorageProvider {
  providerName: StorageProviderName = 'local';

  async uploadFile(input: UploadFileInput): Promise<StoredFileResult> {
    const storageKey = normaliseStorageKey(input.storageKey);
    const localRoot = getLocalRoot();
    const filePath = path.resolve(localRoot, storageKey);
    if (!filePath.startsWith(path.resolve(localRoot))) {
      throw new HttpError(403, 'Resolved storage path is outside the configured local storage root.');
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content);
    return {
      storage_provider: 'local',
      storage_key: storageKey,
      storage_path: filePath,
      container_name: null
    };
  }

  async downloadFile(storageKey: string, storagePath?: string | null): Promise<DownloadFileResult> {
    const localRoot = getLocalRoot();
    const candidate = storagePath || path.resolve(localRoot, normaliseStorageKey(storageKey));
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(path.resolve(localRoot))) {
      throw new HttpError(403, 'Stored file path is outside the configured local storage root.');
    }
    const content = await fs.readFile(resolved);
    return { content, storage_key: normaliseStorageKey(storageKey) };
  }

  async deleteFile(storageKey: string, storagePath?: string | null): Promise<void> {
    const localRoot = getLocalRoot();
    const candidate = storagePath || path.resolve(localRoot, normaliseStorageKey(storageKey));
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(path.resolve(localRoot))) return;
    await fs.rm(resolved, { force: true });
  }

  async getFileUrl(): Promise<string | null> {
    return null;
  }
}

export class AzureBlobStorageProvider implements StorageProvider {
  providerName: StorageProviderName = 'azure_blob';

  private async getContainerClient() {
    if (!env.AZURE_STORAGE_CONNECTION_STRING) {
      throw new HttpError(500, 'AZURE_STORAGE_CONNECTION_STRING is required when STORAGE_PROVIDER=azure_blob.');
    }
    const moduleName = '@azure/storage-blob';
    const azure = await import(moduleName) as any;
    const blobServiceClient = azure.BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(env.AZURE_STORAGE_CONTAINER_NAME);
    await containerClient.createIfNotExists();
    return containerClient;
  }

  async uploadFile(input: UploadFileInput): Promise<StoredFileResult> {
    const storageKey = normaliseStorageKey(input.storageKey);
    const containerClient = await this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);
    await blockBlobClient.uploadData(input.content, {
      blobHTTPHeaders: { blobContentType: input.mimeType }
    });
    return {
      storage_provider: 'azure_blob',
      storage_key: storageKey,
      storage_path: `azure://${env.AZURE_STORAGE_CONTAINER_NAME}/${storageKey}`,
      container_name: env.AZURE_STORAGE_CONTAINER_NAME
    };
  }

  async downloadFile(storageKey: string): Promise<DownloadFileResult> {
    const key = normaliseStorageKey(storageKey);
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlobClient(key);
    const response = await blobClient.download();
    if (!response.readableStreamBody) throw new HttpError(404, 'Azure blob content was not found.');
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return {
      content: Buffer.concat(chunks),
      storage_key: key,
      mime_type: response.contentType ?? null
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const key = normaliseStorageKey(storageKey);
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  }

  async getFileUrl(storageKey: string): Promise<string | null> {
    const key = normaliseStorageKey(storageKey);
    if (!env.AZURE_STORAGE_ACCOUNT_NAME) return null;
    return `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${env.AZURE_STORAGE_CONTAINER_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
}

export function getStorageProvider(providerName: string = env.STORAGE_PROVIDER): StorageProvider {
  if (providerName === 'azure_blob') return new AzureBlobStorageProvider();
  return new LocalStorageProvider();
}

export function buildOrganisationFileStorageKey(options: { organisationId: string; fileId: string; fileName: string }) {
  return `organisations/${options.organisationId}/files/${options.fileId}/${options.fileName}`;
}

export function getStorageProviderConfigSummary() {
  return {
    active_provider: env.STORAGE_PROVIDER,
    local_root: getLocalRoot(),
    azure_blob: {
      container_name: env.AZURE_STORAGE_CONTAINER_NAME,
      account_name_configured: Boolean(env.AZURE_STORAGE_ACCOUNT_NAME),
      connection_string_configured: Boolean(env.AZURE_STORAGE_CONNECTION_STRING),
      azurite_mode: env.AZURE_STORAGE_USE_AZURITE
    }
  };
}
