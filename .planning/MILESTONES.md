# Milestones: pi-claude-marketplace

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
