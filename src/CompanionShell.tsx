import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {useState} from 'react';
import type {CompanionAccountSession, CompanionAction, CompanionAlertHistory, CompanionBilling, CompanionNotificationPreferences, CompanionQueue, CompanionState, CurrentUser} from './api/CompanionApi';

type CompanionScreen = 'home' | 'activity' | 'health' | 'settings' | 'sessions' | 'help';

type CompanionShellProps = {
  onSignIn?: () => void;
  currentUser?: CurrentUser;
  companionState?: CompanionState;
  companionQueues?: CompanionQueue[];
  onAction?: (action: CompanionAction, targetId: string) => void;
  onSelectChannel?: (channelId: string) => void;
  selectedQueueId?: string;
  onSelectQueue?: (queueId: string) => void;
  history?: CompanionAlertHistory[];
  billing?: CompanionBilling;
  sessions?: CompanionAccountSession[];
  onRevokeSession?: (sessionId: string) => void;
  notificationPreferences?: CompanionNotificationPreferences;
  onUpdateNotificationPreferences?: (preferences: Omit<CompanionNotificationPreferences, 'schemaVersion'>) => void;
};

export function CompanionShell({onSignIn, currentUser, companionState, companionQueues, onAction, onSelectChannel, selectedQueueId, onSelectQueue, history, billing, sessions, onRevokeSession, notificationPreferences, onUpdateNotificationPreferences}: CompanionShellProps) {
  if (currentUser) {
    return <SignedInShell user={currentUser} state={companionState} queues={companionQueues} onAction={onAction} onSelectChannel={onSelectChannel} selectedQueueId={selectedQueueId} onSelectQueue={onSelectQueue} history={history} billing={billing} sessions={sessions} onRevokeSession={onRevokeSession} notificationPreferences={notificationPreferences} onUpdateNotificationPreferences={onUpdateNotificationPreferences} />;
  }

  const signInAvailable = typeof onSignIn === 'function';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="BharatStudio Companion"
      testID="companion-shell">
      <View style={styles.brandMark} accessibilityLabel="BharatStudio">
        <Text style={styles.brandMarkText}>BS</Text>
      </View>

      <Text style={styles.eyebrow}>BHARATSTUDIO COMPANION</Text>
      <Text style={styles.title}>Your stream, at a glance.</Text>
      <Text style={styles.subtitle}>
        Sign in to view authorised channel activity, connection state and
        Companion controls. Alerts and payment delivery remain server-owned.
      </Text>

      <View style={styles.card} accessibilityRole="summary">
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>Not connected</Text>
        </View>
        <Text style={styles.cardTitle}>Connect your BharatStudio account</Text>
        <Text style={styles.cardBody}>
          We will only request the permissions needed for Companion. YouTube
          data, payment checkout and raw OBS credentials are not requested by
          this mobile client.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{disabled: !signInAvailable}}
          disabled={!signInAvailable}
          onPress={onSignIn}
          style={({pressed}) => [
            styles.primaryButton,
            !signInAvailable && styles.disabledButton,
            pressed && signInAvailable && styles.pressedButton,
          ]}>
          <Text style={styles.primaryButtonText}>
            {signInAvailable ? 'Sign in with Google' : 'Sign-in setup pending'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <InfoCard title="Recent activity" body="Available after sign-in" />
        <InfoCard title="Connection health" body="Available after sign-in" />
        <InfoCard title="Sessions" body="Available after sign-in" />
        <InfoCard title="Help & support" body="Guided setup and recovery" />
      </View>

      <Text style={styles.footer}>
        Companion actions are role-checked by BharatStudio. A paired desktop
        helper is required for local OBS controls.
      </Text>
    </ScrollView>
  );
}

function SignedInShell({
  user,
  state,
  queues = [],
  onAction,
  onSelectChannel,
  selectedQueueId,
  onSelectQueue,
  history = [],
  billing,
  sessions = [],
  onRevokeSession,
  notificationPreferences,
  onUpdateNotificationPreferences,
}: {
  user: CurrentUser;
  state?: CompanionState;
  queues?: CompanionQueue[];
  onAction?: (action: CompanionAction, targetId: string) => void;
  onSelectChannel?: (channelId: string) => void;
  selectedQueueId?: string;
  onSelectQueue?: (queueId: string) => void;
  history?: CompanionAlertHistory[];
  billing?: CompanionBilling;
  sessions?: CompanionAccountSession[];
  onRevokeSession?: (sessionId: string) => void;
  notificationPreferences?: CompanionNotificationPreferences;
  onUpdateNotificationPreferences?: (preferences: Omit<CompanionNotificationPreferences, 'schemaVersion'>) => void;
}) {
  const [activeScreen, setActiveScreen] = useState<CompanionScreen>('home');
  const stateChannelIsAuthorized = Boolean(state && user.channels.some(candidate => candidate.channelId === state.channelId));
  const selectedChannelId = stateChannelIsAuthorized ? state?.channelId : user.channels[0]?.channelId;
  const channel = user.channels.find(candidate => candidate.channelId === selectedChannelId);
  const selectedState = state?.channelId === selectedChannelId ? state : undefined;
  const channelQueues = queues.filter(queue => queue.channelId === selectedChannelId);
  const selectedQueue = channelQueues.find(queue => queue.queueId === selectedQueueId) ?? channelQueues.find(queue => queue.active);
  const canOperate = channel ? ['owner', 'admin', 'operator'].includes(channel.role) : false;
  const canTargetQueue = Boolean(selectedQueue?.active);
  const canOperateQueue = canOperate && canTargetQueue;
  const status = selectedState?.overlayConnected ? 'Connected' : 'Waiting for overlay';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="BharatStudio Companion home"
      testID="companion-home">
      <View style={styles.brandMark} accessibilityLabel="BharatStudio">
        <Text style={styles.brandMarkText}>BS</Text>
      </View>
      <Text style={styles.eyebrow}>BHARATSTUDIO COMPANION</Text>
      <Text style={styles.title}>Welcome{user.displayName ? `, ${user.displayName}` : ''}.</Text>
      <Text style={styles.subtitle}>
        A read-only view of authorised channel state with bounded broadcast controls.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.screenNav} accessibilityRole="tablist" accessibilityLabel="Companion screens">
        {(['home', 'activity', 'health', 'settings', 'sessions', 'help'] as CompanionScreen[]).map(screen => (
          <Pressable key={screen} accessibilityRole="tab" accessibilityState={{selected: activeScreen === screen}} accessibilityLabel={`${screen} screen`} onPress={() => setActiveScreen(screen)} style={[styles.screenTab, activeScreen === screen && styles.selectedScreenTab]}>
            <Text style={[styles.screenTabText, activeScreen === screen && styles.selectedScreenTabText]}>{screen === 'settings' ? 'Settings' : screen[0].toUpperCase() + screen.slice(1)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {user.channels.length > 1 && (
        <View style={styles.channelPicker} accessibilityRole="radiogroup" accessibilityLabel="Authorised channels">
          <Text style={styles.sectionLabel}>Authorised channels</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelPickerContent}>
            {user.channels.map(candidate => {
              const selected = candidate.channelId === selectedChannelId;
              return (
                <Pressable
                  key={candidate.channelId}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}
                  accessibilityLabel={`Select channel ${candidate.channelId}`}
                  onPress={() => onSelectChannel?.(candidate.channelId)}
                  style={[styles.channelButton, selected && styles.selectedChannelButton]}>
                  <Text style={[styles.channelButtonText, selected && styles.selectedChannelButtonText]}>
                    {candidate.channelId}
                  </Text>
                  <Text style={[styles.channelRoleText, selected && styles.selectedChannelButtonText]}>
                    {candidate.role}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!onSelectChannel && <Text style={styles.helperText}>Select a channel from the connected account to load its current state.</Text>}
        </View>
      )}

      {channelQueues.length > 0 && (
        <View style={styles.channelPicker} accessibilityRole="radiogroup" accessibilityLabel="Available alert queues">
          <Text style={styles.sectionLabel}>Alert queue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelPickerContent}>
            {channelQueues.map(queue => {
              const selected = queue.queueId === selectedQueue?.queueId;
              return (
                <Pressable
                  key={queue.queueId}
                  accessibilityRole="radio"
                  accessibilityState={{selected, disabled: !queue.active}}
                  accessibilityLabel={`Select queue ${queue.name}`}
                  disabled={!queue.active}
                  onPress={() => onSelectQueue?.(queue.queueId)}
                  style={[styles.channelButton, selected && styles.selectedChannelButton, !queue.active && styles.disabledQueueButton]}>
                  <Text style={[styles.channelButtonText, selected && styles.selectedChannelButtonText]}>{queue.name}</Text>
                  <Text style={[styles.channelRoleText, selected && styles.selectedChannelButtonText]}>{queue.active ? (queue.paused ? 'Paused' : 'Ready') : 'Closed'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!onSelectQueue && <Text style={styles.helperText}>The first active queue is selected until the host provides a queue-selection callback.</Text>}
        </View>
      )}

      {activeScreen === 'home' && <View style={styles.card} accessibilityRole="summary">
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, state?.overlayConnected && styles.connectedDot]} />
          <Text style={styles.statusLabel}>{status}</Text>
        </View>
        <Text style={styles.cardTitle}>{channel ? channel.channelId : 'No channel connected'}</Text>
        <Text style={styles.cardBody}>
          {selectedState ? `${selectedState.pendingAlerts} alert${selectedState.pendingAlerts === 1 ? '' : 's'} waiting for delivery.` : 'Channel state is temporarily unavailable.'}
        </Text>
        <View style={styles.controlRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause alert queue"
            accessibilityState={{disabled: !canOperateQueue}}
            disabled={!canOperateQueue}
            onPress={() => selectedQueue && onAction?.('pause_queue', selectedQueue.queueId)}
            style={({pressed}) => [styles.secondaryButton, !canOperateQueue && styles.disabledSecondaryButton, pressed && canOperateQueue && styles.pressedButton]}>
            <Text style={styles.secondaryButtonText}>Pause queue</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resume alert queue"
            accessibilityState={{disabled: !canOperateQueue}}
            disabled={!canOperateQueue}
            onPress={() => selectedQueue && onAction?.('resume_queue', selectedQueue.queueId)}
            style={({pressed}) => [styles.secondaryButton, !canOperateQueue && styles.disabledSecondaryButton, pressed && canOperateQueue && styles.pressedButton]}>
            <Text style={styles.secondaryButtonText}>Resume queue</Text>
          </Pressable>
        </View>
        {!canOperate && <Text style={styles.helperText}>Your role can view state but cannot operate the queue.</Text>}
        {canOperate && !canTargetQueue && <Text style={styles.helperText}>Queue controls appear after an active queue is loaded.</Text>}
      </View>}

      {activeScreen === 'home' && <View style={styles.grid}>
        <InfoCard title="Channel role" body={channel?.role ?? 'No channel'} />
        <InfoCard title="Pending alerts" body={String(selectedState?.pendingAlerts ?? '—')} />
        <InfoCard title="Overlay" body={selectedState?.overlayConnected ? 'Live connection' : 'Not connected'} />
        <InfoCard title="Plan" body={billing?.tier ?? 'Server projection pending'} />
      </View>}

      {activeScreen === 'activity' && <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.cardTitle}>Recent alert activity</Text>
        {history.length === 0 ? <Text style={styles.helperText}>No recent activity is available for this channel.</Text> : history.slice(0, 20).map(item => <View key={item.eventId} style={styles.activityRow}><View style={styles.activityCopy}><Text style={styles.infoTitle}>{item.displayName ?? item.sourceType}</Text><Text style={styles.infoBody}>{item.message ?? 'No message'} · {item.status}</Text></View><Text style={styles.activityTime}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text></View>)}
        <Text style={styles.helperText}>History is server-projected and role-scoped. Companion does not remove accepted payment or alert evidence.</Text>
      </View>}

      {activeScreen === 'health' && <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.cardTitle}>Connection health</Text>
        <StatusLine label="Overlay" value={selectedState?.overlayConnected ? 'Connected' : 'Not connected'} />
        <StatusLine label="Pending delivery" value={selectedState ? String(selectedState.pendingAlerts) : 'Unavailable'} />
        <StatusLine label="Last server update" value={selectedState ? new Date(selectedState.lastUpdatedAt).toLocaleString('en-IN') : 'Unavailable'} />
        <Text style={styles.helperText}>This screen reports only server-owned state. Local OBS health appears after the paired desktop helper is implemented.</Text>
      </View>}

      {activeScreen === 'settings' && <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.cardTitle}>Notifications and plan locks</Text>
        {notificationPreferences ? <>
          <NotificationToggle label="Connection alerts" value={notificationPreferences.connectionAlerts} onChange={value => onUpdateNotificationPreferences?.({...notificationPreferences, connectionAlerts: value})} />
          <NotificationToggle label="Security alerts" value={notificationPreferences.securityAlerts} onChange={value => onUpdateNotificationPreferences?.({...notificationPreferences, securityAlerts: value})} />
          <NotificationToggle label="Action failures" value={notificationPreferences.actionFailures} onChange={value => onUpdateNotificationPreferences?.({...notificationPreferences, actionFailures: value})} />
        </> : <StatusLine label="Notifications" value="Loading server preferences" />}
        <StatusLine label="Plan" value={billing?.tier ?? 'Unavailable'} />
        <StatusLine label="Auto-renew" value={billing ? (billing.autoRenew ? 'On' : 'Off') : 'Unavailable'} />
        <Text style={styles.helperText}>These settings control only privacy-minimised operational notifications. Tips, donor data, payments and alert delivery never depend on push.</Text>
      </View>}

      {activeScreen === 'sessions' && <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.cardTitle}>Devices and sessions</Text>
        {sessions.length === 0 ? <Text style={styles.helperText}>Session inventory is unavailable until the account projection loads.</Text> : sessions.map(session => <View key={session.sessionId} style={styles.activityRow}><View style={styles.activityCopy}><Text style={styles.infoTitle}>{session.deviceLabel ?? 'Unnamed device'}{session.current ? ' · current' : ''}</Text><Text style={styles.infoBody}>Last seen {new Date(session.lastSeenAt).toLocaleString('en-IN')}</Text></View>{!session.current && <Pressable accessibilityRole="button" accessibilityLabel={`Revoke ${session.deviceLabel ?? 'session'}`} onPress={() => onRevokeSession?.(session.sessionId)} style={styles.smallButton}><Text style={styles.smallButtonText}>Revoke</Text></Pressable>}</View>)}
        <Text style={styles.helperText}>Revocation is server-side and auditable. The current session cannot revoke itself here.</Text>
      </View>}

      {activeScreen === 'help' && <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.cardTitle}>Help and recovery</Text>
        <Text style={styles.cardBody}>If the overlay is disconnected, keep the OBS browser source installed and reconnect it. Accepted alerts remain durable and replayable.</Text>
        <Text style={styles.cardBody}>If a device is unfamiliar, revoke its account session and sign in again. Local OBS controls require the separately paired desktop helper.</Text>
        <Text style={styles.helperText}>Support contact and in-app ticket submission are enabled only after the approved support endpoint and privacy copy are available.</Text>
      </View>}

      <Text style={styles.footer}>
        Actions are checked by the server and recorded. Companion state or limits never remove an accepted payment or alert.
      </Text>
    </ScrollView>
  );
}

function NotificationToggle({label, value, onChange}: {label: string; value: boolean; onChange: (value: boolean) => void}) {
  return <View style={styles.statusRow} accessibilityRole="switch" accessibilityState={{checked: value}}>
    <Text style={styles.statusLabel}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
  </View>;
}

function StatusLine({label, value}: {label: string; value: string}) {
  return <View style={styles.statusLine}><Text style={styles.infoTitle}>{label}</Text><Text style={styles.infoBody}>{value}</Text></View>;
}

function InfoCard({title, body}: {title: string; body: string}) {
  return (
    <View style={styles.infoCard} accessibilityRole="summary">
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#F7F8FA',
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B3A8A',
    marginBottom: 28,
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#4967A5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: '#172033',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    color: '#5B6475',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  screenNav: {
    gap: 8,
    paddingBottom: 16,
  },
  screenTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B7C2D8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectedScreenTab: {
    borderColor: '#1B3A8A',
    backgroundColor: '#E7ECFB',
  },
  screenTabText: {
    color: '#5B6475',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedScreenTabText: {
    color: '#1B3A8A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#172033',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A6AFBE',
    marginRight: 8,
  },
  connectedDot: {
    backgroundColor: '#2E9B68',
  },
  statusLabel: {
    color: '#6B7484',
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#172033',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardBody: {
    color: '#5B6475',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1B3A8A',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabledButton: {
    backgroundColor: '#A6AFBE',
  },
  pressedButton: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 10,
  },
  channelPicker: {
    marginBottom: 16,
  },
  channelPickerContent: {
    gap: 10,
    paddingVertical: 4,
  },
  sectionLabel: {
    color: '#243250',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  channelButton: {
    minWidth: 128,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B7C2D8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedChannelButton: {
    borderColor: '#1B3A8A',
    backgroundColor: '#E7ECFB',
  },
  channelButtonText: {
    color: '#243250',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedChannelButtonText: {
    color: '#1B3A8A',
  },
  disabledQueueButton: {
    opacity: 0.55,
  },
  channelRoleText: {
    color: '#6B7484',
    fontSize: 11,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B7C2D8',
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  disabledSecondaryButton: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#243250',
    fontSize: 13,
    fontWeight: '800',
  },
  helperText: {
    color: '#6B7484',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E6EE',
    paddingVertical: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E6EE',
    paddingVertical: 12,
  },
  activityCopy: {
    flex: 1,
  },
  activityTime: {
    color: '#6B7484',
    fontSize: 11,
  },
  smallButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B7C2D8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#243250',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#E9EDF5',
  },
  infoTitle: {
    color: '#243250',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoBody: {
    color: '#667188',
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    color: '#6B7484',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
