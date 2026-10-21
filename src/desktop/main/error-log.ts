// Unexpected errors of the main process (AD-19): `<ISO> <stack>` appended to
// `<workspace>\data\whenkit.log`, and a dialog for the ones nobody handled.
// Electron-free; the effects are injected. Nothing here ever throws.

export interface ErrorReporterPorts {
  /** The log file, or undefined when the workspace (or its data/) is unknown. */
  logPath?: string;
  append: (path: string, text: string) => void;
  showDialog: (logPath: string | undefined) => void;
  now: () => Date;
}

export interface ErrorReporter {
  /** Appends to the log only (a handled INTERNAL). */
  log(error: unknown): void;
  /** Logs, then shows the dialog (an uncaught exception or rejection). */
  report(error: unknown): void;
}

function describe(error: unknown): string {
  if (error instanceof Error)
    return error.stack ?? `${error.name}: ${error.message}`;
  try {
    return typeof error === 'string'
      ? error
      : (JSON.stringify(error) ?? String(error));
  } catch {
    return String(error);
  }
}

/** One log line group: the ISO time, then the stack. Ends with a newline. */
export function formatLogEntry(now: Date, error: unknown): string {
  return `${now.toISOString()} ${describe(error)}\n`;
}

export function createErrorReporter({
  logPath,
  append,
  showDialog,
  now,
}: ErrorReporterPorts): ErrorReporter {
  const log = (error: unknown): void => {
    if (logPath === undefined) return;
    try {
      append(logPath, formatLogEntry(now(), error));
    } catch {
      // A log that cannot be written must not hide the error it was for.
    }
  };
  return {
    log,
    report(error) {
      log(error);
      try {
        showDialog(logPath);
      } catch {
        // Reporting must never throw.
      }
    },
  };
}
