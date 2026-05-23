# Phase 13: Conformance Refactor & ES-5 Supersession - Research

**Researched:** 2026-05-23
**Domain:** Internal conformance refactor (compact-line renderer + payload model + ESLint cutover gate + ES-5 atomic commit)
**Confidence:** HIGH (every claim cross-referenced against `13-CONTEXT.md`, the binding docs, and the source tree at `gsd/v1.3-replan-catalog`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-13-01:** Layered slicing. Wave 1 = primitives (composers + RowSpec + sort + ESLint rule); Wave 2 = 12 per-command rewrites; Wave 3 = ES-5 atomic commit + catalog UAT.
- **D-13-02:** Wave 2 grouped by render shape, sub-waves serialise, commands within a sub-wave parallelise:
  - **2a cascades:** `reinstall`, `update`, `import`
  - **2b single-plugin:** `install`, `uninstall`, `bootstrap`
  - **2c marketplace:** `marketplace list/add/remove/update/autoupdate`
  - **2d list:** `/claude:plugin list`
- **D-13-03:** ES-5 atomic three-file edit (`shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD §6.12) lands in Wave 3 AFTER all Wave 2 sub-waves; single git commit; rollback via `git revert <sha>`.
- **D-13-04:** Wave 3 contains exactly two plans, executed in order: (1) per-command catalog conformance UAT (byte-equal vs `docs/output-catalog.md`); (2) ES-5 atomic three-file commit.
- **D-13-05:** Compact-line composers use a **typed `RowSpec` discriminated union flowing through a single grammar-aware renderer**. Orchestrators construct `RowSpec` values; renderer owns MSG-GR-1 token order, `@<marketplace>` carve-out, `[<scope>]` brackets, `<marker>` slot, `{reasons}` block, icon discipline.
- **D-13-06:** Union covers at least: `PluginRow`, `MarketplaceRow`, `EmptyToken`, `ManualRecoveryLine`, `RollbackChild`. Discriminant key at planner discretion (codebase precedent: inferred-union by required fields).
- **D-13-07:** Per-row soft-dep predicates live on `RowSpec` as optional `declaresAgents?: boolean` / `declaresMcp?: boolean`. Orchestrator computes from manifest + state; renderer probes companion-unloaded via `orchestrators/edge-deps.ts`; emit iff (declares AND unloaded). MSG-SD-3 (no marker on `(uninstalled)` rows) enforced structurally via discriminant.
- **D-13-08:** Cascade severity helper `cascadeSeverity(rows) => 'success' | 'warning'` is pure helper in `presentation/`. `cascadeSummary({mp, scope, rows})` returns `{message, severity}`; orchestrator destructures and dispatches to matching `notifySuccess` / `notifyWarning`. Composer-internal `ctx.ui.notify` is forbidden (would break D-07).
- **D-13-09:** ESLint `no-restricted-imports` rule in Wave 1 forbids importing the 5 legacy marker names (`PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL`) from anywhere except `shared/markers.ts` itself and `tests/architecture/markers-snapshot.test.ts`. Wave 3 atomic commit deletes the rule entry.
- **D-13-10:** Allow-list for the ESLint rule must include `markers-snapshot.test.ts` so the snapshot test keeps passing during Wave 2.
- **D-13-11:** PRD §6.12 ES-5 is rewritten in the atomic commit to a brief pointer to style guide §15.
- **D-13-12:** A static-audit test in `tests/architecture/` asserts the 5 legacy strings appear zero times in non-test files outside `shared/markers.ts`. Strings are pinned literally in the test body (since `markers.ts` deletes them in the same commit). Lands in Wave 1.
- **D-13-13:** Rollback = `git revert <es-5-sha>`. Wave 3 UAT plan acts as pre-commit gate. Static-audit test prevents re-introduction.
- **D-13-15:** New `presentation/` files: `compact-line.ts`, `cascade-summary.ts`, `manual-recovery.ts`, `rollback-partial.ts`, `cause-chain.ts`, `sort.ts` (or named export of `compact-line.ts`). One file per concern.
- **D-13-17:** Adoption is **render-time folding only**. State stays scope-pinned. The list renderer reads both scopes' state and either renders project plugins under `<mp>[project]` (when project marketplace exists) or folds them under `<mp>[user]` (when no project marketplace exists). Adoption is automatic on next list render after `marketplace add`. Zero state mutation in `marketplace add`.
- **D-13-18:** The `[<scope>]` bracket on every plugin row reflects the plugin's **actual install scope on every surface**. The fold rule affects grouping only on the list surface.
- **D-13-19:** Orphan-fold lookup lives in `orchestrators/plugin/list.ts` -- reads both scopes' state, computes orphans, constructs `PluginListPayload`. Renderer is pure formatter.

### Claude's Discretion

- **`RowSpec` discriminant key.** Codebase precedent at `presentation/plugin-list.ts:45` uses descriptive type names without an explicit discriminant key (union inferred from required fields). Planner may keep that style or introduce an explicit `kind` field. Either is acceptable provided the union is exhaustive under `--strict` and exhaustiveness checks fire on missing cases.
- **Sub-wave 2c internal ordering.** `mp remove` (CMC-31 conditional form + CMC-15 anchor coexistence) and `mp update` (CMC-32 autoupdate-on-vs-off + CMC-20 severity) interact with the most cross-cutting rules. Planner decides whether to land these first or last in 2c.
- **Cause-chain depth-5 walk implementation.** Walk can be iterative or recursive; planner picks. Existing `errorMessage(cause)` in `shared/errors.ts` is single-level; `formatErrorWithCauses` at `orchestrators/marketplace/shared.ts:453` walks depth-5 with ` -- caused by: ` joiner -- Phase 13 reshapes its rendered form.
- **Plan count.** 1-3 Wave 1 plans; 4 Wave 2 sub-wave plans (potentially split further per command); 2 Wave 3 plans.
- **Catalog UAT runner shape.** New `tests/architecture/` test, separate runner script, or per-command snapshot tests colocated with each surface -- planner decides. Contract: byte-identical to the catalog example for each rendered state.

### Deferred Ideas (OUT OF SCOPE)

- Phase 14 frontmatter drift-guard suite (CMC-38).
- `hash-<12hex>` plugin-version abbreviation in list rendering.
- Bulk uninstall cascade form.
- Marketplace versions (`hash-<12hex>` for github-source marketplaces).
- Tone-changing rewordings beyond §14.1 (Phase 12) and §15 ES-5 (Phase 13).
- Wider drift-guard surface (`markers:` and `pattern_classes:` frontmatter reads) -- Phase 14.
- `RELOAD_HINT_PREFIX` retention beyond Wave 3 atomic commit.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMC-01 | Universal compact-line grammar (MSG-GR-1) | §3.1 RowSpec + grammar-aware renderer; §3.2 token-order table |
| CMC-02 | `@<marketplace>` carve-out on cascade rows (MSG-GR-2) | §3.1 discriminant separates inline `PluginRow` vs `PluginCascadeRow` |
| CMC-03 | Per-scope sort + project-before-user tie-break (MSG-GR-3) | §3.3 `compareByNameThenScope` |
| CMC-04 | Reasons block formatting (MSG-GR-4) | §3.1 reasons rendering rules |
| CMC-05 | `<marker>` slot rendering (MSG-GR-5) | §3.1 `MarketplaceRow.marker` discriminant |
| CMC-06 | Plugin-row effective-state icon set (MSG-IC-1..3) | §3.1 icon discipline |
| CMC-07 | Marketplace-row outcome-class icon | §3.1 marketplace icon table |
| CMC-09 | `(upgradable)` list-only (MSG-PL-4) | §3.1 `(upgradable)` constrained to `PluginListRow` variant |
| CMC-10 | Empty bare-token form (MSG-ER-1) | §3.1 `EmptyToken` discriminant |
| CMC-12 | Soft-dep reason names | §5 D-13-07 per-row predicate |
| CMC-13 | Soft-dep emission scope (MSG-SD-1..3) | §5 emission predicate + structural exclusion from `(uninstalled)` |
| CMC-15 | Reload-hint + recovery-anchor coexistence | §6.1 mp-remove partial-failure layout |
| CMC-16 | Manual recovery top-level line (MSG-MR-1..2) | §3.1 `ManualRecoveryLine` variant |
| CMC-17 | Rollback-partial parent+children (MSG-RP-1) | §3.1 `RollbackChild` variant + parent-line composition |
| CMC-18 | Cause-chain trailer depth-5 (MSG-CC-1) | §4 `cause-chain.ts` walk implementation |
| CMC-20 | Cascade severity routing (MSG-SR-4..6) | §6 `cascadeSeverity` helper |
| CMC-21 | Per-scope rendering + fold + adoption | §7 D-13-17..19 render-time folding |
| CMC-22 | `/claude:plugin list` catalog conformance | §2 per-command state matrix |
| CMC-23 | `install` catalog conformance | §2 single-plugin row form |
| CMC-24 | `uninstall` catalog conformance | §2 `○ (uninstalled)` no soft-dep |
| CMC-25 | `reinstall` catalog conformance | §2 `(reinstalled)` partition + cascade |
| CMC-26 | `update` catalog conformance | §2 version-transition arrows |
| CMC-27 | `import` catalog conformance | §2 preamble + multi-mp cascade + source-mismatch |
| CMC-28 | `bootstrap` catalog conformance | §2 single-mp `<autoupdate>` always present |
| CMC-29 | `marketplace list` catalog conformance | §2 flat per-scope rows + sort |
| CMC-30 | `marketplace add` catalog conformance | §2 single-mp `(added)` + source-kind marker |
| CMC-31 | `marketplace remove` conditional form | §2 bare-row vs header form + reload+retry coexistence |
| CMC-32 | `marketplace update` autoupdate on-vs-off | §2 manifest-only vs cascade form |
| CMC-33 | `marketplace autoupdate enable\|disable` | §2 marker-as-outcome + `<no autoupdate>` carve-out |
| CMC-34 | Entity-shaped non-cascade errors + usage errors (MSG-NC-1..2) | §3.1 `EntityErrorRow` variant; usage-error sentence form unchanged |
| CMC-35 | ES-5 atomic three-file commit | §8 + §10 |

</phase_requirements>

## Summary

Phase 13 is a mechanically-bounded conformance refactor. CONTEXT.md has already locked the wave structure, the layered slicing decision, the cascading sub-wave ordering, the renderer-owns-grammar architecture (D-13-05), the per-row soft-dep predicate plumbing (D-13-07), the per-scope render-time folding (D-13-17..19), and the ES-5 atomic-commit positioning (D-13-03 / D-13-13). What remains is operational: surfacing the ~87 callsite inventory, walking every MSG-* rule against the proposed RowSpec, enumerating the per-command rendered states from `docs/output-catalog.md`, and writing the exact `no-restricted-imports` block and static-audit test that gate the cutover.

The Phase 12 foundation is in place and load-bearing: `shared/grammar/{status-tokens,reasons}.ts` exist with frontmatter-equal closed sets (14 + 23 entries); `presentation/reload-hint.ts` collapses to the single trailer; the four `notify*` wrappers are unchanged; `tests/architecture/grammar-frontmatter.test.ts` and `tests/architecture/markers-snapshot.test.ts` both pass against current `main`. Phase 12 left the reload-hint composer at `body\n${hint}` (single-newline), explicitly deferring the MSG-RH-1 "preceded by one blank line" change to Phase 13 -- the one-line `\n${hint}` → `\n\n${hint}` edit at `presentation/reload-hint.ts:56` is part of Wave 1.

**Primary recommendation:** Wave 1 lands six new `presentation/` modules (per D-13-15), the `RowSpec` discriminated union, an explicit `kind` discriminant for AST grep-ability and ESLint exhaustive-switch checking (departing slightly from the inferred-union codebase precedent for this single, broader union -- the union has ≥6 variants vs the existing `PluginRenderStatus`'s 3, and the discriminant materially helps Phase 14's drift guard), the `compareByNameThenScope` sort helper, the `cascadeSeverity` predicate, the `no-restricted-imports` rule, the `no-legacy-markers.test.ts` static-audit test, and the one-line MSG-RH-1 blank-line fix at `reload-hint.ts:56`. Sub-wave 2a then leads with `update` (richest grammar exercise: arrow-transitions + cascade severity + soft-dep per-row), 2b with `install` (richest single-shot exercise: rollback-partial + cause-chain + soft-dep + reload-hint), and 2c with `mp remove` first (most cross-cutting: conditional form + dual trailers). The Wave 3 UAT is a single new `tests/architecture/catalog-uat.test.ts` that parses ```text``` fenced blocks under each command H2 in `docs/output-catalog.md` and asserts byte-equal renderer output.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Compact-line token-order grammar | `presentation/compact-line.ts` | — | Single emission site; renderer owns MSG-GR-1..5 (D-13-05) |
| Per-row soft-dep predicate compute | `orchestrators/plugin/{list,install,update,reinstall}.ts` | `domain/resolver.ts` (manifest probe) | Orchestrator owns state-reads (D-06); pre-computes `declaresAgents` / `declaresMcp` |
| Companion-extension load probe | `orchestrators/edge-deps.ts` (existing) | `platform/pi-api.ts` (`hasLoadedPiSubagents/Mcp`) | Already orchestrator-owned; renderer receives as injected dependency |
| Cascade severity computation | `presentation/cascade-summary.ts` | — | Pure helper; orchestrator destructures + dispatches (D-13-08) |
| Orphan-fold computation | `orchestrators/plugin/list.ts` | — | State-read concern (D-13-19); renderer stays pure |
| ES-5 marker enforcement | ESLint `no-restricted-imports` + `tests/architecture/no-legacy-markers.test.ts` | — | Wave 2 gate (D-13-09); Wave 3 audit (D-13-12) |
| Catalog UAT byte-equality | `tests/architecture/catalog-uat.test.ts` | — | Wave 3 plan #1 gate (D-13-04) |
| Cause-chain depth-5 walk | `presentation/cause-chain.ts` | `shared/errors.ts` (Error.cause traversal) | New composer (D-13-15); replaces `formatErrorWithCauses`'s rendering shape |
| Compact-line sort | `presentation/sort.ts` (or named export of compact-line) | — | Single `compareByNameThenScope` helper (D-13-15) |

## Standard Stack

This is a pure internal TypeScript refactor on existing dependencies. No new runtime packages introduced.

### Core (unchanged from Phase 12 / `main`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=20.19.0` (per `package.json` engines) | Runtime | NFR-4. Native TS strip is on by default since 22.18 -- the test script uses `node --test "tests/**/*.test.ts"` directly without `tsx`. |
| TypeScript | strict (configured in `tsconfig.json`) | Language | NFR-7 + strictTypeChecked ESLint preset. `assertNever(x: never)` already exists at `shared/errors.ts:12` for exhaustive-switch checks. |
| ESLint | flat config 10.x | Linting | Already configured in `eslint.config.js`; v10 only supports flat config -- Wave 1 adds a new top-level config block. |
| `node:test` (built-in) | bundled | Test framework | Already used by `tests/architecture/*.test.ts` precedents. |

### Supporting (existing, used by Phase 13)

| Library / Module | Purpose | When to Use |
|------------------|---------|-------------|
| `shared/grammar/status-tokens.ts` | `StatusToken` literal union (14 entries) | Every `RowSpec` variant's `status` field type |
| `shared/grammar/reasons.ts` | `Reason` literal union (23 entries) | Every `RowSpec` variant's `reasons?: readonly Reason[]` field |
| `shared/errors.ts::assertNever` | Exhaustive-switch sentinel | Default branches in `RowSpec` discriminated switch |
| `orchestrators/edge-deps.ts` (existing) + `platform/pi-api.ts::hasLoadedPi{Subagents,McpAdapter}` | Companion-extension probe | Injected into renderer; renderer reads `(declares AND unloaded)` to decide marker emission |
| `presentation/reload-hint.ts::reloadHint` + `appendReloadHint` | Single canonical trailer | Coexists with recovery anchor on `mp remove` partial failure (MSG-RH-1 + CMC-15) |

### Alternatives Considered (and rejected per D-13-05 / D-13-15)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| `RowSpec` discriminated union | String-helper functions | Spreads MSG-GR-1 token order across N call sites; defeats D-13-05's single-emission-site goal |
| `RowSpec` discriminated union | Hybrid (helpers + payloads) | Same as above + harder for Phase 14 drift guard to target |
| Composer-internal `ctx.ui.notify` for cascade | Direct notify in composer | Violates D-07 single-callsite discipline (rejected by D-13-08) |
| Per-orchestrator severity computation | 5× duplicated MSG-SR-4..6 logic | Drift risk across 5 cascade surfaces (rejected by D-13-08) |
| State-mutation adoption on `mp add` | Re-key plugins to project on add | State growth + new invariants (rejected by D-13-17) |
| Renderer-side orphan fold | Renderer reads state | Violates D-11 layering (rejected by D-13-19) |

**Verified versions** (from `package.json` against npm registry on 2026-05-23):
- Node engine `>=20.19.0` -- still well below current Node LTS floor; no bump needed.
- No new dependencies to install.
- No `npm view` calls required (zero new packages).

## Package Legitimacy Audit

**Not applicable** -- Phase 13 introduces zero new external packages. The refactor uses only:
- Existing `dependencies` and `devDependencies` already locked by `package-lock.json` and verified during Phase 12.
- Node built-ins (`node:fs/promises`, `node:test`, `node:assert/strict`, `node:path`, `node:url`).

slopcheck protocol is therefore vacuously satisfied (no `npm install` line emitted by any Phase 13 plan).

## Architecture Patterns

### System Architecture Diagram

```text
                              ┌─────────────────────────────────┐
                              │   docs/messaging-style-guide.md │
                              │   (§2-§13 + §15 binding contract│
                              │    + YAML frontmatter sets)     │
                              └─────────┬───────────────────────┘
                                        │ reads (Phase 14 drift)
                                        │ reads (Wave 3 UAT extraction)
                                        ▼
       ┌────────────────────────────────────────────────────────────────┐
       │  CALLERS (orchestrators/{plugin,marketplace,import}/*.ts)       │
       │  -- construct RowSpec payloads from state; never format         │
       │  -- destructure {message, severity} from cascadeSummary()       │
       │  -- dispatch to notifySuccess / notifyWarning / notifyError     │
       └────────────────────────────┬───────────────────────────────────┘
                                    │ RowSpec / RowSpec[] / preformatted body
                                    ▼
       ┌────────────────────────────────────────────────────────────────┐
       │  COMPOSERS  (presentation/)                                     │
       │   compact-line.ts -------- renders one RowSpec → line           │
       │     ├── token order (MSG-GR-1), `@<mp>` carve-out (MSG-GR-2)    │
       │     ├── `[<scope>]` brackets, `<marker>` slot (MSG-GR-5)        │
       │     ├── `{reasons}` block (MSG-GR-4), icons (MSG-IC-1..3)       │
       │     └── per-row soft-dep injection (declares AND unloaded)     │
       │   cascade-summary.ts --- {marketplace, scope, rows} →            │
       │                          {message, severity}                    │
       │   manual-recovery.ts -- top-level `⊘ <res> (manual recovery)`   │
       │   rollback-partial.ts - parent `(failed){rollback partial}` +   │
       │                          indented children                     │
       │   cause-chain.ts ------ `cause: l1 -> l2 -> ... (truncated)`   │
       │                          depth-5 walk over Error.cause          │
       │   sort.ts ------------- compareByNameThenScope (MSG-GR-3)       │
       │   reload-hint.ts ------ single trailer (Phase 12; one blank     │
       │                          line fix in Wave 1)                   │
       └────────────────────────────┬───────────────────────────────────┘
                                    │ string body (+ optional severity)
                                    ▼
       ┌────────────────────────────────────────────────────────────────┐
       │  shared/notify.ts -- THE SOLE ctx.ui.notify call site (D-07)    │
       │   notifySuccess / notifyWarning / notifyError / notifyUsageError│
       └────────────────────────────┬───────────────────────────────────┘
                                    ▼
                              ctx.ui.notify(message, severity?)

                       ┌──── Cutover gates (Wave 1 + Wave 3) ────┐
                       │                                        │
   eslint.config.js ── │ Wave 1: no-restricted-imports block    │
   (D-13-09)           │   forbids 5 legacy markers everywhere  │
                       │   except shared/markers.ts + snapshot  │
                       │                                        │
   tests/architecture/ │ Wave 1: no-legacy-markers.test.ts      │
   no-legacy-markers   │   greps codebase for the 5 strings     │
   .test.ts            │   in non-test files outside markers.ts │
   (D-13-12)           │                                        │
                       │ Wave 3: catalog-uat.test.ts            │
   tests/architecture/ │   parses docs/output-catalog.md fenced │
   catalog-uat.test.ts │   blocks; asserts byte-equal renderer  │
   (D-13-04 plan #1)   │   output per command, per state        │
                       │                                        │
                       │ Wave 3 atomic commit:                  │
                       │   - DELETE 5 markers from markers.ts   │
                       │   - DELETE snapshot rows from          │
                       │     markers-snapshot.test.ts           │
                       │   - REWRITE PRD §6.12 to pointer       │
                       │   - DELETE ESLint rule entry           │
                       │   (single git commit)                  │
                       └────────────────────────────────────────┘
```

### Recommended Project Structure (post Wave 1)

```text
extensions/pi-claude-marketplace/presentation/
├── compact-line.ts       # NEW: RowSpec discriminated union + grammar-aware renderer
├── cascade-summary.ts    # NEW: cascadeSummary({mp, scope, rows}) → {message, severity}
├── manual-recovery.ts    # NEW: top-level (manual recovery) compact line composer
├── rollback-partial.ts   # NEW: parent + indented child composer
├── cause-chain.ts        # NEW: depth-5 Error.cause walk → "cause: l1 -> l2 -> ..."
├── sort.ts               # NEW: compareByNameThenScope (MSG-GR-3)
├── reload-hint.ts        # MODIFIED Wave 1: `\n${hint}` → `\n\n${hint}` (MSG-RH-1)
├── plugin-list.ts        # REWRITTEN sub-wave 2d: consume RowSpec model + orphan fold
├── marketplace-list.ts   # REWRITTEN sub-wave 2c: marketplace RowSpec
├── soft-dep.ts           # EVALUATED Wave 1: probably DELETE (re-export-only barrel);
│                         #   per-row markers replace aggregated trailer (CMC-12..13)
└── index.ts              # MODIFIED: barrel updated with 6 new exports

tests/architecture/
├── no-legacy-markers.test.ts   # NEW Wave 1 (D-13-12)
└── catalog-uat.test.ts         # NEW Wave 3 plan #1 (D-13-04)
```

### Pattern 1: RowSpec discriminated union with explicit `kind`

**What:** A tagged union of 6+ variants (`PluginRow`, `MarketplaceRow`, `EmptyToken`, `ManualRecoveryLine`, `RollbackChild`, `EntityErrorRow`), discriminated by a `kind` literal field. Exhaustive switch in the renderer is enforced by `assertNever`.

**When to use:** Every emission path from `orchestrators/` to `presentation/compact-line.ts::renderRow`.

**Recommended discriminant:** **explicit `kind`**. The current `presentation/plugin-list.ts:45` uses an inferred-union (`PluginRenderStatus = "installed" | "available" | "uninstallable"`) with 3 variants and no extra fields per variant. Phase 13's union has 6+ variants and meaningful per-variant fields (e.g., only `PluginRow` has `marketplace?`, only `MarketplaceRow` has `marker?`, only `RollbackChild` has `phaseLabel`). An explicit `kind` field gives the planner (a) grep-ability for Phase 14's drift guard, (b) cleaner narrowing for the renderer's main `switch`, and (c) makes the `RowSpec.kind === 'plugin'` predicate Phase 13's catalog UAT can use to slice payloads per command. Codebase precedent for tagged unions: `orchestrators/types.ts:39-42` (`ReinstallPluginOutcome` discriminated by `partition`). Adopting `kind` rather than `partition` distinguishes RowSpec from the orchestrator-internal partition tags.

**Example:**

```typescript
// Source: synthesized from D-13-05/06/07 + docs/output-catalog.md per-command sections.
// See presentation/plugin-list.ts:45 (codebase precedent) and orchestrators/types.ts:39 (tag-union precedent).

import type { StatusToken } from "../shared/grammar/status-tokens.ts";
import type { Reason } from "../shared/grammar/reasons.ts";

export type Scope = "user" | "project";

/** Plugin row in single-plugin form (install / uninstall / bootstrap output). */
export interface PluginInlineRow {
  readonly kind: "plugin-inline";
  readonly name: string;
  readonly marketplace: string;       // Always present (MSG-GR-2 inline form)
  readonly scope: Scope;
  readonly version?: string;          // v<ver> or "v<from> → v<to>" (MSG-PL-2/3)
  readonly status: Extract<StatusToken,
    "installed" | "updated" | "uninstalled" | "failed" | "rollback failed" | "unavailable">;
  readonly reasons?: readonly Reason[];
  // Per-row soft-dep predicates (D-13-07). Renderer probes companion-loaded state
  // and emits `requires pi-{subagents,mcp}` iff (declares AND unloaded).
  // NOTE: structurally absent on `(uninstalled)` variants -- see PluginInlineUninstalledRow below.
  readonly declaresAgents?: boolean;
  readonly declaresMcp?: boolean;
}

/** Plugin row inside a marketplace-headed cascade (update / reinstall / import / mp remove children). */
export interface PluginCascadeRow {
  readonly kind: "plugin-cascade";
  readonly name: string;
  // No `marketplace` field -- inherited from cascade header per MSG-GR-2.
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<StatusToken,
    "installed" | "updated" | "uninstalled" | "skipped" | "failed" | "available" | "unavailable" | "upgradable">;
  readonly reasons?: readonly Reason[];
  readonly declaresAgents?: boolean;
  readonly declaresMcp?: boolean;
}

/** Plugin row in list rendering -- adds the MSG-PL-6 `(available)/(unavailable)` scope-bracket carve-out. */
export interface PluginListRow {
  readonly kind: "plugin-list";
  readonly name: string;
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<StatusToken,
    "installed" | "upgradable" | "available" | "unavailable">; // (upgradable) is list-only per MSG-PL-4
  readonly reasons?: readonly Reason[];
  readonly description?: string;     // PL-4 / MSG-PL-1, truncated at col 66
  readonly declaresAgents?: boolean;
  readonly declaresMcp?: boolean;
  // MSG-PL-6 carve-out is structural: when status === 'available' | 'unavailable',
  // the renderer omits the scope bracket on the list surface only.
}

/** Marketplace row / header. */
export interface MarketplaceRow {
  readonly kind: "marketplace";
  readonly name: string;
  readonly scope: Scope;
  readonly marker?: "autoupdate" | "no autoupdate"; // MSG-GR-5 closed set
  readonly status?: Extract<StatusToken,
    "added" | "removed" | "updated" | "skipped" | "failed">; // Optional: omitted on plugin-list pure label headers
  readonly reasons?: readonly Reason[];
  readonly outcomeClass: "ok" | "failure";   // Drives MSG-IC-3 marketplace icon (●/⊘)
}

/** `(no plugins)` / `(no marketplaces)` bare-token line. */
export interface EmptyToken {
  readonly kind: "empty";
  readonly token: Extract<StatusToken, "no marketplaces" | "no plugins">;
}

/** System-level manual-recovery line (MSG-MR-1/2). */
export interface ManualRecoveryLine {
  readonly kind: "manual-recovery";
  readonly resource: string;               // e.g. "agent index", "state.json"
  readonly reasons: readonly Reason[];     // Required: `(manual recovery)` always carries reason
  readonly orphanDetails?: readonly string[]; // Indented child rows (free-form per §18.2)
}

/** Indented child row beneath a `(failed) {rollback partial}` parent (MSG-RP-1). */
export interface RollbackChild {
  readonly kind: "rollback-child";
  readonly phaseLabel: string;             // e.g. "agents staging", "mcp"
  readonly status: Extract<StatusToken, "failed" | "rollback failed">;
  readonly reasons: readonly Reason[];
}

/** Entity-shaped non-cascade error (MSG-NC-1, CMC-34). */
export interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly Reason[];
}

/** The complete union. */
export type RowSpec =
  | PluginInlineRow
  | PluginCascadeRow
  | PluginListRow
  | MarketplaceRow
  | EmptyToken
  | ManualRecoveryLine
  | RollbackChild
  | EntityErrorRow;

// Exhaustive switch enforced via assertNever (shared/errors.ts:12).
export function renderRow(row: RowSpec, edgeDeps: SoftDepProbe): string {
  switch (row.kind) {
    case "plugin-inline": return renderPluginInline(row, edgeDeps);
    case "plugin-cascade": return renderPluginCascade(row, edgeDeps);
    case "plugin-list": return renderPluginList(row, edgeDeps);
    case "marketplace": return renderMarketplace(row);
    case "empty": return renderEmpty(row);
    case "manual-recovery": return renderManualRecovery(row);
    case "rollback-child": return renderRollbackChild(row);
    case "entity-error": return renderEntityError(row);
    default: return assertNever(row);
  }
}
```

**MSG-SD-3 structural enforcement** (per D-13-07): note that `PluginInlineRow.status` does NOT include `"uninstalled"` in its `Extract<>` set. The catalog at line 327 emits `○ helper@official [user] v1.0.0 (uninstalled)` -- this is a separate variant. Recommend either splitting into `PluginInlineUninstalledRow` (without `declaresAgents/Mcp` fields, so the marker cannot structurally be emitted) or excluding `declaresAgents/Mcp` in the renderer when `status === "uninstalled"`. **Recommend split** -- the type system then forbids the misuse, matching the D-13-07 intent. See §5.1 for the full plumbing.

### Pattern 2: Render-time orphan fold (D-13-17..19)

**What:** `orchestrators/plugin/list.ts` reads both scopes' state, computes a `PluginListPayload` where project-scoped orphan plugins are nested under the matching user-scope marketplace block.

**When to use:** Sub-wave 2d (`/claude:plugin list`) only.

**Example:**

```typescript
// Source: synthesized from D-13-17..19 + docs/output-catalog.md §"Project-scope plugins folded ..."
// (lines 205-213) and the existing renderPluginList signature at presentation/plugin-list.ts:131.

export interface PluginListPayload {
  readonly marketplaceBlocks: readonly PluginListMarketplaceBlock[];
}

export interface PluginListMarketplaceBlock {
  readonly header: MarketplaceRow;        // From the RowSpec union (kind: "marketplace")
  readonly plugins: readonly (PluginListRow | EmptyToken)[]; // EmptyToken when zero plugins
}

// Orchestrator builds the payload (orchestrators/plugin/list.ts):
async function buildListPayload(cwd: string): Promise<PluginListPayload> {
  const [userState, projectState] = await Promise.all([
    loadState(locationsFor("user", cwd).extensionRoot),
    loadState(locationsFor("project", cwd).extensionRoot),
  ]);

  const blocks: PluginListMarketplaceBlock[] = [];

  // Project-scope marketplaces and their installed plugins.
  for (const [name, record] of Object.entries(projectState.marketplaces)) {
    blocks.push(buildBlock(name, "project", record, /* fold */ []));
  }

  // For user-scope marketplaces, FOLD orphan project plugins whose marketplace
  // does NOT exist in project scope (D-13-17).
  for (const [name, record] of Object.entries(userState.marketplaces)) {
    const projectOrphans = name in projectState.marketplaces
      ? []
      : Object.entries(projectState.marketplaces[name]?.plugins ?? {})
          .map(([plug, inst]) => buildOrphanRow(plug, inst, "project"));
    blocks.push(buildBlock(name, "user", record, projectOrphans));
  }

  // Sort blocks by MSG-GR-3 (name primary, project before user tie-breaker).
  return { marketplaceBlocks: blocks.sort(compareByNameThenScope) };
}
```

The fold logic is ~30 lines and lives entirely in `orchestrators/plugin/list.ts`. The renderer at `presentation/plugin-list.ts` consumes the assembled payload and never reads state. Adoption is automatic on the next list render after `marketplace add` -- the project-scope marketplace record now exists, so the fold rule no longer triggers (D-13-17 zero-state-mutation contract).

### Anti-Patterns to Avoid

- **Hand-formatting compact lines in orchestrators.** D-13-05 explicitly rejects this. Always construct a `RowSpec` and route through `renderRow`. The catalog UAT will catch any drift.
- **Renderer reads state.** Violates D-06 + D-11. The renderer takes a `SoftDepProbe` injected dependency (calls `hasLoadedPiSubagents(pi)` / `hasLoadedPiMcpAdapter(pi)`); it does NOT call `loadState` or `loadManifest`.
- **Composer-internal `notify`.** D-13-08. `cascadeSummary` returns `{message, severity}` -- the orchestrator dispatches.
- **State mutation on `marketplace add` to adopt project plugins.** D-13-17 rejects this. Adoption is render-time only.
- **Embedding `<no autoupdate>` outside `marketplace autoupdate disable`.** MSG-GR-5 reserves this token to a single surface. The renderer enforces structurally (only `MarketplaceRow.marker = "no autoupdate"` is emitted; orchestrators set it only on the `autoupdate disable` outcome).
- **Aggregated soft-dep trailer.** The existing `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` pattern (e.g., `orchestrators/plugin/install.ts:659-660`) is retired in favor of per-row markers (D-13-07). Wave 1 evaluates whether `presentation/soft-dep.ts` becomes vestigial (likely yes; it currently only re-exports from `platform/pi-api.ts`).
- **Single-newline reload-hint join.** Phase 12 left `appendReloadHint` at `body\n${hint}`; MSG-RH-1 requires a blank line above. Wave 1 changes `presentation/reload-hint.ts:56` to `body\n\n${hint}`. This is a Phase 13 user-visible change, but it conforms to a Phase 12 carve-out (D-CMC-10 already authorized the reload-hint surface change envelope).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-row reasons join | New `joinReasons(reasons[])` per-callsite | `renderRow` handles `{reason1, reason2}` formatting once | MSG-GR-4 carve-outs (manifest field names verbatim) live in one place |
| Cause-chain depth-5 walk | New iterative walker | Reshape existing `formatErrorWithCauses` (`orchestrators/marketplace/shared.ts:453`) -- it already does depth-5 with cycle detection | The walker is correct; only the join string needs to change. Move it to `presentation/cause-chain.ts` and reuse the loop. |
| Sort comparator | Inline `.sort()` per surface | `compareByNameThenScope(a, b)` from `presentation/sort.ts` | MSG-GR-3 specifies `localeCompare` with `sensitivity: 'base'` + project-before-user; spreading this across surfaces invites drift |
| Catalog example extraction | Hand-list each example in test code | Parse fenced ```text``` blocks under each H2 in `docs/output-catalog.md` | The catalog is the binding contract; replicating examples in code violates D-30 (catalog is the source of truth) |
| ESLint rule for marker imports | Custom plugin / AST walker | `no-restricted-imports` with `paths[].importNames` (built-in) | The built-in rule supports exactly this case; verified against ESLint flat-config docs |
| Static-audit grep | Custom shell pipe | `tests/architecture/no-legacy-markers.test.ts` (precedent: `no-orchestrator-network.test.ts`) | Per-file scan with comment stripping; runs under `npm run check` |
| YAML frontmatter parsing | Add `yaml` dep | Hand-rolled regex extractor (precedent: `grammar-frontmatter.test.ts:36-60`) | Phase 12 deliberately rejected a YAML dep; same rationale applies in Wave 3 if catalog UAT needs frontmatter access (which it doesn't -- it parses fenced blocks). |

**Key insight:** Phase 12 already built most of the primitives Phase 13 needs (closed sets + reload-hint composer + `assertNever`). The depth-5 cause walker exists. The static-audit test pattern exists. The drift-guard precedent exists. Phase 13 is recombination + rewriting, not invention.

## Runtime State Inventory

> Phase 13 is not a rename/refactor of stored state. The conformance refactor touches **emission text only** -- no stored data carries the legacy ES-5 strings as identifiers. Nevertheless, the inventory below is filled out per the GSD agent protocol so reviewers can confirm zero state-migration burden.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** `state.json` stores plugin/marketplace records (name, version, scope, autoupdate, source path, ...); the 5 ES-5 strings are emission-only, never written to state. Verified by grep: `grep -rE "(PI_SUBAGENTS_NOT_LOADED|PI_MCP_ADAPTER_NOT_LOADED|RELOAD_HINT_PREFIX\|MANUAL_RECOVERY_REQUIRED\|ROLLBACK_PARTIAL)" extensions/pi-claude-marketplace/persistence/` returns zero hits in `persistence/`. | None |
| Live service config | **None.** This extension has no external service config -- the marketplace-cache and state-lock files are managed by the extension itself, both keyed by scope-derived paths (`~/.pi/agent/pi-claude-marketplace/...`), not by emission strings. | None |
| OS-registered state | **None.** No Windows Task Scheduler, no systemd, no launchd, no cron, no pm2. | None |
| Secrets/env vars | **None.** The only env var the extension reads is `PI_CODING_AGENT_DIR` (locations resolver). Phase 13 does not change env vars. | None |
| Build artifacts | **None.** No egg-info, no compiled binaries. `npm run build` is unused; the extension ships as TS source loaded by `pi-coding-agent` with native TS strip on Node 22.18+. After the ESLint config edit in Wave 1, `npm install` will not need to re-run -- the config file is read directly by ESLint. | None |

**The canonical question:** After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered? **Answer: nothing.** The ES-5 strings are emission-only. The Wave 3 atomic commit deletes them from source; no migration is required for any installed Pi user's state.

## Common Pitfalls

### Pitfall 1: MSG-RH-1 blank-line discipline regression

**What goes wrong:** Phase 12 deliberately left `appendReloadHint` at `body\n${hint}` (single newline). If Wave 1 forgets the one-line fix at `presentation/reload-hint.ts:56`, every reload-hint emission emerges without the mandatory blank line, breaking byte-equality vs the catalog (which shows a blank line before every `/reload to pick up changes`).
**Why it happens:** D-CMC-06 deferred the change with a TODO comment; if the planner skims past the TODO, Wave 1 ships without the fix.
**How to avoid:** Wave 1 plan must call out `presentation/reload-hint.ts:56` explicitly. The catalog UAT in Wave 3 catches it -- but it's faster to fix at primitive-land time.
**Warning signs:** Catalog UAT diff shows missing `\n` before every `/reload to pick up changes` instance.

### Pitfall 2: ESLint rule allow-list path matching

**What goes wrong:** ESLint flat-config `files` globs use minimatch semantics. If the allow-list block uses `files: ["tests/architecture/markers-snapshot.test.ts"]` but the test sits at `tests/architecture/markers-snapshot.test.ts` -- this works. But if the planner writes `files: ["**/markers-snapshot.test.ts"]` it also works. The pitfall is using **paths**: with the rule (instead of allow-list ignore in a follow-up config block) -- you can't allow a path inside paths array.
**Why it happens:** `no-restricted-imports.paths[]` is per-rule; you can't combine "forbid in X but allow in Y" inside a single rule entry. The flat-config pattern is **two config blocks**: one with the rule applied broadly, then a second block with `files: [<allowlist>]` and either `"no-restricted-imports": "off"` or no override for that path.
**How to avoid:** Mirror Phase 12's BLOCK B pattern (`shared/notify.ts` allow-list at `eslint.config.js:134-141`). Use two config blocks; the second `files: ["extensions/pi-claude-marketplace/shared/markers.ts", "tests/architecture/markers-snapshot.test.ts"]` with `"no-restricted-imports": "off"`.
**Warning signs:** `npm run check` fails on the snapshot test file's import of `markers.ts`.

### Pitfall 3: `formatErrorWithCauses` join-string drift

**What goes wrong:** The existing helper at `orchestrators/marketplace/shared.ts:453` joins with ` -- caused by: ` (catalog uses ` -> `). If Wave 1 only relocates the helper to `presentation/cause-chain.ts` without changing the join string, every cause-chain emission produces non-conformant output.
**Why it happens:** The depth-5 walk logic is correct; the easy mistake is "move file, ship." The catalog forms (`cause: link1 -> link2`) differ from today (`<message> -- caused by: <cause>`).
**How to avoid:** The new composer at `presentation/cause-chain.ts` must rebuild the body: prefix `cause: `, join with ` -> ` (space-arrow-space), depth-5 with `(truncated)` suffix on the last link. The legacy helper at `orchestrators/marketplace/shared.ts:453` is **deleted** in Wave 1 once all callers route through the new composer; today's callers (5 sites) destination-rewrite to take the composer's body directly.
**Warning signs:** Catalog UAT shows ` -- caused by: ` in renderer output where ` -> ` is expected.

### Pitfall 4: Per-row soft-dep predicate computation

**What goes wrong:** D-13-07 says the orchestrator computes `declaresAgents` / `declaresMcp` from the plugin's manifest. For `list` rendering, the manifest may not have been read for `(available)` rows -- the existing `orchestrators/edge-deps.ts::loadManifestForMarketplace` walks the manifest but returns only `name/status/version` (no `declaresAgents/Mcp`). Wave 1 must extend the manifest-derived payload to carry these predicates.
**Why it happens:** The current list orchestrator separates "is installable" (computed by `domain/resolver.ts::resolveStrict`) from "is installed" (state lookup). For `(available)` rows, `resolveStrict` already knows whether the plugin declares agents / MCP servers -- but that knowledge isn't propagated to the renderer payload.
**How to avoid:** Wave 1 extends `domain/resolver.ts`'s output (or the `orchestrators/plugin/list.ts` payload it constructs) to carry `declaresAgents` / `declaresMcp` for every row. Easier: the resolved manifest entry already has `agents` and `mcp` fields -- expose them booleanwise on the row payload.
**Warning signs:** Catalog UAT shows missing `{requires pi-subagents}` on `(available)` rows when the plugin declares agents and the companion is unloaded.

### Pitfall 5: `localeCompare` Unicode normalization

**What goes wrong:** MSG-GR-3 specifies `localeCompare(b, undefined, { sensitivity: 'base' })`. This treats `Café` and `cafe` as equal AND `Café` (NFC) and `Café` (NFD) as equal. The risk: if two plugin names differ only by Unicode normalization form, the sort comparator returns 0 -- a "stable" sort still leaves them in input order, but two records with the same `localeCompare` key may render in a non-deterministic order across runs.
**Why it happens:** Project rarely surfaces non-ASCII plugin names today, but the catalog UAT may include Unicode test fixtures or upstream marketplace names may evolve.
**How to avoid:** The catalog UAT examples are ASCII-only; no immediate risk. Plan-level note: the sort comparator should fall through to a deterministic tie-breaker beyond name+scope. Recommended: `(a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || (a.scope === b.scope ? 0 : a.scope === 'project' ? -1 : 1)`. If two rows have identical (name, scope) lower-cased, they're a duplicate -- a state-integrity issue, not a sort issue.
**Warning signs:** None likely in v1.3; flag for Phase 14 drift guard to assert.

### Pitfall 6: `markers-snapshot.test.ts` prefix-extraction shape

**What goes wrong:** The existing snapshot test at `tests/architecture/markers-snapshot.test.ts:42-72` extracts everything-before-the-first-`<` / `[` / `…` from each PRD §6.12 literal and asserts byte-equality against the `markers.ts` constant. The atomic Wave 3 commit deletes both the markers AND the snapshot rows AND rewrites PRD §6.12 to a pointer -- the test continues to pass on the **remaining** rows (none for ES-5, but `RECOVERY_PLUGIN_REINSTALL_PREFIX` and `STATE_LOCK_HELD_PREFIX` stay).
**Why it happens:** The snapshot test asserts `literals.length === 5`. After the atomic commit, PRD §6.12 has zero ES-5 literals (replaced with a pointer to style guide §15). The `assert.equal(literals.length, 5, ...)` will FAIL.
**How to avoid:** Wave 3's atomic commit edits the snapshot test in the same commit to drop the `length === 5` assertion and the 5-element `expected` array. The remaining snapshot assertions for `RECOVERY_PLUGIN_REINSTALL_PREFIX` and `STATE_LOCK_HELD_PREFIX` live in **separate test cases** in the same file (see `markers-snapshot.test.ts` body for the additional `test(...)` blocks). Verify with `grep -c "^test(" tests/architecture/markers-snapshot.test.ts` -- expect ≥3 tests; the ES-5 specific one is removed wholesale.
**Warning signs:** Post-commit `npm run check` failure with `Expected 5 backtick-quoted ES-5 markers in PRD §6.12, found 0`.

### Pitfall 7: Catalog UAT extraction shape

**What goes wrong:** The catalog uses ```` ```text ```` fenced blocks. A naive regex `/```text\n([\s\S]*?)```/g` extracts every fenced block in the file -- including the Conventions section's example block at line 42-46 (`<icon> <marketplace> [<scope>] ...`). That's a grammar template, not a renderer-output example.
**Why it happens:** The catalog mixes documentation templates with concrete renderer-output examples in the same fence style.
**How to avoid:** Anchor extraction to the per-command sections. Walk H2 boundaries (`/^## /`) and parse fenced blocks within each command section, attaching the section's H3 (or implicit "Default") as the state-label. Templates in the Conventions section are extracted but ignored because they don't have a parent H2 command name. The test's expected map is keyed by `${command}::${state}`.
**Warning signs:** UAT fails because it tries to assert a renderer output against the literal text `<icon> <marketplace> [<scope>]`.

### Pitfall 8: `(unavailable)` scope-bracket carve-out (MSG-PL-6)

**What goes wrong:** The list surface omits `[<scope>]` on `(available)` and `(unavailable)` rows. Every OTHER surface (install / reinstall / import / update) keeps the bracket on `(unavailable)`. The catalog states this explicitly (lines 145-153 status-token reference). If a single renderer path treats `(unavailable)` identically across surfaces, byte-equality breaks.
**Why it happens:** Easy to encode "no bracket on `(available)` / `(unavailable)`" as a single rule applied at the renderer's `MarketplaceRow` / `PluginListRow` switch. It must be conditional on `kind === "plugin-list"`.
**How to avoid:** Use the `kind` discriminant: `PluginListRow` strips the scope bracket when `status === "available" || status === "unavailable"`; `PluginCascadeRow` and `PluginInlineRow` always render the bracket. The catalog UAT plus the structural typing both guard this.
**Warning signs:** UAT shows `⊘ helper@official (failed) {hooks, lspServers}` when `[user]` is expected.

### Pitfall 9: Reinstall partition's `(reinstalled)` token

**What goes wrong:** CMC-08 was reconciled in Phase 12 to drop the `+reinstalled` clause -- the closed `STATUS_TOKENS` set has 14 entries and **does not include** `reinstalled`. The catalog at line 147 lists `(reinstalled)` as a status token rendered on reinstall cascade rows. The two appear to contradict.
**Why it happens:** Phase 12 (`shared/grammar/status-tokens.ts:31-36`) confirms `(reinstalled)` is **not** a separate token: "the cascade-kind discriminant at `orchestrators/types.ts:12` (`ReinstallPluginPartition`) is an internal partition kind never rendered as a parenthesised status token." But the catalog shows `(reinstalled)` rendered on rows.
**How to avoid:** **Surface the contradiction to the planner.** Either (a) the catalog is wrong and the renderer emits `(installed)` on reinstalled rows (the plugin IS installed after reinstall -- effective-state rule), OR (b) Phase 12's CMC-08 reconciliation needs adjustment to add `reinstalled` to the closed set. **My read:** the catalog's `(reinstalled)` matches the operator's mental model ("the operation that just ran") -- option (b) is correct, and `shared/grammar/status-tokens.ts` should be extended in Wave 1 with `"reinstalled"` (which would also require `docs/messaging-style-guide.md` frontmatter to add `reinstalled` so the drift test stays green). **This is a discrepancy the planner must explicitly resolve in PLAN.md and possibly escalate to discuss-phase before Wave 1 begins.**
**Warning signs:** Catalog UAT fails on every reinstall cascade because `(installed)` is rendered where `(reinstalled)` is expected. Conversely, if `(reinstalled)` is added to STATUS_TOKENS without a frontmatter update, `grammar-frontmatter.test.ts` fails.

### Pitfall 10: TS `strictTypeChecked` + `assertNever` exhaustive switch

**What goes wrong:** The renderer's main switch must handle every `RowSpec.kind`. If a new variant is added without updating the switch, TypeScript may not catch it (depending on whether the union explicitly lists `kind` literals and `assertNever` is invoked).
**Why it happens:** With explicit `kind` literals + `assertNever(x: never)`, TS narrows the switch and the `default` branch fires `Type 'X' is not assignable to type 'never'` if a case is missing. This is THE pattern at `shared/errors.ts:12`. The pitfall is forgetting the `default: return assertNever(row);` branch.
**How to avoid:** Every `switch (row.kind)` in `presentation/compact-line.ts` includes `default: return assertNever(row);`. The ESLint preset `tseslint.configs.strictTypeChecked` plus the existing `@typescript-eslint/switch-exhaustiveness-check` rule (verify Wave 1 if not already enabled) catches missing cases at lint time.
**Warning signs:** TS compile error mentioning `Argument of type '...' is not assignable to parameter of type 'never'`.

## Code Examples

### Cause-chain depth-5 walk (D-13-15 / MSG-CC-1)

```typescript
// Source: rebuild of orchestrators/marketplace/shared.ts:453-478 with MSG-CC-1 wording.
// presentation/cause-chain.ts -- NEW Wave 1 module.

const TRUNCATED_SUFFIX = " (truncated)";

/**
 * Walk an Error.cause chain to depth 5 and render the MSG-CC-1 trailer:
 *
 *   cause: <link1> -> <link2> -> ... [(truncated)]
 *
 * Lowercase `cause:`, space-arrow-space joiner per MSG-CC-1.
 * Returns "" when no chained cause is present (caller omits the trailer).
 */
export function causeChainTrailer(err: unknown): string {
  if (err === undefined || err === null) {
    return "";
  }
  const links: string[] = [];
  let current: unknown = err;
  const MAX_DEPTH = 5;
  let depth = 0;
  let truncated = false;
  while (current !== undefined && current !== null) {
    if (depth >= MAX_DEPTH) {
      truncated = true;
      break;
    }
    links.push(linkMessage(current));
    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
      depth++;
    } else {
      break;
    }
  }
  if (links.length === 0) {
    return "";
  }
  if (truncated) {
    links[links.length - 1] = `${links[links.length - 1]}${TRUNCATED_SUFFIX}`;
  }
  return `cause: ${links.join(" -> ")}`;
}

function linkMessage(c: unknown): string {
  if (c instanceof Error) return c.message;
  if (typeof c === "string") return c;
  return Object.prototype.toString.call(c);
}
```

**Notes:**
- Cycle detection retained from `orchestrators/marketplace/shared.ts:462` (`current.cause !== current`).
- Non-`Error` causes handled identically to the existing helper (string / fallback).
- Existing `formatErrorWithCauses` is deleted; its 5 callers (`orchestrators/plugin/{install,uninstall,update,reinstall}.ts`, `orchestrators/marketplace/{remove,update}.ts`, `orchestrators/import/execute.ts`) migrate to either: (a) `notifyError` carrying `error.message` and letting `cause-chain.ts` append the trailer once at notify time, OR (b) renderer-internal composition. **Recommended:** keep callers passing the bare `err` to `notifyError`; rewrite `notifyError` to compose `${message}\n\n${causeChainTrailer(cause)}` when the cause carries a chain. This consolidates the trailer's emission to a single site (D-CMC-12's Phase 13 work).

### `no-restricted-imports` rule block (D-13-09)

```javascript
// Source: ESLint 10 flat-config (eslint.config.js), modeled after the existing
// BLOCK B at line 134-141 (per-file override pattern) and BLOCK E at line 263-278
// (`no-restricted-imports` for Pi peer-imports). Verified syntactically against
// ESLint docs (web fetch 2026-05-23).

// Wave 1 inserts this as a new top-level config block in eslint.config.js,
// AFTER BLOCK E (Pi peer-imports), BEFORE BLOCK D (test fixtures override).

{
  // BLOCK F (D-13-09): legacy ES-5 marker imports forbidden during Wave 2.
  // The 5 legacy strings stay exported from shared/markers.ts so the
  // markers-snapshot.test.ts assertion keeps passing, but no production
  // callsite may import them. Wave 3 atomic commit deletes the exports
  // AND this entire block.
  files: ["extensions/pi-claude-marketplace/**/*.ts", "tests/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/shared/markers.ts",
    "tests/architecture/markers-snapshot.test.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        // Note: this block is ADDITIVE -- BLOCK E (Pi peer-imports) declares its
        // own `no-restricted-imports` for "@earendil-works/pi-coding-agent" with
        // its own `ignores`. ESLint flat-config merges per-file by applying each
        // matching block in order, with later blocks overriding earlier ones for
        // the SAME rule. Per-rule, the `paths[]` array DOES NOT merge -- the
        // later config block's `paths[]` REPLACES the earlier one. Therefore
        // BLOCK F's `paths[]` MUST include BOTH the Pi peer-import restriction
        // AND the 5 marker restrictions, OR BLOCK E must be restructured to
        // share the rule entry with BLOCK F.
        //
        // RECOMMENDED: keep BLOCK E unchanged (its `ignores` already excludes
        // platform/pi-api.ts). Define BLOCK F with a DIFFERENT rule ID --
        // but `no-restricted-imports` is a single ESLint rule. So either:
        //   (a) Add the Pi peer-import entry to this `paths[]` AND keep the
        //       `ignores` union of "platform/pi-api.ts" + the markers exception.
        //   (b) Use the `patterns` form (which can co-exist with `paths`) for
        //       the marker restriction -- patterns and paths are independent
        //       arrays inside the same options object.
        // Option (b) is cleaner but harder to scope to specific named imports.
        //
        // SIMPLEST: merge into BLOCK E's entry (one rule definition with both
        // restrictions); apply both `ignores` together. Below shows the merged
        // form; Wave 1 plan should edit BLOCK E rather than adding a separate
        // BLOCK F.
        paths: [
          // Existing BLOCK E entry (preserved):
          {
            name: "@earendil-works/pi-coding-agent",
            message:
              "Import Pi API types from extensions/pi-claude-marketplace/platform/pi-api.ts instead.",
          },
          // NEW Wave 1 D-13-09 entries:
          {
            name: "../shared/markers.ts",
            importNames: [
              "PI_SUBAGENTS_NOT_LOADED",
              "PI_MCP_ADAPTER_NOT_LOADED",
              "RELOAD_HINT_PREFIX",
              "MANUAL_RECOVERY_REQUIRED",
              "ROLLBACK_PARTIAL",
            ],
            message:
              "Legacy ES-5 marker strings are import-forbidden during Wave 2 (D-13-09); use the new presentation/ composers. The Wave 3 atomic commit deletes these exports.",
          },
          // Also block the relative path one level shallower, for callers in
          // orchestrators/.../subdir/ that import from "../../shared/markers.ts":
          {
            name: "../../shared/markers.ts",
            importNames: [
              "PI_SUBAGENTS_NOT_LOADED",
              "PI_MCP_ADAPTER_NOT_LOADED",
              "RELOAD_HINT_PREFIX",
              "MANUAL_RECOVERY_REQUIRED",
              "ROLLBACK_PARTIAL",
            ],
            message:
              "Legacy ES-5 marker strings are import-forbidden during Wave 2 (D-13-09); use the new presentation/ composers.",
          },
          // And the path used from tests/:
          {
            name: "../../extensions/pi-claude-marketplace/shared/markers.ts",
            importNames: [
              "PI_SUBAGENTS_NOT_LOADED",
              "PI_MCP_ADAPTER_NOT_LOADED",
              "RELOAD_HINT_PREFIX",
              "MANUAL_RECOVERY_REQUIRED",
              "ROLLBACK_PARTIAL",
            ],
            message: "Legacy ES-5 markers (D-13-09); allow-listed only in markers-snapshot.test.ts.",
          },
        ],
      },
    ],
  },
}
```

**Path-list note:** `no-restricted-imports.paths[].name` is a **path string match**, not a module specifier resolver. ESLint matches the literal import specifier as written. The codebase uses relative paths (`../shared/markers.ts`, `../../shared/markers.ts`), so the rule must enumerate every relative-path form used in the codebase. **Recommended simplification:** use the `patterns` array with a regex/glob instead, e.g. `patterns: [{ group: ["**/shared/markers"], importNames: [...] }]`. The `patterns` form supports glob matching on the import specifier; the `paths` form requires exact-string. The planner should benchmark both forms during Wave 1 and pick whichever lints cleanly across all 87 current callsites.

**Allow-list correctness:** The `ignores` array at the config-block level disables ALL rules in that block for matching files. To allow-list only `no-restricted-imports`, the planner can either (a) put the `ignores` at block level (disables the rule entirely for those files -- fine because the snapshot test is the only consumer), or (b) use a follow-on block targeting only those files with `"no-restricted-imports": "off"`. Phase 12 precedent is (b) -- BLOCK B turns off `no-restricted-syntax` AND `no-console` for `shared/notify.ts`. Same pattern works here.

### Static-audit test (D-13-12)

```typescript
// Source: synthesized from tests/architecture/no-orchestrator-network.test.ts (precedent),
// tests/architecture/grammar-frontmatter.test.ts (precedent), and CONTEXT.md D-13-12.
// tests/architecture/no-legacy-markers.test.ts -- NEW Wave 1.

import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * D-13-12 / CMC-35 static audit: the 5 legacy ES-5 marker strings MUST NOT
 * appear in any non-test source file outside shared/markers.ts.
 *
 * Strings are pinned LITERALLY in this test (not imported from markers.ts) so
 * the Wave 3 atomic commit can delete markers.ts's exports while this test
 * keeps gating re-introductions.
 */
const LEGACY_MARKER_STRINGS: ReadonlyArray<string> = [
  "pi-subagents is not loaded; ",
  "pi-mcp-adapter is not loaded; ",
  "Run /reload to ",
  "MANUAL RECOVERY REQUIRED: ",
  "(rollback partial: ",
];

const ALLOW_LIST = new Set<string>([
  "extensions/pi-claude-marketplace/shared/markers.ts",         // Until Wave 3 commit
  "tests/architecture/markers-snapshot.test.ts",                // Snapshot test
  "tests/architecture/no-legacy-markers.test.ts",               // This test pins literals
  "docs/prd/pi-claude-marketplace-prd.md",                      // Wave 3 commit rewrites
  "docs/messaging-style-guide.md",                              // §15 reproduces them
]);

const SCAN_ROOTS: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace",
  "tests",
];

async function* walkTs(root: string): AsyncIterable<string> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walkTs(full);
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".js"))) {
      yield full;
    }
  }
}

test("D-13-12 / CMC-35: legacy ES-5 marker strings absent from non-allow-listed sources", async () => {
  const offenders: Array<{ file: string; marker: string }> = [];
  for (const root of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    for await (const file of walkTs(absRoot)) {
      const rel = path.relative(REPO_ROOT, file);
      if (ALLOW_LIST.has(rel)) continue;
      const src = await readFile(file, "utf8");
      for (const marker of LEGACY_MARKER_STRINGS) {
        if (src.includes(marker)) {
          offenders.push({ file: rel, marker });
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `D-13-12: legacy ES-5 marker strings found in non-allow-listed source:\n  ${offenders
      .map((o) => `${o.file}: ${JSON.stringify(o.marker)}`)
      .join("\n  ")}`,
  );
});
```

**Comment-stripping note:** Precedents (`no-orchestrator-network.test.ts:56`) strip comments before scanning. Recommend keeping comments INCLUDED in this scan -- header docstrings legitimately mention the markers (e.g., `// MSG-RH-1 replaces "Run /reload to <verb> ..."` in `presentation/reload-hint.ts:3-5`). After Wave 3 the comments shouldn't reference the legacy strings at all; the test's job is to prove that. If false-positives surface in Wave 2 (e.g., a justification comment), add specific files to `ALLOW_LIST` -- do NOT blanket-strip comments.

### `cascadeSeverity` helper (D-13-08)

```typescript
// Source: synthesized from CONTEXT.md D-13-08 + MSG-SR-4..6 + docs/output-catalog.md severity table.
// presentation/cascade-summary.ts -- NEW Wave 1.

import type { PluginCascadeRow } from "./compact-line.ts";

export type CascadeSeverity = "success" | "warning";

/**
 * MSG-SR-4..6 cascade severity routing:
 *   - All rows trivially-successful OR trivially-`(skipped) {up-to-date}` → "success"
 *   - Any row non-trivially `(skipped)` OR `(failed)` → "warning"
 *   - NEVER "error" (MSG-SR-6).
 */
export function cascadeSeverity(rows: readonly PluginCascadeRow[]): CascadeSeverity {
  for (const r of rows) {
    if (r.status === "failed") return "warning";
    if (r.status === "skipped" && !isTrivialUpToDate(r)) return "warning";
    if (r.status === "unavailable") return "warning";
    if (r.status === "rollback failed") return "warning";
    // (installed) / (updated) / (uninstalled) / (skipped){up-to-date} / (available) are trivial.
  }
  return "success";
}

function isTrivialUpToDate(r: PluginCascadeRow): boolean {
  return r.reasons !== undefined && r.reasons.length === 1 && r.reasons[0] === "up-to-date";
}

export interface CascadeSummaryInput {
  readonly marketplace: import("./compact-line.ts").MarketplaceRow;
  readonly rows: readonly PluginCascadeRow[];
}

export interface CascadeSummaryOutput {
  readonly message: string;
  readonly severity: CascadeSeverity;
}

/**
 * Compose the marketplace-header + indented cascade rows body and return the
 * computed severity. The orchestrator destructures and dispatches to the
 * matching notify wrapper:
 *
 *   const { message, severity } = cascadeSummary({ marketplace, rows });
 *   (severity === "warning" ? notifyWarning : notifySuccess)(ctx, message);
 */
export function cascadeSummary(input: CascadeSummaryInput): CascadeSummaryOutput {
  const lines: string[] = [renderRow(input.marketplace, edgeDeps)];
  const sorted = [...input.rows].sort(compareByNameThenScope);
  for (const row of sorted) {
    lines.push(`  ${renderRow(row, edgeDeps)}`);
  }
  return {
    message: lines.join("\n"),
    severity: cascadeSeverity(input.rows),
  };
}
```

## State of the Art

| Old Approach (today / pre-Phase 13) | Current Approach (Phase 13) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Reinstalled: / Updated: / Skipped: / Failed:` partition headers (e.g. `orchestrators/marketplace/shared.ts:193`) | Per-row status token (no partition header) | Wave 2 | All cascade renderers rewritten; the catalog has zero `Updated:` / `Skipped:` etc. lines |
| Aggregated soft-dep trailer (`subagentWarningIfNeeded(pi, names)` returning a sentence) | Per-row `{requires pi-subagents}` / `{requires pi-mcp}` reason | Wave 2 | `presentation/soft-dep.ts` becomes vestigial; `platform/pi-api.ts::subagentWarningIfNeeded` deleted in Wave 1 or kept until 2c then deleted |
| `formatErrorWithCauses(err)` returning ` -- caused by: `-joined string | `causeChainTrailer(err)` returning `cause: l1 -> l2 -> ... (truncated)` | Wave 1 | `formatErrorWithCauses` deleted; callers route through new composer or new `notifyError` body |
| Hand-formatted line emissions in 87 callsites | `RowSpec` payload → `renderRow()` single emission site | Wave 2 | Grammar discipline structurally enforced; Phase 14 drift guard has one site to target |
| Two-scope group headers (`user scope` / `project scope` in `presentation/plugin-list.ts:162` and `marketplace-list.ts:71`) | Flat per-scope rendering (MSG-GR-3); per-row `[<scope>]` brackets | Wave 2 (2c + 2d) | The `user scope` / `project scope` lines are RETIRED; `marketplace-list.ts:71`'s `${scope} scope marketplaces:` line goes away |
| `Added marketplace "<name>" in <scope> scope.` sentence-form (`marketplace/add.ts:142`) | `● <name> [<scope>] [<marker>] (added)` compact line | Wave 2 (2c) | All marketplace single-shot outputs rewritten |
| `Updated marketplace "<name>" in <scope> scope.` sentence-form (`marketplace/update.ts:347`) | `● <name> [<scope>] <autoupdate> (updated)` header + cascade children | Wave 2 (2c) | Catalog line 657 explicitly RETIRES the summary line |
| `Uninstalled plugin "<plugin>" from marketplace "<marketplace>".` (`uninstall.ts:210`) | `○ <plugin>@<marketplace> [<scope>] v<ver> (uninstalled)` | Wave 2 (2b) | Single-plugin sentence form retired |
| `body\n${hint}` join (`presentation/reload-hint.ts:56`) | `body\n\n${hint}` (blank line above per MSG-RH-1) | Wave 1 | One-line edit |

**Deprecated/outdated:**
- `(rollback partial: [<phase>] <msg>; …)` legacy form (PRD §6.12 ES-5): replaced by parent `{rollback partial}` + indented children (MSG-RP-1).
- `MANUAL RECOVERY REQUIRED:` sentence prefix: replaced by separate top-level `⊘ <res> (manual recovery) {<reason>}` line (MSG-MR-1/2).
- `pi-subagents is not loaded; ...` / `pi-mcp-adapter is not loaded; ...` sentences: replaced by per-row `{requires pi-subagents}` / `{requires pi-mcp}` reasons (MSG-SD-1).
- `Run /reload to <verb> "<names>".`: replaced by `/reload to pick up changes` (MSG-RH-1) -- already landed in Phase 12 across 8 callsites.

## Per-Command Inventory & State Matrix

### §2.1 Callsite inventory (87 total, grouped by sub-wave)

> Counted by `grep -rn "notifySuccess\|notifyWarning\|notifyError\|notifyUsageError" extensions/pi-claude-marketplace/orchestrators/`. The 87 lines include comment references; the actual production callsites are ~50 distinct emissions. Plus 14 edge-layer usage errors (`notifyUsageError`) routed via `edge/handlers/*` and `edge/router.ts`.

| Sub-wave | Orchestrator | Notify callsites | Current emission shape (sketch) | New form (RowSpec kind) |
|----------|--------------|------------------|---------------------------------|--------------------------|
| 2a | `orchestrators/plugin/reinstall.ts:178/195/199/202/215/220/373` | 7 sites | `notifyError(ctx, message, err)` (failure); `notifyWarning(ctx, warning)` (post-success leaks); `notifySuccess(ctx, renderSuccessBody(outcome, pi))` (single-plugin success); `notifySuccess(ctx, "No plugins installed.")`; `notifySuccess(ctx, appendReloadHint(body, hint))` (cascade summary) | Cascade: `cascadeSummary({mp, rows: PluginCascadeRow[]})`; empty: `EmptyToken{kind:"empty",token:"no plugins"}`; single failure: `notifyError + EntityErrorRow OR PluginInlineRow{status:"failed"}` |
| 2a | `orchestrators/plugin/update.ts:161/167/211/237/656/691/732` | 7 sites | Same shape as reinstall (notifyError on cascade prep, notifySuccess on empty + cascade summary, notifyWarning on per-leak) | Same as reinstall; version-transition arrow on `PluginCascadeRow.version` (`"v1.2.0 → v1.4.0"`) |
| 2a | `orchestrators/import/execute.ts:564/570/572/574` | 4 sites | `notifyError(ctx, "Import failed: ...")`; `notifyError(ctx, summary)` / `notifyWarning(ctx, summary)` / `notifySuccess(ctx, summary)` per partition severity | `Claude plugin import summary` preamble + per-mp `MarketplaceRow` headers (with `(added)` / `(skipped)` / `(failed)`) + indented `PluginCascadeRow` children. `(failed) {source mismatch}` header + dependent `(skipped) {source mismatch}` children (catalog line 528) |
| 2b | `orchestrators/plugin/install.ts:580/592/610/625/642/653/691` | 7 sites | `notifyError(ctx, cause, err)` (rollback); `notifyError(ctx, cause)` (defensive); `notifyWarning(ctx, msg)` (post-commit leaks); `notifySuccess(ctx, appendReloadHint(body, hint))` (success) | Success: `PluginInlineRow{kind:"plugin-inline",status:"installed"}` + reload-hint; rollback: `PluginInlineRow{status:"failed"}` parent + `RollbackChild[]` indented + `causeChainTrailer(err)` |
| 2b | `orchestrators/plugin/uninstall.ts:153/172/193/210/238` | 5 sites | `notifyError(ctx, formatErrorWithCauses(err), err)`; `notifyWarning(ctx, ...)` (post-commit cache leaks); `notifySuccess(ctx, ...)` (sentence-form) | Success: `PluginInlineUninstalledRow` (status: "uninstalled"; no soft-dep fields by construction); `○` icon per effective-state rule |
| 2b | `orchestrators/plugin/bootstrap.ts` | 0 direct sites (composes `addMarketplace` + `setMarketplaceAutoupdate`) | Inherits emissions from composed orchestrators | Same compositional shape; the composed `marketplace/add.ts` + `marketplace/autoupdate.ts` rewrites in 2c carry the bootstrap output |
| 2c | `orchestrators/marketplace/list.ts:62` | 1 site | `notifySuccess(ctx, renderMarketplaceList(allRecords))` | `MarketplaceRow[]` sorted by `compareByNameThenScope`; or `EmptyToken{token:"no marketplaces"}` |
| 2c | `orchestrators/marketplace/add.ts:135/142` | 2 sites | `notifyWarning(opts.ctx, ...)` (post-commit cache leak); `notifySuccess(opts.ctx, "Added marketplace ...")` | Single `MarketplaceRow{outcomeClass:"ok", status:"added", marker?: source.kind === "github" ? "autoupdate" : undefined}` + reload-hint when resources changed |
| 2c | `orchestrators/marketplace/remove.ts:195/245/251/279` | 4 sites | `notifyWarning(opts.ctx, ...)` (cache leak); `notifyWarning(opts.ctx, formatErrorWithCauses(aggregated))` (post-state cleanup leaks); `notifyWarning(opts.ctx, failureWarning(...))` (partial); `notifySuccess(opts.ctx, appendReloadHint(body, hint))` (clean) | Conditional CMC-31: clean = `MarketplaceRow{outcomeClass:"ok", status:"removed"}` + reload-hint; partial = `MarketplaceRow{outcomeClass:"failure", status:"failed", reasons:["plugins remain"]}` HEADER + `PluginCascadeRow[]` children + reload-hint + recovery anchor (both fire per CMC-15) |
| 2c | `orchestrators/marketplace/update.ts:175/317/319/332/359` | 5 sites | `notifySuccess(ctx, "No marketplaces configured.")`; `notifyError(ctx, ...)` (single-shot failure); `notifyWarning(ctx, ...)` (cache leak); `notifySuccess(ctx, appendReloadHint(body, hint))` (cascade) | autoupdate-off path: `MarketplaceRow{outcomeClass:"ok", status:"updated"}` alone (catalog line 661); autoupdate-on path: header + `cascadeSummary({rows})` |
| 2c | `orchestrators/marketplace/autoupdate.ts:92/113/138/142` | 4 sites | `notifyError(ctx, errorMessage(err), err)` (target not found); `notifyError(ctx, errorMessage(first.cause), first.cause)`; `notifySuccess(ctx, "No marketplaces configured.")`; `notifySuccess(ctx, lines.join("\n"))` (multi-mp result) | `MarketplaceRow{marker: enable ? "autoupdate" : "no autoupdate"}` per mp; **no status token on flip-success rows** (catalog line 698-700); per-mp `{already enabled}` / `{already disabled}` reason when already-matching |
| 2d | `orchestrators/plugin/list.ts:266/268` | 2 sites | `notifySuccess(ctx, renderPluginList(payload, warnings))`; `notifyError(ctx, errorMessage(err), err)` (catastrophic) | `PluginListPayload` consuming `MarketplaceRow` headers + `PluginListRow[]` children (with `EmptyToken{token:"no plugins"}` per-mp empty case per catalog line 750); orphan-fold computed by orchestrator |
| Edge | `edge/router.ts` + `edge/handlers/{plugin,marketplace}/*` | 14 sites of `notifyUsageError` + several `notifyError(ctx, USAGE)` | Sentence form preserved (MSG-NC-2, MSG-SR-7) | UNCHANGED -- usage errors stay sentence-form per CMC-34 |

**Edge-layer note (MSG-NC-1 / MSG-NC-2 split):** `edge/handlers/plugin/install.ts:42/55/61` and similar currently call `notifyError(ctx, USAGE)` for entity-shaped failures (e.g. unknown plugin name). MSG-NC-1 requires these become compact `⊘ <name>@<marketplace> [scope] (failed) {not found}` rows -- compact, not sentence. **The entity-shaped errors live in the EDGE LAYER**, not in orchestrators. Wave 2 must also rewrite some `edge/handlers/*` callsites. **This was not enumerated in CONTEXT.md's "sub-wave 2c marketplace" -- the planner should explicitly add a "2e edge handlers" sweep (or fold into 2b/2c per affected entity).** Counting: ~3 entity-shape error sites + ~10 usage-error sites in edge handlers; usage errors unchanged.

### §2.2 Per-command rendered-state matrix (extracted from `docs/output-catalog.md`)

The catalog UAT plan asserts byte-equality against every state below.

| Command | Rendered states (catalog fenced blocks) |
|---------|-----------------------------------------|
| `list` (plugin list) | empty (`(no plugins)`); single-mp mixed; same-plugin both scopes; project orphan folded under user; soft-dep markers on installed rows; unparseable marketplace; zero-plugin marketplace block; multiple marketplaces |
| `install` | success; success with soft-dep; failure unsupported features (`{hooks, lspServers}`); failure runtime + cause chain; failure with rollback-partial children |
| `uninstall` | success; success even when plugin had soft-dep resources (marker NOT emitted on uninstalled rows); failure |
| `reinstall` (cascade) | all reinstalled; with soft-dep; mixed (reinstalled + skipped + failed); all failed (no reload hint); plugin became unavailable post-install; bare form across multiple marketplaces |
| `update` (cascade) | single-mp mixed; failed-with-rollback-partial + cause chain; all up-to-date (no reload hint); bare form across multiple marketplaces |
| `import` | fresh import (multi-mp + multi-scope); `--scope project` narrowing; source-mismatch on existing mp |
| `bootstrap` | fresh; re-run when already bootstrapped |
| `marketplace list` | empty; mixed scopes (per-scope sort, project-before-user tie-break) |
| `marketplace add` | path source (no marker); github source (`<autoupdate>` marker); failure |
| `marketplace remove` | clean (bare row); partial (header + children + reload + retry anchor coexist) |
| `marketplace update` | autoupdate off (manifest refresh only); mixed plugin outcomes; mp-level failure |
| `marketplace autoupdate enable` | mixed (some flipped, some already on); marker as outcome (no status) |
| `marketplace autoupdate disable` | mixed; `<no autoupdate>` token as outcome marker; failure (not-found) |
| Manual recovery | triggered-by-failing-install (separate top-level line) |
| Empty/no-op surfaces | `(no plugins)`, `(no marketplaces)`, marketplace block with zero plugins |

**Structurally novel vs Phase 12:**
- `mp remove` conditional bare-row-vs-header form (CMC-31).
- `mp update` autoupdate-on (cascade) vs autoupdate-off (single mp line) form (CMC-32).
- `(reinstalled)` partition token rendered on reinstall cascade rows -- **see Pitfall 9 contradiction.**
- `import` source-mismatch with dependent plugin children at `(skipped) {source mismatch}`.
- Reload-hint + recovery-anchor coexistence on partial mp-remove (catalog line 642-651) -- 3-line block with blank lines between trailer and anchor.
- Plugin folding under user-scope mp header with mismatched plugin scope (catalog line 209: `● alpha [project] v0.9.0 (installed)` under `● official [user] <autoupdate>` header).

### §2.3 Style-Guide MSG-* rule traversal

| Rule ID | Normative requirement | Enforced where | Edge cases |
|---------|----------------------|----------------|------------|
| **MSG-GR-1** | Token order `<icon> <name>[@<mp>] [<scope>] [<marker>] [<ver>] (status) {reasons}`; absent slots omitted entirely | `compact-line.ts::renderRow` per variant | Marketplace rows omit `@<mp>`; plugin rows omit `<marker>`; manual-recovery rows omit `@<mp>` and `<scope>` |
| **MSG-GR-2** | `@<marketplace>` token only on standalone single-plugin mentions; omitted on cascade rows | Discriminant: `PluginInlineRow.marketplace` (always present) vs `PluginCascadeRow` (no marketplace field) | Edge: `EntityErrorRow.marketplace?` optional (only when caller has a marketplace context, e.g. `unknown@official`) |
| **MSG-GR-3** | Per-scope rendering on every surface (marketplaces + plugins); flat lists (no group headers); sort name-primary `localeCompare`+`sensitivity:'base'`, project-before-user tie-break | `presentation/sort.ts::compareByNameThenScope`; orchestrator constructs per-scope rows | Collapsed `[project, user]` form is dormant -- not exercised by any current surface |
| **MSG-GR-4** | Reasons in `{}`, comma-separated, 1-3 words lowercase; manifest field names (`{hooks}`, `{lspServers}`) verbatim carve-out; empty `{}` MUST NOT emit | `compact-line.ts::renderReasons(reasons: readonly Reason[]) → string` | `Reason` literal union enforces closed set (`shared/grammar/reasons.ts:34-58`); empty array → omit `{}` |
| **MSG-GR-5** | Marketplace rows carry `<marker>` between scope and status; `<autoupdate>` when ON; nothing when OFF; `<no autoupdate>` only as outcome of `marketplace autoupdate disable` | `MarketplaceRow.marker?: "autoupdate" \| "no autoupdate"` | Plugin rows never carry marker (TS narrowing prevents) |
| **MSG-IC-1** | `●` on plugin rows: installed in requested state (`(installed)/(updated)/(upgradable)`, `(skipped)` trivial) | `compact-line.ts::iconForPluginRow(status, isTrivialSkip)` | `(skipped) {up-to-date}` → `●` because plugin remains installed; `(skipped) {source mismatch}` → `⊘` because plugin is NOT installed |
| **MSG-IC-2** | `○` on plugin rows: not installed, no error (`(available)`, `(uninstalled)`) | Same function | Never on marketplace rows |
| **MSG-IC-3** | `⊘` on plugin rows: error/blocked (`(failed)/(rollback failed)/(manual recovery)/(unavailable)/(skipped)` cascade-failure child) | Same function | Marketplace `⊘` for outcome-class failure (`(failed)`, `(unavailable)`) |
| **MSG-SR-1..3** | Single-shot severity routing | Each orchestrator picks wrapper based on outcome | `MSG-SR-3` `notifyError` carries cause-chain trailer via new composer |
| **MSG-SR-4..6** | Cascade severity routing | `cascade-summary.ts::cascadeSeverity` | All-trivial → `notifySuccess`; any non-trivial → `notifyWarning`; never `notifyError` (MSG-SR-6) |
| **MSG-SR-7** | Usage errors → `notifyUsageError` | `edge/router.ts:125` etc. | Sentence form preserved; not changed by Phase 13 |
| **MSG-CC-1** | Cause chain `cause: l1 -> l2 -> ... (truncated)` depth-5 | `cause-chain.ts::causeChainTrailer` | Lowercase `cause:`; space-arrow-space joiner; only `.message` surfaced (no stack/paths per NFR-9) |
| **MSG-RH-1** | Single canonical trailer `/reload to pick up changes`, blank line above, emitted only when resources actually changed | `reload-hint.ts::appendReloadHint` (Wave 1 fix: `\n${hint}` → `\n\n${hint}`) | Coexists with retry anchor on mp-remove partial failure (CMC-15) -- reload above retry, blank line between |
| **MSG-SD-1** | Soft-dep as `{}` reason: `{requires pi-subagents}` + `{requires pi-mcp}` | `compact-line.ts::injectSoftDepReasons(row, edgeDeps)` | Two markers MAY co-occur in same `{}` block (single comma-joined block) |
| **MSG-SD-2** | Emit iff (declares AND companion unloaded); NEVER on `(uninstalled)` rows | Structural: `PluginInlineUninstalledRow` has no `declaresAgents/Mcp` fields | Predicate computed orchestrator-side; renderer probes companion-loaded |
| **MSG-SD-3** | Emission surfaces: list rows; cascade rows; single-shot install/update/reinstall success rows | Renderer emits per row regardless of surface, gated by `declaresAgents/Mcp` truthy + companion unloaded | Per-row emission replaces today's aggregated trailer |
| **MSG-MR-1** | Manual recovery as separate top-level compact line `⊘ <res> (manual recovery) {<reason>}`, blank line above, independent of triggering op | `manual-recovery.ts::renderManualRecovery(line: ManualRecoveryLine)` | Caller composes parent op message + blank line + manual-recovery line into one `notifyWarning` body |
| **MSG-MR-2** | System-level resources (agent index, state.json) place resource name directly in name slot; no `@<mp>`, no scope brackets | Structural: `ManualRecoveryLine.resource` is plain string; renderer doesn't append `@<mp>` or `[<scope>]` | Free-form indented child rows under §18.2 (`orphanDetails?`) |
| **MSG-RP-1** | Parent `(failed) {rollback partial}` (multi-phase) or `(failed) {<phase>}` (single phase); indented children per affected phase; each child its own compact line | `rollback-partial.ts::renderRollbackParent(parent, children: RollbackChild[])` | Cause-chain trailer appears AFTER indented children, NOT inside the block |
| **MSG-PL-1** | PL-4 descriptions: second indented line, col 66 truncate w/ `…` suffix, list-only | `compact-line.ts::renderPluginListRow` (preserves existing `truncateColumn66` logic at `presentation/plugin-list.ts:32`); other surfaces' renderers don't accept `description` field on row | Truncation: 66 code points (not bytes); 6-space indent doesn't count toward budget |
| **MSG-PL-2** | Version slot literal `v<ver>` between scope bracket and status; omitted when no version | `compact-line.ts::renderVersion(version?)` | `hash-<12hex>` versions render verbatim (MSG-PL-5) |
| **MSG-PL-3** | Version transition `v<from> → v<to>` (literal U+2192, space-padded) on `(updated)` and `(upgradable)` rows | Caller composes the `"v1.2.0 → v1.4.0"` string in `version` field; renderer just emits | Single rule across both surfaces |
| **MSG-PL-4** | `(upgradable)` implies installed; rendered ONLY by `list`, never on install/update/uninstall result rows | Structural: only `PluginListRow.status` includes `"upgradable"`; `PluginInlineRow` and `PluginCascadeRow` exclude it via `Extract<>` | Catches misuse at TS compile time |
| **MSG-PL-5** | `hash-<12hex>` versions verbatim (no abbreviation) | Pure-data passthrough; renderer doesn't process version strings | Out of scope: display-abbreviation (deferred to v1.4) |
| **MSG-PL-6** | `(available)` / `(unavailable)` rows on list surface OMIT scope bracket; other surfaces KEEP it | Discriminant: `PluginListRow` omits bracket when `status` ∈ {available, unavailable}; `PluginCascadeRow` / `PluginInlineRow` always include | Carve-out is list-only; catalog explicit at line 504 |
| **MSG-NC-1** | Entity-shaped non-cascade errors render as compact `⊘ <name>[@<mp>] [<scope>] (failed) {<reason>}` | `EntityErrorRow` discriminant | Edge handlers' entity-error sites (e.g. unknown plugin) migrate from sentence form to compact |
| **MSG-NC-2** | Argument/usage validation stays sentence form via `notifyUsageError` with `\n\n${usageBlock}` | `shared/notify.ts::notifyUsageError` (unchanged) | Compact-line grammar NOT coerced onto this surface |
| **MSG-ER-1** | Empty results: bare token `(no marketplaces)` / `(no plugins)`; no icon, name, scope, reasons; routed via `notifySuccess` | `EmptyToken` discriminant; `compact-line.ts::renderEmpty` returns the bare `(no marketplaces)` string | Legacy `No marketplaces configured.` and `No plugins installed.` retired |
| **MSG-LC-1..2** | Single sanctioned `console.warn` at `persistence/migrate.ts`; sentence form; IL-3 inline disable preserved | Already landed in Phase 12 (CMC-36/37) | Unchanged by Phase 13 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in; bundled with Node ≥20.19) |
| Config file | `tsconfig.json` (TS strip) + `package.json` `scripts.test` (no separate test config) |
| Quick run command | `node --test "tests/architecture/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + full test suite) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMC-01 | Token order on every emission | catalog UAT | `node --test tests/architecture/catalog-uat.test.ts` | ❌ Wave 0 |
| CMC-02 | `@<mp>` carve-out on cascade rows | catalog UAT (cascade examples) + structural typing | (same) | ❌ Wave 0 |
| CMC-03 | Per-scope rendering + sort tie-break | catalog UAT (mp-list mixed-scopes example) | (same) | ❌ Wave 0 |
| CMC-04 | Reasons `{}` block formatting | catalog UAT + grammar-frontmatter (existing) | (same) | ❌ Wave 0 (UAT) / ✅ (grammar) |
| CMC-05 | `<marker>` slot rendering | catalog UAT (mp-add github / autoupdate enable examples) | (same) | ❌ Wave 0 |
| CMC-06 | Plugin-row icons | catalog UAT (every plugin row in every command) | (same) | ❌ Wave 0 |
| CMC-07 | Marketplace icons | catalog UAT | (same) | ❌ Wave 0 |
| CMC-09 | `(upgradable)` list-only | Structural: only `PluginListRow.status` includes `"upgradable"` | TS compile (`npm run typecheck`) | ✅ (typecheck) |
| CMC-10 | Empty bare-token | catalog UAT (`(no plugins)` / `(no marketplaces)`) | (UAT) | ❌ Wave 0 |
| CMC-12 | Soft-dep reason wording | grammar-frontmatter (existing) verifies `requires pi-subagents` / `requires pi-mcp` in REASONS | (grammar) | ✅ |
| CMC-13 | Per-row soft-dep emission | unit test in `tests/presentation/compact-line.test.ts` (NEW Wave 1): `renderRow` emits marker when (declares ∧ unloaded) and omits otherwise | `node --test tests/presentation/compact-line.test.ts` | ❌ Wave 0 |
| CMC-15 | Reload-hint + recovery anchor coexist | catalog UAT (mp-remove partial example, line 637-651) | (UAT) | ❌ Wave 0 |
| CMC-16 | Manual recovery line shape | catalog UAT (manual-recovery example, line 722-736) + unit test for `renderManualRecovery` | (UAT + new unit) | ❌ Wave 0 |
| CMC-17 | Rollback-partial parent+children | catalog UAT (install rollback example, line 304-307; update rollback line 437-442) | (UAT) | ❌ Wave 0 |
| CMC-18 | Cause-chain depth-5 + `(truncated)` | unit test in `tests/presentation/cause-chain.test.ts` (NEW Wave 1): walk depth 0/1/3/5/6/cycle | `node --test tests/presentation/cause-chain.test.ts` | ❌ Wave 0 |
| CMC-20 | Cascade severity routing | unit test in `tests/presentation/cascade-summary.test.ts` (NEW Wave 1): every row class → expected severity | (new unit) | ❌ Wave 0 |
| CMC-21 | Per-scope fold + adoption | integration test: run `marketplace add` then `list`; assert orphan folds; then add project-scope marketplace; re-run `list`; assert adoption | `node --test tests/integration/fold-adoption.test.ts` (NEW) | ❌ Wave 0 |
| CMC-22 | `/claude:plugin list` UAT | catalog UAT | (UAT) | ❌ Wave 0 |
| CMC-23..33 | Per-command UATs | catalog UAT (one assertion per fenced block under each H2) | (UAT) | ❌ Wave 0 |
| CMC-34 | Entity-shape vs usage-error split | catalog UAT + edge handler unit tests (some exist, e.g., `tests/edge/router.test.ts`) | (UAT + existing) | ❌ Wave 0 (UAT) / ✅ (router) |
| CMC-35 | ES-5 marker absence | `tests/architecture/no-legacy-markers.test.ts` (D-13-12) + ESLint `no-restricted-imports` failure on `npm run check` if any callsite imports a legacy marker | `node --test tests/architecture/no-legacy-markers.test.ts` + `npm run check` (ESLint) | ❌ Wave 0 (both) |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/**/*.test.ts" "tests/presentation/**/*.test.ts"` (quick: ≤5s; catches drift early).
- **Per wave merge:** `npm run check` (full: typecheck + ESLint + Prettier + ~1000 tests; ≤60s historically).
- **Phase gate:** `npm run check` green AND `node --test tests/architecture/catalog-uat.test.ts` green BEFORE `/gsd:verify-work`. The catalog UAT is the Wave 3 plan-#1 gate per D-13-04 -- if it fails, the ES-5 atomic commit DOES NOT run.

### Wave 0 Gaps
- [ ] `tests/architecture/no-legacy-markers.test.ts` -- covers CMC-35 (D-13-12); lands Wave 1.
- [ ] `tests/architecture/catalog-uat.test.ts` -- covers every CMC-22..34 per-command UAT; lands Wave 3 plan #1.
- [ ] `tests/presentation/compact-line.test.ts` -- covers CMC-13 (per-row soft-dep), CMC-01 (token order), CMC-04 (reasons block), MSG-IC-1..3 (icon selection); lands Wave 1.
- [ ] `tests/presentation/cascade-summary.test.ts` -- covers CMC-20 / MSG-SR-4..6; lands Wave 1.
- [ ] `tests/presentation/cause-chain.test.ts` -- covers CMC-18 / MSG-CC-1; lands Wave 1.
- [ ] `tests/presentation/manual-recovery.test.ts` -- covers CMC-16 / MSG-MR-1..2; lands Wave 1.
- [ ] `tests/presentation/rollback-partial.test.ts` -- covers CMC-17 / MSG-RP-1; lands Wave 1.
- [ ] `tests/integration/fold-adoption.test.ts` -- covers CMC-21 (orphan fold + adoption round-trip); lands Wave 2 sub-wave 2d.
- [ ] Existing tests (`tests/presentation/{plugin-list,marketplace-list,reload-hint}.test.ts`) -- REWRITTEN sub-wave 2c/2d to match new RowSpec contract.
- [ ] Framework install: NONE needed -- `node:test` is built-in.

## Environment Availability

This phase is a pure code/config refactor with no new external dependencies, services, or runtimes. The existing toolchain (Node ≥20.19, ESLint 10, Prettier, `node:test`) is already available and verified by every prior phase's `npm run check`. No probe required.

## Security Domain

**security_enforcement disposition:** No application-security domain applies. Phase 13 emits no new auth, no new I/O, no new network surface, no new persistence shapes. The only security-adjacent invariant is **NFR-9** (no stack traces / absolute paths leak via `notifyError`), which is preserved verbatim by the new `cause-chain.ts` composer (it surfaces only `.message`, never `.stack`). All ASVS V2/V3/V4/V6 categories are inapplicable to this phase.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | partial | `compareByNameThenScope` consumes plugin/marketplace names from state; state-load already validates schema; no new untrusted input enters the renderer |
| V6 Cryptography | no | n/a |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stack trace exfiltration via error message | Information Disclosure | `cause-chain.ts::causeChainTrailer` surfaces only `.message`; NFR-9 invariant |
| Cause-chain cycle DoS | Denial of Service | Depth bound 5 + cycle detection (`current.cause !== current`); inherited from existing `formatErrorWithCauses` |

## Phase 12 Carry-Forward Verification

Verified against current `gsd/v1.3-replan-catalog` branch:

| Item | Expected | Verified |
|------|----------|----------|
| `shared/grammar/status-tokens.ts` | 14-entry `as const` array; `StatusToken` literal union | ✅ Present at `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts:37-54`; 14 entries verified |
| `shared/grammar/reasons.ts` | 23-entry `as const` array; `Reason` literal union | ✅ Present at `extensions/pi-claude-marketplace/shared/grammar/reasons.ts:34-58`; 23 entries verified |
| `presentation/reload-hint.ts::reloadHint(names)` | Returns `"/reload to pick up changes"` when `names.length > 0`, else `""` | ✅ Verified at `presentation/reload-hint.ts:38-40` |
| `presentation/reload-hint.ts::appendReloadHint` | Single-newline join `body\n${hint}` (deferred to Phase 13) | ✅ Present at `:55-57` with TODO comment; Wave 1 changes to `\n\n${hint}` per MSG-RH-1 |
| Four `notify*` wrappers in `shared/notify.ts` | Unchanged signatures + 4 exports | ✅ Verified `shared/notify.ts:47-90`; all 4 export functions present |
| `persistence/migrate.ts` §14.1 wording | "Legacy marketplace migration could not be persisted to ${stateJsonPath}; ..." | ✅ Per Phase 12 VERIFICATION.md row #5 |
| `tests/architecture/markers-snapshot.test.ts` | Passes against current `shared/markers.ts` 5 ES-5 exports | ✅ Present at `tests/architecture/markers-snapshot.test.ts`; reads PRD §6.12 + asserts byte equality |
| `tests/architecture/grammar-frontmatter.test.ts` | Asserts `STATUS_TOKENS` and `REASONS` set-equal to style-guide frontmatter | ✅ Present at `tests/architecture/grammar-frontmatter.test.ts:62-82` |
| ESLint BLOCK A (IL-2 chokepoint) | `no-restricted-syntax` forbids direct `ctx.ui.notify` outside `shared/notify.ts` | ✅ Verified `eslint.config.js:79-131` |
| ESLint BLOCK B (per-file override) | `shared/notify.ts` allow-list pattern (precedent for D-13-09) | ✅ Verified `eslint.config.js:133-141` |

**Drift / surprises:** None. Phase 12 shipped exactly what the planner expected; Phase 13 can consume the foundation unchanged.

## Open Questions

1. **`(reinstalled)` token vs CMC-08 closed set.**
   - What we know: `STATUS_TOKENS` (`shared/grammar/status-tokens.ts:37-54`) has 14 entries, no `reinstalled`. The catalog at lines 147, 351-357 explicitly shows `(reinstalled)` rendered on reinstall cascade rows. Phase 12 verified the closed set is byte-equal to the frontmatter.
   - What's unclear: Either (a) the catalog is wrong and reinstall cascade rows must emit `(installed)` (effective-state rule -- the plugin IS installed post-reinstall), OR (b) the frontmatter + `STATUS_TOKENS` need a 15th entry. The style guide §3 status-tokens table also lists only 14 tokens; `(reinstalled)` is not in §3 either. **The output catalog appears to contradict the style guide.**
   - Recommendation: **Escalate to discuss-phase before Wave 1.** The simpler resolution is to amend the catalog to emit `(installed)` on reinstall rows (matches effective-state rule). The disruptive alternative is to add a 15th token to the frontmatter + `STATUS_TOKENS` + style guide §3, which expands the user-contract.

2. **Edge-handler entity-error sites scope.**
   - What we know: MSG-NC-1 mandates compact-line form for entity-shaped non-cascade errors. Today's `edge/handlers/plugin/{install,uninstall,update,reinstall}.ts` use `notifyError(ctx, USAGE)` for argument-validation failures AND `notifyError(ctx, errorMessage(err))` for entity-shape failures.
   - What's unclear: CONTEXT.md D-13-02's sub-wave grouping does not enumerate edge handlers explicitly. Sub-wave 2b would naturally consume install/uninstall edge handler rewrites; sub-wave 2c would consume marketplace edge handlers.
   - Recommendation: The planner should explicitly assign edge handler entity-error rewrites to the sub-wave that owns the corresponding orchestrator. Usage errors stay unchanged (MSG-SR-7 sentence form preserved).

3. **`platform/pi-api.ts::subagentWarningIfNeeded` deletion timing.**
   - What we know: D-13-07 puts per-row soft-dep markers on `RowSpec`; the existing aggregated `subagentWarningIfNeeded(pi, names)` is unused after sub-waves 2a + 2b finish migrating.
   - What's unclear: Sub-wave 2c (`marketplace remove`) currently calls `subagentWarningIfNeeded(pi, dropped.agents)` at `orchestrators/marketplace/remove.ts:265`. After 2c rewrites `mp remove` to compact rows, this helper has zero callers.
   - Recommendation: Delete `subagentWarningIfNeeded` + `mcpAdapterWarningIfNeeded` exports from `platform/pi-api.ts` AND the `presentation/soft-dep.ts` re-export barrel during sub-wave 2c finalization. Wave 3 catalog UAT verifies no callsite still emits the aggregated sentence form. This deletion is implicit in D-13-09's ESLint gate (legacy markers covered) + the catalog UAT.

4. **Wave 1 deletion of `formatErrorWithCauses`.**
   - What we know: `orchestrators/marketplace/shared.ts:453` exports `formatErrorWithCauses`; 5 callers across orchestrators consume it.
   - What's unclear: Wave 1 introduces `presentation/cause-chain.ts::causeChainTrailer` with the new join. The 5 callers need to be updated -- but caller updates touch orchestrators (Wave 2 territory). Either Wave 1 ships the new composer alongside the old helper and Wave 2 migrates callers (carries dual-grammar risk for ~1 sub-wave), OR Wave 1 also rewrites the 5 callers and reshapes `notifyError`'s body to consume the trailer (cleaner, scope-creep into Wave 2).
   - Recommendation: **Reshape `notifyError` in Wave 1** so that `notifyError(ctx, message, cause?)` automatically appends the MSG-CC-1 trailer when `cause` chains. The 5 callers then stop calling `formatErrorWithCauses` and pass bare `err` -- this is closer to today's intent anyway. Single Wave 1 task; clean cutover.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `RowSpec` discriminant key should be explicit `kind` rather than codebase-precedent inferred-union | §3.1 / Architecture Patterns / Pattern 1 | Low: planner Discretion. If they pick inferred-union, the renderer's switch still works via TS narrowing on required-field discriminants. |
| A2 | `formatErrorWithCauses` join-string change is safe to ship in Wave 1 | §4 / Code Example / cause chain | Low: existing test fixtures will detect changes in cause-chain output; catalog UAT in Wave 3 catches drift. |
| A3 | The `(reinstalled)` token contradiction (catalog vs `STATUS_TOKENS`) should be resolved by amending the catalog to `(installed)` | §6 / Open Question 1 | Medium-High: if planner picks "extend the closed set" instead, the frontmatter + style guide + REQUIREMENTS.md CMC-08 all need updates. Surfaces to discuss-phase. |
| A4 | Edge-handler entity-error sites belong to the per-orchestrator sub-wave (2b/2c), not a separate 2e | §6 / Open Question 2 / §2.1 Edge-layer note | Low: scope clarification only; doesn't change the work. |
| A5 | `platform/pi-api.ts::subagentWarningIfNeeded` is safe to delete post-2c | §6 / Open Question 3 | Low: ESLint + catalog UAT both catch any straggling callsite. |
| A6 | The 87-callsite grep count is reasonably close to the ~89 quoted in the phase scope; the discrepancy is comment references | §2.1 callsite inventory | None: planner will work from the inventory regardless of the exact count. |
| A7 | Wave 1's `no-restricted-imports` rule can merge into the existing BLOCK E (Pi peer-import) entry rather than a separate BLOCK F | §4 / Code Example / `no-restricted-imports` rule block | Low: planner Discretion. If a separate block is preferred, the `paths[]` arrays merge or override per the ESLint flat-config block-stacking rules; either works. |
| A8 | The catalog UAT can extract fenced ```text``` blocks via H2-anchored parsing without false positives | Pitfall 7 + Wave 3 plan | Low: regex robustness; verifiable by running the UAT against the current (non-conformant) renderer and confirming a clean per-state diff. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/13-conformance-refactor-es-5-supersession/13-CONTEXT.md` -- the 19 locked decisions; the binding source for every D-13-* claim.
- `docs/messaging-style-guide.md` v1.0 §2-§16 -- MSG-* rule extracts (verified by direct read).
- `docs/output-catalog.md` -- per-command rendered states (verified by direct read).
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 ES-5 -- the 5 legacy strings; rewritten by Wave 3 atomic commit.
- Source tree at `gsd/v1.3-replan-catalog`:
  - `extensions/pi-claude-marketplace/shared/grammar/{status-tokens.ts,reasons.ts}` (Phase 12 carry-forward).
  - `extensions/pi-claude-marketplace/presentation/{plugin-list.ts,marketplace-list.ts,reload-hint.ts,soft-dep.ts,index.ts}`.
  - `extensions/pi-claude-marketplace/shared/{notify.ts,markers.ts,errors.ts}`.
  - `extensions/pi-claude-marketplace/orchestrators/{types.ts,edge-deps.ts,plugin/*,marketplace/*,import/execute.ts}`.
  - `tests/architecture/{markers-snapshot,grammar-frontmatter,no-orchestrator-network}.test.ts` (precedents).
  - `eslint.config.js` (flat-config; BLOCK A IL-2 chokepoint + BLOCK B `shared/notify.ts` override + BLOCK E Pi peer-imports `no-restricted-imports`).
  - `package.json` (engines, test script).
- `.planning/phases/12-messaging-foundations-renderer-primitives/12-VERIFICATION.md` -- verified Phase 12 state.

### Secondary (MEDIUM confidence)
- ESLint official docs (web fetched 2026-05-23): `no-restricted-imports` flat-config syntax with `paths[].importNames`. Confirmed the rule supports per-import-name restriction. Per-file allow-list achievable via a follow-on config block with file-glob + `"no-restricted-imports": "off"` (precedent: BLOCK B in `eslint.config.js`).

### Tertiary (LOW confidence)
- None. Every claim in this document is either: extracted from `CONTEXT.md`, verified against source files, extracted from the binding docs, or marked as `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; existing toolchain verified.
- Architecture: HIGH for D-13-* locked decisions; MEDIUM for the discretion items (discriminant key, sub-wave 2c ordering, plan count, catalog UAT runner shape) which the planner finalizes.
- Pitfalls: HIGH for items grounded in code (1-3, 5-8, 10); MEDIUM for items grounded in research synthesis (4, 9 -- the latter flagged as the `(reinstalled)` open question).
- Callsite inventory: HIGH (grep-counted, per-file paths cited).
- MSG-* rule traversal: HIGH (per-rule citation against §1-§16 of the style guide).
- Per-command state matrix: HIGH (extracted from `docs/output-catalog.md` H2 sections).

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (30 days, stable internal refactor scope).

---

## RESEARCH COMPLETE

**Phase:** 13 - Conformance Refactor & ES-5 Supersession
**Confidence:** HIGH

### Key Findings

- Phase 12 foundations verified in place: closed sets, reload-hint composer, four-wrapper minimalism, grammar frontmatter drift test, markers snapshot test. Wave 1 inherits exactly the surface CONTEXT.md predicts.
- Concrete `RowSpec` discriminated-union proposal lands with 8 variants (`PluginInlineRow`, `PluginInlineUninstalledRow`, `PluginCascadeRow`, `PluginListRow`, `MarketplaceRow`, `EmptyToken`, `ManualRecoveryLine`, `RollbackChild`, `EntityErrorRow`). Recommends explicit `kind` discriminant for grep-ability and exhaustive-switch ergonomics.
- The cause-chain depth-5 walker already exists at `orchestrators/marketplace/shared.ts:453` -- Wave 1 relocates to `presentation/cause-chain.ts` and rewrites the join string to ` -> ` per MSG-CC-1.
- 87 production notify callsites enumerated across 12 orchestrator files; edge layer adds ~14 usage-error sites (unchanged) and ~3 entity-shape error sites (must migrate per MSG-NC-1 -- scope clarification recommended).
- Per-command rendered-state matrix extracted from `docs/output-catalog.md` ready for Wave 3 UAT extraction.
- Exact ESLint `no-restricted-imports` block proposed with both `paths[]` and the merge-vs-separate-block discussion; precedent at BLOCK B + BLOCK E.
- Static-audit test (D-13-12) written as `tests/architecture/no-legacy-markers.test.ts`; comment-strip choice documented (recommend INCLUDED).
- One critical open question: **`(reinstalled)` token contradicts `STATUS_TOKENS` closed set** -- needs discuss-phase resolution before Wave 1.
- Wave 1's `appendReloadHint` one-line fix (`\n${hint}` → `\n\n${hint}`) called out explicitly per MSG-RH-1 blank-line discipline.

### File Created

`.planning/phases/13-conformance-refactor-es-5-supersession/13-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new deps; existing toolchain verified by Phase 12 ship |
| Architecture (locked D-13-* decisions) | HIGH | CONTEXT.md binds every wave + sub-wave decision |
| Architecture (discretion items) | MEDIUM | Planner decisions; recommendations grounded in codebase precedent |
| Pitfalls | HIGH | Items 1-3, 5-8, 10 grounded in code; item 9 flagged as resolution-needed |
| Callsite inventory | HIGH | Grep-counted across the 12 orchestrators |
| MSG-* rule traversal | HIGH | Per-rule citation to style guide §1-§16 |
| Per-command UAT matrix | HIGH | Extracted from `docs/output-catalog.md` H2 sections |

### Open Questions

1. `(reinstalled)` token contradiction vs `STATUS_TOKENS` closed set -- **escalate to discuss-phase before Wave 1**.
2. Edge-handler entity-error sites scope (sub-wave assignment) -- scope clarification only.
3. `platform/pi-api.ts::subagentWarningIfNeeded` deletion timing -- delete in sub-wave 2c finalization.
4. `formatErrorWithCauses` deletion vs dual-grammar in Wave 1 -- recommend Wave 1 reshape of `notifyError` body.

### Ready for Planning

Research complete. Planner can create PLAN.md files for: Wave 1 (1-3 plans for primitives + RowSpec model + ESLint rule + static-audit test + reload-hint blank-line fix + cause-chain composer + notifyError rewrite), Wave 2 sub-waves 2a/2b/2c/2d (one plan per sub-wave with intra-sub-wave parallelization), and Wave 3 (catalog UAT plan #1 + ES-5 atomic commit plan #2 per D-13-04). Recommend planner address the `(reinstalled)` open question (or surface to discuss-phase) before finalizing the Wave 1 plan, since it determines whether `STATUS_TOKENS` needs a 15th entry in Wave 1.
