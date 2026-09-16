import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNotesStore } from "../stores/notesStore";
import { windowsApi } from "../services/windowsApi";
import { NOTE_COLORS } from "../lib/noteColors";

export function NoteEditor() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
  const notes = useNotesStore((s) => s.notes);
  const note = notes.find((n) => n.id === selectedNoteId) ?? null;
  const saveNoteContent = useNotesStore((s) => s.saveNoteContent);
  const saveStatus = useNotesStore((s) => s.saveStatus);
  const toggleFavorite = useNotesStore((s) => s.toggleFavorite);
  const setNoteColor = useNotesStore((s) => s.setNoteColor);
  const archiveNote = useNotesStore((s) => s.archiveNote);
  const unarchiveNote = useNotesStore((s) => s.unarchiveNote);
  const softDeleteNote = useNotesStore((s) => s.softDeleteNote);
  const restoreNote = useNotesStore((s) => s.restoreNote);
  const deleteNotePermanently = useNotesStore((s) => s.deleteNotePermanently);
  const duplicateNote = useNotesStore((s) => s.duplicateNote);
  const tags = useNotesStore((s) => s.tags);
  const createTag = useNotesStore((s) => s.createTag);
  const addTagToNote = useNotesStore((s) => s.addTagToNote);
  const removeTagFromNote = useNotesStore((s) => s.removeTagFromNote);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftRef = useRef({ id: "", title: "", content: "" });
  const dirtyRef = useRef(false);

  async function flushSave() {
    clearTimeout(debounceRef.current);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const { id, title: t, content: c } = draftRef.current;
    await saveNoteContent(id, t.trim() ? t : null, c);
  }

  const noteId = note?.id;
  useEffect(() => {
    // flush whatever was pending for the previously selected note before switching drafts
    void flushSave();
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync local draft when the selected note changes
  }, [noteId]);

  useEffect(() => {
    return () => {
      void flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushSave reads live refs, safe to run only on unmount
  }, []);

  useEffect(() => {
    // The manager window never actually closes — it hides to the tray, so the app
    // (and any open floating notes) keeps running. Flush any pending edit first.
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win
      .onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await flushSave();
        } finally {
          await win.hide();
        }
      })
      .then((f) => {
        unlisten = f;
      });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushSave reads live refs, safe to register once
  }, []);

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (!note) return;
    draftRef.current = { id: note.id, title: nextTitle, content: nextContent };
    dirtyRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flushSave();
    }, 600);
  }

  async function handleAddTag() {
    const name = tagInput.trim();
    if (!name || !note) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const tag = existing ?? (await createTag(name));
    if (!note.tags.some((t) => t.id === tag.id)) {
      await addTagToNote(note.id, tag.id);
    }
    setTagInput("");
  }

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm opacity-40">
        Selecione ou crie uma nota
      </div>
    );
  }

  const isTrashed = note.status === "trashed";
  const isArchived = note.status === "archived";

  const btn = "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors";
  const btnNeutral = `${btn} opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10`;
  const btnDanger = `${btn} text-red-500 hover:bg-red-500/10 hover:text-red-600`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-black/10 px-3 py-2 dark:border-white/10">
        <button
          onClick={() => void toggleFavorite(note.id)}
          className={`rounded-md px-2 py-1 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${note.favorite ? "text-yellow-500" : "opacity-30 hover:opacity-70"}`}
          aria-label="Favoritar"
          title="Favoritar"
        >
          ★
        </button>

        {!isTrashed && (
          <button
            onClick={() => void windowsApi.openNote(note.id)}
            title="Abrir como janela flutuante"
            className={`${btn} bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 dark:text-blue-300`}
          >
            ↗ Janela flutuante
          </button>
        )}
        <button onClick={() => void duplicateNote(note.id)} className={btnNeutral} title="Duplicar">
          ⧉ Duplicar
        </button>

        <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />

        {isTrashed ? (
          <>
            <button
              onClick={() => void restoreNote(note.id)}
              className={btnNeutral}
              title="Restaurar"
            >
              ↺ Restaurar
            </button>
            <button
              onClick={() => void deleteNotePermanently(note.id)}
              className={btnDanger}
              title="Excluir permanentemente"
            >
              ⌫ Excluir permanentemente
            </button>
          </>
        ) : (
          <>
            {isArchived ? (
              <button
                onClick={() => void unarchiveNote(note.id)}
                className={btnNeutral}
                title="Desarquivar"
              >
                ↺ Desarquivar
              </button>
            ) : (
              <button
                onClick={() => void archiveNote(note.id)}
                className={btnNeutral}
                title="Arquivar"
              >
                🗄 Arquivar
              </button>
            )}
            <button
              onClick={() => void softDeleteNote(note.id)}
              className={btnDanger}
              title="Excluir"
            >
              🗑 Excluir
            </button>
          </>
        )}

        <span className="ml-auto text-xs opacity-40">
          {saveStatus === "saving" && "Salvando..."}
          {saveStatus === "saved" && "Salvo"}
          {saveStatus === "error" && "Erro ao salvar"}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2 dark:border-white/10">
        <button
          onClick={() => void setNoteColor(note.id, null)}
          aria-label="Sem cor"
          title="Sem cor"
          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] leading-none ${
            !note.background_color
              ? "border-blue-500"
              : "border-black/20 opacity-50 dark:border-white/30"
          }`}
        >
          ∅
        </button>
        {NOTE_COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => void setNoteColor(note.id, c.value)}
            aria-label={c.label}
            title={c.label}
            style={{ backgroundColor: c.value }}
            className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 ${
              note.background_color === c.value
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-black/10 dark:border-white/20"
            }`}
          />
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value, content);
        }}
        placeholder="Título (opcional)"
        disabled={isTrashed}
        className="border-b border-black/10 bg-transparent px-4 py-3 text-lg font-medium outline-none disabled:opacity-60 dark:border-white/10"
      />

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleSave(title, e.target.value);
        }}
        placeholder="Escreva em markdown..."
        disabled={isTrashed}
        className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none disabled:opacity-60"
      />

      <div className="flex flex-wrap items-center gap-1.5 border-t border-black/10 px-4 py-2 dark:border-white/10">
        {note.tags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
          >
            #{tag.name}
            <button
              onClick={() => void removeTagFromNote(note.id, tag.id)}
              className="opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {!isTrashed && (
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddTag();
              }
            }}
            placeholder="+ tag"
            list="known-tags"
            className="w-20 bg-transparent text-xs outline-none"
          />
        )}
        <datalist id="known-tags">
          {tags.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
