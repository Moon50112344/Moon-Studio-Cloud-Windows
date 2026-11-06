import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appStoreService } from './appStoreService';

test('AppStoreService provides full catalog including Roblox', () => {
  const catalog = appStoreService.getCatalog();
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length >= 5);

  const roblox = catalog.find((item) => item.id === 'roblox');
  assert.ok(roblox, 'Roblox must exist in catalog');
  assert.equal(roblox.name, 'Roblox Player');
  assert.equal(roblox.category, 'game');
  assert.equal(typeof roblox.isInstalled, 'boolean');
});

test('AppStoreService installs Roblox and creates Desktop shortcut', async () => {
  // Execute install for roblox
  const result = await appStoreService.installApp('roblox');
  assert.equal(result.success, true);
  assert.equal(result.appId, 'roblox');
  assert.ok(result.desktopFile);
  assert.ok(fs.existsSync(result.desktopFile));

  // Check if isAppInstalled returns true
  assert.equal(appStoreService.isAppInstalled('roblox'), true);

  // Check catalog shows isInstalled === true
  const catalog = appStoreService.getCatalog();
  const roblox = catalog.find((item) => item.id === 'roblox');
  assert.ok(roblox);
  assert.equal(roblox.isInstalled, true);

  // Test uninstalling
  const uninst = appStoreService.uninstallApp('roblox');
  assert.equal(uninst.success, true);
  assert.equal(fs.existsSync(result.desktopFile), false);
  assert.equal(appStoreService.isAppInstalled('roblox'), false);
});
