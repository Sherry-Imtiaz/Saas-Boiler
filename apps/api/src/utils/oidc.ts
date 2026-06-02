import crypto, { type JsonWebKey as CryptoJsonWebKey } from 'crypto';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';
import { normaliseSsoConfig, type SsoConfigLike } from './ssoConfig.js';

export interface OidcProviderMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  response_types_supported?: string[];
  scopes_supported?: string[];
  claims_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

export interface OidcStatePayload {
  organisation_id: string;
  organisation_slug: string;
  provider: string;
  nonce: string;
  code_verifier: string;
  return_to?: string | null;
  created_at: number;
  expires_at: number;
}

export interface OidcTokenResponse {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
}

export interface OidcClaims {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[] | string;
  amr?: string[];
  acr?: string;
  [key: string]: unknown;
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function sha256Base64Url(value: string): string {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function hmac(value: string): string {
  return crypto.createHmac('sha256', env.OIDC_STATE_SECRET || env.JWT_SECRET).update(value).digest('base64url');
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPkcePair() {
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  return {
    code_verifier: codeVerifier,
    code_challenge: sha256Base64Url(codeVerifier),
    code_challenge_method: 'S256' as const
  };
}

export function createOidcNonce(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function signOidcState(payload: OidcStatePayload): string {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = hmac(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOidcState(state: string): OidcStatePayload {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new HttpError(400, 'Invalid OIDC state format.');
  }

  const expected = hmac(encodedPayload);
  if (!timingSafeEqualString(signature, expected)) {
    throw new HttpError(400, 'Invalid OIDC state signature.');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<OidcStatePayload>;
  if (!payload.organisation_id || !payload.organisation_slug || !payload.nonce || !payload.code_verifier || !payload.expires_at) {
    throw new HttpError(400, 'Invalid OIDC state payload.');
  }

  if (payload.expires_at <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(400, 'OIDC state has expired. Start the SSO login again.');
  }

  return payload as OidcStatePayload;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OIDC_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError(response.status, `OIDC provider request failed: ${response.status} ${response.statusText}`, body.slice(0, 500));
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveProviderMetadata(config: SsoConfigLike): Promise<OidcProviderMetadata> {
  const sso = normaliseSsoConfig(config);
  if (sso.protocol !== 'oidc') {
    throw new HttpError(400, 'Only OIDC protocol is active in this build.');
  }

  if (sso.discovery_url) {
    const metadata = await fetchJson<OidcProviderMetadata>(sso.discovery_url);
    if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.issuer || !metadata.jwks_uri) {
      throw new HttpError(400, 'OIDC discovery metadata is missing required endpoints.');
    }
    return metadata;
  }

  if (!sso.issuer_url || !sso.authorization_endpoint || !sso.token_endpoint || !sso.jwks_uri) {
    throw new HttpError(400, 'OIDC discovery_url is missing and manual issuer/authorization/token/JWKS endpoints are incomplete.');
  }

  return {
    issuer: sso.issuer_url,
    authorization_endpoint: sso.authorization_endpoint,
    token_endpoint: sso.token_endpoint,
    userinfo_endpoint: sso.userinfo_endpoint ?? undefined,
    jwks_uri: sso.jwks_uri,
    end_session_endpoint: sso.logout_endpoint ?? undefined
  };
}

export function buildAuthorizationUrl(params: {
  metadata: OidcProviderMetadata;
  config: SsoConfigLike;
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const sso = normaliseSsoConfig(params.config);
  if (!sso.client_id || !sso.redirect_uri) {
    throw new HttpError(400, 'OIDC client_id and redirect_uri are required.');
  }

  const url = new URL(params.metadata.authorization_endpoint);
  url.searchParams.set('client_id', sso.client_id);
  url.searchParams.set('redirect_uri', sso.redirect_uri);
  url.searchParams.set('response_type', sso.response_type ?? 'code');
  url.searchParams.set('scope', sso.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  if (sso.pkce_enabled) {
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

export function resolveClientSecret(clientSecretRef?: string | null): string | null {
  if (!clientSecretRef) {
    return null;
  }

  if (clientSecretRef.startsWith('env://')) {
    return process.env[clientSecretRef.slice('env://'.length)] ?? null;
  }

  if (clientSecretRef.startsWith('env:')) {
    return process.env[clientSecretRef.slice('env:'.length)] ?? null;
  }

  if (clientSecretRef.startsWith('plain://')) {
    if (!env.OIDC_ALLOW_PLAIN_CLIENT_SECRET) {
      throw new HttpError(500, 'plain:// OIDC client secrets are disabled. Use env://VARIABLE_NAME instead.');
    }
    return clientSecretRef.slice('plain://'.length);
  }

  if (clientSecretRef.startsWith('secret://local/')) {
    const key = clientSecretRef
      .slice('secret://local/'.length)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
    return process.env[`OIDC_SECRET_${key}`] ?? null;
  }

  return process.env[clientSecretRef] ?? null;
}

export async function exchangeAuthorizationCode(params: {
  metadata: OidcProviderMetadata;
  config: SsoConfigLike;
  code: string;
  codeVerifier: string;
}): Promise<OidcTokenResponse> {
  const sso = normaliseSsoConfig(params.config);
  if (!sso.client_id || !sso.redirect_uri) {
    throw new HttpError(400, 'OIDC client_id and redirect_uri are required for token exchange.');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', params.code);
  body.set('redirect_uri', sso.redirect_uri);
  body.set('client_id', sso.client_id);
  if (sso.pkce_enabled) {
    body.set('code_verifier', params.codeVerifier);
  }

  const clientSecret = resolveClientSecret(sso.client_secret_ref);
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (clientSecret) {
    const basic = Buffer.from(`${sso.client_id}:${clientSecret}`).toString('base64');
    headers.authorization = `Basic ${basic}`;
  }

  return fetchJson<OidcTokenResponse>(params.metadata.token_endpoint, {
    method: 'POST',
    headers,
    body
  });
}

function decodeJwtPart<T>(token: string, index: number): T {
  const part = token.split('.')[index];
  if (!part) {
    throw new HttpError(400, 'Invalid JWT token format.');
  }
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

export function decodeOidcClaims(idToken: string): OidcClaims {
  const claims = decodeJwtPart<Partial<OidcClaims>>(idToken, 1);
  if (!claims.sub) {
    throw new HttpError(401, 'OIDC id_token is missing sub claim.');
  }
  return claims as OidcClaims;
}

async function verifyRs256Jwt(idToken: string, jwksUri: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new HttpError(400, 'Invalid OIDC id_token format.');
  }

  const header = decodeJwtPart<{ alg?: string; kid?: string; typ?: string }>(idToken, 0);
  if (header.alg !== 'RS256') {
    throw new HttpError(401, `Unsupported OIDC id_token signing algorithm: ${header.alg ?? 'unknown'}. Only RS256 is supported in this build.`);
  }

  const jwks = await fetchJson<{ keys?: Array<CryptoJsonWebKey & { kid?: string; kty?: string }> }>(jwksUri);
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!key) {
    throw new HttpError(401, 'OIDC provider JWKS did not contain a matching RSA signing key.');
  }

  const publicKey = crypto.createPublicKey({ key: key as CryptoJsonWebKey, format: 'jwk' });
  const isValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url')
  );

  if (!isValid) {
    throw new HttpError(401, 'OIDC id_token signature verification failed.');
  }
}

export async function validateIdToken(params: {
  idToken: string;
  metadata: OidcProviderMetadata;
  config: SsoConfigLike;
  nonce: string;
}): Promise<OidcClaims> {
  const sso = normaliseSsoConfig(params.config);
  if (!sso.client_id) {
    throw new HttpError(400, 'OIDC client_id is required for id_token validation.');
  }

  if (!params.metadata.jwks_uri) {
    throw new HttpError(400, 'OIDC provider JWKS URI is required for id_token signature verification.');
  }

  await verifyRs256Jwt(params.idToken, params.metadata.jwks_uri);

  const claims = decodeOidcClaims(params.idToken);
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];

  if (claims.exp && claims.exp <= now) {
    throw new HttpError(401, 'OIDC id_token has expired.');
  }

  if (params.metadata.issuer && claims.iss && claims.iss !== params.metadata.issuer) {
    throw new HttpError(401, 'OIDC id_token issuer does not match provider metadata.');
  }

  if (!audience.includes(sso.client_id)) {
    throw new HttpError(401, 'OIDC id_token audience does not include configured client_id.');
  }

  if (claims.nonce !== params.nonce) {
    throw new HttpError(401, 'OIDC id_token nonce does not match the login request.');
  }

  if (sso.require_verified_email && claims.email_verified === false) {
    throw new HttpError(403, 'OIDC provider returned an unverified email address.');
  }

  return claims;
}

export function claimAsString(claims: OidcClaims, key?: string | null): string | null {
  if (!key) return null;
  const value = claims[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function claimAsStringArray(claims: OidcClaims, key?: string | null): string[] {
  if (!key) return [];
  const value = claims[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export function safeReturnTo(value?: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const allowed = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
    if (allowed.includes(url.origin)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}
