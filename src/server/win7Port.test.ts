import test from 'node:test';
import assert from 'node:assert/strict';
import { VmManager } from './vmManager';
import { tunnelManager } from './tunnel';

test('Creating Windows 7 VM allocates a dedicated local port distinct from default port 3389 and does not use static port 41735', async () => {
  const manager = new VmManager();
  
  const win7Vm = await manager.createVm({
    osId: 'windows-7',
    name: 'Windows 7 Test VM',
  });

  // Must not collide with default 3389
  assert.notEqual(win7Vm.localPort, 3389, 'Windows 7 local port must not collide with default port 3389');
  assert.equal(typeof win7Vm.localPort, 'number');
  assert.ok(win7Vm.localPort >= 3390, 'Windows 7 local port must be allocated from dynamic pool (>=3390)');

  // Verify that TunnelManager configures Windows 7 with dynamic port, never static 41735
  const win7Status = tunnelManager.getStatus(win7Vm.id);
  // Status preferred port for Windows 7 should be null (dynamic)
  assert.notEqual(win7Status.publicPort, 41735, 'Windows 7 must never reuse static port 41735');

  // Cleanup
  tunnelManager.stop(win7Vm.id);
  await manager.deleteVm(win7Vm.id);
});
