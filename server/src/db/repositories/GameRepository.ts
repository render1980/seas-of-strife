import type postgres from "postgres";
import type { GameState, RoundResult } from "../../types/types";

/**
 * GameRepository handles all persistence for game state and results.
 */
export class GameRepository {
  constructor(private sql: postgres.Sql) {}

  /**
   * Save or update the complete game state.
   * Called after every trick.
   */
  async saveGameState(gameState: GameState): Promise<void> {
    await this.sql`
      INSERT INTO games (game_id, game_state, phase, current_round)
      VALUES (${gameState.gameId}, ${JSON.stringify(gameState)}, ${gameState.phase}, ${gameState.currentRound})
      ON CONFLICT (game_id) 
      DO UPDATE SET 
        game_state = EXCLUDED.game_state,
        phase = EXCLUDED.phase,
        current_round = EXCLUDED.current_round,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  /**
   * Load and deserialize a game state from the database.
   * Returns null if not found or state is structurally invalid.
   */
  async loadGameState(gameId: number): Promise<GameState | null> {
    try {
      const result = await this.sql<[{ game_state: string }]>`
        SELECT game_state FROM games WHERE game_id = ${gameId}
      `;

      if (!result.length) {
        return null;
      }

      // postgres.js returns JSONB columns as parsed JS objects, not strings.
      // Support both to be safe against driver configuration differences.
      const raw = result[0].game_state as unknown;
      const gameState: GameState =
        typeof raw === "string" ? JSON.parse(raw) : (raw as GameState);

      if (
        !gameState.gameId ||
        !gameState.phase ||
        !gameState.players ||
        !gameState.currentTrick
      ) {
        console.error(`Invalid game state structure for gameId ${gameId}`);
        return null;
      }

      return gameState;
    } catch (error) {
      console.error(`Failed to load game state for gameId ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Save the results for a completed round.
   */
  async saveRoundResult(
    gameId: number,
    roundNumber: number,
    roundResult: RoundResult,
  ): Promise<void> {
    const sql = this.sql;

    // Get the internal game ID from games table
    const gameRecord = await sql<[{ id: number }]>`
      SELECT id FROM games WHERE game_id = ${gameId}
    `;

    if (!gameRecord.length) {
      throw new Error(`Game ${gameId} not found`);
    }

    const internalGameId = gameRecord[0].id;

    await sql`
      INSERT INTO game_rounds (game_id, round_number, player_scores)
      VALUES (${internalGameId}, ${roundNumber}, ${JSON.stringify(roundResult.scores)})
    `;
  }

  /**
   * Save the final game results (only real players).
   * Also updates player profiles with medals.
   */
  async saveGameResults(
    gameId: number,
    realPlayerIds: string[],
    winners: Array<{
      playerId: string;
      name: string;
      totalTricksTaken: number;
    }>,
  ): Promise<void> {
    const sql = this.sql;

    // Get the internal game ID
    const gameRecord = await sql<[{ id: number }]>`
      SELECT id FROM games WHERE game_id = ${gameId}
    `;

    if (!gameRecord.length) {
      throw new Error(`Game ${gameId} not found`);
    }

    const internalGameId = gameRecord[0].id;

    // Save game results
    await sql`
      INSERT INTO game_results (game_id, real_player_ids, winners)
      VALUES (${internalGameId}, ${JSON.stringify(realPlayerIds)}, ${JSON.stringify(winners)})
    `;

    // Update player profiles with medals
    const medals = ["gold", "silver", "bronze"];
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      if (!winner) {
        continue;
      }
      const medal = medals[i] || null;

      if (medal) {
        // Get user ID from login
        const userRecord = await sql<[{ id: number }]>`
          SELECT id FROM users WHERE login = ${winner.playerId}
        `;

        if (userRecord.length > 0) {
          const userId = userRecord[0].id;
          const medalColumn = `${medal}_medals`;

          // Update medal count and game count
          await sql`
            UPDATE player_profiles
            SET 
              ${sql(medalColumn)} = ${sql(medalColumn)} + 1,
              total_games_played = total_games_played + 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId}
          `;

          // Insert into player_game_results
          await sql`
            INSERT INTO player_game_results (user_id, game_id, medal, total_tricks_taken)
            VALUES (${userId}, ${gameId}, ${medal}, ${winner.totalTricksTaken})
          `;
        }
      }
    }

    // Update game count for non-medal players
    for (const realPlayerId of realPlayerIds) {
      const isWinner = winners.some((w) => w.playerId === realPlayerId);
      if (!isWinner) {
        const userRecord = await sql<[{ id: number }]>`
          SELECT id FROM users WHERE login = ${realPlayerId}
        `;

        if (userRecord.length > 0) {
          const userId = userRecord[0].id;
          await sql`
            UPDATE player_profiles
            SET total_games_played = total_games_played + 1
            WHERE user_id = ${userId}
          `;

          // Find their trick count from roundResults
          const gameState = await this.loadGameState(gameId);
          if (gameState) {
            const totalTricks = gameState.roundResults.reduce((sum, round) => {
              const score = round.scores.find(
                (s) => s.playerId === realPlayerId,
              );
              return sum + (score?.tricksTaken ?? 0);
            }, 0);

            await sql`
              INSERT INTO player_game_results (user_id, game_id, medal, total_tricks_taken)
              VALUES (${userId}, ${gameId}, NULL, ${totalTricks})
            `;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // User / auth queries
  // ---------------------------------------------------------------------------

  async findUserByLogin(login: string): Promise<{
    id: number;
    password_hash: string;
    password_salt: string;
  } | null> {
    const rows = await this.sql<
      [{ id: number; password_hash: string; password_salt: string }]
    >`
      SELECT id, password_hash, password_salt FROM users WHERE login = ${login}
    `;
    return rows.length > 0 ? rows[0] : null;
  }

  async createUser(
    login: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<number> {
    const result = await this.sql<[{ id: number }]>`
      INSERT INTO users (login, password_hash, password_salt)
      VALUES (${login}, ${passwordHash}, ${passwordSalt})
      RETURNING id
    `;
    return result[0].id;
  }

  async createPlayerProfile(userId: number): Promise<void> {
    await this.sql`
      INSERT INTO player_profiles (user_id) VALUES (${userId})
    `;
  }

  /**
   * Delete a game (after archiving if needed).
   */
  async deleteGame(gameId: number): Promise<void> {
    await this.sql`
      DELETE FROM games WHERE game_id = ${gameId}
    `;
  }

  /**
   * Get all games for a user (for their profile).
   */
  async getUserGameResults(userId: number): Promise<
    Array<{
      gameId: number;
      medal: string | null;
      totalTricksTaken: number;
      createdAt: string;
    }>
  > {
    const results = await this.sql<
      Array<{
        game_id: number;
        medal: string | null;
        total_tricks_taken: number;
        created_at: string;
      }>
    >`
      SELECT game_id, medal, total_tricks_taken, created_at
      FROM player_game_results
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return results.map((r) => ({
      gameId: r.game_id,
      medal: r.medal,
      totalTricksTaken: r.total_tricks_taken,
      createdAt: r.created_at,
    }));
  }

  async getPlayerProfile(userId: number): Promise<{
    goldMedals: number;
    silverMedals: number;
    bronzeMedals: number;
    totalGamesPlayed: number;
  } | null> {
    const rows = await this.sql<
      [
        {
          gold_medals: number;
          silver_medals: number;
          bronze_medals: number;
          total_games_played: number;
        },
      ]
    >`
      SELECT gold_medals, silver_medals, bronze_medals, total_games_played
      FROM player_profiles WHERE user_id = ${userId}
    `;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      goldMedals: r.gold_medals,
      silverMedals: r.silver_medals,
      bronzeMedals: r.bronze_medals,
      totalGamesPlayed: r.total_games_played,
    };
  }

  async getGameResultsWithParticipants(userId: number): Promise<
    Array<{
      gameId: number;
      createdAt: string;
      participants: Array<{ login: string; place: number }>;
    }>
  > {
    // Get the last 10 distinct game_ids this user participated in
    const userGames = await this.sql<
      Array<{ game_id: number; created_at: string }>
    >`
      SELECT game_id, created_at
      FROM player_game_results
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (!userGames.length) return [];

    const gameIds = userGames.map((g) => g.game_id);

    // Get all participants for those games, joined with users for login
    const participants = await this.sql<
      Array<{
        game_id: number;
        login: string;
        total_tricks_taken: number;
      }>
    >`
      SELECT pgr.game_id, u.login, pgr.total_tricks_taken
      FROM player_game_results pgr
      JOIN users u ON u.id = pgr.user_id
      WHERE pgr.game_id = ANY(${gameIds})
      ORDER BY pgr.game_id, pgr.total_tricks_taken ASC
    `;

    // Group by game
    const gameMap = new Map<
      number,
      Array<{ login: string; totalTricks: number }>
    >();
    for (const p of participants) {
      let arr = gameMap.get(p.game_id);
      if (!arr) {
        arr = [];
        gameMap.set(p.game_id, arr);
      }
      arr.push({ login: p.login, totalTricks: p.total_tricks_taken });
    }

    return userGames.map((g) => {
      const parts = gameMap.get(g.game_id) ?? [];
      return {
        gameId: g.game_id,
        createdAt: g.created_at,
        participants: parts.map((p, i) => ({ login: p.login, place: i + 1 })),
      };
    });
  }

  async updateUserLogin(userId: number, newLogin: string): Promise<void> {
    const existing = await this.sql`
      SELECT id FROM users WHERE login = ${newLogin} AND id != ${userId}
    `;
    if (existing.length > 0) {
      throw new Error("This login is already taken");
    }
    await this.sql`
      UPDATE users SET login = ${newLogin}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  }

  /**
   * Returns the highest game_id currently in the database (0 if none).
   * Used to seed GameManager's nextGameId on startup.
   */
  async getMaxGameId(): Promise<number> {
    const rows = await this.sql<[{ max: number | null }]>`
      SELECT MAX(game_id) AS max FROM games
    `;
    return rows[0]?.max ?? 0;
  }
}
