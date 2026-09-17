/**
 * Session cookies, signed with HMAC.
 *
 * A session is a small JSON payload plus a signature made with SESSION_SECRET.
 * The browser can read it but cannot change it: any edit breaks the signature
 * and the request is treated as signed out. No session data is trusted until
 * `read` has checked the signature and the expiry.
 *
 * Files under api/_lib are helpers, not routes: Vercel ignores anything whose
 * path starts with an underscore.
 */

import crypto from 'node:crypto';

const COOKIE = 'fq_session';
const TTL_SECONDS = 60 * 60 * 24 * 30;   // thirty days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  }
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function sign(payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }));
  return `${body}.${hmac(body)}`;
}

export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  /* Constant time compare: a plain === leaks how much of the signature matched. */
  const expected = hmac(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** The signed in user, or null. Every protected route starts with this. */
export function read(req) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  return hit ? verify(decodeURIComponent(hit.slice(COOKIE.length + 1))) : null;
}

/* HttpOnly keeps the cookie away from any script on the page, so an injected
   script cannot read it. SameSite=Lax means it is not sent on requests started
   by other sites. */
export function setCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_SECONDS}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
