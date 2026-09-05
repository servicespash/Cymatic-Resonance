import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const DB_URL = process.env.DATABASE_URL;

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

if (!DB_URL) {
  console.error(
    `${COLORS.red}❌ ERROR: DATABASE_URL environment variable is missing.${COLORS.reset}`,
  );
  process.exit(1);
}

async function runAudit() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(
      `${COLORS.blue}🔄 Connecting to live database for deep system audit...${COLORS.reset}`,
    );
    await client.connect();

    // 1. Audit Table Columns
    const schemaRes = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `);

    // 2. Audit RLS Status & Policies (Detailed)
    const rlsRes = await client.query(`
            SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
                   p.policyname, p.cmd
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
            WHERE n.nspname = 'public' AND c.relkind = 'r';
        `);

    // 3. Audit Realtime Publication Status
    const realtimeRes = await client.query(`
            SELECT tablename 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime';
        `);

    console.log(`\n${COLORS.cyan}📊 --- CYMATIC RESONANCE MASTER SYSTEM AUDIT ---${COLORS.reset}`);

    // --- Report RLS ---
    console.log(`\n${COLORS.cyan}🔒 RLS & Policy Audit:${COLORS.reset}`);
    const tables = [...new Set(rlsRes.rows.map((r) => r.table_name))];
    let issuesFound = false;

    for (const table of tables) {
      const tablePolicies = rlsRes.rows.filter((r) => r.table_name === table);
      const isRLSEnabled = tablePolicies[0].rls_enabled;
      const commands = tablePolicies.filter((p) => p.policyname).map((p) => p.cmd);
      const hasAllPolicies = ["SELECT", "INSERT", "UPDATE", "DELETE"].every((cmd) =>
        commands.includes(cmd),
      );

      let status = `${COLORS.green}SECURE${COLORS.reset}`;
      if (!isRLSEnabled) {
        status = `${COLORS.red}UNSECURE (RLS OFF)${COLORS.reset}`;
        issuesFound = true;
      } else if (!hasAllPolicies) {
        status = `${COLORS.yellow}INCOMPLETE POLICIES${COLORS.reset}`;
        issuesFound = true;
      }

      console.log(` - ${table}: ${status} [Policies: ${commands.join(", ") || "NONE"}]`);
    }

    // --- Report Realtime ---
    console.log(`\n${COLORS.cyan}⚡ Active Realtime Tables:${COLORS.reset}`);
    const realtimeTables = realtimeRes.rows.map((r) => r.tablename);
    console.log(
      realtimeTables.length > 0
        ? realtimeTables.join(", ")
        : `${COLORS.yellow}⚠️ No tables in Realtime!${COLORS.reset}`,
    );

    // 4. Frontend Type Sync Check
    const typesPath = path.join(process.cwd(), "src/integrations/supabase/types.ts");
    if (fs.existsSync(typesPath)) {
      const typesContent = fs.readFileSync(typesPath, "utf8");
      const missingTypes: string[] = [];

      const dbTables = [...new Set(schemaRes.rows.map((r) => r.table_name))];
      dbTables.forEach((table) => {
        if (!typesContent.includes(table)) {
          missingTypes.push(table);
        }
      });

      if (missingTypes.length > 0) {
        console.log(
          `\n${COLORS.red}❌ TYPE SYNC ERROR: Missing frontend types: ${missingTypes.join(", ")}${COLORS.reset}`,
        );
        issuesFound = true;
      } else {
        console.log(`\n${COLORS.green}✅ FRONTEND SYNC: Types updated.${COLORS.reset}`);
      }
    }

    // 5. Frontend Usage Check
    const criticalTables = ["messages", "chats", "channels", "call_signals"];
    console.log(`\n${COLORS.cyan}🔎 Critical Service Usage Check:${COLORS.reset}`);
    for (const table of criticalTables) {
      // Check if table is used in src/
      try {
        // Using grep to search for usage
        const usage = execSync(`grep -r "${table}" src/ | wc -l`).toString().trim();
        if (parseInt(usage) > 0) {
          console.log(` - ${table}: ${COLORS.green}Used in ${usage} locations${COLORS.reset}`);
        } else {
          console.log(` - ${table}: ${COLORS.red}NOT FOUND in frontend code!${COLORS.reset}`);
          issuesFound = true;
        }
      } catch (e) {
        console.log(` - ${table}: ${COLORS.red}Usage check failed${COLORS.reset}`);
      }
    }

    await client.end();

    if (issuesFound) {
      console.log(`\n${COLORS.red}🚨 AUDIT FAILED - Fix issues above.${COLORS.reset}`);
      process.exit(1);
    } else {
      console.log(
        `\n${COLORS.green}✨ Audit completed successfully. System healthy.${COLORS.reset}`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${COLORS.red}❌ Database Audit Failed: ${message}${COLORS.reset}`);
    process.exit(1);
  }
}

runAudit();
