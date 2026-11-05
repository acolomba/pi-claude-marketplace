---
phase: 04-agent-grants
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts
  - extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts
  - extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/persistence/agents-index-schema.ts
  - extensions/pi-claude-marketplace/platform/subagent-child.ts
  - features/lib/mcp-agent-earlier-index.ts
  - features/lib/upstream/subagents.ts
  - features/mcp-server/agent-grants.feature
  - features/step_definitions/mcp-server/agent-grants.steps.ts
  - test/bridges/agents/agent-grant-seeds.ts
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/frontmatter.test.ts
  - test/bridges/agents/grant-forms.test.ts
  - test/bridges/agents/grant-rewrite.test.ts
  - test/bridges/agents/index.test.ts
  - test/bridges/agents/legacy-grant-form.test.ts
  - test/bridges/agents/mcp-async-warning.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/types.test.ts
  - test/bridges/agents/unstage.test.ts
  - test/integration/agents-builtin-grant-conformance.test.ts
  - test/orchestrators/mcp/agent-grants-step.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/persistence/agents-index-io.test.ts
  - test/persistence/agents-index-schema.test.ts
  - test/platform/subagent-child.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
  necessity: 1
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-04
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

I reviewed the Phase 4 diff (`git diff f5069e0`) for the agent grant forms. It covers the per-implementation conversion, the stored forms on the agents index, the load-time rewrite under the state lock, the legacy textual translation, the background-child gate in the step and in the load reconcile, and the cucumber scenarios and harness libraries.

These parts are correct:
- The grant-form rendering: the adapter and built-in selectors, the `excludeTools` spelling, the async-warning text, and AG-11 applied per form.
- The swap itself: it matches on the stored block with `startsWith`, keeps the body, writes through `agents-staging/` and renames, and saves the index last.
- Containment: `assertPathInside` refuses symlinks, and the basename must equal `<generatedName>.md`.
- The legacy translation rules, checked against `generatedMcpServerKey`, `builtinMcpServerName`, and `builtinToolName`.
- The child gate's `NO_MCP_MOVE` override, which replaces the default `migrateLegacyMcpEntries` that an `undefined` move would run.

I found no blocker. The main concerns:
- The lock is used only as a mutex, with no lock-held check before the index save.
- Rows that can never converge make every load take the scope lock again.
- Cascade updates stage the adapter form under Pi's built-in MCP.
- Two cucumber harness choices weaken what the scenarios prove.

I read the necessity rubric (`.claude/gsd-core/references/necessity-review.md`) and applied it.

## Warnings

### WR-01: The rewrite saves the agents index without checking that the state lock is still held

**File:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts:259-261`, `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts:57-61`
**Issue:** `withLockedStateTransaction` checks the lock only inside `tx.save()` (`transaction/with-state-guard.ts:107`). The rewrite never calls `tx.save()`, and `rewriteAgentGrantForms` gets neither `tx` nor an `assertLockHeld`. Suppose proper-lockfile reports the lock compromised while the rows are being rewritten, for example after a stall on a slow filesystem, and another Pi process then takes the lock and stages a plugin's agents. `saveAgentsIndex(locations, { agents: next })` would still write the stale `next` over that process's index, dropping its new rows and orphaning their files. The compromise only shows up afterwards, as an error at release, which the step debug-logs. Every other locked writer checks the lock before its final save.
**Fix:** Take the lock with `withExistingScopeLock`, which passes `assertLockHeld`, and call it right before the index save (and, ideally, before each rename):
```ts
await withExistingScopeLock(locations, (assertLockHeld) =>
  rewriteAgentGrantForms(locations, active, createRemovalOps(), assertLockHeld),
);
// in rewriteRows:
if (next.some((row, i) => row !== rows[i])) {
  assertLockHeld();
  await saveAgentsIndex(locations, { schemaVersion: 1, agents: next });
}
```

### WR-02: Rows that never converge make every load take the scope lock

**File:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts:97-113, 176-182, 197-201, 238-243, 275-281`; `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts:53-61`
**Issue:** `needsAgentGrantRewrite` looks only at index rows. The following rows stay candidates for good, because the locked pass returns them unchanged:
- a stored-form row whose file the user edited, or whose file is missing (`swapFile` "neither stored form");
- a row whose target fails containment, for example a project directory that moved (the absolute `targetPath` is kept);
- a legacy row whose file is not a generated agent (`translateLegacyFile` returns `row`);
- any candidate in an index that also holds one corrupt row (`rewriteAgentGrantForms` returns early).

So every `session_start` and `/reload` takes that scope's proper-lockfile lock, loads `state.json`, and writes the same debug line again. The lock is `retries: 0`. A `/claude:plugin` command that another Pi process starts on that scope during the window fails with `StateLockHeldError`. Nothing tells the user why, and the condition never clears without a reinstall. The header comment (invariant 6) claims "not retried at every load" only for the case where the translation gives up.
**Fix:** Settle a left row so that it is no longer a candidate. One way: in the locked pass, record the row as holding neither form, for example by dropping `mcpForms` and setting `mcpImplementation` to the active id when the file matches no stored block. A re-stage writes fresh forms anyway. Another way: make the unlocked pre-check also read each candidate file and count it only when the file starts with a stored block, or for a legacy row, with a generated block. Either way, a scope with nothing it can rewrite never takes the lock.

### WR-03: Cascade updates (marketplace autoupdate, `apply` convergence) stage the adapter form under Pi's built-in MCP

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:455-461`
**Issue:** `updateAgentImplementation` returns `"none"` for every cascade run that has no `preflightNotification`, and `"none"` stages pi-mcp-adapter's form. Pi emits `session_start` and then `resources_discover` (04-CONTEXT), so the agent grants step runs before an autoapply `apply`. When that apply's convergence moves a plugin, the agent file gets `mcp:plugin_<p>_<s>_/…`. Under Pi's built-in MCP that grant does not resolve ("selects MCP tools that Pi's built-in MCP does not offer"), and it stays wrong until the next `/reload`. The marketplace autoupdate background pass behaves the same way. 04-CONTEXT says MGRT-01's install side covers "every path that stages agents through … the agent staging in `update-swap.ts`". P4-DC-13 records the choice, but the result is user-visible: the agent cannot reach its MCP tools for the rest of the session.
**Fix:** Carry the active implementation into cascade runs. `ApplyReconcileOptions.run` and the autoupdate pass's run both hold `softDeps.mcpImplementation`, so add an optional `mcpImplementation?: ActiveMcpImplementation` to `ThreePhaseArgsBase`, set it where `convergePlugin` and the autoupdate cascade build their args, and read it before falling back to `"none"`:
```ts
return args.mcpImplementation
  ?? args.preflightNotification?.run.softDeps.mcpImplementation
  ?? "none";
```
If those builders sit in files other phases own, record a parent line.

### WR-04: The error projection now maps pi-mcp-adapter's whole-server selector to the built-in server name, and matches path fragments

**File:** `features/lib/upstream/subagents.ts:59-60`
**Issue:** The new third alternative, `plugin_[A-Za-z0-9_-]*[A-Za-z0-9-](?:\/…)?`, also matches an adapter whole-server key with its trailing `_` removed. I checked with Node:
- `"does not offer: mcp:plugin_demo_stub_"` projects to `plugin_demo_stub`;
- `"servers that extensions registered (plugin_demo_stub)"` also projects to `plugin_demo_stub`;
- `"/home/x/plugin_cache/foo"` projects to `plugin_cache/foo`.

So a scenario cannot tell an unresolved adapter whole-server grant from a resolved built-in one. That difference is the red proof this phase relies on. Before the change, the adapter whole-server key was not projected at all. Any error text holding a `plugin_…` path segment now gains a spurious `error naming` value. 04-CONTEXT required "keeping the adapter projection unchanged".
**Fix:** Anchor the built-in alternative so that it cannot end where an adapter key would continue: `plugin_[A-Za-z0-9_-]*[A-Za-z0-9-](?![A-Za-z0-9_-])(?:\/[A-Za-z0-9_-]+)?`. Also project an adapter whole-server key explicitly (`plugin_[A-Za-z0-9_-]*_(?![A-Za-z0-9_-])`), and require a preceding `mcp:`, `(`, or space context so that a path segment is not taken. Add unit cases for the three strings above.

### WR-05: The background-child scenario works only because pi-subagents loads before the launch-environment extension

**File:** `features/step_definitions/mcp-server/agent-grants.steps.ts:97-116`, `features/mcp-server/agent-grants.feature:474-493`
**Issue:** pi-subagents 0.84.0's factory returns without registering anything when `PI_SUBAGENT_CHILD === "1"` (`src/extension/index.js:225`). The launch-environment extension sets the variable in its own factory, and `usePiWithProfile` loads companions before `extraExtensions` (`features/support/world.ts:583, 890`). pi-subagents therefore reads the variable before it is set, registers `subagent` normally, and the scenario's `subagent get` call succeeds. A real background child has the variable set before any factory runs, so there `subagent` would not exist. The step comment "pi-subagents itself registers nothing in a child" contradicts what the scenario relies on. If the harness ever changes its extension order, the scenario breaks with an unrelated error. 04-CONTEXT planned the check as "a later Pi with pi-subagents and no MCP reports the unchanged selector". That design does not depend on load order.
**Fix:** Keep the child Pi only for the load. Then restart a non-child Pi with pi-subagents and no MCP (`When the user restarts pi with no mcp`, as the "no mcp implementation" scenario does), and run `subagent get` there. Correct the step comment to say that the marker is set after pi-subagents' factory has run.

### WR-06: Cargo-culted pattern: the rewrite loads `state.json` under the lock and never reads it

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts:57-61`
**Category:** necessity
**Issue:** `withLockedStateTransaction` runs `loadState(extensionRoot, { persistMigration: false })` (`transaction/with-state-guard.ts:96-98`), and its callback `() => rewriteAgentGrantForms(...)` ignores `tx`. Nothing reads the loaded state, and nothing saves it. That is provable from the call site. The load is not harmless: a `state.json` that fails to parse or has an unsupported schema makes `loadState` throw, which silently blocks every agent grant rewrite in that scope. The rewrite does not depend on that file at all.
**Fix:** Use `withExistingScopeLock(locations, body)`, the lock-only primitive in the same module. That also hands over `assertLockHeld` for WR-01.

## Info

### IN-01: `swapFile` does not validate the recorded block before using it as the prefix to cut

**File:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts:171-178`
**Issue:** Only `swap.active.frontmatter` goes through `isGeneratedBlock`. A recorded `frontmatter: ""`, which the schema allows (`Type.String()`), makes `text.startsWith("")` true, so the active block is prepended to the whole old file and the result has two frontmatter blocks. Getting there takes a hand-edited or damaged index, so this is robustness, not a privilege boundary.
**Fix:** Require `isGeneratedBlock(swap.recorded.frontmatter)` too, and debug-log the row as malformed when it fails.

### IN-02: The step's "never rejects" guarantee depends on the materializer

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts:82-86`
**Issue:** `input.ctx.cwd` and `input.ctx.isProjectTrusted()` run outside any `try`, so a throwing context rejects the step. The header says "the step never rejects (NFR-2)". `session-materialize.ts`'s `runStep` catches the rejection today, so this is not a live defect, but the claim is broader than the code.
**Fix:** Wrap the body in `try`/`catch` with `hookDebugLog`, or narrow the header claim to `rewriteScope`.

### IN-03: Each agent is converted twice, so conversion debug lines appear twice

**File:** `extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts:50-51`
**Issue:** `convertAgent` and `convertAgentForm` both run the full conversion, so `convert.ts:775` (`generatedSkillName rejected skill token …`) logs twice for each rejected token whenever `mcpGrantForms` is present.
**Fix:** Accept it, or compute the MCP-independent parts once and render only the tools and warnings per form.

### IN-04: The update-swap change edits `prepareUpdateHandles`, which the phase does not own

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:407-412`
**Issue:** The brief limits Phase 4 to "the agent staging function in `orchestrators/plugin/update-swap.ts` (only that function)". The staging was inline in `prepareUpdateHandles`, so extracting `prepareUpdateAgents` rewrote that function's body. The behavior is unchanged, but sibling phases that edit `prepareUpdateHandles` may hit a merge conflict.
**Fix:** Record the edit in the last plan SUMMARY so that the parent's merge expects it.

### IN-05: A legacy file that the user edited is translated in place without any comparison

**File:** `extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts:121-130, 237-264`
**Issue:** T-04-16 records this known gap: there is no stored block to compare against, so the user's edits inside the frontmatter are carried into both stored forms, and later switches keep re-applying them. This is not a defect beyond what is recorded. It is listed so that the residual risk stays visible: after one built-in session, a hand-edited grant becomes the "recorded" adapter form.
**Fix:** None required. Optionally compare the block's provenance `warnings` and `droppedTools` lines against the row, and leave the file when they differ.

---

_Reviewed: 2026-11-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
