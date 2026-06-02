export const TOKEN_TYPES = [
  'user_session_token',
  'personal_access_token',
  'organisation_api_token',
  'service_account_token'
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export const TOKEN_AUDIENCES = ['internal', 'external', 'service'] as const;

export type TokenAudience = (typeof TOKEN_AUDIENCES)[number];

export const TOKEN_TYPE_DESCRIPTIONS: Record<TokenType, string> = {
  user_session_token: 'Short-lived token returned by native or SSO login. Used by the frontend, admin UI and Postman during development.',
  personal_access_token: 'Long-lived user-owned token for Postman, scripts and user automation. Active from v0.6.2.',
  organisation_api_token: 'Organisation-owned token for external/system-to-system integrations. Active from v0.6.3.',
  service_account_token: 'Non-human service identity token for controlled automation where required in later builds.'
};

export const TOKEN_AUDIENCE_DESCRIPTIONS: Record<TokenAudience, string> = {
  internal: 'Internal user/admin APIs. Uses logged-in user context and RBAC permissions.',
  external: 'External integration APIs. Uses organisation/API scopes and organisation feature gates.',
  service: 'Service-to-service APIs. Uses service account identity and explicit scopes.'
};

export const USER_SESSION_SCOPES = ['internal:user', 'auth:me', 'rbac:permissions'] as const;

export type TokenScope = string;

export function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && (TOKEN_TYPES as readonly string[]).includes(value);
}

export function isTokenAudience(value: unknown): value is TokenAudience {
  return typeof value === 'string' && (TOKEN_AUDIENCES as readonly string[]).includes(value);
}

export function getDefaultAudienceForTokenType(tokenType: TokenType): TokenAudience {
  if (tokenType === 'organisation_api_token') {
    return 'external';
  }

  if (tokenType === 'service_account_token') {
    return 'service';
  }

  return 'internal';
}

export function getDefaultScopesForTokenType(tokenType: TokenType): TokenScope[] {
  if (tokenType === 'user_session_token') {
    return [...USER_SESSION_SCOPES];
  }

  if (tokenType === 'personal_access_token') {
    return [];
  }

  return [];
}

export function getTokenPolicySummary() {
  return TOKEN_TYPES.map((tokenType) => ({
    token_type: tokenType,
    audience: getDefaultAudienceForTokenType(tokenType),
    description: TOKEN_TYPE_DESCRIPTIONS[tokenType],
    default_scopes: getDefaultScopesForTokenType(tokenType),
    status:
      tokenType === 'user_session_token'
        ? 'active_in_v0.6.1'
        : tokenType === 'personal_access_token'
          ? 'active_in_v0.6.2'
          : tokenType === 'organisation_api_token'
            ? 'active_in_v0.6.3'
            : 'planned_future'
  }));
}
