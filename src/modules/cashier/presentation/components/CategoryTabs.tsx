type CategoryTabsProps = {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
};

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Filtrar por categoria"
    >
      {categories.map((cat) => {
        const active = cat === selected;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium
              border transition-all duration-150 whitespace-nowrap
              ${active
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50'
              }
            `}
          >
            {cat}
          </button>
        );
      })}
    </nav>
  );
}
