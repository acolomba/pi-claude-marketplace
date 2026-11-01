---
phase: 06-mcp-servers
plan: 09
subsystem: mcp
tags: [mcp, pi-mcp-adapter, pi-subagents, cucumber, phase-gate, docs]

requires:
  - phase: 06-mcp-servers
    provides: "plans 06-01..06-08: the eight features/mcp-server feature files, the D-CF6-01 merge and D-CF6-02 skip in domain/mcp-resolution.ts, and docs/mcp-compatibility.md re-measured on pi-mcp-adapter 7.0.0"
provides:
  - "the Phase 6 gate result on the combined tree: npm run check, npm run test:modules, and npm run test:cucumber twice, all exit 0 at 822a1ac"
  - "docs/mcp-compatibility.md checked against the merged resolver, with two small fixes"
  - "eleven ready-to-paste PROJECT.md Key Decisions rows (D-CF6-01..D-CF6-11)"
  - "the drafted, unfiled pi-subagents gap report (D-CF6-10)"
  - "the parent lines for every parent-owned or frozen file"
affects: [phase-6-merge, PROJECT.md, CHANGELOG.md, REQUIREMENTS.md, ROADMAP.md, BACKLOG.md]

actuals:
  tokens: 9000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "The gate plan's doc check reads the merged code and the scenarios, and fixes the doc in its own commit before the gate runs"

key-files:
  created:
    - .planning/phases/06-mcp-servers/06-09-SUMMARY.md
  modified:
    - docs/mcp-compatibility.md

key-decisions:
  - "The doc check found two gaps in Invalid server configs (a file with no server map; a skipped file server never replaces an earlier one) and one wrong Further reading line (the canary already pins 7.0.0); each was fixed in docs/mcp-compatibility.md before the gate"
  - "The canary raise to 7.0.0 that D-CF6-04 deferred is already done in the script; the parent line is now a live re-run and a new observed-result section"
  - "MCP-07 and ROADMAP SC4 are met by the D-CF6-10 pin, not by a working call"

patterns-established:
  - "A gate run that is stopped for an input change is restarted whole on the new commit, not resumed"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08]

coverage:
  - id: D1
    description: "The combined Phase 6 tree passes npm run check, npm run test:modules, and npm run test:cucumber twice in random order"
    verification:
      - kind: other
        ref: "npm run check (exit 0, 465 s, cucumber seed 961879, 1268 scenarios) at 822a1ac, Node v24.22.1"
        status: pass
      - kind: unit
        ref: "npm run test:modules (exit 0, 177 s)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber twice (exit 0; seeds 512508 and 920909; 1268 scenarios each)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/mcp-compatibility.md Server sources and Invalid server configs match the merged domain/mcp-resolution.ts and the sources and invalid-configs scenarios"
    verification:
      - kind: manual_procedural
        ref: "line-by-line reading of mcp-resolution.ts against the doc; commits 556a44d and 822a1ac"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy against code is a reading judgment; no test reads the doc"
  - id: D3
    description: "Eleven D-CF6 decision rows and the pi-subagents gap report, drafted for the parent"
    verification:
      - kind: other
        ref: "grep -c 'D-CF6-11' and grep -c 'pi-subagents gap report' on this SUMMARY (both >= 1)"
        status: pass
    human_judgment: true
    rationale: "Whether each row's wording and the report's request are what the user wants is a reading judgment; filing the report is the user's call"
  - id: D4
    description: "Parent lines for every parent-owned or frozen file, and no phase change to those files"
    verification:
      - kind: other
        ref: "git diff --quiet 3a7a707..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json docs/output-catalog.md docs/prd docs/hooks-compatibility.md test/live-uat .agents/skills/cucumber .github (exit 0)"
        status: pass
    human_judgment: true
    rationale: "The parent applies the lines; whether each line is complete is checked at the merge"

duration: 55min
completed: 2026-11-01
status: complete
plan_head_before: eb31ac76eeca09b8698855bf6351d5944749bbdf
---

# Phase 6 Plan 09: MCP servers phase gate Summary

**The combined Phase 6 tree passes the whole gate at `822a1ac` on Node v24.22.1: `npm run check` (1268 scenarios, seed 961879), `npm run test:modules`, and `npm run test:cucumber` twice (seeds 512508 and 920909), all exit 0. `docs/mcp-compatibility.md` now matches the merged resolver. The parent gets eleven D-CF6 decision rows, a drafted pi-subagents gap report, and every line a component phase may not apply.**

## Performance

- **Duration:** about 55 min
- **Started:** about 2026-11-01T17:12Z
- **Completed:** 2026-11-01T18:07Z
- **Tasks:** 3
- **Files modified:** 2 (`docs/mcp-compatibility.md`, this SUMMARY)

## Gate evidence

All commands ran one after another in this worktree with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (direct `npx` commands through the same wrapper). The peer cache was filled first by `node scripts/install-test-peers.mjs` (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, `@quintinshaw/pi-dynamic-workflows` 3.15.0).

- **Commit:** `822a1acdc2c71dcb2f72fb51a57a45a235cd74bd` (the tree of `eb31ac7` plus the two doc commits of Task 1)
- **Node:** v24.22.1

| Command | Exit | Run time | Result |
| --- | --- | --- | --- |
| `npm run lint` (lone ESLint warm-up) | 0 | 2 s (a first warm-up at `556a44d` also exited 0) | no finding |
| `npm run check` | 0 | 465 s | `check:static` passed all seven steps (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). `test:unpaired` and `test:integration` passed. Cucumber: seed 961879, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 11 s. Direct coverage for all pairs passed (`Merged LCOV: coverage/direct.lcov (318 records)`). |
| `npm run test:modules` | 0 | 177 s | no failure (the local reporter prints no count on a pass) |
| `npm run test:cucumber` (run 1) | 0 | 187 s | seed 512508, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 04 s |
| `npm run test:cucumber` (run 2) | 0 | 199 s | seed 920909, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 16 s |
| `npx cucumber-js features/mcp-server` | 0 | 63 s wall | seed 620424, 52 scenarios (52 passed), 663 steps, cucumber 1 m 01 s |
| `npx cucumber-js features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` (the components shard paths) | 0 | 82 s wall | seed 285390, 110 scenarios (110 passed), 1319 steps, cucumber 1 m 20 s |

The noise lines `Legacy marketplace migration could not be persisted ...` in the logs are the sanctioned IL-3 `console.warn`, printed by cases whose legacy-migration save fails. They are not failures, and every run shows them.

A first gate run started at `556a44d` and was stopped after two minutes, during `check:static`, when the doc check found the Further reading line. The whole gate then ran again from the lone lint on `822a1ac`. No result of the stopped run is used.

The acceptance listing holds: `ls features/mcp-server` prints exactly `companion-missing.feature`, `configuration.feature`, `invalid-configs.feature`, `invocation.feature`, `lifecycle.feature`, `listing.feature`, `project-scope.feature`, and `sources.feature`, and `features/step_definitions/mcp-server/calls.steps.ts` does not exist.

No gate command failed, so no gate fix was needed.

Tracer gate: the run was interactive, the mode was `end-of-phase`, and Task 1's verify is automated only. The verify (the gate above) passed, so Tasks 2 and 3 followed with no checkpoint.

## Doc check (Task 1, step 1)

`docs/mcp-compatibility.md` "Server sources", "Invalid server configs", the Upgrading bullet, and the Migration divergence were read against the merged `domain/mcp-resolution.ts`, `features/mcp-server/sources.feature`, `features/mcp-server/invalid-configs.feature`, and the 06-07 SUMMARY.

| Doc text | Merged behavior | Result |
| --- | --- | --- |
| Server sources: order, the three value shapes, array order, replace-and-keep-position, entry only without `plugin.json`, file with or without the wrapper, bundles, the `./` residual | `resolveStrictMcp`, `readDeclaredMcp`, `readMcpArray`, `fileServerMap`, `isMcpBundle`, `recordMergedServers` | holds |
| Invalid server configs: "A file source that is missing, does not parse, or cannot be read is skipped" | `mergeServerFile` also skips a document that holds no server map (for example `[]`, or an `mcpServers` member that is not a map) | **gap, fixed** in `556a44d`: the list now adds "or holds no server map" |
| Invalid server configs: a skipped server and an earlier server of its name | a malformed server in a file is dropped before the merge, so it never replaces an earlier server of its name; upstream's `mit` does the same (06-RESEARCH) | **gap, fixed** in `556a44d`: "A skipped server does not replace a server with the same name from an earlier source, so that earlier server stays." |
| Invalid server configs: inline malformed server, and an absolute or escaping path, give `(unavailable) {malformed mcp}` | `mergeServerMap` and `locateReference` add a fatal note; the three refusal scenarios pin `malformed mcp` | holds |
| Upgrading: "A malformed server in a file source does not stop the move: the move treats that server as one that the plugin no longer declares" (06-08 inferred it) | 06-07's integration case "AMIG-01: /reload skips a malformed server in .mcp.json, moves its valid sibling, and removes the skipped one's old entry (D-CF6-02)" measures `hello no longer declares it.` with severity `info` | holds, now measured |
| Migration divergence: the move removes every server of a plugin whose inline config is not valid, or whose path is absolute or escaping | the same fatal notes make the migration's malformed arm remove every old entry (06-07 kept that case inline) | holds |
| Further reading: "the live test that runs this extension with pi-mcp-adapter 5.2.0" | `test/live-uat/mcp-adapter-canary.mjs` pins `ADAPTER_VERSION = "7.0.0"` (Phase 1); only its README's recorded result is from 5.2.0 | **wrong, fixed** in `822a1ac`: "runs this extension with pi-mcp-adapter 7.0.0. Its recorded result is from a run on pi-mcp-adapter 5.2.0." |

`docs/mcp-compatibility.md` is no build input (the `npm-check` hook skips it, and `format:check` does not glob `docs/`), so its commits ran pre-commit's mdformat and markdownlint and a manual `npx prettier --check`, which passed.

## Task Commits

1. **Task 1 (tracer): pass the phase gate on the combined tree**: `556a44d` (docs, the two Invalid server configs gaps), `822a1ac` (docs, the Further reading line), and the gate-evidence part of this SUMMARY
2. **Task 2: draft the D-CF6 decision records and the pi-subagents gap report**: SUMMARY sections, committed with this file
3. **Task 3: collect the parent lines**: SUMMARY sections, committed with this file

<!-- gsd:write-continue -->
