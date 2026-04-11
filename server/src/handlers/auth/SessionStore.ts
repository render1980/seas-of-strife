interface Session {
  token: string;
  userId: number;
  login: string;
  gameId?: number;
}

/**
 * In-memory session store.
 * Enforces: a login can only have one active session at a time.
 */
export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  /** Reverse index: login → token for fast duplicate-login checks */
  private loginToToken: Map<string, string> = new Map();

  createSession(userId: number, login: string): string {
    // Reject if login already has an active session
    if (this.loginToToken.has(login)) {
      throw new Error("This login is already in use in another session");
    }

    const token = crypto.randomUUID();
    this.sessions.set(token, { token, userId, login });
    this.loginToToken.set(login, token);
    return token;
  }

  getSession(token: string): Session | null {
    return this.sessions.get(token) ?? null;
  }

  setGameId(token: string, gameId: number | undefined): void {
    const session = this.sessions.get(token);
    if (session) {
      session.gameId = gameId;
    }
  }

  invalidate(token: string): void {
    const session = this.sessions.get(token);
    if (session) {
      this.loginToToken.delete(session.login);
      this.sessions.delete(token);
    }
  }

  updateLogin(token: string, newLogin: string): void {
    const session = this.sessions.get(token);
    if (!session) return;
    this.loginToToken.delete(session.login);
    session.login = newLogin;
    this.loginToToken.set(newLogin, token);
  }
}

export type { Session };
