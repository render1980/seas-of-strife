export type Color =
  | "orange"
  | "red"
  | "gray"
  | "blue"
  | "green"
  | "purple"
  | "teal"
  | "dark_red";

export type GamePhase =
  | "waiting"
  | "round-start"
  | "trick-playing"
  | "trick-resolution"
  | "round-end"
  | "game-end";
  
export interface Suit {
  color: Color;
  min: number;
  max: number;
  /** Thematic background name **/
  theme: string;
}

export const DECK_LENGTH = 60;
export const TOTAL_ROUNDS_PER_GAME = 5;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;

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

export interface Card {
  value: number;
  color: Color;
}

export interface PlayedCard {
  playerId: string;
  card: number;
}

export interface TrickState {
  /** Ordered list of cards played in this trick */
  playedCards: PlayedCard[];
  /** Index into players array who opened this trick */
  startingPlayerIndex: number;
  /** Set after resolution: index into players array */
  winnerIdx?: number;
  /** Whether trick winner has the special power to select next leader */
  winnerHasSpecialPower?: boolean;
}

export interface RoundResult {
  round: number;
  scores: { playerId: string; tricksTaken: number }[];
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: number[];
  tricksTaken: number;
}

export interface GameState {
  gameId: number;
  phase: GamePhase;
  players: PlayerState[];
  /** 1-based; 5 rounds total (configurable) */
  currentRound: number;
  /** Index into players array for whose turn it is */
  currentPlayerIndex: number;
  currentTrick: TrickState;
  roundResults: RoundResult[];
  /** When waiting for trick winner to pick the next leader */
  awaitingLeaderSelection: boolean;
  /** Player index who won the last trick (permanent reference for next trick start) */
  lastTrickWinnerIndex?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface MoveResult {
  success: boolean;
  error?: string;
  newState?: GameState;
  /** Trick just resolved: pick next leader if special power applies */
  trickResolved?: boolean;
  roundEnded?: boolean;
  gameEnded?: boolean;
}

export interface TrickResult {
  winnerIdx: number;
  winnerId: string;
  winningCard: number;
  hasSpecialPower: boolean;
}

export interface GameWinner {
  playerId: string;
  name: string;
  totalTricksTaken: number;
}
