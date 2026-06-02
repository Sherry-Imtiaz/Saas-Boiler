import { describe, expect, it } from 'vitest';
import { api, login } from '../../../test/http.js';
import { createSecurityEventForTenant, createTestTenant } from '../../../test/testData.js';

describe('security event routes', () => {
  it('returns only security events for the authenticated organisation on org routes', async () => {
    const tenantA = await createTestTenant({ permissions: ['security.events.view'] });
    const tenantB = await createTestTenant({ permissions: ['security.events.view'] });
    const ownEvent = await createSecurityEventForTenant(tenantA.organisation._id, 'test.security.scope', 'medium', 'warning');
    await createSecurityEventForTenant(tenantB.organisation._id, 'test.security.scope', 'high', 'blocked');

    const token = await login(tenantA.email, tenantA.password, tenantA.organisation.slug);
    const response = await api.get('/api/org/security-events?event_type=test.security.scope').set('Authorization', `Bearer ${token}`).expect(200);

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ownEvent._id.toString());
    expect(response.body.data[0].organisation_id).toBe(tenantA.organisation._id.toString());
  });

  it('filters security events by severity and status', async () => {
    const tenant = await createTestTenant({ permissions: ['security.events.view'] });
    await createSecurityEventForTenant(tenant.organisation._id, 'test.security.low', 'low', 'success');
    const target = await createSecurityEventForTenant(tenant.organisation._id, 'test.security.high', 'high', 'blocked');

    const token = await login(tenant.email, tenant.password, tenant.organisation.slug);
    const response = await api
      .get('/api/org/security-events?severity=high&status=blocked')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data[0].id).toBe(target._id.toString());
  });

  it('allows platform security event visibility when platform security permission exists', async () => {
    const platformTenant = await createTestTenant({ permissions: ['security.events.platform.view'] });
    const tenantB = await createTestTenant({ permissions: ['security.events.view'] });
    const platformEvent = await createSecurityEventForTenant(platformTenant.organisation._id, 'test.security.platform.scope');
    const otherEvent = await createSecurityEventForTenant(tenantB.organisation._id, 'test.security.platform.scope');

    const token = await login(platformTenant.email, platformTenant.password, platformTenant.organisation.slug);
    const response = await api.get('/api/platform/security-events?event_type=test.security.platform.scope').set('Authorization', `Bearer ${token}`).expect(200);

    expect(response.body.pagination.total).toBe(2);
    const ids = response.body.data.map((record: { id: string }) => record.id);
    expect(ids).toContain(platformEvent._id.toString());
    expect(ids).toContain(otherEvent._id.toString());
  });
});
