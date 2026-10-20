import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { isExternalUrl } from '../../shared/ipc';

export interface ExternalLinkProps {
  href: string;
  /** Asks main to open `href` in the default browser (AD-9). */
  onOpen: (url: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * A link to the outside (DESIGN, markdown-content: accent with ↗). Only
 * `http:`/`https:` become links; any other text stays plain, so a `file:` or
 * `javascript:` string is never clickable (AD-9). The click never navigates
 * the window: it is cancelled and main opens the browser.
 */
export function ExternalLink({
  href,
  onOpen,
  children,
  className,
}: ExternalLinkProps) {
  if (!isExternalUrl(href))
    return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      className={className ? `external-link ${className}` : 'external-link'}
      onClick={(event) => {
        event.preventDefault();
        onOpen(href);
      }}
    >
      {children}
      <ExternalLinkIcon aria-hidden="true" className="icon-sm" />
    </a>
  );
}
