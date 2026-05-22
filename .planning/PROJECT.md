# pi-claude-marketplace

## What This Is

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artefacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artefacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list).

The v1.0 successor architecture shipped the PRD-derived V1 surface. v1.1 added atomic plugin reinstall semantics. v1.2 added a Claude settings import command. The current v1.3 milestone refactors every user-visible output through `ctx.ui.notify` (and the single sanctioned `console.warn`) into conformance with a locked messaging style guide and per-command output catalog -- preserving the same lifecycle, scope, reload-hint, soft-dependency, and retry-safety contracts but normalizing how each surface renders.

## Core Value

A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Current Milestone: v1.3 Consistent Messaging

**Goal:** Bring every user-visible `ctx.ui.notify` callsite (and the single sanctioned `console.warn`) into conformance with the locked v1.0 messaging style guide and per-command output catalog, so the rendered contract is uniform across every `/claude:plugin` surface.

**Spec inputs (locked on this branch, commit `62d141d`):**

- `docs/messaging-style-guide.md` (v1.0, normative) -- 19 sections, MSG-GR-1..5 / MSG-IC-1..3 / MSG-SD-1..2 / MSG-RH-1 / ES-5 supersession table
- `docs/output-catalog.md` -- per-command rendered output for each user-visible state across `list`, `install`, `uninstall`, `reinstall`, `update`, `marketplace add/remove/list/update/autoupdate`, `import`, `bootstrap`, usage errors

**Target features:**

- Universal line grammar (MSG-GR-1) `<icon> <subject> [<scope>] [<marker>] [(status)] [{reasons}]` on every notify line; reserved tokens respected
- Plugin-row icon discipline (MSG-IC-1..3): ● installed / ○ uninstalled-no-error / ⊘ error or failure-cascade child; marketplace icons reflect outcome class
- Closed status-token + reasons enum from the catalog; reasons rendered as 1-3 words lowercase; manifest field names verbatim as the sole carve-out
- Per-scope marketplace and plugin rendering with name-primary / scope-secondary sort (project before user); orphan-plugin fold rule limited to the plugin-list surface
- Autoupdate marker grammar (MSG-GR-5) `<autoupdate>` / `<no autoupdate>` rendered in its own slot, marketplace-only
- Marketplace header form on multi-plugin commands; `@<marketplace>` token omitted from indented plugin rows; single-plugin and marketplace-only commands stay in their existing forms
- Soft-dep markers (MSG-SD-1..2) `{requires pi-subagents}` / `{requires pi-mcp}` emitted on installed / updated / reinstalled rows when companion extensions are unloaded; excluded from uninstalled rows
- Reload-hint policy (MSG-RH-1) emitted exactly once per body when any resource changed; omitted on all-failed cascades and manifest-only refreshes; coexists with the recovery anchor on partial-failure remove
- Single canonical manual-recovery and rollback-partial formatting; cause chains rendered per section 9
- Severity routing (section 10) per pattern class for single-shot, cascade, and usage paths
- Empty-result and legacy-migrate patterns; the single sanctioned `console.warn` adopts the new section 14.1 wording
- ES-5 supersession (section 15 / MSG-04) applied throughout, with marker constants and string-equality tests migrated
- Per-command output conformance: every command rendering in the catalog produces output matching the worked examples for each of its rendered states

## Requirements

### Validated

<!-- Shipped and confirmed valuable via this GSD project. -->

- ✓ v1.0 successor architecture: `/claude:plugin` command surface, marketplace lifecycle, plugin `install` / `uninstall` / `update`, top-level `list`, skills/commands/agents/MCP bridges, tab completion, real Pi wiring, live/runtime e2e coverage, and cross-process state locking.
- ✓ v1.1 Reinstall Command (Phases 8-9): `reinstall` command routed through `/claude:plugin` with `update`-analogous syntax (`reinstall <plugin>@<marketplace>`, `reinstall @<marketplace>`, bare `reinstall`); `--scope user|project` filtering; cached-manifest / recorded-version reuse with no network sync; atomic per-plugin replacement via `withLockedStateTransaction` (PRL-09/10/11/12); post-success plugin data cleanup; deterministic bulk-cascade partitioning + reload-hint and soft-dep aggregation; installed-only tab completion plus reinstall-specific `--force`.
- ✓ v1.2 Claude Settings Import (Phases 10-11): `/claude:plugin import [--scope user|project]` command; Claude settings discovery and base/override merge per selected scope; enabled-plugin extraction (`enabledPlugins["plugin@marketplace"] === true`); official `claude-plugins-official` built-in mapping plus `extraKnownMarketplaces` directory/GitHub source mapping; idempotent orchestration with unavailable-plugin warning aggregation, source-mismatch protection, and reused marketplace/plugin atomic semantics; both-scope default with explicit-scope override (D-26); D-28 pure desired-state planning boundary.

### Active

<!-- Current scope. Building toward these. Detailed REQ-IDs in REQUIREMENTS.md. -->

**v1.3 Consistent Messaging:**

- [ ] Universal line grammar (MSG-GR-1) applied at every notify callsite and the sanctioned `console.warn`
- [ ] Plugin-row icon rule (MSG-IC-1..3) enforced: ● installed / ○ uninstalled-no-error / ⊘ error or failure-cascade child
- [ ] CMC-09 upgradable list-only discipline: `(upgradable)` is computed per PRD PL-5 string compare and rendered ONLY by `list`; never on install / update / uninstall / reinstall result rows (MSG-PL-4)
- [ ] Marketplace icon rule (outcome class) applied uniformly across header and standalone-row forms
- [ ] Status-token + reasons enums constrained to the catalog set; reasons rendered 1-3 words lowercase; manifest field names verbatim
- [ ] Per-scope marketplace and plugin rendering (MSG-GR-3) with name-primary / scope-secondary sort, the plugin-list orphan fold rule, and CMC-21 adoption: orphan project-scoped plugins fold under user-scope headers and are adopted when a project-scope marketplace is later added
- [ ] Autoupdate marker grammar (MSG-GR-5) rendered in its own `<...>` slot, marketplace-only
- [ ] Marketplace header form on multi-plugin commands; single-plugin commands stay inline; marketplace-only commands stay flat
- [ ] Soft-dep markers (MSG-SD-1..3, CMC-12/13) emitted per row -- on installed / updated / reinstalled rows, on `list`-rendering `(available)` and `(installed)` rows, and per-row inside `import` / `update` / `reinstall` cascades when companion extensions are unloaded; excluded from `(uninstalled)` rows. The aggregated single-trailer emission is replaced by per-row `{}` reasons (D-13 expansion)
- [ ] Reload-hint policy (MSG-RH-1) emitted exactly once when any resource changed; omitted on all-failed cascades and manifest-only refreshes; coexists with partial-failure remove recovery anchor
- [ ] Manual-recovery and rollback-partial canonical formatting; cause-chain rendering per section 9
- [ ] Severity routing (section 10) applied per pattern class
- [ ] Empty-result and legacy-migrate patterns; section 14.1 wording adopted for the single sanctioned `console.warn`
- [ ] CMC-37 IL-3 inline disable comment preservation: the `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: <rationale>` comment stays inline directly above the sanctioned `console.warn`; no config-file rule widening; no second `console.warn` callsite introduced (MSG-LC-2)
- [ ] ES-5 supersession (section 15 / MSG-04) applied throughout with marker constants and string-equality tests migrated
- [ ] Per-command conformance: every rendered state in `docs/output-catalog.md` produces output matching the worked examples (success, mixed, all-failed, all-unchanged, empty, usage error)
- [ ] CMC-38 drift guard test suite (Phase 14 milestone gate): a frontmatter-driven test suite reads `docs/messaging-style-guide.md` YAML frontmatter (`status_tokens:`, `reasons:`, `markers:`, `pattern_classes:`) plus the normative MSG-* IDs as the binding contract; `npm run check` fails when a callsite emits an out-of-set token or violates an MSG-* rule

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
- **Stable user-contract strings (superseded by D-30; v1.3 canonical contract is `docs/messaging-style-guide.md` §15 / MSG-04):** The five PRD §6.12 ES-5 strings have v1.3 replacements per style guide §15:
  - `pi-subagents is not loaded; …` → `{requires pi-subagents}` reason on the affected line (§6 MSG-SD-1)
  - `pi-mcp-adapter is not loaded; …` → `{requires pi-mcp}` reason on the affected line (§6 MSG-SD-1)
  - `Run /reload to <verb> …` → `/reload to pick up changes` (single canonical trailer, blank line above) (§5 MSG-RH-1)
  - `MANUAL RECOVERY REQUIRED: …` → `⊘ <resource> (manual recovery) {<reason>}` as a separate top-level line (§7 MSG-MR-1 / MSG-MR-2)
  - `(rollback partial: [<phase>] <msg>; …)` → `{rollback partial}` reason on the failed line + per-phase indented children (§8 MSG-RP-1)
  The legacy strings remain in PRD §6.12 as historical baseline but are no longer the canonical contract for these five user-facing surfaces -- the style guide is. ES-1..ES-4 from PRD §6.12 are unchanged; this supersession is scoped strictly to ES-5.
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
| **D-30 (2026-05-21):** Adopt `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md` as the normative user-contract for v1.3; supersede PRD §6.12 ES-5 marker strings | The style guide explicitly supersedes the ES-5 table (section 15 / MSG-04). Every user-visible `ctx.ui.notify` callsite and the single sanctioned `console.warn` (section 14.1 wording) MUST conform to the catalog rendering for the operation being performed. Reasons enum is closed (1-3 words lowercase, manifest field names verbatim as carve-out); marker grammar gains the `<autoupdate>`/`<no autoupdate>` slot (MSG-GR-5); per-scope rendering replaces multi-scope collapse for marketplaces and plugins. ES-5 string-equality tests migrate. v1.3 milestone owns the conformance pass. | -- Locked  |

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

*Last updated: 2026-05-21 -- Milestone v1.3 started: Consistent Messaging. Spec inputs (`docs/messaging-style-guide.md` v1.0, `docs/output-catalog.md`) are locked on this branch (commit `62d141d`). v1.1 Reinstall (Phases 8-9) and v1.2 Claude Settings Import (Phases 10-11) moved to Validated. D-30 locks adoption of the style guide / catalog as the v1.3 user-contract and the ES-5 supersession boundary. Roadmap will continue phase numbering from 11; no `--reset-phase-numbers`.*

*Last updated: 2026-05-16 -- Merged origin/main into v1.1 reinstall branch. Brings in main's D-26/D-27/D-28 decisions (renumbered from collision-free numbering where required), Phase 10/11 completion for the v1.2 Claude settings import milestone, scope-rules implementation, and available-only install completion. v1.1 reinstall work continues atop the merged state.*

*Last updated: 2026-05-13 -- Milestone v1.1 started: Reinstall Command. Active scope now targets atomic per-plugin reinstall using cached manifests/recorded versions, update-analogous target forms, scope filtering, and post-success plugin data cleanup.*

*Last updated: 2026-05-14 -- Phase 11 completed the Claude settings import command milestone for IMP-01..IMP-03 and IMP-09..IMP-11 with command-level e2e validation. Earlier same-day update: Phase 10 completed the pure Claude settings import foundation for IMP-04..IMP-08 and locked D-28 desired-state planning boundary for Phase 11 orchestration.*

*Last updated: 2026-05-13 -- Corrected milestone v1.2 phase target to Phases 10 and 11 because the separately-developed v1.1 milestone owns Phases 8 and 9. Earlier same-day update initialized Claude settings import scope and D-26/D-27 decisions.*

*Last updated: 2026-05-11 -- D-25 added: Phase 7 D-08 supersedes PRD PI-15's old concurrent-install marker. Concurrent operation losers now fail at per-scope lock acquisition with `STATE_LOCK_HELD_PREFIX` (`Another pi-claude-marketplace operation is in progress for`) plus retry guidance, rather than reaching the old `was installed concurrently` state-guard commit path.*

*Last updated: 2026-05-10 -- D-24 added: Phase 5 D-07 supersedes PRD PR-4 (COMP-01 / Gap 3 supplement-not-replace; custom componentPath arrays now SUPPLEMENT defaults rather than replace them). Behavior change landed in Plan 05-03; documentation supersession trail landed in Plan 05-10 (REQUIREMENTS.md PR-4 strikethrough + PROJECT.md D-24 row + CHANGELOG.md entry). PRD §6.4 PR-4 intentionally retained as historical baseline; supersession lives in `.planning/` artifacts only.*

*Last updated: 2026-05-10 -- Phase 2 (Domain Core & Persistence Primitives) complete: hand-written source parser with discriminated `ParsedSource` union, TypeBox 1.x JIT-compiled manifest schemas (marketplace + plugin + mcp), `assertSafeName` + 3 generators, `computeHashVersion` with PI-7 12-hex pinned snapshot (`hash-743f35130ec4`), `ScopedLocations` brand bundle, `state.json` schema/IO + legacy migration with single sanctioned `console.warn`, `installable: true | false` discriminated resolver (NFR-7) with `resolveStrict` + `resolveLoose`, transaction primitives (`runPhases` ledger + `formatRollbackError` + `withStateGuard`). 188-test suite, 5/5 must-haves verified.*

*Last updated: 2026-05-09 -- Phase 1 (Foundations & Toolchain) complete: atomic-IO primitives, symlink-aware path safety, ES-5 marker constants, output-channel discipline, ESM baseline, isomorphic-git wrapper, 9-folder skeleton, 30-test architecture+unit suite, Node 24 CI workflow.*
