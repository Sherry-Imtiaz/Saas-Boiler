import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type FileAssetStatus = 'active' | 'archived' | 'deleted';
export type FileAssetVisibility = 'organisation' | 'private';

export interface FileAssetDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  uploaded_by_user_id: Types.ObjectId;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_extension: string;
  file_type: string;
  size_bytes: number;
  checksum_sha256: string;
  storage_provider: 'local' | 'azure_blob';
  storage_key: string;
  storage_path: string;
  visibility: FileAssetVisibility;
  status: FileAssetStatus;
  description?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  archived_at?: Date | null;
  archived_by_user_id?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FileAssetHydratedDocument = HydratedDocument<FileAssetDocument>;

const fileAssetSchema = new Schema<FileAssetDocument>(
  {
    organisation_id: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    uploaded_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    file_name: { type: String, required: true, trim: true, maxlength: 255 },
    original_file_name: { type: String, required: true, trim: true, maxlength: 255 },
    mime_type: { type: String, required: true, trim: true, maxlength: 150 },
    file_extension: { type: String, required: true, lowercase: true, trim: true, maxlength: 20 },
    file_type: { type: String, required: true, lowercase: true, trim: true, maxlength: 50 },
    size_bytes: { type: Number, required: true, min: 0 },
    checksum_sha256: { type: String, required: true, lowercase: true, trim: true, maxlength: 64 },
    storage_provider: { type: String, enum: ['local', 'azure_blob'], default: 'local', required: true },
    storage_key: { type: String, required: true, trim: true, maxlength: 1000 },
    storage_path: { type: String, required: true, trim: true, maxlength: 2000 },
    visibility: { type: String, enum: ['organisation', 'private'], default: 'organisation', required: true },
    status: { type: String, enum: ['active', 'archived', 'deleted'], default: 'active', required: true },
    description: { type: String, default: null, trim: true, maxlength: 1000 },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    archived_at: { type: Date, default: null },
    archived_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

fileAssetSchema.index({ organisation_id: 1, status: 1, createdAt: -1 });
fileAssetSchema.index({ organisation_id: 1, file_type: 1, createdAt: -1 });
fileAssetSchema.index({ organisation_id: 1, checksum_sha256: 1 });
fileAssetSchema.index({ uploaded_by_user_id: 1, createdAt: -1 });

export const FileAssetModel = model<FileAssetDocument>('FileAsset', fileAssetSchema);
