/**
 * Bun test preload script for DB integration tests.
 * Initialises the database connection once before all test files,
 * and closes it after all test files finish — avoiding the race
 * condition where one file's afterAll(closeDatabase) kills the
 * shared connection for the others.
 *
 * The schema is applied by `scripts/init-db.ts --create` before `bun test` runs.
 */
import { afterAll } from "bun:test";
import { initDatabase, closeDatabase } from "../../../src/db/connection";

initDatabase();

afterAll(async () => {
  await closeDatabase();
});
