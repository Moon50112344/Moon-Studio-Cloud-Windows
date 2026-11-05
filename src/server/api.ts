import fs from 'node:fs';
import { Router, Request, Response } from 'express';
import { vmManager } from './vmManager';
import { hypervisor } from './hypervisor';
import { serverLogger, LogLevel, LogEntry } from './logger';
import { probeHostInfrastructure } from './infrastructure';
import { rdpSessionMonitor } from './rdpSessionMonitor';
import { imageManager, SupportedOsId } from './imageManager';
import { vmMetricsCollector } from './metrics';
import multer from 'multer';
import { fileTransferService } from './fileTransfer';

const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

export const apiRouter = Router();

/**
 * Main User Connection Endpoint (Section VIII & VI)
 * Website calls this to obtain the required fields: IP:Port, Username, Password, OS Info
 */
apiRouter.get('/connection', async (_req: Request, res: Response) => {
  const info = vmManager.getPublicConnectionInfo();
  if (!info) {
    return res.status(503).json({
      success: false,
      error: 'Chưa có máy ảo nào hoạt động trên hệ thống.',
    });
  }

  return res.json({
    success: true,
    ipAddress: info.ipAddress,
    realEgressIp: info.realEgressIp,
    ingressHost: info.ingressHost,
    port: info.port,
    publicEndpoint: info.publicEndpoint,
    connectionAddress: info.connectionAddress,
    username: info.username,
    password: info.password,
    status: info.status,
    vmId: info.vmId,
    osId: info.osId,
    osName: info.osName,
    isVerified: info.isVerified,
    directTcpBlocked: info.directTcpBlocked,
    securityWarning: info.securityWarning,
    networkNotice: info.networkNotice,
  });
});

/**
 * Real-time VM vCPU & Memory Metrics Endpoint
 * Used by Recharts component to render live utilization charts
 */
apiRouter.get('/vm/metrics', (req: Request, res: Response) => {
  const vmId = req.query.vmId as string | undefined;
  const metrics = vmMetricsCollector.getMetrics(vmId);
  return res.json(metrics);
});

/**
 * Operating System Catalog Endpoint (Section IV)
 * Strictly returns only Debian 12 and Windows 7
 */
apiRouter.get('/os-list', (_req: Request, res: Response) => {
  const catalog = imageManager.getOsCatalog();
  return res.json({ success: true, osList: catalog });
});

/**
 * ISO & Image Status Endpoint (Section VI)
 */
apiRouter.get('/images', (_req: Request, res: Response) => {
  const images = imageManager.getAllImageStatuses();
  return res.json({ success: true, images });
});

/**
 * Infrastructure Audit Endpoint (Section III)
 */
apiRouter.get('/infra', (_req: Request, res: Response) => {
  const report = probeHostInfrastructure();
  return res.json({ success: true, report });
});

/**
 * Server Logs Endpoint - Query historical logs (Section V & Phần 2)
 */
apiRouter.get('/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  const level = req.query.level as LogLevel | undefined;
  const component = req.query.component as string | undefined;
  const vmId = req.query.vmId as string | undefined;

  const logs = serverLogger.getLogs({ limit, level, component, vmId });
  return res.json({ success: true, logs });
});

/**
 * Real-time Server Logs SSE Streaming Endpoint (Phần 2.3)
 */
apiRouter.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const initialLogs = serverLogger.getLogs({ limit: 50 });
  res.write(`event: init\ndata: ${JSON.stringify(initialLogs)}\n\n`);

  const onLog = (entry: LogEntry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  serverLogger.on('log', onLog);

  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    serverLogger.off('log', onLog);
  });
});

/**
 * Real Host Diagnostics - checks ports and real system state
 */
apiRouter.post('/logs/diagnostic', async (_req: Request, res: Response) => {
  const result = await rdpSessionMonitor.runRealHostDiagnostic();
  return res.json({ success: true, result });
});

/**
 * Real Cloud Web Terminal / Interactive Shell Execution (100% Real, zero fake)
 */
apiRouter.post('/terminal/exec', async (req: Request, res: Response) => {
  const cmd = (req.body?.command || '').trim();
  if (!cmd) {
    return res.status(400).json({ success: false, error: 'Câu lệnh không được để trống.' });
  }

  // Prevent destructive commands on container root filesystem
  if (/rm\s+-rf\s+\/($|\s)/.test(cmd)) {
    return res.status(403).json({ success: false, error: 'Lệnh xóa hệ thống bị chặn để bảo vệ máy chủ.' });
  }

  const { exec } = await import('node:child_process');
  const startTime = Date.now();
  exec(cmd, { timeout: 8000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
    const durationMs = Date.now() - startTime;
    serverLogger.info('WebTerminal', `Executed: "${cmd.substring(0, 50)}" (${durationMs}ms, exit: ${err ? err.code || 1 : 0})`);
    return res.json({
      success: !err || err.code === 0,
      stdout: stdout || '',
      stderr: stderr || (err ? err.message : ''),
      exitCode: err ? (err.code || 1) : 0,
      durationMs,
    });
  });
});

/**
 * Real Live System Metrics
 */
apiRouter.get('/system-info', async (_req: Request, res: Response) => {
  const os = await import('node:os');
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return res.json({
    success: true,
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptime: os.uptime(),
      cpuModel: cpus[0]?.model || 'Cloud vCPU',
      cores: cpus.length,
      totalRamMb: Math.round(totalMem / 1024 / 1024),
      freeRamMb: Math.round(freeMem / 1024 / 1024),
      usedRamPercent: Math.round((usedMem / totalMem) * 100),
      loadAvg: os.loadavg(),
    },
  });
});

/**
 * Genuine RDP Connection Profile (.rdp file)
 */
apiRouter.get('/rdp-download', (_req: Request, res: Response) => {
  const info = vmManager.getPublicConnectionInfo();
  if (!info) {
    return res.status(404).send('VM not available');
  }

  const rdpContent = [
    `full address:s:${info.ipAddress}:${info.port || 3389}`,
    `username:s:${info.username}`,
    `prompt for credentials:i:1`,
    `administrative session:i:1`,
    `screen mode id:i:2`,
    `use multimon:i:0`,
    `desktopwidth:i:1440`,
    `desktopheight:i:900`,
    `session bpp:i:32`,
    `compression:i:1`,
    `keyboardhook:i:2`,
    `audiomode:i:0`,
    `redirectprinters:i:0`,
    `redirectcomports:i:0`,
    `redirectsmartcards:i:0`,
    `redirectclipboard:i:1`,
    `redirectposdevices:i:0`,
    `drivestoredirect:s:`,
    `autoreconnection enabled:i:1`,
    `authentication level:i:2`,
    `negotiate security layer:i:1`,
  ].join('\r\n');

  res.setHeader('Content-Type', 'application/x-rdp');
  res.setHeader('Content-Disposition', `attachment; filename="MoonStudio-${info.vmId}.rdp"`);
  return res.send(rdpContent);
});

/**
 * VM Management Endpoints (Section IV & V)
 */
apiRouter.get('/vms', (_req: Request, res: Response) => {
  const vms = vmManager.getAllVms();
  return res.json({ success: true, vms });
});

apiRouter.post('/vms', async (req: Request, res: Response) => {
  const { osId, name, cores, memoryMb, diskGb } = req.body;

  // Strict validation of allowed OS IDs
  if (!osId || (osId !== 'debian-12' && osId !== 'windows-7')) {
    return res.status(400).json({
      success: false,
      error: `Hệ điều hành không hợp lệ: '${osId}'. Hệ thống chỉ cho phép 'debian-12' hoặc 'windows-7'.`,
    });
  }

  try {
    const vm = await vmManager.createVm({
      osId: osId as SupportedOsId,
      name,
      cores: cores ? Number(cores) : undefined,
      memoryMb: memoryMb ? Number(memoryMb) : undefined,
      diskGb: diskGb ? Number(diskGb) : undefined,
    });
    // Auto select newly created VM
    vmManager.setPrimaryVm(vm.id);
    return res.status(201).json({ success: true, vm });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

apiRouter.get('/vms/:id', (req: Request, res: Response) => {
  const vm = vmManager.getVm(req.params.id);
  if (!vm) return res.status(404).json({ success: false, error: 'VM not found' });
  return res.json({ success: true, vm });
});

apiRouter.post('/vms/:id/select', (req: Request, res: Response) => {
  const ok = vmManager.setPrimaryVm(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: 'VM not found' });
  return res.json({ success: true });
});

apiRouter.post('/vms/:id/start', async (req: Request, res: Response) => {
  const ok = await vmManager.startVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/shutdown', async (req: Request, res: Response) => {
  const ok = await vmManager.shutdownVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/restart', async (req: Request, res: Response) => {
  const ok = await vmManager.restartVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/stop', async (req: Request, res: Response) => {
  const ok = await vmManager.stopVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/force-stop', async (req: Request, res: Response) => {
  const ok = await vmManager.forceStopVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/delete', async (req: Request, res: Response) => {
  const ok = await vmManager.deleteVm(req.params.id);
  return res.json({ success: ok });
});

apiRouter.post('/vms/:id/rebuild', async (req: Request, res: Response) => {
  const vm = await vmManager.rebuildVm(req.params.id);
  return res.json({ success: !!vm, vm });
});

/**
 * Reload IP / Endpoint Rotation Endpoint (Section VI & User Request)
 * Rotates public IP/port via tunnel reload and updates VM state
 */
apiRouter.post('/reload-ip', async (req: Request, res: Response) => {
  const vmId = (req.body?.vmId as string) || undefined;
  try {
    const result = await vmManager.reloadIp(vmId);
    return res.json({
      success: true,
      vm: result.vm,
      oldEndpoint: result.oldEndpoint,
      newEndpoint: result.newEndpoint,
      connectionAddress: result.newEndpoint,
      ipAddress: result.vm.ipAddress,
      port: result.port,
      message: `Đã cấp phát địa chỉ IP & Cổng mới thành công: ${result.newEndpoint}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    serverLogger.error('API', `Reload IP failed: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

apiRouter.post('/vms/:id/reload-ip', async (req: Request, res: Response) => {
  try {
    const result = await vmManager.reloadIp(req.params.id);
    return res.json({
      success: true,
      vm: result.vm,
      oldEndpoint: result.oldEndpoint,
      newEndpoint: result.newEndpoint,
      connectionAddress: result.newEndpoint,
      ipAddress: result.vm.ipAddress,
      port: result.port,
      message: `Đã cấp phát địa chỉ IP & Cổng mới cho ${result.vm.name}: ${result.newEndpoint}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Real VM Framebuffer Screenshot Endpoint (QMP Screendump)
 */
apiRouter.get('/vms/:id/screenshot', async (req: Request, res: Response) => {
  const { id } = req.params;
  const path = await hypervisor.takeScreenshot(id);
  if (!path || !fs.existsSync(path)) {
    return res.status(404).json({ success: false, error: 'Framebuffer not available or VM not running' });
  }
  return res.sendFile(path);
});

/**
 * Real QMP VM Status Endpoint
 */
apiRouter.get('/vms/:id/qmp-status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const status = await hypervisor.queryStatus(id);
  return res.json({ success: !!status, status });
});

/**
 * Keystroke / Input Event Injection via QMP
 */
apiRouter.post('/vms/:id/input', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: 'Missing key parameter' });
  }
  const ok = await hypervisor.sendInputKey(id, String(key));
  return res.json({ success: ok });
});

/**
 * File Upload Endpoint:
 * Mode 1: 'folder' -> Saves directly to user's directory (Desktop, Downloads, etc.)
 * Mode 2: 'install' -> Automatically executes/installs .exe (via Wine), .deb, or script
 */
apiRouter.post('/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn một tệp để tải lên.' });
    }

    const mode = (req.body.mode === 'install' ? 'install' : 'folder') as 'folder' | 'install';
    const targetDir = req.body.targetDir as string | undefined;

    const result = await fileTransferService.handleUploadedFile({
      tempFilePath: req.file.path,
      originalFileName: req.file.originalname,
      targetDir,
      mode,
    });

    return res.json({
      success: true,
      file: result,
      message: mode === 'install'
        ? `Đã tải lên và kích hoạt tự động cài đặt / chạy tệp ${result.fileName}!`
        : `Đã lưu tệp ${result.fileName} vào thư mục ${result.targetDir}!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    serverLogger.error('FileTransfer', `Upload failed: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Directory Files Listing Endpoint
 */
apiRouter.get('/files/list', (req: Request, res: Response) => {
  try {
    const dir = req.query.dir as string | undefined;
    const result = fileTransferService.listFiles(dir);
    return res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * File Execution Endpoint (.exe with Wine, .deb with apt, .sh with bash)
 */
apiRouter.post('/files/execute', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Thiếu đường dẫn tệp tin (filePath).' });
    }
    const result = await fileTransferService.executeFile(String(filePath));
    return res.json({ ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * File Deletion Endpoint
 */
apiRouter.delete('/files', (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Thiếu đường dẫn tệp tin (path).' });
    }
    const ok = fileTransferService.deleteFile(filePath);
    return res.json({ success: ok, message: 'Đã xóa tệp tin thành công.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

