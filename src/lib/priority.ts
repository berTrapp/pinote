// Must mirror MAX_PRIORITY validated server-side in src-tauri/src/commands/note_commands.rs.
export const PRIORITIES: { value: number; label: string; mark: string; className: string }[] = [
  { value: 0, label: "Sem prioridade", mark: "", className: "" },
  { value: 1, label: "Baixa", mark: "!", className: "text-sky-600 dark:text-sky-400" },
  { value: 2, label: "Média", mark: "!!", className: "text-amber-600 dark:text-amber-400" },
  { value: 3, label: "Alta", mark: "!!!", className: "text-red-600 dark:text-red-400" },
];

export function priorityInfo(value: number) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0];
}
