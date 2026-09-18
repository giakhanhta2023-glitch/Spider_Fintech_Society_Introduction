/**
 * A learner's saved progress: xp, badges, scores and ticked requirements.
 *
 *   GET  /api/progress   the signed in learner's saved state, or null
 *   PUT  /api/progress   replace it
 *
 * The user is taken from the session cookie and never from the request body, so
 * one account cannot read or overwrite another's progress by asking nicely.
 */

import { loadProgress, saveProgress } from './_lib/db.js';
import { read } from './_lib/session.js';
import { redact } from './_lib/redact.js';

/* Progress for every level is a few kilobytes. Anything far past that is
   either a bug or somebody using the table as free storage. */
const MAX_BYTES = 64 * 1024;

export default async function handler(req, res) {
  let session;
  try {
    session = read(req);
  } catch (err) {
    console.error('session check failed:', err.message);
    return res.status(500).json({ error: 'Sessions are not configured on this deployment' });
  }
  if (!session) return res.status(401).json({ error: 'Not signed in' });

  try {
    if (req.method === 'GET') {
      const row = await loadProgress(session.uid);
      return res.status(200).json({ state: row ? row.state : null, updatedAt: row ? row.updated_at : null });
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body must be JSON' }); }
      }
      const state = body && body.state;
      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return res.status(400).json({ error: 'Send { state: { ... } }' });
      }
      if (JSON.stringify(state).length > MAX_BYTES) {
        return res.status(413).json({ error: 'That progress payload is too large' });
      }

      await saveProgress(session.uid, state);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'GET or PUT' });
  } catch (err) {
    console.error('progress failed:', redact(err.message));
    return res.status(500).json({ error: 'Could not reach the progress database' });
  }
}
