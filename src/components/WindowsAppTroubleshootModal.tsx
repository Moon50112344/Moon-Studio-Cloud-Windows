import React from 'react';
import {
  X,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  Server,
  Network,
  Copy,
  Check,
  RotateCw,
  Smartphone,
  Key,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#0d1424] border border-[#1e2a44] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-5 border-b border-[#1e2a44] flex items-center justify-between sticky top-0 bg-[#0d1424]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#2f8bff]/15 border border-[#2f8bff]/30 text-[#2f8bff]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Hướng dẫn kết nối & Khắc phục lỗi (Error 0x204)
              </h3>
              <p className="text-xs text-[#8a99ad]">
                Dành cho Windows App / Remote Desktop trên điện thoại & máy tính
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#8a99ad] hover:text-white hover:bg-[#1e2a44] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs sm:text-sm leading-relaxed text-[#c0ccdc]">
          {/* Section 1: Step by Step */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              1. Các bước nhập đúng trên ứng dụng Remote Desktop / Windows App
            </div>
            <ol className="list-decimal list-inside space-y-2 text-xs text-[#d8e2ee] pl-1">
              <li>
                <strong>PC name (Tên máy tính):</strong> Bắt buộc phải nhập cả IP và PORT dạng:{' '}
                <code className="text-[#42d6a0] font-mono bg-[#070b14] px-2 py-0.5 rounded border border-[#1e2a44]">
                  {publicIp}:{port}
                </code>
                {' '}(Không được bỏ qua phần <code className="text-[#2f8bff] font-mono">:{port}</code>).
              </li>
              <li>
                <strong>User Account:</strong> Nhập chính xác Username là{' '}
                <code className="text-[#2f8bff] font-mono">Administrator</code>.
              </li>
              <li>
                <strong>Password:</strong> Sử dụng nút <em>Sao chép mật khẩu</em> trên web để dán, tránh gõ nhầm ký tự đặc biệt trên bàn phím điện thoại.
              </li>
              <li>
                <strong>Xác nhận chứng chỉ (Rất quan trọng):</strong> Khi ứng dụng hiện bảng thông báo{' '}
                <em>"Certificate can't be verified" (Không thể xác minh chứng chỉ)</em>, hãy tích chọn{' '}
                <strong>"Never ask again for connections to this PC"</strong> rồi bấm <strong>Connect</strong> để vào.
              </li>
              <li>
                <strong>Chọn phiên làm việc (Session Selector):</strong> Khi màn hình XRDP hiện ra với menu thả xuống:
                <ul className="list-disc list-inside pl-3 pt-1 space-y-1 text-[11px] text-[#8a99ad]">
                  <li>
                    <strong className="text-white">Windows 7 QEMU Display:</strong> Kết nối trực tiếp màn hình máy ảo Windows 7 SP1. (Bấm <span className="text-[#42d6a0] font-semibold">OK / Continue</span> để vào ngay).
                  </li>
                  <li>
                    <strong className="text-white">Xorg:</strong> Đăng nhập giao diện đồ họa Linux Debian 12 (nhập Username <code className="text-[#2f8bff]">Administrator</code> và Password).
                  </li>
                </ul>
              </li>
            </ol>
          </div>

          {/* Section 2: Error 0x204 fix */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <RotateCw className="w-4 h-4" />
              2. Nếu gặp lỗi 0x204 hoặc bị kẹt mạng (Blocked Port)
            </div>
            <p className="text-xs text-[#d8e2ee]">
              Một số mạng Wi-Fi hoặc 4G/5G có thể chặn các cổng ngẫu nhiên. Lúc này, bạn chỉ cần bấm nút{' '}
              <strong className="text-white">"Tải lại IP (Reload IP)"</strong> ngay cạnh nút sao chép trên giao diện web. Hệ thống sẽ tự động cấp một cổng kết nối mới hoàn toàn sạch và thông suốt.
            </p>
          </div>

          {/* Section 3: Web-based alternatives */}
          <div className="p-4 rounded-xl bg-[#0a101d] border border-[#1e2a44] space-y-3">
            <div className="flex items-center gap-2 text-[#2f8bff] font-bold text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              3. Phương án trực tiếp trên Web (Không cần cài App)
            </div>
            <p className="text-xs text-[#8a99ad]">
              Bạn có thể sử dụng trực tiếp 2 công cụ có sẵn ngay trên trang web:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-[#070b14] border border-[#1e2a44] space-y-1">
                <span className="font-bold text-white text-xs block">Màn hình trực tiếp máy ảo</span>
                <p className="text-[11px] text-[#8a99ad]">
                  Xem trực tiếp màn hình QEMU Framebuffer của máy ảo và gửi phím tương tác.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#070b14] border border-[#1e2a44] space-y-1">
                <span className="font-bold text-white text-xs block">Cloud Web Shell</span>
                <p className="text-[11px] text-[#8a99ad]">
                  Toàn quyền root terminal điều khiển hệ thống 100% không lo bị chặn cổng.
                </p>
                <button
                  type="button"
                  onClick={scrollToTerminal}
                  className="mt-1 text-[11px] text-[#42d6a0] hover:underline font-semibold cursor-pointer"
                >
                  Mở Web Shell ngay →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e2a44] bg-[#0a101d] flex items-center justify-between">
          <span className="text-[11px] text-[#8a99ad] font-mono">
            Relay: {publicIp}:{port}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#2f8bff] hover:bg-[#2573d9] text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
