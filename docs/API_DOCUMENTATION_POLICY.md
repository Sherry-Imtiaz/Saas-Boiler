# API Documentation Policy

Version introduced: v0.1.1

## Rule

Every API created for this SaaS boilerplate must be added to the Swagger/OpenAPI documentation in the same build version.

Each API operation must include:

1. A clear summary and description.
2. A tag of either `Internal` or `External`.
3. Explicit authentication requirements.
4. Request body schema where applicable.
5. Response schemas for successful and error responses.
6. Tenant/organisation access notes where applicable.

## Tag Meaning

### External

Use `External` for APIs intended to be called by normal application clients, external integrations, public health checks, or customer-facing consumers.

### Internal

Use `Internal` for APIs intended for platform administration, organisation administration, setup, seed, support, maintenance, or privileged operations.

## Authentication Documentation

Every endpoint must explicitly define one of the following:

```yaml
security: []
```

for unauthenticated APIs, or:

```yaml
security:
  - BearerAuth: []
```

for authenticated APIs.

Later, when RBAC is introduced, endpoint descriptions must also state the required permission key, for example:

```text
Requires permission: users.view
```

## Build Zip Requirement

Every generated build zip must include:

```text
docs/openapi/openapi.vX.X.X.json
docs/openapi/openapi.vX.X.X.yaml
docs/VERSION_CONTEXT_vX.X.X.txt
```

## Current v0.1.1 APIs

| Method | Path | Tag | Authentication |
|---|---|---|---|
| GET | /api/health | External | None |
| GET | /api/openapi.json | Internal | None in v0.1.1 |
| GET | /api/docs | Internal | None in v0.1.1 |
