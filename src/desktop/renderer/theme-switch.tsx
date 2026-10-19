import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { IpcResult, Theme } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { applyTheme, getTheme, subscribeTheme } from './theme';
import './theme-switch.css';
import { toasts } from './toast-store';

export interface ThemeSwitchProps {
  setTheme: (theme: Theme) => Promise<IpcResult<null>>;
}

/**
 * A two-place pill (sun, moon) with a sliding knob. A click flips the theme at
 * once and asks main to keep it; if main cannot, the theme goes back and an
 * error toast says so.
 */
export function ThemeSwitch({ setTheme }: ThemeSwitchProps) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);

  const toggle = async () => {
    const previous = getTheme();
    const next: Theme = previous === 'dark' ? 'light' : 'dark';
    applyTheme(next, { animate: true });
    let saved = false;
    try {
      saved = (await setTheme(next)).ok;
    } catch {
      // The bridge itself failed: same outcome as an error result.
    }
    if (!saved) {
      if (getTheme() === next) applyTheme(previous, { animate: true });
      toasts.push({ kind: 'error', message: appStrings.themeNotChanged });
    }
  };

  return (
    <button
      type="button"
      role="switch"
      className="theme-switch"
      aria-checked={theme === 'dark'}
      aria-label={appStrings.themeSwitchLabel}
      title={appStrings.themeSwitchTitle}
      onClick={() => void toggle()}
    >
      <span className="theme-switch-slot" data-slot="light">
        <Sun aria-hidden="true" />
      </span>
      <span className="theme-switch-slot" data-slot="dark">
        <Moon aria-hidden="true" />
      </span>
    </button>
  );
}
