import { describe, expect, it } from "bun:test";
import { dealCards } from "../../src/game/round";
import type { PlayerState } from "../../src/types/types";

function makePlayers(count: number): PlayerState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    isBot: false,
    hand: [],
    tricksTaken: 0,
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