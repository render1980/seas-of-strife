import { beforeEach, describe, expect, it } from "bun:test";
import type { ServerWebSocket } from "bun";
import { GameManager } from "../../src/handlers/lobby/GameManager";
import { GameRegistry } from "../../src/game/GameRegistry";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { ConnectionManager } from "../../src/handlers/ConnectionManager";
import { SessionStore } from "../../src/handlers/auth/SessionStore";
import type { WsData } from "../../src/handlers/ws/handler";
import { getDb, truncateAllTables } from "./helpers/db";

// ---------------------------------------------------------------------------
// Mock WebSocket — captures sent messages without any real network I/O
// ---------------------------------------------------------------------------
interface MockWs {
  ws: ServerWebSocket<WsData>;
  msgs: any[];
}

function mockWs(playerId: string): MockWs {
  const msgs: any[] = [];
  const ws = {
    data: { token: `tok-${playerId}`, playerId, login: playerId },
    send(raw: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer) {
      msgs.push(JSON.parse(typeof raw === "string" ? raw : "{}"));
    },
    readyState: 1,
  } as unknown as ServerWebSocket<WsData>;
  return { ws, msgs };
}

// ---------------------------------------------------------------------------
// Shared factory — fresh instances per test
// ---------------------------------------------------------------------------
function makeEnv() {
  const sql = getDb();
  const repo = new GameRepository(sql);
  const registry = new GameRegistry(repo);
  const connManager = new ConnectionManager(registry);
  const sessionStore = new SessionStore();
  const gm = new GameManager(registry, connManager, sessionStore);
  return { sql, repo, registry, connManager, gm };
}

beforeEach(truncateAllTables);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GameManager -> GameRegistry -> Postgres", () => {
  // -----------------------------------------------------------------------
  // createGame
  // -----------------------------------------------------------------------
  describe("createGame", () => {
    it("returns a gameId and tracks the creator", () => {
      const { gm } = makeEnv();
      const { ws } = mockWs("alice");

      const game = gm.createGame("alice", "Alice", ws);

      expect(typeof game.gameId).toBe("number");
      expect(game.gameId).toBeGreaterThan(0);
      expect(gm.getPlayerGameId("alice")).toBe(game.gameId);
      expect(gm.getGame(game.gameId)).toBeDefined();
    });

    it("throws when player is already in a game", () => {
      const { gm } = makeEnv();
      const { ws: ws1 } = mockWs("alice");
      const { ws: ws2 } = mockWs("alice");

      gm.createGame("alice", "Alice", ws1);
      expect(() => gm.createGame("alice", "Alice", ws2)).toThrow(
        "Already in a game",
      );
    });
  });

  // -----------------------------------------------------------------------
  // joinGame
  // -----------------------------------------------------------------------
  describe("joinGame", () => {
    it("adds player to game and broadcasts lobby_update to everyone", () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);

      // Both alice and bob should have received a lobby_update
      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      const bobLobby = bob.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      expect(bobLobby).toBeDefined();

      const playerIds = aliceLobby.players.map((p: any) => p.id);
      expect(playerIds).toContain("alice");
      expect(playerIds).toContain("bob");
    });

    it("throws when joining a non-existent game", () => {
      const { gm } = makeEnv();
      const { ws } = mockWs("bob");
      expect(() => gm.joinGame(9999, "bob", "Bob", ws)).toThrow(
        "Game not found",
      );
    });

    it("throws when player is already in a game", () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const alice2 = mockWs("alice");

      const game = gm.createGame("alice", "Alice", alice.ws);
      expect(() =>
        gm.joinGame(game.gameId, "alice", "Alice", alice2.ws),
      ).toThrow("Already in a game");
    });
  });

  // -----------------------------------------------------------------------
  // leaveGame
  // -----------------------------------------------------------------------
  describe("leaveGame", () => {
    it("non-creator leave broadcasts updated lobby to remaining players", () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);
      gm.joinGame(game.gameId, "carol", "Carol", carol.ws);

      // Clear accumulated messages so we can inspect just the leave effect
      alice.msgs.length = 0;
      bob.msgs.length = 0;
      carol.msgs.length = 0;

      gm.leaveGame("bob");

      expect(gm.getGame(game.gameId)).toBeDefined();
      expect(gm.getPlayerGameId("bob")).toBeUndefined();

      // Remaining players get a lobby_update without bob
      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      const remainingIds = aliceLobby.players.map((p: any) => p.id);
      expect(remainingIds).not.toContain("bob");
    });

    it("creator leave dissolves game and broadcasts game_stopped to others", () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);

      bob.msgs.length = 0;

      gm.leaveGame("alice");

      expect(gm.getGame(game.gameId)).toBeUndefined();
      expect(gm.getPlayerGameId("alice")).toBeUndefined();
      expect(bob.msgs.some((m) => m.type === "game_stopped")).toBe(true);
    });

    it("is a no-op when called for a player not in any game", () => {
      const { gm } = makeEnv();
      expect(() => gm.leaveGame("nobody")).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // startGame
  // -----------------------------------------------------------------------
  describe("startGame", () => {
    it("fills bots to reach 4 players when only the creator is present", async () => {
      const { gm, registry, sql } = makeEnv();
      const alice = mockWs("alice");

      const game = gm.createGame("alice", "Alice", alice.ws);
      await gm.startGame("alice");

      // Game is marked started
      expect(gm.getGame(game.gameId)!.started).toBe(true);

      // Engine is live in registry
      const engine = registry.getGame(game.gameId);
      expect(engine).not.toBeNull();

      const state = engine!.getGameState();
      expect(state.players.length).toBe(4);
      expect(state.players.filter((p) => p.isBot).length).toBe(3);
      expect(state.phase).toBe("trick-playing");

      // DB row reflects started state
      const rows =
        await sql`SELECT phase FROM games WHERE game_id = ${game.gameId}`;
      expect(rows[0]?.phase).toBe("trick-playing");
    });

    it("uses all human players when 4 are present — no bots added", async () => {
      const { gm, registry } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);
      gm.joinGame(game.gameId, "carol", "Carol", carol.ws);
      gm.joinGame(game.gameId, "dave", "Dave", dave.ws);

      await gm.startGame("alice");

      const state = registry.getGame(game.gameId)!.getGameState();
      expect(state.players.every((p) => !p.isBot)).toBe(true);
    });

    it("sends game_state to each human player after start", async () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await gm.startGame("alice");

      expect(alice.msgs.some((m) => m.type === "game_state")).toBe(true);
      expect(bob.msgs.some((m) => m.type === "game_state")).toBe(true);
    });

    it("hands are sanitized — each player sees only their own cards", async () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await gm.startGame("alice");

      const aliceState = alice.msgs.find((m) => m.type === "game_state")!.state;
      const bobState = bob.msgs.find((m) => m.type === "game_state")!.state;

      // Own hand is visible; the opponents' hand arrays are empty
      const aliceOwnPlayer = aliceState.players.find(
        (p: any) => p.id === "alice",
      );
      const aliceSeeBob = aliceState.players.find((p: any) => p.id === "bob");
      expect(aliceOwnPlayer.hand.length).toBeGreaterThan(0);
      expect(aliceSeeBob.hand.length).toBe(0);

      const bobOwnPlayer = bobState.players.find((p: any) => p.id === "bob");
      const bobSeeAlice = bobState.players.find((p: any) => p.id === "alice");
      expect(bobOwnPlayer.hand.length).toBeGreaterThan(0);
      expect(bobSeeAlice.hand.length).toBe(0);
    });

    it("throws when called by a non-creator", async () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);

      await expect(gm.startGame("bob")).rejects.toThrow(
        "Only creator can start",
      );
    });

    it("throws when game is already started", async () => {
      const { gm } = makeEnv();
      const { ws } = mockWs("alice");

      gm.createGame("alice", "Alice", ws);
      await gm.startGame("alice");
      await expect(gm.startGame("alice")).rejects.toThrow(
        "Game already started",
      );
    });

    it("throws when player is not in any game", async () => {
      const { gm } = makeEnv();
      await expect(gm.startGame("ghost")).rejects.toThrow("Not in a game");
    });

    it("rejects joinGame after game is started", async () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const late = mockWs("late");

      const game = gm.createGame("alice", "Alice", alice.ws);
      await gm.startGame("alice");

      expect(() => gm.joinGame(game.gameId, "late", "Late", late.ws)).toThrow(
        "Game already started",
      );
    });
  });

  // -----------------------------------------------------------------------
  // stopGame
  // -----------------------------------------------------------------------
  describe("stopGame", () => {
    it("broadcasts game_stopped and removes game from registry and game map", async () => {
      const { gm, registry } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);
      await gm.startGame("alice");

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      gm.stopGame("alice");

      expect(alice.msgs.some((m) => m.type === "game_stopped")).toBe(true);
      expect(bob.msgs.some((m) => m.type === "game_stopped")).toBe(true);
      expect(gm.getGame(game.gameId)).toBeUndefined();
      expect(registry.getGame(game.gameId)).toBeNull();
    });

    it("throws when non-creator tries to stop", async () => {
      const { gm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const game = gm.createGame("alice", "Alice", alice.ws);
      gm.joinGame(game.gameId, "bob", "Bob", bob.ws);
      await gm.startGame("alice");

      expect(() => gm.stopGame("bob")).toThrow("Only creator can stop");
    });

    it("throws when player is not in any game", () => {
      const { gm } = makeEnv();
      expect(() => gm.stopGame("ghost")).toThrow("Not in a game");
    });
  });
});
