import { describe, expect, it } from "bun:test";
import { GameStateMachine } from "../../src/game/GameStateMachine";
import { getSuitFromCard } from "../../src/game/cards";
import { type GameState, type PlayedCard } from "../../src/types/types";

describe("GameStateMachine", () => {
  it("initializes with correct phase and round", () => {
    const initialState: GameState = {
      gameId: 1,
      phase: "waiting",
      players: [],
      currentRound: 0,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: [], startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
    const gsm = new GameStateMachine(initialState);
    expect(gsm.getPhase()).toBe("waiting");
    expect(gsm.getState().currentRound).toBe(0);
  });

  it("allows valid phase transitions", () => {
    const initialState: GameState = {
      gameId: 1,
      phase: "waiting",
      players: [],
      currentRound: 0,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: [], startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
    const gsm = new GameStateMachine(initialState);
    // waiting -> round-start
    gsm.transition("round-start");
    expect(gsm.getPhase()).toBe("round-start");
    // round-start -> trick-playing
    gsm.transition("trick-playing");
    expect(gsm.getPhase()).toBe("trick-playing");
    // trick-playing -> trick-resolution
    gsm.transition("trick-resolution");
    expect(gsm.getPhase()).toBe("trick-resolution");
    // trick-resolution -> round-end
    gsm.transition("round-end");
    expect(gsm.getPhase()).toBe("round-end");
    // round-end -> round-start (next round)
    gsm.transition("round-start");
    expect(gsm.getPhase()).toBe("round-start");
  });

  it("prevents invalid phase transitions", () => {
    const initialState: GameState = {
      gameId: 1,
      phase: "waiting",
      players: [],
      currentRound: 0,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: [], startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
    const gsm = new GameStateMachine(initialState);
    // Invalid transition: waiting -> trick-playing
    expect(() => gsm.transition("trick-playing")).toThrow();
    // Valid transition to round-start
    gsm.transition("round-start");
    // Invalid transition: round-start -> round-end
    expect(() => gsm.transition("round-end")).toThrow();
    // Invalid transition: round-start -> game-end
    expect(() => gsm.transition("game-end")).toThrow();
    // Invalid transition: round-start -> waiting
    expect(() => gsm.transition("waiting")).toThrow();
    // Invalid transition: round-start -> round-start
    expect(() => gsm.transition("round-start")).toThrow();
  });
});
