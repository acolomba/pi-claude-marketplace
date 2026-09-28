---
phase: 105-workflow-degradation-and-documentation
plan: 03
subsystem: testing
tags: [workflows, pi-dynamic-workflows, architecture-gate, live-uat, probe-independence]

# Dependency graph
requires:
  - phase: 105-workflow-degradation-and-documentation
    plan: 01
    provides: "`hasLoadedWorkflowEngine`, `SoftDepStatus.workflowEngineLoaded`, the `requires pi-dynamic-workflows` marker, and the engine-absent install case this plan generalizes"
provides:
  - "a probe-independence pair: two installs differing only in the session's tool list produce byte-identical envelopes and identical record inventories"
  - "`tests/architecture/no-probe-in-workflows-bridge.test.ts` — a boundary gate forbidding the workflows bridge from naming any probe symbol"
  - "a fourth live-canary assertion (W1/W2/W3): a real engine storage scan finds an envelope installed while no engine tool was exposed, with a negative control"
affects: [milestone close, workflows-compatibility docs]

actuals:
  tokens: 5000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Non-vacuity is asserted BEFORE the equality it guards, because two runs that each wrote nothing satisfy every equality — and writing nothing is the regression"
    - "A byte comparison over raw buffers catches a probe-driven formatting difference that a parsed comparison accepts"
    - "A boundary gate over the bridge is the structural half of a property the behavioural pair proves by example"

key-files:
  created:
    - tests/architecture/no-probe-in-workflows-bridge.test.ts
  modified:
    - tests/orchestrators/plugin/install.test.ts
    - tests/live-uat/workflow-storage-canary.mjs

key-decisions:
  - "The envelope read is ENOENT-tolerant and the absence is reported by the non-vacuity clause, not thrown from the read — a throw aborts before the comparison and hides WHICH of the two properties broke"
  - "Non-vacuity precedes the equalities. An equality-first pair certifies the short-circuit regression instead of catching it"
  - "TWO REDs were demonstrated, because the plan's named regression and the plan's named assertion are different clauses: a skip-the-write short-circuit reddens the non-vacuity clause, and a probe-conditional REFORMAT reddens the byte-equality clause"
  - "One case-insensitive `softDepStatus` pattern covers both the snapshot type and its composer, so the gate's three patterns cover four identifiers"
  - "The canary's `.mjs` is NOT prettier-managed (the hook matches `\\.(js|json|ts)$`); a `prettier --write` was reverted because it reformatted five pre-existing lines"

patterns-established:
  - "Prove a non-vacuity clause by breaking the property it guards and confirming the clause — not the equality — is what reddens"
  - "A live-UAT assertion that depends on an incidental environment fact asserts that fact first, or it proves nothing"

requirements-completed: [WDEP-03]

coverage:
  - id: D1
    description: "Two installs of one workflow-bearing plugin, differing ONLY in whether the session exposes `workflow_control`, write byte-identical envelopes and record identical `resources.workflows`"
    requirement: WDEP-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WDEP-03: the same install under two probe states writes the same envelope bytes"
        status: pass
      - kind: manual
        ref: "RED-A — a probe-conditional skip inserted into the ledger's workflows phase; the non-vacuity clause reddened, then reverted"
        status: pass
      - kind: manual
        ref: "RED-B — a probe-conditional reformat of the committed envelope; the byte-equality clause reddened on a 160-vs-156-byte whitespace diff, then reverted"
        status: pass
    human_judgment: false
  - id: D2
    description: "That equality is non-vacuous: both runs are proven to have written, and the engine-absent run carries the degradation marker inside a brace while the engine-present run's WHOLE block is asserted"
    requirement: WDEP-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WDEP-03 — the non-vacuity halves, asserted ahead of the equalities"
        status: pass
      - kind: manual
        ref: "RED-A's diagnostic is the non-vacuity message verbatim: `neither run may reach the equalities below having written nothing -- the comparison would then pass vacuously`"
        status: pass
    human_judgment: false
  - id: D3
    description: "No file under `bridges/workflows/` references the probe, its snapshot type, or the workflow-engine flag, enforced by a gate that FAILS on a missing target"
    requirement: WDEP-03
    verification:
      - kind: unit
        ref: "tests/architecture/no-probe-in-workflows-bridge.test.ts#WDEP-03 + WBRG-04: the workflows bridge carries zero host-engine probe surface"
        status: pass
      - kind: manual
        ref: "a real `hasLoadedWorkflowEngine` import added to discover.ts — the gate reddened and named that file; reverted"
        status: pass
      - kind: manual
        ref: "a comment-only mention of all three identifiers added to discover.ts — the gate stayed green; reverted"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live canary asserts that a real host engine's own storage scan finds an envelope installed while the session exposed no engine tool"
    requirement: WDEP-03
    verification:
      - kind: manual
        ref: "tests/live-uat/workflow-storage-canary.mjs#W1/W2/W3 — UNRUN here; the engine is not resolvable in this tree and is in no dependency manifest by design"
        status: pending
    human_judgment: true
    rationale: "Requires `@quintinshaw/pi-dynamic-workflows` resolvable out of tree. The command is recorded below. The script's precondition path was exercised: with no engine root set it exits 1 with its resolution hint and reports no false pass."

duration: 25min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 03: Workflow degradation and documentation Summary

**"The artifacts do not depend on the probe" stops being a claim: two installs differing only in the session's tool list now write the same envelope bytes, the workflows bridge is structurally forbidden from naming a probe symbol, and the live canary carries an assertion that a real engine finds an envelope installed without it.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-15T22:53:45-04:00 (first task commit)
- **Completed:** 2026-08-15T22:59:32-04:00
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- The probe-independence pair installs one workflow-bearing plugin into two separate hermetic workflow homes under two mock sessions whose only difference is the tool list, then compares the envelopes as **raw buffers**. A parsed comparison would accept a probe-driven difference in key order or whitespace, and the byte shape is what the engine's storage scan reads — RED-B below is that exact case.
- **The non-vacuity clause is asserted first, and it is load-bearing.** Two runs that each wrote nothing satisfy every equality in the case, and writing nothing is precisely what a probe-conditional short-circuit produces. An equality-first pair would certify the regression rather than catch it. RED-A proves the ordering matters: with the short-circuit in place, the clause that reddens is the vacuity guard, not the comparison.
- The boundary gate reads all five files under `bridges/workflows/` through the shared comment-stripping scanner, passes no missing-target escape, and defines no scanner of its own. It was proved in both directions: a real probe import reddens it and names the file; a comment-only mention of all three identifiers does not.
- The canary's fourth assertion asserts the degradation marker on the rendered row **before** reading anything back. The driver's session exposes no tools, so its installs are already engine-absent — that fact is incidental to the other assertions and load-bearing to this one, so it is asserted rather than assumed. Without it, W2 would pass while proving nothing about WDEP-03.
- `npm run check` exits 0 unpiped: 3696 unit (1 pre-existing platform skip) + 18 integration, 0 failures.

## Task Commits

1. **Task 1: Two installs, two probe states, one set of bytes** — `e76f7ccf` (test)
2. **Task 2: The bridge cannot ask whether the engine is loaded** — `d6d738ef` (test)
3. **Task 3: The live canary proves a real engine finds an envelope written without it** — `00e1177e` (test)

## The four demonstrated REDs

Every one was reverted in its own task; `git status --short -- extensions/` was confirmed empty after each.

**RED-A — a probe-conditional skip in the ledger's workflows phase.** Threaded the probe into `InstallLedgerOptions` temporarily and short-circuited `workflowsPhase.do` before staging. Observed:

```text
neither run may reach the equalities below having written nothing -- the comparison would then pass vacuously
+ actual - expected
+ []
- [ 'hello:ship' ]
```

The **non-vacuity clause** is what reddened, which is the point: the two equalities would both have passed over two empty runs.

**RED-B — a probe-conditional reformat.** Same temporary plumbing, but instead of skipping, the committed envelope was re-serialized at indent 4 when the probe read absent. Observed:

```text
the envelope bytes must not vary with the probe -- a probe-conditional write is what
breaks the install-the-engine-later convergence
+ Buffer(160) [Uint8Array] [ ... ]
- Buffer(156) [Uint8Array] [ ... ]
```

A four-byte whitespace difference, with both non-vacuity halves green. **A `JSON.parse` comparison would have accepted this**, which is why the acceptance criterion forbids one.

**RED-C — a real probe import in `bridges/workflows/discover.ts`.** Observed:

```text
WDEP-03 / WBRG-04 violation: host-engine probe surface detected in the workflows bridge:
  extensions/pi-claude-marketplace/bridges/workflows/discover.ts matches forbidden
  hasLoadedWorkflowEngine probe: /\bhasLoadedWorkflowEngine\b/
```

**RED-D (the inverse) — a comment naming all three forbidden identifiers** in the same file. The gate stayed green, confirming the `stripComments` pass does its job.

## Files Created/Modified

- `tests/architecture/no-probe-in-workflows-bridge.test.ts` (new) — five targets matching `ls extensions/pi-claude-marketplace/bridges/workflows/` exactly; three patterns; `grep -c 'readFile'` and `grep -c 'allowMissing'` both return 0
- `tests/orchestrators/plugin/install.test.ts` — the `installUnderProbe` helper (one whole install per hermetic workflow home, reusing `withHermeticWorkflowHome` rather than a second sandbox mechanism) and the WDEP-03 case
- `tests/live-uat/workflow-storage-canary.mjs` — `DEGRADED_PLUGIN` / `DEGRADATION_MARKER`, a third fixture plugin, `proveEngineAbsentInstallIsFound` (W1/W2/W3), its call site after the key-isolation assertion, and its teardown uninstall

## Decisions Made

- **The envelope read is ENOENT-tolerant.** The first draft used a bare `readFile`, and under RED-A the case died on `ENOENT` inside the helper — upstream of every assertion, so the failure named a missing file rather than the broken property. Returning `undefined` and reporting the absence from the non-vacuity clause makes the diagnostic say which of the two properties broke.
- **Two REDs, not one.** The plan asked for a short-circuit RED and for the byte-equality clause to fail; those are different clauses, because a short-circuit makes the equality vacuous rather than false. Demonstrating only the short-circuit would have left the byte-equality clause unproven, and demonstrating only the reformat would have left the vacuity guard unproven.
- **One case-insensitive pattern for `softDepStatus`.** The plan named three identifiers: the probe, the snapshot type (`SoftDepStatus`) and the flag. The snapshot type and its composer function differ only in case, and neither belongs in a bridge, so `/\bsoftDepStatus\b/i` covers both under one named pattern rather than adding a fourth entry that reads as a duplicate.
- **The canary asserts its own precondition.** `loadExtension` builds a `pi` with `getAllTools: () => []`, so every install in the driver is already engine-absent. That is incidental — a future edit could give the mock a tool list — so W1 asserts the marker on the row and fails loudly if the session was not engine-absent, rather than letting W2 pass for the wrong reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first draft's RED failed upstream of the assertion it was meant to prove**

- **Found during:** Task 1
- **Issue:** With the short-circuit inserted, the case failed with `ENOENT ... /saved/hello:ship.json` from inside the helper. The byte-equality clause was never reached, so the RED demonstrated only that no file existed — not that the pair's comparison catches the regression.
- **Fix:** The read now returns `undefined` on `ENOENT` (rethrowing every other code), the run shape carries `envelope?: Buffer`, and the non-vacuity clause moved ahead of the equalities so it is what reports the absence.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** RED-A now reddens on the non-vacuity message verbatim; RED-B reddens on the byte-equality message
- **Committed in:** `e76f7ccf`

**2. [Rule 3 - Blocking] `@typescript-eslint/use-unknown-in-catch-callback-variable`**

- **Found during:** Task 1
- **Issue:** The `.catch((err: NodeJS.ErrnoException) => ...)` annotation is a lint error in this config.
- **Fix:** Annotated `err: unknown` and narrowed at the `.code` read. No disable directive.
- **Committed in:** `e76f7ccf`

**3. [Rule 1 - Bug] `prettier --write` on the canary reformatted five pre-existing lines**

- **Found during:** Task 3
- **Issue:** `prettier --check` flagged the canary, so it was formatted — and the diff then carried five long lines this plan never touched. The pre-commit prettier hook matches `\.(js|json|ts)$`, so `.mjs` has never been prettier-managed; the "failure" was the file's pre-existing state, not this plan's additions.
- **Fix:** `git checkout -- tests/live-uat/workflow-storage-canary.mjs` and all six edits reapplied by hand, formatted to the file's existing style. The final diff removes exactly one pre-existing line — the `plugins: [...]` array this plan intentionally extends.
- **Files modified:** `tests/live-uat/workflow-storage-canary.mjs`
- **Committed in:** `00e1177e`

### Sequencing notes

**4. Task 1's RED needed temporary production plumbing.** `InstallLedgerOptions` carries no `pi` — the ledger genuinely cannot reach the probe today, which is itself evidence for the property. Demonstrating the regression therefore required temporarily adding a field, supplying it at `buildInstallLedgerOptions`, and inserting the conditional. All three edits were reverted from a pre-patch copy; `git diff --name-only -- extensions/` is empty for this plan and `extensions/` appears in none of the three commits.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking) + 1 sequencing note
**Impact on plan:** Deviation 1 is the substantive one — it changed what the pair's diagnostic says under the regression, which is the whole value of a non-vacuity clause. The rest are small.

## Issues Encountered

- **A short-circuit makes an equality vacuous, not false.** This is the trap the plan's threat register calls `T-105-03-02`, and it is sharper than it reads: the natural drafting order (equalities first, non-vacuity after) puts the vacuity guard *behind* the assertion it guards, so under the regression the case fails on the guard anyway — but only by accident of ordering, and a reader would then not know whether the property held. Asserting non-vacuity first makes the diagnostic unambiguous.
- **`.mjs` is outside every formatter gate in this repo.** `npm run format:check` and the pre-commit prettier hook both scope to `js|json|ts`. Running prettier on a `.mjs` file is therefore always a non-surgical change (see deviation 3).
- **`pre-commit run --files` reports `npm lint` / `npm format check` / `npm typecheck` as "no files to check" for test-only changes.** Those hooks are path-scoped and did not fire on this plan's files. `npx tsc --noEmit`, `npx eslint` and `npx prettier --check` were run directly on each changed file instead, and `npm run check` was run unpiped at the end.
- **`npm run check` unpiped: `EXIT=0`, 3696 unit + 18 integration, 0 failures.** One skip is pre-existing and platform-conditional (`D-62-05: reapOrphans on non-Linux platform soft-skips SIGKILL`, skipped because this host is Linux) — not a defect and not this plan's.
- **A stash from a concurrent session exists on the shared stack** (`stash@{0}: WIP on gsd-reviewfix/60-293650`). Nothing here touched it.

## Known Stubs

None. Every assertion added is live in `npm run check` except the live-canary one, which is documented below and recorded in `.planning/WINDOWS.md` as an `unrun-verify` entry.

## User Setup Required

**The live canary assertion (W1/W2/W3) is UNRUN and must be executed as a human verification before phase verification.** The host engine is not resolvable in this tree and is deliberately in no dependency manifest (`git diff --name-only -- package.json package-lock.json` is empty for this plan).

Exact command:

```bash
mkdir -p /tmp/wf-engine
npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows
PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-storage-canary.mjs
rm -rf /tmp/wf-engine
```

Expect `PASS: W1 ... W2 ... W3 ...` alongside the existing `U*` / `P*` / `X` / `R*` lines, and exit 0. Record the engine version the driver prints on its load line, and the `W3` negative-control result.

The precondition path WAS exercised here: run with no engine root set, the script prints its resolution hint and exits **1** — `human_needed`, never a false pass. It leaves no sandbox behind (`/tmp/workflow-storage-*` is empty after the run).

## Next Phase Readiness

Ready. Open items:

- **WDOC-01 is untouched** — `docs/workflows-compatibility.md` and the README pair remain the phase's documentation work (plan 04).
- **The live canary run is the one outstanding WDEP-03 obligation.** Its structural halves are both in `npm run check`; only the reload half needs the operator.
- **Three prose files still carry stale soft-dep counts** no gate covers: `docs/messaging-style-guide.md` (`:28`, `:61`, `:67`, `:84`, `:166`) and `docs/open-closed-proof.md:56`.
- **The new gate's target list is CLOSED and self-checking**, unlike the derivation-coverage gate's open surface list: WR-06 fails on a missing target, so adding a sixth file under `bridges/workflows/` is the only way to escape it — and that is a visible, deliberate act.

## Self-Check: PASSED

- All three named artifacts exist on disk (`tests/architecture/no-probe-in-workflows-bridge.test.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/live-uat/workflow-storage-canary.mjs`).
- All three commit hashes resolve in `git log` (`e76f7ccf`, `d6d738ef`, `00e1177e`).
- `git diff --diff-filter=D 6e651413..HEAD` lists no deletion.
- `extensions/` appears in none of the three commits; `git diff --name-only -- extensions/` is empty.
- Neither `STATE.md` nor `ROADMAP.md` appears in any of the three commits.
- `git diff --name-only -- package.json package-lock.json` is empty.

---
*Phase: 105-workflow-degradation-and-documentation*
*Completed: 2026-08-15*
