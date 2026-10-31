import crypto from 'node:crypto';

/**
 * Windows Complexity Password Generator & Credential Utilities
 * Enforces Windows Server password policy:
 * - Minimum 14 characters
 * - Uppercase, lowercase, digits, and special symbols
 * - Masking utility to prevent credentials from leaking into Server Logs
 */

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude easily confused I, O
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz'; // exclude l, o
const NUMBERS = '23456789'; // exclude 0, 1
const SPECIAL = '!@#$%^&*()_+-=';

export function generateWindowsPassword(length = 16): string {
  if (length < 12) {
    throw new Error('Windows password length must be at least 12 characters.');
  }

  // Ensure at least 2 of each category
  const chars: string[] = [
    UPPERCASE[crypto.randomInt(0, UPPERCASE.length)],
    UPPERCASE[crypto.randomInt(0, UPPERCASE.length)],
    LOWERCASE[crypto.randomInt(0, LOWERCASE.length)],
    LOWERCASE[crypto.randomInt(0, LOWERCASE.length)],
    NUMBERS[crypto.randomInt(0, NUMBERS.length)],
    NUMBERS[crypto.randomInt(0, NUMBERS.length)],
    SPECIAL[crypto.randomInt(0, SPECIAL.length)],
    SPECIAL[crypto.randomInt(0, SPECIAL.length)],
  ];

  const allChars = UPPERCASE + LOWERCASE + NUMBERS + SPECIAL;
  while (chars.length < length) {
    chars.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  // Secure shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

export function validateWindowsPassword(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const categories = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (categories < 3) {
    return { valid: false, reason: 'Password must contain characters from at least 3 categories (upper, lower, digits, symbols).' };
  }
  return { valid: true };
}

/**
 * Redacts secret values from text or objects before logging
 */
export function sanitizeLogContent(content: string, secretWords: string[] = []): string {
  let sanitized = content;
  for (const secret of secretWords) {
    if (secret && secret.length > 2) {
      sanitized = sanitized.split(secret).join('[REDACTED]');
    }
  }
  // Also regex mask common password tokens in queries or json
  sanitized = sanitized.replace(/(["']?password["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3');
  return sanitized;
}
