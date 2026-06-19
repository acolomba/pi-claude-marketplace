# Pitfalls Research: v1.13 Claude Hook Bridge

**Domain:** Adding a hook-event-translation bridge alongside the existing skills/commands/agents/MCP bridges in `pi-claude-marketplace`. The bridge translates declarative Claude plugin hook configurations into runtime subscriptions on Pi's `pi.on(...)` event bus, with one composite handler per Pi event type, per-plugin matcher routing, payload translation for 16 supported Claude events (8 direct, 1 stable synthesis, 5 lossy synthesis, 2 soft-dep conditional), `fs.watch` for `FileChanged` synthesis, child-process shell-out per hook entry, and stdout-JSON contract round-tripping (notably `Stop`'s `{"decision":"block","reason":"..."}`).

**Researched:** 2026-06-13

**Confidence:** HIGH for system-specific pitfalls anchored to the locked v1.13 design in `docs/research/claude-hooks-vs-pi-events.md` and the v1.12 hard-won lessons in `.planning/milestones/v1.12-research/PITFALLS.md`; HIGH for `pi.on(...)` non-removability (verified from `types.d.ts` per authority §"Constraint: `pi.on()` is non-removable"); MEDIUM for cross-platform `fs.watch` failure modes (ecosystem signal from documented Node.js platform-specific notes).

---

## Summary

The v1.13 hook bridge introduces five structurally new failure modes on top of v1.12:

1. **`pi.on(...)` returns void.** There is no unsubscribe. The composite-handler-per-event design plus reload-driven lifecycle means a stale handler retained across `/reload` becomes a permanently-firing zombie, and a multi-Pi-process scope is a guaranteed double-dispatch unless the bus is per-process.
2. **`fs.watch` is the load-bearing primitive for `FileChanged`.** Its behavior differs in user-visible ways per OS, per filesystem, and per atomic-rename pattern. The bridge cannot fix these; it must document them and re-attach on inode loss.
3. **Five bucket-D events synthesize lifecycle from imperfect Pi signals.** Each synthesis has a documented loss mode (CwdChanged future-fragile, PostToolBatch race-on-error, UserPromptExpansion false-positive on other-extension transforms, Stop timing-shift, StopFailure provider-dependent). The bridge MUST make those losses visible in tests, not silent in production.
4. **Hook child processes are an arbitrary-code execution surface inside the agent loop.** Stdout-JSON parsing tolerance, timeout policy, stdout buffer bounding, exec-bit handling, and stderr surfacing are all new concerns. None existed for skills/commands/agents/MCP bridges.
5. **Hook-payload extensions (`asyncRewake`, future fields) demand a tolerant parser today.** Strict TypeBox validation rejects unknown fields by default; the bridge needs strip-then-validate plus an extension-field known list that's reviewed every Claude Code release.

Layered on top: every v1.12 invariant (atomic state.json writes, withLockedStateTransaction, ownership-guarded prune, byte-locked catalog, soft-degrade pattern, NFR-1/2/3/5/7/10/12, IL-2/3/4) MUST continue to hold. The pitfalls below are ordered by blast radius and tagged with the phase that owns prevention.

The pitfalls are partitioned into three classes:

- **Critical (1-12)** — data loss, contract break, runtime crash, or systematic silent failure. Must be designed for, not patched.
- **Moderate (13-22)** — correctness traps that ship as silent or partial drift if unaddressed.
- **Operational/UX/cross-cutting** — captured in the tables below.

---

## Critical Pitfalls

### Pitfall 1: Stale composite handler retained across `/reload` becomes a zombie dispatcher

**What goes wrong:**
The bridge registers exactly one composite `pi.on(piEvent, dispatcher)` per Pi event type at load time. `pi.on(...)` returns void (verified in authority doc §Constraint: `pi.on()` is non-removable, from `@earendil-works/pi-coding-agent` `types.d.ts`); there is no `off()`. The lifecycle contract is: on `/reload`, Pi tears down the extension runtime entirely (including the event bus subscriptions), the bridge re-loads, and re-registers fresh composite handlers built from the new desired-materialized set.

If `/reload` does not truly rebuild Pi's event bus, the old composite handlers from the previous bridge instance remain subscribed. After `/reload`, BOTH the stale and the fresh composite handlers fire on every event: every hook dispatches twice, modify-input chains run twice (producing wrong-but-plausible inputs), block-decisions race with non-deterministic winner, and the user sees ghost behavior from plugins they uninstalled.

Symptom shape: a hook that wrote a file writes it twice; a `PreToolUse` blocker fires for a plugin the user uninstalled five reloads ago; a `Stop` synthesis runs N+1 times after N reloads.

**Why it happens:**
The bridge has no way to defensively unregister — `pi.on(...)` returns void. The bridge is structurally dependent on the host honoring the teardown side of the lifecycle contract. This is a host-bug class, but the bridge can detect it and refuse to keep firing.

**How to avoid:**
- **Bridge-side instance epoch:** every composite handler closes over an `epoch` integer set at extension-load. A module-level mutable cell tracks the "live" epoch; on a fresh load, the live epoch is bumped before any handler runs. Every dispatcher checks `if (closure.epoch !== liveEpoch) return;` as its first line. Stale handlers from a previous load see a mismatch and no-op.
- **Detection test:** a smoke test that explicitly simulates the failure — load the bridge, install plugin A, force a second load WITHOUT teardown (test-harness only), trigger the event, assert exactly one dispatch (not two). The test pins the epoch-guard as load-bearing.
- **Document host contract:** README + bridge code comment near the registration site state "this bridge requires Pi to tear down `pi.on(...)` subscriptions on `/reload`; an epoch guard provides defense in depth."
- **Do NOT attempt unsubscribe heuristics** (e.g. re-registering an inert handler in hopes of overwriting); `pi.on` semantics are append-only per the authority doc.

**Warning signs:**
A hook fires N+1 times after N `/reload`s. An uninstalled plugin's hook still runs. Stop synthesis schedules multiple synthetic user messages per turn.

**Phase to address:**
Dispatch-core phase. Cross-phase verification: every payload-translator phase MUST verify exactly-once dispatch via integration tests after `/reload`.

---

### Pitfall 2: Mid-reload event delivery races the dispatch-table rebuild

**What goes wrong:**
Reconcile + bridge re-load happens at `/reload`. The bridge's reload sequence is approximately: (1) read state.json + per-plugin `hooks/hooks.json`, (2) build new dispatch table, (3) call `pi.on(...)` for each event type, (4) be ready to dispatch. There is a window between teardown of the previous extension instance and (3) where the event bus may already be live for OTHER subscribers; Pi may emit events during that window. Three failure shapes:

- Events fire and find no composite handler registered → plugin hooks silently miss those events (a `Stop` lost during reload appears as a hung agent that never auto-continues for ralph-wiggum).
- The bridge's load is partial when an event fires → the dispatcher exists for some events but not others, asymmetric drop.
- An event fires DURING dispatch-table construction → the dispatcher reads a half-built table and either no-ops or throws.

**Why it happens:**
`/reload` is conceptually atomic from the user's view but is multi-step in implementation; the host may not gate event delivery on extension readiness. The bridge has no signal that Pi has "finished" reload until its `session_start` callback (reason: "reload") fires.

**How to avoid:**
- **Build dispatch table BEFORE registering any `pi.on(...)`.** The table construction is synchronous in-memory; only after all entries exist do we register handlers. This eliminates the half-built-table window.
- **Document the dropped-during-reload contract:** the bridge cannot buffer events from BEFORE its load completes — by definition, the previous bridge instance was torn down and the new one hasn't subscribed. State explicitly that events fired during the reload window are dropped and that this is the same behavior as any other extension on `/reload`.
- **Test the contract:** integration test fires an event while reconcile is mid-pass (using a test-only synchronization point) and asserts the dispatcher either handles cleanly (post-registration) or is a no-op (pre-registration), never a crash.
- **Resolution decision (the architecture must pick one):** "drop cleanly" is the recommended default per the v1.12 NFR-2 recovery model (`/reload` suffices to converge; one missed event is recoverable by re-firing the trigger). "Buffer-and-replay" requires a Pi-side capability that doesn't exist today and should not be invented bridge-side.

**Warning signs:**
A plugin's `SessionStart` hook misses fire on `/reload` only (works on initial startup). Tests flake when an event triggers during reconcile.

**Phase to address:**
Dispatch-core phase + integration-test phase.

---

### Pitfall 3: Multi-Pi-process scope contention on hook dispatch

**What goes wrong:**
v1.12 cross-process locking (`withLockedStateTransaction`) covers state.json mutations; the lock is per-scope. But two Pi processes against the SAME scope (common: two terminals in the same project; an IDE + a CLI) BOTH load the bridge extension, BOTH read the same `state.json` and `hooks.json` files, BOTH register `pi.on(...)` composite handlers IN THEIR OWN PROCESS's event bus.

This is NOT a cross-process double-dispatch (each Pi process has its own event bus) — but it IS a cross-process double-execution of side-effecting hooks: when terminal A's user runs a tool, A's bridge dispatches; when terminal B's user runs the same tool, B's bridge dispatches. If the hook script writes to a shared file or invokes a network service, BOTH writes/invocations happen. The hook author wrote a hook expecting it to fire once per tool-call per user; it fires per (tool-call × process) instead.

A subtler variant: install hook in process A; process B is mid-session; A's bridge has updated state.json but B's bridge still has the old in-memory dispatch table. B's next event uses stale config until B reloads.

**Why it happens:**
Pi's event bus is per-process. Hook scripts have side effects. The user's mental model of "I installed a hook" is single-instance; the reality is "I declared a hook config that every Pi process in this scope will execute independently."

**How to avoid:**
- **Document the per-process semantics explicitly** in the bridge README. State: "If you run two Pi sessions against the same scope, hooks fire independently in each session. Side-effecting hooks (file writes, network calls, notifications) will run once per session per trigger. This matches Pi's per-process event-bus model and is not a bug."
- **NO bridge-side cross-process hook deduplication.** That would require a cross-process hook-execution lock (heavy, opaque, fights NFR-3 idempotency). Hook idempotency is the hook author's responsibility — same contract as Claude Code itself (Claude Code does not dedupe across windows).
- **State-config staleness is solved by `/reload`** (NFR-2). Process B sees A's install after B's next `/reload`. Tell the user this in the install-success message that already triggers the reload hint.
- **Containment of WRITES under the lock still holds:** v1.12 `withLockedStateTransaction` covers state.json + the v1.12 internal config bookkeeping; extend to cover the new per-plugin `hooks/<plugin>/hooks.json` writes at install/uninstall.

**Warning signs:**
A hook fires N times for a single tool call where N = number of open Pi terminals. A `SessionStart` hook's side effect (e.g. file creation) is duplicated when the user opens a second terminal.

**Phase to address:**
Install/uninstall phase (lock-scope extension) + documentation phase.

---

### Pitfall 4: `fs.watch` cross-platform brittleness silently breaks `FileChanged`

**What goes wrong:**
`FileChanged` is bucket B (stable synthesis), implemented via `fs.watch`. Pi's `session_start.watchPaths` is producer-only — the bridge owns the watch. `fs.watch` semantics are documented-unstable across platforms in ways that produce silent-miss failure modes:

- **Linux (inotify):** recursive watching landed in Node 20 (`{ recursive: true }`); v1.13's NFR-4 floor of Node 20.19.0 covers this. inotify is reliable for local filesystems; events delivered as `rename` or `change` strings. Editor saves via tmp+rename emit `rename` on the original path; the watch may or may not re-attach to the new inode automatically.
- **macOS (FSEvents):** `fs.watch` is FSEvents-backed; an editor save via "atomic save" (write tmp, rename over original) emits a coalesced `rename` event AND the watch loses the original inode. The new file at the original path is NOT watched until the bridge re-attaches. Debounce window for coalesced events typically ~10-100ms.
- **Windows (ReadDirectoryChangesW):** symlinks in watched dirs behave differently from macOS/Linux; recursive mode has been supported but with intermittent issues. Path normalization (forward-slash vs backslash) in event payloads is a known footgun.
- **Network/container FS (NFS, CIFS, Docker bind mounts on macOS Desktop):** events may be silently dropped; FSEvents does not propagate from the container's overlay FS to the host's bind-mounted view. No fix bridge-side.
- **ENOENT on replace (atomic rename across all platforms):** if the watched file is replaced (mv newfile oldfile), the watcher emits `rename` for the OLD inode's descriptor and silently goes deaf. No further events for THAT path until re-attach.

If the bridge doesn't handle re-attach on `rename`, `FileChanged` works for the FIRST edit and then silently stops. Plugin author thinks the hook is broken; bridge thinks the watch is fine.

**Why it happens:**
`fs.watch` is documented as "not consistent across platforms" in Node docs; ergonomics push developers toward "set up watch and trust it." The atomic-rename pattern is the dominant editor save model (vim, VS Code default, Emacs), so the failure is the common case, not the edge case.

**How to avoid:**
- **Always use `fs.watchFile` polling fallback OR re-attach logic on `rename`:** when `eventType === "rename"` and the path still exists at the moment of event handling, close the existing watcher and re-attach to the same path. Documented re-attach idiom.
- **Recommended: use a battle-tested wrapper** (`chokidar` is the de facto standard for this exact failure mode set; handles atomic-rename re-attach, polling fallback, debounce). Adding a runtime dep is acceptable for this concern because hand-rolling the re-attach + per-platform fallback matrix is exactly the brittle thing we're trying to avoid.
- **Bridge-side debounce window** (configurable, default 50ms) to collapse the rename+change pair into one `FileChanged` event per logical save. Without debounce, every save fires two hooks.
- **Cross-platform test matrix MANDATORY at the integration phase:** Linux + macOS + Windows × {direct edit, atomic-rename save, delete, rename, mkdir-in-watched-dir}. CI must run all three platforms or the bridge ships a known-broken `FileChanged` on at least one.
- **Document container/network-FS unsupported list in README:** "FileChanged is not reliable on Docker Desktop bind mounts on macOS, NFS, or CIFS. This is an `fs.watch` limitation, not a bridge bug." Do NOT silently swallow; tell the user.

**Warning signs:**
A `FileChanged` hook fires once after install, then never again. The hook works on Linux but not macOS for the same plugin. Saves through VS Code don't trigger, but saves through `echo > file` do.

**Phase to address:**
`FileChanged`-synthesis phase (bucket B implementation) + cross-platform CI integration phase.

---

### Pitfall 5: Hook child-process timeout absent → agent loop hangs indefinitely

**What goes wrong:**
Hooks are arbitrary shell commands. A buggy or hostile hook can:

- Hang indefinitely (no exit, no stdout, e.g. `read -p` waiting for stdin that never comes).
- Print stdout in a tight loop (memory exhaustion of the bridge's read buffer).
- Fork-and-detach a child process that survives the bridge's kill signal (orphaned process leak).
- Print invalid JSON (parse error in the dispatcher).
- Print JSON with extra trailing text — BOM, log line, debug print (parse fail or truncation).
- Print a valid-JSON object with unexpected `decision` value (e.g. `"unknown_value"`).

Without a timeout, a single bad hook freezes the agent loop. Without a stdout buffer bound, a runaway hook OOMs the Pi process. Without orphan cleanup, hooks pile up child processes.

This is NEW surface — v1.12 bridges (skills, commands, agents, MCP) do not exec arbitrary user-supplied scripts on the hot path of an LLM tool turn.

**Why it happens:**
Hook scripts are a deliberate extensibility point — by design the bridge cannot inspect them. The defaults of `child_process.spawn` are: no timeout, unbounded stdout buffer (per-read), no orphan cleanup. Every default is wrong for this use case.

**How to avoid:**
- **Per-hook timeout, configurable, with safe default.** Default 30s (matches Claude Code default; long enough for most legitimate work, short enough to bound user-visible hang). Configurable per hook entry via a future `timeout` field (parse-tolerant).
- **Kill signal escalation:** SIGTERM first, wait 2s, then SIGKILL. Use `child.kill('SIGTERM')` then `setTimeout(...) => child.kill('SIGKILL')`.
- **Bounded stdout/stderr buffers:** spawn with `{ maxBuffer: 1024 * 1024 }` (1MB default), or use streaming consumption with a hard byte count and early termination on overflow. On overflow, treat the hook as failed (no decision honored) and surface a notify-warning at next idle.
- **Orphan cleanup:** spawn with `{ detached: false }` so children die with the parent; on bridge shutdown (`session_shutdown`), iterate the live-child set and SIGKILL.
- **Invalid JSON → debug-log + treat as no-op continue.** Do NOT crash the dispatcher. Same for unknown `decision` values.
- **Tolerant JSON parsing:** strip BOM; if stdout has trailing non-JSON garbage, try to parse the longest valid JSON prefix; if that fails, no-op + debug-log.
- **stderr policy:** at runtime, debug-log only (do NOT route through `ctx.ui.notify` per-event — would spam). At install-time hook validation (if the bridge runs hooks at install to validate), surface stderr via `ctx.ui.notify` once.

**Warning signs:**
Agent loop hangs after installing a hook plugin. Pi RSS grows linearly with tool calls. `ps` shows orphan hook processes after `/reload`.

**Phase to address:**
Bridge-execution-runtime phase (the child-process layer).

---

### Pitfall 6: `Stop` synthesis breaks the block-to-continue JSON contract

**What goes wrong:**
`Stop` is bucket D, "lossy synthesis." Pi's `agent_end` is observation-only; it cannot keep the loop running. The authority doc's synthesis: bridge intercepts `agent_end`, enqueues a synthetic user message via `pi.sendUserMessage()` carrying the hook's `{"decision":"block","reason":"..."}` reason as content. The plugin's "block + reason" surfaces in the NEXT turn instead of folding into the current one.

Three failure modes:

- The bridge fails to round-trip the `decision`/`reason` shape — sends an empty user message, or a `JSON.stringify`-mangled blob, or drops the `reason` text → plugin author sees "Claude stopped" instead of "Claude continues with my reason text."
- The bridge fires `Stop` synthesis MULTIPLE times per logical agent end (Pi may emit `agent_end` more than once across compaction/fork/resume boundaries) → the loop never terminates; the user's prompt keeps re-firing forever. `ralph-wiggum` becomes ralph-wiggum-stuck.
- The bridge fires BEFORE all `tool_result` events have drained, or with stale `tool_result` context → the hook script receives a half-formed payload and emits an irrelevant block reason.

`ralph-wiggum` is the canary; it depends on this exact contract. If `Stop` synthesis is wrong, `ralph-wiggum` is broken in a way no other test catches because no other plugin loop-depends on the contract.

**Why it happens:**
Synthesizing a control event from an observation event is structurally lossy. The bridge has to invent a "fire once per logical end" contract that Pi's `agent_end` doesn't guarantee. And the JSON round-trip has many subtle ways to drift (escaping, encoding, missing fields).

**How to avoid:**
- **Round-trip pin test:** end-to-end test installs `ralph-wiggum`, simulates an agent turn that triggers `agent_end`, asserts that `pi.sendUserMessage` is called exactly once with a payload whose content includes the hook's reason text byte-equal. This is the canary.
- **`agent_end` idempotency guard:** track the last-handled `agent_end` identifier (turn ID, sequence number, or a content hash of the agent's final message). Re-firing `agent_end` for the same turn is a no-op. Pi may emit `agent_end` multiple times across compaction; the bridge must NOT synthesize `Stop` more than once per logical end.
- **Drain-then-fire:** if Pi emits `tool_result` events that may follow `agent_end` for the same turn, wait for an idle window (configurable, default 50ms after `agent_end`) before synthesizing. Document the window.
- **Block-loop safety:** if `Stop` synthesis fires more than N times (default 10) in a single bridge session for the same plugin, stop synthesizing and emit a one-shot notify-warning ("Stop synthesis loop detected for plugin X; further block-to-continue requests suppressed this session"). Prevents `ralph-wiggum` runaway from melting the user's API budget.
- **JSON parse + re-emit MUST be byte-faithful** for the `reason` field: parse, extract, re-stringify via `JSON.stringify(reason)` (not interpolation). Document the contract in the synthesis module's header comment.

**Warning signs:**
`ralph-wiggum` doesn't loop. Or `ralph-wiggum` loops without bound. The agent stops with the user's original prompt instead of the hook's reason. The synthesized user message renders as `[object Object]` in the transcript.

**Phase to address:**
Bucket-D synthesis phase (specifically `Stop`) + dedicated canary integration test.

---

### Pitfall 7: Hook-payload extension fields rejected by strict TypeBox validator

**What goes wrong:**
TypeBox in strict mode rejects unknown properties by default (`additionalProperties: false`). The Claude hook config schema includes documented fields like `command`, `matcher`, `timeout`. Claude Code's ecosystem has already added undocumented payload extensions like `asyncRewake`, `rewakeMessage`, `rewakeSummary` (observed on `security-guidance` in the first-party audit). Future Claude Code releases will add more.

If the bridge uses a strict schema, installing `security-guidance` fails at parse time with a validation error — the plugin is unusable. If the bridge uses a tolerant schema but doesn't debug-log unknown fields, new extensions go undetected and the bridge silently degrades behavior (e.g. `asyncRewake` is ignored and the hook fires synchronously, breaking the plugin author's intent silently).

Strip-then-validate is the only safe pattern, but two execution traps:

- Strip too aggressively (whole-payload-replace) → loses required `command` field.
- Strip on the wrong nesting level → the extension field at the hook-entry level is stripped, but a future field on the matcher level is missed.

**Why it happens:**
TypeBox defaults to strict; the bridge's natural posture (mirror v1.12's `STATE_SCHEMA` discipline) is strict validation. The forward-compatible parser posture (NFR-12) is documented for marketplace.json but not yet for hook config.

**How to avoid:**
- **Use TypeBox `additionalProperties: true`** (or equivalent `Type.Object({...}, { additionalProperties: true })`) at every nesting level of the hook config schema. Unknown fields parse cleanly.
- **Maintain a known-extension list** (`asyncRewake`, `rewakeMessage`, `rewakeSummary` at v1.13 start). Fields IN the list emit a one-shot `notify` warning at install time ("plugin X uses async-rewake; bridge runs synchronously in-band"). Fields NOT in the list debug-log only.
- **Strip-then-validate is NOT needed if the schema is tolerant** — the unknown fields are accepted, observed, and logged. The validator's job is to ensure the KNOWN fields are well-typed.
- **Round-trip preservation:** unknown fields are preserved in the in-memory representation (don't strip-on-read; preserve-on-read), so a hypothetical `info` command can show the full hook config including extensions.
- **Review cadence:** known-extension list is reviewed at every Claude Code release; document the review trigger ("when Claude Code's `code.claude.com/docs/en/hooks` page changes, audit for new fields").
- **NFR-12 extends to hook config:** explicitly document that the hook parser is forward-compatible like the marketplace parser.

**Warning signs:**
Installing `security-guidance` (or any plugin with `asyncRewake`) fails. After a Claude Code release, plugins start failing to install with schema errors. New unknown-field debug logs spike (a signal to refresh the known list).

**Phase to address:**
Hook-config parser phase + bridge schema definition.

---

### Pitfall 8: Matcher translation silently treats regex as literal

**What goes wrong:**
v1.13 supports literal tool names and pipe-OR alternation only. Full regex is deferred (authority doc confirms 100% first-party coverage without it). But Claude Code itself supports regex matchers (e.g. `Edit.*`, `mcp__.*`). A user installing a third-party plugin with a regex matcher hits one of three failure modes:

- Bridge treats the regex string as a literal tool name — never matches → hook silently never fires.
- Bridge passes the string to `new RegExp(...)` accidentally somewhere → matches more than intended, fires for unrelated tools.
- Bridge throws at parse time without a clear error → install fails opaquely.

The lesser problem: pipe-OR parsing splits on `|`. A literal `|` in a tool name (none exist today, but the bridge must be future-proof) gets silently mis-split.

The lesser problem #2: Claude allows empty matcher (`""`) meaning "match all events" (no filtering). The bridge must support; do not silently drop.

**Why it happens:**
Matcher strings are untagged — there's no `kind: "literal" | "regex"` marker. Detection is heuristic.

**How to avoid:**
- **Regex-detection heuristic at install time:** any matcher containing characters outside `[A-Za-z0-9_|\-]` (or a tightened character class matching Claude's tool-name conventions, plus `|`) is treated as regex and REJECTED at install with a clear `notify` error: "Plugin X uses a regex matcher (`Edit.*`); the bridge supports only literal tool names and pipe-OR alternation in v1.13. Hook entry skipped."
- **The plugin install is NOT blocked** — the offending hook entry is skipped, other entries install. Soft-degrade per row (v1.12 pattern).
- **Pipe-OR parsing rule:** split on unescaped `|`; document that literal `|` requires escaping (none in practice today; document the contract).
- **Empty matcher (`""`) explicitly = match all.** Test fixture: matcher `""` fires for every event of that kind.
- **Tool-name mapping table:** Claude's tool naming (`Edit`, `Bash`, `mcp__name__tool`) vs Pi's `event.toolName` field. The bridge must use Pi's name. Document the mapping in a fixture/test and update on Pi tool additions. MCP tools follow the `mcp__server__tool` convention on both sides per current docs — verify at bridge-implementation time.
- **Test taxonomy:** literal, pipe-OR, empty, invalid-regex-rejection, MCP-tool-naming.

**Warning signs:**
Hook never fires for a plugin with a `.` in its matcher. Bridge install of a known-good third-party plugin fails with opaque error. `security-guidance`'s `Edit|Write|MultiEdit|NotebookEdit` matcher routes for the wrong subset of tools.

**Phase to address:**
Matcher-translation phase (part of dispatch core).

---

### Pitfall 9: State.json schema bump corrupts v1.12 cross-version concurrency

**What goes wrong:**
v1.13 adds a `hooks` field to the per-plugin install record (parallel to `resources.{skills,prompts,agents,mcpServers}`). This is a `state.json` schema change. Three failure paths:

- The schema version is NOT bumped (current `schemaVersion: 1` reused). A future v1.14 reader can't distinguish v1.12-shape from v1.13-shape state.json. Migration becomes ambiguous.
- Schema version IS bumped to 2, but migration runs partially: load reads v1.12 state, computes v1.13 in-memory shape, but is interrupted between read and write. Next load reads partial state.
- A user reverts to v1.12 code after running v1.13. v1.13 state.json has the new `hooks` field; v1.12's `STATE_VALIDATOR.Check(state)` (strict TypeBox) REJECTS unknown fields and refuses to load → user can't open the project until they delete state.json (mass loss).

The current `STATE_SCHEMA` per `state-io.ts` is strict; `Type.Object` with no `additionalProperties: true`. A v1.12 reader on a v1.13 file fails validation.

**Why it happens:**
TypeBox strict by default. The v1.12 schema didn't anticipate forward-compat readers (the design was "we own state.json, schema bumps are linear"). Hooks add a new dimension that the v1.12 code can't round-trip even if told to ignore.

**How to avoid:**
- **Bump `schemaVersion` to 2** for v1.13. Both reader-and-write-back logic must handle v1 → v2 migration (additive: add `hooks: []` to every plugin record where absent).
- **Migration runs inside `withLockedStateTransaction`** covering the full read + transform + write cycle. Reuse the v1.12 lock-fcommit-fsync ordering pattern.
- **Migration is idempotent (NFR-3):** running twice produces the same result. Test: load v1 state, save, load again, no second migration.
- **Defensive: relax `STATE_SCHEMA` to allow unknown fields at the per-plugin level** with `additionalProperties: true`. A v1.13 reader on a hypothetical v1.14 file (future hooks-2 field) tolerates unknown fields and preserves them on round-trip.
- **Downgrade safety: document that downgrading from v1.13 to v1.12 requires deleting state.json** (v1.12 cannot read v2 because v1.12 was strict). Add this to the CHANGELOG. Alternatively (and preferable): SHIP a v1.12 patch release that relaxes `STATE_SCHEMA` BEFORE v1.13 ships, so the v1.12 floor is forward-tolerant. This requires a coordinated release; document the decision.
- **The v1.12 `loadState` already revalidates after migration** (`state-io.ts:223`). Test that the v1.13 migration flows cleanly through revalidation — no transient invalid-shape state escapes the read.
- **State-split discipline (v1.12 lesson):** the `hooks` field on the install record holds RESOLVED hook entries (machine bookkeeping). The user-authored config in `claude-plugins.json` does NOT mirror this — hooks declared by the plugin come from its `hooks.json`, not from the user's desired-state config. Confirm this split in the v1.13 design.

**Warning signs:**
v1.13 install runs; user reverts to v1.12; v1.12 errors with "state.json failed schema validation: /marketplaces/.../plugins/.../hooks: additional property." The error message names `hooks` as the unknown field.

**Phase to address:**
State-schema migration phase (early in the milestone, BEFORE any hooks feature lands).

---

### Pitfall 10: Soft-dep `pi-subagents` event-name drift crashes the bridge

**What goes wrong:**
`SubagentStart`/`SubagentStop` are conditional on `pi-subagents` per the authority §Soft-dep extension event surfaces. The bridge subscribes via `pi.events.on("subagent:async-started", ...)` and `pi.events.on("subagent:async-complete", ...)`. The audit confirms these names at `pi-subagents@0.24.3` are stable exported constants from `src/shared/types.ts:443-447`.

Three failure modes:

- pi-subagents renames the events in a future release (e.g. `subagent:async:started` with a colon namespace) → bridge subscribes to stale names → `SubagentStart` synthesis silently never fires.
- pi-subagents removes the events entirely → same silent-miss.
- The bridge subscribes when pi-subagents is NOT installed → `pi.events.on` may throw (if `pi.events` requires a producer to exist) or silently no-op. The authority doc implies `pi.events` is the shared bus; verify at implementation time.

For sync-mode subagent runs, the bridge synthesizes from `pi.on("tool_call", ...)` and `pi.on("tool_result", ...)` filtered on `event.toolName === "subagent"`. If Pi changes the canonical tool name (e.g. `subagents` plural, or `pi-subagents:run`), the filter never matches → sync-mode `SubagentStart` synthesis silently never fires.

**Why it happens:**
The bridge depends on a stringly-typed event surface exposed by another extension. Renaming the constant in pi-subagents is a non-breaking change FROM pi-subagents's perspective (its API is `pi.events.emit(...)` with whatever name it chooses); the breaking is observed only at the cross-extension subscription seam.

**How to avoid:**
- **Defensive subscribe:** wrap `pi.events.on(...)` in try/catch. If the call throws, soft-degrade with a debug log ("pi-subagents events surface unavailable; SubagentStart/Stop synthesis disabled"). Bridge install does NOT block.
- **Version-pin the soft-dep:** declare a minimum pi-subagents version in the bridge's known-soft-dep table; if `pi.subagentsVersion` (or equivalent probe) returns lower, fall back to the sync-only synthesis (no async events).
- **Synthesis-failure is a soft-degrade:** the v1.12 per-row `{requires pi-subagents}` marker model is reused. When pi-subagents is absent OR its event surface drifted, the bridge surfaces the marker on the plugin's install row and on `info`.
- **Contract test against an installed pi-subagents:** integration test loads pi-subagents and the bridge in the same Pi process, fires a real subagent run, asserts the bridge's `SubagentStart` synthesis emitted exactly one event with the expected shape. This test fails LOUDLY if pi-subagents renames or removes the constants.
- **Sync-tool-name mapping is a contract test:** assert `event.toolName === "subagent"` for a known sync subagent run via integration test. If Pi or pi-subagents rename, the test fails.
- **Open question for verification:** does Pi emit `tool_call`/`tool_result` for sync subagent runs at all? The authority doc says yes (per pi-subagents observing itself via the same path), but verify at implementation time. If not, sync subagent synthesis is impossible and the bridge debug-logs "sync subagent runs do not emit tool events; SubagentStart synthesis limited to async-mode."

**Warning signs:**
After upgrading pi-subagents, `SubagentStart` hooks stop firing. Sync subagent runs (when the user uses pi-subagents without `--async`) never fire `SubagentStart`. The bridge crashes on load when pi-subagents is uninstalled mid-session.

**Phase to address:**
Soft-dep wiring phase (the `SubagentStart`/`SubagentStop` synthesis).

---

### Pitfall 11: Per-plugin containment failure escapes scope root

**What goes wrong:**
NFR-10 containment refuses writes outside the allow-set. v1.13 adds NEW write targets:

- `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (the per-plugin resolved hook config).
- Possibly `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/*.sh` (hook scripts — actually these live inside the plugin tree per authority §State layout, NOT relocated; verify).

Failure modes:

- Plugin name contains `/` or `..` (e.g. `foo/bar`, `../etc`). Bridge's path-join produces a path outside the plugin's own subtree. `assertPathInside` must catch this.
- Symlinked `hooks/<plugin>` pointing outside the per-plugin subtree. Containment check on the SYMLINK target (via `realpath`), not the link.
- Case-insensitive filesystem (macOS HFS+ default, NTFS): two plugins differing only in case (`Foo`/`foo`) collide in the hooks subdirectory.
- Plugin's `hooks.json` references a hook `command` path that is an absolute path outside the plugin tree (e.g. `/etc/passwd`). The bridge EXECUTES that as a hook script.

**Why it happens:**
v1.12 containment is established for the v1.12 write surfaces; v1.13 introduces a NEW write target (`hooks/<plugin>/`) that must be added to the allow-set. Plugin-name validation already exists for v1.12 (per existing components). The hook-script-path-escape is novel: skills/commands/agents/MCP bridges don't execute arbitrary paths from manifest data.

**How to avoid:**
- **Add `<scopeRoot>/pi-claude-marketplace/hooks/` to `assertPathInside` allow-set.** Test that a crafted write outside this is refused.
- **Reuse v1.12 plugin-name validation** for the hooks subtree. Verify the same sanitization rejects `/`, `..`, and case-collision (v1.12's handling is the reference).
- **Containment check on RESOLVED real paths** (via `fs.realpath`), not on the literal joined path. Catches symlink escapes.
- **Hook `command` path containment:** every `command` in a parsed `hooks.json` MUST resolve to a path inside the plugin's OWN tree (`<scopeRoot>/pi-claude-marketplace/plugins/<plugin>/`). Reject at install. Test: `command: "/etc/passwd"` rejected; `command: "../other-plugin/script.sh"` rejected; `command: "./hooks/run.sh"` accepted.
- **Document the contract:** hook scripts live in the plugin tree (NFR-10 extension); the bridge does NOT relocate them. Per authority §"Per-plugin file isolation", hook scripts are exec'd by absolute path inside the plugin's tree.

**Warning signs:**
Install of a malicious plugin writes outside `<scopeRoot>/pi-claude-marketplace/`. A hook script execs `/usr/bin/something` instead of the plugin's script. Two plugins with name collision on case-insensitive FS clobber each other's `hooks.json`.

**Phase to address:**
Containment phase (NFR-10 allow-set extension) + plugin-name validation (reuse).

---

### Pitfall 12: Output-channel (IL-2) violation when surfacing hook stderr

**What goes wrong:**
IL-2 forbids direct `process.stdout`/`process.stderr` writes in bridge code; all user-visible output goes through `ctx.ui.notify`. v1.13 introduces a new output source: hook child-process stderr. Three failure modes:

- Bridge captures hook stderr and writes it directly to `process.stderr` (or `console.error`) → violates IL-2.
- Bridge re-emits EVERY stderr line via `ctx.ui.notify` at runtime → notification spam (a chatty hook produces hundreds of notify calls per tool turn).
- Bridge adds a NEW sanctioned `console.warn` callsite for hook stderr → violates the IL-3 "single sanctioned console.warn" contract.

The hook's OWN stdout/stderr writes are NOT IL-2 violations (it's the hook's process, not bridge code). The violation is in HOW the bridge surfaces them.

**Why it happens:**
The natural debugging move is `console.error(stderr)` for diagnostics. The natural user-facing move is `notify(stderr)`. Neither is right by default.

**How to avoid:**
- **Runtime hook stderr: debug-log only.** The bridge has a debug-log channel (verify v1.12's pattern; if absent, a passive sink that the user can opt into via env var, NOT a notify). NO `ctx.ui.notify` per-event.
- **Install-time hook validation stderr** (if the bridge runs hooks at install): surface ONCE per install via `ctx.ui.notify` warning if non-empty.
- **NO new sanctioned `console.warn`.** The IL-3 contract preserves ONE callsite (`persistence/migrate.ts`); v1.13 does not add a second.
- **Existing logger reuse:** if v1.12 has a debug-log seam, hook stderr uses it. If not (likely), document that hook stderr at runtime is dropped to nowhere by default. Operators can opt in via PI_LOG_LEVEL or equivalent.
- **Test: no direct stdio in bridge code.** Reuse v1.12's ESLint BLOCK A (no-console + no-restricted-syntax for `process.stdout`/`process.stderr`); hook-runtime code is in scope for BLOCK A.

**Warning signs:**
ESLint BLOCK A trips on a new file in the hook-runtime layer. A chatty hook spams the notification pane. A second `console.warn` exemption is requested.

**Phase to address:**
Bridge-execution-runtime phase + ESLint enforcement.

---

## Moderate Pitfalls

### Pitfall 13: `CwdChanged` synthesis is future-fragile and parse-fragile

**What goes wrong:**
Bucket-D synthesis watches `tool_result` for `bash` tool calls matching `cd` patterns; compares resulting `ctx.cwd` against last known. Today bash is the only cwd-changing tool in Pi. Two latent failures:

- A future Pi tool changes cwd (e.g. a `chdir` tool, a project-switch tool). The bridge's `bash`-only filter silently misses → `CwdChanged` hooks never fire for that vector.
- A user runs `cd a && cd b && cd c` in one bash call — compound shell. Parsing for `cd` only catches the first; the bridge's `ctx.cwd` diff captures the FINAL cwd, but the synthesis fires once instead of three times. Spec-wise, Claude's `CwdChanged` fires per-change; bridge fires per-tool-call.

Also: a hook child process's `process.chdir()` must NOT mutate Pi's cwd. Child processes inherit cwd but cannot affect parent — verify via spawn options (`cwd: pi.ctx.cwd` explicitly, isolating child).

**Why it happens:**
Synthesis from observation is inherently approximate. The "bash-only" assumption is a snapshot of Pi's current tool surface.

**How to avoid:**
- **Pin "bash-only" as the contract via test.** Future Pi tool additions surface as test failures (not silent misses). Add an inventory test: "if Pi adds a tool that changes cwd, this test asserts the bridge's filter covers it OR fails so we know to extend."
- **Document the per-tool-call vs per-change discrepancy** in the bridge README. Plugins relying on per-`cd` granularity see one event per tool call, not per `cd`.
- **Child-process isolation: spawn hook children with `cwd: <pi.cwd>` explicitly.** Test that a hook's `cd /tmp; pwd` does not affect Pi's next tool call.

**Phase to address:**
Bucket-D synthesis phase.

---

### Pitfall 14: `PostToolBatch` count-races against cancellation

**What goes wrong:**
Bucket-D synthesis counts `tool_execution_end` against the assistant message's tool-call count. If a tool errors before emitting `tool_execution_end`, the count never reaches expected → `PostToolBatch` never fires. Bridge fires a safety net from `turn_end`, but the safety net produces a different payload shape than the in-band fire (no per-tool-result aggregation; just "batch done").

**How to avoid:**
- **Safety-net fire from `turn_end` with a documented "approximate" marker** in the synthesized payload (`source: "fallback"` field).
- **Timeout-based fire:** if N seconds pass after the last `tool_execution_end` and the count is non-zero but below expected, fire with the partial results. Document the timeout.
- **Test: cancellation-mid-batch coverage.** Trigger a batch where one tool errors before `tool_execution_end`; assert `PostToolBatch` fires exactly once via safety net.

**Phase to address:**
Bucket-D synthesis phase.

---

### Pitfall 15: `UserPromptExpansion` false-positives on other-extension transforms

**What goes wrong:**
Synthesis diffs `input.text` against `before_agent_start.prompt`. ANY transform — by ANOTHER extension's `input` handler — looks like an expansion. Plugin hooks `UserPromptExpansion` and fires for non-slash-command prompts that another extension rewrote.

**How to avoid:**
- **Guard: only fire when `input.text.startsWith("/")`.** Reduces false positives to "another extension rewrote a slash-command-looking input" — narrow case.
- **Document as best-effort.** README states "fires on input transforms after slash-command detection; may include other extension's rewrites."
- **Test: cover real expansion AND inter-extension transform paths** so the false-positive is visible and characterized.

**Phase to address:**
Bucket-D synthesis phase.

---

### Pitfall 16: `StopFailure` classifier diverges from Claude's error types

**What goes wrong:**
Bridge tracks HTTP status from `after_provider_response`; classifies non-2xx into matcher values (`rate_limit`, `overloaded`, `authentication_failed`). The classifier is bridge-owned code. Two failures:

- A provider returns a non-2xx with a body the bridge doesn't recognize → classified as `unknown`, plugin's matcher for `rate_limit` never matches even when it's really a rate-limit.
- A provider swallows the HTTP error and surfaces as text deltas (Anthropic does this sometimes for rate-limit during streaming) → no non-2xx ever observed → `StopFailure` never fires.

**How to avoid:**
- **Maintain a documented classifier table** in code. Reviewed at each Claude Code release.
- **Contract test against Pi's `after_provider_response` shape** — assert the bridge's expected fields exist. If Pi changes the shape, test fails.
- **Document the silent-miss for in-stream errors.** Plugin authors need to know.

**Phase to address:**
Bucket-D synthesis phase.

---

### Pitfall 17: Hook execution order across plugins is non-deterministic

**What goes wrong:**
Two enabled plugins both hook `PostToolUse` for `Edit`. Claude Code orders by marketplace declaration / settings precedence. The bridge's dispatcher iterates the dispatch table — order depends on iteration order of the underlying map. Without an explicit sort, the order may differ between processes, between reloads, and between Node versions (`Map` iteration is insertion-ordered, which is OK if insertion order is deterministic — but is it?).

Modify-input chains care about order. Block-first-wins cares about order. Inject-context concatenation cares about order.

**How to avoid:**
- **Explicit deterministic sort at dispatch-table build time** — by (marketplace declaration order, plugin install order). Document the sort.
- **Test: install plugins A, B, C with overlapping `PostToolUse` matchers; verify dispatch order matches declared order across multiple loads.**
- **Match Claude Code's observed order** where feasible (preserves plugin-author intent). Document deviations.

**Phase to address:**
Dispatch-core phase.

---

### Pitfall 18: Hook exec bit absent on Unix; Windows has no chmod

**What goes wrong:**
Plugin tree as distributed may not have `+x` on hook scripts. Per authority §Operational gotchas: bridge needs to `chmod` on install (Unix) or invoke via the shebang interpreter directly. Windows requires the interpreter-invocation path.

Failure shape: hook fails with EACCES (Unix) or "is not recognized as an internal or external command" (Windows). Plugin appears broken on install; root cause is undocumented exec-bit handling.

**How to avoid:**
- **Unix install: `chmod +x` every script under `plugins/<plugin>/hooks/`.** Test: install a plugin whose tarball lacks exec bits; verify hooks fire.
- **Windows: parse shebang and invoke interpreter explicitly** (`bash`, `python`, `node`). Document Windows requirement: interpreters must be on PATH.
- **Cross-platform fallback: if shebang absent on Windows, fail at install with a clear `notify` error.** Plugin authors should ship shebangs.

**Phase to address:**
Install phase + cross-platform integration tests.

---

### Pitfall 19: Bucket-H silent drop confuses plugin authors

**What goes wrong:**
The 5 bucket-H events (`ConfigChange`, `Setup`, `InstructionsLoaded`, `TaskCreated`, `TaskCompleted`) parse cleanly but never register a dispatcher. Debug-log only. NO install-time warning per locked design (would be noise).

A plugin author tests their plugin against Claude Code, ships it, a user installs under Pi, the hook silently never fires. The author has no signal until the user reports "your hook doesn't work."

**How to avoid:**
- **Surface bucket-H drops via `info` command.** `/claude:plugin info <plugin>` shows the hook config including a `{not supported on Pi}` per-hook marker for bucket-H events. The marker is in the `info` output, not in install output.
- **Bridge README documents the 5 bucket-H events** with the rationale per authority §"H — Semantically inapplicable to Pi". Plugin authors checking compatibility find the list quickly.
- **Keep the install-time silence** per locked design — `info` is the right surface for per-hook detail.

**Phase to address:**
Documentation phase + `info` command extension.

---

### Pitfall 20: Reload-hint discipline violated by hook install/uninstall

**What goes wrong:**
v1.4.1 reload-hint discipline: the `/reload to pick up changes` trailer is plugin-row-driven. Hook install/uninstall MUST surface a plugin row (`installed`/`uninstalled`) that triggers the reload hint — because hooks ONLY take effect after `/reload` (the `pi.on(...)` non-removability constraint).

Failure: install path emits no row OR emits a non-state-change row → reload hint suppressed → user doesn't reload → hooks don't fire → "your bridge doesn't work."

**How to avoid:**
- **Hook install/uninstall MUST flow through the v1.4 `NotificationMessage` model and produce a `(installed)`/`(uninstalled)` plugin row.** Reuse v1.4's reload-hint cascade.
- **Test: install a hooks-only plugin; assert the notify output contains the reload hint.**
- **Catalog UAT extension:** add hooks-component install/uninstall fixtures to the byte-locked catalog.

**Phase to address:**
Install/uninstall phase + notification (catalog amendment in lockstep per v1.3/v1.4 discipline).

---

### Pitfall 21: Hook input payload size unbounded

**What goes wrong:**
Hook receives JSON via stdin (Claude convention). The payload includes tool-call inputs/outputs. A `Bash` tool result with 10MB of stdout produces a 10MB stdin write to the hook process. Failure modes:

- Hook's stdin buffer fills, hook blocks → bridge's write hangs.
- Hook OOMs trying to parse the JSON.
- Bridge serialization itself is slow for large payloads.

**How to avoid:**
- **Truncate `tool_result` content in the hook payload at a documented limit** (e.g. 256KB). Add a `_truncated: true` marker so the hook knows. Match Claude Code's convention if documented.
- **Stream-write stdin** to avoid blocking on small hook buffers.
- **Test: a 10MB tool result fires a hook without hanging or OOMing.**

**Phase to address:**
Bridge-execution-runtime phase.

---

### Pitfall 22: Hook config absent (`hooks/hooks.json` missing) treated as error

**What goes wrong:**
Per authority §"Sparse plugin trees": `plugin-dev` has no `plugin.json` in tree. Similarly, many plugins have no `hooks/hooks.json` (most don't hook anything). The bridge's loader must tolerate absence — "iterate, parse if present."

Failure shape: bridge throws ENOENT on a plugin with no hooks, blocking install of every hooks-less plugin (which is most of them).

**How to avoid:**
- **Absence of `hooks.json` is a no-op:** contribute zero entries to the dispatch table; no warning; no error.
- **Test: install a hooks-less plugin; verify install succeeds and no hook entries register.**
- **Same tolerance for `plugin.json` `hooks` block absence** — many manifests don't declare it.

**Phase to address:**
Hook-config loader phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Skip the bridge-side epoch guard on composite handlers | Less code | Stale handler from prior `/reload` runs forever; ghost dispatches | Never — defense in depth for a void-returning `pi.on(...)` |
| Use `fs.watch` directly without re-attach on `rename` | One fewer dep | `FileChanged` works once per editor save then silently dies on macOS/Linux atomic-rename | Never — adopt `chokidar` or hand-roll re-attach |
| Strict TypeBox schema for hook config | Mirrors v1.12 state schema | `security-guidance` and every future-extension-using plugin fails to install | Never — use `additionalProperties: true` + known-extension list |
| No timeout on hook child processes | Simpler spawn | Bad hook freezes the agent loop forever; bridge becomes a DoS surface | Never — default 30s timeout + SIGTERM/SIGKILL escalation |
| Reuse v1.12 `schemaVersion: 1` for the new `hooks` field | One fewer migration | v1.12 readers fail on v1.13 files; downgrade requires deleting state.json | Never — bump to 2; ship a v1.12 patch that relaxes the schema first |
| Treat regex matchers as literals silently | Less code | Third-party plugin hooks silently never fire; users blame the bridge | Never — detect-and-reject with clear install-time error |
| Surface hook stderr via `ctx.ui.notify` per-event | Visible diagnostics | Notification spam for chatty hooks; user disables the bridge | Only at install-time validation, never at runtime |
| `Stop` synthesis fires on every `agent_end` without idempotency | Simpler code | `ralph-wiggum` loops forever; API budget melted | Never — idempotency guard + N-loop safety cap |
| No cross-platform CI for `fs.watch` | Faster CI | `FileChanged` ships broken on macOS/Windows | Never — multi-OS matrix is mandatory for bucket B |
| Defer the `info`-command `{not supported on Pi}` marker | Smaller scope | Plugin authors have no signal about bucket-H drops | Acceptable for v1.13.0 if README documents the 5 bucket-H events prominently |
| Skip the `tool_result` payload truncation | One fewer feature | A 10MB bash result hangs or OOMs the hook | Acceptable for V1 IF a known-issues note ships; better to truncate from day one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| `pi.on(...)` (void return) | Assume there's an `off()` or attempt unsubscribe heuristics | Trust the `/reload` lifecycle; add epoch guard for stale handlers |
| `pi.events.on("subagent:async-started")` (string surface) | Hard-code the constant in bridge | Defensive try/catch + version-pin pi-subagents floor; soft-degrade on failure |
| `fs.watch` | Set up watch and trust it across platforms | Use `chokidar` (or re-attach + debounce + polling fallback hand-rolled); cross-platform CI mandatory |
| Hook child process | Default spawn options (no timeout, unbounded buffer, no orphan cleanup) | Per-hook timeout (default 30s); maxBuffer 1MB; SIGTERM→SIGKILL escalation; track live children for shutdown cleanup |
| Hook stdout JSON | Strict parse on raw stdout | Strip BOM; longest-valid-prefix tolerance; invalid → no-op + debug-log (never crash) |
| Hook stdin payload | Send full unmodified `tool_result` | Truncate at documented limit (256KB) with `_truncated: true` marker |
| TypeBox hook config schema | Default strict (`additionalProperties: false`) | `additionalProperties: true` at every level; known-extension list for warnings |
| `withLockedStateTransaction` scope | Lock covers only state.json | Extend to cover `hooks/<plugin>/hooks.json` writes at install/uninstall |
| `assertPathInside` allow-set | v1.12 allow-set only | Add `<scopeRoot>/pi-claude-marketplace/hooks/` to allow-set |
| `ctx.ui.notify` for hook stderr | Re-emit every stderr line at runtime | Debug-log at runtime; notify only at install-time validation |
| Containment for hook `command` paths | Trust the plugin's declared path | `fs.realpath` + assert inside plugin's own tree |
| v1.4 `NotificationMessage` model | Hook install row uses ad-hoc strings | Reuse `installed`/`uninstalled` plugin rows so reload-hint cascade fires |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Bridge spawns hook child on EVERY `tool_call` event | Agent loop slows linearly with hook count | Match Claude Code's per-event spawn model (unavoidable); document; users self-throttle by removing slow hooks | Always — fundamental to the model |
| `FileChanged` watchers proliferate (one per matcher per plugin) | inotify limit hit (default 8192 watches on Linux) | Coalesce watchers per path; use recursive watch with a single watcher per root; document inotify-limit symptoms | Heavy projects with many plugins + many watch paths |
| Hook stdout buffer unbounded | Bridge OOMs on a runaway hook | `maxBuffer: 1MB`; overflow → kill hook + treat as failed | A single bad hook |
| Hook payload serialization for large tool results | Per-event latency grows with tool output size | Truncate at 256KB; document | 10MB+ bash stdout |
| Dispatch table rebuild on every event (cache miss) | Per-event CPU bound | Build once at load; freeze; only rebuild on `/reload` | Always if mis-implemented |
| `Stop` synthesis enqueues `sendUserMessage` without rate-limit | Runaway loop; API spend | N-fire safety cap per plugin per session (default 10) | `ralph-wiggum` misbehavior |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Hook `command` path is an arbitrary absolute path | Plugin escapes its own tree (e.g. runs `/etc/shadow`-reading script) | Containment: realpath + assert inside `<scopeRoot>/pi-claude-marketplace/plugins/<plugin>/` |
| Hook child inherits Pi's env unfiltered | Plugin reads `ANTHROPIC_API_KEY` etc. from env | Document that hooks see Pi's env (matches Claude Code); operator must scrub before launching Pi if concerned |
| Auto-update brings in a hook from a malicious commit | Supply-chain: a teammate's push auto-installs a malicious hook | Reuse v1.12 autoupdate opt-in per entry; no hook-specific bypass; install-time `notify` lists newly-introduced hook scripts |
| Hook stdin includes secrets from tool_result (e.g. `aws sts get-caller-identity` output) | Plugin sees credentials | Same as Claude Code; document; do not invent filtering — that breaks legitimate hook use cases |
| Bucket-H drop silently ignored by a plugin that DEPENDED on `ConfigChange` for security review | Plugin's security check is bypassed under Pi | `info` command shows the `{not supported on Pi}` marker; README documents the 5 events; plugin author sees the dependency is unsupported |
| Hook stderr leaked to user notify includes file paths or secrets | Privacy leak | Runtime stderr → debug-log only; never `ctx.ui.notify` per-event |
| Hook script with shebang `#!/bin/sh -e ... rm -rf /` | Hook does damage | Containment check on `command` path AND realistic operator expectation — the bridge does NOT sandbox hooks (Claude Code doesn't either); operator trusts the plugin |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| User installs hooks plugin; bridge doesn't emit reload-hint; user doesn't reload; hooks don't fire | "Your bridge is broken" | Hook install MUST emit plugin row that triggers v1.4 reload-hint cascade |
| Bucket-H drop silent at install; plugin author has no signal | Plugin appears broken on Pi with no diagnostic | `info` shows per-hook `{not supported on Pi}` marker; README enumerates the 5 events |
| `FileChanged` works on Linux but not macOS for the user | "Hooks are flaky" | Document `fs.watch` cross-platform reality in README; cross-platform CI |
| Two terminals fire side-effecting hook twice for one tool call | "Why did my hook run twice?" | Document per-process semantics; same as Claude Code's per-window model |
| Hook hangs the agent loop for 5 minutes | User force-quits Pi | Default timeout 30s with notify-warning on timeout |
| Soft-dep `pi-subagents` absent; subagent hooks silently don't fire | "Why doesn't my SubagentStart hook work?" | Per-row `{requires pi-subagents}` marker on install + on `info` |
| Plugin uses regex matcher; hook silently never fires | Plugin author confused | Detect-and-reject at install with clear notify ("regex matchers deferred; entry skipped") |
| `Stop` synthesis runs 10× per turn for `ralph-wiggum`-style plugins | User's API spend explodes | N-fire safety cap (default 10) + one-shot notify-warning when cap hit |
| Hook stderr surfaced via notify spams the pane | User mutes notifications, misses real warnings | Runtime stderr → debug-log only |

## "Looks Done But Isn't" Checklist

- [ ] **Dispatch core:** Often missing epoch guard for stale handlers — verify a forced double-load test asserts exactly-one dispatch.
- [ ] **`Stop` synthesis:** Often missing idempotency guard — verify `ralph-wiggum` end-to-end loops correctly and stops at N=10 cap.
- [ ] **`FileChanged`:** Often missing re-attach on atomic rename — verify a vim-style save (`:w`) fires hook on second save (not just first).
- [ ] **Cross-platform `fs.watch`:** Often missing macOS+Windows CI — verify CI matrix runs all three OS for the FileChanged integration test.
- [ ] **Hook timeout:** Often missing — verify a hook that `sleep 60`s is killed at 30s and surfaces a notify-warning.
- [ ] **Hook stdout JSON tolerance:** Often missing — verify invalid JSON / extra trailing text / unknown `decision` values do NOT crash the dispatcher.
- [ ] **Hook payload extension parser:** Often missing tolerant validation — verify installing `security-guidance` (with `asyncRewake`) succeeds and emits a one-shot extension warning.
- [ ] **Matcher rejection:** Often missing regex detection — verify a plugin with `Edit.*` matcher is rejected at install with clear notify.
- [ ] **State schema bump:** Often missing v1.12-tolerance — verify v1.13 state.json round-trips through v1.12 reader (or document downgrade path explicitly).
- [ ] **Soft-dep pi-subagents:** Often missing event-surface defensive try/catch — verify uninstalling pi-subagents mid-session doesn't crash bridge load.
- [ ] **Containment for hook command paths:** Often missing — verify a `command: "/etc/passwd"` is rejected at install.
- [ ] **IL-2 hook stderr:** Often missing — verify ESLint BLOCK A trips if any hook-runtime file uses `console.error` or `process.stderr.write`.
- [ ] **Catalog UAT for hook install/uninstall:** Often missing reload-hint cascade fixture — verify byte-locked catalog covers hook component rows.
- [ ] **Multi-process semantics:** Often missing documentation — verify README explains hook fires once per (tool-call × process).
- [ ] **Bucket-H `info` marker:** Often missing — verify `info` shows `{not supported on Pi}` for ConfigChange/Setup/InstructionsLoaded/TaskCreated/TaskCompleted.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Stale handler zombie dispatch (P1) | LOW | `/reload` (NFR-2); epoch guard prevents recurrence |
| Mid-reload event drop (P2) | LOW | Re-trigger the event; document drop policy |
| Multi-process double execution (P3) | MEDIUM | Close one terminal; document per-process model; nothing to recover beyond the side effect |
| `fs.watch` deaf after atomic rename (P4) | LOW | `/reload` re-attaches; re-attach logic prevents recurrence |
| Hook hangs agent loop (P5) | LOW | Timeout fires at 30s; notify-warning surfaces; user fixes hook |
| Hook OOMs Pi (P5) | HIGH | Process restart required; maxBuffer prevents recurrence |
| `Stop` loop (P6) | HIGH (API spend before detection) | N-cap stops loop; one-shot notify-warning; idempotency guard prevents recurrence |
| Strict-schema install fail (P7) | LOW | Reinstall after schema relaxation; tolerant schema prevents recurrence |
| Regex matcher silently never fires (P8) | LOW | Detect-and-reject at install with clear notify — plugin author rewrites matcher |
| State schema downgrade fail (P9) | HIGH | Delete v1.13 state.json; v1.12 re-derives from cache (NFR-2) — or ship v1.12 patch first |
| Soft-dep event-name drift (P10) | LOW | Soft-degrade with per-row marker; plugin still installs |
| Containment escape (P11) | HIGH | If undetected: file overwrite outside scope. Prevention via `realpath` + `assertPathInside` is mandatory; no recovery if it ships broken |
| IL-2 violation (P12) | LOW | ESLint BLOCK A catches in CI; never ships |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Cross-phase | Verification |
|---|---|---|---|
| 1 Stale composite handler | Dispatch core | Every payload-translator phase | Double-load test asserts exactly-one dispatch |
| 2 Mid-reload event delivery | Dispatch core | Integration tests | Event-during-reconcile test asserts clean drop or post-reg dispatch |
| 3 Multi-process scope contention | Install/uninstall + docs | n/a | README documents per-process; lock scope extends to `hooks/<plugin>/hooks.json` |
| 4 `fs.watch` cross-platform | Bucket-B synthesis | Cross-platform CI | Multi-OS matrix: edit / atomic-rename / delete / rename × {Linux, macOS, Windows} |
| 5 Hook timeout / orphans / buffer | Bridge-execution-runtime | n/a | `sleep 60` killed at 30s; 10MB stdout bounded; orphan cleanup on `session_shutdown` |
| 6 `Stop` synthesis | Bucket-D synthesis (Stop) | Canary integration | `ralph-wiggum` end-to-end; idempotency; N-cap |
| 7 Hook payload extension validator | Hook-config parser | n/a | `security-guidance` installs; unknown-field debug-log fires; known-extension warning fires |
| 8 Matcher translation | Matcher translation | Test taxonomy | Literal / pipe-OR / empty / regex-reject / MCP-naming fixtures |
| 9 State.json schema bump | State-schema migration (FIRST phase) | n/a | v1 → v2 idempotent; lockstep with v1.12 patch or explicit downgrade doc |
| 10 Soft-dep `pi-subagents` event drift | Soft-dep wiring | Integration test against installed pi-subagents | Defensive try/catch; per-row marker; sync vs async tested |
| 11 Containment escape | Containment phase (NFR-10) | n/a | `assertPathInside` allow-set extended; hook `command` path realpath-asserted |
| 12 IL-2 hook stderr | Bridge-execution-runtime + ESLint | n/a | BLOCK A covers hook-runtime files; runtime stderr → debug-log only |
| 13 `CwdChanged` future-fragile | Bucket-D synthesis (Cwd) | n/a | bash-only contract pin test; child-process cwd-isolation test |
| 14 `PostToolBatch` cancellation race | Bucket-D synthesis (Batch) | n/a | Cancellation-mid-batch test |
| 15 `UserPromptExpansion` false-positive | Bucket-D synthesis (Expansion) | n/a | Real-expansion + inter-extension-transform tests |
| 16 `StopFailure` classifier drift | Bucket-D synthesis (StopFailure) | n/a | Classifier table + Pi response-shape contract test |
| 17 Cross-plugin dispatch order | Dispatch core | n/a | Deterministic-sort test across multiple loads |
| 18 Hook exec bit (Unix) / shebang (Windows) | Install + cross-platform CI | n/a | Install no-exec-bit fixture; verify hooks fire |
| 19 Bucket-H silent drop UX | Documentation + `info` extension | n/a | `info` shows `{not supported on Pi}` for the 5 events |
| 20 Reload-hint discipline | Install/uninstall + notification | Catalog UAT lockstep | Hook install row triggers v1.4 reload-hint cascade |
| 21 Hook input payload size | Bridge-execution-runtime | n/a | 10MB tool result truncation test |
| 22 Missing hooks.json tolerance | Hook-config loader | n/a | Install hooks-less plugin; verify success |

## Test Taxonomy (mandatory for correctness claim)

This section enumerates the test categories the bridge MUST have. Counts are minimums.

**Bucket A — direct 1:1 payload round-trip (8 events × 1 fixture minimum):**
- SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd.
- Each fixture: feed a Pi event, assert hook child process receives Claude-shape stdin payload byte-faithful.
- Each fixture: feed hook stdout, assert Pi event return value matches Claude semantics.

**Bucket B — `FileChanged` cross-platform matrix:**
- Platforms: Linux, macOS, Windows.
- Event types per platform: direct edit, atomic-rename save (vim/VS Code default), delete, rename, mkdir-in-watched-dir, symlink target replace.
- Minimum: 3 platforms × 6 event types = 18 integration tests. CI mandatory on all three platforms.
- Plus: re-attach on atomic rename test (asserts second save fires).
- Plus: debounce window test (rename+change pair → one event).
- Plus: ENOENT on replace test (asserts re-attach succeeds).

**Bucket D — synthesis with loss-mode boundary tests (5 events × 2+ fixtures):**
- CwdChanged: bash `cd` happy path; future-tool inventory contract test; child-process cwd-isolation test.
- PostToolBatch: happy-path count; cancellation-mid-batch safety-net fire.
- UserPromptExpansion: real slash-command expansion; inter-extension input transform false-positive characterization.
- Stop: `ralph-wiggum` end-to-end canary; multi-`agent_end` idempotency; N-fire safety cap.
- StopFailure: classifier table per known error type; Pi `after_provider_response` shape contract.

**Soft-dep conditional — SubagentStart / SubagentStop:**
- pi-subagents installed: async-mode event subscribe fires correctly.
- pi-subagents installed: sync-mode synthesis from `tool_call`/`tool_result` filtered on `toolName === "subagent"`.
- pi-subagents ABSENT: bridge install succeeds; `info` shows `{requires pi-subagents}` marker; runtime debug-log only.
- pi-subagents uninstalled mid-session: bridge does not crash on next `pi.events.on` lookup.

**Matcher translation (5 fixtures minimum):**
- Literal tool name.
- Pipe-OR (`Edit|Write|MultiEdit|NotebookEdit` from `security-guidance`).
- Empty matcher (`""` = match all).
- Regex matcher (`Edit.*`) → reject at install with clear notify.
- MCP tool naming (`mcp__server__tool`) verified against Pi's `event.toolName`.

**Hook-payload extension (3 fixtures minimum):**
- Known extension field (`asyncRewake`) → install succeeds + one-shot notify warning.
- Unknown extension field → install succeeds + debug-log only.
- Strict-validator regression: TypeBox `additionalProperties: true` test on every nesting level.

**Hook stdout JSON parsing (5 fixtures minimum):**
- Valid JSON happy path.
- Invalid JSON → no-op + debug-log (no crash).
- JSON + trailing garbage → longest-valid-prefix tolerance.
- BOM-prefixed JSON → stripped.
- Unknown `decision` value → no-op + debug-log.

**Hook child-process lifecycle (4 fixtures minimum):**
- Hook timeout (`sleep 60` killed at 30s).
- Hook stdout overflow (10MB stdout bounded).
- Hook orphan cleanup (`session_shutdown` SIGKILLs live children).
- Hook stdin truncation (10MB `tool_result` truncated with marker).

**State migration (3 fixtures minimum):**
- v1.12 state.json (no `hooks` field) → v1.13 reconcile → state.json with `hooks: []` populated.
- v1.13 state.json round-trips through v1.13 reader unchanged (idempotency).
- v1.13 state.json read by v1.12 reader (or documented downgrade path) — either tolerated via patch or explicitly require state.json delete.

**Reload-driven dispatch (3 fixtures minimum):**
- Install plugin → `/reload` → fire event → verify dispatch.
- Uninstall plugin → `/reload` → fire same event → verify no dispatch.
- Mid-reload event delivery: trigger during reconcile, verify clean drop or post-reg dispatch (per architectural decision).

**Containment (4 fixtures minimum):**
- Write to `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` accepted.
- Write outside `<scopeRoot>` refused.
- Hook `command: "/etc/passwd"` rejected at install.
- Symlinked `hooks/<plugin>` pointing outside subtree rejected (realpath check).

**Catalog UAT (lockstep with v1.4 / v1.11):**
- Hook component install row byte-fixture.
- Hook component uninstall row byte-fixture.
- Reload-hint cascade triggered by hook install.
- `info` output for plugin with bucket-H hooks shows `{not supported on Pi}` marker.

**Operational gotchas regression (4 mandatory):**
- Stale handler retention test (epoch guard).
- Multi-instance scope contention test (per-process semantics doc + lock-scope coverage).
- Mid-reload buffering decision test (drop vs replay per architecture).
- `fs.watch` test matrix CI gate.

**Minimum total: ~70-80 distinct test cases** for v1.13 correctness claim. v1.12's test count grew by ~330 from v1.11 → v1.12; v1.13 should add a comparable bump.

## Sources

- **Authority doc** (HIGH): `docs/research/claude-hooks-vs-pi-events.md` — bucket A/B/D classifications, `Stop` synthesis design, soft-dep audit of pi-subagents@0.24.3 and pi-mcp-adapter@2.6.1, `pi.on(...)` non-removability constraint verified from `@earendil-works/pi-coding-agent` `types.d.ts`, Operational gotchas section (exec bits, in-flight hooks during disable, atomic state.json writes, sparse plugin trees, state schema evolution, disable as quasi-uninstall), Synthesis caveats section (PostToolBatch cancellation race, UserPromptExpansion false-positive, CwdChanged future-fragility), bridge implications (matcher translation, mutation semantics, process-spawn cost, return-shape evolution risk), v1.13 milestone scope (16 supported events, 5 bucket-H silent drop, 9 upstream-fixable blockers).
- **v1.12 hard-won lessons** (HIGH): `.planning/milestones/v1.12-research/PITFALLS.md` — destructive reconciliation safety gates, migration-first ordering, lock-fcommit-fsync ordering, withStateGuard cross-process contention, schema-bump first-load behavior, byte-locked catalog discipline, ownership-guarded prune, soft-degrade pattern with per-row markers, partial-failure continue-on-failure + per-item ledger, scope/local-override precedence, three-state model (declared/enabled/available).
- **v1.12 implementation reference** (HIGH): `extensions/pi-claude-marketplace/persistence/state-io.ts` (current STATE_SCHEMA shape, strict validation, ENOENT-as-default, normalizeStoredSource, atomic save), `extensions/pi-claude-marketplace/persistence/migrate.ts` (legacy record migration pattern, IL-3 sanctioned console.warn, async best-effort persist, pure transform + caller-owned persistence split).
- **PROJECT.md constraints** (HIGH): NFR-1 (atomic file ops), NFR-2 (no-restart recovery), NFR-3 (idempotent or fail-clean), NFR-4 (Node >= 20.19.0), NFR-5 (network policy), NFR-7 (TS strict discriminated union), NFR-10 (containment), NFR-11 (peer-dep floor), NFR-12 (forward-compat parser), IL-1 (English only), IL-2 (output channel), IL-3 (single sanctioned console.warn), IL-4 (no telemetry), D-30 (v1.3 user-contract binding), D-25 (lock-held marker semantics).
- **Node.js `fs.watch` cross-platform behavior** (MEDIUM, ecosystem signal): documented platform inconsistency in Node docs (`https://nodejs.org/api/fs.html#fswatchfilename-options-listener` "The fs.watch API is not 100% consistent across platforms"); atomic-rename loses inode → `rename` event without re-attach; macOS FSEvents coalescing; Windows ReadDirectoryChangesW symlink quirks; NFS/CIFS/Docker bind-mount event drop. `chokidar` is the de facto standard wrapper handling these.
- **Claude Code hooks docs** (HIGH for surface, MEDIUM for behavioral edge cases): `https://code.claude.com/docs/en/hooks` (per authority doc fetch 2026-06-12). Block-to-continue JSON contract, 30s default timeout, stdin payload convention.
- **Anthropic first-party marketplace audit** (HIGH at audit commit): `anthropics/claude-code` → `.claude-plugin/marketplace.json` at `ca9f6045fc90c8244f9e787fb57d54b380f9a27c` per authority doc; canary `ralph-wiggum` for Stop synthesis; `security-guidance` for `asyncRewake` payload extension and `Edit|Write|MultiEdit|NotebookEdit` pipe-OR matcher.
- **TypeScript comment policy** (HARD CONSTRAINT for code that references this doc): `.claude/rules/typescript-comments.md` forbids bare `Pitfall N` references in comments/test titles. Code that addresses these pitfalls should anchor via requirement IDs (REQ-* assigned in REQUIREMENTS.md), not via `Pitfall N`.

---
*Pitfalls research for: v1.13 Claude Hook Bridge — adding hook-component bridge alongside existing skills/commands/agents/MCP bridges*
*Researched: 2026-06-13*
