import { gameRepository } from "./repositories/GameRepository";
import type { GameState } from "../types";

/**
 * GameStateLoader handles deserialization and recovery of game state from the database.
 */
export class GameStateLoader {
  /**
   * Load and deserialize a game state from the database.
   * Handles type safety and validation.
   */
  async loadGameState(gameId: number): Promise<GameState | null> {
    try {
      const gameState = await gameRepository.loadGameState(gameId);
      
      if (!gameState) {
        return null;
      }

      // Validate that the loaded state has required fields
      if (
        !gameState.gameId ||
        !gameState.phase ||
        !gameState.players ||
        !gameState.currentTrick
      ) {
        console.error(`Invalid game state structure for gameId ${gameId}`);
        return null;
      }

      return gameState;
    } catch (error) {
      console.error(`Failed to load game state for gameId ${gameId}:`, error);
      return null;
    }
  }
}

export const gameStateLoader = new GameStateLoader();
