import type { ServerWebSocket } from "bun";
import type { ClientMessage } from "../../../../shared/types/messages";
import { scheduleBotTurns } from "../lobby/botScheduler";
import { sanitizeStateForPlayer } from "../sanitize";
import type { WsData, WsDeps } from "./handler";

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
  const { gameManager, gameRegistry, connectionManager } = deps;

  try {
    switch (msg.type) {
      // ----- Lobby -----
      case "create_game": {
        const game = gameManager.createGame(playerId, login, ws);
        send(ws, { type: "game_created", gameId: game.gameId });
        // Send lobby update (creator is the only player for now)
        gameManager.broadcast(game, {
          type: "lobby_update",
          gameId: game.gameId,
          players: [{ id: playerId, name: login }],
          creatorId: playerId,
        });
        break;
      }

      case "continue_game": {
        break;
      }

      case "join_game": {
        console.log(
          "Handling join_game message:",
          msg,
          "playerId:",
          playerId,
          "login:",
          login,
          "ws:",
          ws,
          "gameId:",
          msg.gameId,
        );
        const joinResult = gameManager.joinGame(
          msg.gameId,
          playerId,
          login,
          ws,
        );
        if (!joinResult.success) {
          send(ws, { type: "join_failed", message: joinResult.error });
        }
        break;
      }

      case "leave_game": {
        gameManager.leaveGame(playerId);
        break;
      }

      case "stop_game": {
        gameManager.stopGame(playerId);
        break;
      }

      case "start_game": {
        await gameManager.startGame(playerId);

        // Check if first player is a bot → schedule bot turn
        const gameId = gameManager.getPlayerGameId(playerId);
        if (gameId !== undefined) {
          const engine = gameRegistry.getGame(gameId);
          const game = gameManager.getGame(gameId);
          if (engine && game) {
            scheduleBotTurns(
              gameId,
              engine,
              game,
              gameManager,
              connectionManager,
            );
          }
        }
        break;
      }

      // ----- In-game -----
      case "play_card": {
        const gameId = gameManager.getPlayerGameId(playerId);
        if (gameId === undefined) {
          send(ws, { type: "error", message: "Not in a game" });
          return;
        }

        const engine = gameRegistry.getGame(gameId);
        if (!engine) {
          send(ws, { type: "error", message: "Game not found" });
          return;
        }

        const game = gameManager.getGame(gameId);
        if (!game) return;

        const state = engine.getGameState();

        const result = await engine.playCard(playerId, msg.card);
        if (!result.success) {
          send(ws, {
            type: "error",
            message: result.error ?? "Invalid move",
          });
          return;
        }

        if (result.gameEnded) {
          const winners = engine.getRoundWinners();
          gameManager.broadcastPerPlayer(game, (pid) => ({
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
            gameManager.broadcastPerPlayer(game, (pid) => ({
              type: "round_ended",
              roundNumber: lastRound.round,
              scores: lastRound.scores,
              state: sanitizeStateForPlayer(state, pid),
            }));
          }
          scheduleBotTurns(
            gameId,
            engine,
            game,
            gameManager,
            connectionManager,
          );
          break;
        }

        if (result.trickResolved) {
          const trick = state.currentTrick;
          gameManager.broadcastPerPlayer(game, (pid) => ({
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
                game,
                gameManager,
                connectionManager,
              );
            }
          } else {
            scheduleBotTurns(
              gameId,
              engine,
              game,
              gameManager,
              connectionManager,
            );
          }
          break;
        }

        // Normal state update
        gameManager.broadcastGameState(game, state);
        scheduleBotTurns(gameId, engine, game, gameManager, connectionManager);
        break;
      }

      case "select_leader": {
        const gameId = gameManager.getPlayerGameId(playerId);
        if (gameId === undefined) {
          send(ws, { type: "error", message: "Not in a game" });
          return;
        }

        const engine = gameRegistry.getGame(gameId);
        if (!engine) {
          send(ws, { type: "error", message: "Game not found" });
          return;
        }

        const game = gameManager.getGame(gameId);
        if (!game) return;

        const result = await engine.selectNextLeader(playerId, msg.playerIndex);
        if (!result.success) {
          const state = engine.getGameState();
          send(ws, {
            type: "game_state",
            state: sanitizeStateForPlayer(state, playerId),
          });
          return;
        }

        const state = engine.getGameState();
        gameManager.broadcastGameState(game, state);
        scheduleBotTurns(gameId, engine, game, gameManager, connectionManager);
        break;
      }

      default:
        send(ws, { type: "error", message: "Unknown message type" });
    }
  } catch (err: any) {
    console.error(
      "Error handling message:",
      err,
      "ws:",
      ws,
      "playerId:",
      playerId,
      "login:",
      login,
    );
    send(ws, { type: "error", message: err?.message ?? "Internal error" });
  }
}
