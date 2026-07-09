import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ClipboardConfig {
  enabled: boolean;
  clear_delay_secs: number;
  monitor_api_keys: boolean;
  monitor_credit_cards: boolean;
  monitor_passwords: boolean;
}

export interface ClipboardShieldLog {
  timestamp: string;
  matched_pattern: string;
  masked_value: string;
}

interface ClipboardState {
  config: ClipboardConfig;
  logs: ClipboardShieldLog[];
  countdown: number;
  isCountdownActive: boolean;
  intervalId: any;


  fetchConfig: () => Promise<void>;
  updateConfig: (configUpdates: Partial<ClipboardConfig>) => Promise<void>;
  fetchLogs: () => Promise<void>;
  forceClear: () => Promise<void>;
  startCountdown: (seconds: number) => void;
  cancelCountdown: () => void;
  initListeners: () => Promise<() => void>;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  config: {
    enabled: true,
    clear_delay_secs: 30,
    monitor_api_keys: true,
    monitor_credit_cards: true,
    monitor_passwords: true,
  },
  logs: [],
  countdown: 0,
  isCountdownActive: false,
  intervalId: null,

  fetchConfig: async () => {
    try {
      const config = await invoke<ClipboardConfig>('get_clipboard_shield_config');
      set({ config });
    } catch (err) {
      console.error('Failed to fetch clipboard shield config:', err);
    }
  },

  updateConfig: async (configUpdates) => {
    const newConfig = { ...get().config, ...configUpdates };
    set({ config: newConfig });
    try {
      await invoke('update_clipboard_shield_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to update clipboard shield config:', err);
    }
  },

  fetchLogs: async () => {
    try {
      const logs = await invoke<ClipboardShieldLog[]>('get_clipboard_shield_logs');
      // Show newest logs first
      set({ logs: logs.reverse() });
    } catch (err) {
      console.error('Failed to fetch clipboard shield logs:', err);
    }
  },

  forceClear: async () => {
    try {
      await invoke('force_clear_clipboard');
      get().cancelCountdown();
    } catch (err) {
      console.error('Failed to clear clipboard:', err);
    }
  },

  startCountdown: (seconds) => {
    get().cancelCountdown();
    set({ countdown: seconds, isCountdownActive: true });

    const id = setInterval(() => {
      const { countdown } = get();
      if (countdown <= 1) {
        get().cancelCountdown();
      } else {
        set({ countdown: countdown - 1 });
      }
    }, 1000);

    set({ intervalId: id });
  },

  cancelCountdown: () => {
    const { intervalId } = get();
    if (intervalId) {
      clearInterval(intervalId);
    }
    set({ countdown: 0, isCountdownActive: false, intervalId: null });
  },

  initListeners: async () => {
    const unsubDetected = await listen<ClipboardShieldLog>(
      'clipboard-sensitive-detected',
      (event) => {
        set((state) => ({
          logs: [event.payload, ...state.logs].slice(0, 100),
        }));
        
        // Start visual countdown timer
        const delay = get().config.clear_delay_secs;
        get().startCountdown(delay);
      }
    );

    const unsubCleared = await listen<void>('clipboard-cleared', () => {
      get().cancelCountdown();
    });

    // Combined unsubscribe handle
    return () => {
      unsubDetected();
      unsubCleared();
      get().cancelCountdown();
    };
  },
}));
