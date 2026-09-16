CREATE TABLE notes (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT,
    content TEXT NOT NULL DEFAULT '',
    favorite INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    deleted_at TEXT
);

CREATE INDEX idx_notes_favorite ON notes(favorite);
CREATE INDEX idx_notes_archived_at ON notes(archived_at);
CREATE INDEX idx_notes_deleted_at ON notes(deleted_at);
CREATE INDEX idx_notes_updated_at ON notes(updated_at);

CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);

CREATE TABLE note_window_state (
    note_id TEXT PRIMARY KEY NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    x INTEGER,
    y INTEGER,
    width INTEGER,
    height INTEGER,
    always_on_top INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE note_appearance (
    note_id TEXT PRIMARY KEY NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    background_color TEXT,
    text_color TEXT,
    opacity REAL NOT NULL DEFAULT 1.0,
    font_family TEXT,
    font_size INTEGER,
    padding INTEGER,
    border_radius INTEGER,
    shadow INTEGER NOT NULL DEFAULT 1,
    theme TEXT NOT NULL DEFAULT 'system',
    density TEXT NOT NULL DEFAULT 'comfortable',
    preset TEXT
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
