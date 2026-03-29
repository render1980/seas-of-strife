import { describe, expect, it } from "bun:test";
import { calculateRoundScores, calculateRoundWinners, dealCards } from "../../src/game/round";
import type { PlayerState, RoundResult } from "../../src/types/types";

function makePlayers(count: number): PlayerState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    isBot: false,
    hand: [],
    tricksTakenPerRound: 0,
  }));
}

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
    expect(updatedPlayers[startingPlayerIndex]!.hand).toContain(0);
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

describe("calculateRoundScores", () => {
  it("calculates scores based on tricks taken", () => {
    const players = makePlayers(4).map((p, i) => ({ ...p, tricksTakenPerRound: i }));
    const result = calculateRoundScores(1, players);
    expect(result.round).toBe(1);
    expect(result.scores).toEqual([
      { playerId: "player-0", tricksTaken: 0 },
      { playerId: "player-1", tricksTaken: 1 },
      { playerId: "player-2", tricksTaken: 2 },
      { playerId: "player-3", tricksTaken: 3 },
    ]);
  });  
});

describe("calculateRoundWinners", () => {
  it("returns top N players ranked by tricks taken", () => {
    const players = makePlayers(5).map((p, i) => ({ ...p, tricksTakenPerRound: i }));
    const roundResults = [] as RoundResult[];
    const winners = calculateRoundWinners(players, roundResults, 3);
    expect(winners.length).toBe(3);
    expect(winners[0]!.playerId).toBe("player-0");
    expect(winners[1]!.playerId).toBe("player-1");
    expect(winners[2]!.playerId).toBe("player-2");
  });
});