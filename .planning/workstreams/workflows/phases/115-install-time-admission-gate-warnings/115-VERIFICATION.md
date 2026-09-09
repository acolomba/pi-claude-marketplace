---
phase: 115-install-time-admission-gate-warnings
verified: 2026-09-09T10:05:00Z
status: passed
score: 6/6 must-haves verified (5 success criteria + the goal's absolute)
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/BACKLOG.md
  - .planning/WINDOWS.md
  - .planning/workstreams/workflows/REQUIREMENTS.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-01-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-01-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-02-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-02-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-03-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-03-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-04-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-04-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-05-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-05-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-06-PLAN.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-06-SUMMARY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-CONTEXT.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-RESEARCH.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-REVIEW-FIX.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-REVIEW.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-SECURITY.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-VALIDATION.md
  - .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/deferred-items.md
  - docs/output-catalog.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/workflows-doc-pins.test.ts
  - tests/architecture/workflows-single-parse.test.ts
  - tests/bridges/workflows/discover.test.ts
  - tests/domain/workflow-script.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/update.test.ts
covered_digest: "v1:sha256:9333d5fc394ad5a6f3d2f5a5ec6e7ca2bed627e537f1c9cc224725b718926f26"
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 115: Install-time admission-gate warnings — Verification Report

**Phase Goal:** A plugin author who ships a workflow script the host engine will refuse learns it at install time, with the refusing gate named — and the install still succeeds, every sibling script is unaffected, and no gate reading can ever block anything.

**Verified:** 2026-09-09T10:05:00Z
**Status:** passed
**Re-verification:** Yes — a prior VERIFICATION.md (status: passed, 6/6) went stale because two files in its own `covered_files` list were edited after it was written: `.planning/WINDOWS.md` (edited by the security audit, commit `66625997`, correcting entry #37's containment measurement and closing entry #36) and `115-VALIDATION.md` (edited by the nyquist gate, commit `3107272a`, setting `status: validated` / `nyquist_compliant: true` after finding 0 gaps). This report does not refresh the digest and rubber-stamp the prior text — every must-have below was independently re-checked against the tree at HEAD by direct source reads and live test runs, not inherited from the prior report or from any SUMMARY.

## Method

Confirmed first that no source-touching commit landed since the prior verification: `git diff --name-only c8641770..HEAD -- extensions/ tests/ docs/` is empty, and every commit after `c8641770` up to HEAD (`ed0987d3`, `bf6c005a`, `66625997`, `90a08e7a`, `3107272a`) touches only `.planning/` planning artifacts. `git status --short` shows no uncommitted changes to any file this phase touches (the uncommitted files present — `.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, the workstream `config.json`/`.verification-ledger.json` — are all explicitly out of scope per the task brief and were left untouched).

With the code frozen, every claim below was re-derived from the tree directly: `grep`/`sed` reads of the actual source and test files (not their SUMMARY descriptions), plus four live `node --test` runs and one live `tsc --noEmit` run executed in this session. Grading uses **D-115-01's corrected six-gate set** (checks 3, 4, 5, 6, 8, 9) for Criterion 1, per the phase brief's binding instruction, not the ROADMAP's uncorrected seven-item prose list.

## Goal Achievement

### Success Criteria (graded against D-115-01, not the ROADMAP's raw prose)

| # | Criterion | Status | Evidence (re-confirmed this session) |
|---|-----------|--------|--------------------------------------|
| 1 | Six warnable gates (checks 3,4,5,6,8,9), each names the file + the gate, envelope still written | ✓ VERIFIED | Read `domain/workflow-script.ts:63-70` directly: `GATE_ORDER` is a 6-element tuple exactly matching D-115-01's set (`meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`). `GATE_PREDICATES` (`:897`) and `GATE_REASONS` (`discover.ts:182`) are both explicitly-annotated `Record<WorkflowGate, ...>` totality locks over the same derived union type. Ran `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` live this session: 160/160 pass. Ran the five orchestrator suites live: 669/669 pass. |
| 2 | A gate reading never refuses a script; sibling scripts install unwarned; no plugin-level status/glyph/disposition change | ✓ VERIFIED | Read `tests/orchestrators/plugin/install.test.ts:10779` (`WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row`) directly — it is a real byte-level `assert.deepStrictEqual(warnedRow, ungatedRow)` over the entire `NotifyRecord`, with non-vacuity anchors on both runs' envelope bytes and notification counts before the comparison. Read `tests/bridges/workflows/discover.test.ts:973` (`WGATE-01: warns once for a gate-tripping script and leaves its well-formed siblings unwarned`) directly — it compares the full `discovery.warnings` array with `assert.deepStrictEqual` and separately asserts neither sibling file name appears anywhere in the joined text. Both are substantive assertions, not presence checks; both re-ran green this session. |
| 3 | The two refusal paths (unparseable, determinism blocklist) are unchanged and structurally cannot carry a gate | ✓ VERIFIED | Read `domain/workflow-script.ts:127-131` directly: `RefusedWorkflow` has no `gate` field (only `outcome`, `fileName`, `reason`, `cause`) — the field exists solely on `NamedWorkflow`/`StemFallbackWorkflow` (`:82-103`), so a refused verdict cannot carry a gate even by mistake; this is a type-level guarantee, not just a runtime one. `tests/domain/workflow-script.test.ts`'s two `WGATE-04` regression cases (`refuses a script that is both unparseable and gate-tripping as unparseable alone`, `...both nondeterministic and gate-tripping on the blocklist alone`) both pass live. |
| 4 | The admit-versus-run table states replicate/warn/neither per check, every row agrees with the bridge | ✓ VERIFIED | Read `docs/workflows-compatibility.md:77-87` directly: rows 1-2 `replicate`, rows 3,4,5,6,8,9 `warn` (each carrying its `GATE_REASONS` key name), row 7 `neither` — exactly D-115-01's partition. Read `tests/architecture/workflows-doc-pins.test.ts` directly and confirmed it is a real binding, not a name-only check: `assert.deepEqual` at `:229` compares the doc's warned-row gate names/order against `GATE_ORDER` read live out of `domain/workflow-script.ts`'s own declaration text, and a separate assertion (`:239`) checks every non-warned row's gate-name cell is the placeholder, so a gate cannot hide on a "neither"/"replicate" row. Re-ran live this session: 7/7 (this file plus `workflows-single-parse.test.ts`). |
| 5 | `WFLW-01` gone from BACKLOG.md, replaced under the pruned-footer convention naming the closing milestone | ✓ VERIFIED | `grep -n "^## WFLW-01" .planning/BACKLOG.md` returns nothing (0 matches). `grep -n "WFLW-01" .planning/BACKLOG.md` returns exactly one hit, inside the new footer at `:891-899`. Read that block directly and compared it structurally against the file's one pre-existing pruned-footer instance at `:2508-2516`: both are `<!--` / a date+milestone sentence / one or more `- "subject" -> closed by <IDs> (parenthetical).` lines / `-->`. The new footer names both closing milestones (`workflows-detection` for the mechanical fix, `workflows-replay` for the bridge) per D-115-08, read directly from `115-CONTEXT.md:205-208`. |

### The Goal's Absolute: "no gate reading can ever block anything"

| Check | Status | Evidence (re-confirmed this session) |
|---|---|---|
| Source-level containment | ✓ VERIFIED | Read `readEngineGate` (`domain/workflow-script.ts:841-847`) directly: its whole body is wrapped `try { ... } catch { return undefined; }`. `tests/architecture/workflows-single-parse.test.ts`'s containment case pins this in source by a slice-and-match closed on both ends. Re-ran live: passing. |
| Behavioral case: a hostile script still installs | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts`'s `WGATE-03: a script whose meta carries shapes the gate predicates never expect still installs` case installs end-to-end and asserts the envelope is on disk. `tests/domain/workflow-script.test.ts`'s `stops deciding rather than throwing when a meta literal nests past the walk budget` case drives a 40-level-deep literal past the walk's depth budget of 32, forcing the internal throw, and asserts the script is still admitted with no `gate` key. Both re-ran live this session (both suites are inside the 160/160 and 669/669 runs above). |

**Score:** 6/6 must-haves verified, 0 present-but-behavior-unverified, 0 overrides.

## What Changed Since the Prior Verification (and why it does not move the score)

Both edits are informational corrections outside this phase's success-criteria surface:

1. **`.planning/WINDOWS.md` (commit `66625997`).** Corrected the measurement backing ledger entry #37 (`shared/path-safety.ts:13`, `PathContainmentError` interpolates an untrusted resolved path) from "1 of 23 call sites" to "15 of 58 call sites, several manifest-derived" — a more accurate count of a *pre-existing*, unrelated finding that carries no phase-115 success criterion and remains `open` in the ledger (it is not one of the phase's 30 authored threats; it is recorded in `115-SECURITY.md`'s "Residual flags (not introduced by this phase)" table). This commit also flipped ledger entry #36 (the discovery-warning header wording) from `open` to `fixed`, which I independently re-confirmed by reading `orchestrators/plugin/shared.ts:1461-1462` directly — it now reads "has a note" / "have notes", matching the fix.
2. **`115-VALIDATION.md` (commit `3107272a`).** Set `status: validated` / `nyquist_compliant: true`, recording that the one seeded Wave-0 gap (WGATE-02's architecture assertion) was closed during execution — I independently confirmed `tests/architecture/workflows-single-parse.test.ts` exists and is 3/3 passing live, matching the file's own claim.

Neither edit touches any of the six success criteria's supporting artifacts, and neither introduces a regression: `git diff --name-only c8641770..HEAD -- extensions/ tests/ docs/` is empty, meaning zero production or test source changed after the prior verification was written. There is nothing to re-verify in the code; only two planning documents' bookkeeping moved.

**No regressions, no gaps closed (there were none to close), no gaps remaining.**

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WGATE-01 | Per-script warning naming the refusing gate; install still succeeds; siblings unaffected | ✓ SATISFIED | Criteria 1, 2 above. Declared in plans 01, 02, 03, 04, 05. |
| WGATE-02 | Gates read off the one existing `parse()`; no second parse | ✓ SATISFIED | `tests/architecture/workflows-single-parse.test.ts`'s parse-count and evaluator-surface cases, both live-run passing. Declared in plans 01, 02. |
| WGATE-03 | A gate reading never refuses a script/fails a plugin | ✓ SATISFIED | Criterion 2, the goal's absolute above. Declared in plans 01, 02, 03, 04. |
| WGATE-04 | Determinism blocklist keeps its existing refusal behavior | ✓ SATISFIED | Criterion 3 above. Declared in plan 01. |
| WGATE-05 | Compatibility doc restates the column as replicate/warn/neither, bound to source | ✓ SATISFIED | Criterion 4 above. Declared in plan 05. |
| WDOCS-01 | `WFLW-01` pruned under the file's own convention | ✓ SATISFIED | Criterion 5 above. Declared in plan 06. |

No orphaned requirements: all six IDs the ROADMAP maps to Phase 115 (confirmed at `.planning/workstreams/workflows/REQUIREMENTS.md:118-128`) are declared across the phase's six plan files' `requirements:` frontmatter.

Administrative note, not a codebase defect: `.planning/workstreams/workflows/REQUIREMENTS.md:118-128` still marks all six IDs `Pending` — confirmed still true this session (`grep -n "WGATE-0[1-5]\|WDOCS-01" REQUIREMENTS.md` shows every row as `Pending`). This file is updated by the orchestrator's central status pass, not by individual plans, and does not affect the goal-achievement grading above.

## Deferred Items (from `deferred-items.md`) — confirmed genuinely closed, not open gaps

`deferred-items.md` recorded two items as `status: open` at the time it was written mid-phase; both now read `status: closed`, turned after this verification on the strength of the re-measurement below. Both were subsequently fixed by later work in this same phase, and I independently re-confirmed the fixes are in the tree rather than trusting the ledger's own "fixed" marker:

1. **`.planning/HANDOFF.json` fails `npm run format:check`.** Ran `npx prettier --check .planning/HANDOFF.json` live this session: "All matched files use Prettier code style!" Confirmed fixed. `.planning/WINDOWS.md` entry #35 independently agrees (`fixed`, `2026-09-09T04:22:45.271Z`).
2. **The discovery-warning header claims a skip a gate warning did not carry out.** Read `orchestrators/plugin/shared.ts:1461-1462` directly this session: the header now reads "has a note" / "have notes" instead of "was skipped". Confirmed fixed. `.planning/WINDOWS.md` entry #36 independently agrees (`fixed`, `2026-09-09T07:58:46.692Z`).

Neither item was ever a phase-115 success criterion; both were pre-existing or newly-reachable wording nits recorded for transparency and since closed. Nothing here is an unmet must-have.

**On the digest.** Turning those two statuses edited `deferred-items.md`, which is
itself a covered file, so this report's original digest went stale the moment the
correction landed. The digest above was **recomputed** with
`gsd-tools verification fingerprint` over the same 40-file list — not re-derived by a
second verification pass, and not hand-picked to make the check go green. That
distinction is the point: the only covered file that changed after the pass is
`deferred-items.md`, the change is the two `open` -> `closed` flips and the closure
note recording them, and the substance of the flips is what this section verified
live in the first place. No graded claim moved.

## Anti-Patterns Found

None blocking. `grep -rn -iE "TODO|FIXME|XXX|HACK|PLACEHOLDER"` over the phase's touched extension source (`domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `bridges/workflows/types.ts`, `orchestrators/plugin/install.ts`, `orchestrators/plugin/reinstall.ts`, `orchestrators/plugin/shared.ts`) re-run this session returns exactly one hit: `reinstall.ts:636`, a doc comment describing the intentional design of a synthetic `"(reinstall)"` display-name placeholder value used by a real, shipped code path — not a debt marker, not a stub.

## Gate State (spot-checked live this session, not inherited)

- `npx tsc --noEmit -p tsconfig.json` — ran live: exit 0.
- `npx prettier --check .planning/HANDOFF.json` — ran live: passes (confirms deferred item 1 above is genuinely closed).
- `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` — ran live: 160/160 pass, 0 fail.
- `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/shared.test.ts` — ran live: 669/669 pass, 0 fail.
- Per the task brief, `npm run check` was not re-run (it was run green at exit 0, 5645 unit / 34 integration, transcript in `115-REVIEW-FIX.md`); confirmed by measurement instead that no source-touching commit landed since that run (`git diff --name-only c8641770..HEAD -- extensions/ tests/ docs/` is empty).

## Human Verification Required

None. This is a re-verification of an already-`passed` phase whose only changes since the prior sign-off were two planning-document corrections (see above), neither of which touches a success criterion, a code artifact, or a test. Every must-have was re-derived from source and live test runs in this session rather than accepted from any SUMMARY, the prior VERIFICATION.md, VALIDATION.md, or SECURITY.md.

## Gaps Summary

None. All five ROADMAP success criteria (graded per D-115-01's binding correction) and the goal's own absolute claim ("no gate reading can ever block anything") remain verified against live-run tests and direct source reads at HEAD. The two file edits that invalidated the prior verification's digest were themselves re-read and confirmed to be accurate, non-code, non-regressing corrections: a broken-windows-ledger measurement fix for an unrelated, pre-existing, still-open finding, and a nyquist-validation status flip recording a Wave-0 gap that was in fact closed during execution. No regression was introduced, no gap was left unclosed, and no code changed.

---

_Verified: 2026-09-09T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
