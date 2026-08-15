import * as Keychain from 'react-native-keychain';

const SERVICE = 'in.bharatstudio.companion.session.v1';
const MAX_TOKEN_LENGTH = 256;

export type StoredCompanionSession = {
  accessToken: string;
  expiresAt: string;
};

export interface CompanionSessionStore {
  read(): Promise<StoredCompanionSession | null>;
  write(session: StoredCompanionSession): Promise<void>;
  clear(): Promise<void>;
}

function isValidSession(value: unknown): value is StoredCompanionSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === 'string'
    && record.accessToken.length >= 32
    && record.accessToken.length <= MAX_TOKEN_LENGTH
    && typeof record.expiresAt === 'string'
    && Number.isFinite(Date.parse(record.expiresAt));
}

/**
 * Stores the opaque BharatStudio session only in iOS Keychain/Android Keystore
 * through react-native-keychain. There is deliberately no AsyncStorage or
 * in-memory production fallback: if secure storage is unavailable, sign-in
 * must fail closed rather than downgrade the credential boundary.
 */
export class KeychainCompanionSessionStore implements CompanionSessionStore {
  async read(): Promise<StoredCompanionSession | null> {
    const credentials = await Keychain.getGenericPassword({service: SERVICE});
    if (!credentials) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(credentials.password);
    } catch {
      await this.clear();
      return null;
    }
    if (!isValidSession(parsed)) {
      await this.clear();
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      await this.clear();
      return null;
    }
    return parsed;
  }

  async write(session: StoredCompanionSession): Promise<void> {
    if (!isValidSession(session) || Date.parse(session.expiresAt) <= Date.now()) {
      throw new Error('invalid_session');
    }
    const result = await Keychain.setGenericPassword(
      'bharatstudio-companion',
      JSON.stringify(session),
      {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
    if (result === false) throw new Error('secure_storage_unavailable');
  }

  async clear(): Promise<void> {
    const cleared = await Keychain.resetGenericPassword({service: SERVICE});
    if (!cleared) throw new Error('secure_storage_unavailable');
  }
}

