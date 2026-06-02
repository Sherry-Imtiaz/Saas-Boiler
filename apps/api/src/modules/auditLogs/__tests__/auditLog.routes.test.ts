import { describe, expect, it } from 'vitest';
import { api, login } from '../../../test/http.js';
import { createAuditLogForTenant, createTestTenant } from '../../../test/testData.js';

describe('audit log routes', () => {
  it('returns only audit logs for the authenticated organisation on org routes', async () => {
    const tenantA = await createTestTenant({ permissions: ['audit.view'] });
    const tenantB = await createTestTenant({ permissions: ['audit.view'] });
    const ownLog = await createAuditLogForTenant(tenantA.organisation._id, 'test.audit.scope');
    await createAuditLogForTenant(tenantB.organisation._id, 'test.audit.scope');

    const token = await login(tenantA.email, tenantA.password, tenantA.organisation.slug);
    const response = await api.get('/api/org/audit-logs?action=test.audit.scope').set('Authorization', `Bearer ${token}`).expect(200);

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ownLog._id.toString());
    expect(response.body.data[0].organisation_id).toBe(tenantA.organisation._id.toString());
  });

  it('requires audit permission on org audit routes', async () => {
    const tenant = await createTestTenant({ permissions: [] });
    const token = await login(tenant.email, tenant.password, tenant.organisation.slug);

    const response = await api.get('/api/org/audit-logs').set('Authorization', `Bearer ${token}`).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows platform audit visibility when platform audit permission exists', async () => {
    const platformTenant = await createTestTenant({ permissions: ['audit.platform.view'] });
    const tenantB = await createTestTenant({ permissions: ['audit.view'] });
    const platformLog = await createAuditLogForTenant(platformTenant.organisation._id, 'test.audit.platform.scope');
    const otherLog = await createAuditLogForTenant(tenantB.organisation._id, 'test.audit.platform.scope');

    const token = await login(platformTenant.email, platformTenant.password, platformTenant.organisation.slug);
    const response = await api.get('/api/platform/audit-logs?action=test.audit.platform.scope').set('Authorization', `Bearer ${token}`).expect(200);

    expect(response.body.pagination.total).toBe(2);
    const ids = response.body.data.map((record: { id: string }) => record.id);
    expect(ids).toContain(platformLog._id.toString());
    expect(ids).toContain(otherLog._id.toString());
  });
});
