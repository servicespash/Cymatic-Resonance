import { Client } from "pg";
import * as fs from "fs";

const DB_URL = process.env.DATABASE_URL;

async function apply() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sql = fs.readFileSync(
    "supabase/migrations/20260922054500_add_updated_at_to_tasks.sql",
    "utf8",
  );

  console.log("Applying migration...");
  await client.query(sql);
  console.log("Migration applied.");

  await client.end();
}
apply();
