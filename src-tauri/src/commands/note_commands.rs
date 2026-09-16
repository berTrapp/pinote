use tauri::{State, Window};

use crate::db::models::{Note, NoteQuery};
use crate::db::repository;
use crate::error::{AppError, AppResult};
use crate::events::{emit_note_deleted, emit_note_updated};
use crate::state::AppState;

const MAX_TITLE_LEN: usize = 200;
const MAX_CONTENT_LEN: usize = 500_000;

/// Fixed palette of colors a note's background can be set to — kept small and
/// hardcoded on purpose (see request: "podem ser umas 5 cores fixas só").
const NOTE_COLORS: [&str; 5] = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8", "#ddd6fe"];

fn normalize_title(title: Option<String>) -> AppResult<Option<String>> {
    match title {
        None => Ok(None),
        Some(t) => {
            let trimmed = t.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else if trimmed.chars().count() > MAX_TITLE_LEN {
                Err(AppError::InvalidInput(format!(
                    "title exceeds {MAX_TITLE_LEN} characters"
                )))
            } else {
                Ok(Some(trimmed.to_string()))
            }
        }
    }
}

fn validate_content(content: &str) -> AppResult<()> {
    if content.chars().count() > MAX_CONTENT_LEN {
        return Err(AppError::InvalidInput(format!(
            "content exceeds {MAX_CONTENT_LEN} characters"
        )));
    }
    Ok(())
}

fn validate_id(id: &str) -> AppResult<()> {
    if id.trim().is_empty() {
        return Err(AppError::InvalidInput("id must not be empty".into()));
    }
    Ok(())
}

fn validate_color(color: &Option<String>) -> AppResult<()> {
    match color {
        None => Ok(()),
        Some(c) if NOTE_COLORS.contains(&c.as_str()) => Ok(()),
        Some(_) => Err(AppError::InvalidInput("unsupported note color".into())),
    }
}

#[tauri::command]
pub fn create_note(
    state: State<AppState>,
    title: Option<String>,
    content: Option<String>,
) -> AppResult<Note> {
    let title = normalize_title(title)?;
    if let Some(c) = &content {
        validate_content(c)?;
    }
    let conn = state.pool.get()?;
    repository::create_note(&conn, title, content)
}

#[tauri::command]
pub fn list_notes(state: State<AppState>, query: NoteQuery) -> AppResult<Vec<Note>> {
    let conn = state.pool.get()?;
    repository::list_notes(&conn, &query)
}

#[tauri::command]
pub fn get_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::get_note(&conn, &id)?.ok_or(AppError::NotFound)
}

#[tauri::command]
pub fn update_note_content(
    window: Window,
    state: State<AppState>,
    id: String,
    title: Option<String>,
    content: String,
) -> AppResult<Note> {
    validate_id(&id)?;
    let title = normalize_title(title)?;
    validate_content(&content)?;
    let conn = state.pool.get()?;
    let note = repository::update_content(&conn, &id, title, content)?;
    emit_note_updated(&window, &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn set_note_color(
    window: Window,
    state: State<AppState>,
    id: String,
    color: Option<String>,
) -> AppResult<Note> {
    validate_id(&id)?;
    validate_color(&color)?;
    let conn = state.pool.get()?;
    let note = repository::set_background_color(&conn, &id, color.as_deref())?;
    emit_note_updated(&window, &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn set_note_priority(state: State<AppState>, id: String, priority: i64) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::set_priority(&conn, &id, priority)
}

#[tauri::command]
pub fn toggle_note_favorite(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::toggle_favorite(&conn, &id)
}

#[tauri::command]
pub fn archive_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::archive_note(&conn, &id)
}

#[tauri::command]
pub fn unarchive_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::unarchive_note(&conn, &id)
}

/// Deleting a note that was never actually written in (still has no title and no
/// content) discards it outright instead of sending it to the trash — an empty
/// note created and immediately deleted shouldn't need to be "kept" anywhere.
#[tauri::command]
pub fn delete_note(window: Window, state: State<AppState>, id: String) -> AppResult<()> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    let note = repository::get_note(&conn, &id)?.ok_or(AppError::NotFound)?;
    if note.is_blank() {
        repository::delete_note_permanently(&conn, &id)?;
        emit_note_deleted(&window, &id);
    } else {
        repository::soft_delete_note(&conn, &id)?;
    }
    Ok(())
}

#[tauri::command]
pub fn restore_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::restore_note(&conn, &id)
}

#[tauri::command]
pub fn delete_note_permanently(state: State<AppState>, id: String) -> AppResult<()> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::delete_note_permanently(&conn, &id)
}

#[tauri::command]
pub fn duplicate_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::duplicate_note(&conn, &id)
}

