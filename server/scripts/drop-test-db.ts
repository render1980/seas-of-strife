import postgres from "postgres";

const adminUrl =
  process.env.DATABASE_ADMIN_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";

const sql = postgres(adminUrl);

try {
  // Terminate lingering connections before dropping
  await sql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'seas_of_strife_test'
      AND pid <> pg_backend_pid()
  `;
  await sql`DROP DATABASE IF EXISTS seas_of_strife_test`;
  console.log("Test database dropped.");
} finally {
  await sql.end();
}