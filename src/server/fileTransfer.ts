import fs from 'node:fs';
import path from 'node:path';
import { exec, execSync } from 'node:child_process';
import { serverLogger } from './logger';

export interface UploadedFileInfo {
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  fileSizeFormatted: string;
  targetDir: string;
  uploadedAt: string;
  isExecutable: boolean;
  fileType: string;
  autoExecuted?: boolean;
  executionResult?: {
    success: boolean;
    output: string;
    pid?: number;
    command?: string;
  };
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  isDirectory: boolean;
  modifiedAt: string;
  extension: string;
  isExecutable: boolean;
}

export class FileTransferService {
  private allowedBaseDirs = [
    '/home/Administrator',
    '/home/Administrator/Desktop',
    '/home/Administrator/Downloads',
    '/home/Administrator/Documents',
    '/tmp',
  ];

  constructor() {
    this.ensureDefaultDirs();
  }

  public ensureDefaultDirs(): void {
    for (const dir of this.allowedBaseDirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          execSync(`chown -R Administrator:Administrator "${dir}" 2>/dev/null || true`);
        } catch {
          // ignore
        }
      }
    }
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Discovers the current active XRDP X11 DISPLAY (e.g. :10.0)
   */
  public detectActiveDisplay(): string {
    try {
      const output = execSync(
        `ps aux | grep -E "Xorg|Xvnc|xrdp" | grep -oE ":[0-9]+(\.[0-9]+)?" | head -n 1`,
        { encoding: 'utf8' }
      ).trim();
      if (output) return output;
    } catch {
      // ignore
    }
    return ':10.0';
  }

  /**
   * Sanitizes and verifies target directory path
   */
  public resolveTargetDir(requestedDir?: string): string {
    const defaultDir = '/home/Administrator/Desktop';
    if (!requestedDir || typeof requestedDir !== 'string') {
      return defaultDir;
    }

    if (requestedDir.includes('..') || requestedDir.startsWith('/proc') || requestedDir.startsWith('/sys')) {
      return defaultDir;
    }

    const clean = path.normalize(requestedDir.trim());
    if (clean.startsWith('/proc') || clean.startsWith('/sys')) {
      return defaultDir;
    }

    if (!fs.existsSync(clean)) {
      try {
        fs.mkdirSync(clean, { recursive: true });
        execSync(`chown -R Administrator:Administrator "${clean}" 2>/dev/null || true`);
      } catch {
        return defaultDir;
      }
    }

    return clean;
  }

  /**
   * Handles saving uploaded file and optional auto-execution
   */
  public async handleUploadedFile(options: {
    tempFilePath: string;
    originalFileName: string;
    targetDir?: string;
    mode: 'folder' | 'install';
  }): Promise<UploadedFileInfo> {
    const { tempFilePath, originalFileName, mode } = options;
    const ext = path.extname(originalFileName).toLowerCase();

    // Mode 'install' prefers Downloads folder or Desktop
    const targetDir = mode === 'install'
      ? '/home/Administrator/Downloads'
      : this.resolveTargetDir(options.targetDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destFilePath = path.join(targetDir, originalFileName);
    fs.copyFileSync(tempFilePath, destFilePath);
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // ignore
    }

    // Set ownership and permissions
    try {
      execSync(`chmod 755 "${destFilePath}"`);
      execSync(`chown Administrator:Administrator "${destFilePath}"`);
    } catch {
      // ignore
    }

    const stat = fs.statSync(destFilePath);
    const isExe = ['.exe', '.msi', '.deb', '.sh', '.run', '.bin', '.py'].includes(ext);

    const result: UploadedFileInfo = {
      fileName: originalFileName,
      originalName: originalFileName,
      filePath: destFilePath,
      fileSize: stat.size,
      fileSizeFormatted: this.formatBytes(stat.size),
      targetDir,
      uploadedAt: new Date().toISOString(),
      isExecutable: isExe,
      fileType: ext.replace('.', '').toUpperCase() || 'FILE',
    };

    serverLogger.info(
      'FileTransfer',
      `File uploaded successfully: ${originalFileName} (${result.fileSizeFormatted}) -> ${destFilePath}`
    );

    // If Mode 2 (auto-install / execute) is selected:
    if (mode === 'install') {
      result.autoExecuted = true;
      result.executionResult = await this.executeFile(destFilePath);
    }

    return result;
  }

  /**
   * Executes or installs an executable file (.exe via Wine, .deb via apt, .sh via bash)
   */
  public async executeFile(filePath: string): Promise<{
    success: boolean;
    output: string;
    pid?: number;
    command?: string;
  }> {
    if (!fs.existsSync(filePath)) {
      return { success: false, output: `File not found: ${filePath}` };
    }

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const display = this.detectActiveDisplay();

    serverLogger.info('FileTransfer', `Initiating execution for ${filePath} (Type: ${ext}, DISPLAY: ${display})`);

    // 1. Windows Executable (.exe / .msi) -> Run with Wine inside X11 session
    if (ext === '.exe' || ext === '.msi') {
      const desktopShortcutPath = `/home/Administrator/Desktop/${path.parse(fileName).name}.desktop`;
      try {
        const desktopEntry = [
          '[Desktop Entry]',
          'Version=1.0',
          'Type=Application',
          `Name=${path.parse(fileName).name}`,
          `Comment=Windows Application launched via Wine`,
          `Exec=wine "${filePath}"`,
          'Icon=wine',
          'Terminal=false',
          'StartupNotify=true',
          '',
        ].join('\n');
        fs.writeFileSync(desktopShortcutPath, desktopEntry, { encoding: 'utf8', mode: 0o755 });
        execSync(`chown Administrator:Administrator "${desktopShortcutPath}" 2>/dev/null || true`);
      } catch (err) {
        serverLogger.warn('FileTransfer', `Could not create desktop shortcut: ${err}`);
      }

      const isMsi = ext === '.msi';
      const wineCmd = isMsi ? `wine msiexec /i "${filePath}"` : `wine "${filePath}"`;
      const fullCmd = `DISPLAY=${display} su - Administrator -c "${wineCmd}"`;

      return new Promise((resolve) => {
        const child = exec(fullCmd, { timeout: 15000 }, (error, stdout, stderr) => {
          const out = (stdout || '') + (stderr ? `\nErrors: ${stderr}` : '');
          if (error && error.killed) {
            // Started successfully in background
            resolve({
              success: true,
              output: `Ứng dụng Windows ${fileName} đã được khởi chạy thành công qua Wine trong giao diện Desktop!\n(Đã tạo biểu tượng truy cập nhanh trên Desktop).`,
              pid: child.pid,
              command: wineCmd,
            });
          } else if (error) {
            resolve({
              success: false,
              output: `Wine output:\n${out || error.message}`,
              pid: child.pid,
              command: wineCmd,
            });
          } else {
            resolve({
              success: true,
              output: out || `Ứng dụng ${fileName} đã được thực thi thành công! Đã tạo shortcut trên Desktop.`,
              pid: child.pid,
              command: wineCmd,
            });
          }
        });

        // Give it 2.5 seconds to launch without blocking
        setTimeout(() => {
          resolve({
            success: true,
            output: `Đã kích hoạt trình cài đặt ${fileName} trên giao diện Desktop (Wine)! Bạn có thể chuyển sang màn hình Remote Desktop để theo dõi cửa sổ cài đặt.`,
            pid: child.pid,
            command: wineCmd,
          });
        }, 2500);
      });
    }

    // 2. Debian Package (.deb) -> Install via apt-get
    if (ext === '.deb') {
      try {
        const cmd = `DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${filePath}"`;
        const stdout = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
        return {
          success: true,
          output: `Gói phần mềm ${fileName} đã được cài đặt thành công vào hệ thống!\n\n${stdout.slice(-500)}`,
          command: cmd,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          output: `Lỗi cài đặt .deb: ${msg}`,
        };
      }
    }

    // 3. Linux Shell Script (.sh / .run)
    if (ext === '.sh' || ext === '.run' || ext === '.bin') {
      try {
        execSync(`chmod +x "${filePath}"`);
        const cmd = `DISPLAY=${display} su - Administrator -c "bash '${filePath}'" &`;
        exec(cmd);
        return {
          success: true,
          output: `Tập lệnh ${fileName} đã được cấp quyền thực thi (chmod +x) và đang chạy trên Desktop!`,
          command: cmd,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          output: `Lỗi chạy script: ${msg}`,
        };
      }
    }

    // Default: Not an automatically recognized executable
    return {
      success: true,
      output: `Tệp tin ${fileName} đã được lưu thành công vào ${filePath}. (Loại tệp ${ext} không yêu cầu thực thi tự động).`,
    };
  }

  /**
   * Lists files in a given directory
   */
  public listFiles(targetDir?: string): { dir: string; files: FileItem[] } {
    const dir = this.resolveTargetDir(targetDir);
    const files: FileItem[] = [];

    try {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          try {
            const fullPath = path.join(dir, entry.name);
            const stat = fs.statSync(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            const isExe = ['.exe', '.msi', '.deb', '.sh', '.run', '.bin'].includes(ext);

            files.push({
              name: entry.name,
              path: fullPath,
              size: stat.size,
              sizeFormatted: entry.isDirectory() ? '--' : this.formatBytes(stat.size),
              isDirectory: entry.isDirectory(),
              modifiedAt: stat.mtime.toISOString(),
              extension: ext.replace('.', ''),
              isExecutable: isExe,
            });
          } catch {
            // skip unreadable
          }
        }
      }
    } catch (err) {
      serverLogger.warn('FileTransfer', `Could not list directory ${dir}: ${err}`);
    }

    return { dir, files };
  }

  /**
   * Deletes a file in an allowed directory
   */
  public deleteFile(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    // Safety check: must be inside /home/Administrator or /tmp
    if (!normalized.startsWith('/home/Administrator') && !normalized.startsWith('/tmp')) {
      throw new Error('Chỉ được phép xóa tệp trong thư mục /home/Administrator hoặc /tmp.');
    }

    if (fs.existsSync(normalized)) {
      const stat = fs.statSync(normalized);
      if (stat.isDirectory()) {
        fs.rmSync(normalized, { recursive: true, force: true });
      } else {
        fs.unlinkSync(normalized);
      }
      serverLogger.info('FileTransfer', `Deleted file: ${normalized}`);
      return true;
    }
    return false;
  }
}

export const fileTransferService = new FileTransferService();
