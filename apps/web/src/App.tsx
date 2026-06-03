import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  applyPlatformOrganisationPlanDefaults,
  assignPlatformOrganisationPlan,
  createOrganisationApiToken,
  createOrganisationUser,
  createPersonalAccessToken,
  createPlatformOrganisation,
  createPlatformPlan,
  createRole,
  exchangeSsoCode,
  getApiBaseUrl,
  getCurrentUser,
  getFeatureCatalogue,
  getHealth,
  getOrganisationApiTokens,
  getOrganisationAuditLogs,
  getOrganisationAuthConfig,
  getOrganisationBranding,
  getOrganisationFeatures,
  getOrganisationFiles,
  getOrganisationMfaPolicy,
  getOrganisationPlan,
  getOrganisationSecurityEvents,
  getOrganisationSsoConfig,
  getOrganisationUsers,
  getPermissions,
  getPersonalAccessTokens,
  getPlanCatalogue,
  getPlatformOrganisationAuditLogs,
  getPlatformOrganisationPlan,
  getPlatformOrganisationSecurityEvents,
  getPlatformAuditLogs,
  getPlatformOrganisations,
  getPlatformSecurityEvents,
  getPublicLoginConfig,
  getReadiness,
  getRoles,
  getTokenContext,
  login,
  logout,
  revokeOrganisationApiToken,
  revokePersonalAccessToken,
  startSsoLogin,
  testOrganisationSsoConfig,
  updateOrganisationBranding,
  updateOrganisationMfaPolicy,
  updateOrganisationSsoConfig,
  updateOrganisationTheme,
  updateOrganisationUser,
  updateOrganisationUserStatus,
  updatePlatformOrganisationStatus,
  updatePlatformPlan,
  type AuditLogRecord,
  type AuthContext,
  type FeatureCatalogueResponse,
  type FileAsset,
  type HealthResponse,
  type LoginResponse,
  type MfaPolicy,
  type OrganisationAuthConfig,
  type OrganisationBranding,
  type OrganisationBrandingResponse,
  type OrganisationFeaturesResponse,
  type OrganisationMfaPolicyResponse,
  type OrganisationPlanResponse,
  type OrganisationSsoConfig,
  type OrganisationSsoConfigResponse,
  type OrganisationSummary,
  type OrganisationTheme,
  type PermissionSummary,
  type PlanCatalogueResponse,
  type PublicLoginConfig,
  type RoleSummary,
  type SecurityEventRecord,
  type TokenRecord,
  type UserSummary
} from './services/api';

const STORAGE_KEY = 'saas_boilerplate_access_token_v0190';
const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_PASSWORD = 'ChangeMe123!';
const DEFAULT_ORG = 'demo-organisation';

type Workspace = 'organisation' | 'platform';
type View =
  | 'org-dashboard'
  | 'org-users'
  | 'org-access'
  | 'org-branding'
  | 'org-identity'
  | 'org-tokens'
  | 'org-files'
  | 'org-observability'
  | 'org-developer'
  | 'platform-dashboard'
  | 'platform-organisations'
  | 'platform-tenant-360'
  | 'identity-sso'
  | 'identity-mfa'
  | 'identity-roles'
  | 'platform-plans'
  | 'platform-security'
  | 'platform-system';

type Notice = { type: 'success' | 'error' | 'info'; message: string };
type TenantTab = 'overview' | 'users' | 'security' | 'billing';
type IdentityFocus = 'sso' | 'mfa';
type NavItem = { view: View; label: string; disabled?: boolean; helper?: string };
type NavSection = { key: string; label: string; items: NavItem[] };

type UserForm = {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  password: string;
  roleIds: string[];
};

type TokenForm = { tokenName: string; expiresInDays: number; scopes: string };

type PlatformOrganisationForm = { name: string; slug: string; status: string };
type PlatformPlanForm = { key: string; name: string; description: string; status: string; billingMode: string; featuresJson: string; limitsJson: string };

const defaultBranding: OrganisationBranding = {
  logo_url: '',
  favicon_url: '',
  login_background_url: '',
  primary_colour: '#2563eb',
  secondary_colour: '#0f172a',
  login_title: 'Welcome to your workspace',
  login_subtitle: 'Sign in to continue',
  support_email: 'support@example.com'
};

const defaultTheme: OrganisationTheme = {
  mode: 'light',
  primary_colour: '#2563eb',
  secondary_colour: '#0f172a',
  accent_colour: '#10b981',
  background_colour: '#f8fafc',
  surface_colour: '#ffffff',
  text_colour: '#111827',
  muted_text_colour: '#6b7280',
  border_colour: '#e5e7eb',
  success_colour: '#16a34a',
  warning_colour: '#f59e0b',
  danger_colour: '#dc2626',
  info_colour: '#0284c7',
  border_radius: '14px',
  font_family: 'Inter, system-ui, sans-serif'
};

const defaultSsoConfig: OrganisationSsoConfig = {
  enabled: false,
  provider: 'keycloak',
  protocol: 'oidc',
  issuer_url: '',
  discovery_url: '',
  authorization_endpoint: '',
  token_endpoint: '',
  userinfo_endpoint: '',
  jwks_uri: '',
  logout_endpoint: '',
  client_id: '',
  client_secret_ref: '',
  scopes: ['openid', 'profile', 'email'],
  response_type: 'code',
  pkce_enabled: true,
  require_verified_email: true,
  redirect_uri: 'http://localhost:4000/api/auth/sso/callback',
  post_logout_redirect_uri: 'http://localhost:5173/login',
  claim_mapping: {
    subject: 'sub',
    email: 'email',
    first_name: 'given_name',
    last_name: 'family_name',
    display_name: 'name',
    groups: 'groups'
  },
  group_role_mapping: []
};

const defaultMfaPolicy: MfaPolicy = {
  enabled: false,
  provider: 'none',
  enforcement_mode: 'disabled',
  required_for_roles: [],
  required_for_permissions: [],
  claim_mapping: { amr_claim: 'amr', acr_claim: 'acr', mfa_values: ['otp', 'webauthn', 'mfa'] },
  recovery_policy: { allow_admin_reset: true, require_audit_note: true }
};

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function shortId(value = '', start = 10, end = 6): string {
  return value.length > start + end + 4 ? `${value.slice(0, start)}...${value.slice(-end)}` : value || '-';
}

function asArrayCsv(values: string[] | undefined): string {
  return Array.isArray(values) ? values.join(', ') : '';
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function hasPermission(auth: AuthContext | null, permission: string): boolean {
  return Boolean(auth?.permission_keys.includes(permission));
}

function getOrganisationId(auth: AuthContext | null): string {
  return auth?.organisation.id || auth?.organisation._id || '';
}

function canAccessPlatform(auth: AuthContext | null): boolean {
  if (!auth) {
    return false;
  }

  const permissionHit = auth.permission_keys.some((permission) => permission.startsWith('organisations.platform') || permission.startsWith('audit.platform') || permission.startsWith('security.events.platform') || permission.startsWith('plans.platform'));
  const roleHit = auth.roles.some((role) => role.name.toLowerCase().includes('platform'));
  return permissionHit || roleHit;
}

function jsonPreview(value: unknown): string {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return '-';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonRecord(value: string, label: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function getTenantId(organisation: OrganisationSummary): string {
  return organisation.id || organisation._id || '';
}

function readPlanKey(organisation: OrganisationSummary): string {
  const withPlan = organisation as OrganisationSummary & {
    plan?: Record<string, unknown> | null;
    plan_assignment?: { plan_key?: string | null } | null;
  };
  const planKey = withPlan.plan_assignment?.plan_key ?? withPlan.plan?.key ?? withPlan.plan?.plan_key ?? withPlan.plan?.name;
  return typeof planKey === 'string' && planKey.trim() ? planKey : 'Unassigned';
}

function readPlanName(planResponse: OrganisationPlanResponse | null): string {
  const planName = planResponse?.plan?.name ?? planResponse?.plan?.key ?? planResponse?.plan_assignment?.plan_key;
  return typeof planName === 'string' && planName.trim() ? planName : 'Unassigned';
}

function readBillingMode(planResponse: OrganisationPlanResponse | null): string {
  const billingMode = planResponse?.plan_assignment?.billing_mode ?? planResponse?.plan?.billing_mode;
  return typeof billingMode === 'string' && billingMode.trim() ? billingMode : 'Not configured';
}

function countPlanFeatures(planResponse: OrganisationPlanResponse | null): number {
  const features = planResponse?.plan?.features;
  return features && typeof features === 'object' && !Array.isArray(features) ? Object.keys(features).length : 0;
}

function countPlanLimits(planResponse: OrganisationPlanResponse | null): number {
  const limits = planResponse?.plan?.limits;
  return limits && typeof limits === 'object' && !Array.isArray(limits) ? Object.keys(limits).length : 0;
}

function deriveIdentityStatus(organisation: OrganisationSummary | null): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  const ssoEnabled = Boolean(organisation?.auth_config?.sso_enabled || organisation?.auth_config?.enforce_sso);
  const mfaEnabled = Boolean(organisation?.mfa_config?.enabled || organisation?.auth_config?.enforce_mfa);
  if (ssoEnabled && mfaEnabled) {
    return { label: 'SSO + MFA ready', tone: 'good' };
  }
  if (ssoEnabled || mfaEnabled) {
    return { label: ssoEnabled ? 'SSO configured' : 'MFA configured', tone: 'warn' };
  }
  return { label: 'Native login', tone: 'neutral' };
}

function deriveTenantHealth(organisation: OrganisationSummary | null, securityEvents: SecurityEventRecord[]): { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' } {
  if (!organisation) {
    return { label: 'No tenant selected', tone: 'neutral' };
  }
  if (organisation.status === 'suspended' || organisation.status === 'disabled') {
    return { label: 'Suspended', tone: 'danger' };
  }
  if (securityEvents.some((event) => ['critical', 'high'].includes(event.severity))) {
    return { label: 'Needs attention', tone: 'warn' };
  }
  if (organisation.status === 'active') {
    return { label: 'Healthy', tone: 'good' };
  }
  return { label: organisation.status || 'Unknown', tone: 'neutral' };
}

function buildAttentionItems(readiness: HealthResponse | null, organisations: OrganisationSummary[], securityEvents: SecurityEventRecord[]): string[] {
  const items: string[] = [];
  if (readiness?.status && !readiness.status.toLowerCase().includes('ok') && !readiness.status.toLowerCase().includes('ready')) {
    items.push(`Readiness is ${readiness.status}`);
  }
  const suspendedCount = organisations.filter((organisation) => organisation.status === 'suspended').length;
  if (suspendedCount > 0) {
    items.push(`${suspendedCount} suspended tenant${suspendedCount === 1 ? '' : 's'}`);
  }
  const highSignalCount = securityEvents.filter((event) => ['critical', 'high'].includes(event.severity)).length;
  if (highSignalCount > 0) {
    items.push(`${highSignalCount} high-severity security signal${highSignalCount === 1 ? '' : 's'}`);
  }
  return items;
}

function eventTone(severity: string): 'danger' | 'warn' | 'neutral' {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  return 'neutral';
}

function StatusBadge({ value, tone }: { value: string | boolean | undefined | null; tone?: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const label = typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value || 'Unknown';
  const resolvedTone = tone ?? (label.toString().toLowerCase().includes('active') || label === 'Enabled' || label.toString().toLowerCase().includes('ok') ? 'good' : label.toString().toLowerCase().includes('disabled') || label.toString().toLowerCase().includes('failed') ? 'danger' : 'neutral');
  return <span className={`status-badge ${resolvedTone}`}>{label}</span>;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span>{label}</span>
        <i aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="section-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-actions">{action}</div> : null}
    </header>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="field field-full">
      <span>{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function DataTable<T>({ columns, rows, emptyTitle, emptyMessage }: { columns: Array<{ label: string; render: (row: T) => React.ReactNode }>; rows: T[]; emptyTitle: string; emptyMessage: string }) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function App() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>('organisation');
  const [view, setView] = useState<View>('org-dashboard');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [organisationSlug, setOrganisationSlug] = useState(DEFAULT_ORG);
  const [loginEmail, setLoginEmail] = useState(DEFAULT_EMAIL);
  const [loginPassword, setLoginPassword] = useState(DEFAULT_PASSWORD);
  const [loginConfig, setLoginConfig] = useState<PublicLoginConfig | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<HealthResponse | null>(null);
  const [tokenContext, setTokenContext] = useState<Record<string, unknown> | null>(null);
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [brandingData, setBrandingData] = useState<OrganisationBrandingResponse | null>(null);
  const [brandingForm, setBrandingForm] = useState<OrganisationBranding>(defaultBranding);
  const [themeForm, setThemeForm] = useState<OrganisationTheme>(defaultTheme);
  const [authConfig, setAuthConfig] = useState<OrganisationAuthConfig | null>(null);
  const [ssoConfigData, setSsoConfigData] = useState<OrganisationSsoConfigResponse | null>(null);
  const [ssoForm, setSsoForm] = useState<OrganisationSsoConfig>(defaultSsoConfig);
  const [mfaData, setMfaData] = useState<OrganisationMfaPolicyResponse | null>(null);
  const [mfaForm, setMfaForm] = useState<MfaPolicy>(defaultMfaPolicy);
  const [personalTokens, setPersonalTokens] = useState<TokenRecord[]>([]);
  const [organisationTokens, setOrganisationTokens] = useState<TokenRecord[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [featureCatalogue, setFeatureCatalogue] = useState<FeatureCatalogueResponse | null>(null);
  const [organisationFeatures, setOrganisationFeatures] = useState<OrganisationFeaturesResponse | null>(null);
  const [planCatalogue, setPlanCatalogue] = useState<PlanCatalogueResponse | null>(null);
  const [organisationPlan, setOrganisationPlan] = useState<OrganisationPlanResponse | null>(null);
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [platformOrganisations, setPlatformOrganisations] = useState<OrganisationSummary[]>([]);
  const [platformAuditLogs, setPlatformAuditLogs] = useState<AuditLogRecord[]>([]);
  const [platformSecurityEvents, setPlatformSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantTab, setTenantTab] = useState<TenantTab>('overview');
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantPlan, setTenantPlan] = useState<OrganisationPlanResponse | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserSummary[]>([]);
  const [tenantAuditLogs, setTenantAuditLogs] = useState<AuditLogRecord[]>([]);
  const [tenantSecurityEvents, setTenantSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [expandedNavSections, setExpandedNavSections] = useState<Record<string, boolean>>({
    overview: true,
    tenants: true,
    identity: true,
    billing: false,
    security: false,
    platform: false,
    settings: false
  });

  const [userForm, setUserForm] = useState<UserForm>({ userId: '', email: '', displayName: '', firstName: '', lastName: '', password: '', roleIds: [] });
  const [personalTokenForm, setPersonalTokenForm] = useState<TokenForm>({ tokenName: 'Local developer token', expiresInDays: 30, scopes: 'internal:user' });
  const [organisationTokenForm, setOrganisationTokenForm] = useState<TokenForm>({ tokenName: 'Organisation integration token', expiresInDays: 30, scopes: 'external:organisation' });
  const [platformOrganisationForm, setPlatformOrganisationForm] = useState<PlatformOrganisationForm>({ name: '', slug: '', status: 'active' });
  const [platformPlanForm, setPlatformPlanForm] = useState<PlatformPlanForm>({ key: '', name: '', description: '', status: 'active', billingMode: 'manual', featuresJson: '{\n  "branding.manage": true\n}', limitsJson: '{\n  "max_users": 25\n}' });
  const [selectedPlanOrgId, setSelectedPlanOrgId] = useState('');
  const [selectedPlanKey, setSelectedPlanKey] = useState('');

  const organisationId = getOrganisationId(auth);
  const platformAllowed = canAccessPlatform(auth);
  const activeBranding = loginConfig?.organisation.branding ?? brandingData?.branding ?? defaultBranding;
  const activeTheme = loginConfig?.organisation.theme ?? brandingData?.theme ?? defaultTheme;
  const nativeLoginEnabled = loginConfig?.login_policy.native_login_enabled !== false;
  const ssoLoginEnabled = Boolean(loginConfig?.login_policy.sso_enabled);
  const selectedTenant = useMemo(() => platformOrganisations.find((organisation) => getTenantId(organisation) === selectedTenantId) ?? null, [platformOrganisations, selectedTenantId]);
  const filteredTenants = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) {
      return platformOrganisations;
    }
    return platformOrganisations.filter((organisation) => [organisation.name, organisation.slug, organisation.status, readPlanKey(organisation)].some((value) => value.toLowerCase().includes(query)));
  }, [platformOrganisations, tenantSearch]);
  const attentionItems = useMemo(() => buildAttentionItems(readiness, platformOrganisations, platformSecurityEvents), [readiness, platformOrganisations, platformSecurityEvents]);

  async function runTask<T>(task: () => Promise<T>, successMessage?: string): Promise<T | null> {
    setLoading(true);
    setNotice(null);
    try {
      const result = await task();
      if (successMessage) {
        setNotice({ type: 'success', message: successMessage });
      }
      return result;
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error) });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function refreshLoginConfig(identifier = organisationSlug) {
    if (!identifier.trim()) {
      setLoginConfig(null);
      return;
    }
    const result = await runTask(() => getPublicLoginConfig(identifier.trim()));
    if (result) {
      setLoginConfig(result);
    }
  }

  async function refreshAll(token = accessToken, context = auth) {
    if (!token || !context) {
      return;
    }

    const orgId = getOrganisationId(context);

    const coreResults = await Promise.allSettled([
      getHealth(),
      getReadiness(),
      getTokenContext(token),
      getPermissions(token),
      getRoles(token),
      getOrganisationBranding(token),
      getOrganisationAuthConfig(token),
      getOrganisationSsoConfig(token),
      getOrganisationMfaPolicy(token),
      getOrganisationAuditLogs(token, '?limit=12'),
      getOrganisationSecurityEvents(token, '?limit=12'),
      getPersonalAccessTokens(token),
      getOrganisationApiTokens(token),
      getFeatureCatalogue(token),
      getOrganisationFeatures(token),
      getPlanCatalogue(token),
      getOrganisationPlan(token),
      getOrganisationFiles(token),
      orgId ? getOrganisationUsers(token, orgId, '?limit=100') : Promise.resolve({ users: [] })
    ]);

    const [healthResult, readinessResult, tokenResult, permissionsResult, rolesResult, brandingResult, authConfigResult, ssoResult, mfaResult, auditResult, securityResult, personalTokenResult, orgTokenResult, featureCatalogueResult, organisationFeaturesResult, planCatalogueResult, organisationPlanResult, filesResult, usersResult] = coreResults;

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (readinessResult.status === 'fulfilled') setReadiness(readinessResult.value);
    if (tokenResult.status === 'fulfilled') setTokenContext(tokenResult.value);
    if (permissionsResult.status === 'fulfilled') setPermissions(permissionsResult.value);
    if (rolesResult.status === 'fulfilled') setRoles(rolesResult.value);
    if (brandingResult.status === 'fulfilled') {
      setBrandingData(brandingResult.value);
      setBrandingForm({ ...defaultBranding, ...brandingResult.value.branding });
      setThemeForm({ ...defaultTheme, ...brandingResult.value.theme });
    }
    if (authConfigResult.status === 'fulfilled') setAuthConfig(authConfigResult.value.auth_config);
    if (ssoResult.status === 'fulfilled') {
      setSsoConfigData(ssoResult.value);
      setSsoForm({ ...defaultSsoConfig, ...ssoResult.value.sso_config, scopes: ssoResult.value.sso_config.scopes ?? defaultSsoConfig.scopes });
    }
    if (mfaResult.status === 'fulfilled') {
      setMfaData(mfaResult.value);
      setMfaForm({ ...defaultMfaPolicy, ...mfaResult.value.mfa_policy });
    }
    if (auditResult.status === 'fulfilled') setAuditLogs(auditResult.value.records);
    if (securityResult.status === 'fulfilled') setSecurityEvents(securityResult.value.records);
    if (personalTokenResult.status === 'fulfilled') setPersonalTokens(personalTokenResult.value);
    if (orgTokenResult.status === 'fulfilled') setOrganisationTokens(orgTokenResult.value);
    if (featureCatalogueResult.status === 'fulfilled') setFeatureCatalogue(featureCatalogueResult.value);
    if (organisationFeaturesResult.status === 'fulfilled') setOrganisationFeatures(organisationFeaturesResult.value);
    if (planCatalogueResult.status === 'fulfilled') setPlanCatalogue(planCatalogueResult.value);
    if (organisationPlanResult.status === 'fulfilled') setOrganisationPlan(organisationPlanResult.value);
    if (filesResult.status === 'fulfilled') setFiles(filesResult.value.files);
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users);

    if (canAccessPlatform(context)) {
      const platformResults = await Promise.allSettled([
        getPlatformOrganisations(token),
        getPlatformAuditLogs(token, '?limit=12'),
        getPlatformSecurityEvents(token, '?limit=12')
      ]);
      const [orgsResult, platformAuditResult, platformSecurityResult] = platformResults;
      if (orgsResult.status === 'fulfilled') {
        setPlatformOrganisations(orgsResult.value.organisations);
        if (!selectedTenantId && orgsResult.value.organisations.length > 0) {
          setSelectedTenantId(getTenantId(orgsResult.value.organisations[0]));
        }
      }
      if (platformAuditResult.status === 'fulfilled') setPlatformAuditLogs(platformAuditResult.value.records);
      if (platformSecurityResult.status === 'fulfilled') setPlatformSecurityEvents(platformSecurityResult.value.records);
    }
  }

  async function authenticateExistingToken(token: string) {
    setLoading(true);
    try {
      const context = await getCurrentUser(token);
      setAuth(context);
      setWorkspace(canAccessPlatform(context) ? 'platform' : 'organisation');
      setView(canAccessPlatform(context) ? 'platform-dashboard' : 'org-dashboard');
      await refreshAll(token, context);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setAccessToken('');
      setAuth(null);
    } finally {
      setLoading(false);
    }
  }

  async function applyLoginResult(result: LoginResponse, successMessage?: string) {
    localStorage.setItem(STORAGE_KEY, result.access_token);
    setAccessToken(result.access_token);
    const context: AuthContext = {
      user: result.user,
      organisation: result.organisation,
      roles: result.roles,
      permission_keys: result.permission_keys,
      token_context: result.token_context
    };
    setAuth(context);
    const nextWorkspace = canAccessPlatform(context) ? 'platform' : 'organisation';
    setWorkspace(nextWorkspace);
    setView(nextWorkspace === 'platform' ? 'platform-dashboard' : 'org-dashboard');
    if (successMessage) {
      setNotice({ type: 'success', message: successMessage });
    }
    await refreshAll(result.access_token, context);
  }

  function clearSsoCallbackParams() {
    const url = new URL(window.location.href);
    for (const key of ['sso', 'code', 'expires_in', 'organisation_slug', 'message', 'return_to']) {
      url.searchParams.delete(key);
    }
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  async function completeSsoExchange(code: string) {
    const result = await runTask(() => exchangeSsoCode(code), 'Signed in with SSO.');
    if (result) {
      await applyLoginResult(result);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoStatus = params.get('sso');
    const ssoCode = params.get('code');
    const ssoMessage = params.get('message');
    const callbackOrganisationSlug = params.get('organisation_slug');

    if (callbackOrganisationSlug) {
      setOrganisationSlug(callbackOrganisationSlug);
    }

    if (ssoStatus) {
      clearSsoCallbackParams();
      if (ssoStatus === 'success' && ssoCode) {
        void completeSsoExchange(ssoCode);
        return;
      }
      setNotice({ type: 'error', message: ssoMessage || 'SSO login failed.' });
    }

    void refreshLoginConfig(DEFAULT_ORG);
    if (accessToken) {
      void authenticateExistingToken(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const result = await runTask(() => login(loginEmail.trim(), loginPassword, organisationSlug.trim()), 'Signed in successfully.');
    if (result) {
      await applyLoginResult(result);
    }
  }

  async function handleSsoStart() {
    const result = await runTask(() => startSsoLogin(organisationSlug.trim()));
    if (result?.authorization_url) {
      window.location.href = result.authorization_url;
    }
  }

  async function handleLogout() {
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken('');
    setAuth(null);
    setWorkspace('organisation');
    setView('org-dashboard');
    setNotice({ type: 'info', message: 'Signed out.' });
  }

  function switchWorkspace(nextWorkspace: Workspace) {
    if (nextWorkspace === 'platform' && !platformAllowed) {
      setNotice({ type: 'error', message: 'Your account does not have platform owner permissions.' });
      return;
    }
    setWorkspace(nextWorkspace);
    setView(nextWorkspace === 'platform' ? 'platform-dashboard' : 'org-dashboard');
  }

  async function refreshTenant360(tenantId = selectedTenantId) {
    if (!tenantId || !accessToken) {
      return;
    }

    setTenantLoading(true);
    setTenantPlan(null);
    setTenantUsers([]);
    setTenantAuditLogs([]);
    setTenantSecurityEvents([]);
    const [usersResult, planResult, auditResult, securityResult] = await Promise.allSettled([
      getOrganisationUsers(accessToken, tenantId, '?limit=100'),
      getPlatformOrganisationPlan(accessToken, tenantId),
      getPlatformOrganisationAuditLogs(accessToken, tenantId, '?limit=12'),
      getPlatformOrganisationSecurityEvents(accessToken, tenantId, '?limit=12')
    ]);

    if (usersResult.status === 'fulfilled') setTenantUsers(usersResult.value.users);
    if (planResult.status === 'fulfilled') setTenantPlan(planResult.value);
    if (auditResult.status === 'fulfilled') setTenantAuditLogs(auditResult.value.records);
    if (securityResult.status === 'fulfilled') setTenantSecurityEvents(securityResult.value.records);

    const failures = [usersResult, planResult, auditResult, securityResult].filter((result) => result.status === 'rejected').length;
    if (failures === 4) {
      setNotice({ type: 'error', message: 'Tenant details could not be loaded.' });
    }
    setTenantLoading(false);
  }

  useEffect(() => {
    if (view === 'platform-tenant-360' && selectedTenantId && accessToken) {
      void refreshTenant360(selectedTenantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedTenantId, accessToken]);

  function openTenant360(organisation: OrganisationSummary) {
    const tenantId = getTenantId(organisation);
    if (!tenantId) {
      setNotice({ type: 'error', message: 'This tenant is missing an organisation id.' });
      return;
    }
    setWorkspace('platform');
    setSelectedTenantId(tenantId);
    setTenantTab('overview');
    setView('platform-tenant-360');
  }

  function openPlanManagement(organisation: OrganisationSummary) {
    setSelectedPlanOrgId(getTenantId(organisation));
    setView('platform-plans');
  }

  function handleNavItem(item: NavItem) {
    if (item.disabled) {
      setNotice({ type: 'info', message: item.helper ?? 'This section will be enabled in a later slice.' });
      return;
    }
    if (item.view === 'platform-tenant-360' && !selectedTenantId && platformOrganisations[0]) {
      setSelectedTenantId(getTenantId(platformOrganisations[0]));
    }
    if (item.view === 'identity-roles') {
      setWorkspace('organisation');
      setView('org-access');
      return;
    }
    setView(item.view);
  }

  function toggleNavSection(sectionKey: string) {
    setExpandedNavSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  }

  async function saveBranding(event: FormEvent) {
    event.preventDefault();
    await runTask(async () => {
      const branding = await updateOrganisationBranding(accessToken, brandingForm);
      const themed = await updateOrganisationTheme(accessToken, themeForm);
      setBrandingData(themed ?? branding);
      return themed;
    }, 'Branding and theme saved.');
    await refreshAll();
  }

  async function saveSso(event: FormEvent) {
    event.preventDefault();
    await runTask(async () => {
      const response = await updateOrganisationSsoConfig(accessToken, ssoForm);
      setSsoConfigData(response);
      return response;
    }, 'SSO configuration saved.');
    await refreshAll();
  }

  async function validateSso() {
    await runTask(() => testOrganisationSsoConfig(accessToken), 'SSO configuration validation completed.');
  }

  async function saveMfa(event: FormEvent) {
    event.preventDefault();
    await runTask(async () => {
      const response = await updateOrganisationMfaPolicy(accessToken, mfaForm);
      setMfaData(response);
      return response;
    }, 'MFA policy saved.');
    await refreshAll();
  }

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    if (!organisationId) {
      setNotice({ type: 'error', message: 'Organisation id is missing from the current user context.' });
      return;
    }

    const payload = {
      email: userForm.email,
      first_name: userForm.firstName || undefined,
      last_name: userForm.lastName || undefined,
      display_name: userForm.displayName || undefined,
      password: userForm.password || undefined,
      role_ids: userForm.roleIds
    };

    await runTask(() => (userForm.userId ? updateOrganisationUser(accessToken, organisationId, userForm.userId, payload) : createOrganisationUser(accessToken, organisationId, payload)), userForm.userId ? 'User updated.' : 'User created.');
    setUserForm({ userId: '', email: '', displayName: '', firstName: '', lastName: '', password: '', roleIds: [] });
    await refreshAll();
  }

  async function setUserStatus(user: UserSummary, status: string) {
    if (!organisationId) return;
    await runTask(() => updateOrganisationUserStatus(accessToken, organisationId, user.id || user._id || '', status), `User marked as ${status}.`);
    await refreshAll();
  }

  async function createNewRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('role_name') ?? '').trim();
    const description = String(form.get('role_description') ?? '').trim();
    const permissionKeys = parseCsv(String(form.get('role_permissions') ?? ''));
    if (!name) {
      setNotice({ type: 'error', message: 'Role name is required.' });
      return;
    }
    await runTask(() => createRole(accessToken, { name, description, permission_keys: permissionKeys }), 'Role created.');
    event.currentTarget.reset();
    await refreshAll();
  }

  async function createToken(kind: 'personal' | 'organisation', event: FormEvent) {
    event.preventDefault();
    const form = kind === 'personal' ? personalTokenForm : organisationTokenForm;
    const payload = { token_name: form.tokenName, expires_in_days: form.expiresInDays, scopes: parseCsv(form.scopes) };
    const result = await runTask(() => (kind === 'personal' ? createPersonalAccessToken(accessToken, payload) : createOrganisationApiToken(accessToken, payload)), `${kind === 'personal' ? 'Personal access' : 'Organisation API'} token created.`);
    if (result) {
      setCreatedToken(result.access_token);
      await refreshAll();
    }
  }

  async function revokeToken(kind: 'personal' | 'organisation', tokenId: string) {
    await runTask(() => (kind === 'personal' ? revokePersonalAccessToken(accessToken, tokenId) : revokeOrganisationApiToken(accessToken, tokenId)), 'Token revoked.');
    await refreshAll();
  }

  async function createOrg(event: FormEvent) {
    event.preventDefault();
    await runTask(() => createPlatformOrganisation(accessToken, platformOrganisationForm), 'Organisation created.');
    setPlatformOrganisationForm({ name: '', slug: '', status: 'active' });
    await refreshAll();
  }

  async function changeOrgStatus(organisation: OrganisationSummary, status: string) {
    await runTask(() => updatePlatformOrganisationStatus(accessToken, organisation.id || organisation._id || '', status), `Organisation ${status}.`);
    await refreshAll();
    if (getTenantId(organisation) === selectedTenantId) {
      await refreshTenant360(selectedTenantId);
    }
  }

  async function savePlatformPlan(event: FormEvent) {
    event.preventDefault();
    const payload = {
      key: platformPlanForm.key,
      name: platformPlanForm.name,
      description: platformPlanForm.description,
      status: platformPlanForm.status,
      billing_mode: platformPlanForm.billingMode,
      features: parseJsonRecord(platformPlanForm.featuresJson, 'Features') as Record<string, boolean>,
      limits: parseJsonRecord(platformPlanForm.limitsJson, 'Limits'),
      is_custom: true
    };
    const existingPlan = planCatalogue?.plans.some((plan) => plan.key === platformPlanForm.key) ?? false;
    await runTask(() => (existingPlan ? updatePlatformPlan(accessToken, platformPlanForm.key, payload) : createPlatformPlan(accessToken, payload)), existingPlan ? 'Plan updated.' : 'Plan created.');
    await refreshAll();
  }

  async function assignPlan(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlanOrgId || !selectedPlanKey) {
      setNotice({ type: 'error', message: 'Select an organisation and a plan first.' });
      return;
    }
    await runTask(() => assignPlatformOrganisationPlan(accessToken, selectedPlanOrgId, { plan_key: selectedPlanKey, subscription_status: 'active', billing_mode: 'manual', apply_feature_defaults: true }), 'Plan assigned.');
    await refreshAll();
  }

  async function applyPlanDefaults() {
    if (!selectedPlanOrgId) {
      setNotice({ type: 'error', message: 'Select an organisation first.' });
      return;
    }
    await runTask(() => applyPlatformOrganisationPlanDefaults(accessToken, selectedPlanOrgId), 'Plan defaults applied.');
    await refreshAll();
  }

  if (!auth) {
    return (
      <main className="auth-layout" style={{ '--tenant-primary': activeTheme.primary_colour ?? activeBranding.primary_colour ?? '#2563eb', '--tenant-secondary': activeTheme.secondary_colour ?? activeBranding.secondary_colour ?? '#0f172a' } as React.CSSProperties}>
        <section className="auth-hero">
          <div className="auth-brandline">
            <div className="brand-mark">S</div>
            <strong>Saas Boiler</strong>
          </div>
          <h1>Launch a multi-tenant SaaS with the hard parts already wired.</h1>
          <p>Tenant branding, users, roles, SSO, MFA, API tokens, plans, audit logs, and platform operations in one production-minded starter.</p>
          <div className="auth-showcase" aria-label="Saas Boiler product preview">
            <div className="showcase-toolbar">
              <span>Workspace command center</span>
              <StatusBadge value="Ready" />
            </div>
            <div className="showcase-grid">
              <div><strong>{health?.status ?? 'OK'}</strong><span>API health</span></div>
              <div><strong>{ssoLoginEnabled ? 'On' : 'Ready'}</strong><span>SSO configured</span></div>
              <div><strong>{nativeLoginEnabled ? 'Open' : 'SSO'}</strong><span>Login policy</span></div>
            </div>
            <div className="showcase-table">
              <div><span>Users</span><strong>Roles scoped</strong></div>
              <div><span>Plans</span><strong>Professional plan</strong></div>
              <div><span>Security</span><strong>MFA policy</strong></div>
            </div>
          </div>
        </section>
        <section className="auth-panel">
          <div className="brand-lockup">
            {activeBranding.logo_url ? <img src={activeBranding.logo_url} alt="Organisation logo" /> : <div className="brand-mark">S</div>}
            <div>
              <h2>{activeBranding.login_title || loginConfig?.organisation.name || 'Sign in'}</h2>
              <p>{activeBranding.login_subtitle || 'Use your organisation account to continue.'}</p>
            </div>
          </div>
          {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}
          <form className="form-grid auth-form" onSubmit={handleLogin}>
            <TextField label="Organisation slug" value={organisationSlug} onChange={setOrganisationSlug} />
            <button type="button" className="button secondary" onClick={() => void refreshLoginConfig()} disabled={loading}>Load branding</button>
            {nativeLoginEnabled ? (
              <>
                <TextField label="Email" value={loginEmail} onChange={setLoginEmail} />
                <TextField label="Password" value={loginPassword} onChange={setLoginPassword} type="password" />
                <button className="button primary field-full" type="submit" disabled={loading}>{loading ? 'Working...' : 'Sign in'}</button>
              </>
            ) : <EmptyState title="Password login disabled" message="This organisation is configured to use SSO only." />}
            {ssoLoginEnabled ? <button type="button" className="button ghost field-full" onClick={() => void handleSsoStart()} disabled={loading}>Continue with SSO</button> : null}
          </form>
          <div className="auth-meta">
            <span>API: {apiBaseUrl}</span>
            <span>Support: {activeBranding.support_email || 'Not configured'}</span>
          </div>
        </section>
      </main>
    );
  }

  const orgNavSections: NavSection[] = [
    { key: 'overview', label: 'Overview', items: [{ view: 'org-dashboard', label: 'Workspace Home' }] },
    { key: 'identity', label: 'Identity', items: [{ view: 'org-users', label: 'Users' }, { view: 'org-access', label: 'Roles & Permissions' }, { view: 'org-identity', label: 'SSO & MFA' }] },
    { key: 'security', label: 'Security', items: [{ view: 'org-tokens', label: 'Tokens' }, { view: 'org-observability', label: 'Audit & Security' }] },
    { key: 'settings', label: 'Settings', items: [{ view: 'org-branding', label: 'Branding & Login' }, { view: 'org-files', label: 'Files & Assets' }, { view: 'org-developer', label: 'Developer' }] }
  ];
  const platformNavSections: NavSection[] = [
    { key: 'overview', label: 'Overview', items: [{ view: 'platform-dashboard', label: 'Operator Home' }] },
    { key: 'tenants', label: 'Tenants', items: [{ view: 'platform-organisations', label: 'Tenant List' }, { view: 'platform-tenant-360', label: 'Tenant 360', disabled: platformOrganisations.length === 0, helper: 'Create or seed a tenant first.' }] },
    { key: 'identity', label: 'Identity', items: [{ view: 'identity-sso', label: 'SSO Providers' }, { view: 'identity-mfa', label: 'MFA Policy' }, { view: 'org-access', label: 'Roles & Permissions' }] },
    { key: 'billing', label: 'Billing', items: [{ view: 'platform-plans', label: 'Plans & Entitlements' }] },
    { key: 'security', label: 'Security', items: [{ view: 'platform-security', label: 'Audit & Security' }] },
    { key: 'platform', label: 'Platform', items: [{ view: 'platform-system', label: 'System & Developer' }] },
    { key: 'settings', label: 'Settings', items: [{ view: 'org-branding', label: 'Branding & Login' }, { view: 'org-developer', label: 'Developer Tools' }] }
  ];
  const navSections = workspace === 'platform' ? platformNavSections : orgNavSections;
  const pageTitles: Record<View, string> = {
    'org-dashboard': 'Workspace Home',
    'org-users': 'Users',
    'org-access': 'Roles & Permissions',
    'org-branding': 'Branding & Login',
    'org-identity': 'SSO & MFA',
    'org-tokens': 'Tokens',
    'org-files': 'Files & Assets',
    'org-observability': 'Audit & Security',
    'org-developer': 'Developer',
    'platform-dashboard': 'Operator Home',
    'platform-organisations': 'Tenant List',
    'platform-tenant-360': selectedTenant ? `${selectedTenant.name} 360` : 'Tenant 360',
    'identity-sso': 'SSO Providers',
    'identity-mfa': 'MFA Policy',
    'identity-roles': 'Roles & Permissions',
    'platform-plans': 'Plans & Entitlements',
    'platform-security': 'Audit & Security',
    'platform-system': 'System & Developer'
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>Saas Boiler</strong>
            <span>v1.0.0</span>
          </div>
        </div>
        <div className="sidebar-context">
          <span>Tenant operations</span>
          <strong>{auth.organisation.slug}</strong>
        </div>
        <div className="workspace-switcher">
          <button className={workspace === 'organisation' ? 'active' : ''} onClick={() => switchWorkspace('organisation')}>Organisation</button>
          <button className={workspace === 'platform' ? 'active' : ''} onClick={() => switchWorkspace('platform')} disabled={!platformAllowed}>Platform</button>
        </div>
        <nav className="control-nav" aria-label="Application navigation">
          {navSections.map((section) => {
            const expanded = expandedNavSections[section.key] ?? true;
            return (
              <div className={`nav-section ${expanded ? 'expanded' : 'collapsed'}`} key={section.key}>
                <button className="nav-section-header" type="button" onClick={() => toggleNavSection(section.key)} aria-expanded={expanded}>
                  <span>{section.label}</span>
                  <span aria-hidden="true">{expanded ? '-' : '+'}</span>
                </button>
                {expanded ? (
                  <div className="nav-section-items">
                    {section.items.map((item) => {
                      const active = view === item.view || (item.view === 'org-access' && view === 'identity-roles') || (item.view === 'org-identity' && (view === 'identity-sso' || view === 'identity-mfa'));
                      return (
                        <button key={`${section.key}-${item.label}`} className={active ? 'active' : ''} type="button" onClick={() => handleNavItem(item)} disabled={item.disabled}>
                          <span>{item.label}</span>
                          {item.helper ? <small>{item.helper}</small> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>API health</span>
          <StatusBadge value={health?.status ?? 'unknown'} />
        </div>
      </aside>
      <section className="main-stage">
        <header className="topbar">
          <div>
            <span className="eyebrow">{workspace === 'platform' ? 'Platform owner' : auth.organisation.name}</span>
            <h1>{pageTitles[view]}</h1>
          </div>
          <div className="topbar-actions">
            <StatusBadge value={health?.status ?? 'unknown'} />
            <button className="button secondary" onClick={() => void refreshAll()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
            <button className="button ghost" onClick={() => void handleLogout()}>Logout</button>
          </div>
        </header>
        {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}
        {createdToken ? (
          <div className="notice warning">
            <strong>Copy this token now.</strong>
            <code>{createdToken}</code>
            <button className="button tiny" onClick={() => setCreatedToken(null)}>Hide</button>
          </div>
        ) : null}
        <div className="content-grid">{renderView()}</div>
      </section>
    </main>
  );

  function renderView() {
    switch (view) {
      case 'org-dashboard':
        return <OrganisationDashboard />;
      case 'org-users':
        return <OrganisationUsers />;
      case 'org-access':
        return <OrganisationAccess />;
      case 'org-branding':
        return <OrganisationBrandingScreen />;
      case 'org-identity':
        return <OrganisationIdentity />;
      case 'identity-sso':
        return <OrganisationIdentity focus="sso" />;
      case 'identity-mfa':
        return <OrganisationIdentity focus="mfa" />;
      case 'identity-roles':
        return <OrganisationAccess />;
      case 'org-tokens':
        return <OrganisationTokens />;
      case 'org-files':
        return <OrganisationFiles />;
      case 'org-observability':
        return <OrganisationObservability />;
      case 'org-developer':
        return <DeveloperScreen />;
      case 'platform-dashboard':
        return <PlatformDashboard />;
      case 'platform-organisations':
        return <PlatformOrganisations />;
      case 'platform-tenant-360':
        return <Tenant360 />;
      case 'platform-plans':
        return <PlatformPlans />;
      case 'platform-security':
        return <PlatformSecurity />;
      case 'platform-system':
        return <PlatformSystem />;
      default:
        return <OrganisationDashboard />;
    }
  }

  function OrganisationDashboard() {
    const enabledFeatures = organisationFeatures?.features.filter((feature) => feature.enabled).length ?? 0;
    const featureTotal = featureCatalogue?.features.length ?? 0;
    const featureProgress = featureTotal > 0 ? Math.round((enabledFeatures / featureTotal) * 100) : 0;
    return (
      <>
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">Tenant operations</span>
            <h2>Run {auth!.organisation.name} from one operational cockpit.</h2>
            <p>Manage users, identity policy, plan entitlements, tokens, files, and audit history without leaving the workspace.</p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => setView('org-users')}>Create user</button>
              <button className="button secondary" onClick={() => setView('org-identity')}>Review identity</button>
            </div>
          </div>
          <div className="hero-status-panel">
            <div className="panel-row">
              <span>Professional plan</span>
              <strong>{String(organisationPlan?.plan_assignment?.plan_key ?? 'No plan assigned')}</strong>
            </div>
            <div className="panel-row">
              <span>SSO configured</span>
              <StatusBadge value={ssoConfigData?.sso_config.enabled ?? false} />
            </div>
            <div className="panel-row">
              <span>MFA policy</span>
              <StatusBadge value={mfaData?.mfa_policy.enabled ?? false} />
            </div>
            <div className="progress-card">
              <div><span>Feature coverage</span><strong>{featureProgress}%</strong></div>
              <div className="progress-rail" style={{ '--progress': `${featureProgress}%` } as React.CSSProperties}><span /></div>
            </div>
          </div>
        </section>
        <div className="metric-grid">
          <MetricCard label="Users" value={users.length} hint="Current tenant users" />
          <MetricCard label="Enabled features" value={enabledFeatures} hint={`${featureTotal} available`} />
          <MetricCard label="SSO" value={ssoConfigData?.sso_config.enabled ? 'Enabled' : 'Disabled'} hint={ssoConfigData?.sso_config.provider ?? 'No provider'} />
          <MetricCard label="MFA" value={mfaData?.mfa_policy.enabled ? 'Enabled' : 'Disabled'} hint={mfaData?.mfa_policy.enforcement_mode ?? 'Policy not loaded'} />
        </div>
        <div className="two-column">
          <article className="card">
            <SectionHeader title="Organisation profile" description="Tenant identity and current entitlement summary." />
            <dl className="details-list">
              <div><dt>Name</dt><dd>{auth!.organisation.name}</dd></div>
              <div><dt>Slug</dt><dd>{auth!.organisation.slug}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge value={auth!.organisation.status} /></dd></div>
              <div><dt>Plan</dt><dd>{String(organisationPlan?.plan_assignment?.plan_key ?? 'No plan assigned')}</dd></div>
              <div><dt>Login method</dt><dd>{authConfig?.login_method ?? '-'}</dd></div>
            </dl>
          </article>
          <article className="card">
            <SectionHeader title="Recent security activity" description="Latest tenant security signals." />
            <DataTable
              rows={securityEvents.slice(0, 5)}
              emptyTitle="No security events"
              emptyMessage="Security events will appear after login or token activity."
              columns={[
                { label: 'Event', render: (row) => row.event_type },
                { label: 'Severity', render: (row) => <StatusBadge value={row.severity} tone={row.severity === 'critical' ? 'danger' : row.severity === 'high' ? 'warn' : 'neutral'} /> },
                { label: 'Date', render: (row) => formatDate(row.created_at ?? row.createdAt) }
              ]}
            />
          </article>
        </div>
        <div className="two-column">
          <article className="card activity-card">
            <SectionHeader title="Audit trail" description="Administrative activity across the tenant." />
            <AuditTable rows={auditLogs.slice(0, 5)} />
          </article>
          <article className="card activity-card">
            <SectionHeader title="Developer readiness" description="Health and API surfaces for integration work." />
            <dl className="details-list">
              <div><dt>API health</dt><dd><StatusBadge value={health?.status ?? 'Unknown'} /></dd></div>
              <div><dt>Readiness</dt><dd><StatusBadge value={readiness?.status ?? 'Unknown'} /></dd></div>
              <div><dt>API base</dt><dd>{apiBaseUrl.replace(/^https?:\/\//, '')}</dd></div>
              <div><dt>Files</dt><dd>{files.length} stored assets</dd></div>
            </dl>
          </article>
        </div>
      </>
    );
  }

  function OrganisationUsers() {
    return (
      <>
        <SectionHeader eyebrow="Identity & access" title="Users" description="Create and manage users for the current organisation only." />
        <article className="card">
          <form className="form-grid" onSubmit={submitUser}>
            <input type="hidden" value={userForm.userId} />
            <TextField label="Email" value={userForm.email} onChange={(value) => setUserForm({ ...userForm, email: value })} />
            <TextField label="Display name" value={userForm.displayName} onChange={(value) => setUserForm({ ...userForm, displayName: value })} />
            <TextField label="First name" value={userForm.firstName} onChange={(value) => setUserForm({ ...userForm, firstName: value })} />
            <TextField label="Last name" value={userForm.lastName} onChange={(value) => setUserForm({ ...userForm, lastName: value })} />
            <TextField label="Password" value={userForm.password} onChange={(value) => setUserForm({ ...userForm, password: value })} type="password" placeholder="Only required for native login/new users" />
            <label className="field">
              <span>Roles</span>
              <select multiple value={userForm.roleIds} onChange={(event) => setUserForm({ ...userForm, roleIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value) })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <button className="button primary" type="submit">{userForm.userId ? 'Update user' : 'Create user'}</button>
            {userForm.userId ? <button className="button secondary" type="button" onClick={() => setUserForm({ userId: '', email: '', displayName: '', firstName: '', lastName: '', password: '', roleIds: [] })}>Cancel edit</button> : null}
          </form>
        </article>
        <article className="card">
          <DataTable
            rows={users}
            emptyTitle="No users loaded"
            emptyMessage="Users will appear after seed data or tenant user creation."
            columns={[
              { label: 'User', render: (row) => <div><strong>{row.display_name}</strong><small>{row.email}</small></div> },
              { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { label: 'Roles', render: (row) => row.role_ids.length ? row.role_ids.map((roleId) => roles.find((role) => role.id === roleId)?.name ?? shortId(roleId)).join(', ') : '-' },
              { label: 'Created', render: (row) => formatDate(row.createdAt) },
              { label: 'Actions', render: (row) => <div className="row-actions"><button className="button tiny" onClick={() => setUserForm({ userId: row.id || row._id || '', email: row.email, displayName: row.display_name, firstName: row.first_name ?? '', lastName: row.last_name ?? '', password: '', roleIds: row.role_ids })}>Edit</button><button className="button tiny ghost" onClick={() => void setUserStatus(row, row.status === 'disabled' ? 'active' : 'disabled')}>{row.status === 'disabled' ? 'Activate' : 'Disable'}</button></div> }
            ]}
          />
        </article>
      </>
    );
  }

  function OrganisationAccess() {
    return (
      <>
        <SectionHeader eyebrow="Identity & access" title="Roles and permissions" description="View permission coverage and create simple tenant roles." />
        <div className="two-column">
          <article className="card">
            <SectionHeader title="Create role" description="Use comma-separated permission keys." />
            <form className="form-grid" onSubmit={createNewRole}>
              <label className="field"><span>Role name</span><input name="role_name" placeholder="operations-manager" /></label>
              <label className="field"><span>Description</span><input name="role_description" placeholder="Role purpose" /></label>
              <label className="field field-full"><span>Permission keys</span><input name="role_permissions" placeholder="users.view, audit.logs.view" /></label>
              <button className="button primary" type="submit">Create role</button>
            </form>
          </article>
          <article className="card">
            <SectionHeader title="Current token context" />
            <pre className="json-block">{jsonPreview(tokenContext)}</pre>
          </article>
        </div>
        <article className="card">
          <DataTable
            rows={roles}
            emptyTitle="No roles loaded"
            emptyMessage="Roles are loaded from the current organisation."
            columns={[
              { label: 'Role', render: (row) => <strong>{row.name}</strong> },
              { label: 'System', render: (row) => <StatusBadge value={row.is_system_role ? 'System' : 'Custom'} tone="neutral" /> },
              { label: 'Permissions', render: (row) => <span>{row.permission_keys.slice(0, 8).join(', ')}{row.permission_keys.length > 8 ? ` +${row.permission_keys.length - 8}` : ''}</span> }
            ]}
          />
        </article>
        <article className="card">
          <SectionHeader title="Permission catalogue" />
          <div className="pill-cloud">{permissions.map((permission) => <span key={permission.key}>{permission.key}</span>)}</div>
        </article>
      </>
    );
  }

  function OrganisationBrandingScreen() {
    return (
      <>
        <SectionHeader eyebrow="Tenant configuration" title="Branding and login customisation" description="Control the organisation's visual identity and login page copy." />
        <div className="two-column">
          <article className="card">
            <form className="form-grid" onSubmit={saveBranding}>
              <TextField label="Logo URL" value={brandingForm.logo_url ?? ''} onChange={(value) => setBrandingForm({ ...brandingForm, logo_url: value })} />
              <TextField label="Login background URL" value={brandingForm.login_background_url ?? ''} onChange={(value) => setBrandingForm({ ...brandingForm, login_background_url: value })} />
              <TextField label="Login title" value={brandingForm.login_title ?? ''} onChange={(value) => setBrandingForm({ ...brandingForm, login_title: value })} />
              <TextField label="Login subtitle" value={brandingForm.login_subtitle ?? ''} onChange={(value) => setBrandingForm({ ...brandingForm, login_subtitle: value })} />
              <TextField label="Support email" value={brandingForm.support_email ?? ''} onChange={(value) => setBrandingForm({ ...brandingForm, support_email: value })} />
              <TextField label="Primary colour" value={themeForm.primary_colour ?? ''} onChange={(value) => setThemeForm({ ...themeForm, primary_colour: value })} />
              <TextField label="Secondary colour" value={themeForm.secondary_colour ?? ''} onChange={(value) => setThemeForm({ ...themeForm, secondary_colour: value })} />
              <TextField label="Accent colour" value={themeForm.accent_colour ?? ''} onChange={(value) => setThemeForm({ ...themeForm, accent_colour: value })} />
              <button className="button primary" type="submit">Save branding</button>
            </form>
          </article>
          <article className="card preview-card" style={{ '--tenant-primary': themeForm.primary_colour ?? '#2563eb', '--tenant-secondary': themeForm.secondary_colour ?? '#0f172a' } as React.CSSProperties}>
            <span className="eyebrow">Live preview</span>
            <div className="preview-login">
              {brandingForm.logo_url ? <img src={brandingForm.logo_url} alt="Logo preview" /> : <div className="brand-mark">S</div>}
              <h3>{brandingForm.login_title}</h3>
              <p>{brandingForm.login_subtitle}</p>
              <button className="button primary">Sign in</button>
            </div>
          </article>
        </div>
      </>
    );
  }

  function OrganisationIdentity({ focus = 'sso' }: { focus?: IdentityFocus } = {}) {
    const ssoPanel = (
      <article className={`card settings-panel ${focus === 'sso' ? 'featured' : ''}`} key="sso">
        <SectionHeader title="SSO provider configuration" description="Connect the tenant to an OIDC provider and validate the saved configuration." action={<button className="button secondary" onClick={() => void validateSso()}>Test connection</button>} />
        <form className="form-grid" onSubmit={saveSso}>
          <CheckboxField label="Enable SSO" checked={ssoForm.enabled} onChange={(value) => setSsoForm({ ...ssoForm, enabled: value })} />
          <label className="field"><span>Provider</span><select value={ssoForm.provider ?? 'keycloak'} onChange={(event) => setSsoForm({ ...ssoForm, provider: event.target.value as OrganisationSsoConfig['provider'] })}><option value="keycloak">Keycloak</option><option value="azure_ad">Azure AD</option><option value="okta">Okta</option><option value="google">Google</option><option value="custom_oidc">Custom OIDC</option></select></label>
          <TextField label="Issuer URL" value={ssoForm.issuer_url ?? ''} onChange={(value) => setSsoForm({ ...ssoForm, issuer_url: value })} />
          <TextField label="Discovery URL" value={ssoForm.discovery_url ?? ''} onChange={(value) => setSsoForm({ ...ssoForm, discovery_url: value })} />
          <TextField label="Client ID" value={ssoForm.client_id ?? ''} onChange={(value) => setSsoForm({ ...ssoForm, client_id: value })} />
          <TextField label="Client secret reference" value={ssoForm.client_secret_ref ?? ''} onChange={(value) => setSsoForm({ ...ssoForm, client_secret_ref: value })} />
          <TextField label="Scopes" value={asArrayCsv(ssoForm.scopes)} onChange={(value) => setSsoForm({ ...ssoForm, scopes: parseCsv(value) })} />
          <CheckboxField label="PKCE enabled" checked={ssoForm.pkce_enabled} onChange={(value) => setSsoForm({ ...ssoForm, pkce_enabled: value })} />
          <CheckboxField label="Require verified email" checked={ssoForm.require_verified_email} onChange={(value) => setSsoForm({ ...ssoForm, require_verified_email: value })} />
          <button className="button primary" type="submit">Save SSO</button>
        </form>
      </article>
    );
    const mfaPanel = (
      <article className={`card settings-panel ${focus === 'mfa' ? 'featured' : ''}`} key="mfa">
        <SectionHeader title="MFA policy" description="Define where MFA is enforced and which roles or permissions require stronger assurance." />
        <form className="form-grid" onSubmit={saveMfa}>
          <CheckboxField label="Enable MFA policy" checked={mfaForm.enabled} onChange={(value) => setMfaForm({ ...mfaForm, enabled: value })} />
          <label className="field"><span>Provider</span><select value={mfaForm.provider} onChange={(event) => setMfaForm({ ...mfaForm, provider: event.target.value as MfaPolicy['provider'] })}><option value="none">None</option><option value="native">Native</option><option value="keycloak">Keycloak</option><option value="azure_ad">Azure AD</option><option value="okta">Okta</option><option value="custom_oidc">Custom OIDC</option></select></label>
          <label className="field"><span>Enforcement</span><select value={mfaForm.enforcement_mode} onChange={(event) => setMfaForm({ ...mfaForm, enforcement_mode: event.target.value as MfaPolicy['enforcement_mode'] })}><option value="disabled">Disabled</option><option value="app_checked">App checked</option><option value="idp_enforced">IdP enforced</option></select></label>
          <TextField label="Required roles" value={asArrayCsv(mfaForm.required_for_roles)} onChange={(value) => setMfaForm({ ...mfaForm, required_for_roles: parseCsv(value) })} />
          <TextField label="Required permissions" value={asArrayCsv(mfaForm.required_for_permissions)} onChange={(value) => setMfaForm({ ...mfaForm, required_for_permissions: parseCsv(value) })} />
          <button className="button primary" type="submit">Save MFA</button>
        </form>
      </article>
    );

    return (
      <>
        <SectionHeader eyebrow="Identity" title="SSO and MFA settings" description="Configure tenant-owned login controls with validation and clear policy status." />
        <section className="settings-layout">
          <aside className="settings-nav">
            <button className={focus === 'sso' ? 'active' : ''} type="button" onClick={() => setView('identity-sso')}>SSO Providers</button>
            <button className={focus === 'mfa' ? 'active' : ''} type="button" onClick={() => setView('identity-mfa')}>MFA Policy</button>
            <button type="button" onClick={() => setView('org-access')}>Roles & Permissions</button>
          </aside>
          <div className="settings-main">
            {focus === 'mfa' ? [mfaPanel, ssoPanel] : [ssoPanel, mfaPanel]}
          </div>
          <aside className="card settings-status">
            <SectionHeader title="Validation status" />
            <dl className="details-list">
              <div><dt>Login method</dt><dd>{authConfig?.login_method ?? 'mixed'}</dd></div>
              <div><dt>SSO provider</dt><dd>{ssoForm.provider ?? 'Not configured'}</dd></div>
              <div><dt>SSO validation</dt><dd><StatusBadge value={ssoConfigData?.validation.status ?? 'Not tested'} tone={ssoConfigData?.validation.valid ? 'good' : 'neutral'} /></dd></div>
              <div><dt>MFA policy</dt><dd><StatusBadge value={mfaForm.enabled} tone={mfaForm.enabled ? 'good' : 'neutral'} /></dd></div>
              <div><dt>Enforcement</dt><dd>{mfaForm.enforcement_mode}</dd></div>
            </dl>
            {ssoConfigData?.validation.errors.length ? <div className="notice error">{ssoConfigData.validation.errors.join(' ')}</div> : null}
            {mfaData?.operational_notes?.length ? <div className="notice info">{mfaData.operational_notes.join(' ')}</div> : null}
          </aside>
        </section>
      </>
    );
  }

  function OrganisationTokens() {
    const tokenColumns = (kind: 'personal' | 'organisation') => [
      { label: 'Name', render: (row: TokenRecord) => <strong>{row.token_name}</strong> },
      { label: 'Preview', render: (row: TokenRecord) => row.token_preview ?? '-' },
      { label: 'Status', render: (row: TokenRecord) => <StatusBadge value={row.status} /> },
      { label: 'Scopes', render: (row: TokenRecord) => row.scopes.join(', ') },
      { label: 'Expires', render: (row: TokenRecord) => formatDate(row.expires_at) },
      { label: 'Action', render: (row: TokenRecord) => <button className="button tiny ghost" onClick={() => void revokeToken(kind, row.id)}>Revoke</button> }
    ];
    return (
      <>
        <SectionHeader eyebrow="Security" title="Token management" description="Create and revoke personal access tokens and organisation API tokens. Raw values display once only." />
        <div className="two-column">
          <article className="card">
            <SectionHeader title="Create personal token" />
            <form className="form-grid" onSubmit={(event) => void createToken('personal', event)}>
              <TextField label="Token name" value={personalTokenForm.tokenName} onChange={(value) => setPersonalTokenForm({ ...personalTokenForm, tokenName: value })} />
              <TextField label="Expires in days" value={String(personalTokenForm.expiresInDays)} onChange={(value) => setPersonalTokenForm({ ...personalTokenForm, expiresInDays: Number(value) })} type="number" />
              <TextField label="Scopes" value={personalTokenForm.scopes} onChange={(value) => setPersonalTokenForm({ ...personalTokenForm, scopes: value })} />
              <button className="button primary" type="submit">Create token</button>
            </form>
          </article>
          <article className="card">
            <SectionHeader title="Create organisation API token" />
            <form className="form-grid" onSubmit={(event) => void createToken('organisation', event)}>
              <TextField label="Token name" value={organisationTokenForm.tokenName} onChange={(value) => setOrganisationTokenForm({ ...organisationTokenForm, tokenName: value })} />
              <TextField label="Expires in days" value={String(organisationTokenForm.expiresInDays)} onChange={(value) => setOrganisationTokenForm({ ...organisationTokenForm, expiresInDays: Number(value) })} type="number" />
              <TextField label="Scopes" value={organisationTokenForm.scopes} onChange={(value) => setOrganisationTokenForm({ ...organisationTokenForm, scopes: value })} />
              <button className="button primary" type="submit">Create token</button>
            </form>
          </article>
        </div>
        <article className="card"><SectionHeader title="Personal access tokens" /><DataTable rows={personalTokens} emptyTitle="No personal tokens" emptyMessage="Create a personal token for developer access." columns={tokenColumns('personal')} /></article>
        <article className="card"><SectionHeader title="Organisation API tokens" /><DataTable rows={organisationTokens} emptyTitle="No organisation tokens" emptyMessage="Create an organisation token for system-to-system integration." columns={tokenColumns('organisation')} /></article>
      </>
    );
  }

  function OrganisationFiles() {
    return (
      <>
        <SectionHeader eyebrow="Operations" title="Files and assets" description="View tenant files and branding-backed assets stored through the configured storage provider." />
        <article className="card">
          <DataTable
            rows={files}
            emptyTitle="No files found"
            emptyMessage="Uploaded assets and documents will appear here."
            columns={[
              { label: 'File', render: (row) => <div><strong>{row.original_file_name}</strong><small>{row.mime_type}</small></div> },
              { label: 'Size', render: (row) => `${row.size_mb} MB` },
              { label: 'Visibility', render: (row) => <StatusBadge value={row.visibility} tone="neutral" /> },
              { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { label: 'Created', render: (row) => formatDate(row.created_at) }
            ]}
          />
        </article>
      </>
    );
  }

  function OrganisationObservability() {
    return (
      <>
        <SectionHeader eyebrow="Operations" title="Audit logs and security events" description="Tenant-scoped observability for administrative and security-sensitive activity." />
        <article className="card"><SectionHeader title="Audit logs" /><AuditTable rows={auditLogs} /></article>
        <article className="card"><SectionHeader title="Security events" /><SecurityTable rows={securityEvents} /></article>
      </>
    );
  }

  function DeveloperScreen() {
    return (
      <>
        <SectionHeader eyebrow="Developer" title="API and runtime context" description="Runtime health, OpenAPI and current authenticated context." />
        <div className="metric-grid">
          <MetricCard label="API version" value={health?.version ?? '1.0.0'} />
          <MetricCard label="Health" value={health?.status ?? 'Unknown'} />
          <MetricCard label="Readiness" value={readiness?.status ?? 'Unknown'} />
          <MetricCard label="API base" value={apiBaseUrl.replace(/^https?:\/\//, '')} />
        </div>
        <div className="two-column">
          <article className="card"><SectionHeader title="OpenAPI" /><div className="link-list"><a href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">Swagger UI</a><a href={`${apiBaseUrl}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI JSON</a></div></article>
          <article className="card"><SectionHeader title="Auth context" /><pre className="json-block">{jsonPreview({ user: auth!.user.email, organisation: auth!.organisation.slug, roles: auth!.roles.map((role) => role.name), permissions: auth!.permission_keys })}</pre></article>
        </div>
      </>
    );
  }

  function PlatformDashboard() {
    const activeOrgs = platformOrganisations.filter((organisation) => organisation.status === 'active').length;
    const suspendedOrgs = platformOrganisations.filter((organisation) => organisation.status === 'suspended').length;
    const highSecurityEvents = platformSecurityEvents.filter((event) => ['critical', 'high'].includes(event.severity)).length;
    return (
      <>
        <section className="dashboard-hero platform">
          <div>
            <span className="eyebrow">Operator Home</span>
            <h2>Run the platform from a calm control surface.</h2>
            <p>Track readiness, tenants, security activity, and the handful of things that need a human decision today.</p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => setView('platform-organisations')}>Create tenant</button>
              <button className="button secondary" onClick={() => selectedTenant ? openTenant360(selectedTenant) : setView('platform-organisations')} disabled={!selectedTenant}>Open Tenant 360</button>
              <button className="button ghost" onClick={() => setView('identity-sso')}>Review identity</button>
            </div>
          </div>
          <div className="hero-status-panel">
            <div className="panel-row">
              <span>Active tenants</span>
              <strong>{activeOrgs}</strong>
            </div>
            <div className="panel-row">
              <span>API health</span>
              <StatusBadge value={health?.status ?? 'Unknown'} />
            </div>
            <div className="panel-row">
              <span>Readiness</span>
              <StatusBadge value={readiness?.status ?? 'Unknown'} />
            </div>
            <div className="readiness-strip">
              <div><span>Suspended</span><strong>{suspendedOrgs}</strong></div>
              <div><span>Security signals</span><strong>{highSecurityEvents}</strong></div>
            </div>
          </div>
        </section>
        <div className="metric-grid">
          <MetricCard label="Organisations" value={platformOrganisations.length} />
          <MetricCard label="Active tenants" value={activeOrgs} />
          <MetricCard label="Suspended tenants" value={suspendedOrgs} />
          <MetricCard label="Plans" value={planCatalogue?.plans.length ?? 0} />
        </div>
        <div className="operator-grid">
          <article className="card attention-card">
            <SectionHeader title="Needs attention" description="Derived from readiness, tenant status, and high-severity platform security events." />
            {attentionItems.length ? (
              <div className="attention-list">
                {attentionItems.map((item) => <div key={item}><StatusBadge value="Review" tone="warn" /><span>{item}</span></div>)}
              </div>
            ) : <EmptyState title="No urgent items" message="Readiness and tenant status look clear from the available platform signals." />}
          </article>
          <article className="card activity-card">
            <SectionHeader title="Recent platform activity" action={<button className="button tiny ghost" onClick={() => setView('platform-security')}>View all</button>} />
            {platformAuditLogs.length ? (
              <div className="activity-list">
                {platformAuditLogs.slice(0, 6).map((record) => (
                  <div key={record.id} className="activity-row">
                    <span>{record.action}</span>
                    <strong>{record.resource_type}</strong>
                    <small>{formatDate(record.created_at ?? record.createdAt)}</small>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No recent activity" message="Platform audit events will appear after administrative actions." />}
          </article>
          <article className="card quick-actions-card">
            <SectionHeader title="Quick actions" />
            <div className="quick-actions">
              <button className="button primary" onClick={() => setView('platform-organisations')}>Create tenant</button>
              <button className="button secondary" onClick={() => setView('platform-plans')}>Manage plans</button>
              <button className="button secondary" onClick={() => setView('identity-mfa')}>Review MFA policy</button>
              <button className="button ghost" onClick={() => setView('platform-system')}>Open system view</button>
            </div>
          </article>
          <article className="card">
            <SectionHeader title="Readiness detail" />
            <dl className="details-list">
              <div><dt>API health</dt><dd><StatusBadge value={health?.status ?? 'Unknown'} /></dd></div>
              <div><dt>Readiness</dt><dd><StatusBadge value={readiness?.status ?? 'Unknown'} /></dd></div>
              <div><dt>API base</dt><dd>{apiBaseUrl.replace(/^https?:\/\//, '')}</dd></div>
              <div><dt>Security events</dt><dd>{platformSecurityEvents.length}</dd></div>
            </dl>
          </article>
        </div>
      </>
    );
  }

  function PlatformOrganisations() {
    return (
      <>
        <SectionHeader eyebrow="Tenants" title="Tenant List" description="Search, create, activate, suspend, and open Tenant 360 from one calm list." action={<button className="button secondary" onClick={() => setTenantSearch('')}>Clear search</button>} />
        <article className="card tenant-create-card">
          <SectionHeader title="Create tenant" description="Creates a platform organisation using the existing backend route." />
          <form className="form-grid" onSubmit={createOrg}>
            <TextField label="Organisation name" value={platformOrganisationForm.name} onChange={(value) => setPlatformOrganisationForm({ ...platformOrganisationForm, name: value })} />
            <TextField label="Slug" value={platformOrganisationForm.slug} onChange={(value) => setPlatformOrganisationForm({ ...platformOrganisationForm, slug: value })} />
            <label className="field"><span>Status</span><select value={platformOrganisationForm.status} onChange={(event) => setPlatformOrganisationForm({ ...platformOrganisationForm, status: event.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
            <button className="button primary" type="submit">Create tenant</button>
          </form>
        </article>
        <article className="card">
          <div className="tenant-list-toolbar">
            <TextField label="Search tenants" value={tenantSearch} onChange={setTenantSearch} placeholder="Name, slug, status, or plan" />
            <div className="tenant-list-summary">
              <strong>{filteredTenants.length}</strong>
              <span>shown of {platformOrganisations.length}</span>
            </div>
          </div>
          <DataTable
            rows={filteredTenants}
            emptyTitle="No organisations"
            emptyMessage="Seed, create, or adjust the search to find tenants."
            columns={[
              { label: 'Organisation', render: (row) => <div><strong>{row.name}</strong><small>{row.slug}</small></div> },
              { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { label: 'Plan', render: (row) => readPlanKey(row) },
              { label: 'Health', render: (row) => {
                const healthStatus = deriveTenantHealth(row, platformSecurityEvents.filter((event) => event.organisation_id === getTenantId(row)));
                return <StatusBadge value={healthStatus.label} tone={healthStatus.tone} />;
              } },
              { label: 'ID', render: (row) => shortId(getTenantId(row)) },
              { label: 'Actions', render: (row) => <div className="row-actions"><button className="button tiny" onClick={() => openTenant360(row)}>Open 360</button><button className="button tiny ghost" onClick={() => openPlanManagement(row)}>Assign plan</button><button className="button tiny ghost" onClick={() => void changeOrgStatus(row, row.status === 'suspended' ? 'active' : 'suspended')}>{row.status === 'suspended' ? 'Activate' : 'Suspend'}</button></div> }
            ]}
          />
        </article>
      </>
    );
  }

  function Tenant360() {
    const tenant = selectedTenant;
    const healthStatus = deriveTenantHealth(tenant, tenantSecurityEvents);
    const identityStatus = deriveIdentityStatus(tenant);
    const planName = readPlanName(tenantPlan) !== 'Unassigned' ? readPlanName(tenantPlan) : tenant ? readPlanKey(tenant) : 'Unassigned';

    if (!tenant) {
      return (
        <article className="card">
          <EmptyState title="Select a tenant" message="Open a tenant from Tenant List to load plan, users, audit, and security context." />
          <div className="hero-actions"><button className="button primary" onClick={() => setView('platform-organisations')}>Go to Tenant List</button></div>
        </article>
      );
    }

    return (
      <>
        <section className="tenant-hero">
          <div>
            <span className="eyebrow">Tenant 360</span>
            <h2>{tenant.name}</h2>
            <p>{tenant.slug} / {shortId(getTenantId(tenant))}</p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => void changeOrgStatus(tenant, tenant.status === 'suspended' ? 'active' : 'suspended')}>{tenant.status === 'suspended' ? 'Reactivate tenant' : 'Suspend tenant'}</button>
              <button className="button secondary" onClick={() => openPlanManagement(tenant)}>Manage billing</button>
              <button className="button ghost" disabled>Impersonation later</button>
              <button className="button ghost" disabled>Reset MFA later</button>
            </div>
          </div>
          <div className="tenant-hero-panel">
            <label className="field">
              <span>Selected tenant</span>
              <select value={selectedTenantId} onChange={(event) => { setSelectedTenantId(event.target.value); setTenantTab('overview'); }}>
                {platformOrganisations.map((organisation) => <option key={getTenantId(organisation)} value={getTenantId(organisation)}>{organisation.name}</option>)}
              </select>
            </label>
            <div className="tenant-status-grid">
              <div><span>Status</span><StatusBadge value={tenant.status} /></div>
              <div><span>Health</span><StatusBadge value={healthStatus.label} tone={healthStatus.tone} /></div>
              <div><span>Plan</span><strong>{planName}</strong></div>
              <div><span>Identity</span><StatusBadge value={identityStatus.label} tone={identityStatus.tone} /></div>
            </div>
          </div>
        </section>

        <div className="tenant-tabs" role="tablist" aria-label="Tenant 360 sections">
          {(['overview', 'users', 'security', 'billing'] as TenantTab[]).map((tab) => (
            <button key={tab} className={tenantTab === tab ? 'active' : ''} type="button" onClick={() => setTenantTab(tab)}>
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {tenantLoading ? <div className="notice info">Loading tenant data...</div> : null}

        {tenantTab === 'overview' ? (
          <>
            <div className="metric-grid tenant-metric-grid">
              <MetricCard label="Tenant health" value={healthStatus.label} hint={tenant.status} />
              <MetricCard label="Users" value={tenantUsers.length} hint="Tenant-scoped API read" />
              <MetricCard label="Plan" value={planName} hint={readBillingMode(tenantPlan)} />
              <MetricCard label="Security events" value={tenantSecurityEvents.length} hint="Recent tenant signals" />
            </div>
            <div className="tenant-overview-grid">
              <article className="card">
                <SectionHeader title="Plan and usage" description="Backed by the tenant plan assignment endpoint." />
                <dl className="details-list">
                  <div><dt>Plan</dt><dd>{planName}</dd></div>
                  <div><dt>Billing mode</dt><dd>{readBillingMode(tenantPlan)}</dd></div>
                  <div><dt>Subscription</dt><dd>{tenantPlan?.plan_assignment?.subscription_status ?? 'Not configured'}</dd></div>
                  <div><dt>Features</dt><dd>{countPlanFeatures(tenantPlan)}</dd></div>
                  <div><dt>Limits</dt><dd>{countPlanLimits(tenantPlan)}</dd></div>
                </dl>
              </article>
              <article className="card">
                <SectionHeader title="Identity status" description="Derived from tenant auth and MFA configuration where available." />
                <dl className="details-list">
                  <div><dt>Posture</dt><dd><StatusBadge value={identityStatus.label} tone={identityStatus.tone} /></dd></div>
                  <div><dt>SSO enforced</dt><dd>{String(Boolean(tenant.auth_config?.enforce_sso || tenant.auth_config?.sso_enabled))}</dd></div>
                  <div><dt>MFA enforced</dt><dd>{String(Boolean(tenant.mfa_config?.enabled || tenant.auth_config?.enforce_mfa))}</dd></div>
                  <div><dt>Provider</dt><dd>{String(tenant.auth_config?.provider ?? 'Native or not configured')}</dd></div>
                </dl>
              </article>
              <article className="card">
                <SectionHeader title="Recent security" action={<button className="button tiny ghost" onClick={() => setTenantTab('security')}>Open security</button>} />
                {tenantSecurityEvents.length ? (
                  <div className="activity-list">
                    {tenantSecurityEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="activity-row">
                        <span>{event.event_type}</span>
                        <StatusBadge value={event.severity} tone={eventTone(event.severity)} />
                        <small>{formatDate(event.created_at ?? event.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="No recent security events" message="Tenant security events will appear here when available." />}
              </article>
              <article className="card support-card">
                <SectionHeader title="Support notes" description="Placeholder for a later support case or customer-success integration." />
                <EmptyState title="Support notes later" message="No support notes backend exists yet, so this action is intentionally disabled." />
                <button className="button ghost" disabled>Add note later</button>
              </article>
            </div>
          </>
        ) : null}

        {tenantTab === 'users' ? (
          <article className="card">
            <SectionHeader title="Tenant users" description="Read from the existing platform tenant users endpoint." />
            <DataTable
              rows={tenantUsers}
              emptyTitle="No users"
              emptyMessage="Tenant users will appear after creation or invitation."
              columns={[
                { label: 'User', render: (row) => <div><strong>{row.display_name || row.email}</strong><small>{row.email}</small></div> },
                { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { label: 'Roles', render: (row) => row.role_ids.length },
                { label: 'Created', render: (row) => formatDate(row.createdAt) }
              ]}
            />
          </article>
        ) : null}

        {tenantTab === 'security' ? (
          <div className="two-column">
            <article className="card"><SectionHeader title="Tenant audit logs" /><AuditTable rows={tenantAuditLogs} /></article>
            <article className="card"><SectionHeader title="Tenant security events" /><SecurityTable rows={tenantSecurityEvents} /></article>
          </div>
        ) : null}

        {tenantTab === 'billing' ? (
          <div className="two-column">
            <article className="card">
              <SectionHeader title="Billing and plan" description="Current plan assignment and feature summary from the platform plan endpoint." action={<button className="button secondary" onClick={() => openPlanManagement(tenant)}>Manage plan</button>} />
              <dl className="details-list">
                <div><dt>Plan</dt><dd>{planName}</dd></div>
                <div><dt>Billing mode</dt><dd>{readBillingMode(tenantPlan)}</dd></div>
                <div><dt>Subscription</dt><dd>{tenantPlan?.plan_assignment?.subscription_status ?? 'Not configured'}</dd></div>
                <div><dt>Assigned</dt><dd>{formatDate(tenantPlan?.plan_assignment?.assigned_at)}</dd></div>
              </dl>
            </article>
            <article className="card">
              <SectionHeader title="Plan payload" description="Raw plan details for development visibility." />
              <pre className="json-block">{jsonPreview(tenantPlan?.plan ?? {})}</pre>
            </article>
          </div>
        ) : null}
      </>
    );
  }

  function PlatformPlans() {
    return (
      <>
        <SectionHeader eyebrow="Tenant management" title="Plans and entitlements" description="Manage the global plan catalogue and assign plans to organisations." />
        <div className="two-column">
          <article className="card">
            <SectionHeader title="Assign plan" />
            <form className="form-grid" onSubmit={assignPlan}>
              <label className="field"><span>Organisation</span><select value={selectedPlanOrgId} onChange={(event) => setSelectedPlanOrgId(event.target.value)}><option value="">Select organisation</option>{platformOrganisations.map((org) => <option key={org.id || org._id} value={org.id || org._id}>{org.name}</option>)}</select></label>
              <label className="field"><span>Plan</span><select value={selectedPlanKey} onChange={(event) => setSelectedPlanKey(event.target.value)}><option value="">Select plan</option>{planCatalogue?.plans.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}</select></label>
              <button className="button primary" type="submit">Assign selected plan</button>
              <button className="button secondary" type="button" onClick={() => void applyPlanDefaults()}>Apply defaults</button>
            </form>
          </article>
          <article className="card">
            <SectionHeader title="Create or update plan" />
            <form className="form-grid" onSubmit={savePlatformPlan}>
              <TextField label="Key" value={platformPlanForm.key} onChange={(value) => setPlatformPlanForm({ ...platformPlanForm, key: value })} />
              <TextField label="Name" value={platformPlanForm.name} onChange={(value) => setPlatformPlanForm({ ...platformPlanForm, name: value })} />
              <TextField label="Description" value={platformPlanForm.description} onChange={(value) => setPlatformPlanForm({ ...platformPlanForm, description: value })} />
              <TextAreaField label="Features JSON" value={platformPlanForm.featuresJson} onChange={(value) => setPlatformPlanForm({ ...platformPlanForm, featuresJson: value })} />
              <TextAreaField label="Limits JSON" value={platformPlanForm.limitsJson} onChange={(value) => setPlatformPlanForm({ ...platformPlanForm, limitsJson: value })} />
              <button className="button primary" type="submit">Save plan</button>
            </form>
          </article>
        </div>
        <article className="card">
          <DataTable
            rows={planCatalogue?.plans ?? []}
            emptyTitle="No plans"
            emptyMessage="Plans will appear after seeding or creation."
            columns={[
              { label: 'Plan', render: (row) => <div><strong>{row.name}</strong><small>{row.key}</small></div> },
              { label: 'Status', render: (row) => <StatusBadge value={row.status ?? 'active'} /> },
              { label: 'Billing', render: (row) => row.billing_mode ?? '-' },
              { label: 'Features', render: (row) => Object.keys(row.features ?? {}).length },
              { label: 'Limits', render: (row) => Object.keys(row.limits ?? {}).length }
            ]}
          />
        </article>
      </>
    );
  }

  function PlatformSecurity() {
    return (
      <>
        <SectionHeader eyebrow="Security" title="Cross-tenant audit and security" description="Platform owner visibility across all organisations." />
        <article className="card"><SectionHeader title="Platform audit logs" /><AuditTable rows={platformAuditLogs} /></article>
        <article className="card"><SectionHeader title="Platform security events" /><SecurityTable rows={platformSecurityEvents} /></article>
      </>
    );
  }

  function PlatformSystem() {
    return (
      <>
        <DeveloperScreen />
        <article className="card"><SectionHeader title="Platform permission checks" /><div className="pill-cloud">{['organisations.platform.view', 'organisations.platform.manage', 'plans.platform.manage', 'audit.platform.view', 'security.events.platform.view'].map((permission) => <span key={permission} className={hasPermission(auth, permission) ? 'granted' : ''}>{permission}</span>)}</div></article>
      </>
    );
  }
}

function AuditTable({ rows }: { rows: AuditLogRecord[] }) {
  return (
    <DataTable
      rows={rows}
      emptyTitle="No audit records"
      emptyMessage="Audit records will appear after administrative actions."
      columns={[
        { label: 'Action', render: (row) => row.action },
        { label: 'Resource', render: (row) => `${row.resource_type} ${shortId(row.resource_id ?? '')}` },
        { label: 'Actor', render: (row) => shortId(row.actor_user_id ?? '') },
        { label: 'Date', render: (row) => formatDate(row.created_at ?? row.createdAt) }
      ]}
    />
  );
}

function SecurityTable({ rows }: { rows: SecurityEventRecord[] }) {
  return (
    <DataTable
      rows={rows}
      emptyTitle="No security events"
      emptyMessage="Security events will appear after login, token or SSO activity."
      columns={[
        { label: 'Event', render: (row) => row.event_type },
        { label: 'Severity', render: (row) => <StatusBadge value={row.severity} tone={row.severity === 'critical' ? 'danger' : row.severity === 'high' ? 'warn' : 'neutral'} /> },
        { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        { label: 'IP', render: (row) => row.ip_address ?? '-' },
        { label: 'Date', render: (row) => formatDate(row.created_at ?? row.createdAt) }
      ]}
    />
  );
}
