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
- [x] ~~**MA-7**: Missing `git` on PATH MUST surface the canonical "git not found" error~~ (**superseded by D-18/D-21**: Phase 1 adopts `isomorphic-git`, eliminating the `git CLI not found` failure mode entirely. PRD §5.1.1 MA-7 is no longer applicable; this is a deliberate user-contract change recorded in PROJECT.md Key Decisions.)
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
- [x] ~~**MU-2**: GitHub sources `git fetch` then `git pull --ff-only` (symbolic HEAD) or re-checkout stored ref (detached HEAD)~~ (**superseded by Phase 4 D-14**: the local marketplace clone is read-only by contract; `marketplace update` follows upstream blindly via `fetch + forceUpdateRef + checkout` -- see `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` D-14. This is a deliberate user-contract change recorded in PROJECT.md Key Decisions.)
- [x] ~~**MU-3**: Non-fast-forward divergence surfaces as error; recovery is `marketplace remove` + re-add~~ (**superseded by Phase 4 D-14**: the local clone is never altered, so non-fast-forward divergence cannot exist as a user-visible failure mode; `marketplace update` overwrites the local ref unconditionally -- see `.planning/phases/04-marketplace-orchestrators/04-CONTEXT.md` D-14.)
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
- [x] ~~**PI-15**: Concurrent install detected at state-guard commit rolls back staged resources with "was installed concurrently" error~~ (**superseded by Phase 7 D-08**: cross-process installs now fail before the state-guard commit by acquiring the per-scope `.state-lock` first. A loser surfaces `STATE_LOCK_HELD_PREFIX` (`Another pi-claude-marketplace operation is in progress for`) with retry as the recovery action instead of reaching the old `was installed concurrently` rollback path.)
- [ ] **PI-16**: Install target scope and marketplace source scope are distinct; project installs can source from project-or-user marketplace, user installs only from user marketplace
- [ ] **PI-17**: Same `<plugin>@<marketplace>` may be installed in both scopes; already-installed and conflict checks are target-scope-local

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

- [ ] **SK-1**: Skills staged at `<scope>/pi-claude-marketplace/resources/skills/<plugin>-<skill>/SKILL.md` with full directory copy
- [ ] **SK-2**: Generated skill name `<plugin>-<skill>`, `<plugin>-` prefix stripped from source when present; source equal to plugin name becomes `<plugin>`; generated skill names satisfy Pi's lowercase/digit/hyphen validator
- [ ] **SK-3**: Generated `SKILL.md` frontmatter `name` rewritten to generated name; other frontmatter preserved
- [ ] **SK-4**: `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted inside `SKILL.md`
- [ ] **SK-5**: `resources_discover` reports `skills/` from both scopes; per-scope failures aggregate into single thrown error

### Commands Bridge (PRD §5.6)

- [ ] **CM-1**: Commands staged as `<scope>/pi-claude-marketplace/resources/prompts/<plugin>:<command>.md`
- [ ] **CM-2**: Generated command name `<plugin>:<command>`, `<plugin>-` prefix stripped from source when present
- [ ] **CM-3**: Variable substitution applies to command bodies
- [ ] **CM-4**: Discovery treats flat `*.md` files only (non-recursive, ignore non-md)

### Agents Bridge (PRD §5.7)

- [ ] **AG-1**: Agent files staged at `<scope>/agents/pi-claude-marketplace-<plugin>-<agent>.md` (outside extension's `resources/`)
- [ ] **AG-2**: On-disk index `<extensionRoot>/agents-index.json` (schemaVersion 1) tracks all required fields per row
- [ ] **AG-3**: Index partitioned by `(marketplace, plugin)` so re-staging affects only owning entries
- [ ] **AG-4**: Per-row index validation failures soft-fail (drop row, warn); file-level corruption throws
- [ ] **AG-5**: Generated agent files MUST start with `pi-claude-marketplace-` AND contain literal marker `generated by pi-claude-marketplace` in HTML-comment block after closing `---`
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
- [ ] **MC-5**: Each staged entry carries `_piClaudeMarketplace: { plugin, marketplace }` marker
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
- [ ] **SC-2**: Extension data at `<scopeRoot>/pi-claude-marketplace/`; bridge files at `<scopeRoot>/agents/` and `<scopeRoot>/mcp.json`
- [ ] **SC-3**: `ScopedLocations` is a typed bundle (brand symbol); hand-crafted shapes mixing scopes MUST not type-check
- [ ] **SC-4**: With `--scope`, error if name not found there; without `--scope`, search both, error on dual-found or not-found
- [ ] **SC-5**: `marketplace add` defaults to `user` when scope omitted
- [ ] **SC-6**: `marketplace list/update/autoupdate/noautoupdate` (no name) enumerate both scopes when `--scope` omitted
- [ ] **SC-7**: Path containment enforced for every name-derived path

### Scope-aware Marketplace/Plugin Rules (PRD §6.2.1)

- [ ] **CMP-1**: Marketplaces may be added independently to user scope, project scope, or both; duplicate-name failures are scoped
- [ ] **CMP-2**: Plugin lifecycle operations distinguish target scope (writes) from source marketplace scope (manifest/source reads)
- [ ] **CMP-3**: Project-target install sees project marketplace first, then user marketplace fallback
- [ ] **CMP-4**: User-target install sees user marketplaces only; project-only marketplace cannot source a user install
- [ ] **CMP-5**: Same plugin may be installed in both scopes; unqualified single-target operations prefer project install, explicit `--scope` overrides
- [ ] **CMP-6**: Completion applies the same target-scope/source-marketplace visibility rules as execution
- [ ] **CMP-7**: Install completion suggests only available plugins for the current target scope; installed/unavailable plugins are excluded
- [ ] **CMP-8**: Project-target install completion uses project marketplace before user fallback and still emits `<plugin>@<marketplace>` tokens

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
- [x] ~~**PR-4**: Detect implicit components by convention only when corresponding manifest field absent~~ (**superseded by Phase 5 D-07**: custom componentPath arrays now SUPPLEMENT defaults rather than replace them; implicit-by-convention is always detected when the conventional dir exists. Behavior corrected vs V1 per Gap 3 / COMP-01 -- see `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` D-07. This is a deliberate user-contract change recorded in PROJECT.md Key Decisions.)
- [ ] **PR-5**: `dependencies` present adds note `declares dependencies that must be installed manually` but keeps installable
- [ ] **PR-6**: `requireInstallable` narrows to installable variant or throws `Plugin "<n>" is not installable: <notes>` (or `is no longer installable` for update)

### Resource Naming, Generation & Conflicts (PRD §6.5)

- [ ] **RN-1**: Generated names deterministic from `(plugin, source-name)`. Skill: `<plugin>-<skill>` (prefix elided). Command: `<plugin>:<command>` (prefix elided). Agent: `pi-claude-marketplace-<plugin>-<agent>` (with `<plugin>-` prefix on source elided)
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
- [ ] **TC-6**: For `install/uninstall/update <here>`, emit `<plugin>@<marketplace>` tokens per detail rules; `install` completion is available-only and scope-aware per CMP-6..8; `update` accepts `@<marketplace>` form
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
- [x] **NFR-2**: No fix requires Pi restart; `Run /reload` MUST suffice
- [x] **NFR-3**: All operations safe to retry on transient failure (idempotent or fail-clean)
- [ ] **NFR-4**: Extension MUST work with Node ≥ 22
- [ ] **NFR-5**: Network access required only for GitHub-source `marketplace add` and `update`/`marketplace update` against GitHub-source marketplaces
- [ ] **NFR-6**: `npm run check` = typecheck + ESLint + Prettier + tests; successor MUST keep these gates green
- [ ] **NFR-7**: TypeScript surface uses strictly typed resolved-plugin variants; installable consumers cannot read `pluginRoot` from non-installable
- [x] **NFR-8**: Successor SHOULD cache marketplace manifests with mtime invalidation (BACKLOG performance item)
- [ ] **NFR-9**: System MUST never print sensitive paths beyond what's already in user's terminal
- [ ] **NFR-10**: System MUST refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`
- [x] **NFR-11**: Pi extension API declared as `@mariozechner/pi-coding-agent` peer dep; successor SHOULD pin a minimum version once API stabilizes
- [ ] **NFR-12**: `marketplace.json` parser is forward-compatible (no schema-version check; unknown source kinds parse to `{ kind: "unknown", reason }`)

## Milestone v1.1 Requirements

Requirements for the Reinstall Command milestone. Additive to the v1.0 PRD set, mapped to Phases 8 and 9.

### Plugin Reinstall

- [x] **PRL-01**: User can run `/claude:plugin reinstall` as a top-level plugin lifecycle command with a clear `Usage:` block
- [x] **PRL-02**: User can reinstall one installed plugin with `reinstall <plugin>@<marketplace>`
- [x] **PRL-03**: User can reinstall every installed plugin in one marketplace with `reinstall @<marketplace>`
- [x] **PRL-04**: User can reinstall every installed plugin in the selected scope set with bare `reinstall`
- [x] **PRL-05**: User can pass `--scope user|project` at any argument position, with scope resolution matching `update`
- [x] **PRL-06**: Reinstall targets installed plugins only; empty target sets succeed with `No plugins installed.` and no reload hint
- [x] **PRL-07**: Reinstall uses cached marketplace manifests only and never performs network sync or Git operations
- [x] **PRL-08**: Reinstall preserves the installed record's existing version instead of recomputing or upgrading it
- [x] **PRL-09**: Reinstall prepares replacement resources before removing old resources
- [x] **PRL-10**: If reinstall preflight, preparation, replacement, or state save fails, the previously installed plugin state, resources, and data directory remain available
- [x] **PRL-11**: Reinstall deletes the plugin data directory only after replacement resources and state commit succeed
- [x] **PRL-12**: Plugin data-directory cleanup failure is reported as a warning without turning a successful reinstall into a failed reinstall
- [x] **PRL-13**: Batch reinstall continues per plugin and reports deterministic success/skipped/failed partitions without corrupting other plugins
- [x] **PRL-14**: Successful reinstall emits the existing `refresh` reload hint only when generated resources changed
- [x] **PRL-15**: Successful reinstall includes existing soft-dependency warnings when agents or MCP servers are restaged and the relevant Pi companion plugin is unloaded
- [x] **PRL-16**: Tab completion includes `reinstall`, completes installed plugin refs, supports `@<marketplace>` form, and preserves existing completion failure semantics

## Milestone v1.2 Requirements

Requirements for the Claude settings import milestone. Additive to the v1.0 PRD set, mapped to Phases 10 and 11.

### Import Command & Scope

- [x] **IMP-01**: User can run `/claude:plugin import [--scope user|project]` to import enabled Claude Code plugins into Pi.
- [x] **IMP-02**: When `--scope` is omitted, import processes both user and project Claude settings and writes to the matching Pi scopes.
- [x] **IMP-03**: When `--scope user` or `--scope project` is provided, import processes only that Claude settings scope and writes only to the matching Pi scope.

### Claude Settings Parsing

- [x] **IMP-04**: Import reads both `settings.json` and `settings.local.json` for each selected Claude scope, with local settings overriding base settings.
- [x] **IMP-05**: Import considers only merged `enabledPlugins` entries whose value is exactly `true`; false, null, missing, and non-boolean values are ignored.
- [x] **IMP-06**: Import parses enabled plugin keys as `plugin@marketplace` refs and reports malformed keys without aborting valid imports.

### Marketplace Source Import

- [x] **IMP-07**: If an enabled plugin references `claude-plugins-official` and that marketplace is missing in the target Pi scope, import adds it from `anthropics/claude-plugins-official`.
- [x] **IMP-08**: For non-official marketplaces, import reads merged `extraKnownMarketplaces` and maps Claude `directory` sources to Pi path-source marketplace adds and Claude `github.repo` sources to Pi GitHub-source marketplace adds.

### Plugin Import Orchestration

- [x] **IMP-09**: Import is idempotent: already-added marketplaces and already-installed plugins are skipped without error, while enabled plugins in both Claude scopes are imported into both matching Pi scopes unless `--scope` narrows the run.
- [x] **IMP-10**: Import continues after per-plugin unavailable/uninstallable results and reports those skipped plugins as warnings.
- [x] **IMP-11**: Import uses existing marketplace-add and plugin-install semantics for atomicity, state locking, network policy, output channel, soft-dependency warnings, and reload hints.

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
04. ~~**Simultaneous-scope install semantics** -- if a plugin is installable in both `user` and `project` scopes, does install in one scope shadow the other?~~ **Resolved by D-29 / CMP-1..8:** same plugin may be installed in both scopes; project install takes precedence for unqualified single-target operations; explicit `--scope` selects the target.
05. **Reload-hint-when-soft-dep-unloaded interaction** -- RH-5 says soft-dep warning before reload hint; what about when ONLY soft-dep resources changed and the dep is unloaded? (FEATURES Gap 5)
06. **Empty-marketplace ergonomics** -- `marketplace add` to an empty marketplace succeeds without reload hint (MA-11); does `list` show it differently? (FEATURES Gap 6)
07. **Hash version stability across encoding** -- PI-7 specifies SHA-256 over recursive walk; what about plugins with files that contain BOM or different line endings? (FEATURES Gap 7)
08. **Update cascade ordering** -- MU-7 lists outcome-bucket order; is per-plugin order within a bucket alphabetic, dependency-aware, or marketplace-declaration order? (FEATURES Gap 8)
09. **Tab completion latency under failed marketplaces** -- TC-8 says soft-fail to empty set; is there a max-wait policy for slow manifest loads? (FEATURES Gap 9)
10. **Concurrent `marketplace remove` semantics** -- if two processes both `marketplace remove mp`, MR-3/MR-4 cover per-plugin failures but not the case where plugins disappear between processes' state-reads (FEATURES Gap 10)

## Traceability

Every v1 REQ-ID maps to exactly one phase. Status `Pending` until execution updates them.

> **Coverage note:** This file's previous footer claimed "134 v1 requirements total" but the file actually contains **200** numbered REQ-IDs across all sections. The roadmap maps all 200; reconcile the count claim in a future REQUIREMENTS.md edit.

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| MA-1        | Phase 4 | Pending |
| MA-2        | Phase 4 | Pending |
| MA-3        | Phase 4 | Pending |
| MA-4        | Phase 4 | Pending |
| MA-5        | Phase 4 | Pending |
| MA-6        | Phase 4 | Pending |
| MA-7        | --      | Superseded by D-18/D-21 |
| MA-8        | Phase 4 | Pending |
| MA-9        | Phase 4 | Pending |
| MA-10       | Phase 4 | Pending |
| MA-11       | Phase 4 | Pending |
| MR-1        | Phase 4 | Pending |
| MR-2        | Phase 4 | Pending |
| MR-3        | Phase 4 | Pending |
| MR-4        | Phase 4 | Pending |
| MR-5        | Phase 4 | Pending |
| MR-6        | Phase 4 | Pending |
| MR-7        | Phase 4 | Pending |
| MR-8        | Phase 4 | Pending |
| ML-1        | Phase 4 | Pending |
| ML-2        | Phase 4 | Pending |
| ML-3        | Phase 4 | Pending |
| ML-4        | Phase 4 | Pending |
| MU-1        | Phase 4 | Pending |
| MU-2        | --      | Superseded by Phase 4 D-14 |
| MU-3        | --      | Superseded by Phase 4 D-14 |
| MU-4        | Phase 4 | Pending |
| MU-5        | Phase 4 | Pending |
| MU-6        | Phase 4 | Pending |
| MU-7        | Phase 4 | Pending |
| MU-8        | Phase 4 | Pending |
| MU-9        | Phase 4 | Pending |
| MAU-1       | Phase 4 | Pending |
| MAU-2       | Phase 4 | Pending |
| MAU-3       | Phase 4 | Pending |
| MAU-4       | Phase 4 | Pending |
| PI-1        | Phase 5 | Pending |
| PI-2        | Phase 5 | Pending |
| PI-3        | Phase 5 | Pending |
| PI-4        | Phase 5 | Pending |
| PI-5        | Phase 5 | Pending |
| PI-6        | Phase 5 | Pending |
| PI-7        | Phase 5 | Pending |
| PI-8        | Phase 5 | Pending |
| PI-9        | Phase 5 | Pending |
| PI-10       | Phase 5 | Pending |
| PI-11       | Phase 5 | Pending |
| PI-12       | Phase 5 | Pending |
| PI-13       | Phase 5 | Pending |
| PI-14       | Phase 5 | Pending |
| PI-15       | --      | Superseded by Phase 7 D-08 |
| PI-16       | Phase 5 | Pending |
| PI-17       | Phase 5 | Pending |
| PU-1        | Phase 5 | Pending |
| PU-2        | Phase 5 | Pending |
| PU-3        | Phase 5 | Pending |
| PU-4        | Phase 5 | Pending |
| PU-5        | Phase 5 | Pending |
| PU-6        | Phase 5 | Pending |
| PU-7        | Phase 5 | Pending |
| PU-8        | Phase 5 | Pending |
| PUP-1       | Phase 5 | Pending |
| PUP-2       | Phase 5 | Pending |
| PUP-3       | Phase 5 | Pending |
| PUP-4       | Phase 5 | Pending |
| PUP-5       | Phase 5 | Pending |
| PUP-6       | Phase 5 | Pending |
| PUP-7       | Phase 5 | Pending |
| PUP-8       | Phase 5 | Pending |
| PUP-9       | Phase 5 | Pending |
| PL-1        | Phase 5 | Pending |
| PL-2        | Phase 5 | Pending |
| PL-3        | Phase 5 | Pending |
| PL-4        | Phase 5 | Pending |
| PL-5        | Phase 5 | Pending |
| PL-6        | Phase 5 | Pending |
| PL-7        | Phase 5 | Pending |
| SK-1        | Phase 3 | Pending |
| SK-2        | Phase 3 | Pending |
| SK-3        | Phase 3 | Pending |
| SK-4        | Phase 3 | Pending |
| SK-5        | Phase 3 | Pending |
| CM-1        | Phase 3 | Pending |
| CM-2        | Phase 3 | Pending |
| CM-3        | Phase 3 | Pending |
| CM-4        | Phase 3 | Pending |
| AG-1        | Phase 3 | Pending |
| AG-2        | Phase 3 | Pending |
| AG-3        | Phase 3 | Pending |
| AG-4        | Phase 3 | Pending |
| AG-5        | Phase 3 | Pending |
| AG-6        | Phase 3 | Pending |
| AG-7        | Phase 3 | Pending |
| AG-8        | Phase 3 | Pending |
| AG-9        | Phase 3 | Pending |
| AG-10       | Phase 3 | Pending |
| AG-11       | Phase 3 | Pending |
| AG-12       | Phase 3 | Pending |
| MC-1        | Phase 3 | Pending |
| MC-2        | Phase 3 | Pending |
| MC-3        | Phase 3 | Pending |
| MC-4        | Phase 3 | Pending |
| MC-5        | Phase 3 | Pending |
| MC-6        | Phase 3 | Pending |
| MC-7        | Phase 3 | Pending |
| MC-8        | Phase 3 | Pending |
| SP-1        | Phase 2 | Pending |
| SP-2        | Phase 2 | Pending |
| SP-3        | Phase 2 | Pending |
| SP-4        | Phase 2 | Pending |
| SP-5        | Phase 2 | Pending |
| SP-6        | Phase 2 | Pending |
| SP-7        | Phase 2 | Pending |
| SC-1        | Phase 2 | Pending |
| SC-2        | Phase 2 | Pending |
| SC-3        | Phase 2 | Pending |
| SC-4        | Phase 2 | Pending |
| SC-5        | Phase 4 | Pending |
| SC-6        | Phase 4 | Pending |
| SC-7        | Phase 2 | Pending |
| CMP-1       | Phase 4 | Pending |
| CMP-2       | Phase 5 | Pending |
| CMP-3       | Phase 5 | Pending |
| CMP-4       | Phase 5 | Pending |
| CMP-5       | Phase 5 | Pending |
| CMP-6       | Phase 6 | Pending |
| CMP-7       | Phase 6 | Pending |
| CMP-8       | Phase 6 | Pending |
| MM-1        | Phase 2 | Pending |
| MM-2        | Phase 2 | Pending |
| MM-3        | Phase 2 | Pending |
| MM-4        | Phase 2 | Pending |
| MM-5        | Phase 2 | Pending |
| MM-6        | Phase 2 | Pending |
| MM-7        | Phase 2 | Pending |
| PR-1        | Phase 2 | Pending |
| PR-2        | Phase 2 | Pending |
| PR-3        | Phase 2 | Pending |
| PR-4        | --      | Superseded by Phase 5 D-07 |
| PR-5        | Phase 2 | Pending |
| PR-6        | Phase 2 | Pending |
| RN-1        | Phase 2 | Pending |
| RN-2        | Phase 2 | Pending |
| RN-3        | Phase 5 | Pending |
| RN-4        | Phase 3 | Pending |
| RN-5        | Phase 3 | Pending |
| RN-6        | Phase 3 | Pending |
| TC-1        | Phase 6 | Pending |
| TC-2        | Phase 6 | Pending |
| TC-3        | Phase 6 | Pending |
| TC-4        | Phase 6 | Pending |
| TC-5        | Phase 6 | Pending |
| TC-6        | Phase 6 | Pending |
| TC-7        | Phase 6 | Pending |
| TC-8        | Phase 6 | Pending |
| TC-9        | Phase 6 | Pending |
| AP-1        | Phase 6 | Pending |
| AP-2        | Phase 6 | Pending |
| AP-3        | Phase 6 | Pending |
| AP-4        | Phase 6 | Pending |
| RH-1        | Phase 4 | Pending |
| RH-2        | Phase 4 | Pending |
| RH-3        | Phase 4 | Pending |
| RH-4        | Phase 4 | Pending |
| RH-5        | Phase 4 | Pending |
| ST-1        | Phase 2 | Pending |
| ST-2        | Phase 2 | Pending |
| ST-3        | Phase 2 | Pending |
| ST-4        | Phase 2 | Pending |
| ST-5        | Phase 2 | Pending |
| ST-6        | Phase 2 | Pending |
| ST-7        | Phase 2 | Pending |
| ST-8        | Phase 2 | Pending |
| ST-9        | Phase 2 | Pending |
| PS-1        | Phase 1 | Pending |
| PS-2        | Phase 1 | Pending |
| PS-3        | Phase 1 | Pending |
| PS-4        | Phase 1 | Pending |
| PS-5        | Phase 1 | Pending |
| AS-1        | Phase 1 | Pending |
| AS-2        | Phase 5 | Pending |
| AS-3        | Phase 5 | Pending |
| AS-4        | Phase 1 | Pending |
| AS-5        | Phase 1 | Pending |
| AS-6        | Phase 5 | Pending |
| AS-7        | Phase 5 | Pending |
| AS-8        | Phase 3 | Pending |
| AS-9        | Phase 3 | Pending |
| ES-1        | Phase 1 | Pending |
| ES-2        | Phase 1 | Pending |
| ES-3        | Phase 1 | Pending |
| ES-4        | Phase 1 | Pending |
| ES-5        | Phase 1 | Pending |
| IL-1        | Phase 1 | Pending |
| IL-2        | Phase 1 | Pending |
| IL-3        | Phase 1 | Pending |
| IL-4        | Phase 1 | Pending |
| IL-5        | Phase 1 | Pending |
| NFR-1       | Phase 1 | Pending |
| NFR-2       | Phase 5 | Complete |
| NFR-3       | Phase 5 | Complete |
| NFR-4       | Phase 1 | Pending |
| NFR-5       | Phase 4 | Pending |
| NFR-6       | Phase 1 | Pending |
| NFR-7       | Phase 2 | Pending |
| NFR-8       | Phase 7 | Complete |
| NFR-9       | Phase 1 | Pending |
| NFR-10      | Phase 1 | Pending |
| NFR-11      | Phase 7 | Complete |
| NFR-12      | Phase 2 | Pending |
| IMP-01      | Phase 11 | Complete |
| IMP-02      | Phase 11 | Complete |
| IMP-03      | Phase 11 | Complete |
| IMP-04      | Phase 10 | Complete |
| IMP-05      | Phase 10 | Complete |
| IMP-06      | Phase 10 | Complete |
| IMP-07      | Phase 10 | Complete |
| IMP-08      | Phase 10 | Complete |
| IMP-09      | Phase 11 | Complete |
| IMP-10      | Phase 11 | Complete |
| IMP-11      | Phase 11 | Complete |
| PRL-01      | Phase 9  | Complete |
| PRL-02      | Phase 8  | Complete |
| PRL-03      | Phase 9  | Complete |
| PRL-04      | Phase 9  | Complete |
| PRL-05      | Phase 9  | Complete |
| PRL-06      | Phase 8  | Complete |
| PRL-07      | Phase 8  | Complete |
| PRL-08      | Phase 8  | Complete |
| PRL-09      | Phase 8  | Complete |
| PRL-10      | Phase 8  | Complete |
| PRL-11      | Phase 8  | Complete |
| PRL-12      | Phase 8  | Complete |
| PRL-13      | Phase 9  | Complete |
| PRL-14      | Phase 9  | Complete |
| PRL-15      | Phase 9  | Complete |
| PRL-16      | Phase 9  | Complete |

**Coverage:**

- v1 requirements: 210 total (200 original IDs + 10 scope-rule clarification IDs: PI-16, PI-17, CMP-1..8)
- Mapped to phases: 205 (97.6%) -- MA-7 superseded by D-21 (Phase 1 adopted isomorphic-git, removing the "git CLI not found" failure mode); MU-2 and MU-3 superseded by Phase 4 D-14 (follow-upstream-blindly semantics; the local marketplace clone is read-only by contract, so non-fast-forward divergence cannot occur); PR-4 superseded by Phase 5 D-07 (custom componentPath arrays now SUPPLEMENT defaults rather than replace them; behavior corrected vs V1 per COMP-01 / Gap 3); PI-15 superseded by Phase 7 D-08 (per-scope lock acquisition fails losers with `STATE_LOCK_HELD_PREFIX` before state-guard commit)
- v1.1 requirements: 16 total (PRL-01..16), all mapped to Phases 8/9.
- v1.2 requirements: 11 total (IMP-01..11), all mapped to Phases 10/11.
- Unmapped: 0 (MA-7, MU-2, MU-3, PR-4, PI-15 are superseded, not unmapped)

**Per-phase counts:**

| Phase                                         | REQ-IDs                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: Foundations & Toolchain              | 23 (NFR-1, NFR-4, NFR-6, NFR-9, NFR-10, IL-1..5, ES-1..5, PS-1..5, AS-1, AS-4, AS-5)                                                    |
| Phase 2: Domain Core & Persistence Primitives | 38 (NFR-7, NFR-12, SP-1..7, SC-1..4, SC-7, MM-1..7, PR-1..3, PR-5, PR-6, RN-1..2, ST-1..9) -- PR-4 superseded by Phase 5 D-07            |
| Phase 3: Resource Bridges                     | 34 (SK-1..5, CM-1..4, AG-1..12, MC-1..8, RN-4..6, AS-8..9)                                                                              |
| Phase 4: Marketplace Orchestrators            | 42 (MA-1..6, MA-8..11 (MA-7 superseded by D-21), MR-1..8, ML-1..4, MU-1, MU-4..9 (MU-2, MU-3 superseded by Phase 4 D-14), MAU-1..4, SC-5..6, CMP-1, RH-1..5, NFR-5) |
| Phase 5: Plugin Orchestrators                 | 52 (PI-1..14, PI-16..17, PU-1..8, PUP-1..9, PL-1..7, CMP-2..5, RN-3, AS-2..3, AS-6..7, NFR-2..3) -- PI-15 superseded by Phase 7 D-08                           |
| Phase 6: Edge Layer & Tab Completion          | 16 (TC-1..9, CMP-6..8, AP-1..4)                                                                                                                   |
| Phase 7: Integration & Pi Wiring              | 4 (NFR-8, NFR-11) -- note: NFR-2/3 land in Phase 5 since they describe orchestrator behavior; Phase 7 verifies them in live environment |
| Phase 8: Atomic Reinstall Core                | 8 (PRL-02, PRL-06..12)                                                                                                                |
| Phase 9: Reinstall Edge & Bulk UX             | 8 (PRL-01, PRL-03..05, PRL-13..16)                                                                                                    |
| Phase 10: Claude Settings Import Foundation   | 5 (IMP-04..8)                                                                                                                         |
| Phase 11: Import Command Orchestration        | 6 (IMP-01..3, IMP-09..11)                                                                                                             |

> **Phase 7 count clarification:** NFR-8 and NFR-11 are the two REQ-IDs uniquely owned by Phase 7. The "live e2e against `anthropics/claude-plugins-official`" work in Phase 7 verifies NFR-2/NFR-3/NFR-5 in production-like conditions but those REQ-IDs are owned by their primary phase (5 / 5 / 4).

______________________________________________________________________

*Requirements defined: 2026-05-09 from `docs/prd/pi-claude-marketplace-prd.md` v1.0* *Last updated: 2026-05-16 -- merged origin/main into v1.1 reinstall branch; added Milestone v1.1 (PRL-01..16) covered by Phases 8 and 9. Inherited from main: D-29 (renumbered from main's D-26) / CMP-1..8 clarify marketplace-vs-plugin scope semantics and make install completion available-only for the current target scope; Phase 11 completed IMP-01..IMP-03 and IMP-09..IMP-11 for import command orchestration; Phase 10 completed IMP-04..IMP-08 for Claude settings import foundation.*
