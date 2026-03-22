import { getSuitFromCard, isHighestCardOfSuit } from "./cards";
import type { PlayedCard, TrickResult, TrickState } from "../types/game";

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
 * Resolves who wins a completed trick.
 *
 * Algorithm (from rules):
 * 1. Group played cards by suit.
 * 2. Find the maximum count across all suits.
 * 3. Collect all suits that share that maximum count (tied suits).
 * 4. Among the tied suits, find the overall highest card value.
 * 5. The player who played that card takes the trick.
 * 6. If the winning card is the highest in its suit, the winner has special power.
 */
export function calculateTrickWinner(
  playedCards: PlayedCard[],
  playerIds: string[]
): TrickResult {
  if (playedCards.length === 0) {
    throw new Error("Cannot resolve an empty trick");
  }

  // Group cards by suit
  const suitGroups = new Map<string, PlayedCard[]>();
  for (const pc of playedCards) {
    const suit = getSuitFromCard(pc.card);
    if (!suitGroups.has(suit)) suitGroups.set(suit, []);
    suitGroups.get(suit)!.push(pc);
  }

  // Find maximum number of cards in a single suit
  let maxCount = 0;
  for (const cards of suitGroups.values()) {
    if (cards.length > maxCount) maxCount = cards.length;
  }

  // Collect cards from all suits that have that maximum count (tied suits)
  const candidateCards: PlayedCard[] = [];
  for (const cards of suitGroups.values()) {
    if (cards.length === maxCount) {
      candidateCards.push(...cards);
    }
  }

  // The highest card value among candidates wins
  const winner = candidateCards.reduce((best, pc) =>
    pc.card > best.card ? pc : best
  );

  const winnerIndex = playerIds.indexOf(winner.playerId);
  if (winnerIndex === -1) {
    throw new Error(`Winner playerId "${winner.playerId}" not found in playerIds`);
  }

  return {
    winnerIdx: winnerIndex,
    winnerId: winner.playerId,
    winningCard: winner.card,
    hasSpecialPower: isHighestCardOfSuit(winner.card),
  };
}
