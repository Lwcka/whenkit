import { useEffect, useRef } from 'react';

/**
 * A ref that holds the latest `value`, updated after every render. Listeners
 * registered once (Esc, keys, timers) read it, so they see the current
 * closure without being registered again.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
