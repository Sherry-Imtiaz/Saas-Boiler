# v0.17.0 - Authentication UI + Organisation Owner Admin UI

## Purpose

v0.17.0 adds the first complete tenant-facing administration experience on top of the existing SaaS boilerplate backend.

The build is intentionally focused on the **Organisation Owner / Organisation Admin** experience, not the Platform Owner console. Platform-wide screens remain a later build so tenant controls and platform controls stay separated.

## Included UI areas

- Tenant-branded login screen
- Organisation selector / login configuration lookup
- Password login
- SSO / OIDC login launch
- Logout flow
- Organisation Owner dashboard
- Organisation profile / settings summary
- Tenant user management
- Role and permission visibility
- Branding and theme management
- SSO / OIDC configuration screen
- MFA policy screen
- Personal Access Token management
- Organisation API Token management
- Tenant audit log viewer
- Tenant security event viewer
- Plan and feature entitlement view
- File/asset visibility
- Developer/API context page

## Tenant branded login

The login page loads public-safe organisation login configuration before authentication.

Supported organisation branding fields include:

- Logo URL
- Login background URL
- Primary colour
- Secondary colour
- Login title
- Login subtitle
- Support email
- Password/SSO availability indicators
- MFA policy indicator

The frontend uses:

```http
GET /api/public/organisation-login/:identifier
```

The public response must not expose secrets, private SSO values, internal security settings, or token material.

## User management

The Organisation Owner UI uses the existing organisation-scoped user APIs:

```http
GET /api/platform/organisations/:organisationId/users
POST /api/platform/organisations/:organisationId/users
PATCH /api/platform/organisations/:organisationId/users/:userId
PATCH /api/platform/organisations/:organisationId/users/:userId/status
```

The backend already enforces organisation parameter access, so an organisation owner can manage users only inside their own organisation.

## Security positioning

The UI does not bypass API security. Every protected page still depends on the API-level RBAC and tenant isolation controls added in earlier builds.

Important rules:

- Organisation users cannot manage users in other organisations.
- Organisation users cannot create platform admins.
- Token values are shown only once at creation.
- Existing token values are never displayed again.
- Client secret references are editable, but raw secret values are not displayed.
- Tenant audit/security logs remain organisation-scoped.

## Out of scope

The following are deliberately excluded from v0.17.0:

- Platform Owner/Admin UI
- Cross-tenant user management
- Global plan/feature editors
- Cross-tenant audit/security log screens
- Billing/payment screens
- Compute allocation UI
- Advanced custom role editor
- White-labelled portal builder

Recommended next build:

```text
v0.18.0 - Platform Owner Admin UI
```
