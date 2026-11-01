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
