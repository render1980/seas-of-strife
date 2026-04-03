import { beforeEach, describe, expect, it } from "bun:test";
import type { ServerWebSocket } from "bun";
import { RoomManager } from "../../src/ws/lobby/RoomManager";
import { GameRegistry } from "../../src/game/GameRegistry";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { ConnectionManager } from "../../src/ws/ConnectionManager";
import { SessionStore } from "../../src/ws/auth/sessions";
import type { WsData } from "../../src/ws/ws/handler";
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
  const rm = new RoomManager(registry, connManager, sessionStore);
  return { sql, repo, registry, connManager, rm };
}

beforeEach(truncateAllTables);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("RoomManager -> GameRegistry -> Postgres", () => {
  // -----------------------------------------------------------------------
  // createRoom
  // -----------------------------------------------------------------------
  describe("createRoom", () => {
    it("returns a gameId and tracks the creator", () => {
      const { rm } = makeEnv();
      const { ws } = mockWs("alice");

      const gameId = rm.createRoom("alice", "Alice", ws);

      expect(typeof gameId).toBe("number");
      expect(gameId).toBeGreaterThan(0);
      expect(rm.getPlayerGameId("alice")).toBe(gameId);
      expect(rm.getRoom(gameId)).toBeDefined();
    });

    it("throws when player is already in a room", () => {
      const { rm } = makeEnv();
      const { ws: ws1 } = mockWs("alice");
      const { ws: ws2 } = mockWs("alice");

      rm.createRoom("alice", "Alice", ws1);
      expect(() => rm.createRoom("alice", "Alice", ws2)).toThrow(
        "Already in a game",
      );
    });
  });

  // -----------------------------------------------------------------------
  // joinRoom
  // -----------------------------------------------------------------------
  describe("joinRoom", () => {
    it("adds player to room and broadcasts lobby_update to everyone", () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);

      // Both alice and bob should have received a lobby_update
      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      const bobLobby = bob.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      expect(bobLobby).toBeDefined();

      const playerIds = aliceLobby.players.map((p: any) => p.id);
      expect(playerIds).toContain("alice");
      expect(playerIds).toContain("bob");
    });

    it("throws when joining a non-existent room", () => {
      const { rm } = makeEnv();
      const { ws } = mockWs("bob");
      expect(() => rm.joinRoom(9999, "bob", "Bob", ws)).toThrow(
        "Game not found",
      );
    });

    it("throws when player is already in a room", () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const alice2 = mockWs("alice");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      expect(() => rm.joinRoom(gameId, "alice", "Alice", alice2.ws)).toThrow(
        "Already in a game",
      );
    });
  });

  // -----------------------------------------------------------------------
  // leaveRoom
  // -----------------------------------------------------------------------
  describe("leaveRoom", () => {
    it("non-creator leave broadcasts updated lobby to remaining players", () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);
      rm.joinRoom(gameId, "carol", "Carol", carol.ws);

      // Clear accumulated messages so we can inspect just the leave effect
      alice.msgs.length = 0;
      bob.msgs.length = 0;
      carol.msgs.length = 0;

      rm.leaveRoom("bob");

      expect(rm.getRoom(gameId)).toBeDefined();
      expect(rm.getPlayerGameId("bob")).toBeUndefined();

      // Remaining players get a lobby_update without bob
      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      const remainingIds = aliceLobby.players.map((p: any) => p.id);
      expect(remainingIds).not.toContain("bob");
    });

    it("creator leave dissolves room and broadcasts game_stopped to others", () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);

      bob.msgs.length = 0;

      rm.leaveRoom("alice");

      expect(rm.getRoom(gameId)).toBeUndefined();
      expect(rm.getPlayerGameId("alice")).toBeUndefined();
      expect(bob.msgs.some((m) => m.type === "game_stopped")).toBe(true);
    });

    it("is a no-op when called for a player not in any room", () => {
      const { rm } = makeEnv();
      expect(() => rm.leaveRoom("nobody")).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // startGame
  // -----------------------------------------------------------------------
  describe("startGame", () => {
    it("fills bots to reach 4 players when only the creator is present", async () => {
      const { rm, registry, sql } = makeEnv();
      const alice = mockWs("alice");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      await rm.startGame("alice");

      // Room is marked started
      expect(rm.getRoom(gameId)!.started).toBe(true);

      // Engine is live in registry
      const engine = registry.getGame(gameId);
      expect(engine).not.toBeNull();

      const state = engine!.getGameState();
      expect(state.players.length).toBe(4);
      expect(state.players.filter((p) => p.isBot).length).toBe(3);
      expect(state.phase).toBe("trick-playing");

      // DB row reflects started state
      const rows = await sql`SELECT phase FROM games WHERE game_id = ${gameId}`;
      expect(rows[0]?.phase).toBe("trick-playing");
    });

    it("uses all human players when 4 are present — no bots added", async () => {
      const { rm, registry } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);
      rm.joinRoom(gameId, "carol", "Carol", carol.ws);
      rm.joinRoom(gameId, "dave", "Dave", dave.ws);

      await rm.startGame("alice");

      const state = registry.getGame(gameId)!.getGameState();
      expect(state.players.every((p) => !p.isBot)).toBe(true);
    });

    it("sends game_state to each human player after start", async () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await rm.startGame("alice");

      expect(alice.msgs.some((m) => m.type === "game_state")).toBe(true);
      expect(bob.msgs.some((m) => m.type === "game_state")).toBe(true);
    });

    it("hands are sanitized — each player sees only their own cards", async () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await rm.startGame("alice");

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
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);

      await expect(rm.startGame("bob")).rejects.toThrow(
        "Only creator can start",
      );
    });

    it("throws when game is already started", async () => {
      const { rm } = makeEnv();
      const { ws } = mockWs("alice");

      rm.createRoom("alice", "Alice", ws);
      await rm.startGame("alice");
      await expect(rm.startGame("alice")).rejects.toThrow(
        "Game already started",
      );
    });

    it("throws when player is not in any room", async () => {
      const { rm } = makeEnv();
      await expect(rm.startGame("ghost")).rejects.toThrow("Not in a game");
    });

    it("rejects joinRoom after game is started", async () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const late = mockWs("late");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      await rm.startGame("alice");

      expect(() => rm.joinRoom(gameId, "late", "Late", late.ws)).toThrow(
        "Game already started",
      );
    });
  });

  // -----------------------------------------------------------------------
  // stopGame
  // -----------------------------------------------------------------------
  describe("stopGame", () => {
    it("broadcasts game_stopped and removes game from registry and room map", async () => {
      const { rm, registry } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);
      await rm.startGame("alice");

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      rm.stopGame("alice");

      expect(alice.msgs.some((m) => m.type === "game_stopped")).toBe(true);
      expect(bob.msgs.some((m) => m.type === "game_stopped")).toBe(true);
      expect(rm.getRoom(gameId)).toBeUndefined();
      expect(registry.getGame(gameId)).toBeNull();
    });

    it("throws when non-creator tries to stop", async () => {
      const { rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const gameId = rm.createRoom("alice", "Alice", alice.ws);
      rm.joinRoom(gameId, "bob", "Bob", bob.ws);
      await rm.startGame("alice");

      expect(() => rm.stopGame("bob")).toThrow("Only creator can stop");
    });

    it("throws when player is not in any room", () => {
      const { rm } = makeEnv();
      expect(() => rm.stopGame("ghost")).toThrow("Not in a game");
    });
  });
});
