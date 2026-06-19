# Phase 61: `if` Field Permission-Rule Matcher - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 61 implements Claude Code's optional handler-level `if` field
(MATCH-03) as the filter that sits between Phase 59's group-level matcher
and Phase 60's executor. Permission-rule syntax —
`<UpstreamToolPrefix>(<glob>)` plus the three MCP literal forms — applied
only on `PreToolUse` / `PostToolUse` / `PostToolUseFailure`. AND
composition with the group-level `matcher`. Fail-open across the board to
match upstream Claude Code's documented "best-effort, not a security
boundary" contract.

The phase ships:

1. **Schema admission for `if`.** `domain/components/hooks.ts`'s
   `HOOK_HANDLER_SCHEMA` gains `if: Type.Optional(Type.String())`.
   `additionalProperties: true` already preserves unknown round-trip.
2. **Parse-time predicate compilation.** `parseHooksConfig` compiles each
   `if` string into a discriminated `IfPredicate` and stores it on the
   per-handler entry. No runtime parsing on the hot path (mirrors Phase
   58's stance: registration-time translation, no runtime translation).
   Compile failures (unparseable Claude permission-rule syntax) fall open
   to a `MATCH_ALL_IF` sentinel and emit a `hookDebugLog` warning — the
   plugin DOES install successfully.
3. **Per-tool cross-tool mapping (rule prefix → Pi event set + target
   field).** A static table at `domain/components/hook-if-targets.ts` (or
   sibling of `hook-tool-names.ts` — file split is planner's discretion)
   captures the upstream-faithful mapping: `Read` covers Pi
   `{read, grep, find, ls}`; `Edit` covers `{edit, write}`; `Write`
   covers `{write}`; `Bash` covers `{bash}`. MCP literals (3 forms) match
   against `event.toolName`. Target field is always `input.path` for
   path-tools and `input.command` for Bash. Missing path target →
   substitute `ctx.cwd`.
4. **Bash subcommand parser.** Hand-authored at
   `bridges/hooks/if-field/bash.ts` (~80-120 LoC). Implements upstream's
   exact strip / split / recurse rules verbatim — strip
   `timeout`/`time`/`nice`/`nohup`/`stdbuf`/bare `xargs` only; split on
   `&&` `||` `;` `|` `|&` `&` newline; recursively parse `$()` and
   backticks; `find -exec` argument stays opaque (NOT recursed). Process
   substitution `<()` / `>()` treated as literal. Fail-open on parse
   failure: any unparseable Bash command fires the hook (matches upstream
   "best-effort" contract).
5. **Glob engine.** Hand-authored at `bridges/hooks/if-field/glob.ts`
   (~120-180 LoC). Exactly three metacharacters (`*`, `**`, literal),
   four anchor prefixes (`//abs`, `~/home`, `/project-root`, `./cwd`)
   resolved once at parse time into a normalized absolute path, and
   one Bash-specific trailing-space word-boundary rule (`Bash(ls *)`
   excludes `lsof`; `Bash(ls*)` includes both). `:*` colon-sugar
   normalized at parse time only when trailing; mid-pattern `:` literal.
6. **Dispatch-loop insertion point.** Phase 59's `reduceBucket` (in
   `bridges/hooks/dispatch.ts`) gains a second predicate call between
   `matcherFires(entry)` (current `bridges/hooks/dispatch.ts:171`) and
   `activeExecutor(entry, event, ctx)` (current
   `bridges/hooks/dispatch.ts:175`). `if`-no-match → `continue` (skip
   the entry), not `block`. Compiled `IfPredicate` rides on
   `RoutingEntry`.
7. **Architecture test fixture.** A new test file exercises every row in
   the upstream `code.claude.com/docs/en/hooks-guide` § "Filter by tool
   name and arguments with the `if` field" truth table verbatim, plus
   the Bash compound / wrapper / sugar cases from
   `code.claude.com/docs/en/permissions`. Planner fetches the latest
   version of both pages at research time and snapshots the rows.

Phase 61 does NOT touch: hook execution / payload translators / env vars
(Phase 60, already complete), `asyncRewake` (Phase 62), lifecycle cascade
/ `info <plugin>` rendering / docs (Phase 63), the resolver, the
persistence layer, or any `orchestrators/` site beyond the existing
parse-time cache-populate that Phase 59 already wired.

</domain>

<decisions>
## Implementation Decisions

### D-61-01 (glob engine: hand-author, zero new runtime deps)

Bridge implements the glob engine as ~120-180 LoC at
`bridges/hooks/if-field/glob.ts`. Surface is exactly what Claude's
permission-rule grammar requires: three metacharacters (`*`/`**`/literal),
four anchor prefixes, and one Bash-specific trailing-space word-boundary
rule. No new runtime dependency (continues the project's deliberate
no-glob-libs stance; PROJECT.md "What NOT to Use" and STACK.md's
chokidar-deferred precedent are the load-bearing reasons).

Rationale: pulling in `picomatch` (the most-used micromatch core) or
`minimatch` would add a dep whose surface is materially larger than we
need (character classes, brace expansion, negation, extglobs — none in
Claude's rule grammar) and would compile patterns to `RegExp` internally,
which is ironic given Phase 58 rejected regex matchers (MATCH-02) to keep
the parsing surface small. Hand-authoring lets the architecture test pin
every truth-table row directly against our implementation. The
maintenance trade-off — future spec drift in Claude Code's rule grammar
becomes a hand-edit — is acceptable because the surface has been stable
for the lifetime of Claude Code's permission system and any future growth
is gated by upstream releases (planner verifies at research time before
each minor version bump).

### D-61-02 (fail-open across all `if`-layer failure modes)

EVERY `if`-layer failure mode falls open (match-all + `hookDebugLog`
warning). Plugin installs successfully; the hook fires whenever the group
matcher fires. Specifically:

- **Malformed Claude permission-rule syntax** (`if: "Bash("`,
  `if: "Edit(**broken**)"`, missing closing paren, etc.) → compile-time
  fall-open to `MATCH_ALL_IF`.
- **Unknown tool prefix** (`if: "Grep(*.ts)"`, `if: "PowerShell(...)"`,
  `if: "WebFetch(...)"`, `if: "Agent(...)"`, `if: "Cd(...)"`, typos like
  `if: "Bahsh(...)"`) → compile-time fall-open. Note that `Grep` / `Glob`
  / `LS` / `MultiEdit` / `NotebookEdit` are explicitly NOT upstream
  permission-rule prefixes; they fall under `Read`/`Edit` per
  D-61-03.
- **Runtime Bash command parse failure** (event.input.command unparseable
  shell) → dispatch-time fall-open (REQ MATCH-03 §3 wording, verbatim).
- **Missing path target at dispatch** (Pi `grep`/`find`/`ls` with no
  `input.path`) → substitute `ctx.cwd` then match. NOT fail-open
  match-all; upstream Grep/LS default to cwd internally before the `if`
  filter checks, so substituting cwd is the upstream-faithful behavior.

Rationale: upstream documents the `if` field as uniformly "best-effort,
not a security boundary" (see hooks-guide § "Filter by tool name and
arguments with the `if` field" + the precedent that pre-v2.1.85 Claude
Code "ignores it and runs the hook on every matched call"). Locking the
bridge to fail-loud at any layer would create a portability regression —
a plugin that installs fine in upstream Claude Code would flip
`(unavailable) {unsupported hooks}` in Pi-Claude. Phase 58's strict-
supportability stance applies to load-bearing CORRECTNESS gates (regex
matchers, unmapped tools, unsupported events) where we'd silently
over-fire or never-fire. The `if` field is a filter ON TOP of an
already-supported entry, and upstream's contract for it is loose; strict
behavior here exceeds the supportability gate's mandate.

### D-61-03 (rule prefix → Pi event set + target field; upstream-faithful)

Bridge accepts ONLY the upstream-documented permission-rule prefixes for
the `if` field. Cross-tool mapping mirrors upstream's "Read rules apply
to all built-in tools that read files like Grep and Glob" and "Edit rules
apply to all built-in tools that edit files" semantics, transposed onto
Pi's event surface:

| Upstream `if` prefix | Pi event(s) fired on | Target field |
| --- | --- | --- |
| `Bash(<glob>)` | `bash` | `event.input.command` (with subcommand parsing per D-61-04) |
| `Read(<glob>)` | `read`, `grep`, `find`, `ls` | `event.input.path` (cwd if absent) |
| `Edit(<glob>)` | `edit`, `write` | `event.input.path` |
| `Write(<glob>)` | `write` | `event.input.path` |
| `mcp__<server>` | any Pi tool event matching `event.toolName === "mcp__<server>__<anything>"` (server prefix match) | `event.toolName` |
| `mcp__<server>__*` | any Pi tool event matching `event.toolName === "mcp__<server>__<anything>"` (explicit wildcard form, equivalent to bare `mcp__<server>`) | `event.toolName` |
| `mcp__<server>__<tool>` | any Pi tool event with literal `event.toolName === "mcp__<server>__<tool>"` | `event.toolName` |

Pi-specific tool inputs are NOT consulted: `grep.input.glob` (Pi's
file-name filter on grep), `find.input.pattern` (Pi's glob pattern on
find), `grep.input.pattern` (the search regex). Adding these as match
targets would be a Pi extension to the upstream contract; the user
explicitly chose upstream-faithful + Pi-semantic event mapping, not Pi
extensions.

Missing path target (Pi `grep`/`find`/`ls` called without `input.path`)
substitutes `ctx.cwd`. Rationale: upstream Claude Code's Grep / LS
default to cwd internally before the `if` filter runs, so `Read(src/**)`
against a `grep` call with no path is equivalent to checking cwd against
`src/**` (typically no match unless cwd is itself under src). This
matches the behavior plugin authors targeting upstream would expect.

**REQUIREMENTS.md amendment requested (consequence of D-61-03):**
MATCH-03's current wording lists "File-path tools
(`Edit(...)` / `Write(...)` / `Read(...)` / `Grep(...)` / `Glob(...)` /
`LS(...)`, plus future-stable `MultiEdit(...)` / `NotebookEdit(...)`)"
as accepted `if`-field forms. Per the upstream permission-rule docs
(`code.claude.com/docs/en/permissions`), `Grep` / `Glob` / `LS` /
`MultiEdit` / `NotebookEdit` are NOT upstream permission-rule prefixes —
they're covered by `Read` (for readers) and `Edit` (for editors) via
upstream's cross-tool category mapping. Planner amends MATCH-03 to: (a)
drop `Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit` from the
prefix list; (b) replace with the upstream cross-tool mapping table
shown above; (c) add the two extra MCP forms (`mcp__<server>` and
`mcp__<server>__*`) — currently only `mcp__<server>__<tool>` is listed;
(d) add the missing-target → substitute-cwd rule for path-tools whose
`input.path` is optional in Pi's surface. Amendment lands in lockstep
with the Phase 61 commit (atomic-supersession lesson; matches Phase 58
D-58-01 / D-58-04 / D-58-06 lockstep pattern).

### D-61-04 (Bash command parser: upstream-verbatim)

Bash subcommand parser implements upstream's exact contract per
`code.claude.com/docs/en/permissions` § "Bash" + § "Process wrappers" +
§ "Compound commands":

- **Strip wrappers (closed set, no flags):** `timeout`, `time`, `nice`,
  `nohup`, `stdbuf`, bare `xargs`. `xargs -n1 grep pattern` matches as
  `xargs` (NOT `grep`); the with-flags clause is load-bearing.
- **Do NOT strip:** `env`, `sudo`, `chronic`, `watch`, `setsid`,
  `ionice`, `flock`, `devbox run`, `mise exec`, `npx`, `docker exec`,
  and any other environment runners / exec wrappers. Upstream
  intentionally treats these as opaque command heads.
- **Compound separators:** `&&`, `||`, `;`, `|`, `|&`, `&`, newline.
  Each subcommand matched independently.
- **Recursive subcommand extraction:** `$(cmd)` and backtick `` `cmd` ``
  are recursively parsed; each subcommand independently checked against
  the glob. Process substitution `<(cmd)` / `>(cmd)` is NOT recursed
  (upstream doc-silent; treated as literal text, conservative
  match-as-shown).
- **`find -exec` is opaque:** `find -exec rm {} \;` matches as `find`,
  NOT as `rm`. Upstream: "A `Bash(find *)` rule does not cover these
  forms" — the `-exec` argument is not recursively parsed. Different
  from `$()`/backticks. Same for `find -delete`.
- **Trailing-space word-boundary:** `Bash(ls *)` requires a space after
  `ls` (excludes `lsof`); `Bash(ls*)` no space matches both.
- **`:*` colon-sugar:** `Bash(ls:*)` is normalized at parse time to
  `Bash(ls *)`. Mid-pattern `:` (e.g., `Bash(git:* push)`) is literal,
  NOT sugar — the colon is part of the command name in that position.
- **Fail-open on parse failure:** any unparseable shell input fires the
  hook regardless (REQ MATCH-03 §3 wording, verbatim).
- **Specificity-override rule:** patterns more specific than
  `<command> *` (e.g., `Bash(git push *)`) fire the hook whenever
  `$()`, backticks, or `$VAR` interpolation is present in the command
  (matches upstream's "patterns that specify more than the command name
  run the hook anyway on `$()`, backticks, or `$VAR`" — fail-open on
  uncertain context).

Rationale: upstream-verbatim is the only way the architecture test can
pin the truth-table rows from `hooks-guide` § "Filter by tool name and
arguments with the `if` field" without behavioral asymmetry. Plugins
written for upstream Claude Code work identically in Pi-Claude; plugins
written for Pi-Claude work identically in upstream.

### Claude's Discretion

- **File split inside `bridges/hooks/if-field/`.** REQ wording suggests
  5 modules (`parser.ts` / `bash.ts` / `glob.ts` / `extract.ts` /
  `match.ts`). Planner picks the actual file count based on cohesion
  vs. line budget. A single `if-field.ts` (~300 LoC total) is also
  acceptable; the 5-file split is a guidance, not a lock.
- **Per-tool target-extraction table file placement.** Either
  `domain/components/hook-if-targets.ts` (sibling to `hook-tool-names.ts`)
  or co-located in `hook-tool-names.ts` (single file, both maps). Planner
  picks based on file size at write time.
- **Compiled `IfPredicate` discriminated-union shape.** Likely:
  ```ts
  type IfPredicate =
    | { kind: "match-all"; reason?: string }   // fall-open sentinel; reason captured for hookDebugLog
    | { kind: "bash"; bashGlob: CompiledBashGlob }
    | { kind: "path-tool"; piEvents: ReadonlySet<PiToolName>; pathGlob: CompiledPathGlob }
    | { kind: "mcp-literal"; toolName: string }
    | { kind: "mcp-server-prefix"; serverPrefix: string };  // `mcp__server` / `mcp__server__*` both compile here
  ```
  Planner picks the exact shape; `assertNever` exhaustiveness per
  NFR-7 mandatory.
- **`RoutingEntry` field name + optionality.** Add
  `ifPredicate: IfPredicate` (always present after compile; fall-open
  sentinel for absent / malformed `if` field) vs.
  `ifPredicate?: IfPredicate` (undefined when `if` field is absent in
  the source). Planner picks based on which is cleaner at the dispatch
  callsite — undefined-as-match-all and always-present-with-sentinel
  are equivalent semantics; the choice is ergonomic.
- **Architecture-test fixture layout.** Inline JSON pairs in
  `tests/architecture/hooks-if-field.test.ts` (Phase 57/58/59/60
  pattern) vs. per-truth-table-row fixture files under
  `tests/architecture/fixtures/if-field/`. Planner picks. Either way
  the fixture set is keyed on the upstream truth-table rows.
- **Truth-table snapshot strategy.** Planner fetches the latest version
  of `code.claude.com/docs/en/hooks-guide` § "Filter by tool name and
  arguments with the `if` field" + `code.claude.com/docs/en/permissions`
  § "Bash" / § "Read and Edit" / § "MCP" at research time and snapshots
  the truth-table rows verbatim into the test file. No commitment to
  refetching on every upstream patch release; minor-version-bump
  re-audit is the planner's recommendation.
- **`MATCH_ALL_IF` debug-log message format.** Planner picks the exact
  wording; minimum information: which `if` field string failed to
  parse, and at which compile step (syntax / unknown prefix / glob).
  Per IL-2, all `hookDebugLog` output stays in debug-log only — no
  `ctx.ui.notify` warning at install or runtime.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — MATCH-03 (Phase 61 closure list);
  MATCH-01 / MATCH-02 / TOOL-01 / TOOL-02 (carry-forward dependencies
  from Phase 58). **REQ AMENDMENT REQUESTED via D-61-03 — drop
  `Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit` from MATCH-03's
  prefix list, replace with the upstream cross-tool mapping table,
  add the 2 extra MCP forms, add the missing-target → substitute-cwd
  rule.**
- `.planning/ROADMAP.md` § "Phase 61" — goal + 5 success criteria;
  dependency on Phase 60 (the `if` filter sits between dispatch and
  exec; tool-name translation must already work).
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook
  Bridge" — locked scope (bucket-A only); strict-supportability stance
  on matchers (which does NOT extend to `if`-layer failures per
  D-61-02).

### Prior phase decisions (Phases 57-60 — foundations)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  — D-57-02 (lenient top-level `Type.Record(...)`), D-57-03
  (`generatedName`-based persistence), D-57-04 (parse-failure
  discriminated result). Phase 61 extends `HOOK_HANDLER_SCHEMA` with
  `if: Type.Optional(Type.String())` and reuses the discriminated
  parse result.
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md`
  — D-58-04 (`hook-tool-names.ts` location), D-58-05 (`find ↔ Glob`
  mapping with LOW-confidence flag — relevant because Phase 61's
  cross-tool mapping treats Pi `find` as a Read-rule reader per
  upstream's "Read covers Glob" semantic), the user's locked stance
  "for hooks that have inputs (e.g. Bash(...) or find), at registration
  time translate the claude form to a pi form or handler code" (Phase
  58 § "Specific Ideas") — load-bearing for D-61-02's parse-time-
  compile approach.
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-CONTEXT.md`
  — D-59-01 (7 Pi listeners, 8 Claude routes, `tool_result` isError
  split), D-59-02 (bridge-owned parsed-config cache), D-59-04
  (dispatch-loop shape with `entryFires` + `activeExecutor` —
  Phase 61's insertion seam), D-59-05 (`shared/debug-log.ts`) — Phase
  61 uses the same seam for `hookDebugLog` fall-open warnings.
- `.planning/phases/60-hook-execution-payload-translators-env-vars/60-CONTEXT.md`
  — D-60-02 (first-block-wins / mutate-compose / stop reducer
  semantics) — `if`-no-match returns `continue` (skip entry), it does
  NOT return `block`; the reducer is unchanged.

### Authority sources (cross-reference at planning time — FETCH FRESH)

- **`code.claude.com/docs/en/hooks-guide`** § "Filter by tool name and
  arguments with the `if` field" — driver for the architecture test
  truth-table. Quotes: *"The filter also fails open, running your hook
  regardless of pattern, when the Bash command cannot be parsed. Because
  the filter is best-effort, use the [permission system] rather than a
  hook to enforce a hard allow or deny."* and *"`if` only works on tool
  events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `PermissionRequest`, and `PermissionDenied`. Adding it to any other
  event prevents the hook from running."* and *"The `if` field requires
  Claude Code v2.1.85 or later. Earlier versions ignore it and run the
  hook on every matched call."* Planner fetches the latest version at
  research time and snapshots every truth-table row.
- **`code.claude.com/docs/en/permissions`** § "Bash" / § "Process
  wrappers" / § "Compound commands" / § "Read and Edit" / § "MCP" — the
  authoritative permission-rule grammar. Drivers for D-61-03 (rule
  prefix → Pi event set + target field mapping) and D-61-04 (Bash
  parser scope). Planner fetches latest at research time.
- `docs/research/claude-hook-config-syntax.md` § 7 — the in-repo
  snapshot of the `if` field semantics (fetched 2026-06-13). Note that
  § 7's verdict was originally ESCALATE; the v1.13 promotion to
  IMPLEMENT is reflected in REQUIREMENTS.md but § 7's rationale
  paragraphs remain useful context for the parser design.
- `docs/research/claude-hook-config-syntax.md` § "Matcher target field
  per event type" — reads in tandem with the upstream permissions doc
  for the per-event `if`-applicability rules (REQ MATCH-03 wording:
  bridge ignores `if` on non-tool events).

### Peer-dep tool-input shapes (verified 2026-06-15)

- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/bash.d.ts`
  — `BashToolInput = { command: string; timeout?: number }`. Always
  has `command`; D-61-04 target.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/read.d.ts`
  — `ReadToolInput = { path: string; offset?; limit? }`. Required
  `path`.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/edit.d.ts`
  — `EditToolInput = { path: string; edits[] }`. Required `path`.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/write.d.ts`
  — `WriteToolInput = { path: string; content: string }`. Required
  `path`.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/grep.d.ts`
  — `GrepToolInput = { pattern: string; path?; glob?; ignoreCase?;
  literal?; context?; limit? }`. **Optional `path`** — missing-target
  substitute-cwd rule from D-61-03 applies.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/find.d.ts`
  — `FindToolInput = { pattern: string; path?; limit? }`. **Optional
  `path`** — substitute-cwd rule applies.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/ls.d.ts`
  — `LsToolInput = { path?; limit? }`. **Optional `path`** —
  substitute-cwd rule applies.

### Codebase landing sites (Phase 61 extends)

- `extensions/pi-claude-marketplace/domain/components/hooks.ts` — Phase
  57/58 baseline (`HOOK_HANDLER_SCHEMA` + `HOOKS_VALIDATOR` +
  `parseHooksConfig` + `checkMatcherSupportability`). Phase 61 adds
  `if: Type.Optional(Type.String())` to `HOOK_HANDLER_SCHEMA` and
  compiles each `if` string to `IfPredicate` at parse time, attaching
  the predicate to the per-handler entry (which Phase 59 stores on
  `RoutingEntry`).
- `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts`
  (NEW, Claude's Discretion file split) — rule prefix → Pi event set
  + target field mapping table (D-61-03). May co-locate in
  `hook-tool-names.ts` if file size is small.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/` (NEW
  directory) — `glob.ts` (D-61-01), `bash.ts` (D-61-04), and any
  parser / extract / match siblings the planner introduces.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` —
  `RoutingEntry` interface gains the compiled `IfPredicate` field
  (planner picks always-present-with-sentinel vs. optional).
  `populateBuckets` (the parsed-config → routing-table fold) reads the
  predicate from the per-handler entry.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` —
  `reduceBucket` inner loop gains a second predicate call between
  `matcherFires(entry)` (currently `bridges/hooks/dispatch.ts:171`)
  and `await activeExecutor(entry, event, ctx)` (currently
  `bridges/hooks/dispatch.ts:175`). `if`-no-match → `continue`.
- `extensions/pi-claude-marketplace/shared/debug-log.ts` (Phase 59
  D-59-05) — Phase 61 emits `hookDebugLog` warnings for every `if`
  fall-open (malformed syntax / unknown prefix / unparseable Bash).
  No new sink, no new severity. Per IL-2 no `ctx.ui.notify` emissions.

### Architecture tests (Phase 61 adds)

- `tests/architecture/hooks-if-field.test.ts` (NEW, file name Claude's
  Discretion) — exercises every truth-table row from the upstream
  `hooks-guide` § "Filter by tool name and arguments with the `if`
  field" + the Bash compound / wrapper / sugar cases from
  `code.claude.com/docs/en/permissions`. Pattern follows Phase
  57/58/59/60 architecture-test files (closed-set introspection +
  inline fixture pairs).
- `tests/architecture/hooks-foundation.test.ts` (Phase 57 baseline) /
  `hooks-dispatch.test.ts` (Phase 59) — Phase 61 does NOT modify these;
  the `if`-field invariants are siloed in the new file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`parseHooksConfig` discriminated result pattern**
  (`domain/components/hooks.ts`) — Phase 57's `{ ok: true, value } |
  { ok: false, reason }` shape. Phase 61 does NOT extend the
  discriminator: `if`-field compile failure is fail-open (does NOT
  flip plugin unavailable), so the parser sets `entry.ifPredicate =
  { kind: "match-all", reason: "..." }` and emits a `hookDebugLog`
  warning, then returns `{ ok: true, value }` unchanged.
- **`HOOK_HANDLER_SCHEMA`** (`domain/components/hooks.ts:75`) — Phase
  61 adds `if: Type.Optional(Type.String())` here. The Type.Unsafe
  JSON-Schema conditional currently at lines 82-91 (`if`/`then` JSON
  Schema constructs that require `command` when `type === "command"`)
  is unrelated to the user-facing `if` field; the names happen to
  collide. Phase 61 adds the user-facing field as a separate property.
- **`RoutingEntry`** (`bridges/hooks/event-router.ts:76-90`) — Phase
  61 adds the compiled `IfPredicate` field.
- **`reduceBucket`** (`bridges/hooks/dispatch.ts:163`) — Phase 61's
  insertion point. Single-line addition: a second predicate call
  before the `activeExecutor(...)` invocation.
- **TOOL-01 table** (`domain/components/hook-tool-names.ts`) — Phase
  61's rule-prefix mapping table (D-61-03) is a sibling to TOOL-01,
  NOT a replacement. TOOL-01 maps `Pi toolName ↔ Claude tool name` for
  matcher comparison + payload translation; Phase 61's table maps
  `Claude rule-prefix → set<PiToolName> + target field name`. The
  cross-tool semantic (Read covers Pi readers; Edit covers Pi editors)
  is unique to the `if`-field layer.
- **`hookDebugLog`** (`shared/debug-log.ts`, Phase 59 D-59-05) — Phase
  61's sole runtime output channel for fall-open warnings. ESLint
  override already in place; no new per-file overrides needed.

### Established Patterns

- **Discriminated `installable: true | false` with `assertNever`
  exhaustiveness** (NFR-7) — Phase 61 preserves: no new `installable:
  false` triggers (fail-open everywhere per D-61-02). Existing
  `assertNever` calls in the dispatch / reducer / adapter switches
  are unchanged.
- **Registration-time translation, no runtime translation** (Phase 58
  stance, locked by the user) — Phase 61's `IfPredicate` is compiled
  ONCE at parse time and rides on `RoutingEntry`. Dispatch consults
  the compiled predicate via a flat switch; zero string-parsing on
  the hot path.
- **Single notify emission per orchestrator invocation** (RECON-04 /
  IL-2) — Phase 61 emits ZERO new `ctx.ui.notify` calls (install-time
  OR runtime). All `if`-field warnings go to `hookDebugLog` only.
- **NFR-2 `/reload` always suffices** — Phase 61's fail-open behavior
  means a fixed `if` field becomes effective after the next reload via
  the existing factory-rehydrate cycle; no special invalidation path.
- **NFR-3 idempotent / fail-clean** — `IfPredicate` is fully derivable
  from `hooks.json` source string; a crash mid-compile leaves no
  inconsistent state.
- **Closed-set TypeBox tuple as PUBLIC source-of-truth** — Phase 61's
  rule-prefix closed set (`Bash` / `Read` / `Edit` / `Write` plus the
  MCP grammar) follows the same pattern: `as const` tuple with
  `Type.Static<...>` introspection for the architecture test.
- **Architecture-test source-of-truth pattern** (Phase 57 P04 / Phase
  58 P04 / Phase 59 / Phase 60 baseline) — fixture-based truth-table
  pinning is the established pattern. Phase 61 follows.

### Integration Points

- `domain/components/hooks.ts` — `HOOK_HANDLER_SCHEMA` extension +
  `parseHooksConfig` compile-and-attach step + new helper
  `compileIfPredicate(rawIf: string): IfPredicate`.
- `domain/components/hook-if-targets.ts` (NEW, Claude's Discretion) —
  rule-prefix → Pi event set + target field mapping table.
- `bridges/hooks/if-field/` (NEW directory) — glob engine, Bash parser,
  per-tool extractor, top-level match entry point. File split is
  Claude's Discretion (REQ wording suggests 5 files; planner may
  collapse to 1-3 if cohesion is stronger).
- `bridges/hooks/event-router.ts` — `RoutingEntry` gains the compiled
  `IfPredicate`.
- `bridges/hooks/dispatch.ts` — single line addition inside
  `reduceBucket` between `matcherFires` and `activeExecutor`.
- `shared/debug-log.ts` — Phase 61 callers only; no API surface
  change.
- Phase 61 does NOT touch: any `orchestrators/` site (install /
  uninstall / reinstall / update / reconcile / import / marketplace
  / edge-deps); `shared/notify.ts` (no new REASONS members; no new
  notify emissions); the catalog (`docs/output-catalog.md`) or
  catalog-uat tests; the persistence layer; the resolver; the
  `bridges/{agents,commands,mcp,skills}/` siblings; `index.ts`.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly chose upstream-faithful syntax — "we want to be
  upstream-faithful in the hook syntax in claude code plugins, because we
  aim to be compatible with claude code, not extend it." This is the
  load-bearing constraint for D-61-03: bridge accepts ONLY the upstream-
  documented prefix set (`Bash` / `Read` / `Edit` / `Write` plus MCP
  literals). `Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit` are
  NOT accepted as standalone prefixes; they're covered by `Read` /
  `Edit` via the cross-tool semantic.
- The user explicitly chose the Pi-semantic event mapping: "pi tools and
  events are different, so we need to match the tools and events that pi
  generates semantically to the claude code tools and events that would
  trigger the plugin hooks; that way the behavior is compatible." This
  is the load-bearing rationale for the cross-tool mapping table (Read
  covers Pi `{read, grep, find, ls}`; Edit covers `{edit, write}`). The
  example the user gave verbatim: "if claude code has a 'multiedit' tool,
  and it triggers Edit(), and pi doesn't, but has 'edit', then we are
  good. likewise if claude code triggers Read() for reads that have the
  grep command, and pi has a 'grep' command, then we want that
  matcher/if to be registered for grep too."
- The user explicitly locked fail-open across ALL `if`-layer failure
  modes (D-61-02) after reviewing the upstream docs together. The key
  evidence: upstream documents the `if` field as uniformly best-effort,
  with pre-v2.1.85 "ignore it and run the hook on every matched call"
  setting precedent for silent match-all fallback. The user accepted
  the portability-regression argument (fail-loud here would reject
  plugins that work fine in upstream).
- The user explicitly locked the hand-author glob engine (D-61-01) —
  the project's no-glob-libs stance + the small surface (3
  metacharacters + 4 anchors + Bash word-boundary) made the trade-off
  clear. Architecture-test fixtures pin every truth-table row directly
  against our implementation.
- The user explicitly locked upstream-verbatim Bash parser scope
  (D-61-04) after seeing that the upstream permissions doc specifies
  the strip list verbatim AND explicitly lists non-strippers (`env`,
  `sudo`, `watch`, `setsid`, `devbox run`, etc.). Plugins fully
  portable.

</specifics>

<deferred>
## Deferred Ideas

- **`PowerShell(...)` rule prefix support** — upstream documents it as
  a valid permission-rule prefix using the same shape as Bash, but Pi
  has no PowerShell tool. v1.13 fails-open silently on
  `if: "PowerShell(...)"`. v1.14+ may add a Pi PowerShell tool +
  corresponding bridge support.
- **`WebFetch(...)` / `Agent(...)` / `Cd(...)` rule prefix support** —
  upstream prefixes but bucket-E (`WebFetch`) / Pi-incompatible (`Cd`
  is a Claude `/cd` command primitive Pi doesn't have) / Pi-agent-team
  deferred (`Agent` per Phase 58's FPROM-01 stance). v1.13 fails-open
  silently. v1.14+ promotion gated by upstream bucket-E PRs +
  Pi-agent-team primitive.
- **Pi-specific rule prefixes for narrower filtering** — `Grep(*.ts)`
  to fire only on `grep` events (not also `read`/`find`/`ls`), or
  `Find(<pattern>)` to match against `find.input.pattern` (the Pi-
  specific file-name glob). The user explicitly rejected Pi extensions
  ("we aim to be compatible with claude code, not extend it"). A
  v2.x.x extension could reintroduce these as additive sugar IF
  first-party plugin demand surfaces — but the user's stance is firmly
  against this.
- **Pi-grep `glob` and Pi-find `pattern` as additional `if` targets** —
  same rationale as above; Pi extension, not upstream behavior.
  Deferred indefinitely unless first-party plugin authors complain.
- **First-class `if` field validation at install time** (fail-loud
  optional mode) — explicitly rejected per D-61-02; would create a
  portability regression. A future v1.14+ could add an opt-in strict
  mode for plugin authors who want install-time visibility into `if`
  syntax errors (e.g., a `strictIfFieldValidation: true` plugin
  manifest flag) — but this would deviate from upstream and adds
  surface. Not on the v1.13 plate.
- **`ctx.ui.notify` install-time warning for fall-open `if` patterns** —
  the third option presented in Area B (hybrid fail-open-with-notify-
  warning) — explicitly rejected. IL-2's single-notify-per-install
  cascade discipline + warning fatigue concern + no documented upstream
  warning behavior all argue against. Deferred indefinitely.
- **`maxBuffer` / payload truncation interaction with `if` matching** —
  Phase 60 caps stdin payload at 256KB with `_truncated: true` marker.
  The `if` filter operates on `event.input.command` / `event.input.path`
  BEFORE truncation (the matcher runs on the source Pi event, not the
  translated Claude stdin). No interaction; flagged for awareness.
- **Process-substitution `<(cmd)` / `>(cmd)` recursion** — upstream
  doc-silent. Phase 61 treats them as literal (no subcommand
  extraction); v1.14+ may add recursion if a security-review plugin
  surfaces a real-world need. Deferred.
- **`xargs -n1 grep` and similar flag-having forms** — upstream
  matches these as `xargs` (NOT `grep`), and the bridge follows
  verbatim. Plugin authors who want `Bash(grep *)` to fire on
  `xargs -n1 grep pattern` must add an explicit `Bash(xargs *)` rule;
  this is upstream behavior, not a Pi limitation.
- **`find -exec` / `find -delete` deep parsing** — upstream treats the
  `-exec` argument as opaque (NOT recursively parsed). Phase 61
  follows. v1.14+ could add `-exec` recursion if first-party plugin
  demand surfaces; today no plugin uses this pattern.
- **REQUIREMENTS.md MATCH-03 amendment** — captured as a planner
  action item per D-61-03. The amendment lands atomically with Phase
  61's commit (atomic-supersession lesson; matches Phase 58 D-58-01 /
  D-58-04 / D-58-06 lockstep pattern). Planner may also need to
  re-verify the `Bash` glob edge-case wording in MATCH-03 §2 against
  the latest upstream permissions doc — wording was based on a
  2026-06-13 fetch; planner re-fetches at research time.

### Reviewed Todos (not folded)

- None — the `cross_reference_todos` step found no pending todos
  matching Phase 61's scope. (The standing
  `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  backlog item carried forward from Phases 57-60 remains unrelated to
  Phase 61.)

</deferred>

---

*Phase: 61-`if` Field Permission-Rule Matcher*
*Context gathered: 2026-06-15*
