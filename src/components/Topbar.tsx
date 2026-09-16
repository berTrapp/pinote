import { useEffect, useRef, useState } from "react";
import { useNotesStore } from "../stores/notesStore";
import { windowsApi } from "../services/windowsApi";
import type { SortBy } from "../types";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "updated_at", label: "Atualização" },
  { value: "created_at", label: "Criação" },
  { value: "priority", label: "Prioridade" },
];

export function Topbar() {
  const search = useNotesStore((s) => s.search);
  const setSearch = useNotesStore((s) => s.setSearch);
  const sortBy = useNotesStore((s) => s.sortBy);
  const sortDir = useNotesStore((s) => s.sortDir);
  const setSort = useNotesStore((s) => s.setSort);

  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 250);
  }

  return (
    <header className="flex items-center gap-2 border-b border-black/10 bg-white/60 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-black/20">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm opacity-40">
          ⌕
        </span>
        <input
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Pesquisar notas..."
          className="w-full rounded-lg border border-black/10 bg-black/[0.03] py-1.5 pr-3 pl-7 text-sm outline-none transition-colors focus:border-blue-400 dark:border-white/10 dark:bg-white/[0.06] dark:focus:border-blue-400"
        />
      </div>
      <select
        value={`${sortBy}:${sortDir}`}
        onChange={(e) => {
          const [by, dir] = e.target.value.split(":") as [SortBy, "asc" | "desc"];
          setSort(by, dir);
        }}
        className="rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/10"
      >
        {SORT_OPTIONS.map((opt) => (
          <optgroup key={opt.value} label={opt.label}>
            <option value={`${opt.value}:desc`}>{opt.label} ↓</option>
            <option value={`${opt.value}:asc`}>{opt.label} ↑</option>
          </optgroup>
        ))}
      </select>
      <button
        onClick={() => void windowsApi.createAndOpenNote()}
        title="Criar e abrir como janela flutuante (Ctrl+Alt+N)"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
      >
        + Nova nota
      </button>
    </header>
  );
}
