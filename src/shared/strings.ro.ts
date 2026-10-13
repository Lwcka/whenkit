// All Romanian user-facing text lives here (AD-13). Code elsewhere refers to
// these entries and never embeds Romanian strings directly.

export const cliStrings = {
  usage: [
    'Utilizare: whenkit [opțiune]',
    '',
    'Opțiuni:',
    '  --version, -v   afișează versiunea',
    '  --help, -h      afișează acest ajutor',
  ].join('\n'),
  unknownCommand: (name: string) =>
    `Comandă necunoscută: „${name}”. Rulează „whenkit --help” pentru lista comenzilor.`,
} as const;
