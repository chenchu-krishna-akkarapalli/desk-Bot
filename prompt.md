# Prompt for Kimi Work Agent: Desktop System Monitor & Floating Bar Utility (Tauri v2 + React/TSX + Tailwind CSS v4)

You are an expert software engineer and UI/UX designer specializing in desktop-level automation (Tauri/Rust) and high-fidelity, futuristic interface designs. Your objective is to scaffold, configure, and develop a production-ready, ultra-lightweight desktop system monitor application featuring a real-time status dashboard, system notification triggers, storage info displays, and a dynamic "Floating Bar" HUD mode.

---

## 1. Clear Goal
To build a high-performance, resource-efficient desktop monitoring utility using Tauri v2 that tracks real-time system performance metrics (CPU, RAM, Temperature, and Network Mbps), displays storage metrics, and triggers alerts via native system notifications. When the application is closed or minimized, it must intercept the action and transform into a compact, draggable "Floating Bar" HUD on the desktop layer with adjustable transparency. The interface features a custom settings gear menu offering 5 distinct futuristic themes.

## 2. Role
* **Primary Identity:** Lead Systems & Frontend Engineer / UX Architect.
* **Behavioral Protocol:** You operate with absolute precision. All backend calculations (such as network Mbps delta tracking and temperature readings) must be computed on highly optimized Rust background threads to prevent main thread blocking. Every frontend component must render smoothly within a low-memory footprint using React 19 and Tailwind CSS v4.

## 3. Tech Stack
* **Desktop Framework:** Tauri v2 (Latest Stable, Rust core)
* **System Metrics Core:** Rust crate `sysinfo` (v0.30+) for lightweight metrics polling.
* **Tauri Plugins:** `@tauri-apps/plugin-notification` (Tauri v2 Native Notification Plugin)
* **Frontend Framework:** React 19 (TypeScript / `.tsx`)
* **Build Tooling:** Vite (Latest Stable)
* **Styling Architecture:** Tailwind CSS v4 (Native engine utilizing CSS-based theme configurations)
* **State Management:** Zustand (Lightweight store for high-frequency UI updates)
* **Icons:** Lucide React (Futuristic custom styled paths)

## 4. Scope

### In-Scope
* **Real-time Metrics Polling:** Rust-side sysinfo integration for CPU usage, RAM utilization, network download/upload speeds in Mbps, and CPU/GPU temperatures.
* **Dynamic Window Transformation:** Intercepting window close/minimize requests to instead hide the main window frame and show a compact, always-on-top, borderless Floating Bar HUD.
* **HUD Customizations:** Implementing dynamic dragging using `data-tauri-drag-region` and real-time transparency/opacity controls.
* **Storage Analyzer:** Parsing total and free storage space across all mounted drives.
* **Left-Side Performance Graph:** Designing an animated, low-overhead SVG/Canvas real-time graph displaying overlapping waves of CPU, RAM, Temp, and Mbps.
* **Futuristic Themes Configurator:** Settings menu with 5 unique visual design styles.
* **Tauri v2 Notifications:** Requesting permissions and firing system alerts for high system temperatures, heavy CPU loads, or low disk space.

### Out-of-Scope
* Third-party cloud integration (all settings are stored locally using Tauri's local storage or file system store).
* Background analytics database logging (only buffer recent 60-second points in memory for real-time graphs).

## 5. Target Audience & System Environment
* **Target Users:** Power users, developers, and gamers monitoring local hardware health.
* **Operating Systems:** Windows 11, macOS (Apple Silicon/Intel), and Linux (Ubuntu/Debian compatible).

## 6. Constraints
* **Memory Limits:** The running application (including Rust system polling and WebView frontend) must stay strictly under **40MB RAM** during background monitoring.
* **CPU Limits:** Polling thread activity must not exceed **1% CPU utilization**. Avoid continuous polling on the main JS thread; use event-driven Rust bridge messages.
* **Zero Asset CDNs:** All fonts, icons, and assets must be bundled locally inside the Tauri package.
* **Window Transparency:** Must handle transparency fallbacks gracefully on platforms or OS states where native transparency/vibrancy is disabled.

## 7. Operational Workflow

```
                  ┌───────────────────────────────┐
                  │          App Boot             │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │    Rust SysInfo Loop Active   │
                  │   (Updates sent every 1-2s)   │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │      Dashboard UI Active      │
                  │ (Left-side Graph & Storage)   │
                  └──────────────┬────────────────┘
                                 │
             User Clicks Close/Minimize or Triggers Hide
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │     Intercept Window Event    │
                  │    (api.prevent_close())      │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │    Shrink Window to HUD       │
                  │  (Resize, transparent, on top) │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │    Floating Bar HUD Active    │
                  │ (Draggable, Opacity Adjusted) │
                  └───────────────────────────────┘
```

---

## 8. Rules & Standards & Tripzy Design System

### A. Core Development Rules
* **No Layout Breakages:** Do not declare flex/grid directly on the `html` or `body` tags. Use absolute structural wrapper layers to accommodate clean window size transitions.
* **Dynamic Styling Hooks:** Style components using Tailwind CSS CSS-variables matching the selected template. Do not hardcode colors in JSX.
* **Notification Safeguards:** Check permission status before firing native notifications. Ensure notifications do not spam the user (throttle alerts to a maximum of once per 10 minutes per rule).

### B. Tripzy Reference Design System (Pixel-Perfect Specs)
To achieve the exact layout, colors, and styling patterns from the reference Tripzy dashboard image with zero assumptions, implement the following specifications:

1. **Card Backgrounds & Opacity**
   * **Base Background:** Deep, semi-transparent charcoal glass. Custom style: `background-color: rgba(16, 21, 24, 0.8)` or solid `#101518`.
   * **Backdrop Blur:** `backdrop-filter: blur(20px) saturate(130%)`.
   * **Contextual Radial Glows:** Cards must feature a subtle underlying radial glow matching their themed category. Implement this using an absolute-positioned background glow layer:
     * *Green (Revenue/CPU):* `radial-gradient(circle at bottom left, rgba(0, 229, 163, 0.12) 0%, rgba(0, 0, 0, 0) 70%)`
     * *Yellow (Available/RAM):* `radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.1) 0%, rgba(0, 0, 0, 0) 70%)`
     * *Purple (Total Cars/Network):* `radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.1) 0%, rgba(0, 0, 0, 0) 70%)`
     * *Red (Bookings/Temperature):* `radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.1) 0%, rgba(0, 0, 0, 0) 70%)`

2. **Border Radii & Gradients**
   * **Border Radius Hierarchy:**
     * Outer App Shell: `24px`
     * Dashboard Main Cards (Graphs, Map, Lists): `20px`
     * Metrics/KPI Cards: `18px`
     * Nav Pill / Inactive Icon Cards: Fully rounded pill shape (`9999px` / `h-1/2`)
     * Action Buttons / Dropdowns: `14px`
   * **Border Styles (1px width):**
     * Default card borders use a linear gradient: `linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)`.
     * Themed cards use active highlight borders in their top-left bounds:
       * *Green:* `linear-gradient(135deg, rgba(0, 229, 163, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%)`
       * *Yellow:* `linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%)`
       * *Purple:* `linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%)`
       * *Red:* `linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(255, 255, 255, 0.02) 100%)`

3. **Graph Design (Waveforms & Layout)**
   * **Curve Interpolation & Tension:** Waveforms must render as smooth cubic Bezier curves utilizing monotone cubic spline interpolation (tension `0.4`) to prevent peak clipping.
   * **Line Stroke Details:** 
     * **Primary Wave (Current Period):** Solid line of `2.5px` width. Applied glow filter: `filter: drop-shadow(0px 3px 8px rgba(var(--theme-color-rgb), 0.65))`.
       * *CPU/Revenue Line:* Emerald green `#00E5A3` (RGB: `0, 229, 163`)
       * *RAM/Available Line:* Amber yellow `#F59E0B` (RGB: `245, 158, 11`)
       * *Network/Total Cars Line:* Violet purple `#8B5CF6` (RGB: `139, 92, 246`)
       * *Temp/Bookings Line:* Alert red `#EF4444` (RGB: `239, 68, 68`)
     * **Secondary Wave (Previous Period):** Dashed line (`stroke-dasharray: 4 4`) of `1.5px` width, colored `rgba(156, 163, 175, 0.25)`. No glow filter or shadow.
   * **Under-Curve Gradient Fill:** Linear vertical gradient mapped to the exact path boundary:
     * Start (curve peak `y = f(x)`): `20%` opacity of the respective theme color (e.g., `rgba(0, 229, 163, 0.20)`).
     * Midpoint (middle height): `8%` opacity (e.g., `rgba(0, 229, 163, 0.08)`).
     * Bottom (baseline `y = baseline`): `0%` opacity (e.g., `rgba(0, 229, 163, 0.00)`).
     * Secondary wave has no under-fill (transparent).

4. **Graph Cards & Decorations Layout**
   * **KPI Metrics Card Sizing & Padding:**
     * Dimensions: `width: 240px` (or flexible min-width `220px`), `height: 160px`.
     * Inner Padding: `18px` on all sides.
   * **KPI Card Interior Structure:**
     * *Header Row:* Muted gray title text (`14px`, `font-weight: 500`, `#9CA3AF`). Far right contains a circular action icon button (diameter `28px`, border `1px solid rgba(255, 255, 255, 0.08)`, centered diagonal arrow `↗` in white `#FFFFFF`).
     * *Value Row:* Positioned below the header with a `8px` top margin. Metric number (e.g., `90,000`) styled with `font-weight: 700` (bold) at size `28px` in white `#FFFFFF`. Adjacent is the trend badge.
     * *Trend Badge:* Pill shape (`3px 6px` padding), background opacity `10%`, text opacity `100%`, containing a small colored bullet dot (diameter `4px`) and the text (e.g., `+6.25%`).
     * *Sub-label Row:* Description text (e.g., "since last month") below the value row in `11px` font, weight `400`, color `#6B7280`.
     * *Mini-Graph Component:* Positioned in the lower `45px` of the card container, spanning `w-full` with overlay gradients.
   * **Main Graph Card Sizing & Header Layout:**
     * Dimensions: `height: 320px`, flexible span width. Inner Padding: `20px`.
     * *Title Section (Left-aligned):* Main title (e.g., "Revenue Trend") in `16px` font, weight `600`, color `#FFFFFF`. Directly below is the legend indicators:
       * Current Period Legend: Emerald green horizontal pill indicator (width `10px`, height `4px`, radius `2px`) followed by label text "Current" (`12px`, muted gray `#9CA3AF`).
       * Previous Period Legend: Slate gray circular indicator (diameter `4px`, color `#4B5563`) followed by label text "Previous" (`12px`, muted gray `#9CA3AF`).
     * *Filter Selector Section (Right-aligned):* Pill button (`height: 32px`, padding `0 12px`, background `rgba(255, 255, 255, 0.03)`, border `1px solid rgba(255, 255, 255, 0.08)`, text "Month" in `12px` white `#FFFFFF`, followed by a small chevron-down icon).
   * **Graph Axis & Grid Details:**
     * *Horizontal Gridlines:* Spaced at height intervals of `0%`, `25%`, `50%`, `75%`, `100%`. Rendered as thin dotted lines (`rgba(255, 255, 255, 0.03)`, pattern `[3, 3]`). No vertical gridlines.
     * *Y-Axis Labels:* Positioned `8px` to the left of the grid area, size `11px`, color `#6B7280`.
     * *X-Axis Labels:* Positioned `12px` below the `0%` baseline grid, size `11px`, color `#6B7280`.
   * **Interactive Hover Tracker:**
     * Hovering over the graph renders a vertical line at the nearest data coordinate: thin dashed line `rgba(255, 255, 255, 0.12)`, running from top to bottom grid lines.
     * *Intersection Node:* A composite dot consisting of an inner white dot (diameter `5px`), a solid theme-colored border (diameter `9px`), and an ambient background glowing shadow halo (diameter `18px`, color `rgba(var(--theme-color-rgb), 0.18)`).
     * *Hover Badge:* A floating pill-badge centered `32px` above the intersection node. Height: `26px`, horizontal padding `10px`, background color matching the theme (e.g., `#00E5A3`), text color `#000000` (black), font size `11px`, weight `600` displaying the hovered metric.


5. **Color Palette**
   * **Dominant Background:** Charcoal-to-teal dark gradient (`#090C0E` to `#0B1315`).
   * **Active Green/Teal:** `#00E5A3` (used for active states, dashboard triggers, and primary progress meters).
   * **Muted Text / Secondary Labels:** Slate gray `#9CA3AF`.
   * **Typography:** Modern sans-serif (`Inter` or `SF Pro Rounded`). Primary numbers styled with `font-weight: 700` (bold) at size `28px`.

---

## 9. Required Files Blueprint

```text
├── src-tauri/
│   ├── Cargo.toml             # Tauri dependencies (sysinfo, tauri-plugin-notification)
│   ├── capabilities/
│   │   └── default.json       # App permissions configuration (window sizing, notifications)
│   └── src/
│       ├── main.rs            # Core bootstrap & CloseRequested interceptor
│       └── monitor.rs         # Sysinfo integration & metric delta calculations
├── src/
│   ├── main.tsx               # App entry
│   ├── App.tsx                # Main view router & overlay router
│   ├── index.css              # Custom themes, CSS variables, & Tailwind CSS directives
│   ├── components/
│   │   ├── Dashboard.tsx      # Main detailed diagnostics screen
│   │   ├── LeftGraph.tsx      # Multi-metric Canvas/SVG running graph (Left-side)
│   │   ├── StorageCard.tsx    # Drive-space metrics (Ring progress layout)
│   │   ├── FloatingBar.tsx    # Draggable, borderless HUD overlay
│   │   └── SettingsGear.tsx   # Gear icon menu (Theme selector & opacity slider)
│   ├── hooks/
│   │   ├── useMetrics.ts      # Subscribes to backend event stream for CPU/RAM/Temp/Mbps
│   │   └── useNotifications.ts# Tauri Native notification controller
│   └── store/
│       └── useSettingsStore.ts# Zustand store tracking active theme, transparency, & layout modes
├── package.json
└── tauri.conf.json            # Window settings (transparent: true, decorations: false/true toggles)
```

---

## 10. Information & Research Specifications

### A. Tauri v2 Native Notifications
To support system notifications, the application must configure the official Tauri v2 plugin:
1. **Cargo.toml:** Add `tauri-plugin-notification = "2.0"` (or latest stable v2).
2. **capabilities/default.json:** Expose `"notification:default"` and `"notification:allow-notify"` in the capabilities permissions list.
3. **Rust Registration:**
   ```rust
   tauri::Builder::default()
       .plugin(tauri_plugin_notification::init())
   ```
4. **Frontend Interface:** Use the `@tauri-apps/plugin-notification` npm package to request permissions and fire alerts:
   ```typescript
   import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
   ```

### B. System Storage Query Methods
* Query disk parameters in Rust using the `sysinfo::Disks` object.
* Iterate over available disks, extracting:
  * Mount Point (`mount_point()`)
  * Disk Name/Label (`name()`)
  * Total Bytes (`total_space()`)
  * Free/Available Bytes (`available_space()`)
* Implement a background command `get_system_storage()` to return structured data to the React frontend.

### C. System Performance Graph & Mbps Calculation
To display real-time performance on the Left-side Graph:
* **CPU and Memory:** Polled directly from the global system info helper at 1-2s intervals.
* **System Temperature:** Read sensor temperatures using `sysinfo::Components::new_with_refreshed_list()`. Filter components for CPU (e.g., coretemp, package temp) or GPU labels. Provide a static fallback default (e.g., 42°C) if no hardware sensors are accessible to prevent crash loops.
* **Network Speed (Mbps):**
  * Network interfaces provide cumulative bytes received (`rx`) and transmitted (`tx`).
  * To obtain speed in Mbps, calculate the delta:
    $$\text{Mbps} = \frac{((\text{Bytes}_{\text{new}} - \text{Bytes}_{\text{old}}) \times 8)}{1024 \times 1024 \times \text{DeltaTimeSeconds}}$$
  * Return this value on each polling event to plot network usage.

### D. Close-to-Floating-Bar Interception
* **Rust Window Listener:** Listen to `WindowEvent::CloseRequested` in `main.rs`. Prevent default close behavior using `api.prevent_close()` and issue a tauri invoke command to change the window presentation:
  ```rust
  tauri::Builder::default()
      .on_window_event(|window, event| match event {
          tauri::WindowEvent::CloseRequested { api, .. } => {
              api.prevent_close();
              window.emit("toggle-floating-bar", true).unwrap();
          }
          _ => {}
      })
  ```
* **Window Transformation Properties:**
  * Toggle decorations off programmatically on window creation/resize or keep them disabled globally using custom HTML title bars.
  * Adjust size to a slim bar (e.g., 360px width x 60px height).
  * Enable "always on top" using `window.set_always_on_top(true)`.
  * Make the background fully transparent to allow CSS gradients/opacities to control transparency.
  * Apply transparency settings using `window.set_opacity(opacity_value)`.

### E. 5 Futuristic Design Themes (Tailwind CSS v4 CSS variables)
Store the active theme selection in Zustand and apply the appropriate classes or CSS variables onto the top-level `#root` container.

1. **Liquid Glass (Default)**
   * *Aesthetics:* Apple-inspired frosted glass.
   * *Styles:* `backdrop-blur(25px)`, background `rgba(255, 255, 255, 0.12)`, border `rgba(255, 255, 255, 0.2)`. High saturation, clean white fonts, smooth drop-shadow.
2. **Neon Cyberpunk**
   * *Aesthetics:* High contrast, dark neon grid.
   * *Styles:* Background `#05050a` with deep violet/black hues, borders neon pink (`#ff007f`) or cyan (`#00ffff`), glowing text shadow effects (`text-shadow: 0 0 8px rgba(0,255,255,0.8)`).
3. **Solar Flare**
   * *Aesthetics:* Warm, glowing energy.
   * *Styles:* Frosted orange-to-amber background gradients (`rgba(40, 20, 5, 0.6)`), animated ambient blobs, dark gold structural borders (`rgba(245, 158, 11, 0.4)`), gold metrics typography.
4. **Deep Space**
   * *Aesthetics:* Obsidian stealth UI.
   * *Styles:* Background obsidian black (`#0a0b10`), thin slate borders (`rgba(71, 85, 105, 0.2)`), monochromatic gray typography, faint white status ticks.
5. **Quantum Hologram**
   * *Aesthetics:* Sci-fi HUD overlay.
   * *Styles:* Background glowing dark teal (`rgba(6, 40, 40, 0.5)`), pixelated horizontal scanline overlay, cyber grid matrix background, glowing green fonts (`#10b981`), geometric HUD corners.

---

## 11. Steps & Execution Pipeline

### Step 1: Rust Core Setup & Metrics Polling
* Add dependencies (`sysinfo`, `tauri-plugin-notification`) to `src-tauri/Cargo.toml`.
* Implement the monitoring thread in `src-tauri/src/monitor.rs`. Define a loop emitting metric updates (CPU, RAM, Temp, Network Mbps, Storage) over a Tauri event channel (`metrics-update`) every 1.5 seconds.

### Step 2: Window Interception & Floating Bar Hook
* Implement the window event listener in `src-tauri/src/main.rs`. Prevent window destruction on close and trigger the layout switch to Floating Bar mode.
* Expose Tauri commands to dynamically control window properties: `set_window_size(width, height)`, `set_window_always_on_top(bool)`, and `set_window_opacity(f64)`.

### Step 3: Frontend Layouts and Charts (React 19)
* Configure `src/index.css` with the 5 theme classes, utilizing Tailwind v4 custom theme directives and CSS variables.
* Build `LeftGraph.tsx`. Use a lightweight SVG or HTML5 Canvas path loop to render the 60-second sliding graph. CPU (cyan), RAM (purple), Temp (red), and Mbps (green) must draw glowing, overlapping lines.
* Build `StorageCard.tsx` showcasing disk drives as circular progress indicators.
* Build `FloatingBar.tsx`. Ensure the root elements use `data-tauri-drag-region`. Position the miniature metrics horizontally.

### Step 4: Settings Menu & Notifications Hook
* Build `SettingsGear.tsx`. Implement template selector buttons (5 options) and the transparency opacity slider.
* Implement `useNotifications.ts` to trigger a system-level notification if:
  * CPU usage remains $> 90\%$ for 10 consecutive seconds.
  * System temperature exceeds $85^\circ\text{C}$.
  * Available storage drops below $10\%$.

---

## 12. Tasks & Checklist

- [ ] Add `sysinfo` and `tauri-plugin-notification` to backend.
- [ ] Implement Rust-side monitoring loop and commands for metrics/storage.
- [ ] Configure capabilities and plugin registrations in Rust/JSON.
- [ ] Create window event listener in `main.rs` to intercept `CloseRequested` / `Minimize`.
- [ ] Set up theme classes and styling variables in `index.css` (Liquid Glass, Cyberpunk, Solar Flare, Deep Space, Quantum Hologram).
- [ ] Create Zustand settings store for themes, layout state, opacity, and metrics history.
- [ ] Implement Left-Side Graph UI (low overhead canvas/SVG rendering).
- [ ] Build main Dashboard layout and Storage progress circles.
- [ ] Build compact, draggable Floating Bar UI component.
- [ ] Build Settings Gear overlay containing theme presets and opacity/refresh configurations.
- [ ] Integrate native Tauri notification triggers on critical system thresholds.

---

## 13. Success Criteria & QA Metrics
* **Resource Optimization:** Background memory must not exceed **40MB** during continuous operation. Rust metrics polling loop must take `<1%` CPU.
* **Visual Fluidity:** Left-side graph line transitions must render at a smooth 30+ FPS without visual stutters.
* **Transition Reliability:** Hiding the dashboard and revealing the Floating Bar HUD (and vice versa) must transition layout state and window opacity smoothly without UI layout breakages or empty canvas rendering.
* **Draggability & Translucency:** The Floating Bar must be draggable from any point on its background container and correctly respect the opacity level set in the Settings menu (tested from 0.1 to 1.0).

---

## 14. UX Audit & Required Corrections
To avoid reproducing design flaws present in the reference layout, the implementation must resolve the following UX gaps:

1. **Trend Graph Y-Axis Conversion:**
   * *Audit Finding:* The Y-axis in the "Revenue Trend" reference shows percentage levels (0% to 100%). For a revenue monitor, Y-axis levels should represent currency values.
   * *Required Correction:* In the system monitoring context, ensure the graph Y-axis matches the metric unit (e.g., percentage `%` for CPU/RAM, degrees Celsius `°C` for Temperature, and megabits per second `Mbps` for network speed). Do not use percentages for non-percentage metrics.

2. **Metric Trend Badge and Arrow Icon Alignment:**
   * *Audit Finding:* In the reference "Total Bookings" card, the metric indicates a negative trend (`-6.25%` in red) but shows an up-right arrow button.
   * *Required Correction:* Ensure that metric trend arrows reflect the actual direction. Positive/increasing trends must use an up-right diagonal arrow (`↗`), and negative/decreasing trends must use a down-right diagonal arrow (`↘`).

3. **Data Redundancy and Placeholders:**
   * *Audit Finding:* The reference "Top rented cars" card displays "BMW i7 Master" duplicate text across all three list slots.
   * *Required Correction:* Render distinct, unique mock records in all lists and tables (e.g., list unique system processes or files instead of duplicate placeholder strings).

4. **Map Legends & Status Indicators:**
   * *Audit Finding:* The reference map shows green pin markers (letters A, B) and small red/white car icons without a clear legend explaining color differences.
   * *Required Correction:* Provide a small, clear color legend or hover tooltips for any map pin statuses (e.g., active nodes, warning nodes, idle nodes).

5. **Typographical Database Quality:**
   * *Audit Finding:* The customer name "Jhon D." is misspelled in the transaction table.
   * *Required Correction:* Ensure standard, error-free spelling in mock data (e.g., use "John D.").