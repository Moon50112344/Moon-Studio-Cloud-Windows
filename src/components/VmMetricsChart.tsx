import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Cpu, Layers, Activity, RefreshCw } from 'lucide-react';

interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  memoryMb: number;
  totalMemoryMb: number;
}

interface VmMetricsData {
  success: boolean;
  vmId: string;
  vmName: string;
  cores: number;
  cpuPercent: number;
  memoryMb: number;
  totalMemoryMb: number;
  memoryPercent: number;
  uptimeSeconds: number;
  timestamp: string;
  history: MetricPoint[];
}

interface VmMetricsChartProps {
  vmId?: string;
  vmName?: string;
  cores?: number;
  memoryMb?: number;
}

export function VmMetricsChart({ vmId, vmName, cores = 2, memoryMb = 2048 }: VmMetricsChartProps) {
  const [data, setData] = useState<VmMetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'both' | 'cpu' | 'memory'>('both');
  const [isLive, setIsLive] = useState<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = async () => {
    try {
      const url = vmId ? `/api/v1/vm/metrics?vmId=${encodeURIComponent(vmId)}` : '/api/v1/vm/metrics';
      const res = await fetch(url);
      if (res.ok) {
        const json: VmMetricsData = await res.json();
        if (json.success) {
          setData(json);
        }
      }
    } catch {
      // ignore network hiccup
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (isLive) {
      pollTimerRef.current = setInterval(fetchMetrics, 2500);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [vmId, isLive]);

  const latestCpu = data?.cpuPercent ?? 5;
  const latestMem = data?.memoryPercent ?? 30;
  const currentMemMb = data?.memoryMb ?? 650;
  const currentTotalMemMb = data?.totalMemoryMb ?? memoryMb;
  const currentCores = data?.cores ?? cores;

  const chartData = data?.history && data.history.length > 0 ? data.history : [];

  return (
    <div className="bg-[#070b14] border border-[#1e2a44] rounded-xl p-4 sm:p-5 flex flex-col space-y-4 shadow-inner">
      {/* Metrics Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e2a44]/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#2f8bff]/10 border border-[#2f8bff]/30 text-[#2f8bff]">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                Hiệu Năng vCPU & Bộ Nhớ RAM Thời Gian Thực
              </h4>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#42d6a0]/15 text-[#42d6a0] border border-[#42d6a0]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#42d6a0] animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-[#8a99ad]">
              Dữ liệu tải trực tiếp từ /api/v1/vm/metrics cho máy ảo {vmName || data?.vmName || 'hiện tại'}
            </p>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              viewMode === 'both'
                ? 'bg-[#2f8bff]/20 text-[#2f8bff] border border-[#2f8bff]/40'
                : 'text-[#8a99ad] hover:text-white bg-[#0a101d] border border-[#1e2a44]'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cpu')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              viewMode === 'cpu'
                ? 'bg-[#2f8bff]/20 text-[#2f8bff] border border-[#2f8bff]/40'
                : 'text-[#8a99ad] hover:text-white bg-[#0a101d] border border-[#1e2a44]'
            }`}
          >
            vCPU
          </button>
          <button
            type="button"
            onClick={() => setViewMode('memory')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              viewMode === 'memory'
                ? 'bg-[#42d6a0]/20 text-[#42d6a0] border border-[#42d6a0]/40'
                : 'text-[#8a99ad] hover:text-white bg-[#0a101d] border border-[#1e2a44]'
            }`}
          >
            RAM
          </button>
          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isLive
                ? 'text-[#42d6a0] border-[#42d6a0]/30 bg-[#42d6a0]/10 hover:bg-[#42d6a0]/20'
                : 'text-[#8a99ad] border-[#1e2a44] bg-[#0a101d] hover:text-white'
            }`}
            title={isLive ? 'Đang tự động cập nhật mỗi 2.5 giây' : 'Tạm dừng cập nhật'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLive ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real-time Value Indicators Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* vCPU Card */}
        <div className="bg-[#0a101d] border border-[#1e2a44] rounded-lg p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8a99ad] flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-[#2f8bff]" /> Tải vCPU ({currentCores} Cores)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#2f8bff]">
                {latestCpu}%
              </span>
              <span className="text-[11px] text-[#8a99ad] font-mono">
                {currentCores > 1 ? `${(latestCpu / currentCores).toFixed(1)}% / core` : 'tối đa 100%'}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-[#1e2a44] border-t-[#2f8bff] flex items-center justify-center font-mono text-[11px] text-[#2f8bff] font-bold">
            {latestCpu}%
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-[#0a101d] border border-[#1e2a44] rounded-lg p-3 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8a99ad] flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#42d6a0]" /> Bộ nhớ RAM (Đã dùng)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#42d6a0]">
                {latestMem}%
              </span>
              <span className="text-[11px] text-[#8a99ad] font-mono">
                {currentMemMb} / {currentTotalMemMb} MB
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-[#1e2a44] border-t-[#42d6a0] flex items-center justify-center font-mono text-[11px] text-[#42d6a0] font-bold">
            {latestMem}%
          </div>
        </div>
      </div>

      {/* Recharts Area Chart Container */}
      <div className="w-full h-48 sm:h-52 pt-2">
        {loading && chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#8a99ad] text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#2f8bff]" />
            <span>Đang thu thập dữ liệu vCPU & RAM từ /api/v1/vm/metrics...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2f8bff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2f8bff" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#42d6a0" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#42d6a0" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a44" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#60728c"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#1e2a44' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#60728c"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#1e2a44' }}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const cpuVal = payload.find((p) => p.dataKey === 'cpu')?.value;
                    const memVal = payload.find((p) => p.dataKey === 'memory')?.value;
                    const sample = payload[0]?.payload as MetricPoint;
                    return (
                      <div className="bg-[#0d1424] border border-[#1e2a44] rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                        <div className="text-[10px] text-[#8a99ad] font-mono border-b border-[#1e2a44] pb-1 mb-1">
                          Thời gian: {label}
                        </div>
                        {cpuVal !== undefined && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[#2f8bff] font-semibold flex items-center gap-1">
                              <Cpu className="w-3 h-3" /> vCPU:
                            </span>
                            <span className="font-mono font-bold text-white">{cpuVal}%</span>
                          </div>
                        )}
                        {memVal !== undefined && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[#42d6a0] font-semibold flex items-center gap-1">
                              <Layers className="w-3 h-3" /> RAM:
                            </span>
                            <span className="font-mono font-bold text-white">
                              {memVal}% ({sample?.memoryMb || 0} MB)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {(viewMode === 'both' || viewMode === 'cpu') && (
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#2f8bff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cpuGradient)"
                  isAnimationActive={false}
                  name="vCPU (%)"
                />
              )}
              {(viewMode === 'both' || viewMode === 'memory') && (
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#42d6a0"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#memGradient)"
                  isAnimationActive={false}
                  name="RAM (%)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend & Summary Info */}
      <div className="flex items-center justify-between text-[11px] text-[#8a99ad] pt-2 border-t border-[#1e2a44]/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2f8bff]" />
            <span>vCPU Sử dụng</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#42d6a0]" />
            <span>Bộ nhớ RAM</span>
          </div>
        </div>
        <span className="font-mono text-[#8a99ad]/70 text-[10px]">
          Tần số lấy mẫu: 2.5s • Recharts Live Monitor
        </span>
      </div>
    </div>
  );
}
