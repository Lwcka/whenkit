import type { WhenkitApi } from '../../shared/ipc';

declare global {
  interface Window {
    /** The bridge preload exposes (AD-9). */
    whenkit: WhenkitApi;
  }
}
