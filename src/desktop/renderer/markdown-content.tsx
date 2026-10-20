import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { appStrings } from '../../shared/strings.ro';
import { ExternalLink } from './external-link';

export interface MarkdownContentProps {
  /** The concept's content, as Claude wrote it. */
  source: string;
  /** Opens a link in the default browser (AD-9). */
  onOpenExternal: (url: string) => void;
}

/**
 * A concept's content as Markdown with GFM tables (AD-9): no raw HTML
 * (`skipHtml`, no rehype-raw), no image of any kind (the alt text shows as
 * plain text), and only http(s) links, which open in the browser. react-markdown
 * builds React elements, so no HTML string is ever injected.
 */
export function MarkdownContent({
  source,
  onOpenExternal,
}: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        remarkRehypeOptions={{
          footnoteLabel: appStrings.footnotesLabel,
          footnoteBackLabel: appStrings.footnoteBack,
        }}
        components={{
          a: ({ node: _node, href, children, ...rest }) =>
            // Footnote references and their back links stay in the page.
            href?.startsWith('#') ? (
              <a href={href} {...rest}>
                {children}
              </a>
            ) : (
              <ExternalLink href={href ?? ''} onOpen={onOpenExternal}>
                {children}
              </ExternalLink>
            ),
          img: ({ alt }) => <span>{alt}</span>,
          // The sheet keeps one h1: its title.
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}
