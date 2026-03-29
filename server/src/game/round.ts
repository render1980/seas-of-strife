import { createShuffledDeck } from "./cards";
import {
  DECK_LENGTH,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type GameState,
  type PlayerState,
  type RoundResult,
  type TrickState,
} from "../types/types";

/**
 * Deals cards to all players for a new round.
 * Returns updated player states with fresh hands and zero tricksTakenPerRound.
 * Also returns the player index who has card 0 (they open the first trick).
 */
export function dealCards(players: PlayerState[]): {
  updatedPlayers: PlayerState[];
  startingPlayerIndex: number;
} {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(
      `Unsupported player count: ${players.length}. Must be ${MIN_PLAYERS}, ${MIN_PLAYERS + 1}, or ${MAX_PLAYERS}.`,
    );
  }
  const cardsEach = DECK_LENGTH / players.length;

  const deck = createShuffledDeck();
  const updatedPlayers: PlayerState[] = players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * cardsEach, (i + 1) * cardsEach),
    tricksTakenPerRound: 0,
  }));

  const startingPlayerIndex = updatedPlayers.findIndex((p) =>
    p.hand.includes(0),
  );

  if (startingPlayerIndex === -1) {
    // Card 0 is in the discard pile (shouldn't happen with 4-6 players using 60 cards)
    // Fall back to player 0
    return { updatedPlayers, startingPlayerIndex: 0 };
  }

  return { updatedPlayers, startingPlayerIndex };
}

/**
 * Collects per-player trick scores at round end.
 */
export function calculateRoundScores(
  roundNumber: number,
  players: PlayerState[],
): RoundResult {
  return {
    round: roundNumber,
    scores: players.map((p) => ({
      playerId: p.id,
      tricksTaken: p.tricksTakenPerRound,
    })),
  };
}

/**
 * Determines current winners ranked by tricks taken.
 * Works after any round (partial or complete) to show current leaders.
 * Can be called after each round for leaderboard updates,
 * or after the final round for the podium (top 3).
 *
 * @param players - All players in the game
 * @param roundResults - Round results available so far
 * @param topN - Number of top players to return (default: 3 for medals)
 */
export function calculateRoundWinners(
  players: PlayerState[],
  roundResults: RoundResult[],
  topN: number = 3,
): { playerId: string; name: string; totalTricksTaken: number }[] {
  const totals = calculateTricksTakenPerPlayer(players, roundResults);

  // Sort by tricks taken (ascending — fewest is best)
  totals.sort((a, b) => a.totalTricksTaken - b.totalTricksTaken);

  // Return top N
  return totals.slice(0, topN);
}

function calculateTricksTakenPerPlayer(
  players: PlayerState[],
  roundResults: RoundResult[],
) {
  return players.map((p) => {
    const totalTricksTaken = roundResults.reduce((sum, round) => {
      const score = round.scores.find((s) => s.playerId === p.id);
      return sum + (score?.tricksTaken ?? 0);
    }, 0);
    return { playerId: p.id, name: p.name, totalTricksTaken };
  });
}
