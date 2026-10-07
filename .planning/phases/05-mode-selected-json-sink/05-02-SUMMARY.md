---
phase: 05-mode-selected-json-sink
plan: "02"
subsystem: notifications
tags: [typescript, json, rpc, usage, command-routing]
requires:
  - phase: 05-01
    provides: Live transport selector, required entry sink, and retained JSON capture
provides:
  - Help and argument errors use the original command run for exclusive JSON/RPC entries
  - Ordered mixed raw and structured entries preserve repeated equal payloads
  - Existing text output and catalog remain unchanged
affects: [05-03, 05-04, 05-05, 05-06, 05-07]
actuals:
  tokens: 31860
  tasks: 2
  commits: 2
plan_head_before: c82c4a205d30f59ddecb95bf4dcf0fa78e83eed9
plan_head_after: 25398caab19fea506f9a0edcb9e5d61f42da2499
tech-stack:
  added: []
  patterns:
    - Resolve usage surfaces once before the existing live transport selector
    - Carry the parent run through parser callbacks and nested handlers
key-files:
  created:
    - .planning/phases/05-mode-selected-json-sink/05-02-RED.json
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/handlers/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/edge/router.test.ts
    - tests/edge/notification-boundary.ts
    - tests/architecture/presentation-sink.test.ts
key-decisions:
  - Retain the parent-reviewed second internal raw delivery site with an exact formatter-provenance assertion; preserve the two protected UI calls and existing controls.
patterns-established:
  - Usage errors and help share the structured path's single live mode switch and sole appendEntry site.
  - Whole-entry arrays assert adjacent and separated duplicates after all callbacks finish.
requirements-completed: ["JOUT-01", "MODE-01", "TENB-02"]
coverage:
  - id: D1
    description: All command families send help and parser rejections to complete JSON/RPC usage entries through the original run.
    requirement: JOUT-01
    verification:
      - kind: unit
        ref: tests/edge/router.test.ts#appends a complete unknown-command usage error in json
        status: pass
      - kind: other
        ref: npm run check
        status: pass
    human_judgment: false
  - id: D2
    description: Mixed raw and structured emissions preserve order and duplicate multiplicity while mode changes on the same context and run.
    requirement: MODE-01
    verification:
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#keeps mixed entries and duplicates ordered while reading live mode on the original run
        status: pass
      - kind: unit
        ref: tests/edge/router.test.ts#preserves ordered duplicate rejections around a handler emission on the same run
        status: pass
    human_judgment: false
  - id: D3
    description: Existing text bytes, severity, argument counts, corpus multiplicity, and output catalog remain unchanged.
    requirement: TENB-02
    verification:
      - kind: other
        ref: node scripts/notify-corpus.mjs check plus exact file-log count assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 33min
completed: 2026-10-07
status: complete
---

# Phase 5 Plan 2: Help and Usage JSON Sink Summary

**Help and argument failures now append complete JSON/RPC entries through the command's original run, preserving live mode selection, duplicate order, and existing text.**

## Performance

- Started: 2026-10-07T10:29:38Z (first recorded RED run).
- Completed verification: 2026-10-07T11:02:59Z.
- Duration: 33 minutes, including the architecture-count checkpoint.
- Tasks: 2.
- Implementation files modified: 51, including 24 production modules and 27 test/support files.
- Runtime: Node `v26.10.0`.
- Verified branch: `agent-p05-02-1791368841`.
- Verified implementation head: `25398caab19fea506f9a0edcb9e5d61f42da2499`.
- Actual tokens: 127440 characters / 4 over the committed implementation diff. The ledger measured two task commits before this metadata commit.

## Accomplishments

- Required runs reach usage-error and usage-info helpers from the router, help, shared argument parsers, and every affected plugin/marketplace handler. Shared flag options group context, run, and usage without creating another context or run.
- The existing selector accepts resolved raw surfaces as well as structured presentations. Machine output retains one switch and one append site; text remains formatter-produced.
- Every command owner has complete machine rejection assertions. Same-run dispatcher and router tests preserve separated and adjacent equal entries, observe live JSON/RPC changes, and finalize the retained capture after emissions. The dispatcher still permits only three inventory reads when opening the run.
- The final corpus is exactly 3149 baseline entries present and zero extras. The catalog has no diff from `26cb0056`.

## Task Commits

1. **Task 1: Carry the run through help, parsing wrappers, and every usage branch** — `f1930ffb50d1eeee812a279c56caa9e46bd97d9e` — `feat: route help and usage errors through the command sink`.
2. **Task 2: Prove live selection and duplicate ordering** — `25398caab19fea506f9a0edcb9e5d61f42da2499` — `test: preserve mixed notification ordering across live modes`.

Both foreground commits passed `npm run check:commit` with hooks enabled. The subsequent commit-message hook's no-files skip is separate from the successful build-input hook. Neither task commit deleted a tracked file. Plan metadata is recorded in the following documentation commit.

## Files Created/Modified

- `shared/notification-dispatch.ts`: required-run usage helpers, resolved raw input to the live selector, and direct raw formatter delivery.
- `edge/router.ts`, `edge/handlers/shared.ts`, both handler-tier shared modules, and affected plugin/marketplace handlers: original-run propagation with unchanged parser results and wording.
- Mirrored handler owners, router owner, dispatcher owner, and `tests/edge/notification-boundary.ts`: strict mode reads, complete machine entries, no command work on rejection, and duplicate/order proofs.
- `tests/architecture/presentation-sink.test.ts`: approved structural literal and second raw delivery-site provenance check; the protected two UI calls remain pinned.
- `05-02-RED.json`: original TAP failure and semantic assessment.
- `05-VALIDATION.md`: observed evidence for the two completed task rows only; phase sign-off remains pending.

## Verification

All final gates exited 0 on the verified implementation head with Node `v26.10.0`:

- `npm run check` — static checks, unpaired architecture/fake tests, integration tests, and all direct source/test pairs passed; merged LCOV contained 264 records. Log: `/tmp/p05-02-final-check.log`.
- `node scripts/notify-corpus.mjs check > /tmp/p05-02-final-corpus.log 2>&1` — 8824 tests, 8823 passed, zero failed, one existing optional resolver test skipped. Exact count validation below passed.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` — no output.
- `git diff --exit-code` — no uncommitted tracked implementation changes when final verification completed.

The corpus log was validated without a piped stdin reader:

```sh
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const lines=fs.readFileSync("/tmp/p05-02-final-corpus.log", "utf8").split(String.fromCharCode(10)); assert.deepStrictEqual(lines.filter((line)=>line.startsWith("missing in ") || line.startsWith("extra in ")), []); assert.ok(lines.includes("Notify corpus check passed: 3149 baseline entries present, 0 extra.")); console.log("Corpus: 3149 present, 0 extra");'
```

Development and commit evidence:

- `node --test tests/edge/router.test.ts tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/*.test.ts tests/edge/handlers/marketplace/*.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/presentation-sink.test.ts` — 905 passed before Task 2; all final owners also passed through the final gate.
- `npm run test:coverage:direct --` with all 25 source paths named by Task 1's verification command — exit 0; exact invocation retained in `/tmp/p05-02-direct.log`. The final all-pair gate subsequently verified the corrected and committed tree.
- `node --test tests/shared/notification-dispatch.test.ts tests/edge/router.test.ts` — 286 passed after Task 2; log `/tmp/p05-02-task2-tests.log`.
- `node_modules/.bin/fallow audit --base c82c4a205d30f59ddecb95bf4dcf0fa78e83eed9` and `node_modules/.bin/fallow audit --base f1930ffb` — exit 0 before their respective commits. The first audit reported three advisory clone groups; the required Fallow gate passed without configuration changes. The second found no issues.
- Task 1: `git diff --name-only -z -- '*.ts' > /tmp/p05-02-task1-files.z`, then `xargs -0 env SKIP=npm-check pre-commit run --files < /tmp/p05-02-task1-files.z` — clean exit 0.
- Task 2: `SKIP=npm-check pre-commit run --files tests/shared/notification-dispatch.test.ts tests/edge/router.test.ts` — Prettier fixed formatting, then rerun exited 0.
- Commit hook logs: `/tmp/p05-02-task1-commit.log` and `/tmp/p05-02-task2-commit.log`; each records `npm run check:commit` passed.
- Source inspection confirms exactly two `ctx.ui.notify` calls inside `deliver`, one live selector, and one `appendEntry` call. The passing architecture owner checks formatter provenance and the existing controls.

## TDD Gate Compliance

Task 1's RED command was `node --test --test-reporter=tap --test-name-pattern="appends a complete unknown-command usage error in json" tests/edge/router.test.ts`. The target executed and failed its planned whole-entry assertion: expected one usage-error entry, received an empty list after the old UI path was attempted. This was a behavioral failure, not a load, syntax, or fixture failure. The original report and semantic assessment are retained in `05-02-RED.json`.

`node /home/acolomba/src/pi-claude-marketplace-json/.codex/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence .planning/phases/05-mode-selected-json-sink/05-02-RED.json --raw` returned `RED_EVIDENCE_OK`. Per the explicit project override, failing tests were observed locally and committed with green production code, since hooks prohibit a failing RED commit. Task 2 changes only tests for the already-implemented behavior; its new assertions passed without additional production changes. No artificial failing implementation or separate refactor commit was introduced.

## Decisions Made

Retained the parent-approved minimal architecture adjustment. The second internal raw delivery site is counted and checked against its exact formatter provenance. The existing two protected UI calls, other provenance predicates, all existing controls, text bytes, and corpus multiplicity remain mandatory and passed.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Correct the frozen internal raw delivery count

- Found during Task 1: the plan requires a new direct raw text delivery path while permitting only a literal change in the architecture test and freezing its old one-site count.
- Resolution: the parent reviewed the concrete diff and passing full gate, then explicitly approved changing that internal count from one to two and adding the exact new formatter-provenance assertion.
- Files: `tests/architecture/presentation-sink.test.ts`; committed in `f1930ffb50d1eeee812a279c56caa9e46bd97d9e`.
- Verification: architecture owner, both commit hooks, final full gate, strict corpus, and unchanged catalog passed. No existing control was removed.

### 2. [Rule 3 - Blocking] Use the intact GSD runtime with the isolated cwd

- The copied local runtime could not load `../../../scripts/fix-slash-commands.cjs`.
- Used the intact runtime at `/home/acolomba/src/pi-claude-marketplace-json/.codex/gsd-core/bin/gsd-tools.cjs` with every query executed from this worktree. Its init output confirmed this worktree's project and phase paths. No runtime/config/skill file was changed.
- Verification: initialization and RED classification succeeded; no implementation commit was needed for this environment adjustment.

Total: two narrow blocker resolutions. No user-facing scope, parser semantics, dependencies, or text output changed.

## Issues Encountered

- A development import cleanup placed imports inside comment text; static checks caught it. Corrected the syntax and import order, added the machine boundary's explicit return type, and used the existing strict text boundary for help assertions. The final full gate passed.
- The raw formatter has a possibly-empty return type for other raw kinds. Its non-null assertion is documented and narrowly justified because usage-error and usage-info are the only raw callers of this selector in this increment. Later raw-kind migrations must handle their empty cases.
- The optional type-aware Fallow symbol-impact sidecar timed out after 120 seconds. CodeGraph caller tracing, required-run type checking, owner tests, and the final complete coverage gate provided the caller and behavior checks. Sandbox-limited checks were rerun through approved escalation; no hooks or safeguards were disabled.
- GSD's plan-subject lookup expects phase-scoped commit titles, which this repository forbids. Its plan query therefore returned no matching commits. The phase-directory lookup reads the explicit task rows instead; that lookup, the persisted two-commit ledger, and direct ancestry checks verify both commits without changing repository naming policy.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No dependency installation or external configuration was needed.

## Next Phase Readiness

Ready for 05-03. Diagnostic, authentication, load, and hook raw-helper migrations remain owned by later plans. The existing optional pi-subagents resolver skip remains; no skipped test was added. Shared STATE.md, ROADMAP.md, and requirement status are left to the parent. No structural codebase-map update was needed.

## Self-Check: PASSED

Both task commits exist on this branch; all expected implementation files and RED evidence exist. The final full check, exact corpus assertions, catalog comparison, task acceptance checks, and unchanged-tree check passed. No introduced TODO, FIXME, or placeholder was found.
