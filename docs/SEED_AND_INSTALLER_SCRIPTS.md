# Seed and Installer Scripts

Version: v0.14.0

## Purpose

v0.14.0 makes the SaaS boilerplate easier to install, initialise and verify on a local Windows development machine.

The build keeps the core product behaviour from v0.13.0 and adds a repeatable local setup layer:

- Create missing `.env` files from examples.
- Generate safe local JWT/OIDC development secrets when needed.
- Start Docker services through a wrapper script.
- Seed configurable organisation, admin, roles, permissions and plan data.
- Verify that the install is usable after seeding.
- Safely reset only the configured local development organisation data.

## Windows-first commands

From the project root:

```cmd
scripts\install-local.cmd
```

This runs:

```cmd
node scripts\setup-local.mjs
docker compose up -d
npm install
npm run seed
npm run check:install
```

For a lighter setup that only creates `.env` files and local secrets:

```cmd
npm run setup:local
```

To seed or re-seed the configured demo organisation:

```cmd
npm run seed
```

To verify the local installation:

```cmd
npm run check:install
```

To reset and re-seed the configured local development organisation:

```cmd
scripts\reset-local-data.cmd
```

The reset script sets `SEED_RESET_CONFIRM=YES` and deletes only data attached to the configured seeded organisation slug. It does not delete the global permission or plan catalogue.

## Configurable seed values

The seed script reads these values from `apps\api\.env`:

```env
SEED_ORGANISATION_NAME=Demo Organisation
SEED_ORGANISATION_SLUG=demo-organisation
SEED_ORGANISATION_DOMAIN=example.com
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe123!
SEED_ADMIN_FIRST_NAME=Demo
SEED_ADMIN_LAST_NAME=Admin
SEED_PLAN_KEY=professional
SEED_FORCE_ADMIN_PASSWORD_RESET=false
```

The seed remains idempotent. Running it multiple times updates the catalogue and ensures the configured organisation, roles and admin user exist.

## Generated local secrets

`node scripts\setup-local.mjs` checks `apps\api\.env` and generates a local `JWT_SECRET` if the placeholder is still present or if the value is too short.

It also handles `OIDC_STATE_SECRET`. An empty `OIDC_STATE_SECRET=` is valid in local development because the API falls back to `JWT_SECRET`, but the setup script can populate it if an invalid short value exists.

Production deployments should use securely generated secrets from the hosting platform or secret manager, not local generated values.

## New npm scripts

Root package scripts:

```text
npm run setup:local
npm run seed
npm run seed:local
npm run check:install
npm run reset:dev-data
npm run install:local
```

API workspace scripts:

```text
npm run seed -w apps/api
npm run check:install -w apps/api
npm run reset:dev-data -w apps/api
```

## Install validation

The install check verifies:

- Permission catalogue exists.
- Plan catalogue exists.
- Configured organisation exists.
- Configured admin user exists.
- Admin user belongs to the configured organisation.
- At least the default admin and viewer roles exist.
- Seed audit/security records exist.

## Scope boundaries

v0.14.0 does not add the final automated Testing Foundations. That remains the canonical v0.16.0 build.

v0.14.0 also does not add compute allocation or compute jobs as core boilerplate modules. Those remain optional future product modules.
