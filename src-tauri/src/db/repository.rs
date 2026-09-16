use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use super::models::{Note, NoteQuery, NoteStatus, NoteWindowState, SortBy, SortDir, StatusFilter, Tag};
use crate::error::{AppError, AppResult};

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn derive_status(archived_at: &Option<String>, deleted_at: &Option<String>) -> NoteStatus {
    if deleted_at.is_some() {
        NoteStatus::Trashed
    } else if archived_at.is_some() {
        NoteStatus::Archived
    } else {
        NoteStatus::Active
    }
}

fn row_to_note(row: &Row) -> rusqlite::Result<Note> {
    let archived_at: Option<String> = row.get("archived_at")?;
    let deleted_at: Option<String> = row.get("deleted_at")?;
    Ok(Note {
        id: row.get("id")?,
        title: row.get("title")?,
        content: row.get("content")?,
        favorite: row.get::<_, i64>("favorite")? != 0,
        priority: row.get("priority")?,
        status: derive_status(&archived_at, &deleted_at),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        archived_at,
        deleted_at,
        background_color: row.get("background_color")?,
        tags: Vec::new(),
    })
}

fn load_tags_for_note(conn: &Connection, note_id: &str) -> AppResult<Vec<Tag>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name FROM tags t
         JOIN note_tags nt ON nt.tag_id = t.id
         WHERE nt.note_id = ?1
         ORDER BY t.name COLLATE NOCASE",
    )?;
    let tags = stmt
        .query_map(params![note_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

const NOTE_SELECT: &str = "n.id, n.title, n.content, n.favorite, n.priority, n.created_at, \
     n.updated_at, n.archived_at, n.deleted_at, a.background_color";
const NOTE_FROM: &str = "FROM notes n LEFT JOIN note_appearance a ON a.note_id = n.id";

pub fn create_note(conn: &Connection, title: Option<String>, content: Option<String>) -> AppResult<Note> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let content = content.unwrap_or_default();
    conn.execute(
        "INSERT INTO notes (id, title, content, favorite, priority, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, 0, ?4, ?4)",
        params![id, title, content, ts],
    )?;
    conn.execute(
        "INSERT INTO note_window_state (note_id) VALUES (?1)",
        params![id],
    )?;
    conn.execute(
        "INSERT INTO note_appearance (note_id) VALUES (?1)",
        params![id],
    )?;
    get_note(conn, &id)?.ok_or(AppError::NotFound)
}

pub fn get_note(conn: &Connection, id: &str) -> AppResult<Option<Note>> {
    let note = conn
        .query_row(
            &format!("SELECT {NOTE_SELECT} {NOTE_FROM} WHERE n.id = ?1"),
            params![id],
            row_to_note,
        )
        .optional()?;
    match note {
        Some(mut n) => {
            n.tags = load_tags_for_note(conn, &n.id)?;
            Ok(Some(n))
        }
        None => Ok(None),
    }
}

pub fn list_notes(conn: &Connection, query: &NoteQuery) -> AppResult<Vec<Note>> {
    let mut sql = format!("SELECT {NOTE_SELECT} {NOTE_FROM} WHERE 1=1");

    match query.status {
        StatusFilter::Active => sql.push_str(" AND n.archived_at IS NULL AND n.deleted_at IS NULL"),
        StatusFilter::Archived => {
            sql.push_str(" AND n.archived_at IS NOT NULL AND n.deleted_at IS NULL")
        }
        StatusFilter::Trashed => sql.push_str(" AND n.deleted_at IS NOT NULL"),
        StatusFilter::All => {}
    }
    if query.favorite_only {
        sql.push_str(" AND n.favorite = 1");
    }

    let like_pattern = query.search.as_ref().filter(|s| !s.trim().is_empty()).map(|s| {
        let escaped = s.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        format!("%{escaped}%")
    });
    if like_pattern.is_some() {
        sql.push_str(" AND (n.title LIKE ?1 ESCAPE '\\' OR n.content LIKE ?1 ESCAPE '\\')");
    }

    if query.tag_id.is_some() {
        let placeholder = if like_pattern.is_some() { "?2" } else { "?1" };
        sql.push_str(&format!(
            " AND n.id IN (SELECT note_id FROM note_tags WHERE tag_id = {placeholder})"
        ));
    }

    let order_col = match query.sort_by {
        SortBy::CreatedAt => "created_at",
        SortBy::UpdatedAt => "updated_at",
        SortBy::Priority => "priority",
    };
    let order_dir = match query.sort_dir {
        SortDir::Asc => "ASC",
        SortDir::Desc => "DESC",
    };
    sql.push_str(&format!(" ORDER BY {order_col} {order_dir}, created_at DESC"));

    let mut stmt = conn.prepare(&sql)?;

    let mut bound_params: Vec<&dyn rusqlite::ToSql> = Vec::new();
    if let Some(p) = &like_pattern {
        bound_params.push(p);
    }
    if let Some(tag_id) = &query.tag_id {
        bound_params.push(tag_id);
    }

    let mut notes = stmt
        .query_map(bound_params.as_slice(), row_to_note)?
        .collect::<Result<Vec<_>, _>>()?;

    for note in &mut notes {
        note.tags = load_tags_for_note(conn, &note.id)?;
    }

    Ok(notes)
}

pub fn update_content(
    conn: &Connection,
    id: &str,
    title: Option<String>,
    content: String,
) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        params![title, content, ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn set_priority(conn: &Connection, id: &str, priority: i64) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET priority = ?1, updated_at = ?2 WHERE id = ?3",
        params![priority, ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn toggle_favorite(conn: &Connection, id: &str) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = ?1 WHERE id = ?2",
        params![ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn archive_note(conn: &Connection, id: &str) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET archived_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn unarchive_note(conn: &Connection, id: &str) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET archived_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn soft_delete_note(conn: &Connection, id: &str) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn restore_note(conn: &Connection, id: &str) -> AppResult<Note> {
    let ts = now();
    let affected = conn.execute(
        "UPDATE notes SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![ts, id],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

pub fn delete_note_permanently(conn: &Connection, id: &str) -> AppResult<()> {
    let affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn duplicate_note(conn: &Connection, id: &str) -> AppResult<Note> {
    let original = get_note(conn, id)?.ok_or(AppError::NotFound)?;
    let new_id = Uuid::new_v4().to_string();
    let ts = now();
    let new_title = original.title.map(|t| format!("{t} (cópia)"));
    conn.execute(
        "INSERT INTO notes (id, title, content, favorite, priority, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5)",
        params![new_id, new_title, original.content, original.priority, ts],
    )?;
    conn.execute(
        "INSERT INTO note_window_state (note_id) VALUES (?1)",
        params![new_id],
    )?;
    conn.execute(
        "INSERT INTO note_appearance (note_id, background_color) VALUES (?1, ?2)",
        params![new_id, original.background_color],
    )?;
    for tag in &original.tags {
        conn.execute(
            "INSERT INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![new_id, tag.id],
        )?;
    }
    get_note(conn, &new_id)?.ok_or(AppError::NotFound)
}

pub fn set_background_color(conn: &Connection, id: &str, color: Option<&str>) -> AppResult<Note> {
    let ts = now();
    conn.execute(
        "UPDATE note_appearance SET background_color = ?1 WHERE note_id = ?2",
        params![color, id],
    )?;
    conn.execute("UPDATE notes SET updated_at = ?1 WHERE id = ?2", params![ts, id])?;
    get_note(conn, id)?.ok_or(AppError::NotFound)
}

fn row_to_window_state(row: &Row) -> rusqlite::Result<NoteWindowState> {
    Ok(NoteWindowState {
        note_id: row.get("note_id")?,
        x: row.get("x")?,
        y: row.get("y")?,
        width: row.get("width")?,
        height: row.get("height")?,
        always_on_top: row.get::<_, i64>("always_on_top")? != 0,
        visible: row.get::<_, i64>("visible")? != 0,
    })
}

pub fn get_window_state(conn: &Connection, note_id: &str) -> AppResult<Option<NoteWindowState>> {
    let state = conn
        .query_row(
            "SELECT note_id, x, y, width, height, always_on_top, visible
             FROM note_window_state WHERE note_id = ?1",
            params![note_id],
            row_to_window_state,
        )
        .optional()?;
    Ok(state)
}

pub fn save_window_position(conn: &Connection, note_id: &str, x: i32, y: i32) -> AppResult<()> {
    conn.execute(
        "UPDATE note_window_state SET x = ?1, y = ?2 WHERE note_id = ?3",
        params![x, y, note_id],
    )?;
    Ok(())
}

pub fn save_window_size(conn: &Connection, note_id: &str, width: i32, height: i32) -> AppResult<()> {
    conn.execute(
        "UPDATE note_window_state SET width = ?1, height = ?2 WHERE note_id = ?3",
        params![width, height, note_id],
    )?;
    Ok(())
}

pub fn set_window_visible(conn: &Connection, note_id: &str, visible: bool) -> AppResult<()> {
    conn.execute(
        "UPDATE note_window_state SET visible = ?1 WHERE note_id = ?2",
        params![visible as i64, note_id],
    )?;
    Ok(())
}

pub fn list_visible_window_note_ids(conn: &Connection) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT nws.note_id FROM note_window_state nws
         JOIN notes n ON n.id = nws.note_id
         WHERE nws.visible = 1 AND n.deleted_at IS NULL",
    )?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ids)
}

pub fn list_tags(conn: &Connection) -> AppResult<Vec<Tag>> {
    let mut stmt = conn.prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE")?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

pub fn create_tag(conn: &Connection, name: &str) -> AppResult<Tag> {
    let existing = conn
        .query_row(
            "SELECT id, name FROM tags WHERE name = ?1 COLLATE NOCASE",
            params![name],
            |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            },
        )
        .optional()?;
    if let Some(tag) = existing {
        return Ok(tag);
    }
    let id = Uuid::new_v4().to_string();
    conn.execute("INSERT INTO tags (id, name) VALUES (?1, ?2)", params![id, name])?;
    Ok(Tag {
        id,
        name: name.to_string(),
    })
}

pub fn delete_tag(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn add_tag_to_note(conn: &Connection, note_id: &str, tag_id: &str) -> AppResult<Note> {
    conn.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
        params![note_id, tag_id],
    )?;
    get_note(conn, note_id)?.ok_or(AppError::NotFound)
}

pub fn remove_tag_from_note(conn: &Connection, note_id: &str, tag_id: &str) -> AppResult<Note> {
    conn.execute(
        "DELETE FROM note_tags WHERE note_id = ?1 AND tag_id = ?2",
        params![note_id, tag_id],
    )?;
    get_note(conn, note_id)?.ok_or(AppError::NotFound)
}
