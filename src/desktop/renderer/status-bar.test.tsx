import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBar, splitPath } from './status-bar';

afterEach(cleanup);

const WORKSPACE = 'C:\\Users\\Luca\\Programe\\whenkit';

describe('StatusBar', () => {
  it('shows state, count, last added, path and key hints', () => {
    const local = new Date(2026, 9, 15, 20, 39);
    const { container } = render(
      <StatusBar
        count={75}
        lastAddedAt={local.toISOString()}
        workspacePath={WORKSPACE}
      />,
    );

    expect(screen.getByText('Catalog la zi')).toBeTruthy();
    expect(
      screen.getByText('75 de fișe · ultima adăugată 15.10.2026, 20:39'),
    ).toBeTruthy();
    // The full path is in the tooltip; the last segment is its own element.
    const path = container.querySelector('.status-path');
    expect(path?.getAttribute('title')).toBe(WORKSPACE);
    expect(container.querySelector('.status-path-tail')?.textContent).toBe(
      '\\whenkit',
    );
    expect(container.querySelector('footer')?.getAttribute('aria-label')).toBe(
      'Starea catalogului',
    );
    expect(
      Array.from(container.querySelectorAll('kbd')).map((k) => k.textContent),
    ).toEqual(['Ctrl K', 'Enter']);
    expect(container.textContent).toContain('caută');
    expect(container.textContent).toContain('deschide');
  });

  it('shows "0 fișe" without "ultima adăugată" for an empty catalog', () => {
    render(
      <StatusBar count={0} lastAddedAt={null} workspacePath={WORKSPACE} />,
    );

    expect(screen.getByText('0 fișe')).toBeTruthy();
    expect(screen.queryByText(/ultima adăugată/)).toBeNull();
  });

  it('shows other key hints when given', () => {
    const { container } = render(
      <StatusBar
        count={1}
        lastAddedAt={null}
        workspacePath={null}
        keyHints={[{ keys: 'Esc', action: 'înapoi' }]}
      />,
    );
    expect(
      Array.from(container.querySelectorAll('kbd')).map((k) => k.textContent),
    ).toEqual(['Esc']);
    expect(container.textContent).toContain('înapoi');
    expect(container.textContent).not.toContain('caută');
  });

  it('leaves the path out when the workspace is unknown', () => {
    const { container } = render(
      <StatusBar count={1} lastAddedAt={null} workspacePath={null} />,
    );
    expect(container.querySelector('.status-path')).toBeNull();
  });
});

describe('splitPath', () => {
  it('keeps the last segment apart from the shrinking head', () => {
    expect(splitPath(WORKSPACE)).toEqual({
      head: 'C:\\Users\\Luca\\Programe',
      tail: '\\whenkit',
    });
    expect(splitPath('/home/luca/whenkit')).toEqual({
      head: '/home/luca',
      tail: '/whenkit',
    });
    expect(splitPath('whenkit')).toEqual({ head: '', tail: 'whenkit' });
  });
});
