import type {CompanionAuthExchange, CurrentUser} from '../api/CompanionApi';
import type {CompanionSessionStore, StoredCompanionSession} from './SecureSessionStore';

export type GoogleIdentityExchange = (
  idToken: string,
  deviceLabel: string,
) => Promise<CompanionAuthExchange>;

export class CompanionSessionController {
  private session: StoredCompanionSession | null = null;
  private user: CurrentUser | null = null;

  constructor(
    private readonly store: CompanionSessionStore,
    private readonly exchangeGoogleIdentity: GoogleIdentityExchange,
  ) {}

  async restore(): Promise<CurrentUser | null> {
    const stored = await this.store.read();
    this.session = stored;
    this.user = stored ? null : null;
    return this.user;
  }

  async signIn(idToken: string, deviceLabel: string): Promise<CurrentUser> {
    const exchanged = await this.exchangeGoogleIdentity(idToken, deviceLabel);
    const nextSession: StoredCompanionSession = {
      accessToken: exchanged.accessToken,
      expiresAt: exchanged.expiresAt,
    };

    // Persist before exposing the session to API callers. If secure storage
    // fails, the caller remains signed out and no plaintext fallback exists.
    await this.store.write(nextSession);
    this.session = nextSession;
    this.user = exchanged.user;
    return exchanged.user;
  }

  async signOut(): Promise<void> {
    // Clear the in-memory view first so a failed persistent clear cannot leave
    // this process authorised. The rejection remains visible for recovery UI.
    this.session = null;
    this.user = null;
    await this.store.clear();
  }

  getCurrentUser(): CurrentUser | null {
    return this.user;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.session) return null;
    if (Date.parse(this.session.expiresAt) <= Date.now()) {
      this.session = null;
      this.user = null;
      await this.store.clear();
      return null;
    }
    return this.session.accessToken;
  }
}
