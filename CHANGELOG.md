# Changelog

## v1.0.0 - Stable Release

- Promoted the SaaS Boilerplate to the first stable release baseline.
- Preserved the v0.19.0 production UI rebuild and all prior backend modules.
- Updated package, API, web, health, schema, seed, deployment and frontend version metadata to 1.0.0.
- Added final release documentation: `docs/RELEASE_NOTES_v1.0.0.md`, `docs/PRODUCTION_RELEASE_CHECKLIST_v1.0.0.md` and `docs/VERSION_CONTEXT_v1.0.0.txt`.
- Added static OpenAPI release files: `docs/openapi/openapi.v1.0.0.json` and `docs/openapi/openapi.v1.0.0.yaml`.
- Confirmed the release as a consolidation build rather than a new feature module.

## v0.19.0 - Production UI Rebuild

- Replaced the prototype admin UI with a production-style React application shell.
- Added a polished tenant-branded authentication experience with organisation lookup, password login and SSO launch support.
- Added workspace-aware navigation for Organisation Owner and Platform Owner administration.
- Rebuilt organisation administration pages for dashboard, users, roles/permissions, branding/login customisation, SSO/MFA, tokens, files/assets, audit/security and developer context.
- Rebuilt platform administration pages for dashboard, organisations, plan assignment/catalogue, cross-tenant audit/security and system/developer context.
- Added reusable UI patterns for cards, metrics, data tables, forms, badges, empty states and notices.
- Kept backend APIs, database models, security foundations, seed scripts and validation workflow from v0.18.2.
- Updated runtime version metadata, README, documentation and static OpenAPI files to v0.19.0.


## v0.18.2 - Seed Stabilisation Patch

- Fixed the MongoDB seed upsert conflict for the demo admin user by moving `organisation_id`, `status` and `role_ids` into `$set` only.
- Preserved insert-only fields such as email, display name, native password hash and profile timezone in `$setOnInsert`.
- Patched `package-lock.json` resolved tarball URLs to use the public npm registry so Windows installs do not try to download from an internal build-environment mirror.
- Updated runtime version metadata, README, local validation notes and static OpenAPI JSON/YAML files to v0.18.2.
- Added `docs/SEED_STABILISATION_PATCH.md` and `docs/VERSION_CONTEXT_v0.18.2.txt`.

## v0.18.1 - Stabilisation and Local Validation

- Patched Windows helper scripts so paths with spaces are handled correctly.
- Added `scripts/validate-local.cmd` for repeatable local validation: setup files, build, unit tests and deployment readiness check without DB.
- Added `scripts/test-integration-local.cmd` for Docker-backed integration testing with `TEST_MONGODB_URI`.
- Added `scripts/test-integration-memory.cmd` for optional mongodb-memory-server testing when a binary download is available.
- Updated integration test setup to prefer local/Docker MongoDB by default and only use mongodb-memory-server when `USE_MONGODB_MEMORY_SERVER=true`.
- Updated `.env.test.example` with the new testing mode flag.
- Updated runtime version metadata and static OpenAPI JSON/YAML files to v0.18.1.
- Added `docs/LOCAL_VALIDATION_RUNBOOK.md` and `docs/VERSION_CONTEXT_v0.18.1.txt`.

## v0.18.0 - Platform Owner Admin UI

- Added dedicated Platform Owner Admin UI surface separate from Organisation Owner UI.
- Added platform dashboard with organisation, plan, cross-tenant audit/security and readiness metrics.
- Added all-organisations UI for create, activate and suspend operations.
- Added organisation plan assignment workflow and apply-defaults action.
- Added global plan catalogue create/update UI.
- Added cross-tenant audit log and security event viewers.
- Added platform system/developer screen with health, readiness and OpenAPI links.
- Added frontend API service helpers for platform organisation, plan and cross-tenant log APIs.
- Updated runtime version metadata and static OpenAPI JSON/YAML files to v0.18.0.
- Added docs/PLATFORM_OWNER_ADMIN_UI.md and docs/VERSION_CONTEXT_v0.18.0.txt.

## v0.17.0 - Authentication UI + Organisation Owner Admin UI

- Added tenant-branded login screen, organisation login lookup and SSO launch button.
- Added Organisation Owner dashboard and tenant-side admin layout.
- Added organisation user management, role visibility, branding, SSO, MFA, token, audit, security, plan/feature and file visibility screens.
- Added developer/API context screen for tenant admins.
- Updated runtime version metadata and static OpenAPI JSON/YAML files to v0.17.0.

## v0.16.0 - Testing Foundations

- Added Vitest unit test configuration and root npm test scripts.
- Added Supertest API integration testing foundation.
- Added mongodb-memory-server support with TEST_MONGODB_URI override for local Docker MongoDB testing.
- Added reusable test setup and test data helpers.
- Added unit tests for password hashing/verification and JWT signing/verification.
- Added integration tests for health, native login, failed-login security events, audit log scoping, platform audit visibility, security event scoping, security event filtering and platform security visibility.
- Added apps/api/.env.test.example and docs/TESTING_FOUNDATIONS.md.

## v0.15.0 - Deployment Readiness

- Added liveness and readiness endpoints: `/api/health/live` and `/api/health/ready`.
- Updated health metadata to v0.15.0.
- Added `apps/api/.env.production.example` and `apps/web/.env.production.example`.
- Added `apps/api/src/scripts/checkDeploymentReadiness.ts` for production-style environment and MongoDB readiness validation.
- Added root npm scripts: `check:deployment`, `build:production`, `start:production` and `deploy:check`.
- Added Windows wrapper scripts: `deployment-readiness.cmd`, `build-production.cmd` and `start-production-api.cmd`.
- Added `docs/DEPLOYMENT_READINESS.md` and `docs/PRODUCTION_ENVIRONMENT_CHECKLIST.md`.
- Updated runtime OpenAPI metadata and static OpenAPI JSON/YAML files to v0.15.0.
- Added v0.15.0 version context.

## v0.14.0 - Seed and Installer Scripts

- Added `scripts/setup-local.mjs` to create local env files, create the API storage folder and generate safe local secrets when placeholders are used.
- Added Windows wrapper scripts: `install-local.cmd`, `seed-local.cmd`, `check-local.cmd` and `reset-local-data.cmd`.
- Added configurable seed values for organisation name, slug, domain, admin user, admin password and plan key.
- Updated the seed process to remain idempotent while supporting configurable seeded organisation/admin data.
- Added `apps/api/src/scripts/checkInstall.ts` to verify seeded local readiness.
- Added `apps/api/src/scripts/resetDevData.ts` for guarded local development reset of the configured seeded organisation.
- Added npm scripts for local setup, install checks and reset flow.
- Updated `.env.example` with seed/installer defaults.
- Updated runtime OpenAPI metadata and schema status to v0.14.0.
- Added `docs/SEED_AND_INSTALLER_SCRIPTS.md`.
- Added v0.14.0 version context and static OpenAPI JSON/YAML files.

## v0.13.0 - API Security Hardening + Swagger Domain Refactor

- Refactored Swagger/OpenAPI grouping into domain-based tags: Auth, Organisations, Users, RBAC, Tokens, Branding, SSO, MFA, Features, Plans, Files, Audit, Security, Tenant Security, Platform Admin and Developer/System.
- Moved Internal/External/Public classification into endpoint metadata such as `x-saas-classification`, `x-required-permission`, `x-tenant-scope` and `x-token-types`.
- Added stable machine-readable API error codes to the global error response structure.
- Updated `HttpError` with default HTTP-status-to-error-code mapping.
- Updated the global error handler to emit `{ success: false, error: { code, message, details } }`.
- Added `requireAllPermissions()` for sensitive routes that need more than one permission.
- Hardened platform organisation plan routes to require both platform organisation permissions and plan permissions.
- Improved permission and token-scope error messages while preserving required permission/scope in structured details.
- Fixed local development handling for empty `OIDC_STATE_SECRET=` values.
- Added `docs/API_SECURITY_HARDENING.md`.
- Added v0.13.0 version context and static OpenAPI JSON/YAML files.

## v0.12.0 - Complete OIDC / SSO Build

- Activated OIDC authorization-code + PKCE login flow.
- Added `/api/auth/sso/:organisationSlug/start` for provider redirect generation.
- Added GET and POST `/api/auth/sso/callback` handlers for code exchange and local session token issuance.
- Added `/api/auth/sso/:organisationSlug/logout` for provider logout URL generation.
- Added OIDC discovery resolution and manual endpoint fallback.
- Added stateless signed OIDC state with nonce, expiry and PKCE verifier.
- Added token exchange against the configured OIDC token endpoint.
- Added RS256 id_token validation using provider JWKS.
- Added issuer, audience, expiry, nonce and verified-email claim checks.
- Added OIDC subject/provider tracking on the User auth model.
- Added organisation-scoped OIDC user auto-provisioning when enabled.
- Added group-to-role mapping during SSO login.
- Added OIDC start/login/provision security and audit events.
- Updated public SSO options to point to the active OIDC start URL.
- Added OIDC SSO documentation and v0.12.0 version context.
- Updated Swagger/OpenAPI runtime and static OpenAPI JSON/YAML files.

## v0.11.0 - Audit Logging Expansion and Security Events

- Added SecurityEvent MongoDB model with organisation, actor, event type, severity, status and timestamp indexes.
- Added reusable audit/security helpers for consistent audit and security event creation.
- Added organisation audit log APIs.
- Added platform audit log APIs.
- Added organisation security event APIs.
- Added platform security event APIs.
- Added query filtering for audit logs and security events.
- Added security event logging for login, logout, personal access token lifecycle, organisation API token lifecycle, auth config, MFA policy and SSO config actions.
- Added audit.platform.view, security.events.view and security.events.platform.view permissions.
- Updated seed script with v0.11.0 readiness audit/security records.
- Updated schema status to include the SecurityEvent collection.
- Updated Swagger/OpenAPI runtime spec and generated static OpenAPI JSON/YAML files.
- Added v0.11.0 version context document.

## v0.10.2 - Image Handling and Branding Asset Migration

- Migrated organisation branding asset uploads onto provider-backed FileAsset records.
- Added FileAsset id references to organisation branding fields for logo, favicon, login background, sidebar logo and email logo.
- Added public branding FileAsset route at /api/public/branding-assets/:fileId.
- Added image metadata extraction for PNG, JPEG, WebP and SVG where dimensions are available.
- Updated branding asset delete flow to clear organisation branding references and archive the linked FileAsset.
- Preserved the legacy v0.7.1 local branding asset route for backwards compatibility during development upgrades.
- Updated the React branding UI wording to reflect FileAsset/provider-backed storage.
- Updated Swagger/OpenAPI documentation and static OpenAPI files.
- Added v0.10.2 version context document.

## v0.10.1 - Azure Blob Storage Provider Abstraction

- Added provider-based file storage abstraction.
- Added LocalStorageProvider for development.
- Added AzureBlobStorageProvider for Azure Blob Storage and Azurite-compatible testing.
- Added STORAGE_PROVIDER and Azure Blob environment variables.
- Added Azurite service to Docker Compose.
- Updated file upload/download/archive APIs to use the configured storage provider.
- Updated FileAsset storage_provider to support local and azure_blob.
- Added storage provider summary to schema status.
- Updated Swagger/OpenAPI documentation and static OpenAPI files.
- Added v0.10.1 version context document.

## v0.10.0 - File Asset Foundation

- Added FileAsset MongoDB model.
- Added organisation-owned file metadata and indexes.
- Added local development file storage under apps/api/storage/organisations/{organisation_id}/files.
- Added file upload API using JSON/base64 payloads.
- Added file list, view, download and archive APIs.
- Added file_uploads feature gate enforcement for file APIs.
- Added files.view, files.upload and files.delete permission enforcement.
- Added plan limit checks for max_file_size_mb and max_storage_gb.
- Added active organisation storage usage calculation.
- Added file audit logs for upload, download and archive events.
- Added Files page to the React admin UI.
- Added file collection to schema status checks.
- Updated seed/readiness context to support file upload testing through the professional plan.
- Updated Swagger/OpenAPI documentation and static OpenAPI files.
- Updated version context document.

The build uses local development storage only. Object storage/S3-compatible provider abstraction is planned for a later build.
