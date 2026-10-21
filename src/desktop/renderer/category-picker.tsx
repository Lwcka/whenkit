import { useId } from 'react';
import type { CategoryDto } from '../../shared/ipc';
import './category-bar.css';
import './category-picker.css';
import './text-field.css';

/** How many categories an entry may have (AD-5). */
export const MAX_CATEGORIES = 2;

export interface CategoryPickerProps {
  /** The categories of the entry's zone. */
  categories: readonly CategoryDto[];
  /** The color slot of every category, by id. */
  slots: ReadonlyMap<string, number>;
  /** The ids chosen, in the order they were chosen. */
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  ariaLabel: string;
  disabled?: boolean;
  error?: string;
}

/**
 * The category chips of an entry (DESIGN, category-picker): 1 or 2 of them are
 * pressed, and once two are, the others cannot be chosen. A click or Space on
 * a chip toggles it.
 */
export function CategoryPicker({
  categories,
  slots,
  selected,
  onChange,
  ariaLabel,
  disabled,
  error,
}: CategoryPickerProps) {
  const errorId = useId();
  const full = selected.length >= MAX_CATEGORIES;
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((candidate) => candidate !== id)
        : [...selected, id],
    );
  return (
    <div className="text-field">
      <div className="category-picker" role="group" aria-label={ariaLabel}>
        {categories.map((category) => {
          const pressed = selected.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              className="category-chip"
              aria-pressed={pressed}
              aria-invalid={error !== undefined ? true : undefined}
              aria-describedby={error !== undefined ? errorId : undefined}
              disabled={disabled === true || (full && !pressed)}
              data-slot={slots.get(category.id) ?? undefined}
              onClick={() => toggle(category.id)}
            >
              <i className="category-chip-dot" aria-hidden="true" />
              {category.name}
            </button>
          );
        })}
      </div>
      {error !== undefined && (
        <p id={errorId} className="text-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
