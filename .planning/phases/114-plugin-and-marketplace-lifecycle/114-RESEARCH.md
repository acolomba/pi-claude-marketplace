# Phase 114: Plugin and Marketplace Lifecycle - Research

**Researched:** 2026-09-01
**Domain:** TypeScript lifecycle-orchestrator owner tests, atomic filesystem/state workflows, and hermetic Git/auth boundaries
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Milestone test contract carried forward

- **D-01:** Normalize and re-prove all 14 owners, including accepted-HEAD `PASS` tests.
  Baseline triage is input, not completion evidence.
- **D-02:** Every runtime case uses separate lowercase `// arrange`, `// act`, and
  `// assert` phases with canonical blank lines. Lowercase `// act & assert` is limited
  to one `assert.throws()` or `assert.rejects()` expression.
- **D-03:** Every case constructs complete, case-local inputs and independently authored
  complete expectations. Passive values are fresh plain typed data. Genuine interaction
  mocks use exact counts and explicit verification; `anyTimes()` is prohibited.
- **D-04:** Alphabetize presentation-only inventories, static catalogs, and
  non-behavioral tables. Preserve caller, scope, reason, transaction, rollback,
  declaration, and lifecycle order wherever sequence carries behavior.

### Contract authority and product corrections

- **D-05:** Current shipped public contracts outrank stale test expectations. Correct a
  historical test when it conflicts with a newer locked contract. Change production only
  for a demonstrated product defect supported by public-contract evidence.
- **D-06:** Keep plugin update's current `ContentReason[]` runtime and public output
  behavior. Correct the misleading comment that lists only four skipped reasons, and
  directly prove every produced class, including transport, degradation, disabled-state,
  manifest, and installability reasons. Do not narrow the exported reason type or remap
  truthful reasons to fit the stale comment.
- **D-07:** Preserve GitHub, URL, and git-subdir sources as installable. The historical
  plugin-update failures that treated GitHub-shaped sources as structurally unavailable
  are stale fixtures; genuinely unsupported inputs must carry those test partitions.
- **D-08:** Restore the locked OR-12 product correction: plugin update must pass staged
  skill names into generated-agent staging so agent skill preloads survive update unless
  the source changes them. Prove this through the exported update workflow.
- **D-09:** Preserve and directly prove the OR-13 product correction that non-fatal
  bridge staging warnings survive a successful update. Also prove the production-reachable
  credential and Device Flow ports through exported network-capable lifecycle workflows.

### Direct, cascade, and orchestrated behavior

- **D-10:** Require semantic parity between direct and cascade/orchestrated paths for
  state transitions, statuses, reasons, causes, and reload semantics.
- **D-11:** Maintain a named, exhaustive allowlist of intentional context differences:
  notification suppression, config write-back suppression, companion-extension severity,
  discovery-warning placement, envelope/cardinality shape, and batch-abort behavior.
  Do not require byte or severity parity where the public contract deliberately differs.
- **D-12:** Direct plugin-update sync or preparation failure may abort its batch;
  `updateSinglePlugin` remains cascade-safe and returns a typed outcome. Manual update may
  report missing companion extensions differently from background autoupdate. Each
  difference must be explicit and regression-tested rather than inferred from separate
  test files.

### Atomicity, rollback, cleanup, and retry

- **D-13:** Prove atomicity at the contract's actual mutation unit, not as fictional
  whole-command rollback. A pre-mutation failure leaves no change; each committed
  artifact or state transition is atomic; designed partial outcomes expose their exact
  committed and uncommitted effects.
- **D-14:** Exercise each semantically distinct forward and undo failure boundary.
  Assert failing-phase undo, reverse compensation order, structured partial/leak
  reporting, authoritative state bytes, and remaining on-disk artifacts where owned by
  the lifecycle module.
- **D-15:** Prove safe retry after every material partial or cleanup failure. A second
  invocation must converge, complete documented best-effort cleanup, or repeat the same
  safe failure without corrupting state or duplicating artifacts.
- **D-16:** Preserve documented batch behavior: an earlier target may remain committed
  when a later target fails. Uninstall and marketplace-remove post-commit cleanup remains
  best-effort when that is the current contract; the next idempotent pass must clean or
  safely report leftovers.

### Offline and external boundaries

- **D-17:** Use fresh stateful Git, credential, Device Flow, and Pi contract fakes plus
  case-owned local fixture trees. Use loopback or Unix resources only when the transport
  or filesystem kind itself is under test. Never use live remotes or developer
  credentials.
- **D-18:** Install fail-fast external fakes in every offline case. Marketplace and plugin
  list/info, uninstall, marketplace remove, path-source operations, warm SHA-pinned
  cache operations, and reinstall's recorded-SHA path must prove zero unexpected network,
  Git, credential, or subprocess calls.
- **D-19:** Treat explicit `info --fetch`, cold-cache git operations, marketplace git
  add/update, and other documented network-capable arms as network-capable only through
  their injected production ports. Bare info remains filesystem-only.

### Supplemental ownership

- **D-20:** Absorb the 75 single-owner cases from lifecycle supplementals into their
  exact mirrored owners. Split combined update/reinstall authentication evidence by the
  production owner that emits each behavior.
- **D-21:** Retain genuine cross-module identities only: move the six marketplace-add
  seed/mirror cases and the one install → update → reinstall → uninstall lifecycle chain
  under `tests/integration/`. Do not flatten those seven cases into one owner or add
  correspondence-gate exceptions.
- **D-22:** Remove a supplemental only after its unique evidence is present in the owner
  or named integration carrier. The final tree must have no duplicate single-module
  oracle and no exception for the seven current lifecycle supplemental paths.

### the agent's Discretion

- Choose exact case names, concern-local factories, and the smallest complete failure
  matrix that proves each distinct result without deriving expected values.
- Choose whether a demonstrated correction is one narrow production edit or a local type
  refinement, provided public behavior, persistence formats, and test-only-surface rules
  remain intact.
- Choose plan waves and dependencies. P114-14's reason and preload contract must settle
  before P114-06 consumes update outcomes; P114-03 and P114-04 can proceed independently.
- Choose the final integration filenames for the seed/mirror and lifecycle-chain flows,
  provided they live under `tests/integration/` and retain their named end-to-end identity.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 114 scope. Phase 115 retains composition-level
failure isolation and arm-application ownership.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                              | Research Support                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOD-07                | “All 14 plugin and marketplace lifecycle pairs complete the pair contract.”                                              | The owner matrix, direct-coverage baseline, supplement disposition, wave graph, per-pair gate, and final aggregate gate below cover all 14 roadmap pairs. [VERIFIED: .planning/REQUIREMENTS.md:122-123]                                   |
| PRES-02               | Preserve public behavior, persistence formats, adapter contracts, and named product corrections while refactoring tests. | The parity allowlist, OR-12/OR-13 guidance, mutation-unit matrix, network matrix, and preservation gates keep production contracts authoritative. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:36-113] |
| </phase_requirements> |

## Summary

Phase 114 should be planned as 14 pair-atomic owner rewrites, not as one lifecycle redesign. The roadmap fixes the 14 mirrored pairs and requires each owner to pass alone with complete direct branch, function, and line coverage while public outcomes, exact notifications, offline behavior, and actual mutation-unit atomicity remain unchanged. [VERIFIED: .planning/ROADMAP.md:449-482] The current owners contain 674 runtime cases; only marketplace info and marketplace list already pass the direct gate. Excluding marketplace add, whose focused file currently stops at a sandbox-rejected Unix-socket fixture, the measured baseline is 1,546/1,822 branches and 15,540/16,429 lines. [VERIFIED: live focused/direct gate sweep, 2026-09-01]

The only planned production behavior correction is P114-14's OR-12 fix: thread the just-staged skill generated names into `prepareStagePluginAgents`. Plugin install and reinstall already do this; update stages skills first but omits `knownSkills`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1003-1021; extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1287-1298; extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1275-1312] P114-14 must also correct the stale four-reason comment without narrowing `readonly ContentReason[]`, and it must prove the full live producer taxonomy through exported workflows. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/types.ts:289-312]

**Primary recommendation:** Normalize the two accepted owners and correct P114-14 first; run the independent owner rewrites next; then let P114-06 consume the corrected update contract and let P114-12 finish the split authentication supplemental; finally, let P114-13 relocate and run the four-owner lifecycle integration. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:115-125]

## Project Constraints (from AGENTS.md)

- Use CodeGraph before grep/find or file reads whenever locating or understanding code in this indexed repository. [VERIFIED: AGENTS.md:1-9]
- Keep one production source and its mirrored owner test in each executable plan; retained HEAD tests are baseline only. [VERIFIED: .planning/PROJECT.md:13-25]
- Require complete direct branch, function, and line coverage from the mirrored owner alone. [VERIFIED: scripts/test-coverage-direct.mjs:207-264]
- Use strict TypeScript on Node `">=20.19.0"`; do not widen production APIs for testing. [VERIFIED: package.json:29-34; .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:9-15]
- Preserve atomic disk writes, retry safety, containment, two-scope behavior, notification-only output, and the locked network policy. [VERIFIED: .planning/PROJECT.md:441-454]
- Use separate lowercase `// arrange`, `// act`, and `// assert` sections; use `// act & assert` only for one throw/rejection expression. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:24-34]
- Alphabetize presentation-only inventories while retaining every behavior-bearing caller, scope, reason, transaction, rollback, declaration, and lifecycle order. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:32-34]

## Architectural Responsibility Map

| Capability                             | Primary Tier                    | Secondary Tier                     | Rationale                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace and plugin read inventory  | API / Backend orchestrator      | Database / filesystem state        | Orchestrators resolve scope, state, manifest, and render inputs; list and bare info remain filesystem-only. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:194-204]                                                                               |
| Lifecycle state transitions            | API / Backend orchestrator      | Database / filesystem state        | The owner coordinates bridge artifacts, state, config write-back, and typed outcomes. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:177-199]                                                                                                     |
| Git materialization and authentication | API / Backend port boundary     | External Git / credential provider | Orchestrators depend on injected `GitOps`, `CredentialOps`, and `DeviceFlowHttp`; the real adapters stay outside tests. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:73-158; extensions/pi-claude-marketplace/platform/git-credential.ts:59-66] |
| Atomic compensation and retry          | API / Backend transaction layer | Database / filesystem state        | `runPhases`, locked state transactions, staging handles, and atomic saves own the real mutation units. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:35-72,153-172]                                                                                      |
| Direct-coverage enforcement            | Build / test tooling            | —                                  | The direct script derives exactly one mirrored test, runs it alone, and rejects any hit/found mismatch. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,207-264]                                                                                                                 |

## Standard Stack

No package installation or framework change is needed. Use the repository's installed stack only. [VERIFIED: package.json:8-34]

| Library / runtime | Version in repository | Purpose                                                        | Required use                                                                                                                                                                                                                           |
| ----------------- | --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | engine `">=20.19.0"`  | Built-in `node:test`, filesystem, process, and coverage runner | Run owner files and direct LCOV gates. [VERIFIED: package.json:32-34,82-95]                                                                                                                                                            |
| TypeScript        | `"^6.0.3"`            | Strict source and test types                                   | Prefer typed outcome construction and typed fakes; do not use impossible casts. [VERIFIED: package.json:29-30]                                                                                                                         |
| strong-mock       | `"^9.2.2"`            | Interaction mocks                                              | Use only for genuine interaction contracts, with exact expectations and `verify()`; passive values remain plain typed data. [VERIFIED: package.json:26-29; .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:29-31] |
| write-file-atomic | `"^8.0.0"`            | Atomic persistence writes                                      | Exercise the existing persistence seam; do not replace it. [VERIFIED: package.json:8-12]                                                                                                                                               |
| isomorphic-git    | `"^1.41.8"`           | Production Git adapter behind `GitOps`                         | Owner tests use the in-memory contract fake, never the live adapter. [VERIFIED: package.json:8-11; extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:140-158]                                                       |
| proper-lockfile   | `"^4.1.2"`            | Cross-process state/config locking                             | Use real case-owned state transactions where lock behavior belongs to the owner. [VERIFIED: package.json:8-12]                                                                                                                         |

### Package Legitimacy Audit

Not applicable. Phase 114 installs no external package and recommends no new dependency. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:9-15]

## Architecture Patterns

### System Architecture Diagram

```text
edge command / reconcile caller / marketplace cascade
                    |
                    v
       exported lifecycle orchestrator
          |         |          |
          |         |          +--> typed direct/cascade outcome --> Phase 113 presenter --> ctx.ui.notify
          |         |
          |         +--> injected Git / credential / Device Flow ports
          |                       |
          |                       +--> memory fake in tests; real adapter in production
          |
          +--> locked state/config transaction
                    |
                    +--> bridge prepare handles
                    +--> atomic commit or replacement
                    +--> failing-phase undo + reverse compensation
                    +--> post-commit best-effort cache/data/clone cleanup
```

This is a backend orchestration flow. There is no browser, SSR, CDN, database server, or live remote in the owner-test boundary. [VERIFIED: .planning/ROADMAP.md:449-463]

### Owner and Direct-Coverage Baseline

“Complete” in the function column means the direct gate reported no function deficit; it is not inferred completion credit. P114-01's source counts were not emitted because its focused test stopped first. [VERIFIED: live focused/direct gate sweep, 2026-09-01]

| Plan    | Owner concern          | Current cases | Branches     | Functions    | Lines        | Planning focus                                                                                                                                                                                                                                                                                           |
| ------- | ---------------------- | ------------: | ------------ | ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P114-01 | marketplace add        |            42 | not measured | not measured | not measured | Normalize the owner, preserve source-kind/auth/config/clone failure partitions, move six seed/mirror flows to integration, and resolve the case-owned Unix-socket runner capability without a production seam. [VERIFIED: .planning/ROADMAP.md:469; tests/orchestrators/marketplace/add.test.ts:637-669] |
| P114-02 | marketplace autoupdate |            20 | 65/77        | complete     | 600/612      | Direct/orchestrated config-write behavior, both scopes, invalid/absent config, idempotence, error aggregation. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                  |
| P114-03 | marketplace info       |            14 | 30/30        | 4/4          | 196/196      | Normalize accepted-HEAD cases; keep filesystem-only scope fan-out and exact info blocks. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                        |
| P114-04 | marketplace list       |             9 | 12/12        | 1/1          | 105/105      | Normalize accepted-HEAD cases; preserve alphabetical display and behavioral scope ordering. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                     |
| P114-05 | marketplace remove     |            30 | 81/91        | complete     | 737/764      | Full/partial removal, cascade continuation, config layers, cleanup leaks, retry. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                                |
| P114-06 | marketplace update     |            45 | 98/112       | complete     | 823/867      | Run after P114-14; absorb five transport/auth cases and prove update-outcome projection plus aggregate phase gate. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                              |
| P114-07 | plugin enable/disable  |            46 | 85/117       | 18/19        | 1149/1252    | Direct/orchestrated parity, retained disabled inventory, install/uninstall cascades, config suppression, retry. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                 |
| P114-08 | plugin fetch           |            17 | 73/79        | complete     | 542/554      | Target shapes, cache-hit no-op, cold materialization, per-target failure isolation, auth ports. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                 |
| P114-09 | plugin info            |            71 | 204/255      | 51/62        | 2154/2403    | Absorb 40 manifest-absence cases; separate bare filesystem proof from explicit `--fetch`. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                       |
| P114-10 | plugin install         |            93 | 189/219      | 47/49        | 2354/2442    | Absorb eight auth cases; prove ledger compensation, warnings, config/state bytes, retry, source kinds. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                          |
| P114-11 | plugin list            |            70 | 164/180      | complete     | 1574/1589    | Absorb 17 manifest-absence cases; preserve filter/status/reason and alphabetical inventory order. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                               |
| P114-12 | plugin reinstall       |            74 | 180/223      | 46/48        | 1586/1687    | After P114-14 moves the two update cases, absorb the remaining three auth cases and delete the combined file; prove replacement rollback/finalize and recorded-SHA behavior. [VERIFIED: live direct gate, 2026-09-01]                                                                                    |
| P114-13 | plugin uninstall       |            38 | 59/67        | complete     | 689/718      | State-led removal, config sweep, orchestrated outcome, best-effort post-commit cleanup, retry. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                                                                  |
| P114-14 | plugin update          |           105 | 306/360      | 78/84        | 3031/3240    | OR-12 fix, OR-13 preservation, full reason taxonomy, two auth cases, heterogeneous phase-3 partials, and lifecycle integration move. [VERIFIED: live direct gate, 2026-09-01]                                                                                                                            |

### Pattern 1: Literal Direct/Cascade Parity Tables

For every lifecycle owner that exposes a direct and orchestrated/cascade entry, construct both inputs independently and compare semantic fields explicitly. Shared assertions must cover state transition, status/partition, reasons, causes, and reload semantics. The only permitted differences are the six locked categories below. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:56-68]

| Difference                    | Direct path                                                      | Cascade/orchestrated path                                                                                                 | Required proof                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification suppression      | May emit the command notification.                               | May return a typed outcome without emitting.                                                                              | Assert both notification count and returned outcome, not only one side.                                                                         |
| Config write-back suppression | User command may patch the selected config file.                 | Reconcile/autoupdate derives desired state and suppresses write-back.                                                     | Assert exact config bytes and mtime/no-write.                                                                                                   |
| Companion-extension severity  | Manual action may warn.                                          | Background/bulk cascade may keep the same reason at informational severity.                                               | Assert semantic reason parity and the intentional severity delta.                                                                               |
| Discovery-warning placement   | Skills/commands discovery warnings reach both modes.             | Agent/MCP hygiene warnings are retained by the orchestrated result but suppressed from the standalone diagnostic surface. | Assert ordered warning arrays and notification placement. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1330-1348] |
| Envelope/cardinality          | Direct single/bulk commands choose their public block and tally. | Cascade returns one typed row per target for a parent renderer.                                                           | Assert exact envelope independently; do not derive one expected value from the other.                                                           |
| Batch abort                   | Direct plugin update may abort on sync/preparation failure.      | `updateSinglePlugin` catches and returns a typed failed/skipped outcome.                                                  | Assert thrown-versus-returned behavior and whether earlier targets remain committed.                                                            |

### Pattern 2: Restore OR-12 at the Existing Staging Seam

`StagedSkillRecord` already exposes the exact field needed by agents: `"readonly generatedName: string"`, alongside `sourcePath` and `targetPath`. [VERIFIED: extensions/pi-claude-marketplace/bridges/skills/types.ts:52-61] Install uses `knownSkills: c.stagedSkillNames`; reinstall uses `knownSkills: handles.skills.result.recorded.map((r) => r.generatedName)`; update stages skills first and currently omits the property. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1003-1021; extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1287-1298; extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1275-1312]

Use the reinstall shape in update:

```typescript
// after handles.skills has been prepared
handles.agents = await prepareStagePluginAgents({
  // existing update arguments remain unchanged
  knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),
});
```

The owner proof must call exported `updatePlugins` and `updateSinglePlugin` with a fixture containing a staged skill plus an agent preload token, then inspect the generated agent artifact. Do not export `prepareUpdateHandles`, inject a private helper, or assert only that a stub received the property. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:38-54]

### Pattern 3: Full Plugin-Update Reason Producer Taxonomy

The public type must remain exactly `"readonly reasons: readonly ContentReason[]"`; the stale prose currently says only `"not in manifest"`, `"not installed"`, `"invalid manifest"`, and `"no longer installable"`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/types.ts:289-312] Correct only that prose, then prove these live classes through exported workflows:

| Producer class       | Exact current values                                                                                                                                                                                           | Production source                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest/membership  | `"not in manifest"`, `"not installed"`, `"invalid manifest"`                                                                                                                                                   | `triageUpdateMembership` and marketplace-absent preflight. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1087-1163]                                                                              |
| Transport/auth       | `"network unreachable"`, `"authentication required"`                                                                                                                                                           | `classifyGitTransportFailure` feeds skipped candidate outcomes. [VERIFIED: extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts:33-61; extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:973-989] |
| Partial degradation  | `"lsp"`, `"unsupported hooks"`, `"unsupported component"`                                                                                                                                                      | `narrowUnsupportedKinds` maps resolver unsupported kinds. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-216; extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:992-1012]          |
| Installability       | `"no longer installable"`                                                                                                                                                                                      | Structural candidate decline. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1015-1023]                                                                                                           |
| Disabled state       | `"already disabled"`                                                                                                                                                                                           | Disabled record whose pin refresh moved while artifacts stayed absent. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1690-1756]                                                                  |
| Unchanged projection | `"up-to-date"`                                                                                                                                                                                                 | The unchanged partition projects the token; it is not evidence that skipped outcomes have only four reasons. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:3041-3064]                            |
| Direct/phase failure | `"permission denied"`, `"source missing"`, `"not found"`, `"rollback partial"`, `"concurrently uninstalled"`, `"concurrently updated"`, `"network unreachable"`, `"invalid manifest"`, `"unreadable manifest"` | Typed-error/errno/message classification and phase-3 aggregate projection. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2107-2158,2911-2972]                                                    |

Do not construct an impossible `PluginUpdateOutcome` cast merely to hit a closed-union arm. Reach each class from membership, resolver, Git fake, disabled record, bridge failure, or filesystem failure inputs that production accepts. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:38-54]

### Pattern 4: Test the Real Mutation Unit

| Owner group              | Real atomic/partial boundary                                                                                                                                                                                                                                                                                                              | Minimum failure and retry evidence                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Marketplace add          | Git clone stages, validates, and atomically renames; state/config commit follows under the locked transaction; a later config/state failure removes the final clone. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:350-441,620-700]                                                                        | Pre-clone, clone, manifest, duplicate/stale destination, config write, state save, cleanup leak; retry reaches one state row and one final clone.            |
| Marketplace autoupdate   | Each physical config/state update is atomic; a multi-scope command is aggregation, not a whole-command transaction. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:72-86]                                                                                                                                | Invalid/absent config, idempotent no-write, one-scope failure with other scope retained, retry convergence.                                                  |
| Marketplace remove       | Per-plugin cascade continues across failures; full marketplace deletion happens only on full success; config layers are swept independently; cleanup is best effort. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:351-406,442-478]                                                                     | Earlier successful plugin removal remains, partial outcome names failures, retry removes leftovers without duplicate effects.                                |
| Enable/disable           | One target delegates to install/uninstall materialization and then owns its desired-state/config result; a bulk/reconcile caller does not gain fictional rollback. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:194-199]                                                                               | Failure before materialization, failure after one owned artifact transition, orchestrated config suppression, second invocation convergence.                 |
| Fetch and `info --fetch` | Cache promotion is the mutation; installed state is not rewritten. Warm clone/mirror presence returns before network. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-200]                                                                                                                            | Cold clone failure cleans staging; warm retry is a no-op; raced promotion uses the winner.                                                                   |
| Install                  | `runPhases` invokes failing-phase undo first, then completed phases in reverse; rollback failures are structured and the state save is a separate authoritative boundary. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:56-72,75-83,153-172]                                                                    | Each semantically distinct bridge forward/undo failure, exact rollback order, partial/leak rows, state bytes, artifact inventory, retry.                     |
| Reinstall                | All handles prepare before replacements; completed replacements roll back in reverse; successful replacements finalize backup/staging cleanup; each plugin is its own bulk mutation unit. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1253-1302,1570-1639]                                              | Prepare abort, each replacement failure, rollback leak, finalize leak, state-save failure, retry from retained backups/artifacts.                            |
| Uninstall                | Artifact/config/state removal is authoritative; cache, data-dir, and clone GC run after success and are intentionally best effort. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:351-439]                                                                                                                 | Unstage/config/state failures stay loud; cleanup failures do not erase success; retry cleans or safely confirms absence.                                     |
| Plugin update            | Intent mark, per-bridge physical commit, and finalize are distinct. Phase 3a collects bridge failures, records only successful bridge resources, and may produce a designed partial. Earlier bulk targets may remain committed. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1401-1470,1899-1977,2085-2158] | Prepare abort, each bridge commit failure, concurrent state change, config write-back, warning order, GC failure, partial retry, later-target batch failure. |

### Pattern 5: Hermetic Network Boundary Matrix

The reusable contract fakes require explicit boundaries: `createGitOpsFake({ boundary: "memory" })` blocks unplanned remotes and records every Git call; `createCredentialOpsFake({ boundary: "memory" })` owns an in-memory credential store and call log; `createDeviceFlowFake({ boundary: "memory", network: "disabled", ... })` records HTTP calls without network. [VERIFIED: tests/platform/git-ops-fake.ts:8-25,56-76,89-120; tests/platform/credential-ops-fake.ts:4-21,45-92; tests/domain/device-flow-fake.ts:7-15,26-69]

| Owner/path                              | Expected boundary                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace add                         | Path source: zero Git/credential/HTTP. GitHub and URL: Git/auth only through injected ports. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:365-397,703-739]                                                                                                                          |
| Marketplace autoupdate/info/list/remove | Filesystem-only; install fail-fast fakes even where the option surface cannot normally reach Git. [VERIFIED: .planning/PROJECT.md:448]                                                                                                                                                                              |
| Marketplace update                      | Path source: offline. GitHub/URL refresh: injected `GitOps`; private GitHub challenge: injected credential and Device Flow ports; plugin cascade consumes injected `PluginUpdateFn`. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:98-100,234-237]                                |
| Enable/disable                          | Disable is offline. Enable with path or warm SHA cache is offline; a cold git re-materialization uses the existing install clone/auth seam. [VERIFIED: .planning/PROJECT.md:448]                                                                                                                                    |
| Fetch                                   | Path/up-to-date/warm cache arms are offline; explicit cold git fetch uses clone/auth ports and isolates per-target errors. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:78-105,299-305]                                                                                                |
| Plugin info                             | Bare info is filesystem-only. `fetch: true` alone creates the fetch context; disabled/state-only and other non-fetchable arms decline without network. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:98-160,742-751]                                                                     |
| Plugin install/update                   | Path and warm SHA cache are offline. Cold git candidate resolution/materialization uses injected Git, credential, and optional Device Flow ports. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-200; extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:218-263] |
| Plugin list/uninstall                   | Filesystem/state-only; every owner case should prove zero external calls. [VERIFIED: .planning/PROJECT.md:448]                                                                                                                                                                                                      |
| Plugin reinstall                        | Uses the recorded SHA and does not resolve a remote pin; a missing recorded-SHA clone may materialize through the injected clone/auth port, while a warm hit is offline. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:196-223,1210-1250]                                           |

### Supplemental Consolidation Map

The seven supplemental files contain 82 cases: 75 single-owner cases must be absorbed and seven true cross-module cases must move to integration. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:224-232]

| Current supplemental                                       | Cases | Destination / owner                                                                                                      | Required sequencing                                                                                                         |
| ---------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `tests/orchestrators/marketplace/add-seed-mirrors.test.ts` |     6 | Move intact to `tests/integration/marketplace-add-seed-mirrors.test.ts` under P114-01.                                   | Move; do not duplicate in add owner.                                                                                        |
| `tests/orchestrators/marketplace/update-transport.test.ts` |     5 | Absorb into marketplace update owner under P114-06, then delete.                                                         | P114-06 runs after P114-14.                                                                                                 |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts`  |    40 | Absorb into plugin info owner under P114-09, then delete.                                                                | Independent.                                                                                                                |
| `tests/orchestrators/plugin/install-auth.test.ts`          |     8 | Absorb into plugin install owner under P114-10, then delete.                                                             | Independent.                                                                                                                |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts`  |    17 | Absorb into plugin list owner under P114-11, then delete.                                                                | Independent.                                                                                                                |
| `tests/orchestrators/plugin/update-reinstall-auth.test.ts` |     5 | Move two update cases into P114-14; P114-12 then moves the remaining three reinstall cases and deletes the supplemental. | P114-12 depends on P114-14.                                                                                                 |
| `tests/transaction/lifecycle-cascade.test.ts`              |     1 | Move intact to `tests/integration/transaction-lifecycle-cascade.test.ts` under P114-13.                                  | Run after the install, update, and reinstall owners are stable; keep the install → update → reinstall → uninstall identity. |

### Recommended Waves and Dependencies

```text
Wave 1
  P114-03,04,14
    - normalize the two accepted owners
  P114-14 plugin update
    - OR-12 knownSkills correction
    - reason prose + complete producer taxonomy
    - OR-13 warnings
    - move 2 update auth cases and leave 3 reinstall cases
                    |
                    v
Wave 2
  P114-01,02,05,07,08,09,10,11
    - independent owner normalization and exclusive supplemental ownership
                    |
                    v
Wave 3
  P114-06 marketplace update
    - consumes settled PluginUpdateOutcome behavior
    - absorbs 5 transport cases
  P114-12 plugin reinstall
    - consumes the split auth supplemental
    - absorbs 3 reinstall cases and deletes the supplemental
                    |
                    v
Wave 4
  P114-13 plugin uninstall
    - relocates and runs the lifecycle integration
    - runs 14-owner/direct aggregate and final phase gate
```

P114-03 and P114-04 are safe independent quick wins because both already pass their direct gates. P114-06 and P114-12 must follow P114-14: marketplace update consumes the corrected update contract, while reinstall is the final writer for the split authentication supplemental. P114-13 runs last so its relocated lifecycle integration and aggregate gate observe all four constituent owners in their settled form. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:115-125,234-237]

### Anti-Patterns to Avoid

- **Coverage-only private exports:** do not export helpers, add `__deps` solely for an unreachable branch, or cast impossible closed-union values. The direct gate is about the exported workflow. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:9-15,38-54]
- **Whole-command rollback claims:** bulk owners intentionally retain earlier committed targets and update intentionally retains successful bridge slots. Assert actual partial state. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:70-86]
- **Derived expectations:** do not use direct output to construct cascade expectations, production renderers to construct expected strings, or one fixture object as both input and expected value. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:29-34,248-256]
- **Permissive mocks:** no `anyTimes()`, unverified interaction mocks, module-scope mutable mocks, or silent default external behavior. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:29-31,90-100]
- **Alphabetizing behavioral sequences:** rollback, reason, scope, caller, input, and lifecycle order are contracts; only presentation inventories are alphabetical. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:32-34]
- **Treating a sandbox capability failure as a product defect:** marketplace add's special-file case tests `stat().isDirectory() === false` and `isFile() === false`; the current case-owned Unix socket is semantically correct, but this research sandbox rejects `listen()` with `EPERM`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:792-825; tests/orchestrators/marketplace/add.test.ts:637-669; live focused test, 2026-09-01]

## Don't Hand-Roll

| Problem                  | Don't build                                                     | Use instead                                                     | Why                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction compensation | A test-side saga or fake rollback scheduler                     | Existing `runPhases`, bridge handles, and case-owned real trees | The production ledger fixes failing-phase-first and reverse compensation order. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:153-172] |
| Git behavior             | Ad-hoc partial `GitOps` objects                                 | Fresh `createGitOpsFake` per case                               | It records state and blocks unplanned remotes. [VERIFIED: tests/platform/git-ops-fake.ts:56-76,117-145]                                                          |
| Credentials              | Developer keychain, environment tokens, or inert stubs          | Fresh `createCredentialOpsFake`                                 | It proves fill/approve/reject state and avoids OS credentials. [VERIFIED: tests/platform/credential-ops-fake.ts:45-92]                                           |
| Device Flow              | Live GitHub HTTP or a loopback server for ordinary auth cases   | Fresh `createDeviceFlowFake`                                    | The fake requires `network: "disabled"` and records both calls. [VERIFIED: tests/domain/device-flow-fake.ts:31-69]                                               |
| Direct coverage          | Manual `--test-name-pattern`, source filters, or aggregate LCOV | `npm run test:coverage:direct -- <source>`                      | The script runs exactly the mirrored owner and requires hit === found for all three metrics. [VERIFIED: scripts/test-coverage-direct.mjs:207-264]                |
| Expected notifications   | Production renderer calls in test expectations                  | Independently authored exact message literals                   | Prevents implementation-derived oracles. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:29-34]                                  |

## Runtime State Inventory

This is a refactor/correction phase, so runtime state must be inventoried even though no migration is planned.

| Category                             | Items found                                                                                                                                                                                                                                                            | Action required                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Stored data                          | `state.json`, base/local plugin config, generated skills/prompts/agents/MCP entries, agent index, marketplace clones, plugin clone cache, and plugin data directories are lifecycle-observable state. [VERIFIED: .planning/PROJECT.md:437-449]                         | No schema/value migration. Capture pre-state bytes and tree inventory, assert exact committed/rolled-back state, then retry. |
| Live service config                  | No external service configuration is modified by Phase 114; Git provider interaction is through runtime ports only. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:88-100]                                                            | No migration. Tests must not use live provider configuration.                                                                |
| OS-registered state                  | No scheduler, service, daemon, or process registration is in phase scope. [VERIFIED: .planning/ROADMAP.md:449-482]                                                                                                                                                     | None.                                                                                                                        |
| Secrets/env vars                     | Production credential helpers and Device Flow can access credentials, while tests use memory fakes; scope-root selection may honor the existing runtime directory configuration. [VERIFIED: extensions/pi-claude-marketplace/platform/git-credential.ts:59-66,297-310] | No rename. Prove zero live credential/process access and no credential text in errors/notifications.                         |
| Build artifacts / installed packages | Direct coverage uses a temporary LCOV directory and removes it; no installed package or generated schema changes. [VERIFIED: scripts/test-coverage-direct.mjs:237-264]                                                                                                 | No migration or reinstall.                                                                                                   |

## Common Pitfalls

### Pitfall 1: Mistaking Producer Taxonomy for a Narrow Type

**What goes wrong:** A stale comment is used to shrink `ContentReason[]` or tests remap truthful transport/degradation reasons into four older literals. **Avoidance:** change the prose, preserve the public type and output, and build one exported-workflow case per live producer class. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:38-54]

### Pitfall 2: Proving Notifications but Not Authoritative State

**What goes wrong:** A failure row looks correct while state bytes, a config file, or a bridge artifact is stranded. **Avoidance:** snapshot bytes/tree before action, assert notification/outcome and disk together, then run a second invocation. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:70-86,248-250]

### Pitfall 3: False Direct/Cascade Equality

**What goes wrong:** Tests demand byte/severity equality across contexts where notification suppression, write-back, warning placement, cardinality, or batch abort intentionally differs. **Avoidance:** compare semantic fields and assert each allowlisted context difference explicitly. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:56-68]

### Pitfall 4: Offline by Accident

**What goes wrong:** A case happens not to call the network but has a default real port ready if a branch changes. **Avoidance:** install fail-fast Git, credential, HTTP, and process boundaries and assert empty call logs. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:88-100,254-255]

### Pitfall 5: Duplicate Supplemental Oracles

**What goes wrong:** Cases are copied into owners but old supplementals remain, or cross-module integration identity is flattened into one owner. **Avoidance:** use the disposition table, delete only after the new carrier passes, and make P114-06 assert all seven old paths are absent. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:102-113]

### Pitfall 6: Shared-File Race Between P114-12 and P114-14

**What goes wrong:** Both plans concurrently edit/delete `update-reinstall-auth.test.ts`. **Avoidance:** P114-14 first moves its two update cases and leaves the remaining three cases in place; P114-12 then absorbs those reinstall cases, verifies both owners, and deletes the shared file. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:104-106]

### Pitfall 7: Unix-Socket Capability in Restricted Sandboxes

**What goes wrong:** P114-01 reports a product regression because the runner forbids creation/listen of a Unix socket. **Avoidance:** keep the special-filesystem-kind proof on a capable POSIX runner; do not add a production filesystem injection seam. If execution must occur in this restricted sandbox, record the environment exception and rerun the exact focused/direct gate in the clean integration runner. [VERIFIED: tests/orchestrators/marketplace/add.test.ts:637-669; live `EPERM` failure, 2026-09-01]

## Code Examples

### Fresh Fail-Fast External Collaborators

```typescript
// arrange
const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [] });
const credentials = createCredentialOpsFake({ boundary: "memory" });
const deviceFlow = createDeviceFlowFake({
  boundary: "memory",
  network: "disabled",
  deviceCode,
});
```

The exact fake boundary values are `"memory"` and `"disabled"`; each factory rejects any other boundary. [VERIFIED: tests/platform/git-ops-fake.ts:8-25,76-79; tests/platform/credential-ops-fake.ts:4-10,45-48; tests/domain/device-flow-fake.ts:7-15,31-38]

### Retry Proof Shape

```typescript
test("converges after the owned cleanup failure", async (testContext) => {
  // arrange
  const first = await makeCase(testContext, { cleanupError: new Error("cleanup failed") });

  // act
  const firstOutcome = await first.run();
  const second = await makeRetryCase(testContext, first.persistedTree);
  const secondOutcome = await second.run();

  // assert
  assert.deepEqual(firstOutcome, expectedPartialOutcome);
  assert.deepEqual(secondOutcome, expectedConvergedOutcome);
  assert.deepEqual(await readOwnedTree(second.root), expectedFinalTree);
});
```

Use this shape, but author literals and state independently in each real case; do not introduce a universal lifecycle harness that hides the owner inputs. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:24-34,248-250]

## State of the Art

| Prior test approach                                     | Phase 114 approach                                       | Impact                                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retained HEAD pass/fail labels                          | Normalize and directly re-prove every owner              | Accepted tests no longer receive completion credit without structural compliance. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:22-34]       |
| Supplemental single-owner files                         | Evidence lives in the mirrored owner                     | The correspondence/direct gate sees the complete oracle for the source. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:102-113]               |
| Four-value skipped-reason prose                         | Full live producer taxonomy under `ContentReason[]`      | Transport, degradation, disabled, manifest, and installability reasons remain truthful. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:41-45] |
| Update omits staged skill names during agent conversion | Update mirrors install/reinstall `knownSkills` threading | Agent skill preloads survive update as required by OR-12. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:49-51,216-218]                       |

## Assumptions Log

All prescriptive claims in this research were verified from current repository source, locked planning inputs, or live gate execution. No `[ASSUMED]` claim is used.

## Open Questions

1. **Which execution environment will carry P114-01's special-file direct gate?**
   - What we know: the current owner uses a case-owned Unix socket to reach the real `stat()` non-file/non-directory branch, and this research sandbox returns `EPERM` before the product call. [VERIFIED: tests/orchestrators/marketplace/add.test.ts:637-669; live focused test, 2026-09-01]
   - What's unclear: whether plan execution will use a POSIX runner that permits local Unix sockets.
   - Recommendation: retain the real filesystem-kind case, treat the local restriction as environmental, and require the focused/direct gate in the clean integration runner. Do not widen production solely for this runner.

## Validation Architecture

### Test Framework

| Property        | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Framework       | Node built-in `node:test` on repository engine `">=20.19.0"` [VERIFIED: package.json:32-34,82-95]                 |
| Direct coverage | Node experimental coverage → LCOV, exact mirrored owner only [VERIFIED: scripts/test-coverage-direct.mjs:237-264] |
| Quick run       | `node --test <mirrored-owner.test.ts>`                                                                            |
| Pair gate       | `npm run test:coverage:direct -- <paired-source.ts>`                                                              |
| Full suite      | `npm run check` = typecheck → lint → fallow → format → unit → integration [VERIFIED: package.json:75-95]          |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                         | Test type    | Automated command                                                                                                                                                                                                           | File exists?                                                                                                   |
| ------- | ---------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| MOD-07  | Each lifecycle owner passes alone                                | Unit         | `node --test tests/orchestrators/{marketplace,plugin}/<owner>.test.ts`                                                                                                                                                      | ✅ 14/14 [VERIFIED: .planning/ROADMAP.md:469-482]                                                              |
| MOD-07  | Each paired source has 100% direct branch/function/line coverage | Direct LCOV  | `npm run test:coverage:direct -- <source>`                                                                                                                                                                                  | ✅ gate exists; 2/14 currently complete, P114-01 environment-blocked [VERIFIED: live direct sweep, 2026-09-01] |
| PRES-02 | Notifications/reasons remain catalog-consistent                  | Architecture | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-producer-wire-coverage.test.ts tests/architecture/notify-stamp-coverage.test.ts`                                                              | ✅                                                                                                             |
| PRES-02 | Offline/credential boundaries remain closed                      | Architecture | `node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/no-credential-leak.test.ts`                                                                                                              | ✅                                                                                                             |
| PRES-02 | State/scope/cross-operation contracts remain stable              | Architecture | `node --test tests/architecture/config-state-consistency.test.ts tests/architecture/cross-op-convergence.test.ts tests/architecture/disabled-state-classification.test.ts tests/architecture/manifest-lookup-drift.test.ts` | ✅                                                                                                             |

### Per-Plan Frozen Gate

Every pair plan should run, in this order:

```bash
node --test <owner-test>
npm run test:coverage:direct -- <paired-source>
npm run typecheck
npm exec -- eslint <paired-source> <owner-test> <owned-carriers>
npm exec -- prettier --check <paired-source> <owner-test> <owned-carriers>
! rg -n 'test\.(only|skip|todo)|node:coverage ignore|c8 ignore|as unknown as|as any|anyTimes\(\)|//[[:space:]]+(Arrange|Act|Assert)' <owned-test-files>
git diff --check -- <owned-paths>
```

The static scan is a guard, not a substitute for checking every interaction mock has an explicit `verify()`, every passive collaborator is fresh plain typed data, and every runtime case has canonical lowercase AAA. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:24-34]

### Final 14-Source Direct Loop

```bash
for source in \
  extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts \
  extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts \
  extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts \
  extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts \
  extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts \
  extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/info.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/install.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/list.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts \
  extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
do
  npm run test:coverage:direct -- "$source" || exit 1
done
```

Then run the scoped architecture commands above, assert the seven old supplemental paths are absent and the two integration carriers pass, and finish with `npm run check`. [VERIFIED: package.json:75-95]

Do not make `npm run test:corresponding` a Phase 114 success gate by itself: the current tree reports 25 milestone-wide violations, including Phase 115-117 pairs outside this phase. Phase 114 should remove exactly its seven named unexpected-test paths and leave the global closure to Phase 117. [VERIFIED: live `npm run test:corresponding`, 2026-09-01; .planning/ROADMAP.md:484-518]

### Sampling Rate

- **Per task edit cycle:** focused owner file.
- **Per pair completion:** focused owner + direct coverage + typecheck + targeted static gates.
- **Per wave merge:** affected owners and direct gates, plus relevant architecture tests.
- **Phase gate:** all 14 focused owners, all 14 direct gates, two integration carriers, scoped architecture suite, and `npm run check`.

### Wave 0 Gaps

None. All 14 owner files, the direct-coverage script, stateful external fakes, architecture tests, and integration directory exist. The work is test normalization/consolidation plus the narrow P114-14 production correction. [VERIFIED: .planning/ROADMAP.md:469-482; scripts/test-coverage-direct.mjs:10-69]

## Security Domain

Security enforcement is enabled because project configuration does not disable it. The phase does not add authentication or cryptography; it must preserve the existing port, containment, and redaction boundaries. [VERIFIED: .planning/config.json; .planning/PROJECT.md:448-454]

### Applicable ASVS Categories

| ASVS category         | Applies         | Phase control                                                                                                                                                                                                |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | Yes, narrowly   | Git credentials and Device Flow are exercised only through injected memory fakes; no live keychain or token. [VERIFIED: tests/platform/credential-ops-fake.ts:45-92; tests/domain/device-flow-fake.ts:31-69] |
| V3 Session Management | No              | No web/session state exists in these lifecycle owners. [VERIFIED: .planning/ROADMAP.md:449-482]                                                                                                              |
| V4 Access Control     | Yes             | Preserve exactly the `"user"` and `"project"` scopes and cross-scope resolution rules. [VERIFIED: .planning/PROJECT.md:454]                                                                                  |
| V5 Input Validation   | Yes             | Preserve manifest/source validation, safe-name checks, clone-root containment, and basename-only user diagnostics. [VERIFIED: .planning/PROJECT.md:449]                                                      |
| V6 Cryptography       | No phase change | Do not add or hand-roll crypto; clone cache keys and Git SHAs remain existing behavior. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:9-15]                                |

### Known Threat Patterns

| Pattern                                 | STRIDE                            | Required mitigation                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live credential/token leakage           | Information disclosure            | Memory credential/Device Flow fakes, no developer credentials, and no token text in notify/error assertions. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:88-100] |
| Unexpected network escape               | Information disclosure / spoofing | Fail-fast `GitOps` allowlist and disabled-network Device Flow in every owner case. [VERIFIED: tests/platform/git-ops-fake.ts:117-120; tests/domain/device-flow-fake.ts:31-38]                        |
| Path traversal or clone-root escape     | Tampering                         | Use real case-owned roots and assert containment failures leave state/artifacts unchanged. [VERIFIED: .planning/PROJECT.md:449]                                                                      |
| Partial write presented as full success | Tampering / repudiation           | Assert state bytes, artifact inventory, structured partial/leak output, and retry. [VERIFIED: .planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md:70-86]                            |
| Absolute path disclosure                | Information disclosure            | Preserve basename-only causes and exact notification catalog forms. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:358-363]                                            |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/114-plugin-and-marketplace-lifecycle/114-CONTEXT.md` — locked decisions, supplement inventory, corrections, dependencies, and execution specifics.
- `.planning/ROADMAP.md:449-482` — phase goal, success criteria, and all 14 pairs.
- `.planning/REQUIREMENTS.md:122-123` — MOD-07.
- `.planning/PROJECT.md:441-454` — runtime, atomicity, network, containment, quality, output, and scope constraints.
- `.planning/inputs/unit-test-refactor-handoff/{DECISIONS.md,ORACLE-SCENARIOS.md,BEHAVIOR-CONTRACTS.yaml,PUBLIC-SURFACE.yaml,PERSISTENCE-CONTRACTS.yaml,ADAPTER-CONTRACTS.yaml}` — preservation authority read in full during this research.
- `.claude/rules/typescript-unit-testing.md` and `docs/guidelines/typescript-unit-testing-guidelines.md` — executable and normative unit-test contract.
- Current source and tests cited inline — CodeGraph-first source reads and focused/direct gate execution.

### Secondary (MEDIUM confidence)

- None. No external ecosystem guidance was required for this repository-local refactor.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified from `package.json`; no package change.
- Architecture: HIGH — verified from current source, locked preservation inputs, and CodeGraph call paths.
- Coverage baseline: HIGH — measured from each current mirrored owner; P114-01 explicitly marked unavailable after its focused environmental failure.
- Risks/pitfalls: HIGH — derived from current failure boundaries, locked context, and live gate behavior.

**Research date:** 2026-09-01
**Valid until:** 2026-10-01, or until lifecycle source/test ownership changes.
