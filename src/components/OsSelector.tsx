import React from 'react';
import { Check, AlertTriangle, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import { SupportedOsId, OsDefinition } from '../server/imageManager';

interface OsSelectorProps {
  selectedOs: SupportedOsId;
  onSelectOs: (osId: SupportedOsId) => void;
  osList: OsDefinition[];
  disabled?: boolean;
}

export function DebianLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="48" fill="#D70A53" fillOpacity="0.1" stroke="#D70A53" strokeWidth="2" />
      {/* Debian Swirl representation */}
      <path
        d="M50 20C34 20 22 32 22 47C22 60 30 70 41 74C37 68 35 61 36 54C37 45 44 38 53 38C61 38 67 43 68 50C69 56 66 61 62 64C59 66 56 66 54 65C52 64 51 62 52 60C53 58 55 58 57 59C58 59 59 58 59 57C59 54 55 51 51 52C46 53 43 58 44 63C45 69 50 74 57 74C65 74 72 68 73 60C74 50 67 41 57 41C45 41 35 50 34 62C33 72 40 82 50 82C66 82 78 69 78 52C78 34 66 20 50 20Z"
        fill="#D70A53"
      />
    </svg>
  );
}

export function Windows7Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Windows 7 curved 4-color flag */}
      <path
        d="M18 24C28 20 38 28 48 24V48C38 52 28 44 18 48V24Z"
        fill="#F25022"
      />
      <path
        d="M52 24C62 20 72 28 82 24V48C72 52 62 44 52 48V24Z"
        fill="#7FBA00"
      />
      <path
        d="M18 52C28 48 38 56 48 52V76C38 80 28 72 18 76V52Z"
        fill="#00A4EF"
      />
      <path
        d="M52 52C62 48 72 56 82 52V76C72 80 62 72 52 76V52Z"
        fill="#FFB900"
      />
    </svg>
  );
}

export function OsSelector({ selectedOs, onSelectOs, osList, disabled = false }: OsSelectorProps) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold tracking-wider text-[#8a99ad] uppercase">
          Chọn hệ điều hành (Operating System)
        </label>
        <span className="text-[11px] text-[#8a99ad]/70 font-mono">
          2 Hệ điều hành được hỗ trợ
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {osList.map((os) => {
          const isSelected = selectedOs === os.id;
          const isWin7 = os.id === 'windows-7';

          return (
            <button
              key={os.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectOs(os.id)}
              className={`relative text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#0f1b33] border-[#2f8bff] ring-1 ring-[#2f8bff]/50 shadow-lg shadow-[#2f8bff]/10'
                  : 'bg-[#0a101d] border-[#1e2a44] hover:border-[#2f8bff]/60 hover:bg-[#0d1526]'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Selected Checkmark Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#2f8bff] text-white flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              )}

              <div>
                {/* Header with Icon and Name */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1.5 rounded-lg bg-[#070b14] border border-[#1e2a44]">
                    {isWin7 ? <Windows7Logo className="w-7 h-7" /> : <DebianLogo className="w-7 h-7" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {os.name}
                      </h3>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#1e2a44] text-[#8a99ad]">
                        {os.arch}
                      </span>
                    </div>
                    <p className="text-xs text-[#8a99ad] font-medium">
                      Phiên bản: {os.version}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#8a99ad]/90 leading-relaxed mb-3 line-clamp-2">
                  {os.description}
                </p>
              </div>

              {/* Status and Requirements Footer */}
              <div className="pt-2 border-t border-[#1e2a44]/60 flex items-center justify-between text-[11px]">
                {isWin7 ? (
                  <div className="flex items-center gap-1 text-amber-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>End of Support (EOS)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[#42d6a0] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Active LTS Support</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[#8a99ad]/70 font-mono">
                  <span>RAM: {os.minRamMb}MB+</span>
                  <span>•</span>
                  <span>Disk: {os.minDiskGb}GB+</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
