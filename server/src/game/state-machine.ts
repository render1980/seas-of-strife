import type { GamePhase, GameState } from "../types";

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
