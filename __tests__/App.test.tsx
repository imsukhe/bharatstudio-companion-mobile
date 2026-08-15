/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {CompanionShell} from '../src/CompanionShell';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('signed-out shell does not fabricate account or payment state', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(<CompanionShell />);
  });
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('Sign-in setup pending');
  expect(output).toContain('Alerts and payment delivery remain server-owned');
});

test('signed-in shell renders server state and only exposes bounded queue actions', async () => {
  const actions: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={{
          schemaVersion: 'v1',
          userId: 'user-1',
          displayName: 'Creator',
          channels: [{channelId: 'channel-1', role: 'operator'}],
        }}
        companionState={{
          schemaVersion: 'v1',
          channelId: 'channel-1',
          overlayConnected: true,
          pendingAlerts: 3,
          lastUpdatedAt: '2026-08-15T00:00:00.000Z',
        }}
        companionQueues={[{
          schemaVersion: 'v1',
          queueId: 'queue-1',
          channelId: 'channel-1',
          name: 'Main alerts',
          paused: false,
          active: true,
        }]}
        onAction={action => actions.push(action)}
      />,
    );
  });
  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('Creator');
  expect(output).toContain('3 alerts waiting for delivery.');
  expect(output).toContain('Live connection');

  const pause = rendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  const resume = rendered!.root.findByProps({accessibilityLabel: 'Resume alert queue'});
  await ReactTestRenderer.act(() => pause.props.onPress());
  await ReactTestRenderer.act(() => resume.props.onPress());
  expect(actions).toEqual(['pause_queue', 'resume_queue']);
});

test('signed-in shell lets a multi-channel account select the channel whose state is shown', async () => {
  const selected: string[] = [];
  let rendered: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={{
          schemaVersion: 'v1',
          userId: 'user-1',
          channels: [
            {channelId: 'channel-alpha', role: 'owner'},
            {channelId: 'channel-beta', role: 'moderator'},
          ],
        }}
        companionState={{
          schemaVersion: 'v1',
          channelId: 'channel-alpha',
          overlayConnected: false,
          pendingAlerts: 0,
          lastUpdatedAt: '2026-08-15T00:00:00.000Z',
        }}
        onSelectChannel={channelId => selected.push(channelId)}
      />,
    );
  });

  const beta = rendered!.root.findByProps({accessibilityLabel: 'Select channel channel-beta'});
  await ReactTestRenderer.act(() => beta.props.onPress());
  expect(selected).toEqual(['channel-beta']);
  expect(JSON.stringify(rendered!.toJSON())).toContain('channel-alpha');
  expect(JSON.stringify(rendered!.toJSON())).toContain('channel-beta');
});

test('signed-in shell never enables queue actions without an active target', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  const action = jest.fn();
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={{schemaVersion: 'v1', userId: 'user-1', channels: [{channelId: 'channel-1', role: 'operator'}]}}
        companionState={{schemaVersion: 'v1', channelId: 'channel-1', overlayConnected: true, pendingAlerts: 1, lastUpdatedAt: '2026-08-15T00:00:00.000Z'}}
        companionQueues={[]}
        onAction={action}
      />,
    );
  });
  const pause = rendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  expect(pause.props.accessibilityState).toEqual({disabled: true});
  expect(action).not.toHaveBeenCalled();
});

test('signed-in shell ignores stale state and queues from another channel', async () => {
  let rendered: ReactTestRenderer.ReactTestRenderer;
  const action = jest.fn();
  await ReactTestRenderer.act(() => {
    rendered = ReactTestRenderer.create(
      <CompanionShell
        currentUser={{schemaVersion: 'v1', userId: 'user-1', channels: [{channelId: 'channel-a', role: 'operator'}]}}
        companionState={{schemaVersion: 'v1', channelId: 'channel-b', overlayConnected: true, pendingAlerts: 99, lastUpdatedAt: '2026-08-15T00:00:00.000Z'}}
        companionQueues={[{
          schemaVersion: 'v1',
          queueId: 'queue-b',
          channelId: 'channel-b',
          name: 'Other channel',
          paused: false,
          active: true,
        }]}
        selectedQueueId="queue-b"
        onAction={action}
      />,
    );
  });

  const output = JSON.stringify(rendered!.toJSON());
  expect(output).toContain('Channel state is temporarily unavailable.');
  expect(output).not.toContain('99 alerts waiting for delivery.');
  expect(output).not.toContain('Other channel');

  const pause = rendered!.root.findByProps({accessibilityLabel: 'Pause alert queue'});
  expect(pause.props.accessibilityState).toEqual({disabled: true});
  expect(action).not.toHaveBeenCalled();
});
