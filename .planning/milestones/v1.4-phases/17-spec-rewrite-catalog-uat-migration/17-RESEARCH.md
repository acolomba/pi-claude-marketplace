# Phase 17: Spec Rewrite & Catalog UAT Migration - Research

**Researched:** 2026-05-26
**Domain:** Documentation rewrite (`docs/messaging-style-guide.md` v1.0 -> v2.0; `docs/output-catalog.md` v1.0 -> v2.0) + test rewrite (`tests/architecture/catalog-uat.test.ts` renderer swap V1 composers -> `notify()`) + test deletion (`tests/architecture/grammar-frontmatter.test.ts`) + traceability edit (`.planning/REQUIREMENTS.md`)
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Style guide v2.0 shape:**
- **D-17-01:** Delete YAML frontmatter (`status_tokens`, `reasons`, `markers`, `pattern_classes`) from `docs/messaging-style-guide.md` v2.0. The binding closed-set authority is now the const tuples in `extensions/pi-claude-marketplace/shared/notify.ts` (`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `DEPENDENCIES`) plus `REASONS` in `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`. Style guide drops ~60 frontmatter lines.
- **D-17-02:** Delete `tests/architecture/grammar-frontmatter.test.ts` (91 lines). Closed-set membership is locked at compile time by Phase 15's `tests/architecture/notify-types.test.ts`. Advances SNM-26 from Phase 21 -> Phase 17.
- **D-17-07:** v2.0 style guide is a thin pointer doc, ~150-250 lines, ~5-7 H2 sections: Overview / Type Model Reference / Output Grammar Summary / Severity Routing / ES-5 Supersession Table / Cross-References. Deletions: §16 Pattern Class Reference (~260 lines) + §17 Worked Examples Gallery merged into the catalog + §3 Status Tokens / §4 Reasons Enum standalone enumeration deleted (pointer-only).
- **D-17-08:** ES-5 Supersession Table retained verbatim from v1.0 §15 with one-line annotation "fully retired Phase 21 -- see `tests/architecture/no-legacy-markers.test.ts`". ADR and PRD NOT modified on this axis.

**Catalog v2.0 shape & migration-state signaling:**
- **D-17-04:** `docs/output-catalog.md` v2.0 is silent on per-command migration state. Catalog presents v2 expected outputs as authoritative forward-looking spec. Readers consult `.planning/REQUIREMENTS.md` / `.planning/ROADMAP.md` for migration progress.
- **Section preservation:** Keep all 14 existing per-command H2 sections + `Manual recovery anchors` + `Empty / no-op surfaces` + `Usage errors`. Rewrite each section's expected outputs to v2 form.
- **Single-plugin command headline change:** Single-plugin install/update/uninstall/reinstall rewrite from V1 one-line `● commit-commands [user] (installed)` to V2 two-line:
  ```
  ● claude-plugins-official [user]
    ● commit-commands (installed)
  ```
  Plugin-row scope bracket OMITTED when `plugin.scope == marketplace.scope`; orphan-fold case emits the bracket. Catalog includes at least one orphan-fold example.

**Catalog UAT test rewrite (SNM-31):**
- **D-17-03:** Pure exclusion strategy. Rewritten `catalog-uat.test.ts` runs `notify()` only. V1 wrappers stay covered only by `tests/shared/notify.test.ts`.
- **D-17-05:** Inline catalog parser pattern mirrored from V1; walks per-command H2 sections + extracts `<!-- catalog-state: STATE -->` annotations. Fixtures: `Map<(section, state), NotificationMessage>` constant. Mock `pi`: `{ getAllTools: () => [...] }` matching Phase 16.
- **D-17-06:** Reuse `<!-- catalog-state: STATE -->` HTML-comment marker convention verbatim. STATE strings remain human-readable identifiers.
- **Fixture coverage scope:** Every (section, state) tuple in the rewritten catalog must have a corresponding fixture entry. Phase 16's `tests/shared/notify-v2.test.ts` fixtures are the SEED.

### Claude's Discretion

- Exact heading numbering / wording of v2.0 style guide's ~5-7 sections.
- Whether Type Model Reference embeds a small TS code snippet inline vs strictly pointers.
- Whether existing `## Resolutions to apply to docs/messaging-style-guide.md` section survives or is folded into Overview as historical context.
- Whether `catalog-uat.test.ts` rewrite happens as one atomic plan or two plans (parser/fixture map first, then renderer swap).
- Fixture-module organization: inline in the test file or factored to `tests/architecture/catalog-fixtures.ts`. Both satisfy D-17-05.
- Whether to refactor Phase 16's `tests/shared/notify-v2.test.ts` fixtures into a shared module imported by both per-variant unit tests AND catalog UAT.
- Where the SNM-23 traceability-table edit for SNM-26 lands (separate REQUIREMENTS.md plan vs inside style-guide rewrite plan vs inside test-deletion plan).
- The ADR cross-reference (success criterion #5) may land separately or be folded into the style-guide rewrite plan.
- Exact rendering of `docs/output-catalog.md` §Conventions in v2.0 -- v2 grammar simplifies (always-marketplace-header eliminates the single-plugin carve-out).

### Deferred Ideas (OUT OF SCOPE)

- Migrating any orchestrator/edge call site from V1 wrappers to `notify()` -- Phases 18/19/20.
- Deleting V1 wrappers, 34-rule MSG-* lint plugin, or `presentation/*` composers -- Phase 21 (SNM-22, SNM-27, SNM-32).
- Reviewing/updating `tests/architecture/no-legacy-markers.test.ts` source set against V2 vocabulary -- Phase 21 (SNM-28); Phase 17 only patches if `npm run check` breaks.
- Retiring `shared/grammar/*.ts` files (`status-tokens.ts`, `reasons.ts`, `markers.ts`, `pattern-classes.ts`) -- Phase 21 (SNM-29). `shared/notify.ts` still imports `Reason` from `reasons.ts`; survives Phase 17.
- Pruning `Reason` to v1.4-active subset -- Backlog; Phase 21 may revisit.
- Branded `Version` type, JSON output mode -- REQUIREMENTS.md Out of Scope backlog.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-19 | `docs/messaging-style-guide.md` v2.0 rewritten to describe the structured type model as binding contract; frontmatter deleted (D-17-01) -- closed-set authority is now const tuples in `shared/notify.ts`. | Style guide v1.0 inventory + frontmatter contents verified; v2.0 section budget mapped (Q7); deletion blast radius confirmed (Q6). |
| SNM-20 | `docs/output-catalog.md` rewritten to reflect always-marketplace-header spec; every per-command section updated with new byte-equal v2 outputs. | All 49 `catalog-state:` markers across 14 H2 sections enumerated (Q3); v2 form anchored by Phase 16's `notify()` renderer + 32 per-variant test fixtures (Q4). |
| SNM-26 | `tests/architecture/grammar-frontmatter.test.ts` deleted per D-17-02 (frontmatter gone -> nothing to assert parity against; compile-time closed-set proof via `tests/architecture/notify-types.test.ts`). REQUIREMENTS.md traceability edit: owner Phase 21 -> Phase 17. | Deletion mechanics + traceability-table edit shape verified (Q9). |
| SNM-31 | `tests/architecture/catalog-uat.test.ts` rewritten: feeds `NotificationMessage` fixtures through `notify()` via mock `ctx`; byte-equality assertion remains user-contract gate. | Test rewrite mechanics verified (Q1, Q2, Q5); preserves parser, swaps renderer, replaces fixture-map shape. |

## Domain Overview

### v2 grammar context

Phase 16 (completed 2026-05-26) shipped the v1.4 `notify(ctx, pi, message)` renderer in `extensions/pi-claude-marketplace/shared/notify.ts` (1065 lines). The renderer's two file-private helpers (`renderMpHeader` + `renderPluginRow`) own the entire v2 grammar via `switch + assertNever`. Severity, reload-hint, and soft-dep markers are computed at notify time from payload contents. The 32-test `tests/shared/notify-v2.test.ts` mini-spec header is the de facto v2 spec; Phase 17 lifts it into `docs/output-catalog.md` and writes the new style guide v2.0 as a thin pointer doc.

**Phase 17 is purely documentation-and-test work -- no production source changes.** The renderer is already the spec authority (D-16-04). What Phase 17 does:
1. Rewrite the user-facing spec to match the renderer (style guide + catalog).
2. Swap the catalog UAT's renderer-call site from V1 composers (`renderRow` / `cascadeSummary` / etc.) to `notify()` via mock `ctx` + mock `pi`.
3. Delete the now-irrelevant frontmatter parity test.
4. Update REQUIREMENTS.md traceability + add the ADR cross-reference.

### Phase 17's role in v1.4 milestone

| Phase | Status | Role |
|-------|--------|------|
| 15 | COMPLETE (2026-05-25) | Type model in `shared/notify.ts` + ADR refresh. |
| 16 | COMPLETE (2026-05-26) | `notify()` + `notifyUsageError()` V2 renderer + 32 per-variant unit tests. |
| **17** | **NOT STARTED** | **Spec catches up to renderer; catalog UAT switches to drive `notify()`.** |
| 18 | Not started | Migration wave 1: marketplace orchestrator family. |
| 19 | Not started | Migration wave 2: plugin orchestrator family. |
| 20 | Not started | Migration wave 3: edge handlers + `notifyUsageError`. |
| 21 | Not started | Final teardown: delete V1 wrappers + 34-rule lint plugin + retire `shared/grammar/`. |

Net-LoC contribution at v1.4 milestone close (~4300 LoC removed):
- Style guide v1.0 -> v2.0: -~720 lines (954 -> ~230).
- `grammar-frontmatter.test.ts` deletion: -91 lines.
- `docs/output-catalog.md` v1.0 -> v2.0: net-neutral (rewrite, not deletion; ~971 lines stays ~similar).
- `tests/architecture/catalog-uat.test.ts` rewrite: roughly net-neutral or modest reduction (~+10/-20 lines depending on factoring).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| User-facing v2 grammar spec | Documentation (`docs/messaging-style-guide.md` v2.0) | Code (`extensions/pi-claude-marketplace/shared/notify.ts` is the binding authority per D-16-04) | Style guide is the human-readable pointer; renderer IS the spec. Closed-set authority points at const tuples in source code, not in YAML. |
| Per-command byte-equal expected outputs | Documentation (`docs/output-catalog.md` v2.0) | Test (`tests/architecture/catalog-uat.test.ts` enforces byte-equality) | Catalog is the user-contract gate text; UAT runner asserts the binding gate via `notify()`. |
| Closed-set membership enforcement | Test (`tests/architecture/notify-types.test.ts` compile-check) | Code (const tuples + derived literal-union types in `shared/notify.ts`) | Compile-time check is the closed-set proof; was previously also runtime-checked via `grammar-frontmatter.test.ts` but that's now redundant. |
| Catalog UAT driver | Test (`tests/architecture/catalog-uat.test.ts` runtime) | Code (`shared/notify.ts::notify()` is the renderer under test) | Test reads catalog at runtime, drives `notify()` with structured fixtures, asserts byte-equality against catalog blocks. |
| Traceability tracking | Planning (`.planning/REQUIREMENTS.md`) | -- | SNM-26 owner Phase 21 -> Phase 17 + status Pending -> Complete. |
| ADR consequence pointer | Documentation (`docs/adr/v2-001-structured-notify.md`) | -- | Accepted-status block gains a one-line Phase 17 cross-ref per success criterion #5. |

## Implementation Approach

### Recommended plan-grouping

Five candidate plans; the planner picks subset and ordering. All five are atomic-per-plan compliant.

**Plan A: Style guide v1.0 -> v2.0 rewrite (+ optional ADR cross-ref + optional REQUIREMENTS.md traceability edit + optional `no-legacy-markers.test.ts` patch).**
- Scope: full rewrite of `docs/messaging-style-guide.md` to ~5-7 H2 sections, ~150-250 lines per D-17-07.
- Delete YAML frontmatter (D-17-01). Preserve ES-5 Supersession Table verbatim with retirement annotation (D-17-08).
- Optional fold-ins (planner discretion):
  - Add one-line "Landed via Phase 17" cross-reference to `docs/adr/v2-001-structured-notify.md` Accepted-status block.
  - Update `.planning/REQUIREMENTS.md` SNM-26 row (owner Phase 21 -> Phase 17; status Pending -> Complete) + per-phase distribution line.
  - Patch `tests/architecture/no-legacy-markers.test.ts` IF its source set referenced the deleted frontmatter (research below shows it does NOT -- no patch needed).

**Plan B: Catalog v1.0 -> v2.0 rewrite.**
- Scope: full rewrite of `docs/output-catalog.md` preserving 14 per-command H2 structure but rewriting every section's expected outputs to v2 always-marketplace-header form.
- Preserves `<!-- catalog-state: STATE -->` marker convention verbatim (D-17-06).
- Silent on per-command migration state (D-17-04).
- Parser-independent (Plan C can run later against either v1 or v2 catalog -- but Plan B's outputs are what Plan C asserts against, so Plan B should land BEFORE Plan C).

**Plan C: `catalog-uat.test.ts` rewrite.**
- Scope: parser-preserving renderer swap. Walking logic for `<!-- catalog-state: STATE -->` markers under per-command H2 sections stays verbatim.
- Replace V1-composer fixture construction with `Map<(section, state), NotificationMessage>` per D-17-05.
- Renderer call swaps from V1 composers (`renderRow` / `cascadeSummary` / `renderManualRecovery` / `renderRollbackPartial` / `renderPluginList` / `renderMarketplaceList` / `appendReloadHint`) to a single `notify(mockCtx, mockPi, fixtureMessage)` invocation per (section, state).
- Drop V1-composer assertions per D-17-03 (pure exclusion).
- **Hard dependency on Plan B:** Plan C asserts byte-equality against catalog blocks Plan B rewrites. If Plan C runs before Plan B, the old v1 catalog bytes mismatch the new `notify()` outputs and every test fails.

**Plan D: `grammar-frontmatter.test.ts` deletion + REQUIREMENTS.md SNM-26 traceability edit.**
- Scope: delete `tests/architecture/grammar-frontmatter.test.ts` (91 lines) per D-17-02.
- Update `.planning/REQUIREMENTS.md` SNM-26 row + per-phase distribution line.
- **Hard dependency on Plan A:** Frontmatter deletion in Plan A makes the import statement in `grammar-frontmatter.test.ts` impossible to resolve -- but actually, the test imports from `tests/lint-rules/lib/frontmatter.js` (the loader), and that loader reads from `docs/messaging-style-guide.md` at module load. If the YAML frontmatter is deleted but the test still exists, the loader throws at module load (`parseStyleGuideFrontmatter` throws "no YAML frontmatter found"). So Plan A and Plan D MUST land in the same commit, OR Plan D must land BEFORE Plan A (delete the test first; then deleting the frontmatter is safe).
- **Recommended ordering:** Plan D before Plan A, OR fold D into A as one atomic commit.

**Plan E: `no-legacy-markers.test.ts` patch (CONDITIONAL).**
- **Research finding (see Q6 below):** `tests/architecture/no-legacy-markers.test.ts` does NOT reference the YAML frontmatter keys (`status_tokens`, `reasons`, `markers`, `pattern_classes`). Its source set is hard-coded byte literals (`"pi-subagents is not loaded; "`, etc.) -- these are the 5 ES-5 marker strings that V1 wrappers and `presentation/*` composers continue to use through Phase 21.
- **Plan E is NOT needed in Phase 17.** Listed for completeness; the planner should confirm by running `npm run check` after Plans A/B/C/D land.

### Plan dependency graph

```
        Plan A (style guide v1.0 -> v2.0)
                    |
                    v
        Plan D (delete grammar-frontmatter.test.ts + REQUIREMENTS edit)
                    |
                    | (no dependency)
                    v
Plan B (catalog v1.0 -> v2.0)
                    |
                    v
        Plan C (catalog-uat.test.ts rewrite)
                    |
                    v
        `npm run check` GREEN gate
```

**Critical ordering:**
- Plan D must NOT run before Plan A removes the frontmatter (otherwise grammar-frontmatter.test.ts still exists asserting parity against a frontmatter that just got deleted -- but it errors at module load, not at runtime, so the failure mode is the test file failing to load rather than asserting). The safest order is D before A, OR D and A in the same commit.
  - **Actual constraint:** If A runs first (frontmatter deleted from style guide) and D hasn't yet run, the next `npm run check` will fail because `tests/lint-rules/lib/frontmatter.js`'s `parseStyleGuideFrontmatter` throws "no YAML frontmatter found" at module load → the test crashes. So A and D ARE coupled; either land together OR D first.
- Plan B must run before Plan C: Plan C asserts byte-equality against Plan B's catalog text.

### Alternative grouping (minimum-plan ordering)

If the planner wants the smallest number of atomic plans (3 instead of 5):

**Plan I: Spec rewrite + test deletion + traceability edit (D + A combined).**
- Delete `grammar-frontmatter.test.ts` AND delete frontmatter from style guide in same commit.
- Rewrite style guide body to v2.0.
- Update REQUIREMENTS.md SNM-26 + per-phase distribution line.
- Add ADR Phase 17 cross-reference.

**Plan II: Catalog rewrite (B).**
- Rewrite catalog to v2.0.

**Plan III: Catalog UAT test rewrite (C).**
- Swap V1 composers for `notify()`.

Three-plan ordering is the cleanest atomic-per-plan structure and minimizes inter-plan dependency edges.

## Critical Files & Patterns

### Source files Phase 17 modifies

| File | Lines (v1) | Action | Owner Plan |
|------|-----------|--------|------------|
| `docs/messaging-style-guide.md` | 954 | Full rewrite v1.0 -> v2.0 (~150-250 lines target). Delete YAML frontmatter (lines 1-65). | A (or I) |
| `docs/output-catalog.md` | 971 | Full rewrite v1.0 -> v2.0; preserve 14 H2 + recovery + empty + usage sections; rewrite all 49 `<!-- catalog-state: -->` block bytes. | B (or II) |
| `tests/architecture/catalog-uat.test.ts` | 1982 | Parser-preserving renderer swap. Drop V1-composer imports; introduce mock-pi shape; introduce `Map<(section, state), NotificationMessage>` fixture map. | C (or III) |
| `.planning/REQUIREMENTS.md` | -- | SNM-26 row: owner `Phase 21` -> `Phase 17`; status `Pending` -> `Complete`. Per-phase distribution line: Phase 17 (3 -> 4: +SNM-26); Phase 21 (8 -> 7: -SNM-26). | A or D (Claude's Discretion) |
| `docs/adr/v2-001-structured-notify.md` | 197 | One-line Phase 17 cross-reference inside Accepted-status block (success criterion #5). | A (or II -- Claude's Discretion) |

### Source files Phase 17 deletes

| File | Lines | Reason |
|------|-------|--------|
| `tests/architecture/grammar-frontmatter.test.ts` | 91 | Frontmatter `<-> REASONS` parity no longer applicable when frontmatter is deleted. Compile-time closed-set proof in `tests/architecture/notify-types.test.ts` is the binding authority. |

### Source files Phase 17 reads (does NOT modify)

| File | Lines | Purpose |
|------|-------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | 1065 | The v2 grammar IS this file's renderer. Phase 17 catalog UAT imports `notify()` + types. NOT modified. |
| `tests/shared/notify-v2.test.ts` | 1141 | Phase 16 per-variant unit tests; the SEED fixtures for Phase 17 catalog rewrites (D-16-18). NOT modified. |
| `tests/architecture/notify-types.test.ts` | 570 | Compile-time closed-set proof. Style-guide v2.0 §"Type Model Reference" cites this. NOT modified. |
| `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` | 72 | `Reason` type + `REASONS` array; still imported by `shared/notify.ts` per Phase 15 D-15-03. NOT modified in Phase 17 (Phase 21 SNM-29 decides retain-or-retire). |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | 86 | `SoftDepStatus` interface + `softDepStatus(pi)` probe. NOT modified. |
| `tests/shared/notify.test.ts` | 90 | V1 wrappers reference. Provides the mock-ctx pattern (line 17-23). NOT modified. |
| `tests/architecture/no-legacy-markers.test.ts` | 134 | Read for impact assessment. Source set is hard-coded byte literals (lines 58-64) -- does NOT reference style-guide frontmatter. Phase 17 does NOT patch. |
| `extensions/pi-claude-marketplace/presentation/*` | various | V1 composers consumed by V1 wrappers. Read-only references. NOT modified. |

### Established patterns (carry through)

- **Mock-ctx test pattern (Phase 16):** `tests/shared/notify-v2.test.ts:130-179` defines:
  ```typescript
  interface MockCtx { ui: { notify: ReturnType<typeof mock.fn> }; }
  function makeCtx(): MockCtx { return { ui: { notify: mock.fn() } }; }
  interface MockPi { getAllTools: () => MockTool[]; }
  function piWithBothLoaded(): MockPi { return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] }; }
  function piWithNothingLoaded(): MockPi { return { getAllTools: () => [] }; }
  ```
  Phase 17 catalog UAT lifts these mock factories verbatim (or imports from a shared fixtures module if the planner factors them out per Claude's Discretion).

- **Severity-arg assertion shape:** Tests assert via `mock.calls[0]!.arguments` length + values:
  ```typescript
  // info severity: omit 2nd arg, arguments.length === 1
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
  // warning: arguments = [body, "warning"], length === 2
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [body, "warning"]);
  // error: arguments = [body, "error"], length === 2
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [body, "error"]);
  ```

- **Catalog parser pattern (V1 carry-forward):** `tests/architecture/catalog-uat.test.ts:92-150` (`loadCatalogExamples`):
  - Walks lines tracking `currentSection` (per-command H2 boundaries via `/^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors)\s*$/`).
  - Pairs `<!-- catalog-state: ([a-z0-9-]+) -->` with the NEXT fenced block.
  - Non-command H2 sections reset `currentSection` to `null`; subsequent fenced blocks are skipped.
  - Returns `readonly CatalogExample[]` with `{ section, state, expected }`.

- **D-11 layering for catalog UAT imports:** Phase 17's rewritten test imports only:
  ```typescript
  import {
    notify,
    type NotificationMessage,
  } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
  ```
  Does NOT import from `presentation/*` (V1 composers per D-17-03 pure exclusion).

## Key Technical Details

### Q1. `notify()` public surface for catalog UAT driving

**Signature** (`extensions/pi-claude-marketplace/shared/notify.ts:1034-1038`):
```typescript
export function notify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: NotificationMessage,
): void
```

**Mock-ctx shape** (verbatim from `tests/shared/notify-v2.test.ts:130-142`):
```typescript
import test, { mock } from "node:test";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}
```

**Mock-pi shape** (verbatim from `tests/shared/notify-v2.test.ts:144-179`):
```typescript
interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

function piWithBothLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

function piWithSubagentsLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }] };
}

function piWithMcpLoaded(): MockPi {
  return { getAllTools: () => [{ name: "mcp" }] };
}

function piWithNothingLoaded(): MockPi {
  return { getAllTools: () => [] };
}
```

**Output extraction** (verbatim from Phase 16's pattern at `tests/shared/notify-v2.test.ts:209-214`):
```typescript
notify(ctx as never, pi as never, msg);
assert.equal(ctx.ui.notify.mock.calls.length, 1);
const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
const body = callArgs[0];          // the rendered body string
const severity = callArgs[1];      // undefined | "warning" | "error"
```

**Phase 17 reuse decision (Claude's Discretion):** The planner picks one of three approaches:
1. **Inline duplication** -- copy the 4 mock-pi factories + `MockCtx` + `makeCtx` into `tests/architecture/catalog-uat.test.ts` (~50 lines of test-helper duplication; cleanest atomic-per-plan).
2. **Shared helpers module** -- extract to `tests/architecture/catalog-fixtures.ts` (or `tests/shared/mock-pi.ts`), imported by both `notify-v2.test.ts` and `catalog-uat.test.ts` (DRY win, but adds a refactor edge for Phase 16's already-shipped test file).
3. **Import directly from `notify-v2.test.ts`** -- node:test files are valid ESM modules; the mock factories could in principle be exported from `notify-v2.test.ts`. NOT RECOMMENDED -- couples two unrelated test files and confuses test-runner discovery.

**Recommendation:** Option 1 (inline duplication) for Phase 17. It satisfies atomic-per-plan, keeps Phase 16 untouched, and adds only ~50 lines of well-understood test-helper code. Option 2 can land later in Phase 21 if duplication becomes painful.

### Q2. `NotificationMessage` discriminated union shape

**Top-level envelope** (`shared/notify.ts:485-487`):
```typescript
export interface NotificationMessage {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}
```

**Marketplace-level** (`shared/notify.ts:464-470`):
```typescript
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;   // "added" | "removed" | "updated" | "failed" | undefined
  readonly details?: MarketplaceDetails; // { autoupdate: boolean; lastUpdatedAt?: string }
  readonly plugins: readonly PluginNotificationMessage[];
}
```

**Plugin-level discriminated union** (`shared/notify.ts:438-448`): `PluginNotificationMessage` is the union of 10 variants, all discriminating on `status`. Per-variant required/optional fields verified from `shared/notify.ts:288-448`:

| Variant | status literal | Required fields beyond `name` | Optional fields |
|---------|---------------|------------------------------|-----------------|
| `PluginInstalledMessage` | `"installed"` | `dependencies: readonly Dependency[]` | `version?`, `scope?` |
| `PluginUpdatedMessage` | `"updated"` | `from: string; to: string; dependencies: readonly Dependency[]` | `scope?` |
| `PluginReinstalledMessage` | `"reinstalled"` | `dependencies: readonly Dependency[]` | `version?`, `scope?` |
| `PluginUninstalledMessage` | `"uninstalled"` | (none) | `version?`, `scope?` |
| `PluginAvailableMessage` | `"available"` | (none) | `version?` (**NO scope** per MSG-PL-6 carve-out) |
| `PluginUnavailableMessage` | `"unavailable"` | `reasons: readonly Reason[]` | `version?` (**NO scope** per MSG-PL-6) |
| `PluginUpgradableMessage` | `"upgradable"` | `reasons: readonly Reason[]` | `version?`, `scope?` |
| `PluginFailedMessage` | `"failed"` | `reasons: readonly Reason[]` | `version?`, `scope?`, `cause?: Error`, `rollbackPartial?: readonly { phase: string; cause?: Error }[]` |
| `PluginSkippedMessage` | `"skipped"` | `reasons: readonly Reason[]` | `version?`, `scope?` |
| `PluginManualRecoveryMessage` | `"manual recovery"` (WITH SPACE) | `reasons: readonly Reason[]` | `version?`, `scope?`, `cause?: Error` |

**Smallest valid fixture per status** (one-liner per status -- these become the seeds for the catalog UAT fixture map):

```typescript
// installed (info severity, reload-hint, soft-dep marker)
{ status: "installed", name: "alpha", dependencies: [] }
// updated (info severity, reload-hint, version arrow)
{ status: "updated", name: "alpha", from: "1.0.0", to: "1.1.0", dependencies: [] }
// reinstalled
{ status: "reinstalled", name: "alpha", dependencies: [] }
// uninstalled
{ status: "uninstalled", name: "alpha" }
// available (NO scope ever; list-surface)
{ status: "available", name: "alpha" }
// unavailable (NO scope; reasons required)
{ status: "unavailable", name: "alpha", reasons: ["hooks"] }
// upgradable (reasons required)
{ status: "upgradable", name: "alpha", reasons: ["stale clone"] }
// failed (reasons required; cause + rollbackPartial optional)
{ status: "failed", name: "alpha", reasons: ["permission denied"] }
// skipped (reasons required)
{ status: "skipped", name: "alpha", reasons: ["up-to-date"] }
// manual recovery (WITH SPACE in literal)
{ status: "manual recovery", name: "alpha", reasons: ["unreadable"] }
```

**MarketplaceStatus**: 4 literals -- `"added" | "removed" | "updated" | "failed"`. No `"skipped"` per Phase 15 D-15-07.

### Q3. Catalog state inventory

The v1.0 catalog defines **49 `<!-- catalog-state: STATE -->` annotations** across 14 per-command H2 sections + 1 recovery anchor section. Total unique (section, state) tuples Phase 17 must cover:

| Section | States | Count |
|---------|--------|-------|
| `` /claude:plugin list `` | empty, single-mp-mixed, same-plugin-both-scopes, project-orphan-folded, soft-dep-on-installed, unparseable-mp, zero-plugin-mp-block, multiple-mps | 8 |
| `` /claude:plugin install <plugin>@<marketplace> `` | success, success-with-soft-dep, failure-unsupported-features, failure-runtime-with-cause, failure-rollback-partial | 5 |
| `` /claude:plugin uninstall <plugin>@<marketplace> `` | success, success-soft-dep-omitted, failure-permission-denied | 3 |
| `` /claude:plugin reinstall `` | single-mp-all-reinstalled, success-with-soft-dep, single-mp-mixed-outcomes, single-mp-all-failed, plugin-became-unavailable, bare-multi-mp, same-mp-both-scopes | 7 |
| `` /claude:plugin update `` | single-mp-mixed, failed-with-rollback-partial, all-up-to-date-noop, bare-multi-mp, same-mp-both-scopes | 5 |
| `` /claude:plugin import `` | fresh-mixed-both-scopes, scope-project-narrow, source-mismatch, soft-dep-markers, same-mp-both-scopes | 5 |
| `` /claude:plugin bootstrap `` | fresh, already-bootstrapped | 2 |
| `` /claude:plugin marketplace list `` | empty, mixed-scopes | 2 |
| `` /claude:plugin marketplace add <source> `` | path-source, github-source, failure-unreachable | 3 |
| `` /claude:plugin marketplace remove <name> `` | clean, partial | 2 |
| `` /claude:plugin marketplace update <name> `` | autoupdate-off-manifest-refresh, mixed-outcomes, mp-failure-network | 3 |
| `` /claude:plugin marketplace autoupdate <enable\|disable> <name> `` | enable-mixed, disable-mixed, failure-not-found | 3 |
| Manual recovery anchors | install-failure-with-anchor | 1 |
| **Total** | | **49** |

**Phase 16 fixture coverage of these states:** The 32 per-variant unit tests in `tests/shared/notify-v2.test.ts` cover the atomic building blocks (one test per plugin variant + per marketplace status + per cross-cutting case). They do NOT directly map 1:1 to the 49 catalog states; instead they provide composable seeds. Phase 17 plans MUST compose multi-plugin / multi-marketplace `NotificationMessage` fixtures from these seeds (e.g. `single-mp-mixed-outcomes` needs one marketplace with 3 plugin children: installed + skipped + failed).

**Catalog states that need NEW composition (not directly in Phase 16 fixtures):**
- All cascade states (`single-mp-mixed`, `single-mp-mixed-outcomes`, etc.) -- multi-plugin compositions.
- All multi-marketplace states (`bare-multi-mp`, `multiple-mps`, `fresh-mixed-both-scopes`, etc.) -- multi-marketplace compositions.
- Marketplace-list surface details rendering (`mixed-scopes`) -- uses `MarketplaceDetails` with `autoupdate: true` / `false`.
- Source-mismatch composite (`source-mismatch`) -- needs both `(failed) {source mismatch}` marketplace header + child plugin `(skipped) {source mismatch}` row.

**Catalog states that may NOT directly translate to v2 (need new model):**
- `(no plugins)` rendering on PER-MARKETPLACE block (catalog v1: `● empty-mp [project]\n  (no plugins)`). Per Phase 15 D-15-08, **empty `plugins: []` IS the structural representation**; the renderer emits the bare header alone, NOT a `(no plugins)` sentinel line. This is a SPEC DIVERGENCE between catalog v1.0 (which emits the literal `(no plugins)`) and the v2 renderer (which does NOT). The v2 catalog must drop the `(no plugins)` line per this Phase 15 decision.
- The empty top-level case is the SOLE place `(no marketplaces)` appears -- verified by `tests/shared/notify-v2.test.ts:578-588`. The catalog v2 keeps this for `marketplace list` empty.
- Manual-recovery anchor's free-text indented child rows (`orphan path: /...`, `parse failure: ...`) -- these are NOT currently emitted by the v2 renderer's `manual recovery` variant. The variant carries `reasons` and optional `cause: Error`; the renderer emits the row + optional cause-chain trailer but NOT free-text indented orphan-path lines. **The catalog's `install-failure-with-anchor` state shape may need adjustment** OR the planner accepts that the v2 catalog drops the orphan-path indented child rows entirely (relying on the cause-chain trailer to surface the diagnostic).

### Q4. Renderer output coverage of v2 grammar landmines

Per `tests/shared/notify-v2.test.ts` (32 tests, lines 189-1141), Phase 16 already exercises:

| Grammar landmine | Phase 16 test (line) | Phase 17 catalog state needing it |
|------------------|---------------------|-----------------------------------|
| Same-scope plugin row (omits scope bracket) | Test 21a (line 786) BLOCKER-1 coverage | Every single-plugin install/update/uninstall/reinstall state (success, etc.) |
| Orphan-fold case (plugin.scope ≠ marketplace.scope, emits bracket) | Test 21 (line 742) | `project-orphan-folded` (`/claude:plugin list`) |
| Multi-marketplace blank-line discipline (D-16-07) | Test 20 (line 705) | All `bare-multi-mp` + `multiple-mps` + `fresh-mixed-both-scopes` states |
| Reload-hint suppression on failed-only payloads (D-16-12) | Test 28 (line 1048) | `single-mp-all-failed`, `failure-runtime-with-cause`, `mp-failure-network`, `failure-permission-denied`, `failure-unreachable`, `failure-not-found` |
| Soft-dep marker rendering (`{requires pi-subagents}`, `{requires pi-mcp}`) | Tests 2 (line 216), 3 (line 243), 4 (line 271), plus `soft-dep-on-installed` / `soft-dep-markers` test setup | `soft-dep-on-installed`, `success-with-soft-dep` (multiple sections), `soft-dep-markers` (import) |
| Per-plugin inline cause chains (D-16-08, no separate cascade-summary line) | Test 23 (line 885), Test 24 (line 930) | `failure-runtime-with-cause`, `failed-with-rollback-partial`, `failure-permission-denied`, `partial` (marketplace remove), `mp-failure-network`, `failure-unreachable` |
| `(no marketplaces)` empty rendering (planner pick) | Test 17 (line 578) | `empty` (`/claude:plugin marketplace list`) |
| `(no plugins)` rendering -- **DROPPED in v2** | (none -- no test asserts a literal `(no plugins)` body) | `empty` (`/claude:plugin list`) → MUST change in catalog rewrite |
| Empty plugins on state-change marketplace (bare header only) | Test 11 (line 475) | `path-source`, `github-source`, `clean` (marketplace remove), `autoupdate-off-manifest-refresh`, `failure-unreachable`, `failure-not-found`, `enable-mixed`, `disable-mixed` |
| Multi-cause cascade with per-plugin causes | Test 24 (line 930) | `single-mp-mixed-outcomes` (when failed plugins carry causes), `partial` (marketplace remove), `source-mismatch` |
| `rollbackPartial` child rows at 4-space indent (D-16-08) | Test 22 (line 845), Test 23 (line 885) | `failure-rollback-partial`, `failed-with-rollback-partial` |
| `manual recovery` literal with space | Test 30 (line 1112) | `install-failure-with-anchor` |
| SUB-BRANCH B list-surface marketplace header with details | Test 15 (line 529) | `mixed-scopes` (`/claude:plugin marketplace list`) -- uses `MarketplaceDetails.autoupdate` + `lastUpdatedAt?` |
| SUB-BRANCH A bare list-surface header (no details) | Test 17a (line 604) BLOCKER-3 coverage | Plugin-list marketplace headers without explicit details (most `list` cascades) |
| Severity routing: info / warning / error (D-16-11) | Tests 25/26/27 (lines 974, 993, 1019) | Every state's severity assertion |
| Failed marketplace WITH failed children -- both severity & no-reload-hint | Test 9 (line 437), Test 13 (line 514), Test 28 (line 1048) | `single-mp-all-failed`, `source-mismatch`, `partial` |

**States with no direct Phase 16 fixture seed (need new composition in catalog UAT):**
- `same-mp-both-scopes` (reinstall, update, import) -- 3 separate top-level marketplaces (project before user); composition is straightforward via multiple `MarketplaceNotificationMessage` entries in `marketplaces[]`.
- `fresh-mixed-both-scopes` (import) -- 6 marketplaces, varied per-scope outcomes. Complex composition; the v1 fixture builds 6 separate `cascadeSummary` blocks. v2 equivalent: 6 `MarketplaceNotificationMessage` entries in one `NotificationMessage`.
- `source-mismatch` (import) -- has the "Existing marketplace source ... does not match Claude settings source ..." DIAGNOSTIC LINE that V1 emits inline. **This diagnostic line is NOT in the v2 grammar.** The v2 renderer doesn't surface free-text inline error diagnostics on marketplace headers. The catalog v2 must either drop this diagnostic OR Phase 17 introduces a v2 grammar extension (out of scope per D-17-04 -- the catalog is the forward-looking spec, not a behavioral patch). **Recommendation:** catalog v2 drops the diagnostic line; the marketplace header carries `(failed) {source mismatch}` and the plugin row carries `(skipped) {source mismatch}` (matching the existing v1 catalog structure minus the diagnostic).

**Open question for the planner:** Does the v2 catalog preserve V1's free-text "diagnostic line" augmentations (`source-mismatch` diagnostic line; `partial` `Fix the underlying issue and retry.` retry anchor; `fresh-mixed-both-scopes` `Claude plugin import summary` preamble)? These are V1 composer outputs that `notify()` does NOT emit. **Three options:**
1. Catalog v2 drops them entirely (cleanest; matches v2 grammar). The planner must explicitly call this out in the catalog rewrite as a v1->v2 behavior change.
2. Catalog v2 keeps them, and the catalog UAT runner runs `notify()` AND wraps the result with the legacy preamble/anchors (composing the V1+V2 hybrid). REJECTED -- violates D-17-03 pure exclusion.
3. Phase 17 extends `notify()` to support a top-level preamble/anchor field. OUT OF SCOPE -- Phase 17 is documentation/test-only; no production source changes.

**Research recommendation:** Option 1. The v2 catalog drops the preamble + retry anchor + diagnostic line. The planner should document this as an intentional v1->v2 simplification in the catalog rewrite plan's notes.

### Q5. Catalog-state-marker parser design

The walking logic at `tests/architecture/catalog-uat.test.ts:92-150` (`loadCatalogExamples`) is preserved verbatim. Phase 17 changes only:

**What stays:**
- `sectionRe` regex: `/^## (\`(\/claude:plugin [^\`]+)\`|Manual recovery anchors)\s*$/` (verified at line 100).
- `stateRe` regex: `/^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/` (verified at line 101).
- Walking loop (lines 103-149).
- The two ancillary tests (`loadCatalogExamples: returns no examples when the catalog has no annotations` at line 1951; `loadCatalogExamples: pairs each discriminator with its next fenced block` at line 1958).

**What changes:**

1. **Imports:** Drop the V1-composer imports at lines 44-52:
   ```typescript
   // DELETE:
   import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
   import {
     appendReloadHint,
     cascadeSummary,
     renderManualRecovery,
     renderMarketplaceList,
     renderRow,
   } from "../../extensions/pi-claude-marketplace/presentation/index.ts";
   import { renderPluginList } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";
   ```
   Replace with:
   ```typescript
   import {
     notify,
     type NotificationMessage,
   } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
   import { mock } from "node:test";
   ```

2. **Drop V1 type imports** at lines 54-63:
   ```typescript
   // DELETE all of these:
   import type {
     EntityErrorRow,
     ManualRecoveryLine,
     MarketplaceRow,
     PluginCascadeRow,
     PluginInlineRow,
     PluginInlineUninstalledRow,
     SoftDepProbe,
   } from "../../extensions/pi-claude-marketplace/presentation/index.ts";
   import type { PluginListMarketplaceBlock } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";
   ```

3. **Add mock-pi/ctx helpers** (copy from `tests/shared/notify-v2.test.ts:130-179`).

4. **Replace `FixtureMap` shape:**
   ```typescript
   // BEFORE (line 187-189):
   type FixtureFactory = () => string;
   type FixtureMap = Readonly<Record<string, Readonly<Record<string, FixtureFactory>>>>;

   // AFTER:
   interface CatalogFixture {
     readonly message: NotificationMessage;
     readonly pi: MockPi;  // for soft-dep probe variation
     readonly expectedSeverity?: "warning" | "error";  // optional: assert severity arg too
   }
   type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;
   ```

5. **Replace `FIXTURES` constant** (lines 190-1872) entirely -- every section's fixture entries rewrite from V1-composer factories to `NotificationMessage` structured payloads.

6. **Replace test driver loop** (lines 1878-1949):
   ```typescript
   // BEFORE: factory() returns a string assembled from V1 composers.
   const actual = factory();
   if (actual !== example.expected) { ... }

   // AFTER: drive notify() via mock ctx + mock pi, extract emitted body.
   const ctx = makeCtx();
   notify(ctx as never, fixture.pi as never, fixture.message);
   assert.equal(ctx.ui.notify.mock.calls.length, 1);
   const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
   const actual = callArgs[0];
   if (actual !== example.expected) {
     failures.push({ section, state, kind: "byte-mismatch", expected: example.expected, actual });
   }
   // Optional severity-arg assertion:
   if (fixture.expectedSeverity !== undefined && callArgs[1] !== fixture.expectedSeverity) { ... }
   ```

**Concrete test-loop pseudo-code (Phase 17 shape):**

```typescript
test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with a fixture via notify()", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);  // SAME function, unchanged

  assert.ok(examples.length >= 30, `Expected at least 30 annotated catalog examples; found ${examples.length}.`);

  interface Failure { /* same shape as V1 */ }
  const failures: Failure[] = [];

  for (const example of examples) {
    const sectionFixtures = FIXTURES[example.section];
    if (sectionFixtures === undefined) {
      failures.push({ section: example.section, state: example.state, kind: "missing-fixture" });
      continue;
    }
    const fixture = sectionFixtures[example.state];
    if (fixture === undefined) {
      failures.push({ section: example.section, state: example.state, kind: "missing-fixture" });
      continue;
    }

    // Phase 17 NEW: drive notify() instead of V1 composers.
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(ctx.ui.notify.mock.calls.length, 1, `${example.section}::${example.state}: expected exactly one ctx.ui.notify call`);

    const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const actual = callArgs[0];

    if (actual !== example.expected) {
      failures.push({ section: example.section, state: example.state, kind: "byte-mismatch", expected: example.expected, actual });
    }
  }

  if (failures.length > 0) { /* same formatting as V1 */ }
});
```

### Q6. `tests/architecture/no-legacy-markers.test.ts` blast radius

**Verified by file inspection (lines 58-86):** The test pins 5 legacy ES-5 marker strings BYTE-FOR-BYTE in the test body:
```typescript
const LEGACY_MARKER_STRINGS: ReadonlyArray<string> = [
  "pi-subagents is not loaded; ",
  "pi-mcp-adapter is not loaded; ",
  "Run /reload to ",
  "MANUAL RECOVERY REQUIRED: ",
  "(rollback partial: ",
];
```

The `ALLOW_LIST` (lines 66-86) names 6 files that may contain these literals; the source set is byte-grep across `extensions/pi-claude-marketplace` + `tests` directories.

**Does this test reference style-guide frontmatter?** NO. Verified via `grep -n "status_tokens\|reasons\|markers\|pattern_classes\|frontmatter" tests/architecture/no-legacy-markers.test.ts` -- only "markers.ts" (referring to `shared/markers.ts` file path) and "markers-snapshot" (referring to a different test file path) appear. The test does NOT load the style guide's YAML frontmatter, does NOT parse it, and does NOT cross-reference it.

**Conclusion:** Phase 17's deletion of the YAML frontmatter from `docs/messaging-style-guide.md` has **ZERO impact on `no-legacy-markers.test.ts`**. Plan E is NOT needed.

**Per CONTEXT.md:** "Reviewing / updating `tests/architecture/no-legacy-markers.test.ts` source set against V2 vocabulary -- Phase 21 (SNM-28); Phase 17 only patches it if `npm run check` breaks as a side-effect." Phase 17 should run `npm run check` after all plans land to confirm -- but the static analysis above confirms no breakage.

### Q7. Style guide v2.0 line-count budget

**v1.0 inventory** (954 lines total):
- YAML frontmatter (lines 1-65): 65 lines.
- §0 Overview (96-102): 7 lines.
- §1 Foundational Rule: Line Grammar (104-123): 20 lines.
- §2 Status Icons (126-161): 36 lines.
- §3 Status Tokens (164-193): 30 lines.
- §4 Reasons Enum (196-230): 35 lines.
- §5 Reload Hint (233-252): 20 lines.
- §6 Soft-Dependency Markers (255-287): 33 lines.
- §7 Manual Recovery (289-313): 25 lines.
- §8 Rollback Partial (316-336): 21 lines.
- §9 Cause Chain (339-355): 17 lines.
- §10 Severity Routing (358-391): 34 lines.
- §11 Plugin List Rendering (394-437): 44 lines.
- §12 Non-Cascade & Usage Errors (440-469): 30 lines.
- §13 Empty Results (472-491): 20 lines.
- §14 IL-3 console.warn (494-522): 29 lines.
- §15 ES-5 Replacement Table (525-538): 14 lines.
- §16 Pattern Class Reference (543-802): **260 lines**.
- §17 Worked Examples Gallery (804-906): **103 lines**.
- §18 Conventions (908-934): 27 lines.
- §19 Cross-References (936-954): 19 lines.

**v2.0 target inventory** (~5-7 H2 sections, ~150-250 lines per D-17-07):

| § | v2.0 Section | Line budget | Source / replacement strategy |
|---|--------------|-------------|------------------------------|
| 1 | Overview | ~20-30 | New 2-3 paragraph intro: purpose, audience, v1.0->v2.0 supersession note. Drop v1 §0 ToC + most v1 §0 prose. |
| 2 | Type Model Reference | ~30-50 | Replaces v1 §3 + §4 + §6 enumeration. Pointers at `shared/notify.ts` (types + const tuples + `notify(ctx, pi, message)` renderer) and `tests/architecture/notify-types.test.ts` (compile-check). May embed a small inline TS snippet showing `NotificationMessage` discriminated-union shape per Claude's Discretion. |
| 3 | Output Grammar Summary | ~40-70 | Compress v1 §1 + §2 + §5 + §7 + §8 + §9 + §11 + §13 + §18 into a single page of bullet rules. Always-marketplace-header form; indentation discipline (0/2/4/6-space ladder); computed severity routing; computed reload-hint; computed soft-dep markers; inline per-plugin cause chains; no separate cascade-summary line. |
| 4 | Severity Routing | ~20-30 | Replaces v1 §10. First-match-wins ladder: failed -> error; skipped/manual recovery -> warning; else info. May absorb v1 §12 (non-cascade & usage errors) IF the planner picks compact treatment. |
| 5 | ES-5 Supersession Table | ~25 | VERBATIM RETAIN from v1 §15 (lines 525-538) per D-17-08; ADD one-line annotation "fully retired Phase 21 -- see `tests/architecture/no-legacy-markers.test.ts`". |
| 6 | Cross-References | ~15-25 | New shape: links to `docs/output-catalog.md` (byte-equal examples), `docs/adr/v2-001-structured-notify.md` (design rationale), `extensions/pi-claude-marketplace/shared/notify.ts` (types + renderer), `tests/architecture/notify-types.test.ts` (closed-set proof), `tests/architecture/catalog-uat.test.ts` (user-contract gate), PRD §6.12 (ES-5 origin). |

**Deletions:**
- YAML frontmatter (65 lines) -- D-17-01.
- §16 Pattern Class Reference (260 lines) -- patterns flow from the discriminated-union switches in `shared/notify.ts`; per-command examples live in the catalog.
- §17 Worked Examples Gallery (103 lines) -- merged into the catalog's per-command sections.
- §3 Status Tokens, §4 Reasons Enum standalone enumeration -- replaced by a single sentence pointing at the const tuples.
- §11 Plugin List Rendering -- folded into "Output Grammar Summary" (binding form is in catalog).
- §14 IL-3 console.warn -- pointed at (cross-reference) rather than redocumented in this guide.
- §16 + §17 + §18 Conventions -- most subsumed by Output Grammar Summary or moved to catalog.

**Net target:** ~150-230 lines. The planner picks exact boundary within D-17-07's ~150-250 range based on whether §12 absorbs cleanly into §4 (lower end) or stays separate (upper end).

**Net-LoC math:** 954 -> ~200 = ~-754 lines from the style guide alone (matches PROJECT.md v1.4 milestone target ~-720 from style guide).

### Q8. Catalog v2.0 size + structure

**v1.0 inventory** (971 lines total):
- Top preamble + §Conventions (lines 1-129): **129 lines**.
- §Severity routing (130-141): 12 lines.
- §Status token reference (142-159): 18 lines.
- 14 per-command H2 sections + Manual recovery anchors (162-893): **732 lines**.
- §Empty / no-op surfaces (901-909): 9 lines.
- §Usage errors (912-921): 10 lines.
- §Resolutions to apply to docs/messaging-style-guide.md (925-963): **39 lines** (authoring scratchpad).
- §Cross-references (967-971): 5 lines.

**v2.0 target inventory:**

| Section | v1.0 lines | v2.0 budget | Strategy |
|---------|-----------|-------------|----------|
| Top preamble + Conventions | 129 | ~60-80 | Trim. The v2 always-marketplace-header rule eliminates the single-plugin carve-out (lines 59-61 of v1) and simplifies the marketplace-header rule (lines 38-50). The fold-rule explanation (lines 24-37) survives but is shorter -- v2 still has orphan-fold but the explanation is simpler. Glyphs, scope-bracket discipline, reasons rendering, autoupdate marker all survive. |
| Severity routing | 12 | ~10 | Simplify. v2 collapses to a 3-tier ladder (info / warning / error); the table format is preserved but shorter. |
| Status token reference | 18 | ~12-15 | Trim. The 10-plugin-status + 4-marketplace-status table is preserved; per-token "Where it appears" column can be terser. |
| 14 per-command H2 sections + recovery anchor | 732 | ~640-720 | Rewrite. Every section's expected outputs use the always-marketplace-header form. Single-plugin commands (install/uninstall) get the biggest visual change: one-line -> two-line. Multi-marketplace cascades get a structural simplification: no "Claude plugin import summary" preamble (v2 doesn't emit it); no "Fix the underlying issue and retry" retry anchor (v2 doesn't emit it); no source-mismatch diagnostic line (v2 doesn't emit it). |
| Empty / no-op surfaces | 9 | ~6 | Trim the per-surface table; remove the per-marketplace `(no plugins)` line per Phase 15 D-15-08 (renderer emits bare header alone). |
| Usage errors | 10 | ~8-10 | Largely preserved -- `notifyUsageError` shape is unchanged in v2 (still `${message}\n\n${usage}` with `"error"` severity). |
| Resolutions section | 39 | 0 | Either DELETE entirely (it was an authoring scratchpad for v1.0 -> v1.0-spec alignment) OR fold a 5-line "supersession" annotation into the preamble. Claude's Discretion. Recommended: DELETE. |
| Cross-references | 5 | ~5-10 | Update to point at v2.0 style guide and v2.0 source files. |

**Net target:** ~750-850 lines. Approximately net-neutral vs v1.0 -- the v2 catalog stays roughly the same length because the per-command outputs get LONGER (two-line headers replace one-line outputs for single-plugin commands) but the rest gets SHORTER (simpler conventions, no scratchpad).

**Outputs that get LONGER in v2:**
- Every single-plugin install/uninstall/reinstall/update success state (one-line -> two-line).
- Every single-marketplace add/remove/update (already two-line in v1; same in v2).

**Outputs that get SHORTER in v2:**
- `Claude plugin import summary` preamble dropped from import surfaces.
- `Fix the underlying issue and retry.` retry anchor dropped from `marketplace remove partial`.
- `Existing marketplace source ... does not match Claude settings source ...` diagnostic line dropped from `import source-mismatch`.
- Per-marketplace `(no plugins)` line dropped from `zero-plugin-mp-block` in `list`.
- §Resolutions scratchpad entirely deleted (39 lines).

**Per-command sample byte-form change (single-plugin install success):**

v1:
```text
● helper@official [user] v1.0.0 (installed)

/reload to pick up changes
```

v2:
```text
● official [user] (added)
  ● helper v1.0.0 (installed)

/reload to pick up changes
```

Wait -- that's not right. The fixture would need to set `mp.status` to something for this case. Re-reading Phase 16 test 1 (line 189-214): a single-plugin install uses `mp.status === "added"`, but that's wrong for an INSTALL operation where the marketplace already exists. Let me re-check.

**Actually, for `install`, the marketplace is unchanged -- only the plugin is installed.** The v2 catalog state would be:
```text
● official [user]
  ● helper v1.0.0 (installed)

/reload to pick up changes
```
-- marketplace header is SUB-BRANCH A (`status: undefined`, `details: undefined`, bare header), plugin row is the installed plugin. This is the same SUB-BRANCH A shape Phase 16 test 17a (line 604) verifies as no-crash.

**This is a subtle but important catalog-rewrite consideration:** The v2 single-plugin install fixture sets `mp.status` to undefined (the marketplace was not just added -- it already existed). The reload-hint trigger fires because `plugin.status === "installed"` is in `{installed, updated, reinstalled, uninstalled}` per D-16-12, even though `mp.status === undefined`.

The CONTEXT.md goal example wording was slightly imprecise: it shows `● claude-plugins-official [user]\n  ● commit-commands (installed)` -- that IS the v2 form with `mp.status === undefined`. The planner should follow that form.

### Q9. REQUIREMENTS.md traceability table edit shape

**Verified by file read** (`.planning/REQUIREMENTS.md` lines 96-116):

**Lines to edit:**
- Line 103: `| SNM-26 | Phase 21 | Pending |` → `| SNM-26 | Phase 17 | Complete |` (after phase completion).
- Line 116 (per-phase distribution line):

  Current: `- Per-phase distribution: Phase 15 (12: SNM-01..11, SNM-21); Phase 16 (8: SNM-12..18, SNM-30); Phase 17 (3: SNM-19, SNM-20, SNM-31); Phase 18 (0: execution phase); Phase 19 (0: execution phase); Phase 20 (1: SNM-23); Phase 21 (8: SNM-22, SNM-24, SNM-25, SNM-26, SNM-27, SNM-28, SNM-29, SNM-32)`

  After: `- Per-phase distribution: Phase 15 (12: SNM-01..11, SNM-21); Phase 16 (8: SNM-12..18, SNM-30); Phase 17 (4: SNM-19, SNM-20, SNM-26, SNM-31); Phase 18 (0: execution phase); Phase 19 (0: execution phase); Phase 20 (1: SNM-23); Phase 21 (7: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32)`

**Atomic edit shape:** Two single-line edits. Total bytes changed: ~30 chars on line 103 + ~80 chars on line 116.

**Phase 17 should mark SNM-19, SNM-20, SNM-26, SNM-31 ALL as Complete** when the phase commits successfully (status `Pending` → `Complete` on lines 96, 97, 103, 108). The owner column already says `Phase 17` for SNM-19, SNM-20, SNM-31 (no edit needed on those rows). Only SNM-26's owner column changes.

### Q10. ADR cross-reference shape

**Verified by file read** (`docs/adr/v2-001-structured-notify.md` lines 1-6):

```markdown
# ADR-v2-001: Structured `notify` payload with typed wrappers

- **Status:** Accepted (Phase 15, 2026-05-25)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)
```

**Success criterion #5 says:** "`docs/adr/v2-001-structured-notify.md` Accepted-status cross-reference to Phase 17 for the spec change is added if not already present."

**Recommended one-line addition** to the Status block at line 3:

Before:
```markdown
- **Status:** Accepted (Phase 15, 2026-05-25)
```

After:
```markdown
- **Status:** Accepted (Phase 15, 2026-05-25). Spec catch-up landed in Phase 17 (2026-05-27 -- `docs/messaging-style-guide.md` v2.0 + `docs/output-catalog.md` v2.0 + `tests/architecture/catalog-uat.test.ts` migrated to drive `notify()` via structured fixtures).
```

Or, if the planner prefers a separate bullet under the existing Status:
```markdown
- **Status:** Accepted (Phase 15, 2026-05-25)
- **Phase 17 spec catch-up:** Landed 2026-05-27 -- `docs/messaging-style-guide.md` v2.0 + `docs/output-catalog.md` v2.0 + `tests/architecture/catalog-uat.test.ts` migrated.
```

**Total bytes changed:** ~150-180 chars. Single-file, single-paragraph edit. Atomic-per-plan compliant whether folded into Plan A (style guide rewrite) or shipped as its own plan.

### Q11. Atomic-per-plan boundaries (recommendation)

See "Implementation Approach > Recommended plan-grouping" above. Recommended plans:

**Three-plan ordering (preferred):**
1. **Plan I:** Style guide v1.0 -> v2.0 + delete `grammar-frontmatter.test.ts` + REQUIREMENTS.md SNM-26 edit + ADR Phase 17 cross-ref.
2. **Plan II:** Catalog v1.0 -> v2.0 rewrite.
3. **Plan III:** `catalog-uat.test.ts` rewrite (parser-preserving renderer swap).

**Plan dependency:** I and II are independent; III depends on II. The planner may run I and II in either order, then III.

**Five-plan ordering** (if the planner wants finer atomicity): A, B, C, D, E as described in Implementation Approach.

### Q12. `npm run check` gate validation strategy

**Verified by `package.json` read:**

```json
"check": "npm run typecheck && npm run lint && npm run format:check && npm test"
```

Where:
- `typecheck`: `tsc --noEmit`
- `lint`: `eslint .`
- `format:check`: `prettier --check "**/*.{js,json,ts}"`
- `test`: `node --test "tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}/**/*.test.ts" "tests/lint-rules/**/*.test.{js,ts}"`

**Sub-commands affected by Phase 17:**
- `typecheck`: affected by `tests/architecture/catalog-uat.test.ts` rewrite (Plan C). New imports (`notify`, `NotificationMessage`) must typecheck against `shared/notify.ts`'s exports.
- `lint`: affected by all test/doc changes (eslint runs against `.ts` files; markdown is not linted in default config).
- `format:check`: affected by all `.md` and `.ts` edits -- prettier must be re-applied to all rewritten files. Run `npm run format` (which is `prettier --write`) BEFORE `npm run check` to clean up.
- `test`: affected by:
  - `tests/architecture/grammar-frontmatter.test.ts` DELETED → 6 fewer tests in the suite.
  - `tests/architecture/catalog-uat.test.ts` REWRITTEN → still 3 tests in the file (1 main loop + 2 ancillary), but the main loop's pass/fail bytes change.

**Smallest verifiable signals (in dependency order):**

1. After Plan I: `npm test -- --grep "catalog UAT\|legacy markers\|notify-types"` should pass (catalog UAT still runs against v1.0 catalog if Plan II hasn't run yet; legacy-markers still passes since frontmatter doesn't touch it; notify-types compile-check passes).
   - `npm run typecheck` MUST be GREEN (grammar-frontmatter.test.ts deletion removes import of `../lint-rules/lib/frontmatter.js`).
   - **Risk:** If Plan I deletes the frontmatter (D-17-01) but `tests/lint-rules/lib/frontmatter.js` is still required by some other test (e.g. `tests/architecture/msg-rule-registry.test.ts` reads frontmatter via `parseStyleGuideFrontmatter`), `npm test` fails. **Verified by grep:** only `tests/architecture/grammar-frontmatter.test.ts` imports from `tests/lint-rules/lib/frontmatter.js` -- the other reference is `tests/lint-rules/lib/frontmatter.d.ts` (sibling type declaration, not an importer). So Plan I is safe.

2. After Plan II: Catalog UAT will FAIL with byte-mismatches (the new catalog has v2 outputs, but the still-V1 `catalog-uat.test.ts` drives V1 composers which emit v1 outputs). EXPECTED -- Plan II must NOT be a checkpoint by itself; Plan III must follow before `npm run check` is GREEN.
   - Alternative: Land Plan II and Plan III in the same commit, OR move Plan III before Plan II (rewrite the test against the still-V1 catalog; the test then fails with byte-mismatches; then Plan II makes the catalog match). The latter is messier.

3. After Plan III (and after both II and I have landed): `npm run check` GREEN.

**Recommended single command for final verification:**
```bash
npm run format && npm run check
```

This runs:
- `prettier --write` on all `.md` / `.ts` / `.json` (auto-fix formatting).
- `tsc --noEmit` (typecheck).
- `eslint .` (lint).
- `prettier --check` (format-check).
- `node --test "tests/{architecture,...}/**/*.test.ts" "tests/lint-rules/**/*.test.{js,ts}"` (run all tests).

**Expected delta from v1.3 baseline:** Test count drops by 6 (grammar-frontmatter.test.ts had 6 `test()` calls), staying GREEN. Per Phase 16 PROJECT.md status: post-Phase-16 baseline is 1359/1359. Post-Phase-17 expected: 1353/1353 (1359 - 6).

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- Phase 17 is documentation-and-test-only. No databases, no state files, no migration. | None. |
| Live service config | None -- no external services touched. | None. |
| OS-registered state | None -- no OS-level registrations involved. | None. |
| Secrets/env vars | None -- no env vars referenced. | None. |
| Build artifacts | None -- Phase 17 makes no production source changes, so no compiled artifacts change. The pretty-printed `.md` files and rewritten `.ts` test file are the sole deliverables. | None. |

**Nothing found in any category:** Phase 17 is a docs + test refactor with no runtime state. Verified by inspecting all 4 files-to-modify + the deletion target.

## Common Pitfalls

### Pitfall 1: Frontmatter deletion order

**What goes wrong:** If Plan A (delete frontmatter) lands before Plan D (delete `grammar-frontmatter.test.ts`), the next `npm run check` fails because `tests/lint-rules/lib/frontmatter.js`'s `parseStyleGuideFrontmatter` throws "no YAML frontmatter found" at module load -- which crashes the test file before its `test()` blocks run.

**Why it happens:** The test imports from the loader at the top of the file (line 8-14); the loader reads `docs/messaging-style-guide.md` at module load time. Removing the frontmatter from the .md but keeping the test file makes the import + load chain throw.

**How to avoid:** Land Plan A + Plan D in the same atomic commit, OR run Plan D first (delete the test) and Plan A second (delete the frontmatter).

**Warning signs:** `npm test` output: `Error: no YAML frontmatter found at .../docs/messaging-style-guide.md`.

### Pitfall 2: Catalog UAT byte-mismatches during Plan II / Plan III window

**What goes wrong:** Plan II rewrites the catalog to v2 outputs; the still-V1 `catalog-uat.test.ts` drives V1 composers that produce v1 outputs; every assertion fails with byte-mismatch.

**Why it happens:** The UAT is a closed loop -- it reads the catalog and asserts what the test-driven renderer emits. Changing only one side of the loop is a guaranteed mismatch.

**How to avoid:** Either:
- Land Plan II + Plan III in the same atomic commit (recommended).
- Land Plan III FIRST (rewrite test against current v1 catalog -- but the v2 `notify()` outputs don't match v1 catalog bytes, so this also fails) -- NOT viable.
- Land Plan II only on a feature branch and don't merge until Plan III is also ready.

**Warning signs:** Massive `catalog UAT failures` output with [BYTE MISMATCH] entries for every (section, state) tuple.

### Pitfall 3: `(no plugins)` per-marketplace-block rendering divergence

**What goes wrong:** The v1.0 catalog's `zero-plugin-mp-block` state in `/claude:plugin list` (lines 253-260) shows:
```text
● empty-mp [project]
  (no plugins)
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
```
The `(no plugins)` line under `empty-mp` is V1-composer output (`PluginListMarketplaceBlock.plugins: [{ kind: "empty", token: "no plugins" }]`). The v2 renderer does NOT emit this -- per Phase 15 D-15-08, empty `plugins: []` IS the structural representation, and the renderer emits the bare header alone.

**Why it happens:** The v2 grammar simplification is a deliberate spec change (Phase 15 D-15-08/D-15-09). The catalog rewrite must reflect this.

**How to avoid:** When rewriting `zero-plugin-mp-block` in the v2 catalog, drop the `(no plugins)` line:
```text
● empty-mp [project]
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
```

**Warning signs:** Catalog UAT byte-mismatch on `zero-plugin-mp-block` -- actual output omits the `(no plugins)` line; expected (from v1 catalog) includes it.

### Pitfall 4: Manual-recovery anchor's free-text orphan-path children

**What goes wrong:** The v1.0 catalog's `install-failure-with-anchor` state (lines 884-894) emits two free-text lines beneath the `(manual recovery)` row:
```text
⊘ agent index (manual recovery) {unreadable}
  /path/to/agents-index.json
  /path/to/another-agent.md
```
The two indented free-text paths are V1's `ManualRecoveryLine.orphanDetails` rendered by `renderManualRecovery`. The v2 `PluginManualRecoveryMessage` variant has no `orphanDetails` field -- it carries only `reasons`, optional `cause: Error`, and the standard plugin-row slots. The v2 renderer does NOT emit free-text orphan-path children.

**Why it happens:** The v2 type model was deliberately simplified (Phase 15 D-15-12).

**How to avoid:** When rewriting `install-failure-with-anchor`, drop the orphan-path lines, OR surface them via `cause: Error` (the cause-chain trailer renders inline below the row at 4-space indent). The catalog rewrite must reflect the v2 model.

**Recommended catalog v2 form:**
```text
⊘ official-plugin [user]
  ⊘ official-plugin (failed)
    cause: bridge: agent staging conflict

⊘ agent index [user] (manual recovery) {unreadable}
    cause: orphan: /path/to/agents-index.json, /path/to/another-agent.md
```

But there's a wrinkle: `manual recovery` is a PLUGIN status, not a MARKETPLACE status. The "agent index" surface is a system-level resource (NOT a plugin). In v2, this would need to be modeled as a `PluginManualRecoveryMessage` with `name: "agent index"` wrapped in a `MarketplaceNotificationMessage` -- which forces an artificial marketplace wrapper around what's really a top-level surface. **This is a v2 modeling gap that the planner should call out.**

**Warning signs:** Catalog UAT failure on `install-failure-with-anchor` with structural mismatches. Plan B (catalog rewrite) should explicitly resolve this state's v2 shape -- the planner should choose one of:
1. Drop the manual-recovery state entirely from the v2 catalog (it's a corner case).
2. Model it as a degenerate `MarketplaceNotificationMessage` (wrap "agent index" in a stub marketplace; ugly but matches the type).
3. Defer to Phase 21 alongside other model gaps.

### Pitfall 5: Phase 17 catalog cannot exercise V1-only states

**What goes wrong:** Some v1.0 catalog states have shapes that are fundamentally impossible to express in the v2 type model: `Claude plugin import summary` preamble (top-level free text), `Fix the underlying issue and retry.` recovery anchor (top-level free text on `marketplace remove partial`), and the `source-mismatch` diagnostic line. These cannot be emitted by `notify()`.

**Why it happens:** v2 is a deliberate simplification -- `NotificationMessage` carries only `marketplaces: readonly MarketplaceNotificationMessage[]`; no top-level prose, no per-marketplace prose.

**How to avoid:** The v2 catalog rewrite drops these elements. The planner should document this in Plan B notes as an intentional v1 -> v2 behavior change. The catalog UAT in Plan C asserts the simplified v2 outputs without these elements.

### Pitfall 6: Severity arg assertion shape ambiguity

**What goes wrong:** The Phase 16 test pattern asserts `mock.calls[0]!.arguments` as either a 1-tuple `[body]` (info) or a 2-tuple `[body, "warning" | "error"]`. Phase 17's catalog UAT could miss this distinction if it only asserts on body bytes.

**Why it happens:** Severity is delivered structurally via the second argument's presence/absence; it's not in the body string.

**How to avoid:** The catalog UAT's per-(section, state) fixture should optionally include an `expectedSeverity?: "warning" | "error"` field. Where set, the test additionally asserts:
```typescript
if (fixture.expectedSeverity !== undefined) {
  assert.equal(callArgs.length, 2, `${example.section}::${example.state}: expected severity arg`);
  assert.equal(callArgs[1], fixture.expectedSeverity, `${example.section}::${example.state}: severity mismatch`);
} else {
  assert.equal(callArgs.length, 1, `${example.section}::${example.state}: expected no severity arg (info)`);
}
```

**Recommendation:** Add severity-arg assertion to the catalog UAT loop. The catalog blocks don't contain severity info textually (severity is structural), so the fixture map MUST carry it.

## Code Examples

### Phase 17 mock-pi / mock-ctx pattern (lifted from `tests/shared/notify-v2.test.ts:130-179`)

```typescript
// Source: tests/shared/notify-v2.test.ts:130-179
import test, { mock } from "node:test";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

function piWithBothLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

function piWithNothingLoaded(): MockPi {
  return { getAllTools: () => [] };
}
```

### Phase 17 catalog UAT driver loop (proposed shape)

```typescript
// Source: planner-authored Phase 17 catalog-uat.test.ts rewrite
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// loadCatalogExamples unchanged from Phase 13 V1 implementation.

interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
}

type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;

const FIXTURES: FixtureMap = {
  "/claude:plugin install <plugin>@<marketplace>": {
    success: {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },
    // ... rest of states
  },
  // ... rest of sections
};

test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with a fixture via notify()", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  const failures: Failure[] = [];

  for (const example of examples) {
    const fixture = FIXTURES[example.section]?.[example.state];
    if (fixture === undefined) {
      failures.push({ section: example.section, state: example.state, kind: "missing-fixture" });
      continue;
    }

    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(ctx.ui.notify.mock.calls.length, 1);

    const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const actual = callArgs[0];

    if (actual !== example.expected) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "byte-mismatch",
        expected: example.expected,
        actual,
      });
    }

    if (fixture.expectedSeverity !== undefined) {
      if (callArgs[1] !== fixture.expectedSeverity) {
        failures.push({
          section: example.section,
          state: example.state,
          kind: "severity-mismatch",
          expected: fixture.expectedSeverity,
          actual: callArgs[1] ?? "(info)",
        });
      }
    }
  }

  if (failures.length > 0) {
    // Same formatting as V1: [BYTE MISMATCH] / [MISSING FIXTURE] / [SEVERITY MISMATCH] sections.
  }
});
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in test runner) + `node:assert/strict` |
| Config file | none (configured via `package.json` scripts) |
| Quick run command | `npm test -- --grep "catalog UAT\|notify-types"` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SNM-19 | Style guide v2.0 exists, drops frontmatter, ≤ 250 lines | meta (docs check) | `wc -l docs/messaging-style-guide.md && head -1 docs/messaging-style-guide.md` (assert ≤ 250 lines AND first line is `# Messaging Style Guide` not `---`) | ❌ Wave 0 (no automated check exists; manually verified or planner adds a 1-line architecture test) |
| SNM-19 | Style guide v2.0 ES-5 Supersession Table retained verbatim | meta (docs check) | `grep -A 8 "ES-5 Supersession Table" docs/messaging-style-guide.md` (verify 5-row table present with retirement annotation) | ❌ Wave 0 (optional architecture test) |
| SNM-20 | Catalog v2.0 single-plugin install renders two-line marketplace-header form | byte-equality (catalog UAT) | `npm test tests/architecture/catalog-uat.test.ts -- --grep "success"` | ✅ (after Plan III) |
| SNM-20 | Catalog v2.0 orphan-fold case included | byte-equality (catalog UAT) | `npm test tests/architecture/catalog-uat.test.ts -- --grep "project-orphan-folded\|same-mp-both-scopes"` | ✅ (after Plan III) |
| SNM-26 | `tests/architecture/grammar-frontmatter.test.ts` does not exist | meta (file existence) | `test ! -f tests/architecture/grammar-frontmatter.test.ts` | ❌ Wave 0 (planner adds a 1-line architecture test that asserts the file is absent, OR relies on Plan D's deletion being grep-verifiable) |
| SNM-26 | REQUIREMENTS.md SNM-26 row reads "Phase 17 | Complete" | meta (docs check) | `grep "SNM-26" .planning/REQUIREMENTS.md` | ❌ Wave 0 |
| SNM-31 | Catalog UAT runs via `notify()` (no V1 composer imports) | typecheck | `npm run typecheck` (post-rewrite, no `presentation/index.ts` imports survive in `catalog-uat.test.ts`) | ✅ |
| SNM-31 | Every (section, state) tuple in catalog has a fixture entry | byte-equality (catalog UAT) | `npm test tests/architecture/catalog-uat.test.ts` (assertion fails if any tuple is missing) | ✅ |
| All | `npm run check` GREEN | full suite | `npm run check` | ✅ |

### Sampling Rate

- **Per task commit:** `npm test tests/architecture/catalog-uat.test.ts` (~3 seconds, covers SNM-20 + SNM-31).
- **Per wave merge:** `npm run check` (typecheck + lint + format + full test suite; covers all 4 requirements).
- **Phase gate:** `npm run format && npm run check` GREEN before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] (Optional) `tests/architecture/style-guide-shape.test.ts` -- assert style guide v2.0 has no YAML frontmatter (first line is `# Messaging Style Guide`, not `---`) AND total line count ≤ 250.
- [ ] (Optional) `tests/architecture/grammar-frontmatter-absent.test.ts` -- assert `tests/architecture/grammar-frontmatter.test.ts` does NOT exist (defense against accidental restore).
- [ ] (Optional) `tests/architecture/catalog-uat-imports.test.ts` -- assert `tests/architecture/catalog-uat.test.ts` does NOT import from `extensions/pi-claude-marketplace/presentation/*` (locks D-17-03 pure exclusion structurally).

**Recommendation:** Wave 0 gaps are all OPTIONAL. The primary user-contract gate (catalog UAT byte-equality via `notify()`) covers SNM-20 + SNM-31 directly. SNM-19 + SNM-26 are documentation/file-existence changes whose absence-of-failure is verified by `npm run check` GREEN (style guide must still parse as markdown; deleted test must not crash on import). The planner can elect to add 1-3 lightweight architecture tests if they want explicit gates, but they are not strictly required.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YAML frontmatter as binding closed-set authority for `status_tokens` / `reasons` / `markers` / `pattern_classes` | Const tuples + derived literal-union types in `extensions/pi-claude-marketplace/shared/notify.ts` (`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `DEPENDENCIES`); `REASONS` in `shared/grammar/reasons.ts` (still); compile-time closed-set proof in `tests/architecture/notify-types.test.ts` | Phase 15 (2026-05-25); ratified by Phase 17 (this phase) deleting the frontmatter | Style guide drops ~60 lines of frontmatter + ~260 lines of §16 Pattern Class Reference + ~100 lines of §17 Worked Examples Gallery. Net -~720 LoC from style guide. |
| Catalog UAT drives V1 composers (`renderRow` / `cascadeSummary` / `renderManualRecovery` / `renderRollbackPartial` / `renderPluginList` / `renderMarketplaceList` / `appendReloadHint`) and asserts byte-equality | Catalog UAT drives `notify(ctx, pi, message)` via mock ctx + mock pi, asserts byte-equality | Phase 17 (this phase) | V1 composers stay covered ONLY by their existing unit tests; the binding user-contract gate runs against the v2 renderer. D-17-03 pure exclusion. |
| Style guide §1-19 with 88 MSG-* rule rows + 5 frontmatter closed sets + 12 pattern classes + 18 worked-example subsections | Thin pointer doc (~5-7 H2 sections, ~150-250 lines): Overview, Type Model Reference, Output Grammar Summary, Severity Routing, ES-5 Supersession Table, Cross-References | Phase 17 (this phase) per D-17-07 | "Renderer is the spec authority" (D-16-04); style guide is a navigation aid, not the binding contract. |
| Catalog v1.0 with single-plugin commands rendering inline one-line outputs and multi-plugin commands rendering marketplace-header + indented rows | Catalog v2.0 always-marketplace-header form -- every per-command section renders `<icon> <mp> [<scope>] [<status>]` header at column 0 with plugin rows indented 2 spaces beneath | Phase 17 (this phase) per D-17-04 + D-16-04 | Single-plugin install/update/uninstall/reinstall change from one-line to two-line. Spec uniformity. |
| `tests/architecture/grammar-frontmatter.test.ts` runtime parity assertion (frontmatter ↔ in-code const arrays) | Compile-time closed-set proof via `tests/architecture/notify-types.test.ts` | Phase 17 (this phase) deletes; Phase 15 introduced compile-check | One fewer runtime test (-91 lines); zero net loss of safety because closed-set membership is now compile-enforced. |

**Deprecated/outdated:**
- YAML frontmatter (`status_tokens`, `reasons`, `markers`, `pattern_classes`) -- replaced by const tuples in TS source.
- §16 Pattern Class Reference in style guide -- replaced by discriminated-union switches in renderer.
- §17 Worked Examples Gallery in style guide -- replaced by catalog's per-command sections.
- V1-composer-driven catalog UAT -- replaced by `notify()`-driven catalog UAT.
- Per-marketplace `(no plugins)` rendering -- replaced by bare-header-alone rendering per Phase 15 D-15-08.
- `Claude plugin import summary` preamble + `Fix the underlying issue and retry.` retry anchor + `source-mismatch` diagnostic line -- dropped from v2 grammar (deliberate simplification).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|--------------|
| A1 | The v2 catalog rewrite drops the `Claude plugin import summary` preamble, the `Fix the underlying issue and retry.` retry anchor, and the `source-mismatch` diagnostic line because they're not part of the v2 grammar `notify()` emits. | Pitfall 5, Q4, Q8 | If the planner wants to preserve these in v2, Phase 17 needs production-source changes to `notify()` -- which is OUT OF SCOPE per Phase 17's documentation-and-test-only charter. The planner must make an explicit decision here. |
| A2 | The v2 catalog's `install-failure-with-anchor` state needs a v2 model adjustment because `PluginManualRecoveryMessage` has no `orphanDetails` field equivalent. Recommendation: surface orphan paths via `cause: Error` message text, OR drop the state from v2 catalog. | Pitfall 4 | If the planner chooses to keep the orphan-path child rows, Phase 17 needs production-source changes to extend `PluginManualRecoveryMessage` -- OUT OF SCOPE. Planner explicit decision needed. |
| A3 | The `(no plugins)` per-marketplace-block line (in `zero-plugin-mp-block` state under `/claude:plugin list`) is dropped in v2 -- bare marketplace header alone replaces it. | Pitfall 3, Q4 | Phase 15 D-15-08 is unambiguous: empty `plugins: []` IS the structural representation; verified by `tests/shared/notify-v2.test.ts:578-588` which asserts a bare 17-byte `(no marketplaces)` only for the empty TOP-LEVEL case, never for per-marketplace empty `plugins[]`. Risk: low. |
| A4 | The catalog UAT test continues to use `node:test` (built-in) -- no test framework migration. | Q12 | None -- matches Phase 16's pattern. Verified by `package.json` scripts. |
| A5 | The `tests/lint-rules/lib/frontmatter.js` loader file is NOT deleted by Phase 17. It survives until Phase 21 (SNM-24 deletes the entire `tests/lint-rules/` directory). Phase 17 only deletes `tests/architecture/grammar-frontmatter.test.ts` which is the SOLE importer of the loader's `parseStyleGuideFrontmatter` / `*_FRONTMATTER` exports inside the `tests/architecture/` directory. | Pitfall 1 | If another test imports from the loader (e.g. `tests/architecture/msg-rule-registry.test.ts` reads the style guide via a different code path), deleting the frontmatter could still break that test. Verified by grep that `msg-rule-registry.test.ts` reads the style-guide BODY (MSG-* IDs), NOT the frontmatter. Risk: low. |
| A6 | The single-plugin install/uninstall/reinstall v2 fixtures use `mp.status: undefined` (the marketplace is not state-changed by the install -- only the plugin is). | Q8 (per-command sample), Q3 | Re-confirmed by reading Phase 16 test 1 (line 189-214) which uses `mp.status: "added"` for the test -- that's correct for the test-only scenario but not for real install flows. The catalog v2 must use `mp.status: undefined` to match the real install semantics. The reload-hint fires via plugin status `"installed"` ∈ trigger set per D-16-12. Verified by reading `shouldEmitReloadHint` in `shared/notify.ts:931-950`. |
| A7 | The catalog v2.0 line count target is approximately net-neutral vs v1.0 (~750-850 lines vs v1.0's 971). | Q8 | The math depends on whether the §Resolutions scratchpad (39 lines) is fully deleted (recommended) and whether per-command sections net-grow (two-line headers) vs net-shrink (drop preambles). The estimate is rough; planner refines during implementation. Risk: estimate-only. |
| A8 | The recommended plan-grouping is 3 plans (I/II/III). | Q11 | Atomic-per-plan is satisfied either way (3-plan or 5-plan). The 3-plan grouping minimizes inter-plan dependency edges. Planner discretion. Risk: low. |

**Confirmation needed from planner / user before execution:**
- A1 -- **RESOLVED via D-17-09 (CONTEXT.md):** drop `Claude plugin import summary` preamble, `Fix the underlying issue and retry.` retry anchor, and `source-mismatch` diagnostic line from v2 catalog. Documentation-and-test-only charter forbids `notify()` production changes; the v2 catalog Conventions section documents the deliberate simplification.
- A2 -- **RESOLVED via D-17-10 (CONTEXT.md):** drop `install-failure-with-anchor` state from v2 catalog. The v2 type model has no top-level free-form recovery anchor; `PluginManualRecoveryMessage` is structurally a per-plugin variant inside a marketplace block. Per-plugin manual-recovery rendering is covered indirectly via the cascade sections.

## Risks & Mitigations

### Risk 1: Plan I (frontmatter deletion + test deletion) atomicity

**Risk:** If frontmatter is deleted before the test, `npm run check` fails at module load.

**Mitigation:** Land deletion of `tests/architecture/grammar-frontmatter.test.ts` and deletion of the YAML frontmatter in the same atomic commit. If they must be separate commits, run test-deletion first.

**Detection:** `npm test` output contains `Error: no YAML frontmatter found`.

### Risk 2: Catalog v2 spec gaps for V1-only elements

**Risk:** V1 catalog states with free-text augmentations (`Claude plugin import summary`, retry anchor, source-mismatch diagnostic, orphan-path manual recovery) cannot be expressed via `notify()` and require either dropping or a v2 grammar extension.

**Mitigation:** Plan B (catalog rewrite) explicitly enumerates these elements in plan notes and chooses the v2 treatment: DROP (recommended per A1/A2). Document the v1->v2 behavior change in the catalog rewrite PR description and in the v2.0 catalog's Conventions section.

**Detection:** Plan B reviewer flags missing preamble/anchor/diagnostic lines in the v2 catalog.

### Risk 3: Catalog UAT byte-mismatches during Plan II/III sequencing

**Risk:** If Plan II lands before Plan III, the still-V1 test drives V1 composers against a v2 catalog -> every assertion fails.

**Mitigation:** Land Plan II and Plan III in the same atomic commit OR run Plan III first. Recommended: same-commit landing.

**Detection:** Massive `catalog UAT failures` output with [BYTE MISMATCH] entries.

### Risk 4: Manual-recovery state structurally incompatible with v2

**Risk:** The v1 catalog's `install-failure-with-anchor` state pairs a `failed` install row with a separate top-level `(manual recovery)` line referring to a system-level resource (`agent index`). The v2 type model has no top-level free-form recovery anchor -- `PluginManualRecoveryMessage` is a per-plugin variant inside a marketplace block.

**Mitigation:** Plan B explicitly resolves this. Options:
1. Drop the state from the v2 catalog entirely (cleanest).
2. Model "agent index" as a degenerate marketplace wrapper with a `manual recovery` plugin child (ugly but type-valid).
3. Defer to Phase 21 alongside other v2 model refinements.

**Detection:** Plan B reviewer flags the structural mismatch during the catalog rewrite.

### Risk 5: Style guide v2.0 exceeds line budget

**Risk:** D-17-07 caps style guide at ~150-250 lines; the planner overshoots if Type Model Reference and Output Grammar Summary sections are too dense.

**Mitigation:** During implementation, run `wc -l docs/messaging-style-guide.md` mid-rewrite; trim aggressively. The Type Model Reference can be a single paragraph pointing at `shared/notify.ts` rather than enumerating types. The Output Grammar Summary can be a 30-line bullet list.

**Detection:** `wc -l` exceeds 250.

### Risk 6: Catalog UAT runtime drift from Phase 16 unit tests

**Risk:** Phase 17 lifts Phase 16's unit-test expected strings into the catalog, but if the lift introduces a typo / spacing / indent mismatch, the catalog UAT will fail.

**Mitigation:** Phase 17 catalog rewrite must use the Phase 16 unit-test expected strings as the SEED (D-16-18). Either copy the exact expected strings from `tests/shared/notify-v2.test.ts:189-1141` into the v2 catalog blocks, OR (cleanest) construct the fixtures in Plan C first, run `notify()` against them, and use the emitted strings as the catalog block content (run-as-source pattern).

**Detection:** Catalog UAT byte-mismatches; diff against Phase 16 unit-test expected strings.

### Risk 7: `no-legacy-markers.test.ts` accidental breakage

**Risk:** Edge case -- Phase 17's rewrite of the style guide or catalog accidentally introduces one of the 5 legacy ES-5 markers into a non-allow-listed file.

**Mitigation:** The style guide rewrite preserves the ES-5 Supersession Table verbatim (D-17-08) -- the table's right column does NOT contain the legacy literals (only the replacement forms). The catalog v2 also does not need to contain the literals. Verified by inspecting v1 catalog: the literals are absent from `docs/output-catalog.md`. Risk: very low.

**Detection:** `npm test tests/architecture/no-legacy-markers.test.ts` fails with [legacy marker found] entries.

## Open Questions (RESOLVED)

All material questions resolved by user decisions in `17-CONTEXT.md`. Two assumption-level questions (A1, A2) flagged for planner / user ratification have been ratified by user decisions D-17-09 and D-17-10 respectively.

1. **V1 free-text augmentations in v2:** Are `Claude plugin import summary` preamble, `Fix the underlying issue and retry.` retry anchor, and `source-mismatch` diagnostic line dropped in v2? **A1 -- RESOLVED via D-17-09 (CONTEXT.md):** drop Claude plugin import summary preamble, retry anchor, source-mismatch diagnostic from v2 catalog (documentation-and-test-only charter forbids notify() production changes).

2. **Manual-recovery system-level resources:** How is `install-failure-with-anchor` modeled in v2 -- drop the state, model as degenerate marketplace, or defer to Phase 21? **A2 -- RESOLVED via D-17-10 (CONTEXT.md):** drop install-failure-with-anchor state from v2 catalog (v2 type model has no top-level free-form recovery anchor; PluginManualRecoveryMessage is per-plugin within a marketplace block, not a system-level wrapper).

Both ratifications appear in the Assumption Log "Confirmation needed" subsection above; planning may proceed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner, typecheck | ✓ | per `package.json` engines `>=20.19.0` | -- |
| TypeScript | `tsc --noEmit` typecheck | ✓ | `^6.0.3` (dev dep) | -- |
| ESLint | `eslint .` | ✓ | `^10.4.0` (dev dep) | -- |
| Prettier | `prettier --check` | ✓ | `^3.8.3` (dev dep) | -- |
| `node:test` | Test runner | ✓ (Node built-in) | -- | -- |
| `node:fs/promises` | Catalog file read | ✓ (Node built-in) | -- | -- |
| `node:assert/strict` | Test assertions | ✓ (Node built-in) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Phase 17 has no external tool/service dependencies beyond the existing dev-tool stack (typecheck + lint + format + test). All required dependencies are already declared in `package.json` and verified to work via Phase 16's completion (`npm run check` GREEN at 1359/1359).

## Project Constraints (from CLAUDE.md)

- **NEVER commit to main.** Branch names: `main`, `features/*`, `releases/*`. Phase 17 work lands on `gsd/v1.3-replan-catalog` (current branch per git status).
- **Conventional Commits required:** titles 5-72 chars; body lines ≤ 80 chars. Phase 17 commits use `docs(17): ...`, `test(17): ...`, `chore(17): ...` per convention.
- **`pre-commit run --all-files` MUST pass BEFORE `git commit`.** No `--no-verify`. From worktree, prefix commit with `SKIP=trufflehog` (worktree-sandbox limitation; run `pre-commit run trufflehog --all-files` separately to confirm).
- **NFR-6: `npm run check` MUST stay GREEN throughout** (typecheck + lint + format:check + test).
- **IL-2: All user-visible messages go through `ctx.ui.notify` from `shared/notify.ts` only.** Phase 17 does NOT touch production source -- no risk here.
- **IL-3: Single sanctioned `console.warn` at `persistence/migrate.ts`.** Phase 17 does NOT touch -- no risk.
- **Atomic commits per plan; no commits to main.**

## Sources

### Primary (HIGH confidence)

- `tests/shared/notify-v2.test.ts` (1141 lines) -- Phase 16 per-variant unit tests; the SEED for Phase 17 catalog UAT fixtures. Authoritative for v2 grammar bytes.
- `extensions/pi-claude-marketplace/shared/notify.ts` (1065 lines) -- V2 renderer. The binding spec authority per Phase 16 D-16-04. Authoritative for `NotificationMessage` type model and `notify()` signature.
- `tests/architecture/catalog-uat.test.ts` (1982 lines) -- V1 catalog UAT. Authoritative for parser pattern Phase 17 carries forward.
- `tests/architecture/notify-types.test.ts` (570 lines) -- Phase 15 compile-check. Authoritative for closed-set proof.
- `tests/architecture/grammar-frontmatter.test.ts` (91 lines) -- Test to be deleted by Phase 17. Verified scope of deletion (single test file; single loader import).
- `tests/architecture/no-legacy-markers.test.ts` (134 lines) -- Verified does NOT reference style-guide frontmatter; Phase 17 does NOT need to patch.
- `docs/messaging-style-guide.md` (954 lines) -- V1 style guide; Phase 17 rewrites to v2.0. Inventory mapped per section.
- `docs/output-catalog.md` (971 lines) -- V1 catalog; Phase 17 rewrites to v2.0. All 49 `<!-- catalog-state: -->` markers inventoried.
- `docs/adr/v2-001-structured-notify.md` (197 lines) -- Accepted ADR; Phase 17 adds one-line Phase 17 cross-reference per success criterion #5.
- `.planning/REQUIREMENTS.md` (129 lines) -- SNM-* requirements + traceability table. Phase 17 edits SNM-26 row + per-phase distribution line.
- `.planning/ROADMAP.md` §"Phase 17" (lines 154-170) -- Goal + 5 success criteria.
- `.planning/phases/17-spec-rewrite-catalog-uat-migration/17-CONTEXT.md` -- User decisions D-17-01..D-17-08 + Claude's Discretion.
- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- Phase 16 lineage; D-16-04 controlling anchor.
- `package.json` -- `npm run check` definition (typecheck + lint + format:check + test).

### Secondary (MEDIUM confidence -- used for cross-reference)

- `.planning/PROJECT.md` §"Current Milestone: v1.4" -- v1.4 net-LoC delta target (~4300 LoC removed); Phase 16 completion status (1359/1359 tests).
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` (72 lines) -- `REASONS` array + `Reason` type; still imported by `shared/notify.ts` per Phase 15 D-15-03.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` lines 42-86 -- `SoftDepStatus` interface + `softDepStatus(pi)` probe.
- `tests/shared/notify.test.ts` (90 lines) -- V1 wrappers reference; mock-ctx pattern source.

## Metadata

**Confidence breakdown:**
- Architectural responsibility map: HIGH -- Phase 17 is docs/test-only, no production source touched; tier ownership is unambiguous.
- Type model & renderer surface: HIGH -- verified by direct file inspection of `shared/notify.ts` (1065 lines) and `tests/shared/notify-v2.test.ts` (1141 lines).
- Catalog state inventory: HIGH -- all 49 markers enumerated via `grep` + `wc -l`.
- Plan grouping recommendation: HIGH -- atomic-per-plan boundaries verified via dependency analysis; 3-plan grouping is the cleanest.
- v2 catalog spec gaps (A1, A2): MEDIUM -- recommendations sound but require planner / user ratification.
- Style guide line-count budget: MEDIUM -- target ranges (~150-250) verified against D-17-07; exact mid-range value is estimate.
- Catalog line-count budget: MEDIUM -- net-neutral target verified by section-by-section budget math; exact value is estimate.
- `no-legacy-markers.test.ts` blast radius: HIGH -- verified by grep that frontmatter keys are absent.
- Pre-commit / `npm run check` gate definition: HIGH -- verified by reading `package.json` scripts.

**Research date:** 2026-05-26
**Valid until:** 2026-06-09 (~14 days; documentation rewrite scope is stable, but underlying renderer behavior in `shared/notify.ts` is binding; any Phase-16 hotfix between research date and Phase 17 plan execution would shift the v2 byte form and require re-validation).

## RESEARCH COMPLETE

**Phase:** 17 - Spec Rewrite & Catalog UAT Migration
**Confidence:** HIGH

### Key Findings

1. **Phase 17 is documentation-and-test-only.** No production source changes. The renderer in `extensions/pi-claude-marketplace/shared/notify.ts` (1065 lines) is already the v2 grammar authority per Phase 16 D-16-04; Phase 17 catches the user-facing spec up to it.
2. **Three-plan grouping is the cleanest atomic-per-plan structure:** Plan I (style guide v1.0 → v2.0 + delete `grammar-frontmatter.test.ts` + REQUIREMENTS.md SNM-26 edit + ADR cross-ref) → Plan II (catalog v1.0 → v2.0 rewrite) → Plan III (`catalog-uat.test.ts` rewrite, parser-preserving renderer swap). Plans I and II are independent; Plan III depends on Plan II. Plan I has a tight coupling between frontmatter deletion and test deletion that must land in the same commit OR test-deletion first.
3. **Two material spec gaps require planner / user ratification before Plan II finalizes** (Assumption Log A1, A2): (a) V1 free-text augmentations (`Claude plugin import summary` preamble, retry anchor, source-mismatch diagnostic) cannot be expressed via `notify()` -- recommendation: drop in v2 catalog. (b) Manual-recovery state (`install-failure-with-anchor`) with system-level resources has no clean v2 type-model representation -- recommendation: drop OR model as degenerate marketplace.
4. **`tests/architecture/no-legacy-markers.test.ts` does NOT reference style-guide frontmatter** -- verified by grep. Phase 17 does NOT need to patch this test. Plan E is unnecessary.
5. **`npm run check` GREEN is the binding gate** (typecheck + lint + format:check + test). Expected post-Phase-17 test count: 1353/1353 (1359 - 6 from `grammar-frontmatter.test.ts` deletion). The catalog UAT byte-equality assertion via `notify()` is the user-contract gate per SNM-31.

### File Created

`/home/acolomba/pi-claude-marketplace/.planning/phases/17-spec-rewrite-catalog-uat-migration/17-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Type model & renderer surface | HIGH | Direct file inspection of `shared/notify.ts` + `notify-v2.test.ts` (binding source artifacts). |
| Catalog state inventory (49 markers) | HIGH | Exhaustive `grep -n "catalog-state:"` enumeration. |
| Plan-grouping recommendation | HIGH | Dependency analysis verified; 3-plan ordering minimizes edges. |
| Catalog v2 spec gaps (A1, A2) | MEDIUM | Recommendations sound but need planner ratification. |
| Line-count budgets | MEDIUM | Target ranges anchored by D-17-07; exact values are estimates. |
| `no-legacy-markers.test.ts` non-impact | HIGH | Verified by grep + file inspection. |

### Open Questions (RESOLVED)

Two material assumptions (A1, A2) flagged for planner / user ratification have been resolved by user decisions in `17-CONTEXT.md`:
- **A1 -- RESOLVED via D-17-09:** Drop `Claude plugin import summary` preamble, `Fix the underlying issue and retry.` retry anchor, and `source-mismatch` diagnostic line from v2 catalog. The documentation-and-test-only charter forbids `notify()` production changes; the v2 catalog Conventions section documents the deliberate simplification.
- **A2 -- RESOLVED via D-17-10:** Drop the `install-failure-with-anchor` state from v2 catalog. The v2 type model has no top-level free-form recovery anchor; `PluginManualRecoveryMessage` is structurally a per-plugin variant inside a marketplace block, not a system-level wrapper.

Both resolutions ratified; planning may proceed.

### Ready for Planning

Research complete. The planner can now create PLAN.md files for Phase 17 using the recommended 3-plan grouping (or the alternative 5-plan grouping for finer atomicity).
