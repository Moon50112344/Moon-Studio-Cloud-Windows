import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Download,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Terminal,
} from 'lucide-react';

export interface AppCatalogItem {
  id: string;
  name: string;
  category: 'game' | 'app' | 'tool';
  categoryLabel: string;
  description: string;
  shortDesc: string;
  version: string;
  size: string;
  publisher: string;
  badge?: string;
  badgeColor?: string;
  isInstalled: boolean;
  desktopFile?: string;
  type: 'wine' | 'native' | 'script';
}

function RobloxIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#111216" />
      <g transform="rotate(-15 256 256)">
        <rect x="136" y="136" width="240" height="240" rx="36" fill="#E2231A" />
        <rect x="216" y="216" width="80" height="80" rx="12" fill="#111216" />
      </g>
    </svg>
  );
}

function MinecraftIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#1c2419" />
      <path d="M100 160L256 80L412 160V352L256 432L100 352V160Z" fill="#5b8731" stroke="#37521e" strokeWidth="16" />
      <path d="M100 160L256 240L412 160" stroke="#37521e" strokeWidth="16" />
      <path d="M256 240V432" stroke="#37521e" strokeWidth="16" />
      <path d="M100 190L256 270L412 190V230L256 310L100 230V190Z" fill="#875836" />
    </svg>
  );
}

function SuperTuxKartIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#111c30" />
      <circle cx="256" cy="256" r="140" stroke="#2f8bff" strokeWidth="24" fill="#0d1424" />
      <circle cx="256" cy="256" r="48" fill="#42d6a0" />
      <path d="M256 116V208M256 304V396M116 256H208M304 256H396" stroke="#2f8bff" strokeWidth="20" strokeLinecap="round" />
    </svg>
  );
}

function DoomIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#260b0b" />
      <path d="M140 140H200V372H140V140Z" fill="#e53e3e" />
      <path d="M312 140H372V372H312V140Z" fill="#e53e3e" />
      <path d="M200 140L256 230L312 140H372L256 320L140 140H200Z" fill="#f6ad55" />
    </svg>
  );
}

function SteamIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#171a21" />
      <circle cx="340" cy="180" r="70" stroke="#66c0f4" strokeWidth="28" fill="none" />
      <circle cx="340" cy="180" r="30" fill="#66c0f4" />
      <circle cx="180" cy="330" r="45" stroke="#66c0f4" strokeWidth="24" fill="none" />
      <circle cx="180" cy="330" r="20" fill="#66c0f4" />
      <path d="M200 300L290 220" stroke="#66c0f4" strokeWidth="32" strokeLinecap="round" />
    </svg>
  );
}

function TelegramIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#229ed9" />
      <path d="M120 250L370 150L320 360L230 300L190 350L185 290L310 190L160 270L120 250Z" fill="white" />
    </svg>
  );
}

function VlcIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#2d1600" />
      <path d="M256 90L140 370H372L256 90Z" fill="#ff8800" stroke="#cc6600" strokeWidth="8" />
      <path d="M190 250L160 320H352L322 250H190Z" fill="white" />
      <ellipse cx="256" cy="385" rx="150" ry="25" fill="#cc6600" />
    </svg>
  );
}

function VsCodeIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="110" fill="#0c192c" />
      <path d="M370 100L250 200L150 130L100 160L190 256L100 352L150 382L250 312L370 412L420 390V122L370 100Z" fill="#007acc" />
      <path d="M370 100L250 200L370 300V100Z" fill="#1f9cf0" />
    </svg>
  );
}

export function AppGameStore() {
  const [catalog, setCatalog] = useState<AppCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'game' | 'app'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [installingAppId, setInstallingAppId] = useState<string | null>(null);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);
  const [uninstallingAppId, setUninstallingAppId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/apps');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.catalog)) {
          setCatalog(json.catalog);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleInstall = async (appId: string) => {
    setInstallingAppId(appId);
    setNotification(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/install`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotification({
          type: 'success',
          message: json.message || `Đã cài đặt ${appId} thành công! Biểu tượng đã xuất hiện trên Desktop.`,
        });
        await fetchCatalog();
      } else {
        setNotification({
          type: 'error',
          message: json.error || `Không thể cài đặt ${appId}. Vui lòng thử lại.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({
        type: 'error',
        message: `Lỗi kết nối khi cài đặt: ${msg}`,
      });
    } finally {
      setInstallingAppId(null);
    }
  };

  const handleLaunch = async (appId: string) => {
    setLaunchingAppId(appId);
    setNotification(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/launch`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotification({
          type: 'success',
          message: json.message || `Đang khởi chạy ${appId} trên màn hình Desktop!`,
        });
      } else {
        setNotification({
          type: 'error',
          message: json.error || `Không thể khởi chạy ${appId}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({
        type: 'error',
        message: `Lỗi khi khởi chạy: ${msg}`,
      });
    } finally {
      setLaunchingAppId(null);
    }
  };

  const handleUninstall = async (appId: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ ứng dụng ${appId} khỏi Desktop?`)) {
      return;
    }
    setUninstallingAppId(appId);
    setNotification(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/uninstall`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotification({
          type: 'info',
          message: json.message || `Đã gỡ cài đặt ${appId}.`,
        });
        await fetchCatalog();
      }
    } catch {
      // ignore
    } finally {
      setUninstallingAppId(null);
    }
  };

  const renderAppIcon = (id: string, className = "w-8 h-8") => {
    switch (id) {
      case 'roblox':
        return <RobloxIcon className={className} />;
      case 'minecraft':
        return <MinecraftIcon className={className} />;
      case 'supertuxkart':
        return <SuperTuxKartIcon className={className} />;
      case 'doom':
        return <DoomIcon className={className} />;
      case 'steam':
        return <SteamIcon className={className} />;
      case 'telegram':
        return <TelegramIcon className={className} />;
      case 'vlc':
        return <VlcIcon className={className} />;
      case 'vscode':
        return <VsCodeIcon className={className} />;
      default:
        return <Gamepad2 className={`${className} text-[#2f8bff]`} />;
    }
  };

  const robloxItem = catalog.find((c) => c.id === 'roblox');
  const otherApps = catalog.filter((c) => c.id !== 'roblox');

  const filteredApps = otherApps.filter((app) => {
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'game' && app.category === 'game') ||
      (activeCategory === 'app' && (app.category === 'app' || app.category === 'tool'));
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.shortDesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#0d1424] to-[#070b14] border border-red-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-red-950/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-600/30">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Kho Ứng Dụng & Trò Chơi (App & Game Store)
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                ROBLOX SẴN SÀNG
              </span>
            </h3>
            <p className="text-xs text-[#8a99ad]">
              Tất cả ứng dụng và trò chơi đều có sẵn trong kho, <strong>chỉ cài đặt khi bạn nhấn nút &quot;Cài đặt&quot;</strong> để tối ưu dung lượng và bộ nhớ máy ảo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchCatalog}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070b14] hover:bg-[#1e2a44] text-xs text-[#8a99ad] hover:text-white border border-[#1e2a44] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới kho</span>
        </button>
      </div>

      {/* Global Action Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : notification.type === 'error'
              ? 'bg-red-500/10 border-red-500/40 text-red-300'
              : 'bg-[#2f8bff]/10 border-[#2f8bff]/40 text-[#2f8bff]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-[#2f8bff]" />
            )}
            <span className="font-medium leading-relaxed">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[#8a99ad] hover:text-white text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* FEATURED SPOTLIGHT: ROBLOX APP (Always present, installs only on button click!) */}
      {robloxItem && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-950/50 via-[#0d1424] to-[#070b14] p-5 sm:p-6 shadow-2xl shadow-red-950/20">
          <div className="absolute top-0 right-0 px-4 py-1 bg-gradient-to-l from-red-600 to-rose-600 text-white font-black text-[10px] tracking-widest uppercase rounded-bl-xl shadow-md">
            TRÒ CHƠI NỔI BẬT • ĐƯỢC YÊU CẦU
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Left: Roblox Identity */}
            <div className="flex items-start gap-4">
              <div className="relative p-1 rounded-2xl bg-[#111216] border border-red-500/40 shadow-xl shadow-red-600/10 shrink-0">
                <RobloxIcon className="w-16 h-16 sm:w-20 sm:h-20" />
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-600 text-white border border-red-400/50 shadow">
                  3D
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {robloxItem.name}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                    {robloxItem.publisher}
                  </span>
                  {robloxItem.isInstalled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> ĐÃ CÀI ĐẶT TRÊN DESKTOP
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      CHƯA CÀI ĐẶT (NHẤN ĐỂ CÀI)
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-[#c0ccdc] leading-relaxed max-w-2xl">
                  {robloxItem.description}
                </p>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-[#8a99ad] flex-wrap font-mono">
                  <span>Dung lượng: <strong className="text-white">{robloxItem.size}</strong></span>
                  <span>•</span>
                  <span>Nền tảng: <strong className="text-[#42d6a0]">Roblox Thật Chính Hãng (Không giả lập)</strong></span>
                  <span>•</span>
                  <span>Lối tắt Desktop: <strong className="text-[#2f8bff]">/home/Administrator/Desktop/Roblox.desktop</strong></span>
                </div>
              </div>
            </div>

            {/* Right: Explicit Install / Launch Action Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
              {robloxItem.isInstalled ? (
                <>
                  <button
                    type="button"
                    disabled={launchingAppId === 'roblox'}
                    onClick={() => handleLaunch('roblox')}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{launchingAppId === 'roblox' ? 'Đang mở Roblox...' : '▶ Khởi chạy Roblox'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={uninstallingAppId === 'roblox'}
                    onClick={() => handleUninstall('roblox')}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-[#070b14] hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
                    title="Gỡ cài đặt Roblox và xóa biểu tượng"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={installingAppId === 'roblox'}
                  onClick={() => handleInstall('roblox')}
                  className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm transition-all shadow-xl shadow-red-600/30 hover:shadow-red-600/50 hover:scale-[1.02] cursor-pointer disabled:opacity-60"
                >
                  {installingAppId === 'roblox' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Đang tải & cài đặt Roblox...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Cài đặt Roblox ngay ({robloxItem.size})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for More Apps */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center bg-[#070b14] p-1 rounded-xl border border-[#1e2a44] text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-[#2f8bff] text-white shadow-sm'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            Tất cả ứng dụng
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('game')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeCategory === 'game'
                ? 'bg-[#2f8bff] text-white shadow-sm'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            Trò chơi (Games)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('app')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeCategory === 'app'
                ? 'bg-[#2f8bff] text-white shadow-sm'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            Ứng dụng tiện ích
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#8a99ad] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm game, ứng dụng..."
            className="bg-[#070b14] border border-[#1e2a44] rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-[#8a99ad] focus:outline-none focus:border-[#2f8bff] w-48 sm:w-64"
          />
        </div>
      </div>

      {/* Catalog Grid for other games and apps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className="p-4 rounded-xl bg-[#070b14] border border-[#1e2a44] hover:border-[#2f8bff]/40 transition-all flex flex-col justify-between gap-3 shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-xl bg-[#0a101d] border border-[#1e2a44] shadow">
                  {renderAppIcon(app.id, 'w-10 h-10')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-white text-sm tracking-tight">{app.name}</h5>
                    {app.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1e2a44] text-[#42d6a0] border border-[#1e2a44]">
                        {app.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8a99ad] font-mono">
                    {app.publisher} • {app.size} • {app.categoryLabel}
                  </div>
                </div>
              </div>

              {app.isInstalled ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Đã cài
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#8a99ad] bg-[#0d1424] border border-[#1e2a44] shrink-0">
                  Chưa cài
                </span>
              )}
            </div>

            <p className="text-xs text-[#8a99ad] leading-relaxed line-clamp-2">
              {app.description}
            </p>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1e2a44]/60">
              <span className="text-[10px] font-mono text-[#8a99ad]">
                Loại: <strong className="text-white">{app.type.toUpperCase()}</strong>
              </span>

              <div className="flex items-center gap-2">
                {app.isInstalled ? (
                  <>
                    <button
                      type="button"
                      disabled={launchingAppId === app.id}
                      onClick={() => handleLaunch(app.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{launchingAppId === app.id ? 'Đang mở...' : 'Mở'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={uninstallingAppId === app.id}
                      onClick={() => handleUninstall(app.id)}
                      className="p-1.5 rounded-lg bg-[#0d1424] hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                      title="Gỡ cài đặt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={installingAppId === app.id}
                    onClick={() => handleInstall(app.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2f8bff] hover:bg-[#2573d9] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2f8bff]/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {installingAppId === app.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang cài...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Cài đặt</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
