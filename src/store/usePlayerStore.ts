import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  id: string;
  title: string;
  artist: string;
  path: string;
  duration_secs: number;
  liked: boolean;
  moods: string[];
  play_count: number;
  skip_count: number;
}

export interface AudioDspConfig {
  pureMode: boolean;
  voiceBoost: boolean;
  spatialWidener: boolean;
  cheapHeadphones: boolean;
  bassEnhancer: boolean;
  crossfeed: boolean;
  stereoWidth: number;
  outputTrimDb: number;
  mode: string;
  eqSubBass: number;
  eqMidBass: number;
  eqVocal: number;
  eqPresence: number;
  eqAir: number;
}

/** Real-time monitoring snapshot from the audio engine. */
export interface AudioMeters {
  peakLeft: number;
  peakRight: number;
  rmsLeft: number;
  rmsRight: number;
  correlation: number;
  limiterActivity: number;
  clipping: boolean;
}

export const emptyMeters: AudioMeters = {
  peakLeft: 0,
  peakRight: 0,
  rmsLeft: 0,
  rmsRight: 0,
  correlation: 0,
  limiterActivity: 0,
  clipping: false,
};

/** Signal path derived from the DSP config. */
export type SignalPath = 'reference' | 'enhanced';

export const getSignalPath = (config: AudioDspConfig): SignalPath =>
  config.pureMode ? 'reference' : 'enhanced';

export interface ListeningModeDef {
  id: string;
  name: string;
  description: string;
  /** Partial DSP policy bundle applied on top of the current config. */
  policy: Partial<AudioDspConfig>;
}

/**
 * Listening modes are policy bundles, not just labels. Selecting one applies
 * the bundle to the granular DSP config; the user can then override any
 * control (which flips `mode` to 'custom'). Each bundle sets `mode` so the
 * UI can reflect the active policy.
 */
export const LISTENING_MODES: ListeningModeDef[] = [
  {
    id: 'reference',
    name: 'Reference',
    description: 'Bit-perfect, fully bypassed. Trust the source — no processing.',
    policy: {
      mode: 'reference',
      pureMode: true,
    },
  },
  {
    id: 'audiophile',
    name: 'Audiophile',
    description: 'Transparent. Gentle crossfeed only, no coloration.',
    policy: {
      mode: 'audiophile',
      pureMode: false,
      cheapHeadphones: false,
      bassEnhancer: false,
      voiceBoost: false,
      spatialWidener: false,
      crossfeed: true,
      stereoWidth: 1.0,
      outputTrimDb: 0,
      eqSubBass: 0, eqMidBass: 0, eqVocal: 0, eqPresence: 0, eqAir: 0,
    },
  },
  {
    id: 'music',
    name: 'Music Enjoyment',
    description: 'Balanced enhancement with a wide, lively image.',
    policy: {
      mode: 'music',
      pureMode: false,
      cheapHeadphones: true,
      bassEnhancer: true,
      voiceBoost: false,
      spatialWidener: true,
      crossfeed: false,
      stereoWidth: 1.35,
      outputTrimDb: 0,
      eqSubBass: 2, eqMidBass: 1, eqVocal: 0, eqPresence: 1, eqAir: 1.5,
    },
  },
  {
    id: 'cinema',
    name: 'Cinema',
    description: 'Immersive width plus dialogue clarity for film and TV.',
    policy: {
      mode: 'cinema',
      pureMode: false,
      cheapHeadphones: true,
      bassEnhancer: true,
      voiceBoost: true,
      spatialWidener: true,
      crossfeed: false,
      stereoWidth: 1.6,
      outputTrimDb: -1,
      eqSubBass: 3, eqMidBass: 1, eqVocal: 1.5, eqPresence: 1, eqAir: 1,
    },
  },
  {
    id: 'gaming',
    name: 'Competitive Gaming',
    description: 'Forward mids and controlled width for positional cues.',
    policy: {
      mode: 'gaming',
      pureMode: false,
      cheapHeadphones: false,
      bassEnhancer: false,
      voiceBoost: true,
      spatialWidener: true,
      crossfeed: false,
      stereoWidth: 1.5,
      outputTrimDb: 0,
      eqSubBass: -1, eqMidBass: 0, eqVocal: 2, eqPresence: 3, eqAir: 1,
    },
  },
  {
    id: 'speech',
    name: 'Speech / Podcast',
    description: 'Vocal-forward and centered for spoken word.',
    policy: {
      mode: 'speech',
      pureMode: false,
      cheapHeadphones: false,
      bassEnhancer: false,
      voiceBoost: true,
      spatialWidener: false,
      crossfeed: true,
      stereoWidth: 1.0,
      outputTrimDb: 0,
      eqSubBass: -2, eqMidBass: -1, eqVocal: 3, eqPresence: 2, eqAir: 0,
    },
  },
  {
    id: 'night',
    name: 'Night Listening',
    description: 'Reduced dynamics and softened lows for low-volume listening.',
    policy: {
      mode: 'night',
      pureMode: false,
      cheapHeadphones: true,
      bassEnhancer: false,
      voiceBoost: true,
      spatialWidener: false,
      crossfeed: true,
      stereoWidth: 1.0,
      outputTrimDb: -3,
      eqSubBass: -2, eqMidBass: -1, eqVocal: 1, eqPresence: 0.5, eqAir: -1,
    },
  },
  {
    id: 'production',
    name: 'Production / Monitoring',
    description: 'Flat and honest with headroom reserved for peaks.',
    policy: {
      mode: 'production',
      pureMode: false,
      cheapHeadphones: false,
      bassEnhancer: false,
      voiceBoost: false,
      spatialWidener: false,
      crossfeed: false,
      stereoWidth: 1.0,
      outputTrimDb: -3,
      eqSubBass: 0, eqMidBass: 0, eqVocal: 0, eqPresence: 0, eqAir: 0,
    },
  },
];

interface PlaybackState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentPosition: number;
  volume: number;
  repeatMode: number; // 0: none, 1: one, 2: all
  shuffle: boolean;
  dolbyDialog: boolean;
  dolbySpatial: boolean;
  dspConfig: AudioDspConfig;
}

interface ScreenTimeMetrics {
  screenTimeMinutes: number;
  breaksTaken: number;
  stepsToday: number;
  waterIntakeMl: number;
  lastBreakTime: string;
}

interface PlayerStoreState extends PlaybackState {
  playlist: Track[];
  searchQuery: string;
  selectedMood: string;
  isImporting: boolean;
  // Player actions
  setIsPlaying: (playing: boolean) => void;
  setCurrentTrack: (track: Track | null) => void;
  setCurrentPosition: (position: number) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (mode: number) => void;
  setShuffle: (enabled: boolean) => void;
  setDolbyFeatures: (dialog: boolean, spatial: boolean) => void;
  setDspConfig: (config: AudioDspConfig) => void;
  audioMeters: AudioMeters;
  setAudioMeters: (meters: AudioMeters) => void;
  addTrack: (track: Track) => void;
  setPlaylist: (tracks: Track[]) => void;
  clearPlaylist: () => void;
  
  setSearchQuery: (query: string) => void;
  setSelectedMood: (mood: string) => void;
  setImporting: (importing: boolean) => void;
  toggleLikeTrack: (trackId: string) => void;
  setTrackMoods: (trackId: string, moods: string[]) => void;
  
  // Metrics
  metrics: ScreenTimeMetrics;
  setMetrics: (metrics: Partial<ScreenTimeMetrics>) => void;
  
  // Break state
  isBreakActive: boolean;
  setBreakActive: (active: boolean) => void;
  breakCountdown: number;
  setBreakCountdown: (seconds: number) => void;
  decrementBreakCountdown: () => void;
}

const initialMetrics: ScreenTimeMetrics = {
  screenTimeMinutes: 0,
  breaksTaken: 0,
  stepsToday: 0,
  waterIntakeMl: 0,
  lastBreakTime: '',
};

const defaultDspConfig: AudioDspConfig = {
  pureMode: false,
  voiceBoost: true,
  spatialWidener: true,
  cheapHeadphones: true,
  bassEnhancer: true,
  crossfeed: false,
  stereoWidth: 1.35,
  outputTrimDb: 0,
  mode: 'custom',
  eqSubBass: 0,
  eqMidBass: 0,
  eqVocal: 0,
  eqPresence: 0,
  eqAir: 0,
};

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set) => ({
  // Playback state
  isPlaying: false,
  currentTrack: null,
  currentPosition: 0,
  volume: 0.8,
  repeatMode: 0,
  shuffle: false,
  dolbyDialog: true,
  dolbySpatial: true,
  dspConfig: defaultDspConfig,
  playlist: [],
  searchQuery: '',
  selectedMood: 'All',
  isImporting: false,
  
  // Metrics
  metrics: initialMetrics,
  isBreakActive: false,
  breakCountdown: 0,
  
  // Player actions
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setCurrentPosition: (position) => set({ currentPosition: position }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setRepeatMode: (mode) => set({ repeatMode: mode % 3 }),
  setShuffle: (enabled) => set({ shuffle: enabled }),
  setDolbyFeatures: (dialog, spatial) => set((state) => ({
    dolbyDialog: dialog,
    dolbySpatial: spatial,
    dspConfig: {
      ...state.dspConfig,
      voiceBoost: dialog,
      spatialWidener: spatial,
    },
  })),
  setDspConfig: (config) => set({
    dspConfig: config,
    dolbyDialog: config.voiceBoost,
    dolbySpatial: config.spatialWidener,
  }),
  audioMeters: emptyMeters,
  setAudioMeters: (meters) => set({ audioMeters: meters }),
  addTrack: (track) => set((state) => ({ playlist: [...state.playlist, track] })),
  setPlaylist: (tracks) => set({ playlist: tracks }),
  clearPlaylist: () => set({ playlist: [] }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedMood: (mood) => set({ selectedMood: mood }),
  setImporting: (importing) => set({ isImporting: importing }),
  
  toggleLikeTrack: (trackId) => set((state) => {
    const updatedPlaylist = state.playlist.map((t) => 
      t.id === trackId ? { ...t, liked: !t.liked } : t
    );
    const updatedCurrent = state.currentTrack && state.currentTrack.id === trackId
      ? { ...state.currentTrack, liked: !state.currentTrack.liked }
      : state.currentTrack;
    return { playlist: updatedPlaylist, currentTrack: updatedCurrent };
  }),
  
  setTrackMoods: (trackId, moods) => set((state) => {
    const updatedPlaylist = state.playlist.map((t) => 
      t.id === trackId ? { ...t, moods } : t
    );
    const updatedCurrent = state.currentTrack && state.currentTrack.id === trackId
      ? { ...state.currentTrack, moods }
      : state.currentTrack;
    return { playlist: updatedPlaylist, currentTrack: updatedCurrent };
  }),
  
  // Metrics
  setMetrics: (newMetrics) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
    })),
  
  // Break state
  setBreakActive: (active) => set({ isBreakActive: active }),
  setBreakCountdown: (seconds) => set({ breakCountdown: seconds }),
  decrementBreakCountdown: () =>
    set((state) => ({ breakCountdown: Math.max(0, state.breakCountdown - 1) })),
    }),
    {
      name: 'player-storage',
      // Backfill any DSP fields added after a user's config was persisted so
      // older stored configs don't surface `undefined` controls in the UI.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PlayerStoreState>;
        return {
          ...current,
          ...saved,
          dspConfig: { ...defaultDspConfig, ...(saved.dspConfig ?? {}) },
        };
      },
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        shuffle: state.shuffle,
        dolbyDialog: state.dolbyDialog,
        dolbySpatial: state.dolbySpatial,
        dspConfig: state.dspConfig,
        metrics: state.metrics,
        playlist: state.playlist,
        currentTrack: state.currentTrack,
        currentPosition: state.currentPosition,
      }),
    }
  )
);
