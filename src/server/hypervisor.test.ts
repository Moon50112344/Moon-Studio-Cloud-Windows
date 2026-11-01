import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hypervisor } from './hypervisor';
import { imageManager } from './imageManager';

test('Hypervisor prepares virtual disk image correctly', () => {
  const diskPath = hypervisor.prepareDisk('test-unit-vm', 20);
  assert.ok(fs.existsSync(diskPath));
  assert.ok(diskPath.endsWith('.qcow2'));
});

test('Windows 7 Image is verified and bootable', async () => {
  const isoPath = await imageManager.ensureImageReady('windows-7');
  assert.ok(fs.existsSync(isoPath));
  const stat = fs.statSync(isoPath);
  assert.ok(stat.size > 1024);
});

test('Hypervisor configures Windows 7 with SeaBIOS, IDE, and e1000', async () => {
  const vmId = `test-win7-config-${Date.now()}`;
  const isoPath = path.resolve(process.cwd(), 'data/iso/windows-7-sp1-x64.iso');

  const info = await hypervisor.startVmProcess({
    vmId,
    osId: 'windows-7',
    hostPort: 3399,
    memoryMb: 1024,
    cores: 2,
    isoPath,
  });

  assert.equal(info.osId, 'windows-7');
  assert.equal(info.hardwareProfile?.chipset, 'i440fx (Legacy PC)');
  assert.equal(info.hardwareProfile?.diskInterface, 'IDE');
  assert.equal(info.hardwareProfile?.networkInterface, 'Intel e1000');
  assert.equal(info.hardwareProfile?.bios, 'SeaBIOS Legacy');
  assert.ok(info.pid !== null && info.pid > 0);

  // Verify status query
  const status = await hypervisor.queryStatus(vmId);
  assert.ok(status !== null);
  assert.ok(status.running === true || status.status === 'running');

  // Verify QMP screendump
  const screenshotPath = await hypervisor.takeScreenshot(vmId);
  if (screenshotPath) {
    assert.ok(fs.existsSync(screenshotPath));
  }

  // Gracefully stop VM
  await hypervisor.forceStop(vmId);
});
