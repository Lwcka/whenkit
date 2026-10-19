import { describe, expect, it } from 'vitest';
import { createErrorReporter, formatLogEntry } from './error-log';

const NOW = new Date('2026-10-19T08:30:00.123Z');
const LOG = 'C:\\ws\\data\\whenkit.log';

function setup(options: { logPath?: string; failAppend?: boolean } = {}) {
  const appended: Array<{ path: string; text: string }> = [];
  const dialogs: Array<string | undefined> = [];
  const reporter = createErrorReporter({
    logPath: 'logPath' in options ? options.logPath : LOG,
    append: (path, text) => {
      if (options.failAppend) throw new Error('disk full');
      appended.push({ path, text });
    },
    showDialog: (logPath) => {
      dialogs.push(logPath);
    },
    now: () => NOW,
  });
  return { reporter, appended, dialogs };
}

describe('formatLogEntry', () => {
  it('is the ISO time, then the stack, ending with a newline', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at here';
    expect(formatLogEntry(NOW, error)).toBe(
      '2026-10-19T08:30:00.123Z Error: boom\n    at here\n',
    );
  });

  it('describes values that are not errors', () => {
    expect(formatLogEntry(NOW, 'oops')).toBe('2026-10-19T08:30:00.123Z oops\n');
    expect(formatLogEntry(NOW, { a: 1 })).toBe(
      '2026-10-19T08:30:00.123Z {"a":1}\n',
    );
    expect(formatLogEntry(NOW, undefined)).toBe(
      '2026-10-19T08:30:00.123Z undefined\n',
    );
  });
});

describe('createErrorReporter', () => {
  it('log appends and shows no dialog', () => {
    const { reporter, appended, dialogs } = setup();
    reporter.log(new Error('handled'));
    expect(appended).toHaveLength(1);
    expect(appended[0].path).toBe(LOG);
    expect(appended[0].text.startsWith('2026-10-19T08:30:00.123Z ')).toBe(true);
    expect(dialogs).toEqual([]);
  });

  it('report appends and shows the dialog with the log path', () => {
    const { reporter, appended, dialogs } = setup();
    reporter.report(new Error('unexpected'));
    expect(appended).toHaveLength(1);
    expect(dialogs).toEqual([LOG]);
  });

  it('still shows the dialog when appending fails', () => {
    const { reporter, dialogs } = setup({ failAppend: true });
    expect(() => reporter.report(new Error('x'))).not.toThrow();
    expect(dialogs).toEqual([LOG]);
  });

  it('shows only the dialog when the workspace is unknown', () => {
    const { reporter, appended, dialogs } = setup({ logPath: undefined });
    reporter.report(new Error('x'));
    reporter.log(new Error('y'));
    expect(appended).toEqual([]);
    expect(dialogs).toEqual([undefined]);
  });

  it('never throws, even when the dialog does', () => {
    const reporter = createErrorReporter({
      logPath: LOG,
      append: () => {
        throw new Error('no');
      },
      showDialog: () => {
        throw new Error('no');
      },
      now: () => NOW,
    });
    expect(() => reporter.report('x')).not.toThrow();
    expect(() => reporter.log('x')).not.toThrow();
  });
});
