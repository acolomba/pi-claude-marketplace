# Phase 9: Plugin Package Dependencies - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous (decisions made from upstream evidence, no user prompts)

<domain>
## Phase Boundary

When a plugin's root ships `package.json` plus a supported lockfile, install
and update run the frozen, script-free, 60-second-bounded package install that
Claude Code runs, so the plugin's hooks and MCP servers find their
`node_modules`. A failed, timed-out, or refused package install never blocks
the plugin: it installs with a warning (PKD-01, PKD-02). The new child-process
spawn and the network access it brings are recorded as an NFR-5 amendment and
a spawn chokepoint rule (PKD-03).

**In scope:** a `platform/` process module that runs the package manager; an
orchestrator module that decides whether to run it and builds the warning; one
new phase in the install ledger array; one hook in the update runner; the
warning reason; the rule-pack and ESLint rules.

**Out of scope (deferred, see `<deferred>`):** the load-time "packages not
installed" diagnostic, `update` retrying the package install on an up-to-date
plugin, and Claude Code's lockfile-content sanitizer.

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.310)

Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`,
grepped 2026-10-26 (`strings -n 8`, then the minified chunk that holds
`plugin-dependencies`). The plugins-reference page fetched the same day no
longer documents the feature; BACKLOG PKGDEP-01 quotes the older page.
Confidence: **high** for the table, commands, and timeout (literal constants);
**medium** for the call-site reading (minified names).

- **Lockfile table, in priority order** (first present wins):
  1. `bun.lock` -> `bun install --frozen-lockfile --ignore-scripts`
  2. `npm-shrinkwrap.json` -> `npm ci --ignore-scripts --workspaces=false --no-audit --no-fund`
  3. `package-lock.json` -> same npm command
  4. `bun.lockb` -> refused: "its bun.lockb is a binary lockfile that cannot be
     checked; ship a text bun.lock instead"
- `yarn.lock` / `pnpm-lock.yaml` with no supported lockfile -> not run, error
  "Skipped: yarn/pnpm lockfiles are not supported (resolution-time hooks bypass
  --ignore-scripts). Use bun or npm."
- No `package.json`, or `package.json` with no recognized lockfile -> not run,
  no message.
- A `package.json` that lists no `dependencies`, `optionalDependencies`,
  `peerDependencies`, or `workspaces`, or a lockfile with zero packages -> not
  run, no message.
- Timeout constant `F6n = 60000` ms on the spawn.
- The install runs in a fresh temporary work dir that receives only a
  rewritten `package.json` and lockfile; on exit 0 the work dir's
  `node_modules` is moved into the plugin folder (an existing `node_modules`
  is parked as `previous-node_modules` and restored if the move fails); the
  work dir is removed in `finally`.
- Result messages: `Plugin dependency install failed (<npm|bun>): <stderr or
  stdout or error>` truncated to 500 chars; success is logged only.
- **Call sites:** install and update (new version) call it on the cached copy
  before the install record is written; an error is only a debug-level warning
  (`Plugin dependency install warning for <id>: ...`) and the install
  proceeds. There is **no session-start rerun** in 2.1.310: at load, a plugin
  whose cached copy has `package.json`, no `node_modules`, and a non-empty
  lockfile gets a diagnostic `dependencies-not-installed` ("The packages it
  lists are not installed. Run `claude plugin update <id>` to install them" /
  "If it needs those packages, parts of it may not work") or
  `dependencies-refused`. `plugin update` on an up-to-date plugin with missing
  packages retries the install ("Installed the packages that "<p>" lists for
  scope <s>. Restart to apply changes." / "Could not install the packages that
  "<p>" lists for scope <s>, so parts of it may not work. Updating it again
  retries the install. Cause: ...").
- The lockfile sanitizer (`k6n`/`E6n`) rejects non-registry dependencies,
  folder links, bundled copies, missing integrity hashes, `overrides`, and
  `patchedDependencies`, and renames the root package to `plugin-dependencies`.

</upstream_evidence>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 9; `.planning/REQUIREMENTS.md` PKD-01..03;
  `.planning/BACKLOG.md` PKGDEP-01
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`
  (`runInstallLedgerBody`, the literal phase array at the end; touch the array
  and the new phase only -- Phases 1 and 4 edit other functions)
- `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts`
  (`materializeLatestVersion`; update hook only)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`
  (`UpdateRunOutcome`, read-only for this phase)
- `extensions/pi-claude-marketplace/persistence/locations.ts`
  (`sourcesStagingDir`, `extensionRoot`)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (closed reason
  set; shared with Phase 3 -- add one entry only)
- `rule-packs/architecture.json`, `eslint.config.js` (BLOCK F, `NETWORK_SEAMS`)
- `.agents/skills/cucumber/`, `.agents/skills/typescript-unit-tests/`,
  `.agents/skills/local-verification/SKILL.md`

</canonical_refs>

<deferred>
## Deferred Ideas (backlog entries for the parent to file)

- **PKGDEP-02:** load-time `packages not installed` / `packages refused`
  diagnostic and `update` retrying the package install on an up-to-date
  plugin (upstream 2.1.310). Needs `orchestrators/reconcile/load.ts` and the
  up-to-date path of `update-flow.ts`, outside this phase's files.
- **PKGDEP-03:** Claude Code's lockfile-content sanitizer (registry-only
  dependencies, integrity required, no `overrides`/`patchedDependencies`,
  root renamed `plugin-dependencies`, zero-package skip).

</deferred>

## Uncertain choices (for user review)

1. **No-lockfile is silent (D-PL9-02).** ROADMAP success criterion 2 says a
   "lockfile-less package install leaves the plugin installed with a warning".
   Upstream and BACKLOG PKGDEP-01 skip it silently. Chose upstream; the
   warning applies to refused lockfiles (yarn/pnpm, `bun.lockb`). Alternative:
   warn on `package.json` with no lockfile.
2. **Warning at install time (D-PL9-09).** Upstream only logs at install and
   tells the user at the next load. With no load diagnostic yet, we warn on
   the install row. Alternative: stay silent and build the load diagnostic.
3. **Path-source plugins are not written (D-PL9-03).** Upstream copies every
   plugin into its cache, so it always installs. We run path-source plugins
   from the user's folder, and NFR-10 forbids writing there; we warn instead.
   Alternative: amend NFR-10 to allow `node_modules` in the user's folder.
4. **Sanitizer deferred (D-PL9-08).** A plugin lockfile with `git:` or
   `file:` dependencies installs with us and is refused upstream.
   Alternative: port the sanitizer now.
5. **Skip when `node_modules` exists (D-PL9-06).** A stale `node_modules`
   after `marketplace update` changes a path-in-clone plugin's lockfile is
   only refreshed by the plugin's `update`. Alternative: always reinstall.
