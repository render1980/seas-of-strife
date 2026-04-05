import type { GameRepository } from "../../db/repositories/GameRepository";
import type { SessionStore } from "./SessionStore";

export class AuthHandler {
  private gameRepository: GameRepository;

  constructor(gameRepository: GameRepository) {
    this.gameRepository = gameRepository;
  }

  /**
   * Handle POST /api/login.
   * Creates user if not found, validates password if exists.
   * Returns { token, login } on success.
   */
  async handleLogin(
    body: { login?: string; password?: string },
    sessionStore: SessionStore,
  ): Promise<Response> {
    const { login, password } = body;

    if (!login || !password) {
      return Response.json(
        { error: "login and password are required" },
        { status: 400 },
      );
    }

    if (login.length > 50 || password.length > 200) {
      return Response.json(
        { error: "login or password too long" },
        { status: 400 },
      );
    }

    const existing = await this.gameRepository.findUserByLogin(login);

    if (existing) {
      // Validate password
      const hash = await this.hashPassword(password, existing.password_salt);
      if (hash !== existing.password_hash) {
        return Response.json({ error: "Invalid password" }, { status: 401 });
      }

      try {
        const token = sessionStore.createSession(existing.id, login);
        return Response.json({ token, login });
      } catch {
        return Response.json(
          { error: "This login is already in use in another session" },
          { status: 409 },
        );
      }
    }

    // Create new user
    const salt = crypto.randomUUID();
    const hash = await this.hashPassword(password, salt);
    const userId = await this.gameRepository.createUser(login, hash, salt);
    await this.gameRepository.createPlayerProfile(userId);

    const token = sessionStore.createSession(userId, login);
    return Response.json({ token, login });
  }

  /**
   * Handle POST /api/logout.
   */
  handleLogout(body: { token?: string }, sessionStore: SessionStore): Response {
    const { token } = body;
    if (!token) {
      return Response.json({ error: "token is required" }, { status: 400 });
    }
    sessionStore.invalidate(token);
    return Response.json({ ok: true });
  }

  async hashPassword(password: string, salt: string): Promise<string> {
    const data = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Buffer.from(hashBuffer).toString("hex");
  }
}
