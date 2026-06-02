import crypto from 'crypto';
import {
  getDefaultAudienceForTokenType,
  getDefaultScopesForTokenType,
  isTokenAudience,
  isTokenType,
  type TokenAudience,
  type TokenScope,
  type TokenType
} from './tokenTypes.js';

export interface JwtPayload {
  sub: string;
  organisation_id: string;
  email: string;
  role_ids: string[];
  token_type: TokenType;
  audience: TokenAudience;
  scopes: TokenScope[];
  token_id?: string | null;
  mfa_required?: boolean;
  mfa_verified?: boolean;
  mfa_provider?: string | null;
  mfa_enforcement_mode?: string | null;
  amr?: string[];
  acr?: string | null;
  iat: number;
  exp: number;
}

type JwtPayloadInput = Omit<JwtPayload, 'iat' | 'exp' | 'token_type' | 'audience' | 'scopes'> & {
  token_type?: TokenType;
  audience?: TokenAudience;
  scopes?: TokenScope[];
};

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signTokenInput(input: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export function signJwt(payload: JwtPayloadInput, secret: string, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenType = payload.token_type ?? 'user_session_token';
  const audience = payload.audience ?? getDefaultAudienceForTokenType(tokenType);
  const scopes = payload.scopes ?? getDefaultScopesForTokenType(tokenType);

  const fullPayload: JwtPayload = {
    ...payload,
    token_type: tokenType,
    audience,
    scopes,
    token_id: payload.token_id ?? null,
    mfa_required: payload.mfa_required ?? false,
    mfa_verified: payload.mfa_verified ?? false,
    mfa_provider: payload.mfa_provider ?? null,
    mfa_enforcement_mode: payload.mfa_enforcement_mode ?? null,
    amr: payload.amr ?? [],
    acr: payload.acr ?? null,
    iat: now,
    exp: now + expiresInSeconds
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(fullPayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signTokenInput(signingInput, secret);

  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signTokenInput(signingInput, secret);

  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('Invalid token signature.');
  }

  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported token header.');
  }

  const rawPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<JwtPayload>;
  const now = Math.floor(Date.now() / 1000);

  if (!rawPayload.sub || !rawPayload.organisation_id || !rawPayload.email || !Array.isArray(rawPayload.role_ids)) {
    throw new Error('Invalid token payload.');
  }

  if (!rawPayload.exp || rawPayload.exp <= now) {
    throw new Error('Token has expired.');
  }

  const tokenType = isTokenType(rawPayload.token_type) ? rawPayload.token_type : 'user_session_token';
  const audience = isTokenAudience(rawPayload.audience) ? rawPayload.audience : getDefaultAudienceForTokenType(tokenType);
  const scopes = Array.isArray(rawPayload.scopes) ? rawPayload.scopes.filter((scope): scope is string => typeof scope === 'string') : getDefaultScopesForTokenType(tokenType);

  return {
    sub: rawPayload.sub,
    organisation_id: rawPayload.organisation_id,
    email: rawPayload.email,
    role_ids: rawPayload.role_ids,
    token_type: tokenType,
    audience,
    scopes,
    token_id: rawPayload.token_id ?? null,
    mfa_required: Boolean(rawPayload.mfa_required),
    mfa_verified: Boolean(rawPayload.mfa_verified),
    mfa_provider: rawPayload.mfa_provider ?? null,
    mfa_enforcement_mode: rawPayload.mfa_enforcement_mode ?? null,
    amr: Array.isArray(rawPayload.amr) ? rawPayload.amr.filter((value): value is string => typeof value === 'string') : [],
    acr: rawPayload.acr ?? null,
    iat: rawPayload.iat ?? 0,
    exp: rawPayload.exp
  };
}
