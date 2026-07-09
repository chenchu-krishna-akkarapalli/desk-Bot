use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::time::Duration;
use chrono::Local;
use tauri::{State, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use sysinfo::Disks;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsbShieldConfig {
    pub enabled: bool,
    pub auto_scan: bool,
}

pub struct UsbShieldState {
    pub config: Mutex<UsbShieldConfig>,
    pub logs: Mutex<Vec<String>>,
}

impl UsbShieldState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(UsbShieldConfig {
                enabled: true,
                auto_scan: true,
            }),
            logs: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn get_usb_shield_config(state: State<'_, UsbShieldState>) -> Result<UsbShieldConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn update_usb_shield_config(
    state: State<'_, UsbShieldState>,
    config: UsbShieldConfig
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

#[tauri::command]
pub fn get_usb_shield_logs(state: State<'_, UsbShieldState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

pub fn start_usb_monitor(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_drives: Vec<String> = Vec::new();
        let mut is_first_poll = true;
        
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;

            let state = match app_handle.try_state::<UsbShieldState>() {
                Some(s) => s,
                None => continue,
            };

            let config = match state.config.lock() {
                Ok(c) => c.clone(),
                Err(_) => continue,
            };

            if !config.enabled {
                continue;
            }

            // Fetch current active drives
            let disks = Disks::new_with_refreshed_list();
            let current_drives: Vec<String> = disks
                .iter()
                .map(|d| d.mount_point().to_string_lossy().into_owned())
                .collect();

            if is_first_poll {
                last_drives = current_drives;
                is_first_poll = false;
                continue;
            }

            // Check for new mounts
            for drive in &current_drives {
                if !last_drives.contains(drive) {
                    let drive_str = drive.clone();
                    let timestamp = Local::now().format("%H:%M:%S").to_string();
                    let log_msg = format!("[{}] USB mounted: {}", timestamp, drive_str);

                    // Log the mount event
                    if let Ok(mut logs) = state.logs.lock() {
                        logs.push(log_msg.clone());
                        if logs.len() > 50 {
                            logs.remove(0);
                        }
                    }

                    // Emit event to frontend
                    let _ = app_handle.emit("usb-device-inserted", drive_str.clone());

                    // Fire system notification
                    let notification_body = if config.auto_scan {
                        format!("New USB Drive ({}) detected. Triggering threat scan...", drive_str)
                    } else {
                        format!("New USB Drive ({}) detected.", drive_str)
                    };

                    let _ = app_handle.notification()
                        .builder()
                        .title("DeskWell USB Shield")
                        .body(notification_body)
                        .show();

                    if config.auto_scan {
                        let app_handle_clone = app_handle.clone();
                        let drive_str_clone = drive_str.clone();
                        
                        tauri::async_runtime::spawn(async move {
                            // Emit scan starting event
                            let _ = app_handle_clone.emit("usb-scan-started", drive_str_clone.clone());
                            
                            // Run antivirus scan (offloaded to thread pool)
                            let app_handle_for_blocking = app_handle_clone.clone();
                            let scan_res = tokio::task::spawn_blocking(move || {
                                crate::monitor::run_antivirus_scan(app_handle_for_blocking, drive_str_clone)
                            }).await;
                                
                                if let Ok(Ok(report)) = scan_res {
                                    let threat_count = report.threats_found.len();
                                    
                                    // Log completion
                                    if let Some(state_clone) = app_handle_clone.try_state::<UsbShieldState>() {
                                        let timestamp = Local::now().format("%H:%M:%S").to_string();
                                        if let Ok(mut logs) = state_clone.logs.lock() {
                                            if threat_count > 0 {
                                                logs.push(format!("[{}] USB Auto-scan complete: {} threats detected!", timestamp, threat_count));
                                                
                                                // Auto-quarantine threats
                                                for threat in &report.threats_found {
                                                    match crate::monitor::quarantine_threat_file(threat.path.clone(), threat.id.clone(), threat.threat_type.clone()) {
                                                        Ok(_) => {
                                                            logs.push(format!("[{}] AUTO-QUARANTINED threat: {}", timestamp, threat.file_name));
                                                        }
                                                        Err(e) => {
                                                            logs.push(format!("[{}] Quarantine failed for {}: {}", timestamp, threat.file_name, e));
                                                        }
                                                    }
                                                }
                                            } else {
                                                logs.push(format!("[{}] USB Auto-scan complete: 0 threats detected.", timestamp));
                                            }
                                        }
                                    }
                                    
                                    // Emit completion event to frontend
                                    let _ = app_handle_clone.emit("usb-scan-completed", report);
                                    
                                    // Notification
                                    let scan_msg = if threat_count > 0 {
                                        format!("⚠️ USB Scan complete: {} threats found and auto-quarantined!", threat_count)
                                    } else {
                                        "✅ USB Scan complete: No threats found.".to_string()
                                    };
                                    
                                    let _ = app_handle_clone.notification()
                                        .builder()
                                        .title("DeskWell USB Shield")
                                        .body(scan_msg)
                                        .show();
                                }
                        });
                    }
                }
            }

            last_drives = current_drives;
        }
    });
}
