import crypto from 'crypto';

const PASSWORD_ALGORITHM = 'pbkdf2_sha256';
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('base64url');

  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) {
    return false;
  }

  const [algorithm, iterationsRaw, salt, expectedHash] = storedHash.split('$');

  if (algorithm !== PASSWORD_ALGORITHM || !iterationsRaw || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const actualHash = crypto
    .pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('base64url');

  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
