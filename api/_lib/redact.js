/**
 * Never log a credential.
 *
 * Library errors quote their inputs back at you, and function logs are kept for
 * days, so every catch block that logs a message puts it through here first.
 */

const PATTERNS = [
  [/postgres(?:ql)?:\/\/\S*/gi, '[connection string]'],
  [/\b(?:sk-ant|napi|neon_api_key)[-_][A-Za-z0-9_-]+/gi, '[api key]'],
  [/\bpassword\s*=\s*\S+/gi, 'password=[redacted]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]']
];

export function redact(value, limit = 300) {
  let out = String(value == null ? 'unknown' : value);
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out.slice(0, limit);
}
