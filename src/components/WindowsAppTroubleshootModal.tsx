import React from 'react';
import {
  X,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Server,
  Network,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface WindowsAppTroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicIp: string;
  port: number;
}

export function WindowsAppTroubleshootModal({
  isOpen,
  onClose,
  publicIp,
  port,
}: WindowsAppTroubleshootModalProps) {
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const scrollToTerminal = () => {
    onClose();
    setTimeout(() => {
      document.getElementById('cloud-web-shell')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#0d1424] border border-[#1e2a44] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-5 border-b border-[#1e2a44] flex items-center justify-between sticky top-0 bg-[#0d1424]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Tại sao không thể kết nối bằng Windows App / mstsc?
              </h3>
              <p className="text-xs text-[#8a99ad]">
                Giải thích nguyên nhân kỹ thuật và các phương án kết nối máy chủ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#8a99ad] hover:text-white hover:bg-[#1e2a44] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs sm:text-sm leading-relaxed text-[#c0ccdc]">
          {/* Section 1: The Root Cause */}
          <div className="p-4 rounded-xl bg-[#070b14] border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Network className="w-4 h-4" />
              1. Nguyên nhân kỹ thuật từ hạ tầng Cloud Run
            </div>
            <p className="text-xs text-[#8a99ad]">
              Ứng dụng hiện đang chạy trên môi trường container <strong>Google Cloud Run</strong>. Cấu trúc mạng này có các đặc thù:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs pl-1 text-[#d8e2ee]">
              <li>
                <strong>Cổng TCP 3389 bị chặn từ bên ngoài:</strong> Google Cloud Run chỉ cho phép lưu lượng mạng đi qua giao thức HTTP/HTTPS và WebSocket (Cổng 443). Mọi cổng TCP thô từ bên ngoài (như RDP 3389) bị tường lửa mạng của Google từ chối ngay lập tức.
              </li>
              <li>
                <strong>Địa chỉ IP {publicIp}:</strong> Đây là địa chỉ IP <em>Egress (IP đi ra ngoài)</em> của cụm máy chủ Google Cloud, <strong>không phải IP tĩnh nhận kết nối vào (Ingress IP)</strong>.
              </li>
              <li>
                <strong>Cam kết trung thực 100%:</strong> Chúng tôi tuân thủ nguyên tắc không tạo địa chỉ IP ảo giả mạo hay sinh mã kết nối lừa dối.
              </li>
            </ul>
          </div>

          {/* Section 2: Recommended Solution */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              2. Phương án Khuyên Dùng: Sử dụng Cloud Web Shell (Đang hoạt động)
            </div>
            <p className="text-xs text-emerald-100/90">
              Bạn có thể điều khiển và quản trị máy chủ 100% bằng <strong>Cloud Web Shell</strong> tích hợp sẵn bên dưới. Không cần mở cổng, không bị tường lửa chặn:
            </p>
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#070b14] border border-[#1e2a44]">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-white block">
                  Cloud Web Shell (Toàn quyền Root)
                </span>
                <span className="text-[11px] text-[#8a99ad]">
                  Thực thi bash, chạy tiến trình, tải file, kiểm tra phần cứng trực tiếp
                </span>
              </div>
              <button
                type="button"
                onClick={scrollToTerminal}
                className="px-3 py-1.5 rounded-lg bg-[#42d6a0] hover:bg-[#38b788] text-[#070b14] font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-md shadow-[#42d6a0]/20"
              >
                Mở Web Shell ngay
              </button>
            </div>
          </div>

          {/* Section 3: If you still need mstsc / Remote Desktop */}
          <div className="p-4 rounded-xl bg-[#0a101d] border border-[#1e2a44] space-y-3">
            <div className="flex items-center gap-2 text-[#2f8bff] font-bold text-xs uppercase tracking-wider">
              <Server className="w-4 h-4" />
              3. Nếu bạn bắt buộc muốn dùng ứng dụng Windows App / mstsc
            </div>
            <p className="text-xs text-[#8a99ad]">
              Vì Cloud Run không cấp Public IPv4 riêng để mở port 3389, bạn cần tạo đường hầm TCP qua dịch vụ trung gian (Reverse Tunnel) như <strong>Ngrok</strong> hoặc <strong>Cloudflare Tunnel</strong>:
            </p>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-semibold text-white block">
                Ví dụ mở cổng qua Ngrok trong Web Shell:
              </span>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#070b14] border border-[#1e2a44] font-mono text-xs text-[#42d6a0]">
                <code>curl -s https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz && ./ngrok tcp 3389</code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'ngrok',
                      'curl -s https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz && ./ngrok tcp 3389'
                    )
                  }
                  className="p-1.5 rounded hover:bg-[#1e2a44] text-[#8a99ad] hover:text-white"
                  title="Sao chép lệnh"
                >
                  {copiedCmd === 'ngrok' ? (
                    <Check className="w-4 h-4 text-[#42d6a0]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#8a99ad]">
                Sau khi chạy, Ngrok sẽ cấp địa chỉ dạng <code className="text-[#2f8bff]">tcp.ngrok.io:12345</code> để bạn nhập vào Windows App.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e2a44] bg-[#0a101d] flex items-center justify-between">
          <span className="text-[11px] text-[#8a99ad] font-mono">
            Hạ tầng: Google Cloud Run • Cổng Web: 443 (HTTPS/WSS)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1e2a44] hover:bg-[#28385a] text-white font-medium text-xs transition-colors"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
