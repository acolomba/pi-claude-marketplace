# Architecture Research: v1.19 Unit Test Refactor

**Domain:** Brownfield TypeScript unit-test ownership and direct-coverage refactor
**Researched:** 2026-08-28
**Confidence:** HIGH

## Executive Recommendation

Keep the production architecture that exists at HEAD. Build the milestone around its
204 current production modules, not around the abandoned Phase 106/107 partition.
Each executable plan must own exactly one production source and its mirrored unit
test. Each plan must finish with one atomic commit for that pair.

The roadmap should start at Phase 108 and follow the live dependency direction:
domain and platform, shared contracts, persistence and transaction, bridges,
orchestrators, edge commands, and finally the extension entry point. This order lets
lower-level public contracts stabilize before their consumers receive direct tests.
It also makes the large lifecycle and composition modules depend on already-proven
seams.

Treat every one of the 204 pairs as open. The audit labels and retained commits are
diagnostic brownfield evidence. They are never completion proof. A `PASS` pair still
needs a v1.19 plan, current direct-coverage evidence, and its own commit.

Cross-cutting work must ride with a source-test pair that owns the contract. For
example, the resolver pair owns the required `installable: true | false`
discriminant. Structural gates run throughout the milestone, but they do not justify
gate-only executable plans.

## Current HEAD Architecture

The live extension is a layered TypeScript system under
`extensions/pi-claude-marketplace/`. The dependency flow is mostly inward from the
entry point and command surface toward orchestration, domain, persistence, and
platform seams.

```text
Pi extension entry (index.ts)
            |
            v
       edge commands
            |
            v
 lifecycle and composition orchestrators
       |          |          |
       v          v          v
    bridges   transaction  persistence
       |          |          |
       +----------+----------+
                  |
                  v
          domain / shared / platform
```

This is a dependency diagram, not a request to create new directories. Some shared
and platform modules are intentionally used by higher and lower layers. The roadmap
must use actual imports and callers to sequence pairs, not enforce a theoretical
layer model that the repository does not have.

### Component Boundaries

| Component           | Modules | Responsibility                                                                                   | Main dependencies                                         |
| ------------------- | ------: | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `domain/`           |      20 | Resolution, manifests, identities, versions, hook metadata, GitHub authentication rules          | `platform/`, `shared/`                                    |
| `platform/`         |       3 | Git, credential, and Pi runtime ports                                                            | `shared/`                                                 |
| `shared/`           |      19 | Errors, notifications, formatting, paths, configuration, concurrency, and common value utilities | selected platform types/APIs                              |
| `persistence/`      |       9 | Atomic durable stores for registries, ledgers, settings, caches, and snapshots                   | `domain/`, `platform/`, `shared/`                         |
| `transaction/`      |       3 | Install and lifecycle transaction coordination and rollback                                      | `persistence/`, `shared/`                                 |
| `bridges/agents/`   |       9 | Claude agent to Pi agent translation and staging                                                 | domain, persistence, platform, shared                     |
| `bridges/commands/` |       5 | Claude command to Pi prompt-template translation and staging                                     | domain, persistence, platform, shared                     |
| `bridges/skills/`   |       8 | Claude skill to Pi skill translation and staging                                                 | domain, persistence, platform, shared                     |
| `bridges/mcp/`      |       9 | Claude MCP to Pi MCP adapter translation and staging                                             | domain, persistence, platform, shared                     |
| `bridges/hooks/`    |      31 | Hook conversion, routing, dispatch, execution, and state                                         | domain, persistence, platform, shared                     |
| `orchestrators/`    |      57 | Plugin, marketplace, import, reconcile, discovery, and presentation workflows                    | all lower layers                                          |
| `edge/`             |      30 | Command parsing, validation, scope choice, and user-facing dispatch                              | orchestrators, domain, shared, platform                   |
| root `index.ts`     |       1 | Extension composition, command registration, hook installation, and reload lifecycle             | edge, hooks, orchestrators, persistence, platform, shared |

### Boundary Facts That Plans Must Preserve

- Hook routing state is isolated in `bridges/hooks/routing-state.ts` to break a live
  dependency cycle.
- Plugin and marketplace ledgers do not import each other. Workflows cross that
  boundary through leaf seams such as `orchestrators/marketplace/shared.ts` or through
  injected dependencies.
- The bridge families do not import one another. They share domain and persistence
  contracts instead.
- Plugin install uses the transaction runner. Other lifecycle operations have their
  own rollback shapes and must not be forced into install's transaction abstraction.
- Offline and no-network behavior is an architectural contract. Read-only commands
  and warm-cache paths must not gain network dependencies.
- User-visible output goes through `ctx.ui.notify`. Direct stdout or stderr writes are
  outside the command and bridge contract.
- Whole-repository cycle and unused-boundary checks remain the job of Fallow. Pair
  tests should not reproduce a second dependency scanner.

## Unit-Test Ownership Architecture

The milestone adds a strict one-to-one ownership view over the existing production
tree.

```text
extensions/pi-claude-marketplace/<relative-path>.ts
                         |
                         | exactly one mirrored owner
                         v
tests/<relative-path>.test.ts
                         |
                         +-- imports the production module directly
                         +-- covers its exported behavior directly
                         +-- reaches 100% functions, lines, and branches
```

Tests in `tests/architecture/` and `tests/integration/` can prove cross-module
contracts. They are supplemental evidence only. They cannot replace a mirrored unit
test or contribute ownership credit for a source pair.

### Current Pair Baseline

The canonical pair audit contains 204 rows.

| Audit label     |   Pairs | Planning meaning                                       |
| --------------- | ------: | ------------------------------------------------------ |
| `PASS`          |      59 | Existing evidence to inspect; pair remains open        |
| `COVERAGE_FAIL` |      83 | Mirrored test exists but direct coverage is incomplete |
| `MISSING`       |      60 | Mirrored test is absent                                |
| `TEST_FAIL`     |       2 | Focused test or environment failed; pair remains open  |
| **Total open**  | **204** | **Every pair receives one executable plan and commit** |

The current corresponding-test gate reports 107 violations: 60 missing tests, 43
unexpected tests, and four wrong imports. Both planted negative controls pass. These
numbers are a starting diagnostic, not a completion ledger.

One audit failure for `orchestrators/marketplace/add.ts` passes when the unchanged
test can create its Unix socket, so its plan must preserve the behavior while making
the test hermetic. `orchestrators/plugin/update.ts` has three reproducible assertion
failures around unavailable Git-source candidates. Its own lifecycle pair must own
that correction.

## Recommended Phase Architecture

The following grouping covers each production module exactly once. The phase counts
sum to 204.

| Phase | Group                               | Pair count | Dependency rationale                                                                                                  |
| ----: | ----------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------- |
|   108 | Domain and Platform                 |         23 | Stabilize foundational values, resolver result, Git ports, credentials, and GitHub authentication before consumers    |
|   109 | Shared Contracts                    |         19 | Prove errors, paths, configuration, notifications, and common utilities used by all later layers                      |
|   110 | Persistence and Transaction         |         12 | Prove formats, atomic writes, idempotency, ledger isolation, and rollback coordination after their value contracts    |
|   111 | Non-Hook Component Bridges          |         31 | Cover agents, commands, skills, and MCP conversion and staging on stable lower seams                                  |
|   112 | Hook Runtime                        |         31 | Isolate the larger hook conversion, routing, dispatch, and execution subsystem                                        |
|   113 | Orchestrator Support and Presenters |         35 | Prove small seams, classifiers, discovery helpers, messaging modules, and planning helpers before lifecycle composers |
|   114 | Plugin and Marketplace Lifecycle    |         14 | Cover the large state-changing plugin and marketplace workflows after their collaborators                             |
|   115 | Composition Orchestrators           |          8 | Cover import, reconcile, bootstrap, and edge-dependency composition after lifecycle primitives                        |
|   116 | Edge Surface                        |         30 | Cover parsing and command dispatch after all invoked workflows have stable contracts                                  |
|   117 | Extension Entry and Final Gate      |          1 | Cover root registration and composition, then close all global structural gates                                       |

Phases 111 and 112 can be prepared in parallel after Phase 110 because their source
trees are independent. Keep their commits and plans separate. Phase 113 must precede
the lifecycle phase because the lifecycle modules depend on these helpers and
presenters. Phase 115 follows lifecycle because its modules compose those workflows.

### Phase 113 Boundary

Use the live modules, not a new support directory. The intended 35 pairs are:

- Five top-level support modules: authentication host, discovery, plugin path,
  scope fan-out, and orchestrator types.
- Fifteen plugin support and presentation modules: clone cache, clone garbage
  collection, name discovery, Git-source probing, state classification, shared
  helpers, update-row formatting, and the eight current messaging modules.
- Six marketplace support and presentation modules: shared helpers and five current
  messaging modules.
- Five import support modules: execute messaging, marketplaces, references, settings,
  and types.
- Four reconcile support modules: apply outcomes, planning, reconcile messaging, and
  types.

### Phase 114 Boundary

The 14 lifecycle pairs are the eight plugin workflows (`enable-disable`, `fetch`,
`info`, `install`, `list`, `reinstall`, `uninstall`, and `update`) and the six
marketplace workflows (`add`, `autoupdate`, `info`, `list`, `remove`, and `update`).
These are high-value integration boundaries, but each remains one source-test pair.

### Phase 115 Boundary

The eight composition pairs are `edge-deps`, the two import composers (`execute` and
the import barrel), plugin bootstrap, and four reconcile composers (`apply`,
`backfill`, `notify`, and `pending`).

## Within-Phase Execution Sequence

The pair is the smallest executable unit. A phase can use waves, but a wave must not
change pair ownership.

1. Test type-only contracts, leaf values, and leaf adapter ports first.
2. Test small exported helpers that are imported by other modules in the phase.
3. Test stateful modules and persistence adapters after their schemas and values.
4. Test presenters before the workflows that call them.
5. Test lifecycle workflows before composition modules.
6. Test barrels after their leaf exports are stable.
7. Test the root entry point last.

Serialize pairs when one changes a public contract used by the other or when both
must edit the same concern-local test support file. Other pairs in the same phase can
run in parallel. Never let parallel plans share ownership of a source, mirrored test,
or commit.

## Executable Pair Plan Shape

Every plan should use the same evidence-producing sequence.

### 1. Declare Ownership

Name one exact production source and its one exact mirrored test. Record the audit
label as baseline context only. Name any supplemental tests that contain behavior
currently owned by the source.

### 2. Trace the Public Contract

Read the source, its exports, its callers and importers, the mirrored test, and related
architecture or integration tests. Decide which observable behavior belongs in the
mirrored test. Do not infer the contract from the old patch or retired phase plans.

### 3. Consolidate Test Ownership

Move source-owned cases from unexpected supplemental unit files into the mirrored
test. Keep a supplemental test only when it genuinely proves a multi-module contract.
Do not delete tests solely to make the corresponding-test gate green.

### 4. Make the Smallest Production Change

If the module cannot be tested through its exported surface, add a narrow production
dependency or port that improves the real design. Prefer an optional dependency,
explicit callback, clock, filesystem port, process boundary, or existing adapter.
Keep the change inside the current module boundary unless current callers prove that
a new production module is necessary.

### 5. Write Direct Unit Tests

Use `node:test` and `node:assert/strict`. Use explicit Arrange, Act, and Assert
comments. Create fresh mutable state and a fresh temporary directory per case. Use
strong mocks for promised interactions. Cover success, failure, absence, boundary,
and retry behavior through exports only.

Type-only files still require a mirrored test with compile-time contract assertions.
Barrels must prove runtime binding identity for value exports and compile-time
availability for type exports. The behaviorful root `index.ts` is not a barrel.

### 6. Prove the Pair

Run the focused test and the direct-coverage command for the exact source. Require
100% functions, lines, and branches. Run type checking, linting, and affected
contract tests when the public surface changes. Confirm that no test-only export,
module replacement, or shared mutable state was introduced.

### 7. Commit the Pair

Create one commit that represents one source-test pair. Concern-local support edits
may ride in the commit only when they exist to test that pair. A plan must not combine
two production sources to reduce commit count.

## Cross-Cutting Contract Carriers

Cross-cutting concerns still need a single accountable source pair. Use these carrier
pairs instead of creating non-pair executable plans.

| Contract                                                          | Owning pair or pairs                                               |    Phase | Verification boundary                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | -------: | ------------------------------------------------------------------------------------ |
| Resolver root safety                                              | `domain/resolver.ts`                                               |      108 | Runtime arm tests plus compile-time rejection of `pluginRoot` on unavailable results |
| Git and credential adapter parity                                 | `platform/git.ts`, `platform/git-credential.ts`                    |      108 | Public port behavior and concern-local adapter contract cases                        |
| Device Flow HTTP reachability                                     | `domain/github-auth.ts`                                            |      108 | Public authentication workflow with a production-reachable injected HTTP port        |
| Version internals remain private                                  | `domain/version.ts`                                                |      108 | Test public version behavior; remove tests of private hashing constants              |
| Hook metadata and diagnostics                                     | Relevant domain metadata pair and hook routing/dispatch pairs      | 108, 112 | Public translation and dispatch behavior; no private tool-name exports               |
| Notification grammar and output routing                           | Shared notify/reason/context pairs and each current messaging pair | 109, 113 | Direct message tests plus supplemental architecture checks                           |
| Durable formats and atomic writes                                 | Each persistence module                                            |      110 | Round trip, corrupted/absent state, retry, and atomic replacement behavior           |
| Bridge atomicity and foreign-content preservation                 | Each bridge stage/unstage module                                   | 111, 112 | Direct bridge pair tests plus supplemental cross-bridge integration cases            |
| Update preload, staging warnings, and unavailable-source behavior | `orchestrators/plugin/update.ts`                                   |      114 | Public update outcomes and rollback/notification effects                             |
| Reconcile entry isolation                                         | `orchestrators/reconcile/apply.ts`                                 |      115 | One entry failure does not stop other entries or arms                                |
| Correspondence and direct-coverage enforcement                    | Every pair; final closure with root `index.ts`                     | All, 117 | Pair checks continuously; full gates and negative controls at milestone close        |

If a carrier exposes a defect in gate code, repair that gate in the carrier's pair
commit. Do not introduce a gate-only phase or plan. Gate implementation already at
HEAD is baseline infrastructure, not proof that any pair is complete.

## Resolver Discriminant Contract

The resolver's three-state `state` field and the new boolean discriminant serve
different purposes. Keep both. `state` distinguishes fully installable from partially
available results. `installable` makes root access type-safe.

```typescript
type ResolvedPlugin =
  | {
      installable: true;
      state: "installable";
      pluginRoot: string;
      // Current installable fields remain here.
    }
  | {
      installable: true;
      state: "partially-available";
      pluginRoot: string;
      // Current partial-result fields remain here.
    }
  | {
      installable: false;
      state: "unavailable";
      name: string;
      notes: readonly string[];
      // No pluginRoot.
    };
```

The `domain/resolver.ts` pair must update its runtime schema or constructors together
with the exported type. Its mirrored test must prove all runtime arms and include a
compile-time negative assertion for `pluginRoot` on the unavailable arm. The change
is additive for consumers that only inspect `state`, so it does not require a mass
consumer rewrite or a separate migration plan. It does not change a persisted format.

## Verification Boundaries

### Pair Boundary

- The mirrored test imports the production source directly.
- The focused test passes.
- Direct coverage for that source is 100% functions, lines, and branches.
- Tests use only the exported surface.
- Exactly one mirrored test owns the source.
- The commit contains one production source-test pair.

### Wave Boundary

- Type checking and linting pass for the accumulated wave.
- Direct dependents are retested when a public contract changes.
- Shared support files have one current owner and no parallel edit collision.

### Phase Boundary

- Every pair in the phase passes direct coverage independently.
- Relevant architecture and integration suites pass.
- `npm run check` remains green, apart from a separately recorded pre-existing
  structural-gate gap that the phase has strictly reduced.
- The global corresponding-test violation count never increases. It may remain nonzero
  until later phases because the later source pairs are still open.

### Milestone Boundary

Phase 117 closes the full repository, not only the entry pair. Require all of the
following:

- `npm run test:corresponding`
- `npm run test:coverage:direct:all`
- the corresponding-test planted negative control
- the direct-coverage planted negative control
- `npm run check`
- no missing, unexpected, or wrong-import pair violations
- 204 pair commits represented by 204 completed pair plans

If the new structural gates are not yet part of `npm run check`, the root entry pair
plan can own the final package-script wiring as a supporting task. This keeps the
roadmap free of a non-pair executable plan. Supplemental architecture and integration
tests remain contract evidence; they never replace direct pair proof.

## Patterns to Follow

### Public-Surface Testability

Refactor a hidden dependency into a production-useful port, then test behavior through
the exported workflow. Good seams include the existing filesystem, Git, Pi API,
process, clock, and notification boundaries.

### Concern-Local Test Support

Place a fake or contract suite with the concern it represents. A Git fake can support
Git adapter pairs. A generic mock bucket shared by unrelated layers weakens ownership
and creates parallel edit conflicts.

### Stable Mutable-State Isolation

Construct ledgers, registries, hook routers, environment views, and temporary paths
inside each test. An explicit state holder is preferable to a module-reset hook or
module replacement.

### Supplemental Contract Catalogs

Keep architecture tests for invariants that span multiple modules: import direction,
no-network commands, output routing, persistence compatibility, foreign-content
preservation, and public-surface shape. Use these tests at phase boundaries while
unit pairs retain direct behavior ownership.

## Anti-Patterns to Avoid

### Replaying the Abandoned Partition

Do not recreate the retired resolver subtrees, source schema subtrees, notify shards,
hook dispatcher shards, or per-verb orchestrator partitions from the old patch. Those
paths describe an abandoned implementation attempt, not the current architecture.

### Migration-History Commentary

Do not add source comments that explain the retired patch, Phase 106/107, old sharded
coverage, or previous ownership mechanisms. Comments must explain current behavior
only.

### Test-Only Production Surface

Do not export private constants, reset functions, singleton accessors, default
adapters, or internal hook names only for tests. Use public workflow assertions or a
real dependency seam.

### Parallel Coverage Systems

Do not restore the sharded LCOV runner, reconciliation protocol, direct-coverage
matrix baseline, ownership registry, adapter participation scanner, or targeted
Fallow inventory. Use the current direct pair runner, correspondence gate, negative
controls, normal type/lint checks, and whole-repository Fallow.

### Historical Completion Credit

Do not convert an audit `PASS`, an existing test, a retained commit, or a green
supplemental suite directly into roadmap completion. Current isolated pair evidence is
the only completion proof.

### Large Refactors for Coverage

Do not split a production file simply because it is large or hard to cover. First add
the smallest real seam within the current module. A new production extraction creates
another source pair and changes callers, so it requires explicit architectural need
and revised pair accounting.

## Hotspots and Integration Risks

Large files deserve smaller test scenarios and stricter caller tracing, not automatic
module splits.

| Hotspot                                  | Approximate size | Main risk                                                                 | Recommended handling                                                 |
| ---------------------------------------- | ---------------: | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `shared/notify.ts`                       |      4,135 lines | Message grammar and output paths are shared broadly                       | Stabilize in Phase 109; keep catalog-level checks supplemental       |
| `orchestrators/plugin/update.ts`         |      3,240 lines | Network/cache selection, preload, staging warnings, and rollback interact | Give its pair a late lifecycle wave and retest all direct dependents |
| `orchestrators/plugin/install.ts`        |      2,442 lines | Transaction phases and bridge staging interact                            | Prove transaction and bridge ports first                             |
| `orchestrators/plugin/info.ts`           |      2,403 lines | Read-only behavior and presentation are intertwined                       | Prove presenters first; retain no-network checks                     |
| `domain/resolver.ts`                     |      1,744 lines | Public union, schemas, paths, and availability rules meet                 | Make the discriminant change in Phase 108 before consumers           |
| `orchestrators/plugin/reinstall.ts`      |      1,687 lines | Uninstall/install state preservation and retry behavior                   | Reuse public lifecycle seams; avoid shared mutable fixtures          |
| `orchestrators/plugin/list.ts`           |      1,589 lines | Scope aggregation and presentation                                        | Prove fan-out and messaging modules first                            |
| `orchestrators/plugin/enable-disable.ts` |      1,252 lines | Install ledger and staged artifact state must agree                       | Test durable state and retry paths directly                          |
| `orchestrators/plugin/shared.ts`         |      1,243 lines | Many lifecycle callers depend on small semantic details                   | Complete in Phase 113 before lifecycle pairs                         |
| `orchestrators/import/execute.ts`        |      1,130 lines | Multiple external formats converge into lifecycle calls                   | Complete import leaf helpers before composer                         |

The pair for marketplace add must account for sandbox-sensitive Unix socket setup.
The pair should inject or isolate the relevant boundary so ordinary unit execution
does not depend on host socket permission, without changing marketplace behavior.

## Scalability Considerations

This milestone scales by pair count and dependency coordination, not by runtime user
load.

| Concern               | Early phases                                    | Middle phases                                       | Final phases                                             |
| --------------------- | ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Parallel work         | Leaf pairs with separate files can run together | Serialize public-contract carriers before consumers | Serialize edge and entry composition behind workflows    |
| Shared test support   | Add only concern-local support                  | Assign one owner per shared support edit            | Freeze support before final global proof                 |
| Structural-gate noise | Record baseline and prevent regression          | Violation count must decline as pairs close         | Require zero violations and passing negative controls    |
| Coverage runtime      | Run exact source pair per plan                  | Run phase direct suite at phase close               | Run all 204 pairs plus full check                        |
| Failure localization  | Pair command identifies one owner               | Phase suites identify integration regressions       | Global gates validate completeness only after pair proof |

## Sources and Confidence

All conclusions come from repository-local primary evidence at HEAD. External ecosystem
research is not needed for this architecture decision.

| Source                                                  | Use                                                                        | Confidence                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `.planning/PROJECT.md`                                  | v1.19 decisions, constraints, and Phase 108 start                          | HIGH                                            |
| `.planning/codebase/ARCHITECTURE.md`                    | Live layer and dependency descriptions                                     | HIGH                                            |
| `extensions/pi-claude-marketplace/**/*.ts`              | Actual modules, exports, callers, and imports                              | HIGH                                            |
| `tests/**/*.test.ts`                                    | Current mirrored and supplemental test topology                            | HIGH                                            |
| `docs/guidelines/typescript-unit-testing-guidelines.md` | Required pair, public-surface, coverage, and gate model                    | HIGH                                            |
| `.claude/rules/typescript-unit-testing.md`              | Repository-enforced testing rules                                          | HIGH                                            |
| `.planning/inputs/unit-test-refactor-handoff/`          | Retained contracts, corrections, abandoned mechanisms, and replay cautions | HIGH for decisions; LOW as implementation proof |
| `/tmp/pi-cm-pair-audit.CJWiph/results.tsv`              | Current 204-pair diagnostic inventory                                      | HIGH as baseline; NONE as completion proof      |
| `package.json` and test runner scripts                  | Current check and structural-gate wiring                                   | HIGH                                            |

## Open Planning Questions

- Decide the exact wave size within each phase after the planner builds the caller
  graph for that phase. Do not change pair ownership to meet a target wave size.
- Decide whether structural-gate package-script wiring is still absent when Phase 117
  starts. If it is absent, keep it as support work in the root entry pair.
- Re-run the audit immediately before roadmap finalization if HEAD changes. Counts in
  this document describe the researched HEAD and must not silently drift.
