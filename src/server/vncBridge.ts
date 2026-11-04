import net from 'node:net';
import { serverLogger } from './logger';

export class VncBridgeManager {
  private activeServers: Map<number, net.Server> = new Map();

  /**
   * Ensures an IPv6 [::1] loopback proxy is running for the given VNC port,
   * forwarding transparently to IPv4 127.0.0.1.
   * This is required because xrdp's libvnc.so creates AF_INET6 sockets and connects
   * to [::1] loopback even when 127.0.0.1 is configured in xrdp.ini.
   */
  public async ensureBridge(vncPort: number): Promise<boolean> {
    if (this.activeServers.has(vncPort)) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const server = net.createServer((clientSocket) => {
        const targetSocket = net.createConnection(
          {
            host: '127.0.0.1',
            port: vncPort,
          },
          () => {
            clientSocket.unref();
            targetSocket.unref();
            clientSocket.pipe(targetSocket);
            targetSocket.pipe(clientSocket);
          }
        );

        targetSocket.on('error', (err) => {
          serverLogger.debug('VncBridge', `Target 127.0.0.1:${vncPort} connection notice: ${err.message}`);
          clientSocket.destroy();
        });

        clientSocket.on('error', (err) => {
          serverLogger.debug('VncBridge', `Client [::1]:${vncPort} connection notice: ${err.message}`);
          targetSocket.destroy();
        });

        clientSocket.on('close', () => {
          targetSocket.destroy();
        });

        targetSocket.on('close', () => {
          clientSocket.destroy();
        });
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          serverLogger.info(
            'VncBridge',
            `Port ${vncPort} is already bound on [::1] (handled natively by QEMU dual-stack).`
          );
          resolve(true);
        } else {
          serverLogger.warn('VncBridge', `Failed to start IPv6 bridge on [::1]:${vncPort}: ${err.message}`);
          resolve(false);
        }
      });

      server.listen(vncPort, '::1', () => {
        server.unref();
        this.activeServers.set(vncPort, server);
        serverLogger.info(
          'VncBridge',
          `Active dual-stack bridge established: [::1]:${vncPort} <-> 127.0.0.1:${vncPort} (XRDP QEMU Display Proxy)`
        );
        resolve(true);
      });
    });
  }

  public isBridgeRunning(vncPort: number): boolean {
    return this.activeServers.has(vncPort);
  }

  public closeBridge(vncPort: number): void {
    const server = this.activeServers.get(vncPort);
    if (server) {
      server.close();
      this.activeServers.delete(vncPort);
      serverLogger.info('VncBridge', `Closed bridge for port ${vncPort}`);
    }
  }

  public closeAll(): void {
    for (const [port, server] of this.activeServers.entries()) {
      server.close();
      serverLogger.info('VncBridge', `Closed bridge on port ${port}`);
    }
    this.activeServers.clear();
  }
}

export const vncBridgeManager = new VncBridgeManager();
