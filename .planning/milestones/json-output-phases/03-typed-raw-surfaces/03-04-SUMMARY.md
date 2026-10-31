---
phase: 03-typed-raw-surfaces
plan: "04"
subsystem: architecture-gates
tags: [architecture-gate, auth-09, d-16, presentation-sink, planted-controls, phase-gate]

requires:
  - phase: 03-typed-raw-surfaces
    provides: "03-03: scanDeviceCodeCalls and scanPromptBindings (AUTH-09 retargeted); the private deliver sink with exactly two notify spellings"
provides:
  - "assertPlantedCopyRejects in tests/architecture/temp-root-control.ts: the D-07-01 offender control as one call"
  - "Planted-violation controls for the AUTH-09 device-code prompt scans (D-11), through the file-local scanDeviceCodePrompt"
  - "PRESENTATION_SINK_TARGETS in tests/architecture/gate-targets.ts"
  - "tests/architecture/presentation-sink.test.ts: the D-16 / SC-5 sink gate with pattern and placement clauses and planted controls"
affects: [04-wire-schema, 05-mode-sink, 06-origin, 07-docs]

estimate:
  tokens: 75000
  tasks: 2
actuals:
  tokens: 3700
  tasks: 2
  commits: 2
plan_head_before: c06494f8dfc833ab0fe87222b45d9e0821937e40
plan_head_after: 796bf8220a05eafea29965bdf9d4857ee808daf2

tech-stack:
  added: []
  patterns:
    - "An offender control is one assertPlantedCopyRejects call per data row, so two gates do not repeat the temp-root sequence"
    - "A pattern clause judges call forms; a separate placement clause pins where the sanctioned spelling may appear, and each clause has its own offender"

key-files:
  created:
    - tests/architecture/presentation-sink.test.ts
  modified:
    - tests/architecture/temp-root-control.ts
    - tests/architecture/no-credential-leak.test.ts
    - tests/architecture/gate-targets.ts

key-decisions:
  - "assertPlantedCopyRejects takes an inline readonly object type, not an exported interface, so the test-support module adds no exported type for fallow to report"
  - "The offender targets for the AUTH-09 controls are GITHUB_AUTH_FILE followed by PROVIDER_FILES, held in one file-local DEVICE_CODE_PROMPT_TARGETS constant"
  - "The phase-gate npm run check reuses the Task 2 pre-commit run: selector scope full, run on tree 7ad66dff, which is exactly the tree committed as 796bf822, PRECOMMIT_EXIT=0"

patterns-established:
  - "New architecture gates call assertPlantedCopyRejects for offender rows instead of writing withTempRoot / materializeTargets / plantOffender / assert.rejects inline"

requirements-completed: [RAWS-03, TEXT-01]

coverage:
  - id: D1
    description: "The AUTH-09 device-code prompt scans reject a token-valued userCode, a non-literal onDeviceCode argument, and a credential-carrying prompt binding; unmutated copies pass with every provider file opened; the offender inside a line comment passes (D-11)"
    requirement: RAWS-03
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / D-11: the device-code prompt gate rejects a token-valued userCode in the domain call"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / D-11: the device-code prompt gate rejects a non-literal onDeviceCode argument"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / D-11: the device-code prompt gate rejects a credential-carrying prompt in the provider binding"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / D-11: unmutated copies pass the device-code prompt gate and report every provider file opened"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / D-11: a token-valued onDeviceCode call inside a line comment passes, so the gate strips comments"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-16 sink gate rejects a composed notify, a pre-composed deliver tuple, and a third sanctioned-spelling notify outside deliver; the real module, an unmutated copy, and a commented-out notify pass with visited equal to the registry group"
    requirement: TEXT-01
    verification:
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: every notify argument in the dispatch module comes from the text strategy"
        status: pass
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: the presentation-sink gate rejects a direct notify with a composed template"
        status: pass
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: the presentation-sink gate rejects the sink handed a pre-composed tuple"
        status: pass
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: the presentation-sink gate rejects a third sanctioned-spelling notify outside the sink"
        status: pass
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: an unmutated copy of the dispatch module passes and reports it opened"
        status: pass
      - kind: unit
        ref: "tests/architecture/presentation-sink.test.ts#D-16 / SC-5: a composed notify inside a line comment passes, so the gate strips comments"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase gate: full check, corpus 3134 present and 0 extra, the D-17 ledger line, no catalog diff, the catalog contract, the D-03 caller diff, and the deleted-identifier grep all pass on the final committed tree"
    requirement: TEXT-01
    verification:
      - kind: other
        ref: "SKIP=trufflehog pre-commit run (selector scope full: npm run check + npm run test:coverage:direct:all) on tree 7ad66dff = commit 796bf822, PRECOMMIT_EXIT=0"
        status: pass
      - kind: other
        ref: "corpus wrapper over node scripts/notify-corpus.mjs check (Corpus: 3134 present, 0 extra)"
        status: pass
      - kind: other
        ref: "03-03 ledger command (Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- docs/output-catalog.md"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 1h 3m
completed: 2026-10-03
status: complete
---

# Phase 3 Plan 04: AUTH-09 Planted Controls and the D-16 Presentation-Sink Gate Summary

**The retargeted AUTH-09 device-code prompt scans now reject three planted leak forms in temp-root copies of the real files. A new D-16 gate holds every notify argument in `notification-dispatch.ts` to the text strategy's output: two pattern clauses judge the call forms, and a placement clause pins the two notify spellings inside `deliver`. Each clause is proven to fire alone. The phase gate is green on the final tree.**

## Performance

- **Duration:** about 1h 3m. Most of it was the two full-scope pre-commit runs.
- **Started:** 2026-10-03T01:23:46Z
- **Completed:** 2026-10-03T02:27:31Z
- **Tasks:** 2
- **Files modified:** 4 (2 in Task 1, 2 in Task 2)

## Accomplishments

- `assertPlantedCopyRejects(control)` in `temp-root-control.ts` runs `withTempRoot`, `materializeTargets`, `plantOffender`, and `assert.rejects` as one call. The module header describes it. Both new gates call it for their offender rows.
- `no-credential-leak.test.ts` gains `scanDeviceCodePrompt(root)`, which awaits `scanDeviceCodeCalls(root)` and returns `scanPromptBindings(root)`. It also gains a three-row offender loop, a benign case, and a near-miss case over `GITHUB_AUTH_FILE` plus `PROVIDER_FILES`. The real-tree cases and the existing scans are unchanged. Both scans already carried `AUTH-09` in their failure messages, so no message changed.
- `PRESENTATION_SINK_TARGETS` sits before `UNOWNED_EXPORT_CENSUS` in `gate-targets.ts`, holding the one full literal for the dispatch module.
- `presentation-sink.test.ts` declares the file-local `SINK_PATTERNS`, `describeSinkViolation`, `TEXT_STRATEGY_IMPORT`, `assertSinkPlacement`, and `scanPresentationSink`. It has six cases: the real tree, three offender rows, the benign case, and the near-miss case.

## Task Commits

1. **Task 1: Prove the retargeted AUTH-09 gate fires on planted leaks.** `96113a8e` (test)
2. **Task 2: Gate the presentation sink on text-strategy output.** `796bf822` (test)

## Control Results

| Gate | Case | Expected | Result |
| --- | --- | --- | --- |
| AUTH-09 | token-valued `userCode` in the domain call (`GITHUB_AUTH_FILE`) | reject `/AUTH-09/` | rejected |
| AUTH-09 | `opts.onDeviceCode(prompt);` (`GITHUB_AUTH_FILE`) | reject `/AUTH-09/` | rejected |
| AUTH-09 | credential-carrying `notifyDeviceFlowPrompt` call (`AUTH_HOST_FILE`) | reject `/AUTH-09/` | rejected |
| AUTH-09 | unmutated copies | pass, visited = `PROVIDER_FILES` | passed |
| AUTH-09 | token-valued call in a line comment | pass | passed |
| D-16 | direct notify with a composed template | reject `/D-16/` | rejected (pattern and placement clauses) |
| D-16 | `deliver(ctx, [\`pre-composed\`, "info"]);` | reject `/D-16/` | rejected (pattern clause) |
| D-16 | third `ctx.ui.notify(args[0], args[1])` outside `deliver` | reject `/D-16/` | rejected (placement clause only) |
| D-16 | real tree | pass, visited = group | passed |
| D-16 | unmutated copy | pass, visited = group, waived = [] | passed |
| D-16 | composed notify in a line comment | pass | passed |

Mutation checks, run on uncommitted copies and then restored and confirmed with `cmp`:

- `scanDeviceCodePrompt` replaced by `return PROVIDER_FILES`: all three AUTH-09 offender rows fail, and the benign and near-miss cases still pass.
- `assertSinkPlacement` removed from `scanPresentationSink`: only the third D-16 offender row fails.
- `SINK_PATTERNS` replaced by an empty list: only the pre-composed-tuple row fails.

## Verification Evidence

Task 1: focused task verification passed, and its pre-commit run had full scope.

- `node --test tests/architecture/no-credential-leak.test.ts`: 13 pass, 0 fail (8 real-tree cases, 3 offender rows, benign, near-miss).
- `node --test tests/architecture/gate-targets.test.ts`: 15 pass.
- `npx eslint` on both files: exit 0.
- `npx fallow dupes --fail-on-issues --format human`: exit 0. `npx fallow health --fail-on-issues`: exit 0.
- `fallow audit --gate-marker agent`: verdict `warn`, dead code 0, complexity 0. No clone group names a file this plan touched. The 17 clone groups are the branch-base attributions recorded in 03-01 through 03-03.
- Pre-commit: `SKIP=trufflehog pre-commit run --files` on both files, selector scope `full`, run on tree `f1f76ca4`, which is exactly the tree committed as `96113a8e`. `PRECOMMIT_EXIT=0`, Node v26.10.0. The staged diff was byte-identical before and after the run.

Task 2 and the phase gate:

- `node --test tests/architecture/presentation-sink.test.ts tests/architecture/gate-targets.test.ts tests/architecture/source-scan.test.ts`: 31 pass, 0 fail. The six sink cases all appear.
- `npm run test:architecture`: 493 pass, 0 fail. `npm run typecheck`: exit 0.
- `npx eslint` on both files: exit 0. `fallow dupes`: exit 0. `fallow health`: exit 0. `fallow audit`: verdict `warn` with nothing on this plan's files.
- `git grep -n -F '"extensions/pi-claude-marketplace/shared/notification-dispatch.ts"' -- tests/architecture/gate-targets.ts` prints lines 239 (`NO_CONSOLE_EXEMPT_TARGETS`) and 667 (`PRESENTATION_SINK_TARGETS`). `presentation-sink.test.ts` holds no `extensions/pi-claude-marketplace/` text.

Phase-gate commands, all run on the final committed tree `796bf822`:

1. **Full check:** reused under the `skills/local-verification` rule, not re-run. `npm run check:changed -- --list` reported `"scope": "full"` with `npm run check` and `npm run test:coverage:direct:all`. The Task 2 pre-commit ran them on tree `7ad66dff`, which is exactly the tree committed as `796bf822`, and logged `PRECOMMIT_EXIT=0` on Node v26.10.0. The staged diff was byte-identical before and after, and the working tree was clean after the commit. Logs are in the session scratchpad as `pc-0304-t1.log` and `pc-0304-t2.log`.
2. **Corpus wrapper:** `Corpus: 3134 present, 0 extra`, exit 0.
3. **D-17 ledger command:** `Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134`, exit 0.
4. **`git diff --exit-code 4e6c568a -- docs/output-catalog.md`:** exit 0, no output.
5. **`node --test tests/architecture/catalog-uat/catalog-contract.test.ts`:** 4 of 4 pass, so the 260-state and 39,143-byte pins hold.
6. **D-03 caller diff** (`git diff --exit-code 4e6c568a -- extensions/pi-claude-marketplace/edge …/orchestrators/import/execute.ts …/orchestrators/plugin/shared.ts …/orchestrators/reconcile/apply.ts …/bridges/hooks/async-rewake/registry.ts`): exit 0, no output.
7. **`! git grep -n -w -e makeRawNotifyFn -e NotifyFn -e notifyFn -- extensions tests`:** no output, exit 0.

## Files Created/Modified

- `tests/architecture/temp-root-control.ts`: `assertPlantedCopyRejects` and the header paragraph that describes it.
- `tests/architecture/no-credential-leak.test.ts`: the `temp-root-control.ts` import, `scanDeviceCodePrompt`, `DEVICE_CODE_PROMPT_TARGETS`, the offender loop, and the benign and near-miss cases.
- `tests/architecture/gate-targets.ts`: `PRESENTATION_SINK_TARGETS`.
- `tests/architecture/presentation-sink.test.ts`: the D-16 gate.

## Decisions Made

- `assertPlantedCopyRejects` takes an inline readonly object type. A named exported interface would be a test-support type with no importer.
- The full-check phase gate reuses the Task 2 pre-commit evidence, as the plan allows. Its scope was `full`, it ran on the exact committed tree, and it exited 0.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Every phase-3 plan has a SUMMARY. RAWS-01 through RAWS-05 and TEXT-01 hold on the final tree, and both new obligations have gates with proven controls.
- Phase complete, ready for verification and `phase.complete` by the orchestrator.
- `docs/output-catalog.md` near line 4088 still says the domain emits the prompt. Phase 7 criterion 6 carries that prose fix.

## Self-Check: PASSED

- Files: `03-04-SUMMARY.md`, `presentation-sink.test.ts`, and the three modified files exist.
- Commits: `96113a8e` and `796bf822` are in `git log --all`.
- Measured commits: `git rev-list --count c06494f8..796bf822` = 2.
