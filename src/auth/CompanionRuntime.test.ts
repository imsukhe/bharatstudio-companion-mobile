import type {FetchLike} from '../api/CompanionApi';
import {CompanionRuntime} from './CompanionRuntime';
import type {CompanionSessionStore, StoredCompanionSession} from './SecureSessionStore';

const session: StoredCompanionSession = {
  accessToken: 'opaque-session-token-that-is-long-enough-1234567890',
  expiresAt: '2099-09-14T00:00:00.000Z',
};

const userPayload = {
  schemaVersion: 'v1',
  userId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Creator',
  channels: [{channelId: '22222222-2222-4222-8222-222222222222', role: 'owner'}],
};

function storeFixture(initial: StoredCompanionSession | null = null) {
  let value = initial;
  return {
    store: {
      read: jest.fn(async () => value),
      write: jest.fn(async (next: StoredCompanionSession) => { value = next; }),
      clear: jest.fn(async () => { value = null; }),
    } satisfies CompanionSessionStore,
  };
}

function response(body: unknown, status = 200): Response {
  return {ok: status >= 200 && status < 300, status, json: async () => body} as Response;
}

test('restores a secure session only after server user projection succeeds', async () => {
  const fixture = storeFixture(session);
  const fetchImpl: FetchLike = jest.fn(async (_input, init) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${session.accessToken}`);
    return response(userPayload);
  });
  const runtime = new CompanionRuntime('https://api.example.test', fixture.store, async () => ({idToken: 'google-identity-token-long-enough-for-client-validation', deviceLabel: 'Pixel'}), fetchImpl);

  await expect(runtime.restore()).resolves.toEqual(userPayload);
  expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/v1/me', expect.anything());
});

test('restore fails closed and clears the session when the server rejects it', async () => {
  const fixture = storeFixture(session);
  const fetchImpl: FetchLike = jest.fn(async () => response({}, 401));
  const runtime = new CompanionRuntime('https://api.example.test', fixture.store, async () => ({idToken: 'google-identity-token-long-enough-for-client-validation', deviceLabel: 'Pixel'}), fetchImpl);

  await expect(runtime.restore()).resolves.toBeNull();
  expect(fixture.store.clear).toHaveBeenCalledTimes(1);
  await expect(runtime.sessions.getAccessToken()).resolves.toBeNull();
});

test('sign-in obtains a platform credential through the injected provider', async () => {
  const fixture = storeFixture();
  const fetchImpl: FetchLike = jest.fn(async (_input, init) => {
    if (String(_input).endsWith('/v1/auth/google/exchange')) {
      expect(init?.method).toBe('POST');
      return response({schemaVersion: 'v1', accessToken: session.accessToken, expiresAt: session.expiresAt, user: userPayload});
    }
    throw new Error('unexpected request');
  });
  const credential = jest.fn(async () => ({idToken: 'google-identity-token-long-enough-for-client-validation', deviceLabel: 'Pixel'}));
  const runtime = new CompanionRuntime('https://api.example.test', fixture.store, credential, fetchImpl);

  await expect(runtime.signIn()).resolves.toEqual(userPayload);
  expect(credential).toHaveBeenCalledTimes(1);
  expect(fixture.store.write).toHaveBeenCalledWith(session);
});

test('loads only the server-owned channel projections after authentication', async () => {
  const fixture = storeFixture(session);
  const channelId = '22222222-2222-4222-8222-222222222222';
  const fetchImpl: FetchLike = jest.fn(async (input) => {
    const url = String(input);
    if (url.endsWith('/companion/state')) return response({schemaVersion: 'v1', channelId, overlayConnected: true, pendingAlerts: 2, lastUpdatedAt: '2026-08-15T00:00:00.000Z', helperPaired: false, obsConnected: false, obsStatusReportedAt: null, paymentAccountConnected: false, mirrorReachable: false, streamPaired: false});
    if (url.endsWith('/queues')) return response({schemaVersion: 'v1', queues: [{schemaVersion: 'v1', queueId: '33333333-3333-4333-8333-333333333333', channelId, name: 'Main', paused: false, active: true}]});
    if (url.endsWith('/alert-history')) return response({schemaVersion: 'v1', items: [], nextCursor: null});
    if (url.endsWith('/billing')) return response({schemaVersion: 'v1', channelId, tier: 'creator', monthlyPricePaise: 39900, annualMonthsCharged: 10, annualServiceMonths: 12, renewalState: 'active', nextRenewalAt: null, billingInterval: 'monthly', autoRenew: true, currentPeriodEndsAt: null, priceProtectedUntil: null, priceSource: 'current'});
    if (url.endsWith('/sessions')) return response({schemaVersion: 'v1', sessions: []});
    throw new Error(`unexpected request: ${url}`);
  });
  const runtime = new CompanionRuntime('https://api.example.test', fixture.store, async () => ({idToken: 'google-identity-token-long-enough-for-client-validation', deviceLabel: 'Pixel'}), fetchImpl);

  await runtime.sessions.restore();
  await expect(runtime.loadChannelProjection(channelId)).resolves.toMatchObject({channelId, state: {pendingAlerts: 2}, queues: [{name: 'Main'}], billing: {tier: 'creator'}, sessions: []});
  expect(fetchImpl).toHaveBeenCalledTimes(5);
});
