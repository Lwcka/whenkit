// The notes fields that are on screen register here what saves their pending
// text, so the window can flush them all when it closes (AD-20): main asks,
// preload calls `flushAllNotes`, and answers main when it settles.

type Flush = () => Promise<void>;

const registered = new Set<Flush>();

/** Registers a field's flush; returns the function that removes it. */
export function registerNotesFlush(flush: Flush): () => void {
  registered.add(flush);
  return () => {
    registered.delete(flush);
  };
}

/**
 * Runs every registered flush and waits for all of them. A flush that fails
 * is swallowed: the window must still answer main, and the field already
 * shows its own error.
 */
export async function flushAllNotes(): Promise<void> {
  await Promise.all(
    [...registered].map(async (flush) => {
      try {
        await flush();
      } catch {
        // See above.
      }
    }),
  );
}
