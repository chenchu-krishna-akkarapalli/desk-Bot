import { useSettingsStore } from '../store/useSettingsStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Maximize2, Cpu, Activity, Thermometer, Wifi, Play, Pause, SkipForward, Heart, Minus, X } from 'lucide-react';

export default function FloatingBar() {
  const currentMetrics = useSettingsStore((state) => state.currentMetrics);
  const opacity = useSettingsStore((state) => state.opacity);
  const setWindowMode = useSettingsStore((state) => state.setWindowMode);

  const {
    isPlaying,
    currentTrack,
    togglePlayback,
    nextTrack,
    toggleLike,
  } = useAudioEngine();

  return (
    <div
      data-tauri-drag-region
      className="custom-glass-card h-full w-full flex items-center justify-between px-3.5 rounded-[16px] select-none overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: `rgba(16, 21, 24, ${opacity})`,
        border: '1px solid var(--theme-border-start)'
      }}
    >
      {/* Left Section: Mini Player */}
      <div className="flex items-center gap-2 max-w-[190px] shrink-0 border-r border-white/10 pr-2">
        <button
          onClick={togglePlayback}
          className="h-7 w-7 rounded-full bg-theme-accent flex items-center justify-center text-black hover:opacity-90 transition cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={11} fill="currentColor" />
          ) : (
            <Play size={11} fill="currentColor" className="translate-x-[0.5px]" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer shrink-0"
          title="Next Track"
        >
          <SkipForward size={12} />
        </button>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          {currentTrack ? (
            <>
              <span className="text-[10px] font-bold text-white truncate leading-none mb-0.5 animate-fade-in">
                {currentTrack.title}
              </span>
              <span className="text-[8px] text-gray-400 truncate leading-none">
                {currentTrack.artist}
              </span>
            </>
          ) : (
            <span className="text-[9px] text-gray-500 italic">No track loaded</span>
          )}
        </div>

        {currentTrack && (
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="text-gray-500 hover:text-red-400 shrink-0 transition cursor-pointer p-0.5 animate-fade-in"
            title="Like track"
          >
            <Heart
              size={11}
              className={currentTrack.liked ? 'fill-red-500 text-red-500' : ''}
            />
          </button>
        )}
      </div>

      {/* Middle Section: All Metric Indicators */}
      <div data-tauri-drag-region className="flex items-center gap-3.5 flex-1 justify-center px-1">
        {/* CPU */}
        <div data-tauri-drag-region className="flex items-center gap-1.5 min-w-[52px] justify-center">
          <Cpu size={12} className="text-theme-green shrink-0" />
          <span data-tauri-drag-region className="text-[11px] font-bold text-white leading-none">
            {currentMetrics.cpu.toFixed(0)}%
          </span>
        </div>

        {/* RAM */}
        <div data-tauri-drag-region className="flex items-center gap-1.5 min-w-[52px] justify-center">
          <Activity size={12} className="text-theme-yellow shrink-0" />
          <span data-tauri-drag-region className="text-[11px] font-bold text-white leading-none">
            {currentMetrics.ram.toFixed(0)}%
          </span>
        </div>

        {/* Temp */}
        <div data-tauri-drag-region className="flex items-center gap-1.5 min-w-[48px] justify-center">
          <Thermometer size={12} className="text-theme-red shrink-0" />
          <span data-tauri-drag-region className="text-[11px] font-bold text-white leading-none">
            {currentMetrics.temp.toFixed(0)}°
          </span>
        </div>

        {/* Network */}
        <div data-tauri-drag-region className="flex items-center gap-1.5 min-w-[62px] justify-center">
          <Wifi size={12} className="text-theme-purple shrink-0" />
          <span data-tauri-drag-region className="text-[10px] font-bold text-white leading-none truncate max-w-[40px]">
            {currentMetrics.mbps.toFixed(1)}M
          </span>
        </div>
      </div>

      {/* Right Section: System Controls (Minimize, Restore, Close) */}
      <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 shrink-0">
        {/* Minimize Button */}
        <button
          onClick={async () => {
            try {
              const win = getCurrentWindow();
              await win.minimize();
            } catch (err) {
              console.error('Failed to minimize window:', err);
            }
          }}
          className="h-6 w-6 rounded-md flex items-center justify-center bg-white/5 border border-white/8 hover:bg-white/12 text-theme-yellow transition cursor-pointer"
          title="Minimize Window"
        >
          <Minus size={12} className="stroke-[2.5]" />
        </button>

        {/* Restore Dashboard Button */}
        <button
          onClick={() => setWindowMode('dashboard')}
          className="h-6 w-6 rounded-md flex items-center justify-center bg-white/5 border border-white/8 hover:bg-white/12 text-theme-green transition cursor-pointer"
          title="Restore Dashboard"
        >
          <Maximize2 size={11} className="stroke-[2.5]" />
        </button>

        {/* Close Button */}
        <button
          onClick={async () => {
            try {
              const win = getCurrentWindow();
              await win.close();
            } catch (err) {
              console.error('Failed to close window:', err);
            }
          }}
          className="h-6 w-6 rounded-md flex items-center justify-center bg-white/5 border border-white/8 hover:bg-white/12 text-theme-red transition cursor-pointer"
          title="Close App"
        >
          <X size={12} className="stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
