---
quick_id: 261109-cpo
phase: quick-261109-cpo
plan: 01
subsystem: load / resource discovery
tags: [state-schema, fail-closed, resources_discover, STMIG-02]
status: complete
requires: []
provides:
  - "aggregateDiscoveredResources leaves out a scope whose state.json loadState rejects"
affects:
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - features/plugin/state-migration.feature
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/discover.ts
    - test/orchestrators/discover.test.ts
    - test/index.test.ts
    - features/plugin/state-migration.feature
decisions:
  - "D-BG-705: a load that cannot read a scope's state.json, for any reason, stops offering that scope's skills and prompts; staged files stay; nothing is written"
  - "No typed UnsupportedStateSchemaError: under the widened rule no production code tells the refusals apart, so the class would be an export only tests read"
metrics:
  completed: 2026-11-09
actuals:
  tasks: 2
  commits: 1
plan_head_before: 9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c
plan_head_after: 6f908fd5354f822d56dab8356209e4a48b30aa2d
---

# Quick 261109-cpo: a load withholds the skills and prompts of a scope whose record it cannot read

`resources_discover` now reads each scope's `state.json` read-only (`loadState(..., { persistMigration: false })`) before it collects that scope's staged skills and prompts. When the read rejects, for a newer schema, a file that is not JSON, a record that fails validation, or a read error other than ENOENT, the scope contributes nothing. The staged files stay on disk, nothing is written, and the load's report is D-BG-703's.

## Commits

- `6f908fd5` fix(load): withhold an unreadable record's skills and prompts (4 files: `orchestrators/discover.ts`, `test/orchestrators/discover.test.ts`, `test/index.test.ts`, `features/plugin/state-migration.feature`)

Task 2 (PROJECT.md, CHANGELOG.md) made no commit: the coordinator amendment moved both files to `## Parent lines` below.

## Deviations from Plan

**1. [Coordinator amendment] The withdrawal covers any unreadable record, not only a newer schema.**
- The binding amendment widened the predicate. `isRecordReadable` in `orchestrators/discover.ts` returns false for any `loadState` rejection.
- The plan's "not valid JSON keeps its skills" case is inverted: it now asserts the scope is left out. A fourth case adds a record that fails schema validation.

**2. [Rule 2 / Simplicity] No `UnsupportedStateSchemaError` class, so `persistence/state-io.ts` and `test/persistence/state-io.test.ts` are unchanged.**
- Under the widened rule nothing in production reads the difference between the refusals. The class would be an export that only a test imports. `fallow dead-code` runs in production mode (`production.deadCode: true`), so it would report that export as unused.
- The plan's acceptance greps for `UnsupportedStateSchemaError` in `state-io.ts` and `discover.ts` therefore print 0. The grep for `persistMigration: false` in `discover.ts` prints 1.
- So Task 1's commit holds four files, not six.

**3. No corrupt-file scenario (the amendment said "if cheap").**
- A scenario needs a new `Given` step that writes a file that is not JSON, plus the load's measured results tables. Those tables carry the `JSON.parse` error text in the cause chain and the `plugin-path-skipped` reason. V8 words that error differently across Node majors, and CI runs Node 24 while this machine runs Node 26. Pinning it needs a new error token, so it is not cheap. The unit cases in `test/orchestrators/discover.test.ts` prove the corrupt and schema-invalid halves.

**4. The SUMMARY is in the executor scratchpad.**
- The worktree sandbox refuses writes outside the worktree, so this file could not be written to the primary checkout path. The coordinator copies it to `.planning/quick/261109-cpo-p7-dc-04-when-a-load-refuses-a-newer-state-json-schema-versi/261109-cpo-SUMMARY.md`.

**5. [Rule 1] `test/index.test.ts`: the aggregate-discovery-failure case needed a new trigger.**
- `contains one aggregate discovery failure and recovers through the same callback` made discovery fail by swapping the event's `cwd` for `${cwd}\0`. Now that cwd's `state.json` read rejects first (`ERR_INVALID_ARG_VALUE`), so discovery leaves the project scope out and never throws. The case still returned `EMPTY_DISCOVERY`, but the catch in `index.ts` (lines 246-248) went uncovered, and the title no longer held.
- Fix: the swapped cwd is now `<cwd>/looping-project`. It has no record, so it reads as the default state, and its `resources/skills` is a symlink to itself, so `readdir` fails with ELOOP. That is a hard failure, so `AggregateResourcesDiscoverError` reaches the catch again. The assertions are unchanged.

## RED record (observed locally, never committed)

Unit, `node --import test/platform/isolated-pi-home.ts --test test/orchestrators/discover.test.ts test/index.test.ts` at the base tree with the new tests: pass 50, fail 8.

- `load warnings share one {json,rpc} run and continue after append refusal {false,true}` (4 variants), `test/index.test.ts:1167`: actual `{ skillPaths: [], promptPaths: ['<tmp>/project/.pi/pi-claude-marketplace/resources/prompts/withheld.md'] }`, expected `{ skillPaths: [], promptPaths: [] }`.
- `D-BG-705: aggregateDiscoveredResources leaves out a user scope whose record has a newer schema`: actual held the user paths `.../home/.pi/agent/pi-claude-marketplace/resources/skills/alpha` and `.../prompts/alpha.md` in front of the project's `aardvark` paths.
- `... leaves out a project scope whose record has a newer schema`, `... whose record is not valid JSON`, `... whose record fails schema validation`: each returned both scopes' paths.

Cucumber, `npm run test:cucumber:profile -- --profile adapter features/plugin/state-migration.feature`: 11 scenarios (9 passed, 2 failed).

- `A load refuses a newer installation record, leaves it as it was, and offers none of its plugins' skills` (line 116), step `Then the session offers no skills`: actual `[{ command: '/skill:demo-skill', description: 'A skill of demo 1.0.0.' }]`, expected `[]`.
- `A load that refuses the user scope's newer installation record still offers the project scope's skills` (line 136), step `Then the session offers these skills:`: actual rows `/skill:demo-skill` and `/skill:helper-skill`, expected only `/skill:helper-skill`. Its results tables passed in that run, before the skills step.

## GREEN record

- `node --import test/platform/isolated-pi-home.ts --test test/orchestrators/discover.test.ts test/index.test.ts test/persistence/state-io.test.ts`: pass 136, fail 0.
- `CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/discover.ts`: `Direct coverage passed ... (branches 43/43, functions 8/8, lines 154/154)`, exit 0. `state-io.ts` did not change, so its pair was not rerun.
- `npm run check:features`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/state-migration.feature`: 11 scenarios (11 passed), 145 steps (145 passed). The file has 11 scenarios, not the 12 the plan counted: 10 at the base plus the new one.
- Commit hook (`npm run check:commit`): the first attempt failed with `Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 33/34, lines 331/334` (lines 246-248, the catch around `aggregateDiscoveredResources`). No commit was made; see deviation 5. After the fix, `CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts` reported `branches 35/35, functions 8/8, lines 334/334`, and the second commit's hook passed.

## Measured results tables of the new scenario

They equal the load scenario's tables:

```
| kind                      | severity | needs reload | summary                      | tally label | tally failures | tally warnings | reason                                                                                       | scope |
| reconcile-applied-cascade | error    | false        | Some operations have failed. | Reconcile   | 2              | 0              |                                                                                              |       |
| plugin-path-skipped       | warning  | false        |                              |             |                |                | state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version | user  |
| reconcile-applied-cascade | error    | false        | Some operations have failed. | Reconcile   | 2              | 0              |                                                                                              |       |
| plugin-path-skipped       | warning  | false        |                              |             |                |                | state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version | user  |

| marketplace name | marketplace scope | marketplace status | marketplace reasons | id                    | name       | status | reasons    | scope | cause chain                                                | cause truncated | leaks | rollback partial |
| state.json       | user              | failed             | unreadable          | state.json@state.json | state.json | failed | unreadable | user  | state.json at state.json has an unsupported schema version | false           |       |                  |
| state.json       | user              | failed             | unreadable          | state.json@state.json | state.json | failed | unreadable | user  | state.json at state.json has an unsupported schema version | false           |       |                  |
```

## Final `npm run check`

`npm run check` in the executor worktree `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-a66582bf85f9df309` at `6f908fd5`, Node v26.13.0: **exit 0**. Results: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed. Cucumber adapter: 1780 scenarios (1780 passed), 21504 steps. Cucumber builtin: 153 scenarios (153 passed), 2071 steps. The unpaired tests, the integration tests (pi-subagents included), and direct coverage for all pairs also passed.

## Dubious Choices

1. The withdrawal now covers every `loadState` rejection (the user's widening). That includes a read error other than ENOENT, such as EACCES or EISDIR on `state.json`. A missing `state.json` still reads as the empty default and keeps the scope's staged files offered, as before.
2. The load's report stays D-BG-703's. Claude Code names each plugin it does not load and says to update. For a corrupt record, the report and its `{unreadable}` row stay what the read pass gives today.
3. The scope's pi-mcp-adapter servers, agents, and saved workflows stay served (Pi capability gap, D-BG-705). The BACKLOG entry below carries the follow-up.
4. Observed, not changed: the agent grants step (`orchestrators/mcp/agent-grants-step.ts`) never reads `state.json`. At `session_start` it can still rewrite the generated agent files of a scope whose record this release cannot read.
5. No prompt-template scenario was added. The slash-command listing step needs a profile Pi that the feature's Background does not start, so the unit cases prove the prompt half.
6. No typed refusal class (deviation 2). If a later change needs to tell a newer record apart from a corrupt one, for example to say "update pi-claude-marketplace", that change adds the class with its first reader.
7. No corrupt-file scenario (deviation 3).

## Parent lines

### .planning/PROJECT.md

Insert right after the D-BG-704 row:

```markdown
| **D-BG-705 (behavioral-gaps, the user's decision of 2026-11-09 on P7-DC-04, amends D-BG-703 and the STMIG-02 load scenario): a load that cannot read a scope's state.json stops offering the scope's skills and prompts**: - A load (a start, `/reload`, or a new session) whose `loadState` rejects a scope's `state.json`, for any reason (a newer schema, a file that is not JSON, a record that fails validation, or a read error other than a missing file), leaves that scope out of Pi's resource discovery. Pi offers none of its staged skills or bridged commands, and the aliases, the command tool, and the SKILL.md read fill follow Pi's command list. The staged files stay, nothing is written, and the report is D-BG-703's. A missing `state.json` still reads as the empty default. - Hooks, the plugin `bin/` PATH entries, and the built-in MCP registrations of such a scope were already not offered, because each reads the record at every load. A built-in MCP server registered earlier in the same runtime keeps its registration until the next load (NFR-2). - The scope's pi-mcp-adapter servers, agents, and saved workflows stay served. Their companions read their own files, and Pi gives no load-time way to hide them. A load changes no installation state (APL-D1), and an older release does not rewrite what a newer one wrote. This is a divergence from Claude Code, licensed by a Pi capability gap, and BACKLOG `UNREADABLECOMPANIONS-01` carries the follow-up. - Claude Code 2.1.319 (the installed binary, read on 2026-11-09): a newer `installed_plugins.json` reads as an empty list marked unreadable, and every plugin change is refused. A plugin whose install cannot be checked is not loaded, but a path plugin of a local marketplace still loads in place. An unreadable `known_marketplaces.json` loads none of a plugin's components. This extension's `state.json` holds both registries, so it follows the second case. Upstream treats every unreadable registry the same way, and so does this rule. | The user asked for it in the P7-DC-04 review and widened it to every unreadable record: a release that cannot read a scope's record cannot tell which staged files belong to a recorded, enabled install, so it fails closed. Evidence: `.planning/quick/261109-cpo-p7-dc-04-when-a-load-refuses-a-newer-state-json-schema-versi/261109-cpo-PLAN.md`. | ✓ User decided |
```

In the D-BG-703 row, append `; amended by D-BG-705, which stops offering the scope's skills and prompts` to the bold heading's parenthetical, right after `see DUBIOUS-CHOICES.md`, and change its status cell from `-- Revisit` to `✓ Good`. Keep its body.

### CHANGELOG.md

Under `## [Unreleased]`, as a sub-bullet of the top bullet, after the sub-bullet that starts `A config that a load writes from the installation records`:

```markdown
  - A start or `/reload` that cannot read a scope's installation record, such as one a newer release wrote, no longer offers that scope's plugin skills and commands.
```

### .planning/BACKLOG.md

Append:

```markdown
## UNREADABLECOMPANIONS-01: should a scope whose installation record a load cannot read stop serving its MCP servers, agents, and saved workflows?

Noted 2026-11-09 (behavioral-gaps, P7-DC-04, D-BG-705). When a load cannot read a scope's `state.json`, it stops offering that scope's skills and prompts. Hooks, the plugin `bin/` PATH entries, and the built-in MCP registrations already stop. Three kinds are still served, because their companions read their own files: the pi-mcp-adapter servers in `<scopeRoot>/mcp-adapter.json` (and the legacy `mcp.json`), the agents in `<scopeRoot>/agents/`, read by pi-subagents, and the saved workflows, read by the workflow engine. Claude Code loads none of a plugin's components when its registries cannot be read. Withdrawing these kinds needs a write, which a load must not make (APL-D1), to files a newer release may own. It could also need a Pi or companion hook that hides them at load. The agent grants step (`orchestrators/mcp/agent-grants-step.ts`) also never reads `state.json`, so at `session_start` it can still rewrite the generated agent files of such a scope. Open question: is there a way to withdraw them that writes nothing, such as a companion-side filter, or should the grants step at least skip a scope whose record it cannot read?
```

### .planning/DUBIOUS-CHOICES.md

Mark P7-DC-04 resolved by D-BG-705 (widened by the user to any unreadable record), if the coordinator tracks resolutions there.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. One change to the plan's register: T-261109-cpo-03 (accept) assumed that only the newer-schema refusal withdraws. Under the widened rule, any unreadable record hides the scope's skills and prompts. That is the fail-closed behavior the user chose, not a new way in: hiding a scope's skills by this route needs write access to its `state.json`, and that access is enough to remove the skills anyway.

## Self-Check

PASSED. The four modified files are present in `6f908fd5`, and `git merge-base --is-ancestor 6f908fd5 HEAD` holds. `git rev-list --count 9a398226..HEAD` = 1. The worktree is clean.
