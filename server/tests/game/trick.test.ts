import { describe, it, expect } from "bun:test";
import { calculateTrickWinner } from "../../src/game/trick";
import type { PlayedCard } from "../../src/types/types";

// ---------------------------------------------------------------------------
// Trick Resolution
// ---------------------------------------------------------------------------

describe("calculateTrickWinner", () => {
  const playerIds = ["Anna", "Beth", "Connor", "David", "Eve"];

  it("Example 1 from rules: David wins with orange 6", () => {
    const played: PlayedCard[] = [
      { playerId: "Anna",   card: 0  },
      { playerId: "Beth",   card: 2  },
      { playerId: "Connor", card: 1  },
      { playerId: "David",  card: 6  },
      { playerId: "Eve",    card: 42 },
    ];
    const result = calculateTrickWinner(played, playerIds);
    expect(result.winnerId).toBe("David");
    expect(result.winningCard).toBe(6);
    expect(result.hasSpecialPower).toBe(false);
  });

  it("Example 2 from rules: David wins with purple 53 (tied suits)", () => {
    const played: PlayedCard[] = [
      { playerId: "David",  card: 53 },
      { playerId: "Eve",    card: 11 },
      { playerId: "Anna",   card: 13 },
      { playerId: "Beth",   card: 8  },
      { playerId: "Connor", card: 51 },
    ];
    const result = calculateTrickWinner(played, playerIds);
    expect(result.winnerId).toBe("David");
    expect(result.winningCard).toBe(53);
  });

  it("single card trick is won by the only player", () => {
    const played: PlayedCard[] = [{ playerId: "Anna", card: 5 }];
    const result = calculateTrickWinner(played, playerIds);
    expect(result.winnerId).toBe("Anna");
  });

  it("detects special power when highest suit card wins", () => {
    // orange max is 10
    const played: PlayedCard[] = [
      { playerId: "Anna", card: 10 },
      { playerId: "Beth", card: 7  },
    ];
    const result = calculateTrickWinner(played, ["Anna", "Beth"]);
    expect(result.winnerId).toBe("Anna");
    expect(result.hasSpecialPower).toBe(true);
  });

  it("no special power when highest suit card is not played", () => {
    const played: PlayedCard[] = [
      { playerId: "Anna", card: 9  },
      { playerId: "Beth", card: 7  },
    ];
    const result = calculateTrickWinner(played, ["Anna", "Beth"]);
    expect(result.winnerId).toBe("Anna");
    expect(result.hasSpecialPower).toBe(false);
  });
});
