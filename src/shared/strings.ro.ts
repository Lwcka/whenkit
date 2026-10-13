// All Romanian user-facing text lives here (AD-13). Code elsewhere refers to
// these entries and never embeds Romanian strings directly.

import type { ErrorCode } from '../core/errors';

export const cliStrings = {
  usage: [
    'Utilizare: whenkit <comandă> [opțiuni]',
    '',
    'Comenzi:',
    '  init [cale]     creează workspace-ul (sau îl verifică, dacă există) și',
    '                  salvează calea; fără cale, folosește workspace-ul configurat',
    '',
    'Opțiuni:',
    '  --version, -v   afișează versiunea',
    '  --help, -h      afișează acest ajutor',
  ].join('\n'),
  unknownCommand: (name: string) =>
    `Comandă necunoscută: „${name}”. Rulează „whenkit --help” pentru lista comenzilor.`,
  unknownOption: (command: string, option: string) =>
    `Opțiune necunoscută pentru „${command}”: „${option}”. Rulează „whenkit --help”.`,
  tooManyArguments: (command: string) =>
    `Prea multe argumente pentru „${command}”. Rulează „whenkit --help”.`,
  initDone: (workspace: string) => `Workspace-ul e gata: ${workspace}`,
  errorPrefix: 'Eroare',
} as const;

export const errorMessages: Record<ErrorCode, string> = {
  WORKSPACE_NOT_CONFIGURED:
    'Workspace-ul nu e configurat. Rulează „whenkit init <cale>” sau setează variabila WHENKIT_WORKSPACE.',
  WORKSPACE_INSIDE_REPO:
    'Workspace-ul nu poate fi folderul aplicației și nici în interiorul lui. Alege o cale în afara repo-ului.',
  CONFIG_INVALID:
    'Calea workspace-ului sau configurarea lui e invalidă: %APPDATA%\\whenkit\\config.json nu poate fi citit sau nu e valid, ori calea (dată la „whenkit init”, din WHENKIT_WORKSPACE sau din config.json) nu e o cale Windows absolută (C:\\… sau \\\\server\\share) ori are un folder al cărui nume se termină cu punct sau spațiu. Rulează „whenkit init <cale>” cu o cale validă.',
  MIGRATION_MISMATCH:
    'O migrare aplicată bazei de date diferă de cea din cod. Catalogul nu a fost deschis și nu s-a scris nimic.',
  DATABASE_TOO_NEW:
    'Baza de date e mai nouă decât această versiune whenkit. Actualizează whenkit; catalogul nu a fost deschis.',
  DATABASE_BUSY:
    'Baza de date e blocată de alt proces. Încearcă din nou peste câteva secunde.',
  INTERNAL: 'Eroare internă neprevăzută.',
};
