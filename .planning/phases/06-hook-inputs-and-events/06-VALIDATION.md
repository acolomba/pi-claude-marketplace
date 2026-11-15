---
phase: "06"
slug: "hook-inputs-and-events"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-14"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner (`node:test`, `node:assert/strict`, `strong-mock`) and Cucumber 13.3.0 |
| **Config file** | package.json, cucumber.json, and the existing direct coverage tooling; nothing is installed |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch.test.ts` (the owner test of the file a task changes) |
| **Pair coverage command** | `npm run test:coverage:direct -- <source file>` (100% line, branch, and function coverage for each changed source) |
| **Scenario command** | `npm run test:cucumber:profile -- --profile adapter <feature files>`, and `--profile builtin` too for a feature that holds `@mcp` scenarios |
| **Integration command** | `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/<file>` |
| **Full suite command** | `npm run check`, run by the orchestrator only |
| **Estimated runtime** | Owner tests under 60 seconds (the dispatch, event-router, and registry tests are the largest); one hook feature file about one minute, `features/hook/tool-use.feature` several; the full suite roughly 10 to 15 minutes on this checkout, with a 2400-second timeout |

Four features of this phase hold `@mcp` scenarios and run under both profiles: `features/hook/tool-use.feature`, `features/hook/tool-failure.feature`, `features/hook/mcp-tool-names.feature`, and `features/plugin/subagent-child.feature`. Tasks 06-02-01, 06-04-01, 06-05-01, and 06-05-02 run the tool features under both, and tasks 06-06-02, 06-07-01, and 06-09-01 run the child feature under both; task 06-07-02 runs it under the adapter profile, as the proof that nothing a hook reads changed. Every other scenario of the phase is untagged and runs under the adapter profile only (D-BG-208). A `--profile builtin` run of an untagged feature selects no scenario and proves nothing, so no other task uses it; the full gate runs both profiles over the whole suite.

Every test and scenario runs in a hermetic home: `test/platform/isolated-pi-home.ts` for owner and integration tests, a temporary folder of the case for file tests, the sandbox of the cucumber world for scenarios, and a `mktemp -d` home for the spike. Nothing reads or writes the real `~/.pi/agent`.

Executors do not run `npm run check`, and no `<automated>` command of a plan holds it. The orchestrator runs it as the wave gate.

---

## Sampling Rate

- **While editing:** the owner tests and the direct pair coverage of the changed sources, and the task's own feature files.
- **After every task commit:** the normal repository hooks, which run `npm run check:commit`. It does not run cucumber. Do not repeat its checks right before the commit.
- **Green commits:** the commit hook runs no scenario, so each task's own verify runs every feature that its change can affect, before the commit. Planning measured the suite: 174 runs tables in 20 feature files state whole payloads, so a new stdin field makes every table of its event fail until the table states the column. One task owns each field with its sweep: `tool use id` over 101 tables in 13 files (06-02-01), `duration ms` over 50 tables in 6 files (06-04-01), `mcp server` over 17 tables in 3 files (06-05-01), `custom instructions` over 5 tables (06-06-01), and `model` over 14 tables (06-06-02). A field that is absent by default adds no column to an existing table: `effort` (the harness model has no thinking level), `session title` (no scenario names its session before 06-06-02), and the five members of the new event. No commit leaves a scenario red for a later commit to repair.
- **After every plan wave:** `npm run check` on the combined tree, run by the orchestrator, with a 2400-second timeout.
- **Before `/gsd-verify-work`:** the full suite must be green: static checks, Fallow, unit, integration, both Cucumber profiles, and 100% direct coverage. A skipped required scenario or a step that reaches its deadline is not a pass.
- **Max feedback latency:** 60 seconds for owner tests; about 60 seconds for one feature file. `features/hook/tool-use.feature`, `features/plugin/subagent-child.feature`, and the child-identity integration test take longer; the tasks that change them run them.
- **Failing first:** each scenario is seen red before its change and green after it, and the summary records both runs. A commit is always green, because the hook rejects a failing commit, so the red run happens in the working tree before the production change. Four kinds of scenario land green, and the task names what proves each: the harness commits of 06-03-01 and 06-07-01 on the unchanged production tree (the scenario of the first is the `startup` reading that the detection must keep, and the control literals of the second change in task 06-09-01, which sees them red first); the guard scenario of 06-05-02 (one red run with a mutation in the working tree only); the five scenarios of 06-12-03 (one red run each, with the resolver option removed or the registration order swapped in the working tree only); and the features that tasks 06-07-02, 06-10-01, 06-10-02, 06-10-03, and 06-12-01 run unedited as proof that a change moved nothing a user sees.
- **Changes with no scenario:** tasks 06-07-02, 06-10-02, and 06-10-03 change production code and nothing a user or a hook can see: a root that nothing reads yet, a handler that nothing registers, and a registration that answers nothing until a resolver is injected. The rule on behavioral tests asks for no scenario there. Their failing-first proofs are owner cases and gates, run red before the production change and recorded in the summary, and the scenarios that prove the behavior are seen red in the plans that make it visible: 06-09-01 for the child's session, and 06-12-02 and 06-12-03 for the expansion hooks.
- **No timing:** no step sleeps for a fixed time. A step waits on a record, a lifecycle line, or a file until a named deadline. A duration is compared as the token `{milliseconds}`, which accepts a non-negative integer, never as a number.

---

## Per-Task Verification Map

Every task has explicit automated commands, each followed by its failing direction, in its PLAN. The representative command below does not replace the other owner commands, the pair coverage, or the feature run listed there. `<iso>` stands for `--import "$PWD/test/platform/isolated-pi-home.ts"`. A new test, fixture, or step file is created in the same task as its first consumer; no scaffold without a consumer is scheduled.

| Task ID | Plan | Wave | Requirements | Threat Ref | Secure Behavior | Test Type | Representative Automated Command | File Exists | Status |
|---------|------|------|--------------|------------|-----------------|-----------|----------------------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PG-HOOK-11 | T-06-01, T-06-02 | The spike runs in a temporary `HOME` and `PI_CODING_AGENT_DIR` with the scripted model, and changes nothing under `extensions/`, `test/`, or `features/` | probe record | `test -z "$(git status --porcelain -- extensions test features)"` | The record `06-S7-SPIKE.md` is created here | ✅ green |
| 06-01-02 | 01 | 1 | PG-HOOK-11 | T-06-01 | The same home rules on Pi 1.5.2; the Result section states the facts that plan 06-03 reads | probe record | `grep -c "^## Result" .planning/phases/06-hook-inputs-and-events/06-S7-SPIKE.md` | Extends the record; fills the S7 row of the PRD | ✅ green |
| 06-02-01 | 02 | 1 | PG-HOOK-04 | T-06-03, T-06-05 | One id per call on all three tool events; the projection compares ids by first appearance and never hides a wrong one | owner/gate/behavior/integration | `node <iso> --test test/bridges/hooks/payloads/pre-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/bridges/hooks/dispatch-exec.test.ts` | Owner tests and features exist, extend; `features/lib/hook-run-tokens.ts` and one scenario are created here | ✅ green |
| 06-02-02 | 02 | 1 | PG-HOOK-04 | T-06-04 | Each pair of a multi-pair edit has an id of its own, the same before and after the call | owner/behavior | `node <iso> --test test/bridges/hooks/tool-batch.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend | ✅ green |
| 06-03-01 | 03 | 2 | PG-HOOK-11 | T-06-08 | A saved session lives in the scenario's sandbox only; the production tree is unchanged | behavior/gate | `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/session-end.feature` | `features/lib/saved-sessions.ts`, the saved launch of `test/e2e/_rpc.ts`, two steps, and one scenario are created here | ✅ green |
| 06-03-02 | 03 | 2 | PG-HOOK-11 | T-06-06, T-06-07 | The source is read from Pi's own session manager; `resume` and `fork` only where the spike's rule holds | owner/gate/behavior | `node <iso> --test test/bridges/hooks/payloads/session-start.test.ts test/bridges/hooks/event-router.test.ts test/architecture/hooks-lifecycle.test.ts` | Exist, extend; four scenarios are created here | ✅ green |
| 06-04-01 | 04 | 2 | PG-HOOK-04 | T-06-09, T-06-11 | A duration only for a call with a start mark; a mark is taken or cleared, never kept | owner/behavior/integration | `node <iso> --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/dispatch.test.ts test/bridges/hooks/payloads/tool-event-facts.test.ts` | `bridges/hooks/payloads/tool-event-facts.ts` and its paired test are created here; the others exist | ✅ green |
| 06-04-02 | 04 | 2 | PG-HOOK-04 | T-06-11 | The `PreToolUse` hooks of a later call of a parallel batch stay outside the duration | owner | `node <iso> --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend | ✅ green |
| 06-05-01 | 05 | 3 | PG-HOOK-04 | T-06-12, T-06-14 | `mcp_server` only for one certain plugin server, nothing for none or several; the table empties with its scope | owner/behavior/integration | `node <iso> --test test/bridges/hooks/mcp-server-table.test.ts test/bridges/hooks/payloads/tool-event-facts.test.ts test/bridges/hooks/runtime.test.ts` | `bridges/hooks/mcp-server-table.ts`, its paired test, and one scenario are created here | ✅ green |
| 06-05-02 | 05 | 3 | PG-HOOK-04 | T-06-14 | A project-scope plugin's server is named; a guard with a recorded red run | behavior | `npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature` | One guard scenario is created here | ✅ green |
| 06-06-01 | 06 | 3 | PG-HOOK-04 | T-06-16 | `custom_instructions` is the user's text or `null`, never a made-up value | owner/behavior | `node <iso> --test test/bridges/hooks/payloads/pre-compact.test.ts test/bridges/hooks/dispatch-exec.test.ts` | Exist, extend; one step and one scenario are created here | ✅ green |
| 06-06-02 | 06 | 3 | PG-HOOK-04 | T-06-15 | `model` and `session_title` only as non-empty strings that Pi gives | owner/behavior/integration | `node <iso> --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/payloads/session-start.test.ts test/bridges/hooks/payloads/user-prompt-submit.test.ts` | Exist, extend; one step and three scenarios are created here | ✅ green |
| 06-07-01 | 07 | 4 | PG-HOOK-04 | T-06-20 | The real-child rows state a child's session fields on the unchanged production tree, as the control reading; the fixture's saved session stays inside its temporary directory | behavior/integration | `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` | Exist, extend; the harness columns are created here | ✅ green |
| 06-07-02 | 07 | 4 | PG-HOOK-04 | T-06-17, T-06-18 | The launching session only from a checked variable and a bounded read of one header line; no hook input changes | owner/behavior/integration | `node <iso> --test test/platform/subagent-child.test.ts test/bridges/hooks/child-root-session.test.ts test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts` | `bridges/hooks/child-root-session.ts` and its paired test are created here | ✅ green |
| 06-08-01 | 08 | 5 | PG-HOOK-06 | T-06-24, T-06-26 | The event is admitted with a parsed name matcher; an expression that does not compile drops its group; no handler dispatches the event | owner/gate/behavior | `node <iso> --test test/architecture/hooks-translators.test.ts test/architecture/closed-set-enrollment.test.ts test/domain/components/hooks/matcher.test.ts test/domain/components/hooks/partition.test.ts` | `bridges/hooks/payloads/user-prompt-expansion.ts`, its paired test, and two scenarios are created here; the others exist | ✅ green |
| 06-09-01 | 09 | 6 | PG-HOOK-04 | T-06-19, T-06-20, T-06-21 | The launcher's session only beside `agent_id`; internal keys stay on the child's own id | owner/behavior/integration | `node <iso> --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/hook-env.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Exist, extend | ✅ green |
| 06-10-01 | 10 | 6 | PG-HOOK-06 | T-06-25 | A buffered context carries its event; nothing a user sees changes | owner/behavior | `node <iso> --test test/bridges/hooks/routing-state.test.ts test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend | ✅ green |
| 06-10-02 | 10 | 6 | PG-HOOK-06 | T-06-23, T-06-25 | A block or a stop answers `handled`; the context a prompt hook buffered for the line is kept | owner/behavior | `node <iso> --test test/bridges/hooks/dispatch.test.ts test/bridges/hooks/hook-labels.test.ts test/bridges/hooks/wire-protocol.test.ts` | Exist, extend | ✅ green |
| 06-10-03 | 10 | 6 | PG-HOOK-06 | T-06-23 | The handler runs after `UserPromptSubmit`, never in a child, and never for extension input | owner/gate/behavior | `node <iso> --test test/architecture/hooks-lifecycle.test.ts test/bridges/hooks/event-router.test.ts test/index.test.ts` | Exist, extend | ✅ green |
| 06-11-01 | 11 | 7 | PG-HOOK-04 | T-06-22 | `effort` only for a level of Claude's set; a read that throws gives no field | owner/behavior/integration | `node <iso> --test test/domain/argument-substitution.test.ts test/bridges/hooks/translation-context.test.ts test/bridges/hooks/payloads/pre-tool-use.test.ts` | Exist, extend; the harness reasoning model, two steps, and two scenarios are created here | ✅ green |
| 06-11-02 | 11 | 7 | PG-HOOK-04 | T-06-22 | `effort` on `Stop` and `StopFailure`, and on no other event | owner/behavior | `node <iso> --test test/bridges/hooks/payloads/stop.test.ts test/bridges/hooks/payloads/stop-failure.test.ts` | Exist, extend; two scenarios are created here | ✅ green |
| 06-12-01 | 12 | 7 | PG-HOOK-06 | T-06-29 | One load for a directory and a trust state; a trusted and an untrusted table stay apart | owner/behavior | `node <iso> --test test/orchestrators/skill-alias-state.test.ts test/edge/skill-aliases.test.ts test/index.test.ts` | Exist, extend | ✅ green |
| 06-12-02 | 12 | 7 | PG-HOOK-06 | T-06-27, T-06-28 | The hooks are told the command that the line expands to; a failed name table still runs the hooks on Pi's names | owner/behavior | `node <iso> --test test/orchestrators/typed-expansion.test.ts test/bridges/hooks/index.test.ts test/index.test.ts` | `orchestrators/typed-expansion.ts`, its paired test, and `features/hook/prompt-expansion.feature` are created here | ✅ green |
| 06-12-03 | 12 | 7 | PG-HOOK-06 | T-06-23 | A blocked prompt runs no expansion hook, and a stop shows its reason; each scenario has a recorded red run | behavior | `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-expansion.feature features/hook/prompt-commands.feature features/hook/additional-context.feature features/hook/messages.feature` | Five scenarios are created here | ✅ green |
| 06-13-01 | 13 | 8 | PG-HOOK-04, PG-HOOK-06, PG-HOOK-11 | T-06-30 | The page states each residual and holds none of the five stale statements | docs | `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/hooks-compatibility.md docs/env-vars.md` | Exist, change | ✅ green |
| 06-13-02 | 13 | 8 | PG-HOOK-04, PG-HOOK-06, PG-HOOK-11 | — | The catalog block and its totals stay byte-identical; the CHANGELOG states what a reader sees | docs/gate | `node <iso> --test test/architecture/hooks-notice-notify.test.ts test/architecture/catalog-uat/catalog-contract.test.ts` | Exist, change | ✅ green |
| 06-13-03 | 13 | 8 | PG-HOOK-04 | — | Descriptions only; no scenario changes | docs/gate | `npm run check:features` | Exist, change | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The plan that registers each threat: T-06-01 and T-06-02 in plan 06-01; T-06-03 to T-06-05 in 06-02; T-06-06 to T-06-08 in 06-03; T-06-09 to T-06-11 in 06-04; T-06-12 to T-06-14 in 06-05; T-06-15 and T-06-16 in 06-06; T-06-17 and T-06-18 in 06-07; T-06-24 and T-06-26 in 06-08; T-06-19 to T-06-21 in 06-09; T-06-23 and T-06-25 in 06-10; T-06-22 in 06-11; T-06-27 to T-06-29 in 06-12; T-06-30 in 06-13. The numbers are the ones the threats had in the first plan set, before two of its plans were split, so no number names two threats. A row cites a threat of another plan in two places: task 06-07-01 cites T-06-20, because its step is the scenario-level check of that threat, and task 06-12-03 cites T-06-23, because its scenarios prove the mitigation.

Threats with no task row of their own: T-06-10 (other extensions' time inside a duration) and T-06-13 (plugin and server names in another plugin's hook stdin) are accepted in plans 06-04 and 06-05 and stated by 06-13-01. T-06-21 (the main session's id and file in a child's hook stdin) and T-06-26 (the typed line in a plugin's hook stdin) are accepted in plans 06-09 and 06-08 and stated by 06-13-01 too. T-06-SC is in every plan: no package is installed. The two high-severity threats are mitigated: T-06-01 (a spike launch in the real home) by the temporary home and the status check of 06-01-01 and 06-01-02, and T-06-23 (a command that expands after a block) by the owner cases of 06-10-02, the owner cases and the registration gate of 06-10-03, and the scenarios of 06-12-02 and 06-12-03.

---

## Full Gates

Normal commit hooks are mandatory. Each combined-tree gate runs the complete command with a 2400-second timeout. A commit hook or a focused subset cannot satisfy it. A gate may reuse a passing result only for identical build inputs under the local-verification skill; otherwise it reruns. The orchestrator runs every gate; an executor runs none.

| Gate | Command | Timeout | Required evidence | Status |
|---|---|---|---|---|
| Wave 1 combined tree | `npm run check` | 2400 seconds | Plans 06-01 and 06-02 merged; the exact commit, Node version, exit status, and scenario counts | ✅ green at `9d6e4a74`, Node 26, exit 0, 1936 + 184 scenarios |
| Wave 2 combined tree | `npm run check` | 2400 seconds | Plans 06-03 and 06-04 merged; the same evidence | ✅ green at `a43ded58`, Node 26, exit 0, 1942 + 184 scenarios |
| Wave 3 combined tree | `npm run check` | 2400 seconds | Plans 06-05 and 06-06 merged; the same evidence | ✅ green at `683d17fa`, Node 26, exit 0, 1948 + 186 scenarios |
| Wave 4 combined tree | `npm run check` | 2400 seconds | Plan 06-07 merged; the same evidence | ❌ red at `68fa5f08` (2 scenarios: the agent launch runs in `subagent-hooks.steps.ts` did not state the child session fields), fixed in `cd00da8c`; ✅ green at `cd00da8c`, Node 26, exit 0, 1948 + 186 scenarios |
| Wave 5 combined tree | `npm run check` | 2400 seconds | Plan 06-08 merged; the same evidence | ✅ green at `addac2b4`, Node 26, exit 0, 1950 + 186 scenarios |
| Wave 6 combined tree | `npm run check` | 2400 seconds | Plans 06-09 and 06-10 merged; the same evidence | ✅ green at `4d74af3a`, Node 26, exit 0, 1950 + 186 scenarios |
| Wave 7 combined tree | `npm run check` | 2400 seconds | Plans 06-11 and 06-12 merged; the same evidence | ✅ green at `3312c94a`, Node 26, exit 0, 1966 + 186 scenarios |
| Wave 8 combined tree | `npm run check` | 2400 seconds | Plan 06-13 merged; the same evidence | Reused by the phase gate: plan 06-13 changed docs, the CHANGELOG, and one feature description only; its own run passed `check:features` and 32 scenarios |
| Phase gate | `npm run check` | 2400 seconds | The final tree after the parent lines; reuse only when the build inputs are identical | ⬜ pending |
| Merge gate | `npm run check` | 2400 seconds | The merged tree, or a documented identical-input reuse | ⬜ pending |
| Final PR or release handoff | `npm run check` | 2400 seconds | The final build inputs, or a documented identical-input reuse | ⬜ pending |

Two plans of one wave share no file: the revision recomputed the waves from the `depends_on` and `files_modified` lists of all thirteen plans, each plan's wave is one more than the latest wave of the plans it depends on, and no file is in two plans of the same wave. Plans 06-09 and 06-10 share wave 6, and plans 06-11 and 06-12 share wave 7. Plan 06-09 runs after plan 06-08 only because the two share `bridges/hooks/dispatch-exec.ts` and `bridges/hooks/async-rewake/registry.ts` with their tests.

---

## Wave 0 Requirements

There is no standalone Wave 0 and no scaffold without a consumer. Each task that creates a test, fixture, or step file also creates its first consumer and verifies it. No framework is installed.

- [x] 06-01-01 creates the spike record `06-S7-SPIKE.md`; 06-01-02 completes it. Plan 06-03 has a precondition on its Result section.
- [x] 06-02-01 creates `features/lib/hook-run-tokens.ts` with its first consumers, the runs step and the tool-use step, and the scenario "A hook sees one tool use id before and after a call, and another on the next call". The steps hand every stdin member to the library, so a later field needs a change in the library only.
- [x] 06-03-01 creates the saved launch kind of `test/e2e/_rpc.ts`, `features/lib/saved-sessions.ts`, a `Given` and a `When` in `features/step_definitions/hook/session.steps.ts`, and the scenario "A new saved session starts with source startup", which passes on the unchanged production tree.
- [x] 06-04-01 creates `bridges/hooks/payloads/tool-event-facts.ts` with its paired test and its consumers in the two result translators.
- [x] 06-05-01 creates `bridges/hooks/mcp-server-table.ts` with its paired test and its consumer in the runtime.
- [x] 06-06-01 and 06-06-02 each create one step with the scenario that uses it: a compaction with instructions, and a named session.
- [x] 06-07-01 extends the real-child fixture and its step on the unchanged production tree; 06-07-02 creates `bridges/hooks/child-root-session.ts` with its paired test and its consumer in the router.
- [x] 06-08-01 creates `bridges/hooks/payloads/user-prompt-expansion.ts` with its paired test and its consumers in the two translator tables.
- [x] 06-11-01 creates the harness's reasoning model and two `Given` steps with the scenarios that use them.
- [x] 06-12-02 creates `orchestrators/typed-expansion.ts` with its paired test and its consumer in the extension factory, and `features/hook/prompt-expansion.feature` from existing steps.
- [x] Every other source in the phase is an existing owner with an existing paired test, which the task extends. No export lands without a production consumer in the same commit: `parseNameMatcher` of 06-08-01 is read by the partition and by the router in that commit, and the resolver types of 06-10-03 are exported from the router module, where the options type names them, and from the bridge's barrel only in 06-12-02, with the resolver that imports them.

---

## Probe and Scope Evidence

- **Spec-less fallback.** No phase SPEC exists, so both SPEC sections are absent and the default-on fallback ran. The edge probe proposed 4 rows: the two PG-HOOK-06 rows (empty input and encoding) are resolved with an explicit criterion and lifted into the `must_haves.truths` of plans 06-08, 06-10, and 06-12; the two unclassified rows (PG-HOOK-04 and PG-HOOK-11) stay unresolved and are flagged assumptions in plans 06-02 and 06-03. No row was dismissed, and none is a backstop. The record is `06-COVERAGE.md`.
- **Prohibitions.** The two-stage recall kept two items, authored descriptor-less in `must_haves.prohibitions`: a child tool hook with no `agent_id` must not carry the launcher's `session_id` (plan 06-09), and a user must not be left believing that an installed plugin's `UserPromptExpansion` hooks run before its next `update` or `reinstall` (plan 06-13). Canon items are referred to the thirteen threat models and `/gsd-secure-phase`. No wired-check descriptor was fabricated and nothing was auto-dismissed.
- **Research findings and assumptions.** Findings F1 to F12 are adopted as reversible defaults and A1 to A8 are carried as `06-COVERAGE.md` lists. F3 conflicts with D-PG3-06, so plan 06-07 takes the smallest reversible option: a child of a child names its launcher, and nothing is published on `process.env`. The five open questions of `06-RESEARCH.md` are each settled by a named plan: 1 by 06-09 and 06-13, 2 by 06-05, 3 by 06-07, 4 by 06-01 and 06-03, and 5 by 06-06.
- **Planner findings.** Four facts read in the Claude Code 2.1.323 binary during planning correct the plan of the new event: the context label, the notice label, the missing-script rule, and the matcher set with the timeout. They are recorded in `06-COVERAGE.md` and in plans 06-08 and 06-10 as pending maintainer review.
- **Assumption-delta scan:** `detected: true`, on surface cues only. Plan 06-01 records the decision for the one genuine split, the session id: add alongside. `sessionId` stays the hook-facing id that translators read, and `ownSessionId` is added beside it for internal keys. The invariant is encoded by the owner cases of plan 06-09.
- **Schema push gate:** no ORM schema file is in scope; not applicable.
- **API coverage:** the phase integrates no external API. `06-COVERAGE.md` carries the reasoned declaration, the detector returns `detected: false` over the roadmap section and over the thirteen plan bodies, and `check api-coverage.verify-pre` passes on it.
- **Scope.** Thirteen plans, 27 tasks, eight waves. No plan has a checkpoint, a new package, an account, or UI work. The decision coverage gate reports 24 of 24 decisions cited. The failing-direction check reports 116 commands and 116 statements. `frontmatter.validate` and `verify.plan-structure` pass for all thirteen plans.
- **Revision.** The plan checker flagged the size of four plans. Two of them were split along seams that keep every commit building and green. The first plan set's 06-07 is now 06-07 (the harness and the root resolution, which change nothing a hook reads) and 06-09 (the fields a hook reads). Its 06-09 is now 06-08 (the admission, which the compiler forces into one commit) and 06-10 (the dispatch, in three commits). Its 06-08, 06-10, and 06-11 are 06-11, 06-12, and 06-13 now. Threat IDs kept their numbers. `06-COVERAGE.md` "Size" has the reasons for the two plans that stay above the budget.
- **Tracer.** The phase's one `type="tracer"` task is 06-02-01, which sends one field through every layer the phase touches: the translator, the dispatch tables, the harness projection, and a scenario. Plan 06-01 leads with the spike beside it in wave 1, because a spike changes no code and the orchestrator fixes it as the first work of the phase.
- **Size.** Plans 06-02 (122,000 tokens) and 06-12 (108,000) are above the 100,000-token advisory budget; `06-COVERAGE.md` "Size" and each plan's flagged assumptions state why they stay whole. Every other plan is under it; the largest is 06-05 at 98,000.

---

## Manual-Only Verifications

None planned. All phase behaviors have automated verification through owner tests and scenarios that run in a hermetic home against local stand-ins.

These measurements are one-time probes and are not committed scenarios:

| Measurement | Where it is recorded | Where the phase keeps proving it |
|---|---|---|
| What Pi tells an extension at `session_start` under `--continue`, `--session`, and `--fork`, on Pi 1.5.0 and 1.5.2 | `06-S7-SPIKE.md`, by plan 06-01 | The five session scenarios of plan 06-03, which launch the profile Pi each way. |
| `--resume`, which opens a picker | Not run; `--session <file>` stands for it (D-PG6-16) | The scenario "A session opened from its file starts with source resume". |
| The upstream rules of the `UserPromptExpansion` event | Read in the Claude Code 2.1.323 binary during planning; `06-COVERAGE.md` | Not re-run. The owner cases and scenarios of plans 06-08, 06-10, and 06-12 pin the bridge's behavior, not Claude Code's. |

The review of the D-PG6 decisions by the maintainer is not a verification of this phase: the plans implement them as decided, with the corrections of findings F1 to F12.

---

## Validation Sign-Off

- [x] All 27 tasks have concrete automated verification with a stated failing direction (116 commands, 116 statements)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Every new path has a consuming creation task before any later reference
- [x] No watch-mode flags
- [x] Feedback latency under 60 seconds for owner tests and about 60 seconds for one feature file
- [x] Each scenario was seen red before its change and green after it, and each guard and control reading has its recorded red proof
- [ ] All eight wave gates and the phase gate pass with `npm run check`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
