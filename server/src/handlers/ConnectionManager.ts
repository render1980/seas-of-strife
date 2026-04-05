import type { GameRegistry } from "../game/GameRegistry";

/**
 * Represents a player's connection state in a game.
 */
interface PlayerConnection {
  gameId: number;
  playerId: string;
  isConnected: boolean;
  disconnectTime?: number;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Callback invoked after auto-play completes so the caller can broadcast results.
 */
export type OnAutoPlayCallback = (
  gameId: number,
  playerId: string,
) => Promise<void>;

/**
 * ConnectionManager tracks player connections and handles disconnection timeouts.
 * Fires auto-play after 30 seconds of inactivity.
 */
export class ConnectionManager {
  private connections: Map<string, PlayerConnection> = new Map();
  private gameRegistry: GameRegistry;
  private readonly DISCONNECT_TIMEOUT_MS = 30000; // 30 seconds
  private onAutoPlay?: OnAutoPlayCallback;

  constructor(gameRegistry: GameRegistry) {
    this.gameRegistry = gameRegistry;
  }

  /**
   * Register a callback that fires after auto-play
   * so the GameManager can broadcast results.
   */
  setOnAutoPlay(cb: OnAutoPlayCallback): void {
    this.onAutoPlay = cb;
  }

  /**
   * Mark a player as connected.
   */
  playerConnected(gameId: number, playerId: string): void {
    const key = this.getConnectionKey(gameId, playerId);
    const connection = this.connections.get(key);

    if (connection) {
      // Clear any pending disconnect timeout
      if (connection.timeoutHandle) {
        clearTimeout(connection.timeoutHandle);
      }
      connection.isConnected = true;
      connection.disconnectTime = undefined;
      connection.timeoutHandle = undefined;
    } else {
      this.connections.set(key, {
        gameId,
        playerId,
        isConnected: true,
      });
    }
  }

  /**
   * Mark a player as disconnected.
   * Starts a 30-second timer; if no reconnection, fires auto-play.
   */
  playerDisconnected(gameId: number, playerId: string): void {
    const key = this.getConnectionKey(gameId, playerId);
    let connection = this.connections.get(key);

    if (!connection) {
      connection = {
        gameId,
        playerId,
        isConnected: false,
        disconnectTime: Date.now(),
      };
      this.connections.set(key, connection);
    } else {
      connection.isConnected = false;
      connection.disconnectTime = Date.now();
    }

    // Clear any existing timeout
    if (connection.timeoutHandle) {
      clearTimeout(connection.timeoutHandle);
    }

    // Set new timeout for auto-play
    connection.timeoutHandle = setTimeout(() => {
      this.handleDisconnectTimeout(gameId, playerId);
    }, this.DISCONNECT_TIMEOUT_MS);
  }

  /**
   * Get the current connection status for a player.
   */
  isConnected(gameId: number, playerId: string): boolean {
    const key = this.getConnectionKey(gameId, playerId);
    const connection = this.connections.get(key);
    return connection?.isConnected ?? false;
  }

  /**
   * Clean up all connections for a game (when game ends).
   */
  cleanupGame(gameId: number): void {
    const keysToDelete: string[] = [];
    for (const [key, conn] of this.connections) {
      if (conn.gameId === gameId) {
        if (conn.timeoutHandle) {
          clearTimeout(conn.timeoutHandle);
        }
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((k) => this.connections.delete(k));
  }

  /**
   * Remove all connections (for cleanup/testing).
   */
  clearAll(): void {
    for (const conn of this.connections.values()) {
      if (conn.timeoutHandle) {
        clearTimeout(conn.timeoutHandle);
      }
    }
    this.connections.clear();
  }

  // Private methods

  private getConnectionKey(gameId: number, playerId: string): string {
    return `${gameId}:${playerId}`;
  }

  /**
   * Handle disconnect timeout.
   * Auto-play a random valid card.
   */
  private async handleDisconnectTimeout(
    gameId: number,
    playerId: string,
  ): Promise<void> {
    const key = this.getConnectionKey(gameId, playerId);
    const connection = this.connections.get(key);

    if (!connection || connection.isConnected) {
      // Player reconnected before timeout
      return;
    }

    console.log(
      `[ConnectionManager] Player ${playerId} timeout for game ${gameId}, auto-playing card`,
    );

    try {
      const gameEngine = await this.gameRegistry.getOrLoadGame(gameId);
      if (!gameEngine) {
        console.error(`[ConnectionManager] Game ${gameId} not found`);
        return;
      }

      const result = await gameEngine.autoPlayCard(playerId);
      if (!result.success) {
        console.warn(
          `[ConnectionManager] Auto-play failed for ${playerId}: ${result.error}`,
        );
        return;
      }

      // Notify listeners (GameManager) so results are broadcast
      if (this.onAutoPlay) {
        await this.onAutoPlay(gameId, playerId);
      }
    } catch (error) {
      console.error(
        `[ConnectionManager] Error during auto-play for ${playerId}:`,
        error,
      );
    }
  }
}
