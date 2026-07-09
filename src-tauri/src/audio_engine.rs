use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use lofty::{Accessor, AudioFile, TaggedFileExt};
use rodio::{Decoder, OutputStreamHandle, Sink, Source};
use serde::{Deserialize, Serialize};
use tauri::command;
use rand::seq::SliceRandom;

static TRACK_ID: AtomicU64 = AtomicU64::new(1);

pub struct AudioOutputStream(pub rodio::OutputStream);
unsafe impl Send for AudioOutputStream {}
unsafe impl Sync for AudioOutputStream {}

// Dolby Audio Processing Source wrapper
pub struct DolbySource<I>
where
    I: Source<Item = f32>,
{
    input: I,
    dialog_enhance: Arc<AtomicBool>,
    spatial_widener: Arc<AtomicBool>,
    left_prev: f32,
    right_prev: f32,
    right_buffer: Option<f32>,
}

impl<I> DolbySource<I>
where
    I: Source<Item = f32>,
{
    pub fn new(input: I, dialog_enhance: Arc<AtomicBool>, spatial_widener: Arc<AtomicBool>) -> Self {
        DolbySource {
            input,
            dialog_enhance,
            spatial_widener,
            left_prev: 0.0,
            right_prev: 0.0,
            right_buffer: None,
        }
    }
}

impl<I> Iterator for DolbySource<I>
where
    I: Source<Item = f32>,
{
    type Item = f32;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if let Some(r_sample) = self.right_buffer.take() {
            return Some(r_sample);
        }

        let in_channels = self.input.channels();
        
        let (mut l, mut r) = if in_channels == 2 {
            let sample_l_raw = self.input.next()?;
            let sample_r_raw = self.input.next()?;
            (sample_l_raw, sample_r_raw)
        } else if in_channels == 1 {
            let sample = self.input.next()?;
            (sample, sample)
        } else {
            return self.input.next();
        };

        let dialog = self.dialog_enhance.load(Ordering::Relaxed);
        let spatial = self.spatial_widener.load(Ordering::Relaxed);

        // 1. Dolby Dialog Enhancer: Vocal frequency band peaking boost
        if dialog {
            let l_high = l - self.left_prev;
            let r_high = r - self.right_prev;
            
            self.left_prev = l;
            self.right_prev = r;

            l += l_high * 0.45;
            r += r_high * 0.45;
        }

        // 2. Dolby Spatial Widener: Mid-Side separation widening
        if spatial {
            let mid = (l + r) * 0.707;
            let side = (l - r) * 0.707;
            let side_widened = side * 1.45;
            l = (mid + side_widened) * 0.707;
            r = (mid - side_widened) * 0.707;
        }

        l = l.clamp(-1.0, 1.0);
        r = r.clamp(-1.0, 1.0);

        self.right_buffer = Some(r);
        Some(l)
    }
}

impl<I> Source for DolbySource<I>
where
    I: Source<Item = f32>,
{
    #[inline]
    fn current_frame_len(&self) -> Option<usize> {
        self.input.current_frame_len()
    }

    #[inline]
    fn channels(&self) -> u16 {
        let chans = self.input.channels();
        if chans == 1 || chans == 2 {
            2
        } else {
            chans
        }
    }

    #[inline]
    fn sample_rate(&self) -> u32 {
        self.input.sample_rate()
    }

    #[inline]
    fn total_duration(&self) -> Option<std::time::Duration> {
        self.input.total_duration()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub path: String,
    pub duration_secs: f64,
    pub liked: bool,
    pub moods: Vec<String>,
    pub play_count: u32,
    pub skip_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub is_playing: bool,
    pub current_track: Option<Track>,
    pub current_position: f64,
    pub volume: f32,
    pub repeat_mode: u8,
    pub shuffle: bool,
    pub track_finished: bool,
    pub dolby_dialog: bool,
    pub dolby_spatial: bool,
}

struct InnerState {
    playback: PlaybackState,
    playlist: Vec<Track>,
    shuffled_indices: Vec<usize>,
    current_index: Option<usize>,
    paused_position: f64,
    play_start: Option<Instant>,
}

impl InnerState {
    fn position(&self) -> f64 {
        match self.play_start {
            Some(t) => self.paused_position + t.elapsed().as_secs_f64(),
            None => self.paused_position,
        }
    }

    fn rebuild_shuffle_indices(&mut self) {
        let mut indices: Vec<usize> = (0..self.playlist.len()).collect();
        let mut rng = rand::thread_rng();
        indices.shuffle(&mut rng);
        self.shuffled_indices = indices;
    }

    fn get_next_index(&self) -> Option<usize> {
        let playlist_len = self.playlist.len();
        if playlist_len == 0 { return None; }
        
        let current = self.current_index.unwrap_or(0);
        
        if self.playback.shuffle && !self.shuffled_indices.is_empty() {
            let current_pos = self.shuffled_indices.iter().position(|&x| x == current).unwrap_or(0);
            let next_pos = current_pos + 1;
            if next_pos >= self.shuffled_indices.len() {
                if self.playback.repeat_mode == 2 {
                    Some(self.shuffled_indices[0])
                } else {
                    None
                }
            } else {
                Some(self.shuffled_indices[next_pos])
            }
        } else {
            let next = current + 1;
            if next >= playlist_len {
                if self.playback.repeat_mode == 2 {
                    Some(0)
                } else {
                    None
                }
            } else {
                Some(next)
            }
        }
    }

    fn get_prev_index(&self) -> Option<usize> {
        let playlist_len = self.playlist.len();
        if playlist_len == 0 { return None; }
        
        let current = self.current_index.unwrap_or(0);
        
        if self.playback.shuffle && !self.shuffled_indices.is_empty() {
            let current_pos = self.shuffled_indices.iter().position(|&x| x == current).unwrap_or(0);
            if current_pos == 0 {
                if self.playback.repeat_mode == 2 {
                    Some(self.shuffled_indices[self.shuffled_indices.len() - 1])
                } else {
                    None
                }
            } else {
                Some(self.shuffled_indices[current_pos - 1])
            }
        } else {
            if current == 0 {
                if self.playback.repeat_mode == 2 {
                    Some(playlist_len - 1)
                } else {
                    None
                }
            } else {
                Some(current - 1)
            }
        }
    }
}

pub struct AudioEngine {
    inner: Arc<Mutex<InnerState>>,
    sink: Arc<Mutex<Option<Sink>>>,
    stream: Arc<Mutex<Option<AudioOutputStream>>>,
    stream_handle: Arc<Mutex<OutputStreamHandle>>,
    dolby_dialog: Arc<AtomicBool>,
    dolby_spatial: Arc<AtomicBool>,
}

impl Clone for AudioEngine {
    fn clone(&self) -> Self {
        AudioEngine {
            inner: Arc::clone(&self.inner),
            sink: Arc::clone(&self.sink),
            stream: Arc::clone(&self.stream),
            stream_handle: Arc::clone(&self.stream_handle),
            dolby_dialog: Arc::clone(&self.dolby_dialog),
            dolby_spatial: Arc::clone(&self.dolby_spatial),
        }
    }
}

impl AudioEngine {
    pub fn new(stream: rodio::OutputStream, stream_handle: OutputStreamHandle) -> Self {
        let dolby_dialog = Arc::new(AtomicBool::new(true));
        let dolby_spatial = Arc::new(AtomicBool::new(true));
        
        let engine = AudioEngine {
            inner: Arc::new(Mutex::new(InnerState {
                playback: PlaybackState {
                    is_playing: false,
                    current_track: None,
                    current_position: 0.0,
                    volume: 0.8,
                    repeat_mode: 0,
                    shuffle: false,
                    track_finished: false,
                    dolby_dialog: true,
                    dolby_spatial: true,
                },
                playlist: Vec::new(),
                shuffled_indices: Vec::new(),
                current_index: None,
                paused_position: 0.0,
                play_start: None,
            })),
            sink: Arc::new(Mutex::new(None)),
            stream: Arc::new(Mutex::new(Some(AudioOutputStream(stream)))),
            stream_handle: Arc::new(Mutex::new(stream_handle)),
            dolby_dialog,
            dolby_spatial,
        };

        // Spawn background auto-advance thread
        let engine_clone = engine.clone();
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_millis(100));
                
                let should_advance = {
                    let inner = engine_clone.inner.lock().unwrap();
                    let is_playing = inner.playback.is_playing;
                    let elapsed = inner.play_start.map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0);
                    is_playing && elapsed > 0.5
                };
                
                if should_advance {
                    let sink_empty = {
                        let sink_guard = engine_clone.sink.lock().unwrap();
                        sink_guard.as_ref().map(|s| s.empty()).unwrap_or(false)
                    };
                    
                    if sink_empty {
                        engine_clone.auto_advance();
                    }
                }
            }
        });

        engine
    }

    pub fn get_state(&self) -> PlaybackState {
        let mut state = {
            let inner = self.inner.lock().unwrap();
            let mut s = inner.playback.clone();
            s.current_position = inner.position();
            s
        };
        state.track_finished = false;
        state
    }

    pub fn play_index(&self, index: usize) -> Result<(), String> {
        let (track, dialog, spatial) = {
            let mut inner = self.inner.lock().unwrap();
            
            // Stats calculation: increment skip count if previous track was skipped
            if let Some(curr_idx) = inner.current_index {
                if inner.playback.is_playing {
                    let elapsed = inner.play_start.map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0);
                    if let Some(t) = inner.playlist.get_mut(curr_idx) {
                        if elapsed < t.duration_secs * 0.8 {
                            t.skip_count += 1;
                        }
                    }
                }
            }

            // Increment play count for the track to be played
            if let Some(t) = inner.playlist.get_mut(index) {
                t.play_count += 1;
            }

            (
                inner.playlist.get(index).cloned(),
                inner.playback.dolby_dialog,
                inner.playback.dolby_spatial
            )
        };

        if let Some(ref track) = track {
            // Re-create the stream to ensure we connect to the current default audio device
            if let Ok((stream, new_handle)) = rodio::OutputStream::try_default() {
                *self.stream.lock().unwrap() = Some(AudioOutputStream(stream));
                *self.stream_handle.lock().unwrap() = new_handle;
            }

            let file = File::open(&track.path)
                .map_err(|e| format!("Cannot open '{}': {}", track.path, e))?;
            let source = Decoder::new(BufReader::new(file))
                .map_err(|e| format!("Cannot decode audio: {}", e))?
                .convert_samples::<f32>();
            
            // Wrap source in Dolby Audio Virtualizer
            let dolby_source = DolbySource::new(
                source,
                Arc::clone(&self.dolby_dialog),
                Arc::clone(&self.dolby_spatial),
            );

            let new_sink_res = {
                let handle_guard = self.stream_handle.lock().unwrap();
                Sink::try_new(&handle_guard)
            };

            let new_sink = new_sink_res
                .map_err(|e| format!("Cannot create audio output sink: {}. Please verify your audio output device.", e))?;

            println!("[AUDIO ENGINE] Playing track: '{}' from '{}'", track.title, track.path);
            let in_channels = dolby_source.channels();
            let sample_rate = dolby_source.sample_rate();
            println!("[AUDIO ENGINE] Source channels: {}, sample rate: {}", in_channels, sample_rate);
            let volume = self.inner.lock().unwrap().playback.volume;
            println!("[AUDIO ENGINE] Setting volume to: {}", volume);
            new_sink.set_volume(volume);
            new_sink.append(dolby_source);
            new_sink.play();
            println!("[AUDIO ENGINE] Sink created and playing!");

            *self.sink.lock().unwrap() = Some(new_sink);

            let mut inner = self.inner.lock().unwrap();
            inner.current_index = Some(index);
            inner.playback.current_track = Some(track.clone());
            inner.playback.is_playing = true;
            inner.playback.track_finished = false;
            inner.playback.current_position = 0.0;
            inner.paused_position = 0.0;
            inner.play_start = Some(Instant::now());

            self.dolby_dialog.store(dialog, Ordering::Relaxed);
            self.dolby_spatial.store(spatial, Ordering::Relaxed);
        }
        Ok(())
    }

    pub fn toggle_playback(&self) -> Result<(), String> {
        let is_playing = self.inner.lock().unwrap().playback.is_playing;

        let has_sink = {
            let guard = self.sink.lock().unwrap();
            if let Some(sink) = guard.as_ref() {
                if is_playing { sink.pause(); } else { sink.play(); }
                true
            } else {
                false
            }
        };

        if has_sink {
            let mut inner = self.inner.lock().unwrap();
            if is_playing {
                inner.paused_position = inner.position();
                inner.play_start = None;
            } else {
                inner.play_start = Some(Instant::now());
            }
            inner.playback.is_playing = !is_playing;
        } else {
            let (active_idx, saved_pos) = {
                let inner = self.inner.lock().unwrap();
                let idx = inner.current_index.or_else(|| {
                    if inner.playlist.is_empty() { None } else { Some(0) }
                });
                (idx, inner.paused_position)
            };
            if let Some(idx) = active_idx {
                self.play_index(idx)?;
                if saved_pos > 0.0 {
                    self.seek(saved_pos);
                }
            }
        }
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) {
        let v = volume.clamp(0.0, 1.0);
        self.inner.lock().unwrap().playback.volume = v;
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            sink.set_volume(v);
        }
    }

    pub fn seek(&self, position_secs: f64) {
        let is_playing = self.inner.lock().unwrap().playback.is_playing;
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            let _ = sink.try_seek(std::time::Duration::from_secs_f64(position_secs));
        }
        let mut inner = self.inner.lock().unwrap();
        inner.paused_position = position_secs;
        inner.play_start = if is_playing { Some(Instant::now()) } else { None };
        inner.playback.current_position = position_secs;
    }

    pub fn auto_advance(&self) {
        let next_idx = {
            let inner = self.inner.lock().unwrap();
            let mode = inner.playback.repeat_mode;
            let current = inner.current_index;
            if mode == 1 {
                current
            } else {
                inner.get_next_index()
            }
        };

        if let Some(idx) = next_idx {
            if let Err(e) = self.play_index(idx) {
                let mut inner = self.inner.lock().unwrap();
                inner.playback.is_playing = false;
                inner.play_start = None;
                println!("Error auto-advancing to next track: {}", e);
            }
        } else {
            let mut inner = self.inner.lock().unwrap();
            inner.playback.is_playing = false;
            inner.play_start = None;
            if let Some(sink) = self.sink.lock().unwrap().as_ref() {
                sink.pause();
            }
        }
    }

    pub fn next_track(&self) {
        let next_idx = {
            let inner = self.inner.lock().unwrap();
            inner.get_next_index()
        };

        if let Some(idx) = next_idx {
            if let Err(e) = self.play_index(idx) {
                let mut inner = self.inner.lock().unwrap();
                inner.playback.is_playing = false;
                inner.play_start = None;
                println!("Error playing next track: {}", e);
            }
        } else {
            let mut inner = self.inner.lock().unwrap();
            inner.playback.is_playing = false;
            inner.play_start = None;
            if let Some(sink) = self.sink.lock().unwrap().as_ref() {
                sink.pause();
            }
        }
    }

    pub fn prev_track(&self) {
        let prev_idx = {
            let inner = self.inner.lock().unwrap();
            inner.get_prev_index()
        };

        if let Some(idx) = prev_idx {
            if let Err(e) = self.play_index(idx) {
                let mut inner = self.inner.lock().unwrap();
                inner.playback.is_playing = false;
                inner.play_start = None;
                println!("Error playing previous track: {}", e);
            }
        }
    }

    pub fn add_tracks(&self, tracks: Vec<Track>) {
        let mut inner = self.inner.lock().unwrap();
        inner.playlist.extend(tracks);
        inner.rebuild_shuffle_indices();
    }

    pub fn get_playlist(&self) -> Vec<Track> {
        self.inner.lock().unwrap().playlist.clone()
    }

    pub fn set_repeat_mode(&self, mode: u8) {
        self.inner.lock().unwrap().playback.repeat_mode = mode % 3;
    }

    pub fn set_shuffle(&self, enabled: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.playback.shuffle = enabled;
        if enabled {
            inner.rebuild_shuffle_indices();
        }
    }

    pub fn set_dolby_features(&self, dialog: bool, spatial: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.playback.dolby_dialog = dialog;
        inner.playback.dolby_spatial = spatial;
        
        self.dolby_dialog.store(dialog, Ordering::Relaxed);
        self.dolby_spatial.store(spatial, Ordering::Relaxed);
    }

    pub fn toggle_like_track(&self, track_id: &str) -> Result<bool, String> {
        let mut inner = self.inner.lock().unwrap();
        let mut liked = false;
        let mut found = false;
        
        if let Some(track) = inner.playlist.iter_mut().find(|t| t.id == track_id) {
            track.liked = !track.liked;
            liked = track.liked;
            found = true;
        }
        
        if !found {
            return Err("Track not found".to_string());
        }
        
        if let Some(ref mut curr) = inner.playback.current_track {
            if curr.id == track_id {
                curr.liked = liked;
            }
        }
        
        Ok(liked)
    }

    pub fn set_track_moods(&self, track_id: &str, moods: Vec<String>) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        let mut found = false;
        
        if let Some(track) = inner.playlist.iter_mut().find(|t| t.id == track_id) {
            track.moods = moods.clone();
            found = true;
        }
        
        if !found {
            return Err("Track not found".to_string());
        }
        
        if let Some(ref mut curr) = inner.playback.current_track {
            if curr.id == track_id {
                curr.moods = moods;
            }
        }
        
        Ok(())
    }

    pub fn sync_playlist(&self, playlist: Vec<Track>) {
        let mut inner = self.inner.lock().unwrap();
        inner.playlist = playlist;
        if inner.playback.shuffle {
            inner.rebuild_shuffle_indices();
        }
    }

    pub fn sync_active_track(&self, track_id: Option<String>, position: f64) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(id) = track_id {
            if let Some(idx) = inner.playlist.iter().position(|t| t.id == id) {
                inner.current_index = Some(idx);
                inner.playback.current_track = inner.playlist.get(idx).cloned();
                inner.paused_position = position;
                inner.playback.current_position = position;
            }
        }
    }
}

// ── Metadata helper ─────────────────────────────────────────────────────────

fn read_track(path: &str) -> Track {
    let filename = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let id = TRACK_ID.fetch_add(1, Ordering::SeqCst).to_string();

    match lofty::Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged_file) => {
            let duration = tagged_file.properties().duration().as_secs_f64();
            let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

            let title = tag
                .and_then(|t: &lofty::Tag| t.title().map(|s| s.into_owned()))
                .unwrap_or_else(|| filename.clone());

            let artist = tag
                .and_then(|t: &lofty::Tag| t.artist().map(|s| s.into_owned()))
                .unwrap_or_else(|| "Unknown Artist".to_string());

            Track {
                id,
                title,
                artist,
                path: path.to_string(),
                duration_secs: duration,
                liked: false,
                moods: Vec::new(),
                play_count: 0,
                skip_count: 0,
            }
        }
        Err(_) => Track {
            id,
            title: filename,
            artist: "Unknown Artist".to_string(),
            path: path.to_string(),
            duration_secs: 0.0,
            liked: false,
            moods: Vec::new(),
            play_count: 0,
            skip_count: 0,
        },
    }
}

// ── Tauri Commands ───────────────────────────────────────────────────────────

#[command]
pub fn get_playback_state(engine: tauri::State<Arc<Mutex<AudioEngine>>>) -> PlaybackState {
    engine.lock().unwrap().get_state()
}

#[command]
pub fn toggle_playback(engine: tauri::State<Arc<Mutex<AudioEngine>>>) -> Result<(), String> {
    engine.lock().unwrap().toggle_playback()
}

#[command]
pub fn set_volume(engine: tauri::State<Arc<Mutex<AudioEngine>>>, volume: f32) {
    engine.lock().unwrap().set_volume(volume);
}

#[command]
pub fn seek_track(engine: tauri::State<Arc<Mutex<AudioEngine>>>, position_secs: f64) {
    engine.lock().unwrap().seek(position_secs);
}

#[command]
pub fn add_track_cmd(engine: tauri::State<Arc<Mutex<AudioEngine>>>, track: Track) {
    engine.lock().unwrap().add_tracks(vec![track]);
}

#[command]
pub fn get_playlist(engine: tauri::State<Arc<Mutex<AudioEngine>>>) -> Vec<Track> {
    engine.lock().unwrap().get_playlist()
}

#[command]
pub fn set_repeat_mode(engine: tauri::State<Arc<Mutex<AudioEngine>>>, mode: u8) {
    engine.lock().unwrap().set_repeat_mode(mode);
}

#[command]
pub fn set_shuffle(engine: tauri::State<Arc<Mutex<AudioEngine>>>, enabled: bool) {
    engine.lock().unwrap().set_shuffle(enabled);
}

#[command]
pub fn play_track_at_index(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    index: usize,
) -> Result<(), String> {
    engine.lock().unwrap().play_index(index)
}

#[command]
pub fn next_track(engine: tauri::State<Arc<Mutex<AudioEngine>>>) {
    engine.lock().unwrap().next_track();
}

#[command]
pub fn prev_track(engine: tauri::State<Arc<Mutex<AudioEngine>>>) {
    engine.lock().unwrap().prev_track();
}

#[command]
pub fn load_music_files(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    paths: Vec<String>,
) -> Vec<Track> {
    let tracks: Vec<Track> = paths.iter().map(|p| read_track(p)).collect();
    engine.lock().unwrap().add_tracks(tracks.clone());
    tracks
}

#[command]
pub fn load_music_folder(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    path: String,
) -> Result<Vec<Track>, String> {
    let mut tracks = Vec::new();
    let supported_extensions = ["mp3", "flac", "wav", "m4a", "ogg", "opus"];
    
    for entry in walkdir::WalkDir::new(&path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                    let path_str = entry.path().to_string_lossy().to_string();
                    tracks.push(read_track(&path_str));
                }
            }
        }
    }
    engine.lock().unwrap().add_tracks(tracks.clone());
    Ok(tracks)
}

#[command]
pub fn toggle_like_track(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    track_id: String,
) -> Result<bool, String> {
    engine.lock().unwrap().toggle_like_track(&track_id)
}

#[command]
pub fn set_track_moods(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    track_id: String,
    moods: Vec<String>,
) -> Result<(), String> {
    engine.lock().unwrap().set_track_moods(&track_id, moods)
}

#[command]
pub fn set_dolby_features(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    dialog: bool,
    spatial: bool,
) {
    engine.lock().unwrap().set_dolby_features(dialog, spatial);
}

#[command]
pub fn sync_playlist_cmd(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    playlist: Vec<Track>,
) {
    engine.lock().unwrap().sync_playlist(playlist);
}

#[command]
pub fn sync_active_track_cmd(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    track_id: Option<String>,
    position: f64,
) {
    engine.lock().unwrap().sync_active_track(track_id, position);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    struct MockSource {
        samples: Vec<f32>,
        index: usize,
        channels: u16,
        sample_rate: u32,
    }

    impl MockSource {
        fn new(samples: Vec<f32>, channels: u16, sample_rate: u32) -> Self {
            MockSource {
                samples,
                index: 0,
                channels,
                sample_rate,
            }
        }
    }

    impl Iterator for MockSource {
        type Item = f32;
        fn next(&mut self) -> Option<Self::Item> {
            if self.index < self.samples.len() {
                let s = self.samples[self.index];
                self.index += 1;
                Some(s)
            } else {
                None
            }
        }
    }

    impl Source for MockSource {
        fn current_frame_len(&self) -> Option<usize> { None }
        fn channels(&self) -> u16 { self.channels }
        fn sample_rate(&self) -> u32 { self.sample_rate }
        fn total_duration(&self) -> Option<std::time::Duration> { None }
    }

    #[test]
    fn test_mood_filtering() {
        let track1 = Track {
            id: "1".to_string(),
            title: "Focus Track".to_string(),
            artist: "Artist 1".to_string(),
            path: "dummy/path1.mp3".to_string(),
            duration_secs: 120.0,
            liked: false,
            moods: vec!["Focus".to_string()],
            play_count: 0,
            skip_count: 0,
        };
        let track2 = Track {
            id: "2".to_string(),
            title: "Relax Track".to_string(),
            artist: "Artist 2".to_string(),
            path: "dummy/path2.mp3".to_string(),
            duration_secs: 180.0,
            liked: false,
            moods: vec!["Relax".to_string()],
            play_count: 0,
            skip_count: 0,
        };

        let playlist = vec![track1, track2];

        // Verify that we can tag a track with new moods
        // (This simulates the set_track_moods backend logic)
        let mut test_playlist = playlist.clone();
        if let Some(t) = test_playlist.iter_mut().find(|x| x.id == "1") {
            t.moods = vec!["Focus".to_string(), "Sleep".to_string()];
        }
        assert_eq!(test_playlist[0].moods, vec!["Focus".to_string(), "Sleep".to_string()]);

        // Simulating the frontend/filtering query:
        let focus_tracks: Vec<&Track> = test_playlist.iter().filter(|t| t.moods.contains(&"Focus".to_string())).collect();
        let relax_tracks: Vec<&Track> = test_playlist.iter().filter(|t| t.moods.contains(&"Relax".to_string())).collect();
        let sleep_tracks: Vec<&Track> = test_playlist.iter().filter(|t| t.moods.contains(&"Sleep".to_string())).collect();

        assert_eq!(focus_tracks.len(), 1);
        assert_eq!(focus_tracks[0].id, "1");

        assert_eq!(relax_tracks.len(), 1);
        assert_eq!(relax_tracks[0].id, "2");

        assert_eq!(sleep_tracks.len(), 1);
        assert_eq!(sleep_tracks[0].id, "1");
    }

    #[test]
    fn test_shuffle() {
        let mut inner = InnerState {
            playback: PlaybackState {
                is_playing: false,
                current_track: None,
                current_position: 0.0,
                volume: 0.8,
                repeat_mode: 0,
                shuffle: true,
                track_finished: false,
                dolby_dialog: false,
                dolby_spatial: false,
            },
            playlist: (0..10).map(|i| Track {
                id: i.to_string(),
                title: format!("Track {}", i),
                artist: "Artist".to_string(),
                path: format!("dummy/path{}.mp3", i),
                duration_secs: 100.0,
                liked: false,
                moods: Vec::new(),
                play_count: 0,
                skip_count: 0,
            }).collect(),
            shuffled_indices: Vec::new(),
            current_index: None,
            paused_position: 0.0,
            play_start: None,
        };

        inner.rebuild_shuffle_indices();

        // Verify that shuffled_indices contains all playlist indices (0..9)
        assert_eq!(inner.shuffled_indices.len(), 10);
        for i in 0..10 {
            assert!(inner.shuffled_indices.contains(&i));
        }

        // Verify index sequence matches shuffled sequence
        inner.current_index = Some(inner.shuffled_indices[0]);
        let next_idx = inner.get_next_index().unwrap();
        assert_eq!(next_idx, inner.shuffled_indices[1]);

        let prev_idx = inner.get_prev_index();
        // Since shuffle current position is at index 0, and repeat mode is 0 (Off), prev_track should return None
        assert!(prev_idx.is_none());
    }

    #[test]
    fn test_repeat_modes() {
        let mut inner = InnerState {
            playback: PlaybackState {
                is_playing: false,
                current_track: None,
                current_position: 0.0,
                volume: 0.8,
                repeat_mode: 0, // RepeatOff
                shuffle: false,
                track_finished: false,
                dolby_dialog: false,
                dolby_spatial: false,
            },
            playlist: (0..3).map(|i| Track {
                id: i.to_string(),
                title: format!("Track {}", i),
                artist: "Artist".to_string(),
                path: format!("dummy/path{}.mp3", i),
                duration_secs: 100.0,
                liked: false,
                moods: Vec::new(),
                play_count: 0,
                skip_count: 0,
            }).collect(),
            shuffled_indices: Vec::new(),
            current_index: Some(2), // At the end of playlist
            paused_position: 0.0,
            play_start: None,
        };

        // 1. Test RepeatOff (mode = 0)
        assert!(inner.get_next_index().is_none());

        // 2. Test RepeatAll (mode = 2)
        inner.playback.repeat_mode = 2;
        assert_eq!(inner.get_next_index(), Some(0));

        // 3. Test prev_index at boundary (index = 0)
        inner.current_index = Some(0);
        inner.playback.repeat_mode = 0; // RepeatOff
        assert!(inner.get_prev_index().is_none());

        inner.playback.repeat_mode = 2; // RepeatAll
        assert_eq!(inner.get_prev_index(), Some(2));
    }

    #[test]
    fn test_dolby_source_dsp() {
        let dialog = Arc::new(AtomicBool::new(false));
        let spatial = Arc::new(AtomicBool::new(false));

        // 1. Verify Silence input (all 0.0) yields silence output
        let silence_samples = vec![0.0; 100];
        let mock_source = MockSource::new(silence_samples, 2, 44100);
        let mut dolby_source = DolbySource::new(mock_source, Arc::clone(&dialog), Arc::clone(&spatial));
        
        let output: Vec<f32> = dolby_source.by_ref().collect();
        assert_eq!(output.len(), 100);
        for &sample in &output {
            assert_eq!(sample, 0.0);
        }

        // 2. Verify Silence stability under active dialog/spatial processing
        dialog.store(true, Ordering::Relaxed);
        spatial.store(true, Ordering::Relaxed);
        let silence_samples2 = vec![0.0; 100];
        let mock_source2 = MockSource::new(silence_samples2, 2, 44100);
        let mut dolby_source2 = DolbySource::new(mock_source2, Arc::clone(&dialog), Arc::clone(&spatial));
        let output2: Vec<f32> = dolby_source2.by_ref().collect();
        assert_eq!(output2.len(), 100);
        for &sample in &output2 {
            assert_eq!(sample, 0.0);
        }

        // 3. Verify impulse stability (value doesn't exceed clamp boundaries of [-1.0, 1.0])
        let mut impulse_samples = vec![0.0; 200];
        impulse_samples[0] = 1.0; // Left impulse
        impulse_samples[1] = -1.0; // Right impulse
        let mock_source3 = MockSource::new(impulse_samples, 2, 44100);
        let mut dolby_source3 = DolbySource::new(mock_source3, Arc::clone(&dialog), Arc::clone(&spatial));
        let output3: Vec<f32> = dolby_source3.by_ref().collect();
        assert_eq!(output3.len(), 200);
        for &sample in &output3 {
            assert!(sample >= -1.0 && sample <= 1.0, "Sample {} exceeded bounds", sample);
        }

        // 4. Verify Voice Boost (Dialog Enhance) does not cause divergence/explode under high frequency inputs
        dialog.store(true, Ordering::Relaxed);
        spatial.store(false, Ordering::Relaxed);
        let mut high_freq_samples = Vec::new();
        for i in 0..100 {
            let val = if i % 2 == 0 { 0.8 } else { -0.8 };
            high_freq_samples.push(val); // Left
            high_freq_samples.push(-val); // Right
        }
        let mock_source4 = MockSource::new(high_freq_samples, 2, 44100);
        let mut dolby_source4 = DolbySource::new(mock_source4, Arc::clone(&dialog), Arc::clone(&spatial));
        let output4: Vec<f32> = dolby_source4.by_ref().collect();
        assert_eq!(output4.len(), 200);
        for &sample in &output4 {
            assert!(sample >= -1.0 && sample <= 1.0);
        }

        // 5. Verify Spatial 3D (Spatial Widener) output is stable and properly bounded
        dialog.store(false, Ordering::Relaxed);
        spatial.store(true, Ordering::Relaxed);
        let mut spatial_samples = Vec::new();
        for i in 0..100 {
            let val = (i as f32).sin();
            spatial_samples.push(val);
            spatial_samples.push(-val);
        }
        let mock_source5 = MockSource::new(spatial_samples, 2, 44100);
        let mut dolby_source5 = DolbySource::new(mock_source5, Arc::clone(&dialog), Arc::clone(&spatial));
        let output5: Vec<f32> = dolby_source5.by_ref().collect();
        assert_eq!(output5.len(), 200);
        for &sample in &output5 {
            assert!(sample >= -1.0 && sample <= 1.0);
        }
    }
}
