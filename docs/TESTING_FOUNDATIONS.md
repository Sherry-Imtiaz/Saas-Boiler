# Testing Foundations - v0.16.0

v0.16.0 adds the first formal automated testing foundation for the SaaS Boilerplate. The goal is to protect the core tenant, authentication, audit, security-event and health behaviours before future product modules are added.

## Test stack

The API test stack uses:

- Vitest for the TypeScript test runner.
- Supertest for HTTP/API integration tests against the Express app.
- mongodb-memory-server for isolated local integration tests when no test MongoDB URI is supplied.
- Mongoose cleanup hooks to clear collections between tests.

## Test commands

From the project root:

```cmd
npm test
npm run test:unit
npm run test:integration
npm run test:watch
```

The root `npm test` command intentionally runs the fast unit suite by default. This gives a quick signal without requiring MongoDB binary downloads.

## Integration tests

Integration tests cover live API route behaviour using Supertest:

```cmd
npm run test:integration
```

By default, the integration test setup tries to use `mongodb-memory-server`. If your machine blocks MongoDB binary downloads, start a local MongoDB container and provide a test URI instead:

```cmd
docker compose up -d
set TEST_MONGODB_URI=mongodb://localhost:27017/saas_boilerplate_test
npm run test:integration
```

PowerShell equivalent:

```powershell
$env:TEST_MONGODB_URI="mongodb://localhost:27017/saas_boilerplate_test"
npm run test:integration
```

## Current coverage

v0.16.0 adds tests for:

- Password hashing and verification.
- JWT signing and verification.
- Health liveness/readiness endpoints.
- Native login success and failed-login security event creation.
- Organisation-scoped audit log access.
- Platform audit log visibility.
- Audit permission enforcement.
- Organisation-scoped security event access.
- Security event filtering.
- Platform security event visibility.

## Test environment

A test environment example is included at:

```text
apps/api/.env.test.example
```

The test setup file also sets safe defaults at runtime for local test execution.

## Scope notes

This build does not attempt to test a real external OIDC provider. OIDC live-provider testing requires real issuer, client, secret, callback and JWKS configuration. Future builds can add mocked OIDC provider tests or contract tests against a local Keycloak container.
