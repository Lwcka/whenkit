import { version } from '../../package.json';
import { cliStrings } from '../shared/strings.ro';

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

/**
 * Handles the `whenkit` arguments and returns the process exit code.
 * Pure apart from the injected output streams, so tests call it directly.
 */
export function main(args: readonly string[], io: CliIo): number {
  const [command] = args;

  if (command === undefined || command === '--help' || command === '-h') {
    io.stdout(`${cliStrings.usage}\n`);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    io.stdout(`${version}\n`);
    return 0;
  }

  io.stderr(`${cliStrings.unknownCommand(command)}\n`);
  return 1;
}
