import { invoke } from "@tauri-apps/api/core";
import type { Note, Tag } from "../types";

export const tagsApi = {
  list: () => invoke<Tag[]>("list_tags"),

  create: (name: string) => invoke<Tag>("create_tag", { name }),

  delete: (id: string) => invoke<void>("delete_tag", { id }),

  addToNote: (noteId: string, tagId: string) => invoke<Note>("add_tag_to_note", { noteId, tagId }),

  removeFromNote: (noteId: string, tagId: string) =>
    invoke<Note>("remove_tag_from_note", { noteId, tagId }),
};
