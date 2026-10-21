// The one slug function (AD-12): export file names and `[[slug|Name]]` links
// both come from here, so a link always names an existing file.

/** Longest slug; a collision suffix still keeps the total within it. */
export const SLUG_MAX_LENGTH = 80;

/** File names Windows refuses (with or without an extension). */
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

function cut(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, '');
}

/**
 * ASCII `[a-z0-9-]` from any text: accents stripped, every other run of
 * characters becomes one `-`, at most 80 characters, no leading or trailing
 * `-`. A Windows reserved name gets `-1`. Text with nothing left (e.g.
 * Japanese) gives `fallback`.
 */
export function slugify(text: string, fallback: string): string {
  const base = cut(
    text
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, ''),
    SLUG_MAX_LENGTH,
  );
  const slug = base === '' ? fallback : base;
  return WINDOWS_RESERVED.test(slug) ? `${slug}-1` : slug;
}

export interface Sluggable {
  id: string;
  name: string;
  addedAt: string;
}

/**
 * The slug of every entry, computed once: entries take their slugs in the
 * order `(addedAt, id)`, and a slug already taken (compared without regard to
 * case) gets `-2`, `-3`, … The suffixed slug also fits in 80 characters.
 */
export function slugMap(
  entries: readonly Sluggable[],
  fallback: string,
): Map<string, string> {
  const ordered = [...entries].sort((a, b) =>
    a.addedAt === b.addedAt
      ? a.id < b.id
        ? -1
        : 1
      : a.addedAt < b.addedAt
        ? -1
        : 1,
  );
  const taken = new Set<string>();
  const slugs = new Map<string, string>();
  for (const entry of ordered) {
    const base = slugify(entry.name, fallback);
    let slug = base;
    for (let n = 2; taken.has(slug.toLowerCase()); n += 1) {
      const suffix = `-${n}`;
      slug = `${cut(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
    }
    taken.add(slug.toLowerCase());
    slugs.set(entry.id, slug);
  }
  return slugs;
}
