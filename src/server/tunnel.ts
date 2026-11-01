import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
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

export class TunnelManager {
  private child: ChildProcess | null = null;
  private localPort = 3389;
  private publicHost = '';
  private publicDomain = '';
  private publicPort: number | null = null;
  private isVerified = false;
  private status: 'STARTING' | 'CONNECTED' | 'VERIFIED' | 'DISCONNECTED' | 'ERROR' = 'DISCONNECTED';
  private lastError?: string;
  private rdpVerification?: RdpHealthResult;
  private restartTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(localPort = 3389) {
    this.localPort = localPort;
  }

  public async start(): Promise<void> {
    if (this.child && !this.child.killed) {
      serverLogger.info('TunnelManager', `Tunnel is already active on port ${this.publicPort}`);
      return;
    }

    this.isShuttingDown = false;
    this.status = 'DISCONNECTED';
    serverLogger.info(
      'TunnelManager',
      `Checking external network ingress: Container is protected behind Google Cloud Run reverse proxy.`
    );

    // If bore binary is installed, try it; otherwise operate in direct Cloud Run mode
    try {
      const fs = await import('node:fs');
      let borePath = fs.existsSync('/usr/local/bin/bore')
        ? '/usr/local/bin/bore'
        : fs.existsSync('/usr/bin/bore')
        ? '/usr/bin/bore'
        : null;

      if (!borePath) {
        serverLogger.info('TunnelManager', 'External bore binary not found, downloading bore-cli...');
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
          serverLogger.warn('TunnelManager', `Bore download failed: ${downloadErr}`);
        }
      }

      if (!borePath) {
        this.status = 'DISCONNECTED';
        serverLogger.info(
          'TunnelManager',
          'No external tunnel binary configured. System is operating via Google Cloud Run web gateway.'
        );
        return;
      }

      this.status = 'STARTING';
      this.child = spawn(borePath, ['local', `${this.localPort}`, '--to', 'bore.pub'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.child.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        this.parseTunnelOutput(text);
      });

      this.child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        this.parseTunnelOutput(text);
      });

      this.child.on('error', (err) => {
        this.status = 'ERROR';
        this.lastError = err.message;
        serverLogger.warn('TunnelManager', `Tunnel broker notice: ${err.message}`);
      });

      this.child.on('exit', (code, signal) => {
        this.status = 'DISCONNECTED';
        this.publicPort = null;
        this.publicHost = '';
        this.child = null;
        if (!this.isShuttingDown) {
          this.restartTimeout = setTimeout(() => {
            this.start();
          }, 3000);
        }
      });
    } catch (err: unknown) {
      this.status = 'DISCONNECTED';
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
    }
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
          'TunnelManager',
          `Public TCP endpoint allocated: ${this.publicHost}:${this.publicPort} (${this.publicDomain}:${this.publicPort})`
        );

        // Immediately verify external connectivity through the tunnel
        this.verifyExternalEndpoint();
      }
    }
  }

  public async verifyExternalEndpoint(): Promise<boolean> {
    if (!this.publicPort) return false;

    serverLogger.info(
      'TunnelManager',
      `Verifying public internet connectivity through ${this.publicHost}:${this.publicPort}...`
    );

    // 1. Basic socket test
    const socketOk = await this.testSocket(this.publicHost, this.publicPort, 5000);
    if (!socketOk) {
      serverLogger.warn(
        'TunnelManager',
        `TCP probe to public endpoint ${this.publicHost}:${this.publicPort} failed or timed out.`
      );
      return false;
    }

    this.isVerified = true;
    this.status = 'VERIFIED';
    serverLogger.info(
      'TunnelManager',
      `External TCP endpoint VERIFIED and reachable: ${this.publicHost}:${this.publicPort}`
    );

    // 2. RDP Protocol handshake through the tunnel
    try {
      const result = await rdpHealthChecker.checkRdp(this.publicHost, this.publicPort, 4000);
      this.rdpVerification = result;
      if (result.connected) {
        this.isVerified = true;
        this.status = 'VERIFIED';
        serverLogger.info(
          'TunnelManager',
          `External RDP endpoint VERIFIED and accessible: ${this.publicHost}:${this.publicPort}`
        );
        return true;
      } else {
        serverLogger.warn(
          'TunnelManager',
          `Tunnel port reached but RDP handshake pending: ${result.statusMessage}`
        );
      }
    } catch (err) {
      serverLogger.error('TunnelManager', `RDP verification error: ${err}`);
    }

    return false;
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
    const endpoint = (port && this.publicHost)
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
      this.child.kill('SIGTERM');
      this.child = null;
    }
    this.status = 'DISCONNECTED';
  }
}

export const tunnelManager = new TunnelManager(3389);
