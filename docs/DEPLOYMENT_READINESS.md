# Deployment Readiness - v0.15.0

## Purpose

v0.15.0 prepares the SaaS boilerplate for a production-style deployment without adding product features. It adds environment examples, deployment checks, liveness/readiness endpoints and Windows-friendly scripts so the API can be validated before release.

## New health endpoints

```text
GET /api/health
GET /api/health/live
GET /api/health/ready
```

`/api/health/live` confirms the API process is alive and does not require MongoDB.

`/api/health/ready` is intended for load balancers and deployment platforms. It returns `200` only when MongoDB is connected and `503` when the API is not ready to receive traffic.

## Production environment examples

New production templates are included:

```text
apps/api/.env.production.example
apps/web/.env.production.example
```

For production, do not use demo values from `.env.example`. At minimum, replace:

```text
MONGODB_URI
CORS_ORIGIN
JWT_SECRET
OIDC_STATE_SECRET
AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME
OIDC_FRONTEND_CALLBACK_URL
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
```

## Deployment readiness check

Run the deployment readiness check from the project root:

```cmd
npm run check:deployment -- --strict
```

Or use the Windows wrapper:

```cmd
scripts\deployment-readiness.cmd
```

The check validates:

```text
NODE_ENV production intent
API base path
JWT secret quality
OIDC state secret quality
CORS origin
MongoDB URI production suitability
Azure Blob/local storage configuration
OIDC plain-client-secret safety
MongoDB connectivity
```

For a configuration-only dry run without database access:

```cmd
npm run check:deployment -- --strict --skip-db
```

## Production build commands

```cmd
npm install --ignore-scripts
npm run build
npm run check:deployment -- --strict
npm run start:production
```

Windows wrapper:

```cmd
scripts\build-production.cmd
scripts\deployment-readiness.cmd
scripts\start-production-api.cmd
```

## Deployment checklist

Before promoting a deployment, confirm:

```text
1. NODE_ENV=production is set for the API service.
2. API and frontend URLs are configured through real domains.
3. CORS_ORIGIN matches the deployed frontend origin.
4. JWT_SECRET and OIDC_STATE_SECRET are unique secure random values.
5. MongoDB is managed, backed up and access-controlled.
6. STORAGE_PROVIDER is durable for production, preferably azure_blob.
7. OIDC client secrets are stored through env:// references, not plain config.
8. /api/health/live returns 200.
9. /api/health/ready returns 200 after database connection.
10. Swagger/OpenAPI is available only where acceptable for the deployment environment.
11. Seeded demo credentials are not used in production.
12. Audit and security event access remains restricted to the correct permissions.
```

## Azure-oriented minimum deployment shape

For a small production or test deployment, this boilerplate can run with:

```text
Frontend: Azure Static Web Apps or App Service static hosting
API: Azure App Service running Node.js
Database: managed MongoDB-compatible service or MongoDB Atlas
File storage: Azure Blob Storage
Secrets: App Service application settings or Key Vault integration
Ingress: HTTPS only with platform-managed TLS
Monitoring: App Service logs plus application audit/security events
```

The boilerplate remains provider-neutral, but v0.15.0 includes Azure Blob settings because storage provider abstraction was added earlier.

## What is not included yet

v0.15.0 does not add automated test coverage. Testing Foundations remains the next canonical build:

```text
v0.16.0 - Testing Foundations
```
