#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod system_hooks;
mod audio_engine;
mod device;
mod monitor;
mod cleaner;
mod clipboard;
mod usb_monitor;
mod sandbox;

use std::sync::{Arc, Mutex};
use audio_engine::AudioEngine;
use monitor::MonitorState;
use tauri::Manager;
use tauri::Emitter; // Required in Tauri v2 for window.emit()
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};

#[tauri::command]
fn set_window_size(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height })).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_always_on_top(window: tauri::Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_decorations(window: tauri::Window, decorations: bool) -> Result<(), String> {
    window.set_decorations(decorations).map_err(|e| e.to_string())
}



fn main() {
    let (stream, stream_handle) = rodio::OutputStream::try_default()
        .expect("Failed to open audio output device");

    let audio_engine = Arc::new(Mutex::new(AudioEngine::new(stream, stream_handle)));
    let monitor_state = MonitorState::new();
    let clipboard_state = clipboard::ClipboardShieldState::new();
    let usb_state = usb_monitor::UsbShieldState::new();
    let sandbox_state = sandbox::SandboxState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(audio_engine)
        .manage(monitor_state)
        .manage(clipboard_state)
        .manage(usb_state)
        .manage(sandbox_state)
        .invoke_handler(tauri::generate_handler![
            // System hooks
            system_hooks::get_idle_time,
            system_hooks::check_system_idle,
            // Audio engine commands
            audio_engine::get_playback_state,
            audio_engine::toggle_playback,
            audio_engine::set_volume,
            audio_engine::seek_track,
            audio_engine::add_track_cmd,
            audio_engine::get_playlist,
            audio_engine::set_repeat_mode,
            audio_engine::set_shuffle,
            audio_engine::play_track_at_index,
            audio_engine::next_track,
            audio_engine::prev_track,
            audio_engine::load_music_files,
            audio_engine::load_music_folder,
            audio_engine::toggle_like_track,
            audio_engine::set_track_moods,
            audio_engine::set_dolby_features,
            audio_engine::get_dsp_config,
            audio_engine::set_dsp_config,
            audio_engine::get_audio_meters,
            device::get_output_device,
            audio_engine::sync_playlist_cmd,
            audio_engine::sync_active_track_cmd,
            // System monitor commands
            monitor::get_system_metrics,
            monitor::get_system_storage,
            monitor::scan_project_folder,
            monitor::delete_project_items,
            monitor::get_running_processes,
            monitor::kill_process,
            monitor::get_system_config,
            monitor::run_antivirus_scan,
            monitor::quarantine_threat_file,
            monitor::delete_threat_file,
            monitor::restore_quarantined_file,
            monitor::get_listening_ports,
            monitor::get_startup_apps,
            monitor::toggle_startup_app,
            monitor::purge_standby_memory,
            monitor::run_sfc_verify,
            monitor::flush_dns_and_troubleshoot,
            monitor::scan_startup_persistence,
            // Workspace Cleaner commands
            cleaner::scan_workspace,
            cleaner::delete_cleaner_items,
            // Clipboard Shield commands
            clipboard::get_clipboard_shield_config,
            clipboard::update_clipboard_shield_config,
            clipboard::get_clipboard_shield_logs,
            clipboard::force_clear_clipboard,
            // USB Shield commands
            usb_monitor::get_usb_shield_config,
            usb_monitor::update_usb_shield_config,
            usb_monitor::get_usb_shield_logs,
            // Sandbox commands
            sandbox::get_sandbox_logs,
            sandbox::launch_in_sandbox,
            // Window control commands
            set_window_size,
            set_window_always_on_top,
            set_window_decorations,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("toggle-floating-bar", true);
            }
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            clipboard::start_clipboard_monitor(app_handle.clone());
            usb_monitor::start_usb_monitor(app_handle);

            let show_item = MenuItem::with_id(app, "show", "Show DeskWell", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide DeskWell", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit DeskWell", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
            
            if let Some(icon) = app.default_window_icon().cloned() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon)
                    .menu(&menu)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(win) = app.get_webview_window("main") {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                            "hide" => {
                                if let Some(win) = app.get_webview_window("main") {
                                    let _ = win.hide();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let is_visible = win.is_visible().unwrap_or(true);
                                if is_visible {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
