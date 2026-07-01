# Changelog

## [0.7.0] - 2026-07-01

- Force install and update. `install --force <plugin>@<marketplace>` and `update --force <plugin>` now carry a *partially*-supported plugin through instead of blocking on it: the supported components are materialized and the unsupported ones are recorded and skipped, so a plugin that ships an unsupported component kind (an unmappable hook, an LSP server, a theme) no longer fails the whole operation. Without `--force`, an unsupported plugin still declines -- but the decline now names the unsupported kinds and points at `--force`. `--force` on a fully-supported plugin is a plain install, and it never bypasses hard failures: a structurally unavailable plugin, a path-containment violation, a missing marketplace, or an unresolvable source all still block regardless of `--force`.
- Three-way plugin state. The resolver now distinguishes `installable` (every component supported), `unsupported` (some components unsupported, installable with `--force`), and `unavailable` (a structural defect -- unreadable/invalid manifest, malformed `hooks.json`, path violation -- that `--force` cannot help). A not-installed force-installable plugin renders a distinct `(unsupported)` status and `⊖` glyph on `list`/`info` instead of collapsing into `(unavailable)`/`⊘`; a structurally unavailable plugin keeps `(unavailable)`.
- Force-state rows. A force-installed plugin renders `(force-installed)` (`◉`), and one with a newer version available renders `(force-upgradable)`, consistently across `list`, `info`, tab-completion, and the LLM plugin tool. Each carries per-component-kind reason markers (e.g. `{hooks}`, `{lsp}`) naming exactly what degraded, rendered identically on every surface; `pending` previews a deferred force install as `(will force install)`.
- Partial hook force-install. A plugin whose `hooks.json` mixes supportable and unsupportable handlers now installs the supportable handlers and drops the rest under `--force`, instead of failing the whole plugin as `unavailable`; the dropped handlers are enumerated on `info`.
- Load-time backfill. When a newer version of this extension adds support for a component kind that a force-installed plugin previously had to drop, that plugin is re-materialized automatically on the next reload -- no reinstall -- and the load-time cascade reports the promotion. A genuine re-materialize failure surfaces its own `(failed)` row and leaves the backfill to retry on the next load, and a failing plugin no longer aborts the backfill of healthy plugins in the same scope.
- Bulk update grammar. A bulk `update` (and the marketplace autoupdate cascade) now suppresses up-to-date no-op rows and reports the count of updates actually performed (`Plugin update: N updated`) rather than counting at-desired-state plugins; a bulk update with nothing to do reports a clear no-op headline, and a force-installed degrade counts as a realized update.
- `reinstall` no longer accepts `--force` (it always overwrites), and `list --unsupported` filters to force-installable plugins that are not yet installed.

## [0.6.2] - 2026-06-25

- Command outcomes now report their severity by intent rather than by guesswork, so a few messages change. Re-running a command that asks for a state you are already in is treated as success: `update` of an up-to-date plugin, `enable` of an already-enabled plugin, `disable` of an already-disabled one, an idempotent autoupdate flip, and a re-run `bootstrap` all report as info instead of a warning. Asking for something that cannot be carried out is now an error: `install` of an already-installed plugin, `marketplace add` of a name that already exists, and -- newly consistent -- `uninstall`, `reinstall`, or `update` of a plugin that is not installed, and `marketplace remove` of a marketplace that is not added (previously these were warnings, or in the uninstall-of-an-already-gone case, silent).
- Error and warning notifications now lead with a one-line summary keyed to the worst outcome (`A plugin operation has failed.` / `Some marketplace operations need attention.`), so the host `Error:` / `Warning:` label no longer glues onto a detail row. Bulk operations also gain a trailing tally (e.g. `Plugin install: 1 failure, 2 successes`); single-target operations omit the tally but still show the leading summary. Mixed load-time cascades (reconcile, import) drop the subject noun and count every row uniformly.
- A plugin row is now always rendered under its marketplace header -- a detail row can no longer appear without the header that scopes it.
- Internal: the notification module was restructured so each command owns its own notification vocabulary (status set, reasons, operation label, and per-status renderer) locally, severity and reload-need are stamped by the command rather than inferred centrally, and the two cross-cutting concerns (the hooks summary and soft-dependency markers) moved into their own modules. Adding a new command now touches at most three central files and zero edits to the notification core. Output for all non-changed surfaces is byte-identical, verified by the catalog byte-equality gate.

## [0.6.1] - 2026-06-21

- Disabled plugins are now tracked by an explicit `enabled` flag in `state.json` instead of being inferred from every resource array being empty. The old heuristic could misclassify an installed plugin that had no materialized resources -- a hooks-only plugin in particular -- so `enable`/`disable`, `list`, and the reconcile planner now agree on one unambiguous marker. The state schema version bumps to 2 and existing `state.json` files migrate automatically on the next reload; any plugin you had disabled stays disabled, and no reinstall or manual edit is required.

## [0.6.0] - 2026-06-18

- Claude Code hooks bridge: plugins shipping `hooks/hooks.json` now run their declared handlers under Pi's lifecycle. The 7 bucket-A Claude events (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `SessionEnd`) dispatch by matcher + `if`-predicate to the handler set declared by every installed plugin. SessionStart `additionalContext` is captured and drained into the next agent turn's system prompt via Pi's `before_agent_start`, preserving multi-plugin concat order and clearing on `/reload` so stale context cannot leak across sessions. Hook subprocesses receive `CLAUDE_PLUGIN_ROOT` (the plugin's resolved source path) and `CLAUDE_PLUGIN_DATA` (a per-session writable dir) on env; install/uninstall/reinstall/update/enable/disable all keep the routing table in lockstep with state.json so dispatch starts working immediately without `/reload` (NFR-2). Async-rewake re-dispatches surviving child processes after a Pi restart with PID-table reaping; cross-scope cache walks ensure user + project plugins both surface even when only one scope reconciles.
- BREAKING: `/claude:plugin preview` (introduced in 0.5.0) is renamed to `/claude:plugin pending`. The read-only diff command's behavior and output rows are unchanged; only the verb in the slash-command surface and the catalog's `empty-steady-state` advisory body line (`Pending: next reload will apply 0 actions.`) move. Update any scripted invocations.
- `resolvedSource` is now a runtime-branded `AbsolutePluginRoot` validated at the state-IO load boundary (non-empty + absolute + no null byte + no `..` traversal). The brand propagates through `CacheEntry`, `RoutingEntry`, and every cache mutator so an unvalidated string cannot reach `CLAUDE_PLUGIN_ROOT` on a dispatched hook subprocess.
- SessionStart `additionalContext` buffer carries provenance per entry (`{context, scope, marketplace, pluginId}`), so debug telemetry attributes any leak back to the contributing plugin instead of seeing a flat string bag.

## [0.5.0] - 2026-06-12

- New declarative config files. `claude-plugins.json` at each scope root (user `~/.pi/agent/`, project `<cwd>/.pi/`) is now the authoritative record of added marketplaces (source, autoupdate) and installed plugins; a gitignore-able `claude-plugins.local.json` overrides base entries wholesale at the entry level. A corrupt or 0-byte config is an abort signal for that scope -- it is never read as "uninstall everything". On the first load after upgrading, the config is generated losslessly from your existing installs; nothing is uninstalled, and scopes with nothing installed get no file at all.
- Load-time reconciliation. On every Pi startup and `/reload`, installed reality is reconciled to the merged config: declared-but-missing marketplaces/plugins are added/installed, installed-but-undeclared ones (only those this extension manages) are removed. Network failures soft-fail per entry and never block Pi load; a repeated load is a strict no-op that rewrites nothing.
- New `/claude:plugin preview` command: a read-only dry run showing exactly what the next load's reconcile would do (`will add` / `will remove` / `will install` / `will uninstall` / `will enable` / `will disable` rows); no writes, no network.
- New `/claude:plugin enable|disable <plugin>@<marketplace>` commands. `disable` keeps the config entry and version pin while removing the plugin's Pi artefacts (rendered as `(disabled)` on list/info and in the command cascade); `enable` re-materializes from the cached marketplace clone with no network, preserving the pinned version.
- Config write-back. Every mutating command (`marketplace add/remove/autoupdate/noautoupdate`, `install/uninstall/reinstall/update`, `import`, `bootstrap`) records its change in the config file as a targeted entry-level patch; a `--local` flag targets `claude-plugins.local.json` instead, and a `--local` write never touches the base file or shadows its settings. `import` and `bootstrap` write a single batched patch.
- Reconcile cascade now reports each plugin individually when a marketplace remove partially fails: one `(uninstalled)` row per plugin the cascade successfully unstaged plus one `(failed) {<reason>}` row per plugin that did not, instead of collapsing the whole marketplace into a single failure row.
- Reconcile classifies lock-contention and plugin-shape failures honestly: a concurrent process holding the scope lock now renders `{lock held}`, a config-declared plugin missing from the marketplace manifest renders `{not in manifest}`, and an already-installed or no-longer-installable shape renders its own token, instead of all flattening to `{unreadable}`.
- Invalid-config rows now carry the underlying parse or permission detail as an indented cause line below the row (e.g. permission denied vs JSON parse error vs specific schema key), with absolute paths redacted to basenames before rendering. Pre-fix every invalid-config surface read as bare `{invalid manifest}`.
- `plugin update` and the marketplace autoupdate cascade on a disabled plugin now refresh the recorded version pin and source without silently re-enabling the plugin; the plugin stays `(disabled)` until you re-run `enable`.
- Autoupdate no longer reports success for a flip it could not persist: when the underlying config write is skipped (no synthesizable source for an adopted entry), the cascade emits a `(failed)` row for that name instead of `(autoupdate enabled)` / `(autoupdate disabled)`.
- `reinstall` and `update` now emit a warning row when the config write-back is skipped because the config file is invalid, instead of completing silently with a success notification.
- README documents the config-file workflow and the `.local` gitignore convention.
- Known limitation: the reconcile report cascade is visible at Pi startup but not after `/reload` (the host TUI rebuilds the chat from the transcript and drops extension notifications); run `/claude:plugin preview` before reloading or `list` after to see what changed.

## [0.4.3] - 2026-06-09

- Internal refactor to cut SonarCloud copy-paste duplication: extracted shared helpers across the plugin and marketplace edge handlers (`--map-model` arg-parse boilerplate; the single-`<name>` marketplace handler factory), the marketplace orchestrators (the `resolveScopeOrNotifyNotAdded` scope-resolution helper, now lifted to `shared.ts`), and the notify plugin-row renderer (the four identical switch arms folded into one helper). No behavior or output change -- output is byte-identical to before.

## [0.4.2] - 2026-06-08

- Error attribution: every operation now blames the right thing. When a marketplace is not added (or is configured only in the other scope), `install`, `uninstall`, `reinstall`, `update`, `marketplace update`, `marketplace remove`, and `autoupdate`/`noautoupdate` all report `{not added}` on the marketplace, instead of the old misleading `{not in manifest}` on the plugin or a raw error. Cleanup and cascade failures now report the truthful on-disk/permission reason rather than a generic `{not in manifest}`, and a path-source manifest that fails to read reports `{invalid manifest}` instead of a false `{network unreachable}`. A target that exists only in the other scope carries the requested-scope bracket so you can tell which scope was checked.
- Notification grammar: every error/warning message now leads with a non-empty summary line on the `Error:`/`Warning:` label line, with the detail rendered as its own separate block below. Previously a standalone failure glued the label directly onto the detail row (e.g. `Error: ⊘ my-mp [user] (failed) {not added}`); it now reads `Error: 1 marketplace operation failed.` followed by the `⊘ my-mp [user] (failed) {not added}` row underneath. The summary subject follows the failure itself, so a marketplace failure reads `marketplace operation failed` and a plugin failure reads `plugin operation failed`. No new commands; output is otherwise byte-identical to before for non-error surfaces.

## [0.4.1] - 2026-06-07

- Performance: marketplace manifests are now read through a process-lifetime in-memory cache (NFR-8). A repeated `list`/`info` read of an unchanged `marketplace.json` skips the re-read + re-parse + re-validate and serves the memoized result after a single `stat`; the entry is invalidated and reloaded when the file's modification time or size changes, and parse/validation failures are cached too so an invalid manifest is not re-parsed on every read. No user-visible behavior change -- output is byte-identical to before.

## [0.4.0] - 2026-06-04

- New Plugin and marketplace info commands. `/claude:plugin marketplace info` and `/claude:plugin info` show detailed information about a given marketplace or plugin.

## [0.3.2] - 2026-06-02

- Transaction resilience hardening. Eight correctness fixes to the saga/two-phase-commit infrastructure that previously produced orphan files, ghost state records, or silently skipped undo on failure paths. No user-visible behavior changes on the happy path; the fixes surface only when something goes wrong.
  - Phase-ledger compensation gap: when a phase's `do` throws, `runPhases` now invokes that phase's own `undo` exactly once before reverse-walking previously-executed phases. Previously the failing phase's undo was silently skipped.
  - Bridge commit atomicity: agents and commands bridges now track completed renames during commit and reverse-walk them on throw, so a partial-commit failure no longer leaves orphan files at the target.
  - Orphan tolerance on reinstall: `replacePrepared*` paths now pre-remove targets that state.json confirms are owned orphans from a prior partial install, unblocking reinstall without weakening the PI-6 foreign-content guard. New `removeOrphanIfPresent` helper is kind-strict (file/tree) and ENOENT-tolerant.
  - Cascade ghost-record fix: when partial cascade unstage drops some resources, `uninstall` and `marketplace remove` now filter the state record by what was actually dropped instead of leaving the full record pointing at vanished files. Foreign-content (AG-5) failures preserve the row intact.
  - Update state-write reorder: `runThreePhaseUpdate` now writes state AFTER physical commits, not before. An intent-mark (`installable: false`) brackets phase-3a commits; per-bridge resource updates land for every bridge that succeeded; version bump only on all-success. A second update run on partial-success state converges to the new version cleanly.
  - Documentation and behavior tests for two LOW-priority patterns: agents step-1 ENOENT idempotency (commit retry-safety) and the `availableRowMessage` probe-failure swallow (per D-19-01 -- probe failures during list are diagnostic noise, not actionable errors).

## [0.3.1] - 2026-06-02

- `/claude:plugin list` now shows each plugin's description (when present in the marketplace manifest) on a second indented line below the plugin row, truncated at 66 characters. Restores PRD §5.3.1 PL-4 behavior that was inadvertently dropped during the v1.4 structured-notification migration.

## [0.3.0] - 2026-06-01

- GitHub private marketplace authentication via Device Flow (RFC 8628). On first access to a private GitHub marketplace, Pi shows a one-time code and verification URL via `ctx.ui.notify`; the user authorizes from any browser. Subsequent add/update reuse the stored token silently via `git credential fill`.
- Credentials stored in the OS keychain (macOS Keychain / Windows Credential Manager / Linux gnome-keyring) via `git credential approve`. No token ever appears in state.json, error messages, or UI output.
- Git Credential Manager users: `GCM_INTERACTIVE=never` ensures Pi's own Device Flow UI is used instead of GCM's browser flow.
- Stale token automatically evicted via `git credential reject` and Device Flow re-triggered on auth failure.

## [0.2.0] - 2026-05-31

- Overhauled operation output: all commands now use a consistent marketplace-header + indented-plugin-rows format with status tokens, cause chains, and soft-dependency markers.
- The `/reload to pick up changes` hint now only appears when a Pi-visible resource actually changed (no more spurious hints on read-only or no-op operations).
- Benign no-ops (already up-to-date, idempotent autoupdate flips) render as dim status text instead of yellow Warning: output.
- `update <plugin>@<marketplace>` for a plugin not in the manifest now reports `(failed) {not in manifest}` matching `install`'s behavior, instead of the misleading `(skipped) {not installed}`.
- Autoupdate surface: `<autoupdate>` / `<no autoupdate>` marker tokens; `marketplace update` no-op renders `(skipped) {up-to-date}`.
- Hash-version plugins display as `v#abc1234` (git short SHA) instead of `vhash-2ea95f85703d`; plugin.json declared versions take precedence over content hashes.

## [0.1.7] - 2026-05-16

- Added `/claude:plugin reinstall` command: re-stages an installed plugin from its cached marketplace manifest without touching the network or changing the recorded version. Supports `reinstall <plugin>@<marketplace>`, `reinstall @<marketplace>`, bare `reinstall`, `--scope user|project`, and `--force` for plugins whose previous agent files were manually edited. Failure preserves the previous installed plugin, resources, and data directory; the plugin data directory is cleaned up only after the replacement and state commit succeed.

## [0.1.6] - 2026-05-16

- Added convenience `import` command to install marketplaces and plugins defined in the Claude Code configuration.

## [0.1.5] - 2026-05-16

- Added `/claude:plugin bootstrap` command: one-shot setup of the official Anthropic marketplace (`anthropics/claude-plugins-official`) in user scope with autoupdate enabled. Idempotent -- safe to re-run.
- Model specifications in plugin agent manifests are ignored unless the `--map-models` option is used when installing or updatinga plugin.

## [0.1.4] - 2026-05-15

- Clearer marketplace/plugin scoping rules.
- Completion on `/claude:plugin install` is limited to available plugins.

## [0.1.3] - 2026-05-15

- Fixed user-scope path resolution to honor Pi's agent home override.
- Updated the demo recording to use an isolated Pi home.

## [0.1.2] - 2026-05-13

- Lowered Node.js engine requirement to `>=20.19.0` and downgraded `write-file-atomic` to v7 for broader compatibility.
- Updated project branding images (SVG/PNG).

## [0.1.1] - 2026-05-13

- Moved @mariozechner packages to @earendil-works packages.

## [0.1.0] - 2026-05-12

- Initial release of `pi-claude-marketplace`.
- Supports four Claude plugin component types in Pi: skills, commands, agents, and MCP servers.
