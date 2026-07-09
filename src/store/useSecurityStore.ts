import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SensitivityLevel = 'balanced' | 'performance' | 'paranoid';

export interface QuarantinedFile {
  id: string;
  originalPath: string;
  neutralizedPath: string;
  fileName: string;
  fileSize: number;
  threatType: string;
  detectedAt: string;
}

interface SecurityState {
  shieldEnabled: boolean;
  sensitivity: SensitivityLevel;
  quarantineList: QuarantinedFile[];
  lastScanTime: string | null;
  scannedFilesCount: number;
  threatsDetectedCount: number;
  passiveScanningEnabled: boolean;
  
  toggleShield: () => void;
  setSensitivity: (level: SensitivityLevel) => void;
  setQuarantineList: (list: QuarantinedFile[]) => void;
  addToQuarantine: (file: QuarantinedFile) => void;
  removeFromQuarantine: (id: string) => void;
  recordScanResults: (filesCount: number, threatsCount: number) => void;
  togglePassiveScanning: () => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      shieldEnabled: true,
      sensitivity: 'balanced',
      quarantineList: [],
      lastScanTime: null,
      scannedFilesCount: 0,
      threatsDetectedCount: 0,
      passiveScanningEnabled: true,
      
      toggleShield: () => set((state) => ({ shieldEnabled: !state.shieldEnabled })),
      setSensitivity: (sensitivity) => set({ sensitivity }),
      setQuarantineList: (quarantineList) => set({ quarantineList }),
      addToQuarantine: (file) => set((state) => ({
        quarantineList: [...state.quarantineList.filter(f => f.id !== file.id), file]
      })),
      removeFromQuarantine: (id) => set((state) => ({
        quarantineList: state.quarantineList.filter((f) => f.id !== id)
      })),
      recordScanResults: (filesCount, threatsCount) => set({
        lastScanTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scannedFilesCount: filesCount,
        threatsDetectedCount: threatsCount
      }),
      togglePassiveScanning: () => set((state) => ({ passiveScanningEnabled: !state.passiveScanningEnabled }))
    }),
    {
      name: 'deskwell-security-store',
      partialize: (state) => ({
        shieldEnabled: state.shieldEnabled,
        sensitivity: state.sensitivity,
        quarantineList: state.quarantineList,
        lastScanTime: state.lastScanTime,
        scannedFilesCount: state.scannedFilesCount,
        threatsDetectedCount: state.threatsDetectedCount,
        passiveScanningEnabled: state.passiveScanningEnabled,
      }),
    }
  )
);
