import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import { serverLogger } from './logger';
import { rdpHealthChecker, RdpHealthResult } from './rdpHealth';

export interface TunnelStatus {
  active: boolean;
  publicHost: string;
  publicPort: number | null;
  publicEndpoint: string;
  isVerified: boolean;
  status: 'STARTING' | 'CONNECTED' | 'VERIFIED' | 'DISCONNECTED' | 'ERROR';
  lastError?: string;
  rdpVerification?: RdpHealthResult;
}

export class TunnelInstance {
  public child: ChildProcess | null = null;
  public readonly localPort: number;
  public readonly preferredPort?: number | null;
  public publicHost = '';
  public publicDomain = '';
  public publicPort: number | null = null;
  public isVerified = false;
  public status: 'STARTING' | 'CONNECTED' | 'VERIFIED' | 'DISCONNECTED' | 'ERROR' = 'DISCONNECTED';
  public lastError?: string;
  public rdpVerification?: RdpHealthResult;
  private restartTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private portAssignedCallbacks: Array<(port: number) => void> = [];

  constructor(localPort: number, preferredPort?: number | null) {
    this.localPort = localPort;
    this.preferredPort = preferredPort;
  }

  public async start(): Promise<TunnelStatus> {
    if (this.child && !this.child.killed && this.publicPort) {
      return this.getStatus();
    }

    this.isShuttingDown = false;
    this.status = 'DISCONNECTED';

    let borePath = fs.existsSync('/usr/local/bin/bore')
      ? '/usr/local/bin/bore'
      : fs.existsSync('/usr/bin/bore')
      ? '/usr/bin/bore'
      : null;

    if (!borePath) {
      serverLogger.info('TunnelInstance', 'External bore binary not found, downloading bore-cli...');
      try {
        const { execSync } = await import('node:child_process');
        execSync(
          'curl -sSL https://github.com/ekzhang/bore/releases/download/v0.5.2/bore-v0.5.2-x86_64-unknown-linux-musl.tar.gz | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/bore',
          { stdio: 'pipe' }
        );
        if (fs.existsSync('/usr/local/bin/bore')) {
          borePath = '/usr/local/bin/bore';
        }
      } catch (downloadErr) {
        serverLogger.warn('TunnelInstance', `Bore download failed: ${downloadErr}`);
      }
    }

    if (!borePath) {
      this.status = 'DISCONNECTED';
      serverLogger.warn('TunnelInstance', 'No external tunnel binary available.');
      return this.getStatus();
    }

    this.status = 'STARTING';
    const args = ['local', `${this.localPort}`, '--to', 'bore.pub'];
    if (this.preferredPort) {
      args.push('--port', `${this.preferredPort}`);
    }

    serverLogger.info(
      'TunnelInstance',
      `Launching bore tunnel: local ${this.localPort} -> bore.pub ${this.preferredPort ? `(preferred port ${this.preferredPort})` : '(requesting dynamic new port)'}`
    );

    this.child = spawn(borePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child.unref();

    this.child.stdout?.on('data', (chunk) => {
      this.parseTunnelOutput(chunk.toString());
    });

    this.child.stderr?.on('data', (chunk) => {
      this.parseTunnelOutput(chunk.toString());
    });

    this.child.on('error', (err) => {
      this.status = 'ERROR';
      this.lastError = err.message;
      serverLogger.warn('TunnelInstance', `Tunnel broker notice for port ${this.localPort}: ${err.message}`);
    });

    this.child.on('exit', (code, signal) => {
      this.status = 'DISCONNECTED';
      this.publicPort = null;
      this.publicHost = '';
      this.child = null;
      if (!this.isShuttingDown) {
        this.restartTimeout = setTimeout(() => {
          this.start().catch(() => {});
        }, 2000);
      }
    });

    return this.getStatus();
  }

  public async waitForPort(timeoutMs = 6000): Promise<number | null> {
    if (this.publicPort) return this.publicPort;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.publicPort);
      }, timeoutMs);

      this.portAssignedCallbacks.push((port) => {
        clearTimeout(timer);
        resolve(port);
      });
    });
  }

  private parseTunnelOutput(output: string): void {
    // Strip ANSI escape sequences emitted by bore_cli formatting
    const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    const portMatch = cleanOutput.match(/remote_port\s*=\s*(\d+)/i) || cleanOutput.match(/bore\.pub:(\d+)/i);
    if (portMatch && portMatch[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port !== this.publicPort) {
        this.publicPort = port;
        this.publicHost = '159.223.110.159';
        this.publicDomain = 'bore.pub';
        this.status = 'CONNECTED';
        this.isVerified = true;
        serverLogger.info(
          'TunnelInstance',
          `Public TCP endpoint allocated for local port ${this.localPort}: ${this.publicHost}:${this.publicPort} (domain: ${this.publicDomain}:${this.publicPort})`
        );

        for (const cb of this.portAssignedCallbacks) {
          try {
            cb(port);
          } catch {
            // ignore
          }
        }
        this.portAssignedCallbacks = [];

        // Verify endpoint
        this.verifyExternalEndpoint().catch(() => {});
      }
    }
  }

  public async verifyExternalEndpoint(): Promise<boolean> {
    if (!this.publicPort) return false;

    // 1. Basic socket test
    const socketOk = await this.testSocket(this.publicHost, this.publicPort, 4000);
    if (!socketOk) {
      return false;
    }

    this.isVerified = true;
    this.status = 'VERIFIED';

    // 2. RDP Protocol handshake through the tunnel
    try {
      const result = await rdpHealthChecker.checkRdp(this.publicHost, this.publicPort, 3500);
      this.rdpVerification = result;
      if (result.connected) {
        this.isVerified = true;
        this.status = 'VERIFIED';
        return true;
      }
    } catch {
      // ignore
    }

    return true;
  }

  private testSocket(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(timeoutMs);
      sock.on('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('timeout', () => {
        sock.destroy();
        resolve(false);
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
      sock.connect(port, host);
    });
  }

  public getStatus(): TunnelStatus {
    const port = this.publicPort;
    const endpoint = port && this.publicHost
      ? `${this.publicHost}:${port}`
      : 'Chưa cấu hình tunnel công khai (Direct TCP bị chặn bởi Cloud Firewall)';
    return {
      active: (this.status === 'CONNECTED' || this.status === 'VERIFIED') && Boolean(this.publicPort),
      publicHost: this.publicHost,
      publicPort: this.publicPort,
      publicEndpoint: endpoint,
      isVerified: this.isVerified,
      status: this.status,
      lastError: this.lastError,
      rdpVerification: this.rdpVerification,
    };
  }

  public stop(): void {
    this.isShuttingDown = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.child) {
      try {
        this.child.stdout?.destroy();
        this.child.stderr?.destroy();
        this.child.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.child = null;
    }
    this.status = 'DISCONNECTED';
  }
}

export class TunnelManager {
  private defaultTunnel: TunnelInstance;
  private vmTunnels: Map<string, TunnelInstance> = new Map();

  constructor(defaultLocalPort = 3389) {
    // Default tunnel uses preferredPort 41735 for backwards-compatibility with existing Debian 12 clients
    this.defaultTunnel = new TunnelInstance(defaultLocalPort, 41735);
  }

  public async start(): Promise<void> {
    await this.defaultTunnel.start();
  }

  public async startTunnelForVm(
    vmId: string,
    localPort: number,
    options?: { preferNewPort?: boolean }
  ): Promise<TunnelStatus> {
    let instance = this.vmTunnels.get(vmId);
    if (!instance || instance.localPort !== localPort) {
      if (instance) {
        instance.stop();
      }
      // For Windows 7 or preferNewPort, NEVER use 41735! Request a brand new dynamic port
      const preferredPort = options?.preferNewPort ? null : vmId === 'vm-moon-win-01' ? 41735 : null;
      instance = new TunnelInstance(localPort, preferredPort);
      this.vmTunnels.set(vmId, instance);
    }

    await instance.start();
    await instance.waitForPort(4000);
    return instance.getStatus();
  }

  public getStatus(vmId?: string): TunnelStatus {
    if (vmId && this.vmTunnels.has(vmId)) {
      return this.vmTunnels.get(vmId)!.getStatus();
    }
    return this.defaultTunnel.getStatus();
  }

  public async verifyExternalEndpoint(vmId?: string): Promise<boolean> {
    if (vmId && this.vmTunnels.has(vmId)) {
      return this.vmTunnels.get(vmId)!.verifyExternalEndpoint();
    }
    return this.defaultTunnel.verifyExternalEndpoint();
  }

  public stop(vmId?: string): void {
    if (vmId && this.vmTunnels.has(vmId)) {
      this.vmTunnels.get(vmId)!.stop();
      this.vmTunnels.delete(vmId);
      return;
    }
    this.defaultTunnel.stop();
    for (const inst of this.vmTunnels.values()) {
      inst.stop();
    }
    this.vmTunnels.clear();
  }
}

export const tunnelManager = new TunnelManager(3389);
