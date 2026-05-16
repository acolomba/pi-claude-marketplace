# pi-claude-marketplace

## What This Is

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artefacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artefacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, marketplace add/remove/list).

This GSD project plans a successor architecture for the V1 implementation already in this repository. The PRD at `docs/prd/pi-claude-marketplace-prd.md` (1068 lines, v1.0) is derived from the V1 source and is the authoritative specification of what the successor must deliver.

## Core Value

A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Current Milestone: v1.2 Claude settings import

**Goal:** Import enabled Claude Code plugins from `.claude/settings.json` and `.claude/settings.local.json` into matching Pi marketplace/plugin scopes.

**Target features:**

- `/claude:plugin import [--scope user|project]` follows the existing scope convention: omitted `--scope` imports both user and project scopes; explicit `--scope` narrows to one scope.
- Per selected scope, read Claude base settings and local settings override, with `.claude/settings.local.json` overriding `.claude/settings.json`.
- Import only merged `enabledPlugins` entries whose value is exactly `true`, using `plugin@marketplace` keys.
- Add missing marketplaces before installing plugins, including Claude Code's built-in `claude-plugins-official` marketplace mapped to `anthropics/claude-plugins-official`.
- Read non-official marketplace sources from merged `extraKnownMarketplaces`, mapping Claude `directory` sources to Pi path-source marketplaces and Claude `github.repo` sources to Pi GitHub-source marketplaces.
- Skip already-added marketplaces and already-installed plugins idempotently; continue with warning when an enabled plugin is unavailable/uninstallable.

**Phase target:** v1.2 is expected to land as Phases 10 and 11 after the separately-developed v1.1 milestone uses Phases 8 and 9.

## Requirements

### Validated

<!-- Shipped and confirmed valuable via this GSD project. -->

- Phase 10 validated IMP-04..IMP-08: Claude settings discovery/merge, exact-true enabled plugin extraction, malformed-entry diagnostics, official marketplace mapping, `extraKnownMarketplaces` directory/github mapping, and both-scope import-plan duplication.
- Phase 11 validated IMP-01..IMP-03 and IMP-09..IMP-11: `/claude:plugin import [--scope user|project]` command routing, both-scope/default and explicit-scope behavior, idempotent marketplace/plugin import orchestration, unavailable-plugin warning aggregation, source-mismatch protection, reused marketplace/plugin atomic semantics, and command-level e2e coverage.

### Active

<!-- Successor scope. Detailed REQ-IDs in REQUIREMENTS.md. -->

**Vertical features (per PRD §5):**

- [ ] Marketplace lifecycle: `marketplace add / remove (rm) / list / update / autoupdate / noautoupdate`
- [ ] Plugin lifecycle: `install / uninstall / update`
- [ ] Listing & inspection: top-level `list` with `--installed / --available / --unavailable / --scope` filters
- [ ] Autoupdate & update cascade -- semantics that distinguish `marketplace update` (manifest refresh, optional cascade) from `update` (no syncClone)
- [ ] Skills bridge -- staged at `<scope>/pi-claude-marketplace/resources/skills/<plugin>-<skill>/SKILL.md`, surfaced via `resources_discover`
- [ ] Commands bridge -- staged at `<scope>/pi-claude-marketplace/resources/prompts/<plugin>:<command>.md`
- [ ] Agents bridge -- `<scope>/agents/pi-claude-marketplace-<plugin>-<agent>.md` with on-disk index, generated marker, and field-mapped frontmatter; soft dep on `pi-subagents`
- [ ] MCP servers bridge -- entries merged into `<scope>/mcp.json` with `_piClaudeMarketplace` marker; soft dep on `pi-mcp-adapter`

**Horizontal cross-cutting concerns (per PRD §6):**

- [ ] Source parsing & validation -- `owner/repo`, `https://github.com/...[#<ref>]`, local paths (`/`, `./`, `../`, `~`)
- [ ] Scopes & resolution -- exactly two scopes (`user`, `project`); typed `ScopedLocations` brand; explicit marketplace-source vs plugin-target scope rules
- [ ] Manifest schema & strict mode -- strict-true union resolver, strict-false entry-only resolver
- [ ] Plugin compatibility resolver -- discriminated `installable: true | false` union
- [ ] Resource naming, generation & conflicts -- deterministic generated names, `assertSafeName`, cross-plugin/cross-marketplace guards
- [ ] Tab completion -- `/claude:plugin` subcommand surface, `--scope` value completion, fish-style space normalization, available-only install completion aligned with scope rules
- [ ] Argument parsing -- quoted args, `--scope` validation, `Usage:` blocks
- [ ] Reload hint & soft-dependency probing -- emit only on actual resource change; probe `subagent` / `mcp` tools
- [ ] State persistence, migration & concurrency -- `state.json` schemaVersion 1, atomic save, `withStateGuard`, legacy migration
- [ ] Path safety & containment -- `assertPathInside` on every name-derived path; `PathContainmentError` propagates
- [ ] Atomic staging, commit & rollback -- same-FS tmp + atomic rename; phased rollback with leak aggregation
- [ ] Error surfaces & severity -- single `ctx.ui.notify` channel, severity discipline, `Error.cause` chains, stable marker strings (ES-5)
- [ ] Internationalization, logging, telemetry -- English-only V1, no telemetry, single sanctioned `console.warn`

**Milestone v1.2 import feature:**

- [x] Claude settings import command: `/claude:plugin import [--scope user|project]`
- [x] Claude settings discovery and merge: base settings plus local override per selected scope
- [x] Enabled-plugin extraction: import only `enabledPlugins["plugin@marketplace"] === true`
- [x] Marketplace source import: official built-in mapping plus `extraKnownMarketplaces` directory/GitHub sources
- [x] Import orchestration: add missing marketplaces, install enabled plugins, skip existing records, warn and continue on unavailable plugins

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
- **Marketplace/plugin scope split is explicit:** marketplaces can be configured in user or project scope, while plugin operations target a scope for writes. Project-target installs can source from project marketplaces first and user marketplaces second; user-target installs can source only from user marketplaces. The same plugin may be installed in both scopes, with project scope taking precedence for unqualified single-target operations.
- **Stable user-contract strings (PRD §6.12 ES-5):** `pi-subagents is not loaded; …`, `pi-mcp-adapter is not loaded; …`, `Run /reload to <verb> …`, `MANUAL RECOVERY REQUIRED: …`, `(rollback partial: [<phase>] <msg>; …)`. These cannot drift without a contract break.
- **State persistence surfaces (PRD §4):** `<scope>/pi-claude-marketplace/state.json`, `<scope>/pi-claude-marketplace/resources/{skills,prompts}/`, `<scope>/agents/pi-claude-marketplace-*.md`, `<scope>/mcp.json` -- plus `<scope>/pi-claude-marketplace/agents-index.json` for agent provenance.
- **Tooling baseline already on `main`:** TypeScript strict, ESLint flat config, Prettier, `npm run check` = typecheck + lint + format + tests. Pre-commit hooks exclude `.claude/` (committed in `8cb247d` / `33aaaaa` series).

## Constraints

- **Runtime:** Node ≥ 22 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@mariozechner/pi-coding-agent` peer dependency, currently `*` with development against `^0.70.6`; pinning a min version is a successor SHOULD (NFR-11)
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy:** Network is required only for GitHub-source `marketplace add` and for `update`/`marketplace update` against GitHub-source marketplaces; `install`, `list`, `uninstall`, `marketplace remove`, and path-source `marketplace add` MUST NOT touch the network (NFR-5)
- **Containment:** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json` (NFR-10)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6)
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code (IL-2). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4)
- **English only V1:** No message catalog, no locale negotiation (IL-1)
- **Scope model:** Exactly two scopes -- `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1). Marketplace records and plugin install records are scoped independently per D-29 / CMP-1..8.

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
| **D-23 (2026-05-10):** Adopt follow-upstream-blindly semantics for `marketplace update`; supersede PRD MU-2 and MU-3                | The local marketplace clone is read-only by contract -- the extension only clones, fetches, and checks out; it never commits, pushes, or modifies the working tree. Local-vs-upstream divergence cannot occur, so `pull --ff-only` and "non-fast-forward divergence as error" are no longer applicable. `marketplace update` therefore overrides the local branch ref to the remote SHA via `gitOps.forceUpdateRef` + `gitOps.checkout` (or checks out a detached SHA directly). Phase 4 implements this in `orchestrators/marketplace/update.ts` per CONTEXT.md D-14. Recorded by Plan 04-10. | -- Locked  |
| **D-24 (2026-05-10):** Adopt COMP-01 (Gap 3) supplement-not-replace for plugin component-path arrays; supersede PRD PR-4 | The V1 resolver short-circuited implicit-by-convention detection whenever a manifest declared a `componentPaths.{skills,commands,agents}` value, making custom paths *replace* defaults rather than supplement them. Phase 5 D-07 corrects this vs upstream Claude Code behavior: `domain/resolver.ts`'s `ComponentPathsSchema` migrates from optional-string-per-kind to readonly-string-array-per-kind; strict resolver Step 7 computes a UNION of declared (entry > manifest) + implicit-by-convention (when the conventional dir exists), deduplicated by path with first-wins on collisions; loose resolver stays entry-only. Bridge `discover.ts` files iterate the array. Behavior corrected vs V1 per COMP-01 / Gap 3 -- see `.planning/phases/05-plugin-orchestrators/05-CONTEXT.md` D-07. Recorded by Plan 05-10; behavior change landed in Plan 05-03. | -- Locked  |
| **D-25 (2026-05-11):** Adopt Phase 7 lock-held marker semantics; supersede PRD PI-15's old concurrent-install commit marker | Phase 7 D-08 moves cross-process conflict detection ahead of `withStateGuard` mutation by taking the per-scope `.state-lock` first. The loser now fails fast with `STATE_LOCK_HELD_PREFIX` (`Another pi-claude-marketplace operation is in progress for`) and retry guidance, so it never reaches the old `was installed concurrently` state-guard commit rollback path. This preserves retry safety while making the user-visible contract match the actual lock boundary. Recorded by Plan 07-06; behavior landed in Plan 07-04. | -- Locked  |
| **D-26 (2026-05-13):** v1.2 import follows existing `--scope user|project` convention; omitted scope means both scopes | Keeps `/claude:plugin import` consistent with read/enumeration commands such as `list`: no new `all` value is introduced. User-scope Claude settings import to Pi user scope; project-scope Claude settings import to Pi project scope; if the same marketplace/plugin is enabled in both settings scopes, both Pi scopes receive it unless narrowed by `--scope`. | -- Locked |
| **D-27 (2026-05-13):** Claude Code's built-in `claude-plugins-official` marketplace maps to `anthropics/claude-plugins-official` | Claude Code ships this marketplace implicitly, so an enabled `plugin@claude-plugins-official` must be importable even when `extraKnownMarketplaces` has no entry for it. Non-official marketplace sources come from merged `extraKnownMarketplaces`. | -- Locked |
| **D-28 (2026-05-14):** Phase 10 import foundation remains pure desired-state planning | `buildClaudeImportPlan` returns scoped marketplace/plugin/skipped actions and diagnostics only. It does not call marketplace add, plugin install, state mutation, network, or user notification APIs; Phase 11 owns orchestration and presentation. | -- Locked |
| **D-29 (2026-05-15):** Clarify marketplace/plugin scope rules and install completion | Marketplaces are scoped records, but plugin operations write to a target scope. A project-target install may source from project scope first and user scope as fallback; a user-target install may source only from user scope. The same plugin may be installed in both scopes. Project scope takes precedence for unqualified single-target remove/update/reinstall-style operations, while explicit `--scope` overrides. Completion follows the same visibility rules, and `install` completion suggests only plugins available in the current target scope (installable and not already installed), not unavailable plugins. Recorded by quick task 260515-wpe. | -- Locked  |

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

*Last updated: 2026-05-16 -- Merged origin/main: D-29 added (renumbered from main's D-26 to avoid collision) -- marketplace/plugin scope semantics are explicit, project-target installs may source user-scope marketplaces as fallback, dual-scope plugin installs are allowed, project scope takes precedence for unqualified single-target operations, and install completion is available-only for the current target scope.*

*Last updated: 2026-05-14 -- Phase 11 completed the Claude settings import command milestone for IMP-01..IMP-03 and IMP-09..IMP-11 with command-level e2e validation. Earlier same-day update: Phase 10 completed the pure Claude settings import foundation for IMP-04..IMP-08 and locked D-28 desired-state planning boundary for Phase 11 orchestration.*

*Last updated: 2026-05-13 -- Corrected milestone v1.2 phase target to Phases 10 and 11 because the separately-developed v1.1 milestone owns Phases 8 and 9. Earlier same-day update initialized Claude settings import scope and D-26/D-27 decisions.*

*Last updated: 2026-05-11 -- D-25 added: Phase 7 D-08 supersedes PRD PI-15's old concurrent-install marker. Concurrent operation losers now fail at per-scope lock acquisition with `STATE_LOCK_HELD_PREFIX` (`Another pi-claude-marketplace operation is in progress for`) plus retry guidance, rather than reaching the old `was installed concurrently` state-guard commit path.*

*Last updated: 2026-05-10 -- D-24 added: Phase 5 D-07 supersedes PRD PR-4 (COMP-01 / Gap 3 supplement-not-replace; custom componentPath arrays now SUPPLEMENT defaults rather than replace them). Behavior change landed in Plan 05-03; documentation supersession trail landed in Plan 05-10 (REQUIREMENTS.md PR-4 strikethrough + PROJECT.md D-24 row + CHANGELOG.md entry). PRD §6.4 PR-4 intentionally retained as historical baseline; supersession lives in `.planning/` artifacts only.*

*Last updated: 2026-05-10 -- Phase 2 (Domain Core & Persistence Primitives) complete: hand-written source parser with discriminated `ParsedSource` union, TypeBox 1.x JIT-compiled manifest schemas (marketplace + plugin + mcp), `assertSafeName` + 3 generators, `computeHashVersion` with PI-7 12-hex pinned snapshot (`hash-743f35130ec4`), `ScopedLocations` brand bundle, `state.json` schema/IO + legacy migration with single sanctioned `console.warn`, `installable: true | false` discriminated resolver (NFR-7) with `resolveStrict` + `resolveLoose`, transaction primitives (`runPhases` ledger + `formatRollbackError` + `withStateGuard`). 188-test suite, 5/5 must-haves verified.*

*Last updated: 2026-05-09 -- Phase 1 (Foundations & Toolchain) complete: atomic-IO primitives, symlink-aware path safety, ES-5 marker constants, output-channel discipline, ESM baseline, isomorphic-git wrapper, 9-folder skeleton, 30-test architecture+unit suite, Node 24 CI workflow.*
