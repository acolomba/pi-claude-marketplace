---
phase: 06-command-run-contract
plan: "01"
subsystem: cli
tags: [typescript, notifications, json, rpc, correlation]
requires:
  - phase: "05"
    provides: Live notification sinks and strict machine payload schemas
provides:
  - Required command, load, and hook origin on every notification payload
  - Canonical route identity and injectable per-command invocation IDs
  - Snapshot-only tool presentation with unchanged marketplace details
  - Deterministic alias, delegation, overlap, and lifecycle attribution tests
affects: [06-02, 06-03, 06-04]
actuals:
  tokens: 38198
  tasks: 2
  commits: 2
commits: 2
plan_head_before: e7802fef27f79cf4f3de8369787542e345f8fdab
plan_head_after: 885418551e9607150e2f575d5ea8a339d30c1468
tech-stack:
  added: []
  patterns:
    - Select canonical identity and executable route together
    - Carry explicit root metadata through the original notification sink
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-run.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - schema/claude-plugin.schema.json
    - tests/shared/notification-run-seeds.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts
key-decisions:
  - Keep the existing routeClaudePlugin entrypoint able to execute a selected route.
  - Project marketplace blocks directly for tools without inventing a tool origin.
patterns-established:
  - Each root owns its origin; no mutable global command identity is used.
requirements-completed: ["WIRE-02", "WIRE-07"]
coverage:
  - id: D1
    description: Strict explicit origin on every raw and structured notification
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
  - id: D2
    description: Canonical routes and independent invocation correlation
    requirement: WIRE-07
    verification:
      - kind: unit
        ref: tests/edge/router.test.ts
        status: pass
      - kind: unit
        ref: tests/edge/register.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Independent lifecycle roots and unchanged tool details
    verification:
      - kind: unit
        ref: tests/index.test.ts
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/settle.test.ts
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/async-rewake/registry.test.ts
        status: pass
      - kind: unit
        ref: tests/edge/handlers/tools.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: Exact text corpus and catalog preservation
    verification:
      - kind: other
        ref: Corpus producer and strict 3149-present, zero-extra assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 30m33s
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 1: Command Run Contract Summary

**Every machine notification now carries its command, load, or hook origin, with one canonical identity and invocation ID retained throughout each command.**

## Performance

- Worktree dispatch: 2026-10-09T18:45:35Z, from the branch creation reflog.
- Final verification completed: 2026-10-09T19:16:08Z.
- Tasks: 2 of 2.
- Implementation breadth: 57 files; task 2 changes two of those files. This summary is the additional documentation file.
- Actual tokens: ceiling of 152791 realized task-diff characters divided by four, not harness usage.
- Commits: measured from the persisted plan ledger before the summary commit; both exact boundaries are recorded above.
- Runtime: Node v26.11.0.

## Accomplishments

- Required strict origin objects on all 18 existing payload kinds, retaining schemaVersion 1 and existing payload ordering. The converter copies only allowed metadata fields.
- Selected canonical identity and dispatch together. Aliases, recognized invalid parents, bare browse, exact marketplace-help topics, and help usage errors have independent expected identities.
- Allocated one injectable ID after synchronous mode preflight, while preserving the original sink receiver and the three-read inventory snapshot.
- Kept real enable-to-install delegation attributed to `plugin enable`. Two deferred imports retain `run-a` and `run-b` through eight ordered entries, including equal adjacent payloads and independent load/hook roots.
- Preserved load, Stop-cap, and rewake failure containment. Tools retain their existing detail objects through snapshot-only presentation and direct marketplace-block projection.
- Preserved all 3149 text corpus entries with zero extras and the catalog at baseline `26cb0056`.

## Task Commits

1. **Required metadata, canonical routes, and explicit roots:** `81889b767426e78f1881eb41342469bb4ab4460a` - `feat: attribute notification output to canonical command runs`.
2. **Aliases, delegation, root separation, and equal-command correlation:** `885418551e9607150e2f575d5ea8a339d30c1468` - `test: verify command identity and overlapping notification roots`.

Both commits passed the required Fallow audit, clean pre-commit fixer run, normal commit hooks, and `npm run check:commit`. The first commit changed shared test support, so its hook checked every source/test pair. The second checked the router and registration pairs. No hooks were skipped, and no commits were amended.

## Verification

The following commands passed with exit 0 on task head `885418551e9607150e2f575d5ea8a339d30c1468`:

```bash
node --test tests/shared/notification-run.test.ts tests/shared/notification-wire.test.ts tests/shared/notification-json.test.ts tests/shared/notification-present.test.ts tests/shared/notification-dispatch.test.ts tests/edge/router.test.ts tests/edge/register.test.ts tests/edge/handlers/tools.test.ts tests/architecture/wire-schema.test.ts
node --test tests/edge/router.test.ts tests/edge/register.test.ts tests/index.test.ts tests/bridges/hooks/settle.test.ts tests/bridges/hooks/async-rewake/registry.test.ts
TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check
git diff --exit-code 26cb0056 -- docs/output-catalog.md
```

Final owner-command durations were 8.85 seconds and 5.29 seconds. The tracer owner command also passed again after task 1, before task 2 began. Schema generation and the catalog/disclosure owner tests passed during task 1.

The final corpus run took 172.99 seconds: 9157 tests, 9156 passing, zero failures, and one inherited skip. No skipped test was introduced. The strict post-check asserted both that no `missing in ` or `extra in ` lines existed and that the exact final line was `Notify corpus check passed: 3149 baseline entries present, 0 extra.` Both assertions passed with exit 0. No corpus was recaptured.

The combined-wave `npm run check` belongs to the parent, as explicitly directed. Neither the commit hooks nor these owner checks are presented as that combined-tree gate.

## TDD Evidence

- Task 1: the registered JSON/RPC list tests failed locally on the expected missing command origin before implementation. The TAP rerun exposed the target assertions rather than only the runner's file-level failure.
- Task 2: the behavior already existed after task 1. A deliberate fixed-ID mutation made both overlap tests fail on `run-a` where `run-b` was required. The actual TAP report was accepted as `RED_EVIDENCE_OK`; the mutation was fully restored, and the owner command passed. The local evidence record is `tmp/06-01-02-red.json`.
- Passing tests and implementation were committed together under the project's explicit override. No failing RED commit was made; no separate refactor commit was needed.

## Decisions Made

The existing router entrypoint accepts either command text or an already selected route. Registration uses the selected route, avoiding a second parse and an unused execution export. Tools use `toWireMarketplaces` rather than constructing an envelope whose origin they do not own.

## Deviations from Plan

No product scope changed. The approved 61-file manifest required 57 actual edits. Four existing files already fulfilled their contracts unchanged: `tests/shared/notification-present.test.ts`, `tests/edge/handlers/tools.test.ts`, `tests/edge/notification-boundary.ts`, and `tests/bridges/hooks/event-router.test.ts`. Their checks remained included.

The strict corpus verification used a file-backed report instead of piping into `fs.readFileSync(0)`: the pipeline's assertion process aborted with a native buffer overflow in this runtime. The corpus producer's exit status and the exact original assertions were checked separately; neither assertion was weakened.

## Issues Encountered

The first task's initial commit attempt exposed four lint errors, which were fixed before its successful commit. The second task's initial attempt exposed an unsupported `Promise.withResolvers` type and associated lint errors; ordinary deferred promises resolved them. Fallow also identified an unused proposed router wrapper during implementation; retaining the live entrypoint removed that issue. All final audits and hooks passed.

No packages were installed. The pre-existing `.codex/gsd-core` workflow symlink was left untouched. No tracked files were deleted.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced. Canonical route tests address T-06-01, independent roots and overlap tests address T-06-02, strict schema and projection tests address T-06-03, and unchanged dependencies preserve T-06-SC.

## Unresolved Prohibition

**flagged-unverified:** MUST NOT turn invocation correlation into persistent user or cross-command tracking or telemetry.

This descriptor-less privacy prohibition remains unresolved for the parent/verifier. Passing behavior tests do not silently verify it.

## Known Stubs

None. The changed files contain no new TODO, FIXME, placeholder, or unwired implementation. Empty collections are exercised contract values and test fixtures.

## User Setup Required

None.

## Next Phase Readiness

Ready for 06-02 after the parent merges this worktree and passes the combined-wave gate. Command error delivery, outcome accounting, and lifetime closure remain assigned to later plans. STATE.md, state.json, ROADMAP.md, config.json, and shared requirement records were not modified.

## Combined-wave verification

The parent merged this plan as `9b1abc7a` and ran `npm run check` on the
clean combined tree with Node `v26.11.0`. It passed with exit 0, including
integration tests and direct coverage for all 264 source/test pairs.
The first sandboxed attempt failed because the FIFO harness could not spawn
`mkfifo` (`EPERM`); the permitted full rerun passed without code changes.
The schema-drift gate passed. The codebase-map drift gate reported a
non-blocking stale-map advisory; later work must use live source.

## Self-Check: PASSED

Both exact task commits exist on this branch and are ancestors of HEAD. The key implementation files and generated schema exist. The final task tree is committed, task verification passes, and the protected planning files and catalog are unchanged.
