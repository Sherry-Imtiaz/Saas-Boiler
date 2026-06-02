import crypto from 'crypto';

export function hashBearerToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function formatTokenPreview(token: string): string {
  if (token.length <= 24) {
    return token;
  }

  return `${token.slice(0, 12)}...${token.slice(-8)}`;
}
