/**
 * Database initialization script.
 * Creates a database (optionally) and deploys the schema.
 *
 * Usage:
 *   bun run scripts/init-db.ts                         # apply schema only
 *   bun run scripts/init-db.ts --create <dbName>       # create db + apply schema
 *
 * Environment:
 *   - DATABASE_URL:       Target PostgreSQL URI (schema is applied here)
 *   - DATABASE_ADMIN_URL: Admin URI used for CREATE DATABASE
 *                         (default: postgres://postgres:postgres@localhost:5432/postgres)
 */

import postgres from "postgres";
import { schema } from "../src/db/schema";

/**
 * Creates a PostgreSQL database if it doesn't already exist.
 * Connects via adminUrl (must have CREATEDB privileges).
 */
export async function createDatabase(
  adminUrl: string,
  dbName: string,
): Promise<void> {
  const admin = postgres(adminUrl);
  try {
    await admin`CREATE DATABASE ${admin(dbName)}`;
    console.log(`Database "${dbName}" created.`);
  } catch (err: any) {
    if (err?.code === "42P04") {
      console.log(`Database "${dbName}" already exists, continuing.`);
    } else {
      throw err;
    }
  } finally {
    await admin.end();
  }
}

/**
 * Applies the schema to an existing database connection.
 * Idempotent — uses CREATE TABLE IF NOT EXISTS internally.
 */
export async function applySchema(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(schema);
}

// CLI entrypoint
if (import.meta.main) {
  const args = process.argv.slice(2);
  const createIdx = args.indexOf("--create");
  const dbToCreate = createIdx >= 0 ? args[createIdx + 1] : undefined;

  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error("❌ DATABASE_URL not set.");
    process.exit(1);
  }

  console.log("🚀 Initializing Seas of Strife database...\n");

  try {
    if (dbToCreate) {
      const adminUrl =
        process.env.DATABASE_ADMIN_URL ??
        "postgres://postgres:postgres@localhost:5432/postgres";
      await createDatabase(adminUrl, dbToCreate);
    }

    const sql = postgres(targetUrl);
    try {
      console.log("Applying schema...");
      await applySchema(sql);
      console.log("✅ Schema deployed successfully.\n");

      const tablesRows = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      const tables = tablesRows.map((t: any) => t.table_name as string);

      const expectedTables = [
        "users",
        "player_profiles",
        "games",
        "game_rounds",
        "game_results",
        "player_game_results",
      ];

      console.log(`Tables: ${tables.join(", ")}`);
      const missing = expectedTables.filter((t) => !tables.includes(t));
      if (missing.length > 0) {
        console.warn(`⚠️  Missing tables: ${missing.join(", ")}`);
      } else {
        console.log("✅ All expected tables present.");
      }
    } finally {
      await sql.end();
    }
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}
