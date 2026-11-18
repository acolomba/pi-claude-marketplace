---
phase: 03-background-subagents
plan: "08"
subsystem: agents
tags: [agents, hooks, pi-subagents, launch-mode, migration, docs, cucumber]
requires:
  - phase: 03-background-subagents
    provides: Delegated launch mode (03-07), real pi-subagents child driver (03-06), child identity and ownership (03-01, 03-03, 03-05)
provides:
  - Update and reinstall owner cases for an ordinary agent file an earlier release wrote with `async: false`, including the load pass, failure, and retry
  - Two command-level scenarios for the same migration boundary
  - Real ordinary-agent child acceptance under pi-subagents' default and a configured foreground default
  - Exact-marker real-child driver that reports the agent pi-subagents ran
  - Compatibility pages for the child hook contract and the launch-mode contract
affects: [phase-03-verification, PROJECT.md D-CF4-05, PROJECT.md D-CF6-10, ROADMAP Phase 3]
actuals:
  tokens: 19760
  tasks: 2
  commits: 3
plan_head_before: 1a8aa89365af285bb54fc207101ee01ac18fbb49
plan_head_after: 43b124755a225f8bb66ea2075b911ed3ddb564e2
commits: 3
tech-stack:
  added: []
  patterns:
    - The real-child provider looks up a bracketed marker whole, so agent names that share a prefix get their own scripts.
    - A real-child observation reports the agent that pi-subagents recorded, from its status or its tool result.
key-files:
  created: []
  modified:
    - features/lib/real-subagent-child.ts
    - features/step_definitions/plugin/subagent-hooks.steps.ts
    - features/agent/frontmatter.feature
    - features/lib/agent-files.ts
    - features/step_definitions/agent/listing.steps.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/integration/pi-subagents-child-identity.test.ts
    - docs/hooks-compatibility.md
    - docs/mcp-compatibility.md
key-decisions:
  - The load side of the migration boundary is the agent grant pass (`needsAgentGrantRewrite` / `rewriteAgentGrantForms`), the only load step that rewrites an agent file; the owners assert it finds nothing and leaves the bytes under both implementations.
  - An update whose workflows commit fails after its agent commit does not roll the agent file back (the swap's existing `rollback partial` design); the owner case asserts the intent mark and the retry instead. The reinstall case uses a state-save failure, which does restore the earlier bytes.
  - The ordinary real-child agent keeps `tools: Bash, Read`, because the driver's plugin has a stub MCP server and an omitted list is MCP-forced to the background (D-CF6-10).
  - The forcing scenario names its MCP-plus-false agent `granted-false` again, so the prefix case that exposed the driver bug stays covered.
requirements-completed: ["PG-AGENT-01", "PG-HOOK-07a"]
coverage:
  - id: D1
    description: A load keeps an earlier ordinary agent file with `async: false` byte for byte; update and reinstall regenerate it without a launch preference; a failed reinstall restores it; update and reinstall retries converge; the command scenarios show the same boundary with the load before the conversion and the repeated command after it.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/agent/frontmatter.feature
        status: pass
    human_judgment: false
  - id: D2
    description: A real ordinary pi-subagents child with an empty body and no call override runs detached under the companion default in both MCP profiles, with its actual type and session id on Pre/Post/PostFailure tool hooks and no lifecycle hook; a configured foreground default runs it in the main turn; existing explicit-background, MCP, concurrent and main controls stay green.
    requirement: PG-HOOK-07a
    verification:
      - kind: integration
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts
        status: pass
    human_judgment: false
duration: "about 95 min"
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 08: Installed Migration and Child Contract Summary

**An ordinary agent file that an earlier release wrote with `async: false` survives a load and loses the line only through update or reinstall. A real ordinary pi-subagents child now runs detached under the companion's default with its own tool-hook identity. The two compatibility pages state the measured child-hook and launch-mode contract.**

## Performance

- Base commit `1a8aa893` (2026-11-13). Task commits at 22:42:30Z, 22:55:25Z and 23:11:03Z.
- Tasks: 2, plus the requested driver fix. Commits: 3.
- Files modified: 10. Measured patch: 79,041 characters / 4 = 19,760 estimate-scale tokens.
- No production file changed. Every change is in tests, cucumber steps and libraries, features and docs.

## Accomplishments

- **Driver fix** (`features/lib/real-subagent-child.ts`): the scripted provider takes the first bracketed marker of the last user text (`[pg3-launch-<agent>]`, `[pg3-task-<agent>]`, `[pg3-main-control]`) and looks it up whole in the script map. Before, `[...script].find(([marker]) => text.includes(marker))` let `pg3-launch-demo:granted` match the text of `demo:granted-false`. `DetachedChildObservation.agent` is now the agent pi-subagents recorded: `status.steps[0].agent` for a detached child and `details.results[0].agent` for a foreground one.
- **update-swap.test.ts**: `seedEarlierOrdinaryAgentUpdate` installs `hello` 1.0.0 with the literal earlier bytes of `pi-claude-marketplace-hello-bot.md` (with `async: false` after `advertise: true`) and its earlier index row. Two cases:
  - "a load keeps an earlier ordinary agent's async false bytes and an update regenerates the agent without a launch preference": `needsAgentGrantRewrite` is false for adapter and builtin, `rewriteAgentGrantForms` leaves file and index bytes; the update then writes the complete current file, the complete index row and the complete record.
  - "an update whose workflows commit fails keeps its intent mark, and its retry finalizes the agent without a launch preference": full failed outcome, the `update-in-progress` record, and a retry that converges.
- **reinstall-flow.test.ts**: `seedEarlierOrdinaryAgentReinstall` installs, then puts back the earlier bytes and row. Two cases: load pass plus reinstall plus a repeated reinstall with identical outcome and bytes; and a reinstall whose state save fails, which restores the earlier file, index and `state.json` byte for byte, then a retry that regenerates.
- **frontmatter.feature**: "An installed ordinary agent adopts the delegated preference on update" and "... on reinstall". Each installs, replaces the generated file with the literal earlier text through the new step "the agents folder of the {word} scope holds the file {string} as an earlier release wrote it, with this text:", starts a new session (the load), checks the file still holds the earlier text, runs the command, checks the whole current file and the index rows, and repeats the command (update: `skipped up-to-date`; reinstall: `reinstalled`) with the file unchanged. The update scenario also states the load's `will update` preview.
- **pi-subagents-child-identity.test.ts**: an ordinary agent `plain` with an empty body, `tools: Bash, Read`, and a bash call plus a failing read, launched with no launch mode. Under each MCP profile with the configuration unset it runs `background` / `complete`, has a runner pid and its own session, and its hook runs are exactly PreToolUse/PostToolUse Bash and PreToolUse/PostToolUseFailure Read with `agent_type: demo:plain` and `agent_id: <session>`; no main run carries identity, and the main control's six runs hold. Under `asyncByDefault: false` it runs `foreground` and every hook run belongs to the main session (plus the `SessionEnd` of the session the install replaced).
- **docs/hooks-compatibility.md**: new "Hooks in pi-subagents children" section with the ten-event main/child table (SessionStart and Stop stand for unsupported SubagentStart/SubagentStop), compaction and Stop behavior, retained setup, "Child identity" (the `<active_agent name="..."/>` prefix read from structured prompt options, one-pass decoding, current session id, per-load and per-session scope, absent main properties, the missing/malformed diagnostic and omission), the foreground-child gap, and "Background hook processes of a child" (own journal, no reap in a child, own shutdown cleanup, dead-owner and dispatch-marker conditions, the 1024-journal bound). The Events row and the classification bullet for SubagentStart/SubagentStop now point to PG-HOOK-07b.
- **docs/mcp-compatibility.md**: the launch-mode contract (no `async` key for an ordinary agent, the two `async: true` cases, parser examples, call-level override residual), unchanged 0.87.0 floor with 0.88.1-only runtime evidence, update/reinstall migration, the corrected warning and exact old/current recognition on grant switching. The claim that the cucumber suite only uses a stand-in is replaced; the 2026-11-12/13 runs stay as dated history. "Claude Code runs it in the foreground" became "can run it in the foreground".

## Task Commits

1. **Driver fix (Rule 1)**: `6360de6a465464551ce6633983fdd9d1024c3698` (`fix(features): launch each real child by its exact agent marker`)
2. **03-08-01**: `c0ff074cc5f0f85810680747a0f39876aad55ab8` (`test(agents): migrate an earlier ordinary agent on update and reinstall`)
3. **03-08-02**: `43b124755a225f8bb66ea2075b911ed3ddb564e2` (`test(hooks): accept ordinary real children and document child hooks`)

Each commit ran the normal hook; `npm run check:commit` passed each time. No `--no-verify`, `--amend`, rebase or stash.

## Validation

Node v26.13.1; pi-subagents 0.88.1 and pi-mcp-adapter 7.0.1 from `node_modules/.cache/optional-peers`. Final tree `43b12475`.

| Scope | Command / condition | Result |
|---|---|---|
| Driver RED | Reporting fix applied, substring matching kept; `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature:86` | Exit 1. "pi-subagents ran the real children like this" fails: row 3 is `demo:granted`, expected `demo:granted-false`. `/tmp/pg3-08-driver-red.log` |
| Driver GREEN | Same scenario with exact markers | Exit 0; 1 scenario, 6 steps. `/tmp/pg3-08-driver-green.log` |
| 03-08-01 unit RED | Converter line put back to `async: backgroundForMcp \|\| isTrueBackground(...)` (working tree only, restored with `git checkout`) | Exit 1; all 4 new cases fail on `+ 'async: false\n'` in the regenerated file. `/tmp/pg3-08-task1-unit-red.log` |
| 03-08-01 load RED | `needsAgentGrantRewrite` made to return `rewritable.length > 0` (restored) | Exit 1; both load cases fail on `[true, true]` vs `[false, false]`. `/tmp/pg3-08-task1-load-red.log` |
| 03-08-01 cucumber RED | Converter neutralized as above, both new scenarios | Exit 1; each fails at the after-command file comparison on `+ async: false`. `/tmp/pg3-08-task1-cucumber-red.log` |
| 03-08-01 owners GREEN | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Exit 0; 501 pass, 0 fail/cancelled/skipped. `/tmp/pg3-08-task1-owners-green.log` |
| 03-08-01 coverage | `npm run test:coverage:direct -- .../update-swap.ts .../reinstall-flow.ts` | Exit 0 (100% direct). `/tmp/pg3-08-task1-coverage.log` |
| Adapter behavior | `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature` | Exit 0; 12 scenarios, 170 steps. `/tmp/pg3-08-cucumber-adapter-frontmatter.log` |
| Builtin behavior | `npm run test:cucumber:profile -- --profile builtin features/agent/frontmatter.feature` | Exit 0; 2 scenarios, 12 steps (the two new scenarios are not MCP scenarios, so they run under adapter only). `/tmp/pg3-08-cucumber-builtin-frontmatter.log` |
| Driver regression | `features/plugin/subagent-child.feature` under adapter and builtin | Exit 0; 19 scenarios / 259 steps and 14 / 185. `/tmp/pg3-08-cucumber-{adapter,builtin}-subagent-child.log` |
| 03-08-02 RED | Converter neutralized, the two ordinary default cases | Exit 1; both fail on `mode: 'foreground', state: undefined` vs `background` / `complete`. `/tmp/pg3-08-task2-red.log` |
| 03-08-02 GREEN | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | Exit 0; 6 pass, 0 fail/cancelled/skipped, about 122 s. No fixture process or directory left. `/tmp/pg3-08-task2-integration-green.log` |
| 03-08-02 docs format | `npx --no prettier --check docs/hooks-compatibility.md docs/mcp-compatibility.md` | **Not satisfiable** (see Deviations). `mcp-compatibility.md` passes prettier; `hooks-compatibility.md` fails only on lines 27 and 144, which already fail at `1a8aa893`. mdformat and markdownlint pass on both. `/tmp/pg3-08-prettier-docs.log`, `/tmp/pg3-08-prettier-head.log` |
| Static | `npm run check:features`; `fallow audit --base 1a8aa893` | Exit 0; audit: no issues in 10 changed files. `/tmp/pg3-08-fallow-audit.log` |
| Wave gate | `npm run check` on the combined tree | Not run here; the orchestrator owns it. |

### Validation-row evidence for the orchestrator

- **03-08-01** (T-03-18): passed. Owner command above, 501/501; both cucumber profiles green.
- **03-08-02** (T-03-19): passed. Integration command above, 6/6; the docs check is a deviation, not a pass.
- The other 16 rows carry their evidence in 03-01..03-07 SUMMARY files; this plan reran none of them except the frontmatter and subagent-child features listed above.
- **Flagged, unresolved:** the PG-HOOK-07a unclassified probe row stays flagged. Research A1 (another ambient extension can alter the prefix) stays open; the docs describe the missing-metadata omission as defensive only.

## Parent lines for the orchestrator

Apply before the phase gate. This executor did not edit PROJECT.md, ROADMAP.md, STATE.md or 03-VALIDATION.md.

**PROJECT.md, D-CF4-05 row (line 2166) — replace the whole row with:**

```markdown
| **D-CF4-05 (component-features, Phase 4, settled autonomously, DUBIOUS-CHOICES P4-DC-03, P4-DC-05; amended 2026-11-02 by D-CF6-10 and 2026-11-13 by D-PG3-01..03): a bridged agent leaves its launch mode to pi-subagents unless the source sets `background: true`**, which writes `async: true`. Any other value, and no value, writes no `async` key, so pi-subagents and its user configuration choose the mode. An agent that runs plugin MCP tools gets `async: true`, even with `background: false` (D-CF6-10). An agent file that an earlier release wrote keeps its `async: false` line until `update` or `reinstall` writes it again; a load does not rewrite it. `initialPrompt`, `observer`, `observerMessage`, and `observeSubagents` get the plugin-ignored warning. | Upstream runs a subagent in the background by default and ignores those fields on plugin agents; pi-subagents also defaults to the background, and its `asyncByDefault` setting can make the foreground its default. Residuals: a call can still ask for either mode, where Claude Code always runs a `background: true` subagent in the background. `memory` is not mapped (BACKLOG AGTMEM-01). | -- Locked |
```

**PROJECT.md, D-CF6-10 row (line 2160) — replace only the middle (rationale) cell with:**

```markdown
| pi-subagents gives MCP tools only to background children, so an agent that runs plugin MCP tools still always launches in the background (`async: true`), also after D-PG3-01 left every other agent's launch mode to pi-subagents (D-PG3-02). The harness now starts real pi-subagents 0.88.1 children with the companions and a loopback scripted provider, and a detached child granted the stub MCP tool runs it with its tool hooks under both MCP implementations (`features/plugin/subagent-child.feature`, `test/integration/pi-subagents-child-identity.test.ts`). The pi-subagents report is drafted in `06-09-SUMMARY.md` and not filed (BACKLOG MCPSUB-01). Phase verification passed, SC4 by user override (2026-11-02). |
```

**ROADMAP.md, Phase 3 Notes — replace the sentence** "A full background run needs a real child, which the harness cannot start." **with:**

```markdown
The harness now starts real pi-subagents children: detached under the companion's default and under explicit background or MCP forcing, in the foreground under a configured foreground default, and several child sessions at once in one runner process (`features/agent/frontmatter.feature`, `features/plugin/subagent-child.feature`, `test/integration/pi-subagents-child-identity.test.ts`).
```

Backlog claims stay limited to what this phase proves: the real background MCP call above is evidence the orchestrator may cite for MCPBG-01, but this plan does not close that entry.

## Decisions Made

- The load boundary is asserted on the agent grant pass, the one load step that writes agent files.
- The update failure case asserts the intent mark and retry, matching the swap's existing `rollback partial` design; the reinstall failure case asserts byte-for-byte restoration.
- The foreground real-child control asserts the complete main-session hook runs, so a foreground child that started running plugin hooks would fail it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Real-child driver matched launch markers by substring and reported its own label**
- **Found during:** pre-task (requested by the orchestrator; found by the 03-07 executor)
- **Issue:** `scriptedStep` used `text.includes(marker)`, so `demo:granted-false` got `demo:granted`'s script, and "pi-subagents ran the real children like this" showed the driver's label, not what pi-subagents ran.
- **Fix:** bracketed markers looked up whole; the observation reads the agent from pi-subagents' status or tool result. The forcing scenario uses `granted-false` again as the regression row. RED and GREEN logs above.
- **Files modified:** `features/lib/real-subagent-child.ts`, `features/step_definitions/plugin/subagent-hooks.steps.ts`, `features/agent/frontmatter.feature`
- **Commit:** `6360de6a`

**2. [Rule 3 - Blocking] No step could put an earlier release's agent text into an installed file**
- **Found during:** 03-08-01
- **Fix:** new Given step in `features/step_definitions/agent/listing.steps.ts` and `replaceStagedAgentFile` (temp file plus rename) in `features/lib/agent-files.ts`. Both are outside the plan's file list.
- **Commit:** `c0ff074c`

### Other deviations and interpretations

- **Docs format verify:** the plan's `npx --no prettier --check` cannot pass. The repository formats Markdown with mdformat (pre-commit), and prettier disagrees with mdformat on two lines of `hooks-compatibility.md` that already fail at the base commit: mdformat writes emphasis as `*present*`, `*same*` and `*new*` (lines 27 and 144), and prettier wants `_present_`, `_same_` and `_new_`. I changed neither line. The one new conflict I introduced (a double-backtick span in `mcp-compatibility.md`) became a `text` block, so that file passes both. Recorded in `.planning/WINDOWS.md` as entry 115. Also, with npm 11.20.0 `npx --no prettier --check` treats `--check` as an npm option; `node_modules/.bin/prettier --check` was used to read the result.
- **Update rollback:** the plan says "retain atomic rollback/recovery assertions". The update swap does not roll an agent commit back when a later phase fails (`rollback partial`, existing design and existing tests), so the update case asserts the intent mark and the converging retry. No production change.
- **Builtin profile:** the two new migration scenarios name no MCP, so the builtin profile does not run them by the suite's tag rules; the builtin verify still passed for the file.
- **Foreground child hooks:** measured, not planned: a foreground pi-subagents child loads no ambient extension, so no plugin hook runs for its tool calls. Documented as a Pi capability gap in `hooks-compatibility.md`; the integration control asserts it.

## Issues Encountered

- The first Task 1 commit attempt passed the file list as one zsh word, so `git commit` failed on the pathspec and nothing was committed; the earlier `pre-commit run --files` with the same variable checked nothing. Both were rerun with an array; the reported pre-commit and hook results are from the array runs.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-18 is covered by the load-pass, update, reinstall, failure and retry owner cases and the two scenarios; T-03-19 by the ordinary real-child cases under both profiles with identity and cleanup assertions. No package was installed and no dependency floor changed (T-03-SC).

## Self-Check: PASSED

- `git merge-base --is-ancestor` succeeds for `6360de6a465464551ce6633983fdd9d1024c3698`, `c0ff074cc5f0f85810680747a0f39876aad55ab8` and `43b124755a225f8bb66ea2075b911ed3ddb564e2` (checked with `git rev-parse`).
- All ten modified files exist. Every RED was produced by a working-tree neutralization and restored with `git checkout --`; `git status` was clean of production files after each.

## Next Phase Readiness

Ready for the wave-6 combined-tree `npm run check` and the parent-line edits above.
