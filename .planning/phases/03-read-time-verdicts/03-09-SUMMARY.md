---
phase: 03-read-time-verdicts
plan: "09"
subsystem: mcp-server behavioral rows, merge of the milestone branch
tags: [merge, cucumber, read-time-verdicts, phase-gate]
status: complete
requires:
  - 03-05 (install consent view)
  - 03-06 (update consent and stored verdicts)
  - 03-07 (apply and pending verdicts)
  - 03-08 (requires line, D-P3-08)
provides:
  - merge of origin/features/mcp-builtin (Phases 5, 4, and 2) into the Phase 3 branch
  - read-time verdict rows that pass under both profiles on the combined tree
  - the phase's Parent lines
affects:
  - features/mcp-server/builtin-status.feature (Phase 2's file, requires cells)
  - features/mcp-server/invalid-configs.feature
tech-stack:
  added: []
  patterns: ["@adapter-only / @builtin-only pair for a proof whose step reads differently per implementation"]
key-files:
  created:
    - .planning/phases/03-read-time-verdicts/03-09-SUMMARY.md
  modified:
    - features/mcp-server/builtin-status.feature
    - features/mcp-server/verdict-info.feature
    - features/mcp-server/invalid-configs.feature
    - features/mcp-server/companion-missing.feature
    - test/orchestrators/plugin/install-outcome.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "invalid-configs: the two tool-call scenarios stay @adapter-only and gain @builtin-only twins that prove the skip through the frozen listing step, because that step lists no server under pi-mcp-adapter (D-P3-18)"
  - "companion-missing: a server with no MCP implementation stays status unknown; the milestone's not loaded applied to a scenario that ran with Pi's built-in MCP on"
metrics:
  duration: ~95 min
  completed: 2026-11-04
actuals:
  tokens: 9000
  tasks: 2
  commits: 173
plan_head_before: eb9258b635395d4b19eaa52f1fb6f1134035f785
plan_head_after: eb4ebf7067753d6caf8169f09b08b830d1a8011d
---

# Phase 3 Plan 09: Merge and Phase Gate Summary

Merged `origin/features/mcp-builtin` (hook tool names, agent grants, built-in materialization) into the Phase 3 branch with one merge commit, moved Phase 2's built-in status rows to the D-P3-08 `requires: mcp` entry, added built-in twins of the invalid-config skip proofs, and passed the whole phase gate on the combined tree.

`commits: 173` is `git rev-list --count eb9258b..HEAD`, which counts the 169 milestone commits the merge brought in. This plan made 4 first-parent commits (`git rev-list --count --first-parent eb9258b..HEAD`), listed below. `actuals.tokens` is chars/4 over this plan's own edits, not over the merged diff.

## Commits

| Commit | Title |
| --- | --- |
| 7d4246c | chore: merge the parallel component work |
| 7a2285a | test(mcp-server): expect read-time verdicts under the built-in status |
| 67d71f0 | docs(plugin): drop update-swap from the verdict read's import ban |
| eb4ebf7 | test(mcp-server): keep status unknown with no MCP implementation |

## Merged phases

`git fetch origin features/mcp-builtin` brought head `d1711fd`. `git log --merges --first-parent eb9258b..origin/features/mcp-builtin`:

| Phase | Merge commit | Present |
| --- | --- | --- |
| 5. Hook Tool Names | 03d4eef chore: merge the hook tool names phase | yes |
| 4. Agent Grants | ba6d4fa chore: merge the agent grants phase | yes |
| 2. Built-in Materialization | a29ce4a chore: merge the built-in materialization phase | yes |

Also merged, from the parent session on the milestone branch: `0bec3c2` (built-in async agent warning in the built-in twin of verdict-markers' "Update preserves dependency move warnings and MCP notices"), `e4eff85` (`features/lib/scenario-file.ts`, the shared scenario-owned file write), and `d1711fd` (companion-missing `not loaded`). No phase was absent, so nothing waits on a sibling.

`git merge-base --is-ancestor origin/features/mcp-builtin HEAD` exits 0.

## Merge resolution

| File | Conflict | Side taken |
| --- | --- | --- |
| .planning/ROADMAP.md | progress table | both: this branch's `3. Read-Time Verdicts 8/9 In Progress`, the milestone's rows for Phases 2 (9/9), 4 (6/6), and 5 (4/4) |
| .planning/STATE.md | frontmatter, Current focus, Current Position | both: this branch's Phase 3 position (plan 9 of 9, executing), the milestone's merge record and sibling progress (completed_phases 4); plan counts summed by hand (42 total, 41 complete) |
| features/mcp-server/companion-missing.feature | the "Plugin info names mcp as missing" info row | this branch's rows (`requires mcp`, D-P3-08). The merge first took the milestone's `not loaded` status cell; the gate showed that cell is wrong for this scenario (it turns Pi's built-in MCP off), and `eb4ebf7` restored `status unknown` |
| test/orchestrators/plugin/install-outcome.test.ts | none (compile) | auto-merged; the milestone's `installGrantedAgent` helper (Phase 4, MGRT-01) lacked the required `consentView` this branch added (D-P3-11). The merge passes `run.softDeps.mcpImplementation`, as a user-run install does |

Auto-merged without conflict, both sides' functions kept: `install-outcome.ts` (Phase 4's `agentsPhase` beside this branch's consent view), `update-swap.ts` (Phase 4's `prepareUpdateHandles` beside 03-06's verdict reads), `reconcile/load.ts`, `features/mcp-server/{project-scope,verdict-markers}.feature`, and the `info`, `install-outcome`, and `update-swap` unit tests (Phase 2's `info.test.ts` edit kept beside this branch's).

The merge changed no `package.json` or `package-lock.json`, so no `npm ci` was needed.

## Merged deletions

None. `git diff --name-only --diff-filter=D eb9258b HEAD` prints nothing.

## Rows changed on the combined tree

- **features/mcp-server/builtin-status.feature (Phase 2's file):** all seven `plugin requires` cells read `[{"companion":"mcp","missing":false}]` (was `[{"companion":"pi-mcp-adapter","missing":true}]`). Every server there (the stdio stub, the stdio `pi-cm-no-such-program` servers, and the http server with an unset port) runs under both implementations, and the profile is `@builtin-only`, so Pi's built-in MCP is loaded (D-P3-08). The eighth scenario has no requires cell.
- **features/mcp-server/verdict-info.feature (this phase's):** the `@builtin-only` "Plugin info shows an sse server as left out" row reads the stub server as `not loaded`, as Phase 2's built-in status reader reports it, instead of `status unknown`.
- **features/mcp-server/project-scope.feature (Phase 2's file):** its one `plugin requires` cell (line 196, `@adapter-only` "Plugin info shows a blocked project-scope server as pending approval") already read `[{"companion":"mcp","missing":false}]` after 03-08 and passes; the merged `@builtin-only` twins run no `info`, so they carry no requires cell. `grep -c '"companion":"mcp"'` prints 1.
- **features/mcp-server/verdict-markers.feature:** the parent's `0bec3c2` wording ("a launch before Pi's built-in MCP has listed the server's tools still fails") auto-merged into the built-in twin and passes under the builtin profile; no edit needed.
- **features/mcp-server/companion-missing.feature:** the parent's `d1711fd` `not loaded` is NOT re-applied. On the milestone the scenario ran with Pi's built-in MCP on; this branch's version turns it off ("names mcp as missing with no MCP implementation"), so no implementation reports a status and the cell is `status unknown`.
- **features/mcp-server/invalid-configs.feature (D-P3-18):** Phase 2 is merged, but the frozen step `Then pi lists these registered mcp servers:` lists no server under pi-mcp-adapter (implementation-profiles.feature's adapter scenario expects an empty table), so one `@mcp` table cannot hold under both profiles. The two tool-call scenarios keep `@adapter-only` (their ID, D-CF6-02, is in the feature description) and each gains a `@builtin-only` twin, titled with D-P3-18, that proves the skip through the frozen listing step: `plugin_demo_ok` alone for the malformed `.mcp.json` server, and `plugin_demo_good` alone for each of the four broken-file examples. The step module is unchanged.

## Gate results

Each command ran with `npm_config_script_shell=.../nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, in sequence, on HEAD `67d71f0` unless noted. The only later commit, `eb4ebf7`, changes one `@own-implementation` cell; its commit hook ran `check:commit` (check:static, test:unpaired) and passed, and the shard that runs that file was re-run on `eb4ebf7`.

| Command | Exit | Duration | Seed | Result |
| --- | --- | --- | --- | --- |
| `npm run check:static` | 0 | 9 s | - | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features |
| `npm run test:unpaired` | 0 | 21 s | - | pass |
| `npm run test:integration` | 0 | 32 s | - | pass |
| `test:cucumber:profile -- --profile adapter features/marketplace features/plugin` | 0 | 136 s | 683879 | 1168 scenarios passed |
| `test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` | 1 | 247 s | 839197 | 430/431; companion-missing.feature:117 (the merge's `not loaded` cell), fixed in `eb4ebf7` |
| same shard, re-run on `eb4ebf7` | 0 | 242 s | 673926 | 431 scenarios passed |
| `test:cucumber:profile -- --profile builtin features` | 0 | 67 s | 268889 | 128 scenarios passed |
| `npm run test:coverage:direct:all` | 0 | 169 s | - | 350 LCOV records, every pair at 100% |
| `npm run test:modules` (whole unit suite) | 0 | 157 s | - | pass |
| `npm run test:e2e` (pinned) | 1 | 14 s | - | 29/33; the 4 `peer floor` cases of `test/e2e/pi-json-output.test.ts` failed with "Missing peer floor": this checkout lacked `test/e2e/pi-peer-floor/node_modules` |
| `npm run test:e2e` (pinned), on `eb4ebf7`, after `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` (CI's own step, ci.yml line 210) | 0 | 13 s | - | 33 passed |

Task 1 runs before the row fixes: builtin `features/mcp-server features/marketplace/update.feature`, seed 307451, 85/93 (the seven builtin-status requires cells and the verdict-info status cell). After the fixes: builtin `invalid-configs`, `builtin-status`, `verdict-info`, seed 233995, 21/21. No known flake fired, so no flake rerun was needed.

Frozen-file check: `git log --no-merges --name-only --format= HEAD ^origin/features/mcp-builtin ^63747d7` lists 142 paths; the frozen-path pattern from the plan matches 0 of them.

## Frozen exports consumed

`npx fallow dead-code --trace <file>:<export>` for each `ignoreExports` name in `.fallowrc.json`:

| Module | Export | Production consumers |
| --- | --- | --- |
| domain/mcp-implementation.ts | ActiveMcpImplementation | 16 files (bridges/agents/types.ts, plugin-resolver.ts, fetch, info, install-outcome, list-*, mcp-verdict-read, update-*, reconcile/*) |
| domain/mcp-implementation.ts | EffectiveMcpCompatibility | mcp-verdict-read.ts, reconcile/convergence.ts |
| domain/mcp-implementation.ts | effectiveMcpCompatibility | plugin-resolver.ts, mcp-verdict-read.ts, reconcile/mcp-migration.ts |
| domain/mcp-implementation.ts | StoredMcpCompatibility | none |
| orchestrators/mcp/recorded-servers.ts | LegacyServersReader | mcp-verdict-read.ts |
| orchestrators/mcp/recorded-servers.ts | LegacyServersSource | mcp-verdict-read.ts |
| orchestrators/mcp/recorded-servers.ts | createLegacyServersReader | mcp/builtin-registration-step.ts, mcp-verdict-read.ts |
| orchestrators/mcp/recorded-servers.ts | recordedMcpServers | mcp/builtin-registration-step.ts, mcp-verdict-read.ts |
| orchestrators/mcp/recorded-servers.ts | LegacyServers | none |
| orchestrators/mcp/recorded-servers.ts | LegacyServersUnreadableError | none |
| orchestrators/mcp/recorded-servers.ts | LegacyServersUnreadableReason | none |

## Parent lines

One entry per file, each with the exact change.

### CHANGELOG.md (D-P3-21, MREC-07)

Under the next release's MCP built-in section:

- "`/claude:plugin install` and `list` show `{requires mcp}` when either MCP implementation would run every server of a plugin and none is loaded, and `{requires builtin mcp}` when only Pi's built-in MCP would; `{requires pi-mcp-adapter}` now shows only when only pi-mcp-adapter would run them all."
- "A plugin's available or partially available state, its MCP server verdicts, and `--partial` consent follow the MCP implementation Pi runs now (pi-mcp-adapter, Pi's built-in MCP, or none), so switching needs no reinstall. `list`, `info`, and `fetch` show the state for that implementation; `info` shows each server as written or left out, with the feature that blocks it."
- "`install` asks for `--partial` only for an MCP server the implementation Pi runs cannot run: an sse server under Pi's built-in MCP, or one that needs an elicitation handler under pi-mcp-adapter. With no MCP implementation, only servers neither can run need it. `update` asks only when the active implementation would leave out a server of the new version, and `enable` and `apply` never ask again after a switch; `pending` previews `(will partially install)` only where the active implementation cannot run a server."
- "`info`'s `requires:` line names the MCP implementation that runs every server (`mcp`, `pi-mcp-adapter`, or `builtin mcp`), tagged `(missing)` when the active one cannot run them all. `info --json` now reports `{\"companion\":\"mcp\"}` where it reported `pi-mcp-adapter` for most plugins."

### docs/json-output.md

- Line 723 (`requires`): replace "Companion extensions the resolved components need, sorted by name." with "Companions (extensions or MCP implementations) the resolved components need, sorted by name. The MCP entry names `mcp` (either implementation runs every server), `pi-mcp-adapter`, or `builtin mcp`."
- Line 766 (`companion`): replace "Companion extension that a component needs." with "Companion extension or MCP implementation that a component needs: `pi-subagents`, `pi-dynamic-workflows`, `mcp`, `pi-mcp-adapter`, or `builtin mcp`."

### docs/output-catalog.md

- Line 69: replace "The soft-dep markers `requires pi-subagents`, `requires pi-mcp-adapter` and `requires pi-dynamic-workflows`" with "The soft-dep markers `requires pi-subagents`, the three MCP markers `requires mcp`, `requires pi-mcp-adapter`, and `requires builtin mcp`, and `requires pi-dynamic-workflows`", and add after the marker-order sentence: "The MCP marker follows the active implementation and the row's `runEvery` (D-MB-07): no marker when the active implementation runs every server, otherwise the marker of the implementation that would. A `partially-installed` list row that an implementation outside `runEvery` blocks carries it beside `{unsupported mcp}`."
- Line 3041: replace "Agents need `pi-subagents`, MCP servers need `pi-mcp-adapter`, and workflows need `pi-dynamic-workflows`." with "Agents need `pi-subagents`, MCP servers need the implementation that runs every server (`mcp` for either, `pi-mcp-adapter`, or `builtin mcp`), and workflows need `pi-dynamic-workflows`."; replace "The companions are sorted by package name" with "The companions are sorted by name (so `builtin mcp` and `mcp` come before the `pi-` names)"; replace "A companion that the soft-dependency probe does not find loaded carries a `(missing)` tag after its name." with "A companion that the soft-dependency probe does not find loaded carries a `(missing)` tag after its name; the MCP entry carries it exactly when the row's D-MB-07 marker would show. A plugin whose every server both implementations block gets no MCP entry."
- Line 3161: replace the example prose "pi-mcp-adapter runs its MCP servers. The `requires:` line names both, sorted by package name. The probe finds pi-subagents loaded but does not find pi-mcp-adapter, so only pi-mcp-adapter carries the `(missing)` tag. Pi's built-in MCP client does not count as pi-mcp-adapter." with "either MCP implementation runs its stdio `github` server, so the line names `mcp`. The `requires:` line names both, sorted by name. The probe finds pi-subagents loaded and finds no MCP implementation, so only `mcp` carries the `(missing)` tag.", and the rendered example line from `requires: pi-mcp-adapter (missing), pi-subagents` to `requires: mcp (missing), pi-subagents`. Catalog counters stay 324 states and 54652 bytes unless the example block is a counted fixture; re-run `test:unpaired` after the change.
- Lines 3176-3188 (`installed-with-every-companion`): the prose "lists them in package-name order: pi-dynamic-workflows, pi-mcp-adapter, pi-subagents. The probe finds pi-subagents and pi-mcp-adapter loaded" becomes "lists them in name order: mcp, pi-dynamic-workflows, pi-subagents. The probe finds pi-subagents and an MCP implementation loaded", and the rendered line `requires: pi-dynamic-workflows (missing), pi-mcp-adapter, pi-subagents` becomes `requires: mcp, pi-dynamic-workflows (missing), pi-subagents`.
- The catalog blocks are byte contracts against `test/architecture/catalog-uat/fixtures/plugin-info.ts`, which builds `requires` literals by hand (`{ companion: "pi-mcp-adapter", ... }` at lines 86, 115, and 533-711). Any block above that changes needs the matching fixture literal changed to `"mcp"` in the same commit, then `npm run test:unpaired`.
- The install refusal and install/enable/update rows of an MCP plugin follow the active implementation (03-05, 03-06): any prose there that says "pi-mcp-adapter cannot run" reads "the active MCP implementation cannot run".

### README.md and README.es.md

- README.md line 144: replace "an MCP server that uses a feature pi-mcp-adapter cannot run" with "an MCP server that the MCP implementation Pi runs cannot run (pi-mcp-adapter or Pi's built-in MCP)".
- README.es.md line 144: replace "un servidor MCP que usa una función que pi-mcp-adapter no puede ejecutar" with "un servidor MCP que la implementación de MCP que ejecuta Pi no puede ejecutar (pi-mcp-adapter o el MCP integrado de Pi)".

### .fallowrc.json

- In `ignoreExports` for `extensions/pi-claude-marketplace/domain/mcp-implementation.ts`, remove `ActiveMcpImplementation`, `EffectiveMcpCompatibility`, and `effectiveMcpCompatibility`; keep `StoredMcpCompatibility`.
- In `ignoreExports` for `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`, remove `LegacyServersReader`, `LegacyServersSource`, `createLegacyServersReader`, and `recordedMcpServers`; keep `LegacyServers`, `LegacyServersUnreadableError`, and `LegacyServersUnreadableReason`.
- Both `entry` lines stay: each module still has an unconsumed name.

### extensions/pi-claude-marketplace/edge/register.ts and shared/completion-cache.ts (P3-DC-22)

- `edge/register.ts` (frozen) passes the run's active MCP implementation to the completion resolver, and `shared/completion-cache.ts` keys its plugin index by it, so `update --partial` and `install --partial` completions follow the active implementation instead of the implementation-neutral view.

### .planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md

- Interface 3: "An install writes a new record without the basis" becomes "An install writes `compatibilityBasis: \"neutral\"`" (D-P3-02).

### orchestrators/types.ts and reconcile/apply.ts (03-06 candidate)

- 03-06 listed carrying `mcpImplementation: run.softDeps.mcpImplementation` through `PluginConvergeTarget` and `runStep`; plan 03-07 landed that change (`1178bd7 fix(apply): judge catalog moves under the run's MCP implementation`), so the parent needs no edit. Listed for the record.

### Already done by this plan

- `orchestrators/plugin/mcp-verdict-read.ts` header: `update-swap.ts` dropped from the import ban (`67d71f0`).

## Combined-tree findings

- The milestone's Phase 4 helper `installGrantedAgent` in `test/orchestrators/plugin/install-outcome.test.ts` did not compile against this branch's required `consentView` (D-P3-11). Fixed inside the merge commit; the parent should know the two phases touched the same options type.
- `npm run test:e2e` needs `test/e2e/pi-peer-floor/node_modules`, which CI installs (ci.yml line 210) and a fresh local checkout lacks. Not a code failure; the gate passed once the CI step ran.
- No sibling row failed for a reason outside Phase 3's rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merge did not compile**
- **Found during:** Task 1 (merge commit hook, typecheck)
- **Issue:** the milestone's `installGrantedAgent` test helper calls `runInstallLedger` without the `consentView` option this branch made required.
- **Fix:** pass `consentView: run.softDeps.mcpImplementation`.
- **Files modified:** test/orchestrators/plugin/install-outcome.test.ts
- **Commit:** 7d4246c (the merge)

**2. [Rule 1 - Bug] Wrong side taken for one companion-missing cell**
- **Found during:** Task 2 (adapter shard 2, seed 839197)
- **Issue:** the merge resolution took the milestone's `not loaded` status cell, but this branch's scenario turns Pi's built-in MCP off.
- **Fix:** restored `status unknown`.
- **Files modified:** features/mcp-server/companion-missing.feature
- **Commit:** eb4ebf7

**3. [Rule 1 - Bug] Phase 2's built-in status rows predate D-P3-08**
- **Found during:** Task 1 (builtin run, seed 307451)
- **Fix:** seven requires cells to `mcp`, not missing; one verdict-info status cell to `not loaded`.
- **Files modified:** features/mcp-server/builtin-status.feature, features/mcp-server/verdict-info.feature
- **Commit:** 7a2285a

**4. [Plan branch choice] invalid-configs twins instead of `@mcp`**
- The plan's `@mcp` branch needs one listing table under both profiles, which the frozen step cannot give (empty under pi-mcp-adapter). The plan's fallback keeps `@adapter-only`; this plan kept it and also added `@builtin-only` twins so the built-in skip is proved, following the cucumber rule that an expectation that differs by implementation is a pair.
- **Commit:** 7a2285a

**5. Out of plan files:** `test/orchestrators/plugin/install-outcome.test.ts`, `features/mcp-server/{builtin-status,verdict-info,companion-missing}.feature`, and `orchestrators/plugin/mcp-verdict-read.ts` (header comment, requested by the orchestrator) are outside `files_modified`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The merge took no frozen file and dropped no sibling change in `bridges/**` (no conflict there; the whole gate ran on the merged tree).

## Dubious Choices

| Choice | Alternatives | Why dubious | Severity |
| --- | --- | --- | --- |
| Commit trailers use `Claude-Session: .../session_01EDUMG5p4jHecGXqAFGi3Do`, this executor's session per the harness attribution | The plan's `session_01EDUMG7S9uXh4o5dikBwum8` | The plan says "exactly" the other ID; the harness attribution for this agent names its own session | low |
| invalid-configs keeps `@adapter-only` and adds `@builtin-only` twins | Make the scenarios `@mcp` with a profile-neutral step; keep only `@adapter-only` and record a wait | D-P3-18 asked for `@mcp`; the twins prove the same skip but double the rows | low |
| STATE.md frontmatter counters combined by hand (42 total plans, 41 complete, percent 33 kept from the milestone) | Take one side's counters verbatim | The percent does not match the plan counts; the orchestrator recomputes them | low |
| The merge commit body says companion-missing took the milestone's `not loaded` cell, which `eb4ebf7` reverted | None without rewriting history | The merge message is now partly inaccurate | low |
| The milestone's test helper passes `run.softDeps.mcpImplementation` as the consent view | `"none"` | A user-run install passes the run's implementation, so this matches production, but the helper is Phase 4's | low |
| Most gate commands ran on `67d71f0`, not the final `eb4ebf7` | Re-run the whole gate | `eb4ebf7` changes one `@own-implementation` cell; its shard and static checks were re-run; the orchestrator re-runs the gate | low |

## Self-Check: PASSED

- FOUND: .planning/phases/03-read-time-verdicts/03-09-SUMMARY.md
- FOUND: 7d4246c, 7a2285a, 67d71f0, eb4ebf7 (all ancestors of HEAD)
