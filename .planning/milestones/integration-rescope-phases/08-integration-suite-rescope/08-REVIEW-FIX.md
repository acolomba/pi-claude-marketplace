---
phase: 08-integration-suite-rescope
fixed_at: 2026-11-23T05:50:45Z
review_path: .planning/phases/08-integration-suite-rescope/08-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 9
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

# Iteration 2

**Fixed at:** 2026-11-23T05:50:45Z
**Source review:** .planning/phases/08-integration-suite-rescope/08-REVIEW.md (iteration 2)
**Iteration:** 2

**Summary:**

- Findings in scope: 9 (WR-01..WR-03 and IN-01..IN-06, as the orchestrator directed)
- Fixed: 9
- Skipped: 0

All work ran in the main checkout on `claude/stoic-shannon-la9q7o`, as the orchestrator directed, with no worktree.

## Fixed Issues (iteration 2)

### WR-01: The moved unit cases' titles name behavior they do not check

**Files modified:** `test/bridges/mcp/expansion-cases.ts`, `test/bridges/mcp/builtin-entry.test.ts`, `test/integration/mcp-builtin-encoding-conformance.test.ts`
**Commit:** 79a6244
**Applied fix:** A new helper, `builtinRowInput(row)` in `expansion-cases.ts`, names a row's field, raw value, and session environment. The 22 built-in unit cases now read `BLT-02: <input> is written as Claude Code's value <claudeOutput>`. The 30 `env`/`headers` conformance cases read `BLT-02: <input> comes out of Pi's resolver as Claude Code's value <claudeOutput>`. Example: `BLT-02: the args value "${CLAUDE_PROJECT_DIR}" with the session variables {"CLAUDE_PROJECT_DIR":"/work/project"} is written as Claude Code's value "/work/project"`. All 52 (field, raw, environment) inputs are distinct, so no two titles are the same. The row data did not change. The option-row titles ("an args element that names an option", and so on) are true on the built-in path, so they stay. The unit pair passed 47 of 47. Its direct coverage, run under `env -i`, exited 0, so `bridges/mcp/builtin-entry.ts` keeps 100%.

### WR-02: The encoding conformance header says Pi's validator accepts each config the table builds

**Files modified:** `test/integration/mcp-builtin-encoding-conformance.test.ts`
**Commit:** 1823efd
**Applied fix:** I chose the rewording, not a new assertion. The header now says that Pi's `validateMcpServerConfig` returns a stdio config, a remote config with Claude Code's OAuth fields, and a direct-exposure config with the same JSON (P2-DC-08). It also says that the validator refuses a url that keeps an unset `${NAME}`, and that no table row reaches the validator. "The validator check" became "the validator cases".

### WR-03: The concurrent first-run migration case claims one writer, but no assertion can see that

**Files modified:** `test/integration/load-reconcile-race.test.ts`
**Commit:** 2b1d839
**Applied fix:** I reworded the case and did not add an assertion. To see the one-writer claim, a child must report the `migrated` arm of `migrateFirstRunConfig`, and `read-pass.ts:317` throws that result away. A report would need a new product seam, which is neither cheap nor in scope. The title now reads "two first applies against state with legacy autoupdate and no claude-plugins.json leave one config whose single marketplace carries the legacy autoupdate". The header bullet says the same, adds that `state.json` still records the marketplace, and says that the case cannot tell one writer from two that wrote the same config. Two inline comments that claimed one writer ("the second process saw 'valid' and short-circuited", "whichever process won the migration race") now make no such claim.

### IN-01: The `mcp-status-conformance` case 1 is kept for a missing scenario

**Files modified:** `features/mcp-server/project-scope.feature`, `test/integration/mcp-status-conformance.test.ts`
**Commit:** f63bc50
**Applied fix:** The harness already had what the scenario needs (`pi-mcp-adapter has reported the mcp servers of the plugin {string} of the {word} scope`). So I added an `@adapter-only` scenario to `project-scope.feature`, which already holds the adapter's project-scope `info` status rows: "Plugin info shows a user-scope server that the project's record replaces as overridden by project scope, under pi-mcp-adapter (ASTAT-01)". ASTAT-01 licenses the tag. The scenario installs the plugin in both scopes, starts Pi with pi-mcp-adapter, waits for the adapter's report on the project scope, and compares every field of the user-scope `info` result. The mcp row reads `overridden by project scope`. Under the adapter profile it passed (15 of 15 steps). Under the builtin profile it was selected 0 times. Red proof: in `stampAdapterEntries` of `orchestrators/plugin/info-mcp-status.ts`, I replaced the override set with an empty set. The scenario then failed on its `Then` (the actual row was `pending approval`). I reverted the break, and `git status --porcelain -- extensions/` is empty. Then I deleted case 1, its helpers `installHello` and `readAdapterKeys`, and the imports only it used. The header now names the two cases that are left (the ASTAT-02 shutdown snapshot and the ASTAT-01 drift guard), says that both need the adapter's own code, and points to the scenarios for what `info` shows, the overridden row included. The file passed 2 of 2. No BACKLOG entry was needed.

### IN-02 and IN-03: The charter's architecture bullet, and two tests for one Internal gate

**Files modified:** `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/cucumber/SKILL.md`, `.planning/codebase/TESTING.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** b90ca44 (one commit for both findings, because they change the same charter lines in the same three files)
**Applied fix:**

- IN-02: the architecture bullet now reads "A structural invariant that must hold across the whole source tree, a contract between modules that no single source module owns, or a test of a cucumber harness module under `features/lib/` is an architecture test under `test/architecture/`." TESTING.md's "Architecture Tests" paragraph also says that the category holds the harness tests, for example `test/architecture/pi-tui-screen.test.ts`.
- IN-03: the first sentence of the Internal class now says "a stored record field that no step shows". So both sentences use "no step shows". I chose "step" because a step can read a stored field that no command prints, so a scenario can observe that field.
- IN-03: `world-and-stand-ins.md:45` now lists six more earlier-release writers, each with its step: `dropRecordedMcpServers()` (MREC-02), the no-options record step (D-PG10-23), the whole-`mcp.json` 0.19.2 step, `stripAgentGrantForms()` (MGRT-01), `replaceStagedAgentFile()` (D-PG3-03), and `writeRelease0230McpAdapterEntry()` (D-PG9-04).
- I took the charter bullets out of all three copies, removed the leading spaces, and compared them with `diff`. All 10 bullets are the same in each copy.

### IN-04: The deny-list pin cites the encoding conformance file

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 90016ae
**Applied fix:** The line now cites `test/domain/claude-credential-denylist.test.ts`.

### IN-05: The header of `expansion-cases.ts` does not name its new consumers

**Files modified:** `test/bridges/mcp/expansion-cases.ts`
**Commit:** f9edc23
**Applied fix:** The header now names `builtin-entry.test.ts` and `mcp-builtin-encoding-conformance.test.ts`. It says that they run each row through `builtinServerConfig` and expect `claudeOutput`: the unit test for the fields Pi does not resolve, and the conformance test, through Pi's resolver, for `env` and `headers`. The comment above `OPTION_FIELD_CASES` said "Both conformance tests run every row", which has been false since iteration 1. It now says which test runs which option rows. I did not edit `ROADMAP.md:360`, as directed.

### IN-06: `SecretField` and `isSecret` name the fields Pi resolves

**Files modified:** `test/integration/mcp-builtin-encoding-conformance.test.ts`
**Commit:** 5dc96ce
**Applied fix:** I renamed the type to `PiResolvedField` and the guard to `isPiResolved`. The header said "A written secret value" and the `piResolved` doc said "one written secret". They now say "A written `env` or `headers` value" and "one written field value".

## Verification (iteration 2)

All gates ran in the main checkout, not in a worktree. Anyone can reproduce them from that tree at `5dc96ce`.

- `node --import "$PWD/scripts/isolated-pi-home.mjs" --test` on each touched integration file: `mcp-builtin-encoding-conformance` 49 of 49, `load-reconcile-race` 2 of 2, `mcp-status-conformance` 2 of 2.
- `node --test test/bridges/mcp/builtin-entry.test.ts`: 47 of 47. `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts` under `env -i`: exit 0.
- The new scenario: `npx cucumber-js --profile adapter features/mcp-server/project-scope.feature:200` passed. With `--profile builtin` it was selected 0 times. It was red with the break, as IN-01 describes.
- `npm run check:static` and `npm run test:integration`, under the heavy lock and `env -i`, at `5dc96ce`: both exited 0.
- The pre-commit hook (`npm run check:commit`) passed on every commit. I committed under `env -i HOME PATH LANG TMPDIR`, with the session's `SKIP=trufflehog` passed through. The reason: with the full Claude Code session environment, the Phase 6.1 test `test/bridges/hooks/dispatch-exec.test.ts:39` fails ("<persisted"... is not valid JSON). It passes 118 of 118 under `env -i`. The first commit attempt failed on that test and made no commit. I did not touch the file.

---

_Fixed: 2026-11-23T05:50:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
