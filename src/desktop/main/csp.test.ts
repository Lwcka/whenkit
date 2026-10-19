import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// AD-9: the CSP names no external source. The page is read from the repo
// root, which is the working directory of `vitest run`.
function contentSecurityPolicy(): string {
  const html = readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const match = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(
    html,
  );
  if (match === null) throw new Error('index.html has no CSP meta tag');
  return match[1];
}

describe('index.html CSP', () => {
  it("allows only 'self', 'none' and data: in img-src", () => {
    const directives = contentSecurityPolicy()
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter((parts) => parts[0] !== '');
    expect(directives.length).toBeGreaterThan(0);
    for (const [name, ...sources] of directives) {
      for (const source of sources) {
        const allowed =
          source === "'self'" ||
          source === "'none'" ||
          (name === 'img-src' && source === 'data:');
        expect(allowed, `${name} ${source}`).toBe(true);
      }
    }
  });
});
