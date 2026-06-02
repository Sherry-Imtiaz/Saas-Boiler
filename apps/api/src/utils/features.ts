export type FeatureKey =
  | 'dashboard'
  | 'user_management'
  | 'role_management'
  | 'branding'
  | 'auth_configuration'
  | 'sso_configuration'
  | 'mfa_policy'
  | 'personal_access_tokens'
  | 'organisation_api_tokens'
  | 'file_uploads'
  | 'compute_allocation'
  | 'compute_jobs'
  | 'audit_logs'
  | 'advanced_reporting'
  | 'external_api_access';

export type FeatureCategory = 'core' | 'security' | 'integration' | 'storage' | 'compute' | 'reporting' | 'admin';

export type FeatureCatalogueItem = {
  key: FeatureKey;
  name: string;
  description: string;
  category: FeatureCategory;
  enabled_by_default: boolean;
  internal_only: boolean;
  required_permissions: string[];
  default_limits?: Record<string, number | string | boolean | null>;
};

export type OrganisationFeatureState = {
  key: FeatureKey;
  enabled: boolean;
  source: 'organisation' | 'default';
  limits: Record<string, number | string | boolean | null>;
  config: Record<string, unknown>;
};

export const FEATURE_CATALOGUE: FeatureCatalogueItem[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Core dashboard and home screen access.',
    category: 'core',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['organisation.view']
  },
  {
    key: 'user_management',
    name: 'User Management',
    description: 'Manage organisation-owned users.',
    category: 'admin',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['users.view']
  },
  {
    key: 'role_management',
    name: 'Role Management',
    description: 'Manage organisation-scoped roles and permissions.',
    category: 'admin',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['roles.view']
  },
  {
    key: 'branding',
    name: 'Branding and Theme',
    description: 'Organisation login branding, theme colours and branding assets.',
    category: 'core',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['organisation.branding.view']
  },
  {
    key: 'auth_configuration',
    name: 'Auth Configuration',
    description: 'Organisation native/SSO login configuration.',
    category: 'security',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['organisation.auth.view']
  },
  {
    key: 'sso_configuration',
    name: 'SSO Configuration',
    description: 'SSO provider configuration for Keycloak, Azure Entra, Okta, Google or custom OIDC.',
    category: 'security',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['organisation.sso.view']
  },
  {
    key: 'mfa_policy',
    name: 'MFA Policy',
    description: 'Provider-neutral MFA policy settings and claim mapping.',
    category: 'security',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['organisation.mfa.view']
  },
  {
    key: 'personal_access_tokens',
    name: 'Personal Access Tokens',
    description: 'User-owned long-lived tokens for Postman and scripts.',
    category: 'security',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['tokens.personal.manage']
  },
  {
    key: 'organisation_api_tokens',
    name: 'Organisation API Tokens',
    description: 'Organisation-owned external/system-to-system integration tokens.',
    category: 'integration',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['tokens.organisation.manage']
  },
  {
    key: 'file_uploads',
    name: 'File Uploads',
    description: 'Organisation-owned file upload, metadata, download and archive workflows.',
    category: 'storage',
    enabled_by_default: false,
    internal_only: false,
    required_permissions: ['files.view'],
    default_limits: { max_storage_gb: 1, max_file_size_mb: 25 }
  },
  {
    key: 'compute_allocation',
    name: 'Compute Allocation',
    description: 'Organisation compute allocation visibility and management. Full compute allocation module is planned for v0.11.0.',
    category: 'compute',
    enabled_by_default: false,
    internal_only: true,
    required_permissions: ['compute.resources.view'],
    default_limits: { max_cpu: 2, max_memory_mb: 4096, max_storage_gb: 20 }
  },
  {
    key: 'compute_jobs',
    name: 'Compute Jobs',
    description: 'Organisation compute job submission and tracking. Full compute jobs module remains an optional future product module.',
    category: 'compute',
    enabled_by_default: false,
    internal_only: false,
    required_permissions: ['compute.jobs.view'],
    default_limits: { max_concurrent_jobs: 2, monthly_job_limit: 1000 }
  },
  {
    key: 'audit_logs',
    name: 'Audit Logs',
    description: 'Organisation audit log visibility. Expanded audit log module is active from v0.11.0.',
    category: 'security',
    enabled_by_default: true,
    internal_only: true,
    required_permissions: ['audit.view']
  },
  {
    key: 'advanced_reporting',
    name: 'Advanced Reporting',
    description: 'Advanced reporting and analytics capability for future modules.',
    category: 'reporting',
    enabled_by_default: false,
    internal_only: false,
    required_permissions: ['organisation.view']
  },
  {
    key: 'external_api_access',
    name: 'External API Access',
    description: 'External API access using organisation API tokens.',
    category: 'integration',
    enabled_by_default: false,
    internal_only: false,
    required_permissions: ['tokens.organisation.manage']
  }
];

export const FEATURE_KEYS = FEATURE_CATALOGUE.map((feature) => feature.key);

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}

function readFeatureBoolean(features: unknown, key: string): boolean | undefined {
  if (!features) return undefined;

  if (features instanceof Map) {
    const value = features.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  if (typeof features === 'object') {
    const value = (features as Record<string, unknown>)[key];
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).enabled === 'boolean') {
      return Boolean((value as Record<string, unknown>).enabled);
    }
  }

  return undefined;
}

export function buildFeatureState(features: unknown): OrganisationFeatureState[] {
  return FEATURE_CATALOGUE.map((catalogueItem) => {
    const explicitValue = readFeatureBoolean(features, catalogueItem.key);
    return {
      key: catalogueItem.key,
      enabled: explicitValue ?? catalogueItem.enabled_by_default,
      source: explicitValue === undefined ? 'default' : 'organisation',
      limits: catalogueItem.default_limits ?? {},
      config: {}
    };
  });
}

export function buildFeatureMap(features: unknown): Record<FeatureKey, boolean> {
  return Object.fromEntries(buildFeatureState(features).map((feature) => [feature.key, feature.enabled])) as Record<FeatureKey, boolean>;
}

export function featureEnabled(features: unknown, key: string): boolean {
  const catalogueItem = FEATURE_CATALOGUE.find((feature) => feature.key === key);
  if (!catalogueItem) return false;
  return buildFeatureMap(features)[catalogueItem.key];
}

export function getDefaultFeatureMap(): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_CATALOGUE.map((feature) => [feature.key, feature.enabled_by_default])) as Record<FeatureKey, boolean>;
}
