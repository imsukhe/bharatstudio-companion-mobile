/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, Text, useColorScheme } from 'react-native';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import {CompanionShell} from './src/CompanionShell';
import {CompanionRuntime, type CompanionChannelProjection, type GoogleCredentialProvider} from './src/auth/CompanionRuntime';
import {KeychainCompanionSessionStore} from './src/auth/SecureSessionStore';
import type {CompanionNotificationPreferences, CurrentUser} from './src/api/CompanionApi';
import type {NativeNotificationAdapter} from './src/notifications/FirebaseNotificationAdapter';

export type CompanionAppProps = {
  apiBaseUrl?: string;
  googleCredentialProvider?: GoogleCredentialProvider;
  notificationAdapter?: NativeNotificationAdapter;
};

function App({apiBaseUrl, googleCredentialProvider, notificationAdapter}: CompanionAppProps) {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent apiBaseUrl={apiBaseUrl} googleCredentialProvider={googleCredentialProvider} notificationAdapter={notificationAdapter} />
    </SafeAreaProvider>
  );
}

function AppContent({apiBaseUrl, googleCredentialProvider, notificationAdapter}: CompanionAppProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>();
  const [projection, setProjection] = useState<CompanionChannelProjection | undefined>();
  const [runtimeError, setRuntimeError] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<CompanionNotificationPreferences | undefined>();
  const projectionRequest = useRef(0);
  const runtime = useMemo(() => {
    if (!apiBaseUrl || !googleCredentialProvider) return null;
    return new CompanionRuntime(apiBaseUrl, new KeychainCompanionSessionStore(), googleCredentialProvider);
  }, [apiBaseUrl, googleCredentialProvider]);

  const loadProjection = useCallback(async (channelId: string) => {
    if (!runtime) return;
    const requestId = ++projectionRequest.current;
    const next = await runtime.loadChannelProjection(channelId);
    if (requestId === projectionRequest.current) setProjection(next);
  }, [runtime]);

  const loadNotificationPreferences = useCallback(async () => {
    if (!runtime) return;
    const preferences = await runtime.api.getNotificationPreferences();
    setNotificationPreferences(preferences);
  }, [runtime]);

  useEffect(() => {
    let active = true;
    if (!runtime) return () => { active = false; };
    runtime.restore().then(async user => {
      if (active && user) {
        setCurrentUser(user);
        await loadNotificationPreferences();
        const firstChannel = user.channels[0];
        if (firstChannel) await loadProjection(firstChannel.channelId);
      }
    }).catch(() => {
      if (active) setRuntimeError(true);
    });
    return () => { active = false; };
  }, [runtime, loadNotificationPreferences, loadProjection]);

  useEffect(() => {
    if (!runtime || !currentUser || !notificationAdapter || !notificationPreferences
      || !(notificationPreferences.connectionAlerts || notificationPreferences.securityAlerts || notificationPreferences.actionFailures)) return;
    return notificationAdapter.onTokenRefresh(registration => {
      runtime.api.registerNotificationDevice(registration.platform, registration.token).catch(() => undefined);
    });
  }, [runtime, currentUser, notificationPreferences, notificationAdapter]);

  const signIn = runtime
    ? async () => {
      try {
        setRuntimeError(false);
        const user = await runtime.signIn();
        setCurrentUser(user);
        await loadNotificationPreferences();
        const firstChannel = user.channels[0];
        if (firstChannel) await loadProjection(firstChannel.channelId);
      } catch {
        setRuntimeError(true);
      }
    }
    : undefined;

  const updateNotificationPreferences = runtime
    ? async (preferences: Omit<CompanionNotificationPreferences, 'schemaVersion'>) => {
      try {
        const wantsPush = preferences.connectionAlerts || preferences.securityAlerts || preferences.actionFailures;
        if (wantsPush) {
          if (!notificationAdapter) throw new Error('Native notifications are unavailable');
          if (!await notificationAdapter.requestPermission()) throw new Error('Notification permission was not granted');
          const registration = await notificationAdapter.register();
          await runtime.api.registerNotificationDevice(registration.platform, registration.token);
        } else {
          const devices = await runtime.api.getNotificationDevices();
          await Promise.all(devices.devices.map(device => runtime.api.revokeNotificationDevice(device.deviceId)));
        }
        const saved = await runtime.api.updateNotificationPreferences(preferences);
        setNotificationPreferences(saved);
      } catch {
        setRuntimeError(true);
      }
    }
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <CompanionShell
        onSignIn={signIn}
        currentUser={currentUser}
        companionState={projection?.state}
        companionQueues={projection?.queues}
        history={projection?.history}
        billing={projection?.billing}
        sessions={projection?.sessions}
        onRevokeSession={async sessionId => {
          if (!runtime || !currentUser) return;
          try {
            await runtime.api.revokeSession(sessionId);
            const channel = projection?.channelId ?? currentUser.channels[0]?.channelId;
            if (channel) await loadProjection(channel);
          } catch {
            setRuntimeError(true);
          }
        }}
        onSelectChannel={channelId => {
          if (!runtime) return;
          loadProjection(channelId).catch(() => setRuntimeError(true));
        }}
        notificationPreferences={notificationPreferences}
        onUpdateNotificationPreferences={updateNotificationPreferences}
      />
      {runtimeError && <Text accessibilityRole="alert" style={styles.errorText}>We could not connect securely. Check your connection and try again.</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    color: '#a61b1b',
    paddingHorizontal: 24,
    paddingBottom: 16,
    textAlign: 'center',
  },
});

export default App;
