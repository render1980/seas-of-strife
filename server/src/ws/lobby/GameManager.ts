import type { ServerWebSocket } from "bun";
import type {
  LobbyPlayer,
  ServerMessage,
} from "../../../../shared/types/messages";
import type { GameRegistry } from "../../game/GameRegistry";
import type { GameState, PlayerState } from "../../types/types";
import type { ConnectionManager } from "../ConnectionManager";
import type { SessionStore } from "../auth/SessionStore";
import { sanitizeStateForPlayer } from "../sanitize";
import type { WsData } from "../ws/handler";

interface Game {
  gameId: number;
  creatorId: string;
  /** Connected players (may include disconnected slots during game) */
  players: Map<string, ServerWebSocket<WsData>>;
  /** Player display names in join order */
  playerNames: Map<string, string>;
  started: boolean;
}

export class GameManager {
  private games: Map<number, Game> = new Map();
  /** Reverse lookup: playerId → gameId */
  private playerToGame: Map<string, number> = new Map();
  private nextGameId = 1;

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

  createGame(
    playerId: string,
    playerName: string,
    ws: ServerWebSocket<WsData>,
  ): Game {
    if (this.playerToGame.has(playerId)) {
      throw new Error("Already in a game");
    }

    const gameId = this.nextGameId++;
    const game: Game = {
      gameId,
      creatorId: playerId,
      players: new Map([[playerId, ws]]),
      playerNames: new Map([[playerId, playerName]]),
      started: false,
    };
    this.games.set(gameId, game);
    this.playerToGame.set(playerId, gameId);
    return game;
  }

  joinGame(
    gameId: number,
    playerId: string,
    playerName: string,
    ws: ServerWebSocket<WsData>,
  ): void {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.started) throw new Error("Game already started");
    if (game.players.size >= 6) throw new Error("Game is full");
    if (this.playerToGame.has(playerId)) throw new Error("Already in a game");

    game.players.set(playerId, ws);
    game.playerNames.set(playerId, playerName);
    this.playerToGame.set(playerId, gameId);
    this.broadcastLobbyUpdate(game);
  }

  leaveGame(playerId: string): void {
    const gameId = this.playerToGame.get(playerId);
    if (gameId === undefined) return;

    const game = this.games.get(gameId);
    if (!game) {
      this.playerToGame.delete(playerId);
      return;
    }

    if (!game.started) {
      const dissolve = playerId === game.creatorId || game.players.size === 1;

      if (dissolve) {
        // Broadcast to everyone (including the leaving player) before cleanup
        this.broadcast(game, { type: "game_stopped" });
        this.deleteGame(gameId);
      } else {
        // Non-creator: remove then update remaining players
        game.players.delete(playerId);
        game.playerNames.delete(playerId);
        this.playerToGame.delete(playerId);
        this.broadcastLobbyUpdate(game);
      }
    }
    // If game is started, disconnection is handled by ConnectionManager
  }

  stopGame(requesterId: string): void {
    const gameId = this.playerToGame.get(requesterId);
    if (gameId === undefined) throw new Error("Not in a game");

    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.creatorId !== requesterId)
      throw new Error("Only creator can stop");

    this.broadcast(game, { type: "game_stopped" });
    this.connectionManager.cleanupGame(gameId);
    this.gameRegistry.removeGame(gameId);
    this.deleteGame(gameId);
  }

  async startGame(requesterId: string): Promise<void> {
    const gameId = this.playerToGame.get(requesterId);
    if (gameId === undefined) throw new Error("Not in a game");

    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.creatorId !== requesterId)
      throw new Error("Only creator can start");
    if (game.started) throw new Error("Game already started");

    // Build player list, fill bots to reach MIN_PLAYERS
    const players: PlayerState[] = [];
    for (const [id, name] of game.playerNames) {
      players.push({
        id,
        name,
        isBot: false,
        hand: [],
        tricksTakenPerRound: 0,
      });
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
    const engine = await this.gameRegistry.createGame(gameId, players);
    await engine.startGame();
    game.started = true;

    // Register connections
    for (const [pid] of game.players) {
      this.connectionManager.playerConnected(gameId, pid);
    }

    // Send sanitized state to each player
    this.broadcastGameState(game, engine.getGameState());
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
    const gameId = this.playerToGame.get(playerId);
    if (gameId === undefined) return null;

    const game = this.games.get(gameId);
    if (!game) return null;

    game.players.set(playerId, ws);
    return gameId;
  }

  getPlayerGameId(playerId: string): number | undefined {
    return this.playerToGame.get(playerId);
  }

  getGame(gameId: number): Game | undefined {
    return this.games.get(gameId);
  }

  /**
   * Send sanitized game state to each player in the game.
   */
  broadcastGameState(game: Game, state: GameState): void {
    for (const [pid, ws] of game.players) {
      const sanitized = sanitizeStateForPlayer(state, pid);
      this.send(ws, { type: "game_state", state: sanitized });
    }
  }

  /**
   * Send the same message to all players in a game.
   */
  broadcast(game: Game, msg: ServerMessage): void {
    const raw = JSON.stringify(msg);
    for (const ws of game.players.values()) {
      ws.send(raw);
    }
  }

  /**
   * Send a per-player sanitized message to all players in a game.
   * The callback receives the playerId and should return the message for that player.
   */
  broadcastPerPlayer(
    game: Game,
    buildMsg: (playerId: string) => ServerMessage,
  ): void {
    for (const [pid, ws] of game.players) {
      this.send(ws, buildMsg(pid));
    }
  }

  send(ws: ServerWebSocket<WsData>, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private broadcastLobbyUpdate(game: Game): void {
    const players: LobbyPlayer[] = [];
    for (const [id, name] of game.playerNames) {
      players.push({ id, name });
    }
    this.broadcast(game, {
      type: "lobby_update",
      gameId: game.gameId,
      players,
      creatorId: game.creatorId,
    });
  }

  private deleteGame(gameId: number): void {
    const game = this.games.get(gameId);
    if (!game) return;

    for (const pid of game.players.keys()) {
      this.playerToGame.delete(pid);
    }
    this.games.delete(gameId);
  }

  /**
   * Remove a player from tracking (after game ends / player fully leaves).
   */
  removePlayerTracking(playerId: string): void {
    this.playerToGame.delete(playerId);
  }

  /**
   * Seed the game ID counter from the database so IDs never collide after a
   * server restart. Call once on startup before accepting connections.
   */
  seedNextGameId(maxExistingId: number): void {
    this.nextGameId = Math.max(this.nextGameId, maxExistingId + 1);
  }
}
