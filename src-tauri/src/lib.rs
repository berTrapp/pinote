mod commands;
mod db;
mod error;
mod events;
mod reminders;
mod shortcuts;
mod state;
mod tray;
mod window_manager;

use tauri::Manager;

use commands::{note_commands, tag_commands, window_commands};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let pool = db::init_pool(&data_dir).expect("failed to initialize database");
            app.manage(AppState { pool });
            window_manager::reopen_visible_windows(app.handle());
            if let Err(err) = tray::setup(app.handle()) {
                log::warn!("failed to set up system tray: {err}");
            }
            if let Err(err) = shortcuts::register(app.handle()) {
                log::warn!("failed to register global shortcut: {err}");
            }
            reminders::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            note_commands::create_note,
            note_commands::list_notes,
            note_commands::get_note,
            note_commands::update_note_content,
            note_commands::set_note_color,
            note_commands::set_note_priority,
            note_commands::set_note_appearance,
            note_commands::set_note_always_on_top,
            note_commands::set_note_reminder,
            note_commands::empty_trash,
            note_commands::export_note,
            note_commands::toggle_note_favorite,
            note_commands::archive_note,
            note_commands::unarchive_note,
            note_commands::delete_note,
            note_commands::restore_note,
            note_commands::delete_note_permanently,
            note_commands::duplicate_note,
            tag_commands::list_tags,
            tag_commands::create_tag,
            tag_commands::delete_tag,
            tag_commands::add_tag_to_note,
            tag_commands::remove_tag_from_note,
            window_commands::open_note_window,
            window_commands::create_and_open_note_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // Keep running in the background (reachable via the tray) instead of quitting
            // when the last window closes — the manager window hides rather than closes,
            // and floating notes are meant to persist even with no windows visible.
            // `code` is None for an implicit "last window closed" request and Some(_) when
            // we called AppHandle::exit() ourselves (the tray's "Sair"), which must go through.
            if let tauri::RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}
