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
        { id: "bot-0", name: "Bot", isBot: true, hand, tricksTakenPerRound: 0 },
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

  it("plays zero in the first trick of every round if it has", () => {
    const hand = [0, 11, 21];
    const state = makeStateWithHand(hand);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(card).toBe(0);
  });

  it("follows suit when required", () => {
    // orange cards in trick; bot has orange AND red — must play orange
    const hand = [5, 11]; // orange 5, red 11
    const state = makeStateWithHand(hand, [{ playerId: "other", card: 3 }]);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(getSuitFromCard(card)).toBe("orange");
  });

  it("follow either of suites when there are more than one suit played in the trick", () => {
    // orange and red cards in trick; bot has two orange and one red — must play any of them
    const hand = [5, 6, 11]; // orange 5 & 6, red 11
    const trickCards: PlayedCard[] = [
      { playerId: "played", card: 3 }, // orange
      { playerId: "played2", card: 11 }, // red
    ];
    const state = makeStateWithHand(hand, trickCards);
    const card = BotPlayer.decideMove("bot-0", state);
    // expect either orange or red card to be played
    expect(hand).toContain(card);
  });

  it("plays any card when no matching suit", () => {
    // orange in trick; bot has only red and gray
    const hand = [11, 22];
    const state = makeStateWithHand(hand, [{ playerId: "other", card: 3 }]);
    const card = BotPlayer.decideMove("bot-0", state);
    expect(hand).toContain(card);
  });

  // any other test cases??
  it("plays valid cards across multiple turns", async () => {
    const hand = [0, 11, 21, 31, 41];
    const state = makeStateWithHand(hand);
    let maxMoves = hand.length;
    const engine = {
      getGameState: () => state,
      getPhase: () => "trick-playing",
      getValidMoves: (playerId: string) => {
        if (playerId !== "bot-0") return [];
        // For testing, just return the bot's current hand as valid moves
        return state.players[0]!.hand;
      },
      playCard: async (playerId: string, card: number) => {
        if (playerId !== "bot-0") return { success: false };
        // Simulate playing the card by removing it from the bot's hand
        const player = state.players[0]!;
        player.hand = player.hand.filter((c) => c !== card);
        // Add to current trick
        state.currentTrick.playedCards.push({ playerId, card });
        return { success: true, newState: state };
      },
    };

    while (maxMoves-- > 0) {
      const card = BotPlayer.decideMove("bot-0", engine.getGameState());
      expect(hand).toContain(card);
      const result = await engine.playCard("bot-0", card);
      expect(result.success).toBe(true);
    }

    // After playing all cards, bot's hand should be empty
    expect(state.players[0]!.hand.length).toBe(0);
  });
});
