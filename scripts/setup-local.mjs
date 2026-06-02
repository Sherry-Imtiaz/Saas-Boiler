import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = process.cwd();
const apiEnvPath = join(root, 'apps', 'api', '.env');
const apiExamplePath = join(root, 'apps', 'api', '.env.example');
const webEnvPath = join(root, 'apps', 'web', '.env');
const webExamplePath = join(root, 'apps', 'web', '.env.example');
const apiStoragePath = join(root, 'apps', 'api', 'storage');

function ensureFileFromExample(target, example) {
  if (!existsSync(target)) {
    if (!existsSync(example)) {
      throw new Error(`Missing example file: ${example}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(example, target);
    console.log(`Created ${target.replace(root + '/', '')}`);
  } else {
    console.log(`Found ${target.replace(root + '/', '')}`);
  }
}

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function ensureEnvValue(text, key, valueFactory, shouldReplace) {
  const lines = text.split(/\r?\n/);
  let found = false;
  const updated = lines.map((line) => {
    if (!line.startsWith(`${key}=`)) return line;
    found = true;
    const current = line.slice(key.length + 1).trim();
    if (shouldReplace(current)) {
      return `${key}=${valueFactory()}`;
    }
    return line;
  });
  if (!found) updated.push(`${key}=${valueFactory()}`);
  return updated.join('\n');
}

function secret() {
  return randomBytes(32).toString('base64url');
}

function updateApiEnv() {
  let text = readFileSync(apiEnvPath, 'utf8');
  text = ensureEnvValue(
    text,
    'JWT_SECRET',
    () => `local-jwt-${secret()}`,
    (current) => current.length < 32 || current === 'change-this-local-development-secret-at-least-32-chars'
  );
  text = ensureEnvValue(
    text,
    'OIDC_STATE_SECRET',
    () => `local-oidc-state-${secret()}`,
    (current) => current.length > 0 && current.length < 32
  );
  text = ensureEnvValue(text, 'MONGODB_URI', () => 'mongodb://localhost:27017/saas_boilerplate', (current) => current.length === 0);
  text = ensureEnvValue(text, 'CORS_ORIGIN', () => 'http://localhost:5173', (current) => current.length === 0);
  writeFileSync(apiEnvPath, text.replace(/\n{3,}/g, '\n\n'));

  const values = parseEnv(text);
  console.log('API env ready', {
    MONGODB_URI: values.get('MONGODB_URI'),
    JWT_SECRET: values.get('JWT_SECRET') ? `${values.get('JWT_SECRET').slice(0, 14)}...` : 'missing',
    OIDC_STATE_SECRET: values.get('OIDC_STATE_SECRET') ? `${values.get('OIDC_STATE_SECRET').slice(0, 14)}...` : 'empty/falls back to JWT_SECRET'
  });
}

const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
if (major < 20) {
  throw new Error(`Node.js 20+ is required. Current Node.js version is ${process.version}. Recommended local version: Node 22 LTS.`);
}

ensureFileFromExample(apiEnvPath, apiExamplePath);
ensureFileFromExample(webEnvPath, webExamplePath);
mkdirSync(apiStoragePath, { recursive: true });
updateApiEnv();
console.log('Local setup files are ready. Next common commands: docker compose up -d, npm install, npm run seed, npm run check:install, npm run dev');
