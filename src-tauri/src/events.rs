use serde::Serialize;
use tauri::{Emitter, Runtime};

use crate::db::models::Note;

pub const NOTE_UPDATED_EVENT: &str = "note-updated";
pub const NOTE_DELETED_EVENT: &str = "note-deleted";

#[derive(Debug, Clone, Serialize)]
pub struct NoteUpdatedPayload {
    pub note: Note,
    pub source_window: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NoteDeletedPayload {
    pub note_id: String,
}

/// Broadcasts a note create/update to every window so they can stay in sync.
/// `source_window` lets the originating window ignore its own echo; pass ""
/// when the change didn't come from any particular window (tray, shortcut).
pub fn emit_note_updated<R: Runtime, E: Emitter<R>>(emitter: &E, note: &Note, source_window: &str) {
    let _ = emitter.emit(
        NOTE_UPDATED_EVENT,
        NoteUpdatedPayload {
            note: note.clone(),
            source_window: source_window.to_string(),
        },
    );
}

/// Broadcasts that a note is gone for good (e.g. an empty note discarded on close)
/// so any window showing it — like the manager's list — can drop it immediately.
pub fn emit_note_deleted<R: Runtime, E: Emitter<R>>(emitter: &E, note_id: &str) {
    let _ = emitter.emit(
        NOTE_DELETED_EVENT,
        NoteDeletedPayload {
            note_id: note_id.to_string(),
        },
    );
}
