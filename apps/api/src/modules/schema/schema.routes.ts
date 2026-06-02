import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { AuditLogModel, SecurityEventModel, OrganisationModel, PermissionModel, PlanModel, FileAssetModel, RoleModel, TokenRecordModel, UserModel } from '../../models/index.js';
import { getStorageProviderConfigSummary } from '../../utils/storageProvider.js';

export const schemaRouter = Router();

schemaRouter.get('/status', requireAuth, requirePermission('internal.schema.view'), async (_req, res, next) => {
  try {
    const models = [OrganisationModel, UserModel, RoleModel, PermissionModel, PlanModel, FileAssetModel, TokenRecordModel, AuditLogModel, SecurityEventModel];

    const collection_status = await Promise.all(
      models.map(async (model) => ({
        model: model.modelName,
        collection: model.collection.name,
        indexes_declared: model.schema.indexes().map(([fields, options]) => ({ fields, options })),
        estimated_document_count: await model.estimatedDocumentCount()
      }))
    );

    res.json({
      success: true,
      version: '1.0.0',
      message: 'MongoDB schema foundation is loaded, protected by RBAC, includes active token foundations, file asset metadata, provider-backed branding FileAsset migration, audit/security event collections, and v1.0.0 release validation checks, liveness/readiness endpoints, production environment examples, configurable seed data, local installer scripts, API security hardening, domain OpenAPI tags and active OIDC SSO login readiness.',
      tenant_model: 'Organisation -> Users. Users require organisation_id and cannot belong to more than one organisation.',
      authentication: {
        required: true,
        type: 'Bearer user session token or scoped personal access token for internal APIs; organisation API token for external APIs',
        token_types_active: ['user_session_token', 'personal_access_token', 'organisation_api_token'],
        token_types_planned: ['service_account_token'],
        organisation_auth_config: 'active: native/mixed/oidc/saml settings, allowed domains, default role, active OIDC authorization-code + PKCE login and SSO/MFA enforcement flags',
        required_permission: 'internal.schema.view'
      },
      storage_provider: getStorageProviderConfigSummary(),
      collection_status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});
