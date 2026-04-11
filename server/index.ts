import { initDatabase } from "./src/db/connection";
import { GameRepository } from "./src/db/repositories/GameRepository";
import { GameRegistry } from "./src/game/GameRegistry";
import { ConnectionManager } from "./src/handlers/ConnectionManager";
import { AuthHandler } from "./src/handlers/auth/AuthHandler";
import { SessionStore } from "./src/handlers/auth/SessionStore";
import { GameManager } from "./src/handlers/lobby/GameManager";
import { scheduleBotTurns } from "./src/handlers/lobby/botScheduler";
import { createWsHandlers, type WsData } from "./src/handlers/ws/handler";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const sql = initDatabase();

const sessionStore = new SessionStore();
const gameRepository = new GameRepository(sql);
const authHandler = new AuthHandler(gameRepository);
const gameRegistry = new GameRegistry(gameRepository);
const connectionManager = new ConnectionManager(gameRegistry);
const gameManager = new GameManager(
  gameRegistry,
  connectionManager,
  sessionStore,
);
gameManager.seedNextGameId(await gameRepository.getMaxGameId());

// Wire auto-play broadcast: after 30s timeout fires, broadcast updated state
connectionManager.setOnAutoPlay(async (gameId, playerId) => {
  const engine = gameRegistry.getGame(gameId);
  const game = gameManager.getGame(gameId);
  if (!engine || !game) return;

  const state = engine.getGameState();
  gameManager.broadcastGameState(game, state);
  scheduleBotTurns(gameId, engine, game, gameManager, connectionManager);
});

const wsDeps = { gameManager, gameRegistry, connectionManager, sessionStore };
const wsHandlers = createWsHandlers(wsDeps);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const port = parseInt(process.env.PORT || "3000");

const server = Bun.serve<WsData>({
  port,

  async fetch(req, server) {
    const url = new URL(req.url);

    // --- HTTP routes ---

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = (await req.json()) as { login?: string; password?: string };
      return authHandler.handleLogin(body, sessionStore);
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const body = (await req.json()) as { token?: string };
      return authHandler.handleLogout(body, sessionStore);
    }

    // --- Profile routes ---

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const token = url.searchParams.get("token");
      if (!token) return Response.json({ error: "Missing token" }, { status: 401 });
      const session = sessionStore.getSession(token);
      if (!session) return Response.json({ error: "Invalid token" }, { status: 401 });

      const profile = await gameRepository.getPlayerProfile(session.userId);
      return Response.json({
        login: session.login,
        goldMedals: profile?.goldMedals ?? 0,
        silverMedals: profile?.silverMedals ?? 0,
        bronzeMedals: profile?.bronzeMedals ?? 0,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/profile/results") {
      const token = url.searchParams.get("token");
      if (!token) return Response.json({ error: "Missing token" }, { status: 401 });
      const session = sessionStore.getSession(token);
      if (!session) return Response.json({ error: "Invalid token" }, { status: 401 });

      const games = await gameRepository.getGameResultsWithParticipants(session.userId);
      return Response.json({ games });
    }

    if (req.method === "PUT" && url.pathname === "/api/profile") {
      const body = (await req.json()) as { token?: string; login?: string };
      if (!body.token) return Response.json({ error: "Missing token" }, { status: 401 });
      const session = sessionStore.getSession(body.token);
      if (!session) return Response.json({ error: "Invalid token" }, { status: 401 });

      const newLogin = body.login?.trim();
      if (!newLogin || newLogin.length > 50) {
        return Response.json({ error: "Login must be 1-50 characters" }, { status: 400 });
      }

      try {
        await gameRepository.updateUserLogin(session.userId, newLogin);
        sessionStore.updateLogin(body.token, newLogin);
        return Response.json({ ok: true, login: newLogin });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Update failed";
        return Response.json({ error: message }, { status: 409 });
      }
    }

    // --- WebSocket upgrade ---

    if (url.pathname === "/ws") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing token", { status: 401 });
      }

      const session = sessionStore.getSession(token);
      if (!session) {
        return new Response("Invalid or expired token", { status: 401 });
      }

      const upgraded = server.upgrade(req, {
        data: {
          token,
          playerId: session.login,
          login: session.login,
        },
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      return undefined as unknown as Response;
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: wsHandlers,
});

console.log(`Server listening on http://localhost:${server.port}`);
