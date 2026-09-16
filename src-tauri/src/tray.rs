use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Error, Manager,
};

use crate::window_manager;

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| Error::AssetNotFound("default window icon".into()))?;

    let new_note = MenuItem::with_id(app, "new_note", "Nova nota", true, None::<&str>)?;
    let open_manager = MenuItem::with_id(app, "open_manager", "Abrir gerenciador", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&new_note, &open_manager, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Pinote")
        .icon(icon)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "new_note" => {
                let _ = window_manager::create_and_open_note(app);
            }
            "open_manager" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
