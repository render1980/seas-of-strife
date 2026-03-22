import { createShuffledDeck } from "./cards";
import { DECK_LENGTH, MIN_PLAYERS, MAX_PLAYERS, type GameState, type PlayerState, type RoundResult, type TrickState } from "../types/game";

/**
 * Deals cards to all players for a new round.
 * Returns updated player states with fresh hands and zero tricksTaken.
 * Also returns the player index who has card 0 (they open the first trick).
 */
export function dealCards(players: PlayerState[]): {
  updatedPlayers: PlayerState[];
  startingPlayerIndex: number;
} {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Unsupported player count: ${players.length}. Must be ${MIN_PLAYERS}, ${MIN_PLAYERS + 1}, or ${MAX_PLAYERS}.`);
  }
  const cardsEach = DECK_LENGTH / players.length;

  const deck = createShuffledDeck();
  const updatedPlayers: PlayerState[] = players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * cardsEach, (i + 1) * cardsEach),
    tricksTaken: 0,
  }));

  const startingPlayerIndex = updatedPlayers.findIndex((p) =>
    p.hand.includes(0)
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
  players: PlayerState[]
): RoundResult {
  return {
    round: roundNumber,
    scores: players.map((p) => ({ playerId: p.id, tricksTaken: p.tricksTaken })),
  };
}

/**
 * Determines the game winner(s) after all rounds complete.
 * Winner(s) are player(s) with the fewest total tricks taken.
 * Tie is possible — all tied players win.
 */
export function determineGameWinners(
  players: PlayerState[],
  roundResults: RoundResult[]
): { playerId: string; name: string; totalTricksTaken: number }[] {
  const totals = players.map((p) => {
    const totalTricksTaken = roundResults.reduce((sum, round) => {
      const score = round.scores.find((s) => s.playerId === p.id);
      return sum + (score?.tricksTaken ?? 0);
    }, 0);
    return { playerId: p.id, name: p.name, totalTricksTaken };
  });

  const minTricksTaken = Math.min(...totals.map((t) => t.totalTricksTaken));
  return totals.filter((t) => t.totalTricksTaken === minTricksTaken);
}
