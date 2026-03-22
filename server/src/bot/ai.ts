import { getSuitFromCard } from "../game/cards";
import { getValidCards } from "../game/trick";
import type { GameState } from "../types";

/**
 * Bot AI for Seas of Strife.
 *
 * Strategy (avoid taking tricks):
 * - If opening a trick: play the lowest card from the most-represented suit in hand
 *   (likely safe since others may be forced to follow and play higher).
 * - If following suit is required: play the lowest valid card to minimise
 *   the chance of winning the trick.
 * - If no matching suit exists: play the absolute lowest card in hand.
 * - If the trick is already "lost" (another card will beat anything we play):
 *   play the highest safe card instead to drain dangerous high cards from hand.
 */
export class BotPlayer {
  static decideMove(playerId: string, state: GameState): number {
    const validCards = getValidCards(playerId, state);
    if (validCards.length === 0) {
      throw new Error(`Bot ${playerId} has no valid cards to play`);
    }
    if (validCards.length === 1) return validCards[0];

    const { playedCards } = state.currentTrick;

    // Opening a trick — play lowest card from the suit with most cards in hand
    if (playedCards.length === 0) {
      return BotPlayer.openingMove(validCards);
    }

    // Following: check if any card we MUST play could still win the trick
    const currentHighest = Math.max(...playedCards.map((pc) => pc.card));

    // Check if the bot can possibly win (any valid card beats the current highest)
    const canWin = validCards.some((c) => c > currentHighest);

    if (!canWin) {
      // Cannot win this trick — play highest card to dump a high-risk card safely
      return Math.max(...validCards);
    }

    // Can potentially win — play lowest to avoid winning if possible
    return Math.min(...validCards);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * When opening a trick, pick the lowest card from the suit the bot has the most
   * cards in (keeps the hand balanced and minimises future exposure).
   */
  private static openingMove(hand: number[]): number {
    // Group hand by suit
    const suitGroups = new Map<string, number[]>();
    for (const card of hand) {
      const suit = getSuitFromCard(card);
      if (!suitGroups.has(suit)) suitGroups.set(suit, []);
      suitGroups.get(suit)!.push(card);
    }

    // Find the suit with the most cards; break ties by lowest minimum card
    let bestSuit: string | null = null;
    let bestCount = 0;
    let bestMin = Infinity;

    for (const [suit, cards] of suitGroups.entries()) {
      const min = Math.min(...cards);
      if (
        cards.length > bestCount ||
        (cards.length === bestCount && min < bestMin)
      ) {
        bestSuit = suit;
        bestCount = cards.length;
        bestMin = min;
      }
    }

    const suitCards = suitGroups.get(bestSuit!)!;
    return Math.min(...suitCards);
  }
}
