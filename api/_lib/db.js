/**
 * The Neon connection, plus the two queries every route needs.
 *
 * Neon's serverless driver talks to Postgres over HTTP, which is what makes it
 * usable from a function that may be cold and may live for one request. The
 * tagged template is parameterised: values interpolated into sql`...` are sent
 * as bound parameters, never as string concatenation, so a name containing a
 * quote is data rather than SQL.
 */

import { neon } from '@neondatabase/serverless';

let cached = null;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add your Neon connection string to the project.');
  }
  if (!cached) cached = neon(process.env.DATABASE_URL);
  return cached;
}

/** Create the user on first sign in, refresh their details on every one after. */
export async function upsertUser({ sub, email, name, picture }) {
  const sql = db();
  const rows = await sql`
    insert into users (google_sub, email, name, picture)
    values (${sub}, ${email}, ${name || null}, ${picture || null})
    on conflict (google_sub) do update
      set email = excluded.email,
          name = excluded.name,
          picture = excluded.picture,
          last_seen_at = now()
    returning id, email, name, picture`;
  return rows[0];
}

export async function loadProgress(userId) {
  const sql = db();
  const rows = await sql`select state, updated_at from progress where user_id = ${userId}`;
  return rows[0] || null;
}

export async function saveProgress(userId, state) {
  const sql = db();
  await sql`
    insert into progress (user_id, state)
    values (${userId}, ${JSON.stringify(state)}::jsonb)
    on conflict (user_id) do update
      set state = excluded.state,
          updated_at = now()`;
}
