import { useEffect, useState } from 'react';
import GlassCard from './GlassCard';
import { Eye, Move, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface BreakOverlayProps {
  type: 'eye' | 'movement';
  onComplete: () => void;
}

export default function BreakOverlay({ type, onComplete }: BreakOverlayProps) {
  const [seconds, setSeconds] = useState(type === 'eye' ? 20 : 5 * 60);
  const [blinkCount, setBlinkCount] = useState(0);
  
  // Carousel state for stretches
  const stretches = [
    {
      title: 'Wrist Extension',
      description: 'Extend arm forward, pull fingers back with other hand. Hold for 15s, then swap sides.',
      icon: '🖐️',
    },
    {
      title: 'Scapular Retraction',
      description: 'Squeeze shoulder blades together, holding for 5s. Repeat 10 times to relieve upper back fatigue.',
      icon: '🧘',
    },
    {
      title: 'Neck Rolls',
      description: 'Gently roll head in semi-circles from shoulder to shoulder. Hold on tight spots. Do not roll backwards.',
      icon: '🔄',
    }
  ];
  
  const [activeStretch, setActiveStretch] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    
    const timer = setInterval(() => {
      setSeconds((s) => {
        const nextSec = s - 1;
        
        // Auto-advance stretch index every 100s during 5 min break
        if (type === 'movement') {
          const elapsed = (5 * 60) - nextSec;
          const targetIndex = Math.min(2, Math.floor(elapsed / 100));
          if (targetIndex !== activeStretch && targetIndex < stretches.length) {
            setActiveStretch(targetIndex);
          }
        }
        
        return nextSec;
      });

      if (type === 'eye') {
        setBlinkCount((c) => c + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, type, activeStretch, stretches.length]);

  useEffect(() => {
    if (seconds <= 0) {
      const timeout = setTimeout(onComplete, 2000);
      return () => clearTimeout(timeout);
    }
  }, [seconds, onComplete]);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handlePrevStretch = () => {
    setActiveStretch((prev) => (prev === 0 ? stretches.length - 1 : prev - 1));
  };

  const handleNextStretch = () => {
    setActiveStretch((prev) => (prev === stretches.length - 1 ? 0 : prev + 1));
  };

  const activeStretchProgress = type === 'movement' 
    ? (((300 - seconds) % 100) / 100) * 100 
    : 0;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
      <GlassCard className="mx-4 w-full max-w-md p-8 text-center border border-white/10 shadow-2xl relative overflow-hidden">
        {type === 'eye' ? (
          <>
            <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
              {/* Outer pulsing rings (breathing guide) */}
              <div className="absolute inset-0 rounded-full bg-accent-soft animate-breath border border-accent/20" />
              <div className="absolute h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 scale-110" />
              
              {/* Center icon */}
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                <Eye size={28} />
              </div>
            </div>

            <h2 className="font-rounded text-2xl font-bold text-vibrant-primary tracking-tight">
              Ocular Re-focus Loop
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Focus on a distant object (&gt;20 feet) and coordinate your breathing to the pulsing circle. Blink slowly as it shrinks.
            </p>

            {/* Instruction Cue based on 10s breath cycle */}
            <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {seconds % 10 < 4 ? 'Inhale & Focus' : seconds % 10 < 6 ? 'Hold' : 'Exhale & Blink'}
            </div>

            <div className="mt-6 font-rounded text-5xl font-extrabold text-vibrant-primary tabular-nums tracking-tighter">
              {format(seconds)}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-tertiary">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Blinks Counted: <span className="font-semibold text-text-secondary">{Math.floor(blinkCount / 3)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft border border-warn/20 text-warn">
              <Move size={24} />
            </div>
            
            <h2 className="font-rounded text-2xl font-bold text-vibrant-primary tracking-tight">
              Muscular Recovery Break
            </h2>
            <p className="mt-1 text-xs text-text-tertiary">
              Stand up, loosen your joints, and execute the physical stretches.
            </p>

            <div className="mt-4 font-rounded text-4xl font-extrabold text-vibrant-primary tabular-nums tracking-tighter">
              {format(seconds)}
            </div>

            {/* Interactive Carousel Card */}
            <div className="mt-6 bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col items-center relative min-h-[160px]">
              <div className="text-3xl mb-2">{stretches[activeStretch].icon}</div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                {stretches[activeStretch].title}
              </h3>
              <p className="mt-2 text-xs text-text-secondary px-2 leading-relaxed">
                {stretches[activeStretch].description}
              </p>

              {/* Progress indicator for active stretch (100s cycle) */}
              <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-warn transition-all duration-1000"
                  style={{ width: `${activeStretchProgress}%` }}
                />
              </div>

              {/* Navigation controls */}
              <div className="flex justify-between w-full mt-4">
                <button
                  onClick={handlePrevStretch}
                  className="p-1 rounded-lg bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[10px] text-text-tertiary self-center font-medium">
                  {activeStretch + 1} / {stretches.length}
                </span>
                <button
                  onClick={handleNextStretch}
                  className="p-1 rounded-lg bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}

        <button
          className="min-target mt-8 w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-text-primary hover:bg-white/20 transition cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] border border-white/5"
          onClick={onComplete}
        >
          {seconds > 0 ? (
            'Skip Break'
          ) : (
            <>
              <Check size={16} className="text-emerald-400" />
              Resume Work
            </>
          )}
        </button>
      </GlassCard>
    </div>
  );
}
