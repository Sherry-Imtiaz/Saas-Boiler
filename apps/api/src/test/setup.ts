import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

let mongoServer: MongoMemoryServer | null = null;

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '4001';
process.env.API_BASE_PATH = process.env.API_BASE_PATH ?? '/api';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-that-is-longer-than-32-characters';
process.env.JWT_EXPIRES_IN_SECONDS = process.env.JWT_EXPIRES_IN_SECONDS ?? '3600';
process.env.OIDC_STATE_SECRET = process.env.OIDC_STATE_SECRET ?? 'test-oidc-state-secret-longer-than-32-characters';
process.env.OIDC_ALLOW_PLAIN_CLIENT_SECRET = process.env.OIDC_ALLOW_PLAIN_CLIENT_SECRET ?? 'true';
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'local';
process.env.STORAGE_LOCAL_ROOT = process.env.STORAGE_LOCAL_ROOT ?? 'apps/api/storage-test';

const useMemoryServer = process.env.USE_MONGODB_MEMORY_SERVER === 'true';
const defaultLocalTestMongoUri = 'mongodb://127.0.0.1:27017/saas_boilerplate_test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI ?? defaultLocalTestMongoUri;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (useMemoryServer) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri('saas_boilerplate_test');
  } else {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI ?? defaultLocalTestMongoUri;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required for integration tests. Set TEST_MONGODB_URI or USE_MONGODB_MEMORY_SERVER=true.');
  }

  await mongoose.connect(mongoUri);
});

afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
