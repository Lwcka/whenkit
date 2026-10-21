import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { FileSystem } from '../../core/ports';

function collectFiles(root: string, relative: string, found: string[]): void {
  const entries = readdirSync(path.join(root, relative), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const next = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) collectFiles(root, next, found);
    else if (entry.isFile()) found.push(next);
  }
}

export const nodeFileSystem: FileSystem = {
  exists: (target) => existsSync(target),
  mkdir: (target) => {
    mkdirSync(target, { recursive: true });
  },
  removeDir: (target) => {
    rmSync(target, { recursive: true, force: true });
  },
  removeFile: (target) => {
    rmSync(target, { force: true });
  },
  readText: (target) => readFileSync(target, 'utf8'),
  writeText: (target, text) => {
    writeFileSync(target, text, 'utf8');
  },
  listFiles: (dir) => {
    const found: string[] = [];
    collectFiles(dir, '', found);
    return found.sort();
  },
  joinPath: (...parts) => path.join(...parts),
};
