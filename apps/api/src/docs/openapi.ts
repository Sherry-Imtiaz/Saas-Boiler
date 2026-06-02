const errorResponses = {
  "400": { "description": "Bad request", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
  "401": { "description": "Authentication error", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
  "403": { "description": "Permission, scope or tenant isolation error", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
  "404": { "description": "Resource not found", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } },
  "409": { "description": "Conflict", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } } }
} as const;

const successResponse = (description: string) => ({
  "description": description,
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean", "example": true },
          "message": { "type": "string" },
          "data": { "type": "object" }
        }
      }
    }
  }
});

const userInternalSecurity = [{ "UserSessionAuth": [] }, { "PersonalAccessTokenAuth": [] }];
const externalApiSecurity = [{ "OrganisationApiTokenAuth": [] }];

function tagForPermission(permission: string): string {
  if (permission.startsWith('auth')) return 'Auth';
  if (permission.startsWith('platform.organisations')) return 'Platform Admin';
  if (permission.startsWith('users.')) return 'Users';
  if (permission.startsWith('roles.') || permission.startsWith('permissions.')) return 'RBAC';
  if (permission.startsWith('tokens.')) return 'Tokens';
  if (permission.startsWith('organisation.branding')) return 'Branding';
  if (permission.startsWith('organisation.sso')) return 'SSO';
  if (permission.startsWith('organisation.mfa')) return 'MFA';
  if (permission.startsWith('organisation.auth')) return 'Tenant Security';
  if (permission.startsWith('features.')) return 'Features';
  if (permission.startsWith('plans.')) return 'Plans';
  if (permission.startsWith('files.')) return 'Files';
  if (permission.startsWith('audit.')) return 'Audit';
  if (permission.startsWith('security.')) return 'Security';
  if (permission.startsWith('internal.')) return 'Developer/System';
  return 'Developer/System';
}

function tenantScopeForPermission(permission: string): string {
  if (permission.startsWith('platform.') || permission.includes('.platform.')) return 'platform';
  if (permission.startsWith('internal.')) return 'developer/system';
  return 'organisation';
}

function publicTagForSummary(summary: string, description: string): string {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes('sso') || text.includes('oidc')) return 'SSO';
  if (text.includes('mfa')) return 'MFA';
  if (text.includes('theme') || text.includes('branding') || text.includes('asset')) return 'Branding';
  if (text.includes('login') || text.includes('auth')) return 'Auth';
  return 'Developer/System';
}

const internalGet = (summary: string, description: string, permission: string) => ({
  "tags": [tagForPermission(permission)],
  "summary": summary,
  "description": `${description} Authentication required: UserSessionAuth or PersonalAccessTokenAuth. Required permission/scope: ${permission}. Tenant scope: ${tenantScopeForPermission(permission)}. Internal/external classification is now endpoint metadata, not the Swagger group.`,
  "security": userInternalSecurity,
  "x-saas-classification": "internal",
  "x-required-permission": permission,
  "x-tenant-scope": tenantScopeForPermission(permission),
  "x-token-types": ["user_session_token", "personal_access_token"],
  "responses": { "200": successResponse(`${summary} succeeded.`), ...errorResponses }
});

const internalMutation = (methodSummary: string, description: string, permission: string) => ({
  "tags": [tagForPermission(permission)],
  "summary": methodSummary,
  "description": `${description} Authentication required: UserSessionAuth or PersonalAccessTokenAuth. Required permission/scope: ${permission}. Tenant scope: ${tenantScopeForPermission(permission)}. Mutating/sensitive routes should write audit or security events where applicable.`,
  "security": userInternalSecurity,
  "x-saas-classification": "internal",
  "x-required-permission": permission,
  "x-tenant-scope": tenantScopeForPermission(permission),
  "x-token-types": ["user_session_token", "personal_access_token"],
  "requestBody": { "required": false, "content": { "application/json": { "schema": { "type": "object" } } } },
  "responses": { "200": successResponse(`${methodSummary} succeeded.`), "201": successResponse(`${methodSummary} created resource.`), ...errorResponses }
});

const publicGet = (summary: string, description: string) => ({
  "tags": [publicTagForSummary(summary, description)],
  "summary": summary,
  "description": `${description} Authentication required: none. Classification: public-safe metadata only.`,
  "x-saas-classification": "public",
  "x-required-permission": null,
  "x-tenant-scope": "public-safe",
  "responses": { "200": successResponse(`${summary} succeeded.`), "400": errorResponses["400"], "404": errorResponses["404"] }
});

const domainInternalGet = (tag: string, summary: string, description: string, permission: string) => ({
  ...internalGet(summary, description, permission),
  "tags": [tag]
});

export const openApiSpec = {
  "openapi": "3.0.3",
  "info": {
    "title": "SaaS Boilerplate API",
    "version": "1.0.0",
    "description": "Organisation-first SaaS boilerplate API. v1.0.0 is the first stable release of the organisation-first SaaS boilerplate, including the stable backend foundation, production-style frontend, tenant/platform administration, local validation workflow and release-ready documentation."
  },
  "servers": [{ "url": "http://localhost:4000/api", "description": "Local development API" }],
  "tags": [
    { "name": "Auth", "description": "Login, current user, logout, token context and public authentication discovery APIs." },
    { "name": "Organisations", "description": "Organisation records and tenant profile APIs." },
    { "name": "Users", "description": "Organisation-owned user lifecycle APIs." },
    { "name": "RBAC", "description": "Roles, permissions and access-control catalogue APIs." },
    { "name": "Tokens", "description": "Personal access tokens, organisation API tokens and token policy metadata." },
    { "name": "Branding", "description": "Organisation branding, public theme and branding asset APIs." },
    { "name": "SSO", "description": "OIDC/SSO configuration, discovery and login-flow APIs." },
    { "name": "MFA", "description": "Organisation MFA policy and public MFA-policy discovery APIs." },
    { "name": "Features", "description": "Feature catalogue and organisation feature entitlement APIs." },
    { "name": "Plans", "description": "Plan catalogue, plan assignment and subscription-readiness APIs." },
    { "name": "Files", "description": "Organisation-owned file asset APIs." },
    { "name": "Audit", "description": "Organisation and platform audit log visibility APIs." },
    { "name": "Security", "description": "Organisation and platform security event visibility APIs." },
    { "name": "Tenant Security", "description": "Tenant-level auth configuration and security controls." },
    { "name": "Platform Admin", "description": "Platform-level administrative APIs requiring platform permissions." },
    { "name": "Developer/System", "description": "Health, schema and OpenAPI/developer support APIs." }
  ],
  "components": {
    "securitySchemes": {
      "BearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "Generic bearer auth scheme." },
      "UserSessionAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT user_session_token", "description": "Short-lived logged-in user token used by the frontend and Postman during development." },
      "PersonalAccessTokenAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT personal_access_token", "description": "Long-lived user-owned scoped token for Postman, scripts and user automation." },
      "OrganisationApiTokenAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT organisation_api_token", "description": "Organisation-owned token for external/system-to-system integrations. Uses external audience and external:* scopes." },
      "ServiceAccountTokenAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "Service Account Token", "description": "Reserved for later service identity requirements." }
    },
    "schemas": {
      "ErrorResponse": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean", "example": false },
          "error": { "type": "object", "properties": { "code": { "type": "string", "example": "FORBIDDEN" }, "message": { "type": "string" }, "details": { "type": "object" } } }
        }
      },
      "Plan": {
        "type": "object",
        "properties": {
          "key": { "type": "string", "example": "professional" },
          "name": { "type": "string", "example": "Professional" },
          "status": { "type": "string", "enum": ["active", "inactive", "archived"] },
          "billing_mode": { "type": "string", "enum": ["manual", "stripe_ready", "custom"] },
          "features": { "type": "object", "additionalProperties": { "type": "boolean" } },
          "limits": { "type": "object" }
        }
      },
      "OrganisationPlanAssignment": {
        "type": "object",
        "properties": {
          "plan_key": { "type": "string", "example": "professional" },
          "subscription_status": { "type": "string", "enum": ["trial", "active", "past_due", "suspended", "cancelled", "manual"] },
          "billing_mode": { "type": "string", "enum": ["manual", "stripe_ready", "custom"] },
          "limits": { "type": "object" },
          "features_from_plan": { "type": "boolean" }
        }
      },
      "FileAsset": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "organisation_id": { "type": "string" },
          "uploaded_by_user_id": { "type": "string" },
          "file_name": { "type": "string", "example": "customer-upload.csv" },
          "original_file_name": { "type": "string", "example": "customers.csv" },
          "mime_type": { "type": "string", "example": "text/csv" },
          "file_type": { "type": "string", "example": "spreadsheet" },
          "size_bytes": { "type": "number" },
          "storage_provider": { "type": "string", "enum": ["local", "azure_blob"], "example": "azure_blob" },
          "storage_key": { "type": "string" },
          "public_url": { "type": "string", "nullable": true, "example": "/api/public/branding-assets/64f1..." },
          "status": { "type": "string", "enum": ["active", "archived", "deleted"] }
        }
      },
      "AuditLog": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "organisation_id": { "type": "string" },
          "actor_user_id": { "type": "string", "nullable": true },
          "action": { "type": "string", "example": "auth.login.success" },
          "resource_type": { "type": "string", "example": "user" },
          "resource_id": { "type": "string", "nullable": true },
          "details": { "type": "object" },
          "ip_address": { "type": "string", "nullable": true },
          "user_agent": { "type": "string", "nullable": true },
          "created_at": { "type": "string", "format": "date-time" }
        }
      },
      "SecurityEvent": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "organisation_id": { "type": "string" },
          "actor_user_id": { "type": "string", "nullable": true },
          "event_type": { "type": "string", "example": "auth.login.failed" },
          "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
          "status": { "type": "string", "enum": ["success", "failure", "warning", "blocked", "info"] },
          "resource_type": { "type": "string", "nullable": true },
          "resource_id": { "type": "string", "nullable": true },
          "details": { "type": "object" },
          "ip_address": { "type": "string", "nullable": true },
          "user_agent": { "type": "string", "nullable": true },
          "created_at": { "type": "string", "format": "date-time" }
        }
      }
    }
  },
  "paths": {
    "/health": { "get": publicGet("Health check", "Returns API and MongoDB connection status.") },
    "/health/live": { "get": publicGet("Liveness check", "Returns 200 when the API process is alive. Does not require MongoDB.") },
    "/health/ready": { "get": publicGet("Readiness check", "Returns 200 only when the API is ready to receive traffic and MongoDB is connected. Returns 503 when not ready.") },
    "/docs": { "get": publicGet("Swagger UI", "Interactive Swagger/OpenAPI documentation route mounted under /api/docs.") },
    "/openapi.json": { "get": publicGet("OpenAPI JSON", "Raw OpenAPI JSON document route mounted under /api/openapi.json.") },

    "/public/organisation-login/{identifier}": { "get": publicGet("Get public organisation login branding", "Returns safe public login configuration by organisation slug or domain.") },
    "/public/organisation-theme/{identifier}": { "get": publicGet("Get public organisation theme", "Returns safe public organisation theme and branding tokens.") },
    "/public/branding-assets/{fileId}": { "get": publicGet("Get public branding FileAsset", "Serves active provider-backed branding FileAsset images for public login/theme rendering.") },
    "/public/assets/organisations/{organisationId}/branding/{fileName}": { "get": publicGet("Get legacy public branding asset", "Serves legacy v0.7.1 local development branding assets for backwards compatibility.") },
    "/public/organisation-auth-options/{identifier}": { "get": publicGet("Get public organisation auth options", "Returns safe public native/SSO auth options.") },
    "/public/organisation-mfa-policy/{identifier}": { "get": publicGet("Get public organisation MFA policy", "Returns safe public MFA policy hints for login screens.") },
    "/public/organisation-sso-options/{identifier}": { "get": publicGet("Get public organisation SSO options", "Returns safe public SSO options for future OIDC/SAML login screens.") },

    "/auth/login": { "post": { "tags": ["Auth"], "summary": "Native login", "description": "Authenticates an organisation-owned native user and returns a user_session_token. Authentication required: none. Classification: public auth entry point.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["email", "password"], "properties": { "organisation_slug": { "type": "string", "example": "demo-organisation" }, "email": { "type": "string", "example": "admin@example.com" }, "password": { "type": "string", "example": "ChangeMe123!" } } } } } }, "responses": { "200": successResponse("Login succeeded."), ...errorResponses } } },
    "/auth/me": { "get": { ...internalGet("Get current user", "Returns current authenticated user, organisation, roles and permissions.", "auth:me"), "tags": ["Auth"] } },
    "/auth/logout": { "post": { ...internalMutation("Logout acknowledgement", "Acknowledges logout for stateless local bearer token usage.", "auth:me"), "tags": ["Auth"] } },
    "/auth/token-context": { "get": { ...internalGet("Get current token context", "Returns token type, audience, scopes and MFA-aware token metadata.", "tokens.policy.view"), "tags": ["Auth"] } },
    "/auth/sso/{organisationSlug}/start": { "get": { "tags": ["SSO"], "summary": "Start OIDC SSO login", "description": "Builds an OIDC authorization-code + PKCE request for the selected organisation and redirects to the provider. Add ?redirect=false to return the authorization URL as JSON. Authentication required: none. Classification: public OIDC start route.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "parameters": [{ "name": "organisationSlug", "in": "path", "required": true, "schema": { "type": "string", "example": "demo-organisation" } }, { "name": "return_to", "in": "query", "required": false, "schema": { "type": "string", "example": "/dashboard" } }, { "name": "redirect", "in": "query", "required": false, "schema": { "type": "string", "example": "false" } }], "responses": { "200": successResponse("OIDC authorization URL returned."), "302": { "description": "Redirect to OIDC provider authorization endpoint." }, ...errorResponses } } },
    "/auth/sso/callback": { "get": { "tags": ["SSO"], "summary": "Complete OIDC SSO callback", "description": "Completes OIDC authorization-code + PKCE login, exchanges the code, validates the RS256 id_token with JWKS, provisions or updates the user, applies group-role mapping and redirects with a short-lived one-time exchange code instead of a bearer token. Authentication required: none. Classification: public OIDC callback route.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "parameters": [{ "name": "code", "in": "query", "required": true, "schema": { "type": "string" } }, { "name": "state", "in": "query", "required": true, "schema": { "type": "string" } }], "responses": { "200": successResponse("OIDC login succeeded."), "302": { "description": "Redirect to frontend callback URL with sso=success and a short-lived exchange code." }, ...errorResponses } }, "post": { "tags": ["SSO"], "summary": "Complete OIDC SSO callback from SPA", "description": "POST variant of the OIDC callback for clients that capture code/state and complete the exchange via JSON. Authentication required: none. Classification: public OIDC callback route.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["code", "state"], "properties": { "code": { "type": "string" }, "state": { "type": "string" } } } } } }, "responses": { "200": successResponse("OIDC login succeeded."), ...errorResponses } } },
    "/auth/sso/exchange": { "post": { "tags": ["SSO"], "summary": "Exchange SSO callback code", "description": "Exchanges a short-lived one-time SSO callback code for a user_session_token. Authentication required: none. Classification: public OIDC callback route.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["code"], "properties": { "code": { "type": "string" } } } } } }, "responses": { "200": successResponse("SSO exchange succeeded."), ...errorResponses } } },
    "/auth/sso/{organisationSlug}/logout": { "get": { "tags": ["SSO"], "summary": "Start OIDC provider logout", "description": "Builds or redirects to the configured OIDC provider logout endpoint. Authentication required: none; local bearer tokens remain stateless and must be discarded by the client. Classification: public OIDC logout helper.", "x-saas-classification": "public", "x-tenant-scope": "organisation-login", "parameters": [{ "name": "organisationSlug", "in": "path", "required": true, "schema": { "type": "string", "example": "demo-organisation" } }, { "name": "redirect", "in": "query", "required": false, "schema": { "type": "string", "example": "false" } }], "responses": { "200": successResponse("OIDC logout URL returned."), "302": { "description": "Redirect to OIDC provider logout endpoint." }, ...errorResponses } } },

    "/permissions": { "get": internalGet("List permissions", "Returns global permission catalogue.", "permissions.view") },
    "/internal/schema/status": { "get": internalGet("Get schema status", "Returns model/index/collection status for the internal MongoDB schema foundation.", "internal.schema.view") },

    "/platform/organisations": { "get": internalGet("List organisations", "Lists platform organisations.", "platform.organisations.view"), "post": internalMutation("Create organisation", "Creates a platform organisation.", "platform.organisations.manage") },
    "/platform/organisations/{id}": { "get": internalGet("Get organisation", "Returns one organisation by id.", "platform.organisations.view"), "patch": internalMutation("Update organisation", "Updates organisation profile/domain metadata.", "platform.organisations.manage") },
    "/platform/organisations/{id}/status": { "patch": internalMutation("Update organisation status", "Updates organisation active/inactive/suspended state.", "platform.organisations.manage") },

    "/org/audit-logs": { "get": domainInternalGet("Audit", "List organisation audit logs", "Lists audit logs for the authenticated organisation. Supports page, limit, action, resource_type, actor_user_id, from and to query filters. Scope: organisation.", "audit.view") },
    "/org/audit-logs/{auditLogId}": { "get": domainInternalGet("Audit", "Get organisation audit log", "Returns one audit log that belongs to the authenticated organisation. Scope: organisation.", "audit.view") },
    "/platform/audit-logs": { "get": domainInternalGet("Audit", "List platform audit logs", "Lists audit logs across organisations for platform administrators. Scope: platform.", "audit.platform.view") },
    "/platform/audit-logs/{auditLogId}": { "get": domainInternalGet("Audit", "Get platform audit log", "Returns one audit log across organisations for platform administrators. Scope: platform.", "audit.platform.view") },
    "/platform/organisations/{organisationId}/audit-logs": { "get": domainInternalGet("Audit", "List platform organisation audit logs", "Lists audit logs for a selected organisation when the caller has platform audit visibility. Scope: platform.", "audit.platform.view") },
    "/org/security-events": { "get": domainInternalGet("Security", "List organisation security events", "Lists security events for the authenticated organisation. Supports page, limit, event_type, severity, status, actor_user_id, from and to query filters. Scope: organisation.", "security.events.view") },
    "/org/security-events/{securityEventId}": { "get": domainInternalGet("Security", "Get organisation security event", "Returns one security event that belongs to the authenticated organisation. Scope: organisation.", "security.events.view") },
    "/platform/security-events": { "get": domainInternalGet("Security", "List platform security events", "Lists security events across organisations for platform administrators. Scope: platform.", "security.events.platform.view") },
    "/platform/security-events/{securityEventId}": { "get": domainInternalGet("Security", "Get platform security event", "Returns one security event across organisations for platform administrators. Scope: platform.", "security.events.platform.view") },
    "/platform/organisations/{organisationId}/security-events": { "get": domainInternalGet("Security", "List platform organisation security events", "Lists security events for a selected organisation when the caller has platform security visibility. Scope: platform.", "security.events.platform.view") },

    "/platform/organisations/{organisationId}/users": { "get": internalGet("List organisation users", "Lists users under the requested organisation.", "users.view"), "post": internalMutation("Create organisation user", "Creates a user under the requested organisation. Users cannot exist without an organisation.", "users.create") },
    "/platform/organisations/{organisationId}/users/{userId}": { "get": internalGet("Get organisation user", "Returns one user under the requested organisation.", "users.view"), "patch": internalMutation("Update organisation user", "Updates user profile/auth/role metadata.", "users.update") },
    "/platform/organisations/{organisationId}/users/{userId}/status": { "patch": internalMutation("Update user status", "Enables/disables an organisation-owned user.", "users.disable") },

    "/org/roles": { "get": internalGet("List organisation roles", "Lists roles for the authenticated organisation.", "roles.view"), "post": internalMutation("Create organisation role", "Creates an organisation-scoped role.", "roles.manage") },
    "/org/roles/{roleId}": { "get": internalGet("Get organisation role", "Returns one role in the authenticated organisation.", "roles.view"), "patch": internalMutation("Update organisation role", "Updates role permissions/description.", "roles.manage"), "delete": internalMutation("Delete organisation role", "Deletes a non-system, unassigned role.", "roles.manage") },

    "/org/branding": { "get": internalGet("Get organisation branding", "Returns branding and theme settings.", "organisation.branding.view"), "patch": internalMutation("Update organisation branding", "Updates login and website branding fields.", "organisation.branding.manage") },
    "/org/branding/theme": { "get": internalGet("Get organisation theme", "Returns website theme tokens.", "organisation.branding.view"), "patch": internalMutation("Update organisation theme", "Updates website theme tokens.", "organisation.branding.manage") },
    "/org/branding/theme-yaml": { "get": internalGet("Export organisation theme YAML", "Exports current theme as YAML.", "organisation.branding.view"), "post": internalMutation("Import organisation theme YAML", "Imports validated theme YAML.", "organisation.branding.manage") },
    "/org/branding/assets/{assetType}": { "post": internalMutation("Upload branding asset", "Uploads a base64 branding image, creates an organisation-owned FileAsset, captures image metadata, stores it through the configured local/Azure Blob storage provider, and links it to the organisation branding field.", "organisation.branding.manage"), "delete": internalMutation("Clear branding asset", "Clears a branding asset reference and archives the linked FileAsset when present.", "organisation.branding.manage") },

    "/org/auth-config": { "get": internalGet("Get organisation auth config", "Returns native/mixed/SSO-ready auth configuration.", "organisation.auth.view"), "patch": internalMutation("Update organisation auth config", "Updates native/SSO-ready auth settings.", "organisation.auth.manage") },
    "/org/mfa-policy": { "get": internalGet("Get organisation MFA policy", "Returns provider-neutral MFA policy metadata.", "organisation.mfa.view"), "patch": internalMutation("Update organisation MFA policy", "Updates provider-neutral MFA policy metadata.", "organisation.mfa.manage") },
    "/org/sso-config/supported-providers": { "get": { ...internalGet("List SSO supported providers", "Returns setup hints for Keycloak, Azure Entra, Okta, Google and custom OIDC.", "organisation.sso.view"), "tags": ["SSO"] } },
    "/org/sso-config": { "get": { ...internalGet("Get organisation SSO config", "Returns saved SSO provider configuration.", "organisation.sso.view"), "tags": ["SSO"] }, "patch": { ...internalMutation("Update organisation SSO config", "Updates active OIDC provider configuration.", "organisation.sso.manage"), "tags": ["SSO"] } },
    "/org/sso-config/test": { "post": { ...internalMutation("Validate organisation SSO config", "Runs local validation against saved SSO provider configuration.", "organisation.sso.view"), "tags": ["SSO"] } },

    "/features/catalogue": { "get": internalGet("List feature catalogue", "Returns global feature entitlement catalogue.", "features.view") },
    "/org/features": { "get": internalGet("Get organisation features", "Returns organisation feature entitlement state.", "features.view"), "patch": internalMutation("Update organisation features", "Updates organisation feature entitlement flags.", "features.manage") },

    "/platform/plans": { "get": internalGet("List plan catalogue", "Returns SaaS plan catalogue, feature defaults and limits. No payment gateway is active in v0.9.1.", "plans.view"), "post": internalMutation("Create or upsert plan", "Creates/updates a plan catalogue item for subscription readiness.", "plans.manage") },
    "/platform/plans/{planKey}": { "get": internalGet("Get plan by key", "Returns one plan catalogue item.", "plans.view"), "patch": internalMutation("Update plan by key", "Updates plan pricing placeholders, feature defaults or limits.", "plans.manage") },
    "/org/plan": { "get": internalGet("Get current organisation plan", "Returns the authenticated organisation's plan assignment, effective limits and feature readiness metadata.", "plans.view") },
    "/platform/organisations/{organisationId}/plan": { "get": internalGet("Get platform organisation plan", "Returns plan assignment for a requested organisation. Also requires platform.organisations.view in the route guard.", "plans.view"), "patch": internalMutation("Assign organisation plan", "Assigns a plan and optionally applies plan feature defaults and limits. Also requires platform.organisations.manage in the route guard.", "plans.manage") },
    "/platform/organisations/{organisationId}/plan/apply-defaults": { "post": internalMutation("Apply organisation plan defaults", "Applies assigned plan feature defaults and limits to the organisation. Also requires platform.organisations.manage in the route guard.", "plans.manage") },

    "/org/files": { "get": internalGet("List organisation files", "Lists file assets for the authenticated organisation. Requires feature: file_uploads. Authentication: UserSessionAuth or PersonalAccessTokenAuth.", "files.view"), "post": internalMutation("Upload organisation file", "Uploads a base64 file payload through the configured storage provider. Local storage is used by default; Azure Blob/Azurite can be selected with STORAGE_PROVIDER=azure_blob. Requires feature: file_uploads and plan file/storage limit checks.", "files.upload") },
    "/org/files/{fileId}": { "get": internalGet("Get organisation file", "Returns file metadata for one organisation-owned file. Requires feature: file_uploads.", "files.view"), "delete": internalMutation("Archive organisation file", "Archives an organisation-owned file asset while keeping metadata for auditability. Requires feature: file_uploads.", "files.delete") },
    "/org/files/{fileId}/download": { "get": internalGet("Download organisation file", "Downloads one active organisation-owned file through the configured storage provider. Requires feature: file_uploads.", "files.view") },

    "/org/personal-access-tokens": { "get": internalGet("List personal access tokens", "Lists current user's personal access tokens.", "tokens.personal.manage"), "post": internalMutation("Create personal access token", "Creates a user-owned long-lived scoped token. Raw token is returned once.", "tokens.personal.manage") },
    "/org/personal-access-tokens/{tokenId}": { "delete": internalMutation("Revoke personal access token", "Revokes a user-owned personal access token.", "tokens.personal.manage") },
    "/org/api-tokens": { "get": internalGet("List organisation API tokens", "Lists organisation-owned external integration tokens.", "tokens.organisation.manage"), "post": internalMutation("Create organisation API token", "Creates an organisation-owned external integration token. Raw token is returned once.", "tokens.organisation.manage") },
    "/org/api-tokens/{tokenId}/status": { "patch": internalMutation("Update organisation API token status", "Updates organisation API token status.", "tokens.organisation.manage") },
    "/org/api-tokens/{tokenId}": { "delete": internalMutation("Revoke organisation API token", "Revokes an organisation API token.", "tokens.organisation.manage") },
    "/external/token-context": { "get": { "tags": ["Tokens"], "summary": "Get external token context", "description": "Validates an organisation_api_token and returns external token context. Authentication required: OrganisationApiTokenAuth. Required scope: external:organisation.read. Classification: external system-to-system. Tenant scope: organisation.", "security": externalApiSecurity, "x-saas-classification": "external", "x-required-scope": "external:organisation.read", "x-tenant-scope": "organisation", "x-token-types": ["organisation_api_token"], "responses": { "200": successResponse("External token context returned."), ...errorResponses } } }
  }
} as const;
