# Phase 62: `asyncRewake` Registry & Background-Spawn - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 62-`asyncRewake` Registry & Background-Spawn
**Areas discussed:** Spawn-path placement + reducer integration, Timeout policy, Buffer-overflow strategy, Orphan-reap PID persistence

---

## Spawn-path placement + reducer integration

### Branch site

| Option | Description | Selected |
|--------|-------------|----------|
| `dispatch-exec.ts` delegates | Pre-spawn check in `dispatchHookExec`; delegates to `async-rewake/registry.ts::spawnAndRegister(...)`; returns `{kind:"noop"}`. Matches REQ wording (separate registry module). Single executor seam from reducer's POV. | ✓ |
| `reduceBucket` short-circuits | Reducer checks `entry.handlerDecl.asyncRewake` BEFORE calling `activeExecutor`. Pollutes `dispatch.ts` with second dispatch concern. | |
| Single `dispatch-exec.ts` body | Both branches handled in `dispatch-exec.ts`. Simplest call graph; least modular; ~600 LoC file. | |

**User's choice:** `dispatch-exec.ts` delegates (Recommended)
**Notes:** Matches REQ wording explicitly. The async-rewake branch fires BEFORE Phase 60's sync EXEC-01..04 body; sync path unchanged.

### Mix ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Declaration order, interleaved | Entries fire in JSON declaration order; async ones spawn-and-return at their declared position; sync ones execute normally. Matches D-60-02 "sequential awaited fan-out". | ✓ |
| Async-first | Spawn all async upfront, then sync. Deviates from upstream declaration-order. | |
| Sync-first | Run all sync first, then async. Violates declaration order; not upstream-faithful. | |

**User's choice:** Declaration order, interleaved (Recommended)
**Notes:** Preserves upstream-faithful semantics + plugin author's mental model from the JSON shape.

---

## Timeout behavior for background processes

| Option | Description | Selected |
|--------|-------------|----------|
| Inherit EXEC-02 | 600s default + handler `timeout` override + SIGTERM → 5s → SIGKILL ladder. Overrun → non-2 exit → silent complete. Matches upstream's "subject to handler's `timeout`" contract. | ✓ |
| Unbounded | Only `/reload` SIGKILL terminates. Zombie risk; portability regression. | |
| Long default (24h) + override | More forgiving for background-by-nature work. Arbitrary ceiling; not upstream-faithful. | |

**User's choice:** Inherit EXEC-02 (Recommended)
**Notes:** Uniform timeout semantics across sync and async; plugin authors don't have to remember a different default. The 600s default is generous enough for typical asyncRewake use cases (security review: 30s-5min); plugin authors can override down for stricter SLAs.

---

## Buffer-overflow strategy for stderr/stdout

| Option | Description | Selected |
|--------|-------------|----------|
| Ring-buffer (drop oldest) + `_truncated: true` flag | Keep most recent 64KB stderr / 1MB stdout; oldest bytes drop. Injected payload preserves tail + flag. Matches REQ EXEC-05 wording. | ✓ |
| Truncate-to-cap (keep earliest) + flag | First 64KB preserved. Simpler; less useful for accumulating-finding use cases. | |
| Kill on overflow (inherit sync-path) | Match Phase 60 EXEC-02. Defeats asyncRewake's purpose; deviates from REQ wording. | |

**User's choice:** Ring-buffer (drop oldest) + `_truncated: true` flag (Recommended)
**Notes:** For security-review-style use cases (findings accumulate over the child's lifetime, exit-2 happens on the last finding), the TAIL is what the model needs to react to. Truncate-to-cap defeats this. Kill-on-overflow defeats asyncRewake entirely. Implementation: simple circular `Buffer` of length 65536 + write-index pointer.

---

## Orphan-reap PID persistence

### Persistence strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single `async-rewake-pids.json` (atomic-write) | One JSON file at `<scopeRoot>/pi-claude-marketplace/data/_shared/`. Atomic write (tmp + rename per NFR-1) on add/remove. Factory-time scan reads + reaps. | ✓ |
| Per-PID files in `pids/` subdir | One file per live PID. No shared-file contention; more file ops. | |
| PR_SET_PDEATHSIG (Linux) + no v1.13 reap | Linux-only; doesn't actually reap; needs native binding. | |

**User's choice:** Single `async-rewake-pids.json` (atomic-write) (Recommended)
**Notes:** Matches the project's existing NFR-1 atomic-write pattern (state.json). File schema: `{ version: 1, entries: [{pid, dispatchId, plugin, spawnedAt}] }`.

### Stranger-process protection

| Option | Description | Selected |
|--------|-------------|----------|
| Marker env var + soft confirmation | Set `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` on the child. At reap time, read `/proc/<pid>/environ` (Linux) and check marker; soft-skip on macOS / read failure. | ✓ |
| Trust the file + always SIGKILL if `kill -0` succeeds | Simpler; micro-risk of killing recycled PID. PID-recycling on Linux is bounded by `pid_max`; very unlikely. | |
| Spawn timestamp + `ps`-cross-check | Cross-platform; heavier (forks `ps` per PID); timestamp format varies. | |

**User's choice:** Marker env var + soft confirmation (Recommended)
**Notes:** Conservative path. On Linux, `/proc/<pid>/environ` is the precise mechanism. On macOS / read failure, soft-skip with debug-log warning — may leak a rare zombie, but never kills a stranger.

---

## Claude's Discretion

- Schema field shapes — `Type.Optional(Type.Unknown())` per HOOK-03 lenient stance (matches existing `async` / `shell` / `args` / `statusMessage` / `once` fields). Strict `Type.Boolean()` for `asyncRewake` is a planner option.
- `AsyncRewakeEntry` interface shape — planner picks exact field set within the envelope `{dispatchId, pid, plugin, claudeEvent, spawnedAt, rewakeMessage?, rewakeSummary?, timerHandle, ringBuffer, capturedEpoch}`.
- `rewakeMessage` + child output concatenation format — planner picks separator (`\n` vs `\n\n`). Research doc's security-guidance example suggests `\n\n`.
- `ctx.ui.notify` severity for `rewakeSummary` — likely `"info"` per upstream; planner re-verifies against `shared/notify.ts:Severity` closed set.
- Captured-epoch defense (D-59-03 reuse) — async-rewake exit handlers capture `liveEpoch` at spawn time; compare against `currentEpoch()` before injecting.
- Multi-hook fan-in via `dispatchId` — `crypto.randomUUID()` is the natural source (no new dep).
- `tests/architecture/no-shell-out.test.ts` "exactly TWO → THREE" amendment lands atomically with the first commit that creates `registry.ts` (D-58-01 lesson).
- Architecture-test file split — single file vs siblings; planner picks based on test-section size.
- `pi.sendMessage` failure mode at injection time — catch + `hookDebugLog` + continue.
- `process.title` / `argv0` setting — optional Linux-only nicety; skip unless architecture-test reveals real-world need.

## Deferred Ideas

- SURF-05 install-time warning (orphan `rewakeMessage` / `rewakeSummary` without `asyncRewake: true`) — Phase 63
- `info <plugin>` rendering of async hooks (SURF-01..02) — Phase 63
- `docs/hooks.md` worked example — Phase 63 SURF-06
- Cross-`/reload` PID-table migration — v1.14+ if registry shape changes
- `ps`-based stranger detection on macOS — v1.14+ if zombie leakage becomes a problem
- Bulk-spawn batching for buckets with many asyncRewake entries — v1.14+ optimization
- First-party plugin migration to asyncRewake — v1.14+ unblocks via bucket-D promotion (Stop)
- Cross-platform PID table format compatibility (Windows) — v1.14+
- `rewakeMessage` template substitution (`{plugin}`, `{event}` placeholders) — v1.14+
- `setMaxListeners`-related warnings — planner awareness only
