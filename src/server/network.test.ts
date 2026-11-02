import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkManager } from './network';

test('NetworkManager allocates and releases unique ports', () => {
  const manager = new NetworkManager();
  const p1 = manager.allocatePort('vm-1');
  const p2 = manager.allocatePort('vm-2');

  assert.notEqual(p1, p2);
  assert.equal(p1, 3390);
  assert.equal(p2, 3391);

  manager.releasePort(p1, 'vm-1');
  const p3 = manager.allocatePort('vm-3');
  assert.equal(p3, 3390); // re-allocated freed port
});

test('formats connection address with port or standard 3389', () => {
  const manager = new NetworkManager();
  assert.equal(manager.formatConnectionAddress('103.145.62.10', 3389), '103.145.62.10');
  assert.equal(manager.formatConnectionAddress('103.145.62.10', 3390), '103.145.62.10:3390');
});
