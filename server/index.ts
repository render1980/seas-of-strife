import { initDatabase } from "./src/db/connection";
import { GameRepository } from "./src/db/repositories/GameRepository";
import { GameRegistry } from "./src/game/GameRegistry";
import { ConnectionManager } from "./src/server/ConnectionManager";
import { AuthHandler } from "./src/server/auth/handlers";
import { SessionStore } from "./src/server/auth/sessions";
import { RoomManager } from "./src/server/lobby/RoomManager";
import { scheduleBotTurns } from "./src/server/lobby/botScheduler";
import { createWsHandlers, type WsData } from "./src/server/ws/handler";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const sql = initDatabase();

const sessionStore = new SessionStore();
const gameRepository = new GameRepository(sql);
const authHandler = new AuthHandler(gameRepository);
const gameRegistry = new GameRegistry(gameRepository);
const connectionManager = new ConnectionManager(gameRegistry);
const roomManager = new RoomManager(
  gameRegistry,
  connectionManager,
  sessionStore,
);

// Wire auto-play broadcast: after 30s timeout fires, broadcast updated state
connectionManager.setOnAutoPlay(async (gameId, playerId) => {
  const engine = gameRegistry.getGame(gameId);
  const room = roomManager.getRoom(gameId);
  if (!engine || !room) return;

  const state = engine.getGameState();
  roomManager.broadcastGameState(room, state);
  scheduleBotTurns(gameId, engine, room, roomManager, connectionManager);
});

const wsDeps = { roomManager, gameRegistry, connectionManager, sessionStore };
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
