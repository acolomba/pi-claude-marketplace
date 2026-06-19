---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/hooks-supportability.test.ts
  - tests/architecture/hooks-tool-name-map.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/shared/probe-classifiers.test.ts
  - tests/shared/snm37-behavioral-smoke.test.ts
  - tests/shared/snm38-indent-ladder.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-06-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The matcher parser, TOOL-01 bidirectional tool-name map, BUCKET_A_EVENTS / NON_TOOL_EVENT closed sets, and TOOL-02 four-condition supportability gate land cleanly. The discriminated-union exhaustiveness pattern in `parseMatcher` + `checkMatcherSupportability` is sound, the `as const satisfies Record<PiToolName, string>` gate on `PI_TO_CLAUDE_TOOL_NAMES` correctly red-fails when a peer-dep adds an eighth Pi tool, the `LiteralToolNameArm<T>` helper correctly avoids the `Exclude<..., string>` collapse pitfall, Pitfall-1 (Pi-form lowercase rejection) and Pitfall-6 (malformed pipe-OR loud rejection) are both gate-covered by tests, and the HOOK-04 substring-tightening to four `startsWith` prefix anchors is correct in the happy path.

Four warnings worth fixing before this code ships, none reaching BLOCKER severity:

1. `narrowResolverNotes` deduplication misfires when two `hooks.json`-prefixed notes appear in the same resolver run — the second falls through to `unsupported source`, materially polluting the row's reasons brace.
2. The resolver's `malformed hooks.json:` wrapper lumps together I/O errors (e.g. EACCES on `hooks/hooks.json`) and parse/schema/supportability failures under a single prefix, so a permission-denied hooks file silently surfaces as `{unsupported hooks}` instead of `{permission denied}`.
3. `PI_CLAUDE_MARKETPLACE_DEBUG=1` routes the parse-failure detail through `console.error`, which is a direct stderr write from a `domain/` module — IL-3 only sanctions a single load-time legacy migration `console.warn`. The stub is acknowledged as a hand-off seam to OBS-01 but the lint posture (per-file ESLint override) makes the IL-3 deviation easier to forget at OBS-01 time.
4. The `closedSet?.has(rawMatcher)` optional-chain in `tryNonToolEventTrip` silently collapses two distinct failure modes (closed-set-miss vs missing-event-entry) into the same `(c) matcher value not in closed set` debugDetail, which would lie if a future contributor added a non-tool bucket-A event to `NON_TOOL_EVENT_FIELDS` but forgot the parallel `NON_TOOL_EVENT_CLOSED_SETS` entry.

The three info-level items are smaller readability/contract observations.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied to this review; structural items are folded into the narrative findings below.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `narrowResolverNotes` second-hooks-note falls through to `unsupported source`

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:88-111`
**Issue:** The deduplication ladder is structured so that when a SECOND hooks-prefixed note arrives in the same call, it skips the `unsupported hooks` arm (because `seen.has("unsupported hooks")` is true) and FALLS THROUGH to the trailing `unsupported source` arm. `tests/shared/probe-classifiers.test.ts:84-101` documents this exact behavior as intended, but the resulting row brace `{unsupported hooks, unsupported source}` is semantically wrong: every offending note is hooks-related, no source-related note ever appeared. A resolver flow that pushes two `malformed hooks.json:` notes (e.g. a future change that reports both an initial parse error AND a supportability trip) would silently leak an unrelated `{unsupported source}` reason into the user-facing row.

The intent of the `seen` Set is dedup, but the per-note loop is structured as if-elif-elif over independent buckets — a hit on bucket 1 that has already been seen does not `continue` past the other buckets, so the note falls through and the catch-all arm fires.

**Fix:** Make duplicate-bucket hits an explicit no-op instead of letting them fall through to the catch-all. For example:

```ts
for (const note of notes) {
  const isHooksNote =
    note.startsWith("hooks.json is not valid JSON:") ||
    note.startsWith("hooks.json failed schema validation:") ||
    note.startsWith("unsupported hooks:") ||
    note.startsWith("malformed hooks.json:");
  if (isHooksNote) {
    if (!seen.has("unsupported hooks")) {
      out.push("unsupported hooks");
      seen.add("unsupported hooks");
    }
    continue;
  }

  if (note.includes("lspServers")) {
    if (!seen.has("lsp")) {
      out.push("lsp");
      seen.add("lsp");
    }
    continue;
  }

  if (!seen.has("unsupported source")) {
    out.push("unsupported source");
    seen.add("unsupported source");
  }
}
```

Update `tests/shared/probe-classifiers.test.ts:84-101` to assert the corrected behavior (`["unsupported hooks"]` for two identical hooks notes, not `["unsupported hooks", "unsupported source"]`).

### WR-02: `readStandaloneHooks` conflates I/O errors and parse/supportability failures under `malformed hooks.json:`

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:646-660`
**Issue:** Every failure mode out of `readStandaloneHooks` is wrapped with the same `malformed hooks.json: ` prefix:

- An `EACCES` / `EPERM` on `readFileTextOf(ctx)(hooksPath)` falls through to `{ ok: false, reason: \`malformed hooks.json: ${err.message}\` }` (line 650-655).
- A `parseHooksConfig` parse / schema / supportability failure falls through to the SAME `malformed hooks.json: ${parsed.reason}` form (line 658-660).

Downstream, `narrowResolverNotes` matches `startsWith("malformed hooks.json:")` and emits the closed-set Reason `unsupported hooks` for ALL three. A permission-denied hooks file therefore renders as `(unavailable) {unsupported hooks}` instead of `(unavailable) {permission denied}` — the row LIES about the underlying failure class. The list / info surfaces' `narrowProbeError` ladder correctly classifies EACCES as `permission denied` when the resolver throws, but `readStandaloneHooks` swallows the read error into the resolver's structured notes pipeline, so the per-row classifier never sees the EACCES `.code`.

**Fix:** Distinguish I/O failure from parse/supportability failure inside `readStandaloneHooks`. Two options:

1. Re-throw the read error so `availableRowMessage`'s `narrowProbeError` catch path classifies it via `.code`:

   ```ts
   let raw: string;
   try {
     raw = await readFileTextOf(ctx)(hooksPath);
   } catch (err) {
     throw err; // let the outer probe-error classifier see EACCES / ENOENT
   }
   ```

2. Tag the read failure with a distinct prefix the classifier can map separately:

   ```ts
   return {
     ok: false,
     reason: `hooks.json read failed: ${errorMessage(err)}`,
   };
   ```

   Then add a `startsWith("hooks.json read failed:")` arm to `narrowResolverNotes` that maps to a closed-set Reason matching the underlying class (currently the closed set has no `hooks I/O failure` member; `permission denied` / `unreadable` are the nearest fits).

### WR-03: `hookDebugLog` writes to `console.error` from a domain module, blunting IL-3 enforcement

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:160-164`
**Issue:** CLAUDE.md IL-3 sanctions exactly one `console.warn` in this codebase — the load-time legacy migration save failure. `hookDebugLog` adds a second sanctioned direct-stderr write under `PI_CLAUDE_MARKETPLACE_DEBUG=1`. The JSDoc explicitly calls out the per-file ESLint override that permits the stub. Two concerns:

1. The per-file ESLint override (assumed to live in `eslint.config.js`) silences the `no-restricted-syntax` rule for `console.error` here, which means a future contributor expanding this file with an UNRELATED `console.error` will not be caught by lint. The override should be scoped to the `hookDebugLog` body if possible, or replaced with an inline `eslint-disable-next-line` on the `console.error` line so the surface area of the exception is minimal.
2. The JSDoc says the override "retires with the OBS-01 swap." When OBS-01 lands, the swap must remove the override. Recommend adding a `// TODO(OBS-01): remove this override and replace with shared debug-log helper` comment at the override site so the cleanup is grep-able when OBS-01 is opened.

This is a process/discipline warning, not a runtime defect. The current stub does not violate IL-2 (it does not flow through `ctx.ui.notify`) but it does expand the IL-3 "sole sanctioned direct-stderr write" surface from one to two, and the test at `tests/domain/components/hooks.test.ts:421-446` actively exercises it.

**Fix:** Two options:

1. Defer the `console.error` until OBS-01 lands the shared debug-log helper. The stub can be a no-op until then; the test at `tests/domain/components/hooks.test.ts:421-446` can be skipped with a `// TODO(OBS-01): re-enable once the debug-log helper exists` comment.
2. Keep the stub but tighten the lint scope: replace the per-file override with a single `// eslint-disable-next-line no-console -- OBS-01 hand-off seam (D-58-03)` on the `console.error` line, so a contributor adding a stray `console.error` elsewhere in the file still trips lint.

### WR-04: `tryNonToolEventTrip` collapses "closed set missing" and "closed set miss" into the same debugDetail

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:423-445`
**Issue:** The closed-set lookup uses optional chaining:

```ts
const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
if (!closedSet?.has(rawMatcher)) {
  return {
    ok: false,
    debugDetail: `(c) matcher value not in closed set for ${event}: ${rawMatcher}`,
  };
}
```

When `closedSet` is `undefined` (the event has an entry in `NON_TOOL_EVENT_FIELDS` mapping to a Claude field name but no corresponding entry in `NON_TOOL_EVENT_CLOSED_SETS`), `closedSet?.has(rawMatcher)` returns `undefined`, `!undefined` is `true`, and the function silently trips with a debugDetail that LIES about the cause — there is no closed set to be "not in," only a missing-entry programming error.

Today this is reachable only by a future contributor who adds a fifth non-tool bucket-A event to `NON_TOOL_EVENT_FIELDS` but forgets the parallel `NON_TOOL_EVENT_CLOSED_SETS` entry. The architecture tests in `hooks-supportability.test.ts` lock the current four entries by literal name, so the immediate exposure is low, but the collapse is exactly the kind of silent fall-through Pitfall 8 (matcher silent-mis-handling) warns against.

**Fix:** Split the two cases so a missing entry is loud:

```ts
const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
if (closedSet === undefined) {
  // Programming error: NON_TOOL_EVENT_FIELDS declares a matcher target
  // for this event but NON_TOOL_EVENT_CLOSED_SETS has no closed set --
  // the two tables fell out of sync.
  return {
    ok: false,
    debugDetail: `(c) missing closed-set entry for non-tool event: ${event}`,
  };
}

if (!closedSet.has(rawMatcher)) {
  return {
    ok: false,
    debugDetail: `(c) matcher value not in closed set for ${event}: ${rawMatcher}`,
  };
}

return null;
```

Add an architecture-level test in `hooks-supportability.test.ts` asserting `Object.keys(NON_TOOL_EVENT_FIELDS).filter(k => NON_TOOL_EVENT_FIELDS[k] !== null)` is a subset of `Object.keys(NON_TOOL_EVENT_CLOSED_SETS)` so the missing-entry case red-fails at lint time, not at runtime.

## Info

### IN-01: `SAFE_MATCHER_CHARS` admits `_` at the top level but Claude tool names contain none

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:225`
**Issue:** The top-level safe charset `/^[A-Za-z0-9_|-]+$/` admits underscores at the top level, but no Claude-form tool name in the TOOL-01 reverse map contains an underscore (the seven names are `Bash | Read | Edit | Write | Grep | Glob | LS`). The inline rationale on lines 218-222 says underscores are admitted so the per-token validator stays the gate — that is correct as written, but a stricter `/^[A-Za-z0-9|-]+$/` at the top level would let the parser reject underscore-bearing tokens AS REGEX one step earlier rather than letting them through to the unmapped arm. The current behavior (underscore → unmapped → `(b) unmapped tool`) and the alternate (underscore → regex → `(a) regex matcher`) both trip TOOL-02 with adequate debug detail, so this is a stylistic preference. Worth a one-line comment confirming the choice was deliberate (it is, per the inline JSDoc) but the rationale could be sharper about WHY the looser top-level charset is preferable (forward-compat for future Claude tool names containing underscores).

**Fix:** Either tighten the regex to `[A-Za-z0-9|-]+` and remove the `_` admission, or extend the inline comment to explain that admitting `_` here keeps the parser forward-compatible with hypothetical future Claude tools whose names contain underscores.

### IN-02: `MCP_LITERAL` allows underscores in server/tool segments that overlap the `mcp__server__tool` delimiter

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:242`
**Issue:** `MCP_LITERAL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/` admits underscores INSIDE the server and tool segments. Combined with the `__` delimiter, the regex is ambiguous about which `__` is the delimiter for a string like `mcp__a__b__c`. The current regex greedily matches the first `__` as the server-tool delimiter (so `a__b` is the server segment and `c` is the tool segment), which is probably fine — Claude's actual MCP grammar is `mcp__<server>__<tool>` and the parsed value stays opaque (`{kind: "mcp-literal", literal: raw}`) so the orchestrator never has to choose a split. Still, the regex shape leaves a future maintainer to figure out the ambiguity from the test case `parseMatcher("mcp__my-server-1__some_tool")` alone.

**Fix:** Either tighten the regex to explicitly disallow `__` inside segments (`/^mcp__[A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*__[A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*$/`) or add a JSDoc paragraph noting the ambiguity is intentional: the parsed value is treated as opaque, and the downstream MCP dispatcher (out of scope for v1.13) is responsible for splitting on its own canonical delimiter.

### IN-03: `hooks-supportability.test.ts:225` uses literal `"http"` for the `(d)` arm but the schema allows any string

**File:** `tests/architecture/hooks-supportability.test.ts:236-245`
**Issue:** The `(d) non-command-handler` test fires with `{ type: "http", command: "/bin/false" }`. Because the HOOK-03 schema is lenient (line 109-121 of `tests/domain/components/hooks.test.ts` documents that `{ type: "frobnicate", command: "/bin/false" }` passes the schema), this test passes for the right reason — but a future contributor reading just this test might infer that `"http"` is a Claude-handler-type literal that has special meaning. A more obviously-unsupported handler type (e.g. `"frobnicate"`, `"never-supported"`) would convey the closed-set discipline more clearly.

**Fix:** Replace `"http"` with `"frobnicate"` or another obviously-synthetic handler type, and update the assertion message to read `expected "(d) non-command-handler" prefix on synthetic handler type`. The test contract is unchanged; only the reader's intuition about what's being asserted improves.

---

_Reviewed: 2026-06-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
