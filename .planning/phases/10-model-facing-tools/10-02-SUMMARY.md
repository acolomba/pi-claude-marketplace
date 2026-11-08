---
phase: 10-model-facing-tools
plan: 02
subsystem: features (model-facing tools)
tags: [cucumber, scripted-model, tools, red-proofs]
status: complete
requires:
  - 10-01
provides:
  - eleven scenarios in features/plugin/model-tools.feature that pin TOOL-01, TOOL-02, and TOOL-03 through the scripted model
affects: []
key-files:
  created: []
  modified:
    - features/plugin/model-tools.feature
decisions:
  - The scenarios run over one two-scope Background, the list-filters fixture with `lima` added to `extras` (P10-DC-11).
  - Each red proof ran once, not twice, on a machine at load 100+ (P10-DC-21).
metrics:
  completed: 2026-11-08
  tasks: 3
  files: 1
plan_head_before: 6c138a67
plan_head_after: 8d6714a1
---

# Plan 10-02 Summary: model-tool scenarios

Plan 10-02 rewrote `features/plugin/model-tools.feature`. It now has a two-scope
Background and eleven scenarios. Pi calls both tools for real through the scripted
model, and each scenario reads the whole result text that the model receives in its
next call. The plan ran inline in the orchestrating session (P10-DC-18), not in an
executor agent.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | 445272d9 | test(features): pin the scope of the marketplace list tool |
| 2 | a3c605bc | test(features): pin plugin list statuses, filters, and errors |
| 3 | 8d6714a1 | test(features): show that the model tools change nothing |

Each commit names only the feature file. Its hook ran `npm run check:commit`, which passed. `git diff --quiet -- extensions` exited 0 before every commit, so no planted or restored version of `tools.ts` was committed.

## Green runs

- Task 1: `npx cucumber-js features/plugin/model-tools.feature --parallel 3` gave 4 scenarios, 100 steps, all passed.
- Task 2: 10 scenarios, 250 steps, all passed. This run confirmed assumption A2: under the `unavailable` filter, the user block reads `(no plugins)`.
- Task 3 (`--parallel 2`): 11 scenarios, 281 steps, all passed. This run confirmed assumption A3: the call with every filter returns the whole `tools (project)` block.

## Red proofs

Natural reds restore `tools.ts` from `cdcc22df` (sha256 `61128bcd…2563`) and then `git checkout --` the file. Planted reds edit `tools.ts`, run, and restore it the same way. Each proof ran once (P10-DC-21). Exit code 1 means cucumber failed, and an exit-1 cell lists the first failing step.

| Scenario | Proof | Failing step and actual text | Exit |
| --- | --- | --- | --- |
| The model reads the marketplaces the list tool returns | planted P-LIST-SCOPE (`scope: "user"` always passed to the loader) | calls table: the result was `[user] extras -- 1 plugin(s) -- …` only, with the project line missing | 1 |
| A list call with a scope returns only the marketplaces of that scope | natural | calls table: both calls `returned:` both lines | 1 |
| A list call with a scope the tool does not accept reaches the model as invalid arguments | natural | calls table: the call `returned:` both lines instead of `failed: invalid arguments: scope` | 1 |
| A plugin list call with a scope the tool does not accept reaches the model as invalid arguments | planted P-PLUGIN-SCOPE-STRING (`scope` as `Type.String`) | calls table: `pi_claude_marketplace_plugin_list returned: No marketplaces configured.` | 1 |
| The plugin list tool returns the install status and compatibility of every plugin | planted P-DISABLED-INSTALLED (disabled projects to installed) | calls table: `[installed] eps  1.0.0` instead of `[unavailable] eps  1.0.0` | 1 |
| The installed filter returns only the installed plugins that are enabled | planted P-DISABLED-INSTALLED | calls table: `[installed] eps  1.0.0` appears under `installed` | 1 (first run timed out at the Pi start under load 137, so it was rerun with `--parallel 1`, which failed as planned) |
| The available filter returns the plugins the user can install, including git plugins not cloned yet | planted P-NO-REMOTE (`available` without `remote`) | calls table: `[available] ghp` missing | 1 (same rerun) |
| The unavailable filter returns the plugins this system cannot install and the disabled ones | natural; planted P-BARE-HEADER | natural: `[unavailable] eps  1.0.0` missing. Planted: `Marketplace extras (user)` followed by no `(no plugins)` line | 1, 1 |
| Two filters together return the plugins of either filter | planted P-EXCLUSIVE-FILTERS (only the first set filter counts) | calls table: only the installed rows, with `eps` under installed | 1 (same rerun) |
| A plugin list call naming a marketplace the asked scopes do not record reaches the model as an error | natural | calls table: `returned: Marketplace "ghost" not found.` and `returned: Marketplace "extras" not found.` | 1 |
| No call to either tool changes the config, the installation record, or what is installed | planted P-WRITE-STATE; planted P-REMOVE-STAGED | write: `the config and installation record bytes of the project scope are unchanged` failed. Remove: both bytes steps passed, and `the project scope stages these skills and prompts:` failed | 1, 1 |

The natural run for task 1 failed only the 2 new list scenarios, and both seeds passed. The natural run for task 2 failed only the unavailable scenario and the unknown-marketplace scenario. Both runs went as the plan predicted.

## Deviations

- The plan asked for every red proof to run twice. Each proof ran once, apart from the rerun for the load timeouts noted in the table (P10-DC-21).
- The plants for the status, installed, available, and two-filter scenarios were applied together in one run (P-DISABLED-INSTALLED, P-NO-REMOTE, and P-EXCLUSIVE-FILTERS each affect a different scenario). P-BARE-HEADER ran on its own, because P-DISABLED-INSTALLED also changes the unavailable result.
- The feature file was generated from a small script in the phase's scratch folder, so the tables come out aligned and the call rows grow in the (N+1)² shape. The script is not committed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- P10-DC-21 (Low): each red proof ran once rather than twice, and plants that touch different scenarios shared one run.
- P10-DC-11 to P10-DC-14 (planning) apply as planned.

## Parent lines

1. `docs/competitive-analysis/pi-plugins.md:434`: `pi_claude_marketplace_list` takes an optional `scope` parameter (`user` or `project`), not "no parameters" (D-BG-1002).
2. `CHANGELOG.md` under `## [Unreleased]`, one reader-facing bullet: the model-facing tools now return what the model asks for. `pi_claude_marketplace_list` takes an optional `scope`. `pi_claude_marketplace_plugin_list` reports a marketplace that the asked scopes do not record as a failed tool result. Its `unavailable` filter also returns installed plugins that are disabled. A marketplace with no matching plugin reads `(no plugins)`.
3. `.planning/PROJECT.md` Key Decisions: one row each for D-BG-1001 to D-BG-1010, in the form of the D-BG rows, with title and decision from `10-CONTEXT.md`, each marked pending user review.
4. `.planning/ROADMAP.md` "Carried Forward": the open json-output `09/` D-03 choice closes under D-BG-1001. Pi 1.5.0 delivers a returned `isError: true` to the model as a failed tool result. P10-DC-01 keeps the choice open for the user's review.
5. No unowned feature file changed.
