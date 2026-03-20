import { getSuitFromCard } from "./cards";
import type { GameState, PlayerState, ValidationResult } from "../types/game";

/**
 * Returns all cards from the player's hand that are valid to play
 * given the current trick state.
 */
export function getValidCards(playerId: string, state: GameState): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  // First card of trick — any card is valid
  if (state.currentTrick.playedCards.length === 0) {
    return [...player.hand];
  }

  return getFollowSuitCards(player, state);
}

/**
 * Validates whether a specific card play is legal.
 */
export function validateCardPlay(
  playerId: string,
  card: number,
  state: GameState
): ValidationResult {
  // Check it is this player's turn
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { valid: false, reason: "It is not your turn" };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { valid: false, reason: "Player not found in game" };
  }

  if (!player.hand.includes(card)) {
    return { valid: false, reason: "Card is not in your hand" };
  }

  // First card of trick — always valid
  if (state.currentTrick.playedCards.length === 0) {
    return { valid: true };
  }

  // Must follow suit if the player has a matching card
  const validCards = getFollowSuitCards(player, state);
  if (!validCards.includes(card)) {
    return {
      valid: false,
      reason: "You must follow the leading suit if you have a matching card",
    };
  }

  return { valid: true };
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
  const suitsInTrick = new Set(playedCards.map((pc) => getSuitFromCard(pc.card)));

  // Cards in the player's hand that match any suit in the trick
  const matchingCards = player.hand.filter((c) =>
    suitsInTrick.has(getSuitFromCard(c))
  );

  // If the player can follow any trick suit they must
  return matchingCards.length > 0 ? matchingCards : [...player.hand];
}
