---
phase: 04-agent-grants
fixed_at: 2026-11-04T00:00:00Z
review_path: .planning/phases/04-agent-grants/04-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 7
skipped: 4
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-04
**Source review:** `.planning/phases/04-agent-grants/04-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 11 (every finding; WR-03, IN-03, IN-04, and IN-05 were left as recorded, by instruction)
- Fixed: 7
- Skipped: 4

WR-01 and WR-06 share one change, which is to take the lock alone and pass on its `assertLockHeld`. So both point at one commit.

## Fixed Issues

### WR-01: The rewrite saves the agents index without checking that the state lock is still held

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts`, `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts`, `test/bridges/agents/grant-rewrite.test.ts`, `test/orchestrators/mcp/agent-grants-step.test.ts`
**Commit:** 36df9b2
**Status:** fixed
**Applied fix:** The step takes the lock with the guard's exported `withExistingScopeLock` and passes its `assertLockHeld` to `rewriteAgentGrantForms`, which now has a fourth parameter. The rewrite calls it before each rename and before the index save. The per-row catch rethrows `StateLockCompromisedError`, so a lost lock ends the pass, and the step debug-logs it. The guard itself was not edited. Two new unit cases cover a lock lost before a rename and a lock lost before the save.

### WR-02: Rows that never converge make every load take the scope lock

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts`, `test/bridges/agents/grant-rewrite.test.ts`
**Commit:** 247d37a
**Status:** fixed: requires human verification (it changes the condition that decides when the lock is taken)
**Applied fix:** `needsAgentGrantRewrite` now reads each candidate's file without the lock. It counts the row only when the locked pass would change it: the target passes containment and the name check, and the file starts with the recorded or the active stored block (with a well-formed active form), or a legacy file translates. An index with a corrupt row counts nothing. The locked pass still re-checks everything, using the shared `heldForm` and `hasCorruptRow` helpers. New unit cases cover a missing file, an edited file, a target outside the folder or with another name, a malformed stored form, a corrupt row, a legacy non-generated file, and a file that already holds the active block.

### WR-04: The error projection maps pi-mcp-adapter's whole-server selector to the built-in server name, and matches path fragments

**Files modified:** `features/lib/upstream/subagents.ts`
**Commit:** fa6d195
**Status:** fixed: requires human verification (regular expression change)
**Applied fix:** The built-in alternative now matches only a whole name. The name must start the text or follow a space, `(`, `:`, or `,`, and no name character or `/` may come after it. A Node check against the reviewer's strings: `mcp:plugin_demo_stub_` and `(plugin_demo_stub_)` project as `error`, `/home/x/plugin_cache/foo` projects as `error`, and `(plugin_demo_stub)` still projects as `error naming plugin_demo_stub`. The adapter selector `plugin_demo_stub_/echo` and the model id are unchanged. No explicit adapter whole-server projection was added, so the adapter projection stays the same as before Phase 4. No unit cases were added, because the cucumber harness libraries have no unit test location. The cucumber runs below exercise the projection.

### WR-05: The background-child scenario works only because pi-subagents loads before the launch-environment extension

**Files modified:** `features/step_definitions/mcp-server/agent-grants.steps.ts`, `features/mcp-server/agent-grants.feature`
**Commit:** 02dcf18
**Status:** fixed
**Applied fix:** After its Pi starts, the child step now empties the launch environment: it removes the file and writes `{}` through the existing `writeLaunchEnvironment`. The scenario then runs `When the user restarts pi with no mcp` and `Then the session reports no results`, and asks `subagent get` in that later Pi, which is not a child, as 04-CONTEXT planned. The step comment now says that the world loads companions before `extraExtensions`, so pi-subagents registers its tools in this Pi. It also says that no scenario calls `subagent` there. The scenario no longer depends on the load order. Only Phase 4 files changed. Red proof: with the `isSubagentChild` gate removed from the step, the scenario fails because it reads `tools mcp:plugin_demo_stub/echo` (rewritten) where `tools mcp:plugin_demo_stub_/echo` is expected. The gate was restored after the run.

### WR-06: Cargo-culted pattern: the rewrite loads `state.json` under the lock and never reads it

**Files modified:** same as WR-01
**Commit:** 36df9b2
**Status:** fixed: requires human verification (necessity finding)
**Applied fix:** The guard lets a caller lock without loading state: `withExistingScopeLock` is exported, and other orchestrators already use it. The step therefore no longer runs `loadState`. The agents index that the unlocked read found lies in the extension root, so the lock-only primitive, which creates no directory, can take the lock. A new step case shows that a `state.json` that does not parse blocks no rewrite and stays byte-identical.

### IN-01: `swapFile` does not validate the recorded block before using it as the prefix to cut

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts`, `test/bridges/agents/grant-rewrite.test.ts`
**Commit:** 3e7b9c9
**Status:** fixed
**Applied fix:** `heldForm` requires both stored forms to be generated blocks, with the `---` frame and the marker, before it matches the recorded form or writes the active one. Otherwise the row is debug-logged as malformed and left, and the unlocked check does not count it. New cases cover an empty recorded block and one without the marker.

### IN-02: The step's "never rejects" guarantee depends on the materializer

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts`, `test/orchestrators/mcp/agent-grants-step.test.ts`
**Commit:** 8d85c30
**Status:** fixed
**Applied fix:** The reads of the context (`ctx.cwd`, `ctx.isProjectTrusted()`) and the scope passes are wrapped in `try`/`catch` with `hookDebugLog` on the `mcp` channel, so the step itself never rejects. A new case shows that a throwing trust question leaves the user scope rewritten and the project scope untouched, and that the step resolves.

## Skipped Issues

### WR-03: Cascade updates (marketplace autoupdate, `apply` convergence) stage the adapter form under Pi's built-in MCP

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:455-461`
**Reason:** Left as recorded. P4-DC-13 and T-04-17 accept that a cascade with no run stages the adapter form until the next load rewrites it. The fix needs the active implementation on `ThreePhaseArgs`, which Phase 3 plans to add. The parent line in `04-05-SUMMARY.md` repoints `updateAgentImplementation` once that field lands, and the builders sit in files Phase 4 does not own.
**Original issue:** `updateAgentImplementation` returns `"none"` for every cascade run with no `preflightNotification`, so autoupdate and apply convergence stage `mcp:plugin_<p>_<s>_/…` under Pi's built-in MCP until the next `/reload`.

### IN-03: Each agent is converted twice, so conversion debug lines appear twice

**File:** `extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts:50-51`
**Reason:** Left as recorded. The duplicate is a debug-only line, and the reviewer's own first option is to accept it.
**Original issue:** `convertAgent` and `convertAgentForm` both run the full conversion, so a rejected skill token logs twice when `mcpGrantForms` is present.

### IN-04: The update-swap change edits `prepareUpdateHandles`, which the phase does not own

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:407-412`
**Reason:** Left as recorded. `04-05-SUMMARY.md` already records the extraction of `prepareUpdateAgents` from `prepareUpdateHandles`, with no other change in that function, so the parent's merge expects it.
**Original issue:** Extracting the agent staging rewrote the body of a function that sibling phases may edit.

### IN-05: A legacy file that the user edited is translated in place without any comparison

**File:** `extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts:121-130, 237-264`
**Reason:** Left as recorded. T-04-16 and P4-DC-06 accept this gap, and the reviewer requires no fix.
**Original issue:** A legacy file has no stored block to compare against, so edits inside its frontmatter are carried into both stored forms.

## Verification

All checks ran in the main checkout `/home/user/pi-claude-marketplace` on `features/mcp-builtin-phase-4`, with no worktree, as the parent instructed. Every npm script ran through the nondac wrapper.

- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Owner unit tests (`test/bridges/agents/*.test.ts`, `test/orchestrators/mcp/agent-grants-step.test.ts`, `test/integration/agents-builtin-grant-conformance.test.ts`): 415 passed, 0 failed.
- Direct coverage: `bridges/agents/grant-rewrite.ts` 100% (branches 86/86, functions 20/20, lines 381/381); `orchestrators/mcp/agent-grants-step.ts` 100% (branches 16/16, functions 3/3, lines 94/94).
- `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature`: 12 scenarios passed. After WR-04, `features/agent/frontmatter.feature` and `features/agent/project-trust.feature` also passed under the adapter profile, because they read the same error projection.
- `npx cucumber-js --profile builtin features/mcp-server/agent-grants.feature`: 5 scenarios passed.
- The commit hook's `npm run check:commit` passed on every fix commit.

---

_Fixed: 2026-11-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
