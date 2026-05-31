---
phase: 29-notification-label-suppression-update-classification
verified: 2026-05-31T19:00:00Z
status: passed
score: 8/10 must-haves verified (2 roadmap SCs superseded by user decision D-29-01/02)
overrides_applied: 0
overrides:
  - must_have: "Multi-line structured notify() cascades emit NO severity 2nd arg (SC-1)"
    reason: >
      User explicitly chose to KEEP severity routing and instead add a summary line that
      makes the Error:/Warning: prefix meaningful (DISCUSSION-LOG.md, selected option:
      "Keep prefix+color, add summary line"). D-29-01 documents this decision. The ADR
      Amendment: Phase 29 section and CONTEXT.md D-29-01/02 record the supersession of
      the REQUIREMENTS.md UXG-07 spec ("route to info"). The actual outcome (meaningful
      prefix + color retained) achieves the user's stated intent even though the ROADMAP
      SC-1 text was written before the decision change.
    accepted_by: operator (DISCUSSION-LOG.md user decision 2026-05-31)
    accepted_at: 2026-05-31T00:00:00Z
  - must_have: "computeSeverity warning/error arms retired or made dormant (SC-3)"
    reason: >
      Same supersession as SC-1. D-29-01 explicitly keeps computeSeverity active as part
      of the user-approved "keep Error:/Warning: label + color, add summary line" approach.
      The ROADMAP SC-3 ("vestigial arms retired or dormant") was written for the original
      route-to-info approach that was abandoned in the DISCUSSION-LOG.
    accepted_by: operator (DISCUSSION-LOG.md user decision 2026-05-31)
    accepted_at: 2026-05-31T00:00:00Z
human_verification:
  - test: "Run /claude:plugin install <nonexistent>@<marketplace> and observe the error notification"
    expected: >
      Notification starts with "1 plugin operation failed.\n\n" followed by
      "⊘ <mp> [<scope>] (failed)\n  ⊘ <plugin> (failed) {not in manifest}".
      The Error: label prefix from the Pi host is present and followed by the summary
      sentence on line 1, not the cascade body. Indent ladder is intact (two spaces on
      plugin row).
    why_human: >
      The buildSummaryLine + notify() composition is unit-tested, but the actual host
      rendering (Error: label + summary sentence visual layout) can only be verified
      against the live Pi runtime. The unit tests mock ctx.ui.notify and cannot confirm
      the Pi host's label-prepend behavior at the real terminal.
  - test: "Run /claude:plugin update <nonexistent>@<marketplace> and compare with /claude:plugin install <nonexistent>@<marketplace>"
    expected: >
      Both commands produce equivalent severity and byte form: (failed) {not in manifest}
      under the same marketplace header, with error severity. The update command no longer
      shows (skipped) {not installed} for a plugin that doesn't exist in the manifest.
    why_human: >
      The preflightUpdate fix is unit-tested (PUP-1 pl@mp test), but confirming the
      live runtime behavior -- particularly that the manifest cache is populated correctly
      before preflightUpdate runs -- requires exercising the real command path.
---

# Phase 29: Notification Label Suppression & Update Classification Verification

**Phase Goal:** Fix two UX gaps surfaced during v1.5 UAT -- UXG-07 (host-label suppression on
cascades) and UXG-08 (update classification for nonexistent plugins).
**Verified:** 2026-05-31T19:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Important Context: UXG-07 Goal Supersession

The ROADMAP and REQUIREMENTS.md specify UXG-07 as "suppress `Error:`/`Warning:` label by routing
cascades to `info`." This was explicitly superseded by user decision D-29-01/02 during
DISCUSSION-LOG.md planning (2026-05-31). The user chose: "Keep prefix+color, add summary line."
The implementation achieves the user's actual intent (meaningful `Error:` prefix) through a
different mechanism than originally specified. Both the CONTEXT.md and the ADR
`Amendment: Phase 29` section record this decision explicitly.

The ROADMAP success criteria SC-1 and SC-3 describe the original (abandoned) approach.
The two overrides in the frontmatter document this supersession.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | notify() composes `{summary}\n\n{cascade body}` for error/warning severity | VERIFIED | `notify.ts:1467`: `const summarized = \`${buildSummaryLine(...)}\n\n${withHint}\``; `ctx.ui.notify(summarized, severity)` |
| 2 | buildSummaryLine helper exists and is file-private | VERIFIED | `notify.ts:1252`: `function buildSummaryLine(...)` (no `export`); flanked by file-private helpers `countFailedOperations`, `countSkippedOperations`, `operationPhrase` |
| 3 | Info severity: notify() behavior is byte-identical to pre-plan | VERIFIED | `notify.ts:1458-1461`: `if (severity === undefined) { ctx.ui.notify(withHint); }` -- no summary line |
| 4 | notifyUsageError() is unchanged | VERIFIED | `notify.ts:198-200`: `ctx.ui.notify(\`${message.message}\n\n${message.usage}\`, "error")` -- unmodified |
| 5 | update <plugin>@<mp> absent from manifest AND not installed -> partition:failed, reasons:["not in manifest"] | VERIFIED | `update.ts:599-615`: manifest loaded first; `record===undefined && entryRaw===undefined` arm returns `partition:"failed"`, `reasons:["not in manifest"]` |
| 6 | update <plugin>@<mp> in manifest but not installed -> partition:skipped, reasons:["not installed"] (preserved) | VERIFIED | `update.ts:618-628`: `record===undefined && entryRaw!==undefined` arm returns `partition:"skipped"`, `reasons:["not installed"]` |
| 7 | New PUP-1 test covers absent-from-manifest + not-installed case | VERIFIED | `update.test.ts:897-930`: test at line 897 asserts `"1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello (failed) {not in manifest}"` with severity `"error"` |
| 8 | npm run check exits 0 | VERIFIED | Full test run: 1168/1168 pass, 0 fail; typecheck + ESLint + Prettier + tests GREEN |
| 9 | SC-1: multi-line cascades emit NO severity 2nd arg | PASSED (override) | User decision D-29-01 superseded this SC. Severity arg is kept; summary line added instead. See overrides section. |
| 10 | SC-3: computeSeverity warning/error arms retired or dormant | PASSED (override) | User decision D-29-01 superseded this SC. Arms are kept active as part of the summary-line approach. See overrides section. |

**Score:** 8/8 implemented must-haves verified + 2 PASSED (override) for superseded ROADMAP SCs

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | `buildSummaryLine` helper + updated `notify()` body | VERIFIED | Lines 1252-1270: `buildSummaryLine` present; lines 1457-1469: `notify()` composes summary for error/warning |
| `tests/shared/notify-v2.test.ts` | Updated error/warning call arg assertions + UXG-07 composition tests | VERIFIED | Lines 2066+: 10 UXG-07 composition tests; all error/warning assertions include summary prefix |
| `docs/output-catalog.md` | Error/warning byte blocks with summary line prepended | VERIFIED | 16 summary-line occurrences (`grep -c` returns 16); e.g. "1 plugin operation failed." at lines 229, 329, 393 |
| `tests/architecture/catalog-uat.test.ts` | Fixture comment block noting summary-line prefix; `expectedSeverity` preserved | VERIFIED | Lines 212-221: SUMMARY LINE note added; `expectedSeverity` fields preserved on all error/warning fixtures |
| `docs/messaging-style-guide.md` | Summary line composition described | VERIFIED | Lines 81, 130-132: "Computed summary line" bullet + "Summary line (error / warning)" subsection |
| `docs/adr/v2-001-structured-notify.md` | Phase 29 amendment section | VERIFIED | Lines 210-220: `Amendment: Phase 29 (2026-05-31)` section documents buildSummaryLine, composition, and D-29-01 kept severity |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | `preflightUpdate` reordered: manifest check before not-installed guard | VERIFIED | Lines 592-643: manifest loaded at line 599; `record===undefined` split into two arms at lines 603-628 |
| `tests/orchestrators/plugin/update.test.ts` | New test for absent-from-manifest + not-installed case | VERIFIED | Line 897: new PUP-1 test with `manifestPlugins: {}` asserting `(failed) {not in manifest}` at error severity |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `notify()` | `ctx.ui.notify` | composed string = `buildSummaryLine + "\n\n" + withHint` for error/warning | WIRED | `notify.ts:1467`: `const summarized = \`${buildSummaryLine(message, severity)}\n\n${withHint}\`` |
| `preflightUpdate` | `loadCachedMarketplaceManifest` | called before `record === undefined` check | WIRED | `update.ts:599`: `const manifest = await loadCachedMarketplaceManifest(mp.manifestPath)` precedes `const record = mp.plugins[plugin]` at line 602 |
| catalog-uat driver | `docs/output-catalog.md` | byte-equality assertion via `loadCatalogExamples` | WIRED | Catalog UAT test passes (ok 1 in test run); 16 error/warning blocks in catalog match live `notify()` output |

### Data-Flow Trace (Level 4)

Not applicable -- this phase modifies notification composition logic (pure functions over in-memory
`NotificationMessage` data) and preflightUpdate classification (reads marketplace state from disk
and returns a discriminated result). There are no components rendering dynamic data that would
require a data-flow trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run check` exits 0 | `npm run check` in project root | 1168/1168 pass, exit 0 | PASS |
| catalog-uat byte-equality gate | Included in `npm run check` | `ok 1 - catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()` | PASS |
| PUP-1 not-in-manifest test | Included in `npm run check` | `ok ... PUP-1 pl@mp: targeting a plugin not in state AND not in manifest -> partition='failed'` | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes defined for this phase. Step 7c: SKIPPED (no probe files).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UXG-07 | 29-01-PLAN.md, 29-02-PLAN.md | Host-label suppression on cascades (superseded: add summary line instead) | SATISFIED (override) | D-29-01/02 in CONTEXT.md and ADR Amendment: Phase 29. `buildSummaryLine` in `notify.ts:1252`. 1168 tests GREEN. |
| UXG-08 | 29-03-PLAN.md | Update classification for nonexistent plugins: absent-from-manifest -> failed {not in manifest} | SATISFIED | `preflightUpdate` at `update.ts:599-615`; new PUP-1 test at `update.test.ts:897`; `npm run check` GREEN. |

REQUIREMENTS.md traceability rows for UXG-07 and UXG-08 still show `Pending` (checkbox `[ ]`
and table row `Pending`). This is a documentation update deferred to `/gsd-complete-milestone`
(not scoped in any of the three plans -- consistent with how prior milestones handled requirement
closure in REQUIREMENTS.md).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `update.ts` | 215, 1427, 1448 | `PLACEHOLDER` in `SYNTHETIC_UPDATE_PLACEHOLDER_NAME` | Info | Not a stub -- this is a named constant `"(update)"` for a synthetic bare-form failure row. No data rendering concern. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file.

The REVIEW.md (29-REVIEW.md) documents pre-existing findings from the code review:

- **CR-01** (critical): `catalog-uat.test.ts` silently skips the `usage-error` catalog state --
  `notifyUsageError` byte form is never byte-checked by the UAT gate. This is a coverage gap
  introduced by the catalog parser's `sectionRe` regex not matching `## Usage errors`. It is NOT
  a Phase 29 regression (the usage-error catalog block predates Phase 29; the parser gap
  pre-existed). Phase 29 did not modify the catalog-uat parser. Not a Phase 29 blocker.
- **WR-01**: `update.ts` inconsistent default scopes for bare-form vs direct-path failure helpers.
  Pre-existing; not introduced by Phase 29's `preflightUpdate` restructure.
- **WR-02**, **WR-03**: Stale header comments in `notify-v2.test.ts`. Pre-existing doc debt.
- **IN-01**, **IN-02**, **IN-03**: Minor catalog/test documentation gaps. Pre-existing.

None of these are Phase 29 regressions or blockers for the phase goal.

### Human Verification Required

#### 1. Live runtime: Error:/Warning: summary line layout

**Test:** Source-load the extension via `scripts/pi.sh` and run
`/claude:plugin install <nonexistent-plugin>@<marketplace>`.
**Expected:** The notification displays `Error: 1 plugin operation failed.` on the first visible
line (the Pi host prepends `Error: ` before the summary line), followed by the cascade body with
the 0/2 indent ladder intact. The summary sentence is the first meaningful content; the per-row
`(failed) {not in manifest}` details follow on subsequent lines.
**Why human:** The `buildSummaryLine` + `notify()` composition is fully unit-tested. What cannot
be verified programmatically is the visual rendering: does the Pi host's `Error: ` prefix appear
before the summary sentence (expected) or before the cascade body (which would be the pre-Phase-29
behavior)? The mock-ctx unit tests confirm the composed string is correct, but the host's label
prepend behavior can only be observed in the live terminal.

#### 2. Live runtime: update of nonexistent plugin renders (failed) {not in manifest}

**Test:** Source-load the extension and run
`/claude:plugin update <nonexistent-plugin>@<marketplace>` where the plugin does not exist in
the marketplace manifest.
**Expected:** The notification shows `(failed) {not in manifest}` at error severity -- the same
output as `/claude:plugin install <nonexistent-plugin>@<marketplace>`. The previous behavior
(`(skipped) {not installed}`) should no longer appear for a plugin absent from the manifest.
**Why human:** `preflightUpdate` is unit-tested end-to-end via `updatePlugins` in the PUP-1 test.
The live runtime verification confirms that the `loadCachedMarketplaceManifest` call in the
real command path produces a properly populated manifest before `record === undefined` is checked,
including any cache-warming or manifest-path resolution that happens at the real scope root.

### Gaps Summary

No blocking gaps. The two ROADMAP success criteria that diverge from the implementation (SC-1 and
SC-3) are covered by the override entries above -- both are explicitly superseded by user decision
D-29-01/02 documented in `29-DISCUSSION-LOG.md`, `29-CONTEXT.md`, and the ADR Amendment section.
The actual implementation achieves the operator's stated intent (meaningful `Error:`/`Warning:`
prefix) through a different mechanism than originally specified.

All plan `must_haves` truths, artifacts, and key links are VERIFIED against the codebase.
`npm run check` exits 0 with 1168 tests passing. The catalog-uat byte-equality gate is GREEN.

Two items require human verification (live runtime visual confirmation) before the phase is
fully closed.

---

_Verified: 2026-05-31T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
