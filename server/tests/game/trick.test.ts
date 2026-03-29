import { describe, expect, it } from "bun:test";
import {
  calculateTrickTaker,
  getValidCards,
  validateCardPlay,
} from "../../src/game/trick";
import type { GameState, PlayedCard } from "../../src/types/types";

// ---------------------------------------------------------------------------
// Trick Resolution
// ---------------------------------------------------------------------------

describe("calculate trick winner", () => {
  const playerIds = ["Anna", "Beth", "Connor", "David", "Eve"];

  it("Player with a highest card among suit with most cards wins", () => {
    const played: PlayedCard[] = [
      { playerId: "Anna", card: 0 },
      { playerId: "Beth", card: 2 },
      { playerId: "Connor", card: 1 },
      { playerId: "David", card: 6 },
      { playerId: "Eve", card: 42 },
    ];
    const result = calculateTrickTaker(played, playerIds);
    expect(result.winnerId).toBe("David");
    expect(result.winningCard).toBe(6);
    expect(result.hasSpecialPower).toBe(false);
  });

  it("Player with a highest card wins (tied suits)", () => {
    const played: PlayedCard[] = [
      { playerId: "David", card: 53 },
      { playerId: "Eve", card: 11 },
      { playerId: "Anna", card: 13 },
      { playerId: "Beth", card: 8 },
      { playerId: "Connor", card: 51 },
    ];
    const result = calculateTrickTaker(played, playerIds);
    expect(result.winnerId).toBe("David");
    expect(result.winningCard).toBe(53);
  });

  it("single card trick is won by the only player", () => {
    const played: PlayedCard[] = [{ playerId: "Anna", card: 5 }];
    const result = calculateTrickTaker(played, playerIds);
    expect(result.winnerId).toBe("Anna");
  });

  it("detects special power when highest suit card wins", () => {
    // orange max is 10
    const played: PlayedCard[] = [
      { playerId: "Anna", card: 10 },
      { playerId: "Beth", card: 7 },
      { playerId: "Connor", card: 9 },
    ];
    const result = calculateTrickTaker(played, ["Anna", "Beth"]);
    expect(result.winnerId).toBe("Anna");
    expect(result.hasSpecialPower).toBe(true);
  });

  it("no special power when highest suit card is not played", () => {
    const played: PlayedCard[] = [
      { playerId: "Anna", card: 9 },
      { playerId: "Beth", card: 7 },
    ];
    const result = calculateTrickTaker(played, ["Anna", "Beth"]);
    expect(result.winnerId).toBe("Anna");
    expect(result.hasSpecialPower).toBe(false);
  });
});

describe("validateCardPlay", () => {
  function makeState(
    hand0: number[],
    trickCards: PlayedCard[] = [],
  ): GameState {
    return {
      gameId: 1,
      phase: "trick-playing",
      players: [
        {
          id: "p0",
          name: "P0",
          isBot: false,
          hand: hand0,
          tricksTakenPerRound: 0,
        },
        {
          id: "p1",
          name: "P1",
          isBot: false,
          hand: [12, 13],
          tricksTakenPerRound: 0,
        },
      ],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: trickCards, startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
  }

  it("allows any card when trick is empty (not the first trick)", () => {
    // tricksTakenPerRound > 0 means at least one trick has been resolved — not the first trick
    const state = makeState([0, 11, 21]);
    const laterState: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, tricksTakenPerRound: 1 } : p,
      ),
    };
    expect(validateCardPlay("p0", 0, laterState).valid).toBe(true);
    expect(validateCardPlay("p0", 11, laterState).valid).toBe(true);
  });

  it("rejects card not in hand", () => {
    const state = makeState([5, 6]);
    expect(validateCardPlay("p0", 99, state).valid).toBe(false);
  });

  it("enforces suit matching when player has matching suit", () => {
    // Trick started with orange card; p0 has an orange card and a red card
    const state = makeState([5, 11], [{ playerId: "p1", card: 3 }]);
    expect(validateCardPlay("p0", 5, state).valid).toBe(true); // orange ✓
    expect(validateCardPlay("p0", 11, state).valid).toBe(false); // red ✗
  });

  it("allows any card when player has no matching suit", () => {
    // Trick started with orange; p0 has only red and gray
    const state = makeState([11, 22], [{ playerId: "p1", card: 3 }]);
    expect(validateCardPlay("p0", 11, state).valid).toBe(true);
    expect(validateCardPlay("p0", 22, state).valid).toBe(true);
  });

  it("rejects play when it is not the player's turn", () => {
    const state = makeState([5, 6]);
    expect(validateCardPlay("p1", 12, state).valid).toBe(false);
  });

  it("allows matching either suit when two suits in trick", () => {
    // Orange + red already played; p0 has orange and red
    const trickCards: PlayedCard[] = [
      { playerId: "ignored", card: 3 }, // orange
      { playerId: "ignored2", card: 11 }, // red
    ];
    const state = makeState([5, 11], trickCards);
    expect(validateCardPlay("p0", 5, state).valid).toBe(true);
    expect(validateCardPlay("p0", 11, state).valid).toBe(true);
  });
});

describe("getValidCards", () => {
  it("returns full hand when trick is empty (non-first trick)", () => {
    const state: GameState = {
      gameId: 1,
      phase: "trick-playing",
      players: [
        {
          id: "p0",
          name: "P0",
          isBot: false,
          hand: [0, 11, 21],
          tricksTakenPerRound: 1,
        },
      ],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: [], startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
    expect(getValidCards("p0", state)).toEqual([0, 11, 21]);
  });
});

describe("first trick of the game", () => {
  function makeGameOpenState(
    p0Hand: number[],
    p1Hand: number[],
    leadIdx = 0,
  ): GameState {
    return {
      gameId: 1,
      phase: "trick-playing",
      players: [
        {
          id: "p0",
          name: "P0",
          isBot: false,
          hand: p0Hand,
          tricksTakenPerRound: 0,
        },
        {
          id: "p1",
          name: "P1",
          isBot: false,
          hand: p1Hand,
          tricksTakenPerRound: 0,
        },
      ],
      currentRound: 1,
      currentPlayerIndex: leadIdx,
      currentTrick: { playedCards: [], startingPlayerIndex: leadIdx },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
  }

  it("restricts the holder of card 0 to only card 0 on the very first play", () => {
    const state = makeGameOpenState([0, 11, 21], [12, 13]);
    expect(getValidCards("p0", state)).toEqual([0]);
  });

  it("returns empty for a player without card 0 when it is the first play", () => {
    // p0 leads but doesn't hold card 0 — invalid configuration, no valid cards
    const state = makeGameOpenState([11, 21], [0, 12]);
    expect(getValidCards("p0", state)).toEqual([]);
  });

  it("only card 0 is valid to play via validateCardPlay on the first play", () => {
    const state = makeGameOpenState([0, 11], [12, 13]);
    expect(validateCardPlay("p0", 0, state).valid).toBe(true);
    expect(validateCardPlay("p0", 11, state).valid).toBe(false);
  });

  it("normal rules apply after card 0 has been played", () => {
    // After card 0 is played, p1 follows normally
    const state: GameState = {
      gameId: 1,
      phase: "trick-playing",
      players: [
        {
          id: "p0",
          name: "P0",
          isBot: false,
          hand: [11, 21],
          tricksTakenPerRound: 0,
        },
        {
          id: "p1",
          name: "P1",
          isBot: false,
          hand: [12, 13],
          tricksTakenPerRound: 0,
        },
      ],
      currentRound: 1,
      currentPlayerIndex: 1,
      currentTrick: {
        playedCards: [{ playerId: "p0", card: 0 }],
        startingPlayerIndex: 0,
      },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
    // p1 has no orange cards (12, 13 are red), so any card is valid
    expect(getValidCards("p1", state)).toEqual([12, 13]);
  });

  it("first-trick restriction should apply in later rounds", () => {
    function withState(hand: number[]): GameState {
      return {
        gameId: 1,
        phase: "trick-playing",
        players: [
          {
            id: "p0",
            name: "P0",
            isBot: false,
            hand,
            tricksTakenPerRound: 0,
          },
        ],
        currentRound: 2,
        currentPlayerIndex: 0,
        currentTrick: { playedCards: [], startingPlayerIndex: 0 },
        roundResults: [
          { round: 1, scores: [{ playerId: "p0", tricksTaken: 5 }] },
        ],
        awaitingLeaderSelection: false,
      };
    }

    const stateWoZero = withState([11, 21]);
    const validCardsWoZero = getValidCards("p0", stateWoZero);
    expect(validCardsWoZero).toEqual([]);

    const stateWithZero = withState([11, 21, 0]);
    const validCardsWithZero = getValidCards("p0", stateWithZero);
    expect(validCardsWithZero).toEqual([0]);
  });
});
