import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface WorkspaceFile {
  path: string;
  name: string;
  size_bytes: number;
  item_type: 'file' | 'directory';
  category: string; // "build_artifact" | "markdown" | "data" | "documents" | "visual" | "media" | "binaries" | "other"
  risk_level: 'low' | 'medium' | 'high';
  is_readable: boolean;
  is_writable: boolean;
  is_system_file: boolean;
}

export interface DeletionLog {
  path: string;
  success: boolean;
}

interface WorkspaceCleanerState {
  scanPaths: string[];
  activeMode: 'workspace' | 'files';
  categories: string[];
  isScanning: boolean;
  scanResults: WorkspaceFile[];
  selectedFiles: string[];
  isDeleting: boolean;
  statusMessage: string;
  
  // Progress indicators
  deletedCount: number;
  totalToDelete: number;
  deletionLogs: DeletionLog[];
  totalReclaimedBytes: number;

  addScanPath: (path: string) => void;
  removeScanPath: (path: string) => void;
  toggleCategory: (category: string) => void;
  setActiveMode: (mode: 'workspace' | 'files') => void;
  startScan: () => Promise<void>;
  setSelectedFiles: (files: string[]) => void;
  deleteSelectedFiles: (pathsToDelete?: string[]) => Promise<void>;
  clearResults: () => void;
}

export const useWorkspaceCleanerStore = create<WorkspaceCleanerState>((set, get) => ({
  scanPaths: [],
  activeMode: 'workspace',
  categories: ['markdown', 'data', 'documents', 'visual', 'media', 'binaries'],
  isScanning: false,
  scanResults: [],
  selectedFiles: [],
  isDeleting: false,
  statusMessage: '',
  deletedCount: 0,
  totalToDelete: 0,
  deletionLogs: [],
  totalReclaimedBytes: 0,

  addScanPath: (path) => {
    const { scanPaths } = get();
    if (!scanPaths.includes(path)) {
      set({ scanPaths: [...scanPaths, path], statusMessage: `Added path: ${path}` });
    }
  },

  removeScanPath: (path) => {
    set({
      scanPaths: get().scanPaths.filter((p) => p !== path),
      statusMessage: `Removed path: ${path}`
    });
  },

  toggleCategory: (category) => {
    const { categories } = get();
    if (categories.includes(category)) {
      set({ categories: categories.filter((c) => c !== category) });
    } else {
      set({ categories: [...categories, category] });
    }
  },

  setActiveMode: (activeMode) => {
    set({ activeMode, scanResults: [], selectedFiles: [], statusMessage: '', totalReclaimedBytes: 0 });
  },

  startScan: async () => {
    const { scanPaths, activeMode, categories } = get();
    if (scanPaths.length === 0) {
      set({ statusMessage: 'Error: Select at least one workspace folder.' });
      return;
    }

    set({ 
      isScanning: true, 
      scanResults: [], 
      selectedFiles: [], 
      statusMessage: activeMode === 'workspace' 
        ? 'Scanning projects for stale build folders (node_modules, target, build) and configuration files (.env)...'
        : 'Scanning recursively for files matching document categories...'
    });
    
    try {
      const results = await invoke<WorkspaceFile[]>('scan_workspace', {
        paths: scanPaths,
        mode: activeMode,
        categories
      });

      if (results.length === 0) {
        set({ 
          isScanning: false, 
          statusMessage: activeMode === 'workspace'
            ? 'Scan complete. No build artifacts (node_modules, target, build, .env) were found.'
            : 'Scan complete. No files matching document categories were found.'
        });
        return;
      }

      set({
        scanResults: results,
        isScanning: false,
        statusMessage: `Scan complete! Found ${results.length} item(s).`
      });

      // Auto-select safe/low-risk targets for deletion
      const autoSelected = results
        .filter((r) => r.risk_level === 'low')
        .map((r) => r.path);
      set({ selectedFiles: autoSelected });

    } catch (err: any) {
      set({
        isScanning: false,
        statusMessage: `Scan failed: ${err.toString()}`
      });
    }
  },

  setSelectedFiles: (selectedFiles) => set({ selectedFiles }),

  deleteSelectedFiles: async (pathsToDelete) => {
    const targets = pathsToDelete || get().selectedFiles;
    if (targets.length === 0) return;

    set({ 
      isDeleting: true, 
      deletedCount: 0, 
      totalToDelete: targets.length, 
      deletionLogs: [],
      statusMessage: `Purging ${targets.length} items...` 
    });

    // Subscribe to backend progress notifications
    let unsubscribe: () => void = () => {};
    try {
      unsubscribe = await listen<{ path: string; index: number; total: number; success: boolean }>(
        'deletion-progress',
        (event) => {
          const payload = event.payload;
          set((state) => {
            const newLog = {
              path: payload.path,
              success: payload.success
            };
            
            // Limit log rendering to the most recent 120 elements to optimize React renders
            const updatedLogs = [...state.deletionLogs, newLog].slice(-120);
            
            // Find item size to update session reclaimed bytes
            const item = state.scanResults.find(r => r.path === payload.path);
            const reclaimedSize = (payload.success && item) ? item.size_bytes : 0;
            
            return {
              deletedCount: payload.index,
              deletionLogs: updatedLogs,
              totalReclaimedBytes: state.totalReclaimedBytes + reclaimedSize,
              statusMessage: `Processed item ${payload.index} of ${payload.total}...`
            };
          });
        }
      );

      // Map targets to payload
      const items = targets.map((path) => {
        const item = get().scanResults.find((r) => r.path === path);
        return {
          path,
          item_type: item ? item.item_type : 'file'
        };
      });

      // Trigger asynchronous non-blocking bulk deletions
      await invoke('delete_cleaner_items', { items });

      // Non-blocking wait until all events are processed or deletion finishes
      while (true) {
        const currentCount = get().deletedCount;
        if (currentCount >= targets.length) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    } catch (err: any) {
      console.error("Bulk deletion failed:", err);
      set({ statusMessage: `Bulk deletion failed: ${err.toString()}` });
    } finally {
      unsubscribe();
      
      const remaining = get().scanResults.filter((r) => !targets.includes(r.path));
      set({
        scanResults: remaining,
        selectedFiles: get().selectedFiles.filter((p) => !targets.includes(p)),
        isDeleting: false,
        deletedCount: 0,
        totalToDelete: 0,
        deletionLogs: []
      });
    }
  },

  clearResults: () => set({ scanResults: [], selectedFiles: [], statusMessage: '', totalReclaimedBytes: 0 })
}));
