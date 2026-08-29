pub mod antigravity;
pub mod cache;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            cache::save_cache,
            cache::load_cache,
            cache::get_cache_path,
            antigravity::get_antigravity_usage,
            antigravity::discover_antigravity_port,
            antigravity::query_antigravity_rpc,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

