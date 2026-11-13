---
phase: "03"
slug: background-subagents
status: planned
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
| 03-01-01 | 01 | 1 | PG-HOOK-07a | T-03-01, T-03-02, T-03-03 | Run one child async hook without touching its parent's process table | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-01-02 | 01 | 1 | PG-HOOK-07a | T-03-04, T-03-05 | Route the full child event vocabulary and always clean its own hooks | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-01-03 | 01 | 1 | PG-HOOK-07a | T-03-06, T-03-07, T-03-08 | Capture the companion identity on a real before-run callback | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-02-01 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-16 | Translate exact historical and corrected warnings without changing stored generation | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/legacy-grant-form.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-02-02 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-15, T-03-16 | Discover implementation-less records and preserve user edits | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/grant-rewrite.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-02-03 | 02 | 1 | PG-AGENT-01 | T-03-14, T-03-15, T-03-16 | Prove warning migration and edited-file protection in both MCP profiles | behavior | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature` | Existing or created by declared predecessor; extend | pending |
| 03-03-01 | 03 | 2 | PG-HOOK-07a | T-03-07, T-03-09 | Serialize session-checked identity on pre-tool payloads | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/translation-context.test.ts test/bridges/hooks/payloads/pre-tool-use.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-03-02 | 03 | 2 | PG-HOOK-07a | T-03-07, T-03-09 | Carry one immutable identity through synchronous and background hook execution | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-04-01 | 04 | 2 | PG-AGENT-01 | T-03-20 | Emit the corrected warning through fresh conversion, staging and install | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-outcome.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-04-02 | 04 | 2 | PG-AGENT-01 | T-03-14, T-03-16, T-03-20 | Update grant-form and public diagnostic contracts for the current emitter | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/grant-forms.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-05-01 | 05 | 3 | PG-HOOK-07a | T-03-10 | Record identity after one successful and one failed child tool call | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/integration/hooks-dispatch-end-to-end.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-05-02 | 05 | 3 | PG-HOOK-07a | T-03-01, T-03-02, T-03-03, T-03-05, T-03-21 | Prove lifecycle suppression and process ownership through installed plugins | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/subagent-hook-ownership.test.ts` | New fixture/step/integration files created with consumers here | pending |
| 03-06-01 | 06 | 4 | PG-HOOK-07a, PG-AGENT-01 | T-03-07, T-03-10, T-03-11 | Exercise child identity, every execution lane and parent controls | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-06-02 | 06 | 4 | PG-HOOK-07a, PG-AGENT-01 | T-03-11, T-03-12, T-03-13 | Promote detached and concurrent companion probes into permanent acceptance | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | New maintained driver and integration owner created with feature consumers here | pending |
| 03-07-01 | 07 | 5 | PG-AGENT-01 | T-03-17 | Install one ordinary agent with delegated preference and preserve forced background cases | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/convert.test.ts test/bridges/agents/grant-forms.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-07-02 | 07 | 5 | PG-AGENT-01 | T-03-17, T-03-18 | Keep all current-output owners green and prove companion-selected default mode | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-08-01 | 08 | 6 | PG-AGENT-01, PG-HOOK-07a | T-03-18 | Preserve installed bytes on load and migrate through update and reinstall | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | Existing or created by declared predecessor; extend | pending |
| 03-08-02 | 08 | 6 | PG-AGENT-01, PG-HOOK-07a | T-03-19 | Close ordinary real-child acceptance and publish the supported contract | owner/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | Existing or created by declared predecessor; extend | pending |

## Full Gates

Normal commit hooks are mandatory. Each combined-tree gate uses the complete command with a 2400-second timeout. A commit hook or focused subset cannot satisfy it. Reuse is allowed only for identical build inputs under local-verification; otherwise rerun.

| Gate | Command | Timeout | Required evidence | Status |
|---|---|---|---|---|
| Wave 1 combined tree | `npm run check` | 2400 seconds | Runtime/capture and legacy-recognition merges; exact commit/tree, Node version, exit and complete stages | pending |
| Wave 2 combined tree | `npm run check` | 2400 seconds | Pre-tool dispatch and corrected current-warning merges; same evidence | pending |
| Wave 3 combined tree | `npm run check` | 2400 seconds | Result identity and installed lifecycle/process acceptance; same evidence | pending |
| Wave 4 combined tree | `npm run check` | 2400 seconds | Complete lanes and actual detached/concurrent companion acceptance; same evidence | pending |
| Wave 5 combined tree | `npm run check` | 2400 seconds | Atomic default producer/current-output expectations and both MCP profiles; same evidence | pending |
| Wave 6 combined tree | `npm run check` | 2400 seconds | Installed migration, ordinary real-child cases and documentation; same evidence | pending |
| Phase gate | `npm run check` | 2400 seconds | Combined final tree after Parent lines; reuse only when build inputs are identical | pending |
| Merge gate | `npm run check` | 2400 seconds | Merged combined tree or documented identical-input reuse | pending |
| Final PR/release handoff | `npm run check` | 2400 seconds | Final build inputs or documented identical-input reuse | pending |

## Wave 0 Requirements

- [ ] 03-05-02 creates features/lib/subagent-hook-session.ts, features/step_definitions/plugin/subagent-hooks.steps.ts and test/integration/subagent-hook-ownership.test.ts with their first consumers.
- [ ] 03-01-03 and 03-03-01/02 provide runtime capture and translated identity with production consumers in their plans.
- [ ] 03-06-01 supplies structured stand-in metadata, complete recording assertions and all nine execution-lane combinations.
- [ ] 03-06-02 creates the one maintained features/lib/real-subagent-child.ts and test/integration/pi-subagents-child-identity.test.ts with Node and Cucumber consumers; no temporary-script dependency.
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
