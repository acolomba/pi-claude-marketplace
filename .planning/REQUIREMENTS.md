# Requirements: pi-claude-marketplace v1.13 Claude Hook Bridge

**Defined:** 2026-06-13
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Add a hooks component bridge alongside the existing skills/commands/agents/MCP bridges, translating Claude plugin hook declarations into Pi extension event subscriptions and shell-outs. **v1.13 ships the 8 bucket-A direct-1:1-map events only** (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd) — the subset where dispatch fires with 100% fidelity to the Claude Code contract. The 22 other Claude hook events (bucket B FileChanged, bucket D's 5 lossy-synthesis events, soft-dep conditional SubagentStart/SubagentStop, plus the 14 architecturally-blocked events in buckets E/F/G/H) are out-of-scope for v1.13 and tracked as v1.14+ promotions. This deliberately tighter scope keeps the strict-supportability stance internally consistent at BOTH the event AND plugin levels — the bridge ships only events it can dispatch reliably, and plugins are unavailable only if they reference events outside that set.

**Authority sources:**

- `docs/research/claude-hooks-vs-pi-events.md` — event taxonomy, bucket assignments, marketplace audit, soft-dep wiring
- `docs/research/claude-hook-config-syntax.md` — full Claude Code hook config field reference (file layout, standard fields, per-event stdin/stdout, env vars, `if` / `asyncRewake` semantics, per-plugin audit), each field tagged IMPLEMENT / TOLERATE / ESCALATE

Supporting research under `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`.

> **Scope-mismatch note for the roadmapper:** The five supporting-research docs were written against the original 16-event scope (buckets A + B + D + soft-dep conditional). REQUIREMENTS.md supersedes them on event scope — v1.13 ships bucket-A only (8 events). When consuming the research docs, treat any reference to `FileChanged` (bucket B), `Stop` / `CwdChanged` / `PostToolBatch` / `UserPromptExpansion` / `StopFailure` (bucket D), or `SubagentStart` / `SubagentStop` (soft-dep) as v1.14+ scope (PAYL-V2-01..PAYL-V2-07). In particular: STACK.md's `chokidar@^5` dependency is deferred to v1.14+ alongside PAYL-V2-01; PITFALLS.md's bucket-D loss-mode catalog is deferred; ARCHITECTURE.md's 9-phase ordering shrinks because bucket-B/D/soft-dep phases drop out of v1.13. The MATCH-03 (`if` field) and HOOK-06 + EXEC-05 (`asyncRewake`) implementation REQs stay in v1.13 as forward-compat for third-party plugins, despite no first-party plugin exercising them under bucket-A-only scope.

## v1.13 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Component Type, Schema, Parser, Matcher

- [x] **HOOK-01**: A new `hooks` component type appears in the resolver alongside `skills` / `commands` / `agents` / `mcpServers`; plugin manifests declaring `hooks` resolve as `installable: true` and the discriminated `installable: true | false` resolver contract is preserved (NFR-7)
- [x] **HOOK-02** (amended by D-57-01): State `schemaVersion` STAYS at `Literal(1)` — no bump. `PLUGIN_INSTALL_RECORD_SCHEMA.resources` gains a required `hooks: Type.Array(Type.String())` field; the additive default `hooks: []` is applied per-plugin by extending `ensurePluginResources` in `persistence/migrate.ts` (mirroring the existing `agents: []` and `mcpServers: []` defaults at lines 111-119). The mutation flag triggers the existing `persistMigratedState` fire-and-forget atomic-write seam (NFR-1 via `atomicWriteJson`). v1.12 state.json loads cleanly under v1.13 code without losing existing fields — typebox accepts the new required field once the default-fill normalization runs before `STATE_VALIDATOR.Check()`. Rationale: every hook-using plugin under v1.0–v1.12 was rejected as `UNSUPPORTED_COMPONENT_KIND` (`domain/resolver.ts:138`), so no existing state.json record carries hook resources to migrate; a `schemaVersion` bump would be signaling-only ceremony with no concrete safety win. See `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md` § D-57-01 for the full amendment rationale.
- [x] **HOOK-03**: Hook-config TypeBox schema uses `additionalProperties: true` at every nesting level; unknown payload fields preserved through state round-trip. The known additive-only extension set is `{ statusMessage, once, async, shell, args }` — each is silently honored or silently dropped per the per-field implementability decisions in `docs/research/claude-hook-config-syntax.md` § 7 without affecting plugin installability. The `if` field is IMPLEMENTED per MATCH-03. The `asyncRewake` / `rewakeMessage` / `rewakeSummary` family is IMPLEMENTED per HOOK-06 (registry) + EXEC-05 (spawn pattern). Only non-`command` handler types remain as ESCALATE triggers (TOOL-02(h)). Unknown extension field names surface debug-log only and do NOT trigger unavailability (forward-compat with Claude Code's tolerant parsing)
- [x] **HOOK-04**: The closed-set `REASONS` token `"hooks"` is renamed to `"unsupported hooks"` (no longer a manifest-field carve-out — it's now a descriptive 2-word reason at `shared/notify.ts::REASONS`); `MANIFEST_FIELD_REASONS` in `install.ts` drops `"hooks"` (keeps `"lspServers"`); every existing catalog-UAT fixture row of the form `(unavailable) {hooks}` in `docs/output-catalog.md` is updated to `(unavailable) {unsupported hooks}` in lockstep with the source rename, plus the corresponding byte-equality test cases. The semantic shift is intentional: under v1.13, a plugin declaring hooks the bridge can fully dispatch installs cleanly (no unavailable reason); a plugin declaring hooks the bridge cannot fully dispatch renders `{unsupported hooks}` per TOOL-02
- [x] **HOOK-05**: The bridge sets the following environment variables on every hook child process at dispatch time (additive to EXEC-01's existing `CLAUDE_*` / `PI_*` merge): `CLAUDE_PROJECT_DIR` = `ctx.cwd` snapshot; `CLAUDE_PLUGIN_ROOT` = absolute path to `<scopeRoot>/pi-claude-marketplace/plugins/<plugin-id>/`; `CLAUDE_PLUGIN_DATA` = absolute path to `<scopeRoot>/pi-claude-marketplace/data/<plugin-id>/` (mkdir-p inside the per-plugin lock); `CLAUDE_ENV_FILE` = absolute path to a per-session scratch file under `<scopeRoot>/pi-claude-marketplace/data/_shared/claude-env-<sessionId>.env`, shared across all plugins' hooks in the same session (matches Claude Code upstream's cross-hook accumulation contract); the bridge sets the path only — hooks own create/append/read; the bridge does NOT read, write, or delete the file; present only for SessionStart in v1.13 (CwdChanged and FileChanged are H-bucket blocked; Setup never fires); `CLAUDE_CODE_REMOTE` is intentionally unset (Pi runs locally) (amended 2026-06-14 per D-60-06)
- [ ] **HOOK-06**: The bridge implements the `asyncRewake` / `rewakeMessage` / `rewakeSummary` field family via a bridge-owned `AsyncRewakeRegistry` (~250 LoC at `bridges/hooks/async-rewake/registry.ts` + dispatcher integration). When a hook entry declares `asyncRewake: true` (which upstream implies `async: true` per `code.claude.com/docs/en/hooks` Command-hook-fields table since Claude Code v2.1.72), the bridge spawns the hook detached (EXEC-05), registers the child PID + dispatch metadata in the registry, returns immediately so the triggering tool call proceeds, and watches for process exit. **On exit code 2**: the bridge concatenates `rewakeMessage` (as prefix if present) with the child's stderr (or stdout if stderr is empty), then injects the result into the model context via `pi.sendMessage({ role: "custom", customType: "claude-hook-rewake", display: false, content: <payload> }, { deliverAs: ctx.isIdle() ? "nextTurn" : "followUp" })`. The `display: false` flag matches Claude Code's `<system-reminder>` semantic (user-invisible, model-visible via `convertToLlm()` per peer-dep `messages.d.ts:32-39`). The `deliverAs: "nextTurn"` path queues at the next user-prompt boundary (verified at `agent-session.js:985-987` enqueue + `:790-794` drain); the `"followUp"` path injects mid-stream during an active loop. **On exit code 0 or other non-2 codes**: silent background completion, no injection. **`rewakeSummary`** is surfaced via `ctx.ui.notify` at process exit (UI-only status; not added to model context). **Lifecycle**: registry cleared on `/reload`; orphan children SIGKILLed; multi-hook fan-in supported via independent `dispatchId` per registered process. **`rewakeMessage` / `rewakeSummary` without `asyncRewake: true`** are no-op upstream and remain SURF-05's warned-but-installed case
- [x] **MATCH-01**: User-facing matcher syntax supports literal **Claude tool names** (e.g. `Edit`, `Bash`, `Read`; matching Claude Code's hook contract) and pipe-OR alternation (`Edit|Write`); empty matcher `""` matches all tools of that event type; MCP tool matchers (`mcp__server__tool`) pass through unchanged. Pi-form lowercase matchers (e.g. `edit`) never match — the bridge always normalizes the incoming Pi event to Claude form before matcher comparison
- [x] **MATCH-02**: Regex matchers (any character outside `[A-Za-z0-9_|\-]` and not part of an `mcp__` prefix) detected at install and trigger plugin unavailability per TOOL-02 (no per-entry skip; the strict supportability policy applies — the bridge does not partially load hooks)
- [x] **MATCH-03**: The bridge implements the `if` field on tool-event hook entries (PreToolUse / PostToolUse / PostToolUseFailure; bridge ignores `if` on non-tool events to match upstream's "attaching to other events prevents the hook from running" behavior). Implementation parses Claude Code's permission-rule syntax `<ToolName>(<pattern>)` (per `docs/research/claude-hook-config-syntax.md` § 7 and `code.claude.com/docs/en/permissions` § "Permission rule syntax"), extracts the parenthesized pattern, and matches it against the per-tool argument target. **Accepted rule prefixes are the upstream-faithful closed set: `Bash`, `Read`, `Edit`, `Write`, plus the three MCP literal forms (`mcp__<server>`, `mcp__<server>__*`, `mcp__<server>__<tool>`).** Per upstream's cross-tool semantic ("Read rules apply to all built-in tools that read files like Grep and Glob" and "Edit rules apply to all built-in tools that edit files"), `Read` covers Pi `{read, grep, find, ls}`; `Edit` covers `{edit, write}`; `Write` covers `{write}`; `Bash` covers `{bash}`. **`Grep`, `Glob`, `LS`, `MultiEdit`, `NotebookEdit`, `PowerShell`, `WebFetch`, `Agent`, `Cd` are NOT accepted as standalone `if`-field prefixes** — they fall under `Read` / `Edit` via the cross-tool mapping or are out-of-scope tools.
  - `Bash(...)` → `event.input.command` with subcommand parsing (compound-separator split on `&&` `||` `;` `|` `|&` `&` newline; recursive `$(...)` and backtick subcommand extraction; process-wrapper strip for `timeout`/`time`/`nice`/`nohup`/`stdbuf`/bare `xargs`; `xargs` with flags matches as `xargs`; `find -exec` and `find -delete` arguments are opaque); fires when ANY subcommand matches the glob.
  - `Read(<glob>)` → `event.input.path` for Pi `{read, grep, find, ls}` with gitignore-semantics glob and four anchors (`//abs`, `~/home`, `/project-root`, `./cwd`). **When `event.input.path` is missing (Pi `grep` / `find` / `ls` optional-path tools), the bridge substitutes `ctx.cwd` then matches** — upstream Grep/LS default to cwd internally before the `if` filter runs.
  - `Edit(<glob>)` → `event.input.path` for Pi `{edit, write}` with the same anchor semantics.
  - `Write(<glob>)` → `event.input.path` for Pi `{write}`.
  - `mcp__<server>` → server-prefix match: fires on any tool event with `event.toolName === "mcp__<server>__<anything>"`.
  - `mcp__<server>__*` → equivalent to bare `mcp__<server>` (explicit wildcard form).
  - `mcp__<server>__<tool>` → literal equality against `event.toolName`.
  - Bash glob: `*` matches any chars including spaces (within one path segment for path tools); `**` matches across segments; word-boundary at trailing ` *` vs no-space prefix (`Bash(ls *)` excludes `lsof`; `Bash(ls*)` includes both); `:*` trailing-sugar equivalence (`Bash(ls:*)` ≡ `Bash(ls *)`); mid-pattern `:` is literal.
  - Patterns more specific than `<command> *` (e.g. `Bash(git push *)`) fire the hook whenever `$()`, backticks, or `$VAR` interpolation are present in the command, matching upstream's "fail-open on uncertain context" rule.
  - **Fail-open on ALL `if`-layer failure modes** (malformed permission-rule syntax, unknown rule prefix, broken glob, unparseable Bash command at runtime): the bridge fires the hook regardless. This matches Claude Code's documented best-effort behavior — the doc explicitly says "use the permission system rather than a hook to enforce a hard allow or deny." Plugin installs cleanly; a `hookDebugLog` warning records the fall-open cause.
  - Composition with `matcher`: AND semantics; `matcher` filters at group level, `if` further narrows within that group.
  - Implementation lives at `bridges/hooks/if-field/{glob,bash,index}.ts` plus the `domain/components/hook-if-targets.ts` rule-prefix → Pi event set + target field mapping table; architecture test exercises every fixture row in `code.claude.com/docs/en/hooks-guide` § "Filter by tool name and arguments with the `if` field" truth table verbatim plus the Bash compound / wrapper / sugar cases from `code.claude.com/docs/en/permissions`.

### Tool-Name Translation

- [x] **TOOL-01**: A bidirectional Claude ↔ Pi tool-name mapping table lives in `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` (amended location per D-58-04; NOT `bridges/hooks/tool-names.ts`) as the single source of truth. The bridge translates Pi's `event.toolName` (lowercase per `@earendil-works/pi-coding-agent` types: `bash`, `read`, `edit`, `write`, `grep`, `find`, `ls`, ...) to Claude form (`Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`, `LS`, ...) at two points: (1) before matcher comparison so user-written Claude-form matchers match incoming Pi events; and (2) before serializing the `tool_name` field into the hook child's stdin payload for `PreToolUse` / `PostToolUse` / `PostToolUseFailure`. MCP tools (`mcp__server__tool`) bypass the table (same convention both sides). An architecture test asserts the mapping table covers every Pi `toolName` literal exported in the peer-dep `types.d.ts` discriminated union; adding a Pi tool requires updating the table. The `find ↔ Glob` mapping is flagged as LOW-confidence pending an implementation-time fixture test (D-58-05 LOW-confidence semantic-mismatch JSDoc shipped on the entry)
- [x] **TOOL-02**: A plugin is marked `(unavailable) {unsupported hooks}` at resolve time — non-installable, no per-entry soft-degrade — if its `hooks.json` declares ANY entry meeting any of these conditions: (a) matcher is a regex pattern per MATCH-02; (b) matcher contains any token (after pipe-OR split and MCP pass-through) without a TOOL-01 mapping entry — meaning the plugin declares a hook matching a Claude tool with no Pi analog (e.g. `MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`); (c) **event is not in the v1.13-supported bucket-A set** (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `SessionEnd`). Every other Claude hook event is unsupported in v1.13: bucket B `FileChanged` (cross-platform `fs.watch` brittleness deferred to v1.14+ per PAYL-V2-01); bucket D `CwdChanged` / `PostToolBatch` / `UserPromptExpansion` / `Stop` / `StopFailure` (documented lossy synthesis deferred to v1.14+ per PAYL-V2-02..PAYL-V2-06); soft-dep conditional `SubagentStart` / `SubagentStop` (deferred to v1.14+ per PAYL-V2-07 when soft-dep wiring matures); bucket E `Notification` / `PermissionRequest` / `PermissionDenied` / `MessageDisplay` (need upstream `pi-coding-agent` PRs — EPROM-01); bucket F `TeammateIdle` (needs Pi agent-team primitive — FPROM-01); bucket G `Elicitation` / `ElicitationResult` / `WorktreeCreate` / `WorktreeRemove` (need upstream soft-dep PRs — GPROM-01); bucket H `ConfigChange` / `Setup` / `InstructionsLoaded` / `TaskCreated` / `TaskCompleted` (semantically inapplicable to Pi — HPROM-01 confirms permanently unsupportable); (d) handler `type` is anything other than `"command"` — `http` / `mcp_tool` / `prompt` / `agent` types require runtime infrastructure (HTTP client, MCP server-tool dispatch, LLM evaluation) not in v1.13's scope and not exercised by any first-party plugin. The resolver's `installable: true | false` discriminator flips on these conditions; reconcile honors the flip across `/reload` cycles. All four conditions render the same `{unsupported hooks}` reason; the distinguishing detail belongs in debug-log only. (The `if` field is NOT in this list — v1.13 implements it per MATCH-03. The `asyncRewake` family is NOT in this list — v1.13 implements it per HOOK-06 + EXEC-05.)

### Bridge Dispatch Core

- [x] **DISP-01**: Bridge calls `pi.on(eventName, handler)` exactly once per supported Pi event type at extension-factory time; routing state is read from `shared/event-router.ts`
- [x] **DISP-02**: Routing table is cleared and rebuilt synchronously by `rebuildRoutingTables(state, loc)` called from `orchestrators/reconcile/apply.ts` after each scope's apply pass; rebuild is sub-millisecond and atomic by Node's single-thread model
- [x] **DISP-03**: Every composite handler closes over an epoch integer; a module-level `liveEpoch` cell is bumped on each bridge load; stale handlers from prior loads are no-ops (NFR-2: `/reload` always suffices, no Pi restart required)
- [x] **DISP-04**: Dispatch ordering is deterministic -- entries sorted by `compareByNameThenScope` (project-first, alphabetical); within one plugin, declaration order from `hooks.json`; fan-out sequential and awaited within one composite-handler invocation

### Hook Child-Process Execution

- [x] **EXEC-01**: Hook child process runs via `node:child_process.spawn` with cwd = Pi `ctx.cwd` snapshot at dispatch time; env merges process env with both `CLAUDE_*` and `PI_*` variables for portability
- [x] **EXEC-02**: Per-hook-entry `timeout` field overrides a 600s bridge-wide default (matching Claude Code's `command`-handler upstream default); on timeout: SIGTERM → 5s grace → SIGKILL; `maxBuffer: 1MB` on stdout; stdin payload truncated at 256KB with `_truncated: true` marker
- [x] **EXEC-03**: Hook stderr is debug-logged only -- never routed through `ctx.ui.notify` at runtime (IL-2). Install-time hook-config errors continue to surface through `notify`.
- [x] **EXEC-04**: When a hook handler declares `args: [string, ...]`, the bridge invokes `node:child_process.spawn(command, args, options)` (exec form) instead of `spawn(command, [], { shell: true })` (shell form). The default (no `args` field) remains shell form. The `shell` field (HOOK-03 tolerated extension) selects the shell binary for shell form only; ignored under exec form
- [ ] **EXEC-05**: Background-spawn pattern for `asyncRewake: true` hooks (HOOK-06): `spawn(command, args, { detached: false, stdio: ["pipe", "pipe", "pipe"] })` — detached false so the child stays in the parent process group for `/reload`-safe SIGKILL, but the parent does NOT await the child; stderr buffer capped at 64KB (truncated with `_truncated: true` marker preserved), stdout capped at maxBuffer per EXEC-02; child PID + dispatch metadata + plugin-id recorded in the `AsyncRewakeRegistry`; one exit-handler per child watches for code 2 and triggers the HOOK-06 injection; orphan children (parent crashed mid-flight) are reaped at next bridge load via PID-table scan

### Per-Event Payload Translators

- [x] **PAYL-01**: Bucket A -- 8 direct 1:1 events round-trip cleanly with field-rename + type-coercion translators: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd. PreToolUse / PostToolUse / PostToolUseFailure translators additionally map Pi's lowercase `event.toolName` to Claude's capitalized `tool_name` via the TOOL-01 mapping before writing the stdin payload. Each translator lives at `bridges/hooks/payloads/<event>.ts` with an architecture-test fixture per event. These 8 events are the entire v1.13 dispatchable scope — every other Claude hook event triggers TOOL-02(c) plugin-unavailability

### User-Facing Surface

- [x] **SURF-01**: `info <plugin>` renders a new `hooks:` line per declared hook entry showing event and matcher; `hooks` inserts between `commands` and `mcp` alphabetically. The `hooks:` line renders ONLY for installable plugins; unavailable plugins continue to render `components: not resolved` per the existing v1.0+ unavailable-row contract. No per-entry gating/never-fires annotation needed — TOOL-02's strict policy means every rendered hook entry IS dispatchable
- [x] **SURF-02**: `shared/notify.ts` gains a typed `HookSummary` discriminated model plus a new `ClaudeHookEvent` closed-set tuple (8 supported bucket-A events); all UI surfaces consume `HookSummary` (no string re-derivation at render time -- the v1.3-string-API failure mode v1.4 fixed must not regress). The `GatingReason` / `FidelityNote` tuples proposed in early research are dropped — TOOL-02's strict policy + bucket-A-only scope removes the need for any per-entry gating language entirely
- [x] **SURF-03**: No install-time synthesis-caveat warnings in v1.13 — bucket-A events have no documented loss modes. This REQ-slot is reserved for v1.14+ when bucket-D events are added (PAYL-V2-02..PAYL-V2-06); install-time `<lossy synthesis>` warnings will land alongside those events
- [x] **SURF-04**: `list` does NOT add a hook-count column (symmetry with the four existing component types -- each plugin line stays terse); no standalone `/claude:plugin hooks <plugin>` command (info already covers it)
- [x] **SURF-05**: Install-time warning emits once per plugin when `rewakeMessage` or `rewakeSummary` are declared without `asyncRewake: true` (no-op upstream; warn so the plugin author can spot a config bug). Unknown extension field names surface only in debug-log. Plugins WITH `asyncRewake: true` install normally per HOOK-06 — no install-time warning for the normal case
- [x] **SURF-06**: A user-facing hook-support document (`docs/hooks.md`, linked from `README.md`) explains in plain language which Claude Code hook events are supported in v1.13, which are deferred to v1.14+, which are permanently unsupportable, and why. Written for FIRST-TIME READERS — plugin authors evaluating "will my plugin work?" and end users wondering "why is this plugin showing `(unavailable) {unsupported hooks}`?" — NOT for project maintainers familiar with bucket A/B/C/D taxonomy, REQ-IDs, or the PRD constraints. The doc MUST cover:
  - The 8 supported events with a one-line plain-English description of each (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd)
  - What plugins can DO with those events: shell-command handlers, tool-name matchers (literal + pipe-OR), the `if` field for argument-level filtering with examples (`Bash(git push *)`, `Edit(*.ts)`), blocking tool calls via `{"decision": "block", "reason": "..."}`, modifying tool input (PreToolUse) and output (PostToolUse), running in the background via `asyncRewake: true`, per-hook `timeout` (default 600s), environment variables (`CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA`)
  - 4–6 concrete worked examples covering common plugin patterns: auto-formatters (PostToolUse on Edit/Write), bash-safety nets (PreToolUse with `if`), session-start project-rule injection, prompt audit logging at UserPromptSubmit, background security review with asyncRewake, compaction snapshotting at PreCompact
  - The unsupported event list grouped by category with one-line reasons each: "deferred to v1.14+ for engineering reasons" (FileChanged, Stop, CwdChanged, PostToolBatch, UserPromptExpansion, StopFailure, SubagentStart, SubagentStop), "blocked on upstream Pi PRs" (Notification / PermissionRequest / PermissionDenied / MessageDisplay / TeammateIdle / Elicitation / ElicitationResult / WorktreeCreate / WorktreeRemove), "permanently inapplicable to Pi" (ConfigChange / Setup / InstructionsLoaded / TaskCreated / TaskCompleted)
  - The Claude tool-name mapping table (Pi `bash`/`read`/`edit`/... ↔ Claude `Bash`/`Read`/`Edit`/...) and which Claude tools have no Pi analog yet (`MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`, ...)
  - A "what happens to my plugin?" section explaining the resolver behavior: plugins referencing any unsupported event, an unmapped tool, a regex matcher, or a non-`command` handler type install as `(unavailable) {unsupported hooks}`; how to read the `info <plugin>` output; why we chose strict supportability over partial support
  - Marketplace compatibility note: 10/13 first-party plugins install in v1.13 (76.9%); the 3 unavailable plugins (`ralph-wiggum`, `hookify`, `security-guidance`) and their specific unblock paths
  - Cross-references to the authority research docs (`docs/research/claude-hooks-vs-pi-events.md`, `docs/research/claude-hook-config-syntax.md`) for readers who want the full taxonomy, but the support doc MUST be self-contained for readers who don't follow those links
  - Style constraints: NO internal jargon (no "bucket A/D/E", no "TOOL-02(c)", no "REQ-IDs", no references to phases / plans / GSD planning artifacts, no `<lossy synthesis>` markers); plain English aimed at plugin authors; uses Claude Code's own field names (`matcher`, `if`, `asyncRewake`, `timeout`, `command`, `args`) verbatim so a reader who knows Claude Code's hook docs recognizes them
  - README.md link: add a "Hook support" section pointer in README.md so first-time readers discover the doc without needing to know where to look

### Lifecycle Integration

- [ ] **LIFE-01**: Hooks bridge slots into the existing 4-bridge cascade as a 5th component in `transaction/runPhases.ts` (plan / stage / unstage / discover mirrors the existing cascade shape); install / uninstall / update / reinstall orchestrators add the hooks phase row
- [ ] **LIFE-02**: Hook install / uninstall operations emit a plugin row through the v1.4 `NotificationMessage` model, triggering the existing reload-hint cascade (no new top-level notify pattern; no new closed-set tokens for state-change tokens)
- [x] **LIFE-03**: Per-plugin hooks subtree is contained at `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (NFR-10 extension); each hook `command` path resolves via `fs.realpath` + `assertPathInside(<pluginRoot>, realpath)` -- symlinked escape rejected at install with notify error; plugin name with path-separator sanitized via existing `assertSafeName`

### Operator Observability

- [x] **OBS-01**: `shared/debug-log.ts` is the sole debug output seam for the hook bridge; gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`; never uses `console.error`, `process.stderr.write`, or `ctx.ui.notify` for runtime hook diagnostic output

## v1.14+ Requirements

Deferred to future milestones. Tracked but not in v1.13 scope.

### Differentiators

- **MATCH-V2-01**: Full regex matchers (currently detect-and-reject; 100% first-party coverage achieved without them)
- **TYPES-V2-01**: Non-`command` handler types (`http` / `mcp_tool` / `prompt` / `agent`). None used by first-party plugins today; revisit when ecosystem demand materializes
- **SURF-V2-01**: `/claude:plugin hooks <plugin>` match-trace command -- "given this event payload, which hooks would fire?"
- **SURF-V2-02**: Per-plugin compat CI -- drift detection when Claude Code adds new hook events or extension fields

### Event-set promotions (each shrinks TOOL-02(c) and unblocks previously-unavailable plugins)

- **PAYL-V2-01**: Promote bucket B `FileChanged` via `chokidar@^5` with `awaitWriteFinish`; cross-platform CI matrix (Linux + macOS + Windows) mandatory; watcher lifecycle owned by `bridges/hooks/lifecycle.ts`. Unblocks third-party plugins using file-watch hooks
- **PAYL-V2-02**: Promote bucket D `CwdChanged` — synthesizes from Pi's cwd-change signal; documented loss modes (bash-only filter, per-tool-call vs per-change discrepancy); SURF-03 install-time `<lossy synthesis>` warning lands with this REQ
- **PAYL-V2-03**: Promote bucket D `PostToolBatch` — accumulate per-tool `PostToolUse` events with idle-window flush; documented loss mode (deeply pipelined runs may have no idle window)
- **PAYL-V2-04**: Promote bucket D `Stop` — load-bearing synthesis; intercepts Pi's `agent_end`; on hook returning `{"decision": "block", "reason": "..."}` queues synthetic user message via `pi.sendUserMessage(reason, { deliverAs: "followUp" })` exactly once per logical agent end (idempotency guard per `(plugin, turn-id)`); N-loop safety cap (default 10) with one-shot notify warning. Canary plugin = `ralph-wiggum`; unblocks `ralph-wiggum` + `hookify` + (alongside PROM-01) `security-guidance`
- **PAYL-V2-05**: Promote bucket D `UserPromptExpansion` — synthesizes from Pi's prompt-expansion signal; documented loss mode (false positives on system messages)
- **PAYL-V2-06**: Promote bucket D `StopFailure` — synthesizes from agent-error-with-context path; same shape as Stop with error context. Loss mode depends on Pi `agent_error` shape stability
- **PAYL-V2-07**: Promote soft-dep conditional `SubagentStart` / `SubagentStop` — wires to `pi.events.on("subagent:async-started" / "subagent:async-complete", ...)` for async runs and synthesizes from `pi.on("tool_call" / "tool_result")` filtered on `toolName === "subagent"` for sync runs. Conditional on `softDepStatus(pi).agents.present`; behavior when soft-dep absent is decided at promotion time

### Tool-mapping additions (relaxing TOOL-02(b))

- **PROM-01**: Add Pi-side analogs (or Pi-recognized synonyms) for Claude tools currently with no Pi mapping (`MultiEdit`, `NotebookEdit`, `NotebookRead`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `TodoRead`, `ExitPlanMode`, ...) so plugins with matchers referencing these flip from `(unavailable) {unsupported hooks}` to installable; each new mapping requires a TOOL-01 table update and a fixture test

### Architecturally-blocked-event promotions (also TOOL-02(c), unblocked by upstream work)

- **GPROM-01**: Promote G-bucket events (Elicitation / ElicitationResult, WorktreeCreate / WorktreeRemove) to supported once the required upstream PRs land on `pi-mcp-adapter` and `@zenobius/pi-worktrees`
- **EPROM-01**: Promote E-bucket events (Notification, PermissionRequest, PermissionDenied, MessageDisplay) to supported once `@earendil-works/pi-coding-agent` exposes the corresponding runtime events
- **FPROM-01**: Promote F-bucket TeammateIdle to supported once a Pi-side agent-team / teammate-idle primitive exists
- **HPROM-01**: Bucket H events stay permanently unsupportable on Pi (semantically inapplicable); TOOL-02(c) gate for H-bucket events is intentionally a permanent gate, not deferred work

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
| `explanatory-output-style` / `learning-output-style` | yes (SessionStart only) | INSTALLS (2/2) — pure bucket-A | n/a |
| `ralph-wiggum` | yes | **UNAVAILABLE `{unsupported hooks}`** | TOOL-02(c) `Stop` (bucket D). v1.14+ unblocker: PAYL-V2-04 (Stop synthesis with idempotency + N-loop cap) |
| `hookify` | yes | **UNAVAILABLE `{unsupported hooks}`** | TOOL-02(c) `Stop` (bucket D) alongside 3× bucket-A events. v1.14+ unblocker: PAYL-V2-04 |
| `security-guidance` | yes | **UNAVAILABLE `{unsupported hooks}`** | TOOL-02(b) `MultiEdit`/`NotebookEdit` AND TOOL-02(c) `Stop`. v1.14+ unblockers: PROM-01 + PAYL-V2-04. The `if` field + `asyncRewake` family are implemented in v1.13 per MATCH-03 / HOOK-06 / EXEC-05 — no longer v1.14+ blockers for this plugin. |

**Total v1.13 first-party coverage: 10/13 (76.9%) installable. Hook-using plugins: 2/5 (40%).** The strict bucket-A-only scope drops 3 first-party hook-using plugins (`ralph-wiggum`, `hookify`, `security-guidance`) because all three use `Stop` (bucket D). v1.14+ promotion of bucket-D events via PAYL-V2-02..PAYL-V2-06 will progressively re-enable them: PAYL-V2-04 (Stop synthesis with engineered safeguards — idempotency guard, N-loop cap, ralph-wiggum canary test) unblocks `ralph-wiggum` + `hookify`; `security-guidance` additionally needs PROM-01 (tool-name mapping for `MultiEdit`/`NotebookEdit`). The `if` field and `asyncRewake` family ARE implemented in v1.13 per MATCH-03 / HOOK-06 / EXEC-05 — they are no longer v1.14+ dependencies for any plugin. The trade-off is deliberate: a smaller v1.13 surface that ships at 100% fidelity is preferred over a larger surface with documented loss modes.

## Traceability

| REQ-ID | Phase | Status |
|---|---|---|
| HOOK-01 | Phase 57 | Complete |
| HOOK-02 | Phase 57 | Complete (Plan 57-01) |
| HOOK-03 | Phase 57 | Complete |
| HOOK-04 | Phase 58 (Plan 04) | Complete |
| HOOK-05 | Phase 60 | Complete |
| HOOK-06 | Phase 62 | Pending |
| MATCH-01 | Phase 58 (Plan 03) | Complete |
| MATCH-02 | Phase 58 (Plan 03) | Complete |
| MATCH-03 | Phase 61 | Complete |
| TOOL-01 | Phase 58 (Plan 01) | Complete |
| TOOL-02 | Phase 58 (Plan 03) | Complete |
| DISP-01 | Phase 59 | Complete |
| DISP-02 | Phase 59 | Complete |
| DISP-03 | Phase 59 | Complete |
| DISP-04 | Phase 59 | Complete |
| EXEC-01 | Phase 60 | Complete |
| EXEC-02 | Phase 60 | Complete |
| EXEC-03 | Phase 60 | Complete |
| EXEC-04 | Phase 60 | Complete |
| EXEC-05 | Phase 62 | Pending |
| PAYL-01 | Phase 60 | Complete |
| SURF-01 | Phase 63 | Complete |
| SURF-02 | Phase 63 | Complete |
| SURF-03 | Phase 63 (reserved for v1.14+) | Complete |
| SURF-04 | Phase 63 | Complete |
| SURF-05 | Phase 63 | Complete |
| SURF-06 | Phase 63 | Complete |
| LIFE-01 | Phase 63 | Pending |
| LIFE-02 | Phase 63 | Pending |
| LIFE-03 | Phase 63 | Complete |
| OBS-01 | Phase 59 | Complete |
