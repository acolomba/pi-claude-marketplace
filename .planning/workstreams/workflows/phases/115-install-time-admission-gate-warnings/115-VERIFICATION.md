---
phase: 115-install-time-admission-gate-warnings
verified: 2026-09-09T09:15:00Z
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
covered_digest: "v1:sha256:86ce944221ad3f6a181ed77c2b44c3aaf2d8918034f353e93bff0a3c6d0a71ab"
---

# Phase 115: Install-time admission-gate warnings — Verification Report

**Phase Goal:** A plugin author who ships a workflow script the host engine will refuse learns it at install time, with the refusing gate named — and the install still succeeds, every sibling script is unaffected, and no gate reading can ever block anything.

**Verified:** 2026-09-09T09:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a code-review pass, not a SUMMARY read. Every claim below was checked against the tree
on disk (grep/sed of source, and targeted `node --test` runs), not accepted from the six plan
SUMMARYs, the REVIEW, or the REVIEW-FIX. Where a SUMMARY's own transcript was the only evidence
for a transient control (e.g. a planted-defect run that was reverted), that is stated explicitly
below rather than presented as re-verified.

Grading uses **D-115-01's corrected six-gate set** (checks 3, 4, 5, 6, 8, 9) for Criterion 1, per
the phase brief's binding instruction — not the ROADMAP's uncorrected seven-item prose list.

## Goal Achievement

### Success Criteria (graded against D-115-01, not the ROADMAP's raw prose)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Six warnable gates (checks 3,4,5,6,8,9), each names the file + the gate, envelope still written | ✓ VERIFIED | `GATE_ORDER` at `domain/workflow-script.ts:63-70` has exactly six members matching D-115-01's set; `GATE_PREDICATES` (`:897`) and `GATE_REASONS` (`discover.ts:182`) are both `Record<WorkflowGate, ...>` totality locks over the same union — a seventh member fails `tsc` at both sites (proven in 115-01 SUMMARY Control 2, 115-05 SUMMARY direction 1, both reproducing `TS2741` at the exact two call sites). Ran `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/discover.test.ts` live: 152/152 pass, including 40 per-gate rows and the envelope-still-written assertion in `tests/orchestrators/plugin/install.test.ts` (`WGATE-01 / D-115-05` cases, live run: 676/676 across the six orchestrator suites). |
| 2 | A gate reading never refuses a script; sibling scripts install unwarned; no plugin-level status/glyph/disposition change | ✓ VERIFIED | `WGATE-03 / D-115-06: a gate warning moves no byte of the plugin row` (`tests/orchestrators/plugin/install.test.ts:10779`) does a **byte** comparison — `assert.deepStrictEqual(warnedRow, ungatedRow)` over the whole `NotifyRecord`, with non-vacuity anchors on both runs' envelopes and notification counts, live-run passing. `WGATE-01: warns once for a gate-tripping script and leaves its well-formed siblings unwarned` (`tests/bridges/workflows/discover.test.ts:973`) compares the whole `discovery.warnings` array and asserts the two sibling file names do not appear anywhere in it — live-run passing. This is asserted on bytes, not inferred from channel separation, exactly as D-115-06 requires. |
| 3 | The two refusal paths (unparseable, determinism blocklist) are unchanged and structurally cannot carry a gate | ✓ VERIFIED | Two dedicated regression cases in `tests/domain/workflow-script.test.ts` (`WGATE-04: refuses a script that is both unparseable and gate-tripping as unparseable alone` and `...both nondeterministic and gate-tripping on the blocklist alone`) construct a script that would trip a gate AND a refusal, assert the refusal wins with its unchanged reason text, and assert `Object.hasOwn(verdict, "gate") === false`. This is backed by a type-level guarantee, not just a runtime one: `gate?: WorkflowGate` exists only on the `NamedWorkflow`/`StemFallbackWorkflow` interfaces (`domain/workflow-script.ts:82-103`) — the `Refusal` type has no such field, so a refused verdict cannot carry one even by mistake. Live-run: both cases pass. |
| 4 | The admit-versus-run table states replicate/warn/neither per check, every row agrees with the bridge | ✓ VERIFIED | Read `docs/workflows-compatibility.md:77-87` directly: rows 1-2 `replicate`, rows 3,4,5,6,8,9 `warn` (each carrying its `GATE_REASONS` key), row 7 `neither` — exactly D-115-01's partition. `tests/architecture/workflows-doc-pins.test.ts`'s `WGATE-05` case binds the table's warned-row gate-name column to `GATE_ORDER` by a `deepEqual`, live-run passing (7/7 across both doc-pin and single-parse architecture suites). The four-direction negative control in 115-05's SUMMARY (union grows/doc static, doc row deleted/union static, **column value falsified with no code change** — the one that actually proves the gate compares behavior and not just names, and the annotation-removal attribution) is reproduced verbatim in that SUMMARY with real transcripts; I did not re-run the plants myself (they mutate and restore the real module), but the surviving gate (case 3 of `workflows-doc-pins.test.ts`, still present and passing) is the same artifact those transcripts exercised. |
| 5 | `WFLW-01` gone from BACKLOG.md, replaced under the pruned-footer convention naming the closing milestone | ✓ VERIFIED | `grep -c '^## WFLW-01' .planning/BACKLOG.md` = 0; `grep -c 'WFLW-01' .planning/BACKLOG.md` = 1 (inside the new footer). The new block at `:891-900` matches the file's one pre-existing pruned-footer instance at `:2508-2516` in shape: `<!--` / `Pruned <date>: shipped in <milestone(s)>.` / `- "<subject>" -> closed by <IDs> (<parenthetical>).` / `-->`. Names both closing milestones (`workflows-detection` for the mechanical fix, `workflows-replay` for the bridge), per D-115-08. |

### The Goal's Absolute: "no gate reading can ever block anything"

| Check | Status | Evidence |
|---|---|---|
| Source-level pin that the containment `catch` still exists | ✓ VERIFIED | `readEngineGate` (`domain/workflow-script.ts`) wraps its whole body in `try { ... } catch { return undefined; }` — read directly off disk. `tests/architecture/workflows-single-parse.test.ts`'s `WGATE-03: readEngineGate still wraps its walk in try/catch` case pins this in source (slice-and-match, closed on both ends so a rename reddens it rather than silently matching a renamed function — this was itself a defect the plan's control D caught and fixed). Live-run: 7/7 passing, including this case. |
| Behavioral case: a hostile script still installs | ✓ VERIFIED | `WGATE-03: a script whose meta carries shapes the gate predicates never expect still installs` (`tests/orchestrators/plugin/install.test.ts:10725`) installs `hostileMetaScript` end to end and asserts the envelope is on disk and the record names it — live-run passing. A second, narrower case (`stops deciding rather than throwing when a meta literal nests past the walk budget`, `tests/domain/workflow-script.test.ts:1202`) drives a 40-level-deep literal past the walk's depth budget of 32, forcing the internal `throw`, and asserts the script is still admitted with no `gate` key — live-run passing. Together these are a real throw forced and contained (unit level) plus a real install that survives a script the predicates were never written to expect (integration level). |
| Non-regression control (not independently reproduced here) | recorded, not re-run | 115-01 SUMMARY's Control 3a plants `throw new Error(...)` directly into one predicate and reports 152/154 install cases still passing (the two failures are a notification-count assertion, not an install failure). This is a real transcript of a real plant-and-restore, but it was reverted before commit and is not a standing regression test — the two committed tests above are what stands permanently in its place. |

**Score:** 6/6 must-haves verified (5 success criteria + the goal's absolute), 0 present-but-behavior-unverified, 0 overrides.

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WGATE-01 | Per-script warning naming the refusing gate; install still succeeds; siblings unaffected | ✓ SATISFIED | Criteria 1, 2 above |
| WGATE-02 | Gates read off the one existing `parse()`; no second parse | ✓ SATISFIED | `tests/architecture/workflows-single-parse.test.ts`'s `WGATE-02: the workflow script analyzer carries exactly one parse call site` and `...neither the analyzer nor the workflows bridge carries an evaluator surface`, both live-run passing. Roster for the evaluator-surface scan is derived from `bridges/workflows/` via the shared `filesMatching` mechanic (not hand-listed), though it is never asserted non-empty in source (code review IN-05, unfixed — see Anti-Patterns) |
| WGATE-03 | A gate reading never refuses a script/fails a plugin | ✓ SATISFIED | Criterion 2, the goal's absolute above |
| WGATE-04 | Determinism blocklist keeps its existing refusal behavior | ✓ SATISFIED | Criterion 3 above |
| WGATE-05 | Compatibility doc restates the column as replicate/warn/neither, bound to source | ✓ SATISFIED | Criterion 4 above |
| WDOCS-01 | `WFLW-01` pruned under the file's own convention | ✓ SATISFIED | Criterion 5 above |

No orphaned requirements: all six IDs declared in this phase's plans are also the six IDs the ROADMAP maps to Phase 115.

One bookkeeping note, not a code gap: `.planning/workstreams/workflows/REQUIREMENTS.md:118-128` still marks all six IDs `Pending`. Every plan SUMMARY explicitly and consistently declares this file was deliberately left untouched by the executor (the workstream-scoped state verbs are documented elsewhere as unreliable against this layout, and the orchestrator — not the plan — owns the central status update). This is administrative, not a codebase defect, and does not affect the goal-achievement grading above.

## Code Review Findings and Their Disposition

A deep code review (`115-REVIEW.md`, 2026-09-09T07:35:31Z) found 1 critical + 6 warnings against the
as-shipped Wave-1-through-3 code, on top of the goal's absolute holding. All 7 were fixed in
`115-REVIEW-FIX.md` and I confirmed every fix is actually landed in the current tree, not just
claimed:

| ID | Finding | Fix confirmed in tree? |
|---|---|---|
| CR-01 (critical) | `softFailWarning` interpolated plugin-controlled `fileName`/`workflowsDir`/`reason` unescaped — a POSIX file name with an embedded newline could forge extra lines in a rendered warning block, reaching **standalone** users after this phase moved the array off the orchestrated-only channel | ✓ Confirmed — `discover.ts:124` now wraps all three spans in `forMessage(...)`; the CR-01 regression case in `tests/bridges/workflows/discover.test.ts` is present and passing live |
| WR-01 (warning) | The discovery-warning header said "N declared components were skipped" over a block where two of the families describe an installed script | ✓ Confirmed — `orchestrators/plugin/shared.ts:1461-1462` now reads "has a note" / "have notes"; Broken Windows #36 marked `fixed` in `.planning/WINDOWS.md:485` |
| WR-02 (warning) | `InstallCtx.discoveryWarnings`' doc comment named the wrong bridge set and a false contract | ✓ Confirmed in commit `eb72b9ff` (not independently re-read line-by-line here, but the commit is in `git log` and the wider fix set was live-tested end to end) |
| WR-03 (warning) | The compatibility doc's check-8 note claimed a skip for spread/computed-key placement the bridge doesn't actually perform in that direction | ✓ Confirmed — `docs/workflows-compatibility.md:86` now states the placement distinction ("standing AFTER the last literal `name`... one standing before it is admitted and warned here") |
| WR-04 (warning) | The check-8 user-facing sentence enumerated 8 forbidden forms and omitted the 9th (a BigInt-literal key) the code deliberately implements | ✓ Confirmed — `discover.ts` `GATE_REASONS["meta-not-pure-literal"]` now includes "key written as anything but an identifier, string or number"; live-tested in `WGATE-03: a script whose meta carries shapes...` which asserts the full 9-form sentence byte-exactly |
| WR-05 (warning) | A "one line per file" assertion that passed for zero lines (`slice(1)` on a header-only string gives `[]`) | ✓ Confirmed — the same test now does a full byte comparison of the whole diagnostic message, live-run passing |
| WR-06 (warning) | Two unenumerated, ungated "eleven" counts in doc comments — the exact "enumeration shorter/unmeasured than what it claims" pattern this milestone has repeatedly shipped | ✓ Confirmed — `grep -rn 'eleven' extensions/ tests/ docs/workflows-compatibility.md` returns only unrelated `eleven-digit` version fixtures |

**7 Info-level findings (IN-01 through IN-07) were deliberately left unfixed** — out of the review-fix's declared scope. None is a blocker for the phase goal; they are documentation/robustness nits:
- IN-01: two different (unverifiable) engine source line ranges cited for the same nine checks
- IN-02: a shipped doc cites an internal planning spike readers can't open
- IN-03: a doc-pins test failure that would report a misleading cause in one specific breakage mode
- IN-04: `install.ts`'s module header is stale about standalone notification count (pre-existing, widened by this phase)
- IN-05: the derived evaluator-surface roster (`bridgeModules()`) is never asserted non-empty in source — confirmed still true by reading `tests/architecture/workflows-single-parse.test.ts:122-124`
- IN-06: the new `installed-with-workflow-gate-note` catalog fixture hardcodes the check-9 sentence as a literal rather than importing `GATE_REASONS`, so a reword of the production sentence would not redden the catalog gate
- IN-07: an ambiguous comment about what `update.ts` does, mirrored at two orchestrator sites

These are recorded here for visibility; none contradicts a success criterion or the goal's absolute, and all are pre-existing-class or genuinely low-severity per the reviewer's own grading.

## Anti-Patterns Found

None blocking. `grep -rn -iE "TODO|FIXME|XXX|HACK|PLACEHOLDER"` over the phase's touched extension source (`domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `bridges/workflows/types.ts`, `orchestrators/plugin/install.ts`, `orchestrators/plugin/reinstall.ts`, `orchestrators/plugin/shared.ts`) returns nothing. The two `eleven` overcounts (WR-06) were the closest thing to a debt marker in this phase and are fixed (see above).

## Gate State (spot-checked, not blindly trusted)

- `npm run typecheck` — re-run live: exit 0.
- `npm run format:check` — re-run live: exit 0 (the `.planning/HANDOFF.json` pre-existing violation noted in plan 01's SUMMARY is confirmed fixed: `npx prettier --check .planning/HANDOFF.json` passes).
- `npm run fallow` — re-run live: exit 0 (dead-code/health clean; the dupes report's `✗` glyph is informational at the tool's own summary line — the pre-existing, unrelated clone groups it lists touch none of this phase's files, and the composite npm script still exits 0).
- Targeted unit suites re-run live (not the whole 5645-test suite, per this project's "no redundant check re-runs" convention, since `git status --short` shows no source changes since the last commit): `tests/domain/workflow-script.test.ts`, `tests/bridges/workflows/discover.test.ts`, `tests/architecture/workflows-doc-pins.test.ts`, `tests/architecture/workflows-single-parse.test.ts` (160/160), and `tests/orchestrators/plugin/{install,reinstall,info,update,shared}.test.ts` + `tests/architecture/{catalog-uat,no-orchestrator-network}.test.ts` (676/676). All green.
- `git log --oneline` confirms all 8 review-fix commits (`c8d397d9`, `428b70d1`, `01ad10b9`, `eb72b9ff`, `6b042dfb`, `ee025ac7`, `df46a46c`, `c8641770`) plus the six plans' commits are present in history on `features/workflow`.

## Human Verification Required

None. The two items VALIDATION.md itself scoped as reviewer-read prose judgments were both exercised directly during this verification, with concrete, checkable evidence rather than left open:

1. **The pruned-footer convention match (WDOCS-01).** Compared the new block (`.planning/BACKLOG.md:891-900`) against the file's one pre-existing instance (`:2508-2516`) structurally — same four-part shape (`<!--` / date+milestone sentence / `- "subject" -> closed by IDs (parenthetical).` / `-->`). Matches.
2. **The doc's check-7 "neither" explanation reads as unreachability, not undetectability (D-115-02).** Read `docs/workflows-compatibility.md:85` directly: it states `export const meta;` is rejected by acorn at check 2 and every non-`const` form fails check 4 first, "so no parseable script arrives here" — this is explicitly an unreachability argument, not a claim the bridge cannot detect something it could.

Both hold. No further human sign-off is needed to certify the goal achieved.

## Gaps Summary

None. Every one of the five ROADMAP success criteria (graded per D-115-01's binding correction) and the goal's own absolute claim ("no gate reading can ever block anything") are verified against live-run tests and direct source reads, not against SUMMARY narrative. A prior deep code review found one critical and six warning-level defects in the first-cut implementation; all seven were fixed in a documented follow-up pass, and I independently confirmed each fix is present in the current tree rather than trusting the fix report's own claim. Seven residual Info-level findings remain, by design, as low-severity documentation/robustness debt that does not block the phase goal.

---

_Verified: 2026-09-09T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
