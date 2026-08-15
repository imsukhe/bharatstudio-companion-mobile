export type CompanionAction =
  | 'pause_queue'
  | 'resume_queue'
  | 'send_test_alert';

export type CurrentUser = {
  schemaVersion: 'v1';
  userId: string;
  displayName?: string | null;
  channels: Array<{channelId: string; role: 'owner' | 'admin' | 'operator' | 'moderator' | 'viewer'}>;
};

export type CompanionAuthExchange = {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
};

export type CompanionState = {
  schemaVersion: 'v1';
  channelId: string;
  overlayConnected: boolean;
  pendingAlerts: number;
  lastUpdatedAt: string;
};

export type CompanionAlertHistory = {
  eventId: string;
  sourceType: 'payment' | 'manual' | 'companion';
  status: 'accepted' | 'held' | 'displayed' | 'acknowledged' | 'failed' | 'quarantined' | 'suppressed';
  createdAt: string;
  displayName: string | null;
  message: string | null;
  grossAmountPaise: number | null;
  currency: 'INR' | null;
};

export type CompanionBilling = {
  schemaVersion: 'v1';
  channelId: string;
  tier: 'free' | 'pro' | 'creator' | 'studio';
  monthlyPricePaise: number;
  annualMonthsCharged: 10;
  annualServiceMonths: 12;
  renewalState: 'not_applicable' | 'active' | 'past_due' | 'cancelled';
  nextRenewalAt: string | null;
  billingInterval: 'monthly' | 'annual';
  autoRenew: boolean;
  currentPeriodEndsAt: string | null;
  priceProtectedUntil: string | null;
  priceSource: 'current' | 'grandfathered';
};

export type CompanionAccountSession = {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
  deviceLabel: string | null;
};

export type CompanionActionSlot = {
  slotIndex: number;
  page: number;
  label: string;
  action: CompanionAction;
  targetId: string;
};

export type CompanionLayout = {
  schemaVersion: 'v1';
  channelId: string;
  version: number;
  tier: 'free' | 'pro' | 'creator' | 'studio';
  maxSlots: 8 | 16 | 32 | 64;
  pageSize: 4 | 8 | 16;
  slots: CompanionActionSlot[];
  createdAt: string | null;
};

export type CompanionQueue = {
  schemaVersion: 'v1';
  queueId: string;
  channelId: string;
  name: string;
  paused: boolean;
  active: boolean;
};

export type CompanionQueueList = {
  schemaVersion: 'v1';
  queues: CompanionQueue[];
};

export type CompanionActionResult = {
  schemaVersion: 'v1';
  commandId: string;
  status: 'accepted' | 'rejected';
  acceptedAt: string;
  eventId?: string;
};

export type CompanionControlSession = {
  schemaVersion: 'v1';
  sessionId: string;
  channelId: string;
  clientType: 'web' | 'mobile' | 'desktop';
  clientInstanceId: string;
  leaseUntil: string;
  createdAt: string;
  reused: boolean;
};

export type CompanionNotificationPreferences = {
  schemaVersion: 'v1';
  connectionAlerts: boolean;
  securityAlerts: boolean;
  actionFailures: boolean;
};

export type CompanionNotificationDevice = {
  schemaVersion: 'v1';
  deviceId: string;
  platform: 'ios' | 'android';
  enabled: boolean;
  createdAt: string;
  lastSeenAt: string;
};

const allowedClientTypes = new Set<CompanionControlSession['clientType']>([
  'web',
  'mobile',
  'desktop',
]);

const allowedActions = new Set<CompanionAction>([
  'pause_queue',
  'resume_queue',
  'send_test_alert',
]);

const allowedRoles = new Set<CurrentUser['channels'][number]['role']>([
  'owner',
  'admin',
  'operator',
  'moderator',
  'viewer',
]);

const allowedTiers = new Set<CompanionLayout['tier']>([
  'free',
  'pro',
  'creator',
  'studio',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function invalidResponse(): never {
  throw new Error('Invalid Companion response');
}

function parseCurrentUser(value: unknown): CurrentUser {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isNonEmptyString(value.userId)
    || !isUuid(value.userId) || !Array.isArray(value.channels)
    || !hasOnlyKeys(value, ['schemaVersion', 'userId', 'displayName', 'channels'])) invalidResponse();
  const channels = value.channels.map((channel) => {
    if (!isRecord(channel) || !isNonEmptyString(channel.channelId)
      || !isUuid(channel.channelId)
      || typeof channel.role !== 'string'
      || !allowedRoles.has(channel.role as CurrentUser['channels'][number]['role'])
      || !hasOnlyKeys(channel, ['channelId', 'role'])) invalidResponse();
    return {channelId: channel.channelId, role: channel.role as CurrentUser['channels'][number]['role']};
  });
  if (value.displayName !== undefined && value.displayName !== null
    && (typeof value.displayName !== 'string' || value.displayName.length > 120)) invalidResponse();
  return {schemaVersion: 'v1', userId: value.userId, displayName: value.displayName as string | null | undefined, channels};
}

function parseAuthExchange(value: unknown): CompanionAuthExchange {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isNonEmptyString(value.accessToken)
    || value.accessToken.length < 32 || value.accessToken.length > 256 || !isIsoDate(value.expiresAt)
    || !hasOnlyKeys(value, ['schemaVersion', 'accessToken', 'expiresAt', 'user'])) invalidResponse();
  return {accessToken: value.accessToken, expiresAt: value.expiresAt, user: parseCurrentUser(value.user)};
}

function parseCompanionState(value: unknown): CompanionState {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId)
    || typeof value.overlayConnected !== 'boolean'
    || !Number.isInteger(value.pendingAlerts) || (value.pendingAlerts as number) < 0
    || !isIsoDate(value.lastUpdatedAt)
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'overlayConnected', 'pendingAlerts', 'lastUpdatedAt'])) invalidResponse();
  return {
    schemaVersion: 'v1',
    channelId: value.channelId,
    overlayConnected: value.overlayConnected,
    pendingAlerts: value.pendingAlerts as number,
    lastUpdatedAt: value.lastUpdatedAt,
  };
}

function parseHistoryPage(value: unknown): {schemaVersion: 'v1'; items: CompanionAlertHistory[]; nextCursor: string | null} {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !Array.isArray(value.items)
    || value.items.length > 100 || (value.nextCursor !== null && typeof value.nextCursor !== 'string')
    || !hasOnlyKeys(value, ['schemaVersion', 'items', 'nextCursor'])) invalidResponse();
  const items = value.items.map((item) => {
    if (!isRecord(item) || !isUuid(item.eventId) || typeof item.sourceType !== 'string'
      || !['payment', 'manual', 'companion'].includes(item.sourceType)
      || typeof item.status !== 'string'
      || !['accepted', 'held', 'displayed', 'acknowledged', 'failed', 'quarantined', 'suppressed'].includes(item.status)
      || !isIsoDate(item.createdAt)
      || (item.displayName !== null && (typeof item.displayName !== 'string' || item.displayName.length > 80))
      || (item.message !== null && (typeof item.message !== 'string' || item.message.length > 500))
      || (item.grossAmountPaise !== null && (!Number.isSafeInteger(item.grossAmountPaise) || (item.grossAmountPaise as number) < 0))
      || (item.currency !== null && item.currency !== 'INR')
      || !hasOnlyKeys(item, ['eventId', 'sourceType', 'status', 'createdAt', 'grossAmountPaise', 'currency', 'displayName', 'message'])) invalidResponse();
    return item as unknown as CompanionAlertHistory;
  });
  return {schemaVersion: 'v1', items, nextCursor: value.nextCursor as string | null};
}

function parseBilling(value: unknown): CompanionBilling {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId)
    || typeof value.tier !== 'string' || !['free', 'pro', 'creator', 'studio'].includes(value.tier)
    || !Number.isSafeInteger(value.monthlyPricePaise) || (value.monthlyPricePaise as number) < 0
    || value.annualMonthsCharged !== 10 || value.annualServiceMonths !== 12
    || typeof value.renewalState !== 'string' || !['not_applicable', 'active', 'past_due', 'cancelled'].includes(value.renewalState)
    || (value.nextRenewalAt !== null && !isIsoDate(value.nextRenewalAt))
    || typeof value.billingInterval !== 'string' || !['monthly', 'annual'].includes(value.billingInterval)
    || typeof value.autoRenew !== 'boolean'
    || (value.currentPeriodEndsAt !== null && !isIsoDate(value.currentPeriodEndsAt))
    || (value.priceProtectedUntil !== null && !isIsoDate(value.priceProtectedUntil))
    || typeof value.priceSource !== 'string' || !['current', 'grandfathered'].includes(value.priceSource)
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'tier', 'monthlyPricePaise', 'annualMonthsCharged', 'annualServiceMonths', 'renewalState', 'nextRenewalAt', 'billingInterval', 'autoRenew', 'currentPeriodEndsAt', 'priceProtectedUntil', 'priceSource'])) invalidResponse();
  return value as unknown as CompanionBilling;
}

function parseSessionList(value: unknown): {schemaVersion: 'v1'; sessions: CompanionAccountSession[]} {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !Array.isArray(value.sessions) || value.sessions.length > 64
    || !hasOnlyKeys(value, ['schemaVersion', 'sessions'])) invalidResponse();
  const sessions = value.sessions.map((session) => {
    if (!isRecord(session) || !isUuid(session.sessionId) || !isIsoDate(session.createdAt) || !isIsoDate(session.lastSeenAt)
      || typeof session.current !== 'boolean'
      || (session.deviceLabel !== null && (typeof session.deviceLabel !== 'string' || session.deviceLabel.length > 80))
      || !hasOnlyKeys(session, ['sessionId', 'createdAt', 'lastSeenAt', 'current', 'deviceLabel'])) invalidResponse();
    return session as unknown as CompanionAccountSession;
  });
  return {schemaVersion: 'v1', sessions};
}

function parseQueueList(value: unknown): CompanionQueueList {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !Array.isArray(value.queues)
    || !hasOnlyKeys(value, ['schemaVersion', 'queues'])) invalidResponse();
  const queues = value.queues.map((queue) => {
    if (!isRecord(queue) || !isUuid(queue.queueId) || !isUuid(queue.channelId)
      || !isNonEmptyString(queue.name) || queue.name.length > 80
      || typeof queue.paused !== 'boolean' || typeof queue.active !== 'boolean'
      || !hasOnlyKeys(queue, ['schemaVersion', 'queueId', 'channelId', 'name', 'paused', 'active'])
      || queue.schemaVersion !== 'v1') invalidResponse();
    return {
      schemaVersion: 'v1' as const,
      queueId: queue.queueId,
      channelId: queue.channelId,
      name: queue.name,
      paused: queue.paused,
      active: queue.active,
    };
  });
  return {schemaVersion: 'v1' as const, queues};
}

function parseCompanionLayout(value: unknown): CompanionLayout {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId)
    || !Number.isInteger(value.version) || (value.version as number) < 0
    || typeof value.tier !== 'string' || !allowedTiers.has(value.tier as CompanionLayout['tier'])
    || ![8, 16, 32, 64].includes(value.maxSlots as number)
    || ![4, 8, 16].includes(value.pageSize as number) || !Array.isArray(value.slots)
    || (value.createdAt !== null && !isIsoDate(value.createdAt))
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'version', 'tier', 'maxSlots', 'pageSize', 'slots', 'createdAt'])) invalidResponse();
  const seenSlotIndexes = new Set<number>();
  const slots = value.slots.map((slot) => {
    if (!isRecord(slot) || !Number.isInteger(slot.slotIndex) || (slot.slotIndex as number) < 1
      || (slot.slotIndex as number) > (value.maxSlots as number)
      || seenSlotIndexes.has(slot.slotIndex as number)
      || !Number.isInteger(slot.page) || (slot.page as number) < 1 || (slot.page as number) > 16 || !isNonEmptyString(slot.label)
      || slot.label.length > 80
      || typeof slot.action !== 'string' || !allowedActions.has(slot.action as CompanionAction)
      || !isUuid(slot.targetId)
      || !hasOnlyKeys(slot, ['slotIndex', 'page', 'label', 'action', 'targetId'])) invalidResponse();
    seenSlotIndexes.add(slot.slotIndex as number);
    return {
      slotIndex: slot.slotIndex as number,
      page: slot.page as number,
      label: slot.label as string,
      action: slot.action as CompanionAction,
      targetId: slot.targetId,
    };
  });
  if (slots.length > (value.maxSlots as number)) invalidResponse();
  return {
    schemaVersion: 'v1',
    channelId: value.channelId as string,
    version: value.version as number,
    tier: value.tier as CompanionLayout['tier'],
    maxSlots: value.maxSlots as CompanionLayout['maxSlots'],
    pageSize: value.pageSize as CompanionLayout['pageSize'],
    slots,
    createdAt: value.createdAt as string | null,
  };
}

function parseActionResult(value: unknown): CompanionActionResult {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.commandId)
    || (value.status !== 'accepted' && value.status !== 'rejected') || !isIsoDate(value.acceptedAt)
    || (value.eventId !== undefined && !isUuid(value.eventId))
    || !hasOnlyKeys(value, ['schemaVersion', 'commandId', 'status', 'acceptedAt', 'eventId'])) invalidResponse();
  return {
    schemaVersion: 'v1',
    commandId: value.commandId,
    status: value.status,
    acceptedAt: value.acceptedAt as string,
    ...(value.eventId !== undefined ? {eventId: value.eventId} : {}),
  };
}

function parseControlSession(value: unknown): CompanionControlSession {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.sessionId)
    || !isUuid(value.channelId) || typeof value.clientType !== 'string'
    || !allowedClientTypes.has(value.clientType as CompanionControlSession['clientType'])
    || !/^[A-Za-z0-9._:-]{16,128}$/.test(value.clientInstanceId as string) || !isIsoDate(value.leaseUntil)
    || !isIsoDate(value.createdAt) || typeof value.reused !== 'boolean'
    || !hasOnlyKeys(value, ['schemaVersion', 'sessionId', 'channelId', 'clientType', 'clientInstanceId', 'leaseUntil', 'createdAt', 'reused'])) invalidResponse();
  return {
    schemaVersion: 'v1',
    sessionId: value.sessionId,
    channelId: value.channelId,
    clientType: value.clientType as CompanionControlSession['clientType'],
    clientInstanceId: value.clientInstanceId as string,
    leaseUntil: value.leaseUntil as string,
    createdAt: value.createdAt as string,
    reused: value.reused,
  };
}

function parseNotificationPreferences(value: unknown): CompanionNotificationPreferences {
  if (!isRecord(value) || value.schemaVersion !== 'v1'
    || typeof value.connectionAlerts !== 'boolean'
    || typeof value.securityAlerts !== 'boolean'
    || typeof value.actionFailures !== 'boolean'
    || !hasOnlyKeys(value, ['schemaVersion', 'connectionAlerts', 'securityAlerts', 'actionFailures'])) invalidResponse();
  return value as unknown as CompanionNotificationPreferences;
}

function parseNotificationDevices(value: unknown): {schemaVersion: 'v1'; devices: CompanionNotificationDevice[]} {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !Array.isArray(value.devices)
    || value.devices.length > 32 || !hasOnlyKeys(value, ['schemaVersion', 'devices'])) invalidResponse();
  const devices = value.devices.map((device) => {
    if (!isRecord(device) || device.schemaVersion !== 'v1' || !isUuid(device.deviceId)
      || (device.platform !== 'ios' && device.platform !== 'android')
      || typeof device.enabled !== 'boolean' || !isIsoDate(device.createdAt) || !isIsoDate(device.lastSeenAt)
      || !hasOnlyKeys(device, ['schemaVersion', 'deviceId', 'platform', 'enabled', 'createdAt', 'lastSeenAt'])) invalidResponse();
    return device as unknown as CompanionNotificationDevice;
  });
  return {schemaVersion: 'v1', devices};
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CompanionApiOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: FetchLike;
  requestTimeoutMs?: number;
};

export class CompanionApiError extends Error {
  constructor(
    readonly status: number,
    message: 'unauthorized' | 'forbidden' | 'conflict' | 'request_failed',
  ) {
    super(message);
    this.name = 'CompanionApiError';
  }
}

export class CompanionApi {
  private readonly baseUrl: string;
  private readonly getAccessToken: CompanionApiOptions['getAccessToken'];
  private readonly fetchImpl: FetchLike;
  private readonly requestTimeoutMs: number;

  constructor(options: CompanionApiOptions) {
    const parsed = new URL(options.baseUrl);
    const localhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !localhost) {
      throw new Error('Companion API requires HTTPS outside localhost');
    }

    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 1_000 || this.requestTimeoutMs > 60_000) {
      throw new Error('Companion API request timeout must be between 1000 and 60000 milliseconds');
    }
  }

  getCurrentUser() {
    return this.request('/v1/me', {}, parseCurrentUser);
  }

  async exchangeGoogleIdentity(idToken: string, deviceLabel: string): Promise<CompanionAuthExchange> {
    if (idToken.length < 20 || idToken.length > 8192) throw new Error('Invalid Google identity token');
    if (deviceLabel.length < 1 || deviceLabel.length > 80) throw new Error('Invalid Companion device label');
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/auth/google/exchange`, {
        method: 'POST',
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        body: JSON.stringify({idToken, deviceLabel}),
      });
    } catch {
      throw new CompanionApiError(0, 'request_failed');
    }
    if (!response.ok) {
      throw new CompanionApiError(response.status, response.status === 503 ? 'request_failed' : 'unauthorized');
    }
    try {
      return parseAuthExchange(await response.json());
    } catch {
      throw new CompanionApiError(response.status, 'request_failed');
    }
  }

  getCompanionState(channelId: string) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/state`,
      {},
      parseCompanionState,
    );
  }

  getQueues(channelId: string) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/queues`,
      {},
      parseQueueList,
    );
  }

  getHistory(channelId: string) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/alert-history`,
      {},
      parseHistoryPage,
    );
  }

  getBilling(channelId: string) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/billing`,
      {},
      parseBilling,
    );
  }

  getSessions() {
    return this.request('/v1/me/sessions', {}, parseSessionList);
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (!isUuid(sessionId)) throw new Error('Invalid account session id');
    await this.request<void>(`/v1/me/sessions/${encodeURIComponent(sessionId)}`, {method: 'DELETE'});
  }

  getCompanionLayout(channelId: string) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/layout`,
      {},
      parseCompanionLayout,
    );
  }

  updateCompanionLayout(channelId: string, expectedVersion: number, pageSize: 4 | 8 | 16, slots: CompanionActionSlot[]) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new Error('Invalid Companion layout version');
    }
    if (![4, 8, 16].includes(pageSize)) {
      throw new Error('Invalid Companion page size');
    }
    if (slots.length > 64 || slots.some((slot) => !allowedActions.has(slot.action))) {
      throw new Error('Invalid Companion action layout');
    }

    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/layout`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match-Version': String(expectedVersion),
        },
        body: JSON.stringify({pageSize, slots}),
      },
      parseCompanionLayout,
    );
  }

  executeAction(channelId: string, action: CompanionAction, idempotencyKey: string, targetId: string) {
    if (!allowedActions.has(action)) {
      throw new Error('Invalid Companion action');
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new Error('Invalid idempotency key');
    }
    if (!isUuid(targetId)) {
      throw new Error('Companion action requires a queue target');
    }

    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/actions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({action, targetId}),
      },
      parseActionResult,
    );
  }

  acquireControlSession(
    channelId: string,
    clientType: CompanionControlSession['clientType'],
    clientInstanceId: string,
  ) {
    if (!allowedClientTypes.has(clientType)) {
      throw new Error('Invalid Companion control client type');
    }
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(clientInstanceId)) {
      throw new Error('Invalid Companion control client instance');
    }

    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/control-session`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({clientType, clientInstanceId}),
      },
      parseControlSession,
    );
  }

  async revokeControlSession(channelId: string, sessionId: string): Promise<void> {
    if (!/^[0-9a-fA-F-]{36}$/.test(sessionId)) {
      throw new Error('Invalid Companion control session id');
    }

    await this.request<void>(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/control-session/${encodeURIComponent(sessionId)}`,
      {method: 'DELETE'},
    );
  }

  getNotificationPreferences() {
    return this.request('/v1/me/notifications/preferences', {}, parseNotificationPreferences);
  }

  updateNotificationPreferences(preferences: Omit<CompanionNotificationPreferences, 'schemaVersion'>) {
    if (typeof preferences.connectionAlerts !== 'boolean'
      || typeof preferences.securityAlerts !== 'boolean'
      || typeof preferences.actionFailures !== 'boolean') {
      throw new Error('Invalid Companion notification preferences');
    }
    return this.request(
      '/v1/me/notifications/preferences',
      {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(preferences)},
      parseNotificationPreferences,
    );
  }

  getNotificationDevices() {
    return this.request('/v1/me/notifications/devices', {}, parseNotificationDevices);
  }

  registerNotificationDevice(platform: 'ios' | 'android', token: string) {
    if ((platform !== 'ios' && platform !== 'android') || !/^[A-Za-z0-9:_.-]{16,4096}$/.test(token)) {
      throw new Error('Invalid Companion notification registration');
    }
    return this.request(
      '/v1/me/notifications/devices',
      {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({platform, token})},
      (value) => {
        const parsed = parseNotificationDevices({schemaVersion: 'v1', devices: [value]});
        const device = parsed.devices[0];
        if (!device) invalidResponse();
        return device;
      },
    );
  }

  async revokeNotificationDevice(deviceId: string): Promise<void> {
    if (!isUuid(deviceId)) throw new Error('Invalid Companion notification device id');
    await this.request<void>(`/v1/me/notifications/devices/${encodeURIComponent(deviceId)}`, {method: 'DELETE'});
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    decode: (value: unknown) => T = (value) => value as T,
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new CompanionApiError(401, 'unauthorized');
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timeout = controller ? setTimeout(() => controller.abort(), this.requestTimeoutMs) : undefined;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        ...(controller ? {signal: controller.signal} : {}),
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {}),
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new CompanionApiError(0, 'request_failed');
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (!response.ok) {
      const message = response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 409
            ? 'conflict'
            : 'request_failed';
      throw new CompanionApiError(response.status, message);
    }

    if (response.status === 204) return undefined as T;

    try {
      return decode(await response.json());
    } catch {
      throw new CompanionApiError(response.status, 'request_failed');
    }
  }
}
