import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { notesApi } from "../../services/notesApi";
import { NoteBody } from "../../components/NoteBody";
import type { Note, NoteDeletedEvent, NoteUpdatedEvent } from "../../types";

const OPACITY_STEPS = [1, 0.85, 0.7, 0.55];
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

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
    // lets the note paint its own (possibly translucent) background over a transparent window
    document.documentElement.classList.add("note-window");
  }, []);

  useEffect(() => {
    // the note was removed for good (e.g. "Esvaziar lixeira") — nothing left to show
    const unlisten = listen<NoteDeletedEvent>("note-deleted", (event) => {
      if (event.payload.note_id === noteId) void getCurrentWindow().destroy();
    });
    return () => {
      void unlisten.then((f) => f());
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

  async function updateAppearance(opacity: number, fontSize: number | null) {
    setNote(await notesApi.setAppearance(noteId, opacity, fontSize));
  }

  async function toggleAlwaysOnTop() {
    if (!note) return;
    setNote(await notesApi.setAlwaysOnTop(noteId, !note.always_on_top));
  }

  if (!note) {
    return (
      <div className="flex h-screen items-center justify-center text-sm opacity-40">
        Carregando...
      </div>
    );
  }

  const fontSize = note.font_size ?? DEFAULT_FONT_SIZE;
  const nextOpacity =
    OPACITY_STEPS[(OPACITY_STEPS.indexOf(note.opacity) + 1) % OPACITY_STEPS.length] ?? 1;
  const baseBackground = note.background_color ?? "var(--app-bg)";

  const iconBtn =
    "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-xs opacity-60 transition-colors hover:bg-black/5 hover:opacity-100 disabled:opacity-25 dark:hover:bg-white/10";

  return (
    <div
      className="flex h-screen flex-col"
      style={{
        backgroundColor: `color-mix(in srgb, ${baseBackground} ${Math.round(note.opacity * 100)}%, transparent)`,
        color: note.background_color ? "#18181b" : undefined,
      }}
    >
      <div className="flex items-center gap-0.5 border-b border-black/10 pr-1 dark:border-white/10">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, content);
          }}
          placeholder="Título (opcional)"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base font-medium outline-none"
        />
        <button
          onClick={() => void toggleAlwaysOnTop()}
          className={`${iconBtn} ${note.always_on_top ? "opacity-100" : "grayscale"}`}
          title={note.always_on_top ? "Desafixar do topo" : "Fixar sempre no topo"}
          aria-pressed={note.always_on_top}
        >
          📌
        </button>
        <button
          onClick={() => void updateAppearance(note.opacity, fontSize - 1)}
          disabled={fontSize <= MIN_FONT_SIZE}
          className={iconBtn}
          title="Diminuir fonte"
        >
          A−
        </button>
        <button
          onClick={() => void updateAppearance(note.opacity, fontSize + 1)}
          disabled={fontSize >= MAX_FONT_SIZE}
          className={iconBtn}
          title="Aumentar fonte"
        >
          A+
        </button>
        <button
          onClick={() => void updateAppearance(nextOpacity, note.font_size)}
          className={iconBtn}
          title={`Opacidade: ${Math.round(note.opacity * 100)}% (clique para ${Math.round(nextOpacity * 100)}%)`}
        >
          ◐
        </button>
      </div>

      <NoteBody
        value={content}
        onChange={(next) => {
          setContent(next);
          scheduleSave(title, next);
        }}
        onExport={() => void flushSave().then(() => notesApi.exportMarkdown(noteId))}
        autoFocus
        style={{ fontSize }}
        toolbarClassName="px-2 pt-1"
        className="flex-1 px-3 py-2 leading-relaxed"
      />
    </div>
  );
}
