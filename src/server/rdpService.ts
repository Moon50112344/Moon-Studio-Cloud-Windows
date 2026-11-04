import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { serverLogger } from './logger';
import { rdpHealthChecker, RdpHealthResult } from './rdpHealth';
import { vncBridgeManager } from './vncBridge';

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
    if (!fs.existsSync('/usr/sbin/xrdp') || !fs.existsSync('/usr/bin/startxfce4') || !fs.existsSync('/usr/bin/dbus-daemon')) {
      serverLogger.info('RDPService', 'xrdp or desktop packages missing. Auto-installing in background...');
      try {
        execSync(
          'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" --no-install-recommends xrdp xorgxrdp xfce4-session xfwm4 xfce4-panel xfdesktop4 thunar firefox-esr dbus dbus-x11 ssl-cert xfce4-terminal desktop-base genisoimage nasm',
          { stdio: 'pipe' }
        );
        serverLogger.info('RDPService', 'xrdp, D-Bus and XFCE4 packages installed successfully.');
      } catch (installErr) {
        serverLogger.warn('RDPService', `Auto-install notice: ${installErr}`);
      }
    }

    // Ensure ssl certificate exists and xrdp has read permissions
    try {
      execSync('make-ssl-cert generate-default-snakeoil --force-overwrite || true', { stdio: 'ignore' });
      execSync('adduser xrdp ssl-cert || true', { stdio: 'ignore' });
      if (fs.existsSync('/etc/ssl/private/ssl-cert-snakeoil.key')) {
        execSync('chmod 644 /etc/ssl/private/ssl-cert-snakeoil.key', { stdio: 'ignore' });
      }
    } catch {
      // ignore
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

    // 2.5 Ensure system D-Bus daemon is running (critical for desktop session not crashing)
    try {
      execSync('pgrep -x dbus-daemon', { stdio: 'ignore' });
    } catch {
      try {
        if (!fs.existsSync('/run/dbus')) {
          fs.mkdirSync('/run/dbus', { recursive: true });
        }
        execSync('dbus-daemon --system --fork', { stdio: 'ignore' });
        serverLogger.info('RDPService', 'D-Bus system daemon started successfully.');
      } catch (dbusErr) {
        serverLogger.warn('RDPService', `D-Bus daemon start note: ${dbusErr}`);
      }
    }

    // 3. Configure user X session to launch XFCE4 desktop with D-Bus (prevents cyan blank screen crash)
    try {
      const userHome = `/home/${username}`;
      if (!fs.existsSync(userHome)) {
        fs.mkdirSync(userHome, { recursive: true });
      }
      const xsessionContent = [
        '#!/bin/sh',
        'unset DBUS_SESSION_BUS_ADDRESS',
        'unset XDG_RUNTIME_DIR',
        'export XDG_SESSION_TYPE=x11',
        'export XDG_CURRENT_DESKTOP=XFCE',
        'export DESKTOP_SESSION=xfce',
        'exec dbus-launch --exit-with-session startxfce4',
        '',
      ].join('\n');
      fs.writeFileSync(`${userHome}/.xsession`, xsessionContent, { encoding: 'utf8', mode: 0o755 });
      try {
        execSync(`chown -R "${username}:${username}" "${userHome}"`, { stdio: 'ignore' });
      } catch {
        // ignore
      }

      const startwmContent = [
        '#!/bin/sh',
        'if test -r /etc/profile; then . /etc/profile; fi',
        'if test -r ~/.profile; then . ~/.profile; fi',
        'unset DBUS_SESSION_BUS_ADDRESS',
        'unset XDG_RUNTIME_DIR',
        'export XDG_SESSION_TYPE=x11',
        'export XDG_CURRENT_DESKTOP=XFCE',
        'export DESKTOP_SESSION=xfce',
        'if [ -r ~/.xsession ]; then exec ~/.xsession; fi',
        'exec dbus-launch --exit-with-session startxfce4',
        '',
      ].join('\n');
      fs.writeFileSync('/etc/xrdp/startwm.sh', startwmContent, { encoding: 'utf8', mode: 0o755 });
    } catch (sessionErr) {
      serverLogger.warn('RDPService', `Session script configuration notice: ${sessionErr}`);
    }

    // 4. Ensure xrdp configuration is tuned for standard RDP clients
    try {
      try {
        execSync('adduser xrdp ssl-cert || true', { stdio: 'ignore' });
        if (fs.existsSync('/etc/ssl/private/ssl-cert-snakeoil.key')) {
          execSync('chmod 644 /etc/ssl/private/ssl-cert-snakeoil.key', { stdio: 'ignore' });
        }
      } catch {
        // ignore
      }

      const xrdpIniPath = '/etc/xrdp/xrdp.ini';
      if (fs.existsSync(xrdpIniPath)) {
        let content = fs.readFileSync(xrdpIniPath, 'utf8');
        content = content.replace(/^port=.*/m, 'port=3389');
        if (!content.includes('[Windows7]')) {
          const win7Section = [
            '[Windows7]',
            'name=Windows 7 QEMU Display',
            'lib=libvnc.so',
            'ip=127.0.0.1',
            'port=5991',
            'username=na',
            'password=',
            '',
            '',
          ].join('\n');
          content = content.replace('[Xorg]', win7Section + '[Xorg]');
        }
        fs.writeFileSync(xrdpIniPath, content, 'utf8');
      }
      try {
        await vncBridgeManager.ensureBridge(5991);
      } catch {
        // ignore
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
        if (!fs.existsSync('/var/run/xrdp')) {
          fs.mkdirSync('/var/run/xrdp', { recursive: true });
        }
        // Remove stale pid file if process wasn't actually running
        if (fs.existsSync('/var/run/xrdp/xrdp-sesman.pid')) {
          fs.unlinkSync('/var/run/xrdp/xrdp-sesman.pid');
        }
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
        if (fs.existsSync('/var/run/xrdp/xrdp.pid')) {
          fs.unlinkSync('/var/run/xrdp/xrdp.pid');
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
