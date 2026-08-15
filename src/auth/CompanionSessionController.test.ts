import type {CompanionAuthExchange} from '../api/CompanionApi';
import type {CompanionSessionStore, StoredCompanionSession} from './SecureSessionStore';
import {CompanionSessionController} from './CompanionSessionController';

const user = {
  schemaVersion: 'v1' as const,
  userId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Creator',
  channels: [{channelId: '22222222-2222-4222-8222-222222222222', role: 'owner' as const}],
};

function createStore(initial: StoredCompanionSession | null = null) {
  let value = initial;
  return {
    store: {
      read: jest.fn(async () => value),
      write: jest.fn(async (next: StoredCompanionSession) => { value = next; }),
      clear: jest.fn(async () => { value = null; }),
    } satisfies CompanionSessionStore,
    get value() { return value; },
  };
}

const exchanged: CompanionAuthExchange = {
  accessToken: 'opaque-session-token-that-is-long-enough-1234567890',
  expiresAt: '2099-09-14T00:00:00.000Z',
  user,
};

test('sign-in persists before exposing the access token', async () => {
  const fixture = createStore();
  const exchange = jest.fn(async () => exchanged);
  const controller = new CompanionSessionController(fixture.store, exchange);

  await expect(controller.signIn('google-id-token', 'Pixel')).resolves.toEqual(user);
  await expect(controller.getAccessToken()).resolves.toBe(exchanged.accessToken);
  expect(fixture.store.write).toHaveBeenCalledWith({accessToken: exchanged.accessToken, expiresAt: exchanged.expiresAt});
  expect(controller.getCurrentUser()).toEqual(user);
});

test('secure-store write failure leaves the controller signed out', async () => {
  const fixture = createStore();
  fixture.store.write.mockRejectedValue(new Error('secure_storage_unavailable'));
  const controller = new CompanionSessionController(fixture.store, async () => exchanged);

  await expect(controller.signIn('google-id-token', 'Pixel')).rejects.toThrow('secure_storage_unavailable');
  await expect(controller.getAccessToken()).resolves.toBeNull();
  expect(controller.getCurrentUser()).toBeNull();
});

test('restore uses secure storage but does not invent a user projection', async () => {
  const session = {accessToken: exchanged.accessToken, expiresAt: exchanged.expiresAt};
  const fixture = createStore(session);
  const controller = new CompanionSessionController(fixture.store, async () => exchanged);

  await expect(controller.restore()).resolves.toBeNull();
  await expect(controller.getAccessToken()).resolves.toBe(session.accessToken);
  expect(controller.getCurrentUser()).toBeNull();
});

test('expired in-memory session is cleared before an API request can use it', async () => {
  const fixture = createStore({accessToken: exchanged.accessToken, expiresAt: '2020-01-01T00:00:00.000Z'});
  const controller = new CompanionSessionController(fixture.store, async () => exchanged);

  await controller.restore();
  await expect(controller.getAccessToken()).resolves.toBeNull();
  expect(fixture.store.clear).toHaveBeenCalledTimes(1);
});

test('sign-out clears the in-memory session before clearing persistent storage', async () => {
  const fixture = createStore();
  const controller = new CompanionSessionController(fixture.store, async () => exchanged);
  await controller.signIn('google-id-token', 'Pixel');

  await controller.signOut();
  await expect(controller.getAccessToken()).resolves.toBeNull();
  expect(controller.getCurrentUser()).toBeNull();
  expect(fixture.value).toBeNull();
});
