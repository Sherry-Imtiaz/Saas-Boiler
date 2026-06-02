import { connectMongo, disconnectMongo } from '../database/mongo.js';
import { AuditLogModel, OrganisationModel, PermissionModel, PlanModel, RoleModel, SecurityEventModel, UserModel } from '../models/index.js';
import { PLAN_CATALOGUE_SEED } from '../utils/plans.js';

function normaliseSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'demo-organisation';
}

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

const expectedOrganisationSlug = normaliseSlug(process.env.SEED_ORGANISATION_SLUG ?? process.env.DEMO_ORG_SLUG ?? 'demo-organisation');
const expectedAdminEmail = normaliseEmail(process.env.SEED_ADMIN_EMAIL ?? process.env.DEMO_ADMIN_EMAIL ?? 'admin@example.com');

async function main() {
  await connectMongo();

  try {
    const [permissionCount, planCount, organisation, adminUser, auditCount, securityEventCount] = await Promise.all([
      PermissionModel.countDocuments(),
      PlanModel.countDocuments(),
      OrganisationModel.findOne({ slug: expectedOrganisationSlug }),
      UserModel.findOne({ email_normalised: expectedAdminEmail }),
      AuditLogModel.countDocuments({ action: /^seed\.v0\./ }),
      SecurityEventModel.countDocuments({ event_type: /^seed\.v0\./ })
    ]);

    const roleCount = organisation ? await RoleModel.countDocuments({ organisation_id: organisation._id }) : 0;
    const missing: string[] = [];

    if (permissionCount < 1) missing.push('permissions');
    if (planCount < PLAN_CATALOGUE_SEED.length) missing.push('plans');
    if (!organisation) missing.push(`organisation:${expectedOrganisationSlug}`);
    if (!adminUser) missing.push(`admin_user:${expectedAdminEmail}`);
    if (organisation && adminUser && String(adminUser.organisation_id) !== String(organisation._id)) missing.push('admin_user_organisation_match');
    if (roleCount < 2) missing.push('organisation_roles');

    const summary = {
      version: '1.0.0',
      status: missing.length === 0 ? 'ready' : 'incomplete',
      expected_organisation_slug: expectedOrganisationSlug,
      expected_admin_email: expectedAdminEmail,
      counts: {
        permissions: permissionCount,
        plans: planCount,
        organisation_roles: roleCount,
        seed_audit_logs: auditCount,
        seed_security_events: securityEventCount
      },
      organisation_id: organisation?._id.toString() ?? null,
      admin_user_id: adminUser?._id.toString() ?? null,
      missing
    };

    console.log('Install check summary');
    console.log(JSON.stringify(summary, null, 2));

    if (missing.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectMongo();
  }
}

main().catch(async (error) => {
  console.error('Install check failed:', error);
  await disconnectMongo();
  process.exit(1);
});
