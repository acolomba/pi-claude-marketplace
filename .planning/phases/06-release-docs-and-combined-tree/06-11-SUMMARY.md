---
phase: 06-release-docs-and-combined-tree
plan: "11"
subsystem: docs
tags: [codebase-map, fallow, cucumber-skill, mcp-builtin]

requires:
  - phase: 06-release-docs-and-combined-tree
    provides: "06-03 (stamped completion cache, profile-aware completion steps), 06-04 (features/lib/upstream/tool-search.ts), 06-05 (bounded stand-in wait), 06-08 (.fallowrc.json with one entry and no ignoreExports)"
provides:
  - "CONVENTIONS, STACK, and ARCHITECTURE state the one fallow entry and no export exemptions; the frozen-export rule stays as a rule"
  - "CONVENTIONS states the measured 45 fallow-ignore markers with a by-kind breakdown"
  - "ARCHITECTURE and STRUCTURE name every product module the milestone added, the orchestrators/mcp session steps, the grants rewrite and child gates, the hook tool view, and the stamped completion cache"
  - "STACK and CONVENTIONS describe npm run check and CI with both cucumber profiles"
  - "the cucumber skill notes the config probe, the profile-aware hook call step, the hook MCP tool server, the tool_search projection, the bounded stand-in wait, and profile-classified completions"
affects: [06-12 gate, 06-13 records, later sessions that read .planning/codebase]

actuals:
  tokens: 20345
  tasks: 3
  commits: 3
plan_head_before: f8d1141bde8373586cc67e0e22ef24c04c4d6208
plan_head_after: 9ab4c429f0fde0f5d8a7a5fc7a6b0f95716b284f

tech-stack:
  added: []
  patterns:
    - "Map counts are measured from the tree with the command the map names, never copied from a plan"

key-files:
  created: []
  modified:
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STRUCTURE.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/cucumber/rules/layout.md

key-decisions:
  - "The verdict-read sentence lists the modules that import mcp-verdict-read.ts, not every MCP read"
  - "Phase-number references in the frozen-export bullet were replaced by D-P6-08 and D-P6-21"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Maps state the fallow entry, the absent ignoreExports, and the measured fallow-ignore count (45)"
    verification:
      - kind: other
        ref: "Task 1 <automated>: n=$(rg -n fallow-ignore extensions features test scripts | wc -l) compared with CONVENTIONS.md; STACK dead-code bullet has no mcp-implementation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Maps describe the milestone's modules, session steps, gates, and both cucumber profiles in check and CI"
    verification:
      - kind: other
        ref: "Task 2 <automated> greps (orchestrators/mcp/, subagent-child, mcp-tool-view, PI_SUBAGENT_CHILD, unbound-method) plus per-module grep counts and behavioral in STACK"
        status: pass
    human_judgment: true
    rationale: "Greps prove the names are present; whether each one-clause description is accurate needs a reader"
  - id: D3
    description: "Cucumber skill carries the Phase 2 and Phase 5 harness notes"
    verification:
      - kind: other
        ref: "Task 3 <automated> greps and P5-DC-14 / D-P6-22 counts; pre-commit mdformat and markdownlint passed"
        status: pass
    human_judgment: true
    rationale: "Skill prose accuracy and Plain-mode wording need a reader"

duration: 8min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 11: Codebase maps and cucumber skill for the combined tree Summary

**The four codebase maps now state one fallow entry and 45 measured suppressions, map the `orchestrators/mcp/` session steps and all 22 product modules the milestone added, and the cucumber skill names the config probe, the hook MCP tool server, the tool_search projection, and the profile-aware exceptions.**

## Performance

- **Duration:** about 8 min of editing after the context reads (02:11Z to 02:19Z)
- **Started:** 2026-11-05T02:11:12Z
- **Completed:** 2026-11-05T02:19:27Z
- **Tasks:** 3 of 3
- **Files modified:** 6

## Accomplishments

- CONVENTIONS.md: the `entry` list names only `extensions/pi-claude-marketplace/index.ts` and says there is no `ignoreExports` key. The frozen-export bullet keeps its rule, and the Phase 1 inventory is replaced by "none remain" (D-P6-08, D-P6-21). The suppression count is the measured 45: 7 unused-file, 7 unused-export (with the five harness extensions, `mcp-builtin-config-probe/extension` included), 5 private-type-leak, 1 unused-type (`async-rewake/registry.ts`), 25 code-duplication. `ThinkingLevel` and `InputSource` are gone.
- STACK.md and ARCHITECTURE.md name the one entry.
- ARCHITECTURE.md: the new modules in the orchestrators, bridges, domain, and platform layers; the MCP session steps (registration then grants at `session_start`, the resync after `loadReconcile`, NFR-2); the verdict-read path and the legacy reader's clone-root check (UF-1); the hook tool view per bridge generation; the grants rewrite under the state lock (D-MB-03 amends APL-D1) and the child gates (D-MB-12) in the load flow, with the resync as a new step 3; the stamped completion cache and per-lookup implementation (D-P6-22).
- STRUCTURE.md: the new files in each layer's list, `orchestrators/mcp/*.ts`, and a `features/` entry that names `lib/upstream/tool-search.ts`.
- CONVENTIONS.md: the hook tool view injection (P5-DC-19) and the three reasoned `unbound-method` disables. `npm run check` now lists `test:cucumber` and `check:features`.
- STACK.md: `PI_SUBAGENT_CHILD=1` on the pi-subagents bullet, `test:cucumber` in "Check Output", and the `behavioral` job with its three legs and 15-minute timeout.
- Cucumber skill: the config probe (P2-DC-24), the profile-aware hook call step exception (P5-DC-14), the hook MCP tool server and its `mcp.json` step, the `upstream/tool-search.ts` projection and its step, the 10-second stand-in wait at restart and reset, the completion classification (D-P6-22), and the layout hooks paragraph.

## Task Commits

1. **Task 1 (tracer): fallow entry and suppressions** - `d6157b2` (docs). Tracer gate: end-of-phase mode with an automated-only `<verify>`. The verify was re-run after the commit and passed, so expansion went ahead.
2. **Task 2: built-in MCP modules and steps** - `0ca5ee6` (docs)
3. **Task 3: cucumber harness notes** - `9ab4c42` (docs)

## Owned parent lines and their outcome

| Parent line | Outcome | Commit |
|-------------|---------|--------|
| 01-14 "Phase 6, fallow" (maps half) | Applied: one entry in CONVENTIONS, STACK, ARCHITECTURE | `d6157b2` |
| 01-14 "ARCHITECTURE.md and STRUCTURE.md" | Applied: `orchestrators/mcp/`, the domain modules, `platform/mcp-builtin-status.ts` | `0ca5ee6` |
| 02-01 line 5 (three `unbound-method` disables) | Applied in CONVENTIONS lint notes | `0ca5ee6` |
| 02-01 line 3 / 02-08 item 12 (`features/lib/upstream/`, P2-DC-18), doc half | Applied: STRUCTURE `features/` entry and the skill's upstream notes | `0ca5ee6`, `9ab4c42` |
| 02-03 lines 1-2 (count 45, config probe) | Applied | `d6157b2`, `9ab4c42` |
| 02-08 items 13-14 | Applied | `d6157b2`, `0ca5ee6`, `9ab4c42` |
| 02-08 item 16 (stand-in wait), skill half | Applied: restart and reset text name the bounded wait | `9ab4c42` |
| 04-06 item 9 / P4-DC-40 | Applied: platform, bridges, load flow, STACK pi-subagents | `0ca5ee6` |
| 05-04 item 3 (skill texts) | Applied, adapted to the file's style | `9ab4c42` |
| 05-04 item 6 (STRUCTURE, ARCHITECTURE, CONVENTIONS) | Applied | `0ca5ee6` |
| D-P6-21 count line | Applied: measured 45 | `d6157b2` |
| D-P6-15 | Applied across the three commits | all three |
| D-P6-22 (map and skill text) | Applied | `0ca5ee6`, `9ab4c42` |

## Files Created/Modified

- `.planning/codebase/CONVENTIONS.md` - fallow entry, frozen-export rule, suppression count, DI example, lint note, check chain
- `.planning/codebase/STACK.md` - dead-code entry, pi-subagents child marker, check output, behavioral CI job
- `.planning/codebase/ARCHITECTURE.md` - entry, layer modules, MCP session steps, verdict reads, hook tool view, load flow, completion cache, entry points
- `.planning/codebase/STRUCTURE.md` - layout, new files per layer, `features/` entry
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - harness notes
- `.agents/skills/cucumber/rules/layout.md` - hooks paragraph

## Decisions Made

See key-decisions and the Dubious Choices below.

## Deviations from Plan

None in scope. Two small accuracy fixes beyond the named lines are recorded as P6-DC-1101 and P6-DC-1105.

## Issues Encountered

- The worktree guard refused compound shell commands that named git, so the plan ledger file under the git dir was not written. `plan_head_before` is the dispatch base f8d1141 (P6-DC-1109).

## Checks

| Command | Exit | Commit |
|---------|------|--------|
| Task 1 `<automated>` (measured count vs CONVENTIONS, STACK dead-code bullet) | 0 | `d6157b2` tree |
| Task 1 acceptance (`ThinkingLevel` 0, `mcp-builtin-config-probe` 1, ARCHITECTURE has no `orchestrators/mcp/recorded-servers.ts` in the entry bullet) | pass | `d6157b2` |
| `pre-commit run --files` (3 maps), `SKIP=npm-check` | 0, no Failed | `d6157b2` |
| Task 2 `<automated>` five greps | 0 | `0ca5ee6` tree |
| Task 2 acceptance (each of 22 modules counted at least 2 in ARCHITECTURE+STRUCTURE; `behavioral` in STACK 1) | pass | `0ca5ee6` |
| `pre-commit run --files` (4 maps) | 0, no Failed | `0ca5ee6` |
| `pre-commit run --files` (2 skill files): mdformat, markdownlint-cli2 passed | 0 | `9ab4c42` |
| Task 3 `<automated>` four greps; `P5-DC-14` 1, `D-P6-22` 1 | 0 | `9ab4c42` |
| commit hooks (gitlint and fixers) on each commit | passed | all three |

`npm run check` was not run: no file is a build input, and the plan leaves the gate to 06-12.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

**P6-DC-1101 (Low).** CONVENTIONS.md's `npm run check` line now also lists `test:cucumber` and `check:features` (which `check:static` runs today). The plan named only STACK.md's "Check Output" for the cucumber change. Alternative: leave CONVENTIONS' line stale. Chosen because the plan's truth says the maps state `npm run check` as it runs both profiles, and the same line was wrong about `check:features`.

**P6-DC-1102 (Low).** The plan's text said "every effective MCP verdict read goes through `mcp-verdict-read.ts`". ARCHITECTURE.md scopes it to a record's verdict and lists the modules that import it (list, info, install, update, dependency moves, convergence, edge-deps installed rows). The AMIG-01 move and completion do not import it, so they are not named. Alternative: the plan's wording, which overclaims.

**P6-DC-1103 (Low).** STRUCTURE.md gains one `features/` line in the layout and a short "Special Directories" entry, not a full tree of `features/`. Alternative: a full directory listing, which `/gsd-map-codebase` would own (D-P6-15 forbids re-running it).

**P6-DC-1104 (Low).** The skill states the stand-in wait as "up to 10 seconds" and names `STAND_IN_EXIT_TIMEOUT_MS`. The number rots if the constant changes. Alternative: name only the constant. Chosen because a reader needs the bound, and the constant name points to the source. Both call sites (restart and release) use `assertStandInsStopped`, so the reset sentence says "the same 10-second wait".

**P6-DC-1105 (Low).** The code-duplication breakdown now says the agents-and-commands pair is marked in `bridges/agents/stage.ts` only, and the commands-and-skills pair has four markers (one in `commands/stage.ts`, two in `skills/stage.ts`, one in `skills/unstage.ts`). The old text placed an agents-and-commands marker in `commands/stage.ts`, but that file's one marker carries the commands-and-skills reason. Read from the marker reasons, not from fallow group output.

**P6-DC-1106 (Low).** The frozen-export bullet's "(for mcp-builtin, Phase 6)" and "At the end of Phase 1" were replaced by D-P6-08 and D-P6-21, following the durable-ID rule. Alternative: keep the phase words that the maps used before.

**P6-DC-1107 (Low).** STACK.md's pi-subagents bullet adds "and there the load and the agent grants step change no installation state" to 04-06 item 9's drafted text. It summarizes D-MB-12. Alternative: the drafted text alone.

**P6-DC-1108 (Low).** The ARCHITECTURE.md load flow puts the resync as a new numbered step 3 and renumbers the next two. The grants step runs at `session_start`, not `resources_discover`, so it is described in the flow's intro as an amendment of APL-D1 rather than as a numbered step. Alternative: a separate "Session-Start MCP Steps" subsection. The orchestrators layer carries a "MCP session steps" bullet instead.

**P6-DC-1109 (Low).** The worktree guard refused the compound command that writes the plan ledger under the git dir, so `plan_head_before` is the dispatch base f8d1141, and `commits: 3` is `git log --oneline f8d1141..HEAD` before the SUMMARY commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-12 can run the gate. These files are not build inputs.
- 06-09 removes `SoftDepStatus.piMcpAdapterLoaded` in parallel. The maps never named it and describe the snapshot by `mcpImplementation` only.
- No blockers.

## Self-Check: PASSED

- FOUND: all six modified files
- FOUND: d6157b2, 0ca5ee6, 9ab4c42 on HEAD
