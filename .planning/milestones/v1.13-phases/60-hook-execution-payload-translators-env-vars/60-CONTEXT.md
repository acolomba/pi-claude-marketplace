# Phase 60: Hook Execution, Payload Translators & Env Vars - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 60 fills the no-op `dispatchHookExec` stub Phase 59 shipped at
`bridges/hooks/dispatch-exec.ts` (D-59-04) and stands up the surrounding
machinery: per-event payload translators, env-var preparation, child-process
spawn with timeout/grace/SIGKILL escalation, and the
result-reducer that composes outcomes across multiple entries firing
within one composite handler.

Six REQs land:

1. **Per-event payload translators (PAYL-01).** One translator per
   bucket-A Claude event at `bridges/hooks/payloads/<event>.ts`, exporting
   a hand-authored `translate(event, ctx): ClaudeStdin` function.
   PreToolUse / PostToolUse / PostToolUseFailure additionally map Pi's
   lowercase `event.toolName` to Claude's capitalized `tool_name` via the
   Phase 58 TOOL-01 table. Eight files: SessionStart, UserPromptSubmit,
   PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact,
   SessionEnd.
2. **Child-process spawn (EXEC-01).** `node:child_process.spawn` with
   `cwd` = Pi `ctx.cwd` snapshot at dispatch time; env merges `process.env`
   with both `CLAUDE_*` and `PI_*` variables.
3. **Timeout escalation (EXEC-02).** 600s bridge default; per-handler
   `timeout` field overrides. Custom timer ladder: SIGTERM at `timeout`
   ms → 5 s grace → SIGKILL. `maxBuffer: 1MB` on stdout. Stdin payload
   truncated at 256 KB with a `_truncated: true` marker.
4. **Stderr policy (EXEC-03).** Hook stderr is debug-logged through
   Phase 59's `shared/debug-log.ts` seam and **never** routed through
   `ctx.ui.notify` at runtime (IL-2). Install-time hook-config errors
   continue to surface through `notify`.
5. **Exec-form vs shell-form (EXEC-04).** `args: [string, ...]` on a
   handler → `spawn(command, args, options)` exec-form. Default (no
   `args`) → shell form. The `shell` field (HOOK-03 extension) selects
   the shell binary for shell-form only.
6. **Env vars (HOOK-05).** Every hook child sees `CLAUDE_PROJECT_DIR`
   (`ctx.cwd`), `CLAUDE_PLUGIN_ROOT` (absolute path to
   `<scopeRoot>/pi-claude-marketplace/plugins/<plugin-id>/`),
   `CLAUDE_PLUGIN_DATA` (absolute path to
   `<scopeRoot>/pi-claude-marketplace/data/<plugin-id>/`, mkdir-p inside
   per-plugin lock). `CLAUDE_ENV_FILE` is present only for SessionStart
   in v1.13 (see D-60-06 for path scheme). `CLAUDE_CODE_REMOTE` is
   intentionally unset (Pi runs locally).

Additionally, Phase 60 absorbs two Phase 59 carry-forward items
(WR-01 + WR-03) as a fourth scope dimension — "lifecycle hardening" —
because WR-03 becomes correctness-critical the moment real exec lands
(uninstalled plugin keeps firing handlers until `/reload`).

Phase 60 does NOT touch the `if`-field matcher (Phase 61 MATCH-03),
the `asyncRewake` registry (Phase 62 HOOK-06 / EXEC-05), `info <plugin>`
hooks rendering (Phase 63 SURF-01), or the 5th cascade slot
(Phase 63 LIFE-01). The `Stop` / `StopFailure` / `PostToolBatch` /
bucket-D lossy syntheses (PAYL-03 / PAYL-04) are explicitly v1.14+ —
Phase 60 ships only the 8 bucket-A events.

</domain>

<decisions>
## Implementation Decisions

### HookExecResult shape and reducer

- **D-60-01 (discriminated-union outcome type):** `HookExecResult` is a
  discriminated union by outcome — `noop | block | mutate | stop`. Shape:

  ```ts
  type HookExecResult =
    | { kind: "noop"; suppressOutput?: boolean }
    | { kind: "block"; reason?: string }
    | { kind: "mutate";
        updatedInput?: unknown;
        updatedToolOutput?: unknown;
        additionalContext?: string;
        permissionDecision?: "allow" | "deny" | "ask";
        permissionDecisionReason?: string;
      }
    | { kind: "stop"; stopReason?: string };
  ```

  The bridge normalizes Claude's stdout JSON into one of these outcome
  categories at the wire-protocol layer (exit 0 + valid JSON → parse;
  exit 0 + invalid JSON → `noop` + debug-log; exit 2 → `block` with
  stderr as reason; other non-zero → `noop` + debug-log — wire-protocol
  detail is planner discretion within these defaults). Reducer composes
  via outcome precedence; per-event narrowing via per-call-site adapters
  at the composite handler exit (see D-60-03). Exhaustiveness via
  `assertNever` per NFR-7.

  Rationale: the wide-flat-object alternative loses outcome-as-data
  (can't express "either block OR mutate, never both" in the type
  system); per-event union narrowing fights the reducer because all
  entries on the same handler share the same E. Discriminated union
  cleanly expresses the four real outcome shapes.

- **D-60-02 (first-block-wins; left-to-right mutate composition):** The
  composite handler's per-entry loop short-circuits on the first
  `kind: "block"` outcome (remaining entries do NOT run); on
  `kind: "mutate"`, each entry sees the previous entry's mutation
  (event is updated in place between iterations, so entry N+1's
  `dispatchHookExec` runs against the post-mutation event). On
  `kind: "stop"`, the chain stops immediately.

  ```ts
  for (const entry of bucket) {
    if (!matcherFires(entry, event)) continue;
    const r = await dispatchHookExec(entry, event, ctx);
    if (r.kind === "block") return r;       // short-circuit
    if (r.kind === "stop") return r;        // terminal
    if (r.kind === "mutate") event = applyMutation(event, r);
    // each entry sees previous mutation
  }
  return { kind: "noop" };
  ```

  Rationale: mirrors Claude Code's documented sequential hook chain
  semantics. The Phase 59 DISP-04 architecture test pins "sequential
  awaited fan-out (no Promise.all)" and "compareByNameThenScope cross-
  plugin order + within-plugin declaration order" — neither pins
  every-entry-must-run, so early-exit on block is compatible with the
  Phase 59 contract.

  Architecture-test invariant Phase 60 adds: "entry-1 returns block →
  entry-2 dispatchHookExec never invoked"; "entry-1 mutates input →
  entry-2 sees mutated input"; "entry-1 returns stop → composite
  handler returns stop without further dispatch".

- **D-60-03 (per-event adapter at composite-handler exit):** Each
  composite handler ends with a per-Pi-event adapter step that converts
  `HookExecResult` to the Pi-shaped return value. Adapter table:

  | Pi event | Claude event(s) | Adapter return shape |
  | --- | --- | --- |
  | `tool_call` | PreToolUse | `block` → `{ block: true, reason }`; `mutate.updatedInput` → mutate `event.input` in place + return `undefined` |
  | `tool_result` | PostToolUse + PostToolUseFailure | `block` → `{ block: true, reason }`; `mutate.updatedToolOutput` → mutate `event.output` in place + return `undefined` |
  | `input` | UserPromptSubmit | `block` → `{ action: "handled" }`; `mutate.additionalContext` → `{ action: "transform", text }` |
  | `session_start` / `session_shutdown` / `session_before_compact` / `session_compact` | SessionStart / SessionEnd / PreCompact / PostCompact | `void` (observation only — `block` is debug-logged and silently dropped because the Pi event surface has no block return) |

  Placement: a small `bridges/hooks/event-adapters.ts` module exporting
  one `adapt*` function per Pi event (planner's discretion to choose
  module vs inline switch in `dispatch.ts`).

  Rationale: per-event narrowing of the discriminated union is cleanest
  via a per-Pi-event adapter — each adapter has a typed return shape
  matching Pi's handler signature for that event. A single shape-
  ignoring converter would lose Pi-event-specific contracts (e.g.,
  UserPromptSubmit's `{ action: "handled" }`).

### Per-event payload translator architecture

- **D-60-04 (hand-authored `translate()` function per file):** Each
  translator at `bridges/hooks/payloads/<event>.ts` exports a single
  `translate(event, ctx): ClaudeStdin` function (~30-60 lines each).
  Eight files total. TOOL-01 mapping inlined via
  `import { mapPiToClaudeToolName } from "../../domain/components/hook-tool-names.ts"`
  in the three tool events (PreToolUse, PostToolUse, PostToolUseFailure).

  ```ts
  // bridges/hooks/payloads/pre-tool-use.ts
  export function translate(
    event: ToolCallEvent,
    ctx: TranslationContext,
  ): PreToolUseStdin {
    return {
      session_id: ctx.sessionId,
      transcript_path: ctx.transcriptPath,
      cwd: ctx.cwd,
      hook_event_name: "PreToolUse",
      tool_name: mapPiToClaudeToolName(event.toolName),
      tool_input: event.input,
    };
  }
  ```

  Architecture-test fixtures: hand-authored inline JSON input/output
  pairs in `tests/architecture/hooks-translators.test.ts` (or per-event
  fixture file under `tests/architecture/fixtures/`, planner's choice).
  Pattern follows Phase 59's `hooks-foundation.test.ts` / `hooks-tool-
  name-map.test.ts` fixture style.

  Rationale: declarative field-mapping table needs an engine that
  itself needs tests, and struggles with per-event edge cases (e.g.,
  PreToolUse's `hookSpecificOutput.permissionDecision` nesting on the
  return side, SessionStart's `_shared/claude-env-<sessionId>.env`
  bridge-internal reference). TypeBox schema-validated transform adds
  3x more code per file and a sub-ms runtime cost at every dispatch
  for an invariant already pinned by docs/research. Hand-authored
  functions are the lightest option that gives full per-event
  expressivity.

### Phase 59 carry-forward (lifecycle hardening)

- **D-60-05 (WR-01 + WR-03 inside Phase 60 as a dedicated "lifecycle
  hardening" plan):** Phase 60 has a fourth scope dimension beyond the
  six REQs — a small plan that closes the two Phase 59 review carry-
  forward items:

  - **WR-01 (factory `homedir()` phantom hydrate):** add ~5 LOC clear-
    project-arm prefix to `hydrateProjectScopeForCwd` in
    `bridges/hooks/event-router.ts` so the deferred re-hydrate on first
    `resources_discover` clears any phantom user-scope entries loaded
    under the wrong cwd at factory time.

  - **WR-03 (install/uninstall don't trigger rebuild):** wire
    `rebuildRoutingTables` (per-scope) calls into
    `orchestrators/plugin/install.ts` and `orchestrators/plugin/uninstall.ts`
    AFTER the per-plugin lock's stage commit (install) / drop (uninstall)
    so the routing table observes the new/removed entries without
    requiring a `/reload`. Also audit `reinstall.ts` / `update.ts` to
    confirm they transitively pick up the rebuild (or wire it
    explicitly if not).

  Rationale: WR-03 is correctness-critical the moment exec goes live
  (uninstalled plugin keeps firing handlers until `/reload`); it must
  ship in lockstep with the exec layer. WR-01 is bounded info-disclosure
  with no exec-layer dependency, but co-locating both in one plan keeps
  the "lifecycle hardening" scope tight and avoids splitting Phase 59
  carry-forward across two future phases.

  Phase 60's overall plan count: exec + translators + env vars +
  lifecycle hardening. Exact plan boundaries are planner discretion
  (could be 3-5 plans total).

### Env vars and `CLAUDE_ENV_FILE` lifecycle

- **D-60-06 (`CLAUDE_ENV_FILE` is per-session, NOT plugin-scoped —
  matches Claude Code upstream exactly):**

  ```
  CLAUDE_ENV_FILE = <scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env
  ```

  where `sessionId = ctx.sessionManager.getSessionId()` (Pi's
  `ReadonlySessionManager` exposes a stable per-session id).

  The bridge sets the env var only; the file does NOT have to exist when
  the hook starts. The hook decides whether to create or append. Bridge
  does NOT read, write, or delete the file. All plugins in the same
  session share one accumulator file (matching Claude Code's documented
  "Use append (`>>`) to preserve variables set by other hooks"
  semantics).

  Only SessionStart in v1.13 sets `CLAUDE_ENV_FILE` (`CwdChanged` and
  `FileChanged` are H-bucket-blocked in v1.13; `Setup` never fires).

  **REQ AMENDMENT REQUESTED:** HOOK-05's current wording — `CLAUDE_ENV_FILE`
  = "absolute path to a per-hook scratch file under the plugin's data dir"
  — must be amended to "absolute path to a per-session scratch file
  under `<scopeRoot>/pi-claude-marketplace/data/_shared/`, shared across
  all plugins' hooks in the same session (matches Claude Code upstream's
  cross-hook accumulation contract)". Downstream agents reflect the
  amendment in REQUIREMENTS.md before execution.

  The `_shared` directory: mkdir-p'd once at `registerHooksBridge`
  factory time alongside the existing per-plugin data-dir mkdir-p
  pattern. Same containment guard (`assertPathInside`) applies.

  Rationale: Claude Code's docs explicitly document the multi-hook
  accumulation pattern via append (`>>`). A per-plugin-scoped file
  breaks that pattern across plugin boundaries — plugin A's hook
  writing env vars cannot influence plugin B's subsequent Bash tool
  calls. Per-dispatch random paths break the multi-hook accumulation
  even within one plugin. Per-session, shared-across-plugins is the
  only option that matches upstream contract; the trade-off is
  cross-plugin env-var bleed by design (rare in practice and already
  the upstream behavior).

### Claude's Discretion

- **`TranslationContext` shape and source-of-truth.** Translators need
  `session_id`, `transcript_path`, `cwd`. `cwd = ctx.cwd` (EXEC-01).
  `session_id = ctx.sessionManager.getSessionId()` (Pi `ReadonlySessionManager`).
  `transcript_path` source is researcher to confirm —
  `ctx.sessionManager.getSessionFile()` is one candidate (returns
  `string | undefined`); fallback if undefined is planner's choice
  (placeholder string vs synthesized path).

- **stdin `_truncated: true` marker placement.** Top-level field on the
  JSON payload vs nested under `hookSpecificOutput`. Top-level is
  simpler and parsable by hook authors without knowing per-event nesting;
  nested matches Claude's `hookSpecificOutput` convention but isn't
  upstream-mandated for the truncation marker. Planner picks; document
  in PLAN.md.

- **Timeout grace-timer mechanism.** Custom timer ladder via
  `setTimeout(SIGTERM, hookTimeout)` + `setTimeout(SIGKILL, hookTimeout + 5000)`
  with `clearTimers()` on child exit. Phase 59's `dispatchHookExec`
  signature is `Promise<void>` today and evolves to `Promise<HookExecResult>`
  in Phase 60; planner picks the timer-state holder (closure local,
  per-dispatch object, or a small `bridges/hooks/exec-timer.ts` helper).

- **stdout/stderr buffer-overflow handling at 1 MB / 64 KB.** When the
  child writes beyond `maxBuffer`, Node's spawn raises an error event.
  Bridge response: kill the child + debug-log the overflow + return
  `{ kind: "noop" }` (or `kind: "block"` if defensive policy is
  preferred). Planner picks the conservative-vs-permissive default.

- **`CLAUDE_PLUGIN_DATA` mkdir-p timing.** Per HOOK-05: "mkdir-p inside
  the per-plugin lock" — happens at install time as part of the
  per-plugin lock's stage commit (existing pattern in
  `orchestrators/plugin/install.ts`). The `_shared` data dir (D-60-06)
  is mkdir-p'd separately at `registerHooksBridge` factory time —
  one-time per `/reload`.

- **Exec-form vs shell-form `command` resolution.** REQ EXEC-04 locks
  the discriminator (`args` present → exec-form; absent → shell-form).
  Planner picks the precise spawn options object construction
  (whether to pass `shell: true` explicitly in shell-form vs use the
  default; whether the `shell` field selects `/bin/sh` vs `bash` vs
  user value).

- **Per-event architecture-test invariants beyond reducer + translator
  fixtures.** Phase 60 architecture-test additions: (1) reducer first-
  block-wins + mutate-composition (D-60-02); (2) per-event adapter
  shape (D-60-03); (3) 8 translator round-trip fixtures (PAYL-01);
  (4) env-var presence per event type (HOOK-05); (5) timeout escalation
  ladder pinning. Planner picks one architecture-test file
  (`tests/architecture/hooks-exec.test.ts`?) vs splitting across
  multiple per-concern files following Phase 59's per-block convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — EXEC-01..04, PAYL-01, HOOK-05 (Phase 60
  closure list). **HOOK-05 amendment requested via D-60-06 —
  `CLAUDE_ENV_FILE` is per-session shared, not per-plugin scoped.**
- `.planning/ROADMAP.md` § "Phase 60" — goal + 6 success criteria;
  dependency on Phase 59 (dispatch core must invoke an exec layer).
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook
  Bridge" — locked scope (bucket-A only); strict-supportability stance.

### Prior phase decisions (Phases 57-59 — foundations)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  — D-57-03 (`generatedName`-based persistence; runtime derives paths
  from `<scopeRoot>`); D-57-04 (parse failure → `installable: false`
  with `{unsupported hooks}` reason).
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md`
  — D-58-03 (single-seam discriminated parser result); D-58-04 (TOOL-01
  at `domain/components/hook-tool-names.ts`); D-58-05 (`find ↔ Glob`
  mapping with LOW-confidence flag); D-58-06 (per-non-tool-event
  closed-set source/reason/trigger maps with Pi-payload field
  translation at registration time — translators reuse the parsed form
  without runtime translation).
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-CONTEXT.md` —
  D-59-01 (7 Pi listeners, 8 Claude routes, `tool_result` isError
  split); D-59-02 (bridge-owned parsed-config cache at factory time);
  D-59-03 (`liveEpoch` bumped at `registerHooksBridge` entry);
  D-59-04 (`dispatchHookExec(entry, event, ctx): Promise<void>` stub
  signature — Phase 60 evolves to `Promise<HookExecResult>`); D-59-05
  (`shared/debug-log.ts` is the sole runtime debug seam).
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-VERIFICATION.md`
  § "Carry-Forward" — WR-01 + WR-03 named as Phase 60 candidates;
  reinstall/update audit gap noted.
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-SECURITY.md`
  — 17 threats closed at Phase 59; WR-01/WR-03 flagged for Phase 60
  follow-up.
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-REVIEW.md`
  — 5 warnings + 6 info findings; WR-02/04/05 fixed in Phase 59
  (`50d1d50`, `fe7fed8`, `6782ee2`); WR-01 + WR-03 deferred to Phase 60.

### Authority sources (cross-reference at planning time)

- `docs/research/claude-hook-config-syntax.md` § 3 "Hook stdin payload
  contract per event type" — definitive per-event stdin field set;
  driver for PAYL-01 translator field maps.
- `docs/research/claude-hook-config-syntax.md` § 4 "Hook stdout JSON
  contract per event type" — definitive hook-result wire protocol
  (exit 0 + JSON = structured outcome; exit 2 + stderr = unstructured
  block); driver for HookExecResult parsing.
- `docs/research/claude-hook-config-syntax.md` § "Environment
  variables" lines 270-280 — HOOK-05 env-var list with per-event
  applicability.
- `docs/research/claude-hooks-vs-pi-events.md` § "Bucket A 1:1 mapping
  table" — Pi → Claude event name + payload mapping; cross-reference
  per-event translator authoring.
- Claude Code hooks reference (upstream — `code.claude.com/docs/en/hooks`)
  — `CLAUDE_ENV_FILE` documented contract: "Any variables written to
  this file will be available in all subsequent Bash commands that
  Claude Code executes during the session. Use append (`>>`) to
  preserve variables set by other hooks." Drives D-60-06.

### Peer dep — Pi event surface + session manager

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  lines 1027 + (loader) 15 — `ExtensionFactory = (pi: ExtensionAPI) =>
  void | Promise<void>`; `loadExtensionFromFactory` awaits the Promise
  (Phase 59 carry-forward — already shipped async).
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  `SessionStartEvent`, `ReadonlySessionManager.getSessionId`,
  `getSessionFile` — Pi session identity exposed via `ctx.sessionManager`;
  driver for D-60-06 per-session path.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts`
  — `SessionManager` class surface (full method set; `ReadonlySessionManager`
  is `Pick<SessionManager, "getCwd" | "getSessionDir" | "getSessionId" |
  "getSessionFile" | "getLeafId" | "getLeafEntry" | "getEntry" |
  "getLabel" | "getBranch" | "getHeader" | "getEntries" | "getTree" |
  "getSessionName">`).

### Codebase landing sites (Phase 60 modifies)

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` —
  CURRENT no-op stub (`Promise<void>`); Phase 60 fills body with
  spawn + payload translation + env-var construction + timeout/grace/
  SIGKILL + wire-protocol-to-HookExecResult parsing. Signature evolves
  to `Promise<HookExecResult>`.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` —
  composite handler bodies; reducer loop (D-60-02) replaces the
  current Phase 59 `for...await` no-result fan-out; per-event adapter
  (D-60-03) appended at handler exit.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/` (NEW
  directory) — 8 translator files: `session-start.ts`,
  `user-prompt-submit.ts`, `pre-tool-use.ts`, `post-tool-use.ts`,
  `post-tool-use-failure.ts`, `pre-compact.ts`, `post-compact.ts`,
  `session-end.ts`. Each exports `translate(event, ctx): ClaudeStdin`.
- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`
  (NEW; or inline in `dispatch.ts` — planner's choice) — per-Pi-event
  `adapt*` functions converting `HookExecResult` to Pi return shapes
  (D-60-03).
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` —
  WR-01 fix: clear-project-arm prefix in `hydrateProjectScopeForCwd`.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` — public
  barrel may need to export `HookExecResult` type if consumed outside
  the hooks bridge (probably not — the dispatch contract stays internal).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` —
  WR-03 fix: call `rebuildRoutingTables(state, loc, scope)` AFTER
  `addPluginConfigToCache` inside the per-plugin lock's stage commit.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` —
  WR-03 fix: call `rebuildRoutingTables(state, loc, scope)` AFTER
  `removePluginConfigFromCache` inside the per-plugin lock.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
  `update.ts` — WR-03 audit: confirm cache add/remove + rebuild flow
  through the existing uninstall-then-install paths, or wire explicitly.
- `extensions/pi-claude-marketplace/index.ts` — registerHooksBridge's
  factory-time work: mkdir-p `_shared` data dir for `CLAUDE_ENV_FILE`
  alongside the existing `assertPathInside` pattern.

### Architecture tests (Phase 60 adds)

- `tests/architecture/hooks-exec.test.ts` (NEW; or split across
  multiple files — planner's choice) — pin reducer (D-60-02), per-event
  adapter (D-60-03), 8 translator round-trip fixtures (PAYL-01), env-var
  presence per event type (HOOK-05), timeout escalation ladder
  (EXEC-02), exec-form/shell-form discrimination (EXEC-04). Pattern
  mirrors Phase 59's per-block layout (Block 1..N).
- `tests/architecture/hooks-dispatch.test.ts` (Phase 59) — may need
  updates if `dispatchHookExec` signature evolution
  (`Promise<void>` → `Promise<HookExecResult>`) cascades to the
  test's seam contracts; planner audits.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`shared/debug-log.ts`** (Phase 59 D-59-05) — Phase 60 routes ALL
  hook child stderr through `hookDebugLog`. The exact-equal `=== "1"`
  gate is the OBS-01 contract; do not parse stderr at runtime (matches
  EXEC-03 wording: "debug-logged only").
- **`mapPiToClaudeToolName`** (`domain/components/hook-tool-names.ts`,
  Phase 58 D-58-04) — translators for PreToolUse / PostToolUse /
  PostToolUseFailure import this; no new mapping logic needed.
- **`parseHooksConfig`** (`domain/components/hooks.ts`, Phase 57 + 58)
  — parsed config is already in cache (D-59-02); Phase 60 doesn't
  re-parse at dispatch time. Per-handler `timeout`, `args`, `shell`,
  matcher fields are pre-parsed.
- **`withLockedStateTransaction`** (`transaction/with-state-guard.ts`)
  — Phase 60 WR-03 fix wraps `rebuildRoutingTables` calls in install/
  uninstall in this lock (same pattern Phase 59 used in apply.ts).
- **`assertPathInside`** (`shared/path-safety.ts`, Phase 59 WR-02 fix
  at hydrate-read path) — Phase 60 reuses for `_shared` data-dir
  containment + plugin-data-dir + plugin-root path construction.
- **`liveEpoch` + `compositeHandlerFor`** (`bridges/hooks/event-router.ts`,
  `bridges/hooks/dispatch.ts`, Phase 59) — Phase 60's reducer loop sits
  INSIDE the composite handler body that already short-circuits on
  epoch mismatch (D-59-03 / DISP-03). The epoch check fires FIRST,
  then the new reducer loop runs.
- **`hydrateProjectScopeForCwd`** (`bridges/hooks/event-router.ts`,
  Phase 59 D-59-03 deferred-cwd path) — Phase 60 WR-01 fix adds a
  ~5 LOC clear-cache prefix.
- **`registerHooksBridge`** (`bridges/hooks/event-router.ts`,
  Phase 59) — already async (`Promise<void>`); Phase 60 adds the
  `_shared` data-dir mkdir-p inside this function.

### Established Patterns

- **Single-notify-emission-per-orchestrator** (RECON-04 / IL-2) —
  Phase 60 binds zero new notify emissions at runtime. Install-time
  hook-config errors continue through Phase 57/58/63's existing
  notify paths.
- **Architecture-test source-of-truth gates** (Phase 57 P04 / Phase 58
  P04 / Phase 59 hooks-dispatch) — Phase 60 follows the same closed-set
  introspection + per-block fixture pattern.
- **Sequential awaited fan-out (no `Promise.all`)** (Phase 59 DISP-04)
  — Phase 60's reducer loop preserves this; early-exit on block is
  compatible (no parallelism introduced).
- **Pre-parsed Pi-form matcher contract** (Phase 58 D-58-06) —
  translators read pre-parsed matcher state; no runtime Claude ↔ Pi
  translation.
- **NFR-7 discriminated `installable: true | false` + `assertNever`** —
  `HookExecResult`'s 4-arm discriminated union mirrors the same
  pattern at a different scope.
- **No comment policy violations** (`.claude/rules/typescript-comments.md`) —
  source code uses D-NN-NN decision IDs + REQ-IDs, never bare
  `Phase N` / `Plan N` / `Pitfall N` / `Pattern N`.

### Integration Points

- `bridges/hooks/dispatch-exec.ts` — body filled with spawn + translate
  + env-var construction + timeout/grace/SIGKILL + wire-protocol parser.
  Signature evolves `Promise<void>` → `Promise<HookExecResult>`.
- `bridges/hooks/dispatch.ts` — composite handler bodies updated for
  reducer loop (D-60-02); per-event adapter call at handler exit
  (D-60-03).
- `bridges/hooks/payloads/` — NEW directory with 8 translator files.
- `bridges/hooks/event-router.ts` — WR-01 clear-cache prefix in
  `hydrateProjectScopeForCwd`; `_shared` data-dir mkdir-p in
  `registerHooksBridge`.
- `orchestrators/plugin/install.ts`, `uninstall.ts` — WR-03 rebuild
  call sites; planner audits reinstall.ts + update.ts.
- Phase 60 does NOT touch `bridges/{agents,commands,mcp,skills}/`,
  `orchestrators/marketplace/*.ts`, `orchestrators/import/*.ts`,
  `shared/notify.ts`, `shared/path-safety.ts`, the catalog
  (`docs/output-catalog.md`), or the persistence schema layer.

</code_context>

<specifics>
## Specific Ideas

- The user wants `HookExecResult` typed as a discriminated union by
  outcome (D-60-01) — this is the load-bearing data type for the
  rest of the dispatch chain; planner should NOT widen to a flat
  object for ergonomics.
- The user wants the reducer to mirror Claude Code upstream's
  documented sequential hook chain (D-60-02) — first-block-wins
  short-circuit + left-to-right mutate composition. This is a
  behavioral parity stance, not a defensive one.
- The user wants WR-03 fixed inside Phase 60 because correctness
  becomes critical the moment real exec lands (D-60-05). Co-locating
  WR-01 in the same plan keeps the carry-forward scope tight.
- The user picked `_shared` per-session `CLAUDE_ENV_FILE` over
  per-plugin scoping for upstream parity (D-60-06) — accepting the
  REQ HOOK-05 amendment + the designed cross-plugin env-var bleed.
  REQUIREMENTS.md must reflect the amendment before execution.
- The user wants hand-authored translators per file (D-60-04) over
  schema-driven engines — per-event expressivity beats uniformity for
  this set of 8.
- The user wants per-event adapters at the composite-handler exit
  (D-60-03) — the union narrows cleanly via per-Pi-event functions;
  Pi-event-specific return shapes (`{ action: "handled" }` for
  UserPromptSubmit) are not collapsed into a generic shape.

</specifics>

<deferred>
## Deferred Ideas

- **`if`-field permission-rule matcher (MATCH-03)** — Phase 61. The
  `if` filter sits BETWEEN matcher fire (Phase 59) and `dispatchHookExec`
  invocation (Phase 60). Phase 60's reducer loop calls
  `matcherFires(entry, event)` first; Phase 61 inserts the `if` check
  between that and `dispatchHookExec(entry, event, ctx)`.
- **`asyncRewake` registry (HOOK-06 / EXEC-05)** — Phase 62. The
  registry lives at `bridges/hooks/async-rewake/registry.ts` and hooks
  into Phase 60's exec path; Phase 60's reducer is unaffected. Phase 60
  ships only foreground/awaited dispatch.
- **`Stop` / `StopFailure` lossy synthesis (PAYL-03 / PAYL-04)** —
  v1.14+. Phase 60 ships only the 8 bucket-A 1:1 events. `Stop` is
  documented in the audit as the single biggest correctness risk and
  is bucket-D (lossy synthesis through `pi.sendUserMessage` re-injection).
- **`PostToolBatch` / `UserPromptExpansion` / `ConfigChange` / `CwdChanged`
  / `FileChanged` events** — v1.14+. Phase 60 ships only bucket-A.
- **SURF-01 `info <plugin>` hooks-line rendering** — Phase 63. Reads
  raw `hooks.json` separately from the dispatch path.
- **LIFE-01 5th cascade slot** — Phase 63. The reconcile cascade gains
  a "hooks bridge" plan/stage/unstage/discover row mirroring the
  existing 4. Phase 60's WR-03 rebuild calls run inside the per-plugin
  lock; Phase 63 wires the user-visible cascade.
- **`HookExecResult` type-export through `bridges/hooks/index.ts`** —
  if a future phase (60.5+) needs the type for cross-bridge inspection
  or telemetry, that's the future-phase concern. Phase 60 keeps the
  type internal to `bridges/hooks/`.
- **Wire-protocol exit-1 (non-zero, non-2) handling policy** — planner
  picks within D-60-01's "noop + debug-log" default. If a future
  security-review escalates "any non-zero exit must block", that's a
  v1.14+ defensive-default change.
- **Telemetry for hook dispatch (success/fail/timeout counts)** —
  IL-4 forbids telemetry in v1. Re-evaluate post-v1.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — v1.12 orchestrator-coverage backlog (uncovered failure arms in
  `orchestrators/plugin/{update,reinstall,install}.ts` +
  `orchestrators/marketplace/update.ts` + `orchestrators/edge-deps.ts`).
  Score 0.6 in `todo.match-phase`. Reviewed: Phase 60 DOES touch
  install.ts + uninstall.ts for WR-03 wiring, but the todo's "rare
  failure arms" scope is broader (4 orchestrators, including
  marketplace/update). Kept in the pending todo pile — same disposition
  as Phases 57-59. If WR-03 wiring opens up adjacent coverage gaps,
  planner can fold opportunistically.

</deferred>

---

*Phase: 60-Hook Execution, Payload Translators & Env Vars*
*Context gathered: 2026-06-14*
