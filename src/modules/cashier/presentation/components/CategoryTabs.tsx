type CategoryTabsProps = {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
};

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1"
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
              flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold
              border transition-all duration-150 whitespace-nowrap min-h-[44px]
              ${active
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 border-cyan-500 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50'
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
