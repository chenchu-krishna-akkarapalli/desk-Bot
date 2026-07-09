import { useEffect } from 'react';
import { Box, Shield, FileSearch, Send, Info } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSandboxStore } from '../store/useSandboxStore';

export default function SandboxPanel() {
  const {
    logs,
    isLaunching,
    selectedFilePath,
    setSelectedFilePath,
    fetchLogs,
    launchSandbox
  } = useSandboxStore();

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleBrowseFile = async () => {
    try {
      const file = await open({
        multiple: false,
        directory: false,
        title: 'Select File for Sandboxing',
      });
      if (file && typeof file === 'string') {
        setSelectedFilePath(file);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleLaunch = () => {
    launchSandbox();
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mt-5">
      {/* Configuration Card */}
      <div 
        className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-2"
        style={{
          borderImage: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
          background: 'var(--theme-card-bg)'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.06)_0%,rgba(0,0,0,0)_70%)]" />
        
        <div className="z-10 flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between">
            <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Box size={16} className="text-purple-400" />
              Disposable File Sandbox
            </h3>
            
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase select-none">
              HYPERVISOR ISOLATION
            </span>
          </div>

          <p className="text-xs text-theme-text-secondary leading-relaxed">
            Safely execute untrusted scripts or inspect suspicious files. DeskWell dynamically builds a Windows Sandbox 
            XML profile (`.wsb`), sharing the target file's parent folder as a **Read-Only mount** inside a temporary container.
          </p>

          {/* File Picker input */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-bold text-theme-text-secondary uppercase select-none">Selected Isolation File</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="No file selected. Select a file to inspect..."
                value={selectedFilePath}
                className="flex-1 bg-black/35 border border-white/5 rounded-xl px-4 py-2 text-xs text-white placeholder-theme-text-tertiary focus:outline-none"
              />
              <button
                onClick={handleBrowseFile}
                className="px-4 py-2 bg-white/5 border border-white/8 hover:bg-white/10 rounded-xl text-xs font-bold text-white cursor-pointer transition flex items-center gap-1.5 shrink-0"
              >
                <FileSearch size={14} />
                Browse File
              </button>
            </div>
          </div>

          {/* Warning guidelines */}
          <div className="flex gap-2.5 bg-black/20 border border-white/5 p-3.5 rounded-xl text-[10px] text-theme-text-secondary leading-snug">
            <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 select-none">
              <span className="font-bold text-white uppercase text-[8px] tracking-wide">Usage Requirements</span>
              <span>Requires **Windows Sandbox** feature enabled in "Windows Features" (available on Windows 10/11 Pro, Enterprise, and Education editions).</span>
              <span className="text-purple-300 font-medium">Mount protection: The sandbox runs with absolute guest segregation. Host files cannot be written or modified by the container.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mt-5 z-10">
          <button
            onClick={handleLaunch}
            disabled={!selectedFilePath || isLaunching}
            className={`px-5 py-2.5 rounded-full font-bold text-xs cursor-pointer transition flex items-center gap-1.5 shadow-lg select-none ${
              !selectedFilePath || isLaunching
                ? 'bg-purple-900/10 text-purple-700 border border-purple-900/20 cursor-not-allowed'
                : 'bg-purple-500 hover:bg-purple-600 text-white hover:shadow-purple-500/10'
            }`}
          >
            <Send size={13} />
            {isLaunching ? 'Launching Container...' : 'Launch Disposable Sandbox'}
          </button>
        </div>
      </div>

      {/* Sandbox Isolation Logs Card */}
      <div 
        className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-1"
        style={{
          borderImage: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
          background: 'var(--theme-card-bg)'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08)_0%,rgba(0,0,0,0)_70%)]" />
        
        <div className="flex flex-col gap-4 w-full h-full z-10">
          <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2 select-none">
            <Shield size={16} className="text-purple-400" />
            Sandbox Audit
          </h3>

          {/* Static details */}
          <div className="flex items-center gap-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 select-none">
            <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-purple-500 text-purple-400 shrink-0">
              <Box size={24} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wide">Isolation Sandbox</span>
              <span className="text-[9px] text-theme-text-secondary leading-snug">
                Transient VM boots a pristine environment that is destroyed upon exit.
              </span>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="flex-1 flex flex-col gap-2 mt-1">
            <span className="text-[9px] font-bold text-theme-text-tertiary uppercase tracking-wider select-none">Isolation History</span>
            
            <div className="flex-1 max-h-[140px] overflow-y-auto flex flex-col gap-2 border border-white/5 rounded-xl bg-black/35 p-3 font-mono text-[9px]">
              {logs.length === 0 ? (
                <div className="text-center text-theme-text-tertiary my-auto py-8">
                  Audit log is empty. Sandbox launches will log here.
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex flex-col gap-0.5 border-b border-white/5 pb-1.5 last:border-b-0 last:pb-0 text-theme-text-secondary">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
