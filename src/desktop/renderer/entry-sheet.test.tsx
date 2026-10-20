import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntryDto, IpcResult, WriteResult } from '../../shared/ipc';
import { EntrySheet } from './entry-sheet';
import { makeCategory, makeEntry } from './test-fixtures';

afterEach(cleanup);

const imagini = makeCategory('c-img', 'Imagini & video');
const ai = makeCategory('c-ai', 'AI & LLM');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const slots = new Map([
  ['c-img', 3],
  ['c-ai', 5],
  ['c-be', 2],
]);

/** An `onSaveNotes` that always succeeds. */
const savedNotes = () =>
  Promise.resolve<IpcResult<WriteResult>>({ ok: true, data: { changed: [] } });

function notesField(view: { container: HTMLElement }) {
  return view.container.querySelector('textarea') as HTMLTextAreaElement;
}

function sheet(
  entry: EntryDto,
  entries: readonly EntryDto[] = [entry],
  props: {
    pulses?: number;
    onOpen?: (id: string) => void;
    onOpenExternal?: (url: string) => void;
    onSaveNotes?: (
      id: string,
      notes: string,
    ) => Promise<IpcResult<WriteResult>>;
  } = {},
) {
  const view = render(
    <EntrySheet
      entry={entry}
      entries={entries}
      slots={slots}
      pulses={props.pulses ?? 0}
      onOpen={props.onOpen ?? (() => {})}
      onOpenExternal={props.onOpenExternal ?? (() => {})}
      onSaveNotes={props.onSaveNotes ?? savedNotes}
    />,
  );
  return {
    ...view,
    root: () => view.container.querySelector('.entry-sheet') as HTMLElement,
    text: (selector: string) =>
      view.container.querySelector(selector)?.textContent ?? null,
    texts: (selector: string) =>
      [...view.container.querySelectorAll(selector)].map(
        (node) => node.textContent,
      ),
  };
}

/** The labels of the title-block rubrics that span the whole row. */
const wideRubrics = (view: ReturnType<typeof sheet>) =>
  [...view.container.querySelectorAll('.title-block-rubric[data-wide]')].map(
    (rubric) => rubric.querySelector('small')?.textContent,
  );

const labels = (view: ReturnType<typeof sheet>) =>
  view.texts('.sheet-section-label');

describe('EntrySheet: a tool with everything', () => {
  const related = makeEntry('unscreen', {
    name: 'Unscreen',
    whatItDoes: 'Scoate fundalul din clipuri.',
    categories: [imagini],
  });
  const tool = makeEntry('1fe4aaaa-bbbb-cccc-dddd-eeeeeeee17dc', {
    name: 'remove.bg',
    url: 'https://remove.bg',
    resourceType: 'site',
    categories: [imagini, ai],
    whatItDoes: 'Scoate automat fundalul din fotografii.',
    situations: ['scot fundalul', 'poze de produs', 'logo transparent', 'API'],
    keywords: ['fundal', 'background'],
    relatedIds: ['unscreen', 'ghost'],
    myNotes: 'Gratuit doar la rezoluție mică.',
    githubStars: 137654,
    githubPushedAt: '2026-10-15T12:00:00.000Z',
    verificationNotes: [
      { code: 'github_abandoned', params: { pushedAt: '2024-01-02' } },
    ],
    verifiedAt: '2026-10-15T12:00:00.000Z',
    addedAt: '2026-10-14T12:00:00.000Z',
    revision: 3,
  });

  it('shows the header, the lead, the callouts, the keywords and the notes', () => {
    const view = sheet(tool, [tool, related]);

    expect(view.text('.sheet-title')).toBe('remove.bg');
    expect(view.text('.sheet-mark')).toBe('I');
    expect(view.text('.sheet-url')).toBe('https://remove.bg');
    expect(view.texts('.sheet-subline > span')).toContain('site');
    expect(view.texts('.sheet-category')).toEqual([
      'Imagini & video',
      'AI & LLM',
    ]);
    expect(view.text('.sheet-lead')).toBe(
      'Scoate automat fundalul din fotografii.',
    );
    expect(labels(view)).toContain('Când o folosesc · 4');
    expect(view.texts('.situation-callout')).toEqual([
      '01scot fundalul',
      '02poze de produs',
      '03logo transparent',
      '04API',
    ]);
    expect(labels(view)).toContain('Cuvinte-cheie');
    expect(view.texts('.keyword-tag')).toEqual(['fundal', 'background']);
    // The notes are the one editable thing: a text area, no input, no button.
    expect(notesField(view).value).toBe('Gratuit doar la rezoluție mică.');
    expect(view.container.querySelectorAll('textarea')).toHaveLength(1);
    expect(view.container.querySelector('input')).toBeNull();
    expect(view.container.querySelector('.my-notes button')).toBeNull();
  });

  it('lists the related entries, skipping unknown ids', () => {
    const view = sheet(tool, [tool, related]);

    expect(labels(view)).toContain('Resurse înrudite · 1');
    expect(view.texts('.related-link-name')).toEqual(['Unscreen']);
    expect(view.text('.related-link-context')).toBe(
      'Scoate fundalul din clipuri.',
    );
    expect(
      view.container.querySelector('.related-link')?.getAttribute('data-slot'),
    ).toBe('3');
  });

  it('shows the verification note with the reason texts', () => {
    const view = sheet(tool, [tool, related]);
    expect(view.text('.verification-note-list')).toContain(
      'repo abandonat pe GitHub: ultimul push pe 2024-01-02',
    );
  });

  it('fills the title block', () => {
    const view = sheet(tool, [tool, related]);
    const block = view.container.querySelector('.title-block');

    expect(view.text('.title-block-head')).toBe('FIȘĂ · UNEALTĂrev. 3');
    const rubrics = Object.fromEntries(
      [...(block?.querySelectorAll('.title-block-rubric') ?? [])].map(
        (rubric) => [
          rubric.querySelector('small')?.textContent,
          rubric.textContent?.replace(
            rubric.querySelector('small')?.textContent ?? '',
            '',
          ),
        ],
      ),
    );
    expect(rubrics).toEqual({
      Zonă: 'Toolbox',
      Tip: 'site',
      Adăugată: '14.10.2026',
      Verificată: '15.10.2026',
      Id: '1fe4…17dc',
      Stele: '137,7k',
      'Ultimul commit': '15.10.2026',
    });
    expect(block?.querySelector('.title-block-check')).not.toBeNull();
  });

  it('gives each category dot its own color slot', () => {
    const view = sheet(tool, [tool, related]);
    expect(
      [...view.container.querySelectorAll('.sheet-category')].map((node) =>
        node.getAttribute('data-slot'),
      ),
    ).toEqual(['3', '5']);
  });

  it('spans only Id: the paired rubrics fill their rows', () => {
    const view = sheet(tool, [tool, related]);
    expect(wideRubrics(view)).toEqual(['Id']);
  });

  it('opens a linked entry on click', () => {
    const onOpen = vi.fn();
    sheet(tool, [tool, related], { onOpen });
    fireEvent.click(screen.getByRole('button', { name: /^Unscreen/ }));
    expect(onOpen).toHaveBeenCalledWith('unscreen');
  });

  it('opens the URL in the browser from the block and from the subline', () => {
    const onOpenExternal = vi.fn();
    const view = sheet(tool, [tool, related], { onOpenExternal });

    // Two copies of the block (one per layout); the media query hides one.
    const blocks = screen.getAllByRole('link', { name: /Deschide în browser/ });
    expect(blocks).toHaveLength(2);
    expect(
      view.container.querySelector('.sheet-side > .open-in-browser'),
    ).not.toBeNull();
    expect(
      view.container.querySelector('.sheet-main > .open-in-browser'),
    ).not.toBeNull();
    expect(view.texts('.open-in-browser-url')).toEqual([
      'https://remove.bg',
      'https://remove.bg',
    ]);

    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.click(blocks[0]!)).toBe(false);
    expect(fireEvent.click(view.container.querySelector('a.sheet-url')!)).toBe(
      false,
    );
    expect(onOpenExternal).toHaveBeenCalledTimes(2);
    expect(onOpenExternal).toHaveBeenNthCalledWith(1, 'https://remove.bg');
    expect(onOpenExternal).toHaveBeenNthCalledWith(2, 'https://remove.bg');
  });

  it('takes the focus when it opens, so the keyboard is in it', () => {
    const view = sheet(tool, [tool, related]);
    expect(document.activeElement).toBe(view.root());
  });
});

describe('EntrySheet: the gaps', () => {
  const bare = makeEntry('bare', {
    name: 'Bare',
    categories: [],
    whatItDoes: 'Doar atât.',
  });

  it('leaves every empty section and rubric out', () => {
    const view = sheet(bare);

    expect(labels(view)).toEqual([]);
    expect(view.container.querySelector('.situation-callouts')).toBeNull();
    expect(view.container.querySelector('.keyword-tags')).toBeNull();
    expect(view.container.querySelector('.sheet-sources')).toBeNull();
    expect(view.container.querySelector('.markdown-content')).toBeNull();
    expect(view.container.querySelector('.related-links')).toBeNull();
    expect(view.container.querySelector('.verification-note')).toBeNull();
    expect(view.container.querySelector('.sheet-url')).toBeNull();
    expect(view.container.querySelector('.open-in-browser')).toBeNull();
    expect(view.container.querySelector('.sheet-category')).toBeNull();
    // No category: the mark takes the name's initial, and no color slot.
    expect(view.text('.sheet-mark')).toBe('B');
    expect(view.root().hasAttribute('data-slot')).toBe(false);

    const rubricLabels = view.texts('.title-block-label');
    expect(rubricLabels).toEqual(['Zonă', 'Adăugată', 'Id']);
    expect(view.container.querySelector('.title-block-check')).toBeNull();
  });

  it('shows a URL that is not http(s) as text, with no block to open it', () => {
    const view = sheet({ ...bare, url: 'ftp://files.example.com/a' });
    expect(view.text('.sheet-url')).toBe('ftp://files.example.com/a');
    expect(view.container.querySelector('a')).toBeNull();
    expect(view.container.querySelector('.open-in-browser')).toBeNull();
  });

  it('shows the placeholder when the notes are empty', () => {
    const view = sheet({ ...bare, myNotes: '' });
    expect(notesField(view).value).toBe('');
    expect(notesField(view).placeholder).toBe(
      'Scrie aici ce vrei să-ți amintești.',
    );
  });

  it('lets the last rubric of an odd group span the row', () => {
    // Never verified, with a type: Zonă, Tip, Adăugată.
    const typed = sheet({ ...bare, resourceType: 'site' });
    expect(wideRubrics(typed)).toEqual(['Adăugată', 'Id']);
    cleanup();
    // Stars without a push date: Stele is alone after Id.
    const stars = sheet({ ...bare, githubStars: 12, githubPushedAt: null });
    expect(wideRubrics(stars)).toEqual(['Id', 'Stele']);
    cleanup();
    // Zonă and Adăugată pair up.
    expect(wideRubrics(sheet(bare))).toEqual(['Id']);
  });

  it('leaves the commit rubric out when the repo has stars but no push date', () => {
    const view = sheet({ ...bare, githubStars: 12, githubPushedAt: null });
    expect(view.texts('.title-block-label')).toContain('Stele');
    expect(view.texts('.title-block-label')).not.toContain('Ultimul commit');
  });
});

describe('EntrySheet: a concept', () => {
  const kids = ['rest', 'graphql', 'grpc', 'soap', 'ws'].map((id) =>
    makeEntry(id, {
      zone: 'learn',
      name: id.toUpperCase(),
      categories: [backend],
      parentIds: ['umbrella'],
    }),
  );
  const umbrella = makeEntry('umbrella', {
    zone: 'learn',
    name: 'Tipuri de API',
    categories: [backend],
    childIds: [...kids.map((kid) => kid.id), 'gone'],
    content: 'Linia unu\n\n<script>alert(1)</script>\n\n**bold** si Linia doi',
    sources: ['https://docs.example.com/api', 'Cartea X, cap. 3'],
    situations: ['aleg un API'],
  });
  const all = [umbrella, ...kids];

  it('renders the content as Markdown and the sources as text or links', () => {
    const onOpenExternal = vi.fn();
    const view = sheet(umbrella, all, { onOpenExternal });

    const content = view.container.querySelector('.markdown-content');
    expect(content?.querySelector('script')).toBeNull();
    expect(content?.querySelector('strong')?.textContent).toBe('bold');
    expect(labels(view)).toEqual([
      'Când îl aleg · 1',
      'Conținut',
      'Surse',
      'Concepte · 5',
    ]);
    expect(view.texts('.sheet-sources li')).toEqual([
      'https://docs.example.com/api',
      'Cartea X, cap. 3',
    ]);
    // The first source is a link, the second plain text.
    const links = view.container.querySelectorAll('.sheet-sources a');
    expect(links).toHaveLength(1);
    expect(fireEvent.click(links[0]!)).toBe(false);
    expect(onOpenExternal).toHaveBeenCalledWith('https://docs.example.com/api');
    // A concept has no URL of its own: no block to open it.
    expect(view.container.querySelector('.open-in-browser')).toBeNull();
    expect(view.text('.title-block-head')).toContain('FIȘĂ · CONCEPT');
    // A concept has no type rubric.
    expect(view.texts('.title-block-label')).not.toContain('Tip');
  });

  it('lists the five children, in order', () => {
    const view = sheet(umbrella, all);
    expect(view.texts('.related-link-name')).toEqual([
      'REST',
      'GRAPHQL',
      'GRPC',
      'SOAP',
      'WS',
    ]);
  });

  it('shows „Face parte din” on a child', () => {
    const view = sheet(kids[0] as EntryDto, all);
    expect(labels(view)).toContain('Face parte din');
    expect(view.texts('.related-link-name')).toEqual(['Tipuri de API']);
  });
});

describe('EntrySheet: live updates', () => {
  const entry = makeEntry('a', { name: 'A', categories: [imagini] });

  it('does not pulse for what was counted at mount, then pulses with every update', () => {
    const view = sheet(entry, [entry], { pulses: 2 });
    expect(view.root().hasAttribute('data-pulse')).toBe(false);

    view.rerender(
      <EntrySheet
        entry={{ ...entry, revision: 2, whatItDoes: 'Nou.' }}
        entries={[entry]}
        slots={slots}
        pulses={3}
        onOpen={() => {}}
        onOpenExternal={() => {}}
        onSaveNotes={savedNotes}
      />,
    );
    expect(view.root().getAttribute('data-pulse')).toBe('a');
    expect(view.text('.sheet-lead')).toBe('Nou.');

    view.rerender(
      <EntrySheet
        entry={{ ...entry, revision: 3 }}
        entries={[entry]}
        slots={slots}
        pulses={4}
        onOpen={() => {}}
        onOpenExternal={() => {}}
        onSaveNotes={savedNotes}
      />,
    );
    expect(view.root().getAttribute('data-pulse')).toBe('b');
  });
});
