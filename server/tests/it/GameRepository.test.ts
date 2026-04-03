import { beforeEach, describe, expect, it } from "bun:test";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { getDb, makeGameState, truncateAllTables } from "./helpers/db";

let sql = getDb();
const repo = new GameRepository(sql);

beforeEach(truncateAllTables);

describe("GameRepository -> Postgres", () => {
  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------

  describe("user management", () => {
    it("createUser returns a valid positive ID", async () => {
      const id = await repo.createUser("alice", "hashval", "saltval");
      expect(id).toBeGreaterThan(0);
    });

    it("findUserByLogin returns credentials for an existing user", async () => {
      await repo.createUser("alice", "hashval", "saltval");
      const user = await repo.findUserByLogin("alice");

      expect(user).not.toBeNull();
      expect(user!.password_hash).toBe("hashval");
      expect(user!.password_salt).toBe("saltval");
    });

    it("findUserByLogin returns null for an unknown login", async () => {
      const user = await repo.findUserByLogin("nobody");
      expect(user).toBeNull();
    });

    it("createPlayerProfile creates a profile linked to the user", async () => {
      const userId = await repo.createUser("alice", "h", "s");
      await repo.createPlayerProfile(userId);

      const rows = await sql<
        Array<{ user_id: number; gold_medals: number }>
      >`SELECT user_id, gold_medals FROM player_profiles WHERE user_id = ${userId}`;

      expect(rows.length).toBe(1);
      expect(rows[0]!.user_id).toBe(userId);
      expect(rows[0]!.gold_medals).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // saveGameState / loadGameState
  // ---------------------------------------------------------------------------

  describe("saveGameState + loadGameState", () => {
    it("round-trips game state to and from the database", async () => {
      const state = makeGameState(1);
      await repo.saveGameState(state);

      const loaded = await repo.loadGameState(1);
      expect(loaded).not.toBeNull();
      expect(loaded!.gameId).toBe(1);
      expect(loaded!.phase).toBe("waiting");
      expect(loaded!.players).toHaveLength(4);
    });

    it("upserts: overwrites the existing row on conflict", async () => {
      await repo.saveGameState(makeGameState(1));
      await repo.saveGameState(
        makeGameState(1, { phase: "trick-playing", currentRound: 2 }),
      );

      const loaded = await repo.loadGameState(1);
      expect(loaded!.phase).toBe("trick-playing");
      expect(loaded!.currentRound).toBe(2);
    });

    it("returns null for a non-existent gameId", async () => {
      expect(await repo.loadGameState(999)).toBeNull();
    });

    it("returns null when stored state is missing required fields", async () => {
      await sql`
        INSERT INTO games (game_id, game_state, phase, current_round)
        VALUES (42, ${JSON.stringify({ invalid: true })}, 'waiting', 0)
      `;

      expect(await repo.loadGameState(42)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // saveRoundResult
  // ---------------------------------------------------------------------------

  describe("saveRoundResult", () => {
    it("persists round scores for a known game", async () => {
      await repo.saveGameState(makeGameState(1));
      await repo.saveRoundResult(1, 1, {
        round: 1,
        scores: [
          { playerId: "player_1", tricksTaken: 3 },
          { playerId: "player_2", tricksTaken: 2 },
        ],
      });

      const rows = await sql`SELECT round_number FROM game_rounds`;
      expect(rows.length).toBe(1);
      expect(rows[0]!.round_number).toBe(1);
    });

    it("throws when the game does not exist", async () => {
      await expect(
        repo.saveRoundResult(999, 1, { round: 1, scores: [] }),
      ).rejects.toThrow("Game 999 not found");
    });
  });

  // ---------------------------------------------------------------------------
  // saveGameResults
  // ---------------------------------------------------------------------------

  describe("saveGameResults", () => {
    async function setupUsersAndGame(withRoundResults = false) {
      const logins = ["player_1", "player_2", "player_3", "player_4"];
      const userIds: number[] = [];
      for (const login of logins) {
        const id = await repo.createUser(login, "hash", "salt");
        await repo.createPlayerProfile(id);
        userIds.push(id);
      }

      const state = makeGameState(
        1,
        withRoundResults
          ? {
              phase: "game-end",
              currentRound: 1,
              roundResults: [
                {
                  round: 1,
                  scores: [
                    { playerId: "player_1", tricksTaken: 5 },
                    { playerId: "player_2", tricksTaken: 4 },
                    { playerId: "player_3", tricksTaken: 3 },
                    { playerId: "player_4", tricksTaken: 2 },
                  ],
                },
              ],
            }
          : {},
      );
      await repo.saveGameState(state);
      return userIds;
    }

    it("awards gold/silver/bronze medals to the top-3 winners", async () => {
      await setupUsersAndGame();

      await repo.saveGameResults(
        1,
        ["player_1", "player_2", "player_3"],
        [
          { playerId: "player_1", name: "Player 1", totalTricksTaken: 10 },
          { playerId: "player_2", name: "Player 2", totalTricksTaken: 8 },
          { playerId: "player_3", name: "Player 3", totalTricksTaken: 6 },
        ],
      );

      const profiles = await sql<
        Array<{
          login: string;
          gold_medals: number;
          silver_medals: number;
          bronze_medals: number;
          total_games_played: number;
        }>
      >`
        SELECT u.login, pp.gold_medals, pp.silver_medals, pp.bronze_medals, pp.total_games_played
        FROM player_profiles pp
        JOIN users u ON u.id = pp.user_id
        WHERE u.login IN ('player_1','player_2','player_3')
        ORDER BY u.login
      `;

      const byLogin = Object.fromEntries(profiles.map((p) => [p.login, p]));
      expect(byLogin["player_1"]!.gold_medals).toBe(1);
      expect(byLogin["player_1"]!.total_games_played).toBe(1);
      expect(byLogin["player_2"]!.silver_medals).toBe(1);
      expect(byLogin["player_3"]!.bronze_medals).toBe(1);

      const pgr = await sql`SELECT * FROM player_game_results`;
      expect(pgr.length).toBe(3);
    });

    it("increments total_games_played for non-medal real players", async () => {
      const userIds = await setupUsersAndGame(true);
      const player4Id = userIds[3]!;

      await repo.saveGameResults(
        1,
        ["player_1", "player_2", "player_3", "player_4"],
        [
          { playerId: "player_1", name: "Player 1", totalTricksTaken: 5 },
          { playerId: "player_2", name: "Player 2", totalTricksTaken: 4 },
          { playerId: "player_3", name: "Player 3", totalTricksTaken: 3 },
        ],
      );

      const profile = await sql<Array<{ total_games_played: number }>>`
        SELECT total_games_played FROM player_profiles WHERE user_id = ${player4Id}
      `;
      expect(profile[0]!.total_games_played).toBe(1);

      const pgr = await sql<
        Array<{ medal: string | null; total_tricks_taken: number }>
      >`
        SELECT medal, total_tricks_taken FROM player_game_results WHERE user_id = ${player4Id}
      `;
      expect(pgr.length).toBe(1);
      expect(pgr[0]!.medal).toBeNull();
      expect(pgr[0]!.total_tricks_taken).toBe(2);
    });

    it("throws when the game does not exist", async () => {
      await expect(repo.saveGameResults(999, ["player_1"], [])).rejects.toThrow(
        "Game 999 not found",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteGame
  // ---------------------------------------------------------------------------

  describe("deleteGame", () => {
    it("removes the game row from the database", async () => {
      await repo.saveGameState(makeGameState(1));
      await repo.deleteGame(1);

      expect(await repo.loadGameState(1)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getUserGameResults
  // ---------------------------------------------------------------------------

  describe("getUserGameResults", () => {
    it("returns all game results for a user", async () => {
      const userId = await repo.createUser("alice", "h", "s");
      await repo.createPlayerProfile(userId);

      await sql`
        INSERT INTO player_game_results (user_id, game_id, medal, total_tricks_taken)
        VALUES
          (${userId}, 10, 'gold', 10),
          (${userId}, 11, NULL,   5)
      `;

      const results = await repo.getUserGameResults(userId);
      expect(results.length).toBe(2);
      expect(results.map((r) => r.gameId)).toContain(10);
      expect(results.map((r) => r.gameId)).toContain(11);
      expect(results.find((r) => r.gameId === 10)?.medal).toBe("gold");
      expect(results.find((r) => r.gameId === 11)?.medal).toBeNull();
    });

    it("returns an empty array when the user has no games", async () => {
      const userId = await repo.createUser("alice", "h", "s");
      await repo.createPlayerProfile(userId);

      expect(await repo.getUserGameResults(userId)).toEqual([]);
    });
  });
});
