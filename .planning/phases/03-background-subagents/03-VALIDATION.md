---
phase: "03"
slug: background-subagents
status: in_progress
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-13"
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner and Cucumber 13.3.0 |
| Config file | package.json, cucumber.json, existing direct coverage tooling |
| Quick run command | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts` |
| Full suite command | `npm run check` |
| Estimated runtime | Full suite roughly 15 minutes on this checkout; timeout 2400 seconds |

## Sampling Rate

- While editing: relevant owner tests, direct pair coverage, and discriminating scenarios.
- Per commit: normal repository hooks. Do not duplicate their checks immediately before committing.
- After each wave merge and at phase/merge/handoff gates: full `npm run check` on the combined tree.
- Before verification: all static, Fallow, unit, integration, both Cucumber profiles and 100% direct coverage gates pass. A required scenario skipped or a process wait timed out is not a pass.
- Unit feedback target: under 30 seconds. Process tests have explicit bounded timeouts; full gates use 2400 seconds. Reuse only identical build inputs and Node version per local-verification policy.

## Per-Task Verification Map

Every task has explicit automated commands immediately followed by failing-direction assertions in its PLAN. The representative command below does not replace additional owner commands, both MCP profiles or direct coverage listed there. Planned new test files are created in the same task as their first fixture/feature consumer; no generic test-only scaffold is scheduled.

| Task ID | Plan | Wave | Requirements | Threat Ref | Contract | Test Type | Representative Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 03-01-01 | 01 | 1 | PG-HOOK-07a | T-03-01, T-03-02, T-03-03 | Run one child async hook without touching its parent's process table | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-01-02 | 01 | 1 | PG-HOOK-07a | T-03-04, T-03-05 | Route the full child event vocabulary and always clean its own hooks | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-01-03 | 01 | 1 | PG-HOOK-07a | T-03-06, T-03-07, T-03-08 | Capture the companion identity on a real before-run callback | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-02-01 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-16 | Translate exact historical and corrected warnings without changing stored generation | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/legacy-grant-form.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-02-02 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-15, T-03-16 | Discover implementation-less records and preserve user edits | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/grant-rewrite.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-02-03 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-15, T-03-16 | Prove warning migration and edited-file protection in both MCP profiles | behavior | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature` | Existing or created by declared predecessor; extend | passed |
| 03-03-01 | 03 | 2 | PG-HOOK-07a | T-03-07, T-03-09 | Serialize session-checked identity on pre-tool payloads | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/payloads/pre-tool-use.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-03-02 | 03 | 2 | PG-HOOK-07a | T-03-07, T-03-09 | Carry one immutable identity through synchronous and background hook execution | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-04-01 | 04 | 2 | PG-AGENT-01 | T-03-20 | Emit the corrected warning through fresh conversion, staging and install | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-outcome.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-04-02 | 04 | 2 | PG-AGENT-01 | T-03-14, T-03-16, T-03-20 | Update grant-form and public diagnostic contracts for the current emitter | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/grant-forms.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-05-01 | 05 | 3 | PG-HOOK-07a | T-03-10 | Record identity after one successful and one failed child tool call | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/integration/hooks-dispatch-end-to-end.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-05-02 | 05 | 3 | PG-HOOK-07a | T-03-01, T-03-02, T-03-03, T-03-05, T-03-21 | Prove lifecycle suppression and process ownership through installed plugins | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/subagent-hook-ownership.test.ts` | New fixture/step/integration files created with consumers here | passed |
| 03-06-01 | 06 | 4 | PG-HOOK-07a, PG-AGENT-01 | T-03-07, T-03-10, T-03-11 | Exercise child identity, every execution lane and parent controls | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-06-02 | 06 | 4 | PG-HOOK-07a, PG-AGENT-01 | T-03-11, T-03-12, T-03-13 | Promote detached and concurrent companion probes into permanent acceptance | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | New maintained driver and integration owner created with feature consumers here | passed |
| 03-07-01 | 07 | 5 | PG-AGENT-01 | T-03-17 | Install one ordinary agent with delegated preference and preserve forced background cases | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/convert.test.ts test/bridges/agents/grant-forms.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-07-02 | 07 | 5 | PG-AGENT-01 | T-03-17, T-03-18 | Keep all current-output owners green and prove companion-selected default mode | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Existing or created by declared predecessor; extend | passed |
| 03-08-01 | 08 | 6 | PG-AGENT-01, PG-HOOK-07a | T-03-18 | Preserve installed bytes on load and migrate through update and reinstall | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-08-02 | 08 | 6 | PG-AGENT-01, PG-HOOK-07a | T-03-19 | Close ordinary real-child acceptance and publish the supported contract | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | Existing or created by declared predecessor; extend | pending |

## Full Gates

Normal commit hooks are mandatory. Each combined-tree gate uses the complete command with a 2400-second timeout. A commit hook or focused subset cannot satisfy it. Reuse is allowed only for identical build inputs under local-verification; otherwise rerun.

| Gate | Command | Timeout | Required evidence | Status |
|---|---|---|---|---|
| Wave 1 combined tree | `npm run check` | 2400 seconds | Runtime/capture and legacy-recognition merges; exact commit/tree, Node version, exit and complete stages | passed |
| Wave 2 combined tree | `npm run check` | 2400 seconds | Pre-tool dispatch and corrected current-warning merges; same evidence | passed |
| Wave 3 combined tree | `npm run check` | 2400 seconds | Result identity and installed lifecycle/process acceptance; same evidence | passed |
| Wave 4 combined tree | `npm run check` | 2400 seconds | Complete lanes and actual detached/concurrent companion acceptance; same evidence | passed |
| Wave 5 combined tree | `npm run check` | 2400 seconds | Atomic default producer/current-output expectations and both MCP profiles; same evidence | passed |
| Wave 6 combined tree | `npm run check` | 2400 seconds | Installed migration, ordinary real-child cases and documentation; same evidence | pending |
| Phase gate | `npm run check` | 2400 seconds | Combined final tree after Parent lines; reuse only when build inputs are identical | pending |
| Merge gate | `npm run check` | 2400 seconds | Merged combined tree or documented identical-input reuse | pending |
| Final PR/release handoff | `npm run check` | 2400 seconds | Final build inputs or documented identical-input reuse | pending |

## Wave 0 Requirements

- [x] 03-05-02 creates features/lib/subagent-hook-session.ts, features/step_definitions/plugin/subagent-hooks.steps.ts and test/integration/subagent-hook-ownership.test.ts with their first consumers.
- [x] 03-01-03 and 03-03-01/02 provide runtime capture and translated identity with production consumers in their plans.
- [x] 03-06-01 supplies structured stand-in metadata, complete recording assertions and all nine execution-lane combinations.
- [x] 03-06-02 creates the one maintained features/lib/real-subagent-child.ts and test/integration/pi-subagents-child-identity.test.ts with Node and Cucumber consumers; no temporary-script dependency.
- [ ] Existing source owners receive their paired tests; no new production module or unconsumed export is planned.
- [x] All provisional verification rows have concrete task IDs, waves, threat references, paths and commands.

There is no standalone Wave 0 or generic test-only scaffolding commit. Each
fixture-producing task verifies its own consumer. No framework install is needed.

## Probe and Scope Evidence

- Spec-less fallback is enabled and both SPEC sections are absent. Three explicit PG-AGENT-01 criteria are lifted into 03-02/03-07 truths. PG-HOOK-07a's unclassified row remains an unresolved flagged assumption in 03-08; no edge was silently dropped.
- Research A1 (another extension might alter the structured prefix) is retained, with malformed/missing-prefix defensive cases and required real-launch positive acceptance.
- Two-stage prohibition recall found no new bespoke prohibition beyond the locked engineering contract. Canon path traversal, process authority, identity spoofing and secret/prompt leakage are referred to the phase threat models, `$gsd-secure-phase` and existing static checks. Canonical `projectProhibitions([])` returned `[]`; no fake check descriptor or auto-dismissal was authored.
- API detector on Phase 3's ROADMAP scope alone was negative. The complete Phase 3 plan/ROADMAP scope triggered on same-PID SDK test prose through canonical `detectApiIntegration`; COVERAGE.md records why no external API integration is introduced. A CLI attempt returned `skipped/no_input`, which was not treated as a negative verdict.
- No ORM schema file, UI work or AI framework/evaluation work is in scope. No external setup or new package is required. All production paths are existing tracked owners; five new test, fixture and step files are explicitly created in 03-05-02 and 03-06-02. The three research Open Questions are marked RESOLVED with implementing task references; A1 remains flagged.

The revised set has 18 tasks in eight plans over six waves. Seven plans own fewer than ten implementation files. Plan 03-07 retains an explicitly accepted ten-file advisory: converter output and all nine affected source/test/feature consumers must change in the same gated plan. Its 78000-token estimate and conservative twelve-file total including summary/validation are within the hard limits. No assertion is weakened, postponed across a failing gate, or omitted from ownership to reduce the count.

## Manual-Only Verifications

None planned. All phase behaviors have automated verification, including actual
companion child execution through a local fake provider without real credentials.
Missing evidence must be automated before requesting user testing.

## Validation Sign-Off

- [x] All 18 tasks have concrete automated verification with stated failure direction.
- [ ] No three consecutive tasks lack automated verification.
- [x] Every new path has a consuming creation task before later verification references.
- [ ] No watch-mode flags.
- [ ] Process waits, child launches and full gates are bounded.
- [ ] Both MCP implementation profiles pass.
- [ ] Real child and concurrency assertions pass; temporary research probes alone do not qualify.
- [ ] `nyquist_compliant: true` set after completed verification.

**Approval:** pending execution and validation

## Wave 1 Execution Evidence

Plans 03-01 and 03-02 are merged. Six task commits and both summaries were
verified by exact SHA ancestry and clean worktree status. No task hook was bypassed.
The child behavior feature was a necessary seventh-file scope adjustment.

- Initial combined gate: exit 1 at `ad9386f5823dfd9cdb671d5c960862b450530968`.
  Both Cucumber profiles passed; direct coverage exposed a journal assertion
  racing asynchronous cleanup. Log: `/tmp/pg3-wave1-check.log`.
- Correction: `5dfe02148494586a35c7f53ab38f1e09fca3a902` awaits the existing
  per-journal persistence queue and rejects directory read failures. Normal
  commit hooks and the changed-file Fallow audit passed.
- Passing gate: `node .codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 2400 -- npm run check`,
  exit 0 at `5dfe02148494586a35c7f53ab38f1e09fca3a902`, Node v26.13.1.
  Started 2026-11-13T16:58:56.918293Z; finished 2026-11-13T17:08:13.055274Z.
  Static checks, unpaired tests, integration tests, 1876 adapter scenarios /
  22904 steps, 168 builtin scenarios / 2295 steps and all 361 direct pairs passed.
  Log: `/tmp/pg3-wave1-check-fixed.log`; metadata: `/tmp/pg3-wave1-gate-fixed.json`.
- Schema drift: clear. Codebase map drift: advisory only, no automatic remap.
- Both upcoming wave-2 plans pass key-link checks. Final phase, security, review
  and real-companion acceptance gates remain pending.

## Wave 2 Execution Evidence

Plans 03-03 and 03-04 are merged. Four exact task SHAs and committed summaries
were reconciled before managed worktree cleanup. The fresh agent-grants feature
expectation was a justified additional file; stored migration fixtures remain.

- Parent acceptance correction `27987110` adds real subprocess stdin recording
  for child/main plain async and asyncRewake cases. The old registry fails both
  child cases on missing identity; main controls pass. Current code passes all
  four cases. Normal commit hooks passed after correcting fixture typing.
- Full gate: `node .codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 2400 -- npm run check`,
  exit 0 at `27987110e4a670d2a20115ab81027eec41b98148`, Node v26.13.1.
  Started 2026-11-13T17:40:54.519944+00:00; finished 2026-11-13T17:50:12.450097+00:00.
  Static checks, unpaired tests, integration tests, 1876 adapter scenarios /
  22904 steps, 168 builtin scenarios / 2295 steps and all 361 direct pairs passed.
  Default test concurrency was retained.
- Log: `/tmp/pg3-wave2-check.log`; metadata: `/tmp/pg3-wave2-gate.json`.
- Negative/positive process evidence: `/tmp/pg3-wave2-real-background-red.log`
  and `/tmp/pg3-wave2-real-background-green.log`.
- Schema drift is clear. Codebase map drift remains an advisory (`warn`, no
  automatic mapper); it does not block execution under the configured gate.

## Wave 3 Execution Evidence

Plan 03-05 is merged as `9a242dc3`. Execution paused during Task 1's commit
checks and resumed in the same preserved worktree; the staged diff matched its
backup byte for byte. Task SHAs: `1a896787` (result identity) and `ac952b64`
(lifecycle and process ownership acceptance).

- Task 1 RED was re-run with the spec reporter because the paused run's log
  showed only file-level failures: 3 of 31 fail, each the `child-session` case
  missing `agent_type`/`agent_id`; `absent` and `other-session` controls pass.
- Task 2 RED neutralized production lines in the working tree only: disabling
  the registry child gates fails both integration cases and the parent/sibling
  scenario; forcing `dispatchesInCurrentSession` true fails the tool-hook, Stop
  and compaction scenarios. Patches and logs: `/tmp/pg3-05-task2-red-*`.
- Plan scope deviations (recorded in 03-05-SUMMARY.md): RPC `new_session`
  stands in for `/reload`; the 03-01 child tool-hook scenario was replaced by a
  superset; a profile-aware child start step lets the five `@mcp` scenarios run
  under both profiles.
- Full gate: `npm run check`, exit 0 at `9a242dc3`, Node v26.13.1. Static
  checks, unpaired tests, integration tests, 1880 adapter scenarios / 22964
  steps, 173 builtin scenarios / 2367 steps and all 361 direct pairs passed.
  Log: `/tmp/pg3-wave3-check.log`.

## Wave 4 Execution Evidence

Plan 03-06 ran sequentially on `features/gaps` from `2625f6f9`. Task SHAs:
`52871464` (child identity in every tool hook lane) and `4963f504` (real
pi-subagents children as hook evidence), plus two verification fixes,
`1b6faa8b` and `4349dc5e`, and the summary `b78a670e`.

- RED neutralized production lines in the working tree only: removing identity
  from the tool payload translators fails the 9 child owner cases, 7 of 8 new
  scenario rows, all 3 integration cases and both real-child scenarios; making
  identity stick across sessions fails both "missing child metadata" rows;
  turning off child lifecycle suppression fails the detached case. Logs:
  `/tmp/pg3-06-*-red-*.log`.
- Plan scope deviation (recorded in 03-06-SUMMARY.md):
  `features/support/pi-process.ts` now clears the harness directory after the
  shared Pi reset starts its new session, because the previous scenario's
  SessionEnd hook wrote a run into the next scenario's harness.
- Full gate: `npm run check`, exit 0 at `b78a670e`, Node v26.13.1; 1890 adapter
  scenarios / 23084 steps, 182 builtin
  scenarios / 2480 steps and all 361 direct pairs passed. Log:
  `/tmp/pg3-wave4-check.log`.

## Wave 5 Execution Evidence

Plan 03-07 ran sequentially on `features/gaps` from `81b7995d`. Task SHAs:
`b9e82f91` (the converter writes `async: true` only for an accepted
`background: true` or an effective MCP grant, and no `async` key otherwise)
and `9ed5faf9` (companion-chosen launch mode acceptance); summary `ea2398e2`.

- RED with the old converter: 76 of 536 Task 1 owner cases and 6 of 497 Task 2
  owner cases fail on the generated `async: false` line; 6 of 39 adapter
  scenarios fail, including the default-mode scenario, whose real child ran in
  the foreground. Dropping the MCP rule runs `demo:granted` in the foreground.
  Logs: `/tmp/pg3-07-*red*.log`.
- Plan scope deviations (recorded in 03-07-SUMMARY.md): a comment-only fix in
  `bridges/agents/frontmatter.ts`; the real-child step accepts `unset`; the
  configured-foreground proof is the fourth agent of the explicit-background
  scenario. The 03-06 driver matches launch markers by substring; 03-08 fixes
  it.
- Full gate: `npm run check`, exit 0 at `ea2398e2`, Node v26.13.1; 1891 adapter
  scenarios / 23084 steps, 184 builtin scenarios / 2492 steps and all 361
  direct pairs passed. Log: `/tmp/pg3-wave5-check.log`.
