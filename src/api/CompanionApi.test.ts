import {CompanionApi, CompanionApiError} from './CompanionApi';

const CHANNEL_ID = '00000000-0000-4000-8000-000000000002';
const QUEUE_ID = '00000000-0000-4000-8000-000000000003';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test('requires a server-provided access token before making a request', async () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => null,
    fetchImpl,
  });

  await expect(api.getCurrentUser()).rejects.toEqual(
    new CompanionApiError(401, 'unauthorized'),
  );
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('exchanges a Google identity for an opaque BharatStudio session', async () => {
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => response(201, {
    schemaVersion: 'v1',
    accessToken: 'opaque-session-token-that-is-long-enough-1234567890',
    expiresAt: '2026-09-14T00:00:00.000Z',
    user: {schemaVersion: 'v1', userId: '00000000-0000-4000-8000-000000000001', displayName: 'Creator', channels: []},
  }));
  const api = new CompanionApi({baseUrl: 'https://api.example.test', getAccessToken: async () => null, fetchImpl});

  await expect(api.exchangeGoogleIdentity('google-id-token-that-is-long-enough', 'Companion mobile'))
    .resolves.toMatchObject({accessToken: expect.stringContaining('opaque-session'), user: {displayName: 'Creator'}});
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/auth/google/exchange',
    expect.objectContaining({method: 'POST', body: JSON.stringify({idToken: 'google-id-token-that-is-long-enough', deviceLabel: 'Companion mobile'})}),
  );
});

test('rejects an unsafe Google exchange input before network access', async () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({baseUrl: 'https://api.example.test', getAccessToken: async () => null, fetchImpl});

  await expect(api.exchangeGoogleIdentity('short', 'Companion mobile')).rejects.toThrow('Invalid Google identity token');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('uses the documented Companion state route and bearer header', async () => {
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) =>
    response(200, {
      schemaVersion: 'v1',
      channelId: CHANNEL_ID,
      overlayConnected: true,
      pendingAlerts: 2,
      lastUpdatedAt: '2026-08-15T00:00:00.000Z',
    }),
  );
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test/',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionState('channel/1')).resolves.toMatchObject({
    pendingAlerts: 2,
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/channels/channel%2F1/companion/state',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer opaque-test-token',
      }),
    }),
  );
});

test('rejects malformed Companion state before the UI can consume it', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1',
    channelId: CHANNEL_ID,
    overlayConnected: true,
    pendingAlerts: -1,
    lastUpdatedAt: 'not-a-date',
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionState('channel-1'))
    .rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

test('rejects non-contract identifiers and unknown response fields', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1',
    channelId: CHANNEL_ID,
    overlayConnected: true,
    pendingAlerts: 0,
    lastUpdatedAt: '2026-08-15T00:00:00.000Z',
    internalSecret: 'must-not-reach-ui',
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionState(CHANNEL_ID))
    .rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

test('loads the documented queue list so actions can carry an explicit target', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1',
    queues: [{schemaVersion: 'v1', queueId: QUEUE_ID, channelId: CHANNEL_ID, name: 'Main alerts', paused: false, active: true}],
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getQueues('channel/1')).resolves.toMatchObject({queues: [{queueId: QUEUE_ID}]});
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/channels/channel%2F1/queues',
    expect.objectContaining({headers: expect.objectContaining({Authorization: 'Bearer opaque-test-token'})}),
  );
});

test('loads activity, plan and account-session projections through documented routes', async () => {
  const fetchImpl = jest.fn()
    .mockResolvedValueOnce(response(200, {
      schemaVersion: 'v1', items: [{
        eventId: '00000000-0000-4000-8000-000000000010', sourceType: 'payment', status: 'acknowledged',
        createdAt: '2026-08-15T00:00:00.000Z', displayName: 'Viewer', message: 'Hello',
        grossAmountPaise: 50000, currency: 'INR',
      }], nextCursor: null,
    }))
    .mockResolvedValueOnce(response(200, {
      schemaVersion: 'v1', channelId: CHANNEL_ID, tier: 'creator', monthlyPricePaise: 39900,
      annualMonthsCharged: 10, annualServiceMonths: 12, renewalState: 'active', nextRenewalAt: null,
      billingInterval: 'monthly', autoRenew: true, currentPeriodEndsAt: null,
      priceProtectedUntil: null, priceSource: 'current',
    }))
    .mockResolvedValueOnce(response(200, {
      schemaVersion: 'v1', sessions: [{
        sessionId: '00000000-0000-4000-8000-000000000011', createdAt: '2026-08-15T00:00:00.000Z',
        lastSeenAt: '2026-08-15T00:00:00.000Z', current: true, deviceLabel: 'Companion mobile',
      }],
    }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getHistory(CHANNEL_ID)).resolves.toMatchObject({items: [{displayName: 'Viewer'}]});
  await expect(api.getBilling(CHANNEL_ID)).resolves.toMatchObject({tier: 'creator'});
  await expect(api.getSessions()).resolves.toMatchObject({sessions: [{current: true}]});
  expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
    `https://api.example.test/v1/channels/${CHANNEL_ID}/alert-history`,
    `https://api.example.test/v1/channels/${CHANNEL_ID}/billing`,
    'https://api.example.test/v1/me/sessions',
  ]);
});

test('loads and updates the server-owned action layout with an optimistic version', async () => {
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID, version: 1, tier: 'creator', maxSlots: 32,
    pageSize: 8, slots: [], createdAt: '2026-08-15T00:00:00.000Z',
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionLayout('channel/1')).resolves.toMatchObject({maxSlots: 32});
  await expect(api.updateCompanionLayout('channel/1', 0, 8, [])).resolves.toMatchObject({version: 1});
  expect(fetchImpl).toHaveBeenLastCalledWith(
    'https://api.example.test/v1/channels/channel%2F1/companion/layout',
    expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({'If-Match-Version': '0'}),
    }),
  );
});

test('rejects an unsupported action in a server-provided layout', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID, version: 1, tier: 'creator', maxSlots: 32,
    pageSize: 8,
    slots: [{slotIndex: 1, page: 1, label: 'Unsafe', action: 'run_shell', targetId: '00000000-0000-4000-8000-000000000001'}],
    createdAt: '2026-08-15T00:00:00.000Z',
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionLayout('channel-1'))
    .rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

test('rejects duplicate or out-of-range layout slots', async () => {
  const fetchImpl = jest.fn(async () => response(200, {
    schemaVersion: 'v1', channelId: CHANNEL_ID, version: 1, tier: 'free', maxSlots: 8,
    pageSize: 4,
    slots: [
      {slotIndex: 1, page: 1, label: 'Pause', action: 'pause_queue', targetId: QUEUE_ID},
      {slotIndex: 1, page: 1, label: 'Resume', action: 'resume_queue', targetId: QUEUE_ID},
    ],
    createdAt: null,
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.getCompanionLayout(CHANNEL_ID))
    .rejects.toEqual(new CompanionApiError(200, 'request_failed'));
});

test('maps private action errors without exposing response bodies', async () => {
  const fetchImpl = jest.fn(async () => response(403, {
    secret: 'must-not-leak',
  }));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.executeAction('channel-1', 'pause_queue', 'idempotency-key-001', QUEUE_ID))
    .rejects.toEqual(new CompanionApiError(403, 'forbidden'));
});

test('rejects a Companion action without its queue target before network access', () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  expect(() => api.executeAction('channel-1', 'pause_queue', 'idempotency-key-001', ''))
    .toThrow('Companion action requires a queue target');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('rejects an idempotency key shorter than the server contract before network access', () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  expect(() => api.executeAction('channel-1', 'pause_queue', 'idem-1', QUEUE_ID))
    .toThrow('Invalid idempotency key');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('rejects non-HTTPS production API origins', () => {
  expect(() => new CompanionApi({
    baseUrl: 'http://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
})).toThrow('requires HTTPS');
});

test('uses a bounded request timeout and maps transport failures safely', async () => {
  const fetchImpl = jest.fn(async () => {
    throw new Error('private network details must not escape');
  });
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
    requestTimeoutMs: 1_000,
  });

  await expect(api.getCurrentUser()).rejects.toEqual(new CompanionApiError(0, 'request_failed'));
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://api.example.test/v1/me',
    expect.objectContaining({signal: expect.any(Object)}),
  );
});

test('rejects an unsafe request timeout before network access', () => {
  expect(() => new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    requestTimeoutMs: 999,
  })).toThrow('between 1000 and 60000');
});

test('rejects an invalid runtime action before network access', async () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  expect(() => api.executeAction('channel-1', 'delete_everything' as never, 'idem-1', QUEUE_ID))
    .toThrow('Invalid Companion action');
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('acquires and revokes a server-owned control session', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(response(201, {
      schemaVersion: 'v1',
      sessionId: '00000000-0000-4000-8000-000000000401',
      channelId: CHANNEL_ID,
      clientType: 'mobile',
      clientInstanceId: 'mobile-instance-0001',
      leaseUntil: '2026-08-15T00:05:00.000Z',
      createdAt: '2026-08-15T00:00:00.000Z',
      reused: false,
    }))
    .mockResolvedValueOnce(response(204, null));
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  await expect(api.acquireControlSession('channel/1', 'mobile', 'mobile-instance-0001'))
    .resolves.toMatchObject({sessionId: '00000000-0000-4000-8000-000000000401'});
  await expect(api.revokeControlSession('channel/1', '00000000-0000-4000-8000-000000000401')).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenNthCalledWith(
    1,
    'https://api.example.test/v1/channels/channel%2F1/companion/control-session',
    expect.objectContaining({method: 'POST', body: JSON.stringify({clientType: 'mobile', clientInstanceId: 'mobile-instance-0001'})}),
  );
  expect(fetchImpl).toHaveBeenNthCalledWith(
    2,
    'https://api.example.test/v1/channels/channel%2F1/companion/control-session/00000000-0000-4000-8000-000000000401',
    expect.objectContaining({method: 'DELETE'}),
  );
});

test('rejects invalid control-session inputs before network access', async () => {
  const fetchImpl = jest.fn();
  const api = new CompanionApi({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'opaque-test-token',
    fetchImpl,
  });

  expect(() => api.acquireControlSession('channel-1', 'tablet' as never, 'mobile-instance-0001'))
    .toThrow('Invalid Companion control client type');
  expect(() => api.acquireControlSession('channel-1', 'mobile', 'short'))
    .toThrow('Invalid Companion control client instance');
  await expect(api.revokeControlSession('channel-1', 'not-a-uuid'))
    .rejects.toThrow('Invalid Companion control session id');
  expect(fetchImpl).not.toHaveBeenCalled();
});
