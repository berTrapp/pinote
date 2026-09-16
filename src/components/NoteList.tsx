import type { MouseEvent } from "react";
import { useNotesStore } from "../stores/notesStore";
import { windowsApi } from "../services/windowsApi";
import type { Note } from "../types";

function preview(content: string): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  return firstLine?.slice(0, 120) ?? "";
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

  const allSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));

  if (loading && notes.length === 0) {
    return <div className="p-6 text-center text-sm opacity-40">Carregando...</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
        <span className="text-2xl opacity-20">🗒</span>
        <span className="text-sm opacity-50">Nenhuma nota encontrada.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 border-b border-black/10 bg-blue-600/10 px-3 py-1.5 text-xs dark:border-white/10">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected;
            }}
            onChange={toggleSelectAll}
            aria-label="Selecionar todas"
            title="Selecionar todas"
            className="accent-blue-600"
          />
          <span className="font-medium">{selectedIds.size} selecionada(s)</span>
          <button
            onClick={() => void bulkDeleteSelected()}
            className="ml-auto font-medium text-red-500 hover:text-red-600"
          >
            Excluir
          </button>
          <button onClick={clearBulkSelection} className="opacity-70 hover:opacity-100">
            Cancelar
          </button>
        </div>
      )}
      <ul className="flex flex-1 flex-col overflow-y-auto">
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

  const iconBtn = "opacity-0 transition-opacity group-hover:opacity-100";
  const iconBtnDanger = "opacity-0 text-red-500 transition-opacity group-hover:opacity-100";

  function stop(e: MouseEvent, action: () => void) {
    e.stopPropagation();
    action();
  }

  return (
    <li className="group flex items-center gap-1 border-b border-black/5 dark:border-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleChecked}
        onClick={(e) => e.stopPropagation()}
        aria-label="Selecionar nota"
        className="ml-3 shrink-0 accent-blue-600"
      />
      <button
        onClick={onSelect}
        className={`flex flex-1 flex-col gap-0.5 px-2 py-2.5 text-left transition-colors ${
          selected ? "bg-blue-600/10" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {note.background_color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: note.background_color }}
              />
            )}
            <span className="truncate text-sm font-medium">{note.title || "Sem título"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs">
            {!isTrashed && (
              <button
                onClick={(e) => stop(e, () => void windowsApi.openNote(note.id))}
                aria-label="Abrir como janela flutuante"
                title="Abrir como janela flutuante"
                className={iconBtn}
              >
                ↗
              </button>
            )}

            {isTrashed ? (
              <>
                <button
                  onClick={(e) => stop(e, () => void restoreNote(note.id))}
                  aria-label="Restaurar"
                  title="Restaurar"
                  className={iconBtn}
                >
                  ↺
                </button>
                <button
                  onClick={(e) => stop(e, () => void deleteNotePermanently(note.id))}
                  aria-label="Excluir permanentemente"
                  title="Excluir permanentemente"
                  className={iconBtnDanger}
                >
                  ⌫
                </button>
              </>
            ) : (
              <>
                {isArchived ? (
                  <button
                    onClick={(e) => stop(e, () => void unarchiveNote(note.id))}
                    aria-label="Desarquivar"
                    title="Desarquivar"
                    className={iconBtn}
                  >
                    ↺
                  </button>
                ) : (
                  <button
                    onClick={(e) => stop(e, () => void archiveNote(note.id))}
                    aria-label="Arquivar"
                    title="Arquivar"
                    className={iconBtn}
                  >
                    🗄
                  </button>
                )}
                <button
                  onClick={(e) => stop(e, () => void softDeleteNote(note.id))}
                  aria-label="Excluir"
                  title="Excluir"
                  className={iconBtnDanger}
                >
                  🗑
                </button>
              </>
            )}

            <button
              onClick={(e) => stop(e, () => void toggleFavorite(note.id))}
              aria-label="Favoritar"
              title="Favoritar"
              className={note.favorite ? "text-yellow-500" : "opacity-20 hover:opacity-60"}
            >
              ★
            </button>
          </span>
        </div>
        <span className="truncate text-xs opacity-60">{preview(note.content) || "Nota vazia"}</span>
        <span className="text-[11px] opacity-40">{formatDate(note.updated_at)}</span>
      </button>
    </li>
  );
}
