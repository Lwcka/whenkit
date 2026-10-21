import { useId, type KeyboardEvent, type Ref } from 'react';
import './text-field.css';

export interface TextFieldProps {
  /** The visible label above the field; without it `ariaLabel` names the field. */
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  /** A multi-line field (`textarea`). */
  multiline?: boolean;
  rows?: number;
  /** Monospace text (a URL). */
  mono?: boolean;
  /** The message under the field; the field is then invalid. */
  error?: string;
  /** The field is invalid because of an error shown elsewhere (the list's); `describedBy` points at it. */
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** The `input` of a single-line field. */
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * A text field (DESIGN, text-field): the label above, the field, and the error
 * under it. The error is an alert, so it is announced when it appears, and the
 * field points at it with `aria-describedby`.
 */
export function TextField({
  label,
  ariaLabel,
  value,
  onChange,
  multiline = false,
  rows = 3,
  mono = false,
  error,
  invalid = false,
  describedBy,
  disabled,
  inputRef,
  onKeyDown,
}: TextFieldProps) {
  const errorId = useId();
  const shared = {
    className: 'text-field-input',
    'data-mono': mono ? '' : undefined,
    value,
    disabled,
    'aria-label': label === undefined ? ariaLabel : undefined,
    'aria-invalid': error !== undefined || invalid ? true : undefined,
    'aria-describedby': error !== undefined ? errorId : describedBy,
  };
  const control = multiline ? (
    <textarea
      {...shared}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
    />
  ) : (
    <input
      {...shared}
      ref={inputRef}
      type="text"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
    />
  );
  return (
    <div className="text-field">
      {label !== undefined ? (
        <label className="text-field-label">
          <span className="text-field-label-text">{label}</span>
          {control}
        </label>
      ) : (
        control
      )}
      {error !== undefined && (
        <p id={errorId} className="text-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
