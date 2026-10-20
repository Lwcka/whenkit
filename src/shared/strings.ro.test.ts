import { describe, expect, it } from 'vitest';
import {
  appStrings,
  entryCount,
  formatCompact,
  formatDate,
  formatDateTime,
  newCount,
  plural,
  relativeTime,
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

describe('newCount (Romanian plural of „nouă”)', () => {
  it.each([
    [1, '1 nouă'],
    [2, '2 noi'],
    [19, '19 noi'],
    [20, '20 de noi'],
    [101, '101 noi'],
  ])('%i -> %s', (n, expected) => {
    expect(newCount(n)).toBe(expected);
  });

  it('follows the count in the section header', () => {
    expect(appStrings.sectionCount(8, 1)).toBe('8 fișe · 1 nouă');
    expect(appStrings.sectionCount(30, 20)).toBe('30 de fișe · 20 de noi');
    expect(appStrings.sectionCount(8, 0)).toBe('8 fișe');
  });
});

describe('relativeTime', () => {
  it.each([
    [0, 'acum 0 s'],
    [-500, 'acum 0 s'],
    [3000, 'acum 3 s'],
    [3999, 'acum 3 s'],
    [59_999, 'acum 59 s'],
    [60_000, 'acum 1 min'],
    [120_000, 'acum 2 min'],
    [599_000, 'acum 9 min'],
    [3_600_000, 'acum 1 h'],
  ])('%i ms -> %s', (elapsed, expected) => {
    expect(relativeTime(elapsed)).toBe(expected);
  });

  it('is the tape text after „Adăugat ·”', () => {
    expect(appStrings.arrivalTape(3000)).toBe('Adăugat · acum 3 s');
  });
});

describe('arrival toast texts', () => {
  it('names one entry with its zone and category', () => {
    expect(
      appStrings.arrivalToastOne('Webhook', 'Learn', 'Backend & API-uri'),
    ).toEqual([
      'Fișă nouă: ',
      { strong: 'Webhook' },
      ' · Learn / Backend & API-uri',
    ]);
  });

  it('leaves out the category when there is none', () => {
    expect(appStrings.arrivalToastOne('Webhook', 'Learn', null)).toEqual([
      'Fișă nouă: ',
      { strong: 'Webhook' },
      ' · Learn',
    ]);
  });

  it('counts several entries of a zone', () => {
    expect(appStrings.arrivalToastMany(5, 'Toolbox')).toEqual([
      { strong: '5 fișe noi' },
      ' în Toolbox',
    ]);
    expect(appStrings.arrivalToastMany(20, 'Learn')).toEqual([
      { strong: '20 de fișe noi' },
      ' în Learn',
    ]);
  });
});
