---
phase: 10-plugin-options-variables-and-trust
verified: 2026-11-17T02:27:20Z
status: passed
score: "157/157 must-haves verified (156 VERIFIED, 1 PASSED (override)); 19 judgment-tier prohibitions flagged"
covered_files: [".planning/phases/10-plugin-options-variables-and-trust/10-01-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-01-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-02-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-03-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-04-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-05-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-06-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-07-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-08-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-09-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-10-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-11-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-12-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-13-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-14-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-15-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-16-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-17-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-18-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-19-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-20-SUMMARY.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-PLAN.md",".planning/phases/10-plugin-options-variables-and-trust/10-21-SUMMARY.md","CHANGELOG.md","docs/env-vars.md","docs/hooks-compatibility.md","docs/json-output.md","docs/mcp-compatibility.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts","extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts","extensions/pi-claude-marketplace/bridges/agents/stage.ts","extensions/pi-claude-marketplace/bridges/agents/types.ts","extensions/pi-claude-marketplace/bridges/commands/stage.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/commands/types.ts","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts","extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts","extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts","extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts","extensions/pi-claude-marketplace/bridges/mcp/index.ts","extensions/pi-claude-marketplace/bridges/mcp/marker.ts","extensions/pi-claude-marketplace/bridges/mcp/option-withhold.ts","extensions/pi-claude-marketplace/bridges/mcp/stage.ts","extensions/pi-claude-marketplace/bridges/mcp/substitute.ts","extensions/pi-claude-marketplace/bridges/mcp/types.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/bridges/skills/types.ts","extensions/pi-claude-marketplace/domain/argument-substitution.ts","extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts","extensions/pi-claude-marketplace/domain/components/plugin.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/unsupported-components.ts","extensions/pi-claude-marketplace/domain/user-config.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/command-invocation.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts","extensions/pi-claude-marketplace/orchestrators/plugin-options.ts","extensions/pi-claude-marketplace/orchestrators/plugin-path.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts","extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts","extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/option-withhold.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts","extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts","extensions/pi-claude-marketplace/persistence/state-io.ts","extensions/pi-claude-marketplace/shared/completion-cache.ts","extensions/pi-claude-marketplace/shared/errors-bridges.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-mcp.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-types.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","extensions/pi-claude-marketplace/shared/notify-reasons.ts","extensions/pi-claude-marketplace/shared/probe-classifiers.ts","extensions/pi-claude-marketplace/shared/session-env.ts","extensions/pi-claude-marketplace/shared/vars.ts","features/agent/frontmatter.feature","features/agent/options.feature","features/hook/failures.feature","features/hook/process.feature","features/lib/hook-recorder.ts","features/mcp-server/builtin-options.feature","features/mcp-server/legacy-move.feature","features/mcp-server/lifecycle.feature","features/mcp-server/options.feature","features/plugin/executables.feature","features/plugin/install.feature","features/plugin/options.feature","features/plugin/project-trust.feature","features/plugin/reinstall.feature","features/skill/invocation.feature","features/skill/model-reads.feature","features/skill/options.feature","features/slash-command/invocation.feature","features/slash-command/model-runs.feature","features/slash-command/options.feature","features/step_definitions/mcp-server/builtin-options.steps.ts","features/step_definitions/mcp-server/options.steps.ts","features/step_definitions/model.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/plugin/publishing.steps.ts","features/support/world.ts","test/architecture/cross-surface-reason-parity.test.ts","test/bridges/hooks/hook-env.test.ts","test/bridges/hooks/spawn-helpers.test.ts","test/bridges/mcp/adapter-entry.test.ts","test/bridges/mcp/adapter-escape.test.ts","test/bridges/mcp/builtin-entry.test.ts","test/bridges/mcp/builtin-escape.test.ts","test/bridges/mcp/marker.test.ts","test/bridges/mcp/option-withhold.test.ts","test/domain/claude-mcp-variables.test.ts","test/domain/plugin-resolver.test.ts","test/domain/user-config.test.ts","test/integration/adapter-expansion-conformance.test.ts","test/orchestrators/command-invocation.test.ts","test/orchestrators/plugin-options.test.ts","test/orchestrators/plugin-path.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/list-installed-row.test.ts","test/orchestrators/reconcile/delisted-plugins.test.ts","test/orchestrators/reconcile/option-withhold.test.ts","test/orchestrators/skill-invocation.test.ts","test/persistence/state-io.test.ts","test/shared/errors-bridges.test.ts","test/shared/probe-classifiers.test.ts","test/shared/session-env.test.ts","test/shared/vars.test.ts"]
covered_digest: "v4:sha256:0e3865c3f7d14ccd67729cb8cd63900276ff2eb67c76b8bad78c1cf8d0c2ffdb"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Every reader of a record's userConfig goes through one function, recordedOptionsOf, which validates the stored value again with the manifest parser. A stored value that does not parse reads as no options and is debug-logged; it never throws past a load (10-08 truth 5)"
    reason: "Recorded decision D-PG10-25 (PROJECT.md:2441), as the maintainer review of 2026-11-16 decided it (fail closed, amends APL-D1), changes two clauses. (1) 'reads as no options': an unparseable stored userConfig now reads as declared options with no values, marked unreadable, `{ ...resolveOptions({}), unreadable: true }` (persistence/state-io.ts:378-382), so every option-dependent part refuses it: Pi's built-in MCP skips each server that names an option, no option variable is set, and an exec-form hook that names an option fails with UnreadablePluginOptionsError (bridges/hooks/spawn-helpers.ts:101-113). (2) 'one function': the surfaces that D-PG10-25 adds (the load warning, list, info, and the pi-mcp-adapter hold-back) read only whether the stored value parses, through a second reader, unreadableUserConfigOf (state-io.ts:351-361), which uses the same parser; option values still come only from recordedOptionsOf (callers bridges/hooks/event-router.ts:849, orchestrators/plugin-options.ts:74, orchestrators/mcp/builtin-registration-step.ts:264). The re-validate, debug-log (:380) and no-throw clauses hold as planned. Pinned by `D-PG10-25: reads ... as unreadable options with no values and logs it` (test/persistence/state-io.test.ts:866) and the D-PG10-25 scenarios listed in this report; state-io.test.ts passed here (96/96)."
    accepted_by: "maintainer review 2026-11-16"
    accepted_at: "2026-11-16T14:37:07Z"
re_verification:
  previous_status: passed
  previous_score: "156/157 (154 VERIFIED, 2 PASSED (override)); 1 plan clause carried as advisory"
  previous_verified: 2026-11-16T08:00:34Z
  reason: "staleness and the maintainer review of 2026-11-16. init.manager reported phase 10 stale: 6d9a3cdd (D-PG10-25 fail closed) and 78011db4 (the unreadable-options step moved to the shared installation steps) changed 21 of the previous report's covered non-planning files. 6826f6f6 recorded the decision (PROJECT.md D-PG10-25 row and APL-D1 amendment, compatibility docs, CHANGELOG). 0401bac2 locked every pending D-PG10 row as confirmed, D-PG10-01 with option A, and marked PG-SEC-02 complete; 567585d3 recorded the maintainer review as the acceptance of each verification override. The Phase 11 work changed features/slash-command/invocation.feature (mention rows only) and a comment in orchestrators/marketplace/shared.ts; neither touches a phase 10 path."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  overrides_removed:
    - "PG-SEC-02 (requirement text): the maintainer confirms or reopens the accepted trust gap. Now verified directly: the D-PG10-01 row reads '-- Locked (maintainer review 2026-11-16, confirmed, option A; the Pi request stays a draft)' (PROJECT.md:2433, commit 0401bac2), and REQUIREMENTS.md marks PG-SEC-02 `[x]` (:81) and Complete (:213)."
  overrides_kept:
    - "10-08 truth 5 (D-PG10-25), with its reason re-based on the fail-closed behavior and its second reader, accepted_by 'maintainer review 2026-11-16'"
  advisories_resolved:
    - "10-20 truth 3, three decision rows without versions: the D-PG10-16, -23 and -24 rows now name them (PROJECT.md:2437 Claude Code 2.1.323 and Pi 1.5.0, core.md U4.4 read in 2.1.322; :2439 Pi 1.5.0 and pi-mcp-adapter 7.0.1; :2440 Pi 1.5.0 and Claude Code 2.1.323). Truth 3 now counts as verified."
  superseded_by_maintainer:
    - "10-20 truths 1 and 3 and the first 10-20 prohibition require the outcome `Pending maintainer review` and forbid recording a D-PG10 row as locked. They held for the autonomous run, which left each row pending. The maintainer has since locked every D-PG10 row (0401bac2, 6826f6f6), which is the step those clauses left to the maintainer; it is recorded here, not counted as a failure."
advisory:
  - finding: "The 10-02 artifact probe `contains: PI_CLAUDE_MARKETPLACE_OPTION_` for test/integration/adapter-expansion-conformance.test.ts fails (`query verify.artifacts` 2/3, exit 1). The file never held the literal: the A1 case builds the name with ownedOptionVariableName."
    category: other
    reason: "A plan artifact probe, not a must-have truth. The A1 truth holds through the conformance cases in Gate G and `OWNED_VARIABLE_PREFIX uses the exact prefix of every owned option variable (D-PG10-23)` (test/domain/user-config.test.ts). To resolve: drop or correct the probe pattern in a future plan; no code change is needed."
    evidence_status: "reproducible by `query verify.artifacts .planning/phases/10-plugin-options-variables-and-trust/10-02-PLAN.md`; no failing test"
  - finding: "Two documentation pages still call D-PG10-19 pending after the maintainer locked it: docs/env-vars.md:250 and docs/hooks-compatibility.md:376 read '(D-PG10-19, pending maintainer review)'. Planning records that say the same about phase 10 decisions: ROADMAP.md:497 (closeout says PG-SEC-02 stays Pending and D-PG10-25 is pending), 10-SECURITY.md:44, :62, :100 and :126 (AR-10-01 and AR-10-02)."
    category: other
    reason: "Stale decision status, not a must-have: 10-21 truth 4 (no page calls the default parity) still holds on both lines. This report may change only itself, so the lines are left for a follow-up docs commit. The per-phase planning artifacts (CONTEXT, RESEARCH, DISCUSSION-LOG, PLAN, SUMMARY, REVIEW-FIX) are dated history and are not stale."
    evidence_status: "reproducible: `grep -n 'D-PG10-19, pending maintainer review' docs/env-vars.md docs/hooks-compatibility.md` prints both lines"
prohibitions_flagged: 19
prohibition_review: "NON-AUTHORITATIVE; unverified-prohibition, human review recommended. The 19 judgment-tier prohibitions of plans 10-02, 10-04, 10-07 to 10-10, and 10-16 to 10-21 (none test-tier) were re-read against the current tree, including the D-PG10-25 code, and no violation was found. The 10-20 'MUST NOT record a D-PG10 row as locked' prohibition held for the autonomous run; the maintainer locked the rows afterwards (see Prohibitions). Following the sibling re-verifications, they are flagged here and not listed as manual tests."
human_verification: []
---

# Phase 10: Plugin Options, Variables, and Trust Verification Report

**Phase Goal:** A plugin's `userConfig` defaults reach its hooks, its MCP servers, and its content, so that a plugin whose options all have a default installs without `--partial`. A user-scope skill or command gets the project directory. A plugin's `bin` directory joins `PATH` only when it exists and, for a project-scope plugin, only when Pi trusts the project. The accepted project trust gap is confirmed or reopened.

**Verified:** 2026-11-17T02:27:20Z
**Status:** passed, with 19 flagged judgment-tier prohibitions and 2 records-only advisories. All five roadmap criteria hold on the current tree, and the maintainer step of PG-SEC-02 is now done and recorded, so it verifies without an override. Of the 151 separate plan truths, 150 hold, and 1 passes by the D-PG10-25 override (10-08 truth 5).
**Re-verification:** Yes. The previous report (passed, 156/157, two overrides) became stale when the D-PG10-25 fail-closed change and the step move changed its covered files.

## Verification Basis

This pass re-checked every roadmap criterion and plan must-have against `features/gaps` at `79f3c194`. Summaries were not taken as evidence, except for the 10-01 measurement, which is a recorded run and not code. The 91 covered non-planning files that did not change since the previous report's tree (`fb957770`) keep their citations, re-read in place. The 21 that changed were read again, and their citations below are current. **E/** means `extensions/pi-claude-marketplace/`, **H/** means `E/bridges/hooks/`, **M/** means `E/bridges/mcp/`, and **UC** means `E/domain/user-config.ts`.

What moved: UC gained the `unreadable` member of `ResolvedOptions` (:86-91), so every UC citation after it moved by six lines (`resolveOptions` :270-291, `declaredOptions` :298-300, `hookOptionVariableName` :314-316, `ownedOptionVariableName` :319-323). `index.ts` gained the user-scope hold-back (:113-115), so the trust read is :201 (was :197), the hydrate :203, the MCP server refresh :230, `recomputePluginPath` :246, the option apply :260, and the after-command apply :381. `planSpawn` is H/spawn-helpers.ts:70-90 and `fillPluginOptions` :101-113. `ShellFormOptionReferenceError` is E/shared/errors-bridges.ts:363-377. `features/plugin/options.feature` moved by two lines and `features/mcp-server/options.feature` by one (header text). The shell-form refusal scenario is `features/hook/failures.feature:257` (was :211, where the D-PG10-25 hook scenario now sits). The D-PG10 rows are PROJECT.md:2433-2441 (was :2432-2440). PITRUSTPATHS-01 is BACKLOG.md:5486.

**Gate G (reused, not re-run):** `npm run check` exited 0 at `333784b7` on Node v26.13.1 with a hermetic `PI_CODING_AGENT_DIR` (log `/tmp/pg-final.log`, read by the verifier). The seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). The unpaired and integration tests passed with pi-mcp-adapter 7.0.1, pi-subagents 0.88.1 and @quintinshaw/pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps (seed 478645), so every `@adapter-only` and `@mcp` scenario of the phase ran, the D-PG10-25 ones included. The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 413244), which includes `features/mcp-server/builtin-options.feature`. Direct coverage merged 376 LCOV records. The log ends with `exit=0`. `git diff --name-only 333784b7 HEAD` outside `.planning/` is empty, so Gate G covers every executable input of HEAD, and under the project's reuse rule the suite was not repeated.

**Independent checks (this pass):** 13 owner test files, each run alone with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad; all passed, 838 tests in total (see Behavioral Spot-Checks). `query verify.artifacts` gives the full count for 20 plans and 2/3 for 10-02 (advisory 1). `query verify.key-links` gives the full count for all 21 plans (44/44 links), each with exit 0.

## D-PG10-25 as the maintainer decided it (fail closed)

The maintainer review of 2026-11-16 reversed the autonomous D-PG10-25. A record whose stored `userConfig` does not parse now fails closed with `{unreadable}`, and the decision amends APL-D1 (PROJECT.md:1942, :2441). This section checks each surface the row names, because override 1 rests on it.

| Surface | Code | Scenario or test | Status |
| --- | --- | --- | --- |
| The reader marks the options unreadable | `recordedOptionsOf` returns `{ ...resolveOptions({}), unreadable: true }` and logs (E/persistence/state-io.ts:371-386); `unreadableUserConfigOf` gives the parse detail (:351-361); UC :86-91 | state-io.test.ts:866, :878, :887, :895 | ✓ |
| Each load warns `(failed) {unreadable}` with the reinstall remedy, one row per enabled plugin, after the delisted rows | `reportUnreadableOptions` (E/orchestrators/reconcile/delisted-plugins.ts:285-312), called last before the routing rebuild (E/orchestrators/reconcile/read-pass.ts:632) | features/plugin/options.feature:256; delisted-plugins.test.ts:521, :552, :574 | ✓ |
| `list` and `info` show `{unreadable}`, disabled rows included | `withUnreadableOptions` (E/orchestrators/plugin/list-installed-row.ts:217-232); `applyRecordRowShape` (E/orchestrators/plugin/info.ts:1813-1823) at :1495, :1599, :1704 | options.feature:280, :299; list-installed-row.test.ts:284, :312; info.test.ts:4029, :4059 | ✓ |
| Pi's built-in MCP registers no server that names an option, and registers the others | `declaredOptions(recordedOptionsOf(...))` (E/orchestrators/mcp/builtin-registration-step.ts:264) gives declared options with no values, so `mcpOptionBlock` skips the server | features/mcp-server/builtin-options.feature:37 | ✓ |
| No option variable is set | `recordedOptionsOf(record).mcpValues` is empty (E/orchestrators/plugin-options.ts:74) | plugin-options.test.ts (8/8) | ✓ |
| pi-mcp-adapter: the load sets `disabled: true` on each entry that names an option and keeps the user's own `disabled` in the marker (`withheld`); a readable record restores it | M/option-withhold.ts:113-128 (`nextEntry`), :149-178; E/orchestrators/reconcile/option-withhold.ts:54-79, under the scope's state lock with `persistMigration: false` (:76); run after the AMIG-01 move (read-pass.ts:442-445) | features/mcp-server/options.feature:469, :499; option-withhold.test.ts (16/16 and 8/8) | ✓ |
| The factory runs it for the user scope before any session event, leaves a commented file to the load, and does nothing in a pi-subagents child | `withholdUserOptionServersAtStartup` (reconcile/option-withhold.ts:85-101) at index.ts:115; `isSubagentChild` :89 | reconcile/option-withhold.test.ts:178, :190 | ✓ |
| An exec-form hook that names an option fails as unreadable; one that names none runs; shell form stays refused | H/spawn-helpers.ts:101-113 (`UnreadablePluginOptionsError`, E/shared/errors-bridges.ts:343-355) | features/hook/failures.feature:211; spawn-helpers.test.ts:168, :189 | ✓ |
| A reinstall repairs the record and the entries | A restage reads the user's `disabled` from the marker (`carrySource`, M/adapter-entry.ts:242-256) | options.feature:330; mcp-server/options.feature:561 | ✓ |
| Records and docs | APL-D1 amendment (PROJECT.md:1942); D-PG10-25 row (:2441); docs/mcp-compatibility.md:632-644; docs/hooks-compatibility.md:370; docs/env-vars.md:199; docs/output-catalog.md:4197; CHANGELOG.md:51 | read | ✓ |

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 10 must-haves |
| --- | --- | --- |
| D-PG10-25 (PROJECT.md:2441; reversed and locked by the maintainer review 2026-11-16, fail closed; amends APL-D1) | An unparseable stored `userConfig` reads as declared options with no values, marked unreadable; every surface that names an option refuses it, and the load holds back the pi-mcp-adapter entries (section above). | Override 1 (10-08 truth 5). 10-14 truth 5 and 10-19 truth 7 still hold: a record with no stored field reads as undeclared and keeps references as written (state-io.ts:374-376). 10-07 truth 7 and 10-08 truth 8 ("a load rewrites nothing") still hold for the record: the hold-back writes only `mcp-adapter.json` and saves no state. |
| Maintainer review 2026-11-16 (0401bac2) | Every D-PG10 row is locked as confirmed: D-PG10-01 with option A, D-PG10-06 with partial kept, D-PG10-19 with defaults kept everywhere. | Criterion 6 (PG-SEC-02) verifies directly. 10-20 truths 1 and 3 and the first 10-20 prohibition held for the autonomous run (see 10-20). |
| D-PG6-07 (Phase 6) | The load adds `hooksHydration.refreshMcpServers(event.cwd, projectTrusted)` (index.ts:230). | Additive. It takes the same trust constant, so the load still reads `ctx.isProjectTrusted()` twice, as before the phase (index.ts:201, :290; 75f01fc9 had the two reads at :163 and :239). |
| D-PG6-18, D-PG7-01/-05/-08/-09, D-PG11-01/-02/-06 | Typed expansion; agent frontmatter as YAML; command aliases and file mentions. | None on the option, trust and project-directory paths, as the previous report found; none of their files changed since. |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | A plugin with a `mode` option defaulting to `fast` and a hook that prints `$CLAUDE_PLUGIN_OPTION_MODE` prints `fast` and installs without `--partial`; a required option with no default is refused without `--partial` (PG-CORE-03). Folds 10-08 truth 1. | ✓ VERIFIED | features/plugin/options.feature:15 (installed, no reasons) and :73 (partially-available, `options not set`, `partial-install` hint, nothing installed). features/hook/process.feature:110: the hook's real `process.env` holds `CLAUDE_PLUGIN_OPTION_MODE=fast`. Code: UC `resolveOptions` :270-291 and `hookOptionVariableName` :314-316, spread at H/hook-env.ts:103-105; `resolveUserConfig` (E/domain/plugin-resolver.ts:739-763) adds `userConfig` to `unsupported` only when `unsetRequired` is not empty; E/domain/unsupported-components.ts:38-40 leaves `userConfig` out. Rests on D-PG10-19, locked by the maintainer (PROJECT.md:2438). In Gate G. |
| 2 | `${user_config.KEY}` is filled with the default in an exec-form hook command and arguments, in `command`, `args`, `env`, `url` and `headers` under both profiles, and in skill and agent content; a sensitive value is not written into content (PG-CORE-03). | ✓ VERIFIED | Hook: process.feature:30; `planSpawn` fills `command` and each string arg (H/spawn-helpers.ts:74-80). MCP under the adapter: args mcp-server/options.feature:277, command and env :299, url and header :334; real stub servers receive the values. Built-in: :382, :421, and builtin-options.feature:74. The adapter entry holds `${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}` and no value (mcp-server/options.feature:221). Content: features/skill/options.feature:7 (sensitive gives `[sensitive option 'token' not available in skill content]`), features/agent/options.feature:7, features/slash-command/options.feature:7. Code: E/shared/vars.ts:96-102, :112-126. In Gate G. |
| 3 | A user-scope command with `project ${CLAUDE_PROJECT_DIR}` sends the project path when typed and through `run_plugin_command`; a user-scope skill shows it when the model reads its staged `SKILL.md`; an agent body stays as it is (PG-CORE-05). Folds 10-03 truths 1 and 7. | ✓ VERIFIED | features/slash-command/invocation.feature:113, features/slash-command/model-runs.feature:79, features/skill/model-reads.feature:43, and the agent guard features/agent/frontmatter.feature:107. Code: E/orchestrators/command-invocation.ts:175 and E/orchestrators/skill-invocation.ts:165. Rests on D-PG10-16, locked by the maintainer (PROJECT.md:2437). |
| 4 | In a project marked "Do not trust", the bash tool does not find an enabled project plugin's `bin/hello`; in a trusted project it does; with two enabled plugins, one with `bin/`, PATH holds one plugin entry (PG-CORE-06, PG-CORE-07). Folds 10-04 truths 1 and 5. | ✓ VERIFIED | features/plugin/executables.feature:7 (trusted: `greeted`), :59 (refused trust: `absent`), :85 (`PI_CLAUDE_MARKETPLACE_PATH` holds one entry). The harness saves Pi's own `trust.json` value `false` (features/support/world.ts:1048-1059). Code: index.ts:201 reads trust once and passes it to `recomputePluginPath` (:246); E/orchestrators/plugin-path.ts:156-161 reads the project `state.json` only when trusted; `keepsBinDir` (:83-105) keeps only an existing directory with no metacharacter. 29/29 plugin-path cases passed here. |
| 5 | The decision on the trust gap of D-LOC-01 is in `PROJECT.md` with its premise and the Pi version it was checked against (PG-SEC-02). | ✓ VERIFIED | PROJECT.md:2433 (D-PG10-01): the question, the Claude Code premise (`core.md` U9), Pi 1.5.0 and 1.5.2, options A and B, the security flag, the residual, reversibility. D-LOC-01 (:2150) names `PATH` among the effects gated on `ctx.isProjectTrusted()` and says "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)". `.planning/upstream/pi-extension-trust-paths.md` exists (Patch line :3); BACKLOG.md:5486 PITRUSTPATHS-01. |
| 6 | PG-SEC-02 (requirement text): the maintainer confirms or reopens the accepted trust gap. | ✓ VERIFIED | The maintainer confirmed it: the D-PG10-01 outcome reads "-- Locked (maintainer review 2026-11-16, confirmed, option A; the Pi request stays a draft)" (PROJECT.md:2433, commit 0401bac2, "D-PG10-01 with option A, so PG-SEC-02 is complete"). REQUIREMENTS.md:81 `[x]` with the confirmation text, :213 Complete. The previous override is removed. |

### Plan Truths (those that restate a criterion are folded into it)

**10-01: harness and guard scenarios** (no cited file changed)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | A scenario publishes a 0755 plugin file; the step fails on wrong text or mode | ✓ VERIFIED | features/step_definitions/plugin/publishing.steps.ts:362-377 (`chmod 0o755`, mode assert :375). |
| 2 | Profile Pi starts in a "Do not trust" project; `trust.json` holds `false` for the real path in Pi's format; the step fails otherwise | ✓ VERIFIED | world.ts:154, :740-741, `saveSandboxTrust` :1052-1059; model.steps.ts:110-120. |
| 3 | Trusted project: the bash call finds `hello` | ✓ VERIFIED | executables.feature:7. In Gate G. |
| 4 | A user-scope plugin's `hello` is found in a "Do not trust" project (D-PG10-02) | ✓ VERIFIED | executables.feature:33. |
| 5 | In the refused profile, a project plugin's hook records no run (measured once, recorded) | ✓ VERIFIED | Recorded run in 10-01-SUMMARY.md:44; consistent with executables.feature:59 and project-trust.feature:29 in Gate G. |

**10-02: the option module**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Strict schema: key pattern, required `type`/`title`/`description`, optional fields, `options` rules (D-PG10-05, -20) | ✓ VERIFIED | UC :27-49 (`additionalProperties: false`), `OPTION_KEY` :103, `optionValueProblems`/`optionUseProblems` :192-225. 56/56 owner cases passed. |
| 2 | Malformed result names the first bad key or field; `null`, array, string, `false`, unknown field, missing title/description are malformed | ✓ VERIFIED | UC :157-190, :227-267. |
| 3 | `{}` parses, resolves to no value, no unset key, no sensitive key | ✓ VERIFIED | UC :245-267, :270-291. |
| 4 | A default of another type is accepted as `String(default)`; arrays join by commas; `""` is a value | ✓ VERIFIED | UC :39-41, :280-282. |
| 5 | Two maps (hooks/content vs MCP with `""` for optional no-default); required no-default in neither and unset | ✓ VERIFIED | UC :270-291 (`mcpValues.set(key, "")` :286). |
| 6 | Unset keys in declaration order, stable | ✓ VERIFIED | UC :275-285. |
| 7 | Own-key reads; `__proto__`/`constructor` are ordinary keys | ✓ VERIFIED | UC :251, :264-266, :275. |
| 8 | Hook variable naming; two case-variants give one name | ✓ VERIFIED | UC :111, :314-316. |
| 9 | Process variable: prefix plus 16 hex of SHA-256 over scope, marketplace, plugin, key joined by NUL | ✓ VERIFIED | UC :127, :319-323. |
| 10 | pi-mcp-adapter 7.0.1's `interpolateEnvVars` turns the reference into the raw default, never the value of `X` (A1, D-PG10-23) | ✓ VERIFIED | test/integration/adapter-expansion-conformance.test.ts:840-924, unchanged, in Gate G (integration suite). Artifact probe: advisory 1. |

**10-03: project directory at user scope** (truths 1 and 7 folded into criterion 3; no cited file changed)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | A user-scope skill shows the directory when invoked and when the model reads it | ✓ VERIFIED | features/skill/invocation.feature:204, model-reads.feature:43. |
| 3 | A `${CLAUDE_PROJECT_DIR}` in a typed argument is filled too | ✓ VERIFIED | command-invocation.ts:221, :342; skill-invocation.ts:199, :410; command-invocation.test.ts:282. |
| 4 | The value is the request's cwd as given, no normalization | ✓ VERIFIED | command-invocation.ts:175, skill-invocation.ts:165; command-invocation.test.ts:174-179. |
| 5 | Several places get it; a body without it is unchanged | ✓ VERIFIED | command-invocation.test.ts:167-193. |
| 6 | Staged user-scope files keep the literal | ✓ VERIFIED | E/bridges/skills/stage.ts:500; vars.ts:90-92; frontmatter.feature:107. |
| 8 | Project commands and skills of an untrusted project still run nothing | ✓ VERIFIED | command-invocation.ts:275, :406; skill-invocation.ts:261, :377. |

**10-04: PATH trust gate and existence filter** (truths 1 and 5 folded into criterion 4)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | Untrusted: project `state.json` not read for PATH, no skipped-scope warning, earlier project entries leave PATH and ledger | ✓ VERIFIED | plugin-path.ts:153-170, :177. 29/29 owner cases passed here. |
| 3 | User-scope `bin` on PATH whatever the trust answer | ✓ VERIFIED | plugin-path.ts:153-155; executables.feature:33. |
| 4 | Trust is read no more often than before | ✓ VERIFIED | index.ts:201 (one constant) feeds :203, :210, :230, :246, :260; the other read at :290 predates the phase. The D-PG10-25 factory step (:115) reads no trust. |
| 6 | `bin` joins only when `stat` says directory (following links); missing, a file, or ENOTDIR add nothing | ✓ VERIFIED | `keepsBinDir` plugin-path.ts:89-100. |
| 7 | Metacharacter drop (skipped on backslash separator); other `stat` errors keep the path; each logged | ✓ VERIFIED | plugin-path.ts:71-73, :84-87, :102-103. |
| 8 | A folder created or removed after the load is reflected at the next `/reload` | ✓ VERIFIED | plugin-path.ts:172; index.ts:246 on every load. |

**10-05: resolver and install arms** (no cited file changed except the scenario lines)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | All-defaults plugin installs without `--partial`; `list` shows it `available` | ✓ VERIFIED | plugin/options.feature:15; plugin-resolver.test.ts:5305; list-candidate-row.ts:82. |
| 2 | `userConfig` is not an unsupported kind; no `contains userConfig` note | ✓ VERIFIED | unsupported-components.ts:38-40. |
| 3 | Required no-default: one fixed-prefix note naming keys in order and one unsupported kind | ✓ VERIFIED | plugin-resolver.ts:756-760; probe-classifiers.ts:157. |
| 4 | `{}` installs and carries an empty schema; none carries none; distinguishable | ✓ VERIFIED | plugin-resolver.ts:744-755. |
| 5 | Malformed `userConfig` makes the plugin unavailable on install, list and info with `invalid manifest`; `--partial` does not install it | ✓ VERIFIED | plugin-resolver.ts:749-752; plugin/options.feature:39, :56; probe-classifiers.ts:206-208. (A malformed manifest `userConfig` is D-PG10-05; a malformed record `userConfig` is the separate D-PG10-25 path.) |
| 6 | Entry `userConfig` applies only without a `plugin.json` | ✓ VERIFIED | plugin-resolver.ts:744. |
| 7 | Option keys `lspServers`/`source` do not change either note's reason | ✓ VERIFIED | probe-classifiers.ts:204-216; cross-surface-reason-parity.test.ts:134-158. |
| 8 | Completion cache `schemaVersion` 8; version 7 rebuilt | ✓ VERIFIED | E/shared/completion-cache.ts:90-93. |

**10-06: the `options not set` reason**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Refused without `--partial` with `options not set` and the hint; nothing installed | ✓ VERIFIED | plugin/options.feature:73. |
| 2 | Installs with `--partial` as `partially-installed`, defaults delivered | ✓ VERIFIED | plugin/options.feature:97. |
| 3 | `list`, `info` and install give the same reason through one kind-to-reason function | ✓ VERIFIED | `kindToReason` probe-classifiers.ts:286-287; install.messaging.ts:547-556. |
| 4 | `info` shows one line naming every unset key in declaration order | ✓ VERIFIED | `unsetOptionNotes` E/orchestrators/plugin/info.ts:1182, :1194-1206; plugin/options.feature:122. |
| 5 | `options not set` in every home of the closed vocabulary, one member added | ✓ VERIFIED | notification-types.ts:304, probe-classifiers.ts:82, notify-reasons.ts:135, notification-wire.ts:166; docs/json-output.md:950. |
| 6 | An earlier `--partial` record because of `userConfig` reads `partially-installed` with `options not set` until a restage | ✓ VERIFIED | `narrowUnsupportedKinds` (cross-surface-reason-parity.test.ts:153); D-PG10-24 (PROJECT.md:2440). |

**10-07: the recorded schema**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | The install record holds the declared schema in optional `userConfig`, no `schemaVersion` bump, no typed value | ✓ VERIFIED | state-io.ts:171 (`Type.Optional`); `userConfigFieldsOf` :331-344; features/plugin/install.feature:24. |
| 2 | Present only when declared; `{}` stored; legacy record loads unchanged | ✓ VERIFIED | state-io.ts:334-336; state-io.test.ts passed (96/96). |
| 3 | One producer, deep copy | ✓ VERIFIED | `structuredClone` state-io.ts:340; writers install-outcome.ts:1682, update-swap.ts:976, update-preflight.ts:850, mcp-migration.ts:614. |
| 4 | Written at every `mcpServerConfigs` site; `apply` restores it with the pinned fields | ✓ VERIFIED | The four writers; `DISABLED_PIN_FIELDS` (update-preflight.ts:801-811) reused by `restorePin` (apply.ts:1948-1999). |
| 5 | Reinstall records the manifest's options as they are then; none removes the field | ✓ VERIFIED | `replaceUserConfig` state-io.ts:392-398 at update-swap.ts:976; reinstall.feature:187. |
| 6 | A disabled refresh treats a change of declared options alone as a change | ✓ VERIFIED | update-preflight.ts:815-830. |
| 7 | A disabled record keeps the field; a legacy record gains it only at a restage; a load rewrites nothing | ✓ VERIFIED | The field is pinned; the only load-time record writer is the MCP move, which restages (mcp-migration.ts:614-621). The D-PG10-25 hold-back saves no state (`persistMigration: false`, reconcile/option-withhold.ts:76). |

**10-08: hook option variables** (truth 1 folded into criterion 1)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 2 | Every option with a default reaches both hook lanes through one builder; none without a default | ✓ VERIFIED | H/hook-env.ts:87-118; H/dispatch-exec.ts:233, H/async-rewake/registry.ts:952. |
| 3 | Option variables after the path variables and before lane and session additions | ✓ VERIFIED | H/hook-env.ts:98-110. |
| 4 | Two case-variant keys give one variable; the later wins | ✓ VERIFIED | hook-env.ts:103-105; UC :314-316. |
| 5 | One reader `recordedOptionsOf` re-validates; an unparseable value reads as no options, is logged, never throws | PASSED (override) | Override 1 (D-PG10-25, maintainer review 2026-11-16): it reads as declared options with no values, marked unreadable (state-io.ts:378-382), and the D-PG10-25 surfaces read the parse status through `unreadableUserConfigOf` (:351-361). The re-validate, log and no-throw clauses hold. |
| 6 | A load builds hook options from the record, no manifest read | ✓ VERIFIED | H/event-router.ts:849. |
| 7 | After reinstall and a new session, hooks get the new default | ✓ VERIFIED | process.feature:179. |
| 8 | A legacy record gets no option variable until a restage; a load rewrites nothing | ✓ VERIFIED | `recordedOptionsOf` gives `resolveOptions(undefined)` for no field (state-io.ts:374-376); `D-PG10-25: reads a record with no stored options as readable` (state-io.test.ts:887). |

**10-09: skill content** (no cited file changed)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | `${user_config.KEY}` written at staging at install, update, reinstall and enable | ✓ VERIFIED | skills/stage.ts:389; install-outcome.ts:1283, update-swap.ts:406; skill/options.feature:7, :77. |
| 2 | A sensitive reference becomes the fixed placeholder | ✓ VERIFIED | vars.ts:96-99. |
| 3 | A reference with no value stays as written | ✓ VERIFIED | vars.ts:101. |
| 4 | No declared `userConfig`: references stay | ✓ VERIFIED | vars.ts:117-119; `declaredOptions` UC :298-300; skill/options.feature:51. |
| 5 | One pass with the path variables; spliced text not filled again | ✓ VERIFIED | vars.ts:53-56, :121-125. |
| 6 | Description filled by the same rule | ✓ VERIFIED | skills/stage.ts:117-134. |
| 7 | Invocation-time pass leaves `${user_config.KEY}` alone | ✓ VERIFIED | E/domain/argument-substitution.ts:18, :42. |
| 8 | Staging input takes the options as a required member | ✓ VERIFIED | E/bridges/skills/types.ts:66. |
| 9 | `substituteClaudeVars` gives the hooks bridge the same bytes | ✓ VERIFIED | vars.ts:84-92; spawn-helpers.ts:76 is its only hooks caller. |

**10-10: owned option variables**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | One variable per option of the MCP value map, owned name, split-token escaped value | ✓ VERIFIED | plugin-options.ts:64-81; M/adapter-escape.ts:141-148, `serializeLiteral` :124. |
| 2 | Ledger lists each owned name with scope; repeated apply changes nothing | ✓ VERIFIED | session-env.ts:206, :259-275. |
| 3 | User scope set in the awaited factory | ✓ VERIFIED | index.ts:111-112. |
| 4 | Project scope only when trusted; otherwise not read and removed | ✓ VERIFIED | plugin-options.ts:113-119; plugin/options.feature:185. |
| 5 | Trust read no more often than before | ✓ VERIFIED | index.ts:260 takes the constant from :201. |
| 6 | Stale names removed at the next apply; re-applied after every command with the last load's cwd and trust | ✓ VERIFIED | session-env.ts:291-296; index.ts:373-382, plugin-options.ts:128-130; plugin/options.feature:228. |
| 7 | An unreadable scope keeps its names; the other applies; nothing throws (NFR-2) | ✓ VERIFIED | plugin-options.ts:85-98; `applyOptionVariablesWith` (index.ts:78-84). |
| 8 | A tampered ledger entry is ignored | ✓ VERIFIED | session-env.ts:210, :238-245. |
| 9 | Bash sees a trusted project plugin's variable; untrusted only the user one | ✓ VERIFIED | plugin/options.feature:152, :185. |
| 10 | Same key in two plugins gives two names, each its own value | ✓ VERIFIED | UC :319-323; plugin-options owner cases (8/8) passed here. |

**10-11: exec-form fill and shell-form refusal**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in `command` and each string arg on both lanes, after the path variables | ✓ VERIFIED | spawn-helpers.ts:74-80; async lane registry.ts:380; process.feature:30. |
| 2 | Adjacent references each filled; a value holding `${user_config.x}` is not refilled within the option pass | ✓ VERIFIED | `replaceUserConfigReferences` single pass (UC :306-311); spawn-helpers cases (33/33) passed here. |
| 3 | An unset option fails the run with Claude Code's text | ✓ VERIFIED | `UnsetPluginOptionError` errors-bridges.ts:325-335 at spawn-helpers.ts:112; failures.feature:184. A record whose options do not parse fails with its own text instead (D-PG10-25, :108-110). |
| 4 | Holds also for a plugin with no `userConfig` | ✓ VERIFIED | `unreadable` is unset for such a record, so the unset arm applies (spawn-helpers.ts:108-112); failures.feature:184. |
| 5 | A shell-form command naming `${user_config.` is refused with Claude Code's text | ✓ VERIFIED | spawn-helpers.ts:83-85; errors-bridges.ts:363-377; failures.feature:257. |
| 6 | A failed or refused hook follows the start-failure path (block with `onFailure: "block"`, else a notice) | ✓ VERIFIED | dispatch-exec.ts:236-250. |
| 7 | Hooks with no reference start as before | ✓ VERIFIED | spawn-helpers.ts:87-89; spawn-helpers.test.ts:189; Gate G hook suites. |

**10-12 to 10-15: servers left out and the built-in skip** (the domain verdict and staging files did not change)

| Plan | # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- | --- |
| 10-12 | 1 | A server naming an option with no value in any of the five fields is left out of the file and the record; others staged | ✓ VERIFIED | M/stage.ts:285; mcp-server/options.feature:16. |
| 10-12 | 2 | One warning names plugin, server and keys only | ✓ VERIFIED | M/stage.ts:296-305; notification-mcp.ts:44. |
| 10-12 | 3 | No value means required no-default or undeclared; optional no-default blocks nothing | ✓ VERIFIED | claude-mcp-variables.ts:471-488. |
| 10-12 | 4 | No declared `userConfig`: reference kept | ✓ VERIFIED | claude-mcp-variables.ts:458-460; mcp-server/options.feature:69. |
| 10-12 | 5 | One domain verdict | ✓ VERIFIED | `mcpOptionBlock` :453-469, used by M/stage.ts:285, M/builtin-entry.ts:65, builtin-registration-step.ts:182. |
| 10-12 | 6 | Holds at install, enable, import, cascade | ✓ VERIFIED | install-outcome.ts:1495. |
| 10-12 | 7 | Notice kind in every home | ✓ VERIFIED | notification-types.ts:1447, notification-mcp.ts:44/:156, notification-wire.ts:784, notification-resolve.ts:767/:845, notification-json.ts:284, notification-dispatch.ts:392, docs/output-catalog.md:5422-5436, docs/json-output.md:958. |
| 10-13 | 1 | Update and reinstall leave out and report the same | ✓ VERIFIED | update-swap.ts:406; lifecycle.feature:763. |
| 10-13 | 2 | The load-time MCP move does the same | ✓ VERIFIED | mcp-migration.ts:479. |
| 10-13 | 3 | So the rule holds at every staging | ✓ VERIFIED | The sites above. |
| 10-13 | 4 | A new version with no `userConfig` keeps the reference at update | ✓ VERIFIED | update-swap.ts:406. |
| 10-13 | 5 | Unstaged plugin's blocked-server notices are dropped | ✓ VERIFIED | E/orchestrators/marketplace/shared.ts:494, :514 (one comment line above them was removed by the Phase 8 work). |
| 10-14 | 1 | Built-in: a server naming an unset option is not registered; others are | ✓ VERIFIED | builtin-entry.ts:65; builtin-options.feature:14. |
| 10-14 | 2 | No notice; debug log with server and keys | ✓ VERIFIED | builtin-registration-step.ts:179-186. |
| 10-14 | 3 | The 10-12 verdict decides it | ✓ VERIFIED | As 10-12 truth 5. |
| 10-14 | 4 | Options via `recordedOptionsOf`, no manifest read at session start | ✓ VERIFIED | builtin-registration-step.ts:257-264. |
| 10-14 | 5 | No `userConfig`, or a legacy record: reference kept and registered | ✓ VERIFIED | UC :298-300, state-io.ts:374-376; builtin-options.feature:61. |
| 10-14 | 6 | Both encoders' substitution context takes options as required | ✓ VERIFIED | M/substitute.ts:89; M/types.ts:52. |
| 10-15 | 1 | A stdio `command`/args element starting with a home-path option is left out (D-PG10-11) | ✓ VERIFIED | claude-mcp-variables.ts:491-519; mcp-server/options.feature:115, :168. |
| 10-15 | 2 | The notice carries a reason of its own and keys only | ✓ VERIFIED | notification-types.ts:1434-1438; docs/output-catalog.md:5432. |
| 10-15 | 3 | Mid-argument, env, url, headers block nothing | ✓ VERIFIED | `LEADING_OPTION_REFERENCE` (claude-mcp-variables.ts :329, :382). |
| 10-15 | 4 | An unset option wins: one notice, reason `unset` | ✓ VERIFIED | claude-mcp-variables.ts:462-468. |
| 10-15 | 5 | In the one verdict; also under the built-in MCP | ✓ VERIFIED | builtin-options.feature:97. |
| 10-15 | 6 | The block lands before any fill | ✓ VERIFIED | M/stage.ts:285; builtin-entry.ts:65. |

**10-16: hooks in the session that ran the command** (no cited file changed)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Hooks get option variables in the installing session, no `/reload` | ✓ VERIFIED | process.feature:145. |
| 2 | Same after enable, update, reinstall; new defaults | ✓ VERIFIED | process.feature:223, :270. |
| 3 | The producer takes options as a required input | ✓ VERIFIED | H/event-router.ts:239-240. |
| 4 | Each call site takes options from the resolution it takes the root from | ✓ VERIFIED | install-flow-results.ts:403-405, install-cascade.ts:1278-1280, enable-disable.ts:482-485 and :1063-1065, update-swap.ts:1036-1040. |
| 5 | Options ride only on hydration values | ✓ VERIFIED | notification-json.ts and notification-wire.ts carry no option field. The D-PG10-25 warning cause names the parse detail and the remedy only; `parseUserConfig` details name keys, fields and the choices of `options`, never a default (UC :157-267). |

**10-17: adapter references**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in the five fields; the server receives the default | ✓ VERIFIED | mcp-server/options.feature:277, :299, :334. |
| 2 | Entry holds the owned reference, never a fallback with the value | ✓ VERIFIED | claude-mcp-variables.ts:224-232; mcp-server/options.feature:221. The hold-back adds only `disabled` and the marker's `withheld` (M/option-withhold.ts:91-98). |
| 3 | Optional no-default is `""` | ✓ VERIFIED | UC :286. |
| 4 | Same plugin, scope, option give the same reference; marker unchanged | ✓ VERIFIED | M/stage.ts:517-531. The marker gains `withheld` only on an entry the load holds back (M/marker.ts:50-57), and a readable record removes it (option-withhold.ts:100-110). |
| 5 | Not reported missing, not deny-listed, not rescanned | ✓ VERIFIED | claude-mcp-variables.ts:235-241. |
| 6 | The stage reads option variables in its environment (caFile origin, auth) | ✓ VERIFIED | M/stage.ts:527. |
| 7 | A `!` default in env/headers runs no command | ✓ VERIFIED | Adapter conformance cases, in Gate G. |
| 8 | No `userConfig`: reference kept | ✓ VERIFIED | mcp-server/options.feature:69. |
| 9 | Built-in config unchanged in this plan | ✓ VERIFIED | The built-in fill came in 10-19 (builtin-escape.ts:54). |

**10-18: command and agent content** (no cited file changed)

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Written at staging in command and agent content | ✓ VERIFIED | staged-command.ts:278-288; convert.ts:1058-1066; slash-command/options.feature:7, agent/options.feature:7. |
| 2 | Sensitive placeholder, no sensitive value | ✓ VERIFIED | vars.ts:96-99. |
| 3 | No value: stays | ✓ VERIFIED | vars.ts:101. |
| 4 | No `userConfig`: stays | ✓ VERIFIED | vars.ts:117-119. |
| 5 | A preloaded skill follows the same rule | ✓ VERIFIED | skill-preload.ts:93. |
| 6 | The grant-form swap leaves a filled body | ✓ VERIFIED | grant-rewrite.ts:302-303. |
| 7 | No workflow fill; invocation pass leaves options alone | ✓ VERIFIED | No `substituteClaudeContent` caller under `bridges/workflows/`; argument-substitution.ts:18, :42. |
| 8 | Commands and agents inputs take options as required | ✓ VERIFIED | commands/types.ts:99; agents/types.ts:142. |

**10-19: built-in fill**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | Filled in the five fields under the built-in MCP | ✓ VERIFIED | mcp-server/options.feature:382, :421; builtin-options.feature:74. |
| 2 | In memory only | ✓ VERIFIED | builtin-registration-step.ts:257-264. |
| 3 | Optional no-default is `""` | ✓ VERIFIED | claude-mcp-variables.ts:230-231. |
| 4 | A `!` default in env/headers runs no command | ✓ VERIFIED | builtin-escape.ts:47-55. |
| 5 | Options read at each session | ✓ VERIFIED | builtin-registration-step.ts:264. |
| 6 | A home-path option at the start of command/args is not registered | ✓ VERIFIED | builtin-options.feature:97. |
| 7 | No `userConfig` or a legacy record: kept | ✓ VERIFIED | builtin-options.feature:61. |
| 8 | Field scenarios with the same result run under both profiles | ✓ VERIFIED | mcp-server/options.feature tags `@mcp` at :15, :68, :114, :167 and :276; the pairs whose observed result differs split by profile (`@adapter-only` :220, :298, :333; `@builtin-only` :381, :420). The D-PG10-25 adapter scenarios are `@adapter-only` (:468, :498, :560), with the built-in twin in builtin-options.feature:37. |

**10-20: records**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | D-PG10-01 row: confirmed gap, premise, Pi 1.5.0 and 1.5.2, A taken, B with costs, security flag, residual, outcome `Pending maintainer review` | ✓ VERIFIED | PROJECT.md:2433 holds every clause. The outcome read `Pending maintainer review` as the autonomous run wrote it; the maintainer then locked it ("-- Locked (maintainer review 2026-11-16, confirmed, option A; the Pi request stays a draft)", 0401bac2), which is the answer the clause waited for. |
| 2 | D-LOC-01 names `PATH` and says "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)" | ✓ VERIFIED | PROJECT.md:2150. |
| 3 | Seven D-PG10 rows each with premise, versions checked, alternative, outcome `Pending maintainer review`; -16 amends SUB-02, -04 amends USRCFG-01 | ✓ VERIFIED | PROJECT.md:2434-2440: each has a premise and an alternative; each names the versions it was checked against (-04, -06, -19 Claude Code 2.1.323; -11 pi-mcp-adapter 7.0.1; -16 :2437, -23 :2439 and -24 :2440 now in their source cells, which resolves the previous advisory); -16's title says `amends SUB-02`, -04 says `amends BACKLOG USRCFG-01`. Each outcome is now `-- Locked (maintainer review 2026-11-16, ...)`; it read pending through the autonomous run, as the clause required. |
| 4 | D-PG10-19 says the hook and content default is more than Claude Code 2.1.323 does, states the question, no record calls it parity | ✓ VERIFIED | PROJECT.md:2438 ("This is more than Claude Code 2.1.323 does", "Maintainer question: ...", "No record calls it parity."), outcome "confirmed, defaults kept everywhere". |
| 5 | PENV-01 corrected with D-PG10-03; Validated bullet marked; D-CF5-15 "Amended by D-PG10-10" | ✓ VERIFIED | PROJECT.md:745, :1707, :2203. |
| 6 | Upstream draft in the house shape, not filed | ✓ VERIFIED | `.planning/upstream/pi-extension-trust-paths.md:1-5` ("Patch: no patch exists; this report is not filed."); D-PG10-01 says the request stays a draft. |
| 7 | PITRUSTPATHS-01 trigger and draft path; USRCFG-01 step 1 shipped, steps 2 and 3 behind decision 30, custody correction, step-2 prerequisites; bin-on-PATH gap marked covered | ✓ VERIFIED | BACKLOG.md:5486-5488, :1389-1397, :4879. |
| 8 | CHANGELOG lines under `[Unreleased]`, including the one-time reinstall; no version file changes | ✓ VERIFIED | CHANGELOG.md:3 (`## [Unreleased]`), :47-53 (the D-PG10-25 line :51 joined them); package.json version 0.23.0 (:122); `git diff fb957770 HEAD -- package.json sonar-project.properties` is empty. |

**10-21: documentation**

| # | Truth (short) | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | env-vars.md: `bin` only when it exists at the load, project only when trusted, metacharacter and `stat` rules | ✓ VERIFIED | docs/env-vars.md:61, :181, :183. |
| 2 | env-vars.md: user-scope project directory at invocation, model read and `run_plugin_command`; agent body kept; the stale reason gone | ✓ VERIFIED | docs/env-vars.md:39, :80, :95, :108. |
| 3 | Option variables delivered; the two pi-only names documented | ✓ VERIFIED | docs/env-vars.md:29-34, :62-64, :125-127, :187-196, and :199 adds the D-PG10-25 rule. |
| 4 | Each page says the hook and content default is more than Claude Code; none calls it parity | ✓ VERIFIED | docs/env-vars.md:250, docs/hooks-compatibility.md:376 ("It is not parity"). Both still call D-PG10-19 pending; advisory 2. |
| 5 | hooks-compatibility.md: exec fill, unset failure, shell refusal, status row | ✓ VERIFIED | docs/hooks-compatibility.md:366-372, :526, :534. |
| 6 | mcp-compatibility.md plugin options section | ✓ VERIFIED | docs/mcp-compatibility.md:607-644 (the D-PG10-25 subsection :632-644 joined it). |
| 7 | No page says the trust gap is closed | ✓ VERIFIED | docs/env-vars.md:183, :196 limit the gate to Pi's "not trusted" answer. |
| 8 | Statements sourced; unbacked claims marked unmeasured | ✓ VERIFIED | E.g. docs/mcp-compatibility.md:617, :621; the D-PG10-25 subsection names its scenarios. |

**Score:** 157/157 (156 VERIFIED, 1 PASSED (override)); 0 present, behavior-unverified.

### Prohibitions (judgment tier, flagged)

All 19 are `verification: judgment`; none is test-tier. These verdicts are non-authoritative LLM judgments: **unverified-prohibition, human review recommended**.

| Plan | Prohibition | Non-authoritative verdict and evidence |
| --- | --- | --- |
| 10-02, 10-08, 10-09, 10-18 | MUST NOT call the hook or content default parity in a comment or test or scenario title (D-PG10-19) | Holds. No comment, test or scenario title calls the default parity; the new D-PG10-25 text says "project policy, not parity" (PROJECT.md:2441). UC :71-75 says the default is "this project's rule under D-PG10-19". |
| 10-04 | MUST NOT read the project `state.json` for PATH when trust is false | Holds. plugin-path.ts:156-161. |
| 10-04 | MUST NOT describe the gate as closing the trust gap | Holds. plugin-path.ts:11-13; executables.feature titles. |
| 10-07 | MUST NOT store a user-typed value on the record | Holds. `userConfigFieldsOf` copies the declared schema only (state-io.ts:331-344). |
| 10-09, 10-18 | MUST NOT write a sensitive value into staged content, a preloaded skill included | Holds. vars.ts:97-99. |
| 10-10 | MUST NOT read an untrusted project's `state.json` to set option variables, or leave its variables set | Holds. plugin-options.ts:115-117. The D-PG10-25 load step reads a project record only for whether its options parse, sets no variable, and can only disable an entry or put back the `disabled` that the marker kept (see Info). |
| 10-10 | MUST NOT export a value without the split-token escape | Holds. adapter-escape.ts:148. |
| 10-16 | MUST NOT render an option value in a result row or JSON payload | Holds. See 10-16 truth 5. |
| 10-17 | MUST NOT write a resolved value into `mcp-adapter.json`, a fallback, or the marker | Holds. claude-mcp-variables.ts:224-232; `withheld` holds only the entry's own `disabled` field (M/option-withhold.ts:91-98). |
| 10-19 | MUST NOT write an option value to a file on the built-in path | Holds. builtin-registration-step.ts:257-264. |
| 10-20 | MUST NOT record any D-PG10 row as locked or as the maintainer's decision | Held for the autonomous run, whose rows each read pending. The maintainer locked every D-PG10 row on 2026-11-16 (0401bac2, and 6826f6f6 for D-PG10-25). The prohibition kept that step for the maintainer, and the maintainer took it; this is not a violation. |
| 10-20 | MUST NOT describe the trust gap as closed or mitigated | Holds. CHANGELOG.md:53 limits the change to "a project that Pi trusts"; PROJECT.md:2433 keeps the residual and "The gap stays open." |
| 10-20 | MUST NOT call the hook and content default parity in a record or the CHANGELOG | Holds. PROJECT.md:2438; CHANGELOG.md:47 does not use the word. |
| 10-21 | MUST NOT call it parity in any documentation page | Holds. docs/env-vars.md:250 and docs/hooks-compatibility.md:376 say "It is not parity". |
| 10-21 | MUST NOT say an untrusted repository's plugins cannot run | Holds. docs/env-vars.md:183, :196. |

## Required Artifacts

`query verify.artifacts`: full counts for 20 plans; 10-02 2/3 (advisory 1). Key artifacts re-read: UC (323 lines), `orchestrators/plugin-path.ts`, `orchestrators/plugin-options.ts`, `persistence/state-io.ts` (`userConfigFieldsOf`, `unreadableUserConfigOf`, `recordedOptionsOf`, `replaceUserConfig`), H/spawn-helpers.ts, H/hook-env.ts, `shared/vars.ts`, `domain/claude-mcp-variables.ts`, M/stage.ts, M/builtin-entry.ts, M/builtin-escape.ts, M/option-withhold.ts (178 lines), `orchestrators/reconcile/option-withhold.ts` (101 lines), `shared/session-env.ts`, the feature files above, and the planning records. None is a stub.

## Key Link Verification

`query verify.key-links`: 44/44 across the 21 plans. Trust wiring: `ctx.isProjectTrusted()` (index.ts:201) -> hooks hydrate (:203), `loadReconcile` (:210), MCP server refresh (:230), `recomputePluginPath` (:246), option apply (:260). Option data: manifest -> `resolveUserConfig` (plugin-resolver.ts:739) -> record (`userConfigFieldsOf`, install-outcome.ts:1682) -> `recordedOptionsOf` -> hooks (event-router.ts:849), owned variables (plugin-options.ts:74) and the built-in registration (builtin-registration-step.ts:264). D-PG10-25 wiring: `unreadableUserConfigOf` -> load warning (read-pass.ts:632), `list` (list-installed-row.ts:232), `info` (info.ts:1495, :1599, :1704), hold-back (reconcile/option-withhold.ts:50) at the load (read-pass.ts:444) and in the factory (index.ts:115).

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| --- | --- | --- | --- | --- |
| Hook env | `CLAUDE_PLUGIN_OPTION_*` | manifest `userConfig` -> record -> `recordedOptionsOf` | Yes, recorded by a real hook process (process.feature:110) | ✓ FLOWING |
| MCP fields | references or `mcpValues` text | the same, through the owned variable or the in-memory built-in config | Yes, real stub and http servers receive the values | ✓ FLOWING |
| `PATH` | `freshBinDirs` | each trusted scope's `state.json` -> `stat` | Yes, the bash tool runs `hello` | ✓ FLOWING |
| `{unreadable}` row and held-back entry | parse detail; `disabled: true` | the record's stored `userConfig` -> `unreadableUserConfigOf` | Yes, scenarios read the real load notice and `mcp-adapter.json` (plugin/options.feature:256, mcp-server/options.feature:499) | ✓ FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services, one file per run. Each reported `fail 0`.

| Check | File | Result |
| --- | --- | --- |
| D-PG10-25 hold-back, bridge | test/bridges/mcp/option-withhold.test.ts | PASS (16/16) |
| D-PG10-25 hold-back, load and factory step | test/orchestrators/reconcile/option-withhold.test.ts | PASS (8/8) |
| Hook fill, unset and unreadable failures | test/bridges/hooks/spawn-helpers.test.ts | PASS (33/33) |
| Error texts | test/shared/errors-bridges.test.ts | PASS (33/33) |
| Marker `withheld` member | test/bridges/mcp/marker.test.ts | PASS (89/89) |
| Restage carries the user's `disabled` | test/bridges/mcp/adapter-entry.test.ts | PASS (114/114) |
| `list` row | test/orchestrators/plugin/list-installed-row.test.ts | PASS (34/34) |
| Load warning | test/orchestrators/reconcile/delisted-plugins.test.ts | PASS (24/24) |
| Record reader | test/persistence/state-io.test.ts | PASS (96/96) |
| `info` row | test/orchestrators/plugin/info.test.ts | PASS (298/298) |
| Option module | test/domain/user-config.test.ts | PASS (56/56) |
| PATH gate | test/orchestrators/plugin-path.test.ts | PASS (29/29) |
| Owned variables | test/orchestrators/plugin-options.test.ts | PASS (8/8) |
| Gate G | `npm run check` at `333784b7` (same executable inputs as HEAD) | PASS (reused) |

## Probe Execution

Not applicable. No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` exists. The 10-01 stop-gate run was a recorded, uncommitted measurement, and its record is the evidence.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| PG-CORE-03 | 10-02, 10-05 to 10-19 | ✓ SATISFIED (the hook and content defaults rest on D-PG10-19, locked by the maintainer) | Criteria 1, 2. REQUIREMENTS.md:66 `[x]`, :204 Complete |
| PG-CORE-05 | 10-03, 10-21 | ✓ SATISFIED (D-PG10-16, locked by the maintainer) | Criterion 3. REQUIREMENTS.md:67 `[x]`, :205 Complete |
| PG-CORE-06 | 10-01, 10-04, 10-21 | ✓ SATISFIED | Criterion 4. REQUIREMENTS.md:68 `[x]`, :206 Complete |
| PG-CORE-07 | 10-01, 10-04, 10-21 | ✓ SATISFIED | Criterion 4. REQUIREMENTS.md:69 `[x]`, :207 Complete |
| PG-SEC-02 | 10-20 | ✓ SATISFIED (record, criterion 5; maintainer confirmation, criterion 6) | REQUIREMENTS.md:81 `[x]`, :213 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these five IDs to Phase 10, and each appears in plan frontmatter.

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
| --- | --- | --- | --- |
| The 127 covered non-planning files | TBD / FIXME / XXX / TODO / HACK | None | No match |
| The phase feature files | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- In a project Pi does not trust, the load's read-only pass still covers the project scope (load.ts:16-20), so the D-PG10-25 step reads the project record for whether its options parse and may write the project's `mcp-adapter.json`, as the AMIG-01 move already does there. It sets no variable and only disables, or puts back the `disabled` that the marker kept. The D-PG10-25 row does not mention trust.
- The project-scope hold-back waits for the load, as the D-PG10-25 row says. So, as with the D-PG10-23 residual, pi-mcp-adapter can start a project-scope server of a record with unreadable options before the load's first pass disables it. The user scope is held back in the factory, before any session event.
- No scenario checks `list` or `info` for a plugin whose options all have a default, or for a malformed manifest `userConfig`. Those surfaces rest on the resolver and classifier unit cases cited under 10-05.
- `shared/errors-bridges.ts:329` tells the user to open `/plugin manage`, which Pi has no command for. It is Claude Code's text, kept verbatim, and D-PG10-04 (locked) names it as one of its maintainer questions.
- The previous report's Info about an unparseable stored `userConfig` starting a stdio server under pi-mcp-adapter with empty values (review IN-09) is resolved by the hold-back, apart from the project-scope start-up window above.

## Human Verification Required

None. The judgment-tier prohibitions are flagged above, as the sibling re-verifications do. No maintainer decision is open for this phase: the maintainer review of 2026-11-16 locked every D-PG10 row and accepted the remaining override.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all five roadmap criteria hold, and every scenario that exercises them passed in Gate G on code identical to HEAD. The maintainer review closed what the previous report carried. PG-SEC-02 is confirmed with option A and now verifies directly, so its override is gone. The three decision rows that named no version now name them, so the previous advisory is resolved and 10-20 truth 3 counts. The D-PG10-25 fail-closed change was checked surface by surface. It changes only the clauses that override 1 covers, which is re-based on the decision as the maintainer took it, and it leaves the other option, trust, and project-directory truths in place. Two records-only advisories remain: a plan artifact probe pattern, and two documentation lines (plus ROADMAP.md:497 and 10-SECURITY.md) that still call phase 10 decisions pending.

---

_Verified: 2026-11-17T02:27:20Z_
_Verifier: Claude (gsd-verifier)_
