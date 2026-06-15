# Phase 61: `if` Field Permission-Rule Matcher - Research

**Researched:** 2026-06-15
**Domain:** Claude Code permission-rule glob matching, hand-authored Bash subcommand
parser, per-tool target extraction, dispatch-loop integration
**Confidence:** HIGH (D-61-01..04 lock the load-bearing decisions; upstream truth
table fetched verbatim 2026-06-15; peer-dep tool-input shapes re-verified)

## Summary

Phase 61 implements MATCH-03: an optional `if` field on each hook-handler
entry that narrows tool-event dispatch using Claude Code's
permission-rule syntax (`Bash(git push *)` / `Edit(*.ts)` /
`Read(src/**)` / `mcp__server__tool` / `mcp__server` / `mcp__server__*`).
The filter sits between Phase 59's group-level matcher and Phase 60's
executor inside `reduceBucket` and composes with `matcher` under AND
semantics. Every failure mode (malformed syntax, unknown prefix, broken
glob, unparseable Bash) falls open to a `MATCH_ALL_IF` sentinel and emits
a `hookDebugLog` warning — the plugin always installs cleanly per
D-61-02 (upstream's "best-effort, not a security boundary" contract,
documented at `code.claude.com/docs/en/hooks-guide`).

The phase ships six things in lockstep: (1) a `if: Type.Optional(Type.String())`
addition to `HOOK_HANDLER_SCHEMA` in `domain/components/hooks.ts`; (2) a
parse-time `compileIfPredicate(rawIf): IfPredicate` helper that flips
unparseable inputs to the fall-open sentinel; (3) a static rule-prefix →
Pi event set + target field table at `domain/components/hook-if-targets.ts`
encoding the upstream-faithful Read-covers-Pi-{read,grep,find,ls} /
Edit-covers-Pi-{edit,write} / Write-covers-Pi-{write} cross-tool semantic
(D-61-03); (4) a hand-authored ~80-120 LoC Bash parser at
`bridges/hooks/if-field/bash.ts` (D-61-04 strip list verbatim, compound
separators, `$()`/backtick recursion, `find -exec` opaque, process
substitution literal); (5) a hand-authored ~120-180 LoC glob engine at
`bridges/hooks/if-field/glob.ts` with three metacharacters (`*` / `**` /
literal), four anchor prefixes (`//abs`, `~/home`, `/project-root`,
`./cwd`), trailing-space word boundary, and `:*` colon-sugar normalization
(D-61-01); (6) a single-line insertion in `reduceBucket`
(`bridges/hooks/dispatch.ts:163-204`) that consults the compiled
`IfPredicate` after `matcherFires` and before `activeExecutor`,
`continue`-skipping the entry on no-match.

The architecture test at `tests/architecture/hooks-if-field.test.ts`
reproduces every upstream truth-table row from `hooks-guide` § "Filter by
tool name and arguments with the `if` field" and the Bash compound /
wrapper / sugar cases from `permissions` § "Bash". A REQUIREMENTS.md
MATCH-03 amendment drops `Grep/Glob/LS/MultiEdit/NotebookEdit` from the
prefix list (they're covered by `Read`/`Edit` via upstream cross-tool
semantic), adds the two extra MCP forms, and adds the missing-target →
substitute-cwd rule for path-tools with optional `input.path` (Pi `grep`
/ `find` / `ls`).

**Primary recommendation:** Three-plan layout that mirrors Phase 60's
foundation → fill → wire ordering. Plan 1 (foundation): hand-author the
glob engine + Bash parser + per-tool target-extractor table + the
`IfPredicate` discriminated union — pure data, no I/O, exhaustively
unit-tested against the upstream truth table. Plan 2 (parse-time
attach): extend `HOOK_HANDLER_SCHEMA` with `if`, add
`compileIfPredicate` to `domain/components/hooks.ts`, extend
`RoutingEntry` with `ifPredicate: IfPredicate`, and populate the field
in `flattenPluginIntoBuckets` (`bridges/hooks/event-router.ts:260-294`).
Plan 3 (dispatch wire + lockstep amendment): add the `ifFires` call to
`reduceBucket` in `bridges/hooks/dispatch.ts:170-176` and land the
REQUIREMENTS.md MATCH-03 amendment in the same commit (atomic-
supersession lesson, matches Phase 58 D-58-01 lockstep pattern). The
architecture test rides on Plan 1 or Plan 3 — planner's discretion. The
parse-time-compile design (D-61-02 + Phase 58 stance) means zero string
parsing on the dispatch hot path: every `IfPredicate` is a flat switch.

## Project Constraints (from CLAUDE.md and .planning/STATE.md)

- **NEVER commit to main.** Worktrees preferred under `.worktrees/`. Pre-commit
  hooks run via `pre-commit run --files <changed>` before `git commit`; no
  `--no-verify`. Worktree commits use `SKIP=trufflehog`. PR merges use
  `gh pr merge --squash`.
- **Conventional Commits.** Title ≥5 ≤72 chars; body lines ≤80 chars.
- **TypeScript strict (NFR-7).** Discriminated `installable: true | false`
  preserved. New `IfPredicate` union must terminate with `assertNever` per the
  Phase 57 / 58 / 59 / 60 precedent.
- **Node ≥20.19.0 (NFR-4); pi-coding-agent peer dep ^0.73.x;** ESM-only.
- **Containment (NFR-10).** Any path coming from `if` patterns is plain text
  (not a write target), so NFR-10 has no direct trip surface in Phase 61.
  The four anchors resolve at parse time to normalized absolute paths used
  only for `glob.test(absPath)` comparisons.
- **`npm run check` GREEN (NFR-6).** Typecheck + ESLint + Prettier + tests.
- **IL-2: no `ctx.ui.notify` at runtime.** All `if`-layer fall-open warnings
  go through `hookDebugLog` only (the OBS-01 / D-59-05 seam at
  `shared/debug-log.ts`).
- **IL-1: English only.** No locale negotiation.
- **IL-4: no telemetry.** No metrics/events/analytics.
- **Comment policy (.claude/rules/typescript-comments.md).** Strip Phase /
  Plan / Wave / bare Pitfall N references; keep D-NN-NN / REQ-IDs / NFR-N /
  WR-NN. Decision IDs ARE the anchors.
- **No `console.error` / `process.stderr.write` / direct stdout** in command
  or bridge code. `hookDebugLog` is the sole sanctioned escape (per-file
  ESLint override in `eslint.config.js`).

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### D-61-01 (glob engine: hand-author, zero new runtime deps)

Bridge implements the glob engine as ~120-180 LoC at
`bridges/hooks/if-field/glob.ts`. Surface is exactly what Claude's
permission-rule grammar requires: three metacharacters (`*`/`**`/literal),
four anchor prefixes (`//abs`, `~/home`, `/project-root`, `./cwd`), and
one Bash-specific trailing-space word-boundary rule. No new runtime
dependency. No `picomatch` / `minimatch`.

#### D-61-02 (fail-open across all `if`-layer failure modes)

Every `if`-layer failure mode falls open to `MATCH_ALL_IF` (match-all
sentinel + `hookDebugLog` warning). Plugin installs successfully; the
hook fires whenever the group matcher fires. Specifically:

- Malformed Claude permission-rule syntax → compile-time fall-open.
- Unknown tool prefix (`Grep` / `PowerShell` / `WebFetch` / `Agent` / `Cd`
  / typos like `Bahsh`) → compile-time fall-open.
- Runtime Bash command parse failure → dispatch-time fall-open.
- Missing path target at dispatch (Pi `grep`/`find`/`ls` with no
  `input.path`) → substitute `ctx.cwd` then match. NOT fall-open — upstream
  Grep / LS default to cwd internally before the `if` filter runs, so
  `Read(src/**)` against a path-less `grep` checks cwd vs `src/**`.

#### D-61-03 (rule prefix → Pi event set + target field; upstream-faithful)

Bridge accepts ONLY upstream-documented prefixes:

| Upstream `if` prefix | Pi event(s) fired on | Target field |
|---|---|---|
| `Bash(<glob>)` | `bash` | `event.input.command` (subcommand parsing per D-61-04) |
| `Read(<glob>)` | `read`, `grep`, `find`, `ls` | `event.input.path` (cwd if absent) |
| `Edit(<glob>)` | `edit`, `write` | `event.input.path` |
| `Write(<glob>)` | `write` | `event.input.path` |
| `mcp__<server>` | server-prefix match against `event.toolName === "mcp__<server>__<anything>"` | `event.toolName` |
| `mcp__<server>__*` | server-prefix match (equivalent to bare `mcp__<server>`) | `event.toolName` |
| `mcp__<server>__<tool>` | literal `event.toolName === "mcp__<server>__<tool>"` | `event.toolName` |

`Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit` / `PowerShell` /
`WebFetch` / `Agent` / `Cd` are NOT accepted as standalone prefixes; they
fall under `Read` / `Edit` via upstream's cross-tool category mapping (or
are out-of-scope tools). REQUIREMENTS.md MATCH-03 amendment lands in
lockstep with the Phase 61 commit (atomic-supersession lesson).

#### D-61-04 (Bash command parser: upstream-verbatim)

Bash subcommand parser implements upstream's exact contract per
`code.claude.com/docs/en/permissions` § "Bash" / § "Process wrappers" /
§ "Compound commands":

- **Strip wrappers (closed set, no flags):** `timeout`, `time`, `nice`,
  `nohup`, `stdbuf`, bare `xargs`. `xargs -n1 grep pattern` matches as
  `xargs` (with-flags clause is load-bearing).
- **Do NOT strip:** `env`, `sudo`, `chronic`, `watch`, `setsid`, `ionice`,
  `flock`, `devbox run`, `mise exec`, `npx`, `docker exec`, etc.
  (intentionally opaque per upstream).
- **Compound separators:** `&&`, `||`, `;`, `|`, `|&`, `&`, newline.
- **Recursive subcommand extraction:** `$(cmd)` and `` `cmd` `` recursed;
  process substitution `<()` / `>()` NOT recursed (literal).
- **`find -exec` opaque:** `find -exec rm {} \;` matches as `find`, NOT
  `rm`. Same for `find -delete`.
- **Trailing-space word-boundary:** `Bash(ls *)` excludes `lsof`;
  `Bash(ls*)` includes both.
- **`:*` colon-sugar:** `Bash(ls:*)` ≡ `Bash(ls *)` only when trailing;
  mid-pattern `:` is literal.
- **Fail-open on parse failure.**
- **Specificity-override rule:** patterns more specific than `<command> *`
  (e.g., `Bash(git push *)`) fire on `$()`, backticks, or `$VAR`
  interpolation in the command (upstream "fail-open on uncertain context").

### Claude's Discretion

- File split inside `bridges/hooks/if-field/` (REQ wording suggests 5
  modules: `parser.ts` / `bash.ts` / `glob.ts` / `extract.ts` /
  `match.ts`; planner picks 1-5 by cohesion vs line budget — a single
  ~300 LoC `if-field.ts` is acceptable).
- Per-tool target-extraction table file placement: either
  `domain/components/hook-if-targets.ts` (sibling to
  `hook-tool-names.ts`) or co-located in `hook-tool-names.ts`.
- Compiled `IfPredicate` discriminated-union shape (proposal in
  CONTEXT.md, planner picks exact shape).
- `RoutingEntry` field name + optionality (`ifPredicate: IfPredicate`
  always-present-with-sentinel vs. `ifPredicate?: IfPredicate` optional;
  semantics are equivalent, choice is ergonomic).
- Architecture-test fixture layout (inline pairs vs per-row fixture files).
- Truth-table snapshot strategy (one-time fetch at research time vs
  refetch on minor-version bumps).
- `MATCH_ALL_IF` debug-log message format (minimum information: which
  `if` string failed and at which compile step).

### Deferred Ideas (OUT OF SCOPE)

- `PowerShell(...)` rule prefix — Pi has no PowerShell tool; v1.13
  silently falls open.
- `WebFetch(...)` / `Agent(...)` / `Cd(...)` — bucket-E /
  Pi-agent-team-deferred / Pi-incompatible. Silent fall-open.
- Pi-specific rule prefixes (`Grep(*.ts)` to fire only on `grep`,
  `Find(<pattern>)` against Pi-find pattern) — upstream-faithful
  stance forbids Pi extensions.
- Pi-grep `glob` / Pi-find `pattern` as `if` targets — same rationale.
- Fail-loud strict mode for `if` validation — portability regression.
- `ctx.ui.notify` install-time warning for fall-open `if` — IL-2 budget
  + warning fatigue.
- `maxBuffer` / payload truncation interaction — `if` runs on the source
  Pi event (`event.input.command` / `event.input.path`), BEFORE Phase 60's
  256KB stdin truncation. No interaction.
- Process-substitution `<()` / `>()` recursion — upstream doc-silent;
  v1.13 treats as literal.
- `xargs` with-flags forms (`xargs -n1 grep`) recursion — match as
  `xargs` per upstream.
- `find -exec` / `find -delete` deep parsing — opaque per upstream.

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MATCH-03 | The bridge implements the `if` field on tool-event hook entries (PreToolUse / PostToolUse / PostToolUseFailure; ignored on non-tool events). Parses `<ToolName>(<pattern>)` permission-rule syntax. Bash → `event.input.command` with subcommand parsing (compound-separator split; recursive `$()`/backtick; process-wrapper strip). File-path tools (Read/Edit/Write per D-61-03 amendment) → `event.input.path` with gitignore-semantics glob and four anchors. MCP literals → `event.toolName` match. Bash word-boundary at trailing space. `:*` trailing-sugar equivalence. Specificity-override on `$()`/backticks/`$VAR`. Fail-open on Bash parse failure. AND composition with group `matcher`. Implementation at `bridges/hooks/if-field/{glob,bash,...}.ts`; architecture test exercises every upstream truth-table row verbatim. | Section "Standard Stack" (zero new deps); section "Architecture Patterns" (Pattern 1-3 cover the engine / parser / dispatch insertion); section "Code Examples" (verified upstream truth-table snapshots + Bash parser pseudocode); section "Common Pitfalls" (quoting, `$VAR` interpolation, `**` segmentation, symlinks). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Parse-time `IfPredicate` compilation | Domain (`domain/components/hooks.ts`) | — | `compileIfPredicate` is pure data → data; lives alongside `parseHooksConfig` / `parseMatcher` per the Phase 58 "domain owns parser" precedent. |
| Glob engine (`*` / `**` / 4 anchors) | Bridge (`bridges/hooks/if-field/glob.ts`) | — | Bridge owns implementation primitives that the domain `compileIfPredicate` calls; matches Phase 60's split of payload translators under `bridges/hooks/payloads/`. |
| Bash subcommand parser | Bridge (`bridges/hooks/if-field/bash.ts`) | — | Same reasoning. Pure shell-text manipulation; no I/O. |
| Per-tool target-extractor table | Domain (`domain/components/hook-if-targets.ts`) or co-located in `hook-tool-names.ts` | — | Static data table → domain tier per D-58-04 precedent for `hook-tool-names.ts`. |
| Compiled-predicate ride on `RoutingEntry` | Bridge (`bridges/hooks/event-router.ts`) | — | `RoutingEntry` is bridge-owned (Phase 59); `ifPredicate` rides alongside `matcher`. |
| Dispatch-time `ifFires(predicate, event, ctx)` call | Bridge (`bridges/hooks/dispatch.ts:163-204`) | — | Lives one line into `reduceBucket`'s inner loop, between `matcherFires(entry)` and `await activeExecutor(entry, event, ctx)`. |
| `hookDebugLog` fall-open warnings | Shared (`shared/debug-log.ts`) | — | OBS-01 / D-59-05 single-seam sole runtime debug output channel. |
| Architecture test pinning truth-table rows | Tests (`tests/architecture/hooks-if-field.test.ts`) | — | Follows Phase 57/58/59/60 pattern (closed-set introspection + inline truth-table fixtures). |
| REQUIREMENTS.md MATCH-03 amendment | Docs (`.planning/REQUIREMENTS.md`) | — | Lockstep with Phase 61's first commit per atomic-supersession lesson; D-61-03 explicit ask. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `typebox` | `^1.1.38` (already a runtime peer dep) | `Type.Optional(Type.String())` for the new `if` field on `HOOK_HANDLER_SCHEMA` | Existing schema engine in `domain/components/hooks.ts`. Zero new dep [VERIFIED: `package.json` peerDependencies + Phase 57/58 baseline]. |
| `node:fs/promises` / `node:os` / `node:path` (built-ins) | bundled with Node ≥20.19.0 | Anchor resolution at parse time (`os.homedir()` for `~/`, `path.resolve` for `//abs` / `/project-root` / `./cwd`) | Built-ins. The four anchors normalize to absolute paths at parse time so the dispatch-time `glob.test(absPath)` is a pure string operation. [CITED: D-61-01 spec]. |
| `@earendil-works/pi-coding-agent` (peer dep, `^0.73.x`) | `^0.73.x` | `BashToolInput.command`, `ReadToolInput.path`, `EditToolInput.path`, `WriteToolInput.path`, `GrepToolInput.path?`, `FindToolInput.path?`, `LsToolInput.path?` | Per-tool input shapes for the target-extractor table [VERIFIED: 2026-06-15 `node_modules/.../tools/{bash,read,edit,write,grep,find,ls}.d.ts` re-read; all `path` fields confirmed]. |

### Supporting

None. Glob engine and Bash parser are hand-authored per D-61-01 / D-61-04.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Hand-authored glob | `picomatch@^4.x` / `minimatch@^10.x` | Adds a runtime dep with a materially larger surface (character classes, brace expansion, negation, extglobs) than Claude's permission-rule grammar requires; both compile to `RegExp` internally — ironic given Phase 58 rejected regex matchers (MATCH-02) for parsing-surface simplicity. Architecture test cannot pin upstream truth-table rows byte-for-byte if the engine has implicit semantics from the library. |
| Hand-authored Bash parser | `shell-parse@^0.1.x` / `bash-parser@^0.5.x` | Both are larger than what we need (full Bash AST vs the upstream-documented strip/split/recurse subset); `bash-parser` carries a node-walk API and parses constructs we explicitly want opaque (`find -exec`, process substitution). Hand-author keeps the fail-open behavior surface predictable. |
| `Type.String()` for `if` | `Type.Union([Type.Literal("Bash(...)"), ...])` parametric type | Closed-set unions for a glob string require compile-time enumeration. The `if` field's grammar is open (any glob shape). Leave as string; compile at parse time. |

**Installation:** None. No new dependencies.

**Version verification:**

```bash
# All target deps are already declared and locked. Re-verify only:
node -e "console.log(require('./node_modules/typebox/package.json').version)"   # ^1.1.38 expected
node -e "console.log(require('./node_modules/@earendil-works/pi-coding-agent/package.json').version)"   # ^0.73.x expected
```

## Package Legitimacy Audit

Phase 61 installs no new packages. Re-using `typebox` and built-in modules
that have shipped in Phases 57-60. No audit row needed.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│ hooks.json (plugin-bundled)                                            │
│                                                                        │
│   { "PostToolUse": [{                                                  │
│       "matcher": "Bash",                                               │
│       "hooks": [{                                                      │
│         "type": "command",                                             │
│         "if": "Bash(git push *)",          <-- NEW in Phase 61          │
│         "command": "..."                                               │
│       }]                                                               │
│   }] }                                                                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ HOOKS_VALIDATOR.Check
                               │ (Phase 57 HOOKS_CONFIG_SCHEMA, extended
                               │  to admit `if: Type.Optional(Type.String())`)
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ domain/components/hooks.ts :: parseHooksConfig (Phase 57 D-57-04)      │
│                                                                        │
│   1. JSON.parse + HOOKS_VALIDATOR.Check  (existing)                    │
│   2. checkMatcherSupportability          (Phase 58)                    │
│   3. NEW: for each handler with `if`, call                             │
│      compileIfPredicate(rawIf)                                         │
│          ├─ ok    → store IfPredicate on the entry                     │
│          └─ fail  → store MATCH_ALL_IF + emit hookDebugLog warning      │
│                    (D-61-02 fail-open; plugin still installs)          │
│   4. return { ok: true, value: configWithCompiledPredicates }          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ bridges/hooks/event-router.ts :: flattenPluginIntoBuckets (Phase 59)  │
│   Copies entry.ifPredicate into the new RoutingEntry.ifPredicate field │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Runtime: Pi fires pi.on("tool_call", composite) on a Bash tool_call    │
│                                                                        │
│   bridges/hooks/dispatch.ts :: reduceBucket inner loop (163-204):     │
│                                                                        │
│   for (const entry of bucket) {                                       │
│     if (!matcherFires(entry)) continue;        // Phase 59 (matcher)  │
│     if (!ifFires(entry.ifPredicate, event,                            │
│                  ctx, claudeEvent)) continue;  // NEW (Phase 61)      │
│     const r = await activeExecutor(entry,                             │
│                                    event, ctx);  // Phase 60 exec     │
│     // ... reducer arms unchanged                                     │
│   }                                                                    │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                  ifFires switch (D-61-02 / D-61-03):
                  ┌──────────────────┐
                  │ match-all  → true (sentinel; includes the fall-open │
                  │              path that didn't compile)              │
                  │ bash       → bash.ts: extract event.input.command   │
                  │              → split on compound separators         │
                  │              → recurse $() / backticks              │
                  │              → strip process wrappers               │
                  │              → for each subcommand:                 │
                  │                  glob.test(subcmd) → fire?          │
                  │              → catch unparseable → true (fail-open) │
                  │ path-tool  → if claudeEvent.toolName ∈ piEvents,    │
                  │              extract event.input.path ?? ctx.cwd    │
                  │              → glob.testAbsolute(absPath)           │
                  │ mcp-literal → event.toolName === predicate.toolName │
                  │ mcp-prefix  → event.toolName starts with            │
                  │               "mcp__<server>__"                      │
                  │ default    → assertNever (NFR-7)                    │
                  └──────────────────┘
```

A reader tracing a `PostToolUse` hook with `if: Bash(git push *)` and
`matcher: Bash` against a `git push origin main` tool_call: Pi fires
`tool_result` → `toolResultCompositeHandler` reads `event.isError` (false
→ PostToolUse bucket) → `reduceBucket` walks bucket → `matcherFires`
(entry.matcher.piTools includes `bash`, event.toolName === `bash`) → true
→ `ifFires` (entry.ifPredicate.kind === `bash`) → bash.ts parses
`git push origin main` → strips no wrapper → no compound separators →
single subcommand `git push origin main` → glob (`git push *`) matches →
true → `activeExecutor(entry, event, ctx)` fires the hook.

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── domain/components/
│   ├── hooks.ts                       # ADD `if` to HOOK_HANDLER_SCHEMA;
│   │                                  # ADD compileIfPredicate; ATTACH
│   │                                  # IfPredicate to parsed entries.
│   ├── hook-tool-names.ts             # UNCHANGED
│   ├── hook-events.ts                 # UNCHANGED
│   └── hook-if-targets.ts             # NEW (or co-located in
│                                      # hook-tool-names.ts at planner's
│                                      # discretion):
│                                      # IF_PREFIX_TARGETS table.
│
├── bridges/hooks/
│   ├── event-router.ts                # ADD `ifPredicate` field on
│   │                                  # RoutingEntry; populate it in
│   │                                  # flattenPluginIntoBuckets.
│   ├── dispatch.ts                    # ADD `ifFires(...)` call inside
│   │                                  # reduceBucket (1 line) between
│   │                                  # matcherFires and activeExecutor.
│   └── if-field/                      # NEW directory:
│       ├── glob.ts                    # ~120-180 LoC: CompiledGlob,
│       │                              # compileBashGlob,
│       │                              # compilePathGlob, .test() helpers.
│       ├── bash.ts                    # ~80-120 LoC: parseBashSubcommands,
│       │                              # process-wrapper strip,
│       │                              # compound-separator split,
│       │                              # $()/backtick recursion,
│       │                              # interpolation-presence detection.
│       └── index.ts                   # Optional barrel:
│                                      # compileIfPredicate(rawIf) +
│                                      # ifFires(predicate, event, ctx,
│                                      # claudeEvent).
│
├── shared/
│   └── debug-log.ts                   # UNCHANGED (sole runtime fall-open
│                                      # debug seam).
│
└── tests/architecture/
    └── hooks-if-field.test.ts         # NEW: upstream truth-table pinning.
```

### Pattern 1: Compiled `IfPredicate` discriminated union (NFR-7 / D-61-02)

Per CONTEXT.md "Claude's Discretion", planner picks the exact shape. The
following is a recommended skeleton; treat the `kind` literals as the
load-bearing surface and adjust field names if cleaner.

**What:** Five-arm discriminated union (six counting `match-all` as a
fall-open sentinel and a normal match-all parsed `if: "*"`). Stored on
`RoutingEntry` as `ifPredicate: IfPredicate`. `assertNever` on the
default switch arm.

**When to use:** Every `RoutingEntry` instantiation (parse time). At
dispatch time the `ifFires` helper switches on `predicate.kind`.

**Example (recommended skeleton):**

```ts
// Source: D-61-02 (sentinel), D-61-03 (per-tool targets),
//         Phase 58 ParsedMatcher precedent (`domain/components/hooks.ts:277-282`)

import type { CompiledBashGlob, CompiledPathGlob } from "./glob.ts";
import type { PiToolName } from "../../domain/components/hook-tool-names.ts";

export type IfPredicate =
  | { kind: "match-all"; reason?: string }
  | { kind: "bash"; bashGlob: CompiledBashGlob }
  | {
      kind: "path-tool";
      piEvents: ReadonlySet<PiToolName>;
      pathGlob: CompiledPathGlob;
    }
  | { kind: "mcp-literal"; toolName: string }
  | { kind: "mcp-server-prefix"; serverPrefix: string };
//                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                       Captures both `mcp__server` and `mcp__server__*`.
//                       Stored as `"mcp__<server>__"` so the runtime
//                       check is `event.toolName.startsWith(serverPrefix)`.

export const MATCH_ALL_IF: IfPredicate = { kind: "match-all" };
```

### Pattern 2: Hand-authored glob engine (~120-180 LoC, D-61-01)

**What:** Pure-text glob engine supporting exactly three metacharacters
(`*` segment-local, `**` cross-segment, literal everything else) and four
anchor prefixes resolved once at parse time. Trailing-space word boundary
for Bash. No regex compilation, no backtracking.

**When to use:** Internal to the if-field bridge. Two compile entry points:
`compileBashGlob(pattern)` (handles `:*` colon-sugar + trailing-space
word boundary) and `compilePathGlob(pattern, ctx)` (handles the four
anchors, resolves to normalized absolute prefix + token list).

**Recommended internal data shape:**

```ts
// Bash glob: linear token list, no anchor resolution needed.
export interface CompiledBashGlob {
  readonly raw: string;                    // verbatim for debug-log
  readonly tokens: ReadonlyArray<GlobToken>;
  readonly trailingWordBoundary: boolean;  // `Bash(ls *)` vs `Bash(ls*)`
  readonly isCommandNameOnly: boolean;     // `Bash(git *)` is more
                                            // permissive than
                                            // `Bash(git push *)`; the
                                            // specificity-override rule
                                            // reads this flag (D-61-04).
  test(subcommand: string): boolean;
}

// Path glob: anchored to a normalized absolute base.
export interface CompiledPathGlob {
  readonly raw: string;                    // verbatim for debug-log
  readonly anchor: PathAnchor;             // resolved at parse time
  readonly absoluteBase: string;           // normalized absolute path
                                           // (e.g. "/home/u/src" for
                                           // "~/src/**" under
                                           // HOME=/home/u)
  readonly tokens: ReadonlyArray<GlobToken>;
  // Bare filenames follow gitignore semantics at any depth (`Read(.env)`
  // matches `deep/nested/.env`); the engine encodes that by allowing
  // an implicit `**/` prefix when no explicit anchor is supplied AND
  // the pattern has no `/` segments above the basename. See Pitfall 1.
  testAbsolute(absPath: string): boolean;
}

type GlobToken =
  | { kind: "literal"; text: string }
  | { kind: "star" }              // matches within one path segment
  | { kind: "globstar" }          // matches across path segments
  | { kind: "slash" };

type PathAnchor =
  | { kind: "filesystem-root" }   // //abs
  | { kind: "home" }              // ~/
  | { kind: "project-root" }      // /project-root (Pi: ctx.projectRoot or cwd)
  | { kind: "cwd" }               // ./ or no anchor
  | { kind: "gitignore-bare" };   // `Read(.env)`: matches at any depth
```

**Algorithm sketch (tokenize + match):**

```ts
// Source: hand-authored per D-61-01

function tokenize(pattern: string): GlobToken[] {
  const out: GlobToken[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "/") { out.push({ kind: "slash" }); i++; continue; }
    if (c === "*" && pattern[i + 1] === "*") {
      out.push({ kind: "globstar" });
      i += 2;
      continue;
    }
    if (c === "*") { out.push({ kind: "star" }); i++; continue; }
    // Literal run until next metacharacter.
    let j = i;
    while (j < pattern.length && pattern[j] !== "*" && pattern[j] !== "/") j++;
    out.push({ kind: "literal", text: pattern.slice(i, j) });
    i = j;
  }
  return out;
}

// Standard recursive-descent glob match. `**` consumes zero or more
// segments; `*` consumes within a segment only; literal is exact.
function matchTokens(tokens: GlobToken[], text: string): boolean {
  // ... ~40-60 LoC standard glob matcher; cap recursion depth to
  // text.length for safety. No catastrophic-backtrack risk because
  // each `**` only spans segments (not arbitrary characters).
}
```

**Algorithm sketch (Bash trailing-space word boundary, D-61-04 Specificity):**

```ts
// `Bash(ls *)`  -> trailingWordBoundary = true,  isCommandNameOnly = true
// `Bash(ls*)`   -> trailingWordBoundary = false, isCommandNameOnly = true
// `Bash(git push *)` -> trailingWordBoundary = true, isCommandNameOnly = false
// (The flag is "command name with optional `*` for arg list" vs
//  "command name and at least one fixed arg before `*`".)

function compileBashGlob(raw: string): CompiledBashGlob {
  // 1. Apply :* colon-sugar normalization ONLY when trailing.
  //    Examples (upstream-verbatim):
  //      "ls:*"          -> "ls *"   (trailing -> sugar)
  //      "git:* push"    -> "git:* push"  (mid-pattern colon is literal)
  //      "git push:*"    -> "git push *"   (trailing -> sugar)
  let normalized = raw.endsWith(":*")
    ? raw.slice(0, -2) + " *"
    : raw;

  // 2. Detect trailing-space word boundary.
  const trailingWordBoundary = / \*$/.test(normalized);

  // 3. Detect "command name only" specificity.
  //    Bash pattern is "command-only" iff it matches /^<cmd>(\s*\*)?$/
  //    after sugar normalization. Anything more specific (e.g. extra
  //    fixed args before *) reads the specificity-override rule in
  //    bashSubcommandFires.
  const isCommandNameOnly = /^[A-Za-z0-9_./-]+(\s+\*)?$/.test(normalized);

  // 4. Tokenize for actual glob matching.
  const tokens = tokenize(normalized);

  return {
    raw,
    tokens,
    trailingWordBoundary,
    isCommandNameOnly,
    test(subcommand) { return matchBashGlob(tokens, subcommand,
                                            trailingWordBoundary); },
  };
}
```

### Pattern 3: Hand-authored Bash subcommand parser (~80-120 LoC, D-61-04)

**What:** Pure-text shell tokenizer + subcommand extractor implementing
upstream's exact strip/split/recurse contract.

**When to use:** Internal to `bridges/hooks/if-field/bash.ts`. Single
entry point: `parseBashSubcommands(command: string): ParseResult`.

```ts
// Source: D-61-04 + upstream permissions docs § Bash / Process wrappers /
// Compound commands (verified 2026-06-15)

export type ParseResult =
  | { ok: true; subcommands: ReadonlyArray<string>;
      hasInterpolation: boolean }
  | { ok: false; reason: string };

// `ok: false` is the fail-open trigger -- ifFires reads `!ok` as "fire
// the hook" (matches upstream's documented best-effort contract).
// `hasInterpolation` is true iff the original command contains $(...),
// backticks, $VAR, or ${VAR}; reads for the D-61-04 specificity-override
// rule.

const WRAPPER_STRIP = new Set([
  "timeout", "time", "nice", "nohup", "stdbuf", "xargs",
]);

// xargs with flags is matched as xargs (NOT recursed into the inner cmd).
// Detection: split by whitespace, peek at args[1]; if it starts with "-"
// the xargs is "with flags" -> do NOT strip; treat the whole xargs
// invocation as a single subcommand starting with "xargs".

const COMPOUND_SEPARATORS = /(?:\|\||&&|\|&|;|\||&|\n)/g;
//                          NOTE order: `||` before `|`, `&&` before `&`,
//                          `|&` before `|` and `&`. Single-pass scan is
//                          cleaner but the precedence is load-bearing.

export function parseBashSubcommands(command: string): ParseResult {
  try {
    const hasInterpolation =
      /\$\(|`|\$\w+|\$\{[^}]+\}/.test(command);

    // 1. Quote-aware compound split. SINGLE quotes prevent the
    //    separator from splitting (`'a && b'` is one subcommand);
    //    DOUBLE quotes also prevent (`"a && b"` is one); BACKTICKS
    //    do NOT split (treated as command substitution -> recursed).
    const pieces = splitOnCompoundSeparators(command);

    // 2. Recurse into $() and backticks for each piece; flatten.
    //    Cap recursion depth at 8 to avoid runaway on pathological
    //    nested input (real shell uses 8 by default for $()/$($...)).
    const recursed: string[] = [];
    for (const piece of pieces) {
      recursed.push(piece);  // The piece itself is a subcommand.
      pushRecursed(piece, recursed, 0);
    }

    // 3. Strip process wrappers from each subcommand head.
    const stripped = recursed.map(stripWrappers);

    return { ok: true, subcommands: stripped, hasInterpolation };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

function stripWrappers(subcmd: string): string {
  // Repeatedly strip head wrappers as long as they're a closed-set
  // bare wrapper. `timeout 30 npm test` -> `npm test`.
  // `xargs grep pattern` -> `grep pattern` (strip).
  // `xargs -n1 grep pattern` -> `xargs -n1 grep pattern` (do NOT strip;
  // xargs has flags).
  let cur = subcmd.trim();
  while (true) {
    const head = cur.split(/\s+/)[0];
    if (!WRAPPER_STRIP.has(head)) return cur;
    // `xargs` with flags: do NOT strip.
    if (head === "xargs") {
      const next = cur.split(/\s+/)[1];
      if (next?.startsWith("-")) return cur;
    }
    // `find -exec` / `find -delete` opaque arg: do NOT recurse.
    // (find itself isn't in WRAPPER_STRIP, so this is naturally
    // handled — the outer split keeps `find -exec rm {} \;` as one
    // subcommand matched as `find`.)
    cur = cur.slice(head.length).trim();
  }
}

function bashSubcommandFires(
  glob: CompiledBashGlob,
  subcommand: string,
  hasInterpolation: boolean,
): boolean {
  // Direct match -> fire.
  if (glob.test(subcommand)) return true;

  // D-61-04 specificity-override: if the pattern specifies more than
  // the command name (e.g. `git push *`), fire on $()/backticks/$VAR
  // interpolation in the source command.
  if (hasInterpolation && !glob.isCommandNameOnly) return true;

  return false;
}
```

### Pattern 4: `RoutingEntry` extension + `flattenPluginIntoBuckets` copy

**What:** One field on `RoutingEntry`; one line in the flatten loop.

```ts
// Source: extending RoutingEntry at event-router.ts:76-91

export interface RoutingEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
  // NEW (Phase 61):
  readonly ifPredicate: IfPredicate;
  //                    ^^^^^^^^^^^
  // Always-present-with-sentinel (RECOMMENDED over optional). When
  // `handlerDecl.if` is absent OR failed to compile, the predicate is
  // `MATCH_ALL_IF`. This keeps the dispatch-time switch totally exhaustive
  // and avoids an undefined check in the hot path.
}
```

In `flattenPluginIntoBuckets` (event-router.ts:278-289), each push gets
`ifPredicate: handlerDecl.ifPredicate ?? MATCH_ALL_IF`. The
`handlerDecl.ifPredicate` is attached during `parseHooksConfig` (a new
side-effect step in the parser: compile each `if` field, attach to the
handler entry in the parsed config tree). Done once per install +
`/reload`; never on the hot path.

### Pattern 5: Dispatch-loop insertion (1 line in `reduceBucket`)

```ts
// Source: dispatch.ts:163-204; insertion between lines 171 and 175

async function reduceBucket(
  bucket: ReadonlyArray<RoutingEntry>,
  event: unknown,
  ctx: ExtensionContext,
  matcherFires: (entry: RoutingEntry) => boolean,
): Promise<HookExecResult> {
  let finalResult: HookExecResult = { kind: "noop" };
  for (const entry of bucket) {
    if (!matcherFires(entry)) {
      continue;
    }
    // NEW (Phase 61, MATCH-03 / D-61-02): AND composition with matcher.
    // ifFires reads entry.ifPredicate and the Claude-event kind to
    // decide whether to extract a target from the Pi event.
    if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) {
      continue;
    }

    const r = await activeExecutor(entry, event, ctx);
    // ... rest unchanged (D-60-02 reducer arms: block/stop/mutate/noop)
  }
  return finalResult;
}
```

The single helper `ifFires(predicate, event, ctx, claudeEvent)` is
exported from `bridges/hooks/if-field/index.ts` (or wherever the planner
co-locates it). On non-tool events (`claudeEvent` ∉ TOOL_EVENTS) it
returns `true` unconditionally — but in practice the parser never attaches
a non-sentinel `IfPredicate` on a non-tool-event handler (upstream
contract: "Adding it to any other event prevents the hook from running"
— v1.13's reading is "match-all on non-tool events" since the predicate
is undefined-equivalent). See Pitfall 7 for the exact disposition.

### Anti-Patterns to Avoid

- **Don't parse at dispatch time.** Compile every `IfPredicate` at parse
  time, ride on `RoutingEntry`. Phase 58's "registration-time translation,
  no runtime translation" locked stance applies to `if` for the same
  reason (hot-path latency + closed-set test coverage).
- **Don't conflate `matcher` and `if`.** They're independent filters
  composed under AND (REQ MATCH-03). `matcherFires` reads Phase 58's
  `ParsedMatcher`; `ifFires` reads the Phase 61 `IfPredicate`. Keeping
  them as separate function calls keeps the predicate-cascade easy to
  read and the unit tests independent.
- **Don't fail-loud at install for malformed `if`.** D-61-02 + upstream's
  pre-v2.1.85 precedent ("ignores it and runs the hook on every matched
  call") + portability-regression argument. Strict validation is out
  of scope.
- **Don't add Pi-specific rule prefixes** (`Grep(*.ts)` / `Find(...)`).
  Upstream-faithful stance per D-61-03 + user's explicit ask.
- **Don't recurse into `find -exec` arguments.** Upstream is explicit:
  `Bash(find *)` does not cover `find -exec rm {} \;`. Match as `find`.
- **Don't backtrack on `**` recursion.** Cap path-segment depth at the
  input string's segment count; standard glob algorithms terminate in
  O(n*m). No catastrophic-backtrack risk because `**` only spans
  segments, not arbitrary characters.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Full Bash AST parser | `bash-parser` / `shell-parse` / a hand-written shell-level lexer | Bridge-internal pure-text strip/split/recurse (per D-61-04) | Upstream's contract is narrow: strip closed-set wrappers, split on closed-set separators, recurse on `$()`/backticks, opaque `find -exec`. A full AST parser solves more than the contract and exposes constructs we explicitly want opaque. Architecture test can pin all upstream truth-table rows against the hand-authored parser. |
| Glob library | `picomatch` / `minimatch` | Hand-authored `glob.ts` (per D-61-01) | Material library surface (character classes, brace expansion, negation, extglobs) we don't want. Both compile to `RegExp` internally. Phase 58 rejected regex matchers (MATCH-02). Hand-authored keeps the upstream-truth-table pin trivial. |
| Path containment of resolved anchors | Custom `assertPathInside` for the four anchors | Not needed | The `if` field is read-only — the four anchors resolve to normalized absolute paths used ONLY for glob comparison, never as a write target. NFR-10 trip surface is zero. |
| `${VAR}` shell interpolation expansion | Eager expand `$HOME`, `$CLAUDE_PROJECT_DIR`, etc. in `if` patterns | Treat literal | Upstream does NOT expand env vars in `if` patterns at parse time. The four anchors (`~/`, `//`, `/`, `./`) ARE the supported variables. Anything else (`$HOME/.config/*.json`) parses as a literal-character glob and matches an actual `$HOME` substring in the file path (impossibly, in practice → never fires). Caller bug; debug-log only. |

**Key insight:** The grammar is intentionally narrow. Hand-authoring is
the cheaper option because every behavior is testable against an upstream
truth-table row that already exists. Pulling in a library would smuggle
in semantics not in upstream's documented contract.

## Common Pitfalls

### Pitfall 1: Bare filename gitignore semantics for `Read(.env)`

**What goes wrong:** A naive path glob treats `Read(.env)` as
"`./env` relative to cwd, no recursion" and silently fails to fire on
`event.input.path === "deep/nested/.env"`. Upstream is explicit:
"Bare filenames follow gitignore semantics and match at any depth, so
`Read(.env)` and `Read(**/.env)` are equivalent."

**Why it happens:** Gitignore semantics treat a pattern with no leading
`/` as "any depth". The four-anchor model in D-61-01 must encode this:
when the user pattern has no anchor prefix AND no `/` separators, treat
it as `**/<pattern>` semantically. (Anchor: `gitignore-bare`.)

**How to avoid:** In `compilePathGlob`, detect `pattern.indexOf("/") === -1`
AND no anchor → set anchor to `gitignore-bare`, prepend an implicit
`**/` token at the start of the token list. Test against the upstream
truth-table row.

**Warning signs:** `Read(.env)` fixture test reads as no-match when
target path is anything other than `<cwd>/.env` (i.e. only the surface
form fires).

### Pitfall 2: Quote-aware compound separator split

**What goes wrong:** Naive regex split `cmd.split(/&&|\|\|/)` splits
`echo 'a && b'` into `["echo 'a ", " b'"]` — wrong. Both subcommands
match falsely.

**Why it happens:** Shell quoting prevents separator interpretation. A
character inside single OR double quotes is literal.

**How to avoid:** Walk the string once tracking single-quote / double-quote
state; emit a split point only when both `inSingle` and `inDouble` are
false. Same scan handles `|&` / `||` / `&&` / `;` / `|` / `&` / `\n`
precedence (longer separators first).

**Warning signs:** Adding `echo 'a && b'` as a fixture: should yield ONE
subcommand `echo 'a && b'` (no split).

### Pitfall 3: `$VAR` interpolation regex false positives

**What goes wrong:** `/\$\w+/` matches `$5` (positional param) and `$1`
(first match group inside command substitution). Both are real shell
constructs. The specificity-override rule then fires on commands that
look interpolated but are positional/group references.

**Why it happens:** `\w` matches digits. Real `$VAR` references in shell
are alphabetic-start identifiers.

**How to avoid:** Use `/\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}/` (start
with alpha or underscore). This is what `bash` itself treats as a "name"
in `name=value` assignments. Numbered `$1`-`$9` are positional params,
NOT user-defined interpolation — exclude them. Document this divergence
from a strict bash grammar in the parser file's leading comment.

**Warning signs:** A command like `awk '{print $1}'` triggers the
specificity-override on `Bash(git push *)`. Wrong.

### Pitfall 4: `:*` colon-sugar mid-pattern

**What goes wrong:** Normalizing every `:*` to ` *` breaks
`Bash(git:* push)` — that's a mid-pattern colon, NOT sugar. Upstream:
"`:*` is only recognized at the end of a pattern. In a pattern like
`Bash(git:* push)`, the colon is treated as a literal character and won't
match git commands."

**Why it happens:** Sugar normalization is a string `.replaceAll(":*", " *")`
candidate; that's wrong.

**How to avoid:** Only normalize when `raw.endsWith(":*")`. Mid-pattern
`:*` stays literal. Compile a fixture row for `Bash(git:* push)`
expecting NO match against `git push`.

**Warning signs:** `Bash(git:* push)` fires on `git push` after the
naive replace.

### Pitfall 5: `${CLAUDE_PROJECT_DIR}` in patterns

**What goes wrong:** A plugin author writes `Read(${CLAUDE_PROJECT_DIR}/.env)`
hoping the bridge expands it. Upstream does NOT expand env vars in `if`
patterns. The plugin author confuses `command` field syntax (which DOES
get env-var expansion at exec time per Phase 60's `bashSpawnContext`)
with `if` field syntax (which does NOT).

**Why it happens:** The four anchors (`~/`, `//`, `/`, `./`) ARE the
supported "variables" in the permission-rule grammar. Other `${...}`
sequences pass through as literal characters and match no real file path.

**How to avoid:** Document in the bridge's `if-field/glob.ts` leading
comment. No code change required (the glob engine will simply never
fire — falls open via specificity-override OR fails to match silently).
The architecture test does NOT need a fixture for this — it's a plugin
bug, not a bridge bug.

**Warning signs:** Plugin author files an issue saying "my `if` filter
never fires"; debug-log shows the bytes of the pattern were never
normalized through `$HOME`.

### Pitfall 6: Symlinks on Read / Edit `if` patterns

**What goes wrong:** Upstream Read/Edit permission rules check BOTH the
symlink path AND its resolved target. The `if` field uses the same syntax
— does it follow the same symlink semantic? CONTEXT.md is silent.

**Why it happens:** Upstream's permission-rule docs are explicit about
symlinks. The hooks-guide § "Filter by tool name and arguments" does NOT
mention symlinks at all.

**How to avoid:** Treat the `event.input.path` as a literal path string
— do NOT call `fs.realpath` in the bridge. Three reasons: (a) the `if`
field is "best-effort, not a security boundary" — symlinks are out of
scope for best-effort; (b) realpath is an async I/O call on every
dispatch — hot-path-incompatible; (c) upstream's hooks-guide is silent.
If a future plugin author files an issue, defer to v1.14+.

**Warning signs:** A plugin author asks why `Edit(./src/**)` doesn't
fire on `event.input.path === "./symlinked-src/foo.ts"` where
`./symlinked-src` is a symlink to `./src`.

### Pitfall 7: `if` field on non-tool events

**What goes wrong:** Upstream says "Adding it to any other event prevents
the hook from running." Naive reading: parser should set the predicate
to `kind: "never-fires"` on non-tool-event handlers. But that contradicts
D-61-02's fail-open stance.

**Why it happens:** "Prevents the hook from running" is the upstream
behavior. The bridge's strict-supportability gate handles the analogous
case for unsupported events at the matcher layer (Phase 58 TOOL-02(c)).

**How to avoid:** The parser detects `handlerDecl.if !== undefined` AND
the parent event is NOT in `TOOL_EVENTS`, sets the predicate to
`MATCH_ALL_IF` (fall-open per D-61-02 — the hook still fires regardless),
AND emits a `hookDebugLog` warning. RATIONALE: D-61-02's portability-
regression argument — silently never-firing the hook would be a different
divergence from upstream (which "prevents the hook from running" hints
at a structural reject); our fall-open is the upstream-compatible
disposition because it's the documented v2.1.85-prior behavior. Confirm
with planner during DISCUSSION-LOG.

Alternative (RECOMMENDED for architecture test):
`bridges` ignores `if` on non-tool events per the REQ MATCH-03 wording —
"the bridge ignores `if` on non-tool events." This means dispatch-time
fall-open (`MATCH_ALL_IF`) is also the right disposition for this case.
The architecture test exercises this explicitly.

**Warning signs:** A SessionStart hook with `if: Bash(...)` never fires
under v1.13.

### Pitfall 8: `**` segment boundaries

**What goes wrong:** Naive `**` implementation treats it as "any characters"
including `/`. Upstream: `**` matches across directories; `*` matches
within one segment.

**Why it happens:** Most glob engines (`picomatch`, `minimatch`) get this
right. A hand-roll must encode the precise semantic.

**How to avoid:** In `tokenize`, emit a `globstar` token only when seeing
`**`; in `matchTokens`, `globstar` consumes zero or more full segments
(separated by `/`); `star` consumes within one segment (cannot consume
`/`).

**Warning signs:** `Read(src/**/*.ts)` doesn't fire on
`event.input.path === "src/a/b/c.ts"`, OR `Read(src/*.ts)` accidentally
fires on `src/a/b.ts` (it should NOT — `*` is segment-local).

### Pitfall 9: Empty `if: ""` disposition

**What goes wrong:** Plugin author writes `if: ""`. Is it match-all
(parse-equivalent to absent), regex-trip, or compile-error fall-open?

**Why it happens:** Upstream is silent on empty `if`. Matcher (different
field, Phase 58) treats empty as match-all. `if` syntax is permission-rule
syntax — `Bash(<empty>)` is malformed.

**How to avoid:** Treat as malformed → compile-time fall-open to
`MATCH_ALL_IF` + `hookDebugLog` warning. This is consistent with
D-61-02's "everything falls open" rule. Architecture-test fixture:
`if: ""` parses to `kind: "match-all", reason: "<empty>"`.

**Warning signs:** A test for `if: ""` reads as "regex" trip and flips
the plugin to unavailable — wrong, the `if` field never trips plugin
unavailability.

### Pitfall 10: Compound separator precedence

**What goes wrong:** Splitting on `|&` after splitting on `|` produces
the wrong subcommand list — `cmd1 |& cmd2` splits as `cmd1 ` + `& cmd2`
when `|&` is unrecognized.

**Why it happens:** Compound separator precedence is `||` > `&&` > `|&`
> `;` > `|` > `&` > newline (longest-token-first for the multi-char
operators).

**How to avoid:** Use a single regex alternation that lists the longer
operators first: `/(?:\|\||&&|\|&|;|\||&|\n)/`. The regex engine matches
left-to-right and prefers the leftmost match — listing `|&` before `|`
ensures it's matched as a unit.

**Warning signs:** Architecture-test row `cmd1 |& cmd2` produces three
subcommands instead of two.

## Code Examples

### Compile `if` field at parse time (D-61-02)

```ts
// Source: domain/components/hooks.ts (extend parseHooksConfig)

function compileIfPredicate(
  rawIf: string,
  claudeEvent: BucketAEvent,
  ctx: { homedir: string; cwd: string; projectRoot: string },
): IfPredicate {
  // Empty / whitespace -> fall-open (Pitfall 9).
  const trimmed = rawIf.trim();
  if (trimmed === "") {
    hookDebugLog(`if-field compile: empty value, falling open`);
    return MATCH_ALL_IF;
  }

  // The bridge ignores `if` on non-tool events (REQ MATCH-03; Pitfall 7).
  if (!TOOL_EVENT_MEMBERS.has(claudeEvent)) {
    hookDebugLog(
      `if-field compile: non-tool event ${claudeEvent}; ignoring "if"`,
    );
    return MATCH_ALL_IF;
  }

  // <ToolName>(<pattern>) syntax.
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/.exec(trimmed);
  if (!m) {
    // Could be `mcp__server__tool` (no parens) literal.
    if (/^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/.test(trimmed)) {
      return { kind: "mcp-literal", toolName: trimmed };
    }
    // Or `mcp__server` / `mcp__server__*` prefix.
    const sp = /^mcp__([A-Za-z0-9_-]+)(?:__\*)?$/.exec(trimmed);
    if (sp) {
      return {
        kind: "mcp-server-prefix",
        serverPrefix: `mcp__${sp[1]}__`,
      };
    }
    hookDebugLog(`if-field compile: malformed syntax "${rawIf}"; falling open`);
    return MATCH_ALL_IF;
  }

  const [, prefix, pattern] = m;

  switch (prefix) {
    case "Bash": {
      try {
        const bashGlob = compileBashGlob(pattern);
        return { kind: "bash", bashGlob };
      } catch (err) {
        hookDebugLog(
          `if-field compile: Bash glob "${pattern}" failed: ${errorMessage(err)}; falling open`,
        );
        return MATCH_ALL_IF;
      }
    }
    case "Read":
    case "Edit":
    case "Write": {
      try {
        const pathGlob = compilePathGlob(pattern, ctx);
        const target = IF_PREFIX_TARGETS[prefix];   // D-61-03 table
        return {
          kind: "path-tool",
          piEvents: target.piEvents,
          pathGlob,
        };
      } catch (err) {
        hookDebugLog(
          `if-field compile: ${prefix} glob "${pattern}" failed: ${errorMessage(err)}; falling open`,
        );
        return MATCH_ALL_IF;
      }
    }
    default: {
      // Grep / Glob / LS / MultiEdit / NotebookEdit / PowerShell /
      // WebFetch / Agent / Cd / typos -- all fall open per D-61-02.
      hookDebugLog(
        `if-field compile: unknown prefix "${prefix}"; falling open`,
      );
      return MATCH_ALL_IF;
    }
  }
}
```

### `ifFires` dispatch helper (D-61-02 / D-61-03 / D-61-04)

```ts
// Source: bridges/hooks/if-field/index.ts (or co-located in match.ts)

export function ifFires(
  predicate: IfPredicate,
  event: unknown,
  ctx: ExtensionContext,
  claudeEvent: BucketAEvent,
): boolean {
  switch (predicate.kind) {
    case "match-all":
      return true;
    case "bash": {
      // Bash filter applies to PreToolUse/PostToolUse/PostToolUseFailure
      // dispatched on a Pi `bash` tool event; on other tool events the
      // bash predicate never fires (impossible by construction: parser
      // attaches `bash` predicate only when prefix === "Bash" and
      // claudeEvent is a tool event; the dispatching matcher already
      // filtered to bash tool events upstream).
      const command = extractBashCommand(event);
      if (command === undefined) return false;
      const parsed = parseBashSubcommands(command);
      if (!parsed.ok) {
        // D-61-04 fail-open on unparseable Bash.
        hookDebugLog(
          `ifFires: Bash unparseable: ${parsed.reason}; firing`,
        );
        return true;
      }
      for (const subcmd of parsed.subcommands) {
        if (bashSubcommandFires(predicate.bashGlob, subcmd,
                                parsed.hasInterpolation)) {
          return true;
        }
      }
      return false;
    }
    case "path-tool": {
      // D-61-03 cross-tool semantic: predicate.piEvents includes the Pi
      // tool names this `if` prefix covers. The dispatching matcher
      // already filtered to those Pi events; this check is a guard.
      const toolName = extractToolName(event);
      if (!predicate.piEvents.has(toolName as PiToolName)) return false;
      // Substitute cwd when input.path is missing (D-61-03 substitute-cwd).
      const path = extractPath(event) ?? ctx.cwd;
      return predicate.pathGlob.testAbsolute(resolveTarget(path, ctx));
    }
    case "mcp-literal": {
      const toolName = extractToolName(event);
      return toolName === predicate.toolName;
    }
    case "mcp-server-prefix": {
      const toolName = extractToolName(event);
      return toolName.startsWith(predicate.serverPrefix);
    }
    default:
      return assertNever(predicate);
  }
}
```

### Per-tool target-extractor table (D-61-03)

```ts
// Source: domain/components/hook-if-targets.ts (NEW) or co-located
// in hook-tool-names.ts (planner's discretion)

export interface IfPrefixTarget {
  readonly piEvents: ReadonlySet<PiToolName>;
  readonly extractTarget: "path" | "command" | "toolName";
}

export const IF_PREFIX_TARGETS = {
  Bash: {
    piEvents: new Set<PiToolName>(["bash"]),
    extractTarget: "command",
  },
  Read: {
    piEvents: new Set<PiToolName>(["read", "grep", "find", "ls"]),
    extractTarget: "path",
  },
  Edit: {
    piEvents: new Set<PiToolName>(["edit", "write"]),
    extractTarget: "path",
  },
  Write: {
    piEvents: new Set<PiToolName>(["write"]),
    extractTarget: "path",
  },
} as const satisfies Record<string, IfPrefixTarget>;
```

The `satisfies` is the load-bearing closed-set gate matching Phase 58's
`PI_TO_CLAUDE_TOOL_NAMES` pattern.

### Upstream truth-table fixtures (architecture test)

Verbatim from `code.claude.com/docs/en/hooks-guide` § "Filter by tool name
and arguments with the `if` field" (fetched 2026-06-15):

```ts
// Source: tests/architecture/hooks-if-field.test.ts

const HOOKS_GUIDE_TRUTH_TABLE: ReadonlyArray<{
  ifPattern: string;
  bashCommand: string;
  fires: boolean;
  why: string;
}> = [
  { ifPattern: "Bash(git *)",      bashCommand: "git push",
    fires: true,
    why: "command name matches" },
  { ifPattern: "Bash(git *)",      bashCommand: "npm test && git push",
    fires: true,
    why: "each subcommand is checked; `git push` matches" },
  { ifPattern: "Bash(git *)",      bashCommand: "echo $(git log)",
    fires: true,
    why: "commands inside $() and backticks are checked; `git log` matches" },
  { ifPattern: "Bash(git *)",      bashCommand: "echo $(date)",
    fires: false,
    why: "no subcommand matches `git *`" },
  { ifPattern: "Bash(git push *)", bashCommand: "echo $(date)",
    fires: true,
    why: "patterns more specific than `<command> *` fire on $()/backticks/$VAR" },
];

// Bash glob word-boundary table (verbatim from permissions § Bash):
const BASH_WORD_BOUNDARY_TABLE: ReadonlyArray<{
  ifPattern: string;
  bashCommand: string;
  fires: boolean;
}> = [
  { ifPattern: "Bash(ls *)", bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls *)", bashCommand: "lsof",   fires: false },
  { ifPattern: "Bash(ls*)",  bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls*)",  bashCommand: "lsof",   fires: true },
];

// :* sugar table (verbatim):
const COLON_SUGAR_TABLE: ReadonlyArray<{
  ifPattern: string;
  bashCommand: string;
  fires: boolean;
}> = [
  { ifPattern: "Bash(ls:*)",        bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls:*)",        bashCommand: "lsof",   fires: false },
  { ifPattern: "Bash(git:* push)",  bashCommand: "git push",
    fires: false /* mid-pattern colon literal, NOT sugar */ },
];

// Process-wrapper table (verbatim from permissions § Process wrappers):
const WRAPPER_TABLE = [
  { ifPattern: "Bash(npm test *)", bashCommand: "timeout 30 npm test",
    fires: true,  reason: "timeout stripped" },
  { ifPattern: "Bash(grep *)",     bashCommand: "xargs grep pattern",
    fires: true,  reason: "bare xargs stripped" },
  { ifPattern: "Bash(grep *)",     bashCommand: "xargs -n1 grep pattern",
    fires: false, reason: "xargs with flags NOT stripped; head is xargs" },
  { ifPattern: "Bash(find *)",     bashCommand: "find . -exec rm {} \\;",
    fires: true,  reason: "find -exec opaque; matches as find" },
  { ifPattern: "Bash(rm *)",       bashCommand: "find . -exec rm {} \\;",
    fires: false, reason: "find -exec arg NOT recursed" },
];

// Compound-command table (verbatim):
const COMPOUND_TABLE = [
  { ifPattern: "Bash(npm test)",  bashCommand: "git status && npm test",
    fires: true,  reason: "compound split on && and each subcommand checked" },
  { ifPattern: "Bash(safe-cmd *)", bashCommand: "safe-cmd && other-cmd",
    fires: true,  reason: "first subcommand matches; only ONE need match" },
  { ifPattern: "Bash(other-cmd *)", bashCommand: "safe-cmd && other-cmd",
    fires: true,  reason: "second subcommand matches" },
  { ifPattern: "Bash(other-cmd *)", bashCommand: "'safe-cmd && other-cmd'",
    fires: false, reason: "quotes prevent compound separator split" },
];

// Read / Edit path-glob anchor table (verbatim from permissions § Read and Edit):
const PATH_ANCHOR_TABLE = [
  { ifPattern: "Read(.env)",       inputPath: "./.env",            fires: true },
  { ifPattern: "Read(.env)",       inputPath: "deep/nested/.env",  fires: true,
    reason: "bare filename gitignore semantics: any depth" },
  { ifPattern: "Read(.env)",       inputPath: "../.env",           fires: false,
    reason: "anchored to cwd, parent not included" },
  { ifPattern: "Read(//**/.env)",  inputPath: "/tmp/.env",         fires: true,
    reason: "//abs anchor + globstar = anywhere on filesystem" },
  { ifPattern: "Read(~/.zshrc)",   inputPath: "/home/u/.zshrc",    fires: true,
    reason: "~ anchor resolves to homedir at parse time" },
  { ifPattern: "Edit(/docs/**)",   inputPath: "/projects/p/docs/x.md",
    fires: true, reason: "/<path> = project-root anchored" },
  { ifPattern: "Edit(/docs/**)",   inputPath: "/docs/x.md",
    fires: false, reason: "NOT absolute; /docs/ is project-root anchored" },
  { ifPattern: "Read(src/**)",     inputPath: "<cwd>/src/a/b.ts",  fires: true },
];

// MCP table (verbatim from permissions § MCP):
const MCP_TABLE = [
  { ifPattern: "mcp__puppeteer",
    toolName: "mcp__puppeteer__navigate", fires: true,
    reason: "server-prefix bare form" },
  { ifPattern: "mcp__puppeteer__*",
    toolName: "mcp__puppeteer__navigate", fires: true,
    reason: "server-prefix explicit wildcard equivalent" },
  { ifPattern: "mcp__puppeteer__navigate",
    toolName: "mcp__puppeteer__navigate", fires: true,
    reason: "exact tool literal" },
  { ifPattern: "mcp__puppeteer__navigate",
    toolName: "mcp__puppeteer__click", fires: false,
    reason: "literal mismatch" },
];
```

### REQUIREMENTS.md MATCH-03 amendment text (lockstep with first Phase 61 commit)

Replace the current MATCH-03 wording (lines 31-39 of REQUIREMENTS.md):

> **MATCH-03**: The bridge implements the `if` field on tool-event hook
> entries (PreToolUse / PostToolUse / PostToolUseFailure; bridge ignores
> `if` on non-tool events to match upstream's "attaching to other events
> prevents the hook from running" behavior). Implementation parses
> Claude Code's permission-rule syntax `<ToolName>(<pattern>)` (per
> `docs/research/claude-hook-config-syntax.md` § 7 and
> `code.claude.com/docs/en/permissions` § "Permission rule syntax"),
> extracts the parenthesized pattern, and matches it against the per-tool
> argument target. **Accepted rule prefixes are the upstream-faithful
> closed set: `Bash`, `Read`, `Edit`, `Write`, plus the three MCP literal
> forms (`mcp__<server>`, `mcp__<server>__*`, `mcp__<server>__<tool>`).**
> Per upstream's cross-tool semantic ("Read rules apply to all built-in
> tools that read files like Grep and Glob" and "Edit rules apply to
> all built-in tools that edit files"), `Read` covers Pi
> `{read, grep, find, ls}`; `Edit` covers `{edit, write}`; `Write` covers
> `{write}`; `Bash` covers `{bash}`. **`Grep`, `Glob`, `LS`, `MultiEdit`,
> `NotebookEdit`, `PowerShell`, `WebFetch`, `Agent`, `Cd` are NOT
> accepted as standalone `if`-field prefixes** — they fall under `Read`
> / `Edit` via the cross-tool mapping or are out-of-scope tools.
>
> - `Bash(...)` → `event.input.command` with subcommand parsing
>   (compound-separator split on `&&` `||` `;` `|` `|&` `&` newline;
>   recursive `$(...)` and backtick subcommand extraction; process-wrapper
>   strip for `timeout`/`time`/`nice`/`nohup`/`stdbuf`/bare `xargs`;
>   `xargs` with flags matches as `xargs`; `find -exec` and `find -delete`
>   arguments are opaque); fires when ANY subcommand matches the glob.
> - `Read(<glob>)` → `event.input.path` for Pi `{read, grep, find, ls}`
>   with gitignore-semantics glob and four anchors (`//abs`, `~/home`,
>   `/project-root`, `./cwd`). **When `event.input.path` is missing
>   (Pi `grep` / `find` / `ls` optional-path tools), the bridge
>   substitutes `ctx.cwd` then matches** — upstream Grep/LS default to
>   cwd internally before the `if` filter runs.
> - `Edit(<glob>)` → `event.input.path` for Pi `{edit, write}` with the
>   same anchor semantics.
> - `Write(<glob>)` → `event.input.path` for Pi `{write}`.
> - `mcp__<server>` → server-prefix match: fires on any tool event with
>   `event.toolName === "mcp__<server>__<anything>"`.
> - `mcp__<server>__*` → equivalent to bare `mcp__<server>` (explicit
>   wildcard form).
> - `mcp__<server>__<tool>` → literal equality against `event.toolName`.
> - Bash glob: `*` matches any chars including spaces (within one
>   path segment for path tools); `**` matches across segments;
>   word-boundary at trailing ` *` vs no-space prefix
>   (`Bash(ls *)` excludes `lsof`; `Bash(ls*)` includes both);
>   `:*` trailing-sugar equivalence (`Bash(ls:*)` ≡ `Bash(ls *)`);
>   mid-pattern `:` is literal.
> - Patterns more specific than `<command> *` (e.g. `Bash(git push *)`)
>   fire the hook whenever `$()`, backticks, or `$VAR` interpolation are
>   present in the command, matching upstream's "fail-open on uncertain
>   context" rule.
> - **Fail-open on ALL `if`-layer failure modes** (malformed permission-
>   rule syntax, unknown rule prefix, broken glob, unparseable Bash
>   command at runtime): the bridge fires the hook regardless. This
>   matches Claude Code's documented best-effort behavior — the doc
>   explicitly says "use the permission system rather than a hook to
>   enforce a hard allow or deny." Plugin installs cleanly; a
>   `hookDebugLog` warning records the fall-open cause.
> - Composition with `matcher`: AND semantics; `matcher` filters at
>   group level, `if` further narrows within that group.
> - Implementation lives at `bridges/hooks/if-field/{glob,bash,...}.ts`
>   plus the `domain/components/hook-if-targets.ts` rule-prefix → Pi
>   event set + target field mapping table; architecture test exercises
>   every fixture row in `code.claude.com/docs/en/hooks-guide` § "Filter
>   by tool name and arguments with the `if` field" truth table verbatim
>   plus the Bash compound / wrapper / sugar cases from
>   `code.claude.com/docs/en/permissions`.

(Replace the existing v1.13 traceability row `MATCH-03 | Phase 61 |
Pending` with `MATCH-03 | Phase 61 | Complete` when the phase closes.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Pre-v2.1.85 Claude Code "ignores `if` and runs the hook on every matched call" | Standard `if` field with permission-rule syntax filtering | Claude Code v2.1.85 (2026 onward; per upstream Note in hooks-guide § "Filter by tool name and arguments") | Documents the upstream-faithful precedent for our fall-open behavior — every failure mode silently degrades to match-all, exactly as pre-v2.1.85 Claude Code did. |
| Phase 57 ESCALATE on `if` (mark plugin unavailable) | Phase 61 IMPLEMENT with fail-open | Locked at v1.13 by `docs/research/claude-hook-config-syntax.md` § 7 promotion (REQUIREMENTS.md MATCH-03) | Plugin coverage from 4/5 (80%) to 4/5 (still 80%) — `security-guidance` remains unavailable due to `MultiEdit`/`NotebookEdit` (TOOL-02(b)). v1.13's `if` implementation is forward-compat for third-party plugins. |
| Library-based glob (`picomatch` / `minimatch`) | Hand-authored ~120-180 LoC engine (D-61-01) | Phase 61 locked at v1.13 | Zero new runtime deps. Surface stable across Claude Code releases. |

**Deprecated/outdated:**

- `docs/research/claude-hook-config-syntax.md` § 7 originally tagged `if`
  as ESCALATE (verdict revised in-line via the v1.13 IMPLEMENT promotion
  recorded in REQUIREMENTS.md MATCH-03 and the planner's amendment).
  The rationale paragraphs remain useful design context.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `ctx.projectRoot` exists on `ExtensionContext` in pi-coding-agent ^0.73.x; resolved at parse time for `/<path>` (project-root anchored) globs | Pattern 2 (anchor resolution) | LOW. Fallback: use `ctx.cwd` as project-root proxy (matches v1.0+ behavior throughout the marketplace bridge). Planner verifies by grep on `extensions/.../platform/pi-api.ts`. If absent, the `/<path>` anchor resolves to `ctx.cwd + "/<path>"` (semantically equivalent for any single-project-rooted plugin). [ASSUMED] |
| A2 | Pi events with `event.input.path === undefined` are a real production path for `grep` / `find` / `ls` (not just type-system optionality) | Pitfall 5 / Pattern 1 path-tool kind | MEDIUM. If always-present in practice, the substitute-cwd rule is theoretical (no harm). If genuinely optional, the rule is load-bearing. [ASSUMED based on peer-dep type `path?: string` on grep/find/ls schemas; not empirically verified against a real Pi runtime invocation]. |
| A3 | `${VAR}` / `$VAR` references in `if` patterns are NOT expanded at parse time by upstream Claude Code (they pass through as literal characters) | Pitfall 5 + Don't-Hand-Roll table | LOW. Upstream docs are silent; absence of an explicit example suggests no expansion. If wrong, the planner can add a parse-time expansion pass against a closed env-var set (`HOME`, `CLAUDE_PROJECT_DIR`, etc.) — purely additive, no behavioral break. [ASSUMED]. |
| A4 | `ctx.cwd` is the right substitute for Pi `find` / `grep` / `ls` with missing path (D-61-03 substitute-cwd rule) | Pattern 1 path-tool extraction | LOW. CONTEXT.md locks this. The upstream "Grep / LS default to cwd internally" rationale is sound. [CITED: CONTEXT.md D-61-03]. |
| A5 | The bridge ignores `if` on non-tool events by attaching `MATCH_ALL_IF` (fall-open) rather than `kind: "never-fires"` (upstream's "prevents the hook from running" wording) | Pitfall 7 | MEDIUM. Two valid readings of upstream wording exist; CONTEXT.md and REQ wording say "ignores `if` on non-tool events" which the planner should read as "treat the field as if it weren't there". Recommended disposition: MATCH_ALL_IF + hookDebugLog warning. Planner should explicitly call this out in DISCUSSION-LOG and consider whether a `never-fires` kind would be more upstream-faithful — but D-61-02's portability-regression argument applies. [ASSUMED disposition; explicit user confirmation in discuss-phase recommended]. |
| A6 | Symlinks are NOT resolved in the `if` field (hot-path I/O cost; upstream silent in hooks-guide; "best-effort" disclaimer covers it) | Pitfall 6 | LOW. Upstream's permission-rule layer DOES check both symlink and target; the hooks-guide silence on the `if` field plus the "best-effort, not a security boundary" disclaimer carry the weight. Planner verifies by skimming the latest hooks-guide page at planning time. [ASSUMED]. |
| A7 | The `$VAR` regex `/\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}/` correctly distinguishes user-defined env vars from positional params (`$1`, `$9`, `$*`, `$@`) | Pitfall 3 | LOW. The grammar is bash's own NAME convention. Architecture-test fixture row exercises `awk '{print $1}'` against `Bash(git push *)` — must NOT fire on the specificity-override. [ASSUMED based on POSIX shell NAME definition]. |

**If this table is empty:** N/A — six assumed claims listed, none
critical. A5 is the highest-risk assumption — recommend explicit
planner confirmation in DISCUSSION-LOG.

## Open Questions

1. **`ctx.projectRoot` field availability on `ExtensionContext`.**
   - What we know: pi-coding-agent peer dep `^0.73.x` exposes `ctx.cwd`
     and `ctx.isIdle()`; whether `ctx.projectRoot` exists is unverified.
   - What's unclear: Whether `/<path>` (project-root anchored) globs
     should resolve relative to `ctx.cwd` or a separate field.
   - Recommendation: Planner greps `node_modules/@earendil-works/pi-coding-agent/dist/.../types.d.ts`
     during plan-time. If `projectRoot` exists, use it; if not, fall
     back to `ctx.cwd` (semantically equivalent for v1.13's single-cwd
     plugin model). Document the choice in 61-DISCUSSION-LOG.md.

2. **Whether the per-tool target-extractor table belongs in
   `hook-if-targets.ts` or co-located in `hook-tool-names.ts`.**
   - What we know: Claude's Discretion per CONTEXT.md. Both files are
     pure data, no I/O.
   - What's unclear: File-size threshold for splitting vs co-locating.
   - Recommendation: If `hook-if-targets.ts` ends up under ~30 LoC,
     co-locate in `hook-tool-names.ts` (it's already 146 LoC and
     wouldn't grow much). If it grows past 30 LoC (e.g. adding
     extractor function pointers), split into its own file.

3. **Whether to attach the compiled `IfPredicate` to the
   `HookHandlerEntry` value tree returned by `parseHooksConfig`, or
   compile separately at `flattenPluginIntoBuckets` time.**
   - What we know: D-61-02 calls for parse-time compile; CONTEXT.md
     says the predicate "lives on each handler entry in the parser
     output".
   - What's unclear: Whether to add a discriminator field on
     `HookHandlerEntry` (e.g. `_compiledIfPredicate?: IfPredicate`) —
     this couples the validated schema shape with bridge-internal state.
     Alternative: a side-Map keyed by the (event, group-index,
     handler-index) tuple, populated alongside `parseHooksConfig`.
   - Recommendation: Side-Map is cleaner architecturally (keeps the
     domain `HookHandlerEntry` schema-shaped) but couples the bridge to
     handler iteration order. Field on `HookHandlerEntry` is simpler;
     mark it as a bridge-private extension (`Symbol`-keyed property?
     planner decides). Mirror Phase 58's parser/data shape — the
     simplest approach is likely a parallel Map produced by
     `parseHooksConfig` and consumed by the bridge.

4. **Whether to also write an integration test against a real
   `RoutingEntry` -> `reduceBucket` path** (vs unit-testing the if-field
   engine in isolation).
   - What we know: Phase 57 P04 / Phase 58 / Phase 59 / Phase 60
     pattern uses architecture tests with synthetic fixtures.
   - What's unclear: Whether the truth-table pin needs end-to-end
     coverage or whether `compileIfPredicate` + `ifFires` unit-test
     coverage suffices.
   - Recommendation: Mirror Phase 60's `hooks-exec.test.ts` approach
     (1 architecture test file, multiple block-scoped sections,
     synthetic spy executor). The end-to-end test isn't necessary if
     the seam is small and clean.

## Environment Availability

Phase 61 has no new external dependencies. All target deps already
declared:

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | runtime | ✓ | ≥20.19.0 (NFR-4) | — |
| TypeScript | typecheck | ✓ | `^5.9.x` (existing) | — |
| typebox | runtime / schema | ✓ | `^1.1.38` (existing) | — |
| `@earendil-works/pi-coding-agent` | peer dep | ✓ | `^0.73.x` (existing) | — |
| node:test | tests | ✓ | bundled with Node ≥20 | — |
| node:fs/promises / node:os / node:path | runtime | ✓ | bundled | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | `node:test` (built-in, ESM-strip via Node ≥22.18 or `tsx` loader) [VERIFIED: existing test infrastructure in `package.json` scripts] |
| Config file | none (node:test discovers test files via glob) |
| Quick run command | `node --test --import tsx tests/architecture/hooks-if-field.test.ts` (single file) |
| Full suite command | `npm run check` (typecheck + lint + format + full `node:test` run) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MATCH-03 §1 (Bash subcommand parsing, multiple subcommand match) | unit | `node --test --import tsx tests/architecture/hooks-if-field.test.ts -t 'bash subcommand'` | ❌ Wave 0 (NEW file) |
| MATCH-03 §1 (path-tool gitignore glob + 4 anchors) | unit | `node --test --import tsx tests/architecture/hooks-if-field.test.ts -t 'path-tool glob'` | ❌ Wave 0 |
| MATCH-03 §1 (MCP literal + server-prefix matching) | unit | `node --test --import tsx tests/architecture/hooks-if-field.test.ts -t 'mcp'` | ❌ Wave 0 |
| MATCH-03 §2 (Bash word-boundary `Bash(ls *)` vs `Bash(ls*)`) | unit | `... -t 'word boundary'` | ❌ Wave 0 |
| MATCH-03 §2 (`:*` trailing-sugar equivalence) | unit | `... -t 'colon sugar'` | ❌ Wave 0 |
| MATCH-03 §2 (specificity-override on `$()`/backticks/$VAR) | unit | `... -t 'specificity override'` | ❌ Wave 0 |
| MATCH-03 §3 (fail-open on unparseable Bash) | unit | `... -t 'fail open'` | ❌ Wave 0 |
| MATCH-03 §4 (AND composition with matcher) | integration | `... -t 'AND with matcher'` | ❌ Wave 0 |
| MATCH-03 §5 (bridge ignores `if` on non-tool events) | unit | `... -t 'non-tool event'` | ❌ Wave 0 |
| MATCH-03 §5 (architecture-test reproduces upstream truth-table verbatim) | architecture (closed-set introspection) | `... -t 'upstream truth table'` | ❌ Wave 0 |
| D-61-02 (every compile-failure mode falls open) | unit | `... -t 'compile fall-open'` | ❌ Wave 0 |
| D-61-03 (Read covers Pi `{read, grep, find, ls}`; substitute-cwd) | unit | `... -t 'cross-tool'` | ❌ Wave 0 |
| D-61-04 (process-wrapper strip exactness; `xargs` with-flags) | unit | `... -t 'wrappers'` | ❌ Wave 0 |
| HOOK_HANDLER_SCHEMA admits `if: Type.Optional(Type.String())` | typecheck + unit | `npx tsc --noEmit` + `... -t 'schema admits if'` | ✓ (existing schema file) — extended |

### Sampling Rate

- **Per task commit:** `node --test --import tsx tests/architecture/hooks-if-field.test.ts` (single file; ~<5s expected)
- **Per wave merge:** `npm run check` (full suite green)
- **Phase gate:** `npm run check` green + `tests/architecture/hooks-if-field.test.ts` exists and every truth-table row asserted

### Wave 0 Gaps

- [ ] `tests/architecture/hooks-if-field.test.ts` — NEW; covers MATCH-03 §1-5 + D-61-01..04. Single file with block-scoped sections (mirrors Phase 60's `hooks-exec.test.ts` 8-section layout).
- [ ] No new fixture directory needed if planner chooses inline truth-table fixtures (RECOMMENDED — matches Phase 58/59/60 precedent).
- [ ] Framework install: none — node:test is built-in.

## Security Domain

> security_enforcement is implicitly enabled in `.planning/config.json`
> (not disabled), so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | n/a (Phase 61 has no auth surface) |
| V3 Session Management | no | n/a |
| V4 Access Control | partial | The `if` field is a filter, not a security boundary. Upstream's own docs say "use the permission system rather than a hook to enforce a hard allow or deny." Phase 61 enforces NFR-10 containment indirectly (the four anchors resolve to normalized paths only used for glob comparison, never as a write target — no NFR-10 trip surface). |
| V5 Input Validation | yes | TypeBox `Type.Optional(Type.String())` on the `if` field is the validation surface at parse time. Beyond that, the `compileIfPredicate` function is the input-domain firewall: every malformed input collapses to `MATCH_ALL_IF` (no exceptions thrown into the resolver path). |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for `if`-field permission rules

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| **Shell command injection via `event.input.command`** (a plugin author writes `if: Bash(safe-cmd *)` thinking it constrains, but `safe-cmd && rm -rf /` matches as two subcommands; the bridge fires on `safe-cmd` only). | Tampering | This is upstream's documented behavior: compound separators split, each subcommand checked. The bridge fires the hook (Pi's user-confirmation prompt remains the authoritative deny gate). Upstream's note: "Bash permission patterns that try to constrain command arguments are fragile" — same applies to `if`. Documented in Pattern 3 leading comment. |
| **Catastrophic regex backtrack via crafted `if` patterns** (a malicious plugin could try `Read(((a+)+)+)` style nested alternation to wedge the bridge). | DoS | Hand-authored glob engine has no backtracking ambiguity — `**` is segment-bounded, `*` is segment-local, no alternation. Linear-time match against pattern length + input path length. |
| **Stack overflow via nested `$()`/backticks** in `event.input.command`. | DoS | Cap recursion depth at 8 in `parseBashSubcommands` (matches real bash's default). On overflow → `ok: false` → fail-open → hook fires (D-61-04). |
| **Path-traversal via `~/` / `//` anchors with `../` segments** (`Read(~/../../etc/passwd)`). | Tampering | Anchor resolves to `os.homedir()`; `../` segments resolve at parse time via `path.resolve` to a normalized absolute path. The resolved base is then used ONLY for glob comparison against `event.input.path` — never as a write target. NFR-10 has no trip surface. The plugin author can WRITE a glob that compares against `/etc/passwd`, but the hook firing on a tool_call to `/etc/passwd` is upstream-faithful behavior (the hook would then run a shell command — Phase 60's spawn surface enforces NFR-10 separately). |
| **Symlink follow / TOCTOU** on `event.input.path`. | Tampering | Bridge does NOT call `fs.realpath`. Treats the path as literal text. Upstream's permission-rule layer does the symlink check; the hooks `if` layer is documented as best-effort. Pitfall 6 documents the disposition. |

The `if` field is explicitly NOT a security boundary per upstream's own
documentation. Plugin authors who need a hard allow/deny must use Pi's
permission system, not a hook.

## Sources

### Primary (HIGH confidence)

- **`code.claude.com/docs/en/hooks-guide`** § "Filter by tool name and
  arguments with the `if` field" — verbatim truth-table fetched
  2026-06-15. The 5-row Bash truth table + fail-open language + version
  requirement + non-tool-event behavior all sourced here. Quote:
  *"The filter also fails open, running your hook regardless of pattern,
  when the Bash command cannot be parsed."* and *"`if` only works on tool
  events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `PermissionRequest`, and `PermissionDenied`. Adding it to any other
  event prevents the hook from running."*
- **`code.claude.com/docs/en/permissions`** § "Bash" / § "Process
  wrappers" / § "Compound commands" / § "Read and Edit" / § "MCP" —
  verbatim glob grammar + four anchors + word boundary + colon sugar +
  wrapper strip list + compound separators + symlink semantic + MCP
  forms. Fetched 2026-06-15.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/{bash,read,edit,write,grep,find,ls}.d.ts`
  — per-tool input shapes re-verified 2026-06-15; `path?` confirmed
  optional on grep/find/ls.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` — Phase
  57's HOOK_HANDLER_SCHEMA + parseHooksConfig (lines 75-92, 158-190).
- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` —
  Phase 58's TOOL-01 table.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` —
  Phase 58's bucket-A + TOOL_EVENTS tuples.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` —
  Phase 59's RoutingEntry (lines 76-91), flattenPluginIntoBuckets
  (260-294).
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` — Phase
  59/60's reduceBucket (163-204), insertion site at 170-176.
- `extensions/pi-claude-marketplace/shared/debug-log.ts` — Phase 59's
  hookDebugLog seam.
- `.planning/REQUIREMENTS.md` — MATCH-03 current wording (lines 31-39);
  amendment proposal in this RESEARCH.md § Code Examples.
- `.planning/phases/61-if-field-permission-rule-matcher/61-CONTEXT.md` —
  D-61-01..04 locks + canonical references + assumptions log.

### Secondary (MEDIUM confidence)

- `docs/research/claude-hook-config-syntax.md` § 7 — in-repo snapshot
  (2026-06-13) including the security-guidance handler audit row.
  Originally tagged ESCALATE; superseded by REQUIREMENTS.md MATCH-03
  IMPLEMENT promotion.
- `docs/research/claude-hooks-vs-pi-events.md` — event taxonomy /
  bucket-A definition / soft-dep audit. Indirect for Phase 61.

### Tertiary (LOW confidence)

- Phase 60 RESEARCH.md summary section — used to confirm the
  parse-time-compile precedent and the architecture-test single-file
  block-scoped pattern. Confidence: HIGH for the pattern; LOW for the
  exact line counts.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new deps, all targets pre-verified.
- Architecture (glob engine + Bash parser + dispatch insertion): HIGH —
  CONTEXT.md locks D-61-01..04 verbatim; upstream truth tables snapshot
  verbatim.
- Pitfalls: HIGH — 10 pitfalls drawn from upstream docs + Phase 58/59/60
  precedent; Pitfall 7 (non-tool-event disposition) is the highest-risk
  decision and is explicitly flagged in Assumptions Log.
- REQ amendment text: HIGH — drafted to land atomically with first
  Phase 61 commit per D-61-03; planner reviews and uses verbatim.

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (30 days; upstream Claude Code permission-rule
grammar has been stable since v2.1.85; planner should refetch on a minor-
version bump only).
