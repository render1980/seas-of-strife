import { GameEngine, type IPersistService } from "./engine";
import { gameStateLoader } from "../db/GameStateLoader";
import type { GameState, PlayerState } from "../types";

/**
 * GameRegistry manages active game instances.
 * Maintains an in-memory map of games and handles loading from persistence.
 * Supports single- or multi-server deployments.
 */
export class GameRegistry {
  private activeGames: Map<number, GameEngine> = new Map();
  private persistService: IPersistService;

  constructor(persistService: IPersistService) {
    this.persistService = persistService;
  }

  /**
   * Create a new game and add it to the registry.
   */
  createGame(gameId: number, players: PlayerState[]): GameEngine {
    // Check if game already exists
    if (this.activeGames.has(gameId)) {
      throw new Error(`Game ${gameId} already exists`);
    }

    // Create initial game state
    const initialState: GameState = {
      gameId,
      phase: "waiting",
      players,
      currentRound: 0,
      currentPlayerIndex: 0,
      currentTrick: {
        playedCards: [],
        startingPlayerIndex: 0,
      },
      roundResults: [],
      awaitingLeaderSelection: false,
    };

    // Create engine with persistence
    const engine = new GameEngine(initialState, this.persistService);

    // Add to registry
    this.activeGames.set(gameId, engine);

    return engine;
  }

  /**
   * Get or load a game from the registry.
   * If game is in memory, return it immediately.
   * If game is not in memory, try to load from database.
   * Returns null if game not found anywhere.
   */
  async getOrLoadGame(gameId: number): Promise<GameEngine | null> {
    // Check if game is active in memory
    if (this.activeGames.has(gameId)) {
      return this.activeGames.get(gameId)!;
    }

    // Try to load from database
    const gameState = await gameStateLoader.loadGameState(gameId);
    if (!gameState) {
      return null;
    }

    // Create engine with loaded state
    const engine = new GameEngine(gameState, this.persistService);

    // Add to registry for future access
    this.activeGames.set(gameId, engine);

    return engine;
  }

  /**
   * Get a game if it's active in memory.
   * Returns null if not found (doesn't try to load from DB).
   */
  getGame(gameId: number): GameEngine | null {
    return this.activeGames.get(gameId) || null;
  }

  /**
   * Remove a game from the registry (after cleanup/archival).
   */
  removeGame(gameId: number): void {
    this.activeGames.delete(gameId);
  }

  /**
   * Get all active games in memory.
   * Useful for admin/debugging.
   */
  listActiveGames(): number[] {
    return Array.from(this.activeGames.keys());
  }

  /**
   * Clear all games from memory.
   * Useful for testing or shutdown.
   */
  clearAll(): void {
    this.activeGames.clear();
  }
}
