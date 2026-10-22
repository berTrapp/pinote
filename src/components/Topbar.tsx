import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, Plus, Search } from "lucide-react";
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    // Ctrl+K jumps to search from anywhere in the manager
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 250);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
      <div className="flex w-52 shrink-0 items-center gap-2.5">
        <span className="accent-gradient grid h-7 w-7 place-items-center rounded-lg shadow-[0_0_20px_-4px] shadow-accent/60">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[3px] bg-white/90" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">pinote</span>
        <span className="font-mono text-[10px] text-faint">v0.1</span>
      </div>

      <div className="group relative max-w-xl flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint transition-colors group-focus-within:text-accent"
        />
        <input
          ref={searchRef}
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          placeholder="Buscar notas…"
          className="h-9 w-full rounded-lg border border-line bg-white/[0.03] pr-16 pl-9 text-sm text-fg outline-none transition-all placeholder:text-faint focus:border-accent/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-accent/10"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
          <kbd className="kbd">Ctrl K</kbd>
        </span>
      </div>

      <label className="relative flex items-center">
        <ArrowDownWideNarrow
          size={14}
          className="pointer-events-none absolute left-2.5 text-faint"
        />
        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(":") as [SortBy, "asc" | "desc"];
            setSort(by, dir);
          }}
          title="Ordenar"
          className="h-9 appearance-none rounded-lg border border-line bg-white/[0.03] pr-3 pl-8 text-xs text-muted outline-none transition-colors hover:text-fg focus:border-accent/60"
        >
          {SORT_OPTIONS.map((opt) => (
            <optgroup key={opt.value} label={opt.label}>
              <option value={`${opt.value}:desc`}>{opt.label} ↓</option>
              <option value={`${opt.value}:asc`}>{opt.label} ↑</option>
            </optgroup>
          ))}
        </select>
      </label>

      <button
        onClick={() => void windowsApi.createAndOpenNote()}
        title="Criar e abrir como janela flutuante"
        className="accent-gradient ml-auto flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium text-white shadow-[0_4px_24px_-6px] shadow-accent/60 transition-all hover:brightness-110 active:scale-[0.98]"
      >
        <Plus size={16} strokeWidth={2.5} />
        Nova nota
        <kbd className="kbd border-white/25 bg-white/10 text-white/80">Ctrl Alt N</kbd>
      </button>
    </header>
  );
}
