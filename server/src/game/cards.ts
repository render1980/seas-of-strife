import { type Color, SUIT_DEFINITIONS, DECK_LENGTH } from "../types/types";

/**
 * Functions which are specific to the card deck and suits, but not game logic.
 * E.g. creating a shuffled deck, determining suit from card value, etc.
 * These are used by the game engine and also by the bot AI for card evaluation.
 */

/** All 60 card values in order */
export const ALL_CARDS: number[] = SUIT_DEFINITIONS.flatMap(({ min, max }) => {
  const cards: number[] = [];
  for (let v = min; v <= max; v++) cards.push(v);
  return cards;
});

/** Number of cards per suit (for flag display) */
export const SUIT_CARD_COUNT: Record<Color, number> = SUIT_DEFINITIONS.reduce(
  (acc, { color: suit, min, max }) => ({ ...acc, [suit]: max - min + 1 }),
  {} as Record<Color, number>,
);

/** Highest card value per suit */
export const SUIT_MAX: Record<Color, number> = SUIT_DEFINITIONS.reduce(
  (acc, { color: suit, max }) => ({ ...acc, [suit]: max }),
  {} as Record<Color, number>,
);

/**
 * Returns the suit for a given card value.
 * Throws if the value is not a valid card.
 */
export function getSuitFromCard(value: number): Color {
  for (const { color: suit, min, max } of SUIT_DEFINITIONS) {
    if (value >= min && value <= max) return suit;
  }
  throw new Error(`Invalid card value: ${value}`);
}

/**
 * Returns the 0-based position of the card within its suit.
 * E.g. orange 0 → index 0, orange 10 → index 10, red 11 → index 0.
 */
export function getCardIndexInSuit(value: number): number {
  const suit = SUIT_DEFINITIONS.find(
    ({ min, max }) => value >= min && value <= max,
  );
  if (!suit) throw new Error(`Invalid card value: ${value}`);
  return value - suit.min;
}

/**
 * Returns true if the card is the highest-ranked in its suit.
 * These cards have special power: winner chooses who opens the next trick.
 */
export function isHighestCardOfSuit(value: number): boolean {
  const suit = getSuitFromCard(value);
  return value === SUIT_MAX[suit];
}

/**
 * Creates a freshly shuffled copy of the full 60-card deck.
 */
export function createShuffledDeck(): number[] {
  const deck: number[] = [...ALL_CARDS];
  // Fisher-Yates shuffle
  for (let i = DECK_LENGTH - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = temp;
  }
  return deck;
}
