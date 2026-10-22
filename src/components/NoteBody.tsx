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
import {
  ArrowDownToLine,
  Bold,
  Check,
  Clock,
  Copy,
  Download,
  Eraser,
  Eye,
  Heading,
  List,
  ListChecks,
  MoreHorizontal,
  PencilLine,
} from "lucide-react";

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
  compact = false,
  className = "",
  toolbarClassName = "",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  onExport?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Narrow layout for floating windows: no progress bar, single edit/view toggle. */
  compact?: boolean;
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

  const menuItem =
    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs text-fg/90 transition-colors hover:bg-white/[0.07] disabled:pointer-events-none disabled:opacity-35";
  const modeBtn = (active: boolean) =>
    `grid h-6 w-7 place-items-center rounded-md transition-colors ${
      active ? "bg-white/10 text-fg shadow-sm" : "text-faint hover:text-muted"
    }`;

  return (
    <>
      <div className={`flex shrink-0 items-center gap-0.5 ${toolbarClassName}`}>
        <button
          onClick={() => editAtSelection(toggleChecklistLines)}
          disabled={disabled}
          className="icon-btn"
          aria-label="Checklist"
          title="Checklist (Enter cria novo item, Ctrl+Enter marca/desmarca)"
        >
          <ListChecks size={15} />
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleWrap(c, s, e, "**"))}
          disabled={disabled}
          className="icon-btn"
          aria-label="Negrito"
          title="Negrito (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleLinePrefix(c, s, e, "# "))}
          disabled={disabled}
          className="icon-btn"
          aria-label="Título"
          title="Título"
        >
          <Heading size={14} />
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => toggleLinePrefix(c, s, e, "- "))}
          disabled={disabled}
          className="icon-btn"
          aria-label="Lista"
          title="Lista"
        >
          <List size={15} />
        </button>
        <button
          onClick={() => editAtSelection((c, s, e) => insertText(c, s, e, formatNow()))}
          disabled={disabled}
          className="icon-btn"
          aria-label="Inserir data e hora"
          title="Inserir data e hora"
        >
          <Clock size={14} />
        </button>

        {progress.total > 0 && (
          <span
            className={`flex items-center gap-2 font-mono text-[10px] text-faint ${compact ? "ml-1" : "ml-2"}`}
            title={`${progress.done} de ${progress.total} itens concluídos`}
          >
            <span
              className={`h-1 w-12 overflow-hidden rounded-full bg-white/10 ${compact ? "hidden" : ""}`}
            >
              <span
                className={`block h-full rounded-full transition-[width] duration-300 ${
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

        <div ref={menuRef} className="relative ml-auto">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="icon-btn"
            aria-label="Mais ações"
            title="Mais ações"
            aria-expanded={menuOpen}
          >
            {copied ? (
              <Check size={15} className="text-emerald-400" />
            ) : (
              <MoreHorizontal size={15} />
            )}
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 z-20 mt-1.5 flex w-52 flex-col rounded-xl border border-line-strong bg-overlay/95 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <button
                className={menuItem}
                onClick={() =>
                  runMenuAction(() => void copyToClipboard(value).then(() => setCopied(true)))
                }
              >
                <Copy size={13} className="text-muted" />
                Copiar conteúdo
              </button>
              {onExport && (
                <button className={menuItem} onClick={() => runMenuAction(onExport)}>
                  <Download size={13} className="text-muted" />
                  Exportar como .md
                </button>
              )}
              <div className="mx-1 my-1 h-px bg-line" />
              <button
                className={menuItem}
                disabled={disabled || progress.done === 0}
                onClick={() => runMenuAction(() => onChange(removeCompletedItems(value)))}
              >
                <Eraser size={13} className="text-muted" />
                Limpar concluídos
              </button>
              <button
                className={menuItem}
                disabled={disabled || progress.done === 0}
                onClick={() => runMenuAction(() => onChange(moveCompletedToEnd(value)))}
              >
                <ArrowDownToLine size={13} className="text-muted" />
                Concluídos para o fim
              </button>
            </div>
          )}
        </div>
        {compact ? (
          <button
            onClick={() => setMode(mode === "edit" ? "view" : "edit")}
            className="icon-btn"
            aria-label={mode === "edit" ? "Visualizar" : "Editar texto"}
            title={mode === "edit" ? "Visualizar" : "Editar texto"}
          >
            {mode === "edit" ? <Eye size={14} /> : <PencilLine size={14} />}
          </button>
        ) : (
          <div className="ml-1 flex rounded-lg border border-line bg-white/[0.02] p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={modeBtn(mode === "edit")}
              aria-label="Editar texto"
              title="Editar texto"
            >
              <PencilLine size={13} />
            </button>
            <button
              onClick={() => setMode("view")}
              className={modeBtn(mode === "view")}
              aria-label="Visualizar"
              title="Visualizar"
            >
              <Eye size={13} />
            </button>
          </div>
        )}
      </div>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Comece a escrever… (markdown)"
          disabled={disabled}
          autoFocus={autoFocus}
          style={style}
          className={`resize-none bg-transparent outline-none placeholder:text-faint disabled:opacity-60 ${className}`}
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
