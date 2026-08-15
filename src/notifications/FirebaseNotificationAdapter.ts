import {AuthorizationStatus, getMessaging, getToken, onMessage, onTokenRefresh, registerDeviceForRemoteMessages, requestPermission, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import {parseNotification, parseRegistration, type CompanionNotification, type NotificationRegistration} from './CompanionNotificationPolicy';

export type NotificationMessageHandler = (notification: CompanionNotification) => void | Promise<void>;
export type NotificationTokenHandler = (registration: NotificationRegistration) => void | Promise<void>;

export interface NativeNotificationAdapter {
  requestPermission(): Promise<boolean>;
  register(): Promise<NotificationRegistration>;
  onForegroundMessage(handler: NotificationMessageHandler): () => void;
  onTokenRefresh(handler: NotificationTokenHandler): () => void;
}

/**
 * FCM adapter for Android and FCM-over-APNs on iOS. Provider payloads are
 * accepted only through the privacy-minimised policy decoder; raw provider
 * messages never reach the Companion UI.
 */
export class FirebaseNotificationAdapter implements NativeNotificationAdapter {
  async requestPermission(): Promise<boolean> {
    const status = await requestPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED
      || status === AuthorizationStatus.PROVISIONAL
      || status === AuthorizationStatus.EPHEMERAL;
  }

  async register(): Promise<NotificationRegistration> {
    const instance = getMessaging();
    await registerDeviceForRemoteMessages(instance);
    const token = await getToken(instance);
    return parseRegistration({
      schemaVersion: 'v1',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      token,
    });
  }

  onForegroundMessage(handler: NotificationMessageHandler): () => void {
    return onMessage(getMessaging(), async message => {
      const encoded = message.data?.payload;
      if (typeof encoded !== 'string') return;
      try {
        await handler(parseNotification(JSON.parse(encoded)));
      } catch {
        // Malformed or sensitive provider data is intentionally ignored.
      }
    });
  }

  onTokenRefresh(handler: NotificationTokenHandler): () => void {
    return onTokenRefresh(getMessaging(), async token => {
      try {
        await handler(parseRegistration({
          schemaVersion: 'v1',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          token,
        }));
      } catch {
        // Invalid provider tokens are not sent to the server.
      }
    });
  }
}

export function installFirebaseBackgroundHandler(): void {
  setBackgroundMessageHandler(getMessaging(), async message => {
    const encoded = message.data?.payload;
    if (typeof encoded !== 'string') return;
    try {
      // Validate only. Background handling never persists or displays
      // financial/alert data and never performs a payment or queue action.
      parseNotification(JSON.parse(encoded));
    } catch {
      // Ignore malformed or over-broad background payloads.
    }
  });
}
