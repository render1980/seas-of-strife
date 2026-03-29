import { describe, expect, it, spyOn } from "bun:test";
import { GameRegistry } from "../../src/game/GameRegistry";
import type { GameState } from "../../src/types/types";

class GameRepositoryNoop {
  async saveGameState(state: GameState): Promise<void> {
    return Promise.resolve();
  }

  async loadGameState(gameId: number): Promise<GameState | null> {
    return Promise.resolve(null);
  }

  async saveRoundResult(
    gameId: number,
    roundNumber: number,
    roundResult: any,
  ): Promise<void> {
    return Promise.resolve();
  }

  async saveGameResults(
    gameId: number,
    realPlayerIds: string[],
    winners: any[],
  ): Promise<void> {
    return Promise.resolve();
  }
}

describe("GameRegistry", () => {
  it("create new game with the same id once", async () => {
    const persistService = new GameRepositoryNoop();
    const saveGameStateSpy = spyOn(persistService, "saveGameState");
    const gameRegistry = new GameRegistry(persistService);
    const newGame = await gameRegistry.createGame(1, []);

    expect(saveGameStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 1 }),
    );
    expect(newGame).toBeDefined();
    expect(gameRegistry.listActiveGames()).toContain(1);
    // fails to create a game with the same id
    await expect(gameRegistry.createGame(1, [])).rejects.toThrow();
  });

  it("get a game that exists in memory", async () => {
    const persistService = new GameRepositoryNoop();
    const gameRegistry = new GameRegistry(persistService);
    const newGame = await gameRegistry.createGame(1, []);
    expect(newGame).toBeDefined();
    expect(gameRegistry.listActiveGames()).toContain(1);

    const loadedGame = await gameRegistry.getOrLoadGame(1);
    expect(loadedGame).toBe(newGame);
  });

  it("get a game that does not exist in memory from database", async () => {
    const gameRegistryService = new GameRepositoryNoop();
    const loadGameStateSpy = spyOn(
      gameRegistryService,
      "loadGameState",
    ).mockResolvedValue({
      gameId: 2,
      phase: "waiting",
      players: [],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentTrick: {
        playedCards: [],
        startingPlayerIndex: 0,
      },
      roundResults: [],
      awaitingLeaderSelection: false,
    });
    const gameRegistry = new GameRegistry(gameRegistryService);

    const loadedGame = await gameRegistry.getOrLoadGame(2);
    expect(loadGameStateSpy).toHaveBeenCalledWith(2);
    expect(loadedGame).toBeDefined();
    expect(loadedGame?.getGameState().gameId).toBe(2);
    expect(gameRegistry.listActiveGames()).toContain(2);
  });
});
