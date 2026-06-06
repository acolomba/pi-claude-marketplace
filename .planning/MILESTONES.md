# Milestones: pi-claude-marketplace

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

**Phases completed:** 7 phases, 12 plans, 25 tasks

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
