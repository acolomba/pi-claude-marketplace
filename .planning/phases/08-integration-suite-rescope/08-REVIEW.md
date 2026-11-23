---
phase: 08-integration-suite-rescope
reviewed: 2026-11-23T05:21:30Z
depth: standard
iteration: 2
files_reviewed: 32
files_reviewed_list:
  - .agents/skills/cucumber/SKILL.md
  - .agents/skills/typescript-unit-tests/SKILL.md
  - .planning/codebase/TESTING.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - test/bridges/mcp/builtin-entry.test.ts
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
  warning: 3
  info: 6
  total: 9
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report (iteration 2)

**Reviewed:** 2026-11-23T05:21:30Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

I re-reviewed every file changed since `17fca7a` outside `.planning/phases/` and outside the Phase 6.1 files. I read the iteration-1 fix commits `7d76c64..dc8aa81` in full. `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are planning files, so they are out of the review set.

All ten iteration-1 findings are fixed:

- **WR-01.** 22 `EXPANSION_CASES` rows and 6 `OPTION_FIELD_CASES` rows moved to `test/bridges/mcp/builtin-entry.test.ts:316-408`. Each of the 49 cases left in `mcp-builtin-encoding-conformance.test.ts` calls `piConfigValues` or `piMcpServers`. The row counts match the doc: 30 + 22 = 52 expansion rows, 8 + 6 = 14 option rows. `node --test test/bridges/mcp/builtin-entry.test.ts` passed 47 of 47. Direct coverage, run alone under `env -i`, gives `builtin-entry.ts` 100% (branches 19/19, functions 4/4, lines 75/75). The conformance file passed 49 of 49 under `isolated-pi-home.mjs`.
- **WR-02, IN-03.** Both race headers now name the real gap. `state-lock.feature` holds the lock from a helper process and runs one command per scenario, as the header says.
- **WR-03.** The header and the title now say "leaves the bytes of state.json as they were", which is what `unchangedBytes` checks.
- **WR-04.** The header names what case 1 adds. `builtin-status.feature:191` is `@builtin-only`, as claimed. See IN-01 for what is still open.
- **WR-05, IN-05.** I extracted the charter from all three files and compared them with `diff`. Apart from TESTING.md's two-space nesting, they are word for word the same. They now have the `test/architecture/` bullet and the narrowed earlier-release sentence.
- **IN-01.** The `parent-wait` row is gone, and nothing names it.
- **IN-02.** `git-ops-fake.ts` pushes to `calls` for every member except `listRemotes` (`:155-253`), as the header now says.
- **IN-04.** The doc now cites `child-tool-plan.js`.
- The two rewritten claims in `docs/mcp-compatibility.md` (`:225`, `:621`) match the moved tests.
- ESLint, run with no cache on the touched test files, passes.

No new blocker. The open findings come from header and title text that iteration 1 did not check:

- The moved unit cases carry row titles that describe the adapter path.
- The conformance header still claims a validator check over "the table".
- One race case claims "exactly one process writes" with no assertion that can see it.

## Warnings

### WR-01: The moved unit cases' titles name behavior they do not check, and some of it is false on the built-in path

**File:** `test/bridges/mcp/builtin-entry.test.ts:373-374`, `:391-392` (row titles at `test/bridges/mcp/expansion-cases.ts:73`, `:84`, `:354`, `:385`)
**Issue:** The moved loops make each title as `${row.title} is written as Claude Code's value`. The row titles were written for the adapter path. They describe its install-time `written` and `missing` values, which these cases never read. Some run titles, from the spec reporter:

- `BLT-02: AVAR-01: args ${CLAUDE_PROJECT_DIR} stays a reference at user scope is written as Claude Code's value`. On the built-in path `projectDir` is the session directory at both scopes (P2-DC-03). So the case asserts `/work/project`, not a kept reference. The title says the opposite of what the case checks.
- `BLT-02: AVAR-02: args with a variable unset at install keeps the reference and reports it is written ...`. The built-in path resolves `${PI_CM_SITE}` from `runtimeEnv` to `--site=us5`, so it keeps no reference. No case asserts "reports it" (`missing`).
- `BLT-02: AVAR-05: url unset AWS_SESSION_TOKEN is written empty and never missing ...`. "never missing" is the `missing` field, which this case does not assert.
- `BLT-02: AVAR-01: args ~user/x is literal and the adapter leaves it ...`. This is a built-in unit case, and the adapter is not involved.

The unit-test skill says: "Every case must discriminate the behavior named in its title." These titles name behavior that no assertion checks, and some say the opposite of the assertion. The same row titles also appear in the 30 `env`/`headers` cases of `mcp-builtin-encoding-conformance.test.ts:143-144`. They were there before this phase, but the phase's brief covers that file's text too.
**Fix:** Give the built-in loops a title that names only what they assert, for example:

```ts
test(`BLT-02: the ${row.field} value ${JSON.stringify(row.raw)} is written as Claude Code's ${JSON.stringify(row.claudeOutput)}`, ...)
```

Another option: add an optional `builtinTitle` to `ExpansionCase` for the rows whose adapter wording does not hold on the built-in path, and use it in both built-in files.

### WR-02: The encoding conformance header says Pi's validator accepts "each config the table builds", but it never sees a table config

**File:** `test/integration/mcp-builtin-encoding-conformance.test.ts:10-12` (cases at `:199-259`)
**Issue:** The header says: "Pi's own `validateMcpServerConfig` accepts each config the table builds and returns it with the same JSON". In this header, "the table" means the shared expansion table (`:6-7`, and again at `:19`: "the table, the PI-1 and PI-2 cases, and the validator check"). No expansion row reaches `validateMcpServerConfig`. The validator runs only on the three hand-written `VALID_SERVERS` configs (`:199-225`) and on one refused url (`:241`). A wrong encoding that gives a table config Pi refuses, such as a malformed header object from a `headers` row, still passes every case. So the header claims more than the cases assert, which this phase set out to remove. The sentence was already there before this phase, and iteration 1 did not flag it.
**Fix:** Do one of these:

- Say what the cases check: "Pi's own `validateMcpServerConfig` returns a stdio config, a remote config with Claude Code's OAuth fields, and a direct-exposure config with the same JSON, so a re-registration does not reconnect (P2-DC-08), and it refuses a url that keeps an unset `${NAME}`."
- Make the claim true: in the `env`/`headers` loop, also assert that `JSON.stringify(piMcpServers.validateMcpServerConfig(SERVER_NAME, config))` equals `JSON.stringify(config)`.

### WR-03: The concurrent first-run migration case claims "exactly one process writes the config", but no assertion can see that

**File:** `test/integration/load-reconcile-race.test.ts:414` (title), `:28-29` (header bullet "captures legacy autoupdate exactly once")
**Issue:** The case asserts these things:

- Both children exit 0.
- The config exists and has one marketplace key, `mp-legacy`.
- That key has `autoupdate: true`.
- `state.json` still records `mp-legacy`.

If both processes ran the `absent` arm and both wrote the same config, every one of these assertions would still pass. `migrateFirstRunConfig`'s result is thrown away at `read-pass.ts:317`. No child reports which arm it took, and the case does not compare the inode or the mtime of the file. So "exactly one process writes the config, the other observes 'valid' and short-circuits" and "exactly once" are claims that the case cannot make fail. This header was rewritten in this phase, and the `workflow-kind-inversion.test.ts:201-204` precedent ("byte equality ... is satisfied by an atomic rewrite of identical content") applies here as well.
**Fix:** Reword the title and the bullet to what is asserted, for example "two concurrent first applies leave one config whose single marketplace carries the legacy autoupdate". If the one-writer claim matters, make it observable: have the child report the `migrated` arm of `migrateFirstRunConfig` over IPC through a seam it already holds, and assert that exactly one child reports `migrated: true`.

## Info

### IN-01: The `mcp-status-conformance` case 1 is kept for a missing scenario, not because a scenario cannot see it

**File:** `test/integration/mcp-status-conformance.test.ts:11-17` (case at `:84-142`)
**Issue:** The new header says that only this case compares the whole `info` text of both scopes, with the row `(overridden by project scope)` under pi-mcp-adapter. That row is user-visible `info` output. A scenario under the adapter profile could check it the same way that `builtin-status.feature:191` checks it under the built-in profile. The charter keeps a case in integration "only when neither a scenario nor a unit test can observe what it checks". The header now names what the case adds, as iteration 1 asked. But the reason it gives is a scenario that does not exist, not one that cannot exist. The case runs no adapter code: the test builds the snapshot itself, and the drift guard of case 3 already pins the constants.
**Fix:** Add an adapter-profile twin of `builtin-status.feature:191`. Then delete case 1 after a break that makes the new scenario fail. If you keep it, record why in a decision.

### IN-02: The charter's `test/architecture/` bullet does not describe the harness tests that the cucumber rules put there

**File:** `.agents/skills/typescript-unit-tests/SKILL.md:32`, `.agents/skills/cucumber/SKILL.md:16`, `.planning/codebase/TESTING.md:191`
**Issue:** The cucumber rules put harness tests in `test/architecture/`: `pi-tui-screen.test.ts`, `github-device-flow-redirect.test.ts`, and `hermetic-git-environment.test.ts` (`.agents/skills/cucumber/rules/layout.md:139`, `world-and-stand-ins.md:41`, `:56`, `:151`). `pi-tui-screen.test.ts` pins one module, `features/lib/pi-tui.ts`. That is neither "a structural invariant across the whole source tree" nor "a contract between modules". The last bullet's fallback ("or to `test/architecture/` when no single source pair owns it") still sends these tests to the right place. But the bullet that defines the category does not describe them, and neither does TESTING.md's "Architecture Tests" paragraph.
**Fix:** Extend the bullet in all three copies, for example "..., or a test of a cucumber harness module under `features/lib/`, is an architecture test under `test/architecture/`."

### IN-03: The Internal class uses two words for one gate, "no command shows" and "no step shows"

**File:** `.agents/skills/typescript-unit-tests/SKILL.md:36` (same text in `cucumber/SKILL.md:20` and `TESTING.md:195`)
**Issue:** The first sentence admits "a stored record field that no command shows". The new second sentence admits earlier-release state "only for a stored field that no step shows". Some steps read stored fields that no command prints, such as `the installation record of the {word} scope holds these options of {string}:` and `... holds these agents of {string}:` (`features/step_definitions/plugin/installation.steps.ts:508`, `:529`). So the two tests are not the same. A field that no command shows but a step reads passes the first sentence and fails the charter's opening gate. The cited rule file also lists only three earlier-release writers (`world-and-stand-ins.md:45`). The suite has more: the agents-index rows, the agents-folder file, the record with no `mcpServerConfigs`, and the record with no options. So "the earlier-release writers of the cucumber world rebuild it" points at a partial list.
**Fix:** Use "no step shows" in both sentences. Separately, list the four other earlier-release writers in `world-and-stand-ins.md:45`.

### IN-04: The deny-list pin cites the encoding conformance file, which does not pin the lists

**File:** `docs/mcp-compatibility.md:826`
**Issue:** The line reads: "The lists are pinned until a later release checks them again (`test/integration/mcp-builtin-encoding-conformance.test.ts`)." `test/domain/claude-credential-denylist.test.ts:48`, `:86`, and `:122` pin the lists: the name counts and SHA-256 digests of the Claude Code 2.1.291 sets. After WR-01, the conformance file holds no `url` deny-list row (`AWS_SESSION_TOKEN`, `GIT_CONFIG_VALUE_0`); those rows moved to `builtin-entry.test.ts`. The line was there before this phase, but this phase edited the neighboring claims about the same test.
**Fix:** Cite `test/domain/claude-credential-denylist.test.ts`.

### IN-05: The header of `expansion-cases.ts` does not name its new consumers

**File:** `test/bridges/mcp/expansion-cases.ts:5-10`
**Issue:** The header names only `substitute.test.ts` and the adapter conformance test as consumers of the rows. It does not name `builtin-entry.test.ts`, which since `7d76c64` checks `claudeOutput` for the fields Pi does not resolve, or `mcp-builtin-encoding-conformance.test.ts`. `ROADMAP.md:360` also still says the file "serves only the conformance tests", which was already false for `substitute.test.ts`. ROADMAP is out of the review set and is noted here only.
**Fix:** Add one sentence: "The built-in unit test and the Pi conformance test run each row through `builtinServerConfig` and expect `claudeOutput`."

### IN-06: `SecretField` and `isSecret` name the fields Pi resolves, not secrets

**File:** `test/integration/mcp-builtin-encoding-conformance.test.ts:75-76`, `:103-107`
**Issue:** The doc comment on `SecretField` says "The fields whose values Pi resolves when it connects". The type includes `env-builtin`, the injected `CLAUDE_PLUGIN_ROOT`, which is not a secret. The name is left over from the removed `secret` flag. The unit side calls the complement `WrittenAsIsField`, so the two files name one split in two ways.
**Fix:** Rename the type to `PiResolvedField` and the guard to `isPiResolved`.

---

_Reviewed: 2026-11-23T05:21:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
