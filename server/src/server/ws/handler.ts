import type { ServerWebSocket } from "bun";
import type { RoomManager } from "../lobby/RoomManager";
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
  roomManager: RoomManager;
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
      const gameId = deps.roomManager.getPlayerGameId(playerId);
      if (gameId !== undefined) {
        deps.roomManager.updatePlayerSocket(playerId, ws);

        const room = deps.roomManager.getRoom(gameId);
        if (room?.started) {
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
          deps.roomManager.broadcast(room, {
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

      const gameId = deps.roomManager.getPlayerGameId(playerId);
      if (gameId !== undefined) {
        const room = deps.roomManager.getRoom(gameId);
        if (room?.started) {
          deps.connectionManager.playerDisconnected(gameId, playerId);
          deps.roomManager.broadcast(room, {
            type: "player_disconnected",
            playerId,
          });
        } else {
          deps.roomManager.leaveRoom(playerId);
        }
      }
    },
  };
}
