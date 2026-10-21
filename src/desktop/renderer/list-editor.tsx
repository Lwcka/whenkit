import { Plus, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { appStrings, rowNumber } from '../../shared/strings.ro';
import { Button } from './button';
import { TextField } from './text-field';
import './list-editor.css';

export interface ListEditorProps {
  rows: readonly string[];
  onChange: (rows: string[]) => void;
  /** The accessible name of a row, from its 1-based number. */
  rowLabel: (number: number) => string;
  /** The text of the „Adaugă …” button. */
  addLabel: string;
  /** Rows show their number („01”); the situations do. */
  numbered?: boolean;
  /** Monospace rows (URLs). */
  mono?: boolean;
  /** At least this many rows stay: the × of the last ones is disabled. */
  minRows?: number;
  disabled?: boolean;
  /** An error about the list as a whole, under the add button. */
  error?: string;
  /** An error about one row, by its index. */
  rowErrors?: Readonly<Record<number, string>>;
}

/**
 * A list of text rows, one per line (DESIGN, list-editor): each row has its
 * own × (no confirmation), „Adaugă …” appends an empty row and focuses it,
 * and Enter in the last row does the same. Empty rows are the form's to
 * ignore, so nothing here drops them.
 */
export function ListEditor({
  rows,
  onChange,
  rowLabel,
  addLabel,
  numbered = false,
  mono = false,
  minRows = 0,
  disabled,
  error,
  rowErrors = {},
}: ListEditorProps) {
  const errorId = useId();
  const list = useRef<HTMLUListElement>(null);
  // The row to focus once the list has re-rendered (a new row, or the one
  // that took the place of a removed one).
  const focusRow = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusRow.current === null) return;
    const inputs = list.current?.querySelectorAll<HTMLInputElement>('input');
    inputs?.[focusRow.current]?.focus();
    focusRow.current = null;
  });

  const add = () => {
    focusRow.current = rows.length;
    onChange([...rows, '']);
  };
  const remove = (index: number) => {
    focusRow.current = Math.min(index, rows.length - 2);
    onChange(rows.filter((_, candidate) => candidate !== index));
  };
  const edit = (index: number, value: string) =>
    onChange(rows.map((row, candidate) => (candidate === index ? value : row)));

  return (
    <div className="list-editor">
      <ul
        ref={list}
        className="list-editor-rows"
        data-numbered={numbered ? '' : undefined}
      >
        {rows.map((row, index) => (
          <li key={index} className="list-editor-row">
            {numbered && (
              <span className="list-editor-number" aria-hidden="true">
                {rowNumber(index)}
              </span>
            )}
            <TextField
              ariaLabel={rowLabel(index + 1)}
              value={row}
              mono={mono}
              disabled={disabled}
              error={rowErrors[index]}
              invalid={error !== undefined}
              describedBy={error !== undefined ? errorId : undefined}
              onChange={(value) => edit(index, value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (index === rows.length - 1) add();
              }}
            />
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              title={appStrings.removeRow}
              disabled={disabled === true || rows.length <= minRows}
              onClick={() => remove(index)}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button variant="ghost" icon={Plus} disabled={disabled} onClick={add}>
          {addLabel}
        </Button>
      </div>
      {error !== undefined && (
        <p id={errorId} className="text-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
