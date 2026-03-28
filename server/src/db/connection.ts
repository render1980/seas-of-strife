import postgres from "postgres";

/**
 * Database connection pool for PostgreSQL.
 * Uses environment variables for configuration:
 * - DATABASE_URL: Full PostgreSQL URI (or construct from individual vars)
 * - DATABASE_HOST: PostgreSQL host (default: localhost)
 * - DATABASE_PORT: PostgreSQL port (default: 5432)
 * - DATABASE_NAME: Database name
 * - DATABASE_USER: Database user
 * - DATABASE_PASSWORD: Database password
 */

let sql: postgres.Sql;

/**
 * Initialize the database connection pool.
 * Call this once on server startup.
 */
export function initDatabase(): postgres.Sql {
  if (sql) {
    return sql;
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    sql = postgres(databaseUrl);
  } else {
    throw new Error("DATABASE_URL not set. Please provide connection parameters from the environment (e.g. by using .env configuration).");
  }

  return sql;
}

/**
 * Get the database connection pool.
 * Must call initDatabase() first.
 */
export function getDb(): postgres.Sql {
  if (!sql) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return sql;
}

/**
 * Close the database connection pool.
 * Call this on server shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (sql) {
    await sql.end();
  }
}
