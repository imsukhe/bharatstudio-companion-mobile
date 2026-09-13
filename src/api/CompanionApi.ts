// L24 companion action catalogue. Keep this union byte-for-byte identical
// (same 17 strings, same grouping) to: bharatstudio-alerts's migration 0089
// CHECK constraint and companion.ts route, and the macOS/Windows
// CompanionControlAction enums in bharatstudio-companion-desktop. This is
// an allowlist of named, enumerated commands -- never a passthrough.
export type CompanionAction =
  | 'pause_queue'
  | 'resume_queue'
  | 'send_test_alert'
  | 'obs_set_scene'
  | 'obs_toggle_source'
  | 'obs_toggle_mute'
  | 'obs_start_stream'
  | 'obs_stop_stream'
  | 'obs_start_record'
  | 'obs_stop_record'
  | 'obs_save_replay_buffer'
  | 'obs_set_transition'
  | 'mirror_start'
  | 'mirror_stop'
  | 'mirror_screenshot'
  | 'stream_go_live'
  | 'stream_end';

export type CompanionActionGroup = 'alerts' | 'obs' | 'mirror' | 'stream';

const actionGroups: Record<CompanionAction, CompanionActionGroup> = {
  pause_queue: 'alerts',
  resume_queue: 'alerts',
  send_test_alert: 'alerts',
  obs_set_scene: 'obs',
  obs_toggle_source: 'obs',
  obs_toggle_mute: 'obs',
  obs_start_stream: 'obs',
  obs_stop_stream: 'obs',
  obs_start_record: 'obs',
  obs_stop_record: 'obs',
  obs_save_replay_buffer: 'obs',
  obs_set_transition: 'obs',
  mirror_start: 'mirror',
  mirror_stop: 'mirror',
  mirror_screenshot: 'mirror',
  stream_go_live: 'stream',
  stream_end: 'stream',
};

export function companionActionGroup(action: CompanionAction): CompanionActionGroup {
  return actionGroups[action];
}

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
  // L24 activation signals (bharatstudio-alerts migration 0093), added by
  // this task's L07 remaining-feature-list work (master plan 7.11 item 1).
  // A desktop helper's obsConnected self-report is server-side staleness-
  // checked (>45s old reads as NOT connected) before it ever reaches this
  // client -- see helperPaired/obsConnected below; this client never
  // recomputes staleness itself, it only renders what the server already
  // decided.
  helperPaired: boolean;
  obsConnected: boolean;
  obsStatusReportedAt: string | null;
  paymentAccountConnected: boolean;
  mirrorReachable: boolean;
  streamPaired: boolean;
};

// L07 remaining feature list (master plan 7.11 item 1): a coherent health
// read derived from CompanionState, not raw booleans handed to the UI.
// 'stale' is distinct from 'unknown': a signal the server itself modelled
// as "no live signal exists" (mirror/stream today) reads unknown, while a
// signal that exists but has gone quiet (obsStatusReportedAt present, but
// the server already resolved obsConnected to false because it is >45s
// old) reads stale, not unknown -- a stale signal must never present the
// same as "healthy" or "no data".
export type CompanionHealthState = 'healthy' | 'unhealthy' | 'stale' | 'unknown';

export type CompanionHealthSignal = {
  key: 'overlay' | 'helper' | 'obs' | 'payment' | 'mirror' | 'stream';
  label: string;
  state: CompanionHealthState;
  detail: string;
};

export function companionHealthSignals(state: CompanionState): CompanionHealthSignal[] {
  const obsStale = state.helperPaired && !state.obsConnected && state.obsStatusReportedAt !== null;
  return [
    {
      key: 'overlay',
      label: 'Alerts overlay',
      state: state.overlayConnected ? 'healthy' : 'unhealthy',
      detail: state.overlayConnected ? 'Connected' : 'Not connected',
    },
    {
      key: 'helper',
      label: 'Desktop helper',
      state: state.helperPaired ? 'healthy' : 'unhealthy',
      detail: state.helperPaired ? 'Paired' : 'Not paired',
    },
    {
      key: 'obs',
      label: 'OBS connection',
      // A stale heartbeat (helper paired, but its last OBS report is too
      // old for the server to still trust) must read unhealthy-and-labeled
      // stale, never fall back to 'unknown' -- that would understate a
      // helper that has gone quiet as merely "no data yet".
      state: !state.helperPaired
        ? 'unknown'
        : obsStale
          ? 'stale'
          : state.obsConnected
            ? 'healthy'
            : 'unhealthy',
      detail: !state.helperPaired
        ? 'No paired helper to report from'
        : obsStale
          ? `Last heard ${new Date(state.obsStatusReportedAt as string).toLocaleTimeString('en-IN')} — stale`
          : state.obsConnected
            ? 'Connected'
            : 'Not connected',
    },
    {
      key: 'payment',
      label: 'Payment account',
      state: state.paymentAccountConnected ? 'healthy' : 'unhealthy',
      detail: state.paymentAccountConnected ? 'Connected' : 'Not connected',
    },
    {
      key: 'mirror',
      label: 'Mirror',
      // Server models this as always-false today because Mirror reports no
      // liveness signal to this API yet (bharatstudio-alerts migration
      // 0093's own header comment) -- an honest 'unknown', not 'unhealthy',
      // which would misreport "checked and found broken".
      state: 'unknown',
      detail: 'No liveness signal from Mirror yet',
    },
    {
      key: 'stream',
      label: 'Stream',
      state: 'unknown',
      detail: 'No liveness signal from Stream yet',
    },
  ];
}

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
  /** Free-text OBS target name (scene/source/input/transition). Present
   * only when `companionActionGroup(action) === 'obs'`; matches migration
   * 0089's target-type discriminator. */
  targetLabel?: string;
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

const allowedActions = new Set<CompanionAction>(Object.keys(actionGroups) as CompanionAction[]);

function isValidTargetLabel(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 200) return false;
  return /^[\x20-\x7E]+$/.test(value);
}

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
    || typeof value.helperPaired !== 'boolean'
    || typeof value.obsConnected !== 'boolean'
    || (value.obsStatusReportedAt !== null && !isIsoDate(value.obsStatusReportedAt))
    || typeof value.paymentAccountConnected !== 'boolean'
    || typeof value.mirrorReachable !== 'boolean'
    || typeof value.streamPaired !== 'boolean'
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'overlayConnected', 'pendingAlerts', 'lastUpdatedAt', 'helperPaired', 'obsConnected', 'obsStatusReportedAt', 'paymentAccountConnected', 'mirrorReachable', 'streamPaired'])) invalidResponse();
  return {
    schemaVersion: 'v1',
    channelId: value.channelId,
    overlayConnected: value.overlayConnected,
    pendingAlerts: value.pendingAlerts as number,
    lastUpdatedAt: value.lastUpdatedAt,
    helperPaired: value.helperPaired,
    obsConnected: value.obsConnected,
    obsStatusReportedAt: value.obsStatusReportedAt as string | null,
    paymentAccountConnected: value.paymentAccountConnected,
    mirrorReachable: value.mirrorReachable,
    streamPaired: value.streamPaired,
  };
}

// === L07 remaining feature list (master plan 7.11 items 2, 5, 8-10) ===

export type CompanionTtsMuteState = {
  schemaVersion: 'v1';
  queueId: string;
  ttsMuted: boolean;
  ttsMutedAt: string | null;
};

export type CompanionTtsCancelResult = {
  schemaVersion: 'v1';
  deliveryId: string;
  eventId: string;
  status: 'tts_cancelled';
  cancelledAt: string;
};

export type CompanionTestReportHop = {
  hop: string;
  status: string;
  occurredAt: string | null;
  detail: string | null;
};

export type CompanionTestReport = {
  schemaVersion: 'v1';
  channelId: string;
  eventId: string;
  hops: CompanionTestReportHop[];
};

export type CompanionPaymentStatusItem = {
  paymentId: string;
  status: string;
  grossAmountPaise: number;
  currency: string;
  refundStatus: string | null;
  refundAmountPaise: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanionPaymentStatusView = {
  schemaVersion: 'v1';
  channelId: string;
  items: CompanionPaymentStatusItem[];
};

export type CompanionRecentTipItem = {
  eventId: string;
  displayName: string | null;
  message: string | null;
  grossAmountPaise: number | null;
  currency: string | null;
  createdAt: string;
};

export type CompanionRecentTipsView = {
  schemaVersion: 'v1';
  channelId: string;
  items: CompanionRecentTipItem[];
};

export type CompanionModerationResult = {
  eventId: string;
  action: string;
  appliedAt: string;
};

function parseTtsMuteState(value: unknown): CompanionTtsMuteState {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.queueId)
    || typeof value.ttsMuted !== 'boolean'
    || (value.ttsMutedAt !== null && !isIsoDate(value.ttsMutedAt))
    || !hasOnlyKeys(value, ['schemaVersion', 'queueId', 'ttsMuted', 'ttsMutedAt'])) invalidResponse();
  return {schemaVersion: 'v1', queueId: value.queueId, ttsMuted: value.ttsMuted, ttsMutedAt: value.ttsMutedAt as string | null};
}

function parseTtsCancelResult(value: unknown): CompanionTtsCancelResult {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.deliveryId) || !isUuid(value.eventId)
    || value.status !== 'tts_cancelled' || !isIsoDate(value.cancelledAt)
    || !hasOnlyKeys(value, ['schemaVersion', 'deliveryId', 'eventId', 'status', 'cancelledAt'])) invalidResponse();
  return {schemaVersion: 'v1', deliveryId: value.deliveryId, eventId: value.eventId, status: 'tts_cancelled', cancelledAt: value.cancelledAt as string};
}

function parseTestReport(value: unknown): CompanionTestReport {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId) || !isUuid(value.eventId)
    || !Array.isArray(value.hops) || value.hops.length > 32
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'eventId', 'hops'])) invalidResponse();
  const hops = value.hops.map((hop) => {
    if (!isRecord(hop) || !isNonEmptyString(hop.hop) || hop.hop.length > 80
      || !isNonEmptyString(hop.status) || hop.status.length > 80
      || (hop.occurredAt !== null && !isIsoDate(hop.occurredAt))
      || (hop.detail !== null && (typeof hop.detail !== 'string' || hop.detail.length > 200))
      || !hasOnlyKeys(hop, ['hop', 'status', 'occurredAt', 'detail'])) invalidResponse();
    return {hop: hop.hop, status: hop.status, occurredAt: hop.occurredAt as string | null, detail: hop.detail as string | null};
  });
  return {schemaVersion: 'v1', channelId: value.channelId, eventId: value.eventId, hops};
}

function parsePaymentStatusView(value: unknown): CompanionPaymentStatusView {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId) || !Array.isArray(value.items)
    || value.items.length > 50
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'items'])) invalidResponse();
  const items = value.items.map((item) => {
    if (!isRecord(item) || !isNonEmptyString(item.paymentId) || !isNonEmptyString(item.status)
      || !Number.isSafeInteger(item.grossAmountPaise) || (item.grossAmountPaise as number) < 0
      || item.currency !== 'INR'
      || (item.refundStatus !== null && typeof item.refundStatus !== 'string')
      || (item.refundAmountPaise !== null && (!Number.isSafeInteger(item.refundAmountPaise) || (item.refundAmountPaise as number) < 0))
      || !isIsoDate(item.createdAt) || !isIsoDate(item.updatedAt)
      || !hasOnlyKeys(item, ['paymentId', 'status', 'grossAmountPaise', 'currency', 'refundStatus', 'refundAmountPaise', 'createdAt', 'updatedAt'])) invalidResponse();
    return item as unknown as CompanionPaymentStatusItem;
  });
  return {schemaVersion: 'v1', channelId: value.channelId, items};
}

function parseRecentTipsView(value: unknown): CompanionRecentTipsView {
  if (!isRecord(value) || value.schemaVersion !== 'v1' || !isUuid(value.channelId) || !Array.isArray(value.items)
    || value.items.length > 50
    || !hasOnlyKeys(value, ['schemaVersion', 'channelId', 'items'])) invalidResponse();
  const items = value.items.map((item) => {
    if (!isRecord(item) || !isUuid(item.eventId)
      || (item.displayName !== null && (typeof item.displayName !== 'string' || item.displayName.length > 80))
      || (item.message !== null && (typeof item.message !== 'string' || item.message.length > 500))
      || (item.grossAmountPaise !== null && (!Number.isSafeInteger(item.grossAmountPaise) || (item.grossAmountPaise as number) < 0))
      || (item.currency !== null && item.currency !== 'INR')
      || !isIsoDate(item.createdAt)
      || !hasOnlyKeys(item, ['eventId', 'displayName', 'message', 'grossAmountPaise', 'currency', 'createdAt'])) invalidResponse();
    return item as unknown as CompanionRecentTipItem;
  });
  return {schemaVersion: 'v1', channelId: value.channelId, items};
}

const allowedModerationActions = new Set(['approve', 'hold', 'suppress', 'replay']);

function parseModerationResult(value: unknown): CompanionModerationResult {
  if (!isRecord(value) || !isUuid(value.eventId) || typeof value.action !== 'string'
    || !allowedModerationActions.has(value.action) || !isIsoDate(value.appliedAt)
    || !hasOnlyKeys(value, ['eventId', 'action', 'appliedAt'])) invalidResponse();
  return {eventId: value.eventId, action: value.action, appliedAt: value.appliedAt as string};
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
      || !hasOnlyKeys(slot, ['slotIndex', 'page', 'label', 'action', 'targetId', 'targetLabel'])) invalidResponse();
    const group = companionActionGroup(slot.action as CompanionAction);
    // Target-type discriminator (matches migration 0089 and the
    // desktop/mobile mirrors): an OBS-group slot must carry a bounded
    // targetLabel; an Alerts-group slot must not.
    if (group === 'obs' && !isValidTargetLabel(slot.targetLabel)) invalidResponse();
    if (group === 'alerts' && slot.targetLabel !== undefined) invalidResponse();
    if (group !== 'obs' && slot.targetLabel !== undefined && !isValidTargetLabel(slot.targetLabel)) invalidResponse();
    seenSlotIndexes.add(slot.slotIndex as number);
    return {
      slotIndex: slot.slotIndex as number,
      page: slot.page as number,
      label: slot.label as string,
      action: slot.action as CompanionAction,
      targetId: slot.targetId,
      ...(slot.targetLabel !== undefined ? {targetLabel: slot.targetLabel as string} : {}),
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

  // L07 remaining feature list (master plan 7.11 item 5, half 1): mute is
  // forward-looking and per-queue, distinct from cancel below.
  setTtsMuted(channelId: string, queueId: string, muted: boolean) {
    if (!isUuid(queueId)) throw new Error('Invalid Companion TTS mute target queue');
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/tts/mute`,
      {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({queueId, muted})},
      parseTtsMuteState,
    );
  }

  // Item 5, half 2: cancel is a one-shot transition of exactly one
  // in-flight delivery, distinct from mute above.
  cancelTts(channelId: string, deliveryId: string) {
    if (!isUuid(deliveryId)) throw new Error('Invalid Companion TTS cancel target delivery');
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/tts/cancel`,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({deliveryId})},
      parseTtsCancelResult,
    );
  }

  // Item 2: fires the existing send_test_alert path end-to-end and reports
  // each hop -- distinct from the plain "Send test alert" control, which
  // only reports "accepted".
  runFullTest(channelId: string, queueId: string) {
    if (!isUuid(queueId)) throw new Error('Invalid Companion full-test target queue');
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/full-test`,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({queueId})},
      parseTestReport,
    );
  }

  // Item 9-10: read-only payment/refund status.
  getPaymentStatus(channelId: string, limit = 20) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/payments?limit=${encodeURIComponent(String(limit))}`,
      {},
      parsePaymentStatusView,
    );
  }

  // Item 8: read-only recent tips, donor-visibility-scoped by the server.
  getRecentTips(channelId: string, limit = 20) {
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/tips?limit=${encodeURIComponent(String(limit))}`,
      {},
      parseRecentTipsView,
    );
  }

  // Item 6-7: approve/reject on the existing, unmodified moderation
  // endpoint (bharatstudio-alerts routes/alerts.ts, not owned by this
  // task). 'reason' is inline form text, never window.prompt -- enforced
  // at the call site in CompanionShell, not here.
  moderate(channelId: string, alertId: string, action: 'approve' | 'hold' | 'suppress' | 'replay', reason?: string) {
    if (!isUuid(alertId)) throw new Error('Invalid Companion moderation target alert');
    if (!allowedModerationActions.has(action)) throw new Error('Invalid Companion moderation action');
    if (reason !== undefined && reason.length > 500) throw new Error('Companion moderation reason is too long');
    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/moderation/${encodeURIComponent(alertId)}`,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, ...(reason ? {reason} : {})})},
      parseModerationResult,
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
    // Client-side target-shape check is convenience only -- migration
    // 0089's DB function is the real, server-authoritative enforcement.
    if (slots.some((slot) => {
      const group = companionActionGroup(slot.action);
      if (group === 'obs') return !isValidTargetLabel(slot.targetLabel);
      if (group === 'alerts') return slot.targetLabel !== undefined;
      return false;
    })) {
      throw new Error('Companion action slot target does not match its action type');
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

  executeAction(channelId: string, action: CompanionAction, idempotencyKey: string, targetId: string, targetLabel?: string) {
    if (!allowedActions.has(action)) {
      throw new Error('Invalid Companion action');
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new Error('Invalid idempotency key');
    }
    const group = companionActionGroup(action);
    // Client-side target-shape check is convenience only -- the server
    // route (companion.ts) is the real, authoritative enforcement.
    if (group === 'alerts') {
      if (!isUuid(targetId)) throw new Error('Companion action requires a queue target');
      if (targetLabel !== undefined) throw new Error('Alerts actions do not take a targetLabel');
    } else if (group === 'obs') {
      if (!isValidTargetLabel(targetLabel)) {
        throw new Error('OBS actions require a targetLabel naming the scene/source/input/transition');
      }
    }

    return this.request(
      `/v1/channels/${encodeURIComponent(channelId)}/companion/actions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({action, targetId, ...(targetLabel !== undefined ? {targetLabel} : {})}),
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
