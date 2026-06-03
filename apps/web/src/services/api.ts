const API_URL = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: Pagination;
  error?: { code?: string; message?: string; details?: unknown };
};

export type Pagination = { page: number; limit: number; total: number; total_pages?: number };

export type HealthResponse = {
  success: boolean;
  service: string;
  version: string;
  status: string;
  database?: { mongo_ready_state: number };
  timestamp: string;
};

export type UserSummary = {
  id: string;
  _id?: string;
  organisation_id: string;
  email: string;
  email_normalised?: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
  status: 'invited' | 'active' | 'disabled' | string;
  auth?: Record<string, unknown>;
  role_ids: string[];
  profile?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganisationSummary = {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  status: string;
  features?: Record<string, boolean>;
  branding?: OrganisationBranding;
  auth_config?: Record<string, unknown>;
  mfa_config?: Record<string, unknown>;
};

export type RoleSummary = {
  id: string;
  name: string;
  description?: string | null;
  is_system_role?: boolean;
  permission_keys: string[];
};

export type PermissionSummary = {
  key: string;
  name?: string;
  description?: string;
  category?: string;
};

export type TokenContext = {
  token_type: string;
  audience: string;
  scopes: string[];
  mfa_required?: boolean;
  mfa_verified?: boolean;
};

export type AuthContext = {
  user: UserSummary;
  organisation: OrganisationSummary;
  roles: RoleSummary[];
  permission_keys: string[];
  token_context?: TokenContext;
};

export type LoginResponse = AuthContext & {
  token_type: 'Bearer';
  access_token: string;
  expires_in: number;
};

export type OrganisationBranding = {
  logo_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
  sidebar_logo_url?: string | null;
  email_logo_url?: string | null;
  logo_file_id?: string | null;
  favicon_file_id?: string | null;
  login_background_file_id?: string | null;
  sidebar_logo_file_id?: string | null;
  email_logo_file_id?: string | null;
  primary_colour?: string | null;
  secondary_colour?: string | null;
  login_title?: string | null;
  login_subtitle?: string | null;
  support_email?: string | null;
};

export type OrganisationTheme = {
  mode?: 'light' | 'dark' | 'system';
  primary_colour?: string | null;
  secondary_colour?: string | null;
  accent_colour?: string | null;
  background_colour?: string | null;
  surface_colour?: string | null;
  text_colour?: string | null;
  muted_text_colour?: string | null;
  border_colour?: string | null;
  success_colour?: string | null;
  warning_colour?: string | null;
  danger_colour?: string | null;
  info_colour?: string | null;
  border_radius?: string | null;
  font_family?: string | null;
};

export type PublicLoginConfig = {
  organisation: OrganisationSummary & {
    branding: OrganisationBranding;
    theme?: OrganisationTheme;
    domains: Array<{ domain: string; verified: boolean; is_primary: boolean }>;
    auth_config: {
      login_method: string;
      sso_enabled: boolean;
      provider?: string | null;
      allowed_email_domains: string[];
      auto_provision_users: boolean;
      enforce_sso: boolean;
      enforce_mfa: boolean;
    };
  };
  login_policy: {
    native_login_enabled: boolean;
    sso_enabled: boolean;
    enforce_sso: boolean;
    enforce_mfa: boolean;
    mfa?: Record<string, unknown>;
  };
  resolved_by: string;
};

export type OrganisationBrandingResponse = {
  organisation: OrganisationSummary;
  branding: OrganisationBranding;
  theme: OrganisationTheme;
};

export type PublicThemeConfig = OrganisationBrandingResponse & { resolved_by: string };

export type OrganisationAuthConfig = {
  login_method: 'native' | 'oidc' | 'saml' | 'mixed';
  sso_enabled: boolean;
  provider?: 'azure_ad' | 'okta' | 'google' | 'keycloak' | 'custom_oidc' | 'custom' | null;
  issuer_url?: string | null;
  discovery_url?: string | null;
  client_id?: string | null;
  client_secret_ref?: string | null;
  allowed_email_domains: string[];
  auto_provision_users: boolean;
  default_role_id?: string | null;
  enforce_sso: boolean;
  enforce_mfa: boolean;
  native_login_enabled?: boolean;
  sso_login_enabled?: boolean;
};

export type OrganisationAuthConfigResponse = {
  organisation: OrganisationSummary;
  auth_config: OrganisationAuthConfig;
  notes?: string[];
};

export type MfaPolicy = {
  enabled: boolean;
  provider: 'native' | 'keycloak' | 'azure_ad' | 'okta' | 'custom_oidc' | 'none';
  enforcement_mode: 'disabled' | 'app_checked' | 'idp_enforced';
  required_for_roles: string[];
  required_for_permissions: string[];
  claim_mapping: { amr_claim?: string | null; acr_claim?: string | null; mfa_values: string[] };
  recovery_policy: { allow_admin_reset: boolean; require_audit_note: boolean };
};

export type OrganisationMfaPolicyResponse = {
  organisation: OrganisationSummary;
  mfa_policy: MfaPolicy;
  operational_notes: string[];
  integration_position?: Record<string, string>;
};

export type PublicMfaPolicyResponse = {
  organisation: OrganisationSummary;
  mfa_options: Record<string, unknown>;
  notes?: string[];
  resolved_by: string;
};

export type SsoProviderKey = 'azure_ad' | 'okta' | 'google' | 'keycloak' | 'custom_oidc' | 'custom' | null;

export type OrganisationSsoConfig = {
  enabled: boolean;
  provider: SsoProviderKey;
  protocol: 'oidc' | 'saml' | null;
  issuer_url?: string | null;
  discovery_url?: string | null;
  authorization_endpoint?: string | null;
  token_endpoint?: string | null;
  userinfo_endpoint?: string | null;
  jwks_uri?: string | null;
  logout_endpoint?: string | null;
  client_id?: string | null;
  client_secret_ref?: string | null;
  scopes: string[];
  response_type?: string | null;
  pkce_enabled: boolean;
  require_verified_email: boolean;
  redirect_uri?: string | null;
  post_logout_redirect_uri?: string | null;
  claim_mapping: {
    subject?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    groups?: string | null;
  };
  group_role_mapping: Array<{ external_group: string; role_id: string }>;
};

export type SsoValidation = { valid: boolean; status: string; errors: string[]; warnings: string[]; notes?: string[] };

export type OrganisationSsoConfigResponse = {
  organisation: OrganisationSummary;
  sso_config: OrganisationSsoConfig;
  validation: SsoValidation;
  provider_catalogue?: Array<Record<string, unknown>>;
  operational_notes?: string[];
};

export type PublicSsoOptionsResponse = {
  organisation: OrganisationSummary;
  sso_options: Record<string, unknown>;
  resolved_by: string;
};

export type FeatureCatalogueResponse = {
  features: Array<{ key: string; name: string; description?: string; category?: string; enabled_by_default?: boolean; limits?: Record<string, unknown> }>;
  notes?: string[];
};

export type OrganisationFeaturesResponse = {
  organisation: OrganisationSummary;
  features: Array<{ key: string; enabled: boolean; limits?: Record<string, unknown> }>;
  enforcement?: Record<string, unknown>;
};

export type PlanCatalogueResponse = {
  plans: Array<{ key: string; name: string; description?: string; status?: string; features?: Record<string, boolean>; limits?: Record<string, unknown>; billing_mode?: string; pricing?: Record<string, unknown> }>;
  billing_statuses?: string[];
};

export type OrganisationPlanResponse = {
  organisation: OrganisationSummary;
  plan?: Record<string, unknown> | null;
  plan_assignment?: { plan_key?: string; subscription_status?: string; billing_mode?: string; assigned_at?: string } | null;
};

export type TokenRecord = {
  id: string;
  token_type: string;
  token_name: string;
  token_preview?: string | null;
  audience?: string;
  scopes: string[];
  status: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
};

export type CreatedTokenResponse = { token_type: 'Bearer'; access_token: string; token: TokenRecord };

export type AuditLogRecord = {
  id: string;
  organisation_id: string;
  actor_user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
  created_at?: string | null;
  createdAt?: string | null;
};

export type SecurityEventRecord = {
  id: string;
  organisation_id: string;
  actor_user_id?: string | null;
  event_type: string;
  severity: string;
  status: string;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
  created_at?: string | null;
  createdAt?: string | null;
};

export type FileAsset = {
  id: string;
  organisation_id: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  size_mb: number;
  public_url?: string | null;
  visibility: string;
  status: string;
  description?: string | null;
  tags: string[];
  created_at?: string | null;
};


export type PlatformOrganisationPayload = {
  name: string;
  slug?: string;
  status?: string;
  domains?: Array<{ domain: string; verified?: boolean; is_primary?: boolean }>;
  branding?: Partial<OrganisationBranding>;
  features?: Record<string, boolean>;
};

export type PlatformPlanPayload = {
  key?: string;
  name?: string;
  description?: string | null;
  status?: string;
  billing_mode?: string;
  pricing?: Record<string, unknown>;
  features?: Record<string, boolean>;
  limits?: Record<string, unknown>;
  is_custom?: boolean;
};

export type PlatformPlanAssignmentPayload = {
  plan_key: string;
  subscription_status?: string;
  billing_mode?: string;
  apply_feature_defaults?: boolean;
  notes?: string | null;
};

export type FileListResponse = {
  files: FileAsset[];
  pagination: Pagination;
  storage_usage: { active_storage_bytes: number; active_storage_mb: number };
};

async function apiEnvelope<T>(path: string, token?: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      ? (payload as ApiEnvelope<unknown>).error?.message ?? (payload as ApiEnvelope<unknown>).message
      : String(payload);
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return payload as ApiEnvelope<T>;
}

async function apiData<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const envelope = await apiEnvelope<T>(path, token, init);
  if (envelope.data === undefined) {
    return envelope as unknown as T;
  }
  return envelope.data;
}

export function getApiBaseUrl(): string {
  return API_URL;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiData<HealthResponse>('/health');
}

export async function getReadiness(): Promise<HealthResponse> {
  return apiData<HealthResponse>('/health/ready');
}

export async function login(email: string, password: string, organisationSlug?: string): Promise<LoginResponse> {
  return apiData<LoginResponse>('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password, organisation_slug: organisationSlug })
  });
}

export async function getCurrentUser(token: string): Promise<AuthContext> {
  return apiData<AuthContext>('/auth/me', token);
}

export async function logout(token: string): Promise<ApiEnvelope<unknown>> {
  return apiEnvelope('/auth/logout', token, { method: 'POST' });
}

export async function getTokenContext(token: string): Promise<Record<string, unknown>> {
  return apiData<Record<string, unknown>>('/auth/token-context', token);
}

export async function getPublicLoginConfig(identifier: string): Promise<PublicLoginConfig> {
  return apiData<PublicLoginConfig>(`/public/organisation-login/${encodeURIComponent(identifier)}`);
}

export async function getPublicThemeConfig(identifier: string): Promise<PublicThemeConfig> {
  return apiData<PublicThemeConfig>(`/public/organisation-theme/${encodeURIComponent(identifier)}`);
}

export async function startSsoLogin(identifier: string): Promise<{ authorization_url: string; expires_in: number; provider: string | null }> {
  return apiData<{ authorization_url: string; expires_in: number; provider: string | null }>(`/auth/sso/${encodeURIComponent(identifier)}/start?redirect=false`);
}

export async function exchangeSsoCode(code: string): Promise<LoginResponse & { return_to?: string | null }> {
  return apiData<LoginResponse & { return_to?: string | null }>('/auth/sso/exchange', undefined, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}

export async function getPermissions(token: string): Promise<PermissionSummary[]> {
  return apiData<PermissionSummary[]>('/permissions', token);
}

export async function getRoles(token: string): Promise<RoleSummary[]> {
  return apiData<RoleSummary[]>('/org/roles', token);
}

export async function createRole(token: string, payload: { name: string; description?: string; permission_keys: string[] }): Promise<RoleSummary> {
  return apiData<RoleSummary>('/org/roles', token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function getOrganisationUsers(token: string, organisationId: string, query = ''): Promise<{ users: UserSummary[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<UserSummary[]>(`/platform/organisations/${organisationId}/users${query}`, token);
  return { users: envelope.data ?? [], pagination: envelope.pagination };
}

export async function createOrganisationUser(token: string, organisationId: string, payload: Partial<UserSummary> & { password?: string; role_ids?: string[] }): Promise<UserSummary> {
  return apiData<UserSummary>(`/platform/organisations/${organisationId}/users`, token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateOrganisationUser(token: string, organisationId: string, userId: string, payload: Partial<UserSummary> & { password?: string; role_ids?: string[] }): Promise<UserSummary> {
  return apiData<UserSummary>(`/platform/organisations/${organisationId}/users/${userId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updateOrganisationUserStatus(token: string, organisationId: string, userId: string, status: string): Promise<UserSummary> {
  return apiData<UserSummary>(`/platform/organisations/${organisationId}/users/${userId}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function getOrganisationBranding(token: string): Promise<OrganisationBrandingResponse> {
  return apiData<OrganisationBrandingResponse>('/org/branding', token);
}

export async function updateOrganisationBranding(token: string, payload: OrganisationBranding): Promise<OrganisationBrandingResponse> {
  return apiData<OrganisationBrandingResponse>('/org/branding', token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updateOrganisationTheme(token: string, payload: OrganisationTheme): Promise<OrganisationBrandingResponse> {
  return apiData<OrganisationBrandingResponse>('/org/branding/theme', token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getOrganisationAuthConfig(token: string): Promise<OrganisationAuthConfigResponse> {
  return apiData<OrganisationAuthConfigResponse>('/org/auth-config', token);
}

export async function updateOrganisationAuthConfig(token: string, payload: Partial<OrganisationAuthConfig>): Promise<OrganisationAuthConfigResponse> {
  return apiData<OrganisationAuthConfigResponse>('/org/auth-config', token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getOrganisationSsoConfig(token: string): Promise<OrganisationSsoConfigResponse> {
  return apiData<OrganisationSsoConfigResponse>('/org/sso-config', token);
}

export async function updateOrganisationSsoConfig(token: string, payload: Partial<OrganisationSsoConfig>): Promise<OrganisationSsoConfigResponse> {
  return apiData<OrganisationSsoConfigResponse>('/org/sso-config', token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function testOrganisationSsoConfig(token: string): Promise<{ organisation: OrganisationSummary; validation: SsoValidation }> {
  return apiData<{ organisation: OrganisationSummary; validation: SsoValidation }>('/org/sso-config/test', token, { method: 'POST' });
}

export async function getOrganisationMfaPolicy(token: string): Promise<OrganisationMfaPolicyResponse> {
  return apiData<OrganisationMfaPolicyResponse>('/org/mfa-policy', token);
}

export async function updateOrganisationMfaPolicy(token: string, payload: Partial<MfaPolicy>): Promise<OrganisationMfaPolicyResponse> {
  return apiData<OrganisationMfaPolicyResponse>('/org/mfa-policy', token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getOrganisationAuditLogs(token: string, query = ''): Promise<{ records: AuditLogRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<AuditLogRecord[]>(`/org/audit-logs${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function getOrganisationSecurityEvents(token: string, query = ''): Promise<{ records: SecurityEventRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<SecurityEventRecord[]>(`/org/security-events${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function getPersonalAccessTokens(token: string): Promise<TokenRecord[]> {
  return apiData<TokenRecord[]>('/org/personal-access-tokens', token);
}

export async function createPersonalAccessToken(token: string, payload: { token_name: string; expires_in_days: number; scopes: string[] }): Promise<CreatedTokenResponse> {
  return apiData<CreatedTokenResponse>('/org/personal-access-tokens', token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function revokePersonalAccessToken(token: string, tokenId: string): Promise<TokenRecord> {
  return apiData<TokenRecord>(`/org/personal-access-tokens/${tokenId}`, token, { method: 'DELETE' });
}

export async function getOrganisationApiTokens(token: string): Promise<TokenRecord[]> {
  return apiData<TokenRecord[]>('/org/api-tokens', token);
}

export async function createOrganisationApiToken(token: string, payload: { token_name: string; expires_in_days: number; scopes: string[] }): Promise<CreatedTokenResponse> {
  return apiData<CreatedTokenResponse>('/org/api-tokens', token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function revokeOrganisationApiToken(token: string, tokenId: string): Promise<TokenRecord> {
  return apiData<TokenRecord>(`/org/api-tokens/${tokenId}`, token, { method: 'DELETE' });
}

export async function getFeatureCatalogue(token: string): Promise<FeatureCatalogueResponse> {
  return apiData<FeatureCatalogueResponse>('/features/catalogue', token);
}

export async function getOrganisationFeatures(token: string): Promise<OrganisationFeaturesResponse> {
  return apiData<OrganisationFeaturesResponse>('/org/features', token);
}

export async function getPlanCatalogue(token: string): Promise<PlanCatalogueResponse> {
  return apiData<PlanCatalogueResponse>('/platform/plans', token);
}

export async function getOrganisationPlan(token: string): Promise<OrganisationPlanResponse> {
  return apiData<OrganisationPlanResponse>('/org/plan', token);
}

export async function getPlatformOrganisationPlan(token: string, organisationId: string): Promise<OrganisationPlanResponse> {
  return apiData<OrganisationPlanResponse>(`/platform/organisations/${organisationId}/plan`, token);
}

export async function getOrganisationFiles(token: string): Promise<FileListResponse> {
  return apiData<FileListResponse>('/org/files', token);
}

export function getFileDownloadUrl(fileId: string): string {
  return `${API_URL}/org/files/${fileId}/download`;
}

export async function getPlatformOrganisations(token: string, query = '?limit=100'): Promise<{ organisations: OrganisationSummary[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<OrganisationSummary[]>(`/platform/organisations${query}`, token);
  return { organisations: envelope.data ?? [], pagination: envelope.pagination };
}

export async function createPlatformOrganisation(token: string, payload: PlatformOrganisationPayload): Promise<OrganisationSummary> {
  return apiData<OrganisationSummary>('/platform/organisations', token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updatePlatformOrganisation(token: string, organisationId: string, payload: Partial<PlatformOrganisationPayload>): Promise<OrganisationSummary> {
  return apiData<OrganisationSummary>(`/platform/organisations/${organisationId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updatePlatformOrganisationStatus(token: string, organisationId: string, status: string): Promise<OrganisationSummary> {
  return apiData<OrganisationSummary>(`/platform/organisations/${organisationId}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function getPlatformAuditLogs(token: string, query = '?limit=50'): Promise<{ records: AuditLogRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<AuditLogRecord[]>(`/platform/audit-logs${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function getPlatformSecurityEvents(token: string, query = '?limit=50'): Promise<{ records: SecurityEventRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<SecurityEventRecord[]>(`/platform/security-events${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function getPlatformOrganisationAuditLogs(token: string, organisationId: string, query = '?limit=50'): Promise<{ records: AuditLogRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<AuditLogRecord[]>(`/platform/organisations/${organisationId}/audit-logs${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function getPlatformOrganisationSecurityEvents(token: string, organisationId: string, query = '?limit=50'): Promise<{ records: SecurityEventRecord[]; pagination?: Pagination }> {
  const envelope = await apiEnvelope<SecurityEventRecord[]>(`/platform/organisations/${organisationId}/security-events${query}`, token);
  return { records: envelope.data ?? [], pagination: envelope.pagination };
}

export async function assignPlatformOrganisationPlan(token: string, organisationId: string, payload: PlatformPlanAssignmentPayload): Promise<OrganisationPlanResponse> {
  return apiData<OrganisationPlanResponse>(`/platform/organisations/${organisationId}/plan`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function applyPlatformOrganisationPlanDefaults(token: string, organisationId: string): Promise<OrganisationPlanResponse> {
  return apiData<OrganisationPlanResponse>(`/platform/organisations/${organisationId}/plan/apply-defaults`, token, { method: 'POST' });
}

export async function createPlatformPlan(token: string, payload: PlatformPlanPayload): Promise<{ plan: Record<string, unknown> }> {
  return apiData<{ plan: Record<string, unknown> }>('/platform/plans', token, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updatePlatformPlan(token: string, planKey: string, payload: PlatformPlanPayload): Promise<{ plan: Record<string, unknown> }> {
  return apiData<{ plan: Record<string, unknown> }>(`/platform/plans/${encodeURIComponent(planKey)}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
}
