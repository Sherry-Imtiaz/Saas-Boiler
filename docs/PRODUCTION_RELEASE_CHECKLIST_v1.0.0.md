# Production Release Checklist - v1.0.0

Use this checklist before using the boilerplate as the foundation for a production SaaS application.

## Environment

- Replace all generated local secrets.
- Set a strong `JWT_SECRET` with at least 32 characters.
- Set a strong `OIDC_STATE_SECRET` with at least 32 characters.
- Configure production MongoDB connection string.
- Configure production CORS origin.
- Configure storage provider: local only for development, Azure Blob or equivalent for production.
- Configure production frontend API base URL.

## Database and seed

- Run database migrations/seed only against the intended environment.
- Replace the default demo admin credentials.
- Confirm platform permissions are assigned only to trusted platform users.
- Confirm each real user belongs to exactly one organisation.

## Security

- Review all role and permission assignments.
- Confirm SSO/OIDC provider settings for each tenant.
- Confirm client secrets are stored by reference or secure environment variable, not displayed in UI.
- Confirm token scopes, expiry and revocation workflows.
- Review audit/security event visibility by role.

## Deployment

- Run `npm run build`.
- Run `npm run check:deployment` against the deployment environment.
- Confirm `/api/health/live` and `/api/health/ready` are monitored.
- Confirm Swagger/OpenAPI is available only as appropriate for the environment.
- Confirm log collection/monitoring strategy.

## Testing

- Run unit tests with `npm test`.
- Run local integration tests with `npm run test:integration:local`.
- Perform manual smoke tests for login, SSO launch, tenant admin, platform admin, token management and audit/security logs.

## Release artefacts

- Confirm `docs/VERSION_CONTEXT_v1.0.0.txt` is included.
- Confirm `docs/RELEASE_NOTES_v1.0.0.md` is included.
- Confirm `docs/openapi/openapi.v1.0.0.json` and `.yaml` are included.
- Confirm README and CHANGELOG identify v1.0.0 as the current version.
