# Phase 61: `if` Field Permission-Rule Matcher - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 61-`if` Field Permission-Rule Matcher
**Areas discussed:** Glob engine, `if`-pattern parse-failure stance, Per-tool target field + missing-arg behavior (re-scoped to rule-prefix → Pi-event mapping mid-discussion), Bash command parser scope

---

## Glob engine

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-author | Write ~120-180 LoC in `bridges/hooks/if-field/glob.ts` covering exactly the surface we need: `*` / `**` / literal chars; 4 anchors at parse-time normalization; Bash trailing-space word-boundary handled inline. Zero new deps; surface exactly matches Claude's permission-rule semantics; architecture-test fixtures pin every truth-table row. | ✓ |
| Use `picomatch` | Add `picomatch` runtime dep (most-used micromatch core, zero deps itself, ESM-compatible). Configure with neutering options and add a thin adapter for the 4 anchors + Bash word-boundary. Violates the project's conservative dep stance; surface much larger than we need; outputs `RegExp` internally. | |
| Use `minimatch` | Add `minimatch` runtime dep (npm CLI's own glob lib; same neutering options needed). Same as picomatch on dep cost and oversized surface; slower than picomatch in benchmarks. | |

**User's choice:** Hand-author (Recommended)
**Notes:** Project's no-glob-libs stance + small surface (3 metacharacters + 4 anchors + Bash word-boundary) + Phase 58's deliberate regex rejection (MATCH-02) all argued for hand-author. The user accepted that future spec drift in Claude Code's rule grammar becomes a hand-edit, gated by upstream minor-version-bump re-audit.

---

## `if`-pattern parse-failure stance

### Initial framing (before upstream-doc evidence)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loud | Plugin flips `(unavailable) {unsupported hooks}` at parse time. Aligns with Phase 58's strict-supportability stance (D-58-01). Debug-log carries the specific `if`-syntax detail. | |
| Fail open (match-all) | Malformed `if` silently becomes match-all. Matches the runtime Bash fail-open ethos. Revives the silent over-fire scenario research doc §7 originally called out. | |
| Hybrid: fail-open install + fail-loud architecture test | Install-time silently match-all; architecture-test layer catches every form upstream rejects. | |

**User's response:** Asked "what does claude code do in case of bad syntax? and what is the reference documentation page for that?"

### Upstream investigation

Fetched https://code.claude.com/docs/en/hooks-guide § "Filter by tool name and arguments with the `if` field" and confirmed:

- "The filter also fails open, running your hook regardless of pattern, when the Bash command cannot be parsed. Because the filter is best-effort, use the [permission system] rather than a hook to enforce a hard allow or deny."
- "The `if` field requires Claude Code v2.1.85 or later. Earlier versions ignore it and run the hook on every matched call." — explicit precedent for silent match-all when the field can't be interpreted.
- "`if` only works on tool events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`. Adding it to any other event prevents the hook from running."
- No documented install-time validation pass; the entire field is framed as best-effort.

### Re-framed question (after upstream evidence)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail open (matches upstream) | Malformed `if` patterns silently become match-all. Debug-log the syntax error. Zero behavioral asymmetry with upstream; same plugin works identically in both hosts. | ✓ |
| Fail loud (plugin unavailable) | Phase 58 strict-supportability stance extended to `if`-pattern syntax. Portability regression: a plugin that installs fine in upstream Claude Code is rejected in Pi-Claude. | |
| Fail open + `ctx.ui.notify` warning at install | Match-all behavior matches upstream, but install-time notify cascade gets an extra warning line. Deviates from IL-2 and risks warning fatigue. | |

**User's choice:** Fail open (Recommended — matches upstream)
**Notes:** Upstream documents `if` as uniformly best-effort. Phase 58's strict-supportability stance applies to load-bearing CORRECTNESS gates (regex matchers, unmapped tools, unsupported events) where we'd silently over-fire or never-fire; `if` is a filter ON TOP of an already-supported entry and upstream's contract for it is loose. Locked decision applies to ALL `if`-layer failure modes (malformed syntax, unknown prefix, broken glob, unparseable Bash command).

---

## Per-tool target field + missing-arg behavior → re-scoped to rule-prefix → Pi-event mapping

### Initial framing (before upstream-doc evidence)

| Question | Description |
|----------|-------------|
| Grep target: `input.path` only / `input.path` then `input.glob` fallback / Defer to planner | Two sub-decisions about how to match `Grep(<glob>)` against Pi `grep` events given Pi grep has both `pattern` and `path`/`glob`. |
| Missing-target behavior: fail-open / substitute cwd / skip | What happens when the per-tool target field is absent on the event. |

**User's response:** Asked "where is grep documented for claude code?"

### Upstream investigation

Fetched https://code.claude.com/docs/en/permissions § "Tool-specific permission rules" and found:

- **`Grep` is NOT a documented permission-rule prefix.** Upstream documents `Bash` / `PowerShell` / `Read` / `Edit` / `Write` / `WebFetch` / `mcp__*` / `Agent` / `Cd` as the prefix set.
- "Read and Edit" section: "Claude makes a best-effort attempt to apply `Read` rules to all built-in tools that read files like Grep and Glob" and "`Edit` rules apply to all built-in tools that edit files."
- 4 anchors documented exactly as REQ says (`//abs`, `~/home`, `/project-root`, `./cwd`).
- MCP has THREE forms: `mcp__server` (server-prefix), `mcp__server__*` (explicit wildcard), `mcp__server__tool` (literal).
- Bash process-wrapper list documented verbatim — exact match for REQ MATCH-03 §2.

**User's clarification:** "we want to be upstream-faithful in the hook syntax in claude code plugins, because we aim to be compatible with claude code, not extend it. pi tools and events are different, so we need to match the tools and events that pi generates semantically to the claude code tools and events that would trigger the plugin hooks. if claude code has a 'multiedit' tool, and it triggers Edit(), and pi doesn't, but has 'edit', then we are good. likewise if claude code triggers Read() for reads that have the grep command, and pi has a 'grep' command, then we want that matcher/if to be registered for grep too"

### Locked decision

| Option | Description | Selected |
|--------|-------------|----------|
| Lock it as written (upstream-faithful prefixes + cross-tool mapping + substitute-cwd) | Bridge accepts only the 5 upstream prefixes (Bash/Read/Edit/Write/mcp__). `Read` covers Pi `{read, grep, find, ls}`; `Edit` covers `{edit, write}`; `Write` covers `{write}`. Targets always `input.path` / `input.command`. Missing path-target → substitute ctx.cwd. Unknown prefix → fail-open match-all + debug-log. REQUIREMENTS.md MATCH-03 amendment captured for planner. | ✓ |
| Lock it, but `Write` only → Pi `{write}` (not also Edit) | Cleaner separation, slightly less upstream-faithful. | |
| Lock it, but keep MATCH-03 unamended | Defers the amendment decision to the planner. | |

**User's choice:** Lock it as written (Recommended)
**Notes:** The clarification crystallized the load-bearing principle — upstream syntax compatibility means plugins are portable between hosts; Pi-semantic event mapping handles the (rare) cases where Pi's tool surface differs from Claude's. REQUIREMENTS.md amendment lands atomically with Phase 61's commit per the atomic-supersession lesson.

---

## Bash command parser scope

### Initial framing (before upstream-doc evidence)

Original gray area: REQ lists 6 process-wrappers to strip (`timeout`/`time`/`nice`/`nohup`/`stdbuf`/bare `xargs`). Real-world commands also have `env VAR=val cmd`, `sudo cmd`, `chronic cmd` (moreutils), `command cmd`, `\command` (escape-prefix), `script -qc cmd`. Each unstripped wrapper means `Bash(git *)` won't match `sudo git push` even when the security policy clearly intends it.

### Upstream investigation (already done in Area C)

Fetched https://code.claude.com/docs/en/permissions § "Bash" / § "Process wrappers" / § "Compound commands":

- Strip list verbatim: `timeout`, `time`, `nice`, `nohup`, `stdbuf`, bare `xargs` (no flags).
- Explicit non-strippers: `direnv exec`, `devbox run`, `mise exec`, `npx`, `docker exec`, `watch`, `setsid`, `ionice`, `flock`, `find -exec`, `find -delete`.
- `xargs -n1 grep pattern` matches as `xargs`, NOT `grep`.
- `find -exec rm {} \;` is matched against the LITERAL form — the `-exec` argument is NOT recursively parsed (different from `$()`/backticks).
- `:*` colon-sugar trailing-only; mid-pattern `:` literal.
- Compound separators verbatim: `&&`, `||`, `;`, `|`, `|&`, `&`, newline.

### Locked decision

| Option | Description | Selected |
|--------|-------------|----------|
| Upstream-verbatim | Strip exactly the 6-wrapper list. xargs-with-flags matches as xargs. `find -exec` opaque. Process substitution `<()` / `>()` treated as literal. Plugins fully portable; architecture test pins truth-table rows directly. | ✓ |
| Upstream-verbatim + process-substitution recursion | Same + recursively parse `<()` / `>()` as subcommands. Closes one shell-injection hole but documented behavioral divergence from upstream. | |
| Upstream-verbatim + defer edge cases to planner research | Lock the 6-wrapper strip list + xargs-with-flags / find-exec rules; defer process-substitution + any other doc-silent edges to research-time verification. | |

**User's choice:** Upstream-verbatim (Recommended)
**Notes:** Plugins fully portable; architecture test pins truth-table rows directly. The trade-off — `Bash(grep *)` won't fire on `xargs -n1 grep pattern` — is upstream's behavior, not a Pi bug.

---

## Claude's Discretion

- File split inside `bridges/hooks/if-field/` — REQ wording suggests 5 modules; planner picks actual file count based on cohesion vs line budget.
- Per-tool target-extraction table file placement — `domain/components/hook-if-targets.ts` (sibling to `hook-tool-names.ts`) or co-located. Planner picks based on file size.
- Compiled `IfPredicate` discriminated-union shape — `assertNever` exhaustiveness mandatory per NFR-7; field shape is planner's choice.
- `RoutingEntry` field name + optionality — always-present-with-sentinel vs. optional-undefined-as-match-all. Equivalent semantics; ergonomic choice.
- Architecture-test fixture layout — inline JSON pairs (Phase 57/58/59/60 pattern) vs. per-row fixture files. Planner picks.
- Truth-table snapshot strategy — planner fetches latest hooks-guide + permissions docs at research time, snapshots truth-table rows verbatim. Minor-version-bump re-audit recommended.
- `MATCH_ALL_IF` debug-log message format — minimum information: which `if` field failed and at which compile step.

## Deferred Ideas

- `PowerShell(...)` rule prefix support — v1.14+ (Pi has no PowerShell tool today).
- `WebFetch(...)` / `Agent(...)` / `Cd(...)` rule prefix support — bucket-E / Pi-incompatible / soft-dep; v1.14+ promotion gated.
- Pi-specific rule prefixes for narrower filtering — explicitly rejected per "upstream-faithful, not extend" stance.
- Pi-grep `glob` and Pi-find `pattern` as additional `if` targets — same rationale; Pi extension, not upstream.
- First-class `if`-field validation at install time (fail-loud opt-in mode) — would deviate from upstream; not on the v1.13 plate.
- `ctx.ui.notify` install-time warning for fall-open `if` patterns — IL-2 + warning-fatigue concerns; deferred indefinitely.
- Process-substitution `<()` / `>()` recursion — upstream doc-silent; treat as literal; v1.14+ may add if first-party plugin demand surfaces.
- REQUIREMENTS.md MATCH-03 amendment — planner action item; lands atomically with Phase 61's commit per atomic-supersession lesson.
