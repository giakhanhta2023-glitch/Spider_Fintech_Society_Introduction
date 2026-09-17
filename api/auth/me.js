/**
 * Who is signed in, according to the cookie.
 *
 * The page calls this on load to decide whether to show the course or the sign
 * in screen. It answers from the signed cookie alone, with no database round
 * trip, so the gate does not wait on Neon waking up.
 */

import { read } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  let session;
  try {
    session = read(req);
  } catch (err) {
    console.error('session check failed:', err.message);
    return res.status(500).json({ error: 'Sessions are not configured on this deployment' });
  }

  if (!session) return res.status(401).json({ error: 'Not signed in' });
  return res.status(200).json({ user: { email: session.email } });
}
