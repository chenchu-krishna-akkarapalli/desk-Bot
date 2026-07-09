
```markdown
# Prompt for Kimi Work Agent: Desktop Wellness & High-Fidelity Audio Application (Tauri v2 + React/TSX + Tailwind CSS v4)

You are an expert software engineer and UI/UX designer specializing in system-level desktop automation, native low-latency audio processing (Tauri/Rust), and high-fidelity Apple Human Interface Design implementations. Your objective is to scaffold, configure, and develop a production-ready, ultra-lightweight desktop wellness application with an integrated high-quality, Spotify-like audio layer based strictly on the parameters provided below.

---

## 1. Clear Goal
To build a high-performance, resource-efficient desktop health and focus application using Tauri v2 that tracks active screen time, manages ergonomic break cycles, and hosts a built-in high-quality audio architecture. The app features an immersive, Spotify-inspired playback footer. The core audio processing, local catalog indexing, and continuous asset decoding are handled safely on a native Rust thread pool, while a React 19 TSX frontend displays a Liquid Glass aesthetic, handling layout updates and player micro-animations seamlessly without UI blockages.

## 2. Role
* **Primary Identity:** Lead Systems & Frontend Engineer / UX Architect.
* **Behavioral Protocol:** You operate exclusively on verifiable clinical research, low-level audio engineering principles, and strict structural specifications. No assumptions, placeholder logic, or arbitrary design patterns are permitted. Every layout decision must map to a specific UX Law, and every audio asset path must decouple cleanly from the main WebView rendering loop.

## 3. Tech Stack
* **Desktop Framework:** Tauri v2 (Latest Stable, utilizing optimized Rust core)
* **Audio Core Architecture:** Rust native crates (`symphonia` for hardware-accelerated decoding, `rodio` / `cpal` for native output sinks, and `lofty` for ultra-fast local tag/ID3 caching)
* **Frontend Framework:** React 19 (TypeScript / `.tsx`)
* **Build Tooling:** Vite (Latest Stable)
* **Styling Architecture:** Tailwind CSS v4 (Native engine utilizing explicit CSS-based configuration)
* **State Management:** Zustand (Lightweight store decoupled from React's re-render cycle for low memory overhead and high-frequency player tick synchronization)
* **Icons:** Lucide React (or native SVG paths matching SF Symbols style)

## 4. Scope
* **In-Scope:**
    * System-level idle time hooks (Rust side) interfacing with front-end countdown timers.
    * State-based countdown engines automating the 20-20-20 Rule, 100-step/micro-movement targets, and hydration logs.
    * Event-driven Rust-to-Frontend audio player engine bridge running on background threads (gapless playback, precise track seeking, volume scaling, metadata broadcast).
    * Integrated OS-level media keys and lock screen widgets utilizing specialized platform plugins.
    * Fully hardware-accelerated CSS Glassmorphism matching Apple’s Human Interface Guidelines (HIG).
* **Out-of-Scope:**
    * Cloud-based profile syncing or cross-device databases (all data remains local).
    * Third-party commercial music platform API integrations (e.g., Spotify OAuth codebases)—instead, focus on standardized web-audio file streams, ambient noise generators, or high-fidelity localized audio tracks.

## 5. Target Audience & System Environment
* **Target Users:** Software developers, knowledge workers, and individuals subjected to continuous screen time (>6 hours daily) who rely on uninterrupted focus music.
* **Operating Systems:** macOS (Primary target for native HIG presentation), Windows 11, and Linux (X11/Wayland).

## 6. Constraints
* **Zero Assumption Rule:** Do not guess layouts, dimensions, or default behavior. If a spec is missing, query the system hooks or default to exact Apple standard ratios (e.g., 44px touch/click targets, 12pt body typography fonts).
* **Memory Footprint Limit:** The running Tauri application background worker must consume less than 45MB of RAM (inclusive of the native Rust audio playback sinks). Avoid heavy npm packages or client-side indexing engines.
* **No Layout Breakages:** Flex and Grid wrappers must not be declared directly on the top-level `body` tag due to WebKit/Blink print and overlay clipping in sub-window viewports. Use absolute, relative positioning, or structured `div` tables.
* **No External Assets:** Fonts, icons, and audio buffers must be bundled locally. Do not fetch styles, scripts, or assets from external Content Delivery Networks (CDNs).

## 7. Operational Workflow


```

[User Boot] ──> [Rust Core Hooks & Audio Engine Active] ──> [Monitor Device Usage & Idle]
│
┌────────────────────────────────────────────────────┴──────────────────────────────────────────┐
▼                                                                                               ▼
[Active Screen State: Focus]                                                       [Idle State (>3 Mins)]
│                                                                                               │
├──> Run 20-Min Ocular Loop                                                                     └──> Pause Background Timers
├──> Accumulate Hydration Metric                                                                     Pause/Mute Focus Tracks
└──> Run Audio Engine: Play Focus/LoFi Track in Footer
│
▼
[Threshold Reached: Break State]
│
├──> Crossfade Focus Audio Out / Crossfade Alpha Waves In (Linear 2.5s duration)
├──> Transform App Viewport to Glass Modal via Tauri API
└──> Enforce UX Minimization (Hick's Law Layout)

```

---

## 8. Structural Rules & Research Parameters
To remain strictly compliant with zero-assumption execution, you must write all application logic and styling parameters according to these core anchors:

### A. Clinical Metrics & Automation Rules
1.  **Ocular Health Loop (20-20-20 Rule):** Every 20 minutes, trigger a 20-second modal layer. The interface must display a structural guide animating a synchronization counter to facilitate continuous eye blinking and focus reconfiguration.
2.  **Vascular/Muscular Recovery (100 Steps or Micro-Stretches):** Every 50 minutes, a mandatory 5-minute break occurs. If physical movement (100 steps) cannot be parsed or updated via user verification, the UI presents an interactive carousel displaying three targeted desktop physical therapy movements (e.g., wrist extension, scapular retraction).
3.  **Hydration Engine:** Base intake thresholds calculated algorithmically on a baseline calculation (e.g., 35ml per kg of body mass per day). The user dashboard maintains quick-action inputs (+250ml, +500ml) embedded seamlessly into interactive interface nodes.
4.  **State-Based Audio Therapy:** Transition phases must execute a smooth crossfade over exactly 2.5 seconds. When a break is initiated, focus playlists drop in amplitude while calming tracks (Alpha/Theta brainwave frequencies, pink noise) scale upward via the Rust core audio channel mixers.

### B. Apple HIG & Media Interface Design System Matrix
* **Visual Structure:** Utilize the Liquid Glass aesthetic. All container classes must implement a backdropping system filter: `blur(25px) saturate(140%)` with a light/dark base transparency layer.
* **Border Profiles:** 1px solid structural outlines using a linear directional gradient from high opacity top/left (`rgba(255,255,255,0.22)`) to low opacity bottom/right (`rgba(255,255,255,0.04)`).
* **The High-Fidelity Footer Player:** Positioned fixed at the bottom of the viewport viewport layout. Left side: track art thumbnail, title, and artist text wrap layers. Center side: media buttons (Shuffle, Prev, Play/Pause circle button, Next, Repeat) centered over a high-precision progress timeline slider. Right side: Volume controls, audio route selector, and break-state sync configurations.
* **Typography Hierarchy:** Font engine mapping strictly to `SF Pro Rounded` for data metrics/headers and `SF Pro Text` for standard system strings. Ensure text layers apply native background blending or vibrancy values to prevent contrast dropouts against dark desktop wallpapers.

### C. UX Laws Application
* **The Law of Proximity:** Keep status elements, current progress indicators, and actionable buttons within the same structural viewport wrapper. Group track status elements cleanly within the footer frame.
* **Fitts's Law:** Critical break controls and player playback triggers (such as Play/Pause buttons or completing an action item) must maintain an expansive target region with a minimum interactive dimension of 44px by 44px.
* **Hick's Law:** Minimize user selections during active recovery phases. The app window must hide all configurations, analytical charts, or music navigation tracks when a break is active, replacing them with a simplified, clean player bar focused entirely on therapeutic ambient tones.

---

## 9. Required Files Blueprint
You must configure the workspace to match this exact structural schema:

```text
├── src-tauri/
│   ├── Cargo.toml             # Tauri v2 dependencies (symphonia, rodio, lofty, tauri-plugin-media)
│   └── src/
│       ├── main.rs            # Application bootstrap & OS context bindings
│       ├── system_hooks.rs    # Rust-level idle time handlers
│       └── audio_engine.rs    # Native audio core, state sinks, and metadata decoders
├── src/
│   ├── main.tsx               # Frontend entry initialization
│   ├── App.tsx                # Application root viewport router featuring fixed layout frames
│   ├── index.css              # Tailwind CSS v4 directives & custom glass variables
│   ├── components/
│   │   ├── BreakOverlay.tsx   # Glassmorphic break screen (Hick's Law layout)
│   │   ├── Dashboard.tsx      # Main tracking interface (Law of Proximity layout)
│   │   ├── GlassCard.tsx      # Reusable structural UI element (Liquid Glass spec)
│   │   └── PlayerFooter.tsx   # Spotify-style premium player component inside the view footer
│   ├── hooks/
│   │   ├── useScreenTime.ts   # Integrates Tauri backend invoke loops to state
│   │   └── usePlayerBridge.ts # Intercepts Rust playback-state-changed events to update local state
│   └── store/
│       └── usePlayerStore.ts  # Zustand store for lightweight high-frequency timeline scrubbing
├── package.json               # Vite, React 19, Zustand, and Tailwind CSS v4 scripts
└── tauri.conf.json            # Window configurations (Vibrancy, blur, and native media plugins)

```

---

## 10. Execution Tasks & Implementation Steps

### Step 1: Rust System & Audio Core Integration

* Implement native system event monitoring within `src-tauri/src/system_hooks.rs`. This file must track user keyboard/mouse inactivity periods using native operating system APIs.
* Implement the audio platform inside `src-tauri/src/audio_engine.rs`. Utilize `symphonia` for file loading/decoding and manage audio nodes over background channels via `rodio`. Expose Tauri commands to frontend hooks (`toggle_playback()`, `seek_track()`, `set_volume()`).
* Hook the engine into `tauri-plugin-media` inside `main.rs` to allow native OS control links (media keys, lock screen artwork updates) to command the Rust playback queue directly.

### Step 2: Styling and Environment Pipeline Configuration

* Configure `src/index.css` to ingest Tailwind CSS v4 variables. Build explicit custom classes for the glassmorphism parameters.
* Configure `tauri.conf.json` to enable native platform-level window decorations, ensuring the background transparency layer reads correctly as an Apple material window type with full vibrancy enabled.

### Step 3: High-Fidelity Frontend Construction (React 19 + TSX)

* Build `PlayerFooter.tsx` using the exact layout dimensions. Apply border gradients and backdrop-filter attributes to render the material layer cleanly. Maintain separate blocks for the tracks info section, progress seek bar, and system output hooks.
* Build the `Dashboard.tsx` view using the Law of Proximity. Metrics for water tracking, current progress toward 100 steps, and active work durations must be visually grouped into adjacent, independent panels sitting structurally above the player footer.
* Build `BreakOverlay.tsx` using Hick's Law. When a breakdown timer ends, call the Tauri window API to maximize or focus the screen view, display the blinking or movement sequence prominently, and strip out non-essential controls. The `PlayerFooter` transforms instantly to reflect therapeutic noise channels, disabling standard pop tracks.

### Step 4: Event-Driven Player Bridge Implementation

* Implement `usePlayerBridge.ts` to tap into Tauri's backend emitter. Instead of spamming invocations, the frontend must listen to an active event stream (`playback-state-changed`) sent by the Rust core thread at throttled 250ms intervals.
* Connect this layout hook to the `usePlayerStore.ts` Zustand hub to smoothly drive the playback scrubber bar and counter layers without taxing React's global DOM reconciliation system.

---

## 11. Success Criteria & Quality Assurance Metrics

* **Design Accuracy Verification:** The UI must display crisp, non-blurry borders on both high-density (Retina) and standard displays. Text layers must maintain a minimum Web Content Accessibility Guidelines (WCAG) contrast ratio of 4.5:1 against varying desktop backgrounds by using dynamic backdrop-saturation.
* **Audio Seamlessness Metrics:** Track switching must execute instantly without stuttering or interface delays. Audio transition phases must transition crossfade curves linearly over exactly 2.5 seconds when moving from focus states to break workflows.
* **Memory Execution Profiles:** Running the app pipeline inside structural stress profiles must show stable allocations with zero memory leaks over a continuous 24-hour testing sequence, keeping memory usage strictly under 45MB.

---

## 12. Final Deliverables Requirement

Generate the complete codebase mapped precisely to the specified directory configuration. Deliver clean, production-grade files. Do not trim code blocks, omit essential structures, or use incomplete code paths. Include step-by-step shell commands to clean, compile, and run the system.

```
***

```