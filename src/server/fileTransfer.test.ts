import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileTransferService } from './fileTransfer';

test('FileTransferService resolves target directory safely', () => {
  const desktop = fileTransferService.resolveTargetDir('/home/Administrator/Desktop');
  assert.equal(desktop, '/home/Administrator/Desktop');

  // Directory traversal should be rejected and fall back to default Desktop
  const traversal = fileTransferService.resolveTargetDir('/home/Administrator/Desktop/../../etc');
  assert.equal(traversal, '/home/Administrator/Desktop');
});

test('FileTransferService handles Mode 1 (folder upload)', async () => {
  const tempFile = '/tmp/test-upload-mode1.txt';
  fs.writeFileSync(tempFile, 'Hello VPS Cloud Windows Test');

  const result = await fileTransferService.handleUploadedFile({
    tempFilePath: tempFile,
    originalFileName: 'test-doc.txt',
    targetDir: '/home/Administrator/Desktop',
    mode: 'folder',
  });

  assert.equal(result.fileName, 'test-doc.txt');
  assert.ok(fs.existsSync(result.filePath));
  assert.equal(result.autoExecuted, undefined);

  // Verify listFiles finds it
  const listing = fileTransferService.listFiles('/home/Administrator/Desktop');
  const found = listing.files.find((f) => f.name === 'test-doc.txt');
  assert.ok(found);
  assert.equal(found.isExecutable, false);

  // Cleanup
  fileTransferService.deleteFile(result.filePath);
  assert.ok(!fs.existsSync(result.filePath));
});

test('FileTransferService handles Mode 2 (auto-execute script)', async () => {
  const tempScript = '/tmp/test-script.sh';
  fs.writeFileSync(tempScript, '#!/bin/sh\necho "Execution Test Passed" > /tmp/test-exec-output.txt\n');

  const result = await fileTransferService.handleUploadedFile({
    tempFilePath: tempScript,
    originalFileName: 'test-installer.sh',
    mode: 'install',
  });

  assert.equal(result.fileName, 'test-installer.sh');
  assert.equal(result.autoExecuted, true);
  assert.ok(result.executionResult);
  assert.equal(result.executionResult.success, true);

  // Cleanup
  fileTransferService.deleteFile(result.filePath);
  if (fs.existsSync('/tmp/test-exec-output.txt')) {
    fs.unlinkSync('/tmp/test-exec-output.txt');
  }
});
