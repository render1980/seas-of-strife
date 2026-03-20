import { GameStateMachine } from "./state-machine";
import { validateCardPlay, getValidCards } from "./rules";
import { calculateTrickWinner } from "./trick";
import {
  dealCards,
  createEmptyTrick,
  calculateRoundScores,
  determineGameWinners,
  TOTAL_ROUNDS,
} from "./round";
import type {
  GameState,
  MoveResult,
  PlayerState,
  GameWinner,
} from "../types/game";

export class GameEngine {
  private sm: GameStateMachine;

  constructor(initialState: GameState) {
    this.sm = new GameStateMachine(initialState);
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
    if (currentPlayer.id !== chooserId) {
      return { success: false, error: "You do not have the special power right now" };
    }

    const newState: GameState = {
      ...state,
      awaitingLeaderSelection: false,
      currentPlayerIndex: chosenPlayerIndex,
      currentTrick: createEmptyTrick(chosenPlayerIndex),
    };
    this.sm.setState(newState);
    this.sm.transition("trick-playing");

    return { success: true, newState: this.sm.getState() };
  }

  // ---------------------------------------------------------------------------
  // Core move
  // ---------------------------------------------------------------------------

  /**
   * Processes a card play from a player.
   * Handles the full cascade: validate → apply → resolve trick → advance round/game.
   */
  playCard(playerId: string, card: number): MoveResult {
    if (this.sm.getPhase() !== "trick-playing") {
      return { success: false, error: `Cannot play a card during phase: ${this.sm.getPhase()}` };
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

    // Check if the trick is complete
    if (newState.currentTrick.playedCards.length < newState.players.length) {
      // Advance to next player clockwise
      newState = this.advanceCurrentPlayer(newState);
      this.sm.setState(newState);
      return { success: true, newState: this.sm.getState() };
    }

    // Trick is complete — resolve it
    this.sm.transition("trick-resolution");
    const roundEnded = this.resolveTrick();

    if (roundEnded) {
      return { success: true, newState: this.sm.getState(), trickResolved: true, roundEnded: true };
    }

    const gameEnded = this.sm.getPhase() === "game-end";
    return { success: true, newState: this.sm.getState(), trickResolved: true, gameEnded };
  }

  // ---------------------------------------------------------------------------
  // Game result
  // ---------------------------------------------------------------------------

  getGameWinners(): GameWinner[] {
    const state = this.sm.getState();
    return determineGameWinners(state.players, state.roundResults);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private applyCardToState(state: GameState, playerId: string, card: number): GameState {
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, hand: p.hand.filter((c) => c !== card) } : p
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
  private resolveTrick(): boolean {
    const state = this.sm.getState();
    const { players, currentTrick, currentRound, roundResults } = state;

    const trickResult = calculateTrickWinner(
      currentTrick.playedCards,
      players.map((p) => p.id)
    );

    // Update tricksWon for the winner
    const updatedPlayers: PlayerState[] = players.map((p, i) =>
      i === trickResult.winnerIdx ? { ...p, tricksWon: p.tricksWon + 1 } : p
    );

    const updatedTrick = {
      ...currentTrick,
      winnerIndex: trickResult.winnerIdx,
      winnerHasSpecialPower: trickResult.hasSpecialPower,
    };

    let newState: GameState = {
      ...state,
      players: updatedPlayers,
      currentTrick: updatedTrick,
      lastTrickWinnerIndex: trickResult.winnerIdx,
    };
    this.sm.setState(newState);

    // Round ends when all players have played all cards
    const roundOver = updatedPlayers.every((p) => p.hand.length === 0);

    if (!roundOver) {
      // If winner has special power, wait for leader selection
      if (trickResult.hasSpecialPower) {
        newState = {
          ...this.sm.getState(),
          awaitingLeaderSelection: true,
          currentPlayerIndex: trickResult.winnerIdx,
        };
        this.sm.setState(newState);
        // Stay in trick-resolution until leader is chosen
        return false;
      }

      // Normal: winner leads the next trick
      const nextTrick = createEmptyTrick(trickResult.winnerIdx);
      newState = {
        ...this.sm.getState(),
        awaitingLeaderSelection: false,
        currentPlayerIndex: trickResult.winnerIdx,
        currentTrick: nextTrick,
      };
      this.sm.setState(newState);
      this.sm.transition("trick-playing");
      return false;
    }

    // Round is over
    const roundResult = calculateRoundScores(currentRound, updatedPlayers);
    newState = {
      ...this.sm.getState(),
      roundResults: [...roundResults, roundResult],
      awaitingLeaderSelection: false,
    };
    this.sm.setState(newState);
    this.sm.transition("round-end");

    if (currentRound >= TOTAL_ROUNDS) {
      this.sm.transition("game-end");
      return true;
    }

    // Start the next round
    this.sm.transition("round-start");
    this.applyRoundStart();
    return true;
  }

  private applyRoundStart(): void {
    const state = this.sm.getState();
    const { updatedPlayers, startingPlayerIndex } = dealCards(state.players);
    const nextRound = state.currentRound + (state.phase === "round-start" && state.currentRound > 0 ? 1 : 0);

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
  players: PlayerState[]
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
  };
}
