# Requirements: pi-claude-marketplace

**Defined:** 2026-05-09 **Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

> **Source of truth:** All requirement IDs and full text live in `docs/prd/pi-claude-marketplace-prd.md`. This file preserves the PRD's IDs verbatim so existing references stay valid; one-line summaries here are excerpts, not redefinitions. When a summary and the PRD disagree, the PRD wins.

## v1 Requirements

### Marketplace Lifecycle: `marketplace add` (PRD §5.1.1)

- [ ] **MA-1**: Accept `owner/repo`, `https://github.com/owner/repo[.git][#<ref>]`, and any local path (`/`, `./`, `../`, `~`)
- [ ] **MA-2**: When `--scope` is omitted, default to `user`
- [ ] **MA-3**: Local paths accept either a directory containing `.claude-plugin/marketplace.json` or a direct path to that file
- [ ] **MA-4**: Store paths in portable form -- leading `~` preserved verbatim, expanded at access time
- [ ] **MA-5**: GitHub sources clone into `<staging>/<uuid>/`, read manifest, then atomically rename into final location
- [ ] **MA-6**: Non-empty target directory at `sourceCloneDir(name)` from a prior failed add MUST fail with "stale source clone"
- [ ] **MA-7**: Missing `git` on PATH MUST surface the canonical "git not found" error
- [ ] **MA-8**: Duplicate name in chosen scope MUST fail with "remove it first or use a different source"
- [ ] **MA-9**: Manifest-read or state-save failure after clone MUST clean up staged clone; cleanup failures append, not mask
- [ ] **MA-10**: Reject SSH URLs, arbitrary `://` URLs, `owner/repo@<ref>` syntax, and browser-paste `/tree/<ref>` URLs with explanatory hints
- [ ] **MA-11**: Successful add emits `Added marketplace "<name>" in <scope> scope.` and MUST NOT emit a reload hint

### Marketplace Lifecycle: `marketplace remove` / `rm` (PRD §5.1.2)

- [ ] **MR-1**: Without `--scope`, resolve from state; cross-scope ambiguity MUST fail with disambiguation error
- [ ] **MR-2**: Drop installed-plugin staged resources for every plugin, then drop the marketplace record
- [ ] **MR-3**: Per-plugin failures collected into `failedPlugins[]` with `Error.cause`; record retained when any plugin failed; cascade does NOT soften error-grade failures
- [ ] **MR-4**: ONE aggregated `warning`-severity notification listing failed plugins and ending with "fix the underlying issue and retry"
- [ ] **MR-5**: After successful state commit, clean up per-plugin data dirs, marketplace data dir (only on full success), GitHub source clone dir
- [ ] **MR-6**: Post-state cleanup failures aggregated into one "removed but post-state cleanup failed for N path(s)" error
- [ ] **MR-7**: GitHub clone dirs retained when any plugin cleanup failed
- [ ] **MR-8**: Successful removal emits reload hint (verb: `drop`) listing dropped plugins, only when ≥1 plugin's resources were actually removed

### Marketplace Lifecycle: `marketplace list` (PRD §5.1.3)

- [ ] **ML-1**: Output is one line per marketplace, grouped by scope
- [ ] **ML-2**: Each line shows `<icon> <name> (<source.logical>) [autoupdate]?`
- [ ] **ML-3**: MUST NOT load each marketplace's manifest
- [ ] **ML-4**: Empty case emits `No marketplaces configured.`

### Marketplace Lifecycle: `marketplace update` (PRD §5.1.4)

- [ ] **MU-1**: No-name form refreshes every marketplace in chosen scope; empty-set succeeds silently with `No marketplaces configured.`
- [ ] **MU-2**: GitHub sources `git fetch` then `git pull --ff-only` (symbolic HEAD) or re-checkout stored ref (detached HEAD)
- [ ] **MU-3**: Non-fast-forward divergence surfaces as error; recovery is `marketplace remove` + re-add
- [ ] **MU-4**: Manifest pointer re-read and persisted before any plugin cascade runs
- [ ] **MU-5**: If clone advanced but manifest save failed, error MUST tell user "Retry the command."
- [ ] **MU-6**: Plugin upgrade cascade runs only when per-marketplace `autoupdate` flag is true
- [ ] **MU-7**: Cascade partitions plugins into `updated` / `unchanged` / `skipped` / `failed` and renders in that order
- [ ] **MU-8**: Refreshed manifest's new plugins MUST NOT be auto-installed
- [ ] **MU-9**: Successful update emits reload hint listing changed plugins, with soft-dep warnings appended when applicable

### Marketplace Lifecycle: `autoupdate` / `noautoupdate` (PRD §5.1.5)

- [ ] **MAU-1**: `autoupdate` sets per-marketplace flag true; `noautoupdate` clears it; default is off
- [ ] **MAU-2**: No-name form flips flag for every marketplace in chosen scope (or both scopes when `--scope` omitted)
- [ ] **MAU-3**: Idempotent -- already-matching marketplaces reported as `Already enabled/disabled: ...`
- [ ] **MAU-4**: Flag round-trips through `state.json`; missing/undefined treated as `false`

### Plugin Lifecycle: `install` (PRD §5.2.1)

- [ ] **PI-1**: Token parsed as `<plugin>@<marketplace>` with exactly one `@`, both halves non-empty
- [ ] **PI-2**: Resolution consults already-cached manifest; install MUST NOT trigger network sync (asymmetric with `update`)
- [ ] **PI-3**: Plugins not in manifest fail with `Plugin "<name>" not found in marketplace "<mp>".`
- [ ] **PI-4**: Non-installable resolver result fails with `Plugin "<name>" is not installable: <notes>`
- [ ] **PI-5**: Already-installed plugins fail with "already installed" error
- [ ] **PI-6**: Cross-plugin name conflicts (skill, prompt, agent) block install; one message lists every conflicting name
- [ ] **PI-7**: Version recorded from plugin-manifest `version` → marketplace-entry `version` → `hash-<12hex>` SHA-256 content hash. ENOENT/ENOTDIR during hashing MUST surface; hash algorithm and 12-char truncation are stable contract
- [ ] **PI-8**: Staging in tmp dir on same filesystem as destination; commit is atomic rename; staging-dir leaks surface as `cleanupWarnings`
- [ ] **PI-9**: Staging order: skills/prompts → agents → MCP → state commit. Failure rolls back earlier phases; rollback failures surface `(rollback partial: …)`
- [ ] **PI-10**: `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted in skill bodies, command files, agent bodies
- [ ] **PI-11**: Agents staged + `pi-subagents` unloaded → message includes the canonical pi-subagents warning string
- [ ] **PI-12**: MCP servers staged + `pi-mcp-adapter` unloaded → message includes the canonical pi-mcp-adapter warning string
- [ ] **PI-13**: Plugins declaring `dependencies` install with manual-install warning
- [ ] **PI-14**: Path-containment violations throw `PathContainmentError`; MUST NOT be folded into "rollback partial" line
- [ ] **PI-15**: Concurrent install detected at state-guard commit rolls back staged resources with "was installed concurrently" error

### Plugin Lifecycle: `uninstall` (PRD §5.2.2)

- [ ] **PU-1**: Order: remove recorded skills/prompts → unstage agents → unstage MCP → state-guard commit → clean per-plugin data dir
- [ ] **PU-2**: Per-plugin data-dir cleanup AFTER state commit so EACCES cannot strand state in `installed=true`
- [ ] **PU-3**: Failures earlier than data-dir cleanup abort uninstall with marketplace record intact (retryable)
- [ ] **PU-4**: Data-dir cleanup leaks surface at `warning` severity, leaked path named in body
- [ ] **PU-5**: Tolerate concurrent uninstall by another process (silent converge if record already gone at commit)
- [ ] **PU-6**: Legacy state records missing `resources.agents`/`resources.mcpServers` load-time-migrated to `[]`
- [ ] **PU-7**: Foreign content at agent target file (basename or generated marker missing) retained in index with `failed[]`; uninstall fails loudly
- [ ] **PU-8**: Emit reload hint `Run /reload to drop "<plugin>"` when any resource removed

### Plugin Lifecycle: `update` (PRD §5.2.3)

- [ ] **PUP-1**: Three forms: bare → all installed in scope; `@mp` → all in `mp`; `pl@mp` → just `pl`. Empty target set succeeds silently with `No plugins installed.`
- [ ] **PUP-2**: `update` refreshes GitHub clone (`syncClone`) once per marketplace before reading manifest
- [ ] **PUP-3**: Resolved version equals recorded version → reported `unchanged` (no I/O)
- [ ] **PUP-4**: No longer installable per resolver → `skipped` with `no longer installable: <notes>`
- [ ] **PUP-5**: Missing from refreshed manifest → `skipped: not in manifest`
- [ ] **PUP-6**: Three phases: prepare (write tmp) → state-guard swap → physical replace + soft-dep commit. Phase-3 failure surfaces recovery hint pointing at uninstall+install
- [ ] **PUP-7**: Phase-3 failure cleans staging dir and aborts agents/MCP staging without masking original error
- [ ] **PUP-8**: Reload hint emitted when ≥1 plugin actually updated
- [ ] **PUP-9**: Direct (non-cascade) `update` throws → `error`-severity notification with `Error.cause` chained; `failed` partition is cascade-only

### Listing & Inspection: top-level `list` (PRD §5.3.1)

- [ ] **PL-1**: No flags shows every bucket; flags select union of buckets
- [ ] **PL-2**: No marketplace name → nested tree grouped by scope, marketplaces as section headings
- [ ] **PL-3**: With marketplace name → only that marketplace's plugin list
- [ ] **PL-4**: Each plugin entry shows icon (●/○/⊘), name, optional `(<version>)`, status marker; description on second indented line truncated at column 66
- [ ] **PL-5**: Plugin is `upgradable` iff manifest version differs (string compare) from install record
- [ ] **PL-6**: Marketplace manifest load failure shows `[warning] could not load manifest: <reason>` and STILL renders installed plugins
- [ ] **PL-7**: Per-marketplace headers include `[autoupdate]` tag when flag is on

### Skills Bridge (PRD §5.5)

- [ ] **SK-1**: Skills staged at `<scope>/claude-marketplace/resources/skills/<plugin>-<skill>/SKILL.md` with full directory copy
- [ ] **SK-2**: Generated skill name `<plugin>-<skill>`, prefix elided when source already starts with `<plugin>-`
- [ ] **SK-3**: Generated `SKILL.md` frontmatter `name` rewritten to generated name; other frontmatter preserved
- [ ] **SK-4**: `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted inside `SKILL.md`
- [ ] **SK-5**: `resources_discover` reports `skills/` from both scopes; per-scope failures aggregate into single thrown error

### Commands Bridge (PRD §5.6)

- [ ] **CM-1**: Commands staged as `<scope>/claude-marketplace/resources/prompts/<plugin>:<command>.md`
- [ ] **CM-2**: Generated command name `<plugin>:<command>`, `<plugin>-` prefix stripped from source when present
- [ ] **CM-3**: Variable substitution applies to command bodies
- [ ] **CM-4**: Discovery treats flat `*.md` files only (non-recursive, ignore non-md)

### Agents Bridge (PRD §5.7)

- [ ] **AG-1**: Agent files staged at `<scope>/agents/claude-marketplace-<plugin>-<agent>.md` (outside extension's `resources/`)
- [ ] **AG-2**: On-disk index `<extensionRoot>/agents-index.json` (schemaVersion 1) tracks all required fields per row
- [ ] **AG-3**: Index partitioned by `(marketplace, plugin)` so re-staging affects only owning entries
- [ ] **AG-4**: Per-row index validation failures soft-fail (drop row, warn); file-level corruption throws
- [ ] **AG-5**: Generated agent files MUST start with `claude-marketplace-` AND contain literal marker `generated by pi-claude-marketplace` in HTML-comment block after closing `---`
- [ ] **AG-6**: Source frontmatter parsed (line-based YAML; tolerates `:` in description); body is everything after closing `---`
- [ ] **AG-7**: Frontmatter field mappings per §5.7 detail (model/tools/disallowedTools/thinking/effort/skills/description)
- [ ] **AG-8**: YAML emitter is parser-safe (single-quote flip, newline normalize, `-->` escape)
- [ ] **AG-9**: Cross-plugin name guard refuses to overwrite agents owned by different `(marketplace, plugin)`
- [ ] **AG-10**: Two-phase staging: write to `agents-staging/`, atomic rename + index save; noop branch materializes nothing
- [ ] **AG-11**: `convertAgent` throws when mapped tool list is empty; error lists source `tools:` and `disallowedTools:`
- [ ] **AG-12**: Source-name collisions within a single plugin throw with both source names listed

### MCP Servers Bridge (PRD §5.8)

- [ ] **MC-1**: `mcpServers` precedence: marketplace entry > plugin manifest > standalone `.mcp.json`. Malformed at matched source throws (no fallthrough). Under `strict=false`, precedence chain applies only when entry declares `mcpServers`
- [ ] **MC-2**: `.mcp.json` parses both canonical unwrapped form and legacy wrapped (`{ "mcpServers": {...} }`) form
- [ ] **MC-3**: Plugin whose only declaration is malformed `mcpServers` surfaces as **unavailable** with `malformed mcpServers: <reason>`
- [ ] **MC-4**: Server-name collisions checked across all four pi-mcp-adapter slots; self-replace within same scope allowed; foreign collisions refuse stage
- [ ] **MC-5**: Each staged entry carries `_claudeMarketplace: { plugin, marketplace }` marker
- [ ] **MC-6**: Two-phase staging (compute next doc in memory, atomic JSON write); noop branch materializes nothing
- [ ] **MC-7**: Unstage tolerates missing `mcpServers` field without crashing
- [ ] **MC-8**: Unloaded `pi-mcp-adapter` MUST NOT block install/update; user-facing message includes pi-mcp-adapter warning when servers staged

### Source Parsing & Validation (PRD §6.1)

- [ ] **SP-1**: Parser accepts only the listed forms (`owner/repo`, `https://github.com/owner/repo[.git][#<ref>]`, trailing-slash variants, empty fragment, paths)
- [ ] **SP-2**: Reject `owner/repo@<ref>` with hint pointing at `https://github.com/<owner/repo>#<ref>`
- [ ] **SP-3**: Reject `git@…`, other `://` URLs, and `https://github.com/.../tree/<ref>` (with `#<ref>` hint)
- [ ] **SP-4**: Reject per-user tilde forms (`~user/foo`)
- [ ] **SP-5**: `owner/repo` requires exactly one slash, both halves non-empty, no further segments; empty `#` fragment dropped
- [ ] **SP-6**: Source factory functions (`pathSource`, `githubSource`) validate at every boundary including state-load
- [ ] **SP-7**: Tilde paths stored unchanged in `state.json`; `expandTildePath` applied at access time

### Scopes & Resolution (PRD §6.2)

- [ ] **SC-1**: Exactly two scopes: `user` (`~/.pi/agent/`), `project` (`<cwd>/.pi/`); Claude `local` MUST NOT be introduced
- [ ] **SC-2**: Extension data at `<scopeRoot>/claude-marketplace/`; bridge files at `<scopeRoot>/agents/` and `<scopeRoot>/mcp.json`
- [ ] **SC-3**: `ScopedLocations` is a typed bundle (brand symbol); hand-crafted shapes mixing scopes MUST not type-check
- [ ] **SC-4**: With `--scope`, error if name not found there; without `--scope`, search both, error on dual-found or not-found
- [ ] **SC-5**: `marketplace add` defaults to `user` when scope omitted
- [ ] **SC-6**: `marketplace list/update/autoupdate/noautoupdate` (no name) enumerate both scopes when `--scope` omitted
- [ ] **SC-7**: Path containment enforced for every name-derived path

### Manifest Schema & Strict Mode (PRD §6.3)

- [ ] **MM-1**: `marketplace.json` MUST have string `name`, array `plugins`, optional boolean `strict`, optional `owner.name`
- [ ] **MM-2**: Plugin entries MUST have safe-name `name`, `source` field, optional string `description`/`version`, optional component-path fields, optional opaque unsupported-component declarations, optional opaque `dependencies`
- [ ] **MM-3**: `parsePluginSource` classifies into `path`/`github`/`url`/`git-subdir`/`npm` or `unknown`-with-reason; only `path` is installable in V1
- [ ] **MM-4**: Non-relative string source becomes `{ kind: "unknown", reason: "non-relative string source ..." }`, NOT `{ kind: "github" }`
- [ ] **MM-5**: `strict=true` (default): resolver takes union of marketplace-entry, plugin-manifest, implicit-by-convention, and standalone-file declarations
- [ ] **MM-6**: `strict=false`: resolver uses entry-only; manifest/convention unsupported declarations cause "component declarations conflict" non-installable
- [ ] **MM-7**: `strict=false`: manifest/standalone `mcpServers` without entry-level declaration also conflicts

### Plugin Compatibility Resolver (PRD §6.4)

- [ ] **PR-1**: Resolver returns discriminated union `{ installable: true, pluginRoot, ... }` or `{ installable: false, ... }`; latter MUST NOT expose `pluginRoot`
- [ ] **PR-2**: Mark unavailable for non-`path` source, source path escape, missing source dir, malformed manifest, declared unsupported components, malformed `mcpServers`, non-string component path, escaping component path, array-form supported component path
- [ ] **PR-3**: Unsupported component name produces note `contains <name>` and disqualifies install
- [ ] **PR-4**: Detect implicit components by convention only when corresponding manifest field absent
- [ ] **PR-5**: `dependencies` present adds note `declares dependencies that must be installed manually` but keeps installable
- [ ] **PR-6**: `requireInstallable` narrows to installable variant or throws `Plugin "<n>" is not installable: <notes>` (or `is no longer installable` for update)

### Resource Naming, Generation & Conflicts (PRD §6.5)

- [ ] **RN-1**: Generated names deterministic from `(plugin, source-name)`. Skill: `<plugin>-<skill>` (prefix elided). Command: `<plugin>:<command>` (prefix elided). Agent: `claude-marketplace-<plugin>-<agent>` (with `<plugin>-` prefix on source elided)
- [ ] **RN-2**: All names `assertSafeName`: non-empty, trimmed, not `.`/`..`, no path separators, no control chars
- [ ] **RN-3**: Cross-plugin install conflict guard runs BEFORE any disk write and lists every conflicting name in one message
- [ ] **RN-4**: Cross-marketplace agent ownership: re-staging agent owned by different `(marketplace, plugin)` throws with conflicting owner
- [ ] **RN-5**: MCP server-name collisions checked against all four pi-mcp-adapter slots
- [ ] **RN-6**: Within a single plugin, two skill/command source names that elide to same generated name MUST throw with both source names listed

### Tab Completion (PRD §6.6)

- [ ] **TC-1**: First positional after `/claude:plugin` surfaces `install / uninstall / update / list / marketplace`
- [ ] **TC-2**: After `marketplace`, surfaces `add / remove / list / update / autoupdate / noautoupdate` (`rm` accepted but not surfaced)
- [ ] **TC-3**: Cursor on `-`-prefixed token surfaces `--scope` plus list-specific flags; single and double dash behave identically
- [ ] **TC-4**: Token after `--scope` surfaces `user` and `project` only
- [ ] **TC-5**: For `list <here>` and `marketplace <verb> <here>`, complete with union of marketplace names from both scopes
- [ ] **TC-6**: For `install/uninstall/update <here>`, emit `<plugin>@<marketplace>` tokens per detail rules; `update` accepts `@<marketplace>` form
- [ ] **TC-7**: All terminal completions include trailing space; double-space collapse via fish-style normalization scoped to `/claude:plugin`
- [ ] **TC-8**: Per-marketplace manifest-load failures during plugin completion soft-fail to empty set
- [ ] **TC-9**: Top-level `state.json` errors during completion propagate (no silent hide)

### Argument Parsing (PRD §6.7)

- [ ] **AP-1**: Tokenization honors single and double quotes for spaced arguments
- [ ] **AP-2**: `--scope` requires exactly `user` or `project`; missing or invalid value raises clear error
- [ ] **AP-3**: Subcommand routing surfaces `Usage:` block on empty/unknown input
- [ ] **AP-4**: `--scope` accepted at any position; positionals extracted in order

### Reload Hint & Soft-Dependency Probing (PRD §6.8)

- [ ] **RH-1**: Reload hint emitted ONLY when generated resources changed
- [ ] **RH-2**: Hint format: single → `Run /reload to <verb> it.`; N names → `Run /reload to <verb> "n1", "n2", ...".` Verbs: `load`/`refresh`/`drop`
- [ ] **RH-3**: `pi-subagents` detection probes for tool named `subagent` in `pi.getAllTools()`
- [ ] **RH-4**: `pi-mcp-adapter` detection matches tool name `mcp` OR any tool whose `sourceInfo.source` substring-matches `pi-mcp-adapter`
- [ ] **RH-5**: Soft dep unloaded + staged resources of that kind exist → success message includes canonical warning line BEFORE trailing reload hint

### State Persistence, Migration & Concurrency (PRD §6.9)

- [ ] **ST-1**: State at `<extensionRoot>/state.json` with `schemaVersion: 1`; save is atomic (tmp + rename)
- [ ] **ST-2**: Per-marketplace records: name, scope, source, addedFromCwd, manifestPath, marketplaceRoot, optional lastUpdatedAt, optional autoupdate, plugins map
- [ ] **ST-3**: Per-plugin install records: version, `resolvedSource` (absolute path string), compatibility, resources (skills/prompts/agents/mcpServers), installedAt, updatedAt
- [ ] **ST-4**: Legacy records missing `manifestPath`/`marketplaceRoot` load-time-migrated; persisted asynchronously (best-effort)
- [ ] **ST-5**: Legacy plugin records missing `resources.agents`/`resources.mcpServers` load-time-normalized to `[]`
- [ ] **ST-6**: Source-record validation funnels through same factory as parse-time
- [ ] **ST-7**: All mutating operations run inside `withStateGuard` (re-load fresh, save only on no-throw)
- [ ] **ST-8**: Concurrent install/uninstall detected at commit; uninstall soft-converges, install hard-fails-with-rollback
- [ ] **ST-9**: Update detects concurrent change at commit (`installed=false` or `version !== fromVersion`) and aborts with "changed concurrently; retry the update"

### Path Safety & Containment (PRD §6.10)

- [ ] **PS-1**: Every name-derived path `path.resolve`'d and checked with `assertPathInside(parent, child)`; violations throw `PathContainmentError`
- [ ] **PS-2**: Plugin source paths MUST be relative; absolute paths in string-form `source.path` rejected as unavailable
- [ ] **PS-3**: Component paths in `plugin.json` and `marketplace.json` MUST be relative; absolute paths produce resolver note + disqualify install
- [ ] **PS-4**: Containment violations during rollback propagate (state corruption is loud)
- [ ] **PS-5**: Generated agent files MUST be inside `locations.agentsDir`; staging tmp inside `locations.agentsStagingDir`; both checked at every write

### Atomic Staging, Commit & Rollback (PRD §6.11)

- [ ] **AS-1**: All disk-write phases stage to tmp on same filesystem as destination, then atomic-rename
- [ ] **AS-2**: Install ordering: skills/prompts → agents → MCP → state commit
- [ ] **AS-3**: Update is three-phase: prepare in tmp → state-guard swap (with old-resource snapshot) → physical replace + soft-dep commit
- [ ] **AS-4**: Rollback collects per-phase failures into single `(rollback partial: [phase] msg; …)` summary on thrown error
- [ ] **AS-5**: Cleanup leaks appended to errors via `appendLeaks`/`appendLeakToError`
- [ ] **AS-6**: Post-commit cleanup leaks surface as `cleanupWarnings` and bump message severity to `warning`; state already committed
- [ ] **AS-7**: Specific guidance emitted when install rollback leaves orphan agent index entries (whole-plugin index unreadable vs specific entries orphaned)
- [ ] **AS-8**: Empty `mcpServers` map + no previous-ours entries MUST NOT materialize `mcp.json`
- [ ] **AS-9**: Empty agents source dir + no previous-ours entries MUST NOT materialize scoped agents dir or index file

### Error Surfaces & Severity (PRD §6.12)

- [ ] **ES-1**: All user-visible failure modes go through `ctx.ui.notify(message, severity)`
- [ ] **ES-2**: Severity ladder: default (success), `warning` (success with leaks/partials/soft-dep warnings/cascade skips), `error` (state unchanged or fully rolled back)
- [ ] **ES-3**: Usage errors surface at `error` severity with relevant Usage block appended
- [ ] **ES-4**: Errors include original cause via `Error.cause`; `formatErrorWithCauses` flattens chain (depth 5) for cascade reporting
- [ ] **ES-5**: Specific marker strings remain stable as user contract (gitlint-grade): `pi-subagents is not loaded; …`, `pi-mcp-adapter is not loaded; …`, `Run /reload to <verb> …`, `MANUAL RECOVERY REQUIRED: …`, `(rollback partial: [<phase>] <msg>; …)`

### Internationalization, Logging & Telemetry (PRD §6.13)

- [ ] **IL-1**: All user-visible messages English-only in V1; no message catalog, no locale negotiation
- [ ] **IL-2**: Every user-visible message delivered through `ctx.ui.notify`; direct writes to `process.stdout`/`stderr` forbidden in command/bridge code
- [ ] **IL-3**: Single sanctioned `console.warn`: load-time `state.json` migration save failure in `migrateLegacyMarketplaceRecords`; no other code path may use it
- [ ] **IL-4**: V1 MUST NOT emit telemetry (no metrics, event sink, or analytics endpoint)
- [ ] **IL-5**: Successor SHOULD consider pluggable message catalog, structured event channel, severity-aware log levels

### Non-functional Requirements (PRD §10)

- [ ] **NFR-1**: All disk mutations atomic at file level (tmp + rename or atomic JSON write)
- [ ] **NFR-2**: No fix requires Pi restart; `Run /reload` MUST suffice
- [ ] **NFR-3**: All operations safe to retry on transient failure (idempotent or fail-clean)
- [ ] **NFR-4**: Extension MUST work with Node ≥ 22
- [ ] **NFR-5**: Network access required only for GitHub-source `marketplace add` and `update`/`marketplace update` against GitHub-source marketplaces
- [ ] **NFR-6**: `npm run check` = typecheck + ESLint + Prettier + tests; successor MUST keep these gates green
- [ ] **NFR-7**: TypeScript surface uses strictly typed resolved-plugin variants; installable consumers cannot read `pluginRoot` from non-installable
- [ ] **NFR-8**: Successor SHOULD cache marketplace manifests with mtime invalidation (BACKLOG performance item)
- [ ] **NFR-9**: System MUST never print sensitive paths beyond what's already in user's terminal
- [ ] **NFR-10**: System MUST refuse to write outside `<scopeRoot>/claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`
- [ ] **NFR-11**: Pi extension API declared as `@mariozechner/pi-coding-agent` peer dep; successor SHOULD pin a minimum version once API stabilizes
- [ ] **NFR-12**: `marketplace.json` parser is forward-compatible (no schema-version check; unknown source kinds parse to `{ kind: "unknown", reason }`)

## v2 Requirements

### Listing & Inspection

- **INFO-01**: `info` subcommand for plugins/marketplaces (PRD §11; FEATURES.md flagged as strongest post-V1 candidate)

### Compatibility Fixes

- **COMP-01**: Custom component-path arrays as supplemental rather than replacement (PRD §11; FEATURES.md flagged this as a spec-compliance bug vs upstream Claude Code rather than a deferral)

### Performance

- **PERF-01**: Marketplace manifest caching with mtime invalidation (PRD NFR-8)

### Successor Architecture Concerns (per PRD IL-5)

- **EVOL-01**: Pluggable message catalog for i18n
- **EVOL-02**: Structured event channel for `success` / `warning` / `error` / `cleanup-leak` / `rollback`
- **EVOL-03**: Severity-aware log levels separate from user-facing notify channel

## Out of Scope

| Feature                                                                                                                                       | Reason                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Claude `local` scope                                                                                                                          | No Pi equivalent (PRD §1, SC-1)                                                                                       |
| SSH URLs, arbitrary HTTPS git URLs, remote `marketplace.json` URLs, sparse checkout, browser-paste tree URLs                                  | Surface as parse errors with hints; keeps V1 surface manageable (PRD §1, MA-10, SP-3, §11)                            |
| Plugin sources beyond local paths (`github` / `git` / `git-subdir` / `npm` object sources)                                                    | Parse and report via resolver notes as `unavailable`; not installed (PRD §1, MM-3, §11)                               |
| Components beyond skills/commands/agents/mcpServers (hooks, lspServers, monitors, themes, output styles, channels, userConfig, bin, settings) | Each integrated through dedicated Pi extensions where appropriate; surface as `unavailable` with reason (PRD §1, §11) |
| Automatic dependency resolution / pruning                                                                                                     | Manual-install warning only (PI-13); auto-resolution defers to package-manager primitives (PRD §1, §11)               |
| Mutating LLM tools for install/update/uninstall                                                                                               | Only listing tools exposed; mutation flows through user-issued slash commands (PRD §1, §11)                           |
| Managed/allowlist/blocklist policies                                                                                                          | No Pi equivalent (PRD §11)                                                                                            |
| Rich interactive marketplace/plugin selectors                                                                                                 | Defer to upstream `/plugin` UX patterns first (PRD §11)                                                               |
| JSON output / dry-run modes for install/update/uninstall                                                                                      | Defer; current notify channel does not multiplex output formats (PRD §11)                                             |
| Session-start autoupdate run (Claude Code parity)                                                                                             | Defer; risk of unexpected network on session resume (PRD §11)                                                         |
| `--force` install with `incomplete` state for partially-supported plugins                                                                     | Defer; correctness model favors block-and-explain over partial-with-flag (PRD §11)                                    |
| Telemetry (metrics, event sinks, analytics endpoints)                                                                                         | V1 explicitly forbids (IL-4); successor concern only (IL-5)                                                           |
| Message catalogs / locale negotiation                                                                                                         | English-only V1 (IL-1); successor concern only (IL-5)                                                                 |

## Behavioral Gaps Requiring Decision Before Phase Planning

Surfaced by FEATURES research; these are spec ambiguities, not new requirements. Resolve into Key Decisions in PROJECT.md before requirements-to-phases mapping.

01. **Cross-marketplace plugin name handling** -- when the same `<plugin>` exists in two marketplaces in the same scope, what does `install <plugin>@<mp1>` then `install <plugin>@<mp2>` produce? (PRD silent; FEATURES Gap 1)
02. **Cascade abort vs continue on failure** -- when `marketplace update` cascade hits a per-plugin failure, MR-3/MU-7 say partition+continue, but is "abort entire cascade on first failure" ever the right call? (FEATURES Gap 2)
03. **Custom component-path supplement vs replace** -- PRD §11 deferral may actually be a spec-compliance bug; decide whether to fix in V1 successor or document continued deferral (FEATURES Gap 3, COMP-01)
04. **Simultaneous-scope install semantics** -- if a plugin is installable in both `user` and `project` scopes, does install in one scope shadow the other? (FEATURES Gap 4)
05. **Reload-hint-when-soft-dep-unloaded interaction** -- RH-5 says soft-dep warning before reload hint; what about when ONLY soft-dep resources changed and the dep is unloaded? (FEATURES Gap 5)
06. **Empty-marketplace ergonomics** -- `marketplace add` to an empty marketplace succeeds without reload hint (MA-11); does `list` show it differently? (FEATURES Gap 6)
07. **Hash version stability across encoding** -- PI-7 specifies SHA-256 over recursive walk; what about plugins with files that contain BOM or different line endings? (FEATURES Gap 7)
08. **Update cascade ordering** -- MU-7 lists outcome-bucket order; is per-plugin order within a bucket alphabetic, dependency-aware, or marketplace-declaration order? (FEATURES Gap 8)
09. **Tab completion latency under failed marketplaces** -- TC-8 says soft-fail to empty set; is there a max-wait policy for slow manifest loads? (FEATURES Gap 9)
10. **Concurrent `marketplace remove` semantics** -- if two processes both `marketplace remove mp`, MR-3/MR-4 cover per-plugin failures but not the case where plugins disappear between processes' state-reads (FEATURES Gap 10)

## Traceability

Empty initially. The roadmapper populates this during phase mapping. Coverage check verifies every v1 requirement maps to exactly one phase.

| Requirement               | Phase | Status |
| ------------------------- | ----- | ------ |
| (Populated by roadmapper) |       |        |

**Coverage:**

- v1 requirements: 134 total
- Mapped to phases: 0 (pre-roadmap)
- Unmapped: 134 ⚠️ (will resolve to 0 after roadmap)

______________________________________________________________________

*Requirements defined: 2026-05-09 from `docs/prd/pi-claude-marketplace-prd.md` v1.0* *Last updated: 2026-05-09 after initialization*
