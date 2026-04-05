import { beforeEach, describe, expect, it } from "bun:test";
import { AuthHandler } from "../../src/ws/auth/AuthHandler";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { SessionStore } from "../../src/ws/auth/SessionStore";
import { getDb, truncateAllTables } from "./helpers/db";

const sql = getDb();
const authHandler = new AuthHandler(new GameRepository(sql));

beforeEach(truncateAllTables);

describe("handlers -> GameRepository -> Postgres", () => {
  describe("handleLogin", () => {
    it("creates a new user and returns a token on first login", async () => {
      const store = new SessionStore();
      const res = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store,
      );
      const body = (await res.json()) as { login: string; token: string };

      expect(res.status).toBe(200);
      expect(body.login).toBe("alice");
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(0);
    });

    it("automatically creates a player_profile for a new user", async () => {
      const store = new SessionStore();
      await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store,
      );

      const rows = await sql`
        SELECT pp.id
        FROM player_profiles pp
        JOIN users u ON u.id = pp.user_id
        WHERE u.login = 'alice'
      `;
      expect(rows.length).toBe(1);
    });

    it("accepts the correct password for an existing user", async () => {
      const store1 = new SessionStore();
      const first = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store1,
      );
      const { token } = (await first.json()) as { token: string };
      store1.invalidate(token);

      const store2 = new SessionStore();
      const res = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store2,
      );
      expect(res.status).toBe(200);
    });

    it("returns 401 for a wrong password", async () => {
      const store1 = new SessionStore();
      const first = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store1,
      );
      const { token } = (await first.json()) as { token: string };
      store1.invalidate(token);

      const store2 = new SessionStore();
      const res = await authHandler.handleLogin(
        { login: "alice", password: "wrong" },
        store2,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 when login is missing", async () => {
      const store = new SessionStore();
      const res = await authHandler.handleLogin({ password: "secret" }, store);
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is missing", async () => {
      const store = new SessionStore();
      const res = await authHandler.handleLogin({ login: "alice" }, store);
      expect(res.status).toBe(400);
    });

    it("returns 400 when login exceeds 50 characters", async () => {
      const store = new SessionStore();
      const res = await authHandler.handleLogin(
        { login: "a".repeat(51), password: "secret" },
        store,
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 when the same login already has an active session", async () => {
      const store = new SessionStore();
      // First login — succeeds and session remains active
      await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store,
      );

      // Second login on the same store while session is still live
      const res = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store,
      );
      expect(res.status).toBe(409);
    });
  });

  describe("handleLogout", () => {
    it("invalidates the session token", async () => {
      const store = new SessionStore();
      const loginRes = await authHandler.handleLogin(
        { login: "alice", password: "secret" },
        store,
      );
      const { token } = (await loginRes.json()) as { token: string };

      expect(store.getSession(token)).not.toBeNull();

      authHandler.handleLogout({ token }, store);

      expect(store.getSession(token)).toBeNull();
    });

    it("returns 400 when token is missing", () => {
      const store = new SessionStore();
      const res = authHandler.handleLogout({}, store);
      expect(res.status).toBe(400);
    });
  });
});
