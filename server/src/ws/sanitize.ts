import type { GameState } from "../types/types";
import type {
  SanitizedGameState,
  SanitizedPlayer,
} from "../../../shared/types/messages";

/**
 * Create a per-player view of GameState: own hand visible, others hidden.
 */
export function sanitizeStateForPlayer(
  state: GameState,
  playerId: string,
): SanitizedGameState {
  const players: SanitizedPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    hand: p.id === playerId ? p.hand : [],
    handSize: p.hand.length,
    tricksTakenPerRound: p.tricksTakenPerRound,
  }));

  return {
    gameId: state.gameId,
    phase: state.phase,
    players,
    currentRound: state.currentRound,
    currentPlayerIndex: state.currentPlayerIndex,
    currentTrick: state.currentTrick,
    roundResults: state.roundResults,
    awaitingLeaderSelection: state.awaitingLeaderSelection,
    lastTrickTakerIndex: state.lastTrickTakerIndex,
  };
}
