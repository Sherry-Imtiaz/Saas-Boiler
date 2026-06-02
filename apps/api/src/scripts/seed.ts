import { connectMongo, disconnectMongo } from '../database/mongo.js';
import { AuditLogModel, OrganisationModel, PermissionModel, PlanModel, RoleModel, SecurityEventModel, UserModel } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { getDefaultFeatureMap } from '../utils/features.js';
import { PLAN_CATALOGUE_SEED } from '../utils/plans.js';

const permissionSeed = [
  ['platform.organisations.view', 'platform.organisations', 'view', 'View platform organisation records'],
  ['platform.organisations.manage', 'platform.organisations', 'manage', 'Create and manage platform organisation records'],
  ['internal.schema.view', 'internal.schema', 'view', 'View internal schema and collection status'],
  ['permissions.view', 'permissions', 'view', 'View global permission catalogue'],
  ['plans.view', 'plans', 'view', 'View plan catalogue and organisation subscription readiness metadata'],
  ['plans.manage', 'plans', 'manage', 'Manage plan catalogue, organisation plan assignment and plan defaults'],
  ['organisation.view', 'organisation', 'view', 'View organisation profile and settings'],
  ['organisation.update', 'organisation', 'update', 'Update organisation profile and settings'],
  ['organisation.branding.view', 'organisation.branding', 'view', 'View organisation branding, assets and theme configuration'],
  ['organisation.branding.manage', 'organisation.branding', 'manage', 'Update organisation branding, assets and theme configuration'],
  ['organisation.auth.view', 'organisation.auth', 'view', 'View organisation authentication configuration'],
  ['organisation.auth.manage', 'organisation.auth', 'manage', 'Update organisation authentication configuration'],
  ['organisation.mfa.view', 'organisation.mfa', 'view', 'View organisation MFA policy and MFA provider configuration'],
  ['organisation.mfa.manage', 'organisation.mfa', 'manage', 'Update organisation MFA policy and provider configuration'],
  ['organisation.sso.view', 'organisation.sso', 'view', 'View organisation SSO provider configuration'],
  ['organisation.sso.manage', 'organisation.sso', 'manage', 'Update organisation SSO provider configuration'],
  ['users.view', 'users', 'view', 'View users inside the organisation'],
  ['users.create', 'users', 'create', 'Create users inside the organisation'],
  ['users.invite', 'users', 'invite', 'Invite users into the organisation'],
  ['users.disable', 'users', 'disable', 'Disable organisation users'],
  ['users.update', 'users', 'update', 'Update organisation user profiles and roles'],
  ['roles.view', 'roles', 'view', 'View organisation roles'],
  ['roles.manage', 'roles', 'manage', 'Create and update organisation roles'],
  ['files.view', 'files', 'view', 'View organisation files'],
  ['files.upload', 'files', 'upload', 'Upload organisation files'],
  ['files.delete', 'files', 'delete', 'Delete or archive organisation files'],
  ['compute.jobs.view', 'compute.jobs', 'view', 'View organisation compute jobs'],
  ['compute.jobs.create', 'compute.jobs', 'create', 'Create organisation compute jobs'],
  ['compute.jobs.cancel', 'compute.jobs', 'cancel', 'Cancel organisation compute jobs'],
  ['compute.resources.view', 'compute.resources', 'view', 'View organisation compute allocation'],
  ['compute.resources.manage', 'compute.resources', 'manage', 'Manage organisation compute allocation'],
  ['features.view', 'features', 'view', 'View enabled organisation features'],
  ['features.manage', 'features', 'manage', 'Manage organisation feature entitlements'],
  ['audit.view', 'audit', 'view', 'View organisation audit logs'],
  ['audit.platform.view', 'audit.platform', 'view', 'View platform-level and cross-organisation audit logs'],
  ['security.events.view', 'security.events', 'view', 'View organisation security events'],
  ['security.events.platform.view', 'security.events.platform', 'view', 'View platform-level and cross-organisation security events'],
  ['tokens.policy.view', 'tokens.policy', 'view', 'View token type, audience and scope policy'],
  ['tokens.personal.manage', 'tokens.personal', 'manage', 'Create and revoke personal access tokens'],
  ['tokens.organisation.manage', 'tokens.organisation', 'manage', 'Create and revoke organisation API tokens'],
  ['tokens.service.manage', 'tokens.service', 'manage', 'Manage service account tokens in future builds']
] as const;

async function seedPermissions() {
  for (const [key, module, action, description] of permissionSeed) {
    await PermissionModel.updateOne(
      { key },
      { $set: { key, module, action, description, is_active: true } },
      { upsert: true }
    );
  }
}

async function seedPlans() {
  for (const plan of PLAN_CATALOGUE_SEED) {
    await PlanModel.updateOne(
      { key: plan.key },
      {
        $set: {
          name: plan.name,
          description: plan.description,
          status: plan.status,
          billing_mode: plan.billing_mode,
          pricing: plan.pricing,
          features: plan.features,
          limits: plan.limits,
          is_custom: plan.is_custom
        },
        $setOnInsert: { key: plan.key }
      },
      { upsert: true }
    );
  }
}


interface SeedConfig {
  organisationName: string;
  organisationSlug: string;
  organisationDomain: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  adminDisplayName: string;
  viewerRoleName: string;
  adminRoleName: string;
  planKey: string;
}

function normaliseSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'demo-organisation';
}

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function getSeedConfig(): SeedConfig {
  const adminEmail = normaliseEmail(process.env.SEED_ADMIN_EMAIL ?? process.env.DEMO_ADMIN_EMAIL ?? 'admin@example.com');
  const adminFirstName = process.env.SEED_ADMIN_FIRST_NAME ?? process.env.DEMO_ADMIN_FIRST_NAME ?? 'Demo';
  const adminLastName = process.env.SEED_ADMIN_LAST_NAME ?? process.env.DEMO_ADMIN_LAST_NAME ?? 'Admin';
  return {
    organisationName: process.env.SEED_ORGANISATION_NAME ?? process.env.DEMO_ORG_NAME ?? 'Demo Organisation',
    organisationSlug: normaliseSlug(process.env.SEED_ORGANISATION_SLUG ?? process.env.DEMO_ORG_SLUG ?? 'demo-organisation'),
    organisationDomain: (process.env.SEED_ORGANISATION_DOMAIN ?? process.env.DEMO_ORG_DOMAIN ?? 'example.com').trim().toLowerCase(),
    adminEmail,
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? process.env.DEMO_ADMIN_PASSWORD ?? 'ChangeMe123!',
    adminFirstName,
    adminLastName,
    adminDisplayName: process.env.SEED_ADMIN_DISPLAY_NAME ?? process.env.DEMO_ADMIN_DISPLAY_NAME ?? `${adminFirstName} ${adminLastName}`,
    viewerRoleName: process.env.SEED_VIEWER_ROLE_NAME ?? 'Viewer',
    adminRoleName: process.env.SEED_ADMIN_ROLE_NAME ?? 'Organisation Admin',
    planKey: (process.env.SEED_PLAN_KEY ?? process.env.DEMO_PLAN_KEY ?? 'professional').trim().toLowerCase()
  };
}

async function seedDemoOrganisation(config: SeedConfig) {
  const selectedPlan = PLAN_CATALOGUE_SEED.find((plan) => plan.key === config.planKey) ?? PLAN_CATALOGUE_SEED.find((plan) => plan.key === 'professional') ?? PLAN_CATALOGUE_SEED[0];
  if (!selectedPlan) {
    throw new Error('No plan catalogue entries are available for seeding.');
  }

  const organisation = await OrganisationModel.findOneAndUpdate(
    { slug: config.organisationSlug },
    {
      $setOnInsert: {
        name: config.organisationName,
        slug: config.organisationSlug,
        status: 'active',
        branding: {
          logo_url: null,
          favicon_url: null,
          login_background_url: null,
          sidebar_logo_url: null,
          email_logo_url: null,
          primary_colour: '#2563eb',
          secondary_colour: '#111827',
          login_title: `Welcome to ${config.organisationName}`,
          login_subtitle: 'SaaS Boilerplate Foundation',
          support_email: `support@${config.organisationDomain}`
        },
        theme: {
          mode: 'light',
          primary_colour: '#2563eb',
          secondary_colour: '#111827',
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
          border_radius: '12px',
          font_family: 'Inter, system-ui, sans-serif'
        },
        domains: [{ domain: config.organisationDomain, verified: false, is_primary: true }],
        auth_config: {
          login_method: 'native',
          sso_enabled: false,
          provider: null,
          issuer_url: null,
          discovery_url: null,
          client_id: null,
          client_secret_ref: null,
          allowed_email_domains: [config.organisationDomain],
          auto_provision_users: false,
          enforce_sso: false,
          enforce_mfa: false,
          sso_config: {
            enabled: false,
            provider: 'keycloak',
            protocol: 'oidc',
            issuer_url: `https://auth.${config.organisationDomain}/realms/${config.organisationSlug}`,
            discovery_url: `https://auth.${config.organisationDomain}/realms/${config.organisationSlug}/.well-known/openid-configuration`,
            authorization_endpoint: null,
            token_endpoint: null,
            userinfo_endpoint: null,
            jwks_uri: null,
            logout_endpoint: null,
            client_id: `saas-boilerplate-${config.organisationSlug}`,
            client_secret_ref: `env://OIDC_${config.organisationSlug.replace(/-/g, '_').toUpperCase()}_CLIENT_SECRET`,
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
          }
        },
        mfa_config: {
          enabled: false,
          provider: 'none',
          enforcement_mode: 'disabled',
          required_for_roles: [],
          required_for_permissions: ['tokens.organisation.manage', 'organisation.auth.manage'],
          claim_mapping: { amr_claim: 'amr', acr_claim: 'acr', mfa_values: ['otp', 'webauthn', 'mfa'] },
          recovery_policy: { allow_admin_reset: true, require_audit_note: true }
        },
        features: { ...getDefaultFeatureMap(), ...selectedPlan.features },
        storage: { storage_provider: null, storage_prefix: `organisations/${config.organisationSlug}/`, max_storage_gb: selectedPlan.limits.max_storage_gb ?? 100 }
      }
    },
    { upsert: true, new: true }
  );

  await OrganisationModel.updateOne(
    { _id: organisation._id },
    {
      $set: {
        features: { ...getDefaultFeatureMap(), ...selectedPlan.features },
        plan: {
          plan_id: selectedPlan.key,
          plan_key: selectedPlan.key,
          name: selectedPlan.name,
          billing_status: 'manual',
          subscription_status: 'manual',
          billing_mode: selectedPlan.billing_mode,
          trial_ends_at: null,
          current_period_ends_at: null,
          assigned_at: organisation.plan?.assigned_at ?? new Date(),
          assigned_by_user_id: organisation.plan?.assigned_by_user_id ?? null,
          limits: selectedPlan.limits,
          features_from_plan: true,
          notes: 'Seeded by v0.14.0 configurable seed and installer scripts.'
        }
      }
    }
  );

  const refreshedOrganisation = await OrganisationModel.findById(organisation._id);
  if (!refreshedOrganisation) throw new Error('Seeded organisation could not be reloaded.');

  const adminRole = await RoleModel.findOneAndUpdate(
    { organisation_id: refreshedOrganisation._id, name: config.adminRoleName },
    { $set: { description: 'Default administrator role for the organisation', is_system_role: true, permission_keys: permissionSeed.map(([key]) => key) } },
    { upsert: true, new: true }
  );

  const viewerRole = await RoleModel.findOneAndUpdate(
    { organisation_id: refreshedOrganisation._id, name: config.viewerRoleName },
    { $set: { description: 'Read-only starter role for the organisation', is_system_role: true, permission_keys: ['organisation.view', 'organisation.branding.view', 'organisation.auth.view', 'organisation.sso.view', 'organisation.mfa.view', 'users.view', 'roles.view', 'features.view', 'plans.view', 'audit.view', 'security.events.view'] } },
    { upsert: true, new: true }
  );

  await OrganisationModel.updateOne({ _id: refreshedOrganisation._id }, { $set: { 'auth_config.default_role_id': viewerRole._id } });

  const adminUser = await UserModel.findOneAndUpdate(
    { email_normalised: config.adminEmail },
    {
      $setOnInsert: {
        email: config.adminEmail,
        email_normalised: config.adminEmail,
        first_name: config.adminFirstName,
        last_name: config.adminLastName,
        display_name: config.adminDisplayName,
        auth: { auth_type: 'native', password_hash: hashPassword(config.adminPassword), mfa_enabled: false, mfa_status: 'not_required', mfa_provider: 'none', last_mfa_at: null, last_login_at: null },
        profile: { timezone: 'UTC' }
      },
      $set: {
        organisation_id: refreshedOrganisation._id,
        status: 'active',
        role_ids: [adminRole._id]
      }
    },
    { upsert: true, new: true }
  );

  if (!adminUser.auth.password_hash || process.env.SEED_FORCE_ADMIN_PASSWORD_RESET === 'true') {
    adminUser.auth.password_hash = hashPassword(config.adminPassword);
    adminUser.status = 'active';
    adminUser.auth.auth_type = 'native';
    await adminUser.save();
  }

  await AuditLogModel.updateOne(
    { organisation_id: refreshedOrganisation._id, action: 'seed.v0.14.0', resource_type: 'organisation' },
    {
      $setOnInsert: {
        organisation_id: refreshedOrganisation._id,
        actor_user_id: adminUser._id,
        action: 'seed.v0.14.0',
        resource_type: 'organisation',
        resource_id: refreshedOrganisation._id.toString(),
        details: { note: 'Seeded v0.14.0 configurable seed data, local installer readiness and demo organisation records.' }
      }
    },
    { upsert: true }
  );

  await SecurityEventModel.updateOne(
    { organisation_id: refreshedOrganisation._id, event_type: 'seed.v0.14.0', resource_type: 'organisation' },
    {
      $setOnInsert: {
        organisation_id: refreshedOrganisation._id,
        actor_user_id: adminUser._id,
        event_type: 'seed.v0.14.0',
        severity: 'low',
        status: 'success',
        resource_type: 'organisation',
        resource_id: refreshedOrganisation._id.toString(),
        details: { note: 'Security event collection seeded for v0.14.0 seed and installer script validation.' }
      }
    },
    { upsert: true }
  );

  return { organisation: refreshedOrganisation, adminRole, viewerRole, adminUser, selectedPlan };
}

async function main() {
  await connectMongo();
  const config = getSeedConfig();

  try {
    await seedPermissions();
    await seedPlans();
    const { organisation, adminRole, viewerRole, adminUser, selectedPlan } = await seedDemoOrganisation(config);

    console.log('Seed completed successfully');
    console.log({
      version: '1.0.0',
      organisation_id: organisation._id.toString(),
      organisation_slug: organisation.slug,
      organisation_name: organisation.name,
      admin_role_id: adminRole._id.toString(),
      viewer_role_id: viewerRole._id.toString(),
      admin_user_id: adminUser._id.toString(),
      seeded_plans: PLAN_CATALOGUE_SEED.map((plan) => plan.key),
      demo_plan: selectedPlan.key,
      demo_login_email: config.adminEmail,
      demo_login_password: config.adminPassword,
      note: 'v1.0.0 preserves configurable seed data and includes the seed stabilisation and production UI foundations from the final pre-release builds.'
    });
  } finally {
    await disconnectMongo();
  }
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await disconnectMongo();
  process.exit(1);
});
