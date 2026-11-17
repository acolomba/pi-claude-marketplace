---
phase: 10-plugin-options-variables-and-trust
verified: 2026-11-16T08:00:34Z
status: passed
score: 156/157 must-haves verified (154 VERIFIED, 2 PASSED (override)); 1 plan clause not met as written, carried as advisory (records only); 19 judgment-tier prohibitions flagged
covered_files: [".planning/phases/10-plugin-options-variables-and-trust/10-01-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-01-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-SUMMARY.md","CHANGELOG.md","docs/env-vars.md","docs/hooks-compatibility.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts","extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts","extensions/pi-claude-marketplace/bridges/agents/stage.ts","extensions/pi-claude-marketplace/bridges/agents/types.ts","extensions/pi-claude-marketplace/bridges/commands/stage.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/commands/types.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts","extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts","extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/substitute.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/bridges/skills/types.ts","extensions/pi-claude-marketplace/domain/argument-substitution.ts","extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts","extensions/pi-claude-marketplace/domain/components/plugin.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/unsupported-components.ts","extensions/pi-claude-marketplace/domain/user-config.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts","extensions/pi-claude-marketplace/orchestrators/plugin-options.ts","extensions/pi-claude-marketplace/orchestrators/plugin-path.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts","extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","extensions/pi-claude-marketplace/persistence/state-io.ts","extensions/pi-claude-marketplace/shared/completion-cache.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","extensions/pi-claude-marketplace/shared/notify-reasons.ts","extensions/pi-claude-marketplace/shared/probe-classifiers.ts","extensions/pi-claude-marketplace/shared/session-env.ts","extensions/pi-claude-marketplace/shared/vars.ts","features/agent/frontmatter.feature","features/agent/options.feature","features/hook/failures.feature","features/hook/process.feature","features/lib/hook-recorder.ts","features/mcp-server/builtin-options.feature","features/mcp-server/legacy-move.feature","features/mcp-server/lifecycle.feature","features/mcp-server/options.feature","features/plugin/executables.feature","features/plugin/install.feature","features/plugin/options.feature","features/plugin/project-trust.feature","features/plugin/reinstall.feature","features/skill/invocation.feature","features/skill/model-reads.feature","features/skill/options.feature","features/slash-command/invocation.feature","features/slash-command/model-runs.feature","features/slash-command/options.feature","features/step_definitions/mcp-server/builtin-options.steps.ts","features/step_definitions/mcp-server/options.steps.ts","features/step_definitions/model.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/plugin/publishing.steps.ts","features/support/world.ts","test/architecture/cross-surface-reason-parity.test.ts","test/bridges/hooks/hook-env.test.ts","test/bridges/hooks/spawn-helpers.test.ts","test/bridges/mcp/adapter-escape.test.ts","test/bridges/mcp/builtin-entry.test.ts","test/bridges/mcp/builtin-escape.test.ts","test/domain/claude-mcp-variables.test.ts","test/domain/plugin-resolver.test.ts","test/domain/user-config.test.ts","test/integration/adapter-expansion-conformance.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/plugin-options.test.ts","test/orchestrators/plugin-path.test.ts","test/orchestrators/skill-invocation.test.ts","test/persistence/state-io.test.ts","test/shared/probe-classifiers.test.ts","test/shared/session-env.test.ts","test/shared/vars.test.ts"]
covered_digest: "v4:sha256:15348864f2a893978293d8c00f413d0e8fcc39eab98399006d88ff187e910b5c"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "PG-SEC-02 (requirement text): the maintainer confirms or reopens the accepted trust gap."
    reason: "A maintainer decision, not code or a test. Re-checked 2026-11-16, unchanged: the decision is recorded with its premise and Pi 1.5.0/1.5.2 (D-PG10-01, now PROJECT.md:2432; Truth 5 verified). The autonomous run took option A and the row still says Pending maintainer review. PG-SEC-02 stays `[ ]` Pending in REQUIREMENTS.md:81 and :213 until the maintainer answers. Same pattern as the phase 9 overrides."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-15T23:30:00Z"
  - must_have: "Every reader of a record's userConfig goes through one function, recordedOptionsOf, which validates the stored value again with the manifest parser. A stored value that does not parse reads as no options and is debug-logged; it never throws past a load (10-08 truth 5)"
    reason: "Recorded decision D-PG10-25 (PROJECT.md:2440, review finding WR-02, confirmed by the maintainer review 2026-11-16) changes the 'reads as no options' clause: an unparseable stored userConfig now reads as a plugin that declares options with no values, resolveOptions({}), so Pi's built-in MCP skips each server that names an option, no option variable is set, and an exec-form hook that names an option is refused as unset, in place of keeping references literal (persistence/state-io.ts:356-370). The rest holds as planned: recordedOptionsOf is the one reader (callers bridges/hooks/event-router.ts:849, orchestrators/plugin-options.ts:74, orchestrators/mcp/builtin-registration-step.ts:264), it re-parses with parseUserConfig (:363), logs through hookDebugLog (:365), and cannot throw. Test `D-PG10-25: reads ... as declared options with no values and logs it` (test/persistence/state-io.test.ts:865) and scenario features/mcp-server/builtin-options.feature:37 pin it; the state-io D-PG10 group passed here (13/13). The previous report described D-PG10-25 but did not record that it changes this plan clause."
    accepted_by: "project decision D-PG10-25 (PROJECT.md:2440); maintainer review 2026-11-16"
    accepted_at: "2026-11-16T08:00:34Z"
re_verification:
  previous_status: passed
  previous_score: "6/6 (5 verified, 1 passed by override: the maintainer's PG-SEC-02 confirmation)"
  previous_verified: 2026-11-15T22:00:00Z
  reason: "staleness: init.manager reported covered files changed after the previous report (711af3f5). `git diff --stat 711af3f5 HEAD` over its 73 covered non-planning files shows 21 changed, by the Phase 6-8 and 11 work and the gaps-agents/gaps-mcp merges (17d7bae4, 24de427b): 14 phase source files (bridges/agents/convert.ts and types.ts, bridges/commands/staged-command.ts, bridges/hooks/event-router.ts, hook-env.ts and routing-state.ts, bridges/skills/stage.ts, domain/argument-substitution.ts, index.ts, orchestrators/command-invocation.ts, skill-invocation.ts, plugin/info.ts, install-outcome.ts and update-swap.ts) and 7 feature files. Every phase source change is additive to the option, trust and project-directory paths (see Superseded mechanisms). No phase 10 planning artifact changed."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "The previous score counted the five roadmap criteria and the PG-SEC-02 maintainer truth only. This pass checks all 156 plan truths of the 21 plans. Five restate a criterion and are folded into it (10-03 truths 1 and 7 into criterion 3, 10-04 truths 1 and 5 into criterion 4, 10-08 truth 1 into criterion 1), so the denominator is 6 + 151 = 157."
  status_correction: "The previous frontmatter set passed while its body said human_needed and listed four Human Verification items, all maintainer decisions or judgment-tier prohibitions. Following the Phase 4/6/7/9 re-verifications, this report lists them under Maintainer Review and keeps human_verification empty."
  prohibition_count_correction: "The previous report counted 16 judgment-tier prohibitions over 12 plans. The plans hold 19 (10-02: 1, 10-04: 2, 10-07: 1, 10-08: 1, 10-09: 2, 10-10: 2, 10-16: 1, 10-17: 1, 10-18: 2, 10-19: 1, 10-20: 3, 10-21: 2), all verification: judgment."
  overrides_kept:
    - "PG-SEC-02 maintainer confirmation (D-PG10-01 still pending maintainer review)"
  overrides_added:
    - "10-08 truth 5, the 'reads as no options' clause (D-PG10-25)"
  overrides_removed: []
advisory:
  - finding: "10-20 truth 3 says each of D-PG10-04, -06, -11, -16, -19, -23 and -24 has a Key Decisions row with 'the versions it was checked against'. Four rows name a version (D-PG10-04 and -06: Claude Code 2.1.323, PROJECT.md:2433-2434; -11: pi-mcp-adapter 7.0.1, :2435; -19: Claude Code 2.1.323, :2437). Three name none: D-PG10-16 (:2436, premise cites core.md U4.4 with no Claude Code version), D-PG10-23 (:2438) and D-PG10-24 (:2439, 'read in source' of this repository). The rows have read this way since 25b3b227, so this is not a regression."
    category: other
    reason: "Records only; no code, test or user-visible text depends on it, and every other clause of the truth holds (premise, alternative, Pending maintainer review, the SUB-02 and USRCFG-01 amendments). No recorded decision covers the omission, so it is not overridden. To resolve: add the Claude Code version that core.md U4.4 was read at to D-PG10-16, and either the Pi and pi-mcp-adapter versions to -23 and -24 or a note that the row rests on this repository's own code; or convert this advisory to a gap."
    evidence_status: "reproducible: `sed -n 2436p;2438p;2439p .planning/PROJECT.md | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+'` prints nothing"
  - finding: "The 10-02 artifact probe `contains: PI_CLAUDE_MARKETPLACE_OPTION_` for test/integration/adapter-expansion-conformance.test.ts fails (`query verify.artifacts` 2/3, exit 1). The file never held the literal: the A1 case builds the name with ownedOptionVariableName (:40, :901-906) and asserts it is `\\w+` (:913)."
    category: other
    reason: "A plan artifact probe, not a must-have truth. The A1 truth holds: 16 named D-PG10 conformance cases passed here against pi-mcp-adapter 7.0.1, and the exact prefix is pinned by `OWNED_VARIABLE_PREFIX uses the exact prefix of every owned option variable (D-PG10-23)` (test/domain/user-config.test.ts:514). The previous report did not run the artifact probe. To resolve: drop or correct the probe pattern in a future plan; no code change is needed."
    evidence_status: "reproducible by `query verify.artifacts .planning/phases/10-plugin-options-variables-and-trust/10-02-PLAN.md`; no failing test"
prohibitions_flagged: 19
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition — human review recommended. The 19 judgment-tier prohibitions of plans 10-02, 10-04, 10-07 to 10-10, 10-16 to 10-21 were re-read against the current tree and no violation was found (see the Prohibitions section). Following the Phase 1 re-verification (660e6da6) and the Phase 4/6/7/9 re-verifications, they are flagged here and listed under Maintainer Review, not as manual tests."
human_verification: []
---

# Phase 10: Plugin Options, Variables, and Trust Verification Report

**Phase Goal:** A plugin's `userConfig` defaults reach its hooks, its MCP servers, and its content, so that a plugin whose options all have a default installs without `--partial`. A user-scope skill or command gets the project directory. A plugin's `bin` directory joins `PATH` only when it exists and, for a project-scope plugin, only when Pi trusts the project. The accepted project trust gap is confirmed or reopened.

**Verified:** 2026-11-16T08:00:34Z
**Status:** passed, with 19 flagged judgment-tier prohibitions and 2 advisories. All five roadmap criteria hold on the current tree. Of the 151 separate plan truths, 149 hold as written, 1 passes by a decision override (D-PG10-25), and 1 is not met as written in one clause and is carried as a records-only advisory (10-20 truth 3, three PROJECT.md rows name no version). The PG-SEC-02 maintainer step stays carried by its override.
**Re-verification:** Yes. The previous report (passed, 6/6, one override, commit 711af3f5) became stale because later work changed 21 of its 73 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `fb957770`. It did not reuse the earlier verdicts, and summaries were not taken as evidence, except for the 10-01 measurement, which is a recorded run and not code. For each truth, the implementing code, its callers, and the scenario or test that exercises it were read again. Citations are current line numbers. **E/** means `extensions/pi-claude-marketplace/`, **H/** means `E/bridges/hooks/`, **M/** means `E/bridges/mcp/`, and **UC** means `E/domain/user-config.ts`.

What moved since the previous report: H/hook-env.ts gained lines above the option spread (`prepareHookEnv` is now :87-118, the option spread :103-105, previously cited as :99). H/event-router.ts gained the D-PG6-07 MCP server refresh and the D-PG6-18 typed expansion; the load hydrate reads `recordedOptionsOf` at :849 (previously :696). `index.ts` reads trust once at :197 (previously :181) and calls `recomputePluginPath` at :242 (previously :217) and the option apply at :256 (previously :231). The D-PG10-01 row moved from PROJECT.md:2402 to :2432 because Phase 6-9 rows were inserted above it. `features/hook/failures.feature` moved the shell-form refusal from :177 to :211, and `features/agent/frontmatter.feature` moved the agent guard from :72 to :107. UC, `orchestrators/plugin-path.ts`, `orchestrators/plugin-options.ts`, `persistence/state-io.ts`, `domain/claude-mcp-variables.ts`, M/stage.ts, M/builtin-entry.ts, M/builtin-escape.ts, `orchestrators/mcp/builtin-registration-step.ts` and `shared/vars.ts` did not change, and their citations were re-read in place.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). The unpaired and integration tests passed with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`, on Node v26.13.1. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460), so every `@adapter-only` and `@mcp` phase scenario ran. The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387), which includes `features/mcp-server/builtin-options.feature` and the `@builtin-only` rows of `features/mcp-server/options.feature`. Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD. The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 14 owner test files and 5 named D-PG10 groups, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad; all passed, 621 tests in total (see Behavioral Spot-Checks). `query verify.artifacts` gives the full count for 20 plans and 2/3 for 10-02 (advisory 2). `query verify.key-links` gives the full count for all 21 plans (44/44 links), each with exit 0.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 10 must-haves |
| --- | --- | --- |
| D-PG10-25 (in-phase review WR-02, PROJECT.md:2440, confirmed by the maintainer review 2026-11-16) | An unparseable stored `userConfig` reads as declared options with no values, `resolveOptions({})` (state-io.ts:356-370). | Override 2 (10-08 truth 5). 10-14 truth 5 and 10-19 truth 7 still hold: a record with no stored field reads as undeclared and keeps references as written. |
| D-PG6-07 (Phase 6, PROJECT.md decision log, confirmed by the maintainer review 2026-11-16) | The load adds `hooksHydration.refreshMcpServers(event.cwd, projectTrusted)` (index.ts:226). It reads the project scope only when trusted (H/event-router.ts:1078-1092). | Additive. It takes the same trust constant, so the load still reads `ctx.isProjectTrusted()` twice, as before the phase (index.ts:197, :286; 75f01fc9 had the same two reads). |
| D-PG6-18 (Phase 6) | One plugin-name cache feeds the typed-expansion resolver and the alias handler (index.ts:182-186). | None. |
| D-PG7-01/-05/-08/-09 (Phase 7) | Agent frontmatter is read as YAML; an agent may start subagents (`allowNestedSubagents: true`). | Content fill unchanged (E/bridges/agents/convert.ts:1058). 25caef67 added the nesting key to the expected agent file of features/agent/options.feature. |
| D-PG11-01/-02/-06 (Phase 11) | A plugin command also answers to its Claude Code name; command and skill bodies attach the files they mention. | Additive. `commandVariables` (orchestrators/command-invocation.ts:167-185) and `invocationVariables` (orchestrators/skill-invocation.ts:154-169) still set `CLAUDE_PROJECT_DIR: request.cwd`, and the trust gates (:275, :406; :261, :377) are unchanged. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | A plugin with a `mode` option defaulting to `fast` and a hook that prints `$CLAUDE_PLUGIN_OPTION_MODE` prints `fast`, and installs without `--partial`; a required option with no default is refused without `--partial` (PG-CORE-03). Folds 10-08 truth 1. | ✓ VERIFIED | features/plugin/options.feature:13 (installed, no reasons) and :71 (partially-available, `options not set`, `partial-install` hint, nothing installed). features/hook/process.feature:110: the hook's real `process.env` (features/lib/hook-recorder.ts) holds `CLAUDE_PLUGIN_OPTION_MODE=fast`. Code: UC `resolveOptions` :264-285 and `hookOptionVariableName` :308-310, spread at H/hook-env.ts:103-105; resolver `resolveUserConfig` (E/domain/plugin-resolver.ts:739-763) adds `userConfig` to `unsupported` only when `unsetRequired` is not empty; E/domain/unsupported-components.ts:38-40 leaves `userConfig` out. Rests on D-PG10-19 (Maintainer Review 2). In Gate G. |
| 2 | `${user_config.KEY}` is filled with the default in an exec-form hook command and arguments, in `command`, `args`, `env`, `url` and `headers` under both profiles, and in skill and agent content; a sensitive value is not written into content (PG-CORE-03). | ✓ VERIFIED | Hook: process.feature:30; `planSpawn` fills `command` and each string arg (H/spawn-helpers.ts:68-79). MCP under the adapter: args options.feature:276 (`@mcp`, both profiles), command and env :298, url and header :333; real stub servers receive the values. Built-in: :381, :420, and builtin-options.feature:74. The adapter entry holds `${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}` and no value (options.feature:220). Content: features/skill/options.feature:7 (default; sensitive gives `[sensitive option 'token' not available in skill content]`), features/agent/options.feature:7 (the staged file holds the placeholder), features/slash-command/options.feature:7. Code: E/shared/vars.ts:96-102, :112-126. 16 named D-PG10 adapter conformance cases passed here. |
| 3 | A user-scope command with `project ${CLAUDE_PROJECT_DIR}` sends the project path when typed and through `run_plugin_command`; a user-scope skill shows it when the model reads its staged `SKILL.md`; an agent body stays as it is (PG-CORE-05). Folds 10-03 truths 1 and 7. | ✓ VERIFIED | features/slash-command/invocation.feature:113, features/slash-command/model-runs.feature:79, features/skill/model-reads.feature:43 (read of `{agent dir}/.../SKILL.md` returns `project {project dir}`), and the agent guard features/agent/frontmatter.feature:107 (the staged body keeps `${CLAUDE_PROJECT_DIR}`). Code: E/orchestrators/command-invocation.ts:175 and E/orchestrators/skill-invocation.ts:165. Rests on D-PG10-16 (Maintainer Review 3). |
| 4 | In a project marked "Do not trust", the bash tool does not find an enabled project plugin's `bin/hello`; in a trusted project it does; with two enabled plugins, one with `bin/`, PATH holds one plugin entry (PG-CORE-06, PG-CORE-07). Folds 10-04 truths 1 and 5. | ✓ VERIFIED | features/plugin/executables.feature:7 (trusted: `greeted`), :59 (refused trust: `absent`), :85 (`PI_CLAUDE_MARKETPLACE_PATH` holds one entry). The harness saves Pi's own `trust.json` value `false` (features/support/world.ts:1048-1059; features/step_definitions/model.steps.ts:107-120 reads it back). Code: index.ts:197 reads trust once and passes it to `recomputePluginPath` (:242); E/orchestrators/plugin-path.ts:156-161 reads the project `state.json` only when trusted; `keepsBinDir` (:83-105) keeps only an existing directory with no metacharacter; the ledger is written in the same call that sets `PATH` (:177-179). |
| 5 | The decision on the trust gap of D-LOC-01 is in `PROJECT.md` with its premise and the Pi version it was checked against (PG-SEC-02). | ✓ VERIFIED | PROJECT.md:2432 (D-PG10-01): the question, the Claude Code premise (`core.md` U9), Pi 1.5.0 and 1.5.2, options A and B, the security flag, the residual, reversibility, outcome `Pending maintainer review`. D-LOC-01 (:2150) names `PATH` among the effects gated on `ctx.isProjectTrusted()` and says "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)". `.planning/upstream/pi-extension-trust-paths.md` exists (Patch line :3); BACKLOG.md:5478 PITRUSTPATHS-01. |
| 6 | PG-SEC-02 (requirement text): the maintainer confirms or reopens the accepted trust gap. | PASSED (override) | Override 1. The record says Pending maintainer review; REQUIREMENTS.md:81 `[ ]`, :213 Pending. Maintainer Review 1. |

### Plan Truths (those that restate a criterion are folded into it)

**10-01: harness and guard scenarios**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | A scenario publishes a 0755 plugin file; the step fails on wrong text or mode | ✓ VERIFIED | features/step_definitions/plugin/publishing.steps.ts:362-377 (`chmod 0o755`, mode assert :375); `writePluginText` asserts the text (:341-351). |
| 2 | Profile Pi starts in a "Do not trust" project; `trust.json` holds `false` for the real path in Pi's format; the step fails otherwise | ✓ VERIFIED | world.ts:154 (`refused`), :740-741, `saveSandboxTrust` :1052-1059 (realpath key, two-space JSON, trailing newline, read-back assert); model.steps.ts:110-120 asserts the file. |
| 3 | Trusted project: the bash call finds `hello` | ✓ VERIFIED | executables.feature:7. In Gate G. |
| 4 | A user-scope plugin's `hello` is found in a "Do not trust" project (D-PG10-02) | ✓ VERIFIED | executables.feature:33. |
| 5 | In the refused profile, a project plugin's hook records no run (measured once, recorded) | ✓ VERIFIED | Recorded run in 10-01-SUMMARY.md:44 (scenario passed; trusted control failed at the same step), files deleted. Consistent with executables.feature:59 and project-trust.feature:29, which pass in Gate G. |

**10-02: the option module**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Strict schema: key pattern, required `type`/`title`/`description`, optional fields, `options` rules (D-PG10-05, -20) | ✓ VERIFIED | UC :27-49 (`additionalProperties: false`), :97, `optionValueProblems`/`optionUseProblems` :186-219. 56/56 owner cases passed. |
| 2 | Malformed result names the first bad key or field; `null`, array, string, `false`, unknown field, missing title/description are malformed | ✓ VERIFIED | UC :151-184, :221-261; test `gives malformed for ${label}, naming the first bad key or field (D-PG10-05)` (user-config.test.ts:232). |
| 3 | `{}` parses, resolves to no value, no unset key, no sensitive key | ✓ VERIFIED | UC :239-261, :264-285; tests at :49 and :347. |
| 4 | A default of another type is accepted as `String(default)`; arrays join by commas; `""` is a value | ✓ VERIFIED | UC :39-41, :274-276; test at :60. |
| 5 | Two maps (hooks/content vs MCP with `""` for optional no-default); required no-default in neither and unset | ✓ VERIFIED | UC :264-285; test at :262. |
| 6 | Unset keys in declaration order, stable | ✓ VERIFIED | UC :269-279; test at :314. |
| 7 | Own-key reads; `__proto__`/`constructor` are ordinary keys | ✓ VERIFIED | UC :245, :258-260, :269; tests at :78 and :364. |
| 8 | Hook variable naming; two case-variants give one name | ✓ VERIFIED | UC :105, :308-310; describe at :493. |
| 9 | Process variable: prefix plus 16 hex of SHA-256 over scope, marketplace, plugin, key joined by NUL | ✓ VERIFIED | UC :121-123, :313-317; tests at :514, :531, :543. |
| 10 | pi-mcp-adapter 7.0.1's `interpolateEnvVars` turns the reference into the raw default, never the value of `X` (A1, D-PG10-23) | ✓ VERIFIED | test/integration/adapter-expansion-conformance.test.ts:840-924 (13 defaults × 3 contexts, secret never appears); `D-PG10-23: pi-mcp-adapter turns a reference ...` passed here. Artifact probe: advisory 2. |

**10-03: project directory at user scope** (truths 1 and 7 folded into criterion 3)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | A user-scope skill shows the directory when invoked and when the model reads it | ✓ VERIFIED | features/skill/invocation.feature:204, model-reads.feature:43. |
| 3 | A `${CLAUDE_PROJECT_DIR}` in a typed argument is filled too | ✓ VERIFIED | Variables reach `substituteArguments` (command-invocation.ts:221, :342; skill-invocation.ts:199, :410); test `D-PG10-16: a typed argument names the project directory of a user command` (command-invocation.test.ts:282) passed. |
| 4 | The value is the request's cwd as given, no normalization | ✓ VERIFIED | `CLAUDE_PROJECT_DIR: request.cwd` (command-invocation.ts:175, skill-invocation.ts:165); test case `/Work Dir/Café` (command-invocation.test.ts:174-179). |
| 5 | Several places get it; a body without it is unchanged | ✓ VERIFIED | Test table at command-invocation.test.ts:167-193. |
| 6 | Staged user-scope files keep the literal | ✓ VERIFIED | `projectDir` only at project scope (E/bridges/skills/stage.ts:500); `ClaudePluginVars.projectDir` absent keeps the token (vars.ts:90-92); agent file at frontmatter.feature:107. |
| 8 | Project commands and skills of an untrusted project still run nothing | ✓ VERIFIED | Gates unchanged: command-invocation.ts:275, :406; skill-invocation.ts:261, :377; tests D-CF3-06/D-LOC-01/T-02-17 passed (51/51, 59/59). |

**10-04: PATH trust gate and existence filter** (truths 1 and 5 folded into criterion 4)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | Untrusted: project `state.json` not read for PATH, no skipped-scope warning, earlier project entries leave PATH and ledger | ✓ VERIFIED | plugin-path.ts:153-170, :177 (`applyPathLedger` removes owned entries absent from the fresh list). 29/29 owner cases passed. |
| 3 | User-scope `bin` on PATH whatever the trust answer | ✓ VERIFIED | plugin-path.ts:153-155; executables.feature:33. |
| 4 | Trust is read no more often than before | ✓ VERIFIED | index.ts:197 (one constant) feeds :199, :210, :226, :242, :256; the other read at :286 predates the phase (75f01fc9 index.ts:163, :239). |
| 6 | `bin` joins only when `stat` says directory (following links); missing, a file, or ENOTDIR add nothing | ✓ VERIFIED | `keepsBinDir` plugin-path.ts:89-100. |
| 7 | Metacharacter drop (skipped on backslash separator); other `stat` errors keep the path; each logged | ✓ VERIFIED | plugin-path.ts:71-73, :84-87, :102-103. |
| 8 | A folder created or removed after the load is reflected at the next `/reload` | ✓ VERIFIED | Filter runs at each recompute (plugin-path.ts:172); called from every load (index.ts:242). |

**10-05: resolver and install arms**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | All-defaults plugin installs without `--partial`; `list` shows it `available` | ✓ VERIFIED | options.feature:13; resolver test `D-PG10-04: options that all have a default resolve installable and carry the schema` (plugin-resolver.test.ts:5305) passed; `list` maps installable to `available` (E/orchestrators/plugin/list-candidate-row.ts:82). No list scenario (Info). |
| 2 | `userConfig` is not an unsupported kind; no `contains userConfig` note | ✓ VERIFIED | unsupported-components.ts:38-40; test/domain/unsupported-components.test.ts:97. |
| 3 | Required no-default: one fixed-prefix note naming keys in order and one unsupported kind | ✓ VERIFIED | plugin-resolver.ts:756-760; probe-classifiers.ts:157. |
| 4 | `{}` installs and carries an empty schema; none carries none; distinguishable | ✓ VERIFIED | plugin-resolver.ts:744-755; tests at :5320 and :5332. |
| 5 | Malformed `userConfig` makes the plugin unavailable on install, list and info with `invalid manifest`; `--partial` does not install it | ✓ VERIFIED | plugin-resolver.ts:749-752 (structural, returns true); options.feature:37, :54 (install, `--partial`); read-only surfaces map the note to `invalid manifest` (probe-classifiers.ts:206-208; test `D-PG10-05: classifies a malformed userConfig note ...`, probe-classifiers.test.ts:195). |
| 6 | Entry `userConfig` applies only without a `plugin.json` | ✓ VERIFIED | plugin-resolver.ts:744; tests at :5435, :5446, :5462. |
| 7 | Option keys `lspServers`/`source` do not change either note's reason | ✓ VERIFIED | Prefix arms before the substring arm (probe-classifiers.ts:204-216); cross-surface-reason-parity.test.ts:134-158 uses `lspServers, source`; passed here. |
| 8 | Completion cache `schemaVersion` 8; version 7 rebuilt | ✓ VERIFIED | E/shared/completion-cache.ts:90-93; test `D-PG10-24: rejects adjacent plugin schema version` (completion-cache.test.ts:457). |

**10-06: the `options not set` reason**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Refused without `--partial` with `options not set` and the hint; nothing installed | ✓ VERIFIED | options.feature:71-93. |
| 2 | Installs with `--partial` as `partially-installed`, defaults delivered | ✓ VERIFIED | options.feature:95-118. |
| 3 | `list`, `info` and install give the same reason through one kind-to-reason function | ✓ VERIFIED | `kindToReason` probe-classifiers.ts:286-287; install routes through `narrowUnsupportedKinds` (E/orchestrators/plugin/install.messaging.ts:547-556); cross-surface-reason-parity.test.ts:134-158 passed. |
| 4 | `info` shows one line naming every unset key in declaration order | ✓ VERIFIED | E/orchestrators/plugin/info.ts:1181, :1193-1205; options.feature:120. |
| 5 | `options not set` in every home of the closed vocabulary, one member added | ✓ VERIFIED | notification-types.ts:304, probe-classifiers.ts:82, notify-reasons.ts:135, notification-wire.ts:166; lock and catalog tests (notify-closed-set-locks, catalog-uat fixtures for install, list, info); docs/output-catalog.md:529, :759, :3496; docs/json-output.md:950. |
| 6 | An earlier `--partial` record because of `userConfig` reads `partially-installed` with `options not set` until a restage | ✓ VERIFIED | The record's `compatibility.unsupported` holds `userConfig`, which the read-only surfaces narrow with `narrowUnsupportedKinds` to `options not set` (cross-surface-reason-parity.test.ts:153); refreshed only at restage (D-PG10-24, PROJECT.md:2439). |

**10-07: the recorded schema**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | The install record holds the declared schema in optional `userConfig`, no `schemaVersion` bump, no typed value | ✓ VERIFIED | state-io.ts:160-171 (`Type.Optional`); `userConfigFieldsOf` :331-344 copies the declared schema; features/plugin/install.feature:24. |
| 2 | Present only when declared; `{}` stored; legacy record loads unchanged | ✓ VERIFIED | state-io.ts:334-336; tests at state-io.test.ts:685, :755, :845. |
| 3 | One producer, deep copy | ✓ VERIFIED | `structuredClone` state-io.ts:340; writers install-outcome.ts:1682, update-swap.ts:976, update-preflight.ts:850, mcp-migration.ts:614; test at :724. |
| 4 | Written at every `mcpServerConfigs` site; `apply` restores it with the pinned fields | ✓ VERIFIED | The four writers above; `DISABLED_PIN_FIELDS` holds `userConfig` (update-preflight.ts:801-811), reused as `PIN_FIELDS` by `restorePin` (E/orchestrators/reconcile/apply.ts:1948-1999). |
| 5 | Reinstall records the manifest's options as they are then; none removes the field | ✓ VERIFIED | `replaceUserConfig` state-io.ts:377-383 at update-swap.ts:976; features/plugin/reinstall.feature:187; tests update-swap.test.ts:831, :850. |
| 6 | A disabled refresh treats a change of declared options alone as a change | ✓ VERIFIED | `disabledPinProjection` includes `userConfig` (update-preflight.ts:815-830); test `D-PG10-15: a disabled update writes a change of the declared options alone, then writes nothing` (update-preflight.test.ts:1088) passed. |
| 7 | A disabled record keeps the field; a legacy record gains it only at a restage; a load rewrites nothing | ✓ VERIFIED | The field is pinned (above); the only load-time writer is the MCP move, which restages (mcp-migration.ts:614-621); no load path calls the producer otherwise. |

**10-08: hook option variables** (truth 1 folded into criterion 1)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | Every option with a default reaches both hook lanes through one builder; none without a default | ✓ VERIFIED | H/hook-env.ts:87-118 from `entry.options.values`; sync lane H/dispatch-exec.ts:233, async lane H/async-rewake/registry.ts:952. |
| 3 | Option variables after the path variables and before lane and session additions | ✓ VERIFIED | Spread order H/hook-env.ts:98-110. 9/9 hook-env cases passed. |
| 4 | Two case-variant keys give one variable; the later wins | ✓ VERIFIED | `Object.fromEntries` in declaration order (hook-env.ts:103-105); UC :308-310. |
| 5 | One reader `recordedOptionsOf` re-validates; an unparseable value reads as no options, is logged, never throws | PASSED (override) | Override 2 (D-PG10-25): it reads as declared options with no values. The one-reader, re-validate, log and no-throw clauses hold (state-io.ts:356-370). |
| 6 | A load builds hook options from the record, no manifest read | ✓ VERIFIED | H/event-router.ts:849. |
| 7 | After reinstall and a new session, hooks get the new default | ✓ VERIFIED | process.feature:179. |
| 8 | A legacy record gets no option variable until a restage; a load rewrites nothing | ✓ VERIFIED | `recordedOptionsOf` gives `resolveOptions(undefined)` for no field (state-io.ts:359-361); test `D-PG10-15: reads a record with no stored options as a plugin that declares none` (state-io.test.ts:845) passed. |

**10-09: skill content**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | `${user_config.KEY}` written at staging at install, update, reinstall and enable | ✓ VERIFIED | skills/stage.ts:389; options passed from install-outcome.ts:1283, update-swap.ts:406, enable via the install ledger; skill/options.feature:7, :77. |
| 2 | A sensitive reference becomes the fixed placeholder | ✓ VERIFIED | vars.ts:96-99; skill/options.feature:7. |
| 3 | A reference with no value stays as written | ✓ VERIFIED | vars.ts:101. |
| 4 | No declared `userConfig`: references stay | ✓ VERIFIED | vars.ts:117-119; `declaredOptions` UC :292-294; skill/options.feature:51. |
| 5 | One pass with the path variables; spliced text not filled again | ✓ VERIFIED | `CLAUDE_CONTENT_PATTERN` vars.ts:53-56, single `replaceAll` :121-125; 22/22 vars cases passed. |
| 6 | Description filled by the same rule | ✓ VERIFIED | skills/stage.ts:117-134. |
| 7 | Invocation-time pass leaves `${user_config.KEY}` alone | ✓ VERIFIED | E/domain/argument-substitution.ts:18 and its variable list :42 hold no option reference. |
| 8 | Staging input takes the options as a required member | ✓ VERIFIED | E/bridges/skills/types.ts:66 (`options: ClaudeContentOptions \| undefined`, not optional). |
| 9 | `substituteClaudeVars` gives the hooks bridge the same bytes | ✓ VERIFIED | vars.ts:84-92 unchanged; spawn-helpers.ts:74 is its only hooks caller. |

**10-10: owned option variables**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | One variable per option of the MCP value map, owned name, split-token escaped value | ✓ VERIFIED | plugin-options.ts:64-81; `ownedOptionVariables` M/adapter-escape.ts:141-148 with `serializeLiteral` :124. |
| 2 | Ledger lists each owned name with scope; repeated apply changes nothing | ✓ VERIFIED | session-env.ts:206, :259-275 (pure, deterministic). 43/43 session-env cases passed. |
| 3 | User scope set in the awaited factory | ✓ VERIFIED | index.ts:108-110. |
| 4 | Project scope only when trusted; otherwise not read and removed | ✓ VERIFIED | plugin-options.ts:113-119; options.feature:183. |
| 5 | Trust read no more often than before | ✓ VERIFIED | index.ts:256 takes the constant from :197. |
| 6 | Stale names removed at the next apply; re-applied after every command with the last load's cwd and trust | ✓ VERIFIED | `fresh` removes prior names (session-env.ts:291-296); after-command apply index.ts:369-376 and `applyAgain` plugin-options.ts:128-130; options.feature:226. |
| 7 | An unreadable scope keeps its names; the other applies; nothing throws (NFR-2) | ✓ VERIFIED | plugin-options.ts:85-98 (`keep`); `applyOptionVariablesWith` catches (index.ts:77-83). |
| 8 | A tampered ledger entry is ignored | ✓ VERIFIED | `OPTION_LEDGER_ENTRY` and prefix filter (session-env.ts:210, :238-245). |
| 9 | Bash sees a trusted project plugin's variable; untrusted only the user one | ✓ VERIFIED | options.feature:150, :183. |
| 10 | Same key in two plugins gives two names, each its own value | ✓ VERIFIED | Address includes plugin (UC :313-317); plugin-options owner cases (8/8) passed. |

**10-11: exec-form fill and shell-form refusal**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in `command` and each string arg on both lanes, after the path variables | ✓ VERIFIED | spawn-helpers.ts:72-79; async lane registry.ts:380; process.feature:30. |
| 2 | Adjacent references each filled; a value holding `${user_config.x}` is not refilled within the option pass | ✓ VERIFIED | `replaceUserConfigReferences` single pass (UC :300-305); spawn-helpers cases (31/31) passed. |
| 3 | An unset option fails the run with Claude Code's text | ✓ VERIFIED | `UnsetPluginOptionError` E/shared/errors-bridges.ts:325-335; spawn-helpers.ts:100-108. |
| 4 | Holds also for a plugin with no `userConfig` | ✓ VERIFIED | failures.feature:184 (no manifest options; message shown). |
| 5 | A shell-form command naming `${user_config.` is refused with Claude Code's text | ✓ VERIFIED | spawn-helpers.ts:81-83; errors-bridges.ts:343-357; failures.feature:211. |
| 6 | A failed or refused hook follows the start-failure path (block with `onFailure: "block"`, else a notice) | ✓ VERIFIED | dispatch-exec.ts:236-250 (`startFailed: true`, `onFailureBlock`). |
| 7 | Hooks with no reference start as before | ✓ VERIFIED | spawn-helpers.ts:85-88; Gate G hook suites. |

**10-12 to 10-15: servers left out and the built-in skip**

| Plan | # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- | --- |
| 10-12 | 1 | A server naming an option with no value in any of the five fields is left out of the file and the record; others staged | ✓ VERIFIED | Partition M/stage.ts:285 before keying; options.feature:15. |
| 10-12 | 2 | One warning names plugin, server and keys only | ✓ VERIFIED | M/stage.ts:296-305; notification-mcp.ts:44. |
| 10-12 | 3 | No value means required no-default or undeclared; optional no-default blocks nothing | ✓ VERIFIED | `unsetOptionKeys` over `mcpValues` (claude-mcp-variables.ts:471-488). |
| 10-12 | 4 | No declared `userConfig`: reference kept | ✓ VERIFIED | claude-mcp-variables.ts:458-460; options.feature:68. |
| 10-12 | 5 | One domain verdict | ✓ VERIFIED | `mcpOptionBlock` :453-469, used by M/stage.ts:285, M/builtin-entry.ts:65, builtin-registration-step.ts:182. |
| 10-12 | 6 | Holds at install, enable, import, cascade | ✓ VERIFIED | All stage through the install ledger's MCP phase (install-outcome.ts:1495). |
| 10-12 | 7 | Notice kind in every home | ✓ VERIFIED | notification-types.ts:1447, notification-mcp.ts:44/:156, notification-wire.ts:784, notification-resolve.ts:767/:845, notification-json.ts:284, notification-dispatch.ts:392, docs/output-catalog.md:5406-5420, docs/json-output.md:958. |
| 10-13 | 1 | Update and reinstall leave out and report the same | ✓ VERIFIED | update-swap.ts:406; features/mcp-server/lifecycle.feature:763. |
| 10-13 | 2 | The load-time MCP move does the same | ✓ VERIFIED | mcp-migration.ts:479. |
| 10-13 | 3 | So the rule holds at every staging | ✓ VERIFIED | The sites above. |
| 10-13 | 4 | A new version with no `userConfig` keeps the reference at update | ✓ VERIFIED | `declaredOptions(resolveOptions(...))` at update-swap.ts:406. |
| 10-13 | 5 | Unstaged plugin's blocked-server notices are dropped | ✓ VERIFIED | E/orchestrators/marketplace/shared.ts:495, :515. |
| 10-14 | 1 | Built-in: a server naming an unset option is not registered; others are | ✓ VERIFIED | builtin-entry.ts:65; builtin-options.feature:14. |
| 10-14 | 2 | No notice; debug log with server and keys | ✓ VERIFIED | `skipCause` builtin-registration-step.ts:179-186. |
| 10-14 | 3 | The 10-12 verdict decides it | ✓ VERIFIED | As 10-12 truth 5. |
| 10-14 | 4 | Options via `recordedOptionsOf`, no manifest read at session start | ✓ VERIFIED | builtin-registration-step.ts:257-264. |
| 10-14 | 5 | No `userConfig`, or a legacy record: reference kept and registered | ✓ VERIFIED | `declaredOptions` gives `undefined` (UC :292-294, state-io.ts:359-361); builtin-options.feature:61. |
| 10-14 | 6 | Both encoders' substitution context takes options as required | ✓ VERIFIED | M/substitute.ts:89; M/types.ts:52. |
| 10-15 | 1 | A stdio `command`/args element starting with a home-path option is left out (D-PG10-11) | ✓ VERIFIED | `homePathOptionKeys` claude-mcp-variables.ts:491-519; options.feature:114, :167. |
| 10-15 | 2 | The notice carries a reason of its own and keys only | ✓ VERIFIED | notification-types.ts:1434-1438 (`unset \| home-path`); catalog state `mcp-option-blocked-home-path` (output-catalog.md:5416). |
| 10-15 | 3 | Mid-argument, env, url, headers block nothing | ✓ VERIFIED | `LEADING_OPTION_REFERENCE` anchors at the start of `homeExpanded` (command and args only, :329, :382). |
| 10-15 | 4 | An unset option wins: one notice, reason `unset` | ✓ VERIFIED | claude-mcp-variables.ts:462-468. |
| 10-15 | 5 | In the one verdict; also under the built-in MCP | ✓ VERIFIED | builtin-options.feature:97. |
| 10-15 | 6 | The block lands before any fill | ✓ VERIFIED | The verdict runs before staging (M/stage.ts:285) and before the built-in config (builtin-entry.ts:65). |

**10-16: hooks in the session that ran the command**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Hooks get option variables in the installing session, no `/reload` | ✓ VERIFIED | process.feature:145. |
| 2 | Same after enable, update, reinstall; new defaults | ✓ VERIFIED | process.feature:223, :270; tests reinstall-flow.test.ts:4136, update-flow.test.ts:8136. |
| 3 | The producer takes options as a required input | ✓ VERIFIED | H/event-router.ts:239-240. |
| 4 | Each call site takes options from the resolution it takes the root from | ✓ VERIFIED | install-flow-results.ts:403-405, install-cascade.ts:1278-1280, enable-disable.ts:482-485 and :1063-1065, update-swap.ts:1036-1040. |
| 5 | Options ride only on hydration values | ✓ VERIFIED | `materialized`/`hydratable` only; notification-json.ts and notification-wire.ts carry no option field. |

**10-17: adapter references**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in the five fields; the server receives the default | ✓ VERIFIED | options.feature:276, :298, :333 (real servers). |
| 2 | Entry holds the owned reference, never a fallback with the value | ✓ VERIFIED | `optionSegment` gives `{ kind: "ref", name }` with no fallback (claude-mcp-variables.ts:224-232); options.feature:220. |
| 3 | Optional no-default is `""` | ✓ VERIFIED | UC :280; claude-mcp-variables owner cases (108/108) passed. |
| 4 | Same plugin, scope, option give the same reference; marker unchanged | ✓ VERIFIED | Name from `ownedOptionVariables` (M/stage.ts:517-531). |
| 5 | Not reported missing, not deny-listed, not rescanned | ✓ VERIFIED | claude-mcp-variables.ts:235-241 (an option segment never goes through `segmentFor`). |
| 6 | The stage reads option variables in its environment (caFile origin, auth) | ✓ VERIFIED | M/stage.ts:527 (env overlay). |
| 7 | A `!` default in env/headers runs no command | ✓ VERIFIED | Conformance cases `an env value given whole as an option that starts with !` and the header twin passed here. |
| 8 | No `userConfig`: reference kept | ✓ VERIFIED | options.feature:68. |
| 9 | Built-in config unchanged in this plan | ✓ VERIFIED | The built-in fill came later in 10-19 (`optionForm: { kind: "text" }`, builtin-escape.ts:54). |

**10-18: command and agent content**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Written at staging in command and agent content | ✓ VERIFIED | E/bridges/commands/staged-command.ts:278-288; E/bridges/agents/convert.ts:1058-1066; slash-command/options.feature:7, agent/options.feature:7. |
| 2 | Sensitive placeholder, no sensitive value | ✓ VERIFIED | vars.ts:96-99; both scenarios. |
| 3 | No value: stays | ✓ VERIFIED | vars.ts:101. |
| 4 | No `userConfig`: stays | ✓ VERIFIED | vars.ts:117-119. |
| 5 | A preloaded skill follows the same rule | ✓ VERIFIED | E/bridges/agents/skill-preload.ts:93. |
| 6 | The grant-form swap leaves a filled body | ✓ VERIFIED | E/bridges/agents/grant-rewrite.ts:302-303 (frontmatter replaced, body kept). |
| 7 | No workflow fill; invocation pass leaves options alone | ✓ VERIFIED | No `substituteClaudeContent` caller under `bridges/workflows/`; argument-substitution.ts:18, :42. |
| 8 | Commands and agents inputs take options as required | ✓ VERIFIED | E/bridges/commands/types.ts:99; E/bridges/agents/types.ts:142. |

**10-19: built-in fill**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in the five fields under the built-in MCP | ✓ VERIFIED | options.feature:381, :420; builtin-options.feature:74. |
| 2 | In memory only | ✓ VERIFIED | builtin-registration-step.ts:257-264. |
| 3 | Optional no-default is `""` | ✓ VERIFIED | `text` form reads `mcpValues` (claude-mcp-variables.ts:230-231). |
| 4 | A `!` default in env/headers runs no command | ✓ VERIFIED | `escapedForPi` on secret fields (builtin-escape.ts:47-55); 14/14 builtin-escape cases passed. |
| 5 | Options read at each session | ✓ VERIFIED | builtin-registration-step.ts:264. |
| 6 | A home-path option at the start of command/args is not registered | ✓ VERIFIED | builtin-options.feature:97. |
| 7 | No `userConfig` or a legacy record: kept | ✓ VERIFIED | builtin-options.feature:61. |
| 8 | Field scenarios with the same result run under both profiles | ✓ VERIFIED | options.feature:14, :67, :113, :166 and :275 are `@mcp`; the five-field pairs whose observed result differs split by profile (`@adapter-only` :219, :297, :332; `@builtin-only` :380, :419). |

**10-20: records**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | D-PG10-01 row: confirmed gap, premise, Pi 1.5.0 and 1.5.2, A taken, B with costs, security flag, residual, Pending | ✓ VERIFIED | PROJECT.md:2432. |
| 2 | D-LOC-01 names `PATH` and says "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)" | ✓ VERIFIED | PROJECT.md:2150. |
| 3 | Seven D-PG10 rows each with premise, versions checked, alternative, Pending; -16 amends SUB-02, -04 amends USRCFG-01 | ⚠ ADVISORY (version clause not met for three rows) | PROJECT.md:2433-2439: all seven are Pending maintainer review and name an alternative; -16's title says `amends SUB-02` (:2436), -04 says `amends BACKLOG USRCFG-01` (:2433). D-PG10-16, -23 and -24 name no version. Advisory 1. Not counted as verified. |
| 4 | D-PG10-19 says the hook and content default is more than Claude Code 2.1.323 does, states the question, no record calls it parity | ✓ VERIFIED | PROJECT.md:2437 ("Maintainer question: ...", "No record calls it parity."). |
| 5 | PENV-01 corrected with D-PG10-03; Validated bullet marked; D-CF5-15 "Amended by D-PG10-10" | ✓ VERIFIED | PROJECT.md:745, :1707, :2203. |
| 6 | Upstream draft in the house shape, not filed | ✓ VERIFIED | `.planning/upstream/pi-extension-trust-paths.md:1-5`. |
| 7 | PITRUSTPATHS-01 trigger and draft path; USRCFG-01 step 1 shipped, steps 2 and 3 behind decision 30, custody correction, step-2 prerequisites; bin-on-PATH gap marked covered | ✓ VERIFIED | BACKLOG.md:5478-5480, :1389-1397, :4873. |
| 8 | CHANGELOG lines under `[Unreleased]`, including the one-time reinstall; no version file changes | ✓ VERIFIED | CHANGELOG.md:3, :43-48; package.json version 0.23.0, unchanged by 10-20 (10-20-SUMMARY.md:50, `git diff 711af3f5 HEAD -- package.json sonar-project.properties` empty). |

**10-21: documentation**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | env-vars.md: `bin` only when it exists at the load, project only when trusted, metacharacter and `stat` rules | ✓ VERIFIED | docs/env-vars.md:61, :181, :183. |
| 2 | env-vars.md: user-scope project directory at invocation, model read and `run_plugin_command`; agent body kept; the stale reason gone | ✓ VERIFIED | docs/env-vars.md:39, :80, :95, :108; no "written once at install" text remains. |
| 3 | Option variables delivered; the two pi-only names documented | ✓ VERIFIED | docs/env-vars.md:29-34, :62-64, :125-127, :187-196. |
| 4 | Each page says the hook and content default is more than Claude Code; none calls it parity | ✓ VERIFIED | docs/env-vars.md:250, docs/hooks-compatibility.md:374. |
| 5 | hooks-compatibility.md: exec fill, unset failure, shell refusal, status row | ✓ VERIFIED | docs/hooks-compatibility.md:366-374, :523, :531. |
| 6 | mcp-compatibility.md plugin options section | ✓ VERIFIED | docs/mcp-compatibility.md:607-631. |
| 7 | No page says the trust gap is closed | ✓ VERIFIED | The PATH gate text says "When Pi's answer is 'not trusted'" (docs/env-vars.md:183, :196). |
| 8 | Statements sourced; unbacked claims marked unmeasured | ✓ VERIFIED | E.g. docs/mcp-compatibility.md:617 (the caFile and OAuth rule is proven by owner unit cases and no scenario), :621. |

**Score:** 156/157 (154 VERIFIED, 2 PASSED (override)); 1 plan clause carried as advisory; 0 present, behavior-unverified.

### Prohibitions (judgment tier, flagged)

All 19 are `verification: judgment`; none is test-tier. These verdicts are non-authoritative LLM judgments: **unverified-prohibition — human review recommended**.

| Plan | Prohibition | Non-authoritative verdict and evidence |
| --- | --- | --- |
| 10-02, 10-08, 10-09, 10-18 | MUST NOT call the hook or content default parity in a comment or test or scenario title (D-PG10-19) | Holds. A case-insensitive search for `parity` next to option, default or `userConfig` over `extensions test features` finds no such line; the one hit, unsupported-components.ts:40, is about installing without `--partial`. UC :71-75 says the default is "this project's rule under D-PG10-19". |
| 10-04 | MUST NOT read the project `state.json` for PATH when trust is false | Holds. plugin-path.ts:156-161. |
| 10-04 | MUST NOT describe the gate as closing the trust gap | Holds. plugin-path.ts:11-13; executables.feature titles. |
| 10-07 | MUST NOT store a user-typed value on the record | Holds. `userConfigFieldsOf` copies the declared schema only (state-io.ts:331-344). |
| 10-09, 10-18 | MUST NOT write a sensitive value into staged content, a preloaded skill included | Holds. vars.ts:97-99 checks `sensitive` before the value, for every content caller (skills, commands, agents, skill-preload). |
| 10-10 | MUST NOT read an untrusted project's state for options, or leave its variables set | Holds. plugin-options.ts:115-117. |
| 10-10 | MUST NOT export a value without the split-token escape | Holds. `serializeLiteral(value, false)` (adapter-escape.ts:148). |
| 10-16 | MUST NOT render an option value in a result row or JSON payload | Holds. See 10-16 truth 5. |
| 10-17 | MUST NOT write a resolved value into `mcp-adapter.json`, a fallback, or the marker | Holds. options.feature:220; claude-mcp-variables.ts:224-232. |
| 10-19 | MUST NOT write an option value to a file on the built-in path | Holds. builtin-registration-step.ts:257-264. |
| 10-20 | MUST NOT record any D-PG10 row as locked or as the maintainer's decision | Holds. PROJECT.md:2432-2440 all end `Pending maintainer review`. |
| 10-20 | MUST NOT describe the trust gap as closed or mitigated | Holds. CHANGELOG.md:48 limits the change to "a project that Pi trusts"; PROJECT.md:2432 keeps the residual. |
| 10-20 | MUST NOT call the hook and content default parity in a record or the CHANGELOG | Holds. PROJECT.md:2437; CHANGELOG.md:43 does not use the word. |
| 10-21 | MUST NOT call it parity in any documentation page | Holds. docs/env-vars.md:250 and docs/hooks-compatibility.md:374 say "It is not parity". |
| 10-21 | MUST NOT say an untrusted repository's plugins cannot run | Holds. docs/env-vars.md:183, :196 limit the gate to Pi's "not trusted" answer. |

## Required Artifacts

`query verify.artifacts`: full counts for 20 plans; 10-02 2/3 (advisory 2). Key artifacts re-read: UC (317 lines), `orchestrators/plugin-path.ts` (181), `orchestrators/plugin-options.ts` (132), `persistence/state-io.ts` (`userConfigFieldsOf`, `recordedOptionsOf`, `replaceUserConfig`), H/spawn-helpers.ts, H/hook-env.ts, `shared/vars.ts`, `domain/claude-mcp-variables.ts`, M/stage.ts, M/builtin-entry.ts, M/builtin-escape.ts, `shared/session-env.ts`, the feature files listed above, and the planning records. None is a stub.

## Key Link Verification

`query verify.key-links`: 44/44 across the 21 plans. Manual trace of the trust wiring: `ctx.isProjectTrusted()` (index.ts:197) -> hooks hydrate (:199), `loadReconcile` (:210), MCP server refresh (:226), `recomputePluginPath` (:242), option apply (:256). Option data: manifest -> `resolveUserConfig` (plugin-resolver.ts:739) -> `declaredUserConfig` -> record (`userConfigFieldsOf`, install-outcome.ts:1682) -> `recordedOptionsOf` -> hooks (event-router.ts:849), owned variables (plugin-options.ts:74) and the built-in registration (builtin-registration-step.ts:264).

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| --- | --- | --- | --- | --- |
| Hook env | `CLAUDE_PLUGIN_OPTION_*` | manifest `userConfig` -> record -> `recordedOptionsOf` | Yes, recorded by a real hook process (process.feature:110) | ✓ FLOWING |
| MCP fields | references or `mcpValues` text | the same, through the owned variable or the in-memory built-in config | Yes, real stub and http servers receive the values | ✓ FLOWING |
| `PATH` | `freshBinDirs` | each trusted scope's `state.json` -> `stat` | Yes, the bash tool runs `hello` | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each reported `fail 0`.

| Check | File (pattern) | Result |
| --- | --- | --- |
| Owner suites | user-config (56), plugin-path (29), spawn-helpers (31), plugin-options (8), vars (22), claude-mcp-variables (108), hook-env (9), session-env (43), builtin-escape (14), builtin-entry (19), command-invocation (51), skill-invocation (59), adapter-escape (71), probe-classifiers (53) | PASS (573/573) |
| A1 and field conformance | test/integration/adapter-expansion-conformance.test.ts (`^D-PG10-`) | PASS (16/16) |
| Record reader | test/persistence/state-io.test.ts (`^D-PG10-`) | PASS (13/13) |
| Resolver arms | test/domain/plugin-resolver.test.ts (`^D-PG10-0[45]`) | PASS (12/12) |
| Cross-surface reason | test/architecture/cross-surface-reason-parity.test.ts (`options not set\|userConfig`) | PASS (5/5) |
| Disabled refresh | test/orchestrators/plugin/update-preflight.test.ts (`^D-PG10-15`) | PASS (2/2) |
| Gate G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` exists. The 10-01 stop-gate run was a recorded, uncommitted measurement, and its record is the evidence.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-CORE-03 | 10-02, 10-05 to 10-19 | ✓ SATISFIED (the hook and content defaults rest on D-PG10-19, confirmed by the maintainer review 2026-11-16) | Criteria 1, 2. REQUIREMENTS.md:66 `[x]`, :204 Complete |
| PG-CORE-05 | 10-03, 10-21 | ✓ SATISFIED (D-PG10-16, confirmed by the maintainer review 2026-11-16) | Criterion 3. REQUIREMENTS.md:67 `[x]`, :205 Complete |
| PG-CORE-06 | 10-01, 10-04, 10-21 | ✓ SATISFIED | Criterion 4. REQUIREMENTS.md:68 `[x]`, :206 Complete |
| PG-CORE-07 | 10-01, 10-04, 10-21 | ✓ SATISFIED | Criterion 4. REQUIREMENTS.md:69 `[x]`, :207 Complete |
| PG-SEC-02 | 10-20 | ? NEEDS MAINTAINER (record done, Truth 5; decision pending, Truth 6) | REQUIREMENTS.md:81 `[ ]`, :213 Pending |

No orphaned requirement: REQUIREMENTS.md maps exactly these five IDs to Phase 10, and each appears in plan frontmatter.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| The 112 covered non-planning files | TBD / FIXME / XXX / TODO / HACK | None | No match |
| The phase feature files | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- No scenario checks `list` or `info` for a plugin whose options all have a default, or for a malformed `userConfig`. Those surfaces rest on the resolver and classifier unit cases cited under 10-05.
- `shared/errors-bridges.ts:329` tells the user to open `/plugin manage`, which Pi has no command for (review IN-04). It is Claude Code's text, kept verbatim under D-PG10-04/-08; a maintainer question (Maintainer Review 4).
- Under pi-mcp-adapter, an unparseable stored `userConfig` still starts a stdio server whose reference names an unset variable, with an empty value (D-PG10-25 residual, review IN-09).
- The previous report's Info about `10-VALIDATION.md` (`nyquist_compliant: false` against a ticked sign-off) is resolved: the frontmatter now says `true` (10-VALIDATION.md:7, commit ce5030b5).
- The previous report cited H/hook-env.ts:99, event-router.ts:696, index.ts:181/:217/:231, PROJECT.md:2402, failures.feature:177 and frontmatter.feature:72. Later additions moved them to the lines above; the content is the same.

## Human Verification Required

None. The judgment-tier prohibitions are flagged above and listed under Maintainer Review, following the Phase 1 re-verification (660e6da6). The remaining items are maintainer decisions, not tests.

## Maintainer Review

These items wait for the maintainer. None is a gap:

1. **PG-SEC-02 / D-PG10-01** (PROJECT.md:2432; 10-CONTEXT.md decision 23): confirm option A (keep the D-LOC-01 trust gap, every project effect gated on `ctx.isProjectTrusted()` alone) or reopen it with option B (an extension-kept consent record, which needs a new requirement). Override 1 depends on it.
2. **D-PG10-19** (PROJECT.md:2437): keep the declared default on hooks and on skill, command and agent content, or follow Claude Code 2.1.323 exactly (defaults on MCP config only). Criteria 1 and 2 hold only through this divergence; strict parity would require amending them.
3. **D-PG10-16** (PROJECT.md:2436, amends SUB-02): the project directory for user-scope skills and commands.
4. **D-PG10-04** (PROJECT.md:2433, amends USRCFG-01), including the `/plugin manage` text Pi has no command for; **D-PG10-06** (:2434, a required option with no default is partial, not parity); **D-PG10-11** (:2435, option values reach pi-mcp-adapter and every Pi child, bash included, through process variables); **D-PG10-23** (:2438, project option variables wait for the trust answer; residual start-up race); **D-PG10-24** (:2439, reinstall, not apply, refreshes an old partial install).
5. **D-PG10-25** (PROJECT.md:2440): an unreadable stored `userConfig` fails closed as declared options with no values. Override 2 depends on it.
6. **Advisory 1**: add the checked-against versions to the D-PG10-16, -23 and -24 rows, or say that none applies, or convert the advisory to a gap.
7. **Nineteen flagged judgment-tier prohibitions** (see Prohibitions): the verifier's non-authoritative verdict is that all hold. Human review recommended.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria of Phase 10 hold, and every scenario that exercises them passed in Gate G on code identical to HEAD. Later work touched the phase's files additively: the Phase 6 hook MCP-server refresh, which takes the same trust constant, the Phase 7 agent frontmatter work, which leaves the content fill in place, and the Phase 11 command name and file-mention work, which leaves the project directory fill and the trust gates in place.

Checking the 151 plan truths one by one found two clauses that do not hold as written. Neither is a regression. 10-08 truth 5's "reads as no options" was changed in the phase by D-PG10-25, which is recorded, so it passes by a new override. 10-20 truth 3 asks that seven decision rows name the versions they were checked against, and three of them never did. No decision covers that, so it is carried as a records-only advisory and is not counted as verified. The score moves from 6/6 to 156/157 because this pass counts every plan truth. The PG-SEC-02 override stays until the maintainer answers D-PG10-01.

---

_Verified: 2026-11-16T08:00:34Z_
_Verifier: Claude (gsd-verifier)_
