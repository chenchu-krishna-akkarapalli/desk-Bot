import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface SandboxState {
  logs: string[];
  isLaunching: boolean;
  selectedFilePath: string;

  setSelectedFilePath: (path: string) => void;
  fetchLogs: () => Promise<void>;
  launchSandbox: (filePath?: string) => Promise<void>;
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  logs: [],
  isLaunching: false,
  selectedFilePath: '',

  setSelectedFilePath: (selectedFilePath) => {
    set({ selectedFilePath });
  },

  fetchLogs: async () => {
    try {
      const logs = await invoke<string[]>('get_sandbox_logs');
      set({ logs: logs.reverse() });
    } catch (err) {
      console.error('Failed to fetch sandbox logs:', err);
    }
  },

  launchSandbox: async (filePath) => {
    const targetPath = filePath || get().selectedFilePath;
    if (!targetPath) return;

    set({ isLaunching: true });
    try {
      await invoke('launch_in_sandbox', { filePath: targetPath });
      set({ selectedFilePath: '' }); // Clear input on success
      await get().fetchLogs();
    } catch (err) {
      console.error('Failed to launch sandbox:', err);
      alert(`Error launching sandbox: ${err}`);
    } finally {
      set({ isLaunching: false });
    }
  },
}));
