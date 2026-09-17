/**
 * The ranking: every member who has signed in, ordered by how far they have got.
 *
 *   GET /api/leaderboard   the ordered board, plus where the caller sits in it
 *
 * Signed in members only. The board is the one place in this app where someone
 * sees another person's data, so it carries the least that will do the job: a
 * display name, two numbers and a position. No email, no photo, no internal id.
 *
 * "Cleared" has to mean here exactly what it means in storage.js, which is a
 * passed drill and a finished build. Every level has one or the other, so the
 * rule below is the same rule the browser applies.
 */

import { db } from './_lib/db.js';
import { read } from './_lib/session.js';
import { redact } from './_lib/redact.js';

/* Enough for a society several times over. The caller's own row is added even
   when it falls outside this, so nobody is ever missing from their own board. */
const TOP = 50;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET' });

  let session;
  try {
    session = read(req);
  } catch (err) {
    console.error('session check failed:', err.message);
    return res.status(500).json({ error: 'Sessions are not configured on this deployment' });
  }
  if (!session) return res.status(401).json({ error: 'Not signed in' });

  try {
    const sql = db();
    const rows = await sql`
      with scored as (
        select
          u.id,
          u.name,
          case when jsonb_typeof(p.state->'xp') = 'number'
               then floor((p.state->>'xp')::numeric)::bigint
               else 0 end as xp,
          (
            select count(*)
            from jsonb_each(
              case when jsonb_typeof(p.state->'levels') = 'object'
                   then p.state->'levels'
                   else '{}'::jsonb end
            ) as lv(key, value)
            where lv.key ~ '^([1-9]|10)$'
              and lv.value->'quizPassed' = 'true'::jsonb
              and lv.value->'projectDone' = 'true'::jsonb
          ) as cleared,
          p.updated_at
        from users u
        join progress p on p.user_id = u.id
      ),
      ranked as (
        select
          scored.*,
          row_number() over (
            order by cleared desc, xp desc, updated_at asc, id asc
          ) as pos,
          count(*) over () as total
        from scored
      )
      select id, name, xp, cleared, pos, total, updated_at
      from ranked
      where pos <= ${TOP} or id = ${session.uid}
      order by pos`;

    const board = rows.map((r) => ({
      pos: Number(r.pos),
      name: r.name || 'a member',
      xp: Number(r.xp),
      cleared: Number(r.cleared),
      you: String(r.id) === String(session.uid),
      active: r.updated_at
    }));

    const you = board.find((r) => r.you) || null;
    /* Trim the timestamp down to a date: when somebody last opened the course
       is worth showing, the minute they did it is not. */
    board.forEach((r) => {
      r.active = r.active ? new Date(r.active).toISOString().slice(0, 10) : null;
    });

    /* Everyone with a progress row, not just the ones on this page. */
    const total = rows.length ? Number(rows[0].total) : 0;
    return res.status(200).json({ board, you, total });
  } catch (err) {
    console.error('leaderboard failed:', redact(err.message));
    return res.status(500).json({ error: 'Could not reach the progress database' });
  }
}
