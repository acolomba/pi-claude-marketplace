# Phase 12: Messaging Foundations & Renderer Primitives - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 14 (2 new source, 4 modified source, 8 modified callsites, 2 new tests, 2 modified tests, 1 modified doc)
**Analogs found:** 14 / 14 (every file has a strong precedent in the codebase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` | shared/grammar (data module) | pure-data (const export) | `extensions/pi-claude-marketplace/presentation/plugin-list.ts:45` (`PluginRenderStatus`) | role-match (same `as const` / literal-union shape, different layer) |
| `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` | shared/grammar (data module) | pure-data (const export) | `extensions/pi-claude-marketplace/presentation/plugin-list.ts:45` (`PluginRenderStatus`) | role-match (same shape) |
| `extensions/pi-claude-marketplace/presentation/reload-hint.ts` (rewrite) | presentation (pure renderer) | request-response (string transform) | `extensions/pi-claude-marketplace/presentation/plugin-list.ts:21-38` (private layout constants idiom) | exact (same file directory, same private-const idiom) |
| `extensions/pi-claude-marketplace/presentation/index.ts` (barrel edit) | barrel (re-export) | static re-export | current `presentation/index.ts:1-17` (itself) | exact (self-analog; one line removal) |
| `extensions/pi-claude-marketplace/persistence/migrate.ts:177-181` (warn rewrite) | persistence (load-time diagnostic) | I/O-fail diagnostic via console.warn | current `persistence/migrate.ts:173-181` (itself; template-literal warn body) | exact (in-place rewrite of same call) |
| `orchestrators/plugin/install.ts:690` | orchestrator callsite migration | request-response | sibling callsites (uninstall.ts:237, update.ts:731) | exact |
| `orchestrators/plugin/uninstall.ts:237` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/plugin/update.ts:731` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/plugin/reinstall.ts:372` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/plugin/reinstall.ts:871` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/marketplace/update.ts:358` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/marketplace/remove.ts:278` | orchestrator callsite migration | request-response | siblings | exact |
| `orchestrators/import/execute.ts:339-341` | orchestrator callsite migration | request-response | siblings | exact (multi-line call shape) |
| `tests/architecture/grammar-frontmatter.test.ts` (NEW) | architectural test (drift guard) | file-I/O + regex extraction + assert | `tests/architecture/markers-snapshot.test.ts` + `tests/helpers/prd-extract.ts` | exact (same scaffolding: readFile then regex extract then assert.deepEqual) |
| `tests/presentation/reload-hint.test.ts` (rewrite) | unit test | request-response | current file (self-analog); pattern mirrors `tests/architecture/markers-snapshot.test.ts:42-71` per-case style | exact (same file path; test names + assertions rewritten) |
| `tests/persistence/migrate.test.ts` (additions) | unit test | source-regex assertion + existing `t.mock.method` capture | current `tests/persistence/migrate.test.ts:93-128` (IL-3 mock pattern) and `tests/architecture/markers-snapshot.test.ts:38-71` (file-read + regex pattern) | exact (extend existing IL-3 test file) |
| `docs/messaging-style-guide.md` Section 14.1 (doc edit) | normative doc | doc-only | current Section 14.1 (self-analog; in-place wording change) | exact |

## Pattern Assignments

### `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` (NEW; shared/grammar; pure-data)

**Analog:** `extensions/pi-claude-marketplace/presentation/plugin-list.ts:21-45`

**`as const` + literal-union pattern** (lines 21-45):

```typescript
// PL-4 icon table (PRD Section 5.3.1). Kept PRIVATE; the renderer maps status to icon.
const ICON_INSTALLED = "*";
const ICON_AVAILABLE = "o";
const ICON_UNINSTALLABLE = "X";

// Column-66 description truncation per PRD Section 5.3.1.
// D-06 corollary: PRIVATE to this file -- NOT promoted to a shared text-utils
// helper unless a third consumer arrives. Strings longer than 66 chars are
// sliced to 63 chars and suffixed with "...", landing exactly at column 66.
const MAX_LINE_COLUMN = 66;

/**
 * Status of a plugin from the renderer's perspective. The orchestrator
 * classifies each plugin into one of these buckets before constructing
 * the payload; the renderer simply maps to an icon.
 */
export type PluginRenderStatus = "installed" | "available" | "uninstallable";
```

**Deltas vs analog:**

- Module is in `shared/grammar/` (new directory under `shared/`), NOT `presentation/`. Per D-CMC-01 / D-11 layering: `shared/` sits below all layers and is importable from anywhere (presentation, orchestrators, tests). The analog's literal union is FILE-PRIVATE to its renderer; this module's constants are PUBLIC exports.
- Shape per D-CMC-03 is the FULLER form (array + derived literal union), not the inline-union shorthand the analog uses:

  ```typescript
  export const STATUS_TOKENS = ["installed", "updated", /* ... 14 entries ... */] as const;
  export type StatusToken = (typeof STATUS_TOKENS)[number];
  ```

  The reason: Phase 14's drift test iterates the array; the inline-union form does not provide an iterable value. Both forms produce the same compile-time type.
- File header comment mirrors `plugin-list.ts`'s style (cite the requirement ID, link the drift-guard test, name the design decision). See research Section 2.1 for the recommended comment text.
- **Token count:** 14 entries, byte-identical to `docs/messaging-style-guide.md:3-17` `status_tokens:` frontmatter block. NO `reinstalled` token (per D-CMC-08 reconciliation, research Section 3.1).

**Layering / discipline notes:**

- D-11 LAYERING: `shared/` is below all layers; safe to import from `presentation/`, `orchestrators/`, and `tests/`.
- D-CMC-04 DRIFT: The array is the read surface for `tests/architecture/grammar-frontmatter.test.ts`. The order of entries SHOULD match the frontmatter order (the drift test sorts both sides before `deepEqual`, so order-drift will not fail the test; matching order is a readability/review nicety).

---

### `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` (NEW; shared/grammar; pure-data)

**Analog:** Same as `status-tokens.ts` (`presentation/plugin-list.ts:45`).

**Pattern:** Identical to `status-tokens.ts`.

**Deltas vs analog:**

- Same as `status-tokens.ts`.
- **Reason count: 23 entries, NOT 24.** Research Section 2.1 and Section R4 surfaced this discrepancy (REQUIREMENTS.md / ROADMAP say 24; frontmatter has 23 -- verified at `docs/messaging-style-guide.md:18-41`). Planner MUST land the constants module with 23 entries matching the frontmatter, AND update REQUIREMENTS.md / ROADMAP "24" to "23" in the same PR (research Section 2.1 recommendation).
- Entries stored BARE (no surrounding braces); the `{<reason>}` brace form is a renderer concern Phase 13 composes at emission time.

**Layering / discipline notes:**

- Same as `status-tokens.ts`.

---

### `extensions/pi-claude-marketplace/presentation/reload-hint.ts` (REWRITE; presentation; pure renderer)

**Analog (file-internal pattern):** `extensions/pi-claude-marketplace/presentation/plugin-list.ts:26-38`

**Private layout constants idiom** (lines 26-38):

```typescript
// Column-66 description truncation per PRD Section 5.3.1.
// D-06 corollary: PRIVATE to this file -- NOT promoted to a shared text-utils
// helper unless a third consumer arrives. Strings longer than 66 chars are
// sliced to 63 chars and suffixed with "...", landing exactly at column 66.
const MAX_LINE_COLUMN = 66;

function truncateColumn66(s: string): string {
  if (s.length <= MAX_LINE_COLUMN) {
    return s;
  }

  return s.slice(0, MAX_LINE_COLUMN - 3) + "...";
}
```

**Current state to rewrite** (`presentation/reload-hint.ts:1-50`, entire file replaced):

```typescript
import { RELOAD_HINT_PREFIX } from "../shared/markers.ts";

/** RH-2 verb table: the only three legal verbs. */
export type ReloadVerb = "load" | "refresh" | "drop";

export function reloadHint(verb: ReloadVerb, names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${RELOAD_HINT_PREFIX}${verb} it.`;
  const quotedNames = names.map((n) => `"${n}"`).join(", ");
  return `${RELOAD_HINT_PREFIX}${verb} ${quotedNames}.`;
}

export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

**Target state (full file replacement; per research Section 2.2 + D-CMC-06, D-CMC-07):**

```typescript
// presentation/reload-hint.ts
//
// MSG-RH-1 reload-hint composition (style guide Section 5).
// Pure string function -- no IO, no ctx parameter.
//
// D-CMC-06 / D-CMC-07: the trailer literal is local to this file
// (one consumer in the codebase, ever). Not promoted to
// shared/markers.ts (transitional surface until Phase 13's atomic
// ES-5 edit) or shared/grammar/ (over-extraction for a one-consumer
// constant -- matches the MAX_LINE_COLUMN private-constant idiom
// in presentation/plugin-list.ts).

const RELOAD_HINT_TRAILER = "/reload to pick up changes";

export function reloadHint(names: readonly string[]): string {
  return names.length > 0 ? RELOAD_HINT_TRAILER : "";
}

export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

**Deltas vs analog (and vs current file):**

- **DROP** `import { RELOAD_HINT_PREFIX } from "../shared/markers.ts"` -- the markers prefix is no longer composed here. (`RELOAD_HINT_PREFIX` STAYS in `shared/markers.ts` per D-CMC-08; only the *import* from this file is removed.)
- **DROP** `export type ReloadVerb = "load" | "refresh" | "drop";` -- verb selector retired per D-CMC-06.
- **CHANGE** `reloadHint` signature: `(verb: ReloadVerb, names: readonly string[]) => string` becomes `(names: readonly string[]) => string`. Body collapses to single ternary returning the new trailer or `""`.
- **KEEP** `appendReloadHint` signature and body UNCHANGED (single-newline join). Research Section 2.2 + Section R7 + Open Question 2: blank-line-above conformance (MSG-RH-1 says "preceded by one blank line") is deferred to Phase 13. Add a TODO comment in `appendReloadHint`'s docstring referencing MSG-RH-1 (research Section 2.2).
- **NEW** local constant `const RELOAD_HINT_TRAILER = "/reload to pick up changes";` -- mirrors `MAX_LINE_COLUMN` idiom from `plugin-list.ts`: file-private, single consumer, NOT promoted to a shared module.

**Layering / discipline notes:**

- D-11 LAYERING: `presentation/` may import from `shared/` but never from `persistence/`. Removing the import of `RELOAD_HINT_PREFIX` REDUCES the surface; no new violation possible.
- D-CMC-07 ANTI-PATTERN: Do NOT add the new trailer to `shared/markers.ts` (in transition; D-CMC-08) or to `shared/grammar/` (over-extraction). The local-const placement is the locked decision.
- D-CMC-08 SNAPSHOT TEST: `RELOAD_HINT_PREFIX` MUST remain exported from `shared/markers.ts`. The markers-snapshot test (`tests/architecture/markers-snapshot.test.ts:52`) hard-asserts it. R1 risk: a cleanup pass deleting "the unused export" breaks `npm run check`. Plan 12-02 must explicitly forbid deleting it; consider adding an inline comment to `shared/markers.ts` next to `RELOAD_HINT_PREFIX` warning Phase 12 maintainers (see research Section R1 mitigation).

---

### `extensions/pi-claude-marketplace/presentation/index.ts` (MODIFY; barrel)

**Analog:** Itself (current file).

**Current state** (`presentation/index.ts:1-17`):

```typescript
// presentation/index.ts
//
// Barrel re-export for the presentation layer (Phase 4 first
// populates this directory beyond the placeholder).

export { appendReloadHint, reloadHint } from "./reload-hint.ts";
export type { ReloadVerb } from "./reload-hint.ts";

export {
  hasLoadedPiSubagents,
  hasLoadedPiMcpAdapter,
  subagentWarningIfNeeded,
  mcpAdapterWarningIfNeeded,
} from "./soft-dep.ts";

export { renderMarketplaceList } from "./marketplace-list.ts";
```

**Target state -- single line deletion:**

```typescript
export { appendReloadHint, reloadHint } from "./reload-hint.ts";
// DELETE: export type { ReloadVerb } from "./reload-hint.ts";
```

**Deltas vs analog:**

- DELETE the `ReloadVerb` type re-export line (D-CMC-06: type no longer exists in `reload-hint.ts`).
- All other exports unchanged.

**Layering / discipline notes:**

- A grep for `ReloadVerb` across the codebase should return zero matches after this edit (callsites also updated; see below).
- Typecheck enforces this: any straggling `import { ReloadVerb } from "presentation"` fails `npm run typecheck` immediately.

---

### `extensions/pi-claude-marketplace/persistence/migrate.ts:173-181` (REWRITE; persistence; IL-3 diagnostic)

**Analog:** Itself (current file lines 173-181).

**Current state** (`persistence/migrate.ts:173-181`):

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

**Target state** (per D-CMC-14, byte-exact wording locked):

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

**Deltas vs analog:**

- ONLY the template-literal body inside `console.warn(...)` changes.
- `try`/`catch`/`errMsg` extraction UNCHANGED.
- The inline eslint-disable line UNCHANGED -- byte-identical, no comma/whitespace/rationale changes (D-CMC-16 / CMC-37).
- Two template variables `${stateJsonPath}` and `${errMsg}` are present in both old and new; their positions in the new sentence are: `stateJsonPath` after "persisted to", `errMsg` after "Cause: ".
- Period placement: the new wording uses a semicolon mid-sentence and a single terminal period (sentence form per MSG-LC-1 / style guide Section 18.3).

**Layering / discipline notes:**

- IL-3 / CMC-37: The eslint inline disable is the SOLE audit surface for this exception. Do NOT widen `eslint.config.js` (the rule list at `no-restricted-syntax` lines 87-127 + `no-console: error` line 130 STAYS UNCHANGED). Research Section 5 confirms `eslint.config.js` PR diff should be empty.
- IL-3 single-callsite: Exactly ONE `console.warn(` must appear in `persistence/migrate.ts` after the edit (research Section 4 test sketch covers this with a count assertion).
- Comment line discipline (D-CMC-16): The comma between `no-restricted-syntax` and `no-console` is part of the audit contract; the `-- IL-3:` rationale text "load-time migrate save fail" stays verbatim (the wording change does not invalidate the rationale).

---

### Orchestrator callsite migrations (8 sites, mechanical)

**Analog:** Each callsite migrates the SAME signature change. Pattern is identical across all 8.

**Before/after pattern** (illustrative -- `orchestrators/plugin/install.ts:690`):

```typescript
// BEFORE:
const hint = reloadHint("load", stagedAny ? [plugin] : []);
notifySuccess(ctx, appendReloadHint(body, hint));

// AFTER (drop the verb literal):
const hint = reloadHint(stagedAny ? [plugin] : []);
notifySuccess(ctx, appendReloadHint(body, hint));
```

**Full enumeration (CONFIRMED 8 sites -- Phase 12 RESEARCH Section 2.3 enumeration, verified by Read in this session):**

| File:Line | Current first arg | Names expression (unchanged) |
|-----------|-------------------|------------------------------|
| `orchestrators/plugin/install.ts:690` | `"load"` | `stagedAny ? [plugin] : []` |
| `orchestrators/plugin/uninstall.ts:237` | `"drop"` | `droppedAny ? [plugin] : []` |
| `orchestrators/plugin/update.ts:731` | `"refresh"` | `updatedNames` |
| `orchestrators/plugin/reinstall.ts:372` | `"refresh"` | `changedNames` |
| `orchestrators/plugin/reinstall.ts:871` | `"refresh"` | `outcome.resourcesChanged ? [outcome.name] : []` |
| `orchestrators/marketplace/update.ts:358` | `"refresh"` | `updatedNames` |
| `orchestrators/marketplace/remove.ts:278` | `"drop"` | `removedSorted` |
| `orchestrators/import/execute.ts:339-341` | `"load"` (multi-line) | `result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin)` |

**Special-case shape -- `orchestrators/import/execute.ts:339-345` (multi-line call):**

```typescript
// BEFORE:
return appendReloadHint(
  body,
  reloadHint(
    "load",
    result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
  ),
);

// AFTER:
return appendReloadHint(
  body,
  reloadHint(
    result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
  ),
);
```

**Deltas vs analog:**

- Each edit is a localized 1-line (or 1-token in the multi-line case) deletion of the first arg + comma.
- The names expression passes through verbatim.
- Existing in-file comments ABOVE each call may reference "verb 'load'" / "verb 'drop'" / "verb 'refresh'" (e.g. `uninstall.ts:234`, `update.ts:730`, `marketplace/update.ts` neighborhood). These comments are stale after the migration; planner / executor SHOULD update them in the same edit (research does not flag this as mandatory; it is a cleanliness concern for review).

**Layering / discipline notes:**

- D-CMC-10 CARVE-OUT: These 8 sites now emit `/reload to pick up changes` instead of the legacy `Run /reload to <verb> "..."`. This is a user-visible change beyond migrate.ts. PLAN.md / CHANGELOG.md MUST cite D-CMC-10 + roadmap criterion #2 ("the three-verb selector is gone from `presentation/reload-hint.ts`") so reviewers do not misread roadmap criterion #4 (research Section R3).
- Verification: After edit, a grep for `reloadHint(` in `extensions/pi-claude-marketplace/` should return exactly 8 matches in `orchestrators/`, none with a string-literal verb as the first argument. A grep for `reloadHint("load"|reloadHint("refresh"|reloadHint("drop"` should return zero matches.
- R2 RISK: CONTEXT.md enumerates only 6 callsites; the actual count is 8 (the two missing are in `orchestrators/plugin/reinstall.ts` at lines 372 and 871). Plan 12-02 MUST enumerate all 8 in its task list. Typecheck catches misses, but the plan should not depend on the typecheck to surface them.

---

### `tests/architecture/grammar-frontmatter.test.ts` (NEW; tests/architecture; drift guard)

**Primary analog:** `tests/architecture/markers-snapshot.test.ts:1-71`

**Test scaffolding pattern** (lines 1-16):

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import * as markers from "../../extensions/pi-claude-marketplace/shared/markers.ts";
import { extractEs5MarkerLiterals } from "../helpers/prd-extract.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRD_PATH = path.join(REPO_ROOT, "docs/prd/pi-claude-marketplace-prd.md");
```

**Async file-read + extract + assert pattern** (lines 38-71):

```typescript
test("ES-5 markers in shared/markers.ts match PRD Section 6.12 byte-for-byte (D-09)", async () => {
  const prd = await readFile(PRD_PATH, "utf8");
  const literals = extractEs5MarkerLiterals(prd);

  assert.equal(
    literals.length,
    5,
    `Expected 5 backtick-quoted ES-5 markers in PRD Section 6.12, found ${literals.length}: ${JSON.stringify(literals)}`,
  );

  // ... per-pair assertion loop ...
});
```

**Secondary analog (regex extraction precedent):** `tests/helpers/prd-extract.ts:1-28`

**Hand-rolled regex extractor** (lines 13-28):

```typescript
export function extractEs5MarkerLiterals(prd: string): string[] {
  const es5RowRe = /^\|\s*\*\*ES-5\*\*\s*\|.*$/m;
  const es5RowMatch = es5RowRe.exec(prd);
  if (es5RowMatch === null) {
    throw new Error("PRD Section 6.12 ES-5 row not found -- has the PRD been refactored?");
  }

  const backtickRe = /`([^`]+)`/g;
  const literals: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(es5RowMatch[0])) !== null) {
    literals.push(m[1]!);
  }

  return literals;
}
```

**Target file (per research Section 2.5 -- copy the scaffold, swap the source-path / extractor / assertion):**

The new file imports from `shared/grammar/{status-tokens,reasons}.ts`, reads `docs/messaging-style-guide.md`, defines a local `extractFrontmatterList(md, key)` regex extractor (NOT extracted to a helper in Phase 12 -- D-CMC-04 keeps it test-local; Phase 14 may consolidate), and asserts `assert.deepEqual([...STATUS_TOKENS].sort(), [...frontmatterTokens].sort(), ...)` (sort-then-compare for set-equality without ordering coupling).

**Deltas vs analog:**

- Source doc: `docs/messaging-style-guide.md` (NOT `docs/prd/pi-claude-marketplace-prd.md`).
- Extractor pattern: frontmatter `^<key>:\n  - <value>` block (NOT PRD table row + backticks). Implementation is local to the test file (research Section 2.5 sketch); does NOT live in `tests/helpers/`.
- Assertion shape: `assert.deepEqual(sortedCode, sortedFrontmatter, msg)` (NOT byte-prefix stripping). Set-equality is the contract per D-CMC-04, not prefix matching.
- Imports: `STATUS_TOKENS` and `REASONS` from the new `shared/grammar/` modules; NO `markers` import (different concern).
- Two main `test(...)` cases (one per constant set) + two "throws" guard tests on the extractor (per research Section 2.5).

**Layering / discipline notes:**

- D-11 LAYERING: Test imports from `shared/grammar/` are unconstrained (test layer + shared layer; no boundary violation).
- D-CMC-04: Frontmatter loader stays test-local; do NOT publish a `shared/frontmatter-loader.ts` in Phase 12 (Phase 14 owns the richer reader).
- NO new dependency: `yaml` / `js-yaml` REJECTED per research Section 3.2; the regex extractor handles the fixed frontmatter shape.
- R4 RISK: REASONS count discrepancy (24 vs 23). Plan 12-01 must reconcile (treat frontmatter as binding; update REQUIREMENTS.md / ROADMAP "24" to "23" in same PR). If a missing reason is identified, add to frontmatter FIRST.

---

### `tests/presentation/reload-hint.test.ts` (REWRITE; tests/presentation; unit)

**Analog:** Itself (current file lines 1-46).

**Current state** (entire file):

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReloadHint,
  reloadHint,
} from "../../extensions/pi-claude-marketplace/presentation/reload-hint.ts";
import { RELOAD_HINT_PREFIX } from "../../extensions/pi-claude-marketplace/shared/markers.ts";

test("RH-1: empty names returns empty string (no reload hint emitted)", () => {
  assert.equal(reloadHint("load", []), "");
  assert.equal(reloadHint("refresh", []), "");
  assert.equal(reloadHint("drop", []), "");
});

test("RH-2: single name renders 'Run /reload to <verb> it.'", () => {
  assert.equal(reloadHint("load", ["foo"]), `${RELOAD_HINT_PREFIX}load it.`);
  // ... two more verb cases ...
});

test('RH-2: multi name renders ...', () => {
  // ... verb-specific assertions ...
});

test("RELOAD_HINT_PREFIX is byte-for-byte 'Run /reload to '", () => {
  assert.equal(RELOAD_HINT_PREFIX, "Run /reload to ");
});

test("appendReloadHint: empty hint returns bare body (RH-1 suppression)", () => {
  assert.equal(appendReloadHint("Body content", ""), "Body content");
});

test("appendReloadHint: non-empty hint joins with single newline", () => {
  assert.equal(
    appendReloadHint("Body content", "Run /reload to load it."),
    "Body content\nRun /reload to load it.",
  );
});
```

**Target state (per research Section 3.4, 5 tests recommended):**

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReloadHint,
  reloadHint,
} from "../../extensions/pi-claude-marketplace/presentation/reload-hint.ts";

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

**Deltas vs analog (current file):**

- **DROP** the `RELOAD_HINT_PREFIX` import -- the new composer does not depend on it; the markers-snapshot test still covers byte-equality (no duplication).
- **DROP** the 3 verb-specific test cases (RH-1 empty-with-3-verbs, RH-2 single-with-3-verbs, RH-2 multi-with-3-verbs).
- **DROP** the inline `"RELOAD_HINT_PREFIX is byte-for-byte 'Run /reload to '"` assertion (still covered by markers-snapshot test).
- **REWRITE** the empty/single/multi cases to call `reloadHint(names)` (no verb arg) and assert the new canonical trailer.
- **KEEP** the `appendReloadHint` two-case shape (empty suppression + single-newline join) -- unchanged behavior; only the inner hint string changes.
- Test names: rename `RH-1` / `RH-2` to `MSG-RH-1` (the style-guide Section 5 requirement ID; per research Section 3.4).

**Layering / discipline notes:**

- D-CMC-09 VERIFICATION: After rewrite, a grep for `ReloadVerb|reloadHint("load"|reloadHint("refresh"|reloadHint("drop"|RELOAD_HINT_PREFIX` in `tests/presentation/reload-hint.test.ts` MUST return zero matches (research Section 4 Reload-Hint Test Rewrite Non-Drift Verification).
- File path unchanged.

---

### `tests/persistence/migrate.test.ts` (EXTEND; tests/persistence; unit + source-regex)

**Analog (in-file IL-3 capture pattern):** `tests/persistence/migrate.test.ts:93-128`

**Existing IL-3 console.warn capture pattern** (lines 93-128):

```typescript
test("IL-3 persistMigratedState swallows write failures and emits ONE console.warn", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-migrate-fail-"));
  try {
    const blocker = path.join(dir, "blocker");
    await writeFile(blocker, "");
    const targetThatCannotBeWritten = path.join(blocker, "state.json");

    const warnMock = t.mock.method(console, "warn", () => {
      // No-op: capture the call without echoing to stderr.
    });

    await persistMigratedState(targetThatCannotBeWritten, {
      schemaVersion: 1,
      marketplaces: {},
    });

    assert.equal(
      warnMock.mock.callCount(),
      1,
      "IL-3 sanctioned console.warn must fire exactly once on persist failure",
    );
    const warnArg = warnMock.mock.calls[0]?.arguments[0] as string;
    assert.match(warnArg, /pi-claude-marketplace: failed to persist migrated state/);
    assert.match(warnArg, /continuing with in-memory normalized state/);
    assert.ok(
      warnArg.includes(targetThatCannotBeWritten),
      "warn message must name the failed path so the user can act",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

**Secondary analog (source-file regex pattern):** `tests/architecture/markers-snapshot.test.ts:38-71` (Read source file then assert regex / equality on its bytes).

**Required edits (per research Section 4 test sketch -- covers CMC-36 + CMC-37):**

Two classes of changes:

1. **UPDATE the existing `t.mock.method(console, "warn", ...)` capture test (lines 93-128):** Change the two `assert.match` regexes to match the NEW wording:

   ```typescript
   // BEFORE:
   assert.match(warnArg, /pi-claude-marketplace: failed to persist migrated state/);
   assert.match(warnArg, /continuing with in-memory normalized state/);

   // AFTER (matches new Section 14.1 wording):
   assert.match(warnArg, /Legacy marketplace migration could not be persisted/);
   assert.match(warnArg, /the in-memory normalized state is being used/);
   assert.match(warnArg, /Cause: /);
   ```

   The "warn must name the failed path" assertion (`warnArg.includes(targetThatCannotBeWritten)`) is unchanged -- `${stateJsonPath}` interpolation is preserved in the new wording.

2. **ADD a new file-read + regex assertion test (per research Section 4 sketch -- recommended location: this same file, or `tests/persistence/migrate-warn-wording.test.ts` if planner prefers separation):**

   ```typescript
   test("CMC-36: persistence/migrate.ts warn body matches style guide Section 14.1 wording", async () => {
     const src = await readFile(MIGRATE_PATH, "utf8");
     const expected =
       "`Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.`";
     assert.ok(src.includes(expected), `Expected Section 14.1 wording at persistence/migrate.ts; not found.`);
     assert.ok(
       !src.includes("failed to persist migrated state to"),
       "Legacy wording 'failed to persist migrated state to' must be fully replaced (CMC-36)",
     );
   });

   test("CMC-37: IL-3 eslint-disable-next-line comment is preserved verbatim above the warn", async () => {
     const src = await readFile(MIGRATE_PATH, "utf8");
     const expectedPattern =
       /\/\/ eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail\n\s*console\.warn\(/;
     assert.match(src, expectedPattern, "IL-3 inline disable must appear directly above the warn (CMC-37)");
   });

   test("CMC-37: exactly one sanctioned warn callsite in persistence/migrate.ts", async () => {
     const src = await readFile(MIGRATE_PATH, "utf8");
     const matches = src.match(/console\.warn\(/g) ?? [];
     assert.equal(matches.length, 1, "persistence/migrate.ts must have exactly one sanctioned warn (IL-3)");
   });
   ```

**Deltas vs analogs:**

- Reuses the EXISTING `t.mock.method(console, "warn", ...)` pattern from the same file for the runtime-emission test (just swaps the regex needles).
- Adds the file-read + regex assertion pattern from `markers-snapshot.test.ts` to provide source-byte-level guards for CMC-36 / CMC-37.
- Planner discretion: keep all three new tests in `tests/persistence/migrate.test.ts` (same file as existing IL-3 tests) OR split into `tests/persistence/migrate-warn-wording.test.ts` (research Section 4 suggested name). The former keeps IL-3 coverage co-located; the latter narrowly scopes to the wording contract. Either is acceptable.

**Layering / discipline notes:**

- tests/* eslint override (per `eslint.config.js` block D) permits `console.*` in tests, so the `t.mock.method(console, "warn", ...)` pattern needs no inline disable.
- The `readFile(MIGRATE_PATH, "utf8")` pattern requires the `MIGRATE_PATH` constant resolved from `fileURLToPath(import.meta.url)` (same scaffolding as `markers-snapshot.test.ts:15-16`).

---

### `docs/messaging-style-guide.md` Section 14.1 (DOC EDIT)

**Analog:** Itself (current Section 14 + Section 14.1, lines 484-507).

**Current state** (lines 490, 493, 507 -- the three sentences to change):

| Location | Current text (paraphrased) |
|----------|----------------------------|
| Section 14 MSG-LC-1 row tail | "Phase 12 PROPOSES the new wording (below); Phase 13 owns the persistence/migrate.ts:178 byte change. (per CONTEXT.md D-24)" |
| Section 14.1 heading | "### 14.1 Proposed new wording (Phase 13 applies)" |
| Section 14.1 closing paragraph | "Phase 13's planner has FINAL discretion on the exact wording. The proposal above satisfies the structural constraints... Phase 12 ships the contract, not the bytes." |

**Target state** (per research Section 2.7):

| Location | Target text |
|----------|-------------|
| Section 14 MSG-LC-1 row tail | "Phase 12 LANDED the new wording (below); the byte change at persistence/migrate.ts:178 lives in the same Phase 12 PR (per CONTEXT.md D-CMC-14 / D-CMC-15)." |
| Section 14.1 heading | "### 14.1 Wording (Phase 12 landed)" |
| Section 14.1 closing paragraph | "The wording above is the binding text shipped at persistence/migrate.ts:178 in Phase 12 per D-CMC-14. It satisfies the structural constraints of MSG-LC-1 (sentence form, terminal period, no compact-grammar tokens, no severity prefix). The IL-3 inline eslint-disable-next-line comment is preserved verbatim above the call per D-CMC-16 / MSG-LC-2." |

**KEEP UNCHANGED:**

- Section 14.1's "Today's wording" block (lines 495-499) -- documents the legacy form for historical clarity; the framing of the surrounding prose flips from "Today's" to "Phase 12 superseded this on-disk", but the block itself stays.
- The `Proposed replacement under the guide's tone and punctuation rules` block (lines 501-505) -- the wording IS what landed at migrate.ts; the framing can shift to "The wording shipped at persistence/migrate.ts:178 in Phase 12 is" or similar; the byte content of the codeblock stays identical.

**Deltas vs analog:**

- Doc-only edit; no schema / no validation.
- Atomic with `persistence/migrate.ts` edit per D-CMC-15. R5 RISK: do NOT split into a separate PR.

**Layering / discipline notes:**

- This doc is the NORMATIVE messaging contract (supersedes PRD Section 6.12 ES-5 per Section 15). Edits to wording-content require careful review; this PR is text-framing only (no semantic change to the proposal block).
- Frontmatter (`status_tokens:`, `reasons:`) is UNTOUCHED by this edit -- Phase 12's drift test reads it as-is.

---

## Shared Patterns

### File-header comment style (cite requirement IDs + decision IDs)

**Source:** Every existing file in `presentation/` (e.g., `presentation/plugin-list.ts:1-19`, `presentation/reload-hint.ts:1-11`, `shared/markers.ts:1-7`, `shared/notify.ts:5-19`).

**Apply to:** Both new `shared/grammar/*.ts` files; both rewritten test files.

**Excerpt** (`presentation/plugin-list.ts:1-12`):

```typescript
// presentation/plugin-list.ts
//
// PL-1..7 top-level plugin list pure formatter. D-06 orchestrator+presentation
// split: orchestrators/plugin/list.ts (Plan 05-08) owns state-reads and
// manifest soft-fail; this file owns rendering only.
//
// Per D-11, presentation/ does NOT import from persistence/. The payload
// interfaces below are declared LOCALLY as structural minima of the
// orchestrator's payload shape -- the orchestrator constructs the payload
// and passes it in.
```

Pattern: file path then requirement IDs then decision IDs then layering callout. Phase 12 files should follow the same shape, citing CMC-08 / CMC-11 / CMC-14 / CMC-19 / CMC-36 / CMC-37 plus the relevant D-CMC-NN decisions plus D-11 / IL-3 layering.

---

### `as const` + literal-union shape

**Source:** `extensions/pi-claude-marketplace/presentation/plugin-list.ts:45` (inline-union shorthand).

**Apply to:** Both `shared/grammar/*.ts` files (in the FULLER form per D-CMC-03: explicit `as const` array + indexed-access derived union -- required because Phase 14's drift test iterates the array).

```typescript
// Inline shorthand (analog):
export type PluginRenderStatus = "installed" | "available" | "uninstallable";

// Full form (D-CMC-03 -- Phase 12 new modules):
export const STATUS_TOKENS = ["installed", "updated", /* ... */] as const;
export type StatusToken = (typeof STATUS_TOKENS)[number];
```

---

### Private layout / literal constants

**Source:** `extensions/pi-claude-marketplace/presentation/plugin-list.ts:30` (`const MAX_LINE_COLUMN = 66`).

**Apply to:** `presentation/reload-hint.ts`'s new `const RELOAD_HINT_TRAILER = "/reload to pick up changes";` (D-CMC-07: local to single consumer, no shared promotion).

---

### Test scaffolding (architectural / drift tests)

**Source:** `tests/architecture/markers-snapshot.test.ts:1-16` + `tests/helpers/prd-extract.ts:1-28`.

**Apply to:** `tests/architecture/grammar-frontmatter.test.ts` (per D-CMC-04).

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");

// Local extractFrontmatterList (NOT extracted to tests/helpers/; D-CMC-04 keeps test-local in Phase 12)
function extractFrontmatterList(md: string, key: string): string[] { /* regex impl */ }

test("...", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  // ... assert.deepEqual([...CONSTANT].sort(), [...frontmatter].sort(), msg) ...
});
```

---

### IL-3 inline eslint-disable comment

**Source:** `extensions/pi-claude-marketplace/persistence/migrate.ts:177` (verbatim).

**Apply to:** Re-affirmed in the same file after the wording change (D-CMC-16). Byte-identical line -- no changes to the rule list, the `--`, or the rationale text:

```typescript
// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
console.warn(/* ... new wording ... */);
```

---

### `t.mock.method(console, "warn", ...)` capture pattern

**Source:** `tests/persistence/migrate.test.ts:93-128`.

**Apply to:** The same test file's existing test, with regex needles updated to match the new wording (per CMC-36 update path).

---

### Barrel re-export pattern

**Source:** `extensions/pi-claude-marketplace/presentation/index.ts:1-17` (current file).

**Apply to:** The same file (single-line deletion of the `ReloadVerb` type re-export).

```typescript
// Value re-export (KEEPS):
export { appendReloadHint, reloadHint } from "./reload-hint.ts";
// Type re-export (DELETES per D-CMC-06):
// export type { ReloadVerb } from "./reload-hint.ts";   <- DELETE
```

---

## No Analog Found

None. Every Phase 12 file has a strong (exact or role-match) analog in the codebase.

## Cross-Cutting Discipline Boundaries (apply to all Phase 12 work)

| Boundary | Source rule | Phase 12 impact |
|----------|-------------|-----------------|
| **D-11 layering** (`presentation` does not import `persistence`) | `eslint.config.js` `import-x/no-restricted-paths` block | Verified by `tests/architecture/import-boundaries.test.ts`. New `shared/grammar/` sits BELOW all layers; safe to import from `presentation/` / `orchestrators/` / `tests/`. |
| **D-07 single `ctx.ui.notify` callsite** (`shared/notify.ts` only) | `eslint.config.js` BLOCK B per-file override | NO new `ctx.ui.notify` callsite is added in Phase 12 (D-CMC-11). The four wrappers are untouched; new composers (Phase 13) return strings that flow into the wrappers. |
| **IL-3 single sanctioned `console.warn`** (`persistence/migrate.ts:178` only) | Inline `eslint-disable-next-line` + `no-console: error` config rule | D-CMC-16: comment line preserved verbatim above the rewritten call. CMC-37: NO config widening -- `eslint.config.js` PR diff must be empty. |
| **NFR-6 `npm run check` green** (typecheck + lint + format:check + test) | Project quality gate | Every plan in Phase 12 must end with a green `npm run check`. The signature change to `reloadHint` is type-level breaking; all 8 callsites + the test rewrite + the index barrel edit MUST land together in one plan (12-02 per research Section 3.3). |
| **D-CMC-08 retention of `RELOAD_HINT_PREFIX`** | `tests/architecture/markers-snapshot.test.ts:52` | Phase 12 MUST NOT delete `RELOAD_HINT_PREFIX` from `shared/markers.ts`. Verification: a grep for `RELOAD_HINT_PREFIX` in `shared/markers.ts` returns 1 match after Phase 12. R1 mitigation: add an in-line warning comment next to the export. |
| **D-CMC-10 carve-out** (reload-hint trailer change is user-visible) | CONTEXT.md / ROADMAP criterion #2 | PLAN.md and CHANGELOG.md must explicitly cite the carve-out and authorizing criterion #2 to forestall R3 (reviewer misreads criterion #4). |
| **D-CMC-15 atomic PR** (migrate.ts byte + style-guide Section 14.1) | CONTEXT.md | Plan 12-03 contains BOTH the code byte change and the style-guide doc edit in a single PR. R5 mitigation. |

## Metadata

**Analog search scope:**

- `extensions/pi-claude-marketplace/{shared,presentation,persistence,orchestrators}/` -- for code analogs
- `tests/{architecture,presentation,persistence,helpers}/` -- for test analogs
- `docs/messaging-style-guide.md` -- for the normative doc and the binding frontmatter
- `eslint.config.js` (referenced but not modified -- CMC-37)

**Files inspected this session:**

- `.planning/phases/12-messaging-foundations-renderer-primitives/12-CONTEXT.md` (190 lines, full)
- `.planning/phases/12-messaging-foundations-renderer-primitives/12-RESEARCH.md` (959 lines, full)
- `extensions/pi-claude-marketplace/presentation/plugin-list.ts:1-80`
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` (full, 50 lines)
- `extensions/pi-claude-marketplace/presentation/index.ts` (full, 17 lines)
- `extensions/pi-claude-marketplace/persistence/migrate.ts:160-183`
- `extensions/pi-claude-marketplace/shared/markers.ts` (full, 38 lines)
- `extensions/pi-claude-marketplace/shared/notify.ts` (full, 65 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:680-699`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:232-241`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:726-735`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:365-379` and `865-879`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:353-362`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:273-282`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:335-349`
- `tests/architecture/markers-snapshot.test.ts` (full, 132 lines)
- `tests/architecture/import-boundaries.test.ts:1-80`
- `tests/presentation/reload-hint.test.ts` (full, 46 lines)
- `tests/persistence/migrate.test.ts:1-145`
- `tests/helpers/prd-extract.ts` (full, 28 lines)
- `docs/messaging-style-guide.md:1-60`, `:470-528`

**Pattern extraction date:** 2026-05-22

## PATTERN MAPPING COMPLETE

Every Phase 12 file (2 new source, 4 modified source, 8 callsite migrations, 2 new/modified tests, 1 doc edit) has an exact-or-role-match analog in the codebase; planner can copy patterns directly into PLAN.md action lists. Critical handoffs to planner: (1) callsite enumeration is 8 not 6 (two missed in reinstall.ts at 372 and 871; research Section R2); (2) reasons-count discrepancy 24-vs-23 between REQUIREMENTS/ROADMAP and the binding frontmatter must be reconciled in Plan 12-01 (research Section R4 -- frontmatter wins, docs update to 23).
