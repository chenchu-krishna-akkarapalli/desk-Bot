import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface UsbShieldConfig {
  enabled: boolean;
  auto_scan: boolean;
}

export interface AntivirusScanReport {
  scanned_files_count: number;
  threats_found: any[];
  elapsed_seconds: number;
}

interface UsbShieldState {
  config: UsbShieldConfig;
  logs: string[];
  isScanning: boolean;
  scanningDrive: string;
  scanProgressFile: string;
  threatsFoundCount: number;

  fetchConfig: () => Promise<void>;
  updateConfig: (configUpdates: Partial<UsbShieldConfig>) => Promise<void>;
  fetchLogs: () => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useUsbShieldStore = create<UsbShieldState>((set, get) => ({
  config: {
    enabled: true,
    auto_scan: true,
  },
  logs: [],
  isScanning: false,
  scanningDrive: '',
  scanProgressFile: '',
  threatsFoundCount: 0,

  fetchConfig: async () => {
    try {
      const config = await invoke<UsbShieldConfig>('get_usb_shield_config');
      set({ config });
    } catch (err) {
      console.error('Failed to fetch USB shield config:', err);
    }
  },

  updateConfig: async (configUpdates) => {
    const newConfig = { ...get().config, ...configUpdates };
    set({ config: newConfig });
    try {
      await invoke('update_usb_shield_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to update USB shield config:', err);
    }
  },

  fetchLogs: async () => {
    try {
      const logs = await invoke<string[]>('get_usb_shield_logs');
      // Show newest logs first
      set({ logs: logs.reverse() });
    } catch (err) {
      console.error('Failed to fetch USB shield logs:', err);
    }
  },

  initListeners: async () => {
    const unsubInserted = await listen<string>('usb-device-inserted', (event) => {
      set({ scanningDrive: event.payload });
    });

    const unsubStarted = await listen<string>('usb-scan-started', (event) => {
      set({ 
        isScanning: true, 
        scanningDrive: event.payload, 
        threatsFoundCount: 0, 
        scanProgressFile: '' 
      });
    });

    const unsubProgress = await listen<string>('antivirus-scan-log', (event) => {
      set({ scanProgressFile: event.payload });
    });

    const unsubCompleted = await listen<AntivirusScanReport>('usb-scan-completed', (event) => {
      set({ 
        isScanning: false, 
        scanProgressFile: '', 
        threatsFoundCount: event.payload.threats_found.length 
      });
      get().fetchLogs();
    });

    return () => {
      unsubInserted();
      unsubStarted();
      unsubProgress();
      unsubCompleted();
    };
  },
}));
