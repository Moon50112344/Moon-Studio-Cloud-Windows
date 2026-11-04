import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { vncBridgeManager } from './vncBridge';

test('VncBridgeManager proxies IPv6 [::1] connections to IPv4 127.0.0.1 transparently', async () => {
  const testPort = 5998;

  // 1. Start a dummy target on 127.0.0.1:5998
  const targetServer = net.createServer((sock) => {
    sock.write('RFB 003.008\n');
    sock.on('data', (d) => {
      if (d.toString().startsWith('RFB 003.003')) {
        sock.write(Buffer.from([0, 0, 0, 1])); // Security None
      }
    });
  });

  await new Promise<void>((resolve) => {
    targetServer.listen(testPort, '127.0.0.1', () => resolve());
  });

  try {
    // 2. Start bridge on [::1]:5998
    const started = await vncBridgeManager.ensureBridge(testPort);
    assert.equal(started, true, 'Bridge should start successfully');

    // 3. Connect via IPv6 [::1]:5998
    const client = net.createConnection({
      host: '::1',
      port: testPort,
    });

    let receivedGreeting = false;
    let receivedSecType = false;

    await new Promise<void>((resolve, reject) => {
      client.setTimeout(3000, () => reject(new Error('Test client timed out')));
      client.on('error', reject);

      client.on('data', (data) => {
        const str = data.toString('ascii');
        if (str.startsWith('RFB 003.008')) {
          receivedGreeting = true;
          client.write('RFB 003.003\n');
        } else if (data.length === 4 && data.readUInt32BE(0) === 1) {
          receivedSecType = true;
          client.end();
          resolve();
        }
      });
    });

    assert.equal(receivedGreeting, true, 'Must receive RFB greeting via bridge');
    assert.equal(receivedSecType, true, 'Must receive Security None (1) via bridge');
  } finally {
    vncBridgeManager.closeBridge(testPort);
    await new Promise<void>((resolve) => targetServer.close(() => resolve()));
  }
});
