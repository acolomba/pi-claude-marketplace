// shared/regexp.ts
//
// Regular-expression construction helpers shared across layers.

/**
 * Escape regex metacharacters so a value can be interpolated into a RegExp
 * source verbatim (the MDN escape pattern). Plugin names are
 * assertSafeName-checked but may legally contain `.`; escaping neutralizes
 * the whole metacharacter class.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
