import type { ReactNode } from "react";
import { parseChecklistLine, toggleChecklistItem } from "../lib/checklist";

// **bold**, *italic* / _italic_, `code` — just the inline bits the toolbar can produce.
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded border border-line bg-white/[0.06] px-1 font-mono text-[0.85em] text-violet-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^(\*[^*].*\*|_[^_].*_)$/.test(part)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

const HEADING_CLASS = [
  "",
  "mt-2 text-[1.4em] font-semibold tracking-tight text-fg",
  "mt-1.5 text-[1.2em] font-semibold tracking-tight text-fg",
  "font-semibold",
];

/** Read-only rendering of a note's markdown; checklist boxes stay clickable. */
export function MarkdownPreview({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  if (!value.trim()) return <span className="text-faint">Nota vazia</span>;

  return value.split("\n").map((line, i) => {
    const item = parseChecklistLine(line);
    if (item) {
      return (
        <label
          key={i}
          className="flex cursor-pointer items-start gap-2"
          style={{ paddingLeft: `${item.indent.length * 0.5}em` }}
        >
          <input
            type="checkbox"
            checked={item.checked}
            disabled={disabled}
            onChange={() => onChange(toggleChecklistItem(value, i))}
            className="mt-[0.35em] shrink-0 accent-violet-500"
          />
          <span
            className={`whitespace-pre-wrap ${item.checked ? "text-faint line-through decoration-faint" : ""}`}
          >
            {item.text ? renderInline(item.text) : " "}
          </span>
        </label>
      );
    }

    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) {
      return (
        <div key={i} className={`${HEADING_CLASS[heading[1].length]} select-text`}>
          {renderInline(heading[2])}
        </div>
      );
    }

    const bullet = /^(\s*)[-*] (.*)$/.exec(line);
    if (bullet) {
      return (
        <div
          key={i}
          className="flex gap-2 select-text"
          style={{ paddingLeft: `${bullet[1].length * 0.5}em` }}
        >
          <span className="text-accent">•</span>
          <span className="whitespace-pre-wrap">{renderInline(bullet[2])}</span>
        </div>
      );
    }

    return (
      <div key={i} className="whitespace-pre-wrap select-text">
        {line ? renderInline(line) : " "}
      </div>
    );
  });
}
