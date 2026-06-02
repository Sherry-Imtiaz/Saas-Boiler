import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityEventStatus = 'success' | 'failure' | 'warning' | 'blocked' | 'info';

export interface SecurityEventDocument {
  _id: Types.ObjectId;
  organisation_id: Types.ObjectId;
  actor_user_id?: Types.ObjectId | null;
  event_type: string;
  severity: SecurityEventSeverity;
  status: SecurityEventStatus;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type SecurityEventHydratedDocument = HydratedDocument<SecurityEventDocument>;

const securityEventSchema = new Schema<SecurityEventDocument>(
  {
    organisation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true
    },
    actor_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    event_type: { type: String, required: true, lowercase: true, trim: true, maxlength: 160, index: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low', required: true, index: true },
    status: { type: String, enum: ['success', 'failure', 'warning', 'blocked', 'info'], default: 'info', required: true, index: true },
    resource_type: { type: String, default: null, lowercase: true, trim: true, maxlength: 160 },
    resource_id: { type: String, default: null, trim: true, maxlength: 240 },
    ip_address: { type: String, default: null, trim: true, maxlength: 120 },
    user_agent: { type: String, default: null, trim: true, maxlength: 500 },
    details: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

securityEventSchema.index({ organisation_id: 1, createdAt: -1 });
securityEventSchema.index({ organisation_id: 1, event_type: 1, createdAt: -1 });
securityEventSchema.index({ organisation_id: 1, severity: 1, createdAt: -1 });
securityEventSchema.index({ organisation_id: 1, status: 1, createdAt: -1 });
securityEventSchema.index({ actor_user_id: 1, createdAt: -1 });

export const SecurityEventModel = model<SecurityEventDocument>('SecurityEvent', securityEventSchema);
