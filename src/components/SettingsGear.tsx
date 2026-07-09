import { useSettingsStore, ThemeType } from '../store/useSettingsStore';
import { X, Check } from 'lucide-react';

interface SettingsGearProps {
  onClose: () => void;
}

export default function SettingsGear({ onClose }: SettingsGearProps) {
  const { theme, setTheme, opacity, setOpacity, closeToFloating, setCloseToFloating } = useSettingsStore();

  const themesList: { key: ThemeType; label: string }[] = [
    { key: 'glass', label: 'Liquid Glass' },
    { key: 'cyberpunk', label: 'Cyberpunk' },
    { key: 'solar', label: 'Solar Flare' },
    { key: 'space', label: 'Deep Space' },
    { key: 'quantum', label: 'Quantum' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity">
      <div className="custom-glass-card w-[320px] p-5 rounded-[24px] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/8">
          <h3 className="font-rounded text-sm font-semibold text-white">HUD Configuration</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/8 hover:bg-white/12 text-white transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Theme presets Grid */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-theme-text-secondary uppercase tracking-wider">Visual Themes</label>
          <div className="grid grid-cols-2 gap-2">
            {themesList.map((t) => (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={`p-2 rounded-xl flex items-center justify-between border text-left text-xs transition cursor-pointer ${
                  theme === t.key
                    ? 'border-theme-accent bg-theme-accent/10 text-white font-medium'
                    : 'border-white/8 bg-white/5 text-theme-text-secondary hover:bg-white/10'
                }`}
              >
                <span>{t.label}</span>
                {theme === t.key && <Check size={11} className="text-theme-accent shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <label className="text-[10px] font-semibold text-theme-text-secondary uppercase tracking-wider">HUD Opacity</label>
            <span className="text-white font-mono font-medium">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full accent-theme-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Toggle switch for close intercepts */}
        <div className="flex items-center justify-between py-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-white">Close to Floating HUD</span>
            <span className="text-[9px] text-theme-text-tertiary">Minimize/Close converts to bar</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={closeToFloating}
              onChange={(e) => setCloseToFloating(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-white/10 rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-theme-accent"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
