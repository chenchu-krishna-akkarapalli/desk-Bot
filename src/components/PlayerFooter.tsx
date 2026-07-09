import React, { useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat2,
  Shuffle,
  FolderOpen,
  FolderPlus,
  ListMusic,
  Heart,
  Search,
  X,
  Sparkles,
  Headphones,
  History,
} from 'lucide-react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { usePlayerStore, Track } from '../store/usePlayerStore';

const PlayerFooter: React.FC = () => {
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
    isImporting,
    togglePlayback,
    setTrackVolume,
    seekTrack,
    setRepeat,
    toggleShuffle,
    toggleDolby,
    nextTrack,
    prevTrack,
    browseAndLoadFiles,
    browseAndLoadFolder,
    toggleLike,
    setMoods,
    playTrackAtIndex,
  } = useAudioEngine();

  const { searchQuery, setSearchQuery, selectedMood, setSelectedMood } = usePlayerStore();
  const [localVolume, setLocalVolume] = useState(volume);
  const [showPlaylist, setShowPlaylist] = useState(false);

  // Sorting and Smart Album States
  const [sortBy, setSortBy] = useState<'a-z' | 'recently'>('recently');
  const [selectedAlbum, setSelectedAlbum] = useState<'all' | 'liked' | 'heavy' | 'recent'>('all');

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setLocalVolume(vol);
    setTrackVolume(vol);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTrack(parseFloat(e.target.value));
  };

  const handleRepeat = () => setRepeat((repeatMode + 1) % 3);
  const handleShuffle = () => toggleShuffle(!shuffle);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = currentTrack?.duration_secs ?? 0;

  // Helper for simple subsequence matching (e.g. "lf" matches "lofi")
  const fuzzyMatch = (str: string, pattern: string): boolean => {
    if (pattern.length < 2) return false;
    let patternIdx = 0;
    const lowerStr = str.toLowerCase();
    const lowerPattern = pattern.toLowerCase();
    for (let i = 0; i < lowerStr.length; i++) {
      if (lowerStr[i] === lowerPattern[patternIdx]) {
        patternIdx++;
        if (patternIdx === lowerPattern.length) return true;
      }
    }
    return false;
  };

  // Smart Search: tokenized, fuzzy subsequence and scored by relevance
  const smartSearch = (tracks: Track[], query: string): Track[] => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return tracks;

    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    
    return tracks
      .map(track => {
        const title = track.title.toLowerCase();
        const artist = track.artist.toLowerCase();
        const moods = (track.moods || []).map(m => m.toLowerCase());
        
        let score = 0;
        
        const matchesAllTokens = tokens.every(token => {
          if (title.includes(token)) {
            score += title.startsWith(token) ? 10 : 5;
            return true;
          }
          if (artist.includes(token)) {
            score += artist.startsWith(token) ? 8 : 4;
            return true;
          }
          if (moods.some(m => m.includes(token))) {
            score += 3;
            return true;
          }
          if (fuzzyMatch(title, token)) {
            score += 2;
            return true;
          }
          return false;
        });
        
        return { track, matches: matchesAllTokens, score };
      })
      .filter(item => item.matches)
      .sort((a, b) => b.score - a.score)
      .map(item => item.track);
  };

  // Filtered playlist based on search, mood, and selected smart album
  const filteredPlaylist = useMemo(() => {
    let list = [...playlist];

    // 1. Filter by Smart Album
    if (selectedAlbum === 'liked') {
      list = list.filter((t) => t.liked);
    } else if (selectedAlbum === 'heavy') {
      list = list.filter((t) => t.play_count > 0).sort((a, b) => b.play_count - a.play_count);
    } else if (selectedAlbum === 'recent') {
      list = [...list].sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));
    }

    // 2. Filter by Mood tag
    if (selectedMood !== 'All') {
      list = list.filter((t) => t.moods?.includes(selectedMood));
    }

    // 3. Search
    let searched = smartSearch(list, searchQuery);

    // 4. Sort (Skip if smart album has its own ordering like heavy rotation)
    if (selectedAlbum !== 'heavy') {
      if (sortBy === 'a-z') {
        searched = [...searched].sort((a, b) => a.title.localeCompare(b.title));
      } else if (sortBy === 'recently' && selectedAlbum !== 'recent') {
        searched = [...searched].sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));
      }
    }

    return searched;
  }, [playlist, selectedAlbum, selectedMood, searchQuery, sortBy]);

  const moodsList = ['All', 'Focus', 'Relax', 'Sleep'];

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-md relative z-30">
      {/* Playlist panel (collapsible) */}
      {showPlaylist && (
        <div className="border-b border-white/10 flex flex-col max-h-72">
          {/* Header Row showing Loaded Songs Count */}
          <div className="px-3 pt-3 pb-1 bg-white/5 flex items-center justify-between border-b border-white/5 shrink-0">
            <span className="text-xs font-semibold text-white font-rounded flex items-center gap-1.5">
              <ListMusic size={14} className="text-emerald-400" />
              Playlist
            </span>
            <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15">
              {playlist.length} {playlist.length === 1 ? 'track' : 'tracks'} loaded
            </span>
          </div>

          {/* Search, Albums and Filters Bar */}
          <div className="p-3 bg-white/5 border-b border-white/5 flex flex-col gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search tracks, artists, moods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            
            {/* Smart Albums selector */}
            <div className="flex flex-col gap-1 mt-0.5">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Smart Albums</span>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {[
                  { id: 'all', name: 'All Songs', icon: <Headphones size={10} /> },
                  { id: 'liked', name: 'Favorites', icon: <Heart size={10} className="fill-red-500/20 text-red-400" /> },
                  { id: 'heavy', name: 'Heavy Rotation', icon: <Sparkles size={10} className="text-amber-400" /> },
                  { id: 'recent', name: 'Recently Added', icon: <History size={10} className="text-cyan-400" /> },
                ].map((album) => (
                  <button
                    key={album.id}
                    onClick={() => {
                      setSelectedAlbum(album.id as any);
                      setSelectedMood('All');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1 border ${
                      selectedAlbum === album.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                        : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {album.icon}
                    <span>{album.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood tags and Sorting options */}
            <div className="flex items-center justify-between gap-2 mt-1 border-t border-white/5 pt-2">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {moodsList.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={`px-3 py-1 rounded-full text-[10px] font-medium transition cursor-pointer shrink-0 ${
                      selectedMood === mood
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 border-l border-white/10 pl-2 shrink-0">
                <span className="text-[9px] text-gray-400 font-bold uppercase mr-1">Sort:</span>
                <button
                  onClick={() => setSortBy('a-z')}
                  disabled={selectedAlbum === 'heavy'}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed ${
                    sortBy === 'a-z' && selectedAlbum !== 'heavy'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                  title="Sort A to Z"
                >
                  A-Z
                </button>
                <button
                  onClick={() => setSortBy('recently')}
                  disabled={selectedAlbum === 'heavy'}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed ${
                    sortBy === 'recently' && selectedAlbum !== 'heavy'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                  title="Sort by Recently Added"
                >
                  Recent
                </button>
              </div>
            </div>
          </div>

          {/* Playlist items */}
          <div className="overflow-y-auto max-h-48 animate-fade-in">
            {filteredPlaylist.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500 text-center">
                {playlist.length === 0 ? 'No tracks loaded — import files or folders to start.' : 'No matching tracks found.'}
              </p>
            ) : (
              <ul>
                {filteredPlaylist.map((track) => {
                  const idx = playlist.findIndex((t) => t.id === track.id);
                  return (
                    <li
                      key={track.id}
                      onClick={() => playTrackAtIndex(idx)}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition hover:bg-white/5 ${
                        currentTrack?.id === track.id
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-gray-300'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track.id);
                        }}
                        className="text-gray-500 hover:text-red-400 shrink-0 transition cursor-pointer"
                      >
                        <Heart
                          size={14}
                          className={track.liked ? 'fill-red-500 text-red-500' : ''}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-xs text-white">{track.title}</p>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[10px] text-gray-500">{track.artist}</p>
                          {track.play_count > 0 && (
                            <span className="text-[9px] text-amber-500/75 font-mono">
                              ▶ {track.play_count}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive Mood Toggles */}
                      <div className="flex gap-1 shrink-0">
                        {['Focus', 'Relax', 'Sleep'].map((mood) => {
                          const hasMood = track.moods?.includes(mood);
                          return (
                            <button
                              key={mood}
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentMoods = track.moods || [];
                                const newMoods = hasMood
                                  ? currentMoods.filter((m) => m !== mood)
                                  : [...currentMoods, mood];
                                setMoods(track.id, newMoods);
                              }}
                              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition cursor-pointer ${
                                hasMood
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/20'
                                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              {mood}
                            </button>
                          );
                        })}
                      </div>

                      <span className="shrink-0 text-xs text-gray-500 w-10 text-right">
                        {formatTime(track.duration_secs)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Progress bar */}
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="w-10 text-right">{formatTime(currentPosition)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentPosition}
            onChange={handleSeek}
            className="flex-1 h-1 cursor-pointer rounded-full bg-gray-700 accent-emerald-500"
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-4">
          {/* Track info + Import */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isImporting ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-[10px] text-emerald-400 font-medium animate-pulse shrink-0">
                <span className="h-3 w-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>Importing...</span>
              </div>
            ) : (
              <>
                <button
                  onClick={browseAndLoadFiles}
                  title="Import music files"
                  className="shrink-0 rounded-lg bg-emerald-500/20 p-2 text-emerald-400 transition hover:bg-emerald-500/30 cursor-pointer"
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  onClick={browseAndLoadFolder}
                  title="Import folder recursively"
                  className="shrink-0 rounded-lg bg-emerald-500/20 p-2 text-emerald-400 transition hover:bg-emerald-500/30 cursor-pointer"
                >
                  <FolderPlus size={16} />
                </button>
              </>
            )}

            {currentTrack && !isImporting && (
              <button
                onClick={() => toggleLike(currentTrack.id)}
                title={currentTrack.liked ? 'Unlike' : 'Like'}
                className="shrink-0 p-1.5 text-gray-400 hover:text-red-400 transition cursor-pointer"
              >
                <Heart
                  size={18}
                  className={currentTrack.liked ? 'fill-red-500 text-red-500' : ''}
                />
              </button>
            )}

            <div className="min-w-0 flex-1 ml-1">
              {isImporting ? (
                <p className="text-xs text-emerald-400/90 font-medium animate-pulse">
                  Scanning audio files and metadata...
                </p>
              ) : currentTrack ? (
                <>
                  <p className="truncate text-sm font-semibold text-white">
                    {currentTrack.title}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {currentTrack.artist}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  No track — click <span className="text-emerald-400">Browse</span> / <span className="text-emerald-400">Folder</span>
                </p>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleShuffle}
              className={`rounded-lg p-2 transition cursor-pointer ${
                shuffle
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>

            <button
              onClick={prevTrack}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 cursor-pointer"
              title="Previous"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlayback}
              className="rounded-full bg-emerald-500 p-3 text-white transition hover:bg-emerald-600 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>

            <button
              onClick={nextTrack}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 cursor-pointer"
              title="Next"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={handleRepeat}
              className={`rounded-lg p-2 transition cursor-pointer ${
                repeatMode > 0
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
              title={`Repeat: ${['Off', 'All', 'One'][repeatMode]}`}
            >
              <Repeat2 size={16} />
            </button>
          </div>

          {/* Dolby audio features */}
          <div className="flex shrink-0 items-center gap-1.5 border-l border-r border-white/10 px-3">
            <button
              onClick={() => toggleDolby(!dolbyDialog, dolbySpatial)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                dolbyDialog
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
              }`}
              title="Enhance dialogue/vocals in the audio"
            >
              <Sparkles size={11} className={dolbyDialog ? 'animate-pulse' : ''} />
              <span>Voice Boost</span>
            </button>
            <button
              onClick={() => toggleDolby(dolbyDialog, !dolbySpatial)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                dolbySpatial
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
              }`}
              title="Expand stereo field for 3D spatial audio"
            >
              <Headphones size={11} />
              <span>Spatial 3D</span>
            </button>
          </div>

          {/* Volume + playlist toggle */}
          <div className="flex min-w-max shrink-0 items-center gap-3">
            <Volume2 size={16} className="text-gray-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localVolume}
              onChange={handleVolumeChange}
              className="w-20 h-1 cursor-pointer rounded-full bg-gray-700 accent-emerald-500"
            />
            <span className="w-8 text-right text-xs text-gray-400">
              {Math.round(localVolume * 100)}%
            </span>

            <button
              onClick={() => setShowPlaylist((v) => !v)}
              title={showPlaylist ? 'Hide playlist' : 'Show playlist'}
              className={`rounded-lg p-2 transition cursor-pointer ${
                showPlaylist
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              {showPlaylist ? <X size={16} /> : <ListMusic size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerFooter;
