use std::sync::Mutex;
use tauri::State;

pub struct SandboxState {
    pub logs: Mutex<Vec<String>>,
}

impl SandboxState {
    pub fn new() -> Self {
        Self {
            logs: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn get_sandbox_logs(state: State<'_, SandboxState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

#[tauri::command]
pub fn launch_in_sandbox(
    file_path: String,
    state: State<'_, SandboxState>,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Target file does not exist".to_string());
    }
    
    let parent_dir = path.parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?;
        
    let parent_dir_str = parent_dir.to_string_lossy().into_owned();
    let file_name = path.file_name()
        .ok_or_else(|| "Failed to get file name".to_string())?
        .to_string_lossy()
        .into_owned();
        
    // Generate Windows Sandbox Configuration (.wsb) XML profile
    let wsb_content = format!(
        r#"<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>{}</HostFolder>
      <SandboxFolder>C:\SandboxShare</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>explorer.exe C:\SandboxShare</Command>
  </LogonCommand>
</Configuration>"#,
        parent_dir_str
    );
    
    let temp_wsb_path = std::env::temp_dir().join("deskwell_sandbox.wsb");
    std::fs::write(&temp_wsb_path, wsb_content)
        .map_err(|e| format!("Failed to write WSB configuration: {}", e))?;
        
    let wsb_path_str = temp_wsb_path.to_string_lossy().into_owned();
    
    // Spawn Windows Sandbox using file association
    std::process::Command::new("cmd")
        .args(&["/c", "start", "", &wsb_path_str])
        .spawn()
        .map_err(|e| format!("Failed to launch Windows Sandbox program: {}", e))?;
        
    // Add logs
    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();
    let log_msg = format!("[{}] Isolated scan: launched {} in sandbox", timestamp, file_name);
    
    if let Ok(mut logs) = state.logs.lock() {
        logs.push(log_msg);
        if logs.len() > 50 {
            logs.remove(0);
        }
    }
    
    // Fire system notification
    use tauri_plugin_notification::NotificationExt;
    let _ = app_handle.notification()
        .builder()
        .title("DeskWell Sandbox Shield")
        .body(format!("Opened folder of '{}' inside Windows Sandbox.", file_name))
        .show();
        
    Ok(())
}
