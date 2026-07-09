import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../store/usePlayerStore';

const IDLE_THRESHOLD_SECONDS = 180;
const EYE_BREAK_INTERVAL = 20 * 60; // 20 minutes
const MOVEMENT_BREAK_INTERVAL = 50 * 60; // 50 minutes
const POLL_INTERVAL_MS = 5000;

export interface ScreenTimeState {
  isIdle: boolean;
  idleSeconds: number;
  eyeBreakProgress: number;
  movementBreakProgress: number;
  activeWorkSeconds: number;
  eyeBreakDue: boolean;
  movementBreakDue: boolean;
  waterIntakeMl: number;
  stepsToday: number;
  resetEyeBreak: () => void;
  resetMovementBreak: () => void;
  addWater: (ml: number) => void;
  addSteps: (count: number) => void;
}

export function useScreenTime(): ScreenTimeState {
  const [isIdle, setIsIdle] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [eyeProgress, setEyeProgress] = useState(0);
  const [movementProgress, setMovementProgress] = useState(0);
  const [eyeDue, setEyeDue] = useState(false);
  const [movementDue, setMovementDue] = useState(false);
  const [activeWorkSeconds, setActiveWorkSeconds] = useState(0);

  const elapsedEyeRef = useRef(0);
  const elapsedMovementRef = useRef(0);
  const activeWorkRef = useRef(0);
  const lastPollRef = useRef(Date.now());
  const wasIdleRef = useRef(false);

  const { metrics, setMetrics, isBreakActive, setBreakActive, setBreakCountdown } = usePlayerStore();

  const resetEyeBreak = useCallback(() => {
    elapsedEyeRef.current = 0;
    setEyeProgress(0);
    setEyeDue(false);
  }, []);

  const resetMovementBreak = useCallback(() => {
    elapsedMovementRef.current = 0;
    setMovementProgress(0);
    setMovementDue(false);
  }, []);

  const addWater = useCallback((ml: number) => {
    setMetrics({ waterIntakeMl: metrics.waterIntakeMl + ml });
  }, [metrics.waterIntakeMl, setMetrics]);

  const addSteps = useCallback((count: number) => {
    setMetrics({ stepsToday: metrics.stepsToday + count });
  }, [metrics.stepsToday, setMetrics]);

  // Trigger break when due
  useEffect(() => {
    if (eyeDue && !isBreakActive && !isIdle) {
      setBreakActive(true);
      setBreakCountdown(20); // 20-second eye break
      setMetrics({
        breaksTaken: metrics.breaksTaken + 1,
        lastBreakTime: new Date().toLocaleTimeString(),
      });
      resetEyeBreak();
    }
  }, [eyeDue, isBreakActive, isIdle, setBreakActive, setBreakCountdown, setMetrics, metrics.breaksTaken, resetEyeBreak]);

  useEffect(() => {
    if (movementDue && !isBreakActive && !isIdle) {
      setBreakActive(true);
      setBreakCountdown(300); // 5-minute movement break
      setMetrics({
        breaksTaken: metrics.breaksTaken + 1,
        lastBreakTime: new Date().toLocaleTimeString(),
      });
      resetMovementBreak();
    }
  }, [movementDue, isBreakActive, isIdle, setBreakActive, setBreakCountdown, setMetrics, metrics.breaksTaken, resetMovementBreak]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const idle: number = await invoke('get_idle_time');
        setIdleSeconds(idle);

        const now = Date.now();
        let delta = (now - lastPollRef.current) / 1000;

        if (idle >= IDLE_THRESHOLD_SECONDS) {
          setIsIdle(true);
          wasIdleRef.current = true;
          lastPollRef.current = now;
          return;
        }
        setIsIdle(false);

        if (wasIdleRef.current) {
          delta = 0;
          wasIdleRef.current = false;
        }

        lastPollRef.current = now;

        const cappedDelta = Math.min(delta, (POLL_INTERVAL_MS * 2) / 1000);
        elapsedEyeRef.current += cappedDelta;
        elapsedMovementRef.current += cappedDelta;
        activeWorkRef.current += cappedDelta;

        setActiveWorkSeconds(activeWorkRef.current);

        const eyeP = Math.min(1, elapsedEyeRef.current / EYE_BREAK_INTERVAL);
        const moveP = Math.min(1, elapsedMovementRef.current / MOVEMENT_BREAK_INTERVAL);
        setEyeProgress(eyeP);
        setMovementProgress(moveP);

        if (elapsedEyeRef.current >= EYE_BREAK_INTERVAL && !eyeDue) {
          setEyeDue(true);
        }
        if (elapsedMovementRef.current >= MOVEMENT_BREAK_INTERVAL && !movementDue) {
          setMovementDue(true);
        }
      } catch {
        // Silently ignore backend errors
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    tick(); // Initial call
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return useMemo(
    () => ({
      isIdle,
      idleSeconds,
      eyeBreakProgress: eyeProgress,
      movementBreakProgress: movementProgress,
      activeWorkSeconds,
      eyeBreakDue: eyeDue,
      movementBreakDue: movementDue,
      waterIntakeMl: metrics.waterIntakeMl,
      stepsToday: metrics.stepsToday,
      resetEyeBreak,
      resetMovementBreak,
      addWater,
      addSteps,
    }),
    [
      isIdle,
      idleSeconds,
      eyeProgress,
      movementProgress,
      activeWorkSeconds,
      eyeDue,
      movementDue,
      metrics.waterIntakeMl,
      metrics.stepsToday,
      resetEyeBreak,
      resetMovementBreak,
      addWater,
      addSteps,
    ]
  );
}
