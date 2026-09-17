/**
 * Sign in with Google.
 *
 * The browser sends the ID token that Google's button produced. That token is
 * worthless until it is verified, so the first thing this route does is hand it
 * to Google's library, which checks the signature against Google's public keys,
 * the expiry, the issuer, and that the audience is our own client id. A token
 * minted for somebody else's site is rejected here.
 *
 * Only then do we create the account and issue our own session cookie.
 *
 * Environment variables
 *   GOOGLE_CLIENT_ID   the OAuth client id, same value the page uses
 *   DATABASE_URL       your Neon connection string
 *   SESSION_SECRET     32+ random characters, used to sign session cookies
 */

import { OAuth2Client } from 'google-auth-library';
import { upsertUser } from '../_lib/db.js';
import { sign, setCookie } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'GOOGLE_CLIENT_ID is not configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body must be JSON' }); }
  }
  const credential = body && body.credential;
  if (typeof credential !== 'string' || credential.length > 4096) {
    return res.status(400).json({ error: 'Missing Google credential' });
  }

  let claims;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    claims = ticket.getPayload();
  } catch {
    /* Deliberately vague: the caller learns the token was not good, and nothing
       about why, which is all an attacker would be probing for. */
    return res.status(401).json({ error: 'That Google sign in could not be verified' });
  }

  if (!claims || !claims.sub || !claims.email) {
    return res.status(401).json({ error: 'Google did not return an account' });
  }
  if (claims.email_verified === false) {
    return res.status(403).json({ error: 'Verify your email address with Google first' });
  }

  try {
    const user = await upsertUser({
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture
    });

    setCookie(res, sign({ uid: user.id, email: user.email }));
    return res.status(200).json({
      user: { email: user.email, name: user.name, picture: user.picture }
    });
  } catch (err) {
    console.error('sign in failed:', err.message);
    return res.status(500).json({ error: 'Could not finish signing you in. Try again in a moment.' });
  }
}
