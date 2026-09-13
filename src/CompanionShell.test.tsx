/**
 * @format
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {CompanionShell} from './CompanionShell';

const baseUser = {
  schemaVersion: 'v1' as const,
  userId: 'user-1',
  displayName: 'Creator',
  channels: [{channelId: 'channel-1', role: 'operator' as const}],
};
const baseState = {
  schemaVersion: 'v1' as const,
  channelId: 'channel-1',
  overlayConnected: true,
  pendingAlerts: 3,
  lastUpdatedAt: '2026-08-15T00:00:00.000Z',
  helperPaired: false,
  obsConnected: false,
  obsStatusReportedAt: null,
  paymentAccountConnected: false,
  mirrorReachable: false,
  streamPaired: false,
};
const baseQueues = [{
  schemaVersion: 'v1' as const,
  queueId: 'queue-1',
  channelId: 'channel-1',
  name: 'Main alerts',
  paused: false,
  active: true,
}];

test('a real send_test_alert control is rendered and wired (audit finding: it was declared but had no UI)', async () => {
  const actions: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onAction={action => actions.push(action)}
      />,
    );
  });
  const sendTestAlert = rendered!.root.findByProps({accessibilityLabel: 'Send a test alert'});
  await ReactTestRenderer.act(() => sendTestAlert.props.onPress());
  expect(actions).toEqual(['send_test_alert']);
});

test('OBS controls are disabled with a visible reason when the obs group is not entitled (default)', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={baseState} companionQueues={baseQueues} />,
    );
  });
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('OBS controls are not enabled for this account yet.');
  const startStream = rendered!.root.findByProps({accessibilityLabel: 'Start OBS stream'});
  expect(startStream.props.accessibilityState).toMatchObject({disabled: true});
});

test('OBS controls are enabled and wired once the host says the obs group is entitled', async () => {
  const actions: Array<[string, string, string | undefined]> = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        companionActionGroups={['alerts', 'obs']}
        onAction={(action, targetId, targetLabel) => actions.push([action, targetId, targetLabel])}
      />,
    );
  });
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).not.toContain('OBS controls are not enabled for this account yet.');

  const startStream = rendered!.root.findByProps({accessibilityLabel: 'Start OBS stream'});
  expect(startStream.props.accessibilityState).toMatchObject({disabled: false});
  await ReactTestRenderer.act(() => startStream.props.onPress());
  expect(actions).toEqual([['obs_start_stream', 'channel-1', undefined]]);
});

test('setting an OBS scene sends the typed scene name as targetLabel, and stays disabled until one is typed', async () => {
  const actions: Array<[string, string, string | undefined]> = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        companionActionGroups={['alerts', 'obs']}
        onAction={(action, targetId, targetLabel) => actions.push([action, targetId, targetLabel])}
      />,
    );
  });

  const setScene = rendered!.root.findByProps({accessibilityLabel: 'Set OBS scene'});
  expect(setScene.props.accessibilityState).toMatchObject({disabled: true});

  const sceneInput = rendered!.root.findByProps({accessibilityLabel: 'OBS scene name'});
  await ReactTestRenderer.act(() => sceneInput.props.onChangeText('Main Scene'));

  const setSceneAfterTyping = rendered!.root.findByProps({accessibilityLabel: 'Set OBS scene'});
  expect(setSceneAfterTyping.props.accessibilityState).toMatchObject({disabled: false});
  await ReactTestRenderer.act(() => setSceneAfterTyping.props.onPress());
  expect(actions).toEqual([['obs_set_scene', 'channel-1', 'Main Scene']]);
});

// === L07 remaining feature list (master plan 7.11 items 1-2, 5-10) ===

test('run full test and mute/cancel TTS are wired, and mute vs cancel fire distinct callbacks with distinct payloads', async () => {
  const runFullTestCalls: string[] = [];
  const muteCalls: Array<[string, boolean]> = [];
  const cancelCalls: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onRunFullTest={queueId => runFullTestCalls.push(queueId)}
        onMuteTts={(queueId, muted) => muteCalls.push([queueId, muted])}
        onCancelTts={deliveryId => cancelCalls.push(deliveryId)}
      />,
    );
  });

  const runFullTest = rendered!.root.findByProps({accessibilityLabel: 'Run full test'});
  await ReactTestRenderer.act(() => runFullTest.props.onPress());
  expect(runFullTestCalls).toEqual(['queue-1']);

  const mute = rendered!.root.findByProps({accessibilityLabel: 'Mute upcoming TTS'});
  await ReactTestRenderer.act(() => mute.props.onPress());
  const unmute = rendered!.root.findByProps({accessibilityLabel: 'Unmute upcoming TTS'});
  await ReactTestRenderer.act(() => unmute.props.onPress());
  expect(muteCalls).toEqual([['queue-1', true], ['queue-1', false]]);

  const cancelInput = rendered!.root.findByProps({accessibilityLabel: 'Delivery id to cancel'});
  await ReactTestRenderer.act(() => cancelInput.props.onChangeText('delivery-99'));
  const cancel = rendered!.root.findByProps({accessibilityLabel: 'Cancel currently-playing TTS'});
  await ReactTestRenderer.act(() => cancel.props.onPress());
  expect(cancelCalls).toEqual(['delivery-99']);

  // Mute never fires the cancel callback and vice versa -- distinct operations.
  expect(muteCalls.length).toBe(2);
  expect(cancelCalls.length).toBe(1);
});

test('the full-test hop report renders once supplied by the host', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        fullTestReport={{schemaVersion: 'v1', channelId: 'channel-1', eventId: 'event-1', hops: [{hop: 'event_created', status: 'ok', occurredAt: null, detail: null}]}}
      />,
    );
  });
  expect(JSON.stringify(rendered!.toJSON())).toContain('event_created');
});

function selectScreen(rendered: ReactTestRenderer.ReactTestRenderer, screen: string) {
  const tab = rendered.root.findByProps({accessibilityLabel: `${screen} screen`});
  return ReactTestRenderer.act(() => tab.props.onPress());
}

test('approve/reject only render for a role permitted to moderate (owner/admin/operator/moderator), never for a viewer', async () => {
  const moderations: Array<[string, string, string | undefined]> = [];
  const heldItem = {eventId: 'event-held', sourceType: 'payment' as const, status: 'held' as const, createdAt: '2026-08-15T00:00:00.000Z', displayName: 'Supporter', message: 'hi', grossAmountPaise: 5000, currency: 'INR' as const};

  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        history={[heldItem]}
        onModerate={(eventId, action, reason) => moderations.push([eventId, action, reason])}
      />,
    );
  });
  await selectScreen(rendered!, 'activity');

  const reasonInput = rendered!.root.findByProps({accessibilityLabel: 'Moderation reason for event-held'});
  await ReactTestRenderer.act(() => reasonInput.props.onChangeText('looks fine'));
  const approve = rendered!.root.findByProps({accessibilityLabel: 'Approve event-held'});
  await ReactTestRenderer.act(() => approve.props.onPress());
  expect(moderations).toEqual([['event-held', 'approve', 'looks fine']]);

  // A viewer role never sees the approve/reject controls at all.
  const viewerUser = {...baseUser, channels: [{channelId: 'channel-1', role: 'viewer' as const}]};
  let viewerRendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    viewerRendered = ReactTestRenderer.create(
      <CompanionShell currentUser={viewerUser} companionState={baseState} companionQueues={baseQueues} history={[heldItem]} />,
    );
  });
  await selectScreen(viewerRendered!, 'activity');
  expect(() => viewerRendered!.root.findByProps({accessibilityLabel: 'Approve event-held'})).toThrow();
  expect(JSON.stringify(viewerRendered!.toJSON())).toContain('Your role can view held items but cannot approve or reject them.');
});

test('recent tips render donor-nulled fields (server-scoped) without crashing, and payment/refund status renders amounts', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        recentTips={{schemaVersion: 'v1', channelId: 'channel-1', items: [{eventId: 'tip-1', displayName: null, message: null, grossAmountPaise: null, currency: null, createdAt: '2026-08-15T00:00:00.000Z'}]}}
        paymentStatus={{schemaVersion: 'v1', channelId: 'channel-1', items: [{paymentId: 'pay-1', status: 'captured', grossAmountPaise: 25000, currency: 'INR', refundStatus: null, refundAmountPaise: null, createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z'}]}}
      />,
    );
  });
  await selectScreen(rendered!, 'activity');
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('Supporter');
  expect(output).toContain('250.00');
});

test('stream health panel: a stale OBS heartbeat renders the "stale" badge, not "healthy"', async () => {
  const staleState = {...baseState, helperPaired: true, obsConnected: false, obsStatusReportedAt: '2020-01-01T00:00:00.000Z'};
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={staleState} companionQueues={baseQueues} />,
    );
  });
  await selectScreen(rendered!, 'health');
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: stale'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: healthy'})).toThrow();
});

test('stream health panel: no helper paired at all renders OBS as "unknown", not "stale" and not "healthy" (regression: conflating no-pairing with a stale heartbeat)', async () => {
  const noHelperState = {...baseState, helperPaired: false, obsConnected: false, obsStatusReportedAt: null};
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={noHelperState} companionQueues={baseQueues} />,
    );
  });
  await selectScreen(rendered!, 'health');
  // The exact badge text a stale-vs-unknown regression would flip.
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: unknown'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: stale'})).toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: healthy'})).toThrow();
  expect(JSON.stringify(rendered!.toJSON())).toContain('No paired helper to report from');
});

test('stream health panel: a healthy helper+OBS pairing renders "healthy", distinct from both stale and unknown', async () => {
  const healthyState = {...baseState, helperPaired: true, obsConnected: true, obsStatusReportedAt: '2026-08-15T00:00:00.000Z'};
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={healthyState} companionQueues={baseQueues} />,
    );
  });
  await selectScreen(rendered!, 'health');
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: healthy'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: stale'})).toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'OBS connection: unknown'})).toThrow();
});

test('stream health panel: a disconnected overlay/helper/payment render "unhealthy", the fourth signal state, distinct from healthy/stale/unknown badges on the same screen', async () => {
  const downState = {...baseState, overlayConnected: false, helperPaired: false, paymentAccountConnected: false};
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={downState} companionQueues={baseQueues} />,
    );
  });
  await selectScreen(rendered!, 'health');
  // A regression that renders "unhealthy" the same as "unknown" (e.g. no
  // paired helper) would make a real outage look like "no data yet".
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Alerts overlay: unhealthy'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Desktop helper: unhealthy'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Payment account: unhealthy'})).not.toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Alerts overlay: healthy'})).toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Alerts overlay: unknown'})).toThrow();
  // Mirror/stream remain 'unknown' on the same screen -- proves the four
  // states coexist correctly rather than one value leaking onto another key.
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Mirror: unknown'})).not.toThrow();
});

test('queue pause/resume is disabled and inert for a viewer role, and enabled and wired for an operator role', async () => {
  const actions: string[] = [];
  const viewerUser = {...baseUser, channels: [{channelId: 'channel-1', role: 'viewer' as const}]};
  let viewerRendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    viewerRendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={viewerUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onAction={action => actions.push(action)}
      />,
    );
  });
  const viewerPause = viewerRendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  const viewerResume = viewerRendered!.root.findByProps({accessibilityLabel: 'Resume alert queue'});
  // Pressable's own `disabled` prop is what blocks a real touch from ever
  // reaching onPress -- assert that gate directly, matching the pattern
  // used for the OBS controls above. (Note: onPress itself has no
  // independent canOperateQueue check -- see report defect note re:
  // CompanionShell.tsx pause/resume handlers.)
  expect(viewerPause.props.accessibilityState).toMatchObject({disabled: true});
  expect(viewerResume.props.accessibilityState).toMatchObject({disabled: true});
  expect(actions).toEqual([]);
  expect(JSON.stringify(viewerRendered!.toJSON())).toContain('Your role can view state but cannot operate the queue.');

  let operatorRendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    operatorRendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onAction={action => actions.push(action)}
      />,
    );
  });
  const operatorPause = operatorRendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  const operatorResume = operatorRendered!.root.findByProps({accessibilityLabel: 'Resume alert queue'});
  expect(operatorPause.props.accessibilityState).toMatchObject({disabled: false});
  expect(operatorResume.props.accessibilityState).toMatchObject({disabled: false});
  await ReactTestRenderer.act(() => operatorPause.props.onPress());
  await ReactTestRenderer.act(() => operatorResume.props.onPress());
  expect(actions).toEqual(['pause_queue', 'resume_queue']);
});

test('mute never invokes the cancel callback and cancel never invokes the mute callback, even when both are wired (regression: mute/cancel cross-wired to the same action)', async () => {
  const muteCalls: Array<[string, boolean]> = [];
  const cancelCalls: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onMuteTts={(queueId, muted) => muteCalls.push([queueId, muted])}
        onCancelTts={deliveryId => cancelCalls.push(deliveryId)}
      />,
    );
  });

  const mute = rendered!.root.findByProps({accessibilityLabel: 'Mute upcoming TTS'});
  await ReactTestRenderer.act(() => mute.props.onPress());
  expect(muteCalls).toEqual([['queue-1', true]]);
  expect(cancelCalls).toEqual([]); // pressing Mute must never reach onCancelTts

  const cancelInput = rendered!.root.findByProps({accessibilityLabel: 'Delivery id to cancel'});
  await ReactTestRenderer.act(() => cancelInput.props.onChangeText('delivery-42'));
  const cancel = rendered!.root.findByProps({accessibilityLabel: 'Cancel currently-playing TTS'});
  await ReactTestRenderer.act(() => cancel.props.onPress());
  expect(cancelCalls).toEqual(['delivery-42']);
  expect(muteCalls).toEqual([['queue-1', true]]); // pressing Cancel must never reach onMuteTts again
});

test('reject (suppress) fires for a permitted moderator role, distinct from approve', async () => {
  const moderations: Array<[string, string, string | undefined]> = [];
  const heldItem = {eventId: 'event-held-2', sourceType: 'payment' as const, status: 'held' as const, createdAt: '2026-08-15T00:00:00.000Z', displayName: 'Supporter', message: 'hi', grossAmountPaise: 5000, currency: 'INR' as const};
  const moderatorUser = {...baseUser, channels: [{channelId: 'channel-1', role: 'moderator' as const}]};

  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={moderatorUser}
        companionState={baseState}
        companionQueues={baseQueues}
        history={[heldItem]}
        onModerate={(eventId, action, reason) => moderations.push([eventId, action, reason])}
      />,
    );
  });
  await selectScreen(rendered!, 'activity');
  const reject = rendered!.root.findByProps({accessibilityLabel: 'Reject event-held-2'});
  await ReactTestRenderer.act(() => reject.props.onPress());
  expect(moderations).toEqual([['event-held-2', 'suppress', undefined]]);
});

test('a viewer role cannot approve or reject even when a moderation reason has been typed', async () => {
  const moderations: Array<[string, string, string | undefined]> = [];
  const heldItem = {eventId: 'event-held-3', sourceType: 'payment' as const, status: 'held' as const, createdAt: '2026-08-15T00:00:00.000Z', displayName: 'Supporter', message: 'hi', grossAmountPaise: 5000, currency: 'INR' as const};
  const viewerUser = {...baseUser, channels: [{channelId: 'channel-1', role: 'viewer' as const}]};

  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={viewerUser}
        companionState={baseState}
        companionQueues={baseQueues}
        history={[heldItem]}
        onModerate={(eventId, action, reason) => moderations.push([eventId, action, reason])}
      />,
    );
  });
  await selectScreen(rendered!, 'activity');
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Approve event-held-3'})).toThrow();
  expect(() => rendered!.root.findByProps({accessibilityLabel: 'Reject event-held-3'})).toThrow();
  expect(moderations).toEqual([]);
});

test('recent tips and payment/refund status: no data renders an explicit empty message, not a crash or blank card', async () => {
  let renderedUndefined: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderedUndefined = ReactTestRenderer.create(
      <CompanionShell currentUser={baseUser} companionState={baseState} companionQueues={baseQueues} />,
    );
  });
  await selectScreen(renderedUndefined!, 'activity');
  let output = JSON.stringify(renderedUndefined!.toJSON());
  expect(output).toContain('No recent tips are available for this channel.');
  expect(output).toContain('No payment records are visible to your role, or none exist yet.');

  let renderedEmpty: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderedEmpty = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        recentTips={{schemaVersion: 'v1', channelId: 'channel-1', items: []}}
        paymentStatus={{schemaVersion: 'v1', channelId: 'channel-1', items: []}}
      />,
    );
  });
  await selectScreen(renderedEmpty!, 'activity');
  output = JSON.stringify(renderedEmpty!.toJSON());
  expect(output).toContain('No recent tips are available for this channel.');
  expect(output).toContain('No payment records are visible to your role, or none exist yet.');
});

test('recent tips and payment/refund status: partial data (some items donor-nulled, others fully populated) renders every row without crashing', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={baseUser}
        companionState={baseState}
        companionQueues={baseQueues}
        recentTips={{schemaVersion: 'v1', channelId: 'channel-1', items: [
          {eventId: 'tip-nulled', displayName: null, message: null, grossAmountPaise: null, currency: null, createdAt: '2026-08-15T00:00:00.000Z'},
          {eventId: 'tip-full', displayName: 'Priya', message: 'great stream', grossAmountPaise: 15000, currency: 'INR', createdAt: '2026-08-15T00:05:00.000Z'},
        ]}}
        paymentStatus={{schemaVersion: 'v1', channelId: 'channel-1', items: [
          {paymentId: 'pay-no-refund', status: 'captured', grossAmountPaise: 10000, currency: 'INR', refundStatus: null, refundAmountPaise: null, createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z'},
          {paymentId: 'pay-refunded', status: 'refunded', grossAmountPaise: 20000, currency: 'INR', refundStatus: 'completed', refundAmountPaise: 20000, createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T01:00:00.000Z'},
        ]}}
      />,
    );
  });
  await selectScreen(rendered!, 'activity');
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('Priya');
  expect(output).toContain('great stream');
  expect(output).toContain('150.00');
  expect(output).toContain('Supporter'); // fallback display name for the nulled tip row
  expect(output).toContain('No message'); // fallback for the nulled tip's message
  expect(output).toContain('No refund'); // pay-no-refund row
  expect(output).toContain('Refund: completed'); // pay-refunded row
});
