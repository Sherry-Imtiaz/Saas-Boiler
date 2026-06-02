import { describe, expect, it } from 'vitest';
import { api } from '../../../test/http.js';

describe('health routes', () => {
  it('returns liveness metadata', async () => {
    const response = await api.get('/api/health/live').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('alive');
    expect(response.body.version).toBe('1.0.0');
  });

  it('returns readiness when the test database is connected', async () => {
    const response = await api.get('/api/health/ready').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks.database.ready).toBe(true);
  });
});
