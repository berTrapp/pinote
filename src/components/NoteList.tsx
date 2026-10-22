import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  AlarmClock,
  ExternalLink,
  FileX2,
  Loader2,
  NotebookPen,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { useNotesStore } from "../stores/notesStore";
import { windowsApi } from "../services/windowsApi";
import type { Note } from "../types";
import { checklistProgress, parseChecklistLine } from "../lib/checklist";
import { priorityInfo } from "../lib/priority";
import { formatReminder } from "../lib/reminder";

function preview(content: string): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  if (!firstLine) return "";
  const item = parseChecklistLine(firstLine);
  const text = item ? `${item.checked ? "☑" : "☐"} ${item.text}` : firstLine.replace(/^#+ /, "");
  return text.slice(0, 120);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function NoteList() {
  const notes = useNotesStore((s) => s.notes);
  const loading = useNotesStore((s) => s.loading);
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
  const selectNote = useNotesStore((s) => s.selectNote);
  const selectedIds = useNotesStore((s) => s.selectedIds);
  const toggleSelectedForBulk = useNotesStore((s) => s.toggleSelectedForBulk);
  const toggleSelectAll = useNotesStore((s) => s.toggleSelectAll);
  const clearBulkSelection = useNotesStore((s) => s.clearBulkSelection);
  const bulkDeleteSelected = useNotesStore((s) => s.bulkDeleteSelected);
  const statusFilter = useNotesStore((s) => s.statusFilter);

  const allSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));

  if (loading && notes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-xs text-faint">
        <Loader2 size={14} className="animate-spin" />
        Carregando…
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-white/[0.03]">
          <NotebookPen size={20} className="text-faint" />
        </span>
        <span className="text-sm text-muted">Nenhuma nota por aqui.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
          {notes.length} {notes.length === 1 ? "nota" : "notas"}
        </span>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 border-b border-accent/20 bg-accent/10 px-4 py-2 text-xs">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected;
            }}
            onChange={toggleSelectAll}
            aria-label="Selecionar todas"
            title="Selecionar todas"
            className="accent-violet-500"
          />
          <span className="font-medium text-fg">{selectedIds.size} selecionada(s)</span>
          <button
            onClick={() => void bulkDeleteSelected()}
            className="ml-auto flex items-center gap-1 font-medium text-red-400 hover:text-red-300"
          >
            <Trash2 size={13} />
            Excluir
          </button>
          <button onClick={clearBulkSelection} className="text-muted hover:text-fg">
            Cancelar
          </button>
        </div>
      )}
      {statusFilter === "trashed" && <EmptyTrashBar count={notes.length} />}
      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            selected={note.id === selectedNoteId}
            checked={selectedIds.has(note.id)}
            onSelect={() => selectNote(note.id)}
            onToggleChecked={() => toggleSelectedForBulk(note.id)}
          />
        ))}
      </ul>
    </div>
  );
}

/** Two-step button: the first click arms it, the second (within a few seconds) empties the trash. */
function EmptyTrashBar({ count }: { count: number }) {
  const emptyTrash = useNotesStore((s) => s.emptyTrash);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-xs">
      <span className="text-muted">{count} na lixeira</span>
      <button
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          void emptyTrash();
        }}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors ${
          armed ? "bg-red-500 text-white hover:bg-red-600" : "text-red-400 hover:bg-red-500/10"
        }`}
      >
        <FileX2 size={13} />
        {armed ? "Confirmar exclusão definitiva" : "Esvaziar lixeira"}
      </button>
    </div>
  );
}

function RowAction({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${
        danger
          ? "text-faint hover:bg-red-500/15 hover:text-red-400"
          : "text-faint hover:bg-white/10 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function NoteRow({
  note,
  selected,
  checked,
  onSelect,
  onToggleChecked,
}: {
  note: Note;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleChecked: () => void;
}) {
  const toggleFavorite = useNotesStore((s) => s.toggleFavorite);
  const archiveNote = useNotesStore((s) => s.archiveNote);
  const unarchiveNote = useNotesStore((s) => s.unarchiveNote);
  const softDeleteNote = useNotesStore((s) => s.softDeleteNote);
  const restoreNote = useNotesStore((s) => s.restoreNote);
  const deleteNotePermanently = useNotesStore((s) => s.deleteNotePermanently);

  const isTrashed = note.status === "trashed";
  const isArchived = note.status === "archived";
  const priority = priorityInfo(note.priority);
  const progress = checklistProgress(note.content);

  return (
    <li
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-current={selected}
      className={`group relative flex cursor-pointer gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/50 ${
        selected
          ? "border-accent/40 bg-accent/[0.08] shadow-[0_0_0_1px] shadow-accent/10"
          : "border-transparent hover:border-line hover:bg-white/[0.03]"
      }`}
    >
      {note.background_color && (
        <span
          className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r"
          style={{ backgroundColor: note.background_color }}
        />
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleChecked}
        onClick={(e) => e.stopPropagation()}
        aria-label="Selecionar nota"
        className={`mt-0.5 shrink-0 accent-violet-500 transition-opacity ${
          checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {priority.mark && (
            <span
              className={`shrink-0 font-mono text-[11px] font-bold ${priority.className}`}
              title={`Prioridade ${priority.label.toLowerCase()}`}
            >
              {priority.mark}
            </span>
          )}
          <span
            className={`truncate text-[13px] font-medium ${note.title ? "text-fg" : "text-muted"}`}
          >
            {note.title || "Sem título"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleFavorite(note.id);
            }}
            aria-label="Favoritar"
            title="Favoritar"
            className={`ml-auto shrink-0 transition-opacity ${
              note.favorite ? "" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Star
              size={13}
              className={
                note.favorite ? "fill-amber-400 text-amber-400" : "text-faint hover:text-amber-400"
              }
            />
          </button>
        </div>

        <span className="truncate text-xs text-muted">{preview(note.content) || "Nota vazia"}</span>

        <div className="flex items-center gap-2.5 font-mono text-[10px] text-faint">
          <span>{formatDate(note.updated_at)}</span>
          {progress.total > 0 && (
            <span
              className="flex items-center gap-1.5"
              title={`${progress.done} de ${progress.total} itens concluídos`}
            >
              <span className="h-1 w-8 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full ${
                    progress.done === progress.total ? "bg-emerald-400" : "accent-gradient"
                  }`}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </span>
              <span className={progress.done === progress.total ? "text-emerald-400" : ""}>
                {progress.done}/{progress.total}
              </span>
            </span>
          )}
          {note.remind_at && (
            <span className="flex items-center gap-1 text-sky-400" title="Lembrete">
              <AlarmClock size={11} />
              {formatReminder(note.remind_at)}
            </span>
          )}
        </div>
      </div>

      <div className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-md border border-line bg-raised/95 p-0.5 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
        {!isTrashed && (
          <RowAction
            label="Abrir como janela flutuante"
            onClick={() => void windowsApi.openNote(note.id)}
          >
            <ExternalLink size={13} />
          </RowAction>
        )}
        {isTrashed ? (
          <>
            <RowAction label="Restaurar" onClick={() => void restoreNote(note.id)}>
              <RotateCcw size={13} />
            </RowAction>
            <RowAction
              label="Excluir permanentemente"
              danger
              onClick={() => void deleteNotePermanently(note.id)}
            >
              <FileX2 size={13} />
            </RowAction>
          </>
        ) : (
          <>
            {isArchived ? (
              <RowAction label="Desarquivar" onClick={() => void unarchiveNote(note.id)}>
                <ArchiveRestore size={13} />
              </RowAction>
            ) : (
              <RowAction label="Arquivar" onClick={() => void archiveNote(note.id)}>
                <Archive size={13} />
              </RowAction>
            )}
            <RowAction label="Excluir" danger onClick={() => void softDeleteNote(note.id)}>
              <Trash2 size={13} />
            </RowAction>
          </>
        )}
      </div>
    </li>
  );
}
