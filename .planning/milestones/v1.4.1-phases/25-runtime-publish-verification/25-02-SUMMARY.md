---
phase: 25-runtime-publish-verification
plan: 02
subsystem: testing
tags: [byte-capture, notify-capture, indent-ladder, snm-38, g-mil-03, refute, display-artifact]

# Dependency graph
requires:
  - phase: 25-runtime-publish-verification
    plan: 01
    provides: "SNM-37 gate -- v0.2.0 source loads via scripts/pi.sh; behavioral byte-form smoke confirms v1.4 identity at the pre-tui notify boundary"
  - phase: 16-renderer
    provides: "0/2/4/6 indent ladder (D-16-04 plugin row 2-space, D-16-08 cause 4 / phase-cause 6) in shared/notify.ts"
  - phase: 17-spec
    provides: "tests/architecture/catalog-uat.test.ts byte-equality gate locking notify() against docs/output-catalog.md"
provides:
  - "SNM-38 (G-MIL-03 indent ladder) reproduced-or-refuted: REFUTE -- renderer emits the catalog-conformant 0/2/4 ladder at ctx.ui.notify; observed 1/3 is a markdown/tui display-layer artifact"
  - "tests/shared/snm38-indent-ladder.test.ts -- explicit per-line leading-whitespace assertion (header 0 / plugin row 2 / cause 4) + full ladder snapshot lock, inside npm run check"
  - "docs/output-catalog.md Indentation discipline clarification noting the display-layer caveat (the byte-exact contract is pre-tui)"
affects: [26 (GREEN gate close)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notify-boundary byte capture: drive notify(ctx, pi, message) through a mock.fn() ctx; compute leading whitespace on the pre-tui body (D-25-09)"
    - "Explicit leading-whitespace readability lock layered on top of the catalog-uat byte-equality gate (drift insurance for Phase 26 GREEN)"

key-files:
  created:
    - "tests/shared/snm38-indent-ladder.test.ts"
  modified:
    - "docs/output-catalog.md"

key-decisions:
  - "D-25-09: byte-evidence-first -- captured indents [0,2,2,2,2,4,0,0,2] at ctx.ui.notify; renderer is catalog-conformant -> REFUTE, no renderer change"
  - "Claude's discretion (RESEARCH Open Q1, RESOLVED yes): added the cheap explicit readability test as drift insurance for Phase 26's GREEN gate"
  - "RESEARCH Pitfall 1: anchored expected indents on notify.ts constants + catalog prose (0/2), NOT the UAT G-MIL-03 truth-line misquote (2/4)"

patterns-established:
  - "Pre-tui notify capture for indent assertions: never assert on post-markdown bytes (that layer introduces the false 1/3)"
  - "Display-layer caveat recorded in the catalog so a 1/3 visual is documented as a display artifact, not a renderer deviation"

requirements-completed: [SNM-38]

# Metrics
duration: 5min
completed: 2026-05-29
---

# Phase 25 Plan 02: SNM-38 G-MIL-03 Indent Ladder REFUTE Summary

**G-MIL-03 indent ladder refuted by binding pre-tui byte evidence: the renderer emits the catalog-conformant 0/2/4 ladder at `ctx.ui.notify`; the observed 1/3 visual is a markdown/tui display-layer artifact, now locked by an explicit leading-whitespace test and recorded as a catalog clarification.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-29T22:07:10Z
- **Completed:** 2026-05-29T22:12:38Z
- **Tasks:** 2
- **Files modified:** 2 (1 test created, 1 catalog doc clarified)

## Byte evidence captured (Task 1, D-25-09)

Drove a representative read-only `/claude:plugin list` `NotificationMessage` through `notify(ctx, pi, message)` with a `mock.fn()` notify-capture ctx (mirroring `catalog-uat.test.ts:149`), read the body from `ctx.ui.notify.mock.calls[0].arguments[0]` (the **pre-tui** bytes), and computed leading whitespace per line as `body.split("\n").map(l => l.length - l.trimStart().length)`.

The fixture exercised an installed/available mix, the `{...}` reason brace, and a `failed`/`cause` row (to reach the 4-space cause trailer):

| Indent (bytes) | Line |
| -------------- | ---- |
| 0 | `● official [user] <autoupdate>` (marketplace header) |
| 2 | `  ● alpha v1.0.0 (installed)` (plugin row) |
| 2 | `  ⊘ epsilon (unavailable) {hooks, lsp}` (plugin row + `{...}` brace) |
| 2 | `  ○ gamma v2.0.0 (available)` (plugin row) |
| 2 | `  ⊘ zeta (failed) {permission denied}` (plugin row) |
| 4 | `    cause: disk write blocked` (cause-chain trailer) |
| 0 | (blank line between marketplace blocks) |
| 0 | `● community [project]` (marketplace header) |
| 2 | `  ● tool v0.5.0 (installed)` (plugin row) |

**`indents = [0, 2, 2, 2, 2, 4, 0, 0, 2]`**

## Catalog ladder compared against (D-16-08 / D-16-04)

The captured bytes were compared against the **catalog** `Indentation discipline` prose (`docs/output-catalog.md:48-54`) and the `notify.ts` renderer constants -- NOT the UAT G-MIL-03 `truth:` line (which misquotes the contract as 2/4; RESEARCH Pitfall 1):

- Marketplace header at **column 0** -- renderer constant: header has NO prefix (`composeMarketplaceBlock:1259`). Match.
- Plugin rows at **2-space** indent -- renderer constant: `"  "` prefix (`composePluginLines:1235`). Match.
- Per-plugin cause-chain trailer at **4-space** indent -- renderer constant: `renderIndentedCauseChain(p.cause, "    ")` (`composePluginLines:1238`). Match.
- (rollback-phase cause at **6-space** -- `renderIndentedCauseChain(phase.cause, "      ")`, `composeRollbackPartialLines:1215`; not exercised by this fixture but constant-verified.)

## Verdict: REFUTE + display-layer caveat

The renderer emits the catalog-conformant **0 / 2 / 4 / 6** ladder. The user's observed "1-space header / 3-space plugin row" (UAT G-MIL-03) is a **markdown/tui display-layer artifact** -- the interactive pi-tui markdown renderer can add a single leading space when it displays the message. The byte-exact contract is asserted **before** that display layer, at `ctx.ui.notify` (D-25-09). This is **not a renderer bug**; no renderer change was made.

The wrong-truth tripwire held: pushing the header to 2 spaces to chase the UAT 2/4 misquote would have broken `tests/architecture/catalog-uat.test.ts` (the catalog shows column 0). That gate stayed green throughout.

## Catalog clarification location

`docs/output-catalog.md` -> `### Indentation discipline` section (after the 0/2/4/6 ladder bullets): a new paragraph states the renderer emits the 0/2/4/6 ladder byte-exact at `ctx.ui.notify` before any markdown/tui layer, that the display layer may add one leading space producing a "1/3" visual, and that this is a display-layer artifact (not a renderer deviation), with both lock tests cited (SNM-38 / G-MIL-03, D-25-09, refuted). The clarification contains the string `display`.

## Task Commits

This is the REFUTE path (no renderer change), so both tasks landed in **one commit** per the plan body. Task 1 produced no file change (byte capture + verdict only); Task 2 created the readability test and the catalog clarification. Because the renderer was already catalog-conformant, the TDD cycle had no RED->GREEN renderer change -- the test locks already-correct behavior as drift insurance and was GREEN on first run.

1. **Tasks 1+2 (REFUTE verdict + readability test + catalog clarification):** `d381e4d` (test)

**Plan metadata:** (docs: complete plan -- the final commit carrying this SUMMARY + STATE.md + ROADMAP.md tracking)

## Files Created/Modified

- `tests/shared/snm38-indent-ladder.test.ts` (created) -- 4 tests: header lines at column 0, plugin rows at 2-space, cause trailer at 4-space, and a full `[0,2,2,2,2,4,0,0,2]` ladder snapshot lock. Captures the pre-tui body via a `mock.fn()` ctx (D-25-09); expected indents anchored on the `notify.ts` constants, not the UAT 2/4 misquote. Lives under `tests/shared/` so it gates `npm run check` (RESEARCH Pitfall 3).
- `docs/output-catalog.md` (modified) -- `Indentation discipline` clarification recording the G-MIL-03 REFUTE verdict + the markdown/tui display-layer caveat.

## Decisions Made

None beyond the locked D-25-* decisions applied as specified (D-25-09 byte-evidence-first REFUTE). The Claude's-discretion regression-test policy was exercised as recommended (RESEARCH Open Question 1, RESOLVED yes): the cheap explicit readability test was added as drift insurance feeding Phase 26's GREEN gate, layered on top of the existing `catalog-uat.test.ts` byte-equality lock.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The byte capture confirmed the RESEARCH HIGH-confidence prediction (catalog-conformant 0/2/4 ladder) on the first run; the new test was GREEN immediately; `npm run check` exited 0 with no formatting/lint rewrites (1137 tests pass, up from 1133 in plan 25-01: +4 new SNM-38 tests).

## Known Stubs

None. No placeholder values, no hardcoded empties, no unwired data sources. The only new artifact is a test plus a documentation clarification; no product code changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SNM-38 is closed (REFUTE, recorded with binding byte evidence + catalog clarification + drift-insurance test inside `npm run check`).
- The existing `catalog-uat.test.ts` byte-equality gate remains the standing ladder lock; the new `snm38-indent-ladder.test.ts` is an explicit readability lock on top of it -- both feed Phase 26's GREEN gate.
- Sibling plan 25-03 (SNM-39, G-MIL-07 tab completion) is independent of this work and unaffected.
- No blockers.

## Self-Check: PASSED

- FOUND: `tests/shared/snm38-indent-ladder.test.ts`
- FOUND: `docs/output-catalog.md` (Indentation discipline clarification, contains `display`)
- FOUND: `.planning/phases/25-runtime-publish-verification/25-02-SUMMARY.md`
- FOUND commit: `d381e4d`

---
*Phase: 25-runtime-publish-verification*
*Completed: 2026-05-29*
