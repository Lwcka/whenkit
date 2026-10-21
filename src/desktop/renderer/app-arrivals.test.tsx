import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogSnapshotDto, EntryDto, IpcResult } from '../../shared/ipc';
import { App, type FrameApi } from './app';
import { createCatalogStore, type CatalogStore } from './catalog-store';
import { TAPE_LIFETIME_MS } from './catalog-view';
import { applyTheme } from './theme';
import { makeCategory, makeEntry } from './test-fixtures';
import { toasts } from './toast-store';

// The window while imports land (EXPERIENCE, „Sosire din import”): the real
// store and the real App, with the snapshots a reload would bring.

const imagini = makeCategory('c-img', 'Imagini & video');
const securitate = makeCategory('c-sec', 'Securitate');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');
const categories = [imagini, securitate, backend];

const api: FrameApi = {
  workspacePath: 'C:\\ws',
  searchEntries: () => Promise.resolve({ ok: true, data: { ids: [] } }),
  setNotes: () => Promise.resolve({ ok: true, data: { changed: [] } }),
  deleteEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
  patchEntry: () => Promise.resolve({ ok: true, data: { changed: [] } }),
  setTheme: () => Promise.resolve({ ok: true, data: null }),
  setZoomFactor: () => {},
  openExternal: () => Promise.resolve({ ok: true, data: null }),
};

function snapshot(...entries: EntryDto[]): IpcResult<CatalogSnapshotDto> {
  return { ok: true, data: { entries, categories } };
}

const tool = (id: string, overrides = {}) =>
  makeEntry(id, { categories: [imagini], ...overrides });
const concept = (id: string, overrides = {}) =>
  makeEntry(id, { zone: 'learn', categories: [backend], ...overrides });

let answers: IpcResult<CatalogSnapshotDto>[];
let store: CatalogStore;

beforeEach(() => {
  vi.useFakeTimers();
  applyTheme('light');
  toasts.clear();
  answers = [];
  store = createCatalogStore({
    catalogSnapshot: () => {
      const next = answers.shift();
      if (next === undefined) throw new Error('no snapshot queued');
      return Promise.resolve(next);
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function open(first: IpcResult<CatalogSnapshotDto>) {
  answers.push(first);
  const view = render(<App store={store} api={api} />);
  await act(() => store.load());
  return view;
}

/** The terminal imported: the next snapshot is `next`. */
async function reloadWith(next: IpcResult<CatalogSnapshotDto>) {
  answers.push(next);
  await act(() => store.reload());
}

const titles = () =>
  screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const toastTexts = () =>
  [...document.querySelectorAll('.toast')].map((toast) => ({
    kind: toast.getAttribute('data-kind'),
    text: toast.querySelector('.toast-message')?.textContent,
    action: toast.querySelector('.toast-action')?.textContent ?? null,
  }));
const headerLabel = () =>
  document.querySelector('.section-header-label')?.textContent;
const tabs = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('App: an arrival in the current view', () => {
  it('lands first with ring and tape, grows the counters and toasts once', async () => {
    await open(snapshot(tool('a'), tool('b')));
    expect(headerLabel()).toBe('2 fișe');
    expect(toastTexts()).toEqual([]);

    await reloadWith(snapshot(tool('n'), tool('a'), tool('b')));

    expect(titles()).toEqual(['n', 'a', 'b']);
    const cards = [...document.querySelectorAll('.entry-card')];
    expect(cards[0]?.hasAttribute('data-new')).toBe(true);
    expect(cards[1]?.hasAttribute('data-new')).toBe(false);
    expect(document.querySelector('.arrival-tape')?.textContent).toBe(
      'Adăugat · acum 0 s',
    );
    expect(headerLabel()).toBe('3 fișe · 1 nouă');
    expect(tabs()).toEqual(['Toolbox3', 'Learn0']);
    expect(document.querySelector('.status-bar')?.textContent).toContain(
      '3 fișe',
    );
    expect(toastTexts()).toEqual([
      {
        kind: 'arrival',
        text: 'Fișă nouă: n · Toolbox / Imagini & video',
        action: 'Deschide',
      },
    ]);
  });

  it('ticks the time on the tape and drops everything after 600 s', async () => {
    await open(snapshot(tool('a')));
    await reloadWith(snapshot(tool('n'), tool('a')));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(document.querySelector('.arrival-tape')?.textContent).toBe(
      'Adăugat · acum 3 s',
    );
    act(() => {
      vi.advanceTimersByTime(117_000);
    });
    expect(document.querySelector('.arrival-tape')?.textContent).toBe(
      'Adăugat · acum 2 min',
    );

    act(() => {
      vi.advanceTimersByTime(TAPE_LIFETIME_MS - 120_000);
    });
    expect(document.querySelector('.arrival-tape')).toBeNull();
    expect(document.querySelector('.entry-card[data-new]')).toBeNull();
    expect(headerLabel()).toBe('2 fișe');
  });

  it('runs the one-second ticker only while a tape is visible', async () => {
    await open(snapshot(tool('a')));
    const ticks = () => vi.getTimerCount();
    const idle = ticks();

    await reloadWith(snapshot(tool('n'), tool('a')));
    expect(ticks()).toBeGreaterThan(idle);

    act(() => {
      vi.advanceTimersByTime(TAPE_LIFETIME_MS);
    });
    // The toast fades out once the last render happened; then no timer is left.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(ticks()).toBe(idle);
  });

  it('counts only the fresh entries of the view in the header', async () => {
    await open(snapshot(tool('a'), tool('b')));
    await reloadWith(snapshot(tool('n2'), tool('n1'), tool('a'), tool('b')));
    expect(headerLabel()).toBe('4 fișe · 2 noi');
    expect(toastTexts()).toEqual([
      { kind: 'arrival', text: '2 fișe noi în Toolbox', action: 'Vezi' },
    ]);
  });
});

describe('App: an arrival elsewhere', () => {
  it('leaves the cards alone, still toasts and grows the counters', async () => {
    await open(snapshot(tool('a')));
    await reloadWith(snapshot(concept('Webhook'), tool('a')));

    expect(titles()).toEqual(['a']);
    expect(document.querySelector('.arrival-tape')).toBeNull();
    expect(headerLabel()).toBe('1 fișă');
    expect(tabs()).toEqual(['Toolbox1', 'Learn1']);
    expect(toastTexts()).toEqual([
      {
        kind: 'arrival',
        text: 'Fișă nouă: Webhook · Learn / Backend & API-uri',
        action: 'Deschide',
      },
    ]);
  });

  it('does not light the card of another category in the bar view', async () => {
    const other = tool('s1', { categories: [securitate] });
    await open(snapshot(tool('a'), other));
    fireEvent.click(screen.getByRole('radio', { name: /^Securitate/ }));
    expect(titles()).toEqual(['s1']);

    await reloadWith(snapshot(tool('n'), tool('a'), other));

    expect(titles()).toEqual(['s1']);
    expect(headerLabel()).toBe('1 fișă');
    expect(toastTexts()).toHaveLength(1);
  });

  it('names a Learn entry without categories by its zone only', async () => {
    await open(snapshot(tool('a')));
    await reloadWith(snapshot(concept('Fara', { categories: [] }), tool('a')));
    expect(toastTexts()[0]?.text).toBe('Fișă nouă: Fara · Learn');
  });
});

describe('App: batches', () => {
  const five = ['t1', 't2', 't3', 't4', 't5'].map((id) => tool(id));

  it('makes one toast per zone, Toolbox first, and „Vezi” opens that zone at Toate', async () => {
    await open(snapshot(concept('old'), tool('a')));
    // Learn is open, in a category.
    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Backend/ }));

    await reloadWith(
      snapshot(concept('Webhook'), ...five, concept('old'), tool('a')),
    );

    expect(toastTexts()).toEqual([
      { kind: 'arrival', text: '5 fișe noi în Toolbox', action: 'Vezi' },
      {
        kind: 'arrival',
        text: 'Fișă nouă: Webhook · Learn / Backend & API-uri',
        action: 'Deschide',
      },
    ]);
    expect(
      screen.getByRole('tab', { name: /^Learn/ }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Vezi' }));

    expect(
      screen
        .getByRole('tab', { name: /^Toolbox/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(titles()).toEqual(['t1', 't2', 't3', 't4', 't5', 'a']);
    expect(headerLabel()).toBe('6 fișe · 5 noi');
    expect(document.querySelectorAll('.entry-card[data-new]').length).toBe(5);
  });

  it('shows no toast and no tape for the first load or a reload with nothing new', async () => {
    await open(snapshot(tool('a')));
    await reloadWith(snapshot(tool('a')));
    expect(toastTexts()).toEqual([]);
    expect(document.querySelector('.arrival-tape')).toBeNull();
  });
});

describe('App: an update from the terminal', () => {
  it('replaces the card in place and pulses it, with no toast', async () => {
    await open(snapshot(tool('a'), tool('b')));
    expect(document.querySelector('[data-pulse]')).toBeNull();

    await reloadWith(
      snapshot(tool('a', { revision: 2, whatItDoes: 'Schimbată.' }), tool('b')),
    );

    expect(screen.getByText('Schimbată.')).toBeTruthy();
    const pulsing = [...document.querySelectorAll('[data-pulse]')];
    expect(pulsing.map((card) => card.getAttribute('aria-label'))).toEqual([
      'a',
    ]);
    expect(titles()).toEqual(['a', 'b']);
    expect(toastTexts()).toEqual([]);
    expect(headerLabel()).toBe('2 fișe');

    const before = pulsing[0]?.getAttribute('data-pulse');
    await reloadWith(
      snapshot(tool('a', { revision: 3, whatItDoes: 'Iar.' }), tool('b')),
    );
    expect(
      document.querySelector('[aria-label="a"]')?.getAttribute('data-pulse'),
    ).not.toBe(before);
  });

  it('keeps the store DTO when the snapshot is older', async () => {
    await open(snapshot(tool('a', { revision: 4, whatItDoes: 'Nouă.' })));
    await reloadWith(
      snapshot(tool('a', { revision: 3, whatItDoes: 'Veche.' })),
    );
    expect(screen.getByText('Nouă.')).toBeTruthy();
    expect(screen.queryByText('Veche.')).toBeNull();
  });
});

describe('App: removal and failure', () => {
  it('drops a removed entry from the grid and the counters', async () => {
    await open(snapshot(tool('a'), tool('b')));
    await reloadWith(snapshot(tool('b')));
    expect(titles()).toEqual(['b']);
    expect(tabs()).toEqual(['Toolbox1', 'Learn0']);
  });

  it('keeps the last catalog and shows an error toast when a reload fails', async () => {
    await open(snapshot(tool('a')));
    await reloadWith({ ok: false, error: { code: 'INTERNAL' } });

    expect(titles()).toEqual(['a']);
    expect(screen.queryByText('INTERNAL')).toBeNull();
    expect(toastTexts()).toEqual([
      { kind: 'error', text: 'Nu am putut reîncărca catalogul.', action: null },
    ]);
  });
});

describe('App: an arrival that expired while out of view', () => {
  it('shows no tape, ring or count when its zone is opened after 600 s', async () => {
    await open(snapshot(tool('a')));
    await reloadWith(snapshot(concept('Webhook'), tool('a')));
    // Toolbox shows no tape, so the ticker is off while the time passes.
    act(() => {
      vi.advanceTimersByTime(TAPE_LIFETIME_MS + 1000);
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }));

    expect(titles()).toEqual(['Webhook']);
    expect(document.querySelector('.arrival-tape')).toBeNull();
    expect(document.querySelector('.entry-card[data-new]')).toBeNull();
    expect(headerLabel()).toBe('1 fișă');
  });
});
