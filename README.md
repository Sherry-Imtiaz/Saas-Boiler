# SaaS Boilerplate

Organisation-first SaaS boilerplate with MongoDB, Node.js API and React frontend.

Current version:

```text
v1.0.0 - Stable Release
```

## Canonical build path

```text
v0.10.2 - Image Handling and Branding Asset Migration
v0.11.0 - Audit Logging Expansion and Security Events
v0.12.0 - Complete OIDC / SSO Build
v0.13.0 - API Security Hardening + Swagger Domain Refactor
v0.14.0 - Seed and Installer Scripts
v0.15.0 - Deployment Readiness
v0.16.0 - Testing Foundations
v0.17.0 - Authentication UI + Organisation Owner Admin UI
v0.18.0 - Platform Owner Admin UI
v0.18.1 - Stabilisation and Local Validation
v0.18.2 - Seed Stabilisation Patch
v0.19.0 - Production UI Rebuild
v1.0.0 - Stable Release
```

## What v1.0.0 includes

v1.0.0 is the first stable release of the SaaS Boilerplate. It consolidates the backend foundation, production-style frontend, tenant administration, platform administration, testing foundation, local validation scripts and deployment readiness documentation into a single release baseline.

Highlights:

- Organisation-first tenant model: `Organisation -> Users`.
- Native login with JWT user session tokens.
- OIDC / SSO authorization-code + PKCE login flow.
- RBAC roles, permissions and route guards.
- Personal Access Tokens and Organisation API Tokens.
- Tenant branding, login customisation and branding assets.
- FileAsset-backed local/Azure-compatible storage abstraction.
- Plans and feature entitlements.
- Audit logs and security events.
- Domain-based Swagger/OpenAPI documentation.
- Windows-friendly setup, seed, reset and validation scripts.
- Deployment readiness checks and liveness/readiness endpoints.
- Vitest/Supertest testing foundation.
- Organisation Owner administration UI.
- Platform Owner administration UI.
- Production-style React application shell.

## Local setup

```cmd
npm run setup:local
npm install --registry=https://registry.npmjs.org/
docker compose up -d
npm run seed
npm run dev
```

Manual env setup is also supported:

```cmd
copy appspi\.env.example appspi\.env
copy apps\web\.env.example apps\web\.env
```

Default seeded login:

```text
Organisation slug: demo-organisation
Email: admin@example.com
Password: ChangeMe123!
```

The seeded development admin has broad permissions so both Organisation Owner and Platform Owner workspaces are visible. In production, platform access must be assigned only to trusted platform owner/admin users.

## Local validation

Quick validation without MongoDB:

```cmd
npm run validate:local
```

Full local validation with Docker MongoDB:

```cmd
docker compose up -d
npm run seed
npm run check:install
npm run build
npm test
npm run test:integration:local
npm run dev
```

## Tests

Fast unit tests:

```cmd
npm test
```

Integration tests using local Docker MongoDB:

```cmd
npm run test:integration:local
```

Manual equivalent:

```cmd
set TEST_MONGODB_URI=mongodb://localhost:27017/saas_boilerplate_test
npm run test:integration
```

Optional memory-server mode:

```cmd
npm run test:integration:memory
```

This mode may download a MongoDB binary the first time it runs.

## Runtime URLs

```text
Frontend: http://localhost:5173
API health: http://localhost:4000/api/health
API liveness: http://localhost:4000/api/health/live
API readiness: http://localhost:4000/api/health/ready
Swagger: http://localhost:4000/api/docs
OpenAPI JSON: http://localhost:4000/api/openapi.json
```

## Documentation

Important docs:

```text
docs/API_DOCUMENTATION_POLICY.md
docs/API_SECURITY_HARDENING.md
docs/OIDC_SSO_BUILD.md
docs/SEED_AND_INSTALLER_SCRIPTS.md
docs/DEPLOYMENT_READINESS.md
docs/TESTING_FOUNDATIONS.md
docs/ORGANISATION_OWNER_ADMIN_UI.md
docs/PLATFORM_OWNER_ADMIN_UI.md
docs/LOCAL_VALIDATION_RUNBOOK.md
docs/PRODUCTION_UI_REBUILD.md
docs/PRODUCTION_ENVIRONMENT_CHECKLIST.md
docs/PRODUCTION_RELEASE_CHECKLIST_v1.0.0.md
docs/RELEASE_NOTES_v1.0.0.md
docs/VERSION_CONTEXT_v1.0.0.txt
```

## OpenAPI

Runtime Swagger:

```text
http://localhost:4000/api/docs
```

Static docs:

```text
docs/openapi/openapi.v1.0.0.json
docs/openapi/openapi.v1.0.0.yaml
```
