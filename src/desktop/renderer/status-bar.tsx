import { appStrings } from '../../shared/strings.ro';
import './kbd.css';
import './status-bar.css';

export interface StatusBarProps {
  /** Every entry of the catalog, both zones. */
  count: number;
  /** `addedAt` of the newest entry (the snapshot comes newest first). */
  lastAddedAt: string | null;
  workspacePath: string | null;
}

/**
 * The path split before its last segment, which never shrinks. The separator
 * stays with the tail, so a cut head reads "C:\Users\…\whenkit".
 */
export function splitPath(path: string): { head: string; tail: string } {
  const cut = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  if (cut < 0) return { head: '', tail: path };
  return { head: path.slice(0, cut), tail: path.slice(cut) };
}

export function StatusBar({
  count,
  lastAddedAt,
  workspacePath,
}: StatusBarProps) {
  const path = workspacePath === null ? null : splitPath(workspacePath);
  return (
    <footer className="status-bar" aria-label={appStrings.statusLabel}>
      <span className="status-state">
        <i className="status-dot" aria-hidden="true" />
        {appStrings.statusUpToDate}
      </span>
      <span className="status-counters">
        {appStrings.statusSummary(count, lastAddedAt)}
      </span>
      {path !== null && workspacePath !== null && (
        <span className="status-path" title={workspacePath}>
          <span className="status-path-head">{path.head}</span>
          <span className="status-path-tail">{path.tail}</span>
        </span>
      )}
      <span className="status-keys">
        {appStrings.listKeyHints.map((hint) => (
          <span key={hint.keys}>
            <kbd className="kbd">{hint.keys}</kbd>
            {hint.action}
          </span>
        ))}
      </span>
    </footer>
  );
}
