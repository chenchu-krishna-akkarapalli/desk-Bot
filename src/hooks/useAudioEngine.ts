import { useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { usePlayerStore, Track } from '../store/usePlayerStore';

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
}

const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'opus'];

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
    playlist,
    setIsPlaying,
    setCurrentTrack,
    setCurrentPosition,
    setVolume,
    setRepeatMode,
    setShuffle,
    setDolbyFeatures,
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

  const [isSynced, setIsSynced] = useState(false);

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
        await invoke('set_dolby_features', { dialog: store.dolbyDialog, spatial: store.dolbySpatial });
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
        // Sync Dolby states
        usePlayerStore.getState().setDolbyFeatures(state.dolby_dialog, state.dolby_spatial);
      } catch {
        // Silently ignore backend polling errors
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isSynced, setCurrentPosition, setIsPlaying, setCurrentTrack]);

  return {
    isPlaying,
    currentTrack,
    currentPosition,
    volume,
    repeatMode,
    shuffle,
    dolbyDialog,
    dolbySpatial,
    playlist,
    isImporting,
    togglePlayback,
    setTrackVolume,
    seekTrack,
    setRepeat,
    toggleShuffle,
    toggleDolby,
    playTrackAtIndex,
    nextTrack,
    prevTrack,
    browseAndLoadFiles,
    browseAndLoadFolder,
    toggleLike,
    setMoods,
  };
};
