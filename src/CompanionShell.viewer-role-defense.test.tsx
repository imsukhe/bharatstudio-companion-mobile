/**
 * @format
 *
 * Regression test for the fixed defence-in-depth gap in CompanionShell.tsx.
 *
 * Previously, the queue-operate controls (pause/resume/send_test_alert,
 * CompanionShell.tsx:279,288,299) gated only on `selectedQueue` being
 * truthy inside the `onPress` handler itself, relying entirely on the
 * Pressable's `disabled` prop for role enforcement. Calling
 * `.props.onPress()` directly (bypassing `disabled`, e.g. via assistive
 * tooling or a future regression that drops the prop) fired `onAction`
 * for a viewer role with no client-side stop.
 *
 * The handlers now check `canOperateQueue` themselves before calling
 * `onAction`, so this test proves BOTH that a viewer sees `disabled: true`
 * (the rendered contract) AND that invoking `onPress()` directly is a
 * no-op for that role — closing the gap the handler previously left open.
 * (Server-side companion.ts remains the real authority regardless; this
 * is defense in depth, not the sole gate.)
 *
 * Contrast: moderation controls (approve/reject) are never even rendered
 * for a role that cannot moderate — see CompanionShell.test.tsx's
 * 'a viewer role cannot approve or reject...' — a stricter pattern than
 * render-and-disable. This file documents that the queue-operate handlers
 * now match that same independent-of-render-state guarantee, just via a
 * disabled-and-refuse pattern rather than not-rendered-at-all.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {CompanionShell} from './CompanionShell';

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

test('FIXED: a viewer\'s pause/resume/send_test_alert onPress handlers refuse independently of the disabled prop', async () => {
  const viewerUser = {
    schemaVersion: 'v1' as const,
    userId: 'user-1',
    displayName: 'Viewer',
    channels: [{channelId: 'channel-1', role: 'viewer' as const}],
  };
  const actions: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={viewerUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onAction={action => actions.push(action)}
      />,
    );
  });

  const pause = rendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  const resume = rendered!.root.findByProps({accessibilityLabel: 'Resume alert queue'});
  const sendTest = rendered!.root.findByProps({accessibilityLabel: 'Send a test alert'});

  // Confirms the rendered contract a real touch relies on.
  expect(pause.props.accessibilityState).toMatchObject({disabled: true});
  expect(resume.props.accessibilityState).toMatchObject({disabled: true});
  expect(sendTest.props.accessibilityState).toMatchObject({disabled: true});

  // Regression guard: even calling onPress directly (bypassing `disabled`)
  // must now be a no-op for a viewer — the handler itself refuses.
  await ReactTestRenderer.act(() => pause.props.onPress());
  await ReactTestRenderer.act(() => resume.props.onPress());
  await ReactTestRenderer.act(() => sendTest.props.onPress());
  expect(actions).toEqual([]);
});

test('FIXED: an operator role still reaches onAction for pause/resume/send_test_alert', async () => {
  const operatorUser = {
    schemaVersion: 'v1' as const,
    userId: 'user-2',
    displayName: 'Operator',
    channels: [{channelId: 'channel-1', role: 'operator' as const}],
  };
  const actions: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={operatorUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onAction={action => actions.push(action)}
      />,
    );
  });

  const pause = rendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  const resume = rendered!.root.findByProps({accessibilityLabel: 'Resume alert queue'});
  const sendTest = rendered!.root.findByProps({accessibilityLabel: 'Send a test alert'});

  expect(pause.props.accessibilityState).toMatchObject({disabled: false});

  await ReactTestRenderer.act(() => pause.props.onPress());
  await ReactTestRenderer.act(() => resume.props.onPress());
  await ReactTestRenderer.act(() => sendTest.props.onPress());
  expect(actions).toEqual(['pause_queue', 'resume_queue', 'send_test_alert']);
});

test('FIXED: OBS start/stop/set-scene onPress handlers refuse when not entitled, independently of the disabled prop (same pattern as the queue-operate fix, CompanionShell.tsx ~325-353)', async () => {
  const operatorUser = {
    schemaVersion: 'v1' as const,
    userId: 'user-3',
    displayName: 'Operator',
    channels: [{channelId: 'channel-1', role: 'operator' as const}],
  };
  const actions: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={operatorUser}
        companionState={baseState}
        companionQueues={baseQueues}
        // companionActionGroups defaults to ['alerts'] -- obs NOT entitled.
        onAction={action => actions.push(action)}
      />,
    );
  });

  const start = rendered!.root.findByProps({accessibilityLabel: 'Start OBS stream'});
  const stop = rendered!.root.findByProps({accessibilityLabel: 'Stop OBS stream'});
  const sceneInput = rendered!.root.findByProps({accessibilityLabel: 'OBS scene name'});
  await ReactTestRenderer.act(() => sceneInput.props.onChangeText('Main Scene'));
  const setScene = rendered!.root.findByProps({accessibilityLabel: 'Set OBS scene'});

  expect(start.props.accessibilityState).toMatchObject({disabled: true});

  await ReactTestRenderer.act(() => start.props.onPress());
  await ReactTestRenderer.act(() => stop.props.onPress());
  await ReactTestRenderer.act(() => setScene.props.onPress());
  expect(actions).toEqual([]);
});

test('FIXED: mute/unmute/cancel TTS onPress handlers refuse when the queue cannot be operated, independently of the disabled prop (CompanionShell.tsx ~396-427)', async () => {
  const viewerUser = {
    schemaVersion: 'v1' as const,
    userId: 'user-4',
    displayName: 'Viewer',
    channels: [{channelId: 'channel-1', role: 'viewer' as const}],
  };
  const muteCalls: Array<[string, boolean]> = [];
  const cancelCalls: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={viewerUser}
        companionState={baseState}
        companionQueues={baseQueues}
        onMuteTts={(queueId, muted) => muteCalls.push([queueId, muted])}
        onCancelTts={deliveryId => cancelCalls.push(deliveryId)}
      />,
    );
  });

  const mute = rendered!.root.findByProps({accessibilityLabel: 'Mute upcoming TTS'});
  const unmute = rendered!.root.findByProps({accessibilityLabel: 'Unmute upcoming TTS'});

  expect(mute.props.accessibilityState).toMatchObject({disabled: true});

  await ReactTestRenderer.act(() => mute.props.onPress());
  await ReactTestRenderer.act(() => unmute.props.onPress());
  expect(muteCalls).toEqual([]);
  expect(cancelCalls).toEqual([]);
});
