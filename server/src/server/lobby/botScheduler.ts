import type { GameEngine } from "../../game/engine";
import type { RoomManager } from "./RoomManager";
import type { ConnectionManager } from "../ConnectionManager";
import { sanitizeStateForPlayer } from "../sanitize";

const BOT_DELAY_MIN = 1000;
const BOT_DELAY_MAX = 2000;

/**
 * Check if the current player is a bot and schedule auto-play with 1-2s delay.
 * Chains if consecutive players are bots.
 */
export function scheduleBotTurns(
  gameId: number,
  engine: GameEngine,
  room: ReturnType<RoomManager["getRoom"]>,
  roomManager: RoomManager,
  connectionManager: ConnectionManager,
): void {
  if (!room) return;

  const state = engine.getGameState();
  if (state.phase !== "trick-playing" && !state.awaitingLeaderSelection) return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer?.isBot) return;

  const delay =
    BOT_DELAY_MIN + Math.floor(Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN));

  setTimeout(async () => {
    try {
      const freshState = engine.getGameState();

      // Handle leader selection for bot
      if (freshState.awaitingLeaderSelection) {
        const botPlayer = freshState.players[freshState.currentPlayerIndex];
        if (!botPlayer?.isBot) return;

        // Bot picks a random player (including itself)
        const randomIndex = Math.floor(
          Math.random() * freshState.players.length,
        );
        const result = engine.selectNextLeader(botPlayer.id, randomIndex);
        if (result.success) {
          const updatedState = engine.getGameState();
          roomManager.broadcastGameState(room, updatedState);
          // Chain: check if the new leader is also a bot
          scheduleBotTurns(
            gameId,
            engine,
            room,
            roomManager,
            connectionManager,
          );
        }
        return;
      }

      if (freshState.phase !== "trick-playing") return;

      const botPlayer = freshState.players[freshState.currentPlayerIndex];
      if (!botPlayer?.isBot) return;

      const moveResult = await engine.autoPlayCard(botPlayer.id);
      if (!moveResult.success) return;

      const updatedState = engine.getGameState();
      const updatedRoom = roomManager.getRoom(gameId);
      if (!updatedRoom) return;

      if (moveResult.gameEnded) {
        const winners = engine.getRoundWinners();
        roomManager.broadcastPerPlayer(updatedRoom, (pid) => ({
          type: "game_ended",
          winners,
          state: sanitizeStateForPlayer(updatedState, pid),
        }));
        connectionManager.cleanupGame(gameId);
        return;
      }

      if (moveResult.roundEnded) {
        const lastRound =
          updatedState.roundResults[updatedState.roundResults.length - 1];
        if (lastRound) {
          roomManager.broadcastPerPlayer(updatedRoom, (pid) => ({
            type: "round_ended",
            roundNumber: lastRound.round,
            scores: lastRound.scores,
            state: sanitizeStateForPlayer(updatedState, pid),
          }));
        }
        scheduleBotTurns(
          gameId,
          engine,
          updatedRoom,
          roomManager,
          connectionManager,
        );
        return;
      }

      if (moveResult.trickResolved) {
        const trick = updatedState.currentTrick;
        roomManager.broadcastPerPlayer(updatedRoom, (pid) => ({
          type: "trick_resolved",
          trickTakerIdx: trick.trickTakerIdx ?? 0,
          hasSpecialPower: trick.winnerHasSpecialPower ?? false,
          state: sanitizeStateForPlayer(updatedState, pid),
        }));
        scheduleBotTurns(
          gameId,
          engine,
          updatedRoom,
          roomManager,
          connectionManager,
        );
        return;
      }

      // Normal card played, advance
      roomManager.broadcastGameState(updatedRoom, updatedState);
      scheduleBotTurns(
        gameId,
        engine,
        updatedRoom,
        roomManager,
        connectionManager,
      );
    } catch (err) {
      console.error(`[BotScheduler] Error for game ${gameId}:`, err);
    }
  }, delay);
}
