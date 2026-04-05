// /**
//  * Integration tests for botScheduler.
//  *
//  * Bot delays are overridden to ~0 ms via BOT_DELAY_MIN/BOT_DELAY_MAX env vars
//  * so that a full game completes in milliseconds rather than the ~3-5 minutes
//  * the default 1-2 s delays would require (75 tricks × 3 bots × ~1.5 s).
//  *
//  * Human turns are co-driven inside the test via engine.autoPlayCard().
//  */
// import { afterEach, beforeEach, describe, expect, it } from "bun:test";
// import type { ServerWebSocket } from "bun";
// import { GameManager } from "../../src/server/lobby/GameManager";
// import { GameRegistry } from "../../src/game/GameRegistry";
// import { GameRepository } from "../../src/db/repositories/GameRepository";
// import { ConnectionManager } from "../../src/server/ConnectionManager";
// import { SessionStore } from "../../src/server/auth/sessions";
// import { scheduleBotTurns } from "../../src/server/lobby/botScheduler";
// import type { WsData } from "../../src/server/ws/handler";
// import { getDb, truncateAllTables } from "./helpers/db";

// function mockWs(playerId: string) {
//   const msgs: any[] = [];
//   const ws = {
//     data: { token: `tok-${playerId}`, playerId, login: playerId },
//     send(raw: string) {
//       msgs.push(JSON.parse(raw));
//     },
//     readyState: 1,
//   } as unknown as ServerWebSocket<WsData>;
//   return { ws, msgs };
// }

// function makeEnv() {
//   const sql = getDb();
//   const repo = new GameRepository(sql);
//   const registry = new GameRegistry(repo);
//   const connManager = new ConnectionManager(registry);
//   const sessionStore = new SessionStore();
//   const gm = new GameManager(registry, connManager, sessionStore);
//   return { sql, repo, registry, connManager, gm };
// }

// /**
//  * Drive a mixed human/bot game to completion.
//  * Handles human turns via autoPlayCard; bots are driven by scheduleBotTurns.
//  * Requires BOT_DELAY_MIN=0 so bot turns resolve in < 1ms during tests.
//  */
// async function codriveToGameEnd(
//   gameId: number,
//   engine: import("../../src/game/engine").GameEngine,
//   gm: GameManager,
//   connManager: ConnectionManager,
//   timeoutMs = 8_000,
// ): Promise<boolean> {
//   const stopAt = Date.now() + timeoutMs;

//   // Initial kick — if the first player is a bot this starts the chain
//   const kickGame = gm.getGame(gameId);
//   if (kickGame) scheduleBotTurns(gameId, engine, kickGame, gm, connManager);

//   while (engine.getPhase() !== "game-end" && Date.now() < stopAt) {
//     const state = engine.getGameState();
//     const current = state.players[state.currentPlayerIndex];
//     // When it's a human's turn, auto-play and re-kick the scheduler
//     if (current && !current.isBot) {
//       if (state.awaitingLeaderSelection) {
//         await engine.selectNextLeader(current.id, 0);
//       } else if (state.phase === "trick-playing") {
//         await engine.autoPlayCard(current.id);
//       }
//       const game = gm.getGame(gameId);
//       if (game) scheduleBotTurns(gameId, engine, game, gm, connManager);
//     }
//     // Yield so queued 0ms setTimeout callbacks (bot plays) can fire
//     await new Promise((r) => setTimeout(r, 10));
//   }

//   return engine.getPhase() === "game-end";
// }

// beforeEach(truncateAllTables);
// beforeEach(() => {
//   // Use near-zero delays so bot turns resolve in < 1 ms during tests
//   process.env.BOT_DELAY_MIN = "0";
//   process.env.BOT_DELAY_MAX = "1";
// });
// afterEach(() => {
//   delete process.env.BOT_DELAY_MIN;
//   delete process.env.BOT_DELAY_MAX;
// });

// describe("scheduleBotTurns -> GameEngine -> Postgres", () => {
//   it(
//     "bots + co-driven human plays drive a 1-human + 3-bot game to game-end",
//     async () => {
//       const { gm, registry, connManager } = makeEnv();
//       const alice = mockWs("alice");

//       const gameId = gm.createGame("alice", "Alice", alice.ws);
//       await gm.startGame("alice");

//       const engine = registry.getGame(gameId)!;

//       const finished = await codriveToGameEnd(gameId, engine, gm, connManager);

//       expect(finished).toBe(true);
//       expect(engine.getPhase()).toBe("game-end");
//     },
//     12_000,
//   );

//   it(
//     "bots broadcast state updates to connected players during the game",
//     async () => {
//       const { gm, registry, connManager } = makeEnv();
//       const alice = mockWs("alice");

//       const gameId = gm.createGame("alice", "Alice", alice.ws);
//       await gm.startGame("alice");

//       alice.msgs.length = 0; // clear start-game messages

//       const engine = registry.getGame(gameId)!;

//       await codriveToGameEnd(gameId, engine, gm, connManager);

//       // Alice should have received state updates throughout
//       const stateTypes = [
//         "game_state",
//         "trick_resolved",
//         "round_ended",
//         "game_ended",
//       ];
//       const receivedUpdates = alice.msgs.some((m: any) =>
//         stateTypes.includes(m.type),
//       );
//       expect(receivedUpdates).toBe(true);
//     },
//     12_000,
//   );

//   it("does nothing when the current player is human (all-human lobby)", async () => {
//     const { gm, registry, connManager } = makeEnv();
//     const players = ["alice", "bob", "carol", "dave"].map(mockWs);
//     const [alice, bob, carol, dave] = players;

//     const gameId = gm.createGame("alice", "Alice", alice.ws);
//     gm.joinGame(gameId, "bob", "Bob", bob.ws);
//     gm.joinGame(gameId, "carol", "Carol", carol.ws);
//     gm.joinGame(gameId, "dave", "Dave", dave.ws);
//     await gm.startGame("alice");

//     const engine = registry.getGame(gameId)!;
//     const game = gm.getGame(gameId)!;
//     const phaseBefore = engine.getPhase();

//     // scheduleBotTurns should be a no-op — all players are human
//     scheduleBotTurns(gameId, engine, game, gm, connManager);

//     // Give any accidental setTimeout a chance to fire
//     await new Promise((r) => setTimeout(r, 150));

//     expect(engine.getPhase()).toBe(phaseBefore);
//   });

//   it(
//     "game_ended message is broadcast to connected players when game finishes",
//     async () => {
//       const { gm, registry, connManager } = makeEnv();
//       const alice = mockWs("alice");

//       const gameId = gm.createGame("alice", "Alice", alice.ws);
//       await gm.startGame("alice");

//       alice.msgs.length = 0;

//       const engine = registry.getGame(gameId)!;

//       await codriveToGameEnd(gameId, engine, gm, connManager);

//       expect(
//         alice.msgs.some((m: any) => m.type === "game_ended"),
//       ).toBe(true);
//     },
//     12_000,
//   );
// });
