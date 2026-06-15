# Phase 62: `asyncRewake` Registry & Background-Spawn — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 7 (3 NEW + 4 MODIFIED)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` (NEW) | bridge-service / spawn-and-registry | event-driven / spawn + exit-handler | `bridges/hooks/dispatch-exec.ts` | exact (sole sibling site holding `node:child_process`; sync vs async sibling) |
| `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts` (NEW) | persistence-leaf / atomic JSON I/O | request-response (read/write) | `shared/atomic-json.ts` + `persistence/state-io.ts` pattern | exact (helper-direct reuse) |
| `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts` (NEW) | pure-leaf utility / circular buffer | transform (write/read bytes) | None in codebase | no-analog — use Node `Buffer.allocUnsafe(N)` + write-index pointer (research § Pattern: Ring-buffer overflow) |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (MOD) | dispatcher seam | request-response | self (Phase 60 sync body, unchanged below the new arm) | exact |
| `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (MOD) | factory / lifecycle | event-driven (factory-entry) | self (`ensureSharedDataDir` factory-entry call pattern; `liveEpoch` bump) | exact |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` (MOD) | schema/type | data-shape | self (existing HOOK-03 `statusMessage`/`once`/`async`/`shell`/`args` rows) | exact |
| `tests/architecture/hooks-async-rewake.test.ts` (NEW) | architecture test | inline truth-table | `tests/architecture/hooks-exec.test.ts` + `hooks-if-field.test.ts` | exact (Phase 60/61 sibling pattern) |
| `tests/architecture/no-shell-out.test.ts` (MOD) | architecture test (closed-set whitelist) | data-shape (closed-set assertion) | self (2 → 3 atomic amendment per D-58-01) | exact |

## Pattern Assignments

### `bridges/hooks/async-rewake/registry.ts` (NEW; bridge-service / spawn + exit-handler)

**Analog:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (507 LoC sync sibling)

**Imports pattern** (`dispatch-exec.ts:51-75`):

```typescript
import { spawn } from "node:child_process";
import path from "node:path";

import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { installTimerLadder } from "./exec-timer.ts";
import { buildTranslationContext, type TranslationContext } from "./translation-context.ts";

import type { RoutingEntry } from "./event-router.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
```

Note: `registry.ts` lives one directory deeper, so relative imports become `../../../` (three levels) instead of `../../`.

**Module-state pattern** (mirror the `routingTable` / `parsedConfigCache` cells in `event-router.ts:120-130`):

```typescript
const asyncRewakeRegistry = new Map<string, AsyncRewakeEntry>();
```

**Spawn-options pattern** (copy from `dispatch-exec.ts:347-352` verbatim — same stdio + cwd + env shape; only diff is `detached: false` made explicit and the async branch does NOT await close):

```typescript
const child = activeSpawn(plan.command, [...plan.args], {
  cwd: env.CLAUDE_PROJECT_DIR,
  env,
  stdio: ["pipe", "pipe", "pipe"],
  shell: plan.shell,
  detached: false,                              // EXEC-05 explicit (parent process group)
});
```

**Env-prep pattern** (mirror `dispatch-exec.ts:275-303` `prepareEnv` but ADD the `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` marker env after the existing `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` / `CLAUDE_ENV_FILE` block; preserve the `assertPathInside` containment guard for every derived path per NFR-10).

**`planSpawn` exec-form vs shell-form pattern** (reuse the EXEC-04 discriminator at `dispatch-exec.ts:309-336`):

```typescript
function planSpawn(entry: RoutingEntry): SpawnPlan {
  const argsField = entry.handlerDecl.args;
  if (Array.isArray(argsField)) {
    return { command, args: argsField.map(coerce), shell: false };
  }
  return { command, args: [], shell: typeof shellField === "string" ? shellField : true };
}
```

**Timer ladder reuse** (D-62-03 = EXEC-02 verbatim; `dispatch-exec.ts:360`):

```typescript
const timeoutMs = typeof entry.handlerDecl.timeout === "number"
  ? entry.handlerDecl.timeout : DEFAULT_TIMEOUT_MS;  // 600_000
const ladder = installTimerLadder(child, timeoutMs);
// cancel inside onChildExit: ladder.cancel();
```

**EPIPE stdin defense** (lines from `dispatch-exec.ts` step 7 docstring; attach `stdin.on("error", ...)` BEFORE `stdin.end(payload)` so a fast-exit child cannot escape an unhandled exception).

**Never-throws / exit-handler error funneling** (`dispatch-exec.ts:157-160`, `:429-434`):

```typescript
try {
  // spawn + register
} catch (err) {
  hookDebugLog(`async-rewake: spawn threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`);
  return;                                       // fire-and-forget; no result to reducer
}

child.once("error", (err) => {
  hookDebugLog(`async-rewake: child error (${entry.pluginId}): ${errorMessage(err)}`);
});
```

**Captured-epoch zombie defense** (`event-router.ts:182-184`, `:584-585`):

```typescript
import { currentEpoch } from "../event-router.ts";
// ...
const capturedEpoch = currentEpoch();
// inside onChildExit:
if (entry.capturedEpoch !== currentEpoch()) {
  hookDebugLog(`async-rewake: stale exit dispatchId=${dispatchId}`); return;
}
```

**`dispatchId` source** — `crypto.randomUUID()` (Discretion). New import:

```typescript
import { randomUUID } from "node:crypto";
```

**Discriminated `OutcomeKind` with `assertNever` arm** (NFR-7; established pattern reused from `bridges/hooks/exec-result.ts` consumers — use a small in-function discriminator: `"inject" | "silent" | "noop"`).

**Whitelist comment header** (mirror `dispatch-exec.ts:43-49` block; document that this is sanctioned site #3 and points to `no-shell-out.test.ts`).

---

### `bridges/hooks/async-rewake/pid-table.ts` (NEW; persistence-leaf / atomic JSON)

**Analog:** `extensions/pi-claude-marketplace/shared/atomic-json.ts` (helper-direct reuse — do NOT re-implement)

**Helper-call pattern** (`atomic-json.ts:24-31`):

```typescript
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../../../shared/atomic-json.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { assertPathInside } from "../../../shared/path-safety.ts";

export async function writePidTable(
  loc: ScopedLocations,
  entries: readonly PidTableEntry[],
): Promise<void> {
  const filePath = path.join(loc.dataRoot, "_shared", "async-rewake-pids.json");
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json write");
    await atomicWriteJson(filePath, { version: 1, entries: [...entries] });
  } catch (err) {
    hookDebugLog(`async-rewake: pid-table write failed: ${errorMessage(err)}`);
  }
}
```

**Read-with-ENOENT-returns-empty pattern** (NFR-3 fail-clean; see RESEARCH.md § "Pattern: PID-table & orphan reap" for the typebox-free runtime narrowing `parsed.version === 1 && Array.isArray(parsed.entries)`).

**Containment pattern** (`assertPathInside(loc.dataRoot, filePath, "...")`) is mandatory before every read/write — same call signature as in `dispatch-exec.ts:282`, `:285`, `:296`.

**`_shared` mkdir-p is already done** at factory time by `event-router.ts:552-562::ensureSharedDataDir` (D-60-06). PID-table writes do NOT need to mkdir; `atomicWriteJson` does `mkdir(dirname, { recursive: true })` defensively too.

---

### `bridges/hooks/async-rewake/ring-buffer.ts` (NEW; pure-leaf / transform)

**Analog:** None in the codebase. Standard fixed-capacity circular Buffer.

**Pattern source:** RESEARCH.md § "Pattern: Ring-buffer overflow with `_truncated` marker" (verbatim sketch ~70 LoC). Key primitives:

```typescript
class RingBuffer {
  private readonly buf: Buffer = Buffer.allocUnsafe(capacity);
  private writeIndex = 0;
  private filled = 0;
  private truncated = false;

  write(chunk: Buffer): void { /* two-segment copy on wrap; set truncated=true on overflow */ }
  read(): { text: string; truncated: boolean } { /* concat head + tail; utf8 decode */ }
}
```

**UTF-8 boundary caveat to document inline** (per RESEARCH.md § "UTF-8 boundary caveat"): wrap-point may produce a single `U+FFFD` glyph; do NOT reach for `StringDecoder` — `_truncated: true` already signals the loss.

**Caps as `as const`:**

```typescript
const STDERR_CAP_BYTES = 64 * 1024;
const STDOUT_CAP_BYTES = 1024 * 1024;
```

---

### `bridges/hooks/dispatch-exec.ts` (MODIFIED; 1-3 LoC pre-spawn delegation arm)

**Analog:** self — the existing `dispatchHookExec` body at `:146-161`.

**Insertion point** (top of `dispatchHookExec`, BEFORE the existing `try` block):

```typescript
export async function dispatchHookExec(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
): Promise<HookExecResult> {
  // EXEC-05 / HOOK-06 — async-rewake delegation (D-62-01).
  if (entry.handlerDecl.asyncRewake === true) {
    await spawnAndRegister(entry, event, ctx);
    return { kind: "noop" };
  }

  try {
    const transCtx = buildTranslationContext(ctx);
    // ...existing Phase 60 body unchanged...
  }
}
```

**Import addition:**

```typescript
import { spawnAndRegister } from "./async-rewake/registry.ts";
```

**Pin contract:** the existing whitelist-comment header at `dispatch-exec.ts:43-49` ("the second of exactly TWO sanctioned ... import sites") needs a one-line update to "second of exactly THREE" + name the third site. This rewrite lands in the SAME commit as `registry.ts` per D-58-01 atomic-supersession.

---

### `bridges/hooks/event-router.ts` (MODIFIED; orphan-reap factory call)

**Analog:** self — the existing `registerHooksBridge` body at `:580-614` (specifically the `ensureSharedDataDir(loc)` call at `:603` is the structural mirror for the new `reapOrphans(loc)` call).

**Insertion point** (inside the `for (const { state, loc } of hydrated)` loop at `:588`, alongside `ensureSharedDataDir`):

```typescript
for (const { state, loc } of hydrated) {
  rebuildRoutingTables(state, loc);
  if ((routingTable.get("SessionStart") ?? []).length > 0) {
    await ensureSharedDataDir(loc);
  }
  // EXEC-05 / D-62-05: SIGKILL prior-cycle in-memory children, then reap
  // persisted orphans from a crashed prior process.
  shutdownInMemoryChildren();                    // walks asyncRewakeRegistry.values()
  await reapOrphans(loc);                        // reads pid-table, kill 0 + marker check
}
```

**Order constraint:** `shutdownInMemoryChildren` MUST run before `reapOrphans` (in-memory walk only sees children from the same process; the persisted-file scan picks up crash-leftovers). Both run AFTER `liveEpoch` bump (already at `:584`) so any stale exit callbacks fall through the captured-epoch guard.

**Import additions:**

```typescript
import { reapOrphans, shutdownInMemoryChildren } from "./async-rewake/registry.ts";
```

**Step-order docstring** at `:567-579` needs a one-line addendum mentioning step 1.5 (orphan reap between hydrate and `pi.on` registration).

---

### `domain/components/hooks.ts` (MODIFIED; 3 schema fields + 3 interface fields)

**Analog:** self — the existing `statusMessage` / `once` / `async` / `shell` / `args` rows at `:113-117` (interface) and `:156-160` (schema).

**Interface addition** (after `args?: unknown;` at `:117`):

```typescript
export interface HookHandlerEntry {
  // ... existing fields ...
  args?: unknown;
  // HOOK-06 / EXEC-05 admission (HOOK-03 lenient stance; runtime narrowing
  // lives in bridges/hooks/async-rewake/).
  asyncRewake?: unknown;
  rewakeMessage?: unknown;
  rewakeSummary?: unknown;
  [k: string]: unknown;
}
```

Note: per the existing HOOK-03 contract (line 118-119 comment), `[k: string]: unknown` already admits these fields silently; the three explicit declarations make the contract intent self-evident in the type and let the bridge runtime call `entry.handlerDecl.asyncRewake` without an index-signature widening.

**Schema addition** — the field family lives at the HANDLER level (per RESEARCH.md and upstream contract), so they go on `HOOK_HANDLER_SCHEMA` at `:122-144`, NOT on `HOOK_ENTRY_SCHEMA`. Add inside the `properties` block at `:125-133`:

```typescript
properties: {
  type: { type: "string" },
  command: { type: "string" },
  if: { type: "string" },
  // HOOK-06 / EXEC-05 — schema admission is type-loose per HOOK-03;
  // runtime narrowing (typeof boolean / string guards) lives in the bridge.
  asyncRewake: {},   // accept any shape
  rewakeMessage: {},
  rewakeSummary: {},
},
```

(JSON Schema empty-object means "any value accepted." Pattern matches the existing tolerant-parsing precedent. Verify against the Phase 61 `if` field addition at the same property block.)

**Rationale matches HOOK-03 lenient stance** documented at `:111-119` ("HOOK-03 tolerated additive extensions (silently accepted; semantics live in the future EXEC layer, not here)").

---

### `tests/architecture/hooks-async-rewake.test.ts` (NEW)

**Analog:** `tests/architecture/hooks-exec.test.ts` (Phase 60) + `tests/architecture/hooks-if-field.test.ts` (Phase 61)

**File-header docstring shape** (from `hooks-exec.test.ts:1-23`): list each "Block" letter, one block per invariant. Example structure for Phase 62:

```text
// Architecture-level invariant pins for the async-rewake bridge layer
// (HOOK-06 + EXEC-05 + D-62-01..05).
//
//   - Block A: D-62-01 — dispatch-exec.ts delegates to spawnAndRegister
//     when entry.handlerDecl.asyncRewake === true; reducer sees {kind:"noop"}.
//   - Block B: EXEC-05 spawn options — { detached:false, stdio:["pipe","pipe","pipe"] }
//     with PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH env marker set on every child.
//   - Block C: exit code 2 → pi.sendMessage({customType:"claude-hook-rewake",
//     display:false, deliverAs: idle?"nextTurn":"followUp"}); non-2 silent.
//   - Block D: D-62-04 ring buffer — overflow drops oldest bytes; truncated
//     flag injected as "[…truncated]" prefix in payload body.
//   - Block E: D-62-05 — async-rewake-pids.json atomic write on
//     spawnAndRegister + exit; ENOENT read returns []; marker mismatch on
//     Linux skips SIGKILL with debug-log.
//   - Block F: D-62-03 — EXEC-02 timer ladder inherited; SIGTERM → 5s → SIGKILL.
//   - Block G: D-59-03 captured-epoch — stale child no-ops on exit if
//     currentEpoch() drifted.
//   - Block H: D-62-02 — declaration-order interleave: sync entries see
//     mutations; async entries spawn against post-mutation state.
```

**Imports + mock-spawn fixtures** copy from `hooks-exec.test.ts:25-110` (`makeChild`, `SpawnCall`, `_setSpawnForTest` test seam). The async-rewake registry needs a parallel `_setSpawnForTest` seam pattern (the dispatch-exec mock spawn can be reused if `spawnAndRegister` calls through the same `activeSpawn` indirection — Claude's Discretion).

**`pi.sendMessage` mock** — the integration tests need to capture `sendMessage` calls. Build a mock `ExtensionContext` with `sendMessage: spy` and `isIdle: () => boolean` and assert against captured args.

**`hooks-if-field.test.ts`** is the closer pattern for inline truth-table fixtures (1290 LoC of fixture rows); copy its `as const satisfies Record<...>` closed-set fixture shape for Phase 62's spawn-options / exit-code / ring-buffer assertions.

---

### `tests/architecture/no-shell-out.test.ts` (MODIFIED; closed-set 2 → 3 amendment)

**Analog:** self — current file at `tests/architecture/no-shell-out.test.ts:57-60` and `:112-117`.

**Change 1 — whitelist set** (`:57-60`):

```typescript
const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
]);
```

**Change 2 — sibling assertion** (`:112-117`):

```typescript
test("whitelist: exactly three files may import node:child_process", () => {
  assert.deepEqual([...ALLOWED_CHILD_PROCESS_FILES].sort(), [
    "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
    "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
  ]);
});
```

**Change 3 — docstring header** (`:40-49`): add a third paragraph paralleling the existing EXEC-01..04 paragraph, explaining EXEC-05 / HOOK-06 / D-62-01:

```text
EXEC-05 / HOOK-06 / D-62-01 third sanctioned site:
The async-rewake registry at
extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts is
the bridge-owned background-spawn site for asyncRewake: true hook entries.
Spawn options diverge from the sync EXEC-01..04 path (detached:false +
fire-and-forget exit handler watching for code 2 → pi.sendMessage
injection); the OS-level concern lives here because no pure-JS equivalent
exists for arbitrary plugin-supplied commands AND the registry owns
in-memory + persisted (PID table) state for /reload-safe SIGKILL.
Adding a FOURTH file requires the same edit-here + edit-sibling-assertion
discipline.
```

**Atomic-supersession requirement (D-58-01):** All three changes above MUST land in the SAME commit as the first source file that adds `import { spawn } from "node:child_process"` in `async-rewake/registry.ts`. The planner places this in the very first task that creates `registry.ts`.

## Shared Patterns

### Containment guard (NFR-10)
**Source:** `extensions/pi-claude-marketplace/shared/path-safety.ts::assertPathInside`
**Apply to:** every derived path in `registry.ts` (env var values, PID-table path) and `pid-table.ts`
**Excerpt (call pattern from `dispatch-exec.ts:282`):**

```typescript
await assertPathInside(loc.extensionRoot, pluginRoot, "CLAUDE_PLUGIN_ROOT");
```

### Debug-log sole-sink (OBS-01 / IL-2)
**Source:** `extensions/pi-claude-marketplace/shared/debug-log.ts::hookDebugLog`
**Apply to:** every error / fall-open / silent-completion / sendMessage-throw / marker-skip / ring-buffer-fill arm in `registry.ts` and `pid-table.ts`. NEVER `console.error`, `process.stderr.write`, or `ctx.ui.notify` for runtime debug.
**IL-2 EXEMPTION:** the single `ctx.ui.notify(rewakeSummary, "info")` in the exit handler — upstream-mandated UI surface; pin in architecture test as the ONLY notify call from the async-rewake path.

### Atomic JSON write (NFR-1)
**Source:** `extensions/pi-claude-marketplace/shared/atomic-json.ts::atomicWriteJson` (write-file-atomic wrapper)
**Apply to:** every write of `async-rewake-pids.json` in `pid-table.ts`. No hand-rolled tmp+rename.

### Captured-epoch zombie defense (D-59-03)
**Source:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:182-184::currentEpoch`
**Apply to:** every async-rewake `onChildExit` BEFORE calling `pi.sendMessage` or `ctx.ui.notify`. Mismatch → `hookDebugLog` + early return.

### Never-throws contract
**Source:** `dispatch-exec.ts:38-41` docstring + `:157-160` outer try/catch
**Apply to:** `spawnAndRegister` (catches spawn-time throws), `onChildExit` (try/catch around `sendMessage` and `notify`), `reapOrphans` (try/catch around `process.kill`).

### Closed-set whitelist via `as const satisfies` (architecture-test convention)
**Source:** `tests/architecture/no-shell-out.test.ts:57-60` + RESEARCH note
**Apply to:** Phase 62's `EXACTLY_THREE` whitelist amendment AND any new closed-set test fixtures in `hooks-async-rewake.test.ts`.

### Discriminated `assertNever` exhaustion (NFR-7)
**Source:** existing project convention; consumed by `bridges/hooks/exec-result.ts` reducer arms
**Apply to:** the in-function `OutcomeKind = "inject" | "silent" | "noop"` arm in `onChildExit`; final `assertNever(outcome)` pins exhaustiveness.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `bridges/hooks/async-rewake/ring-buffer.ts` | pure-leaf circular Buffer | No fixed-capacity ring buffer exists in the project. Use Node `Buffer.allocUnsafe(N)` + write-index pointer (RESEARCH.md § "Pattern: Ring-buffer overflow" provides the verbatim ~70 LoC sketch). Standalone unit-testable surface; isolating it from `registry.ts` keeps the `node:child_process` whitelist tight to the spawn site only. |

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/bridges/hooks/**`
- `extensions/pi-claude-marketplace/shared/**`
- `extensions/pi-claude-marketplace/domain/components/hooks.ts`
- `extensions/pi-claude-marketplace/persistence/**` (for state-io / atomic-write conventions)
- `tests/architecture/**`

**Files scanned (read-only):**
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (507 LoC; full)
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (668 LoC; targeted via grep + reads at `:540-650`)
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` (717 LoC; targeted via grep + read at `:95-170`)
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` (31 LoC; full)
- `tests/architecture/no-shell-out.test.ts` (117 LoC; full)
- `tests/architecture/hooks-exec.test.ts` (622 LoC; header + fixtures at `:1-90`)
- `tests/architecture/hooks-if-field.test.ts` (1290 LoC; structure only via wc)

**Pattern extraction date:** 2026-06-15
