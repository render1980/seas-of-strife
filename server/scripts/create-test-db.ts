import postgres from "postgres";

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

  await sql`CREATE DATABASE seas_of_strife_test`;
  console.log("Test database created.");
} catch (error) {
  console.error("\n❌ Error initializing database:");
  console.error(error);
  process.exit(1);
}
