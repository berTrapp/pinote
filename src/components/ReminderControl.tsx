import { useState } from "react";
import { formatReminder, isoToLocalInput, localInputToIso } from "../lib/reminder";

export function ReminderControl({
  remindAt,
  onChange,
  disabled,
}: {
  remindAt: string | null;
  onChange: (remindAt: string | null) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const btn =
    "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors hover:bg-black/5 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/10";

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft) return;
          onChange(localInputToIso(draft));
          setEditing(false);
        }}
      >
        <input
          type="datetime-local"
          value={draft}
          min={isoToLocalInput(new Date().toISOString())}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          className="rounded border border-black/10 bg-transparent px-1 text-xs outline-none dark:border-white/10"
        />
        <button type="submit" disabled={!draft} className={`${btn} text-blue-600`}>
          OK
        </button>
        <button type="button" onClick={() => setEditing(false)} className={`${btn} opacity-60`}>
          ×
        </button>
      </form>
    );
  }

  if (remindAt) {
    return (
      <span className="flex items-center gap-0.5 rounded-md bg-blue-600/10 text-xs text-blue-700 dark:text-blue-300">
        <button
          onClick={() => {
            setDraft(isoToLocalInput(remindAt));
            setEditing(true);
          }}
          disabled={disabled}
          className={btn}
          title="Alterar lembrete"
        >
          ⏰ {formatReminder(remindAt)}
        </button>
        <button
          onClick={() => onChange(null)}
          disabled={disabled}
          className="pr-1.5 opacity-60 hover:opacity-100"
          aria-label="Remover lembrete"
          title="Remover lembrete"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft("");
        setEditing(true);
      }}
      disabled={disabled}
      className={`${btn} opacity-60 hover:opacity-100`}
      title="Lembrete: abre a nota e notifica na hora escolhida"
    >
      ⏰ Lembrete
    </button>
  );
}
