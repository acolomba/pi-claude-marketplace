# Phase 42: Type Model & Render Seam Foundations - Research

**Researched:** 2026-06-03
**Domain:** TypeScript discriminated unions, renderer arm extension, atomic-supersession commit choreography
**Confidence:** HIGH

## Summary

Phase 42 is a pure type-model + renderer-seam extension in `extensions/pi-claude-marketplace/shared/notify.ts`. It adds two new info-surface message variants (`MarketplaceInfoMessage` + `PluginInfoMessage`), one new `REASONS` closed-set entry (`"not added"`), and one file-private renderer helper (`wrapDescription`). All five artefacts land in ONE atomic commit alongside the catalog state(s) and UAT fixture(s) that first consume them, per the v1.3 retrospective atomic-supersession lesson (`c4d87d4`, `dbd149a`).

The phase produces **zero behavior change** for any v1.0-v1.7 command surface: the existing 10-arm plugin status switch in `renderPluginRow` and the 7-arm marketplace status switch in `renderMpHeader` must remain byte-identical for all 60+ catalog UAT fixtures that exercise them. The new render arms are reached only via new top-level message variants that no existing call site emits.

**Primary recommendation:** Convert `NotificationMessage` from a single-shape envelope into a tagged discriminated union (`kind: "cascade" | "marketplace-info" | "plugin-info"`) with the existing `{ marketplaces: ... }` shape as the `cascade` arm. Add a discriminated `notify()` dispatcher that switches on `kind` and routes to the existing cascade path or to one of two new file-private renderers. This is the only architecture that satisfies SC#1's "reachable from `NotificationMessage`" wording while preserving byte-equality for every existing fixture (the cascade path is unchanged) and exhaustiveness via `assertNever` per NFR-7.

## User Constraints (from CONTEXT.md)

### Locked Decisions

None -- discuss phase was auto-skipped via `workflow.skip_discuss: true`. The phase is constrained instead by the ROADMAP success criteria (5 SC items) and the binding catalog UAT byte-equality gate.

### Claude's Discretion

All implementation choices at Claude's discretion per the auto-context. Specifically:

- The shape of the discriminator field on `NotificationMessage` (recommended: `kind: "cascade" | "marketplace-info" | "plugin-info"`).
- The shape of the `componentsResolved: true | false` discriminator on `PluginInfoMessage` (recommended: same `as const` literal pattern).
- The internal helper structure of `wrapDescription` (recommended: split-on-whitespace + greedy line accumulator, no library).
- The exact catalog state name for the first `{not added}` fixture (recommended: `scope-mismatch-not-added`).
- Whether to fold the two new render arms into `composeMarketplaceBlock` or to compose them in a separate dispatcher (recommended: separate dispatcher at the `notify()` top-level switch on `kind`, so cascade composition stays byte-identical).

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md (discuss skipped). The following are EXPLICITLY OUT OF SCOPE per the v1.8 REQUIREMENTS.md "Out of Scope" table:

| Item | Status |
|------|--------|
| Install/uninstall/update/reinstall fix for missing-marketplace error misattribution | BACKLOG -- v1.8 lands the `not added` reason that the future fix will reuse, no orchestrator changes outside info handlers |
| JSON / `--verbose` / `--quiet` modes | BACKLOG -- text-only |
| Network re-resolution of external `plugin.json` | NFR-5 preservation -- `components: not resolved` instead |
| Marketplace plugin list in `marketplace info` | Per user decision -- `marketplace list` already serves this |
| Plugin source line in `plugin info` | Per user decision -- marketplace header carries source |
| Author / keywords / homepage fields | Schema-widening orthogonal to v1.8 |

Phase 42 itself does NOT ship a command surface -- it ships only the contract that Phases 43 and 44 consume. The handler/orchestrator/completion work is deferred to those phases.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFO-04 | `--scope` mismatch fails with `{not added}`: `⊘ <name> [<scope>] (failed) {not added}` at column 0, severity `error`. New reason `"not added"` added to `REASONS` tuple. | The `REASONS` tuple at `shared/notify.ts:63-92` is the single source of truth. Adding one entry is mechanical; the byte form is produced by `renderPluginRow`'s existing `"failed"` arm composing `{ICON_UNINSTALLABLE} {name} [{scope}] (failed) {not added}` via `composeReasons`. Severity routes to `error` automatically via `computeSeverity` arm 1 (any `failed` status -> error). |
| INFO-08 | `STATUS_TOKENS` unchanged. `REASONS` extended with single new entry `"not added"`. Closed-set change lands in ONE atomic commit alongside catalog state(s) + UAT fixture(s). | Atomic-supersession pattern: `dbd149a` (UXG-04 renamed 2 REASONS in one commit touching renderer + orchestrator + catalog + UAT fixture + per-variant tests). Phase 42 follows the same shape, scaled to add (not rename) and to introduce 2 new variant types. |

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply to Phase 42 and the planner MUST honor them:

1. **Git branch discipline:** NEVER commit to `main`. Use `features/*`. New feature branches use `features/<name>`.
2. **Conventional Commits:** Title 5-72 chars. Body lines ≤ 80 chars. Atomic-supersession commit title pattern: `feat(42-NN): ...`.
3. **Pre-commit hook discipline:** Run `pre-commit run --all-files` (or scoped to changed files) BEFORE `git commit`. A failed hook means the commit did NOT happen -- iterate via re-stage, not `--amend`.
4. **No `--no-verify`. Ever.** Trufflehog has a documented carve-out (`SKIP=trufflehog`) for worktrees, but `pre-commit run trufflehog --all-files` MUST be run separately to confirm the scan is clean.
5. **Squash-merge PRs:** `gh pr merge --squash`. Repo disallows merge/rebase merges.
6. **TypeScript strict mode** (NFR-7): the new discriminated `kind` field on `NotificationMessage` enforces "consumers cannot read fields from a non-matching variant" at compile time.
7. **NFR-2 recovery model:** No fix may require a Pi process restart. Phase 42 ships no runtime state -- N/A.
8. **NFR-5 network policy:** Phase 42 ships no orchestrator -- N/A directly; but its `PluginInfoMessage.componentsResolved: false` discriminator EXISTS to let Phase 44 satisfy NFR-5 without fetching external `plugin.json`.
9. **IL-2:** All user-visible messages MUST flow through `ctx.ui.notify(message, severity)`. The single sanctioned `notify()` site already enforces this; Phase 42 must not introduce a second site. The new render arms compose strings INSIDE the existing `notify()` body before its single `ctx.ui.notify(...)` call.
10. **IL-4:** No telemetry. No analytics. Phase 42 is type-only -- N/A.
11. **`npm run check` must stay GREEN** (NFR-6): typecheck + ESLint + Prettier + tests. The atomic commit MUST land with all 1156+ tests green.
12. **GSD workflow enforcement:** Before Edit/Write, work through a GSD command. Plan execution will run under `/gsd-execute-phase 42`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `MarketplaceInfoMessage` / `PluginInfoMessage` type definitions | shared/ (type model) | -- | Lives alongside the rest of the structured-notification type model in `shared/notify.ts` per ADR v2-001 + SNM-17 (single grammar site). |
| `REASONS` tuple extension (`"not added"`) | shared/ (closed-set) | -- | The `REASONS` `as const` tuple at `shared/notify.ts:63` is the single source of truth (CMC-11 closed-set discipline). |
| `wrapDescription` helper | shared/ (file-private renderer helper) | -- | File-private; mirrors the existing `truncateDescription` (`shared/notify.ts:621`) pattern. NOT exported -- only `renderPluginInfo` (new) consumes it. |
| Renderer arm for `MarketplaceInfoMessage` | shared/ (renderer switch) | -- | New file-private function (`renderMarketplaceInfo`) composes the byte form; dispatcher in `notify()` routes via the new `kind` discriminator. |
| Renderer arm for `PluginInfoMessage` | shared/ (renderer switch) | -- | New file-private function (`renderPluginInfo`) composes the byte form, including the `componentsResolved` discriminator branch and `wrapDescription` invocation. |
| Catalog state for `--scope` mismatch | docs/output-catalog.md | tests/architecture/catalog-uat.test.ts (FIXTURES) | Single new fenced block + `<!-- catalog-state: ... -->` annotation in the new `## /claude:plugin marketplace info <name>` H2 section; matching FIXTURES entry. |
| Closed-set length-lock test update | tests/architecture/notify-types.test.ts | -- | Length-lock at line 116 (`PLUGIN_STATUSES`) is unchanged. NO existing test asserts `REASONS` length -- the closed-set proof is the YAML-frontmatter drift test (see Pitfall 2 below). |
| `assertNever` exhaustiveness gate | shared/notify.ts (existing helper) | -- | Existing `assertNever(p)` default arms in `renderPluginRow` (line 1073) and `renderMpHeader` (line 752) UNCHANGED. New `notify()` top-level switch on `kind` adds its own `assertNever(message)` default arm. |
| Per-status unit tests for `wrapDescription` | tests/shared/notify-v2.test.ts | -- | New tests at the file's tail; pattern mirrors existing `PL-4` description tests at lines 904-1012. |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `^5.9.3` | Strict-mode discriminated unions, indexed-access literal-union derivation | NFR-7 mandates `installable: true \| false`-style discrimination; same pattern applies to the new `kind` field on `NotificationMessage` and `componentsResolved` field on `PluginInfoMessage`. |
| Node `node:test` (built-in) | bundled with Node ≥ 20.19.0 | Test framework | Phase 42 adds tests to existing `tests/shared/notify-v2.test.ts` and `tests/architecture/catalog-uat.test.ts`; both use `node:test` already. |
| `@mariozechner/pi-coding-agent` | `^0.73.1` (peer dep) | `ctx.ui.notify(message, severity)` host API | The single sanctioned IL-2 output channel. Phase 42 does NOT change the notify call site count -- new render arms compose strings before the existing single `ctx.ui.notify(...)` call. |

### Supporting

No supporting libraries added. The `wrapDescription` helper is implemented in-house (see "Don't Hand-Roll" below for why).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `as const` tuple + `(typeof X)[number]` for `kind` discriminator | A separate `KIND` exported const | `as const` literal field on each variant interface is the established Phase 15 pattern (D-15-11); a separate `KIND` const would duplicate the literal. Reject. |
| File-private `wrapDescription` | Exported `wrapDescription` | File-private matches the existing `truncateDescription` (`shared/notify.ts:621`) and `composeReasons` patterns. Exporting would let other modules drift from the catalog byte contract; reject. |
| Convert `NotificationMessage` to discriminated union | Add a new exported `InfoMessage` type with its own `notify()`-like function | A second public entry point would violate SNM-17 (single grammar site) and would require duplicating the soft-dep probe, severity routing, and `ctx.ui.notify` dispatch logic. Reject -- one `notify()` entry, one discriminator. |
| Add `info` as a 12th `PluginStatus` literal | Compose `PluginInfoMessage` into an existing `PluginNotificationMessage` variant | The existing `PLUGIN_STATUSES` tuple is structurally consumed by the cascade renderer; mixing an info-surface status into it would force every existing fixture iteration in `notify-types.test.ts` and `catalog-uat.test.ts` to grow new exclusion logic. Reject -- info messages are a sibling concept to cascades, not a new plugin status. |

### Installation

No `npm install` required. Phase 42 is a pure source edit.

### Version verification

```bash
node --version          # >= 20.19.0 (NFR-4)
npm view typescript version
```

Confirmed at last project pre-commit: TypeScript pinned at `^5.9.3` per `package.json`. No version drift expected.

## Package Legitimacy Audit

Not applicable. Phase 42 installs zero packages. Disposition: **N/A**.

## Architecture Patterns

### System Architecture Diagram

```
                                    notify() entry point
                                            │
                       ┌────────────────────┴────────────────────┐
                       │  switch (message.kind)                  │
                       │  default: assertNever(message)          │
                       └────────────────────┬────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                             │                             │
       kind: "cascade"          kind: "marketplace-info"        kind: "plugin-info"
              │                             │                             │
              ▼                             ▼                             ▼
   composeMarketplaceBlock        renderMarketplaceInfo         renderPluginInfo
   (UNCHANGED -- all existing)    (NEW -- file-private)        (NEW -- file-private)
              │                             │                             │
   ┌──────────┴──────────┐                  │                  ┌──────────┴──────────┐
   │                     │                  │                  │                     │
   renderMpHeader   renderPluginRow         │             composeReasons      wrapDescription
   (UNCHANGED:     (UNCHANGED:              │             (UNCHANGED)        (NEW file-private)
    7-arm switch +  10-arm switch +         │
    assertNever)    assertNever)            │
                                            │
                              ┌─────────────┴─────────────┐
                              │  source-kind branch       │
                              │  (github vs path)         │
                              │  + optional last_updated  │
                              │  + optional description   │
                              │  (via wrapDescription)    │
                              └───────────────────────────┘
                                            │
   ┌─────────────┐                          │                  ┌─────────────────────┐
   │ All v1.0-v1.7 ◀──────── byte-equal ────┴──── byte-new ────▶  Catalog UAT NEW    │
   │ cascade UAT │                          │                  │  --scope mismatch   │
   │ fixtures    │                          │                  │  state (Phase 42)   │
   └─────────────┘                          │                  └─────────────────────┘
                                            │
                              REASONS tuple (NEW: + "not added")
                              │  Consumed by composeReasons in BOTH
                              │  cascade and info renderers (same closed set)
                              ▼
                              `tests/architecture/notify-types.test.ts` length lock
                              (currently no REASONS length assertion -- see Pitfall 2)
```

Single grammar site preserved (SNM-17). One `ctx.ui.notify(...)` call per `notify()` invocation preserved (IL-2). New variants reachable from `NotificationMessage` via the `kind` discriminator (SC#1).

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── shared/
│   └── notify.ts                          # ONLY file touched in source tier
docs/
│   ├── output-catalog.md                  # NEW H2 section + catalog-state fixture
│   ├── messaging-style-guide.md           # OPTIONAL: note "not added" in §"Severity routing"
│   └── adr/v2-001-structured-notify.md    # OPTIONAL: amendment for Phase 42 (mirrors Phase 17.1 / Phase 29 amendments)
tests/
├── architecture/
│   ├── catalog-uat.test.ts                # NEW FIXTURES entry for --scope mismatch
│   └── notify-types.test.ts               # NEW: assert MarketplaceInfoMessage / PluginInfoMessage shape; assert kind discriminator round-trips; OPTIONALLY assert REASONS length grew from 28 to 29
└── shared/
    └── notify-v2.test.ts                  # NEW: per-status unit tests for wrapDescription + new render arms; lock byte form for {not added} at the column-0 (failed) shape
```

### Pattern 1: Tagged discriminated union via `kind` literal field

**What:** Convert `NotificationMessage` from a single-shape envelope into a 3-arm discriminated union with `kind: "cascade" | "marketplace-info" | "plugin-info"` as the discriminator.

**When to use:** When extending a top-level message type with shapes that the renderer must dispatch on differently. Phase 15 established this pattern at the per-plugin level (`PluginNotificationMessage` discriminates on `status`); Phase 42 lifts the same pattern up one tier.

**Example** (recommended shape -- planner has discretion to adjust the kind names):

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts (Phase 42 addition)

// Existing cascade shape, renamed via kind tag (zero behavior change for
// every v1.0-v1.7 call site -- see Migration note below).
export interface CascadeNotificationMessage {
  readonly kind: "cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}

export interface MarketplaceInfoMessage {
  readonly kind: "marketplace-info";
  readonly name: string;
  readonly scope: Scope;
  readonly details: MarketplaceDetails;
  // Source-kind detail: discriminated on sourceKind so the renderer's switch
  // picks "github: owner/repo[#ref]" vs "path: /abs/path" unambiguously.
  readonly source:
    | { readonly sourceKind: "github"; readonly owner: string; readonly repo: string; readonly ref?: string }
    | { readonly sourceKind: "path"; readonly absPath: string };
  readonly lastUpdated?: string;     // ISO8601; github sources only per INFO-01
  readonly description?: string;     // marketplace.json description (optional)
}

export interface PluginInfoMessage {
  readonly kind: "plugin-info";
  readonly marketplaceName: string;
  readonly marketplaceScope: Scope;
  readonly marketplaceDetails: MarketplaceDetails;
  readonly plugin: PluginInfoRow;
}

// The "plugin row" sub-shape: status + name + version + optional scope +
// optional description, PLUS the resolved/unresolved discriminator.
export type PluginInfoRow =
  | (PluginInfoRowBase & PluginInfoComponentsResolved)
  | (PluginInfoRowBase & PluginInfoComponentsUnresolved);

interface PluginInfoRowBase {
  readonly status: "installed" | "available" | "unavailable" | "failed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly Reason[];    // populated when status is "unavailable" | "failed"
}

interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  // Per INFO-02: alphabetically sorted by kind name (agents, commands, mcp, skills).
  // Per-kind names ALSO sorted alphabetically. Planner enforces sort discipline at
  // construction time (NOT inside the renderer).
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];  // "<plugin>@<marketplace>" form
}

interface PluginInfoComponentsUnresolved {
  readonly componentsResolved: false;
}

// The exported top-level union.
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage;
```

**Migration note:** Every existing call site (~90+ orchestrators / tests / fixtures) passes a `{ marketplaces: [...] }` shape to `notify()`. Two viable migration strategies:

1. **Add the `kind: "cascade"` literal to every call site in the atomic commit** -- mechanically tractable (search/replace), but inflates the commit file count significantly.
2. **Make `kind?` OPTIONAL on the cascade variant ONLY, defaulting to `"cascade"` when absent.** Inside `notify()`, narrow via `message.kind ?? "cascade"`. Existing call sites unchanged; new info call sites set `kind` explicitly. Discriminator is still exhaustive at compile time as long as the dispatcher handles the `undefined` arm as cascade.

**Recommendation:** Strategy #2 (optional `kind?` on cascade). Keeps the atomic-supersession commit tightly scoped to `shared/notify.ts` + tests + catalog. Planner has discretion -- Strategy #1 is also valid and produces a slightly more "honest" type model at the cost of a much larger diff.

### Pattern 2: File-private renderer helper mirroring `truncateDescription`

**What:** Add `wrapDescription(text: string, indentCol: number, wrapCol: number): string[]` as a file-private helper in `shared/notify.ts`, following the same pattern as the existing `truncateDescription` (`shared/notify.ts:621`).

**When to use:** Whenever a render arm needs a non-trivial text-formatting primitive that the catalog byte-form depends on. File-private keeps the primitive locked to the single grammar site (SNM-17).

**Example** (recommended algorithm -- planner has discretion on whitespace tokenization specifics):

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts (Phase 42 addition)

/**
 * INFO-02 hard-wrap helper. Splits `text` on whitespace, accumulates words
 * greedily into lines that fit within `wrapCol` characters (the TEXT width,
 * NOT counting the indent), and emits each line prefixed with `indentCol`
 * spaces. No ellipsis -- every word reaches an output line.
 *
 * Edge cases:
 *  - Empty text -> empty array.
 *  - A single word longer than wrapCol -> emitted on its own line at indentCol;
 *    the line WILL exceed wrapCol. Hard-wrap is greedy-by-word, not character-
 *    truncating (no ellipsis per INFO-02).
 *  - Whitespace tokenization: split on /\s+/ and filter out empty tokens, so
 *    leading/trailing/repeated whitespace collapses cleanly.
 *
 * Returned shape: `readonly string[]` so the caller composes via `.join("\n")`.
 * File-private; only renderPluginInfo (new) consumes it.
 */
function wrapDescription(
  text: string,
  indentCol: number,
  wrapCol: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) {
    return [];
  }

  const indent = " ".repeat(indentCol);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current === "") {
      current = word;
      continue;
    }

    // +1 for the space between current and word.
    if (current.length + 1 + word.length <= wrapCol) {
      current = `${current} ${word}`;
    } else {
      lines.push(`${indent}${current}`);
      current = word;
    }
  }

  if (current !== "") {
    lines.push(`${indent}${current}`);
  }

  return lines;
}
```

**Test surface** (per SC#3): unit tests at the 4-col-indent / 66-col-total used by `plugin info`. Tests MUST cover:

- Empty text -> empty array.
- Short text (< 66 chars) -> single line at `    ` indent.
- Text exactly 66 chars on word boundary -> single line.
- Text 67+ chars -> wraps at last fitting word boundary; second+ lines also indented at `    `.
- Multi-word run where one word is longer than 66 -> that word is emitted on its own (over-length) line, no truncation.
- Whitespace normalization: input with double spaces / tabs / leading whitespace produces clean output.

### Pattern 3: Atomic-supersession commit (the v1.3 retrospective lesson)

**What:** When a closed-set member changes (add / rename / remove), the change MUST land in ONE commit that simultaneously:

1. Updates the closed-set tuple in `shared/notify.ts`.
2. Updates EVERY test that asserts the tuple's contents (length lock + closed-set proof).
3. Updates the renderer arm(s) that compose bytes from the new member.
4. Updates the catalog (`docs/output-catalog.md`) with at least one byte block annotated `<!-- catalog-state: ... -->` that consumes the new member.
5. Updates the `catalog-uat.test.ts` `FIXTURES` map with the matching programmatic fixture.

**When to use:** Always, for any closed-set extension. The catalog UAT is a byte-equality gate (`tests/architecture/catalog-uat.test.ts:1481`) -- a commit that introduces a REASON but lacks a fixture is GREEN only if no catalog state references the new reason yet; once one does, both must move together or the gate goes RED.

**Reference commits (verified):**

- `c4d87d4` (v1.3, Plan 13-03) -- 4 files: ES-5 marker delete + snapshot test retire + PRD §6.12 pointer rewrite + ESLint rollback. Single rollback unit.
- `dbd149a` (v1.5, Plan 27-03 / UXG-04) -- 8 files: renderer + orchestrator + catalog + catalog UAT + per-variant tests + 2 bootstrap tests. Renamed 2 REASONS members atomically.

**Phase 42 expected file footprint for the atomic commit** (planner adjusts to actual content):

| File | Change |
|------|--------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | Add `kind` literal to `NotificationMessage` union; add `MarketplaceInfoMessage` + `PluginInfoMessage` interfaces; add `"not added"` to `REASONS`; add `wrapDescription` helper; add `renderMarketplaceInfo` + `renderPluginInfo` file-private functions; rewrite `notify()` to switch on `message.kind ?? "cascade"`. |
| `tests/architecture/notify-types.test.ts` | Add type-level proofs for the new variants (shape, kind discriminator, componentsResolved discriminator); OPTIONAL: add `REASONS` length lock (28 -> 29). |
| `tests/architecture/catalog-uat.test.ts` | Add new top-level FIXTURES entry for `/claude:plugin marketplace info <name>` (or a generic `info` section -- planner picks the section key to match the catalog H2 that the loader's `sectionRe` extracts). Add fixture for `scope-mismatch-not-added`. |
| `tests/shared/notify-v2.test.ts` | Add per-status unit tests for `wrapDescription` (5-6 tests covering the edge cases above). Add byte-form unit test for `{not added}` rendering. Add byte-form unit tests for the new info render arms. |
| `docs/output-catalog.md` | Add new H2 `` ## `/claude:plugin marketplace info <name>` `` section with at least the `scope-mismatch-not-added` fenced block + annotation. (Phase 43 adds the rest of the catalog states for `marketplace info`; Phase 42 adds only what INFO-04 forces.) |
| `docs/messaging-style-guide.md` (optional) | Note `not added` in the §"Severity routing" or §"Status token reference" prose -- the prose currently lists example reasons; adding one keeps it current. |
| `docs/adr/v2-001-structured-notify.md` (optional) | Add "Amendment: Phase 42" section mirroring the Phase 17.1 / Phase 29 amendments. Documents the info-message dispatcher addition. |

**Note on commit message:** Per CLAUDE.md, use Conventional Commits. Recommended title: `feat(42-NN): add info-message variants + "not added" REASON (atomic)`.

### Anti-Patterns to Avoid

- **Splitting the atomic commit:** "Land the type model first, then the catalog state in a second commit." Catalog UAT goes RED for the first commit; Plan 13-03 retrospective forbids this.
- **Mutating the existing `NotificationMessage` shape so existing call sites break:** Use the optional `kind?` strategy or schedule a separate mechanical-rewrite commit BEFORE the atomic-supersession commit. The atomic-supersession commit itself should ONLY contain the new contract artefacts (REASON + types + helper + fixtures + catalog).
- **Adding `wrapDescription` to the public exports:** File-private mirrors `truncateDescription`. Exporting would let other modules construct user-visible strings outside `notify()`, violating SNM-17.
- **Mutating `PLUGIN_STATUSES` to add an info-surface status:** Info messages are a SIBLING concept to cascades, not a new plugin status. Reuse the four existing literals `"installed" | "available" | "unavailable" | "failed"` on the new `PluginInfoMessage.plugin.status` field; do NOT add a 12th `PLUGIN_STATUSES` member.
- **Hand-rolling `composeReasons` for info messages:** The existing `composeReasons` (`shared/notify.ts:896`) is the SOLE site that composes `{reason, reason}` braces; the info renderers MUST reuse it (pass `false, false` for the two soft-dep declares flags -- info messages do not emit soft-dep markers).
- **Letting the renderer choose between resolved / unresolved component shapes via runtime `if`:** Per SC#1, "the renderer's switch chooses between the two shapes via discriminated-union exhaustiveness per NFR-7." That means a switch on `plugin.componentsResolved` (NOT an `if (plugin.componentsResolved !== false)` check) with `assertNever` in the default. NFR-7 is the type-safety discipline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity routing on info messages | A per-arm severity field | `computeSeverity` -- but extended to handle the new `kind` arms | Severity is structural (PRD §6.12 ES-2). For info-messages, `marketplace-info` with no failure routes to `info`; `plugin-info` with `plugin.status === "failed"` routes to `error`. Add the new arms to `computeSeverity` consistently with the existing first-match ladder. |
| Reload-hint trailer on info messages | An explicit per-call boolean | `shouldEmitReloadHint` -- but it returns `false` for info-message kinds | Info messages NEVER trigger reload (read-only surface; INFO commands don't change state). The dispatcher in `notify()` can short-circuit `shouldEmitReloadHint` on the info-message kinds, or `shouldEmitReloadHint` can check `kind` first. |
| Summary line on info messages | A per-call summary string | `buildSummaryLine` -- skip the summary line for info messages | The Phase 29 summary line counts failed/skipped *operations*. An info command surfacing a single failed result (`{not added}`) is one operation, but the count semantics get weird ("1 plugin operation failed" for what is structurally a query result, not a transaction). Recommendation: planner SHOULD suppress the summary line for `marketplace-info` and `plugin-info` kinds; let the host's `Error:` prefix carry the severity signal alone. The cascade-only behavior of `buildSummaryLine` is preserved by gating its invocation behind `message.kind === "cascade"`. |
| Sorting components arrays | Sort at render time inside `renderPluginInfo` | Sort at message-construction time (in Phase 43/44 orchestrators) | The PluginInfoMessage type contract says "sorted per-kind component arrays" -- the renderer assumes pre-sorted input. Sorting at render time mixes responsibilities; the type contract is the gate. (This decision is documented here so Phase 43/44 planners know not to dump unsorted arrays into the message.) |
| Wrapping text | `npm install word-wrap` / `npm install wrap-ansi` | In-house `wrapDescription` (Pattern 2 above) | The algorithm is ~15 lines. A library would add a runtime dep for trivial logic, violating the lean-deps posture in CLAUDE.md ("Vendor Philosophy: pragmatic-fast"). Also: `wrap-ansi` is overkill (no ANSI in catalog byte forms), and `word-wrap` returns a joined string -- we want an array for indent control. |

**Key insight:** Phase 42 is a CONTRACT phase. The temptation to "do too much" (sort components at render time, add helpful debug fields, optimize the discriminated-union pattern) leads to commits that exceed the SC#5 boundary ("nothing else"). Stick to the five SC items.

## Runtime State Inventory

Phase 42 is a pure source edit (type model + renderer arms). No runtime state changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no schema change to `state.json` or any persistence layer. | None -- verified by reading `shared/notify.ts` (pure type model, no I/O). |
| Live service config | None -- no external service touched. | None -- verified by inspecting NFR-5 compliance (info commands ship in Phases 43-44, not 42). |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None -- TypeScript transpilation is at runtime via Node native TS strip; no compiled artefact regenerates. | None. |

## Common Pitfalls

### Pitfall 1: Breaking byte-equality on a v1.0-v1.7 cascade fixture

**What goes wrong:** The Phase 42 commit modifies `renderMpHeader` or `renderPluginRow` (the existing cascade-path switches) in addition to adding the new info arms; one of the 60+ existing catalog UAT fixtures starts failing.

**Why it happens:** The new render arms might LOOK like they belong inside the existing `composeMarketplaceBlock` (the per-marketplace block composer). They do NOT -- info messages have a structurally different shape (no `plugins[]` array; the plugin row IS the message, not a child of a marketplace).

**How to avoid:** Compose info messages via a NEW file-private function (`renderMarketplaceInfo` / `renderPluginInfo`) called directly from the top-level `notify()` dispatcher. Leave `composeMarketplaceBlock`, `renderMpHeader`, `renderPluginRow`, `composePluginLines` UNTOUCHED.

**Warning signs:** A diff that touches any of those 4 functions, or that adds a new arm to `renderMpHeader` / `renderPluginRow`'s switch. Code review checklist: the catalog UAT MUST stay GREEN after each commit in the worktree.

### Pitfall 2: The REASONS tuple has NO length-lock test

**What goes wrong:** Phase 42 assumes a length-lock test exists for `REASONS` (per the SC#2 wording: "length lock and closed-set proof are updated to the new count"). It does NOT.

**Why it happens:** `tests/architecture/notify-types.test.ts` length-locks `PLUGIN_STATUSES` (line 116, currently 11), `MARKETPLACE_STATUSES` (line 120, currently 7), and `DEPENDENCIES` (line 126, currently 2). It does NOT length-lock `REASONS`. The closed-set proof for `REASONS` is the YAML-frontmatter drift test (`tests/architecture/grammar-frontmatter.test.ts`) reading `docs/messaging-style-guide.md` frontmatter -- but the style guide v2.0 retired the YAML enumeration (the guide now refers callers to `shared/notify.ts::REASONS` as the source of truth).

**How to avoid:** The planner has TWO options:

1. **Add a `REASONS` length lock to `notify-types.test.ts` in the Phase 42 atomic commit.** Mirrors the pattern at line 120: `type _Assert_ReasonsLen = (typeof REASONS)["length"] extends 29 ? true : never; export const _l4: _Assert_ReasonsLen = true;`. The SC#2 wording aligns with this option.
2. **Verify with a grep audit that no existing test asserts `REASONS.length`, then add the assertion + the new "not added" member in one go.** Same outcome as option 1, just framed as "extend the architecture test suite" rather than "fix a gap."

Recommendation: option 1. Adds 4 lines to `notify-types.test.ts` and matches the SC#2 wording exactly.

**Warning signs:** Plan grep for `REASONS\\.length` or `REASONS\["length"\]` -- if no hits, the length lock doesn't exist and must be added.

### Pitfall 3: The `kind` discriminator default-arm trap

**What goes wrong:** Migrating `notify()` to a `switch (message.kind)` without exhaustive `assertNever` lets a future code change silently fall through to a default arm, breaking the SNM-17 grammar-locking discipline.

**Why it happens:** A naive switch with `case "cascade": ... ; default: return;` looks defensive but loses the compile-time exhaustiveness gate. The existing `renderPluginRow` (`shared/notify.ts:1073`) and `renderMpHeader` (`shared/notify.ts:751`) use the canonical pattern:

```ts
default: {
  assertNever(p);
  return "";
}
```

**How to avoid:** Follow that exact pattern for the new `notify()` top-level switch. The `return ""` after `assertNever(message)` satisfies the noImplicitReturns rule.

**Warning signs:** A switch in `notify()` that lacks `assertNever`. ESLint won't catch this -- only careful code review will.

### Pitfall 4: `wrapDescription` produces lines whose TOTAL width (indent + text) exceeds 66

**What goes wrong:** SC#3 says "hard-wraps a description at the requested column count" and "indented at indentCol." Ambiguity: is `wrapCol` the TEXT width or the TOTAL width?

**Why it happens:** INFO-02's catalog requirement says "col 4 indent / 66-col total width." Two valid interpretations:

- **Total width interpretation:** indent + text ≤ 66. Text width = 66 - 4 = 62. `wrapDescription(text, 4, 62)`.
- **Text width interpretation:** text ≤ 66. Lines render as 70 chars including indent. `wrapDescription(text, 4, 66)`.

**How to avoid:** The catalog byte fixtures Phase 43/44 will eventually pair drive the answer. Phase 42's per-status unit tests can lock EITHER interpretation as long as they match what INFO-02's catalog state will eventually assert. Recommendation: planner aligns with the existing `truncateDescription` (`shared/notify.ts:621`) which uses `DESCRIPTION_MAX_COLS = 66` as the TEXT width (the comment is explicit: "The column limit applies to the description TEXT; the 4-space indent prefix is NOT counted"). For consistency, `wrapCol` parameter = TEXT width. Pass `wrapDescription(text, 4, 66)` from the renderer.

**Warning signs:** Per-status tests that lock arbitrary wrap points without traceability to INFO-02's catalog state. Add an explicit comment in the test file noting which interpretation is locked and pointing back to INFO-02.

### Pitfall 5: Sorting at render time (silent contract violation)

**What goes wrong:** `PluginInfoMessage` type contract says "sorted per-kind component arrays" (SC#1). A renderer that sorts on the fly hides downstream caller bugs (Phase 44 orchestrator passes unsorted arrays; tests pass; production output is sorted, masking the construction bug).

**Why it happens:** Defensive sorting feels safer. It is not -- it hides the contract.

**How to avoid:** Do NOT sort in `renderPluginInfo`. Phase 44's orchestrator MUST sort before constructing the message. Add a comment to the `PluginInfoMessage` interface stating the precondition. (The renderer can OPTIONALLY assert sort order in dev builds via an `assert` from `node:assert`, but this is overkill for Phase 42.)

**Warning signs:** A `.sort(...)` call inside any `renderPluginInfo` or `renderMarketplaceInfo` arm.

### Pitfall 6: Catalog UAT `loadCatalogExamples` H2 section parser is strict

**What goes wrong:** Adding a new H2 section to `docs/output-catalog.md` for `marketplace info` requires the section heading to match the `sectionRe` regex at `tests/architecture/catalog-uat.test.ts:82`:

```ts
const sectionRe = /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors)\s*$/;
```

The captured section name is `sectionMatch[2]` (the value INSIDE the backticks, e.g. `/claude:plugin marketplace info <name>`). The FIXTURES outer-map key MUST match that captured string byte-for-byte.

**Why it happens:** Mismatched H2 + FIXTURES key results in `[MISSING FIXTURE]` UAT failure that points at the H2 string -- diagnosable but easy to introduce.

**How to avoid:** Plan the H2 string in advance:
- Phase 42 (this phase): `` ## `/claude:plugin marketplace info <name>` `` (or `` ## `/claude:plugin info <plugin>@<marketplace>` `` if the planner chooses to anchor INFO-04's first fixture under that command instead of `marketplace info`).
- Phase 43 (INFO-01): same `marketplace info` H2 already established by Phase 42.
- Phase 44 (INFO-02): new H2 `` ## `/claude:plugin info <plugin>@<marketplace>` `` (if not already added in Phase 42).

Recommendation: Phase 42 adds the `marketplace info` H2 (it's the first phase to need one), but Phase 42's `scope-mismatch-not-added` catalog state can live under EITHER `marketplace info` (the natural fit) OR `plugin info` (if Phase 42 also creates that H2). Pick `marketplace info` for Phase 42 -- it minimizes Phase 42's catalog footprint to a single new H2.

**Warning signs:** UAT fails with `[MISSING FIXTURE]` -- check the FIXTURES key against the H2 byte form.

## Code Examples

Verified patterns from the existing `shared/notify.ts`:

### Existing closed-set tuple + indexed-access literal-union (PLUGIN_STATUSES pattern)

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:241-253 (PLUGIN_STATUSES)
export const PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  // ... 8 more entries
] as const;

export type PluginStatus = (typeof PLUGIN_STATUSES)[number];
```

Apply same pattern for a new `INFO_STATUSES` tuple if the planner wants a closed set for `PluginInfoMessage.plugin.status`. Recommendation: do NOT create `INFO_STATUSES`; inline the literal-union type as `"installed" | "available" | "unavailable" | "failed"` -- it's a 4-member closed set used in only one place, and adding a tuple creates a parallel-set-membership concern.

### Existing renderer arm with assertNever exhaustiveness

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:954-1078 (renderPluginRow)
function renderPluginRow(p: PluginNotificationMessage, probe: SoftDepStatus, mpScope: Scope): string {
  switch (p.status) {
    case "installed":
    case "present":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(installed)",
        composeReasons(undefined, p.dependencies.includes("agents"), p.dependencies.includes("mcp"), probe),
      ]);
    // ... 9 more arms ...
    default: {
      assertNever(p);
      return "";
    }
  }
}
```

The new `notify()` top-level switch on `message.kind` follows this exact shape.

### Existing per-status unit test pattern

```ts
// Source: tests/shared/notify-v2.test.ts:904-930 (PL-4 present row with description)
test("PL-4: present row with description emits a 4-space-indented second line", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "present",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            description: "A short description of the alpha plugin.",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(
    body,
    "● official [user]\n  ● alpha v1.0.0 (installed)\n    A short description of the alpha plugin.",
  );
});
```

Phase 42's new tests mirror this shape: `makeCtx()` + `piWithBothLoaded()` + construct a `NotificationMessage` (with `kind: "marketplace-info"` or `kind: "plugin-info"`) + assert byte form. Also reuses `mock.fn()` from `node:test` and the existing helper functions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `NotificationMessage` as single-shape envelope `{ marketplaces: [...] }` | `NotificationMessage` as 3-arm discriminated union with `kind` literal | Phase 42 (this phase) | Extends pattern from per-plugin (Phase 15) to top-level. |
| Atomic-supersession across 3 files | Atomic-supersession across 5-7 files | Phase 27 (`dbd149a`) | Phase 42 follows the higher-file-count pattern. |
| Closed-set membership via YAML frontmatter | Closed-set membership via `as const` tuple in `shared/notify.ts` | Phase 15 / ADR v2-001 | The style guide is now a pointer to the source; no duplicated lists. |

**Deprecated/outdated:**

- The YAML-frontmatter approach to `REASONS` (v1.0 style guide). The v2.0 style guide retired it; `shared/notify.ts::REASONS` is the source of truth.
- The "ES-5 marker" approach to user-contract strings. PRD §6.12 ES-5 is a historical baseline; the messaging style guide §15 supersession is canonical.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `REASONS` tuple does NOT currently have a length-lock test. | Pitfall 2 | If a hidden length-lock exists somewhere I missed, the atomic commit might break it AND require fixing it in the same commit -- still atomic, but the planner should pre-grep to confirm. Mitigation: planner runs `git grep -n "REASONS" tests/` as a first step in Wave 0. | [ASSUMED]
| A2 | The recommended `kind` discriminator names (`"cascade" \| "marketplace-info" \| "plugin-info"`) are stylistically aligned with the project's naming conventions. | Pattern 1 | Names are at Claude's discretion per CONTEXT.md; a different naming (e.g. `"render-kind"`) would also satisfy SC#1. Cosmetic only. | [ASSUMED]
| A3 | The 4-col / 66-col wrap parameters for `wrapDescription` align with INFO-02's catalog spec ("col 4 indent / 66-col total"). | Pitfall 4 | Phase 44 catalog states will eventually drive the answer. Phase 42 locks the helper's BEHAVIOR per its inputs; the planner can choose either interpretation as long as INFO-02's catalog states use matching parameters. | [ASSUMED]
| A4 | Migration strategy #2 (optional `kind?` on cascade variant) keeps the atomic commit small enough to land cleanly. | Pattern 1 | If TypeScript narrows poorly on `message.kind ?? "cascade"` under strict mode, strategy #1 (explicit `kind: "cascade"` on every call site) becomes necessary. Verifiable via local typecheck before commit. | [ASSUMED]
| A5 | The single new `marketplace info` H2 in `docs/output-catalog.md` is sufficient for INFO-04's first fixture; INFO-04's `--scope` mismatch state belongs under `marketplace info` (not `plugin info`). | Pitfall 6 | Per ROADMAP Phase 42 SC#2: "the first catalog state that consumes it (`docs/output-catalog.md` `--scope` mismatch fixture)" -- the wording is singular. Choosing `marketplace info` is consistent with REQUIREMENTS INFO-04's first example: `marketplace info my-mp --scope user`. | [ASSUMED] |
| A6 | The host `Error:` prefix is sufficient for `{not added}` rendering; no summary line needed for info-message error severity. | Don't Hand-Roll | A render with a summary line "1 plugin operation failed" before a `{not added}` body is confusing for what is structurally a query result. Planner has discretion to either suppress or include the summary; recommendation is suppress for info-message kinds. | [ASSUMED]

**This table is non-empty:** the planner / discuss-phase (auto-skipped) should review these assumptions before execution. A1, A4, and A6 in particular drive non-trivial decisions and the planner SHOULD verify A1 via grep before relying on the recommended approach.

## Open Questions

1. **Should `wrapDescription` be exported for use by other future commands?**
   - What we know: file-private mirrors `truncateDescription` and SC#3 says "file-private."
   - What's unclear: a future command (e.g. `plugin list --verbose`) might want the same wrap behavior; exporting now saves a refactor later.
   - Recommendation: KEEP FILE-PRIVATE per SC#3. If a future command needs the helper, extract then.

2. **Where should the `PluginInfoMessage.plugin.status: "failed"` literal route severity?**
   - What we know: `computeSeverity`'s first-match ladder routes any `failed` to `error`. The new dispatcher must traverse `plugin-info` messages similarly.
   - What's unclear: should the new dispatcher reuse `computeSeverity` (extending its traversal to include info-message kinds) or implement its own micro-severity?
   - Recommendation: extend `computeSeverity` to handle info-message kinds with their own arms. Keeps severity routing in one place (Phase 28 lesson: D-28-06 is the severity authority).

3. **Should Phase 42 also amend `docs/adr/v2-001-structured-notify.md`?**
   - What we know: Phase 17.1 and Phase 29 both added "Amendment" sections to the ADR.
   - What's unclear: Phase 42 is a contract addition, not a contract change -- the ADR's "Decision" section already permits the discriminated-union expansion pattern via SNM-17.
   - Recommendation: amendment is OPTIONAL but RECOMMENDED. A 10-line "Amendment: Phase 42" section noting the new info-message variants improves discoverability for future engineers without altering the original design rationale.

4. **Are there any existing test fixtures that exercise `notify(...)` with a payload that would silently become an `unknown` `kind` in the discriminated-union conversion?**
   - What we know: every existing `notify()` call passes `{ marketplaces: [...] }` -- the cascade shape.
   - What's unclear: dynamic test helpers that build `NotificationMessage` via `Partial` or `as never` casts might break compile-time.
   - Recommendation: planner runs `npm run typecheck` as a sanity check after the type model changes, BEFORE adding new arms. Surface any type errors immediately.

## Environment Availability

Phase 42 is a pure source edit with no external tool dependencies beyond what `npm run check` already requires.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All TypeScript + node:test execution | ✓ | (NFR-4: >= 20.19.0) | -- |
| TypeScript | `npm run typecheck` | ✓ | `^5.9.3` | -- |
| ESLint | `npm run lint` | ✓ | `^10.x` | -- |
| Prettier | `npm run format:check` | ✓ | `^3.x` | -- |
| `pre-commit` | Pre-commit hook chain (CLAUDE.md mandate) | ✓ | -- | -- |
| `trufflehog` | Pre-commit secret scan | ✓ | -- | `SKIP=trufflehog` ONLY in worktrees per CLAUDE.md; run `pre-commit run trufflehog --all-files` separately to confirm scan |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict` |
| Config file | `package.json` `scripts.check` / `scripts.test` |
| Quick run command | `npm test -- --test-name-pattern="catalog UAT\|notify-v2\|notify-types"` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFO-04 | `{not added}` REASON renders as `⊘ <name> [<scope>] (failed) {not added}` at column 0 | unit | `npm test -- tests/shared/notify-v2.test.ts` | ✅ (file exists; new test to be added) |
| INFO-04 | `{not added}` byte form matches catalog state `scope-mismatch-not-added` | architecture | `npm test -- tests/architecture/catalog-uat.test.ts` | ✅ (file exists; new FIXTURES entry to be added) |
| INFO-08 | `REASONS` tuple length is exactly 29 (28 + "not added") | type-level | `npm run typecheck` (compile-time assert) | ✅ (file exists; new length-lock to be added per Pitfall 2) |
| INFO-08 | `REASONS` contains literal `"not added"` | type-level | `npm run typecheck` (compile-time set-equality assert) | ✅ (file exists; new set-equality assertion to be added) |
| SC#1 | `MarketplaceInfoMessage` reachable from `NotificationMessage` via `kind` discriminator | type-level | `npm run typecheck` (compile-time extends assertion) | ✅ (file exists; new variant-shape assertions to be added) |
| SC#1 | `PluginInfoMessage.componentsResolved` discriminator exhaustive (resolved + unresolved arms) | type-level | `npm run typecheck` (assertNever default arm) | ✅ (renderer's default arm enforces) |
| SC#3 | `wrapDescription(text, 4, 66)` per edge case (empty, short, exact, long, over-length single word, whitespace normalization) | unit | `npm test -- tests/shared/notify-v2.test.ts` | ✅ (file exists; ~6 new tests to be added) |
| SC#4 | All 60+ existing cascade UAT fixtures still byte-equal | architecture | `npm test -- tests/architecture/catalog-uat.test.ts` | ✅ (existing test runs unchanged) |
| SC#4 | All existing `notify-v2.test.ts` arms still GREEN | unit | `npm test -- tests/shared/notify-v2.test.ts` | ✅ (existing tests run unchanged) |
| SC#5 | `npm run check` exits 0 after the atomic commit | integration | `npm run check` | ✅ (existing script) |

### Sampling Rate

- **Per task commit:** `npm test -- --test-name-pattern="notify\|catalog"`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`. Catalog UAT byte-equality remains GREEN as the binding gate.

### Wave 0 Gaps

- [ ] Confirm `REASONS` has no existing length-lock test via `git grep -nE "REASONS[\".][\"a-z]*length"` -- if hit, planner reconciles with Pitfall 2's option 1.
- [ ] Confirm no existing call site passes `kind` to `notify()` (cascade migration strategy #2 prerequisite) via `git grep -n "kind:" extensions/pi-claude-marketplace/orchestrators/`.
- [ ] No new framework install needed; node:test + node:assert are bundled with the Node runtime per NFR-4.

## Security Domain

`security_enforcement` is not explicitly configured in `.planning/config.json`. Treating as enabled per defaults.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 42 ships no auth surface; existing Device Flow (v1.6, Phase 36) unchanged. |
| V3 Session Management | no | No session state. |
| V4 Access Control | no | Phase 42 surfaces are read-only contract additions; the COMMANDS that consume them (Phases 43-44) inherit the existing per-scope access model. |
| V5 Input Validation | yes (passive) | All user input flows through Phases 43-44 orchestrators; Phase 42 contract requires the `componentsResolved` discriminator to be boolean (compile-time enforced). |
| V6 Cryptography | no | No new crypto. |

### Known Threat Patterns for shared/notify.ts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User-supplied description containing newline / control chars passes through `wrapDescription` unmodified | Tampering (display confusion) | `wrapDescription`'s `\\s+` tokenization collapses newlines into single-space separators, which mitigates basic injection. For deeper escaping (control chars, ANSI sequences), Phase 43/44 orchestrators MUST sanitize before constructing the message. NOT Phase 42's responsibility per the contract boundary. |
| Closed-set REASON drift introduces ambiguity in `{not added}` interpretation | Information disclosure | Closed-set discipline (CMC-11) prevents ad-hoc reasons. The atomic-supersession commit prevents intermediate states where the type model permits a reason the renderer doesn't handle. |
| `componentsResolved: false` shape leaks data about external-source plugins | Information disclosure | The shape carries NO sensitive data -- it's a marker, not a payload. Phase 44 orchestrator never reads the external source (NFR-5); the marker exists precisely to AVOID a network fetch. |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/shared/notify.ts` (Read in full, 1579 lines) -- the renderer body, closed-set tuples, helper patterns, dispatch shapes.
- `tests/architecture/notify-types.test.ts` (Read in full, 627 lines) -- the compile-time closed-set proof patterns, length-lock assertion style.
- `tests/architecture/catalog-uat.test.ts` (Read lines 1-200 + 1480-1626) -- the byte-equality runner, FIXTURES map shape, `loadCatalogExamples` parser regex.
- `tests/shared/notify-v2.test.ts` (Read lines 1-200 + 900-1029, sampled) -- per-status unit test patterns, mock helpers.
- `docs/messaging-style-guide.md` (Read in full, 167 lines) -- the v2.0 contract narrative, REASONS source-of-truth declaration.
- `docs/adr/v2-001-structured-notify.md` (Read lines 50-127) -- the design rationale for the discriminated-union pattern + assertNever exhaustiveness + computed severity.
- `docs/output-catalog.md` (Read lines 1-200) -- the conventions, glyph dispatch, indentation discipline, catalog state annotation pattern.
- `.planning/RETROSPECTIVE.md` (Read lines 30-110) -- the v1.3 atomic-supersession lesson, `c4d87d4` reference.
- Git history: `dbd149a` (Phase 27-03 UXG-04 -- last REASONS extension; 8-file atomic commit pattern) and `c4d87d4` (v1.3 ES-5 supersession -- 4-file atomic commit).
- `.planning/REQUIREMENTS.md` (Read in full, 76 lines) -- INFO-04 and INFO-08 definitions, traceability table.
- `.planning/ROADMAP.md` (Read lines 770-830) -- Phase 42, 43, 44 success criteria.

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` (Read in full) -- accumulated decisions, recent v1.5/v1.6/v1.7 phase patterns.
- `extensions/pi-claude-marketplace/shared/types.ts` (Read first 50 lines) -- `Scope` type definition.

### Tertiary (LOW confidence)

- None. Phase 42 is purely an extension of patterns already established and validated in the codebase; no external research required.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new packages; existing TypeScript / node:test stack carried forward.
- Architecture: HIGH -- the discriminated-union pattern is established (Phase 15); atomic-supersession is established (Phases 13, 17.1, 27, 29); the new info-message variants are mechanical extensions.
- Pitfalls: HIGH -- each pitfall has a concrete file/line citation and a verifiable warning sign.
- Open questions: 4 questions documented, all with recommendations and risk profiles.
- Assumptions: 6 documented in the Assumptions Log; A1 is the most consequential (the REASONS length-lock-not-present claim) -- planner verifies via grep in Wave 0.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (30 days for stable codebase contract work)
