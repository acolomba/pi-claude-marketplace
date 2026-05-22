# Phase 12: Messaging Foundations & Renderer Primitives - Research

**Researched:** 2026-05-22
**Domain:** Internal TypeScript refactor (constants modules, renderer primitive collapse, single-byte diagnostic rewording, drift test)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

**Constants Module Shape (CMC-08, CMC-11)**

- **D-CMC-01:** Location is a new `extensions/pi-claude-marketplace/shared/grammar/` subdirectory; sibling to `shared/markers.ts`.
- **D-CMC-02:** One file per set -- `shared/grammar/status-tokens.ts` and `shared/grammar/reasons.ts`. Each file owns one closed enum.
- **D-CMC-03:** TS shape is **`as const` array + derived literal union** (idiomatic strict TS, zero runtime cost; matches `presentation/plugin-list.ts` `PluginRenderStatus` precedent). TypeBox unions rejected -- token constants, not validated runtime payloads.
- **D-CMC-04:** YAML drift-test infrastructure is **test-local**: a new test file under `tests/architecture/` reads `docs/messaging-style-guide.md`, parses the frontmatter, asserts set-equality against `STATUS_TOKENS` and `REASONS`. **No** `shared/` frontmatter loader utility is published in Phase 12. Phase 14's richer reader is deferred.
- **D-CMC-05:** `(no marketplaces)` and `(no plugins)` are **flat members** of the single `STATUS_TOKENS` array -- no sub-union, no branded type. Constants module mirrors the frontmatter shape 1:1.

**Reload-Hint Composer Migration (CMC-14)**

- **D-CMC-06:** Replace-in-place + mechanically migrate the callsites. `reloadHint(names: readonly string[]): string` returns `/reload to pick up changes` when `names.length > 0`, `""` otherwise; verb argument dropped. `ReloadVerb` type deleted; `presentation/index.ts` barrel updated.
- **D-CMC-07:** New trailer literal lives as a **local `const` inside `presentation/reload-hint.ts`** -- not added to `shared/markers.ts`, not added to `shared/grammar/`. Matches `presentation/plugin-list.ts`'s `MAX_LINE_COLUMN` private-constant idiom.
- **D-CMC-08:** `RELOAD_HINT_PREFIX = "Run /reload to "` in `shared/markers.ts` is **retained** as a snapshot-test-only export. Source code stops importing it; `tests/architecture/markers-snapshot.test.ts` continues to assert it. Phase 13's atomic three-file edit deletes the constant + snapshot test row + PRD §6.12 row in one commit. **Phase 12 MUST NOT delete it standalone.**
- **D-CMC-09:** `tests/presentation/reload-hint.test.ts` is **rewritten** in Phase 12 to assert new behavior. Coverage of three verb variants is deleted.
- **D-CMC-10 (carve-out flag):** Roadmap criterion #4 ("user-visible output unchanged except for migrate.ts") is authorized-by-criterion-#2 to permit the reload-hint callsites changing trailer text in Phase 12. PLAN.md / CHANGELOG.md MUST record this carve-out so reviewers don't mis-read criterion #4.

**Notify Wrapper Affirmation (CMC-19)**

- **D-CMC-11:** Four wrappers in `shared/notify.ts` keep current pure-string signatures unchanged. No 5th `notifyCascadeSummary` helper. No optional structured-payload arg.
- **D-CMC-12:** `notifyError(ctx, message, cause?)` signature AND body untouched in Phase 12. Phase 13 owns the MSG-CC-1 body rewrite.
- **D-CMC-13:** Deliverable is a **two-part inventory affirmation** -- (a) docs comment in `shared/notify.ts` naming the four wrappers + linking to §10 MSG-SR-1..7; (b) affirm import path is stable.

**Migrate.ts Wording (CMC-36, CMC-37)**

- **D-CMC-14:** §14.1 proposed bytes locked **literally** at `persistence/migrate.ts:178`:
  ```text
  Legacy marketplace migration could not be persisted to <path>; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: <errMsg>.
  ```
  `<path>` and `<errMsg>` are existing template variables. No tightening.
- **D-CMC-15:** Same Phase 12 PR includes style-guide §14.1 update removing the "Phase 13 PROPOSES" / "Phase 13's planner has FINAL discretion" framing; replaced with text affirming the wording landed in Phase 12 per D-CMC-14.
- **D-CMC-16:** The IL-3 inline `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` comment is preserved **verbatim** above the rewritten console.warn call. No config-file rule widening.

### Claude's Discretion

- Plan decomposition: 4 plans, 5 plans, or fewer with grouped deliverables. Natural pairings noted in CONTEXT.md.
- YAML parser choice for the drift test: `yaml`, `js-yaml`, or hand-rolled regex extraction.
- Reload-hint test rewrite shape: empty-array, single-name, multi-name (D-CMC-09 minimum).

### Deferred Ideas (OUT OF SCOPE)

- REQUIREMENTS.md CMC-08 vs frontmatter `reinstalled` reconciliation -- planner / researcher MUST address (research recommendation in §3 below).
- Reload-hint test-coverage breadth beyond D-CMC-09 minimum.
- Shared frontmatter loader (Phase 14).
- Cause-chain rewrite to MSG-CC-1 form (Phase 13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMC-08 | Status tokens constrained to closed enum in style-guide §3 frontmatter (14 tokens; reconcile `reinstalled` clause -- see §3.1 below) | §2.1 module shape + §3.1 reconciliation |
| CMC-11 | Reasons render only from closed enum in style-guide §4 frontmatter (24 reasons; v1.3 additions verified present) | §2.1 module shape + §2.5 frontmatter verification |
| CMC-14 | Reload-hint trailer collapses to `/reload to pick up changes`; three-verb selector retired | §2.2 composer replacement + §2.3 callsite migration |
| CMC-19 | Severity routing structural via four sanctioned wrappers; no `[error]`/`[warning]` prefix embedded | §2.4 wrappers affirmed unchanged (docs-comment touch only) |
| CMC-36 | Sanctioned warn at `persistence/migrate.ts` adopts §14.1 sentence-form wording | §2.6 byte-exact rewrite + §2.7 style-guide §14.1 doc edit |
| CMC-37 | IL-3 inline eslint-disable comment preserved verbatim above the call; no config widening | §2.6 comment preservation; §5 verification via existing `no-restricted-syntax` rule |
</phase_requirements>

## Summary

Phase 12 is a low-architectural-risk, high-precision refactor. The five deliverable areas (constants modules, reload-hint composer collapse + callsite migration, notify wrapper affirmation, migrate.ts byte rewrite + paired style-guide doc edit, drift test) are all internal to the extension and touch a tightly-bounded set of files. There is no new dependency, no Pi API surface change, no schema change, and no persistence-layer change. The risk surface is concentrated in three places:

1. **The `RELOAD_HINT_PREFIX` retention discipline (D-CMC-08).** The markers-snapshot test (`tests/architecture/markers-snapshot.test.ts:38-71`) asserts byte-equality of all 5 ES-5 constants against the PRD §6.12 row. Deleting `RELOAD_HINT_PREFIX` standalone in Phase 12 would fail that test and regress `npm run check`. The constant must be retained-but-unused-by-source-code; only the snapshot test imports it. Phase 13's atomic three-file edit (markers.ts + snapshot test + PRD) deletes the row.

2. **The callsite enumeration drift.** CONTEXT.md lists 6 reloadHint callsites; the actual codebase has **8** (the two missing are in `orchestrators/plugin/reinstall.ts` at lines 372 and 871). The planner must include the two reinstall.ts callsites in the migration -- if they're missed, the typecheck fails after the signature change.

3. **The REQUIREMENTS.md CMC-08 vs frontmatter `reinstalled` inconsistency.** Code evidence (see §3.1) confirms `reinstalled` is an internal `ReinstallPluginPartition` discriminant, NOT a user-visible status token. Recommendation: drop the "+ `reinstalled`" clause from REQUIREMENTS.md CMC-08.

**Primary recommendation:** Decompose Phase 12 into **4 plans** (constants modules + drift test as one paired unit; reload-hint composer collapse + 8 callsite migration + test rewrite as one unit; migrate.ts byte rewrite + style-guide §14.1 doc edit as one atomic unit; notify wrapper affirmation as one light docs-only unit). Use hand-rolled regex for frontmatter parsing in the drift test (precedent: `tests/helpers/prd-extract.ts` already does exactly this for PRD §6.12 ES-5; adding a YAML dep for one test is over-extraction).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Closed status-token constants | `shared/grammar/` (new) | -- | Pure data; consumed by `presentation/` Phase 13 and `tests/architecture/` Phase 12 (drift test). Sits below both per D-11. |
| Closed reasons constants | `shared/grammar/` (new) | -- | Same as above. |
| Reload-hint composer | `presentation/` | -- | Already lives in `presentation/reload-hint.ts`; pure string function. Collapsed in place. |
| Reload-hint trailer literal | `presentation/reload-hint.ts` (private const) | -- | D-CMC-07: local to the one consumer; not promoted to `shared/markers.ts` (which is in transition) or `shared/grammar/` (over-extraction for a one-consumer constant). |
| Notify wrappers | `shared/notify.ts` | -- | Unchanged; D-CMC-13 affirms API shape stable. Docs comment is the only touch. |
| Migrate.ts diagnostic | `persistence/migrate.ts` | -- | Byte rewrite at line 178; IL-3 comment at line 177 preserved verbatim. |
| Style-guide §14.1 doc edit | `docs/messaging-style-guide.md` | -- | Same PR as the byte rewrite (D-CMC-15). |
| Frontmatter drift test | `tests/architecture/` | -- | Mirrors `markers-snapshot.test.ts` pattern (test-local file-read + regex extraction + set-equality assertion). |
| Reload-hint test rewrite | `tests/presentation/` | -- | Same file path; drops 3-verb assertions; adds empty/single/multi behavioral cases. |

## Standard Stack

No new packages required. The full Phase 12 stack is built from existing dependencies:

| Tool | Source | Used For |
|------|--------|----------|
| Node `node:fs/promises` | bundled (Node 22) | drift test reads `docs/messaging-style-guide.md` |
| Node `node:test` | bundled (Node 22) | all new + rewritten tests |
| Node `node:assert/strict` | bundled (Node 22) | assertions |
| Native TS strip | Node 22.18+ | `.ts` test files run directly via `node --test` (no `tsx` needed) [VERIFIED: node 22.22.2 installed; package.json `test` script invokes `node --test` directly without `--import tsx`] |
| TypeScript 6.x | already in devDependencies | `as const` + derived literal-union pattern [VERIFIED: package.json line 28 -- `"typescript": "^6.0.3"`] |
| ESLint 10.x + flat config | already configured | `no-restricted-syntax` + `no-console` enforcement (Phase 12 adds no new exceptions) |

## Package Legitimacy Audit

Phase 12 installs **zero new packages**. No legitimacy audit required.

If the planner overrides the discretion recommendation and adopts the `yaml` package for frontmatter parsing, then:

| Package | Registry | Notes |
|---------|----------|-------|
| `yaml` (eemeli) | npm | Mature, ESM, large weekly downloads. Would require a `npm install --save-dev yaml` step + a `checkpoint:human-verify` task before install. [ASSUMED -- not verified in this session; planner must run `npm view yaml` + slopcheck if adopted.] |

Recommendation: do not adopt. See §3.2 for full rationale.

## Implementation Approach

### 2.1 Constants Modules (CMC-08, CMC-11) -- D-CMC-01..D-CMC-05

**Files to create:**

```
extensions/pi-claude-marketplace/shared/grammar/
├── status-tokens.ts        # 14 closed-set tokens
└── reasons.ts              # 23 closed-set reasons (see frontmatter count finding below)
```

**Diff sketch -- `shared/grammar/status-tokens.ts`:**

```typescript
// shared/grammar/status-tokens.ts
//
// CMC-08 closed status-token set, byte-identical to the
// docs/messaging-style-guide.md frontmatter status_tokens list.
// Drift-guarded by tests/architecture/grammar-frontmatter.test.ts
// (D-CMC-04).
//
// D-CMC-03: as-const array + derived literal union -- the array
// iterates for the drift test; the literal union types Phase 13
// callsites.
//
// D-CMC-05: "no marketplaces" and "no plugins" are flat members;
// the bare-token render shape is a Phase 13 renderer concern.

export const STATUS_TOKENS = [
  "installed",
  "updated",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];
```

**Diff sketch -- `shared/grammar/reasons.ts`:**

```typescript
// shared/grammar/reasons.ts
//
// CMC-11 closed reasons enum, byte-identical to the
// docs/messaging-style-guide.md frontmatter reasons list.
// Drift-guarded by tests/architecture/grammar-frontmatter.test.ts
// (D-CMC-04).
//
// Constants are stored bare (no surrounding braces). The
// renderer composes the {<reason>} form at emission time
// (Phase 13).

export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "hooks",
  "lspServers",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
] as const;

export type Reason = (typeof REASONS)[number];
```

**Frontmatter verification (from style-guide head):**

- `status_tokens:` block has exactly 14 entries (verified at `docs/messaging-style-guide.md:3-17`).
- `reasons:` block has exactly 23 entries (verified at `docs/messaging-style-guide.md:18-41`).

**Important finding -- REASONS COUNT DISCREPANCY:** REQUIREMENTS.md CMC-11 says "24 reasons"; ROADMAP Phase 12 scope says "24 reasons"; the frontmatter actually contains **23 entries**. The v1.3 additions list in REQUIREMENTS.md CMC-11 enumerates 12 names; the original V1 set is implicitly the other 12. Either (a) one entry was lost in a frontmatter edit, or (b) the "24" count is a typo and the actual closed enum is 23. The drift test will fail if `constants.length !== frontmatter.length`; the planner MUST reconcile in Plan 12-01 before writing constants.

**Recommendation:** Treat the frontmatter as the binding contract (it IS the file Phase 14's drift guard reads). Use 23 in the constants module. Update REQUIREMENTS.md CMC-11 ("24" → "23") and ROADMAP Phase 12 scope ("24 reasons" → "23 reasons") in the same PR -- this is a doc-vs-frontmatter inconsistency, not a missing reason. If a user-facing review during planning surfaces a missing reason, add it to the frontmatter FIRST then to the constants (Phase 14 drift discipline).

**Note (CMC-08 token "reinstalled" reconciliation):** See §3.1.

### 2.2 Reload-Hint Composer Collapse (CMC-14, part 1) -- D-CMC-06, D-CMC-07

**File to rewrite:** `extensions/pi-claude-marketplace/presentation/reload-hint.ts`

**Diff sketch (full file replacement):**

```typescript
// presentation/reload-hint.ts
//
// MSG-RH-1 reload-hint composition (style guide section 5).
// Pure string function -- no IO, no ctx parameter. The
// orchestrator layer decides WHEN to call this (RH-1 gate:
// only when generated resources changed); this file is the
// WHAT (the format string).
//
// D-CMC-06 / D-CMC-07: the trailer literal is local to this
// file (one consumer in the codebase, ever). Not promoted to
// shared/markers.ts (which is in transition until Phase 13's
// atomic ES-5 edit) or shared/grammar/ (over-extraction for a
// one-consumer constant -- matches the MAX_LINE_COLUMN
// private-constant idiom in presentation/plugin-list.ts).
//
// The legacy three-verb selector ("load" / "refresh" / "drop")
// is retired; every emission case renders the same trailer.
// ReloadVerb type is no longer exported.

const RELOAD_HINT_TRAILER = "/reload to pick up changes";

/**
 * MSG-RH-1: render the reload hint or "" when no hint is needed.
 *
 *   - 0 names:    ""                            (RH-1 suppression)
 *   - N names:    "/reload to pick up changes"  (names ignored
 *                                                 beyond the
 *                                                 non-empty check)
 *
 * Caller responsibility: pass non-empty names ONLY when generated
 * resources actually changed (RH-1 gate). This function trusts
 * its input and renders mechanically.
 */
export function reloadHint(names: readonly string[]): string {
  return names.length > 0 ? RELOAD_HINT_TRAILER : "";
}

/**
 * Append `hint` to `body` on its own trailing line. When
 * `hint === ""` (RH-1 suppression), returns the bare body. Used
 * by every orchestrator that may emit a reload hint -- keeps the
 * join logic centralized.
 *
 * TODO Phase 13: style guide section 5 MSG-RH-1 requires the
 * trailer to be "preceded by one blank line"; today's join is
 * single-newline. Phase 13's mechanical conformance refactor
 * picks up the separator change.
 */
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

**File to update:** `extensions/pi-claude-marketplace/presentation/index.ts`

**Diff sketch:**

```typescript
// Before:
export { appendReloadHint, reloadHint } from "./reload-hint.ts";
export type { ReloadVerb } from "./reload-hint.ts";

// After:
export { appendReloadHint, reloadHint } from "./reload-hint.ts";
// (ReloadVerb export removed per D-CMC-06)
```

**Note on blank-line trailer convention:** Style guide §5 MSG-RH-1 says the trailer is "preceded by one blank line." The current `appendReloadHint` joins with a single newline. The worked example in §5 renders as:

```text
● commit-commands@claude-plugins-official [user] (installed)

/reload to pick up changes
```

which is two newline characters between the compact line and the trailer. **This is currently NOT what `appendReloadHint` does** -- it adds a single newline. The existing test (`tests/presentation/reload-hint.test.ts:42-46`) asserts the single-newline form.

**Decision needed by planner:** Does Phase 12 also adopt the blank-line-above convention (changing the wire output from single-newline to double-newline), or is that a Phase 13 conformance concern? The roadmap criterion #2 ("verb selector gone") does not explicitly address the blank-line separator. The conservative reading: keep `appendReloadHint`'s join unchanged in Phase 12 (single newline); leave the blank-line-above migration to Phase 13's mechanical refactor. This avoids changing two surfaces in one phase and preserves the test's join assertion.

**Recommendation:** Phase 12 keeps the single-newline join. Add a TODO comment in `appendReloadHint` referencing MSG-RH-1's blank-line-above requirement so Phase 13 picks it up.

### 2.3 Reload-Hint Callsite Migration (CMC-14, part 2) -- D-CMC-06

**Callsites (8 total, NOT 6 as CONTEXT.md states):**

| File | Line | Current | After |
|------|------|---------|-------|
| `orchestrators/plugin/install.ts` | 690 | `reloadHint("load", stagedAny ? [plugin] : [])` | `reloadHint(stagedAny ? [plugin] : [])` |
| `orchestrators/plugin/uninstall.ts` | 237 | `reloadHint("drop", droppedAny ? [plugin] : [])` | `reloadHint(droppedAny ? [plugin] : [])` |
| `orchestrators/plugin/update.ts` | 731 | `reloadHint("refresh", updatedNames)` | `reloadHint(updatedNames)` |
| `orchestrators/plugin/reinstall.ts` | **372** | `reloadHint("refresh", changedNames)` | `reloadHint(changedNames)` |
| `orchestrators/plugin/reinstall.ts` | **871** | `reloadHint("refresh", outcome.resourcesChanged ? [outcome.name] : [])` | `reloadHint(outcome.resourcesChanged ? [outcome.name] : [])` |
| `orchestrators/marketplace/update.ts` | 358 | `reloadHint("refresh", updatedNames)` | `reloadHint(updatedNames)` |
| `orchestrators/marketplace/remove.ts` | 278 | `reloadHint("drop", removedSorted)` | `reloadHint(removedSorted)` |
| `orchestrators/import/execute.ts` | 339-341 | `reloadHint("load", result.installedPlugins.filter(...).map(...))` | `reloadHint(result.installedPlugins.filter(...).map(...))` |

**Critical:** CONTEXT.md enumerates 6 callsites; the actual codebase has 8 (two missing in `reinstall.ts`). The signature change `reloadHint(verb, names)` → `reloadHint(names)` is a type-level breaking change; if any callsite is missed, `npm run typecheck` fails immediately. Planner MUST include all 8 in the migration plan.

**Verification command:** `grep -rn 'reloadHint(' extensions/pi-claude-marketplace/` after the change should show exactly 8 callsites -- none with a string-literal verb as the first argument. (All 8 should pass a `readonly string[]` directly.)

### 2.4 Notify Wrapper Affirmation (CMC-19) -- D-CMC-11..D-CMC-13

**File to touch:** `extensions/pi-claude-marketplace/shared/notify.ts`

**Approach:** Documentation-only edit. The four wrappers (lines 22, 27, 44, 62) keep their pure-string signatures. Add a docs block at the top of the file (or expand the existing block at lines 5-19) naming the four wrappers and linking to MSG-SR-1..7 (style guide §10) as the governance contract.

**Diff sketch (additive comment, no code change):**

```typescript
/**
 * shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site (D-07).
 *
 * Severity is part of the function name. The Pi API's notify(msg, type?)
 * accepts a magic-string second arg; a typo like "warining" silently
 * degrades to "info" because there is no exhaustiveness check.
 * Severity-named wrappers eliminate that class of bug.
 *
 * The eslint per-file override in eslint.config.js (D-06 / BLOCK B) disables
 * no-restricted-syntax for this file, so inline eslint-disable-next-line
 * comments are unnecessary here (they would trigger
 * reportUnusedDisableDirectives warnings). The per-file override is the
 * single audit surface; this comment documents the sanctioned-use intent in
 * its place.
 *
 * SANCTIONED WRAPPERS (CMC-19, Phase 12 affirmation, governed by style
 * guide section 10 MSG-SR-1..7):
 *
 *   - notifySuccess(ctx, message)              -- default severity (MSG-SR-1)
 *   - notifyWarning(ctx, message)              -- "warning" severity (MSG-SR-2)
 *   - notifyError(ctx, message, cause?)        -- "error" severity (MSG-SR-3)
 *   - notifyUsageError(ctx, message, usageBlock) -- "error" severity (MSG-SR-4)
 *
 * Phase 13 composers return strings that flow VERBATIM into these wrappers;
 * no fifth wrapper, no structured-payload arg, no cascade-summary helper is
 * added (D-CMC-11). Severity remains structural via the wrapper name --
 * never embedded as a "[error]" / "[warning]" prefix in message text
 * (PRD section 6.12 ES-2, reaffirmed by MSG-SR-7).
 */
```

**No code change** to the wrappers themselves -- their bodies and signatures are stable per D-CMC-11..D-CMC-13.

**Barrel consideration (D-CMC-13 part 2):** `presentation/index.ts` does NOT currently re-export the notify wrappers (grep confirms callers import directly from `../../shared/notify.ts`). The decision: no new barrel is required; affirm the existing import path is stable.

### 2.5 Frontmatter Drift Test (D-CMC-04)

**File to create:** `tests/architecture/grammar-frontmatter.test.ts`

**Approach (hand-rolled regex extraction, mirrors `tests/helpers/prd-extract.ts`):**

```typescript
// tests/architecture/grammar-frontmatter.test.ts
//
// D-CMC-04 drift guard. Asserts that
// extensions/pi-claude-marketplace/shared/grammar/{status-tokens,reasons}.ts
// is set-equal to the corresponding frontmatter block in
// docs/messaging-style-guide.md. Phase 14 will fold this assertion into a
// richer drift-guard reader (markers, pattern_classes, etc.); Phase 12
// ships the minimum.
//
// Hand-rolled regex parser: no new dependency. The frontmatter shape is
// fixed (--- delimited block at file head; one bullet per line under each
// top-level key). Mirrors the pattern in tests/helpers/prd-extract.ts.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REASONS } from "../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts";
import { STATUS_TOKENS } from "../../extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");

/**
 * Extract a frontmatter list block by key. Returns the bullet values in
 * order. Throws if the key is not found, the file has no frontmatter, or
 * the block is empty.
 */
function extractFrontmatterList(md: string, key: string): string[] {
  const fmMatch = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (fmMatch === null) {
    throw new Error("messaging-style-guide.md: no YAML frontmatter found at file head");
  }
  const fm = fmMatch[1]!;
  // Match `^<key>:\n` followed by indented `  - <value>` lines until the
  // next top-level key or end of frontmatter.
  const blockRe = new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, "m");
  const blockMatch = blockRe.exec(fm);
  if (blockMatch === null) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" not found`);
  }
  const items = blockMatch[1]!
    .split("\n")
    .map((line) => line.replace(/^  - /, ""))
    .filter((s) => s.length > 0);
  if (items.length === 0) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" has no items`);
  }
  return items;
}

test("D-CMC-04: STATUS_TOKENS is set-equal to style-guide frontmatter status_tokens", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const frontmatterTokens = extractFrontmatterList(md, "status_tokens");
  assert.deepEqual(
    [...STATUS_TOKENS].sort(),
    [...frontmatterTokens].sort(),
    `STATUS_TOKENS drift vs frontmatter -- code has ${STATUS_TOKENS.length}, frontmatter has ${frontmatterTokens.length}`,
  );
});

test("D-CMC-04: REASONS is set-equal to style-guide frontmatter reasons", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const frontmatterReasons = extractFrontmatterList(md, "reasons");
  assert.deepEqual(
    [...REASONS].sort(),
    [...frontmatterReasons].sort(),
    `REASONS drift vs frontmatter -- code has ${REASONS.length}, frontmatter has ${frontmatterReasons.length}`,
  );
});

test("extractFrontmatterList throws if frontmatter is missing", () => {
  assert.throws(
    () => extractFrontmatterList("# No frontmatter here\n", "status_tokens"),
    /no YAML frontmatter found/,
  );
});

test("extractFrontmatterList throws if key is missing", () => {
  assert.throws(
    () =>
      extractFrontmatterList("---\nversion: 1.0\nother:\n  - a\n---\n", "status_tokens"),
    /key "status_tokens" not found/,
  );
});
```

**Why hand-rolled, not `yaml`/`js-yaml`:** See §3.2.

### 2.6 Migrate.ts Byte Rewrite (CMC-36, CMC-37) -- D-CMC-14, D-CMC-16

**File:** `extensions/pi-claude-marketplace/persistence/migrate.ts`

**Current state (lines 173-181):**

```typescript
try {
  await atomicWriteJson(stateJsonPath, normalizedState);
} catch (err) {
  const errMsg = errorMessage(err);
  // eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
  console.warn(
    `pi-claude-marketplace: failed to persist migrated state to ${stateJsonPath} (${errMsg}); continuing with in-memory normalized state. Original state.json is unchanged.`,
  );
}
```

**Target state (lines 173-181):**

```typescript
try {
  await atomicWriteJson(stateJsonPath, normalizedState);
} catch (err) {
  const errMsg = errorMessage(err);
  // eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
  console.warn(
    `Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.`,
  );
}
```

**Byte-exact contract (D-CMC-14):**

```
Legacy marketplace migration could not be persisted to <path>; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: <errMsg>.
```

Where `<path>` is `${stateJsonPath}` and `<errMsg>` is `${errMsg}`.

**Preservation contract (D-CMC-16, CMC-37):**

- The line directly above the warn call MUST be the comment `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` -- byte-identical, no comma/whitespace changes.
- No config-file rule widening in `eslint.config.js`.

**Verification:** A test or grep audit should confirm:
1. The string `Legacy marketplace migration could not be persisted to` appears exactly once in `extensions/pi-claude-marketplace/`.
2. The string `failed to persist migrated state to` does NOT appear in `extensions/pi-claude-marketplace/` (the old wording is fully replaced).
3. The line immediately above the warn call in `persistence/migrate.ts` is the IL-3 disable comment, verbatim.

See §4 Validation Architecture for the test sketch.

### 2.7 Style Guide §14.1 Doc Edit (D-CMC-15)

**File:** `docs/messaging-style-guide.md`

**Current state (lines 484-507):**

§14 MSG-LC-1 row ends with: *"Phase 12 PROPOSES the new wording (below); Phase 13 owns the persistence/migrate.ts:178 byte change. (per CONTEXT.md D-24)"*

§14.1 heading: *"### 14.1 Proposed new wording (Phase 13 applies)"*

§14.1 closing: *"Phase 13's planner has FINAL discretion on the exact wording. The proposal above satisfies the structural constraints (sentence form, terminal period, no compact-grammar tokens, no severity prefix); Phase 13 may tighten or expand based on operator-feedback channels available at refactor time. Phase 12 ships the contract, not the bytes."*

**Target state:**

§14 MSG-LC-1 row should end with: *"Phase 12 LANDED the new wording (below); the byte change at persistence/migrate.ts:178 lives in the same Phase 12 PR (per CONTEXT.md D-CMC-14 / D-CMC-15)."*

§14.1 heading: *"### 14.1 Wording (Phase 12 landed)"*

§14.1 body: keep the "Today's wording" block (it documents the legacy form for historical clarity); update the surrounding prose to past-tense and remove the planner-discretion sentence. Suggested replacement for the closing paragraph:

*"The wording above is the binding text shipped at persistence/migrate.ts:178 in Phase 12 per D-CMC-14. It satisfies the structural constraints of MSG-LC-1 (sentence form, terminal period, no compact-grammar tokens, no severity prefix). The IL-3 inline eslint-disable-next-line comment is preserved verbatim above the call per D-CMC-16 / MSG-LC-2."*

**Rationale (D-CMC-15):** The byte change and the doc edit land in the same PR. No transient window where the doc says "Phase 13 owns the byte change" while the bytes already exist.

## Reconciliation Decisions

### 3.1 REQUIREMENTS.md CMC-08 "+ `reinstalled`" Clause -- RESOLUTION: DROP

**Evidence collected:**

| Source | Line | Content |
|--------|------|---------|
| `orchestrators/types.ts` | 12 | `export type ReinstallPluginPartition = "reinstalled" \| "skipped" \| "failed";` |
| `orchestrators/types.ts` | 21 | `readonly partition: "reinstalled";` |
| `orchestrators/plugin/reinstall.ts` | 184 | `if (locked.outcome.partition !== "reinstalled") {` |
| `orchestrators/plugin/reinstall.ts` | 403-404 | `case "reinstalled":` / `partitions.reinstalled.push(outcome);` |
| `orchestrators/plugin/reinstall.ts` | 685 | `partition: "reinstalled",` (outcome construction) |

**Analysis:** `"reinstalled"` is exclusively used as a discriminant value in the `ReinstallPluginPartition` union and as a property key on the partition-bucket object. It is NEVER rendered inside parentheses on a user-visible line. The user-visible status tokens for reinstall results are `(installed)`, `(updated)`, `(skipped)`, `(failed)` per the existing 14-token frontmatter set -- a successful reinstall row would render with `(installed)` (the plugin remains installed) or with no status token at all (the cascade-summary line uses an English summary, not a parenthesised token).

**Recommendation:** Drop the "plus the `reinstalled` token used in reinstall cascades" clause from REQUIREMENTS.md CMC-08. The closed set is exactly the 14 frontmatter tokens. This update lands in the same Phase 12 PR (REQUIREMENTS.md is a planning artifact, not a user-contract surface). If the user instead wants `reinstalled` added as a 15th token, that drives:
- A frontmatter `status_tokens:` addition.
- A new icon-predicate row in style guide §3.
- Phase 13 work to render `(reinstalled)` on reinstall result rows (currently they render as `(installed)`).

The first path (drop the clause) is consistent with the frontmatter contract and the existing rendering behavior. The second path is a behavioral change that should require an explicit user decision -- which the user declined to make in the discussion. Default to "drop the clause."

### 3.2 YAML Parser Choice -- RECOMMENDATION: Hand-rolled regex

**Evidence:**

- `package.json` has NO YAML parser in `dependencies` or `devDependencies` (verified: no `yaml`, no `js-yaml`, no `@types/js-yaml`).
- `tests/helpers/prd-extract.ts` is a 28-line file that uses pure regex to extract structured content from a markdown doc (PRD §6.12 ES-5 row). It is the direct precedent for this kind of test-local parsing.
- The frontmatter shape this drift test reads is fixed: `---\n<key>:\n  - <value>\n  ...\n---\n`. No nested objects, no multi-line strings, no anchors -- a 30-line regex extractor handles it.
- Adding `yaml@^2.x` to devDependencies for one test file is over-extraction. Phase 14 will need a richer reader (per D-CMC-04) -- when that lands, the right time to evaluate a YAML dep is then, not now.

**Recommendation:** Hand-roll. See §2.5 for the implementation sketch. Total new code: ~30 lines. Test coverage adds a "throws on missing frontmatter" and "throws on missing key" assertion to lock the parser's failure modes.

**If the planner decides to adopt `yaml` (eemeli) instead:** the planner MUST add a `checkpoint:human-verify` task before `npm install --save-dev yaml` (slopcheck + `npm view yaml` verification) per the user's project guidelines. This shifts Phase 12 from zero-new-deps to one-new-dep, which the planner should weigh against the ~30 lines of avoided test code.

### 3.3 Plan Decomposition -- RECOMMENDATION: 4 plans

**Recommended split:**

| Plan | Deliverables | Why grouped |
|------|--------------|-------------|
| **12-01** | Constants modules (`status-tokens.ts`, `reasons.ts`) + drift test (`grammar-frontmatter.test.ts`) + REQUIREMENTS.md/ROADMAP reconciliation (CMC-08 "+ reinstalled" clause drop; CMC-11/ROADMAP reasons-count "24" → "23" if §2.1 finding confirmed) | The drift test is the validator for the constants; landing them together prevents a transient window where the constants exist without their drift guard. The doc reconciliation is the planning-artifact half of the CMC-08 resolution; landing it with the constants keeps the count assertion coherent. |
| **12-02** | Reload-hint composer collapse (`presentation/reload-hint.ts` rewrite + `presentation/index.ts` barrel update) + all 8 callsite migrations + test rewrite (`tests/presentation/reload-hint.test.ts`) | Single self-contained unit. The signature change is a typecheck-breaking change that must land atomically with all 8 callsite updates and the test rewrite. Cannot be split without breaking `npm run check` mid-plan. |
| **12-03** | Migrate.ts byte rewrite (`persistence/migrate.ts:178`) + style-guide §14.1 doc edit (`docs/messaging-style-guide.md`) | D-CMC-15 requires atomic alignment of code bytes and contract doc within one PR. Plan-level atomicity reinforces this. |
| **12-04** | Notify wrapper affirmation (`shared/notify.ts` docs comment expansion) | Docs-only, low-risk, can land independently. Could fold into Plan 12-01 if planner prefers 3 plans; the only reason to keep it separate is wave-parallelism (this plan has no deps on the others and could land in Wave 1 alongside 12-01). |

**Alternative -- 5 plans:** Split the drift test off from 12-01 into its own plan (12-01a constants, 12-01b drift test). Not recommended -- introduces a transient window where the constants exist without a drift guard, which is exactly the failure mode D-CMC-04 is designed to prevent.

**Alternative -- 3 plans:** Fold 12-04 (notify affirmation) into 12-01. Reasonable; reduces plan count at the cost of mixing a docs-only touch with a code+test+reconciliation plan.

### 3.4 Reload-Hint Test Rewrite Breadth -- RECOMMENDATION: 5 tests

**Suggested test set for the rewritten `tests/presentation/reload-hint.test.ts`:**

```typescript
test("MSG-RH-1: empty names returns empty string (suppression)", () => {
  assert.equal(reloadHint([]), "");
});

test("MSG-RH-1: single name returns the canonical trailer", () => {
  assert.equal(reloadHint(["foo"]), "/reload to pick up changes");
});

test("MSG-RH-1: multi name returns the same canonical trailer (names ignored beyond non-empty check)", () => {
  assert.equal(reloadHint(["alpha", "beta", "gamma"]), "/reload to pick up changes");
});

test("appendReloadHint: empty hint returns bare body (suppression)", () => {
  assert.equal(appendReloadHint("Body content", ""), "Body content");
});

test("appendReloadHint: non-empty hint joins with single newline", () => {
  assert.equal(
    appendReloadHint("Body content", "/reload to pick up changes"),
    "Body content\n/reload to pick up changes",
  );
});
```

**Deleted assertions (no longer applicable):**

- All three verb-variant assertions (`load` / `refresh` / `drop` verb-specific outputs).
- The `RELOAD_HINT_PREFIX` byte-equality assertion at the bottom of the current file (the markers-snapshot test still covers this; no need to duplicate in the reload-hint test).

**Coverage rationale:** The 5 tests cover the three logically distinct input branches of `reloadHint` (empty, single, multi -- all that matter under the new single-trailer behavior) and the two branches of `appendReloadHint` (empty suppression, non-empty join). No additional edge cases are meaningful under the new composer -- names are no longer interpolated into the trailer, so "names with quotes", "names with whitespace", "100-element names array" are all behaviorally identical to the single-name case.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22.22.2 built-in) |
| Config file | None -- uses package.json `test` script |
| Quick run command | `node --test tests/architecture/grammar-frontmatter.test.ts tests/presentation/reload-hint.test.ts` |
| Full suite command | `npm test` (runs `node --test "tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}/**/*.test.ts"`) |
| Full structural gate | `npm run check` (typecheck + lint + format:check + test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMC-08 | STATUS_TOKENS set-equality with style-guide frontmatter `status_tokens` (D-CMC-04 drift) | unit | `node --test tests/architecture/grammar-frontmatter.test.ts` | ❌ Wave 0 (12-01) |
| CMC-11 | REASONS set-equality with style-guide frontmatter `reasons` (D-CMC-04 drift) | unit | `node --test tests/architecture/grammar-frontmatter.test.ts` | ❌ Wave 0 (12-01) |
| CMC-14 | `reloadHint([])` returns `""`; `reloadHint([...non-empty])` returns `"/reload to pick up changes"` (D-CMC-09) | unit | `node --test tests/presentation/reload-hint.test.ts` | ✅ (rewritten in 12-02) |
| CMC-14 | All 8 reloadHint callsites compile under the new signature; no callsite passes a verb string | typecheck + grep | `npm run typecheck && ! grep -rE 'reloadHint\("(load\|refresh\|drop)"' extensions/` | grep is shell-only; can be wrapped in a tiny test if desired |
| CMC-14 | `ReloadVerb` type no longer exported | typecheck | `npm run typecheck` (any import of `ReloadVerb` after deletion fails) | covered by existing typecheck |
| CMC-19 | Four wrappers `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` exported with current signatures | typecheck | `npm run typecheck` (existing call sites depend on signatures) | covered by existing typecheck |
| CMC-19 | `ctx.ui.notify` called only inside `shared/notify.ts` | lint | `npm run lint` (eslint `no-restricted-syntax` BLOCK A line 121-126) | already enforced |
| CMC-36 | `persistence/migrate.ts:178` warn body matches §14.1 byte-exact wording | unit | new test `tests/persistence/migrate-warn-wording.test.ts` (suggested name) | ❌ Wave 0 (12-03) |
| CMC-37 | IL-3 inline `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: ...` comment present directly above the warn call at `persistence/migrate.ts` | unit | same file as CMC-36 test (reads source and grep-asserts) | ❌ Wave 0 (12-03) |
| CMC-37 | No second sanctioned warn callsite exists in the extension | lint | `npm run lint` (eslint `no-restricted-syntax` rule line 107-110 plus `no-console` line 130) | already enforced |
| NFR-6 | `npm run check` is green end-to-end | composite | `npm run check` | gate per CONTEXT.md cross-cutting constraints |

### Test File Sketches

**For CMC-36 / CMC-37 (suggested file: `tests/persistence/migrate-warn-wording.test.ts`):**

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATE_PATH = path.join(REPO_ROOT, "extensions/pi-claude-marketplace/persistence/migrate.ts");

test("CMC-36: persistence/migrate.ts warn body matches style guide section 14.1 wording", async () => {
  const src = await readFile(MIGRATE_PATH, "utf8");
  // The body is a template literal -- assert the literal segments survive.
  // Two template variables (stateJsonPath and errMsg) are intentionally
  // matched as such; the bytes between them are the user contract.
  const expected =
    "`Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.`";
  assert.ok(
    src.includes(expected),
    `Expected section 14.1 wording at persistence/migrate.ts; not found.`,
  );
  assert.ok(
    !src.includes("failed to persist migrated state to"),
    "Legacy wording 'failed to persist migrated state to' must be fully replaced (CMC-36)",
  );
});

test("CMC-37: IL-3 eslint-disable-next-line comment is preserved verbatim above the warn", async () => {
  const src = await readFile(MIGRATE_PATH, "utf8");
  const expectedPattern =
    /\/\/ eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail\n\s*console\.warn\(/;
  assert.match(
    src,
    expectedPattern,
    "IL-3 inline disable comment must appear directly above the warn call with the exact rationale text (CMC-37 / D-CMC-16)",
  );
});

test("CMC-37: exactly one sanctioned warn callsite in persistence/migrate.ts", async () => {
  // Imports already enforce eslint; this is belt-and-suspenders for D-CMC-16.
  const src = await readFile(MIGRATE_PATH, "utf8");
  const matches = src.match(/console\.warn\(/g) ?? [];
  assert.equal(matches.length, 1, "persistence/migrate.ts must have exactly one sanctioned warn (IL-3)");
});
```

### Markers-Snapshot Test Non-Regression (D-CMC-08)

`tests/architecture/markers-snapshot.test.ts` MUST stay untouched in Phase 12 and MUST stay green. Verification:

1. **No-edit assertion (manual review):** PR diff should show `tests/architecture/markers-snapshot.test.ts` unchanged.
2. **Pass assertion (automated):** `npm test` includes this file in the suite; a regression would fail the structural gate.
3. **Constant retention assertion:** `shared/markers.ts` must still export `RELOAD_HINT_PREFIX` (a deletion would fail line 52 of `markers-snapshot.test.ts`: `["Run /reload to <verb> …", markers.RELOAD_HINT_PREFIX]`).

**Risk:** A well-meaning cleanup pass could delete `RELOAD_HINT_PREFIX` along with the verb table when collapsing `reload-hint.ts`. The plan MUST explicitly note "DO NOT delete `RELOAD_HINT_PREFIX` from `shared/markers.ts`" and the verification step MUST confirm both the file is unchanged and the constant still exports.

### Reload-Hint Test Rewrite Non-Drift Verification (D-CMC-09)

After rewrite, `tests/presentation/reload-hint.test.ts` MUST:

1. Pass under `node --test tests/presentation/reload-hint.test.ts`.
2. Contain no references to `ReloadVerb`, `"load"`, `"refresh"`, `"drop"` as string-literal first arguments to `reloadHint`.
3. Contain no import of `RELOAD_HINT_PREFIX` (the new composer does not depend on it).

Verification command:

```bash
# After rewrite, these should all return zero matches:
grep -E 'ReloadVerb|reloadHint\("(load|refresh|drop)"|RELOAD_HINT_PREFIX' tests/presentation/reload-hint.test.ts
```

### ESLint Discipline Non-Regression

Phase 12 adds NO new exceptions to `eslint.config.js`. Verification:

1. `eslint.config.js` PR diff should be empty.
2. `npm run lint` passes after Phase 12 changes (the IL-3 inline disable continues to satisfy `no-restricted-syntax` line 107-110 + `no-console` line 130; no other sanctioned-warn callsites introduced).

### Sampling Rate

- **Per task commit:** `node --test tests/architecture/grammar-frontmatter.test.ts tests/presentation/reload-hint.test.ts tests/persistence/migrate-warn-wording.test.ts` (~2 sec)
- **Per plan completion:** `npm run check` (full structural gate)
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/architecture/grammar-frontmatter.test.ts` -- covers CMC-08, CMC-11 (D-CMC-04)
- [ ] `tests/persistence/migrate-warn-wording.test.ts` (or planner-chosen name/location) -- covers CMC-36, CMC-37 (D-CMC-14, D-CMC-16)
- [ ] `tests/presentation/reload-hint.test.ts` rewrite -- covers CMC-14 (D-CMC-09); file exists, contents change

No framework install needed; `node:test` is bundled and `npm test` already orchestrates `tests/architecture/`, `tests/presentation/`, and `tests/persistence/` subtrees.

## Project Constraints (from CLAUDE.md)

- **Never commit to `main`** -- Phase 12 work happens on a feature/worktree branch.
- **Branch naming:** `gsd/phase-12-<slug>` per `.planning/config.json` `phase_branch_template`.
- **Worktree placement:** Under `.worktrees/` when used.
- **Commit messages:** Conventional Commits; title 5-72 chars; body ≤80 chars/line.
- **Pre-commit:** Run `pre-commit run --files <changed>` BEFORE `git commit`. Failures mean the commit did NOT happen -- never `--amend` to fix; restage and commit again.
- **Never** `--no-verify`.
- **Worktree commits:** prefix `SKIP=trufflehog` (run `pre-commit run trufflehog --all-files` separately to confirm clean). This is the ONLY allowed SKIP.
- **CI gate:** `npm run check` (typecheck + ESLint + Prettier + tests) -- NFR-6 absolutely binding.
- **Output channel discipline (IL-2):** All user-visible messages via `ctx.ui.notify` through `shared/notify.ts` wrappers. Phase 12 changes no callsites; affirms the discipline.
- **Single sanctioned warn (IL-3):** Reword in place; do not add a second site.

## Risks & Landmines

### R1 -- Snapshot test regression on `RELOAD_HINT_PREFIX` deletion (P=high, Impact=fail `npm run check`)

**Scenario:** During the Phase 12 cleanup, an engineer notices `RELOAD_HINT_PREFIX` is no longer imported by `presentation/reload-hint.ts` and deletes it from `shared/markers.ts` as "dead code." The markers-snapshot test (`tests/architecture/markers-snapshot.test.ts:52`) hard-asserts the constant exists and equals `"Run /reload to "` -- deletion fails the test, breaking the structural gate.

**Mitigation:**
- Plan 12-02 explicitly notes "`RELOAD_HINT_PREFIX` is retained per D-CMC-08; do NOT delete from `shared/markers.ts`."
- Add a comment in `shared/markers.ts` directly on the `RELOAD_HINT_PREFIX` export line: `// Phase 13 deletes this in the atomic ES-5 three-file edit (D-CMC-08). Do NOT delete in Phase 12 -- markers-snapshot test fails.`
- The verification checklist for 12-02 includes "grep for `RELOAD_HINT_PREFIX` in `shared/markers.ts` returns 1 match."

### R2 -- Missed reloadHint callsites (P=medium, Impact=fail `npm run typecheck`)

**Scenario:** CONTEXT.md lists 6 reloadHint callsites; the code has 8 (the two in `reinstall.ts` at lines 372 and 871 are unlisted). If the planner copies CONTEXT.md's enumeration verbatim and the executor misses the two reinstall.ts callsites, the signature-change to `reloadHint(names: readonly string[]): string` causes the existing 3-arg-style calls to fail typecheck.

**Mitigation:**
- Plan 12-02 enumerates all 8 callsites (per §2.3 of this research).
- Verification step: `grep -rn 'reloadHint(' extensions/pi-claude-marketplace/` should match exactly 8 source-code lines after the migration, none with a string-literal verb as first argument.

### R3 -- D-CMC-10 carve-out misread as a roadmap violation (P=low, Impact=PR rejected in review)

**Scenario:** A reviewer reads roadmap Phase 12 success criterion #4 ("user-visible output unchanged except for the single migrate.ts diagnostic") and rejects Plan 12-02 because the 8 reload-hint callsites now emit `/reload to pick up changes` instead of `Run /reload to <verb> "..."` -- a user-visible output change beyond migrate.ts.

**Mitigation:**
- Plan 12-02 PLAN.md AND CHANGELOG.md entry MUST explicitly cite D-CMC-10 carve-out and the authorizing criterion #2 ("the three-verb selector is gone from `presentation/reload-hint.ts`") -- structurally requires the trailer to change wherever the composer is called.
- Phase 12 SUMMARY mentions this carve-out in the handoff items so Phase 13's planner does not double-count the change.

### R4 -- Frontmatter reasons count "24" vs actual "23" (P=medium, Impact=fail drift test)

**Scenario:** The constants module is written with 24 entries (per REQUIREMENTS.md / ROADMAP), but the frontmatter only has 23 -- the drift test fails on set-equality.

**Mitigation:**
- Plan 12-01 includes a verification step: re-count the frontmatter `reasons:` block before writing `reasons.ts`. The constants module's REASONS array length MUST equal the frontmatter block length.
- The reconciliation step (REQUIREMENTS.md / ROADMAP "24" → "23") lands in the same PR.
- If a missing reason is identified during planning, ADD it to the frontmatter FIRST (Phase 14 discipline: frontmatter is the binding contract); then constants follow.

### R5 -- Style guide §14.1 doc edit slipped (P=medium, Impact=incoherent doc state)

**Scenario:** The migrate.ts byte change lands but the style-guide §14.1 update is forgotten or split into a later PR -- leaving the doc saying "Phase 12 PROPOSES the wording (Phase 13 owns the byte change)" while the bytes are already in place.

**Mitigation:**
- Plan 12-03 makes the migrate.ts edit and the style-guide edit a SINGLE plan with both files in the change-set.
- The plan's verification checklist explicitly lists "docs/messaging-style-guide.md §14.1 updated per D-CMC-15."
- PR description (D-CMC-15) calls out the atomic-PR requirement.

### R6 -- IL-3 comment drift (P=low, Impact=fail eslint or fail CMC-37)

**Scenario:** A reformatting pass or merge conflict alters the IL-3 disable comment text (e.g., re-orders the rule list to `no-console, no-restricted-syntax`, or drops a comma, or rewords the rationale). The comment line is the SOLE audit surface for the IL-3 exception per D-CMC-16 / CMC-37.

**Mitigation:**
- Plan 12-03 verification asserts the comment line matches an exact regex (see §4 test sketch).
- The Phase 12 test suite includes the CMC-37 regex assertion permanently.
- Phase 14's drift guard (per CONTEXT.md D-CMC-16) is the longer-term enforcement; Phase 12's regex test is the interim.

### R7 -- `appendReloadHint` blank-line-above conformance (P=low, Impact=user-contract drift)

**Scenario:** Style guide §5 says the reload trailer is "preceded by one blank line" but `appendReloadHint` joins with a single newline. Phase 12 could be misread as needing to fix this; doing so breaks the existing `appendReloadHint` join assertion and changes wire output on all 8 callsites.

**Mitigation:**
- Phase 12 keeps the single-newline join. Add a TODO comment in `appendReloadHint` referencing MSG-RH-1's blank-line requirement so Phase 13 picks it up as part of the broader conformance work.
- Plan 12-02 documents this scoping decision explicitly so a reviewer or Phase 13 planner can see it was intentional.

## References

### Files Inspected

| File | Lines | Used For |
|------|-------|----------|
| `.planning/phases/12-messaging-foundations-renderer-primitives/12-CONTEXT.md` | full | Decisions (D-CMC-01..D-CMC-16), discretion items, canonical refs |
| `.planning/REQUIREMENTS.md` | 360-395, 421-422 | CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37 text |
| `.planning/ROADMAP.md` | 125-156 | Phase 12 scope, success criteria #1-#5, in/out-of-scope |
| `.planning/STATE.md` | 1-80 | Project state, milestone v1.3, current position |
| `.planning/config.json` | full | Verified `nyquist_validation: true`, `commit_docs: true`, granularity: standard |
| `docs/messaging-style-guide.md` | 1-60 (frontmatter), 160-200 (§3 status_tokens), 191-220 (§4 reasons), 223-242 (§5 reload hint), 484-512 (§14 + §14.1 IL-3) | Closed sets, MSG-RH-1, MSG-LC-1 / MSG-LC-2, §14.1 wording |
| `extensions/pi-claude-marketplace/presentation/reload-hint.ts` | 1-50 | Current composer; ReloadVerb type; appendReloadHint join shape |
| `extensions/pi-claude-marketplace/presentation/index.ts` | 1-17 | Barrel re-export pattern; `ReloadVerb` export to delete |
| `extensions/pi-claude-marketplace/presentation/plugin-list.ts` | 1-80 | `PluginRenderStatus` literal-union precedent; `MAX_LINE_COLUMN` private-constant idiom |
| `extensions/pi-claude-marketplace/shared/markers.ts` | full | `RELOAD_HINT_PREFIX` retention discipline; PUP-6 / D-08 extensions confirm markers.ts is a stable export surface |
| `extensions/pi-claude-marketplace/shared/notify.ts` | full | Four wrappers, signatures, comment idiom |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | 130-182 | Current warn body (line 178); IL-3 comment (line 177); template variables `${stateJsonPath}` and `${errMsg}` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 690 | reloadHint callsite #1 (verb: "load") |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 237 | reloadHint callsite #2 (verb: "drop") |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 731 | reloadHint callsite #3 (verb: "refresh") |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 372, 871 | reloadHint callsites #4 and #5 (BOTH verb: "refresh"); CONTEXT.md missed these |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | 358 | reloadHint callsite #6 (verb: "refresh") |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | 278 | reloadHint callsite #7 (verb: "drop") |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | 339-341 | reloadHint callsite #8 (verb: "load") |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 184, 403-404, 685 | "reinstalled" is `ReinstallPluginPartition` discriminant, NOT a status token -- CMC-08 reconciliation evidence |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | 12, 21 | `ReinstallPluginPartition` type definition |
| `tests/architecture/markers-snapshot.test.ts` | 1-71 | Snapshot test depends on `RELOAD_HINT_PREFIX` export (line 52) -- Phase 12 retention discipline |
| `tests/architecture/import-boundaries.test.ts` | 1-80 | Architectural test pattern (reads eslint config, asserts D-11 layering) |
| `tests/presentation/reload-hint.test.ts` | full | Current test file structure; assertions to delete and replace |
| `tests/helpers/prd-extract.ts` | full | Hand-rolled regex extraction precedent for frontmatter parsing |
| `package.json` | full | Verified: no `yaml` / `js-yaml` deps; TypeScript 6.x; Node engine ≥20.19; `npm run check` chain |
| `eslint.config.js` | 75-140 | BLOCK A `no-restricted-syntax` rules (lines 87-127); IL-3 comment requirement; `no-console: error` (line 130) |

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Constants module shape | HIGH | Precedent verified in code (`PluginRenderStatus`); D-CMC-03 locks the shape; idiomatic strict TS |
| Reload-hint callsite enumeration | HIGH | All 8 callsites enumerated via grep; CONTEXT.md's 6-count missed 2 in reinstall.ts |
| CMC-08 reinstalled reconciliation | HIGH | Code-evidence-based; `reinstalled` is exclusively a `ReinstallPluginPartition` discriminant |
| REASONS count (24 vs 23) | HIGH | Direct frontmatter count confirms 23 entries; doc-vs-frontmatter inconsistency, not a missing reason |
| Frontmatter parser choice | HIGH | Existing precedent (`prd-extract.ts`); no new dep needed |
| Migrate.ts byte rewrite shape | HIGH | D-CMC-14 locks the literal; template variables identified in source |
| Markers snapshot test retention discipline | HIGH | Direct file read confirms `RELOAD_HINT_PREFIX` is asserted at line 52 |
| Notify wrapper affirmation approach | HIGH | D-CMC-13 specifies docs-only touch; no signature change |
| Style guide §14.1 doc edit | HIGH | D-CMC-15 specifies the atomic-PR requirement; current language identified |
| Plan decomposition (4 plans) | MEDIUM | Recommendation; planner has discretion |
| Reload-hint test rewrite breadth (5 tests) | MEDIUM | Recommendation; D-CMC-09 specifies minimum; planner has discretion |
| Blank-line-above conformance scoping | MEDIUM | Inferred from criterion #2 + criterion #4 carve-out; planner should confirm |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The frontmatter `reasons:` block currently has 23 entries (not 24 as REQUIREMENTS / ROADMAP claim) | §2.1 | Drift test fails on set-equality; planner must reconcile during Plan 12-01 |
| A2 | `reinstalled` is exclusively an internal `ReinstallPluginPartition` discriminant and NEVER renders as a user-visible `(reinstalled)` token | §3.1 | If user intends to add `(reinstalled)` as a 15th status token, Phase 13 work expands; recommended resolution (drop the clause) becomes wrong |
| A3 | Phase 12 keeps `appendReloadHint`'s single-newline join (defers blank-line-above conformance to Phase 13) | §2.2, §R7 | If reviewer interprets MSG-RH-1 as Phase 12 scope, expected wire format diverges from Phase 12's emission |
| A4 | The hand-rolled regex frontmatter parser handles all current frontmatter shapes (`status_tokens:` and `reasons:` are flat bullet lists) | §2.5 | If frontmatter gains a nested object or multi-line value in a later edit, the regex breaks; Phase 14's richer reader replaces it then |
| A5 | No new `console.*` callsite is introduced in Phase 12; the eslint rule continues to enforce this without config widening | §5, §R6 | If a debugging line slips in, lint fails -- caught by `npm run check` |

## Open Questions

1. **REASONS count: 23 or 24?**
   - What we know: frontmatter has 23 bullet items; REQUIREMENTS.md CMC-11 and ROADMAP Phase 12 scope both say "24."
   - What's unclear: whether a 24th reason was lost in a frontmatter edit, or whether "24" is a typo carried through the docs.
   - Recommendation: treat frontmatter as binding; update docs to 23; reconcile in Plan 12-01. If user surfaces a missing reason during planning review, add it to the frontmatter FIRST.

2. **Blank-line-above for the reload trailer: Phase 12 or Phase 13?**
   - What we know: style guide §5 MSG-RH-1 requires the trailer "preceded by one blank line." Current `appendReloadHint` joins with single newline.
   - What's unclear: roadmap criterion #2 ("verb selector gone") doesn't explicitly cover the separator.
   - Recommendation: Phase 12 keeps single-newline join; add TODO comment for Phase 13. Confirms with the conservative reading of criteria #2 and #4.

3. **REQUIREMENTS.md / ROADMAP edit policy: same PR as code, or planning-doc-only PR?**
   - What we know: CONTEXT.md `<deferred>` flags the CMC-08 reconciliation but doesn't dictate where the doc edit lands.
   - What's unclear: whether planning doc edits live in the code PR (D-CMC-15 precedent) or a separate doc PR.
   - Recommendation: same PR as the constants module (Plan 12-01). The doc edits ARE the reconciliation; splitting them creates the same transient incoherence D-CMC-15 explicitly avoids.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All test execution, native TS strip | ✓ | 22.22.2 | -- |
| npm | `npm run check` / `npm test` | ✓ | 10.9.7 | -- |
| TypeScript 6.x | `npm run typecheck` | ✓ (via devDep) | 6.0.3 | -- |
| ESLint 10.x | `npm run lint` | ✓ (via devDep) | 10.2.1 | -- |
| Prettier 3.x | `npm run format:check` | ✓ (via devDep) | 3.8.3 | -- |
| `node:test` | All new + rewritten tests | ✓ (built-in) | bundled | -- |
| Git pre-commit hooks | `pre-commit run` | assumed ✓ (project standard) | -- | manual file-by-file pre-commit run if framework not installed locally |

No external services, no databases, no network dependencies. All Phase 12 work is offline, in-tree.

## Sources

### Primary (HIGH confidence)

- **Codebase reads (verified via Read tool in this session):**
  - `extensions/pi-claude-marketplace/**` -- file contents and line numbers cited above
  - `tests/**` -- file contents and assertion shapes
  - `docs/messaging-style-guide.md` -- frontmatter shape, §3 / §4 / §5 / §14 / §14.1 content
  - `package.json`, `eslint.config.js`, `.planning/config.json` -- tooling configuration
- **CONTEXT.md** -- D-CMC-01..D-CMC-16 verbatim
- **REQUIREMENTS.md** -- CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37 text
- **ROADMAP.md** -- Phase 12 scope, success criteria, deps

### Secondary (MEDIUM confidence)

- TypeScript `as const` + indexed access pattern -- idiomatic strict TS (Microsoft TypeScript docs); precedent in `presentation/plugin-list.ts:45`
- Node.js native TS strip in Node 22.18+ -- Node official docs (referenced in pi-claude-marketplace's existing STACK.md research)

### Tertiary (LOW confidence)

None -- all claims in this research are either tool-verified, codebase-evidenced, or explicitly tagged as recommendations / assumptions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps; all tooling verified present
- Architecture (constants, composer, drift test): HIGH -- explicit decisions in CONTEXT.md; code precedents verified
- Pitfalls: HIGH -- risks identified via direct code inspection (markers-snapshot test dependency, missed callsites, count discrepancy)

**Research date:** 2026-05-22
**Valid until:** Until the style-guide frontmatter or any of the cited source files change. Re-verify if `docs/messaging-style-guide.md` is edited between research and execution.
