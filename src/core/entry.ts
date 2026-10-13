import type { Zone } from './category-seed';

// The kinds of catalog entries and the zone each one lives in (entry-model).

export const ENTRY_KINDS = ['tool', 'material', 'concept'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const RESOURCE_TYPES = ['repo', 'site', 'app'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const ZONES = ['toolbox', 'learn'] as const satisfies readonly Zone[];

/** The zone follows from the kind: tools in Toolbox, the rest in Learn. */
export function zoneOf(kind: EntryKind): Zone {
  return kind === 'tool' ? 'toolbox' : 'learn';
}
