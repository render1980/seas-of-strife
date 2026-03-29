import { describe, expect, it } from "bun:test";
import { ALL_CARDS, getSuitFromCard, isHighestCardOfSuit } from "../../src/game/cards";

describe("Card definitions", () => {
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