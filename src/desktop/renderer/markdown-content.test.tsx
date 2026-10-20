import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownContent } from './markdown-content';

afterEach(cleanup);

function markdown(source: string, onOpenExternal = vi.fn()) {
  const view = render(
    <MarkdownContent source={source} onOpenExternal={onOpenExternal} />,
  );
  return { ...view, onOpenExternal };
}

describe('MarkdownContent', () => {
  it('renders a GFM table with a header row', () => {
    const view = markdown('| A | B |\n| - | - |\n| 1 | 2 |\n');
    const table = view.container.querySelector('table');
    expect(table).not.toBeNull();
    expect(
      [...table!.querySelectorAll('thead th')].map((th) => th.textContent),
    ).toEqual(['A', 'B']);
    expect(
      [...table!.querySelectorAll('tbody td')].map((td) => td.textContent),
    ).toEqual(['1', '2']);
  });

  it('drops raw HTML: nothing executes and no script or b element exists', () => {
    const view = markdown('<script>window.__ran = 1</script>\n\n<b>x</b>\n');
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.querySelector('b')).toBeNull();
    expect((window as unknown as { __ran?: number }).__ran).toBeUndefined();
  });

  it('shows an image as its alt text, with no img element', () => {
    const view = markdown(
      '![logo](https://x.test/a.png) ![inline](data:image/png;base64,AAAA)',
    );
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.textContent).toContain('logo');
    expect(view.container.textContent).toContain('inline');
  });

  it('shows a link that is not http(s) as plain text', () => {
    const view = markdown(
      '[x](javascript:alert(1)) [y](file:///C:/a) [z](mailto:a@b) [w](/rel)',
    );
    expect(view.container.querySelector('a')).toBeNull();
    expect(view.container.textContent).toBe('x y z w');
  });

  it('opens an https link through onOpenExternal and cancels the navigation', () => {
    const view = markdown('[docs](https://react.dev)');
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link.getAttribute('href')).toBe('https://react.dev');
    expect(link.querySelector('svg')).not.toBeNull();
    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.click(link)).toBe(false);
    expect(view.onOpenExternal).toHaveBeenCalledWith('https://react.dev');
  });

  it('labels footnotes in Romanian, never in English', () => {
    const view = markdown('Text[^1] și iar[^1].\n\n[^1]: Nota.');
    const text = view.container.textContent;
    expect(text).toContain('Note');
    expect(text).not.toContain('Footnotes');
    const labels = [
      ...view.container.querySelectorAll('[data-footnote-backref]'),
    ].map((link) => link.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Înapoi la referința 1',
      'Înapoi la referința 1-2',
    ]);
    expect(view.container.innerHTML).not.toContain('Back to reference');
  });

  it('keeps one h1 on the sheet by turning a Markdown h1 into h2', () => {
    const view = markdown('# Titlu\n\n## Alt titlu');
    expect(view.container.querySelector('h1')).toBeNull();
    expect(view.container.querySelectorAll('h2')).toHaveLength(2);
  });
});
