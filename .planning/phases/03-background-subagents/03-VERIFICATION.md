---
phase: 03-background-subagents
verified: 2026-11-14T01:30:00Z
status: passed
score: 31/31 must-haves verified
covered_files: [".planning/phases/03-background-subagents/03-01-PLAN.md",".planning/phases/03-background-subagents/03-01-SUMMARY.md",".planning/phases/03-background-subagents/03-02-PLAN.md",".planning/phases/03-background-subagents/03-02-SUMMARY.md",".planning/phases/03-background-subagents/03-03-PLAN.md",".planning/phases/03-background-subagents/03-03-SUMMARY.md",".planning/phases/03-background-subagents/03-04-PLAN.md",".planning/phases/03-background-subagents/03-04-SUMMARY.md",".planning/phases/03-background-subagents/03-05-PLAN.md",".planning/phases/03-background-subagents/03-05-SUMMARY.md",".planning/phases/03-background-subagents/03-06-PLAN.md",".planning/phases/03-background-subagents/03-06-SUMMARY.md",".planning/phases/03-background-subagents/03-07-PLAN.md",".planning/phases/03-background-subagents/03-07-SUMMARY.md",".planning/phases/03-background-subagents/03-08-PLAN.md",".planning/phases/03-background-subagents/03-08-SUMMARY.md","docs/hooks-compatibility.md","docs/mcp-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts","extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts","extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts","extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts","extensions/pi-claude-marketplace/bridges/hooks/runtime.ts","extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts","features/agent/frontmatter.feature","features/agent/invocation.feature","features/lib/agent-files.ts","features/lib/real-subagent-child.ts","features/lib/subagent-hook-session.ts","features/mcp-server/agent-grants.feature","features/mcp-server/verdict-markers.feature","features/plugin/subagent-child.feature","features/step_definitions/agent/listing.steps.ts","features/step_definitions/mcp-server/agent-grants.steps.ts","features/step_definitions/plugin/subagent-hooks.steps.ts","features/support/pi-process.ts","test/bridges/agents/convert.test.ts","test/bridges/agents/grant-forms.test.ts","test/bridges/agents/grant-rewrite.test.ts","test/bridges/agents/legacy-grant-form.test.ts","test/bridges/agents/mcp-async-warning.test.ts","test/bridges/agents/stage.test.ts","test/bridges/hooks/async-rewake/registry.test.ts","test/bridges/hooks/dispatch-exec.test.ts","test/bridges/hooks/event-router.test.ts","test/bridges/hooks/payloads/post-tool-use-failure.test.ts","test/bridges/hooks/payloads/post-tool-use.test.ts","test/bridges/hooks/payloads/pre-tool-use.test.ts","test/bridges/hooks/runtime.test.ts","test/bridges/hooks/translation-context.test.ts","test/integration/hooks-dispatch-end-to-end.test.ts","test/integration/pi-subagents-child-identity.test.ts","test/integration/subagent-hook-ownership.test.ts","test/orchestrators/plugin/install-flow-ledger.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/reinstall-flow.test.ts","test/orchestrators/plugin/update-swap.test.ts"]
covered_digest: "v4:sha256:a1f54f567577f0cfdcaefce1170d070bf1b433544876e5bb606483d80e8e9517"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "PG-HOOK-07a unclassified probe row: child tool hook session_id, transcript_path and CLAUDE_CODE_SESSION_ID"
    reason: "Not a phase 3 criterion or plan truth. Deferred to Phase 6 as decision 26 and success criterion 6 (ROADMAP), tracked as BACKLOG CHILDSESSIONID-01; current behavior documented in docs/hooks-compatibility.md Child identity (commit a98ae4ae). pi-subagents passes PI_SUBAGENT_PARENT_SESSION to background children, so parity is reachable there."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T01:50:00Z"
decision_coverage:
  honored: 9
  total: 9
  not_honored: []
human_verification: []
---

# Phase 3: Background Subagents Verification Report

**Phase Goal:** A bridged agent starts as a Claude Code subagent starts by default: in the launch mode that pi-subagents chooses, which is the background. A pi-subagents child that loads this extension runs the plugin's tool hooks and none of its main-session hooks.

**Verified:** 2026-11-14T01:30:00Z
**Status:** passed (one item deferred by autonomous override; see Override below)
**Re-verification:** No — initial verification

## Verification Basis

Read all eight plans and summaries, CONTEXT, RESEARCH (A1, open questions), VALIDATION, REVIEW, REVIEW-FIX, REVIEW-DISPOSITION, REQUIREMENTS, the ROADMAP Phase 3 section and the Phase 2 report. The verdict rests on the code diff `cab4a540..HEAD` (60 commits, 48 changed files under `extensions/`, `features/`, `test/`, `docs/`), the actual callers, the complete assertions of the named tests, and independent runs. No previous `03-VERIFICATION.md` and no override existed.

In the tables, **H/** means `extensions/pi-claude-marketplace/bridges/hooks/` and **A/** means `extensions/pi-claude-marketplace/bridges/agents/`.

**Gate G (cited, not rerun):** `npm run check` exit 0 at `b0246dfa` (after the review fixes), Node v26.13.1, log `/tmp/pg3-fix-check.log`: adapter profile 1,893 scenarios / 23,130 steps (seed 65615), builtin profile 184 scenarios / 2,492 steps (seed 674771), all 361 direct pairs merged. The tail of the log was read and matches. `git diff --stat b0246dfa..HEAD` touches only three `.planning/` files, so G applies to HEAD.

**Independent runs by this verifier (hermetic HOME under the session scratchpad, plus `test/platform/isolated-pi-home.ts`):**

- **S1:** 11 owner test files (event-router, runtime, translation-context, the three payload translators, dispatch-exec, mcp-async-warning, convert, grant-rewrite, legacy-grant-form): 610/610 pass. Includes the 20 cases `{main,child} routes <event> by the ten-event policy`.
- **S2:** async-rewake registry, update-swap, reinstall-flow, grant-forms, stage: 670/670 pass. Includes the D-PG3-03 load/update/reinstall/retry cases and the child journal ownership, recovery and identity-omission cases.
- **S3:** `test/integration/pi-subagents-child-identity.test.ts` and `test/integration/subagent-hook-ownership.test.ts` against the installed pi-subagents 0.88.1 and pi-mcp-adapter 7.0.1: 8/8 pass (detached adapter and builtin children, ordinary empty-body agent in the companion's default mode under both profiles, foreground default, concurrent same-PID sessions, parent/sibling survival, dead-owner recovery).

## Goal Achievement

### Roadmap Success Criteria

| ID | Roadmap truth | Status | Evidence |
| --- | --- | --- | --- |
| R1 | `subagent get` shows no `async false` line for a plain bridged agent; `background: true` and plugin-MCP agents still show the background mode; the scenario "A call that leaves the launch mode open runs a bridged agent in the foreground" is replaced. | VERIFIED | `A/convert.ts:1035` spreads `async: true` only when `backgroundForMcp \|\| isTrueBackground`. `features/agent/frontmatter.feature` "An ordinary bridged agent leaves its launch mode to pi-subagents" asserts the exact `subagent get` result: no `async` line for `demo:plain`, `async true` for `background: true` and `"true"`, and the exact generated file with no `async` key. The old scenario title appears nowhere in `features/` or `test/`. MCP agents: "Explicit background and MCP grants keep a child in the background" runs `granted` and `granted-false` as detached background children under `asyncByDefault: false`. Passed in G; S3 reproduces the real-child runs. |
| R2 | The MCP warning no longer says Claude Code runs agents in the foreground; a file holding the earlier warning still follows an MCP implementation switch at the next session start. | VERIFIED | `A/mcp-async-warning.ts:37` emits the corrected generation ("which require a pi-subagents background child -- the agent runs in the background (`async: true`); ..."); exact public diagnostics in `features/mcp-server/verdict-markers.feature:338,372`. `isMcpAsyncWarning` and `rewriteMcpAsyncWarning` recognize both generations exactly and keep the found generation; `A/grant-rewrite.ts:131` and `A/legacy-grant-form.ts:86` consume them. `features/mcp-server/agent-grants.feature`: "An old MCP warning still permits a grant implementation switch", the reverse switch, the implementation-less outline, the user-edit and near-match scenarios. Passed in G and S1. |
| R3 | In the stand-in child of `features/plugin/subagent-child.feature`, recording `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd` hooks record no run, and `PreToolUse` still runs. | VERIFIED | `H/event-router.ts:138-156` `CHILD_EVENT_POLICY` (exhaustive `satisfies Record<BucketAEvent, ...>`) gates `session_start`, `input`, `session_before_compact`, `session_compact`, `session_shutdown` and `agent_settled`. Stand-in scenario "A child runs tool hooks without main-session hooks" asserts the exact turn table: only the four tool rows, no SessionStart/UserPromptSubmit/Stop. **SessionEnd note:** that table is read while the stand-in Pi still runs (`promptInStartupSession` reads the logs after `agent_settled`), so it cannot observe a shutdown-time SessionEnd; the main-session control scenario shows no SessionEnd row either. The SessionEnd half is proven instead by the owner case `child routes SessionEnd by the ten-event policy` (drives the registered `session_shutdown` handler, S1) and by S3, where the pi-subagents runner emits `session_shutdown` with reason `quit` at child end (pi-subagents bundle `chunk-PCZEQQAQ.js:7681`), the recording `ending` SessionEnd hook is installed (`features/lib/real-subagent-child.ts:152`), the runner is awaited to exit before the runs are read, and `runsOf(child)` is asserted exactly with no SessionEnd row. |
| R4 | A child tool hook receives `agent_type`, and `agent_id` when knowable; the same hook in a main session receives neither. | VERIFIED | `H/runtime.ts` `captureChildIdentity` parses the anchored `<active_agent name="..."/>\n\n` prefix from Pi's structured prompt options at `before_agent_start`; `childIdentityFor` returns `main` outside a child and `unavailable` for another session. `H/translation-context.ts` attaches the snapshot only when its session matches; all three payload translators spread `agent_type`/`agent_id` only then. Scenarios "A child tool hook identifies its own agent and session" (4 examples incl. entity decoding and a spoofed body), "A main tool hook has no child identity", "A child keeps its own identity after another session runs", "Missing child metadata clears the previous identity"; real children in S3 carry `agent_type` = agent name and `agent_id` = child session id; main runs carry `{}`. |

### Plan Observable Truths

| ID | Truth | Status | Evidence |
| --- | --- | --- | --- |
| P01.1 | A child never reaps or rewrites the parent legacy PID table or another live runtime's journal. | VERIFIED | `H/async-rewake/registry.ts:261` routes child persistence through `runtime.persistenceOwner`; `H/runtime.ts` `pidTableEntries` filters by owner. Registry cases (journal isolation, foreign-journal preservation for invalid/oversized/mismatched files, live/EPERM/unknown owners keep rows) pass in S2; ownership integration passes in S3. |
| P01.2 | The exhaustive ten-event policy admits only the three tool events in children while retaining internal setup and owned cleanup. | VERIFIED | `CHILD_EVENT_POLICY` plus 20 `{main,child} routes <event>` owner cases (S1); "child hydrates user tool hooks without executing untrusted project hooks" (S1); `sessionShutdownCallback` drains only in a child (`finally` branch). |
| P01.3 | The anchored structured prefix yields a factory-local session identity; malformed or missing metadata clears stale identity with a bounded diagnostic. | VERIFIED | `ACTIVE_AGENT_PREFIX` regex, `resetChildIdentity` at registration, `CHILD_IDENTITY_DIAGNOSTIC` at `H/event-router.ts:152,279`. Runtime cases for missing sections, missing delimiter, malformed tag, conflicting sections (S1); "Missing child metadata clears the previous identity" in G. |
| P02.1 | Recognition admits only complete exact historical/corrected strings; a near-match never gains migration eligibility. | VERIFIED | Strict `===` comparison over `WARNING_GENERATIONS`; near-match owner cases (S1) and the near-match scenario in G. |
| P02.2 | Both warning generations survive adapter/builtin round trips, including implementation-less rows. | VERIFIED | `rewriteMcpAsyncWarning` returns the same generation's form; legacy-grant-form and grant-rewrite cases (S1); both-profile agent-grants scenarios in G. |
| P02.3 | A user-edited generated file is preserved with provenance; locks, containment, atomic replacement and retry recovery remain intact. | VERIFIED | `grant-rewrite.ts` diff changes only the candidate predicate; "A user's agent edit survives an MCP implementation switch" in G; grant-rewrite owner cases (S1). |
| P03.1 | PreToolUse includes actual agent_type and current child session ID on sync, plain async and asyncRewake. | VERIFIED | `H/dispatch-exec.ts:206` and `H/async-rewake/registry.ts:254` both read `childIdentityFor` and call `buildTranslationContext`; dispatch-exec and registry identity cases (S1, S2). |
| P03.2 | Main, unavailable and stale-session contexts own neither identity property. | VERIFIED | Registry "omits identity from main/unavailable child plain async/asyncRewake stdin" (S2); translation-context stale-session cases (S1). |
| P03.3 | A captured payload keeps its identity when another runtime/session starts; Phase 2 translation and process ownership stay intact. | VERIFIED | Immutable snapshot copied into `TranslationContext`; registry delayed-exit and dispatch-exec cases (S1/S2); Phase 2 hook suites pass in G. |
| P04.1 | Fresh adapter/builtin output explains that MCP requires background and keeps the implementation suffix. | VERIFIED | `CORRECTED_WARNINGS` reuse `ADAPTER_SUFFIX`/`BUILTIN_SUFFIX`; mcp-async-warning cases (S1). |
| P04.2 | Conversion, staging, install and public diagnostics contain the corrected warning without duplicate or lost messages. | VERIFIED | convert/stage/install-outcome expectations (S1, S2, G); verdict-markers exact rows in G; "either order of equivalent ... MCP grants runs in the background with one warning" (S1). |
| P04.3 | Historical stored warnings still switch exactly and user edits remain protected under both profiles. | VERIFIED | Same evidence as R2/P02.3 under both cucumber profiles in G. |
| P05.1 | Successful and failed child tool hooks carry the same identity as PreToolUse, Phase 2 semantics preserved. | VERIFIED | post-tool-use(-failure) translators; payload owner cases (S1); stand-in identity outline asserts all four tool rows; S3 real children. |
| P05.2 | A child's blocking main-session Stop hook cannot stop child completion; lifecycle and compaction hooks stay absent while main controls run. | VERIFIED | `agent_settled` wrapper skips Stop/StopFailure in a child; "A child ignores a Stop hook that would continue the main session", "Child compaction runs no main-session hooks", "A main session still runs its lifecycle hooks" in G; S3 children reach `complete` with a blocking Stop hook installed. |
| P05.3 | Parent and sibling hook processes survive child load, writes, exit and reload; a verified dead owner is recoverable. | VERIFIED | "Loading and stopping a child leaves parent and sibling hooks running" in G; S3 ownership tests (parent/sibling survival, dead-owner recovery). |
| P06.1 | Each child tool event carries identity through sync, plain async and asyncRewake, with main/stale/missing controls. | VERIFIED | dispatch-exec and registry identity cases (S1, S2), integration end-to-end changes in G. |
| P06.2 | The installed companion completes detached children with loopback fixtures and dummy credentials, without hand-injected identity. | VERIFIED | S3: `detached adapter/builtin children ... hook with their own identity`; identity comes from pi-subagents' own prompt tag; `providerModels` is `["scripted"]`. |
| P06.3 | Concurrent same-PID children keep distinct sessions/types through append/replace modes, repeated runs and cleanup. | VERIFIED | S3 "concurrent child sessions in one runner process keep their own hook identity across runs and new sessions"; scenario "Concurrent companion children keep separate hook identities" in G. |
| P06.4 | A main Stop hook that would block cannot prevent child completion; no parent/sibling process or journal is damaged. | VERIFIED | S3 children `state: complete`; ownership integration (S3). |
| P07.1 | Ordinary absent/false background emits no async key, including an empty body. | VERIFIED | `A/convert.ts:1035`; "D-PG3-01: an ordinary agent with an empty body leaves its launch mode to pi-subagents" (S1). |
| P07.2 | Accepted true parsing and effective MCP grants emit async true; MCP wins over source false. | VERIFIED | Same expression; `granted-false` runs in background in G/S3; convert cases (S1). |
| P07.3 | Reversing equivalent MCP grant order leaves launch preference and warning unchanged. | VERIFIED | "D-PG3-02: either order of equivalent adapter/builtin MCP grants runs in the background with one warning" (S1). |
| P07.4 | The real companion picks its default or configured mode when preference is absent; explicit foreground controls keep their meaning. | VERIFIED | S3: ordinary agent detached under default (both profiles), foreground under `asyncByDefault: false`; frontmatter scenarios in G. |
| P08.1 | A normal load preserves earlier ordinary bytes; update and reinstall regenerate atomically and safely on retry. | VERIFIED | S2: three D-PG3-03 cases (load keeps `async: false` bytes; update and reinstall regenerate; failed save restores bytes and retry completes); frontmatter update/reinstall scenarios in G. |
| P08.2 | A real ordinary empty-body child with no override completes with correct identity, three tool outcomes, zero lifecycle hooks, and preserved controls. | VERIFIED | S3 ordinary empty-body cases for both profiles assert exact child runs and main control runs. |
| P08.3 | Compatibility docs state event policy, identity provenance, conservative recovery, default/forced modes and migration boundaries. | VERIFIED | `docs/hooks-compatibility.md:33-73` and `docs/mcp-compatibility.md:384-405,635` checked against the code above; the IN-01 recovery correction is present. |

PLAN truths are listed one by one even where they overlap a roadmap criterion; none was merged. **Score: 31/31 (4 roadmap + 27 plan), 0 behavior-unverified.** Every behavior-dependent truth (event routing, identity capture and staleness, shutdown drain, journal ownership, migration retry) has a named passing test from S1–S3 or G.

### Decision Coverage

D-PG3-01..09 all honored: 01/02 in `convert.ts`; 03 in the load/update/reinstall tests and both-generation recognition; 04/05 in `CHILD_EVENT_POLICY` and retained hydration/trust/drain; 06 in prompt-tag identity with session binding and no fabrication; 07 in unchanged Phase 2 suites under G; 08 in the replaced and added scenarios; 09 in the real-companion driver and integration tests.

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `H/runtime.ts` | VERIFIED | Identity capture, session-bound read, journal owners; used by event-router, dispatch-exec, registry. |
| `H/async-rewake/registry.ts` | VERIFIED | Child journals, owner-scoped persistence, shutdown row removal (WR-01), main-session keep-running on table failure (IN-02). |
| `H/event-router.ts` | VERIFIED | Child policy gating on six Pi events, before-run capture, child-only shutdown drain (CR-01). |
| `H/translation-context.ts`, `H/payloads/*.ts`, `H/dispatch-exec.ts` | VERIFIED | Identity snapshot flows into all three translators on every lane. |
| `A/convert.ts`, `A/mcp-async-warning.ts`, `A/legacy-grant-form.ts`, `A/grant-rewrite.ts` | VERIFIED | True-only `async`; corrected emitter; exact two-generation recognition. |
| `features/lib/real-subagent-child.ts`, `features/lib/subagent-hook-session.ts` | VERIFIED | Consumed by step files and the integration tests. |
| `features/plugin/subagent-child.feature`, `features/agent/frontmatter.feature`, agent-grants and verdict-markers features | VERIFIED | Exact assertions; passed in G. |
| `test/integration/pi-subagents-child-identity.test.ts`, `test/integration/subagent-hook-ownership.test.ts` | VERIFIED | 8/8 in S3. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| event-router `before_agent_start` | runtime | `captureChildIdentity` / `childIdentityFor` | WIRED (`H/event-router.ts:277-279`) |
| registry | runtime | `persistenceOwner` / `pidTableEntries(loc, owner)` | WIRED (`registry.ts:261,441,544`) |
| dispatch-exec | translation-context | `childIdentityFor` + `buildTranslationContext` | WIRED (`dispatch-exec.ts:206`) |
| registry | payload translators | `buildTranslationContext` + translate | WIRED (`registry.ts:254-255`) |
| legacy-grant-form / grant-rewrite | mcp-async-warning | `rewriteMcpAsyncWarning` / `isMcpAsyncWarning` | WIRED |
| convert | mcp-async-warning | `mcpAsyncWarning` (corrected generation) | WIRED |
| integration test and steps | real-subagent-child | `runRealSubagentChild` / `runConcurrentRealSubagentChildren` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Child/main event policy, identity, payloads, warnings, conversion | `node --import test/platform/isolated-pi-home.ts --test` on 11 owner files | 610/610 | PASS |
| Journal ownership, migration on update/reinstall/retry | same, 5 owner files | 670/670 | PASS |
| Real pi-subagents 0.88.1 children (detached, default, foreground, concurrent, ownership) | same, the two integration files | 8/8 | PASS |

### Probe Execution

None declared. `scripts/*/tests/probe-*.sh` does not apply to this phase; its evidence is the named tests above.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-AGENT-01 | 03-02, 03-04, 03-06, 03-07, 03-08 | SATISFIED | R1, R2, P02–P04, P07, P08.1. Its migration clause (line 16 of REQUIREMENTS) is met: `async: false` changes at update/reinstall, not at load. |
| PG-HOOK-07a | 03-01, 03-03, 03-05, 03-06, 03-08 | SATISFIED (flag retained) | R3, R4, P01, P03, P05, P06, P08.2. The unclassified probe row stays flagged; see Human Verification. |

No orphaned requirement: REQUIREMENTS maps only these two IDs to Phase 3, and both appear in plan frontmatter. Both still read "Pending" in the traceability table; updating that is an orchestrator step.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `A/mcp-async-warning.ts` | 3-6 | Stale module header: "launches in the background where Claude Code runs it in the foreground. Both MCP implementations have the same foreground gap". The ROADMAP notes say the correction to this file lands in this phase; the emitted text was corrected, the header was not. | Warning | Comment only, contradicts D-PG3-01 and the corrected warning; no user-visible effect. Fix in a follow-up quick task. |
| changed files (48) | -- | TBD/FIXME/XXX/TODO/HACK | -- | None found. |

### Flagged Items Assessed

- **PG-HOOK-07a unclassified probe row: retained.** 03-08 told the verifier to review the covered edge list and keep the flag if an edge is uncovered. The listed edges (ten-event policy, stale/missing identity, trust, parent/sibling process safety, real concurrent children) are covered. One edge is not: in a child, `session_id`, `transcript_path` and `CLAUDE_CODE_SESSION_ID` name the child's own Pi session, the same value as `agent_id` (`translation-context.ts` takes `sessionId` from the child's session manager). Claude Code appears to keep the main session in those base fields and add `agent_id` beside them. No research, decision or doc covers this. This goes to the user (Human Verification 1); it does not falsify any roadmap criterion.
- **Research A1: open, risk accepted by design.** If another ambient extension alters the prompt tag, the bridge omits both identity fields and logs the bounded diagnostic; it never invents a name. Defensive cases pass (S1, "Missing child metadata clears the previous identity" in G), and every supported real launch carries the tag (S3). No action needed beyond keeping the flag.
- **Foreground child loads no ambient extension.** Under `asyncByDefault: false` an ordinary agent runs in the foreground and no plugin hook runs for its tool calls. This is documented as a Pi capability gap in `docs/hooks-compatibility.md:67`, which the project constraints accept as grounds for a divergence. It is consistent with the goal, which covers a child "that loads this extension". S3 shows it.
- **WR-03 (deferred): pre-existing, not a phase gap.** A main-session `/reload` race on the shared PID table exists at `cab4a540`; carried in `.planning/BACKLOG.md:5289` ASYNCRELOADTABLE-01. It concerns main sessions, not the child behavior this phase adds.

### Human Verification Required

### 1. Child session fields in tool hook payloads

**Test:** Decide whether, in a pi-subagents child, the tool hook stdin `session_id` and `transcript_path`, and the `CLAUDE_CODE_SESSION_ID` variable, should name the main session or the child's own session (as now, equal to `agent_id`). Check Claude Code's subagent hook input to settle the upstream contract first (`claude-code-compat-research`).
**Expected:** Either record the current behavior as a divergence with a reason in `docs/hooks-compatibility.md` "Child identity", or file a follow-up requirement. Either way, close the PG-HOOK-07a unclassified probe row.
**Why human:** Upstream parity choice the project routes to the user. The verifier's evidence is partial: Claude Code 2.1.323's SubagentStop schema has `agent_transcript_path` beside the base `transcript_path`, which suggests the base fields name the main session; this was not confirmed for the tool events.

### Gaps Summary

No gaps. All four roadmap criteria and all 27 plan truths are verified with behavioral evidence: gate G, plus three independent hermetic runs by this verifier (1,288 owner tests and 8 real-companion integration tests). Status is `human_needed` for one reason only: the PG-HOOK-07a unclassified row stays flagged, because the child's `session_id`/`transcript_path` parity with Claude Code was never researched or decided. One non-blocking warning: the stale header comment in `bridges/agents/mcp-async-warning.ts`.

---

_Verified: 2026-11-14T01:30:00Z_
_Verifier: Claude (gsd-verifier)_

## Override (orchestrator, autonomous run)

The single human-verification item, the session fields of a child tool hook, is deferred rather than decided here. It was not a Phase 3 criterion or plan truth. It is carried to Phase 6 as decision 26 and success criterion 6, tracked as BACKLOG CHILDSESSIONID-01, and the current behavior is documented in `docs/hooks-compatibility.md` (commit `a98ae4ae`, which also fixed the stale `mcp-async-warning.ts` header comment this report flagged). The maintainer should confirm this deferral. The covered-input fingerprint was recomputed with `verification.fingerprint` after that commit.
