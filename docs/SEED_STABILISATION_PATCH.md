# v0.18.2 - Seed Stabilisation Patch

## Purpose

v0.18.2 is a patch release for local setup stability after v0.18.1.

It fixes the seed failure reported on Windows:

```text
MongoServerError: Updating the path 'organisation_id' would create a conflict at 'organisation_id'
```

## Root cause

The demo admin user upsert was setting the same fields in both `$setOnInsert` and `$set`:

- `organisation_id`
- `status`
- `role_ids`

MongoDB rejects this during an upsert because insert operations apply both update operators.

## Fix

The admin user seed now uses:

- `$setOnInsert` for insert-only identity/auth fields:
  - `email`
  - `email_normalised`
  - `first_name`
  - `last_name`
  - `display_name`
  - `auth`
  - `profile`
- `$set` for fields that should be refreshed on every seed run:
  - `organisation_id`
  - `status`
  - `role_ids`

This makes the seed script idempotent and safe to rerun.

## npm install stabilisation

The package lockfile has also been patched so package tarball URLs resolve from:

```text
https://registry.npmjs.org/
```

This avoids timeouts caused by lockfile URLs that were generated inside the build environment.

## Recommended local validation

From the project root:

```cmd
npm config set registry https://registry.npmjs.org/
npm install --registry=https://registry.npmjs.org/
docker compose up -d
npm run seed
npm run check:install
npm run validate:local
npm run dev
```

Default seeded login:

```text
Organisation slug: demo-organisation
Email: admin@example.com
Password: ChangeMe123!
```
