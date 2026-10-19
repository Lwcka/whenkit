import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { EntryDto, IpcResult, CatalogSnapshotDto } from '../../shared/ipc';
import { errorMessages } from '../../shared/strings.ro';
import { App } from './app';
import { createCatalogStore } from './catalog-store';

afterEach(cleanup);

function entry(
  id: string,
  name: string,
  zone: EntryDto['zone'],
  whatItDoes: string,
): EntryDto {
  return {
    id,
    ownerId: 'owner',
    kind: zone === 'toolbox' ? 'tool' : 'concept',
    zone,
    name,
    url: null,
    resourceType: null,
    categories: [],
    relatedIds: [],
    parentIds: [],
    childIds: [],
    whatItDoes,
    situations: [],
    keywords: [],
    sources: [],
    content: null,
    myNotes: '',
    githubStars: null,
    githubPushedAt: null,
    githubArchived: null,
    verificationNotes: [],
    forced: false,
    revision: 1,
    addedAt: '2026-10-13T12:00:00.000Z',
    verifiedAt: null,
  };
}

async function renderWith(result: IpcResult<CatalogSnapshotDto>) {
  const store = createCatalogStore({
    catalogSnapshot: () => Promise.resolve(result),
  });
  const view = render(<App store={store} />);
  await act(() => store.load());
  return view;
}

describe('App', () => {
  it('renders nothing while loading', () => {
    const store = createCatalogStore({
      catalogSnapshot: () => new Promise(() => {}),
    });
    const { container } = render(<App store={store} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows Toolbox first and switches zones, keeping the snapshot order', async () => {
    await renderWith({
      ok: true,
      data: {
        categories: [],
        entries: [
          entry('1', 'Zeta tool', 'toolbox', 'Prima.'),
          entry('2', 'Un concept', 'learn', 'Învățare.'),
          entry('3', 'Alfa tool', 'toolbox', 'A doua.'),
          entry('4', 'Alt concept', 'learn', 'Încă una.'),
        ],
      },
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Toolbox', 'Learn']);
    expect(
      screen
        .getByRole('tab', { name: 'Toolbox' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    // Snapshot order, not alphabetical.
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Zeta tool', 'Alfa tool']);
    expect(screen.getByText('Prima.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Learn' }));

    expect(
      screen.getByRole('tab', { name: 'Learn' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Un concept', 'Alt concept']);
  });

  it.each([
    [
      'WORKSPACE_NOT_CONFIGURED',
      'Nu găsesc workspace-ul.',
      'whenkit init <cale>',
    ],
    [
      'DATABASE_NEEDS_MIGRATION',
      'Catalogul trebuie actualizat.',
      'whenkit init',
    ],
    ['DATABASE_TOO_NEW', 'Catalogul e mai nou decât WhenKit.', undefined],
    ['INTERNAL', 'WhenKit nu a putut porni.', undefined],
  ] as const)('shows only app-error for %s', async (code, title, command) => {
    await renderWith({ ok: false, error: { code } });

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(errorMessages[code])).toBeTruthy();
    expect(screen.getByText(code)).toBeTruthy();
    expect(screen.getByText('Apoi repornește WhenKit.')).toBeTruthy();
    if (command !== undefined) {
      expect(screen.getByText(command)).toBeTruthy();
    }
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows INTERNAL when the bridge itself rejects', async () => {
    const store = createCatalogStore({
      catalogSnapshot: () => Promise.reject(new Error('ipc down')),
    });
    render(<App store={store} />);
    await act(() => store.load());
    expect(screen.getByText('INTERNAL')).toBeTruthy();
  });
});
