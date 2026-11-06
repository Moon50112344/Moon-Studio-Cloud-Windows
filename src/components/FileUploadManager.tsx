import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FolderUp,
  PlayCircle,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Folder,
  Monitor,
  Download,
  FileText,
  File,
  Layers,
  Terminal,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Gamepad2,
} from 'lucide-react';
import { AppGameStore } from './AppGameStore';

interface FileItem {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  isDirectory: boolean;
  modifiedAt: string;
  extension: string;
  isExecutable: boolean;
}

interface UploadResult {
  fileName: string;
  filePath: string;
  fileSizeFormatted: string;
  targetDir: string;
  autoExecuted?: boolean;
  executionResult?: {
    success: boolean;
    output: string;
    pid?: number;
    command?: string;
  };
}

export function FileUploadManager() {
  const [activeTab, setActiveTab] = useState<'folder' | 'install' | 'explorer' | 'appstore'>('folder');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [presetDir, setPresetDir] = useState<string>('/home/Administrator/Desktop');
  const [customDir, setCustomDir] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // File explorer state
  const [explorerDir, setExplorerDir] = useState<string>('/home/Administrator/Desktop');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [executingFile, setExecutingFile] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetDirectory = presetDir === 'custom' ? customDir : presetDir;

  const fetchFileList = async (dirToFetch: string) => {
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/v1/files/list?dir=${encodeURIComponent(dirToFetch)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.files)) {
          setFileList(json.files);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchFileList(explorerDir);
    }
  }, [activeTab, explorerDir]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null);
      setErrorMessage(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn một tệp tin trước khi tải lên.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setErrorMessage(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', activeTab === 'install' ? 'install' : 'folder');
    formData.append('targetDir', activeTab === 'install' ? '/home/Administrator/Downloads' : targetDirectory);

    try {
      setUploadProgress(60);
      const res = await fetch('/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(90);
      const json = await res.json();

      if (res.ok && json.success) {
        setUploadResult(json.file);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh explorer if directory matches
        fetchFileList(explorerDir);
      } else {
        setErrorMessage(json.error || 'Có lỗi xảy ra khi tải lên tệp tin.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Lỗi mạng tải lên: ${msg}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleExecuteFile = async (filePath: string) => {
    setExecutingFile(filePath);
    setActionNotice(null);
    try {
      const res = await fetch('/api/v1/files/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice(json.output || `Đã khởi chạy tệp ${filePath}!`);
      } else {
        setActionNotice(`Lỗi thực thi: ${json.error || 'Không thể chạy tệp tin'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionNotice(`Lỗi kết nối: ${msg}`);
    } finally {
      setExecutingFile(null);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tệp ${filePath}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/files?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchFileList(explorerDir);
      }
    } catch {
      // ignore
    }
  };

  return (
    <section className="bg-[#0d1424] border border-[#1e2a44] rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Title & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2a44] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#2f8bff]/20 to-[#42d6a0]/20 border border-[#2f8bff]/40 text-[#2f8bff]">
            <Upload className="w-5 h-5 text-[#42d6a0]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Quản lý & Tải tệp lên máy chủ
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#42d6a0]/20 text-[#42d6a0] border border-[#42d6a0]/40">
                2 CHẾ ĐỘ
              </span>
            </h2>
            <p className="text-xs text-[#8a99ad]">
              Tải tệp trực tiếp vào thư mục máy tính từ xa hoặc tự động cài đặt / khởi chạy tệp (.exe, .deb, .sh)
            </p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex items-center bg-[#070b14] p-1 rounded-xl border border-[#1e2a44] text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('folder');
              setUploadResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'folder'
                ? 'bg-[#2f8bff] text-white shadow-md shadow-[#2f8bff]/30'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            <FolderUp className="w-4 h-4" />
            <span>1. Tải vào thư mục</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('install');
              setUploadResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'install'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>2. Tự động cài đặt (.exe)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('explorer');
              setUploadResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'explorer'
                ? 'bg-[#1e2a44] text-white border border-[#2f8bff]/40'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Danh sách tệp</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('appstore');
              setUploadResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'appstore'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white shadow-md shadow-red-500/30'
                : 'text-[#8a99ad] hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-rose-300" />
            <span>Cài ứng dụng trò chơi</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-red-500/30 text-rose-200 border border-red-400/40">
              ROBLOX
            </span>
          </button>
        </div>
      </div>

      {/* Mode 1: Upload to Directory */}
      {activeTab === 'folder' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-3 rounded-xl bg-[#2f8bff]/10 border border-[#2f8bff]/30 text-xs text-[#c0ccdc] flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#2f8bff] shrink-0" />
              Tệp được tải lên sẽ xuất hiện ngay lập tức trên màn hình Remote Desktop của bạn.
            </span>
            <span className="font-mono text-[#2f8bff] font-bold shrink-0 text-[11px]">
              Tự động cấp quyền 0755
            </span>
          </div>

          {/* Directory Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#42d6a0]" />
              Chọn thư mục đích lưu trữ trên máy chủ:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPresetDir('/home/Administrator/Desktop')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  presetDir === '/home/Administrator/Desktop'
                    ? 'bg-[#2f8bff]/15 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:border-[#2f8bff]/50'
                }`}
              >
                <Monitor className={`w-5 h-5 ${presetDir === '/home/Administrator/Desktop' ? 'text-[#2f8bff]' : ''}`} />
                <div>
                  <div className="font-bold text-xs text-white">Màn hình Desktop</div>
                  <div className="text-[10px] text-[#8a99ad] font-mono">/home/Administrator/Desktop</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPresetDir('/home/Administrator/Downloads')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  presetDir === '/home/Administrator/Downloads'
                    ? 'bg-[#2f8bff]/15 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:border-[#2f8bff]/50'
                }`}
              >
                <Download className={`w-5 h-5 ${presetDir === '/home/Administrator/Downloads' ? 'text-[#42d6a0]' : ''}`} />
                <div>
                  <div className="font-bold text-xs text-white">Thư mục Downloads</div>
                  <div className="text-[10px] text-[#8a99ad] font-mono">/home/Administrator/Downloads</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPresetDir('/home/Administrator/Documents')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  presetDir === '/home/Administrator/Documents'
                    ? 'bg-[#2f8bff]/15 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:border-[#2f8bff]/50'
                }`}
              >
                <FileText className={`w-5 h-5 ${presetDir === '/home/Administrator/Documents' ? 'text-amber-400' : ''}`} />
                <div>
                  <div className="font-bold text-xs text-white">Thư mục Documents</div>
                  <div className="text-[10px] text-[#8a99ad] font-mono">/home/Administrator/Documents</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Auto-Install / Run */}
      {activeTab === 'install' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 text-xs text-[#d8e2ee] space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-xs">
              <Zap className="w-4 h-4" />
              Tự động cài đặt / Khởi chạy tệp tin (.exe, .msi, .deb, .sh)
            </div>
            <p className="text-xs text-[#c0ccdc] leading-relaxed">
              Hệ thống sẽ tự động phân loại tệp tin:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-[#8a99ad] pl-1">
              <li>
                <strong className="text-white">Tệp Windows (.exe, .msi):</strong> Tự động gọi trình biên dịch <strong>Wine</strong> khởi chạy giao diện cài đặt và tạo biểu tượng truy cập nhanh trên màn hình Desktop!
              </li>
              <li>
                <strong className="text-white">Gói Linux (.deb):</strong> Tự động kích hoạt <strong>apt-get</strong> cài đặt hoàn chỉnh vào hệ thống.
              </li>
              <li>
                <strong className="text-white">Tập lệnh (.sh, .run):</strong> Tự động cấp quyền thực thi <code className="text-[#42d6a0]">chmod +x</code> và chạy ngầm.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* File Dropzone for Mode 1 & Mode 2 */}
      {activeTab !== 'explorer' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
              isDragging
                ? 'border-[#2f8bff] bg-[#2f8bff]/10 scale-[1.01]'
                : selectedFile
                ? 'border-[#42d6a0]/60 bg-[#42d6a0]/5'
                : 'border-[#1e2a44] bg-[#070b14]/70 hover:border-[#2f8bff]/50 hover:bg-[#070b14]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="p-3.5 rounded-2xl bg-[#0a101d] border border-[#1e2a44] text-[#2f8bff] shadow-lg">
              {activeTab === 'install' ? (
                <Zap className="w-7 h-7 text-amber-400" />
              ) : (
                <FolderUp className="w-7 h-7 text-[#42d6a0]" />
              )}
            </div>

            <div className="text-center space-y-1">
              {selectedFile ? (
                <div>
                  <span className="font-bold text-white text-sm block">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs font-mono text-[#42d6a0]">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-semibold text-white text-sm block">
                    Kéo thả tệp vào đây hoặc <span className="text-[#2f8bff] underline">chọn từ thiết bị</span>
                  </span>
                  <span className="text-xs text-[#8a99ad]">
                    {activeTab === 'install'
                      ? 'Hỗ trợ tệp: .exe, .msi, .deb, .sh, .run (Tối đa 500MB)'
                      : 'Hỗ trợ tất cả các định dạng tệp: tài liệu, nén, hình ảnh, mã nguồn (Tối đa 500MB)'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button & Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#8a99ad] font-mono">
              Đích lưu: <span className="text-white font-semibold">{activeTab === 'install' ? '/home/Administrator/Downloads' : targetDirectory}</span>
            </span>

            <button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'install'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
                  : 'bg-[#2f8bff] hover:bg-[#2573d9] text-white shadow-[#2f8bff]/20'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải lên ({uploadProgress}%)...</span>
                </>
              ) : activeTab === 'install' ? (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Tải lên & Tự động chạy (.exe)</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Tải tệp vào thư mục</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Result Card */}
          {uploadResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tải lên hoàn tất: {uploadResult.fileName} ({uploadResult.fileSizeFormatted})</span>
                </div>
                <span className="font-mono text-[#8a99ad] text-[11px] bg-[#070b14] px-2 py-0.5 rounded border border-[#1e2a44]">
                  {uploadResult.targetDir}
                </span>
              </div>

              {uploadResult.executionResult && (
                <div className="mt-2 p-3 rounded-lg bg-[#070b14] border border-[#1e2a44] space-y-1.5 font-mono text-[11px]">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Kết quả thực thi tự động:
                  </div>
                  <pre className="text-emerald-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-32">
                    {uploadResult.executionResult.output}
                  </pre>
                  {uploadResult.executionResult.pid && (
                    <div className="text-[#8a99ad] text-[10px]">
                      Process ID: {uploadResult.executionResult.pid} | Command: {uploadResult.executionResult.command}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 3: File Explorer / Management */}
      {activeTab === 'explorer' && (
        <div className="space-y-4 animate-fade-in">
          {/* Directory Picker for Explorer */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#8a99ad]">Thư mục:</span>
              <button
                type="button"
                onClick={() => setExplorerDir('/home/Administrator/Desktop')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                  explorerDir === '/home/Administrator/Desktop'
                    ? 'bg-[#2f8bff]/20 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:text-white'
                }`}
              >
                /Desktop
              </button>
              <button
                type="button"
                onClick={() => setExplorerDir('/home/Administrator/Downloads')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                  explorerDir === '/home/Administrator/Downloads'
                    ? 'bg-[#2f8bff]/20 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:text-white'
                }`}
              >
                /Downloads
              </button>
              <button
                type="button"
                onClick={() => setExplorerDir('/home/Administrator/Documents')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                  explorerDir === '/home/Administrator/Documents'
                    ? 'bg-[#2f8bff]/20 border-[#2f8bff] text-white'
                    : 'bg-[#070b14] border-[#1e2a44] text-[#8a99ad] hover:text-white'
                }`}
              >
                /Documents
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchFileList(explorerDir)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#070b14] border border-[#1e2a44] text-xs text-[#8a99ad] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {actionNotice && (
            <div className="p-3 rounded-lg bg-[#070b14] border border-[#2f8bff]/40 text-xs font-mono text-[#42d6a0] flex items-center justify-between">
              <span>{actionNotice}</span>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-[#8a99ad] hover:text-white ml-2 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Files List Table */}
          <div className="bg-[#070b14] border border-[#1e2a44] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1e2a44] bg-[#0a101d] text-[#8a99ad] font-semibold">
                    <th className="p-3">Tên tệp tin</th>
                    <th className="p-3">Kích thước</th>
                    <th className="p-3">Ngày sửa đổi</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a44]/50">
                  {fileList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[#8a99ad]">
                        {loadingFiles ? 'Đang tải danh sách tệp...' : 'Chưa có tệp tin nào trong thư mục này.'}
                      </td>
                    </tr>
                  ) : (
                    fileList.map((file) => (
                      <tr key={file.path} className="hover:bg-[#0d1424] transition-colors">
                        <td className="p-3 font-medium text-white flex items-center gap-2">
                          {file.isDirectory ? (
                            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : file.isExecutable ? (
                            <PlayCircle className="w-4 h-4 text-[#42d6a0] shrink-0" />
                          ) : (
                            <File className="w-4 h-4 text-[#8a99ad] shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{file.name}</span>
                          {file.isExecutable && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              EXE/SCRIPT
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[#8a99ad]">{file.sizeFormatted}</td>
                        <td className="p-3 text-[#8a99ad] font-mono text-[11px]">
                          {new Date(file.modifiedAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {file.isExecutable && (
                            <button
                              type="button"
                              disabled={executingFile === file.path}
                              onClick={() => handleExecuteFile(file.path)}
                              title="Khởi chạy tệp tin (Wine / Script)"
                              className="px-2 py-1 rounded bg-[#42d6a0]/20 hover:bg-[#42d6a0]/30 text-[#42d6a0] border border-[#42d6a0]/40 font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              {executingFile === file.path ? 'Đang chạy...' : '▶ Chạy'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file.path)}
                            title="Xóa tệp tin"
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: App & Game Store (Roblox featured, installs only on button click!) */}
      {activeTab === 'appstore' && <AppGameStore />}
    </section>
  );
}
