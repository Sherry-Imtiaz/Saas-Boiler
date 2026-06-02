# Production Environment Checklist - v0.15.0

Use this checklist before deploying the SaaS boilerplate outside local development.

## API environment

```text
NODE_ENV=production
PORT=4000 or platform-provided port
API_BASE_PATH=/api
MONGODB_URI=<managed MongoDB URI>
CORS_ORIGIN=<frontend origin>
JWT_SECRET=<secure random 32+ character value>
OIDC_STATE_SECRET=<different secure random 32+ character value>
OIDC_ALLOW_PLAIN_CLIENT_SECRET=false
```

## Web environment

```text
VITE_API_BASE_URL=https://your-api-domain.example.com/api
```

## Storage

Recommended production setting:

```text
STORAGE_PROVIDER=azure_blob
AZURE_STORAGE_CONTAINER_NAME=saas-files
AZURE_STORAGE_USE_AZURITE=false
```

Use one of:

```text
AZURE_STORAGE_CONNECTION_STRING
AZURE_STORAGE_ACCOUNT_NAME with platform identity support added later
```

## Readiness commands

```cmd
npm install --ignore-scripts
npm run build
npm run check:deployment -- --strict
```

## Runtime smoke tests

```text
GET /api/health/live  -> 200
GET /api/health/ready -> 200 after MongoDB connection
GET /api/docs         -> Swagger UI, if exposed in this environment
POST /api/auth/login  -> valid seeded/admin user only if seeded intentionally
```

## Security checks

```text
No demo password in production
No localhost CORS origin
No placeholder JWT/OIDC secret
No plain OIDC client secret in organisation SSO config
No Azurite in production
Audit/security event APIs protected by permissions
Platform APIs protected by platform permissions
```
