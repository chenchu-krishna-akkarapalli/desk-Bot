use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::fs;
use tokio::fs as tokio_fs;
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceCleanItem {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub item_type: String, // "file" | "directory"
    pub category: String,  // "build_artifact" | "markdown" | "data" | "documents" | "visual" | "media" | "binaries" | "other"
    pub risk_level: String, // "low" | "medium" | "high"
    pub is_readable: bool,
    pub is_writable: bool,
    pub is_system_file: bool,
}

// Check if file is readable/writable
fn check_permissions(path: &Path) -> (bool, bool) {
    let readable = fs::metadata(path).is_ok();
    let writable = if let Ok(meta) = fs::metadata(path) {
        !meta.permissions().readonly()
    } else {
        false
    };
    (readable, writable)
}

// Get the category type based on extension
fn get_file_category(ext: &str) -> String {
    match ext {
        "md" | "markdown" => "markdown".to_string(),
        
        "xlsx" | "xls" | "json" | "csv" | "excel" | "yaml" | "yml" | "toml" | "xml" => "data".to_string(),
        
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "odt" => "documents".to_string(),
        
        "png" | "jpg" | "jpeg" | "webp" | "svg" | "gif" | "bmp" | "ico" => "visual".to_string(),
        
        "mp4" | "mp3" | "mkv" | "avi" | "wav" | "flac" | "ogg" | "webm" | "mov" => "media".to_string(),
        
        "exe" | "bat" | "cmd" | "msi" | "sh" | "bin" | "dll" | "sys" => "binaries".to_string(),
        
        _ => "other".to_string(),
    }
}

// Evaluate file risk rating
fn evaluate_risk(path: &Path, category: &str, is_readable: bool, is_system: bool) -> String {
    if is_system || !is_readable || category == "binaries" {
        return "high".to_string();
    }

    // Hidden config files or sensitive dotfiles
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name == ".env" || name.starts_with('.') && name != ".gitignore" && name != ".git" {
            return "high".to_string();
        }
    }

    match category {
        "data" => "medium".to_string(),
        "visual" | "media" => "medium".to_string(),
        _ => "low".to_string(),
    }
}

// Check if a path is considered a critical system path
fn is_system_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    path_str.contains("c:\\windows") ||
    path_str.contains("c:\\program files") ||
    path_str.contains("c:\\program files (x86)") ||
    path_str.contains("system32") ||
    path_str.contains("c:\\users\\default")
}

// Helper: calculate directory size recursively
fn get_dir_size<P: AsRef<Path>>(path: P) -> u64 {
    let mut total_size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    total_size += get_dir_size(entry.path());
                } else {
                    total_size += metadata.len();
                }
            }
        }
    }
    total_size
}

// Mode 1: Scan for stale build folders (node_modules, target, build) and config files (.env)
fn traverse_workspace_mode(
    current_path: PathBuf,
    max_depth: usize,
    current_depth: usize,
    results: &mut Vec<WorkspaceCleanItem>
) {
    if current_depth > max_depth || is_system_path(&current_path) {
        return;
    }

    if let Ok(entries) = fs::read_dir(&current_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();

            if path.is_dir() {
                if name == "node_modules" || name == "target" || name == "build" {
                    let size_bytes = get_dir_size(&path);
                    let (is_readable, is_writable) = check_permissions(&path);
                    let is_system = is_system_path(&path);
                    let risk_level = if name == "build" { "medium".to_string() } else { "low".to_string() };

                    results.push(WorkspaceCleanItem {
                        path: path.to_string_lossy().into_owned(),
                        name,
                        size_bytes,
                        item_type: "directory".to_string(),
                        category: "build_artifact".to_string(),
                        risk_level,
                        is_readable,
                        is_writable,
                        is_system_file: is_system,
                    });
                } else if name != ".git" {
                    traverse_workspace_mode(path, max_depth, current_depth + 1, results);
                }
            } else if path.is_file() && name == ".env" {
                let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                let (is_readable, is_writable) = check_permissions(&path);
                let is_system = is_system_path(&path);

                results.push(WorkspaceCleanItem {
                    path: path.to_string_lossy().into_owned(),
                    name,
                    size_bytes,
                    item_type: "file".to_string(),
                    category: "build_artifact".to_string(),
                    risk_level: "high".to_string(),
                    is_readable,
                    is_writable,
                    is_system_file: is_system,
                });
            }
        }
    }
}

// Mode 2: Scan recursively for files based on extension filters
fn traverse_files_mode(
    current_path: PathBuf,
    categories: &[String],
    max_depth: usize,
    current_depth: usize,
    results: &mut Vec<WorkspaceCleanItem>
) {
    if current_depth > max_depth || is_system_path(&current_path) {
        return;
    }

    if let Some(dir_name) = current_path.file_name().and_then(|n| n.to_str()) {
        if dir_name == ".git" || dir_name == "node_modules" || dir_name == "target" || dir_name == "build" {
            return;
        }
    }

    if let Ok(entries) = fs::read_dir(&current_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            
            if path.is_dir() {
                traverse_files_mode(path, categories, max_depth, current_depth + 1, results);
            } else if path.is_file() {
                let ext = path.extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                
                let category = get_file_category(&ext);
                
                if categories.is_empty() || categories.contains(&category) {
                    let name = path.file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default();
                    
                    let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    let (is_readable, is_writable) = check_permissions(&path);
                    let is_system = is_system_path(&path);
                    let risk_level = evaluate_risk(&path, &category, is_readable, is_system);

                    results.push(WorkspaceCleanItem {
                        path: path.to_string_lossy().into_owned(),
                        name,
                        size_bytes,
                        item_type: "file".to_string(),
                        category,
                        risk_level,
                        is_readable,
                        is_writable,
                        is_system_file: is_system,
                    });
                }
            }
        }
    }
}

#[tauri::command]
pub fn scan_workspace(
    paths: Vec<String>,
    mode: String,
    categories: Vec<String>
) -> Result<Vec<WorkspaceCleanItem>, String> {
    let mut results = Vec::new();

    for path_str in paths {
        let root_path = PathBuf::from(&path_str);
        if !root_path.exists() {
            return Err(format!("Directory does not exist: {}", path_str));
        }
        if !root_path.is_dir() {
            return Err(format!("Path is not a directory: {}", path_str));
        }

        // Prevent scanning root drives directly for safety
        if root_path.parent().is_none() || root_path.as_os_str().len() <= 3 {
            return Err(format!("Scanning root drive directly ({}) is blocked for safety.", path_str));
        }

        if mode == "workspace" {
            traverse_workspace_mode(root_path, 5, 0, &mut results);
        } else {
            traverse_files_mode(root_path, &categories, 6, 0, &mut results);
        }
    }

    Ok(results)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteItem {
    pub path: String,
    pub item_type: String, // "file" | "directory"
}

#[derive(Serialize, Clone, Debug)]
pub struct DeletionProgressPayload {
    pub path: String,
    pub index: usize,
    pub total: usize,
    pub success: bool,
}

#[tauri::command]
pub async fn delete_cleaner_items(
    window: tauri::Window,
    items: Vec<DeleteItem>
) -> Result<(), String> {
    let total = items.len();
    
    tokio::spawn(async move {
        for (i, item) in items.into_iter().enumerate() {
            let path = Path::new(&item.path);
            let mut success = false;
            
            if path.exists() && !is_system_path(path) && path.as_os_str().len() > 3 {
                if item.item_type == "directory" {
                    if path.is_dir() {
                        // Dir removals can block, run in blocking thread pool
                        let path_buf = path.to_path_buf();
                        let dir_res = tokio::task::spawn_blocking(move || {
                            fs::remove_dir_all(path_buf)
                        }).await;
                        
                        if let Ok(Ok(_)) = dir_res {
                            success = true;
                        }
                    }
                } else {
                    if path.is_file() {
                        if let Ok(_) = tokio_fs::remove_file(path).await {
                            success = true;
                        }
                    }
                }
            }
            
            let _ = window.emit("deletion-progress", DeletionProgressPayload {
                path: item.path,
                index: i + 1,
                total,
                success,
            });

            // Let Tokio run other async microtasks (like network and tauri window messages)
            tokio::task::yield_now().await;
        }
    });

    Ok(())
}
