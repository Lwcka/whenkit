import { TriangleAlert } from 'lucide-react';
import { appStrings } from '../../shared/strings.ro';
import { Button } from './button';
import './conflict-banner.css';

export interface ConflictBannerProps {
  /** „Reîncarcă fișa”: asks to take the entry as it is now. */
  onReload: () => void;
}

/**
 * The strip over the form when the entry changed in the terminal during the
 * edit (DESIGN, conflict-banner). It is an alert: it is announced when it
 * appears, and it stays until the edit ends or the entry is reloaded.
 */
export function ConflictBanner({ onReload }: ConflictBannerProps) {
  return (
    <div className="conflict-banner" role="alert">
      <TriangleAlert aria-hidden="true" />
      <p className="conflict-banner-text">{appStrings.conflictText}</p>
      <Button onClick={onReload}>{appStrings.reloadEntry}</Button>
    </div>
  );
}
