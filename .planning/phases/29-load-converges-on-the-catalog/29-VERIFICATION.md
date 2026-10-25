---
phase: 29-load-converges-on-the-catalog
verified: 2026-10-25T03:00:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - .planning/phases/29-load-converges-on-the-catalog/29-01-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-01-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-02-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-02-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-03-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-03-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-04-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-04-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-05-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-05-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-06-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-06-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-07-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-07-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-08-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-08-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-09-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-09-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-10-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-10-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-11-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-11-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-12-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-12-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-13-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-13-SUMMARY.md
  - .planning/phases/29-load-converges-on-the-catalog/29-14-PLAN.md
  - .planning/phases/29-load-converges-on-the-catalog/29-14-SUMMARY.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/apply.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - features/plugin/apply.feature
  - features/plugin/pending.feature
  - features/plugin/reconcile.feature
covered_digest: "v3:sha256:dc4089083036f3b402d1c8aa4c3e366404cf0661c6f03fda63fc01b6fef2ceba"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - "The previous report predates review iterations 2 and 3 and the 288f5c6b revert; SC1 now has a known exception (co-shipped dependent and dependency)."
human_verification:
  - test: "Sign off (or reject) the two-apply convergence of a dependent that ships together with the newer dependency it needs"
    expected: "Either record an override or amend ROADMAP criterion 1 and CONTEXT D-08/D-19 to name the exception, or open a follow-up design that settles the case in one apply. See the SC1 row."
    why_human: "The behavior is observable and breaks the letter of ROADMAP criterion 1 and D-08. Only the owner can decide that a deferred limitation is acceptable; no later phase or backlog item carries it."
  - test: "UAT-02: run /reload in a live Pi with a pending change and read the block"
    expected: "The pending block with the apply trailer stays visible"
    why_human: "Pi erases rows emitted during /reload; known manual-only backlog item, out of scope for this phase."
---

# Phase 29: Apply Command and Read-Only Reload Verification Report

**Phase Goal:** Changing installation state is always an explicit command: `apply` reaches the desired state, and a load only reloads resources and reports what is pending.
**Verified:** 2026-10-25T03:00:00Z
**Status:** human_needed
**Re-verification:** Yes. The earlier untracked report predates review iterations 2 and 3 and the revert commit 288f5c6b. It was written fresh against HEAD 70ffab26 (22748a2b plus a docs and comment-only commit).

## Goal Achievement

The goal holds: a load changes no installation state, and `apply` is the one command that makes the changes. One narrow case breaks the letter of ROADMAP criterion 1 (see SC1): a dependent shipped together with the newer dependency it needs takes two `apply` runs. That case needs a human decision.

### Observable Truths

| # | Truth (ROADMAP criteria) | Status | Evidence |
|---|---|---|---|
| SC1 | `apply` makes every change `pending` listed, then `pending` lists nothing; an empty `apply` reports so and writes nothing (APL-01) | ? UNCERTAIN (WARNING, human decision) | Holds in the `apply.feature` scenarios at lines 16-316 ( "Apply makes every change one hand edit of the base config causes, after which pending lists nothing", the config-disable chain, the nothing-to-change case). It does NOT hold for a co-shipped dependent and dependency; see below. |
| SC2 | After `marketplace update` moves a path-source and a git-source plugin, `apply` installs both; a range-blocked and a consent-needing partial move stay put with warning rows and stay in `pending` (APL-02) | ✓ VERIFIED | `apply.feature` "Apply moves a path-source and a git-source plugin ..." (line 389) and "Apply keeps a range-blocked and a consent-needing move in place ..., and pending still lists them" (line 428) pass. The latter checks the record is unchanged and then runs `pending`. |
| SC3 | `/reload` after a hand edit of the config changes no state and prints `pending`'s block with the `apply` trailer; `/reload` with nothing pending prints nothing (APL-03) | ✓ VERIFIED | `reconcile.feature` lines 16 and 33 pass ("... installed plugins: none", "session offers no skills", then silent on a match). `load.ts` calls `openScopePass`/`closeScopePass`/`composePendingReport` only; `read-pass.ts` runs `withLockedStateTransaction` with no `tx.save()` (lines 10-11, 140). The AMIG-01 MCP move (D-22) may still write; it changes no installed set. |
| SC4 | `pending`, help, completions and the docs name `apply` (APL-04) | ✓ VERIFIED | Router entry `edge/router.ts:250` and usage text `:157`; handler `edge/handlers/plugin/apply.ts`; flag catalog `flag-catalog.ts:64,205`; completions test `provider.test.ts:218,515`; trailer `APPLY_HINT_TRAILER` and empty advisory `notification-grammar.ts:908,1201`; `docs/json-output.md` (`needsApply`, `plugin apply`); help feature asserts the usage line; PROJECT.md carries APL-D1 and APL-D2. |
| SC5 | `npm run check` stays green | ✓ VERIFIED (log, not re-run) | `npm-check-revert.log`: exit 0 at 288f5c6b, 793/793 scenarios, 284 LCOV records. Since then only planning docs changed, plus a two-line comment edit in `convergence.ts` (70ffab26). I re-ran the three cucumber features (37/37) and the six reconcile/edge owner tests (183/183). |

**Score:** 4/5 truths verified (1 uncertain, 0 failed, 0 behavior-unverified)

### SC1 exception: the co-shipped dependent and dependency (CR-01, deferred)

Reproduced on this tree with the reviewer's PROBE-1 (`scratchpad/probe/apply-probe.test.ts`, `--test-name-pattern=PROBE-1`): `widget` 1.1.0 declares `zcore@^2.0.0`, `zcore` 2.0.0 ships in the same marketplace update, both recorded at 1.0.0 (path-source marketplace).

```
PENDING-0  widget (will disable), zcore (will update)
APPLY-1    ◍ widget v1.0.0 (disabled) {dependency version unsatisfied}; ● zcore v1.0.0 → v2.0.0 (updated)
PENDING-1  widget (will enable), widget (will update)        <- not blocked moves
APPLY-2    ● widget (installed); ● widget v1.0.0 → v1.1.0 (updated)
PENDING-2  (empty)
```

Probes P3, P4, P6 and P7 (`probe3-out.log`) show the other shapes on the reverted tree:

- P3, P6: converge in two `apply` runs. A blocked move (`zzhost` holds `rapp`/`widget` with `~1.0.0`) stays as a `skipped {dependents constrain}` row.
- P4: a marker-held dependent whose dependency the catalog moves into range also needs two runs.
- P7: when the dependency's move keeps failing, `widget` stays disabled and `zcore` shows `(failed) {permission denied}` on every run. State stays safe.
- P5: a cascade with a dependency cycle still shows `dtop (will install)` plus a held `pcore` in `pending`, which `apply` then moves. This is IN-09, an info-level preview mismatch.

What the limitation costs: after the first `apply`, `pending` lists an enable and an update, which are neither blocked moves nor part of "nothing". That contradicts ROADMAP criterion 1 ("then `pending` lists nothing"), CONTEXT D-08 ("Afterwards `pending` lists nothing except blocked moves") and D-19 ("after which pending is empty"). What it does not cost: no run leaves a dependent enabled with its range unmet; the run order is safe to repeat (NFR-3); each step is reported; the end state is the desired one. Before the revert, the release loop reached the right state in one run for PROBE-1 but could leave a plugin enabled with an unmet range on every later pass (CR-03, WR-05), which is the worse failure.

My judgment: it is a real, narrow gap against the letter of criterion 1, not against the phase goal. Dependent-plus-dependency bumps in one marketplace are a plausible real case, since the shared path-source tree makes the installed declarations equal the catalog's. I would accept it as a deferred limitation, but three things are missing before it can be called accepted:

1. No owner sign-off for this particular consequence. CONTEXT D-12b (commit 70ffab26) records that the user accepted a different cost (release-only, a missed hold takes effect on the next `apply`) and that its code was reverted before the decision arrived. It states "as shipped ... two applies. One-apply convergence for that case is deferred", but it does not say the user accepted the two-apply behavior itself.
2. No carrier. ROADMAP phase 29 has no later phase, `BACKLOG.md` has no entry for it, and ROADMAP criterion 1 still reads unqualified. Only `29-REVIEW-FIX.md` and `29-CONTEXT.md` D-12b mention it.
3. No user-facing note. `docs/dependency-resolution.md` does not say that a co-shipped bump takes two `apply` runs. The reverted doc line was removed, and nothing replaced it.

If the owner accepts it, an override like this closes the item (not added by the verifier):

```yaml
overrides:
  - must_have: "`apply` makes every change `pending` listed, then `pending` lists nothing"
    reason: "A dependent shipped together with the newer dependency it needs converges in two applies (CR-01 deferred, D-12b); no state is left unmet; a follow-up design is tracked in BACKLOG"
    accepted_by: "{owner}"
    accepted_at: "{ISO timestamp}"
```

### Deferred Items

None matched. Phase 29 is the last phase in the milestone roadmap, so Step 9b has no later phase to carry CR-01.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `edge/handlers/plugin/apply.ts` | scope-only handler | ✓ VERIFIED | 42 lines; wired in `register.ts` and `router.ts:250`; `index.ts:88` builds `createApplyReconcile`. |
| `orchestrators/reconcile/apply.ts` | plan + steps + catalog convergence under the lock | ✓ VERIFIED | 1326 lines; `convergeScope` at about line 1072; 131 hermetic unit tests pass (run through the probe copy). |
| `orchestrators/reconcile/load.ts` | read-only load that prints the pending block | ✓ VERIFIED | 117 lines; no install/enable/disable/save call. |
| `orchestrators/reconcile/read-pass.ts`, `pending.ts`, `convergence.ts`, `dependency-verdict.ts` | shared read pass, preview, planner, LOAD-01 verdict | ✓ VERIFIED | Owner tests 183/183. Reverted release loop is gone from `dependency-verdict.ts` and `pending.ts`. |
| `features/plugin/{apply,pending,reconcile}.feature` | scenarios | ✓ VERIFIED | 37/37 pass. |
| `docs/output-catalog.md`, `docs/dependency-resolution.md`, `docs/json-output.md` | docs name `apply` | ✓ VERIFIED | Greps above. Stale load-time wording remains (IN-02). |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| router `apply` | handler `pluginApply` | `router.ts:250` | WIRED |
| handler | `applyReconcile` | `EdgeDeps` | WIRED |
| `index.ts` `resources_discover` | `loadReconcile` (read-only) | `createLoadReconcile` | WIRED |
| load and `pending` | one planner (`composePendingReport`) | `load.ts` imports `pending.ts` | WIRED |
| `apply` | `convergeScope` -> `planConvergence` -> shared runner | `apply.ts` | WIRED |

### Data-Flow Trace (Level 4)

The pending block and the apply rows come from `loadState`, the merged config and the cached `marketplace.json`, not from static values. Cucumber scenarios compare real rows to the installation record.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Co-shipped case | `node --test --test-name-pattern=PROBE-1 apply-probe.test.ts` | two applies, as above | ✓ reproduced |
| P3-P7 | `node --test apply-probe3.test.ts` | 131/131, rows above | ✓ reproduced |
| Features | `npx cucumber-js features/plugin/{apply,reconcile,pending}.feature` | 37/37 scenarios | ✓ PASS |
| Owner tests | `node --test test/orchestrators/reconcile/{load,pending,convergence,read-pass,dependency-verdict}.test.ts test/edge/handlers/plugin/apply.test.ts` | 183/183 | ✓ PASS |

### Probe Execution

SKIPPED: the phase declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| APL-01 | 29-01, 29-04, 29-05 | `apply` makes every change `pending` lists | ✓ SATISFIED with an exception | Exception: the SC1 case above. |
| APL-02 | 29-09..29-13 | catalog moves, partial made whole, blocked moves stay | ✓ SATISFIED | SC2 scenarios; BFILL growth test; D-12 blocked rows. |
| APL-03 | 29-02, 29-08 | load changes no state, prints the pending block | ✓ SATISFIED | SC3. |
| APL-04 | 29-03, 29-14 | `pending` advises `apply`; help, completions, router, JSON, docs | ✓ SATISFIED | SC4. |

REQUIREMENTS.md still shows APL-01..04 as `Pending` and unchecked; the orchestrator updates it at phase close. No orphaned requirement IDs.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` marker in the reconcile directory or the apply handler.

### Review and Security Status

- 29-REVIEW iteration 3 findings: CR-03 and WR-05 fixed by the revert; WR-01 kept; CR-01 deferred (the SC1 exception); IN-01..IN-09 deferred (preview and doc residue, none breaks a criterion); IN-10 skipped.
- IN-06 (D-12 union reading): at HEAD 70ffab26 CONTEXT.md records it as D-12a, "user decision 2026-10-25", and the planner comments cite D-12a. `29-REVIEW-DISPOSITION.md` still lists IN-06 as deferred and is stale. If the owner has not in fact confirmed D-12a, that stays open.
- 29-SECURITY: `threats_open: 0`; T-29-24 is open below the blocking severity (the raw catalog `version` string in a hold cause).
- Every SUMMARY carries a `## Threat Flags` section.

### Human Verification Required

1. **Co-shipped dependent and dependency** (see SC1). Decide: accept as a deferred limitation (record an override or amend criterion 1 and D-08/D-19, add a BACKLOG carrier, add a one-line note to `docs/dependency-resolution.md`), or reject it and plan a follow-up (the reviewer suggests a second verdict pass inside `convergeScope` over moves that actually landed).
2. **UAT-02** (manual only, backlog): Pi erases rows emitted during `/reload`.

### Gaps Summary

No truth failed. One truth, ROADMAP criterion 1, has an observable exception that needs the owner's decision. The earlier "4/4 verified" report no longer applies.

---

_Verified: 2026-10-25T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
