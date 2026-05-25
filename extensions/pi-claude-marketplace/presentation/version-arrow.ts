// presentation/version-arrow.ts -- MSG-PL-3 version-transition slot helper.
//
// Task 260525-cjr C6: lifted from `orchestrators/plugin/update.ts`
// where it was previously a file-private helper. The marketplace-side
// `outcomeToCascadeRow` inlined the same logic; sharing the helper
// keeps both call sites byte-equivalent and means future shape changes
// (e.g. matching `vX` prefix policy, supporting `(unchanged)` rows
// that should still show the version slot) land in one place.
//
// MSG-PL-3 contract: the renderer's `renderVersion(version)` prepends
// `v` to the supplied string. Callers of `composeVersionArrow` should
// pass the bare `fromVersion` (no `v` prefix); this helper returns
// `<from> → v<to>` so the renderer's `v` prefix yields the final
// `v<from> → v<to>` form documented in the catalog
// (`docs/output-catalog.md` lines 419-470).
//
// Pure transform: no I/O, no imports from anywhere else in the
// extension.

/**
 * Compose the MSG-PL-3 version-transition slot.
 *
 *   - both sides undefined         -> `undefined` (no version slot rendered)
 *   - both sides present + differ  -> `"<from> → v<to>"`
 *   - both sides present + equal   -> the single version string (the
 *     `(unchanged)` partition falls into this branch)
 *   - only `to` present            -> `to`
 *   - only `from` present          -> `from`
 *
 * Returning `undefined` lets the caller omit the version slot via a
 * conditional spread (e.g. `...(version !== undefined && { version })`).
 */
export function composeVersionArrow(
  from: string | undefined,
  to: string | undefined,
): string | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  if (from !== undefined && to !== undefined && from !== to) {
    return `${from} → v${to}`;
  }

  if (to !== undefined) {
    return to;
  }

  return from;
}
