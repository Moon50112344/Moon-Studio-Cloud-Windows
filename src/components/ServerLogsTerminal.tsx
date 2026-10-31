import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Activity,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  vmId?: string;
  eventId?: number | string;
  metadata?: Record<string, unknown>;
}

export function ServerLogsTerminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;

  // Real-time SSE Connection with auto-reconnect
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      setConnectionStatus('CONNECTING');
      const es = new EventSource('/api/v1/logs/stream');
      eventSourceRef.current = es;

      es.addEventListener('open', () => {
        setConnectionStatus('CONNECTED');
      });

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const initData: LogEntry[] = JSON.parse(e.data);
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newEntries = initData.filter((l) => !existingIds.has(l.id));
            return [...prev, ...newEntries].slice(-500);
          });
        } catch {
          // ignore parse error
        }
      });

      es.onmessage = (e: MessageEvent) => {
        if (isPausedRef.current) return;
        try {
          const entry: LogEntry = JSON.parse(e.data);
          setLogs((prev) => {
            if (prev.some((l) => l.id === entry.id)) return prev;
            return [...prev, entry].slice(-500);
          });
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        setConnectionStatus('DISCONNECTED');
        es.close();
        // Auto-reconnect after 3s
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  // Auto-scroll to latest log if not paused
  useEffect(() => {
    if (!isPaused && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  // Load historical logs if needed
  const fetchHistoricalLogs = async () => {
    try {
      const res = await fetch('/api/v1/logs?limit=200');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.logs)) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const combined = [...json.logs.filter((l: LogEntry) => !existingIds.has(l.id)), ...prev];
            return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-500);
          });
        }
      }
    } catch {
      // ignore
    }
  };

  // Clear View (only clears UI, does not affect server file)
  const handleClearView = () => {
    setLogs([]);
  };

  // Copy Logs to Clipboard
  const handleCopyLogs = async () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] [${l.component}]${l.eventId ? ` [Event:${l.eventId}]` : ''} ${l.message}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Trigger Real System Diagnostic
  const handleTriggerDiagnostic = async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/v1/logs/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsSimulating(false), 500);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
    const matchesSearch =
      searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.component.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.eventId && String(log.eventId).includes(searchQuery));
    return matchesLevel && matchesSearch;
  });

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return isoString;
    }
  };

  return (
    <section className="w-full bg-[#0d1424] border border-[#1e2a44] rounded-xl overflow-hidden shadow-2xl flex flex-col mt-6 font-sans">
      {/* Header Bar */}
      <header className="px-4 py-3 bg-[#0a101d] border-b border-[#1e2a44] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-[#2f8bff]" />
          <h2 className="text-sm font-semibold text-white tracking-wide">
            Hệ thống Server Logs & Windows RDP Diagnostic
          </h2>
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-xs font-mono border border-[#1e2a44] bg-[#070b14]">
            {connectionStatus === 'CONNECTED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#42d6a0] animate-pulse" />
                <span className="text-[#42d6a0] text-[11px] font-medium">LIVE STREAM</span>
              </>
            ) : connectionStatus === 'CONNECTING' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-amber-400 text-[11px]">CONNECTING</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 text-[11px]">RECONNECTING</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:text-white hover:border-[#2f8bff]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>

          <button
            type="button"
            onClick={handleClearView}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#1e2a44] bg-[#070b14] text-[#8a99ad] hover:text-white hover:border-[#2f8bff] transition-colors"
            title="Chỉ xóa màn hình hiển thị, không xóa dữ liệu trên máy chủ"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa màn hình
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#1e2a44] bg-[#070b14] text-[#8a99ad] hover:text-white hover:border-[#2f8bff] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#42d6a0]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Đã sao chép' : 'Sao chép logs'}
          </button>

          <button
            type="button"
            onClick={fetchHistoricalLogs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#1e2a44] bg-[#070b14] text-[#8a99ad] hover:text-white hover:border-[#2f8bff] transition-colors"
            title="Nạp lại nhật ký lịch sử từ máy chủ"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Lịch sử
          </button>
        </div>
      </header>

      {/* Filter & Diagnostic Bar */}
      <div className="px-4 py-2.5 bg-[#080d18] border-b border-[#1e2a44] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Level Filters */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#8a99ad]" />
          {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedLevel === lvl
                  ? lvl === 'ERROR'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : lvl === 'WARN'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : lvl === 'DEBUG'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'bg-[#2f8bff]/20 text-[#2f8bff] border border-[#2f8bff]/40'
                  : 'text-[#8a99ad] hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search Input & Diagnostic Simulation Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#8a99ad] absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm log / Event ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#070b14] border border-[#1e2a44] rounded pl-7 pr-2 py-1 text-xs text-white placeholder-[#8a99ad]/50 focus:outline-none focus:border-[#2f8bff] w-48 sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleTriggerDiagnostic}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e2a44]/70 hover:bg-[#1e2a44] border border-[#2f8bff]/30 text-[#2f8bff] text-[11px] font-medium transition-colors"
              title="Chạy kiểm tra trạng thái RAM và cổng mạng thật của máy chủ"
            >
              <Activity className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
              Kiểm tra trạng thái thật
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div
        className="bg-[#080d18] p-4 font-mono text-xs overflow-y-auto max-h-[380px] min-h-[220px] space-y-1.5 selection:bg-[#2f8bff]/30"
        tabIndex={0}
        aria-label="Server Logs Stream"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-[#8a99ad]/60 font-mono">
            {logs.length === 0
              ? 'Đang lắng nghe luồng log thời gian thực từ Hypervisor và Windows RDP Host...'
              : 'Không có log phù hợp với bộ lọc hiện tại.'}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const levelColor =
              log.level === 'ERROR'
                ? 'text-red-400'
                : log.level === 'WARN'
                ? 'text-amber-400'
                : log.level === 'DEBUG'
                ? 'text-purple-400'
                : 'text-[#42d6a0]';

            const badgeBg =
              log.level === 'ERROR'
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : log.level === 'WARN'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : log.level === 'DEBUG'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

            return (
              <div key={log.id} className="flex items-start gap-2 hover:bg-[#0d1424]/60 py-0.5 px-1 rounded transition-colors leading-relaxed">
                <span className="text-[#8a99ad]/60 shrink-0 select-none">
                  {formatTime(log.timestamp)}
                </span>

                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 uppercase ${badgeBg}`}>
                  {log.level}
                </span>

                <span className="text-[#2f8bff] font-semibold shrink-0">
                  [{log.component}]
                </span>

                {log.eventId && (
                  <span className="px-1 py-0.2 rounded text-[10px] bg-[#1e2a44] text-white border border-[#2f8bff]/30 shrink-0 font-semibold">
                    Event:{log.eventId}
                  </span>
                )}

                <span className={`break-all ${levelColor === 'text-[#42d6a0]' ? 'text-[#d1d5db]' : levelColor}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Footer Status Bar */}
      <footer className="px-4 py-2 bg-[#0a101d] border-t border-[#1e2a44] flex items-center justify-between text-[11px] text-[#8a99ad]">
        <span>Hiển thị: {filteredLogs.length} / {logs.length} bản ghi</span>
        <span className="font-mono text-[#8a99ad]/70">
          Subsystem: TerminalServices • QEMU/Hypervisor • Network Relay
        </span>
      </footer>
    </section>
  );
}
