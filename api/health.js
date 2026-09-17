/**
 * Is this deployment wired up?
 *
 *   GET /api/health
 *
 * Reports whether each piece of configuration is present and whether the
 * database answers, without ever returning a value: booleans, table names that
 * are already public in the repository, and error messages with any connection
 * string scrubbed out. Nothing here tells a stranger anything they could use.
 */

import { db } from './_lib/db.js';

/* Driver errors sometimes quote the connection string back at you, password
   and all. Never let one reach the response. */
function safe(message) {
  return String(message || 'unknown')
    .replace(/postgres(ql)?:\/\/\S*/gi, '[connection string]')
    .replace(/password[^,\s]*/gi, '[redacted]')
    .slice(0, 200);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const secret = process.env.SESSION_SECRET || '';
  const out = {
    config: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      SESSION_SECRET: secret.length >= 32 ? true : (secret ? 'too short' : false),
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY
    },
    database: 'not checked',
    tables: []
  };

  try {
    const sql = db();
    await sql`select 1 as ok`;
    out.database = 'reachable';
    const rows = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    out.tables = rows.map((r) => r.table_name);
    out.ready = out.tables.includes('users') && out.tables.includes('progress');
  } catch (err) {
    out.database = 'failed: ' + safe(err.message);
    out.ready = false;
  }

  return res.status(200).json(out);
}
