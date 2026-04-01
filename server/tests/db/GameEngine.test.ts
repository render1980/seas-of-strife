import { beforeEach, describe, expect, it } from "bun:test";
import { type GameEngine } from "../../src/game/engine";
import { GameRegistry } from "../../src/game/GameRegistry";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { getValidCards } from "../../src/game/trick";
import { TOTAL_ROUNDS_PER_GAME } from "../../src/types/types";
import { getDb, makePlayers, truncateAllTables } from "./helpers/db";

const sql = getDb();

beforeEach(truncateAllTables);

/**
 * Drives a GameEngine to game-end, handling special-power leader selection.
 */
async function playFullGame(engine: GameEngine): Promise<void> {
  const budget = { remaining: TOTAL_ROUNDS_PER_GAME * 15 * 6 + 200 };

  const isRunning = () => {
    const phase = engine.getPhase();
    return (
      phase === "trick-playing" ||
      (phase === "trick-resolution" &&
        engine.getGameState().awaitingLeaderSelection)
    );
  };

  while (isRunning() && budget.remaining-- > 0) {
    const gs = engine.getGameState();

    if (gs.awaitingLeaderSelection) {
      await engine.selectNextLeader(
        gs.players[gs.currentPlayerIndex]!.id,
        gs.currentPlayerIndex,
      );
      continue;
    }

    const player = gs.players[gs.currentPlayerIndex]!;
    const validCards = getValidCards(player.id, gs);
    await engine.playCard(player.id, validCards[0]!);
  }
}

/**
 * Creates users whose logins match the player IDs produced by makePlayers(),
 * so saveGameResults can award medals via the users table.
 */
async function setupUsers(repo: GameRepository): Promise<void> {
  for (let i = 1; i <= 4; i++) {
    const userId = await repo.createUser(`player_${i}`, "hash", "salt");
    await repo.createPlayerProfile(userId);
  }
}

describe("GameEngine -> GameRepository -> Postgres", () => {
  it("persists final game state, all round results, and medals after a complete game", async () => {
    const repo = new GameRepository(sql);
    await setupUsers(repo);

    const registry = new GameRegistry(repo);
    const engine = await registry.createGame(1, makePlayers(4));
    engine.startGame();
    await playFullGame(engine);

    expect(engine.getPhase()).toBe("game-end");

    // games row reflects final state
    const gameRows =
      await sql`SELECT phase, current_round FROM games WHERE game_id = 1`;
    expect(gameRows[0]?.phase).toBe("game-end");
    expect(gameRows[0]?.current_round).toBe(TOTAL_ROUNDS_PER_GAME);

    // one game_rounds row per round
    const roundRows = await sql`
      SELECT gr.round_number
      FROM game_rounds gr
      JOIN games g ON g.id = gr.game_id
      WHERE g.game_id = 1
      ORDER BY gr.round_number
    `;
    expect(roundRows.length).toBe(TOTAL_ROUNDS_PER_GAME);
    expect(roundRows.map((r: any) => r.round_number)).toEqual(
      Array.from({ length: TOTAL_ROUNDS_PER_GAME }, (_, i) => i + 1),
    );

    // one game_results row
    const resultRows = await sql`
      SELECT gr.id
      FROM game_results gr
      JOIN games g ON g.id = gr.game_id
      WHERE g.game_id = 1
    `;
    expect(resultRows.length).toBe(1);

    // all 4 players have a player_game_results entry
    const pgrRows = await sql`
      SELECT medal FROM player_game_results WHERE game_id = 1 ORDER BY medal NULLS LAST
    `;
    expect(pgrRows.length).toBe(4);

    const medals = pgrRows.map((r: any) => r.medal).filter(Boolean);
    expect(medals).toContain("gold");
    expect(medals).toContain("silver");
    expect(medals).toContain("bronze");

    // every player's profile shows 1 game played
    const profiles = await sql`
      SELECT pp.total_games_played
      FROM player_profiles pp
      JOIN users u ON u.id = pp.user_id
      WHERE u.login IN ('player_1', 'player_2', 'player_3', 'player_4')
    `;
    expect(profiles.length).toBe(4);
    for (const p of profiles) {
      expect(p.total_games_played).toBe(1);
    }
  });

  it("persists state mid-game so a fresh registry can resume from the saved state", async () => {
    const repo = new GameRepository(sql);

    const registry1 = new GameRegistry(repo);
    const engine1 = await registry1.createGame(2, makePlayers(4));
    engine1.startGame();

    // Play a few cards to advance beyond the initial snapshot
    for (let move = 0; move < 4; move++) {
      const gs = engine1.getGameState();
      if (engine1.getPhase() !== "trick-playing") break;
      const player = gs.players[gs.currentPlayerIndex]!;
      const cards = getValidCards(player.id, gs);
      await engine1.playCard(player.id, cards[0]!);
    }

    // DB must already hold a persisted game row after card plays
    const midRows = await sql`SELECT phase FROM games WHERE game_id = 2`;
    expect(midRows.length).toBe(1);

    // Fresh registry — simulates a server restart
    const registry2 = new GameRegistry(repo);
    const engine2 = await registry2.getOrLoadGame(2);

    expect(engine2).not.toBeNull();
    expect(engine2!.getGameState().gameId).toBe(2);

    // Finish the game from the loaded state
    await playFullGame(engine2!);
    expect(engine2!.getPhase()).toBe("game-end");

    const finalRows = await sql`SELECT phase FROM games WHERE game_id = 2`;
    expect(finalRows[0]?.phase).toBe("game-end");
  });
});
