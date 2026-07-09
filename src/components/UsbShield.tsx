import { useEffect } from 'react';
import { 
  Usb, Shield, ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useUsbShieldStore } from '../store/useUsbShieldStore';

export default function UsbShield() {
  const {
    config,
    logs,
    isScanning,
    scanningDrive,
    scanProgressFile,
    threatsFoundCount,
    fetchConfig,
    updateConfig,
    fetchLogs,
    initListeners
  } = useUsbShieldStore();

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    
    let unsubscribe: (() => void) | null = null;
    
    initListeners().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchConfig, fetchLogs, initListeners]);

  const handleToggleEnabled = () => {
    updateConfig({ enabled: !config.enabled });
  };

  const handleToggleAutoScan = () => {
    updateConfig({ auto_scan: !config.auto_scan });
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mt-5">
      {/* Configuration Card */}
      <div 
        className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-2"
        style={{
          borderImage: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
          background: 'var(--theme-card-bg)'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(6, 182, 212, 0.06)_0%,rgba(0,0,0,0)_70%)]" />
        
        <div className="z-10 flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between">
            <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              {config.enabled ? (
                <ShieldCheck size={16} className="text-theme-cyan" />
              ) : (
                <ShieldAlert size={16} className="text-rose-400" />
              )}
              USB Auto-Scan Shield
            </h3>
            
            <button
              onClick={handleToggleEnabled}
              className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider cursor-pointer uppercase transition ${
                config.enabled 
                  ? 'bg-theme-cyan/20 text-theme-cyan border border-theme-cyan/30' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {config.enabled ? 'ACTIVE PROTECTION' : 'SHIELD DISABLED'}
            </button>
          </div>

          <p className="text-xs text-theme-text-secondary leading-relaxed">
            Prevent USB-borne malware and worm persistence hooks. DeskWell automatically registers drive mounts, 
            triggers deep directory signature scans, and isolates threats in quarantine instantly.
          </p>

          {/* Toggle buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button
              onClick={handleToggleEnabled}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 select-none ${
                config.enabled
                  ? 'bg-theme-cyan/10 border-theme-cyan/30 text-white'
                  : 'bg-black/20 border-white/5 text-theme-text-secondary hover:bg-white/3'
              }`}
            >
              <Usb size={14} className={config.enabled ? "text-theme-cyan" : "text-theme-text-secondary"} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">Monitor Drive Mounts</span>
            </button>

            <button
              onClick={handleToggleAutoScan}
              disabled={!config.enabled}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 select-none ${
                !config.enabled 
                  ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent'
                  : config.auto_scan
                    ? 'bg-theme-cyan/10 border-theme-cyan/30 text-white'
                    : 'bg-black/20 border-white/5 text-theme-text-secondary hover:bg-white/3'
              }`}
            >
              <Shield size={14} className={config.auto_scan ? "text-theme-cyan" : "text-theme-text-secondary"} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">Autonomous Malware Sweep</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Scan Status & Audit Logs */}
      <div 
        className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-1"
        style={{
          borderImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
          background: 'var(--theme-card-bg)'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.08)_0%,rgba(0,0,0,0)_70%)]" />
        
        <div className="flex flex-col gap-4 w-full h-full z-10">
          <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2 select-none">
            <RefreshCw size={16} className={`text-theme-yellow ${isScanning ? 'animate-spin' : ''}`} />
            Shield Status
          </h3>

          {/* Active scan status details */}
          {isScanning ? (
            <div className="flex flex-col gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="text-amber-500 animate-spin shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wide">Threat Scan In Progress</span>
                  <span className="text-[9px] text-theme-text-secondary font-mono">Drive: {scanningDrive}</span>
                </div>
              </div>
              <div className="text-[8px] text-theme-text-tertiary truncate font-mono mt-1 border-t border-white/5 pt-1.5">
                Scanning: {scanProgressFile || 'Initializing file tree...'}
              </div>
            </div>
          ) : threatsFoundCount > 0 ? (
            <div className="flex items-center gap-4 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5">
              <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-rose-500 text-rose-500 shrink-0">
                <AlertTriangle size={22} className="animate-bounce" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wide">Threats Neutralized</span>
                <span className="text-[9px] text-theme-text-secondary leading-snug">
                  {threatsFoundCount} files auto-quarantined on drive {scanningDrive}.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
              <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-emerald-500 text-emerald-500 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide">Mount Protection Active</span>
                <span className="text-[9px] text-theme-text-secondary leading-snug">USB insertion watchdog is waiting for device connection.</span>
              </div>
            </div>
          )}

          {/* Audit Logs */}
          <div className="flex-1 flex flex-col gap-2 mt-1">
            <span className="text-[9px] font-bold text-theme-text-tertiary uppercase tracking-wider select-none">USB Activity Log</span>
            
            <div className="flex-1 max-h-[140px] overflow-y-auto flex flex-col gap-2 border border-white/5 rounded-xl bg-black/35 p-3 font-mono text-[9px]">
              {logs.length === 0 ? (
                <div className="text-center text-theme-text-tertiary my-auto py-8">
                  Audit log is empty. Mounted drives will log here.
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
