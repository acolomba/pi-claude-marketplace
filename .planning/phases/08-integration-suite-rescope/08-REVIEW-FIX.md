---
phase: 08-integration-suite-rescope
fixed_at: 2026-11-23T05:14:12Z
review_path: .planning/phases/08-integration-suite-rescope/08-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-11-23T05:14:12Z
**Source review:** .planning/phases/08-integration-suite-rescope/08-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (WR-01..WR-05 and IN-01..IN-05, as the orchestrator directed)
- Fixed: 10
- Skipped: 0

All work ran in the main checkout on `claude/stoic-shannon-la9q7o`, as the orchestrator directed, with no worktree.

## Fixed Issues

### WR-01: 28 "is written as Claude Code's value" cases in a peer conformance file run no Pi code

**Files modified:** `test/bridges/mcp/builtin-entry.test.ts`, `test/integration/mcp-builtin-encoding-conformance.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 7d76c64
**Applied fix:** I moved the two loops to the unit pair of `bridges/mcp/builtin-entry.ts`: 22 `EXPANSION_CASES` rows and 6 `OPTION_FIELD_CASES` rows for the fields Pi does not resolve. The unit file now has its own shape map for `command`, `args`, `url`, and the three `oauth` fields, and it imports `test/bridges/mcp/expansion-cases.ts`. In the conformance file, the shape map now holds only the three fields Pi resolves (`env`, `env-builtin`, `headers`), and a type guard replaces the `secret` flag. The header now says that only the `env` and `headers` rows run through Pi's resolver, and it names the unit test that checks the other rows. Case counts: conformance went from 77 to 49, and the unit pair from 19 to 47. Two claims in `docs/mcp-compatibility.md` said the conformance test runs "each expansion case" and "14 option cases" through Pi's resolver. They now say that Pi's resolver runs the `env`/`headers` cases (8 of the option cases) and that the unit test checks the other cases.

### WR-02: "A scenario runs one Pi at a time" is false

**Files modified:** `test/integration/concurrent-install.test.ts`, `test/integration/load-reconcile-race.test.ts`
**Commit:** 761cb6c (shared with IN-03: the same header sentence in `load-reconcile-race.test.ts`)
**Applied fix:** Both headers now name the real gap: no step starts two installs (or two applies) at the same moment, so no scenario can make them meet at the state lock. `concurrent-install` also says that `state-lock.feature` holds the lock from a separate process but runs one command.

### WR-03: The header says "writes nothing", but the case compares only bytes

**Files modified:** `test/integration/mcp-verdict-update.test.ts`
**Commit:** fad4b1a
**Applied fix:** The header and the test title now say what the case checks: "a repeated disabled update leaves the bytes of state.json as they were". This matches the wording of `mcp-verdict-list.test.ts`.

### WR-04: The `mcp-status-conformance` header says scenarios cover ASTAT-01, yet the ASTAT-01 case stays with no stated reason

**Files modified:** `test/integration/mcp-status-conformance.test.ts`
**Commit:** 5ee23f1
**Applied fix:** The header now names what the first case adds. The scenarios show the status of a server in one scope. Only this case compares the whole `info` text of both scopes, where the user row reads `(overridden by project scope)` under pi-mcp-adapter. `builtin-status.feature` shows that row only under Pi's built-in MCP.

### WR-05: The charter has no place for the existing `test/architecture/` category

**Files modified:** `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/cucumber/SKILL.md`, `.planning/codebase/TESTING.md`
**Commit:** 9403a1c
**Applied fix:** I added this bullet: "A structural invariant that must hold across the whole source tree, or a contract between modules that no single source module owns, is an architecture test under `test/architecture/`." The last bullet now sends a case "to the unit test of its source pair, or to `test/architecture/` when no single source pair owns it". I diffed the three copies after the commit. They are word-for-word identical, and TESTING.md differs only by its two-space nesting.

### IN-01: A leftover `parent-wait` hook and its comment describe a deleted case

**Files modified:** `test/integration/subagent-hook-ownership.test.ts`
**Commit:** d3d1fb0
**Applied fix:** I removed the `parent-wait` (UserPromptSubmit) row. No remaining case prompts the main session, and no code names the row. The comment now describes only the sibling and child hooks.

### IN-02: The mirror-seeding header says "no git call", the wording just fixed in `standalone-prune`

**Files modified:** `test/integration/marketplace-add-seed-mirrors.test.ts`
**Commit:** 03b7423
**Applied fix:** The header now says that the git double records every git operation it serves except `listRemotes`, and that a path marketplace seeds with none of the git calls the double records. I confirmed the double's behavior in `test/platform/git-ops-fake.ts`.

### IN-03: The header says "first loads", but the children run `applyReconcile`

**Files modified:** `test/integration/load-reconcile-race.test.ts`
**Commit:** 761cb6c (shared with WR-02)
**Applied fix:** The header now reads "two concurrent first applies (their shared read pass runs the MIG-01 migration)". I did not change the test title "Concurrent first-load race". It names `loadState`'s first load, which the case's own comments describe.

### IN-04: The doc's source note leaves out the file that refuses the launch

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** bd558ea
**Applied fix:** I read pi-subagents 0.88.1 (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/child-tool-plan.js:234-238`, where unresolved selectors throw). The note now says that the stale cache leaves the agent's MCP tool selectors unresolved, and that `src/runs/shared/child-tool-plan.js` then refuses to launch the agent.

### IN-05: The charter's "state that only an earlier release wrote" overlaps the cucumber earlier-release writers

**Files modified:** `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/cucumber/SKILL.md`, `.planning/codebase/TESTING.md`
**Commit:** dc8aa81
**Applied fix:** The Internal class now reads: state that only an earlier release wrote belongs in integration only for a stored field that no step shows. What a user sees of that state is a scenario, because the earlier-release writers of the cucumber world rebuild it (`.agents/skills/cucumber/rules/world-and-stand-ins.md`). The text is identical in all three copies, which I checked with diff.

## Verification

All gates ran in the main checkout, not in a worktree. Anyone can reproduce the results from that tree at `dc8aa81`.

- `node --import scripts/isolated-pi-home.mjs --test` on each touched integration file: all passed (the conformance file has 49 cases; the six header files have 18 cases).
- `node --test test/bridges/mcp/builtin-entry.test.ts`: 47 passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts` (with `env -i`): exit 0, so the pair keeps 100% direct coverage.
- `npm run check:static` under the heavy lock, at `dc8aa81`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.
- `npm run test:integration` under the heavy lock, at `dc8aa81`: exit 0. A second run with the default reporter counted 237 tests, 237 passed.
- The pre-commit hook (`npm run check:commit`) passed on every commit. One commit failed once because another agent advanced HEAD at the same moment (`cannot lock ref 'HEAD'`). I committed again, with no amend.

---

_Fixed: 2026-11-23T05:14:12Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
