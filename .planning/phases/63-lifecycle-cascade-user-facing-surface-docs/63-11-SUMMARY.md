---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 11
subsystem: docs/uat-closure
tags: [SURF-06, docs, UAT, runtime-verification, Option-A-deferral, v1.13-close-out]
requires:
  - 63-09-SUMMARY.md (wrapper-format wire-contract fix; Option A Stop deferral)
  - 63-10-SUMMARY.md (cross-surface classifier parity arm)
  - tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json (upstream wire-format authority)
provides:
  - "README.md ## Features bullet list now lists Hooks alongside Commands / Skills / Agents / MCP servers (alphabetical-by-COMPONENT_KINDS slot between Agents and MCP servers; markdown link to docs/hooks.md matches the existing `## Hook support` section's link form)."
  - "Runtime UAT closure for phase 63: tests 3/4/5 transitioned from `issue` to terminal `blocked` state with `evidence:` / `reason:` / `closed_by:` / `deferred_to:` annotations. Original `reported:` blocks preserved as `reported_pre_fix:` for the lineage record."
  - "Phase 63 UAT loop closed with deferrals. Top-level UAT `status: diagnosed` -> `status: resolved`. All three originally-failed gap entries annotated as resolved or resolved-with-deferrals."
affects:
  - "v1.13 milestone close-out readiness -- developer's call on next steps (mvp-phase complete / gsd-cleanup / npm publish per project milestone-close discipline)."
  - "v1.14+ planning -- the deferred Stop-event admission to BUCKET_A_EVENTS is the next-milestone follow-up surfaced by this UAT closure."
tech-stack:
  added: []
  patterns:
    - "UAT closure-with-deferrals pattern: tests reach terminal `blocked` state when the diagnosed root cause is closed but a structural scope decision (Option A) leaves a residual user-surface trip. Distinguishes honest scope-deferral from defect."
key-files:
  created:
    - .planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-11-SUMMARY.md
  modified:
    - README.md (Hooks bullet in `## Features` list -- commit 7967ea8)
    - .planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md (verdicts, summary counts, gaps annotations -- commit 939574d)
decisions:
  - "Tests 3/4/5 result set to `blocked` (not `pass`) because the binding plan truths (`hookify installs cleanly end-to-end`) are not satisfiable in v1.13 -- the structural Option A deferral from 63-09 means hookify still flips `(unavailable) {unsupported hooks}` at runtime via the bucket-A supportability gate. Recording `pass` would have been dishonest; recording `issue` would have implied a defect when the trip is by-design v1.13 scope."
  - "Top-level UAT `status: resolved` (not `passed`): the UAT loop has closed -- every test has a terminal verdict, the residual gap is owned by v1.14+, no further runtime verification is pending against v1.13 scope."
  - "Original `reported:` blocks renamed to `reported_pre_fix:` (not deleted) per the project's roadmap-evolution discipline -- preserves the user-reported lineage record for v1.14+ audit."
  - "No `npm run check` re-run required for this plan -- the wave-end `npm run check` from 63-10 (2280 unit + 10 integration GREEN) covered the production state; 63-11 touched only README.md, 63-UAT.md, and 63-11-SUMMARY.md (no `extensions/` or test-file changes)."
requirements-completed: [SURF-06]
metrics:
  duration: 15min
  completed: 2026-06-16
---

# Phase 63 Plan 11: README Bullet + Runtime UAT Closure-with-Deferrals Summary

**One-liner:** Closed the cosmetic UAT gap 3 (Hooks bullet in README `## Features` list) and recorded the binding runtime UAT against the pi-uat sandbox -- the wrapper-format fix (63-09) and cross-surface classifier parity (63-10) land correctly at runtime; the residual `(unavailable) {unsupported hooks}` trip on hookify is the honest v1.13 bucket-A supportability gate (Stop-event admission deferred to v1.14+ per 63-09 Option A), not a defect.

## Status

`complete with deviation` -- the cosmetic README fix and the runtime-UAT recording land verbatim, but the plan's binding must-have truths #3 / #4 / #5 ("tests 3/4/5 succeed end-to-end") are not satisfiable in v1.13. The runtime UAT instead confirms the Option A structural trip is honest and well-classified. See Deviation below.

## What landed

### Commits (2, oldest -> newest)

| Commit    | Subject                                                                  | Role                                                    |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `7967ea8` | `docs(63-11): add Hooks bullet to README Features list`                  | Task 1: cosmetic README bullet (UAT gap 3 closure)      |
| `939574d` | `test(63-11): record runtime UAT verdicts after 63-09 + 63-10 fixes`     | Task 2 (renumbered from plan Task 3): runtime UAT close |

(The plan's Task 2 human-verify checkpoint was satisfied by the operator's runtime UAT against the pi-uat sandbox; the prior agent stopped at that checkpoint, this continuation agent resumed after the operator's verdict.)

### README.md `## Features` Hooks bullet (commit 7967ea8)

- New bullet at line 28: `- Hooks. See [Hook support reference](docs/hooks.md).`
- Slotted between Agents and MCP servers (matches the COMPONENT_KINDS tuple position `agents -> commands -> hooks -> mcp -> skills`).
- Markdown link form `[Hook support reference](docs/hooks.md)` matches the existing `## Hook support` section at README.md:176 -- the same anchor target is reachable from two README surfaces.
- No companion-package `Requires ...` clause: v1.13 hook support is in-extension (no peer-dep dependency analogous to pi-subagents or pi-mcp-adapter).

### 63-UAT.md runtime UAT closure (commit 939574d)

Frontmatter:
- `status: diagnosed` -> `status: resolved`.
- Added `previous_status: "diagnosed"` (quoted per the GSD memory note on debt-scan false positive).
- `updated:` refreshed to 2026-06-16T21:40:59Z.
- `source:` list extended to include 63-09 / 63-10 / 63-11 summaries.

Test verdicts (3 / 4 / 5):
- All three transitioned `result: issue` -> `result: blocked`.
- Each gained `evidence:` (runtime output + on-disk verification), `reason:` (structural scope explanation), `closed_by:` (which plans closed the diagnosed root cause), and `deferred_to:` ("v1.14+ (Stop-event admission to BUCKET_A_EVENTS)").
- Original `reported:` blocks preserved verbatim as `reported_pre_fix:` for the lineage record.

Summary block:
- `passed: 4` / `issues: 3` / `blocked: 0` -> `passed: 4` / `issues: 0` / `blocked: 3`.
- Added `notes:` block explaining the terminal state.

Gaps block (three entries):
- Gap 1 (install hookify): `status: failed` -> `status: resolved-with-deferrals` with `closed:` / `closed_by: ["63-09", "63-10"]` / `deferred_to:` / `closure_note:`.
- Gap 2 (cross-surface parity): `status: failed` -> `status: resolved` with `closed:` / `closed_by: ["63-10"]` / `closure_note:`.
- Gap 3 (README bullet): `status: failed` -> `status: resolved` with `closed:` / `closed_by: ["63-11"]` / `closure_note:`.

Original gap entries' diagnostic content (root_cause, artifacts, missing, debug_session) preserved verbatim.

## Runtime UAT outcome

Tests 3 / 4 / 5 against the pi-uat sandbox after 63-09 + 63-10 landed:

**Test 3 (install hookify):** **blocked**. Runtime output:

    ● claude-plugins-official [user]
      ⊘ hookify (unavailable) {unsupported hooks}

- No notify `Error:` / `Warning:` rows.
- Cross-surface classification is consistent: both `info hookify` and the install cascade emit `(unavailable) {unsupported hooks}` for the same plugin. The 63-10 parity arm landed correctly at runtime (the user surface no longer drifts between `{unsupported hooks}` and `{unsupported source}`).
- On-disk: `tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/` was NOT written -- the resolver flipped `installable: false` BEFORE the install cascade reached the hooks-bridge slot.

Root cause of the residual trip (verified): hookify's upstream wire bytes at `tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json` declare four event arms (`PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`). Three are in v1.13's `BUCKET_A_EVENTS` (`extensions/pi-claude-marketplace/domain/components/hook-events.ts:37`); `Stop` is NOT. `checkMatcherSupportability` correctly trips `(c) non-bucket-A event: Stop`.

**Test 4 (info hookify):** **blocked** -- depends on test 3. Hookify never reached `(installed)` state, so the `info` projection correctly falls through to the `components: not resolved` arm (matches the Truth #4 "unavailable plugins continue to render `components: not resolved`" contract pinned by `tests/orchestrators/plugin/info.test.ts`). The multi-line `hooks:` block contract the test was meant to exercise could not be validated because the precondition was not met.

**Test 5 (uninstall hookify):** **blocked** -- depends on test 3. Hookify never reached `(installed)` state, so the uninstall path could not be exercised at runtime.

**What was verified end-to-end:**

- The wrapper-format wire-contract fix from 63-09 lands correctly: the residual trip is the bucket-A gate, NOT the parser's `/description: expected array` rejection that produced the original UAT failure.
- The cross-surface classifier parity from 63-10 lands correctly: both surfaces emit the SAME `(unavailable) {unsupported hooks}` token (no drift to `{unsupported source}`).
- The `(unavailable) {<reason>}` row format renders cleanly with no notify `Error:` / `Warning:` rows -- the user surface is honest about the structural limitation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan truths #3 / #4 / #5 / #6 unsatisfiable verbatim -- hookify cannot reach `(installed)` state in v1.13**

- **Found during:** Runtime UAT (Task 2 human-verify checkpoint -- operator ran the recipe and reported the predicted Option A trip).
- **Issue:** The plan's must_haves truths #3 / #4 / #5 ("tests 3/4/5 succeed end-to-end against the pi-uat sandbox", producing `(installed)` row + on-disk hooks.json + reload-hint trailer for hookify) cannot hold in v1.13 because hookify's upstream wire bytes declare `Stop`, which is NOT in v1.13's `BUCKET_A_EVENTS`. The bucket-A supportability gate correctly trips `(c) non-bucket-A event: Stop` -- a structural Option A scope decision taken at the 63-09 checkpoint, NOT a defect.
- **Decision:** Record tests 3/4/5 as terminal `blocked` (not `pass` or `issue`). The UAT loop has closed -- the diagnosed root causes (wrapper-format wire-contract bug, cross-surface classifier asymmetry) are both closed; the residual user-surface trip is the honest bucket-A scope. Top-level UAT `status: resolved` (not `passed`) reflects this closure-with-deferrals.
- **Fix:** UAT closure-with-deferrals annotations (evidence + reason + closed_by + deferred_to) on tests 3/4/5; summary counts updated to reflect terminal state (`passed: 4` / `blocked: 3` / `issues: 0`); gap entries annotated with `closed:` + `closed_by:` + `closure_note:`. Original `reported:` blocks preserved as `reported_pre_fix:` for lineage.
- **Files modified:** `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md`.
- **Commit:** 939574d.

## Truths revisited (against the PLAN frontmatter `must_haves.truths`)

| # | Truth                                                                                                                                       | Status                                                                                                                                                                                                              |
|---|---|---|
| 1 | README.md `## Features` bullet list at lines 21-30 lists Hooks alongside Commands / Skills / Agents / MCP servers in COMPONENT_KINDS slot.    | Landed verbatim (commit 7967ea8).                                                                                                                                                                                   |
| 2 | The Hooks bullet links to `docs/hooks.md` using the same markdown-link form as the existing `## Hook support` section.                       | Landed verbatim (commit 7967ea8).                                                                                                                                                                                   |
| 3 | Runtime UAT test 3 (install hookify) succeeds end-to-end: `(installed)` row + on-disk hooks.json + reload-hint trailer.                       | **Partially landed -- recorded as blocked.** Wrapper-format fix (63-09) and cross-surface parity (63-10) land correctly at runtime. Residual `(unavailable) {unsupported hooks}` trip is honest v1.13 bucket-A scope (Stop arm deferred to v1.14+ per 63-09 Option A). See Deviation. |
| 4 | Runtime UAT test 4 (info hookify) renders multi-line `hooks:` block in alphabetical slot.                                                    | **Partially landed -- recorded as blocked.** Depends on truth #3 (hookify never reached installed state); the `components: not resolved` fallthrough arm is correctly exercised per the SURF-01 / D-63-04 contract. |
| 5 | Runtime UAT test 5 (uninstall hookify) succeeds end-to-end: `(uninstalled)` row + on-disk hooks dir removed.                                 | **Partially landed -- recorded as blocked.** Depends on truth #3 (hookify never reached installed state).                                                                                                           |
| 6 | All three runtime UAT verifications produce NO notify Error: / Warning: rows; UAT YAML status updated accordingly.                            | **Partially landed.** No notify Error: / Warning: rows verified at runtime (verbatim). UAT status updated to `resolved` (not `passed`) reflecting the closure-with-deferrals -- see Deviation.                       |
| 7 | `npm run check` is GREEN at the commit boundary.                                                                                              | Not re-run in 63-11 (the wave-end check from 63-10 covered the production state; 63-11 touched only docs/UAT files). See decisions block.                                                                            |

## Open / deferred

### Stop-event admission to BUCKET_A_EVENTS (v1.14+)

Cross-references the 63-09-SUMMARY.md "Deferred" section. The wrapper-format fix (63-09) and cross-surface classifier parity (63-10) close the diagnosed root causes; the residual trip on hookify (and any other upstream Claude plugin that uses non-bucket-A events) requires:

1. Audit upstream Claude Code's full hook-event set against `BUCKET_A_EVENTS`.
2. Add a Pi peer-dep analog for `Stop` (and any other promoted event) in `hook-events.ts` / `hook-tool-names.ts` / the dispatcher.
3. Promote each event to `BUCKET_A_EVENTS` with a closed matcher set per the existing TOOL-02 supportability contract.

This is by-design v1.13 milestone scope per PROJECT.md (bucket-A is the closed 8-event set for v1.13).

### v1.13 milestone close-out (developer's call)

The phase 63 UAT loop has closed with deferrals. Next steps are the developer's call per the project's milestone-close discipline:

- `mvp-phase complete` -- mark phase 63 complete in STATE.md / ROADMAP.md (orchestrator owns this; intentionally not modified by this plan).
- `gsd-cleanup` -- archive phase 63 artifacts.
- npm publish (per project milestone-close convention; recall the GSD memory note that milestone tags track npm releases, not GSD milestone numbers).

## Files modified

- `README.md` -- Hooks bullet added to `## Features` list (commit 7967ea8).
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md` -- test verdicts, summary counts, gaps annotations (commit 939574d).
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-11-SUMMARY.md` -- this file.
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-11-PLAN.md` -- frontmatter `status:` set to `complete` (with deviation tracked in this SUMMARY).

## Threat Flags

None. README.md is a docs surface with no execution semantics. 63-UAT.md is a planning artefact; the `reported_pre_fix:` field renaming preserves lineage without altering any production behavior. The Stop-event deferral is a closed-set membership decision -- no new attack surface is introduced or expanded.

## Self-Check

Files claimed in this SUMMARY:

- `README.md` line 28 carries `- Hooks. See [Hook support reference](docs/hooks.md).` -- FOUND (verified via `grep -n 'Hook support reference' README.md` returning lines 28 + 176).
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md` carries `status: resolved` + `result: blocked` (x3) + `reported_pre_fix:` (x3) -- FOUND.
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-11-SUMMARY.md` -- this file, being written now.

Commits claimed in this SUMMARY:

- `7967ea8` (Task 1 README bullet) -- FOUND in `git log` (verified at session start).
- `939574d` (UAT closure) -- FOUND in `git log` (verified post-commit).

## Self-Check: PASSED
