import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import { useWorkspaceCleanerStore } from '../../store/useWorkspaceCleanerStore';

export default function DeletionLoader() {
  const { isDeleting, deletedCount, totalToDelete, deletionLogs } = useWorkspaceCleanerStore();
  const [elapsed, setElapsed] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDeleting) return;

    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 50);

    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [isDeleting]);

  // Auto-scroll to the bottom of the logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [deletionLogs]);

  if (!isDeleting) return null;

  const progressPercentage = totalToDelete > 0 ? (deletedCount / totalToDelete) * 100 : 0;

  const formatElapsed = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const centis = Math.floor((ms % 1000) / 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div 
        className="w-[90%] max-w-lg p-6 rounded-[24px] border border-white/10 flex flex-col gap-4 relative overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(12, 16, 19, 0.95)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Glow backdrop */}
        <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-theme-cyan/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Loader Icon & Header */}
        <div className="flex flex-col items-center justify-center text-center gap-2 mt-2">
          <div className="h-12 w-12 rounded-full bg-theme-cyan/10 border border-theme-cyan/20 flex items-center justify-center animate-spin">
            <RefreshCw size={22} className="text-theme-cyan" />
          </div>
          <h2 className="text-base font-bold text-white font-rounded uppercase tracking-wide mt-2">
            Performing Bulk Cleanup
          </h2>
          <span className="text-[10px] text-theme-text-secondary uppercase font-semibold font-mono tracking-wider">
            Do not close the application...
          </span>
        </div>

        {/* Progress Bar & Stats */}
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-theme-text-secondary">
            <span>Elapsed Time: {formatElapsed(elapsed)}</span>
            <span className="text-theme-cyan font-bold">
              {deletedCount} / {totalToDelete} Items ({Math.round(progressPercentage)}%)
            </span>
          </div>

          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/8">
            <div 
              className="h-full bg-gradient-to-r from-theme-cyan to-cyan-400 transition-all duration-150"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Live Rolling Logs */}
        <div className="flex flex-col gap-1.5 mt-2">
          <span className="text-[9px] font-extrabold text-theme-text-tertiary uppercase tracking-widest">
            Live Deletion Logs (Strike-Out History)
          </span>
          <div 
            ref={logContainerRef}
            className="h-[140px] overflow-y-auto border border-white/8 rounded-xl bg-black/45 p-3 flex flex-col gap-1 font-mono text-[9px] scrollbar-thin select-none"
          >
            {deletionLogs.length === 0 ? (
              <span className="text-theme-text-tertiary animate-pulse">Initializing filesystem logs...</span>
            ) : (
              deletionLogs.map((log, index) => (
                <div key={index} className="flex items-center gap-2 truncate">
                  {log.success ? (
                    <>
                      <div className="h-3 w-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check size={8} className="text-emerald-400" />
                      </div>
                      <span className="line-through text-theme-text-secondary truncate pr-2">
                        {log.path}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-3 w-3 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <X size={8} className="text-red-400" />
                      </div>
                      <span className="text-red-400 truncate pr-2">
                        {log.path}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
