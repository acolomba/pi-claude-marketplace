---
phase: 08-background-autoupdate
plan: 02
subsystem: testing
tags: [e2e-harness, rpc, hermetic-env, docs, autoupdate]

requires: []
provides:
  - "RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS (optional), copied by rpcChildEnvironment only when the run sets it"
  - "Hermetic cases that plant the five background update variables in the shell and prove none reaches a fixture or a Pi"
  - "docs/env-vars.md section 'Variables that control the background update' (opt-outs, delay knob, per-marketplace default mapping, not-mapped settings)"
affects: [08-04 behavioral scenario (dedicated Pi with delay 0), AUP-02 docs]

actuals:
  tokens: 3300
  tasks: 2
  commits: 2
plan_head_before: 7f970cfffdc00ab61d016c30a833c4d7e890b6c6
plan_head_after: 708f88237e9fa7635e1a09a11619f73b1e5bb0a4

tech-stack:
  added: []
  patterns:
    - "Optional RpcGitEnvironment member copied inside a definedness check (exactOptionalPropertyTypes), so the child env stays an allowlist"

key-files:
  created: []
  modified:
    - test/e2e/_rpc.ts
    - test/architecture/hermetic-git-environment.test.ts
    - docs/env-vars.md

key-decisions:
  - "Named the docs H2 'Variables that control the background update' rather than 'Variables the extension reads', because the extension reads other variables (CLAUDE_CONFIG_DIR, PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL) that the section does not list"
  - "The docs record the unresolved D.bool() spelling question (E3) and the official-name default gap (D-PL8-07 uncertain choice 6) instead of omitting them"

patterns-established:
  - "A scenario's own Pi passes the delay as { ...run.piEnvironment, PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: '0' }; the run's shared Pi never sets it"

requirements-completed: [AUP-01, AUP-02]

coverage:
  - id: D1
    description: "The suite's Pi receives PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS only from the run's environment object, with the run's value, not the shell's"
    requirement: AUP-01
    verification:
      - kind: unit
        ref: "test/architecture/hermetic-git-environment.test.ts#adds the run's background update delay, not the shell's"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "No Pi or fixture the suite starts inherits DISABLE_UPDATES, DISABLE_AUTOUPDATER, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, FORCE_AUTOUPDATE_PLUGINS, or the delay variable from the shell"
    requirement: AUP-01
    verification:
      - kind: unit
        ref: "test/architecture/hermetic-git-environment.test.ts (all four cases, INHERITED_VARIABLES planted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/env-vars.md records each opt-out variable with Claude Code's name and rule, the delay knob and its limits, the per-marketplace default mapping, and the settings not read"
    requirement: AUP-02
    verification:
      - kind: other
        ref: "plan Task 2 verify loop (seven names grep) + SKIP=npm-check pre-commit run --files docs/env-vars.md"
        status: pass
    human_judgment: true
    rationale: "The grep proves the names are present; whether the prose states each rule faithfully to D-PL8-07/08/09/14 is a reading judgment"

duration: 14min
completed: 2026-10-27
status: complete
---

# Phase 8 Plan 02: Harness delay knob and env-vars docs Summary

**The suite's RPC Pi harness now carries an optional `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` that only the run can set, the hermetic cases prove the four Claude Code opt-out variables and the delay never leak in from the shell, and `docs/env-vars.md` records the background update's opt-outs, delay knob, and per-marketplace default mapping.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-27T03:07:30Z
- **Completed:** 2026-10-27T03:21:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `RpcGitEnvironment` gains the optional delay member. `rpcChildEnvironment` copies it inside a definedness check, so it never writes `undefined` and reads nothing new from `process.env`. 08-04 can start a dedicated Pi with delay `0`.
- `INHERITED_VARIABLES` now plants `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`, `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `FORCE_AUTOUPDATE_PLUGINS`. The existing whole-environment `deepStrictEqual` cases therefore prove that none of them reaches a fixture or a Pi. A new case checks that the run's `"0"` reaches the child, not the shell's `"5"`.
- `docs/env-vars.md` has a new H2 with four parts: when the background update runs, the opt-out table, the per-marketplace default precedence on both sides, and the Claude Code settings this extension does not read. The opening paragraph links to it.

## Task Commits

1. **Task 1: The suite's Pi gets the background update delay only from the run** - `76e6c01d` (test)
2. **Task 2: docs/env-vars.md records the background update's variables and defaults** - `708f8823` (docs)

## Files Created/Modified

- `test/e2e/_rpc.ts` - optional delay member on `RpcGitEnvironment`, its copy in `rpcChildEnvironment`, and an updated header comment on what the run adds
- `test/architecture/hermetic-git-environment.test.ts` - five planted variables, a fileoverview sentence, and one new `rpcChildEnvironment` case
- `docs/env-vars.md` - the "Variables that control the background update" section and the pointer to it

## Files touched outside the Files line

- `test/e2e/_rpc.ts` and `test/architecture/hermetic-git-environment.test.ts` - the phase Files line does not name them. The behavioral scenario's harness needs the delay knob, because `rpcChildEnvironment` is an allowlist. Without it the scenario's Pi would wait up to ten minutes.

## Decisions Made

- Section title: "Variables that control the background update". The plan's example title, "Variables the extension reads", would suggest a complete list, and the extension also reads variables that this section does not cover.
- The section keeps two open items visible. Claude Code's exact `D.bool()` spellings for `DISABLE_UPDATES` and `FORCE_AUTOUPDATE_PLUGINS` are unconfirmed (E3). An official-named marketplace declared without `autoupdate` stays off here but is on in Claude Code (D-PL8-07).

## Deviations from Plan

None - plan executed exactly as written. The plan named only the `RpcGitEnvironment` member doc comment. I also updated the `_rpc.ts` header comment ("adds a typed git and trust environment ... and nothing else"), because the new member made it inaccurate.

## Issues Encountered

None. Task 1's commit hook ran `npm run check:commit` with all pairs, because `test/e2e/_rpc.ts` is a non-test file under `test/`, and it passed. Task 2's hook skipped the npm checks, because docs are not build inputs. mdformat realigned the table once.

## Verification

- `node --test test/architecture/hermetic-git-environment.test.ts`: fail 0.
- `npm run typecheck`: exit 0. `features/support/pi-process.ts` still satisfies the widened interface.
- Acceptance greps: `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` appears 4 times in `test/e2e/_rpc.ts` (at least 2 required). `FORCE_AUTOUPDATE_PLUGINS` appears once in the hermetic test (at least 1 required). All seven names from the Task 2 verify loop are present.
- `npm run check` on the combined tree is the wave's post-merge gate and was not run here.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-04 can start its dedicated Pi with `{ ...run.piEnvironment, PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "0" }`, following the `usePiWithGitHubBaseUrl` pattern in `features/support/world.ts`.
- The NFR-5 amendment (D-PL8-01) in PROJECT.md and AGENTS.md is not this plan's work, and this run did not edit PROJECT.md.

## Self-Check: PASSED

- FOUND: test/e2e/_rpc.ts, test/architecture/hermetic-git-environment.test.ts, docs/env-vars.md
- FOUND: 76e6c01d, 708f8823 (ancestors of HEAD)

---
*Phase: 08-background-autoupdate*
*Completed: 2026-10-27*
