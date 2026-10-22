import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileText,
  FileX2,
  PictureInPicture2,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNotesStore, type SaveStatus } from "../stores/notesStore";
import { windowsApi } from "../services/windowsApi";
import { notesApi } from "../services/notesApi";
import { NOTE_COLORS } from "../lib/noteColors";
import { PRIORITIES } from "../lib/priority";
import { NoteBody } from "./NoteBody";
import { ReminderControl } from "./ReminderControl";

export function NoteEditor() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
  const notes = useNotesStore((s) => s.notes);
  const note = notes.find((n) => n.id === selectedNoteId) ?? null;
  const saveNoteContent = useNotesStore((s) => s.saveNoteContent);
  const saveStatus = useNotesStore((s) => s.saveStatus);
  const toggleFavorite = useNotesStore((s) => s.toggleFavorite);
  const setNoteColor = useNotesStore((s) => s.setNoteColor);
  const setNotePriority = useNotesStore((s) => s.setNotePriority);
  const setNoteReminder = useNotesStore((s) => s.setNoteReminder);
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="accent-gradient grid h-12 w-12 place-items-center rounded-xl opacity-80 shadow-[0_0_40px_-8px] shadow-accent">
          <FileText size={20} className="text-white" />
        </span>
        <span className="text-sm text-muted">Selecione ou crie uma nota</span>
        <span className="text-xs text-faint">
          <kbd className="kbd">Ctrl K</kbd> para buscar
        </span>
      </div>
    );
  }

  const isTrashed = note.status === "trashed";
  const isArchived = note.status === "archived";
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-4">
        <span className="mr-2 rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          {isTrashed ? "lixeira" : isArchived ? "arquivada" : "ativa"}
        </span>
        <SaveIndicator status={saveStatus} />

        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => void toggleFavorite(note.id)}
            className="icon-btn"
            aria-label="Favoritar"
            title="Favoritar"
          >
            <Star size={15} className={note.favorite ? "fill-amber-400 text-amber-400" : ""} />
          </button>
          <button
            onClick={() => void duplicateNote(note.id)}
            className="icon-btn"
            aria-label="Duplicar"
            title="Duplicar"
          >
            <Copy size={15} />
          </button>

          {isTrashed ? (
            <>
              <button
                onClick={() => void restoreNote(note.id)}
                className="icon-btn"
                aria-label="Restaurar"
                title="Restaurar"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => void deleteNotePermanently(note.id)}
                className="icon-btn hover:bg-red-500/15 hover:text-red-400"
                aria-label="Excluir permanentemente"
                title="Excluir permanentemente"
              >
                <FileX2 size={15} />
              </button>
            </>
          ) : (
            <>
              {isArchived ? (
                <button
                  onClick={() => void unarchiveNote(note.id)}
                  className="icon-btn"
                  aria-label="Desarquivar"
                  title="Desarquivar"
                >
                  <ArchiveRestore size={15} />
                </button>
              ) : (
                <button
                  onClick={() => void archiveNote(note.id)}
                  className="icon-btn"
                  aria-label="Arquivar"
                  title="Arquivar"
                >
                  <Archive size={15} />
                </button>
              )}
              <button
                onClick={() => void softDeleteNote(note.id)}
                className="icon-btn hover:bg-red-500/15 hover:text-red-400"
                aria-label="Excluir"
                title="Excluir"
              >
                <Trash2 size={15} />
              </button>
              <span className="mx-1.5 h-4 w-px bg-line-strong" />
              <button
                onClick={() => void windowsApi.openNote(note.id)}
                title="Abrir como janela flutuante"
                className="flex h-7 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-xs font-medium text-violet-300 transition-colors hover:border-accent/50 hover:bg-accent/20"
              >
                <PictureInPicture2 size={14} />
                Flutuar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-8 py-2.5">
        <Property label="Cor">
          <button
            onClick={() => void setNoteColor(note.id, null)}
            aria-label="Sem cor"
            title="Sem cor"
            className={`grid h-4 w-4 place-items-center rounded-full border transition-all ${
              !note.background_color
                ? "border-fg/70 ring-2 ring-white/15"
                : "border-line-strong hover:border-fg/40"
            }`}
          >
            <span className="h-px w-2.5 rotate-45 bg-muted" />
          </button>
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => void setNoteColor(note.id, c.value)}
              aria-label={c.label}
              title={c.label}
              style={{
                backgroundColor: c.value,
                boxShadow: note.background_color === c.value ? `0 0 12px ${c.value}` : undefined,
              }}
              className={`h-4 w-4 rounded-full transition-transform hover:scale-115 ${
                note.background_color === c.value
                  ? "ring-2 ring-white/70 ring-offset-2 ring-offset-canvas"
                  : ""
              }`}
            />
          ))}
        </Property>

        <Property label="Prioridade">
          <div className="flex rounded-md border border-line bg-white/[0.02] p-0.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => void setNotePriority(note.id, p.value)}
                disabled={isTrashed}
                title={p.label}
                className={`h-5 min-w-7 rounded px-1.5 font-mono text-[10px] font-bold transition-colors disabled:opacity-40 ${
                  note.priority === p.value
                    ? `bg-white/10 ${p.className || "text-fg"}`
                    : "text-faint hover:text-muted"
                }`}
              >
                {p.mark || "—"}
              </button>
            ))}
          </div>
        </Property>

        <Property label="Lembrete">
          <ReminderControl
            remindAt={note.remind_at}
            onChange={(remindAt) => void setNoteReminder(note.id, remindAt)}
            disabled={isTrashed}
          />
        </Property>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value, content);
        }}
        placeholder="Sem título"
        disabled={isTrashed}
        className="shrink-0 bg-transparent px-8 pt-6 pb-2 text-2xl font-semibold tracking-tight text-fg outline-none placeholder:text-faint disabled:opacity-60"
      />

      <NoteBody
        value={content}
        onChange={(next) => {
          setContent(next);
          scheduleSave(title, next);
        }}
        onExport={() => void flushSave().then(() => notesApi.exportMarkdown(note.id))}
        disabled={isTrashed}
        style={note.font_size ? { fontSize: note.font_size } : undefined}
        toolbarClassName="mx-7 border-b border-line pb-2"
        className="flex-1 px-8 py-4 text-sm leading-7 text-fg/90"
      />

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line px-8 py-2.5">
        <Tag size={13} className="mr-1 text-faint" />
        {note.tags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-md border border-accent/25 bg-accent/10 py-0.5 pr-1 pl-2 font-mono text-[11px] text-violet-300"
          >
            #{tag.name}
            <button
              onClick={() => void removeTagFromNote(note.id, tag.id)}
              aria-label={`Remover tag ${tag.name}`}
              className="rounded text-violet-300/60 hover:bg-white/10 hover:text-violet-200"
            >
              <X size={12} />
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
            placeholder="adicionar tag…"
            list="known-tags"
            className="w-28 bg-transparent font-mono text-[11px] text-fg outline-none placeholder:text-faint"
          />
        )}
        <datalist id="known-tags">
          {tags.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <span className="ml-auto font-mono text-[10px] text-faint">
          {words} {words === 1 ? "palavra" : "palavras"} · {content.length} caracteres
        </span>
      </div>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const styles: Record<
    Exclude<SaveStatus, "idle">,
    { dot: string; text: string; label: string }
  > = {
    saving: { dot: "bg-amber-400 animate-pulse", text: "text-faint", label: "Salvando…" },
    saved: { dot: "bg-emerald-400", text: "text-faint", label: "Salvo" },
    error: { dot: "bg-red-400", text: "text-red-400", label: "Erro ao salvar" },
  };
  const s = styles[status];
  return (
    <span className={`flex items-center gap-1.5 text-[11px] ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
