import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type PlanStatus = 'active' | 'inactive' | 'archived';
export type PlanBillingMode = 'manual' | 'stripe_ready' | 'custom';

export interface PlanLimits {
  max_users?: number | null;
  max_storage_gb?: number | null;
  max_file_size_mb?: number | null;
  max_personal_access_tokens?: number | null;
  max_organisation_api_tokens?: number | null;
  max_compute_jobs_per_month?: number | null;
  max_concurrent_compute_jobs?: number | null;
  max_cpu?: number | null;
  max_memory_mb?: number | null;
}

export interface PlanPricing {
  currency?: string | null;
  monthly_amount_cents?: number | null;
  yearly_amount_cents?: number | null;
  billing_note?: string | null;
}

export interface PlanDocument {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description?: string | null;
  status: PlanStatus;
  billing_mode: PlanBillingMode;
  pricing: PlanPricing;
  features: Record<string, boolean>;
  limits: PlanLimits;
  is_custom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PlanHydratedDocument = HydratedDocument<PlanDocument>;

const nullableNonNegativeNumber = { type: Number, default: null, min: 0 };

const planSchema = new Schema<PlanDocument>(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      required: true
    },
    billing_mode: {
      type: String,
      enum: ['manual', 'stripe_ready', 'custom'],
      default: 'manual',
      required: true
    },
    pricing: {
      currency: { type: String, default: 'AUD', uppercase: true, trim: true },
      monthly_amount_cents: nullableNonNegativeNumber,
      yearly_amount_cents: nullableNonNegativeNumber,
      billing_note: { type: String, default: 'Manual billing placeholder. No payment gateway is active in v0.9.1.', trim: true }
    },
    features: {
      type: Map,
      of: Boolean,
      default: () => ({})
    },
    limits: {
      max_users: nullableNonNegativeNumber,
      max_storage_gb: nullableNonNegativeNumber,
      max_file_size_mb: nullableNonNegativeNumber,
      max_personal_access_tokens: nullableNonNegativeNumber,
      max_organisation_api_tokens: nullableNonNegativeNumber,
      max_compute_jobs_per_month: nullableNonNegativeNumber,
      max_concurrent_compute_jobs: nullableNonNegativeNumber,
      max_cpu: nullableNonNegativeNumber,
      max_memory_mb: nullableNonNegativeNumber
    },
    is_custom: { type: Boolean, default: false }
  },
  { timestamps: true }
);

planSchema.index({ key: 1 }, { unique: true });
planSchema.index({ status: 1, billing_mode: 1 });

export const PlanModel = model<PlanDocument>('Plan', planSchema);
