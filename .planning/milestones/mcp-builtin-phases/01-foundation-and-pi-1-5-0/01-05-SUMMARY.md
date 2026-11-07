---
phase: 01-foundation-and-pi-1-5-0
plan: "05"
subsystem: platform
tags: [mcp, pi-1.5.0, soft-deps, snapshot, strong-mock]

requires:
  - phase: 01-foundation-and-pi-1-5-0 (plan 01-03)
    provides: "McpImplementationId and ActiveMcpImplementation in platform/pi-api.ts"
provides:
  - "SoftDepStatus.mcpImplementation: ActiveMcpImplementation (frozen interface 2), decided once per run snapshot with the precedence adapter, builtin, none"
  - "CommandInventoryItem.sourceInfo.path"
  - "module-private hasLoadedBuiltinMcp arm (extension command mcp whose sourceInfo.path is exactly builtin:mcp), sharing the snapshot's one getCommands() read with the adapter command arm"
  - "piMcpAdapterLoaded kept as the derived view mcpImplementation === \"adapter\""
affects: [mcp-builtin registration, info MCP status reader choice, markers and severities (Phase 3 reader switch)]

actuals:
  tokens: 19400
  tasks: 2
  commits: 1
plan_head_before: 57363954459d2a3d6dff1642f0eb5fa4aca10175
plan_head_after: 2fb7c18e9a26c87913032c2ddb6d57f2805ff813

tech-stack:
  added: []
  patterns:
    - "One inventory read per snapshot, handed to every arm that needs it; each arm still guarded by probeArm"
    - "Derived compatibility flag kept beside the new field until its readers move"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/notification-run.ts
    - test/platform/pi-api.test.ts
    - test/shared/notification-run.test.ts
    - test/shared/notification-run-seeds.ts
    - test/edge/notification-boundary.ts
    - "23 further test files: SoftDepStatus literals gain mcpImplementation"

key-decisions:
  - "A getCommands() that throws reads as an empty command list, so both MCP arms see no command (the plan sketched an undefined list; same outcome, fewer branches)"
  - "softDepStatus keeps its old read order (tools for pi-subagents, then commands, then the two other tool reads); test/edge/command-run.test.ts pins that order"
  - "Partial<SoftDepStatus> test helpers default mcpImplementation to none, and every caller that passes piMcpAdapterLoaded: true also passes mcpImplementation: adapter"

patterns-established:
  - "MSEL-01 detection rows live in one row factory (mcpImplementationRows) that feeds both the decision cases and the derived-flag invariant cases"

requirements-completed: [MSEL-01]

coverage:
  - id: D1
    description: "Every run snapshot carries mcpImplementation: adapter, builtin, or none, with adapter precedence, order independence, third-extension /mcp and prompt/skill entries reading none, and throwing reads never escaping"
    requirement: "MSEL-01"
    verification:
      - kind: unit
        ref: "test/platform/pi-api.test.ts#MSEL-01 decides * when *"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts (100% lines, branches, functions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "piMcpAdapterLoaded equals mcpImplementation === adapter in every snapshot case"
    requirement: "MSEL-01"
    verification:
      - kind: unit
        ref: "test/platform/pi-api.test.ts#MSEL-01 reports the adapter loaded exactly when it is the active implementation and *"
        status: pass
    human_judgment: false
  - id: D3
    description: "One snapshot still makes exactly one getCommands() read and three getAllTools() reads"
    requirement: "MSEL-01"
    verification:
      - kind: unit
        ref: "test/platform/pi-api.test.ts#MSEL-01 decides both MCP arms from one getCommands() read and three getAllTools() reads"
        status: pass
      - kind: unit
        ref: "test/edge/command-run.test.ts (read order pinned)"
        status: pass
    human_judgment: false
  - id: D4
    description: "openNotificationSnapshot and openNotificationRun expose mcpImplementation on softDeps"
    requirement: "MSEL-01"
    verification:
      - kind: unit
        ref: "test/shared/notification-run.test.ts#MSEL-01: a snapshot names Pi's built-in MCP as the run's active implementation"
        status: pass
      - kind: unit
        ref: "test/shared/notification-run.test.ts#MSEL-01: a run carries Pi's built-in MCP as its active implementation"
        status: pass
    human_judgment: false
  - id: D5
    description: "No reader changes output: only platform/pi-api.ts names mcpImplementation; softDepMarkers, companionRequirements, and companionSeverity still read piMcpAdapterLoaded"
    verification:
      - kind: other
        ref: "grep -rln 'mcpImplementation' extensions/pi-claude-marketplace -> platform/pi-api.ts only"
        status: pass
      - kind: unit
        ref: "npm run check:commit (check:static, test:unpaired, direct coverage of every pair)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 05: Active MCP implementation snapshot Summary

**`SoftDepStatus.mcpImplementation` names the run's MCP implementation (adapter, then Pi's `builtin:mcp` `/mcp`, then none) from the snapshot's single `getCommands()` read, while `piMcpAdapterLoaded` stays as its derived adapter view so no output changes.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-11-04T05:02:08Z
- **Completed:** 2026-11-04T05:28:00Z
- **Tasks:** 2 (Task 2 changed no file)
- **Files modified:** 29

## Accomplishments

- `platform/pi-api.ts`: `SoftDepStatus` gains `mcpImplementation: ActiveMcpImplementation`, and `CommandInventoryItem.sourceInfo` gains `path`. `softDepStatus` reads `getCommands()` once through a guarded `readCommands`. It hands the list to the adapter command arm and to the new private `hasLoadedBuiltinMcp` arm, which matches only an extension command named exactly `mcp` whose `sourceInfo.path` is exactly `builtin:mcp`. `activeMcpImplementation` decides with plain `if` statements: adapter, then builtin, then none. `piMcpAdapterLoaded` comes from the same adapter result.
- The probe keeps its read count (one `getCommands()`, three `getAllTools()`) and its read order.
- `test/platform/pi-api.test.ts`: 11 MSEL-01 decision rows, the same 11 rows as derived-flag invariant cases, one strict-mock read-count case, two type pins, and `mcpImplementation` added to every existing expected status. The two built-in rows now expect `builtin`.
- `test/shared/notification-run.test.ts`: snapshot and run cases for the built-in implementation. Every literal carries the field.
- 23 other test files and the two seeds in `test/shared/notification-run-seeds.ts`: each `SoftDepStatus` literal gains `mcpImplementation` to match its `piMcpAdapterLoaded`.
- Doc updates: the `pi-api.ts` module header, the `expectSoftDepProbes` comment, and one MSEL-01 line on `NotificationSnapshot.softDeps`.

## Task Commits

1. **Task 1: decide mcpImplementation from one command read and carry it through every snapshot**: `2fb7c18` (feat). The tests and the implementation are in one commit, see TDD Gate Compliance.
2. **Task 2: prove no output changed and the static gates hold**: no commit. The task changed no file. Its searches and both scripts passed (see Verification).

**Plan metadata:** recorded in the docs commit that adds this file.

## TDD Gate Compliance

| Gate | Task 1 |
|------|--------|
| RED (evidence) | `RED_EVIDENCE_OK`, target `MSEL-01 decides builtin when Pi lists the mcp command from builtin:mcp` (test/platform/pi-api.test.ts), 61 of 81 failing on `deepStrictEqual` / `strictEqual` |
| RED commit | none (violation, see below) |
| GREEN | `2fb7c18` |
| REFACTOR | none needed |

- **RED:** the tests were written before any production change. `node --test --test-reporter=tap test/platform/pi-api.test.ts` exited 1, and `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (reason `target_test_failed`, format `tap`, no report errors). **Semantic assessment:** valid. The target ran and failed on its planned `deepStrictEqual`, because the status had no `mcpImplementation`. No load, syntax, or fixture fault occurred. The 20 passing tests were the re-export, frontmatter, and read-tool cases and the `none` invariant rows, which do not depend on the new field.
- **Missing RED commit:** I tried a RED-only commit (`test(pi-api): ...`). The pre-commit hook ran `npm run check:commit`, and its typecheck refused the commit: the new type pins name `mcpImplementation` and `sourceInfo.path`, which did not exist yet. AGENTS.md forbids `--no-verify`, so test and implementation landed together, as in plan 01-03 (P1-DC-28).
- **Commit scope:** `feat(pi-api)`, not `feat(01-05)`. AGENTS.md and the committing skill forbid phase or plan identifiers in titles and scopes, so the gate greps of the form `^feat\(0*1-0*5\)` find nothing, by design.

## Verification

- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts extensions/pi-claude-marketplace/shared/notification-run.ts`: passed. Both files are at 100% lines, branches, and functions (notification-run.ts: 15/15 branches, 4/4 functions, 92/92 lines).
- `npm run typecheck`: exit 0.
- `npm run test:modules`: the first run found 2 failures in `test/edge/command-run.test.ts`, which pins the read order (see Deviations). After the fix those tests and the pi-api and notification-run tests pass. The commit hook's direct coverage of every pair then passed. It covers the whole paired unit suite, because the commit staged shared test support.
- `npm run check:static`: all seven steps passed. `npm run test:unpaired` (architecture): exit 0. Both passed again inside the commit hook.
- Acceptance greps: `mcpImplementation` appears 3 times in pi-api.ts. `"builtin:mcp"` appears once. `pi.getCommands()` has one non-comment read site. `grep -rln mcpImplementation extensions/pi-claude-marketplace` lists only `platform/pi-api.ts`.
- Task 2 searches: `softDepMarkers` and `companionRequirements` (`shared/concerns/soft-dep.ts`) and `companionSeverity` (`shared/notify-reasons.ts`) still read `piMcpAdapterLoaded`. No production module other than pi-api.ts reads `mcpImplementation`. Fallow reported no unused export, and `hasLoadedBuiltinMcp` is module-private.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/pi-api.ts`: the field, `sourceInfo.path`, `readCommands`, `isBuiltinMcpCommand`, `hasLoadedBuiltinMcp`, `activeMcpImplementation`, and the reshaped `hasLoadedPiMcpAdapter(pi, commands)` and `softDepStatus`.
- `extensions/pi-claude-marketplace/shared/notification-run.ts`: one doc line (MSEL-01). No code change.
- `test/platform/pi-api.test.ts`, `test/shared/notification-run.test.ts`: the behavior cases.
- `test/edge/notification-boundary.ts`: the `expectSoftDepProbes` doc comment. No code change.
- `test/shared/notification-run-seeds.ts`, `test/orchestrators/plugin/install-flow-fixture.ts`, and the other 21 listed test files: the literal updates. `install-flow-results.test.ts` also gains a `satisfies SoftDepStatus` (and its type import), so its literal keeps the union type.

## Decisions Made

See `key-decisions` in the frontmatter and Dubious Choices below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first reshaped probe changed the Pi read order**
- **Found during:** Task 1 (`npm run test:modules`)
- **Issue:** `softDepStatus` read `getCommands()` before the pi-subagents `getAllTools()` read. `test/edge/command-run.test.ts` ("delivers a handler failure through the original sink" in json and rpc) records the read order, and it failed.
- **Fix:** `softDepStatus` takes the pi-subagents result first, then the command list, then the adapter and workflow tool reads. This is the order the snapshot used before. The doc comment says so.
- **Files modified:** extensions/pi-claude-marketplace/platform/pi-api.ts
- **Verification:** command-run, pi-api, and notification-run tests pass. The hook's direct coverage of every pair passed.
- **Committed in:** `2fb7c18`

**2. [Rule 3 - Blocking] One results-test literal widened to string**
- **Found during:** Task 1 (typecheck)
- **Issue:** `install-flow-results.test.ts` builds an untyped `softDeps` const, so `"none"` widened to `string`.
- **Fix:** `satisfies SoftDepStatus` plus a type import.
- **Committed in:** `2fb7c18`

**3. [Process] No separate RED commit.** See TDD Gate Compliance.

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) and 1 process deviation. **Impact:** none on behavior. The read order now matches the old order exactly.

## Issues Encountered

- The sandbox's command verifier rejects `${SKIP:+,$SKIP}` and shell loops over computed file names, so I used the literal `SKIP=npm-check,trufflehog` and small Python scripts in the scratch folder for the bulk literal edits. The results are the same.
- The Task 1 commit staged shared test support, so the hook ran direct coverage for every pair. I ran that commit with the tool's background mode and waited for it to finish, because it could take longer than the 10-minute foreground limit. It passed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-09 is mitigated and pinned: the built-in arm needs source `extension`, name `mcp`, and `sourceInfo.path` exactly `builtin:mcp`. A third extension's `/mcp`, and a prompt or skill named `mcp` that carries the built-in path, read as none. T-01-10 is mitigated and pinned: a throwing `getCommands()` reads as none, and a throwing `getAllTools()` still lets the command arms decide. Neither throw escapes the snapshot.

## Dubious Choices

1. **No RED-only commit (Medium).** I committed the tests and the implementation together and recorded the classifier-validated RED evidence here. The alternatives were `--no-verify` (forbidden by AGENTS.md) or `test.skip` (forbidden by the unit-test rules, and it would not fail). The hook's typecheck refused the RED commit. The end-of-phase TDD review will flag the missing RED commit.
2. **Commit scope `pi-api` without the plan id (Low).** The project rule forbids phase or plan identifiers in titles and scopes, and it overrides the tdd.md template. The GSD TDD gate greps cannot match.
3. **A throwing `getCommands()` reads as an empty list, not an undefined list (Low).** The plan's action says "a throw gives an undefined list". An empty list has the same effect, since both arms see no command, and it needs no optional-chain branches. The `getCommands() throws` row pins the result: none, adapter flag false.
4. **The old read order is kept (Low).** The plan only fixes the counts. I kept the order too (pi-subagents tools, commands, adapter tools, workflow tools) because `test/edge/command-run.test.ts` pins it. The alternative was to change that test's expected order.
5. **Partial test helpers default `mcpImplementation` to none, and callers state it (Low).** Helpers such as `makeCtx(Partial<SoftDepStatus>)` could get a run where the adapter flag is true and the implementation is none. I updated every caller that passes `piMcpAdapterLoaded: true` to pass `mcpImplementation: "adapter"` as well, so each snapshot keeps the invariant. The alternative was a conditional in each helper that derives the field. It is shorter, but it computes test data from the flag.
6. **The third-extension and prompt/skill rows are built inline (Low).** `adapterCommand("mcp", "npm:other-mcp-extension")` stands for another extension's `/mcp`. `{ ...builtinMcpCommand(), source: "prompt" | "skill" }` stands for a prompt or skill named `mcp`. Pi would not give a prompt the `builtin:mcp` path, but this keeps the source field as the only difference. A new seed in `test/platform/pi-inventory-seed.ts`, a file outside the plan's list, was the alternative.
7. **The invariant is a separate case per row (Low).** "piMcpAdapterLoaded equals mcpImplementation === adapter" is asserted with `strictEqual(status.piMcpAdapterLoaded, status.mcpImplementation === "adapter")` over the same 11 rows. The decision cases already pin both values, so this is partly redundant. The plan asks for the invariant by name.
8. **One kept title (Low).** `ADET-01 does not count Pi's built-in MCP alone` now expects `mcpImplementation: "builtin"`. The title is still true for the adapter flag, so I did not rename it. The MSEL-01 rows state the built-in result by name.
9. **The commit ran in background mode (Low).** The environment asks for foreground commands only. The committing skill allows background mode once when a hook run can take longer than the foreground limit, and this commit triggered direct coverage of every pair. I waited for the commit to finish and confirmed that it landed.
10. **REQUIREMENTS.md is not touched (Low).** Other Phase 1 plans share MSEL-01, so the shared-ID gate would block marking it now. `requirements-completed` lists it, copied from the plan as the template requires. The orchestrator owns the post-wave requirement update.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Phases 2-5 can read `run.softDeps.mcpImplementation`. No reader uses it for output yet. Phase 3 switches the markers, severities, verdicts, and `requires:` from `piMcpAdapterLoaded`.
- Recorded debt: `piMcpAdapterLoaded` is a derived view now. Phase 6 may remove it once nothing reads it.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/platform/pi-api.ts`, `test/platform/pi-api.test.ts`, `test/shared/notification-run.test.ts`: FOUND.
- Commit `2fb7c18` is an ancestor of HEAD: FOUND.
- Acceptance greps and verification commands: re-run and passing, as listed under Verification.
