# pi-claude-marketplace

## What This Is

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artefacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artefacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

Four milestones have shipped: v1.0 (PRD-derived successor architecture), v1.1 (atomic plugin reinstall), v1.2 (Claude settings import), and v1.3 (consistent messaging -- every user-visible output conforming to a locked style guide + per-command catalog, structurally enforced by a 34-rule ESLint drift-guard plugin and a byte-equality catalog UAT runner).

## Core Value

A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Current Milestone: v1.4 Structured Notification Messages

**Goal:** Replace v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simultaneously simplify the user-output spec to a single uniform shape: every output renders a marketplace header + indented plugin rows, single-plugin operations included.

**Target features:**

- Two public methods: `notify(ctx, NotificationMessage)` for state-change notifications and `notifyUsageError(ctx, UsageErrorMessage)` for argv-validation errors. Severity computed from contents; reload-hint trailer computed from contents; no caller-visible severity field.
- `NotificationMessage` carries a `marketplaces: readonly MarketplaceNotificationMessage[]` tree. `MarketplaceNotificationMessage` carries optional `status: MarketplaceStatus` (added | removed | updated | failed), optional `details: MarketplaceDetails` (list context: autoupdate, last-updated), and `plugins: readonly PluginNotificationMessage[]`. `PluginNotificationMessage` is a discriminated union on `status` (10 variants -- installed / updated / reinstalled / uninstalled / available / unavailable / upgradable / failed / skipped / "manual recovery"); `PluginStatus = PluginNotificationMessage["status"]` derived via indexed access.
- New closed enum `Dependency = "agents" | "mcp"` replaces v1.3's `declaresAgents`/`declaresMcp` booleans on installed/updated/reinstalled plugin rows. Renderer probes each declared dependency at notify time and emits `{requires pi-subagents}` / `{requires pi-mcp}` marker per absent probe.
- Per-plugin `cause?: Error` on `failed` / "manual recovery" variants replaces v1.3's single top-level cause-chain trailer. Cascade with multiple failures now surfaces each plugin's cause chain.
- `rollbackPartial?: readonly { phase: string; cause?: Error }[]` modelled as sub-state of `failed` (no separate "rollback failed" status).
- `scope?` on plugin rows is the orphan-fold case only (present when plugin's scope differs from parent marketplace's scope).
- Spec simplification: every output now renders marketplace header + indented plugin rows. Single-plugin install changes from `● commit-commands [user] (installed)` (one line) to `● claude-plugins-official [user]\n  ● commit-commands (installed)` (two lines). `docs/messaging-style-guide.md` and `docs/output-catalog.md` rewritten to reflect the simplified spec.
- Delete `tests/lint-rules/` (~4096 LoC: 34 custom ESLint rules + 34 RuleTester suites + helpers) and `tests/architecture/msg-rule-registry.test.ts`. Replace with stock `eslint.config.js`: `no-restricted-syntax` (only `shared/notify.ts` may call `ctx.ui.notify`) + `no-console` (with `persistence/migrate.ts` per-file override for IL-3).
- Migrate ~23 call sites across orchestrators/edge from `notifySuccess/Warning/Error/UsageError(ctx, string)` to `notify(ctx, structuredMessage)` / `notifyUsageError(ctx, structuredUsageError)`. Most `presentation/` composers become module-internal helpers of `notify()`'s switch.
- Coverage moves to per-status unit tests on `notify()` switch + the existing catalog UAT runner (now fed by structured `NotificationMessage` fixtures instead of pre-assembled strings).

**Source-of-truth artifact:** `docs/adr/v2-001-structured-notify.md` (commit `492d9c4`). The ADR predates several v1.4 design refinements -- status renames, `PluginStatus`/`MarketplaceStatus` enums, `Dependency` closed set, always-marketplace-header spec change, per-plugin causes, trailer dropped. Phase 1 refreshes the ADR to reflect the locked design.

**Net code delta target:** ~4300 LoC removed (~+400 new wrappers/types/switch vs ~-4700 deleted lint plugin + parity test + presentation composers absorbed inward).

## Requirements

### Validated

<!-- Shipped and confirmed valuable via this GSD project. -->

- ✓ v1.0 successor architecture: `/claude:plugin` command surface, marketplace lifecycle, plugin `install` / `uninstall` / `update`, top-level `list`, skills/commands/agents/MCP bridges, tab completion, real Pi wiring, live/runtime e2e coverage, and cross-process state locking.
- ✓ v1.1 Reinstall Command (Phases 8-9): `reinstall` command routed through `/claude:plugin` with `update`-analogous syntax (`reinstall <plugin>@<marketplace>`, `reinstall @<marketplace>`, bare `reinstall`); `--scope user|project` filtering; cached-manifest / recorded-version reuse with no network sync; atomic per-plugin replacement via `withLockedStateTransaction` (PRL-09/10/11/12); post-success plugin data cleanup; deterministic bulk-cascade partitioning + reload-hint and soft-dep aggregation; installed-only tab completion plus reinstall-specific `--force`.
- ✓ v1.2 Claude Settings Import (Phases 10-11): `/claude:plugin import [--scope user|project]` command; Claude settings discovery and base/override merge per selected scope; enabled-plugin extraction (`enabledPlugins["plugin@marketplace"] === true`); official `claude-plugins-official` built-in mapping plus `extraKnownMarketplaces` directory/GitHub source mapping; idempotent orchestration with unavailable-plugin warning aggregation, source-mismatch protection, and reused marketplace/plugin atomic semantics; both-scope default with explicit-scope override (D-26); D-28 pure desired-state planning boundary.
- ✓ v1.3 Consistent Messaging mechanical-refactor surface (Phases 12-13): closed-set grammar primitives (`STATUS_TOKENS`, `REASONS`, `MARKERS`) under `shared/grammar/` with frontmatter drift contract; Wave 1 composers (`compact-line`, `cascade-summary`, `manual-recovery`, `rollback-partial`, `cause-chain`, `reload-hint`, `sort`) under `presentation/` consumed by every user-visible orchestrator; per-scope rendering + orphan-fold + adoption (CMC-03, CMC-21); per-row soft-dep markers replacing the aggregated trailer (CMC-12, CMC-13); cascade severity routing via `(severity === "warning" ? notifyWarning : notifySuccess)` (CMC-20); per-command catalog conformance enforced by `tests/architecture/catalog-uat.test.ts` byte-equality runner; ES-5 atomic supersession commit (`c4d87d4`) deletes the 5 legacy markers, retires the snapshot byte-equality assertion, rewrites PRD §6.12 ES-5 to a pointer, and rolls back the temporary ESLint marker-restriction additions per D-13-03 / D-13-11 / D-30 (CMC-35); the static-audit at `tests/architecture/no-legacy-markers.test.ts` enforces zero re-introductions across the codebase's lifetime.
- ✓ v1.3 Drift Guard & Test Alignment (Phase 14, CMC-16/CMC-34/CMC-38): 34-rule ESLint drift-guard plugin (16 meta-assertion + 18 full-impl) under `tests/lint-rules/` wired into `eslint.config.js` with per-rule scoping and composer-file ignores; shared YAML frontmatter loader at `tests/lint-rules/lib/frontmatter.js` reads `docs/messaging-style-guide.md` as the sole binding contract for 4 closed sets (`status_tokens` / `reasons` / `markers` / `pattern_classes`); `tests/architecture/grammar-frontmatter.test.ts` extended to 4-key set-equality; `tests/architecture/msg-rule-registry.test.ts` 4-way parity test ties style-guide body + rule files + ESLint wiring + plugin module. CMC-16 production wiring of `renderManualRecovery` into `orchestrators/plugin/reinstall.ts` with dead-code seam removed from `orchestrators/marketplace/remove.ts` (audit BLOCKER closed); CMC-34 mechanical migration of 13 callsites across 6 edge handlers from `notifyError(ctx, msg + USAGE)` to `notifyUsageError(ctx, reason, USAGE)` (audit BLOCKER closed; `\n\n` separator now MSG-NC-2 / MSG-SR-7 conformant). WARNING-level closures: `transaction/rollback.ts` orchestrator-owns-rendering refactor with `composeRollbackPartialChildren` extracted to `presentation/rollback-partial.ts` (D-14-04 / Pitfall 6); `MARKETPLACE_LABEL_PROBE` deduplicated from 3 inline definitions into `shared/constants/marketplace-label-probe.ts`. `npm run check` GREEN at 1245/1245 tests with all 34 drift-guard rules active in lint; the v1.3 user-contract is now structurally enforced -- no future commit can silently drift on tokens, reasons, markers, pattern-classes, or MSG-* grammar.

### Active

<!-- Current scope. Building toward these. Detailed REQ-IDs in REQUIREMENTS.md. -->

*v1.4 active. Detailed REQ-IDs (SNM-XX) in REQUIREMENTS.md. CR-01 / edge-handler scope-iteration tech debt becomes moot under structured payloads (scope is a field on `MarketplaceNotificationMessage` and an orphan-fold-only field on `PluginNotificationMessage` -- the existing iteration-order drift sites have no role in the new model).*

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

- **Current codebase state (post-v1.3, 2026-05-25):** 1249/1249 tests green; lint + format + types clean. v1.3 milestone landed +15,030 / -1,917 LOC across 180 files (~3 days, 223 commits). Drift-guard plugin (`tests/lint-rules/`, 34 rules) and byte-equality catalog UAT (`tests/architecture/catalog-uat.test.ts` against `docs/output-catalog.md`) are now load-bearing -- `npm run check` will fail on any user-contract drift.
- **Existing V1 implementation** lives on branch `features/initial`. The PRD (`docs/prd/pi-claude-marketplace-prd.md`) documents that V1's surface, behavior, and contracts. The successor architecture (this branch lineage) reuses the PRD as the spec; whether a given module was preserved, refactored, or rewritten was a per-phase planning decision.
- **Personas served:** Pi end user (developer), project lead curating per-project marketplaces, plugin author verifying resolution, operator/power user diagnosing drift.
- **Soft-dependency model is load-bearing:** `pi-subagents` (probed via `subagent` tool) and `pi-mcp-adapter` (probed via `mcp` tool name OR `sourceInfo.source` substring match for `pi-mcp-adapter`) MUST never block installs; absent soft deps degrade with per-row `{requires pi-subagents}` / `{requires pi-mcp}` markers on installed/updated/reinstalled rows plus the canonical reload trailer.
- **Marketplace/plugin scope split is explicit:** marketplaces can be configured in user or project scope; plugin operations target a scope for writes. Project-target installs can source from project marketplaces first and user marketplaces second; user-target installs can source only from user marketplaces. The same plugin may be installed in both scopes, with project scope taking precedence for unqualified single-target operations.
- **v1.3 user-contract (D-30 binding):** `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md` are the normative user-contract for every user-visible `ctx.ui.notify` callsite and the single sanctioned `console.warn` (`persistence/migrate.ts:178` §14.1 wording). The five PRD §6.12 ES-5 marker strings are superseded by the §15 replacement table (`{requires pi-subagents}` / `{requires pi-mcp}` / `/reload to pick up changes` / `⊘ <resource> (manual recovery) {<reason>}` / `{rollback partial}` reason + per-phase children). ES-1..ES-4 from PRD §6.12 are unchanged. Structural enforcement: `tests/architecture/no-legacy-markers.test.ts` blocks re-introduction; the 34-rule MSG-* lint plugin reads `docs/messaging-style-guide.md` YAML frontmatter (`status_tokens` / `reasons` / `markers` / `pattern_classes`) as the binding closed sets via `tests/lint-rules/lib/frontmatter.js`.
- **State persistence surfaces (PRD §4):** `<scope>/pi-claude-marketplace/state.json`, `<scope>/pi-claude-marketplace/resources/{skills,prompts}/`, `<scope>/agents/pi-claude-marketplace-*.md`, `<scope>/mcp.json` -- plus `<scope>/pi-claude-marketplace/agents-index.json` for agent provenance. Where `<scope>` is `~/.pi/agent/` (user; honors `PI_CODING_AGENT_DIR`) or `<cwd>/.pi/` (project).
- **Tooling baseline on `main`:** Node ≥22, TypeScript strict, ESLint flat config (v10), Prettier 3.x, `node --test`, `write-file-atomic@^7`. `npm run check` = typecheck + lint + format + tests.
- **Known tech debt for v1.4 scoping:** (1) edge-handler scope iteration outside MSG-GR-3 lint glob (`edge/handlers/plugin/import.ts:45`, `shared/types.ts:20` `SCOPES`, `edge/completions/provider.ts:70`); (2) 6 Phase-12 CMC rows in archived `v1.3-ROADMAP.md` Coverage table reading `Pending` vs. REQUIREMENTS marking `Complete` (cosmetic, archive frozen).

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
| Use the PRD verbatim as the V1 specification                                                                                 | PRD is comprehensive (~100 requirements across 13 horizontal areas + 4 bridges + 3 lifecycle command groups) and was derived from the working V1; re-deriving requirements via questioning would waste tokens without adding signal | ✓ Good     |
| Skip the `/gsd-map-codebase` step                                                                                            | The PRD already documents the V1 architecture (modules, persistence layout, soft-dep probing) in §9 architecture diagrams; phase planning will read source selectively as needed                                                    | ✓ Good     |
| Two scopes only (`user`, `project`); no Claude `local` scope                                                                 | Mirror Pi's scope model rather than Claude Code's; introducing `local` requires a Pi-side equivalent first (SC-1)                                                                                                                   | ✓ Good     |
| Soft-degrade on `pi-subagents`/`pi-mcp-adapter` rather than hard-require                                                     | Plugin installs must not be blocked by an unloaded companion extension; degraded path emits a stable warning + reload hint                                                                                                          | ✓ Good     |
| All user-visible failures through `ctx.ui.notify` with `default / warning / error` severity ladder (ES-2)                    | Single output channel keeps testing tractable and prevents orphan `process.stdout` writes from drifting the user contract                                                                                                           | ✓ Good     |
| Forward-compatible `marketplace.json` parser (no schema-version check; unknown source kinds → `{ kind: "unknown", reason }`) | Targets the de-facto schema in `anthropics/claude-plugins-official` as of V1; a hard schema check would create churn against an evolving upstream (NFR-12)                                                                          | ✓ Good     |
| 12-char SHA-256 truncation for content-hash plugin versions (`hash-<12hex>`)                                                 | Stable contract -- changing it silently invalidates every existing user's hash-versioned install record on next `update`. 12 hex ≈ 48 bits is well above per-user collision threshold (PI-7)                                        | ✓ Good     |
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
| **D-14-2-08 (2026-05-24):** MSG-GR-3 lint rule moves from no-op meta-assertion (D-14-09) to active AST check covering (a) local user-first `scopeOrder` helpers and (b) `["user", "project"]` iteration literals in orchestrator files | Closes audit CR-01: three orchestrator files (`reinstall.ts`, `update.ts`, `import/execute.ts`) carried local user-first helpers contradicting the canonical `compareByNameThenScope` (project-first tie-break) in `presentation/sort.ts`; a corroborating iteration drift existed at `autoupdate.ts:114`. 14.2-01 cleaned the source; 14.2-02 lands the active rule against the now-clean code so future regressions fail `npm run lint`. The structural enforcement claim of D-14-09 is upgraded, not weakened -- D-30 (v1.3 user-contract) remains the binding contract, and the tightened rule now structurally prevents regression in the orchestrators glob. False-positive containment: per-rule `files:` block in `eslint.config.js` scopes detection to `extensions/pi-claude-marketplace/orchestrators/**/*.ts`, leaving the canonical comparator in `presentation/sort.ts` outside the glob. | -- Locked  |

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

*Last updated: 2026-05-25 -- Milestone v1.4 (Structured Notification Messages) started. Seeded from `docs/adr/v2-001-structured-notify.md` (commit `492d9c4`) plus iterative design discussion that refined the ADR: status renames (PluginStatus / MarketplaceStatus closed enums with `status` as discriminator), `Dependency = "agents" | "mcp"` replacing v1.3's two declares-* booleans, per-plugin causes replacing the top-level cause-chain trailer, rollback-partial as sub-state of `failed`, computed severity + computed reload hint, and a v1.3 spec simplification: every output now renders marketplace header + indented plugin rows. Two public methods (`notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)`) replace the v1.3 `notifySuccess/Warning/Error/UsageError` quartet. Targets ~4300 LoC net removal (deletes the 34-rule `tests/lint-rules/` plugin and the 4-way registry parity test; replaces with stock ESLint `no-restricted-syntax` + `no-console` config). Last shipped: v1.3 (2026-05-25, 5 phases, 27 plans, 1249/1249 tests).*

*Earlier updates (pre-v1.3-close): see git history. Phase 1 (2026-05-09), Phase 2 (2026-05-10), Phases 3-7 v1.0 (2026-05-11), Phases 8-9 v1.1 (2026-05-13/14), Phases 10-11 v1.2 (2026-05-20), Phases 12-14.2 v1.3 (2026-05-22 → 2026-05-24).*
