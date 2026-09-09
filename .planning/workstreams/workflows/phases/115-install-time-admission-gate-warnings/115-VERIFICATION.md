---
phase: 115-install-time-admission-gate-warnings
verified: 2026-09-09T00:00:00Z
status: passed
score: 6/6 must-haves verified (5 success criteria + the goal's absolute)
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/BACKLOG.md
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
covered_digest: "v1:sha256:b25a165b7c45125ef2c7bf4e9ea57ae94a94097927d0a82b7f8839f969011301"
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 115: Install-time admission-gate warnings — Verification Report

**Phase Goal:** A plugin author who ships a workflow script the host engine will refuse learns it at install time, with the refusing gate named — and the install still succeeds, every sibling script is unaffected, and no gate reading can ever block anything.

**Verified:** 2026-09-09T00:00:00Z
**Status:** passed
**Re-verification:** Yes. The prior `115-VERIFICATION.md` (verified `2026-09-09T10:05:00Z`, `passed`, 6/6, committed at `13c774cc`) went stale because six files it names or is adjacent to were edited afterward by Phase 116 and Phase 117 work: `docs/output-catalog.md`, `docs/workflows-compatibility.md`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `tests/architecture/catalog-uat.test.ts`, `115-VALIDATION.md`, and `deferred-items.md`. Of those six, the last two were **not** touched again after `13c774cc` (confirmed by `git log` — their last edits, `3107272a` and `4dcb7c2f`, predate and were already accounted for by the prior report's own "What Changed Since the Prior Verification" section). The four that genuinely moved are `docs/output-catalog.md`, `docs/workflows-compatibility.md`, `reinstall.ts`, and `catalog-uat.test.ts`. This report re-establishes the phase's five success criteria and its goal's absolute claim directly against HEAD (`f0581b7d`) rather than re-reading the prior report's prose.

## Method

`git diff --stat 13c774cc..HEAD -- extensions/ tests/ docs/` shows the full set of production/test/doc files touched by Phases 116 and 117: reconcile modules (`apply.ts`, `apply-outcomes.ts`, `backfill.ts`, `notify.ts`, `types.ts`), `shared/notify.ts` / `shared/notify-reasons.ts`, a new live-UAT canary, `tests/index.test.ts`, and the four files named above. **None of Phase 115's core gate-logic files changed**: `domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `bridges/workflows/types.ts`, `orchestrators/plugin/install.ts`, and `orchestrators/plugin/shared.ts` are byte-identical to what the prior verification checked (confirmed by their absence from the diff-stat output). This means criteria 1, 2, and 3 — which depend entirely on that code — hold by construction; they were additionally re-run live this session as a check against the possibility of an out-of-band edit the diff missed.

For the four files that did change, each diff was read in full and traced to a Phase 116/117 concern (load-time convergence marker `WCONV-03`, and the `agent()` failure-semantics rewrite) to confirm no hunk touches the Phase 115 surface, then the affected tests were re-run live.

## Goal Achievement

### Success Criteria (graded against D-115-01's corrected six-gate set)

| # | Criterion | Status | Evidence (re-confirmed this session against HEAD `f0581b7d`) |
|---|-----------|--------|--------------------------------------------------------------|
| 1 | Six warnable gates (checks 3,4,5,6,8,9), each names the file + the gate, envelope still written | ✓ VERIFIED | `domain/workflow-script.ts` is unchanged since the prior verification (absent from `git diff --stat 13c774cc..HEAD`). Read `GATE_ORDER` (`:63-70`) directly at HEAD: still the same 6-element tuple (`meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`). Ran live: `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` → 160/160 pass. Ran live: the five orchestrator suites (`install`, `reinstall`, `info`, `update`, `shared`) → 796/796 pass (127 of these in `reinstall.test.ts` alone, up from the prior report's count because Phase 116 added convergence-arm cases to the same file; none touch WGATE logic). |
| 2 | A gate reading never refuses a script; sibling scripts install unwarned; no plugin-level status/glyph/disposition change | ✓ VERIFIED | `orchestrators/plugin/install.ts` is unchanged since the prior verification. Re-ran `tests/orchestrators/plugin/install.test.ts` live this session (included in the 796 above) — the `WGATE-03` byte-level `assert.deepStrictEqual(warnedRow, ungatedRow)` case and the `WGATE-01` sibling-isolation case in `tests/bridges/workflows/discover.test.ts` both pass. |
| 3 | The two refusal paths (unparseable, determinism blocklist) are unchanged and structurally cannot carry a gate | ✓ VERIFIED | `domain/workflow-script.ts`'s `RefusedWorkflow` type (no `gate` field) is unchanged. The two `WGATE-04` regression cases in `tests/domain/workflow-script.test.ts` pass live (in the 160 above). |
| 4 | The admit-versus-run table states replicate/warn/neither per gate, every row agrees with the bridge | ✓ VERIFIED | Read `docs/workflows-compatibility.md:75-91` (the table, its 9-check enumeration, and the surrounding prose) directly at HEAD: byte-identical to what the prior verification checked — `git diff 13c774cc..HEAD -- docs/workflows-compatibility.md` shows the only changed section is the unrelated "`agent()` failure semantics" prose (lines ~131-166, a Phase 117 rewrite of the fan-out/recoverable-class claim, sharing the file but not the table). Ran `tests/architecture/workflows-doc-pins.test.ts` live at HEAD: 4/4 pass, including `WGATE-05: the classification column is closed and its warned rows name the source's gate union`, which binds the table's gate names against `GATE_ORDER` read live out of the source — this is the mechanism that would fail if the table and the source had drifted, and it passes. |
| 5 | `WFLW-01` gone from BACKLOG.md, replaced under the pruned-footer convention naming the closing milestone | ✓ VERIFIED | `.planning/BACKLOG.md` was not touched between `13c774cc` and HEAD (`git log --oneline 13c774cc..HEAD -- .planning/BACKLOG.md` returns nothing). `grep -n "^## WFLW-01"` still returns zero matches; `grep -n "WFLW-01"` still returns exactly one hit, inside the pruned footer at `:891-899`, unchanged. Phase 116 appended a new entry, `UPCASC-01`, at line 1829 — a different, unrelated section of the same file; it does not touch the pruned footer or reintroduce an open `WFLW-01` entry. |

### The Goal's Absolute: "no gate reading can ever block anything"

| Check | Status | Evidence (re-confirmed this session) |
|---|---|---|
| Source-level containment | ✓ VERIFIED | `readEngineGate`'s `try { ... } catch { return undefined; }` body (`domain/workflow-script.ts:841-847`) is unchanged. `tests/architecture/workflows-single-parse.test.ts` re-run live: passing (in the 160 above). |
| Behavioral case: a hostile script still installs | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts`'s `WGATE-03` install-with-hostile-meta case and `tests/domain/workflow-script.test.ts`'s walk-budget-throw case both re-ran live and pass (within the counts above). |

**Score:** 6/6 must-haves verified, 0 present-but-behavior-unverified, 0 overrides.

## What Changed Since the Prior Verification (and why it does not move the score)

Four files genuinely changed between `13c774cc` (the prior report's commit) and HEAD (`f0581b7d`), all by Phase 116 (load-time convergence, `WCONV-03`) and Phase 117 (`agent()` failure-semantics measurement). None touches Phase 115's success-criteria surface:

1. **`docs/output-catalog.md`.** The diff adds three new catalog states and a `REASONS` cross-reference sentence, all scoped to the load-time backfill/convergence section (`### Load-time backfill...`, tagged `BFILL-01 / WCONV-03`). Phase 115's own published state, `installed-with-workflow-gate-note` (lines 1906-1920, the future-tense per-script gate note), is byte-identical — confirmed by `grep -n` locating it and reading it directly; it does not appear in the diff hunk list at all.
2. **`docs/workflows-compatibility.md`.** The diff is entirely inside the `### agent() failure semantics` section (roughly lines 131-166), rewriting the recoverable/non-recoverable classification claim on the strength of a new live canary. The admit-versus-run table (lines 75-91) that Criterion 4 grades is outside the diff and unchanged, confirmed both by direct read and by the live-passing `workflows-doc-pins.test.ts` binding.
3. **`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`.** The single diff hunk (lines ~988-999) is a doc-comment revision noting that `orchestrators/reconcile/backfill.ts` (Phase 116's new caller) now also reaches the deep-equal config-write-back gate — no functional line changed. The `D-115-05` workflow-discovery-channel code (line 1066, `discoveryWarnings: [...staging.discovery, ...handles.workflows.result.warnings]`) is untouched, and its three dedicated `WGATE-01 / D-115-05` tests (`tests/orchestrators/plugin/reinstall.test.ts:4976,5024,5064`) pass live within the 127-test run for that file.
4. **`tests/architecture/catalog-uat.test.ts`.** The diff adds two new fixtures for the `WCONV-03` backfill states and bumps the exact-count assertion from 195 to 197 annotated examples (the two new catalog states from item 1). Phase 115's own fixture, `installed-with-workflow-gate-note` (line 3634), is untouched — confirmed by direct read; it is not present in the diff hunks. The updated test re-ran live: 6/6 pass, including the byte-equality walk over every annotated example and the inverse fixture-coverage walk.

`115-VALIDATION.md` and `deferred-items.md` were not touched again after `13c774cc` — their listing in the phase brief's "six changed files" refers to edits that predate and were already accounted for by the prior verification's own "What Changed" section (the nyquist-validated flip and the two deferred-item closures). Re-confirmed here: `git log --oneline 13c774cc..HEAD -- <both paths>` returns nothing for either file.

**No regressions, no gaps closed (there were none to close), no gaps remaining.**

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WGATE-01 | Per-script warning naming the refusing gate; install still succeeds; siblings unaffected | ✓ SATISFIED | Criteria 1, 2 above. |
| WGATE-02 | Gates read off the one existing `parse()`; no second parse | ✓ SATISFIED | `tests/architecture/workflows-single-parse.test.ts`, live-run passing. |
| WGATE-03 | A gate reading never refuses a script/fails a plugin | ✓ SATISFIED | Criterion 2, the goal's absolute above. |
| WGATE-04 | Determinism blocklist keeps its existing refusal behavior | ✓ SATISFIED | Criterion 3 above. |
| WGATE-05 | Compatibility doc restates the column as replicate/warn/neither, bound to source | ✓ SATISFIED | Criterion 4 above; `workflows-doc-pins.test.ts`'s `WGATE-05` case, live-passing. |
| WDOCS-01 | `WFLW-01` pruned under the file's own convention | ✓ SATISFIED | Criterion 5 above. |

No orphaned requirements — unchanged from the prior report; this re-verification did not re-audit `REQUIREMENTS.md` since that file is explicitly excluded from `covered_files` (it is rewritten by a later completion pass, per this phase's own recorded broken-window measurement).

## Anti-Patterns Found

None blocking. `grep -rn -iE "TODO|FIXME|XXX|HACK|PLACEHOLDER"` re-run this session over the phase's touched extension source (`domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `bridges/workflows/types.ts`, `orchestrators/plugin/install.ts`, `orchestrators/plugin/reinstall.ts`, `orchestrators/plugin/shared.ts`) returns the same single hit as before: `reinstall.ts:636`, a doc comment describing an intentional, shipped `"(reinstall)"` placeholder display name — not a debt marker.

## Gate State (spot-checked live this session, not inherited)

- `npx tsc --noEmit -p tsconfig.json` — ran live at HEAD: exit 0.
- `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` — ran live: 160/160 pass, 0 fail.
- `node --test tests/architecture/catalog-uat.test.ts` — ran live: 6/6 pass, 0 fail (confirms the 197-example count and Phase 115's own fixture round-trip).
- `node --test tests/orchestrators/plugin/reinstall.test.ts` — ran live: 127/127 pass, 0 fail (includes the three `WGATE-01 / D-115-05` standalone-reinstall discovery-channel cases).
- Per the task brief, `npm run check` was not re-run (it last ran green at exit 0 during Phase 117's fix pass — 5654 unit / 35 integration — and no source has moved since; confirmed here by the same `git diff --stat` used throughout this report).

## On the Covered Set

`.planning/BACKLOG.md` stays covered — Criterion 5 grades its content directly, and nothing downstream rewrites it; this was re-confirmed rather than assumed, since Phase 116 did append a new, unrelated entry to the same file. `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and `.planning/WINDOWS.md` remain excluded, per the measured defect this phase's own prior verification recorded (Broken Windows #39): each is rewritten by a pass that runs after verification, and covering one makes the phase permanently un-completable. That is a real tradeoff — it means a future edit to any of those four files touching Phase 115 content would not trigger this report's own staleness detection — but the alternative (covering them) is the specific failure this re-verification exists to fix.

## Human Verification Required

None. All five success criteria and the goal's absolute claim were re-derived from direct source reads, `git diff`/`git log` measurements, and live `node --test`/`tsc` runs against HEAD this session, not accepted from the prior report, SUMMARY files, or SUMMARY-adjacent claims.

## Gaps Summary

None. Phase 115's goal — a warned-not-refused install-time admission gate for six workflow-script checks — still holds at HEAD after Phases 116 and 117 landed unrelated work (load-time convergence marker, `agent()` failure-semantics measurement) in three of the four files this report's own predecessor's `covered_files` list also names. Every hunk in the four genuinely-changed files was read and traced to that unrelated work; none touches a Phase 115 success criterion, and every test this phase's plans introduced still passes live against the current tree.

---

_Verified: 2026-09-09T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
