/**
 * Database initialization script.
 * Deploys the schema to PostgreSQL (local or Railway).
 *
 * Usage:
 *   bun run scripts/init-db.ts
 *
 * Environment:
 *   - DATABASE_URL: PostgreSQL connection URI (takes precedence)
 *   - DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD: Individual vars
 */

import postgres from "postgres";
import { schema } from "../src/db/schema";

async function main(): Promise<void> {
  console.log("🚀 Initializing Seas of Strife database...\n");

  // Get connection config from environment
  const databaseUrl = process.env.DATABASE_URL;
  let sql: postgres.Sql;

  try {
    if (databaseUrl) {
      console.log(`📍 Using DATABASE_URL`);
      sql = postgres(databaseUrl);
    } else {
      throw new Error(
        "DATABASE_URL not set. Please provide connection parameters from the environment (e.g. by using .env configuration).",
      );
    }

    // Test connection
    console.log("Testing connection...");
    await sql`SELECT 1`;
    console.log("✅ Connection successful\n");

    // Run schema
    console.log("Executing schema...");
    await sql.unsafe(schema);
    console.log("✅ Schema deployed successfully\n");

    // Verify tables
    console.log("Verifying tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const expectedTables = [
      "users",
      "player_profiles",
      "games",
      "game_rounds",
      "game_results",
      "player_game_results",
    ];

    const createdTables = tables.map((t: any) => t.table_name);
    const allTablesCreated = expectedTables.every((t) =>
      createdTables.includes(t),
    );

    console.log(`\nTables created: ${createdTables.join(", ")}`);

    if (allTablesCreated) {
      console.log("\n✅ All expected tables created successfully!");
    } else {
      const missing = expectedTables.filter((t) => !createdTables.includes(t));
      console.warn(`⚠️  Missing tables: ${missing.join(", ")}`);
    }

    // Show table row counts
    console.log("\n📊 Table row counts:");
    for (const tableName of expectedTables) {
      if (createdTables.includes(tableName)) {
        const count = await sql`SELECT COUNT(*) as cnt FROM ${sql(tableName)}`;
        console.log(`   ${tableName}: ${count[0]?.cnt} rows`);
      }
    }

    console.log("\n✅ Database initialization complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error initializing database:");
    console.error(error);
    process.exit(1);
  }
}

main();
