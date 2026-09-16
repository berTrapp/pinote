use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::db::repository;
use crate::error::{AppError, AppResult};
use crate::events::{emit_note_deleted, emit_note_updated};
use crate::state::AppState;

const DEFAULT_WIDTH: f64 = 300.0;
const DEFAULT_HEIGHT: f64 = 300.0;
const MIN_WIDTH: f64 = 200.0;
const MIN_HEIGHT: f64 = 200.0;

pub fn window_label(note_id: &str) -> String {
    format!("note-{note_id}")
}

fn position_is_on_some_monitor<R: Runtime>(app: &AppHandle<R>, x: f64, y: f64) -> bool {
    let Some(main) = app.get_webview_window("main") else {
        return true;
    };
    match main.available_monitors() {
        Ok(monitors) => monitors.iter().any(|m| {
            let pos = m.position();
            let size = m.size();
            x >= pos.x as f64
                && x < pos.x as f64 + size.width as f64
                && y >= pos.y as f64
                && y < pos.y as f64 + size.height as f64
        }),
        Err(_) => true,
    }
}

fn persist_position<R: Runtime>(app: &AppHandle<R>, note_id: &str, x: i32, y: i32) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(conn) = state.pool.get() {
            let _ = repository::save_window_position(&conn, note_id, x, y);
        }
    }
}

fn persist_size<R: Runtime>(app: &AppHandle<R>, note_id: &str, width: i32, height: i32) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(conn) = state.pool.get() {
            let _ = repository::save_window_size(&conn, note_id, width, height);
        }
    }
}

/// A note window closing is also the moment a note that was never actually
/// written in gets a chance to just vanish, instead of lingering in the
/// manager as an empty "Sem título" entry.
fn handle_note_window_closed<R: Runtime>(app: &AppHandle<R>, note_id: &str) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let Ok(conn) = state.pool.get() else {
        return;
    };
    match repository::get_note(&conn, note_id) {
        Ok(Some(note)) if note.is_blank() => {
            if repository::delete_note_permanently(&conn, note_id).is_ok() {
                emit_note_deleted(app, note_id);
            }
        }
        _ => {
            let _ = repository::set_window_visible(&conn, note_id, false);
        }
    }
}

/// Opens the given note as its own OS-level floating window, or focuses it if already open.
pub fn open_note_window<R: Runtime>(app: &AppHandle<R>, note_id: &str) -> AppResult<()> {
    let label = window_label(note_id);

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let state = app.state::<AppState>();
    let (note, window_state) = {
        let conn = state.pool.get()?;
        let note = repository::get_note(&conn, note_id)?.ok_or(AppError::NotFound)?;
        let window_state = repository::get_window_state(&conn, note_id)?;
        (note, window_state)
    };

    let width = window_state
        .as_ref()
        .and_then(|w| w.width)
        .map(f64::from)
        .unwrap_or(DEFAULT_WIDTH);
    let height = window_state
        .as_ref()
        .and_then(|w| w.height)
        .map(f64::from)
        .unwrap_or(DEFAULT_HEIGHT);
    let saved_position = window_state.as_ref().and_then(|w| match (w.x, w.y) {
        (Some(x), Some(y)) => Some((x as f64, y as f64)),
        _ => None,
    });

    let title = note.title.clone().unwrap_or_else(|| "Nota".to_string());
    let url = WebviewUrl::App(format!("index.html#/note/{note_id}").into());

    // Floating notes are always pinned above other windows — that's the point of a sticky note.
    let mut builder = WebviewWindowBuilder::new(app, &label, url)
        .title(title)
        .inner_size(width, height)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .always_on_top(true)
        .resizable(true)
        .decorations(true)
        .visible(true);

    if let Some((x, y)) = saved_position {
        if position_is_on_some_monitor(app, x, y) {
            builder = builder.position(x, y);
        }
    }

    let window = builder
        .build()
        .map_err(|e| AppError::InvalidInput(e.to_string()))?;

    {
        let conn = state.pool.get()?;
        repository::set_window_visible(&conn, note_id, true)?;
    }

    let app_handle = app.clone();
    let note_id_owned = note_id.to_string();
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(pos) => persist_position(&app_handle, &note_id_owned, pos.x, pos.y),
        WindowEvent::Resized(size) => {
            persist_size(&app_handle, &note_id_owned, size.width as i32, size.height as i32)
        }
        // Only react on Destroyed, not CloseRequested: the frontend's own
        // onCloseRequested handler may still be awaiting an in-flight autosave
        // flush before it calls destroy(); checking here first could read a
        // stale (blank) DB row and delete a note the user just typed into.
        WindowEvent::Destroyed => handle_note_window_closed(&app_handle, &note_id_owned),
        _ => {}
    });

    Ok(())
}

/// Creates a brand new note and immediately opens it as a floating window —
/// the fast path for a "grab a sticky note" action from the tray or a shortcut.
pub fn create_and_open_note<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let state = app.state::<AppState>();
    let note = {
        let conn = state.pool.get()?;
        repository::create_note(&conn, None, None)?
    };
    emit_note_updated(app, &note, "");
    open_note_window(app, &note.id)
}

/// Reopens every note window that was still visible the last time the app quit.
pub fn reopen_visible_windows<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let ids = {
        let Ok(conn) = state.pool.get() else {
            return;
        };
        repository::list_visible_window_note_ids(&conn).unwrap_or_default()
    };
    for id in ids {
        let _ = open_note_window(app, &id);
    }
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
    use tauri::App;

    use super::*;
    use crate::db;
    use crate::db::repository;

    fn build_test_app() -> App<MockRuntime> {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("pinote-wm-test-{nanos}"));
        let pool = db::init_pool(&dir).expect("init test pool");

        let app = mock_builder()
            .build(mock_context(noop_assets()))
            .expect("build mock app");
        app.manage(AppState { pool });
        app
    }

    fn create_note(app: &App<MockRuntime>) -> String {
        let state = app.state::<AppState>();
        let conn = state.pool.get().unwrap();
        repository::create_note(&conn, Some("Test".into()), Some("Body".into()))
            .unwrap()
            .id
    }

    #[test]
    fn open_note_window_creates_window_and_marks_visible() {
        let app = build_test_app();
        let note_id = create_note(&app);

        open_note_window(app.handle(), &note_id).unwrap();

        assert!(app.get_webview_window(&window_label(&note_id)).is_some());

        let state = app.state::<AppState>();
        let conn = state.pool.get().unwrap();
        let window_state = repository::get_window_state(&conn, &note_id).unwrap().unwrap();
        assert!(window_state.visible);
    }

    #[test]
    fn open_note_window_twice_reuses_existing_window() {
        let app = build_test_app();
        let note_id = create_note(&app);

        open_note_window(app.handle(), &note_id).unwrap();
        open_note_window(app.handle(), &note_id).unwrap();

        let matching = app
            .webview_windows()
            .keys()
            .filter(|label| **label == window_label(&note_id))
            .count();
        assert_eq!(matching, 1);
    }

    #[test]
    fn open_note_window_for_missing_note_fails_without_creating_window() {
        let app = build_test_app();

        let result = open_note_window(app.handle(), "does-not-exist");

        assert!(result.is_err());
        assert!(app.get_webview_window(&window_label("does-not-exist")).is_none());
    }

    #[test]
    fn closing_a_blank_note_window_permanently_deletes_the_note() {
        let app = build_test_app();
        let note_id = {
            let state = app.state::<AppState>();
            let conn = state.pool.get().unwrap();
            repository::create_note(&conn, None, None).unwrap().id
        };
        open_note_window(app.handle(), &note_id).unwrap();

        handle_note_window_closed(app.handle(), &note_id);

        let state = app.state::<AppState>();
        let conn = state.pool.get().unwrap();
        assert!(repository::get_note(&conn, &note_id).unwrap().is_none());
    }

    #[test]
    fn closing_a_note_window_with_content_just_hides_it() {
        let app = build_test_app();
        let note_id = create_note(&app);
        open_note_window(app.handle(), &note_id).unwrap();

        handle_note_window_closed(app.handle(), &note_id);

        let state = app.state::<AppState>();
        let conn = state.pool.get().unwrap();
        assert!(repository::get_note(&conn, &note_id).unwrap().is_some());
        let window_state = repository::get_window_state(&conn, &note_id).unwrap().unwrap();
        assert!(!window_state.visible);
    }

    #[test]
    fn create_and_open_note_creates_a_new_note_and_opens_its_window() {
        let app = build_test_app();

        create_and_open_note(app.handle()).unwrap();

        let state = app.state::<AppState>();
        let conn = state.pool.get().unwrap();
        let notes = repository::list_notes(
            &conn,
            &crate::db::models::NoteQuery {
                status: crate::db::models::StatusFilter::All,
                search: None,
                tag_id: None,
                favorite_only: false,
                sort_by: crate::db::models::SortBy::CreatedAt,
                sort_dir: crate::db::models::SortDir::Desc,
            },
        )
        .unwrap();
        assert_eq!(notes.len(), 1);
        assert!(app.get_webview_window(&window_label(&notes[0].id)).is_some());
    }

    #[test]
    fn reopen_visible_windows_only_opens_notes_marked_visible() {
        let app = build_test_app();
        let visible_id = create_note(&app);
        let hidden_id = create_note(&app);

        {
            let state = app.state::<AppState>();
            let conn = state.pool.get().unwrap();
            repository::set_window_visible(&conn, &visible_id, true).unwrap();
        }

        reopen_visible_windows(app.handle());

        assert!(app.get_webview_window(&window_label(&visible_id)).is_some());
        assert!(app.get_webview_window(&window_label(&hidden_id)).is_none());
    }
}
