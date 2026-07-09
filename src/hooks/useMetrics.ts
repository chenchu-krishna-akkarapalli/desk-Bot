import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/useSettingsStore';

export function useMetrics() {
  const addMetricPoint = useSettingsStore((state) => state.addMetricPoint);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await invoke<{
          cpu_usage: number;
          memory_usage: number;
          temperature: number;
          network_speed_mbps: number;
        }>('get_system_metrics');
        
        addMetricPoint({
          cpu: data.cpu_usage,
          ram: data.memory_usage,
          temp: data.temperature,
          mbps: data.network_speed_mbps,
        });
      } catch (err) {
        console.error('Failed to get system metrics:', err);
      }
    };

    // Initial fetch
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1500);
    return () => clearInterval(interval);
  }, [addMetricPoint]);
}
