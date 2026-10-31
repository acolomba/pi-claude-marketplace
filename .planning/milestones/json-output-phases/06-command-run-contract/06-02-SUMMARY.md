---
phase: 06-command-run-contract
plan: "02"
subsystem: cli
tags: [typescript, notifications, json, rpc, errors, redaction]
requires:
  - phase: "06-01"
    provides: Explicit origin, canonical routes, original sinks, and injectable command IDs
provides:
  - Correlated machine error delivery for escaped handler and construction failures
  - Bounded resolved command errors with credential and path masking
  - Strict command-only internal-error schema member
  - Direct disclosure controls and preservation of earlier output and committed work
affects: [06-03, 06-04]
actuals:
  tokens: 13903
  tasks: 2
  commits: 2
commits: 2
plan_head_before: f80bcc8e897a2c70000bff507112d7d88e32874d
plan_head_after: bdad631968ddf629a6cc8bec122a3655581ff427
tech-stack:
  added: []
  patterns:
    - Keep setup synchronous and await only selected command work
    - Resolve machine-only errors without a soft-dependency snapshot
key-files:
  created:
    - extensions/pi-claude-marketplace/edge/command-run.ts
    - extensions/pi-claude-marketplace/shared/notification-command-error.ts
    - tests/edge/command-run.test.ts
    - tests/shared/notification-command-error.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - tests/edge/register.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-json.test.ts
    - tests/shared/notification-wire.test.ts
    - tests/architecture/wire-schema.test.ts
    - schema/claude-plugin.schema.json
key-decisions:
  - Inject the run constructor into the boundary and compose it with openNotificationRun in registration.
  - Preserve existing soft-dependency probe degradation; report failures escaping construction.
  - Mask single-slash file URLs as well as file URLs with an authority delimiter.
patterns-established:
  - Original-value text exceptions and machine delivery share the live-mode dispatcher boundary.
requirements-completed: ["JOUT-04", "WIRE-02", "WIRE-07"]
coverage:
  - id: D1
    description: Correlated registered command failures and explicit startup-failure handling
    requirement: JOUT-04
    verification:
      - kind: unit
        ref: tests/edge/register.test.ts
        status: pass
      - kind: unit
        ref: tests/edge/command-run.test.ts
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Strict command-only internal-error projection and generated schema
    requirement: WIRE-02
    verification:
      - kind: unit
        ref: tests/shared/notification-wire.test.ts
        status: pass
      - kind: unit
        ref: tests/shared/notification-json.test.ts
        status: pass
      - kind: other
        ref: tests/architecture/wire-schema.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Safe hostile causes and preservation of committed state and earlier output
    requirement: JOUT-04
    verification:
      - kind: unit
        ref: tests/shared/notification-command-error.test.ts
        status: pass
      - kind: unit
        ref: tests/shared/notification-json.test.ts#the command payload disclosure check rejects planted credentials
        status: pass
      - kind: unit
        ref: tests/edge/command-run.test.ts#retains committed local state and earlier output after a command throws
        status: pass
    human_judgment: false
  - id: D4
    description: Exact text corpus and catalog preservation
    verification:
      - kind: other
        ref: TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check plus strict 3149-present and zero-extra assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 27m13s
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 2: Command Run Contract Summary

**Escaped command failures append a correlated, redacted internal-error in JSON/RPC while text retains the original thrown value and synchronous setup timing.**

## Performance

- Worktree dispatch: 2026-10-09T19:29:01Z, from the branch creation reflog.
- Final verification completed: 2026-10-09T19:56:14Z.
- Tasks: 2 of 2; implementation files: 14, plus this summary.
- Actual tokens: 55,612 realized task-diff characters divided by four = 13,903.
- Commits: measured from the persisted plan ledger before this summary commit; exact boundaries appear above.
- Runtime: Node v26.11.0.

## Accomplishments

- Registration retains synchronous mode preflight and canonical selection, then invokes the new production-used command boundary. It allocates identity once before construction and awaits the selected route once.
- The real registered update callback captures complete JSON/RPC errors before output and after two equal earlier entries. Error delivery retains the original sink receiver and command origin, and precedes fulfillment.
- The resolver reuses the existing depth-five serializer, cycle semantics, and credential masking. Nullish throws have a fixed nonempty cause. Hostile message, cause, or string-tag accessors have a fixed safe fallback without recursively serializing their secondary error.
- The converter projects plain fields only. The generated union has 19 members; internal-error requires command origin, error severity, reload, summary, and cause. Load/hook origins and missing fields are rejected, and the missing-kind schema negative control remains intact.
- Whole-payload disclosure controls reject planted credentials, paths, file URLs, bare UNC roots, live errors, stack fields, non-JSON members, and nonfinite numbers. A temporary-store test proves that a later failure retains committed bytes and earlier output.
- All 3,149 text corpus entries remain present with zero extras. The output catalog matches baseline `26cb0056`; no recapture occurred.

## Task Commits

1. **Run a throwing registered command through resolved internal-error delivery:** `593f688237251c2411d818fdc2dab584bec06248` — `feat: report correlated unexpected command failures`.
2. **Prove resolver disclosure and partial-work semantics in direct owners:** `bdad631968ddf629a6cc8bec122a3655581ff427` — `test: verify command failure disclosure and partial work`.

Both commits passed local Fallow audit, clean `SKIP=npm-check pre-commit run --files ...`, and normal commit hooks including `npm run check:commit`. The hooks required 100% direct line, function, and branch coverage for the staged source/test pairs. No hooks were bypassed, no history was rewritten, and neither task deleted tracked files.

## Verification

All final commands passed with exit 0 on `bdad631968ddf629a6cc8bec122a3655581ff427`:

```bash
node --test tests/shared/notification-command-error.test.ts tests/edge/command-run.test.ts tests/shared/notification-json.test.ts
node --test tests/edge/command-run.test.ts tests/edge/register.test.ts tests/shared/notification-command-error.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-json.test.ts tests/shared/notification-wire.test.ts tests/architecture/wire-schema.test.ts
TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check
git diff --exit-code 26cb0056 -- docs/output-catalog.md
```

- Task 2 owner command: 153 tests passed, zero skips, 2.32 seconds.
- Full owner command: 666 tests passed, zero skips, 5.17 seconds.
- Task 1 post-commit tracer: 616 tests passed, zero skips, 4.74 seconds, before task 2 began.
- Corpus producer: 9,252 tests, 9,251 passing, zero failures, one inherited skip, 145.07 seconds. No skipped test was introduced.
- Strict file-backed corpus assertions independently required no `missing in ` or `extra in ` lines and the exact line `Notify corpus check passed: 3149 baseline entries present, 0 extra.` Both passed. The report was read unchanged; no pipeline or assertion was weakened.
- Fallow review of the final diff reported zero dead-code, complexity, or duplication issues. Its advisory suppression signals are the two deliberate non-Error rejection fixtures and the converter's negative type-contract test.

The parent owns combined-wave `npm run check`. These owner checks and commit hooks are not presented as that combined-tree gate. The corpus ran after the large commit hooks finished.

## Startup and Exception Evidence

- Primary allocator failure: the real registered update callback uses the injected recovery allocator once, emits the primary failure with the recovery ID, and makes no inventory or handler call. The boundary's ordered log independently proves primary then recovery allocation.
- Escaping construction failure: the direct boundary test injects a constructor that reads the supplied inventory and throws. It reports one error with the already allocated ID, reads inventory once, and never calls the handler. The original Pi sink is passed separately to error delivery; no healthy snapshot is fabricated and no second probe is attempted.
- Existing production `softDepStatus` probes catch individual `getAllTools` failures and degrade companions to unloaded. This behavior remains unchanged. The construction-fault witness is an injected escaping constructor failure, not a claim that the existing factory propagates those caught probe failures.
- Text setup failures: `assert.throws` proves original Error identity and synchronous timing for both primary allocation and construction in TUI/print. No recovery allocation, UI access, or machine entry occurs.
- Text handler failures: rejected Error, null, undefined, string, and object values retain identity. JSON/RPC delivers schema-valid resolved errors for the same non-Error cases.
- Live mode is read at failure delivery. Supported text-to-machine and machine-to-text changes follow the current mode. An unsupported mode rejects with `UnsupportedModeError`; a stale getter preserves its original failure. Neither is counted as delivered output or successful command completion.
- A broken trusted recovery allocator surfaces its original synchronous failure with no delivery. It remains a contract/invariant failure, not an additional successful-delivery exception.

## TDD Evidence

- Task 1: the registered JSON update executes and rejects where the completion assertion requires fulfillment after error delivery. The actual TAP evidence passed `RED_EVIDENCE_OK`; semantic inspection confirmed the planned missing boundary. Evidence: `tmp/06-02-01-red.json`.
- Task 2: the resolver exposed `file:/private/work/config.json` instead of `[path]`. Nineteen cases passed and this target failed on the complete presentation assertion. The actual TAP evidence passed `RED_EVIDENCE_OK`; the one-line resolver correction made it green. Evidence: `tmp/06-02-02-red.json`.
- Both evidence records are local ignored artifacts. Passing source and tests were committed together under the explicit project override; no failing RED commit or unnecessary refactor commit was made.

## Decisions Made

The command boundary receives the run constructor as an explicit port. Registration composes that port with the existing `openNotificationRun`. This preserves production inventory behavior and lets direct tests exercise an escaping construction failure without module replacement or a test-only export.

## Deviations from Plan

**1. [Rule 2 - Testability] Make construction an explicit collaborator.** Source inspection and the first startup tests showed that the existing soft-dependency probes consume inventory exceptions. The command boundary therefore receives its constructor from registration. Direct fault tests use that public port while ordinary production uses the existing factory. Files: `edge/command-run.ts`, `edge/register.ts`, and the boundary pair. Verified by the construction, original-sink, and text-timing cases; committed in `593f688237251c2411d818fdc2dab584bec06248`.

**2. [Rule 1 - Bug] Mask single-slash file URLs.** Task 2's new fixture proved the initial new resolver's file-URL mask was too narrow. Expanded only this machine-error mask from the authority-delimiter spelling to one or more slashes. The full payload disclosure test also covers the corrected form. Files: `shared/notification-command-error.ts` and the direct resolver/converter pairs; committed in `bdad631968ddf629a6cc8bec122a3655581ff427`.

The retained 14-file manifest remains the reviewed connected error-delivery change. No 06-01 size exception was reused, and no package, subsystem, persisted-state format, or public text surface was added.

## Issues Encountered

- The initial Git status required permission for Git LFS's shared cache. Test child processes required the permitted harness environment; sandbox-only attempts produced file-level failures and were not accepted as behavioral evidence.
- The initial assertion report exposed malformed Node TAP diagnostics for `doesNotReject`. An equivalent explicit completion assertion produced a valid unmodified TAP report accepted by the classifier.
- Task 1 hooks first found ten lint errors, then two architecture-gate violations. Import/statement fixes, the dispatcher's existing switch style, and a non-retired invalid-mode fixture resolved them. Task 2 needed two narrowly documented lint exceptions to exercise required non-Error rejections. Every successful commit reran normal hooks.
- The pre-existing untracked `.codex/gsd-core` runtime symlink remains untouched. No package was installed.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced. Resolver and whole-payload controls address T-06-04; bounded cyclic/hostile traversal addresses T-06-05; deterministic startup-fault and original-sink cases address T-06-06 within the construction contract described above. Unchanged dependencies preserve T-06-SC.

## Unresolved Prohibition

**flagged-unverified:** MUST NOT present an internal error or delivery failure as proof that completed changes were rolled back.

The temporary-store and complete-payload tests support review but do not silently verify this descriptor-less transparency prohibition. The parent/verifier must retain and surface this flag.

## Known Stubs

None. The realized diff introduces no TODO, FIXME, placeholder, skipped test, or unwired production module.

## User Setup Required

None.

## Next Phase Readiness

Ready for 06-03 after the parent merges this worktree and passes the combined-wave gate. Outcome accounting, monotonic reload accumulation, missing-result finalization, settled-run guards, and D-08 append recovery remain in 06-03. The dispatcher accepts resolved reload truth now; this boundary supplies false until that accounting lands. AUTH-09 internal-error architecture enrollment remains in 06-04.

STATE.md, state.json, ROADMAP.md, config.json, REQUIREMENTS.md, and the parent checkout were not modified.

## Combined-wave verification

The parent merged this plan as `7dfa8f08` and ran `npm run check` on the
clean combined tree with Node `v26.11.0`. It passed with exit 0, including
integration tests and direct coverage for all 266 source/test pairs.
The daemon restart interrupted the execution transport after task verification;
artifact reconciliation confirmed both task commits and summary `fe58974b`.
No implementation work was repeated during recovery.

## Self-Check: PASSED

The summary, all four new source/test files, and the generated schema exist. Both exact task commits are ancestors of HEAD. The final verified source/test/schema inputs and protected planning files remain unchanged. The persisted ledger measures two task commits before the summary commit.
