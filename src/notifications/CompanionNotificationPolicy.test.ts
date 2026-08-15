import {nextBackgroundRefreshAt, notificationCopy, parseNotification, parseRegistration} from './CompanionNotificationPolicy';

const base = {
  schemaVersion: 'v1' as const,
  notificationId: '11111111-1111-4111-8111-111111111111',
  kind: 'connection_lost' as const,
  occurredAt: '2026-08-15T00:00:00.000Z',
};

test('accepts only privacy-minimised operational notifications', () => {
  expect(parseNotification(base)).toEqual(base);
  expect(notificationCopy(base)).toBe('A Companion connection needs attention.');
  expect(() => parseNotification({...base, amount: 500})).toThrow('Invalid Companion notification');
  expect(() => parseNotification({...base, message: 'donor message'})).toThrow('Invalid Companion notification');
});

test('accepts bounded platform registration tokens only', () => {
  expect(parseRegistration({schemaVersion: 'v1', platform: 'android', token: 'token_1234567890'})).toEqual({schemaVersion: 'v1', platform: 'android', token: 'token_1234567890'});
  expect(() => parseRegistration({schemaVersion: 'v1', platform: 'ios', token: 'short'})).toThrow('Invalid notification registration');
  expect(() => parseRegistration({schemaVersion: 'v1', platform: 'ios', token: 'token with spaces 123456'})).toThrow('Invalid notification registration');
});

test('computes a bounded background refresh time', () => {
  expect(nextBackgroundRefreshAt(1_000, 60_000)).toBe(61_000);
  expect(() => nextBackgroundRefreshAt(1_000, 59_999)).toThrow('Invalid background refresh interval');
  expect(() => nextBackgroundRefreshAt(1_000, 86_400_001)).toThrow('Invalid background refresh interval');
});
