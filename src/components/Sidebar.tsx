import { useNotesStore } from "../stores/notesStore";
import type { StatusFilter } from "../types";

const STATUS_TABS: { value: StatusFilter; label: string; icon: string }[] = [
  { value: "active", label: "Ativas", icon: "📝" },
  { value: "archived", label: "Arquivadas", icon: "🗄" },
  { value: "trashed", label: "Lixeira", icon: "🗑" },
  { value: "all", label: "Todas", icon: "📚" },
];

export function Sidebar() {
  const statusFilter = useNotesStore((s) => s.statusFilter);
  const setStatusFilter = useNotesStore((s) => s.setStatusFilter);
  const favoriteOnly = useNotesStore((s) => s.favoriteOnly);
  const setFavoriteOnly = useNotesStore((s) => s.setFavoriteOnly);
  const tags = useNotesStore((s) => s.tags);
  const tagFilter = useNotesStore((s) => s.tagFilter);
  const setTagFilter = useNotesStore((s) => s.setTagFilter);

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-5 border-r border-black/10 bg-black/[0.015] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <nav className="flex flex-col gap-0.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
              statusFilter === tab.value
                ? "bg-blue-600/10 font-medium text-blue-700 dark:text-blue-300"
                : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            <span className="text-xs">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setFavoriteOnly(!favoriteOnly)}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
            favoriteOnly
              ? "bg-blue-600/10 font-medium text-blue-700 dark:text-blue-300"
              : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          <span className="text-xs text-yellow-500">★</span>
          Favoritas
        </button>
      </nav>

      {tags.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 text-xs font-medium tracking-wide uppercase opacity-40">
            Tags
          </span>
          <button
            onClick={() => setTagFilter(null)}
            className={`rounded-lg px-2.5 py-1 text-left text-sm transition-colors ${
              tagFilter === null
                ? "font-medium text-blue-700 dark:text-blue-300"
                : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            }`}
          >
            Todas as tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tag.id)}
              className={`truncate rounded-lg px-2.5 py-1 text-left text-sm transition-colors ${
                tagFilter === tag.id
                  ? "font-medium text-blue-700 dark:text-blue-300"
                  : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              }`}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
