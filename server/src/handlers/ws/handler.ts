import type { ServerWebSocket } from "bun";
import type { GameManager } from "../lobby/GameManager";
import type { GameRegistry } from "../../game/GameRegistry";
import type { ConnectionManager } from "../ConnectionManager";
import type { SessionStore } from "../auth/SessionStore";
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
      const game = deps.gameManager.getPlayerGame(playerId);
      if (game) {
        deps.gameManager.updatePlayerSocket(playerId, ws);

        if (game.started) {
          deps.connectionManager.playerConnected(game.gameId, playerId);

          // Send current game state
          const engine = deps.gameRegistry.getGame(game.gameId);
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

      const game = deps.gameManager.getPlayerGame(playerId);
      if (game) {
        if (game.started) {
          deps.connectionManager.playerDisconnected(game.gameId, playerId);
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
