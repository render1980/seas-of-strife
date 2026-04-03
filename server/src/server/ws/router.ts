import type { ServerWebSocket } from "bun";
import type { WsData, WsDeps } from "./handler";
import type { ClientMessage } from "../../types/messages";
import { sanitizeStateForPlayer } from "../sanitize";
import { scheduleBotTurns } from "../lobby/botScheduler";

function send(ws: ServerWebSocket<WsData>, msg: object): void {
  ws.send(JSON.stringify(msg));
}

export async function routeMessage(
  ws: ServerWebSocket<WsData>,
  raw: string | Buffer,
  deps: WsDeps,
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  const { playerId, login } = ws.data;
  const { roomManager, gameRegistry, connectionManager } = deps;

  try {
    switch (msg.type) {
      // ----- Lobby -----
      case "create_game": {
        const gameId = roomManager.createRoom(playerId, login, ws);
        send(ws, { type: "game_created", gameId });
        // Also send lobby update (creator is the only player)
        const room = roomManager.getRoom(gameId)!;
        roomManager.broadcast(room, {
          type: "lobby_update",
          gameId,
          players: [{ id: playerId, name: login }],
          creatorId: playerId,
        });
        break;
      }

      case "join_game": {
        roomManager.joinRoom(msg.gameId, playerId, login, ws);
        break;
      }

      case "leave_game": {
        roomManager.leaveRoom(playerId);
        break;
      }

      case "stop_game": {
        roomManager.stopGame(playerId);
        break;
      }

      case "start_game": {
        await roomManager.startGame(playerId);

        // Check if first player is a bot → schedule bot turn
        const gameId = roomManager.getPlayerGameId(playerId);
        if (gameId !== undefined) {
          const engine = gameRegistry.getGame(gameId);
          const room = roomManager.getRoom(gameId);
          if (engine && room) {
            scheduleBotTurns(
              gameId,
              engine,
              room,
              roomManager,
              connectionManager,
            );
          }
        }
        break;
      }

      // ----- In-game -----
      case "play_card": {
        const gameId = roomManager.getPlayerGameId(playerId);
        if (gameId === undefined) {
          send(ws, { type: "error", message: "Not in a game" });
          return;
        }

        const engine = gameRegistry.getGame(gameId);
        if (!engine) {
          send(ws, { type: "error", message: "Game not found" });
          return;
        }

        const room = roomManager.getRoom(gameId);
        if (!room) return;

        const result = await engine.playCard(playerId, msg.card);
        if (!result.success) {
          send(ws, { type: "error", message: result.error ?? "Invalid move" });
          return;
        }

        const state = engine.getGameState();

        if (result.gameEnded) {
          const winners = engine.getRoundWinners();
          roomManager.broadcastPerPlayer(room, (pid) => ({
            type: "game_ended",
            winners,
            state: sanitizeStateForPlayer(state, pid),
          }));
          connectionManager.cleanupGame(gameId);
          break;
        }

        if (result.roundEnded) {
          const lastRound = state.roundResults[state.roundResults.length - 1];
          if (lastRound) {
            roomManager.broadcastPerPlayer(room, (pid) => ({
              type: "round_ended",
              roundNumber: lastRound.round,
              scores: lastRound.scores,
              state: sanitizeStateForPlayer(state, pid),
            }));
          }
          scheduleBotTurns(
            gameId,
            engine,
            room,
            roomManager,
            connectionManager,
          );
          break;
        }

        if (result.trickResolved) {
          const trick = state.currentTrick;
          roomManager.broadcastPerPlayer(room, (pid) => ({
            type: "trick_resolved",
            trickTakerIdx: trick.trickTakerIdx ?? 0,
            hasSpecialPower: trick.winnerHasSpecialPower ?? false,
            state: sanitizeStateForPlayer(state, pid),
          }));
          // If awaiting leader selection by a bot, handle it
          if (state.awaitingLeaderSelection) {
            const currentPlayer = state.players[state.currentPlayerIndex];
            if (currentPlayer?.isBot) {
              scheduleBotTurns(
                gameId,
                engine,
                room,
                roomManager,
                connectionManager,
              );
            }
          } else {
            scheduleBotTurns(
              gameId,
              engine,
              room,
              roomManager,
              connectionManager,
            );
          }
          break;
        }

        // Normal state update
        roomManager.broadcastGameState(room, state);
        scheduleBotTurns(gameId, engine, room, roomManager, connectionManager);
        break;
      }

      case "select_leader": {
        const gameId = roomManager.getPlayerGameId(playerId);
        if (gameId === undefined) {
          send(ws, { type: "error", message: "Not in a game" });
          return;
        }

        const engine = gameRegistry.getGame(gameId);
        if (!engine) {
          send(ws, { type: "error", message: "Game not found" });
          return;
        }

        const room = roomManager.getRoom(gameId);
        if (!room) return;

        const result = await engine.selectNextLeader(playerId, msg.playerIndex);
        if (!result.success) {
          send(ws, { type: "error", message: result.error ?? "Invalid" });
          return;
        }

        const state = engine.getGameState();
        roomManager.broadcastGameState(room, state);
        scheduleBotTurns(gameId, engine, room, roomManager, connectionManager);
        break;
      }

      default:
        send(ws, { type: "error", message: "Unknown message type" });
    }
  } catch (err: any) {
    send(ws, { type: "error", message: err?.message ?? "Internal error" });
  }
}
