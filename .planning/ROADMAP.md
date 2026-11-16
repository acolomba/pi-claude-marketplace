# Roadmap: pi-claude-marketplace

## Milestones

- **parity-gaps** Claude Code Parity Gaps and Defects -- in progress on branch `features/gaps` (started 2026-11-11); 11 phases, 42 requirements. [Requirements](REQUIREMENTS.md), [PRD](../docs/prd/parity-gaps-prd.md).
- ✅ **behavioral-gaps** Behavioral Coverage Gaps — completed 2026-11-08 on branch `features/behavioral-gaps` (not yet pushed, no PR or npm release yet); 16 phases, 36 plans, 34/34 requirements. [Archive](milestones/behavioral-gaps-ROADMAP.md), [requirements](milestones/behavioral-gaps-REQUIREMENTS.md), [audit](milestones/behavioral-gaps-MILESTONE-AUDIT.md).
- ✅ **mcp-builtin** MCP Built-in — completed 2026-11-05 on branch `features/mcp-builtin` (PR [#303](https://github.com/acolomba/pi-claude-marketplace/pull/303), version 0.23.0, not yet merged; user review done 2026-11-06, review fixes merged); 6 phases, 55 plans, 31/31 requirements. [Archive](milestones/mcp-builtin-ROADMAP.md), [requirements](milestones/mcp-builtin-REQUIREMENTS.md), [audit](milestones/mcp-builtin-MILESTONE-AUDIT.md).
- ✅ **component-features** Component Behavioral Tests — completed 2026-11-03 on branch `claude/quirky-planck-hhm592` (first closed 2026-11-02, reopened for the user's decisions; PR [#295](https://github.com/acolomba/pi-claude-marketplace/pull/295), no npm release yet); 8 phases, 65 plans, 62/62 requirements. [Archive](milestones/component-features-ROADMAP.md), [requirements](milestones/component-features-REQUIREMENTS.md), [audit](milestones/component-features-MILESTONE-AUDIT.md).
- ✅ **plugin-lifecycle** Marketplace and Plugin Lifecycle Backlog — completed 2026-10-29 on branch `features/plugin-lifecycle-p11` in PR #290 (not yet merged, no npm release); 11 phases, 80 plans, 64/64 requirements. [Archive](milestones/plugin-lifecycle-ROADMAP.md), [requirements](milestones/plugin-lifecycle-REQUIREMENTS.md), [audit](milestones/plugin-lifecycle-MILESTONE-AUDIT.md).
- ✅ **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- ✅ **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- ✅ **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- ✅ **mcp-4** MCP 4 — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- ✅ **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221). [Archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md).
- ✅ **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md).
- ✅ **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205). [Archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md).
- ✅ **test-backlog** — completed 2026-09-18. [Archive](milestones/test-backlog-ROADMAP.md).
- ✅ **refine-unit-tests** — completed 2026-09-13. [Archive](milestones/refine-unit-tests-ROADMAP.md).
- ✅ **v1.19 Unit Test Refactor** — completed 2026-09-04. [Archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

### In progress parity-gaps -- Claude Code Parity Gaps and Defects

**Milestone goal:** Close every P0 and P1 gap that
[docs/prd/parity-gaps-prd.md](../docs/prd/parity-gaps-prd.md) lists between
Claude Code 2.1.322 and this project, so that the official plugins in its
sample work end to end on Pi: `security-guidance`, `hookify`, `ralph-loop`,
`code-modernization`, `claude-security`, and the five plugins of the
`anthropics/skills` marketplace.

Inputs: `.planning/PROJECT.md` (Current Milestone), `.planning/REQUIREMENTS.md`
(42 requirements, each the PRD's ID with a `PG-` prefix), the PRD at version
1.2 (section 5 for the decisions, section 7 for the full text of each
requirement, section 9 for the spikes, section 10 for the corrections), and the
six reports under `docs/research/parity-gaps/`. No research step ran for this
milestone. The planning of each phase re-reads its requirements against the
reports that its Evidence line names. Baseline: Claude Code 2.1.322, Pi 1.5.2,
pi-mcp-adapter 7.0.1, pi-subagents 0.88.0, pi-dynamic-workflows 3.15.1.

#### Order and gates

Phases run in numeric order, one at a time. Phases 1 to 4 hold the 13 P0
requirements. None of them has an open decision or an open spike, so each can
be planned today. Phases 5 to 11 hold the 29 P1 requirements. Phase 1 is first
because it raises the two companion floors, and the tests of every later phase
run against them. Phase 4 depends on Phase 1 alone, so it can move earlier.

| Phase | Priority | Main code area | Decisions to settle first | Spike to run first |
| --- | --- | --- | --- | --- |
| 1 | P0 | package files, MCP bridges, agents bridge | none (2, 3, 4 answered) | none (S3 ran) |
| 2 | P0 | hooks bridge | none (6, 24 answered) | none |
| 3 | P0 | agents bridge, hooks bridge | none (1 answered) | none (S2 ran in part, S12 settled) |
| 4 | P0 | resolver, skills and commands, workflows bridge | none | none (S4 ran) |
| 5 | P1 | hooks bridge | none | S1 ran in print mode only; the other modes are measured here |
| 6 | P1 | hooks bridge | 9, 25 | S7 |
| 7 | P1 | agents bridge | none | none |
| 8 | P1 | workflows bridge, agents bridge | none | S5 |
| 9 | P1 | MCP bridges | 5, 20 | none |
| 10 | P1 | resolver and container | 23, 17, 10 | none |
| 11 | P1 | skills and commands, documentation | 13 | S8 |

#### Milestone rules

- **Upstream parity.** Claude Code 2.1.322 is the reference for every expected
  behavior. A divergence needs a recorded decision ID or a Pi capability gap,
  and the scenario names it. Check the upstream contract again with
  `claude-code-compat-research` before a scenario pins it.
- **Behavioral tests.** A requirement that changes behavior a user can see
  lands with a cucumber scenario under `features/` that fails without the
  change. The Acceptance field of the requirement in the PRD is the starting
  scenario. A requirement that names both MCP implementations is proven under
  both profiles, `adapter` and `builtin`; the cucumber skill's rules decide the
  tags (DUAL-02, D-BG-04).
- **Real subagent children.** The harness runs a stand-in subagent child. It
  cannot run a real detached child that pi-subagents starts (BACKLOG
  AGTASYNC-01). Where an acceptance needs a real child (PG-AGENT-01,
  PG-AGENT-02, PG-WF-05), the scenario pins what the stand-in child or
  `subagent get` shows, and the phase says how the live run is checked.
- **Decisions.** Decisions 5, 9, 10, 13, 17, 20, 23, and 25 of the PRD's
  section 5 are open. The maintainer answers each in the discuss step of the
  phase that names it, before any plan is written. The answer goes into
  `PROJECT.md` with its premise and the version it was checked against. A "no"
  moves the requirement to Out of Scope in `REQUIREMENTS.md`, and the phase goes
  on with its other requirements.
- **Spikes.** S5, S7, and S8 have not run. Each is the first work of the phase
  that names it, and its result goes into the Result column of the PRD's
  section 9 before the requirement it gates is planned in detail.
- **Existing installs.** PG-CORE-01, PG-AGENT-01, PG-AGENT-05, PG-MCP-01, and
  PG-MCP-06 rename or remove an artifact of an installed plugin. The design of
  each says how the artifact changes at the next `update` or `reinstall`.
- **Record corrections.** A correction in the PRD's section 10 that names a
  requirement lands in the same change as that requirement. The eight rows
  marked "none" are PG-DOC-02.
- **Not scheduled.** The P2 rows of the PRD (the v2 list in `REQUIREMENTS.md`)
  and its P3 rows get no phase.

- [x] **Phase 1: Companion Floors and MCP Defaults** - The pi-subagents floor is 0.87.0 and the pi-mcp-adapter floor is 7.0.1, mapped model IDs carry no provider, long tool names work under the adapter, and a server with no `timeout` gets Claude Code's idle window (completed 2026-11-12)
- [x] **Phase 2: Hook Payloads, Matchers, and Stop Limit** - Hooks on file tools get and return Claude-shaped tool input, matchers follow Claude Code's rules, and a `Stop` hook can block eight times in a row (completed 2026-11-13)
- [x] **Phase 3: Background Subagents** - A bridged agent runs in the launch mode pi-subagents chooses, and a subagent child runs none of the plugin's main-session hooks (completed 2026-11-13)
- [x] **Phase 4: Skill and Workflow Install Defects** - A root-source entry installs only its listed skills, sibling skill links resolve, a plugin starts its own workflow by name, and an install notes that a workflow does not keep an agent's tool restriction (completed 2026-11-14)
- [x] **Phase 5: Stop Continuation and Hook Failures** - A blocking `Stop` hook continues the same run, a missing script does not block, failures and `stopReason` are shown, context stops at 10,000 characters, and a plain `async` hook has no timeout (completed 2026-11-14)
- [x] **Phase 6: Hook Inputs and Events** - Hooks receive `tool_use_id` and the other missing stdin fields, `UserPromptExpansion` hooks run before an expansion, and a continued session reports `resume` (completed 2026-11-15)
- [x] **Phase 7: Agent Frontmatter and Grants** - Agent frontmatter is read as YAML, `Agent` and `Task` grants let an agent delegate, `model: inherit` is passed on, and both tool lists restrict an agent (completed 2026-11-14)
- [x] **Phase 8: Workflow Agents and Run Paths** - A workflow runs the plugin's own agents and notes a missing one, an agent with a `Workflow` grant starts its plugin's workflow, and the uncovered run paths and the limits of a workflow subagent are proven or documented (completed 2026-11-15)
- [x] **Phase 9: Adapter Entries and MCP Features** - Under the adapter a stdio server stays alive and user-written fields survive updates, the sampling and UI question is settled, and resources, prompts, and elicitation are documented and tested (completed 2026-11-14)
- [x] **Phase 10: Plugin Options, Variables, and Trust** - `userConfig` defaults reach hooks, servers, and content, user-scope skills and commands get the project directory, a plugin `bin` joins `PATH` only when it exists and the project is trusted, and the trust gap is decided (completed 2026-11-15)
- [x] **Phase 11: Skills, Commands, and Records** - Typed commands and skills attach `@file` references, commands answer to their Claude Code names, alias suggestions show descriptions, and the compatibility page and the record corrections land (completed 2026-11-16)

<details>
<summary>✅ behavioral-gaps — Behavioral Coverage Gaps — SHIPPED 2026-11-08</summary>

16 phases, 36 plans. The phase list is in the [archive](milestones/behavioral-gaps-ROADMAP.md).

**Outcome:** 34/34 requirements, 16/16 phases, 11/11 integration checks, and 16/16 phase flows pass; 1779 adapter-profile and 153 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phases 1, 4, and 6 closed with a stale-verification override: later merges changed files they verified, and the combined tree passes `npm run check`. The adapter-profile order flakes were fixed by `d04a5106`.

</details>

<details>
<summary>✅ mcp-builtin — MCP Built-in — SHIPPED 2026-11-05</summary>

- [x] Phase 1: Foundation and Pi 1.5.0 (14/14 plans) — completed 2026-11-04
- [x] Phase 2: Built-in Materialization (9/9 plans) — completed 2026-11-04
- [x] Phase 3: Read-Time Verdicts (9/9 plans) — completed 2026-11-04
- [x] Phase 4: Agent Grants (6/6 plans) — completed 2026-11-04
- [x] Phase 5: Hook Tool Names (4/4 plans) — completed 2026-11-04
- [x] Phase 6: Release Docs and Combined Tree (13/13 plans) — completed 2026-11-05

**Outcome:** 31/31 requirements, 6/6 phases, 9/9 integration seams, and 8/8 end-to-end flows pass; 1603 adapter-profile and 133 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phase 2 closed with a verification override (`human_needed`, 5/7); after the user's review and the review fixes it re-verified `passed` (7/7), with 02-UAT 2/2.

</details>

<details>
<summary>✅ component-features — Component Behavioral Tests — SHIPPED 2026-11-03</summary>

- [x] Phase 1: Harness and Version Raise (15/15 plans) — completed 2026-11-01
- [x] Phase 2: Skills (7/7 plans) — completed 2026-11-02
- [x] Phase 3: Slash Commands (9/9 plans) — completed 2026-11-01
- [x] Phase 4: Agents (6/6 plans) — completed 2026-11-01
- [x] Phase 5: Hooks (9/9 plans) — completed 2026-11-01
- [x] Phase 6: MCP Servers (9/9 plans) — completed 2026-11-02
- [x] Phase 7: Workflows (6/6 plans) — completed 2026-11-01
- [x] Phase 8: Locality and Upstream Alignment (4/4 plans, retroactive) — completed 2026-11-03

**Outcome:** 62/62 requirements, 8/8 phases, 6/6 integration seams, and 5/5 end-to-end flows pass; 1539 cucumber scenarios. The audit has no blockers. MCP-07 stays an accepted deviation (MCPBG-01); W2 and W4 are guarded non-defects; T-05-33 is fixed and T-05-34 accepted under D-LOC-01, which replaced the D-CF2-13..16 and D-CF3-07 provenance ledger.

</details>

<details>
<summary>✅ plugin-lifecycle — Marketplace and Plugin Lifecycle Backlog — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Staging Warning Channels (8/8 plans)
- [x] Phase 2: Apply Ordering and Installed Declarations (6/6 plans)
- [x] Phase 3: Dependency Cascade Rows and Status (6/6 plans)
- [x] Phase 4: Dependency Resolver Residue (6/6 plans)
- [x] Phase 5: Marketplace Command Parity (9/9 plans)
- [x] Phase 6: Import Marketplace Planning (6/6 plans)
- [x] Phase 7: Git Errors and Lock Discipline (10/10 plans)
- [x] Phase 8: Background Autoupdate (4/4 plans)
- [x] Phase 9: Plugin Package Dependencies (5/5 plans)
- [x] Phase 10: Lifecycle Test and Harness Gaps (7/7 plans)
- [x] Phase 11: Cleanup, Split, and Docs (13/13 plans)

**Outcome:** 64/64 requirements, 11/11 phases, 12/12 integration groups, and 10/10 end-to-end flows pass. The audit has no blockers and carries only the accepted HOSTED-DNS-01 residual under D-PL5-31.

</details>

## Phase Details

### Phase 1: Companion Floors and MCP Defaults

**Goal**: The project declares pi-subagents 0.87.0 and pi-mcp-adapter 7.0.1 as its floors and models what those versions do: a mapped model ID runs on the session's provider, and a plugin tool whose name is longer than 64 characters works under the adapter. A plugin MCP server that declares no `timeout` gets Claude Code's idle window under both implementations.
**Depends on**: Nothing (first phase)
**Requirements**: PG-AGENT-02, PG-AGENT-07b, PG-MCP-02, PG-MCP-01
**Evidence**: PRD sections 7.3 (MCP-01, MCP-02) and 7.5 (AGENT-02, AGENT-07); reports `mcp.md` and `subagents.md`. Decisions 2, 3, and 4 are answered. Spike S3 ran on the adapter's naming code.
**Notes**: The floor raises are the first work, because they change `package.json`, the README, and `scripts/install-test-peers.mjs`, which every later test runs against. PG-AGENT-02 and PG-AGENT-07b land in one change: from pi-subagents 0.87.0, a model ID with the `anthropic/` prefix always runs on that provider. The adapter's rule for a shortened name (64 characters, ending in the first 8 hexadecimal digits of the SHA-256 of the full name) is in its source and not in a published contract, so a test against the installed adapter holds the rule. PG-MCP-01 changes the configuration of an installed plugin's server at its next `update` or `reinstall`, and the design says how. A scenario with a tool that stays silent for more than 60 seconds is the full proof of PG-MCP-01 and is slow; the design decides whether to keep it. The corrections to `docs/mcp-compatibility.md` (lines 126, 277, 381, and 592), BACKLOG MCPBG-01, and `.planning/upstream/pi-subagents-mcp-direct-tools.md` land here.
**Success Criteria** (what must be TRUE):
  1. `package.json` and the README name pi-subagents 0.87.0 and pi-mcp-adapter 7.0.1 as the floors, and the test suites install and run pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1 (D-PG1-02 amends this criterion: `scripts/install-test-peers.mjs` installs the suite version of pi-subagents, one release above its floor). The documentation no longer describes the two fixed pi-subagents bugs as open, and the scenarios in `features/mcp-server/agent-grants.feature` pin what pi-subagents 0.88.0 does with a foreground run (D-PG1-03) (PG-AGENT-02, PG-MCP-02).
  2. An agent installed with `--map-model` lists its model with no provider prefix, such as `model claude-sonnet-5-5`, so it runs on the session's provider when that provider has the model (PG-AGENT-07b).
  3. Under the adapter, a plugin tool whose Claude Code name is longer than 64 characters works wherever the project names it: the server listing shows it, a hook whose matcher is the full Claude Code name runs and receives that name, and an agent whose `disallowedTools` names the tool is not offered it (PG-MCP-02).
  4. Under both profiles, the registered configuration of a stdio plugin server with no declared `timeout` shows 30 minutes, and that of a remote server shows 5 minutes. Under the adapter, a timeout the user wrote on the entry is still there after an update (PG-MCP-01).

**Closeout (2026-11-12):** 19 truths verified and one accepted override. The remaining real-child exclusion acceptance in criterion 3 is deferred by the user to [AGTAMBIENT-01](BACKLOG.md#agtambient-01-adopt-the-pi-subagents-fix-for-ambient-direct-mcp-tools-in-children) / [SEED-261112-81c](seeds/SEED-261112-81c-adopt-pi-subagents-ambient-mcp-fix.md), triggered by a published companion fix. PG-MCP-02 remains partial. Focused-feedback timing bookkeeping (PG1-TIMING-01) remains advisory debt in the validation report; no claim of Nyquist compliance.

**Adoption (2026-11-13):** Published pi-subagents 0.88.1 passed all six launch checks and all three real-child controls. PG-MCP-02 is complete; AGTAMBIENT-01 and its seed trigger are retired. `npm run check` passed (exit 0) at `2db3b81a9cc97098bee6bc744d451aeab4fe9fad`, Node v26.13.0; log: `/tmp/subagents0881-root-check.log`. AGTLONGNAME-01 and PG1-TIMING-01 remain open. See the [adoption summary](quick/261113-8yn-adopt-pi-subagents-0-88-1-ambient-mcp-fi/261113-8yn-SUMMARY.md).

**Plans**: 11/11 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md -- Wave 1: raise the floors to pi-subagents 0.87.0 and pi-mcp-adapter 7.0.1, run the suites on pi-subagents 0.88.0, write bare mapped model IDs, and re-pin what the new versions change

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md -- Wave 2: pin the developer launcher, the live canary, and the contributor records to the versions the suites run
- [x] 01-03-PLAN.md -- Wave 2: model pi-mcp-adapter 7.0.1's 64-character tool-name rule in the adapter profile and hold it against the installed adapter
- [x] 01-04-PLAN.md -- Wave 2: register Claude Code's idle window (30 minutes stdio, 5 minutes remote) under Pi's built-in MCP for a server with no timeout

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-05-PLAN.md -- Wave 3: stage an agent's disallowed long tool under the name the adapter registers, and record the pi-subagents long-name grant gap
- [x] 01-06-PLAN.md -- Wave 3: write the default timeout into adapter entries, record it in the marker, and keep a timeout the user wrote
- [x] 01-07-PLAN.md -- Wave 3: run hooks that name a long tool by its full Claude Code name and give every hook of the event that name

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-08-PLAN.md -- Wave 4: give PostToolUse hooks the full name from the adapter's result details, keep a cut name from counting as a proxy call, and pin the cells that stay shortened
- [x] 01-09-PLAN.md -- Wave 4: prove the default timeout across update, reinstall, and disable and enable, and run the slow call once per MCP implementation

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-10-PLAN.md -- Wave 5: correct the two compatibility pages for the floors, the fixed pi-subagents bugs, the default timeouts, and long tool names
- [x] 01-11-PLAN.md -- Wave 5: record the D-PG1 decisions, the overtaken BACKLOG entries, the upstream report's status, and the CHANGELOG entry

### Phase 2: Hook Payloads, Matchers, and Stop Limit

**Goal**: A plugin hook that the project reports as supported gets what Claude Code gives it. Hooks on file tools receive and return Claude-shaped tool input, matchers follow Claude Code's rules, and a `Stop` hook can block eight times in a row.
**Depends on**: Phase 1
**Requirements**: PG-HOOK-01, PG-HOOK-03, PG-HOOK-13
**Evidence**: PRD section 7.2; report `hooks.md`. Decisions 6 and 24 are answered.
**Notes**: Design choices are settled in `02-hook-payloads-matchers-and-stop-limit/02-CONTEXT.md` (D-PG2-01..12): one invocation per edit pair, available-field result translation in both directions, and original-call fallback with a notice for unsupported input rewrites. Full result capture wrappers are BACKLOG HOOKRESULT-01. Preserve the native-input `if` evaluator. PG-HOOK-13 lands on the existing `agent_settled` path; Phase 5 moves continuation to another event. Update the affected hook compatibility notes and existing payload expectations.
**Success Criteria** (what must be TRUE):
  1. A recording hook on a scripted `edit` call with one pair receives `{"file_path":"{project dir}/a.txt","old_string":"x","new_string":"y"}` as its `tool_input`, and hooks on `Read` and `Write` receive an absolute `file_path` (PG-HOOK-01).
  2. A hook that blocks on the text of the second pair of a two-pair `edit` blocks the call. A hook that returns a Claude-shaped `updatedInput` for `Write` changes the content that lands on disk. A hook's `updatedMCPToolOutput` changes the result of an MCP tool as `updatedToolOutput` does (PG-HOOK-01).
  3. A hook with the matcher `Edit, Write` runs on a scripted `write` call. A `PreToolUse` hook with the matcher `^Ba.*` runs on `bash` and not on `read`, and `info` reports its group as supported. A pattern that does not compile drops its group (PG-HOOK-03).
  4. A plugin whose `Stop` or `UserPromptSubmit` hook has a matcher installs without `--partial`, and the hook runs (PG-HOOK-03).
  5. A `Stop` hook that always blocks makes eight re-entries before the limit notice appears. A `Stop` hook that blocks ten times, with a tool call in each iteration, is never overridden (PG-HOOK-13).

  6. Hooks receive per-tool Claude-shaped result fields that Pi supplies; a Claude-shaped replacement changes the model-visible result without stale structured content. Missing fields are documented. An unsupported input rewrite leaves the original call intact and emits a notice; explicit denials still block (PG-HOOK-01, D-PG2-05..09).

**Plans**: 10/10 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Wave 1: real file/shell input translation, reverse rewrites and safe fallback

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Wave 2: precise search inputs and shared success/failure payload input
- [x] 02-08-PLAN.md — Wave 2: exact-list and whole-regex matcher admission and execution

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-09-PLAN.md — Wave 3: eight Stop continuations, native-tool resets and reload isolation

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-03-PLAN.md — Wave 4: atomic per-pair edit preflight, denial, rewrites and target conflicts

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-04-PLAN.md — Wave 5: actual shared edit results and failure delivery across all hook lanes

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-05-PLAN.md — Wave 6: file result translation and reverse replacement with real redaction checks

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-06-PLAN.md — Wave 7: search/shell result translation and reverse replacement

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-07-PLAN.md — Wave 8: MCP alias, custom schemas and replacement invariants in both profiles

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 02-10-PLAN.md — Wave 9: precise compatibility records and final combined-tree evidence

### Phase 3: Background Subagents

**Goal**: A bridged agent starts as a Claude Code subagent starts by default: in the launch mode that pi-subagents chooses, which is the background. A pi-subagents child that loads this extension runs the plugin's tool hooks and none of its main-session hooks.
**Depends on**: Phase 1, Phase 2
**Requirements**: PG-AGENT-01, PG-HOOK-07a
**Evidence**: PRD sections 7.5 (AGENT-01) and 7.2 (HOOK-07a); reports `subagents.md` and `hooks.md`. Decision 1 is answered. Spike S12 settled its premise, and spike S2 ran with the stand-in child.
**Notes**: The two requirements are one item. Once agents run in the background, the hooks bridge runs in every child, and a `Stop` hook that blocks there would keep the child running. The design treats the child as a mapping from main-session events to subagent events, not as a list of events to skip, so that `SubagentStart` and `SubagentStop` (HOOK-07b, not scheduled) can run there later. The tool hook payloads are the ones Phase 2 reshapes. The stored text of the MCP warning is matched byte for byte when agent files are rewritten, so the old and the new text must both be recognized. Agent files of installed plugins keep `async: false` until `update` or `reinstall`, and the design says how they change. The harness now starts real pi-subagents children: detached under the companion's default and under explicit background or MCP forcing, in the foreground under a configured foreground default, and several child sessions at once in one runner process (`features/agent/frontmatter.feature`, `features/plugin/subagent-child.feature`, `test/integration/pi-subagents-child-identity.test.ts`). The corrections to D-CF4-05 in `PROJECT.md` and to `bridges/agents/mcp-async-warning.ts` land here.
**Success Criteria** (what must be TRUE):
  1. `subagent get` shows no `async false` line for a plain bridged agent. An agent whose source sets `background: true`, and an agent with plugin MCP tools, still show the background mode. The scenario "A call that leaves the launch mode open runs a bridged agent in the foreground" in `features/agent/frontmatter.feature` is replaced (PG-AGENT-01).
  2. The warning for an agent with plugin MCP tools no longer says that Claude Code runs agents in the foreground. An agent file that holds the earlier warning text still follows a switch of the MCP implementation at the next session start (PG-AGENT-01).
  3. In the stand-in child of `features/plugin/subagent-child.feature`, a plugin's recording `SessionStart`, `UserPromptSubmit`, `Stop`, and `SessionEnd` hooks record no run, and its `PreToolUse` hook still runs (PG-HOOK-07a).
  4. A tool hook that runs in the child receives `agent_type`, and `agent_id` when the child can know it. The same hook in a main session receives neither field (PG-HOOK-07a).

**Plans**: 8/8 plans complete
- [x] 03-01-PLAN.md
- [x] 03-02-PLAN.md
- [x] 03-03-PLAN.md
- [x] 03-04-PLAN.md
- [x] 03-05-PLAN.md
- [x] 03-06-PLAN.md
- [x] 03-07-PLAN.md
- [x] 03-08-PLAN.md

### Phase 4: Skill and Workflow Install Defects

**Goal**: The official skill and workflow plugins install what Claude Code loads, and the text they install names things that exist. A root-source marketplace entry installs only its listed skills, a link to a sibling skill resolves, a command can start its plugin's workflow by name, and an install says when a workflow does not keep an agent's tool restriction.
**Depends on**: Phase 1
**Requirements**: PG-CORE-01, PG-SKILL-04, PG-WF-01, PG-SEC-01
**Evidence**: PRD sections 7.6 (CORE-01), 7.1 (SKILL-04), 7.4 (WF-01, SEC-01), and 8.4 (the engine request); reports `core.md`, `skills-commands.md`, and `workflows.md`. Spike S4 confirmed the gap behind PG-SEC-01.
**Notes**: PG-CORE-01 removes skills of an installed plugin at its next `update` or `reinstall`. The design makes sure that no file or record of a removed skill stays behind, and D-CF1-06 is amended for the root-source exception. PG-SKILL-04 does not cover a path that climbs to the plugin root (`../../docs/x.md`). Open for PG-WF-01: whether an existing fixture relies on a bare `plugin:workflow` mention becoming a slash command. PG-WF-01 is necessary for the two official workflow plugins and not sufficient: two engine behaviors in the PRD's section 8.4 remain. The PG-SEC-01 note comes before PG-WF-02 in Phase 8, which proves a binding that does not carry the restriction. The correction to `docs/workflows-compatibility.md:174` lands here.
**Success Criteria** (what must be TRUE):
  1. For a marketplace entry with `source: "./"` and `skills: ["./skills/a"]`, with `skills/a` and `skills/b` on disk, `info` lists `a` only and only `a` is installed. After an update that drops a listed skill, no file or record of that skill stays behind (PG-CORE-01).
  2. Skill `a` says `See ../b/ref.md`. After the install, the text the model receives names a path that exists and holds `b`'s file (PG-SKILL-04).
  3. A fixture plugin has a workflow `scan` and a command whose body says `Workflow({ name: "demo:scan" })`. The scripted model runs the command, calls `workflow` with the name copied from the prompt it received, and the run completes. A reference that the source wrote with a leading slash keeps it (PG-WF-01).
  4. A plugin with an agent `reader` (`tools: Read`) and a workflow that uses `agentType: "demo:reader"` installs with a note that the workflow does not keep the restriction, and `info` shows the note. The workflow compatibility page says the same, and the request to pi-dynamic-workflows is drafted under `.planning/upstream/` for the maintainer to file (PG-SEC-01).

**Plans**: 6/6 plans complete

Plans:
**Wave 1**
- [x] 04-01-PLAN.md -- Wave 1: install only the skills a root-source entry lists, and prove that an update or a reinstall leaves nothing of a dropped skill
- [x] 04-04-PLAN.md -- Wave 1: keep a workflow reference as its author wrote it, bare in a tool call and with a slash as a command, and let the scripted model start the workflow by that name
- [x] 04-05-PLAN.md -- Wave 1: read the literal agent types of a workflow script, and print the restriction note at install and at update

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md -- Wave 2: list a root-source entry's listed skills in `info`, on resolved and refused rows
- [x] 04-03-PLAN.md -- Wave 2: point a relative link to a sibling skill at the sibling's staged folder, in `SKILL.md` and supporting Markdown

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 04-06-PLAN.md -- Wave 3: show the restriction note in `info`, and record the compatibility row, the engine request draft, and the CHANGELOG lines

### Phase 5: Stop Continuation and Hook Failures

**Goal**: A `Stop` hook that blocks continues the same run, as in Claude Code. A hook that fails, names a missing script, returns too much context, or runs in the background behaves as it does there.
**Depends on**: Phase 2, Phase 3
**Requirements**: PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21
**Evidence**: PRD section 7.2; report `hooks.md`. Spike S1 ran on Pi 1.5.2 in print mode only.
**Notes**: Spike S1 did not run the terminal and RPC modes, Pi 1.5.0 (the declared floor), or a handler that takes minutes. The research here measures them before the design fixes the event. `Stop` on `agent_settled` can stay as a fallback for a mode where `agent_before_settle` does not behave as it did in print mode. PG-HOOK-02 moves the block count of PG-HOOK-13 (Phase 2) to the new event, and the limit of eight and its reset must hold there. `Stop` still does not run in a subagent child (Phase 3). The stop of a plain `async` hook at its timeout is inferred from the source (PG-HOOK-21, confidence Medium). The corrections to `docs/hooks-compatibility.md` (the sections "Stop continuation", formerly the turn-boundary timing shift, and "stdin, stdout, exit codes") land here.
**Success Criteria** (what must be TRUE):
  1. A run that a `Stop` hook blocks twice raises one `agent_settled` event and shows no second run start. On the same path, a `Stop` hook that always blocks still makes eight re-entries before the limit notice appears (PG-HOOK-02).
  2. A `Stop` hook that names a missing script lets the run end and shows one failure notice. A prompt hook that names a missing script does not block the prompt (PG-HOOK-23).
  3. A hook that exits 1 with `boom` on stderr shows one notice that holds `boom`. A `UserPromptSubmit` hook that returns `continue: false` with a `stopReason` shows that reason to the user (PG-HOOK-14).
  4. A hook that prints 12,000 characters of context sends at most 10,000 to the model (PG-HOOK-14).
  5. A plain `async` hook with `timeout: 1` that sleeps 3 seconds writes its end marker, and a reload still stops a plain `async` hook that is running (PG-HOOK-21).

**Plans**: 6/6 plans complete

Plans:
**Wave 1**
- [x] 05-01-PLAN.md -- Wave 1: run `Stop` on `agent_before_settle`, so a blocking `Stop` hook continues the run it ended and the run settles once

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-02-PLAN.md -- Wave 2: show one notice for each synchronous hook that fails without blocking
- [x] 05-05-PLAN.md -- Wave 2: let a plain `async` hook run until it ends, with no timeout

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-03-PLAN.md -- Wave 3: keep a missing hook script from blocking, show a `Stop` hook's failure, and show a hook's `stopReason`
- [x] 05-04-PLAN.md -- Wave 3: save a hook context string over 10,000 characters to a file and send the model its path and a preview

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 05-06-PLAN.md -- Wave 4: correct the hook compatibility page, the output catalog, the research notes, and the CHANGELOG, and remove the stale `Stop` canary

### Phase 6: Hook Inputs and Events

**Goal**: Hooks receive the stdin fields that official plugins read, `UserPromptExpansion` hooks run before a plugin command or skill expands, and a `SessionStart` hook can tell a continued session from a new one.
**Depends on**: Phase 2, Phase 5
**Requirements**: PG-HOOK-04, PG-HOOK-06, PG-HOOK-11
**Discuss step**: Decisions 9, 25 and 26 come first. Decision 26 (raised by Phase 3 verification): in a pi-subagents child, should hook stdin `session_id`, `transcript_path` and `CLAUDE_CODE_SESSION_ID` name the parent session or the child's own? Today they name the child's own, equal to `agent_id`; pi-subagents passes `PI_SUBAGENT_PARENT_SESSION` to background children, so the parent id is reachable there. Decision 9: send `tool_use_id` and the other stdin fields now, which reopens D-CF5-28 and D-BG-403. A "no" moves PG-HOOK-04 to Out of Scope. Decision 25: leave `permission_mode` out of hook stdin, or send a constant; Pi has no permission modes.
**Spike first**: S7 is the first work: does a session started with `--continue` hold its restored entries when `session_start` fires? It gates PG-HOOK-11, which also needs a launcher flag in the harness.
**Evidence**: PRD section 7.2; report `hooks.md`.
**Notes**: PG-HOOK-06 depends on part (c) of PG-HOOK-03 in Phase 2: the one plugin in the sample that uses the event, `claude-security`, has a regular expression matcher. MCP prompt expansions are out of reach. The cucumber step that compares whole payloads needs a placeholder for ids and timings. PG-HOOK-11 amends D-CF5-06. `agent_id` and `agent_type` are PG-HOOK-07a in Phase 3, not part of PG-HOOK-04.
**Success Criteria** (what must be TRUE):
  1. A recording hook sees the same `tool_use_id` on the `PreToolUse` and the `PostToolUse` run of one call, and a different one on a second call (PG-HOOK-04).
  2. Hooks receive `duration_ms` on `PostToolUse` and `PostToolUseFailure`, `mcp_server` for a plugin MCP tool, `custom_instructions` on `PreCompact`, `model` and `session_title` on `SessionStart`, and `effort` when Pi's level is one of Claude's levels. `permission_mode` is sent or left out as decision 25 says (PG-HOOK-04).
  3. A `UserPromptExpansion` hook with the matcher `demo:deploy` blocks. The user types `/demo:deploy`, the model receives no call, and the notice shows the reason (PG-HOOK-06).
  4. A `UserPromptExpansion` hook that does not block receives `expansion_type`, `command_name` in Claude form, `command_args`, `command_source`, and `prompt`, for a typed prompt template and for a typed skill, and the expansion then runs (PG-HOOK-06).
  5. A recording `SessionStart` hook records `resume` in a session started with `--continue` or `--resume`, and `startup` in a new session (PG-HOOK-11).
  6. In a pi-subagents child, a tool hook's `session_id`, `transcript_path` and `CLAUDE_CODE_SESSION_ID` name the session the discuss step chooses for decision 26 (the parent session, as Claude Code appears to send them, or the child's own), and `docs/hooks-compatibility.md` records the answer (carried from Phase 3 verification; BACKLOG CHILDSESSIONID-01).

**Plans**: 13/13 plans complete

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — Run spike S7: what Pi tells an extension at session_start under --continue, --session, and --fork
- [x] 06-02-PLAN.md — Send tool_use_id on the three tool events, with an id for each edit pair (tracer)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-03-PLAN.md — Report resume for a continued session and fork for a forked one; saved-session launch in the harness
- [x] 06-04-PLAN.md — Send duration_ms on PostToolUse and PostToolUseFailure

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-05-PLAN.md — Send mcp_server for a plugin MCP tool under both MCP implementations
- [x] 06-06-PLAN.md — Send custom_instructions, model, and session_title

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-07-PLAN.md — Prepare decision 26: state a real child's session fields in the harness and resolve the launching session

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 06-08-PLAN.md — Admit UserPromptExpansion: the event set, the name matcher, the translator, info and install

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 06-09-PLAN.md — Settle decision 26: a child's tool hook names the main session; internal keys stay on the child's own id
- [x] 06-10-PLAN.md — Dispatch UserPromptExpansion: the handler arms, the block and stop notices, the second input registration

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 06-11-PLAN.md — Send effort on the tool events and on Stop and StopFailure
- [x] 06-12-PLAN.md — Resolve a typed line and run the expansion hooks for it; the scenarios of criteria 3 and 4

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 06-13-PLAN.md — Correct the compatibility page, the output catalog prose, the CHANGELOG, and two feature descriptions

### Phase 7: Agent Frontmatter and Grants

**Goal**: A bridged agent gets the name, description, model, and tool grants that its source declares. The agents bridge reads frontmatter as YAML, maps `Agent` and `Task` grants to nested subagents, passes `model: inherit` on, and writes both tool lists.
**Depends on**: Phase 1, Phase 3
**Requirements**: PG-AGENT-05, PG-AGENT-03, PG-AGENT-07a, PG-AGENT-09
**Evidence**: PRD section 7.5; report `subagents.md`.
**Notes**: PG-AGENT-05 uses the leniency of the skills bridge (`repairSingleLineScalars` in `bridges/skills/frontmatter-degrade.ts`). A fallback to today's line reader for a whole file is rejected (PRD section 7.7). An agent with a quoted `name` changes its generated file name at the next update, and the design says how the old file goes. The `Agent` grant is not narrowed to the listed types, which matches Claude Code. PG-AGENT-09 closes BACKLOG AGTEXCL-01. These requirements name the agent table (`TOOL_MAP` in `bridges/agents/convert.ts`), not the hook table. The converter is the one Phase 3 changes for the launch mode.
**Success Criteria** (what must be TRUE):
  1. An agent with `description: "Reviews: code."` lists as `Reviews: code.` with no quote marks, and an agent with `name: "x"` lists as `demo:x`. An agent with the unquoted description `Reviews: code and tests` and `model: "sonnet"` in one file gets both right (PG-AGENT-05).
  2. A comment after a value is not a value: `tools: Read # note` grants `read` alone. A `description: |` block keeps its lines (PG-AGENT-05).
  3. `subagent get` lists `subagent` among the tools of an agent whose source grants `Agent` or `Task`, with or without a type list, and of an agent with no `tools` field, but not when `disallowedTools` names `Agent` or `Task`. A scripted child calls `subagent({agent: "demo:helper"})` and gets the reply (PG-AGENT-03).
  4. `subagent get` shows `model inherit` for a source agent with `model: inherit`, with and without `--map-model` (PG-AGENT-07a).
  5. `subagent list` shows both the tools and the excluded tools of an agent whose source has `tools` and `disallowedTools`, and its install prints neither of the two warnings about limits of pi-subagents versions below the floor (PG-AGENT-09).

**Plans:** 6/6 plans complete
- [x] 07-01-PLAN.md — Share the frontmatter repair and give it a trigger
- [x] 07-02-PLAN.md — Read agent frontmatter as YAML and report an unparseable agent
- [x] 07-03-PLAN.md — Keep description lines and prove the quoted-name rename
- [x] 07-04-PLAN.md — Map Agent and Task grants and keep model inherit
- [x] 07-05-PLAN.md — Nested delegation for an agent with no tools list
- [x] 07-06-PLAN.md — Restrict by both tool lists and remove the stale warnings

### Phase 8: Workflow Agents and Run Paths

**Goal**: A plugin workflow runs the plugin's own agents, and an install says when a script names an agent the plugin does not have. An agent whose source lets it start a workflow can start it. The run paths with no scenario today get one, and the compatibility page says what a workflow subagent can reach.
**Depends on**: Phase 3, Phase 4, Phase 7
**Requirements**: PG-WF-02, PG-WF-07, PG-WF-04, PG-WF-05
**Spike first**: S5 is the first work: does the workflow engine work when a pi-subagents background child loads it, and does pi-mcp-adapter work when it is listed in the engine's `providerMiddlewareExtensions`? It gates PG-WF-05 and the adapter half of PG-WF-04. PG-WF-05 has Low confidence. If the engine does not work in a child, this project cannot meet the requirement, and the question goes to the maintainer before any plan is written for it.
**Evidence**: PRD section 7.4; reports `workflows.md` and `subagents.md`. Spike S4 has run.
**Notes**: PG-WF-02 comes after the PG-SEC-01 note of Phase 4, because its scenario proves a binding that does not carry the agent's tool restriction. PG-WF-05 adds `Workflow` to the agent table that Phase 7 changes, and it uses the background launch of Phase 3. The PRD asks that the engine requests of its section 8.4 that serve WF-01 and SEC-01 are filed before this work starts. Phase 4 drafts the SEC-01 request, and filing is the maintainer's step. The corrections to `docs/workflows-compatibility.md` (lines 126 and 164) land here.
**Success Criteria** (what must be TRUE):
  1. A workflow's `agent("...", {agentType: "demo:helper"})` runs the plugin's agent `helper`: the run's agent shows the instructions of the plugin agent (PG-WF-02).
  2. A plugin whose script names `agentType: "demo:ghost"`, with no such agent, installs and prints one note for each such name. The compatibility page no longer says that an unresolved `agentType` is not an error in Claude Code (PG-WF-02).
  3. A scenario passes for each of these run paths: a run the model starts by name with object `args`, `agent({schema})`, `isolation: 'worktree'`, `workflow()` nesting to a sibling, and two scripts with one `meta.name` (PG-WF-07).
  4. The workflow compatibility page says what a workflow subagent can reach, names the engine settings `inheritMainModel` and `providerMiddlewareExtensions`, and says that Pi's built-in MCP cannot load in a subagent and that plugin hooks do not run there. It states the adapter setting as spike S5 measured it (PG-WF-04).
  5. For a bridged agent whose source grants `Workflow` or `Workflow(<name>)`, in a plugin that stages a workflow, `subagent get` shows no `workflow` tool and no forced launch mode, as Claude Code gives the Workflow tool to no subagent, and docs/mcp-compatibility.md says why (PG-WF-05, closed as not a gap under D-PG8-11 option A).

**Plans**: 7/7 plans complete

Plans:
**Wave 1**
- [x] 08-01-PLAN.md -- Wave 1: run spike S5 (the engine in a real pi-subagents background child; the adapter in a workflow subagent) and record it

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md -- Wave 2: note a workflow agent type the plugin does not install, prove the agent type binding, and correct the `agentType` row
- [x] 08-03-PLAN.md -- Wave 2: cover the five uncovered workflow run paths with guard scenarios and a git-repository step

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-04-PLAN.md -- Wave 3: say what a workflow subagent can reach, graded by the spike, and correct the fan-out failure paragraph
- [x] 08-07-PLAN.md -- Wave 3: document the missing-agent note's `info` state in the output catalog, with its fixture and the pinned catalog counts

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-05-PLAN.md -- Wave 4: the maintainer chooses whether a bridged agent may hold the `workflow` tool; under option A, record and pin the drop

**Wave 5** *(blocked on Wave 4 completion; only under option B)*
- [x] 08-06-PLAN.md -- Wave 5: grant `workflow` when the plugin stages a workflow, launch in the background, and prove it with a real child (skipped: option A)

### Phase 9: Adapter Entries and MCP Features

**Goal**: Under pi-mcp-adapter, the entry this project writes for a plugin server keeps a stdio server running for the session, keeps what the user wrote on it, and gives the server only the powers the maintainer decides it may have. The MCP compatibility page says what a plugin server can use beyond tools under each implementation.
**Depends on**: Phase 1
**Requirements**: PG-MCP-06, PG-MCP-09, PG-MCP-08, PG-SEC-03
**Discuss step**: Decisions 5 and 20 come first. Decision 5: write `lifecycle: "lazy-keep-alive"` for stdio servers, which amends ANAME-05. A "no" moves PG-MCP-06 to Out of Scope. Decision 20: write the fields that withhold the `sampling` capability and the MCP UI extension from a plugin server, or record the divergence. Either answer closes PG-SEC-03, and it is recorded with its premise and the adapter version it was checked against.
**Evidence**: PRD section 7.3; report `mcp.md`. Spike S3 measured the prompt command name under the adapter.
**Notes**: PG-MCP-06 changes the entry of an installed plugin's server at its next `update` or `reinstall`, and the design says how. PG-MCP-09 touches the entry merge that keeps a user-written timeout in Phase 1. Nothing in the PRD's table of features beyond tools was run, so the page marks as unmeasured a claim that no scenario or run backs. The two resource scenarios guard against a later regression; they are not expected to fail today.
**Success Criteria** (what must be TRUE):
  1. The adapter entry written for a stdio plugin server holds `lifecycle: "lazy-keep-alive"`, a remote server's entry stays `lazy`, and a lifecycle the user set on the entry is kept (PG-MCP-06).
  2. A user's `protocolVersion: "auto"` on a plugin entry is still there after `/claude:plugin update` and after a reinstall, and so is a user's `tasks`, `exposeResources`, or `caFile` (PG-MCP-09).
  3. Under each profile, a scenario reads a resource of a plugin server (PG-MCP-08).
  4. `docs/mcp-compatibility.md` states, for each implementation, whether a plugin server can use resources, prompts, elicitation, sampling, roots, and output limits, and says that `@server:uri` mentions do not exist on Pi (PG-MCP-08).
  5. Under the adapter, a plugin server's entry holds the fields that withhold `sampling` and the MCP UI extension, or the compatibility page cites the recorded decision that accepts the divergence (PG-SEC-03).

**Plans**: 6/6 plans complete

Plans:
**Wave 1**
- [x] 09-01-PLAN.md -- Wave 1: end the adapter listing wait on Pi's registry so a stub the adapter keeps connected no longer stalls it, and guard a plugin server's resource read under each implementation
- [x] 09-02-PLAN.md -- Wave 1: let the entry marker record a string or boolean default, and model an adapter entry as release 0.23.0 wrote it

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-03-PLAN.md -- Wave 2: write `lifecycle: "lazy-keep-alive"` for stdio plugin servers and `openUi: false` for every plugin server, recorded in the marker, and bring every pinned entry, stub message table, and status row to what the adapter now does

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-04-PLAN.md -- Wave 3: keep a user's `protocolVersion`, `tasks`, `exposeResources`, and `caFile` across an update and a reinstall, and pin a user's lifecycle and openUi across an update

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 09-06-PLAN.md -- Wave 4: record D-PG9-01, D-PG9-07, and D-PG9-08, draft the per-server sampling request with BACKLOG MCPSAMPLING-01, and add the CHANGELOG line

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 09-05-PLAN.md -- Wave 5: correct the MCP compatibility page and the output catalog, and add the features-beyond-tools section, citing the D-PG9 records

### Phase 10: Plugin Options, Variables, and Trust

**Goal**: A plugin's `userConfig` defaults reach its hooks, its MCP servers, and its content, so that a plugin whose options all have a default installs without `--partial`. A user-scope skill or command gets the project directory. A plugin's `bin` directory joins `PATH` only when it exists and, for a project-scope plugin, only when Pi trusts the project. The accepted project trust gap is confirmed or reopened.
**Depends on**: Phase 9
**Requirements**: PG-CORE-03, PG-CORE-05, PG-CORE-06, PG-CORE-07, PG-SEC-02
**Discuss step**: Decision 23 comes first, because PG-SEC-02 and PG-CORE-06 share it: confirm the accepted trust gap of D-LOC-01, or reopen it. The answer is PG-SEC-02 itself. If the gap is confirmed, PG-CORE-06 is the gate on `ctx.isProjectTrusted()`. If it is reopened, the consent record of the PRD's section 7.7 is new work that this roadmap does not hold, and it needs its own requirement. Then decision 17: support `userConfig` defaults and export now (step 1 only), which amends BACKLOG USRCFG-01. A "no" moves PG-CORE-03 to Out of Scope. Then decision 10: fill `${CLAUDE_PROJECT_DIR}` at invocation for user-scope plugins, which amends SUB-02. A "no" moves PG-CORE-05 to Out of Scope.
**Evidence**: PRD section 7.6, and the CORE-03, CORE-06, and SEC-02 rows of section 7.7; report `core.md`.
**Notes**: PG-CORE-03 fills variables in the MCP entry fields that Phase 9 also changes. A `userConfig` value is not written into `mcp-adapter.json`: the entry can reference a process variable, as it does for `CLAUDE_PROJECT_DIR`. Steps 2 and 3 of the PRD's CORE-03 (values the user sets, and the dialog) are not scheduled. PG-CORE-06 closes the case where Pi asked for trust and the answer is "no" or pending. It does not close the gap of PG-SEC-02. No scenario covers the `bin` on `PATH` behavior today. The corrections to `docs/env-vars.md:180`, `shared/session-env.ts:145-146`, PENV-01 in `PROJECT.md`, and BACKLOG USRCFG-01 land here.
**Success Criteria** (what must be TRUE):
  1. A plugin with `userConfig: {"mode": {"type": "string", "default": "fast"}}` and a hook that prints `$CLAUDE_PLUGIN_OPTION_MODE` prints `fast`, and the plugin installs without `--partial`. A plugin with a required option that has no default is refused without `--partial` (PG-CORE-03).
  2. `${user_config.KEY}` is filled with the default in an exec-form hook command and its arguments, in `command`, `args`, `env`, `url`, and `headers` of a plugin server under both profiles, and in skill and agent content. A sensitive value is not written into skill or agent content (PG-CORE-03).
  3. A user-scope command with `project ${CLAUDE_PROJECT_DIR}` sends the project path when the user types it and when the model runs it through `run_plugin_command`. A user-scope skill shows the path when the model reads its staged `SKILL.md`. An agent body stays as it is (PG-CORE-05).
  4. In a project the user marked "Do not trust", with an enabled project-scope plugin that has `bin/hello`, the bash tool does not find `hello`; in a trusted project it does. With two enabled plugins, one of them with `bin/`, the bash tool's `PATH` holds one plugin entry (PG-CORE-06, PG-CORE-07).
  5. The decision on the trust gap of D-LOC-01 is in `PROJECT.md` with its premise and the Pi version it was checked against (PG-SEC-02).

**Closeout (2026-11-15):** 6/6 truths, one by override: the maintainer's PG-SEC-02 answer to D-PG10-01 (option A, pending maintainer review) is carried, and PG-SEC-02 stays Pending. PG-CORE-03, -05, -06, and -07 are complete. `npm run check` passed (exit 0) at 16ef48af: 1983 adapter-profile and 199 builtin-profile scenarios. The review loop added D-PG10-25, pending maintainer review. See `10-VERIFICATION.md`.

**Plans**: 21/21 plans complete

Plans:
**Wave 1**
- [x] 10-01-PLAN.md -- Wave 1: let a scenario publish an executable plugin file and start Pi in a project the user marked "Do not trust", with two guard scenarios for a plugin `bin` on `PATH`
- [x] 10-02-PLAN.md -- Wave 1: parse and resolve a plugin's `userConfig` in one pure module, and prove against pi-mcp-adapter that an escaped option value comes out as the raw default
- [x] 10-03-PLAN.md -- Wave 1: fill `${CLAUDE_PROJECT_DIR}` for a user-scope skill or command when it is invoked, when the model reads it, and through `run_plugin_command`

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-04-PLAN.md -- Wave 2: keep an untrusted project's plugin `bin` off `PATH`, and add a plugin's `bin` only when the folder exists
- [x] 10-05-PLAN.md -- Wave 2: install a plugin whose options all have a default without `--partial`, make a malformed `userConfig` unavailable, and keep a required option with no default partially available

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-06-PLAN.md -- Wave 3: give the required-option arm the reason `options not set` on every surface, and list the unset option keys in `info`
- [x] 10-07-PLAN.md -- Wave 3: keep the option schema on the install record, at install and at every restage

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-08-PLAN.md -- Wave 4: export each option default to hooks as `CLAUDE_PLUGIN_OPTION_<KEY>` at every load, from the install record and through one reader that validates it again
- [x] 10-09-PLAN.md -- Wave 4: write plugin option defaults into skill content at staging, with the sensitive-option text for a sensitive option

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-10-PLAN.md -- Wave 5: set an escaped process variable for each plugin option, owned through a ledger, with the project scope only in a trusted project
- [x] 10-11-PLAN.md -- Wave 5: fill plugin options in exec-form hook commands and arguments, fail a run that names an unset option, and refuse a shell-form command that names one
- [x] 10-12-PLAN.md -- Wave 5: leave an MCP server that names an option with no value out of `mcp-adapter.json` at install, and report it with the `option-blocked` notice

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 10-13-PLAN.md -- Wave 6: leave such a server out at update, reinstall, and the load-time MCP move, and drop its notice when the command unstages the plugin
- [x] 10-14-PLAN.md -- Wave 6: do not register with Pi's built-in MCP a server that names an option with no value
- [x] 10-15-PLAN.md -- Wave 6: leave out and report a stdio server whose command or argument starts with an option that holds a home path

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 10-16-PLAN.md -- Wave 7: give hooks their option variables in the session that installed, enabled, updated, or reinstalled the plugin
- [x] 10-17-PLAN.md -- Wave 7: fill plugin options in the five MCP fields under pi-mcp-adapter, as a reference in `mcp-adapter.json` and never as a value

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 10-18-PLAN.md -- Wave 8: write plugin option defaults into command and agent content at staging, preloaded skills included
- [x] 10-19-PLAN.md -- Wave 8: fill plugin options in the five MCP fields under Pi's built-in MCP, in memory, and run the field scenarios under both profiles

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 10-20-PLAN.md -- Wave 9: record D-PG10-01 and the seven other pending decisions, amend D-LOC-01, PENV-01, D-CF5-15, and BACKLOG USRCFG-01, draft the Pi trust-paths request, and add the CHANGELOG lines
- [x] 10-21-PLAN.md -- Wave 9: correct `docs/env-vars.md`, the hooks compatibility page, and the MCP compatibility page for plugin options, the project directory, and the `PATH` rule

### Phase 11: Skills, Commands, and Records

**Goal**: A typed plugin command or skill attaches the files its author referenced, a command answers to the name Claude Code gives it, and alias suggestions show what their target does. Skills and commands get a compatibility page whose every row cites its proof, and the records that no requirement owns are corrected.
**Depends on**: Phase 6, Phase 10
**Requirements**: PG-SKILL-01, PG-CMD-09, PG-SKILL-11, PG-DOC-01, PG-DOC-02
**Discuss step**: Decision 13 comes first: add the Claude Code name of a command as an alias, which amends D-141-01. A "no" moves PG-CMD-09 to Out of Scope.
**Spike first**: S8 is the first work, by the rules of `.agents/skills/claude-code-compat-research`: what text does an `@file` reference attach in Claude Code, and is a path that arrives through an argument attached? It gates PG-SKILL-01. The same probe run asks whether hooks get the plugin `bin` on `PATH`, which the `PATH` row of `docs/env-vars.md` in PG-DOC-02 needs.
**Evidence**: PRD sections 7.1 and 10; report `skills-commands.md`, and for PG-DOC-02 the reports `hooks.md`, `mcp.md`, `workflows.md`, and `core.md`.
**Notes**: PG-DOC-01 is the last work: its status table cites scenarios, so it follows the skill and command behavior of Phases 4, 6, and 10 and of this phase. The status table in the skills and commands report is its starting content. PG-SKILL-01 changes the typed-line handler that Phase 6 changes for `UserPromptExpansion`. Open for its design: a size limit, symbolic links, and what a directory reference does. An attached file does not pass through a `PreToolUse` hook on `Read`, which is why a path from an argument is not attached. PG-DOC-02 is one documentation task over the eight rows of the PRD's section 10 marked "none".
**Success Criteria** (what must be TRUE):
  1. A command body `Review @${CLAUDE_PLUGIN_ROOT}/templates/x.md` reaches the scripted model with the template text in a `<file>` block. When the user types `/demo:review @/etc/hostname`, the model receives the argument as text with no `<file>` block (PG-SKILL-01).
  2. A `@path` in the output of an injected `!` command is not attached; a `@path` inside fenced code or a code span is attached, as in Claude Code (PG-SKILL-01; D-PG11-03 reversed 2026-11-16).
  3. With `demo/commands/demo-lint.md`, the typed text `/demo:demo-lint x` sends the command body, as `/demo:lint x` does (PG-CMD-09).
  4. The alias scenarios in `features/skill/aliases.feature` and `features/slash-command/aliases.feature` assert the description column: each alias suggestion shows the description of its target and, for a skill, its `argument-hint` (PG-SKILL-11).
  5. `docs/skills-commands-compatibility.md` covers the dropped fields, `!` injection, the `run_plugin_command` tool, the skill-read fill, and the name mapping, and each row of its status table cites a scenario that passes. The eight statements that the PRD's section 10 marks "none" are corrected, and a claim that only a spike can settle is marked unmeasured (PG-DOC-01, PG-DOC-02).

**Plans**: 8/8 plans complete

Plans:
**Wave 1**
- [x] 11-01-PLAN.md -- Wave 1: make a typed command answer to the name Claude Code gives it, stored at staging and read under the existing alias rules, and describe the alias in both READMEs

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02-PLAN.md -- Wave 2: show each alias suggestion's description and argument hint in Pi's menu, and read a hint that is not a string as Claude Code does

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 11-03-PLAN.md -- Wave 3: find the author-written `@` file mentions of a body in one pure module, with code masked, and turn a file's bytes into Pi's file block

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 11-04-PLAN.md -- Wave 4: attach the files a typed command's body mentions, behind an injected reader, with guards for a path from an argument, from code, and from a `!` command

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 11-05-PLAN.md -- Wave 5: attach the files a typed skill's body mentions inside Pi's skill block, with a guard for a path from an argument and for the model's own read

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 11-06-PLAN.md -- Wave 6: correct the eight statements that the PRD's section 10 marks "none", in four pages, four BACKLOG entries, three code comments, and one scenario description

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 11-07-PLAN.md -- Wave 7: record D-PG11-01, D-PG11-02, and D-PG11-03, amend D-141-01, fill the S8 result cell, and add the CHANGELOG lines and two BACKLOG records

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 11-08-PLAN.md -- Wave 8: write `docs/skills-commands-compatibility.md` with a status table whose every row cites a scenario line, link it from both READMEs, and run the full gate on the combined tree

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Companion Floors and MCP Defaults | 11/11 | Complete    | 2026-11-12 |
| 2. Hook Payloads, Matchers, and Stop Limit | 10/10 | Complete    | 2026-11-13 |
| 3. Background Subagents | 8/8 | Complete    | 2026-11-13 |
| 4. Skill and Workflow Install Defects | 6/6 | Complete    | 2026-11-14 |
| 5. Stop Continuation and Hook Failures | 6/6 | Complete    | 2026-11-14 |
| 6. Hook Inputs and Events | 13/13 | Complete    | 2026-11-15 |
| 7. Agent Frontmatter and Grants | 6/6 | Complete    | 2026-11-14 |
| 8. Workflow Agents and Run Paths | 7/7 | Complete    | 2026-11-15 |
| 9. Adapter Entries and MCP Features | 6/6 | Complete    | 2026-11-14 |
| 10. Plugin Options, Variables, and Trust | 21/21 | Complete    | 2026-11-15 |
| 11. Skills, Commands, and Records | 8/8 | Complete    | 2026-11-16 |

## Carried Forward

- behavioral-gaps: the 25 BACKLOG entries the milestone added (among them ASYNCNEWSESSION-01, AMIGTRUST-01, WORKERHOMEDIR-01, SESSIONENDENV-01, PRUNECFG-01) in [BACKLOG.md](BACKLOG.md); the unknown writer to the real `~/.pi` during `npm run check` (P1-DC-53); Nyquist validation for phases 2, 3, 4, 8, 9, 10, 11, 12, 14, and 16.
- mcp-builtin: BACKLOG COMPLIMPL-01, STAMPTYPE-01, GRANTRUNARG-01, STAMPREQ-01, EDGEDEPSCASES-01, PENDAPPLY-01, CONTAINCATCH-01, BLTREPEAT-01, SUBCHILDVAR-01, BLTOWNER-01 (narrowed), DENYPIN-01, and the 17 deferred built-in MCP items in [BACKLOG.md](BACKLOG.md); Phase 2's one open Nyquist gap (a `/reload` implementation switch, MSEL-02); the Pi 1.5.0 RPC double `session_start` fix on `acolomba/pi` branch `fix/rpc-double-session-start`, for the user to report upstream.
- component-features: upstream fixes wait on the user's review on forks `acolomba/pi` (`fix/input-transform-expand-opt-out`) and `acolomba/pi-subagents` (`fix/mcp-direct-tools-adapter-7`); MCPBG-01, PIEXPAND-01, WFLOCAL-01 and MCPCANARY-01 stay in [BACKLOG.md](BACKLOG.md); D-CF7-05 awaits a live probe of Claude Code.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Closed under D-BG-1001 (behavioral-gaps Phase 10, pending user review, P10-DC-01): the json-output `09/` D-03 choice. The LLM tools return `isError: true`, never throw; Pi 1.5.0 delivers a returned `isError` to the model as a failed tool result.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
