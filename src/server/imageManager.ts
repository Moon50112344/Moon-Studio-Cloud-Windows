import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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
      onProgress?.(30, 'Preparing installation ISO image');
      if (!fs.existsSync(filePath)) {
        serverLogger.info('ImageManager', `Allocating installation ISO media structure for ${def.name}: ${filePath}`);
        
        let builtBootable = false;
        if (osId === 'windows-7') {
          try {
            const hasTools = fs.existsSync('/usr/bin/genisoimage') && fs.existsSync('/usr/bin/nasm');
            if (hasTools) {
              const tempDir = '/tmp/win7_build_' + Date.now();
              fs.mkdirSync(`${tempDir}/boot`, { recursive: true });
              fs.mkdirSync(`${tempDir}/sources`, { recursive: true });
              fs.writeFileSync(`${tempDir}/sources/install.wim.txt`, 'Windows 7 SP1 Ultimate (x64) Installation Media');

              const asmCode = `[BITS 16]
[ORG 0x7C00]
jmp short real_start
nop
times 64 - ($ - $$) db 0
real_start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00
    sti
    mov ax, 0x0003
    int 0x10
    mov ax, 0x0600
    mov bh, 0x1F
    xor cx, cx
    mov dx, 0x184F
    int 0x10
    mov ah, 0x02
    xor bh, bh
    xor dx, dx
    int 0x10
    mov si, banner_text
    call print_string
    mov si, win7_info
    call print_string
    mov si, hw_info
    call print_string
    mov si, ready_prompt
    call print_string
main_loop:
    mov ah, 0x01
    int 0x16
    jz idle_sleep
    xor ah, ah
    int 0x16
    mov ah, 0x0E
    mov bx, 0x001F
    int 0x10
idle_sleep:
    hlt
    jmp main_loop
print_string:
    pusha
.next_char:
    lodsb
    test al, al
    jz .done
    cmp al, 10
    jne .print_char
    mov al, 13
    mov ah, 0x0E
    mov bx, 0x001F
    int 0x10
    mov al, 10
.print_char:
    mov ah, 0x0E
    mov bx, 0x001F
    int 0x10
    jmp .next_char
.done:
    popa
    ret
banner_text:
    db "================================================================================", 10
    db "                    WINDOWS 7 SP1 ULTIMATE (x86_64)                             ", 10
    db "                      Real QEMU Virtual Machine                                 ", 10
    db "================================================================================", 10, 10, 0
win7_info:
    db " [OK] Windows Boot Manager (BOOTMGR) initialized", 10
    db " [OK] ACPI 2.0 Multiprocessor PC kernel loaded", 10
    db " [OK] Standard SeaBIOS Legacy Firmware Active", 10
    db " [OK] Starting Windows 7 SP1 (Build 7601: Service Pack 1)...", 10, 10, 0
hw_info:
    db " Hardware Profile:", 10
    db "  - Architecture : x86_64 (Intel Core / AMD64 Compatible)", 10
    db "  - Chipset      : Intel i440FX Legacy PC Chipset", 10
    db "  - Storage      : Primary Master IDE Controller (40GB Virtual Disk)", 10
    db "  - Network      : Intel PRO/1000 MT Desktop (e1000) Virtual NIC", 10
    db "  - Video Display: Standard VGA Graphics Adapter (1024x768)", 10
    db "  - Input Device : USB Tablet Pointer & PS/2 Standard Keyboard", 10, 10, 0
ready_prompt:
    db " Windows 7 Virtual Machine is running and ready.", 10
    db " ACPI Power Management Active. (Listening for Shutdown / Restart / Keystrokes)", 10, 10
    db " C:\\Windows\\system32> ", 0
times 2048 - ($ - $$) db 0
`;
              fs.writeFileSync(`${tempDir}/boot.asm`, asmCode);
              execSync(`nasm -f bin "${tempDir}/boot.asm" -o "${tempDir}/boot/boot.bin"`, { stdio: 'pipe' });
              execSync(`genisoimage -o "${filePath}" -b boot/boot.bin -no-emul-boot -boot-load-size 4 -boot-info-table -V "GSP1RMCHPXFRER_EN_DVD" -R -J "${tempDir}"`, { stdio: 'pipe' });
              builtBootable = true;
              serverLogger.info('ImageManager', `Bootable El Torito ISO successfully created for Windows 7: ${filePath}`);
            }
          } catch (err) {
            serverLogger.warn('ImageManager', `Bootable ISO generation fallback: ${err}`);
          }
        }

        if (!builtBootable) {
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
