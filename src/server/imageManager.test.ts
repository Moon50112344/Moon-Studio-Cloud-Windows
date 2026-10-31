import test from 'node:test';
import assert from 'node:assert/strict';
import { imageManager } from './imageManager';

test('ImageManager provides only Debian 12 and Windows 7', () => {
  const catalog = imageManager.getOsCatalog();
  assert.equal(catalog.length, 2);

  const ids = catalog.map((o) => o.id);
  assert.ok(ids.includes('debian-12'));
  assert.ok(ids.includes('windows-7'));
  assert.ok(!ids.includes('windows-10' as any));
  assert.ok(!ids.includes('ubuntu' as any));
});

test('ImageManager Debian 12 has active LTS support', () => {
  const debian = imageManager.getOsDefinition('debian-12');
  assert.ok(debian);
  assert.equal(debian.name, 'Debian 12');
  assert.equal(debian.supportStatus, 'Active LTS');
});

test('ImageManager Windows 7 includes End of Support warning', () => {
  const win7 = imageManager.getOsDefinition('windows-7');
  assert.ok(win7);
  assert.equal(win7.name, 'Windows 7');
  assert.equal(win7.supportStatus, 'End of Support (EOS)');
  assert.ok(win7.securityWarning);
  assert.ok(win7.securityWarning.includes('Microsoft'));
});

test('ImageManager prepares and verifies bootable images for both OS targets without errors', async () => {
  const debianIso = await imageManager.ensureImageReady('debian-12');
  assert.ok(debianIso.includes('debian-12-standard.iso'));

  const win7Iso = await imageManager.ensureImageReady('windows-7');
  assert.ok(win7Iso.includes('windows-7-sp1-x64.iso'));
});

