import { create } from 'zustand';

export interface MetricPoint {
  cpu: number;
  ram: number;
  temp: number;
  mbps: number;
  timestamp: number;
}

export type ThemeType = 'glass' | 'cyberpunk' | 'solar' | 'space' | 'quantum';
export type WindowModeType = 'dashboard' | 'floating';

interface SettingsState {
  theme: ThemeType;
  windowMode: WindowModeType;
  opacity: number;
  closeToFloating: boolean;
  metricsHistory: MetricPoint[];
  currentMetrics: MetricPoint;
  
  setTheme: (theme: ThemeType) => void;
  setWindowMode: (mode: WindowModeType) => void;
  setOpacity: (opacity: number) => void;
  setCloseToFloating: (val: boolean) => void;
  addMetricPoint: (point: Omit<MetricPoint, 'timestamp'>) => void;
}

const initialMetrics: MetricPoint = {
  cpu: 0,
  ram: 0,
  temp: 45,
  mbps: 0,
  timestamp: Date.now()
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'glass',
  windowMode: 'dashboard',
  opacity: 0.8,
  closeToFloating: true,
  metricsHistory: Array(60).fill(null).map((_, i) => ({
    cpu: 0,
    ram: 0,
    temp: 45,
    mbps: 0,
    timestamp: Date.now() - (60 - i) * 1500
  })),
  currentMetrics: initialMetrics,
  
  setTheme: (theme) => set({ theme }),
  setWindowMode: (windowMode) => set({ windowMode }),
  setOpacity: (opacity) => set({ opacity }),
  setCloseToFloating: (closeToFloating) => set({ closeToFloating }),
  addMetricPoint: (point) => set((state) => {
    const newPoint = { ...point, timestamp: Date.now() };
    const history = [...state.metricsHistory.slice(1), newPoint];
    return {
      currentMetrics: newPoint,
      metricsHistory: history
    };
  })
}));
