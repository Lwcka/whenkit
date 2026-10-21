import { describe, expect, it } from 'vitest';
import {
  changesLinks,
  draftFromEntry,
  hasErrors,
  isDirty,
  issuesByField,
  patchChanges,
  reasonsByField,
  validateDraft,
  withoutErrorsOf,
  type Draft,
} from './edit-draft';
import { makeCategory, makeEntry } from './test-fixtures';

const imagini = makeCategory('c-img', 'Imagini & video');
const securitate = makeCategory('c-sec', 'Securitate');
const backend = makeCategory('c-be', 'Backend & API-uri', 'learn');

const tool = makeEntry('removebg', {
  name: 'remove.bg',
  url: 'https://remove.bg',
  resourceType: 'site',
  categories: [imagini],
  whatItDoes: 'Scoate fundalul din poze.',
  situations: ['scot fundalul', 'poze de produs'],
  keywords: ['fundal'],
});
const concept = makeEntry('webhook', {
  zone: 'learn',
  name: 'Webhook',
  url: 'https://example.com/webhook',
  categories: [backend],
  whatItDoes: 'Un apel HTTP trimis la un eveniment.',
  situations: ['primesc evenimente'],
  content: '# Webhook\n\nText.\n',
  sources: ['https://example.com/a'],
});

const draftOf = (entry = tool, overrides: Partial<Draft> = {}): Draft => ({
  ...draftFromEntry(entry),
  ...overrides,
});

const LINK_SCHEME = 'Linkul trebuie să înceapă cu http:// sau https://.';

describe('draftFromEntry', () => {
  it('copies the editable fields as strings and rows', () => {
    expect(draftFromEntry(tool)).toEqual({
      name: 'remove.bg',
      url: 'https://remove.bg',
      resourceType: 'site',
      categoryIds: ['c-img'],
      whatItDoes: 'Scoate fundalul din poze.',
      situations: ['scot fundalul', 'poze de produs'],
      keywords: ['fundal'],
      sources: [],
      content: '',
    });
  });

  it('turns a missing link or content into an empty string', () => {
    const bare = makeEntry('c', { zone: 'learn', categories: [backend] });
    const draft = draftFromEntry(bare);
    expect(draft.url).toBe('');
    expect(draft.content).toBe('');
    expect(draft.resourceType).toBeNull();
  });

  it('does not share its rows with the entry', () => {
    const draft = draftFromEntry(tool);
    draft.situations.push('nou');
    expect(tool.situations).toHaveLength(2);
  });
});

describe('validateDraft', () => {
  it('accepts the draft of a stored entry', () => {
    expect(validateDraft(draftOf(tool), 'tool')).toEqual({});
    expect(validateDraft(draftOf(concept), 'concept')).toEqual({});
  });

  it('asks for a name', () => {
    expect(validateDraft(draftOf(tool, { name: '  ' }), 'tool')).toEqual({
      name: 'Scrie un nume.',
    });
  });

  it('asks for at least one category', () => {
    expect(validateDraft(draftOf(tool, { categoryIds: [] }), 'tool')).toEqual({
      categories: 'Alege cel puțin o categorie.',
    });
  });

  it('asks for a description', () => {
    expect(validateDraft(draftOf(tool, { whatItDoes: '' }), 'tool')).toEqual({
      whatItDoes: 'Scrie ce face.',
    });
  });

  it('asks for at least one non-empty situation', () => {
    expect(
      validateDraft(draftOf(tool, { situations: ['', '  '] }), 'tool'),
    ).toEqual({ situations: 'Scrie cel puțin o situație.' });
    expect(
      validateDraft(draftOf(tool, { situations: ['', 'una'] }), 'tool'),
    ).toEqual({});
  });

  it('requires the link of a tool or a material, as http(s)', () => {
    expect(validateDraft(draftOf(tool, { url: '' }), 'tool')).toEqual({
      url: 'Scrie linkul.',
    });
    expect(validateDraft(draftOf(tool, { url: 'remove.bg' }), 'tool')).toEqual({
      url: LINK_SCHEME,
    });
    expect(
      validateDraft(draftOf(tool, { url: 'ftp://remove.bg' }), 'material'),
    ).toEqual({ url: LINK_SCHEME });
  });

  it('lets a concept have no link, but not a link that is not http(s)', () => {
    expect(validateDraft(draftOf(concept, { url: '' }), 'concept')).toEqual({});
    expect(
      validateDraft(draftOf(concept, { url: 'mailto:a@b.ro' }), 'concept'),
    ).toEqual({ url: LINK_SCHEME });
  });

  it('requires the content of a concept, and only of a concept', () => {
    expect(
      validateDraft(draftOf(concept, { content: ' \n' }), 'concept'),
    ).toEqual({ content: 'Scrie conținutul.' });
    expect(validateDraft(draftOf(tool, { content: '' }), 'tool')).toEqual({});
  });

  it('reports every invalid field at once', () => {
    const errors = validateDraft(
      draftOf(tool, { name: '', url: '', categoryIds: [] }),
      'tool',
    );
    expect(Object.keys(errors).sort()).toEqual(['categories', 'name', 'url']);
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });
});

describe('patchChanges', () => {
  it('is empty for an untouched draft', () => {
    expect(patchChanges(draftOf(tool), tool)).toEqual({});
    expect(patchChanges(draftOf(concept), concept)).toEqual({});
  });

  it('holds only the field that changed', () => {
    expect(
      patchChanges(draftOf(tool, { whatItDoes: 'Altceva.' }), tool),
    ).toEqual({ whatItDoes: 'Altceva.' });
  });

  it('trims the text and compares after trimming', () => {
    expect(
      patchChanges(
        draftOf(tool, { name: '  remove.bg ', whatItDoes: '  Nou.  ' }),
        tool,
      ),
    ).toEqual({ whatItDoes: 'Nou.' });
  });

  it('drops the empty rows of the lists', () => {
    const draft = draftOf(tool, {
      situations: [' scot fundalul ', '', 'poze de produs', '  ', 'a treia'],
      keywords: ['', 'fundal', 'api'],
    });
    expect(patchChanges(draft, tool)).toEqual({
      situations: ['scot fundalul', 'poze de produs', 'a treia'],
      keywords: ['fundal', 'api'],
    });
  });

  it('ignores an empty row that was only added', () => {
    const draft = draftOf(tool, { situations: [...tool.situations, ''] });
    expect(patchChanges(draft, tool)).toEqual({});
  });

  it('sends an emptied list as an empty list', () => {
    expect(patchChanges(draftOf(tool, { keywords: [''] }), tool)).toEqual({
      keywords: [],
    });
  });

  it('sends the resource type of a tool when it changes', () => {
    expect(patchChanges(draftOf(tool, { resourceType: 'app' }), tool)).toEqual({
      resourceType: 'app',
    });
  });

  it('sends the link of a tool when it changes', () => {
    expect(
      patchChanges(draftOf(tool, { url: ' https://www.remove.bg/ro ' }), tool),
    ).toEqual({ url: 'https://www.remove.bg/ro' });
  });

  it('sends the emptied link of a concept as null, and only once', () => {
    expect(patchChanges(draftOf(concept, { url: ' ' }), concept)).toEqual({
      url: null,
    });
    const noLink = makeEntry('c2', {
      zone: 'learn',
      categories: [backend],
      content: 'x',
    });
    expect(patchChanges(draftOf(noLink), noLink)).toEqual({});
  });

  it('sends the content and the sources of a concept only', () => {
    const draft = draftOf(concept, {
      content: '  # Nou  \n',
      sources: ['https://example.com/a', '', 'https://example.com/b'],
    });
    expect(patchChanges(draft, concept)).toEqual({
      content: '# Nou',
      sources: ['https://example.com/a', 'https://example.com/b'],
    });
    // A tool never sends them, whatever the draft held.
    const stray = draftOf(tool, { content: 'x', sources: ['https://a.ro'] });
    expect(patchChanges(stray, tool)).toEqual({});
  });

  it('does not take the trailing newline of the stored content for a change', () => {
    expect(patchChanges(draftOf(concept), concept)).toEqual({});
  });

  it('sends the categories when the set changes, not when only the order does', () => {
    const two = makeEntry('two', {
      categories: [imagini, securitate],
      url: 'https://x.ro',
      resourceType: 'site',
    });
    expect(
      patchChanges(draftOf(two, { categoryIds: ['c-sec', 'c-img'] }), two),
    ).toEqual({});
    expect(patchChanges(draftOf(two, { categoryIds: ['c-sec'] }), two)).toEqual(
      { categoryIds: ['c-sec'] },
    );
  });
});

describe('isDirty and changesLinks', () => {
  it('is dirty only when something would be sent', () => {
    expect(isDirty(draftOf(tool), tool)).toBe(false);
    expect(
      isDirty(draftOf(tool, { situations: [...tool.situations, ''] }), tool),
    ).toBe(false);
    expect(isDirty(draftOf(tool, { name: 'Alt nume' }), tool)).toBe(true);
  });

  it('tells a save that verifies links from one that does not', () => {
    expect(changesLinks({ whatItDoes: 'x' })).toBe(false);
    expect(changesLinks({ url: 'https://a.ro' })).toBe(true);
    expect(changesLinks({ url: null })).toBe(true);
    expect(changesLinks({ sources: [] })).toBe(true);
  });
});

describe('reasonsByField', () => {
  it('puts a reason with the URL of a source row under that row', () => {
    const draft = draftOf(concept, {
      sources: ['https://example.com/a', ' https://example.com/b '],
    });
    expect(
      reasonsByField(
        [
          {
            code: 'source_blocked_domain',
            params: { url: 'https://example.com/b', domain: 'example.com' },
          },
        ],
        draft,
      ),
    ).toEqual({
      'sources.1':
        'Sursa https://example.com/b e pe un domeniu interzis (regula „example.com”).',
    });
  });

  it('puts every other reason under the link', () => {
    expect(
      reasonsByField(
        [
          { code: 'http_error', params: { status: '404' } },
          { code: 'duplicate', params: { name: 'Photopea' } },
        ],
        draftOf(tool),
      ),
    ).toEqual({
      url: 'Linkul nu funcționează: site-ul răspunde cu eroarea HTTP 404. Există deja: Photopea.',
    });
  });

  it('puts a reason about a URL that is no row under the link', () => {
    expect(
      reasonsByField(
        [{ code: 'no_response_at_import', params: { url: 'https://nu.ro' } }],
        draftOf(concept),
      ),
    ).toEqual({
      url: 'Sursa https://nu.ro nu a răspuns la import (eroare de server sau timeout, după 3 încercări).',
    });
  });

  it('puts a duplicate under the name when a concept has no link', () => {
    const noLink = makeEntry('c2', {
      zone: 'learn',
      categories: [backend],
      content: 'x',
    });
    const reasons = [
      { code: 'duplicate' as const, params: { name: 'Webhook' } },
    ];
    expect(reasonsByField(reasons, draftOf(noLink))).toEqual({
      name: 'Există deja: Webhook.',
    });
    // With a link, the duplicate is the link's.
    expect(Object.keys(reasonsByField(reasons, draftOf(concept)))).toEqual([
      'url',
    ]);
  });

  it('is empty without reasons', () => {
    expect(reasonsByField([], draftOf(tool))).toEqual({});
  });
});

describe('issuesByField', () => {
  it('maps each issue to the field named by the first key of its path', () => {
    expect(
      issuesByField([
        { path: ['name'], message: 'x' },
        { path: ['categoryIds', 1], message: 'x' },
        { path: ['situations', 0], message: 'x' },
        { path: ['unknown'], message: 'x' },
      ]),
    ).toEqual({
      name: 'Valoarea nu e acceptată.',
      categories: 'Valoarea nu e acceptată.',
      situations: 'Valoarea nu e acceptată.',
    });
  });
});

describe('withoutErrorsOf', () => {
  it('drops the errors of the fields that changed and keeps the rest', () => {
    const errors = {
      url: 'a',
      name: 'b',
      categories: 'c',
      sources: 'd',
      'sources.1': 'e',
    } as const;
    expect(withoutErrorsOf(errors, ['url'])).toEqual({
      name: 'b',
      categories: 'c',
      sources: 'd',
      'sources.1': 'e',
    });
    expect(withoutErrorsOf(errors, ['categoryIds', 'sources'])).toEqual({
      url: 'a',
      name: 'b',
    });
  });
});
