import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar } from "../../components/Sidebar";
import { Topbar } from "../../components/Topbar";
import { NoteList } from "../../components/NoteList";
import { NoteEditor } from "../../components/NoteEditor";
import { useNotesStore } from "../../stores/notesStore";
import type { NoteDeletedEvent, NoteUpdatedEvent } from "../../types";

export function ManagerView() {
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const loadTags = useNotesStore((s) => s.loadTags);
  const applyRemoteUpdate = useNotesStore((s) => s.applyRemoteUpdate);
  const applyRemoteDelete = useNotesStore((s) => s.applyRemoteDelete);

  useEffect(() => {
    void loadNotes();
    void loadTags();
  }, [loadNotes, loadTags]);

  useEffect(() => {
    const currentLabel = getCurrentWindow().label;
    const unlistenUpdated = listen<NoteUpdatedEvent>("note-updated", (event) => {
      if (event.payload.source_window === currentLabel) return;
      applyRemoteUpdate(event.payload.note);
    });
    const unlistenDeleted = listen<NoteDeletedEvent>("note-deleted", (event) => {
      applyRemoteDelete(event.payload.note_id);
    });
    return () => {
      void unlistenUpdated.then((f) => f());
      void unlistenDeleted.then((f) => f());
    };
  }, [applyRemoteUpdate, applyRemoteDelete]);

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-black/10 dark:border-white/10">
          <NoteList />
        </div>
        <NoteEditor />
      </div>
    </div>
  );
}
