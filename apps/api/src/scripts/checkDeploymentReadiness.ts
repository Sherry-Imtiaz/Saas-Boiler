import { connectMongo, disconnectMongo } from '../database/mongo.js';
import { env } from '../config/env.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

const checks: CheckResult[] = [];
const skipDb = process.argv.includes('--skip-db');
const strict = process.argv.includes('--strict') || env.NODE_ENV === 'production';

function addCheck(name: string, status: CheckResult['status'], detail: string) {
  checks.push({ name, status, detail });
}

function containsPlaceholder(value: string) {
  const lower = value.toLowerCase();
  return lower.includes('change-this') || lower.includes('local-development') || lower.includes('changeme') || lower.includes('example');
}

function isLocalhostUrl(value: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

function checkStaticConfiguration() {
  addCheck('node_env', env.NODE_ENV === 'production' ? 'pass' : 'warn', `NODE_ENV=${env.NODE_ENV}. Use NODE_ENV=production for production deployment.`);

  addCheck(
    'api_base_path',
    env.API_BASE_PATH.startsWith('/') ? 'pass' : 'fail',
    `API_BASE_PATH=${env.API_BASE_PATH}. It must start with /.`
  );

  addCheck(
    'jwt_secret_strength',
    env.JWT_SECRET.length >= 32 && !containsPlaceholder(env.JWT_SECRET) ? 'pass' : strict ? 'fail' : 'warn',
    'JWT_SECRET must be at least 32 characters and must not use example/local placeholder values.'
  );

  addCheck(
    'cors_origin',
    env.CORS_ORIGIN && (!strict || !isLocalhostUrl(env.CORS_ORIGIN)) ? 'pass' : strict ? 'fail' : 'warn',
    `CORS_ORIGIN=${env.CORS_ORIGIN}. Production deployments should use the real frontend origin, not localhost.`
  );

  addCheck(
    'mongodb_uri',
    env.MONGODB_URI && (!strict || !isLocalhostUrl(env.MONGODB_URI)) ? 'pass' : strict ? 'fail' : 'warn',
    strict ? 'Production MONGODB_URI should point to a managed/secured MongoDB endpoint, not localhost.' : 'Local MongoDB URI accepted for development.'
  );

  addCheck(
    'oidc_state_secret',
    env.OIDC_STATE_SECRET.length >= 32 && !containsPlaceholder(env.OIDC_STATE_SECRET) ? 'pass' : strict ? 'fail' : 'warn',
    'OIDC_STATE_SECRET signs SSO state. Set a unique 32+ character value in production.'
  );

  addCheck(
    'oidc_plain_client_secret',
    env.OIDC_ALLOW_PLAIN_CLIENT_SECRET && strict ? 'fail' : 'pass',
    'OIDC_ALLOW_PLAIN_CLIENT_SECRET must remain false in production. Prefer client_secret_ref=env://VARIABLE_NAME.'
  );

  if (env.STORAGE_PROVIDER === 'azure_blob') {
    const hasConnectionString = env.AZURE_STORAGE_CONNECTION_STRING.length > 0;
    const hasAccountName = env.AZURE_STORAGE_ACCOUNT_NAME.length > 0;
    addCheck(
      'azure_blob_storage_configuration',
      hasConnectionString || hasAccountName ? 'pass' : 'fail',
      'STORAGE_PROVIDER=azure_blob requires AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME.'
    );
    addCheck(
      'azure_container_name',
      env.AZURE_STORAGE_CONTAINER_NAME.length > 0 ? 'pass' : 'fail',
      'AZURE_STORAGE_CONTAINER_NAME must be set when using Azure Blob Storage.'
    );
    addCheck(
      'azurite_not_production',
      env.AZURE_STORAGE_USE_AZURITE && strict ? 'fail' : 'pass',
      'AZURE_STORAGE_USE_AZURITE is for local development only.'
    );
  } else {
    addCheck(
      'local_storage_provider',
      strict ? 'warn' : 'pass',
      'STORAGE_PROVIDER=local is acceptable for development. Prefer Azure Blob Storage or equivalent durable object storage for production.'
    );
  }
}

async function checkDatabaseConnection() {
  if (skipDb) {
    addCheck('database_connection', 'warn', 'Skipped database connection check because --skip-db was supplied.');
    return;
  }

  try {
    await connectMongo();
    addCheck('database_connection', 'pass', 'MongoDB connection succeeded.');
  } catch (error) {
    addCheck('database_connection', 'fail', error instanceof Error ? error.message : 'MongoDB connection failed.');
  } finally {
    await disconnectMongo();
  }
}

async function main() {
  checkStaticConfiguration();
  await checkDatabaseConnection();

  const summary = {
    version: '1.0.0',
    build: 'Stable Release',
    mode: strict ? 'strict' : 'development',
    status: checks.some((check) => check.status === 'fail') ? 'not_ready' : checks.some((check) => check.status === 'warn') ? 'ready_with_warnings' : 'ready',
    totals: {
      pass: checks.filter((check) => check.status === 'pass').length,
      warn: checks.filter((check) => check.status === 'warn').length,
      fail: checks.filter((check) => check.status === 'fail').length
    },
    checks
  };

  console.log('Deployment readiness summary');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.status === 'not_ready') {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('Deployment readiness check failed:', error);
  await disconnectMongo();
  process.exit(1);
});
