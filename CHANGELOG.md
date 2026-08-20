# Changelog

## [Unreleased]

## [0.17.0] - 2026-08-19

- A plugin author can now ship a plugin that installs disabled. `defaultEnabled` is an optional boolean that may appear on a marketplace plugin entry and in `plugin.json`, with the marketplace entry winning and absence at both sites resolving to `true`. It is added once to the shared `PLUGIN_METADATA_FIELDS` group, so both the entry and manifest schemas carry it and a non-boolean fails validation like any other schema violation. The precedence rule is answered in the resolver rather than re-derived per consumer.

- Installing a plugin that resolves `defaultEnabled: false` records it disabled and writes `enabled: false` through to that scope's `claude-plugins.json` entry -- the first field the install write-back's plugin patch has ever carried. Its artifacts are not materialized, matching the terminal state of an ordinary disable. An `enabled` value already present in the config entry wins in either direction and is never overwritten, which is the analog of Claude Code's rule that an existing `enabledPlugins` setting takes precedence and persists.

- Nothing later re-enables such a plugin behind the user's back. The state install produces is reconcile-stable, so a `/reload` plans no action for it, and neither `update` nor `reinstall` re-applies the declaration to an already-installed plugin. A plugin release that changes the field therefore does not flip a user's existing choice.

- `list` and `info` say so before the install is run. A not-installed plugin whose marketplace entry declares `defaultEnabled: false`, and for which the user has stated no `enabled` value, renders the new `{installs disabled}` reason token; a config-chosen `enabled: false` renders the row bare, because the token names the author-declared cause only. Both surfaces stay network-free: where the marketplace entry is silent they decline to claim the token on a `plugin.json` value they cannot read, and they do not fetch in order to read it. The install notification reports the outcome at informational severity, since installing disabled is the author's declared intent rather than a shortfall.

- Plugins that declare `defaultEnabled: true`, or declare nothing, behave byte-identically to before across install, update, reinstall, list, info, and reconcile. The enablement contract is written down in the new `docs/plugin-enablement.md`, including the two divergences from Claude Code that remain open: the dependency-requirement override, which cannot be honored because plugin dependency declarations are accepted opaquely and never resolved, and the entry-only pre-install read rule described above.

- A hook handler's `timeout` is now read as seconds, which is what Claude Code's hooks specification declares and what plugin authors write. The bridge consumed the bare number as milliseconds, so a plugin's `timeout: 2` -- two seconds upstream -- armed a 2 ms SIGTERM that killed the handler at spawn. Every declared timeout was a thousand times shorter than written, and a hook killed that way degraded to a silent no-op with nothing in the output to say so. Thanks to @rakesh-vs for the contribution (#138).

- Hook timeout defaults now match Claude Code per event. Upstream gives a `command` handler 600 s and then lowers it -- to 30 s when the hook runs on `UserPromptSubmit`, and to 1.5 s on `SessionEnd`. The bridge applied a flat 600 s everywhere, so a prompt-submit hook, which blocks the turn while it runs, got twenty times the wall clock its author expected. Note this changes behavior for hooks that declared no timeout at all: a `SessionEnd` hook now gets 1.5 s rather than 600 s, and one that needs longer should say so with an explicit `timeout`. Two mechanisms behind those numbers are still missing: upstream shares the `SessionEnd` budget across every such hook, and caps a declared timeout there at 60 s, while the bridge applies it per hook and honors a declared value unbounded.

- Those reductions apply to the synchronous dispatcher only. Upstream lowers them because the handler holds up the turn, which is not true of an `asyncRewake` handler -- it is registered and left to run while dispatch returns immediately -- so background hooks keep the 600 s default on every event. `asyncRewake` is an extension of ours with no upstream analog, so there is no upstream budget for it to match.

- The hooks bridge now carries the field in seconds from end to end, and converts once, inside the timer ladder that installs the `setTimeout` calls. Both execution lanes read the field through one function, so they cannot drift apart on the unit or on the defaults. A hook killed by that ladder now says so on the debug channel, naming the plugin, the event, and the budget it exceeded; it previously arrived as a bare signal kill, indistinguishable from a crash.

- The ladder clamps a timeout to what a timer can represent. `setTimeout` cannot express a delay above about 24.8 days: Node replaces a larger one with a single millisecond and warns on standard error. So a plugin that wrote its timeout in milliseconds to suit the old behavior -- `timeout: 3600000` for an hour -- would have been killed at spawn once that value was read as seconds, landing back in the same no-op by a different route. Such a plugin now runs to the ceiling instead.

- A `timeout` that is not a number falls back to the default for its event, and the hooks schema keeps admitting the field at any type. Declaring it as strictly numeric would make a quoted number a structural parse failure, which is reserved for invalid JSON, a shape mismatch, and a missing required `command`. The blast radius would have been the whole plugin rather than the one field: refused at install and not recoverable with `--force`, and for a plugin already installed, every one of its hooks dropped from the routing table on the next load with no message anywhere.

- Internal only, with no change in behavior: every export that existed so a test could reach it is gone -- 27 `__test_*` re-exports and `_*ForTest` accessors, now zero. Each was resolved by moving the code to the module that owns it rather than by renaming the seam, so the removals arrived as real extractions. The reconcile backfill pass, roughly 450 lines reached through two re-exports and already holding its own test file, became `reconcile/backfill.ts`. The reinstall and install outcome-to-row families moved to the `.messaging.ts` modules that already held those verbs' message vocabulary, and the `ManualRecoveryError` protocol moved beside the class three bridges throw. Extraction surfaced duplication the seams had hidden: three separate depth-5 `Error.cause` walkers, each documenting itself as mirroring the other two, now share one generator and one bound, and a fourth verbatim copy of `errorMessage` is gone.

## [0.16.1] - 2026-08-18

- The development dependency on the Pi host API moved to 0.84.2. That release adds a stop reason for a provider request that Pi deferred to a batch or asynchronous lane, and the turn-boundary hook dispatcher now treats it as an in-flight state that runs no Stop hooks, the same as it already treats a pending request. Nothing in the extension behaves differently on a Pi release that never reports the new reason.

## [0.16.0] - 2026-08-18

- Fixed: an uninstall whose plugin data directory failed the NFR-10 containment check reported plain success while the directory survived. The cleanup step resolves that path through `assertSafeName` twice and `assertPathInside`, and a refactor had moved the call inside the `try` whose `catch` deliberately swallows cleanup leaks, so a refused path became indistinguishable from an `rm` failure. D-19-01 sanctions swallowing the cleanup, not the assertion guarding it. The path is resolved before the guard again, and a test now mounts the data dir as a symlink out of the data root to hold it there.

- Apart from that fix, this release is build and tooling only.

- The `fallow` static-analysis gate now checks the whole repository for dead code, complexity and duplication, and the same `npm run fallow` command runs locally, in the pre-commit hook, and in CI. The local gate previously ran `fallow dead-code --boundary-violations`, and that flag is an only-report filter rather than an addition, so architecture-zone violations were the only thing it checked -- cycles, unused files and exports, complexity and duplication were all ungated locally. CI meanwhile ran a different subcommand over only the changed files and failed on newly-introduced findings alone. A green local run therefore did not imply a green pull request, and neither implied a clean codebase. A green run now means the same thing everywhere.

- Made the codebase compliant with that gate, which is the bulk of the change: 36 functions over the complexity thresholds were decomposed, and duplication fell from 3.6% to 2.1% as copied blocks were replaced by shared helpers. The largest were two copies of the hook environment builder that a comment asked readers to keep in sync by hand, and eight command render maps that re-inlined row bodies their own comments said should be called rather than duplicated. All 3467 unit tests and 21 integration tests pass unchanged throughout, including the catalog suite that compares rendered output byte for byte.

- The hooks bridge's shared module state is now reached through named accessors instead of exported mutable Maps. `routing-state.ts` held four cells under two contradictory conventions: the two `let` bindings were private with accessors, because an importer cannot reassign an imported binding, while the two `const` Maps were exported raw, because interior mutability let them be. The read path had already drifted as a result, with one accessor documenting that callers should not touch the raw table and the caller doing it anyway in two places. Both Maps are private now, with one write surface each.

- An unzoned file is now a build failure that names the path, instead of passing silently unchecked. Zone coverage is complete by construction rather than by accident of the current tree.

- Unused exports and orphan files are now detected and fail the build. Clearing the 154 this exposed removed two entirely dead module barrels, 27 unreferenced declarations, and 13 runtime arrays that existed only to derive a type.

- Removed the aggregate `bridges/index.ts` barrel and pruned 66 dead re-export lines from the five per-kind bridge barrels, which had been declaring 115 symbols public while 49 were consumed. The aggregate barrel was re-exporting all five bridge kinds with `export *`, which both offered a route around the rule forbidding one bridge from importing another, and silently disabled unused-export detection in every file it re-exported -- a star re-export counts as a consumer of everything in its target. Its only user was a lint-boundary test fixture. With it gone, a dead export in any of the five barrels now fails the build, verified by planting one in each.

- Every quality gate now runs exactly when the files it reads change. CI skipped `**/*.md` and `docs/**` on the stated grounds that no test reads repo markdown, which was false: the catalog suite byte-compares 166 rendered examples against `docs/output-catalog.md`, and the SonarCloud job runs the coverage suite that executes it, so a docs-only edit could break that contract without CI ever running. Locally the reverse: the lint, format and typecheck hooks matched `extensions/` but never `tests/`, while the TypeScript project includes both, so a test-only commit skipped about 29 seconds of checks. Each pattern was verified by planting a violation and watching the gate fire.

- The install ledger no longer hands its mutable working context to callers. `runInstallLedger` returned the scratchpad the five phases write into -- rollback handles, a live state snapshot -- which forced that type to be public. It now returns a readonly projection of the four fields that actually cross the module boundary.

## [0.15.0] - 2026-08-14

- Added GitLab support for private marketplace and plugin sources. Adding a `https://gitlab.com/...` marketplace or plugin source now authenticates via RFC 8628 OAuth Device Flow when no credential is cached, the same flow already used for GitHub.
- Fixed a clone failure for GitLab (and any other non-GitHub) `https://` marketplace or plugin source. The network clone URL was missing its `.git` suffix, which made GitLab's smart-HTTP endpoint reject the request with `422 Unprocessable Entity` after a redirect. Every clone and remote-ref resolution for a url-kind or git-subdir-kind source now sends a `.git`-suffixed URL, while the stored source record and cache keys keep their canonical (unsuffixed) form.
- A project-scope plugin's `SessionStart` hooks now fire on the session that starts them. Pi emits `session_start` before `resources_discover`, and the project-scope hook cache was only hydrated on `resources_discover` -- so at dispatch time the `SessionStart` routing bucket held no project entries and those hooks were skipped, becoming reachable only after a later `/reload`. The bridge now hydrates project scope against the event's own `cwd` before dispatching `SessionStart`. User-scope hooks were never affected. Thanks to @rakesh-vs for the contribution (#127).

## [0.14.0] - 2026-08-12

- An installed plugin now survives its entry disappearing from the marketplace manifest. `list` keeps the installation record and marks the row `{not in manifest}` instead of dropping the plugin, and the same reason reaches the LLM `list` tool. A manifest that cannot be read is never reported as a missing entry: absence can only be asserted after a successful load, so an unreadable or malformed manifest keeps its own failure reason instead.
- `info` on such a plugin reports from the installation record rather than returning `(failed)`. Version, install status, and the component inventory across all five kinds are reconstructed from the record, and `info --fetch` emits a skip note instead of reaching the network. Description and dependencies are deliberately not reconstructed -- both are manifest-only metadata, and inferring them from unrelated local state would be a fabrication.
- `uninstall` works on a record whose manifest entry is gone, removing both the staged artifacts and the record, and `update` renders `(skipped) {not in manifest}` rather than failing.
- Disabling a partially installed plugin is recognized as disabled again. The disabled predicate conjoined `compatibility.installable` with `!enabled`, and a partial install always persists `installable: false`, so disabling one produced a record no surface read as disabled. The predicate is now keyed only on `enabled`, which restores list and info rendering, enable and disable idempotency, reconcile steady state, and the update short-circuit.
- A disabled plugin keeps describing itself. Disable still deregisters every artifact -- skills, commands, agents, hooks, and MCP servers are all unstaged -- but the installation record retains its inventory of them, so `info` on a disabled plugin still reports what the plugin contains and still reports it as disabled. Hook detail is read from the record rather than from disk, so it survives the materialized `hooks.json` being removed. A disabled plugin's hooks are not registered on reload even when a `hooks.json` is present on disk, and re-enabling a plugin that owns a skill, command, or agent no longer conflicts with its own record.

## [0.13.0] - 2026-08-05

- Session environment parity. At session start, and again after a session switch or `/reload`, the extension now sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, and the pi-only alias `CLAUDE_SESSION_ID` on Pi's live environment. Bash children and MCP servers spawned afterwards then see the same session variables Claude Code provides. Each installed, enabled plugin's `bin/` directory is appended to `PATH`, deduplicated and recomputed from install state on every session start, and the ledger only removes entries it added itself.
- Hook environment parity. Both hook spawn lanes, synchronous dispatch and async-rewake, now carry `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` from the authoritative session snapshot, alongside the existing `CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set. A drift-guard test pins the two lanes together.
- MCP staging parity. Staged `mcp.json` entries now substitute `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and, for project-scope installs, `${CLAUDE_PROJECT_DIR}` in each server's `command`/`args`/`env`. They also inject `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (plus project-scope `CLAUDE_PROJECT_DIR`) into each server's `env`, with plugin-declared keys winning. `update` and `reinstall` re-derive the staged values, so a plugin-root change never leaves stale paths behind.
- Substitution completion. `${CLAUDE_SKILL_DIR}` now resolves to the skill's installed directory in materialized skill content, and `${CLAUDE_PROJECT_DIR}` resolves to the project root in project-scope skill, command, and agent content. User-scope `${CLAUDE_PROJECT_DIR}` passes through untouched, a documented divergence because its value is unknowable at install time.
- New `docs/env-vars.md`. It documents the per-variable by per-surface environment matrix, the install-time-substitution versus runtime-injection model, and the documented divergences (including the verified pi-mcp-adapter `process.env` inheritance behavior). The environment table in `docs/hooks-compatibility.md` is reconciled against it.

## [0.12.0] - 2026-07-31

- Stop and StopFailure hooks are now bridged (#103). Both fire when the Pi agent settles. Stop fires on a normal ending, with the final assistant message in `last_assistant_message`. StopFailure fires on `error` and `length` endings, with the failure classified into a closed ten-value `error` vocabulary (`rate_limit`, `overloaded`, `billing_error`, ..., `unknown`) and Pi's rendered error text in `last_assistant_message`. A StopFailure matcher filters on the classified value by exact whole-string match (`""` and `"*"` match all). Stop admits only match-all matchers, and a non-empty Stop matcher is reported rather than silently ignored.
- A Stop hook that returns `decision: "block"` re-enters the agent with its reason as a follow-up turn, and `stop_hook_active` is set on re-entry. `additionalContext` output continues the agent the same way. A cap of 8 consecutive bridge re-entries, shared across both lanes, contains runaway loops (D-88-08); hitting the cap breaks the loop with a warning. A `/reload` during Stop-hook execution invalidates the in-flight settle, so a stale hook can neither mutate the new session's loop state nor inject a turn into it.
- The pi-coding-agent peer floor rises to `>=0.80.5` (FLOOR-01), which provides the settle fire point these events require. Hooks declaring `asyncRewake: true` never run on Stop or StopFailure. The settle path skips async-rewake handlers and records the drop in the debug log.

## [0.11.1] - 2026-07-27

- Skill and command sources whose YAML frontmatter cannot be parsed now degrade instead of failing the install. An unparseable skill is synthesized into a known-good `disable-model-invocation` block, with its body preserved verbatim, still invocable by name and never auto-invoked. An unparseable command has its malformed frontmatter block stripped, so Pi falls back to name-from-filename and description-from-first-body-line. The degraded plugin still installs, and its row carries a `{malformed skill}` or `{malformed command}` marker at warning severity rather than failing the whole install. Line-ending edge cases (lone-CR sources), and sources whose body opens with a second malformed block, degrade the same way.
- Generated skill descriptions are augmented for the Pi skill listing. An absent or empty `description` is filled from the first genuine body paragraph, a `when_to_use` field is folded in, and the combined text is capped at 1,536 characters, so a generated skill stays loadable and discoverable without diverging from Claude Code's listing budget. Path variables (`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`) referenced in a description are substituted before the value is quoted, so a Windows-style path can no longer break the emitted frontmatter.

## [0.11.0] - 2026-07-24

- Marketplace and plugin manifests can now declare `mcpServers` as a string reference to a wrapped `.mcp.json` file (relative to the plugin root), not only as an inline server map. The referenced file is read, unwrapped, and its servers install at byte-for-byte parity with the inline form. A reference that is missing, malformed, not wrapped, or that escapes the plugin root (including via a symlink) degrades just that one plugin to `(unavailable)` with a `{malformed mcp}` reason. It never fails the rest of the marketplace load, and an unreadable reference file surfaces its own permission or unreadable reason instead of being reported as malformed.

## [0.10.0] - 2026-07-20

- Claude plugin agents now preserve their skill preloads through conversion (#86). An agent that declares the `Skill` tool maps to `inheritSkills: true` on the generated Pi subagent, so the subagent can invoke skills on demand, instead of dropping the tool and recording it as unsupported. Skills the agent preloads through its frontmatter `skills:` field resolve against the plugin's installed skills and are emitted with an agent-local `skillPath` that points the subagent at them. Skills an agent references without preloading are annotated in an `(available on demand)` legend. Previously these agents were bridged with their skill access stripped.
- Generated agent provenance now renders under a `provenance:` frontmatter mapping (source plugin, agent, and path, plus dropped fields, tools, and warnings as YAML lists) instead of a body HTML comment, so it no longer enters the bridged subagent's system prompt. Already-installed agents in the earlier body-comment format stay recognized, so no reinstall is required.

## [0.9.0] - 2026-07-18

- Git-source plugins. Marketplace manifests can now declare plugin sources as generic git URLs and `git-subdir` references, in addition to `github`, and the full lifecycle is supported: install, update, reinstall, uninstall, and garbage collection all work against a per-scope clone cache. A source pinned to a manifest `sha` uses an immutable per-sha cache entry. An unpinned source is backed by exactly one mutable mirror clone per canonical URL, refreshed in place, so fetched state always derives from a single well-known directory.
- Private git sources authenticate on demand through a provider-auth registry. A private GitHub-hosted source triggers the GitHub Device Flow, and bulk install, update, and reinstall sweeps prompt at most once per host. Credentials are never persisted, logged, or rendered.
- Honest remote status. A not-installed git-source plugin with no local clone renders `(remote)` (`◌`) instead of over-claiming `(available)`, and `list --remote` filters that bucket. Where a clone is already warm, `list` and `info` resolve components on the filesystem only, with no network touch. The disabled glyph moves from `◌` to `◍` to free `◌` for remote.
- New `fetch` verb. `fetch <plugin>@<marketplace>` (or `@<marketplace>`, or bare `fetch` for everything) warms git-source clone caches ahead of install, and `info --fetch` fetches then resolves in one step. Fetched-but-uninstalled clones stay GC-sweepable and self-heal back to `(remote)`. A per-plugin fetch failure renders a `(failed)` row with an actionable reason (`{authentication required}`, `{network unreachable}`, ...) and never aborts the sweep. A corrupt marketplace manifest degrades to a per-marketplace failed block instead of aborting the command.
- Same-repo git plugin sources are now seeded from the local marketplace checkout at `marketplace add` time instead of re-cloned over the network. When a marketplace manifest declares a git-source plugin (generic git URL, `github`, or `git-subdir`) whose canonical clone URL is the repository the marketplace itself lives in, that plugin's clone is materialized by copying the marketplace's own checkout. It then shows as available and installable right after add (no longer `(remote)`), with no extra network. A sha-pinned source is seeded only when the pin is reachable in the local checkout; an unreachable pin falls back to the normal network path. A source pointing at a different repository is unaffected.
- Fixes. A pinned checkout whose commit is not reachable from the manifest ref hint now recovers with a one-shot all-heads fetch. A declined or expired Device Flow classifies as `{authentication required}` instead of `{source missing}` or `{no longer installable}`. `info --fetch` on an installed plugin surfaces a failed fetch instead of degrading silently. A corrupt mirror clone degrades that one plugin instead of blanking its marketplace's tab completions.
- Skill discovery now handles a plugin whose `skills` component path points directly at a skill directory containing `SKILL.md`, rather than at a parent of skill subdirectories. Such a plugin is discovered as a single skill instead of installing with zero skills. Upstream Claude Code supports this shape (for example, `mattpocock/skills`). Thanks to @gabadi for the contribution (#88).
- Internal. A per-verb CLI flag catalog is now the single source of truth for argv parsing and tab-completion flag surfaces, with an architecture guard pinning the two against drift.

## [0.8.0] - 2026-07-02

- BREAKING: the force/unsupported vocabulary is renamed to partial/partially-available across every user-visible surface. The `--force` install/update flag and the `--unsupported` list filter both become `--partial`, with no alias, so update any scripted invocations; `reinstall` still rejects `--force` as an unknown flag. The status tokens move in lockstep: a not-installed force-installable plugin renders `(partially-available)` (was `(unsupported)`), a degraded install renders `(partially-installed)` (was `(force-installed)`), a would-newly-degrade upgrade renders `(partially-upgradable)` (was `(force-upgradable)`), and a deferred degrade install previews as `(will partially install)`. The degrade-decline hint now reads `Re-run with --partial to install/update the supported components.` This is a pure rename. No behavior changes, the `⊖` and `◉` glyph characters are unchanged, and the component-level supportability language (the `{unsupported hooks}` and `{unsupported source}` reason markers, and the per-hook-event `(unsupported)` suffix on `info`) is deliberately preserved: a plugin is *partially available* because some component kinds are unsupported.
- The completion cache bumps its schema version (3 to 4), so any on-disk cache carrying the old force-status literals is dropped and rebuilt automatically on the next read, with no manual step and no reinstall.

## [0.7.0] - 2026-07-01

- Force install and update. `install --force <plugin>@<marketplace>` and `update --force <plugin>` now carry a *partially*-supported plugin through instead of blocking on it. The supported components are materialized and the unsupported ones are recorded and skipped, so a plugin that ships an unsupported component kind (an unmappable hook, an LSP server, a theme) no longer fails the whole operation. Without `--force`, an unsupported plugin still declines, but the decline now names the unsupported kinds and points at `--force`. `--force` on a fully-supported plugin is a plain install, and it never bypasses hard failures. A structurally unavailable plugin, a path-containment violation, a missing marketplace, or an unresolvable source all still block regardless of `--force`.
- Three-way plugin state. The resolver now distinguishes `installable` (every component supported), `unsupported` (some components unsupported, installable with `--force`), and `unavailable` (a structural defect such as an unreadable or invalid manifest, a malformed `hooks.json`, or a path violation, which `--force` cannot help). A not-installed force-installable plugin renders a distinct `(unsupported)` status and `⊖` glyph on `list` and `info` instead of collapsing into `(unavailable)`/`⊘`. A structurally unavailable plugin keeps `(unavailable)`.
- Force-state rows. A force-installed plugin renders `(force-installed)` (`◉`), and one with a newer version available renders `(force-upgradable)`, consistently across `list`, `info`, tab-completion, and the LLM plugin tool. Each carries per-component-kind reason markers (for example `{hooks}` or `{lsp}`) that name exactly what degraded, rendered identically on every surface. `pending` previews a deferred force install as `(will force install)`.
- Partial hook force-install. A plugin whose `hooks.json` mixes supportable and unsupportable handlers now installs the supportable handlers and drops the rest under `--force`, instead of failing the whole plugin as `unavailable`. The dropped handlers are enumerated on `info`.
- Load-time backfill. When a newer version of this extension adds support for a component kind that a force-installed plugin previously had to drop, that plugin is re-materialized automatically on the next reload, with no reinstall, and the load-time cascade reports the promotion. A genuine re-materialize failure surfaces its own `(failed)` row and leaves the backfill to retry on the next load, and a failing plugin no longer aborts the backfill of healthy plugins in the same scope.
- Bulk update grammar. A bulk `update` (and the marketplace autoupdate cascade) now suppresses up-to-date no-op rows and reports the count of updates actually performed (`Plugin update: N updated`) rather than counting at-desired-state plugins. A bulk update with nothing to do reports a clear no-op headline, and a force-installed degrade counts as a realized update.
- `reinstall` no longer accepts `--force` (it always overwrites), and `list --unsupported` filters to force-installable plugins that are not yet installed.

## [0.6.2] - 2026-06-25

- Command outcomes now report their severity by intent rather than by guesswork, so a few messages change. Re-running a command that asks for a state you are already in is treated as success: `update` of an up-to-date plugin, `enable` of an already-enabled plugin, `disable` of an already-disabled one, an idempotent autoupdate flip, and a re-run `bootstrap` all report as info instead of a warning. Asking for something that cannot be carried out is now an error: `install` of an already-installed plugin, `marketplace add` of a name that already exists, and, now consistent with those, `uninstall`, `reinstall`, or `update` of a plugin that is not installed, and `marketplace remove` of a marketplace that is not added. Previously these were warnings, or silent in the case of uninstalling something already gone.
- Error and warning notifications now lead with a one-line summary keyed to the worst outcome (`A plugin operation has failed.` or `Some marketplace operations need attention.`), so the host `Error:` or `Warning:` label no longer glues onto a detail row. Bulk operations also gain a trailing tally (for example, `Plugin install: 1 failure, 2 successes`). Single-target operations omit the tally but still show the leading summary. Mixed load-time cascades (reconcile, import) drop the subject noun and count every row uniformly.
- A plugin row is now always rendered under its marketplace header, so a detail row can no longer appear without the header that scopes it.
- Internal. The notification module was restructured so each command owns its own notification vocabulary (status set, reasons, operation label, and per-status renderer) locally, severity and reload-need are stamped by the command rather than inferred centrally, and the two cross-cutting concerns (the hooks summary and the soft-dependency markers) moved into their own modules. Adding a new command now touches at most three central files and makes zero edits to the notification core. Output for all unchanged surfaces is byte-identical, verified by the catalog byte-equality gate.

## [0.6.1] - 2026-06-21

- Disabled plugins are now tracked by an explicit `enabled` flag in `state.json` instead of being inferred from every resource array being empty. The old heuristic could misclassify an installed plugin that had no materialized resources, a hooks-only plugin in particular, so `enable`/`disable`, `list`, and the reconcile planner now agree on one unambiguous marker. The state schema version bumps to 2, and existing `state.json` files migrate automatically on the next reload. Any plugin you had disabled stays disabled, and no reinstall or manual edit is required.

## [0.6.0] - 2026-06-18

- Claude Code hooks bridge. Plugins shipping `hooks/hooks.json` now run their declared handlers under Pi's lifecycle. The 8 bucket-A Claude events (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `SessionEnd`) dispatch by matcher and `if`-predicate to the handler set declared by every installed plugin. SessionStart `additionalContext` is captured and drained into the next agent turn's system prompt through Pi's `before_agent_start`, preserving multi-plugin concatenation order and clearing on `/reload` so stale context cannot leak across sessions. Hook subprocesses receive `CLAUDE_PLUGIN_ROOT` (the plugin's resolved source path) and `CLAUDE_PLUGIN_DATA` (a per-session writable directory) in their environment. `install`, `uninstall`, `reinstall`, `update`, `enable`, and `disable` all keep the routing table in lockstep with state.json, so dispatch starts working immediately without `/reload` (NFR-2). Async-rewake re-dispatches surviving child processes after a Pi restart, with PID-table reaping, and cross-scope cache walks ensure user and project plugins both surface even when only one scope reconciles.
- BREAKING: `/claude:plugin preview` (introduced in 0.5.0) is renamed to `/claude:plugin pending`. The read-only diff command's behavior and output rows are unchanged. Only the verb in the slash-command surface and the catalog's `empty-steady-state` advisory body line (`Pending: next reload will apply 0 actions.`) move. Update any scripted invocations.
- `resolvedSource` is now a runtime-branded `AbsolutePluginRoot`, validated at the state-IO load boundary (non-empty, absolute, no null byte, and no `..` traversal). The brand propagates through `CacheEntry`, `RoutingEntry`, and every cache mutator, so an unvalidated string cannot reach `CLAUDE_PLUGIN_ROOT` on a dispatched hook subprocess.
- The SessionStart `additionalContext` buffer carries provenance per entry (`{context, scope, marketplace, pluginId}`), so debug telemetry attributes any leak back to the contributing plugin instead of seeing a flat string bag.

## [0.5.0] - 2026-06-12

- New declarative config files. `claude-plugins.json` at each scope root (user `~/.pi/agent/`, project `<cwd>/.pi/`) is now the authoritative record of added marketplaces (source, autoupdate) and installed plugins. A gitignore-able `claude-plugins.local.json` overrides base entries wholesale at the entry level. A corrupt or 0-byte config is an abort signal for that scope; it is never read as "uninstall everything". On the first load after upgrading, the config is generated losslessly from your existing installs. Nothing is uninstalled, and scopes with nothing installed get no file at all.
- Load-time reconciliation. On every Pi startup and `/reload`, installed reality is reconciled to the merged config: declared-but-missing marketplaces and plugins are added or installed, and installed-but-undeclared ones (only those this extension manages) are removed. Network failures soft-fail per entry and never block Pi load, and a repeated load is a strict no-op that rewrites nothing.
- New `/claude:plugin preview` command. A read-only dry run that shows exactly what the next load's reconcile would do (`will add`, `will remove`, `will install`, `will uninstall`, `will enable`, and `will disable` rows), with no writes and no network.
- New `/claude:plugin enable|disable <plugin>@<marketplace>` commands. `disable` keeps the config entry and version pin while removing the plugin's Pi artifacts (rendered as `(disabled)` on list and info and in the command cascade). `enable` re-materializes from the cached marketplace clone with no network, preserving the pinned version.
- Config write-back. Every mutating command (`marketplace add/remove/autoupdate/noautoupdate`, `install/uninstall/reinstall/update`, `import`, and `bootstrap`) records its change in the config file as a targeted entry-level patch. A `--local` flag targets `claude-plugins.local.json` instead, and a `--local` write never touches the base file or shadows its settings. `import` and `bootstrap` write a single batched patch.
- The reconcile cascade now reports each plugin individually when a marketplace remove partially fails: one `(uninstalled)` row per plugin the cascade successfully unstaged, plus one `(failed) {<reason>}` row per plugin that did not, instead of collapsing the whole marketplace into a single failure row.
- Reconcile classifies lock-contention and plugin-shape failures honestly. A concurrent process holding the scope lock now renders `{lock held}`, a config-declared plugin missing from the marketplace manifest renders `{not in manifest}`, and an already-installed or no-longer-installable shape renders its own token, instead of all flattening to `{unreadable}`.
- Invalid-config rows now carry the underlying parse or permission detail as an indented cause line below the row (for example, permission denied, a JSON parse error, or a specific schema key), with absolute paths redacted to basenames before rendering. Before this fix, every invalid-config surface read as a bare `{invalid manifest}`.
- `plugin update` and the marketplace autoupdate cascade on a disabled plugin now refresh the recorded version pin and source without silently re-enabling the plugin. The plugin stays `(disabled)` until you re-run `enable`.
- Autoupdate no longer reports success for a flip it could not persist. When the underlying config write is skipped (no synthesizable source for an adopted entry), the cascade emits a `(failed)` row for that name instead of `(autoupdate enabled)` or `(autoupdate disabled)`.
- `reinstall` and `update` now emit a warning row when the config write-back is skipped because the config file is invalid, instead of completing silently with a success notification.
- README documents the config-file workflow and the `.local` gitignore convention.
- Known limitation: the reconcile report cascade is visible at Pi startup but not after `/reload` (the host TUI rebuilds the chat from the transcript and drops extension notifications). Run `/claude:plugin preview` before reloading, or `list` after, to see what changed.

## [0.4.3] - 2026-06-09

- Internal refactor to cut SonarCloud copy-paste duplication. Shared helpers were extracted across the plugin and marketplace edge handlers (`--map-model` arg-parse boilerplate, and the single-`<name>` marketplace handler factory), the marketplace orchestrators (the `resolveScopeOrNotifyNotAdded` scope-resolution helper, now lifted to `shared.ts`), and the notify plugin-row renderer (the four identical switch arms folded into one helper). There is no behavior or output change; output is byte-identical to before.

## [0.4.2] - 2026-06-08

- Error attribution: every operation now blames the right thing. When a marketplace is not added (or is configured only in the other scope), `install`, `uninstall`, `reinstall`, `update`, `marketplace update`, `marketplace remove`, and `autoupdate`/`noautoupdate` all report `{not added}` on the marketplace, instead of the old misleading `{not in manifest}` on the plugin or a raw error. Cleanup and cascade failures now report the truthful on-disk or permission reason rather than a generic `{not in manifest}`, and a path-source manifest that fails to read reports `{invalid manifest}` instead of a false `{network unreachable}`. A target that exists only in the other scope carries the requested-scope bracket, so you can tell which scope was checked.
- Notification grammar: every error and warning message now leads with a non-empty summary line on the `Error:`/`Warning:` label line, with the detail rendered as its own separate block below. Previously a standalone failure glued the label directly onto the detail row (for example, `Error: ⊘ my-mp [user] (failed) {not added}`). It now reads `Error: 1 marketplace operation failed.` followed by the `⊘ my-mp [user] (failed) {not added}` row underneath. The summary subject follows the failure itself, so a marketplace failure reads `marketplace operation failed` and a plugin failure reads `plugin operation failed`. There are no new commands, and output is otherwise byte-identical to before for non-error surfaces.

## [0.4.1] - 2026-06-07

- Performance: marketplace manifests are now read through a process-lifetime in-memory cache (NFR-8). A repeated `list` or `info` read of an unchanged `marketplace.json` skips the re-read, re-parse, and re-validate and serves the memoized result after a single `stat`. The entry is invalidated and reloaded when the file's modification time or size changes, and parse and validation failures are cached too, so an invalid manifest is not re-parsed on every read. There is no user-visible behavior change; output is byte-identical to before.

## [0.4.0] - 2026-06-04

- New plugin and marketplace info commands. `/claude:plugin marketplace info` and `/claude:plugin info` show detailed information about a given marketplace or plugin.

## [0.3.2] - 2026-06-02

- Transaction resilience hardening. Eight correctness fixes to the saga and two-phase-commit infrastructure that previously produced orphan files, ghost state records, or silently skipped undo on failure paths. There are no user-visible behavior changes on the happy path; the fixes surface only when something goes wrong.
  - Phase-ledger compensation gap: when a phase's `do` throws, `runPhases` now invokes that phase's own `undo` exactly once before reverse-walking previously-executed phases. Previously the failing phase's undo was silently skipped.
  - Bridge commit atomicity: the agents and commands bridges now track completed renames during commit and reverse-walk them on throw, so a partial-commit failure no longer leaves orphan files at the target.
  - Orphan tolerance on reinstall: the `replacePrepared*` paths now pre-remove targets that state.json confirms are owned orphans from a prior partial install, unblocking reinstall without weakening the PI-6 foreign-content guard. The new `removeOrphanIfPresent` helper is kind-strict (file or tree) and ENOENT-tolerant.
  - Cascade ghost-record fix: when a partial cascade unstage drops some resources, `uninstall` and `marketplace remove` now filter the state record by what was actually dropped, instead of leaving the full record pointing at vanished files. Foreign-content (AG-5) failures preserve the row intact.
  - Update state-write reorder: `runThreePhaseUpdate` now writes state after physical commits, not before. An intent-mark (`installable: false`) brackets phase-3a commits, per-bridge resource updates land for every bridge that succeeded, and the version bump happens only on all-success. A second update run on partial-success state converges to the new version cleanly.
  - Documentation and behavior tests for two LOW-priority patterns: agents step-1 ENOENT idempotency (commit retry-safety), and the `availableRowMessage` probe-failure swallow (per D-19-01, probe failures during list are diagnostic noise, not actionable errors).

## [0.3.1] - 2026-06-02

- `/claude:plugin list` now shows each plugin's description (when present in the marketplace manifest) on a second indented line below the plugin row, truncated at 66 characters. This restores the PRD §5.3.1 PL-4 behavior that was inadvertently dropped during the v1.4 structured-notification migration.

## [0.3.0] - 2026-06-01

- GitHub private marketplace authentication via Device Flow (RFC 8628). On first access to a private GitHub marketplace, Pi shows a one-time code and verification URL through `ctx.ui.notify`, and the user authorizes from any browser. Subsequent add and update calls reuse the stored token silently through `git credential fill`.
- Credentials are stored in the OS keychain (macOS Keychain, Windows Credential Manager, or Linux gnome-keyring) through `git credential approve`. No token ever appears in state.json, error messages, or UI output.
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

- Added the `/claude:plugin reinstall` command. It re-stages an installed plugin from its cached marketplace manifest without touching the network or changing the recorded version. It supports `reinstall <plugin>@<marketplace>`, `reinstall @<marketplace>`, bare `reinstall`, `--scope user|project`, and `--force` for plugins whose previous agent files were manually edited. Failure preserves the previous installed plugin, its resources, and its data directory, and the plugin data directory is cleaned up only after the replacement and state commit succeed.

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
