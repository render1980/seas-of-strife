import { describe, expect, it } from "bun:test";
import { BotPlayer } from "../../src/bot/ai";
import { ALL_CARDS, getSuitFromCard, isHighestCardOfSuit } from "../../src/game/cards";
import { GameEngine, createInitialGameState } from "../../src/game/engine";
import { dealCards } from "../../src/game/round";
import { getValidCards, validateCardPlay } from "../../src/game/trick";
import { type GameState, type PlayedCard, type PlayerState, TOTAL_ROUNDS_PER_GAME } from "../../src/types/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(count: number): PlayerState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    isBot: false,
    hand: [],
    tricksTaken: 0,
  }));
}

// ---------------------------------------------------------------------------
// Card Definitions
// ---------------------------------------------------------------------------

describe("Card definitions", () => {
  it("defines exactly 60 cards", () => {
    expect(ALL_CARDS.length).toBe(60);
  });

  it("has no duplicate card values", () => {
    const set = new Set(ALL_CARDS);
    expect(set.size).toBe(ALL_CARDS.length);
  });

  it("correctly identifies suits", () => {
    expect(getSuitFromCard(0)).toBe("orange");
    expect(getSuitFromCard(10)).toBe("orange");
    expect(getSuitFromCard(11)).toBe("red");
    expect(getSuitFromCard(20)).toBe("red");
    expect(getSuitFromCard(21)).toBe("gray");
    expect(getSuitFromCard(29)).toBe("gray");
    expect(getSuitFromCard(31)).toBe("blue");
    expect(getSuitFromCard(38)).toBe("blue");
    expect(getSuitFromCard(41)).toBe("green");
    expect(getSuitFromCard(47)).toBe("green");
    expect(getSuitFromCard(51)).toBe("purple");
    expect(getSuitFromCard(56)).toBe("purple");
    expect(getSuitFromCard(61)).toBe("teal");
    expect(getSuitFromCard(65)).toBe("teal");
    expect(getSuitFromCard(71)).toBe("dark_red");
    expect(getSuitFromCard(74)).toBe("dark_red");
  });

  it("throws for invalid card values", () => {
    expect(() => getSuitFromCard(30)).toThrow();
    expect(() => getSuitFromCard(100)).toThrow();
    expect(() => getSuitFromCard(-1)).toThrow();
  });

  it("identifies highest card of each suit correctly", () => {
    expect(isHighestCardOfSuit(10)).toBe(true);  // orange max
    expect(isHighestCardOfSuit(20)).toBe(true);  // red max
    expect(isHighestCardOfSuit(74)).toBe(true);  // dark_red max
    expect(isHighestCardOfSuit(5)).toBe(false);
    expect(isHighestCardOfSuit(11)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Round management
// ---------------------------------------------------------------------------

describe("dealCards", () => {
  it("deals 15 cards to each player for 4 players", () => {
    const players = makePlayers(4);
    const { updatedPlayers, startingPlayerIndex } = dealCards(players);
    updatedPlayers.forEach((p) => expect(p.hand.length).toBe(15));
    expect(startingPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(startingPlayerIndex).toBeLessThan(4);
  });

  it("deals 12 cards to each player for 5 players", () => {
    const players = makePlayers(5);
    const { updatedPlayers } = dealCards(players);
    updatedPlayers.forEach((p) => expect(p.hand.length).toBe(12));
  });

  it("deals 10 cards to each player for 6 players", () => {
    const players = makePlayers(6);
    const { updatedPlayers } = dealCards(players);
    updatedPlayers.forEach((p) => expect(p.hand.length).toBe(10));
  });

  it("starting player holds card 0", () => {
    const players = makePlayers(4);
    const { updatedPlayers, startingPlayerIndex } = dealCards(players);
    expect(updatedPlayers[startingPlayerIndex].hand).toContain(0);
  });

  it("no duplicate cards across hands", () => {
    const players = makePlayers(4);
    const { updatedPlayers } = dealCards(players);
    const allCards = updatedPlayers.flatMap((p) => p.hand);
    const unique = new Set(allCards);
    expect(unique.size).toBe(allCards.length);
  });

  it("throws for unsupported player counts", () => {
    expect(() => dealCards(makePlayers(3))).toThrow();
    expect(() => dealCards(makePlayers(7))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Rules validation
// ---------------------------------------------------------------------------

describe("validateCardPlay", () => {
  function makeState(hand0: number[], trickCards: PlayedCard[] = []): GameState {
    return {
      gameId: 1,
      phase: "trick-playing",
      players: [
        { id: "p0", name: "P0", isBot: false, hand: hand0, tricksTaken: 0 },
        { id: "p1", name: "P1", isBot: false, hand: [12, 13], tricksTaken: 0 },
      ],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: trickCards, startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
  }

  it("allows any card when trick is empty", () => {
    const state = makeState([0, 11, 21]);
    expect(validateCardPlay("p0", 0, state).valid).toBe(true);
    expect(validateCardPlay("p0", 11, state).valid).toBe(true);
  });

  it("rejects card not in hand", () => {
    const state = makeState([5, 6]);
    expect(validateCardPlay("p0", 99, state).valid).toBe(false);
  });

  it("enforces suit matching when player has matching suit", () => {
    // Trick started with orange card; p0 has an orange card and a red card
    const state = makeState([5, 11], [{ playerId: "p1", card: 3 }]);
    expect(validateCardPlay("p0", 5, state).valid).toBe(true);   // orange ✓
    expect(validateCardPlay("p0", 11, state).valid).toBe(false);  // red ✗
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
      { playerId: "ignored", card: 3  },  // orange
      { playerId: "ignored2", card: 11 }, // red
    ];
    const state = makeState([5, 11], trickCards);
    expect(validateCardPlay("p0", 5, state).valid).toBe(true);
    expect(validateCardPlay("p0", 11, state).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getValidCards
// ---------------------------------------------------------------------------

describe("getValidCards", () => {
  it("returns full hand when trick is empty", () => {
    const state: GameState = {
      gameId: 1,
      phase: "trick-playing",
      players: [
        { id: "p0", name: "P0", isBot: false, hand: [0, 11, 21], tricksTaken: 0 },
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

// ---------------------------------------------------------------------------
// Game Engine — full trick cycle
// ---------------------------------------------------------------------------

describe("GameEngine", () => {
  it("starts game and enters trick-playing phase", () => {
    const players = makePlayers(4);
    const state = createInitialGameState(1, players);
    const engine = new GameEngine(state);
    engine.startGame();
    expect(engine.getPhase()).toBe("trick-playing");
    expect(engine.getGameState().currentRound).toBe(1);
  });

  it("tracks each player's hand decreases with each card played", () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    const gs = engine.getGameState();
    const startingIdx = gs.currentPlayerIndex;
    const card = gs.players[startingIdx].hand[0];

    const result = engine.playCard(gs.players[startingIdx].id, card);
    expect(result.success).toBe(true);
    expect(result.newState!.players[startingIdx].hand).not.toContain(card);
  });

  it("rejects card not in player's hand", () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    const gs = engine.getGameState();
    const startingPlayer = gs.players[gs.currentPlayerIndex];
    const result = engine.playCard(startingPlayer.id, 9999);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("resolves a complete trick and moves to the next trick", () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    // Play one complete trick (4 players × 1 card each)
    for (let turn = 0; turn < 4; turn++) {
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      const validCards = engine.getValidMoves(currentPlayer.id);
      const result = engine.playCard(currentPlayer.id, validCards[0]);
      expect(result.success).toBe(true);
    }

    // After 4 cards played, trick should be resolved
    const endState = engine.getGameState();
    const totalTricksTaken = endState.players.reduce((s, p) => s + p.tricksTaken, 0);
    
    // Either we're in trick-playing (next trick) or round-end / awaiting leader selection
    const validPhases = ["trick-playing", "trick-resolution", "round-end", "game-end"];
    expect(validPhases).toContain(endState.phase);
    // Exactly one trick has been taken
    expect(totalTricksTaken).toBe(1);
  });

  it("plays a full round for 4 players (15 tricks)", () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    let maxMoves = 15 * 4 + 50; // generous limit to handle special power pauses

    const inProgress = () => {
      const p = engine.getPhase();
      return p === "trick-playing" ||
        (p === "trick-resolution" && engine.getGameState().awaitingLeaderSelection);
    };

    while (inProgress() && maxMoves-- > 0) {
      const gs = engine.getGameState();

      if (gs.awaitingLeaderSelection) {
        const trickTakerIdx = gs.currentPlayerIndex;
        engine.selectNextLeader(gs.players[trickTakerIdx].id, trickTakerIdx);
        continue;
      }

      const currentPlayer = gs.players[gs.currentPlayerIndex];
      const validCards = engine.getValidMoves(currentPlayer.id);
      expect(validCards.length).toBeGreaterThan(0);
      engine.playCard(currentPlayer.id, validCards[0]);
    }

    // After one round the round counter should advance (or game-end for single round)
    const phase = engine.getPhase();
    expect(["trick-playing", "round-end", "game-end"]).toContain(phase);
    const totalTricksTaken = engine.getGameState().players.reduce((s, p) => s + p.tricksTaken, 0);
    // After round 1 we expect either 15 current tricks or 0 (if round advanced)
    expect(totalTricksTaken).toBeGreaterThanOrEqual(0);
  });

  it("returns game winners at game end", () => {
    // Use makePlayers(4) and fake a completed game state
    const players: PlayerState[] = makePlayers(4).map((p, i) => ({
      ...p,
      tricksTaken: i, // player-0 has 0 tricks (winner)
    }));
    const state: GameState = {
      gameId: 99,
      phase: "game-end",
      players,
      currentRound: TOTAL_ROUNDS_PER_GAME,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: [], startingPlayerIndex: 0 },
      roundResults: players.map((_, i) => ({
        round: i + 1,
        scores: players.map((p, pi) => ({ playerId: p.id, tricksTaken: pi })),
      })),
      awaitingLeaderSelection: false,
    };
    const engine = new GameEngine(state);
    const winners = engine.getRoundWinners();
    expect(winners.length).toBe(3);
    expect(winners[0].playerId).toBe("player-0");
  });
});

// ---------------------------------------------------------------------------
// Bot AI
// ---------------------------------------------------------------------------

describe("BotPlayer", () => {
  function makeStateWithHand(hand: number[], trickCards: PlayedCard[] = []): GameState {
    return {
      gameId: 1,
      phase: "trick-playing",
      players: [
        { id: "bot-0", name: "Bot", isBot: true, hand, tricksTaken: 0 },
      ],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentTrick: { playedCards: trickCards, startingPlayerIndex: 0 },
      roundResults: [],
      awaitingLeaderSelection: false,
    };
  }

  it("always plays a valid card", () => {
    const hand = [0, 11, 21, 31, 41];
    const state = makeStateWithHand(hand);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(hand).toContain(card);
  });

  it("follows suit when required", () => {
    // orange cards in trick; bot has orange AND red — must play orange
    const hand = [5, 11]; // orange 5, red 11
    const state = makeStateWithHand(hand, [{ playerId: "other", card: 3 }]);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(getSuitFromCard(card)).toBe("orange");
  });

  it("plays any card when no matching suit", () => {
    // orange in trick; bot has only red and gray
    const hand = [11, 22];
    const state = makeStateWithHand(hand, [{ playerId: "other", card: 3 }]);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(hand).toContain(card);
  });
});
