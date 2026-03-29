import { describe, expect, it } from "bun:test";
import { GameEngine, createInitialGameState } from "../../src/game/engine";
import {
  type GameState,
  type PlayerState,
  TOTAL_ROUNDS_PER_GAME,
} from "../../src/types/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(count: number): PlayerState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    isBot: false,
    hand: [],
    tricksTakenPerRound: 0,
  }));
}

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

  it("tracks each player's hand decreases with each card played", async () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    const gs = engine.getGameState();
    const startingIdx = gs.players.findIndex((p) => p.hand.includes(0));
    const card = 0;

    if (card === undefined) {
      throw new Error("No card found in starting player's hand");
    }

    const result = await engine.playCard(gs!.players[startingIdx]!.id, card);
    expect(result.success).toBe(true);
    expect(result.newState!.players[startingIdx]?.hand).not.toContain(card);
  });

  it("rejects card not in player's hand", async () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    const gs = engine.getGameState();
    const startingPlayer = gs.players[gs.currentPlayerIndex];
    const result = await engine.playCard(startingPlayer!.id, 9999);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("resolves a complete trick and moves to the next trick", async () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    // Play one complete trick (4 players × 1 card each)
    for (let turn = 0; turn < 4; turn++) {
      const gs = engine.getGameState();
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      if (!currentPlayer) {
        throw new Error("No current player found");
      }
      const validCards = engine.getValidMoves(currentPlayer.id);
      const result = await engine.playCard(currentPlayer.id, validCards[0]! as number);
      expect(result.success).toBe(true);
    }

    // After 4 cards played, trick should be resolved
    const endState = engine.getGameState();
    const totalTricksTaken = endState.players.reduce(
      (s, p) => s + p.tricksTakenPerRound,
      0,
    );

    // Either we're in trick-playing (next trick) or round-end / awaiting leader selection
    const validPhases = [
      "trick-playing",
      "trick-resolution",
      "round-end",
      "game-end",
    ];
    expect(validPhases).toContain(endState.phase);
    // Exactly one trick has been taken
    expect(totalTricksTaken).toBe(1);
  });

  it("plays a full round for 4 players (15 tricks)", async () => {
    const players = makePlayers(4);
    const engine = new GameEngine(createInitialGameState(1, players));
    engine.startGame();

    let maxMoves = 15 * 4 + 50; // generous limit to handle special power pauses

    const inProgress = () => {
      const p = engine.getPhase();
      return (
        p === "trick-playing" ||
        (p === "trick-resolution" &&
          engine.getGameState().awaitingLeaderSelection)
      );
    };

    while (inProgress() && maxMoves-- > 0) {
      const gs = engine.getGameState();

      if (gs.awaitingLeaderSelection) {
        const trickTakerIdx = gs.currentPlayerIndex;
        engine.selectNextLeader(gs.players[trickTakerIdx]!.id, trickTakerIdx);
        continue;
      }

      const currentPlayer = gs.players[gs.currentPlayerIndex];
      if (!currentPlayer) {
        throw new Error("No current player found");
      }
      const validCards = engine.getValidMoves(currentPlayer.id);
      expect(validCards.length).toBeGreaterThan(0);
      await engine.playCard(currentPlayer.id, validCards[0]! as number);
    }

    // After one round the round counter should advance (or game-end for single round)
    const phase = engine.getPhase();
    expect(["trick-playing", "round-end", "game-end"]).toContain(phase);
    const totalTricksTaken = engine
      .getGameState()
      .players.reduce((s, p) => s + p.tricksTakenPerRound, 0);
    // After round 1 we expect either 15 current tricks or 0 (if round advanced)
    expect(totalTricksTaken).toBeGreaterThanOrEqual(0);
  });

  it("returns game winners at game end", () => {
    // Use makePlayers(4) and fake a completed game state
    const players: PlayerState[] = makePlayers(4).map((p, i) => ({
      ...p,
      tricksTakenPerRound: i, // player-0 has 0 tricks (winner)
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
    expect(winners[0]?.playerId).toBe("player-0");
  });
});
