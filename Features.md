# 🚀 DeskWell Systems & Security Bot — Feature Inventory & Guide

This document serves as the core technical index and user manual for the **DeskWell** desktop application. It outlines the purpose of each feature, how to use them, the underlying workflows, and futuristic extensions.

---

## 🛠️ Section 1: Active Feature Inventory & User Guide

### 1. 📋 Clipboard Security Shield
* **Purpose**: 
  Protects sensitive information copied to the OS clipboard. Clipboard hijacking and credential harvesting are common vectors where malware reads clipboard contents in search of passwords, crypto addresses, or API keys. This shield monitors copies, flags threat matches, and clears the clipboard buffer after a custom timeout to limit plaintext exposures in RAM.
* **How to Use**:
  1. Open the application, click on the **Workspace Cleaner** tab, and scroll to **Clipboard Security Shield**.
  2. Toggle **Active Protection** to enable the scanner.
  3. Customize the **Auto-Erase Delay** slider (10s to 120s) to define how long sensitive data can reside in clipboard memory.
  4. Select/deselect scan category chips: **API Keys & Tokens**, **Credit Cards**, and **Passwords**.
  5. **Auto-Clean Flow**: When you copy a matched pattern (e.g. `sk-proj-...`), a system notification warns you that auto-clearing is scheduled, and a live progress badge counts down the remaining seconds.
  6. **Manual Wipe**: Click **Erase Clipboard Now** to instantly purge the clipboard buffer.
  7. **Audit Logs**: View masked logs (e.g., `sk-pr...xyz` cleared) in the sanitization log box.

---

### 2. 🔌 USB Auto-Scan Shield
* **Purpose**:
  Protects the host filesystem against USB-borne malware, worms, and autorun files. USB drives are frequent entry points for air-gapped infections. The USB Shield watches for partition arrivals, scans them recursively, and neutralizes threats before they can spread.
* **How to Use**:
  1. Go to the **Workspace Cleaner** tab and scroll to **USB Auto-Scan Shield**.
  2. Toggle **Monitor Drive Mounts** to listen for drive connections.
  3. Toggle **Autonomous Malware Sweep** to enable automatic background sweeps.
  4. **Auto-Scan Flow**: Plug in a USB flash drive. The background monitor detects it, pushes a notification, and launches a recursive file scan.
  5. **Neutralization**: Flagged files are moved to DeskWell's secure quarantine folder (`~/.gemini/antigravity/quarantine`) and neutralized by appending `.locked` extensions.
  6. **Logs Feed**: Check the USB Activity Log to see insertion timelines and quarantine outcomes.

---

### 🔒 3. Disposable File Sandbox
* **Purpose**:
  Provides a secure, hypervisor-segregated virtual machine environment to execute untrusted scripts, macros, or programs. By sharing folders as **Read-Only** inside Windows Sandbox, guest executables are unable to alter, overwrite, or infect host documents.
* **How to Use**:
  1. Navigate to the bottom of the **Workspace Cleaner** tab to access the **Disposable File Sandbox**.
  2. Click **Browse File** to open the Tauri file browser and select the file you wish to isolate.
  3. Click **Launch Disposable Sandbox**.
  4. **Hypervisor Segregation**: DeskWell compiles a temporary `.wsb` profile and launches Windows Sandbox. The parent directory of the selected file mounts inside the sandbox at `C:\SandboxShare` as read-only.
  5. Close the Sandbox window when finished; all data inside the container is permanently discarded.
  6. View histories of isolated sweeps in the Sandbox Audit log box.

---

### 4. 📊 System Diagnostics & Monitor
* **Purpose**:
  Provides real-time resource indicators (CPU, RAM, Disks) and network activity details.
* **How to Use**:
  * Open the **System Metrics** tab.
  * Real-time network speed (Mbps) is calculated using byte deltas:
    $$\text{Mbps} = \frac{((\text{Bytes}_{\text{new}} - \text{Bytes}_{\text{old}}) \times 8)}{1024 \times 1024 \times \text{DeltaTimeSeconds}}$$
  * Monitor active CPU/RAM charts. If temperature sensors are locked on Windows, a default fallback of `45.0 °C` prevents crashes.
  * Kill resource-heavy applications directly by clicking the "Kill" button in the **Process Manager** list.

---

### 🧹 5. Workspace Cleaner
* **Purpose**:
  Reclaims disk space by purging build caches (`node_modules`, `target`, `build`) and scanning general category file extension groups.
* **How to Use**:
  1. Open the **Workspace Cleaner** tab.
  2. Click **Select Directory** to choose your workspace.
  3. Select **Target Workspace Folder** (stale caches) or **Target Files** (general categories).
  4. Click **Scan Directory**. Check category header chips (`FileCode`, `FileText`, etc.) to filter lists.
  5. Click **Delete Selected**. A pop-over loader with a centisecond timer and strikethrough logs will track the non-blocking purge process. Cumulative saved bytes are updated in the store.

---

### 🎵 6. Spotify-Style Audio Engine
* **Purpose**:
  Plays background audio with simulated Dolby enhancement soundscapes.
* **How to Use**:
  * Use the audio controls in the application footer.
  * Select repeat, shuffle, or mood filters, and import folder directories.

---

## 🔄 Section 2: Core System Workflows

### 1. Close-to-HUD Window Transition Workflow
When a user clicks "Close" on the main window, the event is intercepted in `main.rs` to keep the process running:

```
[Main Window (Close Clicked)]
            │
            ▼
[Intercept WindowEvent::CloseRequested]
            │
            ▼
[Tauri: api.prevent_close()]
            │
            ▼
[window.emit("toggle-floating-bar", true)]
            │
            ▼
[React: Resize Frame to 360x60, set_decorations(false), set_always_on_top(true)]
            │
            ▼
[Compact Floating HUD Mode Active]
```

### 2. Non-Blocking Bulk Deletion Workflow
To prevent UI lockups when deleting 6,000+ files:

```
[React: deleteSelectedFiles()]
            │
            ▼
[Tauri IPC: invoke('delete_cleaner_items')]
            │
            ▼
[Rust: tokio::spawn thread loop] ──► [fs::remove_file / fs::remove_dir_all]
            │                                     │
            │ (after each item)                   ▼ (if success)
            ├────────────────────────── [Emit "deletion-progress" Event]
            │                                     │
            ▼ (yield to OS thread)                ▼
[tokio::task::yield_now().await]       [React: Update Log Strikethrough & progress]
```
