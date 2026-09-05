import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable is missing.");
  process.exit(1);
}

async function runMasterAudit() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Connecting to live database for comprehensive system master audit...");
    await client.connect();

    // 1. Audit Database Structure (Tables & Columns)
    const schemaRes = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `);

    // 2. Audit RLS Status & Policies
    const rlsRes = await client.query(`
            SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
                   COUNT(p.policyname) AS policy_count
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            GROUP BY c.relname, c.relrowsecurity;
        `);

    // 3. Audit Realtime Publication Status
    const realtimeRes = await client.query(`
            SELECT tablename 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime';
        `);

    console.log("\n======================================================");
    console.log("📊 CYMATIC RESONANCE MASTER SYSTEM AUDIT REPORT");
    console.log("======================================================");

    console.log(
      `\n📦 Database Structure: ${[...new Set(schemaRes.rows.map((r) => r.table_name))].length} Tables, ${schemaRes.rows.length} Columns tracked.`,
    );

    console.log("\n🔒 RLS Status per Table:");
    rlsRes.rows.forEach((row) => {
      const status = row.rls_enabled ? "✅ SECURE (RLS ON)" : "⚠️ WARNING (RLS OFF)";
      console.log(` - ${row.table_name}: ${status} [Policies: ${row.policy_count}]`);
    });

    console.log("\n⚡ Active Realtime Tables:");
    const realtimeTables = realtimeRes.rows.map((r) => r.tablename);
    console.log(
      realtimeTables.length > 0
        ? realtimeTables.join(", ")
        : "⚠️ No tables currently published to Realtime!",
    );

    // 4. Frontend Type Sync Check
    const typesPath = path.join(process.cwd(), "src/integrations/supabase/types.ts");
    console.log("\n🔍 Frontend Type Cross-Reference Check...");
    if (fs.existsSync(typesPath)) {
      const typesContent = fs.readFileSync(typesPath, "utf8");
      const missingTables: string[] = [];

      const dbTables = [...new Set(schemaRes.rows.map((r) => r.table_name))];
      dbTables.forEach((table) => {
        if (!typesContent.includes(table)) {
          missingTables.push(table);
          const columns = schemaRes.rows.filter((r) => r.table_name === table);
          console.log(`\n  ⚠️ Table '${table}' missing in TypeScript types:`);
          columns.forEach((c) => console.log(`    - ${c.column_name} (${c.data_type})`));
        }
      });

      if (missingTables.length > 0) {
        console.log(
          `\n❌ SYNC ERROR: ${missingTables.length} live tables are missing from TypeScript definitions.`,
        );
        process.exitCode = 1;
      } else {
        console.log("✅ FRONTEND SYNC: All live database tables are present in TypeScript types.");
      }
    } else {
      console.log("\nℹ️ NOTICE: Frontend types file not found at expected path.");
    }

    await client.end();
    console.log("\n✨ Master audit completed successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Master Database Audit Failed:", message);
    process.exit(1);
  }
}

runMasterAudit();
