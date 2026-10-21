import { isExternalUrl, type IpcResult } from '../../shared/ipc';
import { failure, logQuietly } from './catalog';

/**
 * The `shell:openExternal` answer (AD-9, AD-18). The renderer is not trusted:
 * only `http:`/`https:` URLs reach `open`, whatever the window asked for.
 * Anything else is `ARGUMENTS_INVALID`; a failing `open` is logged and is
 * `INTERNAL`. Never throws.
 */
export async function openExternalResult(
  url: unknown,
  open: (url: string) => Promise<void>,
  logError: (error: unknown) => void = console.error,
): Promise<IpcResult<null>> {
  if (!isExternalUrl(url)) {
    return failure('ARGUMENTS_INVALID');
  }
  try {
    await open(url);
    return { ok: true, data: null };
  } catch (error) {
    logQuietly(logError, error);
    return failure('INTERNAL');
  }
}
