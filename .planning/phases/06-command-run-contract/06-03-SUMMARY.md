---
phase: 06-command-run-contract
plan: "03"
subsystem: api
tags: [notifications, command-lifecycle, json, rpc, recovery]
requires:
  - phase: 06-command-run-contract
    provides: "06-01 explicit origins and snapshots; 06-02 production command boundary and safe internal-error delivery"
provides:
  - Exhaustive command outcome classification and monotonic reload accounting
  - Missing-outcome finalization and suppression of notifications after settlement
  - One direct recovery per ordinary append failure, reopening on success
  - Registered-root evidence for empty results, startup faults, overlap, and recovery
affects: [06-04, command-output, notification-dispatch]
actuals:
  tokens: 19839
  tasks: 3
  commits: 3
commits: 3
plan_head_before: b44f6ad91780d051ca76a5e94d13f7599c99ab95
plan_head_after: 0a26ee89acb4f577471d1b70bf2a33400ba61dd4
tech-stack:
  added: []
  patterns:
    - Command-owned mutable completion state allocated before identity and inventory
    - Synchronous bounded transport recovery inside the existing dispatcher
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-run.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/edge/command-run.ts
    - tests/shared/notification-run.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-run-seeds.ts
    - tests/edge/command-run.test.ts
    - tests/edge/register.test.ts
    - tests/orchestrators/plugin/list-flow.test.ts
    - tests/index.test.ts
key-decisions:
  - Successful recovery counts as an outcome and reopens delivery; only failed recovery closes it before settlement.
  - Live unsupported or throwing mode reads remain explicit host-contract failures.
  - The original run constructor port carries the preallocated state through setup.
patterns-established:
  - Classify resolved presentation kinds before formatting and count only successful command machine appends.
  - Set recovering before direct recovery and settled after final delivery; guard later calls before mode or sink access.
requirements-completed: ["JOUT-03", "JOUT-04", "WIRE-07"]
coverage:
  - id: D1
    description: Explicit outcomes, monotonic reload, and final command settlement
    requirement: JOUT-03
    verification:
      - kind: unit
        ref: node --test tests/shared/notification-run.test.ts tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#all nineteen presentation classifications
        status: pass
    human_judgment: false
  - id: D2
    description: Bounded append recovery preserves business work and later output
    requirement: JOUT-04
    verification:
      - kind: unit
        ref: node --test tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts tests/orchestrators/plugin/list-flow.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Registered commands retain origin through finalization, overlap, and recovery
    requirement: WIRE-07
    verification:
      - kind: unit
        ref: node --test tests/edge/register.test.ts tests/edge/command-run.test.ts tests/shared/notification-dispatch.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Existing text output and the catalog remain unchanged
    verification:
      - kind: other
        ref: TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check, with strict file-backed 3149-present and zero-extra assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 37m03s
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 3: Command Run Contract Summary

**Commands now finalize with explicit outcomes and accumulated reload truth, recover each append failure once, and suppress notifications after settlement.**

## Performance

- Started: 2026-10-09T20:05:37Z.
- Final verification completed: 2026-10-09T20:42:40Z.
- Tasks: 3 of 3; implementation files: 10, plus this summary.
- Actual tokens: 79,353 realized task-diff characters divided by four, rounded up to 19,839.
- Commits: three measured from the persisted plan ledger before this summary commit. Both exact range boundaries appear above.
- Runtime: Node v26.11.0.

## Accomplishments

- Each command owns only `hasOutcome`, `needsReload`, `settled`, and `delivery`. State exists before ID allocation and inventory construction; the same object enters the completed run or setup-error delivery. Lifecycle runs carry no completion state, and shared seeds allocate fresh objects.
- The dispatcher exhaustively classifies all 19 presentation kinds. Twelve outcome kinds count only after successful machine append; seven prompt, diagnostic, or lifecycle kinds do not. Reload is OR-reduced before attempted emission. Text output never satisfies a machine outcome.
- A normally returning JSON/RPC command without an outcome emits the existing internal-error kind with cause `Command returned without an outcome.` Finalization then settles the run. Retained callbacks cannot read mode, touch the sink, or access UI after settlement.
- Append failures remain inside dispatch. Each ordinary failure permits one direct recovery on the original receiver. Recovery success returns delivery to open, allowing later outcomes and later independent faults; recovery failure closes delivery and contains even a throwing debug logger.
- Registered-root JSON/RPC tests prove valid empty list/update/pending/prune results, help, prompt-only and diagnostic-only errors, silent update/import errors, overlapping deferred imports, typed marketplace-info failures, startup faults, and later reload-bearing output after recovery.
- All 3,149 text corpus entries remain present with zero extras. The catalog matches `26cb0056`; no baseline was recaptured.

## Task Commits

1. **Complete silent commands with correlated missing-outcome errors:** `c28ea1095207aa74f491202fb59390ab0946a49c` - `feat: finalize commands with explicit outcomes and reload state`.
2. **Contain append failures before broad handler catches:** `b670b7443bd0d305395afe34c5b34603af7f73d3` - `fix: contain command append failures with bounded recovery`.
3. **Prove root finalization, startup faults, and valid empty commands:** `0a26ee89acb4f577471d1b70bf2a33400ba61dd4` - `test: verify registered command completion and sink recovery`.

Every task passed local `fallow audit --base HEAD`, clean `SKIP=npm-check pre-commit run --files ...`, and normal commit hooks including `npm run check:commit`. The hooks required 100% direct line, function, and branch coverage for staged pairs; task 1 checked all pairs because it changed shared test support. No commit deleted tracked files. No hooks were bypassed and no history was rewritten.

## Verification

| Check | Exact command | Result and revision |
| --- | --- | --- |
| Task 1 post-commit tracer | `node --test tests/shared/notification-run.test.ts tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts` | Exit 0; 338 tests, zero skips, 2.88 seconds; `c28ea1095207aa74f491202fb59390ab0946a49c` |
| Task 2 owner check | `node --test tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts tests/orchestrators/plugin/list-flow.test.ts` | Exit 0; 431 tests, zero skips, 3.93 seconds; task 2 inputs, then passing checked commit `b670b7443bd0d305395afe34c5b34603af7f73d3` |
| Task 3 final owner check | `node --test tests/edge/register.test.ts tests/edge/command-run.test.ts tests/shared/notification-dispatch.test.ts` | Exit 0; 589 tests, zero skips, 5.34 seconds; `0a26ee89acb4f577471d1b70bf2a33400ba61dd4` |
| Text corpus | `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check` | Exit 0; 9,342 tests, 9,341 passing, zero failures, one inherited skip, 144.59 seconds; final task head |
| Catalog | `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0; unchanged |
| Final review orientation | `fallow review --base b44f6ad91780d051ca76a5e94d13f7599c99ab95 --brief` | Zero dead-code, complexity, or duplication issues |

The unchanged corpus report was read from `/tmp/06-03-corpus.log`. Separate assertions required no lines beginning `missing in ` or `extra in ` and the exact line `Notify corpus check passed: 3149 baseline entries present, 0 extra.` Both passed. The corpus ran alone after the large hooks finished. No skipped test was introduced.

Fallow identified the expected high-fan-in notification contracts for review. Existing caller signatures remain usable; registration still supplies the production constructor, which accepts the additional state argument. Strict type checking, all-pair task 1 coverage, direct final owners, and the corpus exercise these consumers. Its cache-entrypoint warning concerns the pre-existing generated TypeScript cache, not a changed product entry point.

The parent owns combined-wave `npm run check`. The owner checks, corpus, and passing hooks here do not claim to replace that gate.

## Fault-Path Evidence

The tests compare complete independently expected attempt objects, including schema version, custom type, original command ID, invocation ID, severity, reload, and cause. In the compact arrays below, `U(text)` means usage-info and `E(text)` means internal-error with that single cause; a failed attempt is retained in the array even though it was not delivered.

| Fault path | Ordered attempt array | Result |
| --- | --- | --- |
| First append fails | `[U(First.), E(Append 1 failed.), U(Second.), U(Third.)]` | Recovery succeeds; outcome true, delivery open |
| Failure after prior success | `[U(First.), U(Second.), E(Append 2 failed.), U(Third.)]` | Earlier success retained; delivery open |
| Separate ordinary failures | `[U(First.), E(Append 1 failed.), U(Second.), E(Append 3 failed.), U(Third.)]` | Each failure gets one recovery; later output remains open |
| Ordinary append and recovery fail | `[U(First.), E(Append 1 failed.)]` | Outcome false, delivery closed; no later attempts |
| Ordinary internal-error fails | `[E(Operation failed.), E(Append 1 failed.)]` | Open/outcome true if recovery succeeds; closed/outcome false if it fails |
| Reload-bearing attempted outcome fails | `[prune-committed-warning(reload=true), E(Append 1 failed., reload=true)]` | Recovery retains reload known before the failed attempt |
| Registered recovery followed by work and throw | `[U(Before.), E(Append failed.), prune-committed-warning(Saved., reload=true), E(Later failure., reload=true)]` | Both later entries delivered; command settles |
| Same registered flow with failed recovery | `[U(Before.), E(Append failed.)]` | Later warning and throw cause no append; command fulfills and settles |
| Allocator failure plus failed recovery | `[E(ID failed.), E(Append failed.)]` | Both use recovery-a; no inventory or handler call; no root retry |
| Escaping construction failure plus failed recovery | `[E(Inventory failed.), E(Append failed.)]` | Same preallocated state ends closed and settled; no handler call |
| Missing outcome plus failed recovery | `[E(Command returned without an outcome.), E(Append failed.)]` | Two attempts total; command fulfills and settles |
| Real empty list with first append failure | `[empty cascade, E(Append failed.)]` | No synthetic business-failure cascade |

- Recovery enters `recovering` before the direct attempt; a reentrant notification during recovery is suppressed. The delivered recovery then sets outcome true and restores open delivery.
- Debug-disabled, debug-enabled, and throwing-console cases all retain terminal closed delivery. Load/hook sink exceptions still propagate to their existing root containment; they never manufacture command errors.
- A controlled broad-catch callback writes committed local state before output. Its event log remains `[execute, committed]`, with no rollback or retry, and the saved bytes remain unchanged after the append failure.
- Both registered recovery flows compare the attempt array immediately after awaiting the callback and again after invoking a retained notifier with an unusable mode. No entry is added.
- Two silent deferred imports finish in reverse order while hook/load outcomes interleave. The final command errors retain run-b then run-a; lifecycle entries satisfy neither command. Both retained callbacks are suppressed afterward.
- Marketplace info with one healthy scope emits its successful block before the failed-scope plugin-info result. Two corrupt scopes emit only two typed failed results, without an empty success cascade or an extra internal-error.

## Startup and Host Contracts

The construction test uses the existing injected `openRun` port to expose an escaping inventory read. Production `softDepStatus` probes still catch individual inventory errors and degrade companion availability; this test does not claim those caught errors escape the production factory. No synthetic healthy snapshot is fabricated for setup failure.

Unsupported or stale mode preflight remains synchronous `assert.throws`, before identity allocation, inventory, or handler work. A mode that becomes invalid or throws after preflight remains a distinguishable host-contract failure at live finalization, rather than silently using a cached mode. Existing original-value text exceptions and text argument tuples remain intact.

## Accepted D-08 Delivery Limit

If both the ordinary append and its one direct recovery fail, no delivered outcome is guaranteed. Delivery closes, later emissions are suppressed, and the command fulfills after its existing work. This is bounded best effort on the original sink, not a retry, abort, replay, or rollback policy. Successful recovery does not close output; each later ordinary fault receives its own single recovery attempt.

## TDD Evidence

- Task 1's silent-command assertion failed because it received no internal-error. Actual TAP evidence passed `RED_EVIDENCE_OK`; the target failed on the planned payload assertion. Local record: `tmp/06-03-01-red.json`.
- Task 2's first-fault assertion failed because the transport exception escaped into the caller's catch. Actual TAP evidence passed `RED_EVIDENCE_OK` before implementation. Local record: `tmp/06-03-02-red.json`.
- Task 3 is root evidence for behavior implemented by tasks 1 and 2. A temporary negative-control mutation disabled the missing-outcome branch. The registered silent JSON update then failed on its complete expected entry array. `RED_EVIDENCE_OK` passed; the mutation was restored exactly before verification and was never committed. Local record: `tmp/06-03-03-red.json`.
- These records are ignored local evidence. Passing source and tests were committed together under the explicit project override; no failing RED commit or unnecessary refactor commit was made.

## Decisions Made

Followed the reviewed state contract. The exhaustive kind switch and shared delivery literals preserve the existing dispatcher architecture gate without weakening its prohibition on product prose. Normal root completion reads live mode; it does not count output by entry count, severity, rendered strings, or nonempty rows.

## Deviations from Plan

**1. [Rule 3 - Blocking] Adjust strict root mode-read fixtures with the first implementation commit.** Finalization adds one non-output mode read. Existing registration text fixtures and the extension-root invocation fixture therefore needed their exact read expectations increased to retain passing atomic commits. The registration adjustment moved forward from task 3; `tests/index.test.ts` is one additional file beyond the nine-file manifest, with a single expectation change from two reads to three. Emitted text and arguments are unchanged. Verified by root/index owner tests, all-pair task 1 hooks, and the strict corpus. Commit: `c28ea1095207aa74f491202fb59390ab0946a49c`.

Total deviations: one blocking test-fixture adjustment. The resulting ten-file scope adds no production feature, module, dependency, persistence change, or registration API.

## Issues Encountered

- Hooks identified import/statement formatting and the dispatcher's literal restrictions; the implementation follows the existing exhaustive-switch style. Task 3's invalid-mode fixture initially used a retired vocabulary token; changing only that fixture preserved the architecture guard. Every successful commit reran normal hooks.
- Required Git metadata, existing pre-commit caches, and child-process verification used the permitted escalated environment. Sandbox child-process failures were not accepted as behavioral evidence. Git LFS used a temporary local storage override for repository inspection.
- The pre-existing untracked `.codex/gsd-core` runtime symlink remains untouched. No package was installed.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced. Exhaustive classifications and real-root cases mitigate T-06-07; reload and committed-state assertions address T-06-08; bounded nonrecursive recovery and contained logging address T-06-09; the real list catch and transaction witness address T-06-10; settlement and retained-callback tests address T-06-11. Dependencies and lockfiles remain unchanged for T-06-SC.

## Unresolved Prohibitions

Carry forward the prior summaries' **flagged-unverified** prohibitions for the parent/verifier: invocation correlation must not become persistent tracking or telemetry, and an internal error or delivery failure must not imply that completed changes were rolled back. Passing behavior tests do not silently verify these descriptor-less prohibitions.

## Known Stubs

None. The realized diff introduces no TODO, FIXME, placeholder, skipped test, or unwired module. Empty arrays are exercised contract values or test fixtures.

## User Setup Required

None.

## Next Phase Readiness

Ready for 06-04 after the parent merges this worktree and passes its combined-wave gate. Delayed auth/cascade carrier evidence and AUTH-09 internal-error inventory enrollment remain in 06-04.

STATE.md, state.json, ROADMAP.md, config.json, REQUIREMENTS.md, and parent checkout files were not modified. The parent remains the sole owner of shared progress records.

## Self-Check: PASSED

The parent merged this plan as `b44becd2` and ran `npm run check` on the
clean combined tree with Node `v26.11.0`. It passed with exit 0, including
integration tests and direct coverage for all 266 source/test pairs.
The schema-drift gate passed; codebase-map drift remains an advisory to use
live source. GSD reported the documented `tests/index.test.ts` fixture change
as an advisory scope addition during merge.

All ten implementation files exist. All three exact task SHAs are ancestors of HEAD. The persisted ledger measures three task commits and the exact boundaries recorded above. The working tree and index were clean except for the pre-existing runtime symlink before summary creation. Catalog and protected planning-file comparisons passed; no temporary negative-control mutation remains.
