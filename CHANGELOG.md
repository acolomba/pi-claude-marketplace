# Changelog

## [Unreleased]

- A plugin author can now ship a command in a subdirectory of `commands/` and have it register. `commands/build/web.md` becomes `/acme:build:web`, one colon per path segment, to any depth, the same as Claude Code. Such a file was silently dropped before. Thanks to @rakesh-vs (#141).
- The `<plugin>-` prefix is elided from the head of a command source name, and the head is the first path segment when the source is nested. `acme-tools/lint.md` in plugin `acme` becomes `/acme:tools:lint`, where Claude Code registers `acme:acme-tools:lint`. Claude Code performs no elision at all, so a flat `acme-flat.md` already diverged the same way.
- A command whose name is exactly the plugin prefix now installs. `commands/acme-.md` in plugin `acme` registers as `/acme:acme-`, matching Claude Code. It failed to install before, and a directory named `acme-` failed the whole plugin.
- A subdirectory of `commands/` that cannot be read no longer stops the install. Discovery skips it, reports it, and installs the rest of the plugin.
- The same holds for a directory you can read but not search, where every file inside it fails to stat, and for a file whose path cannot produce a valid command name. Both skip one entry instead of the plugin.
- A read failure that says the disk itself is unreliable still stops the install, so a partial plugin is never recorded as a whole one.
- Discovery warnings now reach you. They were all silent before. A standalone `install`, `update` or `reinstall` prints the command and skill warnings under its row. The agent warnings reach the cascade channel that `/reload` and `import` already use.
- A skipped subdirectory is reported, whether it is dotfile-prefixed or a symlink. A skipped file stays silent: it costs you one command, where a directory costs you every command below it.
- A file that two declared commands directories both reach now warns. It installs under two names, which is correct but rarely what the author meant.
- A staging failure names the plugin and the command. A nested source makes the generated name as long as the whole path, so a name too long for the filesystem is now reachable; it used to report a raw error code against an internal temporary path.

## [0.17.0] - 2026-08-19

- A plugin author can now ship a plugin that installs disabled. `defaultEnabled` is an optional boolean on a marketplace plugin entry or in `plugin.json`, with the entry winning and absence resolving to `true`.
- Installing a plugin that resolves `defaultEnabled: false` records it disabled and writes `enabled: false` to that scope's `claude-plugins.json`. An `enabled` value already in the config wins and is never overwritten.
- Nothing later re-enables such a plugin behind your back. A `/reload` plans no action for it, and neither `update` nor `reinstall` re-applies the declaration to an installed plugin.
- `list` and `info` render a `{installs disabled}` reason before you install. Both stay network-free, so they decline to claim the token from a `plugin.json` they cannot read.
- Plugins declaring `defaultEnabled: true`, or declaring nothing, behave byte-identically to before. The new `docs/plugin-enablement.md` records the contract and two open divergences from Claude Code.
- Hook `timeout` now reads as seconds, matching Claude Code. It read as milliseconds before, so every declared timeout fired a thousand times early and killed the handler at spawn. Thanks to @rakesh-vs (#138).
- Sync hook defaults now match Claude Code per event: 30 s on `UserPromptSubmit`, 1.5 s on `SessionEnd`, 600 s elsewhere. A `SessionEnd` hook that needs longer must now declare an explicit `timeout`.
- `asyncRewake` handlers keep the 600 s default on every event, because they do not hold up the turn.
- A hook killed by its timeout now names the plugin, the event, and the budget on the debug channel. It previously looked like a crash.
- A timeout above roughly 24.8 days now clamps to that ceiling, so a plugin that wrote milliseconds for the old behavior still runs.
- A `timeout` that is not a number falls back to its event default instead of failing the install.
- Internal only: the 27 `__test_*` and `_*ForTest` exports are gone, each resolved by moving code to the module that owns it rather than renaming the seam. Extraction also collapsed three duplicate `Error.cause` walkers into one.

## [0.16.1] - 2026-08-18

- The Pi host API dev dependency moved to 0.84.2, which adds a stop reason for a provider request Pi deferred to a batch lane. The turn-boundary dispatcher treats it as in-flight and runs no Stop hooks.

## [0.16.0] - 2026-08-18

- Fixed: an uninstall whose plugin data directory failed the NFR-10 containment check reported success while the directory survived. A refused path is again distinguishable from an `rm` failure.
- Apart from that fix, this release is build and tooling only.
- The `fallow` gate now checks the whole repository for dead code, complexity, and duplication, and runs identically locally, in pre-commit, and in CI. A green local run previously did not imply a green pull request.
- Made the codebase compliant with that gate: 36 functions were decomposed below the complexity thresholds, and duplication fell from 3.6% to 2.1%. All 3467 unit and 21 integration tests pass unchanged.
- The hooks bridge's shared module state is now reached through named accessors instead of exported mutable Maps. Each Map has one write surface.
- An unzoned file is now a build failure that names the path, instead of passing silently unchecked.
- Unused exports and orphan files now fail the build. Clearing the 154 found removed two dead module barrels, 27 unreferenced declarations, and 13 runtime arrays that existed only to derive a type.
- Removed the aggregate `bridges/index.ts` barrel and pruned 66 dead re-export lines from the five per-kind barrels. Its `export *` had silently disabled unused-export detection in every file it re-exported.
- Every quality gate now runs when the files it reads change. CI skipped markdown even though the catalog suite byte-compares 166 examples against `docs/output-catalog.md`, and the local hooks skipped `tests/`.
- `runInstallLedger` now returns a readonly projection of the four fields that cross the module boundary, instead of the mutable scratchpad its five phases write into.

## [0.15.0] - 2026-08-14

- Added GitLab support for private marketplace and plugin sources. A `https://gitlab.com/...` source now authenticates through OAuth Device Flow when no credential is cached, the same flow already used for GitHub.
- Fixed a clone failure for GitLab and other non-GitHub `https://` sources. The clone URL lacked its `.git` suffix, so GitLab rejected the request with `422 Unprocessable Entity`. Stored records keep the unsuffixed form.
- A project-scope plugin's `SessionStart` hooks now fire on the session that starts them. The project hook cache hydrated too late, so those hooks were skipped until a later `/reload`. Thanks to @rakesh-vs (#127).

## [0.14.0] - 2026-08-12

- An installed plugin now survives its entry disappearing from the marketplace manifest. `list` keeps the record and marks the row `{not in manifest}`. An unreadable manifest reports its own failure instead.
- `info` on such a plugin reports from the installation record rather than returning `(failed)`. Description and dependencies are not reconstructed, because both are manifest-only metadata.
- `uninstall` works on a record whose manifest entry is gone, and `update` renders `(skipped) {not in manifest}` rather than failing.
- Disabling a partially installed plugin is recognized as disabled again. The predicate is now keyed only on `enabled`, which restores list, info, idempotency, and reconcile steady state.
- A disabled plugin keeps describing itself. Disable still deregisters every artifact, but the record retains its inventory, so `info` still reports what the plugin contains.

## [0.13.0] - 2026-08-05

- Session environment parity. At session start and after `/reload`, the extension sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_SESSION_ID`. Each enabled plugin's `bin/` directory is appended to `PATH`.
- Hook environment parity. Both spawn lanes now carry `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` from the session snapshot. A drift-guard test pins the two lanes together.
- MCP staging parity. Staged `mcp.json` entries substitute `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and project-scope `${CLAUDE_PROJECT_DIR}`, and inject the same keys into each server's `env`. Plugin-declared keys win.
- `${CLAUDE_SKILL_DIR}` now resolves in skill content, and `${CLAUDE_PROJECT_DIR}` resolves in project-scope content. User scope passes it through untouched, because its value is unknowable at install time.
- New `docs/env-vars.md` documents the variable-by-surface matrix and the documented divergences.

## [0.12.0] - 2026-07-31

- Stop and StopFailure hooks are now bridged (#103). Both fire when the Pi agent settles. StopFailure classifies the failure into a closed ten-value `error` vocabulary that its matcher filters on by exact match.
- A Stop hook returning `decision: "block"` re-enters the agent with its reason and sets `stop_hook_active`. A cap of 8 consecutive re-entries contains runaway loops. A `/reload` invalidates the in-flight settle.
- The pi-coding-agent peer floor rises to `>=0.80.5`, which provides the settle fire point these events need. Hooks declaring `asyncRewake: true` never run on Stop or StopFailure.

## [0.11.1] - 2026-07-27

- Skill and command sources whose YAML frontmatter cannot be parsed now degrade instead of failing the install. The row carries a `{malformed skill}` or `{malformed command}` marker at warning severity.
- Generated skill descriptions are augmented for the Pi listing. An empty `description` is filled from the first body paragraph, `when_to_use` is folded in, and the text is capped at 1,536 characters.

## [0.11.0] - 2026-07-24

- Manifests can now declare `mcpServers` as a string reference to a wrapped `.mcp.json` file, not only as an inline map. A reference that is missing, malformed, or that escapes the plugin root degrades only that plugin.

## [0.10.0] - 2026-07-20

- Claude plugin agents now preserve their skill preloads through conversion (#86). An agent declaring the `Skill` tool maps to `inheritSkills: true`, and preloaded skills resolve against the plugin's installed skills.
- Generated agent provenance now renders under a `provenance:` frontmatter mapping instead of a body HTML comment, so it no longer enters the subagent's system prompt. Existing agents stay recognized.

## [0.9.0] - 2026-07-18

- Git-source plugins. Manifests can declare plugin sources as generic git URLs and `git-subdir` references. Install, update, reinstall, uninstall, and garbage collection all work against a per-scope clone cache.
- Private git sources authenticate on demand through a provider-auth registry. Bulk sweeps prompt at most once per host. Credentials are never persisted, logged, or rendered.
- Honest remote status. A git-source plugin with no local clone renders `(remote)` (`◌`) instead of `(available)`, and `list --remote` filters that bucket. The disabled glyph moves to `◍`.
- New `fetch` verb warms git-source clone caches ahead of install, and `info --fetch` fetches then resolves in one step. A per-plugin failure renders a `(failed)` row and never aborts the sweep.
- Same-repo git plugin sources are now seeded from the local marketplace checkout at `marketplace add` time instead of re-cloned. Such a plugin is installable right after add, with no extra network.
- Fixes. An unreachable pinned commit recovers with a one-shot all-heads fetch. A declined Device Flow classifies as `{authentication required}`. A corrupt mirror clone degrades one plugin instead of blanking tab completions.
- Skill discovery now handles a `skills` path pointing directly at a directory containing `SKILL.md`, rather than at a parent of skill subdirectories. Thanks to @gabadi (#88).
- Internal. A per-verb CLI flag catalog is now the single source of truth for argv parsing and tab completion, with an architecture guard against drift.

## [0.8.0] - 2026-07-02

- BREAKING: the force/unsupported vocabulary is renamed to partial/partially-available on every user-visible surface. `--force` and `--unsupported` both become `--partial`, with no alias, so update any scripted invocations. This is a pure rename.
- The completion cache bumps its schema version from 3 to 4, so a cache carrying the old force-status literals is dropped and rebuilt on the next read. No manual step is needed.

## [0.7.0] - 2026-07-01

- Force install and update. `--force` now carries a partially supported plugin through instead of blocking. Supported components are materialized and unsupported ones recorded and skipped. It never bypasses hard failures.
- Three-way plugin state. The resolver distinguishes `installable`, `unsupported` (installable with `--force`), and `unavailable` (a structural defect `--force` cannot help). Each renders its own status and glyph.
- Force-state rows. A force-installed plugin renders `(force-installed)` (`◉`) across list, info, completion, and the LLM tool, with per-kind reason markers naming exactly what degraded.
- Partial hook force-install. A `hooks.json` mixing supportable and unsupportable handlers now installs the supportable ones under `--force` instead of failing the whole plugin.
- Load-time backfill. When a newer extension version adds support for a kind a force-installed plugin had to drop, that plugin is re-materialized on the next reload, with no reinstall.
- Bulk update grammar. A bulk `update` suppresses up-to-date no-op rows and reports the count actually performed, rather than counting at-desired-state plugins.
- `reinstall` no longer accepts `--force`, because it always overwrites. `list --unsupported` filters to force-installable plugins that are not yet installed.

## [0.6.2] - 2026-06-25

- Command outcomes now report severity by intent. Re-running a command that asks for a state you are already in reports as info. Asking for something that cannot be carried out is now an error.
- Error and warning notifications lead with a one-line summary keyed to the worst outcome, so the host label no longer glues onto a detail row. Bulk operations gain a trailing tally.
- A plugin row is now always rendered under its marketplace header, so a detail row cannot appear without the header that scopes it.
- Internal. The notification module was restructured so each command owns its notification vocabulary locally. Output is byte-identical, verified by the catalog gate.

## [0.6.1] - 2026-06-21

- Disabled plugins are now tracked by an explicit `enabled` flag in `state.json` instead of inferred from empty resource arrays, which misclassified hooks-only plugins. The schema bumps to 2 and migrates automatically. Disabled plugins stay disabled.

## [0.6.0] - 2026-06-18

- Claude Code hooks bridge. Plugins shipping `hooks/hooks.json` now run their handlers under Pi's lifecycle, across the 8 bucket-A events. Every lifecycle command keeps the routing table in lockstep, so dispatch works without `/reload`.
- BREAKING: `/claude:plugin preview` is renamed to `/claude:plugin pending`. Behavior and output rows are unchanged. Update any scripted invocations.
- `resolvedSource` is now a runtime-branded `AbsolutePluginRoot`, validated at the state-IO load boundary, so an unvalidated string cannot reach `CLAUDE_PLUGIN_ROOT` on a dispatched hook subprocess.
- The SessionStart `additionalContext` buffer carries provenance per entry, so debug telemetry attributes any leak back to the contributing plugin.

## [0.5.0] - 2026-06-12

- New declarative config files. `claude-plugins.json` at each scope root is now the authoritative record of added marketplaces and installed plugins. A corrupt or empty config aborts that scope, and is never read as "uninstall everything".
- Load-time reconciliation. On every startup and `/reload`, installed reality is reconciled to the merged config. Network failures soft-fail per entry and never block Pi load.
- New `/claude:plugin preview` command. A read-only dry run showing what the next load's reconcile would do, with no writes and no network.
- New `enable` and `disable` commands. `disable` keeps the config entry and version pin while removing the plugin's Pi artifacts. `enable` re-materializes from the cached clone with no network.
- Config write-back. Every mutating command records its change as a targeted entry-level patch. A `--local` flag targets `claude-plugins.local.json` and never touches the base file.
- The reconcile cascade now reports each plugin individually when a marketplace remove partially fails, instead of collapsing the whole marketplace into one failure row.
- Reconcile classifies lock-contention and plugin-shape failures honestly. Contention renders `{lock held}` and a missing manifest entry renders `{not in manifest}`, instead of all flattening to `{unreadable}`.
- Invalid-config rows now carry the parse or permission detail as an indented cause line, with absolute paths redacted to basenames. Every such surface previously read as a bare `{invalid manifest}`.
- `plugin update` and the autoupdate cascade on a disabled plugin now refresh the version pin without silently re-enabling it. The plugin stays `(disabled)` until you re-run `enable`.
- Autoupdate no longer reports success for a flip it could not persist. A skipped config write emits a `(failed)` row for that name.
- `reinstall` and `update` now emit a warning row when config write-back is skipped because the config file is invalid, instead of completing silently.
- README documents the config-file workflow and the `.local` gitignore convention.
- Known limitation: the reconcile report is visible at Pi startup but not after `/reload`, because the host TUI rebuilds the chat from the transcript. Run `preview` before reloading, or `list` after.

## [0.4.3] - 2026-06-09

- Internal refactor to cut SonarCloud copy-paste duplication. Shared helpers were extracted across the edge handlers, the marketplace orchestrators, and the notify row renderer. Output is byte-identical.

## [0.4.2] - 2026-06-08

- Error attribution: every operation now blames the right thing. A marketplace that is not added reports `{not added}` on the marketplace, instead of a misleading `{not in manifest}` on the plugin.
- Notification grammar: every error and warning now leads with a summary line, with the detail rendered as its own block below. A standalone failure previously glued the label onto the detail row.

## [0.4.1] - 2026-06-07

- Performance: marketplace manifests are now read through a process-lifetime in-memory cache (NFR-8). An entry is invalidated when the file's modification time or size changes. Failures are cached too, and output is byte-identical.

## [0.4.0] - 2026-06-04

- New plugin and marketplace info commands. `/claude:plugin marketplace info` and `/claude:plugin info` show detailed information about a given marketplace or plugin.

## [0.3.2] - 2026-06-02

- Transaction resilience hardening. Eight correctness fixes to the saga and two-phase-commit infrastructure that previously produced orphan files, ghost state records, or skipped undo. No happy-path behavior changes.
  - Phase-ledger compensation: a failing phase's own `undo` now runs once before the reverse walk. It was previously skipped.
  - Bridge commit atomicity: the agents and commands bridges reverse-walk completed renames on throw, so a partial commit leaves no orphans.
  - Orphan tolerance on reinstall: `replacePrepared*` pre-removes targets that `state.json` confirms are owned orphans, without weakening the PI-6 guard.
  - Cascade ghost records: a partial unstage now filters the state record by what actually dropped, instead of pointing at vanished files.
  - Update state-write reorder: state is written after physical commits, so a second run on partial-success state converges cleanly.
  - Documented and tested two lower-priority patterns: agents step-1 ENOENT idempotency, and the `availableRowMessage` probe-failure swallow.

## [0.3.1] - 2026-06-02

- `list` now shows each plugin's description on a second indented line, truncated at 66 characters. This restores the PL-4 behavior dropped during the structured-notification migration.

## [0.3.0] - 2026-06-01

- GitHub private marketplace authentication via Device Flow (RFC 8628). On first access, Pi shows a one-time code and verification URL, and the user authorizes from any browser. Later calls reuse the stored token.
- Credentials are stored in the OS keychain through `git credential approve`. No token ever appears in state.json, error messages, or UI output.
- Git Credential Manager users: `GCM_INTERACTIVE=never` ensures Pi's own Device Flow UI is used instead of GCM's browser flow.
- A stale token is automatically evicted through `git credential reject`, and Device Flow is re-triggered on auth failure.

## [0.2.0] - 2026-05-31

- Overhauled operation output. All commands now use a consistent format of a marketplace header with indented plugin rows, carrying status tokens, cause chains, and soft-dependency markers.
- The `/reload to pick up changes` hint now only appears when a Pi-visible resource actually changed (no more spurious hints on read-only or no-op operations).
- Benign no-ops (already up-to-date, idempotent autoupdate flips) render as dim status text instead of yellow Warning: output.
- `update <plugin>@<marketplace>` for a plugin not in the manifest now reports `(failed) {not in manifest}`, matching `install`'s behavior, instead of the misleading `(skipped) {not installed}`.
- Autoupdate surface: `<autoupdate>` and `<no autoupdate>` marker tokens, and a `marketplace update` no-op renders `(skipped) {up-to-date}`.
- Hash-version plugins display as `v#abc1234` (git short SHA) instead of `vhash-2ea95f85703d`, and plugin.json declared versions take precedence over content hashes.

## [0.1.7] - 2026-05-16

- Added the `/claude:plugin reinstall` command. It re-stages an installed plugin from its cached manifest without touching the network or changing the recorded version. Failure preserves the previous plugin and its data.

## [0.1.6] - 2026-05-16

- Added a convenience `import` command to install marketplaces and plugins defined in the Claude Code configuration.

## [0.1.5] - 2026-05-16

- Added the `/claude:plugin bootstrap` command. It performs a one-shot setup of the official Anthropic marketplace (`anthropics/claude-plugins-official`) in user scope with autoupdate enabled. It is idempotent and safe to re-run.
- Model specifications in plugin agent manifests are ignored unless the `--map-models` option is used when installing or updating a plugin.

## [0.1.4] - 2026-05-15

- Clearer marketplace and plugin scoping rules.
- Completion on `/claude:plugin install` is limited to available plugins.

## [0.1.3] - 2026-05-15

- Fixed user-scope path resolution to honor Pi's agent home override.
- Updated the demo recording to use an isolated Pi home.

## [0.1.2] - 2026-05-13

- Lowered Node.js engine requirement to `>=20.19.0` and downgraded `write-file-atomic` to v7 for broader compatibility.
- Updated project branding images (SVG and PNG).

## [0.1.1] - 2026-05-13

- Moved @mariozechner packages to @earendil-works packages.

## [0.1.0] - 2026-05-12

- Initial release of `pi-claude-marketplace`.
- Supports four Claude plugin component types in Pi: skills, commands, agents, and MCP servers.
