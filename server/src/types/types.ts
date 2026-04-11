import type { Color } from "../../../shared/types/cards";

export type GamePhase =
  | "waiting"
  | "round-start"
  | "trick-playing"
  | "trick-resolution"
  | "round-end"
  | "game-end";

export const DECK_LENGTH = 60;
export const TOTAL_ROUNDS_PER_GAME = 1;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;

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
  trickTakerIdx?: number;
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
  tricksTakenPerRound: number;
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
  lastTrickTakerIndex?: number;
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
  trickTakerIdx: number;
  winnerId: string;
  winningCard: number;
  hasSpecialPower: boolean;
}

export interface RoundWinner {
  playerId: string;
  name: string;
  totalTricksTaken: number;
}
