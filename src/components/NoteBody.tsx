import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  checklistProgress,
  continueChecklist,
  moveCompletedToEnd,
  removeCompletedItems,
  toggleChecklistLines,
  toggleItemAtCursor,
  type TextEdit,
} from "../lib/checklist";
import { formatNow, insertText, toggleLinePrefix, toggleWrap } from "../lib/textEdits";
import { copyToClipboard } from "../lib/clipboard";
import { MarkdownPreview } from "./MarkdownPreview";

/**
 * Note content editor. "Editar" shows the raw markdown textarea with a formatting toolbar;
 * "Visualizar" renders the markdown, with checklist lines as clickable checkboxes.
 */
export function NoteBody({
  value,
  onChange,
  onExport,
  disabled = false,
  autoFocus = false,
  className = "",
  toolbarClassName = "",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  onExport?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  toolbarClassName?: string;
  style?: CSSProperties;
}) {
  const [mode, setMode] = useState<"edit" | "view">("edit");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const sel = pendingSelectionRef.current;
    const el = textareaRef.current;
    if (!sel || !el) return;
    pendingSelectionRef.current = null;
    el.focus();
    el.setSelectionRange(sel.start, sel.end);
  }, [value, mode]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  function applyEdit(edit: TextEdit) {
    pendingSelectionRef.current = { start: edit.selStart, end: edit.selEnd };
    onChange(edit.content);
  }

  /** Runs a selection-based edit; in view mode it targets the end of the note instead. */
  function editAtSelection(fn: (content: string, start: number, end: number) => TextEdit) {
    const el = textareaRef.current;
    if (mode === "view" || !el) {
      const prefix = value && !value.endsWith("\n") ? "\n" : "";
      const base = value + prefix;
      setMode("edit");
      applyEdit(fn(base, base.length, base.length));
      return;
    }
    applyEdit(fn(value, el.selectionStart, el.selectionEnd));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      applyEdit(toggleWrap(value, el.selectionStart, el.selectionEnd, "**"));
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || el.selectionStart !== el.selectionEnd) return;
    const edit =
      e.ctrlKey || e.metaKey
        ? toggleItemAtCursor(value, el.selectionStart)
        : continueChecklist(value, el.selectionStart);
    if (!edit) return;
    e.preventDefault();
    applyEdit(edit);
  }

  function runMenuAction(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const progress = checklistProgress(value);

  const btn =
    "flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1.5 text-xs opacity-60 transition-colors hover:bg-black/5 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/10";
  const menuItem =
    "w-full rounded px-2 py-1 text-left text-xs hover:bg-black/5 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/10";

  return (
    <>
      <div className={`flex items-center gap-0.5 ${toolbarClassName}`}>
        <button
          onClick={() => editAtSelection(toggleChecklistLines)}
          disabled={disabled}
          className={btn}
          title="Checklist (Enter cria novo item, Ctrl+Enter marca/desmarca)"
        >
          ☑
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleWrap(c, s, e, "**"))}
          disabled={disabled}
          className={`${btn} font-bold`}
          title="Negrito (Ctrl+B)"
        >
          B
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleLinePrefix(c, s, e, "# "))}
          disabled={disabled}
          className={`${btn} font-semibold`}
          title="Título"
        >
          H
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleLinePrefix(c, s, e, "- "))}
          disabled={disabled}
          className={btn}
          title="Lista"
        >
          •
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => insertText(c, s, e, formatNow()))}
          disabled={disabled}
          className={btn}
          title="Inserir data e hora"
        >
          🕒
        </button>

        {progress.total > 0 && (
          <span
            className="ml-1 flex items-center gap-1.5 text-[11px] opacity-60"
            title={`${progress.done} de ${progress.total} itens concluídos`}
          >
            <span className="h-1 w-10 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
              <span
                className="block h-full rounded-full bg-green-500 transition-[width]"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </span>
            {progress.done}/{progress.total}
          </span>
        )}

        <div ref={menuRef} className="relative ml-auto">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={btn}
            title="Mais ações"
            aria-expanded={menuOpen}
          >
            {copied ? "✓" : "⋯"}
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 z-10 mt-1 flex w-48 flex-col rounded-lg border border-black/10 bg-white p-1 text-zinc-900 shadow-lg dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100">
              <button
                className={menuItem}
                onClick={() =>
                  runMenuAction(() => void copyToClipboard(value).then(() => setCopied(true)))
                }
              >
                📋 Copiar conteúdo
              </button>
              {onExport && (
                <button className={menuItem} onClick={() => runMenuAction(onExport)}>
                  ⤓ Exportar como .md
                </button>
              )}
              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
              <button
                className={menuItem}
                disabled={disabled || progress.done === 0}
                onClick={() => runMenuAction(() => onChange(removeCompletedItems(value)))}
              >
                🧹 Limpar concluídos
              </button>
              <button
                className={menuItem}
                disabled={disabled || progress.done === 0}
                onClick={() => runMenuAction(() => onChange(moveCompletedToEnd(value)))}
              >
                ⇣ Concluídos para o fim
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setMode(mode === "edit" ? "view" : "edit")}
          className={btn}
          title={mode === "edit" ? "Visualizar" : "Editar texto"}
        >
          {mode === "edit" ? "👁" : "✎"}
        </button>
      </div>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva em markdown..."
          disabled={disabled}
          autoFocus={autoFocus}
          style={style}
          className={`resize-none bg-transparent outline-none disabled:opacity-60 ${className}`}
        />
      ) : (
        <div
          onDoubleClick={() => !disabled && setMode("edit")}
          style={style}
          className={`overflow-y-auto ${className}`}
        >
          <MarkdownPreview value={value} onChange={onChange} disabled={disabled} />
        </div>
      )}
    </>
  );
}
