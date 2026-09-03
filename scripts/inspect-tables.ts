import { Client } from 'pg';
const DB_URL = process.env.DATABASE_URL;

async function inspect() {
    const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const res = await client.query(`
        SELECT tablename, schemaname 
        FROM pg_tables 
        WHERE tablename IN ('messages', 'channels', 'chats', 'call_signals')
        UNION
        SELECT viewname as tablename, schemaname 
        FROM pg_views 
        WHERE viewname IN ('messages', 'channels', 'chats', 'call_signals');
    `);

    console.log(res.rows);

    const policies = await client.query(`
        SELECT tablename, policyname, cmd, permissive, roles, qual, with_check 
        FROM pg_policies 
        WHERE tablename IN ('messages', 'channels', 'chats', 'call_signals');
    `);

    console.log(JSON.stringify(policies.rows, null, 2));

    await client.end();
}
inspect();
