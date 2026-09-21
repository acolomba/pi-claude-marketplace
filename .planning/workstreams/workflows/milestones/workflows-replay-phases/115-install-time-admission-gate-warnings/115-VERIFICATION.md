---
phase: 115-install-time-admission-gate-warnings
verified: 2026-09-21T15:36:55Z
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/workflows-doc-pins.test.ts
  - tests/architecture/workflows-single-parse.test.ts
  - tests/bridges/workflows/discover.test.ts
  - tests/domain/workflow-script.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
covered_digest: "v1:sha256:e7addd4914573d1f64f2e498478a172905759d8ffea9b55eb035fe5579003680"
re_verification:
  pass: 3
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 115: Install-time admission-gate warnings — Verification Report

**Phase Goal:** A plugin author who ships a workflow script the host engine will refuse learns it at install time, with the refusing gate named — and the install still succeeds, every sibling script is unaffected, and no gate reading can ever block anything.

**Verified:** 2026-09-21T15:36:55Z
**Status:** passed
**Re-verification:** Yes — third pass. The prior `115-VERIFICATION.md` (`verified: 2026-09-09T00:00:00Z`, `passed`, 6/6) went `stale` per `verification.status`: three merges of `origin/main` (`553513a5` #181 test-suite refinement, `5f11166a` #196 hermetic test environment, `feb04658` #202 argument rejection + test gates) landed after that timestamp and restructured `tests/orchestrators/plugin/{info,shared,install,reinstall,update}.test.ts` and `tests/bridges/workflows/discover.test.ts`, and today's `4dcb7c2f`/`18327876` turned `deferred-items.md`'s two entries from prose-closed to the literal token `status: resolved`. Run in INITIAL mode per the dispatch instructions: every must-have below was re-derived from the six PLANs' `must_haves` blocks and the ROADMAP's five success criteria, then re-checked against the codebase at HEAD `18327876`, not accepted from the prior report's prose.

## Method

The #181 merge split `orchestrators/plugin/{install,reinstall,update}.ts` and their matching `*.test.ts` files into many smaller source/test file pairs (e.g. `install.ts` → `install-flow.ts` + `install-outcome.ts` + `install-clone-probe.ts` + `install-declared-enabled.ts` + `install-disable-cascade.ts` + `install.messaging.ts`; `install.test.ts` → `install-flow.test.ts` + siblings). The #196 merge (hermetic test environment) and #202 merge (argument rejection + test gates) touched shared test scaffolding and source unrelated to this phase's gate logic. `tests/architecture/catalog-uat.test.ts` was likewise split into a `tests/architecture/catalog-uat/` directory (`catalog-contract.test.ts` + `catalog-parser.test.ts` + per-surface `fixtures/*.ts`).

Every WGATE/D-115-* named test case from the phase's six plans was grepped for by name across the CURRENT tree (not assumed to still exist), located under its new path, read in full, and re-run live. `npx tsc --noEmit -p tsconfig.json` ran clean (exit 0). Per the dispatch instructions, `npm run check` was not re-run (7178 unit / 36 integration, exit 0, already run this session); only the specific files each criterion names were run directly with `node --test`.

## Goal Achievement

### Success Criteria (graded against D-115-01's corrected six-gate set)

| # | Criterion | Status | Evidence (re-derived and re-run live against HEAD `18327876`) |
|---|-----------|--------|--------------------------------------------------------------|
| 1 | Six warnable gates (checks 3,4,5,6,8,9), each names the file + the gate, envelope still written | ✓ VERIFIED | `domain/workflow-script.ts:63-70` `GATE_ORDER` is still the same 6-element tuple (`meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`). Ran live: `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` → 160/160 pass, 0 fail — every named `WGATE-01`/`WGATE-02`/`WGATE-04`/`WGATE-05` case (`discovers a script once...`, `warns once for a gate-tripping script...`, the four blocklist-reason cases, both-unparseable/both-nondeterministic cases) still present by name and still passing. Ran live the four orchestrator suites the gate lands in (post-split names): `install-flow.test.ts`, `reinstall-flow.test.ts`, `info.test.ts`, `shared.test.ts` → 524/524 pass, 0 fail. |
| 2 | A gate reading never refuses a script; sibling scripts install unwarned; no plugin-level status/glyph/disposition change | ✓ VERIFIED | The byte-level test moved to `install-flow.test.ts:10673` (`WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row`) — still runs `assert.deepStrictEqual(warnedRow, ungatedRow)` and the literal message equality; ran live and passes (within the 524 above). The `WGATE-01` sibling-isolation case moved to `discover.test.ts:973` (`warns once for a gate-tripping script and leaves its well-formed siblings unwarned`) — unchanged wording, live-passing. |
| 3 | The two refusal paths (unparseable, determinism blocklist) are unchanged and structurally cannot carry a gate | ✓ VERIFIED | `domain/workflow-script.ts:126-130` `RefusedWorkflow` still has no `gate` field (`grep -n "readonly gate?:"` returns only the two admitted arms, `NamedWorkflow`/`StemFallbackWorkflow`, at lines 93 and 103). The `WGATE-04` both-unparseable and both-nondeterministic cases (`tests/domain/workflow-script.test.ts:1271,1292`) pass live (in the 160 above). |
| 4 | The admit-versus-run table states replicate/warn/neither per gate, every row agrees with the bridge | ✓ VERIFIED | Read `docs/workflows-compatibility.md`'s classification table directly at HEAD: all 9 rows still carry one of `replicate`/`warn`/`neither`, check 7 is still `neither`/unreachable, checks 3,4,5,6,8,9 are still `warn` with their gate names. `git diff f0581b7d..HEAD -- docs/workflows-compatibility.md` shows only two hunks, both path-renames in prose (`tests/domain/resolver.test.ts` → `tests/domain/plugin-resolver.test.ts`, and the split test-file names) — no table cell changed. `tests/architecture/workflows-doc-pins.test.ts`'s `WGATE-05` case ran live: pass, still binding the table's warned-row gate names against `GATE_ORDER` read live out of the source. |
| 5 | `WFLW-01` gone from `.planning/BACKLOG.md`, replaced under the pruned-footer convention naming the closing milestone | ✓ VERIFIED | `grep -n "^## WFLW-01" .planning/BACKLOG.md` returns zero matches. `grep -n "WFLW-01" .planning/BACKLOG.md` returns two hits: the pruned-footer block (`:1088`, `-> closed by WFLW-01..04, ...`) and one unrelated backward-reference in a different entry's closure note (`:1171`, `"the same backlog triage sweep that closed [WFLW-01]"`) — neither is an open heading. |

### The Goal's Absolute: "no gate reading can ever block anything"

| Check | Status | Evidence (re-derived and re-run live) |
|---|---|---|
| Source-level containment | ✓ VERIFIED | `readEngineGate` (`domain/workflow-script.ts:835-842`) still opens with `try { const ctx = gateContext(...); return GATE_ORDER.find(...); } catch { return undefined; }`. `tests/architecture/workflows-single-parse.test.ts`'s `WGATE-03: readEngineGate still wraps its walk in try/catch` case (line 160) is a PLANTED-violation architecture gate (it regexes the declaration and asserts the `try`/`catch` tokens are present, so it reddens if the construct is later removed) — ran live and passes. |
| Behavioral case: a hostile script still installs | ✓ VERIFIED | `install-flow.test.ts`'s `WGATE-01 / WGATE-03: installing the same gate-warned plugin twice warns once each time` and `tests/domain/workflow-script.test.ts`'s walk-budget-throw case (`stops deciding rather than throwing when a meta literal nests past the walk budget`, line 1201) both re-ran live and pass. |

**Score:** 6/6 must-haves verified, 0 present-but-behavior-unverified, 0 overrides.

## What Changed Since the Prior Verification (and why it does not move the score)

Between the prior report's HEAD (`f0581b7d`) and this HEAD (`18327876`), three `origin/main` merges and one same-branch doc commit touched files this phase's `covered_files` names:

1. **#181 (`553513a5`, "test: refine the unit test suite and fix the defects it surfaced") split both source and test files.** `orchestrators/plugin/install.ts` → `install-flow.ts` / `install-outcome.ts` / `install-clone-probe.ts` / `install-declared-enabled.ts` / `install-disable-cascade.ts` / `install.messaging.ts`; `reinstall.ts` → `reinstall-flow.ts` / `reinstall-replace.ts` / `reinstall-record.ts` / `reinstall-targets.ts` / `reinstall-clone-probe.ts` / `reinstall.messaging.ts`; the matching `*.test.ts` files split the same way. `tests/architecture/catalog-uat.test.ts` split into `tests/architecture/catalog-uat/{catalog-contract,catalog-parser}.test.ts` plus a `fixtures/` directory of per-surface fixture modules. Every WGATE/D-115-* named case was located post-split by name (none dropped) and re-run live; see the Success Criteria table above. `shared.ts` (where `splitStagingWarnings` and `surfaceDiscoveryWarnings` live) was NOT split — it kept its name and its four-member `splitStagingWarnings` signature (`skills`/`commands`/`agents`/`mcp`), confirmed by direct read at `shared.ts:1413-1422`.
2. **#196 (`5f11166a`, hermetic test environment) and #202 (`feb04658`, argument rejection + test gates).** Neither diff touches `domain/workflow-script.ts`, `bridges/workflows/{discover,types}.ts`, or the gate-warning code paths in the split install/reinstall files — confirmed by `git diff f0581b7d..HEAD` on each of those files showing only path-rename references in prose comments (e.g. `tests/domain/resolver.test.ts` → `tests/domain/plugin-resolver.test.ts`), never a changed assertion or gate.
3. **`18327876` (today, "docs: close the workflows-replay ledger...").** Changed `deferred-items.md`'s two entries' `status:` line from prose-closure to the literal token `resolved` — no change to either entry's substance (re-read in full; both still describe the same fixed `HANDOFF.json` formatting and the same neutralized discovery-warning header, both still under a "Closure, 2026-09-09" section dated to the original phase close). Also appended to `.planning/BACKLOG.md` (new, unrelated entries `VSTALE-01`/`WLREC-01`/`RLHINT-01`/`PCERR-01`/`WSTOR-01`/`WPIN-01`) and to `docs/output-catalog.md` (a new catalog state naming a backfill marker) and `docs/workflows-compatibility.md` (path-rename only, covered above) — none of the three touches this phase's WFLW-01 pruned footer or its admit-versus-run table.

**No regressions, no gaps closed (there were none to close), no gaps remaining.**

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WGATE-01 | Per-script warning naming the refusing gate; install still succeeds; siblings unaffected | ✓ SATISFIED | Criteria 1, 2 above. |
| WGATE-02 | Gates read off the one existing `parse()`; no second parse | ✓ SATISFIED | `tests/architecture/workflows-single-parse.test.ts`'s `WGATE-02` cases, live-run passing. |
| WGATE-03 | A gate reading never refuses a script/fails a plugin | ✓ SATISFIED | Criterion 2, the goal's absolute above. |
| WGATE-04 | Determinism blocklist keeps its existing refusal behavior | ✓ SATISFIED | Criterion 3 above. |
| WGATE-05 | Compatibility doc restates the column as replicate/warn/neither, bound to source | ✓ SATISFIED | Criterion 4 above; `workflows-doc-pins.test.ts`'s `WGATE-05` case, live-passing. |
| WDOCS-01 | `WFLW-01` pruned under the file's own convention | ✓ SATISFIED | Criterion 5 above. |

`REQUIREMENTS.md` marks all six `[x]` and lists them `Complete` in its coverage table (lines 45-49, 82, 138-142, 148) — read directly, not accepted from the prior report. No orphaned requirements found for this phase.

## Anti-Patterns Found

None blocking. `grep -rniE "TODO|FIXME|XXX|HACK|PLACEHOLDER|coming soon|not yet implemented|not available"` re-run this session over the phase's current-path touched source (`domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `bridges/workflows/types.ts`, `orchestrators/plugin/{install-flow,install-outcome,reinstall-flow,reinstall-replace,shared,info}.ts`) returns the same single hit as the prior report: `reinstall-flow.ts:621`, a doc comment describing the intentional, shipped `"(reinstall)"` placeholder display name — not a debt marker (its own body explains why the string is deliberate, and it renders correctly per `update-flow.ts:736,784`'s cross-reference).

## Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Domain/bridge gate logic (Criteria 1, 3; goal's absolute) | `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts tests/architecture/workflows-doc-pins.test.ts tests/architecture/workflows-single-parse.test.ts` | 160/160 pass, 0 fail | ✓ PASS |
| Orchestrator gate surfaces (Criteria 1, 2) | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/shared.test.ts` | 524/524 pass, 0 fail | ✓ PASS |
| Catalog byte gate (Criterion 1's `info` note pin) | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | 4/4 pass, 0 fail — "matches all 20 fixture modules to 205 exact documented states" | ✓ PASS |
| `update` verb regression (unaffected by D-115-05) | `node --test tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/update.messaging.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-row.test.ts tests/orchestrators/plugin/update-swap.test.ts` | 405/405 pass, 0 fail | ✓ PASS |
| Type safety | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |

`npm run check` was not re-run this session per the dispatch instructions (already ran green at exit 0 this session — 7178 unit / 36 integration).

## Human Verification Required

None. All five success criteria and the goal's absolute claim were re-derived from direct source reads at HEAD `18327876`, `git diff`/`git log` measurements against the prior report's HEAD (`f0581b7d`), and live `node --test`/`tsc` runs, not accepted from the prior report, SUMMARY files, or SUMMARY-adjacent claims.

## Gaps Summary

None. Phase 115's goal — a warned-not-refused install-time admission gate for six workflow-script checks — still holds at HEAD after three `origin/main` merges restructured the test suite (splitting `install`/`reinstall`/`update`/`catalog-uat` into many smaller files) and after today's vocabulary-only edit to `deferred-items.md`. Every WGATE/D-115-* named test case named by any of the six plans was located under its new path (none dropped by the split) and re-run live; all pass. The `RefusedWorkflow` type still carries no `gate` field, `GATE_ORDER` is still the same six-tuple, the `try`/`catch` containment in `readEngineGate` is still pinned by a planted-violation architecture gate, and the compatibility-doc table and `BACKLOG.md` pruned footer are unchanged in substance.

---

_Verified: 2026-09-21T15:36:55Z_
_Verifier: Claude (gsd-verifier)_
