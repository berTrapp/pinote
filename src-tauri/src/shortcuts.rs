use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::window_manager;

/// Ctrl+Alt+N anywhere on the desktop creates a new note and pops it open as a
/// floating window, without needing the manager open at all.
pub fn register(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
    app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = window_manager::create_and_open_note(app);
        }
    })?;
    Ok(())
}
