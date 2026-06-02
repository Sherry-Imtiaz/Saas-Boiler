import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface AuditLogDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  actor_user_id?: Types.ObjectId | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditLogHydratedDocument = HydratedDocument<AuditLogDocument>;

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    actor_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, lowercase: true, trim: true },
    resource_type: { type: String, required: true, lowercase: true, trim: true },
    resource_id: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null }
  },
  { timestamps: true }
);

auditLogSchema.index({ organisation_id: 1, createdAt: -1 });
auditLogSchema.index({ actor_user_id: 1, createdAt: -1 });
auditLogSchema.index({ organisation_id: 1, action: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLogDocument>('AuditLog', auditLogSchema);
