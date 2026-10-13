/**
 * The single normalization behind `name_key` (AD-5): decomposes to NFD,
 * drops combining marks (so ș, ț, ă, â, î lose their diacritics), lowercases,
 * trims and collapses runs of whitespace into one space.
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
