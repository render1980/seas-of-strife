import type {
  GameState,
  PlayedCard,
  PlayerState,
  TrickResult,
  TrickState,
  ValidationResult,
} from "../types/types";
import { getSuitFromCard, isHighestCardOfSuit } from "./cards";

/**
 * This file contains logic for resolving trick winners and validating card plays.
 * It only belongs to actions within each trick, not the broader game lifecycle (rounds, scoring, etc).
 */

/**
 * Builds a blank trick state for the start of a trick.
 */
export function createEmptyTrick(startingPlayerIndex: number): TrickState {
  return {
    playedCards: [],
    startingPlayerIndex,
    trickTakerIdx: undefined,
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
export function calculateTrickTaker(
  playedCards: PlayedCard[],
  playerIds: string[],
): TrickResult {
  if (playedCards.length === 0) {
    throw new Error("Cannot resolve an empty trick");
  }

  const suitGroups = groupCardsBySuit(playedCards);
  let maxCount = findMaxCountAmongPlayedSuits(suitGroups);
  const candidateCards: PlayedCard[] = collectCandidateCards(suitGroups, maxCount);
  const theHighestCardAmongTiedSuits = candidateCards.reduce((best, pc) =>
    pc.card > best.card ? pc : best,
  );

  const takerIndex = playerIds.indexOf(theHighestCardAmongTiedSuits.playerId);
  if (takerIndex === -1) {
    throw new Error(
      `Taker playerId "${theHighestCardAmongTiedSuits.playerId}" not found in playerIds`,
    );
  }

  return {
    trickTakerIdx: takerIndex,
    winnerId: theHighestCardAmongTiedSuits.playerId,
    winningCard: theHighestCardAmongTiedSuits.card,
    hasSpecialPower: isHighestCardOfSuit(theHighestCardAmongTiedSuits.card),
  };
}

// Collect cards from all suits that have that maximum count (tied suits)
function collectCandidateCards(suitGroups: Map<string, PlayedCard[]>, maxCount: number) {
  const candidateCards: PlayedCard[] = [];
  for (const cards of suitGroups.values()) {
    if (cards.length === maxCount) {
      candidateCards.push(...cards);
    }
  }
  return candidateCards;
}

function findMaxCountAmongPlayedSuits(suitGroups: Map<string, PlayedCard[]>) {
  let maxCount = 0;
  for (const playedCardsBySuit of suitGroups.values()) {
    if (playedCardsBySuit.length > maxCount) maxCount = playedCardsBySuit.length;
  }
  return maxCount;
}

function groupCardsBySuit(playedCards: PlayedCard[]) {
  const suitGroups = new Map<string, PlayedCard[]>();
  for (const pc of playedCards) {
    const suit = getSuitFromCard(pc.card);
    if (!suitGroups.has(suit)) suitGroups.set(suit, []);
    suitGroups.get(suit)!.push(pc);
  }
  return suitGroups;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determines the set of valid cards for a player who is NOT the first to play.
 *
 * Rule: must follow the suit(s) present in the trick when possible.
 * Once a second suit enters the trick (because someone had no matching cards),
 * subsequent players must follow either the leading suit OR the new suit.
 */
function getFollowSuitCards(player: PlayerState, state: GameState): number[] {
  const { playedCards } = state.currentTrick;

  // Collect the suits that are "in play" in this trick
  const suitsInTrick = new Set(
    playedCards.map((pc) => getSuitFromCard(pc.card)),
  );

  // Cards in the player's hand that match any suit in the trick
  const matchingCards = player.hand.filter((c) =>
    suitsInTrick.has(getSuitFromCard(c)),
  );

  // If the player can follow any trick suit they must
  return matchingCards.length > 0 ? matchingCards : [...player.hand];
}

/**
 * Returns all cards from the player's hand that are valid to play
 * given the current trick state.
 */
export function getValidCards(playerId: string, state: GameState): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  // First trick of every round: the player holding card 0 must play with it.
  const isFirstTrickOpening =
    state.players.every((p) => p.tricksTakenPerRound === 0) &&
    state.currentTrick.playedCards.length === 0;

  if (isFirstTrickOpening) {
    return player.hand.includes(0) ? [0] : [];
  }

  // First card of trick — any card is valid
  if (state.currentTrick.playedCards.length === 0) {
    return [...player.hand];
  }

  return getFollowSuitCards(player, state);
}

function isCurrentPlayerTurn(playerId: string, state: GameState): boolean {
  const currentPlayer = state.players[state.currentPlayerIndex];
  return currentPlayer?.id === playerId;
}

/**
 * Validates whether a specific card play is legal.
 */
export function validateCardPlay(
  playerId: string,
  card: number,
  state: GameState,
): ValidationResult {
  if (!isCurrentPlayerTurn(playerId, state)) {
    return { valid: false, reason: `It is not ${playerId}'s turn` };
  }

  // Check card is playable
  const validCards = getValidCards(playerId, state);
  if (!validCards.includes(card)) {
    return {
      valid: false,
      reason: `Card ${card} is not valid to play`,
    };
  }

  return { valid: true };
}
