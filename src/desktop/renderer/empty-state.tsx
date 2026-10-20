import './empty-state.css';

export interface EmptyStateProps {
  /** `big` for a catalog with nothing in it; `small` for a view without entries. */
  size: 'big' | 'small';
  title: string;
  text?: string;
  /** The suggested command; `highlight` is drawn in the accent color. */
  command?: { highlight: string; rest?: string };
}

/** Centered in the work area: a target drawn in fine lines, then the words. */
export function EmptyState({ size, title, text, command }: EmptyStateProps) {
  return (
    <div className="empty-state" data-size={size}>
      <svg
        className="empty-state-target"
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="empty-state-ring" cx="60" cy="60" r="56" />
        <circle className="empty-state-ring" cx="60" cy="60" r="40" />
        <circle className="empty-state-ring" cx="60" cy="60" r="24" />
        <path
          className="empty-state-cross"
          d="M60 6v34M60 80v34M6 60h34M80 60h34"
        />
        <circle className="empty-state-center" cx="60" cy="60" r="4" />
      </svg>
      <h3 className="empty-state-title">{title}</h3>
      {text !== undefined && <p className="empty-state-text">{text}</p>}
      {command !== undefined && (
        <p className="empty-state-command">
          <span className="empty-state-command-name">{command.highlight}</span>
          {command.rest !== undefined && ` ${command.rest}`}
        </p>
      )}
    </div>
  );
}
