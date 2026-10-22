export type NoteStatus = "active" | "archived" | "trashed";

export interface Tag {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string | null;
  content: string;
  favorite: boolean;
  priority: number;
  status: NoteStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  background_color: string | null;
  opacity: number;
  font_size: number | null;
  always_on_top: boolean;
  remind_at: string | null;
  tags: Tag[];
}

export type StatusFilter = "active" | "archived" | "trashed" | "all";
export type SortBy = "created_at" | "updated_at" | "priority";
export type SortDir = "asc" | "desc";

export interface NoteQuery {
  status: StatusFilter;
  search: string | null;
  tag_id: string | null;
  favorite_only: boolean;
  sort_by: SortBy;
  sort_dir: SortDir;
}

export interface NoteUpdatedEvent {
  note: Note;
  source_window: string;
}

export interface NoteDeletedEvent {
  note_id: string;
}
