# Phase 6 — Probe Coverage Record

No external API integration: the phase changes what an existing Pi extension sends to plugin hooks and admits one more Claude Code hook event; it adopts no new API, SDK, or service.

The changes are more stdin fields, the session a child's hook names, the source of a launch, and the `UserPromptExpansion` event.

Pi is the host of the extension and Claude Code is the parity reference. Neither is a service that the phase integrates: the phase reads more of Pi's existing extension interface (the tool call id, the session manager, the thinking level, the `input` event) and copies observable rules of Claude Code 2.1.323. pi-subagents and pi-mcp-adapter are companion extensions that earlier phases already integrated; from the first the phase reads one environment variable that it already sets in a child, and from the second nothing new. The plan-phase run did not run the detector. Run by the planner on 2026-11-14 over the Phase 6 roadmap section and over the plan bodies, and again over the thirteen plan bodies of the revised set, it returns `detected: false` each time, and `check api-coverage.verify-pre` passes on this declaration. No matrix row is written.

## Edge coverage (spec-less fallback)

No phase SPEC exists, so the plan-phase fallback ran the deterministic edge probe over the three requirement texts of `REQUIREMENTS.md`. It proposed 4 applicable rows, two of them unclassified. Each row is resolved here by the `--auto` rules: a row with a defensible acceptance criterion is resolved with explicit verification and lifted into `must_haves.truths` as a plain string; an unclassified row stays unresolved and becomes a flagged assumption. No row is dismissed, and no row needed a backstop.

| Requirement | Category | Probe | Status | Verification | Acceptance criterion (the lifted truth) | Lifted to |
|---|---|---|---|---|---|---|
| PG-HOOK-04 | unclassified | unclassified, review manually | unresolved | none | None authored. The taxonomy could not classify the requirement. | Flagged assumption in 06-02 |
| PG-HOOK-06 | empty | What is the result for empty, single-element, or null input? | resolved | explicit | A typed line with no arguments sends `command_args` as the empty string and `prompt` as `/<name>` with no trailing space. An empty matcher and `*` run the hook for every typed template and skill. A line that is plain text, a `/name` that Pi does not list and no alias resolves, and a `/skill:<name>` that Pi does not list run no hook. A block with no reason shows Claude Code's default reason, an exit 2 with no stderr shows `No stderr output`, a `continue: false` with no `stopReason` shows `Operation stopped by hook`, and an empty or blank context adds nothing. | 06-08 truths (the stdin); 06-10 truths (the notices, the context); 06-12 truths (the typed line); owner cases in 06-08-01, 06-10-02, and 06-12-02; the Outline row "command with no arguments" of 06-12-02 |
| PG-HOOK-06 | encoding | Whose definition of length or equality applies: bytes, code points, grapheme clusters, or normalized form? | resolved | explicit | An exact-list member equals `command_name` by JavaScript string equality: case-sensitive, with no Unicode normalization. A regular expression is a JavaScript `RegExp` with no flags, tested against the same string. The typed token is the text between the leading `/` and the first whitespace, as Pi splits it. The 10,000 limit of a context string counts JavaScript string units. | 06-08 truths (the parse of a matcher); 06-10 truths (the comparison with `command_name`, the limit); 06-12 truths (the token and the name comparison); owner cases in 06-08-01, 06-10-02, and 06-12-02 |
| PG-HOOK-11 | unclassified | unclassified, review manually | unresolved | none | None authored. The taxonomy could not classify the requirement. | Flagged assumption in 06-03 |

**Rollup:** 4 applicable; 2 resolved, both with explicit verification; 0 backstop; 0 dismissed; 2 unresolved, which are the unclassified rows.

**No-silent-drop equality:** 4 surfaced = 2 rows authored into `must_haves.truths` + 2 flagged assumptions.

### Flagged assumption: PG-HOOK-04, unclassified

The row is not resolved and not dismissed. Plan 06-02 carries it as a flagged assumption and lists the edges the phase covers by decision: an id on a nested call; the pairs of one edit; a call with one pair; a result with no start mark; a parallel batch; a tool that is not an MCP tool; an MCP tool of no plugin; two plugins that claim one server key; a compaction with no instructions and an automatic one; no model; no session name; the thinking levels `off` and `minimal`; a child with no root source; a child with no identity; a nested child. The verifier reviews that list against D-PG6-04 to D-PG6-12 and keeps the flag if it finds an uncovered edge.

### Flagged assumption: PG-HOOK-11, unclassified

The row is not resolved and not dismissed. Plan 06-03 carries it as a flagged assumption and lists the edges its tasks cover by decision: a new session with its two setting entries; a session with one message; an opened file; a fork made now; a fork continued later; a header with no `parentSession`; a `timestamp` that does not parse; a read that throws; a repeated `session_start`; an in-session `new`, `resume`, and `fork`; a reload; a child. The verifier reviews that list against D-PG6-13 to D-PG6-17 and keeps the flag if it finds an uncovered edge.

## Prohibition recall (spec-less fallback)

The two-stage recall ran in the planner for each requirement. Stage 1 asked what the feature could silently become that the author would not want and the decisions do not forbid. Stage 2 dropped routine engineering items and kept values, safety, and transparency items. A kept item that is canon security is not minted; it gets a breadcrumb.

| Requirement | Stage 1 candidates dropped as routine engineering | Canon breadcrumbs | Kept |
|---|---|---|---|
| PG-HOOK-04 | A made-up id or duration when Pi gives none; a field sent with an empty value where Claude Code leaves it out; an `effort` for a thinking level outside Claude's set; a fixed `permission_mode`; `mcp_server` for a tool whose server the bridge cannot tell; two pairs of one edit with one id. Each is an explicit contract of D-PG6-04 to D-PG6-12 and a truth of plans 06-02, 06-04, 06-05, 06-06, and 06-11. | A forged or path-shaped launch variable, a read of the launcher's session file, and state shared by two children are canon: covered by T-06-17, T-06-18, T-06-19 and `/gsd-secure-phase`; not minted here. A tool that reads as another plugin's server is spoofing: T-06-12. | one, below |
| PG-HOOK-06 | A hook that runs for a command the model started; a hook that runs twice for one line; a hook told another name than the command that expands; a context under another event's label; an expansion hook in a child. Each is an explicit contract of D-PG6-18 to D-PG6-22 and a truth of plans 06-08, 06-10, and 06-12. | A command that expands after a hook blocked it, a plugin's regular expression, a context flood, and a guard skipped under a failed name table are canon: covered by T-06-23, T-06-24, T-06-25, T-06-28 and `/gsd-secure-phase`; not minted here. | one, below |
| PG-HOOK-11 | `resume` for a new session; `fork` for a fork made by an earlier launch; a read outside Pi's own session manager; a `SessionStart` run added or removed by the detection. Each is an explicit contract of D-PG6-13 to D-PG6-16 and a truth of plan 06-03. | A spike or a scenario that writes a session into the real home is canon: covered by T-06-01, T-06-08 and `/gsd-secure-phase`; not minted here. | none |

### Kept prohibitions

| Requirement | Category | Statement | Status | Verification | Authored in |
|---|---|---|---|---|---|
| PG-HOOK-04 | safety | MUST NOT send the launching session's `session_id` on a child tool hook that carries no `agent_id`: a child's hook run must never read as a run of the main session. | resolved | judgment | `must_haves.prohibitions` of plan 06-09, with no wired-check descriptor |
| PG-HOOK-06 | transparency | MUST NOT leave a user believing that an installed plugin's `UserPromptExpansion` hooks run before its next `update` or `reinstall`: the CHANGELOG entry and the compatibility page both say that a plugin installed earlier needs one of the two. | resolved | judgment | `must_haves.prohibitions` of plan 06-13, with no wired-check descriptor |

D-PG6-01 gives a child's hook the launcher's session, and D-PG6-02 gives the fallback when no source names it. Neither says what a child sends when its own agent identity is unknown. A plugin tells a subagent's tool call from a main-session one by `agent_id`, so a run with the launcher's `session_id` and no `agent_id` would be read as the user's own session; the item is kept. D-PG6-21 says an installed plugin gets its dropped group at the next `update` or `reinstall`, and D-PG6-23 lists the passages to correct; neither says the user must be told. A user who reads "supported" expects a guard that an earlier install does not have, so the item is kept. Both are authored descriptor-less, so they dispose flagged and unverified for judgment review. No check path was fabricated, and nothing was auto-dismissed.

**No-silent-drop equality:** 2 kept = 2 authored into `must_haves.prohibitions`.

## Research findings adopted as defaults

Each finding of `06-RESEARCH.md` that corrects a decision of `06-CONTEXT.md` is taken as a reversible default and is pending maintainer review.

| ID | Finding | Carried by |
|---|---|---|
| F1 | `UserPromptSubmit` carries no `effort` upstream; the events are the three tool events, `Stop`, and `StopFailure`. | Plan 06-11 |
| F2 | Pi 1.5.0 has a `max` thinking level, which passes as `max`. | Plan 06-11 |
| F3 | Neither source names the root for a nested child. | Plan 06-07: one hop, the child's launcher. No variable is published on `process.env`, which is the smallest reversible option against D-PG3-06; research's Pattern 1 stays an alternative. |
| F4 | The launch variable can hold a file path. | Plan 06-07: a value with a path separator is rejected. |
| F5 | Pi has no usable start mark for a tool's run. | Plan 06-04: the bridge marks the end of its own `PreToolUse` hooks. |
| F6 | The plugin server's name is `plugin:<plugin>:<server>`, confirmed in code. | Plan 06-05 |
| F7 | A new session is not empty at `session_start`. | Plans 06-01 and 06-03: the rule tests for a `message` entry. |
| F8 | `parentSession` stays in a fork's header for the life of the file. | Plans 06-01 and 06-03: `fork` only for a header no older than the process. |
| F9 | `UserPromptSubmit` runs first, and a block runs no expansion hook. | Plans 06-10 and 06-12 |
| F10 | The values of `command_source`; `prompt` with no trailing space; `command_args` required. | Plans 06-08 and 06-12 |
| F11 | Upstream adds `Original prompt:` to the block text. | Plan 06-10: left out, as on `UserPromptSubmit`. |
| F12 | A child's Bash command reads its own session id from `process.env`. | Plan 06-09 leaves `applySessionEnv` as it is; plan 06-13 states the difference. |

## Research assumptions that stay flagged

| ID | Assumption | Carried by |
|---|---|---|
| A1 | Pi 1.5.0 behaves at run time as its source reads for `--continue`, `--session`, and `--fork`. | Plan 06-01 is the check. Plan 06-03 has a precondition on the spike's Result section and chooses its rule from it. |
| A2 | The header `timestamp` against the start of the process separates a fork that this launch made from an older fork. | Plan 06-01 measures it. If it does not hold, plan 06-03 gives `--fork` no source of its own and flags why D-PG6-15's fallback to `startup` cannot be kept as written. |
| A3 | The callback in the binary's dispatcher that runs before the expansion is the `UserPromptSubmit` check. | Plan 06-10: the order follows the documentation; only the weight of the evidence depends on it. |
| A4 | A Pi template or skill of the `temporary` scope has no fitting upstream `command_source`. | Plan 06-12: the field is left out. |
| A5 | Publishing two variables in a child process is acceptable under D-PG3-06. | Not relied on. Plan 06-07 publishes nothing. |
| A6 | A plugin's MCP servers reach Pi only on a load, so a table built at hydrate time is never staler than the tools. | Plan 06-05 |
| A7 | The upstream Bash tool in a subagent sees the main session's `CLAUDE_CODE_SESSION_ID`. | Plan 06-13: the page states the bridge's behavior as a difference that is not settled; a parent line asks for a BACKLOG item. |
| A8 | Pi 1.5.0 accepts a session file written by hand. | Plan 06-01 measures it; the fixture of plan 06-03 follows the answer. |

## Planner findings and choices that stay flagged

Read in the Claude Code 2.1.323 binary on 2026-11-14, not seen in a run:

| ID | Finding | Carried by |
|---|---|---|
| PL1 | A context of the event is labeled with the event's own name, `UserPromptExpansion hook additional context:`. | Plan 06-10: a buffered context carries its event. |
| PL2 | The event's runner gives the hook runner no match query, so a notice names the hook `UserPromptExpansion` alone. | Plans 06-08 and 06-10 |
| PL3 | The missing-script rule covers `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`, and a plugin's `UserPromptSubmit`, not this event. | Plans 06-08 and 06-10: an exit 2 of a missing script blocks. |
| PL4 | The event is in the set whose exact lists may hold `,`, spaces, and `-`; the default timeout is 600 seconds; `prompt` is built from the command's own name. | Plans 06-08 and 06-12 |

Choices the planner made where no decision speaks, each reversible and pending maintainer review:

| Choice | Carried by |
|---|---|
| A child with no agent identity keeps its own session fields. | Plan 06-09, with the kept prohibition |
| `mcp_server` is left out for an MCP tool of no plugin (open question 2 of the research). | Plan 06-05; plan 06-13 states it |
| When the fork test fails, `--fork` reads `resume`. | Plan 06-03 |
| `prompt` is rebuilt from the Claude-form name, so it differs from the typed text for a form only Pi has. | Plans 06-08 and 06-12 |
| A bridged command is reported under its Pi name where that differs from Claude Code's name. | Plan 06-12; PG-CMD-09 of Phase 11 covers the alias |
| A name table that cannot be loaded degrades to Pi's command list; it does not refuse the typed line. | Plan 06-12 |
| The admitted event has no handler for two plans: the composite handler's event domain leaves it out until plan 06-10, and no resolver is injected until plan 06-12. Nothing ships between them. | Plans 06-08 and 06-10 |
| A child's launching session is resolved and kept one plan before a hook reads it. | Plans 06-07 and 06-09 |
| The two resolved edge rows and the two kept prohibitions above. | This record |

## Size

The advisory budget is 100,000 tokens for a plan (`estimate-check`, calibration factor 1, no sample yet, so every estimate has low confidence). The first plan set had eleven plans in seven waves, and four of them were above the budget: 06-02 (122,000), 06-07 (128,000), 06-09 (158,000), and 06-10 (108,000). The plan checker asked for a split of the largest and for a split or a stronger reason for the others. The revised set has thirteen plans in eight waves. Two plans were split, and two stay above the budget with the reasons below.

### Split: the `UserPromptExpansion` plan (158,000, one task of 31 files)

It is plans 06-08 (74,000) and 06-10 (94,000) now.

- The seam is what the compiler forces. One new member of the event union fails the build in every table keyed by the event set, so the admission is one commit: the union, the tables, the parse of a name matcher, the translator, and the two gates that count events. That is plan 06-08, one task of 29 files, most of which change by a table row, a list member, or a case.
- The handler is not forced. Five switches of `bridges/hooks/dispatch.ts` are keyed on `CompositeDispatchEvent`, which is the event set minus the events that other handlers serve. Plan 06-08 names the new event in that `Exclude`, so no switch needs an arm, the commit builds, and it covers every line it adds. Plan 06-10 takes the event out of the `Exclude`, and the compiler then asks for each arm.
- Plan 06-10 is three commits of 9, 8, and 4 files: the buffer's event (a refactoring), the handler that `compositeHandlerFor` can serve, and the `input` registration with the two gates that pin 14 registrations.
- Each commit is green. Plan 06-08 sees its two scenarios red first (`info` and an install without `--partial`). Plan 06-10 changes nothing a user can see, because no resolver is injected before plan 06-12, so it ships no scenario: its failing-first proofs are owner cases and gates run red before the production change, and each task runs the prompt and alias features unedited. The scenarios of the block, the stop, the context, and the order are seen red in plan 06-12, as before.
- The cost is one wave: 06-08 in wave 5, 06-10 in wave 6, 06-12 in wave 7.

### Split: the child session plan (128,000, a second task of 23 files)

It is plans 06-07 (76,000) and 06-09 (58,000) now. A clean seam exists, so the plan was split and not defended.

- Plan 06-07 holds what changes nothing a hook reads: the harness that can state a real child's session fields, with the control reading on the unchanged production tree, and the resolution of the launching session, which is kept in the hooks runtime beside the child's identity. Its second task proves its own seam: the dispatch lanes' owner tests and both real-child tests pass unedited.
- Plan 06-09 holds what cannot split: the dispatch context with a hook-facing session and an own session id, the env layer, the journal key, the two translator guards, and the real-child literals turn together, because a context with one id cannot serve both sides. It sees the real-child scenario red on the control reading of plan 06-07.
- The split costs no wave. Plan 06-09 shares only `bridges/hooks/dispatch-exec.ts` and `bridges/hooks/async-rewake/registry.ts`, with their tests, with plan 06-08, so it runs after it and beside plan 06-10 in wave 6.

### Kept whole: plan 06-02 (122,000)

- Its first task cannot split. `recordTable` adds every stdin member that a table leaves out, so `tool_use_id` makes each of the 101 tables that hold a tool event fail until the table states the column. The field, the token library, and the tables must be one tree for the commit hook's gates and for the wave gate. The sweep is scripted and checked by removing the column again; the executor reads `features/hook/tool-use.feature` only where it adds the scenario.
- Its second task, the id of each edit pair, could be a plan of its own, and that was weighed. It shares `bridges/hooks/dispatch.ts` and `features/hook/tool-use.feature` with plans 06-04 and 06-05, and the token library with plan 06-04. Beside plan 06-03 in wave 2 it would move plan 06-04 and every later wave back by one. In wave 4, after both sweeps, it would change pair rows in tables that the duration and server sweeps had just rewritten, and for three waves two pairs of one edit would send one id, which D-PG6-05 rules out. It also finishes the decision the first task starts, on the tables and the library that task has just built.
- The second task is the planned hand-over point if the first runs long: one commit of 10 files that starts from a green tree.

### Kept whole: plan 06-12 (108,000)

- It is 8% above a budget whose estimates have no calibration sample. No task of it is large: its three commits hold 4, 7, and 1 files, and each stands alone.
- The cache refactoring shares no file with another plan, so it could move. It stays because the resolver of the next task is written against the cache as built, in the same context; a plan of its own would add a context load and a summary hand-off for a 4-file refactoring.
- The third task is one feature file whose five red runs need the working tree of the second task. A plan of its own would add a wave. It is the planned hand-over point if the first two tasks run long: it changes no source file.

In `--auto` mode more plans were preferred over a phase split.
