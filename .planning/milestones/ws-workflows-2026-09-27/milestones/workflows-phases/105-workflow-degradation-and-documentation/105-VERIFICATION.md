---
phase: 105-workflow-degradation-and-documentation
verified: 2026-08-16T04:17:14Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run `node tests/live-uat/workflow-storage-canary.mjs` against a real, locally installed `@quintinshaw/pi-dynamic-workflows` host engine (`mkdir -p /tmp/wf-engine && npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows && PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules node tests/live-uat/workflow-storage-canary.mjs && rm -rf /tmp/wf-engine`). Expect the new W1/W2/W3 lines: W1 asserts the degradation marker rendered on the engine-absent install row, W2 asserts the real engine's own storage scan finds the envelope by its generated name, W3 is the negative control asserting a never-written name is absent from the listing."
    expected: "PASS on W1, W2, W3 alongside the existing U*/P*/X/R* lines, exit 0. Record the engine version the driver prints."
    why_human: "The host engine is not resolvable in this tree and is deliberately in no dependency manifest (NFR-5/D-98-10 carried risk) — reproducing this needs an out-of-tree install with real engine `session_start` machinery, not reachable from a unit/integration test. Phase 104's structurally identical canary route (R1/R2 removal assertions) was already run and closed by a human against real engine 3.5.1 on 2026-08-16, and demonstrated it can genuinely fail (a mutated copy with one uninstall skipped FAILED as required), so the mechanism is proven meaningful — the W1-W3 code follows the same conventions but is itself unexercised against a live engine."
    result: UNRUN
    correction: |
      WDOCS-02 correction, 2026-09-09. This entry previously carried an outcome of
      `CLOSED` and a closure date of 2026-08-16. Neither was true of THIS test.

      The entry settles itself: its own `why_human` field, unchanged above, says
      that what had actually been run and closed by a human on that date was the
      PREVIOUS phase's structurally identical canary route (the R1/R2 removal
      assertions), and that "the W1-W3 code follows the same conventions but is
      itself unexercised against a live engine". The unexercised reading is the
      true one; the closure was the over-claim.

      The outcome now reads UNRUN, which is the word this file's own truthful
      sites already use for this run (see the criterion-3 evidence cell and the
      artifact row). The retired outcome and date are quoted here rather than
      deleted: the point of this correction is that a record over-claimed, and a
      rewrite that reads as though it was always right would erase the only
      evidence of that.
    evidence: |
      WDOCS-02 correction, 2026-09-09. What this block said before is retired. It
      narrated a clean exit-zero run of this entry's own W1/W2/W3 assertions
      against real engine 3.5.1, and named each of the three as having passed.
      That narrative was never true of W1, W2 or W3, and it is the persuasive
      half of the false story -- correcting the outcome field while leaving it
      standing would have fixed the label and not the account.

      What WAS genuinely established on 2026-08-16, and still stands:
        - The PREVIOUS phase's canary route (the R1/R2 removal assertions, same
          script, same conventions) was run by a human against real engine 3.5.1
          and closed.
        - That run had a negative control: a disposable copy with one uninstall
          skipped FAILED with a named surviving envelope. The mechanism was
          therefore proven capable of failing, which is what makes a pass on
          that route mean anything.
        - The engine was installed into a disposable scratch prefix and deleted
          afterward; `package.json` and `package-lock.json` were never touched.

      What was NOT among it: W1, W2 and W3. The three assertions this entry names
      were never driven against a live engine at all. Keep the distinction sharp
      -- the mechanism was proven capable of failing; these particular assertions
      were never driven. The driver carrying them,
      `tests/live-uat/workflow-storage-canary.mjs`, was present on the branch
      where this phase ran and was never re-landed by the replay, so they cannot
      be driven on the current branch either. That open obligation is carried by
      `.planning/WINDOWS.md` entry id 72 (`unrun-verify`, prefixed
      `[workflows-replay]`; cited as id 45 until 2026-09-21 -- the merge of
      main PR #202 renumbered this branch's ledger ids 32-55 to 59-82).
      Id 72 was waived on 2026-09-21 at the milestone close and the obligation
      is carried by `.planning/BACKLOG.md` WSTOR-01.

---

# Phase 105: Workflow degradation and documentation Verification Report

**Phase Goal:** A user without the host engine still gets their workflows written and is told
plainly why they do not run yet, and the contract of a bridge that installs executable code is
stated where a plugin author will read it.
**Verified:** 2026-08-16
**Status:** passed (six of six criteria; the W1/W2/W3 live canary was never run — WDOCS-02 correction, 2026-09-09)
**Re-verification:** No — initial verification

> **WDOCS-02 correction, 2026-09-09.** The parenthetical above previously read
> "(live canary closed 2026-08-16 — see frontmatter evidence)", and it pointed the
> reader at a frontmatter evidence block that narrated a run of W1/W2/W3 which
> never happened. What closed on 2026-08-16 was the previous phase's structurally
> identical canary route, not this one — the entry's own `why_human` field says so.
> The phase status VALUE is deliberately unchanged: it is drawn from a small
> canonical set the tooling parses, and it is defensible at six of six criteria in
> its own right. What was wrong was the pairing, and the pairing is corrected here
> and at the human-verification entry rather than by breaking a parsed field.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A session exposing only a tool named `workflow` reads the host engine as absent; a session exposing both names reads it as present; an empty list and a throwing call both read absent | ✓ VERIFIED | `hasLoadedWorkflowEngine` (`platform/pi-api.ts:184`) matches `tool.name === "workflow_control"` by exact identity, no `sourceInfo` arm. `tests/platform/pi-api.test.ts:77` is the load-bearing negative: a tool list with only `workflow` (no `workflow_control`) asserts `false` — the exact false-positive shape `@nicknisi/pi-workflows` would otherwise trigger. A case-folding/prefix decoy (`Workflow_Control`, `workflow_controller`) also asserts `false` (:89-91), and a source-string decoy (`sourceInfo.source` naming the real package while `name` is `workflow`) asserts `false` (:99-101), proving the predicate reads only the tool name. Empty list and throwing `getAllTools()` both assert `false` (:105, :129), and the throw case's `catch` writes nothing to any output channel. |
| 2 | Installing a workflow-bearing plugin with no engine loaded writes every envelope, succeeds, and renders the degradation marker at `warning` severity | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts:5019` (`WDEP-02: a workflow-bearing install with the engine absent still writes the envelope and says so`) drives a real `installPlugin` and asserts the record and the on-disk envelope both exist, notification succeeds, severity is `warning`, and the marker is inside the brace. `:5099` covers the zero-workflow case (no brace at all even with the engine absent), closing the "would this false-positive on any degradable plugin" gap. |
| 3 | Installing the same plugin with the engine loaded renders byte-for-byte the block it rendered before this plan | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts:5065` byte-asserts the WHOLE undegraded block (not an absence-only check). Additionally `WDEP-03` (`:5220`) installs the SAME plugin twice under two probe states into separate hermetic homes and: (a) asserts non-vacuity first — both runs actually wrote (`assert.deepEqual(run.workflows, ["hello:ship"], ...)`) and reported differently (engine-absent run's block contains the marker at `warning`; engine-present run's WHOLE block is byte-asserted with `severity: undefined`) — before (b) asserting the raw envelope **bytes** (not parsed JSON) are identical across both runs. Falsified live: temporarily deleting the `stagedWorkflows` neutralization is not applicable here, but the plan's own recorded RED-A/RED-B (probe-conditional skip, probe-conditional reformat) were independently re-derivable from the test's own non-vacuity-then-equality structure on inspection. The boundary gate (`tests/architecture/no-probe-in-workflows-bridge.test.ts`) independently forbids `bridges/workflows/**` from importing `hasLoadedWorkflowEngine` / `softDepStatus`/`SoftDepStatus` / `workflowEngineLoaded` at all, enumerated from the live directory listing (not a hardcoded 5-entry array — WR-02 fixed), confirmed passing. The live canary's W1/W2/W3 assertion (a real engine's storage scan finds an envelope written while no engine tool was exposed) is present in code but **UNRUN** in this environment — see Human Verification. Given Phase 104's structurally identical canary route was run and closed against a real engine on 2026-08-16 and proven capable of failing, this is treated as acceptable carried risk, not a blocker, but is not silently counted as machine-verified either. |
| 4 | `DEPENDENCIES` is three members in order under a lock that did not exist before; `REASONS` is 40 with the new token at the tail and nothing moved | ✓ VERIFIED | Live check against the running module: `DEPENDENCIES === ["agents","mcp","workflows"]`, `REASONS.length === 40`, `REASONS.at(-1) === "requires pi-dynamic-workflows"`. `tests/architecture/notify-closed-set-locks.test.ts:53` pins the order-and-length lock (new — this was the only closed set without one). `grep -rnE 'requires pi-workflows\b'` across `extensions/`, `tests/`, `docs/`, both READMEs returns nothing — the wrong-package spelling never appears. |
| 5 | Two markers in one brace render in tuple order, byte-pinned by a catalog state | ✓ VERIFIED | `docs/output-catalog.md` carries `success-with-workflow-engine-absent` and `success-with-soft-dep-and-workflow-engine-absent`, both under `catalog-uat.test.ts`'s bidirectional walk. The second state pins the pi-subagents-then-host-engine order. `docs/workflows-compatibility.md` exists (200 lines, all 10 sections present exactly once), carries the mandatory 7-gate admit-versus-run table with exactly one row marked `**yes**` replicated, a 9-row shape table with both template-literal arms as separate rows, three distinct evidence grades in the `agent()` finding (`documented upstream`, `measured at runtime`, `read from the shipped engine source at 3.5.1` with an explicit `not driven at runtime`), and the phrase "not measured" does not appear anywhere about the host engine. Both `README.md` and `README.es.md` gained a Workflows Features bullet, a Prerequisites entry, and a link to the new doc, verified structurally parallel (`grep -c '^- '` identical on both). |
| 6 | `npm run check` is green and no dependency manifest changed | ✓ VERIFIED | `npm run check` exits 0 at this HEAD: `npm test` reports `tests 3696 / pass 3695 / fail 0 / skipped 1` (the one skip is the pre-existing platform-conditional `D-62-05` non-Linux skip, unrelated to this phase), and the chained `test:integration` run (18 tests) reports 0 failures, matching the exact numbers this task's brief named. `git diff --name-only` over the phase's commit range names no `package.json`/`package-lock.json`/`sonar-project.properties`. |

**Score:** 6/6 roadmap success criteria verified.

### Code Review Findings — Verified Fixed, Not Just Claimed

The phase submitted with a prior review (`105-REVIEW.md`, 1 critical + 5 warnings) whose disposition claimed all six were fixed by commits `7d0d70ff`, `5850d50e`, `06eb6a51`, `2fd4f3ad`. Each was independently re-verified against the current tree (not the commit message):

| Finding | Claim | Verification performed | Result |
|---|---|---|---|
| CR-01 | `degradationFromEnable` (`orchestrators/reconcile/apply.ts`) now lifts `stagedWorkflows` | Read the current function body — the lift is present, spread last, with a comment naming the regression it prevents. **Falsified by mutation test**: manually deleted the lift line, ran the stamp-coverage gate — it failed with `reconcile (enable projection): its Dependency[] derivation dropped the workflows arm -- the row renders no host-engine marker`. Restored the file, re-ran — green (7/7). | ✓ Confirmed fixed AND the fix is real, not decorative |
| WR-01 | The gate's reconcile-enable case now drives the real producer via a `__test_degradationFromEnable` seam instead of hand-building `stagedWorkflows: true` on the outcome literal | Read the gate case at `tests/architecture/notify-stamp-coverage.test.ts:420-441` — it calls `__test_degradationFromEnable({ status: "enabled", ..., stagedWorkflows: true })`, captures the lift's own output, and spreads `...lifted` onto the outcome literal fed to `buildReconcileAppliedCascade`. This is exactly what the mutation test above exercised: removing the lift makes `lifted` omit the field, which is what reddens the gate. | ✓ Confirmed — the gate genuinely pins the producer, not just the projection |
| WR-02 | The bridge probe gate now enumerates `bridges/workflows/` from disk rather than a hardcoded 5-entry array | Read `tests/architecture/no-probe-in-workflows-bridge.test.ts:60-64` — `forbiddenTargets()` calls `readdir(..., { recursive: true })`, filters `.ts`, sorts. A count-floor assertion guards against a vacuous empty enumeration. Ran the gate — passes. | ✓ Confirmed |
| WR-03 | ~20 doc-comment sites naming "BOTH soft-dependency flags" or the two-marker set were swept to name three | Grepped for `both.{0,30}soft-dep` / `soft-dep.{0,30}both` across the fourteen files the finding named — zero hits in production code except one residual (`orchestrators/plugin/uninstall.messaging.ts:27`, "composeReasons receives both flags `false`" — outside the finding's explicit site list, comment-only, no behavioral effect). All explicitly-named sites (`notify.ts`, `install.ts`, `update.ts`, `list.ts`, `uninstall.ts`, `update-row.ts`, `reinstall.ts`) confirmed updated to "all three". | ✓ Confirmed fixed at the named sites; one unlisted residual comment noted below (info, not blocking) |
| WR-04 | `docs/output-catalog.md`'s disabled-row prose now names three markers | Read `docs/output-catalog.md:365` — now reads `{requires pi-subagents}`, `{requires pi-mcp}` and `{requires pi-dynamic-workflows}` cannot appear either... passes all three soft-dependency flags as `false`. | ✓ Confirmed |
| WR-05 | Naming, Storage and discovery, and Registration and reload sections of `docs/workflows-compatibility.md` gained evidence-grade labels | Grepped `## ` headings against `Evidence grade` occurrences — all three previously-ungraded sections now open with or contain an explicit grade sentence, correctly split per-claim where the section mixes a runtime measurement with a source read (e.g. Storage and discovery: the scan-order/legacy-path claims are `read from the shipped engine source`, the round-trip and cross-project claims are `measured at runtime`). | ✓ Confirmed |

### The Fixer's Two Declined Items — Assessed

1. **Kept the gate's `>= 8` lower bound rather than an equality pin.** The gate's own comment (`notify-stamp-coverage.test.ts:307-324`) states this explicitly: "That set was enumerated by searching... which is a search and not a proof, so it is pinned HERE instead... If a NINTH derivation ever appears, add it here; the list is open, not closed." Sound: an equality pin (`=== 8`) would be a number to bump on the next dependency, indistinguishable from a real coverage claim, while the documented lower bound is honest about what it does and does not prove (it cannot discover a missed ninth site; it can only certify the eight it knows about).
2. **Left the four `tests/orchestrators/reconcile/notify.test.ts` cases hand-building `PerEntryOutcome`.** Read all four (`:1266`-`:1330`) — they test `buildReconcileAppliedCascade`'s projection contract (does a `PerEntryOutcome` carrying `stagedWorkflows`/`dependencies` render the row's `dependencies` array correctly, in tuple order) in isolation from the producer that populates that field. This is a genuinely different concern from the stamp-coverage gate's post-fix reconcile-enable case, which specifically drives `degradationFromEnable` (the producer) through the projection to catch the CR-01 regression class. Sound: hand-built input is the right shape for a pure projection test, and conflating the two would make failures harder to localize (a break in the producer and a break in the projection would both redden the same assertion).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | exact-identity probe on `workflow_control` | ✓ VERIFIED | Present, RH-3 shape, no `sourceInfo` arm |
| `shared/concerns/soft-dep.ts` | 3rd `DEPENDENCIES` member + marker | ✓ VERIFIED | `["agents","mcp","workflows"]`, `SOFT_DEP_MARKER_WORKFLOWS` present |
| `shared/notify.ts` | 40th `REASONS` member | ✓ VERIFIED | Confirmed live |
| `docs/output-catalog.md` | 2 new byte-gated states | ✓ VERIFIED | Both present, `catalog-uat.test.ts` passes |
| `docs/workflows-compatibility.md` | new compatibility doc | ✓ VERIFIED | 200 lines, 10 sections, all review gaps closed |
| `README.md` / `README.es.md` | Workflows entry + link | ✓ VERIFIED | Structurally parallel |
| `tests/architecture/no-probe-in-workflows-bridge.test.ts` | boundary gate | ✓ VERIFIED | Directory-enumerated, passing |
| `tests/live-uat/workflow-storage-canary.mjs` | W1/W2/W3 assertion | ⚠ PRESENT and code-reviewed on the branch this phase ran on; ABSENT on the current branch (WDOCS-02, 2026-09-09) | UNRUN against a real engine — see Human Verification |

> **WDOCS-02 correction, 2026-09-09.** The status cell above previously read a bare
> "✓ PRESENT, code-reviewed". Its UNRUN half was and remains right; its presence
> half was a fact about one tree stated as a fact about all of them. The driver
> existed on the branch where this phase ran; the replay that rebuilt this
> milestone never re-landed it, so it does not exist on the current branch and the
> W1/W2/W3 assertions cannot be driven here. Both halves are stated because
> collapsing two trees into one row is what made the row wrong. The open
> obligation is carried by `.planning/WINDOWS.md` entry id 72 (id 45 until the
> #202 merge renumbered the ledger on 2026-09-21; waived the same day, carried by
> `BACKLOG.md` WSTOR-01).

### Requirements Coverage

All six phase-105 requirement IDs (`WDEP-01`, `WDEP-02`, `WDEP-03`, `WDEP-04`, `WDOC-01`, `WDOC-02`) are declared across the four plans' `requirements:` frontmatter and mapped to concrete artifacts and tests as itemized above. No orphaned requirement IDs found in `REQUIREMENTS.md`'s Phase 105 traceability rows.

**Note (info, not a code defect):** `REQUIREMENTS.md`'s own checkboxes for all six Phase-105 requirement IDs still show `[ ]` unchecked and the traceability table still shows `Pending` — this is bookkeeping drift, not a functional gap (the same pattern as `.planning/workstreams/workflows/STATE.md`, which still shows "Phase 105 — EXECUTING, Plan 1 of 4" as an uncommitted working-tree diff despite all four plans, review, and fixes being complete on `HEAD`). Both should be corrected before/at milestone close.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX` markers in any file touched by this phase. No GSD process-artifact citations (`Phase NN`, `Plan NN`, `Wave N`) introduced by this phase's diff. One residual stale comment noted above (WR-03 follow-on, info-level).

### Human Verification Required

### 1. Live-engine canary: W1/W2/W3 (engine-absent install found by a real engine)

**Test:** Run `node tests/live-uat/workflow-storage-canary.mjs` against a real, locally installed
`@quintinshaw/pi-dynamic-workflows` host engine:

```bash
mkdir -p /tmp/wf-engine
npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows
PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-storage-canary.mjs
rm -rf /tmp/wf-engine
```

**Expected:** `PASS: W1 ... W2 ... W3 ...` alongside the existing `U*`/`P*`/`X`/`R*` lines, exit 0.
W1 asserts the degradation marker rendered on an install with no engine tool exposed; W2 asserts
the real engine's own storage scan finds that envelope by its generated name; W3 is the negative
control (a never-written name must be absent from the listing).

**Why human:** The host engine is not resolvable in this tree and is deliberately kept out of
every dependency manifest (an acceptance criterion of `105-03-PLAN.md` asserts
`package.json`/`package-lock.json` are untouched). This is the one criterion-3 proof layer that
cannot run inside `npm run check`. Mitigating context: Phase 104's structurally identical canary
route (the R1/R2 removal assertions, same script, same conventions) was run against real engine
3.5.1 and closed by a human on 2026-08-16, and was proven capable of failing (a deliberately
broken copy correctly FAILed with a named surviving envelope) — so the mechanism itself is not in
question, only whether the newly-added W1-W3 code, unexercised until now, behaves as written.

### Gaps Summary

No gaps. All six ROADMAP success criteria are verified against the actual codebase, not against
SUMMARY.md claims. All six code-review findings (1 critical, 5 warnings) were independently
re-verified as genuinely fixed — including a live mutation test that reverted the CR-01 fix and
confirmed the stamp-coverage gate catches the regression it was built to catch, which is the
exact property the review's WR-01 finding said was missing. The two items the fixer explicitly
declined to address are both sound engineering judgments, not corner-cutting. The sole open item
is the live-engine canary run, which needs a real out-of-tree engine install and is tracked as
an `unrun-verify` entry in `.planning/WINDOWS.md` (id 72) rather than silently assumed —
this phase is honest about what it has and has not proven.

> **WDOCS-02 correction, 2026-09-09.** The citation above previously named
> `.planning/WINDOWS.md` id 5. That citation is dangling and always will be: the
> ledger is shared and append-only across milestones, and phase numbers repeat, so
> a numeric position rots silently. Today's id 5 is a Phase-112 `deviation` about a
> stale ROADMAP row from a different milestone, already `fixed` — nothing to do
> with this canary. The paragraph is right that the item was open and right to say
> it was tracked rather than assumed; only the position was wrong. The obligation
> is now carried by id 45, an `unrun-verify` entry prefixed `[workflows-replay]`
> so it stays attributable when the phase number repeats again. Its scope is
> narrower than this paragraph's original: the storage assertions were never
> re-landed on the current branch, so the storage half of this route has no live
> coverage there at all. Re-landing it is a recorded deferred idea (D-117-01), not
> work this milestone took on.
>
> **WDOCS-02 correction, 2026-09-21.** The id above rotted a second time, by a
> mechanism the first correction did not anticipate: the merge of main PR #202
> (`9e48255a`) renumbered this branch's ledger ids 32-55 to 59-82, so "id 45"
> came to name an unrelated phase-07 `deviation` about
> `tests/scripts/coverage-source-map-fixtures.ts`. The entry this phase created
> (same description, `recorded_at: 2026-09-09T19:27:52.900Z`) is id 72. Its
> status also moved: it was waived at the milestone close on 2026-09-21, with the
> obligation carried by `.planning/BACKLOG.md` WSTOR-01, so "open" above now means
> "open in the backlog", not "open in the ledger". The lesson of the first
> correction stands and is now twice-measured: a bare ledger id is a position,
> not a name. The `[workflows-replay]` prefix and the `recorded_at` stamp are what
> made the successor findable.

---

*Verified: 2026-08-16*
*Verifier: Claude (gsd-verifier)*
