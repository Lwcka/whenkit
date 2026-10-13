import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '../core/ports';

export const systemClock: Clock = {
  now: () => new Date(),
};

/** UUID v4 ids from the platform's CSPRNG. */
export const randomIdGenerator: IdGenerator = {
  newId: () => randomUUID(),
};
