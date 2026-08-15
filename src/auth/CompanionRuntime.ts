import {CompanionApi, type CompanionAccountSession, type CompanionAlertHistory, type CompanionBilling, type CompanionQueue, type CompanionState, type CurrentUser, type FetchLike} from '../api/CompanionApi';
import {CompanionSessionController} from './CompanionSessionController';
import type {CompanionSessionStore} from './SecureSessionStore';

export type GoogleCredentialProvider = () => Promise<{
  idToken: string;
  deviceLabel: string;
}>;

export type CompanionChannelProjection = {
  channelId: string;
  state: CompanionState;
  queues: CompanionQueue[];
  history: CompanionAlertHistory[];
  billing: CompanionBilling;
  sessions: CompanionAccountSession[];
};

/**
 * Wires the transport client, server-owned user projection and secure session
 * boundary. Native Google SDK code is injected by the platform shell rather
 * than embedded in this shared runtime.
 */
export class CompanionRuntime {
  readonly api: CompanionApi;
  readonly sessions: CompanionSessionController;

  constructor(
    baseUrl: string,
    store: CompanionSessionStore,
    private readonly getGoogleCredential: GoogleCredentialProvider,
    fetchImpl?: FetchLike,
  ) {
    let sessions: CompanionSessionController;
    this.api = new CompanionApi({
      baseUrl,
      fetchImpl,
      getAccessToken: () => sessions.getAccessToken(),
    });
    sessions = new CompanionSessionController(
      store,
      (idToken, deviceLabel) => this.api.exchangeGoogleIdentity(idToken, deviceLabel),
    );
    this.sessions = sessions;
  }

  async restore(): Promise<CurrentUser | null> {
    const restored = await this.sessions.restore();
    if (!restored && !(await this.sessions.getAccessToken())) return null;
    try {
      const user = await this.api.getCurrentUser();
      return user;
    } catch {
      await this.sessions.signOut().catch(() => undefined);
      return null;
    }
  }

  async signIn(): Promise<CurrentUser> {
    const credential = await this.getGoogleCredential();
    return this.sessions.signIn(credential.idToken, credential.deviceLabel);
  }

  async loadChannelProjection(channelId: string): Promise<CompanionChannelProjection> {
    const [state, queues, historyPage, billing, sessions] = await Promise.all([
      this.api.getCompanionState(channelId),
      this.api.getQueues(channelId),
      this.api.getHistory(channelId),
      this.api.getBilling(channelId),
      this.api.getSessions(),
    ]);
    return {
      channelId,
      state,
      queues: queues.queues,
      history: historyPage.items,
      billing,
      sessions: sessions.sessions,
    };
  }

  async signOut(): Promise<void> {
    await this.sessions.signOut();
  }
}
