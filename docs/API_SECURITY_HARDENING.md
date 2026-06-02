# API Security Hardening and Swagger Domain Refactor

Version: v0.13.0

## Purpose

v0.13.0 hardens the API layer after the v0.12.0 OIDC / SSO build. The focus is not to add a new product feature, but to make the boilerplate safer and clearer before installer, deployment and testing builds.

## Security changes

### 1. Consistent API error structure

Errors now include a stable machine-readable code:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": {}
  }
}
```

The `HttpError` utility now derives default codes from HTTP status codes, including `BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `RATE_LIMITED` and `INTERNAL_SERVER_ERROR`.

### 2. Safer permission failure messaging

Permission and token-scope failures now return safer public messages while still keeping the required permission/scope in structured `details` for debugging and test assertions.

### 3. Combined permission guard

A new `requireAllPermissions()` guard was added for routes where one permission is not enough.

Example use:

```ts
requireAllPermissions(['platform.organisations.manage', 'plans.manage'])
```

This is used for platform organisation plan assignment routes, where both platform organisation authority and plan-management authority are required.

### 4. Platform organisation plan route hardening

The following routes were hardened:

- `GET /api/platform/organisations/:organisationId/plan`
- `PATCH /api/platform/organisations/:organisationId/plan`
- `POST /api/platform/organisations/:organisationId/plan/apply-defaults`

Before v0.13.0, these routes were protected by plan permissions only. In v0.13.0, they also require platform organisation permissions:

- Read requires `platform.organisations.view` and `plans.view`
- Mutations require `platform.organisations.manage` and `plans.manage`

### 5. OIDC environment configuration hardening

`OIDC_STATE_SECRET` can now be left empty in local development so the app can fall back to the JWT secret for state signing. If it is provided, it must still be at least 32 characters.

This prevents local seed/start failures caused by an empty `OIDC_STATE_SECRET=` line in `.env`.

## Swagger/OpenAPI domain refactor

Swagger grouping has been refactored away from broad `Internal` / `External` tags.

The active domain tags are now:

- Auth
- Organisations
- Users
- RBAC
- Tokens
- Branding
- SSO
- MFA
- Features
- Plans
- Files
- Audit
- Security
- Tenant Security
- Platform Admin
- Developer/System

Internal, external and public classifications now appear as endpoint metadata fields such as:

- `x-saas-classification`
- `x-required-permission`
- `x-required-scope`
- `x-tenant-scope`
- `x-token-types`

## Tenant isolation position

Organisation-owned data remains scoped by `organisation_id`. Routes that operate on the current organisation use `req.auth.organisation_id`. Routes that accept `:organisationId` must be platform-only or must explicitly prove the caller is allowed to access that organisation.

v0.13.0 closes the identified plan-assignment leakage risk by requiring platform permissions for cross-organisation plan operations.

## What this build does not add

- It does not add installer scripts. That is planned for v0.14.0.
- It does not add deployment readiness scripts/checklists. That is planned for v0.15.0.
- It does not add the full canonical Testing Foundations build. That remains planned for v0.16.0.
