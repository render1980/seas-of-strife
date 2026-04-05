import type { ServerWebSocket } from "bun";
import type { GameManager } from "../lobby/GameManager";
import type { GameRegistry } from "../../game/GameRegistry";
import type { ConnectionManager } from "../ConnectionManager";
import type { SessionStore } from "../auth/sessions";
import { sanitizeStateForPlayer } from "../sanitize";
import { routeMessage } from "./router";

/**
 * Data attached to each WebSocket connection via Bun's upgrade.
 */
export interface WsData {
  token: string;
  playerId: string;
  login: string;
}

export interface WsDeps {
  gameManager: GameManager;
  gameRegistry: GameRegistry;
  connectionManager: ConnectionManager;
  sessionStore: SessionStore;
}

/**
 * Build Bun WebSocket handler object.
 */
export function createWsHandlers(deps: WsDeps) {
  return {
    open(ws: ServerWebSocket<WsData>) {
      const { playerId, login } = ws.data;
      console.log(`[WS] Connected: ${login}`);

      // Check if player was in a game (reconnection)
      const gameId = deps.gameManager.getPlayerGameId(playerId);
      if (gameId !== undefined) {
        deps.gameManager.updatePlayerSocket(playerId, ws);

        const game = deps.gameManager.getGame(gameId);
        if (game?.started) {
          deps.connectionManager.playerConnected(gameId, playerId);

          // Send current game state
          const engine = deps.gameRegistry.getGame(gameId);
          if (engine) {
            const state = sanitizeStateForPlayer(
              engine.getGameState(),
              playerId,
            );
            ws.send(JSON.stringify({ type: "game_state", state }));
          }

          // Notify others
          deps.gameManager.broadcast(game, {
            type: "player_reconnected",
            playerId,
          });
        }
      }
    },

    message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
      routeMessage(ws, raw, deps);
    },

    close(ws: ServerWebSocket<WsData>) {
      const { playerId, login } = ws.data;
      console.log(`[WS] Disconnected: ${login}`);

      const gameId = deps.gameManager.getPlayerGameId(playerId);
      if (gameId !== undefined) {
        const game = deps.gameManager.getGame(gameId);
        if (game?.started) {
          deps.connectionManager.playerDisconnected(gameId, playerId);
          deps.gameManager.broadcast(game, {
            type: "player_disconnected",
            playerId,
          });
        } else {
          deps.gameManager.leaveGame(playerId);
        }
      }
    },
  };
}
