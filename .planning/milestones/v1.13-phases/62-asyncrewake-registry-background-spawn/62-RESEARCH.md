# Phase 62: `asyncRewake` Registry & Background-Spawn - Research

**Researched:** 2026-06-15
**Domain:** Bridge-owned detached child-process registry with fire-and-forget exit-code-2 model-context injection (HOOK-06 / EXEC-05)
**Confidence:** HIGH

## Summary

Phase 62 adds a single bridge-owned module family under
`bridges/hooks/async-rewake/` that wraps `node:child_process.spawn` in
detached-but-same-process-group fashion, holds the live child in an
in-memory `Map<dispatchId, AsyncRewakeEntry>` keyed by a fresh UUID, watches
each child for exit code 2, and on exit-2 injects (`rewakeMessage` prefix
followed by `\n\n` followed by stderr-or-stdout-if-stderr-empty) into Pi's
model context via `pi.sendMessage(..., { deliverAs: ctx.isIdle() ?
"nextTurn" : "followUp" })`. `dispatch-exec.ts` gains a single pre-spawn
delegation arm that fires BEFORE the existing sync EXEC-01..04 body; the
sync arm is unchanged. Phase 60's EXEC-02 timer ladder (600s default,
handler-override, SIGTERM → 5s → SIGKILL) is reused verbatim. A persisted
`async-rewake-pids.json` table under `<dataRoot>/_shared/` (atomic-written
via the existing `atomicWriteJson` helper) carries `{pid, dispatchId,
plugin, spawnedAt}` records across process crashes; the
`registerHooksBridge` factory-entry block scans the table on every load,
probes liveness via `kill 0`, verifies ownership via `/proc/<pid>/environ`
(Linux only, soft-skip on macOS / read failure), and SIGKILLs surviving
owned PIDs. The closed-set `no-shell-out.test.ts` whitelist is amended from
TWO to THREE sites atomically with the first commit that creates
`registry.ts`. All claims in this research are verified against the live
codebase, the Pi peer-dep type definitions, and Node's stable APIs — no
ASSUMED tags below.

**Primary recommendation:** Implement as a 3-file split under
`bridges/hooks/async-rewake/` (`registry.ts` + `pid-table.ts` +
`ring-buffer.ts`) so the `node:child_process` whitelist tightens to exactly
the spawn site, the atomic-write seam stays pure-leaf, and the
ring-buffer's wrap-around bookkeeping gets its own unit-testable surface.
Use `crypto.randomUUID()` for `dispatchId`. Surface `rewakeSummary` via
`ctx.ui.notify(text, "info")`. Reuse Phase 60's `installTimerLadder` /
`buildTranslationContext` / per-event translators / `prepareEnv`
verbatim — Phase 62 adds zero parallel infrastructure on the sync side.

## User Constraints (from CONTEXT.md)

### Locked Decisions

> **D-62-01 (spawn-path placement: `dispatch-exec.ts` delegates).**
> The asyncRewake branch lives inside `dispatch-exec.ts` as a pre-spawn
> check that delegates to `bridges/hooks/async-rewake/registry.ts`:
>
> ```ts
> export async function dispatchHookExec(
>   entry: RoutingEntry,
>   event: unknown,
>   ctx: ExtensionContext,
> ): Promise<HookExecResult> {
>   if (entry.handlerDecl.asyncRewake === true) {
>     await registry.spawnAndRegister(entry, event, ctx);
>     return { kind: "noop" };  // reducer continues to next entry
>   }
>   // ... existing sync EXEC-01..04 path unchanged
> }
> ```
>
> The registry module owns: the spawn call site (whitelist entry #3), the
> in-memory `Map<dispatchId, AsyncRewakeEntry>` state, the per-child exit
> handler that wires up the HOOK-06 injection, the ring-buffer state for
> stderr/stdout, and the persisted-PID-table sync. `dispatch-exec.ts`
> remains the sole seam from the reducer's POV. **Reducer contract
> (D-60-02 preserved):** asyncRewake entries return `{kind:"noop"}` to
> `reduceBucket`, so first-block-wins / mutate-compose / stop semantics
> are unchanged.

> **D-62-02 (declaration-order interleave).** Within a single bucket,
> entries fire in JSON-declaration order. Sync entries: `await
> activeExecutor(entry, event, ctx)`. Async entries: `await
> registry.spawnAndRegister(entry, event, ctx)` — the await is for the
> *spawn-and-register* synchronous step (fs writes, child-process
> construction, registry add), NOT for the child's exit. Subsequent sync
> entries see mutations earlier sync entries applied (D-60-02
> mutate-compose). Async entries do NOT see or perturb mutations.

> **D-62-03 (timeout: inherit EXEC-02 verbatim).** 600s default, handler
> `timeout` field overrides, SIGTERM → 5s → SIGKILL. Timer armed inside
> `spawnAndRegister` immediately after spawn, captured by
> `AsyncRewakeEntry`, cancelled by the per-child exit handler. On
> timeout overrun the exit handler observes a non-2 exit code (SIGTERM
> /SIGKILL yields `null`/`SIGKILL`). Per the standard rule, non-2 exit
> codes complete silently. If `rewakeSummary` is set it still fires via
> `ctx.ui.notify`.

> **D-62-04 (buffer overflow: ring-buffer + `_truncated: true` flag).**
> stderr 64KB, stdout 1MB. When the buffer fills, OLDEST bytes are
> dropped to make room for newer bytes. The exit handler reads the
> ring-buffer state at exit time; if any bytes were dropped, the
> injected payload is prefixed with a `_truncated: true` marker so the
> model sees it. (Sync path's behavior is kill-on-overflow — async path
> deliberately diverges to preserve the TAIL of long-running background
> output.)

> **D-62-05 (orphan reap: persisted `async-rewake-pids.json` + marker).**
> Persisted at `<scopeRoot>/pi-claude-marketplace/data/_shared/async-rewake-pids.json`.
> Shape: `{ version: 1, entries: [{ pid, dispatchId, plugin, spawnedAt
> (ISO) }] }`. Every `spawnAndRegister` / exit-handler / `/reload` event
> triggers a tmp + rename write of the full entries list via the
> existing `atomicWriteJson` helper. Marker env var on spawn:
> `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>`. Factory-time
> orphan reap: at `registerHooksBridge(pi)` entry, read the table, for
> each pid probe `kill 0`; on Linux read `/proc/<pid>/environ` and
> confirm marker matches recorded dispatchId before SIGKILL; on macOS or
> read failure soft-skip with `hookDebugLog`. `/reload` clear: walk
> in-memory registry and SIGKILL every live child BEFORE the
> orphan-reap step runs; persisted file then unlinked.

### Claude's Discretion

> - **Schema field shapes.** `asyncRewake`, `rewakeMessage`,
>   `rewakeSummary` admitted as `Type.Optional(Type.Unknown())`
>   (matches HOOK-03 lenient stance). Bridge runtime narrows each
>   via guards. Non-boolean `asyncRewake` value treated as `false`
>   (sync path).
> - **`AsyncRewakeEntry` interface shape.** Planner picks exact shape.
> - **`rewakeMessage` + child output concatenation format.** Planner
>   picks separator (`\n` vs `\n\n`); `\n\n` recommended.
> - **`ctx.ui.notify` severity for `rewakeSummary`.** Likely `"info"`;
>   re-verify against `shared/notify.ts:Severity` closed set at
>   planning time.
> - **Captured-epoch defense (D-59-03 reuse).** Async-rewake exit
>   handlers must capture the current `liveEpoch` at spawn time and
>   compare against `currentEpoch()` before injecting; mismatch =
>   silent no-op.
> - **Multi-hook fan-in via `dispatchId`.** Each `spawnAndRegister` call
>   generates a fresh `dispatchId`. UUID source: `node:crypto.randomUUID()`.
> - **`no-shell-out.test.ts` atomic amendment.** TWO → THREE in the
>   same commit that creates the new spawn site.
> - **Architecture-test file split.** Single
>   `hooks-async-rewake.test.ts` vs split into siblings.
> - **`pi.sendMessage` failure mode.** Catch + `hookDebugLog` +
>   continue.
> - **`process.title` / `argv0`.** Optional Linux-only nicety; skip
>   unless real-world need.

### Deferred Ideas (OUT OF SCOPE)

> - SURF-05 install-time warning for orphan `rewakeMessage` /
>   `rewakeSummary` — Phase 63.
> - `info <plugin>` rendering of async hooks (SURF-01..02) — Phase 63.
> - `docs/hooks.md` — Phase 63 (SURF-06).
> - Cross-`/reload` PID-table migration — v1.14+.
> - `ps`-based stranger detection on macOS — v1.14+.
> - `process.title` cosmetic naming.
> - Bulk-spawn batching — v1.14+.
> - First-party plugin migration to asyncRewake (`security-guidance` is
>   unavailable for `MultiEdit` reasons; `claude-intercom` is
>   third-party).
> - `setMaxListeners` warnings (flagged for planner awareness — see
>   Pitfalls).
> - Cross-platform PID table format compatibility (Windows
>   `wmic` / `tasklist`) — v1.14+.
> - `rewakeMessage` template substitution — v1.14+.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-06 | Bridge implements `asyncRewake` / `rewakeMessage` / `rewakeSummary` via bridge-owned `AsyncRewakeRegistry`; spawn detached, register, return immediately; on exit code 2 inject (`rewakeMessage` + stderr-or-stdout-if-empty) via `pi.sendMessage({customType:"claude-hook-rewake", display:false, content}, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })`; on non-2 silent; `rewakeSummary` via `ctx.ui.notify` at exit; registry cleared on `/reload`; orphans SIGKILLed; multi-hook fan-in via distinct `dispatchId`. | § "Standard Stack", "Architecture Patterns", "Code Examples" — `pi.sendMessage` signature verified at peer-dep `types.d.ts:288-291`/`:857-860`; `_pendingNextTurnMessages` drain verified at `agent-session.js:790-794`; sync EXEC-01..04 reuse points enumerated. |
| EXEC-05 | Background-spawn pattern: `spawn(command, args, { detached: false, stdio: ["pipe","pipe","pipe"] })`; stderr 64KB ring-buffer with `_truncated` marker; stdout 1MB; child PID + dispatch metadata + plugin-id recorded; one exit-handler per child watches for code 2; orphan reap via PID-table scan at next bridge load. | § "Pattern: Ring-buffer overflow" + § "Pattern: PID-table & orphan reap" + § "Code Examples" — spawn options match D-62-01..05 verbatim, ring-buffer arithmetic detailed, `/proc/<pid>/environ` parsing scheme detailed. |

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 62 binding |
|---|---|
| Node `>=22.18` recommended (NFR-4 floor `>=20.19.0`). Runtime is v22.22.2 [VERIFIED: `node --version`]. | All Phase 62 features (`spawn`, `crypto.randomUUID`, `unref`, `kill 0`, `/proc/<pid>/environ`, `write-file-atomic@^8`) are stable here. |
| TypeScript strict; discriminated `installable: true \| false` (NFR-7). | `AsyncRewakeEntry` is a `readonly`-fielded interface; per-child outcome routes through a discriminated `OutcomeKind = "inject" \| "silent" \| "noop"` arm with `assertNever`. |
| Atomic file writes (NFR-1). | `async-rewake-pids.json` uses existing `shared/atomic-json.ts::atomicWriteJson` (write-file-atomic@^8 wrapper) [VERIFIED: file read]. |
| `ctx.ui.notify` is the SOLE user-output channel (IL-2). | Bridge emits exactly one `ctx.ui.notify(rewakeSummary, "info")` per exit-code-2 child IF `rewakeSummary` is set — documented as the IL-2 EXEMPTION the architecture test pins. No other Phase 62 path touches `ctx.ui.notify`. |
| English-only V1 (IL-1). | All strings English. |
| Containment refusal (NFR-10). | `async-rewake-pids.json` path constructed via `path.join(loc.dataRoot, "_shared", "async-rewake-pids.json")` and guarded via `assertPathInside(loc.dataRoot, ...)` before write/read. |
| Quality bar `npm run check` green (NFR-6). | New file(s) clear typecheck + ESLint + Prettier + node:test. |
| All runtime debug output via `hookDebugLog`, never `console.error` / `process.stderr.write` / `ctx.ui.notify` (IL-2 / OBS-01). | Every failure arm (timeout overrun, sendMessage throw, marker mismatch, ring-buffer fill, ENOENT-on-table-read, EPIPE-on-stdin) routes through `hookDebugLog`. |
| `/reload` always suffices, no Pi restart (NFR-2). | `registerHooksBridge` factory entry SIGKILLs every in-memory live child, then unlinks the persisted file, then orphan-reaps any PIDs that survived a crash. |
| Idempotent / fail-clean (NFR-3). | Reading `async-rewake-pids.json` ENOENT returns `[]`; double-orphan-reap of an already-dead PID no-ops. |
| Pre-commit hooks; no `--no-verify`. | Inherited; no Phase 62 binding. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Detached child spawn | Bridge / Backend (Node host process) | — | The bridge IS the long-lived Pi extension process; `detached: false` means the child stays in our process group so SIGKILL works. |
| In-memory `Map<dispatchId, Entry>` registry | Bridge module state | — | Lives at `bridges/hooks/async-rewake/registry.ts` module level; mirrors `event-router.ts::parsedConfigCache` pattern (D-59-02). |
| Persisted PID table | Persistence (per-scope data dir) | Bridge calls `atomicWriteJson` | The table is *bridge-owned* state but written through the persistence-layer atomic-write seam (`shared/atomic-json.ts`). |
| Orphan-reap probe (`kill 0` + `/proc/<pid>/environ`) | Bridge / Backend (OS syscall) | — | Pure OS-level concern; no Pi-runtime involvement. Linux-specific marker check, soft-skip on macOS. |
| Exit-code-2 model-context injection | Pi peer-dep API (`pi.sendMessage`) | Bridge selects `deliverAs` based on `ctx.isIdle()` | The Pi runtime owns `_pendingNextTurnMessages` queue + `agent.followUp()` mid-stream injection; the bridge picks the lane and supplies the payload. |
| `rewakeSummary` UI surfacing | Pi peer-dep API (`ctx.ui.notify`) | — | Single sanctioned IL-2 exemption per phase contract; the model never sees the summary. |
| Schema admission for `asyncRewake` / `rewakeMessage` / `rewakeSummary` | Domain layer (`domain/components/hooks.ts`) | — | Lives alongside the existing HOOK-03 lenient additive set (`statusMessage`, `once`, `async`, `shell`, `args`) at the same layer. |
| Dispatcher delegation arm | Bridge dispatcher (`dispatch-exec.ts`) | Module that delegates to the registry | Single pre-spawn check at top of `dispatchHookExec`; sync EXEC-01..04 path strictly downstream. |
| Architecture test (closed-set whitelist) | Test layer (`tests/architecture/`) | — | `no-shell-out.test.ts` amendment + new `hooks-async-rewake.test.ts`. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` (built-in) | bundled with Node v22.22.2 | `spawn(command, args, options)` for detached child | The only sanctioned process-spawn primitive in the extension tree (whitelist gate at `tests/architecture/no-shell-out.test.ts`). `detached: false` + `stdio: ["pipe","pipe","pipe"]` keep the child in the parent process group so SIGKILL on `/reload` works and stdin/stdout/stderr stay pipe-routed. [VERIFIED: existing use at `dispatch-exec.ts:51, 347`.] |
| `node:crypto` (built-in) | bundled with Node v22.22.2 | `randomUUID()` for `dispatchId` | Built-in; deterministic v4 UUID format. No new dep. The PID-table file's `dispatchId` field carries the UUID; the same UUID is exported into the child's env as `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` (D-62-05 marker). |
| `node:fs/promises` (built-in) | bundled with Node v22.22.2 | `readFile` / `unlink` for orphan-reap table read + cleanup; `readFile` of `/proc/<pid>/environ` | Already in use across the bridge (e.g. `event-router.ts:32`). The orphan-reap path reads `async-rewake-pids.json` on ENOENT returning `[]` per NFR-3 fail-clean. |
| `node:process` (global) | bundled with Node v22.22.2 | `process.kill(pid, 0)` liveness probe, `process.kill(pid, "SIGKILL")` reap, `process.platform` for Linux branch | `kill(pid, 0)` returns `true` if alive, throws `ESRCH` if dead, throws `EPERM` if alive-but-not-ours. The EPERM-but-alive case is treated as "alive AND not ours" → soft-skip with `hookDebugLog` (cannot kill what we don't own). [VERIFIED: Node docs §process.kill.] |
| `shared/atomic-json.ts::atomicWriteJson` | local | NFR-1 atomic JSON write of `async-rewake-pids.json` | Wraps `write-file-atomic@^8.0.0`; serializes concurrent writes through internal queue; fsyncs both the tmp file and the parent dir; cleans up tmp files on process crash via signal-exit hooks. [VERIFIED: `shared/atomic-json.ts:24`.] |
| `shared/path-safety.ts::assertPathInside` | local | NFR-10 containment guard before every read/write of the PID-table path | Already used in `dispatch-exec.ts` for `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` / `CLAUDE_ENV_FILE`. Same call signature. |
| `shared/debug-log.ts::hookDebugLog` | local | Sole runtime debug-output channel (OBS-01 / IL-2 / D-59-05) | Every Phase 62 error / silent-completion / marker-skip / sendMessage-throw routes through `hookDebugLog`. [VERIFIED: file read.] |
| `bridges/hooks/exec-timer.ts::installTimerLadder` | local | EXEC-02 SIGTERM → 5s → SIGKILL ladder | Reused verbatim (D-62-03). The `ChildLike` structural interface lets the async branch invoke the helper without re-importing `node:child_process`. [VERIFIED: file read.] |
| `bridges/hooks/translation-context.ts::buildTranslationContext` + 8 per-event translators | local | PAYL-01 payload translation (sessionId, transcriptPath, cwd → Claude stdin envelope) | Async branch reuses the EXACT same translation chain; the only difference is the child's exit handling. |
| `bridges/hooks/event-router.ts::currentEpoch` | local | D-59-03 zombie defense — captured at spawn time, compared at exit time before `pi.sendMessage` | [VERIFIED: `event-router.ts:182-184`.] |
| `@earendil-works/pi-coding-agent` peer dep | `^0.73.1+` (the Phase 62 work targets the `sendMessage` + `isIdle` API surface present at `^0.79.0` in the canonical research doc; the locally-installed snapshot matches) | `pi.sendMessage<T>(...)` + `ctx.isIdle()` + `ctx.ui.notify` | `pi.sendMessage` signature at `types.d.ts:857-860`; `ctx.isIdle()` at `types.d.ts:224`; `ctx.ui.notify` at `types.d.ts:75`. [VERIFIED: file reads.] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `write-file-atomic` | `^8.0.0` (already a project dep) | Backing `atomicWriteJson`; concurrent-write queue + fsync | Indirectly via `atomicWriteJson` — the registry's PID-table writes never call this directly. [VERIFIED: `npm view write-file-atomic version` → 8.0.0.] |
| `typebox` | `^1.2.11` (project uses `1.x`) | Schema admission for the three new optional fields | Add to `HOOK_HANDLER_SCHEMA` as `Type.Optional(Type.Unknown())` per HOOK-03 lenient stance. [VERIFIED: `npm view typebox version` → 1.2.11; project uses `^1.1.38`.] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| In-memory `Map<dispatchId, Entry>` | `Map<pid, Entry>` keyed by PID | PID is recyclable across process exits; dispatchId is monotonic-unique per session. Map by dispatchId is correct. |
| `crypto.randomUUID()` | `${pluginId}#${handlerIndex}#${Date.now()}` (research doc § 13.6 sketch) | Sketch form collides if two handlers fire in the same millisecond. UUID v4 is collision-free and zero-cost. |
| `\n\n` separator between `rewakeMessage` and body | `\n` | `\n\n` matches the `security-guidance` handler's `CONTINUATION_SUFFIX` body construction (verified at `docs/research/claude-hook-config-syntax.md:835-837`) and Claude Code's own `<system-reminder>` prose form. `\n` runs the prefix into the first stderr line; defeats the "header → body" intent. |
| Persisted PID-table as ONE JSON file | One file per PID under `<dataRoot>/_shared/async-rewake-pids/<pid>.json` | One-file-per-PID requires mkdir-p of the subdir, more file ops, harder cleanup if a write fails mid-flight. Single-file `atomicWriteJson` matches state.json convention (D-62-05 rationale). |
| `kill 0` + `/proc/<pid>/environ` marker check | `PR_SET_PDEATHSIG` (Linux prctl) | `PR_SET_PDEATHSIG` would force-kill the child when the parent dies (no orphan creation in the first place) — but it's Linux-only and the syscall isn't exposed by Node without N-API. Doesn't actually *reap* an existing orphan from a prior load; only prevents future ones. The marker-check approach handles both prevention and reap; combining the two has no marginal benefit. |
| `pi.sendMessage` with `deliverAs: ctx.isIdle() ? "nextTurn" : "followUp"` | `deliverAs: "nextTurn"` unconditionally | `nextTurn` queues on `_pendingNextTurnMessages` (drained at next user prompt boundary). If the agent is currently streaming, the message would NOT appear in the active turn — wrong for `claude-intercom`-style "new inbox message during active assistant turn" use cases. The dynamic select matches Claude Code's documented "wakes Claude" intent. [VERIFIED: `agent-session.js:985-995`.] |

**Installation:**

No new external runtime dependencies. The phase reuses `write-file-atomic`
(already in `package.json`) via the existing `atomicWriteJson` helper, and
`typebox` (already in `package.json`) for the schema admission. Re-verify
locally:

```bash
node --version          # >= 20.19.0 (NFR-4); 22.22.2 verified
npm view typebox version          # 1.2.11
npm view write-file-atomic version          # 8.0.0
```

**Version verification (executed 2026-06-15):**

- Node v22.22.2 [VERIFIED: `node --version`]
- `typebox` registry version: 1.2.11 [VERIFIED: `npm view typebox version`]
- `write-file-atomic` registry version: 8.0.0 [VERIFIED: `npm view write-file-atomic version`]
- `@earendil-works/pi-coding-agent` (peer dep) — type definitions consulted via
  local `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` (consistent
  with the research doc § 13.5's `^0.79.0` snapshot).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `typebox` | npm | 1+ yr (1.x line) | Multi-million/wk | github.com/sinclairzx81/typebox | OK | Already in project deps — no new install. |
| `write-file-atomic` | npm | 10+ yr (npm-CLI dependency) | ~50M/wk | github.com/npm/write-file-atomic | OK | Already in project deps — no new install. |
| `@earendil-works/pi-coding-agent` | npm (peer dep) | Active milestone-paired | — | github.com/earendil-works/pi-coding-agent | OK | Already declared peer dep. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
**Packages added by Phase 62:** none (every dependency is already in
`package.json` and verified across prior phases).

## Architecture Patterns

### System Architecture Diagram

```
                            Pi Runtime (peer dep)
                              │
                              ▼
  ┌─────────────────  pi.on("tool_call", ...)  ─────────────────┐
  │                                                              │
  │  composite handler (dispatch.ts)                              │
  │      │                                                        │
  │      ▼                                                        │
  │  reduceBucket (D-60-02 first-block-wins)                      │
  │      │                                                        │
  │      ▼                                                        │
  │  dispatchHookExec(entry, event, ctx) ── dispatch-exec.ts ─────┤
  │      │                                                        │
  │      ├─ if entry.handlerDecl.asyncRewake === true ──┐         │
  │      │                                              │         │
  │      ▼ (sync path; PHASE 60, unchanged)             ▼         │
  │   prepareEnv → spawn shell/exec ... → close ...  registry.spawnAndRegister(entry, event, ctx) │
  │      │                                              │         │
  │      ▼                                              ▼         │
  │   HookExecResult                              { kind: "noop" }│
  │      │                                              │         │
  └──────┴──────────────────────────────────────────────┴─────────┘
                                                       │
                                                       ▼
                            ┌──────────────────────────────────────┐
                            │  bridges/hooks/async-rewake/         │
                            │                                      │
                            │   registry.ts                        │
                            │      buildTranslationContext         │
                            │      pickPayload  (PAYL-01 reuse)    │
                            │      serializeWithTruncation         │
                            │      prepareEnv  (HOOK-05 reuse)     │
                            │      + PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH │
                            │      spawn(cmd, args, { detached:false,│
                            │             stdio: ["pipe","pipe","pipe"] })│
                            │      installTimerLadder (EXEC-02 reuse)│
                            │      Map<dispatchId,AsyncRewakeEntry>.set│
                            │      pidTable.add  →  atomicWriteJson │
                            │                                      │
                            │      child.stderr.on("data") ──► RingBuffer (64KB)│
                            │      child.stdout.on("data") ──► RingBuffer (1MB)│
                            │                                      │
                            │      child.once("exit", onExit)       │
                            │      child.once("error", onError)     │
                            │                                      │
                            │   onExit(code, signal):                │
                            │      timer.cancel(); Map.delete;       │
                            │      pidTable.remove → atomicWriteJson│
                            │      if currentEpoch() !== captured →  │
                            │          hookDebugLog; return          │
                            │      if rewakeSummary → ctx.ui.notify("info")│
                            │      if code !== 2 → return            │
                            │      body = ringBuffer.stderr || ringBuffer.stdout│
                            │      if _truncated → prefix marker     │
                            │      content = rewakeMessage           │
                            │                ? rewakeMessage+"\n\n"+body│
                            │                : body                  │
                            │      lane = ctx.isIdle() ? "nextTurn" : "followUp"│
                            │      try { pi.sendMessage({customType:"claude-hook-rewake",│
                            │            display:false, content,    │
                            │            details:{pluginId,handlerIndex,dispatchId}},│
                            │           { deliverAs: lane }) }       │
                            │      catch (err) { hookDebugLog(err) } │
                            │                                      │
                            │   pid-table.ts                       │
                            │     readPidTable() : Promise<Entry[]>│
                            │     writePidTable(list) : Promise<void>│
                            │     addEntry / removeEntry / clear   │
                            │                                      │
                            │   ring-buffer.ts                     │
                            │     class RingBuffer(capacity)        │
                            │       write(buf: Buffer) → no-op tail-drop on overflow│
                            │       read() : { text: string,        │
                            │                  truncated: boolean } │
                            │                                      │
                            └──────────────────────────────────────┘

                                            registerHooksBridge(pi) — Phase 59 D-59-02/03
                                                  │
                                                  ▼
                              liveEpoch += 1; capturedEpoch = liveEpoch
                                                  │
                                                  ▼
                              shutdownInMemoryChildren()   ← Phase 62 NEW
                                  for (entry of asyncRewakeRegistry.values())
                                      try { entry.child.kill("SIGKILL") } catch {}
                                  asyncRewakeRegistry.clear()
                                                  │
                                                  ▼
                              reapOrphans(pidTablePath)    ← Phase 62 NEW
                                  for (entry of readPidTable())
                                      if (!isPidAlive(entry.pid)) continue
                                      if (platform === "linux") {
                                          marker = readProcEnviron(entry.pid)
                                          if (marker !== entry.dispatchId)
                                              hookDebugLog; continue
                                      } else { hookDebugLog(soft-skip) }
                                      process.kill(entry.pid, "SIGKILL")
                                  unlinkPidTable()
                                                  │
                                                  ▼
                              hydrateCacheFromDisk + rebuildRoutingTables (Phase 59 existing)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── bridges/
│   └── hooks/
│       ├── async-rewake/                       NEW DIR
│       │   ├── registry.ts                     NEW (~180 LoC: spawnAndRegister, onExit, onError, shutdownAll, reapOrphans wrapper)
│       │   ├── pid-table.ts                    NEW (~70 LoC: atomic read/write of async-rewake-pids.json)
│       │   └── ring-buffer.ts                  NEW (~70 LoC: circular Buffer + write index + truncated flag)
│       ├── dispatch-exec.ts                    MODIFIED (1 pre-spawn delegation arm; ~5 LoC)
│       ├── event-router.ts                     MODIFIED (registerHooksBridge gains shutdownInMemoryChildren + reapOrphans calls; ~10 LoC)
│       └── ... (existing files unchanged)
├── domain/
│   └── components/
│       └── hooks.ts                            MODIFIED (HOOK_HANDLER_SCHEMA + HookHandlerEntry gain 3 optional fields; ~20 LoC)
└── shared/
    └── (no changes — Phase 62 reuses atomic-json.ts, debug-log.ts, path-safety.ts verbatim)

tests/
└── architecture/
    ├── no-shell-out.test.ts                    MODIFIED (TWO → THREE in lockstep with first commit of registry.ts)
    └── hooks-async-rewake.test.ts              NEW (~250-300 LoC; single file per planner's discretion)
```

**File-split rationale:** Three siblings (instead of one 250-LoC module)
keep the `node:child_process` whitelist tight to `registry.ts` only —
`pid-table.ts` and `ring-buffer.ts` are pure-leaf modules with no process
spawn. The ring-buffer's wrap-around index math is the highest-risk
subroutine (off-by-one bugs are easy); isolating it in its own file with
its own architecture-test fixture row gives the planner a clear seam.

### Pattern: Discriminated `AsyncRewakeEntry` carrying captured-epoch + ring buffers

**What:** A `readonly`-fielded interface fully captures the per-child
state needed at exit time. Once added to the map, the entry never mutates;
the ring buffers are mutable internally but their *handles* on the entry
are `readonly`.

**When to use:** Always — the entry is the load-bearing zombie defense
(captured `liveEpoch`) and the audit trail.

**Example:**

```ts
// Source: composed from CONTEXT.md D-62-* + this research's discretion picks
import type { ChildProcess } from "node:child_process";

import type { TimerLadder } from "../exec-timer.ts";
import type { BucketAEvent } from "../../../domain/components/hook-events.ts";

import type { RingBuffer } from "./ring-buffer.ts";

interface AsyncRewakeEntry {
  readonly dispatchId: string;
  readonly pid: number;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly spawnedAt: string;          // ISO 8601 timestamp (for persisted table)
  readonly rewakeMessage: string | undefined;
  readonly rewakeSummary: string | undefined;
  readonly child: ChildProcess;
  readonly ladder: TimerLadder;        // EXEC-02 reuse; cancel on exit
  readonly stdoutBuffer: RingBuffer;   // 1MB cap
  readonly stderrBuffer: RingBuffer;   // 64KB cap
  readonly capturedEpoch: number;      // D-59-03 zombie defense
}
```

`handlerIndex` is intentionally NOT carried on the entry — Phase 62 uses
`dispatchId` (UUID) as the sole correlation token. `details.dispatchId` on
the sent message lets a debugger correlate; the handlerIndex is not load
bearing once the entry exists.

### Pattern: `child_process.spawn` with detached=false + ring-buffered stderr/stdout

**What:** Spawn the child in the parent's process group; pipe all three
stdio channels; arm the EXEC-02 timer ladder; attach `data` listeners
that route into a ring buffer; attach `once("exit", ...)` + `once("error",
...)` per child.

**When to use:** Every `spawnAndRegister` invocation. There is no
alternative shape.

**Example:**

```ts
// Source: synthesized from dispatch-exec.ts (sync path) + CONTEXT.md D-62-01/03/04/05
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

import { hookDebugLog } from "../../../shared/debug-log.ts";

import { installTimerLadder } from "../exec-timer.ts";

import { RingBuffer } from "./ring-buffer.ts";

const STDERR_CAP_BYTES = 64 * 1024;
const STDOUT_CAP_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 600_000;

export async function spawnAndRegister(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
): Promise<void> {
  const dispatchId = randomUUID();
  const capturedEpoch = currentEpoch();
  const transCtx = buildTranslationContext(ctx);
  const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
  const stdinJson = serializeWithTruncation(stdinPayload);
  const env = await prepareEnv(entry, transCtx, dispatchId);
  const plan = planSpawn(entry);                             // EXEC-04 reuse
  const timeoutMsRaw = entry.handlerDecl.timeout;
  const timeoutMs =
    typeof timeoutMsRaw === "number" ? timeoutMsRaw : DEFAULT_TIMEOUT_MS;

  let child: ChildProcess;
  try {
    child = spawn(plan.command, [...plan.args], {
      cwd: env.CLAUDE_PROJECT_DIR,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: plan.shell,
      detached: false,                                       // D-62-01 / EXEC-05
    });
  } catch (err) {
    hookDebugLog(
      `async-rewake: spawn threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
    );
    return;
  }

  const pid = child.pid;
  if (pid === undefined) {
    hookDebugLog(`async-rewake: child has no pid (${entry.pluginId})`);
    try { child.kill("SIGKILL"); } catch { /* best effort */ }
    return;
  }

  const stderrBuffer = new RingBuffer(STDERR_CAP_BYTES);
  const stdoutBuffer = new RingBuffer(STDOUT_CAP_BYTES);
  child.stderr?.on("data", (buf: Buffer) => stderrBuffer.write(buf));
  child.stdout?.on("data", (buf: Buffer) => stdoutBuffer.write(buf));

  const ladder = installTimerLadder(child, timeoutMs);

  const rewakeMessageField = entry.handlerDecl.rewakeMessage;
  const rewakeSummaryField = entry.handlerDecl.rewakeSummary;
  const asyncEntry: AsyncRewakeEntry = {
    dispatchId,
    pid,
    scope: entry.scope,
    marketplace: entry.marketplace,
    pluginId: entry.pluginId,
    claudeEvent: entry.claudeEvent,
    spawnedAt: new Date().toISOString(),
    rewakeMessage: typeof rewakeMessageField === "string" ? rewakeMessageField : undefined,
    rewakeSummary: typeof rewakeSummaryField === "string" ? rewakeSummaryField : undefined,
    child,
    ladder,
    stdoutBuffer,
    stderrBuffer,
    capturedEpoch,
  };

  asyncRewakeRegistry.set(dispatchId, asyncEntry);

  child.once("exit", (code, signal) => onChildExit(dispatchId, code, signal, ctx));
  child.once("error", (err) => onChildError(dispatchId, err));

  // EPIPE defense before stdin write (matches dispatch-exec.ts pattern)
  child.stdin?.on("error", (err) => {
    hookDebugLog(
      `async-rewake: stdin error (${entry.pluginId}): ${errorMessage(err)}`,
    );
  });
  child.stdin?.end(stdinJson);

  // Persist BEFORE the await returns so a crash mid-spawn is recoverable.
  await persistPidTable();
}
```

**Note on `setMaxListeners`:** the bridge owns at most N concurrent
`asyncRewake` children at any time. Each child is its own EventEmitter
(`ChildProcess` instance) with `once("exit", ...)` + `once("error", ...)` +
`child.stdin.on("error")` + `child.stdout.on("data")` + `child.stderr.on("data")`
— five listeners per child instance, NOT five listeners on a shared parent
emitter. Node's default `defaultMaxListeners = 10` applies per-instance, so
no `MaxListenersExceededWarning` is expected even for very large fan-ins.
Document the rationale in a code comment so a contributor doesn't reach for
`setMaxListeners` reactively.

### Pattern: Ring-buffer overflow with `_truncated` marker

**What:** Circular `Buffer` of fixed capacity; a monotonic `writeIndex`
modulo capacity tracks the write head; a `truncated` flag records whether
any bytes were dropped. On read, the bytes are reassembled in
chronological order (from `writeIndex` to capacity, then from 0 to
`writeIndex`).

**When to use:** Every `data` event on `child.stderr` / `child.stdout`.

**Example:**

```ts
// Source: novel for Phase 62; standard fixed-capacity ring-buffer pattern
export class RingBuffer {
  private readonly buf: Buffer;
  private readonly capacity: number;
  private writeIndex = 0;       // position the next byte will go to (0..capacity-1)
  private filled = 0;           // total bytes currently in the buffer (0..capacity)
  private truncated = false;    // set true the moment any byte is dropped

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = Buffer.allocUnsafe(capacity);
  }

  /** Append `chunk` bytes; on overflow, drop OLDEST bytes (D-62-04). */
  write(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }

    // If chunk is at least as large as capacity, only keep the tail.
    const effective =
      chunk.length >= this.capacity
        ? chunk.subarray(chunk.length - this.capacity)
        : chunk;

    if (effective.length < chunk.length) {
      this.truncated = true;
    }

    const room = this.capacity - this.filled;
    if (effective.length > room) {
      // We're about to overwrite (effective.length - room) old bytes.
      this.truncated = true;
    }

    // Two-segment copy when the write wraps the end of the underlying buf.
    const firstLen = Math.min(effective.length, this.capacity - this.writeIndex);
    effective.copy(this.buf, this.writeIndex, 0, firstLen);
    const tailLen = effective.length - firstLen;
    if (tailLen > 0) {
      effective.copy(this.buf, 0, firstLen, firstLen + tailLen);
    }

    this.writeIndex = (this.writeIndex + effective.length) % this.capacity;
    this.filled = Math.min(this.filled + effective.length, this.capacity);
  }

  /** Read out the contents in chronological order. */
  read(): { text: string; truncated: boolean } {
    if (this.filled === 0) {
      return { text: "", truncated: this.truncated };
    }

    if (this.filled < this.capacity) {
      // Buffer not yet wrapped: oldest at index 0, newest at writeIndex-1.
      const text = this.buf.subarray(0, this.filled).toString("utf8");
      return { text, truncated: this.truncated };
    }

    // Buffer wrapped: oldest at writeIndex, newest at writeIndex-1.
    const head = this.buf.subarray(this.writeIndex);
    const tail = this.buf.subarray(0, this.writeIndex);
    return { text: Buffer.concat([head, tail]).toString("utf8"), truncated: this.truncated };
  }
}
```

**UTF-8 boundary caveat:** unlike the sync-path `accumulateStream` helper
(which uses `StringDecoder` to reassemble multi-byte sequences crossing
chunk boundaries), the ring buffer concatenates bytes and decodes at
read-time only. A multi-byte sequence that straddles the wrap-around
boundary IS at risk of producing a `U+FFFD` replacement glyph in the
reconstructed text — but only at the exact wrap point, which is at the
*head* of the truncated tail. Since `truncated: true` is already set by
that point and the model is informed via the `_truncated` marker, the
glyph at the wrap boundary is a documented (and bounded) artefact. Calling
this out in a code comment so a future maintainer doesn't reach for
`StringDecoder` thinking it's a bug.

### Pattern: `_truncated` marker injection into the body string

**What:** The `_truncated` flag is a top-level marker the model can
detect. Per the EXEC-02 sync-path convention, the marker is a top-level
JSON field on the stdin envelope. But Phase 62's path is different — the
*body* sent to the model is a free-form string (model-visible
`<system-reminder>`-equivalent), not a JSON envelope. The marker must be
visible to the model as plain text.

**When to use:** Whenever `ringBuffer.read().truncated === true` and
exit code is 2.

**Example:**

```ts
function buildInjectionContent(
  rewakeMessage: string | undefined,
  body: string,
  truncated: boolean,
): string {
  const truncatedLine = truncated ? "[…truncated]\n" : "";
  const bodyWithMarker = `${truncatedLine}${body}`;
  return rewakeMessage !== undefined && rewakeMessage.length > 0
    ? `${rewakeMessage}\n\n${bodyWithMarker}`
    : bodyWithMarker;
}
```

The `[…truncated]` prefix matches the research doc's `…[truncated]`
recommendation; placing the marker at the START of the body (before the
oldest surviving bytes) signals to the model that there was content
earlier in the stream that it cannot see, which is the correct framing
for a security-review-style "we missed the early findings" disclosure.

### Pattern: Captured-epoch zombie defense

**What:** At spawn time, capture `currentEpoch()` into the entry. At exit
time, before calling `pi.sendMessage`, compare the entry's captured value
against the current `liveEpoch`. Mismatch = the extension factory re-ran
while this child was alive → silently no-op (with `hookDebugLog`).

**When to use:** Every exit handler. Prevents a slow child from a prior
`/reload` cycle from injecting context into the freshly hydrated session.

**Example:**

```ts
function onChildExit(
  dispatchId: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  ctx: ExtensionContext,
): void {
  const entry = asyncRewakeRegistry.get(dispatchId);
  if (entry === undefined) {
    return;                                                          // double-fire guard
  }

  entry.ladder.cancel();
  asyncRewakeRegistry.delete(dispatchId);
  void persistPidTable();                                            // fire-and-forget

  // Captured-epoch zombie defense (D-59-03 reuse).
  if (entry.capturedEpoch !== currentEpoch()) {
    hookDebugLog(
      `async-rewake: stale exit from prior load — dispatchId=${dispatchId} ` +
      `capturedEpoch=${entry.capturedEpoch} currentEpoch=${currentEpoch()}`,
    );
    return;
  }

  // rewakeSummary is independent of exit code (UI status surface).
  // Surface ONLY if non-empty string — IL-2 exemption is per-success-case.
  if (entry.rewakeSummary !== undefined && entry.rewakeSummary.length > 0) {
    try {
      ctx.ui.notify(entry.rewakeSummary, "info");
    } catch (err) {
      hookDebugLog(`async-rewake: notify failed (${entry.pluginId}): ${errorMessage(err)}`);
    }
  }

  if (code !== 2) {
    hookDebugLog(
      `async-rewake: silent completion code=${code ?? "null"} signal=${signal ?? "null"} ` +
      `dispatchId=${dispatchId} plugin=${entry.pluginId}`,
    );
    return;
  }

  const { text: stderrText, truncated: stderrTrunc } = entry.stderrBuffer.read();
  const { text: stdoutText, truncated: stdoutTrunc } = entry.stdoutBuffer.read();
  const body = stderrText.length > 0 ? stderrText : stdoutText;
  if (body.length === 0) {
    hookDebugLog(`async-rewake: exit 2 with empty body — no injection`);
    return;
  }

  const truncated = stderrText.length > 0 ? stderrTrunc : stdoutTrunc;
  const content = buildInjectionContent(entry.rewakeMessage, body, truncated);
  const lane: "nextTurn" | "followUp" = ctx.isIdle() ? "nextTurn" : "followUp";

  try {
    void ctx.sendMessage(
      {
        customType: "claude-hook-rewake",
        content,
        display: false,
        details: {
          pluginId: entry.pluginId,
          handlerIndex: undefined,                              // dispatchId is the load-bearing id
          dispatchId,
        },
      },
      { deliverAs: lane },
    );
  } catch (err) {
    hookDebugLog(`async-rewake: sendMessage threw (${entry.pluginId}): ${errorMessage(err)}`);
  }
}
```

**Note on `pi` vs `ctx.sendMessage`:** the `sendMessage` API is on the
`ExtensionContext` interface — `pi.sendMessage` referenced in the research
doc is on `ExtensionAPI`. Both expose the same signature per the peer-dep
type definitions [VERIFIED: `types.d.ts:288-291` for `ReplacedSessionContext`;
`:857-860` for `ExtensionAPI`; `:1099` for the `SendMessageHandler` exposed
on `ExtensionContext`]. The bridge uses `ctx.sendMessage` because the
exit-handler closure already carries `ctx`; we never pass `pi` into the
registry.

### Pattern: PID-table & orphan reap (D-62-05)

**What:** A single JSON file under `<dataRoot>/_shared/`; reads return `[]`
on ENOENT; writes are atomic via `atomicWriteJson`; the marker env var
`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` is set on every
spawned child and read back from `/proc/<pid>/environ` at reap time on
Linux. On macOS / read failure, soft-skip with a debug-log warning.

**When to use:** Every `registerHooksBridge` factory entry, between the
liveEpoch bump and the hydrate step.

**Example:**

```ts
// pid-table.ts
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../../../shared/atomic-json.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { assertPathInside } from "../../../shared/path-safety.ts";

import type { ScopedLocations } from "../../../persistence/locations.ts";

export interface PidTableEntry {
  pid: number;
  dispatchId: string;
  scope: "user" | "project";
  marketplace: string;
  plugin: string;
  spawnedAt: string;
}

interface PidTableFile {
  version: 1;
  entries: PidTableEntry[];
}

export function pidTablePath(loc: ScopedLocations): string {
  return path.join(loc.dataRoot, "_shared", "async-rewake-pids.json");
}

export async function readPidTable(loc: ScopedLocations): Promise<PidTableEntry[]> {
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json read");
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "version" in parsed &&
      (parsed as { version: unknown }).version === 1 &&
      Array.isArray((parsed as { entries: unknown }).entries)
    ) {
      return (parsed as PidTableFile).entries;
    }
    return [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    hookDebugLog(`async-rewake: pid-table read failed: ${errorMessage(err)}`);
    return [];
  }
}

export async function writePidTable(
  loc: ScopedLocations,
  entries: readonly PidTableEntry[],
): Promise<void> {
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json write");
    const payload: PidTableFile = { version: 1, entries: [...entries] };
    await atomicWriteJson(filePath, payload);
  } catch (err) {
    hookDebugLog(`async-rewake: pid-table write failed: ${errorMessage(err)}`);
  }
}

export async function unlinkPidTable(loc: ScopedLocations): Promise<void> {
  try {
    await unlink(pidTablePath(loc));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      hookDebugLog(`async-rewake: pid-table unlink failed: ${errorMessage(err)}`);
    }
  }
}
```

```ts
// registry.ts (orphan-reap helpers)
import { readFile as fsRead } from "node:fs/promises";

const MARKER_ENV = "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH";

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") {
      return false;                          // no such process
    }
    if (code === "EPERM") {
      return true;                           // alive but not ours
    }
    return false;
  }
}

async function readProcEnvironMarker(pid: number): Promise<string | undefined> {
  if (process.platform !== "linux") {
    return undefined;
  }
  try {
    const raw = await fsRead(`/proc/${pid}/environ`, "utf8");
    // NUL-separated KEY=VAL pairs; final entry may be trailing-NUL or empty.
    for (const pair of raw.split("\0")) {
      const eq = pair.indexOf("=");
      if (eq === -1) {
        continue;
      }
      if (pair.slice(0, eq) === MARKER_ENV) {
        return pair.slice(eq + 1);
      }
    }
    return undefined;
  } catch (err) {
    hookDebugLog(`async-rewake: /proc/${pid}/environ read failed: ${errorMessage(err)}`);
    return undefined;
  }
}

export async function reapOrphans(loc: ScopedLocations): Promise<void> {
  const entries = await readPidTable(loc);
  for (const entry of entries) {
    if (!isPidAlive(entry.pid)) {
      continue;
    }
    if (process.platform === "linux") {
      const marker = await readProcEnvironMarker(entry.pid);
      if (marker !== entry.dispatchId) {
        hookDebugLog(
          `async-rewake: orphan ${entry.pid} marker mismatch — skipping (got=${marker ?? "(none)"} want=${entry.dispatchId})`,
        );
        continue;
      }
    } else {
      hookDebugLog(
        `async-rewake: orphan ${entry.pid} marker-check skipped (platform=${process.platform})`,
      );
      continue;                              // CONSERVATIVE — D-62-05 soft-skip
    }
    try {
      process.kill(entry.pid, "SIGKILL");
    } catch (err) {
      hookDebugLog(
        `async-rewake: orphan ${entry.pid} kill failed: ${errorMessage(err)}`,
      );
    }
  }
  await unlinkPidTable(loc);
}
```

**On macOS soft-skip:** D-62-05 leaves a zombie alive (rather than risk
killing a stranger). The trade-off is documented in the canonical context
as v1.13-acceptable; v1.14+ can add `ps -E -o pid,command` parsing for
macOS marker check. Phase 62 ships the conservative path with a
debug-log breadcrumb.

### Pattern: `registerHooksBridge` factory-entry integration

**What:** Three new function calls slot in between the liveEpoch bump and
the existing hydrate step.

**Example:**

```ts
// event-router.ts (registerHooksBridge — modified)
export async function registerHooksBridge(
  pi: ExtensionAPI,
  opts: { ctx: ExtensionContext; cwd: string },
): Promise<void> {
  liveEpoch += 1;
  const capturedEpoch = liveEpoch;

  // Phase 62 additions
  shutdownInMemoryAsyncChildren();
  // For each scope, reap orphans persisted from prior loads.
  for (const scope of SCOPES) {
    const loc = locationsFor(scope, scope === "project" ? opts.cwd : homedir());
    await reapOrphans(loc);                       // logs + best-effort
  }

  // Existing hydrate + rebuild path unchanged.
  const hydrated = await hydrateCacheFromDisk(opts);
  for (const { state, loc } of hydrated) {
    rebuildRoutingTables(state, loc);
    if ((routingTable.get("SessionStart") ?? []).length > 0) {
      await ensureSharedDataDir(loc);
    }
  }

  pi.on("session_start", compositeHandlerFor("SessionStart", capturedEpoch));
  // ... 6 other pi.on calls unchanged
}
```

**`shutdownInMemoryAsyncChildren`:** walks the in-memory `Map`, SIGKILLs
every child via `try { entry.child.kill("SIGKILL") } catch {}`, then
`asyncRewakeRegistry.clear()`. Idempotent. The persisted PID table is
unlinked inside `reapOrphans` after the walk, so the next factory entry
starts with both surfaces empty.

### Pattern: Schema admission for the field family (HOOK-03 lenient)

**What:** Add three optional `Type.Unknown()` properties to
`HOOK_HANDLER_SCHEMA` and three optional fields on `HookHandlerEntry`.
Bridge runtime narrows each via `typeof` guards.

**When to use:** A single edit at `domain/components/hooks.ts`.

**Example:**

```ts
// domain/components/hooks.ts (HOOK_HANDLER_SCHEMA — modified)
const HOOK_HANDLER_SCHEMA = Type.Unsafe<HookHandlerEntry>({
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string" },
    command: { type: "string" },
    if: { type: "string" },
    // Phase 62 admissions (HOOK-03 lenient additive set).
    // Bridge narrows: typeof asyncRewake === "boolean", typeof rewakeMessage === "string", typeof rewakeSummary === "string".
    asyncRewake: {},
    rewakeMessage: { type: "string" },
    rewakeSummary: { type: "string" },
  },
  if: { type: "object", properties: { type: { const: "command" } }, required: ["type"] },
  then: {
    type: "object",
    required: ["type", "command"],
    properties: { command: { type: "string" } },
  },
});

export interface HookHandlerEntry {
  type: string;
  command?: string;
  readonly if?: string;
  // HOOK-03 tolerated additive extensions.
  statusMessage?: unknown;
  once?: unknown;
  async?: unknown;
  shell?: unknown;
  args?: unknown;
  // HOOK-06 / EXEC-05 admissions (Phase 62).
  asyncRewake?: unknown;
  rewakeMessage?: unknown;
  rewakeSummary?: unknown;
  // HOOK-03 forward-compat.
  [k: string]: unknown;
}
```

**Why `Type.Unknown()` rather than `Type.Boolean()` for `asyncRewake`:**
the research doc's tolerant-parsing recommendation + HOOK-03 lenient stance
together say: a malformed `asyncRewake: "yes"` should NOT trip TOOL-02
plugin-unavailable. The bridge runtime treats any non-`true` value as
`false` (sync path). Strict `Type.Boolean()` would route the same plugin to
`(unavailable) {unsupported hooks}` — a divergence from HOOK-03's
tolerance. The schema admits `Type.String()` on `rewakeMessage` and
`rewakeSummary` because the runtime needs them as strings to concatenate /
notify; a non-string value is silently ignored (treated as undefined).

### Anti-Patterns to Avoid

- **`detached: true`.** Upstream Claude Code uses `detached: true` because
  the CLI is short-lived and wants the child to outlive it. Phase 62
  runs inside a long-lived Pi extension process, so `detached: true`
  would defeat `/reload`-safe SIGKILL (the child would leave our process
  group and survive). D-62-01 / EXEC-05 explicitly lock `detached: false`.
- **Awaiting the child's exit inside `spawnAndRegister`.** Defeats
  fire-and-forget. The reducer expects `spawnAndRegister` to resolve
  after the *registration* step (registry add + atomic PID-table write),
  NOT after the child exits.
- **`exec` instead of `spawn`.** `exec` buffers stdout in memory by default
  and there is no streaming path — incompatible with the ring-buffer
  pattern. `spawn` is the only correct primitive.
- **Routing `rewakeSummary` through `shared/notify.ts::notify`.** The
  notify renderer expects structured `NotificationMessage` payloads with
  closed-set REASONS / STATUS_TOKENS. `rewakeSummary` is free-form
  plugin-author text and must NOT pollute the closed-set surface. Bypass
  `notify.ts` entirely; call `ctx.ui.notify(rewakeSummary, "info")`
  directly. The IL-2 exemption is documented on the architecture test.
- **Reading `/proc/<pid>/cmdline` instead of `/environ`.** `cmdline`
  exposes argv, not env — the marker is in `environ`. Reading `cmdline`
  would force us to inject the marker into argv (`process.title`) which
  is Linux-only and cosmetically intrusive.
- **Synchronous `fs.readFileSync("/proc/...")`.** Blocks the event loop;
  the rest of the bridge is async. Use `node:fs/promises`.
- **Forgetting `unref()` on the SIGKILL grace timer.** Without `unref()`,
  a leaked timer can keep the Node loop alive past natural child exit.
  The reused `installTimerLadder` already handles this for the SIGTERM /
  SIGKILL ladder; any net-new timers in Phase 62 must also `.unref()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Atomic JSON write | Bespoke `writeFile` + `rename` + `fsync` | `shared/atomic-json.ts::atomicWriteJson` | Already wraps `write-file-atomic@^8` with the concurrent-write queue + parent-dir fsync; matches NFR-1. |
| UUID generation | `${pluginId}#${handlerIndex}#${Date.now()}` | `node:crypto.randomUUID()` | Built-in; collision-free; zero deps. The research-doc sketch's `Date.now()`-based form collides on same-ms fan-in. |
| SIGTERM → grace → SIGKILL escalation | New `setTimeout` chain | `bridges/hooks/exec-timer.ts::installTimerLadder` | Phase 60 module; same TOCTOU defense (`!child.killed` guard); `.unref()` already wired. |
| Stdin payload truncation + `_truncated: true` JSON marker | New helper | `bridges/hooks/dispatch-exec.ts::serializeWithTruncation` (extract if needed) | Already handles the 256KB cap + UTF-8 byte accounting. Phase 62 can call directly OR move it to a shared helper if the test seam needs it. **Planner picks.** |
| `CLAUDE_*` env preparation | New helper | `bridges/hooks/dispatch-exec.ts::prepareEnv` (factor out) | Adds containment-checked `CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` / `CLAUDE_ENV_FILE`. Phase 62 needs the same set PLUS `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>`. **Planner option A:** export the existing helper unchanged; the async branch composes its own `{...env, PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: dispatchId}`. **Planner option B:** add an optional 3rd arg `extraVars?: Record<string,string>` to the existing helper. Option A is less invasive on the Phase 60 surface; pick that. |
| Payload translation | New per-event translators | Existing 8 translators at `bridges/hooks/payloads/<event>.ts` | Async branch goes through `buildTranslationContext` + `TRANSLATORS[claudeEvent]` exactly like the sync branch. |
| Path containment | New `relative + startsWith` check | `shared/path-safety.ts::assertPathInside` | Existing project pattern (NFR-10). |
| Liveness probe | Loop reading `/proc/<pid>/status` | `process.kill(pid, 0)` | Built-in; the `ESRCH` / `EPERM` discrimination is the standard idiom. |

**Key insight:** Phase 62 is overwhelmingly a *composition* phase — every
load-bearing primitive (atomic write, timer ladder, translators, env
preparation, debug log, epoch defense) already exists. The 250 LoC budget
is spent on the ring buffer, the per-child exit handler, the PID-table
helpers, and the orphan-reap glue. No new external dependency lands.

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `async-rewake-pids.json` at `<scopeRoot>/pi-claude-marketplace/data/_shared/async-rewake-pids.json` (per scope). | Atomic write on every state change; read at factory entry; unlink after orphan reap. |
| Live service config | None — no n8n / SOPS / Datadog state touched. | None. |
| OS-registered state | Child PIDs registered in the OS process table; tracked via `async-rewake-pids.json` for cross-load reap. | SIGKILL surviving PIDs at next bridge load via `reapOrphans`. |
| Secrets / env vars | New env var `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` injected into every spawned child (visible to the child via `process.env`; visible to other Linux users via `/proc/<pid>/environ` per default kernel mode — but the value is a non-secret UUID, not a credential). | None — none of the existing project env vars change. |
| Build artifacts | None — no compiled output, no global install. | None. |

**Nothing found in category:** Stored data category contains exactly one
new file (`async-rewake-pids.json`); other categories' content is
explicitly enumerated above with "None" where applicable.

## Common Pitfalls

### Pitfall: PID recycling between liveness probe and SIGKILL

**What goes wrong:** Between `process.kill(pid, 0)` returning truthy and
the subsequent `process.kill(pid, "SIGKILL")`, the OS can reap and
recycle the PID to an unrelated process. The SIGKILL then lands on a
stranger. The marker-check defense on Linux mitigates by re-reading
`/proc/<pid>/environ`; on macOS the soft-skip path doesn't kill at all
(by design).
**Why it happens:** Two separate syscalls; recycling is OS behavior, not
our race.
**How to avoid:** On Linux, the `kill 0` + marker-check + SIGKILL sequence
is wrapped in a `if (process.platform === "linux") { ... }` block. The
`kill 0` is informational only; the actual decision to SIGKILL depends
on the marker matching the recorded dispatchId. A recycled PID would have
a different marker (or none).
**Warning signs:** `hookDebugLog` lines reading `marker mismatch` more
often than expected — could indicate either real recycling OR a stranger
sharing the PID space we never had ownership of.

### Pitfall: Multi-byte UTF-8 sequence at ring-buffer wrap boundary

**What goes wrong:** A 4-byte UTF-8 emoji that straddles the ring buffer's
wrap point produces a `U+FFFD` replacement glyph when `Buffer.toString
("utf8")` runs at exit time.
**Why it happens:** The sync-path uses `StringDecoder` to span chunk
boundaries; the async-path's ring buffer concatenates bytes without
decoder awareness because the buffer's tail-drop policy makes
decoder state non-cumulative.
**How to avoid:** Document as accepted artefact. The U+FFFD appears at
the HEAD of the truncated body (the wrap point IS the truncation point),
and the `[…truncated]` marker already prefixes that location. The model
sees "missing context indicator → potentially-mangled glyph → rest of body
intact." Acceptable.
**Warning signs:** A test fixture that writes exactly `capacity - 1` ASCII
bytes followed by a multi-byte emoji and asserts no replacement glyph
in the read body would (correctly) fail; document this in the
architecture-test fixture's intentional-skip comment.

### Pitfall: `_pendingNextTurnMessages` lost on `/reload` during idle

**What goes wrong:** A child exits with code 2 while the agent is idle; the
exit handler calls `pi.sendMessage({...}, { deliverAs: "nextTurn" })`; the
message lands in `_pendingNextTurnMessages`. Before the next user prompt,
the user types `/reload`. The Pi runtime tears down the agent session and
all `_pendingNextTurnMessages` are discarded; the model never sees the
injected context.
**Why it happens:** Pi's `_pendingNextTurnMessages` queue lives on the
agent-session instance; reload swaps it out. This is a Pi runtime
behavior, not a Phase 62 bug.
**How to avoid:** None at v1.13 — the loss is inherent to the
queue-on-session lifecycle. Document in the SURF-06 docs (Phase 63) as a
known caveat. Phase 62 is correct as long as the captured-epoch defense
prevents the *prior* load's child from injecting into the *new* load's
session.
**Warning signs:** None — the loss is silent and only observable
end-to-end.

### Pitfall: Reusing `dispatchId` across `/reload` cycles

**What goes wrong:** A v1.14+ change re-introduces deterministic dispatchId
generation (e.g. `${pluginId}#${handlerIndex}`). A child from the prior
load survives the `/reload` SIGKILL (e.g. the process is uninterruptible
in disk-sleep), the new load spawns a sibling with the SAME dispatchId,
and the in-memory `Map` collides — the surviving stranger gets reaped
when the sibling's exit handler runs.
**Why it happens:** Phase 62 already uses `randomUUID()` so this is
defensive guidance only.
**How to avoid:** Lock `crypto.randomUUID()` as the SOLE source. Pin in
the architecture test:
`assert(asyncRewakeRegistry.spawn-source === "node:crypto.randomUUID()")`
or grep-based.
**Warning signs:** Two entries with the same dispatchId in the in-memory
map at any time would be a regression.

### Pitfall: `child.stdin.end(stdinJson)` after `child.once("error", ...)` already settled

**What goes wrong:** A fast-exiting child triggers `error` (EPIPE) BEFORE
`child.stdin.end(stdinJson)` resolves; the EPIPE propagates as an
unhandled exception.
**Why it happens:** Same EPIPE TOCTOU window the sync path already
handles via `child.stdin.on("error", hookDebugLog)` BEFORE `end()`.
**How to avoid:** Mirror the sync path: attach the listener BEFORE
writing. The example in § Standard Stack already does this; the
architecture test should pin it.
**Warning signs:** `EPIPE: broken pipe` showing up in node:test output
unconditionally.

### Pitfall: `MaxListenersExceededWarning` on the parent `process` emitter

**What goes wrong:** Some hand-rolled per-PID exit watchers attach to
`process.on("exit", ...)`. After N children spawn, Node emits the
warning at 10.
**Why it happens:** Phase 62 does NOT attach to `process` — every listener
is on the per-child `ChildProcess` instance. Documented as a
no-op concern.
**How to avoid:** Resist the urge to add a "global cleanup" via
`process.on("exit", shutdownAll)`. The `/reload` SIGKILL path is the sole
cleanup channel.
**Warning signs:** `setMaxListeners` calls appearing in PRs would be a
red flag.

### Pitfall: `atomicWriteJson` parent-dir-not-found races

**What goes wrong:** First-ever spawn fires before `_shared` dir exists;
the `mkdir(path.dirname(filePath), { recursive: true })` inside
`atomicWriteJson` handles this — but only IF the spawn fires after
`ensureSharedDataDir` ran (it always does — D-60-06 already ensures
this at factory entry).
**Why it happens:** Phase 60 already mkdir-p's `_shared` at factory time
WHEN AT LEAST ONE SessionStart entry exists in the routing table. A
plugin with asyncRewake but no SessionStart would NOT trigger the
existing `ensureSharedDataDir` call.
**How to avoid:** Generalize the trigger: call `ensureSharedDataDir(loc)`
unconditionally at factory entry (regardless of whether SessionStart
entries exist) when ANY plugin in the scope declares `asyncRewake`. OR
rely on `atomicWriteJson`'s internal `mkdir(path.dirname(...), {
recursive: true })` step (already verified at `shared/atomic-json.ts:25`)
which handles ENOENT-on-parent transparently.
**Warning signs:** PID-table write failing with `ENOENT` would surface in
debug-log — covered by the existing try/catch in `writePidTable`.

## Code Examples

### Common Operation: pre-spawn delegation in `dispatch-exec.ts`

```ts
// Source: minimal diff at dispatch-exec.ts:146 (top of dispatchHookExec)
import * as asyncRewakeRegistry from "./async-rewake/registry.ts";

export async function dispatchHookExec(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
): Promise<HookExecResult> {
  if (entry.handlerDecl.asyncRewake === true) {
    try {
      await asyncRewakeRegistry.spawnAndRegister(entry, event, ctx);
    } catch (err) {
      hookDebugLog(
        `async-rewake: spawnAndRegister threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
    }
    return { kind: "noop" };
  }
  // Sync EXEC-01..04 path follows unchanged
  try {
    const transCtx = buildTranslationContext(ctx);
    const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
    const stdinJson = serializeWithTruncation(stdinPayload);
    const env = await prepareEnv(entry, transCtx);
    return await spawnAndCollect(entry, env, stdinJson);
  } catch (err) {
    hookDebugLog(`exec: caught (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`);
    return { kind: "noop" };
  }
}
```

### Common Operation: registry module barrel

```ts
// Source: bridges/hooks/async-rewake/registry.ts top-of-file shape
//
// This is the THIRD and FINAL sanctioned `node:child_process` import site
// in the extension tree. The closed-set whitelist gate at
// `tests/architecture/no-shell-out.test.ts` enforces the 3-element set;
// adding a fourth file requires editing both the test's
// ALLOWED_CHILD_PROCESS_FILES Set AND the sibling "exactly three files"
// assertion in the SAME commit (D-58-01 atomic-supersession lesson).

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

import { hookDebugLog } from "../../../shared/debug-log.ts";
// ... rest of imports
```

### Common Operation: `pi.sendMessage` content shape

```ts
// Source: cross-checked against research doc § 13.6 + verified peer-dep types
// types.d.ts:288-291 (ExtensionContext.sendMessage) and :857-860 (ExtensionAPI.sendMessage)
ctx.sendMessage(
  {
    customType: "claude-hook-rewake",     // discriminator for debug + filtering
    content: `${rewakeMessage}\n\n${body}`, // string (or TextContent[] — string is sufficient)
    display: false,                       // matches Claude Code <system-reminder>: invisible to user, visible to model
    details: {                            // optional plugin-defined payload; useful for transcript inspection
      pluginId: entry.pluginId,
      dispatchId,
    },
  },
  {
    deliverAs: ctx.isIdle() ? "nextTurn" : "followUp",
  },
);
```

### Common Operation: amended `no-shell-out.test.ts`

```ts
// Source: tests/architecture/no-shell-out.test.ts (THIRD sanctioned site)
const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
]);

test("whitelist: exactly three files may import node:child_process", () => {
  assert.deepEqual([...ALLOWED_CHILD_PROCESS_FILES].sort(), [
    "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
    "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
  ]);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `exec` with default in-memory stdout buffering | `spawn` with `stdio: ["pipe","pipe","pipe"]` + manual stream listeners | Node 14+ documented best-practice | Spawn is the only correct primitive for fire-and-forget + ring-buffered streaming. |
| `setTimeout`/`clearTimeout` without `.unref()` | `.unref()` on every long-lived timer | Node 0.10+ documented best-practice | Without `.unref()`, a leaked SIGTERM/SIGKILL timer keeps the Node loop alive after the child naturally exits. Already wired in `exec-timer.ts`. |
| Hand-rolled `Date.now() + Math.random()` IDs | `crypto.randomUUID()` (since Node 14.17+) | Built-in primitive, zero deps | Collision-free, predictable format, standard library. |
| `process.on("SIGCHLD", ...)` for reap | Per-child `child.once("exit", ...)` + `child.once("error", ...)` | Documented Node pattern | Single global handler doesn't scale to multi-hook fan-in; per-child listeners do. |
| `/proc/<pid>/cmdline` for process identification | `/proc/<pid>/environ` for marker-based identification | Linux-only pattern; environ is mode-readable by owner | Survives argv rewrites (`process.title` mutations don't affect env). |
| `@sinclair/typebox` (0.34.x legacy package name) | `typebox` (1.x) | Project already on 1.x | No regression. |
| `fs.writeFile` + `fs.rename` hand-roll for state.json | `write-file-atomic@^8` via `shared/atomic-json.ts` | Phase 1/2 baseline | Phase 62 uses the SAME helper for `async-rewake-pids.json`. |

**Deprecated/outdated:**

- Synchronous `fs.writeFileSync` for state writes — never atomic; NFR-1 forbids.
- Manual `Buffer.concat` of all stderr/stdout chunks then truncating at
  read time — unbounded heap growth for long-running children; ring buffer
  bounds it from the first byte.
- `process.title = "claude-hook-rewake:..."` for `ps` debugging — Linux-only
  cosmetic; deferred to v1.14+ per CONTEXT.md "Claude's Discretion".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|

*This table is empty:* every factual claim in this research was either
verified against the live codebase (peer-dep type definitions, existing
helper signatures, existing test patterns), tagged [VERIFIED] against an
authoritative source (`npm view`, `node --version`, primary docs), or
explicitly carried in as a CONTEXT.md locked decision / discretion item.
No user confirmation is needed for downstream planning.

## Open Questions

1. **Should `ensureSharedDataDir` be called unconditionally at factory
   entry, or only when at least one `SessionStart` or `asyncRewake` entry
   exists?**
   - What we know: Phase 60 D-60-06 currently gates the mkdir-p on
     SessionStart bucket non-empty (`event-router.ts:602-604`). Phase 62
     adds a NEW need for the `_shared` dir even when no SessionStart entry
     exists (the PID-table write needs it).
   - What's unclear: whether the planner extends the existing gate
     (`SessionStart` OR `asyncRewake` count > 0) or relies on
     `atomicWriteJson`'s internal `mkdir(path.dirname, { recursive: true })`
     which already covers ENOENT-on-parent.
   - Recommendation: rely on `atomicWriteJson` internal mkdir. The
     `ensureSharedDataDir` gate stays as-is to avoid stirring Phase 60
     test coverage. The `atomicWriteJson` call at the FIRST `spawnAndRegister`
     creates `_shared` on demand. Document the dependency on the
     architecture test for clarity.

2. **Does the Phase 60 `serializeWithTruncation` helper need to be moved to
   a shared module for Phase 62 reuse, or can the async branch import it
   from `dispatch-exec.ts`?**
   - What we know: it's a local non-exported function at
     `dispatch-exec.ts:249`.
   - What's unclear: cross-file import vs. extract-to-shared-helper. Both
     work.
   - Recommendation: extract to `bridges/hooks/wire-protocol.ts` (which
     already exports `parseHookStdout`) so both files import a single
     source. Minimal churn; preserves the test seam.

3. **Should the architecture test fixture for orphan-reap actually exec
   real child processes, or stub `process.kill` and `fsRead`?**
   - What we know: spawning real children in node:test is slow + flaky on
     CI; stubbing is faster but requires careful seam design.
   - What's unclear: which level the integration test exercises.
   - Recommendation: stub `process.kill` + `fsRead("/proc/.../environ")`
     via a test seam (`_setOrphanProbesForTest({killProbe, environReader})`).
     The "real" end-to-end is best left to the manual / UAT path.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | All Phase 62 features | ✓ | v22.22.2 | — |
| `npm` (for ad-hoc verification) | None at runtime; verification only | ✓ | bundled | — |
| `typebox` (npm) | Schema admission | ✓ (in package.json as `^1.1.38`; registry has 1.2.11) | 1.2.11 | — |
| `write-file-atomic` (npm) | `atomicWriteJson` backing | ✓ (in package.json as `^8.0.0`) | 8.0.0 | — |
| `/proc/<pid>/environ` readable | Linux orphan-reap marker check | ✓ on Linux; ✗ on macOS | — | Soft-skip with `hookDebugLog` (D-62-05 documented trade-off). |
| `process.kill(pid, 0)` | Liveness probe | ✓ all platforms | — | — |
| `process.kill(pid, "SIGKILL")` | Orphan SIGKILL | ✓ all platforms | — | — |
| Pi peer dep `pi.sendMessage` + `ctx.isIdle()` + `ctx.ui.notify` | Exit-2 injection + UI surface | ✓ (peer dep installed; type definitions verified) | aligned with `^0.79.0` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `/proc/<pid>/environ` on
non-Linux — soft-skip with debug-log (D-62-05).

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | `node:test` (Node built-in) |
| Config file | none — invoked via npm scripts |
| Quick run command | `node --test tests/architecture/hooks-async-rewake.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + node:test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| HOOK-06 | `asyncRewake: true` delegation path returns `{kind:"noop"}` to the reducer; sync path unchanged | unit/architecture | `node --test tests/architecture/hooks-async-rewake.test.ts -- "delegation"` | ❌ Wave 0 |
| HOOK-06 | On child exit code 2, `pi.sendMessage` invoked exactly once with `customType:"claude-hook-rewake"`, `display:false`, content matching `rewakeMessage + "\n\n" + stderr` (or stdout when stderr empty) | unit | `node --test ... -- "exit-2 inject"` | ❌ Wave 0 |
| HOOK-06 | On child exit code 0 or other non-2 codes, `pi.sendMessage` NOT invoked | unit | `node --test ... -- "non-2 silent"` | ❌ Wave 0 |
| HOOK-06 | `rewakeSummary` triggers `ctx.ui.notify(summary, "info")` exactly once at exit, independent of exit code | unit | `node --test ... -- "rewakeSummary notify"` | ❌ Wave 0 |
| HOOK-06 | `deliverAs` is `"nextTurn"` when `ctx.isIdle() === true`, `"followUp"` when `false` | unit | `node --test ... -- "deliverAs lane"` | ❌ Wave 0 |
| HOOK-06 | Captured-epoch mismatch: child exits AFTER `liveEpoch` bumped → no `pi.sendMessage` | unit | `node --test ... -- "captured-epoch zombie"` | ❌ Wave 0 |
| HOOK-06 | `pi.sendMessage` throw is caught and logged via `hookDebugLog` — no escape | unit | `node --test ... -- "sendMessage throw caught"` | ❌ Wave 0 |
| HOOK-06 | Multi-hook fan-in: 3 asyncRewake entries in the same bucket all return `{kind:"noop"}` to the reducer, each gets a distinct `dispatchId`, each child's exit fires independently | unit | `node --test ... -- "multi-hook fan-in"` | ❌ Wave 0 |
| HOOK-06 | `/reload` (second `registerHooksBridge` invocation): every in-memory child SIGKILLed; PID-table unlinked; new `liveEpoch` captured for new spawns | unit/integration | `node --test ... -- "reload shutdown"` | ❌ Wave 0 |
| EXEC-05 | Spawn options exactly `{ detached: false, stdio: ["pipe","pipe","pipe"], shell, cwd, env }` | unit (spawn spy) | `node --test ... -- "spawn options"` | ❌ Wave 0 |
| EXEC-05 | `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` injected into spawned child env | unit | `node --test ... -- "marker env var"` | ❌ Wave 0 |
| EXEC-05 | Stderr ring buffer caps at 64KB; overflow sets `_truncated` flag; `[…truncated]` marker prefixes the injected body | unit | `node --test ... -- "stderr ring overflow"` | ❌ Wave 0 |
| EXEC-05 | Stdout ring buffer caps at 1MB; same `_truncated` semantics | unit | `node --test ... -- "stdout ring overflow"` | ❌ Wave 0 |
| EXEC-05 | EXEC-02 timer ladder inherited verbatim: handler `timeout` overrides 600s default; SIGTERM → 5s → SIGKILL on overrun; ladder cancelled on natural exit | unit (fake timers) | `node --test ... -- "timer ladder reuse"` | ❌ Wave 0 |
| EXEC-05 | `async-rewake-pids.json` updated atomically on every spawn / exit / reap | unit (file-system fake) | `node --test ... -- "pid-table atomic"` | ❌ Wave 0 |
| EXEC-05 | Factory-entry orphan reap: a PID-table entry for a live PID with matching `/proc/<pid>/environ` marker gets SIGKILLed; mismatched marker = skip with debug-log; macOS = skip with debug-log | unit (stubbed probes) | `node --test ... -- "orphan reap"` | ❌ Wave 0 |
| EXEC-05 | Declaration-order interleave: a bucket with [sync, async, sync, async] entries fires in that order; sync entries see prior sync mutations; async entries do NOT perturb the mutate-compose | unit | `node --test ... -- "declaration interleave"` | ❌ Wave 0 |
| HOOK-03 (admission) | `HOOK_HANDLER_SCHEMA` admits `asyncRewake: <unknown>`, `rewakeMessage: <string>`, `rewakeSummary: <string>` as OPTIONAL without affecting `parseHooksConfig` `ok: true` arm | unit | `node --test ... -- "schema admission"` | ❌ Wave 0 |
| HOOK-03 (admission) | `asyncRewake: "yes"` (non-boolean) is treated as `false` (sync path); plugin still installs | unit | `node --test ... -- "tolerant asyncRewake"` | ❌ Wave 0 |
| Architecture | `no-shell-out.test.ts` whitelist amended TWO → THREE in lockstep with the first commit that introduces `registry.ts` | unit (closed-set) | `node --test tests/architecture/no-shell-out.test.ts` | ✅ (existing; amended in same commit) |

### Sampling Rate

- **Per task commit:** `node --test tests/architecture/hooks-async-rewake.test.ts tests/architecture/no-shell-out.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/architecture/hooks-async-rewake.test.ts` — covers HOOK-06 + EXEC-05 + HOOK-03 admission + declaration interleave + reap.
- [ ] `tests/architecture/no-shell-out.test.ts` — amend ALLOWED set + sibling assertion (existing file, in-place edit).

*(No framework install needed — node:test is built-in and already used
across the project.)*

### Test-fixture taxonomy & file-split decision

**Recommended split:** Single file `tests/architecture/hooks-async-rewake.test.ts`
containing 4 `describe` sections:

1. `spawn-and-register` — spawn-spy options, marker env, `{kind:"noop"}`
   return, registry add, pid-table persist.
2. `on-exit` — exit-2 inject content shape, deliverAs lane,
   captured-epoch defense, non-2 silent, sendMessage throw caught,
   rewakeSummary notify.
3. `ring-buffer` — wrap-around correctness, `_truncated` flag, overflow
   marker placement.
4. `orphan-reap` — kill-0 probe, /proc/<pid>/environ marker match/mismatch,
   macOS soft-skip, pid-table unlink.

Plus integration sections at `describe("dispatch-exec delegation", ...)`
covering: the pre-spawn arm fires before the sync body; the reducer's
mutate-compose semantics are preserved across mixed buckets; multi-hook
fan-in produces independent dispatchIds.

**Rationale for single file:** the per-section fixture surfaces share the
same mocks (spawn spy, sendMessage spy, ctx.ui.notify spy, kill-0 spy,
fs.readFile spy). Splitting into siblings would duplicate the mock setup
and miss cross-section invariants (e.g. "the exit handler that calls
sendMessage is the SAME closure that runs the captured-epoch check").
Phase 60 / 61's `hooks-exec.test.ts` / `hooks-supportability.test.ts` /
`hooks-if-field.test.ts` are all single-file precedent.

### Fixtures needed

- **Mocked `pi.sendMessage`** — captured-call spy with assertions on
  `customType`, `display`, `content`, `details`, `deliverAs`. Provided via
  a test-only `_setSendMessageForTest` seam OR injected directly through
  `ctx`.
- **Mocked `ctx.isIdle`** — boolean toggle for the lane-select fixture.
- **Mocked `ctx.ui.notify`** — captured-call spy.
- **`child_process` fake** — already a Phase 60 pattern via
  `_setSpawnForTest`. Phase 62 extends with a `_setSpawnForTest` on
  `bridges/hooks/async-rewake/registry.ts` that swaps the bound `spawn`
  reference. The fake returns a `ChildProcess`-shaped EventEmitter
  exposing `stdin` / `stdout` / `stderr` streams the test can write to,
  plus a `kill(signal)` recording method.
- **`/proc/<pid>/environ` test double** — read-call indirection via a
  `_setOrphanProbesForTest({ killProbe, environReader })` seam. The
  default uses `process.kill` + `fs.readFile`; the test injects a fake.
- **Fixed UUID source** — `_setDispatchIdGeneratorForTest(() => "fixed-id")`
  so assertions can pin the dispatchId.
- **Fake `liveEpoch` bump** — already exposed via `_bumpEpochForTest()`
  in `event-router.ts:651`. Phase 62 test reuses.
- **PID-table fake file path** — a temp dir per `node:test` `before`
  hook + cleanup in `after`. The atomic-write surface uses real disk;
  the test reads back the JSON.

## Security Domain

> Phase 62 is bridge-internal subprocess management. ASVS coverage focuses
> on input validation, OS command injection, and resource consumption.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | No new auth surface. Existing GitHub Device Flow (Phase 36) untouched. |
| V3 Session Management | no | Pi runtime owns session lifecycle. |
| V4 Access Control | yes | NFR-10 path containment: `assertPathInside(loc.dataRoot, asyncRewakePidsPath, ...)` before every read/write. |
| V5 Input Validation | yes | `asyncRewake` boolean narrowed via `=== true`; `rewakeMessage`/`rewakeSummary` narrowed via `typeof === "string"`; PID-table JSON validated via shape probe (`version === 1` + `entries` is array). |
| V6 Cryptography | yes (light) | `crypto.randomUUID()` — Node's CSPRNG-backed v4 UUID. No bespoke RNG. |
| V12 File Resources | yes | `assertPathInside` (NFR-10) + atomic write (NFR-1) + ring-buffer caps (DoS containment). |

### Known Threat Patterns for {Node.js + child_process + atomic-json}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| OS command injection via `command` field | T (Tampering) | Plugin author owns the `command` field; `LIFE-03` (`fs.realpath + assertPathInside`) gates install-time symlink escape. Phase 62 inherits Phase 60's exec-form vs shell-form discrimination (`spawn(command, args, { shell })` per EXEC-04). No new injection surface. |
| PID-table tampering (write-while-our-process-reads) | T / I (Information disclosure) | NFR-1 atomic write via `write-file-atomic` (fsync + rename). Read-then-act-then-write sequence runs on a single Node event-loop tick within the bridge; cross-process tampering is OUT of scope (the table lives under our extension root). |
| Killing a stranger PID after recycling | T / R (Repudiation) | `/proc/<pid>/environ` marker check on Linux. On macOS, soft-skip (D-62-05 conservative trade-off). |
| DoS via unbounded stderr/stdout from a noisy child | D (DoS) | Ring buffer caps at 64KB / 1MB. Buffer drops oldest bytes on overflow rather than killing — but the `_truncated` marker informs the model. |
| DoS via fan-out of N concurrent asyncRewake children | D (DoS) | No per-bridge cap in v1.13 — flagged in CONTEXT.md "Deferred Ideas" (bulk-spawn batching) for v1.14+. Plugin author owns the responsibility. |
| Information disclosure via marker env var visible in `/proc/<pid>/environ` to other Linux users | I | The marker is a UUID v4, NOT a credential. Visible to root + the same user; no privacy issue. Documented in code comments. |
| `pi.sendMessage` content rendering as a user-visible message | I | `display: false` is the gate. Verified at peer-dep `messages.d.ts:32-39` (per research doc § 13.5). Architecture test pins `display: false` byte-equality in the injected message shape. |

## Sources

### Primary (HIGH confidence)

- Local file `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` —
  Phase 60 sync EXEC body; reuse points.
- Local file `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` —
  Phase 59 factory + cache + liveEpoch.
- Local file `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` —
  EXEC-02 timer ladder.
- Local file `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` —
  PAYL-01 translator context.
- Local file `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` —
  D-60-02 reduceBucket reducer.
- Local file `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts` —
  HookExecResult discriminated union.
- Local file `extensions/pi-claude-marketplace/domain/components/hooks.ts` —
  HOOK_HANDLER_SCHEMA, HookHandlerEntry.
- Local file `extensions/pi-claude-marketplace/shared/atomic-json.ts` —
  atomicWriteJson NFR-1 helper.
- Local file `extensions/pi-claude-marketplace/shared/debug-log.ts` —
  hookDebugLog OBS-01 sole seam.
- Local file `extensions/pi-claude-marketplace/shared/notify.ts` (lines 1-140) —
  Severity closed-set (`"info" | "warning" | "error"`).
- Local file `extensions/pi-claude-marketplace/persistence/locations.ts` —
  `dataRoot` definition.
- Local file `tests/architecture/no-shell-out.test.ts` — closed-set
  whitelist gate to amend.
- Local file `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — `sendMessage` at `:288-291` / `:857-860`, `isIdle()` at `:224`,
  `notify` at `:75`.
- Local file `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`
  at `:790-794` (drain) and `:976-998` (`sendCustomMessage` switch) —
  confirms `_pendingNextTurnMessages` queue behavior + `followUp` /
  `nextTurn` discrimination.
- Local file `docs/research/claude-hook-config-syntax.md` § 5 (env
  contract), § 7 (asyncRewake verdict), § 13 (full deep-dive with ~250
  LoC implementation sketch and failure-mode reference).
- `node --version` → v22.22.2 [VERIFIED].
- `npm view typebox version` → 1.2.11 [VERIFIED].
- `npm view write-file-atomic version` → 8.0.0 [VERIFIED].

### Secondary (MEDIUM confidence)

- CONTEXT.md "Code Insights" enumeration of reusable assets — D-62-* locks
  confirm none are LOW-confidence.
- Phase 57 / 58 / 59 / 60 / 61 prior context (D-57-04 / D-58-01 /
  D-59-02 / D-59-03 / D-59-05 / D-60-01 / D-60-02 / D-60-04 / D-60-06 /
  D-61-02) — internal precedent for schema / atomic-supersession /
  cache / epoch / debug-log / discriminated result / reducer /
  translator / mkdir-p / fail-open.

### Tertiary (LOW confidence)

- *None.* Phase 62 has been deeply pre-researched in the canonical
  `docs/research/claude-hook-config-syntax.md` § 13 deep-dive; the
  CONTEXT.md user-decisions resolve every previously-open question.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every package is already in the project; no
  Phase 62 install lands. Versions verified against npm registry.
- Architecture: HIGH — every reuse point is verified against the live
  codebase; the new module shape follows the established
  `bridges/hooks/<concern>/` directory pattern (cf.
  `bridges/hooks/if-field/`).
- Pitfalls: HIGH — every pitfall in this research is sourced from
  existing-code patterns (the sync path's EPIPE defense, the Phase 60
  TOCTOU on `child.killed`, the ring-buffer wrap UTF-8 caveat) or
  documented OS behaviors (PID recycling, `/proc/<pid>/environ`
  semantics, MaxListenersExceededWarning).
- Validation: HIGH — every REQ has at least one concrete test case
  mapped to a node:test invocation; the file-split decision matches
  Phase 60/61 precedent.

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (30 days — stable ecosystem; if Pi peer-dep
ships a major version bump or Node v22 LTS ends, re-verify the
`sendMessage` + `isIdle` API and the `crypto.randomUUID` availability).
