import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyStringToUndefined = (value: unknown) => (value === '' ? undefined : value);


const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_PATH: z.string().default('/api'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  STORAGE_PROVIDER: z.enum(['local', 'azure_blob']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('apps/api/storage'),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional().default(''),
  AZURE_STORAGE_CONTAINER_NAME: z.string().default('saas-files'),
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional().default(''),
  AZURE_STORAGE_USE_AZURITE: z.coerce.boolean().default(false),
  OIDC_STATE_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()).transform((value) => value ?? ''),
  OIDC_STATE_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(600),
  OIDC_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  OIDC_FRONTEND_CALLBACK_URL: z.preprocess(emptyStringToUndefined, z.string().optional()).transform((value) => value ?? ''),
  OIDC_ALLOW_PLAIN_CLIENT_SECRET: z.coerce.boolean().default(false)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
