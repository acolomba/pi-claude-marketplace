---
phase: 05-hook-tool-names
verified: 2026-11-04T00:00:00Z
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
  - "features/hook/mcp-tool-names.feature"
  - "features/hook/tool-use.feature"
  - "features/lib/hook-mcp-calls.ts"
  - "features/lib/hook-mcp-tool-server.ts"
  - "features/step_definitions/hook/tool-use.steps.ts"
covered_digest: "v4:sha256:0b90ac2fed3c680d413c7ff9040f1d1ecdabe2b6456dc8106b4babb131b7edb3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: Hook Tool Names Verification Report

**Phase Goal:** Plugin hooks on plugin MCP tools fire under built-in with Claude's server segment, and the adapter's proxy rule applies only while the adapter is active.
**Verified:** 2026-11-04
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / MHK-01: under built-in, a plugin hook whose matcher names a plugin MCP tool with Claude's server segment (`-` kept) fires once; a scenario pins that only the tool segment's `-` to `_` fold differs, recorded as a Pi-gap divergence | VERIFIED | `builtin-mcp-tool-names.ts` (`toolLiteralNames`, `serverPrefixNames`, `claudeFormToolName`) compares the literal against the alias with `-` kept and Pi's `createMcpToolName` candidates. `mcp-tool-view.ts` `hookToolFor` reads `pi.getAllTools()` at dispatch time and accepts only `sourceInfo.path === "builtin:mcp"` with a namespace alias. `dispatch.ts` `matcherFiresOnToolEvent`, `entryFires`, `toolResultCompositeHandler` and `if-field/index.ts` `ifFires` all use it. The `@mcp` scenario `Hooks on a plugin MCP tool match it...` passes under builtin: literal, prefix, `if` and PostToolUse rows each record one run as `mcp__plugin_hook-demo_stub-server__echo`, and the folded-server matcher records none. The `@builtin-only` scenario `...sees the tool segment folded (MHK-01, D-MB-08)` passes: the `-` literal and the `_` literal both fire, and stdin shows `mcp__echo-server__echo_text`. docs/hooks-compatibility.md names D-MB-08 as the Pi gap. |
| 2 | SC2 / MHK-02: the adapter `mcp` proxy special case applies only while the adapter is active; under built-in or none no call is a proxy call | VERIFIED | `dispatch.ts:949` `if (isMcpProxyCall(event) && tools.proxyRuleApplies()) return undefined`. This is the only use of `isMcpProxyCall`; the old unconditional checks in both handlers are gone. `proxyRuleApplies` is `openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter"`, so it is false for built-in, for none, and when `pi` is undefined. It is read lazily, only for a proxy-shaped call, and kept per generation. `event-router.ts` makes one view per generation, and nothing reads it at factory time (`test/architecture/no-factory-time-probe.test.ts` passes). Behavioral: the `@adapter-only` scenario (outer `mcp` call runs no hook) passes under adapter. The `@builtin-only` cut-name scenario (proxy-shaped name, string `tool` input) runs `*`, literal and PostToolUse hooks under builtin and passes. The "none" half is covered by unit rows only (see Human Verification / judgment below). |
| 3 | SC3a: `docs/hooks-compatibility.md` states the built-in tool names and the divergence | VERIFIED | Lines 119, 120, 144, 148, 150, 167, 168. Line 148 gives the `mcp__<server>__<tool>` form with `-` kept in the server, the tool-segment fold (Pi gap, D-MB-08), the hash and cut-name gap, and the example `mcp__echo-server__echo_text`. Line 150 says the proxy rule applies only while pi-mcp-adapter is the active MCP implementation. No `TBD`, `FIXME` or `XXX` marker. |
| 4 | SC3b: every MCP scenario in `features/hook/` runs under both profiles or carries an implementation tag | VERIFIED | Only `mcp-tool-names.feature` and `tool-use.feature` mention MCP. Scenarios are `@mcp` (x2), `@builtin-only` (x3), `@adapter-only` (x1). `npm run check:features` passes. Adapter run of the three `plugin MCP tool` scenarios: 3/3 passed. Builtin run of both files: 5/5 passed. |
| 5 | Plan truth: the hook stdin, notice label, matcher and `if` use one per-event name, Pi's event keeps Pi's name, and the tool list is read only for an `mcp__` event with a non-empty bucket (D-P5-01, D-P5-03, MSEL-01) | VERIFIED | `toolEventView` copies the event shallowly with `toolName` set to the hook name, so Pi's `input` is shared and an `updatedInput` rewrite still reaches Pi. `identify` returns Pi's name unchanged for a non-`mcp__` name, for no `pi`, for a missing tool, for another source, and for a thrown read (debug-logged). The bucket check comes before `hookEventView`. The `@mcp` notice scenario shows `PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: checked the stub` under both profiles (adapter run and builtin run both pass). Unit tests: 403/403 pass across the view, domain, `if`-field, event-router and dispatch tests. |
| 6 | Plan truth: red proof and phase gate recorded; no frozen file changed | VERIFIED | `git diff 6404197... --name-only` outside `.planning` lists only `bridges/hooks/{dispatch,event-router,mcp-tool-view,if-field/index}.ts`, `domain/components/hooks/builtin-mcp-tool-names.ts`, `docs/hooks-compatibility.md`, `features/hook/*`, `features/lib/hook-mcp-{calls,tool-server}.ts`, `features/step_definitions/hook/tool-use.steps.ts`, and their unit pairs. None is in the 01-FROZEN.md section 1 list. Only `.planning` files changed after the gated code commit 1d638d7. The 05-04 SUMMARY records the gate (adapter 1560/1560, builtin 44/44) and a red sweep on the Phase 1 code (builtin 5/5 fail, adapter 23/23 pass). The orchestrator's `npm run check` exit 0 covers the post-gate tree. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `domain/components/hooks/builtin-mcp-tool-names.ts` | VERIFIED | Substantive (Pi `createMcpToolName` candidate logic), imported by `dispatch.ts`, `if-field/index.ts` and `mcp-tool-view.ts` |
| `bridges/hooks/mcp-tool-view.ts` | VERIFIED | `createHookToolView` is used in `event-router.ts` and as the default in both composite handlers |
| `features/hook/mcp-tool-names.feature` | VERIFIED | Three scenarios (`@mcp` x2, `@builtin-only`), all pass |
| `features/lib/hook-mcp-calls.ts`, `hook-mcp-tool-server.ts` | VERIFIED | Used by the `tool-use.steps.ts` steps the scenarios run |
| `docs/hooks-compatibility.md` | VERIFIED | See truth 3 |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| `dispatch.ts` | `mcp-tool-view.ts` | WIRED (`createHookToolView`, `HookToolView.identify`, `proxyRuleApplies`) |
| `dispatch.ts`, `if-field/index.ts` | `builtin-mcp-tool-names.ts` | WIRED (`toolLiteralNames`, `serverPrefixNames`) |
| `event-router.ts` | `dispatch.ts` | WIRED (one view per generation passed to both tool handlers) |
| `mcp-tool-view.ts` | `shared/notification-run.ts` | WIRED (`openNotificationSnapshot(pi).softDeps`) |
| `tool-use.steps.ts` | `hook-mcp-calls.ts`, `hook-mcp-tool-server.ts` | WIRED |

### Data-Flow Trace (Level 4)

The tool name comes from `pi.getAllTools()` (real Pi registration, FLOWING). The implementation comes from `softDepStatus` through the run snapshot (FLOWING). Both are exercised end to end by the cucumber scenarios against a real Pi.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Builtin profile, both hook features | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature` | 5 scenarios, 68 steps passed | PASS |
| Adapter profile, MCP scenarios | `npx cucumber-js features/hook/mcp-tool-names.feature features/hook/tool-use.feature --name "plugin MCP tool"` | 3 scenarios, 41 steps passed | PASS |
| Feature tag rules | `npm run check:features` | exit 0 | PASS |
| Hooks unit tests (view, domain, if-field, event-router, dispatch) | `node --test ...` | 403 pass, 0 fail | PASS |
| No factory-time probe | `node --test test/architecture/no-factory-time-probe.test.ts` | pass | PASS |

### Probe Execution

Step 7c: SKIPPED, the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MHK-01 | 05-01, 05-03, 05-04 | Hook matcher on a plugin MCP tool fires on the built-in call with the server segment in Claude's form; only the tool-segment fold is a divergence licensed by a Pi gap | SATISFIED | Truths 1, 3, 5 |
| MHK-02 | 05-02, 05-03, 05-04 | The adapter `mcp` proxy special case applies only while the adapter is active | SATISFIED | Truth 2 |

Both IDs appear in REQUIREMENTS.md (lines 115-116, mapped to Phase 5 at lines 174-175) and in the PLAN frontmatter. No orphaned requirement maps to Phase 5. The REQUIREMENTS.md checkboxes still read `[ ]` and the traceability rows read "Pending"; the roadmap/requirements update is the orchestrator's close-out step.

### Anti-Patterns Found

None. No `TBD`, `FIXME` or `XXX` in the phase's new or edited product, feature or doc files. No stubs: every new function carries logic that tests exercise.

### Human Verification Required

None required. One judgment call, resolved below.

**"No implementation" half of MHK-02 (P5-DC-24).** Success criterion 2 says "under built-in or with no implementation, no call is treated as a proxy call". Only unit rows cover the "none" case: `mcp-tool-view.test.ts` ("no MCP implementation is the active implementation" gives `false`) and `dispatch.test.ts` (`proxyRuleRows`, applies=false labelled "built-in MCP or none"). I judge this sufficient. The gate is a single boolean (`mcpImplementation === "adapter"`), so the "none" and "built-in" values take the same `false` branch. The built-in half is proven end to end by two cucumber scenarios, and the view test feeds the real `softDepStatus` with no commands. A none-profile scenario would need a new harness stand-in for a case that exercises no new branch. It stays a recorded, open, medium-severity dubious choice, not a gap.

### Gaps Summary

No gaps. All three ROADMAP success criteria and both requirement IDs are met in code and in passing behavioral scenarios under both profiles. The REVIEW findings (6, all Info or warning level) are all fixed per 05-REVIEW-FIX.md, and the security audit reports `threats_open: 0`.

---

_Verified: 2026-11-04_
_Verifier: Claude (gsd-verifier)_
