use std::time::Duration;

use chrono::{SecondsFormat, Utc};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

use crate::db::repository;
use crate::events::emit_note_updated;
use crate::state::AppState;
use crate::window_manager;

const CHECK_INTERVAL: Duration = Duration::from_secs(15);

/// Polls for due reminders in the background. Each one shows a system notification
/// and pops the note open as a floating window.
pub fn start<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        fire_due_reminders(&app);
        std::thread::sleep(CHECK_INTERVAL);
    });
}

fn fire_due_reminders<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let due = {
        let Ok(conn) = state.pool.get() else {
            return;
        };
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
        match repository::take_due_reminders(&conn, &now) {
            Ok(notes) => notes,
            Err(err) => {
                log::warn!("failed to check reminders: {err}");
                return;
            }
        }
    };

    for note in due {
        let title = note.title.clone().unwrap_or_else(|| "Lembrete".to_string());
        let body = note
            .content
            .lines()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("")
            .chars()
            .take(120)
            .collect::<String>();
        if let Err(err) = app.notification().builder().title(title).body(body).show() {
            log::warn!("failed to show reminder notification: {err}");
        }
        emit_note_updated(app, &note, "");
        if let Err(err) = window_manager::open_note_window(app, &note.id) {
            log::warn!("failed to open reminder note window: {err}");
        }
    }
}
