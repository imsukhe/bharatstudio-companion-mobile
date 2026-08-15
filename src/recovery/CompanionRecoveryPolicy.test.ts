import {CompanionApiError} from '../api/CompanionApi';
import {decideRecovery, onlineDecision, retryDelayMs} from './CompanionRecoveryPolicy';

test('uses bounded exponential delays', () => {
  expect(retryDelayMs(0)).toBe(1_000);
  expect(retryDelayMs(3)).toBe(8_000);
  expect(retryDelayMs(99)).toBe(60_000);
  expect(() => retryDelayMs(-1)).toThrow('Invalid retry attempt');
});

test('retries transport and server failures, then enters offline state', () => {
  expect(decideRecovery(new CompanionApiError(0, 'request_failed'), 0)).toEqual({state: 'retrying', retry: true, retryAfterMs: 1_000});
  expect(decideRecovery(new CompanionApiError(503, 'request_failed'), 2)).toEqual({state: 'offline', retry: true, retryAfterMs: 4_000});
  expect(decideRecovery(new CompanionApiError(503, 'request_failed'), 6)).toEqual({state: 'offline', retry: false, retryAfterMs: null});
});

test('never retries authentication, authorization or client-contract failures', () => {
  expect(decideRecovery(new CompanionApiError(401, 'unauthorized'), 0)).toEqual({state: 'reauthenticate', retry: false, retryAfterMs: null});
  expect(decideRecovery(new CompanionApiError(403, 'forbidden'), 0)).toEqual({state: 'failed', retry: false, retryAfterMs: null});
  expect(decideRecovery(new CompanionApiError(409, 'conflict'), 0)).toEqual({state: 'failed', retry: false, retryAfterMs: null});
});

test('online transition is explicit and has no queued side effect', () => {
  expect(onlineDecision()).toEqual({state: 'online', retry: false, retryAfterMs: null});
});
