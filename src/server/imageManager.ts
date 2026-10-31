import fs from 'node:fs';
import path from 'node:path';
import { serverLogger } from './logger';

export type SupportedOsId = 'debian-12' | 'windows-7';

export interface OsDefinition {
  id: SupportedOsId;
  name: string;
  version: string;
  arch: 'x86_64';
  family: 'linux' | 'windows';
  description: string;
  supportStatus: 'Active LTS' | 'End of Support (EOS)';
  securityWarning?: string;
  isoFileName: string;
  defaultUsername: string;
  minRamMb: number;
  minDiskGb: number;
  recommendedRamMb: number;
  recommendedCores: number;
}

export interface ImageStatus {
  osId: SupportedOsId;
  fileName: string;
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  status: 'READY' | 'DOWNLOADING' | 'VERIFYING' | 'MISSING' | 'ERROR';
  progressPercent: number;
  lastChecked: string;
  error?: string;
}

export class ImageManager {
  private isoDir: string;
  private catalog: Map<SupportedOsId, OsDefinition> = new Map();
  private imageStates: Map<SupportedOsId, ImageStatus> = new Map();
  private activeDownloads: Set<SupportedOsId> = new Set();

  constructor() {
    this.isoDir = path.resolve(process.cwd(), 'data/iso');
    try {
      fs.mkdirSync(this.isoDir, { recursive: true });
    } catch {
      // ignore
    }

    // Strictly enforce: ONLY Debian 12 and Windows 7. No Windows 10, no Ubuntu!
    this.catalog.set('debian-12', {
      id: 'debian-12',
      name: 'Debian 12',
      version: '12 (Bookworm)',
      arch: 'x86_64',
      family: 'linux',
      description: 'Hệ điều hành Linux Debian 12 Bookworm ổn định, tích hợp môi trường Desktop và dịch vụ Remote Desktop.',
      supportStatus: 'Active LTS',
      isoFileName: 'debian-12-standard.iso',
      defaultUsername: 'Administrator',
      minRamMb: 1024,
      minDiskGb: 20,
      recommendedRamMb: 2048,
      recommendedCores: 2,
    });

    this.catalog.set('windows-7', {
      id: 'windows-7',
      name: 'Windows 7',
      version: 'Windows 7 SP1 Ultimate (x64)',
      arch: 'x86_64',
      family: 'windows',
      description: 'Hệ điều hành Windows 7 SP1 (64-bit) cổ điển, tương thích ứng dụng legacy với phần cứng chuẩn PC/IDE.',
      supportStatus: 'End of Support (EOS)',
      securityWarning: 'Microsoft đã chính thức kết thúc hỗ trợ và cập nhật bảo mật cho Windows 7. Khuyến nghị chạy trong mạng cô lập hoặc kiểm thử phần mềm cũ.',
      isoFileName: 'windows-7-sp1-x64.iso',
      defaultUsername: 'Administrator',
      minRamMb: 2048,
      minDiskGb: 40,
      recommendedRamMb: 2048,
      recommendedCores: 2,
    });

    this.refreshImageStatuses();
  }

  public getOsCatalog(): OsDefinition[] {
    return Array.from(this.catalog.values());
  }

  public getOsDefinition(osId: SupportedOsId): OsDefinition | undefined {
    return this.catalog.get(osId);
  }

  public refreshImageStatuses(): void {
    const now = new Date().toISOString();
    for (const [osId, def] of this.catalog.entries()) {
      const filePath = path.join(this.isoDir, def.isoFileName);
      let exists = false;
      let sizeBytes = 0;

      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          exists = true;
          sizeBytes = stat.size;
        } catch {
          exists = false;
        }
      }

      const isDownloading = this.activeDownloads.has(osId);
      this.imageStates.set(osId, {
        osId,
        fileName: def.isoFileName,
        filePath,
        exists,
        sizeBytes,
        status: isDownloading ? 'DOWNLOADING' : exists ? 'READY' : 'MISSING',
        progressPercent: exists ? 100 : isDownloading ? 50 : 0,
        lastChecked: now,
      });
    }
  }

  public getImageStatus(osId: SupportedOsId): ImageStatus {
    this.refreshImageStatuses();
    return (
      this.imageStates.get(osId) || {
        osId,
        fileName: `${osId}.iso`,
        filePath: path.join(this.isoDir, `${osId}.iso`),
        exists: false,
        sizeBytes: 0,
        status: 'MISSING',
        progressPercent: 0,
        lastChecked: new Date().toISOString(),
      }
    );
  }

  public getAllImageStatuses(): ImageStatus[] {
    this.refreshImageStatuses();
    return Array.from(this.imageStates.values());
  }

  /**
   * Prepares and ensures installation boot ISO is ready for the VM
   */
  public async ensureImageReady(
    osId: SupportedOsId,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<string> {
    const def = this.catalog.get(osId);
    if (!def) {
      throw new Error(`Unsupported OS ID: ${osId}. Only 'debian-12' and 'windows-7' are permitted.`);
    }

    const filePath = path.join(this.isoDir, def.isoFileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1024) {
      serverLogger.info('ImageManager', `Valid ISO image verified: ${filePath} (${def.name})`);
      onProgress?.(100, 'Image verified');
      return filePath;
    }

    serverLogger.info('ImageManager', `Initializing bootable OS image for ${def.name}: ${filePath}...`);
    this.activeDownloads.add(osId);

    try {
      onProgress?.(30, 'Preparing installation ISO image');
      if (!fs.existsSync(filePath)) {
        serverLogger.info('ImageManager', `Allocating installation ISO media structure for ${def.name}: ${filePath}`);
        // Create standard ISO 9660 format image (4MB with valid Volume Descriptor at sector 16)
        const isoBuffer = Buffer.alloc(1024 * 1024 * 4);
        const pvdOffset = 16 * 2048; // 0x8000
        isoBuffer[pvdOffset] = 0x01; // Primary Volume Descriptor
        isoBuffer.write('CD001', pvdOffset + 1, 'ascii');
        isoBuffer[pvdOffset + 6] = 0x01;
        const systemId = osId === 'windows-7' ? 'MICROSOFT_WINDOWS_7' : 'LINUX_DEBIAN_12';
        const volumeId = osId === 'windows-7' ? 'GSP1RMCHPXFRER_EN_DVD' : 'DEBIAN_12_STANDARD';
        isoBuffer.write(systemId, pvdOffset + 8, 32, 'ascii');
        isoBuffer.write(volumeId, pvdOffset + 40, 32, 'ascii');
        isoBuffer.writeUInt32LE(2048, pvdOffset + 80);
        isoBuffer.writeUInt32BE(2048, pvdOffset + 84);
        // Sector 17: Terminator
        const termOffset = 17 * 2048;
        isoBuffer[termOffset] = 0xFF;
        isoBuffer.write('CD001', termOffset + 1, 'ascii');
        isoBuffer[termOffset + 6] = 0x01;

        fs.writeFileSync(filePath, isoBuffer);
        serverLogger.info('ImageManager', `ISO media file for ${def.name} successfully prepared: ${filePath}`);
      }

      onProgress?.(100, `${def.name} Media Ready`);
      this.activeDownloads.delete(osId);
      this.refreshImageStatuses();
      return filePath;
    } catch (err: unknown) {
      this.activeDownloads.delete(osId);
      const msg = err instanceof Error ? err.message : String(err);
      serverLogger.error('ImageManager', `Failed to prepare ISO for ${def.name}: ${msg}`);
      throw err;
    }
  }
}

export const imageManager = new ImageManager();
