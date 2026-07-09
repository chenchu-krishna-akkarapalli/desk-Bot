import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const windowMode = useSettingsStore((state) => state.windowMode);

  const themeClass = `theme-${theme}`;

  return (
    <div
      className={`relative h-full w-full overflow-hidden transition-all duration-500 ${themeClass} ${
        windowMode === 'floating' ? 'bg-transparent' : 'bg-[image:var(--theme-bg)]'
      }`}
    >
      {/* Cyberpunk scanline visual grid overlay */}
      {theme === 'cyberpunk' && <div className="scanline" />}
      
      {/* Ambient background glowing particles for futuristic feel */}
      {windowMode === 'dashboard' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {theme === 'glass' && (
            <div className="absolute -left-1/4 -top-1/4 h-[60%] w-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
          )}
          {theme === 'solar' && (
            <>
              <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full bg-amber-500/10 blur-[130px]" />
              <div className="absolute -right-1/4 -bottom-1/4 h-[60%] w-[60%] rounded-full bg-orange-600/5 blur-[120px]" />
            </>
          )}
          {theme === 'quantum' && (
            <div className="absolute left-1/3 top-1/4 h-[50%] w-[50%] rounded-full bg-teal-500/5 blur-[100px]" />
          )}
        </div>
      )}

      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
}
