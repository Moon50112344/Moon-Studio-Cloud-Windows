import net from 'node:net';
import { execSync } from 'node:child_process';
import { serverLogger } from './logger';

export interface VmNetworkConfig {
  vmId: string;
  hostPort: number;
  guestPort: number;
  ipAddress: string;
  publicEndpoint: string;
  isExternalDirect: boolean;
}

export class NetworkManager {
  private allocatedPorts: Set<number> = new Set([3389]);
  private basePort = 3390;
  private cachedRealPublicIp: string | null = null;
  private lastIpFetchTime = 0;

  public allocatePort(vmId: string): number {
    for (let p = this.basePort; p < this.basePort + 100; p++) {
      if (!this.allocatedPorts.has(p)) {
        this.allocatedPorts.add(p);
        serverLogger.info(
          'NetworkManager',
          `Allocated local forwarding port ${p} -> guest:3389 for VM ${vmId}`,
          vmId
        );
        return p;
      }
    }
    throw new Error('No available port in forwarding pool.');
  }

  public releasePort(port: number, vmId?: string): void {
    if (this.allocatedPorts.has(port)) {
      this.allocatedPorts.delete(port);
      serverLogger.info('NetworkManager', `Released local forwarding port ${port}`, vmId);
    }
  }

  public async getRealPublicIp(): Promise<string> {
    const now = Date.now();
    // Cache for 60 seconds
    if (this.cachedRealPublicIp && now - this.lastIpFetchTime < 60000) {
      return this.cachedRealPublicIp;
    }

    try {
      // Query verified public IP services
      const curlOut = execSync(
        'curl -s4 --connect-timeout 2 https://api.ipify.org || curl -s4 --connect-timeout 2 https://ifconfig.me || curl -s4 --connect-timeout 2 https://icanhazip.com',
        { encoding: 'utf8', timeout: 3500 }
      ).trim();

      if (curlOut && /^[0-9.]+$/.test(curlOut) && !curlOut.startsWith('169.254.') && !curlOut.startsWith('127.')) {
        this.cachedRealPublicIp = curlOut;
        this.lastIpFetchTime = now;
        serverLogger.info('NetworkManager', `Detected verified real public egress IPv4: ${curlOut}`);
        return curlOut;
      }
    } catch {
      // fallback
    }

    return this.cachedRealPublicIp || '34.34.244.22';
  }

  public async checkPortOpen(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let status = false;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        status = true;
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });

      try {
        socket.connect(port, host);
      } catch {
        resolve(false);
      }
    });
  }

  public formatConnectionAddress(ip: string, port: number): string {
    const cleanIp = ip.trim();
    if (port === 3389) {
      return cleanIp;
    }
    return `${cleanIp}:${port}`;
  }
}

export const networkManager = new NetworkManager();

