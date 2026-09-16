use tauri::State;

use crate::db::models::{Note, Tag};
use crate::db::repository;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const MAX_TAG_NAME_LEN: usize = 50;

fn normalize_tag_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("tag name must not be empty".into()));
    }
    if trimmed.chars().count() > MAX_TAG_NAME_LEN {
        return Err(AppError::InvalidInput(format!(
            "tag name exceeds {MAX_TAG_NAME_LEN} characters"
        )));
    }
    Ok(trimmed.to_string())
}

fn validate_id(id: &str, field: &str) -> AppResult<()> {
    if id.trim().is_empty() {
        return Err(AppError::InvalidInput(format!("{field} must not be empty")));
    }
    Ok(())
}

#[tauri::command]
pub fn list_tags(state: State<AppState>) -> AppResult<Vec<Tag>> {
    let conn = state.pool.get()?;
    repository::list_tags(&conn)
}

#[tauri::command]
pub fn create_tag(state: State<AppState>, name: String) -> AppResult<Tag> {
    let name = normalize_tag_name(&name)?;
    let conn = state.pool.get()?;
    repository::create_tag(&conn, &name)
}

#[tauri::command]
pub fn delete_tag(state: State<AppState>, id: String) -> AppResult<()> {
    validate_id(&id, "id")?;
    let conn = state.pool.get()?;
    repository::delete_tag(&conn, &id)
}

#[tauri::command]
pub fn add_tag_to_note(state: State<AppState>, note_id: String, tag_id: String) -> AppResult<Note> {
    validate_id(&note_id, "note_id")?;
    validate_id(&tag_id, "tag_id")?;
    let conn = state.pool.get()?;
    repository::add_tag_to_note(&conn, &note_id, &tag_id)
}

#[tauri::command]
pub fn remove_tag_from_note(
    state: State<AppState>,
    note_id: String,
    tag_id: String,
) -> AppResult<Note> {
    validate_id(&note_id, "note_id")?;
    validate_id(&tag_id, "tag_id")?;
    let conn = state.pool.get()?;
    repository::remove_tag_from_note(&conn, &note_id, &tag_id)
}
