import {AuthorizationStatus, getMessaging} from '@react-native-firebase/messaging';
import {FirebaseNotificationAdapter, installFirebaseBackgroundHandler} from './FirebaseNotificationAdapter';

const mockMessagingInstance = {};
const mockOnMessage = jest.fn();
const mockOnTokenRefresh = jest.fn();
const mockSetBackgroundMessageHandler = jest.fn();
const mockRequestPermission = jest.fn();
const mockRegisterDeviceForRemoteMessages = jest.fn(async (..._args: unknown[]) => undefined);
const mockGetToken = jest.fn();

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => mockMessagingInstance),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  onMessage: (...args: unknown[]) => mockOnMessage(...args),
  onTokenRefresh: (...args: unknown[]) => mockOnTokenRefresh(...args),
  registerDeviceForRemoteMessages: (...args: unknown[]) => mockRegisterDeviceForRemoteMessages(...args),
  requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
  setBackgroundMessageHandler: (...args: unknown[]) => mockSetBackgroundMessageHandler(...args),
  AuthorizationStatus: {AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3},
}));

test('requests permission and registers a bounded native token', async () => {
  mockRequestPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
  mockGetToken.mockResolvedValue('native-token_1234567890');
  const adapter = new FirebaseNotificationAdapter();

  await expect(adapter.requestPermission()).resolves.toBe(true);
  await expect(adapter.register()).resolves.toMatchObject({schemaVersion: 'v1', token: 'native-token_1234567890'});
  expect(mockRegisterDeviceForRemoteMessages).toHaveBeenCalledTimes(1);
  expect(mockGetToken).toHaveBeenCalledTimes(1);
});

test('foreground handler accepts only the approved operational payload', async () => {
  const adapter = new FirebaseNotificationAdapter();
  const handler = jest.fn();
  const unsubscribe = jest.fn();
  mockOnMessage.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[1] as (message: {data?: Record<string, string>}) => Promise<void>;
    callback({data: {payload: JSON.stringify({schemaVersion: 'v1', notificationId: '11111111-1111-4111-8111-111111111111', kind: 'connection_lost', occurredAt: '2026-08-15T00:00:00.000Z'})}}).catch(() => undefined);
    return unsubscribe;
  });

  expect(adapter.onForegroundMessage(handler)).toBe(unsubscribe);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(handler).toHaveBeenCalledTimes(1);

  mockOnMessage.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[1] as (message: {data?: Record<string, string>}) => Promise<void>;
    callback({data: {payload: JSON.stringify({schemaVersion: 'v1', notificationId: '11111111-1111-4111-8111-111111111111', kind: 'connection_lost', occurredAt: '2026-08-15T00:00:00.000Z', amount: 500})}}).catch(() => undefined);
    return unsubscribe;
  });
  adapter.onForegroundMessage(handler);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(handler).toHaveBeenCalledTimes(1);
  expect(getMessaging).toHaveBeenCalled();
});

test('token refresh and background handler do not forward malformed data', async () => {
  const adapter = new FirebaseNotificationAdapter();
  const handler = jest.fn();
  mockOnTokenRefresh.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[1] as (token: string) => Promise<void>;
    callback('bad token with spaces').catch(() => undefined);
    return jest.fn();
  });
  adapter.onTokenRefresh(handler);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(handler).not.toHaveBeenCalled();

  installFirebaseBackgroundHandler();
  expect(mockSetBackgroundMessageHandler).toHaveBeenCalledTimes(1);
});
