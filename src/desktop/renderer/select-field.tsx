import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import './select-field.css';
import './text-field.css';

export interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

/** A native `select` with the label above (DESIGN, select; the field's label style). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  error,
}: SelectFieldProps) {
  const errorId = useId();
  return (
    <div className="text-field">
      <label className="text-field-label">
        <span className="text-field-label-text">{label}</span>
        <span className="select">
          <select
            className="select-input"
            value={value}
            disabled={disabled}
            aria-invalid={error !== undefined ? true : undefined}
            aria-describedby={error !== undefined ? errorId : undefined}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" />
        </span>
      </label>
      {error !== undefined && (
        <p id={errorId} className="text-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
