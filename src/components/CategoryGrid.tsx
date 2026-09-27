import { MATERIAL_CATEGORIES, type MaterialCategory } from '../data/models';
import { CATEGORY_ICONS } from '../i18n/strings';

interface Props {
  selected?: MaterialCategory;
  onSelect: (c: MaterialCategory) => void;
  nameOf: (c: MaterialCategory) => string;
}

/** Icon grid instead of a dropdown — readable for low-literacy users. */
export function CategoryGrid({ selected, onSelect, nameOf }: Props) {
  return (
    <div className="category-grid grid grid-cols-2 gap-2">
      {MATERIAL_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          className={`category-tile btn flex flex-col items-center p-3 ${selected === c ? 'is-selected ring-2' : ''}`}
          aria-pressed={selected === c}
          onClick={() => onSelect(c)}
        >
          <span className="category-icon text-4xl" aria-hidden="true">
            {CATEGORY_ICONS[c]}
          </span>
          <span className="category-name text-sm">{nameOf(c)}</span>
        </button>
      ))}
    </div>
  );
}
