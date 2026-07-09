import { useEffect, useRef } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { useSettingsStore } from '../store/useSettingsStore';

export function useNotifications() {
  const currentMetrics = useSettingsStore((state) => state.currentMetrics);
  const permissionGranted = useRef<boolean>(false);
  const lastCpuAlertTime = useRef<number>(0);
  const lastTempAlertTime = useRef<number>(0);

  // Request notification permissions on boot
  useEffect(() => {
    (async () => {
      try {
        let hasPermission = await isPermissionGranted();
        if (!hasPermission) {
          const permission = await requestPermission();
          hasPermission = permission === 'granted';
        }
        permissionGranted.current = hasPermission;
      } catch (err) {
        console.error('Failed to request notification permission:', err);
      }
    })();
  }, []);

  // Monitor metrics changes to fire warnings
  useEffect(() => {
    if (!permissionGranted.current) return;

    const now = Date.now();
    const alertCooldown = 10 * 60 * 1000; // 10 minutes

    // 1. High CPU check
    if (currentMetrics.cpu > 90.0) {
      if (now - lastCpuAlertTime.current > alertCooldown) {
        lastCpuAlertTime.current = now;
        sendNotification({
          title: 'High CPU Load Warning',
          body: `System CPU load is extremely high: ${currentMetrics.cpu.toFixed(1)}%`,
        });
      }
    }

    // 2. High Temperature check
    if (currentMetrics.temp > 85.0) {
      if (now - lastTempAlertTime.current > alertCooldown) {
        lastTempAlertTime.current = now;
        sendNotification({
          title: 'High CPU Temperature Alert',
          body: `CPU/System temperature has exceeded threshold: ${currentMetrics.temp.toFixed(1)}°C`,
        });
      }
    }
  }, [currentMetrics]);
}
