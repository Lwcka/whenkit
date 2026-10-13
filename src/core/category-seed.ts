// Start categories from spec-whenkit/categories-seed.md. Seeded exactly once,
// by the migration that creates the categories table (AD-5). These are
// catalog data, not interface text, so they stay here rather than in
// src/shared/strings.ro.ts.

export type Zone = 'toolbox' | 'learn';

export interface SeedCategory {
  zone: Zone;
  name: string;
}

export const CATEGORY_SEED: readonly SeedCategory[] = [
  { zone: 'toolbox', name: 'Imagini & video' },
  { zone: 'toolbox', name: 'Mockup-uri & capturi de cod' },
  { zone: 'toolbox', name: 'Design & UI' },
  { zone: 'toolbox', name: 'AI & LLM' },
  { zone: 'toolbox', name: 'Claude Code & agenți' },
  { zone: 'toolbox', name: 'Securitate' },
  { zone: 'toolbox', name: 'Date & API-uri' },
  { zone: 'toolbox', name: 'Descoperire & arhive' },
  { zone: 'toolbox', name: 'Terminal & dev tools' },
  { zone: 'learn', name: 'Roadmaps & cariere' },
  { zone: 'learn', name: 'Interviuri' },
  { zone: 'learn', name: 'Cărți & cursuri gratuite' },
  { zone: 'learn', name: 'Construiești ca să înveți' },
  { zone: 'learn', name: 'Backend & API-uri' },
  { zone: 'learn', name: 'Limbaje' },
  { zone: 'learn', name: 'Securitate' },
];
