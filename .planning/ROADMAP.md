# Roadmap: pi-claude-marketplace

## Milestones

- Done **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- Done **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- Done **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- Done **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- Done **v1.4 Structured Notification Messages** -- Phases 15-21 (shipped 2026-05-28)
- Done **v1.4.1 Post-ship UAT Patches** -- Phases 22-26 (closed 2026-05-30)
- Done **v1.5 Notification Output Polish** -- Phases 27-29 (shipped 2026-05-31)
- Done **v1.6 GitHub Private Marketplace Authentication** -- Phases 30-36 (shipped 2026-06-01)
- Done **v1.7 Transaction Resilience Hardening** -- Phases 37-41 (shipped 2026-06-02)
- Done **v1.8 Plugin and Marketplace Info Commands** -- Phases 42-44 (shipped 2026-06-04)
- Done **v1.9 Manifest In-Memory Cache** -- Phase 45 (shipped 2026-06-07)
- Done **v1.10 Error Attribution & Message-Type Consistency** -- Phases 46-49 (shipped 2026-06-08)
- Done **v1.11 Notification Summary-Line Grammar** -- Phase 50 (shipped 2026-06-08)
- Done **v1.12 Marketplace and Plugin Config Files** -- Phases 51-56 (shipped 2026-06-11)
- Done **v1.13 Claude Hook Bridge** -- Phases 57-63 (shipped 2026-06-19)
- Active **force-install** -- Phases 64-70 (in progress)

For full details of each milestone, see `.planning/milestones/v[X.Y]-ROADMAP.md` and `.planning/milestones/v[X.Y]-REQUIREMENTS.md`.

## Phases

<details>
<summary>Done v1.0 successor architecture (Phases 1-7) -- SHIPPED 2026-05-11</summary>

PRD-derived V1 surface. See PROJECT.md "Validated" section for details; phase summaries live under `.planning/phases/`.

- [x] Phase 1: Foundations
- [x] Phase 2: Primitives
- [x] Phase 3: Bridges
- [x] Phase 4: Marketplace Orchestrators
- [x] Phase 5: Plugin Orchestrators
- [x] Phase 6: Edge
- [x] Phase 7: Integration & Real Pi Wiring

</details>

<details>
<summary>Done v1.1 Reinstall Command (Phases 8-9) -- SHIPPED 2026-05-14</summary>

`reinstall` command with atomic per-plugin replacement, cached-manifest reuse, no network sync, bulk-cascade partitioning, reload-hint + soft-dep aggregation, installed-only tab completion plus reinstall-specific `--force`.

- [x] Phase 8: Atomic Reinstall Core (4/4 plans) -- completed 2026-05-13
- [x] Phase 9: Reinstall Edge & Bulk UX (4/4 plans) -- completed 2026-05-14

</details>

<details>
<summary>Done v1.2 Claude Settings Import (Phases 10-11) -- SHIPPED 2026-05-20</summary>

`/claude:plugin import [--scope user|project]` with Claude settings discovery, base/override merge, enabled-plugin extraction, official + extraKnownMarketplaces source mapping, idempotent orchestration, unavailable-plugin warning aggregation, source-mismatch protection.

- [x] Phase 10: Claude Settings Import Foundation -- completed 2026-05-19
- [x] Phase 11: Import Command Orchestration -- completed 2026-05-20

</details>

<details>
<summary>Done v1.3 Consistent Messaging (Phases 12-14.2) -- SHIPPED 2026-05-25</summary>

Closed-set grammar primitives, Wave 1 presentation composers, ES-5 atomic supersession, per-command catalog conformance via byte-equality UAT runner, 34-rule ESLint drift-guard plugin. v1.3 user-contract is structurally enforced. 38/38 CMC requirements satisfied. See `.planning/milestones/v1.3-ROADMAP.md` for full details.

- [x] Phase 12: Messaging Foundations & Renderer Primitives (4/4 plans) -- completed 2026-05-22
- [x] Phase 13: Conformance Refactor & ES-5 Supersession (10/10 plans) -- completed 2026-05-24
- [x] Phase 14: Drift Guard & Test Alignment (6/6 plans) -- completed 2026-05-24
- [x] Phase 14.1: Close gap: CMC-13 propagate declaresAgents/Mcp through import (2/2 plans) -- completed 2026-05-24
- [x] Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (5/5 plans) -- completed 2026-05-24

</details>

<details>
<summary>Done v1.4 Structured Notification Messages (Phases 15-21) -- SHIPPED 2026-05-28</summary>

Replaced v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simplified the user-output spec to always render a marketplace header with indented plugin rows. Final state: 1120/1120 tests GREEN, ~4300 LoC net removal, V1 severity wrappers + `tests/lint-rules/` + `presentation/` + `shared/grammar/` all retired. See `.planning/milestones/v1.4-ROADMAP.md` for full details (when archived).

- [x] Phase 15: Type Model & ADR Refresh (3/3 plans) -- completed 2026-05-25
- [x] Phase 16: Renderer & Public API (Alongside V1) (6/6 plans) -- completed 2026-05-26
- [x] Phase 17: Spec Rewrite & Catalog UAT Migration (3/3 plans) -- completed 2026-05-26
- [x] Phase 17.1: V2 Grammar Amendment: Autoupdate Surface (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 17.2: renderScopeBracket orphan-fold contract fix (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family (7/7 plans) -- completed 2026-05-27
- [x] Phase 19: Migration Wave 2 -- Plugin Orchestrator Family (6/6 plans) -- completed 2026-05-27
- [x] Phase 20: Migration Wave 3 -- Edge Handlers & UsageError (6/6 plans) -- completed 2026-05-27
- [x] Phase 21: Final Teardown & GREEN Gate (4/4 plans) -- completed 2026-05-28

</details>

<details>
<summary>Done v1.4.1 Post-ship UAT Patches (Phases 22-26) -- CLOSED 2026-05-30</summary>

Closed the 8 gaps surfaced by the v1.4 milestone-spanning UAT: reload-hint suppression on read-only/no-op marketplace ops (G-MIL-01/02/06), plugin.json version tier-2 fallback (G-MIL-05), hash-version `v#<7hex>` display (G-MIL-08), `{lsp}` grammar token rename (G-MIL-04), runtime reproduction of indent ladder (G-MIL-03 refuted) and tab-completion gap (G-MIL-07 deferred-with-finding). 1137/1137 tests GREEN at close.

- [x] Phase 22: Reload-hint Discipline Family (1/1 plans) -- completed 2026-05-29
- [x] Phase 23: Version Display Bundle (2/2 plans) -- completed 2026-05-29
- [x] Phase 24: Grammar Consistency (1/1 plans) -- completed 2026-05-29
- [x] Phase 25: Runtime Publish & Verification (3/3 plans) -- completed 2026-05-29
- [x] Phase 26: GREEN Gate Close (1/1 plans) -- completed 2026-05-30

</details>

<details>
<summary>Done v1.5 Notification Output Polish (Phases 27-29) -- SHIPPED 2026-05-31</summary>

8 UXG output-grammar and severity-presentation refinements from the 2026-05-30 hands-on UAT sweep. Benign no-ops suppressed from `Warning:` (UXG-02), autoupdate marker grammar corrected (UXG-04), update no-op renders `(skipped)` (UXG-05), `<last-updated>` timestamp dropped (UXG-01), summary line prepended to error/warning cascades (UXG-07), update of manifest-absent plugin classifies as `(failed)` (UXG-08). 1168/1168 tests GREEN. Full details: `.planning/milestones/v1.5-ROADMAP.md`.

- [x] Phase 27: Marketplace & Autoupdate Output Grammar (5/5 plans) -- completed 2026-05-31
- [x] Phase 28: Severity Routing & Label Discipline (2/2 plans) -- completed 2026-05-31
- [x] Phase 29: Notification Label Suppression & Update Classification (3/3 plans) -- completed 2026-05-31

</details>

<details>
<summary>Done v1.6 GitHub Private Marketplace Authentication (Phases 30-36) -- SHIPPED 2026-06-01</summary>

On-demand Device Flow auth for private GitHub marketplace sources. Tries `git credential fill` first (silent reuse); triggers Device Flow only on a cache miss or 401; stores the resulting token via `git credential approve`; evicts via `git credential reject` on `onAuthFailure`. No env vars required. Two new modules (`platform/git-credential.ts`, `domain/github-auth.ts`) plus targeted wiring changes. 10/10 AUTH requirements.

- [x] Phase 30: Duplicate Type Fix (AUTH-10) (completed 2026-06-01)
- [x] Phase 31: Credential Subprocess Layer (AUTH-06, AUTH-08, AUTH-09) (completed 2026-06-01)
- [x] Phase 32: Device Flow State Machine (AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07) (completed 2026-06-01)
- [x] Phase 33: git.ts Auth Wiring (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 34: GitOps Interface Threading (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 35: Orchestrator Call Sites & Output Catalog (AUTH-01, AUTH-02, AUTH-03)
- [x] Phase 36: Integration Gate (all AUTH) (completed 2026-06-01)

</details>

<details>
<summary>Done v1.7 Transaction Resilience Hardening (Phases 37-41) -- SHIPPED 2026-06-02</summary>

Eight correctness fixes to the existing saga/two-phase-commit infrastructure: phase-ledger
undo gap, parallel-rename orphan leaks in agents and commands bridges, ghost state records
on partial cascade unstage, update.ts state-before-commit divergence, reinstall blocking
on orphan targets, and inline documentation for two already-safe patterns. No new
dependencies; no user-visible behavior changes on the happy path.

- [x] Phase 37: Phase-Ledger Undo Gap (TR-02)
- [x] Phase 38: Sequential Commit Loops + Orphan Tolerance (TR-01, TR-05, TR-06)
- [x] Phase 39: Cascade Ghost Record (TR-03)
- [x] Phase 40: Update State-Before-Commit Reorder (TR-04)
- [x] Phase 41: Documentation and Test Closeout (TR-07, TR-08)

</details>

<details>
<summary>Done v1.8 Plugin and Marketplace Info Commands (Phases 42-44) -- SHIPPED 2026-06-04</summary>

Two new read-only detail-surface commands (`/claude:plugin marketplace info <name>` and `/claude:plugin info <plugin>@<marketplace>`) picking up the PRD-deferred `info` subcommand. Both work on uninstalled, installed, and unavailable targets, support `--scope user|project` filtering, render per-scope when no scope is given, read existing local data only (preserves NFR-5), and lock byte-form via the catalog UAT. 1459/1459 tests GREEN at close; 8/8 INFO requirements satisfied; full audit at `.planning/milestones/v1.8-MILESTONE-AUDIT.md`.

- [x] Phase 42: Type Model & Render Seam Foundations (1/1 plans) -- completed 2026-06-03
- [x] Phase 43: Marketplace Info Command (2/2 plans) -- completed 2026-06-04
- [x] Phase 44: Plugin Info Command (2/2 plans) -- completed 2026-06-04

</details>

## Phase Details

<details>
<summary>Done v1.12 Marketplace and Plugin Config Files (Phases 51-56) -- SHIPPED 2026-06-11</summary>

Declarative per-scope config files (`claude-plugins.json` + entry-level-override `claude-plugins.local.json`) became the authoritative desired-state record: typebox-validated schema with discriminated absent/invalid/valid loading (an invalid file can never read as "uninstall everything"), lossless first-run migration from state.json, a pure 7-bucket reconcile planner behind a read-only `/claude:plugin preview` command (six `will *` tokens), offline enable/disable with a distinct `(disabled)` token, automatic load-time reconciliation on every startup/`/reload` (per-entry network soft-fail, one structured cascade, fixed-point convergence, two-process safe), and config write-back on every mutating command with `--local` targeting. See `.planning/milestones/v1.12-ROADMAP.md` for full details.

- [x] Phase 51: Config Schema, Persistence & State Split (3/3 plans) -- CFG-01..03, SPLIT-01..02 -- completed 2026-06-10
- [x] Phase 52: First-Run Migration (1/1 plans) -- MIG-01..02 -- completed 2026-06-10
- [x] Phase 53: Pure Reconcile Planner & Dry-Run Preview (2/2 plans) -- DIFF-01..02 -- completed 2026-06-10
- [x] Phase 54: Enable/Disable Commands (2/2 plans) -- ENBL-01..04 -- completed 2026-06-10
- [x] Phase 55: Load-Time Reconcile Apply, Notification & Wiring (3/3 plans) -- RECON-01..06 -- completed 2026-06-11
- [x] Phase 56: Write-Back Integration & Documentation (4/4 plans) -- WB-01..04, CFG-04 -- completed 2026-06-11

</details>

<details>
<summary>Done v1.13 Claude Hook Bridge (Phases 57-63) -- SHIPPED 2026-06-19</summary>

Hooks component bridge alongside skills/commands/agents/MCP, translating Claude plugin hook declarations into Pi extension event subscriptions and shell-outs. Ships the **8 bucket-A direct-1:1-map events only** (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd) — the subset where dispatch fires at 100% fidelity. Strict-supportability stance at BOTH event and plugin levels: plugins referencing other events, unmapped Claude tools, regex matchers, or non-`command` handlers install as `(unavailable) {unsupported hooks}`. Forward-compat investments shipped despite no first-party plugin exercising them under bucket-A-only scope: the `if` field permission-rule matcher (~300 LoC, MATCH-03) and the `asyncRewake` registry (~250 LoC, HOOK-06 + EXEC-05). Released as `pi-claude-marketplace@0.6.0`. 31/31 requirements complete. See `.planning/milestones/v1.13-ROADMAP.md` for full details.

- [x] Phase 57: Schema, Component Type & Payload-Extension Tolerance -- HOOK-01, HOOK-02, HOOK-03 (completed 2026-06-14)
- [x] Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate -- MATCH-01, MATCH-02, TOOL-01, TOOL-02, HOOK-04 (pulled forward per D-58-01) (completed 2026-06-14)
- [x] Phase 59: Bridge Dispatch Core & Debug Seam -- DISP-01..04, OBS-01 (completed 2026-06-14)
- [x] Phase 60: Hook Execution, Payload Translators & Env Vars -- EXEC-01..04, PAYL-01, HOOK-05 (completed 2026-06-15)
- [x] Phase 61: `if` Field Permission-Rule Matcher -- MATCH-03 (completed 2026-06-15)
- [x] Phase 62: `asyncRewake` Registry & Background-Spawn -- HOOK-06, EXEC-05 (completed 2026-06-16)
- [x] Phase 63: Lifecycle Cascade, User-Facing Surface & Docs -- LIFE-01..03, SURF-01..06 (11/11 plans) (completed 2026-06-17)

</details>

### Active force-install (Phases 64-70)

**Milestone Goal:** Let a Pi user `install`/`update --force` a *partially*-supported plugin -- install the supported components, degrade the unsupported ones, never block -- built on a **derived** force-state (no persisted flag) and the **desired-state** severity model, with consistent status, list, completion, and load-time-backfill behaviour. Clean-room rebuild; the earlier sticky-flag attempt is superseded. The byte-level output contract is governed by `docs/output-catalog.md`, `docs/messaging-style-guide.md`, and PRD §11.

- [x] **Phase 64: Resolver Three-Way State** - Replace binary `installable: true|false` with `installable`/`unsupported`/`unavailable`; two narrowing gates; per-kind unsupported reasons (completed 2026-06-27)
- [x] **Phase 65: Force Install & Update** - `install --force`/`update --force` degrade-not-block on `unsupported`; hard failures still block (completed 2026-06-27)
- [x] **Phase 65.1: Reload-Deferred Will Grammar Consistency** (INSERTED) - `will` prefix marks only reload-deferred actions; audit + fix marketplace add/remove (completed 2026-06-27)
- [ ] **Phase 66: Derived Force-State, Glyphs & Force-Upgradability** - Derived `force-installed` (◉) / `force-upgradable` (●), will-force preview tokens, info detail
- [ ] **Phase 67: List Filters, Completion & Reinstall Repair** - `--unsupported` filter, force completion sets, reinstall drops `--force` and always overwrites
- [ ] **Phase 68: Load-Time Backfill** - Re-materialize force-installed plugins whose components became supported, gated on `lastReconciledExtensionVersion`
- [ ] **Phase 69: Force-Path Severity** - Wire SEV-01..05 onto the desired-state notification model; unsupported-vs-unavailable error split
- [ ] **Phase 70: Spec & Documentation Reconcile** - PRD §11, output-catalog, messaging-style-guide reconciled to the final token set

#### Phase 64: Resolver Three-Way State

**Goal**: The resolver distinguishes "force can degrade the unsupported parts" from "force cannot help" via a three-way discriminated state, type-enforcing that force degrades components but never hard failures (NFR-7 refined, not weakened).
**Depends on**: Nothing (first phase of milestone; refactors the existing v1.13 `domain/resolver.ts`)
**Requirements**: RSTATE-01, RSTATE-02, RSTATE-03, RSTATE-04, RSTATE-05
**Success Criteria** (what must be TRUE):

  1. The resolver returns one of three discriminated states -- `installable` / `unsupported` / `unavailable` -- replacing the binary `installable: true | false`.
  2. A plugin with a structural defect (unreadable/invalid manifest, malformed `hooks.json`, NFR-10 path violation) resolves `unavailable` even when it also has unsupported component kinds (structural precedence).
  3. `unsupported` exposes `pluginRoot` plus the supported and unsupported component lists; `unavailable` exposes `pluginRoot` to no consumer (compile-enforced).
  4. `requireInstallable` narrows to `installable` only (default path) and `requireForceInstallable` narrows to `installable | unsupported` (`--force` path).
  5. Per-kind unsupported-component reasons render identically across `list` and `info` (including soft-dep markers) and across all force states.**Plans**: 2 plans

**Wave 1**

- [x] 64-01-PLAN.md — Three-way resolver union, factory split, structural-precedence decision, requireInstallable + requireForceInstallable gates, consumer + test migration (RSTATE-01..04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 64-02-PLAN.md — Shared render-time per-kind unsupported-marker helper; list/info/install parity (RSTATE-05)

#### Phase 65: Force Install & Update

**Goal**: `install --force` / `update --force` degrades unsupported components instead of blocking, while hard failures still block regardless of `--force`, and no force path emits a `Warning:` summary.
**Depends on**: Phase 64 (the `requireForceInstallable` gate and the `unsupported` arm carrying `pluginRoot`)
**Requirements**: FORCE-01, FORCE-02, FORCE-03, FORCE-04, FORCE-05
**Success Criteria** (what must be TRUE):

  1. `install --force <plugin>@<marketplace>` on an `unsupported` plugin installs the supported components and skips the unsupported ones.
  2. `--force` on a fully-supported plugin is a no-op -- it installs normally as `(installed)`.
  3. `update --force <plugin>` on a plugin whose newer version became `unsupported` updates it by degrading the now-unsupported components instead of failing.
  4. Without `--force`, install/update of an `unsupported` plugin still blocks/fails -- `--force` is the only per-invocation opt-in to degradation.
  5. `--force` never bypasses hard failures (`unavailable`/structural defects, NFR-10 path containment, missing marketplace, unresolvable source) and no `Warning:` summary is emitted in any force path.

**Plans**: 3 plans

**Wave 1**

- [x] 65-01-PLAN.md — Foundation: `MaterializablePlugin` union alias (NFR-7-safe), shared bridge/adapter type widening, `--force` recognition in the shared edge parser (FORCE-01/02/05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 65-02-PLAN.md — Install force path: gate-select `requireForceInstallable` under `--force`, degrade unsupported via the reused materialize path, no-`Warning:` guarantee (FORCE-01/03/04/05)
- [x] 65-03-PLAN.md — Update force path: force-gate the no-network candidate resolve, degrade now-unsupported candidate components, block without force (FORCE-02/03/04/05)

#### Phase 65.1: Reload-Deferred Will Grammar Consistency (INSERTED)

**Goal**: The `will` prefix in the pending/preview surface marks exactly those reconciliation actions whose effect is deferred to the next `/reload`; actions that take effect immediately render without `will`. This reconciles the pending-tense grammar with the per-command reload-hint discipline before the force-display phases build on it.
**Depends on**: Phase 65 (lands before Phase 66 so force-preview tokens build on the corrected grammar)
**Requirements**: WILL-01, WILL-02, WILL-03, WILL-04
**Success Criteria** (what must be TRUE):

  1. Every `will`-prefixed token in the pending/preview surface corresponds to an action whose effect is deferred to `/reload`; no immediately-effective action renders a bare `will` token.
  2. The pending grammar is consistent with the per-command reload-hint discipline -- a token carries `will` exactly when its command path emits the `/reload to pick up changes` trailer.
  3. Marketplace add (immediate) no longer renders `will add`; marketplace remove renders a `will` token only for its reload-deferred plugin-uninstall cascade, not for the immediate source de-registration.
  4. Plugin install / uninstall / enable / disable remain reload-deferred and retain their `will install` / `will uninstall` / `will enable` / `will disable` tokens.
  5. `docs/output-catalog.md`, `docs/messaging-style-guide.md`, the status-token closed set, and the byte-exact catalog/notify tests reflect the reconciled grammar; `npm run check` stays green.

**Plans**: 2 plans

**Wave 1**

- [x] 65.1-01-PLAN.md — WILL-02 reload-hint agreement test (new isolated file) + additive marketplace-remove-with-installed-plugins catalog-uat byte state; both green on the current tree (WILL-02, WILL-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 65.1-02-PLAN.md — Atomic lockstep retirement of `will add` / `will remove`: closed-set tuples (22->20, 9->7), union arms, renderMpHeader, pending projection (add dropped, remove -> per-plugin will-uninstall cascade), PlannedMarketplaceRemove.plugins seam, all coupled tests, and docs/output-catalog + messaging-style-guide; single `npm run check`-green commit (WILL-01, WILL-02, WILL-03, WILL-04)

#### Phase 66: Derived Force-State, Glyphs & Force-Upgradability

**Goal**: Force-installed and force-upgradable states are derived from the resolver state (no persisted flag, no migration) and drive distinct status tokens, glyphs, will-force preview tokens, and `info` detail.
**Depends on**: Phase 64 (three-way state), Phase 65 (force install/update path)
**Requirements**: FSTAT-01, FSTAT-02, FSTAT-03, FSTAT-04, FSTAT-05, FSTAT-06, FSTAT-07
**Success Criteria** (what must be TRUE):

  1. A plugin recorded as installed but currently re-resolving to `unsupported` renders `force-installed` with the `◉` glyph on cascade and list surfaces -- derived, with no persisted `forceInstalled` flag and no state migration.
  2. A force-installed plugin whose newer version is fully supported returns to `(installed)` automatically after upgrade -- no lingering force state.
  3. `list` shows `force-upgradable` (wearing the `●` glyph) for a currently-clean installed plugin whose newer cache-resolved candidate would **newly** degrade it; a force-installed plugin is never force-upgradable.
  4. The pending/preview surface renders `will force install` / `will force update` in place of `will install` / `will update` when a force operation is planned.
  5. `/claude:plugin info` reports `force-installed` and surfaces the dropped-component detail; the success notification for a force install/update reads "force-installed".

**Plans**: 4 plans

**Wave 1**

- [ ] 66-01-PLAN.md — Notify status vocabulary foundation: `force-installed`/`force-upgradable` union arms + `◉` glyph + render switch + `will install` force modifier + info-row status/glyph + tools projection; closed-set tripwire bump (20->22 / 15->17) + grammar-invariant widen + stamp-coverage + catalog rows/fixtures in one lockstep commit (FSTAT-02/04/06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 66-02-PLAN.md — list deriver: no-network `resolveStrict` + four-way force-installed/force-upgradable/upgradable/installed predicate (FSTAT-01/03/04/05)
- [ ] 66-03-PLAN.md — info `force-installed` + dropped-component detail; install/update force-installed success rows (FSTAT-02/03/07)
- [ ] 66-04-PLAN.md — reconcile pending `will force install` via force modifier + no-network candidate resolve (FSTAT-06)

#### Phase 67: List Filters, Completion & Reinstall Repair

**Goal**: List and completion surfaces expose the new force states, and `reinstall` becomes an unconditional repair primitive.
**Depends on**: Phase 66 (the derived `force-installed` / `force-upgradable` states the filters and completion sets read)
**Requirements**: LIST-01, LIST-02, RINST-01
**Success Criteria** (what must be TRUE):

  1. `list --unsupported` filters to unsupported plugins; `--installed` spans both `installed` and `force-installed`; no `--upgradable` filter is added.
  2. With `--force` preceding the plugin positional, `install` completion offers `available` + `unsupported` plugins and `update` completion offers `upgradable` + `force-upgradable` plugins (`unavailable` excluded); without `--force` completion is unchanged.
  3. `reinstall` no longer accepts `--force` and always overwrites everything (collisions and foreign content) as a repair primitive.

**Plans**: TBD

#### Phase 68: Load-Time Backfill

**Goal**: A force-installed plugin's previously-skipped components are re-materialized at load time once the extension supports them, gated on an extension-version stamp so the scan fires only when the supported-kind boundary could have moved.
**Depends on**: Phase 64 (three-way state), Phase 67 (the always-overwrite reinstall materialize path)
**Requirements**: BFILL-01, BFILL-02
**Success Criteria** (what must be TRUE):

  1. On load, a force-installed plugin whose previously-unsupported components are now supported is re-materialized in place (reinstall semantics), promoting it toward `(installed)` -- no upgrade, no manual command.
  2. The backfill scan fires only when `lastReconciledExtensionVersion` in `state.json` differs from the running extension version; an unchanged version skips the scan.
  3. The new `lastReconciledExtensionVersion` stamp is written to and read from `state.json` across loads via a non-destructive schema migration.

**Plans**: TBD

#### Phase 69: Force-Path Severity

**Goal**: Force-path notifications carry the correct desired-state severities, wired onto the caller-stamped notification model delivered by the notification-refactor workstream.
**Depends on**: Phase 66 (the force rows whose severity is being stamped)
**Requirements**: SEV-01, SEV-02, SEV-03, SEV-04, SEV-05
**Success Criteria** (what must be TRUE):

  1. A direct `install --force` / `update --force` degrade renders at **info** (no `Warning:`); a `reinstall` manual-recovery and a missing soft-dependency companion on an otherwise-successful install render at **warning**.
  2. Installing an `unsupported` plugin without `--force` renders at **error** with a message pointing at `--force`; installing an `unavailable` (structural) plugin renders at **error** with **no** `--force` suggestion.
  3. Auto-update of a force-upgradable plugin is taken automatically and renders at **warning** only when it **newly** degrades a previously-clean plugin, at **info** when the plugin was already degraded.
  4. A targeted `update <plugin>@<marketplace>` that declines a force-upgradable upgrade renders at **warning**; an untargeted/bulk `update` that skips a force-upgradable plugin renders at **info**.
  5. Any row carries a factual `{reasons}` brace whenever reasons are present, including `installed`, `force-installed`, and `force-upgradable` rows.

**Plans**: TBD

#### Phase 70: Spec & Documentation Reconcile

**Goal**: The byte-level output-contract docs and the PRD reflect the final reconciled token set, derived-state severity, and force-upgradable rules, with the dropped scope items removed.
**Depends on**: Phase 69 (the final token set + severity model frozen)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

  1. PRD §11 documents `--force` install/update, the three-way resolver state, the new status tokens, and the force-upgradable rules, and removes the dropped items (global force default, manual `complete` command).
  2. `docs/output-catalog.md` and `docs/messaging-style-guide.md` reflect the reconciled token set (`force-installed`, `unsupported`, `force-upgradable`), the derived-state severity, and the exact byte forms -- catalog-UAT GREEN.
  3. No stale comment claims idempotent autoupdate is "warning"; such cases are documented as info/benign.

**Plans**: TBD

## Progress

| Phase                                                                | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-7. (v1.0 successor architecture)                                   | v1.0      | --             | Complete    | 2026-05-11 |
| 8. Atomic Reinstall Core                                             | v1.1      | 4/4            | Complete    | 2026-05-13 |
| 9. Reinstall Edge & Bulk UX                                          | v1.1      | 4/4            | Complete    | 2026-05-14 |
| 10. Claude Settings Import Foundation                                | v1.2      | --             | Complete    | 2026-05-19 |
| 11. Import Command Orchestration                                     | v1.2      | --             | Complete    | 2026-05-20 |
| 12. Messaging Foundations & Renderer                                 | v1.3      | 4/4            | Complete    | 2026-05-22 |
| 13. Conformance Refactor & ES-5                                      | v1.3      | 10/10          | Complete    | 2026-05-24 |
| 14. Drift Guard & Test Alignment                                     | v1.3      | 6/6            | Complete    | 2026-05-24 |
| 14.1. CMC-13 import propagation closure                              | v1.3      | 2/2            | Complete    | 2026-05-24 |
| 14.2. CR-01 + retroactive Phase 12/14.1 gates                        | v1.3      | 5/5            | Complete    | 2026-05-24 |
| 15. Type Model & ADR Refresh                                         | v1.4      | 3/3            | Complete    | 2026-05-25 |
| 16. Renderer & Public API (Alongside V1)                             | v1.4      | 6/6            | Complete    | 2026-05-26 |
| 17. Spec Rewrite & Catalog UAT Migration                             | v1.4      | 3/3            | Complete    | 2026-05-26 |
| 17.1. V2 Grammar Amendment: Autoupdate Surface (INSERTED)            | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 17.2. renderScopeBracket orphan-fold contract fix (INSERTED)         | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 18. Migration Wave 1 -- Marketplace Orchestrator Family              | v1.4      | 7/7            | Complete    | 2026-05-27 |
| 19. Migration Wave 2 -- Plugin Orchestrator Family                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 20. Migration Wave 3 -- Edge Handlers & UsageError                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 21. Final Teardown & GREEN Gate                                      | v1.4      | 4/4            | Complete    | 2026-05-28 |
| 22. Reload-hint Discipline Family                                    | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 23. Version Display Bundle                                           | v1.4.1    | 2/2 | Complete    | 2026-05-29 |
| 24. Grammar Consistency                                              | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 25. Runtime Publish & Verification                                   | v1.4.1    | 3/3 | Complete    | 2026-05-29 |
| 26. GREEN Gate Close                                                 | v1.4.1    | 1/1 | Complete    | 2026-05-30 |
| 27. Marketplace & Autoupdate Output Grammar                          | v1.5      | 5/5 | Complete    | 2026-05-31 |
| 28. Severity Routing & Label Discipline                              | v1.5      | 2/2 | Complete    | 2026-05-31 |
| 29. Notification Label Suppression & Update Classification          | v1.5      | 3/3 | Complete    | 2026-05-31 |
| 30. Duplicate Type Fix                                               | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 31. Credential Subprocess Layer                                      | v1.6      | 2/2 | Complete   | 2026-06-01 |
| 32. Device Flow State Machine                                        | v1.6      | 1/2 | Complete    | 2026-06-01 |
| 33. git.ts Auth Wiring                                               | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 34. GitOps Interface Threading                                       | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 35. Orchestrator Call Sites & Output Catalog                         | v1.6      | 4/4 | Complete    | 2026-06-01 |
| 36. Integration Gate                                                 | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 37. Phase-Ledger Undo Gap                                            | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 38. Sequential Commit Loops + Orphan Tolerance                       | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 39. Cascade Ghost Record                                             | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 40. Update State-Before-Commit Reorder                               | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 41. Documentation and Test Closeout                                  | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 42. Type Model & Render Seam Foundations                             | v1.8      | 1/1 | Complete    | 2026-06-03 |
| 43. Marketplace Info Command                                         | v1.8      | 2/2 | Complete    | 2026-06-04 |
| 44. Plugin Info Command                                              | v1.8      | 2/2 | Complete    | 2026-06-04 |
| 45. Manifest In-Memory Cache                                        | v1.9      | 2/2 | Complete    | 2026-06-07 |
| 46. Type-Model Foundations                                          | v1.10     | 1/1 | Complete    | 2026-06-07 |
| 47. Plugin-Ops Attribution & Cross-Scope                            | v1.10     | 3/3 | Complete    | 2026-06-07 |
| 48. Marketplace-Ops Attribution                                     | v1.10     | 3/3 | Complete    | 2026-06-08 |
| 49. Cross-Op Convergence & GREEN-Gate Close                         | v1.10     | 3/3 | Complete    | 2026-06-08 |
| 50. Notification Summary-Line Grammar                               | v1.11     | 1/1 | Complete    | 2026-06-08 |
| 51. Config Schema, Persistence & State Split                        | v1.12     | 3/3 | Complete    | 2026-06-10 |
| 52. First-Run Migration                                             | v1.12     | 1/1 | Complete    | 2026-06-10 |
| 53. Pure Reconcile Planner & Dry-Run Preview                        | v1.12     | 2/2 | Complete    | 2026-06-10 |
| 54. Enable/Disable Commands                                         | v1.12     | 2/2 | Complete    | 2026-06-10 |
| 55. Load-Time Reconcile Apply, Notification & Wiring                | v1.12     | 3/3 | Complete    | 2026-06-11 |
| 56. Write-Back Integration & Documentation                          | v1.12     | 4/4 | Complete    | 2026-06-11 |
| 57. Schema, Component Type & Payload-Extension Tolerance            | v1.13     | 4/4 | Complete    | 2026-06-14 |
| 58. Matcher Parser, Tool-Name Mapping & Supportability Gate         | v1.13     | 4/4 | Complete    | 2026-06-14 |
| 59. Bridge Dispatch Core & Debug Seam                               | v1.13     | 3/3 | Complete    | 2026-06-14 |
| 60. Hook Execution, Payload Translators & Env Vars                  | v1.13     | 4/4 | Complete    | 2026-06-15 |
| 61. `if` Field Permission-Rule Matcher                              | v1.13     | 3/3 | Complete    | 2026-06-15 |
| 62. `asyncRewake` Registry & Background-Spawn                       | v1.13     | 3/3 | Complete    | 2026-06-16 |
| 63. Lifecycle Cascade, User-Facing Surface & Docs                   | v1.13     | 11/11 | Complete    | 2026-06-16 |
| 64. Resolver Three-Way State                                        | force-install | 2/2 | Complete    | 2026-06-27 |
| 65. Force Install & Update                                          | force-install | 3/3 | Complete    | 2026-06-27 |
| 66. Derived Force-State, Glyphs & Force-Upgradability               | force-install | 0/TBD | Not started | -          |
| 67. List Filters, Completion & Reinstall Repair                     | force-install | 0/TBD | Not started | -          |
| 68. Load-Time Backfill                                              | force-install | 0/TBD | Not started | -          |
| 69. Force-Path Severity                                             | force-install | 0/TBD | Not started | -          |
| 70. Spec & Documentation Reconcile                                  | force-install | 0/TBD | Not started | -          |
