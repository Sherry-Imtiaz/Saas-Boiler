# SaaS Boilerplate Architecture

Current version: `v0.10.0 - File Asset Foundation`

## Core Tenant Model

```text
Organisation -> Users
```

Rules:

```text
A user belongs to exactly one organisation.
A user cannot exist without an organisation_id.
Every tenant-owned document is scoped to organisation_id.
The backend does not trust organisation_id from normal frontend input.
```

## Current Foundation

Completed modules now include:

```text
Application skeleton
MongoDB/Mongoose schema foundation
Organisation management
Organisation-owned users
Native authentication
RBAC
Token scope model
Personal Access Tokens
Organisation API Tokens
Internal Admin UI foundation
Organisation Login Branding
Organisation Branding Assets and Theme Configuration
Organisation Auth Configuration
MFA Policy Foundation
SSO Provider Configuration Foundation
```


## MFA Policy Foundation in v0.9.1

v0.9.1 makes the boilerplate MFA-aware without making Keycloak or any other provider mandatory.

Design principle:

```text
The SaaS app stores MFA policy, exposes MFA status, records audit logs and later validates MFA claims.
The identity provider should perform the actual MFA challenge when SSO is used.
```

Supported MFA providers in policy:

```text
none
native
keycloak
azure_ad
okta
custom_oidc
```

Supported enforcement modes:

```text
disabled      MFA policy is stored but not enforced.
app_checked   Future native/app MFA challenge flow can satisfy MFA.
idp_enforced  External IdP such as Keycloak, Entra or Okta performs MFA; app validates claims later.
```

New public endpoint:

```text
GET /api/public/organisation-mfa-policy/:identifier
```

New internal endpoints:

```text
GET   /api/org/mfa-policy
PATCH /api/org/mfa-policy
```

Required access:

```text
GET   /api/org/mfa-policy   -> organisation.mfa.view
PATCH /api/org/mfa-policy   -> organisation.mfa.manage
```

Token context now includes MFA-aware fields:

```text
mfa_required
mfa_verified
mfa_provider
mfa_status
mfa_enforcement_mode
amr
acr
```

Implementation status:

```text
MFA policy configuration is active.
MFA challenge flows are intentionally not implemented in v0.9.1.
Future OIDC/Keycloak/Entra/Okta builds will validate MFA claims from the identity provider.
```


## SSO Provider Configuration Foundation in v0.9.1

v0.9.1 adds organisation-owned SSO provider configuration for future OIDC/SAML authentication.

Supported provider profiles:

```text
keycloak
azure_ad
okta
google
custom_oidc
custom
```

New public endpoint:

```text
GET /api/public/organisation-sso-options/:identifier
```

New internal endpoints:

```text
GET   /api/org/sso-config/supported-providers
GET   /api/org/sso-config
PATCH /api/org/sso-config
POST  /api/org/sso-config/test
```

Required access:

```text
GET   /api/org/sso-config                     -> organisation.sso.view
PATCH /api/org/sso-config                     -> organisation.sso.manage
POST  /api/org/sso-config/test                -> organisation.sso.view
GET   /api/org/sso-config/supported-providers -> organisation.sso.view
```

The SSO configuration is stored under:

```text
organisation.auth_config.sso_config
```

Important design rule:

```text
The SaaS app stores provider configuration and later validates OIDC tokens.
The identity provider performs the real authentication and MFA challenge.
The app stores client_secret_ref only, not the raw provider secret.
```

Current implementation status:

```text
SSO configuration storage is active.
Local configuration validation is active.
Public safe SSO metadata is active.
Real redirect/callback login is not active yet.
```

## Organisation Auth Configuration in v0.9.1

v0.9.1 adds organisation-owned authentication policy configuration.

New concepts under `organisation.auth_config`:

```text
login_method              native | mixed | oidc | saml
sso_enabled               enables SSO-ready organisation mode
provider                  azure_ad | okta | google | custom
issuer_url                provider issuer URL placeholder
discovery_url             OIDC discovery document URL placeholder
client_id                 provider client/application id
client_secret_ref         reference to a stored secret, not raw secret storage
allowed_email_domains     allowed domains for organisation login policy
auto_provision_users      future SSO auto-provisioning flag
default_role_id           default role for future auto-provisioned users
enforce_sso               disables native login when true
enforce_mfa               stored policy flag for later MFA build
```

New public endpoint:

```text
GET /api/public/organisation-auth-options/:identifier
```

This endpoint is unauthenticated and returns safe login-method metadata only. It does not expose issuer URL, client ID, secret references or other sensitive provider details.

New internal endpoints:

```text
GET   /api/org/auth-config
PATCH /api/org/auth-config
```

Required access:

```text
GET   /api/org/auth-config   -> organisation.auth.view
PATCH /api/org/auth-config   -> organisation.auth.manage
```

Important implementation status:

```text
Native login is active and respects organisation auth policy.
SSO provider configuration is stored, but full OIDC/SAML redirect/callback login is planned for v0.15.0.
MFA enforcement is stored as a policy flag, but full MFA setup/verification is planned for a later build.
```

## Organisation Branding and Theme

Organisation branding and theme remain active from v0.7.0/v0.7.1.

```text
Organisation
  ├── branding
  │   ├── logo_url
  │   ├── favicon_url
  │   ├── login_background_url
  │   ├── sidebar_logo_url
  │   └── email_logo_url
  └── theme
      ├── mode
      ├── primary/secondary/accent colours
      ├── background/surface/text colours
      ├── semantic colours
      ├── border radius
      └── font family
```

Development asset storage path:

```text
apps/api/storage/organisations/{organisation_id}/branding/
```

Public asset URLs are served through:

```text
/api/public/assets/organisations/:organisationId/branding/:fileName
```

The local storage approach is intentionally simple for development. The later File Asset Foundation build should migrate this to the proper organisation file asset model and object storage provider.

## Frontend UI Status

The React/Vite frontend now includes:

```text
Organisation-aware login screen
Public login config lookup
Branded login preview
Authenticated admin shell
Dashboard
Branding management page
Auth configuration page
Role management page
Personal Access Token page
Organisation API Token page
Developer links
```

The UI is still a development/admin foundation, not a finished product interface.

## Token Strategy

```text
Internal user/admin APIs
  -> user_session_token or personal_access_token

External integration APIs
  -> organisation_api_token or future service_account_token

Platform admin APIs
  -> platform admin user_session_token only
```

Current active token types:

```text
user_session_token
personal_access_token
organisation_api_token
```

Planned:

```text
service_account_token
```

## API Documentation Rule

Every API must be documented in Swagger/OpenAPI with:

```text
Internal or External tag
Authentication scheme
Required permission/scope
Request schema
Response schema
Tenant/organisation notes
```

v0.9.1 OpenAPI files:

```text
docs/openapi/openapi.v0.9.1.json
docs/openapi/openapi.v0.9.1.yaml
```

## Next Architecture Step

```text
v0.9.1 - SSO Provider Configuration Foundation
```

This should build on the new `enforce_mfa` organisation policy flag and add MFA-ready user status/configuration structure.

## v0.9.1 Feature Entitlements

Feature entitlements are now an organisation-level gate in front of future product modules. The intended access model is:

```text
Organisation feature enabled
  + User/token permission or scope
  + Tenant boundary enforcement
  = Access allowed
```

The API exposes:

```text
GET   /api/features/catalogue
GET   /api/org/features
PATCH /api/org/features
```

Future feature-backed APIs should use the `requireFeature(feature_key)` helper together with the existing `requirePermission(permission_key)` or token scope checks.

## v0.9.1 Plan and Subscription Readiness

v0.9.1 prepares the SaaS boilerplate for future commercial packaging without adding payment processing.

The model is:

```text
Organisation
  -> assigned plan
  -> subscription status metadata
  -> billing mode metadata
  -> plan limits
  -> feature defaults
```

Plan catalogue entries define:

```text
key
name
description
status
billing_mode
pricing placeholders
feature defaults
usage limits
```

Organisation plan assignment stores:

```text
plan_key
subscription_status
billing_mode
trial/current period placeholders
assigned_at
assigned_by_user_id
limits
features_from_plan
notes
```

Payment providers are intentionally not implemented in v0.9.1. Future billing work can add Stripe, invoice handling, tax rules and webhooks on top of this plan/subscription metadata.


## File Asset Foundation in v0.10.0

v0.10.0 adds the first proper organisation-owned file layer. Files are stored as metadata in MongoDB and file content is stored locally for development.

New collection:

```text
file_assets
```

Core file rules:

```text
Every file has organisation_id.
Every file has uploaded_by_user_id.
File APIs require the file_uploads feature entitlement.
File APIs require files.view, files.upload or files.delete permission.
Upload checks max_file_size_mb and max_storage_gb from the organisation plan assignment.
```

New internal endpoints:

```text
POST   /api/org/files
GET    /api/org/files
GET    /api/org/files/:fileId
GET    /api/org/files/:fileId/download
DELETE /api/org/files/:fileId
```

Local development storage path:

```text
apps/api/storage/organisations/{organisation_id}/files/{file_id}/
```

Later builds will add storage provider abstraction, S3-compatible storage, virus scanning, file versioning and branding asset migration into FileAsset.


## v0.10.1 Storage Provider Abstraction

The file asset layer now uses a provider interface. Local storage remains the default for development, while Azure Blob Storage is supported for Azure deployments and Azurite-compatible local testing. Logical storage keys remain provider-neutral: `organisations/{organisation_id}/files/{file_id}/{file_name}`.



## v0.10.2 Image Handling and Branding Asset Migration

Branding images are now stored through the same organisation-owned FileAsset foundation used for normal files. This means logo, favicon, login background, sidebar logo and email logo uploads create FileAsset records, store file content through the active storage provider, and link the resulting FileAsset id back to the organisation branding fields.

Public branding URLs now use:

```text
/api/public/branding-assets/{fileId}
```

The route only serves active image FileAsset records that are marked as branding assets in metadata. This keeps branding images provider-compatible with local storage, Azurite and Azure Blob Storage while preserving a public read path for login and theme rendering.

Each migrated branding upload stores metadata such as:

```text
branding_asset = true
asset_type = logo / favicon / login-background / sidebar-logo / email-logo
alt_text
image width / height / format where detectable
```

The older local route remains available for backwards compatibility only:

```text
/api/public/assets/organisations/{organisationId}/branding/{fileName}
```

Future builds can add thumbnail generation, image resizing, virus scanning and Azure CDN/front-door URL generation on top of this foundation.
