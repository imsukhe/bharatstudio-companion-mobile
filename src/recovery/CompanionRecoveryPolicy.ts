import type {CompanionApiError} from '../api/CompanionApi';

export type CompanionConnectionState = 'online' | 'retrying' | 'offline' | 'reauthenticate' | 'failed';

export type RecoveryDecision = {
  state: CompanionConnectionState;
  retry: boolean;
  retryAfterMs: number | null;
};

const MAX_RETRY_ATTEMPTS = 6;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

export function retryDelayMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error('Invalid retry attempt');
  const boundedAttempt = Math.min(attempt, MAX_RETRY_ATTEMPTS);
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** boundedAttempt));
}

export function decideRecovery(error: unknown, attempt: number): RecoveryDecision {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error('Invalid retry attempt');

  const status = isCompanionApiError(error) ? error.status : 0;
  if (status === 401) return {state: 'reauthenticate', retry: false, retryAfterMs: null};
  if (status === 403) return {state: 'failed', retry: false, retryAfterMs: null};
  if (status >= 400 && status < 500) return {state: 'failed', retry: false, retryAfterMs: null};

  if (attempt >= MAX_RETRY_ATTEMPTS) {
    return {state: 'offline', retry: false, retryAfterMs: null};
  }
  return {
    state: attempt === 0 ? 'retrying' : 'offline',
    retry: true,
    retryAfterMs: retryDelayMs(attempt),
  };
}

export function onlineDecision(): RecoveryDecision {
  return {state: 'online', retry: false, retryAfterMs: null};
}

function isCompanionApiError(error: unknown): error is CompanionApiError {
  return typeof error === 'object' && error !== null && 'status' in error
    && typeof (error as {status?: unknown}).status === 'number';
}
