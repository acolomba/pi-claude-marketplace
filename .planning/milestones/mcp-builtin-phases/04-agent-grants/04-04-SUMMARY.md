---
phase: 04-agent-grants
plan: "04"
subsystem: agents-bridge
status: complete
tags: [agents, pi-subagents, mcp, builtin-mcp, agents-index, session-start, legacy-migration]

requires:
  - phase: 04-agent-grants
    provides: "04-01: mcpImplementation and mcpForms on an agents-index row; mcpAsyncWarning(id)"
  - phase: 04-agent-grants
    provides: "04-02: platform/subagent-child.ts isSubagentChild(env)"
provides:
  - "bridges/agents/grant-rewrite.ts: needsAgentGrantRewrite (unlocked read) and rewriteAgentGrantForms (the swap under the caller's lock), re-exported from the agents barrel"
  - "bridges/agents/legacy-grant-form.ts: deriveLegacyGrantForms, the textual built-in translation of an agent installed before the index stored forms"
  - "orchestrators/mcp/agent-grants-step.ts: the filled frozen seed, agentGrantsStep(input, env = process.env)"
affects: [04-05 builtin scenarios, 04-06 docs]

actuals:
  tokens: 16640
  tasks: 2
  commits: 2
plan_head_before: 08fd4d45ec256b5473ccefa47368f2661cd19a15
plan_head_after: 83775be0f1ca1936eb84ec2ebb1027b66dd3607e

tech-stack:
  added: []
  patterns:
    - "Unlocked index read decides whether to take the scope lock; the swap runs under withLockedStateTransaction with persistMigration false and no tx.save()"
    - "A file is rewritten only when it starts with the recorded block byte for byte; the new file goes through agents-staging and a rename; the index is saved last"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts
    - extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts
    - test/bridges/agents/grant-rewrite.test.ts
    - test/bridges/agents/legacy-grant-form.test.ts
    - test/bridges/agents/agent-grant-seeds.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
    - extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts
    - test/bridges/agents/index.test.ts
    - test/orchestrators/mcp/agent-grants-step.test.ts

key-decisions:
  - "The step checks the pi-subagents child marker first, then the snapshot's implementation, and reads ctx (cwd once, trust once) only after both gates pass"
  - "A legacy row's forms come from deriveLegacyGrantForms returning the row with both fields set; storedSwap on that row then decides between the swap and a give-up, so the legacy and stored paths share one swap"
  - "A stored-form swap and a legacy translation both check containment, then read the file once, then decide"

requirements-completed: []

duration: ~40 min
completed: 2026-11-04
---

# Phase 4 Plan 04: Load-time Agent Grant Rewrite Summary

**At `session_start`, the agent grants step swaps each generated agent file whose stored grant form differs from the active MCP implementation's form. It writes through `agents-staging` and a rename, under the scope's state lock, and saves the agents index last. Agents installed before the index stored forms get a textual built-in translation at their first built-in session. Nothing changes with no implementation, in a pi-subagents background child, or in a project Pi does not trust.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-04
- **Tasks:** 2 of 2
- **Files:** 5 created, 4 modified

## Accomplishments

- `bridges/agents/grant-rewrite.ts`:
  - `needsAgentGrantRewrite(locations, active)` reads the index without the lock. A missing index is no work and creates nothing. It is true when a row records another form than `active` and stores the active one, or when a built-in session finds a legacy row (no stored fields, adapter async warning).
  - `rewriteAgentGrantForms(locations, active, ops)` runs under the caller's lock. It re-reads the index and saves nothing when the re-read reports a corrupt row (T-04-13). For each candidate it checks containment first (`assertPathInside` on `agentsDir` and a `<generatedName>.md` basename, NFR-10), then reads the file once. A file that starts with the recorded block gets the active block plus its unchanged body: the new file is written to `agents-staging/<uuid>/<generatedName>.md` and renamed over the target (NFR-1). A file that starts with the active block only gets its row fixed. Anything else is left. A stored active form must carry the `---` frame and the generated marker before it is written. A failure on one row leaves that row, and the others continue. The index is saved last, only when a row changed. The staging folder is cleaned through `cleanupStaging`, and a leak is debug-logged.
- `bridges/agents/legacy-grant-form.ts`: `deriveLegacyGrantForms(fileText, row)` returns the row with `mcpImplementation: "adapter"` and the forms derived from the file, or `undefined` when the text is not a generated agent. The block ends at the first `\n---\n` after the opening line. The translation changes three things. This plugin's `mcp:` selectors lose the key's last `_`. This plugin's `mcp__plugin_<plugin>_...` exclude names have every non-word character folded to `_`, and a name longer than 64 characters gives up the translation. The adapter async warning becomes the built-in text, and the cannot-narrow selector becomes the built-in one. A give-up records the adapter form only, so the row is not a candidate again. The module comment records the three known gaps.
- `orchestrators/mcp/agent-grants-step.ts`: `agentGrantsStep(input, env = process.env)`. The step returns before any context read in a child or with `none`. It handles the user scope, then the project scope only when `ctx.isProjectTrusted()` (D-LOC-01). Per scope, it takes `withLockedStateTransaction(locations, ..., { persistMigration: false })` only after `needsAgentGrantRewrite` returns true, and never calls `tx.save()`. A held lock (`StateLockHeldError`) and any other error are debug-logged, and the step never rejects. The frozen `session-materialize.ts` and `index.ts` are unchanged: `git diff --stat f5069e0 -- ...` prints nothing.
- The barrel re-exports both rewrite functions, and `index.test.ts` pins binding identity.

## Task Commits

1. **Task 1: Swap a stored grant form at session start, under the scope's lock** (tracer): `8e0b917` (feat)
2. **Task 2: Translate agents installed before this release at their first built-in session**: `83775be` (feat)

## TDD RED evidence

The commit hook refuses a commit that holds only failing tests, so each task committed its tests with its implementation. These RED runs came before each implementation:

- **Task 1, `grant-rewrite.test.ts`**: the file failed to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../bridges/agents/grant-rewrite.ts'`.
- **Task 1, `agent-grants-step.test.ts`** (new cases against the seed that does nothing): 7 of 9 failed and 2 passed. The 2 passing cases are the `none` and child cases, which the seed already met. Failing cases:
  - `MGRT-01 / D-MB-03: under Pi's built-in MCP, rewrites the adapter form in both scopes of a trusted project`
  - `MGRT-01 / D-MB-03: under pi-mcp-adapter, rewrites the built-in form back to the adapter form`
  - `D-LOC-01: in a project Pi does not trust, rewrites only the user scope`
  - `NFR-2: a held user-scope lock skips the user scope and still rewrites the trusted project scope`
  - `MGRT-01: a scope with no agents index stays absent`
  - `NFR-2: an unparseable user agents index changes nothing there and the project scope is still rewritten`
  - `T-04-13: an index with a corrupt row saves nothing and the step resolves`

  The last three failed only at `verify(ctx)`, because the seed never read `cwd` or the trust answer. Their file assertions already held.
- **Task 2, `legacy-grant-form.test.ts`**: the file failed to load with `ERR_MODULE_NOT_FOUND` for `legacy-grant-form.ts`.
- **Task 2, `grant-rewrite.test.ts`** (new legacy cases against the Task 1 module): 4 failed and 20 passed:
  - `P4-DC-06: a legacy row holding the adapter async warning is a candidate under Pi's built-in MCP`
  - `P4-DC-06: a legacy agent gets the translated built-in block and its row stores both forms`
  - `P4-DC-06: a translated legacy agent swaps back exactly after a switch to pi-mcp-adapter`
  - `P4-DC-06: a legacy agent whose translation gives up keeps its file and is not a candidate again`

  The 3 never-a-candidate cases and the not-a-generated-agent case already passed, because Task 1 rewrote no legacy row.

## Verification

- `npm run typecheck`: passed.
- `node --test` on `grant-rewrite`, `index`, `agent-grants-step`, the frozen `session-materialize`, and the root `test/index.test.ts`: 88 of 88 passed after Task 1. The tracer gate re-ran this on the committed tree before expansion. After Task 2, `legacy-grant-form`, `grant-rewrite`, and `agent-grants-step` passed 42 of 42.
- `npm run test:coverage:direct` for `grant-rewrite.ts`, `legacy-grant-form.ts`, `agent-grants-step.ts`, and `bridges/agents/index.ts`: exit 0, at 100% from each pair.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed after each task.
- `npm run test:modules`: exit 0 on the final tree.
- The commit hook ran `npm run check:commit` on both commits: Passed.
- Acceptance greps: `persistMigration: false` in the step: 1. `isSubagentChild` in the step: 2. `rewriteAgentGrantForms` in the barrel: 1. `deriveLegacyGrantForms` in `grant-rewrite.ts`: 2. The frozen-file diff against the phase base is empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared test seeds in a new seed module**
- **Found during:** Task 1
- **Issue:** The step test needs the same hand-written blocks, rows, and index helpers as the rewrite test. Copying them would create a clone group, and `fallow dupes` fails on any clone group under `test/` too.
- **Fix:** Added `test/bridges/agents/agent-grant-seeds.ts`, which is not in `files_modified`. It holds literal agent blocks, row builders, and index read/write helpers, following the `*-seeds.ts` pattern (`test/shared/notification-run-seeds.ts`). Task 2 generalized its `agentBlock` to any grant line and warning list, and added `legacyRow`.
- **Files modified:** `test/bridges/agents/agent-grant-seeds.ts` (new)
- **Commits:** `8e0b917`, `83775be`

No other deviations. The plan ran as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The mitigations of T-04-09 through T-04-14 are in place, and cases pin them:
- An escaping or misnamed target is left, and the other rows are still rewritten (T-04-09).
- A stored form without the frame or the marker is never written (T-04-10).
- An edited file is left (T-04-11).
- A held lock skips the scope (T-04-12).
- A corrupt row saves nothing (T-04-13).
- The rename replaces the target path itself, and `assertPathInside` refuses symlinks (T-04-14).

## Dubious Choices

1. **Claude-Session trailer value**
   - Severity: Low
   - Choice: Both commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, the value in `.planning/milestones/mcp-builtin-CHILD-SESSION-BRIEF.md` and the executor prompt.
   - Alternatives: The harness attribution reminder names `session_01EDUMG87PKcySw33ikhvFmE`.
   - Why dubious: The two sources disagree. The executor prompt said to use the trailer exactly as the child brief gives it, so I did, as 04-01 did.
   - Recorded in: this SUMMARY.
2. **A legacy file that is not a generated agent stays a candidate**
   - Severity: Low
   - Choice: When a legacy row's file has no frame or marker (or is missing), the row is left unchanged, as the plan says ("no forms: leave the row and log"). Under Pi's built-in MCP, every later load then takes the lock and reads that one file again.
   - Alternatives: Save adapter-only fields for such a row so that it stops being a candidate.
   - Why dubious: A file that is not a generated agent costs one lock and one read per load until the user reinstalls or removes the plugin. Saving fields for it would record a form that the file does not hold.
   - Recorded in: this SUMMARY; the `translateLegacyFile` comment.
3. **Warning translation runs on every list item of the block**
   - Severity: Low
   - Choice: The legacy translation applies the warning rule to every `    - ` line in the block. Only the exact adapter async text and a line holding ` cannot narrow the whole-server grant ` change, so `droppedFields` and `droppedTools` items stay as they are.
   - Alternatives: Track the `  warnings:` list and translate only its items.
   - Why dubious: A dropped-tool item that held the cannot-narrow sentence would be translated too. No converter writes such an item.
   - Recorded in: this SUMMARY.
4. **Body preserved as UTF-8 text, not raw bytes**
   - Severity: Low
   - Choice: The swap reads and writes the agent file as UTF-8 text. It replaces the leading block and keeps the rest of the string.
   - Alternatives: Compare and splice `Buffer`s, so that even invalid UTF-8 in the body survives byte for byte.
   - Why dubious: An agent body with invalid UTF-8 would get U+FFFD in its place. The bridge itself writes every generated file as UTF-8 text, so a generated body is always valid UTF-8.
   - Recorded in: this SUMMARY.
5. **A seed module outside `files_modified`**
   - Severity: Low
   - Choice: I added `test/bridges/agents/agent-grant-seeds.ts` so that two test modules share literal seeds without a fallow clone group.
   - Alternatives: Copy the seeds into the step test and add an inline `fallow-ignore-next-line code-duplication` marker.
   - Why dubious: The plan's file list did not name the file. Plan 04-03, which runs in parallel, touches no file in `test/bridges/agents/` with this name.
   - Recorded in: this SUMMARY, under Deviations.

## Parent lines

None. No frozen file needed a change. `agentGrantsStep` keeps its export and input type. Its new second parameter has a default, so the materializer's one-argument step type still accepts it (P4-DC-14).

## Next Phase Readiness

- Plan 04-05's built-in scenarios can rely on the load: after a switch, a new session rewrites the generated agent files of both trusted scopes. A pi-subagents background child writes nothing.
- I marked no requirement complete. MGRT-01 and MGRT-02 also depend on 04-03 (staging both forms) and 04-05 (scenarios), so the orchestrator marks them after the wave.

## Self-Check: PASSED

- Created files exist: `grant-rewrite.ts`, `legacy-grant-form.ts`, `grant-rewrite.test.ts`, `legacy-grant-form.test.ts`, `agent-grant-seeds.ts`.
- Commits `8e0b917` and `83775be` are ancestors of HEAD.
- `npm run check:static` and `npm run test:modules` exited 0 on the final tree.
