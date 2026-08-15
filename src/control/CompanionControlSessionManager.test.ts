import type {CompanionControlSession} from '../api/CompanionApi';
import {CompanionControlSessionManager} from './CompanionControlSessionManager';

const first: CompanionControlSession = {
  schemaVersion: 'v1',
  sessionId: '11111111-1111-4111-8111-111111111111',
  channelId: '22222222-2222-4222-8222-222222222222',
  clientType: 'mobile',
  clientInstanceId: 'mobile-instance-123456',
  leaseUntil: '2099-09-14T00:00:00.000Z',
  createdAt: '2026-08-15T00:00:00.000Z',
  reused: false,
};

const renewed = {...first, leaseUntil: '2099-09-14T00:05:00.000Z', reused: true};

function apiFixture() {
  return {
    acquireControlSession: jest.fn<Promise<CompanionControlSession>, [string, 'mobile', string]>(),
    revokeControlSession: jest.fn<Promise<void>, [string, string]>(),
  };
}

test('acquires and renews the same server-owned session', async () => {
  const api = apiFixture();
  api.acquireControlSession.mockResolvedValueOnce(first).mockResolvedValueOnce(renewed);
  const manager = new CompanionControlSessionManager(api, first.channelId, first.clientInstanceId);

  await expect(manager.acquire()).resolves.toEqual(first);
  await expect(manager.renew()).resolves.toEqual(renewed);
  expect(manager.isActive()).toBe(true);
  expect(api.acquireControlSession).toHaveBeenNthCalledWith(2, first.channelId, 'mobile', first.clientInstanceId);
});

test('fails closed if renewal returns a different session', async () => {
  const api = apiFixture();
  api.acquireControlSession.mockResolvedValueOnce(first).mockResolvedValueOnce({...first, sessionId: '33333333-3333-4333-8333-333333333333'});
  const manager = new CompanionControlSessionManager(api, first.channelId, first.clientInstanceId);

  await manager.acquire();
  await expect(manager.renew()).rejects.toThrow('control_session_replaced');
  expect(manager.getCurrent()).toBeNull();
});

test('revoke clears local state before calling the server', async () => {
  const api = apiFixture();
  api.acquireControlSession.mockResolvedValue(first);
  const manager = new CompanionControlSessionManager(api, first.channelId, first.clientInstanceId);
  await manager.acquire();

  await manager.revoke();
  expect(manager.getCurrent()).toBeNull();
  expect(api.revokeControlSession).toHaveBeenCalledWith(first.channelId, first.sessionId);
  await manager.revoke();
  expect(api.revokeControlSession).toHaveBeenCalledTimes(1);
});

test('expired sessions are not considered active', async () => {
  const api = apiFixture();
  api.acquireControlSession.mockResolvedValue({...first, leaseUntil: '2020-01-01T00:00:00.000Z'});
  const manager = new CompanionControlSessionManager(api, first.channelId, first.clientInstanceId);

  await manager.acquire();
  expect(manager.isActive()).toBe(false);
});
