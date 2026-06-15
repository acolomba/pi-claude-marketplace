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
- In progress **v1.13 Claude Hook Bridge** -- Phases 57-63 (planning)

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

### In progress v1.13 Claude Hook Bridge

Add a hooks component bridge alongside skills/commands/agents/MCP, translating Claude plugin hook declarations into Pi extension event subscriptions and shell-outs. Ships the **8 bucket-A direct-1:1-map events only** (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd) — the subset where dispatch fires at 100% fidelity. Strict-supportability stance at BOTH event and plugin levels: a plugin referencing any other Claude hook event, an unmapped Claude tool, a regex matcher, or a non-`command` handler installs as `(unavailable) {unsupported hooks}`. Forward-compat investments retained: the `if` field permission-rule matcher (~300 LoC) and the `asyncRewake` registry (~250 LoC) ship in v1.13 despite no first-party plugin exercising them under bucket-A-only scope. See `.planning/REQUIREMENTS.md` for the 31-REQ contract; `docs/research/claude-hooks-vs-pi-events.md` + `docs/research/claude-hook-config-syntax.md` are the authority sources.

- [x] Phase 57: Schema, Component Type & Payload-Extension Tolerance -- HOOK-01, HOOK-02, HOOK-03 (completed 2026-06-14)
- [x] Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate -- MATCH-01, MATCH-02, TOOL-01, TOOL-02, HOOK-04 (pulled forward per D-58-01) (completed 2026-06-14)
- [x] Phase 59: Bridge Dispatch Core & Debug Seam -- DISP-01..04, OBS-01 (completed 2026-06-14)
- [x] Phase 60: Hook Execution, Payload Translators & Env Vars -- EXEC-01..04, PAYL-01, HOOK-05 (completed 2026-06-15)
- [x] Phase 61: `if` Field Permission-Rule Matcher -- MATCH-03 (completed 2026-06-15)
- [ ] Phase 62: `asyncRewake` Registry & Background-Spawn -- HOOK-06, EXEC-05
- [ ] Phase 63: Lifecycle Cascade, User-Facing Surface & Docs -- LIFE-01..03, SURF-01..06

#### Phase 57: Schema, Component Type & Payload-Extension Tolerance

**Goal**: A new `hooks` component type is observable in the resolver and state schema with v1.12 state files migrating cleanly.

**Depends on**: Nothing (foundation; first new phase after v1.12)

**Requirements**: HOOK-01, HOOK-02, HOOK-03

**Success Criteria** (what must be TRUE):

1. A plugin manifest declaring `hooks` resolves through the discriminated `installable: true | false` resolver alongside `skills`/`commands`/`agents`/`mcpServers` (HOOK-01; NFR-7 preserved).
2. A v1.12 `state.json` loads cleanly under v1.13 code without losing any field; `schemaVersion` STAYS at `Literal(1)` (D-57-01 amends HOOK-02 — no bump) and the additive `resources.hooks: []` default-fill runs inside `ensurePluginResources` before `STATE_VALIDATOR.Check`, with the mutation flag riding the existing `persistMigratedState` fire-and-forget atomic-write seam (HOOK-02; NFR-1).
3. The hook-config TypeBox schema uses `additionalProperties: true` at every nesting level and a round-trip through state preserves unknown payload fields verbatim (HOOK-03).
4. The known additive extension set `{ statusMessage, once, async, shell, args }` is honored or silently dropped per the field-level decisions; unknown extension names surface debug-log only and never flip installability (HOOK-03 forward-compat tolerance).

**Plans**: 4 plans
**Wave 1**

- [x] 57-01-PLAN.md — State schema extension + `ensurePluginResources` default-fill (HOOK-02 / D-57-01)
- [x] 57-02-PLAN.md — `HOOKS_CONFIG_SCHEMA` + `parseHooksConfig` + debug-log seam (HOOK-03 / D-57-02 / D-57-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 57-03-PLAN.md — Resolver admission move + `locations.hooksDir` (HOOK-01 / D-57-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 57-04-PLAN.md — Architecture invariant tests pinning the four leaf-foundation contracts (HOOK-01 / HOOK-02 / HOOK-03 / D-57-01)

#### Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate

**Goal**: A plugin's `hooks.json` is parsed into a normalized internal model, with regex / unmapped-tool / non-bucket-A / non-`command` plugins flipped to `(unavailable) {unsupported hooks}` at resolve time.

**Depends on**: Phase 57 (component type + schema must exist before the parser can target it)

**Requirements**: MATCH-01, MATCH-02, TOOL-01, TOOL-02, HOOK-04 (pulled forward per D-58-01)

**Success Criteria** (what must be TRUE):

1. A user can write Claude-form literal matchers (`Edit`, `Bash`, `Read`), pipe-OR alternation (`Edit|Write`), empty `""` (match-all), and `mcp__server__tool` patterns and the bridge matches them against normalized incoming events (MATCH-01). Pi-form lowercase matchers never match.
2. A `hooks.json` containing any regex pattern (any char outside `[A-Za-z0-9_|\-]` not part of an `mcp__` prefix) installs the plugin as `(unavailable) {unsupported hooks}`; no per-entry skip (MATCH-02 + TOOL-02(a)).
3. A bidirectional Claude ↔ Pi tool-name mapping lives at `domain/components/hook-tool-names.ts` (per D-58-04) with an architecture test asserting every Pi `toolName` literal exported by the peer-dep types has a mapping; MCP tools bypass the table (TOOL-01).
4. A plugin declaring hooks against any non-bucket-A event, an unmapped Claude tool (`MultiEdit`, `WebFetch`, `Task`, ...), or a non-`command` handler type installs as `(unavailable) {unsupported hooks}`; reconcile honors the flip across `/reload` (TOOL-02(b)/(c)/(d)).

**Plans**: 4 plans (Wave 1: 58-01, 58-02 parallel; Wave 2: 58-03; Wave 3: 58-04)

**Wave 1** (parallel — no shared file conflicts):

- [x] 58-01-PLAN.md — TOOL-01 bidirectional tool-name map + completeness architecture test (`domain/components/hook-tool-names.ts` per D-58-04)
- [x] 58-02-PLAN.md — Bucket-A 8-event tuple + per-non-tool-event field/value-set maps + supportability architecture-test scaffold (`domain/components/hook-events.ts` per D-58-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 58-03-PLAN.md — Matcher parser + supportability gate + parseHooksConfig single-seam extension (MATCH-01 / MATCH-02 / TOOL-02 / D-58-03)

**Wave 3** *(blocked on Wave 2 completion — atomic byte-form rename single commit per D-58-01)*

- [x] 58-04-PLAN.md — HOOK-04 atomic byte rename + narrowResolverNotes tightening + MANIFEST_FIELD carve-out drop (D-58-02) + catalog/docs/fixtures in lockstep

#### Phase 59: Bridge Dispatch Core & Debug Seam

**Goal**: A single composite handler per supported Pi event type dispatches synchronously to the right plugin entries in deterministic order, surviving `/reload` without zombie callbacks.

**Depends on**: Phase 58 (dispatch reads parser output)

**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, OBS-01

**Success Criteria** (what must be TRUE):

1. The bridge calls `pi.on(eventName, handler)` exactly once per supported Pi event type at extension-factory time; routing state is read from `shared/event-router.ts` (DISP-01).
2. After every scope apply pass `rebuildRoutingTables(state, loc)` (called from `orchestrators/reconcile/apply.ts`) clears and rebuilds routing tables in sub-millisecond synchronous time (DISP-02).
3. A `/reload` cycle never produces a zombie dispatch from a prior load: every composite handler closes over an epoch integer compared against a module-level `liveEpoch` bumped on bridge load; stale invocations no-op (DISP-03; NFR-2).
4. Within one composite-handler invocation, entries dispatch in deterministic order — `compareByNameThenScope` (project-first, alphabetical) across plugins, declaration order within a plugin's `hooks.json`, sequential awaited fan-out (DISP-04).
5. All runtime hook diagnostic output goes through `shared/debug-log.ts` gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`; nothing in the dispatch path calls `console.error`, `process.stderr.write`, or `ctx.ui.notify` for diagnostics (OBS-01; IL-2).

**Plans**: 3 plans

**Wave 1**

- [x] 59-01-PLAN.md — OBS-01 debug-log seam at `shared/debug-log.ts` + ESLint per-file override + retirement of the Phase 57 local `hookDebugLog` stub (OBS-01 / D-59-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 59-02-PLAN.md — Dispatch core: `bridges/hooks/event-router.ts` module-state holder (liveEpoch + parsedConfigCache + routingTable), `bridges/hooks/dispatch.ts` 7 composite handler bodies with `tool_result` isError split, `bridges/hooks/dispatch-exec.ts` no-op stub, barrel + Pi peer-import re-exports (DISP-01..04 / D-59-01..04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 59-03-PLAN.md — Wiring + architecture tests: `registerHooksBridge` in `index.ts` factory, `rebuildRoutingTables` call site in `apply.ts`, cache add/remove in `install.ts`/`uninstall.ts`, and `tests/architecture/hooks-dispatch.test.ts` pinning DISP-01..04 + OBS-01 invariants (DISP-01..04 / OBS-01 / D-59-02)

#### Phase 60: Hook Execution, Payload Translators & Env Vars

**Goal**: A dispatched hook spawns a child process with the right cwd / env / args / timeout, receives a faithfully translated bucket-A stdin payload (with Pi → Claude tool-name translation), and surfaces its stderr only to the debug log.

**Depends on**: Phase 59 (dispatch core must invoke an exec layer)

**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, PAYL-01, HOOK-05

**Success Criteria** (what must be TRUE):

1. Each of the 8 bucket-A events (SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / PostToolUseFailure / PreCompact / PostCompact / SessionEnd) round-trips through a translator at `bridges/hooks/payloads/<event>.ts` with an architecture-test fixture; PreToolUse / PostToolUse / PostToolUseFailure additionally map Pi's lowercase `event.toolName` to Claude's capitalized `tool_name` via TOOL-01 (PAYL-01).
2. The hook child runs via `node:child_process.spawn` with cwd = Pi `ctx.cwd` snapshot at dispatch time and env merging process env + both `CLAUDE_*` and `PI_*` variables (EXEC-01).
3. Every hook child sees `CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` set; `CLAUDE_ENV_FILE` is present only for events that use it upstream (`SessionStart` in v1.13); `CLAUDE_CODE_REMOTE` is intentionally unset (HOOK-05).
4. A hook's `timeout` field overrides the 600s bridge default (Claude Code parity); timeout escalates SIGTERM → 5s grace → SIGKILL; stdout `maxBuffer: 1MB`; stdin truncated at 256KB with `_truncated: true` (EXEC-02).
5. Hook stderr is debug-logged only and never reaches `ctx.ui.notify` at runtime; install-time hook-config errors continue to surface through `notify` (EXEC-03; IL-2).
6. A handler declaring `args: [string, ...]` invokes `spawn(command, args, options)` exec-form; the default (no `args`) stays shell-form; the `shell` field (HOOK-03 extension) selects the shell binary for shell-form only (EXEC-04).

**Plans**: 4 plans

**Wave 1**

- [x] 60-01-PLAN.md — Translators, tool-name helper, TranslationContext (PAYL-01 / D-60-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 60-02-PLAN.md — Exec body, wire-protocol parser, timer ladder, _shared mkdir, whitelist amendment (EXEC-01..04 / HOOK-05 / D-60-01 / D-60-06)

**Wave 3** *(blocked on Wave 2 completion; 60-03 and 60-04 run in parallel)*

- [x] 60-03-PLAN.md — Reducer loop and per-Pi-event adapters (D-60-02 / D-60-03)
- [x] 60-04-PLAN.md — Lifecycle hardening: WR-01, WR-03, REQUIREMENTS amendment (D-60-05 / D-60-06)

#### Phase 61: `if` Field Permission-Rule Matcher

**Goal**: A hook entry's optional `if` field narrows tool-event dispatch via Claude Code's permission-rule syntax, matching the upstream truth table verbatim with explicit fail-open on parse failure.

**Depends on**: Phase 60 (the `if` filter sits between dispatch and exec; tool-name translation must already work)

**Requirements**: MATCH-03

**Success Criteria** (what must be TRUE):

1. On a PreToolUse / PostToolUse / PostToolUseFailure dispatch, an `if: Bash(...)` entry only fires when one of the parsed subcommands (after compound-separator split, `$()`/backtick recursion, process-wrapper strip) matches the glob; an `if: Edit(*.ts)` (and the other file-path tool forms) only fires when the per-tool argument path matches the gitignore-semantics glob with the four anchors (`//abs`, `~/home`, `/project-root`, `./cwd`); an `if: mcp__<server>__<tool>` only fires on literal `event.toolName` match (MATCH-03 core).
2. Bash-glob edge cases match Claude Code byte-for-byte: word-boundary at trailing space (`Bash(ls *)` excludes `lsof`; `Bash(ls*)` includes both), `:*` trailing-sugar equivalence (`Bash(ls:*)` ≡ `Bash(ls *)`), patterns more specific than `<command> *` fire on `$()`/backtick/`$VAR` interpolation (MATCH-03 fail-open-on-uncertain-context).
3. An unparseable Bash command fires the hook regardless (fail-open documented behavior; matches Claude Code's "best-effort, not a security boundary" contract).
4. The `if` field composes with `matcher` under AND semantics (matcher filters at group level, `if` narrows within).
5. An architecture test at `bridges/hooks/if-field/` exercises every fixture row in the upstream `hooks-guide` § "Filter by tool name and arguments" truth table verbatim; the bridge ignores `if` on non-tool events (matches upstream's "attaching prevents the hook from running" behavior).

**Plans**: 3 plans

**Wave 1**

- [x] 61-01-PLAN.md — Hand-authored glob engine + Bash subcommand parser + IF_PREFIX_TARGETS table + IfPredicate union + architecture-test scaffold (D-61-01 / D-61-04 / D-61-03 / D-61-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 61-02-PLAN.md — Schema admission + `compileIfPredicate` + `parseHooksConfig` side-Map + `RoutingEntry.ifPredicate` + `flattenPluginIntoBuckets` populate (D-61-02 / D-61-03)

**Wave 3** *(blocked on Wave 2 completion — REQUIREMENTS.md MATCH-03 amendment lockstep per D-61-03 atomic-supersession)*

- [x] 61-03-PLAN.md — `ifFires` dispatch consult + single-line `reduceBucket` insertion + REQUIREMENTS.md MATCH-03 amendment + architecture-test end-to-end closure (D-61-02 / D-61-03 / D-61-04)

#### Phase 62: `asyncRewake` Registry & Background-Spawn

**Goal**: A hook entry declaring `asyncRewake: true` spawns detached, returns immediately, and on exit code 2 injects its output into the model context via Pi's `<system-reminder>`-equivalent primitive.

**Depends on**: Phase 60 (background spawn extends the EXEC-01..04 surface)

**Requirements**: HOOK-06, EXEC-05

**Success Criteria** (what must be TRUE):

1. A hook with `asyncRewake: true` spawns via `spawn(command, args, { detached: false, stdio: ["pipe","pipe","pipe"] })`, registers `{pid, dispatchId, plugin}` in the bridge-owned `AsyncRewakeRegistry`, and returns immediately — the triggering tool call proceeds without awaiting the child (EXEC-05).
2. On child exit code 2 the bridge injects `pi.sendMessage({role:"custom", customType:"claude-hook-rewake", display:false, content:<rewakeMessage+stderr|stdout>}, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })` — `display: false` matches Claude Code's `<system-reminder>` semantic (user-invisible / model-visible) (HOOK-06 core).
3. On exit code 0 or any non-2 code: silent background completion (no model-context injection); if `rewakeSummary` is set the bridge surfaces it via `ctx.ui.notify` at process exit (UI-only) (HOOK-06).
4. The registry is cleared on `/reload`; orphan children from a crashed prior load are SIGKILLed at next bridge load via PID-table scan; multi-hook fan-in via independent `dispatchId` per registered process (HOOK-06 lifecycle; NFR-2).
5. `rewakeMessage` / `rewakeSummary` declared without `asyncRewake: true` install normally (warning surfaced per SURF-05 in Phase 63 — no-op upstream).

**Plans**: TBD

**UI hint**: yes

#### Phase 63: Lifecycle Cascade, User-Facing Surface & Docs

**Goal**: Hook install/uninstall flows through the v1.12 reconcile cascade, `info <plugin>` and `(unavailable) {unsupported hooks}` rows render correctly, and a first-time reader can find and understand the hook-support story in `docs/hooks.md`.

**Depends on**: Phase 62 (entire dispatch / exec / forward-compat surface must exist before lifecycle, surface, and docs are meaningful)

**Requirements**: LIFE-01, LIFE-02, LIFE-03, SURF-01, SURF-02, SURF-03, SURF-04, SURF-05, SURF-06 (HOOK-04 moved to Phase 58 per D-58-01)

**Success Criteria** (what must be TRUE):

1. Installing or uninstalling a plugin with hooks emits a `NotificationMessage` plugin row through the existing v1.4 cascade (no new top-level notify pattern; no new state-change tokens) and triggers the existing `/reload` hint cascade (LIFE-01, LIFE-02). The 5th bridge slot appears in `transaction/runPhases.ts` (plan/stage/unstage/discover mirrors the existing cascade shape).
2. Hook files live under `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (NFR-10 extension); a symlinked-escape `command` path is rejected at install with a notify error via `fs.realpath` + `assertPathInside(<pluginRoot>, realpath)` (LIFE-03; NFR-10).
3. The closed-set `REASONS` token `"hooks"` is renamed to `"unsupported hooks"` at `shared/notify.ts::REASONS`; every catalog-UAT fixture row `(unavailable) {hooks}` in `docs/output-catalog.md` is updated to `(unavailable) {unsupported hooks}` in lockstep with the source rename and the corresponding byte-equality test cases (HOOK-04 atomic catalog-UAT lockstep).
4. `info <plugin>` renders a `hooks:` line per declared hook entry (event + matcher) for installable plugins; `hooks` slots alphabetically between `commands` and `mcp`; unavailable plugins continue to render `components: not resolved` (SURF-01). `list` does NOT add a hook-count column and no standalone `/claude:plugin hooks <plugin>` command ships (SURF-04).
5. `shared/notify.ts` gains a typed `HookSummary` discriminated model plus a closed-set `ClaudeHookEvent` tuple (8 bucket-A events); all UI surfaces consume `HookSummary` (no string re-derivation) (SURF-02). No install-time synthesis-caveat warnings ship in v1.13 (SURF-03 reserved for v1.14+).
6. A plugin declaring `rewakeMessage` or `rewakeSummary` without `asyncRewake: true` emits one install-time warning (no-op upstream); plugins with `asyncRewake: true` install normally with no warning (SURF-05).
7. `docs/hooks.md` exists, is linked from `README.md`'s new "Hook support" section, and is written in plain English for first-time readers (plugin authors and end users) — no internal jargon, no bucket-A/D taxonomy, no REQ-IDs / phase numbers, using Claude Code's own field names verbatim. It covers: the 8 supported events with plain descriptions; 4–6 worked examples (auto-formatter, bash-safety net, session-start rule injection, prompt audit log, background security review, compaction snapshot); the unsupported event groups with one-line reasons each; the Pi ↔ Claude tool-name mapping table and currently-unmapped Claude tools; a "what happens to my plugin?" section; the marketplace coverage note (10/13 installable); and cross-references to the two authority docs (SURF-06).

**Plans**: TBD

**UI hint**: yes

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
| 62. `asyncRewake` Registry & Background-Spawn                       | v1.13     | 0/0 | Not started | -          |
| 63. Lifecycle Cascade, User-Facing Surface & Docs                   | v1.13     | 0/0 | Not started | -          |
