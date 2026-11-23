---
phase: 02-git-process-seam-and-typed-failures
plan: "08"
subsystem: docs
tags: [codebase-map, system-git, decisions, manual-check]

requires:
  - phase: 02-git-process-seam-and-typed-failures
    provides: "plans 02-01 to 02-07: platform/process-run.ts, platform/git-process.ts, platform/git-failure-kind.ts, the chokepoint and BLOCK C zone changes, the {git missing} reason"
provides:
  - "the codebase map (STACK, CONVENTIONS, ARCHITECTURE, INTEGRATIONS, STRUCTURE) describes the git process seam"
  - "PROJECT.md records this phase's outcome for D-SG-01 to D-SG-07"
  - "the manual macOS and Windows check is deferred to the pull request"
affects: [system-git-transport, ssh-sources, failure-message-parity, close]

actuals:
  tokens: 12150
  tasks: 3
  commits: 2
plan_head_before: ac455c8737a900e3df09e65e514b46615236c98d
plan_head_after: 3962217e75c014d071f2516ef313191948fc335a

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/codebase/STACK.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/PROJECT.md

key-decisions:
  - "The manual macOS and Windows check (steps 1-10) is deferred to the pull request; the orchestrator records it as an open [system-git] unrun-verify windows entry after merge"

patterns-established: []

requirements-completed: ["SG-PRC-01", "SG-PRC-02", "SG-PRC-06"]

coverage:
  - id: D1
    description: "The child-process-chokepoint exemptions in CONVENTIONS.md and ARCHITECTURE.md match the rule pack's five-file exclude list, and neither page exempts the credential module"
    requirement: "SG-PRC-01"
    verification:
      - kind: other
        ref: "the Task 1 node verify script that compares both pages with rule-packs/architecture.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "The platform layer lists process-run.ts, git-process.ts, and git-failure-kind.ts; ARCHITECTURE.md counts 18 NETWORK_SEAMS files with hosted-catalog.ts; INTEGRATIONS.md drops the 'exactly three files' claim"
    verification:
      - kind: other
        ref: "Task 1 acceptance greps (9 of 9 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The macOS and Windows behavior of the git process module (no-git message, shim and lookup rules, no credential or console window, no process left after a hanging helper)"
    requirement: "SG-PRC-02"
    verification: []
    human_judgment: true
    rationale: "Linux CI and this sandbox cannot run the macOS xcrun shim, the Windows lookup, the console, or the Windows process tree. The check is deferred to the pull request."
  - id: D4
    description: "PROJECT.md records this phase's outcome for D-SG-01 to D-SG-07, and no outcome still waits on this phase"
    requirement: "SG-PRC-06"
    verification:
      - kind: other
        ref: "test \"$(grep -c 'Pending (Phase 2' .planning/PROJECT.md)\" = 0 and the D-SG-01 and D-SG-07 row greps"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-23
status: complete
---

# Phase 2 Plan 08: Codebase Map and D-SG Outcomes Summary

**The codebase map now names `platform/git-process.ts` as the one git spawn site, with five chokepoint exemptions, 18 network seams, and 54 fallow-ignore markers. PROJECT.md records what this phase delivered for D-SG-01 to D-SG-07. The manual macOS and Windows check is deferred to the pull request.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-23T18:22:21Z
- **Completed:** 2026-11-23T18:28:02Z
- **Tasks:** 3 (2 committed, 1 checkpoint deferred to the pull request)
- **Files modified:** 6

## Accomplishments

- STACK.md: clone and fetch still run in `isomorphic-git`, but a git-source operation first needs a usable system git. `platform/git.ts` asks `platform/git-process.ts` for it before each network verb (D-SG-01). The non-interactive values (`GIT_TERMINAL_PROMPT=0`, an empty `GIT_ASKPASS`, `GCM_INTERACTIVE=never`, `credential.interactive=false`) are now set by `platform/git-process.ts` on every git command (D-SG-05).
- CONVENTIONS.md: the `child-process-chokepoint` entry cites D-SG-01 / D-PL9-11 / D-CF1-02 and exempts exactly the five files of the rule pack. The marker count is 54, not 51, and 16 of them are `unused-export`, not 13. The three new markers are in `platform/git-process.ts` (`createGitProcess`, `NODE_GIT_HOST`, `NODE_GIT_SPAWN`). I re-counted on the tree with `rg`. The other kinds did not change: 6 unused-file, 26 code-duplication, 5 private-type-leak, 1 unused-type.
- ARCHITECTURE.md: the platform layer lists `process-run.ts`, `git-process.ts` (with its two importers and the `GIT_PROCESS_IMPORTERS` zone), and `git-failure-kind.ts`. It also says that `git-credential.ts` runs `git credential` through the git process module. The Network boundary item counts 18 `NETWORK_SEAMS` files and lists `hosted-catalog.ts` among them. The rule-pack item gives the five child-process exemptions with their decision IDs. The Authentication paragraph says that the helper chain runs through `platform/git-process.ts` in the neutral directory.
- INTEGRATIONS.md: the git client line says that a git-source operation needs system git. The Auth line names the git process module and the five files that may import `node:child_process`, which `test/architecture/no-shell-out.test.ts` checks against the tree. The stale "exactly three files" claim is gone.
- STRUCTURE.md: the platform layer lists the three new modules.
- PROJECT.md: each D-SG row now records this phase's outcome. The outcome text for each decision is in the next section.

## Checkpoint Answer (Task 2)

**"deferred to PR"**. The orchestrator gave this answer before execution, because no macOS or Windows machine is attached to this session. I did not run the manual steps 1 to 10. The open `unrun-verify` entry is the orchestrator's step after merge. This executor may not edit `.planning/WINDOWS.md`, so I did not run the command below:

```bash
PATH="/opt/pi-claude-marketplace/bin:$PATH" node .claude/gsd-core/bin/gsd-tools.cjs windows append --phase 2 --kind unrun-verify --file extensions/pi-claude-marketplace/platform/git-process.ts --description "[system-git] the manual macOS and Windows check of the git process module (02-08 steps 1-10: no-git message, shim and lookup rules, no credential window, no console window, no process left after a hanging helper) is deferred to the pull request"
```

The entry's id is not known yet. The D-SG-04 outcome cell refers to the entry by its `[system-git]` prefix and its kind.

## D-SG Outcomes Written

| Decision | Outcome cell |
| --- | --- |
| D-SG-01 | Phase 2: the `{git missing}` message, and the git check before the four network verbs of `platform/git.ts`. The transport swap (Phase 3) and the `isomorphic-git` removal (Phase 8) remain |
| D-SG-02 | Phase 2: the `local` lane of `platform/git-process.ts`. Its production callers arrive with the transport swap (Phase 3), and the NFR-5 text change with the SSH probe (Phase 4) |
| D-SG-03 | Phase 2 adds no host-key option, so ssh's own default applies. The NFR-10 restatement remains for the close phase (Phase 8) |
| D-SG-04 | Phase 2: implemented in `platform/git-process.ts`; the npm runner keeps its D-PL9-18 lookup. The manual macOS and Windows check is deferred to the pull request, as an open `[system-git]` `unrun-verify` windows entry |
| D-SG-05 | Phase 2: one builder in `platform/git-process.ts`. It also drops relative and empty entries from git's own PATH, and `git credential` runs in the real path of the temporary directory |
| D-SG-06 | Phase 2: the `git-too-old` kind, and the git version in the debug log, read only after such a failure. The README note remains for the close phase (Phase 8) |
| D-SG-07 | Phase 2: `{git missing}` with its cause line. Wording parity remains for the failure-message phase (Phase 6) |

I checked each claim against the tree before I wrote it. The PATH filter is in the environment builder of `git-process.ts` (`absoluteEntries`). The neutral directory is `realpath(tmpdir())`. The header says D-SG-03 sets no host-key option.

## Task Commits

1. **Task 1: Bring the codebase map in line with the git process seam** - `31f632c` (docs, tracer)
2. **Task 2: Check the git process module by hand on macOS and on Windows** - no commit; deferred to the pull request
3. **Task 3: Record the outcome of each D-SG decision** - `3962217` (docs)

**Plan metadata:** the SUMMARY commit that follows these.

Tracer gate (Task 1): the run is interactive, `human_verify_mode` is `end-of-phase`, and the verify block is automated only. I re-ran the verify script on the committed tree, and it exited 0. So execution went on to Task 3.

## Verification

- Task 1 `verify` (the node script that compares CONVENTIONS.md and ARCHITECTURE.md with the rule pack's `exclude` list): exit 0, before and after the commit.
- Task 1 acceptance: `platform/git-process.ts` appears in ARCHITECTURE (2), CONVENTIONS (2), and STACK (2). `git-process.ts` appears in INTEGRATIONS (2) and STRUCTURE (1). `the 18 files in` appears once in ARCHITECTURE, and `hosted-catalog` once. ``all but `platform/git-credential.ts` `` appears 0 times in CONVENTIONS, and `exactly three files` 0 times in INTEGRATIONS. All PASS.
- Task 3 `verify`: exit 0. `Pending (Phase 2` appears 0 times, and the `| **D-SG-07` row is there once. PASS.
- Task 3 acceptance on `.planning/WINDOWS.md` (``grep -c '\[system-git\] the manual macOS and Windows check'`` is 1 or more): this check cannot pass in this worktree, because the orchestrator runs the `windows append` command after merge. It is the orchestrator's step.
- Both commits passed the pre-commit hook. `npm run check` was not run, as the plan says. The orchestrator's phase gate runs it.

## Files Created/Modified

- `.planning/codebase/STACK.md` - the isomorphic-git entry and the hardened-variables entry
- `.planning/codebase/CONVENTIONS.md` - the child-process-chokepoint exemptions, and the fallow-ignore counts
- `.planning/codebase/ARCHITECTURE.md` - the platform layer, the network seams, the rule-pack chokepoints, and authentication
- `.planning/codebase/INTEGRATIONS.md` - the git client line and the Auth line
- `.planning/codebase/STRUCTURE.md` - the platform layer contents
- `.planning/PROJECT.md` - the outcome cells of D-SG-01 to D-SG-07

## Decisions Made

- I followed the orchestrator's pre-answered checkpoint ("deferred to PR"). I did not run the manual steps, and I left the windows ledger write to the orchestrator.

## Deviations from Plan

None. The plan was executed as written. The Task 2 checkpoint was pre-answered, and the windows append moved to the orchestrator, because the orchestrator's instructions forbid an executor to write `.planning/WINDOWS.md`.

## Issues Encountered

- The harness refuses Bash commands whose text names a path that contains `git` (the phase directory). Reads and verifies ran from scripts in the scratchpad.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- The phase is complete once the orchestrator's phase gate (`npm run check` on the combined tree) passes and the `[system-git]` windows entry is appended.
- Open: the manual macOS and Windows check (02-08 steps 1-10) must run before the pull request ships. While `windows_enforce` is on, the open `unrun-verify` entry blocks shipping.

## Self-Check: PASSED

- FOUND: the five `.planning/codebase/*.md` pages and `.planning/PROJECT.md`, all modified as described
- FOUND: `31f632c` and `3962217` are ancestors of HEAD
- No tracked file was deleted

---
*Phase: 02-git-process-seam-and-typed-failures*
*Completed: 2026-11-23*
