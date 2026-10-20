import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EntryCard } from './entry-card';
import { makeCategory, makeEntry } from './test-fixtures';

afterEach(cleanup);

const ai = makeCategory('c-ai', 'AI & LLM');
const imagini = makeCategory('c-img', 'Imagini & video');

describe('EntryCard in Toolbox', () => {
  const repo = makeEntry('ComfyUI', {
    url: 'https://github.com/comfyanonymous/ComfyUI',
    resourceType: 'repo',
    githubStars: 137654,
    githubPushedAt: '2026-10-15T12:00:00.000Z',
    situations: ['una', 'doua', 'trei', 'patru'],
    verificationNotes: [{ code: 'github_abandoned' }],
    categories: [ai, imagini],
  });

  it('shows the GitHub host, the type, two situations with their label and the footer', () => {
    const { container } = render(
      <EntryCard entry={repo} slot={5} index={0} tabIndex={0} />,
    );

    expect(screen.getByRole('button', { name: 'ComfyUI' })).toBeTruthy();
    expect(screen.getByText('github.com/comfyanonymous')).toBeTruthy();
    expect(screen.getByText('repo')).toBeTruthy();
    expect(screen.getByText('Când o folosesc')).toBeTruthy();
    expect(
      [...container.querySelectorAll('.situation-item')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['una', 'doua']);
    // The first category names the card; the second shows as „+1”.
    expect(container.querySelector('.entry-card-category')?.textContent).toBe(
      'AI & LLM',
    );
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('notă de verificare')).toBeTruthy();
    expect(screen.getByText('137,7k · 15.10.2026')).toBeTruthy();
    expect(screen.getByText('+2 situații')).toBeTruthy();
    // The stamp is only for Learn.
    expect(container.querySelector('.kind-stamp')).toBeNull();
  });

  it('leaves out the stars item and the flag when there is nothing to show', () => {
    const { container } = render(
      <EntryCard
        entry={makeEntry('Squoosh', {
          url: 'https://www.squoosh.app/',
          resourceType: 'site',
          situations: ['una'],
          categories: [imagini],
        })}
        slot={9}
        index={4}
        tabIndex={-1}
      />,
    );

    expect(screen.getByText('squoosh.app')).toBeTruthy();
    expect(container.querySelector('.entry-card-stars')).toBeNull();
    expect(container.querySelector('.verification-flag')).toBeNull();
    expect(container.querySelector('.entry-card-more-situations')).toBeNull();
    expect(container.querySelector('.entry-card-more-categories')).toBeNull();
  });

  it('carries the color slot and the tab position as attributes', () => {
    render(<EntryCard entry={repo} slot={5} index={4} tabIndex={-1} />);

    const card = screen.getByRole('button', { name: 'ComfyUI' });
    expect(card.getAttribute('data-slot')).toBe('5');
    // Neighbouring cards alternate over three tab positions.
    expect(card.getAttribute('data-tab')).toBe('1');
    expect(card.getAttribute('tabindex')).toBe('-1');
  });
});

describe('EntryCard in Learn', () => {
  it('shows an umbrella with its children, the stamp and one situation without a label', () => {
    const { container } = render(
      <EntryCard
        entry={makeEntry('Tipuri de API', {
          zone: 'learn',
          childIds: ['a', 'b', 'c'],
          situations: ['una', 'doua', 'trei', 'patru'],
          categories: [makeCategory('c-api', 'Backend & API-uri', 'learn')],
        })}
        slot={1}
        index={0}
        tabIndex={0}
      />,
    );

    expect(screen.getByText('umbrelă · 3 copii')).toBeTruthy();
    expect(container.querySelector('.kind-stamp')?.textContent).toBe('concept');
    expect(container.querySelectorAll('.situation-item')).toHaveLength(1);
    expect(screen.queryByText('Când îl aleg')).toBeNull();
    expect(screen.getByText('+3 situații')).toBeTruthy();
  });

  it('keeps an empty meta row for a concept without link or children', () => {
    const { container } = render(
      <EntryCard
        entry={makeEntry('Webhook', { zone: 'learn' })}
        slot={null}
        index={0}
        tabIndex={0}
      />,
    );

    const meta = container.querySelector('.entry-card-meta');
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toBe('');
  });

  it('stamps a material and shows its host', () => {
    const { container } = render(
      <EntryCard
        entry={makeEntry('Curs', {
          zone: 'learn',
          kind: 'material',
          url: 'https://www.example.org/curs',
          resourceType: 'site',
        })}
        slot={2}
        index={1}
        tabIndex={0}
      />,
    );

    expect(
      container.querySelector('.kind-stamp')?.getAttribute('data-kind'),
    ).toBe('material');
    expect(screen.getByText('example.org')).toBeTruthy();
  });
});
