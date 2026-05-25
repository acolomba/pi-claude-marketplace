# Milestones: pi-claude-marketplace

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
