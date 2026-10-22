import { useState } from "react";
import { AlarmClock, AlarmClockOff, Check, X } from "lucide-react";
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
    "flex h-6 items-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40";

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
          className="h-6 rounded-md border border-accent/50 bg-white/[0.04] px-1.5 font-mono text-[11px] text-fg outline-none [color-scheme:dark] focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={!draft}
          aria-label="Salvar lembrete"
          className={`${btn} px-1.5 text-emerald-400 hover:bg-emerald-400/10`}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar"
          className={`${btn} px-1.5 text-faint hover:bg-white/5 hover:text-fg`}
        >
          <X size={14} />
        </button>
      </form>
    );
  }

  if (remindAt) {
    return (
      <span className="flex items-center rounded-md border border-sky-400/25 bg-sky-400/10 text-sky-300">
        <button
          onClick={() => {
            setDraft(isoToLocalInput(remindAt));
            setEditing(true);
          }}
          disabled={disabled}
          className={`${btn} font-mono text-[11px] hover:bg-sky-400/10`}
          title="Alterar lembrete"
        >
          <AlarmClock size={13} />
          {formatReminder(remindAt)}
        </button>
        <button
          onClick={() => onChange(null)}
          disabled={disabled}
          className="grid h-6 w-6 place-items-center rounded-md text-sky-300/60 hover:bg-sky-400/10 hover:text-sky-200"
          aria-label="Remover lembrete"
          title="Remover lembrete"
        >
          <AlarmClockOff size={12} />
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
      className={`${btn} border border-dashed border-line-strong text-faint hover:border-accent/50 hover:text-fg`}
      title="Lembrete: abre a nota e notifica na hora escolhida"
    >
      <AlarmClock size={13} />
      Definir
    </button>
  );
}
