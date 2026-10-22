use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NoteStatus {
    Active,
    Archived,
    Trashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: Option<String>,
    pub content: String,
    pub favorite: bool,
    pub priority: i64,
    pub status: NoteStatus,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
    pub deleted_at: Option<String>,
    pub background_color: Option<String>,
    pub opacity: f64,
    pub font_size: Option<i64>,
    pub always_on_top: bool,
    pub remind_at: Option<String>,
    pub tags: Vec<Tag>,
}

impl Note {
    /// True when the note was never actually written in — no title and no content.
    pub fn is_blank(&self) -> bool {
        self.title.is_none() && self.content.trim().is_empty()
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatusFilter {
    Active,
    Archived,
    Trashed,
    All,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortBy {
    CreatedAt,
    UpdatedAt,
    Priority,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteWindowState {
    pub note_id: String,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub always_on_top: bool,
    pub visible: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NoteQuery {
    #[serde(default = "default_status_filter")]
    pub status: StatusFilter,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub tag_id: Option<String>,
    #[serde(default)]
    pub favorite_only: bool,
    #[serde(default = "default_sort_by")]
    pub sort_by: SortBy,
    #[serde(default = "default_sort_dir")]
    pub sort_dir: SortDir,
}

fn default_status_filter() -> StatusFilter {
    StatusFilter::Active
}

fn default_sort_by() -> SortBy {
    SortBy::UpdatedAt
}

fn default_sort_dir() -> SortDir {
    SortDir::Desc
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_note(title: Option<&str>, content: &str) -> Note {
        Note {
            id: "id".into(),
            title: title.map(|t| t.to_string()),
            content: content.to_string(),
            favorite: false,
            priority: 0,
            status: NoteStatus::Active,
            created_at: "now".into(),
            updated_at: "now".into(),
            archived_at: None,
            deleted_at: None,
            background_color: None,
            opacity: 1.0,
            font_size: None,
            always_on_top: true,
            remind_at: None,
            tags: Vec::new(),
        }
    }

    #[test]
    fn note_with_no_title_and_no_content_is_blank() {
        assert!(sample_note(None, "").is_blank());
    }

    #[test]
    fn note_with_only_whitespace_content_is_blank() {
        assert!(sample_note(None, "   \n  ").is_blank());
    }

    #[test]
    fn note_with_a_title_is_not_blank() {
        assert!(!sample_note(Some("Hi"), "").is_blank());
    }

    #[test]
    fn note_with_content_is_not_blank() {
        assert!(!sample_note(None, "some text").is_blank());
    }
}
