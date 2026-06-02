import { describe, expect, it } from 'vitest';
import { SecurityEventModel } from '../../../models/index.js';
import { api } from '../../../test/http.js';
import { createTestTenant } from '../../../test/testData.js';

describe('auth routes', () => {
  it('logs in a native user and returns token context', async () => {
    const tenant = await createTestTenant({ permissions: ['organisation.view'] });

    const response = await api
      .post('/api/auth/login')
      .send({ email: tenant.email, password: tenant.password, organisation_slug: tenant.organisation.slug })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.access_token).toEqual(expect.any(String));
    expect(response.body.data.token_context.token_type).toBe('user_session_token');
    expect(response.body.data.organisation.slug).toBe(tenant.organisation.slug);
  });

  it('rejects invalid credentials and records a security event for an existing user', async () => {
    const tenant = await createTestTenant({ permissions: ['organisation.view'] });

    const response = await api
      .post('/api/auth/login')
      .send({ email: tenant.email, password: 'wrong-password', organisation_slug: tenant.organisation.slug })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');

    const event = await SecurityEventModel.findOne({ organisation_id: tenant.organisation._id, event_type: 'auth.login.failed' }).lean();
    expect(event?.status).toBe('failure');
  });
});
