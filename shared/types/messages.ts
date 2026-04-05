import type { GameState, RoundResult, RoundWinner } from "../../server/src/types/types";

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export interface CreateGameMsg {
  type: "create_game";
}

export interface JoinGameMsg {
  type: "join_game";
  gameId: number;
}

export interface LeaveGameMsg {
  type: "leave_game";
}

export interface StopGameMsg {
  type: "stop_game";
}

export interface StartGameMsg {
  type: "start_game";
}

export interface PlayCardMsg {
  type: "play_card";
  card: number;
}

export interface SelectLeaderMsg {
  type: "select_leader";
  playerIndex: number;
}

export type ClientMessage =
  | CreateGameMsg
  | JoinGameMsg
  | LeaveGameMsg
  | StopGameMsg
  | StartGameMsg
  | PlayCardMsg
  | SelectLeaderMsg;

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export interface ErrorMsg {
  type: "error";
  message: string;
  state?: SanitizedGameState;
}

export interface GameCreatedMsg {
  type: "game_created";
  gameId: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
}

export interface LobbyUpdateMsg {
  type: "lobby_update";
  gameId: number;
  players: LobbyPlayer[];
  creatorId: string;
}

/** GameState with other players' hands hidden */
export interface SanitizedPlayer {
  id: string;
  name: string;
  isBot: boolean;
  hand: number[]; // own hand only; empty for others
  handSize: number;
  tricksTakenPerRound: number;
}

export interface SanitizedGameState {
  gameId: number;
  phase: GameState["phase"];
  players: SanitizedPlayer[];
  currentRound: number;
  currentPlayerIndex: number;
  currentTrick: GameState["currentTrick"];
  roundResults: RoundResult[];
  awaitingLeaderSelection: boolean;
  lastTrickTakerIndex?: number;
}

export interface GameStateMsg {
  type: "game_state";
  state: SanitizedGameState;
}

export interface TrickResolvedMsg {
  type: "trick_resolved";
  trickTakerIdx: number;
  hasSpecialPower: boolean;
  state: SanitizedGameState;
}

export interface RoundEndedMsg {
  type: "round_ended";
  roundNumber: number;
  scores: RoundResult["scores"];
  state: SanitizedGameState;
}

export interface GameEndedMsg {
  type: "game_ended";
  winners: RoundWinner[];
  state: SanitizedGameState;
}

export interface GameStoppedMsg {
  type: "game_stopped";
}

export interface PlayerDisconnectedMsg {
  type: "player_disconnected";
  playerId: string;
}

export interface PlayerReconnectedMsg {
  type: "player_reconnected";
  playerId: string;
}

export type ServerMessage =
  | ErrorMsg
  | GameCreatedMsg
  | LobbyUpdateMsg
  | GameStateMsg
  | TrickResolvedMsg
  | RoundEndedMsg
  | GameEndedMsg
  | GameStoppedMsg
  | PlayerDisconnectedMsg
  | PlayerReconnectedMsg;

export type { RoundWinner } from "../../server/src/types/types";
