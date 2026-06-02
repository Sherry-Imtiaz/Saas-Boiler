# v0.18.2 - Local Validation Runbook

This runbook is for validating the SaaS Boilerplate locally on Windows after the Platform Owner Admin UI build.

## v0.18.2 seed patch note

v0.18.2 keeps the v0.18.1 local validation workflow and fixes the demo seed upsert conflict that could occur during `npm run seed` on Windows. It also patches `package-lock.json` tarball URLs to use the public npm registry.

## Purpose

v0.18.2 is a patch release. It does not add a new product module. It preserves the v0.18.1 local setup/validation workflow and fixes the demo seed conflict found during Windows validation.

## Recommended Windows validation flow

From the project root:

```cmd
npm run setup:local
npm install
docker compose up -d
npm run seed
npm run check:install
npm run build
npm test
npm run test:integration:local
npm run dev
```

Open:

```text
Frontend: http://localhost:5173
API health: http://localhost:4000/api/health
API liveness: http://localhost:4000/api/health/live
API readiness: http://localhost:4000/api/health/ready
Swagger: http://localhost:4000/api/docs
```

Default seeded login:

```text
Organisation slug: demo-organisation
Email: admin@example.com
Password: ChangeMe123!
```

## One-command local validation

For a quick code-level validation that does not require MongoDB:

```cmd
npm run validate:local
```

This runs:

```text
setup-local
build
unit tests
deployment readiness check with --skip-db
```

It does not seed data and does not run integration tests.

## Integration testing modes

### Recommended: Docker/local MongoDB

```cmd
docker compose up -d
npm run test:integration:local
```

`test:integration:local` sets the default test database to:

```text
mongodb://localhost:27017/saas_boilerplate_test
```

You can override it:

```cmd
set TEST_MONGODB_URI=mongodb://localhost:27017/saas_boilerplate_test
npm run test:integration
```

### Optional: mongodb-memory-server

```cmd
npm run test:integration:memory
```

This may download a MongoDB binary the first time it runs. Use this only when internet access and binary download permissions are available.

## Important v0.18.1/v0.18.2 changes

- Windows `.cmd` helper scripts now quote the project path correctly, so project paths with spaces are supported.
- Integration tests now default to Docker/local MongoDB instead of attempting a MongoDB binary download.
- `mongodb-memory-server` remains available as an opt-in mode with `USE_MONGODB_MEMORY_SERVER=true`.
- `validate:local` provides a safe patch-level verification path before running full database-backed checks.

## Troubleshooting

### Seed fails with MongoDB connection error

Start Docker services first:

```cmd
docker compose up -d
```

Then retry:

```cmd
npm run seed
```

### Integration tests try to download MongoDB

Use the Docker-backed local command:

```cmd
npm run test:integration:local
```

Do not set `USE_MONGODB_MEMORY_SERVER=true` unless you intentionally want the memory server mode.

### Path with spaces causes script failure

Use the v0.18.2 scripts. The Windows helper scripts quote project paths, and the seed script has been patched for idempotent reruns.
