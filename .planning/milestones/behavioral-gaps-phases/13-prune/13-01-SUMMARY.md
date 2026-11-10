---
phase: 13-prune
plan: 01
subsystem: testing
tags: [cucumber, prune, dependencies, scope, state-lock, red-proof]

requires:
  - phase: 01-foundation
    provides: "the frozen shared steps (command, scope-state, marketplace/publishing, plugin/installation) and the state-lock holder"
provides:
  - "features/plugin/prune.feature pins a bare prune sweeping the user scope alone (D-BG-1301)"
  - "one --dry-run preview per scope that lists only its own orphan and changes neither scope (D-BG-1302, D-BG-1308)"
  - "the keep and prune rules for a dependency that only a disabled plugin needs (D-BG-1303)"
  - "nine recorded red proofs: M1-M4 for the new scenarios, R1-R5 for the existing usage-error and state-lock coverage (D-BG-1304, D-BG-1305)"
affects: [the parent's merge of Phase 13, BACKLOG PRUNECFG-01, PLUGALIAS-01, PRUNEISLAND-01]

actuals:
  tokens: 2700
  tasks: 3
  commits: 3
plan_head_before: d099f77f03acb4a48dd42a5825f71802de971fb3
plan_head_after: ccd1f4358e0f81b3e14cec515a261b3e3fedc870

tech-stack:
  added: []
  patterns:
    - "A two-scope scenario seeds a different orphan in each scope, because a preview labels its rows with the requested scope"

key-files:
  created:
    - .planning/phases/13-prune/13-01-SUMMARY.md
  modified:
    - features/plugin/prune.feature

key-decisions:
  - "No product change: the product already matches Claude Code 2.1.319 on every criterion (D-BG-1307)"
  - "No new step module: every step exists in the frozen shared modules (D-BG-1306)"
  - "Scenario E states no config outcome, because the leftover enabled:false entry is a known divergence in a file this phase does not own (D-BG-1309)"

patterns-established:
  - "Red proof of existing coverage in unowned files: mutate the product locally, run the unowned rows by line, restore, never edit the rows"

requirements-completed: [PRUNE-01, PRUNE-02]

coverage:
  - id: D1
    description: "A bare prune sweeps the user scope alone and leaves the project scope's orphan installed"
    requirement: PRUNE-01
    verification:
      - kind: e2e
        ref: "features/plugin/prune.feature:60 Pruning without a scope prunes the user scope alone"
        status: pass
  - id: D2
    description: "--scope user --dry-run and --scope project --dry-run each preview their own scope alone and remove nothing"
    requirement: PRUNE-01
    verification:
      - kind: e2e
        ref: "features/plugin/prune.feature:92 and :122 Previewing a prune of the user/project scope lists only its dependency and removes nothing"
        status: pass
  - id: D3
    description: "Each prune usage error shows its usage text"
    requirement: PRUNE-01
    verification:
      - kind: e2e
        ref: "features/plugin/usage-errors.feature:88:102:135:167:203 (unowned; red proofs R1-R4)"
        status: pass
  - id: D4
    description: "prune under a held state lock fails as lock held and removes nothing"
    requirement: PRUNE-02
    verification:
      - kind: e2e
        ref: "features/plugin/state-lock.feature:331:358 (unowned; red proof R5)"
        status: pass
  - id: D5
    description: "A dependency that only a disabled plugin needs is kept; a disabled orphaned dependency is pruned with what only it needs"
    requirement: PRUNE-02
    verification:
      - kind: e2e
        ref: "features/plugin/prune.feature:194 and :217"
        status: pass

duration: about 3 h (the adapter gate leg took 42 min under load)
completed: 2026-11-08
---

# Phase 13 Plan 01: Prune coverage scenarios Summary

**`prune.feature` now pins the scope a bare prune sweeps, one preview per scope, and how a disabled plugin's dependencies are kept or pruned, and nine red proofs show that every new and relied-on prune scenario fails without its behavior.**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 1 product-facing file (`features/plugin/prune.feature`) plus this SUMMARY
- **Node:** v26.13.0

## Commits

| Role | Commit | Title |
|------|--------|-------|
| Start | `d099f77f` | docs(planning): plan the prune coverage scenarios |
| Task 1 | `7f5378af` | test(prune): pin the scope a bare prune sweeps |
| Task 2 | `ccd1f435` | test(prune): pin how prune treats a disabled plugin's dependencies |
| Gate ran on | `ccd1f435` | (the head after Task 2; no local edit under `extensions/` or `features/`) |

## Scenarios of `features/plugin/prune.feature`

| # | Title | State |
|---|-------|-------|
| 1 | Pruning a scope with nothing to remove reports the empty result | unchanged |
| 2 | Pruning a scope uninstalls a dependency that no installed plugin needs | unchanged |
| 3 | Pruning a git-source dependency removes its clone | unchanged |
| 4 | Pruning without a scope prunes the user scope alone | new (A) |
| 5 | Previewing a prune of the user scope lists only its dependency and removes nothing | new (B) |
| 6 | Previewing a prune of the project scope lists only its dependency and removes nothing | replaced (C replaces "Previewing a prune lists the dependency it would uninstall and removes nothing") |
| 7 | Pruning keeps a dependency that an installed plugin still needs | unchanged |
| 8 | Pruning keeps a plugin the user installed by name | unchanged |
| 9 | Pruning keeps a dependency that only a disabled plugin needs | new (D) |
| 10 | Pruning removes a disabled dependency that nothing needs and what only it needs | new (E) |

No scenario carries an implementation tag; none has an MCP surface, so each runs once, under the adapter profile (D-BG-04).

## Red proofs

Every mutation was a local edit, run, then restored with `git checkout -- <file>`; `git status --short -- extensions` printed nothing after each restore. No mutation was staged or committed. Logs are in `/tmp/claude-1000/bg-phase-13/`.

| Proof | File and line | Original → mutated | Command | Summary line | Failing scenario(s) and step | Actual vs expected |
|-------|---------------|--------------------|---------|--------------|------------------------------|--------------------|
| M1 | `orchestrators/plugin/prune.ts:231` | `options.scope ?? "user"` → `?? "project"` | `npx cucumber-js features/plugin/prune.feature` | `8 scenarios (7 passed, 1 failed)` | A (`prune.feature:60`), `the result lists these plugins:` | project `mid@tools 1.1.0` listed where the user `lib@tools 1.2.0` is expected |
| M2 | `orchestrators/plugin/prune.ts:232` | `locationsFor(scope, …)` → the preview reads the other scope | same | `8 scenarios (6 passed, 2 failed)` | B (`:92`) and C (`:122`), `the result lists these plugins:` | each preview lists the other scope's orphan |
| M3 | `orchestrators/plugin/dependency-index.ts:485` (shared, not owned) | `index.set(…)` → `if (record.enabled) index.set(…)` | same | `10 scenarios (8 passed, 2 failed)` | D (`:194`) at `the result has these fields:`; E (`:217`) at `the result lists these plugins:` | D prunes `lib` (`cascade` instead of `prune-empty`); E removes `lib` before `mid` |
| M4 | `orchestrators/plugin/prune.ts:306` | `snapshot,` → candidates filtered to enabled records | same | `10 scenarios (9 passed, 1 failed)` | E (`:217`), `the result has these fields:` | `prune-empty` where `cascade` is expected |
| R1 | `edge/handlers/plugin/prune.ts:25` | `usage: USAGE` → `usage: "MUTATED"` | `npx cucumber-js features/plugin/usage-errors.feature:88:102:135:167:203` | `5 scenarios (4 passed, 1 failed)` | row 88 (`prune --bogus`) | usage text differs |
| R2 | `edge/handlers/plugin/prune.ts:30` | `if (scanned.local)` → `if (scanned.local && false)` | same | `5 scenarios (4 passed, 1 failed)` | row 102 (`prune --local`) | no `Unknown flag: "--local".` usage error |
| R3 | `edge/handlers/plugin/prune.ts:39` | `length > 0` → `length > 99` | same | `5 scenarios (4 passed, 1 failed)` | row 135 (`prune extra`) | no `Too many arguments.` usage error |
| R4 | `edge/handlers/plugin/prune.ts:38` | `withParsedArgs(parseArgs, USAGE,` → `"MUTATED"` | same | `5 scenarios (3 passed, 2 failed)` | rows 167 (`--scope bad`) and 203 (`--scope`) | usage text differs |
| R5 | `transaction/with-state-guard.ts:213` (Phase 15's file, local only) | `lockfilePath: locations.stateLockFile` → `` `${…}.mutated` `` | `npx cucumber-js features/plugin/state-lock.feature:331:358` | `2 scenarios (2 failed)` | both lock scenarios, `the result has these fields:` | `severity info`, `needs reload true` (the sweep ran) where `error`/`false` is expected |

Green runs: prune.feature 6 passed before Task 1, 8 passed after Task 1 and after M1/M2 were restored, 10 passed after Task 2 and after M3/M4 were restored; the relied-on rows `7 scenarios (7 passed)` before R1 and after R5 was restored. `npm run check:features` exit 0 after each task.

## Gate

Run on `ccd1f435`, each part alone in the background, exit code written to a file, never piped. Under load (load average 65 to 82 on 28 cores).

| Part | Exit | Duration | Log | Rerun |
|------|------|----------|-----|-------|
| `npm run check:static` | 0 | 75 s | `g1-check-static.log` | — |
| `npm run test:unpaired` | 0 | 50 s | `g2-test-unpaired.log` | — |
| `npm run test:integration` | 0 | 126 s | `g3-test-integration.log` | — |
| `npm run test:cucumber:profile -- --profile adapter --parallel 3` | 1 | 42 min | `g4-cucumber-adapter.log` | `1644 scenarios (1640 passed, 4 failed)`: three 90 s timeouts in `pi runs with the scripted model` (`hook/tool-use.feature:10`, `hook/messages.feature:33`, `mcp-server/companion-missing.feature:13`) and one MCP connect probe failure (`mcp-server/configuration.feature:90`). One rerun of those four: exit 0, `4 scenarios (4 passed)`, 118 s (`g4r-cucumber-adapter-rerun.log`). No prune scenario failed. |
| `npm run test:cucumber:profile -- --profile builtin --parallel 3` | 1 | 415 s | `g5-cucumber-builtin.log` | `148 scenarios (145 passed, 3 failed)`: three 90 s timeouts in `pi runs with the scripted model and the mcp implementation` (`mcp-server/configuration.feature:321`, `:323`, `mcp-server/invalid-configs.feature:150`). One rerun: exit 0, `3 scenarios (3 passed)`, 37 s (`g5r-cucumber-builtin-rerun.log`). |
| `npm run test:coverage:direct:all` | 0 | 109 s | `g6-coverage-direct.log` | — |
| `npm run test:modules` | 0 | 111 s | `g7-test-modules.log` | — |

All logs are under `/tmp/claude-1000/bg-phase-13/`.

## Home check

`find /home/acolomba/.pi -newer /tmp/claude-1000/bg-phase-13/home-marker -type f` printed nothing: no file under the real `~/.pi` changed during the plan's runs.

`git diff --name-only d099f77f..ccd1f435` lists only `features/plugin/prune.feature`.

## Deviations from Plan

- The plan ran inline in the orchestrating session instead of through a `gsd-executor` subagent (see Dubious Choices).
- The cucumber gate legs failed by load timeouts and were rerun once on the failing scenarios only, as the child brief allows; both runs are recorded above.

## Parent lines

**`.planning/BACKLOG.md`** — three new open entries:

```markdown
## PRUNECFG-01: a pruned disabled dependency keeps its `enabled: false` declaration

Noted 2026-11-08 (behavioral-gaps Phase 13, D-BG-1309, P13-DC-04). When `prune` or `uninstall --prune` removes a dependency that the user disabled, the scope's `claude-plugins.json` keeps that plugin's `enabled: false` declaration; Claude Code 2.1.319's prune removal deletes `enabledPlugins[id]` for each plugin it removes. No command result shows the entry (`pending` is empty, and a later install enables the plugin). The shared sweep `removeDependencyMember` in `orchestrators/plugin/uninstall.ts` never touches the config layers. Candidate direction: drop the declaration in the shared sweep, let the prune rollback and the uninstall path restore the config files on a failure (NFR-3), and add the config Then to the disabled-dependency scenario of `features/plugin/prune.feature`.

## PLUGALIAS-01: the CLI's plugin aliases, `autoremove` among them

Noted 2026-11-08 (behavioral-gaps Phase 13, P13-DC-02). Claude Code's CLI names `autoremove` as an alias of `claude plugin prune` (2.1.319) and has the plugin aliases `i`, `remove`, and `rm`; the plugin subcommands of `/claude:plugin` have none of them, so `/claude:plugin autoremove` is an unknown subcommand. Prune is a CLI-only command upstream: the in-session `/plugin` has no prune. Candidate direction: decide whether the router takes the CLI's aliases (a router arm, usage, completions, and a usage-errors row for each) or record the divergence with a decision ID.

## PRUNEISLAND-01: prune keeps an island of dependencies that declare each other

Noted 2026-11-08 (behavioral-gaps Phase 13, P13-DC-03). Claude Code's orphan scan walks the dependencies of the plugins installed by name, so dependency plugins that only declare each other are orphans and its prune removes them. `pruneOrphans` (`domain/dependency-orphans.ts`) removes only a record that no remaining record declares, so such an island holds itself, as its PRUNE-03 comment documents and `test/domain/dependency-orphans.test.ts` pins. Install refuses a dependency cycle, so an island forms only when installed manifests change. Candidate direction: walk from the plugins installed by name, as upstream does, with a decision that amends PRUNE-03, or record the divergence.
```

**`.planning/PROJECT.md` Key Decisions** — one row each, in the D-BG-01 row format (`| **D-BG-13NN (behavioral-gaps, Phase 13, settled with the recommended answer, pending user review): <headline>**. <detail> | <rationale> | -- Pending |`), text from `13-CONTEXT.md`:

- D-BG-1301: a bare `prune` sweeps the user scope alone — Claude Code's `-s, --scope` default is `user` (2.1.319); the product already does it; scenario A pins it with an orphan in each scope.
- D-BG-1302: each `--scope` combines with `--dry-run` and previews that scope alone — one scenario per scope; both scopes' bytes unchanged.
- D-BG-1303: a dependency that only a disabled plugin needs is kept while that plugin is installed by name, and pruned with it when the disabled plugin is itself an orphaned dependency — upstream's orphan scan walks disabled plugins installed by name; the product matches through D-05-04 and the D-05-02 fixpoint.
- D-BG-1304: prune's five usage errors are already pinned with their usage text in `features/plugin/usage-errors.feature`; the phase adds no duplicate and records a red proof for each row.
- D-BG-1305: prune under a held state lock is already pinned in `features/plugin/state-lock.feature` for both scopes; the phase adds no duplicate and records a red proof.
- D-BG-1306: no new step module unless a step is missing (none was).
- D-BG-1307: no product change is planned (none was made).
- D-BG-1308: each scope gets its own orphan in the two-scope scenarios, because a preview labels its rows with the requested scope.
- D-BG-1309: the `enabled: false` declaration a pruned disabled dependency leaves in `claude-plugins.json` is not fixed in this phase (shared sweep in `uninstall.ts`); BACKLOG PRUNECFG-01.

**`CHANGELOG.md`, `README.md`, `README.es.md`:** no line (the phase adds coverage only; no user-visible behavior changes).

**Frozen files:** no change. **Unowned feature files:** none changed (`features/plugin/usage-errors.feature` and `features/plugin/state-lock.feature` were only run).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **Inline execution.** The coordinator directed that the remaining work run inline, without subagents; before that, the `gsd-executor` dispatch was refused by the GSD isolation guard, which reads the sentinel from the session's launch checkout (the parent checkout), not from the phase worktree. The plan therefore ran in the orchestrating session.
- **Gate reruns on the failing scenarios only.** Each cucumber leg's load failures were rerun once as the named scenarios, not as the whole 42-minute leg; all seven reruns passed.
- **The fourth adapter failure was not a timeout.** `mcp-server/configuration.feature:90` failed with an OAuth probe error from the stub server under load, not a 90 s timeout; it was treated as a load failure and passed on its one rerun.
