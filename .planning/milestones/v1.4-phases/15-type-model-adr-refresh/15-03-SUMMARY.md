---
phase: 15-type-model-adr-refresh
plan: 03
subsystem: docs/adr
tags: [adr, notify, structured-notify, design-pivot, v1.4]
requires:
  - "Plan 15-01 (shared/notify.ts ships the 11 SNM-01..SNM-11 type symbols cited in the refreshed Decision section)"
  - "Plan 15-02 (compile-check arch test grounds the type-shape claims the ADR documents)"
provides:
  - "docs/adr/v2-001-structured-notify.md: Status flipped Proposed -> Accepted (Phase 15, 2026-05-25)"
  - "docs/adr/v2-001-structured-notify.md: Decision section rewritten to single notify(ctx, NotificationMessage) + discriminated-union shape (SNM-01..SNM-11 + SNM-14..SNM-17)"
  - "docs/adr/v2-001-structured-notify.md: Consequences section rewritten with computed severity / computed reload-hint / render-time dependency probe / per-plugin causes / always-marketplace-header spec change"
  - "docs/adr/v2-001-structured-notify.md: Alternative 2 flipped Rejected -> ACCEPTED with v1.4 design-pivot note"
  - "docs/adr/v2-001-structured-notify.md: Migration section cites Phase 16-21 concretely + drift-mitigation paragraph pointing to REQUIREMENTS.md traceability"
  - "docs/adr/v2-001-structured-notify.md: Open Questions section deleted (Q1 + Q2 resolved structurally)"
affects: []
tech-stack:
  added: []
  patterns:
    - "ADR refresh pattern: title + Context preserved byte-identical; Status/Decision/Consequences/Alternatives/Migration rewritten in place; Open Questions deleted"
key-files:
  created: []
  modified:
    - "docs/adr/v2-001-structured-notify.md (+112 / -85; 170 -> 197 lines)"
decisions:
  - "Restored *because* asterisk-emphasis in the Context section after prettier --write rewrote it to _because_ underscore-emphasis. Preserves D-15-13's BYTE-IDENTICAL Context carve-out (MD5 match against HEAD~ lines 7-16). The rest of the file accepts prettier's normalized form; npm run check (which runs format:check on .js/.json/.ts only -- not .md) passes; markdownlint-cli2 passes; prettier --check on the markdown file warns but no enforcement gate runs prettier against markdown."
metrics:
  duration: "~8m"
  completed: "2026-05-25T22:36:58Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 0
  loc_added: 112
  loc_removed: 85
---

# Phase 15 Plan 03: ADR v2-001 Refresh Summary

Refreshed `docs/adr/v2-001-structured-notify.md` end-to-end to the v1.4 locked design (single `notify(ctx, NotificationMessage)` entrypoint with discriminated union on `status`), preserved the title + Context section byte-identical per D-15-13, flipped Alternative 2 from Rejected to ACCEPTED per D-15-16, rewrote the Migration section with concrete Phase 16-21 references per D-15-15, and deleted the Open Questions section per D-15-14. SNM-21 closes here; `npm run check` GREEN against HEAD.

## Net LoC

| File                                  | Added | Removed | Net  |
| ------------------------------------- | ----- | ------- | ---- |
| docs/adr/v2-001-structured-notify.md  | +112  | -85     | +27  |
| **TOTAL**                             | +112  | -85     | +27  |

File grew from 170 to 197 lines. The body shift reflects the Decision section expanding to document the 10-variant discriminated union, the Consequences section gaining 6 subsections (Removed at compile time / Custom ESLint plugin deleted / Coverage moves / Other consequences / Costs / Net code delta), and the Migration section gaining per-phase concrete bullets. Open Questions section deleted entirely (4 lines).

## D-15-13 Carve-out Honored: Title + Context Byte-Identical

The plan's must-have truth #1 states the title line and Context section (pre-refresh lines 7-16) remain BYTE-IDENTICAL. Verified:

```text
=== Title line (line 1) ===
HEAD~1: # ADR-v2-001: Structured `notify` payload with typed wrappers
HEAD  : # ADR-v2-001: Structured `notify` payload with typed wrappers
(byte-identical)

=== Context section (lines 7-16) ===
HEAD~1 MD5: a0469c4e020afbb314ee3bd16f9cfc46
HEAD   MD5: a0469c4e020afbb314ee3bd16f9cfc46
(byte-identical)
```

Range stayed at lines 7-16 in both HEAD~1 (the pre-refresh file) and HEAD (the refreshed file). The Status line at line 3 flipped from `Proposed (v2 target)` to `Accepted (Phase 15, 2026-05-25)`; the Date line at line 4 was already `2026-05-25`; the Supersedes line at line 5 stayed unchanged. No other line in the lines 1-16 range moved.

## SNM-21 Closure: Status Line Text

The Status line at line 3 reads, exactly:

```text
- **Status:** Accepted (Phase 15, 2026-05-25)
```

Acceptance criterion `grep -c "^- \*\*Status:\*\* Accepted (Phase 15, 2026-05-25)$" docs/adr/v2-001-structured-notify.md` returns `1`. Acceptance criterion `grep -c "^- \*\*Status:\*\* Proposed" ...` returns `0`. SNM-21 closes.

## D-15-15 Migration: 14 Phase 16-21 References

`grep -cE "Phase 1[6-9]|Phase 2[01]" docs/adr/v2-001-structured-notify.md` returns `14` (exceeds AC floor of 6). The Migration section bullets cite each phase concretely:

| Reference                                              | Lines (current file)                                       | Purpose                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Phase 15` (this ADR; SNM-21 closure)                 | Migration bullet 1 (line 191)                              | Type model + arch test land; no call sites change                                                |
| `Phase 16` (renderer + public API; SNM-17/SNM-30)     | Decision (lines 46, 50) + Migration bullet 2 (line 192)    | `notify(ctx, NotificationMessage)` + `notifyUsageError(ctx, UsageErrorMessage)` introduced       |
| `Phase 17` (spec rewrite + catalog UAT; SNM-20/SNM-31) | Decision (line 125) + Consequences (line 150) + Migration bullet 3 (line 193) | `output-catalog.md` always-marketplace-header rewrite + catalog UAT structured-fixture migration |
| `Phases 18-20` (call-site migration; SNM-23)          | Migration bullet 4 (line 194)                              | Marketplace / plugin / edge+UsageError migration waves                                           |
| `Phase 21` (V1 wrapper deletion + GREEN gate; SNM-22/24/25/27/28/29/32) | Consequences (lines 146, 167) + Migration bullet 5 (line 195) | V1 wrapper deletion, lint plugin teardown, eslint.config.js swap, npm run check GREEN against minimal surface |

Drift mitigation paragraph at line 197: "If the phase numbers shift between this ADR's acceptance and the final teardown, the canonical traceability is `.planning/REQUIREMENTS.md`'s phase-mapping table (Phase column per SNM-* row); this ADR's phase numbers are informative, not binding."

## D-15-16 Alternative 2: Flipped Rejected -> ACCEPTED

`grep -c "ACCEPTED (v1.4 design pivot)" docs/adr/v2-001-structured-notify.md` returns `1`. Alternative 2's bullet (line 181) now opens with the marker phrase and explains the pivot:

> **Single `notify(ctx, payload)` only, no typed wrappers. ACCEPTED (v1.4 design pivot).** Discriminated-union literal narrowing on `status:` recovers per-outcome-wrapper autocomplete ergonomics without the per-wrapper file maintenance cost; `assertNever` in the `notify()` switch retains the compile-error gate that motivated the original wrappers...

Alternatives 1, 3, 4, 5, 6 remain Rejected with their original reasoning intact:

| Alt | Status     | Bullet line |
| --- | ---------- | ----------- |
| 1   | Rejected   | 179         |
| 2   | ACCEPTED   | 181         |
| 3   | Rejected   | 183         |
| 4   | Rejected   | 185         |
| 5   | Rejected   | 187         |
| 6   | Rejected (conditional: "Reject unless the union becomes unwieldy.") | 189         |

`grep -c "Rejected" docs/adr/v2-001-structured-notify.md` returns `5` (≥5 required).

## D-15-14 Open Questions Section: Deleted

`grep -cE "^## Open questions" docs/adr/v2-001-structured-notify.md` returns `0`. The section is absent. The two open questions are inline-resolved:

- **Q1 (cascade-section abstraction)**: resolved by the single `PluginNotificationMessage` discriminated union plus the always-marketplace-header spec change. The Decision section's "NotificationMessage shape" subsection (lines 76-124) documents that marketplaces always render a header at column 0 with plugin rows indented two spaces -- no separate cascade-section abstraction needed.
- **Q2 (runtime validation of Scope / Reason / StatusToken)**: resolved by the compile-enforced discriminated union (Plan 01's type model) + `assertNever` in the Phase 16 `notify()` switch (Decision section "Implementation seam" subsection, lines 48-74). The Phase 15 compile-check arch test (Plan 02) seals the type model at typecheck time; no runtime validator is added.

## Verification Step 7: Success Criterion #4 Holds

```bash
git grep -nE "\b(PluginNotificationMessage|MarketplaceNotificationMessage|UsageErrorMessage|NotificationMessage|PluginStatus|MarketplaceStatus|MarketplaceDetails)\b" \
  -- 'extensions/' ':!extensions/pi-claude-marketplace/shared/notify.ts'
```

Returns EMPTY. No file under `extensions/` references the new type symbols outside their declaration site in `shared/notify.ts`. The arch-test file at `tests/architecture/notify-types.test.ts` (Plan 02's deliverable) lives under `tests/architecture/`, NOT `extensions/`, and is correctly outside the SC#4 grep scope. Plan 03 added zero new references -- the ADR is markdown, not TypeScript.

## Deviations from Plan

### `[Rule 1 - Bug: prettier-driven Context-section emphasis transform]` Restored `*because*` after `prettier --write`

- **Found during:** Task 1 verification, after `npx prettier --write docs/adr/v2-001-structured-notify.md` ran per the plan's `<action>` instruction.
- **Issue:** Prettier rewrote the Context section's `*because*` (asterisk emphasis) to `_because_` (underscore emphasis) on line 16 -- a one-byte-equivalent normalization. This broke the must-have truth #1 BYTE-IDENTICAL claim for the Context section (lines 7-16): MD5 diverged from `a0469c4e020afbb314ee3bd16f9cfc46` to `633bb300647176c0fa797b34c1801736`. The grep-based acceptance criterion (`"V1 ships a stringly-typed user-output surface"` still returned 1) would have masked this drift if accepted.
- **Fix:** Restored the single byte difference (`_because_` -> `*because*`) on line 16. Context section MD5 is once again `a0469c4e020afbb314ee3bd16f9cfc46`, matching HEAD~1 exactly. The rest of the file retains prettier's normalized form (the rewritten Decision / Consequences / Alternatives / Migration sections were composed during the rewrite step and prettier-normalized in one pass; no downstream MD5 invariant exists for those sections). The project's `npm run check` runs `format:check` on `.js/.json/.ts` only -- not `.md` -- so the surviving `*because*` does not gate the build. `markdownlint-cli2` (the only pre-commit hook that touches markdown) passes; the standalone `prettier --check` on the markdown file warns but no enforcement gate runs it.
- **Files modified:** `docs/adr/v2-001-structured-notify.md` (line 16 only).
- **Commit:** `041e6ef` (single plan commit, includes both the rewrite and the byte-restore).

No Rule 2, Rule 3, or Rule 4 deviations occurred.

## Authentication Gates

None.

## Threat Flags

None. Per the plan's `<threat_model>`, Phase 15 Plan 03 edits a single markdown ADR -- no code paths, no user input, no network, no disk mutation outside the planner's commit. T-15-04 (tampering with the Context section) was mitigated by the byte-identical restoration documented above + the per-task acceptance criterion grep + the MD5 verification done before and after commit.

## Verification Results

| Check                                                                          | Result |
| ------------------------------------------------------------------------------ | ------ |
| Title line preserved byte-identical (HEAD~1 line 1 vs HEAD line 1)             | PASS   |
| Context section preserved byte-identical (HEAD~1 lines 7-16 MD5 = HEAD MD5)    | PASS   |
| Status flip: `^- \*\*Status:\*\* Accepted (Phase 15, 2026-05-25)$` returns 1   | PASS   |
| No leftover `Proposed`: `^- \*\*Status:\*\* Proposed` returns 0                | PASS   |
| Alt-2 flipped: `ACCEPTED (v1.4 design pivot)` returns 1                        | PASS   |
| Alternatives 1, 3, 4, 5, 6 still Rejected: `Rejected` returns 5                | PASS   |
| Phase 16-21 references: `Phase 1[6-9]\|Phase 2[01]` returns 14 (>=6 required)  | PASS   |
| Open Questions deleted: `^## Open questions` returns 0                         | PASS   |
| V1.4 type names cited: 35 references (>=8 required)                            | PASS   |
| 10-status closed-set referenced: 27 occurrences (>=10 required)                | PASS   |
| `always-marketplace-header\|marketplace header at column 0`: 3 occurrences     | PASS   |
| Dropped top-level trailer cited: 2 occurrences (>=1 required)                  | PASS   |
| Per-plugin causes cited: 2 occurrences (>=1 required)                          | PASS   |
| Only `docs/adr/v2-001-structured-notify.md` changed in commit                  | PASS   |
| `npm run check` exits 0 (1327 tests, 90 suites, all pass)                      | PASS   |
| Branch is not `main` (`worktree-agent-acad067485e6d9274`)                      | PASS   |
| Commit title matches `^docs\(adr\): refresh v2-001 -- single-notify locked design \(SNM-21\)$` (65 chars, <=72) | PASS |
| Commit body lines all <=80 chars                                                | PASS   |
| Single file in commit                                                          | PASS   |
| Pre-commit hooks (all except trufflehog -- worktree sandbox bug per CLAUDE.md) | PASS   |
| Trufflehog (standalone scan from main repo)                                    | PASS   |
| markdownlint-cli2 on the ADR                                                   | PASS   |
| SC#4 word-boundary grep against `extensions/` returns empty                    | PASS   |

## Commit

- **Hash:** `041e6ef`
- **Branch:** `worktree-agent-acad067485e6d9274` (worktree; merges to `gsd/v1.3-replan-catalog` after wave 3 completes)
- **Title:** `docs(adr): refresh v2-001 -- single-notify locked design (SNM-21)`
- **Files:** `docs/adr/v2-001-structured-notify.md` (only)
- **Stat:** 1 file changed, 112 insertions(+), 85 deletions(-)

## Requirements Satisfied

| Req    | Statement                                                                              | Where                                                                                                          |
| ------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SNM-21 | ADR v2-001 refreshed to Accepted with single-notify locked design                      | `docs/adr/v2-001-structured-notify.md:3` (Status line) + lines 18-197 (rewritten Decision through Migration)   |

## Plan-Level Wrap-Up

All three Phase 15 plans are complete:

| Plan  | Subsystem              | Status | Key Output                                                                                          |
| ----- | ---------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| 15-01 | shared/notify.ts       | DONE   | 11 SNM-01..SNM-11 type symbols + 3 const tuples (+365 LoC, commit 2d5e42a)                          |
| 15-02 | tests/architecture     | DONE   | notify-types.test.ts compile-check arch test (570 LoC, 52 `_Assert_*` + 53 `@ts-expect-error`, commit 427d08d) |
| 15-03 | docs/adr               | DONE   | v2-001-structured-notify.md refreshed (+112 / -85, commit 041e6ef)                                  |

Phase 15 moves to verification:

1. All 12 requirements (SNM-01..SNM-11 + SNM-21) closed.
2. `npm run check` GREEN against HEAD (1327 tests, 90 suites, 0 failures).
3. Success Criterion #4 (zero call-site references to new symbols in `extensions/`) holds across all three wave merges.
4. ADR is the binding contract for Phases 16-21; the Migration section's drift-mitigation paragraph cedes phase-number authority to `.planning/REQUIREMENTS.md`'s traceability table.

The orchestrator owns the post-merge STATE.md / ROADMAP.md / REQUIREMENTS.md updates after the wave 3 worktree merges to `gsd/v1.3-replan-catalog`.

## Self-Check: PASSED

- File `docs/adr/v2-001-structured-notify.md` exists (197 lines; +112 / -85 vs HEAD~1).
- Commit `041e6ef` exists in `git log` (`git log --oneline | grep 041e6ef`).
- Status line at line 3 is exactly `- **Status:** Accepted (Phase 15, 2026-05-25)`.
- Title (line 1) + Context (lines 7-16) MD5 match HEAD~1 byte-for-byte.
- 14 Phase 16-21 references in the Migration section.
- Alternative 2 carries the `ACCEPTED (v1.4 design pivot)` marker.
- Open Questions section absent.
- SC#4 word-boundary grep against `extensions/` empty.
- `npm run check` exits 0.
- Commit is on the worktree-agent branch (not `main`); single file; 65-char title (<=72); body lines all <=80; pre-commit hooks ran clean (trufflehog skipped per CLAUDE.md worktree-sandbox guidance + scanned standalone from main repo).
