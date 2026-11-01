import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { serverLogger } from './logger';
import { rdpHealthChecker, RdpHealthResult } from './rdpHealth';

export class RdpServiceManager {
  private isRunning = false;
  private currentUsername = 'Administrator';
  private currentPassword = '';

  /**
   * Initializes and starts the real RDP server listening on port 3389
   */
  public async ensureRdpServerRunning(username: string, password: string): Promise<boolean> {
    this.currentUsername = username;
    this.currentPassword = password;

    serverLogger.info('RDPService', `Configuring Remote Desktop Services for user ${username}...`);

    // 0. Ensure xrdp and desktop packages are installed
    if (!fs.existsSync('/usr/sbin/xrdp') || !fs.existsSync('/usr/bin/startxfce4')) {
      serverLogger.info('RDPService', 'xrdp or desktop packages missing. Auto-installing in background...');
      try {
        execSync(
          'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" --no-install-recommends xrdp xorgxrdp xfce4-session xfce4-panel xfdesktop4 dbus-x11',
          { stdio: 'pipe' }
        );
        serverLogger.info('RDPService', 'xrdp and XFCE4 packages installed successfully.');
      } catch (installErr) {
        serverLogger.warn('RDPService', `Auto-install notice: ${installErr}`);
      }
    }

    // 1. Ensure user exists on OS
    try {
      execSync(`id "${username}"`, { stdio: 'ignore' });
    } catch {
      serverLogger.info('RDPService', `Creating user account ${username}...`);
      try {
        execSync(`useradd -m -s /bin/bash "${username}"`, { stdio: 'pipe' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        serverLogger.warn('RDPService', `User creation notice: ${msg}`);
      }
    }

    // 2. Set password securely via chpasswd stdin without logging
    try {
      const proc = spawn('chpasswd');
      proc.stdin.write(`${username}:${password}\n`);
      proc.stdin.end();
      await new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`chpasswd exited with code ${code}`));
        });
        proc.on('error', reject);
      });
      serverLogger.info('RDPService', `Credentials synchronized for account ${username}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      serverLogger.error('RDPService', `Failed to synchronize password: ${msg}`);
    }

    // 3. Configure user X session to launch XFCE4 desktop (avoids cyan blank screen)
    try {
      const userHome = `/home/${username}`;
      if (!fs.existsSync(userHome)) {
        fs.mkdirSync(userHome, { recursive: true });
      }
      fs.writeFileSync(`${userHome}/.xsession`, 'startxfce4\n', 'utf8');
      try {
        execSync(`chown -R "${username}:${username}" "${userHome}"`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
      if (fs.existsSync('/etc/xrdp/startwm.sh')) {
        let startwm = fs.readFileSync('/etc/xrdp/startwm.sh', 'utf8');
        if (!startwm.includes('startxfce4')) {
          startwm = startwm.replace(/^test -x \/etc\/X11\/Xsession && exec \/etc\/X11\/Xsession/m, 'startxfce4\n# &');
          fs.writeFileSync('/etc/xrdp/startwm.sh', startwm, 'utf8');
        }
      }
    } catch (sessionErr) {
      serverLogger.warn('RDPService', `Session script configuration notice: ${sessionErr}`);
    }

    // 4. Ensure xrdp configuration is tuned for standard RDP clients
    try {
      const xrdpIniPath = '/etc/xrdp/xrdp.ini';
      if (fs.existsSync(xrdpIniPath)) {
        let content = fs.readFileSync(xrdpIniPath, 'utf8');
        content = content.replace(/^port=.*/m, 'port=3389');
        content = content.replace(/^crypt_level=.*/m, 'crypt_level=high');
        fs.writeFileSync(xrdpIniPath, content, 'utf8');
      }
    } catch {
      // ignore
    }

    // 5. Start xrdp-sesman if not running
    try {
      execSync('pgrep -x xrdp-sesman', { stdio: 'ignore' });
    } catch {
      serverLogger.info('RDPService', 'Starting xrdp session manager daemon...');
      try {
        execSync('/usr/sbin/xrdp-sesman', { stdio: 'ignore' });
      } catch (err) {
        serverLogger.warn('RDPService', `xrdp-sesman start: ${err}`);
      }
    }

    // 6. Start xrdp if not running
    try {
      execSync('pgrep -x xrdp', { stdio: 'ignore' });
      this.isRunning = true;
    } catch {
      serverLogger.info('RDPService', 'Starting xrdp server on port 3389...');
      try {
        if (!fs.existsSync('/var/run/xrdp')) {
          fs.mkdirSync('/var/run/xrdp', { recursive: true });
        }
        execSync('/usr/sbin/xrdp', { stdio: 'pipe' });
        this.isRunning = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        serverLogger.warn('RDPService', `xrdp service note: ${msg}`);
      }
    }

    // 6. Test RDP port and protocol
    const check = await this.verifyRdpLocal();
    return check.connected;
  }

  public async verifyRdpLocal(): Promise<RdpHealthResult> {
    return rdpHealthChecker.checkRdp('127.0.0.1', 3389, 3000);
  }

  public async verifyAuthentication(): Promise<{ success: boolean; message: string }> {
    serverLogger.info('RDPService', `Verifying RDP authentication for ${this.currentUsername}...`);
    try {
      const cmd = `xvfb-run xfreerdp /v:127.0.0.1:3389 /u:"${this.currentUsername}" /p:"${this.currentPassword}" +auth-only /cert:ignore`;
      execSync(cmd, { stdio: 'pipe', timeout: 8000 });
      serverLogger.info('RDPService', `RDP authentication PASSED for user ${this.currentUsername}`);
      return { success: true, message: 'Authentication successful' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      serverLogger.warn('RDPService', `RDP authentication test returned non-zero: ${msg}`);
      return { success: false, message: msg };
    }
  }
}

export const rdpServiceManager = new RdpServiceManager();
