use chrono::{DateTime, SecondsFormat, Utc};
use tauri::{AppHandle, Manager, State, Window};
use tauri_plugin_dialog::DialogExt;

use crate::db::models::{Note, NoteQuery};
use crate::db::repository;
use crate::error::{AppError, AppResult};
use crate::events::{emit_note_deleted, emit_note_updated};
use crate::state::AppState;
use crate::window_manager;

const MAX_TITLE_LEN: usize = 200;
const MAX_CONTENT_LEN: usize = 500_000;

/// Fixed palette of colors a note's background can be set to — kept small and
/// hardcoded on purpose (see request: "podem ser umas 5 cores fixas só").
const NOTE_COLORS: [&str; 5] = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8", "#ddd6fe"];

/// 0 = none, 1 = low, 2 = medium, 3 = high.
const MAX_PRIORITY: i64 = 3;
const MIN_OPACITY: f64 = 0.3;
const FONT_SIZE_RANGE: std::ops::RangeInclusive<i64> = 10..=32;

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
pub fn set_note_priority(
    window: Window,
    state: State<AppState>,
    id: String,
    priority: i64,
) -> AppResult<Note> {
    validate_id(&id)?;
    if !(0..=MAX_PRIORITY).contains(&priority) {
        return Err(AppError::InvalidInput("unsupported priority".into()));
    }
    let conn = state.pool.get()?;
    let note = repository::set_priority(&conn, &id, priority)?;
    emit_note_updated(&window, &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn set_note_appearance(
    window: Window,
    state: State<AppState>,
    id: String,
    opacity: f64,
    font_size: Option<i64>,
) -> AppResult<Note> {
    validate_id(&id)?;
    if !(MIN_OPACITY..=1.0).contains(&opacity) {
        return Err(AppError::InvalidInput("opacity out of range".into()));
    }
    if font_size.is_some_and(|size| !FONT_SIZE_RANGE.contains(&size)) {
        return Err(AppError::InvalidInput("font size out of range".into()));
    }
    let conn = state.pool.get()?;
    let note = repository::set_appearance(&conn, &id, opacity, font_size)?;
    emit_note_updated(&window, &note, window.label());
    Ok(note)
}

/// Persists the pin and applies it right away if the note's floating window is open.
#[tauri::command]
pub fn set_note_always_on_top(
    app: AppHandle,
    window: Window,
    state: State<AppState>,
    id: String,
    always_on_top: bool,
) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    let note = repository::set_always_on_top(&conn, &id, always_on_top)?;
    if let Some(note_window) = app.get_webview_window(&window_manager::window_label(&id)) {
        let _ = note_window.set_always_on_top(always_on_top);
    }
    emit_note_updated(&window, &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn set_note_reminder(
    window: Window,
    state: State<AppState>,
    id: String,
    remind_at: Option<String>,
) -> AppResult<Note> {
    validate_id(&id)?;
    // stored as UTC with a fixed format so due reminders can be found by plain string comparison
    let remind_at = remind_at
        .map(|value| {
            DateTime::parse_from_rfc3339(&value)
                .map(|dt| {
                    dt.with_timezone(&Utc)
                        .to_rfc3339_opts(SecondsFormat::Secs, true)
                })
                .map_err(|_| AppError::InvalidInput("invalid reminder date".into()))
        })
        .transpose()?;
    let conn = state.pool.get()?;
    let note = repository::set_reminder(&conn, &id, remind_at.as_deref())?;
    emit_note_updated(&window, &note, window.label());
    Ok(note)
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
pub fn empty_trash(window: Window, state: State<AppState>) -> AppResult<usize> {
    let conn = state.pool.get()?;
    let ids = repository::empty_trash(&conn)?;
    for id in &ids {
        emit_note_deleted(&window, id);
    }
    Ok(ids.len())
}

fn export_file_name(title: Option<&str>) -> String {
    let base: String = title
        .unwrap_or("nota")
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let base = base.trim();
    format!("{}.md", if base.is_empty() { "nota" } else { base })
}

/// Asks where to save and writes the note as a markdown file. Returns false if the
/// user cancelled the dialog.
#[tauri::command]
pub async fn export_note(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<bool> {
    validate_id(&id)?;
    let note = {
        let conn = state.pool.get()?;
        repository::get_note(&conn, &id)?.ok_or(AppError::NotFound)?
    };
    let markdown = match &note.title {
        Some(title) => format!("# {title}\n\n{}", note.content),
        None => note.content.clone(),
    };
    let file_name = export_file_name(note.title.as_deref());

    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app
            .dialog()
            .file()
            .set_file_name(file_name)
            .add_filter("Markdown", &["md"])
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = path
            .into_path()
            .map_err(|e| AppError::InvalidInput(e.to_string()))?;
        std::fs::write(path, markdown).map_err(|e| AppError::InvalidInput(e.to_string()))?;
        Ok(true)
    })
    .await
    .map_err(|e| AppError::InvalidInput(e.to_string()))?
}

#[tauri::command]
pub fn duplicate_note(state: State<AppState>, id: String) -> AppResult<Note> {
    validate_id(&id)?;
    let conn = state.pool.get()?;
    repository::duplicate_note(&conn, &id)
}
