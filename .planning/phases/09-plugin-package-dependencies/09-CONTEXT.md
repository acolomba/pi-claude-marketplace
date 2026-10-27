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
plugin, and Claude Code's secret redaction of npm output. (The lockfile
sanitizer was ported on 2026-10-27; see D-PL9-08.)

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
  lockfile check now applies too (amended 2026-10-27): it came with the
  sanitizer (D-PL9-08), and a checked lockfile that lists no package runs
  nothing and says nothing.
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
- **D-PL9-08 (reversed 2026-10-27: sanitizer ported):** Claude Code
  2.1.310's lockfile check (`k6n` for npm, `E6n` for bun, `J4n` for download
  links) is ported in `domain/package-lockfile.ts`. Before npm or bun runs,
  the plugin's `package.json` and lockfile are checked. Refused: a dependency
  that is not a registry package with a range, dist-tag, or `npm:` alias
  (`file:`, git, URL, tarball specs), a folder link or bundled copy, an entry
  without an exact version, a download link without an integrity hash, a link
  on GitHub, GitLab (outside its package API), Bitbucket, or SourceHut, a
  link whose path starts with `//`, an http link outside npm's own registry,
  `overrides`, and `patchedDependencies`, plus lockfiles that are not JSON,
  are in an old format, or disagree with `package.json`. A refusal is the
  note `Skipped installing this plugin's dependencies: <reason>.`, and npm or
  bun never runs. A lockfile that passes is rewritten: the root becomes
  `plugin-dependencies` at 0.0.0, each entry keeps only the fields that decide
  the install, and npm always reads `package-lock.json`. A lockfile with no
  package runs nothing (the zero-package skip, D-PL9-02). npm runs as
  `npm --git=<workDir>/git-is-disabled ci ...`. When the lockfile holds an
  `"http://` link, `npm config get registry` runs first in the work dir, with
  only a `{}` package.json there and Claude Code's 30-second limit (`uks`);
  the install keeps its 60 seconds. PKGDEP-03 now covers only the secret
  redaction of npm output.
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

### Decisions settled after research (09-RESEARCH.md)

- **D-PL9-14 (warning channel, amends D-PL9-09):** No new closed-set
  reason token. A new `Reason` member reaches `notification-types.ts`,
  `notification-wire.ts`, the generated JSON schema, `docs/json-output.md`,
  and five row composers, which collide with Phases 1 and 3. The install
  ledger pushes the note into `discoveryWarnings` (rendered as a warning
  diagnostic after the row, path-redacted, and forwarded to orchestrated
  callers as `postCommitWarnings`); the update hook appends it to the
  `updated` outcome's `notes`. `shared/notify-reasons.ts` is not touched.
  The row reason is filed as backlog PKGDEP-04 for Phase 11 or later.
- **D-PL9-11 corrected:** only three files import `child_process`
  (`platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`,
  `bridges/hooks/async-rewake/registry.ts`). The new
  `child-process-chokepoint` rule exempts those three plus
  `platform/package-manager.ts`. The existing gate
  `test/architecture/no-shell-out.test.ts` + `SHELL_OUT_EXEMPT_TARGETS`
  in its `gate-targets.ts` gains the new module in the same commit; both
  gates stay (the rule pack misses dynamic `import()`).
- **D-PL9-10 mechanism:** the "only the orchestrator module imports the
  platform module" rule is one `import-x/no-restricted-paths` zone added to
  BLOCK C of `eslint.config.js` (a separate block would replace the rule's
  options). BLOCK F / `NETWORK_SEAMS` is unchanged (it is git-specific).
- **D-PL9-15 (spawn env):** the spawn passes the argv verbatim and adds
  `npm_config_update_notifier=false` to the child env; it never uses
  `spawnSync` (the state lock refresh needs the event loop). The command is
  a parameter (`sonarjs/no-os-command-from-path`).
- **D-PL9-16 (unreadable package.json):** an unparseable `package.json`
  is a warning note ("its package.json is not valid JSON"), never a throw.
- **D-PL9-13 corrected:** the failure scenario arms the registry stand-in
  to answer 404 (npm 11 fetches the packument on a package.json/lockfile
  mismatch, so that shape is not network-free). The sandbox `~/.npmrc`
  sets `registry=<stand-in>`, `update-notifier=false`, `fetch-retries=0`,
  so no scenario can reach the public registry. The success scenario uses a
  git-source marketplace (a directory marketplace hits the D-PL9-03 skip,
  which gets its own scenario).
- **D-PL9-17 (proof the plugin finds its modules):** the planner first
  checks whether a plugin hook or MCP server runs in the cucumber RPC
  session; if one does, the success scenario proves the module loads
  through it; otherwise the scenario checks the installed package file in
  the plugin's `node_modules` and a unit test proves `require` resolution.
- **Governance text:** PROJECT.md / AGENTS.md NFR-5 wording and BACKLOG
  entries are not edited here; the phase SUMMARY carries them for the
  parent (`## Decision rows`, `## Backlog dispositions`).

### Decisions settled after review (2026-10-27)

- **D-PL9-18 (Windows launch):** On Windows a package manager is looked up
  only in the absolute entries of PATH (read through any spelling of the
  variable's name, split on `;`, one pair of quotes stripped), never in the
  current directory. In PATH order, `<command>.exe` comes before
  `<command>.cmd` in each directory. An `.exe` starts directly. `npm.cmd`
  becomes `<Node binary> <npm.cmd folder>\node_modules\npm\bin\npm-cli.js
  <args>` with `shell: false`. A `bun.cmd`, an `npm.cmd` with no `npm-cli.js`
  beside it, and a command that is not found become the failure note. Linux
  and macOS launches do not change. Divergence license: a Pi capability gap.
  Node refuses to spawn a `.cmd` without a shell, so the npm entry route
  replaces upstream's execa/cross-spawn shell route.
- **D-PL9-19 (process-tree kill):** A package manager that outlives the
  timeout is stopped with its whole process tree. On POSIX it starts
  detached, so it leads its own process group; the timeout sends SIGTERM to
  the group and the grace sends SIGKILL to the group. A group signal that
  throws falls back to the process alone, and a pid that is not an integer
  above 1 signals the process alone. On Windows both steps run
  `<SystemRoot>\System32\taskkill.exe /PID <pid> /T /F` with `shell: false`.
  The run never rejects, and it still settles one grace after SIGKILL
  (WR-01). This closes the process-group residue of 09-REVIEW WR-01.
  Divergence license: none needed for the behavior (upstream bounds its
  install too); the mechanism is ours because the launcher is.

### Follow-up decisions (2026-10-27)

- **D-PL9-20 (install-time warning, kept):** A failed, timed-out, or refused package install stays a warning that the install shows with the plugin's row (the D-PL9-14 note). The user kept uncertain choice 2. Pi has no log that the user reads, so this note is the only place where the user learns of the failure until PKGDEP-02's load diagnostic exists.
- **D-PL9-21 (autoupdate cascade note):** When `marketplace update` with autoupdate on updates a plugin, the plugin's package note shows as it does on `/claude:plugin update`. It is one warning diagnostic for each plugin, after the cascade rows and before the MCP config notices, with the header `Plugin "<name>" updated; 1 declared component has a note.` Only the package note shows there. The other notes of the cascade belong to WRN-02, whose shared placement replaces this call when it lands. No Reason member is added.
- **D-PL9-22 (uninstall removes the step's node_modules):** An uninstall removes the node_modules that the package step wrote into the plugin's folder, so a later install of the plugin runs the step again (D-PL9-06 skips a folder that has node_modules). This applies to `uninstall`, to each plugin that `uninstall --prune` or `prune` removes, and to `apply`'s uninstall step. The folder must lie inside `<scopeRoot>/pi-claude-marketplace/`, with no symlink on the way (NFR-10). The step marks what it wrote: before it moves node_modules into the folder, it writes the file `.pi-claude-marketplace` into that node_modules. Uninstall removes only a node_modules that holds this file as a regular file, and only when no other installed plugin of the scope runs from the same folder. The removal runs after the state save and is best effort (D-19-01). It first moves node_modules into `sources-staging` and then deletes it there, so the folder keeps all of its node_modules or none. A node_modules that git or the user put there has no marker, so it stays. This closes 09-REVIEW WR-03 and PKGDEP-05.

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
- **PKGDEP-03:** Claude Code's secret redaction of npm output. (The
  lockfile-content sanitizer it also named was ported on 2026-10-27,
  D-PL9-08.)

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
   Kept by the user: D-PL9-20.
3. **Path-source plugins are not written (D-PL9-03).** Upstream copies every
   plugin into its cache, so it always installs. We run path-source plugins
   from the user's folder, and NFR-10 forbids writing there; we warn instead.
   Alternative: amend NFR-10 to allow `node_modules` in the user's folder.
4. **Sanitizer deferred (D-PL9-08).** A plugin lockfile with `git:` or
   `file:` dependencies installs with us and is refused upstream.
   Alternative: port the sanitizer now. Superseded: D-PL9-08 reversed.
6. **No row reason token (D-PL9-14).** The failure shows as a warning
   diagnostic note, not a `{packages not installed}` reason on the row,
   to stay out of Phase 1/3 files. Alternative: widen this phase to the
   reason vocabulary and the install/update row composers.
7. **Files outside the ROADMAP `Files` line:** `test/architecture/no-shell-out.test.ts`
   and its `gate-targets.ts` (the existing spawn gate fails without them).
5. **Skip when `node_modules` exists (D-PL9-06).** A stale `node_modules`
   after `marketplace update` changes a path-in-clone plugin's lockfile is
   only refreshed by the plugin's `update`. Alternative: always reinstall.
