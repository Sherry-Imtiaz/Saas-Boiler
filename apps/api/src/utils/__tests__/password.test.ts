import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

describe('password utilities', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('CorrectHorseBatteryStaple123!');

    expect(hash).not.toContain('CorrectHorseBatteryStaple123!');
    expect(verifyPassword('CorrectHorseBatteryStaple123!', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('rejects missing or malformed password hashes', () => {
    expect(verifyPassword('password', null)).toBe(false);
    expect(verifyPassword('password', 'not-a-valid-hash')).toBe(false);
  });
});
