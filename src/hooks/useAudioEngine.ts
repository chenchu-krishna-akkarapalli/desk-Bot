import { useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore, Track, AudioDspConfig, DeviceProfile, DeviceClass } from '../store/usePlayerStore';

interface BackendDspConfig {
  pure_mode: boolean;
  voice_boost: boolean;
  spatial_widener: boolean;
  cheap_headphones: boolean;
  bass_enhancer: boolean;
  crossfeed: boolean;
  stereo_width: number;
  output_trim_db: number;
  mode: string;
  eq_sub_bass: number;
  eq_mid_bass: number;
  eq_vocal: number;
  eq_presence: number;
  eq_air: number;
}

interface BackendAudioMeters {
  peak_left: number;
  peak_right: number;
  rms_left: number;
  rms_right: number;
  correlation: number;
  limiter_activity: number;
  clipping: boolean;
}

interface BackendDeviceProfile {
  name: string;
  class: DeviceClass;
  class_label: string;
  description: string;
  suggested_mode: string;
  is_wireless: boolean;
  detected: boolean;
}

const fromBackendDeviceProfile = (d: BackendDeviceProfile): DeviceProfile => ({
  name: d.name,
  class: d.class,
  classLabel: d.class_label,
  description: d.description,
  suggestedMode: d.suggested_mode,
  isWireless: d.is_wireless,
  detected: d.detected,
});

interface BackendPlaybackState {
  is_playing: boolean;
  current_track: Track | null;
  current_position: number;
  volume: number;
  repeat_mode: number;
  shuffle: boolean;
  track_finished: boolean;
  dolby_dialog: boolean;
  dolby_spatial: boolean;
  dsp_config: BackendDspConfig;
}

const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'opus'];

const fromBackendDspConfig = (config: BackendDspConfig): AudioDspConfig => ({
  pureMode: config.pure_mode,
  voiceBoost: config.voice_boost,
  spatialWidener: config.spatial_widener,
  cheapHeadphones: config.cheap_headphones,
  bassEnhancer: config.bass_enhancer,
  crossfeed: config.crossfeed,
  stereoWidth: config.stereo_width,
  outputTrimDb: config.output_trim_db,
  mode: config.mode,
  eqSubBass: config.eq_sub_bass,
  eqMidBass: config.eq_mid_bass,
  eqVocal: config.eq_vocal,
  eqPresence: config.eq_presence,
  eqAir: config.eq_air,
});

const toBackendDspConfig = (config: AudioDspConfig): BackendDspConfig => ({
  pure_mode: config.pureMode,
  voice_boost: config.voiceBoost,
  spatial_widener: config.spatialWidener,
  cheap_headphones: config.cheapHeadphones,
  bass_enhancer: config.bassEnhancer,
  crossfeed: config.crossfeed,
  stereo_width: config.stereoWidth,
  output_trim_db: config.outputTrimDb,
  mode: config.mode,
  eq_sub_bass: config.eqSubBass,
  eq_mid_bass: config.eqMidBass,
  eq_vocal: config.eqVocal,
  eq_presence: config.eqPresence,
  eq_air: config.eqAir,
});

export const useAudioEngine = () => {
  const {
    isPlaying,
    currentTrack,
    currentPosition,
    volume,
    repeatMode,
    shuffle,
    dolbyDialog,
    dolbySpatial,
    dspConfig,
    playlist,
    setIsPlaying,
    setCurrentTrack,
    setCurrentPosition,
    setVolume,
    setRepeatMode,
    setShuffle,
    setDolbyFeatures,
    setDspConfig,
    addTrack,
    isImporting,
    setImporting,
  } = usePlayerStore();

  const togglePlayback = useCallback(async () => {
    try {
      await invoke('toggle_playback');
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  }, []);

  const setTrackVolume = useCallback(async (vol: number) => {
    try {
      await invoke('set_volume', { volume: vol });
      setVolume(vol);
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }, [setVolume]);

  const seekTrack = useCallback(async (position: number) => {
    try {
      await invoke('seek_track', { position_secs: position });
      setCurrentPosition(position);
    } catch (error) {
      console.error('Failed to seek track:', error);
    }
  }, [setCurrentPosition]);

  const setRepeat = useCallback(async (mode: number) => {
    try {
      await invoke('set_repeat_mode', { mode });
      setRepeatMode(mode);
    } catch (error) {
      console.error('Failed to set repeat mode:', error);
    }
  }, [setRepeatMode]);

  const toggleShuffle = useCallback(async (enabled: boolean) => {
    try {
      await invoke('set_shuffle', { enabled });
      setShuffle(enabled);
    } catch (error) {
      console.error('Failed to set shuffle:', error);
    }
  }, [setShuffle]);

  const toggleDolby = useCallback(async (dialog: boolean, spatial: boolean) => {
    try {
      await invoke('set_dolby_features', { dialog, spatial });
      setDolbyFeatures(dialog, spatial);
    } catch (error) {
      console.error('Failed to set Dolby features:', error);
    }
  }, [setDolbyFeatures]);

  const updateDspConfig = useCallback(async (nextConfig: AudioDspConfig) => {
    try {
      await invoke('set_dsp_config', { dspConfig: toBackendDspConfig(nextConfig) });
      setDspConfig(nextConfig);
    } catch (error) {
      console.error('Failed to update DSP config:', error);
    }
  }, [setDspConfig]);

  const playTrackAtIndex = useCallback(async (index: number) => {
    try {
      await invoke('play_track_at_index', { index });
    } catch (error) {
      console.error('Failed to play track at index:', error);
    }
  }, []);

  const nextTrack = useCallback(async () => {
    try {
      await invoke('next_track');
    } catch (error) {
      console.error('Failed to advance track:', error);
    }
  }, []);

  const prevTrack = useCallback(async () => {
    try {
      await invoke('prev_track');
    } catch (error) {
      console.error('Failed to go to previous track:', error);
    }
  }, []);

  const browseAndLoadFiles = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
      });
      if (!selected) return;

      setImporting(true);
      const paths = Array.isArray(selected) ? selected : [selected];
      const tracks = await invoke<Track[]>('load_music_files', { paths });

      // Update frontend playlist store
      tracks.forEach((t) => addTrack(t));
    } catch (error) {
      console.error('Failed to load music files:', error);
    } finally {
      setImporting(false);
    }
  }, [addTrack, setImporting]);

  const browseAndLoadFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder',
      });
      if (!selected) return;

      setImporting(true);
      const path = Array.isArray(selected) ? selected[0] : selected;
      const tracks = await invoke<Track[]>('load_music_folder', { path });

      // Update frontend playlist store
      tracks.forEach((t) => addTrack(t));
    } catch (error) {
      console.error('Failed to load music folder:', error);
    } finally {
      setImporting(false);
    }
  }, [addTrack, setImporting]);

  const toggleLike = useCallback(async (trackId: string) => {
    try {
      const liked = await invoke<boolean>('toggle_like_track', { trackId });
      usePlayerStore.getState().toggleLikeTrack(trackId);
      return liked;
    } catch (error) {
      console.error('Failed to toggle like:', error);
      return false;
    }
  }, []);

  const setMoods = useCallback(async (trackId: string, moods: string[]) => {
    try {
      await invoke('set_track_moods', { trackId, moods });
      usePlayerStore.getState().setTrackMoods(trackId, moods);
    } catch (error) {
      console.error('Failed to set moods:', error);
    }
  }, []);

  const detectOutputDevice = useCallback(async () => {
    try {
      const profile = await invoke<BackendDeviceProfile>('get_output_device');
      usePlayerStore.getState().setOutputDevice(fromBackendDeviceProfile(profile));
    } catch (error) {
      console.error('Failed to detect output device:', error);
    }
  }, []);

  const [isSynced, setIsSynced] = useState(false);

  // Detect the active output device once on mount for hardware-aware tuning.
  useEffect(() => {
    void detectOutputDevice();
  }, [detectOutputDevice]);

  // Sync persisted Zustand settings/playlist to Rust backend on mount
  useEffect(() => {
    const syncPersistedState = async () => {
      try {
        const store = usePlayerStore.getState();
        // Sync playlist first
        await invoke('sync_playlist_cmd', { playlist: store.playlist });
        // Sync active track
        await invoke('sync_active_track_cmd', {
          trackId: store.currentTrack?.id || null,
          position: store.currentPosition || 0.0,
        });
        // Sync volume, shuffle, repeat mode, dolby features
        await invoke('set_volume', { volume: store.volume });
        await invoke('set_repeat_mode', { mode: store.repeatMode });
        await invoke('set_shuffle', { enabled: store.shuffle });
        await invoke('set_dsp_config', { dspConfig: toBackendDspConfig(store.dspConfig) });
        console.log('[AUDIO ENGINE] Successfully synchronized persisted state to backend');
      } catch (err) {
        console.error('[AUDIO ENGINE] Failed to sync persisted state:', err);
      } finally {
        setIsSynced(true);
      }
    };
    syncPersistedState();
  }, []);

  // Poll playback state at 250 ms and sync frontend store
  useEffect(() => {
    if (!isSynced) return;

    const interval = setInterval(async () => {
      try {
        const state = await invoke<BackendPlaybackState>('get_playback_state');
        setCurrentPosition(state.current_position);
        setIsPlaying(state.is_playing);
        setCurrentTrack(state.current_track);
        usePlayerStore.getState().setDspConfig(fromBackendDspConfig(state.dsp_config));
      } catch {
        // Silently ignore backend polling errors
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isSynced, setCurrentPosition, setIsPlaying, setCurrentTrack]);

  // Poll audio meters at a faster cadence for responsive metering
  useEffect(() => {
    if (!isSynced) return;

    const interval = setInterval(async () => {
      try {
        const m = await invoke<BackendAudioMeters>('get_audio_meters');
        usePlayerStore.getState().setAudioMeters({
          peakLeft: m.peak_left,
          peakRight: m.peak_right,
          rmsLeft: m.rms_left,
          rmsRight: m.rms_right,
          correlation: m.correlation,
          limiterActivity: m.limiter_activity,
          clipping: m.clipping,
        });
      } catch {
        // Silently ignore backend polling errors
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isSynced]);

  return {
    isPlaying,
    currentTrack,
    currentPosition,
    volume,
    repeatMode,
    shuffle,
    dolbyDialog,
    dolbySpatial,
    dspConfig,
    playlist,
    isImporting,
    togglePlayback,
    setTrackVolume,
    seekTrack,
    setRepeat,
    toggleShuffle,
    toggleDolby,
    updateDspConfig,
    playTrackAtIndex,
    nextTrack,
    prevTrack,
    browseAndLoadFiles,
    browseAndLoadFolder,
    toggleLike,
    setMoods,
    detectOutputDevice,
  };
};
