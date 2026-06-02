import { describe, expect, it } from 'vitest';

async function loadOidcUtilities() {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/saas_boilerplate_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'unit-test-jwt-secret-longer-than-32-characters';
  process.env.OIDC_STATE_SECRET = process.env.OIDC_STATE_SECRET ?? 'unit-test-oidc-state-secret-longer-than-32-characters';
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  return import('../oidc.js');
}

describe('OIDC utilities', () => {
  it('requires a JWKS URI for manual provider metadata', async () => {
    const { resolveProviderMetadata } = await loadOidcUtilities();

    await expect(resolveProviderMetadata({
      enabled: true,
      protocol: 'oidc',
      issuer_url: 'https://identity.example.com',
      authorization_endpoint: 'https://identity.example.com/oauth2/authorize',
      token_endpoint: 'https://identity.example.com/oauth2/token',
      client_id: 'saas-client'
    })).rejects.toThrow('manual issuer/authorization/token/JWKS endpoints are incomplete');
  });

  it('rejects id tokens when provider metadata has no JWKS URI', async () => {
    const { validateIdToken } = await loadOidcUtilities();

    await expect(validateIdToken({
      idToken: 'header.payload.signature',
      metadata: {
        issuer: 'https://identity.example.com',
        authorization_endpoint: 'https://identity.example.com/oauth2/authorize',
        token_endpoint: 'https://identity.example.com/oauth2/token'
      },
      config: {
        enabled: true,
        protocol: 'oidc',
        issuer_url: 'https://identity.example.com',
        client_id: 'saas-client'
      },
      nonce: 'nonce'
    })).rejects.toThrow('OIDC provider JWKS URI is required');
  });
});
