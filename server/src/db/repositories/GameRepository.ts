import { getDb } from "../connection";
import type { GameState, RoundResult } from "../../types/types";

/**
 * GameRepository handles all persistence for game state and results.
 */
export class GameRepository {
  /**
   * Save or update the complete game state.
   * Called after every trick.
   */
  async saveGameState(gameState: GameState): Promise<void> {
    const sql = getDb();

    await sql`
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
    const sql = getDb();

    try {
      const result = await sql<[{ game_state: string }]>`
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
    const sql = getDb();

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
    const sql = getDb();

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
    const sql = getDb();
    const rows = await sql<
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
    const sql = getDb();
    const result = await sql<[{ id: number }]>`
      INSERT INTO users (login, password_hash, password_salt)
      VALUES (${login}, ${passwordHash}, ${passwordSalt})
      RETURNING id
    `;
    return result[0].id;
  }

  async createPlayerProfile(userId: number): Promise<void> {
    const sql = getDb();
    await sql`
      INSERT INTO player_profiles (user_id) VALUES (${userId})
    `;
  }

  /**
   * Delete a game (after archiving if needed).
   */
  async deleteGame(gameId: number): Promise<void> {
    const sql = getDb();
    await sql`
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
    const sql = getDb();

    const results = await sql<
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
}
