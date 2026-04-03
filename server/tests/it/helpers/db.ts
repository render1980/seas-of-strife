import { getDb } from "../../../src/db/connection";
import type { GameState, PlayerState } from "../../../src/types/types";

export async function truncateAllTables(): Promise<void> {
  const sql = getDb();
  // Truncate in child-first order to satisfy FK constraints
  await sql`
    TRUNCATE player_game_results, game_results, game_rounds, games, player_profiles, users
    RESTART IDENTITY CASCADE
  `;
}

export { getDb };

export function makePlayers(n: number): PlayerState[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `player_${i + 1}`,
    name: `Player ${i + 1}`,
    isBot: false,
    hand: [],
    tricksTakenPerRound: 0,
  }));
}

export function makeGameState(
  gameId: number,
  overrides: Partial<GameState> = {},
): GameState {
  return {
    gameId,
    phase: "waiting",
    players: makePlayers(4),
    currentRound: 0,
    currentPlayerIndex: 0,
    currentTrick: { playedCards: [], startingPlayerIndex: 0 },
    roundResults: [],
    awaitingLeaderSelection: false,
    ...overrides,
  };
}
