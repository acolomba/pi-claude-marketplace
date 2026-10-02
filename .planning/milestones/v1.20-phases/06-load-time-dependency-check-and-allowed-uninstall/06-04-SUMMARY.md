---
phase: 06-load-time-dependency-check-and-allowed-uninstall
plan: 04
subsystem: docs
tags: [documentation, requirements, backlog, supersession, load-time-check]
requires:
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    plan: 01
    provides: the load-time check, the `dependencyDisabled` marker and the precomputed verdict the prose now describes
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    plan: 02
    provides: the disabled and out-of-range arms, the non-oscillation and the one-pass lift
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    plan: 03
    provides: the allowed uninstall, the retirement of the refusal vocabulary and the already-rewritten removal section
provides:
  - a prose home for LOAD-01 and LOAD-02 in `docs/dependency-resolution.md`
  - the corrected reconcile-planner and persisted-state claims in `docs/plugin-enablement.md`
  - the citable supersession record D-06-07 required
  - the three closed LOAD requirements and PRUNE-05's finalized pointer
  - a re-triaged `PRUNE-GUARD-MR-01` and a carrier for the pending-preview gap
affects: [phase-07, phase-08, phase-09, phase-12]
actuals:
  tokens: 9050
  tasks: 2
  commits: 3
plan_head_before: 9a866b8e3cb7cc95e6eb89a9985036cd886c92b3
tech-stack:
  added: []
  patterns:
    - "Anchor an ungated document to a gated one by quoting the gated bytes verbatim"
    - "Re-triage a backlog item by replacing its scope with the question that survives, not by closing it"
key-files:
  created: []
  modified:
    - docs/dependency-resolution.md
    - docs/plugin-enablement.md
    - .planning/REQUIREMENTS.md
    - .planning/BACKLOG.md
key-decisions:
  - "D-06-22: the load-time-check prose lands as its own section AFTER the pruning section, because the removal section's `see the next section` pointer already binds it to pruning; the removal section gains a forward link instead"
  - "D-06-23: `docs/dependency-resolution.md`'s removal and fail-closed sections were re-triaged and left as 06-03 wrote them; only the load-time-check section and one cross-reference are new here"
  - "D-06-24: `PRUNE-GUARD-MR-01`'s heading is left naming `the dependents guard` while its body records that the guard is retired, because every other reference to the item is by ID and the heading is how three historical records address it"
  - "D-06-25: the pending-preview gap, recorded by all three implementation plans and owned by none of their file scopes, was given a BACKLOG carrier (`PENDING-VERDICT-01`) rather than a fourth summary note"
requirements-completed: [LOAD-01, LOAD-02, LOAD-03]
coverage:
  - id: D1
    description: "`docs/dependency-resolution.md` no longer tells a user the uninstall refuses, and no longer carries the Claude Code contrast sentence"
    requirement: LOAD-03
    verification:
      - kind: command
        ref: "grep -c 'documents this refusal' docs/dependency-resolution.md -- 0 matches"
        status: pass
      - kind: command
        ref: "grep -rn 'dependents remain' extensions/ tests/ docs/ -- 0 matches (06-03, re-confirmed by npm run check here)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The load-time check has a prose home covering all three conditions, the remedies, the non-oscillation and the lift"
    requirement: LOAD-01
    verification:
      - kind: command
        ref: "grep -n '^## The load-time check' docs/dependency-resolution.md -- present at line 166"
        status: pass
      - kind: command
        ref: "the three `    cause:` remedy lines grep -F to exactly 1 occurrence in BOTH docs/output-catalog.md and docs/dependency-resolution.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fail-closed refusal survives in the prose with its subject correct: only an unreadable declarer refuses"
    requirement: LOAD-03
    verification:
      - kind: manual_procedural
        ref: "read docs/dependency-resolution.md's fail-closed paragraph against tests/orchestrators/plugin/uninstall.test.ts#D-05-07 -- the four unreadable cases and the three repair commands are unchanged and still true"
        status: pass
    human_judgment: true
    rationale: "Nothing in CI reads this document. The paragraph was left byte-identical to what 06-03 verified against the shipped refusal, and the claim was re-read against the two surviving D-05-07 tests rather than re-derived."
  - id: D4
    description: "`docs/plugin-enablement.md` names the planner's third enablement input and the new persisted marker"
    requirement: LOAD-01
    verification:
      - kind: command
        ref: "grep -c 'its only enablement inputs are the configuration value and the record' docs/plugin-enablement.md -- 0"
        status: pass
      - kind: command
        ref: "grep -c 'no persisted field was added on either side' docs/plugin-enablement.md -- 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The enable-command divergence and the not-byte-gated note are untouched"
    requirement: LOAD-02
    verification:
      - kind: command
        ref: "git diff -U0 docs/plugin-enablement.md -- the only removed lines are 7 mdformat table realignments and the 2 paragraphs this plan rewrote"
        status: pass
    human_judgment: false
  - id: D6
    description: "The three LOAD requirements are closed in both the LOAD block and the status table, and PRUNE-05 remains with a pointer naming LOAD-03, the phase, and which halves of D-05-14..16 are live"
    requirement: LOAD-02
    verification:
      - kind: command
        ref: "grep -c 'LOAD-0' .planning/REQUIREMENTS.md -- 9, unchanged from before the task; three `- [x]` entries and three `| Complete |` rows"
        status: pass
    human_judgment: false
  - id: D7
    description: "`PRUNE-GUARD-MR-01` is open and re-triaged, and its scope proposes neither a refusal nor the retired row"
    requirement: LOAD-03
    verification:
      - kind: command
        ref: "grep -n 'PRUNE-GUARD-MR-01' .planning/BACKLOG.md -- present; the scope paragraph no longer names `dependents remain` or a refusal"
        status: pass
    human_judgment: false
  - id: D8
    description: "The plan's whole commit range touches no production source and no STATE.md narrative"
    requirement: LOAD-03
    verification:
      - kind: command
        ref: "git diff --name-only 9a866b8e..HEAD -- extensions/ .planning/STATE.md -- empty, checked against the SHA captured before the first edit"
        status: pass
    human_judgment: false
  - id: D9
    description: "A reader who finds the Phase 5 refusal decisions later can tell which parts are still live"
    requirement: LOAD-03
    verification:
      - kind: manual_procedural
        ref: "the Supersession record below, cross-read against .planning/phases/05-prune-on-uninstall/05-CONTEXT.md D-05-14..16 and against REQUIREMENTS.md's PRUNE-05 pointer"
        status: pass
    human_judgment: true
    rationale: "Whether the separation reads clearly to someone arriving at the Phase 5 context cold is a judgment no command makes. Both records now state the same split in the same words, so the two cannot drift apart silently."
duration: 20min
completed: 2026-09-18
status: complete
---

# Phase 6 Plan 4: Documentation, the supersession record, and the backlog re-triage Summary

**The three documents this phase falsified now describe the behaviour that exists, the Phase 5 refusal decisions have a citable supersession record that separates their overturned half from their live half, the three LOAD requirements are closed, and the backlog item the retirement affected is re-triaged rather than closed.**

## Supersession record (D-06-07)

D-06-07 required that a record superseding the Phase 5 refusal decisions live in this phase's own artifacts rather than being left implicit. This is that record. It is cited from `.planning/REQUIREMENTS.md`'s PRUNE-05 entry, so a reader arriving from the requirement finds it.

**The developer's answer, recorded verbatim in `06-03-SUMMARY.md` on 2026-09-18: `proceed-as-decided`.** That answer covered D-06-06 (the uninstall reports instead of refusing) and D-06-07 (the refusal token is retired, not repurposed). It was surfaced as a `blocking-human` decision checkpoint and was not self-answered.

| Phase 5 decision | What it decided | What supersedes it |
| --- | --- | --- |
| D-05-14 | `uninstall X` REFUSES when any remaining installed plugin in the same scope declares X, and removes nothing. The remedy is to uninstall the dependents first or to `--prune` them. | Superseded IN FULL by LOAD-03 / D-06-06 on 2026-09-18. The uninstall proceeds. The dependents are named on the success row's `cause:` line, and each is reported unsatisfied at the next load with its own remedy. |
| D-05-15 | The refusal renders as `⊘ X v1.0.0 (failed) {dependents remain}` at `error` severity, with a cause line naming the dependents. | Superseded IN FULL by D-06-06 and D-06-20. The `dependents remain` token left the closed set in the same edit that added `dependents unsatisfied`; the row is now the ordinary `info` `(uninstalled)` row with a cause trailer. Two catalog states were deleted and one published. |
| D-05-16 | The guard holds on the RECONCILE path: a config-driven uninstall of a still-declared plugin is refused, and the refuse-and-retry loop reports the same row on every reload until the config is fixed. | Superseded IN PART. The **dependents arm** is gone: a config-driven removal now proceeds and the check reports the consequence on the next pass. The **refuse-and-retry loop itself survives**, because the D-05-07 fail-closed refusal still reaches it; 06-03 re-pointed its two integration proofs at that refusal rather than deleting them. |

**Explicitly NOT superseded.** Two things Phase 5 decided are still live, and a reader who finds D-05-14 later must not read this record as overturning them:

- **Who counts as a declarer.** D-05-04 (a DISABLED declarer still holds its dependencies), D-05-05 (the target scope's own `state.json` only) and D-05-06 (declarations read offline from the dependent's own manifest, with its marketplace entry as the fallback) are unchanged. They were never about whether to refuse; they answer who is in the dependent set, and the same `buildScopeDeclarationIndex` call at the same site still answers it.
- **The fail-closed posture on an unreadable declarer.** D-05-07 stands. If any other installed record's declarations cannot be established, the uninstall is still REFUSED and removes nothing, in both notification modes. This extension still never removes a plugin on incomplete information. What changed is only the outcome when the declarations CAN be read and a dependent is found.

So: one refusal was retired and one was kept, and they were always two outcomes of the same read. The Phase 5 context files are left unedited (T-06-16, accepted with this record as its control) — rewriting a shipped phase's context would destroy the record of what was decided at the time.

## Performance

- Duration: ~20 min
- Tasks: 2
- Files modified: 4
- Commits: 3

## Accomplishments

- `docs/dependency-resolution.md` gained a load-time-check section: the three conditions that make a declaration unsatisfied, the three remedy lines quoted byte-for-byte from the gated catalog, why the disable never reaches `claude-plugins.json`, why a reload does not flip the plugin back and forth, how the disable lifts with no edit from the user, and how one broken dependency reaches a whole chain in a single reload. LOAD-01 and LOAD-02 had no prose home before this.
- The three remedy sentences are the anchor for an ungated document. `docs/output-catalog.md`'s bytes are gated by the catalog contract test; these three lines are now identical in both files, so a drift in the remedy wording breaks a test somewhere even though this document is checked only by reading.
- `docs/plugin-enablement.md`'s reconcile row names its third enablement input and says why the planner's purity gate still holds: the verdict is computed in the read pass's own locked closure and handed to the planner as data, so the planner still reads nothing of its own.
- The same document now describes the `dependencyDisabled` marker as what it is — a boolean, re-derived every pass, answering only whether the check currently holds the record down and never why, deliberately unmirrored into the configuration.
- PRUNE-05 keeps its place in the record and its pointer now names the requirement, the phase, and which halves of D-05-14..16 survive. A reader no longer has to reconcile two decision records on their own.
- `PRUNE-GUARD-MR-01` is re-triaged as an open reporting question. The gap it names is unchanged; what changed is that the dangling dependents are now reported rather than prevented, so its original scope (refuse on the `dependents remain` row) is no longer a reachable design.

## Task Commits

1. Task 1: the two prose contracts — `faddfc02`
2. Task 2: the requirements closure and the backlog re-triage — `3352c4df`
3. Deviation 2: a carrier for the pending-preview gap — `975f3f12`

Plan metadata: see the `docs(06-04)` commit that carries this file.

## Files Created/Modified

- `docs/dependency-resolution.md` — the new `## The load-time check` section, and a forward pointer to it from the removal section.
- `docs/plugin-enablement.md` — the reconcile row's third input, the `dependencyDisabled` paragraph under "Where the state lives", and the "Not delivered" migration bullet kept true beside it.
- `.planning/REQUIREMENTS.md` — LOAD-01/02/03 marked complete in the LOAD block and in the status table; PRUNE-05's supersession pointer finalized.
- `.planning/BACKLOG.md` — `PRUNE-GUARD-MR-01` re-triaged; `PENDING-VERDICT-01` added.

## Decisions Made

**D-06-22: the load-time-check section lands after the pruning section.** The removal section ends with "the plugin goes with it as an orphan (see the next section)", which binds it to the pruning section. Inserting the new section between them would break that pointer. It sits after pruning and before "Why a dependency can fail", and the removal section gained a forward link to it, so both pointers are correct.

**D-06-23: `docs/dependency-resolution.md` was re-triaged, not re-written.** Plan 06-03 had already rewritten the removal paragraph and the reload paragraph as a scope deviation, and flagged that this plan should check before editing. It was checked: the §138 refusal sentence is gone, the removal section describes the proceeding uninstall and the `{dependents unsatisfied}` row, the reload paragraph is correct, and the fail-closed paragraph's four cases and three repair commands are untouched and still true. Nothing in either paragraph was reverted or duplicated. The only edits here are the new section and one cross-reference.

**D-06-24: `PRUNE-GUARD-MR-01`'s heading is left alone.** The heading still reads "bypasses the dependents guard", and the guard is retired. Every other reference to the item — in STATE.md's history, the handoff, the milestone audit, the Phase 5 plan and the Phase 6 context — addresses it by ID, and three of those are historical records that quote the heading. The body now states in its first re-triage sentence that the guard is retired, which is where a reader looks. Renaming the heading would buy accuracy in one line at the cost of making three historical records unmatchable.

**D-06-25: the pending-preview gap was given a carrier rather than a fourth note.** See deviation 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The "Not delivered" migration bullet would have been left false**

- **Found during:** Task 1
- **Issue:** The plan named two claims in `docs/plugin-enablement.md` to correct. A third sat in the "Not delivered (out of scope)" list: "**Any state schema migration** -- the resolved value lands in fields that already existed on both sides, so nothing persisted had to change shape." The first half is still true and is about the enablement declaration; the trailing clause is now globally false, since the install record gained `dependencyDisabled`. Correcting the "Where the state lives" paragraph while leaving this one would have put two contradictory claims about persisted state four sections apart in the same document.
- **Fix:** The bullet now names the marker and records why the absence still holds: the field is additive and optional, so no migration was needed. The "not delivered" claim survives; only its reason is completed.
- **Files modified:** `docs/plugin-enablement.md`
- **Verification:** read against `06-01-SUMMARY.md`'s schema accomplishment ("additive with no `schemaVersion` bump and no migrate fill") and against `persistence/state-io.ts`'s optional field.
- **Commit:** `faddfc02`

**2. [Rule 2 - Missing critical functionality] The pending-preview gap was about to lose its last carrier**

- **Found during:** Task 2
- **Issue:** All three implementation plans recorded that `/claude:plugin pending` previews `will enable` for a plugin the next reload holds down, because `orchestrators/reconcile/pending.ts` calls `planReconcile` with three arguments and takes D-06-10's frozen empty verdict. Two of them named this plan as the owner of the decision. This plan's tasks and file scope reach neither `pending.ts` nor any decision about it, and the phase closes here. A fourth summary note would have been the fourth place the gap was recorded and the fourth place it would evaporate from.
- **Fix:** `PENDING-VERDICT-01` was appended to `.planning/BACKLOG.md` with the mechanism, why it is wrong, and the scope if picked up — including that the verdict walk is offline so NFR-5 would hold, and that a preview which foresees the disable also needs a row for it.
- **Files modified:** `.planning/BACKLOG.md`
- **Verification:** `grep -n '^## PENDING-VERDICT-01' .planning/BACKLOG.md`; `SKIP=trufflehog pre-commit run --files .planning/BACKLOG.md` clean.
- **Commit:** `975f3f12`

### Scope Deviations

**3. The catalog-state arithmetic 06-03 corrected was carried forward, not re-derived.**

`06-03-SUMMARY.md` item 7 records that its own acceptance criterion's arithmetic was off by one: the criterion computed 221 catalog states where the tree actually holds 222, because the criterion assumed 06-03 published no state of its own while its action text directed exactly that. This plan's bookkeeping uses the measured 222 / 217 contract-mapped figures rather than the stale plan text, and re-confirmed them by running the contract and parser suites unchanged (16/16 green). No count was adjusted here.

**Total deviations:** 2 auto-fixed (both missing critical functionality) and 1 carried-forward correction. **Impact:** item 1 would have left the document self-contradicting about persisted state; item 2 would have dropped a real preview inaccuracy from the record at the moment the phase closed.

## Known Stubs

None. This plan wrote no code and introduced no placeholder, empty-literal or deferred path.

## Threat Flags

None. The three threats this plan owned are mitigated as planned:

- **T-06-14 (documentation drift in two ungated contracts):** mitigated procedurally as the plan specified. The three remedy sentences are quoted byte-identically from `docs/output-catalog.md`, which IS gated, so the gated artifact anchors the ungated one; every claim was verified by reading against the three plan summaries and the shipped modules they name, not by running a test. The affirmative note that this document is not byte-gated is intact and still true.
- **T-06-15 (a closed record hiding a live gap):** mitigated. `PRUNE-GUARD-MR-01` is open, carries a dated re-triage note naming this phase, and states in its own words that the gap is unchanged and only the outcome moved. The plan's verify that fails if the entry disappears was run and passes.
- **T-06-16 (contradictory decision records):** accepted with its stated control. The Phase 5 context is unedited; the supersession record above names the three decisions, separates the overturned half from the live half, and is cited from PRUNE-05.
- **T-06-SC (package-install tampering):** no package was installed and `package.json` is untouched.

No production source, network endpoint, auth path, file-access pattern or schema field was touched by this plan; the commit-range check against the pre-edit SHA proves it.

## Issues Encountered

- **The phase's UAT gap is now the whole phase's, not one plan's.** 06-01, 06-02 and 06-03 each recorded a `manual_procedural` coverage item with `status: unknown`: nobody has watched a live Pi session disable a dependent, lift it on one reload, or read the uninstall row and its next-reload consequence in sequence. The suites drive all of it against a temporary tree; what is unproven is that Pi's own resource view follows and that an operator reads the two-row sequence as intended. This is the phase's one open verification item.
- **The out-of-range remedy shows canonical semver.** Carried from 06-02. The documentation now states this explicitly ("a declared `^2.0.0` reads `>=2.0.0 <3.0.0-0`"), so a reader is not surprised by it, but the row is still less readable than the author's shorthand.
- **The uninstall row says what happened, not what to do.** Carried from 06-03. The operator sees the consequence one reload before they see the remedy. The new documentation section is the closest thing to a fix that does not change a row: it tells the reader, before they run the command, what the next reload will report.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 is complete. All three requirements are implemented, closed in `REQUIREMENTS.md`, and documented.

What Phase 7 and later inherit:

- `docs/dependency-resolution.md` has a `## The load-time check` section that later phases will need to amend rather than create. Phase 7's no-matching-tag fallback defers to this check, and Phase 9's failed-install path hands the dependent to it; both land prose in that section.
- `docs/plugin-enablement.md` now describes the `dependencyDisabled` marker. Phase 8's enable cascade must lift it, and its documentation belongs in the same paragraph.
- `PRUNE-GUARD-MR-01` is open and re-triaged as a reporting question, claimed by Phase 12 in STATE.md.
- `PENDING-VERDICT-01` is new and unclaimed.
- The three remedy sentences are duplicated between `docs/output-catalog.md` and `docs/dependency-resolution.md` on purpose. Any change to a remedy's wording must move both, and only the catalog's copy is gated.

## Self-Check: PASSED

All three commits this plan claims resolve in `git log` (`faddfc02`, `3352c4df`, `975f3f12`). Every file named under Files Created/Modified exists on disk. The plan's verification gates are green, each read by exit status rather than by a summary glyph and none of them piped: `npm run check` (exit 0), `SKIP=trufflehog pre-commit run --all-files` (exit 0, no hook reporting Failed, `git status` clean of hook rewrites afterwards), `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` (exit 0, 16/16), and `git diff --name-only 9a866b8e..HEAD -- extensions/ .planning/STATE.md` (empty, against the SHA captured before the first edit). `commits: 3` is measured from the recorded `plan_head_before` with `git rev-list --count`, not narrated.

---
*Phase: 06-load-time-dependency-check-and-allowed-uninstall*
*Completed: 2026-09-18*
