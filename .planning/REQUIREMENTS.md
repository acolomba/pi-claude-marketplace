# Requirements: Unit Test Refactor

**Defined:** 2026-08-28
**Core Value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

## v1.19 Requirements

Phase 108 requirements are complete. Retained source and test commits remain
brownfield input and do not prove compliance for later phases.

### Pair Ownership

- [ ] **OWN-01**: A maintainer can map each of the 204 production TypeScript
      modules at the milestone baseline to exactly one mirrored owner test.

- [ ] **OWN-02**: Each owner test directly imports its paired production module
      without using a barrel or alternate module as a proxy.

- [ ] **OWN-03**: Barrels and type-only production modules follow the same
      ownership rule without exemptions.

- [ ] **OWN-04**: The correspondence gate rejects missing mirrors, unexpected
      legacy tests, and owner tests that import the wrong production module.

- [ ] **OWN-05**: Every inventory row remains open until its new pair plan records
      complete guideline evidence.

- [ ] **OWN-06**: Supplemental architecture, integration, and contract tests do
      not replace the mirrored owner test.

### Test Cases

- [ ] **CASE-01**: Each runtime case has explicit arrange, act, and assert phases
      in that order.

- [ ] **CASE-02**: Each case title states public behavior, and values use names
      that describe their production roles.

- [ ] **CASE-03**: Each case owns its mutable state, dependencies, timers,
      environment changes, and temporary directories.

- [ ] **CASE-04**: Each owner test uses independent `test()` cases without
      `only`, `skip`, or `todo` markers.

### Assertions and Doubles

- [ ] **TEST-01**: Each case asserts the complete public result or state with an
      expected value that is independent from production code.

- [ ] **TEST-02**: Each error case asserts the public error type and all stable
      fields that callers use.

- [ ] **TEST-03**: Each fake, stub, spy, and mock matches its role in the case.
- [ ] **TEST-04**: Each interaction mock uses `strong-mock`, exact parameters,
      complete expectations, and explicit final verification.

- [ ] **TEST-05**: Node test doubles and fake timers belong to the current test
      context and are restored by that case.

### Coverage and Enforcement

- [ ] **COV-01**: Each source-test pair reaches 100 percent function, line, and
      branch coverage when its owner test runs alone.

- [ ] **COV-02**: The focused direct-coverage command fails closed for a missing,
      ambiguous, or unmapped source or test path.

- [ ] **COV-03**: Changed-pair and all-pair commands use the focused command's
      mapping and coverage rules.

- [ ] **COV-04**: Each structural gate has a small negative control that proves
      the gate rejects its target violation.

- [ ] **COV-05**: The all-pair result contains one complete direct coverage
      record for each of the 204 inventory rows; aggregate coverage is not a
      substitute.

### Production Design

- [ ] **DES-01**: Production code exposes no symbol, reset hook, state reader, or
      test mode only for a test.

- [ ] **DES-02**: A production change for testability extracts a concern, injects
      a dependency, narrows a port, or removes hidden global state.

- [ ] **DES-03**: A refactor keeps the current HEAD module boundary unless a
      production responsibility requires a legal one-pair split.

- [x] **RES-01**: Each resolver result exposes `installable: true | false`;
      materializable arms use `true`, and the `false` arm does not expose
      `pluginRoot`. The existing three-way `state` remains secondary detail.

### Pair-Atomic Delivery

- [ ] **DEL-01**: Each executable plan and implementation commit owns exactly one
      production source-test pair.

- [ ] **DEL-02**: Each pair plan traces production callers and public contracts
      before changing its source module.

- [ ] **DEL-03**: Supporting edits stay within the owning concern and do not
      change a second production pair.

- [ ] **DEL-04**: Phase and milestone gates are acceptance criteria or carrier
      work for an owning pair, never a verification-only executable plan.

### Module Completion

- [x] **MOD-01**: All 23 domain and platform pairs complete the pair contract.
- [x] **MOD-02**: All 19 shared-contract pairs complete the pair contract.
- [x] **MOD-03**: All 12 persistence and transaction pairs complete the pair
      contract.

- [x] **MOD-04**: All 31 non-hook component bridge pairs complete the pair
      contract.

- [x] **MOD-05**: All 31 hook-runtime pairs complete the pair contract.
- [ ] **MOD-06**: All 35 orchestrator support and presenter pairs complete the
      pair contract.

- [ ] **MOD-07**: All 14 plugin and marketplace lifecycle pairs complete the pair
      contract.

- [ ] **MOD-08**: All eight composition orchestrator pairs complete the pair
      contract.

- [ ] **MOD-09**: All 30 edge-surface pairs complete the pair contract.
- [ ] **MOD-10**: The extension entry pair completes the pair contract and
      carries the final repository gates.

### Preserved Behavior

- [ ] **PRES-01**: The refactor preserves every behavior, public-surface, and
      persistence replay contract named by the handoff manifests.

- [ ] **PRES-02**: The refactor preserves the eight product corrections named by
      the handoff decisions.

- [x] **PRES-03**: Production and fake Git, credential, and device-flow adapters
      pass the same public contract cases.

- [x] **PRES-04**: Each adapter contract has an independent negative control.

### Suite Quality

- [ ] **SUITE-01**: Unit tests run offline without developer credentials or a
      shared external service.

- [ ] **SUITE-02**: Test support stays beside its concern and does not use a
      generic helper directory.

- [ ] **SUITE-03**: Source and test files contain no migration notes, relocation
      history, or work-session comments.

- [ ] **SUITE-04**: The refactor does not restore the preservation kit, abandoned
      patch, exemption list, ownership registry, sharded coverage, or generic
      helper mechanisms.

- [ ] **SUITE-05**: Focused tests, direct coverage for all pairs, planted negative
      controls, and `npm run check` pass on the completed tree.

- [ ] **SUITE-06**: The final inventory contains exactly the production modules
      at the accepted milestone baseline, with no missing or unexpected owner test.

## Brownfield Pair Inventory

This ledger records the real repository state at the accepted HEAD audit. `PASS`
means that focused direct coverage passed during triage. It does not close the row.
Every row starts `Open`.

| Phase | Group                               | Pair plans |
| ----: | ----------------------------------- | ---------: |
|   108 | Domain and Platform                 |         23 |
|   109 | Shared Contracts                    |         19 |
|   110 | Persistence and Transaction         |         12 |
|   111 | Non-Hook Component Bridges          |         31 |
|   112 | Hook Runtime                        |         31 |
|   113 | Orchestrator Support and Presenters |         35 |
|   114 | Plugin and Marketplace Lifecycle    |         14 |
|   115 | Composition Orchestrators           |          8 |
|   116 | Edge Surface                        |         30 |
|   117 | Extension Entry and Final Gate      |          1 |
|       | **Total**                           |    **204** |

**HEAD triage:** 59 `PASS`, 83 `COVERAGE_FAIL`, 60 `MISSING`, and 2
`TEST_FAIL`.

### Phase 108: Domain and Platform

| Pair    | Production source                                                       | Mirrored owner test                               | HEAD triage     | Status   |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------- | --------------- | -------- |
| P108-01 | `extensions/pi-claude-marketplace/domain/auth-registry.ts`              | `tests/domain/auth-registry.test.ts`              | `PASS`          | Complete |
| P108-02 | `extensions/pi-claude-marketplace/domain/clone-key.ts`                  | `tests/domain/clone-key.test.ts`                  | `PASS`          | Complete |
| P108-03 | `extensions/pi-claude-marketplace/domain/components/hook-events.ts`     | `tests/domain/components/hook-events.test.ts`     | `PASS`          | Complete |
| P108-04 | `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` | `tests/domain/components/hook-if-targets.test.ts` | `PASS`          | Complete |
| P108-05 | `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` | `tests/domain/components/hook-tool-names.test.ts` | `PASS`          | Complete |
| P108-06 | `extensions/pi-claude-marketplace/domain/components/hooks.ts`           | `tests/domain/components/hooks.test.ts`           | `COVERAGE_FAIL` | Complete |
| P108-07 | `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts`   | `tests/domain/components/hooks/matcher.test.ts`   | `PASS`          | Complete |
| P108-08 | `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts` | `tests/domain/components/hooks/partition.test.ts` | `PASS`          | Complete |
| P108-09 | `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts`    | `tests/domain/components/hooks/schema.test.ts`    | `PASS`          | Complete |
| P108-10 | `extensions/pi-claude-marketplace/domain/components/mcp.ts`             | `tests/domain/components/mcp.test.ts`             | `PASS`          | Complete |
| P108-11 | `extensions/pi-claude-marketplace/domain/components/plugin.ts`          | `tests/domain/components/plugin.test.ts`          | `PASS`          | Complete |
| P108-12 | `extensions/pi-claude-marketplace/domain/github-auth.ts`                | `tests/domain/github-auth.test.ts`                | `PASS`          | Complete |
| P108-13 | `extensions/pi-claude-marketplace/domain/manifest-cache.ts`             | `tests/domain/manifest-cache.test.ts`             | `PASS`          | Complete |
| P108-14 | `extensions/pi-claude-marketplace/domain/manifest-lookup.ts`            | `tests/domain/manifest-lookup.test.ts`            | `PASS`          | Complete |
| P108-15 | `extensions/pi-claude-marketplace/domain/manifest.ts`                   | `tests/domain/manifest.test.ts`                   | `PASS`          | Complete |
| P108-16 | `extensions/pi-claude-marketplace/domain/name.ts`                       | `tests/domain/name.test.ts`                       | `PASS`          | Complete |
| P108-17 | `extensions/pi-claude-marketplace/domain/plugin-root.ts`                | `tests/domain/plugin-root.test.ts`                | `PASS`          | Complete |
| P108-18 | `extensions/pi-claude-marketplace/domain/resolver.ts`                   | `tests/domain/resolver.test.ts`                   | `MISSING`       | Complete |
| P108-19 | `extensions/pi-claude-marketplace/domain/source.ts`                     | `tests/domain/source.test.ts`                     | `COVERAGE_FAIL` | Complete |
| P108-20 | `extensions/pi-claude-marketplace/domain/version.ts`                    | `tests/domain/version.test.ts`                    | `PASS`          | Complete |
| P108-21 | `extensions/pi-claude-marketplace/platform/git-credential.ts`           | `tests/platform/git-credential.test.ts`           | `PASS`          | Complete |
| P108-22 | `extensions/pi-claude-marketplace/platform/git.ts`                      | `tests/platform/git.test.ts`                      | `MISSING`       | Complete |
| P108-23 | `extensions/pi-claude-marketplace/platform/pi-api.ts`                   | `tests/platform/pi-api.test.ts`                   | `PASS`          | Complete |

### Phase 109: Shared Contracts

| Pair    | Production source                                                    | Mirrored owner test                            | HEAD triage     | Status   |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------- | --------------- | -------- |
| P109-01 | `extensions/pi-claude-marketplace/shared/atomic-json.ts`             | `tests/shared/atomic-json.test.ts`             | `PASS`          | Complete |
| P109-02 | `extensions/pi-claude-marketplace/shared/completion-cache.ts`        | `tests/shared/completion-cache.test.ts`        | `COVERAGE_FAIL` | Complete |
| P109-03 | `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`          | `tests/shared/concerns/hooks.test.ts`          | `MISSING`       | Complete |
| P109-04 | `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`       | `tests/shared/concerns/soft-dep.test.ts`       | `MISSING`       | Complete |
| P109-05 | `extensions/pi-claude-marketplace/shared/debug-log.ts`               | `tests/shared/debug-log.test.ts`               | `PASS`          | Complete |
| P109-06 | `extensions/pi-claude-marketplace/shared/errors-bridges.ts`          | `tests/shared/errors-bridges.test.ts`          | `COVERAGE_FAIL` | Complete |
| P109-07 | `extensions/pi-claude-marketplace/shared/errors.ts`                  | `tests/shared/errors.test.ts`                  | `COVERAGE_FAIL` | Complete |
| P109-08 | `extensions/pi-claude-marketplace/shared/extension-version.ts`       | `tests/shared/extension-version.test.ts`       | `MISSING`       | Complete |
| P109-09 | `extensions/pi-claude-marketplace/shared/fs-utils.ts`                | `tests/shared/fs-utils.test.ts`                | `COVERAGE_FAIL` | Complete |
| P109-10 | `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` | `tests/shared/git-failure-classifiers.test.ts` | `PASS`          | Complete |
| P109-11 | `extensions/pi-claude-marketplace/shared/markers.ts`                 | `tests/shared/markers.test.ts`                 | `MISSING`       | Complete |
| P109-12 | `extensions/pi-claude-marketplace/shared/notify-context.ts`          | `tests/shared/notify-context.test.ts`          | `MISSING`       | Complete |
| P109-13 | `extensions/pi-claude-marketplace/shared/notify-reasons.ts`          | `tests/shared/notify-reasons.test.ts`          | `MISSING`       | Complete |
| P109-14 | `extensions/pi-claude-marketplace/shared/notify.ts`                  | `tests/shared/notify.test.ts`                  | `MISSING`       | Complete |
| P109-15 | `extensions/pi-claude-marketplace/shared/path-safety.ts`             | `tests/shared/path-safety.test.ts`             | `COVERAGE_FAIL` | Complete |
| P109-16 | `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`       | `tests/shared/probe-classifiers.test.ts`       | `PASS`          | Complete |
| P109-17 | `extensions/pi-claude-marketplace/shared/session-env.ts`             | `tests/shared/session-env.test.ts`             | `COVERAGE_FAIL` | Complete |
| P109-18 | `extensions/pi-claude-marketplace/shared/types.ts`                   | `tests/shared/types.test.ts`                   | `MISSING`       | Complete |
| P109-19 | `extensions/pi-claude-marketplace/shared/vars.ts`                    | `tests/shared/vars.test.ts`                    | `PASS`          | Complete |

### Phase 110: Persistence and Transaction

| Pair    | Production source                                                     | Mirrored owner test                             | HEAD triage     | Status |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------- | --------------- | ------ |
| P110-01 | `extensions/pi-claude-marketplace/persistence/agents-index-io.ts`     | `tests/persistence/agents-index-io.test.ts`     | `COVERAGE_FAIL` | Open   |
| P110-02 | `extensions/pi-claude-marketplace/persistence/agents-index-schema.ts` | `tests/persistence/agents-index-schema.test.ts` | `PASS`          | Open   |
| P110-03 | `extensions/pi-claude-marketplace/persistence/config-io.ts`           | `tests/persistence/config-io.test.ts`           | `COVERAGE_FAIL` | Open   |
| P110-04 | `extensions/pi-claude-marketplace/persistence/config-merge.ts`        | `tests/persistence/config-merge.test.ts`        | `PASS`          | Open   |
| P110-05 | `extensions/pi-claude-marketplace/persistence/config-write-back.ts`   | `tests/persistence/config-write-back.test.ts`   | `COVERAGE_FAIL` | Open   |
| P110-06 | `extensions/pi-claude-marketplace/persistence/locations.ts`           | `tests/persistence/locations.test.ts`           | `COVERAGE_FAIL` | Open   |
| P110-07 | `extensions/pi-claude-marketplace/persistence/migrate-config.ts`      | `tests/persistence/migrate-config.test.ts`      | `COVERAGE_FAIL` | Open   |
| P110-08 | `extensions/pi-claude-marketplace/persistence/migrate.ts`             | `tests/persistence/migrate.test.ts`             | `COVERAGE_FAIL` | Open   |
| P110-09 | `extensions/pi-claude-marketplace/persistence/state-io.ts`            | `tests/persistence/state-io.test.ts`            | `COVERAGE_FAIL` | Open   |
| P110-10 | `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`        | `tests/transaction/phase-ledger.test.ts`        | `COVERAGE_FAIL` | Open   |
| P110-11 | `extensions/pi-claude-marketplace/transaction/rollback.ts`            | `tests/transaction/rollback.test.ts`            | `PASS`          | Open   |
| P110-12 | `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`    | `tests/transaction/with-state-guard.test.ts`    | `COVERAGE_FAIL` | Open   |

### Phase 111: Non-Hook Component Bridges

| Pair    | Production source                                                        | Mirrored owner test                                | HEAD triage     | Status |
| ------- | ------------------------------------------------------------------------ | -------------------------------------------------- | --------------- | ------ |
| P111-01 | `extensions/pi-claude-marketplace/bridges/agents/convert.ts`             | `tests/bridges/agents/convert.test.ts`             | `COVERAGE_FAIL` | Open   |
| P111-02 | `extensions/pi-claude-marketplace/bridges/agents/discover.ts`            | `tests/bridges/agents/discover.test.ts`            | `PASS`          | Open   |
| P111-03 | `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`         | `tests/bridges/agents/frontmatter.test.ts`         | `COVERAGE_FAIL` | Open   |
| P111-04 | `extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts`      | `tests/bridges/agents/index-mutation.test.ts`      | `PASS`          | Open   |
| P111-05 | `extensions/pi-claude-marketplace/bridges/agents/index.ts`               | `tests/bridges/agents/index.test.ts`               | `MISSING`       | Open   |
| P111-06 | `extensions/pi-claude-marketplace/bridges/agents/marker.ts`              | `tests/bridges/agents/marker.test.ts`              | `PASS`          | Open   |
| P111-07 | `extensions/pi-claude-marketplace/bridges/agents/stage.ts`               | `tests/bridges/agents/stage.test.ts`               | `COVERAGE_FAIL` | Open   |
| P111-08 | `extensions/pi-claude-marketplace/bridges/agents/types.ts`               | `tests/bridges/agents/types.test.ts`               | `MISSING`       | Open   |
| P111-09 | `extensions/pi-claude-marketplace/bridges/agents/unstage.ts`             | `tests/bridges/agents/unstage.test.ts`             | `COVERAGE_FAIL` | Open   |
| P111-10 | `extensions/pi-claude-marketplace/bridges/commands/discover.ts`          | `tests/bridges/commands/discover.test.ts`          | `COVERAGE_FAIL` | Open   |
| P111-11 | `extensions/pi-claude-marketplace/bridges/commands/index.ts`             | `tests/bridges/commands/index.test.ts`             | `MISSING`       | Open   |
| P111-12 | `extensions/pi-claude-marketplace/bridges/commands/stage.ts`             | `tests/bridges/commands/stage.test.ts`             | `COVERAGE_FAIL` | Open   |
| P111-13 | `extensions/pi-claude-marketplace/bridges/commands/types.ts`             | `tests/bridges/commands/types.test.ts`             | `MISSING`       | Open   |
| P111-14 | `extensions/pi-claude-marketplace/bridges/commands/unstage.ts`           | `tests/bridges/commands/unstage.test.ts`           | `COVERAGE_FAIL` | Open   |
| P111-15 | `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`        | `tests/bridges/mcp/collision-slots.test.ts`        | `COVERAGE_FAIL` | Open   |
| P111-16 | `extensions/pi-claude-marketplace/bridges/mcp/index.ts`                  | `tests/bridges/mcp/index.test.ts`                  | `MISSING`       | Open   |
| P111-17 | `extensions/pi-claude-marketplace/bridges/mcp/marker.ts`                 | `tests/bridges/mcp/marker.test.ts`                 | `PASS`          | Open   |
| P111-18 | `extensions/pi-claude-marketplace/bridges/mcp/parse.ts`                  | `tests/bridges/mcp/parse.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P111-19 | `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts`               | `tests/bridges/mcp/safe-set.test.ts`               | `MISSING`       | Open   |
| P111-20 | `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`                  | `tests/bridges/mcp/stage.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P111-21 | `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts`             | `tests/bridges/mcp/substitute.test.ts`             | `PASS`          | Open   |
| P111-22 | `extensions/pi-claude-marketplace/bridges/mcp/types.ts`                  | `tests/bridges/mcp/types.test.ts`                  | `MISSING`       | Open   |
| P111-23 | `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`                | `tests/bridges/mcp/unstage.test.ts`                | `COVERAGE_FAIL` | Open   |
| P111-24 | `extensions/pi-claude-marketplace/bridges/skills/discover.ts`            | `tests/bridges/skills/discover.test.ts`            | `COVERAGE_FAIL` | Open   |
| P111-25 | `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` | `tests/bridges/skills/frontmatter-degrade.test.ts` | `COVERAGE_FAIL` | Open   |
| P111-26 | `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`    | `tests/bridges/skills/frontmatter-scan.test.ts`    | `MISSING`       | Open   |
| P111-27 | `extensions/pi-claude-marketplace/bridges/skills/index.ts`               | `tests/bridges/skills/index.test.ts`               | `MISSING`       | Open   |
| P111-28 | `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` | `tests/bridges/skills/rewrite-frontmatter.test.ts` | `COVERAGE_FAIL` | Open   |
| P111-29 | `extensions/pi-claude-marketplace/bridges/skills/stage.ts`               | `tests/bridges/skills/stage.test.ts`               | `COVERAGE_FAIL` | Open   |
| P111-30 | `extensions/pi-claude-marketplace/bridges/skills/types.ts`               | `tests/bridges/skills/types.test.ts`               | `MISSING`       | Open   |
| P111-31 | `extensions/pi-claude-marketplace/bridges/skills/unstage.ts`             | `tests/bridges/skills/unstage.test.ts`             | `COVERAGE_FAIL` | Open   |

### Phase 112: Hook Runtime

| Pair    | Production source                                                                  | Mirrored owner test                                          | HEAD triage     | Status |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------- | ------ |
| P112-01 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`         | `tests/bridges/hooks/async-rewake/pid-table.test.ts`         | `COVERAGE_FAIL` | Open   |
| P112-02 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`          | `tests/bridges/hooks/async-rewake/registry.test.ts`          | `MISSING`       | Open   |
| P112-03 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`       | `tests/bridges/hooks/async-rewake/ring-buffer.test.ts`       | `PASS`          | Open   |
| P112-04 | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`                  | `tests/bridges/hooks/dispatch-exec.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P112-05 | `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`                       | `tests/bridges/hooks/dispatch.test.ts`                       | `MISSING`       | Open   |
| P112-06 | `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`                 | `tests/bridges/hooks/event-adapters.test.ts`                 | `MISSING`       | Open   |
| P112-07 | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`                   | `tests/bridges/hooks/event-router.test.ts`                   | `COVERAGE_FAIL` | Open   |
| P112-08 | `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts`                    | `tests/bridges/hooks/exec-result.test.ts`                    | `MISSING`       | Open   |
| P112-09 | `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts`                     | `tests/bridges/hooks/exec-timer.test.ts`                     | `PASS`          | Open   |
| P112-10 | `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`                       | `tests/bridges/hooks/hook-env.test.ts`                       | `MISSING`       | Open   |
| P112-11 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts`                  | `tests/bridges/hooks/if-field/bash.test.ts`                  | `MISSING`       | Open   |
| P112-12 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts`                  | `tests/bridges/hooks/if-field/glob.test.ts`                  | `MISSING`       | Open   |
| P112-13 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`                 | `tests/bridges/hooks/if-field/index.test.ts`                 | `MISSING`       | Open   |
| P112-14 | `extensions/pi-claude-marketplace/bridges/hooks/index.ts`                          | `tests/bridges/hooks/index.test.ts`                          | `MISSING`       | Open   |
| P112-15 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts`          | `tests/bridges/hooks/payloads/post-compact.test.ts`          | `PASS`          | Open   |
| P112-16 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` | `tests/bridges/hooks/payloads/post-tool-use-failure.test.ts` | `PASS`          | Open   |
| P112-17 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts`         | `tests/bridges/hooks/payloads/post-tool-use.test.ts`         | `PASS`          | Open   |
| P112-18 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts`           | `tests/bridges/hooks/payloads/pre-compact.test.ts`           | `PASS`          | Open   |
| P112-19 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts`          | `tests/bridges/hooks/payloads/pre-tool-use.test.ts`          | `PASS`          | Open   |
| P112-20 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts`           | `tests/bridges/hooks/payloads/session-end.test.ts`           | `PASS`          | Open   |
| P112-21 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts`         | `tests/bridges/hooks/payloads/session-start.test.ts`         | `PASS`          | Open   |
| P112-22 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`          | `tests/bridges/hooks/payloads/stop-failure.test.ts`          | `PASS`          | Open   |
| P112-23 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts`                  | `tests/bridges/hooks/payloads/stop.test.ts`                  | `PASS`          | Open   |
| P112-24 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts`    | `tests/bridges/hooks/payloads/user-prompt-submit.test.ts`    | `PASS`          | Open   |
| P112-25 | `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`                  | `tests/bridges/hooks/routing-state.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P112-26 | `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`                         | `tests/bridges/hooks/settle.test.ts`                         | `COVERAGE_FAIL` | Open   |
| P112-27 | `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts`                  | `tests/bridges/hooks/spawn-helpers.test.ts`                  | `MISSING`       | Open   |
| P112-28 | `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`                          | `tests/bridges/hooks/stage.test.ts`                          | `COVERAGE_FAIL` | Open   |
| P112-29 | `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts`                        | `tests/bridges/hooks/timeout.test.ts`                        | `PASS`          | Open   |
| P112-30 | `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`            | `tests/bridges/hooks/translation-context.test.ts`            | `PASS`          | Open   |
| P112-31 | `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts`                  | `tests/bridges/hooks/wire-protocol.test.ts`                  | `COVERAGE_FAIL` | Open   |

### Phase 113: Orchestrator Support and Presenters

| Pair    | Production source                                                                    | Mirrored owner test                                            | HEAD triage     | Status |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------- | ------ |
| P113-01 | `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`                        | `tests/orchestrators/auth-host.test.ts`                        | `COVERAGE_FAIL` | Open   |
| P113-02 | `extensions/pi-claude-marketplace/orchestrators/discover.ts`                         | `tests/orchestrators/discover.test.ts`                         | `COVERAGE_FAIL` | Open   |
| P113-03 | `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts`         | `tests/orchestrators/import/execute.messaging.test.ts`         | `MISSING`       | Open   |
| P113-04 | `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts`              | `tests/orchestrators/import/marketplaces.test.ts`              | `COVERAGE_FAIL` | Open   |
| P113-05 | `extensions/pi-claude-marketplace/orchestrators/import/refs.ts`                      | `tests/orchestrators/import/refs.test.ts`                      | `PASS`          | Open   |
| P113-06 | `extensions/pi-claude-marketplace/orchestrators/import/settings.ts`                  | `tests/orchestrators/import/settings.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P113-07 | `extensions/pi-claude-marketplace/orchestrators/import/types.ts`                     | `tests/orchestrators/import/types.test.ts`                     | `MISSING`       | Open   |
| P113-08 | `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts`        | `tests/orchestrators/marketplace/add.messaging.test.ts`        | `MISSING`       | Open   |
| P113-09 | `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts` | `tests/orchestrators/marketplace/autoupdate.messaging.test.ts` | `MISSING`       | Open   |
| P113-10 | `extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts`       | `tests/orchestrators/marketplace/list.messaging.test.ts`       | `MISSING`       | Open   |
| P113-11 | `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts`     | `tests/orchestrators/marketplace/remove.messaging.test.ts`     | `MISSING`       | Open   |
| P113-12 | `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`               | `tests/orchestrators/marketplace/shared.test.ts`               | `COVERAGE_FAIL` | Open   |
| P113-13 | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`     | `tests/orchestrators/marketplace/update.messaging.test.ts`     | `MISSING`       | Open   |
| P113-14 | `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts`                      | `tests/orchestrators/plugin-path.test.ts`                      | `MISSING`       | Open   |
| P113-15 | `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`               | `tests/orchestrators/plugin/clone-cache.test.ts`               | `COVERAGE_FAIL` | Open   |
| P113-16 | `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts`                  | `tests/orchestrators/plugin/clone-gc.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P113-17 | `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`            | `tests/orchestrators/plugin/discover-names.test.ts`            | `MISSING`       | Open   |
| P113-18 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts`  | `tests/orchestrators/plugin/enable-disable.messaging.test.ts`  | `MISSING`       | Open   |
| P113-19 | `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts`           | `tests/orchestrators/plugin/fetch.messaging.test.ts`           | `MISSING`       | Open   |
| P113-20 | `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts`          | `tests/orchestrators/plugin/git-source-probe.test.ts`          | `COVERAGE_FAIL` | Open   |
| P113-21 | `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts`            | `tests/orchestrators/plugin/info.messaging.test.ts`            | `MISSING`       | Open   |
| P113-22 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`         | `tests/orchestrators/plugin/install.messaging.test.ts`         | `MISSING`       | Open   |
| P113-23 | `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`            | `tests/orchestrators/plugin/list.messaging.test.ts`            | `MISSING`       | Open   |
| P113-24 | `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts`   | `tests/orchestrators/plugin/plugin-state-classifier.test.ts`   | `COVERAGE_FAIL` | Open   |
| P113-25 | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`       | `tests/orchestrators/plugin/reinstall.messaging.test.ts`       | `MISSING`       | Open   |
| P113-26 | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`                    | `tests/orchestrators/plugin/shared.test.ts`                    | `COVERAGE_FAIL` | Open   |
| P113-27 | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts`       | `tests/orchestrators/plugin/uninstall.messaging.test.ts`       | `MISSING`       | Open   |
| P113-28 | `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`                | `tests/orchestrators/plugin/update-row.test.ts`                | `MISSING`       | Open   |
| P113-29 | `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`          | `tests/orchestrators/plugin/update.messaging.test.ts`          | `MISSING`       | Open   |
| P113-30 | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`         | `tests/orchestrators/reconcile/apply-outcomes.test.ts`         | `MISSING`       | Open   |
| P113-31 | `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`                   | `tests/orchestrators/reconcile/plan.test.ts`                   | `COVERAGE_FAIL` | Open   |
| P113-32 | `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`    | `tests/orchestrators/reconcile/reconcile.messaging.test.ts`    | `MISSING`       | Open   |
| P113-33 | `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`                  | `tests/orchestrators/reconcile/types.test.ts`                  | `MISSING`       | Open   |
| P113-34 | `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts`                     | `tests/orchestrators/scope-fanout.test.ts`                     | `MISSING`       | Open   |
| P113-35 | `extensions/pi-claude-marketplace/orchestrators/types.ts`                            | `tests/orchestrators/types.test.ts`                            | `MISSING`       | Open   |

### Phase 114: Plugin and Marketplace Lifecycle

| Pair    | Production source                                                          | Mirrored owner test                                  | HEAD triage     | Status |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | --------------- | ------ |
| P114-01 | `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`        | `tests/orchestrators/marketplace/add.test.ts`        | `TEST_FAIL`     | Open   |
| P114-02 | `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | `tests/orchestrators/marketplace/autoupdate.test.ts` | `COVERAGE_FAIL` | Open   |
| P114-03 | `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`       | `tests/orchestrators/marketplace/info.test.ts`       | `PASS`          | Open   |
| P114-04 | `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`       | `tests/orchestrators/marketplace/list.test.ts`       | `PASS`          | Open   |
| P114-05 | `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`     | `tests/orchestrators/marketplace/remove.test.ts`     | `COVERAGE_FAIL` | Open   |
| P114-06 | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`     | `tests/orchestrators/marketplace/update.test.ts`     | `COVERAGE_FAIL` | Open   |
| P114-07 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`  | `tests/orchestrators/plugin/enable-disable.test.ts`  | `COVERAGE_FAIL` | Open   |
| P114-08 | `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`           | `tests/orchestrators/plugin/fetch.test.ts`           | `COVERAGE_FAIL` | Open   |
| P114-09 | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`            | `tests/orchestrators/plugin/info.test.ts`            | `COVERAGE_FAIL` | Open   |
| P114-10 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`         | `tests/orchestrators/plugin/install.test.ts`         | `COVERAGE_FAIL` | Open   |
| P114-11 | `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`            | `tests/orchestrators/plugin/list.test.ts`            | `COVERAGE_FAIL` | Open   |
| P114-12 | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`       | `tests/orchestrators/plugin/reinstall.test.ts`       | `COVERAGE_FAIL` | Open   |
| P114-13 | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`       | `tests/orchestrators/plugin/uninstall.test.ts`       | `COVERAGE_FAIL` | Open   |
| P114-14 | `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`          | `tests/orchestrators/plugin/update.test.ts`          | `TEST_FAIL`     | Open   |

### Phase 115: Composition Orchestrators

| Pair    | Production source                                                      | Mirrored owner test                              | HEAD triage     | Status |
| ------- | ---------------------------------------------------------------------- | ------------------------------------------------ | --------------- | ------ |
| P115-01 | `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`          | `tests/orchestrators/edge-deps.test.ts`          | `PASS`          | Open   |
| P115-02 | `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`     | `tests/orchestrators/import/execute.test.ts`     | `COVERAGE_FAIL` | Open   |
| P115-03 | `extensions/pi-claude-marketplace/orchestrators/import/index.ts`       | `tests/orchestrators/import/index.test.ts`       | `MISSING`       | Open   |
| P115-04 | `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts`   | `tests/orchestrators/plugin/bootstrap.test.ts`   | `PASS`          | Open   |
| P115-05 | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`    | `tests/orchestrators/reconcile/apply.test.ts`    | `COVERAGE_FAIL` | Open   |
| P115-06 | `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` | `tests/orchestrators/reconcile/backfill.test.ts` | `COVERAGE_FAIL` | Open   |
| P115-07 | `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`   | `tests/orchestrators/reconcile/notify.test.ts`   | `COVERAGE_FAIL` | Open   |
| P115-08 | `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`  | `tests/orchestrators/reconcile/pending.test.ts`  | `COVERAGE_FAIL` | Open   |

### Phase 116: Edge Surface

| Pair    | Production source                                                          | Mirrored owner test                                  | HEAD triage     | Status |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | --------------- | ------ |
| P116-01 | `extensions/pi-claude-marketplace/edge/args-schema.ts`                     | `tests/edge/args-schema.test.ts`                     | `PASS`          | Open   |
| P116-02 | `extensions/pi-claude-marketplace/edge/args.ts`                            | `tests/edge/args.test.ts`                            | `COVERAGE_FAIL` | Open   |
| P116-03 | `extensions/pi-claude-marketplace/edge/completions/data.ts`                | `tests/edge/completions/data.test.ts`                | `COVERAGE_FAIL` | Open   |
| P116-04 | `extensions/pi-claude-marketplace/edge/completions/normalize.ts`           | `tests/edge/completions/normalize.test.ts`           | `COVERAGE_FAIL` | Open   |
| P116-05 | `extensions/pi-claude-marketplace/edge/completions/provider.ts`            | `tests/edge/completions/provider.test.ts`            | `COVERAGE_FAIL` | Open   |
| P116-06 | `extensions/pi-claude-marketplace/edge/flag-catalog.ts`                    | `tests/edge/flag-catalog.test.ts`                    | `MISSING`       | Open   |
| P116-07 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`        | `tests/edge/handlers/marketplace/add.test.ts`        | `PASS`          | Open   |
| P116-08 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | `tests/edge/handlers/marketplace/autoupdate.test.ts` | `COVERAGE_FAIL` | Open   |
| P116-09 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts`       | `tests/edge/handlers/marketplace/info.test.ts`       | `PASS`          | Open   |
| P116-10 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts`       | `tests/edge/handlers/marketplace/list.test.ts`       | `COVERAGE_FAIL` | Open   |
| P116-11 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts`     | `tests/edge/handlers/marketplace/remove.test.ts`     | `PASS`          | Open   |
| P116-12 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`     | `tests/edge/handlers/marketplace/shared.test.ts`     | `MISSING`       | Open   |
| P116-13 | `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`     | `tests/edge/handlers/marketplace/update.test.ts`     | `COVERAGE_FAIL` | Open   |
| P116-14 | `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`       | `tests/edge/handlers/plugin/bootstrap.test.ts`       | `PASS`          | Open   |
| P116-15 | `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts`  | `tests/edge/handlers/plugin/enable-disable.test.ts`  | `COVERAGE_FAIL` | Open   |
| P116-16 | `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts`           | `tests/edge/handlers/plugin/fetch.test.ts`           | `PASS`          | Open   |
| P116-17 | `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`          | `tests/edge/handlers/plugin/import.test.ts`          | `MISSING`       | Open   |
| P116-18 | `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts`            | `tests/edge/handlers/plugin/info.test.ts`            | `PASS`          | Open   |
| P116-19 | `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts`         | `tests/edge/handlers/plugin/install.test.ts`         | `COVERAGE_FAIL` | Open   |
| P116-20 | `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`            | `tests/edge/handlers/plugin/list.test.ts`            | `COVERAGE_FAIL` | Open   |
| P116-21 | `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts`         | `tests/edge/handlers/plugin/pending.test.ts`         | `COVERAGE_FAIL` | Open   |
| P116-22 | `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts`       | `tests/edge/handlers/plugin/reinstall.test.ts`       | `COVERAGE_FAIL` | Open   |
| P116-23 | `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts`          | `tests/edge/handlers/plugin/shared.test.ts`          | `MISSING`       | Open   |
| P116-24 | `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts`       | `tests/edge/handlers/plugin/uninstall.test.ts`       | `PASS`          | Open   |
| P116-25 | `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts`          | `tests/edge/handlers/plugin/update.test.ts`          | `COVERAGE_FAIL` | Open   |
| P116-26 | `extensions/pi-claude-marketplace/edge/handlers/shared.ts`                 | `tests/edge/handlers/shared.test.ts`                 | `COVERAGE_FAIL` | Open   |
| P116-27 | `extensions/pi-claude-marketplace/edge/handlers/tools.ts`                  | `tests/edge/handlers/tools.test.ts`                  | `COVERAGE_FAIL` | Open   |
| P116-28 | `extensions/pi-claude-marketplace/edge/register.ts`                        | `tests/edge/register.test.ts`                        | `COVERAGE_FAIL` | Open   |
| P116-29 | `extensions/pi-claude-marketplace/edge/router.ts`                          | `tests/edge/router.test.ts`                          | `COVERAGE_FAIL` | Open   |
| P116-30 | `extensions/pi-claude-marketplace/edge/types.ts`                           | `tests/edge/types.test.ts`                           | `MISSING`       | Open   |

### Phase 117: Extension Entry and Final Gate

| Pair    | Production source                           | Mirrored owner test   | HEAD triage | Status |
| ------- | ------------------------------------------- | --------------------- | ----------- | ------ |
| P117-01 | `extensions/pi-claude-marketplace/index.ts` | `tests/index.test.ts` | `MISSING`   | Open   |

## Future Requirements

None. This milestone covers the complete unit-test refactor.

## Out of Scope

| Feature                                         | Reason                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| New product features                            | The milestone preserves behavior except for the required resolver safety discriminant.     |
| Live remote services in unit tests              | The testing guidelines require hermetic tests.                                             |
| Completion credit from retained commits         | Existing work is brownfield input, not new pair-plan evidence.                             |
| The preservation kit or abandoned patch         | The handoff prohibits executing or reproducing them.                                       |
| Historical module splits and migration comments | Plans must start from current HEAD responsibilities.                                       |
| Bulk multi-pair plans or commits                | The milestone requires one source-test pair per executable plan and implementation commit. |
| A verification-only closure plan                | Final global gates travel with the root extension pair.                                    |

## Traceability

No v1.19 requirement is complete at the brownfield baseline. Requirements that
apply to the full inventory close with the Phase 117 root-pair repository gates.

| Requirement | Phase     | Status   |
| ----------- | --------- | -------- |
| OWN-01      | Phase 117 | Pending  |
| OWN-02      | Phase 117 | Pending  |
| OWN-03      | Phase 117 | Pending  |
| OWN-04      | Phase 117 | Pending  |
| OWN-05      | Phase 117 | Pending  |
| OWN-06      | Phase 117 | Pending  |
| CASE-01     | Phase 117 | Pending  |
| CASE-02     | Phase 117 | Pending  |
| CASE-03     | Phase 117 | Pending  |
| CASE-04     | Phase 117 | Pending  |
| TEST-01     | Phase 117 | Pending  |
| TEST-02     | Phase 117 | Pending  |
| TEST-03     | Phase 117 | Pending  |
| TEST-04     | Phase 117 | Pending  |
| TEST-05     | Phase 117 | Pending  |
| COV-01      | Phase 117 | Pending  |
| COV-02      | Phase 117 | Pending  |
| COV-03      | Phase 117 | Pending  |
| COV-04      | Phase 117 | Pending  |
| COV-05      | Phase 117 | Pending  |
| DES-01      | Phase 117 | Pending  |
| DES-02      | Phase 117 | Pending  |
| DES-03      | Phase 117 | Pending  |
| RES-01      | Phase 108 | Complete |
| DEL-01      | Phase 117 | Pending  |
| DEL-02      | Phase 117 | Pending  |
| DEL-03      | Phase 117 | Pending  |
| DEL-04      | Phase 117 | Pending  |
| MOD-01      | Phase 108 | Complete |
| MOD-02      | Phase 109 | Complete |
| MOD-03      | Phase 110 | Complete |
| MOD-04      | Phase 111 | Complete |
| MOD-05      | Phase 112 | Complete |
| MOD-06      | Phase 113 | Pending  |
| MOD-07      | Phase 114 | Pending  |
| MOD-08      | Phase 115 | Pending  |
| MOD-09      | Phase 116 | Pending  |
| MOD-10      | Phase 117 | Pending  |
| PRES-01     | Phase 117 | Pending  |
| PRES-02     | Phase 117 | Pending  |
| PRES-03     | Phase 108 | Complete |
| PRES-04     | Phase 108 | Complete |
| SUITE-01    | Phase 117 | Pending  |
| SUITE-02    | Phase 117 | Pending  |
| SUITE-03    | Phase 117 | Pending  |
| SUITE-04    | Phase 117 | Pending  |
| SUITE-05    | Phase 117 | Pending  |
| SUITE-06    | Phase 117 | Pending  |

**Coverage:**

- v1.19 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---

_Requirements defined: 2026-08-28_
_Last updated: 2026-08-28 after the repository-at-HEAD scope rebuild_
