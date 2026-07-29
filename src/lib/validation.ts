// Length-bounded text helpers for server actions that parse FormData manually
// (i.e. without a Zod schema). Rejecting over-long input - rather than silently
// truncating - prevents storage abuse while keeping stored data intact.
//
// Zod-schema-based actions use `.max(N)` directly; these mirror that behavior
// for the manual-parse call sites.

/** Trim; return null when empty; throw when longer than `max`. */
export function optionalText(
  value: FormDataEntryValue | null | undefined,
  max: number,
): string | null {
  const s = String(value ?? "").trim();
  if (s.length === 0) return null;
  if (s.length > max) {
    throw new Error(`Input too long (max ${max} characters)`);
  }
  return s;
}

/** Trim; throw when empty or longer than `max`. */
export function requiredText(
  value: FormDataEntryValue | null | undefined,
  max: number,
  field = "Field",
): string {
  const s = String(value ?? "").trim();
  if (s.length === 0) throw new Error(`${field} required`);
  if (s.length > max) {
    throw new Error(`${field} too long (max ${max} characters)`);
  }
  return s;
}
