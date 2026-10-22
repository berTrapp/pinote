// Checklist items live inside the note content as markdown task lines: "- [ ] todo" / "- [x] done".
const CHECKLIST_RE = /^(\s*)- \[( |x|X)\] ?(.*)$/;

export type ChecklistItem = { indent: string; checked: boolean; text: string };

export type TextEdit = { content: string; selStart: number; selEnd: number };

export function parseChecklistLine(line: string): ChecklistItem | null {
  const m = CHECKLIST_RE.exec(line);
  if (!m) return null;
  return { indent: m[1], checked: m[2] !== " ", text: m[3] };
}

function formatItem(item: ChecklistItem): string {
  return `${item.indent}- [${item.checked ? "x" : " "}] ${item.text}`;
}

function lineBounds(content: string, selStart: number, selEnd: number) {
  const start = content.lastIndexOf("\n", selStart - 1) + 1;
  const newline = content.indexOf("\n", selEnd);
  return { start, end: newline === -1 ? content.length : newline };
}

export function toggleChecklistItem(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  const item = parseChecklistLine(lines[lineIndex] ?? "");
  if (!item) return content;
  lines[lineIndex] = formatItem({ ...item, checked: !item.checked });
  return lines.join("\n");
}

/** Toggles the checked state of the checklist item under the cursor, if any. */
export function toggleItemAtCursor(content: string, cursor: number): TextEdit | null {
  const lineIndex = content.slice(0, cursor).split("\n").length - 1;
  if (!parseChecklistLine(content.split("\n")[lineIndex])) return null;
  return { content: toggleChecklistItem(content, lineIndex), selStart: cursor, selEnd: cursor };
}

/**
 * Turns the lines touched by the selection into checklist items, or back into plain text
 * when they already all are.
 */
export function toggleChecklistLines(content: string, selStart: number, selEnd: number): TextEdit {
  const { start, end } = lineBounds(content, selStart, selEnd);
  const lines = content.slice(start, end).split("\n");
  const single = lines.length === 1;
  const relevant = single ? lines : lines.filter((l) => l.trim());
  const allItems = relevant.length > 0 && relevant.every((l) => parseChecklistLine(l));

  const nextLines = lines.map((line) => {
    const item = parseChecklistLine(line);
    if (allItems) return item ? item.indent + item.text : line;
    if (item || (!single && !line.trim())) return line;
    const indent = /^\s*/.exec(line)![0];
    return formatItem({ indent, checked: false, text: line.slice(indent.length) });
  });

  const block = nextLines.join("\n");
  const next = content.slice(0, start) + block + content.slice(end);
  if (single) {
    const delta = block.length - (end - start);
    const clamp = (pos: number) => Math.min(Math.max(pos + delta, start), start + block.length);
    return { content: next, selStart: clamp(selStart), selEnd: clamp(selEnd) };
  }
  return { content: next, selStart: start, selEnd: start + block.length };
}

/**
 * Enter inside a checklist item starts a new item; Enter on an empty item ends the list.
 * Returns null when Enter should behave normally.
 */
export function continueChecklist(content: string, cursor: number): TextEdit | null {
  const { start, end } = lineBounds(content, cursor, cursor);
  const line = content.slice(start, end);
  const item = parseChecklistLine(line);
  if (!item) return null;
  const prefixLength = line.length - item.text.length;
  if (cursor - start < prefixLength) return null;

  if (!item.text.trim()) {
    const next = content.slice(0, start) + item.indent + content.slice(end);
    const pos = start + item.indent.length;
    return { content: next, selStart: pos, selEnd: pos };
  }

  const insert = `\n${formatItem({ indent: item.indent, checked: false, text: "" })}`;
  const next = content.slice(0, cursor) + insert + content.slice(cursor);
  const pos = cursor + insert.length;
  return { content: next, selStart: pos, selEnd: pos };
}

export function checklistProgress(content: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of content.split("\n")) {
    const item = parseChecklistLine(line);
    if (!item) continue;
    total++;
    if (item.checked) done++;
  }
  return { done, total };
}

export function removeCompletedItems(content: string): string {
  return content
    .split("\n")
    .filter((line) => !parseChecklistLine(line)?.checked)
    .join("\n");
}

/** Within each run of consecutive checklist lines, moves the checked items below the open ones. */
export function moveCompletedToEnd(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let open: string[] = [];
  let done: string[] = [];
  const flush = () => {
    result.push(...open, ...done);
    open = [];
    done = [];
  };
  for (const line of lines) {
    const item = parseChecklistLine(line);
    if (!item) {
      flush();
      result.push(line);
    } else if (item.checked) {
      done.push(line);
    } else {
      open.push(line);
    }
  }
  flush();
  return result.join("\n");
}
