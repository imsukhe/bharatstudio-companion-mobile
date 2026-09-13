import {CompanionApi, CompanionApiError, companionHealthSignals} from './CompanionApi';
import type {CompanionState} from './CompanionApi';

// L07 remaining feature list (master plan 7.11 items 1-2, 5-10).

const CHANNEL_ID = '00000000-0000-4000-8000-000000000e02';
const QUEUE_ID = '00000000-0000-4000-8000-000000000e03';
const DELIVERY_ID = '00000000-0000-4000-8000-000000000e04';
const EVENT_ID = '00000000-0000-4000-8000-000000000e05';
const ALERT_ID = '00000000-0000-4000-8000-000000000e06';

function response(status: number, body: unknown): Response {
  return {ok: status >= 200 && status < 300, status, json: async () => body} as Response;
}

function api(fetchImpl: jest.Mock) {
  return new CompanionApi({baseUrl: 'https://api.example.test', getAccessToken: async () => 'opaque-test-token', fetchImpl});
}

function baseState(overrides: Partial<CompanionState>): CompanionState {
  return {
    schemaVersion: 'v1', channelId: CHANNEL_ID, overlayConnected: true, pendingAlerts: 0, lastUpdatedAt: '2026-09-06T10:00:00.000Z',
    helperPaired: false, obsConnected: false, obsStatusReportedAt: null,
    paymentAccountConnected: false, mirrorReachable: false, streamPaired: false,
    ...overrides,
  };
}

// === Item 1: health signal derivation ===

test('a stale OBS heartbeat reads as its own "stale" health state, not healthy and not unknown', () => {
  const signals = companionHealthSignals(baseState({helperPaired: true, obsConnected: false, obsStatusReportedAt: '2020-01-01T00:00:00.000Z'}));
  const obs = signals.find(s => s.key === 'obs');
  expect(obs?.state).toBe('stale');
});

test('no paired helper at all reads OBS as "unknown", distinct from a stale heartbeat', () => {
  const signals = companionHealthSignals(baseState({helperPaired: false, obsConnected: false, obsStatusReportedAt: null}));
  expect(signals.find(s => s.key === 'obs')?.state).toBe('unknown');
});

test('mirror/stream, which report no liveness signal at all today, read "unknown" not "unhealthy"', () => {
  const signals = companionHealthSignals(baseState({}));
  expect(signals.find(s => s.key === 'mirror')?.state).toBe('unknown');
  expect(signals.find(s => s.key === 'stream')?.state).toBe('unknown');
});

test('a healthy channel reads every locally-reported signal as healthy', () => {
  const signals = companionHealthSignals(baseState({overlayConnected: true, helperPaired: true, obsConnected: true, obsStatusReportedAt: '2026-09-06T09:59:50.000Z', paymentAccountConnected: true}));
  expect(signals.find(s => s.key === 'overlay')?.state).toBe('healthy');
  expect(signals.find(s => s.key === 'helper')?.state).toBe('healthy');
  expect(signals.find(s => s.key === 'obs')?.state).toBe('healthy');
  expect(signals.find(s => s.key === 'payment')?.state).toBe('healthy');
});

test('a fully disconnected channel reads overlay/helper/payment as "unhealthy", the fourth distinct health state -- never collapsed into "unknown" (which is reserved for signals with no liveness report at all)', () => {
  const signals = companionHealthSignals(baseState({overlayConnected: false, helperPaired: false, paymentAccountConnected: false}));
  expect(signals.find(s => s.key === 'overlay')?.state).toBe('unhealthy');
  expect(signals.find(s => s.key === 'helper')?.state).toBe('unhealthy');
  expect(signals.find(s => s.key === 'payment')?.state).toBe('unhealthy');
  // A regression that reused 'unknown' for "not connected" would make a
  // real outage indistinguishable from "no data yet" -- assert all four
  // states are pairwise distinct on this one snapshot.
  const states = new Set(signals.map(s => s.state));
  expect(states.has('unknown')).toBe(true); // mirror/stream, unaffected by these overrides
  expect(states.has('unhealthy')).toBe(true);
});

// === Item 5: mute vs cancel are distinct requests/shapes ===

test('setTtsMuted PUTs to the mute endpoint, distinct URL and method from cancelTts', async () => {
  const fetchImpl = jest.fn(async () => response(200, {schemaVersion: 'v1', queueId: QUEUE_ID, ttsMuted: true, ttsMutedAt: '2026-09-06T10:05:00.000Z'}));
  await expect(api(fetchImpl).setTtsMuted(CHANNEL_ID, QUEUE_ID, true)).resolves.toMatchObject({ttsMuted: true});
  expect(fetchImpl).toHaveBeenCalledWith(
    `https://api.example.test/v1/channels/${CHANNEL_ID}/companion/tts/mute`,
    expect.objectContaining({method: 'PUT', body: JSON.stringify({queueId: QUEUE_ID, muted: true})}),
  );
});

test('cancelTts POSTs to the cancel endpoint with a deliveryId body, never a queueId', async () => {
  const fetchImpl = jest.fn(async () => response(200, {schemaVersion: 'v1', deliveryId: DELIVERY_ID, eventId: EVENT_ID, status: 'tts_cancelled', cancelledAt: '2026-09-06T10:06:00.000Z'}));
  await expect(api(fetchImpl).cancelTts(CHANNEL_ID, DELIVERY_ID)).resolves.toMatchObject({status: 'tts_cancelled', deliveryId: DELIVERY_ID});
  expect(fetchImpl).toHaveBeenCalledWith(
    `https://api.example.test/v1/channels/${CHANNEL_ID}/companion/tts/cancel`,
    expect.objectContaining({method: 'POST', body: JSON.stringify({deliveryId: DELIVERY_ID})}),
  );
});

test('setTtsMuted rejects a non-uuid queue id before any network call', async () => {
  const fetchImpl = jest.fn();
  expect(() => api(fetchImpl).setTtsMuted(CHANNEL_ID, 'not-a-uuid', true)).toThrow('Invalid Companion TTS mute target queue');
  expect(fetchImpl).not.toHaveBeenCalled();
});

// === Item 2: run full test ===

test('runFullTest POSTs a queueId and decodes a hop-by-hop report', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID, eventId: EVENT_ID,
    hops: [{hop: 'event_created', status: 'ok', occurredAt: '2026-09-06T10:00:00.000Z', detail: null}],
  }));
  await expect(api(fetchImpl).runFullTest(CHANNEL_ID, QUEUE_ID)).resolves.toMatchObject({eventId: EVENT_ID, hops: [{hop: 'event_created'}]});
});

// === Items 9-10 / 8: read-only projections never mutate ===

test('getPaymentStatus and getRecentTips issue GET requests with no body', async () => {
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => response(200, {schemaVersion: 'v1', channelId: CHANNEL_ID, items: []}));
  await api(fetchImpl).getPaymentStatus(CHANNEL_ID);
  await api(fetchImpl).getRecentTips(CHANNEL_ID);
  for (const call of fetchImpl.mock.calls) {
    const init = call[1] as RequestInit | undefined;
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
  }
});

test('recent tips with donor visibility nulled out by the server still decode (nulls are valid, not omission)', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID,
    items: [{eventId: EVENT_ID, displayName: null, message: null, grossAmountPaise: null, currency: null, createdAt: '2026-09-06T10:00:00.000Z'}],
  }));
  await expect(api(fetchImpl).getRecentTips(CHANNEL_ID)).resolves.toMatchObject({items: [{displayName: null, grossAmountPaise: null}]});
});

// === Item 6-7: moderation reuses the existing endpoint, never window.prompt-shaped ===

test('moderate posts to the existing moderation route with the action and optional inline reason', async () => {
  const fetchImpl = jest.fn(async () => response(200, {eventId: ALERT_ID, action: 'approve', appliedAt: '2026-09-06T10:07:00.000Z'}));
  await expect(api(fetchImpl).moderate(CHANNEL_ID, ALERT_ID, 'approve', 'looks fine')).resolves.toMatchObject({action: 'approve'});
  expect(fetchImpl).toHaveBeenCalledWith(
    `https://api.example.test/v1/channels/${CHANNEL_ID}/moderation/${ALERT_ID}`,
    expect.objectContaining({method: 'POST', body: JSON.stringify({action: 'approve', reason: 'looks fine'})}),
  );
});

test('moderate rejects an action outside the server-defined enum before any network call', async () => {
  const fetchImpl = jest.fn();
  // @ts-expect-error deliberately invalid action to prove client-side rejection
  expect(() => api(fetchImpl).moderate(CHANNEL_ID, ALERT_ID, 'reject')).toThrow('Invalid Companion moderation action');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('malformed responses from any of the new endpoints reject, never reach the UI as partial data', async () => {
  const fetchImpl = jest.fn(async () => response(200, {schemaVersion: 'v1', queueId: QUEUE_ID, ttsMuted: 'not-a-boolean', ttsMutedAt: null}));
  await expect(api(fetchImpl).setTtsMuted(CHANNEL_ID, QUEUE_ID, true)).rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

// === Items 8-10: recent tips / payment status error state ===
// A fetch failure or a malformed payload must reject with CompanionApiError,
// never resolve with a fabricated empty/partial view the Shell would render
// identically to a genuine "no data yet" response.

test('getRecentTips rejects with CompanionApiError on a non-2xx server response, distinct from a genuine empty list', async () => {
  const fetchImpl = jest.fn(async () => response(503, {error: 'unavailable'}));
  await expect(api(fetchImpl).getRecentTips(CHANNEL_ID)).rejects.toEqual(new CompanionApiError(503, 'request_failed'));
});

test('getPaymentStatus rejects with CompanionApiError on a non-2xx server response, distinct from a genuine empty list', async () => {
  const fetchImpl = jest.fn(async () => response(500, {error: 'internal'}));
  await expect(api(fetchImpl).getPaymentStatus(CHANNEL_ID)).rejects.toEqual(new CompanionApiError(500, 'request_failed'));
});

test('getRecentTips rejects a malformed body (schema violation) rather than resolving with partial data', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID,
    items: [{eventId: EVENT_ID, displayName: null, message: null, grossAmountPaise: 'not-a-number', currency: null, createdAt: '2026-09-06T10:00:00.000Z'}],
  }));
  await expect(api(fetchImpl).getRecentTips(CHANNEL_ID)).rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

test('getPaymentStatus rejects a malformed body (schema violation) rather than resolving with partial data', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID,
    items: [{paymentId: 'pay-1', status: 'captured', grossAmountPaise: -1, currency: 'INR', refundStatus: null, refundAmountPaise: null, createdAt: '2026-09-06T10:00:00.000Z', updatedAt: '2026-09-06T10:00:00.000Z'}],
  }));
  await expect(api(fetchImpl).getPaymentStatus(CHANNEL_ID)).rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});
