import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteQuery } from "../types";

export const notesApi = {
  create: (title: string | null, content: string | null) =>
    invoke<Note>("create_note", { title, content }),

  list: (query: NoteQuery) => invoke<Note[]>("list_notes", { query }),

  get: (id: string) => invoke<Note>("get_note", { id }),

  updateContent: (id: string, title: string | null, content: string) =>
    invoke<Note>("update_note_content", { id, title, content }),

  setPriority: (id: string, priority: number) =>
    invoke<Note>("set_note_priority", { id, priority }),

  setColor: (id: string, color: string | null) => invoke<Note>("set_note_color", { id, color }),

  toggleFavorite: (id: string) => invoke<Note>("toggle_note_favorite", { id }),

  archive: (id: string) => invoke<Note>("archive_note", { id }),

  unarchive: (id: string) => invoke<Note>("unarchive_note", { id }),

  softDelete: (id: string) => invoke<void>("delete_note", { id }),

  restore: (id: string) => invoke<Note>("restore_note", { id }),

  deletePermanently: (id: string) => invoke<void>("delete_note_permanently", { id }),

  duplicate: (id: string) => invoke<Note>("duplicate_note", { id }),
};
