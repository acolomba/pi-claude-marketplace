---
phase: 115-composition-orchestrators
plan: 07
subsystem: testing
tags: [node-test, reconcile, projection, exhaustive-row-table, direct-coverage]

requires:
  - phase: 115-composition-orchestrators
    plan: "01"
    provides: "The measured environment facts: git hooks absent, scoped pre-commit only, filesystem trufflehog route, pre-existing format:check noise from untracked files"
  - phase: 115-composition-orchestrators
    plan: "03"
    provides: "The correspondence-gate baseline at 17 violations and the warning that a type-level negative can compile clean while asserting nothing"
  - phase: 113-reconcile-planner
    plan: "31"
    provides: "tests/orchestrators/reconcile/plan.test.ts, the pure-projection case shape this owner copies"
provides:
  - "A contract-compliant sole owner for orchestrators/reconcile/notify.ts at 100 percent direct branch, function, and line coverage"
  - "A settled applied-cascade row shape: every one of the 16 PerEntryOutcome kinds asserted as a complete ReconcileAppliedCascadeMessage"
  - "A compile-time pin that fails typecheck when a PerEntryOutcome kind gains no owner cell, replacing the three deleted assertNever arms"
  - "tests/integration/reconcile-plan-convergence.test.ts, the relocated cross-layer fixed-point identity"
affects: [115-05, 115-08, 116, 117]

actuals:
  tokens: 27565
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Exhaustive owner row table keyed by a production discriminated-union discriminant, so a new union member is a typecheck failure in the owner rather than a silently unproved arm"
    - "A defensive default arm is only removable once the compiler can prove the remaining switch exhaustive; hoisting the nullish arm to an early return is what buys that proof"
    - "A real on-disk fixture that is a regular file where a directory belongs drives a genuine resolver throw, so a catch path is proved without faking the resolver"

key-files:
  created:
    - tests/integration/reconcile-plan-convergence.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "Removed the list arm from the block-message switch into an early return rather than keeping it as a case; TypeScript does not credit a `case undefined:` arm towards exhaustiveness, so leaving it in the switch made the function unable to compile without a default"
  - "Restored the compile-time drift alarm the three deleted assertNever arms provided by pinning the owner's applied-cascade table to `PerEntryOutcome[\"kind\"]` as a mapped type, and proved it by planting a 17th kind"
  - "Landed absorption and deletion as two consecutive commits, absorption first, because Task 2's own gate requires the supplemental to still exist and pass at the end of Task 2; no evidence is absent at any commit"
  - "Wrote the force-install key as the escape sequence `\\u0000` rather than a raw control byte, so the file stays ASCII text and greppable"

patterns-established:
  - "Prove a type-level pin by planting: drop a table key and confirm TS2741, swap a cell's discriminant and confirm TS2322"
  - "Prove an exhaustiveness claim by widening the union it covers and confirming the compiler names the new member"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "orchestrators/reconcile/notify.ts reaches 100 percent direct functions, lines, and branches with its owner run alone and no coverage exception"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every applied-cascade outcome arm is proved through the public entrypoint with a complete, independently authored message"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#projects the complete cascade for a <kind> outcome (16 sibling cases from one marked body)"
        status: pass
      - kind: unit
        ref: "planted violation: dropped the plugin-disabled cell (TS2741), swapped the mp-added cell's outcome to mp-removed (TS2322), flipped one expected severity (1 case red); all three restored"
        status: pass
    human_judgment: false
  - id: D3
    description: "Four unreachable defensive arms are gone from notify.ts with no public message change and no seam, export, pragma, or coverage exception added"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/{pending,apply}.test.ts plus the projection-edge supplemental before deletion (51 tests, 51 pass, unmodified)"
        status: pass
      - kind: unit
        ref: "planted violation: added a fourth ReconcileBlockStatus member, typecheck failed TS2366 at blockToMarketplaceMessage; reverted"
        status: pass
    human_judgment: false
  - id: D4
    description: "The projection-edge supplemental is absorbed into the owner and deleted; the cross-layer fixed-point identity lives under tests/integration/ intact"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "git log --follow tests/integration/reconcile-plan-convergence.test.ts shows the rename; the file's two cases and assertions are unchanged"
        status: pass
      - kind: integration
        ref: "npm run test:integration (30 tests, 30 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The correspondence gate reports neither reconcile supplemental"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node scripts/check-corresponding-tests.mjs — 17 violations before, 15 after; neither notify-projection-edge nor plan-convergence is named"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 07: Reconcile Projection Owner Summary

**The applied-cascade projection is now proved kind-by-kind from a table the compiler forces to stay exhaustive — which is also what let four defensive arms leave production without losing the drift alarm they were there to raise.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 of 3
- **Files changed:** 4 (1 production, 1 owner rewritten, 1 relocated, 1 deleted)

## Accomplishments

- Rewrote `tests/orchestrators/reconcile/notify.test.ts` to the contract: four top-level
  `describe()` blocks, one per exported runtime entrypoint; 48 case bodies each carrying
  separate lowercase `// arrange`, `// act`, `// assert` phases; one
  `assert.deepStrictEqual` on the complete returned message per case. The previous file
  had 45 unmarked cases leaning on `assert.equal` / `assert.ok` probes of one field at a
  time, and 41 placeholder value names.
- Closed the coverage gap the plan named. Direct coverage moved from
  `branches 89/112, functions 18/21, lines 881/954` to `branches 125/125, functions 21/21,
  lines 948/948` with the owner run alone. The newly proved surface is the whole
  marketplace-subject half of the outcome projector, the plugin-failure half, both
  realized-transition block arms, the `reasonAsContent` fallback, the block sort
  comparator, the plan-emptiness predicate's inner per-marketplace test, and the
  force-install resolve catch.
- Built the applied-cascade proof as a table keyed by `PerEntryOutcome["kind"]` through a
  mapped type, so each cell's outcome is pinned to its own key and the key set is pinned
  to the union. Sixteen sibling cases come out of one marked body, each asserting the
  complete `ReconcileAppliedCascadeMessage`.
- Removed four defensive `default:` arms from `orchestrators/reconcile/notify.ts` under
  D-05, plus the `assertNever` import they were the only users of. The module's public
  messages are unchanged: the `pending`, `apply`, and projection-edge suites passed
  unmodified across the removal.
- Absorbed both projection-edge cases into the owner and deleted the supplemental. The
  bare partial-remove header now rides a contrast case that asserts a two-block cascade
  where one marketplace carries a reasons brace and the other does not, which is a
  sharper claim than the original single-block case.
- Relocated the cross-layer fixed-point identity to
  `tests/integration/reconcile-plan-convergence.test.ts` with `git mv`. Only the header
  path comment and the import depth changed; both cases and every assertion are
  byte-identical.
- Took the correspondence gate from 17 violations to 15.

## Task Commits

1. **Task 1: Relocate the cross-layer fixed-point identity** — `98c66eeb` (test)
2. **Task 2: Remove the unreachable projection defaults and normalize the owner** — `9e37915b` (test)
3. **Task 3: Retire the absorbed supplemental** — `18ef201f` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — 11 insertions,
  17 deletions. Four `default:` arms and one import removed; the block-message list arm
  became an early return.
- `tests/orchestrators/reconcile/notify.test.ts` — sole mirrored owner. 48 case bodies
  producing 77 runtime cases, 1982 lines (was 45 unmarked cases, 1247 lines).
- `tests/integration/reconcile-plan-convergence.test.ts` — relocated from
  `tests/orchestrators/reconcile/plan-convergence.test.ts`, rename recorded in git, 2
  cases unchanged.
- `tests/orchestrators/reconcile/notify-projection-edge.test.ts` — deleted after both its
  cases were present in the owner.

## Caller Trace Behind the Four Removals

Recorded per the plan's requirement, from `codegraph explore` plus a repository grep:

| Arm | Scrutinee's declared type | Cases the switch already lists | Call sites reaching the function |
|-----|---------------------------|--------------------------------|----------------------------------|
| `blockToMarketplaceMessage` (was line 162) | `block.status`, declared `status?: ReconcileBlockStatus`, i.e. `"added" \| "removed" \| "failed" \| undefined` | all four | `buildReconcilePendingNotification` and `buildReconcileAppliedCascade`, both via `.map(blockToMarketplaceMessage)`. Status is only ever set by `applySourceMismatch` (`"failed"`) and `applyMarketplaceOutcomeToBlock` (`"added"`, `"removed"`, `"failed"`) |
| `applyMarketplaceOutcomeToBlock` (was line 726) | `outcome.kind` over `Extract<PerEntryOutcome, {kind: "mp-added" \| "mp-removed" \| "mp-add-failed" \| "mp-remove-failed" \| "mp-remove-partial" \| "source-mismatch" \| "invalid-block"}>` — exactly seven kinds | all seven | one: `applyOutcomeToBlock`, from its seven marketplace cases |
| `applyPluginOutcomeToBlock` (was line 835) | `outcome.kind` over the same `Extract<>` shape across the nine plugin kinds | all nine | one: `applyOutcomeToBlock`, from its nine plugin cases |
| `applyOutcomeToBlock` (was line 868) | `outcome.kind` over the full `PerEntryOutcome` union, 16 distinct kinds | all 16 | one: `buildReconcileAppliedCascade` |

No legal value reaches any of the four. None was kept alive by fabricating an impossible
value, and no seam, export, pragma, or coverage exception was added.

## Decisions Made

- **The list arm became an early return, not a switch case.** Deleting the default made
  the function fail `TS2366` because TypeScript does not treat a `case undefined:` arm as
  contributing to exhaustiveness. Hoisting the nullish check above the switch — proved
  with a two-file minimal repro — leaves a three-token switch the compiler *does* prove
  exhaustive, so a fourth `ReconcileBlockStatus` member is a compile error at that
  function. Verified by planting one.
- **The owner's table replaces the deleted `assertNever` alarm.** Measured honestly: with
  the three arms removed and the old test file in place, adding a 17th `PerEntryOutcome`
  kind compiled clean and the projection would have silently dropped the row. With the
  owner's `AppliedOutcomeRows` mapped type in place, the same plant fails `npm run
  typecheck` with `TS2741 Property '"mp-frobbed"' is missing`. The alarm is not lost; it
  moved from unreachable production code into the owner, where it is inside `npm run
  check` and costs no uncoverable line.
- **Absorption and deletion are two consecutive commits, absorption first.** D-115-05 asks
  for one change, but Task 2's own gate requires the supplemental to still exist and pass
  at the end of Task 2, which forces the split. The ordering chosen is the safe one: the
  evidence is present in the owner one commit before the supplemental leaves, so no commit
  in the history lacks it.
- **The partial-remove absorption became a contrast case.** Rather than transplanting the
  single-block case verbatim, the owner asserts a two-block cascade where `mp-remove-partial`
  carries a bare `(failed)` header and `mp-remove-failed` carries its reasons brace. The
  kind table also holds a standalone `mp-remove-partial` cell, so both the isolated shape
  and the contrast are pinned.
- **Force-install keys are written as `\u0000` escapes.** An earlier edit wrote real NUL
  bytes into the source, which made the file binary to `grep` and `file`. The escape
  sequence is the same value and keeps the file ASCII text.

## Deviations from Plan

**1. [Rule 3 — Blocking] The block-message switch could not lose its default without a restructure**

- **Found during:** Task 2
- **Issue:** Deleting `default: assertNever(block.status)` produced
  `TS2366: Function lacks ending return statement`. Hoisting the status into a local const
  did not help; TypeScript's exhaustiveness analysis does not credit a `case undefined:`
  arm.
- **Fix:** Moved the list arm to an early return above the switch, exactly the restructure
  the plan's Task 2 action authorized. Confirmed with a minimal repro and with a planted
  fourth status token.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
- **Commit:** `9e37915b`

**2. Task boundary shifted: the applied-cascade cases landed in the Task 2 commit**

- **Found during:** Task 2
- **Issue:** The plan splits normalization (Task 2) from case addition and absorption
  (Task 3). Rewriting the owner to the contract while leaving the applied-cascade table
  out would have meant writing the file twice.
- **Fix:** The full rewrite, including the absorbed cases, landed in `9e37915b`; Task 3's
  commit `18ef201f` is the deletion alone. Both tasks' verification gates were run at
  their own boundaries and both passed, including Task 2's requirement that the
  supplemental still be present and green.
- **Commit:** `9e37915b`, `18ef201f`

Nothing else deviated. No production file other than `notify.ts` changed; `apply.ts` and
`pending.ts` are byte-identical (`git diff --quiet`, exit 0).

## Issues Encountered

- **`npm run check` stops at `format:check`.** The chain is
  `typecheck && lint && fallow && format:check && test && test:integration`, and
  `format:check` fails on the pre-existing untracked `.mcp.json` and seven
  `.planning/research/.cache/*.json` files, which this plan must not touch. `npm test`
  and `npm run test:integration` were therefore run separately, as 115-01/03/04 did.
- **TruffleHog's git-mode hook cannot run in this linked worktree.** Structural, not
  transient: `.git` is a file, so the scan aborts on the index. The CLAUDE.md filesystem
  route was used instead on every changed path, with `--results=verified,unknown --fail`.
- **A Python-in-heredoc edit wrote literal NUL bytes.** One level of backslash was consumed
  in transit, so `'\\u0000'` reached Python as a NUL escape. Caught because `file` reported
  the source as `data` rather than `JavaScript source`; replaced with the two-character
  escape and re-verified.

## Verification Evidence

Measured, not estimated:

- `node --test tests/orchestrators/reconcile/notify.test.ts` — **77 tests, 4 suites, 77
  pass, 0 fail.**
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
  — verbatim verdict line:
  `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts (branches 125/125, functions 21/21, lines 948/948)`
  (baseline before this plan: `Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts: branches 89/112, functions 18/21, lines 881/954`).
- `node scripts/check-corresponding-tests.mjs` — **17 violations before, 15 after.**
  Neither `tests/orchestrators/reconcile/notify-projection-edge.test.ts` nor
  `tests/orchestrators/reconcile/plan-convergence.test.ts` is named. The 15 remaining are
  the six `missing-test` edge entries, the `wrong-import` on `import/execute.test.ts`
  (P115-02's), and the eight `unexpected-test` entries deferred to Phases 116 and 117.
- `npm run typecheck` — clean.
- `npm exec -- eslint` on both changed pair members — 0 problems.
- `npm exec -- prettier --check` on every changed file — all matched files use Prettier
  code style.
- `npm run fallow` — exit code 0, read as a real exit status. Its `✗`-prefixed duplication
  summary line is informational and names no file from this plan.
- `node --test tests/orchestrators/reconcile/{pending,apply}.test.ts` plus the
  projection-edge supplemental, run after the production removals and before the deletion
  — **51 tests, 51 pass, 0 fail**, all three files unmodified.
- `npm test` — **4783 tests, 269 suites, 4783 pass, 0 fail** (exit 0).
- `npm run test:integration` — **30 tests, 30 pass, 0 fail** (exit 0), including the
  relocated file.
- `git log --follow --oneline -- tests/integration/reconcile-plan-convergence.test.ts` —
  history follows through the rename to `079c3f2e test(113-31): complete reconcile plan ownership`.
- `git diff --quiet -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` — exit 0.
  `git diff --stat -- extensions/` across all three commits is one file, 11 insertions,
  17 deletions.
- Prohibited-pattern scan on the owner (`test.only|skip|todo`, `node:coverage ignore`,
  `c8 ignore`, `as unknown as`, `as any`, `anyTimes()`, `It.isAny()`, `verifyAll()`,
  capitalized phase markers, `const msg|result|data|value|subject|sut`) — no match.
- Phase-marker count: 48 `// arrange`, 48 `// act`, 48 `// assert`, 48 case bodies, 4
  top-level `describe()`. Five of those bodies are row loops wrapping `test()`, which is
  why 48 bodies emit 77 runtime cases. No `// act & assert` appears; there is no throwing
  or rejecting expression in this pair.
- `pre-commit run --files <changed files>` on both non-deletion commits — every hook
  passes except TruffleHog (structural worktree failure, covered by the filesystem scan)
  and `npm format check` (pre-existing untracked files).
- TruffleHog filesystem scan over every changed path with `--results=verified,unknown --fail`
  — `verified_secrets: 0, unverified_secrets: 0` on both runs.

## Planted-Violation Proofs

Per the carry-forward warning, five controls were run and reverted. Each was confirmed to
fail before restoring:

1. **Fourth `ReconcileBlockStatus` member.** Added `"skipped"` to the `Extract<>`.
   `npm run typecheck` failed with
   `notify.ts(133,4): error TS2366: Function lacks ending return statement`. The
   restructured switch really is the exhaustiveness gate the deleted default is no longer
   needed for.
2. **Seventeenth `PerEntryOutcome` kind, before the rewrite.** Added `mp-frobbed` to the
   union with the three `assertNever` arms already removed and the old test file in place:
   typecheck was **clean**. This is the honest measurement of what the removal cost.
3. **Seventeenth `PerEntryOutcome` kind, after the rewrite.** The same plant against the
   new owner failed with
   `notify.test.ts(60,3): error TS2741: Property '"mp-frobbed"' is missing ... but required in type 'AppliedOutcomeRows'`.
   The alarm is restored, in the owner, at no coverage cost.
4. **Missing table key.** Deleted the `plugin-disabled` cell: `TS2741 Property
   '"plugin-disabled"' is missing`.
5. **Mismatched cell discriminant.** Put an `mp-removed` outcome in the `mp-added` cell:
   `TS2322: Type '"mp-removed"' is not assignable to type '"mp-added"'`. A cell cannot
   drift from its key.
6. **Wrong expected severity.** Flipped one row's expected `warning` to `info`: exactly
   one case went red, 76 stayed green. The whole-value comparisons discriminate.

Every expected value in the owner is an authored literal built from the closed `REASONS`
and status vocabularies. No expectation is produced by calling a production projector,
formatter, or classifier. The one shared object across an expectation boundary is the
`Error` instance in the invalid-config case, which is the input's own cause and is asserted
by identity on purpose.

## Notes on the Shipped Grammar

`docs/messaging-style-guide.md` and `docs/output-catalog.md` govern rendered row strings.
This pair produces structured `MarketplaceNotificationMessage` / `PluginNotificationMessage`
values, not strings; the renderer that turns them into rows lives in `shared/notify.ts` and
is a different pair. The catalog is still enforced here, by type: every `reasons` literal in
the owner is checked against `ContentReason`, so a token outside the closed set is a compile
error rather than a passing test.

## Known Stubs

None.

## Broken-Windows Ledger

No entry recorded. This plan produced no stub, no skipped test, no unrun `<verify>`, and no
deviation that leaves a defect behind — deviation 1 is a completed restructure and deviation
2 is a commit-boundary shift. The one finding that would otherwise qualify, the compile-time
alarm lost with the `assertNever` arms, was measured and then closed inside this same plan
by the owner's exhaustive table (planted proofs 2 and 3 above), so there is nothing open to
carry to `/gsd-ship`.

## Threat Flags

None. The change adds no network endpoint, auth path, file access pattern, or schema change.
The one fixture-backed case (T-115-07-C) owns its temporary tree, removes it through
`t.after()`, sets no environment variable, and reaches no network, git, or credential port.
T-115-07-A, B, and D are discharged by the evidence above: the absorbed behaviors were
present in the owner one commit before the supplemental was deleted; each production removal
carries the caller trace in this document plus a planted proof; and the relocation kept its
history through `git mv` with assertions unchanged.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — FOUND
- `tests/orchestrators/reconcile/notify.test.ts` — FOUND
- `tests/integration/reconcile-plan-convergence.test.ts` — FOUND
- `tests/orchestrators/reconcile/notify-projection-edge.test.ts` — ABSENT, as intended
- Commit `98c66eeb` — FOUND in `git log`
- Commit `9e37915b` — FOUND in `git log`
- Commit `18ef201f` — FOUND in `git log`
