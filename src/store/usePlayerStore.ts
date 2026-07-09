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

interface PlaybackState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentPosition: number;
  volume: number;
  repeatMode: number; // 0: none, 1: one, 2: all
  shuffle: boolean;
  dolbyDialog: boolean;
  dolbySpatial: boolean;
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
  setDolbyFeatures: (dialog, spatial) => set({ dolbyDialog: dialog, dolbySpatial: spatial }),
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
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        shuffle: state.shuffle,
        dolbyDialog: state.dolbyDialog,
        dolbySpatial: state.dolbySpatial,
        metrics: state.metrics,
        playlist: state.playlist,
        currentTrack: state.currentTrack,
        currentPosition: state.currentPosition,
      }),
    }
  )
);
