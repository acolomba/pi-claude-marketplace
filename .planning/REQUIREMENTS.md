# Requirements: pi-claude-marketplace v1.13 Claude Hook Bridge

**Defined:** 2026-06-13
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Add a hooks component bridge alongside the existing skills/commands/agents/MCP bridges, translating Claude plugin hook declarations into Pi extension event subscriptions and shell-outs. Take hooks off the explicit Out of Scope list for the 16 supportable Claude events; document the remaining 14 (9 upstream-fixable + 5 semantically inapplicable) as known limitations.

**Authority sources:**
- `docs/research/claude-hooks-vs-pi-events.md` — event taxonomy, bucket assignments, marketplace audit, soft-dep wiring
- `docs/research/claude-hook-config-syntax.md` — full Claude Code hook config field reference (file layout, standard fields, per-event stdin/stdout, env vars, `if` / `asyncRewake` semantics, per-plugin audit), each field tagged IMPLEMENT / TOLERATE / ESCALATE

Supporting research under `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`.

## v1.13 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Component Type, Schema, Parser, Matcher

- [ ] **HOOK-01**: A new `hooks` component type appears in the resolver alongside `skills` / `commands` / `agents` / `mcpServers`; plugin manifests declaring `hooks` resolve as `installable: true` and the discriminated `installable: true | false` resolver contract is preserved (NFR-7)
- [ ] **HOOK-02**: State `schemaVersion` widens to `Literal(1) | Literal(2)`; additive migration `resources.hooks ??= []` runs once inside `withLockedStateTransaction` (NFR-1); v1.12 state.json loads cleanly under v1.13 code without losing existing fields
- [ ] **HOOK-03**: Hook-config TypeBox schema uses `additionalProperties: true` at every nesting level; unknown payload fields preserved through state round-trip. The known additive-only extension set is `{ statusMessage, once, async, shell, args }` — each is silently honored or silently dropped per the per-field implementability decisions in `docs/research/claude-hook-config-syntax.md` § 7 without affecting plugin installability. The `if` field is IMPLEMENTED per MATCH-03. The `asyncRewake` / `rewakeMessage` / `rewakeSummary` family is IMPLEMENTED per HOOK-06 (registry) + EXEC-05 (spawn pattern). Only non-`command` handler types remain as ESCALATE triggers (TOOL-02(h)). Unknown extension field names surface debug-log only and do NOT trigger unavailability (forward-compat with Claude Code's tolerant parsing)
- [ ] **HOOK-04**: The closed-set `REASONS` token `"hooks"` is renamed to `"unsupported hooks"` (no longer a manifest-field carve-out — it's now a descriptive 2-word reason at `shared/notify.ts::REASONS`); `MANIFEST_FIELD_REASONS` in `install.ts` drops `"hooks"` (keeps `"lspServers"`); every existing catalog-UAT fixture row of the form `(unavailable) {hooks}` in `docs/output-catalog.md` is updated to `(unavailable) {unsupported hooks}` in lockstep with the source rename, plus the corresponding byte-equality test cases. The semantic shift is intentional: under v1.13, a plugin declaring hooks the bridge can fully dispatch installs cleanly (no unavailable reason); a plugin declaring hooks the bridge cannot fully dispatch renders `{unsupported hooks}` per TOOL-02
- [ ] **HOOK-05**: The bridge sets the following environment variables on every hook child process at dispatch time (additive to EXEC-01's existing `CLAUDE_*` / `PI_*` merge): `CLAUDE_PROJECT_DIR` = `ctx.cwd` snapshot; `CLAUDE_PLUGIN_ROOT` = absolute path to `<scopeRoot>/pi-claude-marketplace/plugins/<plugin-id>/`; `CLAUDE_PLUGIN_DATA` = absolute path to `<scopeRoot>/pi-claude-marketplace/data/<plugin-id>/` (mkdir-p inside the per-plugin lock); `CLAUDE_ENV_FILE` = absolute path to a per-hook scratch file under the plugin's data dir, present only for events that use it upstream (`SessionStart`, `CwdChanged`, `FileChanged` — `Setup` is bucket H so never fires); the bridge does NOT read or re-export the file's contents (consumers like `direnv` patterns own their own shell-preamble integration through Pi's bash tool); `CLAUDE_CODE_REMOTE` is intentionally unset (Pi runs locally)
- [ ] **HOOK-06**: The bridge implements the `asyncRewake` / `rewakeMessage` / `rewakeSummary` field family via a bridge-owned `AsyncRewakeRegistry` (~250 LoC at `bridges/hooks/async-rewake/registry.ts` + dispatcher integration). When a hook entry declares `asyncRewake: true` (which upstream implies `async: true` per `code.claude.com/docs/en/hooks` Command-hook-fields table since Claude Code v2.1.72), the bridge spawns the hook detached (EXEC-05), registers the child PID + dispatch metadata in the registry, returns immediately so the triggering tool call proceeds, and watches for process exit. **On exit code 2**: the bridge concatenates `rewakeMessage` (as prefix if present) with the child's stderr (or stdout if stderr is empty), then injects the result into the model context via `pi.sendMessage({ role: "custom", customType: "claude-hook-rewake", display: false, content: <payload> }, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })`. The `display: false` flag matches Claude Code's `<system-reminder>` semantic (user-invisible, model-visible via `convertToLlm()` per peer-dep `messages.d.ts:32-39`). The `deliverAs: "nextTurn"` path queues at the next user-prompt boundary (verified at `agent-session.js:985-987` enqueue + `:790-794` drain); the `"followUp"` path injects mid-stream during an active loop. **On exit code 0 or other non-2 codes**: silent background completion, no injection. **`rewakeSummary`** is surfaced via `ctx.ui.notify` at process exit (UI-only status; not added to model context). **Lifecycle**: registry cleared on `/reload`; orphan children SIGKILLed; multi-hook fan-in supported via independent `dispatchId` per registered process. **`rewakeMessage` / `rewakeSummary` without `asyncRewake: true`** are no-op upstream and remain SURF-05's warned-but-installed case
- [ ] **MATCH-01**: User-facing matcher syntax supports literal **Claude tool names** (e.g. `Edit`, `Bash`, `Read`; matching Claude Code's hook contract) and pipe-OR alternation (`Edit|Write`); empty matcher `""` matches all tools of that event type; MCP tool matchers (`mcp__server__tool`) pass through unchanged. Pi-form lowercase matchers (e.g. `edit`) never match — the bridge always normalizes the incoming Pi event to Claude form before matcher comparison
- [ ] **MATCH-02**: Regex matchers (any character outside `[A-Za-z0-9_|\-]` and not part of an `mcp__` prefix) detected at install and trigger plugin unavailability per TOOL-02 (no per-entry skip; the strict supportability policy applies — the bridge does not partially load hooks)
- [ ] **MATCH-03**: The bridge implements the `if` field on tool-event hook entries (PreToolUse / PostToolUse / PostToolUseFailure; bridge ignores `if` on non-tool events to match upstream's "attaching to other events prevents the hook from running" behavior). Implementation parses Claude Code's permission-rule syntax `<ToolName>(<pattern>)` (per `docs/research/claude-hook-config-syntax.md` § 7 and `code.claude.com/docs/en/permissions` § "Permission rule syntax"), extracts the parenthesized pattern, and matches it against the per-tool argument target:
  - `Bash(...)` → `event.input.command` with subcommand parsing (compound-separator split on `&&` `||` `;` `|` `|&` `&` newline; recursive `$(...)` and backtick subcommand extraction; process-wrapper strip for `timeout`/`time`/`nice`/`nohup`/`stdbuf`/bare `xargs`); fires when ANY subcommand matches the glob
  - File-path tools (`Edit(...)` / `Write(...)` / `Read(...)` / `Grep(...)` / `Glob(...)` / `LS(...)`, plus future-stable `MultiEdit(...)` / `NotebookEdit(...)`) → file-path glob match with gitignore semantics (`*` within segment, `**` across segments; four anchors `//abs`, `~/home`, `/project-root`, `./cwd`)
  - `mcp__<server>__<tool>` → literal match against `event.toolName`
  - Bash glob: `*` matches any chars including spaces; word-boundary at trailing ` *` vs no-space prefix (`Bash(ls *)` excludes `lsof`; `Bash(ls*)` includes both); `:*` trailing-sugar equivalence (`Bash(ls:*)` ≡ `Bash(ls *)`); mid-pattern `:` is literal
  - Patterns more specific than `<command> *` (e.g. `Bash(git push *)`) fire the hook whenever `$()`, backticks, or `$VAR` interpolation are present in the command, matching upstream's "fail-open on uncertain context" rule
  - **Fail-open on parse failure**: when the Bash command cannot be parsed, the bridge fires the hook regardless. This matches Claude Code's documented best-effort behavior — the doc explicitly says "use the permission system rather than a hook to enforce a hard allow or deny."
  - Composition with `matcher`: AND semantics; `matcher` filters at group level, `if` further narrows within that group
  - Implementation lives at `bridges/hooks/if-field/{parser,bash,glob,extract,match}.ts` (~300 LoC across 5 small modules); architecture test exercises every fixture row in `code.claude.com/docs/en/hooks-guide` § "Filter by tool name and arguments with the `if` field" truth table verbatim

### Tool-Name Translation

- [ ] **TOOL-01**: A bidirectional Claude ↔ Pi tool-name mapping table lives in `bridges/hooks/tool-names.ts` as the single source of truth. The bridge translates Pi's `event.toolName` (lowercase per `@earendil-works/pi-coding-agent` types: `bash`, `read`, `edit`, `write`, `grep`, `find`, `ls`, ...) to Claude form (`Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`, `LS`, ...) at two points: (1) before matcher comparison so user-written Claude-form matchers match incoming Pi events; and (2) before serializing the `tool_name` field into the hook child's stdin payload for `PreToolUse` / `PostToolUse` / `PostToolUseFailure`. MCP tools (`mcp__server__tool`) bypass the table (same convention both sides). An architecture test asserts the mapping table covers every Pi `toolName` literal exported in the peer-dep `types.d.ts` discriminated union; adding a Pi tool requires updating the table. The `find ↔ Glob` mapping is flagged as LOW-confidence pending an implementation-time fixture test
- [ ] **TOOL-02**: A plugin is marked `(unavailable) {unsupported hooks}` at resolve time — non-installable, no per-entry soft-degrade — if its `hooks.json` declares ANY entry meeting any of these conditions: (a) matcher is a regex pattern per MATCH-02; (b) matcher contains any token (after pipe-OR split and MCP pass-through) without a TOOL-01 mapping entry — meaning the plugin declares a hook matching a Claude tool with no Pi analog (e.g. `MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`); (c) event is in bucket E (Notification, PermissionRequest, PermissionDenied, MessageDisplay); (d) event is in bucket F (TeammateIdle); (e) event is in bucket G (Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove); (f) event is in bucket H (ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted); (g) event is SubagentStart or SubagentStop AND `softDepStatus(pi).agents.present === false` at probe time; (h) handler `type` is anything other than `"command"` — `http` / `mcp_tool` / `prompt` / `agent` types require runtime infrastructure (HTTP client, MCP server-tool dispatch, LLM evaluation) not in v1.13's scope and not exercised by any first-party plugin. The resolver's `installable: true | false` discriminator flips on these conditions; reconcile honors the flip across `/reload` cycles (e.g. installing `pi-subagents` and reloading flips a (g)-blocked plugin back to installable). All eight conditions render the same `{unsupported hooks}` reason; the distinguishing detail belongs in debug-log only. (The `if` field is NOT in this list — v1.13 implements it per MATCH-03. The `asyncRewake` family is NOT in this list — v1.13 implements it per HOOK-06 + EXEC-05.)

### Bridge Dispatch Core

- [ ] **DISP-01**: Bridge calls `pi.on(eventName, handler)` exactly once per supported Pi event type at extension-factory time; routing state is read from `shared/event-router.ts`
- [ ] **DISP-02**: Routing table is cleared and rebuilt synchronously by `rebuildRoutingTables(state, loc)` called from `orchestrators/reconcile/apply.ts` after each scope's apply pass; rebuild is sub-millisecond and atomic by Node's single-thread model
- [ ] **DISP-03**: Every composite handler closes over an epoch integer; a module-level `liveEpoch` cell is bumped on each bridge load; stale handlers from prior loads are no-ops (NFR-2: `/reload` always suffices, no Pi restart required)
- [ ] **DISP-04**: Dispatch ordering is deterministic -- entries sorted by `compareByNameThenScope` (project-first, alphabetical); within one plugin, declaration order from `hooks.json`; fan-out sequential and awaited within one composite-handler invocation

### Hook Child-Process Execution

- [ ] **EXEC-01**: Hook child process runs via `node:child_process.spawn` with cwd = Pi `ctx.cwd` snapshot at dispatch time; env merges process env with both `CLAUDE_*` and `PI_*` variables for portability
- [ ] **EXEC-02**: Per-hook-entry `timeout` field overrides a 600s bridge-wide default (matching Claude Code's `command`-handler upstream default); on timeout: SIGTERM → 5s grace → SIGKILL; `maxBuffer: 1MB` on stdout; stdin payload truncated at 256KB with `_truncated: true` marker
- [ ] **EXEC-03**: Hook stderr is debug-logged only -- never routed through `ctx.ui.notify` at runtime (IL-2). Install-time hook-config errors continue to surface through `notify`.
- [ ] **EXEC-04**: When a hook handler declares `args: [string, ...]`, the bridge invokes `node:child_process.spawn(command, args, options)` (exec form) instead of `spawn(command, [], { shell: true })` (shell form). The default (no `args` field) remains shell form. The `shell` field (HOOK-03 tolerated extension) selects the shell binary for shell form only; ignored under exec form
- [ ] **EXEC-05**: Background-spawn pattern for `asyncRewake: true` hooks (HOOK-06): `spawn(command, args, { detached: false, stdio: ["pipe", "pipe", "pipe"] })` — detached false so the child stays in the parent process group for `/reload`-safe SIGKILL, but the parent does NOT await the child; stderr buffer capped at 64KB (truncated with `_truncated: true` marker preserved), stdout capped at maxBuffer per EXEC-02; child PID + dispatch metadata + plugin-id recorded in the `AsyncRewakeRegistry`; one exit-handler per child watches for code 2 and triggers the HOOK-06 injection; orphan children (parent crashed mid-flight) are reaped at next bridge load via PID-table scan

### Per-Event Payload Translators

- [ ] **PAYL-01**: Bucket A -- 8 direct 1:1 events round-trip cleanly with field-rename + type-coercion translators: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd. PreToolUse / PostToolUse / PostToolUseFailure translators additionally map Pi's lowercase `event.toolName` to Claude's capitalized `tool_name` via the TOOL-01 mapping before writing the stdin payload
- [ ] **PAYL-02**: Bucket B `FileChanged` synthesizes via `chokidar@^5` with `awaitWriteFinish`; cross-platform CI matrix on Linux + macOS + Windows is mandatory; watcher lifecycle owned by `bridges/hooks/lifecycle.ts`; debounced on rename-replace sequences
- [ ] **PAYL-03**: Bucket D `Stop` synthesizes by intercepting Pi's `agent_end`; on hook returning `{"decision": "block", "reason": "..."}`, bridge calls `pi.sendUserMessage(reason, { deliverAs: "followUp" })` exactly once per logical agent end (idempotency guard per `(plugin, turn-id)`); an N-loop safety cap (default 10) emits a one-shot notify warning when hit. Canary plugin = `ralph-wiggum`; end-to-end integration test gates milestone correctness.
- [ ] **PAYL-04**: Bucket D rest -- CwdChanged, PostToolBatch, UserPromptExpansion, StopFailure each have a documented synthesis approach with the loss-mode comment block from the authority doc preserved verbatim in `bridges/hooks/payloads/<event>.ts`
- [ ] **PAYL-05**: SubagentStart / SubagentStop translators wire to `pi.events.on("subagent:async-started" / "subagent:async-complete", ...)` for async runs and synthesize from `pi.on("tool_call" / "tool_result")` filtered on `toolName === "subagent"` for sync runs — but ONLY when `softDepStatus(pi).agents.present` is true at resolve time. When pi-subagents is absent, a plugin declaring SubagentStart/Stop hooks is marked unavailable per TOOL-02(g); installing pi-subagents and `/reload` flips the plugin back to installable. Deliberately diverges from the v1.12 per-component soft-degrade pattern (agent components with pi-subagents absent install with `{requires pi-subagents}` marker) because v1.13 chose the strict-supportability stance for hooks
- [ ] **PAYL-06**: Bucket G events (Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove) do not have dispatchers registered in v1.13; any plugin declaring hooks for these events is marked unavailable per TOOL-02(e). When the upstream PRs (`pi-mcp-adapter` for Elicitation, `@zenobius/pi-worktrees` for Worktree events) land in a future milestone, bucket G can be moved to a supported bucket and the resolver gate relaxed
- [ ] **PAYL-07**: Bucket H events (ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted) are semantically inapplicable to Pi; any plugin declaring hooks for these events is marked unavailable per TOOL-02(f). No upstream PR can unlock them (Pi's model has no analog for these concepts). Catalog these events in the bridge's `tool-names.ts` neighbor `event-buckets.ts` for resolver-time classification

### User-Facing Surface

- [ ] **SURF-01**: `info <plugin>` renders a new `hooks:` line per declared hook entry showing event and matcher; `hooks` inserts between `commands` and `mcp` alphabetically. The `hooks:` line renders ONLY for installable plugins; unavailable plugins continue to render `components: not resolved` per the existing v1.0+ unavailable-row contract. No per-entry gating/never-fires annotation needed — TOOL-02's strict policy means every rendered hook entry IS dispatchable
- [ ] **SURF-02**: `shared/notify.ts` gains a typed `HookSummary` discriminated model plus a new `ClaudeHookEvent` closed-set tuple (16 supported events); all UI surfaces consume `HookSummary` (no string re-derivation at render time -- the v1.3-string-API failure mode v1.4 fixed must not regress). The `GatingReason` / `FidelityNote` tuples proposed in research are dropped — TOOL-02's strict policy removes the need for per-entry gating language entirely
- [ ] **SURF-03**: Install-time `notify` warnings emit for bucket-D Stop, CwdChanged, UserPromptExpansion (synthesis caveat disclosure with `<lossy synthesis>` marker + per-event closed-set reason token); PostToolBatch and StopFailure are README-only (no user-visible loss). These warnings are PER-PLUGIN-PER-EVENT and emit only for plugins that actually pass TOOL-02 and install
- [ ] **SURF-04**: `list` does NOT add a hook-count column (symmetry with the four existing component types -- each plugin line stays terse); no standalone `/claude:plugin hooks <plugin>` command (info already covers it)
- [ ] **SURF-05**: Install-time warning emits once per plugin when `rewakeMessage` or `rewakeSummary` are declared without `asyncRewake: true` (no-op upstream; warn so the plugin author can spot a config bug). Unknown extension field names surface only in debug-log. Plugins WITH `asyncRewake: true` install normally per HOOK-06 — no install-time warning for the normal case

### Lifecycle Integration

- [ ] **LIFE-01**: Hooks bridge slots into the existing 4-bridge cascade as a 5th component in `transaction/runPhases.ts` (plan / stage / unstage / discover mirrors the existing cascade shape); install / uninstall / update / reinstall orchestrators add the hooks phase row
- [ ] **LIFE-02**: Hook install / uninstall operations emit a plugin row through the v1.4 `NotificationMessage` model, triggering the existing reload-hint cascade (no new top-level notify pattern; no new closed-set tokens for state-change tokens)
- [ ] **LIFE-03**: Per-plugin hooks subtree is contained at `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (NFR-10 extension); each hook `command` path resolves via `fs.realpath` + `assertPathInside(<pluginRoot>, realpath)` -- symlinked escape rejected at install with notify error; plugin name with path-separator sanitized via existing `assertSafeName`

### Operator Observability

- [ ] **OBS-01**: `shared/debug-log.ts` is the sole debug output seam for the hook bridge; gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`; never uses `console.error`, `process.stderr.write`, or `ctx.ui.notify` for runtime hook diagnostic output

## v1.14+ Requirements

Deferred to future milestones. Tracked but not in v1.13 scope.

### Differentiators

- **MATCH-V2-01**: Full regex matchers (currently detect-and-reject; 100% first-party coverage achieved without them)
- **TYPES-V2-01**: Non-`command` handler types (`http` / `mcp_tool` / `prompt` / `agent`). None used by first-party plugins today; revisit when ecosystem demand materializes
- **SURF-V2-01**: `/claude:plugin hooks <plugin>` match-trace command -- "given this event payload, which hooks would fire?"
- **SURF-V2-02**: Per-plugin compat CI -- drift detection when Claude Code adds new hook events or extension fields

### Relaxing TOOL-02 gates (each unblocks previously-unavailable plugins)

- **PROM-01**: Add Pi-side analogs (or Pi-recognized synonyms) for Claude tools currently with no Pi mapping (`MultiEdit`, `NotebookEdit`, `NotebookRead`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `TodoRead`, `ExitPlanMode`, ...) so plugins with matchers referencing these flip from `(unavailable) {unsupported hooks}` to installable; each new mapping requires a TOOL-01 table update and a fixture test
- **GPROM-01**: Promote G-bucket events (Elicitation / ElicitationResult, WorktreeCreate / WorktreeRemove) to supported once the required upstream PRs land on `pi-mcp-adapter` and `@zenobius/pi-worktrees`; resolver gate TOOL-02(e) relaxes
- **EPROM-01**: Promote E-bucket events (Notification, PermissionRequest, PermissionDenied, MessageDisplay) to supported once `@earendil-works/pi-coding-agent` exposes the corresponding runtime events; resolver gate TOOL-02(c) relaxes
- **FPROM-01**: Promote F-bucket TeammateIdle to supported once a Pi-side agent-team / teammate-idle primitive exists; resolver gate TOOL-02(d) relaxes
- **HPROM-01**: Bucket H events stay permanently unsupportable on Pi (semantically inapplicable); TOOL-02(f) gate is intentionally a permanent gate, not deferred work

## Out of Scope

Two distinct categories of unsupported events, plus other v1.13 boundaries.

### Blocked on upstream PRs not committed by v1.13 (9 events; documented as known limitations)

| Event(s) | Required PR target |
|---|---|
| Notification, PermissionRequest, PermissionDenied, MessageDisplay | `@earendil-works/pi-coding-agent` runtime exposures |
| TeammateIdle | New Pi feature (no agent-team primitive in Pi or `pi-subagents`) |
| Elicitation, ElicitationResult | `pi-mcp-adapter` -- register `ElicitRequestSchema` handler + publish on `pi.events` |
| WorktreeCreate, WorktreeRemove | `@zenobius/pi-worktrees` -- publish `worktree:created` / `worktree:removed` on `pi.events` from existing command handlers |

v1.13 does NOT depend on or commit to sending any of these PRs. See `docs/research/claude-hooks-vs-pi-events.md` § "Upstream-fixable blockers".

### Semantically inapplicable to Pi (5 events; silently dropped at parse)

| Event | Reason |
|---|---|
| ConfigChange | Matcher values (`user_settings`, `policy_settings`, ...) are Claude paths/concepts that don't exist under Pi |
| Setup | No Pi `--init-only` CLI equivalent; the session model has no one-shot init phase |
| InstructionsLoaded | Pi reads a different context-file model (`AGENTS.md`, not `CLAUDE.md` / `.claude/rules/*.md`) |
| TaskCreated, TaskCompleted | No canonical Pi task primitive; rpiv-todo and pi-crew are competing extension takes with different semantics |

### Other v1.13 boundaries

| Item | Reason |
|---|---|
| Full regex matchers | Literal + pipe-OR covers 100% of official Anthropic marketplace (v1.13 evidence) |
| `asyncRewake` / `rewakeMessage` / `rewakeSummary` semantics | Silently degrade to synchronous in-band (extension fields tolerated, not implemented) |
| Per-hook telemetry / metrics | IL-4 (no telemetry V1) |
| Hot-reload of hook configs without `/reload` | Structurally impossible: `pi.on()` is non-removable in `@earendil-works/pi-coding-agent` |
| Per-hook enable/disable within a plugin | Anti-feature: hooks live as a unit with the plugin |
| Hook-config DSL extensions beyond Claude Code contract | Anti-feature: bridge fidelity is the value prop |
| `/claude:plugin hooks <plugin>` standalone command | `info` already covers it (anti-feature for v1.13; revisit in v1.14+) |
| `list` hook-count column | Symmetry with four existing component types (anti-feature) |
| Per-entry soft-degrade for partially-supportable hooks (G/H/E/F bucket events, unknown-tool matchers, regex matchers, SubagentStart/Stop without pi-subagents) | TOOL-02 strict-supportability stance: ship only plugins whose hooks fire 100% correctly. Per-entry soft-degrade for hooks rejected. (Deliberate divergence from the v1.12 per-COMPONENT soft-degrade pattern for agent components — only the HOOK component type adopts strict gating in v1.13.) |
| JSON / dry-run modes for the new hooks surface | Inherits the milestone-level backlog deferral from PROJECT.md Out of Scope |

### Marketplace coverage under v1.13 strict TOOL-02

Per the audit in `docs/research/claude-hook-config-syntax.md` § 10 (cross-checked against `anthropics/claude-code` at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c`):

| Plugin | Hooks? | v1.13 result | Block reason(s) |
|---|---|---|---|
| `agent-sdk-dev` / `claude-opus-4-5-migration` / `code-review` / `commit-commands` / `feature-dev` / `frontend-design` / `plugin-dev` / `pr-review-toolkit` | no | INSTALLS (8/8) | n/a |
| `explanatory-output-style` / `learning-output-style` / `ralph-wiggum` / `hookify` | yes | INSTALLS (4/4) — hooks dispatchable | n/a |
| `security-guidance` | yes | **UNAVAILABLE `{unsupported hooks}`** | TOOL-02(b) `MultiEdit`/`NotebookEdit` only. The `if` field is implemented in v1.13 per MATCH-03; the `asyncRewake` family is implemented per HOOK-06 + EXEC-05. Sole remaining v1.14+ unblocker is PROM-01 (tool-name mapping additions). |

**Total v1.13 first-party coverage: 12/13 (92.3%) installable. Hook-using plugins: 4/5 (80%).** The single regression — `security-guidance` — is justified by the strict-supportability stance and has a single remaining blocker: TOOL-02(b) (`MultiEdit` / `NotebookEdit` tool-name gap). PROM-01 in v1.14+ resolves this and flips the plugin to installable. Both the `if` field (MATCH-03) and the `asyncRewake` family (HOOK-06 + EXEC-05) are implemented in v1.13 — they were previously v1.14+ dependencies but were promoted into v1.13 scope after their respective targeted-research passes confirmed Pi has the required runtime primitives.

## Traceability

| REQ-ID | Phase | Status |
|---|---|---|
| HOOK-01..06 | (filled by roadmapper) | (filled by roadmapper) |
| MATCH-01..03 | (filled by roadmapper) | (filled by roadmapper) |
| TOOL-01..02 | (filled by roadmapper) | (filled by roadmapper) |
| DISP-01..04 | (filled by roadmapper) | (filled by roadmapper) |
| EXEC-01..05 | (filled by roadmapper) | (filled by roadmapper) |
| PAYL-01..07 | (filled by roadmapper) | (filled by roadmapper) |
| SURF-01..05 | (filled by roadmapper) | (filled by roadmapper) |
| LIFE-01..03 | (filled by roadmapper) | (filled by roadmapper) |
| OBS-01 | (filled by roadmapper) | (filled by roadmapper) |
