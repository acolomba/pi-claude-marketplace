# Phase 6 (MCP Servers): Dubious Choices Log

Choices made without the user in the Phase 6 child session
(`features/component-features-phase-6`). Same shape as the root
`.planning/DUBIOUS-CHOICES.md`; the parent merges these entries into it.
Severity: High changes what a user sees or diverges from upstream; Medium is a
judgment call a reviewer may reverse at low cost; Low is process, naming, or
tooling. Status stays `open` until the user reviews it.

## Entries

### P6-DC-01: MCP server sources merge as upstream (MC-1 superseded)

- **Phase / source:** Phase 6 smart discuss (D-CF6-01, FG-27).
- **Severity:** High. **Status:** open.
- **Choice:** A plugin's MCP servers become the union of `.mcp.json` and the
  declared `mcpServers` values, with a later same-name server replacing an
  earlier one, replacing PRD MC-1's "first match wins, no merge".
- **Alternatives:** Keep MC-1 and record it as a licensed divergence.
- **Why dubious:** MC-1 is a recorded PRD requirement, so it could count as
  a license; it was not chosen for an implementation reason, so parity wins
  under the user's instruction. Plugins that declared the same server in two
  places now install more servers than before.
- **Upstream evidence:** binary 2.1.316 manifest schema text "MCP servers to
  include in the plugin (in addition to those in the .mcp.json file, if it
  exists)"; plugins reference "mcpServers".
- **Recorded in:** `06-CONTEXT.md` D-CF6-01.

### P6-DC-02: One malformed server is skipped, not the whole plugin

- **Phase / source:** Phase 6 smart discuss (D-CF6-02, FG-28).
- **Severity:** High. **Status:** open.
- **Choice:** Skip a malformed server with an install warning and install the
  rest of the plugin, as upstream does.
- **Alternatives:** Keep `(unavailable) {malformed mcp}` for the whole plugin
  and give it a decision ID.
- **Why dubious:** The docs cite ANAME-07 as the license, but ANAME-07 covers
  unsupported transport features, not malformed servers; a reviewer may read
  "a malformed component makes a plugin unavailable everywhere" as a project
  principle worth keeping.
- **Upstream evidence:** docs (mcp "Invalid server configs"), to be confirmed
  on the binary by the phase researcher.
- **Recorded in:** `06-CONTEXT.md` D-CF6-02.

### P6-DC-03: Project-scope plugin servers keep adapter approval

- **Phase / source:** Phase 6 smart discuss (D-CF6-03, FG-29).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep the adapter's project trust (a headless session needs the
  user-global `projectServers: "allow"`) as a licensed divergence, and pin
  the blocked cases.
- **Alternatives:** Write the adapter's approval file at install (outside
  NFR-10's write set); install project-scope servers into the user file.
- **Why dubious:** Upstream never asks to approve a plugin server, so a
  project-scope plugin user sees a prompt or a blocked server that Claude
  Code users never see.
- **Upstream evidence:** docs (Claude Code asks only for project `.mcp.json`
  servers); adapter 7.0.0 `project-server-trust.ts`.
- **Recorded in:** `06-CONTEXT.md` D-CF6-03.

### P6-DC-04: Phase 6 adds its own stand-ins and agent fixture writer

- **Phase / source:** Phase 6 smart discuss (D-CF6-06, D-CF6-07).
- **Severity:** Low. **Status:** open.
- **Choice:** New stand-ins (such as a loopback HTTP MCP server) live in
  Phase 6-owned `features/lib/mcp-server-*.ts` files, and the MCP-07 agent is
  written by a helper in `mcp-server-files.ts`, not by `agent-files.ts`.
- **Alternatives:** Extend the frozen stub (a parent line); import Phase 4's
  `agent-files.ts`.
- **Why dubious:** The ownership table names only `mcp-server-files.ts` for
  Phase 6's lib; new `mcp-server-*` files widen it. Writing an agent outside
  `agent-files.ts` duplicates a little fixture code.
- **Recorded in:** `06-CONTEXT.md` D-CF6-06, D-CF6-07.

### P6-DC-05: Commit trailer names this child session

- **Phase / source:** Phase 6 child session, git.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits end with `Claude-Session:
  https://claude.ai/code/session_01EDUMG6ciPE7kp9aMmHch1m` (this child
  session, as the session's own attribution reminder gives), not the parent's
  `session_01EDUMG5ARYqF6oZYKmj6oB3` that the brief prints.
- **Alternatives:** Copy the brief's trailer verbatim.
- **Why dubious:** The brief says "exactly"; the trailer is meant to point at
  the session that made the commit, which is this one.
- **Recorded in:** this file; every Phase 6 commit.

### P6-DC-06: AI-integration planning step skipped on a keyword match

- **Phase / source:** Phase 6 plan-phase, plan:pre `ai-integration` hook.
- **Severity:** Low. **Status:** open.
- **Choice:** The hook fires because the phase goal says "agents"; the
  phase tests MCP tool calls with a scripted model and builds no AI system,
  so no AI-SPEC.md is generated (as DC-11 did for the UI contract).
- **Alternatives:** Run `/gsd-ai-integration-phase 6`.
- **Recorded in:** this file.

### P6-DC-07: Research amendments accepted by the orchestrator

- **Phase / source:** Phase 6 researcher (`06-RESEARCH.md`); amendments in `06-CONTEXT.md`.
- **Severity:** High (items 1, 2, 4); the rest Low-Medium. **Status:** open.
- **Items:**
  1. **D-CF6-02 silent skip:** a malformed server in a file, or an unparseable, missing, or unreadable file, is dropped with no warning (upstream's loader is silent; only `claude plugin validate` reports). The earlier "install warning" text is withdrawn. A user loses a server with no message.
  2. **Permission-denied MCP file skipped** (upstream), changing the WR-03 `{permission denied}` classification; proven from binary source only (root container cannot probe it).
  3. **`.mcpb`/`.dxt`** become `{unsupported mcp}` with no named dropped server (no closed-set change).
  4. **D-CF6-10 MCP-07 as a recorded gap:** a foreground pi-subagents 0.84.0 agent cannot use a plugin MCP tool (`Unresolved MCP direct-tool selectors: ...`); the requirement is met by pinning that result, not by a working call. Root cause (possibly a cache-hash mismatch) unproven.
  5. **Reference without `./` kept installable** (upstream refuses the manifest): a divergence recorded under D-CF6-01 to avoid breaking plugins that install today.
  6. **D-CF6-11:** a fresh profile Pi stands in for `/reload` where the harness has no reload step.
  7. **Out-of-ownership test edits:** `test/domain/plugin-resolver.test.ts` (MCPR-03, WR-03, entry-wins, MM-5) changes with the resolver fix.
  8. **Doc finding for Phase 5:** since adapter 6.0 hooks do see proxied MCP calls (nested call under the real tool name); `docs/hooks-compatibility.md` reconciliation is a parent line.

### P6-DC-08: Planner choices for the nine Phase 6 plans

- **Phase / source:** Phase 6 gsd-planner (`06-01`..`06-09-PLAN.md`).
- **Severity:** Medium (items 2, 3, 5, 6); the rest Low. **Status:** open.
- **Items:**
  1. Four waves, not three: the merge (06-03, wave 2) and the silent skip (06-07, wave 3) are split because both edit `domain/mcp-resolution.ts`; the gate is 06-09 in wave 4, and the docs plan 06-08 runs in wave 3 beside 06-07.
  2. Array-form `mcpServers` is admitted in the owned `domain/components/mcp.ts` (`MCP_SERVERS_SCHEMA`), leaving the unowned `domain/components/plugin.ts` unchanged; its stale comment (lines 48-52) is a parent line. Three cases in `test/domain/components/plugin.test.ts` change expected outcomes only.
  3. Out-of-ownership tests edited under CONTEXT's general clause: `test/domain/components/plugin.test.ts` and `test/orchestrators/reconcile/mcp-migration.test.ts`, each bounded by a `git diff` check.
  4. Paired tests of owned sources treated as owned (`test/domain/mcp-resolution.test.ts`, `test/domain/components/mcp.test.ts`, and, on a measured break, `test/platform/mcp-status.test.ts`, `test/shared/concerns/soft-dep.test.ts`).
  5. Downstream fatal-path tests keep their titles by moving the bad server inline into `plugin.json`; one commit between 06-07 Task 1 and Task 2 leaves those suites red.
  6. I/O errors while locating an MCP file (ENOTDIR and similar) are skipped silently, read as D-CF6-02's "missing or unreadable file".
  7. The Phase 1 `calls.steps.ts` is moved into `listing.steps.ts` and deleted.
  8. `.mcpb` gets no extra note beyond `(partially-available) {unsupported mcp}`.
  9. Two new libs (`features/lib/mcp-server-http.ts`, `features/lib/mcp-server-environment.ts`) beyond the single `mcp-server-files.ts` the ownership table names.
  10. The `MCP_DIRECT_TOOLS` doc row may rest on reading adapter source if a scratch RPC measurement fails.
  11. `COVERAGE.md` declares "No external API integration" against four detector keyword signals.
  12. D-CF6-07 followed over ROADMAP wording ("uses Phase 1's agent fixture writer").
  13. Conditional ownership in wave 2 (`bridges/mcp/**` to 06-02; the soft-dep adapter arm and `mcp-status.ts` to 06-05), only on a measured break; other product breaks hand over to 06-07 with no failing scenario committed.
  14. 06-08 documents the skip rule while 06-07 builds it; 06-09 Task 1 checks the doc against merged code.
  15. 06-09's diff base is the fixed hash `3a7a707`, with a `git merge-base` fallback.
- **Recorded in:** this file; the plans' `<assumption_delta_decision>` and task bodies.

### P6-DC-09: Plan-checker warnings handled without a revision round

- **Phase / source:** Phase 6 gsd-plan-checker (0 blockers, 2 warnings, 3 info).
- **Severity:** Low. **Status:** open.
- **Choice:** Warning 1 (MCP-07 and ROADMAP SC4 still ask for a working agent call) is fixed in place: 06-09 now carries a parent line to mark MCP-07 "gap-pinned (D-CF6-10)" and amend SC4, and its SUMMARY states SC4 is met by the pin. Warning 2 (commit trailer differs from the brief) is kept as decided in P6-DC-05. The three advisories are left as written: `calls.steps.ts` stays in both `files_modified` and `files_deleted`, the plans keep this session's scratchpad wrapper path (executors run in this session), and 06-09 Task 1 still reconciles 06-08's doc with 06-07's merged code. The checker rated MCP-07's gap a warning rather than a blocker because D-CF6-10 licenses it.
- **Alternatives:** Re-spawn the planner for a revision round; edit REQUIREMENTS.md and ROADMAP SC4 in this phase.
- **Recorded in:** `06-09-PLAN.md` Task 3 parent lines.

### P6-DC-10: Executor prompts load the GSD procedure files by Read, not inline

- **Phase / source:** Phase 6 execute-phase orchestration (step 3 dispatch).
- **Severity:** Low. **Status:** open.
- **Choice:** Each executor prompt tells the executor to Read `execute-plan.md`, `summary.md`, `checkpoints.md`, `worktree-path-safety.md`, and `executor-examples.md` in full before any work, instead of the orchestrator pasting their ~130 KB verbatim into every prompt. The small `worktree_branch_check` guard is still embedded verbatim with the base SHA substituted. The prompts also carry the brief's git, project, and environment rules and the dubious-choices protocol.
- **Alternatives:** Inline the five files verbatim in every dispatch, as the workflow's build-time-embed note asks.
- **Why dubious:** The workflow's note forbids leaving the content to the executor; the reason it gives (an `@path` line never expands) does not apply to an explicit Read instruction, but an executor that skips the Read would run without the procedure.
- **Recorded in:** this file.

### P6-DC-11: Plan 06-01 executor choices (listing tracer)

- **Phase / source:** Phase 6 executor for `06-01-PLAN.md` (`06-01-SUMMARY.md`).
- **Severity:** Medium (items 1, 2, 3); the rest Low. **Status:** open.
- **Items:**
  1. **Connect before listing:** the adapter's lazy `mcp({ server })` listing holds an em dash that the `fix-unicode-dashes` pre-commit hook rewrites in every committed feature file, so the scenario lists status, connects, then lists the server; the first listing a model sees is not compared whole. Any adapter message with an em dash has the same limit.
  2. **250 ms quiet window for the registry probe:** the tool-listing When repeats the probe until two reports 250 ms apart agree (15 s deadline), after one flip under 8 workers; a heuristic, not a readiness signal.
  3. **`/** @public */` on 8 fixture-writer exports** nothing imports until wave 2, to pass fallow dead-code without a marker that could go stale; the tags hide dead code until removed (parent line to remove them after wave 2).
  4. Array elements of `mcpServers` are not expanded as stub markers (a server takes its name from a member key).
  5. The MCP-07 agent fixture body text "Call the tools the task names." was chosen by the executor.
- **Recorded in:** `06-01-SUMMARY.md`.

### P6-DC-12: Plan 06-04 executor choices (tool calls and the agent gap)

- **Phase / source:** Phase 6 executor for `06-04-PLAN.md` (`06-04-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. The negative control pins the measured stub log (adapter 7.0.0 reconnects and lists tools a second time before answering "not found", sending no `tools/call`) and is retitled "A call to a tool the plugin's server does not list is never sent to the server", against the plan's must-have "its log holds only the startup listing".
  2. "(D-CF6-10)" appears in two scenario titles and the feature description, relying on the layout rule that a divergence scenario names its ID.
  3. The no-tools agent scenario keeps a stub server and compares its log, beyond the plan's list, to prove a plugin tool exists but is withheld.
  4. The agent Givens check only the written file's `tools:` lines, not the whole text.
  5. REQUIREMENTS.md was not updated by the executor (MCP-02/MCP-07 left to the orchestrator; MCP-07 is met only as a gap).
- **Recorded in:** `06-04-SUMMARY.md`.

### P6-DC-13: Plan 06-02 executor choices (server configuration)

- **Phase / source:** Phase 6 executor for `06-02-PLAN.md` (`06-02-SUMMARY.md`).
- **Severity:** Medium (items 2, 4); the rest Low. **Status:** open.
- **Items:**
  1. HTTP request Thens state the POSTs in arrival order and the other requests (the SDK's event-stream `GET`, which arrives within 1 ms of `tools/list`) in any order.
  2. The HTTP listing wait ends at the first logged `tools/list`; a small gap remains before the adapter closes its client (no failure in 15 runs).
  3. A header the request did not carry shows as `(none)`, not the plan's empty cell, so an unset-variable header (`x-team: ""`) is told apart from a dropped one.
  4. The OAuth scenario cannot tell OAuth mode from non-OAuth mode: it pins that an `auth: "oauth"` entry connects, sends the header, and starts no sign-in; only the integration test pins the written field.
  5. Server names `tag` and `root` instead of the plan's `stub`, because 06-01's `withStubServers` reads a lone server named `stub` as a stub marker (parent line).
  6. The environment preload is passed in `args` as a `file://` URL.
  7. The loopback stand-in's answers differ slightly from the frozen stub's (no protocol-version fallback, no `required` in the echo schema) to avoid a fallow clone.
- **Recorded in:** `06-02-SUMMARY.md`.

### P6-DC-14: Plan 06-06 executor choices (lifecycle)

- **Phase / source:** Phase 6 executor for `06-06-PLAN.md` (`06-06-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. The update scenario's replacement `.mcp.json` uses the wrapper-less root form (`{"stub": {...}}`) because 06-01's `withStubServers` reads a `mcpServers` member as a stub marker; the scenario now also depends on a root `.mcp.json` being read without its wrapper, not checked against Claude Code 2.1.316.
  2. Kept the named `readFile` import, leaving the criterion `grep -c readFile <= 1` unmet as written (one call site).
  3. The override-survives-update scenario changes only the version, not the server definition.
  4. The no-update control compares the stub's whole log, which cannot tell the versions apart; only the model's answer does.
- **Recorded in:** `06-06-SUMMARY.md`.

### P6-DC-15: Plan 06-05 executor choices (companion missing, project trust)

- **Phase / source:** Phase 6 executor for `06-05-PLAN.md` (`06-05-SUMMARY.md`).
- **Severity:** Medium (item 1); the rest Low. **Status:** open.
- **Items:**
  1. A Phase 6 copy of the calls step, `the model receives these mcp calls:`, reads `{em dash}` as U+2014 so the adapter's blocked reasons can be compared whole despite the `fix-unicode-dashes` hook; two calls steps now differ only in that projection, and the token is not yet in the frozen cucumber skill (parent line).
  2. A polling Given runs `info` every 50 ms (15 s) until pi-mcp-adapter has reported, so the command under test doubles as the wait; a status that never leaves `status unknown` fails in the Given.
- **Recorded in:** `06-05-SUMMARY.md`.

### P6-DC-16: Plan 06-03 executor choices (server sources merge)

- **Phase / source:** Phase 6 executor for `06-03-PLAN.md` (`06-03-SUMMARY.md`).
- **Severity:** Medium (items 1, 2, 9); the rest Low. **Status:** open.
- **Items:**
  1. An `mcpServers` array with one bad element is refused whole (one note, no element read); upstream refuses the whole manifest, so there is no partial behavior to copy.
  2. A file's server map is read with `Object.hasOwn(document, "mcpServers")`, not upstream's `G.mcpServers || G`; they differ when `mcpServers` is falsy (`null`, `0`, `""`).
  3. A non-object `.mcp.json` document (`5`, `null`) now gets the note `malformed mcpServers: must be object` instead of an incidental "Cannot use 'in' operator" note; both stay `{malformed mcp}`.
  4. A `.mcpb`/`.dxt` source adds no note, so `info` shows only `{unsupported mcp}` without naming the bundle.
  5. An absolute or escaping `.mcpb` path is a fatal `malformed mcp reference` (containment runs first), matching upstream's refusal of such paths.
  6. The no-plugin.json step text names its kind (`... has no plugin.json, so its marketplace entry declares its mcp servers`), differing from the plan's wording.
  7. The comment above the MCPR-01 backstop test in `test/domain/plugin-resolver.test.ts` was edited, just outside the plan's strict `git diff` bound.
  8. `[1]` replaces `[]` in the two refused plugin-schema lists in `test/domain/components/plugin.test.ts`.
  9. The four Task 3 scenarios (entry, bundle, reference rules) have no measured red run; their red is argued from the old code.
- **Recorded in:** `06-03-SUMMARY.md`.

### P6-DC-17: Plan 06-08 executor choices (compatibility doc)

- **Phase / source:** Phase 6 executor for `06-08-PLAN.md` (`06-08-SUMMARY.md`).
- **Severity:** Medium (items 4, 5, 6); the rest Low. **Status:** open.
- **Items:**
  1. The `MCP_DIRECT_TOOLS` deferred-tool name (`mcp__plugin_demo_stub___echo`, three underscores) is recorded as its own Naming divergence although ADOC-01 covers adapter settings in general.
  2. The hooks paragraph states only the adapter fact (a proxied call is also a nested call under the real name) and leaves whether plugin matchers fire to the Phase 5 reconcile (parent line).
  3. The header names the canary run without its version and points to Further reading, pulling against the must-have to state the old basis.
  4. The Upgrading bullet says a skipped file-source server counts as "no longer declared" for AMIG-01; inferred from `resolveStrict` reuse, not run.
  5. The D-CF6-10 item says Claude Code runs a subagent with a plugin MCP tool in the foreground; follows MCP-07's wording, no 2.1.316 probe.
  6. The Migration divergence item is kept, reworded, although upstream also refuses such a plugin.
  7. Scenario file names are cited in the user-facing doc.
  8. The `--mcp-config` sentence ("Pi still does not run its built-in MCP") rests on an adapter source comment, not a run.
- **Recorded in:** `06-08-SUMMARY.md`.

### P6-DC-18: Plan 06-07 executor choices (silent skip)

- **Phase / source:** Phase 6 executor for `06-07-PLAN.md` (`06-07-SUMMARY.md`).
- **Severity:** High (items 1, 2); the rest Low. **Status:** open.
- **Items:**
  1. A skipped MCP file source or malformed server gets no user message, only an env-gated `hookDebugLog(..., "mcp")` line; a user loses a bad server silently, as in Claude Code.
  2. EACCES and containment-walk I/O errors (ENOTDIR) are skipped rather than reported as `{permission denied}`, following upstream's loader; a real permission problem now goes unreported.
  3. One Outline state Given (`the mcp file ... is {string}`, states `missing`, `not valid JSON`, `readable by nobody`) replaces the plan's three Givens; the plan's `cannot be read by anyone` step text is not registered.
  4. The Outline's surviving server is inline in every row, so ".mcp.json survives a bad reference" is pinned by unit tests only.
  5. The 7 named plugin-resolver tests keep their arrange and now expect installable with no servers, instead of gaining a second source.
- **Recorded in:** `06-07-SUMMARY.md`.

### P6-DC-19: Plan 06-09 executor choices (phase gate and records)

- **Phase / source:** Phase 6 executor for `06-09-PLAN.md` (`06-09-SUMMARY.md`).
- **Severity:** Medium (items 2, 9); the rest Low. **Status:** open.
- **Items:**
  1. The doc check edited `docs/mcp-compatibility.md`, outside the plan's `files_modified`, as Task 1's action directs.
  2. The new doc sentence "a skipped server does not replace an earlier one" rests on code, unit tests, and the research's reading of upstream; no scenario or 2.1.316 probe checks it.
  3. The Upgrading bullet still covers only a malformed server, not a whole skipped file (no test runs that case).
  4. The canary parent line is "re-run live on 7.0.0" rather than "raise to 7.0.0", since Phase 1 already pinned `ADAPTER_VERSION = "7.0.0"`.
  5. A first gate run was stopped after 2 minutes and restarted whole after a docs-only fix; none of its output is used.
  6. The Outcome column of the drafted Key Decisions rows: "✓ Good" for ten, "⚠ Revisit (gap pinned; report not filed)" for D-CF6-10.
  7. The pi-subagents gap report ranks its requests; its reproduction steps were not run outside the harness.
  8. The CHANGELOG draft has five sub-bullets and omits the re-measured doc and the agent gap.
  9. The drafted MCP-07 line is checked `[x]` with "gap-pinned (D-CF6-10)", which could be read as a working foreground call.
  10. The four drafted BACKLOG IDs (MCPBG-01, MCPSUB-01, MCPB-01, MCPREF-01) were chosen by the executor.
  11. The `@public` tag clean-up and the `collision-*.ts` comment fixes stay parent lines although Phase 6 owns those files.
  12. The SUMMARY was committed in three commits (one per task).
- **Recorded in:** `06-09-SUMMARY.md`.

### P6-DC-20: Verification-step choices (validation and security audit)

- **Phase / source:** Phase 6 verify:post steps (`06-VALIDATION.md`, `06-SECURITY.md`), orchestrator and gsd-security-auditor.
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The Nyquist audit found no gap and spawned no auditor: every MCP requirement maps to a committed feature file that passed in the phase gate's three cucumber runs; the user gate ("Fix all gaps" / "mark manual-only") was not shown because nothing was missing.
  2. T-06-SC (named in all nine plans) is one register row.
  3. The six `accept` threats were closed by writing their Accepted Risks Log rows (AR-06-01..06), with "plan threat model (Phase 6 planner)" as the accepter rather than the user.
  4. The no-read proof for T-06-07/T-06-16 rests on the unit cases; the outside-reference scenario proves only the fatal refusal.
  5. T-06-14 was checked at L1 depth (the three lifecycle scenarios); the D-08-02 field carry-over was not traced.
  6. The root `.mcp.json` is read through symlink-following `stat`/`readFile` without containment (predates Phase 6); recorded as an observation, not a threat.
- **Recorded in:** `06-VALIDATION.md`, `06-SECURITY.md`.

### P6-DC-21: Code review fix choices

- **Phase / source:** Phase 6 code review (`06-REVIEW.md`, 0 critical, 8 warnings, 8 info) and gsd-code-fixer (`06-REVIEW-FIX.md`).
- **Severity:** Medium (items 1, 2); the rest Low. **Status:** open.
- **Items:**
  1. WR-03: the MCP file-source skip now skips any Error carrying a Node `code` (EMFILE and EIO included, as upstream's loader skips every `readFile` failure) and rethrows errors without a code and non-Error values; a pre-Phase-6 plugin-resolver test was restored to its "propagates" form. The rethrow in `locateReference` has no dedicated test.
  2. WR-01/WR-02: no resolver change. A probe of Claude Code 2.1.316 shows upstream reads `.mcp.json` and named server files through symlinks wherever they point; the root file already matches, and the refusal of every symlinked reference (MCPR-04, D-14) is now a documented divergence. Whether to follow in-root links is left as a parent line for the user. Evidence covers a directory marketplace and `file://` url plugins only.
  3. WR-04: the reconcile move's "no longer declares it." wording for a skipped malformed server is kept (product code Phase 6 does not own) with a test comment and a parent line.
  4. WR-05: the WLIF-01 test was retitled to what it proves instead of adding a mock; an existing case already reaches the branch.
  5. WR-06: a bad POST to the HTTP stand-in is answered 400 and logged but does not fail the release; an append or answer failure does.
  6. The orchestrator scoped the fix to warnings plus IN-06 and wrote `06-REVIEW-DISPOSITION.md` by hand (the other info items `deferred`) instead of running the disposition script.
- **Recorded in:** `06-REVIEW-FIX.md`, `06-REVIEW-DISPOSITION.md`.
