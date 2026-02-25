/**
 * Input sanitization to reduce XSS and injection risk when data is stored or used in queries.
 * Defense-in-depth: output encoding remains the primary XSS control when rendering.
 */

const MAX_EMAIL_LENGTH = 255;
const MAX_PHONE_LENGTH = 20;
const MAX_NAME_LENGTH = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Strip characters that can be used in XSS when content is rendered in HTML/JS. */
function stripDangerousChars(s: string): string {
  return s.replace(/[\0<>"'`\\]/g, "");
}

/** Remove control characters and null bytes. */
function stripControlChars(s: string): string {
  return s.replace(/[\0-\x1F\x7F]/g, "");
}

/**
 * Sanitize email before storage: trim, lowercase, length limit, remove dangerous and control chars.
 */
export function sanitizeEmail(email: string): string {
  const trimmed = stripControlChars(String(email)).trim().toLowerCase();
  const safe = stripDangerousChars(trimmed);
  return safe.slice(0, MAX_EMAIL_LENGTH);
}

/**
 * Sanitize phone number: only allow digits, +, -, spaces, parentheses, dot (for extensions).
 * Prevents script injection and limits length.
 */
export function sanitizePhoneNumber(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = stripControlChars(String(value)).trim();
  if (trimmed === "") return null;
  const allowed = trimmed.replace(/[^\d+\-().\s]/g, "");
  return allowed.slice(0, MAX_PHONE_LENGTH) || null;
}

/**
 * Generic string sanitizer for displayable text: trim, length limit, strip dangerous and control chars.
 */
export function sanitizeString(value: string, maxLength: number): string {
  const s = stripControlChars(String(value)).trim();
  return stripDangerousChars(s).slice(0, maxLength);
}

/**
 * Sanitize firstname/lastname: trim, length limit, strip dangerous chars. Empty becomes null.
 */
export function sanitizeName(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = sanitizeString(value, MAX_NAME_LENGTH);
  return s === "" ? null : s;
}

/**
 * Validate and normalize UUID (e.g. from path params) to prevent malformed input in queries.
 * Returns the lowercased UUID if valid, otherwise null.
 */
export function sanitizeUuid(id: string | undefined | null): string | null {
  if (id === undefined || id === null || typeof id !== "string") return null;
  const trimmed = id.trim().toLowerCase();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}
