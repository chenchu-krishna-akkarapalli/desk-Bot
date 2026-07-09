import { useState } from 'react';
import { ShieldAlert, AlertTriangle, FileWarning, HelpCircle, X } from 'lucide-react';
import { WorkspaceFile } from '../../hooks/useWorkspaceCleaner';

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  affectedFiles: WorkspaceFile[];
}

export default function RiskModal({ isOpen, onClose, onConfirm, affectedFiles }: RiskModalProps) {
  const [confirmText, setConfirmText] = useState('');
  
  if (!isOpen) return null;

  const systemFiles = affectedFiles.filter(f => f.is_system_file);
  const configFiles = affectedFiles.filter(f => !f.is_system_file && (f.name === '.env' || f.name.startsWith('.')));
  const binaries = affectedFiles.filter(f => !f.is_system_file && f.category === 'binaries');

  const canConfirm = confirmText.trim().toUpperCase() === 'FORCE CLEAN';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div 
        className="w-[90%] max-w-xl p-6 rounded-[24px] border border-red-500/30 flex flex-col gap-4 relative overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(20, 10, 10, 0.9)',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.15)'
        }}
      >
        {/* Glow backdrop */}
        <div className="absolute top-[-50px] left-[-50px] w-[200px] h-[200px] bg-red-600/15 rounded-full blur-[80px] pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center animate-pulse">
              <ShieldAlert size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-rounded uppercase tracking-wide">
                Security Intercept: High-Risk Items
              </h2>
              <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                Confirm Deletion of {affectedFiles.length} Flagged Item(s)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/5 text-theme-text-secondary hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning Alert Banner */}
        <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-lg flex gap-2.5 items-start z-10 text-[11px] text-red-200 leading-relaxed">
          <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p>
            <strong>Warning:</strong> You are about to permanently delete critical configuration files (`.env`), system locations, or executable binaries. Silent deletions are blocked for these elements to prevent accidentally breaking your project setups or operating system configurations.
          </p>
        </div>

        {/* Breakdown List */}
        <div className="flex-1 max-h-[220px] overflow-y-auto border border-white/5 rounded-xl bg-black/45 p-3 flex flex-col gap-3 z-10 scrollbar-thin">
          {configFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert size={10} />
                Environment & Config Files ({configFiles.length})
              </span>
              {configFiles.map(file => (
                <div key={file.path} className="text-[10px] p-2 rounded bg-red-500/5 border border-red-500/10 flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono font-bold text-red-300">
                    <span className="truncate max-w-[320px]">{file.name}</span>
                    <span className="shrink-0">{formatBytes(file.size_bytes)}</span>
                  </div>
                  <span className="text-[9px] text-theme-text-tertiary truncate font-mono">{file.path}</span>
                  <span className="text-[8px] font-semibold text-red-400 uppercase font-mono mt-0.5">
                    Risk: Erasing environment variables may break active runtimes.
                  </span>
                </div>
              ))}
            </div>
          )}

          {systemFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                <FileWarning size={10} />
                Protected System Paths ({systemFiles.length})
              </span>
              {systemFiles.map(file => (
                <div key={file.path} className="text-[10px] p-2 rounded bg-amber-500/5 border border-amber-500/10 flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono font-bold text-amber-300">
                    <span className="truncate max-w-[320px]">{file.name}</span>
                    <span className="shrink-0">{formatBytes(file.size_bytes)}</span>
                  </div>
                  <span className="text-[9px] text-theme-text-tertiary truncate font-mono">{file.path}</span>
                  <span className="text-[8px] font-semibold text-amber-400 uppercase font-mono mt-0.5">
                    Impact: Core OS system assets or permissions restricted.
                  </span>
                </div>
              ))}
            </div>
          )}

          {binaries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-extrabold text-orange-400 uppercase tracking-widest flex items-center gap-1">
                <HelpCircle size={10} />
                Binary Executables ({binaries.length})
              </span>
              {binaries.map(file => (
                <div key={file.path} className="text-[10px] p-2 rounded bg-orange-500/5 border border-orange-500/10 flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono font-bold text-orange-300">
                    <span className="truncate max-w-[320px]">{file.name}</span>
                    <span className="shrink-0">{formatBytes(file.size_bytes)}</span>
                  </div>
                  <span className="text-[9px] text-theme-text-tertiary truncate font-mono">{file.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual Confirm Form */}
        <div className="flex flex-col gap-2 z-10">
          <label className="text-[10px] text-theme-text-secondary font-bold uppercase tracking-wider">
            Type <code className="bg-red-500/10 px-1 py-0.5 rounded text-red-400 font-mono text-[9px]">FORCE CLEAN</code> to enable delete:
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type FORCE CLEAN..."
              className="flex-1 bg-black/40 border border-red-500/20 rounded-lg p-2.5 text-xs text-white placeholder-red-500/20 focus:outline-none focus:border-red-500/50 uppercase font-mono"
            />
            <button
              onClick={() => {
                if (canConfirm) {
                  onConfirm();
                }
              }}
              disabled={!canConfirm}
              className="px-4 py-2.5 text-xs font-bold rounded-lg bg-red-600 border border-red-500/50 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-lg transition duration-200 cursor-pointer shrink-0"
            >
              Confirm and Purge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
