# Phase 62: `asyncRewake` Registry & Background-Spawn - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 62 implements the `asyncRewake` / `rewakeMessage` / `rewakeSummary`
field family per HOOK-06 + EXEC-05. The bridge-owned
`AsyncRewakeRegistry` (~250 LoC at
`bridges/hooks/async-rewake/registry.ts`) spawns hook children detached
via `node:child_process.spawn(command, args, { detached: false,
stdio: ["pipe","pipe","pipe"] })`, registers child PID + dispatch
metadata, returns IMMEDIATELY so the triggering tool call proceeds, and
watches for child exit code 2. On exit code 2, the bridge injects the
(`rewakeMessage` prefix if set + child's stderr or stdout-if-stderr-empty)
blob into Pi's model context via
`pi.sendMessage({customType:"claude-hook-rewake", display:false, content},
{deliverAs: ctx.isIdle() ? "nextTurn" : "followUp"})`. The `display:
false` flag matches Claude Code's `<system-reminder>` semantic
(user-invisible / model-visible via Pi's `convertToLlm()`). `rewakeSummary`
(when set) surfaces via `ctx.ui.notify(rewakeSummary, "info")` at process
exit (UI-only).

Six concrete deliverables:

1. **Schema admission for the field family.** `HOOK_HANDLER_SCHEMA` in
   `domain/components/hooks.ts` admits `asyncRewake`, `rewakeMessage`,
   `rewakeSummary` as optional fields per HOOK-03 lenient stance. The
   parser passes them through to `HookHandlerEntry` unchanged; semantics
   live in the EXEC + registry layer.
2. **`bridges/hooks/async-rewake/registry.ts` (NEW).** Bridge-owned
   in-memory `Map<dispatchId, AsyncRewakeEntry>` + `spawnAndRegister(...)`
   + per-child exit handler + ring-buffer state + persisted-PID-table
   sync.
3. **`dispatch-exec.ts` delegation branch.** Pre-spawn check for
   `entry.handlerDecl.asyncRewake === true`; on match, delegate to
   `registry.spawnAndRegister(entry, event, ctx)` and return
   `{kind:"noop"}` to the reducer. Sync EXEC-01..04 path unchanged.
4. **Orphan-reap factory-time scan.** At `registerHooksBridge(pi)` entry
   (alongside Phase 59's `liveEpoch` bump + cache hydrate), read the
   persisted `async-rewake-pids.json` file, for each PID probe liveness
   via `kill 0`, verify ownership via `/proc/<pid>/environ` marker check
   (Linux) with soft-skip on macOS / read failure, SIGKILL surviving
   owned PIDs, cleanup the file.
5. **Architecture-test amendment.** `tests/architecture/no-shell-out.test.ts`
   "exactly TWO sanctioned `node:child_process` import sites" assertion
   becomes "exactly THREE" in lockstep with the new spawn site's first
   commit (D-58-01 atomic-supersession lesson). New site:
   `bridges/hooks/async-rewake/registry.ts` joins the existing list
   (`platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`).
6. **Test scaffold.** New architecture test
   `tests/architecture/hooks-async-rewake.test.ts` exercising spawn /
   register / exit-code-2 inject / exit-other silent / ring-buffer
   overflow / orphan reap / marker-check stranger-skip. Plus integration
   tests that pin the `dispatch-exec.ts` delegation branch + the
   declaration-order interleave between sync and async entries.

Phase 62 does NOT touch: SURF-05 install-time warning (when
`rewakeMessage` / `rewakeSummary` declared without `asyncRewake: true` —
that's Phase 63), `info <plugin>` rendering of async hooks (Phase 63
SURF-01..02), docs (Phase 63 SURF-06), reconcile cascade slot (Phase 63
LIFE-01), or `MATCH-03`'s `if` field (Phase 61, complete). Phase 62 also
does NOT change Phase 60's sync EXEC-01..04 timer ladder, env var
preparation, payload truncation, or wire-protocol parsing — the
asyncRewake delegation branch fires BEFORE Phase 60's sync body.

</domain>

<decisions>
## Implementation Decisions

### D-62-01 (spawn-path placement: `dispatch-exec.ts` delegates)

The asyncRewake branch lives inside `dispatch-exec.ts` as a pre-spawn
check that delegates to `bridges/hooks/async-rewake/registry.ts`. Shape:

```ts
export async function dispatchHookExec(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
): Promise<HookExecResult> {
  if (entry.handlerDecl.asyncRewake === true) {
    await registry.spawnAndRegister(entry, event, ctx);
    return { kind: "noop" };  // reducer continues to next entry
  }
  // ... existing Phase 60 sync EXEC-01..04 path unchanged
}
```

The registry module owns: the spawn call site (whitelist entry #3), the
in-memory `Map<dispatchId, AsyncRewakeEntry>` state, the per-child exit
handler that wires up the HOOK-06 injection, the ring-buffer state for
stderr/stdout, and the persisted-PID-table sync. `dispatch-exec.ts`
remains the sole seam from the reducer's POV.

**Reducer contract (D-60-02 preserved):** asyncRewake entries return
`{kind:"noop"}` to `reduceBucket`, so first-block-wins / mutate-compose /
stop semantics are unchanged. The reducer cannot tell a sync `noop` from
an async-spawned `noop`. This is correct: async entries CANNOT block /
mutate / stop the triggering tool call — that's the whole point of
fire-and-forget.

Rationale: REQ HOOK-06 names the new module
(`bridges/hooks/async-rewake/registry.ts`); delegation from
`dispatch-exec.ts` keeps the executor seam unchanged (one entry point
for the reducer, two paths inside). Option "extend `reduceBucket`
directly" pollutes `dispatch.ts` with a second dispatch concern + needs
new test invariants in `hooks-dispatch.test.ts`. Option "single
`dispatch-exec.ts` body" inflates the file to ~600 LoC and tangles the
sync + async concerns.

### D-62-02 (declaration-order interleave for mixed sync + async entries)

Within a single bucket, entries fire in JSON-declaration order. Sync
entries: `await activeExecutor(entry, event, ctx)` (existing D-60-02
behavior). Async entries: `await registry.spawnAndRegister(entry, event,
ctx)` — the await is for the *spawn-and-register* synchronous step
(file system writes, child-process construction, registry add), NOT for
the child's exit. The reducer continues to the next entry immediately.

Subsequent sync entries see whatever mutations earlier sync entries
applied (D-60-02 mutate-compose). Async entries do NOT see or perturb
mutations — they spawn against the event state at their declared
position. If an earlier sync entry mutated `event.input.command`, a
later async entry's child sees the post-mutation stdin payload (because
payload translation happens INSIDE `spawnAndRegister`, after the mutate
state is current).

Rationale: declaration order is upstream-faithful; matches Phase 60's
sequential-awaited-fan-out wording. Async-first / sync-first orderings
deviate from upstream and break plugin author's mental model from the
JSON shape.

### D-62-03 (timeout: inherit EXEC-02 verbatim)

asyncRewake background processes honor Phase 60 EXEC-02's timer ladder
verbatim: 600s default, handler `timeout` field overrides, SIGTERM → 5s
grace → SIGKILL on overrun. The timer is armed inside
`spawnAndRegister` immediately after spawn, captured by the
`AsyncRewakeEntry`, cancelled by the per-child exit handler.

**On timeout overrun:** the child receives SIGTERM → 5s → SIGKILL. The
exit handler observes a non-2 exit code (SIGTERM/SIGKILL yields
`null`/`SIGKILL` per Node spawn contract). Per the standard rule, non-2
exit codes complete silently — no model-context injection. If
`rewakeSummary` is set, it still fires via `ctx.ui.notify` (the UI
status surface is independent of the exit code).

Rationale: upstream Claude Code's documented contract is "background
process runs to completion subject to the handler's own `timeout`".
Inheriting EXEC-02 keeps timeout semantics uniform across sync and
async hooks; plugin authors don't have to remember a different default.
Unbounded background processes create zombie risk + portability
regression vs upstream. The 24h-default alternative is arbitrary.

### D-62-04 (buffer overflow: ring-buffer + `_truncated: true` flag)

stderr/stdout streaming uses a ring-buffer in
`AsyncRewakeEntry.ringBufferState`. Caps: stderr 64KB, stdout 1MB (same
as EXEC-02). When the buffer fills, OLDEST bytes are dropped to make
room for newer bytes. The exit handler reads the ring-buffer state at
exit time; if any bytes were dropped, the injected payload includes a
top-level `_truncated: true` field so the model sees the marker.

Rationale: REQ EXEC-05 wording ("stderr buffer capped at 64KB (truncated
with `_truncated: true` marker preserved)") implies preserve-and-flag,
not kill. For exit-code-2 use cases (security review surfacing findings
that accumulate over the child's lifetime), the TAIL is what the model
needs to react to — the last finding before exit-2 is the trigger.
Truncate-to-cap (keep earliest) defeats this. Kill-on-overflow (sync
path's behavior) defeats asyncRewake's purpose entirely (a noisy
background process should NOT be killed).

**Implementation note for planner:** Node's `child.stderr.on("data", ...)`
hook is the integration point. A simple circular `Buffer` of length
65536 + write-index pointer is enough. No new dep.

### D-62-05 (orphan reap: persisted `async-rewake-pids.json` + marker)

The bridge maintains a persisted PID table at
`<scopeRoot>/pi-claude-marketplace/data/_shared/async-rewake-pids.json`
(directory already mkdir-p'd at factory time per D-60-06).

**File shape:**

```json
{
  "version": 1,
  "entries": [
    { "pid": 12345, "dispatchId": "abc-123", "plugin": "foo", "spawnedAt": "2026-06-15T20:14:32.123Z" },
    ...
  ]
}
```

**Atomic write (NFR-1):** every `spawnAndRegister` / exit-handler /
`/reload` event triggers a tmp + rename write of the full entries list.
The `_shared` directory is already mkdir-p'd at factory time; same
containment guard (`assertPathInside`) applies.

**Marker env var on spawn:** every spawned child gets
`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` injected into its
env. The marker enables stranger-process protection at reap time.

**Factory-time orphan reap:** at `registerHooksBridge(pi)` entry
(alongside `liveEpoch` bump + cache hydrate from D-59-02 / D-59-03):

```ts
function reapOrphans(): void {
  const table = readPidTableSync();  // atomic-read; returns [] on ENOENT
  for (const entry of table) {
    if (!isPidAlive(entry.pid)) continue;  // kill 0 returns ESRCH

    if (process.platform === "linux") {
      const marker = readProcEnviron(entry.pid);
      if (marker !== entry.dispatchId) {
        hookDebugLog(`async-rewake orphan ${entry.pid} marker mismatch — skipping`);
        continue;
      }
    } else {
      hookDebugLog(`async-rewake orphan ${entry.pid} marker-check skipped (non-linux)`);
    }

    process.kill(entry.pid, "SIGKILL");
  }
  unlinkPidTableSync();
}
```

**Stranger-process protection:** on Linux, read
`/proc/<pid>/environ` (NULL-separated KEY=VAL pairs) and confirm the
marker matches our recorded dispatchId before SIGKILLing. On macOS /
read failure: soft-skip with debug-log warning. The conservative path
(skip if unsure) means we may leak a zombie on macOS in rare cases —
acceptable v1.13 trade-off; better than risking killing a stranger.

**`/reload` clear:** when `registerHooksBridge` re-runs, ALL live
children from the previous factory invocation (same process, before the
reload) are SIGKILLed via the in-memory registry walk BEFORE the
orphan-reap step runs. The persisted file is then unlinked. This is the
normal `/reload` cleanup path (NOT a crash recovery).

Rationale: single-file atomic-write matches the project's existing NFR-1
pattern (state.json). Per-PID files require more file ops + mkdir-p for
the subdir + harder cleanup if a write fails mid-flight.
PR_SET_PDEATHSIG is Linux-only and doesn't actually reap (it just
prevents orphan creation), so it'd need to combine with another mechanism
for cross-platform coverage.

### Claude's Discretion

- **Schema field shapes.** `asyncRewake`, `rewakeMessage`,
  `rewakeSummary` admitted as `Type.Optional(Type.Unknown())` (matches
  HOOK-03 lenient stance for existing `async` / `shell` / `args` /
  `statusMessage` / `once` fields). The bridge runtime narrows each via
  guards (`typeof x === "boolean"` for `asyncRewake`; `typeof x ===
  "string"` for the message/summary). A non-boolean `asyncRewake` value
  is treated as `false` (sync path). Strict TypeBox shapes
  (`Type.Boolean()`) are a planner option for the `asyncRewake` discriminator
  ONLY — but if the schema rejects a malformed plugin's `asyncRewake:
  "yes"`, that's a TOOL-02-equivalent install failure; consider the
  research doc's "tolerant parsing" recommendation before locking strict.
- **`AsyncRewakeEntry` interface shape.** Likely:
  ```ts
  interface AsyncRewakeEntry {
    readonly dispatchId: string;
    readonly pid: number;
    readonly plugin: string;
    readonly claudeEvent: BucketAEvent;
    readonly spawnedAt: string;  // ISO timestamp
    readonly rewakeMessage?: string;
    readonly rewakeSummary?: string;
    readonly timerHandle: NodeJS.Timeout;  // EXEC-02 ladder
    readonly ringBuffer: RingBufferState;
    readonly capturedEpoch: number;  // D-59-03 zombie defense
  }
  ```
  Planner picks the exact shape.
- **`rewakeMessage` + child output concatenation format.** REQ wording:
  "prefix if present" + body. Planner picks separator (`\n` vs `\n\n`).
  The research doc (security-guidance verbatim
  `CONTINUATION_SUFFIX`) suggests `\n\n` for readability — matches a
  prose body. Architecture test pins.
- **`ctx.ui.notify` severity for `rewakeSummary`.** Likely `"info"` per
  upstream wording (research doc § 13 deep-dive). Planner may pick
  another `Severity` member if the project's notify type definition
  doesn't include `"info"` (re-verify against
  `shared/notify.ts:Severity` closed set at planning time).
- **Captured-epoch defense (D-59-03 reuse).** Async-rewake exit
  handlers must capture the current `liveEpoch` at spawn time. On exit
  fire, compare against `currentEpoch()` — if mismatch (the extension
  factory re-ran while this child was alive), the handler no-ops
  silently. Prevents a stale child from a prior `/reload` cycle from
  injecting into a fresh session's model context.
- **Multi-hook fan-in via `dispatchId`.** Each `spawnAndRegister` call
  generates a fresh `dispatchId` (e.g., `crypto.randomUUID()`). Two
  asyncRewake hooks firing on the same triggering event create TWO
  independent registry entries; their children's exit handlers each
  fire independently without coordination. Planner picks UUID source
  (`node:crypto.randomUUID()` is built-in; no new dep).
- **`tests/architecture/no-shell-out.test.ts` atomic amendment.** The
  test's `EXACTLY_TWO_SANCTIONED_SHELL_OUT_SITES` constant (or
  equivalent) becomes `EXACTLY_THREE_SANCTIONED_SHELL_OUT_SITES` and
  the entry list adds `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`.
  This MUST land in the SAME commit as the first source file that
  imports `node:child_process` from the new location (D-58-01
  atomic-supersession). Planner places this in the first task that
  creates `registry.ts`.
- **Architecture-test file split.** Single
  `tests/architecture/hooks-async-rewake.test.ts` vs split into
  `hooks-async-rewake-{spawn,registry,reap}.test.ts` siblings. Planner
  picks based on test-section size. Pattern follows Phase 60's
  `hooks-exec.test.ts` layout.
- **`pi.sendMessage` failure mode at injection time.** What if
  `sendMessage` throws (e.g., Pi session was destroyed during the
  background run)? Likely catch + `hookDebugLog` + continue (the child
  is already exited; nothing to recover). Planner adds a try/catch
  arm.
- **`process.title` / `argv0` setting.** Optional Linux-only nicety:
  set the child's `process.title` to something like
  `claude-hook-rewake:<dispatchId>` so it's identifiable in `ps`. Helps
  debugging but not required by REQ. Planner skips unless the
  architecture-test scaffold reveals a real-world need.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — HOOK-06 (registry + injection), EXEC-05
  (spawn pattern), HOOK-03 (schema admission for the field family),
  TOOL-02 (asyncRewake is NOT a TOOL-02 trigger — implemented per
  HOOK-06; the `MultiEdit`-style unavailability stays). SURF-05 is
  Phase 63 (no-op warning for `rewakeMessage` / `rewakeSummary` without
  `asyncRewake: true`).
- `.planning/ROADMAP.md` § "Phase 62" — goal + 5 success criteria;
  dependency on Phase 60 (extends EXEC-01..04 surface).
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook
  Bridge" — locked scope (bucket-A only); third-party forward-compat
  rationale for asyncRewake.

### Prior phase decisions (Phases 57-61 — foundations)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  — D-57-02 (lenient schema; HOOK-03 tolerance), D-57-04 (discriminated
  parse result). Phase 62 admits 3 new optional fields per same
  convention.
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md`
  — D-58-01 atomic-supersession lesson; the
  `no-shell-out.test.ts` "exactly TWO → THREE" amendment lands in the
  same commit as the first source that imports `node:child_process`
  from `bridges/hooks/async-rewake/registry.ts`.
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-CONTEXT.md` —
  D-59-02 (bridge-owned in-memory cache at `shared/event-router.ts`;
  Phase 62's registry follows the same pattern), D-59-03 (`liveEpoch`
  bump at `registerHooksBridge` entry; orphan-reap step joins the
  same factory-entry block), D-59-05 (`shared/debug-log.ts` is the sole
  runtime debug seam — async-rewake errors go here, NOT `ctx.ui.notify`).
- `.planning/phases/60-hook-execution-payload-translators-env-vars/60-CONTEXT.md`
  — D-60-01 (`HookExecResult` discriminated union — asyncRewake returns
  `{kind:"noop"}`); D-60-02 (first-block-wins reducer — asyncRewake
  preserves the contract by returning noop); D-60-04 (per-event payload
  translators — async-rewake's child gets the same translated stdin as a
  sync child via the same translators); D-60-06 (`_shared` data
  directory mkdir-p'd at factory time — natural home for the persisted
  PID table).
- `.planning/phases/61-if-field-permission-rule-matcher/61-CONTEXT.md`
  — D-61-02 fail-open contract is precedent for asyncRewake's
  fail-modes (timeout / overflow / sendMessage failure all silently
  collapse with `hookDebugLog`).

### Authority sources (cross-reference at planning time — FETCH FRESH)

- **`code.claude.com/docs/en/hooks`** Command-hook-fields table for
  `asyncRewake` / `rewakeMessage` / `rewakeSummary` field definitions.
  Per the research doc, the table verbatim entry is: `"asyncRewake | no
  | If true, runs in the background and wakes Claude on exit code 2.
  Implies async. The hook's stderr, or stdout if stderr is empty, is
  shown to Claude as a system reminder so it can react to a long-running
  background failure"`. Planner refetches at research time.
- `docs/research/claude-hook-config-syntax.md` § 7 § `asyncRewake /
  rewakeMessage / rewakeSummary family` — verdict IMPLEMENT (post
  2026-06-13 deep-dive); discusses `_pendingNextTurnMessages` plumbing
  in peer-dep `agent-session.js:790-794` + IDLE-vs-STREAMING branch at
  `:988`. § 13 has the full ~250 LoC implementation sketch — read
  before authoring the registry module.
- `docs/research/claude-hook-config-syntax.md` § 5 "Hook environment"
  lines 270-280 — env var contract Phase 62 inherits + extends with
  `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` (D-62-05 marker).

### Peer dep — Pi sendMessage / isIdle / CustomMessage

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — `ExtensionContext.sendMessage<T>({customType, content, display,
  details}, {deliverAs?: "steer" | "followUp" | "nextTurn",
  triggerTurn?})`. `display: false` is the
  `<system-reminder>`-equivalent. `deliverAs: "nextTurn"` queues at
  next user-prompt boundary; `"followUp"` injects mid-stream.
  `ExtensionContext.isIdle(): boolean` — used at exit-handler time to
  pick `deliverAs`.
- Same file, `CustomMessage<T>` type — `display: boolean` is a top-level
  field, `content` is `string | TextContent[]`, `customType: string`
  discriminator, `details?: T` optional plugin-defined payload.

### Codebase landing sites (Phase 62 introduces / extends)

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/`
  (NEW directory) — `registry.ts` (~250 LoC: in-memory Map +
  spawnAndRegister + per-child exit handler + ring-buffer state +
  PID-table sync); planner may split into `registry.ts` /
  `pid-table.ts` / `ring-buffer.ts` siblings if cohesion improves.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` —
  single-line addition near the top of `dispatchHookExec`: the
  `entry.handlerDecl.asyncRewake === true` check + delegation.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` —
  `registerHooksBridge` factory entry already houses `liveEpoch` bump +
  cache hydrate (D-59-02 / D-59-03); add the orphan-reap step in the
  same block. Single new function call.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` —
  `HOOK_HANDLER_SCHEMA` adds 3 properties (`asyncRewake`,
  `rewakeMessage`, `rewakeSummary`); `HookHandlerEntry` interface gains
  optional fields. Pattern: same as Phase 61's `if` field addition (D-61-03
  schema work).
- `extensions/pi-claude-marketplace/shared/debug-log.ts` — Phase 62
  emits debug-log warnings for every async-rewake error path
  (sendMessage failure, marker-check skip, ring-buffer fill, timeout
  overrun observed). NO new sink; reuse the existing one.
- `tests/architecture/no-shell-out.test.ts` — closed-set assertion
  amended from TWO to THREE sites atomically with the first
  registry.ts spawn site commit.
- `tests/architecture/hooks-async-rewake.test.ts` (NEW, file name
  Claude's Discretion) — pins HOOK-06 + EXEC-05 invariants: spawn
  options, exit-code-2 inject shape, exit-other silent, ring-buffer
  overflow `_truncated` flag, orphan reap + marker skip,
  declaration-order interleave, captured-epoch zombie defense.

### Phase 62 does NOT touch

- The `if` field implementation (Phase 61, complete)
- The matcher parser or tool-name table (Phases 58-59)
- Sync EXEC-01..04 timer ladder, env preparation, payload translation
  (Phase 60 surface is unchanged — async branch fires BEFORE it)
- SURF-05 install-time warning for orphan `rewakeMessage` /
  `rewakeSummary` (Phase 63)
- LIFE-01 cascade slot (Phase 63)
- Any orchestrator (install / update / reinstall / uninstall) — the
  registry is dispatch-time-only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`bridges/hooks/dispatch-exec.ts` `spawn` + timer ladder + env
  preparation** — Phase 60 D-60-* infrastructure. Phase 62's async
  branch reuses the env-var preparation (CLAUDE_PROJECT_DIR,
  CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, CLAUDE_ENV_FILE for
  SessionStart) verbatim. The `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>`
  marker is ADDED to the same env-build helper (Claude's Discretion: where
  exactly).
- **`bridges/hooks/exec-timer.ts` `installTimerLadder(...)`** — Phase 60
  SIGTERM → 5s → SIGKILL ladder. Phase 62's `spawnAndRegister` calls the
  same helper. Same cancellation contract (`child.once("exit",
  ladder.cancel)` + `child.once("error", ladder.cancel)`).
- **`bridges/hooks/translation-context.ts` `buildTranslationContext` +
  per-event translators** — Phase 60 payload translation. Phase 62's
  async branch uses these unchanged.
- **`shared/event-router.ts` `liveEpoch` cell + factory-entry bump**
  (Phase 59 D-59-03) — Phase 62 captures `liveEpoch` at
  `spawnAndRegister` time; exit handler compares against
  `currentEpoch()` before injecting. Zombie defense matches Phase 59's
  composite handler pattern.
- **`shared/debug-log.ts` `hookDebugLog`** (Phase 59 D-59-05) — Phase
  62's sole runtime output channel. All async-rewake errors route here.
- **`persistence/locations.ts` `locationsFor(scope)`** — Phase 62 uses
  `locationsFor(scope).hooksDataDir` (or equivalent — verify field name
  at research time) to locate the `_shared` dir.
- **NFR-1 atomic-write pattern** — the project's existing `state.json`
  write helper (`shared/atomic-json.ts` if it exists; otherwise the
  Phase 56 / 57 pattern). Phase 62's `async-rewake-pids.json` writes use
  the same helper.

### Established Patterns

- **Discriminated `installable: true | false` with `assertNever`** (NFR-7) —
  Phase 62 preserves. Async-rewake exit-handler routes use a small
  internal discriminated union (`OutcomeKind = "inject" | "silent" |
  "noop"` or similar); `assertNever` arm pins exhaustiveness.
- **Single notify emission per orchestrator invocation (RECON-04 /
  IL-2)** — Phase 62 binds ZERO new `ctx.ui.notify` emissions in the
  install/uninstall path. The only `notify` call is the runtime
  `rewakeSummary` UI status surface, gated on
  `entry.handlerDecl.rewakeSummary !== undefined`. Per IL-2, runtime
  notify is generally forbidden, but `rewakeSummary` is upstream-mandated
  UI behavior — document as IL-2 EXEMPTION in the architecture test.
- **NFR-2 `/reload` always suffices** — Phase 62's orphan-reap fires at
  every `registerHooksBridge` entry; a user typing `/reload` is the
  recovery path for any stuck state.
- **NFR-3 idempotent / fail-clean** — the persisted PID table is fully
  derivable from "what was running when we wrote it"; reading it
  multiple times is harmless. Atomic-write means partial writes never
  corrupt.
- **Single-file architecture-test fixture pattern** — Phases 57/58/59/60/61
  use inline truth-table fixtures in one file per concern. Phase 62
  follows: `hooks-async-rewake.test.ts` with inline fixtures.
- **`as const satisfies Record<..., ...>` closed-set gates** — the
  `no-shell-out.test.ts` whitelist + the captured-epoch tuple use this
  pattern.

### Integration Points

- `bridges/hooks/dispatch-exec.ts` — 1-3 LoC addition near the top of
  `dispatchHookExec`.
- `bridges/hooks/event-router.ts` — single new function call in
  `registerHooksBridge` (alongside `liveEpoch` bump + cache hydrate).
- `bridges/hooks/async-rewake/` (NEW dir) — module(s) per planner
  discretion.
- `domain/components/hooks.ts` — 3 schema property additions + 3
  interface field additions. Same pattern as Phase 61 `if` field.
- `tests/architecture/no-shell-out.test.ts` — atomic 2-→3 whitelist
  amendment.
- `tests/architecture/hooks-async-rewake.test.ts` (NEW) — closed-set +
  inline fixtures.
- Phase 62 does NOT touch: `orchestrators/*`, `domain/resolver.ts`,
  `domain/components/{hook-tool-names, hook-events, hook-if-targets}.ts`,
  `bridges/hooks/if-field/*` (Phase 61, complete), the catalog
  (`docs/output-catalog.md`), or `shared/notify.ts` REASONS set.

</code_context>

<specifics>
## Specific Ideas

- The user picked `dispatch-exec.ts` delegation (D-62-01) — matches REQ
  wording (separate `async-rewake/registry.ts` module) + keeps the
  executor seam from the reducer's POV unchanged. Single entry point,
  two paths inside.
- The user picked declaration-order interleave (D-62-02) — preserves
  upstream-faithful semantics + matches D-60-02's sequential-awaited-
  fan-out language. Plugin authors' mental model from the JSON shape
  is preserved.
- The user picked inherit EXEC-02 for timeout (D-62-03) — uniform
  timeout semantics across sync and async; matches upstream's "subject
  to handler's `timeout`" contract. Plugin authors don't have to
  remember a different default.
- The user picked ring-buffer + `_truncated` flag (D-62-04) — preserves
  the tail (typically what the model needs to react to in
  security-review-style use cases) + matches REQ EXEC-05 wording
  verbatim.
- The user picked single `async-rewake-pids.json` (D-62-05) +
  marker-env soft confirmation — matches the project's existing NFR-1
  atomic-write pattern; stranger-process protection on Linux (where
  `/proc/<pid>/environ` is available) with soft-skip on macOS / read
  failure. Conservative ("skip if unsure") path; better than risking
  killing a stranger.

</specifics>

<deferred>
## Deferred Ideas

- **SURF-05 install-time warning** (`rewakeMessage` / `rewakeSummary`
  declared without `asyncRewake: true`) — Phase 63. Phase 62 silently
  ignores the orphan-subordinate-fields case at runtime; Phase 63 wires
  the install-time warning.
- **`info <plugin>` rendering of async hooks** (SURF-01..02) — Phase 63.
  Async hooks render the same as sync hooks in the `hooks:` line; the
  `asyncRewake` flag is shown as a suffix or not at all (Phase 63's
  decision).
- **Docs (`docs/hooks.md`)** — Phase 63. The asyncRewake field family +
  use case (`security-guidance`-style deep background review) gets a
  worked example.
- **Cross-`/reload` PID-table migration** — if v1.14+ changes the
  registry shape, the persisted PID table's `version: 1` discriminator
  enables a migration path. v1.13 ships with version=1 hardcoded.
- **`ps`-based stranger detection on macOS** — v1.14+ if zombie leakage
  becomes a real problem. v1.13 soft-skips with debug-log; the corner
  case is rare.
- **`process.title` cosmetic naming for `ps` output** — Linux nicety.
  Skip unless architecture-test scaffold reveals real-world debugging
  need.
- **Bulk-spawn batching for buckets with many asyncRewake entries** —
  v1.14+ optimization. v1.13 spawns one-at-a-time inside the reducer;
  the cost is bounded by Phase 60's `maxBuffer` semantics already.
- **First-party plugin migration to asyncRewake** — v1.13 ships
  forward-compat only; no first-party plugin exercises asyncRewake
  under bucket-A-only scope. `security-guidance` is unavailable for
  other reasons. v1.14+ may unblock by promoting bucket-D events (Stop).
- **`setMaxListeners`-related warnings** — if many concurrent async
  children attach `child.on("exit", ...)` + `child.on("error", ...)`,
  Node may emit a "MaxListenersExceededWarning". The bridge owns the
  parent emitter (`process` itself), not per-child. Should be fine but
  flag for planner awareness.
- **Cross-platform PID table format compatibility** — if the bridge
  later runs on Windows (currently Linux/macOS only per Pi), the
  marker-check fallback path needs a Windows equivalent (read process
  env via `wmic` or `tasklist /v`). v1.14+.
- **`rewakeMessage` template substitution** (e.g., `{plugin}`,
  `{event}` placeholders inside the message string) — v1.14+
  ergonomic improvement. v1.13 passes the message string verbatim.

### Reviewed Todos (not folded)

- None — the `cross_reference_todos` step found no pending todos
  matching Phase 62's scope. The standing v1.12 orchestrator-coverage
  backlog item carried forward from Phases 57-61 remains unrelated.

</deferred>

---

*Phase: 62-`asyncRewake` Registry & Background-Spawn*
*Context gathered: 2026-06-15*
