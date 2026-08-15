# BharatStudio Companion Mobile

Owns iOS and Android Companion experiences: sign-in, operational views, notification preferences, read-only/control-session UX, and platform release requirements.

It does not own payment checkout, raw OBS credentials, client-side entitlement authority, or direct database access.

## Bootstrap status

- React Native Community CLI scaffold is pinned to React Native 0.87.0 and the matching 20.2.0 CLI/tooling line.
- New Architecture and Hermes remain the runtime direction supplied by the template.
- The scaffold is not a release build: no Apple/Google credentials, signing keys, production API origin, push provider, payment checkout, OBS control, or entitlement authority is present.
- The implementation must use the server-authorized REST/OpenAPI contract and privacy-minimised notification payloads. Any desktop control action must be mediated by an explicitly paired desktop helper.

## Push boundary

FCM is the Android transport and FCM-over-APNs is the iOS transport. The
Firebase Messaging adapter is present in
`src/notifications/FirebaseNotificationAdapter.ts`; it requests permission,
registers a token explicitly, handles token refresh and validates only the
privacy-minimised notification envelope. `firebase.json` disables automatic
messaging/analytics initialisation until the product flow requests it.

The repository intentionally does not contain `google-services.json`,
`GoogleService-Info.plist`, APNs keys, Firebase project IDs or release
credentials. Those are environment/store provisioning inputs and must be
injected by the release pipeline.

## Local verification

```text
npm install
npm test -- --runInBand
npm run lint
npm run test:dependencies
```

Store accounts, package identifiers, signing, supported OS-floor approval, device matrix, privacy declarations and release-track evidence remain L07 gates.
