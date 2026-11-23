---
phase: 08-integration-suite-rescope
reviewed: 2026-11-23T04:57:42Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .agents/skills/cucumber/SKILL.md
  - .agents/skills/typescript-unit-tests/SKILL.md
  - .planning/codebase/TESTING.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - test/integration/adapter-expansion-conformance.test.ts
  - test/integration/adapter-tool-name-conformance.test.ts
  - test/integration/agents-adapter-grant-conformance.test.ts
  - test/integration/agents-builtin-grant-conformance.test.ts
  - test/integration/concurrent-install.test.ts
  - test/integration/hooks-result-boundary.test.ts
  - test/integration/load-reconcile-race.test.ts
  - test/integration/marketplace-add-seed-mirrors.test.ts
  - test/integration/marketplace-layer-remove.test.ts
  - test/integration/mcp-adapter-entry-conformance.test.ts
  - test/integration/mcp-builtin-encoding-conformance.test.ts
  - test/integration/mcp-server-records.test.ts
  - test/integration/mcp-status-conformance.test.ts
  - test/integration/mcp-verdict-migration.test.ts
  - test/integration/mcp-verdict-update.test.ts
  - test/integration/pi-subagents-child-launch-conformance.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/integration/provenance-invisibility.test.ts
  - test/integration/reconcile-plan-convergence.test.ts
  - test/integration/skill-path-resolution.test.ts
  - test/integration/standalone-prune.test.ts
  - test/integration/subagent-hook-ownership.test.ts
  - test/integration/transaction-lifecycle-cascade.test.ts
  - test/integration/workflow-engine-agent-registry.test.ts
  - test/integration/workflow-kind-inversion.test.ts
  - test/orchestrators/reconcile/plan.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-11-23T04:57:42Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

I reviewed every file changed since `17fca7a` outside `.planning/phases/`. That includes the two deleted files, which I read with `git show 17fca7a:<path>`. The hook files that Phase 6.1 owns and the 08-05 edit to `docs/hooks-compatibility.md:77` were left out, as asked.

These checks pass:

- The charter text is the same in all three places. I extracted each section and compared them with `diff`: no difference.
- Every helper module in `test/integration/` still has an importer. No remaining file names a deleted test file.
- `tsc --noEmit` passes. `eslint --no-cache` on the changed test files passes.
- `plan.test.ts` runs 71 cases, and `plan.ts` has 100% line, branch, and function coverage when the pair runs alone.
- Each deletion has a cover: B1 to B7c in the SUMMARYs. I re-read the covering scenario or unit case for D-13, the child stages, the workflow install, and the lifecycle cascade.
- The composed fixed point "migrate, then plan nothing" is still covered from the outside: `features/plugin/config-migration.feature:19` ("the session reports no results") and `:44` ("Pending shows nothing to apply").
- The `docs/output-catalog.md` pointer is correct. The `openUi` hash claim in `docs/mcp-compatibility.md:770` matches the peer sources: pi-mcp-adapter 7.0.1 `dist/metadata-cache.js:148`, and pi-subagents 0.88.1 `computeMcpServerHash` at `mcp-direct-tool-allowlist.js:381-411`.

No blocker. The findings are about classification and header accuracy:

- Many cases in a file labelled peer conformance run no peer code.
- Two headers make a false claim about the cucumber harness.
- One header says "writes nothing" where the case compares only bytes.
- One header admits that scenarios cover a case it keeps, without saying what the case adds.
- The charter has no place for the `test/architecture/` category.

## Warnings

### WR-01: 28 "is written as Claude Code's value" cases in a peer conformance file run no Pi code

**File:** `test/integration/mcp-builtin-encoding-conformance.test.ts:172-183`, `:318-329` (header `:3`)
**Issue:** The header says the file is "Peer conformance (ITSCOPE-01) against Pi's own resolver and validator". Two loops do not fit that class:

- The loop at `:172` makes 22 cases from the non-secret `EXPANSION_CASES` rows.
- The loop at `:318` makes 6 cases from the non-secret `OPTION_FIELD_CASES` rows.

Each of these cases calls only `builtinServerConfig` (through `builtinConfig` at `:144-148`, or `optionWritten`). It then compares the result with `row.claudeOutput` and never calls `piConfigValues` or `piMcpServers`. These cases check one source module, `bridges/mcp/builtin-entry.ts`. The charter says such a case "moves to the unit test of its source pair". The premise "Pi resolves only `env` and `headers`, so every other field must be Claude's value as written" is a claim about Pi, but these cases do not check it. 08-RESEARCH.md:120 kept the whole file as "keep all" without looking at each case.
**Fix:** Move the two non-secret loops to `test/bridges/mcp/builtin-entry.test.ts`, which can import `test/bridges/mcp/expansion-cases.ts` as `substitute.test.ts` does, and delete them here in the same commit. Another option: make each row run through Pi, for example `piMcpServers.validateMcpServerConfig(SERVER_NAME, config)`, and check that the field comes back unchanged. That turns the premise into a peer assertion. In both cases, change the header so that it describes only the cases that run Pi's code.

### WR-02: "A scenario runs one Pi at a time" is false

**File:** `test/integration/concurrent-install.test.ts:8-9`, `test/integration/load-reconcile-race.test.ts:7`
**Issue:** Both new headers say the case must stay in integration because "A scenario runs one Pi at a time". The cucumber harness runs several Pi processes at once:

- `features/step_definitions/plugin/subagent-hooks.steps.ts:379-386` starts a background sibling child beside the profile Pi.
- `:396-397` says: "The sibling is a stand-in child of its own agent, started beside the profile Pi".
- The scenario at `features/plugin/subagent-child.feature:364-403` has the main Pi, a sibling child, and a third child alive at the same time.

What the harness actually lacks is a step that starts two `/claude:plugin` commands so that they meet at the state lock at the same moment. The fork, IPC, and ready-sync harness of these files provides that. A reader who trusts the header could reject a scenario that is in fact possible, or could repeat the false claim in a later header.
**Fix:** State the real gap. For example: "No step starts two installs (or two applies) at the same moment, so no scenario can make them meet at the state lock; `features/plugin/state-lock.feature` holds the lock from a separate process but runs one command."

### WR-03: The header says "writes nothing", but the case compares only bytes

**File:** `test/integration/mcp-verdict-update.test.ts:9-10` (assertion at `:240`)
**Issue:** The new header says "a repeated disabled update writes nothing". The case checks this with `unchangedBytes: (await readFile(stateJsonPath, "utf8")) === refreshedBytes`. An atomic rewrite of the same content passes that check. `test/integration/workflow-kind-inversion.test.ts:201-204` says this directly: "Byte equality alone is satisfied by an atomic rewrite of identical content, which is a write". That file uses inode and `mtimeNs` for the same claim. So the header claims more than the case checks, which the phase brief forbids. The "write that must not happen" class needs a check that can see a write. The test title at `:214` has the same wording.
**Fix:** Do one of these:

- Change the header and the title to what the case checks: "a repeated disabled update leaves the bytes of state.json as they were". `mcp-verdict-list.test.ts:7-8` already uses this wording.
- Backdate `state.json` before the repeated update, then compare a `{ bytes, inode, mtimeNs }` snapshot, as `workflow-kind-inversion.test.ts:205-216` does.

### WR-04: The `mcp-status-conformance` header says scenarios cover ASTAT-01, yet the ASTAT-01 case stays with no stated reason

**File:** `test/integration/mcp-status-conformance.test.ts:11-14` (case at `:84`)
**Issue:** The header says: "ASTAT-01 is also in `features/mcp-server/companion-missing.feature` and `features/mcp-server/project-scope.feature`; the shutdown snapshot and the drift guard need the adapter's own code." By the charter, the first case (ASTAT-01 through Pi's event bus, `:84-142`) must then either go after a break or name what it observes that the scenarios do not. The header does neither.

This case also runs no adapter code. It emits a snapshot that the test itself builds, and it uses only the adapter's constants, which case 3 (`:183`) already pins. What the case adds is the whole rendered `info` text in both scopes, with the user row `(overridden by project scope)` under pi-mcp-adapter. `features/mcp-server/builtin-status.feature:191` shows that row only for Pi's built-in MCP. The header does not name this.
**Fix:** Name what case 1 adds, for example: "the scenarios show the adapter's `connected` status in one scope; only this case compares the whole `info` text of both scopes, with the user row overridden by the project scope under pi-mcp-adapter". If that is not worth keeping, delete the case after a break that fails one of those scenarios.

### WR-05: The charter has no place for the existing `test/architecture/` category

**File:** `.agents/skills/typescript-unit-tests/SKILL.md:26-38`, `.agents/skills/cucumber/SKILL.md:10-22`, `.planning/codebase/TESTING.md:187-197`
**Issue:** The charter lists three places for a case: a scenario, the unit pair of one source module, or `test/integration/`. It ends with "A case that fits none of these classes moves to the unit test of its source pair."

Some cases check an invariant across modules and have no single source pair. TESTING.md documents a fourth home for them, `test/architecture/` (`TESTING.md:185`: "a distinct category from unit tests"). For example, `test/architecture/config-state-consistency.test.ts` runs `planReconcile` over what the config writers produce. `npm run test:unpaired` runs this category. The charter's last bullet would send such a case to "the unit test of its source pair", which does not exist. It could also push a planner to break up a cross-module check, as this phase did when it replaced the migration-to-planner round trip with a hand-written config. The same section of TESTING.md now holds both texts, so the conflict is inside one file.
**Fix:** Add one bullet to all three copies, for example: "A structural invariant across the whole source tree, or a contract between modules with no single source pair, is an architecture test under `test/architecture/`." Then let the last bullet name both places: "moves to the unit test of its source pair, or to `test/architecture/` when no single pair owns it."

## Info

### IN-01: A leftover `parent-wait` hook and its comment describe a deleted case

**File:** `test/integration/subagent-hook-ownership.test.ts:52-59`
**Issue:** Test 1 was deleted, and with it the only parent prompt. The one remaining case never prompts the main session (`:173-216`, which only runs `session.start("main")`). So `parent-wait` (UserPromptSubmit) is published but never runs. The comment "One waiting hook per session: the parent's prompt, the sibling's bash call, and the child's read each start one" no longer describes the file.
**Fix:** Remove the `parent-wait` row, and change the comment so that it describes only the sibling and child hooks.

### IN-02: The mirror-seeding header says "no git call", the wording just fixed in `standalone-prune`

**File:** `test/integration/marketplace-add-seed-mirrors.test.ts:6`
**Issue:** The header says "a path marketplace seeds with no git call". The case checks `gitBoundary.state.calls`, which records every git operation except `listRemotes` (`test/platform/git-ops-fake.ts:248-257`, "no call ledger"). This phase changed `standalone-prune.test.ts:6-9` for exactly this imprecision (Phase 4 IN-03).
**Fix:** Reword as in `standalone-prune`, for example: "a path marketplace seeds with none of the git calls the double records".

### IN-03: The header says "first loads", but the children run `applyReconcile`

**File:** `test/integration/load-reconcile-race.test.ts:5-6`
**Issue:** The header calls the second case "the first-run migration (MIG-01, D-13) of two concurrent first loads". Each child calls `applyReconcile` (`load-reconcile-race-child.ts:31`, `:70`), not the load. The migration runs in the read pass that both share, so the behavior is the same. The word "loads" still names an entry point that the case does not call, right beside the pointer to the load scenario in `config-migration.feature`.
**Fix:** Write "two concurrent first applies (their shared read pass runs the MIG-01 migration)".

### IN-04: The doc's source note leaves out the file that refuses the launch

**File:** `docs/mcp-compatibility.md:770`
**Issue:** "(read in source, `dist/metadata-cache.js` and `src/runs/shared/mcp-direct-tool-allowlist.js`). From the same source, an agent with a plugin MCP grant then does not launch." The two cited files show only that the hashes differ, and that a stale cache leaves the selectors unresolved. The throw that stops the launch is in pi-subagents 0.88.1 `src/runs/shared/child-tool-plan.js:234-238`. Line 762 of the same doc cites that file for the same kind of claim.
**Fix:** Add `src/runs/shared/child-tool-plan.js` to the source note, or write "pi-subagents' `child-tool-plan.js` then refuses to launch an agent with a plugin MCP grant".

### IN-05: The charter's "state that only an earlier release wrote" overlaps the cucumber earlier-release writers

**File:** `.agents/skills/cucumber/SKILL.md:19` (same text in the other two copies)
**Issue:** The Internal class lists "state that only an earlier release wrote". The same skill already gives scenarios writers for that state: `rewriteStateAsRelease()` for 0.4.3, 0.6.0, and 0.19.2, and `writeLegacyMcpConfig()` (`.agents/skills/cucumber/rules/world-and-stand-ins.md:45`). The gate earlier in the bullet ("only when neither a scenario nor a unit test can observe") limits the class. But a reader who scans the class list can take "earlier-release state" as a reason for integration by itself.
**Fix:** Qualify the class, for example: "state that only an earlier release wrote and that no earlier-release writer of the cucumber world rebuilds".

---

_Reviewed: 2026-11-23T04:57:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
