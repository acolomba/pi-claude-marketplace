# Roadmap: Unit Test Refactor

**Milestone:** v1.19
**Created:** 2026-08-28
**Granularity:** Standard
**Phases:** 10
**Pair plans:** 204
**Requirements:** 48

## Overview

This milestone gives every production TypeScript module one mirrored owner test.
Work moves from foundational contracts to the extension entry point. Each pair
must preserve the behavior and module responsibility that exist at HEAD.

Every executable PLAN and every implementation commit owns exactly one
production source-test pair. A retained commit or a HEAD triage label never marks
a pair complete.

There is no verification-only, foundation-only, suite-closure-only, or migration
plan. Cross-cutting changes and gates are acceptance criteria or supporting work
carried by an owning pair. The Phase 117 root index pair carries the final
repository gates.

The roadmap does not restore the preservation kit, abandoned patch, former
module layout, migration-history comments, ownership registry, exemptions,
sharded coverage, or a generic helper structure. Every pair must preserve public
behavior, public surfaces, persistence formats, and adapter contracts. The
resolver pair adds `installable: true | false` and keeps the three-way `state` as
secondary detail.

## Phases

- [x] **Phase 108: Domain and Platform** - Prove 23 foundational contracts and the resolver and adapter carriers.
- [x] **Phase 109: Shared Contracts** - Prove 19 shared value, error, path, environment, and notification contracts. (completed 2026-08-29)
- [x] **Phase 110: Persistence and Transaction** - Prove 12 durable-state, migration, ledger, rollback, and retry contracts. (completed 2026-08-30)
- [x] **Phase 111: Non-Hook Component Bridges** - Prove 31 agents, commands, MCP, and skills bridge contracts. (completed 2026-08-30)
- [ ] **Phase 112: Hook Runtime** - Prove 31 hook routing, payload, process, timer, and lifecycle contracts.
- [ ] **Phase 113: Orchestrator Support and Presenters** - Prove 35 helper, classifier, planner, and message contracts.
- [ ] **Phase 114: Plugin and Marketplace Lifecycle** - Prove 14 state-changing lifecycle workflows.
- [ ] **Phase 115: Composition Orchestrators** - Prove eight import, bootstrap, dependency, and reconcile compositions.
- [ ] **Phase 116: Edge Surface** - Prove 30 command parsing, completion, handler, tool, and dispatch contracts.
- [ ] **Phase 117: Extension Entry and Final Gate** - Prove the root entry pair and close all repository-wide gates.

## Phase Details

### Phase 108: Domain and Platform

**Goal**: Maintainers can rely on every domain and platform module through a compliant mirrored test and preserved public contract.

**Depends on**: Nothing

**Requirements**: MOD-01, RES-01, PRES-03, PRES-04

**Success Criteria** (what must be TRUE):

1. Each of the 23 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Resolver consumers narrow on `installable: true | false`, and only a true arm exposes `pluginRoot`. The `state` field keeps its three distinctions.
3. Production and fake Git, credential, and device-flow adapters pass the same public contract cases, including an independent broken-adapter control.
4. Domain and platform tests run without live network access, developer credentials, or test-only production exports.

**Plans**: 23/23 plans executed

Plans:

- [x] 108-01-PLAN.md
- [x] 108-02-PLAN.md
- [x] 108-03-PLAN.md
- [x] 108-04-PLAN.md
- [x] 108-05-PLAN.md
- [x] 108-06-PLAN.md
- [x] 108-07-PLAN.md
- [x] 108-08-PLAN.md
- [x] 108-09-PLAN.md
- [x] 108-10-PLAN.md
- [x] 108-11-PLAN.md
- [x] 108-12-PLAN.md
- [x] 108-13-PLAN.md
- [x] 108-14-PLAN.md
- [x] 108-15-PLAN.md
- [x] 108-16-PLAN.md
- [x] 108-17-PLAN.md
- [x] 108-18-PLAN.md
- [x] 108-19-PLAN.md
- [x] 108-20-PLAN.md
- [x] 108-21-PLAN.md
- [x] 108-22-PLAN.md
- [x] 108-23-PLAN.md

- [x] **108-01** (`108-01-PLAN.md`, `P108-01`) - `extensions/pi-claude-marketplace/domain/auth-registry.ts` → `tests/domain/auth-registry.test.ts`
- [x] **108-02** (`108-02-PLAN.md`, `P108-02`) - `extensions/pi-claude-marketplace/domain/clone-key.ts` → `tests/domain/clone-key.test.ts`
- [x] **108-03** (`108-03-PLAN.md`, `P108-03`) - `extensions/pi-claude-marketplace/domain/components/hook-events.ts` → `tests/domain/components/hook-events.test.ts`
- [x] **108-04** (`108-04-PLAN.md`, `P108-04`) - `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` → `tests/domain/components/hook-if-targets.test.ts`
- [x] **108-05** (`108-05-PLAN.md`, `P108-05`) - `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` → `tests/domain/components/hook-tool-names.test.ts`
- [x] **108-06** (`108-06-PLAN.md`, `P108-06`) - `extensions/pi-claude-marketplace/domain/components/hooks.ts` → `tests/domain/components/hooks.test.ts`
- [x] **108-07** (`108-07-PLAN.md`, `P108-07`) - `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` → `tests/domain/components/hooks/matcher.test.ts`
- [x] **108-08** (`108-08-PLAN.md`, `P108-08`) - `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts` → `tests/domain/components/hooks/partition.test.ts`
- [x] **108-09** (`108-09-PLAN.md`, `P108-09`) - `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts` → `tests/domain/components/hooks/schema.test.ts`
- [x] **108-10** (`108-10-PLAN.md`, `P108-10`) - `extensions/pi-claude-marketplace/domain/components/mcp.ts` → `tests/domain/components/mcp.test.ts`
- [x] **108-11** (`108-11-PLAN.md`, `P108-11`) - `extensions/pi-claude-marketplace/domain/components/plugin.ts` → `tests/domain/components/plugin.test.ts`
- [x] **108-12** (`108-12-PLAN.md`, `P108-12`) - `extensions/pi-claude-marketplace/domain/github-auth.ts` → `tests/domain/github-auth.test.ts`
- [x] **108-13** (`108-13-PLAN.md`, `P108-13`) - `extensions/pi-claude-marketplace/domain/manifest-cache.ts` → `tests/domain/manifest-cache.test.ts`
- [x] **108-14** (`108-14-PLAN.md`, `P108-14`) - `extensions/pi-claude-marketplace/domain/manifest-lookup.ts` → `tests/domain/manifest-lookup.test.ts`
- [x] **108-15** (`108-15-PLAN.md`, `P108-15`) - `extensions/pi-claude-marketplace/domain/manifest.ts` → `tests/domain/manifest.test.ts`
- [x] **108-16** (`108-16-PLAN.md`, `P108-16`) - `extensions/pi-claude-marketplace/domain/name.ts` → `tests/domain/name.test.ts`
- [x] **108-17** (`108-17-PLAN.md`, `P108-17`) - `extensions/pi-claude-marketplace/domain/plugin-root.ts` → `tests/domain/plugin-root.test.ts`
- [x] **108-18** (`108-18-PLAN.md`, `P108-18`) - `extensions/pi-claude-marketplace/domain/resolver.ts` → `tests/domain/resolver.test.ts`
- [x] **108-19** (`108-19-PLAN.md`, `P108-19`) - `extensions/pi-claude-marketplace/domain/source.ts` → `tests/domain/source.test.ts`
- [x] **108-20** (`108-20-PLAN.md`, `P108-20`) - `extensions/pi-claude-marketplace/domain/version.ts` → `tests/domain/version.test.ts`
- [x] **108-21** (`108-21-PLAN.md`, `P108-21`) - `extensions/pi-claude-marketplace/platform/git-credential.ts` → `tests/platform/git-credential.test.ts`
- [x] **108-22** (`108-22-PLAN.md`, `P108-22`) - `extensions/pi-claude-marketplace/platform/git.ts` → `tests/platform/git.test.ts`
- [x] **108-23** (`108-23-PLAN.md`, `P108-23`) - `extensions/pi-claude-marketplace/platform/pi-api.ts` → `tests/platform/pi-api.test.ts`

### Phase 109: Shared Contracts

**Goal**: Maintainers can rely on every shared module through exact public-value and side-effect contracts.

**Depends on**: Phase 108

**Requirements**: MOD-02

**Success Criteria** (what must be TRUE):

1. Each of the 19 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Error, reason, notification, marker, and environment cases assert complete public values and exact output bytes.
3. Tests own and restore filesystem, environment, cache, and notification state without a generic helper directory.
4. Shared modules keep their current public surface and expose no test-only state or reset operation.

**Plans**: 19/19 plans executed

Plans:

- [x] 109-01-PLAN.md
- [x] 109-02-PLAN.md
- [x] 109-03-PLAN.md
- [x] 109-04-PLAN.md
- [x] 109-05-PLAN.md
- [x] 109-06-PLAN.md
- [x] 109-07-PLAN.md
- [x] 109-08-PLAN.md
- [x] 109-09-PLAN.md
- [x] 109-10-PLAN.md
- [x] 109-11-PLAN.md
- [x] 109-12-PLAN.md
- [x] 109-13-PLAN.md
- [x] 109-14-PLAN.md
- [x] 109-15-PLAN.md
- [x] 109-16-PLAN.md
- [x] 109-17-PLAN.md
- [x] 109-18-PLAN.md
- [x] 109-19-PLAN.md

- [x] **109-01** (`109-01-PLAN.md`, `P109-01`) - `extensions/pi-claude-marketplace/shared/atomic-json.ts` → `tests/shared/atomic-json.test.ts`
- [x] **109-02** (`109-02-PLAN.md`, `P109-02`) - `extensions/pi-claude-marketplace/shared/completion-cache.ts` → `tests/shared/completion-cache.test.ts`
- [x] **109-03** (`109-03-PLAN.md`, `P109-03`) - `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` → `tests/shared/concerns/hooks.test.ts`
- [x] **109-04** (`109-04-PLAN.md`, `P109-04`) - `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` → `tests/shared/concerns/soft-dep.test.ts`
- [x] **109-05** (`109-05-PLAN.md`, `P109-05`) - `extensions/pi-claude-marketplace/shared/debug-log.ts` → `tests/shared/debug-log.test.ts`
- [x] **109-06** (`109-06-PLAN.md`, `P109-06`) - `extensions/pi-claude-marketplace/shared/errors-bridges.ts` → `tests/shared/errors-bridges.test.ts`
- [x] **109-07** (`109-07-PLAN.md`, `P109-07`) - `extensions/pi-claude-marketplace/shared/errors.ts` → `tests/shared/errors.test.ts`
- [x] **109-08** (`109-08-PLAN.md`, `P109-08`) - `extensions/pi-claude-marketplace/shared/extension-version.ts` → `tests/shared/extension-version.test.ts`
- [x] **109-09** (`109-09-PLAN.md`, `P109-09`) - `extensions/pi-claude-marketplace/shared/fs-utils.ts` → `tests/shared/fs-utils.test.ts`
- [x] **109-10** (`109-10-PLAN.md`, `P109-10`) - `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` → `tests/shared/git-failure-classifiers.test.ts`
- [x] **109-11** (`109-11-PLAN.md`, `P109-11`) - `extensions/pi-claude-marketplace/shared/markers.ts` → `tests/shared/markers.test.ts`
- [x] **109-12** (`109-12-PLAN.md`, `P109-12`) - `extensions/pi-claude-marketplace/shared/notify-context.ts` → `tests/shared/notify-context.test.ts`
- [x] **109-13** (`109-13-PLAN.md`, `P109-13`) - `extensions/pi-claude-marketplace/shared/notify-reasons.ts` → `tests/shared/notify-reasons.test.ts`
- [x] **109-14** (`109-14-PLAN.md`, `P109-14`) - `extensions/pi-claude-marketplace/shared/notify.ts` → `tests/shared/notify.test.ts`
- [x] **109-15** (`109-15-PLAN.md`, `P109-15`) - `extensions/pi-claude-marketplace/shared/path-safety.ts` → `tests/shared/path-safety.test.ts`
- [x] **109-16** (`109-16-PLAN.md`, `P109-16`) - `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` → `tests/shared/probe-classifiers.test.ts`
- [x] **109-17** (`109-17-PLAN.md`, `P109-17`) - `extensions/pi-claude-marketplace/shared/session-env.ts` → `tests/shared/session-env.test.ts`
- [x] **109-18** (`109-18-PLAN.md`, `P109-18`) - `extensions/pi-claude-marketplace/shared/types.ts` → `tests/shared/types.test.ts`
- [x] **109-19** (`109-19-PLAN.md`, `P109-19`) - `extensions/pi-claude-marketplace/shared/vars.ts` → `tests/shared/vars.test.ts`

**Cross-cutting constraints:**

- Every runtime case created or changed uses separate lowercase phase markers and case-owned mutable state; type-only evidence follows D-03 (D-02, D-03, D-04).

### Phase 110: Persistence and Transaction

**Goal**: Maintainers can change durable-state and transaction modules with direct proof that replay and recovery behavior stay stable.

**Depends on**: Phase 109

**Requirements**: MOD-03

**Success Criteria** (what must be TRUE):

1. Each of the 12 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. State, configuration, index, and migration cases preserve accepted stored formats and replay outcomes.
3. Ledger, guard, and rollback cases prove atomic replacement, failure isolation, idempotency, and retry behavior through public effects.
4. Each filesystem case owns and removes its temporary directory, including corrupt-input and partial-failure cases.

**Plans**: 12/12 plans executed

Plans:

- [x] 110-01-PLAN.md
- [x] 110-02-PLAN.md
- [x] 110-03-PLAN.md
- [x] 110-04-PLAN.md
- [x] 110-05-PLAN.md
- [x] 110-06-PLAN.md
- [x] 110-07-PLAN.md
- [x] 110-08-PLAN.md
- [x] 110-09-PLAN.md
- [x] 110-10-PLAN.md
- [x] 110-11-PLAN.md
- [x] 110-12-PLAN.md

- [x] **110-01** (`110-01-PLAN.md`, `P110-01`) - `extensions/pi-claude-marketplace/persistence/agents-index-io.ts` → `tests/persistence/agents-index-io.test.ts`
- [x] **110-02** (`110-02-PLAN.md`, `P110-02`) - `extensions/pi-claude-marketplace/persistence/agents-index-schema.ts` → `tests/persistence/agents-index-schema.test.ts`
- [x] **110-03** (`110-03-PLAN.md`, `P110-03`) - `extensions/pi-claude-marketplace/persistence/config-io.ts` → `tests/persistence/config-io.test.ts`
- [x] **110-04** (`110-04-PLAN.md`, `P110-04`) - `extensions/pi-claude-marketplace/persistence/config-merge.ts` → `tests/persistence/config-merge.test.ts`
- [x] **110-05** (`110-05-PLAN.md`, `P110-05`) - `extensions/pi-claude-marketplace/persistence/config-write-back.ts` → `tests/persistence/config-write-back.test.ts`
- [x] **110-06** (`110-06-PLAN.md`, `P110-06`) - `extensions/pi-claude-marketplace/persistence/locations.ts` → `tests/persistence/locations.test.ts`
- [x] **110-07** (`110-07-PLAN.md`, `P110-07`) - `extensions/pi-claude-marketplace/persistence/migrate-config.ts` → `tests/persistence/migrate-config.test.ts`
- [x] **110-08** (`110-08-PLAN.md`, `P110-08`) - `extensions/pi-claude-marketplace/persistence/migrate.ts` → `tests/persistence/migrate.test.ts`
- [x] **110-09** (`110-09-PLAN.md`, `P110-09`) - `extensions/pi-claude-marketplace/persistence/state-io.ts` → `tests/persistence/state-io.test.ts`
- [x] **110-10** (`110-10-PLAN.md`, `P110-10`) - `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` → `tests/transaction/phase-ledger.test.ts`
- [x] **110-11** (`110-11-PLAN.md`, `P110-11`) - `extensions/pi-claude-marketplace/transaction/rollback.ts` → `tests/transaction/rollback.test.ts`
- [x] **110-12** (`110-12-PLAN.md`, `P110-12`) - `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` → `tests/transaction/with-state-guard.test.ts`

### Phase 111: Non-Hook Component Bridges

**Goal**: Plugin agents, commands, MCP servers, and skills keep their complete conversion and lifecycle behavior under direct owner tests.

**Depends on**: Phase 110

**Requirements**: MOD-04

**Success Criteria** (what must be TRUE):

1. Each of the 31 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Discovery and conversion cases preserve generated names, frontmatter, substitutions, diagnostics, and component bytes.
3. Staging and unstage cases preserve atomic replacement, rollback, containment, and foreign-content behavior in case-owned temporary trees.
4. Barrel and type-only bridge modules have direct binding or compile-time owner tests without runtime exemptions.

**Plans**: 31/31 plans executed

Plans:

- [x] 111-01-PLAN.md
- [x] 111-02-PLAN.md
- [x] 111-03-PLAN.md
- [x] 111-04-PLAN.md
- [x] 111-05-PLAN.md
- [x] 111-06-PLAN.md
- [x] 111-07-PLAN.md
- [x] 111-08-PLAN.md
- [x] 111-09-PLAN.md
- [x] 111-10-PLAN.md
- [x] 111-11-PLAN.md
- [x] 111-12-PLAN.md
- [x] 111-13-PLAN.md
- [x] 111-14-PLAN.md
- [x] 111-15-PLAN.md
- [x] 111-16-PLAN.md
- [x] 111-17-PLAN.md
- [x] 111-18-PLAN.md
- [x] 111-19-PLAN.md
- [x] 111-20-PLAN.md
- [x] 111-21-PLAN.md
- [x] 111-22-PLAN.md
- [x] 111-23-PLAN.md
- [x] 111-24-PLAN.md
- [x] 111-25-PLAN.md
- [x] 111-26-PLAN.md
- [x] 111-27-PLAN.md
- [x] 111-28-PLAN.md
- [x] 111-29-PLAN.md
- [x] 111-30-PLAN.md
- [x] 111-31-PLAN.md

- [x] **111-01** (`111-01-PLAN.md`, `P111-01`) - `extensions/pi-claude-marketplace/bridges/agents/convert.ts` → `tests/bridges/agents/convert.test.ts`
- [x] **111-02** (`111-02-PLAN.md`, `P111-02`) - `extensions/pi-claude-marketplace/bridges/agents/discover.ts` → `tests/bridges/agents/discover.test.ts`
- [x] **111-03** (`111-03-PLAN.md`, `P111-03`) - `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` → `tests/bridges/agents/frontmatter.test.ts`
- [x] **111-04** (`111-04-PLAN.md`, `P111-04`) - `extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts` → `tests/bridges/agents/index-mutation.test.ts`
- [x] **111-05** (`111-05-PLAN.md`, `P111-05`) - `extensions/pi-claude-marketplace/bridges/agents/index.ts` → `tests/bridges/agents/index.test.ts`
- [x] **111-06** (`111-06-PLAN.md`, `P111-06`) - `extensions/pi-claude-marketplace/bridges/agents/marker.ts` → `tests/bridges/agents/marker.test.ts`
- [x] **111-07** (`111-07-PLAN.md`, `P111-07`) - `extensions/pi-claude-marketplace/bridges/agents/stage.ts` → `tests/bridges/agents/stage.test.ts`
- [x] **111-08** (`111-08-PLAN.md`, `P111-08`) - `extensions/pi-claude-marketplace/bridges/agents/types.ts` → `tests/bridges/agents/types.test.ts`
- [x] **111-09** (`111-09-PLAN.md`, `P111-09`) - `extensions/pi-claude-marketplace/bridges/agents/unstage.ts` → `tests/bridges/agents/unstage.test.ts`
- [x] **111-10** (`111-10-PLAN.md`, `P111-10`) - `extensions/pi-claude-marketplace/bridges/commands/discover.ts` → `tests/bridges/commands/discover.test.ts`
- [x] **111-11** (`111-11-PLAN.md`, `P111-11`) - `extensions/pi-claude-marketplace/bridges/commands/index.ts` → `tests/bridges/commands/index.test.ts`
- [x] **111-12** (`111-12-PLAN.md`, `P111-12`) - `extensions/pi-claude-marketplace/bridges/commands/stage.ts` → `tests/bridges/commands/stage.test.ts`
- [x] **111-13** (`111-13-PLAN.md`, `P111-13`) - `extensions/pi-claude-marketplace/bridges/commands/types.ts` → `tests/bridges/commands/types.test.ts`
- [x] **111-14** (`111-14-PLAN.md`, `P111-14`) - `extensions/pi-claude-marketplace/bridges/commands/unstage.ts` → `tests/bridges/commands/unstage.test.ts`
- [x] **111-15** (`111-15-PLAN.md`, `P111-15`) - `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts` → `tests/bridges/mcp/collision-slots.test.ts`
- [x] **111-16** (`111-16-PLAN.md`, `P111-16`) - `extensions/pi-claude-marketplace/bridges/mcp/index.ts` → `tests/bridges/mcp/index.test.ts`
- [x] **111-17** (`111-17-PLAN.md`, `P111-17`) - `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` → `tests/bridges/mcp/marker.test.ts`
- [x] **111-18** (`111-18-PLAN.md`, `P111-18`) - `extensions/pi-claude-marketplace/bridges/mcp/parse.ts` → `tests/bridges/mcp/parse.test.ts`
- [x] **111-19** (`111-19-PLAN.md`, `P111-19`) - `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts` → `tests/bridges/mcp/safe-set.test.ts`
- [x] **111-20** (`111-20-PLAN.md`, `P111-20`) - `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` → `tests/bridges/mcp/stage.test.ts`
- [x] **111-21** (`111-21-PLAN.md`, `P111-21`) - `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts` → `tests/bridges/mcp/substitute.test.ts`
- [x] **111-22** (`111-22-PLAN.md`, `P111-22`) - `extensions/pi-claude-marketplace/bridges/mcp/types.ts` → `tests/bridges/mcp/types.test.ts`
- [x] **111-23** (`111-23-PLAN.md`, `P111-23`) - `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` → `tests/bridges/mcp/unstage.test.ts`
- [x] **111-24** (`111-24-PLAN.md`, `P111-24`) - `extensions/pi-claude-marketplace/bridges/skills/discover.ts` → `tests/bridges/skills/discover.test.ts`
- [x] **111-25** (`111-25-PLAN.md`, `P111-25`) - `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` → `tests/bridges/skills/frontmatter-degrade.test.ts`
- [x] **111-26** (`111-26-PLAN.md`, `P111-26`) - `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts` → `tests/bridges/skills/frontmatter-scan.test.ts`
- [x] **111-27** (`111-27-PLAN.md`, `P111-27`) - `extensions/pi-claude-marketplace/bridges/skills/index.ts` → `tests/bridges/skills/index.test.ts`
- [x] **111-28** (`111-28-PLAN.md`, `P111-28`) - `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` → `tests/bridges/skills/rewrite-frontmatter.test.ts`
- [x] **111-29** (`111-29-PLAN.md`, `P111-29`) - `extensions/pi-claude-marketplace/bridges/skills/stage.ts` → `tests/bridges/skills/stage.test.ts`
- [x] **111-30** (`111-30-PLAN.md`, `P111-30`) - `extensions/pi-claude-marketplace/bridges/skills/types.ts` → `tests/bridges/skills/types.test.ts`
- [x] **111-31** (`111-31-PLAN.md`, `P111-31`) - `extensions/pi-claude-marketplace/bridges/skills/unstage.ts` → `tests/bridges/skills/unstage.test.ts`

**Cross-cutting constraints:**

- Every runtime callback uses lowercase // arrange, blank line, // act, blank line, // assert. Use // act & assert only for one assert.throws or assert.rejects expression; data rows keep separate phases (D-06).
- Production behavior and exports remain unchanged; no test-only export, reset hook, state reader, mode, private seam, or second production owner is introduced (D-08, D-09).
- Keep all positive satisfies and targeted @ts-expect-error expressions at module scope. Add no runtime wrapper or phase comment (D-07).

### Phase 112: Hook Runtime

**Goal**: Hook routing and execution keep their public event, process, timer, and lifecycle contracts under direct owner tests.

**Depends on**: Phase 110

**Requirements**: MOD-05

**Success Criteria** (what must be TRUE):

1. Each of the 31 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Hook cases preserve payloads, matcher results, routing order, decision control, process results, and async rewake behavior.
3. Each case owns its router, process, session, environment, and timer state. Scheduling cases use test-context timers.
4. Hook metadata tables and internal types stay private unless current production callers use them.

**Plans**: 16/31 plans executed

Plans:

- [x] 112-01-PLAN.md
- [ ] 112-02-PLAN.md
- [x] 112-03-PLAN.md
- [ ] 112-04-PLAN.md
- [ ] 112-05-PLAN.md
- [ ] 112-06-PLAN.md
- [ ] 112-07-PLAN.md
- [x] 112-08-PLAN.md
- [x] 112-09-PLAN.md
- [x] 112-10-PLAN.md
- [ ] 112-11-PLAN.md
- [x] 112-12-PLAN.md
- [ ] 112-13-PLAN.md
- [ ] 112-14-PLAN.md
- [x] 112-15-PLAN.md
- [x] 112-16-PLAN.md
- [x] 112-17-PLAN.md
- [x] 112-18-PLAN.md
- [x] 112-19-PLAN.md
- [x] 112-20-PLAN.md
- [x] 112-21-PLAN.md
- [x] 112-22-PLAN.md
- [x] 112-23-PLAN.md
- [x] 112-24-PLAN.md
- [ ] 112-25-PLAN.md
- [ ] 112-26-PLAN.md
- [ ] 112-27-PLAN.md
- [ ] 112-28-PLAN.md
- [ ] 112-29-PLAN.md
- [ ] 112-30-PLAN.md
- [ ] 112-31-PLAN.md

- [x] **112-01** (`112-01-PLAN.md`, `P112-01`) - `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts` → `tests/bridges/hooks/async-rewake/pid-table.test.ts`
- [ ] **112-02** (`112-02-PLAN.md`, `P112-02`) - `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` → `tests/bridges/hooks/async-rewake/registry.test.ts`
- [x] **112-03** (`112-03-PLAN.md`, `P112-03`) - `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts` → `tests/bridges/hooks/async-rewake/ring-buffer.test.ts`
- [ ] **112-04** (`112-04-PLAN.md`, `P112-04`) - `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` → `tests/bridges/hooks/dispatch-exec.test.ts`
- [ ] **112-05** (`112-05-PLAN.md`, `P112-05`) - `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` → `tests/bridges/hooks/dispatch.test.ts`
- [ ] **112-06** (`112-06-PLAN.md`, `P112-06`) - `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` → `tests/bridges/hooks/event-adapters.test.ts`
- [ ] **112-07** (`112-07-PLAN.md`, `P112-07`) - `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` → `tests/bridges/hooks/event-router.test.ts`
- [x] **112-08** (`112-08-PLAN.md`, `P112-08`) - `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts` → `tests/bridges/hooks/exec-result.test.ts`
- [x] **112-09** (`112-09-PLAN.md`, `P112-09`) - `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` → `tests/bridges/hooks/exec-timer.test.ts`
- [x] **112-10** (`112-10-PLAN.md`, `P112-10`) - `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts` → `tests/bridges/hooks/hook-env.test.ts`
- [ ] **112-11** (`112-11-PLAN.md`, `P112-11`) - `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts` → `tests/bridges/hooks/if-field/bash.test.ts`
- [x] **112-12** (`112-12-PLAN.md`, `P112-12`) - `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts` → `tests/bridges/hooks/if-field/glob.test.ts`
- [ ] **112-13** (`112-13-PLAN.md`, `P112-13`) - `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` → `tests/bridges/hooks/if-field/index.test.ts`
- [ ] **112-14** (`112-14-PLAN.md`, `P112-14`) - `extensions/pi-claude-marketplace/bridges/hooks/index.ts` → `tests/bridges/hooks/index.test.ts`
- [x] **112-15** (`112-15-PLAN.md`, `P112-15`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts` → `tests/bridges/hooks/payloads/post-compact.test.ts`
- [x] **112-16** (`112-16-PLAN.md`, `P112-16`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` → `tests/bridges/hooks/payloads/post-tool-use-failure.test.ts`
- [x] **112-17** (`112-17-PLAN.md`, `P112-17`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts` → `tests/bridges/hooks/payloads/post-tool-use.test.ts`
- [x] **112-18** (`112-18-PLAN.md`, `P112-18`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts` → `tests/bridges/hooks/payloads/pre-compact.test.ts`
- [x] **112-19** (`112-19-PLAN.md`, `P112-19`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts` → `tests/bridges/hooks/payloads/pre-tool-use.test.ts`
- [x] **112-20** (`112-20-PLAN.md`, `P112-20`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts` → `tests/bridges/hooks/payloads/session-end.test.ts`
- [x] **112-21** (`112-21-PLAN.md`, `P112-21`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts` → `tests/bridges/hooks/payloads/session-start.test.ts`
- [x] **112-22** (`112-22-PLAN.md`, `P112-22`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts` → `tests/bridges/hooks/payloads/stop-failure.test.ts`
- [x] **112-23** (`112-23-PLAN.md`, `P112-23`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts` → `tests/bridges/hooks/payloads/stop.test.ts`
- [x] **112-24** (`112-24-PLAN.md`, `P112-24`) - `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts` → `tests/bridges/hooks/payloads/user-prompt-submit.test.ts`
- [ ] **112-25** (`112-25-PLAN.md`, `P112-25`) - `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` → `tests/bridges/hooks/routing-state.test.ts`
- [ ] **112-26** (`112-26-PLAN.md`, `P112-26`) - `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` → `tests/bridges/hooks/settle.test.ts`
- [ ] **112-27** (`112-27-PLAN.md`, `P112-27`) - `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` → `tests/bridges/hooks/spawn-helpers.test.ts`
- [ ] **112-28** (`112-28-PLAN.md`, `P112-28`) - `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` → `tests/bridges/hooks/stage.test.ts`
- [ ] **112-29** (`112-29-PLAN.md`, `P112-29`) - `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts` → `tests/bridges/hooks/timeout.test.ts`
- [ ] **112-30** (`112-30-PLAN.md`, `P112-30`) - `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` → `tests/bridges/hooks/translation-context.test.ts`
- [ ] **112-31** (`112-31-PLAN.md`, `P112-31`) - `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts` → `tests/bridges/hooks/wire-protocol.test.ts`

### Phase 113: Orchestrator Support and Presenters

**Goal**: Lifecycle workflows can depend on directly proven helpers, planners, classifiers, probes, and message producers.

**Depends on**: Phases 111 and 112

**Requirements**: MOD-06

**Success Criteria** (what must be TRUE):

1. Each of the 35 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Message producers preserve exact rows, reasons, severity, ordering, and reload behavior across supported scopes.
3. Classifiers, probes, discovery helpers, and reconcile planning return deterministic complete values for success and failure inputs.
4. Read-only support paths remain offline and case state does not cross test boundaries.

**Plans**: 35 plans

Plans:

- [ ] **113-01** (`113-01-PLAN.md`, `P113-01`) - `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` → `tests/orchestrators/auth-host.test.ts`
- [ ] **113-02** (`113-02-PLAN.md`, `P113-02`) - `extensions/pi-claude-marketplace/orchestrators/discover.ts` → `tests/orchestrators/discover.test.ts`
- [ ] **113-03** (`113-03-PLAN.md`, `P113-03`) - `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts` → `tests/orchestrators/import/execute.messaging.test.ts`
- [ ] **113-04** (`113-04-PLAN.md`, `P113-04`) - `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` → `tests/orchestrators/import/marketplaces.test.ts`
- [ ] **113-05** (`113-05-PLAN.md`, `P113-05`) - `extensions/pi-claude-marketplace/orchestrators/import/refs.ts` → `tests/orchestrators/import/refs.test.ts`
- [ ] **113-06** (`113-06-PLAN.md`, `P113-06`) - `extensions/pi-claude-marketplace/orchestrators/import/settings.ts` → `tests/orchestrators/import/settings.test.ts`
- [ ] **113-07** (`113-07-PLAN.md`, `P113-07`) - `extensions/pi-claude-marketplace/orchestrators/import/types.ts` → `tests/orchestrators/import/types.test.ts`
- [ ] **113-08** (`113-08-PLAN.md`, `P113-08`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts` → `tests/orchestrators/marketplace/add.messaging.test.ts`
- [ ] **113-09** (`113-09-PLAN.md`, `P113-09`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts` → `tests/orchestrators/marketplace/autoupdate.messaging.test.ts`
- [ ] **113-10** (`113-10-PLAN.md`, `P113-10`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts` → `tests/orchestrators/marketplace/list.messaging.test.ts`
- [ ] **113-11** (`113-11-PLAN.md`, `P113-11`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts` → `tests/orchestrators/marketplace/remove.messaging.test.ts`
- [ ] **113-12** (`113-12-PLAN.md`, `P113-12`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` → `tests/orchestrators/marketplace/shared.test.ts`
- [ ] **113-13** (`113-13-PLAN.md`, `P113-13`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` → `tests/orchestrators/marketplace/update.messaging.test.ts`
- [ ] **113-14** (`113-14-PLAN.md`, `P113-14`) - `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` → `tests/orchestrators/plugin-path.test.ts`
- [ ] **113-15** (`113-15-PLAN.md`, `P113-15`) - `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` → `tests/orchestrators/plugin/clone-cache.test.ts`
- [ ] **113-16** (`113-16-PLAN.md`, `P113-16`) - `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts` → `tests/orchestrators/plugin/clone-gc.test.ts`
- [ ] **113-17** (`113-17-PLAN.md`, `P113-17`) - `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` → `tests/orchestrators/plugin/discover-names.test.ts`
- [ ] **113-18** (`113-18-PLAN.md`, `P113-18`) - `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` → `tests/orchestrators/plugin/enable-disable.messaging.test.ts`
- [ ] **113-19** (`113-19-PLAN.md`, `P113-19`) - `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` → `tests/orchestrators/plugin/fetch.messaging.test.ts`
- [ ] **113-20** (`113-20-PLAN.md`, `P113-20`) - `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` → `tests/orchestrators/plugin/git-source-probe.test.ts`
- [ ] **113-21** (`113-21-PLAN.md`, `P113-21`) - `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts` → `tests/orchestrators/plugin/info.messaging.test.ts`
- [ ] **113-22** (`113-22-PLAN.md`, `P113-22`) - `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` → `tests/orchestrators/plugin/install.messaging.test.ts`
- [ ] **113-23** (`113-23-PLAN.md`, `P113-23`) - `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` → `tests/orchestrators/plugin/list.messaging.test.ts`
- [ ] **113-24** (`113-24-PLAN.md`, `P113-24`) - `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` → `tests/orchestrators/plugin/plugin-state-classifier.test.ts`
- [ ] **113-25** (`113-25-PLAN.md`, `P113-25`) - `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` → `tests/orchestrators/plugin/reinstall.messaging.test.ts`
- [ ] **113-26** (`113-26-PLAN.md`, `P113-26`) - `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` → `tests/orchestrators/plugin/shared.test.ts`
- [ ] **113-27** (`113-27-PLAN.md`, `P113-27`) - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` → `tests/orchestrators/plugin/uninstall.messaging.test.ts`
- [ ] **113-28** (`113-28-PLAN.md`, `P113-28`) - `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` → `tests/orchestrators/plugin/update-row.test.ts`
- [ ] **113-29** (`113-29-PLAN.md`, `P113-29`) - `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` → `tests/orchestrators/plugin/update.messaging.test.ts`
- [ ] **113-30** (`113-30-PLAN.md`, `P113-30`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` → `tests/orchestrators/reconcile/apply-outcomes.test.ts`
- [ ] **113-31** (`113-31-PLAN.md`, `P113-31`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` → `tests/orchestrators/reconcile/plan.test.ts`
- [ ] **113-32** (`113-32-PLAN.md`, `P113-32`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts` → `tests/orchestrators/reconcile/reconcile.messaging.test.ts`
- [ ] **113-33** (`113-33-PLAN.md`, `P113-33`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` → `tests/orchestrators/reconcile/types.test.ts`
- [ ] **113-34** (`113-34-PLAN.md`, `P113-34`) - `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts` → `tests/orchestrators/scope-fanout.test.ts`
- [ ] **113-35** (`113-35-PLAN.md`, `P113-35`) - `extensions/pi-claude-marketplace/orchestrators/types.ts` → `tests/orchestrators/types.test.ts`

### Phase 114: Plugin and Marketplace Lifecycle

**Goal**: Users keep the same plugin and marketplace lifecycle results while each state-changing workflow gains direct, hermetic proof.

**Depends on**: Phase 113

**Requirements**: MOD-07

**Success Criteria** (what must be TRUE):

1. Each of the 14 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Install, update, reinstall, enable, disable, fetch, uninstall, add, remove, list, and info keep their public outcomes and exact notifications.
3. Update preloads, staging warnings, rollback effects, cache behavior, and the accepted product corrections remain observable through exported workflows.
4. Offline operations stay offline. Network-capable cases use fake or loopback-only boundaries without developer credentials.
5. State-changing cases prove atomicity and safe retries with case-owned state and temporary trees.

**Plans**: 14 plans

Plans:

- [ ] **114-01** (`114-01-PLAN.md`, `P114-01`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` → `tests/orchestrators/marketplace/add.test.ts`
- [ ] **114-02** (`114-02-PLAN.md`, `P114-02`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` → `tests/orchestrators/marketplace/autoupdate.test.ts`
- [ ] **114-03** (`114-03-PLAN.md`, `P114-03`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` → `tests/orchestrators/marketplace/info.test.ts`
- [ ] **114-04** (`114-04-PLAN.md`, `P114-04`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` → `tests/orchestrators/marketplace/list.test.ts`
- [ ] **114-05** (`114-05-PLAN.md`, `P114-05`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` → `tests/orchestrators/marketplace/remove.test.ts`
- [ ] **114-06** (`114-06-PLAN.md`, `P114-06`) - `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` → `tests/orchestrators/marketplace/update.test.ts`
- [ ] **114-07** (`114-07-PLAN.md`, `P114-07`) - `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` → `tests/orchestrators/plugin/enable-disable.test.ts`
- [ ] **114-08** (`114-08-PLAN.md`, `P114-08`) - `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` → `tests/orchestrators/plugin/fetch.test.ts`
- [ ] **114-09** (`114-09-PLAN.md`, `P114-09`) - `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` → `tests/orchestrators/plugin/info.test.ts`
- [ ] **114-10** (`114-10-PLAN.md`, `P114-10`) - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` → `tests/orchestrators/plugin/install.test.ts`
- [ ] **114-11** (`114-11-PLAN.md`, `P114-11`) - `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` → `tests/orchestrators/plugin/list.test.ts`
- [ ] **114-12** (`114-12-PLAN.md`, `P114-12`) - `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` → `tests/orchestrators/plugin/reinstall.test.ts`
- [ ] **114-13** (`114-13-PLAN.md`, `P114-13`) - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` → `tests/orchestrators/plugin/uninstall.test.ts`
- [ ] **114-14** (`114-14-PLAN.md`, `P114-14`) - `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` → `tests/orchestrators/plugin/update.test.ts`

### Phase 115: Composition Orchestrators

**Goal**: Users get stable multi-operation import, bootstrap, dependency, and reconcile behavior built from the proven lifecycle workflows.

**Depends on**: Phase 114

**Requirements**: MOD-08

**Success Criteria** (what must be TRUE):

1. Each of the eight owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Import and reconcile continue other entries after one entry fails and report every public outcome.
3. Every composition arm applies the correct scope, dependency, state, and notification effect.
4. Bootstrap and pending-state behavior remain idempotent and stable across repeated calls.

**Plans**: 8 plans

Plans:

- [ ] **115-01** (`115-01-PLAN.md`, `P115-01`) - `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` → `tests/orchestrators/edge-deps.test.ts`
- [ ] **115-02** (`115-02-PLAN.md`, `P115-02`) - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` → `tests/orchestrators/import/execute.test.ts`
- [ ] **115-03** (`115-03-PLAN.md`, `P115-03`) - `extensions/pi-claude-marketplace/orchestrators/import/index.ts` → `tests/orchestrators/import/index.test.ts`
- [ ] **115-04** (`115-04-PLAN.md`, `P115-04`) - `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` → `tests/orchestrators/plugin/bootstrap.test.ts`
- [ ] **115-05** (`115-05-PLAN.md`, `P115-05`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` → `tests/orchestrators/reconcile/apply.test.ts`
- [ ] **115-06** (`115-06-PLAN.md`, `P115-06`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` → `tests/orchestrators/reconcile/backfill.test.ts`
- [ ] **115-07** (`115-07-PLAN.md`, `P115-07`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` → `tests/orchestrators/reconcile/notify.test.ts`
- [ ] **115-08** (`115-08-PLAN.md`, `P115-08`) - `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` → `tests/orchestrators/reconcile/pending.test.ts`

### Phase 116: Edge Surface

**Goal**: Users can invoke the complete command surface with preserved grammar, scope, completion, tool, and notification behavior.

**Depends on**: Phase 115

**Requirements**: MOD-09

**Success Criteria** (what must be TRUE):

1. Each of the 30 owner tests passes alone with 100 percent direct function, line, and branch coverage for its paired source.
2. Argument parsing, validation, routing, aliases, flags, and completion preserve the accepted command grammar and scope rules.
3. Handlers and LLM tools report exact public results through `ctx.ui.notify(message, severity)` and never write directly to stdout or stderr.
4. Read-only edge paths remain offline, and invalid input fails before a state-changing workflow runs.

**Plans**: 30 plans

Plans:

- [ ] **116-01** (`116-01-PLAN.md`, `P116-01`) - `extensions/pi-claude-marketplace/edge/args-schema.ts` → `tests/edge/args-schema.test.ts`
- [ ] **116-02** (`116-02-PLAN.md`, `P116-02`) - `extensions/pi-claude-marketplace/edge/args.ts` → `tests/edge/args.test.ts`
- [ ] **116-03** (`116-03-PLAN.md`, `P116-03`) - `extensions/pi-claude-marketplace/edge/completions/data.ts` → `tests/edge/completions/data.test.ts`
- [ ] **116-04** (`116-04-PLAN.md`, `P116-04`) - `extensions/pi-claude-marketplace/edge/completions/normalize.ts` → `tests/edge/completions/normalize.test.ts`
- [ ] **116-05** (`116-05-PLAN.md`, `P116-05`) - `extensions/pi-claude-marketplace/edge/completions/provider.ts` → `tests/edge/completions/provider.test.ts`
- [ ] **116-06** (`116-06-PLAN.md`, `P116-06`) - `extensions/pi-claude-marketplace/edge/flag-catalog.ts` → `tests/edge/flag-catalog.test.ts`
- [ ] **116-07** (`116-07-PLAN.md`, `P116-07`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` → `tests/edge/handlers/marketplace/add.test.ts`
- [ ] **116-08** (`116-08-PLAN.md`, `P116-08`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` → `tests/edge/handlers/marketplace/autoupdate.test.ts`
- [ ] **116-09** (`116-09-PLAN.md`, `P116-09`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts` → `tests/edge/handlers/marketplace/info.test.ts`
- [ ] **116-10** (`116-10-PLAN.md`, `P116-10`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` → `tests/edge/handlers/marketplace/list.test.ts`
- [ ] **116-11** (`116-11-PLAN.md`, `P116-11`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` → `tests/edge/handlers/marketplace/remove.test.ts`
- [ ] **116-12** (`116-12-PLAN.md`, `P116-12`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` → `tests/edge/handlers/marketplace/shared.test.ts`
- [ ] **116-13** (`116-13-PLAN.md`, `P116-13`) - `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` → `tests/edge/handlers/marketplace/update.test.ts`
- [ ] **116-14** (`116-14-PLAN.md`, `P116-14`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` → `tests/edge/handlers/plugin/bootstrap.test.ts`
- [ ] **116-15** (`116-15-PLAN.md`, `P116-15`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` → `tests/edge/handlers/plugin/enable-disable.test.ts`
- [ ] **116-16** (`116-16-PLAN.md`, `P116-16`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts` → `tests/edge/handlers/plugin/fetch.test.ts`
- [ ] **116-17** (`116-17-PLAN.md`, `P116-17`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` → `tests/edge/handlers/plugin/import.test.ts`
- [ ] **116-18** (`116-18-PLAN.md`, `P116-18`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` → `tests/edge/handlers/plugin/info.test.ts`
- [ ] **116-19** (`116-19-PLAN.md`, `P116-19`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` → `tests/edge/handlers/plugin/install.test.ts`
- [ ] **116-20** (`116-20-PLAN.md`, `P116-20`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` → `tests/edge/handlers/plugin/list.test.ts`
- [ ] **116-21** (`116-21-PLAN.md`, `P116-21`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` → `tests/edge/handlers/plugin/pending.test.ts`
- [ ] **116-22** (`116-22-PLAN.md`, `P116-22`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` → `tests/edge/handlers/plugin/reinstall.test.ts`
- [ ] **116-23** (`116-23-PLAN.md`, `P116-23`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` → `tests/edge/handlers/plugin/shared.test.ts`
- [ ] **116-24** (`116-24-PLAN.md`, `P116-24`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` → `tests/edge/handlers/plugin/uninstall.test.ts`
- [ ] **116-25** (`116-25-PLAN.md`, `P116-25`) - `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` → `tests/edge/handlers/plugin/update.test.ts`
- [ ] **116-26** (`116-26-PLAN.md`, `P116-26`) - `extensions/pi-claude-marketplace/edge/handlers/shared.ts` → `tests/edge/handlers/shared.test.ts`
- [ ] **116-27** (`116-27-PLAN.md`, `P116-27`) - `extensions/pi-claude-marketplace/edge/handlers/tools.ts` → `tests/edge/handlers/tools.test.ts`
- [ ] **116-28** (`116-28-PLAN.md`, `P116-28`) - `extensions/pi-claude-marketplace/edge/register.ts` → `tests/edge/register.test.ts`
- [ ] **116-29** (`116-29-PLAN.md`, `P116-29`) - `extensions/pi-claude-marketplace/edge/router.ts` → `tests/edge/router.test.ts`
- [ ] **116-30** (`116-30-PLAN.md`, `P116-30`) - `extensions/pi-claude-marketplace/edge/types.ts` → `tests/edge/types.test.ts`

### Phase 117: Extension Entry and Final Gate

**Goal**: Maintainers have complete one-to-one ownership and direct proof for the accepted 204-module baseline.

**Depends on**: Phase 116

**Requirements**: OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, CASE-01, CASE-02, CASE-03, CASE-04, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, COV-01, COV-02, COV-03, COV-04, COV-05, DES-01, DES-02, DES-03, DEL-01, DEL-02, DEL-03, DEL-04, MOD-10, PRES-01, PRES-02, SUITE-01, SUITE-02, SUITE-03, SUITE-04, SUITE-05, SUITE-06

**Success Criteria** (what must be TRUE):

1. The root entry owner test proves registration, composition, and reload behavior with 100 percent direct function, line, and branch coverage.
2. The correspondence gate reports exactly 204 mirrored owner pairs and rejects missing, unexpected, ambiguous, or proxy-owned tests.
3. The Node 24 all-pair result contains one complete direct coverage record for every inventory row, with no aggregate-coverage substitution.
4. Planted negative controls fail for their intended violations, and the clean tree passes focused tests, all-pair coverage, and `npm run check`.
5. Public, persistence, adapter, and named product contracts remain unchanged. Prohibited preservation and migration mechanisms are absent.

**Plans**: 1 plan

Plans:

- [ ] **117-01** (`117-01-PLAN.md`, `P117-01`) - `extensions/pi-claude-marketplace/index.ts` → `tests/index.test.ts` and the final repository gates

## Requirement Coverage

Every v1.19 requirement maps to exactly one phase. Requirements that apply to
the full inventory close in Phase 117. Each area-completion requirement closes
in the phase that owns its pair group.

|     Phase | Requirements                                                                                                |  Count |
| --------: | ----------------------------------------------------------------------------------------------------------- | -----: |
|       108 | MOD-01, RES-01, PRES-03, PRES-04                                                                            |      4 |
|       109 | MOD-02                                                                                                      |      1 |
|       110 | MOD-03                                                                                                      |      1 |
|       111 | MOD-04                                                                                                      |      1 |
|       112 | MOD-05                                                                                                      |      1 |
|       113 | MOD-06                                                                                                      |      1 |
|       114 | MOD-07                                                                                                      |      1 |
|       115 | MOD-08                                                                                                      |      1 |
|       116 | MOD-09                                                                                                      |      1 |
|       117 | OWN-01..06, CASE-01..04, TEST-01..05, COV-01..05, DES-01..03, DEL-01..04, MOD-10, PRES-01..02, SUITE-01..06 |     36 |
| **Total** | **48 requirements**                                                                                         | **48** |

## Progress

**Execution order:** 108 → 109 → 110 → 111 and 112 → 113 → 114 → 115 →
116 → 117. Phases 111 and 112 can use parallel waves after Phase 110. Each plan
and commit still owns one pair.

| Phase                                    | Plans Complete | Status          | Completed  |
| ---------------------------------------- | -------------: | --------------- | ---------- |
| 108. Domain and Platform                 |          23/23 | Complete        | 2026-08-29 |
| 109. Shared Contracts                    |          19/19 | Complete        | 2026-08-29 |
| 110. Persistence and Transaction         |          12/12 | Complete        | 2026-08-30 |
| 111. Non-Hook Component Bridges          |          31/31 | Complete        | 2026-08-30 |
| 112. Hook Runtime                        | 16/31 | In Progress|  |
| 113. Orchestrator Support and Presenters |           0/35 | Not started     | -          |
| 114. Plugin and Marketplace Lifecycle    |           0/14 | Not started     | -          |
| 115. Composition Orchestrators           |            0/8 | Not started     | -          |
| 116. Edge Surface                        |           0/30 | Not started     | -          |
| 117. Extension Entry and Final Gate      |            0/1 | Not started     | -          |
| **Total**                                |     **54/204** | **In Progress** | **-**      |
