---
phase: 05-hook-tool-names
verified: 2026-11-05T00:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/05-hook-tool-names/05-01-PLAN.md"
  - ".planning/phases/05-hook-tool-names/05-01-SUMMARY.md"
  - ".planning/phases/05-hook-tool-names/05-02-PLAN.md"
  - ".planning/phases/05-hook-tool-names/05-02-SUMMARY.md"
  - ".planning/phases/05-hook-tool-names/05-03-PLAN.md"
  - ".planning/phases/05-hook-tool-names/05-03-SUMMARY.md"
  - ".planning/phases/05-hook-tool-names/05-04-PLAN.md"
  - ".planning/phases/05-hook-tool-names/05-04-SUMMARY.md"
  - "docs/hooks-compatibility.md"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts"
  - "extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts"
  - "extensions/pi-claude-marketplace/platform/pi-api.ts"
  - "features/hook/mcp-tool-names.feature"
  - "features/hook/tool-use.feature"
  - "features/lib/hook-mcp-calls.ts"
  - "features/lib/hook-mcp-tool-server.ts"
  - "features/lib/scenario-file.ts"
  - "features/step_definitions/hook/tool-use.steps.ts"
covered_digest: "v4:sha256:f011fc0366b1645ba1ffcf1ec3c52c98aa50b0c0b0c0547086003094e98234a4"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 5: Hook Tool Names Verification Report

**Phase Goal:** Plugin hooks on plugin MCP tools fire under built-in with Claude's server segment, and the adapter's proxy rule applies only while the adapter is active.
**Verified:** 2026-11-05 (HEAD ca56636, milestone-close re-verification on the combined tree)
**Status:** passed
**Re-verification:** Yes. The earlier report (2026-11-04, passed) went stale because Phase 6 and the review fixes touched files it covers. Every must-have was re-checked against the current code, not the earlier text.

## What Later Phases Changed On The Covered Surface

| Change | Commit / source | Effect on Phase 5 |
|--------|-----------------|-------------------|
| `docs/hooks-compatibility.md` gained Pi's exact 55-character cut and D-MB-13 | `aa665c7` | Doc is more precise. The rule matches Pi 1.5.0 `createMcpToolName` (`name.slice(0, 64 - 8 - 1)`, then `_` and the first 8 hex of sha256 of `<server>\0<tool>`), checked in `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js` lines 45-51 and mirrored in `piToolNames`. |
| `tool-use.steps.ts` swapped its inline write/release/read-back for `writeScenarioFile` | `e4eff85` (06-xx test refactor) | Behavior-neutral. `features/lib/scenario-file.ts` is now a covered dependency. Both profiles still pass. |
| `tool_search` projection moved to `features/lib/upstream/tool-search.ts` | 06-04 | No hook step or hook lib imports it (`grep` over `features/step_definitions/hook` and `features/lib/hook-mcp*.ts` is empty). No effect. |
| `SoftDepStatus.piMcpAdapterLoaded` removed | 06-09 | No Phase 5 reader. `git grep piMcpAdapterLoaded -- extensions test features docs` is empty. `mcp-tool-view.ts` reads `softDeps.mcpImplementation === "adapter"`, which `platform/pi-api.ts:366` still computes (`activeMcpImplementation(adapterLoaded, hasLoadedBuiltinMcp(commands))`). `platform/pi-api.ts` is added to the covered files for that reason. |
| Review-fix refactors: shared `MCP_TOOL_PREFIX`, drop of an unreachable empty tool segment check, comment corrections | `2326f73`, `657afba`, `9fec686` | Behavior-neutral. Unit rows and scenarios pass after them. |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / MHK-01: under built-in, a plugin hook whose matcher names a plugin MCP tool with Claude's server segment (`-` kept) fires once; a scenario pins that only the tool segment's `-` to `_` fold differs, recorded as a Pi-gap divergence | VERIFIED | `builtin-mcp-tool-names.ts`: `toolLiteralNames` accepts a literal only when it starts with `mcp__<registered server>__` and one of Pi's candidate names for the rest equals the event's name; `serverPrefixNames` compares the prefix to the registered server exactly. `mcp-tool-view.ts` `hookToolFor` accepts only `sourceInfo.path === "builtin:mcp"` with a namespace alias, read from `pi.getAllTools()` at dispatch time. `dispatch.ts` `matcherFiresOnToolEvent` (line 147), `entryFires`, `toolResultCompositeHandler` and `ifFires(..., tool)` (line 235; `if-field/index.ts` lines 550 and 553) all take that identity. Behavior: builtin run of both hook features, 5/5 scenarios and 68 steps pass (the `@mcp` rows record one run each as `mcp__plugin_hook-demo_stub-server__echo`; the `@builtin-only` fold scenario fires on both the `-` and `_` literals and shows stdin `mcp__echo-server__echo_text`). Docs line 148 names D-MB-08 as the Pi gap. |
| 2 | SC2 / MHK-02: the adapter `mcp` proxy special case applies only while the adapter is active; under built-in or none no call is a proxy call | VERIFIED | `dispatch.ts:949`: `if (isMcpProxyCall(event) && tools.proxyRuleApplies()) return undefined;`. That is the only use of `isMcpProxyCall` (declared line 646). `proxyRuleApplies` is `pi !== undefined && openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter"`, so it is false for built-in, for none, and for no `pi`; it is read lazily, only for a proxy-shaped call, and kept per generation. `event-router.ts:1199` makes one view per generation for both tool handlers. Behavior: adapter run of the three `plugin MCP tool` scenarios, 3/3 pass (the `@adapter-only` outer `mcp` call runs no hook); builtin run passes the cut-name scenario (proxy-shaped name with a string `tool` input runs `*`, literal and PostToolUse hooks). The "none" half has unit rows only (`mcp-tool-view.test.ts`, `dispatch.test.ts` `proxyRuleRows`); see P5-DC-24 below. |
| 3 | SC3a: `docs/hooks-compatibility.md` states the built-in tool names and the divergence | VERIFIED | Matcher table rows (MCP literal, server prefix), the `if` table rows, and the paragraphs on built-in names and the proxy rule. They give the `mcp__<server>__<tool>` form with `-` kept, the tool-segment fold as a Pi gap (D-MB-08), the 64-character limit with the 55-character cut and hash (D-MB-13), the `mcp__echo-server__echo_text` example, and that the proxy rule applies only while pi-mcp-adapter is active. No `TBD`, `FIXME` or `XXX` in any covered doc, source, or feature file. |
| 4 | SC3b: every MCP scenario in `features/hook/` runs under both profiles or carries an implementation tag | VERIFIED | `mcp-tool-names.feature` has `@mcp` (x2) and `@builtin-only` (x1). `tool-use.feature` has `@adapter-only` (x1) and `@builtin-only` (x2). `npm run check:features` exits 0. |
| 5 | Plan truth: the hook stdin, notice label, matcher and `if` use one per-event name; Pi's event keeps Pi's name; the tool list is read only for an `mcp__` event with a non-empty bucket (D-P5-01, D-P5-03, MSEL-01) | VERIFIED | `toolEventView` returns Pi's event when names agree and otherwise a shallow copy that shares Pi's `input`. `identify` returns Pi's name for a non-`mcp__` name, no `pi`, a missing tool, another source, or a thrown read (debug-logged). The bucket-empty return comes before `hookEventView` in both handlers. The `@mcp` notice scenario passes under both profiles. Unit run: 485 tests pass, 0 fail (view, domain names, dispatch, event-router, `if-field`, `no-factory-time-probe`). |
| 6 | Plan truth: no frozen file changed by Phase 5 | VERIFIED | Unchanged from the earlier report: the `git diff 6404197...` outside `.planning` lists only Phase 5-owned paths and their unit pairs. Later changes to covered files (table above) are refactors, docs, and a harness helper. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `domain/components/hooks/builtin-mcp-tool-names.ts` | VERIFIED | Substantive; imported by `dispatch.ts`, `if-field/index.ts`, `mcp-tool-view.ts` |
| `bridges/hooks/mcp-tool-view.ts` | VERIFIED | `createHookToolView` used in `event-router.ts` and as the default parameter of both composite handlers |
| `features/hook/mcp-tool-names.feature` | VERIFIED | Three scenarios, all pass under their profiles |
| `features/lib/hook-mcp-calls.ts`, `hook-mcp-tool-server.ts` | VERIFIED | Used by `tool-use.steps.ts` |
| `docs/hooks-compatibility.md` | VERIFIED | See truth 3 |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| `dispatch.ts` | `mcp-tool-view.ts` | WIRED (`createHookToolView`, `identify`, `proxyRuleApplies`) |
| `dispatch.ts`, `if-field/index.ts` | `builtin-mcp-tool-names.ts` | WIRED (`toolLiteralNames`, `serverPrefixNames`) |
| `event-router.ts` | `dispatch.ts` | WIRED (one view per generation to both tool handlers) |
| `mcp-tool-view.ts` | `shared/notification-run.ts`, `platform/pi-api.ts` | WIRED (`openNotificationSnapshot(pi).softDeps.mcpImplementation`, still a field after 06-09) |
| `tool-use.steps.ts` | `hook-mcp-calls.ts`, `hook-mcp-tool-server.ts`, `scenario-file.ts` | WIRED |

### Data-Flow Trace (Level 4)

The tool name and server alias come from `pi.getAllTools()` (real Pi registration). The implementation comes from `softDepStatus` through the run snapshot. Both reach a real Pi in the cucumber scenarios. FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Builtin profile, both hook features | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature` | 5 scenarios, 68 steps passed | PASS |
| Adapter profile, MCP scenarios | `npx cucumber-js features/hook/mcp-tool-names.feature features/hook/tool-use.feature --name "plugin MCP tool"` | 3 scenarios, 41 steps passed | PASS |
| Feature tag rules | `npm run check:features` | exit 0 | PASS |
| Hook, domain, `if`-field, router, factory-probe unit tests | `node --test ...` | 485 pass, 0 fail | PASS |
| Pi cut rule vs code | read `dist/extensions/mcp/tools.js` `createMcpToolName` | 55-char cut, `_`, 8 hex of sha256 `<server>\0<tool>`; matches `piToolNames` and the doc | PASS |

Combined-tree gate evidence supplied by the orchestrator (not re-run here): `npm run check` exit 0 on 71a37c4 (cucumber adapter 1603/1603, builtin 133/133, direct coverage), `test:modules` exit 0 on 2b6f2f4, CI run 41967152313 success on 2b6f2f4.

### Probe Execution

Step 7c: SKIPPED, the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MHK-01 | 05-01, 05-03, 05-04 | Hook matcher on a plugin MCP tool fires on the built-in call with the server segment in Claude's form; only the tool-segment fold is a divergence licensed by a Pi gap | SATISFIED | Truths 1, 3, 5 |
| MHK-02 | 05-02, 05-03, 05-04 | The adapter `mcp` proxy special case applies only while the adapter is active | SATISFIED | Truth 2 |

REQUIREMENTS.md lines 115-116 are checked `[x]` and the traceability rows (175-176) read Complete. No orphaned requirement maps to Phase 5.

### Anti-Patterns Found

None. No debt markers in the covered files; no stubs; no hardcoded empty data flowing to output.

### Human Verification Required

None. One judgment call stays recorded.

**"No implementation" half of MHK-02 (P5-DC-24).** Success criterion 2 says "under built-in or with no implementation, no call is treated as a proxy call". Only unit rows cover "none". I keep the earlier judgment that this is sufficient: the gate is the single boolean `mcpImplementation === "adapter"`, so "none" and "built-in" take the same false branch, and the built-in side is proven end to end by two scenarios. It stays an open medium-severity dubious choice, not a gap.

### Gaps Summary

No gaps. All three ROADMAP success criteria and both requirement IDs hold on the current tree, and the changes Phase 6 made to the covered surface did not change behavior.

## Dubious Choices

| Choice | Alternatives | Why dubious | Severity |
|--------|--------------|-------------|----------|
| P5-DC-24: "no MCP implementation" half of MHK-02 proven by unit rows only, no cucumber scenario | Add a none-profile scenario with a harness stand-in | The roadmap names "no implementation" explicitly; the end-to-end proof covers built-in and adapter only. The branch is shared with built-in, so risk is low. | Medium |
| P5-DC-03: a literal with Claude's full tool name (`-` in the tool segment) fires on the built-in tool, going beyond the literal wording of D-MB-08 | Compare the literal to the Claude-form name as is, so a matcher must fold the tool segment itself | Reads the divergence as covering only what Pi cannot give (stdin tool name), not matchers. It favors upstream parity, but the user has not reviewed it. | High |
| P5-DC-02: every built-in server gets Claude's server form, not only plugin servers | Map plugin servers only | Wider than the requirement text (plugin tools); the alias is the one signal Pi gives for both. | Medium |
| The proxy-rule answer is cached per bridge generation, and a failed implementation read keeps `false` until `/reload` (docs state it) | Re-read per proxy call | Under the adapter, a transient read failure makes proxy calls run hooks on the outer and nested call until `/reload`. The doc states the behavior; at `tool_call` time reads are not expected to throw. | Low |
| Scenarios depend on Pi 1.5.0 `createMcpToolName` details (64 limit, 55 cut, sha256 form) copied into `piToolNames` | Read the name from Pi if it ever exposes the original tool name | A Pi change to the hashing rule would silently change which literals fire. The doc cites the Pi source file and D-MB-13. | Low |

---

_Verified: 2026-11-05_
_Verifier: Claude (gsd-verifier)_
