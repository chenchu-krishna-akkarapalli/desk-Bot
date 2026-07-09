import { useEffect } from 'react';
import { 
  Shield, ShieldAlert, ShieldCheck, Trash2, Timer, Key, 
  CreditCard, Lock, EyeOff, CheckCircle
} from 'lucide-react';
import { useClipboardStore } from '../store/useClipboardStore';

export default function ClipboardShield() {
  const {
    config,
    logs,
    countdown,
    isCountdownActive,
    fetchConfig,
    updateConfig,
    fetchLogs,
    forceClear,
    initListeners
  } = useClipboardStore();

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

  const handleToggleAPIKeys = () => {
    updateConfig({ monitor_api_keys: !config.monitor_api_keys });
  };

  const handleToggleCreditCards = () => {
    updateConfig({ monitor_credit_cards: !config.monitor_credit_cards });
  };

  const handleTogglePasswords = () => {
    updateConfig({ monitor_passwords: !config.monitor_passwords });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ clear_delay_secs: parseInt(e.target.value) });
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {/* Configuration Card */}
      <div 
        className="custom-glass-card p-5 rounded-[22px] flex flex-col justify-between relative md:col-span-2"
        style={{
          borderImage: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%) 1',
          background: 'var(--theme-card-bg)'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_bottom_left,rgba(6, 182, 212, 0.06)_0%,rgba(0,0,0,0)_70%)]" />
        
        <div className="z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-rounded text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              {config.enabled ? (
                <ShieldCheck size={16} className="text-theme-cyan" />
              ) : (
                <ShieldAlert size={16} className="text-rose-400" />
              )}
              Clipboard Security Shield
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
            Mitigate credential leaks and hijacking. DeskWell audits text copies on the fly, identifies sensitive keys, 
            and cleans clipboard buffer memory after a custom delay.
          </p>

          {/* Toggle Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
            <button
              onClick={handleToggleAPIKeys}
              disabled={!config.enabled}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 select-none ${
                !config.enabled 
                  ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent'
                  : config.monitor_api_keys
                    ? 'bg-theme-cyan/10 border-theme-cyan/30 text-white'
                    : 'bg-black/20 border-white/5 text-theme-text-secondary hover:bg-white/3'
              }`}
            >
              <Key size={14} className={config.monitor_api_keys ? "text-theme-cyan" : "text-theme-text-secondary"} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">API Keys & Tokens</span>
            </button>

            <button
              onClick={handleToggleCreditCards}
              disabled={!config.enabled}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 select-none ${
                !config.enabled 
                  ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent'
                  : config.monitor_credit_cards
                    ? 'bg-theme-cyan/10 border-theme-cyan/30 text-white'
                    : 'bg-black/20 border-white/5 text-theme-text-secondary hover:bg-white/3'
              }`}
            >
              <CreditCard size={14} className={config.monitor_credit_cards ? "text-theme-cyan" : "text-theme-text-secondary"} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">Credit Cards</span>
            </button>

            <button
              onClick={handleTogglePasswords}
              disabled={!config.enabled}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 select-none ${
                !config.enabled 
                  ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent'
                  : config.monitor_passwords
                    ? 'bg-theme-cyan/10 border-theme-cyan/30 text-white'
                    : 'bg-black/20 border-white/5 text-theme-text-secondary hover:bg-white/3'
              }`}
            >
              <Lock size={14} className={config.monitor_passwords ? "text-theme-cyan" : "text-theme-text-secondary"} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">Passwords</span>
            </button>
          </div>

          {/* Slider delay */}
          <div className="flex flex-col gap-2 mt-2 bg-black/20 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center justify-between text-[10px] font-bold text-theme-text-secondary uppercase select-none">
              <span>Auto-Erase Delay</span>
              <span className="text-white font-mono">{config.clear_delay_secs} seconds</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              value={config.clear_delay_secs}
              onChange={handleSliderChange}
              disabled={!config.enabled}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-theme-cyan disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 mt-5 z-10">
          <button
            onClick={forceClear}
            className="px-4 py-2 text-xs rounded-full font-bold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Trash2 size={13} />
            Erase Clipboard Now
          </button>
        </div>
      </div>

      {/* Live Status & Threat Logs Card */}
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
            <Timer size={16} className="text-theme-yellow" />
            Shield Status
          </h3>

          {/* Dynamic Countdown Display */}
          {isCountdownActive ? (
            <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 animate-pulse">
              <div className="relative flex items-center justify-center h-12 w-12 rounded-full border-2 border-amber-500 text-amber-500 font-mono font-extrabold text-base shrink-0 select-none">
                {countdown}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wide">Threat Detected</span>
                <span className="text-[9px] text-theme-text-secondary leading-snug">Auto-erasing sensitive copy from clipboard buffer...</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
              <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-emerald-500 text-emerald-500 shrink-0">
                <Shield size={22} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide">System Secure</span>
                <span className="text-[9px] text-theme-text-secondary leading-snug">No active secrets or keys detected in clipboard.</span>
              </div>
            </div>
          )}

          {/* Audit Logs */}
          <div className="flex-1 flex flex-col gap-2 mt-1">
            <span className="text-[9px] font-bold text-theme-text-tertiary uppercase tracking-wider select-none">Sanitization Log</span>
            
            <div className="flex-1 max-h-[140px] overflow-y-auto flex flex-col gap-2 border border-white/5 rounded-xl bg-black/35 p-3 font-mono text-[9px]">
              {logs.length === 0 ? (
                <div className="text-center text-theme-text-tertiary my-auto py-8">
                  Audit log is empty. Sanitized copies will log here.
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-extrabold uppercase flex items-center gap-1">
                        <EyeOff size={10} />
                        {log.matched_pattern}
                      </span>
                      <span className="text-theme-text-tertiary">{log.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between text-white">
                      <span className="text-theme-text-secondary">{log.masked_value}</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5 uppercase text-[8px]">
                        <CheckCircle size={8} />
                        Cleared
                      </span>
                    </div>
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
