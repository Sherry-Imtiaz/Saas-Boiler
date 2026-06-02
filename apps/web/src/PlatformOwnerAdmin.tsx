import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  applyPlatformOrganisationPlanDefaults,
  assignPlatformOrganisationPlan,
  createPlatformOrganisation,
  createPlatformPlan,
  getPlatformAuditLogs,
  getPlatformOrganisations,
  getPlatformSecurityEvents,
  getPlanCatalogue,
  getReadiness,
  updatePlatformOrganisationStatus,
  updatePlatformPlan,
  type AuditLogRecord,
  type AuthContext,
  type HealthResponse,
  type OrganisationSummary,
  type PermissionSummary,
  type PlanCatalogueResponse,
  type SecurityEventRecord
} from './services/api';

type PlatformTab = 'dashboard' | 'organisations' | 'plans' | 'audit' | 'security' | 'system';
type Notice = { type: 'success' | 'error' | 'info'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function readPlanKey(organisation: OrganisationSummary): string {
  const plan = (organisation as OrganisationSummary & { plan?: Record<string, unknown> }).plan;
  return String(plan?.plan_key ?? plan?.plan_id ?? plan?.name ?? '-');
}

function parseJsonObject(value: string, fallback: Record<string, unknown>) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function isPlatformOwner(auth: AuthContext): boolean {
  return auth.permission_keys.includes('platform.organisations.view') || auth.permission_keys.includes('platform.organisations.manage');
}

export function PlatformOwnerAdmin({ accessToken, auth, apiBaseUrl, permissions, health }: {
  accessToken: string;
  auth: AuthContext;
  apiBaseUrl: string;
  permissions: PermissionSummary[];
  health: HealthResponse | null;
}) {
  const [tab, setTab] = useState<PlatformTab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [plans, setPlans] = useState<PlanCatalogueResponse | null>(null);
  const [readiness, setReadiness] = useState<HealthResponse | null>(null);
  const [organisationFilter, setOrganisationFilter] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const [securityFilter, setSecurityFilter] = useState('');
  const [newOrg, setNewOrg] = useState({ name: '', slug: '', domain: '', status: 'active' });
  const [planAssignment, setPlanAssignment] = useState({ organisationId: '', plan_key: 'professional', subscription_status: 'manual', billing_mode: 'manual', apply_feature_defaults: true });
  const [planForm, setPlanForm] = useState({ key: 'custom-platform-plan', name: 'Custom Platform Plan', status: 'active', billing_mode: 'manual', description: 'Created from Platform Owner Admin UI', features: '{\n  "admin_ui": true\n}', limits: '{\n  "max_users": 25,\n  "max_storage_gb": 100\n}' });

  const tabs: Array<{ key: PlatformTab; label: string; description: string }> = [
    { key: 'dashboard', label: 'Platform Dashboard', description: 'Whole-platform overview' },
    { key: 'organisations', label: 'Organisations', description: 'Create, suspend and assign plans' },
    { key: 'plans', label: 'Plans / Features', description: 'Global plan catalogue' },
    { key: 'audit', label: 'Cross-tenant Audit', description: 'Platform audit visibility' },
    { key: 'security', label: 'Cross-tenant Security', description: 'Platform security visibility' },
    { key: 'system', label: 'System / Developer', description: 'Health and API context' }
  ];

  const canManageOrganisations = auth.permission_keys.includes('platform.organisations.manage');
  const canManagePlans = auth.permission_keys.includes('plans.manage');
  const canViewPlatformAudit = auth.permission_keys.includes('audit.platform.view');
  const canViewPlatformSecurity = auth.permission_keys.includes('security.events.platform.view');

  const filteredOrganisations = useMemo(() => {
    const search = organisationFilter.toLowerCase();
    return organisations.filter((organisation) => `${organisation.name} ${organisation.slug} ${organisation.status}`.toLowerCase().includes(search));
  }, [organisations, organisationFilter]);

  async function run<T>(work: () => Promise<T>, success?: string): Promise<T | undefined> {
    setLoading(true);
    setNotice(null);
    try {
      const result = await work();
      if (success) setNotice({ type: 'success', message: success });
      return result;
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error) });
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlatformData() {
    await run(async () => {
      const [orgResult, planResult, auditResult, securityResult, readyResult] = await Promise.all([
        getPlatformOrganisations(accessToken, '?limit=100'),
        getPlanCatalogue(accessToken).catch(() => null),
        canViewPlatformAudit ? getPlatformAuditLogs(accessToken, '?limit=25') : Promise.resolve({ records: [] as AuditLogRecord[] }),
        canViewPlatformSecurity ? getPlatformSecurityEvents(accessToken, '?limit=25') : Promise.resolve({ records: [] as SecurityEventRecord[] }),
        getReadiness().catch(() => null)
      ]);
      setOrganisations(orgResult.organisations);
      setPlans(planResult);
      setAuditLogs(auditResult.records);
      setSecurityEvents(securityResult.records);
      setReadiness(readyResult);
      if (!planAssignment.organisationId && orgResult.organisations[0]) {
        setPlanAssignment((current) => ({ ...current, organisationId: orgResult.organisations[0].id }));
      }
    });
  }

  useEffect(() => {
    if (isPlatformOwner(auth)) void refreshPlatformData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function handleCreateOrganisation(event: FormEvent) {
    event.preventDefault();
    if (!canManageOrganisations) return;
    await run(async () => {
      await createPlatformOrganisation(accessToken, {
        name: newOrg.name,
        slug: newOrg.slug || undefined,
        status: newOrg.status,
        domains: newOrg.domain ? [{ domain: newOrg.domain, verified: false, is_primary: true }] : undefined
      });
      setNewOrg({ name: '', slug: '', domain: '', status: 'active' });
      setOrganisations((await getPlatformOrganisations(accessToken, '?limit=100')).organisations);
    }, 'Organisation created.');
  }

  async function handleOrganisationStatus(organisation: OrganisationSummary, status: string) {
    if (!canManageOrganisations) return;
    await run(async () => {
      await updatePlatformOrganisationStatus(accessToken, organisation.id, status);
      setOrganisations((await getPlatformOrganisations(accessToken, '?limit=100')).organisations);
    }, `Organisation status changed to ${status}.`);
  }

  async function handleAssignPlan(event: FormEvent) {
    event.preventDefault();
    if (!canManageOrganisations || !canManagePlans) return;
    await run(async () => {
      await assignPlatformOrganisationPlan(accessToken, planAssignment.organisationId, planAssignment);
      setOrganisations((await getPlatformOrganisations(accessToken, '?limit=100')).organisations);
    }, 'Organisation plan assigned.');
  }

  async function handleApplyDefaults() {
    if (!canManageOrganisations || !canManagePlans || !planAssignment.organisationId) return;
    await run(async () => {
      await applyPlatformOrganisationPlanDefaults(accessToken, planAssignment.organisationId);
      setOrganisations((await getPlatformOrganisations(accessToken, '?limit=100')).organisations);
    }, 'Plan defaults applied.');
  }

  async function handleSavePlan(event: FormEvent) {
    event.preventDefault();
    if (!canManagePlans) return;
    await run(async () => {
      const payload = {
        key: planForm.key,
        name: planForm.name,
        description: planForm.description,
        status: planForm.status,
        billing_mode: planForm.billing_mode,
        features: parseJsonObject(planForm.features, {}) as Record<string, boolean>,
        limits: parseJsonObject(planForm.limits, {}),
        is_custom: true
      };
      const exists = plans?.plans.some((plan) => plan.key === planForm.key);
      if (exists) await updatePlatformPlan(accessToken, planForm.key, payload);
      else await createPlatformPlan(accessToken, payload);
      setPlans(await getPlanCatalogue(accessToken));
    }, 'Plan catalogue saved.');
  }

  async function refreshAudit() {
    if (!canViewPlatformAudit) return;
    const query = auditFilter ? `?limit=50&action=${encodeURIComponent(auditFilter)}` : '?limit=50';
    await run(async () => setAuditLogs((await getPlatformAuditLogs(accessToken, query)).records));
  }

  async function refreshSecurity() {
    if (!canViewPlatformSecurity) return;
    const query = securityFilter ? `?limit=50&event_type=${encodeURIComponent(securityFilter)}` : '?limit=50';
    await run(async () => setSecurityEvents((await getPlatformSecurityEvents(accessToken, query)).records));
  }

  if (!isPlatformOwner(auth)) {
    return <section className="card"><h2>Platform Owner Admin UI</h2><p className="muted">You do not have platform owner permissions.</p></section>;
  }

  return (
    <section className="stack">
      <section className="hero-card platform-hero">
        <span className="eyebrow">Platform Owner Admin UI</span>
        <h2>Platform Administration</h2>
        <p>Manage all organisations, global plans, cross-tenant audit/security visibility and platform readiness from a separate high-trust admin surface.</p>
        <div className="inline-actions"><button className="secondary" onClick={() => void refreshPlatformData()}>Refresh platform data</button>{loading && <span className="muted">Working...</span>}</div>
      </section>
      {notice && <div className={`notice ${notice.type}`}>{notice.message}</div>}
      <section className="platform-tabs">
        {tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><strong>{item.label}</strong><span>{item.description}</span></button>)}
      </section>
      {tab === 'dashboard' && <PlatformDashboard organisations={organisations} plans={plans} auditLogs={auditLogs} securityEvents={securityEvents} health={health} readiness={readiness} />}
      {tab === 'organisations' && (
        <PlatformOrganisations
          organisations={filteredOrganisations}
          allOrganisations={organisations}
          filter={organisationFilter}
          setFilter={setOrganisationFilter}
          newOrg={newOrg}
          setNewOrg={setNewOrg}
          canManage={canManageOrganisations}
          planAssignment={planAssignment}
          setPlanAssignment={setPlanAssignment}
          plans={plans}
          canManagePlans={canManagePlans}
          onCreate={handleCreateOrganisation}
          onStatus={handleOrganisationStatus}
          onAssignPlan={handleAssignPlan}
          onApplyDefaults={handleApplyDefaults}
        />
      )}
      {tab === 'plans' && <PlatformPlans plans={plans} form={planForm} setForm={setPlanForm} canManage={canManagePlans} onSave={handleSavePlan} />}
      {tab === 'audit' && <PlatformLogPage title="Cross-tenant Audit Logs" records={auditLogs} filter={auditFilter} setFilter={setAuditFilter} onRefresh={refreshAudit} getTitle={(row) => row.action} getMeta={(row) => `${row.organisation_id} / ${row.resource_type} / ${formatDate(row.created_at ?? row.createdAt)}`} />}
      {tab === 'security' && <PlatformLogPage title="Cross-tenant Security Events" records={securityEvents} filter={securityFilter} setFilter={setSecurityFilter} onRefresh={refreshSecurity} getTitle={(row) => row.event_type} getMeta={(row) => `${row.organisation_id} / ${row.severity} / ${row.status} / ${formatDate(row.created_at ?? row.createdAt)}`} />}
      {tab === 'system' && <PlatformSystem apiBaseUrl={apiBaseUrl} auth={auth} health={health} readiness={readiness} permissions={permissions} />}
    </section>
  );
}

function PlatformDashboard({ organisations, plans, auditLogs, securityEvents, health, readiness }: { organisations: OrganisationSummary[]; plans: PlanCatalogueResponse | null; auditLogs: AuditLogRecord[]; securityEvents: SecurityEventRecord[]; health: HealthResponse | null; readiness: HealthResponse | null }) {
  const active = organisations.filter((organisation) => organisation.status === 'active').length;
  const suspended = organisations.filter((organisation) => organisation.status === 'suspended').length;
  return <section className="stack"><section className="metric-grid"><Metric label="Organisations" value={organisations.length} /><Metric label="Active tenants" value={active} /><Metric label="Suspended tenants" value={suspended} /><Metric label="Plans" value={plans?.plans.length ?? 0} /><Metric label="Platform audit rows" value={auditLogs.length} /><Metric label="Security events" value={securityEvents.length} /><Metric label="API" value={health?.status ?? '-'} /><Metric label="Readiness" value={readiness?.status ?? 'check'} /></section><section className="grid-page two-column"><RecentPlatformList title="Recent platform audit" rows={auditLogs.map((row) => ({ id: row.id, title: row.action, subtitle: `${row.organisation_id} / ${formatDate(row.created_at ?? row.createdAt)}` }))} /><RecentPlatformList title="Recent security events" rows={securityEvents.map((row) => ({ id: row.id, title: row.event_type, subtitle: `${row.severity} / ${row.status} / ${formatDate(row.created_at ?? row.createdAt)}` }))} /></section></section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}

function RecentPlatformList({ title, rows }: { title: string; rows: Array<{ id: string; title: string; subtitle: string }> }) {
  return <section className="card"><h2>{title}</h2><div className="event-list">{rows.length ? rows.slice(0, 8).map((row) => <div key={row.id}><strong>{row.title}</strong><span>{row.subtitle}</span></div>) : <p className="muted">No records loaded.</p>}</div></section>;
}

function PlatformOrganisations(props: {
  organisations: OrganisationSummary[];
  allOrganisations: OrganisationSummary[];
  filter: string;
  setFilter: (value: string) => void;
  newOrg: { name: string; slug: string; domain: string; status: string };
  setNewOrg: (value: { name: string; slug: string; domain: string; status: string }) => void;
  canManage: boolean;
  planAssignment: { organisationId: string; plan_key: string; subscription_status: string; billing_mode: string; apply_feature_defaults: boolean };
  setPlanAssignment: (value: { organisationId: string; plan_key: string; subscription_status: string; billing_mode: string; apply_feature_defaults: boolean }) => void;
  plans: PlanCatalogueResponse | null;
  canManagePlans: boolean;
  onCreate: (event: FormEvent) => void;
  onStatus: (organisation: OrganisationSummary, status: string) => void;
  onAssignPlan: (event: FormEvent) => void;
  onApplyDefaults: () => void;
}) {
  const updateNewOrg = (patch: Partial<typeof props.newOrg>) => props.setNewOrg({ ...props.newOrg, ...patch });
  const updateAssignment = (patch: Partial<typeof props.planAssignment>) => props.setPlanAssignment({ ...props.planAssignment, ...patch });
  return <section className="stack"><section className="card"><h2>Create organisation</h2><form className="form-grid four" onSubmit={props.onCreate}><label>Name<input disabled={!props.canManage} value={props.newOrg.name} onChange={(e) => updateNewOrg({ name: e.target.value })} /></label><label>Slug<input disabled={!props.canManage} value={props.newOrg.slug} onChange={(e) => updateNewOrg({ slug: e.target.value })} /></label><label>Primary domain<input disabled={!props.canManage} value={props.newOrg.domain} onChange={(e) => updateNewOrg({ domain: e.target.value })} /></label><label>Status<select disabled={!props.canManage} value={props.newOrg.status} onChange={(e) => updateNewOrg({ status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option><option value="suspended">suspended</option></select></label><button disabled={!props.canManage}>Create organisation</button></form></section><section className="card"><h2>Assign organisation plan</h2><form className="form-grid four" onSubmit={props.onAssignPlan}><label>Organisation<select disabled={!props.canManagePlans} value={props.planAssignment.organisationId} onChange={(e) => updateAssignment({ organisationId: e.target.value })}>{props.allOrganisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name} ({organisation.slug})</option>)}</select></label><label>Plan<select disabled={!props.canManagePlans} value={props.planAssignment.plan_key} onChange={(e) => updateAssignment({ plan_key: e.target.value })}>{props.plans?.plans.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}</select></label><label>Status<select disabled={!props.canManagePlans} value={props.planAssignment.subscription_status} onChange={(e) => updateAssignment({ subscription_status: e.target.value })}><option value="manual">manual</option><option value="trial">trial</option><option value="active">active</option><option value="suspended">suspended</option><option value="cancelled">cancelled</option></select></label><label className="checkbox-label"><input disabled={!props.canManagePlans} type="checkbox" checked={props.planAssignment.apply_feature_defaults} onChange={(e) => updateAssignment({ apply_feature_defaults: e.target.checked })} /> Apply feature defaults</label><button disabled={!props.canManagePlans}>Assign plan</button><button type="button" className="secondary" disabled={!props.canManagePlans} onClick={props.onApplyDefaults}>Apply defaults only</button></form></section><section className="card"><div className="section-header"><h2>All organisations</h2><input placeholder="Search organisations" value={props.filter} onChange={(e) => props.setFilter(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Status</th><th>Plan</th><th>Domains</th><th>Actions</th></tr></thead><tbody>{props.organisations.map((organisation) => <tr key={organisation.id}><td>{organisation.name}</td><td>{organisation.slug}</td><td><span className={`pill ${organisation.status}`}>{organisation.status}</span></td><td>{readPlanKey(organisation)}</td><td>{((organisation as OrganisationSummary & { domains?: Array<{ domain: string }> }).domains ?? []).map((domain) => domain.domain).join(', ') || '-'}</td><td><button className="small secondary" disabled={!props.canManage} onClick={() => props.onStatus(organisation, 'active')}>Activate</button><button className="small danger" disabled={!props.canManage} onClick={() => props.onStatus(organisation, 'suspended')}>Suspend</button></td></tr>)}</tbody></table></div></section></section>;
}

function PlatformPlans({ plans, form, setForm, canManage, onSave }: { plans: PlanCatalogueResponse | null; form: { key: string; name: string; status: string; billing_mode: string; description: string; features: string; limits: string }; setForm: (value: { key: string; name: string; status: string; billing_mode: string; description: string; features: string; limits: string }) => void; canManage: boolean; onSave: (event: FormEvent) => void }) {
  return <section className="grid-page two-column"><section className="card"><h2>Create/update global plan</h2><form className="form-grid two" onSubmit={onSave}><label>Key<input disabled={!canManage} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></label><label>Name<input disabled={!canManage} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Status<select disabled={!canManage} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option><option value="archived">archived</option></select></label><label>Billing mode<select disabled={!canManage} value={form.billing_mode} onChange={(e) => setForm({ ...form, billing_mode: e.target.value })}><option value="manual">manual</option><option value="stripe_ready">stripe_ready</option><option value="custom">custom</option></select></label><label className="wide-field">Description<input disabled={!canManage} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Features JSON<textarea disabled={!canManage} rows={8} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></label><label>Limits JSON<textarea disabled={!canManage} rows={8} value={form.limits} onChange={(e) => setForm({ ...form, limits: e.target.value })} /></label><button disabled={!canManage}>Save plan</button></form></section><section className="card"><h2>Global plan catalogue</h2><div className="event-list">{plans?.plans.map((plan) => <details key={plan.key}><summary><strong>{plan.name}</strong><span>{plan.key} / {plan.status} / {plan.billing_mode}</span></summary><pre>{JSON.stringify(plan, null, 2)}</pre></details>)}</div></section></section>;
}

function PlatformLogPage<T extends { id: string; details?: Record<string, unknown> }>({ title, records, filter, setFilter, onRefresh, getTitle, getMeta }: { title: string; records: T[]; filter: string; setFilter: (value: string) => void; onRefresh: () => void; getTitle: (record: T) => string; getMeta: (record: T) => string }) {
  return <section className="card"><div className="section-header"><h2>{title}</h2><div className="inline-input-row"><input placeholder="Exact event/action filter" value={filter} onChange={(e) => setFilter(e.target.value)} /><button className="secondary" onClick={onRefresh}>Refresh</button></div></div><div className="event-list">{records.map((record) => <details key={record.id}><summary><strong>{getTitle(record)}</strong><span>{getMeta(record)}</span></summary><pre>{JSON.stringify(record, null, 2)}</pre></details>)}</div></section>;
}

function PlatformSystem({ apiBaseUrl, auth, health, readiness, permissions }: { apiBaseUrl: string; auth: AuthContext; health: HealthResponse | null; readiness: HealthResponse | null; permissions: PermissionSummary[] }) {
  return <section className="grid-page two-column"><section className="card"><h2>System status</h2><dl className="detail-list"><dt>API health</dt><dd>{health?.status ?? '-'}</dd><dt>API version</dt><dd>{health?.version ?? '-'}</dd><dt>Readiness</dt><dd>{readiness?.status ?? '-'}</dd><dt>Mongo ready state</dt><dd>{readiness?.database?.mongo_ready_state ?? '-'}</dd></dl></section><section className="card"><h2>Developer links</h2><div className="event-list"><a href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">Swagger UI</a><a href={`${apiBaseUrl}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI JSON</a><a href={`${apiBaseUrl}/health/ready`} target="_blank" rel="noreferrer">Readiness endpoint</a></div></section><section className="card wide-card"><h2>Platform auth context</h2><pre>{JSON.stringify({ user: auth.user, organisation: auth.organisation, roles: auth.roles, permission_count: auth.permission_keys.length, platform_permissions: auth.permission_keys.filter((permission) => permission.startsWith('platform.') || permission.includes('.platform.')), available_permission_catalogue: permissions.length }, null, 2)}</pre></section></section>;
}
