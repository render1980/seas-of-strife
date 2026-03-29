import {
  type GameState,
  type MoveResult,
  type PlayerState,
  type RoundWinner,
  TOTAL_ROUNDS_PER_GAME,
} from "../types/types";
import { GameStateMachine } from "./GameStateMachine";
import {
  calculateRoundScores,
  dealCards,
  calculateRoundWinners,
} from "./round";
import {
  calculateTrickTaker,
  createEmptyTrick,
  getValidCards,
  validateCardPlay,
} from "./trick";

/**
 * Interface for persistence service.
 * Allows GameEngine to work with or without database backing.
 */
export interface IPersistService {
  saveGameState(state: GameState): Promise<void>;
  saveRoundResult(
    gameId: number,
    roundNumber: number,
    roundResult: any,
  ): Promise<void>;
  saveGameResults(
    gameId: number,
    realPlayerIds: string[],
    winners: any[],
  ): Promise<void>;
}

/**
 * This file contains the main GameEngine class which manages the overall game state and lifecycle.
 * It uses a GameStateMachine to handle phase transitions and enforce valid state changes.
 * The engine exposes methods for starting the game, processing player moves, and retrieving game results.
 * It orchestrates the flow of the game by calling into the round and trick logic as needed.
 * The GameState is the single source of truth for the current game status, and all methods ensure it is updated immutably.
 * The engine supports optional persistence via IPersistService.
 */

export class GameEngine {
  private sm: GameStateMachine;
  private persistService?: IPersistService;

  constructor(initialState: GameState, persistService?: IPersistService) {
    this.sm = new GameStateMachine(initialState);
    this.persistService = persistService;
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  getGameState(): GameState {
    return this.sm.getState();
  }

  getPhase() {
    return this.sm.getPhase();
  }

  getValidMoves(playerId: string): number[] {
    return getValidCards(playerId, this.sm.getState());
  }

  // ---------------------------------------------------------------------------
  // Private persistence helper
  // ---------------------------------------------------------------------------

  async persistState(): Promise<void> {
    if (!this.persistService) return;

    try {
      const state = this.sm.getState();
      await this.persistService.saveGameState(state);
    } catch (error) {
      console.error("Failed to persist game state:", error);
      // Don't throw — game should continue even if persistence fails
    }
  }

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the game: transitions from 'waiting' → 'round-start' → 'trick-playing'.
   * Player list must already be populated (including bots).
   */
  startGame(): void {
    this.sm.transition("round-start");
    this.applyRoundStart();
  }

  /**
   * A human chose who leads the next trick after winning with a special-power card.
   * @param chooserId - the player who has the special power
   * @param chosenPlayerIndex - index into players array who will lead
   */
  selectNextLeader(chooserId: string, chosenPlayerIndex: number): MoveResult {
    const state = this.sm.getState();

    if (!state.awaitingLeaderSelection) {
      return { success: false, error: "No leader selection pending" };
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer?.id !== chooserId) {
      return {
        success: false,
        error: "You do not have the special power right now",
      };
    }

    const newState: GameState = {
      ...state,
      awaitingLeaderSelection: false,
      currentPlayerIndex: chosenPlayerIndex,
      currentTrick: createEmptyTrick(chosenPlayerIndex),
    };
    this.sm.setState(newState);
    this.sm.transition("trick-playing");

    this.persistState(); // Fire and forget

    return { success: true, newState: this.sm.getState() };
  }

  // ---------------------------------------------------------------------------
  // Core move
  // ---------------------------------------------------------------------------

  /**
   * Processes a card play from a player.
   * Handles the full cascade: validate → apply → resolve trick → advance round/game.
   * Persists state after each move.
   */
  async playCard(playerId: string, card: number): Promise<MoveResult> {
    if (this.sm.getPhase() !== "trick-playing") {
      return {
        success: false,
        error: `Cannot play a card during phase: ${this.sm.getPhase()}`,
      };
    }

    const state = this.sm.getState();

    // Validate
    const validation = validateCardPlay(playerId, card, state);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Apply card to state
    let newState = this.applyCardToState(state, playerId, card);
    this.sm.setState(newState);
    await this.persistState();

    // Check if the trick is complete
    if (newState.currentTrick.playedCards.length < newState.players.length) {
      // Advance to next player clockwise
      newState = this.advanceCurrentPlayer(newState);
      this.sm.setState(newState);
      await this.persistState();
      return { success: true, newState: this.sm.getState() };
    }

    // Trick is complete — resolve it
    this.sm.transition("trick-resolution");
    const roundEnded = await this.resolveTrick();

    if (roundEnded) {
      return {
        success: true,
        newState: this.sm.getState(),
        trickResolved: true,
        roundEnded: true,
      };
    }

    const gameEnded = this.sm.getPhase() === "game-end";
    return {
      success: true,
      newState: this.sm.getState(),
      trickResolved: true,
      gameEnded,
    };
  }

  // ---------------------------------------------------------------------------
  // Game result
  // ---------------------------------------------------------------------------

  getRoundWinners(): RoundWinner[] {
    const state = this.sm.getState();
    return calculateRoundWinners(state.players, state.roundResults);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private applyCardToState(
    state: GameState,
    playerId: string,
    card: number,
  ): GameState {
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, hand: p.hand.filter((c) => c !== card) }
          : p,
      ),
      currentTrick: {
        ...state.currentTrick,
        playedCards: [...state.currentTrick.playedCards, { playerId, card }],
      },
    };
  }

  private advanceCurrentPlayer(state: GameState): GameState {
    const { players, currentTrick } = state;
    const startIndex = currentTrick.startingPlayerIndex;
    const playedCount = currentTrick.playedCards.length;
    const nextIndex = (startIndex + playedCount) % players.length;
    return { ...state, currentPlayerIndex: nextIndex };
  }

  /**
   * Resolves the completed trick, updates scores, and advances the phase.
   * Returns true if the round ended.
   */
  private async resolveTrick(): Promise<boolean> {
    const state = this.sm.getState();
    const { players, currentTrick, currentRound, roundResults } = state;

    const trickResult = calculateTrickTaker(
      currentTrick.playedCards,
      players.map((p) => p.id),
    );

    // Update tricksTakenPerRound for the taker
    const updatedPlayers: PlayerState[] = players.map((p, i) =>
      i === trickResult.trickTakerIdx
        ? { ...p, tricksTakenPerRound: p.tricksTakenPerRound + 1 }
        : p,
    );

    const updatedTrick = {
      ...currentTrick,
      trickTakerIdx: trickResult.trickTakerIdx,
      winnerHasSpecialPower: trickResult.hasSpecialPower,
    };

    let newState: GameState = {
      ...state,
      players: updatedPlayers,
      currentTrick: updatedTrick,
      lastTrickTakerIndex: trickResult.trickTakerIdx,
    };
    this.sm.setState(newState);
    await this.persistState();

    // Round ends when all players have played all cards
    const roundOver = updatedPlayers.every((p) => p.hand.length === 0);

    if (!roundOver) {
      // If winner has special power, wait for leader selection
      if (trickResult.hasSpecialPower) {
        newState = {
          ...this.sm.getState(),
          awaitingLeaderSelection: true,
          currentPlayerIndex: trickResult.trickTakerIdx,
        };
        this.sm.setState(newState);
        await this.persistState();
        // Stay in trick-resolution until leader is chosen
        return false;
      }

      // Normal: winner leads the next trick
      const nextTrick = createEmptyTrick(trickResult.trickTakerIdx);
      newState = {
        ...this.sm.getState(),
        awaitingLeaderSelection: false,
        currentPlayerIndex: trickResult.trickTakerIdx,
        currentTrick: nextTrick,
      };
      this.sm.setState(newState);
      this.sm.transition("trick-playing");
      await this.persistState();
      return false;
    }

    // Round is over — save round results
    const roundResult = calculateRoundScores(currentRound, updatedPlayers);
    newState = {
      ...this.sm.getState(),
      roundResults: [...roundResults, roundResult],
      awaitingLeaderSelection: false,
    };
    this.sm.setState(newState);
    this.sm.transition("round-end");
    await this.persistState();

    // Save round results to database
    if (this.persistService) {
      try {
        await this.persistService.saveRoundResult(
          newState.gameId,
          currentRound,
          roundResult,
        );
      } catch (error) {
        console.error("Failed to save round result:", error);
      }
    }

    if (currentRound >= TOTAL_ROUNDS_PER_GAME) {
      this.sm.transition("game-end");
      await this.persistState();

      // Save game results
      if (this.persistService) {
        const realPlayerIds = newState.players
          .filter((p) => !p.isBot)
          .map((p) => p.id);
        const winners = calculateRoundWinners(
          newState.players,
          newState.roundResults,
        );
        try {
          await this.persistService.saveGameResults(
            newState.gameId,
            realPlayerIds,
            winners,
          );
        } catch (error) {
          console.error("Failed to save game results:", error);
        }
      }

      return true;
    }

    // Start the next round
    this.sm.transition("round-start");
    await this.applyRoundStart();
    return true;
  }

  private async applyRoundStart(): Promise<void> {
    const state = this.sm.getState();
    const { updatedPlayers, startingPlayerIndex } = dealCards(state.players);

    const newState: GameState = {
      ...state,
      phase: "round-start",
      currentRound: state.currentRound === 0 ? 1 : state.currentRound + 1,
      players: updatedPlayers,
      currentPlayerIndex: startingPlayerIndex,
      currentTrick: createEmptyTrick(startingPlayerIndex),
      awaitingLeaderSelection: false,
    };
    this.sm.setState(newState);
    this.sm.transition("trick-playing");
    await this.persistState();
  }

  /**
   * Auto-play a random valid card for a player who timed out (30s disconnect).
   * Called by ConnectionManager when disconnect timeout occurs.
   */
  async autoPlayCard(playerId: string): Promise<MoveResult> {
    const validCards = this.getValidMoves(playerId);

    if (validCards.length === 0) {
      return {
        success: false,
        error: "No valid cards available for auto-play",
      };
    }

    // Pick a random card
    const randomCard =
      validCards[Math.floor(Math.random() * validCards.length)];

    return this.playCard(playerId, randomCard!);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a fresh GameState for a new game (still in 'waiting' phase).
 * Players should be added before calling engine.startGame().
 */
export function createInitialGameState(
  gameId: number,
  players: PlayerState[],
): GameState {
  return {
    gameId,
    phase: "waiting",
    players,
    currentRound: 0,
    currentPlayerIndex: 0,
    currentTrick: createEmptyTrick(0),
    roundResults: [],
    awaitingLeaderSelection: false,
  } as GameState;
}
