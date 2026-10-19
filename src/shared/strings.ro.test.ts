import { describe, expect, it } from 'vitest';
import {
  appStrings,
  entryCount,
  formatCompact,
  formatDate,
  formatDateTime,
  plural,
} from './strings.ro';

describe('entryCount (Romanian plural)', () => {
  it.each([
    [1, '1 fișă'],
    [0, '0 fișe'],
    [2, '2 fișe'],
    [19, '19 fișe'],
    [20, '20 de fișe'],
    [100, '100 de fișe'],
    [101, '101 fișe'],
  ])('%i -> %s', (n, expected) => {
    expect(entryCount(n)).toBe(expected);
  });

  it('applies other forms through plural()', () => {
    const situations = {
      one: 'situație',
      few: 'situații',
      other: 'de situații',
    };
    expect(plural(1, situations)).toBe('1 situație');
    expect(plural(3, situations)).toBe('3 situații');
    expect(plural(25, situations)).toBe('25 de situații');
  });
});

describe('date formats (local time)', () => {
  const local = new Date(2026, 9, 15, 20, 39);

  it('formats a date and a date with time', () => {
    expect(formatDate(local)).toBe('15.10.2026');
    expect(formatDateTime(local)).toBe('15.10.2026, 20:39');
  });

  it('reads an ISO instant in local time', () => {
    expect(formatDateTime(local.toISOString())).toBe('15.10.2026, 20:39');
  });

  it('pads day, month, hour and minute', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 4))).toBe(
      '05.01.2026, 07:04',
    );
  });
});

describe('formatCompact', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1250, '1,3k'],
    [137_654, '137,7k'],
    [1_000_000, '1M'],
  ])('%i -> %s', (n, expected) => {
    expect(formatCompact(n)).toBe(expected);
  });
});

describe('statusSummary', () => {
  it('shows the count and the newest entry', () => {
    const local = new Date(2026, 9, 15, 20, 39);
    expect(appStrings.statusSummary(75, local.toISOString())).toBe(
      '75 de fișe · ultima adăugată 15.10.2026, 20:39',
    );
  });

  it('drops "ultima adăugată" for an empty catalog', () => {
    expect(appStrings.statusSummary(0, null)).toBe('0 fișe');
  });
});
