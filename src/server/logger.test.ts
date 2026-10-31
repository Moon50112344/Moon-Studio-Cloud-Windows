import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerLogger } from './logger';
import fs from 'node:fs';
import path from 'node:path';

test('ServerLogger records logs with correct structure and redaction', () => {
  const tmpDir = path.resolve(process.cwd(), 'data/logs/test-logs');
  const logger = new ServerLogger(tmpDir);

  logger.registerSecret('SuperSecretPass999!');
  const entry = logger.info('Hypervisor', 'Created VM with password SuperSecretPass999!', 'vm-01');

  assert.equal(entry.level, 'INFO');
  assert.equal(entry.component, 'Hypervisor');
  assert.equal(entry.vmId, 'vm-01');
  assert.equal(entry.message.includes('SuperSecretPass999!'), false);
  assert.equal(entry.message.includes('[REDACTED]'), true);

  const logs = logger.getLogs({ vmId: 'vm-01' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].id, entry.id);

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
