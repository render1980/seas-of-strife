// Mirrors the subset of server/src/types/messages.ts needed by the client.
// Keep in sync when adding new server message types.

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

export interface GameCreatedMsg {
  type: "game_created";
  gameId: number;
}

export interface GameStoppedMsg {
  type: "game_stopped";
}

export interface ErrorMsg {
  type: "error";
  message: string;
}

// Expanded in subsequent steps when game screen is added
export type ServerMessage =
  | LobbyUpdateMsg
  | GameCreatedMsg
  | GameStoppedMsg
  | ErrorMsg;
