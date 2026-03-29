import postgres from "postgres";

const adminUrl =
  process.env.DATABASE_ADMIN_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";

const sql = postgres(adminUrl);

try {
  await sql`CREATE DATABASE seas_of_strife_test`;
  console.log("Test database created.");
} catch (e: any) {
  if (e.code === "42P04") {
    // duplicate_database — already exists, fine
    console.log("Test database already exists, continuing.");
  } else {
    throw e;
  }
} finally {
  await sql.end();
}