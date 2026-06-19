# Phase 60: Hook Execution, Payload Translators & Env Vars - Research

**Researched:** 2026-06-14
**Domain:** Child-process execution, per-event payload translation, env-var preparation, lifecycle hardening
**Confidence:** HIGH (CONTEXT.md locks 6 of the load-bearing decisions; remaining items are bounded planner discretion)

## Summary

Phase 60 fills the `dispatchHookExec(entry, event, ctx)` no-op stub Phase 59
shipped at `bridges/hooks/dispatch-exec.ts` and stands up four parallel scope
dimensions:

1. **Child-process exec layer** (EXEC-01..04) — `node:child_process.spawn`
   with exec-form / shell-form discrimination on `args`, a SIGTERM→5s grace→
   SIGKILL timer ladder, a 1MB stdout buffer, 256KB stdin truncation with a
   `_truncated: true` marker, and a wire-protocol parser that normalizes
   `(exitCode, stdout, stderr)` into the `HookExecResult` discriminated union
   (D-60-01).
2. **Per-event payload translators** (PAYL-01) — eight hand-authored
   `translate(event, ctx): ClaudeStdin` functions, one per bucket-A Claude
   event, at `bridges/hooks/payloads/<event>.ts`. The three tool-event
   translators (PreToolUse / PostToolUse / PostToolUseFailure) call into the
   Phase 58 `PI_TO_CLAUDE_TOOL_NAMES` table to capitalize `event.toolName`
   into Claude's `tool_name`.
3. **Env-var preparation** (HOOK-05 + D-60-06 amendment) — every hook child
   sees `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`,
   and (SessionStart only in v1.13) `CLAUDE_ENV_FILE`. The env-file path is
   per-session and shared across plugins (matches Claude Code upstream):
   `<scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env`.
4. **Lifecycle hardening** (Phase 59 carry-forward) — WR-01 clears phantom
   project-cache entries before `hydrateProjectScopeForCwd` re-hydrates;
   WR-03 wires `rebuildRoutingTables` into standalone `install.ts` /
   `uninstall.ts` so the routing table reflects state without requiring
   `/reload`. Reinstall / update are audited (and either delegated or
   wired explicitly).

The reducer (D-60-02) sits inside the Phase 59 composite handler body and
short-circuits on the first `block` outcome; left-to-right `mutate`
composition mutates `event.input` (or `event.output`) in place between
entries. A per-Pi-event adapter (D-60-03) at composite-handler exit converts
the final `HookExecResult` to the Pi-shaped return value.

**Primary recommendation:** Build Phase 60 in four plans aligned to the
scope dimensions above, in dependency order: (1) translators + env-vars +
TranslationContext (foundation), (2) wire-protocol parser + spawn body +
timer ladder (the dispatchHookExec body fill), (3) reducer + per-event
adapters (rewires composite handlers), (4) lifecycle hardening (WR-01 +
WR-03 + reinstall/update audit). Architecture tests follow Phase 59's
per-block layout in a single `tests/architecture/hooks-exec.test.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Child-process spawn + timeout + buffers | Bridge (`bridges/hooks/dispatch-exec.ts`) | Platform (`node:child_process`) | Direct OS-level concern; the only existing `spawn` site in the extension is `platform/git-credential.ts` for the same reason (subprocess invocation is platform-tier work). The hooks-bridge file stays in `bridges/hooks/` because it is hook-specific orchestration; the spawn primitive itself comes from `node:child_process`. |
| Payload translation (Pi event → Claude stdin JSON) | Bridge (`bridges/hooks/payloads/<event>.ts`) | Domain (`hook-tool-names.ts`) | Each translator is hook-bridge-internal logic, but reads the Phase 58 domain-tier tool-name map for the three tool events. No cross-bridge dependency. |
| Env-var construction | Bridge (`bridges/hooks/dispatch-exec.ts`) | Persistence (`persistence/locations.ts`) | Env vars compose paths derived from `locationsFor(scope, cwd)` — same pattern as existing bridges. `_shared` dir is mkdir-p'd at factory time alongside the existing per-plugin data-dir pattern. |
| Reducer (multi-entry composition) | Bridge (`bridges/hooks/dispatch.ts` composite-handler body) | — | The composite handler is the only place all entries for one event converge; precedence is part of the dispatch contract, not the exec primitive. |
| Per-Pi-event adapter | Bridge (`bridges/hooks/event-adapters.ts` or inline in dispatch.ts) | — | Adapter narrows the universal `HookExecResult` to the Pi-event-specific return shape; only the composite handler knows which Pi event fired. |
| Cache + routing rebuild on standalone install/uninstall (WR-03) | Orchestrator (`orchestrators/plugin/install.ts` + `uninstall.ts`) | Bridge (`bridges/hooks/event-router.ts::rebuildRoutingTables`) | Same pattern Phase 59 used in `apply.ts` (orchestrator owns the call; bridge exposes the export). |
| Phantom-cache clear (WR-01) | Bridge (`bridges/hooks/event-router.ts::hydrateProjectScopeForCwd`) | — | Internal hooks-bridge correctness; never crosses a bridge boundary. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` (built-in) | bundled with Node ≥ 20.19.0 [VERIFIED: node-runtime baseline / NFR-4] | Spawn hook child processes (`spawn(command, args, options)`) | Built-in; only sanctioned spawn primitive in the extension tree. Already used at `platform/git-credential.ts:36-83` for the same problem (subprocess execution). No 3rd-party wrapper is justified — the extra dep tree (`execa`, `tinyspawn`, etc.) buys ergonomics, not correctness, and adds risk surface. [CITED: nodejs.org/api/child_process.html] |
| `node:timers` (built-in `setTimeout` / `clearTimeout`) | bundled with Node ≥ 20.19.0 [VERIFIED: node-runtime baseline] | Timer ladder for SIGTERM → 5s grace → SIGKILL escalation | The `spawn({ timeout, killSignal })` option only sends ONE signal (default SIGTERM) — does NOT escalate to SIGKILL. Custom timer ladder is the idiomatic Node 20 pattern. [CITED: nodejs.org/api/child_process.html] |
| `node:crypto` (built-in) — `crypto.randomUUID()` | bundled [VERIFIED: node-runtime baseline] | Optional — only if a `dispatchId` is needed for debug-log correlation | Phase 60 does NOT need crypto for HOOK-05 / EXEC-01..04. The `CLAUDE_ENV_FILE` path uses `ctx.sessionManager.getSessionId()` (Pi-supplied), not a generated UUID. Listed only as a candidate for debug-log correlation if the planner adds one. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `domain/components/hook-tool-names.ts::PI_TO_CLAUDE_TOOL_NAMES` (existing) | Phase 58 baseline [VERIFIED: codebase] | Map Pi-form `event.toolName` (`bash`, `edit`, `find`, ...) to Claude-form `tool_name` (`Bash`, `Edit`, `Glob`, ...) | The three tool-event translators (PreToolUse, PostToolUse, PostToolUseFailure). NOTE: there is currently NO `mapPiToClaudeToolName` function — the const map is exported as raw `Record<PiToolName, string>`. Translators either index directly (`PI_TO_CLAUDE_TOOL_NAMES[event.toolName]`) or planner adds a thin helper. CONTEXT.md's reference to `mapPiToClaudeToolName` is an expected helper, not an existing symbol. |
| `shared/debug-log.ts::hookDebugLog` (Phase 59) | Phase 59 baseline [VERIFIED: codebase] | Sole runtime debug-output seam (gated on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`); Phase 60 routes ALL exec-time diagnostics (stderr, exit codes, parse failures, timeout escalations, buffer overflows) through this | NEVER use `ctx.ui.notify` for runtime hook diagnostics (IL-2 / EXEC-03). |
| `shared/path-safety.ts::assertPathInside` (existing) | Phase 59 baseline [VERIFIED: codebase] | Containment guard (NFR-10) for `_shared` data dir, plugin-root, plugin-data-dir path construction | The plugin-root and plugin-data-dir paths are constructed at dispatch time from cached strings; `assertPathInside` guards against state-corruption traversal. |
| `persistence/locations.ts::locationsFor` (existing) | v1.4 baseline [VERIFIED: codebase] | Resolve `<scopeRoot>` / `extensionRoot` / `dataRoot` / `hooksDir` per scope | Phase 60 reads `dataRoot` for `_shared` and per-plugin data-dir, and `extensionRoot`'s `plugins/<plugin-id>/` for `CLAUDE_PLUGIN_ROOT`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:child_process.spawn` raw | `execa` 9.x or `tinyspawn` 1.x | Both wrap spawn with Promise-based ergonomics + auto-escalating SIGKILL. Adding a dep here is overkill — Phase 60 needs custom buffer policy, custom truncation, custom timer ladder; the wrapper would be largely overridden anyway, and the project policy (CLAUDE.md tech-stack matrix) explicitly discourages new dev or runtime deps unless they replace hand-rolled correctness code. |
| Hand-authored `translate()` per file | Schema-driven engine (TypeBox transform pipeline) | Rejected by D-60-04. Schema-driven approach needs its own tests + sub-ms runtime cost per dispatch for an invariant already pinned by the upstream docs. |
| Custom timer ladder | `AbortController` + `signal: ac.signal` on spawn options | AbortController is the modern idiom for cooperative cancellation, but does NOT solve the SIGTERM→SIGKILL escalation problem on its own — Node still only sends ONE signal on abort. The planner can layer AbortController on top for cleaner caller-side cancellation, but the timer ladder is still load-bearing. [CITED: nodejs.org/api/child_process.html#optionssignal] |
| Top-level `_truncated: true` field | Nested under `hookSpecificOutput._truncated` | Marker is bridge-internal (downstream hook code reading `_truncated` is opt-in informational). Top-level is simpler and parseable without knowing per-event nesting. Upstream Claude Code does NOT document a convention for truncation markers — this is bridge-defined. Recommend **top-level** placement to match the simplicity of the upstream stdin envelope. |

**Installation:** No new packages. Phase 60 is pure source code on built-in
runtimes.

**Version verification:**
```bash
node --version   # >= 20.19.0 per NFR-4 (already enforced by Phase 59 ship)
```

## Package Legitimacy Audit

Not applicable — Phase 60 installs zero external packages. The exec layer
runs on `node:child_process`, `node:timers`, and `node:crypto`; the
translator layer reads `PI_TO_CLAUDE_TOOL_NAMES` from
`domain/components/hook-tool-names.ts`; the env-var layer uses
`persistence/locations.ts` and `node:fs/promises.mkdir`. All built-in or
already-shipped.

## Architecture Patterns

### System Architecture Diagram

```
Pi event fires (tool_call / tool_result / session_start / ...)
                            │
                            ▼
              Phase 59 composite handler
              (`bridges/hooks/dispatch.ts`)
                            │
                  ┌─────────┴──────────┐
                  │ epoch check        │  (DISP-03; no-op on mismatch)
                  ▼                    │
              for (entry of bucket):   │
                  │                    │
                  ▼                    │
              matcherFires?            │  (Phase 59 DISP-04)
                  │                    │
                  ▼                    │
        ╔═══ NEW IN PHASE 60 ════════════╗
        ║                                ║
        ║   await dispatchHookExec(      ║
        ║       entry, event, ctx)       ║
        ║                  │             ║
        ║                  ▼             ║
        ║      ┌── translate(event,ctx) ─┼─→ ClaudeStdin JSON (PAYL-01)
        ║      │                         ║
        ║      ▼                         ║
        ║   prepareEnv(entry, ctx) ──────┼─→ { CLAUDE_PROJECT_DIR, ...,
        ║      │                         ║      CLAUDE_ENV_FILE? }  (HOOK-05)
        ║      ▼                         ║
        ║   spawn(cmd, args?, opts) ─────┼─→ child_process (EXEC-01/04)
        ║      │                         ║
        ║      ▼                         ║
        ║   pipe stdin, attach           ║
        ║   timeout-timer, kill-timer    ║   (EXEC-02 timer ladder)
        ║      │                         ║
        ║      ▼                         ║
        ║   await close: (code, stdout,  ║
        ║                 stderr)        ║
        ║      │                         ║
        ║      ▼                         ║
        ║   debugLog(stderr) ────────────┼─→ shared/debug-log.ts (EXEC-03)
        ║      │                         ║
        ║      ▼                         ║
        ║   parseWireProtocol() ─────────┼─→ HookExecResult           (D-60-01)
        ║      │                         ║
        ╚══════│═════════════════════════╝
               │
               ▼
        applyReducer (D-60-02):
            block?  → break + propagate
            stop?   → break + propagate
            mutate? → mutate event.input/output in place; continue
            noop?   → continue
               │
               ▼ (loop end)
        adaptResultForPiEvent(...) ──→  { block, reason }
                                        | { action: "handled" }
                                        | { action: "transform", text }
                                        | undefined  (observation-only)
                                                                      (D-60-03)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── bridges/hooks/
│   ├── dispatch-exec.ts          # MODIFIED: stub body filled with spawn + parse + timers
│   ├── dispatch.ts               # MODIFIED: reducer loop replaces no-result fan-out; adapter call at exit
│   ├── event-router.ts           # MODIFIED: WR-01 clear-cache prefix; _shared mkdir at factory time
│   ├── event-adapters.ts         # NEW (or inline in dispatch.ts): adaptToolCall, adaptToolResult, adaptInput, adaptObservation
│   ├── exec-timer.ts             # OPTIONAL: helper for the SIGTERM→grace→SIGKILL ladder
│   ├── wire-protocol.ts          # OPTIONAL: parser for (exitCode, stdout, stderr) → HookExecResult
│   ├── translation-context.ts    # NEW (or inline in dispatch-exec): TranslationContext type + builder
│   ├── exec-result.ts            # NEW: HookExecResult discriminated union + applyMutation helper
│   └── payloads/                 # NEW directory
│       ├── session-start.ts
│       ├── user-prompt-submit.ts
│       ├── pre-tool-use.ts
│       ├── post-tool-use.ts
│       ├── post-tool-use-failure.ts
│       ├── pre-compact.ts
│       ├── post-compact.ts
│       └── session-end.ts
├── orchestrators/plugin/
│   ├── install.ts                # MODIFIED: rebuildRoutingTables call after addPluginConfigToCache
│   ├── uninstall.ts              # MODIFIED: rebuildRoutingTables call after removePluginConfigFromCache
│   ├── reinstall.ts              # AUDIT + possibly MODIFIED (D-60-05)
│   └── update.ts                 # AUDIT + possibly MODIFIED (D-60-05)
├── index.ts                      # MODIFIED: hookDebugLog import / no-op (factory-time _shared dir creation actually lives in event-router.ts::registerHooksBridge)
└── shared/debug-log.ts           # UNCHANGED: Phase 60 routes all stderr / parse failures / overflow through hookDebugLog

tests/
├── architecture/
│   ├── hooks-exec.test.ts        # NEW: reducer, adapters, translator fixtures, env-var presence, timer ladder, exec-form/shell-form discrimination
│   └── hooks-dispatch.test.ts    # MAY need updates if dispatchHookExec signature evolves Promise<void> → Promise<HookExecResult>
├── bridges/hooks/
│   ├── dispatch-exec.test.ts     # MODIFIED: was 3 stub-shape tests; grow to cover wire-protocol parser, env-var construction, timeout/grace/SIGKILL
│   └── payloads/                 # NEW directory of per-translator unit tests
└── orchestrators/plugin/
    ├── install.test.ts           # MODIFIED: WR-03 rebuild call test
    └── uninstall.test.ts         # MODIFIED: WR-03 rebuild call test
```

### Pattern 1: HookExecResult discriminated union (D-60-01)

**What:** Outcome of a single dispatchHookExec invocation, expressed as a
discriminated-by-`kind` union so `block` / `mutate` / `stop` / `noop`
shapes do not overlap.

**When to use:** Both inside `dispatch-exec.ts` (as the parser output) and
inside the reducer (D-60-02) for short-circuit decisions.

**Example:**
```typescript
// bridges/hooks/exec-result.ts
export type HookExecResult =
  | { kind: "noop"; suppressOutput?: boolean }
  | { kind: "block"; reason?: string }
  | {
      kind: "mutate";
      updatedInput?: unknown;
      updatedToolOutput?: unknown;
      additionalContext?: string;
      permissionDecision?: "allow" | "deny" | "ask";
      permissionDecisionReason?: string;
    }
  | { kind: "stop"; stopReason?: string };

// Exhaustiveness gate per NFR-7 (same pattern as installable: true | false)
export function assertNever(x: never): never {
  throw new Error(`unreachable: ${JSON.stringify(x)}`);
}
```

### Pattern 2: Wire-protocol parser

**What:** A pure function `parseHookStdout(exitCode, stdout, stderr): HookExecResult`
that maps the Claude Code stdout/stderr/exitCode contract to the union.

**When to use:** Inside dispatch-exec after the child closes.

**Example (recommended defaults per D-60-01):**
```typescript
// bridges/hooks/wire-protocol.ts
export function parseHookStdout(
  exitCode: number | null,
  stdout: string,
  stderr: string,
): HookExecResult {
  // Exit code 2: blocking error. JSON is IGNORED on exit 2 (Claude Code's
  // "Don't mix" rule, docs/research/claude-hook-config-syntax.md § 5).
  if (exitCode === 2) {
    return { kind: "block", reason: stderr.trim() || undefined };
  }

  // Other non-zero (including null on signal): noop + debug-log.
  // Default leans permissive per D-60-01; a future security-default change
  // is v1.14+ scope (deferred).
  if (exitCode !== 0) {
    hookDebugLog(
      `wire-protocol: non-zero exit ${exitCode}; treating as noop. stderr=${stderr.slice(0, 200)}`,
    );
    return { kind: "noop" };
  }

  // Exit 0 + empty stdout: noop.
  const trimmed = stdout.trim();
  if (trimmed === "") {
    return { kind: "noop" };
  }

  // Exit 0 + JSON: parse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    hookDebugLog(`wire-protocol: stdout not JSON; treating as noop: ${errorMessage(err)}`);
    return { kind: "noop" };
  }

  // Translate Claude's stdout schema into HookExecResult.
  // continue: false at top-level → stop
  // top-level decision: "block" → block
  // hookSpecificOutput.permissionDecision: "deny" → block (PreToolUse)
  // hookSpecificOutput.updatedInput → mutate.updatedInput
  // hookSpecificOutput.updatedToolOutput → mutate.updatedToolOutput
  // hookSpecificOutput.additionalContext → mutate.additionalContext
  // else → noop (with optional suppressOutput from top-level)
  return normalizeClaudeStdout(parsed);
}
```

The exact branching of `normalizeClaudeStdout` reads
`docs/research/claude-hook-config-syntax.md § 4` per Pi-event-shape table.

### Pattern 3: Custom timer ladder (EXEC-02)

**What:** Two timers — one fires SIGTERM at `timeoutMs`, the second fires
SIGKILL at `timeoutMs + 5000`. Both clear on natural child exit.

**When to use:** Inside dispatch-exec after the child spawns and stdin is
piped.

**Example:**
```typescript
// bridges/hooks/exec-timer.ts
export interface TimerLadder {
  cancel(): void;
}

export function installTimerLadder(
  child: ChildProcess,
  timeoutMs: number,
): TimerLadder {
  let sigtermTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGTERM");
      hookDebugLog(`exec: timeout ${timeoutMs}ms reached; sent SIGTERM to pid ${child.pid}`);
    }
  }, timeoutMs);

  let sigkillTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
      hookDebugLog(`exec: SIGKILL escalation after 5s grace for pid ${child.pid}`);
    }
  }, timeoutMs + 5000);

  // Belt-and-suspenders: unref so a leaked timer never holds the loop open.
  sigtermTimer.unref();
  sigkillTimer.unref();

  return {
    cancel(): void {
      if (sigtermTimer) clearTimeout(sigtermTimer);
      if (sigkillTimer) clearTimeout(sigkillTimer);
      sigtermTimer = null;
      sigkillTimer = null;
    },
  };
}
```

Caller wires `child.once("exit", () => ladder.cancel())` so a fast-clean
exit cancels both timers. [CITED: nodejs.org/api/child_process.html — only
the built-in `timeout` option's single-signal limitation is documented;
the custom ladder is community-standard for SIGTERM→SIGKILL escalation.]

### Pattern 4: Per-event payload translator (PAYL-01 / D-60-04)

**What:** One hand-authored `translate(event, ctx): ClaudeStdin` function
per bucket-A event. ~30-60 lines per file.

**When to use:** Called by dispatch-exec immediately before writing to the
child's stdin.

**Example:**
```typescript
// bridges/hooks/payloads/pre-tool-use.ts
import { PI_TO_CLAUDE_TOOL_NAMES } from "../../../domain/components/hook-tool-names.ts";
import type { ToolCallEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PreToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
}

export function translate(
  event: ToolCallEvent,
  ctx: TranslationContext,
): PreToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreToolUse",
    // For built-in Pi tools (`bash` | `read` | `edit` | `write` | `grep` |
    // `find` | `ls`) the map returns the Claude-form spelling. For
    // CustomToolCallEvent the toolName is an arbitrary string (e.g.
    // `mcp__server__tool`); pass through unchanged.
    tool_name: PI_TO_CLAUDE_TOOL_NAMES[event.toolName as keyof typeof PI_TO_CLAUDE_TOOL_NAMES] ?? event.toolName,
    tool_input: event.input,
  };
}
```

### Pattern 5: Per-Pi-event adapter (D-60-03)

**What:** Each adapter consumes the universal `HookExecResult` and emits
the Pi-event-specific return shape.

**Example:**
```typescript
// bridges/hooks/event-adapters.ts
export function adaptToolCallResult(
  result: HookExecResult,
  event: ToolCallEvent,
): { block: true; reason?: string } | undefined {
  switch (result.kind) {
    case "block":
      return { block: true, reason: result.reason };
    case "stop":
      // Stop has no PreToolUse return slot; observation-only.
      hookDebugLog(`adapter: PreToolUse stop ignored (no Pi return slot); reason=${result.stopReason}`);
      return undefined;
    case "mutate":
      if (result.updatedInput !== undefined) {
        Object.assign(event.input as Record<string, unknown>, result.updatedInput);
      }
      // permissionDecision: "deny" maps to block (translate during parse, not here)
      return undefined;
    case "noop":
      return undefined;
    default:
      return assertNever(result);
  }
}
```

### Anti-Patterns to Avoid

- **`Promise.all`-style parallel dispatch across entries.** Phase 59 DISP-04
  locks sequential awaited fan-out. The reducer (D-60-02) requires entry
  N+1 to see entry N's mutation — parallelism breaks left-to-right
  composition.
- **Reading `event.toolName` literal without the TOOL-01 map.** Pi emits
  lowercase (`bash`); Claude expects capitalized (`Bash`). Skipping the map
  is the single biggest fidelity bug Phase 60 can introduce.
- **`process.stdout.write` / `process.stderr.write` from any hook-dispatch
  code path.** IL-2 single-channel constraint. Route all diagnostics
  through `hookDebugLog`.
- **Throwing from inside the composite handler.** A thrown exception
  bubbles into Pi's event-loop and can mark the bridge as crashed for
  future events. `dispatchHookExec` must NEVER throw — every error path
  ends in `{ kind: "noop" }` (or `block` if defensive) + `hookDebugLog`.
- **Using `spawn`'s built-in `timeout` option to escalate to SIGKILL.**
  The built-in option only sends one signal. Use the custom timer ladder.
- **Writing to `CLAUDE_ENV_FILE` from the bridge.** Per D-60-06, the bridge
  sets the env-var path only — the hook decides whether to create/append.
  Bridge does NOT read, write, or delete the file.
- **`fs.writeFileSync` / `fs.readFileSync` anywhere in the dispatch path.**
  EXEC layer is async-only.
- **`Pattern N` / `Pitfall N` / `Phase N` / `Plan N` references in source
  comments.** `.claude/rules/typescript-comments.md` enforces — use D-60-NN
  / REQ-IDs (EXEC-01..04, PAYL-01, HOOK-05) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translate Pi `event.toolName` to Claude `tool_name` | A second mapping table per translator | `PI_TO_CLAUDE_TOOL_NAMES` from `domain/components/hook-tool-names.ts` | Phase 58 already shipped TOOL-01 with an architecture-test exhaustiveness gate; duplicating risks drift. |
| Detect debug mode | `process.env.DEBUG === ...` reads scattered across files | `hookDebugLog` from `shared/debug-log.ts` | Single seam (OBS-01); per-file ESLint override is scoped. |
| Containment check on path construction | Manual `path.relative + startsWith` | `assertPathInside` from `shared/path-safety.ts` | NFR-10 enforcement. |
| Resolve scope paths | `path.join(homedir(), ".pi", ...)` inline | `locationsFor(scope, cwd)` from `persistence/locations.ts` | Scope abstraction. |
| Cross-process state mutation | New lock primitives | Existing `withLockedStateTransaction` from `transaction/with-state-guard.ts` | Phase 59 already wired install/uninstall cache mutations inside this lock; WR-03 just adds the rebuild call inside the same lock. |
| Discriminated-union exhaustiveness | Per-call `if/else` chains | `switch` + `assertNever(x: never): never` | Mirrors `installable: true | false` and HookExecResult variants. |
| Generate per-session UUIDs | `Math.random` | `ctx.sessionManager.getSessionId()` (Pi-supplied, stable per session) | Pi already owns session identity (D-60-06). |

**Key insight:** Phase 60's value is in correctly wiring already-shipped
primitives. The only NEW primitive is the spawn + timer ladder + wire-
protocol parser inside `dispatch-exec.ts`. Everything else is reuse.

## Runtime State Inventory

Not applicable — Phase 60 is greenfield code addition (no rename, no
migration, no schema change). The Phase 59 cache + routing table contract
is preserved; Phase 60 only changes the `dispatchHookExec` body and adds
a reducer + adapter layer above it.

**Categories explicitly checked:**
- Stored data: None — no state.json schema changes, no new persistence.
- Live service config: None — no UI-side or external-service registrations.
- OS-registered state: None — child processes are transient; no Task
  Scheduler / launchd / pm2 footprints.
- Secrets/env vars: NEW env vars (`CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`,
  `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE`) are set on EACH child process;
  not persisted in any settings file. No existing env vars renamed.
- Build artifacts: None — no `pyproject.toml` / package rename effects.

## Common Pitfalls

### Pitfall 1: `event.toolName` for `CustomToolCallEvent` is `string`, not a literal

**What goes wrong:** A direct `PI_TO_CLAUDE_TOOL_NAMES[event.toolName]`
lookup with the open-ended `string` arm returns `undefined`, and the
translator emits `tool_name: undefined` (or crashes) — wrong on MCP tool
calls.

**Why it happens:** `ToolCallEvent` is a discriminated union of seven
literal arms + one open `CustomToolCallEvent { toolName: string }` arm.

**How to avoid:** Lookup with explicit fallback:
```typescript
tool_name: (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[event.toolName] ?? event.toolName
```
Or narrow with `isToolCallEventType` from the peer-dep before lookup.

**Warning signs:** Architecture test fixture for an `mcp__server__tool`
matcher missing from PreToolUse translator.

### Pitfall 2: `child.kill()` race against fast natural exit

**What goes wrong:** Timer fires `child.kill("SIGTERM")` on a child that
already exited; the SIGTERM is sent into a dead PID and a later spawn
re-uses that PID — phantom kill against the wrong process.

**Why it happens:** Node's `child.killed` is set after the kill call, not
after the child reports dead. A close event between the kill timer firing
and the kill itself opens a TOCTOU window.

**How to avoid:** Cancel both timers IMMEDIATELY on `child.once("exit", ...)`
and `child.once("error", ...)`. Use `child.killed` as a tri-state guard,
not the sole defense.

**Warning signs:** Test flakiness where a fast hook's pid count goes up by
one extra signal in `top`.

### Pitfall 3: `stdin.write` after child crash → EPIPE

**What goes wrong:** Child crashes before stdin is fully written; the write
raises an unhandled EPIPE that surfaces as an uncaught Node error.

**Why it happens:** Node's pipe `Writable` rejects on the next write after
broken-pipe.

**How to avoid:** Attach `child.stdin.once("error", (err) => hookDebugLog(...))`
before any write; write via `child.stdin.end(payload)` not split writes;
and let the close/exit event propagate the failure.

**Warning signs:** Hook crashes during stdin write surface as uncaught
exceptions instead of `{ kind: "noop" }`.

### Pitfall 4: Buffer overflow on stdout > 1MB

**What goes wrong:** Node's `child_process` doesn't natively emit an event
when the manual buffer threshold is hit when using `spawn` directly; the
process keeps producing output and we accumulate it in-memory.

**Why it happens:** `maxBuffer` is an `exec` / `execFile` / `spawnSync`
option — it does NOT apply to `spawn`. Phase 60 needs manual buffering
(accumulate `chunk` events into a fixed-size buffer; on exceeding the
limit, kill the child and debug-log the overflow).

**How to avoid:** Implement manual buffer accumulation:
```typescript
let stdoutBuf = "";
let stdoutOverflowed = false;
const MAX_STDOUT = 1024 * 1024;  // 1 MB

child.stdout.on("data", (chunk: Buffer | string) => {
  if (stdoutOverflowed) return;
  stdoutBuf += chunk.toString("utf8");
  if (stdoutBuf.length > MAX_STDOUT) {
    stdoutOverflowed = true;
    stdoutBuf = stdoutBuf.slice(0, MAX_STDOUT);
    hookDebugLog(`exec: stdout overflow (> ${MAX_STDOUT}); killing pid ${child.pid}`);
    child.kill("SIGTERM");
  }
});
```
Same pattern for stderr (cap at 64KB per EXEC-05 baseline; Phase 60
defensive choice).

**Recommended response on overflow:** `kind: "noop"` (permissive default
mirroring exit-1 policy). A defensive `block` is planner's choice but
inconsistent with the rest of D-60-01.

**Warning signs:** OOM in long-running test suites with chatty hooks.

### Pitfall 5: `_truncated: true` marker swallowed by hooks that don't read it

**What goes wrong:** Plugin author assumes full payload; truncated input
silently corrupts hook logic without surfacing the truncation.

**Why it happens:** Marker is informational and most plugins won't read
it; the hook proceeds with partial data.

**How to avoid:** Document in `docs/hooks.md` (SURF-06, Phase 63). For
Phase 60: ensure the marker is emitted at top-level (not nested) so any
defensively-coded hook can opt-in to checking it.

**Warning signs:** Plugin reports unexpected behavior on >256KB tool inputs;
debug-log shows truncation marker emitted.

### Pitfall 6: Exec-form `args: []` (empty array) ambiguity

**What goes wrong:** `args: []` is "args present but empty" per EXEC-04 —
spawn-exec-form with zero args. But it's easy to read as "no args, fall
back to shell-form".

**Why it happens:** JavaScript semantics — `[]` is truthy, `args !== undefined`
is the discriminator.

**How to avoid:** Use `entry.handlerDecl.args !== undefined` as the
discriminator. Document inline. Architecture test pins both `args: []`
(exec-form) and `args: undefined` (shell-form) cases.

**Warning signs:** A hook with `args: []` runs through a shell and the
shell metacharacter parsing kicks in unexpectedly.

### Pitfall 7: `transcript_path` undefined at first SessionStart

**What goes wrong:** `ctx.sessionManager.getSessionFile()` returns
`string | undefined` per peer-dep. First `SessionStart` (with
`reason: "startup"` or `"new"`) may fire before any session file exists.

**Why it happens:** Pi creates the session file lazily.

**How to avoid:** Document the fallback in `TranslationContext` construction:
recommend the empty string `""` placeholder over a synthesized path —
hooks reading `transcript_path` should defensively check for empty before
opening the file. Synthesizing a fake path is misleading.

**Warning signs:** Hook fails with `ENOENT` on `transcript_path` open on a
fresh session.

### Pitfall 8: `_shared` dir not created when first hook fires

**What goes wrong:** `CLAUDE_ENV_FILE` references
`<scopeRoot>/.../data/_shared/claude-env-<sessionId>.env`; if the parent
`_shared/` directory doesn't exist when the hook tries to write, the hook
fails (the bridge does NOT create the env file itself per D-60-06).

**Why it happens:** Per-plugin `data/` subdirs are mkdir-p'd at install
time, but `_shared` is a NEW location.

**How to avoid:** `mkdir-p` `_shared` ONCE inside `registerHooksBridge`
factory (matches D-60-06 expectation). Wrap in `assertPathInside` for
containment. Idempotent — repeated `/reload` is safe.

**Warning signs:** First-run hook fails with `ENOENT` on `CLAUDE_ENV_FILE`
parent dir.

### Pitfall 9: Reducer mutation visibility across entries

**What goes wrong:** Entry N returns `{ kind: "mutate", updatedInput: {...} }`;
entry N+1's `dispatchHookExec` translates `event.input` BEFORE the mutation
is applied — sees the un-mutated input.

**Why it happens:** Order of operations: mutation must apply BEFORE the
next entry's translate() call.

**How to avoid:** Apply mutation immediately upon receiving `mutate` outcome:
```typescript
for (const entry of bucket) {
  if (!matcherFires(entry, event)) continue;
  const r = await dispatchHookExec(entry, event, ctx);
  if (r.kind === "block") return adaptForPiEvent("block", r);
  if (r.kind === "stop") return adaptForPiEvent("stop", r);
  if (r.kind === "mutate") {
    applyMutationInPlace(event, r);  // <-- BEFORE next iter
  }
}
```

**Warning signs:** Architecture test "entry-1 mutates input → entry-2 sees
mutated input" red-fails.

### Pitfall 10: Reinstall / update bypass install.ts / uninstall.ts

**What goes wrong:** Phase 59 wired cache add/remove inside install.ts /
uninstall.ts directly. Reinstall.ts (`reinstallPlugin` at line 220) and
update.ts (`updateSinglePlugin` at line 439) implement their own
`withLockedStateTransaction` flow and do NOT route through the public
install/uninstall entry points. WR-03 wires `rebuildRoutingTables` into
install/uninstall — reinstall/update would silently skip both the cache
update AND the rebuild.

**Why it happens:** Phase 59 plan 03 documented this as an acceptable
deviation (truth #29). Phase 60 (D-60-05) closes the gap.

**How to avoid:** Audit both files; either route through install/uninstall
transitively, or call `addPluginConfigToCache` /
`removePluginConfigFromCache` + `rebuildRoutingTables` explicitly inside
the per-plugin lock. Estimated <30 LoC each.

**Warning signs:** Reinstall a plugin with hooks; next event does not fire
the new handler until `/reload`.

## Code Examples

Verified patterns from official sources and shipped code.

### Existing spawn pattern (mirror this shape)

```typescript
// Source: extensions/pi-claude-marketplace/platform/git-credential.ts:83-110 (existing shipped code)
const child = spawn("git", ["credential", subcommand], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  },
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));

await new Promise<void>((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`git credential ${subcommand} exited ${code}: ${stderr}`));
  });
  child.stdin.end(stdin);
});
```

Phase 60's `dispatchHookExec` body extends this pattern with: (a) timer
ladder; (b) manual buffer accumulation; (c) wire-protocol parsing on
close; (d) never-throws contract (every path resolves to a HookExecResult).

### Per-event matcher-fires predicates (existing, unchanged)

```typescript
// Source: extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:79-104 (existing)
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  if (matcher === MATCH_ALL) return true;
  return matcher.piTools.has(toolName);
}

function matcherFiresOnSessionStart(entry: RoutingEntry, reason: string): boolean {
  const raw = entry.rawMatcher;
  return raw === "" || raw === "*" || raw === reason;
}
```

Phase 60 reuses both predicates verbatim — no changes to the matcher
contract.

### Pi → Claude tool-name lookup (Phase 58)

```typescript
// Source: extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:77-88
export const PI_TO_CLAUDE_TOOL_NAMES = {
  bash: "Bash",
  read: "Read",
  edit: "Edit",
  write: "Write",
  grep: "Grep",
  find: "Glob",  // D-58-05 LOW-confidence semantic mismatch
  ls: "LS",
} as const satisfies Record<PiToolName, string>;
```

NOTE: there is NO `mapPiToClaudeToolName(name)` helper today. Phase 60
either (a) reads the const directly with a string-key cast and `??` fallback
for `CustomToolCallEvent`, or (b) ships a small helper:
```typescript
export function mapPiToClaudeToolName(name: string): string {
  return (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[name] ?? name;
}
```

Planner picks. Recommend (b) so all three tool translators have a single
call site to test.

### Sequential-await reducer template

```typescript
// New body of compositeHandlerFor's per-event loop (replaces Phase 59's no-result fan-out)
const bucket = getRoutingBucket(claudeEvent);
let finalResult: HookExecResult = { kind: "noop" };
for (const entry of bucket) {
  if (!entryFires(entry, event)) continue;
  const r = await dispatchHookExec(entry, event, ctx);
  if (r.kind === "block") {
    finalResult = r;
    break;  // short-circuit (D-60-02 first-block-wins)
  }
  if (r.kind === "stop") {
    finalResult = r;
    break;
  }
  if (r.kind === "mutate") {
    applyMutationInPlace(event, r);
    // Don't overwrite finalResult with mutate — terminal outcome is noop
    // unless a later block/stop arrives.
  }
}
// per-event adapter (D-60-03):
return adapter(finalResult, event);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `child_process.exec` (shell-wrapped) | `child_process.spawn` with explicit `shell: true` for shell-form | Always (Node best practice) | Avoids `exec`'s implicit shell vulnerability and `maxBuffer` gotchas. |
| Built-in `spawn({ timeout })` for kill | Custom SIGTERM→grace→SIGKILL ladder | Node ≥ 14 | Built-in `timeout` only sends ONE signal. Need custom escalation. |
| `child.stdout.pipe(stream)` | `child.stdout.on("data", ...)` for manual buffer | Always when capping output | `pipe` doesn't support size caps without a transform stream. |
| `exec` for command parsing | Pre-parsed `args` array | EXEC-04 — Phase 60 first time | Exec-form avoids the shell layer entirely for security. |
| Module-level test mocks via `t.mock.method` | Bridge-internal `_setExecutorForTest` indirection (Phase 59) | Phase 59 Plan 02 | ESM import bindings are read-only; Phase 60 translator tests follow the same pattern if needed. |

**Deprecated/outdated:**
- The `exec` family: still valid for trivial cases but not recommended for
  hook spawn. `spawn` is canonical.
- `node-pty` / `pty.js`: pseudo-terminal allocation, not relevant — hooks
  inherit stdio pipes, not a TTY.

## Project Constraints (from CLAUDE.md)

- **Node ≥ 20.19.0** (NFR-4) — built-in `child_process.spawn`, `setTimeout`,
  `fs/promises` all available.
- **TypeScript strict + discriminated `installable: true | false`** (NFR-7) —
  HookExecResult MUST be a 4-arm discriminated union; `assertNever` for
  exhaustiveness.
- **ESM-only** (`"type": "module"`) — all new files use `.ts` extension
  imports.
- **Atomic writes** (NFR-1) — Phase 60 does NOT write user-visible JSON
  files (no state.json mutations); `CLAUDE_ENV_FILE` is hook-owned per
  D-60-06.
- **NFR-2 `/reload` always suffices** — WR-03 closes the gap where
  standalone install/uninstall required `/reload` for the routing table to
  reflect changes.
- **NFR-3 idempotent / fail-clean** — `dispatchHookExec` NEVER throws.
- **NFR-5 network policy** — exec layer does no network I/O. Hooks
  themselves may, but that's plugin-author concern.
- **NFR-6 quality bar** — `npm run check` (typecheck + lint + format +
  tests) must stay green.
- **NFR-7 discriminated unions** — HookExecResult is the load-bearing
  example.
- **NFR-10 containment** — `_shared` dir, plugin-root path, plugin-data-dir
  path all routed through `assertPathInside`.
- **IL-1 English-only** — debug-log strings are English.
- **IL-2 single channel** (`ctx.ui.notify`) — runtime hook diagnostics
  bypass notify entirely; install-time errors stay on existing notify
  paths.
- **IL-3 sanctioned `console.warn`** — only `persistence/migrate.ts`;
  Phase 60 routes ONLY through `hookDebugLog` (the sole `console.error`
  call site under the per-file ESLint override).
- **IL-4 no telemetry** — exec layer does not collect counters or success/
  failure metrics.
- **Comment policy** (`.claude/rules/typescript-comments.md`) — source
  comments use D-60-NN / REQ-IDs (EXEC-01..04, PAYL-01, HOOK-05, WR-01,
  WR-03), never `Phase 60` / `Plan N` / `Pitfall N` / `Pattern N`.
- **Git policy** — commit via pre-commit hook path; never `--no-verify`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mapPiToClaudeToolName` is an expected helper symbol, NOT an existing one — translators must either read `PI_TO_CLAUDE_TOOL_NAMES` directly or planner ships a thin wrapper | Standard Stack, Pattern 4 | Planner reads CONTEXT.md's reference to `mapPiToClaudeToolName` as load-bearing; no risk if treated as a helper to add. | [ASSUMED — verified by grep that no `mapPiToClaudeToolName` exists in the codebase, but CONTEXT.md references it as if it exists] |
| A2 | Exit code -1 / null (signal-terminated, e.g., SIGKILL on timeout) is treated as the "non-zero, non-2" arm and noops + debug-logs | Pattern 2 wire-protocol parser | If treated as block, every timeout becomes a block — possibly too aggressive. CONTEXT.md leaves this to planner discretion under D-60-01. | [ASSUMED] |
| A3 | Top-level `_truncated: true` marker placement is bridge-defined, not Claude Code upstream-mandated | Alternatives Considered, Pitfall 5 | If upstream documents nested placement we're unaware of, third-party hooks reading the marker would miss it. Research grep of `docs/research/claude-hook-config-syntax.md` confirms upstream does NOT document a truncation marker. | [ASSUMED] |
| A4 | `transcript_path` empty string `""` fallback is acceptable for hooks that defensively check before opening; synthesized paths are misleading | Pitfall 7 | Plugins not checking would crash on first SessionStart. CONTEXT.md flags this as Claude's Discretion. | [ASSUMED] |
| A5 | Manual stdout buffer accumulation kills the child + noops on overflow (vs. block) | Pattern 2, Pitfall 4 | Defensive `block` is more cautious but inconsistent with D-60-01's general permissive defaults. Planner picks. | [ASSUMED — recommended noop for consistency, but CONTEXT.md Claude's Discretion section explicitly says "planner picks the conservative-vs-permissive default"] |
| A6 | The `_shared` dir creation is idempotent (`mkdir -p`) and safe to run repeatedly at each `registerHooksBridge` factory call | Pitfall 8 | `EEXIST` errors would crash registration. `fs.promises.mkdir(path, { recursive: true })` is idempotent per Node docs. | [VERIFIED: nodejs.org/api/fs.html#fspromisesmkdirpath-options] |
| A7 | Reinstall.ts (line 220 `reinstallPlugin`) and update.ts (line 439 `updateSinglePlugin`) do NOT delegate to installPlugin / uninstallPlugin; D-60-05 explicit wire is needed | Pitfall 10, Lifecycle Hardening | If delegation exists and we missed it, double-wiring causes duplicate cache mutations. Phase 59 Plan 03 explicitly documented the non-delegation in the SUMMARY (Reinstall/Update Audit Findings). | [VERIFIED: 59-03-SUMMARY.md § "Reinstall/Update Audit Findings"] |

## Open Questions

1. **`mapPiToClaudeToolName` — add a helper, or read the const directly?**
   - What we know: const map exists; no helper today.
   - What's unclear: planner preference. CONTEXT.md references the helper.
   - Recommendation: Add the thin helper for testability and a single
     call site (3 translators × const-with-fallback duplication is fragile).

2. **Wire-protocol exit-1 (and other non-zero, non-2) handling.**
   - What we know: D-60-01 documents "noop + debug-log" as the default;
     "block + debug-log" is the defensive alternative.
   - What's unclear: planner picks. Current research recommends the
     permissive default; document explicitly in PLAN.md.
   - Recommendation: noop + debug-log. Security-default change is v1.14+.

3. **`HookExecResult` location — `bridges/hooks/exec-result.ts` or inline
   in `dispatch-exec.ts`?**
   - What we know: D-60-04 keeps the union "internal to `bridges/hooks/`";
     no export through `bridges/hooks/index.ts` in v1.13.
   - What's unclear: planner picks. Inline-in-dispatch-exec keeps the
     `Promise<void>` → `Promise<HookExecResult>` signature change tightly
     scoped; sibling file gives the reducer + adapter a clean import.
   - Recommendation: Sibling `exec-result.ts` file (~30-50 lines). The
     reducer (in dispatch.ts) and the adapter (in event-adapters.ts) both
     import it.

4. **Architecture-test layout — single `hooks-exec.test.ts` vs split per concern.**
   - What we know: Phase 59 shipped one `hooks-dispatch.test.ts` with 7 blocks /
     10 tests. CONTEXT.md says planner picks.
   - What's unclear: scale. Phase 60 adds 5 architecture-test invariants
     (reducer, adapter, 8 translators, env-var presence, timer ladder).
     One file likely grows to ~600-800 lines; still readable.
   - Recommendation: One file `tests/architecture/hooks-exec.test.ts` with
     Block 1..5 mirroring Phase 59's per-block convention.

5. **Reinstall/update wiring — delegate or explicit?**
   - What we know: Neither orchestrator delegates today.
   - What's unclear: Plan 03 of Phase 60 either (a) refactors
     reinstall/update to delegate through installPlugin / uninstallPlugin
     (broader refactor; out-of-scope risk) or (b) wires the three
     primitives (cache add, cache remove, rebuild) explicitly inside the
     existing per-plugin locks (narrow, local).
   - Recommendation: Explicit wiring (option b). Reinstall is its own
     orchestrator for good reasons (preserves version, no network); a
     delegate refactor is a Phase 70+ concern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Bridge runtime | ✓ | ≥ 20.19.0 (NFR-4) | — |
| `node:child_process` | EXEC-01..04 | ✓ | built-in | — |
| `node:timers` | EXEC-02 timer ladder | ✓ | built-in | — |
| `node:fs/promises` | `_shared` mkdir-p | ✓ | built-in | — |
| `@earendil-works/pi-coding-agent` peer dep | `ExtensionContext`, `SessionManager`, event types | ✓ | `^0.73.1` | — |
| `domain/components/hook-tool-names.ts` | Tool-name capitalization | ✓ | Phase 58 shipped | — |
| `shared/debug-log.ts::hookDebugLog` | OBS-01 seam | ✓ | Phase 59 shipped | — |
| `bridges/hooks/event-router.ts::rebuildRoutingTables` | WR-03 wiring | ✓ | Phase 59 shipped | — |
| `shared/path-safety.ts::assertPathInside` | NFR-10 containment | ✓ | Phase 59 baseline | — |

**Missing dependencies:** None. Phase 60 ships entirely on already-available
primitives.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, stable since Node 20) |
| Config file | None — `node --test` reads `tests/**/*.test.ts` by glob |
| Quick run command | `node --test tests/bridges/hooks/ tests/architecture/hooks-exec.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format + ~1972 unit + 10 integration) |
| TS loader | Native Node 22.18+ TS strip + `tsx` for ≥ 20.19.0 ≤ 22.17 [VERIFIED: existing repo setup] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-01 | `spawn` uses `ctx.cwd` snapshot; env merges process.env + CLAUDE_* + PI_* | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ❌ Wave 0 (extend existing) |
| EXEC-02 | Timer ladder fires SIGTERM at `timeoutMs`, SIGKILL at `+5000`; cancels on clean exit; 256KB stdin truncation marker | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ❌ Wave 0 |
| EXEC-03 | Stderr routed ONLY through `hookDebugLog`; never `ctx.ui.notify`; install-time errors continue through notify | architecture | `node --test tests/architecture/hooks-exec.test.ts` (Block: stderr-debug-log-sole-sink) | ❌ Wave 0 |
| EXEC-04 | `args !== undefined` → exec-form `spawn(cmd, args, opts)`; `args === undefined` → shell-form; `shell` field selects binary for shell-form only | architecture + unit | `node --test tests/architecture/hooks-exec.test.ts` + `tests/bridges/hooks/dispatch-exec.test.ts` | ❌ Wave 0 |
| PAYL-01 | 8 translators round-trip a fixture event → Claude stdin JSON correctly; tool-events apply TOOL-01 map; CustomToolCallEvent passes through | unit + architecture | `node --test tests/bridges/hooks/payloads/*.test.ts` + `tests/architecture/hooks-exec.test.ts` (translator-table block) | ❌ Wave 0 |
| HOOK-05 | Every hook child sees `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`; SessionStart additionally sees `CLAUDE_ENV_FILE` with `_shared/claude-env-<sessionId>.env` path; CLAUDE_CODE_REMOTE is UNSET | architecture | `node --test tests/architecture/hooks-exec.test.ts` (env-vars block) | ❌ Wave 0 |
| D-60-01 | HookExecResult is a 4-arm discriminated union; `assertNever` exhaustiveness | architecture + typecheck | `node --test tests/architecture/hooks-exec.test.ts` + `npm run typecheck` | ❌ Wave 0 |
| D-60-02 | First-block-wins (entry-2 not invoked); left-to-right mutate (entry-2 sees mutated input); stop is terminal | architecture | `node --test tests/architecture/hooks-exec.test.ts` (reducer block) | ❌ Wave 0 |
| D-60-03 | Per-Pi-event adapter returns Pi-shaped value (`{ block, reason }` / `{ action: "handled" }` / `{ action: "transform", text }` / undefined) | architecture | `node --test tests/architecture/hooks-exec.test.ts` (adapter block) | ❌ Wave 0 |
| D-60-06 | `CLAUDE_ENV_FILE` path is `<dataRoot>/_shared/claude-env-<sessionId>.env`; same path for all plugins in same session; bridge does NOT create the file | architecture | `node --test tests/architecture/hooks-exec.test.ts` (env-file-path block) | ❌ Wave 0 |
| WR-01 | `hydrateProjectScopeForCwd` clears phantom project entries before re-hydrating | unit | `node --test tests/bridges/hooks/event-router.test.ts` | ❌ Wave 0 (extend existing) |
| WR-03 | `install.ts` and `uninstall.ts` call `rebuildRoutingTables` after the cache mutation inside the per-plugin lock; reinstall.ts and update.ts ALSO call (per D-60-05 audit) | unit + architecture | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/uninstall.test.ts` | ❌ Wave 0 (extend existing) |

### Sampling Rate

- **Per task commit:** `node --test tests/bridges/hooks/ tests/architecture/hooks-exec.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/uninstall.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** Full `npm run check` green AND `tests/architecture/hooks-dispatch.test.ts` (Phase 59) preserved AND zero regressions in Phase 57/58 architecture tests.

### Wave 0 Gaps

- [ ] `tests/architecture/hooks-exec.test.ts` — NEW, covers EXEC-01..04 + PAYL-01 + HOOK-05 + D-60-01..03 + D-60-06 architecture invariants. Blocks: (1) reducer, (2) per-event adapter, (3) 8 translator round-trip fixtures, (4) env-var presence per event type, (5) timeout escalation ladder pinning, (6) exec-form/shell-form discrimination, (7) `_shared` mkdir-p and containment.
- [ ] `tests/bridges/hooks/payloads/<event>.test.ts` × 8 — NEW per-translator unit tests with hand-authored fixtures.
- [ ] `tests/bridges/hooks/dispatch-exec.test.ts` — EXTEND existing 3-test stub file to cover spawn, wire-protocol parser, env-var construction, timer ladder cancellation, buffer overflow handling, EPIPE handling.
- [ ] `tests/bridges/hooks/event-router.test.ts` — EXTEND for WR-01 clear-cache test.
- [ ] `tests/orchestrators/plugin/install.test.ts` — EXTEND for WR-03 rebuild call after cache add.
- [ ] `tests/orchestrators/plugin/uninstall.test.ts` — EXTEND for WR-03 rebuild call after cache remove.
- [ ] `tests/orchestrators/plugin/reinstall.test.ts` and `tests/orchestrators/plugin/update.test.ts` — EXTEND for the explicit cache-add/remove + rebuild calls per D-60-05.

### Test Strategy Notes

- **Timer ladder testing without flake:** Use `node:test`'s `t.mock.timers.enable()`
  to virtualize `setTimeout`/`clearTimeout` so SIGTERM/SIGKILL ladders fire
  deterministically by advancing mock-clock time. Avoids real-time waits
  and flake on slow CI.
- **Spawn testing without real child processes:** Mock `node:child_process.spawn`
  by intercepting at the call site (or via the same `_setExecutorForTest`
  indirection pattern Phase 59 established for `dispatchHookExec`). Each
  test fixture defines (exitCode, stdout, stderr, signal) and the parser
  produces the expected `HookExecResult`.
- **Translator fixtures:** Hand-authored JSON input/output pairs in
  `tests/architecture/fixtures/payloads/` (one fixture per event). Architecture
  test loops over all 8 events and asserts byte-equal JSON output.
- **Env-var presence:** Spawn a fake child via mocked spawn, capture the
  `env` argument, assert key presence/absence per event type.
- **Reducer first-block-wins:** Mock `dispatchHookExec` to return
  `{ kind: "block", reason: "..." }` for entry-1 and a sentinel for entry-2;
  assert entry-2's mock is never called.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not authentication code |
| V3 Session Management | no | Not session code |
| V4 Access Control | yes | NFR-10 containment via `assertPathInside` for `_shared`, plugin-root, plugin-data-dir construction. State-derived path slugs MUST be defense-in-depth-checked (Phase 59 WR-02 pattern). |
| V5 Input Validation | yes | Hook stdout JSON is untrusted; wire-protocol parser MUST `try/catch` JSON.parse and reject non-object roots. Plugin author code runs as a child process — Phase 60 has no control over its behavior. |
| V6 Cryptography | no | `crypto.randomUUID()` optional only for dispatch correlation; not authentication. |
| V7 Errors / Logging | yes | All exec-time errors route through `hookDebugLog` (OBS-01 seam); zero `console.error` outside the seam; zero `ctx.ui.notify` from runtime exec path (IL-2 / EXEC-03). |
| V11 Business Logic | yes | First-block-wins reducer + sequential mutate composition is the documented semantic; deviation would break Claude Code parity. |
| V12 Files / Resources | yes | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE` paths constructed from state slugs + session id; NFR-10 containment enforced. |
| V14 Configuration | yes | `args !== undefined` → exec-form (no shell), `args === undefined` → shell-form. Exec-form is the secure default for any hook author who supplies args; shell-form is preserved for upstream parity with Claude Code hooks that rely on shell-expansion. |

### Known Threat Patterns for hook execution

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hook author writes shell metacharacters in `command` and relies on no shell expansion | Tampering (incorrect behavior) | Document EXEC-04 contract; default to shell-form preserves upstream Claude Code parity. |
| Long-running hook hangs Pi indefinitely | DoS | EXEC-02 timer ladder; default 600s; SIGKILL at +5s grace. |
| Hook stdout floods memory (multi-GB output) | DoS | Manual buffer cap at 1MB stdout, 64KB stderr; kill on overflow + `hookDebugLog`. |
| Hook stdin > 256KB causes Pi-side memory bloat | DoS | Truncate at 256KB + `_truncated: true` marker. |
| State-corruption traversal slug routes `CLAUDE_PLUGIN_ROOT` outside extension root | Tampering (path traversal) | `assertPathInside(<extensionRoot>/plugins, candidate)` defense-in-depth. |
| Same-name plugin in two marketplaces collides on `CLAUDE_PLUGIN_DATA` | Information disclosure | Cache key composition `${scope}\x00${marketplace}\x00${pluginId}` separates them; `CLAUDE_PLUGIN_DATA` path includes marketplace name. |
| Cross-plugin env-var bleed via `CLAUDE_ENV_FILE` | Information disclosure | DESIGNED (D-60-06) — matches Claude Code upstream's documented "cross-hook accumulation" contract. Documented in SURF-06 docs (Phase 63). |
| Hook child inherits Pi's secrets via process.env | Information disclosure | Phase 60 inherits process.env wholesale (intentional — upstream Claude Code does same). Future REQ may filter; v1.13 explicit Out of Scope. |
| Stderr leak via `ctx.ui.notify` | Information disclosure / IL-2 violation | EXEC-03: stderr routed ONLY through `hookDebugLog`; architecture test pins. |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (Phase 59 shipped) — module-state holder, `liveEpoch`, `parsedConfigCache`, `routingTable`, `hydrateProjectScopeForCwd`, `addPluginConfigToCache`, `removePluginConfigFromCache`, `rebuildRoutingTables`, `registerHooksBridge`. [VERIFIED: codebase grep + Phase 59 verification]
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` (Phase 59 shipped) — `compositeHandlerFor` (6-uniform), `toolResultCompositeHandler` (isError split), `matcherFiresOnToolEvent`, `matcherFiresOnSessionStart`, `_setExecutorForTest` indirection. [VERIFIED: codebase]
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (Phase 59 stub) — `(_entry, _event, _ctx): Promise<void> => Promise.resolve()`. [VERIFIED: codebase]
- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` (Phase 58 shipped) — `PI_TO_CLAUDE_TOOL_NAMES` const map; NO `mapPiToClaudeToolName` helper exists yet. [VERIFIED: codebase]
- `extensions/pi-claude-marketplace/shared/debug-log.ts` (Phase 59 shipped) — `hookDebugLog(detail: string): void`; env-gated `console.error`. [VERIFIED: codebase]
- `extensions/pi-claude-marketplace/platform/git-credential.ts:36-110` (existing) — only sanctioned `spawn` site; correct pattern to mirror. [VERIFIED: codebase]
- `extensions/pi-claude-marketplace/persistence/locations.ts:130-205` — `locationsFor`, `pluginDataDir`, `dataRoot`, `hooksDir`. [VERIFIED: codebase]
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` — `SessionStartEvent`, `SessionShutdownEvent`, `SessionBeforeCompactEvent`, `SessionCompactEvent`, `InputEvent`, `ToolCallEvent`, `ToolResultEvent`, `ExtensionContext { cwd; sessionManager; ... }`. [VERIFIED: peer-dep types]
- `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts:136-189` — `ReadonlySessionManager` Pick; `getSessionId(): string`, `getSessionFile(): string | undefined`. [VERIFIED: peer-dep types]
- `docs/research/claude-hook-config-syntax.md § 3` (stdin payload contract) — per-event field set, common envelope (`session_id`, `transcript_path`, `cwd`, `hook_event_name`). [CITED: docs/research/claude-hook-config-syntax.md]
- `docs/research/claude-hook-config-syntax.md § 4` (stdout JSON contract) — top-level + `hookSpecificOutput` shapes per event; exit-2 → block; exit-0 → parse. [CITED: same]
- `docs/research/claude-hook-config-syntax.md § "Environment variables"` lines 270-280 — HOOK-05 env-var list with per-event applicability. [CITED: same]
- `docs/research/claude-hooks-vs-pi-events.md § "Bucket A 1:1 mapping table"` — Pi → Claude event mapping. [CITED: docs/research/claude-hooks-vs-pi-events.md]
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-REVIEW.md` § "WR-01" + § "WR-03" — exact fix shape recommendations. [VERIFIED: codebase]
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-03-SUMMARY.md` § "Reinstall/Update Audit Findings" — confirmation neither orchestrator delegates. [VERIFIED]

### Secondary (MEDIUM confidence)

- [Node.js Child Process docs](https://nodejs.org/api/child_process.html) — spawn options, killSignal, no built-in grace-period. [CITED]
- [Node.js fs.mkdir docs](https://nodejs.org/api/fs.html#fspromisesmkdirpath-options) — `{ recursive: true }` is idempotent. [CITED]
- Claude Code hooks upstream reference (`code.claude.com/docs/en/hooks`) — `CLAUDE_ENV_FILE` documented contract: "Use append (`>>`) to preserve variables set by other hooks." Drives D-60-06.

### Tertiary (LOW confidence)

- WebSearch (Node child_process grace-period escalation patterns) — confirms custom timer ladder is community-standard; specific libraries (execa, gitaly grace-period MR) use the same shape. [VERIFIED via WebSearch 2026-06-14]

## Metadata

**Confidence breakdown:**
- HookExecResult shape (D-60-01): HIGH — locked by user, mirrors `installable: true | false` discriminated pattern.
- Reducer semantics (D-60-02): HIGH — mirrors Claude Code upstream documented sequential hook chain; Phase 59 DISP-04 sequential-await contract preserved.
- Per-event adapter (D-60-03): HIGH — Pi event return shapes verified against peer-dep types.d.ts (`InputEventResult`, etc.); adapter table in CONTEXT.md is correct.
- Hand-authored translators (D-60-04): HIGH — Pattern matches Phase 58 D-58-04 (TOOL-01 location).
- Lifecycle hardening (D-60-05): HIGH — WR-01 + WR-03 fix shapes documented in Phase 59 REVIEW; reinstall/update audit confirmed in Phase 59 SUMMARY.
- `CLAUDE_ENV_FILE` per-session (D-60-06): HIGH — matches upstream contract documented in `docs/research/claude-hook-config-syntax.md`; REQ HOOK-05 amendment captured.
- Wire-protocol parser shape: HIGH — `docs/research/claude-hook-config-syntax.md § 4` is the authority.
- Custom timer ladder pattern: HIGH — built-in `spawn timeout` limitation is documented Node behavior; custom escalation is community-standard.
- Manual stdout buffer pattern: HIGH — `maxBuffer` does not apply to `spawn`; explicit accumulation is correct.
- Translator field maps for 8 events: HIGH — verbatim from `docs/research/claude-hook-config-syntax.md § 3`.

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (30 days — Phase 60 is stable scope; longer if no upstream Claude Code v2.x.y breaks the stdin/stdout contract).
