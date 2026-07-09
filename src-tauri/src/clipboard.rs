use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::time::Duration;
use chrono::Local;
use tauri::{State, Manager, Emitter};
use tauri_plugin_notification::NotificationExt;
use regex::Regex;

#[derive(Serialize, Clone, Debug)]
pub struct ClipboardShieldLog {
    pub timestamp: String,
    pub matched_pattern: String,
    pub masked_value: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardConfig {
    pub enabled: bool,
    pub clear_delay_secs: u64,
    pub monitor_api_keys: bool,
    pub monitor_credit_cards: bool,
    pub monitor_passwords: bool,
}

pub struct ClipboardShieldState {
    pub config: Mutex<ClipboardConfig>,
    pub logs: Mutex<Vec<ClipboardShieldLog>>,
    pub active_cancel_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl ClipboardShieldState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(ClipboardConfig {
                enabled: true,
                clear_delay_secs: 30,
                monitor_api_keys: true,
                monitor_credit_cards: true,
                monitor_passwords: true,
            }),
            logs: Mutex::new(Vec::new()),
            active_cancel_tx: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn get_clipboard_shield_config(state: State<'_, ClipboardShieldState>) -> Result<ClipboardConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn update_clipboard_shield_config(
    state: State<'_, ClipboardShieldState>,
    config: ClipboardConfig
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

#[tauri::command]
pub fn get_clipboard_shield_logs(state: State<'_, ClipboardShieldState>) -> Result<Vec<ClipboardShieldLog>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

#[tauri::command]
pub fn force_clear_clipboard(
    app: tauri::AppHandle,
    state: State<'_, ClipboardShieldState>
) -> Result<(), String> {
    // Cancel any active timers
    let mut cancel_tx = state.active_cancel_tx.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = cancel_tx.take() {
        let _ = tx.send(());
    }

    if let Ok(mut clipboard) = arboard::Clipboard::new() {
        let _ = clipboard.set_text("".to_string());
    }

    let _ = app.emit("clipboard-cleared", ());
    Ok(())
}

// Check if string matches password patterns (8-30 chars, mix of numbers, symbols, cases)
fn is_likely_password(text: &str) -> bool {
    let len = text.len();
    if len < 8 || len > 40 {
        return false;
    }
    
    // Quick heuristic checks
    let has_digit = text.chars().any(|c| c.is_ascii_digit());
    let has_uppercase = text.chars().any(|c| c.is_ascii_uppercase());
    let has_lowercase = text.chars().any(|c| c.is_ascii_lowercase());
    let has_symbol = text.chars().any(|c| !c.is_alphanumeric());
    
    // If it has at least 3 of these characteristics, it is likely a sensitive secret password
    let mut score = 0;
    if has_digit { score += 1; }
    if has_uppercase { score += 1; }
    if has_lowercase { score += 1; }
    if has_symbol { score += 1; }
    
    score >= 3
}

pub fn start_clipboard_monitor(app_handle: tauri::AppHandle) {
    tokio::spawn(async move {
        let api_key_regex = Regex::new(r"(?i)(?:key|secret|token|password|passwd|sk-proj-|ghp_|pwd_)[a-zA-Z0-9_\-\.]{12,}").unwrap();
        let credit_card_regex = Regex::new(r"\b(?:\d[ -]*?){13,16}\b").unwrap();
        
        let mut last_clipboard_text = String::new();
        
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            
            let state = match app_handle.try_state::<ClipboardShieldState>() {
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

            let text = match arboard::Clipboard::new() {
                Ok(mut clipboard) => match clipboard.get_text() {
                    Ok(t) => t,
                    Err(_) => continue,
                },
                Err(_) => continue,
            };

            let trimmed_text = text.trim();
            if trimmed_text.is_empty() {
                continue;
            }

            if trimmed_text == last_clipboard_text {
                continue;
            }

            last_clipboard_text = trimmed_text.to_string();

            // Run scan matches
            let mut matched_pattern = None;
            let mut masked_value = String::new();

            if config.monitor_api_keys && api_key_regex.is_match(trimmed_text) {
                matched_pattern = Some("API Key / Secret Token".to_string());
                let len = trimmed_text.len();
                if len > 8 {
                    masked_value = format!("{}...{}", &trimmed_text[..4], &trimmed_text[len-4..]);
                } else {
                    masked_value = "****".to_string();
                }
            } else if config.monitor_credit_cards && credit_card_regex.is_match(trimmed_text) {
                matched_pattern = Some("Credit Card".to_string());
                let clean_digits: String = trimmed_text.chars().filter(|c| c.is_ascii_digit()).collect();
                if clean_digits.len() >= 4 {
                    masked_value = format!("XXXX-XXXX-XXXX-{}", &clean_digits[clean_digits.len()-4..]);
                } else {
                    masked_value = "XXXX-XXXX-XXXX-XXXX".to_string();
                }
            } else if config.monitor_passwords && is_likely_password(trimmed_text) {
                matched_pattern = Some("Credential / Password".to_string());
                masked_value = "********".to_string();
            }

            if let Some(pattern) = matched_pattern {
                let log = ClipboardShieldLog {
                    timestamp: Local::now().format("%H:%M:%S").to_string(),
                    matched_pattern: pattern.clone(),
                    masked_value,
                };

                // Save log
                if let Ok(mut logs) = state.logs.lock() {
                    logs.push(log.clone());
                    if logs.len() > 100 {
                        logs.remove(0); // keep logs capped
                    }
                }

                // Emit event
                let _ = app_handle.emit("clipboard-sensitive-detected", log);

                // Native notification
                let _ = app_handle.notification()
                    .builder()
                    .title("DeskWell Clipboard Shield")
                    .body(format!("Sensitive {} detected in clipboard. Auto-clearing in {} seconds.", pattern, config.clear_delay_secs))
                    .show();

                // Cancel existing timer
                let mut cancel_tx = match state.active_cancel_tx.lock() {
                    Ok(guard) => guard,
                    Err(_) => continue,
                };
                if let Some(tx) = cancel_tx.take() {
                    let _ = tx.send(());
                }

                // Spawn clear task
                let (tx, rx) = tokio::sync::oneshot::channel::<()>();
                *cancel_tx = Some(tx);

                let delay = config.clear_delay_secs;
                let app_handle_clone = app_handle.clone();
                
                tokio::spawn(async move {
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(delay)) => {
                            // Clear Clipboard
                            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                                let _ = clipboard.set_text("".to_string());
                            }
                            
                            // Send clear event
                            let _ = app_handle_clone.emit("clipboard-cleared", ());

                            // Show finished notification
                            let _ = app_handle_clone.notification()
                                .builder()
                                .title("DeskWell Clipboard Shield")
                                .body("Clipboard automatically cleared for your safety.")
                                .show();
                                
                            // Nullify cancelled tx state
                            if let Some(state_clone) = app_handle_clone.try_state::<ClipboardShieldState>() {
                                if let Ok(mut guard) = state_clone.active_cancel_tx.lock() {
                                    *guard = None;
                                }
                            }
                        }
                        _ = rx => {
                            // Cancelled because new item copied
                        }
                    }
                });
            }
        }
    });
}
