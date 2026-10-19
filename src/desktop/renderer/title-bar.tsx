import type { IpcResult, Theme } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { ThemeSwitch } from './theme-switch';
import './title-bar.css';

/**
 * The window's own title bar: the native buttons are laid over it at the
 * right (titleBarOverlay), so it is the drag region and keeps clear of them.
 */
export function TitleBar({
  setTheme,
}: {
  setTheme: (theme: Theme) => Promise<IpcResult<null>>;
}) {
  return (
    <header className="title-bar">
      <div className="title-bar-app">
        <span className="app-mark" aria-hidden="true">
          W
        </span>
        {appStrings.productName}
      </div>
      <ThemeSwitch setTheme={setTheme} />
    </header>
  );
}
