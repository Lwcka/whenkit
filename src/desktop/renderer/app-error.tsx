import { appStrings, errorMessages } from '../../shared/strings.ro';
import type { ErrorDto } from '../../shared/ipc';

/** The startup error screen: it blocks everything else (EXPERIENCE). */
export function AppError({ code }: { code: ErrorDto['code'] }) {
  const command = appStrings.startupCommand(code);
  return (
    <main className="app-error" role="alert">
      <h1>{appStrings.startupTitle(code)}</h1>
      <p>{errorMessages[code]}</p>
      {command !== undefined && (
        <p>
          <code className="app-error-command">{command}</code>
        </p>
      )}
      <p className="app-error-code">{code}</p>
      <p>{appStrings.restartLine}</p>
    </main>
  );
}
