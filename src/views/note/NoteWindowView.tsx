import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { notesApi } from "../../services/notesApi";
import type { Note, NoteUpdatedEvent } from "../../types";

export function NoteWindowView({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftRef = useRef({ title: "", content: "" });
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void notesApi.get(noteId).then((loaded) => {
      if (cancelled) return;
      setNote(loaded);
      setTitle(loaded.title ?? "");
      setContent(loaded.content);
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  useEffect(() => {
    const currentLabel = getCurrentWindow().label;
    const unlisten = listen<NoteUpdatedEvent>("note-updated", (event) => {
      if (event.payload.note.id !== noteId) return;
      if (event.payload.source_window === currentLabel) return;
      const updated = event.payload.note;
      setNote(updated);
      setTitle(updated.title ?? "");
      setContent(updated.content);
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [noteId]);

  async function flushSave() {
    clearTimeout(debounceRef.current);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const { title: t, content: c } = draftRef.current;
    try {
      const updated = await notesApi.updateContent(noteId, t.trim() ? t : null, c);
      setNote(updated);
    } catch {
      dirtyRef.current = true;
    }
  }

  useEffect(() => {
    return () => {
      void flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushSave reads live refs, safe to run only on unmount
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win
      .onCloseRequested(async (event) => {
        if (!dirtyRef.current) return;
        event.preventDefault();
        try {
          await flushSave();
        } finally {
          await win.destroy();
        }
      })
      .then((f) => {
        unlisten = f;
      });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushSave reads live refs, safe to register once
  }, []);

  function scheduleSave(nextTitle: string, nextContent: string) {
    draftRef.current = { title: nextTitle, content: nextContent };
    dirtyRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flushSave();
    }, 600);
  }

  if (!note) {
    return (
      <div className="flex h-screen items-center justify-center text-sm opacity-40">
        Carregando...
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col"
      style={
        note.background_color
          ? { backgroundColor: note.background_color, color: "#18181b" }
          : undefined
      }
    >
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value, content);
        }}
        placeholder="Título (opcional)"
        className="border-b border-black/10 bg-transparent px-3 py-2 text-base font-medium outline-none dark:border-white/10"
      />

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleSave(title, e.target.value);
        }}
        placeholder="Escreva em markdown..."
        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
        autoFocus
      />
    </div>
  );
}
