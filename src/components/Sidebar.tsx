import { Archive, Hash, Inbox, Layers, Star, Trash2, X, type LucideIcon } from "lucide-react";
import { useNotesStore } from "../stores/notesStore";
import type { StatusFilter } from "../types";

const STATUS_TABS: { value: StatusFilter; label: string; icon: LucideIcon }[] = [
  { value: "active", label: "Ativas", icon: Inbox },
  { value: "archived", label: "Arquivadas", icon: Archive },
  { value: "trashed", label: "Lixeira", icon: Trash2 },
  { value: "all", label: "Todas", icon: Layers },
];

function navItemClass(active: boolean) {
  return `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
    active
      ? "bg-white/[0.06] font-medium text-fg"
      : "text-muted hover:bg-white/[0.035] hover:text-fg"
  }`;
}

function ActiveMarker({ active }: { active: boolean }) {
  if (!active) return null;
  return <span className="accent-gradient absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r" />;
}

export function Sidebar() {
  const statusFilter = useNotesStore((s) => s.statusFilter);
  const setStatusFilter = useNotesStore((s) => s.setStatusFilter);
  const favoriteOnly = useNotesStore((s) => s.favoriteOnly);
  const setFavoriteOnly = useNotesStore((s) => s.setFavoriteOnly);
  const tags = useNotesStore((s) => s.tags);
  const tagFilter = useNotesStore((s) => s.tagFilter);
  const setTagFilter = useNotesStore((s) => s.setTagFilter);

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-3 py-4">
      <nav className="flex flex-col gap-0.5">
        <span className="px-2.5 pb-2 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
          Notas
        </span>
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={navItemClass(active)}
            >
              <ActiveMarker active={active} />
              <Icon size={15} className={active ? "text-accent" : ""} />
              {tab.label}
            </button>
          );
        })}
        <button
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className={navItemClass(favoriteOnly)}
        >
          <ActiveMarker active={favoriteOnly} />
          <Star
            size={15}
            className={favoriteOnly ? "fill-amber-400 text-amber-400" : "text-amber-400/70"}
          />
          Favoritas
        </button>
      </nav>

      {tags.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
              Tags
            </span>
            {tagFilter !== null && (
              <button
                onClick={() => setTagFilter(null)}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
              >
                <X size={11} />
                limpar
              </button>
            )}
          </div>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tag.id)}
              className={navItemClass(tagFilter === tag.id)}
            >
              <ActiveMarker active={tagFilter === tag.id} />
              <Hash size={14} className={tagFilter === tag.id ? "text-accent" : ""} />
              <span className="truncate">{tag.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto rounded-lg border border-line bg-white/[0.02] p-3 text-[11px] leading-relaxed text-faint">
        <span className="kbd mr-1">Ctrl Alt N</span> cria uma nota flutuante de qualquer lugar.
      </div>
    </aside>
  );
}
