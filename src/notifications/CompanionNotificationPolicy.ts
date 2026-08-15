export type CompanionNotificationKind =
  | 'connection_lost'
  | 'connection_recovered'
  | 'session_revoked'
  | 'action_failed';

export type CompanionNotification = {
  schemaVersion: 'v1';
  notificationId: string;
  kind: CompanionNotificationKind;
  occurredAt: string;
};

export type NotificationRegistration = {
  schemaVersion: 'v1';
  platform: 'ios' | 'android';
  token: string;
};

const kinds = new Set<CompanionNotificationKind>([
  'connection_lost',
  'connection_recovered',
  'session_revoked',
  'action_failed',
]);

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

export function parseNotification(value: unknown): CompanionNotification {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid Companion notification');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 'v1' || !isUuid(record.notificationId)
    || typeof record.kind !== 'string' || !kinds.has(record.kind as CompanionNotificationKind)
    || !isIsoDate(record.occurredAt)
    || !hasOnlyKeys(record, ['schemaVersion', 'notificationId', 'kind', 'occurredAt'])) {
    throw new Error('Invalid Companion notification');
  }
  return {
    schemaVersion: 'v1',
    notificationId: record.notificationId,
    kind: record.kind as CompanionNotificationKind,
    occurredAt: record.occurredAt,
  };
}

export function parseRegistration(value: unknown): NotificationRegistration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid notification registration');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 'v1'
    || (record.platform !== 'ios' && record.platform !== 'android')
    || typeof record.token !== 'string' || record.token.length < 16 || record.token.length > 4096
    || !/^[A-Za-z0-9._:-]+$/.test(record.token)
    || !hasOnlyKeys(record, ['schemaVersion', 'platform', 'token'])) {
    throw new Error('Invalid notification registration');
  }
  return {schemaVersion: 'v1', platform: record.platform, token: record.token};
}

export function notificationCopy(notification: CompanionNotification): string {
  switch (notification.kind) {
    case 'connection_lost': return 'A Companion connection needs attention.';
    case 'connection_recovered': return 'Your Companion connection is back.';
    case 'session_revoked': return 'A Companion session was revoked.';
    case 'action_failed': return 'A Companion action could not be completed.';
  }
}

export function nextBackgroundRefreshAt(now = Date.now(), minimumIntervalMs = 15 * 60 * 1000): number {
  if (!Number.isInteger(now) || now < 0 || !Number.isInteger(minimumIntervalMs)
    || minimumIntervalMs < 60_000 || minimumIntervalMs > 24 * 60 * 60 * 1000) {
    throw new Error('Invalid background refresh interval');
  }
  return now + minimumIntervalMs;
}
