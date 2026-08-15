/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { FirebaseNotificationAdapter, installFirebaseBackgroundHandler } from './src/notifications/FirebaseNotificationAdapter';

installFirebaseBackgroundHandler();

AppRegistry.registerComponent(appName, () => props => React.createElement(App, {
  ...props,
  notificationAdapter: new FirebaseNotificationAdapter(),
}));
