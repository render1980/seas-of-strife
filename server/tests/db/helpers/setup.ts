/**
 * Bun test preload script for DB integration tests.
 * Initialises the database connection once before all test files,
 * and closes it after all test files finish — avoiding the race
 * condition where one file's afterAll(closeDatabase) kills the
 * shared connection for the others.
 */
import { afterAll, beforeAll } from "bun:test";
import { initDatabase, getDb, closeDatabase } from "../../../src/db/connection";
import { schema } from "../../../src/db/schema";

beforeAll(async () => {
  initDatabase();
  const sql = getDb();
  await sql.unsafe(schema);
});

afterAll(async () => {
  await closeDatabase();
});
