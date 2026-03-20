import { createShuffledDeck } from "./cards";
import type { GameState, PlayerState, RoundResult, TrickState } from "../types/game";

/** Cards dealt per player by player count (from rules) */
const CARDS_PER_PLAYER: Record<number, number> = {
  4: 15,
  5: 12,
  6: 10,
};

/** Configurable number of rounds per game */
export const TOTAL_ROUNDS = 5;

/**
 * Deals cards to all players for a new round.
 * Returns updated player states with fresh hands and zero tricksWon.
 * Also returns the player index who has card 0 (they open the first trick).
 */
export function dealCards(players: PlayerState[]): {
  updatedPlayers: PlayerState[];
  startingPlayerIndex: number;
} {
  const count = players.length;
  const cardsEach = CARDS_PER_PLAYER[count];
  if (!cardsEach) {
    throw new Error(`Unsupported player count: ${count}. Must be 4, 5, or 6.`);
  }

  const deck = createShuffledDeck();
  const updatedPlayers: PlayerState[] = players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * cardsEach, (i + 1) * cardsEach),
    tricksWon: 0,
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
 * Builds a blank trick state for the start of a trick.
 */
export function createEmptyTrick(startingPlayerIndex: number): TrickState {
  return {
    playedCards: [],
    startingPlayerIndex,
    winnerIndex: undefined,
    winnerHasSpecialPower: undefined,
  };
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
    scores: players.map((p) => ({ playerId: p.id, tricksWon: p.tricksWon })),
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
): { playerId: string; name: string; totalTricks: number }[] {
  const totals = players.map((p) => {
    const totalTricks = roundResults.reduce((sum, round) => {
      const score = round.scores.find((s) => s.playerId === p.id);
      return sum + (score?.tricksWon ?? 0);
    }, 0);
    return { playerId: p.id, name: p.name, totalTricks };
  });

  const minTricks = Math.min(...totals.map((t) => t.totalTricks));
  return totals.filter((t) => t.totalTricks === minTricks);
}

/**
 * Returns total tricks taken so far by each player (for display).
 */
export function getTotalTricksByPlayer(
  players: PlayerState[],
  roundResults: RoundResult[]
): { playerId: string; totalTricks: number }[] {
  return players.map((p) => ({
    playerId: p.id,
    totalTricks: roundResults.reduce((sum, round) => {
      const score = round.scores.find((s) => s.playerId === p.id);
      return sum + (score?.tricksWon ?? 0);
    }, 0),
  }));
}
