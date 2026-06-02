# v0.19.0 - Production UI Rebuild

## Purpose

v0.19.0 replaces the temporary/prototype admin UI with a cleaner production-style SaaS application interface. The backend from v0.18.2 is preserved. The focus of this build is frontend structure, usability and module presentation.

## What changed

- New application shell with left sidebar, top header, workspace switcher and role-aware navigation.
- Rebuilt tenant-branded login screen with organisation lookup, password login and SSO start support.
- Organisation Owner workspace for tenant administration.
- Platform Owner workspace for platform administration.
- Reusable UI patterns for cards, metrics, forms, data tables, status badges, notices, empty states and JSON preview panels.

## Organisation Owner workspace

The Organisation Owner workspace includes:

- Dashboard
- User management
- Roles and permissions visibility
- Branding and login customisation
- SSO/OIDC configuration
- MFA policy
- Personal access tokens
- Organisation API tokens
- Files and assets
- Tenant audit logs
- Tenant security events
- Developer/API context

## Platform Owner workspace

The Platform Owner workspace includes:

- Platform dashboard
- Organisation management
- Organisation suspend/activate actions
- Plan assignment
- Global plan catalogue management
- Cross-tenant audit logs
- Cross-tenant security events
- System health/readiness
- Swagger/OpenAPI links

## Backend impact

No major backend module was rebuilt in v0.19.0. Existing APIs, models, seed scripts, deployment readiness checks and testing foundations remain in place.

## Future UI stabilisation

Recommended next patch: v0.19.1 - UI Stabilisation and Local Validation.
