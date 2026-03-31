import { beforeEach, describe, expect, it } from "bun:test";
import { GameRepository } from "../../src/db/repositories/GameRepository";
import { GameRegistry } from "../../src/game/GameRegistry";
import { getDb, makePlayers, truncateAllTables } from "./helpers/db";

let sql = getDb()

beforeEach(truncateAllTables);

describe("GameRegistry -> GameRepository -> Postgres", () => {
  it("createGame persists the initial state to the database", async () => {
    const repo = new GameRepository(sql);
    const registry = new GameRegistry(repo);

    const engine = await registry.createGame(1, makePlayers(4));

    expect(engine).toBeDefined();
    expect(registry.listActiveGames()).toContain(1);

    const stored = await repo.loadGameState(1);
    expect(stored).not.toBeNull();
    expect(stored!.gameId).toBe(1);
    expect(stored!.players).toHaveLength(4);
  });

  it("createGame throws on a duplicate gameId", async () => {
    const repo = new GameRepository(sql);
    const registry = new GameRegistry(repo);

    await registry.createGame(1, makePlayers(4));

    await expect(registry.createGame(1, makePlayers(4))).rejects.toThrow();
  });

  it("getOrLoadGame returns the same in-memory instance on cache hit", async () => {
    const repo = new GameRepository(sql);
    const registry = new GameRegistry(repo);

    const engine = await registry.createGame(1, makePlayers(4));
    const fromCache = await registry.getOrLoadGame(1);

    expect(fromCache).toBe(engine);
  });

  it("getOrLoadGame loads from DB when game is not in memory (fresh registry)", async () => {
    const repo = new GameRepository(sql);
    const registry1 = new GameRegistry(repo);
    await registry1.createGame(1, makePlayers(4));

    // Simulate a different server node / restart
    const registry2 = new GameRegistry(repo);
    const engine = await registry2.getOrLoadGame(1);

    expect(engine).not.toBeNull();
    expect(engine!.getGameState().gameId).toBe(1);
    expect(registry2.listActiveGames()).toContain(1);
  });

  it("getOrLoadGame returns null for a non-existent game", async () => {
    const repo = new GameRepository(sql);
    const registry = new GameRegistry(repo);

    expect(await registry.getOrLoadGame(999)).toBeNull();
  });

  it("removeGame evicts from memory but game remains in DB for fresh registries", async () => {
    const repo = new GameRepository(sql);
    const registry1 = new GameRegistry(repo);
    await registry1.createGame(1, makePlayers(4));

    registry1.removeGame(1);
    expect(registry1.listActiveGames()).not.toContain(1);

    // A new registry should still be able to load the game from DB
    const registry2 = new GameRegistry(repo);
    const engine = await registry2.getOrLoadGame(1);
    expect(engine).not.toBeNull();
  });
});
