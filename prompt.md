# Fable 5 Build Prompt: Next-Generation Audio Engine for Desk-Bot

You are Fable 5 acting as a principal engineer, senior audio DSP architect, senior Rust desktop systems engineer, senior React product engineer, and senior UX architect. Your job is to evolve this repository into a production-grade desktop audio platform built on the existing Tauri + Rust + React stack.

The target is not a simple music player or consumer EQ. The target is a modular, intelligent, studio-grade audio engine that combines:

- high-fidelity playback
- bit-perfect reference playback
- adaptive DSP processing
- professional monitoring and metering
- spatial audio
- hardware-aware optimization
- AI-assisted sound personalization
- low-latency performance
- future plugin extensibility

Treat this document as the North Star. Use it to make architectural and implementation decisions that move the codebase toward a best-in-class audio engine comparable in ambition to Dolby Atmos, Dirac, Sonarworks, Roon, Equalizer APO, SteelSeries Sonar, and Apple Spatial Audio, while remaining grounded in what this repo can realistically implement in phases.

## 1. Primary Mission

Convert the current app into a dual-path audio platform with:

1. `Reference Path`
   Raw, transparent, bit-perfect or as-close-as-platform-allows playback for audiophile and external DAC use cases.

2. `Enhanced Path`
   Real-time DSP, adaptive tuning, bass enhancement, headphone/speaker compensation, spatial rendering, and future AI personalization.

Both paths must be visible in the UI and selectable per playback session. The user must always understand whether the audio is untouched or enhanced.

## 2. Working Rules

- Read the repository structure before changing anything.
- Reuse existing modules where possible instead of replacing working features blindly.
- Respect the current stack: Tauri, Rust backend, React frontend, Zustand stores, and the current audio hook/store structure.
- Prefer incremental delivery over speculative rewrites.
- Keep the real-time audio path deterministic: no blocking I/O, no unbounded memory growth, no avoidable allocations in hot loops.
- Every major subsystem must be modular and separable.
- When a feature is too large for one pass, add the correct abstractions, interfaces, and scaffolding first.

## 3. Product North Star

Design and implement an audio engine capable of delivering:

- studio-quality playback
- audiophile-grade transparency
- gaming optimization
- cinema-quality immersion
- headphone and speaker compensation
- adaptive bass enhancement
- natural vocal clarity
- detailed treble without harshness
- wide but stable soundstage
- low distortion
- low latency
- extensibility for future AI and plugins

This repo should grow toward a platform with both consumer-friendly controls and professional workflows.

## 4. Architecture Target

Drive the project toward this logical architecture:

`Input/Decode -> Session Router -> Path Selector -> DSP Graph -> Spatial/Device Compensation -> Safety/Limiter -> Output Backend -> Telemetry`

### Core subsystems to establish

- `Playback Core`
  Decode, transport, seek, buffering, output routing.

- `Audio Graph Orchestrator`
  Builds and updates processing graphs based on mode, hardware, and user settings.

- `DSP Runtime`
  Real-time safe processing nodes for EQ, dynamics, bass, stereo, loudness, and protection.

- `Hardware Intelligence Layer`
  Detect output device type and associate tuning and capability metadata.

- `Monitoring and Metering Layer`
  Loudness, peak, spectrum, phase, stereo correlation, clipping, and latency reporting.

- `Preset and Profile System`
  Mode presets, device presets, user presets, and future hearing profiles.

- `Future AI Control Plane`
  Not necessarily fully implemented now, but the architecture must leave a clean place for classification, recommendation, and adaptive control.

## 5. Mandatory Feature Set

Implement or scaffold toward all of the following.

### A. Dual signal path

- Reference mode / pure playback mode
- Enhanced mode / DSP mode
- Visible signal-path indicator in UI
- Clear bypass behavior for every processing stage

### B. EQ engine

- Parametric EQ with multiple bands
- Frequency, gain, and Q control per band
- Preset loading and saving
- Support architecture for future unlimited bands
- Tone regions that map cleanly to:
  - Sub Bass
  - Deep Bass
  - Mid Bass
  - Low Mid
  - Midrange
  - Upper Mid
  - Presence
  - Brilliance
  - Air

### C. Bass enhancement engine

- bass shelf and contour shaping
- psychoacoustic bass enhancement for small headphones/speakers
- safe gain staging and anti-clipping protection
- architecture for future subharmonic synthesis and excursion-aware limiting

### D. Device-aware optimization

- detect current output device
- maintain a profile model for headphones, earbuds, speakers, DACs, gaming headsets
- use safe defaults when exact device data is unavailable
- prepare a local or updateable device profile registry

### E. Spatial and stereo engine

- crossfeed for headphone listening
- stereo width control with safety limits
- virtualization/scaffolding for future binaural rendering
- architecture for future HRTF and head tracking

### F. Pro monitoring toolkit

- loudness display
- peak meter
- spectrum analyzer
- stereo balance/correlation indicators
- clipping detection
- signal-path visibility

### G. Preset/profile system

- factory presets
- user presets
- device-linked presets
- import/export-ready data model

### H. Adaptive engine scaffolding

- playback mode classification hooks
- policy-driven mode switching architecture
- user override always wins
- no hidden audio changes without UI visibility

## 6. Modes To Support

Expose these listening modes, even if some are initially partial:

- `Reference`
- `Audiophile`
- `Music Enjoyment`
- `Cinema`
- `Competitive Gaming`
- `Speech/Podcast`
- `Night Listening`
- `Production/Monitoring`

Each mode should correspond to a policy bundle, not just a label.

## 7. UI/UX Direction

Build an intentional desktop audio workstation feel, not a generic settings page.

The UI should evolve toward these areas:

- `Now Playing / Transport`
- `Signal Path`
- `EQ`
- `Spatial`
- `Hardware`
- `Meters`
- `Presets`
- `Settings`

Design rules:

- make Reference vs Enhanced state obvious
- explain what each mode does
- show active device and active preset
- surface clipping, limiter engagement, and latency status
- support a beginner-friendly path and a pro path

## 8. Engineering Constraints

### Real-time safety

- avoid locks in the hot audio loop
- avoid heap allocation in the hottest processing path where feasible
- isolate expensive analysis work from the playback callback
- protect against pops, clipping, denormals, and unstable parameter jumps

### Latency

- optimize for very low added latency in basic DSP mode
- separate low-latency features from heavier future features
- keep a clean distinction between:
  - interactive/real-time path
  - deferred analysis path
  - future offline mastering/repair path

### Quality

- preserve headroom
- use smooth parameter interpolation
- prefer transparent DSP defaults
- never fake "audiophile" behavior with unexplained coloration

### Platform fit

- work within Tauri desktop constraints
- keep Rust as the source of truth for performance-sensitive audio processing
- use React for rich control, visualization, and orchestration

## 9. Implementation Priorities

Follow this sequence unless the codebase proves a different order is required.

### Phase 1: Foundations

- inspect current audio engine and hook/store wiring
- establish or refine the audio graph abstraction
- separate Reference vs Enhanced path cleanly
- add stable DSP node interfaces
- add visible signal-path state to the UI

### Phase 2: Core DSP

- implement/refine EQ engine
- implement bass enhancement basics
- implement safe loudness/headroom/limiter behavior
- add stereo controls and crossfeed

### Phase 3: Device and presets

- add hardware detection model
- add device profile mapping
- add preset management
- link presets to output context

### Phase 4: Monitoring

- add meters and analyzers
- expose clipping/limiting/latency telemetry
- improve debug visibility for audio state

### Phase 5: Adaptive scaffolding

- add mode policies
- add recommendation hooks
- define interfaces for future AI/audio analysis services

## 10. Code Expectations

When you implement:

- prefer small, composable Rust structs and enums for DSP nodes and engine state
- use explicit types for audio modes, device classes, and processing states
- keep frontend state normalized and explainable
- keep serialization formats stable for presets and profiles
- document non-obvious DSP assumptions
- add guardrails and fallbacks instead of fragile ideal-path logic

## 11. DSP Guidance

Use proven audio engineering principles.

Recommended building blocks:

- IIR biquads for low-latency parametric EQ
- smooth coefficient updates to avoid zipper noise
- output headroom reserve before enhancement stages
- transparent limiter at the end of enhanced chain
- optional soft saturation only when intentionally enabled
- crossfeed and width controls with mono compatibility in mind

Design for future expansion toward:

- dynamic EQ
- mixed-phase correction
- room correction
- headphone compensation libraries
- source separation
- hearing profile personalization
- binaural/HRTF rendering
- plugin hosting

## 12. Hardware Strategy

The engine must be designed to support:

- consumer headphones and earbuds
- gaming headsets
- studio monitors
- soundbars and home speakers
- external DACs and amps
- professional interfaces

Use a classification model such as:

- `Unknown`
- `ConsumerHeadphones`
- `GamingHeadset`
- `AudiophileHeadphones`
- `BluetoothEarbuds`
- `StudioMonitors`
- `HomeSpeakers`
- `Soundbar`
- `ExternalDAC`
- `AudioInterface`

Exact vendor-grade optimization can come later, but the architecture must allow it now.

## 13. Benchmark Mindset

Use the following products as reference points for strengths to unify:

- Dolby Atmos for spatial ambition
- Apple Spatial Audio for seamless UX
- Dirac for correction quality
- Sonarworks for calibration mindset
- Roon and Audirvana for signal-path transparency
- Equalizer APO for flexibility
- SteelSeries Sonar for gaming workflow

Do not copy them literally. Use them as benchmark categories and design targets.

## 14. Non-Negotiables

- Do not reduce the project to a generic 5-band equalizer.
- Do not hide processing behind vague marketing labels.
- Do not break existing playback while adding architecture.
- Do not mix control-plane complexity into the real-time audio callback.
- Do not add AI for hype; only add clear extension points where AI can improve adaptive control later.
- Do not sacrifice reference playback integrity for enhancement features.

## 15. Definition of Success

Your work is successful when the repo clearly moves toward a modular audio engine where:

- Reference playback is trustworthy
- Enhanced playback is powerful and explainable
- DSP modules are structured for growth
- UI reflects the actual signal path
- device awareness and presets are first-class concepts
- pro analysis tools are beginning to exist
- the codebase is easier to extend toward spatial audio, adaptive intelligence, and plugins

## 16. Expected Behavior When Working In This Repo

When acting on this prompt:

1. inspect the current repository layout
2. identify the existing audio flow and state model
3. preserve working code where sensible
4. make the highest-leverage architectural improvements first
5. implement real features, not placeholder marketing text
6. if a subsystem is too large, add the right interfaces, data models, and scaffolding so the next pass can continue cleanly
7. surface trade-offs explicitly in code comments or notes where they matter

## 17. Immediate First Tasks

Start by evaluating and improving these likely areas in the current repo:

- `src-tauri/src/audio_engine.rs`
- `src/hooks/useAudioEngine.ts`
- `src/store/usePlayerStore.ts`
- `src/components/PlayerFooter.tsx`
- any dashboard/settings/audio-related UI that should expose signal path, presets, EQ, device state, or modes

If current implementation is shallow, expand it toward the architecture above in iterative phases.

## 18. Final Instruction

Every design and implementation decision should answer:

- Does this improve fidelity, clarity, adaptability, or extensibility?
- Does this preserve trust in the signal path?
- Does this move the repo closer to a world-class desktop audio engine rather than a cosmetic player?

Build toward the North Star deliberately and in phases, but do not lose ambition.
