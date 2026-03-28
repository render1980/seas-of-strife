import { describe, expect, it } from "bun:test";
import { BotPlayer } from "../../src/bot/ai";
import { getSuitFromCard } from "../../src/game/cards";
import { type GameState, type PlayedCard } from "../../src/types/types";

describe("BotPlayer", () => {
  function makeStateWithHand(
    hand: number[],
    trickCards: PlayedCard[] = [],
  ): GameState {
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
