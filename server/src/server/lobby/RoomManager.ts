import type { ServerWebSocket } from "bun";
import type { GameRegistry } from "../../game/GameRegistry";
import type { ConnectionManager } from "../ConnectionManager";
import type { SessionStore } from "../auth/sessions";
import type { PlayerState, MIN_PLAYERS, MAX_PLAYERS } from "../../types/types";
import type {
  LobbyPlayer,
  ServerMessage,
  SanitizedGameState,
} from "../../types/messages";
import { sanitizeStateForPlayer } from "../sanitize";
import type { WsData } from "../ws/handler";

interface Room {
  gameId: number;
  creatorId: string;
  /** Connected players (may include disconnected slots during game) */
  players: Map<string, ServerWebSocket<WsData>>;
  /** Player display names in join order */
  playerNames: Map<string, string>;
  started: boolean;
}

let nextGameId = 1;

export class RoomManager {
  private rooms: Map<number, Room> = new Map();
  /** Reverse lookup: playerId → gameId */
  private playerRoom: Map<string, number> = new Map();

  private gameRegistry: GameRegistry;
  private connectionManager: ConnectionManager;
  private sessionStore: SessionStore;

  constructor(
    gameRegistry: GameRegistry,
    connectionManager: ConnectionManager,
    sessionStore: SessionStore,
  ) {
    this.gameRegistry = gameRegistry;
    this.connectionManager = connectionManager;
    this.sessionStore = sessionStore;
  }

  // ---------------------------------------------------------------------------
  // Lobby operations
  // ---------------------------------------------------------------------------

  createRoom(
    playerId: string,
    playerName: string,
    ws: ServerWebSocket<WsData>,
  ): number {
    if (this.playerRoom.has(playerId)) {
      throw new Error("Already in a game");
    }

    const gameId = nextGameId++;
    const room: Room = {
      gameId,
      creatorId: playerId,
      players: new Map([[playerId, ws]]),
      playerNames: new Map([[playerId, playerName]]),
      started: false,
    };
    this.rooms.set(gameId, room);
    this.playerRoom.set(playerId, gameId);
    return gameId;
  }

  joinRoom(
    gameId: number,
    playerId: string,
    playerName: string,
    ws: ServerWebSocket<WsData>,
  ): void {
    const room = this.rooms.get(gameId);
    if (!room) throw new Error("Game not found");
    if (room.started) throw new Error("Game already started");
    if (room.players.size >= 6) throw new Error("Game is full");
    if (this.playerRoom.has(playerId)) throw new Error("Already in a game");

    room.players.set(playerId, ws);
    room.playerNames.set(playerId, playerName);
    this.playerRoom.set(playerId, gameId);
    this.broadcastLobbyUpdate(room);
  }

  leaveRoom(playerId: string): void {
    const gameId = this.playerRoom.get(playerId);
    if (gameId === undefined) return;

    const room = this.rooms.get(gameId);
    if (!room) {
      this.playerRoom.delete(playerId);
      return;
    }

    if (!room.started) {
      // In lobby: remove player
      room.players.delete(playerId);
      room.playerNames.delete(playerId);
      this.playerRoom.delete(playerId);

      if (playerId === room.creatorId || room.players.size === 0) {
        // Creator left or room empty → dissolve
        this.broadcast(room, { type: "game_stopped" });
        this.destroyRoom(gameId);
      } else {
        this.broadcastLobbyUpdate(room);
      }
    }
    // If game is started, disconnection is handled by ConnectionManager
  }

  stopGame(requesterId: string): void {
    const gameId = this.playerRoom.get(requesterId);
    if (gameId === undefined) throw new Error("Not in a game");

    const room = this.rooms.get(gameId);
    if (!room) throw new Error("Game not found");
    if (room.creatorId !== requesterId) throw new Error("Only creator can stop");

    this.broadcast(room, { type: "game_stopped" });
    this.connectionManager.cleanupGame(gameId);
    this.gameRegistry.removeGame(gameId);
    this.destroyRoom(gameId);
  }

  startGame(requesterId: string): void {
    const gameId = this.playerRoom.get(requesterId);
    if (gameId === undefined) throw new Error("Not in a game");

    const room = this.rooms.get(gameId);
    if (!room) throw new Error("Game not found");
    if (room.creatorId !== requesterId) throw new Error("Only creator can start");
    if (room.started) throw new Error("Game already started");

    // Build player list, fill bots to reach MIN_PLAYERS
    const players: PlayerState[] = [];
    for (const [id, name] of room.playerNames) {
      players.push({ id, name, isBot: false, hand: [], tricksTakenPerRound: 0 });
    }
    let botNum = 1;
    while (players.length < 4) {
      const botId = `bot-${gameId}-${botNum}`;
      players.push({
        id: botId,
        name: `Bot ${botNum}`,
        isBot: true,
        hand: [],
        tricksTakenPerRound: 0,
      });
      botNum++;
    }

    // Create engine and start game
    const engine = this.gameRegistry.createGame(gameId, players);
    engine.startGame();
    room.started = true;

    // Register connections
    for (const [pid] of room.players) {
      this.connectionManager.playerConnected(gameId, pid);
    }

    // Send sanitized state to each player
    this.broadcastGameState(room, engine.getGameState());
  }

  // ---------------------------------------------------------------------------
  // In-game broadcasting
  // ---------------------------------------------------------------------------

  /**
   * Replace a player's WebSocket (on reconnect).
   */
  updatePlayerSocket(
    playerId: string,
    ws: ServerWebSocket<WsData>,
  ): number | null {
    const gameId = this.playerRoom.get(playerId);
    if (gameId === undefined) return null;

    const room = this.rooms.get(gameId);
    if (!room) return null;

    room.players.set(playerId, ws);
    return gameId;
  }

  getPlayerGameId(playerId: string): number | undefined {
    return this.playerRoom.get(playerId);
  }

  getRoom(gameId: number): Room | undefined {
    return this.rooms.get(gameId);
  }

  /**
   * Send sanitized game state to each player in the room.
   */
  broadcastGameState(room: Room, state: import("../../types/types").GameState): void {
    for (const [pid, ws] of room.players) {
      const sanitized = sanitizeStateForPlayer(state, pid);
      this.send(ws, { type: "game_state", state: sanitized });
    }
  }

  /**
   * Send the same message to all players in a room.
   */
  broadcast(room: Room, msg: ServerMessage): void {
    const raw = JSON.stringify(msg);
    for (const ws of room.players.values()) {
      ws.send(raw);
    }
  }

  /**
   * Send a per-player sanitized message to all players in a room.
   * The callback receives the playerId and should return the message for that player.
   */
  broadcastPerPlayer(
    room: Room,
    buildMsg: (playerId: string) => ServerMessage,
  ): void {
    for (const [pid, ws] of room.players) {
      this.send(ws, buildMsg(pid));
    }
  }

  send(ws: ServerWebSocket<WsData>, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private broadcastLobbyUpdate(room: Room): void {
    const players: import("../../types/messages").LobbyPlayer[] = [];
    for (const [id, name] of room.playerNames) {
      players.push({ id, name });
    }
    this.broadcast(room, {
      type: "lobby_update",
      gameId: room.gameId,
      players,
      creatorId: room.creatorId,
    });
  }

  private destroyRoom(gameId: number): void {
    const room = this.rooms.get(gameId);
    if (!room) return;

    for (const pid of room.players.keys()) {
      this.playerRoom.delete(pid);
    }
    this.rooms.delete(gameId);
  }

  /**
   * Remove a player from tracking (after game ends / player fully leaves).
   */
  removePlayerTracking(playerId: string): void {
    this.playerRoom.delete(playerId);
  }
}
