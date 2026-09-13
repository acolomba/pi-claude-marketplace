# Phase 2: Containment and Input Safety - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 12 intended source/test files
**Analogs found:** 12 / 12

All analog paths below are current, git-tracked repository files. Phase 2 should extend these owners and direct tests rather than introduce parallel policies.

## File Classification

| New/Modified File                                                     | Role                      | Data Flow                   | Closest Analog                                              | Match Quality |
| --------------------------------------------------------------------- | ------------------------- | --------------------------- | ----------------------------------------------------------- | ------------- |
| `extensions/pi-claude-marketplace/bridges/mcp/types.ts`               | model                     | transform                   | `extensions/pi-claude-marketplace/bridges/mcp/types.ts`     | exact owner   |
| `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`               | service                   | file-I/O / transform        | `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`   | paired exact  |
| `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`             | service                   | file-I/O / transform        | `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`     | paired exact  |
| `tests/bridges/mcp/types.test.ts`                                     | test                      | transform                   | `tests/bridges/mcp/types.test.ts`                           | exact owner   |
| `tests/bridges/mcp/stage.test.ts`                                     | test                      | file-I/O                    | `tests/bridges/mcp/unstage.test.ts`                         | paired exact  |
| `tests/bridges/mcp/unstage.test.ts`                                   | test                      | file-I/O                    | `tests/bridges/mcp/stage.test.ts`                           | paired exact  |
| `extensions/pi-claude-marketplace/shared/path-safety.ts`              | utility                   | file-I/O / transform        | `extensions/pi-claude-marketplace/shared/path-safety.ts`    | exact owner   |
| `tests/shared/path-safety.test.ts`                                    | test                      | file-I/O                    | `tests/shared/path-safety.test.ts`                          | exact owner   |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`       | service                   | file-I/O / request-response | `extensions/pi-claude-marketplace/domain/resolver.ts`       | flow match    |
| `extensions/pi-claude-marketplace/bridges/commands/stage.ts`          | service                   | file-I/O / batch            | `extensions/pi-claude-marketplace/bridges/skills/stage.ts`  | role match    |
| `extensions/pi-claude-marketplace/persistence/locations.ts`           | utility                   | transform / file-I/O        | `extensions/pi-claude-marketplace/persistence/config-io.ts` | role match    |
| `extensions/pi-claude-marketplace/index.ts` and `tests/index.test.ts` | root event handler + test | event-driven                | same files' existing NFR-2 boundary cases                   | exact owner   |

## Pattern Assignments

### MCP raw JSON boundary

**Apply to:** `bridges/mcp/types.ts`, `bridges/mcp/stage.ts`, `bridges/mcp/unstage.ts` and their direct tests.

**Raw type owner:** `extensions/pi-claude-marketplace/bridges/mcp/types.ts:17-20`

```typescript
export interface RawMcpDoc {
  readonly mcpServers?: Record<string, unknown>;
  readonly [extra: string]: unknown;
}
```

Change only the raw field to `unknown`. Keep validated server maps such as `StageMcpInput.servers` as `Record<string, unknown>` (`types.ts:39-53`). This preserves the repository's distinction between untrusted parsed JSON and validated inputs.

**Closest shared classifier pattern:** `extensions/pi-claude-marketplace/bridges/mcp/parse.ts:29-55`

```typescript
export function parseMcpServers(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "string") {
    throw new TypeError(/* stable explanation */);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object mapping server names to entries.`);
  }
  const obj = value as Record<string, unknown>;
  // validate entries, then return obj
  return obj;
}
```

Copy the narrowing shape, not this function's unrelated per-server validation policy. The Phase 2 helper must classify exactly three raw states: missing (clean no-op), object map (continue), present malformed (typed fail-closed result/error). Both stage and unstage must call the same helper.

**Stage prepare-before-commit atomicity:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:211-298`, then `306-315`

```typescript
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const { doc, malformed } = await readScopedDoc(input.locations.mcpJsonPath);
  const existing = getMcpServers(doc);
  // compute result and _nextDoc only; no write
  return { kind: "staged", locations, stagedNames, result, _nextDoc: next };
}

export async function commitPreparedMcp(prepared: PreparedMcpStaging) {
  if (prepared.kind === "noop") return prepared.result;
  await atomicWriteJson(prepared.locations.mcpJsonPath, prepared._nextDoc);
  return prepared.result;
}
```

Classify before partition/enumeration and before `_nextDoc` is eligible for commit. A malformed outcome must never reach `Object.entries`, collision work, or `atomicWriteJson`.

**Unstage read-before-write ordering:** `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:36-94`

```typescript
const text = await readFile(locations.mcpJsonPath, "utf8");
const parsed: unknown = JSON.parse(text);
const doc = parsed as RawMcpDoc;
const existingValue = doc.mcpServers;
// classify here, before Object.entries(existing) and before atomicWriteJson
```

The current code only checks `undefined` and arrays. With truthful `unknown`, the shared classifier prevents `null` enumeration throws and string character-key enumeration.

### Path normalization and real-filesystem containment

**Owner:** `extensions/pi-claude-marketplace/shared/path-safety.ts:9-39,46-101,103-146`

Preserve `PathContainmentError` and `SymlinkRefusedError`, including their exact observable fields. Add a production-used `LexicalTraversalError extends PathContainmentError` for raw child components exactly equal to `..`; keep normalized parent/child fields but override the inherited escape message with exact traversal-forbidden wording. Decide refusal from raw segments before normalization or filesystem inspection, then normalize refused operands only for diagnostics and throw without containment/walking. For accepted spellings, the same normalized parent and child values must drive `path.relative`, error fields, segment construction, and traversal.

Current core shape (`path-safety.ts:77-100`):

```typescript
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
  if (!isPathInside(parent, child)) {
    throw new PathContainmentError(parent, child, label);
  }
  const relative = path.relative(parent, child);
  const segments = relative === "" ? [] : relative.split(path.sep);
  let current = parent;
  for (const segment of segments) {
    current = path.join(current, segment);
    const canContinue = await assertNoSymlinkSegment(parent, child, label, current);
    if (!canContinue) return;
  }
}
```

Do not replace the per-component `lstat` walk with a leaf-only `realpath` check. The required behavior includes an existing intermediate symlink and a missing future leaf. Preserve `ENOENT` as a successful stop (`path-safety.ts:121-135`).

**Direct owner tests:** `tests/shared/path-safety.test.ts:118-149,152-203,240-303`

Copy these patterns:

- case-owned `mkdtemp` roots with `t.after(() => fs.rm(...))`;
- exact projection of `name`, `message`, `parent`, `child`, `linkPath`, and `linkTarget`;
- real `fs.symlink` fixtures for first, intermediate, and final walked segments;
- explicit lstat walk-order checks for existing paths and stop-at-first-missing behavior.

Add a real `root/a` symlink plus raw `root/a/../b` case that asserts the complete LexicalTraversalError class/name/message/normalized fields and proves the outside bytes/tree unchanged. Keep a separate redundant-`.` acceptance case and normalized outside-path cases. Treat pre-normalization/pre-filesystem ordering as a source-review invariant: without global patching this real-filesystem test cannot claim to observe zero lstat/read calls. Do not claim the resolved component walk can detect the erased `a` segment.

**Live consumers to verify, not fork:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:236-243` resolves a manifest source then calls the chokepoint before discovery. Its direct test is `tests/orchestrators/plugin/info.test.ts`.
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts:193-210` checks staging and target paths before reading source content. Its direct test is `tests/bridges/commands/stage.test.ts`.
- `extensions/pi-claude-marketplace/persistence/locations.ts:216-276` composes state-derived paths after `assertSafeName`, then calls the chokepoint. Its direct test is `tests/persistence/locations.test.ts`.
- Other tracked callers found in `domain/resolver.ts`, `shared/fs-utils.ts`, bridge stage/unstage modules, hook routing, config I/O, and async-rewake PID persistence inherit the fix. Audit them for changed behavior, but add direct consumer regressions only where Phase 2 behavior changes.

The info consumer is the lenient-read proof: containment failure is intentionally narrowed to an unreadable row by its existing outer error classification (`info.ts:220-243`), not allowed to read beyond the marketplace root.

### Root `resources_discover` containment and recovery

**Owner:** `extensions/pi-claude-marketplace/index.ts:64-137`

The existing boundary already establishes the ordering to retain:

1. deferred project hydrate (`69-76`);
2. reconcile with isolated last-ditch notification (`84-101`);
3. plugin PATH recomputation with one try/catch per skipped-scope notification (`110-127`);
4. aggregate discovery (`129-136`).

The missing pattern is a final containment around step 4. Catch aggregate discovery failure at this callback boundary and return the stable empty value:

```typescript
{ skillPaths: [], promptPaths: [] }
```

Do not roll back or repeat reconcile/PATH work that completed earlier in the same invocation. Keep all state invocation-local so the next `/reload` executes the full sequence again after a transient failure.

**Independent notification pattern:** `index.ts:110-124`

```typescript
for (const skip of pathResult.skipped) {
  try {
    makeRawNotifyFn(ctx)(messageFor(skip), "warning");
  } catch (notifyErr) {
    hookDebugLog(`plugin PATH warning notify failed: ${errorMessage(notifyErr)}`, "env");
  }
}
```

Keep the try/catch inside the loop. A failed first notification must not suppress a later scope warning or escape the callback.

**Direct lifecycle tests:** `tests/index.test.ts:197-218,633-811`

Use `createHermeticScope` for isolated event cwd, home, process cwd, environment save/restore, and cleanup. Reuse `EMPTY_DISCOVERY` (`tests/index.test.ts:109`) for exact output. The existing notification-refusal tests at `762-811` show how to record every attempted notification while the host throws.

Add one test that invokes the same registered discover callback twice: first with a transient aggregate-discovery failure, then after removing the failing filesystem condition. Assert after call one: exact empty result, exact persisted reconcile/PATH state, and exact notification attempts. Assert after call two: normal discovery output and no poisoned module or callback state.

### Hermetic filesystem and exact-byte verification

**Fixture pattern:** `tests/bridges/mcp/stage.test.ts:18-25` and `tests/index.test.ts:185-218`

```typescript
const cwd = await mkdtemp(path.join(tmpdir(), prefix));
t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
```

For lifecycle tests, also isolate `HOME`, `PI_CODING_AGENT_DIR`, process cwd, and PATH-related variables through `createHermeticScope`. Do not patch process-global filesystem functions for failures that a real temporary directory, file, permission/shape, or symlink can express.

**Exact committed bytes:** `tests/bridges/mcp/stage.test.ts:525-578`

Construct the complete expected JSON string, including indentation and trailing newline, then use `assert.strictEqual(storedBytes, expectedBytes)`.

**Exact no-write bytes and identity:** `tests/bridges/mcp/unstage.test.ts:315-365`

Read bytes and bigint stat metadata before and after. Assert exact bytes plus inode, size, `mtimeNs`, and `ctimeNs`. Use this for malformed stage and unstage refusal cases so a write-and-restore implementation cannot pass.

## Shared Patterns

### Stable typed outcomes

Use discriminated, readonly result shapes in `bridges/mcp/types.ts`, following `PreparedMcpNoop`/`PreparedMcpStaged` (`types.ts:79-104`). Freeze array members as existing stage and unstage results do. Tests should compare the complete public result, not only the error message.

### Error rendering and containment

Use `errorMessage` for unknown thrown values (`index.ts:12,93-96,122,126`; `unstage.ts:22,56-59`). Catch only at the public lifecycle boundary or when converting to an explicitly typed public outcome. Do not swallow `PathContainmentError` inside the shared owner.

### Atomic writes

Keep disk mutation behind `atomicWriteJson`. Validate/classify before it. Stage's prepare/commit split is the canonical no-write-before-commit pattern; unstage's early returns are the canonical quiet no-op pattern.

## Current Test Conflicts That Must Change

| Current expectation                                                              | Location                                                        | Phase 2 disposition                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Array-valued stored `mcpServers` is treated as empty, then replaced during stage | `tests/bridges/mcp/stage.test.ts:203-230`                       | Replace with typed fail-closed outcome and exact unchanged bytes/metadata. |
| Array-valued stored `mcpServers` is a clean unstage no-op                        | `tests/bridges/mcp/unstage.test.ts:319-322,333-365`             | Replace with shared typed malformed outcome; bytes remain unchanged.       |
| String-valued stored `mcpServers` is a clean unstage no-op                       | `tests/bridges/mcp/unstage.test.ts:323-326,333-365`             | Replace with shared typed malformed outcome; bytes remain unchanged.       |
| `getMcpServers` assumes every non-array present value is a record                | `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:92-100`  | Remove or route through the shared unknown-value classifier.               |
| Unstage enumerates every present non-array value                                 | `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:65-83` | Classify `null`, strings, arrays, and other primitives before enumeration. |

Missing `mcpServers` remains a clean no-op. Top-level malformed-document policy is not automatically changed: Phase 2 is narrowly about the present malformed `mcpServers` field.

## Scope Exclusions

- Do not revive the historic repaired MCP-home escape (`AUDIT-007`).
- Do not expand into general JSON schema cleanup, unrelated malformed top-level documents, per-server entry normalization, or MCP reference resolution.
- Do not redesign reconciliation, discovery aggregation, hooks hydration, or plugin PATH architecture.
- Do not create per-consumer containment helpers or policies.
- Do not pull assertion-strength, coverage, gate, auth, naming, or hermeticity programs from Phases 3-8 into this phase.
- Do not design or perform the Phase 6 module splits. Phase 2 changes the smallest existing owners and their direct tests.

## No Analog Found

None. Every intended change has a current tracked owner or direct paired analog.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/**`, `tests/**`, Phase 2 context, roadmap, and requirements
**Primary search:** CodeGraph symbol/call-path exploration before repository text search
**Tracked-source gate:** all named source and test paths verified through `git ls-files`
**Pattern extraction date:** 2026-09-05
