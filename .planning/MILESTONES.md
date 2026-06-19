# Milestones: pi-claude-marketplace

## v1.13 Claude Hook Bridge (Shipped: 2026-06-19)

**Phases completed:** 7 phases, 32 plans, 52 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Updated 13 pre-existing test fixtures + 3 production call sites for the widened schema
- 1. [Rule 2 - Missing critical functionality] Removed unused `SupportedKind` alias then re-introduced as exported type alongside `SUPPORTED_COMPONENT_KINDS`
- 1. [Rule 3 - Blocking] Exported `UNSUPPORTED_COMPONENT_KINDS` from `domain/resolver.ts`
- 1. [Rule 3 - Blocking] PiToolName derivation: `Exclude<..., string>` evaluates to `never`
- 1. [Rule 1 — Lint] Unnecessary escape character in `SAFE_MATCHER_CHARS` regex
- OBS-01 debug-output seam re-homed at `shared/debug-log.ts` with a per-file ESLint override; Phase 57 stub and TODO retired; three call sites rewired byte-for-byte.
- Hooks-bridge dispatch core landed -- liveEpoch + parsedConfigCache + routingTable module-state holder, 7-event pi.on factory with the `event.isError` PostToolUse/PostToolUseFailure split, no-op execution stub, and 21 unit tests pinning cache + rebuild + sort + epoch + composite-handler contracts.
- Hooks-bridge dispatch wiring landed: async-factory contract with `await registerHooksBridge` blocks first session event until 7 pi.on registrations complete; per-scope `rebuildRoutingTables` in apply.ts after every reconcile (gated on pristine scopes); install/uninstall maintain the parsed-config cache inside the per-plugin lock; 10 unit tests across 7 architecture blocks pin DISP-01..04 + OBS-01 + D-59-05.
- 8 hand-authored Pi -> Claude payload translators under `bridges/hooks/payloads/`, the `mapPiToClaudeToolName` TOOL-01 reuse helper colocated with the const map, and a `TranslationContext` factory ready for the Plan 60-02 exec body to consume.
- `dispatchHookExec` body filled with the real spawn body + per-event payload translation + HOOK-05 env vars + EXEC-02 timer escalation + EXEC-03 stderr sole-sink; ships `HookExecResult` + `parseHookStdout` + `installTimerLadder` as siblings; architecture whitelist widened to 2 entries.
- The dispatch chain is end-to-end live: a Pi event fires -> matcher narrows -> dispatchHookExec runs with the real spawn body (Plan 60-02) -> the D-60-02 reducer composes outcomes across entries with first-block-wins + left-to-right mutate -> the D-60-03 per-event adapter returns the Pi-shaped value the runtime expects.
- Standalone install / uninstall / reinstall / update of hooks-bearing plugins now updates the hooks-bridge routing table inside the per-plugin lock; phantom project-arm cache entries no longer leak past `hydrateProjectScopeForCwd`'s re-hydrate path; REQUIREMENTS.md HOOK-05 wording matches the chosen `_shared` per-session path scheme.
- Hand-authored glob engine + Bash subcommand parser + upstream-faithful prefix-to-Pi-event-set mapping + IfPredicate fall-open sentinel; parse-time-compile primitives for MATCH-03 with zero new runtime deps.
- parse-time `if`-field compile attached to every RoutingEntry via a side-Map; D-61-02 fail-open everywhere; dispatch consult (Plan 03) is now a single-line insertion against `entry.ifPredicate`.
- Phase 61 closes: `if`-field permission-rule matching ships in full -- AND composition with the group matcher, D-61-02 fail-open on every failure mode, D-61-03 substitute-cwd for path tools, D-61-04 Bash specificity-override + wrapper strip; REQUIREMENTS.md MATCH-03 amended atomically in the first commit.
- Bridge-owned asyncRewake registry: detached=false spawn + ring-buffered stderr/stdout + EXEC-02 timer ladder + captured-epoch zombie defense + exit-code-2 pi.sendMessage injection + PID-table-backed orphan reap on `/reload` — the THIRD and FINAL sanctioned `node:child_process` site in the extension tree, atomically supersedes the 2-element whitelist to 3 in the same commit (D-58-01).
- 1. [Rule 2 -- Missing critical functionality] Composite handler signatures widened beyond the plan's surface
- HookSummaryEntry discriminated union + ClaudeHookEvent literal-union + multi-line `hooks:` renderer arm in shared/notify.ts, foundation for plans 63-02..05.
- writeHookConfig + removeHookConfig at bridges/hooks/stage.ts with LIFE-03 subtree symlink walk + NFR-1 atomic write. Flatter verb pair per RESEARCH Open Question 2 -- the single-file artefact does not justify the mcp bridge's 3-verb prepare/commit/abort shape.
- Closed-set `"orphan rewake"` REASONS token + resolver-side detection + catalog/UAT landing -- atomic per D-58-01.
- Wires the hooks bridge into the install / update / reinstall / cascadeUnstagePlugin cascades between agents and mcp per D-63-01, and connects resolver-side `orphanRewake` to `PluginInstalledMessage.reasons` so `(installed) {orphan rewake}` surfaces through the existing v1.4 NotificationMessage cascade. Closes LIFE-01 and LIFE-02.
- Wire `info <plugin>` to surface a multi-line `hooks:` block by extending `composeResolvedComponents` to re-parse `<pluginRoot>/hooks/hooks.json` and project entries to the `HookSummaryEntry[]` carrier defined in Plan 63-01. Closes SURF-01.
- First-time-reader hook-support doc (docs/hooks.md, 257 lines, 9 sections, 8 supported events, 6 worked examples) plus README ## Hook support section linking to it, plus architecture-lint test pinning jargon prohibition, 8-event coverage, two cross-refs, and worked-example presence.
- Single architecture-lint test pinning SURF-03 / SURF-04 NON-additions + HOOK-04 prior completion via 5 grep-by-readFile invariants — zero source edits, v1.13 milestone close-out ready.
- 1. [Rule 3 - Blocking] ESLint cognitive-complexity ceiling required helper extraction
- Two-arm `parseHooksConfig` unwraps the upstream PLUGIN-format wrapper `{description?, hooks: {...}}` per Claude Code `plugin-dev/skills/hook-development/SKILL.md`, closing the wire-contract bug that flipped every wrapper-shipping plugin (hookify and siblings) to `(unavailable) {unsupported hooks}` before the install cascade could reach the hooks-bridge slot.
- New arm in `narrowResolverReasons` mirrors the four `hooks.json`-prefix families already recognised by `narrowResolverNotes`, closing the cross-surface REASONS asymmetry (SURF-01) so the install cascade and info/list probe surfaces emit the SAME `(unavailable) {unsupported hooks}` token for the SAME on-disk hooks-config failure -- pinned structurally by a new cross-surface parity test.
- Closed the cosmetic UAT gap 3 (Hooks bullet in README `## Features` list) and recorded the binding runtime UAT against the pi-uat sandbox -- the wrapper-format fix (63-09) and cross-surface classifier parity (63-10) land correctly at runtime; the residual `(unavailable) {unsupported hooks}` trip on hookify is the honest v1.13 bucket-A supportability gate (Stop-event admission deferred to v1.14+ per 63-09 Option A), not a defect.

---

## v1.12 Marketplace and Plugin Config Files (Shipped: 2026-06-11)

**Phases completed:** 6 phases, 15 plans, 24 tasks

**Key accomplishments:**

- Declarative per-scope config files: `claude-plugins.json` + entry-level-override `claude-plugins.local.json`, typebox-validated with a discriminated absent/invalid/valid load seam — a 0-byte or corrupt file can never read as "uninstall everything" (CFG-01..03).
- Lossless first-run migration: upgrading installs generate the config from existing state.json with nothing uninstalled; atomic, idempotent, and convergence-proven (MIG-01..02).
- Pure 7-bucket reconcile planner + read-only `/claude:plugin preview` showing exactly what the next load will do, with six new closed-set `will *` tokens landed in atomic catalog lockstep (DIFF-01..02).
- Offline enable/disable: `disable` keeps the config entry + version pin while removing artefacts; `enable` re-materializes from the cached clone with zero network; a new `(disabled)` token renders distinctly from soft-degraded `unavailable` (ENBL-01..04).
- Automatic load-time reconciliation on every Pi startup/`/reload`: per-entry network soft-fail, one structured cascade (never a `/reload` hint), byte-stable fixed point, two-process race safe (RECON-01..06).
- Config write-back on every mutating command with `--local` targeting, batched import/bootstrap patches, SPLIT-01 cast sites fully rewired to merged-config truth, and the CFG-04 README workflow docs (WB-01..04).

**Quality:** 146 commits, 187 files, +40,241/−964 lines; `npm run check` GREEN at close (1804 unit + 10 integration, +289 vs v1.11). 5 review criticals and 30+ warnings found and fixed across phases. Known deferred items at close: 1 (see STATE.md Deferred Items) plus register items in `milestones/v1.12-MILESTONE-AUDIT.md` (zero-component/disabled-marker ambiguity, Nyquist back-fill, CFGV2 backlog).

---

## v1.11 Notification Summary-Line Grammar (Shipped: 2026-06-08)

**Phases completed:** 1 phases, 1 plans, 3 tasks

**Key accomplishments:**

- Every error/warning notification now carries a non-empty summary first line with the detail rendered as its own block, emitted through ONE shared `emitWithSummary` seam so the standalone-vs-cascade divergence that caused the v1.10 glued-label defect cannot recur.

---

## v1.10 Error Attribution & Message-Type Consistency (Shipped: 2026-06-08)

**Phases completed:** 4 phases, 10 plans, 28 tasks

**Key accomplishments:**

- A dedicated `marketplace-not-added` variant + `ContentReason` exclusion + per-status `MarketplaceNotificationMessage` union + a single `isInfoKind`/`assertNever` guard make the v1.10 attribution foot-guns unrepresentable -- with ZERO rendered-byte changes for any v1.0-v1.9 command.
- install/uninstall now converge on info's model: a missing or wrong-scope marketplace renders standalone `(failed) {not added}` on the marketplace subject (not `{not in manifest}` on a plugin row, not silent), backed by a new discriminated cross-scope resolver and truthful cascade-failure reasons.
- Reinstall's marketplace-existence/scope precondition now emits one standalone `(failed) {not added}` consistently across the explicit-scope-plugin, explicit-scope-marketplace, and bare forms (ATTR-03), with a truthful `unreadable` cascade last-resort (ATTR-09) and the `[requestedScope]` cross-scope bracket (SCOPE-01).
- update's missing-marketplace precondition re-attributed to the canonical standalone `(failed) {not added}` for both the `<plugin>@<mp>` and `@<mp>` forms, eliminating the raw `MarketplaceNotFoundError`/`Error` -> `{not found}` misattribution while preserving the cascade never-throw contract -- closing ATTR-02 and the update half of SCOPE-01.
- The D-48-A `MpFailed.reasons?` type+renderer foundation, the typed `InvalidMarketplaceManifestError`, and ATTR-07 `marketplace add` precondition attribution land atomically in one GREEN state -- the marketplace subject can now render its own closed-set reason, and all five `add` precondition failures route through `notify` as `(failed) {<reason>}` rows instead of raw throws.
- autoupdate/noautoupdate (S1+S2) and marketplace remove (S3+S4) of a missing marketplace now converge on the standalone `(failed) {not added}` variant -- no reason-less row, no `{not found}`, no raw `MarketplaceNotFoundError` escaping the orchestrator -- with the StateLockHeldError `{lock held}` path preserved.
- A path-source malformed/schema-invalid `marketplace.json` during `marketplace update` now renders `(failed) {invalid manifest}` -- never the lying `{network unreachable}` -- via the typed `InvalidMarketplaceManifestError` branch in `reasonsFromCascadeError` (recognized before the `?? ["network unreachable"]` default), with zero network on the path-source failure path (NFR-5); the github no-errno catch-all is preserved and the three bare-`(failed)` byte forms are regression-locked. Final phase gate `npm run check` exits 0 (1502 tests).
- `marketplace update <missing-mp>` now converges on the canonical standalone `(failed) {not added}` variant (explicit-scope `⊘ <name> [scope] (failed) {not added}` + bracketless bare form) instead of raw-throwing MarketplaceNotFoundError -- closing the last residual Class-C gap so SC#1 is literally true.
- `narrowProbeError` now maps a schema-invalid `InvalidMarketplaceManifestError` to `{invalid manifest}` on the read-only `marketplace info` / `plugin info` / `list` surfaces -- parity with the `marketplace add` write path -- while preserving `{unparseable}` for malformed JSON, with the new read-surface byte form catalog-documented and fixture-locked.
- A dedicated cross-op byte-identity matrix test that proves every converged op (info / install / uninstall / reinstall / plugin-update / marketplace-remove / autoupdate / the newly-converged marketplace-update) emits the byte-identical `⊘ <name> [scope?] (failed) {not added}` row, plus a catalog-uat inverse-walk orphan gate and the milestone GREEN-gate evidence (npm run check exit 0, 1510 tests).

---

## v1.9 Manifest In-Memory Cache (Shipped: 2026-06-07)

**Phases completed:** 1 phases, 2 plans, 3 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Split CACHE-01 into 2 tests to satisfy the 7-block acceptance criterion
- `createManifestCache(loader)` stat-keyed memoization wired behind the `loadMarketplaceManifest` seam -- by-reference success hits, same-instance negative re-throw, stat-fail fall-through -- turning Plan 45-01's Wave 0 suite GREEN with byte-identical output and zero call-site churn.

---

## v1.8 Plugin and Marketplace Info Commands (Shipped: 2026-06-04)

**Phases completed:** 3 phases, 5 plans, 10 tasks

**Key accomplishments:**

- `/claude:plugin marketplace info` and `/claude:plugin info` show detailed information about a given marketplace or plugin.
- Type-model and render-seam foundations: `MarketplaceInfoMessage` / `PluginInfoMessage` variants, a `wrapDescription` helper, and a new `not added` reason landed in one atomic commit.
- Per-scope rendering end-to-end, tab-completion plumbing, the install-cascade form, plugin description wrap at column 66, a components "not resolved" marker, plus catalog states and UAT entries.

---

## v1.7 Transaction Resilience Hardening (Shipped: 2026-06-02)

**Phases completed:** 5 phases, 5 plans, 9 tasks

**Key accomplishments:**

- Closed TR-02 by restructuring runPhases catch block so the failing phase's own undo runs FIRST (separate call site, via new invokeFailingPhaseUndo helper) BEFORE the reverse-walk over executed[]; PathContainmentError still re-throws (PI-14); failing-phase RollbackPartial prepends to reverse-walk partials (AS-4 newest-first); Phase<C>.undo JSDoc amended in place to document the tolerate-partial-do-throw contract.

---

## v1.6 GitHub Private Marketplace Authentication (0.3.0, Shipped: 2026-06-01)

**Phases completed:** 7 phases, 11 plans, 25 tasks

**Key accomplishments:**

- Device Flow (RFC 8628) authentication for private GitHub marketplaces: on first access Pi shows a one-time code and verification URL via `ctx.ui.notify`; the user authorizes from any browser, and subsequent add/update reuse the stored token silently.
- Credentials stored in the OS keychain via `git credential approve`; no token ever appears in `state.json`, error messages, or UI output. Stale tokens are auto-evicted via `git credential reject` and Device Flow re-triggered on auth failure.
- New `platform/git-credential.ts` (`CredentialOps`) and `domain/github-auth.ts` (Device Flow state machine with an injectable HTTP seam); the `GitOps` interface is threaded through `shared.ts`. No new npm runtime dependencies.

---

## v1.5 Notification Output Polish (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 3 phases, 10 plans, 25 tasks

**Key accomplishments:**

- Benign no-ops (already up-to-date, idempotent autoupdate flips) now render as dim info text instead of yellow `Warning:` output.
- The autoupdate surface uses `<autoupdate>` / `<no autoupdate>` marker tokens; `marketplace update` with no manifest change renders `(skipped) {up-to-date}`.
- Dropped the noise `<last-updated <iso>>` token from `marketplace list` and corrected the github-source autoupdate catalog prose.
- `notify()` now prepends a summary line so the host `Error:`/`Warning:` label introduces the cascade body; the colorless-cascade variant (UXG-03) was deferred-with-finding (the host couples label and color to a single arg).

---

## v1.4.1 Post-ship UAT Patches (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 5 phases, 8 plans, 23 tasks

**Key accomplishments:**

- Reload-hint discipline: the `/reload to pick up changes` hint now fires only when a Pi-visible resource actually changed (no spurious hints on read-only or no-op operations).
- Version display: hash-version plugins render as `v#<7hex>` (git short SHA) instead of `vhash-<12hex>`; a plugin.json-declared version now takes precedence over the content hash.
- Grammar consistency: unsupported-LSP plugin rows render `{lsp}` instead of `{lspServers}`.
- Runtime publish and verification: v0.2.0 source-loads into a Pi runtime via `scripts/pi.sh`; the G-MIL-03 indent gap was refuted by byte evidence, and G-MIL-07 tab-completion was deferred-with-finding (host-side pi-tui `@`-precedence).

---

## v1.4 Structured Notification Messages (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 9 phases, 43 plans, 106 tasks

**Key accomplishments:**

- Replaced V1's ad-hoc per-orchestrator output with a single structured `notify(ctx, pi, message: NotificationMessage)` entry point: every command renders a consistent marketplace-header + indented-plugin-rows format with status tokens, cause-chain trailers, and per-row soft-dependency markers.
- Migrated the marketplace, plugin, and edge-handler orchestrator families off the V1 `notifyError` wrappers across three migration waves, then deleted the V1 composer fan-out and narrowed the lint glob to zero V1 callers.
- Lifted the v2 grammar into `docs/output-catalog.md` as the binding user contract, enforced by a byte-equality catalog-UAT runner; closed-set authority (statuses, reasons, markers) moved to `as const` tuples in `shared/notify.ts`.

---

## v1.3 Consistent Messaging

**Status:** Complete
**Shipped:** 2026-05-25
**Phases:** 5 (12, 13, 14, 14.1, 14.2)
**Plans:** 27
**Timeline:** 2026-05-21 → 2026-05-24 (~3 days)
**Commits:** 223 (37 `feat(`)
**Files changed:** 180 (+15,030 / -1,917)
**Requirements:** 38/38 CMC requirements satisfied
**Tests:** 1249/1249 green

**Delivered:** Every user-visible `ctx.ui.notify` callsite (and the single sanctioned `console.warn`) brought into conformance with `docs/messaging-style-guide.md` v1.0 and the per-command catalog in `docs/output-catalog.md`. The v1.3 user-contract is now structurally enforced by a 34-rule ESLint drift-guard plugin and a byte-equality catalog UAT runner.

**Key accomplishments:**

- **Closed-set grammar primitives** (`STATUS_TOKENS`, `REASONS`, `MARKERS`, `PATTERN_CLASSES`) under `shared/grammar/` with YAML-frontmatter set-equality drift test reading `docs/messaging-style-guide.md` as the binding contract (Phase 12).
- **Wave 1 presentation composers** (`compact-line`, `cascade-summary`, `manual-recovery`, `rollback-partial`, `cause-chain`, `reload-hint`, `sort`) under `presentation/` consumed by every user-visible orchestrator; per-scope rendering, orphan-fold, per-row soft-dep markers via `PluginCascadeRow.declaresAgents/Mcp`, 2-arm severity dispatch (Phase 13).
- **ES-5 atomic supersession** (`c4d87d4`): single commit deletes 5 legacy markers, retires the snapshot byte-equality assertion, rewrites PRD §6.12 ES-5 to a pointer, rolls back temporary ESLint marker-restriction blocks (CMC-35, D-30).
- **Per-command catalog conformance** enforced by `tests/architecture/catalog-uat.test.ts` byte-equality runner against `docs/output-catalog.md`; static audit `no-legacy-markers.test.ts` prevents re-introduction.
- **34-rule ESLint drift-guard plugin** (16 meta-assertion + 18 full-impl) under `tests/lint-rules/` wired into `eslint.config.js` with per-rule scoping; 4-way registry parity test ties style-guide body ↔ rule files ↔ ESLint wiring ↔ plugin module (Phase 14, CMC-38).
- **CMC-13 import-path closure** (Phase 14.1): widened `InstallPluginOutcome.installed` with REQUIRED `declaresAgents`/`declaresMcp` predicates, propagated through import orchestrator and cascade-row build.
- **CR-01 cross-scope ordering fix + MSG-GR-3 active two-axis AST rule** (Phase 14.2): 3 user-first `scopeOrder` helpers deleted, routed through canonical `compareByNameThenScope`; MSG-GR-3 promoted from no-op to active rule; retroactive `/gsd:secure-phase` + `/gsd:validate-phase` for Phases 12 and 14.1.

**Known deferred items at close:** 7 (see STATE.md Deferred Items -- completed quick tasks with stale-format SUMMARY frontmatter; no follow-up work).

---

## Completed Milestones

### v1.0: successor architecture

**Status:** Complete
**Completed:** 2026-05-11

Shipped the PRD-derived successor architecture for `pi-claude-marketplace`: `/claude:plugin` command surface, marketplace lifecycle, plugin `install` / `uninstall` / `update`, top-level `list`, skills/commands/agents/MCP bridges, tab completion, real Pi wiring, live/runtime e2e coverage, and cross-process state locking.

### v1.1: Reinstall Command

**Status:** Complete
**Completed:** 2026-05-14

Added the `reinstall` command (Phases 8-9) replacing installed plugins without leaving them absent if reinstall fails. Syntax and scoping are analogous to `update`; each plugin replacement is atomic; cached manifests and recorded versions are reused with no network sync; plugin data directories are deleted only after successful replacement.

### v1.2: Claude Settings Import

**Status:** Complete
**Completed:** 2026-05-20

Added `/claude:plugin import [--scope user|project]` (Phases 10-11). Claude settings discovery + base/override merge per scope; enabled-plugin extraction; official `claude-plugins-official` built-in mapping plus `extraKnownMarketplaces` directory/GitHub source mapping; idempotent orchestration with unavailable-plugin warning aggregation and reused marketplace/plugin atomic semantics.
