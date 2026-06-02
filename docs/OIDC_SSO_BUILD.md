# OIDC / SSO Build

Version: v0.12.0

This build turns the earlier SSO configuration foundation into an active OIDC login flow.

## Active flow

```text
GET /api/auth/sso/{organisationSlug}/start
  -> validates organisation SSO config
  -> resolves OIDC discovery metadata
  -> creates stateless signed state
  -> creates PKCE code_verifier/code_challenge
  -> redirects to provider authorization_endpoint

GET or POST /api/auth/sso/callback
  -> verifies signed state
  -> exchanges authorization code for tokens
  -> validates RS256 id_token against provider JWKS
  -> validates issuer, audience, expiry, nonce and email verification
  -> finds or provisions an organisation user
  -> maps external groups to organisation roles where configured
  -> returns a SaaS user_session_token
```

## Configuration rules

Organisation SSO settings are stored under `organisation.auth_config.sso_config`.

Required for active OIDC:

```text
enabled = true
protocol = oidc
provider set
issuer_url set
client_id set
redirect_uri set
scopes includes openid
```

Recommended:

```text
discovery_url
client_secret_ref
pkce_enabled = true
require_verified_email = true
```

## Secret handling

Raw provider secrets should not be stored in MongoDB. Use `client_secret_ref`.

Supported secret references:

```text
env://VARIABLE_NAME
env:VARIABLE_NAME
secret://local/name -> resolves to OIDC_SECRET_NAME
plain://secret      -> development only when OIDC_ALLOW_PLAIN_CLIENT_SECRET=true
```

## Public start URL discovery

The public SSO options endpoint returns the active start URL:

```text
GET /api/public/organisation-sso-options/{slug-or-domain}
```

Example response field:

```text
/api/auth/sso/demo-organisation/start
```

## Local testing with redirect=false

To inspect the generated provider authorization URL without redirecting:

```text
GET /api/auth/sso/demo-organisation/start?redirect=false
```

To complete the callback from a client manually:

```text
POST /api/auth/sso/callback
{
  "code": "provider-code",
  "state": "signed-state"
}
```

## Audit and security events

This build records security/audit events for:

```text
auth.oidc.start
auth.oidc.login.success
auth.oidc.user_provisioned
```

Failed callback requests are returned as errors. Provider-side and invalid-state failures are visible through normal error handling and should be expanded with dedicated failure event logging in a later hardening build.
