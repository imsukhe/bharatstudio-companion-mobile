import * as Keychain from 'react-native-keychain';
import {KeychainCompanionSessionStore} from './SecureSessionStore';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly'},
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

const keychain = Keychain as jest.Mocked<typeof Keychain>;

beforeEach(() => jest.clearAllMocks());

test('writes and reads a non-expired session through the device-secure service', async () => {
  keychain.setGenericPassword.mockResolvedValue({service: 'in.bharatstudio.companion.session.v1'} as never);
  keychain.getGenericPassword.mockResolvedValue({
    service: 'in.bharatstudio.companion.session.v1',
    username: 'bharatstudio-companion',
    password: JSON.stringify({accessToken: 'opaque-session-token-that-is-long-enough-1234567890', expiresAt: '2099-09-14T00:00:00.000Z'}),
  } as never);
  const store = new KeychainCompanionSessionStore();
  const session = {accessToken: 'opaque-session-token-that-is-long-enough-1234567890', expiresAt: '2099-09-14T00:00:00.000Z'};

  await expect(store.write(session)).resolves.toBeUndefined();
  expect(keychain.setGenericPassword).toHaveBeenCalledWith(
    'bharatstudio-companion', JSON.stringify(session), expect.objectContaining({
      service: 'in.bharatstudio.companion.session.v1',
      accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    }),
  );
  await expect(store.read()).resolves.toEqual(session);
});

test('clears malformed and expired sessions instead of returning them', async () => {
  keychain.getGenericPassword
    .mockResolvedValueOnce({password: '{not-json'} as never)
    .mockResolvedValueOnce({password: JSON.stringify({accessToken: 'opaque-session-token-that-is-long-enough-1234567890', expiresAt: '2020-01-01T00:00:00.000Z'})} as never);
  keychain.resetGenericPassword.mockResolvedValue(true);
  const store = new KeychainCompanionSessionStore();

  await expect(store.read()).resolves.toBeNull();
  await expect(store.read()).resolves.toBeNull();
  expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(2);
});

test('rejects expired sessions and never falls back to another storage', async () => {
  const store = new KeychainCompanionSessionStore();
  await expect(store.write({accessToken: 'opaque-session-token-that-is-long-enough-1234567890', expiresAt: '2020-01-01T00:00:00.000Z'})).rejects.toThrow('invalid_session');
  expect(keychain.setGenericPassword).not.toHaveBeenCalled();
});

