# Phase 114: Plugin and Marketplace Lifecycle Pattern Map

**Mapped:** 2026-09-01  
**Scope:** MOD-07, all 14 lifecycle source/owner pairs in `114-CONTEXT.md`  
**Authority:** current public contracts and successful Phase 108-113 owner-test patterns

## Pattern contract for this phase

Every Phase 114 owner should be a direct, isolated contract test for exactly one production source. A passing historical suite is input evidence, not a completion signal. Each owner must reach 100% direct function, line, and branch coverage for its paired source while proving observable outcomes, exact notification behavior, state and filesystem effects, collaborator schedules, failure cleanup, and retry behavior.

All test cases use exact lowercase `// arrange`, `// act`, and `// assert` comments. Presentation-only collections are alphabetical. Behavioral sequences retain their contract order: forward phases, reverse undo, notification placement, batch progression, and collaborator calls must never be alphabetized.

The recurring successful shape from Phases 108-113 is:

1. Build fresh, complete, case-local inputs and collaborators.
2. Exercise the exported command or workflow, not a copied algorithm or source-text oracle.
3. Assert the whole public result, exact notifications, state, files, and collaborator call log.
4. Verify every genuine mock and prove no unexpected external work occurred.
5. For mutation workflows, inject one failure at every material forward and undo boundary, then prove partial state, cleanup, ordering, and a successful retry.

## Fourteen owner pairs and current direct baseline

| Plan    | Production source                                                          | Direct owner                                         | Current direct status                              | Primary Phase 108-113 analog                                                               |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P114-01 | `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`        | `tests/orchestrators/marketplace/add.test.ts`        | TEST_FAIL                                          | P113 clone/cache and Git-source-probe owners; P110 atomic filesystem/state owners          |
| P114-02 | `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | `tests/orchestrators/marketplace/autoupdate.test.ts` | COVERAGE_FAIL                                      | P113 command-context/message owners; P109 independent literal rows                         |
| P114-03 | `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`       | `tests/orchestrators/marketplace/info.test.ts`       | PASS: 30/30 branches, 4/4 functions, 196/196 lines | P113 read-only info/support owners; P109 exact output owners                               |
| P114-04 | `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`       | `tests/orchestrators/marketplace/list.test.ts`       | PASS: 12/12 branches, 1/1 function, 105/105 lines  | P113 list/presenter owners; P109 exact output owners                                       |
| P114-05 | `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`     | `tests/orchestrators/marketplace/remove.test.ts`     | COVERAGE_FAIL                                      | P110 phase-ledger failure matrices and atomic-state owners                                 |
| P114-06 | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`     | `tests/orchestrators/marketplace/update.test.ts`     | COVERAGE_FAIL                                      | P110 phase-ledger; P113 Git/credential fakes and update-outcome owners                     |
| P114-07 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`  | `tests/orchestrators/plugin/enable-disable.test.ts`  | COVERAGE_FAIL                                      | P113 shared plugin-state owner and scope-fanout owner; P110 atomic-state owners            |
| P114-08 | `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`           | `tests/orchestrators/plugin/fetch.test.ts`           | COVERAGE_FAIL                                      | P113 clone-cache, Git-source-probe, credential, and Device Flow patterns                   |
| P114-09 | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`            | `tests/orchestrators/plugin/info.test.ts`            | COVERAGE_FAIL                                      | P113 read-only info/support owners and clone-cache owner                                   |
| P114-10 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`         | `tests/orchestrators/plugin/install.test.ts`         | COVERAGE_FAIL                                      | P110 phase-ledger and atomic filesystem owners; P113 exact injected-collaborator schedules |
| P114-11 | `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`            | `tests/orchestrators/plugin/list.test.ts`            | COVERAGE_FAIL                                      | P113 shared plugin-state and list/presenter owners                                         |
| P114-12 | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`       | `tests/orchestrators/plugin/reinstall.test.ts`       | COVERAGE_FAIL                                      | P110 phase-ledger; P113 clone-cache and exact interaction owners                           |
| P114-13 | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`       | `tests/orchestrators/plugin/uninstall.test.ts`       | COVERAGE_FAIL                                      | P110 reverse-order undo/leak matrices and atomic-state owners                              |
| P114-14 | `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`          | `tests/orchestrators/plugin/update.test.ts`          | TEST_FAIL                                          | P110 phase-ledger; P113 update outcome, clone-cache, and exact collaborator owners         |

The two PASS pairs still require Phase 114 normalization: eliminate source-text assertions, retain exact runtime behavior, and satisfy the shared lowercase AAA, isolation, type-evidence, and offline rules.

## Proven pattern families

### F1. Fresh typed fixtures and real local state

Closest examples are `tests/orchestrators/plugin/shared.test.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`, and the Phase 110 atomic filesystem owners. Each case creates a fresh temporary scope, complete typed marketplace/plugin records, and the exact local tree it needs. Inputs are whole values, not `as unknown as` fragments. Reads after the action establish state and filesystem outcomes independently from the code under test.

Use this for every owner. Mutation cases should inspect persisted config/state, manifests, plugin resources, mirrors, staging areas, recorded SHAs, and cleanup paths. Read-only cases should still create their own complete state and prove it remains unchanged.

### F2. Stateful boundary fakes with explicit offline proof

The reusable Phase 113 boundary fakes are:

- `tests/platform/git-ops-fake.ts`: in-memory Git operations with cloned ingress, state transitions, and a complete call log; local filesystem behavior is explicitly distinguished from remote behavior.
- `tests/platform/credential-ops-fake.ts`: in-memory credential fill/approve/reject behavior with exact call logs.
- `tests/platform/credential-process-fake.ts`: a controlled credential subprocess protocol fake for process-kind behavior.
- `tests/domain/device-flow-fake.ts`: explicitly declares `{ boundary: "memory", network: "disabled" }` and records request-code and poll-token calls.
- `tests/helpers/marketplace-seed.ts`: legitimate passive setup for complete installed records, state/config seeding, and marketplace tree materialization.

Create every fake fresh per case. Configure an allowlist of expected remote operations and make every unlisted network/process method throw. Assert both positive calls and zero-call guarantees. Use real temporary directories for filesystem semantics. Use loopback or a controlled Unix process only when transport or process kind is itself the contract.

### F3. Exact interaction mocks

`tests/orchestrators/plugin/reinstall.messaging.test.ts` and the Phase 108 GitHub-auth owner demonstrate the permitted split:

- Passive `ToolInfo`, records, manifests, options, and results are fresh plain typed values.
- Genuine interaction collaborators such as context/UI methods may use `strong-mock` when the case declares every expected call and ends with exact verification.
- No `anyTimes()`, shared mutable mock, unverified mock, catch-all implementation, or partial impossible cast is acceptable.

Notification assertions include exact level, text/bytes, cardinality, envelope, and order relative to state changes and collaborator work. The direct command and cascade path must be compared semantically while preserving the explicitly allowed notification/configuration differences.

### F4. Complete failure, atomicity, and retry matrices

`tests/transaction/phase-ledger.test.ts` is the strongest analog. Its cases name every forward failure, record the complete `do`/`undo` schedule, assert newest-first undo, preserve the original error/cause, expose cleanup errors or partials, inspect final state, and avoid one mutable table oracle shared across scenarios.

Phase 114 should apply this shape at the real mutation unit. It must not claim fictional whole-command rollback when an earlier batch target is contractually allowed to remain committed. For each marketplace/plugin target, test:

- every material forward boundary;
- failing-phase cleanup and reverse undo order;
- every material undo/cleanup failure;
- exact persisted state, filesystem artifacts, caches, staging paths, warnings, and partial results;
- a second execution from that observed partial state which succeeds or performs the documented idempotent cleanup.

P110 locked-state tests provide the retry analog: assert acquisition/release and final state without arbitrary sleeps or timing luck.

### F5. Notification and exported-path parity

Phase 109 notification owners and Phase 113 command-context/presenter owners separate public behavior from grammar. Each lifecycle owner should assert its command's public notification contract directly. Cross-lane supplemental tests may cover only genuine multi-owner parity, not bytes already owned by one command.

For direct versus cascade paths, compare the semantic outcome while explicitly allowing only the contract differences locked in `114-CONTEXT.md`: notification/config suppression, companion-extension severity, warning placement, envelope/cardinality, and batch-abort behavior. Manual update and autoupdate differences need separate cases.

### F6. Type evidence without runtime fiction

Phase 109 and Phase 113 owners use complete module-scope `satisfies` witnesses and narrow negative `@ts-expect-error` cases positioned on the actual diagnostic. Apply that approach to public result unions, reason unions, callback options, and collaborator ports. Do not manufacture unreachable runtime cases with impossible casts, source scans, coverage ignores, or test-only exports/seams.

P114-14 must prove every value the implementation can produce in its existing `ContentReason[]` contract. Correct the stale four-reason comment, but do not narrow or redesign the public type merely to simplify the test matrix.

### F7. Pair-atomic supplemental consolidation

Phase 111-113 consolidation established a single-writer rule: copy the behavioral evidence into the direct owner first, run it alone with 100% direct coverage, then delete or relocate the supplemental in the same atomic task. A supplemental that spans two owners needs explicit ordered writers; the final writer owns deletion. Retained integrations prove only cross-owner composition and are excluded from per-source direct coverage.

## Legitimate reuse versus forbidden shared test logic

| Legitimate reuse                                                                                                              | Why it is legitimate                                                                                        | Forbidden alternative                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Fresh instances from `createGitOpsFake`, `createCredentialOpsFake`, `createCredentialProcessFake`, and `createDeviceFlowFake` | They model an injected boundary protocol, keep explicit state/call logs, and do not derive command outcomes | One shared mutable fake, permissive catch-all, hidden default success, or real network/credential/process fallback                  |
| Passive builders in `tests/helpers/marketplace-seed.ts`                                                                       | They materialize complete typed input state and trees without deciding the expected command result          | A helper that runs the command, computes expected notifications, predicts reasons, chooses rollback, or asserts the scenario        |
| Case-local `makeCtx`, temporary-scope, record/manifest builders, and tree writers                                             | They remove setup noise while returning fresh raw data for one owner concern                                | Exporting owner-specific scenario helpers across test files or sharing mutable fixtures between cases                               |
| A tiny case-local call recorder or method stub                                                                                | It exposes every collaborator input/output and lets the case state its own oracle                           | A general lifecycle harness whose callback/table encodes forward phases, undo order, or expected result branches                    |
| Literal independent failure rows that contain only failure injection data                                                     | Each row remains a complete named contract case and asserts its own whole outcome                           | One production-shaped table/helper that duplicates the classifier, derives reason/notification text, or computes the expected state |
| Real temp directories and passive filesystem seed functions                                                                   | The filesystem is the behavior under test, and the expected bytes/paths are asserted separately             | Snapshotting a shared golden tree produced by the command or comparing output with a helper using the same implementation logic     |
| `strong-mock` for a genuine interaction collaborator with exact expectations and `verifyAll()`                                | It proves exact calls and absence of extras                                                                 | `anyTimes()`, loose spies used as mocks, unverified expectations, or using a mock for passive typed data                            |

Helpers such as `assertStaysEnabled`, `runConverseEnableChain`, `renderDisabledWithInventory`, or broad install/reinstall scenario functions are acceptable only when kept case-local to the owner and reduced to passive setup or mechanical observation. If they choose expected behavior, derive presentation, hide notification schedules, or assert multiple scenarios through one oracle, replace them with independent literal cases.

## Per-pair implementation map

### P114-01 — marketplace add

- **Closest pattern:** P113 clone-cache and Git-source-probe owners for remote/local source handling; P110 atomic JSON/filesystem owners for state/config commits.
- **Case-local assets:** fresh temp scope; complete marketplace source/record; `makeCtx`; fresh Git, credential, and Device Flow fakes; local repository trees; explicit state/config readers.
- **Required partitions:** supported source kinds and malformed/duplicate inputs; GitHub, URL, git-subdir, local/path behavior; auth and Device Flow; clone/fetch/ref/materialization failures; state/config persistence failures; cleanup failures; notification parity; first-run and retry from every material partial state. Treat GitHub/url/git-subdir sources as installable, not unavailable.
- **Atomicity/offline proof:** assert the real per-marketplace mutation unit and cleanup paths. Every unconfigured remote/process port throws. Local sources and warm local artifacts must not call remote or credential ports.
- **Supplemental:** retain the six cross-owner seed/mirror cases from `add-seed-mirrors.test.ts`, relocating them to `tests/integration/marketplace-add-seed-mirrors.test.ts` after the direct owner absorbs any add-only assertion. They do not count toward direct coverage.

### P114-02 — marketplace autoupdate

- **Closest pattern:** Phase 113 command-context/message owners plus Phase 109 independent literal rows.
- **Case-local assets:** fresh complete config/state, `makeCtx`, hermetic home, marketplace record builders, exact config reader, and fresh interaction mocks only where public notification calls are the contract.
- **Required partitions:** enable/disable/query/default/missing marketplace behavior; already-enabled/disabled idempotence; scope/config read and write failures; exact manual/autoupdate notification and config-suppression differences; unchanged state on failures; successful retry after write failure.
- **Normalization:** replace `stripComments` or source-text evidence with exported runtime behavior and type witnesses. Keep literal expected notifications and config values in each case.
- **Offline proof:** install fail-fast external fakes even though the happy path should perform no external work, and assert zero Git/credential/Device Flow calls.

### P114-03 — marketplace info

- **Closest pattern:** P113 read-only info/support and presenter owners.
- **Case-local assets:** `seedConfigAutoupdate`, `makeCtx`, hermetic home, exact marketplace JSON writer, fresh state/config snapshots.
- **Required partitions:** every source/status/config presentation branch; absent/malformed records and manifests; exact alphabetical presentation; exact notification envelope/cardinality; state/files unchanged; no external calls.
- **Normalization:** retain the current 100% direct baseline while eliminating shared/or derived oracles and ensuring exact lowercase AAA. Add module-scope type evidence where the public result union otherwise lacks a compile-time witness.
- **Dependency:** independent of P114-14 and P114-06.

### P114-04 — marketplace list

- **Closest pattern:** P113 list/presenter owners and Phase 109 exact output tests.
- **Case-local assets:** `seedConfigAutoupdate`, `makeCtx`, hermetic home, complete marketplace records, exact state snapshot.
- **Required partitions:** empty/single/multiple lists; source/status/autoupdate variants; malformed/absent local data; exact alphabetical presentation and bytes; state unchanged; no external calls.
- **Normalization:** replace the current `stripComments` source-text assertion with exported behavior. Retain the current 100% direct baseline and add compile-time witnesses rather than impossible runtime casts.
- **Dependency:** independent.

### P114-05 — marketplace remove

- **Closest pattern:** P110 phase-ledger and atomic-state owners.
- **Case-local assets:** fresh temp scope; complete marketplace/plugin records; seeded local tree; fresh Git fake; `makeCtx`; before/after state, config, manifest, and filesystem snapshots.
- **Required partitions:** missing/in-use/eligible marketplace; companion-extension severity; direct/cascade notification and config suppression; plugin/resource/state/config/tree cleanup; each forward and reverse failure; cleanup warning placement; batch behavior if exposed; idempotent retry from retained artifacts.
- **Atomicity:** prove the real removal unit. Best-effort cleanup may leave documented residue; assert it exactly and show the next pass cleans or safely ignores it. Do not claim rollback of already committed earlier targets.
- **Offline proof:** list/info/remove/path and already-local cases use fail-fast external fakes and produce zero remote calls.

### P114-06 — marketplace update

- **Closest pattern:** P110 phase-ledger plus P113 Git/credential fake and update-outcome owners.
- **Case-local assets:** fresh Git and credential fakes; hermetic home; GitHub/URL/path/git-subdir source builders; complete plugin records; state/config/tree readers; explicit collaborator call logs.
- **Required partitions:** every source kind; unchanged/changed/unavailable/auth/network/classification outcomes; direct versus cascade semantic parity; companion severity; warning placement; notification envelope/cardinality; per-target batch commit/abort rules; every phase and undo failure; partial-state retry.
- **Atomicity/offline proof:** direct update preparation/synchronization may abort the batch; prove exactly which earlier target remains committed. Local/path/warm cases fail on any unlisted remote call. Remote cases use only injected Git/credential/Device Flow ports.
- **Supplemental:** absorb all five cases from `tests/orchestrators/marketplace/update-transport.test.ts`, then delete it in P114-06.
- **Dependency:** after P114-14, because marketplace update consumes the corrected exported plugin-update workflow and reason behavior.

### P114-07 — plugin enable-disable

- **Closest pattern:** `tests/orchestrators/plugin/shared.test.ts`, P113 scope-fanout, and P110 atomic-state owners.
- **Case-local assets:** fresh typed `ToolInfo`; `makeCtx`; fresh Pi/UI interaction collaborator; complete marketplace/plugin/config state; hermetic home; exact config/state readers.
- **Required partitions:** enable and disable across scopes; missing/disabled/already desired state; dependency/companion/cascade behavior; subagent/conversation side effects; direct/cascade parity; config/state write failures; notification failures if observable; retry and idempotence.
- **Mock rule:** passive `ToolInfo` is a plain complete typed value. Genuine Pi/UI mocks declare an exact schedule and are always verified. Replace scenario/oracle helpers at the bottom of the current owner when they hide expectations; keep only passive setup/observation.
- **Atomicity/offline proof:** state/config transition is the unit. Assert no external Git/auth work through fail-fast fakes.
- **Dependency:** after P114-10, because enable directly consumes the install ledger.

### P114-08 — plugin fetch

- **Closest pattern:** P113 clone-cache, Git-source-probe, credential, and Device Flow owners.
- **Case-local assets:** fresh Git, credential, and Device Flow fakes; `makeCtx`; hermetic home; local fixture repositories; complete marketplace/source records; cache/mirror/staging readers.
- **Required partitions:** local/path, GitHub, URL, git-subdir, warm mirror, cold clone, ref resolution, credential fill/approve/reject, Device Flow, unsupported/malformed source, every material Git/auth/fs failure, cleanup failure, and retry.
- **Network rule:** all remote access is through injected production ports. Bare/local/warm paths must make zero remote and credential calls. The fake allowlist makes accidental network/process work fail immediately.
- **Atomicity:** assert cache/mirror/staging artifacts and recorded SHA at each failure boundary; retry from every material partial cache/cleanup state.

### P114-09 — plugin info

- **Closest pattern:** P113 read-only info/support, Git-source-probe, and clone-cache owners.
- **Case-local assets:** fresh Git/credential fakes; `makeCtx`; hermetic home; path/GitHub/URL/git-subdir marketplace records; warm mirror/subdir writers; exact state/tree snapshots.
- **Required partitions:** installed/uninstalled/disabled/missing; every manifest-present/absent/malformed resource shape; every supported source kind; bare info versus `--fetch`; cold and warm cache; fetch/auth/network failures; exact output and alphabetical presentation; state unchanged.
- **Offline proof:** bare info is filesystem/state-only. `--fetch` and cold remote cases may access only injected ports and must assert the exact call schedule.
- **Supplemental:** absorb all 40 cases from `tests/orchestrators/plugin/info-manifest-absent.test.ts`, then delete it in P114-09.

### P114-10 — plugin install

- **Closest pattern:** P110 phase-ledger and atomic filesystem owners; P113 exact injected-collaborator schedule and shared plugin-state owners.
- **Case-local assets:** fresh plain typed `ToolInfo`; `makeCtx`; hermetic home; complete manifest/component/plugin trees; fresh Git/credential/Device Flow fakes; exact state/config/manifest/resource readers.
- **Required partitions:** all supported source kinds and component/resource types; dependencies/conflicts/collisions; disabled configuration; auth; clone/cache/staging/materialization/state/config/manifest failures; post-install bridge warning behavior; failing-phase cleanup and reverse undo; cleanup failures and retry.
- **Notification parity:** preserve exact bridge warnings as nonfatal when the contract says so; prove warning placement, severity, cardinality, and direct/cascade suppression differences.
- **Supplemental:** absorb all eight cases from `tests/orchestrators/plugin/install-auth.test.ts`, then delete it in P114-10.
- **Type/mock rule:** eliminate partial `ToolInfo` casts. Interaction mocks are exact and verified; passive data is plain and complete.

### P114-11 — plugin list

- **Closest pattern:** P113 shared plugin-state and list/presenter owners.
- **Case-local assets:** `makeCtx`; hermetic home; complete marketplace/state/config records; warm-mirror materializer only where local inventory is part of the contract; exact immutable snapshots.
- **Required partitions:** empty/single/multiple plugins; installed/disabled/unavailable/missing-manifest states; all resource inventory shapes; exact alphabetical presentation; exact notification/cardinality; malformed local state; no mutation and no external work.
- **Normalization:** remove `stripComments` or source scans and prove the exported runtime path. A presentation helper may format raw setup data, but it must not compute the expected rendered output.
- **Supplemental:** absorb all 17 cases from `tests/orchestrators/plugin/list-manifest-absent.test.ts`, then delete it in P114-11.

### P114-12 — plugin reinstall

- **Closest pattern:** P110 phase-ledger, P113 clone-cache, and `tests/orchestrators/plugin/reinstall.messaging.test.ts`.
- **Case-local assets:** complete plain typed `ToolInfo`; `makeCtx`; hermetic home; complete plugin/resource/manifest tree builders; fresh Git/credential/Device Flow fakes; recorded-SHA and cache/mirror readers; exact interaction verification.
- **Required partitions:** path/local/warm recorded-SHA/cold remote behavior; disabled and conflicting resources; auth and Device Flow; unstage/remove/fetch/stage/state/config/manifest phases; every forward and undo failure; bridge warning behavior; collision and cleanup partials; retry.
- **Offline proof:** reinstall from a recorded SHA and warm/local data performs no remote work. Cold remote cases use only injected ports.
- **Supplemental:** after P114-14 moves the first two update cases out of `update-reinstall-auth.test.ts`, absorb the remaining three reinstall cases and delete the supplemental. P114-12 is the final writer/deletion owner.
- **Type/mock rule:** remove partial `ToolInfo` casts; verify every genuine interaction mock exactly.

### P114-13 — plugin uninstall

- **Closest pattern:** P110 reverse-order undo/leak matrices and atomic-state owners.
- **Case-local assets:** `makeCtx`; complete plugin records; full plugin/Git plugin tree builders; owned agent/resource files; exact manifest/state/config/path readers; fresh fail-fast external fakes.
- **Required partitions:** missing/already absent/installed/disabled; all resource kinds; dependencies and cascade; unstage/config/state/manifest/tree cleanup; reverse order; every cleanup failure; notification placement/severity; partial and idempotent next pass.
- **Atomicity:** uninstall cleanup is best effort where contracted. Assert retained state/artifacts and warnings rather than inventing rollback. The next pass must safely finish or observe the documented absence.
- **Supplemental:** after P114-10, P114-14, and P114-12 are complete, relocate the single lifecycle chain from `tests/transaction/lifecycle-cascade.test.ts` to `tests/integration/transaction-lifecycle-cascade.test.ts`. Keep it as a cross-owner install → update → reinstall → uninstall proof, outside direct coverage.

### P114-14 — plugin update

- **Closest pattern:** P110 phase-ledger; P113 update-outcome, clone-cache, and exact collaborator owners.
- **Case-local assets:** fresh stateful Git/credential/Device Flow fakes with an explicit remote allowlist; `makeCtx`; hermetic home; complete installed/disabled records; path/GitHub/URL/git-subdir trees; exact state/config/manifest/resource/cache readers; independently literal reason expectations.
- **Required partitions:** every produced `ContentReason`; unchanged/changed/unavailable/auth/network/unsupported/collision outcomes; GitHub/URL/git-subdir installability; disabled state; warm/cold/recorded-SHA behavior; known-skill preload and generated-agent staging; nonfatal bridge warnings; direct versus cascade notification/config parity; manual versus autoupdate differences; batch continuation/abort; every forward and undo failure; cleanup failure and retry.
- **Required production correction evidence:** restore OR-12 `knownSkills` threading through the exported update workflow into generated-agent staging, and correct the stale four-reason comment while preserving `ContentReason[]`. Tests must observe the exported path; no test-only seam or copied classifier.
- **Atomicity:** `updateSingle` remains cascade-safe and typed. Assert the per-target unit, exact batch boundary, retained earlier successes, failed-target partials, reverse cleanup order, and a successful retry.
- **Supplemental:** absorb the first two update cases from `tests/orchestrators/plugin/update-reinstall-auth.test.ts` and leave only the three reinstall cases for P114-12. Do not delete the file in P114-14.
- **Dependency:** execute before P114-06 and P114-12; its corrected workflow is upstream of marketplace-update parity and the split supplemental's final writer.

## Exact supplemental consolidation map

| Existing supplemental path                                 | Cases | Disposition                                                                                   | Destination owner/integration path                                                             | Final writer |
| ---------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| `tests/orchestrators/marketplace/add-seed-mirrors.test.ts` |     6 | Retain as genuine cross-owner integration; relocate after removing any owner-only duplication | `tests/integration/marketplace-add-seed-mirrors.test.ts`                                       | P114-01      |
| `tests/orchestrators/marketplace/update-transport.test.ts` |     5 | Absorb all owner behavior, then delete                                                        | `tests/orchestrators/marketplace/update.test.ts`                                               | P114-06      |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts`  |    40 | Absorb all owner behavior, then delete                                                        | `tests/orchestrators/plugin/info.test.ts`                                                      | P114-09      |
| `tests/orchestrators/plugin/install-auth.test.ts`          |     8 | Absorb all owner behavior, then delete                                                        | `tests/orchestrators/plugin/install.test.ts`                                                   | P114-10      |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts`  |    17 | Absorb all owner behavior, then delete                                                        | `tests/orchestrators/plugin/list.test.ts`                                                      | P114-11      |
| `tests/orchestrators/plugin/update-reinstall-auth.test.ts` |     5 | Move first 2 update cases to P114-14; move remaining 3 reinstall cases and delete             | `tests/orchestrators/plugin/update.test.ts` and `tests/orchestrators/plugin/reinstall.test.ts` | P114-12      |
| `tests/transaction/lifecycle-cascade.test.ts`              |     1 | Retain as genuine four-owner lifecycle integration; relocate                                  | `tests/integration/transaction-lifecycle-cascade.test.ts`                                      | P114-13      |

This accounts for all 82 supplemental cases: 75 single-owner cases are absorbed by direct owners, and seven genuine integrations remain (six add/seed/mirror cases plus one full lifecycle chain). There are no correspondence exceptions.

## Ordering and coverage dependencies

Recommended execution waves:

| Wave       | Plans                                                                                    | Reason                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1          | P114-01, P114-02, P114-03, P114-04, P114-05, P114-08, P114-09, P114-10, P114-11, P114-14 | Independent owner normalization plus the upstream plugin-update correction                                                                                     |
| 2          | P114-06 after P114-14; P114-07 after P114-10; P114-12 after P114-14                      | Consume the corrected update/install workflows; P114-12 is the final writer for the split auth supplemental                                                    |
| 3          | P114-13 after P114-10, P114-12, and P114-14                                              | Relocate and run the full install/update/reinstall/uninstall integration after all of its upstream owners are stable                                           |
| Final gate | P114-13                                                                                  | Run every direct pair, both retained integration files, scoped type/lint/format/fallow/architecture checks, and the project-global gate from a frozen worktree |

P114-03 and P114-04 have no dependency on P114-14. Retained integration files must never be included in a source's direct coverage denominator. The P114-13 dependency is for ownership of the final lifecycle integration, not because uninstall production itself depends on all earlier implementation tasks.

## Direct coverage and structural gates

Each plan should use the repository's direct coverage command with exactly its paired source and run the owner alone before any aggregate suite. The target is 100% functions, lines, and branches with no ignore comments or generated coverage exclusions. The planner should spell out the exact source path, for example:

```bash
npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
```

Every owner task also needs:

- owner-only test execution and exact test count;
- global typecheck after the owner is frozen;
- targeted ESLint and Prettier checks for the owned source/test and any owned supplemental relocation/deletion;
- scans for uppercase AAA, `anyTimes()`, impossible casts, coverage ignores, source-text oracles, test-only exports/seams, focused/skipped tests, and live network/process fallbacks;
- a diff/scope check proving only the pair and explicitly assigned supplemental paths changed;
- exact mock verification and a no-leaked handles/process/temp-state check where collaborators or temporary roots are used;
- retained integration execution after relocation, separately from direct coverage;
- final scoped and global project gates on the frozen integrated tree.

## Planner checklist

- Assign exactly one production source and its one direct owner to each plan.
- Give every plan one pair-atomic auto task; supplemental moves/deletions belong to the named final writer.
- Enumerate concrete success, failure, undo, cleanup, notification, offline, and retry partitions instead of saying “edge cases.”
- Require independently literal whole-result and notification expectations in every case.
- Preserve exact public presenter bytes and contract-specific order; alphabetize presentation only.
- Require fresh complete typed values, case-owned temp state, and fresh verifiable fakes/mocks.
- Reject `anyTimes()`, source scans, impossible casts, shared scenario/oracle helpers, coverage ignores, and test-only seams.
- Treat P114-14 as the upstream workflow correction; require P114-06 after it and P114-12 as the split supplemental's deletion owner.
- Keep the two relocated integration files as cross-owner proof, not as substitutes for direct owner coverage.
- End with a frozen 14-pair direct-coverage loop and scoped/global quality gates.
