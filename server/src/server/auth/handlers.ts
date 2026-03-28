import { getDb } from "../../db/connection";
import type { SessionStore } from "./sessions";

/**
 * Handle POST /api/login.
 * Creates user if not found, validates password if exists.
 * Returns { token, login } on success.
 */
export async function handleLogin(
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

  const sql = getDb();

  // Check if user exists
  const existing = await sql<
    [{ id: number; password_hash: string; password_salt: string }]
  >`
    SELECT id, password_hash, password_salt FROM users WHERE login = ${login}
  `;

  if (existing.length > 0) {
    const user = existing[0]!;
    // Validate password
    const hash = await hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    try {
      const token = sessionStore.createSession(user.id, login);
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
  const hash = await hashPassword(password, salt);

  const result = await sql<[{ id: number }]>`
    INSERT INTO users (login, password_hash, password_salt)
    VALUES (${login}, ${hash}, ${salt})
    RETURNING id
  `;
  const userId = result[0]!.id;

  // Create player profile
  await sql`
    INSERT INTO player_profiles (user_id) VALUES (${userId})
  `;

  const token = sessionStore.createSession(userId, login);
  return Response.json({ token, login });
}

/**
 * Handle POST /api/logout.
 */
export function handleLogout(
  body: { token?: string },
  sessionStore: SessionStore,
): Response {
  const { token } = body;
  if (!token) {
    return Response.json({ error: "token is required" }, { status: 400 });
  }
  sessionStore.invalidate(token);
  return Response.json({ ok: true });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hashBuffer).toString("hex");
}
