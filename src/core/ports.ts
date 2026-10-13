// Ports: every effect core needs from the outside world (AD-2). Adapters in
// src/adapters implement them and the drivers (cli, desktop/main) inject them.
// HttpClient and GitHubClient arrive with the tickets that need them.

/** Source of the current moment; timestamps are stored as `toISOString()`. */
export interface Clock {
  now(): Date;
}

/** Generates entity ids (UUID v4). */
export interface IdGenerator {
  newId(): string;
}

/** Read-only view of the process environment. */
export interface Environment {
  /** Value of an environment variable, or undefined when it is not set. */
  get(name: string): string | undefined;
  /** Absolute path of the application's own folder (the repo in development). */
  appRoot(): string;
}

/** Synchronous file-system access with UTF-8 text files. */
export interface FileSystem {
  exists(path: string): boolean;
  /** Creates the directory and any missing parents; no-op when it exists. */
  mkdir(path: string): void;
  readText(path: string): string;
  writeText(path: string, text: string): void;
  joinPath(...parts: string[]): string;
}

/** The catalog database. Grows with the use cases that need it. */
export interface CatalogStore {
  /** The single owner of every row, created on the first open (AD-5). */
  ownerId(): string;
  /** Highest applied migration version. */
  schemaVersion(): number;
  close(): void;
}

/** Opens (creating and migrating when needed) the catalog at a file path. */
export type CatalogStoreOpener = (dbPath: string) => CatalogStore;
