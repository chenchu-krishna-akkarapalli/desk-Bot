import { useEffect } from 'react';
import Dashboard from './components/Dashboard';
import BreakOverlay from './components/BreakOverlay';
import PlayerFooter from './components/PlayerFooter';
import FloatingBar from './components/FloatingBar';
import ThemeWrapper from './components/ThemeWrapper';
import { useScreenTime } from './hooks/useScreenTime';
import { usePlayerStore } from './store/usePlayerStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useMetrics } from './hooks/useMetrics';
import { useNotifications } from './hooks/useNotifications';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function App() {
  const { eyeBreakProgress } = useScreenTime();
  const { isBreakActive, setBreakActive, decrementBreakCountdown } = usePlayerStore();
  
  // Settings store parameters
  const windowMode = useSettingsStore((state) => state.windowMode);
  const setWindowMode = useSettingsStore((state) => state.setWindowMode);
  const opacity = useSettingsStore((state) => state.opacity);
  const closeToFloating = useSettingsStore((state) => state.closeToFloating);

  // Activate background polling and notifications hooks
  useMetrics();
  useNotifications();

  // Handle CloseRequested custom events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listen<boolean>('toggle-floating-bar', () => {
        if (closeToFloating) {
          setWindowMode('floating');
        } else {
          const win = getCurrentWindow();
          win.close();
        }
      });
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [closeToFloating, setWindowMode]);

  // Keep wellness break ticking
  useEffect(() => {
    if (!isBreakActive) return;
    const timer = setInterval(() => {
      decrementBreakCountdown();
    }, 1000);
    return () => clearInterval(timer);
  }, [isBreakActive, decrementBreakCountdown]);

  // Handle window sizing adjustments on mode switches
  useEffect(() => {
    const adjustWindow = async () => {
      try {
        if (windowMode === 'floating') {
          await invoke('set_window_decorations', { decorations: false });
          await invoke('set_window_size', { width: 520, height: 60 });
          await invoke('set_window_always_on_top', { alwaysOnTop: true });
        } else {
          await invoke('set_window_decorations', { decorations: true });
          await invoke('set_window_size', { width: 920, height: 640 });
          await invoke('set_window_always_on_top', { alwaysOnTop: false });
          
          // Re-focus the main window
          const win = await getCurrentWindow();
          await win.setFocus();
        }
      } catch (err) {
        console.error('Failed to adjust window properties:', err);
      }
    };
    adjustWindow();
  }, [windowMode, opacity]);

  return (
    <ThemeWrapper>
      {windowMode === 'floating' ? (
        <div className="h-full w-full bg-transparent p-0.5">
          <FloatingBar />
        </div>
      ) : (
        <div className="relative flex h-full w-full flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-18">
            <Dashboard />
          </div>

          <PlayerFooter />

          {isBreakActive && (
            <BreakOverlay
              type={eyeBreakProgress > 0.9 ? 'eye' : 'movement'}
              onComplete={() => setBreakActive(false)}
            />
          )}
        </div>
      )}
    </ThemeWrapper>
  );
}
