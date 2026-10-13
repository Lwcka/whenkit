import { describe, expect, it } from 'vitest';
import { nameKey } from './name-key';

describe('nameKey', () => {
  it.each([
    ['Cărți & cursuri gratuite', 'carti & cursuri gratuite'],
    ['Construiești ca să înveți', 'construiesti ca sa inveti'],
    ['ȘȚĂÂÎ șțăâî', 'staai staai'],
    // Cedilla forms (ş, ţ) normalize the same as comma-below forms.
    ['şţ', 'st'],
    ['  AI   &\tLLM \n', 'ai & llm'],
    ['Terminal & dev tools', 'terminal & dev tools'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(nameKey(input)).toBe(expected);
  });

  it('gives the same key to precomposed and decomposed input', () => {
    expect(nameKey('ș')).toBe(nameKey('ș'));
  });
});
