/**
 * Never log a credential.
 *
 * Postgres drivers quote the connection string back at you when they cannot
 * parse it, password and all, and function logs are kept for days. Every catch
 * block that logs an error message puts it through here first.
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
