import type {CompanionApi, CompanionControlSession} from '../api/CompanionApi';

export class CompanionControlSessionManager {
  private session: CompanionControlSession | null = null;

  constructor(
    private readonly api: Pick<CompanionApi, 'acquireControlSession' | 'revokeControlSession'>,
    private readonly channelId: string,
    private readonly clientInstanceId: string,
  ) {}

  async acquire(): Promise<CompanionControlSession> {
    const next = await this.api.acquireControlSession(this.channelId, 'mobile', this.clientInstanceId);
    this.session = next;
    return next;
  }

  async renew(): Promise<CompanionControlSession> {
    const previous = this.session;
    const next = await this.api.acquireControlSession(this.channelId, 'mobile', this.clientInstanceId);
    if (previous && next.sessionId !== previous.sessionId) {
      this.session = null;
      throw new Error('control_session_replaced');
    }
    this.session = next;
    return next;
  }

  async revoke(): Promise<void> {
    const current = this.session;
    this.session = null;
    if (current) await this.api.revokeControlSession(this.channelId, current.sessionId);
  }

  getCurrent(): CompanionControlSession | null {
    return this.session;
  }

  isActive(now = Date.now()): boolean {
    return this.session !== null && Date.parse(this.session.leaseUntil) > now;
  }
}
