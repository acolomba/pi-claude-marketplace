---
phase: 02-plugin-layers-names-and-list-fold
plan: "01"
subsystem: testing
tags: [cucumber, layers, LAYER-04, LAYER-08, CFG-03, integration-rescope]

requires: []
provides:
  - "12 LAYER-04 scenarios, two per verb file (install, uninstall, enable, disable, update, reinstall)"
  - "test/integration/plugin-layer-verbs.test.ts trimmed to its two LAYER-06 cases"
  - "red proofs of breaks B1, B2, and B12"
affects: [plugin-layer-verbs, phase 8 integration rescope]

actuals:
  tokens: 10500
  tasks: 3
  commits: 3
plan_head_before: 8cc0eee0711279faa80a36a577dcae7bde0a227d
plan_head_after: fc1fbf6d717a05d07bc2481651eb2d066eeb9991

tech-stack:
  added: []
  patterns:
    - "A LAYER-04 scenario checks the CFG-03 row, the byte snapshot of base config and state, the local config separately, and the staged skills"

key-files:
  created: []
  modified:
    - features/plugin/install.feature
    - features/plugin/uninstall.feature
    - features/plugin/enable.feature
    - features/plugin/disable.feature
    - features/plugin/update.feature
    - features/plugin/reinstall.feature
    - test/integration/plugin-layer-verbs.test.ts

key-decisions:
  - "Each verb's two LAYER-04 refusals are plain scenarios in its own feature file, one per layer direction, with no implementation tag (DUAL-02)"

patterns-established:
  - "The local config is checked on its own (holds this text / declares these plugins and marketplaces), because the byte snapshot step reads only claude-plugins.json and state.json"

requirements-completed: [ITMIG-01]

coverage:
  - id: D1
    description: "Each of the six named verbs refuses as an invalid manifest and changes nothing while the other layer's config cannot be read, in both directions"
    requirement: "ITMIG-01"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/plugin/{install,uninstall,enable,disable,update,reinstall}.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "plugin-layer-verbs keeps only its two LAYER-06 cases"
    requirement: "ITMIG-01"
    verification:
      - kind: integration
        ref: "node --import scripts/isolated-pi-home.mjs --test test/integration/plugin-layer-verbs.test.ts"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-21
status: complete
---

# Phase 2 Plan 01: LAYER-04 Refusals in the Verb Files Summary

**Twelve cucumber scenarios now prove that install, uninstall, enable, disable, update, and
reinstall refuse with the CFG-03 row and change nothing while the other layer cannot be read.
Breaks B1, B2, and B12 each failed their scenarios before the 12 LAYER-04 and 2 LAYER-08
integration cases were deleted.**

## Performance

- **Duration:** 28 min (2026-11-21T18:16:03Z to 2026-11-21T18:44:05Z)
- **Tasks:** 3 of 3
- **Files modified:** 7

## Accomplishments

- Two LAYER-04 scenarios in each of the six verb feature files, placed after the anchor
  scenario the plan names, the base-layer target first. Each file only gains lines.
- Breaks B1, B2, and B12 each failed the scenarios they guard, on an assertion. The helper
  restored each file, and every log records `restored=clean`.
- `test/integration/plugin-layer-verbs.test.ts` keeps only the two LAYER-06 tests
  (`tests 2`, `pass 2`; it was `tests 16`, `pass 16` at the plan base).

## Task Commits

1. **02-01-01: Prove the LAYER-04 loop on the install pair**: `d64565a`
   (`test(plugin): cover install refusals while a layer cannot be read`)
2. **02-01-02: Add the other ten LAYER-04 scenarios, record B1 and B2**: `840463c`
   (`test(plugin): cover verb refusals while a layer cannot be read`)
3. **02-01-03: Record B12, trim the integration file**: `fc1fbf6`
   (`test(plugin): trim layer verb cases that scenarios now cover`)

## Red proofs

- **Scratch folder:**
  `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase02-plan01`.
  The helper is `break.sh` there. It takes its root from `git rev-parse --show-toplevel`,
  names no fixed checkout, and passes `--parallel 1`.
- **Checkout root:** the first line of every break log is
  `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a57eda3990e4ca909`, which is
  this plan's worktree.
- **Green runs (no break):**
  - `green-install-adapter.log`: `30 scenarios (30 passed)`, `exit=0`.
  - `green-verbs-adapter.log` (uninstall, enable, disable, update, reinstall):
    `103 scenarios (103 passed)`, `exit=0`.
  - `builtin.log` (all six files, builtin profile): `1 scenario (1 passed)`, `exit=0`. This is
    the existing `@mcp` scenario "A bridge failure after an update starts replacing files
    reports the reinstall remedy" of `update.feature`. The builtin profile selects none of the
    new scenarios, because they have no MCP surface (DUAL-02).
- **B1, install run** (`B1-install-adapter.log`).
  - File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:707`, in
    `loadTargetLayers`.
  - Change, from the log's diff:
    `-  if (otherCfg.status === "invalid") {` and
    `+  if (otherCfg.status === "invalid" && process.env.NEVER_SET === "x") {`.
  - Command: `bash "$D/break.sh" B1-install adapter extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts "$D/B1.old" "$D/B1.new" --name 'LAYER-04, CFG-03' features/plugin/install.feature`.
  - Result: `2 scenarios (2 failed)`, `exit=1`, `restored=clean`. Both scenarios failed:
    `install.feature:274` (local config unreadable) and `install.feature:303` (`--local`, base
    config unreadable). Each failed at `Then the result has these fields:` with
    `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The actual
    values were severity `info`, needs reload `true`, and no summary: the install went ahead
    as if the unreadable layer declared nothing.
- **B1, full run** (`B1-adapter.log`).
  - The change is the same as in the install run.
  - Command: the same helper call with ID `B1`, `--name 'LAYER-04, CFG-03'`, and all six
    feature files.
  - Result: `12 scenarios (2 passed, 10 failed)`, `exit=1`, `restored=clean`.
  - Failed: `install.feature:274`, `install.feature:303`, `enable.feature:55`,
    `enable.feature:86`, `disable.feature:59`, `disable.feature:84`, `update.feature:188`,
    `update.feature:215`, `reinstall.feature:34`, `reinstall.feature:58`. Each failed at
    `Then the result has these fields:` with the same `AssertionError` (actual `info`, `true`).
  - Passed: the uninstall pair, `uninstall.feature:98` and `uninstall.feature:123`.
    Uninstall reads its layers through its own reader, which break B2 covers.
- **B2** (`B2-adapter.log`).
  - File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:398`, in
    `readUninstallLayers`.
  - Change, from the log's diff:
    `-  if (other.status === "invalid") {` and
    `+  if (other.status === "invalid" && process.env.NEVER_SET === "x") {`.
  - Command: the helper with ID `B2`, `--name 'LAYER-04, CFG-03'`, and the six files.
  - Result: `12 scenarios (10 passed, 2 failed)`, `exit=1`, `restored=clean`.
  - Failed: `uninstall.feature:98` and `uninstall.feature:123`, each at
    `Then the result has these fields:` with the same `AssertionError` (actual `info`, `true`:
    the uninstall went ahead).
  - Passed: the other ten LAYER-04 scenarios.
- **B12** (`B12-adapter.log`).
  - File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1100`,
    in `finalizeUpdateRecord`.
  - Change, from the log's diff: after `const allSucceeded = phase3aFailures.length === 0;`,
    five added lines. They dynamically import `../../persistence/config-io.ts`, load
    `locations.baseConfigJsonPath`, and, when it is valid, save it with
    `[plugin + "@" + marketplace]: {}` added to its `plugins`.
  - Command: the helper with ID `B12`,
    `--name 'Reinstalling a dependency declares nothing in either layer|Updating every plugin updates the plugins of both layers and declares none of their dependencies'`,
    `features/plugin/reinstall.feature`, and `features/plugin/update.feature`.
  - Result: `2 scenarios (2 failed)`, `exit=1`, `restored=clean`.
  - Failed: "Reinstalling a dependency declares nothing in either layer" at
    `reinstall.feature:161` (line 105 at the plan base). The scenario failed at
    `Then the "claude-plugins.json" file of the project scope declares these plugins:` with
    `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The actual
    table had an extra row, `lib@tools`.
  - Failed: "Updating every plugin updates the plugins of both layers and declares none of
    their dependencies" at `update.feature:369` (line 306 at the plan base). It failed at the
    same step with the same error. The actual table had extra rows `pp@fixtures` and
    `lib@tools`.
- **Reruns:** none. No log holds `function timed out`, and no run selected 0 scenarios.
- **Clean tree:** `git status --porcelain -- extensions/` printed nothing after each of the four
  break runs, and `git diff <plan base> HEAD -- extensions/` prints nothing.

## Case map

| Removed integration case | Replacing scenario | Break that failed it |
|---|---|---|
| `LAYER-04: install beta@mp is refused while claude-plugins.local.json cannot be read, and changes nothing` | install.feature:274 "Installing a plugin fails as an invalid manifest and changes nothing while the local config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: install beta@mp --local is refused while claude-plugins.json cannot be read, and changes nothing` | install.feature:303 "Installing a plugin with --local fails as an invalid manifest and changes nothing while the base config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: uninstall alpha@mp is refused while claude-plugins.local.json cannot be read, ...` | uninstall.feature:98 "Uninstalling a plugin fails as an invalid manifest and changes nothing while the local config cannot be read (LAYER-04, CFG-03)" | B2 |
| `LAYER-04: uninstall alpha@mp --local is refused while claude-plugins.json cannot be read, ...` | uninstall.feature:123 "Uninstalling a plugin with --local fails ... while the base config cannot be read (LAYER-04, CFG-03)" | B2 |
| `LAYER-04: enable alpha@mp is refused while claude-plugins.local.json cannot be read, ...` | enable.feature:55 "Enabling a plugin fails ... while the local config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: enable alpha@mp --local is refused while claude-plugins.json cannot be read, ...` | enable.feature:86 "Enabling a plugin with --local fails ... while the base config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: disable alpha@mp is refused while claude-plugins.local.json cannot be read, ...` | disable.feature:59 "Disabling a plugin fails ... while the local config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: disable alpha@mp --local is refused while claude-plugins.json cannot be read, ...` | disable.feature:84 "Disabling a plugin with --local fails ... while the base config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: update alpha@mp is refused while claude-plugins.local.json cannot be read, ...` | update.feature:188 "Updating a plugin fails ... while the local config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: update alpha@mp --local is refused while claude-plugins.json cannot be read, ...` | update.feature:215 "Updating a plugin with --local fails ... while the base config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: reinstall alpha@mp is refused while claude-plugins.local.json cannot be read, ...` | reinstall.feature:34 "Reinstalling a plugin fails ... while the local config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-04: reinstall alpha@mp --local is refused while claude-plugins.json cannot be read, ...` | reinstall.feature:58 "Reinstalling a plugin with --local fails ... while the base config cannot be read (LAYER-04, CFG-03)" | B1 |
| `LAYER-08: the load-time backfill's reinstall of a dependency writes no layer config` | reinstall.feature:161 "Reinstalling a dependency declares nothing in either layer" (existing) | B12 |
| `LAYER-08: a bare update moves a dependency to its new version and writes no layer config` | update.feature:369 "Updating every plugin updates the plugins of both layers and declares none of their dependencies" (existing) | B12 |
| `LAYER-06: install --local of a plugin the base layer installed declares the marketplace with the base layer's source when the record holds none` | kept (Phase 8) | - |
| `LAYER-06: install --local is refused and changes nothing when no layer declares the marketplace and the record holds no source` | kept (Phase 8) | - |

## Checks

`node --version`: `v24.22.3`. Every npm script ran with the prefix
`npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Every cucumber
run passed `--parallel 1`. Every lint, `check:static`, audit, and commit ran under
`flock -w 3600 "$S/phase02-heavy.lock"`.

| Check | Log | Exit | Tree it ran on |
|---|---|---|---|
| Integration file baseline | `layer-verbs-baseline.log` | 0 (`tests 16`, `pass 16`) | `8cc0eee` (plan base) |
| Green install, adapter | `green-install-adapter.log` | 0 (`30 scenarios (30 passed)`) | `8cc0eee` plus the install pair, the content of `d64565a` |
| B1, install pair | `B1-install-adapter.log` | cucumber 1, `restored=clean` | the same |
| ESLint warm-up (`npm run lint`) | `lint.log` | 0 | the same |
| `check:static` (Task 1) | `check-static-1.log` | 0 | `8cc0eee` plus all six uncommitted verb files, the tree of `840463c` (see Deviations) |
| Green five verb files, adapter | `green-verbs-adapter.log` | 0 (`103 scenarios (103 passed)`) | the tree of `840463c` |
| B1, all twelve | `B1-adapter.log` | cucumber 1, `restored=clean` | `d64565a` plus the five verb files, the tree of `840463c` |
| B2, all twelve | `B2-adapter.log` | cucumber 1, `restored=clean` | the same |
| B12, the two LAYER-08 scenarios | `B12-adapter.log` | cucumber 1, `restored=clean` | the same |
| `check:static` (Task 2) | `check-static-2.log` | 0 | the same |
| Commit hook `check:commit` | (commit output) | passed | `d64565a`, `840463c`, `fc1fbf6` |
| Trimmed integration file | `layer-verbs.log` | 0 (`tests 2`, `pass 2`, `fail 0`) | `840463c` plus the trimmed file, the tree of `fc1fbf6` |
| `check:static` (Task 3) | `check-static-3.log` | 0 | the same |
| `npx --no fallow audit --base 8cc0eee` | `audit.json` | 0, verdict `warn` | `fc1fbf6` (committed) |
| Builtin profile, six files | `builtin.log` | 0 (`1 scenario (1 passed)`) | `fc1fbf6` |
| Final scope check | (command output) | 0 | `fc1fbf6`: exactly the six verb files and the trimmed test changed; nothing under `extensions/` changed, committed or not |

Every `check:static` log shows typecheck, lint, lint:workflows, fallow, format:check,
test:corresponding, and check:features passed.

## Issues for the milestone

- `fallow audit --base 8cc0eee0711279faa80a36a577dcae7bde0a227d` gives verdict `warn`, with
  `dead_code_issues: 0`, `complexity_findings: 0`, and `duplication_clone_groups: 0`. It has
  one diff-risk finding: `weakened-tests` (`removed-tests`) on
  `test/integration/plugin-layer-verbs.test.ts`, "The change removes test cases (test cases:
  5 -> 2)". Fallow counts `test(...)` call sites, so the LAYER-04 loop counts as one case. This
  finding is expected (RESEARCH A1). Per the user decision of 2026-11-21, `.fallowrc.json` and
  the CI workflows are unchanged, and the milestone handles the finding.

## Deviations from Plan

- **Order of runs (no change to any result).** I inserted the ten Task 2 scenarios while my
  Task 1 `check:static` waited third in the shared lock queue. So `check-static-1.log` ran on
  a tree that also held those uncommitted scenarios. This is a stricter check than the plan
  asked for. Task 1's commit still staged `install.feature` alone, and the hook checks only
  staged content. Because the cucumber runs do not take the lock, I ran B12 (a Task 3 action)
  during Task 2, after B1 and B2 and before the Task 2 `check:static`. This keeps a break from
  ever overlapping one of my queued static checks. I tried to cancel my queued static check to
  save time, and the permission system refused. I waited for it instead, and applied no break
  while it was queued.
- **Integration trim details.** The install helper is now `installOperation()`, which returns
  `createInstallOperation(createHooksRouting(createHooksRuntime(), { readHooksJson }),
  createCompletionCache())`. The doc comment of `request` now says "The fields an install
  takes", because no other verb uses it. `FixturePlugin` keeps only `name`, and `plugin.json`
  no longer gets a `dependencies` key. What the two LAYER-06 tests assert is unchanged.
- **Prettier.** `npx --no prettier --write` printed the file instead of writing it in this
  environment. I applied the one wrap by hand. The pre-commit Prettier hook and `format:check`
  both passed.
- **Line numbers.** The research cited the LAYER-08 scenarios at `reinstall.feature:105` and
  `update.feature:306`. After this plan inserted scenarios above them, they sit at `:161` and
  `:369`.
- No expected value differed from the plan, and I did not need to strengthen any scenario.
  Every break failed its scenarios on the first run.

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

Commits `d64565a`, `840463c`, and `fc1fbf6` are on HEAD. Every log this SUMMARY cites, and
`break.sh`, exist in the scratch folder.
