import { sql } from "drizzle-orm";

import { db } from "./index.js";

async function checkDatabaseConnection(): Promise<void> {
  try {
    await db.execute(sql`select 1`);
    console.log("Neon database connection successful.");
  } catch {
    console.error("Unable to connect to the Neon database. Check DATABASE_URL and try again.");
    process.exitCode = 1;
  }
}

await checkDatabaseConnection();
