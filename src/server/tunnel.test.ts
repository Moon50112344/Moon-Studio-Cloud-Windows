import test from 'node:test';
import assert from 'node:assert/strict';
import { TunnelManager } from './tunnel';

test('TunnelManager initializes with correct default port and disconnected state without fake IP', () => {
  const manager = new TunnelManager(3389);
  const status = manager.getStatus();
  assert.equal(status.active, false);
  assert.equal(status.isVerified, false);
  assert.equal(status.status, 'DISCONNECTED');
  assert.notEqual(status.publicHost, '159.223.110.159');
});

