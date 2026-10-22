ALTER TABLE notes ADD COLUMN remind_at TEXT;

CREATE INDEX idx_notes_remind_at ON notes(remind_at);

-- Floating notes used to always open pinned above other windows; keep that as the
-- starting point now that pinning is a per-note toggle.
UPDATE note_window_state SET always_on_top = 1;
