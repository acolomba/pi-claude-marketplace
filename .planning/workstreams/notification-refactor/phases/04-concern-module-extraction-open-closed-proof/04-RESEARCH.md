# Phase 4: Concern-module extraction & open-closed proof - Research

**Researched:** 2026-06-24
**Domain:** TypeScript module extraction (move-and-rewire) of two cross-cutting concerns out of a 3431-line monolith, plus a documented open-closed measurement. Output-neutral.
**Confidence:** HIGH — every claim below is grepped/read against the live `extensions/pi-claude-marketplace/shared/notify.ts` (3431 lines), not against the stale 3119-line line numbers in MESSAGING-COUPLING.md.

> **Line-number provenance note:** MESSAGING-COUPLING.md cites a **3119-line** pre-Phase-1 `notify.ts`. Phases 1–3 changed the file (now **3431 lines**). **Every line number in this RESEARCH.md was re-grepped against the current file** `[VERIFIED: grep extensions/pi-claude-marketplace/shared/notify.ts]`. Where I cite a coupling-audit baseline figure (the 5 / 9–11 counts), I cite the audit's prose, not its line numbers.

<user_constraints>
## User Constraints (from 04-CONTEXT.md)

### Locked Decisions

**D-01: Concern wiring — direct function calls (no concern-registry).** Each concern is a standalone module under `shared/concerns/` (e.g. `shared/concerns/soft-dep.ts`, `shared/concerns/hooks.ts`) that **owns its data and logic** and **exports plain functions** the central composer/info-renderer import and call directly. **No `Concern` interface, no concern-registry, no iterated contribution list.** Static, traceable imports.
- **Soft-dep concern** owns `DEPENDENCIES`, `SOFT_DEP_MARKER_AGENTS`/`_MCP`, and the probe-to-marker mapping; the central `composeReasons` calls into it for the soft-dep marker branch. The `softDepStatus(pi)` **probe stays threaded by the renderer** (environment is the renderer's job); the concern module is **pure given the probe result**.
- **Hooks concern** owns `appendHooksBlock`, `COMPONENT_KINDS`, and the `HookSummaryEntry` rendering; the info renderer calls into it. Preserve the `shared/`→`domain/` import fence (HookSummaryEntry types lived in notify.ts for that fence reason).

**D-02: Open-closed proof — documented measurement only (no architecture test).** The ≤3-files / 0-`notify.ts`-edits target is proven by a **written measurement / walkthrough**, NOT a new architecture test. Enumerates exactly which files a new command touches today (after this milestone): `edge/router.ts` registration, `edge/register.ts` one wiring line, one `docs/output-catalog.md` section = **3 central files, 0 `notify.ts` edits**, measured vs the MESSAGING-COUPLING.md baseline (5 no-grammar / 9–11 new-grammar; 6 of those inside `notify.ts`). **No** architecture test asserting `notify.ts` purity. GATE-03 (`npm run check` green) remains the only automated gate at close.

**D-03: MOD-06 catalog floor — documented.** Catalog stays hand-authored, one central section per new rendered state, no generation/aggregation seam (deferred). Captured **alongside the D-02 proof (same doc)** so the "3rd central file" is the explicit accepted floor.

**OUTPUT-NEUTRAL (hard constraint):** extraction is a pure refactor — `catalog-uat` stays byte-identical; `git diff docs/output-catalog.md` empty after every commit; `npm run check` green at every boundary.

### Claude's Discretion
- Exact module paths/names under `shared/concerns/` and the precise function signatures the composer/info-renderer call.
- Where the D-02 proof + D-03 floor note live (new `docs/` note, ADR-style doc, or appended section) — provided it's a durable, discoverable artifact, **not a code comment**.
- How much additional vocabulary stays vs moves, provided `notify.ts` ends as envelope + reducer + shared vocabulary and the two named concerns are fully extracted.
- Import-fence handling — preserve the `shared/`→`domain/` fence when relocating `HookSummaryEntry` types.

### Deferred Ideas (OUT OF SCOPE)
- **Catalog generation/aggregation seam** — explicitly OUT OF SCOPE (MOD-06 floor; documented as the deliberate boundary, deferred).
- **Architecture test enforcing `notify.ts` purity** — declined this phase (D-02); a future hardening if grammar-creep becomes a problem.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-04 | Extract hooks summary (`appendHooksBlock`) + soft-dep marker injection (`composeReasons` soft-dep branch + `DEPENDENCIES` + host probe) into concern-modules; `notify.ts` slims to envelope + reducer + shared vocabulary | §1 (hooks seam) + §2 (soft-dep seam) map exact spans, call-sites, and the function signatures the concern modules must export. §3 confirms what stays. |
| MOD-05 | Adding a command touches ≤3 central files, 0 `notify.ts` edits, vs the 5 / 9–11 baseline | §5 extracts the baseline figures + enumerates the 3 post-extraction touch-points with concrete line evidence (router.ts:26–49/55–85/143–213/87–110; register.ts:79–96; one output-catalog.md section). |
| MOD-06 | Catalog floor documented — one section per rendered state, no generation seam (deferred) | §5 + D-03: the proof doc records the catalog as the explicit 3rd central file and the accepted floor. |
| GATE-03 | `npm run check` green + `catalog-uat` byte-equality at milestone close | §6 gives the exact verification recipe; `npm run check` = `typecheck && lint && format:check && test && test:integration`. |
</phase_requirements>

## Summary

This is a **mechanical move-and-rewire** of two already-cohesive code blocks out of `extensions/pi-claude-marketplace/shared/notify.ts` (3431 lines) into two new files under `shared/concerns/`, plus a **durable documentation artifact** that measures the open-closed target. There is **no new behavior, no new grammar, no registry, no architecture test** — all explicitly excluded by D-01/D-02 and the output-neutral constraint.

The two seams are both already clean. The **hooks concern** is `appendHooksBlock` (notify.ts:2873–2888) + its private driver tuple `COMPONENT_KINDS` (:2851–2857), consumed by exactly one caller, `appendResolvedComponentLines` (:2902–2922), which feeds `renderPluginInfo` (:2974). The **soft-dep concern** is `DEPENDENCIES` (:476), `SOFT_DEP_MARKER_AGENTS`/`_MCP` (:1620–1621), and the probe-to-marker mapping currently living **inside** `composeReasons` (:1749–1770, specifically the two gated `composed.push(MARKER)` blocks at :1757–1762). The critical nuance D-01 already anticipates: `composeReasons` itself **stays central** (it is shared vocabulary called from 13+ command render maps across `orchestrators/**`), but its soft-dep *branch* — the marker constants and the `declaresX && !probe.X → push` mapping — moves to the concern, and `composeReasons` calls into it.

**Primary recommendation:** Create `shared/concerns/hooks.ts` (exports `appendHooksBlock` + `HookSummaryEntry`/`HookSummary`/`ClaudeHookEvent` types + `COMPONENT_KINDS` if it travels) and `shared/concerns/soft-dep.ts` (exports `DEPENDENCIES`, `Dependency`, the two markers, and a pure `softDepMarkers(declaresAgents, declaresMcp, probe): readonly Reason[]` helper that `composeReasons` appends). Rewire the two central call-sites to import from the concern modules. Add the D-02/D-03 proof to a new durable doc (recommend `docs/open-closed-proof.md`). Gate every commit on `git diff --exit-code docs/output-catalog.md` + `node --test tests/architecture/catalog-uat.test.ts` + `npm run check`. The import fence permits this freely: `shared/concerns/*` is inside the `shared/` zone, intra-`shared` imports are unrestricted, and the existing `shared/notify-reasons.ts → shared/notify.ts` import proves the pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hooks-summary rendering (`appendHooksBlock`) | shared/concerns (presentation concern) | shared/notify.ts (info renderer calls it) | Pure string-building over `HookSummaryEntry[]`; the info renderer is the only consumer. Owns its data; the renderer dispatches into it. |
| Soft-dep marker injection (`DEPENDENCIES`, markers, probe→marker map) | shared/concerns (presentation concern) | shared/notify.ts (`composeReasons` appends), platform/pi-api.ts (probe source) | Pure given the probe result. The probe (`softDepStatus(pi)`) is an environment read → stays in the renderer (notify.ts entry points); the concern consumes the snapshot. |
| `composeReasons` brace composer | shared/notify.ts (shared vocabulary) | — | Called by 13+ command render maps; it STAYS central and delegates the soft-dep branch to the concern. |
| `softDepStatus(pi)` probe | platform/pi-api.ts | shared/notify.ts (entry points call it) | Already isolated in platform; reads the Pi tool registry. NOT moved this phase. |
| Open-closed measurement (D-02) + catalog floor (D-03) | docs/ (durable artifact) | — | A written walkthrough, not code; per D-02/D-03 it is a doc, never a code comment or test. |

## Standard Stack

**No new dependencies.** This is a pure in-repo refactor of existing TypeScript. The stack is fixed by the project (TypeScript strict, ESM, `node:test`, ESLint 10 flat config + `import-x`). No `npm install`. No registry interaction.

**Package Legitimacy Audit:** N/A — no external packages are added, removed, or upgraded in this phase. `[VERIFIED: phase scope is move-and-rewire of existing files + one new docs file]`

## Architecture Patterns

### System Architecture Diagram (the two extraction seams)

```
                        notify entry points (STAY in notify.ts)
                        notify() :3143 / emitContextCascade() :3234 /
                        emitReconcileAppliedContextCascade() :3284
                                       │
                        const probe = softDepStatus(pi)   ← ENVIRONMENT read
                        (:3152 / :3244 / :3294)              STAYS in renderer
                                       │ probe: SoftDepStatus threaded down
                ┌──────────────────────┴───────────────────────┐
                ▼                                               ▼
   CASCADE path                                      INFO path
   composeMarketplaceBlock :3024                     dispatchInfoMessage :3083
        → renderPluginRow :1890 (central switch)       → renderPluginInfo :2974
        → OR command render maps in                       → appendResolvedComponentLines :2902
          orchestrators/**/*.messaging.ts                     │ (kind === "hooks")
                │                                              ▼
                ▼                                  ┌────────────────────────────┐
   composeReasons(reasons,                        │  HOOKS CONCERN (extract)    │
     declaresAgents, declaresMcp, probe) :1749    │  appendHooksBlock :2873     │
        │  STAYS central (shared vocab)           │  COMPONENT_KINDS :2851      │
        │  delegates soft-dep branch ▼            │  HookSummaryEntry types     │
   ┌────────────────────────────────────┐         │  :189 (+ ClaudeHookEvent    │
   │  SOFT-DEP CONCERN (extract)         │         │   :177, HookSummary :198)   │
   │  DEPENDENCIES :476                  │         └────────────────────────────┘
   │  SOFT_DEP_MARKER_AGENTS/_MCP :1620  │
   │  probe→marker map (the two gated    │
   │  composed.push(...) :1757–1762)     │
   └────────────────────────────────────┘
```

A reader can trace the primary cascade case: a producer emits rows → `notify()` reads the probe once → threads it → `renderPluginRow`/command render map calls `composeReasons` → `composeReasons` appends soft-dep markers via the concern → byte-identical output.

### Recommended Project Structure (additive only)

```
extensions/pi-claude-marketplace/shared/
├── notify.ts              # SLIMS: envelope + reducer spine + shared vocabulary
│                          #   (composeReasons stays; its soft-dep branch calls the concern)
├── notify-reasons.ts      # unchanged (existing intra-shared importer — the import-fence precedent)
├── notify-context.ts      # unchanged
└── concerns/              # NEW subdir, INSIDE the shared/ import zone
    ├── soft-dep.ts        # NEW: DEPENDENCIES, Dependency, markers, softDepMarkers() pure helper
    └── hooks.ts           # NEW: appendHooksBlock, HookSummaryEntry/HookSummary/ClaudeHookEvent, COMPONENT_KINDS?
```

```
docs/
├── output-catalog.md      # MUST stay byte-identical (git diff --exit-code)
└── open-closed-proof.md   # NEW (recommended): the D-02 measurement + D-03 floor (durable, discoverable)
```

### Pattern 1: Concern owns data + pure logic; central composer calls into it (D-01)

**What:** Move the soft-dep marker *decision* (which markers to append given declares-flags + probe) into the concern as a pure function. `composeReasons` keeps the brace-composition (shared vocabulary) and calls the concern for the markers.

**When to use:** This is the D-01 wiring shape — a direct static import + call, no interface/registry.

**Example (illustrative target shape — signatures at planner discretion):**
```typescript
// shared/concerns/soft-dep.ts (NEW)
// Source pattern: lifted verbatim from notify.ts:1757-1762 marker-push logic.
import type { Reason } from "../notify.ts";          // intra-shared import — allowed
import type { SoftDepStatus } from "../../platform/pi-api.ts"; // shared→platform — allowed

export const DEPENDENCIES = ["agents", "mcp"] as const;   // from notify.ts:476
export type Dependency = (typeof DEPENDENCIES)[number];    // from notify.ts:495

const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents"; // from notify.ts:1620
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";          // from notify.ts:1621

/** Pure given the probe result. Returns the soft-dep markers to append. */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];
  if (declaresAgents && !probe.piSubagentsLoaded) { markers.push(SOFT_DEP_MARKER_AGENTS); }
  if (declaresMcp && !probe.piMcpAdapterLoaded) { markers.push(SOFT_DEP_MARKER_MCP); }
  return markers;
}
```
```typescript
// shared/notify.ts composeReasons (STAYS central, soft-dep branch delegated)
import { softDepMarkers } from "./concerns/soft-dep.ts";

export function composeReasons(reasons, declaresAgents, declaresMcp, probe): string {
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];
  composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe)); // delegated
  if (composed.length === 0) { return ""; }
  return `{${composed.join(", ")}}`;
}
```

> The byte output is identical: same markers, same order (agents before mcp), same `{a, b}` join. `catalog-uat` proves this.

### Pattern 2: Hooks renderer is a pure block-appender; info renderer dispatches into it

**What:** `appendHooksBlock(lines, entries)` (notify.ts:2873) mutates a `string[]` in place — already a self-contained pure function. Move it + `COMPONENT_KINDS` + the `HookSummaryEntry`/`HookSummary`/`ClaudeHookEvent` types to `shared/concerns/hooks.ts`. `appendResolvedComponentLines` (:2902) imports and calls it identically.

**Example (the one call-site that must remain byte-identical):**
```typescript
// shared/notify.ts appendResolvedComponentLines :2907-2911 — call unchanged
for (const kind of COMPONENT_KINDS) {        // COMPONENT_KINDS may travel to hooks.ts or stay
  if (kind === "hooks") {
    appendHooksBlock(lines, components.hooks); // imported from ./concerns/hooks.ts
    continue;
  }
  // ...
}
```

### Anti-Patterns to Avoid
- **Inverting the call direction (concern imports notify's renderer).** The concern must be a *leaf* the renderer calls into. If `soft-dep.ts` imported a renderer function from `notify.ts` while `notify.ts` imports `soft-dep.ts`, you create a cycle. D-01's direct-call direction (renderer → concern, concern depends only on `Reason`/`SoftDepStatus` types) avoids this. See §7.
- **Moving `composeReasons` itself into the concern.** It is called by 13+ command render maps and is shared vocabulary — moving it breaks every `orchestrators/**/*.messaging.ts` import and exceeds the D-01 scope ("central `composeReasons` calls into it"). It STAYS.
- **Adding a `Concern` interface / registry / iteration.** Explicitly forbidden by D-01. Direct static imports only.
- **Encoding the proof as a code comment.** D-02/D-03 require a durable, discoverable doc artifact, not a comment.
- **Re-deriving the soft-dep gate inside the concern.** The `dependencies.includes("agents")` derivation lives at the call sites (render maps + `installedLikeRow`); the concern receives booleans. Keep that split to preserve byte parity with the 13 existing call sites.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving output didn't change | A new diffing harness or snapshot test | Existing `tests/architecture/catalog-uat.test.ts` byte-equality runner + `git diff --exit-code docs/output-catalog.md` | The byte gate already exists and is the milestone's GATE-02. §6. |
| Soft-dep probe | A new probe abstraction | Existing `softDepStatus(pi)` (platform/pi-api.ts:121) threaded by the renderer | D-01 keeps the probe in the renderer; the concern is pure. |
| Enforcing `notify.ts` purity | An architecture/lint test | A documented measurement (D-02) | The user explicitly chose the documented path over an enforceable gate. |
| Catalog per-command sections | A generation/aggregation seam | Hand-authored catalog, one section per state | D-03 / MOD-06 floor — generation is deferred, OUT OF SCOPE. |

**Key insight:** Both concerns are already cohesive, single-caller blocks. The temptation is to "improve" them during the move (add an interface, generalize the markers, generate the catalog). Every such improvement violates a locked decision. The job is a verbatim move + import rewire that `catalog-uat` proves byte-identical.

## Section 1 — HOOKS CONCERN extraction seam

**What moves to `shared/concerns/hooks.ts`:**

| Symbol | Current location | Kind | Notes |
|--------|------------------|------|-------|
| `appendHooksBlock(lines, entries)` | notify.ts:2873–2888 | `function` (file-private today) | The only renderer of hook entries. Mutates `string[]` in place. Must be `export`ed so the info renderer imports it. |
| `COMPONENT_KINDS` | notify.ts:2851–2857 | `const` tuple `["agents","commands","hooks","mcp","skills"]` | **Decision point (Claude's discretion):** `COMPONENT_KINDS` is *not* hooks-specific — it drives the whole per-kind loop in `appendResolvedComponentLines`. It is derived from `ComponentKind = keyof PluginInfoComponentsResolved["components"]` (:2850). **Recommend it STAYS in notify.ts** with `appendResolvedComponentLines` (which stays), since only the `kind === "hooks"` arm dispatches into the concern. Moving it would drag the `PluginInfoComponentsResolved` type dependency into the concern. The CONTEXT lists it under the hooks concern, so the planner may move it; if so, the concern must also import `ComponentKind`/`PluginInfoComponentsResolved` from notify.ts (intra-shared, allowed). The cleaner cut leaves `COMPONENT_KINDS` + `appendResolvedComponentLines` central and moves only `appendHooksBlock` + the hook types. |
| `ClaudeHookEvent` type | notify.ts:177–185 | `export type` (8-event literal union) | Public literal union of supported Claude hook events. |
| `_ToolEvent` type | notify.ts:187 | file-private `type` | `"PreToolUse" \| "PostToolUse" \| "PostToolUseFailure"`. Travels with `HookSummaryEntry`. |
| `HookSummaryEntry` type | notify.ts:189–196 | `export type` (3-arm discriminated union) | The shape `appendHooksBlock` renders. |
| `HookSummary` interface | notify.ts:198–200 | `export interface` | Labelled wrapper. |

**The `HookSummaryEntry` import-fence reason (confirmed from code + research):**

notify.ts:139–175 documents it directly `[VERIFIED: notify.ts:139-175]`:
> "Type definitions live here (in `shared/`) so the rendering surface can consume them **without violating the `shared/` → `domain/` import-direction fence** (`import-x/no-restricted-paths`)."

The matching **runtime** tuples (`BUCKET_A_EVENTS`/`TOOL_EVENTS`) live in `domain/components/hook-events.ts` and are pinned to these literal unions via `satisfies readonly ClaudeHookEvent[]`. `shared/` may **not** import from `domain/`, so the *types* must live on the `shared/` side; `domain/` imports them downward (allowed). MESSAGING-COUPLING.md §B.5 confirms: "`HookSummaryEntry` types already live at `notify.ts:198–221` for an import-fence reason."

**Fence impact of the move:** `shared/concerns/hooks.ts` is **inside the `shared/` zone**, so relocating the types there **preserves the fence identically** — `domain/components/hook-events.ts` keeps importing them from a `shared/` path (`../../shared/concerns/hooks.ts` instead of `../../shared/notify.ts`). No fence breach. The planner must update the import path in `domain/components/hook-events.ts` (and any other `domain/` consumer) from `notify.ts` to `concerns/hooks.ts`. See §4 for the full import-update list.

**The exact call-site the extracted module must satisfy (output-neutral):**

`appendResolvedComponentLines` (notify.ts:2902–2922) calls, at :2909:
```typescript
appendHooksBlock(lines, components.hooks);
```
So `shared/concerns/hooks.ts` MUST export:
```typescript
export function appendHooksBlock(
  lines: string[],
  entries: readonly HookSummaryEntry[] | undefined,
): void
```
— signature **verbatim** from notify.ts:2873. `appendResolvedComponentLines` stays in notify.ts and imports `appendHooksBlock` (and, if it travels, `COMPONENT_KINDS`) from `./concerns/hooks.ts`.

**Downstream consumer of `appendResolvedComponentLines`:** only `renderPluginInfo` (notify.ts:3004), reached via `dispatchInfoMessage` → the info path. The `components.hooks?` field is typed `readonly HookSummaryEntry[]` on `PluginInfoComponentsResolved` (notify.ts:1140). If `HookSummaryEntry` moves, `PluginInfoComponentsResolved` (which stays in notify.ts) must import it from `./concerns/hooks.ts` — intra-shared, allowed.

**Producer-side consumers of `HookSummaryEntry` (the projector that builds the entries):** `orchestrators/plugin/info.ts` imports `HookSummaryEntry` (info.ts:54) and projects parsed hook config into `readonly HookSummaryEntry[]` (info.ts:266, :309, :355, :376, :465). `orchestrators/` may import from `shared/` (allowed), so updating that import path from `shared/notify.ts` to `shared/concerns/hooks.ts` is mechanical. §4 lists it.

## Section 2 — SOFT-DEP CONCERN extraction seam

**What moves to `shared/concerns/soft-dep.ts`:**

| Symbol | Current location | Kind | Notes |
|--------|------------------|------|-------|
| `DEPENDENCIES` | notify.ts:476 | `export const ["agents","mcp"] as const` | The closed dependency tuple. |
| `Dependency` type | notify.ts:495 | `export type (typeof DEPENDENCIES)[number]` | Derived literal union. **Heavily consumed** (see fence note). |
| `SOFT_DEP_MARKER_AGENTS` | notify.ts:1620 | file-private `const: Reason = "requires pi-subagents"` | Marker literal (a `REASONS` member). |
| `SOFT_DEP_MARKER_MCP` | notify.ts:1621 | file-private `const: Reason = "requires pi-mcp"` | Marker literal. |
| The probe→marker **mapping** | notify.ts:1757–1762 (inside `composeReasons`) | the two gated `composed.push(MARKER)` blocks | This is "the soft-dep branch of `composeReasons`" the CONTEXT names. Extract as a pure `softDepMarkers(declaresAgents, declaresMcp, probe)` helper. |

**What STAYS central:** `composeReasons` itself (notify.ts:1749–1770). It is shared vocabulary — confirmed by §3. After extraction its soft-dep branch is two lines: `composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe))`.

**How `softDepStatus(pi)` is produced and threaded (confirmed):**
- **Probe definition:** `platform/pi-api.ts:121` `softDepStatus(pi: ExtensionAPI): SoftDepStatus` → `{ piSubagentsLoaded, piMcpAdapterLoaded }` (interface at pi-api.ts:83–86). Reads the Pi tool registry (`hasLoadedPiSubagents` :92, `hasLoadedPiMcpAdapter` :105). `[VERIFIED: platform/pi-api.ts:83-126]`
- **Probe call (STAYS in renderer):** `softDepStatus(pi)` is called at exactly three notify entry points — `notify()` :3152, `emitContextCascade()` :3244, `emitReconcileAppliedContextCascade()` :3294. Each comments "Single soft-dep probe per invocation" (:3148). `[VERIFIED: grep softDepStatus shared/notify.ts]`
- **Threading:** `const probe = softDepStatus(pi)` → passed as `probe: SoftDepStatus` into `composeMarketplaceBlock`/`composePluginLinesWith`/`renderMpHeader` → into `renderPluginRow` (:1890) and the command render maps → into `composeReasons(reasons, declaresAgents, declaresMcp, probe)`.

This is **exactly the D-01 shape already**: the probe (environment) is read by the renderer and threaded; `composeReasons` (and thus the future `softDepMarkers` concern function) is **pure given `probe`**. The extraction does not change threading — it only relocates the marker decision.

**The exact signature `shared/concerns/soft-dep.ts` must export, and how `composeReasons` calls it:**

```typescript
// shared/concerns/soft-dep.ts
export const DEPENDENCIES = ["agents", "mcp"] as const;
export type Dependency = (typeof DEPENDENCIES)[number];
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): readonly Reason[];   // returns [] | ["requires pi-subagents"] | ["requires pi-mcp"] | [both], in that order
```
`composeReasons` (notify.ts) replaces lines :1755–1763 with:
```typescript
const composed: Reason[] = reasons === undefined ? [] : [...reasons];
composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe));
```
Order is preserved (agents pushed before mcp, both after the caller's `reasons`), so the `{a, b}` join is byte-identical. `[VERIFIED: notify.ts:1755-1769]`

**Critical scope finding — `composeReasons` and the soft-dep gate now have MANY external callers (post-Phase-1):**

The Phase-1 migration relocated per-command render maps into `orchestrators/**/*.messaging.ts`. `composeReasons` is now imported and called from **13+ command render maps**, not just inside notify.ts `[VERIFIED: grep composeReasons extensions/pi-claude-marketplace --include="*.ts"]`:
- `orchestrators/plugin/install.messaging.ts:82`, `list.messaging.ts:92/102/112`, `info.messaging.ts:64`, `uninstall.messaging.ts:61`, `enable-disable.messaging.ts:90`, `update.messaging.ts`
- `orchestrators/marketplace/remove.messaging.ts:76`, `update.messaging.ts:67-72` (the soft-dep-bearing one, with `p.dependencies.includes("agents")/("mcp")`)
- `orchestrators/import/execute.messaging.ts:106`, `orchestrators/reconcile/reconcile.messaging.ts:173/187`

The **soft-dep gate** `p.dependencies.includes("agents")/("mcp")` appears at the soft-dep-bearing call sites (e.g. `marketplace/update.messaging.ts:69-70`, `install.messaging.ts` via the shared `installedLikeRow` primitive at notify.ts:1862–1888). **Implication for the planner:** because `composeReasons` STAYS central and keeps its 4-arg signature, **none of these 13+ call sites need to change** — the extraction is invisible to them. Only the *internals* of `composeReasons` change (delegating to `softDepMarkers`). This keeps the move surgical. The `Dependency` type is also imported by these orchestrators; see §4 for whether they import it from notify.ts or from the new concern.

## Section 3 — WHAT STAYS in notify.ts (confirmed against §Part C.4)

Confirmed by reading the live file; none of these are entangled with the two concerns beyond the two named call seams. `[VERIFIED: grep + reads of shared/notify.ts]`

| Stays | Location | Confirmation it is independent of the concerns |
|-------|----------|------------------------------------------------|
| **Envelope:** `NotificationMessage` union | notify.ts:1276 | Top-level dispatch contract. |
| **Envelope:** `notify()` dispatcher | notify.ts:3143 | Reads probe once, dispatches; concern-agnostic. |
| **Reducer spine:** `computeSeverity` / cascade max-reduce | called by `emitWithSummary` :3068 | Severity/tally; no concern coupling. |
| **Reducer spine:** `shouldEmitReloadHint` (OR-needsReload) | :3200 | Reads `row.needsReload`; no concern coupling. |
| **Reducer spine:** tally / summary line (`composeTally` :3196, `buildSummaryLine`) | :3196, :3072 | Severity-tally; no concern coupling. |
| **`RELOAD_HINT_TRAILER`** | notify.ts:2106 | Literal trailer string. |
| **`isInfoKind`** + `StandaloneKind` | :1315 / :1299 | Standalone-vs-cascade routing. |
| **Shared vocabulary:** `ICON_*` | :1345–1358 (`ICON_INSTALLED`/`_AVAILABLE`/`_UNINSTALLABLE`/`_DISABLED`) | Called by render maps; stays per D-11. |
| **Shared vocabulary:** `joinTokens` | :1633 | Join primitive. |
| **Shared vocabulary:** `renderScopeBracket` | :1706 | Scope bracket. |
| **Shared vocabulary:** `renderVersion` | :1675 | Version token. |
| **Shared vocabulary:** `composeVersionArrow` | :1726 | Update arrow. |
| **Shared vocabulary:** core `composeReasons` | :1749 | STAYS; delegates soft-dep branch to the concern (§2). |
| **Shared vocabulary:** `pluginRow` | :1819 | Row-composition primitive. |
| **Shared vocabulary:** `installedLikeRow` | :1862 | Folds the soft-dep-bearing arms; calls `composeReasons` with `p.dependencies.includes(...)`. Stays (it's a shared primitive); its `composeReasons` call is unchanged. |

The D-11 comment at notify.ts:1628–1632 explicitly anchors `joinTokens`/`renderScopeBracket`/`renderVersion`/`composeVersionArrow`/`composeReasons`/`pluginRow` as "the single source of the byte-stable presentation vocabulary" that stays. `[VERIFIED: notify.ts:1628-1632]`

## Section 4 — IMPORT FENCE

**The rule (ESLint flat config, `import-x/no-restricted-paths`, BLOCK C, D-11):** `[VERIFIED: eslint.config.js:179-271]`

The fence is a 9-zone `no-restricted-paths` block. The relevant zone (eslint.config.js:256–267):
```js
{
  target: "./extensions/pi-claude-marketplace/shared",
  from: [ edge, orchestrators, bridges, domain, transaction, persistence ],
  message: "shared/ may only import from platform/ for Pi API types.",
}
```

**What this means for `shared/concerns/`:**
- `shared/concerns/*` is **inside the `shared/` target zone.** The rule restricts what may import **into** `shared/` from *other* zones (edge/domain/etc. are forbidden). It does **not** restrict imports *within* `shared/`, nor imports from `shared/` to `platform/`.
- **Allowed for the concern modules:**
  - `shared/concerns/soft-dep.ts` → `import type { Reason } from "../notify.ts"` (intra-shared) ✓
  - `shared/concerns/soft-dep.ts` → `import type { SoftDepStatus } from "../../platform/pi-api.ts"` (shared→platform, the one sanctioned sibling) ✓ — and per BLOCK E (eslint.config.js:274–294) Pi types must come through `platform/pi-api.ts`, never directly from `@earendil-works/pi-coding-agent`. The concern imports the `SoftDepStatus` *type* from pi-api.ts, satisfying both rules.
  - `shared/concerns/hooks.ts` → imports nothing from `domain/` (it owns the types). ✓
- **The precedent already exists:** `shared/notify-reasons.ts:1` does `import type { Reason } from "./notify.ts"` — an intra-shared import that passes lint today. `[VERIFIED: shared/notify-reasons.ts:1]` The concern modules follow the same pattern.

**The fence-preserving relocation of `HookSummaryEntry` (the one type to handle carefully):**

`HookSummaryEntry`/`ClaudeHookEvent`/`HookSummary` currently live in `shared/notify.ts` specifically so `domain/components/hook-events.ts` can `satisfies`-pin its runtime tuples against them via a **downward** (`domain/` → `shared/`) import. Moving them to `shared/concerns/hooks.ts` keeps them on the `shared/` side → fence preserved. **Required import-path updates (mechanical, same zone direction):**

| File | Imports today (from `shared/notify.ts`) | Update to |
|------|------------------------------------------|-----------|
| `domain/components/hook-events.ts` | `ClaudeHookEvent` (and `_ToolEvent` if exported) for the `satisfies` pins | `shared/concerns/hooks.ts` (still domain→shared, allowed) |
| `orchestrators/plugin/info.ts:54` | `HookSummaryEntry` (the projector) | `shared/concerns/hooks.ts` (orchestrators→shared, allowed) |
| `shared/notify.ts` (`PluginInfoComponentsResolved.hooks?` field :1140, `appendResolvedComponentLines` :2909) | uses the types/function locally | `import` from `./concerns/hooks.ts` (intra-shared) |

**The `Dependency` type relocation (soft-dep):** `Dependency` (notify.ts:495) is consumed by the soft-dep-bearing message interfaces (`PluginInstalledMessage`/`PluginUpdatedMessage`/`PluginReinstalledMessage` declare `dependencies: readonly Dependency[]`) and by command render maps. **Decision point (Claude's discretion):** moving `Dependency` to the concern means notify.ts (which still declares those message interfaces) and the orchestrators import `Dependency` from `shared/concerns/soft-dep.ts` (all intra-shared or orchestrators→shared, allowed). No fence breach either way. **Recommend moving `DEPENDENCIES` + `Dependency` to the concern** (the CONTEXT assigns them to the soft-dep concern) and updating the ~handful of importers. Grep `Dependency` before the move to enumerate importers.

**No fence breach is possible from this extraction** — every move keeps types on the `shared/` side and every new import is intra-`shared` or `shared`→`platform`. The one thing to verify post-move: run `npm run lint` (which runs `import-x/no-restricted-paths`) — it is part of `npm run check`.

## Section 5 — D-02 PROOF BASELINE

**Baseline figures to cite verbatim (from MESSAGING-COUPLING.md §Part A.3):** `[CITED: research/MESSAGING-COUPLING.md §A.3]`

- **New command, NO new grammar:** **5 central files** — `edge/router.ts` (3 constructs: interface field, tuple, switch+usage), `edge/register.ts`, `edge/completions/provider.ts`, `docs/output-catalog.md` (new H2 section), `tests/architecture/catalog-uat.test.ts` (new fixtures). (Drops to 4 if the command takes no positional and no new flag → `provider.ts` drops out.)
- **New command WITH one new status token + one new reason:** **9–11 central files/edit-sites** — the 5 above, **plus inside `notify.ts` six distinct constructs** (status tuple, per-variant interface, union member, render arm, severity arm, reload arm) and the `REASONS`/`BENIGN_REASONS` edits, plus the `notify-types.test.ts` length-locks and the catalog status-token reference table. **`notify.ts` alone accounts for 6 of those edit sites.**

> **Important correction the proof doc MUST note:** the audit's 9–11 figure assumed the *pre-Phase-1* monolith where status tuples, per-variant interfaces, union members, render arms, and severity/reload ladders all lived centrally in `notify.ts`. **Phases 1–3 already eliminated most of those central edit sites:** command-local status sets + per-command render maps (MOD-01/02/03, Phase 1), caller-stamped severity/reload (Phase 2, deleting `cascadeSeverity`/`BENIGN_REASONS`/`shouldEmitReloadHint` token-mapping), and the deletion of `notify-types.test.ts` length-locks (Phase 1 D-03). So the "6 inside notify.ts" sites were *already* collapsed by Phases 1–2. **Phase 4's contribution is the last two cross-cutting concerns** (hooks + soft-dep) — after which adding a command requires **0 notify.ts edits even for new grammar**, because the command owns its grammar locally and the two concerns are self-contained. The proof doc measures the *end state* and attributes the reduction across the milestone, citing this Phase-4 closure as the final step.

**The 3 central files a new command touches AFTER this extraction — with concrete current-line evidence:**

| # | Central file | What the new command edits | Evidence (current lines) |
|---|--------------|----------------------------|--------------------------|
| 1 | `edge/router.ts` | (a) one `SubcommandHandlers` interface field; (b) one `*_SUBCOMMANDS` tuple token (+ aliases); (c) one switch `case`; (d) one `*_USAGE` line | interface :26–49 (18 fields today); `TOP_LEVEL_SUBCOMMANDS` :55–69 / `MARKETPLACE_SUBCOMMANDS` :75–85; switch :143–172 / :190–213; `TOP_LEVEL_USAGE` :87–100 / `MARKETPLACE_USAGE` :102–110 `[VERIFIED: edge/router.ts]` |
| 2 | `edge/register.ts` | one wiring line in the `handlers` object | :78–97 (18 entries today, one `make*Handler(pi[, deps])` per command) `[VERIFIED: edge/register.ts:78-97]` |
| 3 | `docs/output-catalog.md` | one H2 section + `<!-- catalog-state: STATE -->` fenced block per new rendered state | the hand-authored per-command sections; parsed by `catalog-uat.test.ts` (D-03 floor: stays hand-authored, no generation seam) |

= **3 central files, 0 `notify.ts` edits.** `provider.ts` and the catalog-uat `FIXTURES` map are the audit's "partially irreducible" items (Part D); the proof doc should acknowledge them honestly: `completions/provider.ts` may still need a declarative descriptor for commands with novel positional/flag shapes (audit Part D.1), and `catalog-uat.test.ts` `FIXTURES` gains one entry per state (audit C.3). The D-02 target as locked counts the **3 grammar/registration files**; the proof doc should state the provider/fixtures caveat rather than claim absolute zero-touch (honest reporting; matches audit Part D). The locked D-02 wording ("router registration, register.ts wiring, one catalog section = 3 central files") is what the doc proves.

**Recommended proof-doc location (Claude's discretion):** `docs/open-closed-proof.md` — a new durable, discoverable doc co-locating the D-02 measurement and the D-03 catalog floor. Rationale: `docs/` is where `output-catalog.md` and `messaging-style-guide.md` already live, so reviewers find it; it is not a code comment (D-02/D-03 forbid that); a standalone file is more discoverable than an appended section buried in the catalog. Alternative acceptable per discretion: an ADR-style note. **`docs/output-catalog.md` must NOT be the host** — it is byte-frozen by `git diff --exit-code` (§6), so appending the proof there would break the neutrality gate.

## Section 6 — OUTPUT-NEUTRALITY VERIFICATION recipe

The exact commands that prove neutrality at every commit boundary:

**1. Catalog byte-freeze (the strongest signal):**
```bash
git diff --exit-code docs/output-catalog.md
```
Exit 0 = unchanged. Since this phase changes **no rendered output**, this file must never change. Run before every commit. `[VERIFIED: docs/output-catalog.md is git-tracked and the catalog-uat source]`

**2. Catalog-uat byte-equality test (proves notify() output == catalog bytes):**
```bash
node --test tests/architecture/catalog-uat.test.ts
```
**How it asserts byte-equality** `[VERIFIED: tests/architecture/catalog-uat.test.ts:3148-3232]`:
- Reads `docs/output-catalog.md` (path resolved at :51–52), extracts every `<!-- catalog-state: STATE -->`-annotated fenced block (`loadCatalogExamples` :89), asserting ≥30 examples (:3152).
- For each `(section, state)`, looks up a hand-authored `NotificationMessage` fixture in the central `FIXTURES` map (:246), drives `notify(ctx, fixture.pi, fixture.message)` (:3191) against a fresh mock ctx (:3190), asserts **exactly one** `ctx.ui.notify` call (:3193), and **byte-compares** the first arg `callArgs[0]` against the catalog's `example.expected` (:3202). Mismatch → `kind: "byte-mismatch"` failure (:3206).
- Also asserts the severity 2nd-arg matches `fixture.expectedSeverity` (:3213) — info omits the arg, warning/error pass it.

Because the extraction touches neither the fixtures, the catalog, nor the rendered bytes, this test stays green with **zero fixture edits**.

**3. Full quality gate (GATE-03):**
```bash
npm run check
```
= `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:integration` `[VERIFIED: package.json scripts.check]`. `npm test` runs `node --test` over `tests/{architecture,...}/**/*.test.ts` (which includes `catalog-uat.test.ts`). `npm run lint` runs the `import-x/no-restricted-paths` fence (§4) — the post-move check that no fence breach was introduced.

**Per-task verifiability for the planner:** every extraction task is verifiable by the conjunction: `git diff --exit-code docs/output-catalog.md` (no output change) AND `node --test tests/architecture/catalog-uat.test.ts` green (bytes match) AND `npm run check` green (types + lint-fence + format + all tests). The proof-doc task (D-02/D-03) is verifiable by the doc existing + the `git diff` on `output-catalog.md` staying empty (the doc lives in a separate file).

**Project commit hygiene (from CLAUDE.md):** run `pre-commit run --files <changed>` before each `git commit`; conventional-commit titles 5–72 chars; never `--no-verify`; never commit to `main` (work is on `features/notification-refactor`). If committing from a worktree, prefix `SKIP=trufflehog`.

## Section 7 — RISKS / LANDMINES

### Risk 1: Circular import (LOW — the direct-call direction prevents it)
- **Concern:** if `shared/concerns/soft-dep.ts` imported a value from `shared/notify.ts` while `notify.ts` imports the concern, ESM could cycle.
- **Mitigation (built into D-01):** the renderer (notify.ts) → concern direction is one-way. `soft-dep.ts` imports only the `Reason` **type** from notify.ts (type-only import, erased at runtime — no runtime cycle) and the `SoftDepStatus` **type** from platform/pi-api.ts. `hooks.ts` imports nothing from notify.ts (it owns its types). So even a value cycle is impossible.
- **No `import-x/no-cycle` rule is configured** `[VERIFIED: grep no-cycle eslint.config.js → only import-x/order present]`, so a cycle would not be lint-caught — making the type-only-import discipline above the actual safeguard. Recommend the planner keep `soft-dep.ts`'s notify import as `import type { Reason }`.

### Risk 2: `Reason` / `Dependency` / `HookSummaryEntry` placement creating new coupling (LOW)
- `SOFT_DEP_MARKER_AGENTS/_MCP` are typed `Reason`, and `Reason` is derived from `REASONS` (notify.ts:82–125) which is the **byte-frozen catalog source** (OUT-08 — must not reorder). The concern must import `Reason` as a **type** from notify.ts, not re-declare `REASONS`. `notify-reasons.ts` already does exactly this — follow it.
- `Dependency` is consumed by message interfaces in notify.ts AND by orchestrator render maps. If moved to the concern, both import it from there. Grep `Dependency` to enumerate before moving; the move is safe (all importers are `shared`/`orchestrators` → allowed zones).
- `COMPONENT_KINDS` depends on `ComponentKind = keyof PluginInfoComponentsResolved["components"]`. If it travels to `hooks.ts`, the concern must import that type from notify.ts (intra-shared). **Cleaner: leave `COMPONENT_KINDS` + `appendResolvedComponentLines` in notify.ts, move only `appendHooksBlock` + hook types.** (§1.)

### Risk 3: ESLint `import-x/order` firing on the new files (LOW — mechanical)
- The active import rule is `import-x/order` (eslint.config.js:53–69): groups `builtin/external/internal/parent/sibling/index/object/type`, `newlines-between: always`, alphabetized asc. The new concern files and the edited importers must order imports accordingly (e.g. value imports before `type` imports, parent `../notify.ts` before sibling, blank line between groups). `npm run lint` catches violations; `eslint --fix` resolves ordering automatically. Not a design risk, just a formatting step.
- `@stylistic/padding-line-between-statements` (`blank line after block-like`) and `prettier` formatting also apply — `npm run format:check` is in `npm run check`. Run `prettier --write` + `eslint --fix` on the new/edited files before committing.

### Risk 4: Forgetting a `HookSummaryEntry` / `Dependency` import-path update (MEDIUM — typecheck catches it)
- The move renames the import source for `HookSummaryEntry` (consumed by `domain/components/hook-events.ts` and `orchestrators/plugin/info.ts:54`) and possibly `Dependency`. A missed update is a **typecheck error** (`npm run typecheck`), not a silent failure — so it cannot reach a green `npm run check`. The planner should grep all importers of the moved symbols before the move and update them in the same task. Grep commands:
  ```bash
  grep -rn "HookSummaryEntry\|ClaudeHookEvent\|HookSummary\b" extensions/pi-claude-marketplace --include="*.ts"
  grep -rn "\bDependency\b\|DEPENDENCIES" extensions/pi-claude-marketplace --include="*.ts"
  ```

### Risk 5: Accidental byte drift in the marker order (LOW — catalog-uat catches it)
- `softDepMarkers` MUST push agents before mcp (matching notify.ts:1757 then :1761) and `composeReasons` MUST append them after the caller's `reasons`. Any reorder changes the `{a, b}` brace bytes → `catalog-uat` byte-mismatch. The test is the safety net; the planner just lifts the logic verbatim.

### Non-risk (worth stating): `composeReasons` call sites
- Because `composeReasons` keeps its exact 4-arg signature and stays exported from notify.ts, the **13+ orchestrator render-map call sites do not change.** The extraction is invisible to them. This is the single biggest reason the refactor is low-risk.

## Validation Architecture

> This is an output-neutral refactor whose primary gate is byte-equality + `npm run check`. Validation is the **existing** `catalog-uat` + `check` gates, not new tests. `nyquist_validation` config was not located as explicitly `false`, so the section is included; the "sampling" here is the byte-freeze run at each commit boundary.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥ 20.19.0) |
| Config file | none — invoked via `package.json` scripts |
| Quick run command | `node --test tests/architecture/catalog-uat.test.ts` |
| Full suite command | `npm run check` (`typecheck && lint && format:check && test && test:integration`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-04 | Concerns extracted; output byte-identical | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` + `git diff --exit-code docs/output-catalog.md` | ✅ catalog-uat.test.ts |
| MOD-04 | No fence breach / types resolve | typecheck + lint | `npm run typecheck && npm run lint` | ✅ (tsconfig + eslint.config.js) |
| MOD-05 | ≤3-files measurement | documentation (D-02, no test) | manual review of `docs/open-closed-proof.md` | ❌ Wave 0 — the proof doc is authored this phase |
| MOD-06 | Catalog floor documented | documentation (D-03, no test) | same doc | ❌ Wave 0 — authored alongside D-02 |
| GATE-03 | Full gate green | full suite | `npm run check` | ✅ |

### Sampling Rate
- **Per task commit:** `git diff --exit-code docs/output-catalog.md` + `node --test tests/architecture/catalog-uat.test.ts`
- **Per wave merge / phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `docs/open-closed-proof.md` — the D-02 measurement + D-03 floor (new durable artifact; no test, it is documentation). Not a code test gap — a documentation deliverable.
- No new test files needed. The existing `catalog-uat.test.ts` + `npm run check` fully cover the output-neutrality contract. Adding a `notify.ts`-purity architecture test is **explicitly forbidden** (D-02).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + `node --test` | running `catalog-uat` + full suite | ✓ (project baseline ≥20.19.0) | project pin | — |
| npm scripts (`check`/`typecheck`/`lint`/`format:check`/`test`/`test:integration`) | GATE-03 | ✓ | — | — |
| git | `git diff --exit-code` neutrality gate | ✓ | — | — |

No missing dependencies; no external services. This is an in-repo refactor.

## Security Domain

> `security_enforcement` config not located as explicitly `false`; including a minimal assessment.

This phase moves presentation code and writes one doc. No new input surfaces, no auth, no crypto, no network, no persistence changes.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No new inputs; the concerns render already-validated `Reason`/`HookSummaryEntry`/`Dependency` closed-set values. |
| V6 Cryptography | no | None. |
| V7 Error Handling/Logging | no | `redactAbsolutePaths` (notify.ts:223, the path-redaction security primitive) STAYS central — explicitly NOT a concern to extract (MESSAGING-COUPLING §B.5 classifies it STAY). Do not move it. |

**One thing to NOT touch:** `redactAbsolutePaths` (notify.ts:223–238) is a genuinely cross-cutting **security** primitive (NFR-9 — never leak absolute paths / `.stack`). The audit (§B.5) marks it STAY. It is unrelated to the hooks/soft-dep concerns; leave it in notify.ts.

## Project Constraints (from CLAUDE.md)

- **Output channel (IL-2):** all user-visible messages go through `ctx.ui.notify` via `shared/notify.ts`. The concern modules are pure string-builders called by the renderer; they do **not** call `ctx.ui.notify`. The ESLint BLOCK A per-file override (`files: ["extensions/pi-claude-marketplace/shared/notify.ts"]`, eslint.config.js:141) sanctions notify.ts as the sole `ctx.ui.notify` site — the new `shared/concerns/*` files are **not** covered by that override and must not call notify directly (they don't need to).
- **`shared/`→`domain/` fence (D-11, NFR):** preserved (§4). Run `npm run lint` to confirm.
- **`npm run check` must stay green (NFR-6 / GATE-03):** at every boundary.
- **English-only (IL-1), no telemetry (IL-4):** unaffected — pure refactor.
- **Git:** never commit to `main`; conventional commits 5–72 char titles; `pre-commit run --files <changed>` before commit; never `--no-verify`; `SKIP=trufflehog` prefix only when committing from a worktree. Offer version bump (`package.json` + `sonar-project.properties` + `package-lock.json` + `CHANGELOG.md`) before PR.
- **GSD workflow:** edits go through a GSD command (this is `/gsd-execute-phase` territory).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `COMPONENT_KINDS` + `appendResolvedComponentLines` are cleaner left in notify.ts (only `appendHooksBlock` + hook types move) | §1, Risk 2 | Low — the CONTEXT lists `COMPONENT_KINDS` under the hooks concern, so moving it is also valid; either cut keeps the fence and passes the gates. Planner's discretion. |
| A2 | `Dependency`/`DEPENDENCIES` move to the concern (vs. staying in notify.ts re-exported) | §2, §4 | Low — both placements pass typecheck + fence; recommendation follows the CONTEXT's concern assignment. |
| A3 | `docs/open-closed-proof.md` is the proof-doc home | §5 | Low — Claude's discretion explicitly allows new doc / ADR / appended section, provided it's durable and not a code comment and not in the byte-frozen `output-catalog.md`. |
| A4 | The D-02 proof should honestly note the `provider.ts`/`FIXTURES` caveat rather than claim absolute zero-touch | §5 | Low — matches the audit's own Part D; the locked D-02 target is the 3 grammar/registration files, which the doc proves. |

## Open Questions

1. **Does any consumer outside `orchestrators/`/`domain/` import the moved soft-dep/hook symbols?**
   - What we know: grep found importers in `orchestrators/plugin/info.ts` (HookSummaryEntry), the 13+ `*.messaging.ts` (composeReasons — unchanged signature), and `domain/components/hook-events.ts` (the satisfies pins, inferred). All are in allowed zones.
   - What's unclear: whether tests import `DEPENDENCIES`/`HookSummaryEntry` directly (MESSAGING-COUPLING §B.1 notes `DEPENDENCIES`/`MARKERS` are "only consumed by tests today" for some tuples).
   - Recommendation: the planner greps both symbol families (commands in Risk 4) as the first task step and updates every importer in the same commit; `npm run typecheck` is the backstop.

2. **Exact `softDepMarkers` return shape — `readonly Reason[]` vs. mutating a passed array.**
   - Recommendation: return `readonly Reason[]` and spread into `composed` (illustrated in §2) — cleanest, keeps the concern pure, preserves order. Planner's discretion per CONTEXT.

## Sources

### Primary (HIGH confidence — read/grepped this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` (3431 lines) — hooks seam (:177–200, :2851–2922), soft-dep seam (:476, :495, :1620–1621, :1749–1770), import-fence comment (:139–175), shared vocabulary (:1628–1632, :1345–1358), notify entry points + probe threading (:3143, :3152, :3234, :3244, :3284, :3294), `installedLikeRow` (:1862).
- `extensions/pi-claude-marketplace/platform/pi-api.ts:83–126` — `SoftDepStatus`, `softDepStatus(pi)`.
- `extensions/pi-claude-marketplace/edge/router.ts` (214 lines) — registration touch-points (:26–49, :55–85, :87–110, :143–213).
- `extensions/pi-claude-marketplace/edge/register.ts:78–97` — wiring lines.
- `eslint.config.js:53–69, :141, :179–294` — `import-x/order`, BLOCK A notify override, BLOCK C `no-restricted-paths` fence, BLOCK E Pi-import chokepoint; **no `import-x/no-cycle` present**.
- `tests/architecture/catalog-uat.test.ts:51–52, :89, :246, :3148–3232` — byte-equality mechanism.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts:1` — the intra-shared import precedent.
- `orchestrators/**/*.messaging.ts` (grep) — the 13+ `composeReasons` callers + the `dependencies.includes(...)` soft-dep gate (install.messaging.ts:82, marketplace/update.messaging.ts:67–72, etc.); `orchestrators/plugin/info.ts:54` HookSummaryEntry projector.
- `package.json` — `check`/`test` scripts.
- Phase 1–3 CONTEXT.md + STATE.md — what Phases 1–3 already removed from `notify.ts` (the §5 baseline correction).

### Secondary (the documented baseline, cited not re-derived)
- `research/MESSAGING-COUPLING.md` §A.3 (the 5 / 9–11 counts), §B.4 (reducer spine that stays), §B.5 (the two concerns + redactAbsolutePaths STAY), §C.4 (what stays central), §D (irreducible provider/catalog caveats). **Line numbers in that doc are stale (3119-line file); only its prose figures are cited.**

## Metadata

**Confidence breakdown:**
- Extraction seams (hooks + soft-dep spans, call-sites, signatures): **HIGH** — every line read against the live 3431-line file.
- Import fence behavior: **HIGH** — the rule was read in full and the intra-shared precedent (`notify-reasons.ts`) confirmed.
- Output-neutrality recipe: **HIGH** — the catalog-uat byte mechanism was read directly.
- D-02 baseline + post-Phase-1 correction: **HIGH** for the figures (cited from the audit) and the live touch-points (grepped); **MEDIUM** for the claim that Phases 1–2 already collapsed the 6 notify.ts edit sites (inferred from the Phase 1–3 CONTEXTs + STATE.md decisions, not re-measured arm-by-arm — but the proof doc is a measurement task that will confirm it).

**Research date:** 2026-06-24
**Valid until:** stable until `notify.ts` is next edited (the line numbers are the only volatile content; the seams and fence are structural). Re-grep line numbers if any other branch touches `notify.ts` before this phase executes.
