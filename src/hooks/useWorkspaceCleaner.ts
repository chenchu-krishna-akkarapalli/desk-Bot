import { open } from '@tauri-apps/plugin-dialog';
import { useWorkspaceCleanerStore } from '../store/useWorkspaceCleanerStore';

export function useWorkspaceCleaner() {
  const store = useWorkspaceCleanerStore();

  const browseAndAddPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Workspace Directory to Scan',
      });
      if (selected && typeof selected === 'string') {
        store.addScanPath(selected);
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  };

  return {
    ...store,
    browseAndAddPath,
  };
}
export type { WorkspaceFile } from '../store/useWorkspaceCleanerStore';
