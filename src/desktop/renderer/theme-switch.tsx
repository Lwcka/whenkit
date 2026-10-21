import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { IpcResult, Theme } from '../../shared/ipc';
import { appStrings } from '../../shared/strings.ro';
import { applyTheme, getTargetTheme, getTheme, subscribeTheme } from './theme';
import './theme-switch.css';
import { toasts } from './toast-store';

export interface ThemeSwitchProps {
  setTheme: (theme: Theme) => Promise<IpcResult<null>>;
}

/** The toggle in flight; a toggle that is no longer the latest sends nothing. */
let latestToggle = 0;

/**
 * A two-place pill (sun, moon) with a sliding knob. A click cross-fades the
 * theme and, at the midpoint of the fade, asks main to keep it (so the native
 * caption buttons recolor once); if main cannot, the theme goes back and an
 * error toast says so.
 */
export function ThemeSwitch({ setTheme }: ThemeSwitchProps) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);

  const toggle = async () => {
    // The target, not data-theme: a fast second click comes before the flip.
    const previous = getTargetTheme();
    const next: Theme = previous === 'dark' ? 'light' : 'dark';
    const toggleId = ++latestToggle;
    await applyTheme(next, { animate: true });
    if (toggleId !== latestToggle) return;
    let saved = false;
    try {
      saved = (await setTheme(next)).ok;
    } catch {
      // The bridge itself failed: same outcome as an error result.
    }
    if (!saved) {
      if (toggleId === latestToggle && getTargetTheme() === next) {
        void applyTheme(previous, { animate: true });
      }
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
