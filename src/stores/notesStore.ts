import { create } from "zustand";
import { notesApi } from "../services/notesApi";
import { tagsApi } from "../services/tagsApi";
import type { Note, NoteQuery, SortBy, SortDir, StatusFilter, Tag } from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NotesState {
  notes: Note[];
  tags: Tag[];
  selectedNoteId: string | null;
  selectedIds: Set<string>;
  statusFilter: StatusFilter;
  tagFilter: string | null;
  favoriteOnly: boolean;
  search: string;
  sortBy: SortBy;
  sortDir: SortDir;
  loading: boolean;
  error: string | null;
  saveStatus: SaveStatus;

  loadNotes: () => Promise<void>;
  loadTags: () => Promise<void>;
  selectNote: (id: string | null) => void;
  applyRemoteUpdate: (note: Note) => void;
  applyRemoteDelete: (noteId: string) => void;
  toggleSelectedForBulk: (id: string) => void;
  toggleSelectAll: () => void;
  clearBulkSelection: () => void;
  bulkDeleteSelected: () => Promise<void>;
  saveNoteContent: (id: string, title: string | null, content: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setNoteColor: (id: string, color: string | null) => Promise<void>;
  setNotePriority: (id: string, priority: number) => Promise<void>;
  setNoteReminder: (id: string, remindAt: string | null) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  unarchiveNote: (id: string) => Promise<void>;
  softDeleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  duplicateNote: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  createTag: (name: string) => Promise<Tag>;
  addTagToNote: (noteId: string, tagId: string) => Promise<void>;
  removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;

  setStatusFilter: (status: StatusFilter) => void;
  setTagFilter: (tagId: string | null) => void;
  setFavoriteOnly: (value: boolean) => void;
  setSearch: (value: string) => void;
  setSort: (sortBy: SortBy, sortDir: SortDir) => void;
}

function buildQuery(
  state: Pick<
    NotesState,
    "statusFilter" | "tagFilter" | "favoriteOnly" | "search" | "sortBy" | "sortDir"
  >,
): NoteQuery {
  return {
    status: state.statusFilter,
    search: state.search.trim() ? state.search.trim() : null,
    tag_id: state.tagFilter,
    favorite_only: state.favoriteOnly,
    sort_by: state.sortBy,
    sort_dir: state.sortDir,
  };
}

function replaceNote(notes: Note[], updated: Note): Note[] {
  return notes.map((n) => (n.id === updated.id ? updated : n));
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  tags: [],
  selectedNoteId: null,
  selectedIds: new Set(),
  statusFilter: "active",
  tagFilter: null,
  favoriteOnly: false,
  search: "",
  sortBy: "updated_at",
  sortDir: "desc",
  loading: false,
  error: null,
  saveStatus: "idle",

  loadNotes: async () => {
    set({ loading: true, error: null });
    try {
      const notes = await notesApi.list(buildQuery(get()));
      set({ notes, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  loadTags: async () => {
    try {
      const tags = await tagsApi.list();
      set({ tags });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  selectNote: (id) => set({ selectedNoteId: id, saveStatus: "idle" }),

  applyRemoteUpdate: (note) => {
    const exists = get().notes.some((n) => n.id === note.id);
    if (exists) {
      set((state) => ({ notes: replaceNote(state.notes, note) }));
    } else {
      // a note we don't know about yet (created from the tray, a shortcut, or another
      // window) — refetch so it lands in the right spot for the current filter/sort
      void get().loadNotes();
    }
  },

  applyRemoteDelete: (noteId) => {
    set((state) => {
      const selectedIds = new Set(state.selectedIds);
      selectedIds.delete(noteId);
      return {
        notes: state.notes.filter((n) => n.id !== noteId),
        selectedNoteId: state.selectedNoteId === noteId ? null : state.selectedNoteId,
        selectedIds,
      };
    });
  },

  toggleSelectedForBulk: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  toggleSelectAll: () => {
    const { notes, selectedIds } = get();
    const allSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));
    set({ selectedIds: allSelected ? new Set() : new Set(notes.map((n) => n.id)) });
  },

  clearBulkSelection: () => set({ selectedIds: new Set() }),

  bulkDeleteSelected: async () => {
    const ids = Array.from(get().selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => notesApi.softDelete(id)));
    set({ selectedIds: new Set() });
    await get().loadNotes();
  },

  saveNoteContent: async (id, title, content) => {
    set({ saveStatus: "saving" });
    try {
      const updated = await notesApi.updateContent(id, title, content);
      set((state) => ({ notes: replaceNote(state.notes, updated), saveStatus: "saved" }));
    } catch (err) {
      set({ error: String(err), saveStatus: "error" });
    }
  },

  toggleFavorite: async (id) => {
    const updated = await notesApi.toggleFavorite(id);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  setNoteColor: async (id, color) => {
    const updated = await notesApi.setColor(id, color);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  setNotePriority: async (id, priority) => {
    const updated = await notesApi.setPriority(id, priority);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  setNoteReminder: async (id, remindAt) => {
    const updated = await notesApi.setReminder(id, remindAt);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  archiveNote: async (id) => {
    await notesApi.archive(id);
    await get().loadNotes();
  },

  unarchiveNote: async (id) => {
    await notesApi.unarchive(id);
    await get().loadNotes();
  },

  softDeleteNote: async (id) => {
    await notesApi.softDelete(id);
    await get().loadNotes();
  },

  restoreNote: async (id) => {
    await notesApi.restore(id);
    await get().loadNotes();
  },

  deleteNotePermanently: async (id) => {
    await notesApi.deletePermanently(id);
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
    }));
  },

  duplicateNote: async (id) => {
    const copy = await notesApi.duplicate(id);
    await get().loadNotes();
    set({ selectedNoteId: copy.id });
  },

  emptyTrash: async () => {
    await notesApi.emptyTrash();
    set({ selectedIds: new Set() });
    await get().loadNotes();
  },

  createTag: async (name) => {
    const tag = await tagsApi.create(name);
    set((state) =>
      state.tags.some((t) => t.id === tag.id) ? state : { tags: [...state.tags, tag] },
    );
    return tag;
  },

  addTagToNote: async (noteId, tagId) => {
    const updated = await tagsApi.addToNote(noteId, tagId);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  removeTagFromNote: async (noteId, tagId) => {
    const updated = await tagsApi.removeFromNote(noteId, tagId);
    set((state) => ({ notes: replaceNote(state.notes, updated) }));
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter, selectedIds: new Set() });
    void get().loadNotes();
  },
  setTagFilter: (tagFilter) => {
    set({ tagFilter, selectedIds: new Set() });
    void get().loadNotes();
  },
  setFavoriteOnly: (favoriteOnly) => {
    set({ favoriteOnly, selectedIds: new Set() });
    void get().loadNotes();
  },
  setSearch: (search) => {
    set({ search, selectedIds: new Set() });
    void get().loadNotes();
  },
  setSort: (sortBy, sortDir) => {
    set({ sortBy, sortDir });
    void get().loadNotes();
  },
}));
