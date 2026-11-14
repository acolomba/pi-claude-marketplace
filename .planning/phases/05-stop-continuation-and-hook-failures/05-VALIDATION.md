---
phase: "05"
slug: "stop-continuation-and-hook-failures"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner (`node:test`, `node:assert/strict`, `strong-mock`) and Cucumber 13.3.0 |
| **Config file** | package.json, cucumber.json, and the existing direct coverage tooling; nothing is installed |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/settle.test.ts` (the owner test of the file a task changes) |
| **Pair coverage command** | `npm run test:coverage:direct -- <source file>` (100% line, branch, and function coverage for each changed source) |
| **Scenario command** | `npm run test:cucumber:profile -- --profile adapter <feature files>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Owner tests under 60 seconds (the dispatch, event-router, and registry tests are the largest); one hook feature file about one minute; the full suite roughly 10 to 15 minutes on this checkout, with a 2400-second timeout |

No hook scenario of this phase is an MCP scenario, so each is untagged and runs under the adapter profile only. The one exception is the `@mcp` scenario "A main session still runs its lifecycle hooks" of `features/plugin/subagent-child.feature`, which task 05-01-02 runs under both profiles. A `--profile builtin` run of an untagged feature selects no scenario and proves nothing, so no other task uses it; the full gate runs both profiles over the whole suite.

Every test and scenario runs in a hermetic home: `test/platform/isolated-pi-home.ts` for owner tests, a temporary folder of the case for file tests, and the sandbox of the cucumber world for scenarios. Nothing reads or writes the real `~/.pi/agent`.

---

## Sampling Rate

- **While editing:** the owner tests and the direct pair coverage of the changed sources, and the task's own feature files.
- **After every task commit:** the normal repository hooks, which run `npm run check:commit`. It does not run cucumber. Do not repeat its checks right before the commit.
- **Green commits:** the commit hook runs no scenario, so each task's own verify runs every feature that its change can affect, before the commit. Planning scanned the suite for each change. The move affects the five features that declare a Stop hook, and task 05-01-02 changes and runs all five (`features/plugin/subagent-child.feature` under both profiles) with `test/integration/pi-subagents-child-identity.test.ts`. The failure notices affect one existing scenario, which task 05-02-01 changes. No other existing scenario asserts a behavior that a task changes: no scenario outside those gives a synchronous hook an exit code other than 0 and 2 on a notice event and then states the user's messages, none stops a prompt or a tool call and states them, none sends a context over 10,000 characters, and none gives a plain `async` hook a `timeout`. No commit leaves a scenario red for a later commit to repair.
- **After every plan wave:** `npm run check` on the combined tree, with a 2400-second timeout. The waves run one after another on the main working tree.
- **Before `/gsd-verify-work`:** the full suite must be green: static checks, Fallow, unit, integration, both Cucumber profiles, and 100% direct coverage. A skipped required scenario or a step that reaches its deadline is not a pass.
- **Max feedback latency:** 60 seconds for owner tests; about 60 seconds for one feature file. `features/plugin/subagent-child.feature` and the child-identity integration test start real children and take longer; only task 05-01-02 runs them.
- **Failing first:** each scenario is seen red before its change and green after it, and the summary records both runs. A commit is always green, because the hook rejects a failing commit, so the red run happens in the working tree before the production change. Two scenarios are regression guards that pass before and after: the rewake guard of 05-01-01 (it lands green in a commit of its own, on the unchanged production tree, before the handler moves; task 05-01-02 leaves it unedited and records one red run after the move with the mark's call removed in the working tree only), and the reload scenario of 05-05-02 (its summary records one red run with the reap's kill neutralized in the working tree only). The counts row of the cap scenario is a control reading of the run-start probe: task 05-01-01 commits it with the nine run starts of the unchanged tree, and task 05-01-02 changes it to one.
- **No timing:** no step sleeps for a fixed time. A step waits on a record, a lifecycle line, or a file until a named deadline. The only real wait is the `sleep 3` of the hook in the timeout scenario of 05-05-01. The two scenarios of plan 05-05 wait on the hook's `end` line, on the `UserPromptSubmit` run after the reload, and on the state of the hook's process; each task names every wait and its deadline, and the summary records them.

---

## Per-Task Verification Map

Every task has explicit automated commands, each followed by its failing direction, in its PLAN. The representative command below does not replace the other owner commands, the pair coverage, or the feature run listed there. A new test, fixture, or step file is created in the same task as its first consumer; no scaffold without a consumer is scheduled.

| Task ID | Plan | Wave | Requirements | Threat Ref | Secure Behavior | Test Type | Representative Automated Command | File Exists | Status |
|---------|------|------|--------------|------------|-----------------|-----------|----------------------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PG-HOOK-02 | T-05-02 | The rewake guard and the run-start probe pass on the unchanged production tree; the probe logs every run start, nine for the cap scenario | behavior | `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature features/hook/async.feature` | Both features exist, extend; the run-start probe, three steps, and the guard scenario are created here | ⬜ pending |
| 05-01-02 | 01 | 1 | PG-HOOK-02 | T-05-01, T-05-02, T-05-05 | Stop runs on `agent_before_settle`; the limit of eight holds; a rewake inside the boundary sets the D-BG-210 mark; the handler drops no entry of another extension and never returns `continue: false`; no scenario is red at the commit | owner/gate/behavior/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/settle.test.ts test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/platform/pi-api.test.ts test/index.test.ts` | Owner tests and the features exist, extend; one step and the two-block scenario are created here; the main-session scenario of `features/plugin/subagent-child.feature` changes here and runs under both profiles | ⬜ pending |
| 05-01-03 | 01 | 1 | PG-HOOK-02 | — | No comment names the old fire point; comments only | owner/gate | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/closed-set-enrollment.test.ts test/bridges/hooks/payloads/stop.test.ts test/domain/components/hook-events.test.ts` | Exist, comment change | ⬜ pending |
| 05-02-01 | 02 | 2 | PG-HOOK-14 | T-05-06 | A failed exit shows one notice with the first stderr line, cut at 200 characters, through `notifyHookNotice`; nothing reaches the model | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/exec-result.test.ts test/bridges/hooks/wire-protocol.test.ts test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/hook-labels.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend; one scenario changes | ⬜ pending |
| 05-02-02 | 02 | 2 | PG-HOOK-14 | T-05-07, T-05-08 | A start failure shows once per event and command with a redacted error; an edit shows one notice per failed hook | owner/behavior | `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` | Exist, extend; two scenarios are created here | ⬜ pending |
| 05-03-01 | 03 | 3 | PG-HOOK-23, PG-HOOK-14 | T-05-09, T-05-10 | The missing-script rule covers `Stop` and `UserPromptSubmit` only and always shows its notice; `onFailure` still blocks on `UserPromptSubmit` | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/exec-result.test.ts test/bridges/hooks/wire-protocol.test.ts test/bridges/hooks/on-failure.test.ts test/bridges/hooks/hook-labels.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend; one scenario and one Outline row are created here | ⬜ pending |
| 05-03-02 | 03 | 3 | PG-HOOK-23, PG-HOOK-14 | T-05-10, T-05-11 | A Stop hook's failure and its stop reason show as labeled notices; `StopFailure` shows none | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/settle.test.ts test/bridges/hooks/hook-labels.test.ts test/bridges/hooks/dispatch.test.ts` | Exist, extend; two scenarios are created here | ⬜ pending |
| 05-03-03 | 03 | 3 | PG-HOOK-14 | T-05-11 | A prompt hook's and a tool hook's stop reason show with upstream's texts; no notice where the bridge does not stop | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/hook-labels.test.ts` | Exist, extend; two scenarios are created here | ⬜ pending |
| 05-04-01 | 04 | 3 | PG-HOOK-14 | T-05-12, T-05-16, T-05-17 | An over-limit context is saved inside the scope's data root through `assertPathInside` and an atomic write; the cap never rejects; the preview's tag is neutralized | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/context-cap.test.ts test/bridges/hooks/hook-output-files.test.ts test/shared/atomic-json.test.ts test/bridges/hooks/dispatch-exec.test.ts` | Two new sources, their two paired tests, one step module, and one scenario are created here; the others exist | ⬜ pending |
| 05-04-02 | 04 | 3 | PG-HOOK-14 | T-05-17 | Each text of a plain async answer is capped alone and in order; a reload during the save sends nothing | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/async-rewake/async-answer.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Exist, extend | ⬜ pending |
| 05-04-03 | 04 | 3 | PG-HOOK-14 | T-05-13, T-05-15 | The sweep removes only old regular files of the saved name form inside its folder, follows no link, and never fails a load | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/hook-output-files.test.ts test/bridges/hooks/event-router.test.ts` | Paired test from 05-04-01; the router test exists | ⬜ pending |
| 05-05-01 | 05 | 2 | PG-HOOK-21 | T-05-18 | A plain async hook has no timer; an asyncRewake hook keeps its ladder | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/exec-timer.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/timeout.test.ts` | Exist, extend; one scenario is created here | ⬜ pending |
| 05-05-02 | 05 | 2 | PG-HOOK-21 | T-05-19 | A reload, the reap, and a shutdown still stop a plain async child; `finalizeChild` and the PID table are unchanged | owner/behavior | `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature` | Exist, extend; one guard scenario is created here | ⬜ pending |
| 05-06-01 | 06 | 4 | PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21 | T-05-20 | The page states each residual: the plain async hook outside Linux, the busy session at the boundary, other extensions, the saved files and their folder, the downgraded missing-script block | docs | `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/hooks-compatibility.md` | Exists, change | ⬜ pending |
| 05-06-02 | 06 | 4 | PG-HOOK-02, PG-HOOK-14, PG-HOOK-21 | — | The catalog block and its totals stay byte-identical; the CHANGELOG states what a reader sees | docs/gate | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/hooks-notice-notify.test.ts test/architecture/catalog-uat/catalog-contract.test.ts` | Exist, change | ⬜ pending |
| 05-06-03 | 06 | 4 | PG-HOOK-02 | T-05-21 | No script asserts the old fire point and no suppression marker hides nothing | gate | `npm run fallow` | One file is deleted; four exist, change | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Threats with no task row of their own: T-05-03 (plugin text in the hidden continuation message) and T-05-04 (a Stop hook that holds the boundary) are accepted in plan 05-01 and stated by 05-06-01; T-05-09 (the downgraded missing-script block) and T-05-14 (data in a saved file) are accepted in plans 05-03 and 05-04 and stated by 05-06-01. T-05-SC is in every plan: no package is installed. The two high-severity threats, T-05-12 and T-05-13, are mitigated with owner cases in 05-04-01 and 05-04-03.

---

## Full Gates

Normal commit hooks are mandatory. Each combined-tree gate runs the complete command with a 2400-second timeout. A commit hook or a focused subset cannot satisfy it. A gate may reuse a passing result only for identical build inputs under the local-verification skill; otherwise it reruns.

| Gate | Command | Timeout | Required evidence | Status |
|---|---|---|---|---|
| Wave 1 combined tree | `npm run check` | 2400 seconds | Plan 05-01 merged; the exact commit, Node version, exit status, and scenario counts | ✅ green at `26c54267`, Node 26, exit 0, 184/184 scenarios, 2492 steps |
| Wave 2 combined tree | `npm run check` | 2400 seconds | Plans 05-02 and 05-05 merged; the same evidence | ❌ red at `881a00cb` (direct coverage of `event-router.test.ts`: the defaulted-executor case did not expect the new run-failure notice), fixed in `80ac7b78`; ✅ green at `80ac7b78`, Node 26, exit 0, 1926 + 184 scenarios |
| Wave 3 combined tree | `npm run check` | 2400 seconds | Plans 05-03 and 05-04 merged; the same evidence | ⬜ pending |
| Wave 4 combined tree | `npm run check` | 2400 seconds | Plan 05-06 merged; the same evidence | ⬜ pending |
| Phase gate | `npm run check` | 2400 seconds | The final tree after the parent lines; reuse only when the build inputs are identical | ⬜ pending |
| Merge gate | `npm run check` | 2400 seconds | The merged tree, or a documented identical-input reuse | ⬜ pending |
| Final PR or release handoff | `npm run check` | 2400 seconds | The final build inputs, or a documented identical-input reuse | ⬜ pending |

---

## Wave 0 Requirements

There is no standalone Wave 0 and no scaffold without a consumer. Each task that creates a test, fixture, or step file also creates its first consumer and verifies it. Task 05-01-01 is a commit of harness and feature files only: a scenario of that commit uses each step it adds, and that scenario passes on the unchanged production tree. No framework is installed.

- [ ] 05-01-01 creates `features/lib/run-start-probe.ts` (a harness Pi extension loaded through `extraExtensions`, never through the fixed list of `features/support/world.ts`), its `Given`, and the `Then` for the settlement, run-start, and model-call counts, with their first consumer in the same commit: the cap scenario of `features/hook/prompt-and-stop.feature`, which passes on the unchanged production tree with nine run starts. Planning read `scripts/check-corresponding-tests.mjs`: the pairing gate covers `extensions/pi-claude-marketplace` and `test` only, so the probe needs no paired test, as `features/lib/hook-result-observer.ts` has none. Planning also ran `fallow dupes` 3.41.0 over a scratch copy: a probe of the planned shape forms no clone group with the observer.
- [ ] 05-01-01 creates the rewake guard `When` in `features/step_definitions/hook/async.steps.ts` with the scenario that uses it, in the same commit, green on the unchanged production tree.
- [ ] 05-01-02 creates the `When` for a prompt whose Stop hooks continue the run with the scenario "A run that a stop hook blocks twice settles once after one run start" that uses it, and removes the steps that wait for more than one settlement together with their last users: two in `features/step_definitions/hook/prompt-and-stop.steps.ts` and one in `features/step_definitions/plugin/subagent-hooks.steps.ts`.
- [ ] 05-04-01 creates `extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts` and `hook-output-files.ts` with their paired tests `test/bridges/hooks/context-cap.test.ts` and `test/bridges/hooks/hook-output-files.test.ts`, their consumer in the exec layer, and `features/step_definitions/hook/additional-context.steps.ts` with the scenario that uses its `Then`.
- [ ] Every other scenario of the phase is written from existing steps: the two failure scenarios and the changed one of 05-02, the five scenarios and the Outline row of 05-03 (task 05-03-01 adds one token to the existing hook notice steps of `features/step_definitions/hook/messages.steps.ts`, which then read an em dash of a notice as `{em dash}`, because the `fix-unicode-dashes` commit hook rewrites a literal one in a feature file), and the two scenarios of 05-05 (the timeout scenario uses the existing step that waits for a background hook run to finish).
- [ ] Every other source in the phase is an existing owner with an existing paired test, which the task extends. No export lands without a production consumer in the same commit: the failure notice builder of 05-02 stays module-private until 05-03-02 calls it from the settle module, and `sweepHookOutput` lands with its call sites in 05-04-03.

---

## Probe and Scope Evidence

- **Spec-less fallback.** No phase SPEC exists, so both SPEC sections are absent and the default-on fallback ran. The edge probe proposed 7 rows: five are resolved with an explicit criterion and lifted into the `must_haves.truths` of plans 05-02, 05-03, and 05-04; the two unclassified rows (PG-HOOK-02 and PG-HOOK-21) stay unresolved and are flagged assumptions in plans 05-01 and 05-05. No row was dismissed, and none is a backstop. The record is `05-COVERAGE.md`.
- **Prohibitions.** The two-stage recall kept one transparency item, authored descriptor-less in `must_haves.prohibitions` of plan 05-06: hook output must not be kept in files without telling the user where and for how long. Canon items (a write or a removal through a link, terminal escape injection, notice flooding, disk fill) are referred to the six threat models and `/gsd-secure-phase`. No wired-check descriptor was fabricated and nothing was auto-dismissed.
- **Research assumptions.** A1, A2, A3, and A5 are carried by plan 05-06 (the page marks them), A4 by plan 05-03, A6 by plan 05-01, A7 by plan 05-04, A8 by the threat models, and A9, which planning added (the Node 24 wording of a spawn `ENOENT`), by plan 05-02. The seven open questions of `05-RESEARCH.md` are each settled by a named plan; that does not resolve A1 to A9 or the two unclassified edges.
- **Assumption-delta scan:** `detected: true`, with the pluralization cues "fallback" and "second". Plan 05-01 records the decision: promote. The `Stop` fire point becomes `agent_before_settle`, `agent_settled` keeps `StopFailure` only, and no `ctx.mode` path is added, because research measured that no mode needs one. The invariant is encoded by owner cases and the registration gate.
- **Schema push gate:** no ORM schema file is in scope; not applicable.
- **API coverage:** the detector returned `detected: false` for the Phase 5 roadmap section, and `detected: true` over the plan bodies on one surface cue, the words "Pi API" in a test case. The phase integrates no external API; `05-COVERAGE.md` carries the reasoned declaration, and `check api-coverage.verify-pre` passes on it.
- **Scope.** Six plans, 16 tasks, four waves. No plan has a checkpoint, a new package, an account, or UI work. Every production path is an existing tracked owner except the two new bridge modules of plan 05-04. The decision coverage gate reports 20 of 20 decisions cited. The failing-direction check reports 61 commands and 61 statements.
- **Size.** Plan 05-01 is estimated at 144,000 tokens, above the 100,000-token advisory budget. Its first task lands the run-start probe and the rewake guard on the unchanged production tree, in a commit of five files. Its second task is the move, 16 files in one commit: one registration moves every Stop scenario at once, the main-session scenario of `features/plugin/subagent-child.feature` included, two gates that the commit hook runs pin the registration count, and the rewake guard must stay green across it. The move alone is above the budget. Its third task changes three comments.

---

## Manual-Only Verifications

None planned. All phase behaviors have automated verification through owner tests and scenarios that run in a hermetic home against local stand-ins.

Four measurements were one-time research probes and are not committed scenarios. They are recorded in `05-RESEARCH.md`, sections "Measurements for D-PG5-02", "Measurements for D-PG5-07", and "Probes run in this research", with their logs under the session scratchpad that section names:

| Measurement | Probe | Where the phase keeps proving it |
|---|---|---|
| A boundary handler that runs past two minutes (130 seconds, `rpc` and the terminal) | M10, M11 | Not re-run. The page states that Pi sets no time limit at the boundary (05-06-01). |
| Escape and an RPC `abort` while a Stop hook runs | M15, M16 | Owner cases of 05-01-02 (an abort inside the boundary and one that skips it leave nothing for `agent_settled` to run). |
| Input typed while a Stop hook runs | M17a to M17c | Not re-run. The page states the behavior (05-06-01). |
| The `json` and `print` modes | M2, M3, M6, M7 | Not re-run in a scenario: the cucumber harness drives `rpc` and the terminal. One handler with no mode branch serves all four (05-01-02). A parent line asks for a BACKLOG item. |

The review of D-PG5-10, D-PG5-11, D-PG5-13, D-PG5-15, and D-PG5-18 by the maintainer is not a verification of this phase: the plans implement them as decided.

---

## Validation Sign-Off

- [ ] All 16 tasks have concrete automated verification with a stated failing direction (61 commands, 61 statements)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Every new path has a consuming creation task before any later reference
- [ ] No watch-mode flags
- [ ] Feedback latency under 60 seconds for owner tests and about 60 seconds for one feature file
- [ ] Each scenario was seen red before its change and green after it, and each regression guard has a recorded red run
- [ ] All four wave gates and the phase gate pass with `npm run check`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
