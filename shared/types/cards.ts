export const SUIT_DEFINITIONS: Suit[] = [
  { color: "orange", min: 0, max: 10, theme: "doldrums" },
  { color: "red", min: 11, max: 20, theme: "reef" },
  { color: "gray", min: 21, max: 29, theme: "fog" },
  { color: "blue", min: 31, max: 38, theme: "iceberg" },
  { color: "green", min: 41, max: 47, theme: "rocks" },
  { color: "purple", min: 51, max: 56, theme: "storm" },
  { color: "teal", min: 61, max: 65, theme: "whirlpool" },
  { color: "dark_red", min: 71, max: 74, theme: "kraken" },
];

export const SUIT_MAX: Record<Color, number> = SUIT_DEFINITIONS.reduce(
  (acc, { color: suit, max }) => ({ ...acc, [suit]: max }),
  {} as Record<Color, number>,
);

export type Color =
  | "orange"
  | "red"
  | "gray"
  | "blue"
  | "green"
  | "purple"
  | "teal"
  | "dark_red";

export interface Suit {
  color: Color;
  min: number;
  max: number;
  /** Thematic background name **/
  theme: string;
}

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