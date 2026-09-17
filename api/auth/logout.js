/**
 * Sign out: clear the session cookie.
 *
 * POST rather than GET, so that a link or an image on another site cannot sign
 * a learner out by being loaded.
 */

import { clearCookie } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  clearCookie(res);
  return res.status(200).json({ ok: true });
}
