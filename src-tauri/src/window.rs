use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockOptions {
    pub edge: Option<String>,
    pub alignment: Option<String>,
    pub vertical_offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DockPosition {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Pure calculation of right edge docking coordinates
pub fn calculate_right_dock_coords(
    display_x: i32,
    display_y: i32,
    display_width: u32,
    display_height: u32,
    window_width: u32,
    window_height: u32,
    alignment: Option<&str>,
    vertical_offset: Option<i32>,
) -> (i32, i32) {
    let win_w = window_width.min(display_width);
    let win_h = window_height.min(display_height);
    let v_offset = vertical_offset.unwrap_or(0);
    let align = alignment.unwrap_or("center");

    let x = display_x + (display_width as i32 - win_w as i32);
    let y = match align {
        "start" | "top" => display_y + v_offset,
        "end" | "bottom" => display_y + (display_height as i32 - win_h as i32) + v_offset,
        _ => display_y + ((display_height as i32 - win_h as i32) / 2) + v_offset,
    };

    (x, y)
}

#[tauri::command]
pub async fn dock_overlay_window(
    app: AppHandle,
    options: Option<DockOptions>,
) -> Result<Option<DockPosition>, String> {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return Ok(None),
    };

    let monitor = match window.primary_monitor() {
        Ok(Some(m)) => m,
        Ok(None) => match window.current_monitor() {
            Ok(Some(m)) => m,
            _ => return Ok(None),
        },
        Err(e) => return Err(e.to_string()),
    };

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();

    let win_size = window
        .outer_size()
        .unwrap_or(PhysicalSize::new(360, 580));

    let align = options.as_ref().and_then(|o| o.alignment.as_deref());
    let v_offset = options.as_ref().and_then(|o| o.vertical_offset);

    let (x, y) = calculate_right_dock_coords(
        monitor_pos.x,
        monitor_pos.y,
        monitor_size.width,
        monitor_size.height,
        win_size.width,
        win_size.height,
        align,
        v_offset,
    );

    let _ = window.set_position(PhysicalPosition::new(x, y));
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_ignore_cursor_events(false);

    Ok(Some(DockPosition {
        x,
        y,
        width: win_size.width,
        height: win_size.height,
    }))
}

#[tauri::command]
pub async fn set_window_click_through(
    app: AppHandle,
    ignore: bool,
) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_ignore_cursor_events(ignore)
            .map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_right_dock_coords_center_1080p() {
        let (x, y) = calculate_right_dock_coords(
            0, 0, 1920, 1080, 360, 580, Some("center"), None,
        );
        assert_eq!(x, 1560);
        assert_eq!(y, 250);
    }

    #[test]
    fn test_calculate_right_dock_coords_4k_scaled() {
        let (x, y) = calculate_right_dock_coords(
            0, 0, 3840, 2160, 360, 580, Some("center"), None,
        );
        assert_eq!(x, 3480);
        assert_eq!(y, 790);
    }

    #[test]
    fn test_calculate_right_dock_coords_secondary_monitor() {
        let (x, y) = calculate_right_dock_coords(
            1920, 0, 2560, 1440, 360, 580, Some("center"), None,
        );
        assert_eq!(x, 4120);
        assert_eq!(y, 430);
    }

    #[test]
    fn test_calculate_right_dock_coords_top_with_offset() {
        let (x, y) = calculate_right_dock_coords(
            0, 0, 1920, 1080, 360, 580, Some("start"), Some(40),
        );
        assert_eq!(x, 1560);
        assert_eq!(y, 40);
    }
}
