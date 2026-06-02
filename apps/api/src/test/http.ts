import request from 'supertest';
import { createApp } from '../app.js';

export const app = createApp();
export const api = request(app);

export async function login(email: string, password: string, organisationSlug?: string) {
  const response = await api.post('/api/auth/login').send({
    email,
    password,
    organisation_slug: organisationSlug
  });

  return response.body?.data?.access_token as string | undefined;
}
