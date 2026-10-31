import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWindowsPassword, validateWindowsPassword, sanitizeLogContent } from './credentials';

test('generates valid Windows complexity password', () => {
  const pwd = generateWindowsPassword(16);
  assert.equal(pwd.length, 16);
  const validation = validateWindowsPassword(pwd);
  assert.equal(validation.valid, true);
});

test('validates password criteria strictly', () => {
  assert.equal(validateWindowsPassword('short').valid, false);
  assert.equal(validateWindowsPassword('alllowercaseletters').valid, false);
  assert.equal(validateWindowsPassword('ValidPass123!').valid, true);
});

test('sanitizes password from log statements', () => {
  const secret = 'SecretWinPwd123!';
  const message = `Provisioned VM with password: ${secret} for user Admin`;
  const sanitized = sanitizeLogContent(message, [secret]);
  assert.equal(sanitized.includes(secret), false);
  assert.equal(sanitized.includes('[REDACTED]'), true);

  const jsonSnippet = '{"username":"admin","password":"MySecretPass123$"}';
  const sanitizedJson = sanitizeLogContent(jsonSnippet);
  assert.equal(sanitizedJson.includes('MySecretPass123$'), false);
  assert.equal(sanitizedJson.includes('[REDACTED]'), true);
});
