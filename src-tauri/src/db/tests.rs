use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

use super::models::{NoteQuery, NoteStatus, SortBy, SortDir, StatusFilter};
use super::repository;

fn test_conn() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    let migrations = Migrations::new(vec![M::up(include_str!("migrations/0001_init.sql"))]);
    migrations.to_latest(&mut conn).unwrap();
    conn
}

fn default_query() -> NoteQuery {
    NoteQuery {
        status: StatusFilter::Active,
        search: None,
        tag_id: None,
        favorite_only: false,
        sort_by: SortBy::UpdatedAt,
        sort_dir: SortDir::Desc,
    }
}

#[test]
fn create_note_sets_defaults_and_active_status() {
    let conn = test_conn();
    let note = repository::create_note(&conn, Some("Title".into()), Some("Body".into())).unwrap();
    assert_eq!(note.title.as_deref(), Some("Title"));
    assert_eq!(note.content, "Body");
    assert_eq!(note.status, NoteStatus::Active);
    assert!(!note.favorite);
    assert_eq!(note.priority, 0);
    assert!(note.tags.is_empty());
}

#[test]
fn update_content_changes_title_and_content_and_bumps_updated_at() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let updated = repository::update_content(&conn, &note.id, Some("New".into()), "Hello".into())
        .unwrap();
    assert_eq!(updated.title.as_deref(), Some("New"));
    assert_eq!(updated.content, "Hello");
    assert!(updated.updated_at >= note.updated_at);
}

#[test]
fn update_content_on_missing_note_returns_not_found() {
    let conn = test_conn();
    let result = repository::update_content(&conn, "missing-id", None, "x".into());
    assert!(result.is_err());
}

#[test]
fn archive_then_unarchive_roundtrips_status() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let archived = repository::archive_note(&conn, &note.id).unwrap();
    assert_eq!(archived.status, NoteStatus::Archived);
    let unarchived = repository::unarchive_note(&conn, &note.id).unwrap();
    assert_eq!(unarchived.status, NoteStatus::Active);
}

#[test]
fn soft_delete_then_restore_roundtrips_status() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let trashed = repository::soft_delete_note(&conn, &note.id).unwrap();
    assert_eq!(trashed.status, NoteStatus::Trashed);
    let restored = repository::restore_note(&conn, &note.id).unwrap();
    assert_eq!(restored.status, NoteStatus::Active);
}

#[test]
fn delete_note_permanently_removes_row() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    repository::delete_note_permanently(&conn, &note.id).unwrap();
    let fetched = repository::get_note(&conn, &note.id).unwrap();
    assert!(fetched.is_none());
}

#[test]
fn toggle_favorite_flips_flag() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let favorited = repository::toggle_favorite(&conn, &note.id).unwrap();
    assert!(favorited.favorite);
    let unfavorited = repository::toggle_favorite(&conn, &note.id).unwrap();
    assert!(!unfavorited.favorite);
}

#[test]
fn duplicate_note_copies_content_and_tags_with_new_id() {
    let conn = test_conn();
    let note = repository::create_note(&conn, Some("Original".into()), Some("Body".into())).unwrap();
    let tag = repository::create_tag(&conn, "work").unwrap();
    repository::add_tag_to_note(&conn, &note.id, &tag.id).unwrap();

    let copy = repository::duplicate_note(&conn, &note.id).unwrap();

    assert_ne!(copy.id, note.id);
    assert_eq!(copy.title.as_deref(), Some("Original (cópia)"));
    assert_eq!(copy.content, "Body");
    assert_eq!(copy.tags.len(), 1);
    assert_eq!(copy.tags[0].name, "work");
}

#[test]
fn new_note_has_no_background_color() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    assert_eq!(note.background_color, None);
}

#[test]
fn set_background_color_persists_and_can_be_cleared() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();

    let colored = repository::set_background_color(&conn, &note.id, Some("#fde68a")).unwrap();
    assert_eq!(colored.background_color.as_deref(), Some("#fde68a"));

    let cleared = repository::set_background_color(&conn, &note.id, None).unwrap();
    assert_eq!(cleared.background_color, None);
}

#[test]
fn duplicate_note_copies_background_color() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    repository::set_background_color(&conn, &note.id, Some("#bfdbfe")).unwrap();

    let copy = repository::duplicate_note(&conn, &note.id).unwrap();
    assert_eq!(copy.background_color.as_deref(), Some("#bfdbfe"));
}

#[test]
fn list_notes_filters_by_status() {
    let conn = test_conn();
    let active = repository::create_note(&conn, Some("Active".into()), None).unwrap();
    let archived = repository::create_note(&conn, Some("Archived".into()), None).unwrap();
    repository::archive_note(&conn, &archived.id).unwrap();
    let trashed = repository::create_note(&conn, Some("Trashed".into()), None).unwrap();
    repository::soft_delete_note(&conn, &trashed.id).unwrap();

    let active_results = repository::list_notes(&conn, &default_query()).unwrap();
    assert_eq!(active_results.len(), 1);
    assert_eq!(active_results[0].id, active.id);

    let archived_results = repository::list_notes(
        &conn,
        &NoteQuery {
            status: StatusFilter::Archived,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(archived_results.len(), 1);
    assert_eq!(archived_results[0].id, archived.id);

    let all_results = repository::list_notes(
        &conn,
        &NoteQuery {
            status: StatusFilter::All,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(all_results.len(), 3);
}

#[test]
fn list_notes_filters_by_search_text() {
    let conn = test_conn();
    repository::create_note(&conn, Some("Buy milk".into()), None).unwrap();
    repository::create_note(&conn, Some("Study rust".into()), None).unwrap();

    let results = repository::list_notes(
        &conn,
        &NoteQuery {
            search: Some("milk".into()),
            status: StatusFilter::All,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title.as_deref(), Some("Buy milk"));
}

#[test]
fn list_notes_search_escapes_like_wildcards() {
    let conn = test_conn();
    repository::create_note(&conn, Some("100% done".into()), None).unwrap();
    repository::create_note(&conn, Some("no match here".into()), None).unwrap();

    let results = repository::list_notes(
        &conn,
        &NoteQuery {
            search: Some("100%".into()),
            status: StatusFilter::All,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title.as_deref(), Some("100% done"));
}

#[test]
fn list_notes_filters_by_tag() {
    let conn = test_conn();
    let tagged = repository::create_note(&conn, Some("Tagged".into()), None).unwrap();
    repository::create_note(&conn, Some("Untagged".into()), None).unwrap();
    let tag = repository::create_tag(&conn, "urgent").unwrap();
    repository::add_tag_to_note(&conn, &tagged.id, &tag.id).unwrap();

    let results = repository::list_notes(
        &conn,
        &NoteQuery {
            tag_id: Some(tag.id.clone()),
            status: StatusFilter::All,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, tagged.id);
}

#[test]
fn list_notes_sorts_by_priority() {
    let conn = test_conn();
    let low = repository::create_note(&conn, Some("Low".into()), None).unwrap();
    let high = repository::create_note(&conn, Some("High".into()), None).unwrap();
    repository::set_priority(&conn, &low.id, 1).unwrap();
    repository::set_priority(&conn, &high.id, 10).unwrap();

    let results = repository::list_notes(
        &conn,
        &NoteQuery {
            sort_by: SortBy::Priority,
            sort_dir: SortDir::Desc,
            status: StatusFilter::All,
            ..default_query()
        },
    )
    .unwrap();
    assert_eq!(results[0].id, high.id);
    assert_eq!(results[1].id, low.id);
}

#[test]
fn create_tag_is_idempotent_case_insensitive() {
    let conn = test_conn();
    let first = repository::create_tag(&conn, "Work").unwrap();
    let second = repository::create_tag(&conn, "work").unwrap();
    assert_eq!(first.id, second.id);
}

#[test]
fn new_note_has_default_window_state() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let window_state = repository::get_window_state(&conn, &note.id).unwrap().unwrap();
    assert_eq!(window_state.note_id, note.id);
    assert!(window_state.x.is_none());
    assert!(!window_state.always_on_top);
    assert!(!window_state.visible);
}

#[test]
fn save_window_position_and_size_persist() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    repository::save_window_position(&conn, &note.id, 120, 240).unwrap();
    repository::save_window_size(&conn, &note.id, 400, 320).unwrap();

    let window_state = repository::get_window_state(&conn, &note.id).unwrap().unwrap();
    assert_eq!(window_state.x, Some(120));
    assert_eq!(window_state.y, Some(240));
    assert_eq!(window_state.width, Some(400));
    assert_eq!(window_state.height, Some(320));
}

#[test]
fn set_window_visible_toggles_flag() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();

    repository::set_window_visible(&conn, &note.id, true).unwrap();

    let window_state = repository::get_window_state(&conn, &note.id).unwrap().unwrap();
    assert!(window_state.visible);
}

#[test]
fn list_visible_window_note_ids_excludes_trashed_and_hidden() {
    let conn = test_conn();
    let visible = repository::create_note(&conn, None, None).unwrap();
    repository::set_window_visible(&conn, &visible.id, true).unwrap();

    let hidden = repository::create_note(&conn, None, None).unwrap();
    let _ = hidden;

    let trashed_but_visible = repository::create_note(&conn, None, None).unwrap();
    repository::set_window_visible(&conn, &trashed_but_visible.id, true).unwrap();
    repository::soft_delete_note(&conn, &trashed_but_visible.id).unwrap();

    let ids = repository::list_visible_window_note_ids(&conn).unwrap();
    assert_eq!(ids, vec![visible.id]);
}

#[test]
fn remove_tag_from_note_deletes_association_only() {
    let conn = test_conn();
    let note = repository::create_note(&conn, None, None).unwrap();
    let tag = repository::create_tag(&conn, "temp").unwrap();
    repository::add_tag_to_note(&conn, &note.id, &tag.id).unwrap();
    let after_remove = repository::remove_tag_from_note(&conn, &note.id, &tag.id).unwrap();
    assert!(after_remove.tags.is_empty());
    let tags = repository::list_tags(&conn).unwrap();
    assert_eq!(tags.len(), 1);
}
