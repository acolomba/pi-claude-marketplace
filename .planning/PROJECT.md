# pi-claude-marketplace

## What This Is

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artefacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artefacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, marketplace add/remove/list).

This GSD project plans a successor architecture for the V1 implementation already in this repository. The PRD at `docs/prd/pi-claude-marketplace-prd.md` (1068 lines, v1.0) is derived from the V1 source and is the authoritative specification of what the successor must deliver.

## Core Value

A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Requirements

### Validated

<!-- Shipped and confirmed valuable via this GSD project. -->

(None yet -- V1 predates this GSD project; deliverables will be tracked here as phases ship.)

### Active

<!-- Successor scope. Detailed REQ-IDs in REQUIREMENTS.md. -->

**Vertical features (per PRD §5):**

- [ ] Marketplace lifecycle: `marketplace add / remove (rm) / list / update / autoupdate / noautoupdate`
- [ ] Plugin lifecycle: `install / uninstall / update`
- [ ] Listing & inspection: top-level `list` with `--installed / --available / --unavailable / --scope` filters
- [ ] Autoupdate & update cascade -- semantics that distinguish `marketplace update` (manifest refresh, optional cascade) from `update` (no syncClone)
- [ ] Skills bridge -- staged at `<scope>/claude-marketplace/resources/skills/<plugin>-<skill>/SKILL.md`, surfaced via `resources_discover`
- [ ] Commands bridge -- staged at `<scope>/claude-marketplace/resources/prompts/<plugin>:<command>.md`
- [ ] Agents bridge -- `<scope>/agents/claude-marketplace-<plugin>-<agent>.md` with on-disk index, generated marker, and field-mapped frontmatter; soft dep on `pi-subagents`
- [ ] MCP servers bridge -- entries merged into `<scope>/mcp.json` with `_claudeMarketplace` marker; soft dep on `pi-mcp-adapter`

**Horizontal cross-cutting concerns (per PRD §6):**

- [ ] Source parsing & validation -- `owner/repo`, `https://github.com/...[#<ref>]`, local paths (`/`, `./`, `../`, `~`)
- [ ] Scopes & resolution -- exactly two scopes (`user`, `project`); typed `ScopedLocations` brand
- [ ] Manifest schema & strict mode -- strict-true union resolver, strict-false entry-only resolver
- [ ] Plugin compatibility resolver -- discriminated `installable: true | false` union
- [ ] Resource naming, generation & conflicts -- deterministic generated names, `assertSafeName`, cross-plugin/cross-marketplace guards
- [ ] Tab completion -- `/claude:plugin` subcommand surface, `--scope` value completion, fish-style space normalization
- [ ] Argument parsing -- quoted args, `--scope` validation, `Usage:` blocks
- [ ] Reload hint & soft-dependency probing -- emit only on actual resource change; probe `subagent` / `mcp` tools
- [ ] State persistence, migration & concurrency -- `state.json` schemaVersion 1, atomic save, `withStateGuard`, legacy migration
- [ ] Path safety & containment -- `assertPathInside` on every name-derived path; `PathContainmentError` propagates
- [ ] Atomic staging, commit & rollback -- same-FS tmp + atomic rename; phased rollback with leak aggregation
- [ ] Error surfaces & severity -- single `ctx.ui.notify` channel, severity discipline, `Error.cause` chains, stable marker strings (ES-5)
- [ ] Internationalization, logging, telemetry -- English-only V1, no telemetry, single sanctioned `console.warn`

### Out of Scope

<!-- Explicit V1 boundaries from PRD §1 non-goals + PRD §11. -->

- **Claude `local` scope** -- no Pi equivalent
- **Plugin sources beyond local paths** -- `github` / `git` / `git-subdir` / `npm` object sources parse and surface as `unavailable`
- **Marketplace source kinds beyond GitHub + local** -- SSH URLs, arbitrary HTTPS git URLs, remote `marketplace.json` URLs, sparse checkout, browser-paste tree URLs (`/tree/<ref>`)
- **Components beyond skills/commands/agents/mcpServers** -- hooks, lspServers, monitors, themes, output styles, channels, userConfig, bin, settings (detected and surfaced as `unavailable`)
- **Automatic dependency resolution / pruning** -- declared `dependencies` produce a manual-install warning only
- **Custom component-path arrays as supplemental** -- explicit declaration replaces the default
- **Mutating LLM tools for install/update/remove** -- only listing tools exposed
- **Performance: manifest caching with mtime invalidation** -- backlog
- **Rich interactive selectors** -- backlog
- **JSON output / dry-run modes** -- backlog
- **Session-start autoupdate run** -- Claude Code parity, deferred
- **`info` subcommand** -- deferred
- **`--force` install with `incomplete` state** -- deferred
- **Managed/allowlist/blocklist policies** -- no Pi equivalent
- **Telemetry, message catalogs, structured event channels** -- successor-architecture concerns beyond V1 (NFR-IL guidance)

## Context

- **Existing V1 implementation** lives in this repository on branch `features/initial`. The PRD documents that V1's surface, behavior, and contracts. The successor architecture project (this branch, `features/initial-gsd`) reuses the PRD as the spec; whether a given module is preserved, refactored, or rewritten is a per-phase planning decision.
- **Personas served:** Pi end user (developer), project lead curating per-project marketplaces, plugin author verifying resolution, operator/power user diagnosing drift.
- **Soft-dependency model is load-bearing:** `pi-subagents` (probed via `subagent` tool) and `pi-mcp-adapter` (probed via `mcp` tool name OR `sourceInfo.source` substring match for `pi-mcp-adapter`) MUST never block installs; absent soft deps degrade with explicit guidance and a reload hint.
- **Stable user-contract strings (PRD §6.12 ES-5):** `pi-subagents is not loaded; …`, `pi-mcp-adapter is not loaded; …`, `Run /reload to <verb> …`, `MANUAL RECOVERY REQUIRED: …`, `(rollback partial: [<phase>] <msg>; …)`. These cannot drift without a contract break.
- **State persistence surfaces (PRD §4):** `<scope>/claude-marketplace/state.json`, `<scope>/claude-marketplace/resources/{skills,prompts}/`, `<scope>/agents/claude-marketplace-*.md`, `<scope>/mcp.json` -- plus `<scope>/claude-marketplace/agents-index.json` for agent provenance.
- **Tooling baseline already on `main`:** TypeScript strict, ESLint flat config, Prettier, `npm run check` = typecheck + lint + format + tests. Pre-commit hooks exclude `.claude/` (committed in `8cb247d` / `33aaaaa` series).

## Constraints

- **Runtime:** Node ≥ 22 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@mariozechner/pi-coding-agent` peer dependency, currently `*` with development against `^0.70.6`; pinning a min version is a successor SHOULD (NFR-11)
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy:** Network is required only for GitHub-source `marketplace add` and for `update`/`marketplace update` against GitHub-source marketplaces; `install`, `list`, `uninstall`, `marketplace remove`, and path-source `marketplace add` MUST NOT touch the network (NFR-5)
- **Containment:** Refuse to write outside `<scopeRoot>/claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json` (NFR-10)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6)
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code (IL-2). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4)
- **English only V1:** No message catalog, no locale negotiation (IL-1)
- **Scope model:** Exactly two scopes -- `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1)

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision                                                                                                                     | Rationale                                                                                                                                                                                                                           | Outcome    |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Use the PRD verbatim as the V1 specification                                                                                 | PRD is comprehensive (~100 requirements across 13 horizontal areas + 4 bridges + 3 lifecycle command groups) and was derived from the working V1; re-deriving requirements via questioning would waste tokens without adding signal | -- Pending |
| Skip the `/gsd-map-codebase` step                                                                                            | The PRD already documents the V1 architecture (modules, persistence layout, soft-dep probing) in §9 architecture diagrams; phase planning will read source selectively as needed                                                    | -- Pending |
| Two scopes only (`user`, `project`); no Claude `local` scope                                                                 | Mirror Pi's scope model rather than Claude Code's; introducing `local` requires a Pi-side equivalent first (SC-1)                                                                                                                   | -- Pending |
| Soft-degrade on `pi-subagents`/`pi-mcp-adapter` rather than hard-require                                                     | Plugin installs must not be blocked by an unloaded companion extension; degraded path emits a stable warning + reload hint                                                                                                          | -- Pending |
| All user-visible failures through `ctx.ui.notify` with `default / warning / error` severity ladder (ES-2)                    | Single output channel keeps testing tractable and prevents orphan `process.stdout` writes from drifting the user contract                                                                                                           | -- Pending |
| Forward-compatible `marketplace.json` parser (no schema-version check; unknown source kinds → `{ kind: "unknown", reason }`) | Targets the de-facto schema in `anthropics/claude-plugins-official` as of V1; a hard schema check would create churn against an evolving upstream (NFR-12)                                                                          | -- Pending |
| 12-char SHA-256 truncation for content-hash plugin versions (`hash-<12hex>`)                                                 | Stable contract -- changing it silently invalidates every existing user's hash-versioned install record on next `update`. 12 hex ≈ 48 bits is well above per-user collision threshold (PI-7)                                        | -- Pending |
| **D-21 (2026-05-09):** Adopt `isomorphic-git`; supersede MA-7 (`git CLI not found`) requirement                              | `isomorphic-git` is pure-JS so the "git not found on PATH" failure mode is eliminated. MA-7 no longer applicable. Affects Phase 1 (`platform/git.ts`) and Phase 4 (marketplace orchestrators). Recorded by Plan 01-04.              | -- Locked  |
| **D-22 (2026-05-09):** Zero `pi.registerTool` calls in Phase 1; LLM tool surface deferred to Phase 6 (`edge/handlers/list.ts`) | Phase 1 ships only the `/claude:plugin` slash command + `resources_discover` event handler. The LLM tool surface (`claude_plugin_list`/`install`/`uninstall`/etc.) is a Phase 6 deliverable. Regression-guarded by `tests/shared/index-smoke.test.ts` (asserts `tools.length === 0`). Resolved at the Plan 01-07 checkpoint (`approved-zero-tools`). | -- Locked  |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

______________________________________________________________________

*Last updated: 2026-05-09 after initialization from `docs/prd/pi-claude-marketplace-prd.md` v1.0*
