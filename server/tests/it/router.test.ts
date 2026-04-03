/**
 * Integration tests for the WebSocket message router.
 *
 * Uses a lightweight MockWs that captures outbound messages so we can assert
 * on what routeMessage() sends back — no real server or network required.
 * The full stack (RoomManager → GameRegistry → GameRepository → Postgres) is
 * exercised for every test that touches game state.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import type { ServerWebSocket } from "bun";
import { routeMessage } from "../../src/server/ws/router";
import type { WsData, WsDeps } from "../../src/server/ws/handler";
import { RoomManager } from "../../src/server/lobby/RoomManager";
import { GameRegistry } from "../../src/game/GameRegistry";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { ConnectionManager } from "../../src/server/ConnectionManager";
import { SessionStore } from "../../src/server/auth/sessions";
import { getDb, truncateAllTables } from "./helpers/db";
import { getValidCards } from "../../src/game/trick";
import { sanitizeStateForPlayer } from "../../src/server/sanitize";

// ---------------------------------------------------------------------------
// Mock WebSocket
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
// Shared env factory
// ---------------------------------------------------------------------------
function makeEnv() {
  const sql = getDb();
  const repo = new GameRepository(sql);
  const registry = new GameRegistry(repo);
  const connManager = new ConnectionManager(registry);
  const sessionStore = new SessionStore();
  const rm = new RoomManager(registry, connManager, sessionStore);
  const deps: WsDeps = {
    roomManager: rm,
    gameRegistry: registry,
    connectionManager: connManager,
    sessionStore,
  };
  return { sql, repo, registry, connManager, rm, deps };
}

/** Send a JSON message through routeMessage and return all new outbound msgs. */
async function send(ws: MockWs, msg: object, deps: WsDeps): Promise<any[]> {
  const before = ws.msgs.length;
  await routeMessage(ws.ws, JSON.stringify(msg), deps);
  return ws.msgs.slice(before);
}

/** last() helper */
function last(msgs: any[]): any {
  return msgs[msgs.length - 1];
}

beforeEach(truncateAllTables);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("routeMessage -> RoomManager -> GameRegistry -> Postgres", () => {
  // -----------------------------------------------------------------------
  // Error paths
  // -----------------------------------------------------------------------
  describe("error handling", () => {
    it("sends error on malformed JSON", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");

      await routeMessage(alice.ws, "not-json{{{", deps);

      expect(last(alice.msgs)?.type).toBe("error");
    });

    it("sends error on unknown message type", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");

      const replies = await send(alice, { type: "unknown_type" }, deps);
      expect(last(replies)?.type).toBe("error");
    });

    it("sends error when play_card is called outside a game", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");

      const replies = await send(alice, { type: "play_card", card: 0 }, deps);
      expect(last(replies)?.type).toBe("error");
      expect(last(replies)?.message).toMatch(/not in a game/i);
    });

    it("sends error when select_leader is called outside a game", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");

      const replies = await send(
        alice,
        { type: "select_leader", playerIndex: 0 },
        deps,
      );
      expect(last(replies)?.type).toBe("error");
      expect(last(replies)?.message).toMatch(/not in a game/i);
    });
  });

  // -----------------------------------------------------------------------
  // Lobby flow
  // -----------------------------------------------------------------------
  describe("lobby flow", () => {
    it("create_game sends game_created and lobby_update to creator", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");

      const replies = await send(alice, { type: "create_game" }, deps);

      const created = replies.find((m) => m.type === "game_created");
      const lobby = replies.find((m) => m.type === "lobby_update");

      expect(created).toBeDefined();
      expect(typeof created.gameId).toBe("number");
      expect(lobby).toBeDefined();
      expect(lobby.creatorId).toBe("alice");
    });

    it("join_game broadcasts lobby_update to all players in room", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await send(bob, { type: "join_game", gameId }, deps);

      // Alice gets lobby update about bob joining
      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      const ids = aliceLobby.players.map((p: any) => p.id);
      expect(ids).toContain("alice");
      expect(ids).toContain("bob");

      // Bob also receives the lobby update
      expect(bob.msgs.some((m: any) => m.type === "lobby_update")).toBe(true);
    });

    it("leave_game removes player and notifies remaining players", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);

      alice.msgs.length = 0;

      await send(bob, { type: "leave_game" }, deps);

      const aliceLobby = alice.msgs.find((m) => m.type === "lobby_update");
      expect(aliceLobby).toBeDefined();
      expect(aliceLobby.players.map((p: any) => p.id)).not.toContain("bob");
    });

    it("leave_game by creator dissolves room and sends game_stopped to all", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await send(alice, { type: "leave_game" }, deps);

      expect(alice.msgs.some((m: any) => m.type === "game_stopped")).toBe(true);
      expect(bob.msgs.some((m: any) => m.type === "game_stopped")).toBe(true);
    });

    it("stop_game broadcasts game_stopped and cleans up", async () => {
      const { deps, registry } = makeEnv();
      const alice = mockWs("alice");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;

      await send(alice, { type: "start_game" }, deps);

      alice.msgs.length = 0;
      await send(alice, { type: "stop_game" }, deps);

      expect(alice.msgs.some((m: any) => m.type === "game_stopped")).toBe(true);
      expect(registry.getGame(gameId)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // start_game
  // -----------------------------------------------------------------------
  describe("start_game", () => {
    it("transitions room to started and sends game_state to all players", async () => {
      const { deps, rm } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);

      alice.msgs.length = 0;
      bob.msgs.length = 0;

      await send(alice, { type: "start_game" }, deps);

      expect(alice.msgs.some((m: any) => m.type === "game_state")).toBe(true);
      expect(bob.msgs.some((m: any) => m.type === "game_state")).toBe(true);
      expect(rm.getRoom(gameId)!.started).toBe(true);
    });

    it("sends error when non-creator tries to start", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");

      const aliceReplies = await send(alice, { type: "create_game" }, deps);
      const gameId = aliceReplies.find(
        (m) => m.type === "game_created",
      )!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);

      const replies = await send(bob, { type: "start_game" }, deps);
      expect(last(replies)?.type).toBe("error");
      expect(last(replies)?.message).toMatch(/only creator/i);
    });
  });

  // -----------------------------------------------------------------------
  // play_card
  // -----------------------------------------------------------------------
  describe("play_card", () => {
    it("rejects an invalid card (not in hand)", async () => {
      const { deps } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      // Find whose turn it is
      const { registry } = deps as any;
      const engine = (deps.gameRegistry as GameRegistry).getGame(gameId)!;
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex]!;

      // Play a card that definitely isn't in their hand
      const playerWs = [alice, bob, carol, dave].find(
        (w) => w.ws.data.playerId === currentPlayer.id,
      )!;
      playerWs.msgs.length = 0;

      const badCard = 9999;
      const replies = await send(
        playerWs,
        { type: "play_card", card: badCard },
        deps,
      );
      expect(last(replies)?.type).toBe("error");
    });

    it("accepts a valid card and broadcasts game_state to all players", async () => {
      const { deps } = makeEnv();
      const players = [
        mockWs("alice"),
        mockWs("bob"),
        mockWs("carol"),
        mockWs("dave"),
      ];
      const [alice, bob, carol, dave] = players;

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      for (const p of players) p.msgs.length = 0;

      const engine = deps.gameRegistry.getGame(gameId)!;
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex]!;
      const validCards = getValidCards(currentPlayer.id, gs);

      const playerWs = players.find(
        (w) => w.ws.data.playerId === currentPlayer.id,
      )!;

      await send(playerWs, { type: "play_card", card: validCards[0]! }, deps);

      // Every human player receives some kind of state update
      for (const p of players) {
        const hasUpdate = p.msgs.some(
          (m) =>
            m.type === "game_state" ||
            m.type === "trick_resolved" ||
            m.type === "round_ended" ||
            m.type === "game_ended",
        );
        expect(hasUpdate).toBe(true);
      }
    });

    it("each player's game_state only contains their own hand cards", async () => {
      const { deps } = makeEnv();
      const players = [
        mockWs("alice"),
        mockWs("bob"),
        mockWs("carol"),
        mockWs("dave"),
      ];
      const [alice, bob, carol, dave] = players;

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      for (const p of players) p.msgs.length = 0;

      const engine = deps.gameRegistry.getGame(gameId)!;
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex]!;
      const validCards = getValidCards(currentPlayer.id, gs);
      const playerWs = players.find(
        (w) => w.ws.data.playerId === currentPlayer.id,
      )!;

      await send(playerWs, { type: "play_card", card: validCards[0]! }, deps);

      // For each human player, inspect the game_state received
      for (const p of players) {
        const stateMsg = p.msgs.find(
          (m) =>
            m.type === "game_state" ||
            m.type === "trick_resolved" ||
            m.type === "round_ended",
        );
        if (!stateMsg || !stateMsg.state) continue;

        const pid = p.ws.data.playerId;
        const ownPlayer = stateMsg.state.players.find(
          (pl: any) => pl.id === pid,
        );
        const otherPlayers = stateMsg.state.players.filter(
          (pl: any) => pl.id !== pid,
        );

        // Own hand is visible (may be 0 if they just played their only card, but handSize matches)
        expect(ownPlayer).toBeDefined();
        // Other players' hand arrays are hidden (empty)
        for (const other of otherPlayers) {
          if (!other.isBot) {
            expect(other.hand.length).toBe(0);
          }
        }
      }
    });

    it("rejects a card play from the wrong player (out of turn)", async () => {
      const { deps } = makeEnv();
      const players = [
        mockWs("alice"),
        mockWs("bob"),
        mockWs("carol"),
        mockWs("dave"),
      ];
      const [alice, bob, carol, dave] = players;

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      const engine = deps.gameRegistry.getGame(gameId)!;
      const gs = engine.getGameState();
      const currentIdx = gs.currentPlayerIndex;

      // Pick a player who is NOT the current player
      const wrongPlayer = players.find(
        (w) => w.ws.data.playerId !== gs.players[currentIdx]!.id,
      )!;
      const wrongGs = engine.getGameState();
      const wrongPlayerState = wrongGs.players.find(
        (p) => p.id === wrongPlayer.ws.data.playerId,
      )!;

      wrongPlayer.msgs.length = 0;
      const replies = await send(
        wrongPlayer,
        { type: "play_card", card: wrongPlayerState.hand[0]! },
        deps,
      );
      expect(last(replies)?.type).toBe("error");
    });
  });

  // -----------------------------------------------------------------------
  // Full lobby → start → play sequence persisted to DB
  // -----------------------------------------------------------------------
  describe("full message sequence", () => {
    it("create → join → start → play one card → DB reflects updated phase", async () => {
      const { deps, sql } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;

      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      const engine = deps.gameRegistry.getGame(gameId)!;
      let gs = engine.getGameState();

      expect(gs.phase).toBe("trick-playing");

      // Play a valid card as the current player
      const currentPlayer = gs.players[gs.currentPlayerIndex]!;
      const allPlayers = [alice, bob, carol, dave];
      const playerWs = allPlayers.find(
        (w) => w.ws.data.playerId === currentPlayer.id,
      )!;
      const validCards = getValidCards(currentPlayer.id, gs);

      await send(playerWs, { type: "play_card", card: validCards[0]! }, deps);

      // DB must have been updated (phase will still be trick-playing or trick-resolution)
      const rows = await sql`SELECT phase FROM games WHERE game_id = ${gameId}`;
      expect(rows.length).toBe(1);
      expect([
        "trick-playing",
        "trick-resolution",
        "round-end",
        "game-end",
      ]).toContain(rows[0]?.phase);

      // Card is no longer in the player's hand in the engine
      gs = engine.getGameState();
      const updatedPlayer = gs.players.find((p) => p.id === currentPlayer.id)!;
      expect(updatedPlayer.hand).not.toContain(validCards[0]);
    });
  });

  // -----------------------------------------------------------------------
  // Reconnect flow
  // -----------------------------------------------------------------------
  describe("reconnect flow", () => {
    it("reconnecting player receives current game_state and others get player_reconnected", async () => {
      const { deps, rm, registry, connManager } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      // Simulate disconnect then reconnect with a new WS
      const alice2 = mockWs("alice");
      rm.updatePlayerSocket("alice", alice2.ws);
      connManager.playerConnected(gameId, "alice");

      // Replicate what createWsHandlers.open does on reconnect
      const engine = registry.getGame(gameId)!;
      const state = engine.getGameState();
      alice2.ws.send(
        JSON.stringify({
          type: "game_state",
          state: sanitizeStateForPlayer(state, "alice"),
        }),
      );
      rm.broadcast(rm.getRoom(gameId)!, {
        type: "player_reconnected",
        playerId: "alice",
      });

      // alice2's new socket receives the current game state
      expect(alice2.msgs.some((m: any) => m.type === "game_state")).toBe(true);
      const stateMsg = alice2.msgs.find((m: any) => m.type === "game_state")!;
      // Hand is populated (own cards visible)
      const alicePlayer = stateMsg.state.players.find(
        (p: any) => p.id === "alice",
      );
      expect(alicePlayer.hand.length).toBeGreaterThan(0);

      // All other players receive player_reconnected
      for (const p of [bob, carol, dave]) {
        expect(
          p.msgs.some(
            (m: any) =>
              m.type === "player_reconnected" && m.playerId === "alice",
          ),
        ).toBe(true);
      }
    });

    it("reconnecting player can continue playing cards on their new socket", async () => {
      const { deps, rm, registry } = makeEnv();
      const alice = mockWs("alice");
      const bob = mockWs("bob");
      const carol = mockWs("carol");
      const dave = mockWs("dave");

      const r = await send(alice, { type: "create_game" }, deps);
      const gameId = r.find((m: any) => m.type === "game_created")!.gameId;
      await send(bob, { type: "join_game", gameId }, deps);
      await send(carol, { type: "join_game", gameId }, deps);
      await send(dave, { type: "join_game", gameId }, deps);
      await send(alice, { type: "start_game" }, deps);

      // Reconnect alice with a new socket
      const alice2 = mockWs("alice");
      rm.updatePlayerSocket("alice", alice2.ws);

      // Find valid move for current player; if it's alice, play via new socket
      const engine = registry.getGame(gameId)!;
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex]!;

      // Pick the right socket for the current player
      const allSockets = new Map([
        ["alice", alice2],
        ["bob", bob],
        ["carol", carol],
        ["dave", dave],
      ]);
      const playerWs = allSockets.get(currentPlayer.id)!;
      const validCards = getValidCards(currentPlayer.id, gs);

      const replies = await send(
        playerWs,
        { type: "play_card", card: validCards[0]! },
        deps,
      );

      // Should not get an error — the game state was updated
      expect(replies.some((m: any) => m.type === "error")).toBe(false);
    });
  });
});
