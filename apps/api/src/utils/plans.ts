import type { PlanDocument, PlanLimits } from '../models/plan.model.js';
import { buildFeatureMap, type FeatureKey } from './features.js';

export type PlanSeed = {
  key: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'archived';
  billing_mode: 'manual' | 'stripe_ready' | 'custom';
  pricing: {
    currency: string;
    monthly_amount_cents: number | null;
    yearly_amount_cents: number | null;
    billing_note: string;
  };
  features: Partial<Record<FeatureKey, boolean>>;
  limits: PlanLimits;
  is_custom: boolean;
};

export const DEFAULT_PLAN_LIMITS: Required<PlanLimits> = {
  max_users: 5,
  max_storage_gb: 10,
  max_file_size_mb: 25,
  max_personal_access_tokens: 5,
  max_organisation_api_tokens: 2,
  max_compute_jobs_per_month: 0,
  max_concurrent_compute_jobs: 0,
  max_cpu: 0,
  max_memory_mb: 0
};

const baseFeatures = buildFeatureMap(undefined);

export const PLAN_CATALOGUE_SEED: PlanSeed[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Basic organisation plan for small teams. File and compute modules remain limited.',
    status: 'active',
    billing_mode: 'manual',
    pricing: {
      currency: 'AUD',
      monthly_amount_cents: 0,
      yearly_amount_cents: 0,
      billing_note: 'Placeholder price only. No payment gateway is active in v0.9.1.'
    },
    features: {
      ...baseFeatures,
      file_uploads: true,
      compute_allocation: false,
      compute_jobs: false,
      advanced_reporting: false,
      external_api_access: false
    },
    limits: {
      max_users: 5,
      max_storage_gb: 10,
      max_file_size_mb: 25,
      max_personal_access_tokens: 5,
      max_organisation_api_tokens: 2,
      max_compute_jobs_per_month: 0,
      max_concurrent_compute_jobs: 0,
      max_cpu: 0,
      max_memory_mb: 0
    },
    is_custom: false
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'Standard SaaS plan with external API access and moderate file limits.',
    status: 'active',
    billing_mode: 'manual',
    pricing: {
      currency: 'AUD',
      monthly_amount_cents: null,
      yearly_amount_cents: null,
      billing_note: 'Manual commercial placeholder. Pricing integration is planned later.'
    },
    features: {
      ...baseFeatures,
      file_uploads: true,
      compute_allocation: true,
      compute_jobs: false,
      advanced_reporting: false,
      external_api_access: true
    },
    limits: {
      max_users: 25,
      max_storage_gb: 100,
      max_file_size_mb: 100,
      max_personal_access_tokens: 20,
      max_organisation_api_tokens: 10,
      max_compute_jobs_per_month: 0,
      max_concurrent_compute_jobs: 0,
      max_cpu: 2,
      max_memory_mb: 4096
    },
    is_custom: false
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise-ready plan with compute, reporting and larger usage limits.',
    status: 'active',
    billing_mode: 'manual',
    pricing: {
      currency: 'AUD',
      monthly_amount_cents: null,
      yearly_amount_cents: null,
      billing_note: 'Enterprise pricing is manually assigned in v0.9.1.'
    },
    features: {
      ...baseFeatures,
      file_uploads: true,
      compute_allocation: true,
      compute_jobs: true,
      advanced_reporting: true,
      external_api_access: true
    },
    limits: {
      max_users: 100,
      max_storage_gb: 500,
      max_file_size_mb: 500,
      max_personal_access_tokens: 100,
      max_organisation_api_tokens: 50,
      max_compute_jobs_per_month: 10000,
      max_concurrent_compute_jobs: 10,
      max_cpu: 8,
      max_memory_mb: 16384
    },
    is_custom: false
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Custom commercial plan for individually negotiated tenants.',
    status: 'active',
    billing_mode: 'custom',
    pricing: {
      currency: 'AUD',
      monthly_amount_cents: null,
      yearly_amount_cents: null,
      billing_note: 'Custom billing handled outside this boilerplate foundation.'
    },
    features: {
      ...baseFeatures,
      file_uploads: true,
      compute_allocation: true,
      compute_jobs: true,
      advanced_reporting: true,
      external_api_access: true
    },
    limits: {
      max_users: null,
      max_storage_gb: null,
      max_file_size_mb: null,
      max_personal_access_tokens: null,
      max_organisation_api_tokens: null,
      max_compute_jobs_per_month: null,
      max_concurrent_compute_jobs: null,
      max_cpu: null,
      max_memory_mb: null
    },
    is_custom: true
  }
];

export function readPlainMap<T>(value: unknown): Record<string, T> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries()) as Record<string, T>;
  if (typeof value === 'object') return value as Record<string, T>;
  return {};
}

export function normalisePlanLimits(value: unknown): PlanLimits {
  const raw = readPlainMap<unknown>(value);
  const limits: PlanLimits = {};
  for (const key of Object.keys(DEFAULT_PLAN_LIMITS) as Array<keyof PlanLimits>) {
    const current = raw[key];
    if (current === null || current === undefined || current === '') {
      limits[key] = null;
    } else if (typeof current === 'number' && Number.isFinite(current) && current >= 0) {
      limits[key] = current;
    } else if (typeof current === 'string' && current.trim() !== '' && Number.isFinite(Number(current)) && Number(current) >= 0) {
      limits[key] = Number(current);
    }
  }
  return limits;
}

export function formatPlan(plan: PlanDocument | (PlanDocument & { _id: unknown })) {
  return {
    id: String(plan._id),
    key: plan.key,
    name: plan.name,
    description: plan.description ?? null,
    status: plan.status,
    billing_mode: plan.billing_mode,
    pricing: plan.pricing ?? {},
    features: readPlainMap<boolean>(plan.features),
    limits: normalisePlanLimits(plan.limits),
    is_custom: Boolean(plan.is_custom),
    created_at: plan.createdAt,
    updated_at: plan.updatedAt
  };
}

export function buildPlanAssignment(organisation: { plan?: Record<string, unknown> | null }) {
  const plan = organisation.plan ?? {};
  return {
    plan_key: (plan.plan_key ?? plan.plan_id ?? null) as string | null,
    plan_id: (plan.plan_id ?? plan.plan_key ?? null) as string | null,
    name: (plan.name ?? null) as string | null,
    subscription_status: (plan.subscription_status ?? plan.billing_status ?? 'manual') as string,
    billing_status: (plan.billing_status ?? plan.subscription_status ?? 'manual') as string,
    billing_mode: (plan.billing_mode ?? 'manual') as string,
    trial_ends_at: (plan.trial_ends_at ?? null) as Date | null,
    current_period_ends_at: (plan.current_period_ends_at ?? null) as Date | null,
    assigned_at: (plan.assigned_at ?? null) as Date | null,
    assigned_by_user_id: plan.assigned_by_user_id ? String(plan.assigned_by_user_id) : null,
    limits: normalisePlanLimits(plan.limits),
    features_from_plan: Boolean(plan.features_from_plan),
    notes: (plan.notes ?? null) as string | null
  };
}

export function mergeFeatureDefaults(existingFeatures: unknown, planFeatures: unknown): Record<string, boolean> {
  return {
    ...buildFeatureMap(existingFeatures),
    ...readPlainMap<boolean>(planFeatures)
  };
}
