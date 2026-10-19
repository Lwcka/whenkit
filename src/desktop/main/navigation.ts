// The navigation guard (AD-9): the window loads only the app's own page.

function parse(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * True only for the app's own page. With the dev server (`http:`/`https:`)
 * that is the same origin; with a packaged build (`file:`) the same path,
 * query and hash ignored. Anything else, or anything unparseable, is false.
 */
export function isAppNavigation(target: string, appUrl: string): boolean {
  const to = parse(target);
  const app = parse(appUrl);
  if (to === undefined || app === undefined) return false;
  if (app.protocol === 'http:' || app.protocol === 'https:') {
    return (
      (to.protocol === 'http:' || to.protocol === 'https:') &&
      to.origin === app.origin
    );
  }
  if (app.protocol === 'file:') {
    return to.protocol === 'file:' && to.pathname === app.pathname;
  }
  return false;
}
