use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_CACHE_FOLDER: &str = "usage-monitor";
const DEFAULT_CACHE_FILENAME: &str = "cache.json";

/// Resolves the default cache path, preferring `%LOCALAPPDATA%\usage-monitor\cache.json`.
pub fn get_default_cache_path() -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        if !local_app_data.trim().is_empty() {
            return PathBuf::from(local_app_data)
                .join(DEFAULT_CACHE_FOLDER)
                .join(DEFAULT_CACHE_FILENAME);
        }
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        if !app_data.trim().is_empty() {
            return PathBuf::from(app_data)
                .join(DEFAULT_CACHE_FOLDER)
                .join(DEFAULT_CACHE_FILENAME);
        }
    }

    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        if !user_profile.trim().is_empty() {
            return PathBuf::from(user_profile)
                .join("AppData")
                .join("Local")
                .join(DEFAULT_CACHE_FOLDER)
                .join(DEFAULT_CACHE_FILENAME);
        }
    }

    std::env::temp_dir()
        .join(DEFAULT_CACHE_FOLDER)
        .join(DEFAULT_CACHE_FILENAME)
}

/// Saves raw string cache payload to a designated file path, creating parent folders if missing.
pub fn save_cache_to_path(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory {:?}: {}", parent, e))?;
        }
    }

    fs::write(path, content)
        .map_err(|e| format!("Failed to write cache file {:?}: {}", path, e))?;

    Ok(())
}

/// Reads cached snapshot payload from a designated file path.
pub fn load_cache_from_path(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read cache file {:?}: {}", path, e))?;

    Ok(Some(content))
}

#[tauri::command]
pub fn save_cache(payload: String) -> Result<(), String> {
    let path = get_default_cache_path();
    save_cache_to_path(&path, &payload)
}

#[tauri::command]
pub fn load_cache() -> Result<Option<String>, String> {
    let path = get_default_cache_path();
    load_cache_from_path(&path)
}

#[tauri::command]
pub fn get_cache_path() -> Result<String, String> {
    let path = get_default_cache_path();
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_default_cache_path() {
        let path = get_default_cache_path();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains(DEFAULT_CACHE_FOLDER));
        assert!(path_str.ends_with(DEFAULT_CACHE_FILENAME));
    }

    #[test]
    fn test_save_and_load_cache_to_path() {
        let temp_dir = std::env::temp_dir().join(format!("usage_monitor_test_{}", std::process::id()));
        let cache_file = temp_dir.join("nested").join("cache.json");

        // Clean up beforehand if exists
        let _ = fs::remove_dir_all(&temp_dir);

        // Verify load returns None when missing
        let initial = load_cache_from_path(&cache_file).expect("Load should succeed on missing file");
        assert_eq!(initial, None);

        // Save content
        let sample_json = r#"{"version":1,"savedAt":1725000000000,"snapshots":{}}"#;
        save_cache_to_path(&cache_file, sample_json).expect("Save should succeed and create directories");

        // Verify loaded content matches
        let loaded = load_cache_from_path(&cache_file).expect("Load should succeed").expect("File should exist");
        assert_eq!(loaded, sample_json);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
