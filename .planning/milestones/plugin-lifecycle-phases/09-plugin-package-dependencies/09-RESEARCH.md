# Phase 9: Plugin Package Dependencies - Research

**Researched:** 2026-10-26
**Domain:** child-process spawn chokepoint, install-ledger phase, update hook, closed reason set, loopback npm registry stand-in
**Confidence:** HIGH for the codebase facts and the npm recipe (read and run this session); MEDIUM for the row-reason fan-out plan and the SessionStart-hook proof scenario.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-PL9-01 (lockfile table):** Copy the upstream table verbatim: order
  `bun.lock`, `npm-shrinkwrap.json`, `package-lock.json`, `bun.lockb`
  (refused); the exact argument lists above; yarn/pnpm-only refused. One closed
  `const` table in the orchestrator module, so the order is data, not branches.
- **D-PL9-02 (when it runs):** Run only when `package.json` exists, a lockfile
  from the table matches, and `package.json` lists at least one of
  `dependencies`, `optionalDependencies`, `peerDependencies`, `workspaces`
  (upstream `_Ss`). A `package.json` with no recognized lockfile is skipped
  silently (upstream, and BACKLOG PKGDEP-01). The upstream zero-package
  lockfile check is not copied (it needs the lockfile parser D-PL9-08 defers);
  the `package.json` check covers the common empty case.
- **D-PL9-03 (where it runs, NFR-10):** The plugin root must resolve inside
  `locations.extensionRoot` (a git marketplace clone under `sources/` or a
  plugin clone under `plugin-clones/`). A plugin root outside it -- a
  path-source marketplace, which runs from the user's own folder -- is never
  written to: when that folder has no `node_modules`, the phase skips with a
  warning that names the folder and the command to run there; when it has one,
  it skips silently. Divergence license: recorded decision NFR-10 (containment)
  plus the Pi capability gap that we run plugins in place rather than from a
  per-version cache copy.
- **D-PL9-04 (work dir and swap):** Like upstream, copy only `package.json`
  and the lockfile into a fresh work dir under
  `locations.sourcesStagingDir(<uuid>)` (inside containment, same filesystem
  as both clone roots, so the move is a rename), run the package manager there
  (the plugin's own `.npmrc` or `bunfig.toml` is not read), and on exit 0
  rename the work dir's `node_modules` into the plugin root. An existing
  `node_modules` is renamed aside first and restored if the move fails, then
  removed. The work dir is removed in `finally`. Exit non-zero, spawn error,
  or timeout leaves the plugin root untouched.
- **D-PL9-05 (ledger position):** A new `packagesPhase` sits in the install
  ledger array between `workflowsPhase` and `statePhase` (8 phases). It is a
  ledger phase and not a post-commit step so that every `runInstallLedger`
  caller -- install, the install cascade, enable, import, apply -- gets it.
  It runs after the six bridge phases so a bridge failure never spends the
  network. Its `do` never throws for a package-install failure (PKD-02): it
  records a warning. Its `undo` (reached only when `statePhase` fails) removes
  the `node_modules` it created when none existed before, and leaves a
  replaced one in place.
- **D-PL9-06 (skip when present):** In the install ledger, a contained plugin
  root that already has `node_modules` is not reinstalled (upstream's load
  check treats it as installed); enable and reinstall of an unchanged clone
  stay offline. The update hook always runs, because an update moves to a
  new lockfile.
- **D-PL9-07 (update hook):** `materialize-latest.ts` runs the same package
  step after a successful swap (`partition` updated), on the new version's
  plugin root, and adds its warning to the outcome. A failure never turns the
  updated row into a failure (PKD-02).
- **D-PL9-08 (sanitizer declined for now):** Claude Code's lockfile-content
  sanitizer is not copied. `--ignore-scripts` plus the isolated work dir carry
  the main protection (no lifecycle scripts, no plugin `.npmrc`). Recorded as
  a backlog entry, not silently dropped.
- **D-PL9-09 (warning surface):** A failed, timed-out, or refused package
  install is a warning on the plugin's row with one new closed-set reason,
  `packages not installed`, and a note carrying upstream's message text
  (`Plugin dependency install failed (npm): <first output>` truncated to 500
  chars; the refusal texts verbatim). Upstream only logs at install and
  reports at load; we have no load diagnostic yet (deferred), so the install
  row is the one place the user learns it. Severity follows the tri-state
  model: carried out but short -> warning.
- **D-PL9-10 (NFR-5 amendment):** Install, update, reinstall, enable, import,
  and apply may use the network for a plugin's own package install, through
  the package manager, when the plugin ships a supported lockfile and its
  root has no `node_modules` (update: always). `list`, `info`, `uninstall`,
  `marketplace remove`, and the load stay network-free. ESLint BLOCK F gains a
  `PACKAGE_INSTALL_SEAMS` list: only the new orchestrator module may import the
  new platform module.
- **D-PL9-11 (spawn chokepoint):** A new rule-pack rule
  `child-process-chokepoint` bans `node:child_process` / `child_process`
  imports across `extensions/pi-claude-marketplace/**` except the files that
  already spawn (`bridges/hooks/dispatch-exec.ts`, `bridges/hooks/exec-timer.ts`,
  `bridges/hooks/async-rewake/registry.ts`,
  `bridges/hooks/async-rewake/ring-buffer.ts`, `platform/git-credential.ts`)
  and the new `platform/package-manager.ts`. The planner must confirm the
  exact list with `rg -l child_process extensions/` before writing it.
- **D-PL9-12 (process module):** `platform/package-manager.ts` exports one
  function that spawns `command args` in `cwd` with no shell, a timeout
  (default 60000 ms, injectable for tests), stdio captured, and resolves to
  `{ code, stdout, stderr, error?, timedOut }` -- never rejects for a process
  failure. The orchestrator module takes it as an injected dependency
  (CONVENTIONS: dependency injection over test-only seams).
- **D-PL9-13 (behavioral test stand-in):** The cucumber scenarios run the real
  `npm` against a loopback **npm registry stand-in** (`features/lib/`), with
  the fixture plugin's `package-lock.json` written at fixture time so its
  `resolved` URLs point at the stand-in and its `integrity` matches the
  served tarball. npm's cache goes under the sandbox home. No scenario reaches
  the public registry. A `file:` dependency was rejected because the work dir
  of D-PL9-04 breaks relative `file:` paths; a dependency-free lockfile was
  rejected because it cannot show the hook finding its module. The failure
  scenario uses a `package.json` and `package-lock.json` that disagree, which
  makes `npm ci` exit non-zero without any network.

### Claude's Discretion

- Module names (`orchestrators/plugin/package-install.ts` suggested), the
  ledger context fields, and how the update outcome carries the warning.
- Whether the success row says anything (upstream logs success only; default:
  say nothing).

### Deferred Ideas (OUT OF SCOPE)

- **PKGDEP-02:** load-time `packages not installed` / `packages refused`
  diagnostic and `update` retrying the package install on an up-to-date
  plugin (upstream 2.1.310). Needs `orchestrators/reconcile/load.ts` and the
  up-to-date path of `update-flow.ts`, outside this phase's files.
- **PKGDEP-03:** Claude Code's lockfile-content sanitizer (registry-only
  dependencies, integrity required, no `overrides`/`patchedDependencies`,
  root renamed `plugin-dependencies`, zero-package skip).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKD-01 | Installing or updating a plugin whose root ships `package.json` and a supported lockfile runs the same frozen, script-free, time-bounded install Claude Code runs, in the staged copy | Ledger phase slot and context (§Install ledger), update hook site (§Update path), work-dir/rename containment (§Locations), spawn idiom (§Spawn pattern), working npm-registry stand-in recipe (§Behavioral test recipe) |
| PKD-02 | A failed, timed-out, or skipped package install degrades the plugin with a warning and never blocks it | Warning channels that already reach the user without failing the row (`discoveryWarnings` on install, `notes` on the updated outcome), the full row-reason fan-out list (§Warning surface), and the failure scenario recipe |
| PKD-03 | NFR-5 and the process-spawn rules are amended with a recorded ID for the package install | Existing `no-shell-out.test.ts` whitelist gate (must change), verified rule-pack rule shape, verified ESLint `import-x/no-restricted-paths` zone, NFR-5 text locations |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; merge, never rebase; commits follow `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- Every plan `SUMMARY.md` includes a `## Threat Flags` section, even when "None".
- GSD gates run `npm run check` on the combined tree (post-merge of each wave, phase gate). The hook's `check:commit` is not a verdict.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap (D-PL9-03 records one).
- NFR-1 atomic disk mutations; NFR-3 retry-safe; NFR-10 containment (writes only under `<scopeRoot>/pi-claude-marketplace/`, plugin roots inside the owning clone root).
- IL-2: no `process.stdout/stderr`, no `console` in the extension; output only through `shared/notification-dispatch.ts`.
- TypeScript strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`; exported functions declare return types; cognitive complexity <= 15 in both ESLint (sonarjs) and fallow; cyclomatic <= 20.
- Every production module has exactly one paired `test/<mirror>.test.ts` reaching 100% line/function/branch coverage when run alone; no coverage-ignore directives.
- Dependency injection over test-only seams; no module-global `_setXForTest`; no `t.mock.module()`.
- Comments cite durable IDs (D-PL9-xx, PKD-0x, NFR-x), never phase/plan numbers.
- Subagent/executor tests must use a hermetic home (`createHermeticEnvironment` / `withHermeticHome`); a test that touches the real `~/.pi/agent` is a defect.

## Summary

The install side is a clean fit: `runInstallLedgerBody` builds a literal phase array and the new phase can be a factory-built `Phase` typed on a narrow context, which a `Phase<InstallLedgerContext>` array accepts (verified with `tsc`). The phase reads `c.resolved.pluginRoot` and `c.locations`, and writes its note into `c.discoveryWarnings`, the one existing channel that already reaches a standalone user (as a second `diagnostic` notification after the row) and every orchestrated caller (through `postCommitWarnings`). The update side has the same property: the `updated` outcome's `notes` field is rendered by `update` (`surfaceUpdateDiscoveryWarnings`), carried by `reinstall` into its discovery warnings, and forwarded by the cascades. So the note part of D-PL9-09 lands inside the phase's file list.

The **reason token and the warning severity on the row do not.** No row composer reads a generic "extra reason" member: the standalone install row is built in `install-flow.ts::composeInstalledRow`, and the analogous ledger signal `orphan rewake` is stamped in six places across five files that the ROADMAP does not list for this phase. Adding the `Reason` literal itself touches `shared/notification-types.ts` (Phase 3's file), `shared/notification-wire.ts`, the generated `schema/claude-plugin.schema.json`, `docs/json-output.md`, and three test pins. The planner must either widen the file list (recommended minimum: `notification-types.ts`, `notification-wire.ts`, `install-flow.ts::composeInstalledRow`, `update-row.ts`), or get the user to accept note-only delivery for the surfaces it does not widen to.

Two locked decisions rest on facts that are wrong in this tree. (1) D-PL9-11's exemption list: only three extension files import `node:child_process` (`platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`); `exec-timer.ts`, `ring-buffer.ts` and `spawn-helpers.ts` only mention it in comments. A spawn chokepoint **already exists** as `test/architecture/no-shell-out.test.ts`, which pins exactly three files and documents that a fallow rule cannot replace it (it misses dynamic `import()`); that test and `test/architecture/gate-targets.ts` must change, and neither is in the file list. (2) D-PL9-13's failure recipe: on npm 11.20, a `package.json` that disagrees with the lockfile makes `npm ci` **fetch the packument** from the configured registry before failing, so it is not network-free. With the sandbox `~/.npmrc` pointing `registry` at the loopback stand-in it stays loopback-only (verified), and an armed stand-in (404 on the tarball) or an unparseable lockfile are simpler deterministic failures.

**Primary recommendation:** Build `platform/package-manager.ts` (git-credential spawn idiom, no shell, command as a parameter) + `orchestrators/plugin/package-install.ts` (closed lockfile table, detection, containment, work-dir/rename, a `packagesPhase` factory, and an `afterUpdate` helper). Wire it with three lines in `install-outcome.ts` and one wrapper in `materialize-latest.ts`. Route the note through `discoveryWarnings` / `notes`. Ask the user now about the file-scope widening the reason token needs.

## Architectural Responsibility Map

This is a Pi extension (no browser/server tiers); the map uses the extension's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn `npm`/`bun` with timeout, capture output | `platform/` (new `package-manager.ts`) | -- | External-process boundary; `platform` may import only `shared` (fallow zones, ESLint BLOCK C) |
| Lockfile table, trigger check, containment, work dir, rename/park/restore, note text | `orchestrators/plugin/package-install.ts` (new) | `persistence/locations.ts` (`sourcesStagingDir`, `extensionRoot`), `shared/path-safety.ts` | Business decision + filesystem orchestration; the only importer of the platform module (D-PL9-10) |
| Run at install / enable / cascade / import / apply | `orchestrators/plugin/install-outcome.ts` ledger array | `transaction/phase-ledger.ts` (`runPhases`, undo order) | Every `runInstallLedger` caller gets it (D-PL9-05) |
| Run at update / reinstall / dependency move / apply catalog move | `orchestrators/plugin/materialize-latest.ts` | `update-swap.ts` (read-only: `UpdateRunOutcome`) | The one runner all re-materializing verbs share |
| User-visible note | existing `discoveryWarnings` / `notes` channels -> `shared/notification-dispatch.ts::notifyDiagnostic` | -- | No new output path (IL-2) |
| Row reason + severity | row composers (`install-flow.ts`, `update-row.ts`, ...) | `shared/notification-types.ts`, `notification-wire.ts`, `notify-reasons.ts` | Closed-set vocabulary owned by `shared/`; rows composed per verb |
| Enforcement (PKD-03) | `test/architecture/no-shell-out.test.ts` + `gate-targets.ts`, `rule-packs/architecture.json`, `eslint.config.js` | `.planning/PROJECT.md`, `AGENTS.md` (NFR-5 text) | Static gates + recorded decision |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` `spawn` | Node built-in (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | Run the package manager, no shell | Already the project's spawn primitive in three sanctioned files [VERIFIED: rg this session] |
| `node:fs/promises` (`rename`, `rm`, `copyFile`, `mkdir`, `readFile`, `lstat`) | built-in | Work dir, swap, cleanup | Same-FS `rename` is the project's atomic-commit idiom (clone-cache, add) [VERIFIED: clone-cache.ts:240-255] |
| `node:crypto` `randomUUID` | built-in | Work-dir name | Same as every `sourcesStagingDir(randomUUID())` call site [VERIFIED: clone-cache.ts:240, add.ts:1225] |
| System `npm` (CI: Node 24's bundled npm) / `bun` | npm 11.20.0 local; bun 1.4.4 local | The package managers | Upstream runs these exact commands (CONTEXT upstream evidence) |

### Supporting (tests only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:http` + `node:zlib` `gzipSync` + `node:crypto` `createHash("sha512")` | built-in | Loopback npm registry stand-in and fixture tarball | `features/lib/` stand-in; no tar package exists in `node_modules` [VERIFIED: ls node_modules] |
| `strong-mock`, `node:test` `t.mock` | existing devDeps | Doubles for the injected runner | Unit tests per `typescript-unit-tests` rules |

**Installation:** none. This phase adds no npm dependency.

## Package Legitimacy Audit

No external package is installed by this phase (the package managers are system binaries invoked at runtime; the tests use Node built-ins only).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 install / enable / cascade / import / apply                update / reinstall / dep move / apply move
            |                                                              |
   runInstallLedgerBody (inside state lock)                    materializeLatestVersion (after swap, no lock)
   skills > commands > agents > hooks > mcp > workflows                  |
            |                                                    partition === "updated"?
            v                                                             | yes (force = policy.skipSameRevision)
   packagesPhase.do(ctx)  ---------------------+--------------------------+
                                               v
                          package-install: detect(pluginRoot)
                    no package.json / no recognized lockfile / no deps  --> skip (silent)
                    yarn.lock|pnpm-lock only, or bun.lockb              --> note (refusal text)
                    root outside extensionRoot (path source)
                        node_modules present -> skip (silent)
                        absent               -> note (folder + command)
                    contained, node_modules present, !force             --> skip (silent)
                    contained otherwise:
                        mkdir sources-staging/<uuid>; copy package.json + lockfile
                        runPackageManager(cmd, args, workDir, 60s)  [platform]
                            exit!=0 / spawn error / timeout -> note (truncated 500)
                            exit 0 -> park old node_modules into work dir,
                                      rename workDir/node_modules -> pluginRoot/node_modules
                                      (restore parked on failure)
                        finally rm -rf work dir
                                               |
           note -> ctx.discoveryWarnings  <----+----> outcome.notes (updated partition)
           statePhase (state lock save)                surfaceUpdateDiscoveryWarnings / reinstall
           collectPostCommitWarnings -> surfaceDiscoveryWarnings / postCommitWarnings
```

### Recommended Project Structure
```
extensions/pi-claude-marketplace/
├── platform/package-manager.ts            # spawn + timeout + capture; command is a parameter
└── orchestrators/plugin/package-install.ts # table, detection, containment, work dir, phase factory, update helper, composed default
test/
├── platform/package-manager.test.ts       # real child = process.execPath -e "<script>"
├── orchestrators/plugin/package-install.test.ts  # injected runner (strong-mock / stub), real tmp dirs
└── architecture/{no-shell-out.test.ts, gate-targets.ts, notify-closed-set-locks.test.ts, compat-01-no-expansion.test.ts} (edits)
features/
├── plugin/package-dependencies.feature    # Feature: Plugin package dependencies
├── step_definitions/plugin/package-dependencies.steps.ts  (or a topic module, see Layout rules)
└── lib/npm-registry.ts                    # loopback stand-in + tarball/lockfile fixture builder
```

### 1. Install ledger facts (cite: `orchestrators/plugin/install-outcome.ts`)

- `InstallLedgerContext` [VERIFIED: install-outcome.ts:371-445]: readonly `locations: ScopedLocations`, `cwd`, `marketplace`, `plugin`, `resolved: MaterializablePlugin`, `agentsDirs`, `version`, `resolvedSha?`, `resolvedVersion?`, `pluginDataDir`; mutable prep handles `skillsPrep?`, `commandsPrep?`, `agentsPrep?`, `mcpReplacement?`, `workflowsPrep?`; `hooksFileWritten: boolean`; `hookEntries?`; `stagedSkillNames`, `stagedCommandNames`, `stagedAgentNames`, `stagedMcpServerNames`, `stagedWorkflowNames`; `bridgeWarnings: string[];` `discoveryWarnings: string[];` `agentForeignFailures`, `mcpConfigNotices`, `frontmatterDegradations`; `readonly stateSnapshot: ExtensionState`.
- The plugin root is `c.resolved.pluginRoot` [VERIFIED: install-outcome.ts:1072 `pluginRoot: c.resolved.pluginRoot,`]; `MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable` [VERIFIED: domain/resolver-types.ts:175], both carrying `pluginRoot`.
- The literal array [VERIFIED: install-outcome.ts:1528-1536]:
  ```ts
  const phases: readonly Phase<InstallLedgerContext>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    workflowsPhase,
    statePhase,
  ];
  ```
  The comment above it (1524-1527) states "order is part of the contract" and the sequence `[skills, commands, agents, hooks, mcp, workflows, state]`; update that comment too, and the header comment at line 19 ("D-01 7-phase ledger") and 1064-1065 ("7-element constant array").
- `statePhase` (1405-1522) is pure in-memory mutation with **no `undo`**; it throws `ConcurrentInstallError` when a record appeared (unless `allowExistingRecord`) or an `Error` when the marketplace vanished. Those two throws are the only way the packages phase's `undo` runs (D-PL9-05).
- `runPhases` [VERIFIED: transaction/phase-ledger.ts]: on the first throw, the failing phase's own `undo` runs first, then executed phases in reverse; an undo that throws becomes a `RollbackPartial` row, **except `PathContainmentError`, which is rethrown loudly**. So the packages `undo` must use plain `rm` and must not call `assertPathInside`.
- Warning channels: `collectPostCommitWarnings` [VERIFIED: install-flow.ts:1151-1229] pushes `installCtx.discoveryWarnings` unconditionally (line 1172) and gates every hygiene warning (`bridgeWarnings`, mkdir, cache, foreign agents, frontmatter detail) on `orchestrated`. Standalone install then calls `surfaceDiscoveryWarnings(ctx, run, { plugin, verb: "installed", warnings: postCommitWarnings })` (install-flow.ts:2861-2865), which emits one `diagnostic` notification with header `Plugin "<p>" installed; 1 declared component has a note.` and lines passed through `redactAbsolutePaths` [VERIFIED: orchestrators/plugin/shared.ts:1809-1828]. Orchestrated callers receive the same strings in `InstallPluginOutcome.postCommitWarnings` (`installedPluginOutcome`, install-outcome.ts:1570-1595), consumed by `orchestrators/import/execute.ts:1094` and `orchestrators/reconcile/apply.ts` (581-603, 700-702, 1943-1947).
- **Use `discoveryWarnings`, not `bridgeWarnings`:** `bridgeWarnings` never reaches a standalone user (D-19-01).
- `enable` does not surface discovery warnings today (no consumer in `enable-disable.ts`); Phase 1's WRN-01 adds that. Install-cascade **member** rows do not surface their own warnings either (only the root's, install-flow.ts:3182).

**Phase factory (verified pattern).** Keep `InstallLedgerContext` unchanged: build the phase from a factory typed on a narrow context and keep the "did I create `node_modules`" state in the factory's closure. A `Phase<Narrow>` is assignable into the `Phase<InstallLedgerContext>[]` array [VERIFIED: tsc --strict --exactOptionalPropertyTypes on a scratch reproduction this session].

### 2. Update path facts

- `materializeLatestVersion(args, policy)` [VERIFIED: materialize-latest.ts:63-105] returns `preflight` verdicts directly, a `failed` outcome when the settle refuses, `swapPluginUpdate(args, preflight, policy)` when nothing settled, else `swapAfterSettle(...)` (127-154), which spreads the swap outcome and adds `dependencyRows`. The new plugin root is `preflight.installable.pluginRoot` [VERIFIED: update-preflight.ts:111-118 `readonly installable: MaterializablePlugin;`].
- Success outcome: `partition: "updated"` built at update-swap.ts:1551-1600; it ends with `...(updateWarnings.length > 0 && { notes: updateWarnings })` [VERIFIED: update-swap.ts:1596-1598]. `PluginUpdateUpdatedOutcome.notes` is `readonly notes?: readonly string[];` [VERIFIED: orchestrators/types.ts:470], documented as "NOT dead. `update.ts::surfaceUpdateDiscoveryWarnings` reads this field ... the cascade consumers carry it onward." Appending a note there never changes `partition`, so the row stays `(updated)` (PKD-02).
- Consumers: `update-flow.ts::surfaceUpdateDiscoveryWarnings` (471-487) renders `notes` through `surfaceDiscoveryWarnings(..., verb: "updated")`; reinstall maps `run.notes` to its `discoveryWarnings` (reinstall-flow.ts:426) and renders them (636-643).
- Callers of the runner [VERIFIED: rg]: `update-flow.ts:1279` (`UPDATE_MATERIALIZATION`), `:1294` (`CONVERGE_MATERIALIZATION`, apply's catalog move), `:1299` (`REMATERIALIZE_MATERIALIZATION`), `reinstall-flow.ts:400` (`REINSTALL_MATERIALIZATION`), `dependency-move.ts:285`. Reinstall shares the runner: confirmed.
- **Force rule from the policy.** `skipSameRevision` is `true` for update, converge and the dependency-move policies and `false` for reinstall and rematerialize [VERIFIED: update-preflight.ts:177-182; update-flow.ts:1269-1290; reinstall-flow.ts:207-211; dependency-bindings.ts:35-49]. Use `force: policy.skipSameRevision`: a revision move always reinstalls (D-PL9-06 "update hook always runs"); a same-revision re-materialization (reinstall, growth move) skips when `node_modules` exists, so it stays offline (D-PL9-06).
- One-function footprint: wrap the two swap returns, for example `return withPluginPackages(await swapPluginUpdate(...), preflight, args.locations, policy)`, where `withPluginPackages` returns the outcome unchanged unless `partition === "updated"` and a note came back, then returns `{ ...outcome, notes: [...(outcome.notes ?? []), note] }`. Keep the helper in `package-install.ts` so `materialize-latest.ts` gains one import and two call wraps.
- The update hook runs **after** the finalize, outside the state lock (the swap returns after its own guards). The install phase runs inside it.

### 3. Locations and containment

- `extensionRoot` is `<scopeRoot>/pi-claude-marketplace/` [VERIFIED: locations.ts:45-46]; `sourcesDir = path.join(extensionRoot, "sources")` (226), `pluginClonesDir = path.join(extensionRoot, "plugin-clones")` (231), and `sourcesStagingDir(uuid)` returns `path.join(extensionRoot, "sources-staging", uuid)` after `assertPathInside(sourcesStagingRoot, candidate, ...)` [VERIFIED: locations.ts:355-360]. The comment at 227-230 states plugin-clones is "same-FS with sources-staging/ so the tmp+rename clone commit stays atomic"; all three are hard-coded suffixes of one directory, so a rename between them is same-filesystem unless a user mounts something inside `extensionRoot` [VERIFIED by construction; mount case ASSUMED].
- `assertPathInside(parent, child, label)` [VERIFIED: shared/path-containment.ts:106-140]: rejects lexical `..`, then string containment (`PathContainmentError`), then `lstat`s every segment from parent to child and refuses a symlink (`SymlinkRefusedError`). Use it for the containment decision and treat **both** error classes (`instanceof`) as "outside": skip per D-PL9-03.
- Nobody sweeps `sources-staging/` [VERIFIED: rg for `sources-staging` callers: only add.ts and clone-cache.ts create dirs there]. The work dir must be removed in `finally`.
- `marketplace update` pulls **in place** (fetch + `forceUpdateRef` + non-forced `checkout`, orchestrators/marketplace/shared.ts:261-326). isomorphic-git 1.43.1's checkout `analyze` ignores untracked work-dir entries (`case '001': // Ignore workdir files that are not tracked and not part of the new commit.`) [VERIFIED: node_modules/isomorphic-git/index.js:7779-7790], so a `node_modules` inside a marketplace clone survives `marketplace update`. That is CONTEXT uncertain choice 5 (stale `node_modules` after a lockfile change until the plugin's own `update`).
- clone-cache.ts:259-266 and :871-878 document that per-commit copies and tag clones copy **only `.git`** and check out, so no untracked file (including `node_modules`) rides into a new `plugin-clones/<key>/`. A git plugin's update therefore lands in a fresh root with no `node_modules`; the package step runs there. Nothing treats an untracked `node_modules` as a problem.
- Content-hash versions skip `node_modules` [VERIFIED: domain/version.ts:27 `const HASH_WALK_SKIP = Object.freeze([".git", "node_modules", ".DS_Store"] as const);`], so installing packages does not change a path plugin's recorded `hash-` version. **Park the old `node_modules` inside the work dir**, not as `previous-node_modules` beside it in the plugin root: a crash would leave a sibling directory the hash walk does not skip.

### 4. Rule pack (PKD-03)

Exact shape of a `banned-import` rule [VERIFIED: rule-packs/architecture.json, `isomorphic-git-chokepoint`]:
```json
{
  "id": "isomorphic-git-chokepoint",
  "kind": "banned-import",
  "specifiers": ["isomorphic-git"],
  "files": ["extensions/pi-claude-marketplace/**"],
  "exclude": ["extensions/pi-claude-marketplace/platform/git.ts"],
  "message": "D-13: only platform/git.ts imports isomorphic-git. Reach git through its wrappers and the GitOps seam in orchestrators/marketplace/shared.ts."
}
```
Current `child_process` importers under `extensions/` [VERIFIED: `rg -n child_process extensions/` this session]: `platform/git-credential.ts:51`, `bridges/hooks/dispatch-exec.ts:52`, `bridges/hooks/async-rewake/registry.ts:40` -- **three files**. `exec-timer.ts` (19, 44), `ring-buffer.ts` (6) and `spawn-helpers.ts` (6) mention it only in comments. The D-PL9-11 list is wrong: exempt the three importers plus `platform/package-manager.ts`, not `exec-timer.ts` / `ring-buffer.ts`.

Verified experiment (scratch copy of the tree, fallow 3.33): the rule below loads with no `WARN` from `fallow rule-pack test`, an `exclude` naming a not-yet-existing file is accepted silently, and a planted `import { spawn } from "node:child_process"` in an orchestrator file is reported as `policy-violation` by `fallow dead-code`:
```json
{
  "id": "child-process-chokepoint",
  "kind": "banned-import",
  "specifiers": ["node:child_process", "child_process"],
  "files": ["extensions/pi-claude-marketplace/**"],
  "exclude": [
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
    "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
    "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
    "extensions/pi-claude-marketplace/platform/package-manager.ts"
  ],
  "message": "D-21 / D-PL9-11: only the sanctioned spawn sites import node:child_process."
}
```
**The gate that already does this:** `test/architecture/no-shell-out.test.ts` walks every `.ts` under the extension and fails on six regexes (static, `require`, and dynamic `import()` of both specifiers); its header (28-33) records that a fallow `banned-import` rule "passes `await import("node:child_process")` ... untouched ... Keep this test." It reads `SHELL_OUT_EXEMPT_TARGETS` [VERIFIED: test/architecture/gate-targets.ts:213-217]:
```ts
export const SHELL_OUT_EXEMPT_TARGETS = [
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
] as const;
```
and a second case `"whitelist: exactly three files may import node:child_process"` that deep-equals the sorted list (142-151). Adding `platform/package-manager.ts` **fails `npm run check` (`test:unpaired`) until both are edited in the same commit** (the docstring at 71-74 requires this). The gate-targets doc comment (204-212, "these three and no others") needs the new reason too. Neither file is in the ROADMAP file list; they must be.

### 5. ESLint seam rule (PKD-03, D-PL9-10)

- Flat-config gotcha: a later block that sets a rule **replaces** that rule's options for the files it matches. BLOCK F (eslint.config.js:524-554) re-composes `no-restricted-syntax` for exactly this reason ("Compose the append restriction again"). A new block that sets `no-restricted-imports` or `import-x/no-restricted-paths` over `extensions/**` would silently drop BLOCK F's or BLOCK C's options for the overlapping files.
- **Recommended:** add one zone to BLOCK C's existing `import-x/no-restricted-paths` `zones` array (eslint.config.js:390-514) and a named constant beside `NETWORK_SEAMS`:
  ```js
  /** D-PL9-10 / PKD-03: the only module that may import platform/package-manager.ts. */
  const PACKAGE_INSTALL_SEAMS = ["extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts"];
  // in BLOCK C zones:
  {
    target: "./extensions/pi-claude-marketplace/**/!(package-install).ts",
    from: ["./extensions/pi-claude-marketplace/platform/package-manager.ts"],
    message: "D-PL9-10: only the PACKAGE_INSTALL_SEAMS module imports platform/package-manager.ts; it is the network seam for a plugin's own package install.",
  },
  ```
  Verified in a scratch config with import-x 4.17.1: static, `import type`, `export ... from`, and dynamic `import()` from any other file are reported; the seam file is not. **Gap:** a TS type query `import("../platform/package-manager.ts").T` is not reported (import-x's module visitor has no `TSImportType`). If the planner wants that closed too, add `{ selector: "TSImportType Literal[value=/platform\\/package-manager/]", message }` to **both** `no-restricted-syntax` lists (the all-extension block at 516-523 and BLOCK F at 549-553), spreading one shared constant into each.
- Using one seam file means the extglob can name its basename; if a second seam ever appears, switch to one zone per directory.
- BLOCK F itself needs no change: `package-install.ts` names no git surface. Do **not** add it to `NETWORK_SEAMS` (that list means "names the git surface").
- Phase 5 also edits `NETWORK_SEAMS` and the rule pack; both edits append, so merges are mechanical.

### 6. Spawn pattern

- Follow `platform/git-credential.ts` [VERIFIED: 51-170], the newer idiom: export a narrow process interface, `export const NODE_<X>_SPAWN = spawn as <XSpawn>;`, and a function that takes the launcher and the timeout as parameters. It uses `stdio: ["pipe","pipe","pipe"]`, accumulates stdout, `setTimeout(...).unref()` that calls `child.kill("SIGTERM")`, `clearTimeout` on `error`/`close`, and swallows stdin `error`. `dispatch-exec.ts` (`deps.spawnImpl ?? spawn`, 147-157) defaults a parameter to the live boundary, which the unit-test rules now forbid; do not copy that part.
- For the package manager: `spawn(command, args, { cwd, env: process.env, shell: false, stdio: ["ignore", "pipe", "pipe"] })`; resolve on `close` with `{ code, signal, stdout, stderr, timedOut }`; resolve (not reject) with `error` on the `error` event (ENOENT when `npm`/`bun` is absent). On timeout send SIGTERM, then SIGKILL after a short grace, and still resolve on `close`, so the `finally` that removes the work dir never races a live npm. Cap each captured stream (for example 64 KiB) since only 500 characters are used.
- **`sonarjs/no-os-command-from-path` is `error` in the preset** [VERIFIED: sonarjs recommended rules]. A string-literal command in a `spawn` call fails lint; a parameter or a `const` table member does not [VERIFIED: scratch eslint run]. Keep `"npm"` / `"bun"` in the orchestrator's table and pass them in as `command`.
- Never `spawnSync`: the state lock is `stale: 10_000, update: 2_000` [VERIFIED: transaction/with-state-guard.ts:212-217]; the lock's mtime refresh needs a free event loop, and a blocking 60 s spawn would let another process steal the lock at 10 s.
- Windows: `npm` is `npm.cmd`, and Node refuses to spawn `.cmd`/`.bat` without `shell: true` since the CVE-2024-27980 fix [ASSUMED]. With `shell: false` the spawn fails, which PKD-02 turns into a warning. The extension otherwise only branches on `win32` for path separators (`platform/os.ts:19`); CI is Linux. Record as a known limit.

### 7. Notify reason (`packages not installed`)

Adding one `Reason` member forces these edits (all compile- or test-enforced) [VERIFIED: rg for the newest member `"already added"` this session]:
1. `shared/notification-types.ts` -- append to the `Reason` union tail (APPEND-ONLY; ends with `| "already added";`). **Phase 3's file.**
2. `shared/notification-wire.ts:85-164` -- `REASONS` is `as const satisfies Record<Reason, true>`; typecheck fails without the entry. This is the JSON (`pi.appendEntry`) strategy's enum.
3. `shared/notify-reasons.ts` -- give it a home in a group, or the `ReasonsCoverageProof` (`AssertNever<UncoveredReason>`) fails to compile. It is a failure-class fact on a success row; the closest precedent is `dependents unsatisfied` / `dependency current copy` in `CommandPrivateReason`, or `FailureReason` (where `malformed skill` lives, also a warning on an `(installed)` row). Recommend `FailureReason` with a D-PL9-09 comment.
4. `schema/claude-plugin.schema.json` -- regenerate with `npm run schema:generate`; `test/architecture/wire-schema.test.ts` fails on drift.
5. `test/architecture/notify-closed-set-locks.test.ts` -- add to `REASON_ENROLLMENT` and bump `"OUT-08: Reason is the closed 78-entry reason set"` (line 219) to 79.
6. `test/architecture/compat-01-no-expansion.test.ts` -- append to the expected ordered list with an ID comment.
7. `test/shared/notification-types.test.ts` -- append to its ordered list (ends at line 171).
8. `docs/json-output.md:902` -- the `Reason` enumeration line; `docs/output-catalog.md` -- a row example (Phase 3 also edits it).

Phase 3 appends reasons to the same tails, so a textual merge conflict on every list above is certain; it is mechanical (keep both, fix the count).

**Where the token must be stamped to appear on a row** (precedent: the ledger signal `orphan rewake`) [VERIFIED: rg]:
| Surface | File:line |
|---|---|
| standalone install root row | `install-flow.ts:1284-1298` (`composeInstalledRow` reasons + severity) |
| update / apply-move / autoupdate rows | `update-row.ts:137-145` |
| enable row | `enable-disable.ts:3061-3063` |
| reconcile install / backfill rows (apply, import-like) | `reconcile/notify.ts:880-884, 934-936, 1001-1008` |
| reinstall row | `reinstall.messaging.ts:191` (reads `degradedKinds`) |

None of these files is in Phase 9's list. **Minimum viable widening:** `composeInstalledRow` (standalone install) and `update-row.ts` (update), carried by one new optional member (for example `packagesNotInstalled?: true`) on `InstallLedgerSummary` and on the updated outcome. The other surfaces get the note only. The planner must put this choice to the user before planning (see Open Questions).

### Anti-Patterns to Avoid
- **Pushing the note into `bridgeWarnings`:** a standalone user never sees it (D-19-01).
- **A second `notify` call from the phase:** the ledger is lock-held, mode-agnostic and has no `ctx`/`run` in its context; IL-2 keeps output in the composers.
- **Throwing from `packagesPhase.do` on a package failure:** that unwinds six committed bridges (violates PKD-02). Throw only for programmer errors.
- **`assertPathInside` inside `undo`:** a `PathContainmentError` there escapes `runPhases` as a loud failure.
- **Leaving `previous-node_modules` in the plugin root:** see §3 (hash and clutter).
- **A literal `"npm"` in a `spawn(...)` call:** sonarjs S4036 fails lint.
- **Editing `test/e2e/_rpc.ts` for npm env:** Phase 10 owns it; the sandbox `~/.npmrc` is enough (§8).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path containment / symlink refusal | string `startsWith` checks | `assertPathInside` (`shared/path-safety.ts`) + `instanceof PathContainmentError` / `SymlinkRefusedError` | lexical `..`, symlink segments, normalization already handled |
| Absolute-path scrubbing in notes | regex in the new module | `surfaceDiscoveryWarnings` already runs `redactAbsolutePaths` | NFR-9; one rule |
| Rollback ordering | custom try/finally chains | `runPhases` `undo` | failing-phase undo + reverse walk + `RollbackPartial` rows |
| Lockfile resolution / integrity checks | a lockfile parser | `npm ci` / `bun install --frozen-lockfile` | D-PL9-08 defers the sanitizer; the package manager enforces frozen resolution |
| tar for the test tarball | a dependency | 40-line ustar writer + `gzipSync` (verified) | no tar library in `node_modules`; deterministic bytes |
| Output channel | `console` / stdout | existing `notifyDiagnostic` via the warning channels | IL-2 rule pack |

## Common Pitfalls

### Pitfall 1: The existing spawn gate fails the build
**What goes wrong:** `npm run check` fails in `test:unpaired` once `platform/package-manager.ts` imports `node:child_process`.
**Why:** `no-shell-out.test.ts` + `SHELL_OUT_EXEMPT_TARGETS` pin exactly three files.
**How to avoid:** Edit both, plus their docstrings, in the same commit as the platform module.
**Warning signs:** "D-21 violation: child_process import detected outside the platform/git-credential whitelist".

### Pitfall 2: "Mismatched lockfile fails offline" is false
**What goes wrong:** On npm 11.20 a `package.json` whose range the lockfile does not satisfy makes `npm ci` request the packument (`GET /pkd-dep`) before failing [VERIFIED: experiment]. Without a registry override that goes to registry.npmjs.org.
**How to avoid:** The scenario writes `{home}/.npmrc` with `registry=http://127.0.0.1:<port>/`; prefer the armed-404 tarball or the unparseable-lockfile failure (both verified: 1 and 0 loopback requests).

### Pitfall 3: npm update-notifier traffic
**What goes wrong:** With `update-notifier` on, npm requests `GET /npm` from the configured registry (twice in the experiment), and prints "New major version of npm available!" on stderr, which would become the first 500 characters of a failure note.
**How to avoid:** Tests: `update-notifier=false` in the sandbox `~/.npmrc`. Production: consider `npm_config_update_notifier=false` in the spawn env (keeps D-PL9-01's argv verbatim); this is a small divergence to record (see Open Questions).

### Pitfall 4: npm retry backoff exceeds the timeout
**What goes wrong:** Default `fetch-retries=2` with 10-60 s backoff turns a failing fetch into a timeout.
**How to avoid:** Tests set `fetch-retries=0`. Production keeps npm defaults (the 60 s bound reports it as a timeout).

### Pitfall 5: Note text names an absolute folder
**What goes wrong:** D-PL9-03's path-source note names "the folder"; `surfaceDiscoveryWarnings` redacts absolute paths to their basename (NFR-9), and npm's error output contains absolute log paths.
**How to avoid:** Write the note with a basename or `~`-relative form on purpose; expect npm output to be basename-redacted in the rendered line.

### Pitfall 6: Ledger runs the network inside the state lock
**What goes wrong:** Up to ~65 s of `npm ci` while the scope lock is held; any concurrent command in that scope fails `{lock held}` (retries 0).
**How to avoid:** Accept (D-PL9-05 chooses the ledger); keep the spawn async so lock refresh continues.

### Pitfall 7: Outer failures do not undo `node_modules`
**What goes wrong:** The phase undo runs only when `statePhase` throws. A later failure (cascade member failure -> `cascadeUnstagePlugin`, or the outer `saveState`) leaves the new `node_modules` in the clone.
**How to avoid:** Document it; it is harmless (untracked dir, next install skips it, clone GC / `marketplace remove` deletes it).

### Pitfall 8: Phase-count text in comments and tests
**What goes wrong:** Comments say "7-phase"; tests that wrap `runPhases` observe phase names.
**What exists:** `test/transaction/phase-ledger.test.ts:15-23, 197-207` uses its **own** fixture schedule named after the ledger (not coupled to the real array; optional update). `install-flow.test.ts:200-218`, `install-outcome.test.ts:1916-1927`, `install-cascade.test.ts:3378, 3653` wrap `runPhases` and filter by name; none asserts the full real array. No architecture test pins the array [VERIFIED: rg for `statePhase|workflowsPhase` in test/architecture]. Existing fixtures ship no `package.json`, so the new phase is a silent no-op in all of them.

### Pitfall 9: Skills copied from a root-level skill directory
**What goes wrong:** On re-materialization, a plugin whose skill directory is its root would have `node_modules` copied by `cp(skill.skillDir, ..., { recursive: true })` (bridges/skills/stage.ts:297). Rare layout; LOW.

## Code Examples

### Platform module skeleton (pattern from `platform/git-credential.ts`)
```ts
// platform/package-manager.ts -- D-PL9-12 / PKD-03
import { spawn } from "node:child_process";

export interface PackageManagerRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly error?: Error;
}
export interface PackageManagerProcess { /* narrow subset: stdout/stderr on("data"), on("error"|"close"), kill() */ }
export type PackageManagerSpawn = (command: string, args: readonly string[], options: {
  readonly cwd: string; readonly env: NodeJS.ProcessEnv;
  readonly shell: false; readonly stdio: readonly ["ignore", "pipe", "pipe"];
}) => PackageManagerProcess;
export const NODE_PACKAGE_MANAGER_SPAWN = spawn as PackageManagerSpawn;

/** Never rejects for a process failure (D-PL9-12). */
export function runPackageManager(
  launch: PackageManagerSpawn,
  request: { readonly command: string; readonly args: readonly string[]; readonly cwd: string; readonly timeoutMs: number },
): Promise<PackageManagerRun> { /* git-credential idiom: timer.unref(), SIGTERM then SIGKILL, resolve on close */ }
```

### Lockfile table (D-PL9-01, values from CONTEXT upstream evidence)
```ts
const NPM_CI_ARGS = ["ci", "--ignore-scripts", "--workspaces=false", "--no-audit", "--no-fund"] as const;
const LOCKFILE_TABLE = [
  { file: "bun.lock", manager: "bun", command: "bun", args: ["install", "--frozen-lockfile", "--ignore-scripts"] },
  { file: "npm-shrinkwrap.json", manager: "npm", command: "npm", args: NPM_CI_ARGS },
  { file: "package-lock.json", manager: "npm", command: "npm", args: NPM_CI_ARGS },
  { file: "bun.lockb", refused: "its bun.lockb is a binary lockfile that cannot be checked; ship a text bun.lock instead" },
] as const;
const UNSUPPORTED_LOCKFILES = ["yarn.lock", "pnpm-lock.yaml"] as const;
const UNSUPPORTED_MESSAGE =
  "Skipped: yarn/pnpm lockfiles are not supported (resolution-time hooks bypass --ignore-scripts). Use bun or npm.";
const TRIGGER_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies", "workspaces"] as const;
const PACKAGE_INSTALL_TIMEOUT_MS = 60_000; // upstream F6n
const NOTE_LIMIT = 500;
```

### Wiring in `install-outcome.ts` (three lines)
```ts
import { createPackagesPhase } from "./package-install.ts";
// inside runInstallLedgerBody, beside the other phase constants:
const packagesPhase = createPackagesPhase(PLUGIN_PACKAGE_INSTALLER, { force: false });
// array: ..., workflowsPhase, packagesPhase, statePhase,
```
`createPackagesPhase` returns `Phase<{ readonly locations: ScopedLocations; readonly resolved: { readonly pluginRoot: string }; readonly discoveryWarnings: string[] }>` (assignability verified), named `"packages"`, with the "created" flag in its closure for `undo`.

### Behavioral test recipe (verified this session, npm 11.20.0, Node 26.12)
1. Build the tarball in memory: ustar entries `package/package.json` (`{"name":"pkd-dep","version":"1.0.0","main":"index.js"}`) and `package/index.js`, then `gzipSync`; `integrity = "sha512-" + createHash("sha512").update(tgz).digest("base64")`.
2. Serve it from `http.createServer` on `127.0.0.1:0` at `/pkd-dep/-/pkd-dep-1.0.0.tgz`; 404 everything else; record `METHOD URL`.
3. Plugin files: `package.json` `{"name":"plugin","version":"0.0.0","dependencies":{"pkd-dep":"1.0.0"}}` and `package-lock.json`:
   ```json
   { "name": "plugin", "version": "0.0.0", "lockfileVersion": 3, "requires": true,
     "packages": {
       "": { "name": "plugin", "version": "0.0.0", "dependencies": { "pkd-dep": "1.0.0" } },
       "node_modules/pkd-dep": { "version": "1.0.0",
         "resolved": "http://127.0.0.1:<port>/pkd-dep/-/pkd-dep-1.0.0.tgz", "integrity": "sha512-..." } } }
   ```
4. Write `{home}/.npmrc`: `registry=http://127.0.0.1:<port>/`, `update-notifier=false`, `fetch-retries=0` (optionally `loglevel=silent`, which empties npm's failure output so the note falls back to the exit description).
5. Run `npm ci --ignore-scripts --workspaces=false --no-audit --no-fund` in the work dir with `HOME=<sandbox home>`, `PATH` inherited. Result: exit 0, request log exactly `["GET /pkd-dep/-/pkd-dep-1.0.0.tgz"]`, `node_modules/pkd-dep/index.js` loads, cache in `$HOME/.npm`.
6. Failures: stand-in armed to 404 the tarball -> exit 1, one loopback request; unparseable `package-lock.json` -> exit 1 `EUSAGE`, zero requests; range mismatch -> exit 1 after `GET /pkd-dep` (loopback only because of step 4).

Why this works in cucumber without touching `test/e2e/_rpc.ts`: Pi's child env is an allowlist `{ HOME: sandbox.home, PI_CODING_AGENT_DIR, PI_OFFLINE: "1", PATH }` plus the git variables [VERIFIED: test/e2e/_rpc.ts:184-200]. The extension's spawn inherits Pi's `process.env`, so npm reads `$HOME/.npmrc` = the sandbox file, caches in the sandbox, and no developer `npm_config_*` variable leaks in. The `Before()` hook empties the sandbox home every scenario [VERIFIED: features/support/pi-process.ts:126-149], so `.npmrc` and the cache never outlive a scenario. The stand-in's address is not fixed by Pi at start, so it is per-scenario world state released through `this.onRelease()`, not module state.

Plugin files can be added to a published plugin with the existing `writePublishedPluginFile(published, plugin, file, text)` [VERIFIED: features/lib/published-marketplace.ts:471-484], which commits and pushes for git publications. The success scenario must use a **git** marketplace (url or github kind on the run's https git host), because a `dir`/`file` marketplace's plugin root is outside `extensionRoot` (D-PL9-03 path). Per the features rules, a behavior only some source kinds have gets its own feature file: `features/plugin/package-dependencies.feature` (`Feature: Plugin package dependencies`).

**Proving the hook finds its module:** no cucumber feature runs a plugin hook today [VERIFIED: rg "hook" features/]. The integration precedent `test/integration/hooks-spawn-end-to-end.test.ts` dispatches a `SessionStart` handler that writes a sentinel file through `${CLAUDE_PLUGIN_ROOT}`. In cucumber: ship `hooks/hooks.json` with a `SessionStart` command `node "${CLAUDE_PLUGIN_ROOT}/hook.js"`, where `hook.js` does `require("pkd-dep")` and writes the export into `${CLAUDE_PROJECT_DIR}/pkd-proof.txt` (a user-visible project file); `When the user starts a new pi session`; `Then` reads that file. `CLAUDE_PLUGIN_ROOT` = the record's `resolvedSource` and `CLAUDE_PROJECT_DIR` = the session cwd [VERIFIED: bridges/hooks/hook-env.ts:52-66]. MEDIUM confidence that this runs end to end in RPC mode; the plan should include a spike task before the scenario is written.

**Deterministic note text for scenarios:** use the refusal path (`yarn.lock` only) for an exact-text warning scenario (no spawn at all). For the npm failure scenario, either `loglevel=silent` (empty npm output, so the note is the implementation's exit description) or a `{npm registry}` run token for the `127.0.0.1:<port>` address.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BACKLOG PKGDEP-01 described a session-start rerun | Claude Code 2.1.310 has no session-start rerun; a load diagnostic plus `update` retry | per CONTEXT upstream evidence | the load diagnostic is deferred (PKGDEP-02) |
| `spawn` of `.cmd` without a shell on Windows | refused (`EINVAL`) after CVE-2024-27980 | Node 18.20.2 / 20.12.2 [ASSUMED] | Windows package installs degrade to a warning |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node refuses `.cmd` spawn without `shell: true` (CVE-2024-27980) | Spawn pattern | Windows behavior differs; still degrades to a warning |
| A2 | CI's Node 24 bundles npm 11.x with the same `npm ci` network behavior as local 11.20 | Behavioral recipe | Cucumber request-log assertions could differ on CI |
| A3 | A `SessionStart` hook dispatches in the cucumber RPC session and can write into the project dir | Behavioral recipe | The hook-proof scenario needs another observable (spike first) |
| A4 | `--ignore-scripts` also suppresses `prepare` for git dependencies in `npm ci` | Security | A git dependency could run code at install (sanitizer deferred anyway) |
| A5 | Nothing mounts a different filesystem inside `extensionRoot` | Locations | `rename` would fail with `EXDEV`; caught and reported as a warning |
| A6 | Upstream's 500-char truncation applies to the whole note including the `Plugin dependency install failed (npm): ` prefix | Lockfile table | Off-by-prefix text difference only |
| A7 | Timeout message wording (upstream text not captured) | Platform | Cosmetic; pick one and pin it in tests |

## Open Questions

1. **Reason token reach (blocks planning).** D-PL9-09 wants the `packages not installed` reason and warning severity on the row, but the composers live outside the file list (§7 table), and the `Reason` union is Phase 3's file. Options: (a) widen to `notification-types.ts`, `notification-wire.ts`, `composeInstalledRow`, `update-row.ts` (install + update rows; other surfaces note-only); (b) widen to all six composer sites; (c) note-only now, token deferred with an ID. Recommendation: (a).
2. **Spawn gate form.** D-PL9-11 asks for a rule-pack rule; the codebase already has a stronger test gate that must change anyway. Recommendation: do both (rule pack for the in-editor `policy-violation`, test for dynamic imports) with the corrected exemption list, and record the corrected list against D-PL9-11.
3. **`npm_config_update_notifier=false` in production spawn env.** Keeps argv verbatim, avoids a registry round trip per install and a misleading first line in failure notes. Needs a one-line decision record.
4. **Note wording for the path-source skip** (D-PL9-03) given basename redaction. Suggest: `Packages not installed: run "npm ci --ignore-scripts" in the plugin folder "<basename>"` (exact text is the user's call).
5. **Unparseable `package.json`.** Upstream behavior not captured. Recommendation: warn with a short note (fail-visible, never block).
6. **Files outside the ROADMAP list that PKD-03 needs:** `test/architecture/no-shell-out.test.ts`, `test/architecture/gate-targets.ts`, `.planning/PROJECT.md` (decision rows + NFR-5 text), `AGENTS.md` (NFR-5 constraint line), `.planning/BACKLOG.md` (PKGDEP-02/03 entries, D-PL9-08).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes (local) | 26.12.1 local; CI pins 24 | -- |
| npm | production spawn; cucumber scenarios | yes | 11.20.0 local | none for the scenario |
| bun | `bun.lock` path | local only | 1.4.4 | unit tests with an injected runner; no bun scenario (CI has no bun [ASSUMED]) |
| fallow | rule-pack check | yes | ^3.33.1 | -- |
| jq | existing docs test | assumed present (already required) | -- | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** bun on CI (cover by unit tests only).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `--experimental-test-coverage` (unit/architecture); `@cucumber/cucumber` ^13.3.0 (behavioral) |
| Config file | `package.json` scripts; `cucumber.json` |
| Quick run command | `node --test test/orchestrators/plugin/package-install.test.ts test/platform/package-manager.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKD-01 | table order and argv per lockfile; trigger fields; skip when no package.json / no lockfile / no deps | unit | `node --test test/orchestrators/plugin/package-install.test.ts` | Wave 0 |
| PKD-01 | work dir gets only package.json + lockfile; rename into root; park/restore old `node_modules`; work dir removed in `finally` | unit (real tmp dirs, stubbed runner) | same | Wave 0 |
| PKD-01 | spawn: no shell, cwd, timeout -> `timedOut`, ENOENT -> `error`, never rejects | unit (real `process.execPath -e`) | `node --test test/platform/package-manager.test.ts` | Wave 0 |
| PKD-01 | install of a git-marketplace plugin with `package-lock.json` installs `pkd-dep`; the SessionStart hook loads it | behavioral | `npx cucumber-js --name '<title>'` on `features/plugin/package-dependencies.feature` | Wave 0 |
| PKD-01 | update to a new revision reinstalls packages | behavioral or unit (materialize-latest) | `node --test test/orchestrators/plugin/materialize-latest.test.ts` | exists, extend |
| PKD-02 | npm failure / timeout / refusal / path-source skip -> note, row still installed, record written | unit + behavioral | `node --test test/orchestrators/plugin/package-install.test.ts`; cucumber failure + refusal scenarios | Wave 0 |
| PKD-02 | `undo` removes created `node_modules` when `statePhase` throws; leaves a pre-existing one | unit | install-outcome or package-install test | Wave 0 |
| PKD-02 | updated outcome keeps `partition: "updated"` and gains the note | unit | `node --test test/orchestrators/plugin/materialize-latest.test.ts` (path-source + lockfile fixture triggers the note with no spawn) | extend |
| PKD-02 | reason enrolled (if widened) | architecture | `node --test test/architecture/notify-closed-set-locks.test.ts test/architecture/compat-01-no-expansion.test.ts test/architecture/wire-schema.test.ts test/shared/notification-types.test.ts` | exist, edit |
| PKD-03 | only sanctioned files import child_process | architecture + fallow | `node --test test/architecture/no-shell-out.test.ts`; `npm run fallow` | exist, edit |
| PKD-03 | only package-install.ts imports the platform module | lint | `npx eslint extensions/pi-claude-marketplace eslint.config.js` (or `npm run lint`) | config edit |
| all | combined gate | full | `npm run check` | -- |

Coverage per pair: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts` (and the platform module, install-outcome, materialize-latest).

### Sampling Rate
- **Per task commit:** owner test + `npm run test:coverage:direct -- <source>`; the hook runs `check:commit`.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/platform/package-manager.test.ts` -- PKD-01/02 spawn contract
- [ ] `test/orchestrators/plugin/package-install.test.ts` -- table, detection, containment, swap, notes, phase undo
- [ ] `features/lib/npm-registry.ts` -- stand-in + tarball/lockfile builder (recipe above)
- [ ] `features/plugin/package-dependencies.feature` + its step module
- [ ] Spike: SessionStart hook observable in the cucumber RPC session (A3)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- (npm uses the user's own registry auth from `~/.npmrc`) |
| V3 Session Management | no | -- |
| V4 Access Control | yes (filesystem) | NFR-10 `assertPathInside`; writes only under `extensionRoot` |
| V5 Input Validation | yes | `JSON.parse` of `package.json` with type narrowing; fixed argv table; `shell: false` |
| V6 Cryptography | no | integrity checks are npm's own |
| V10/V14 Supply chain / config | yes | `--ignore-scripts`, isolated work dir (no plugin `.npmrc`/`bunfig.toml`), frozen lockfile; sanitizer deferred (PKGDEP-03) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lifecycle script execution at install | Elevation | `--ignore-scripts` (both managers) |
| Plugin-supplied `.npmrc` redirecting registry / injecting tokens | Tampering / Info disclosure | copy only `package.json` + lockfile into the work dir; npm's project config root is the work dir |
| Shell injection through names/paths | Tampering | `shell: false`, argv from a closed table, command as a parameter |
| Lockfile with `git:`/`file:`/`link` entries | Tampering | accepted residual (D-PL9-08); a plugin already runs arbitrary code through its hooks/MCP servers |
| Hung or slow package manager | DoS | 60 s bound, SIGTERM then SIGKILL, async spawn so the state lock stays fresh |
| Absolute paths in notes | Info disclosure | `redactAbsolutePaths` in `surfaceDiscoveryWarnings` (NFR-9) |
| Writing into the user's own folder (path source) | Tampering | never written; note only (D-PL9-03) |

## Sources

### Primary (HIGH confidence, read or run this session)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` (371-445, 945-965, 1037-1062, 1405-1553, 1570-1617)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` (1151-1325, 2793-2879)
- `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts` (1-154); `update-swap.ts` (200-326, 1540-1600); `orchestrators/types.ts` (300-520); `update-preflight.ts` (108-182); `reinstall-flow.ts` (200-211, 385-430); `update-flow.ts` (455-487, 1263-1300); `dependency-bindings.ts` (30-49)
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`; `transaction/with-state-guard.ts:212-217`
- `extensions/pi-claude-marketplace/persistence/locations.ts` (40-170, 215-240, 355-360); `shared/path-containment.ts` (13-140); `shared/redact-absolute-paths.ts`; `domain/version.ts:1-30`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts`, `shared/notification-types.ts` (1-310, 395-470), `shared/notification-wire.ts` (85-164), `shared/notification-dispatch.ts:326-337`, `orchestrators/plugin/shared.ts` (94-160, 1789-1828)
- `extensions/pi-claude-marketplace/platform/git-credential.ts` (40-170); `bridges/hooks/exec-timer.ts` (1-80); `bridges/hooks/dispatch-exec.ts` (130-157); `bridges/hooks/hook-env.ts` (40-80)
- `rule-packs/architecture.json`; `.fallowrc.json`; `eslint.config.js` (30-110, 380-554)
- `test/architecture/no-shell-out.test.ts`; `test/architecture/gate-targets.ts`; `test/architecture/notify-closed-set-locks.test.ts`; `test/transaction/phase-ledger.test.ts`; `test/orchestrators/plugin/materialize-latest.test.ts`
- `features/support/pi-process.ts`, `features/lib/pi-process.ts`, `test/e2e/_rpc.ts` (36-70, 180-210, 377-433), `features/lib/published-marketplace.ts` (455-540), `features/lib/field-rows.ts`, `features/lib/run-tokens.ts`
- `node_modules/isomorphic-git/index.js` 1.43.1 (7740-7800); `node_modules/eslint-plugin-import-x` 4.17.1 (`no-restricted-paths`, `module-visitor`)
- Experiments (scratchpad): fallow rule-pack rule load and planted-violation report; import-x zone behavior; sonarjs `no-os-command-from-path`; `tsc` phase assignability; `npm ci` against a loopback registry (success, armed 404, unparseable lockfile, range mismatch, update-notifier on/off, `loglevel=silent`)

### Secondary
- `.planning/phases/09-plugin-package-dependencies/09-CONTEXT.md` upstream evidence (Claude Code 2.1.310 binary, verified by the discuss phase; not re-researched per instructions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- built-ins only; npm behavior measured.
- Architecture: HIGH for ledger/update/locations/gates; MEDIUM for the reason fan-out choice (needs a user decision).
- Pitfalls: HIGH -- each reproduced or read in code.

**Research date:** 2026-10-26
**Valid until:** 2026-11-25 (npm/Node behavior); codebase facts until sibling phases 1, 3, 4, 5 merge.
