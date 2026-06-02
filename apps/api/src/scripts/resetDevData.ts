import { connectMongo, disconnectMongo } from '../database/mongo.js';
import { AuditLogModel, FileAssetModel, OrganisationModel, RoleModel, SecurityEventModel, TokenRecordModel, UserModel } from '../models/index.js';

function normaliseSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'demo-organisation';
}

const organisationSlug = normaliseSlug(process.env.SEED_ORGANISATION_SLUG ?? process.env.DEMO_ORG_SLUG ?? 'demo-organisation');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetDevData cannot run when NODE_ENV=production.');
  }

  if (process.env.SEED_RESET_CONFIRM !== 'YES') {
    throw new Error('Set SEED_RESET_CONFIRM=YES to confirm local development data reset.');
  }

  await connectMongo();

  try {
    const organisation = await OrganisationModel.findOne({ slug: organisationSlug });
    if (!organisation) {
      console.log(`No organisation found for slug ${organisationSlug}. Nothing to reset.`);
      return;
    }

    const organisationId = organisation._id;
    const [users, roles, tokens, files, auditLogs, securityEvents] = await Promise.all([
      UserModel.deleteMany({ organisation_id: organisationId }),
      RoleModel.deleteMany({ organisation_id: organisationId }),
      TokenRecordModel.deleteMany({ organisation_id: organisationId }),
      FileAssetModel.deleteMany({ organisation_id: organisationId }),
      AuditLogModel.deleteMany({ organisation_id: organisationId }),
      SecurityEventModel.deleteMany({ organisation_id: organisationId })
    ]);
    const organisations = await OrganisationModel.deleteOne({ _id: organisationId });

    console.log('Local development data reset completed');
    console.log(JSON.stringify({
      version: '1.0.0',
      organisation_slug: organisationSlug,
      deleted: {
        organisations: organisations.deletedCount,
        users: users.deletedCount,
        roles: roles.deletedCount,
        tokens: tokens.deletedCount,
        file_assets: files.deletedCount,
        audit_logs: auditLogs.deletedCount,
        security_events: securityEvents.deletedCount
      }
    }, null, 2));
  } finally {
    await disconnectMongo();
  }
}

main().catch(async (error) => {
  console.error('Reset failed:', error);
  await disconnectMongo();
  process.exit(1);
});
