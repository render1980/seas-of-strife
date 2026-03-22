import type { GamePhase, GameState } from "../types";

/**
 * This file implements a simple state machine to manage game phases and enforce valid transitions.
 * The GameEngine uses this to control the flow of the game and ensure that actions are only taken
 * when appropriate for the current phase.
 * 
 * The phases are:
 * - "waiting": Before the game starts, players can join. Transition to "round-start" when ready.
 * - "round-start": Set up a new round (deal cards, reset states). Transition to "trick-playing".
 * - "trick-playing": Players take turns playing cards. After each trick, transition to "trick-resolution".
 * - "trick-resolution": Determine the winner of the trick and update states. Then either:
 *     - Transition back to "trick-playing" for the next trick, or
 *     - Transition to "round-end" if all tricks are done.
 * - "round-end": Calculate round scores and update player totals. Then either:
 *     - Transition to "round-start" for the next round, or
 *     - Transition to "game-end" if all rounds are done.
 * - "game-end": Final state after all rounds are complete. No further transitions allowed.
 */

/** Valid phase transitions */
const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  waiting:           ["round-start"],
  "round-start":     ["trick-playing"],
  "trick-playing":   ["trick-resolution"],
  "trick-resolution":["trick-playing", "round-end"],
  "round-end":       ["round-start", "game-end"],
  "game-end":        [],
};

export class GameStateMachine {
  private state: GameState;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  getState(): GameState {
    return this.state;
  }

  /** Replace internal state (e.g. after a move is applied externally) */
  setState(newState: GameState): void {
    this.state = newState;
  }

  canTransitionTo(next: GamePhase): boolean {
    return VALID_TRANSITIONS[this.state.phase].includes(next);
  }

  /**
   * Transitions to the next phase.
   * Throws if the transition is invalid.
   */
  transition(next: GamePhase): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Invalid transition: "${this.state.phase}" → "${next}". ` +
        `Allowed: [${VALID_TRANSITIONS[this.state.phase].join(", ")}]`
      );
    }
    this.state = { ...this.state, phase: next };
  }
}
