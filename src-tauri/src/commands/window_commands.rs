use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::window_manager;

fn validate_id(id: &str) -> AppResult<()> {
    if id.trim().is_empty() {
        return Err(AppError::InvalidInput("id must not be empty".into()));
    }
    Ok(())
}

#[tauri::command]
pub fn open_note_window(app: AppHandle, note_id: String) -> AppResult<()> {
    validate_id(&note_id)?;
    window_manager::open_note_window(&app, &note_id)
}

#[tauri::command]
pub fn create_and_open_note_window(app: AppHandle) -> AppResult<()> {
    window_manager::create_and_open_note(&app)
}
