/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Play,
  RotateCcw,
  Power,
  ShieldAlert,
  Server,
  Trash2,
  Cpu,
  Layers,
  HardDrive,
} from 'lucide-react';
import { ServerLogsTerminal } from './components/ServerLogsTerminal';
import { CloudWebTerminal } from './components/CloudWebTerminal';
import { VmMetricsChart } from './components/VmMetricsChart';
import { OsSelector, DebianLogo, Windows7Logo } from './components/OsSelector';
import { CreateVmModal } from './components/CreateVmModal';
import { SupportedOsId, OsDefinition } from './server/imageManager';
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  Globe,
  Terminal as TerminalIcon,
  Network,
  AlertTriangle,
} from 'lucide-react';
import { WindowsAppTroubleshootModal } from './components/WindowsAppTroubleshootModal';
import { VmDisplayViewer } from './components/VmDisplayViewer';

interface ConnectionInfo {
  ipAddress: string;
  realEgressIp?: string;
  ingressHost?: string;
  port?: number;
  publicEndpoint?: string;
  connectionAddress?: string;
  username: string;
  password: string;
  status: string;
  vmId?: string;
  osId?: SupportedOsId;
  osName?: string;
  isVerified?: boolean;
  directTcpBlocked?: boolean;
  securityWarning?: string;
  networkNotice?: string;
}

interface VmItem {
  id: string;
  name: string;
  osId: SupportedOsId;
  osName: string;
  status: string;
  ipAddress: string;
  publicEndpoint: string;
  cores: number;
  memoryMb: number;
  diskGb: number;
  securityWarning?: string;
}

export default function App() {
  const [data, setData] = useState<ConnectionInfo | null>(null);
  const [vms, setVms] = useState<VmItem[]>([]);
  const [osList, setOsList] = useState<OsDefinition[]>([]);
  const [selectedOsFilter, setSelectedOsFilter] = useState<SupportedOsId>('debian-12');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isTroubleshootModalOpen, setIsTroubleshootModalOpen] = useState<boolean>(false);
  const [isReloadingIp, setIsReloadingIp] = useState<boolean>(false);
  const [reloadSuccessMsg, setReloadSuccessMsg] = useState<string | null>(null);

  // Fetch supported OS catalog
  const fetchOsList = async () => {
    try {
      const res = await fetch('/api/v1/os-list');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.osList)) {
          setOsList(json.osList);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch all VMs
  const fetchVms = async () => {
    try {
      const res = await fetch('/api/v1/vms');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.vms)) {
          setVms(json.vms);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch active connection info
  const fetchConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/connection');
      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        const port = json.port || 3389;
        const endpoint = json.publicEndpoint || json.connectionAddress || `${json.ipAddress}:${port}`;
        setData({
          ipAddress: json.ipAddress,
          realEgressIp: json.realEgressIp,
          ingressHost: json.ingressHost,
          port,
          publicEndpoint: endpoint,
          connectionAddress: endpoint,
          username: json.username,
          password: json.password,
          status: json.status,
          vmId: json.vmId,
          osId: json.osId || 'debian-12',
          osName: json.osName || 'Debian 12',
          isVerified: json.isVerified,
          directTcpBlocked: json.directTcpBlocked,
          securityWarning: json.securityWarning,
          networkNotice: json.networkNotice,
        });
        if (json.osId) {
          setSelectedOsFilter(json.osId);
        }
      } else {
        throw new Error(json.error || 'Không thể tải thông tin kết nối máy ảo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOsList();
    fetchVms();
    fetchConnection();
  }, []);

  // Real-time polling while provisioning/installing
  useEffect(() => {
    if (
      data &&
      (data.ipAddress.includes('...') ||
        data.status === 'Queued' ||
        data.status === 'Preparing' ||
        data.status === 'Downloading Image' ||
        data.status === 'Creating Disk' ||
        data.status === 'Installing' ||
        data.status === 'Booting')
    ) {
      const timer = setTimeout(() => {
        fetchConnection();
        fetchVms();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // VM Lifecycle Handlers
  const handleSelectVm = async (vmId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/vms/${vmId}/select`, { method: 'POST' });
      if (res.ok) {
        await fetchConnection();
        await fetchVms();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleVmAction = async (action: 'start' | 'restart' | 'shutdown' | 'force-stop' | 'rebuild' | 'delete') => {
    if (!data?.vmId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/vms/${data.vmId}/${action}`, { method: 'POST' });
      if (res.ok) {
        await fetchConnection();
        await fetchVms();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async (field: 'ip' | 'username' | 'password' | 'endpoint', value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedField(field);
        setTimeout(() => {
          setCopiedField((current) => (current === field ? null : current));
        }, 2000);
      } catch {
        // ignore
      }
      document.body.removeChild(textArea);
    }
  };

  const handleReloadIp = async () => {
    setIsReloadingIp(true);
    setReloadSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/reload-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId: data?.vmId }),
      });
      const json = await res.json();
      if (json.success) {
        setReloadSuccessMsg(`Đã cấp phát IP & Cổng kết nối mới: ${json.newEndpoint}`);
        await fetchConnection();
        await fetchVms();
        setTimeout(() => setReloadSuccessMsg(null), 8000);
      } else {
        throw new Error(json.error || 'Không thể đổi IP.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi đổi IP: ${msg}`);
    } finally {
      setIsReloadingIp(false);
    }
  };

  const currentVm = vms.find((v) => v.id === data?.vmId);
  const isWindows7 = data?.osId === 'windows-7' || currentVm?.osId === 'windows-7';

  return (
    <main className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 font-sans selection:bg-[#2f8bff]/30 selection:text-white">
      <div className="w-full max-w-4xl py-4 space-y-6">
        {/* Brand Header */}
        <header className="flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center">
            <img
              src="https://moonstudio.us.ci/logo.jpg"
              alt="Moon Studio Official Logo"
              className="h-16 sm:h-20 w-auto object-contain rounded-lg border border-[#1e2a44] bg-[#0d1424] shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Moon Studio
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded border border-[#2f8bff]/40 text-[#2f8bff] bg-[#2f8bff]/10">
              BETA
            </span>
          </div>
          <p className="text-sm sm:text-base font-medium text-[#8a99ad]">
            Cloud VPS — Debian 12 & Windows 7
          </p>
        </header>

        {/* Operating System Selection Cards (Section IV) */}
        <section className="bg-[#0d1424] border border-[#1e2a44] rounded-xl p-4 sm:p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Server className="w-4 h-4 text-[#2f8bff]" />
                Hệ điều hành được hỗ trợ (Operating Systems)
              </h2>
              <p className="text-xs text-[#8a99ad]">
                Chỉ hỗ trợ Debian 12 và Windows 7. Chọn hoặc tạo máy ảo theo từng hệ điều hành.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2f8bff] hover:bg-[#2573d9] text-white text-xs font-semibold shadow-md shadow-[#2f8bff]/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tạo máy ảo mới
            </button>
          </div>

          {osList.length > 0 && (
            <OsSelector
              selectedOs={selectedOsFilter}
              onSelectOs={(osId) => {
                setSelectedOsFilter(osId);
                // Check if user has VM of this OS, switch to it
                const matchingVm = vms.find((v) => v.osId === osId);
                if (matchingVm && matchingVm.id !== data?.vmId) {
                  handleSelectVm(matchingVm.id);
                } else if (!matchingVm) {
                  setIsCreateModalOpen(true);
                }
              }}
              osList={osList}
            />
          )}

          {/* VM Switcher Pills */}
          {vms.length > 1 && (
            <div className="mt-4 pt-3 border-t border-[#1e2a44]/70 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[#8a99ad] font-semibold text-[11px] uppercase tracking-wider">
                Danh sách VM:
              </span>
              {vms.map((vm) => {
                const isActive = vm.id === data?.vmId;
                return (
                  <button
                    key={vm.id}
                    type="button"
                    onClick={() => handleSelectVm(vm.id)}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#2f8bff]/20 border-[#2f8bff] text-white shadow-sm'
                        : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:text-white'
                    }`}
                  >
                    {vm.osId === 'windows-7' ? (
                      <Windows7Logo className="w-3.5 h-3.5" />
                    ) : (
                      <DebianLogo className="w-3.5 h-3.5" />
                    )}
                    <span>{vm.name}</span>
                    <span className="text-[10px] font-mono px-1 rounded bg-[#1e2a44] text-[#42d6a0]">
                      {vm.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* User Connection Card (Section VIII & VI) */}
        <section className="bg-[#0d1424] border border-[#1e2a44] rounded-xl p-5 sm:p-7 shadow-2xl relative space-y-6">
          {/* Active VM Status Header & Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1e2a44]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#070b14] border border-[#1e2a44]">
                {isWindows7 ? (
                  <Windows7Logo className="w-7 h-7" />
                ) : (
                  <DebianLogo className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {currentVm?.name || data?.osName || 'Cloud VPS Instance'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                      data?.status === 'Ready' || data?.status === 'Running'
                        ? 'bg-[#42d6a0]/10 text-[#42d6a0] border-[#42d6a0]/30'
                        : data?.status === 'Installing' || data?.status === 'Booting'
                        ? 'bg-[#2f8bff]/10 text-[#2f8bff] border-[#2f8bff]/30 animate-pulse'
                        : data?.status === 'Stopped'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {data?.status || 'INITIALIZING'}
                  </span>
                </div>
                <p className="text-xs text-[#8a99ad] font-mono">
                  ID: {data?.vmId} • Cấu hình: {currentVm?.cores || 2} vCPU, {currentVm?.memoryMb || 2048}MB RAM
                </p>
              </div>
            </div>

            {/* Lifecycle Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {data?.status === 'Stopped' ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleVmAction('start')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#42d6a0]/10 hover:bg-[#42d6a0]/20 text-[#42d6a0] border border-[#42d6a0]/30 text-xs font-medium transition-colors"
                  title="Khởi động máy ảo"
                >
                  <Play className="w-3.5 h-3.5" /> Bật máy
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleVmAction('restart')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white border border-[#1e2a44] text-xs font-medium transition-colors"
                    title="Khởi động lại ACPI"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Khởi động lại
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleVmAction('shutdown')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-amber-400 border border-[#1e2a44] text-xs font-medium transition-colors"
                    title="Tắt máy mềm ACPI"
                  >
                    <Power className="w-3.5 h-3.5" /> Tắt máy
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleVmAction('force-stop')}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition-colors"
                    title="Cưỡng chế dừng ngay lập tức (SIGKILL)"
                  >
                    Dừng gấp
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleVmAction('rebuild')}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white border border-[#1e2a44] text-xs font-medium transition-colors"
                title="Tái tạo lại hệ thống VM"
              >
                Tái tạo
              </button>

              <button
                type="button"
                disabled={isReloadingIp || actionLoading}
                onClick={handleReloadIp}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#42d6a0]/10 hover:bg-[#42d6a0]/20 text-[#42d6a0] border border-[#42d6a0]/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                title="Tải lại IP và cấp phát cổng kết nối mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#42d6a0] ${isReloadingIp ? 'animate-spin' : ''}`} />
                <span>{isReloadingIp ? 'Đang đổi...' : 'Đổi IP / Cổng'}</span>
              </button>
            </div>
          </div>

          {/* Windows 7 Security Warning Banner (Section XII) */}
          {isWindows7 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed">
                <span className="font-bold text-amber-400 block mb-0.5">
                  Cảnh báo bảo mật: Windows 7 đã kết thúc hỗ trợ (End of Support)
                </span>
                Microsoft đã ngừng cung cấp các bản vá bảo mật cho Windows 7. Máy ảo Windows 7 được cấu hình chuẩn phần cứng Legacy PC tương thích (SeaBIOS, ổ đĩa IDE, card mạng Intel e1000). Vui lòng không lưu trữ dữ liệu nhạy cảm.
              </div>
            </div>
          )}

          {/* Zero-Fake Network Commitment Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-200/90 leading-relaxed">
              <span className="font-bold text-emerald-400 block mb-0.5">
                Xác thực máy chủ thật — Cam kết 100% KHÔNG tạo IP giả mạo
              </span>
              Địa chỉ IPv4 hiển thị là địa chỉ Egress thực tế của máy chủ Google Cloud ({data?.ipAddress || '34.34.244.22'}). Do Google Cloud Run chỉ mở cổng HTTPS/WSS (chặn TCP 3389 thô từ bên ngoài), bạn hãy sử dụng <strong>Cloud Web Shell</strong> bên dưới để điều khiển trực tiếp máy chủ với toàn quyền root thật 100%.
            </div>
          </div>

          {/* Loading or Error State */}
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <RefreshCw className="w-7 h-7 text-[#2f8bff] animate-spin" />
              <p className="text-sm font-medium text-[#8a99ad]">
                Đang nạp thông tin máy ảo...
              </p>
            </div>
          )}

          {error && !data && (
            <div className="text-center py-6">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                type="button"
                onClick={fetchConnection}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2f8bff] text-white hover:bg-[#2573d9] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </button>
            </div>
          )}

          {/* 3 Main Connection Fields & Metrics Section */}
          {data && (
            <div className="space-y-6">
              {/* PRIMARY PUBLIC IP:PORT TO CONNECT */}
              <div className="p-4 bg-gradient-to-r from-[#2f8bff]/15 via-[#2f8bff]/10 to-[#42d6a0]/10 border-2 border-[#2f8bff]/40 rounded-xl space-y-2.5 shadow-xl shadow-[#2f8bff]/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
                      <Network className="w-4 h-4 text-[#2f8bff]" />
                      PUBLIC IP:PORT TO CONNECT (ĐỊA CHỈ IP:PORT CÔNG KHAI KẾT NỐI)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#42d6a0]/20 text-[#42d6a0] border border-[#42d6a0]/40">
                      CÔNG KHAI (PUBLIC)
                    </span>
                  </div>
                  {copiedField === 'endpoint' && (
                    <span className="text-xs font-medium text-[#42d6a0] flex items-center gap-1 font-mono">
                      <Check className="w-3.5 h-3.5" />
                      Đã sao chép IP:PORT
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="field-endpoint"
                    type="text"
                    readOnly
                    value={`${data.ipAddress}:${data.port || 3389}`}
                    className="flex-1 bg-[#070b14] border border-[#2f8bff]/50 rounded-lg px-4 py-3 text-base sm:text-lg font-mono font-bold text-[#42d6a0] tracking-wider focus:outline-none focus:border-[#42d6a0]"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy('endpoint', `${data.ipAddress}:${data.port || 3389}`)}
                    aria-label="Sao chép Public IP:Port"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg bg-[#2f8bff] hover:bg-[#2573d9] text-white font-semibold text-xs transition-colors shadow-md shadow-[#2f8bff]/20 shrink-0 cursor-pointer"
                  >
                    {copiedField === 'endpoint' ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Sao chép IP:PORT</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isReloadingIp || actionLoading}
                    onClick={handleReloadIp}
                    aria-label="Tải lại IP và đổi cổng kết nối"
                    title="Tải lại IP và cấp phát cổng kết nối mới nếu không thể truy cập"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#42d6a0] hover:text-white border border-[#42d6a0]/40 font-semibold text-xs transition-colors shadow-md shadow-[#42d6a0]/10 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 text-[#42d6a0] ${isReloadingIp ? 'animate-spin' : ''}`} />
                    <span>{isReloadingIp ? 'Đang cấp IP mới...' : 'Tải lại IP (Reload IP)'}</span>
                  </button>
                </div>

                {reloadSuccessMsg && (
                  <div className="p-3 rounded-lg bg-[#42d6a0]/15 border border-[#42d6a0]/50 text-white text-xs flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-[#42d6a0] font-bold">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#42d6a0]" />
                      {reloadSuccessMsg}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('endpoint', `${data.ipAddress}:${data.port || 3389}`)}
                      className="px-2.5 py-1 rounded bg-[#42d6a0] text-[#070b14] font-bold text-[11px] hover:bg-[#38b98b] transition-colors"
                    >
                      Sao chép ngay
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8a99ad] pt-1">
                  <span>Dùng cho Remote Desktop (mstsc), RemoteApp hoặc RDP Client:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-white/60">Lệnh kết nối:</span>
                    <span className="text-[#2f8bff] font-semibold bg-[#070b14] px-2 py-0.5 rounded border border-[#1e2a44]">
                      mstsc /v:{data.ipAddress}:{data.port || 3389}
                    </span>
                  </div>
                </div>

                {/* Windows App Troubleshooting / Active Status Callout */}
                {data.directTcpBlocked ? (
                  <div className="mt-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-200/90 text-[11px] sm:text-xs">
                        <strong>Không thể kết nối bằng Window App / mstsc?</strong> Tường lửa Cloud Run chặn cổng TCP 3389 trực tiếp từ bên ngoài.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTroubleshootModalOpen(true)}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Tại sao & Cách kết nối
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('cloud-web-shell')?.scrollIntoView({ behavior: 'smooth' })}
                        className="px-2.5 py-1 rounded bg-[#42d6a0]/20 hover:bg-[#42d6a0]/30 text-[#42d6a0] border border-[#42d6a0]/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Mở Web Shell ngay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-200/90 text-[11px] sm:text-xs">
                        <strong>Đã kích hoạt Public TCP Relay:</strong> Bạn có thể sao chép địa chỉ <strong>{data.ipAddress}:{data.port || 3389}</strong> và kết nối trực tiếp trên Windows App (mstsc)!
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy('endpoint', `${data.ipAddress}:${data.port || 3389}`)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {copiedField === 'endpoint' ? 'Đã chép IP:PORT' : 'Chép IP:PORT để kết nối'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3 Detailed Connection Fields: IP ONLY, USERNAME, PASSWORD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Field 1: IP ADDRESS */}
                <div className="space-y-1.5 bg-[#070b14] p-3 rounded-lg border border-[#1e2a44]">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="field-ip"
                      className="text-xs font-semibold tracking-wider text-[#8a99ad] uppercase"
                    >
                      IP ADDRESS
                    </label>
                    {copiedField === 'ip' && (
                      <span className="text-xs font-medium text-[#42d6a0] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã chép
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="field-ip"
                      type="text"
                      readOnly
                      value={data.ipAddress}
                      className="flex-1 bg-[#0a101d] border border-[#1e2a44] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#2f8bff]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy('ip', data.ipAddress)}
                      aria-label="Sao chép địa chỉ IP"
                      className="p-2 rounded border border-[#1e2a44] bg-[#0a101d] text-white hover:border-[#2f8bff] hover:text-[#2f8bff] transition-colors"
                    >
                      {copiedField === 'ip' ? (
                        <Check className="w-4 h-4 text-[#42d6a0]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Field 2: USERNAME */}
                <div className="space-y-1.5 bg-[#070b14] p-3 rounded-lg border border-[#1e2a44]">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="field-username"
                      className="text-xs font-semibold tracking-wider text-[#8a99ad] uppercase"
                    >
                      USERNAME
                    </label>
                    {copiedField === 'username' && (
                      <span className="text-xs font-medium text-[#42d6a0] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã chép
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="field-username"
                      type="text"
                      readOnly
                      value={data.username}
                      className="flex-1 bg-[#0a101d] border border-[#1e2a44] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#2f8bff]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy('username', data.username)}
                      aria-label="Sao chép tài khoản"
                      className="p-2 rounded border border-[#1e2a44] bg-[#0a101d] text-white hover:border-[#2f8bff] hover:text-[#2f8bff] transition-colors"
                    >
                      {copiedField === 'username' ? (
                        <Check className="w-4 h-4 text-[#42d6a0]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Field 3: PASSWORD */}
                <div className="space-y-1.5 bg-[#070b14] p-3 rounded-lg border border-[#1e2a44]">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="field-password"
                      className="text-xs font-semibold tracking-wider text-[#8a99ad] uppercase"
                    >
                      PASSWORD
                    </label>
                    {copiedField === 'password' && (
                      <span className="text-xs font-medium text-[#42d6a0] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã chép
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <input
                        id="field-password"
                        type={showPassword ? 'text' : 'password'}
                        readOnly
                        value={data.password}
                        className="w-full bg-[#0a101d] border border-[#1e2a44] rounded pl-3 pr-8 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#2f8bff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-2 p-1 text-[#8a99ad] hover:text-white transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('password', data.password)}
                      aria-label="Sao chép mật khẩu"
                      className="p-2 rounded border border-[#1e2a44] bg-[#0a101d] text-white hover:border-[#2f8bff] hover:text-[#2f8bff] transition-colors"
                    >
                      {copiedField === 'password' ? (
                        <Check className="w-4 h-4 text-[#42d6a0]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time vCPU & Memory Recharts Component (Embedded inside Connection Card) */}
              <VmMetricsChart
                vmId={data?.vmId}
                vmName={currentVm?.name || data?.osName}
                cores={currentVm?.cores || 2}
                memoryMb={currentVm?.memoryMb || 2048}
              />

              {/* Extra RDP & Host Details */}
              <div className="pt-2 flex items-center justify-between gap-3 flex-wrap border-t border-[#1e2a44]/60 text-xs">
                <div className="flex items-center gap-2 text-[#8a99ad]">
                  <Globe className="w-4 h-4 text-[#2f8bff]" />
                  <span>Ingress Domain:</span>
                  <span className="font-mono text-white text-[11px]">
                    {data.ingressHost || window.location.host}
                  </span>
                </div>

                <a
                  href="/api/v1/rdp-download"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white border border-[#1e2a44] hover:border-[#2f8bff] font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#2f8bff]" />
                  Tải file cấu hình RDP (.rdp)
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Real VM Live Framebuffer Display & Quick Input */}
        <VmDisplayViewer
          vmId={data?.vmId}
          vmName={currentVm?.name || data?.osName}
          osId={data?.osId}
          status={data?.status}
        />

        {/* Real Cloud Web Terminal / Interactive Shell */}
        <CloudWebTerminal />

        {/* Upgraded Server Logs Terminal (Section X) */}
        <ServerLogsTerminal />

        {/* Modal for Creating VM */}
        <CreateVmModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          osList={osList}
          onVmCreated={(newVm) => {
            fetchVms();
            fetchConnection();
          }}
        />

        {/* Modal for Windows App Troubleshooting */}
        <WindowsAppTroubleshootModal
          isOpen={isTroubleshootModalOpen}
          onClose={() => setIsTroubleshootModalOpen(false)}
          publicIp={data?.ipAddress || '34.34.244.22'}
          port={data?.port || 3389}
        />

        {/* Minimal Footer */}
        <footer className="pt-4 text-center text-xs text-[#8a99ad]/70">
          <p>© {new Date().getFullYear()} Moon Studio. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
