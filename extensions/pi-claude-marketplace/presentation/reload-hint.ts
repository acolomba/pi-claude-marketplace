// presentation/reload-hint.ts
//
// CMC-14 / MSG-RH-1 (style-guide section 5): the reload hint collapses to a
// single canonical trailer "/reload to pick up changes" -- the three-verb
// selector ("load" / "refresh" / "drop") is retired per D-CMC-06.
//
// D-CMC-07: the trailer literal lives as a file-private const here, not as
// a shared/markers.ts export or a shared/grammar/ member. This mirrors the
// MAX_LINE_COLUMN private-constant idiom in presentation/plugin-list.ts:30
// -- a one-consumer literal does not earn extraction.
//
// D-CMC-08: shared/markers.ts retains the legacy RELOAD_HINT_PREFIX export
// as a snapshot-test-only constant through Phase 12; this composer no
// longer imports it. Phase 13's atomic three-file edit (markers.ts +
// markers-snapshot test + PRD §6.12 row) deletes the legacy constant.
//
// Pure string functions -- no IO, no ctx parameter. The orchestrator layer
// decides WHEN to call this (MSG-RH-1 gate: only when generated resources
// changed); this file is the WHAT (the trailer text and the body+hint
// join helper).

/** MSG-RH-1 canonical trailer (D-CMC-07: file-private; see header above). */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

/**
 * MSG-RH-1: render the canonical reload-hint trailer or `""` when no hint
 * is needed.
 *
 *   - 0 names: ""                              (suppression)
 *   - >=1 names: "/reload to pick up changes"  (single canonical trailer)
 *
 * Caller responsibility: pass non-empty `names` ONLY when generated
 * resources actually changed (MSG-RH-1 gate). The `names` argument is
 * checked for non-emptiness only -- the names themselves are NOT
 * interpolated into the trailer (a deliberate regression in user-data
 * exposure from the legacy verb-and-quoted-names form).
 */
export function reloadHint(names: readonly string[]): string {
  return names.length > 0 ? RELOAD_HINT_TRAILER : "";
}

/**
 * Append `hint` to `body` on its own trailing line. When `hint === ""`
 * (MSG-RH-1 suppression), returns the bare body. Used by every orchestrator
 * that may emit a reload hint -- keeps the join logic centralized.
 *
 * TODO (Phase 13, MSG-RH-1): style-guide section 5 specifies the hint is
 * "preceded by one blank line", i.e. a double-newline join. Phase 12
 * intentionally retains the single-newline join to defer the conformance
 * pass to Phase 13's mechanical refactor scope (see 12-RESEARCH.md R7 and
 * Open Question 2). Updating the join shape here is a one-line change
 * (`\n${hint}` → `\n\n${hint}`) and is the SOLE work that turns this
 * composer's output fully conformant with MSG-RH-1.
 */
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
