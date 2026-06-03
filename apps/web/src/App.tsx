import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPlatformOrganisation,
  getApiBaseUrl,
  getCurrentUser,
  getFeatureCatalogue,
  getHealth,
  getOrganisationAuditLogs,
  getOrganisationFeatures,
  getOrganisationMfaPolicy,
  getOrganisationPlan,
  getOrganisationSecurityEvents,
  getOrganisationSsoConfig,
  getOrganisationUsers,
  getPlanCatalogue,
  getPlatformOrganisations,
  getPublicLoginConfig,
  getReadiness,
  login,
  logout,
  updatePlatformOrganisationStatus,
  type AuditLogRecord,
  type AuthContext,
  type FeatureCatalogueResponse,
  type HealthResponse,
  type LoginResponse,
  type OrganisationFeaturesResponse,
  type OrganisationMfaPolicyResponse,
  type OrganisationPlanResponse,
  type OrganisationSsoConfigResponse,
  type OrganisationSummary,
  type PlanCatalogueResponse,
  type PublicLoginConfig,
  type SecurityEventRecord,
  type UserSummary
} from './services/api';

const STORAGE_KEY = 'saas_boilerplate_access_token_v0200';
const DEFAULT_ORG = 'demo-organisation';
const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_PASSWORD = 'ChangeMe123!';

type View = 'overview' | 'workspaces' | 'settings';
type SettingsSection = 'access' | 'users' | 'billing' | 'integrations' | 'security' | 'organisation';
type Notice = { type: 'success' | 'error' | 'info'; message: string };
type WorkspaceForm = { name: string; slug: string };

const navItems: Array<{ view: View; label: string; description: string }> = [
  { view: 'overview', label: 'Home', description: 'Console overview' },
  { view: 'workspaces', label: 'Workspaces', description: 'Apps and tenants' },
  { view: 'settings', label: 'Settings', description: 'Admin and billing' }
];

const settingsSections: Array<{ section: SettingsSection; label: string; description: string }> = [
  { section: 'access', label: 'Access Management', description: 'SSO, MFA, roles, and authentication posture' },
  { section: 'users', label: 'User Management', description: 'Team members and role assignments' },
  { section: 'billing', label: 'Billing', description: 'Plans, subscriptions, and entitlements' },
  { section: 'integrations', label: 'Integrations', description: 'API tokens, storage, webhooks, and analytics' },
  { section: 'security', label: 'Security', description: 'Audit logs and security events' },
  { section: 'organisation', label: 'Organisation', description: 'Tenant profile, API base, and feature flags' }
];

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function shortId(value = '', start = 8, end = 5): string {
  return value.length > start + end + 4 ? `${value.slice(0, start)}...${value.slice(-end)}` : value || '-';
}

function orgId(organisation?: OrganisationSummary | null): string {
  return organisation?.id || organisation?._id || '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function canUsePlatform(auth: AuthContext | null): boolean {
  if (!auth) return false;
  const permissionHit = auth.permission_keys.some((permission) => permission.startsWith('platform.') || permission.includes('.platform.'));
  const roleHit = auth.roles.some((role) => role.name.toLowerCase().includes('platform'));
  return permissionHit || roleHit;
}

function readString(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readPlanName(plan: OrganisationPlanResponse | null): string {
  return readString(plan?.plan?.name, readString(plan?.plan?.key, readString(plan?.plan_assignment?.plan_key, 'No plan assigned')));
}

function statusTone(value?: string | boolean | null): 'good' | 'warn' | 'danger' | 'neutral' {
  const label = String(value ?? '').toLowerCase();
  if (value === true || label.includes('active') || label.includes('ready') || label.includes('ok') || label.includes('enabled')) return 'good';
  if (label.includes('warning') || label.includes('pending') || label.includes('invited') || label.includes('medium')) return 'warn';
  if (value === false || label.includes('suspended') || label.includes('disabled') || label.includes('failed') || label.includes('critical') || label.includes('high')) return 'danger';
  return 'neutral';
}

function StatusBadge({ value, tone }: { value: string | boolean | undefined | null; tone?: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const label = typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value || 'Unknown';
  return <span className={`status-badge ${tone ?? statusTone(value)}`}>{label}</span>;
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </header>
  );
}

function MetricCard({ label, value, hint, tone = 'blue' }: { label: string; value: string | number; hint?: string; tone?: 'blue' | 'green' | 'orange' | 'dark' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
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

function DataTable<T>({ rows, columns, emptyTitle, emptyMessage }: { rows: T[]; columns: Array<{ label: string; render: (row: T) => React.ReactNode }>; emptyTitle: string; emptyMessage: string }) {
  if (!rows.length) return <EmptyState title={emptyTitle} message={emptyMessage} />;

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
  const [view, setView] = useState<View>('overview');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [organisationSlug, setOrganisationSlug] = useState(DEFAULT_ORG);
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [loginConfig, setLoginConfig] = useState<PublicLoginConfig | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [readiness, setReadiness] = useState<HealthResponse | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<OrganisationSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [organisationPlan, setOrganisationPlan] = useState<OrganisationPlanResponse | null>(null);
  const [planCatalogue, setPlanCatalogue] = useState<PlanCatalogueResponse | null>(null);
  const [featureCatalogue, setFeatureCatalogue] = useState<FeatureCatalogueResponse | null>(null);
  const [organisationFeatures, setOrganisationFeatures] = useState<OrganisationFeaturesResponse | null>(null);
  const [ssoConfig, setSsoConfig] = useState<OrganisationSsoConfigResponse | null>(null);
  const [mfaPolicy, setMfaPolicy] = useState<OrganisationMfaPolicyResponse | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceForm>({ name: '', slug: '' });
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('access');

  const platformAllowed = canUsePlatform(auth);
  const currentOrganisationId = orgId(auth?.organisation);
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const enabledFeatures = organisationFeatures?.features.filter((feature) => feature.enabled).length ?? 0;
  const recentSecurity = securityEvents.slice(0, 6);
  const recentAudit = auditLogs.slice(0, 6);
  const filteredWorkspaces = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) => [workspace.name, workspace.slug, workspace.status].some((value) => value.toLowerCase().includes(query)));
  }, [workspaceSearch, workspaces]);

  async function runTask<T>(task: () => Promise<T>, successMessage?: string): Promise<T | null> {
    setLoading(true);
    setNotice(null);
    try {
      const result = await task();
      if (successMessage) setNotice({ type: 'success', message: successMessage });
      return result;
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error) });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function refreshLoginConfig(identifier = organisationSlug) {
    if (!identifier.trim()) return;
    const result = await runTask(() => getPublicLoginConfig(identifier.trim()));
    if (result) setLoginConfig(result);
  }

  async function refreshApp(token = accessToken, context = auth) {
    if (!token || !context) return;

    const organisationId = orgId(context.organisation);
    const results = await Promise.allSettled([
      getHealth(),
      getReadiness(),
      organisationId ? getOrganisationUsers(token, organisationId, '?limit=100') : Promise.resolve({ users: [] }),
      getOrganisationAuditLogs(token, '?limit=20'),
      getOrganisationSecurityEvents(token, '?limit=20'),
      getOrganisationPlan(token),
      getPlanCatalogue(token),
      getFeatureCatalogue(token),
      getOrganisationFeatures(token),
      getOrganisationSsoConfig(token),
      getOrganisationMfaPolicy(token),
      platformAllowed ? getPlatformOrganisations(token) : Promise.resolve({ organisations: [context.organisation] })
    ]);

    const [healthResult, readinessResult, usersResult, auditResult, securityResult, planResult, planCatalogueResult, featureCatalogueResult, organisationFeaturesResult, ssoResult, mfaResult, workspaceResult] = results;

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (readinessResult.status === 'fulfilled') setReadiness(readinessResult.value);
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users);
    if (auditResult.status === 'fulfilled') setAuditLogs(auditResult.value.records);
    if (securityResult.status === 'fulfilled') setSecurityEvents(securityResult.value.records);
    if (planResult.status === 'fulfilled') setOrganisationPlan(planResult.value);
    if (planCatalogueResult.status === 'fulfilled') setPlanCatalogue(planCatalogueResult.value);
    if (featureCatalogueResult.status === 'fulfilled') setFeatureCatalogue(featureCatalogueResult.value);
    if (organisationFeaturesResult.status === 'fulfilled') setOrganisationFeatures(organisationFeaturesResult.value);
    if (ssoResult.status === 'fulfilled') setSsoConfig(ssoResult.value);
    if (mfaResult.status === 'fulfilled') setMfaPolicy(mfaResult.value);
    if (workspaceResult.status === 'fulfilled') setWorkspaces(workspaceResult.value.organisations);
  }

  async function authenticateExistingToken(token: string) {
    setLoading(true);
    try {
      const context = await getCurrentUser(token);
      setAuth(context);
      await refreshApp(token, context);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setAccessToken('');
      setAuth(null);
    } finally {
      setLoading(false);
    }
  }

  async function applyLoginResult(result: LoginResponse) {
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
    setView('overview');
    setNotice({ type: 'success', message: 'Signed in successfully.' });
    await refreshApp(result.access_token, context);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    const result = await runTask(() => login(email.trim(), password, organisationSlug.trim()));
    if (result) await applyLoginResult(result);
  }

  async function handleLogout() {
    if (accessToken) await logout(accessToken).catch(() => undefined);
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken('');
    setAuth(null);
    setView('overview');
    setNotice({ type: 'info', message: 'Signed out.' });
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!workspaceForm.name.trim()) {
      setNotice({ type: 'error', message: 'Workspace name is required.' });
      return;
    }
    await runTask(() => createPlatformOrganisation(accessToken, { name: workspaceForm.name.trim(), slug: workspaceForm.slug.trim() || undefined, status: 'active' }), 'Workspace created.');
    setWorkspaceForm({ name: '', slug: '' });
    await refreshApp();
  }

  async function changeWorkspaceStatus(workspace: OrganisationSummary) {
    const nextStatus = workspace.status === 'suspended' ? 'active' : 'suspended';
    await runTask(() => updatePlatformOrganisationStatus(accessToken, orgId(workspace), nextStatus), `Workspace ${nextStatus}.`);
    await refreshApp();
  }

  function openSettings(section: SettingsSection) {
    setSettingsSection(section);
    setView('settings');
  }

  useEffect(() => {
    void refreshLoginConfig(DEFAULT_ORG);
    if (accessToken) void authenticateExistingToken(accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!auth) {
    return (
      <main className="login-page">
        <section className="login-product">
          <div className="brand-row">
            <div className="brand-mark">S</div>
            <strong>SaaS Console</strong>
          </div>
          <div className="login-copy">
            <h1>Build, launch, and operate your SaaS from one workspace.</h1>
            <p>A regular SaaS application shell for teams, workspaces, integrations, billing, and security, backed by the existing boilerplate APIs.</p>
          </div>
          <div className="preview-board">
            <div className="preview-top">
              <span>Production console</span>
              <StatusBadge value={health?.status ?? 'Ready'} />
            </div>
            <div className="preview-grid">
              <div><strong>Workspaces</strong><span>Multi-tenant apps</span></div>
              <div><strong>Identity</strong><span>SSO and MFA</span></div>
              <div><strong>Security</strong><span>Audit trail</span></div>
            </div>
          </div>
        </section>
        <section className="login-card">
          <div>
            <span className="overline">Sign in</span>
            <h2>{loginConfig?.organisation.branding?.login_title ?? 'Welcome back'}</h2>
            <p>{loginConfig?.organisation.branding?.login_subtitle ?? 'Use your organisation account to continue.'}</p>
          </div>
          {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}
          <form className="form-grid" onSubmit={handleLogin}>
            <TextField label="Organisation slug" value={organisationSlug} onChange={setOrganisationSlug} />
            <button type="button" className="button secondary" onClick={() => void refreshLoginConfig()} disabled={loading}>Load</button>
            <TextField label="Email" value={email} onChange={setEmail} />
            <TextField label="Password" value={password} onChange={setPassword} type="password" />
            <button className="button primary field-full" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <div className="login-meta">
            <span>Default: admin@example.com</span>
            <span>API: {apiBaseUrl}</span>
          </div>
        </section>
      </main>
    );
  }

  const signedInAuth = auth;
  const activeNavLabel = navItems.find((item) => item.view === view)?.label ?? 'Home';
  const activeSettingsLabel = settingsSections.find((item) => item.section === settingsSection)?.label ?? 'Settings';

  return (
    <main className="site-layout">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-row">
            <div className="brand-mark">S</div>
            <div>
              <strong>SaaS Console</strong>
              <span>{signedInAuth.organisation.slug}</span>
            </div>
          </div>
          <nav className="site-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button key={item.view} className={view === item.view ? 'active' : ''} type="button" onClick={() => setView(item.view)}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="site-actions">
            <StatusBadge value={health?.status ?? 'Unknown'} />
            <button className="button secondary" onClick={() => void refreshApp()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
            <button className="button ghost" onClick={() => void handleLogout()}>Logout</button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="overline">{platformAllowed ? 'Platform enabled' : 'Organisation workspace'}</span>
            <h1>{view === 'settings' ? activeSettingsLabel : activeNavLabel}</h1>
          </div>
          <div className="topbar-actions">
            <input className="global-search" placeholder="Search workspaces, users, settings" />
          </div>
        </header>

        {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}
        <section className="page-content">{renderView()}</section>
      </section>
    </main>
  );

  function renderView() {
    switch (view) {
      case 'workspaces':
        return <WorkspacesView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  }

  function OverviewView() {
    const criticalEvents = securityEvents.filter((event) => ['critical', 'high'].includes(event.severity)).length;
    return (
      <>
        <section className="hero-panel">
          <div>
            <span className="overline">Dashboard</span>
            <h2>Welcome back, {signedInAuth.user.first_name || signedInAuth.user.display_name || signedInAuth.user.email}.</h2>
            <p>Operate your SaaS like a product team: workspaces, users, integrations, plans, and security in one clean console.</p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => setView('workspaces')}>Open workspaces</button>
              <button className="button secondary" onClick={() => openSettings('integrations')}>Configure integrations</button>
            </div>
          </div>
          <div className="hero-health">
            <div><span>API</span><StatusBadge value={health?.status ?? 'Unknown'} /></div>
            <div><span>Readiness</span><StatusBadge value={readiness?.status ?? 'Unknown'} /></div>
            <div><span>Database</span><strong>{readiness?.database?.mongo_ready_state === 1 ? 'Connected' : 'Checking'}</strong></div>
          </div>
        </section>

        <div className="metric-grid">
          <MetricCard label="Workspaces" value={workspaces.length} hint={platformAllowed ? 'Platform scope' : 'Current organisation'} />
          <MetricCard label="Active users" value={activeUsers} hint={`${users.length} total users`} tone="green" />
          <MetricCard label="Enabled features" value={enabledFeatures} hint={`${featureCatalogue?.features.length ?? 0} available`} tone="orange" />
          <MetricCard label="Security alerts" value={criticalEvents} hint="High and critical" tone="dark" />
        </div>

        <div className="home-grid">
          <article className="card product-card">
            <SectionHeader title="Product modules" description="The core surfaces a regular SaaS product expects." />
            <div className="module-grid">
              {[
                { title: 'Workspaces', description: 'Apps, tenants, customer environments', action: () => setView('workspaces') },
                { title: 'Access Management', description: 'SSO, MFA, roles, and sessions', action: () => openSettings('access') },
                { title: 'Billing', description: 'Plans, entitlement catalogues, usage', action: () => openSettings('billing') },
                { title: 'Security', description: 'Audit trail and security events', action: () => openSettings('security') }
              ].map((module) => (
                <button key={module.title} className="module-tile" onClick={module.action}>
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card">
            <SectionHeader title="Recent activity" description="Latest organisation audit events." />
            <ActivityList rows={recentAudit} />
          </article>

          <article className="card">
            <SectionHeader title="Security signals" description="Recent authentication and policy events." />
            <SecurityList rows={recentSecurity} />
          </article>
        </div>
      </>
    );
  }

  function WorkspacesView() {
    return (
      <>
        <div className="split-grid">
          <article className="card">
            <SectionHeader title="Workspaces" description="A SaaS-style home for customer tenants, apps, and environments." />
            <div className="toolbar">
              <input value={workspaceSearch} placeholder="Search workspaces" onChange={(event) => setWorkspaceSearch(event.target.value)} />
              <StatusBadge value={platformAllowed ? 'Platform access' : 'Organisation only'} tone={platformAllowed ? 'good' : 'neutral'} />
            </div>
            <div className="workspace-grid">
              {filteredWorkspaces.map((workspace) => (
                <article className="workspace-card" key={orgId(workspace)}>
                  <div>
                    <strong>{workspace.name}</strong>
                    <span>{workspace.slug}</span>
                  </div>
                  <StatusBadge value={workspace.status} />
                  <small>ID {shortId(orgId(workspace))}</small>
                  <div className="row-actions">
                    <button className="button tiny secondary" onClick={() => openSettings('users')}>Users</button>
                    <button className="button tiny ghost" onClick={() => openSettings('billing')}>Plan</button>
                    {platformAllowed ? <button className="button tiny ghost" onClick={() => void changeWorkspaceStatus(workspace)}>{workspace.status === 'suspended' ? 'Activate' : 'Suspend'}</button> : null}
                  </div>
                </article>
              ))}
            </div>
            {!filteredWorkspaces.length ? <EmptyState title="No workspaces found" message="Create or search for a workspace to manage." /> : null}
          </article>

          <article className="card">
            <SectionHeader title="Create workspace" description={platformAllowed ? 'Create a new tenant-backed workspace.' : 'Requires platform access.'} />
            <form className="form-grid single" onSubmit={createWorkspace}>
              <TextField label="Workspace name" value={workspaceForm.name} onChange={(value) => setWorkspaceForm({ ...workspaceForm, name: value })} />
              <TextField label="Slug" value={workspaceForm.slug} onChange={(value) => setWorkspaceForm({ ...workspaceForm, slug: value })} placeholder="optional" />
              <button className="button primary field-full" type="submit" disabled={!platformAllowed || loading}>Create workspace</button>
            </form>
            <div className="info-panel">
              <strong>Roadmap</strong>
              <p>Environment promotion, app templates, and workspace-specific dashboards can plug into this surface when those APIs exist.</p>
            </div>
          </article>
        </div>
      </>
    );
  }

  function AccessManagementView() {
    return (
      <div className="split-grid">
        <article className="card">
          <SectionHeader title="Access Management" description="Identity controls for this organisation: SSO, MFA, roles, and authentication posture." />
          <dl className="details-list">
            <div><dt>SSO provider</dt><dd>{readString(ssoConfig?.sso_config.provider, 'Not configured')}</dd></div>
            <div><dt>SSO status</dt><dd><StatusBadge value={Boolean(ssoConfig?.sso_config.enabled)} /></dd></div>
            <div><dt>MFA policy</dt><dd><StatusBadge value={Boolean(mfaPolicy?.mfa_policy.enabled)} /></dd></div>
            <div><dt>MFA enforcement</dt><dd>{mfaPolicy?.mfa_policy.enforcement_mode ?? 'disabled'}</dd></div>
            <div><dt>Current roles</dt><dd>{signedInAuth.roles.map((role) => role.name).join(', ') || '-'}</dd></div>
          </dl>
        </article>
        <article className="card">
          <SectionHeader title="Role and permission summary" description="Current session access, shown read-only until role management screens are expanded." />
          <div className="pill-cloud">
            {signedInAuth.permission_keys.slice(0, 28).map((permission) => <span key={permission} className="enabled">{permission}</span>)}
          </div>
        </article>
      </div>
    );
  }

  function UsersView() {
    return (
      <article className="card">
        <SectionHeader title="Users and access" description="Team members for the signed-in organisation." />
        <DataTable
          rows={users}
          emptyTitle="No users"
          emptyMessage="Users will appear after invites or seed data."
          columns={[
            { label: 'User', render: (row) => <div><strong>{row.display_name || row.email}</strong><small>{row.email}</small></div> },
            { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { label: 'Roles', render: (row) => row.role_ids.length },
            { label: 'Auth', render: (row) => readString(row.auth?.auth_type, 'native') },
            { label: 'Updated', render: (row) => formatDate(row.updatedAt) }
          ]}
        />
      </article>
    );
  }

  function IntegrationsView() {
    const integrations = [
      { title: 'SSO provider', status: ssoConfig?.sso_config.enabled ? 'Enabled' : 'Disabled', detail: readString(ssoConfig?.sso_config.provider, 'OIDC provider not configured') },
      { title: 'MFA policy', status: mfaPolicy?.mfa_policy.enabled ? 'Enabled' : 'Disabled', detail: mfaPolicy?.mfa_policy.enforcement_mode ?? 'disabled' },
      { title: 'API tokens', status: 'Available', detail: 'Personal and organisation token APIs are included.' },
      { title: 'File storage', status: 'Local', detail: 'Docker deployment uses local API storage volume.' },
      { title: 'Webhooks', status: 'Later', detail: 'No webhook backend exists yet.' },
      { title: 'Analytics', status: 'Later', detail: 'Product analytics can be added as a module.' }
    ];
    return (
      <div className="integration-grid">
        {integrations.map((integration) => (
          <article className="card integration-card" key={integration.title}>
            <div>
              <strong>{integration.title}</strong>
              <p>{integration.detail}</p>
            </div>
            <StatusBadge value={integration.status} tone={integration.status === 'Later' ? 'neutral' : undefined} />
          </article>
        ))}
      </div>
    );
  }

  function BillingView() {
    return (
      <div className="split-grid">
        <article className="card">
          <SectionHeader title="Current plan" description="Plan assignment for the signed-in organisation." />
          <dl className="details-list">
            <div><dt>Plan</dt><dd>{readPlanName(organisationPlan)}</dd></div>
            <div><dt>Subscription</dt><dd>{organisationPlan?.plan_assignment?.subscription_status ?? 'Not configured'}</dd></div>
            <div><dt>Billing mode</dt><dd>{readString(organisationPlan?.plan_assignment?.billing_mode, 'manual')}</dd></div>
            <div><dt>Assigned</dt><dd>{formatDate(organisationPlan?.plan_assignment?.assigned_at)}</dd></div>
          </dl>
        </article>
        <article className="card">
          <SectionHeader title="Plan catalogue" description="Available plans from the platform catalogue." />
          <DataTable
            rows={planCatalogue?.plans ?? []}
            emptyTitle="No plans"
            emptyMessage="Plans appear after seeding."
            columns={[
              { label: 'Plan', render: (row) => <div><strong>{row.name}</strong><small>{row.key}</small></div> },
              { label: 'Status', render: (row) => <StatusBadge value={row.status ?? 'active'} /> },
              { label: 'Billing', render: (row) => row.billing_mode ?? 'manual' },
              { label: 'Features', render: (row) => Object.keys(row.features ?? {}).length }
            ]}
          />
        </article>
      </div>
    );
  }

  function SecurityView() {
    return (
      <div className="split-grid">
        <article className="card">
          <SectionHeader title="Audit trail" description="Administrative activity from the current organisation." />
          <AuditTable rows={auditLogs} />
        </article>
        <article className="card">
          <SectionHeader title="Security events" description="Authentication, policy, and token-related security signals." />
          <SecurityTable rows={securityEvents} />
        </article>
      </div>
    );
  }

  function SettingsView() {
    function renderSettingsSection() {
      switch (settingsSection) {
        case 'access':
          return <AccessManagementView />;
        case 'users':
          return <UsersView />;
        case 'billing':
          return <BillingView />;
        case 'integrations':
          return <IntegrationsView />;
        case 'security':
          return <SecurityView />;
        default:
          return <OrganisationSettingsView />;
      }
    }

    return (
      <>
        <section className="settings-hero">
          <div>
            <span className="overline">Administration</span>
            <h2>Settings</h2>
            <p>Manage access, users, billing, integrations, security, and organisation details from one Anypoint-style administration area.</p>
          </div>
          <StatusBadge value={platformAllowed ? 'Platform admin' : 'Organisation admin'} tone={platformAllowed ? 'good' : 'neutral'} />
        </section>
        <div className="settings-shell">
          <aside className="settings-menu">
            {settingsSections.map((item) => (
              <button key={item.section} className={settingsSection === item.section ? 'active' : ''} type="button" onClick={() => setSettingsSection(item.section)}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </aside>
          <section className="settings-content">{renderSettingsSection()}</section>
        </div>
      </>
    );
  }

  function OrganisationSettingsView() {
    return (
      <div className="split-grid">
        <article className="card">
          <SectionHeader title="Organisation settings" description="Core tenant profile and runtime configuration." />
          <dl className="details-list">
            <div><dt>Name</dt><dd>{signedInAuth.organisation.name}</dd></div>
            <div><dt>Slug</dt><dd>{signedInAuth.organisation.slug}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={signedInAuth.organisation.status} /></dd></div>
            <div><dt>Organisation ID</dt><dd>{currentOrganisationId}</dd></div>
            <div><dt>API base</dt><dd>{apiBaseUrl}</dd></div>
          </dl>
        </article>
        <article className="card">
          <SectionHeader title="Product configuration" description="Feature flags and modules available to this organisation." />
          <div className="pill-cloud">
            {(organisationFeatures?.features ?? []).slice(0, 24).map((feature) => <span key={feature.key} className={feature.enabled ? 'enabled' : ''}>{feature.key}</span>)}
          </div>
        </article>
      </div>
    );
  }
}

function ActivityList({ rows }: { rows: AuditLogRecord[] }) {
  if (!rows.length) return <EmptyState title="No activity yet" message="Audit events will appear after administrative actions." />;
  return (
    <div className="activity-list">
      {rows.map((row) => (
        <div className="activity-row" key={row.id}>
          <div><strong>{row.action}</strong><span>{row.resource_type} / {shortId(row.resource_id ?? '')}</span></div>
          <small>{formatDate(row.created_at ?? row.createdAt)}</small>
        </div>
      ))}
    </div>
  );
}

function SecurityList({ rows }: { rows: SecurityEventRecord[] }) {
  if (!rows.length) return <EmptyState title="No security signals" message="Security events will appear after login, SSO, token, or policy activity." />;
  return (
    <div className="activity-list">
      {rows.map((row) => (
        <div className="activity-row" key={row.id}>
          <div><strong>{row.event_type}</strong><span>{row.status}</span></div>
          <StatusBadge value={row.severity} />
        </div>
      ))}
    </div>
  );
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
      emptyMessage="Security events will appear after login, token, or SSO activity."
      columns={[
        { label: 'Event', render: (row) => row.event_type },
        { label: 'Severity', render: (row) => <StatusBadge value={row.severity} /> },
        { label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        { label: 'IP', render: (row) => row.ip_address ?? '-' },
        { label: 'Date', render: (row) => formatDate(row.created_at ?? row.createdAt) }
      ]}
    />
  );
}
