import type { TextEdit } from "./checklist";

export function insertText(
  content: string,
  selStart: number,
  selEnd: number,
  text: string,
): TextEdit {
  const pos = selStart + text.length;
  return {
    content: content.slice(0, selStart) + text + content.slice(selEnd),
    selStart: pos,
    selEnd: pos,
  };
}

/** Wraps the selection in `marker` (e.g. "**"), or unwraps it if it is already wrapped. */
export function toggleWrap(
  content: string,
  selStart: number,
  selEnd: number,
  marker: string,
): TextEdit {
  const before = content.slice(selStart - marker.length, selStart);
  const after = content.slice(selEnd, selEnd + marker.length);
  if (before === marker && after === marker) {
    return {
      content:
        content.slice(0, selStart - marker.length) +
        content.slice(selStart, selEnd) +
        content.slice(selEnd + marker.length),
      selStart: selStart - marker.length,
      selEnd: selEnd - marker.length,
    };
  }
  return {
    content:
      content.slice(0, selStart) +
      marker +
      content.slice(selStart, selEnd) +
      marker +
      content.slice(selEnd),
    selStart: selStart + marker.length,
    selEnd: selEnd + marker.length,
  };
}

/**
 * Adds `prefix` (e.g. "# " or "- ") to every line touched by the selection, or removes it
 * when all of them already start with it.
 */
export function toggleLinePrefix(
  content: string,
  selStart: number,
  selEnd: number,
  prefix: string,
): TextEdit {
  const start = content.lastIndexOf("\n", selStart - 1) + 1;
  const newline = content.indexOf("\n", selEnd);
  const end = newline === -1 ? content.length : newline;
  const lines = content.slice(start, end).split("\n");
  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const block = lines.map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l)).join("\n");
  const next = content.slice(0, start) + block + content.slice(end);
  if (lines.length === 1) {
    const delta = allPrefixed ? -prefix.length : prefix.length;
    const clamp = (pos: number) => Math.max(pos + delta, start);
    return { content: next, selStart: clamp(selStart), selEnd: clamp(selEnd) };
  }
  return { content: next, selStart: start, selEnd: start + block.length };
}

export function formatNow(): string {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
