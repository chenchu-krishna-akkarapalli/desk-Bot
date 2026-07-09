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
  SlidersHorizontal,
  Waves,
} from 'lucide-react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import {
  usePlayerStore,
  Track,
  LISTENING_MODES,
  getSignalPath,
} from '../store/usePlayerStore';

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
    nextTrack,
    prevTrack,
    browseAndLoadFiles,
    browseAndLoadFolder,
    toggleLike,
    setMoods,
    playTrackAtIndex,
  } = useAudioEngine();

  const { searchQuery, setSearchQuery, selectedMood, setSelectedMood, audioMeters } = usePlayerStore();
  const [localVolume, setLocalVolume] = useState(volume);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showDspPanel, setShowDspPanel] = useState(false);

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

  const signalPath = getSignalPath(dspConfig);

  // Perceptual (sqrt) scaling of a linear 0..1 level to a bar width percentage.
  const meterPct = (v: number): number =>
    Math.min(100, Math.max(0, Math.round(Math.sqrt(Math.max(0, v)) * 100)));

  // Linear amplitude → dBFS string for the numeric readout.
  const toDb = (v: number): string => {
    if (v <= 0.0001) return '-∞';
    return `${(20 * Math.log10(v)).toFixed(0)}`;
  };

  const applyListeningMode = (modeId: string) => {
    const mode = LISTENING_MODES.find((m) => m.id === modeId);
    if (!mode) return;
    void updateDspConfig({
      ...dspConfig,
      ...mode.policy,
    });
  };

  const applyDspPreset = (preset: 'flat' | 'bass' | 'vocal' | 'clear' | 'balanced') => {
    const presets = {
      flat: { eqSubBass: 0, eqMidBass: 0, eqVocal: 0, eqPresence: 0, eqAir: 0 },
      bass: { eqSubBass: 4, eqMidBass: 2, eqVocal: -1, eqPresence: 0, eqAir: 1 },
      vocal: { eqSubBass: -1, eqMidBass: -0.5, eqVocal: 3, eqPresence: 2, eqAir: 1 },
      clear: { eqSubBass: 5, eqMidBass: 2.5, eqVocal: 0.5, eqPresence: 1.5, eqAir: 2 },
      balanced: { eqSubBass: 1.5, eqMidBass: 1, eqVocal: 1, eqPresence: 1, eqAir: 1.5 },
    } as const;

    // Manual EQ tweaks break the active mode's policy → mark as custom.
    void updateDspConfig({
      ...dspConfig,
      ...presets[preset],
      mode: 'custom',
    });
  };

  const updateEqBand = (key: 'eqSubBass' | 'eqMidBass' | 'eqVocal' | 'eqPresence' | 'eqAir', value: number) => {
    void updateDspConfig({
      ...dspConfig,
      [key]: value,
      mode: 'custom',
    });
  };

  const toggleDspFlag = (key: 'pureMode' | 'cheapHeadphones' | 'bassEnhancer' | 'crossfeed') => {
    void updateDspConfig({
      ...dspConfig,
      [key]: !dspConfig[key],
      mode: 'custom',
    });
  };

  const updateStereoWidth = (value: number) => {
    void updateDspConfig({ ...dspConfig, stereoWidth: value, mode: 'custom' });
  };

  const updateOutputTrim = (value: number) => {
    void updateDspConfig({ ...dspConfig, outputTrimDb: value, mode: 'custom' });
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-md relative z-30">
      {showDspPanel && (
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(8,15,18,0.94),rgba(5,8,10,0.96))] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div>
                <p className="text-xs font-semibold text-white">DeskWell DSP Rack</p>
                <p className="text-[10px] text-gray-400">Signal path, listening modes, crossfeed, width, and 5-band EQ.</p>
              </div>
              {/* Signal path indicator — always shows whether audio is untouched or processed */}
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  signalPath === 'reference'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                }`}
                title={
                  signalPath === 'reference'
                    ? 'Reference path — bit-perfect, DSP fully bypassed'
                    : 'Enhanced path — real-time DSP is active'
                }
              >
                <Waves size={11} />
                {signalPath === 'reference' ? 'Reference' : 'Enhanced'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['flat', 'Flat'],
                ['bass', 'Bass Boost'],
                ['vocal', 'Vocal'],
                ['clear', 'ClearBass'],
                ['balanced', 'Balanced'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => applyDspPreset(id as 'flat' | 'bass' | 'vocal' | 'clear' | 'balanced')}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300 transition hover:bg-white/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Listening modes — each applies a full DSP policy bundle */}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Listening Mode</p>
              {dspConfig.mode === 'custom' && (
                <span className="text-[9px] font-semibold text-gray-500">Custom (manual overrides)</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LISTENING_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => applyListeningMode(mode.id)}
                  title={mode.description}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                    dspConfig.mode === mode.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {mode.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500">
              {LISTENING_MODES.find((m) => m.id === dspConfig.mode)?.description ??
                'Custom configuration — adjust any control below to fine-tune.'}
            </p>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_2fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Modes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleDspFlag('pureMode')}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    dspConfig.pureMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-gray-300 border border-white/10'
                  }`}
                >
                  Pure Mode
                </button>
                <button
                  onClick={() => toggleDspFlag('cheapHeadphones')}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    dspConfig.cheapHeadphones ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-gray-300 border border-white/10'
                  }`}
                >
                  Cheap Headphones Fix
                </button>
                <button
                  onClick={() => toggleDspFlag('bassEnhancer')}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    dspConfig.bassEnhancer ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-gray-300 border border-white/10'
                  }`}
                >
                  Deep Bass Harmonics
                </button>
                <button
                  onClick={() => toggleDspFlag('crossfeed')}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    dspConfig.crossfeed ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-gray-300 border border-white/10'
                  }`}
                  title="Relax hard-panned stereo for natural headphone listening"
                >
                  Crossfeed
                </button>
              </div>

              {/* Stereo width + output trim — disabled/greyed in Reference path */}
              <div className={`mt-3 space-y-3 ${dspConfig.pureMode ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="block">
                  <div className="flex items-center justify-between text-[10px] text-gray-300">
                    <span className="font-semibold">Stereo Width</span>
                    <span className="text-gray-400">{dspConfig.stereoWidth.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={dspConfig.stereoWidth}
                    onChange={(e) => updateStereoWidth(parseFloat(e.target.value))}
                    className="mt-1 w-full h-1 cursor-pointer rounded-full bg-gray-700 accent-cyan-500"
                  />
                </label>
                <label className="block">
                  <div className="flex items-center justify-between text-[10px] text-gray-300">
                    <span className="font-semibold">Output Trim (headroom)</span>
                    <span className="text-gray-400">{dspConfig.outputTrimDb > 0 ? '+' : ''}{dspConfig.outputTrimDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="6"
                    step="0.5"
                    value={dspConfig.outputTrimDb}
                    onChange={(e) => updateOutputTrim(parseFloat(e.target.value))}
                    className="mt-1 w-full h-1 cursor-pointer rounded-full bg-gray-700 accent-amber-500"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Equalizer</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-5">
                {[
                  ['eqSubBass', '60Hz', dspConfig.eqSubBass],
                  ['eqMidBass', '250Hz', dspConfig.eqMidBass],
                  ['eqVocal', '1kHz', dspConfig.eqVocal],
                  ['eqPresence', '4kHz', dspConfig.eqPresence],
                  ['eqAir', '12kHz', dspConfig.eqAir],
                ].map(([key, label, value]) => (
                  <label key={key} className="flex flex-col items-center gap-2 rounded-xl bg-black/20 px-2 py-3">
                    <span className="text-[10px] font-semibold text-gray-300">{label}</span>
                    <input
                      type="range"
                      min="-6"
                      max="6"
                      step="0.5"
                      value={value as number}
                      onChange={(e) => updateEqBand(key as 'eqSubBass' | 'eqMidBass' | 'eqVocal' | 'eqPresence' | 'eqAir', parseFloat(e.target.value))}
                      className="h-24 w-1 appearance-none cursor-pointer rounded-full bg-gray-700 accent-emerald-500 [writing-mode:bt-lr]"
                    />
                    <span className="text-[10px] text-gray-400">{value as number > 0 ? '+' : ''}{value as number} dB</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Pro monitoring — live meters tapped from the DSP output stage */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Meters</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    audioMeters.limiterActivity > 0.001
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-gray-500 border border-white/10'
                  }`}
                  title="Limiter engagement over the last block"
                >
                  Limiter
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    audioMeters.clipping
                      ? 'bg-red-500/25 text-red-300 border border-red-500/40'
                      : 'bg-white/5 text-gray-500 border border-white/10'
                  }`}
                  title="Full-scale clipping detected"
                >
                  Clip
                </span>
              </div>
            </div>

            <div className="mt-2 grid gap-3 lg:grid-cols-[2fr_1.4fr]">
              {/* Peak + RMS bars */}
              <div className="space-y-2">
                {([
                  ['L', audioMeters.peakLeft, audioMeters.rmsLeft],
                  ['R', audioMeters.peakRight, audioMeters.rmsRight],
                ] as const).map(([label, peak, rms]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-3 text-[10px] font-bold text-gray-400">{label}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-black/40">
                      {/* RMS underlay */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/30"
                        style={{ width: `${meterPct(rms)}%` }}
                      />
                      {/* Peak fill */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                        style={{
                          width: `${meterPct(peak)}%`,
                          background:
                            peak >= 0.9
                              ? 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)'
                              : peak >= 0.7
                              ? 'linear-gradient(90deg,#10b981,#f59e0b)'
                              : '#10b981',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-[9px] font-mono text-gray-400">{toDb(peak)}</span>
                  </div>
                ))}
              </div>

              {/* Stereo correlation */}
              <div>
                <div className="flex items-center justify-between text-[9px] text-gray-400">
                  <span>Anti-phase</span>
                  <span className="font-semibold text-gray-300">Correlation {audioMeters.correlation.toFixed(2)}</span>
                  <span>Mono</span>
                </div>
                <div className="relative mt-1 h-3 rounded-full bg-black/40">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                  <div
                    className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full ${
                      audioMeters.correlation < -0.2 ? 'bg-red-400' : 'bg-cyan-400'
                    }`}
                    style={{ left: `${((audioMeters.correlation + 1) / 2) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] text-gray-500">
                  {audioMeters.correlation < -0.2
                    ? 'Negative correlation — may collapse in mono.'
                    : 'Healthy stereo image.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowDspPanel((value) => !value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                showDspPanel
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
              }`}
              title="Open DSP rack"
            >
              {dspConfig.pureMode ? <Waves size={11} /> : <SlidersHorizontal size={11} />}
              <span>DSP Rack</span>
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
