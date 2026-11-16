export type ActivityNote = {
  note: string;
  before: string | null;
  after: string | null;
};
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function status(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  return object(value) &&
    typeof value.status === 'string' &&
    value.status.trim()
    ? value.status
    : null;
}

/** Histories include legacy free text, status strings and structured status objects.
 * Preserve readable notes and show transitions only when an after-state exists.
 */
export function readActivityNote(raw: string): ActivityNote {
  const fallback = { note: raw, before: null, after: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'string') return { ...fallback, note: value };
    if (!object(value)) return fallback;
    return {
      note: typeof value.note === 'string' ? value.note : raw,
      before: status(value.before),
      after: status(value.after),
    };
  } catch {
    return fallback;
  }
}
