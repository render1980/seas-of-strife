import type { GameEngine } from "../../game/engine";
import type { GameManager } from "./GameManager";
import type { ConnectionManager } from "../ConnectionManager";
import { sanitizeStateForPlayer } from "../sanitize";

/**
 * Check if the current player is a bot and schedule auto-play with a short
 * random delay.  The delay bounds are read lazily from environment variables
 * so that tests can override them to 0 without reloading the module:
 *   BOT_DELAY_MIN (ms, default 1000)
 *   BOT_DELAY_MAX (ms, default 2000)
 */
export function scheduleBotTurns(
  gameId: number,
  engine: GameEngine,
  game: ReturnType<GameManager["getGame"]>,
  gameManager: GameManager,
  connectionManager: ConnectionManager,
): void {
  if (!game) return;

  const state = engine.getGameState();
  if (state.phase !== "trick-playing" && !state.awaitingLeaderSelection) return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer?.isBot) return;

  const minDelay = Number(process.env.BOT_DELAY_MIN ?? 1000);
  const maxDelay = Number(process.env.BOT_DELAY_MAX ?? 2000);
  const delay =
    minDelay + Math.floor(Math.random() * Math.max(1, maxDelay - minDelay));

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
        const result = await engine.selectNextLeader(botPlayer.id, randomIndex);
        if (result.success) {
          const updatedState = engine.getGameState();
          gameManager.broadcastGameState(game, updatedState);
          // Chain: check if the new leader is also a bot
          scheduleBotTurns(
            gameId,
            engine,
            game,
            gameManager,
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
      const updatedGame = gameManager.getGame(gameId);
      if (!updatedGame) return;

      if (moveResult.gameEnded) {
        const winners = engine.getRoundWinners();
        gameManager.broadcastPerPlayer(updatedGame, (pid) => ({
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
          gameManager.broadcastPerPlayer(updatedGame, (pid) => ({
            type: "round_ended",
            roundNumber: lastRound.round,
            scores: lastRound.scores,
            state: sanitizeStateForPlayer(updatedState, pid),
          }));
        }
        scheduleBotTurns(
          gameId,
          engine,
          updatedGame,
          gameManager,
          connectionManager,
        );
        return;
      }

      if (moveResult.trickResolved) {
        const trick = updatedState.currentTrick;
        gameManager.broadcastPerPlayer(updatedGame, (pid) => ({
          type: "trick_resolved",
          trickTakerIdx: trick.trickTakerIdx ?? 0,
          hasSpecialPower: trick.winnerHasSpecialPower ?? false,
          state: sanitizeStateForPlayer(updatedState, pid),
        }));
        scheduleBotTurns(
          gameId,
          engine,
          updatedGame,
          gameManager,
          connectionManager,
        );
        return;
      }

      // Normal card played, advance
      gameManager.broadcastGameState(updatedGame, updatedState);
      scheduleBotTurns(
        gameId,
        engine,
        updatedGame,
        gameManager,
        connectionManager,
      );
    } catch (err) {
      console.error(`[BotScheduler] Error for game ${gameId}:`, err);
    }
  }, delay);
}
