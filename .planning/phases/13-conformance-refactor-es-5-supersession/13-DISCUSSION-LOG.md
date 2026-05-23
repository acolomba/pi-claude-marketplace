# Phase 13: Conformance Refactor & ES-5 Supersession - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 13-conformance-refactor-es-5-supersession
**Areas discussed:** Plan decomposition + wave order, Renderer composer + payload model, ES-5 atomic-commit positioning, CMC-21 adoption semantics

---

## Plan Decomposition + Wave Order

### Q1: How should we slice 31 CMC requirements into plans?

| Option | Description | Selected |
|--------|-------------|----------|
| Layered | Wave 1 cross-cutting primitives → Wave 2 parallel per-command rewrites → Wave 3 ES-5 atomic commit + catalog UAT | ✓ |
| Per-command vertical slices | One plan per command; each lands renderer + orchestrator + UAT for that command | |
| Per-concern horizontal layers | Plans grouped by concern (universal grammar, soft-deps, display semantics, severity routing, per-command conformance, ES-5) | |

**User's choice:** Layered
**Notes:** Maximises parallelism in Wave 2; matches Phase 12's foundation → callsite pattern.

### Q2: Within Wave 2, how should the 12 commands be parallelised?

| Option | Description | Selected |
|--------|-------------|----------|
| Group by shape | 3-4 sub-waves: cascades / single-plugin / marketplace / list. Sub-waves serialise; within each, commands parallelise. | ✓ |
| All 12 commands parallel | Maximum throughput; risks merge conflicts on primitives | |
| Strict serial | Lowest risk, slowest | |

**User's choice:** Group by shape

### Q3: Where should the ES-5 atomic three-file edit sit relative to Wave 2's per-command rewrites?

| Option | Description | Selected |
|--------|-------------|----------|
| After Wave 2 -- final cutover | Legacy markers stay exported until every callsite migrated; atomic commit deletes exports + snapshot rows + edits PRD §6.12 | ✓ |
| Inside Wave 2 -- per-marker incremental | Delete each marker as the last callsite consuming it migrates. Violates §15 atomicity. | |
| Before Wave 2 -- paint-it-yellow first | Land ES-5 first then race to migrate. Highest risk. | |

**User's choice:** After Wave 2 -- final cutover

### Q4: Should Wave 3 also include a byte-identical catalog conformance check, or is per-sub-wave UAT-during-execution sufficient?

| Option | Description | Selected |
|--------|-------------|----------|
| Wave 3 = ES-5 + catalog UAT plan | Two Wave 3 plans: UAT first (cutover gate), then ES-5 atomic commit | ✓ |
| Per-sub-wave UAT inline | UAT coverage depends on each plan's discipline | |
| Defer to Phase 14 drift-guard | Risk: drift-guard reads YAML, not rendered examples | |

**User's choice:** Wave 3 = ES-5 + catalog UAT plan

---

## Renderer Composer + Payload Model

### Q1: How should the new compact-line composers be shaped?

| Option | Description | Selected |
|--------|-------------|----------|
| Typed RowSpec + renderer | Discriminated union of row shapes through one renderer; orchestrators build RowSpec, renderer owns token-order discipline | ✓ |
| String helpers (lower-level) | Small helpers + orchestrator-side concatenation; spreads grammar discipline across callsites | |
| Hybrid | Common shapes use RowSpec; rare shapes use string helpers | |

**User's choice:** Typed RowSpec + renderer

### Q2: Where should declaresAgents / declaresMcp predicates live?

| Option | Description | Selected |
|--------|-------------|----------|
| On the RowSpec itself | Optional declares fields; renderer probes companion-unloaded predicate via edge-deps AND the declares field | ✓ |
| Renderer-injected probe | Renderer receives a SoftDepProbe function; risks D-11 violation | |
| Pre-resolved markers on RowSpec | Orchestrator does full predicate computation; renderer can't enforce MSG-SD-3 structurally | |

**User's choice:** On the RowSpec itself

### Q3: Where should cascade summary severity routing live (CMC-20)?

| Option | Description | Selected |
|--------|-------------|----------|
| Helper in presentation/ | Pure function cascadeSeverity(rows); composer returns {message, severity} | ✓ |
| Orchestrator-side decision | Each cascade orchestrator computes severity; duplicates MSG-SR-4..6 policy | |
| Composer returns notify call | Rejected -- breaks D-07 single-callsite discipline | |

**User's choice:** Helper in presentation/

### Q4: How should the new presentation/ composers be organised on disk?

| Option | Description | Selected |
|--------|-------------|----------|
| One file per concern | compact-line.ts, cascade-summary.ts, manual-recovery.ts, rollback-partial.ts, cause-chain.ts | ✓ |
| Bundle into presentation/grammar/ | Risks confusion with shared/grammar/ (which already exists) | |
| Add to existing files | Grows plugin-list.ts and marketplace-list.ts beyond their single concerns | |

**User's choice:** One file per concern

---

## ES-5 Atomic-Commit Positioning

### Q1: What's the interim contract on legacy marker exports during Wave 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Exported-but-import-forbidden | ESLint no-restricted-imports rule allows imports only from markers.ts + markers-snapshot.test.ts | ✓ |
| Exported, callsites migrate when ready | No structural enforcement; relies on plan discipline | |
| Mark @deprecated | JSDoc warning only; doesn't fail npm run check | |

**User's choice:** Exported-but-import-forbidden

### Q2: What replaces ES-5 in PRD §6.12 in the atomic commit?

| Option | Description | Selected |
|--------|-------------|----------|
| Pointer to style guide §15 supersession table | Brief note: "see docs/messaging-style-guide.md §15"; matches Phase 12 D-CMC-15 | ✓ |
| Replacement table inline in PRD | Duplicates style guide §15; drift risk | |
| Delete §6.12 ES-5 entirely | Breaks PRD back-references to ES-1..ES-5 | |

**User's choice:** Pointer to style guide §15

### Q3: How to verify zero remaining legacy emissions before deleting exports?

| Option | Description | Selected |
|--------|-------------|----------|
| Static-audit test in tests/architecture/ | Greps codebase for the 5 legacy strings; npm run check-gated; durable | ✓ |
| Pre-commit grep script | Runs in CI but not in npm run check | |
| Manual grep + reviewer sign-off | Lowest friction; weakest enforcement | |

**User's choice:** Static-audit test in tests/architecture/

### Q4: Rollback story if the ES-5 atomic commit regresses?

| Option | Description | Selected |
|--------|-------------|----------|
| git revert the ES-5 commit | Restores all three files atomically; static-audit test prevents re-import | ✓ |
| Pre-commit dry-run gate | Wave 3's catalog UAT plan acts as the gate (already in decomposition) | |
| Feature-flag the cutover | Conflicts with markers-snapshot byte-equality; heavyweight | |

**User's choice:** git revert the ES-5 commit (with the Wave 3 UAT plan as the pre-commit gate)

---

## CMC-21 Adoption Semantics

### Q1: Where does adoption happen -- in state, or at render time?

| Option | Description | Selected |
|--------|-------------|----------|
| Render-time folding only | State stays scope-pinned; renderer folds orphans at read time; adoption is automatic on next list | ✓ |
| State mutation at marketplace-add | Re-keys orphan plugins explicitly; effectively a no-op if state is already per-scope-per-marketplace | |
| Hybrid (state stores fold-state) | More state surface; no win over render-time | |

**User's choice:** Render-time folding only

### Q2: Does the [<scope>] bracket reflect actual install scope on ALL surfaces, or only list?

| Option | Description | Selected |
|--------|-------------|----------|
| All surfaces -- universal | Every plugin row everywhere shows actual install scope; matches MSG-GR-3 | ✓ |
| List only | Surface-specific divergence | |

**User's choice:** All surfaces -- universal

### Q3: Where should the orphan-fold lookup live?

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator constructs folded payload | orchestrators/plugin/list.ts reads both scopes, computes orphans, builds payload | ✓ |
| Renderer does the fold | Renderer needs state-structure knowledge; partly violates D-06 | |
| Separate fold module in presentation/ | Over-extraction (one consumer ever) | |

**User's choice:** Orchestrator constructs folded payload

### Q4: Where should the sort comparator live (MSG-GR-3 name-primary localeCompare)?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared helper in presentation/ | Single helper used by every per-scope surface; Phase 14 drift guard can assert | ✓ |
| Each orchestrator implements | Drift risk if any orchestrator omits 'base' or the tie-breaker | |

**User's choice:** Shared helper in presentation/

---

## Claude's Discretion

Items captured in CONTEXT.md §Decisions →"Claude's Discretion":

- `RowSpec` discriminant key (`kind` vs implicit type-narrowing) -- planner picks.
- Sub-wave 2c internal ordering (whether `mp remove` / `mp update` land first or after the simpler marketplace commands) -- planner picks.
- Cause-chain depth-5 walk implementation (iterative vs recursive) -- planner picks.
- Plan count and exact decomposition within waves -- planner picks; wave + sub-wave structure is the binding contract.
- Catalog UAT runner shape (architecture test vs separate runner vs per-command snapshot) -- planner / researcher picks; contract is byte-identical output.

## Deferred Ideas

No new deferred ideas surfaced during discussion. Existing milestone deferrals (CMC-38 drift-guard suite to Phase 14; hash-version abbreviation; bulk uninstall; marketplace versions; wider drift-guard frontmatter surface; tone-changing rewordings) carry forward unchanged from prior context.
