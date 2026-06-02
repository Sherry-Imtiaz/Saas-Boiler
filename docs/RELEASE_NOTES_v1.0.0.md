# v1.0.0 - Stable Release Notes

## Release summary

v1.0.0 is the first stable release of the organisation-first SaaS Boilerplate. It consolidates all development from the early application skeleton through the production UI rebuild into a single release-ready baseline.

This release is built from v0.19.0 and keeps the backend stable while updating release metadata, documentation, OpenAPI static files and final validation context.

## Major capabilities included

- Organisation-first multi-tenancy.
- Native login and JWT user sessions.
- OIDC / SSO authorization-code + PKCE login.
- RBAC roles, permissions and route guards.
- Personal Access Tokens and Organisation API Tokens.
- Tenant branding and login customisation.
- File and branding asset handling with local/Azure-compatible storage abstraction.
- Plans and feature entitlements.
- Audit logs and security events.
- Domain-based Swagger/OpenAPI documentation.
- Windows-friendly setup, seed, reset and validation scripts.
- Deployment readiness checks and liveness/readiness endpoints.
- Vitest/Supertest testing foundation.
- Organisation Owner administration UI.
- Platform Owner administration UI.
- Production-style React application shell.

## Release validation

The expected validation commands are:

```cmd
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm test
node scripts/setup-local.mjs
npm run check:deployment -- --skip-db
```

For full database-backed validation on Windows:

```cmd
docker compose up -d
npm run seed
npm run check:install
npm run test:integration:local
npm run dev
```

## Known release notes

- The default seed user is for local development only and has broad permissions to make both Organisation Owner and Platform Owner UI areas visible.
- Production deployments must replace all default secrets and should assign platform permissions only to trusted platform owner/admin users.
- `mongodb-memory-server` remains optional. Local Docker MongoDB is the preferred integration-test path for Windows development.
- Billing, compute allocation and advanced custom role editing remain future modules, not part of v1.0.0.
