import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from '../jwt.js';

describe('JWT utilities', () => {
  const secret = 'unit-test-jwt-secret-longer-than-32-characters';

  it('signs and verifies an internal user session token', () => {
    const token = signJwt(
      {
        sub: 'user-1',
        organisation_id: 'org-1',
        email: 'admin@example.com',
        role_ids: ['role-1']
      },
      secret,
      3600
    );

    const payload = verifyJwt(token, secret);

    expect(payload.sub).toBe('user-1');
    expect(payload.organisation_id).toBe('org-1');
    expect(payload.email).toBe('admin@example.com');
    expect(payload.token_type).toBe('user_session_token');
    expect(payload.audience).toBe('internal');
  });

  it('rejects tokens signed with the wrong secret', () => {
    const token = signJwt(
      {
        sub: 'user-1',
        organisation_id: 'org-1',
        email: 'admin@example.com',
        role_ids: []
      },
      secret,
      3600
    );

    expect(() => verifyJwt(token, 'wrong-secret-longer-than-32-characters')).toThrow('Invalid token signature.');
  });
});
