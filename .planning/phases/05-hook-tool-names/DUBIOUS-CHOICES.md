# Phase 5 (Hook Tool Names): Dubious Choices Log

The choices Phase 5 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with). Only the Phase 5 child session writes this file: each
subagent ends its report with `## Dubious Choices` (or "None"), and the
session copies every item here. Phase 6 merges this file into the root log.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 5 child session, 2026-11-04)

### P5-DC-01: Discuss decisions settled without the user

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the Phase 5 grey areas (tool identity, name form, matching, the
  proxy rule, scenarios, placement) are settled from Pi 1.5.0's source, this
  project's conventions, and Claude Code parity, per the user's instruction
  for this run (DC-01, P1-DC-01 precedent).
- **Alternatives:** stop and ask, as smart discuss would.
- **Why dubious:** each answer shapes what a hook sees. Each has its own entry
  below so the user can reverse it alone.
- **Recorded in:** `05-CONTEXT.md`.

### P5-DC-02: Claude's server form for every built-in server, not only plugin servers

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the hooks bridge names every built-in MCP tool
  `mcp__<registered server name>__<tool>`, reading the server name from the
  namespace alias Pi gives the tool. That covers a user's `mcp.json` servers
  too (D-P5-01, D-P5-02).
- **Alternatives:** (a) map only plugin servers, which needs the list of every
  installed plugin's servers at dispatch time (the hooks bridge has only the
  plugins with hooks); (b) leave non-plugin servers in Pi's folded form.
- **Why dubious:** MHK-01 names plugin MCP tools only. A plugin hook written
  for Claude Code sees `mcp__<server>__<tool>` with `-` kept for every server,
  so parity covers user servers too, and the alias is the one signal Pi
  gives for both.
- **Recorded in:** `05-CONTEXT.md` D-P5-01, D-P5-02.

### P5-DC-03: A matcher with Claude's tool name (with `-`) fires on the built-in tool

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** High. **Status:** open.
- **Choice:** a matcher or `if` literal `mcp__<server>__<tool>` fires when Pi
  1.5.0's `createMcpToolName(server, tool)` gives the event's tool name, so
  Claude's full name fires, `-` in the tool segment included (D-P5-04). The
  only divergence left in the tool segment is the `tool_name` the hook reads
  on stdin, which keeps Pi's fold.
- **Alternatives:** compare the matcher to the Claude-form name as it is, so a
  matcher must fold the tool segment itself (`__echo_text` for the tool
  `echo-text`), which is how D-MB-08's text and the ROADMAP criterion read
  ("only the tool segment's `-` to `_` fold differs").
- **Why dubious:** it reads D-MB-08's divergence as covering only what Pi
  cannot give (the original tool name on stdin), not the matcher, which the
  bridge can compute. Upstream parity favors it: a hook written for Claude
  Code names the real tool. It goes beyond the text of a decision pending the
  user's review.
- **Recorded in:** `05-CONTEXT.md` D-P5-04.

### P5-DC-04: A matcher with the folded tool segment also fires

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** `mcp__<server>__echo_text` fires on the tool `echo-text` under
  built-in, because Pi gives both spellings one name (D-P5-04).
- **Alternatives:** none that Pi's information allows; the original tool name
  is not in the tool list.
- **Why dubious:** upstream, that matcher fires only on a tool named
  `echo_text`. A server that offers both gets Pi's hash, and then only the
  hashed form's own spelling fires.
- **Recorded in:** `05-CONTEXT.md` D-P5-04.

### P5-DC-05: A name that Pi cuts inside the namespace stays in Pi's form

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** when Pi's 64-character cut falls inside `mcp__<namespace>__`,
  the hook's `tool_name` is Pi's cut name. Matchers still fire, because the
  matcher check computes Pi's cut and hash from the matcher (D-P5-02,
  D-P5-04).
- **Alternatives:** build `mcp__<server>__<something>` from the cut remainder,
  which is neither Claude's name nor Pi's.
- **Why dubious:** upstream sees the full name. Pi's cut is a Pi capability
  gap (D-MB-13); this keeps the name the model and Pi's own logs show.
- **Recorded in:** `05-CONTEXT.md` D-P5-02, D-P5-10.

### P5-DC-06: The proxy rule reads the active implementation, not the tool's source

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the D-CF5-12 proxy rule applies only when
  `softDepStatus(pi).mcpImplementation` is `adapter`, read once per bridge
  generation at the first proxy-shaped call (D-P5-06, D-P5-07).
- **Alternatives:** (a) apply it only when the tool named `mcp` or
  `mcp__<server>` was registered by pi-mcp-adapter (its `sourceInfo.source`),
  which is stricter but misses a fork that ADET-02 detects by its
  `mcp-adapter` command; (b) read the implementation at `session_start`,
  which adds probes beside the frozen run snapshot.
- **Why dubious:** with the adapter active, another extension's
  proxy-shaped tool still runs no hook, as today. MHK-02 words it "while the
  adapter is active", which this follows.
- **Recorded in:** `05-CONTEXT.md` D-P5-06, D-P5-07.

### P5-DC-07: Phase 1's `@adapter-only` hook scenario becomes a tagged pair

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the scenario keeps `@adapter-only`, now for the adapter's proxy
  de-dup (D-CF5-12, MHK-02), and gains an `@builtin-only` twin in the same
  file, where the `*` hooks also run on `tool_search` (D-P5-11). The
  shared, both-profile scenario lives in the new `mcp-tool-names.feature`.
- **Alternatives:** drop the `*` hooks so one scenario runs under both
  profiles, which loses the proof that the outer proxy call runs no hook.
- **Why dubious:** the brief says to remove the tags Phase 1 placed. The
  scenario's expectation differs by implementation, and the milestone rule
  for that case is a tagged pair in one file.
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-08: The tool-segment fold scenario uses a user `mcp.json` server and a Phase 5 stub

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the scenario that pins the `-` to `_` fold of the tool segment
  configures a server in Pi's own `mcp.json`, run by a new Phase 5 stub
  library whose tool has a `-` in its name (D-P5-09).
- **Alternatives:** (a) a plugin server, which needs the frozen stub to offer
  such a tool (a parent line) or the extension's registration from Phase 2,
  which merges after Phase 5; (b) a Phase 5 stand-in extension loaded from the
  agent's `extensions/` directory.
- **Why dubious:** MHK-01 speaks of a plugin MCP tool; this scenario's server
  is the user's. The fold is the same for both, and the plugin case is pinned
  for the server segment by the shared scenario.
- **Recorded in:** `05-CONTEXT.md` D-P5-09.

### P5-DC-09: `tool_search` keeps its Pi name in hooks

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** a `*` hook sees Pi's `tool_search` under its own name, not as
  Claude Code's `ToolSearch` (deferred idea).
- **Alternatives:** map `tool_search` to `ToolSearch` in the tool-name table.
- **Why dubious:** both are the deferred-tool discovery tool, so a matcher
  `ToolSearch` written for Claude Code does not fire. It is outside MHK-01 and
  MHK-02.
- **Recorded in:** `05-CONTEXT.md` Deferred Ideas.

## Research step (gsd-phase-researcher, 2026-11-04; adopted by the child session)

### P5-DC-10: The proxy rule reads the implementation through the notification snapshot

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** the bridge reads the active implementation through
  `openNotificationSnapshot(pi).softDeps.mcpImplementation`, not by calling
  `softDepStatus(pi)` itself; CONTEXT D-P5-06 now says so.
- **Alternatives:** call `softDepStatus` directly, as D-P5-06 first read.
- **Why dubious:** it changes how a discuss decision is carried out. D-JO-01
  (PROJECT.md) makes the notification run the only caller of
  `softDepStatus`; the answer and the probe counts are the same.
- **Recorded in:** `05-CONTEXT.md` D-P5-06, `05-RESEARCH.md`.

### P5-DC-11: The namespace prefix is `<namespace name>__`

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** the Claude-form name strips `<namespace name>__` from Pi's name;
  CONTEXT D-P5-02 is corrected.
- **Alternatives:** the first text, `mcp__<namespace name>__`, which never
  matches because Pi's namespace name already starts with `mcp__`.
- **Why dubious:** a decision's text was corrected after discuss.
- **Recorded in:** `05-CONTEXT.md` D-P5-02.

### P5-DC-12: The built-in twin's PostToolUse hook is a literal, not `*`

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** in the built-in half of the tool-use pair, only the PreToolUse
  hook is `*`; the PostToolUse hook names the tool in Claude's form.
- **Alternatives:** keep `*` for both, as D-P5-11 first said.
- **Why dubious:** a `*` PostToolUse row would pin `tool_search`'s result,
  which is Pi's own wording; the cucumber rules forbid stating upstream text,
  and the runs table must list every column.
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-13: The tool-use pair moves to `hook-demo`/`stub-server`

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** both halves of the Phase 1 scenario use names with `-`.
- **Alternatives:** keep `demo`/`stub` and record the twin as coverage only.
- **Why dubious:** it rewrites a Phase 1 scenario; with `demo`/`stub` the
  built-in twin passes on the Phase 1 tree and gives no red proof (D-P5-12).
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-14: A profile-aware step builds the model script

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** the shared `@mcp` scenario's model script is built by a step
  from `profileFor(...).toolName` (helper `features/lib/hook-mcp-calls.ts`).
- **Alternatives:** an `@adapter-only`/`@builtin-only` pair with literal
  scripts, which drops D-P5-08's single both-profile scenario.
- **Why dubious:** the cucumber rule says a feature file writes the whole
  script as literals (`world-and-stand-ins.md`); no literal works under both
  profiles, because the tool names differ.
- **Recorded in:** `05-RESEARCH.md`.

### P5-DC-15: Built-in tools are not excluded from the proxy rule under the adapter

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** no extra hardening: when the adapter and built-in MCP are both
  loaded, a built-in cut-name tool with a string `tool` input is still
  skipped as a proxy call.
- **Alternatives:** never treat a `builtin:mcp` tool as a proxy call.
- **Why dubious:** an edge case stays; the hardening goes beyond D-P5-06.
- **Recorded in:** `05-RESEARCH.md` Open Questions.

### P5-DC-16: Claude Code matcher differences stay out of scope

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** none acted on: Claude Code 2.1.318 treats a matcher of
  `[a-zA-Z0-9_|, -]` as a list of exact names (spaces and commas allowed) and
  any other matcher as an unanchored regex; this project accepts only
  `[A-Za-z0-9_|-]` and matches server prefixes with `startsWith`.
- **Alternatives:** widen the safe charset and match unanchored.
- **Why dubious:** two existing parity gaps stay.
- **Recorded in:** `05-RESEARCH.md`.

### P5-DC-17: Research probes ran cucumber on scratch feature files

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** probes ran `npx cucumber-js` on feature files outside
  `features/`; the plans reuse this for the red proofs (D-P5-12).
- **Alternatives:** red proofs from a temporary edit inside `features/`.
- **Why dubious:** not a documented harness use; it writes no repo file.
- **Recorded in:** `05-RESEARCH.md` Validation Architecture.

## Planning step (gsd-planner + gsd-plan-checker, 2026-11-04)

The plan checker passed the four plans with no issue and reported no dubious
choice. The planner's choices follow.

### P5-DC-18: Red proofs restore the Phase 1 product files in place

- **Phase / source:** Phase 5 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** after a task commits, the executor restores `bridges/hooks` and
  `domain/components/hooks` from `6404197` (the Phase 1 product code) into its
  working tree only, runs the scenario, restores from `HEAD`, and requires an
  empty `git status`. Plan 05-04 repeats the sweep on the final scenarios.
- **Alternatives:** a second worktree at the base plus `npm ci`; or the red
  run inside each task before its product change.
- **Why dubious:** it rewrites tracked files for a few minutes; guarded by
  commit-first and empty-status checks.
- **Recorded in:** `05-01-PLAN.md` to `05-04-PLAN.md`.

### P5-DC-19: The hook tool view is a defaulted handler parameter

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** `tools: HookToolView = createHookToolView(pi)` on both composite
  handlers, as the existing `executor` default.
- **Alternatives:** a required parameter, editing about 74 test call sites.
- **Why dubious:** the unit-test rules say not to default a parameter to a
  live boundary; the view only wraps the injected `pi` and reads nothing when
  created.
- **Recorded in:** `05-01-PLAN.md`.

### P5-DC-20: The cut-name scenario sits in `tool-use.feature`

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** D-P5-10's scenario lives beside the D-P5-11 proxy pair in
  `tool-use.feature`, not in `mcp-tool-names.feature`.
- **Alternatives:** the new feature file, as research suggested.
- **Why dubious:** layout only; it lets wave 2 run on disjoint files.
- **Recorded in:** `05-02-PLAN.md`.

### P5-DC-21: The shared scenario also pins a folded-server hook that must not run, and an `if` hook

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** beyond D-P5-08's three hooks, the scenario adds a hook whose
  matcher folds the server segment (expected not to run) and an `if` hook.
- **Alternatives:** only the three hooks D-P5-08 names.
- **Why dubious:** it pins the strict server segment (D-P5-04) in a scenario.
- **Recorded in:** `05-01-PLAN.md`.

### P5-DC-22: The fold scenario pins that the folded-tool literal fires

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** D-P5-09's scenario also asserts that `mcp__echo-server__echo_text`
  fires (the P5-DC-04 divergence).
- **Alternatives:** assert only the Claude-name hook.
- **Why dubious:** it makes a known divergence a tested contract.
- **Recorded in:** `05-03-PLAN.md`.

### P5-DC-23: The PreToolUse notice label gets its own `@mcp` scenario

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** a scenario pins the `PreToolUse:<Claude-form name>` label.
- **Alternatives:** unit coverage only (research called it optional).
- **Why dubious:** one more slow scenario.
- **Recorded in:** `05-03-PLAN.md`.

### P5-DC-24: No behavioral scenario for the no-implementation proxy case

- **Phase / source:** Phase 5 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** MHK-02's "none" case is covered by unit rows only.
- **Alternatives:** a harness extension registering a proxy-shaped tool with
  no MCP implementation, which needs a new stand-in.
- **Why dubious:** a part of MHK-02's wording has no cucumber scenario.
- **Recorded in:** `05-02-PLAN.md`.

### P5-DC-25: No identity cache; a failed tool read is debug-logged

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** one `getAllTools()` read per MCP tool event that has hooks, not
  cached (tools re-register on reconnect); a throwing read goes to
  `hookDebugLog`.
- **Alternatives:** a per-generation cache; a silent fallback.
- **Why dubious:** a small per-call cost; the log goes beyond D-P5-01's text.
- **Recorded in:** `05-01-PLAN.md`.

### P5-DC-26: Plan shape (four plans, dedicated gate plan, docs in wave 2, adapter half keeps its hook steps)

- **Phase / source:** Phase 5 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** 05-04 is a gate-only plan (01-14 precedent); the docs are written
  in wave 2 beside the MHK-02 code; the tracer task touches 9 files; the
  adapter half of the pair keeps the hook module's pi-mcp-adapter listing
  step; the view's `pi` type is `Pick<ExtensionAPI, "getAllTools" |
  "getCommands">` from the start; a `COVERAGE.md` declares no external API.
- **Alternatives:** fewer plans; docs after the code; split the tracer.
- **Why dubious:** process choices a reviewer may reverse cheaply.
- **Recorded in:** `05-01-PLAN.md` to `05-04-PLAN.md`, `COVERAGE.md`.

### P5-DC-27: CONTEXT decision bullets reformatted for the coverage gate

- **Phase / source:** Phase 5 planning; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** `- **D-P5-NN (title).**` became `- **D-P5-NN:** (title)`, the
  only shape GSD's decision-coverage gate parses; the text is unchanged.
- **Alternatives:** proceed past the blocking gate.
- **Why dubious:** a format edit to a discuss artifact after planning.
- **Recorded in:** `05-CONTEXT.md`.

## Execution wave 1 (plan 05-01, gsd-executor, 2026-11-04)

### P5-DC-28: The `if` field reads the Claude-form event from Task 1 on

- **Phase / source:** plan 05-01 (executor P5-01-DC-01).
- **Severity:** Low. **Status:** open.
- **Choice:** Task 1 already passes the hook event with the Claude-form name
  to the `if` check, so Task 2's mid-plan red run showed only the `after` row
  missing, not `iffed` too as the plan predicted. The red proof against the
  Phase 1 code shows both missing.
- **Alternatives:** give `ifFires` Pi's event in Task 1, so the `if` compares
  another name than the one on the hook's stdin.
- **Why dubious:** a plan's expected intermediate RED did not hold.
- **Recorded in:** `05-01-SUMMARY.md`.

### P5-DC-29: Dispatch unit cases written after the code; RED from restored sources

- **Phase / source:** plan 05-01 (executor P5-01-DC-02).
- **Severity:** Low. **Status:** open.
- **Choice:** the dispatch unit cases came after the implementation; RED
  evidence came from restoring the previous sources before each commit.
- **Alternatives:** strict test-first, as the plan ordered.
- **Why dubious:** a process deviation; the evidence is equivalent.
- **Recorded in:** `05-01-SUMMARY.md`.

### P5-DC-30: The call step takes single-quoted JSON

- **Phase / source:** plan 05-01 (executor P5-01-DC-03).
- **Severity:** Low. **Status:** open.
- **Choice:** the new call step takes its arguments as a single-quoted Gherkin
  string (`'{"text": "ping"}'`), the suite's first single-quoted `{string}`.
- **Alternatives:** escaped double quotes, or a data table.
- **Why dubious:** a new step-text style; `check:features` and both profiles
  accept it.
- **Recorded in:** `features/step_definitions/hook/tool-use.steps.ts`.

### P5-DC-31: Small typing choices in the view

- **Phase / source:** plan 05-01 (executor P5-01-DC-04, P5-01-DC-05).
- **Severity:** Low. **Status:** open.
- **Choice:** `createHookToolView`'s parameter already includes `getCommands`
  (used by 05-02); an explicit `namespace === undefined` check narrows the type
  and has a unit row. Task 1 also changed one line of `toolResultCompositeHandler`
  that Task 2 later replaced, because the new matcher signature forced it.
- **Alternatives:** `Pick<"getAllTools">` widened later; a non-null assertion.
- **Why dubious:** minor scope and typing deviations.
- **Recorded in:** `05-01-SUMMARY.md`.

## Execution wave 2 (plans 05-02 and 05-03, gsd-executor, 2026-11-04)

### P5-DC-32: Router cases count reads with a hand-written counter

- **Phase / source:** plan 05-02 (executor P5-02-DC-01).
- **Severity:** Low. **Status:** open.
- **Choice:** the router unit cases count inventory reads with a counter added
  to `makeRecordingPi` through `Object.assign`, not a strict strong-mock.
- **Alternatives:** a strict mock listing ~20 `pi.on` registrations; spies.
- **Why dubious:** departs from the strict-mock convention; totals are exact.
- **Recorded in:** `05-02-SUMMARY.md`.

### P5-DC-33: Dispatch proxy rows use a recording view stub

- **Phase / source:** plan 05-02 (executor P5-02-DC-02).
- **Severity:** Low. **Status:** open.
- **Choice:** the dispatch proxy rows drive a recording `HookToolView` stub;
  the inventory-to-answer mapping is pinned once in `mcp-tool-view.test.ts`.
- **Alternatives:** seeded adapter, built-in, and empty inventories per row.
- **Why dubious:** less end-to-end in the dispatch file.
- **Recorded in:** `05-02-SUMMARY.md`.

### P5-DC-34: Three guard cases that pass on any tree

- **Phase / source:** plan 05-02 (executor P5-02-DC-03).
- **Severity:** Low. **Status:** open.
- **Choice:** two empty-bucket cases and "registering the bridge reads neither
  Pi's tools nor its commands" are kept as guards, not RED evidence.
- **Alternatives:** drop them (the factory-time ban already covers it).
- **Why dubious:** tests with no red proof.
- **Recorded in:** `05-02-SUMMARY.md`.

### P5-DC-35: Scenarios pin the `*` row on `tool_search`; one acceptance count missed

- **Phase / source:** plan 05-02 (executor P5-02-DC-04, P5-02-DC-05).
- **Severity:** Low. **Status:** open.
- **Choice:** the built-in twin and the cut-name scenario pin a `*` row on
  Pi's `tool_search` under that name (renaming to `ToolSearch` later would
  change these rows, P5-DC-09). `createHookToolView` appears twice in
  `event-router.ts` (import and call) where the plan counted one.
- **Alternatives:** no `*` hook in the twin; an aliased import to hit the count.
- **Why dubious:** a deferred parity gap becomes a pinned row; a criterion
  mismatch with no behavior change.
- **Recorded in:** `05-02-SUMMARY.md`.

### P5-DC-36: Plan 05-03 doc and step details

- **Phase / source:** plan 05-03 (executor P5-03-DC-01..04).
- **Severity:** Low. **Status:** open.
- **Choice:** (1) the doc cites `tool-use.feature` for the proxy rule under
  each implementation, true only after the wave merged; (2) the `mcp.json` step
  also fails if a profile Pi already started and removes the file at scenario
  end; (3) the notice scenario compares only the notices (the stdin name is
  pinned by the shared scenario); (4) the doc states Pi's cut as "longer than
  64 characters, cut and ended with a hash", without the 55-character rule.
- **Alternatives:** cite only `mcp-tool-names.feature`; a bare `wx` write;
  also compare runs; state the exact rule.
- **Why dubious:** small precision and scope choices.
- **Recorded in:** `05-03-SUMMARY.md`, `docs/hooks-compatibility.md`.

## Execution wave 3 (plan 05-04 gate, gsd-executor, 2026-11-04)

### P5-DC-37: Gate-plan shortcuts and drafted parent lines

- **Phase / source:** plan 05-04 (executor P5-04-DC-01..05).
- **Severity:** Low. **Status:** open.
- **Choice:** (1) after the red sweep restored HEAD, only the two hook feature
  files were re-run under both profiles, not the whole 17-minute gate (same
  inputs, gates.md); (2) the 20 untagged `tool-use.feature` rows are proven by
  the run total, not a per-scenario list; (3) `/tmp/jiti` was not cleared before
  the sweep, since every run that had to fail failed; (4) the parent lines are
  drafts in the executor's words; (5) the post-Phase-2 re-run note asks that
  Phase 2 keep Pi's namespace alias equal to the registered name, a condition no
  frozen interface states.
- **Alternatives:** a full gate rerun; a JSON formatter; clearing the cache;
  verbatim decision text.
- **Why dubious:** process shortcuts and an unfrozen cross-phase assumption.
- **Recorded in:** `05-04-SUMMARY.md`.

## Code review and fix step (gsd-code-reviewer + gsd-code-fixer, 2026-11-04)

The review found no Critical issue, 1 Warning, and 5 Info items; all six are
fixed (`05-REVIEW.md`, `05-REVIEW-FIX.md`).

### P5-DC-38: A folded tool segment does not fire on a hashed name

- **Phase / source:** code review WR-01.
- **Severity:** Medium. **Status:** open.
- **Choice:** the docs and the contract now say a matcher with the tool
  segment folded fires only when Pi did not hash the name; a name over 64
  characters, or one that another tool of the server already sanitizes to,
  fires only on Claude's full name (with `-`). The behavior cannot change: a
  folded segment cannot recover the hash of the original name. P5-DC-04 is
  narrowed accordingly.
- **Alternatives:** none that Pi's information allows.
- **Why dubious:** a hook written with the folded name silently never fires on
  such tools.
- **Recorded in:** `docs/hooks-compatibility.md`, `builtin-mcp-tool-names.ts`.

### P5-DC-39: A server-prefix matcher compares the server name exactly under built-in

- **Phase / source:** code review IN-02.
- **Severity:** Low. **Status:** open.
- **Choice:** under built-in MCP, `mcp__<S>__.*` fires only when `<S>` is the
  registered server name; for a server named `a__b`, `mcp__a__.*` fires in Claude
  Code and under pi-mcp-adapter (a plain prefix test) but not under built-in.
  Documented only.
- **Alternatives:** a plain prefix test on the Claude-form name.
- **Why dubious:** a parity gap for server names containing `__`.
- **Recorded in:** `docs/hooks-compatibility.md`.

### P5-DC-40: The first proxy-rule answer is kept per generation, even a failed read

- **Phase / source:** code review IN-01.
- **Severity:** Low. **Status:** open.
- **Choice:** documented, not changed: if the first read fails under
  pi-mcp-adapter, the view keeps `false` until `/reload`, so proxy calls run
  their hooks twice. `softDepStatus` reports a failed read as "not loaded", so
  the view cannot tell the two apart.
- **Alternatives:** re-read on every proxy-shaped call.
- **Why dubious:** an unlikely failure has a session-long effect.
- **Recorded in:** `mcp-tool-view.ts`, `docs/hooks-compatibility.md`.

### P5-DC-41: Review cleanups (unreachable check removed, shared prefix constant)

- **Phase / source:** code review IN-03..IN-05.
- **Severity:** Low. **Status:** open.
- **Choice:** removed the empty-tool-segment check that both literal parsers
  already make unreachable (two bare-prefix unit rows kept); `MCP_TOOL_PREFIX`
  is exported from the domain module and imported by `dispatch.ts` and
  `mcp-tool-view.ts` (the `matcher.ts` and `if-field` literals left as they
  were); a stale `matchValue` comment fixed.
- **Alternatives:** keep the defensive check; leave three constants.
- **Why dubious:** removing a defensive check; a new export.
- **Recorded in:** `05-REVIEW-FIX.md`.
