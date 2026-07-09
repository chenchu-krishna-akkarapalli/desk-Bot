use std::f32::consts::PI;
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
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

/// Number of frames accumulated in the audio thread before a meter block is
/// published. ~2048 frames ≈ 46 ms at 44.1 kHz — responsive without spamming.
const METER_BLOCK_FRAMES: u32 = 2048;

/// Lock-free telemetry shared between the real-time DSP thread (writer) and the
/// UI polling thread (reader). Values are stored as `f32` bit patterns in
/// atomics; the audio thread only ever does a handful of relaxed stores per
/// block, so it never blocks the playback callback.
#[derive(Default)]
pub struct AudioMeters {
    peak_left: AtomicU32,
    peak_right: AtomicU32,
    rms_left: AtomicU32,
    rms_right: AtomicU32,
    correlation: AtomicU32,
    /// Fraction of frames in the last block where the limiter was engaged.
    limiter_activity: AtomicU32,
    /// True if any sample in the last block reached full scale.
    clipping: AtomicBool,
}

impl AudioMeters {
    fn store_f32(cell: &AtomicU32, value: f32) {
        cell.store(value.to_bits(), Ordering::Relaxed);
    }

    fn load_f32(cell: &AtomicU32) -> f32 {
        f32::from_bits(cell.load(Ordering::Relaxed))
    }

    fn publish(&self, peak_l: f32, peak_r: f32, rms_l: f32, rms_r: f32, corr: f32, limiter: f32, clip: bool) {
        Self::store_f32(&self.peak_left, peak_l);
        Self::store_f32(&self.peak_right, peak_r);
        Self::store_f32(&self.rms_left, rms_l);
        Self::store_f32(&self.rms_right, rms_r);
        Self::store_f32(&self.correlation, corr);
        Self::store_f32(&self.limiter_activity, limiter);
        self.clipping.store(clip, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> AudioMetersSnapshot {
        AudioMetersSnapshot {
            peak_left: Self::load_f32(&self.peak_left),
            peak_right: Self::load_f32(&self.peak_right),
            rms_left: Self::load_f32(&self.rms_left),
            rms_right: Self::load_f32(&self.rms_right),
            correlation: Self::load_f32(&self.correlation),
            limiter_activity: Self::load_f32(&self.limiter_activity),
            clipping: self.clipping.load(Ordering::Relaxed),
        }
    }

    /// Zero all meters — used when playback is stopped so the UI decays to rest
    /// instead of freezing on the last block's values.
    pub fn reset(&self) {
        self.publish(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, false);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetersSnapshot {
    /// Linear peak (0..1) per channel over the last block.
    pub peak_left: f32,
    pub peak_right: f32,
    /// Linear RMS (0..1) per channel — a simple loudness proxy.
    pub rms_left: f32,
    pub rms_right: f32,
    /// Stereo correlation coefficient (-1 = anti-phase, 0 = wide, 1 = mono).
    pub correlation: f32,
    /// 0..1 fraction of the last block where the limiter was working.
    pub limiter_activity: f32,
    /// True if the signal hit full scale in the last block.
    pub clipping: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDspConfig {
    /// When true the DSP graph is fully bypassed and audio passes through
    /// bit-for-bit. This is the `Reference` signal path.
    pub pure_mode: bool,
    pub voice_boost: bool,
    pub spatial_widener: bool,
    pub cheap_headphones: bool,
    pub bass_enhancer: bool,
    /// Headphone crossfeed — bleeds a low-passed portion of the opposite
    /// channel to relax hard-panned stereo for a more natural, speaker-like
    /// image over headphones. Mono-compatible.
    #[serde(default)]
    pub crossfeed: bool,
    /// Stereo width multiplier applied to the side (L-R) component.
    /// 1.0 = untouched, <1.0 narrows toward mono, >1.0 widens.
    /// Safety-clamped in the engine.
    #[serde(default = "default_stereo_width")]
    pub stereo_width: f32,
    /// Output headroom / makeup trim in dB applied just before the limiter.
    /// Negative values reserve headroom before enhancement peaks.
    #[serde(default)]
    pub output_trim_db: f32,
    /// Active listening-mode label (policy bundle id). Purely descriptive:
    /// the actual processing is driven by the granular flags above so the
    /// real-time path stays deterministic and user overrides always win.
    #[serde(default = "default_mode")]
    pub mode: String,
    pub eq_sub_bass: f32,
    pub eq_mid_bass: f32,
    pub eq_vocal: f32,
    pub eq_presence: f32,
    pub eq_air: f32,
}

fn default_stereo_width() -> f32 {
    1.35
}

fn default_mode() -> String {
    "custom".to_string()
}

impl Default for AudioDspConfig {
    fn default() -> Self {
        Self {
            pure_mode: false,
            voice_boost: true,
            spatial_widener: true,
            cheap_headphones: true,
            bass_enhancer: true,
            crossfeed: false,
            stereo_width: default_stereo_width(),
            output_trim_db: 0.0,
            mode: default_mode(),
            eq_sub_bass: 0.0,
            eq_mid_bass: 0.0,
            eq_vocal: 0.0,
            eq_presence: 0.0,
            eq_air: 0.0,
        }
    }
}

#[derive(Clone, Copy)]
struct BiquadCoefficients {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

#[derive(Clone, Copy, Default)]
struct BiquadState {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

#[derive(Clone, Copy)]
struct StereoBiquad {
    coeffs: BiquadCoefficients,
    left: BiquadState,
    right: BiquadState,
}

impl StereoBiquad {
    fn new(coeffs: BiquadCoefficients) -> Self {
        Self {
            coeffs,
            left: BiquadState::default(),
            right: BiquadState::default(),
        }
    }

    fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        (
            process_biquad_sample(left, &self.coeffs, &mut self.left),
            process_biquad_sample(right, &self.coeffs, &mut self.right),
        )
    }
}

fn process_biquad_sample(sample: f32, coeffs: &BiquadCoefficients, state: &mut BiquadState) -> f32 {
    let y = coeffs.b0 * sample
        + coeffs.b1 * state.x1
        + coeffs.b2 * state.x2
        - coeffs.a1 * state.y1
        - coeffs.a2 * state.y2;

    state.x2 = state.x1;
    state.x1 = sample;
    state.y2 = state.y1;
    state.y1 = y;

    y
}

/// Amplitude factor used inside the RBJ biquad formulas (A = sqrt(linear gain)).
fn db_to_gain(db: f32) -> f32 {
    10.0_f32.powf(db / 40.0)
}

/// Straight linear voltage gain from decibels (10^(dB/20)).
fn db_to_linear_gain(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

fn normalize_coefficients(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> BiquadCoefficients {
    BiquadCoefficients {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
    }
}

fn peaking_eq(sample_rate: u32, frequency: f32, q: f32, gain_db: f32) -> BiquadCoefficients {
    let omega = 2.0 * PI * frequency / sample_rate as f32;
    let alpha = omega.sin() / (2.0 * q);
    let a = db_to_gain(gain_db);
    let cos_omega = omega.cos();

    normalize_coefficients(
        1.0 + alpha * a,
        -2.0 * cos_omega,
        1.0 - alpha * a,
        1.0 + alpha / a,
        -2.0 * cos_omega,
        1.0 - alpha / a,
    )
}

fn low_shelf(sample_rate: u32, frequency: f32, slope: f32, gain_db: f32) -> BiquadCoefficients {
    let omega = 2.0 * PI * frequency / sample_rate as f32;
    let a = db_to_gain(gain_db);
    let cos_omega = omega.cos();
    let sin_omega = omega.sin();
    let two_sqrt_a_alpha = sin_omega / 2.0 * (((a + 1.0 / a) * (1.0 / slope - 1.0) + 2.0).max(0.0)).sqrt();

    normalize_coefficients(
        a * ((a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha),
        2.0 * a * ((a - 1.0) - (a + 1.0) * cos_omega),
        a * ((a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha),
        (a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha,
        -2.0 * ((a - 1.0) + (a + 1.0) * cos_omega),
        (a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha,
    )
}

fn high_shelf(sample_rate: u32, frequency: f32, slope: f32, gain_db: f32) -> BiquadCoefficients {
    let omega = 2.0 * PI * frequency / sample_rate as f32;
    let a = db_to_gain(gain_db);
    let cos_omega = omega.cos();
    let sin_omega = omega.sin();
    let two_sqrt_a_alpha = sin_omega / 2.0 * (((a + 1.0 / a) * (1.0 / slope - 1.0) + 2.0).max(0.0)).sqrt();

    normalize_coefficients(
        a * ((a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha),
        -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_omega),
        a * ((a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha),
        (a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha,
        2.0 * ((a - 1.0) - (a + 1.0) * cos_omega),
        (a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha,
    )
}

struct DspChain {
    config: AudioDspConfig,
    compensation_low: StereoBiquad,
    compensation_mud: StereoBiquad,
    compensation_high: StereoBiquad,
    eq_sub: StereoBiquad,
    eq_mid_bass: StereoBiquad,
    eq_vocal: StereoBiquad,
    eq_presence: StereoBiquad,
    eq_air: StereoBiquad,
    voice_boost: StereoBiquad,
    bass_low_pass_left: f32,
    bass_low_pass_right: f32,
    bass_low_pass_alpha: f32,
    // Crossfeed one-pole low-pass state (opposite-channel bleed).
    cross_low_pass_left: f32,
    cross_low_pass_right: f32,
    cross_low_pass_alpha: f32,
    // Precomputed, safety-clamped controls.
    stereo_width: f32,
    output_gain: f32,
    // Metering: accumulated over a block, then published to shared atomics.
    meters: Arc<AudioMeters>,
    meter_frames: u32,
    meter_peak_l: f32,
    meter_peak_r: f32,
    meter_sum_l2: f32,
    meter_sum_r2: f32,
    meter_sum_lr: f32,
    meter_limited: u32,
    meter_clip: bool,
}

impl DspChain {
    fn new(sample_rate: u32, config: AudioDspConfig, meters: Arc<AudioMeters>) -> Self {
        let sr = sample_rate.max(1) as f32;
        let dt = 1.0 / sr;

        let one_pole_alpha = |cutoff_hz: f32| {
            let rc = 1.0 / (2.0 * PI * cutoff_hz);
            (dt / (rc + dt)).clamp(0.0, 1.0)
        };

        // Clamp user-facing controls to safe ranges once, outside the hot loop.
        let stereo_width = config.stereo_width.clamp(0.0, 2.0);
        let output_gain = db_to_linear_gain(config.output_trim_db.clamp(-24.0, 12.0));

        Self {
            compensation_low: StereoBiquad::new(low_shelf(sample_rate, 60.0, 0.8, 4.5)),
            compensation_mud: StereoBiquad::new(peaking_eq(sample_rate, 300.0, 0.9, -3.0)),
            compensation_high: StereoBiquad::new(high_shelf(sample_rate, 10_000.0, 0.8, 5.0)),
            eq_sub: StereoBiquad::new(peaking_eq(sample_rate, 60.0, 0.9, config.eq_sub_bass)),
            eq_mid_bass: StereoBiquad::new(peaking_eq(sample_rate, 250.0, 0.9, config.eq_mid_bass)),
            eq_vocal: StereoBiquad::new(peaking_eq(sample_rate, 1_000.0, 1.0, config.eq_vocal)),
            eq_presence: StereoBiquad::new(peaking_eq(sample_rate, 4_000.0, 1.0, config.eq_presence)),
            eq_air: StereoBiquad::new(peaking_eq(sample_rate, 12_000.0, 0.8, config.eq_air)),
            voice_boost: StereoBiquad::new(peaking_eq(sample_rate, 2_500.0, 0.8, 3.2)),
            config,
            bass_low_pass_left: 0.0,
            bass_low_pass_right: 0.0,
            bass_low_pass_alpha: one_pole_alpha(80.0),
            cross_low_pass_left: 0.0,
            cross_low_pass_right: 0.0,
            cross_low_pass_alpha: one_pole_alpha(700.0),
            stereo_width,
            output_gain,
            meters,
            meter_frames: 0,
            meter_peak_l: 0.0,
            meter_peak_r: 0.0,
            meter_sum_l2: 0.0,
            meter_sum_r2: 0.0,
            meter_sum_lr: 0.0,
            meter_limited: 0,
            meter_clip: false,
        }
    }

    /// Accumulate one output frame into the current meter block and publish a
    /// snapshot to the shared atomics when the block fills. Real-time safe:
    /// only floating-point math plus, once per block, a few relaxed stores.
    fn accumulate_meters(&mut self, left: f32, right: f32, limited: bool) {
        let abs_l = left.abs();
        let abs_r = right.abs();
        self.meter_peak_l = self.meter_peak_l.max(abs_l);
        self.meter_peak_r = self.meter_peak_r.max(abs_r);
        self.meter_sum_l2 += left * left;
        self.meter_sum_r2 += right * right;
        self.meter_sum_lr += left * right;
        if limited {
            self.meter_limited += 1;
        }
        if abs_l >= LIMITER_CEILING || abs_r >= LIMITER_CEILING {
            self.meter_clip = true;
        }
        self.meter_frames += 1;

        if self.meter_frames >= METER_BLOCK_FRAMES {
            let n = self.meter_frames as f32;
            let rms_l = (self.meter_sum_l2 / n).sqrt();
            let rms_r = (self.meter_sum_r2 / n).sqrt();
            let denom = (self.meter_sum_l2 * self.meter_sum_r2).sqrt();
            let corr = if denom > 1.0e-9 {
                (self.meter_sum_lr / denom).clamp(-1.0, 1.0)
            } else {
                0.0
            };
            let limiter_activity = self.meter_limited as f32 / n;

            self.meters.publish(
                self.meter_peak_l,
                self.meter_peak_r,
                rms_l,
                rms_r,
                corr,
                limiter_activity,
                self.meter_clip,
            );

            self.meter_frames = 0;
            self.meter_peak_l = 0.0;
            self.meter_peak_r = 0.0;
            self.meter_sum_l2 = 0.0;
            self.meter_sum_r2 = 0.0;
            self.meter_sum_lr = 0.0;
            self.meter_limited = 0;
            self.meter_clip = false;
        }
    }

    fn process_frame(&mut self, mut left: f32, mut right: f32) -> (f32, f32) {
        // Reference path: fully transparent, bit-for-bit passthrough. Metering
        // is passive observation and never alters the signal.
        if self.config.pure_mode {
            self.accumulate_meters(left, right, false);
            return (left, right);
        }

        if self.config.cheap_headphones {
            (left, right) = self.compensation_low.process(left, right);
            (left, right) = self.compensation_mud.process(left, right);
            (left, right) = self.compensation_high.process(left, right);
        }

        if self.config.bass_enhancer {
            self.bass_low_pass_left += self.bass_low_pass_alpha * (left - self.bass_low_pass_left);
            self.bass_low_pass_right += self.bass_low_pass_alpha * (right - self.bass_low_pass_right);

            let synth_left = synthesize_bass_harmonics(self.bass_low_pass_left);
            let synth_right = synthesize_bass_harmonics(self.bass_low_pass_right);

            left += synth_left;
            right += synth_right;
        }

        (left, right) = self.eq_sub.process(left, right);
        (left, right) = self.eq_mid_bass.process(left, right);
        (left, right) = self.eq_vocal.process(left, right);
        (left, right) = self.eq_presence.process(left, right);
        (left, right) = self.eq_air.process(left, right);

        if self.config.voice_boost {
            (left, right) = self.voice_boost.process(left, right);
        }

        // Crossfeed: relax hard-panned stereo for headphone listening by
        // bleeding a low-passed portion of the opposite channel. Energy is
        // renormalized so overall level stays stable and mono-compatible.
        if self.config.crossfeed {
            self.cross_low_pass_left +=
                self.cross_low_pass_alpha * (left - self.cross_low_pass_left);
            self.cross_low_pass_right +=
                self.cross_low_pass_alpha * (right - self.cross_low_pass_right);

            const BLEED: f32 = 0.35;
            let mixed_left = left + BLEED * self.cross_low_pass_right;
            let mixed_right = right + BLEED * self.cross_low_pass_left;
            let norm = 1.0 / (1.0 + BLEED);
            left = mixed_left * norm;
            right = mixed_right * norm;
        }

        // Stereo width: scale the side signal, keep the mid intact so mono
        // fold-down is preserved. width == 1.0 is a no-op.
        if self.config.spatial_widener && (self.stereo_width - 1.0).abs() > f32::EPSILON {
            let mid = (left + right) * 0.5;
            let side = (left - right) * 0.5 * self.stereo_width;
            left = mid + side;
            right = mid - side;
        }

        // Output stage: headroom/makeup trim followed by a transparent
        // soft-knee limiter that only engages near full scale.
        left *= self.output_gain;
        right *= self.output_gain;

        let limited = left.abs() > LIMITER_KNEE || right.abs() > LIMITER_KNEE;
        let out_left = soft_limit(left);
        let out_right = soft_limit(right);
        self.accumulate_meters(out_left, out_right, limited);

        (out_left, out_right)
    }
}

fn synthesize_bass_harmonics(sample: f32) -> f32 {
    let alpha = 0.08;
    let beta = 0.18;
    let gamma = 0.10;
    let harmonic_mix = sample * alpha + sample.powi(2) * beta * sample.signum() + sample.powi(3) * gamma;
    harmonic_mix.clamp(-0.25, 0.25)
}

/// Transparent soft-knee limiter. Signal below the knee threshold passes
/// through unchanged (no coloration of normal-level material); above it, the
/// remaining range is smoothly compressed toward — but never past — a ceiling
/// just under full scale. Monotonic and near-C1 continuous at the knee.
/// Level above which the limiter starts working (and the meter reports it).
const LIMITER_KNEE: f32 = 0.7;
/// Absolute ceiling the limiter asymptotes toward, just under full scale.
const LIMITER_CEILING: f32 = 0.99;

fn soft_limit(sample: f32) -> f32 {
    let magnitude = sample.abs();
    if magnitude <= LIMITER_KNEE {
        return sample;
    }

    let over = magnitude - LIMITER_KNEE;
    let headroom = 1.0 - LIMITER_KNEE;
    let limited = LIMITER_KNEE + (LIMITER_CEILING - LIMITER_KNEE) * (over / (over + headroom));
    limited.copysign(sample)
}

pub struct DspSource<I>
where
    I: Source<Item = f32>,
{
    input: I,
    chain: DspChain,
    right_buffer: Option<f32>,
}

impl<I> DspSource<I>
where
    I: Source<Item = f32>,
{
    pub fn new(input: I, config: AudioDspConfig) -> Self {
        Self::with_meters(input, config, Arc::new(AudioMeters::default()))
    }

    pub fn with_meters(input: I, config: AudioDspConfig, meters: Arc<AudioMeters>) -> Self {
        let sample_rate = input.sample_rate();
        Self {
            input,
            chain: DspChain::new(sample_rate, config, meters),
            right_buffer: None,
        }
    }
}

impl<I> Iterator for DspSource<I>
where
    I: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(right) = self.right_buffer.take() {
            return Some(right);
        }

        let in_channels = self.input.channels();
        let (left, right) = if in_channels == 2 {
            (self.input.next()?, self.input.next()?)
        } else if in_channels == 1 {
            let sample = self.input.next()?;
            (sample, sample)
        } else {
            return self.input.next();
        };

        let (processed_left, processed_right) = self.chain.process_frame(left, right);
        self.right_buffer = Some(processed_right);
        Some(processed_left)
    }
}

impl<I> Source for DspSource<I>
where
    I: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.input.current_frame_len()
    }

    fn channels(&self) -> u16 {
        let chans = self.input.channels();
        if chans == 1 || chans == 2 {
            2
        } else {
            chans
        }
    }

    fn sample_rate(&self) -> u32 {
        self.input.sample_rate()
    }

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
    pub dsp_config: AudioDspConfig,
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
    meters: Arc<AudioMeters>,
}

impl Clone for AudioEngine {
    fn clone(&self) -> Self {
        AudioEngine {
            inner: Arc::clone(&self.inner),
            sink: Arc::clone(&self.sink),
            stream: Arc::clone(&self.stream),
            stream_handle: Arc::clone(&self.stream_handle),
            meters: Arc::clone(&self.meters),
        }
    }
}

impl AudioEngine {
    pub fn new(stream: rodio::OutputStream, stream_handle: OutputStreamHandle) -> Self {
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
                    dsp_config: AudioDspConfig::default(),
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
            meters: Arc::new(AudioMeters::default()),
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

    pub fn get_meters(&self) -> AudioMetersSnapshot {
        // When paused/stopped the audio thread isn't producing frames, so the
        // atomics would freeze on their last block. Report rest instead.
        let is_playing = self.inner.lock().unwrap().playback.is_playing;
        if is_playing {
            self.meters.snapshot()
        } else {
            AudioMetersSnapshot {
                peak_left: 0.0,
                peak_right: 0.0,
                rms_left: 0.0,
                rms_right: 0.0,
                correlation: 0.0,
                limiter_activity: 0.0,
                clipping: false,
            }
        }
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
        let (track, dsp_config) = {
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
                inner.playback.dsp_config.clone(),
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
            let dsp_source = DspSource::with_meters(source, dsp_config, Arc::clone(&self.meters));

            let new_sink_res = {
                let handle_guard = self.stream_handle.lock().unwrap();
                Sink::try_new(&handle_guard)
            };

            let new_sink = new_sink_res
                .map_err(|e| format!("Cannot create audio output sink: {}. Please verify your audio output device.", e))?;

            println!("[AUDIO ENGINE] Playing track: '{}' from '{}'", track.title, track.path);
            let in_channels = dsp_source.channels();
            let sample_rate = dsp_source.sample_rate();
            println!("[AUDIO ENGINE] Source channels: {}, sample rate: {}", in_channels, sample_rate);
            let volume = self.inner.lock().unwrap().playback.volume;
            println!("[AUDIO ENGINE] Setting volume to: {}", volume);
            new_sink.set_volume(volume);
            new_sink.append(dsp_source);
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
        inner.playback.dsp_config.voice_boost = dialog;
        inner.playback.dsp_config.spatial_widener = spatial;
    }

    pub fn set_dsp_config(&self, dsp_config: AudioDspConfig) {
        let mut inner = self.inner.lock().unwrap();
        inner.playback.dolby_dialog = dsp_config.voice_boost;
        inner.playback.dolby_spatial = dsp_config.spatial_widener;
        inner.playback.dsp_config = dsp_config;
    }

    pub fn get_dsp_config(&self) -> AudioDspConfig {
        self.inner.lock().unwrap().playback.dsp_config.clone()
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
pub fn get_audio_meters(engine: tauri::State<Arc<Mutex<AudioEngine>>>) -> AudioMetersSnapshot {
    engine.lock().unwrap().get_meters()
}

#[command]
pub fn get_dsp_config(engine: tauri::State<Arc<Mutex<AudioEngine>>>) -> AudioDspConfig {
    engine.lock().unwrap().get_dsp_config()
}

#[command]
pub fn set_dsp_config(
    engine: tauri::State<Arc<Mutex<AudioEngine>>>,
    dsp_config: AudioDspConfig,
) {
    engine.lock().unwrap().set_dsp_config(dsp_config);
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
                dsp_config: AudioDspConfig {
                    voice_boost: false,
                    spatial_widener: false,
                    ..AudioDspConfig::default()
                },
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
                dsp_config: AudioDspConfig {
                    voice_boost: false,
                    spatial_widener: false,
                    ..AudioDspConfig::default()
                },
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
    fn test_dsp_source_stability() {
        // 1. Verify Silence input (all 0.0) yields silence output
        let silence_samples = vec![0.0; 100];
        let mock_source = MockSource::new(silence_samples, 2, 44100);
        let mut dolby_source = DspSource::new(
            mock_source,
            AudioDspConfig {
                voice_boost: false,
                spatial_widener: false,
                cheap_headphones: false,
                bass_enhancer: false,
                ..AudioDspConfig::default()
            },
        );
        
        let output: Vec<f32> = dolby_source.by_ref().collect();
        assert_eq!(output.len(), 100);
        for &sample in &output {
            assert_eq!(sample, 0.0);
        }

        // 2. Verify Silence stability under active dialog/spatial processing
        let silence_samples2 = vec![0.0; 100];
        let mock_source2 = MockSource::new(silence_samples2, 2, 44100);
        let mut dolby_source2 = DspSource::new(mock_source2, AudioDspConfig::default());
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
        let mut dolby_source3 = DspSource::new(mock_source3, AudioDspConfig::default());
        let output3: Vec<f32> = dolby_source3.by_ref().collect();
        assert_eq!(output3.len(), 200);
        for &sample in &output3 {
            assert!(sample >= -1.0 && sample <= 1.0, "Sample {} exceeded bounds", sample);
        }

        // 4. Verify Voice Boost (Dialog Enhance) does not cause divergence/explode under high frequency inputs
        let mut high_freq_samples = Vec::new();
        for i in 0..100 {
            let val = if i % 2 == 0 { 0.8 } else { -0.8 };
            high_freq_samples.push(val); // Left
            high_freq_samples.push(-val); // Right
        }
        let mock_source4 = MockSource::new(high_freq_samples, 2, 44100);
        let mut dolby_source4 = DspSource::new(
            mock_source4,
            AudioDspConfig {
                spatial_widener: false,
                ..AudioDspConfig::default()
            },
        );
        let output4: Vec<f32> = dolby_source4.by_ref().collect();
        assert_eq!(output4.len(), 200);
        for &sample in &output4 {
            assert!(sample >= -1.0 && sample <= 1.0);
        }

        // 5. Verify Spatial 3D (Spatial Widener) output is stable and properly bounded
        let mut spatial_samples = Vec::new();
        for i in 0..100 {
            let val = (i as f32).sin();
            spatial_samples.push(val);
            spatial_samples.push(-val);
        }
        let mock_source5 = MockSource::new(spatial_samples, 2, 44100);
        let mut dolby_source5 = DspSource::new(
            mock_source5,
            AudioDspConfig {
                voice_boost: false,
                ..AudioDspConfig::default()
            },
        );
        let output5: Vec<f32> = dolby_source5.by_ref().collect();
        assert_eq!(output5.len(), 200);
        for &sample in &output5 {
            assert!(sample >= -1.0 && sample <= 1.0);
        }
    }

    #[test]
    fn test_pure_mode_bypasses_processing() {
        let input_samples = vec![0.25, -0.25, -0.5, 0.5, 0.1, -0.1];
        let mock_source = MockSource::new(input_samples.clone(), 2, 44100);
        let output: Vec<f32> = DspSource::new(
            mock_source,
            AudioDspConfig {
                pure_mode: true,
                ..AudioDspConfig::default()
            },
        )
        .collect();

        assert_eq!(output, input_samples);
    }
}
