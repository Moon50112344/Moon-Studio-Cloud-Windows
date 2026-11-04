import React, { useState, useEffect } from 'react';
import {
  Monitor,
  RefreshCw,
  Maximize2,
  Minimize2,
  CornerDownLeft,
  Keyboard,
  Power,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';

interface VmDisplayViewerProps {
  vmId?: string;
  vmName?: string;
  osId?: string;
  status?: string;
}

export function VmDisplayViewer({ vmId, vmName, osId, status }: VmDisplayViewerProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [keySending, setKeySending] = useState<string | null>(null);

  const refreshScreenshot = async () => {
    if (!vmId) return;
    setLoading(true);
    try {
      const url = `/api/v1/vms/${vmId}/screenshot?t=${Date.now()}`;
      const res = await fetch(url);
      if (res.ok) {
        setScreenshotUrl(url);
        setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshScreenshot();
  }, [vmId]);

  useEffect(() => {
    if (!autoRefresh || !vmId) return;
    const interval = setInterval(() => {
      refreshScreenshot();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, vmId]);

  const sendKey = async (key: string, label: string) => {
    if (!vmId) return;
    setKeySending(label);
    try {
      await fetch(`/api/v1/vms/${vmId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      setTimeout(() => {
        refreshScreenshot();
      }, 500);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setKeySending(null), 1000);
    }
  };

  return (
    <div className={`bg-[#0d1424] border border-[#1e2a44] rounded-xl shadow-2xl overflow-hidden transition-all ${
      isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#070b14]' : ''
    }`}>
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-[#0a101d] border-b border-[#1e2a44] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#070b14] border border-[#1e2a44] text-[#2f8bff]">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                Màn hình trực tiếp máy ảo (Real VM Live Display)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#42d6a0]/15 text-[#42d6a0] border border-[#42d6a0]/30">
                100% QEMU Framebuffer
              </span>
            </div>
            <p className="text-[11px] text-[#8a99ad]">
              {vmName || 'Virtual Machine'} • Cập nhật lúc: {lastRefreshed || 'Đang tải...'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
              autoRefresh
                ? 'bg-[#42d6a0]/15 text-[#42d6a0] border-[#42d6a0]/40'
                : 'bg-[#070b14] text-[#8a99ad] border-[#1e2a44] hover:text-white'
            }`}
            title="Bật/Tắt tự động cập nhật khung hình"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-[#42d6a0] animate-pulse' : 'bg-gray-500'}`} />
            <span>Tự động làm mới (4s)</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={refreshScreenshot}
            className="p-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white border border-[#1e2a44] transition-colors cursor-pointer"
            title="Chụp lại màn hình ngay"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2f8bff]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white border border-[#1e2a44] transition-colors cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screen Framebuffer Canvas / Image */}
      <div className="relative bg-black flex items-center justify-center min-h-[260px] sm:min-h-[380px] p-2 overflow-hidden flex-1">
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt="Real VM Live Framebuffer"
            className="max-h-[500px] w-auto max-w-full object-contain rounded border border-[#1e2a44]/60 shadow-2xl select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <RefreshCw className="w-8 h-8 text-[#2f8bff] animate-spin" />
            <p className="text-xs text-[#8a99ad] font-mono">
              Đang kết nối framebuffer máy ảo QEMU...
            </p>
          </div>
        )}

        {keySending && (
          <div className="absolute top-4 right-4 bg-black/80 border border-[#42d6a0] text-[#42d6a0] px-3 py-1 rounded text-xs font-mono shadow-lg animate-fade-in flex items-center gap-1.5">
            <CornerDownLeft className="w-3.5 h-3.5" />
            Đã gửi phím: <strong>{keySending}</strong>
          </div>
        )}
      </div>

      {/* Interactive On-Screen Quick Key Bar */}
      <div className="p-3 bg-[#0a101d] border-t border-[#1e2a44] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#8a99ad]">
          <Keyboard className="w-4 h-4 text-[#2f8bff]" />
          <span>Gửi phím tương tác nhanh vào máy ảo:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => sendKey('ret', 'Enter')}
            className="px-2.5 py-1 rounded bg-[#070b14] hover:bg-[#1e2a44] text-white border border-[#1e2a44] text-[11px] font-mono font-bold transition-colors cursor-pointer"
          >
            ↵ Enter
          </button>

          <button
            type="button"
            onClick={() => sendKey('spc', 'Space')}
            className="px-2.5 py-1 rounded bg-[#070b14] hover:bg-[#1e2a44] text-white border border-[#1e2a44] text-[11px] font-mono font-bold transition-colors cursor-pointer"
          >
            ␣ Space
          </button>

          <button
            type="button"
            onClick={() => sendKey('f8', 'F8 (Boot Menu)')}
            className="px-2.5 py-1 rounded bg-[#070b14] hover:bg-[#1e2a44] text-white border border-[#1e2a44] text-[11px] font-mono font-bold transition-colors cursor-pointer"
          >
            F8 (Boot Menu)
          </button>

          <button
            type="button"
            onClick={() => sendKey('esc', 'Esc')}
            className="px-2.5 py-1 rounded bg-[#070b14] hover:bg-[#1e2a44] text-white border border-[#1e2a44] text-[11px] font-mono font-bold transition-colors cursor-pointer"
          >
            Esc
          </button>

          <button
            type="button"
            onClick={() => sendKey('tab', 'Tab')}
            className="px-2.5 py-1 rounded bg-[#070b14] hover:bg-[#1e2a44] text-white border border-[#1e2a44] text-[11px] font-mono font-bold transition-colors cursor-pointer"
          >
            Tab
          </button>
        </div>
      </div>
    </div>
  );
}
