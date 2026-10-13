import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FileSystem } from '../../core/ports';

export const nodeFileSystem: FileSystem = {
  exists: (target) => existsSync(target),
  mkdir: (target) => {
    mkdirSync(target, { recursive: true });
  },
  readText: (target) => readFileSync(target, 'utf8'),
  writeText: (target, text) => {
    writeFileSync(target, text, 'utf8');
  },
  joinPath: (...parts) => path.join(...parts),
};
