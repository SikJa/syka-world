const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const HTML_TAG = /<[^>]*>/g;
const URL = /\b(?:https?|file):\/\/\S+/giu;
const BEARER = /\bbearer\s+[a-z0-9._~+/=-]{8,}/giu;
const SECRET_ASSIGNMENT = /\b(?:api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/giu;
const SECRET_TOKEN = /\b(?:sk|pk)-[a-z0-9_-]{8,}\b/giu;
const WHITESPACE = /\s+/g;

/**
 * Treat bridge text as untrusted even though the Hermes observer already
 * minimizes it. The UI only receives a compact, single-line summary.
 */
export function sanitizeTaskSummary(value: unknown, maximumLength = 140): string | null {
  if (typeof value !== "string") return null;

  const safeMaximum = Math.max(1, Math.min(280, Math.trunc(maximumLength) || 140));
  let text = value
    .normalize("NFKC")
    .replace(CONTROL_AND_BIDI, "")
    .replace(HTML_TAG, " ")
    .replace(URL, "[link]")
    .replace(BEARER, "[redacted]")
    .replace(SECRET_ASSIGNMENT, "[redacted]")
    .replace(SECRET_TOKEN, "[redacted]")
    .replace(/[<>]/g, "")
    .replace(WHITESPACE, " ")
    .trim();

  if (!text) return null;
  const characters = Array.from(text);
  if (characters.length > safeMaximum) {
    text = `${characters.slice(0, safeMaximum - 1).join("").trimEnd()}…`;
  }
  return text || null;
}

export function sanitizeOpaqueIdentifier(value: unknown, maximumLength = 160): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(CONTROL_AND_BIDI, "")
    .trim()
    .slice(0, maximumLength);
  if (!normalized) return null;
  const safe = normalized.replace(/[^a-zA-Z0-9._:@/+-]/g, "_");
  return safe || null;
}

export function sanitizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

