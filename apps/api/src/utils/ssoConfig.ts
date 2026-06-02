export type SsoProviderKey = 'keycloak' | 'azure_ad' | 'okta' | 'google' | 'custom_oidc' | 'custom';

export type SsoConfigLike = {
  enabled?: boolean;
  provider?: SsoProviderKey | null;
  protocol?: 'oidc' | 'saml' | null;
  issuer_url?: string | null;
  discovery_url?: string | null;
  authorization_endpoint?: string | null;
  token_endpoint?: string | null;
  userinfo_endpoint?: string | null;
  jwks_uri?: string | null;
  logout_endpoint?: string | null;
  client_id?: string | null;
  client_secret_ref?: string | null;
  scopes?: string[];
  response_type?: string | null;
  pkce_enabled?: boolean;
  require_verified_email?: boolean;
  redirect_uri?: string | null;
  post_logout_redirect_uri?: string | null;
  claim_mapping?: {
    subject?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    groups?: string | null;
  };
  group_role_mapping?: Array<{ external_group: string; role_id: unknown }>;
};

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

export const supportedSsoProviders = [
  {
    key: 'keycloak',
    name: 'Keycloak',
    protocol: 'oidc',
    issuer_hint: 'https://auth.example.com/realms/{realm}',
    discovery_hint: 'https://auth.example.com/realms/{realm}/.well-known/openid-configuration',
    notes: 'Recommended self-hosted IdP option. MFA should normally run in Keycloak authentication flows.'
  },
  {
    key: 'azure_ad',
    name: 'Microsoft Entra ID',
    protocol: 'oidc',
    issuer_hint: 'https://login.microsoftonline.com/{tenant_id}/v2.0',
    discovery_hint: 'https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration',
    notes: 'Recommended for Microsoft 365 organisations. MFA should normally run through Conditional Access / Entra policies.'
  },
  {
    key: 'okta',
    name: 'Okta',
    protocol: 'oidc',
    issuer_hint: 'https://{yourOktaDomain}/oauth2/default',
    discovery_hint: 'https://{yourOktaDomain}/oauth2/default/.well-known/openid-configuration',
    notes: 'Recommended for organisations already using Okta as workforce identity provider.'
  },
  {
    key: 'google',
    name: 'Google Workspace',
    protocol: 'oidc',
    issuer_hint: 'https://accounts.google.com',
    discovery_hint: 'https://accounts.google.com/.well-known/openid-configuration',
    notes: 'Useful for Google Workspace organisations where domain controls are in place.'
  },
  {
    key: 'custom_oidc',
    name: 'Custom OIDC',
    protocol: 'oidc',
    issuer_hint: 'https://identity.example.com',
    discovery_hint: 'https://identity.example.com/.well-known/openid-configuration',
    notes: 'Use for standards-compliant OIDC providers that are not covered by a named profile.'
  }
] as const;

export function normaliseSsoConfig(config?: SsoConfigLike | null) {
  return {
    enabled: Boolean(config?.enabled),
    provider: config?.provider ?? null,
    protocol: config?.protocol ?? 'oidc',
    issuer_url: config?.issuer_url ?? null,
    discovery_url: config?.discovery_url ?? null,
    authorization_endpoint: config?.authorization_endpoint ?? null,
    token_endpoint: config?.token_endpoint ?? null,
    userinfo_endpoint: config?.userinfo_endpoint ?? null,
    jwks_uri: config?.jwks_uri ?? null,
    logout_endpoint: config?.logout_endpoint ?? null,
    client_id: config?.client_id ?? null,
    client_secret_ref: config?.client_secret_ref ?? null,
    scopes: config?.scopes?.length ? config.scopes : DEFAULT_SCOPES,
    response_type: config?.response_type ?? 'code',
    pkce_enabled: config?.pkce_enabled ?? true,
    require_verified_email: config?.require_verified_email ?? true,
    redirect_uri: config?.redirect_uri ?? 'http://localhost:4000/api/auth/sso/callback',
    post_logout_redirect_uri: config?.post_logout_redirect_uri ?? 'http://localhost:5173/login',
    claim_mapping: {
      subject: config?.claim_mapping?.subject ?? 'sub',
      email: config?.claim_mapping?.email ?? 'email',
      first_name: config?.claim_mapping?.first_name ?? 'given_name',
      last_name: config?.claim_mapping?.last_name ?? 'family_name',
      display_name: config?.claim_mapping?.display_name ?? 'name',
      groups: config?.claim_mapping?.groups ?? 'groups'
    },
    group_role_mapping: (config?.group_role_mapping ?? []).map((mapping) => ({
      external_group: mapping.external_group,
      role_id: String(mapping.role_id)
    }))
  };
}

export function validateSsoConfig(config?: SsoConfigLike | null) {
  const sso = normaliseSsoConfig(config);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sso.enabled) {
    warnings.push('SSO provider configuration is currently disabled. Settings can be saved before enabling SSO.');
  }

  if (sso.enabled && !sso.provider) {
    errors.push('provider is required when SSO configuration is enabled.');
  }

  if (sso.protocol !== 'oidc') {
    warnings.push('Only OIDC metadata is prepared in this foundation build. SAML is a stored placeholder for a later build.');
  }

  if (sso.protocol === 'oidc') {
    if (!sso.issuer_url) errors.push('issuer_url is required for OIDC provider configuration.');
    if (!sso.client_id) errors.push('client_id is required for OIDC provider configuration.');
    if (!sso.redirect_uri) errors.push('redirect_uri is required for OIDC provider configuration.');
    if (!sso.scopes.includes('openid')) errors.push('OIDC scopes must include openid.');
    if (!sso.discovery_url) warnings.push('discovery_url is recommended so the later login build can resolve endpoints automatically.');
    if (!sso.client_secret_ref) warnings.push('client_secret_ref is recommended. Store only a secret reference, not the actual secret value.');
    if (!sso.pkce_enabled) warnings.push('PKCE is disabled. Keep PKCE enabled for browser-facing OIDC flows unless there is a specific reason.');
  }

  if (sso.provider === 'keycloak' && sso.issuer_url && !sso.issuer_url.includes('/realms/')) {
    warnings.push('Keycloak issuer URLs normally include /realms/{realm}.');
  }

  if (sso.provider === 'azure_ad' && sso.issuer_url && !sso.issuer_url.includes('login.microsoftonline.com')) {
    warnings.push('Azure Entra issuer URLs normally use login.microsoftonline.com/{tenant_id}/v2.0.');
  }

  if (sso.provider === 'google' && sso.issuer_url && !sso.issuer_url.includes('accounts.google.com')) {
    warnings.push('Google OIDC issuer is normally https://accounts.google.com.');
  }

  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? (warnings.length ? 'valid_with_warnings' : 'valid') : 'invalid',
    errors,
    warnings,
    sso_config: sso,
    notes: [
      'This is a local configuration validation only. No outbound discovery document request is performed in v0.12.0.',
      'OIDC login, callback handling and id_token validation are active in v0.12.0.',
      'MFA should normally be enforced by the external IdP when enforcement_mode is idp_enforced.'
    ]
  };
}
