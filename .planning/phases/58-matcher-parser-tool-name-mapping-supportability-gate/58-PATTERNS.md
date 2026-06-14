# Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 13 (3 NEW source/test + 7 MODIFY + 3 doc/test EXTEND)
**Analogs found:** 13 / 13 (every Phase 58 site has a strong in-tree analog)

## File Classification

| Phase 58 File | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` (NEW) | domain/closed-set table | transform (Claude ↔ Pi lookup) | `shared/notify.ts` `REASONS` / `STATUS_TOKENS` / `MARKERS` tuples (lines 72-104, 203-226, 237) | exact (closed-set `as const` + literal-union derive) |
| `extensions/pi-claude-marketplace/domain/components/hook-events.ts` (NEW) | domain/closed-set tables | transform (event → field-name + value set) | `shared/notify.ts` `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` (lines 357-396); for the per-event field map see install.ts `MANIFEST_FIELD_TO_REASON` (lines 1486-1489) | exact (tuple + sibling Record) |
| `tests/architecture/hooks-tool-name-map.test.ts` (NEW) | architecture test | request-response (introspection) | `tests/architecture/hooks-foundation.test.ts` (whole file) | exact (P04 pattern explicit in research §"Pattern 1") |
| `tests/architecture/hooks-supportability.test.ts` (NEW) | architecture test | request-response | `tests/architecture/hooks-foundation.test.ts` | exact |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` (EXTEND) | domain/parser | request-response (discriminated result) | self (Phase 57 baseline) — `parseHooksConfig` (lines 156-180) is the seam D-58-03 extends | exact (extension, not replacement) |
| `tests/domain/components/hooks.test.ts` (EXTEND/CREATE) | unit test | request-response | existing Phase 57 hooks unit test pattern (and `hooks-foundation.test.ts`) | role-match |
| `tests/shared/probe-classifiers.test.ts` (CREATE/EXTEND) | unit test | request-response | `shared/probe-classifiers.ts` (covered by existing list tests) | role-match |
| `extensions/pi-claude-marketplace/shared/notify.ts` (MODIFY) | closed-set tuple member rename | n/a | self — `REASONS` tuple (lines 72-104) | exact (in-place rename) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (MODIFY) | manifest-field carve-out drop | n/a | self — `MANIFEST_FIELD_REASONS` + `MANIFEST_FIELD_TO_REASON` (lines 1478, 1486-1489) | exact (in-place edits) |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` (MODIFY) | substring classifier tightening | transform (note → Reason) | self — `narrowResolverNotes` (lines 75-100) | exact |
| `docs/output-catalog.md` (MODIFY) | doc bytes | n/a | self — 7 occurrences of `{hooks}` (lines 59, 136, 182, 301, 534, 750, 1138, 1144) | exact |
| `docs/messaging-style-guide.md` (MODIFY) | doc — closed-set prose | n/a | self — guide prose references `REASONS` tuple | exact |
| `tests/architecture/catalog-uat.test.ts` (MODIFY) | fixture re-key + new fixtures | n/a | self — 7 rows w/ `reasons: ["hooks"]` (lines 272, 276, 507, 582, 829, 1175, 1708) | exact |
| `tests/architecture/notify-grammar-invariant.test.ts` (MODIFY) | subject-first grammar invariant | request-response | self (existing invariant) | exact (participation; no new invariant) |

Note: research counts 13 fixture rows in catalog-uat; grep finds 7 explicit
`"hooks"` cells — additional rows may live behind helper rebuilders or in
multi-line fixtures the planner should re-grep at write time.

## Pattern Assignments

### `domain/components/hook-tool-names.ts` (NEW — closed-set table)

**Analog:** `extensions/pi-claude-marketplace/shared/notify.ts` lines 72-106 (REASONS tuple + literal-union derive).

**Closed-set tuple + literal-union derive pattern** (notify.ts:72-106):

```typescript
export const REASONS = [
  "up-to-date",
  "not found",
  // ...
  "not added",
] as const;

export type Reason = (typeof REASONS)[number];
```

**What changes for hook-tool-names.ts:** Two paired `as const` Record
literals (NOT a tuple — bidirectional lookup wanted), each constrained by
a `satisfies Record<...>` clause. The `PiToolName` literal union is
mirrored from the peer-dep `ToolCallEvent.toolName` (see RESEARCH
§"Pattern 3" lines 269-298 for the exact shape). The architecture test
asserts inverse-invariance at runtime. Documentation block at the top of
the file mirrors the notify.ts REASONS block — closed-set source of
truth, layering note, no JSDoc on individual entries.

---

### `domain/components/hook-events.ts` (NEW — closed-set tuple + per-event maps)

**Analog A (event tuple):** `shared/notify.ts` `PLUGIN_STATUSES` (lines 357-374) — `as const` tuple + indexed-access type.

**Analog B (per-event Record lookup):** `orchestrators/plugin/install.ts:1486-1489` `MANIFEST_FIELD_TO_REASON`:

```typescript
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, ContentReason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};
```

**What changes for hook-events.ts:** Ships `BUCKET_A_EVENTS` (8-element
`as const` tuple), `TOOL_EVENTS` (3-element subset for TOOL-02 c-routing),
and two parallel Records `NON_TOOL_EVENT_FIELDS` (event → Pi-side field
name | `null` for UserPromptSubmit no-matcher-support sentinel) and
`NON_TOOL_EVENT_CLOSED_SETS` (event → `ReadonlySet<string>` of allowed
Claude-side values). Pitfalls 3-5 in RESEARCH (`clear` / `compact` /
`manual` / `auto` / UserPromptSubmit) determine the closed-set
contents — planner verifies values at write time.

---

### `tests/architecture/hooks-tool-name-map.test.ts` (NEW)

**Analog:** `tests/architecture/hooks-foundation.test.ts` (lines 1-80 shown above; whole file is the model).

**Pattern (hooks-foundation.test.ts:1-32):**

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOKS_CONFIG_SCHEMA,
  HOOKS_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import {
  SUPPORTED_COMPONENT_KINDS,
  UNSUPPORTED_COMPONENT_KINDS,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
```

**Per-test shape (lines 38-57):** one `test("ID: short description", () => { ... })` per locked invariant, JSON-Schema introspection via casts to `Record<string, unknown>`, `assert.equal` / `assert.ok` for membership.

**What changes:** Tests for TOOL-01 inverse-invariance (both directions),
peer-dep tool-name coverage (`assert.ok(tool in PI_TO_CLAUDE_TOOL_NAMES)`
loop + `assert.equal(Object.keys(...).length, 7)` count-lock — see
RESEARCH §"Architecture test pattern" lines 707-761 for the proposed
shape).

---

### `tests/architecture/hooks-supportability.test.ts` (NEW)

**Analog:** Same as above — `tests/architecture/hooks-foundation.test.ts` pattern. Each test pins one TOOL-02 invariant: bucket-A 8-event count-lock, per-event closed-set membership for SessionStart / SessionEnd / PreCompact / PostCompact, UserPromptSubmit no-matcher sentinel, regex matcher trips, unmapped tool trips, non-command handler trips. One test per invariant.

---

### `extensions/pi-claude-marketplace/domain/components/hooks.ts` (EXTEND)

**Analog:** Self, lines 138-180 (Phase 57 `HookConfigParseResult` and `parseHooksConfig`).

**Existing discriminated-result shape** (hooks.ts:138-180):

```typescript
export type HookConfigParseResult =
  | { ok: true; value: HooksConfig }
  | { ok: false; reason: string };

export function parseHooksConfig(raw: string): HookConfigParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = `hooks.json is not valid JSON: ${errorMessage(err)}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  if (!HOOKS_VALIDATOR.Check(parsed)) {
    const detail = firstHookValidationDetail(parsed);
    const reason = `hooks.json failed schema validation: ${detail}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  return { ok: true, value: parsed };
}
```

**Existing debug-log seam** (hooks.ts:150-154):

```typescript
export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[hooks] ${detail}`);
  }
}
```

**What changes (D-58-03 single seam):** After the `HOOKS_VALIDATOR.Check`
arm, append a `checkMatcherSupportability(parsed)` call. On failure,
reuse the SAME `{ ok: false, reason }` arm — reason becomes the literal
prefix `"unsupported hooks: "` + `support.debugDetail`, routed through
`hookDebugLog` exactly as the existing arms do. Add `parseMatcher` and
`checkMatcherSupportability` per RESEARCH "Code Examples" (lines
570-705). Import the two new sibling files. File grows ~180 → ~450
lines per CONTEXT D-58-03.

---

### `tests/domain/components/hooks.test.ts` (EXTEND/CREATE)

**Analog:** Phase 57 unit tests for `parseHooksConfig` (planner locates exact path; pattern is `node:test` + `node:assert/strict`, fixture-row table for each `ParsedMatcher` arm: match-all / tool-set / mcp-literal / regex / unmapped / pipe-OR edge cases per Pitfall 6).

**What changes:** Per-row fixture table for `parseMatcher` (one test per
`ParsedMatcher.kind`), plus `checkMatcherSupportability` end-to-end
tests covering each TOOL-02 trigger condition (a/b/c/d) — the
`debugDetail` string is asserted to contain the per-condition prefix
(`(a) regex...`, `(b) unmapped tool...`, etc.).

---

### `tests/shared/probe-classifiers.test.ts` (CREATE/EXTEND)

**Analog:** none in-tree for direct probe-classifiers unit coverage — current coverage flows through list/info integration tests. Use the lightweight per-function `node:test` pattern from `tests/domain/components/hooks.test.ts`.

**What changes:** Add a test that fixes a free-form note containing the
word "hooks" outside the prefix (e.g. `"contains lspServers / hooks
mentioned"`) and asserts it does NOT classify as `"unsupported hooks"` —
the tightening from `includes("hooks")` to `startsWith("unsupported
hooks:") || startsWith("malformed hooks.json:")` is the contract being
locked (Pitfall 2).

---

### `extensions/pi-claude-marketplace/shared/notify.ts` (MODIFY — REASONS rename)

**Analog:** Self, lines 72-106 (REASONS tuple).

**Current line 81:**

```typescript
  "hooks",
```

**What changes:** Single-token in-place rename:

```typescript
  "unsupported hooks",
```

Tuple length unchanged (31). The literal-union `Reason` and the
`ContentReason = Exclude<Reason, "not added">` derive automatically. Any
narrowed Reason references that mention `"hooks"` follow as compile errors
that get fixed in lockstep. JSDoc above the tuple stays — the comment
already calls out the closed-set authority pattern.

---

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (MODIFY — carve-out drop)

**Analog:** Self, lines 1478, 1486-1489.

**Current state:**

```typescript
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
// ...
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, ContentReason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};
```

**What changes (D-58-02):** Drop `"hooks"` from the set; drop the `hooks: "hooks"` entry from the Record. Result:

```typescript
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["lspServers"]);

const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, ContentReason>> = {
  lspServers: "lsp",
};
```

Update the comment block at lines 1466-1485 to drop `hooks` from the
"single-word carve-out" prose (the `lspServers → lsp` two-word seam is
now the SOLE rationale for the detection-vs-emission split). Update line
1518 doc comment "manifest-field carve-out (`contains hooks` / `contains
lspServers`)" → drop `contains hooks` half.

---

### `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` (MODIFY — second HOOK-04 site)

**Analog:** Self, lines 75-100 (`narrowResolverNotes`).

**Current line 77-99:**

```typescript
export function narrowResolverNotes(
  notes: readonly string[],
): readonly ("hooks" | "lsp" | "unsupported source")[] {
  const out: ("hooks" | "lsp" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (note.includes("hooks") && !seen.has("hooks")) {
      out.push("hooks");
      seen.add("hooks");
      continue;
    }
    // ...
  }
  return out;
}
```

**What changes (Pitfall 2):**

1. Rename return union: `"hooks" | "lsp" | "unsupported source"` → `"unsupported hooks" | "lsp" | "unsupported source"`.
2. Tighten detection: `note.includes("hooks")` → `note.startsWith("malformed hooks.json:") || note.startsWith("unsupported hooks:")`.
3. Rename emitted token: `out.push("hooks")` → `out.push("unsupported hooks")`.
4. Update JSDoc lines 68-74 to drop the "passes `hooks` verbatim" wording.

---

### `docs/output-catalog.md` (MODIFY — byte-form rename + new TOOL-02 states)

**Analog:** Self. Existing `{hooks}` byte-form occurrences:

- line 59 (prose: "Manifest field names render verbatim as the sole carve-out (`{hooks}`, `{lsp}`)") — REWORD: `{lsp}` remains the sole manifest-field carve-out; `{unsupported hooks}` is a normal 2-word reason. Drop the `{hooks}` carve-out claim entirely.
- line 136 (status table for `(unavailable)`): `carries {hooks} / {lsp} etc.` → `carries {unsupported hooks} / {lsp} etc.`
- lines 182, 301, 534, 750, 1138, 1144 (example block rows): each `⊘ <name> (unavailable) {hooks}` → `⊘ <name> (unavailable) {unsupported hooks}`.

**What changes (new states):** Add catalog states for the four TOOL-02
trigger conditions per surface (install / preview / reconcile-apply /
info / list). All four render the SAME `(unavailable) {unsupported
hooks}` bytes; the surfaces differ in marketplace-header / cascade
framing. Estimated 5-8 new states per CONTEXT.md "Claude's Discretion"
bullet. Planner chooses one-fixture-per-surface vs one-per-condition.

---

### `docs/messaging-style-guide.md` (MODIFY)

**Analog:** Self. The guide is prose that references the closed-set tuples by name. Search for `{hooks}` / `"hooks"` / `hooks reason` and re-key to `{unsupported hooks}`. The MARKERS / STATUS_TOKENS sections are untouched.

---

### `tests/architecture/catalog-uat.test.ts` (MODIFY — fixture re-key + new fixtures)

**Analog:** Self, existing fixture row shape:

```typescript
// Existing — line 272:
{ status: "unavailable", name: "delta", reasons: ["hooks"] },
// Existing — line 276:
reasons: ["hooks", "lsp"],
```

**What changes:** Mechanical rename across the 7 grep-visible rows (lines
272, 276, 507, 582, 829, 1175, 1708) and any others the planner finds at
write time via re-grep:

```typescript
// After:
{ status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
// After:
reasons: ["unsupported hooks", "lsp"],
```

Plus NEW fixture rows for each TOOL-02 trigger × surface combination
(see catalog state count above). The byte-equality assertion shape in
this test file is the per-row gate — all new rows must match the
catalog states in `output-catalog.md` byte-for-byte.

---

### `tests/architecture/notify-grammar-invariant.test.ts` (MODIFY — participation only)

**Analog:** Self (existing failed-row subject-first invariant — operator memory: `output-row-grammar-subject-first.md`). No new invariant is added; the rename means `{unsupported hooks}` now participates in the existing per-Reason iteration. If the test iterates `REASONS`, no edit is needed; if any literal `"hooks"` appears as a snapshot/fixture string, it re-keys.

---

## Shared Patterns

### Pattern A: Closed-set `as const` tuple + derived literal-union

**Source:** `shared/notify.ts` lines 72-106 (REASONS), 203-226 (STATUS_TOKENS), 237 (MARKERS), 357-374 (PLUGIN_STATUSES).
**Apply to:** `hook-events.ts` `BUCKET_A_EVENTS`, `TOOL_EVENTS`.

```typescript
export const X = ["a", "b", "c"] as const;
export type X = (typeof X)[number];
```

The architecture-test count-lock (`assert.equal(X.length, N)`) follows the `hooks-foundation.test.ts` pattern.

---

### Pattern B: Architecture-test introspection style

**Source:** `tests/architecture/hooks-foundation.test.ts` (whole file).
**Apply to:** Both new arch tests (`hooks-tool-name-map.test.ts`, `hooks-supportability.test.ts`).

Each test pins ONE invariant with a stable ID-prefixed name (`"TOOL-01: ..."`, `"D-58-06: ..."`). Imports straight from `extensions/...` (no barrel). `node:test` + `node:assert/strict` only.

---

### Pattern C: D-58-03 single-seam discriminated extension

**Source:** `domain/components/hooks.ts` lines 138-180 (existing `HookConfigParseResult` with `{ ok: false, reason }` arm).
**Apply to:** `parseHooksConfig` extension — fold supportability failure into the SAME `ok: false` arm. The resolver code in `domain/resolver.ts::applyHooksConfig` already narrows on `ok` and pushes `reason` into `partial.notes` — no resolver edits required if the prefix is right (`"unsupported hooks: ..."`).

---

### Pattern D: Detection-vs-emission seam (manifest-field-style)

**Source:** `orchestrators/plugin/install.ts` lines 1481-1489 (SNM-36 / D-24-04 prose + the paired `MANIFEST_FIELD_REASONS` set + `MANIFEST_FIELD_TO_REASON` Record).
**Apply to:** `hook-events.ts` per-non-tool-event field-name Record (e.g. `NON_TOOL_EVENT_FIELDS = { SessionStart: "reason", SessionEnd: "reason", PreCompact: null, ... }`) — the detection key (Claude event name) maps to the emission target (Pi field name | sentinel).

---

## No Analog Found

None. Every Phase 58 site has a strong in-tree analog. Closed-set table
patterns, parser discriminated-result extension, architecture-test
introspection, in-place tuple member rename, and Record-based
detection-vs-emission seams are all already established by Phases 24,
46-48, 53-57.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,shared,orchestrators}/`, `tests/architecture/`, `docs/`.
**Files scanned:** ~12 (focused — Phase 57 baseline + closed-set authorities + the two HOOK-04 second-site files).
**Pattern extraction date:** 2026-06-14.
