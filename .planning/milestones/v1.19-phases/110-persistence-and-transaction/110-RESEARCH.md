# Phase 110: Persistence and Transaction - Research

**Researched:** 2026-08-29
**Domain:** Durable JSON state, migration replay, compensating transactions, and cross-process file locking
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Persistence fixtures and stored formats

- Use a fresh real temporary directory for every filesystem case. The same case owns and removes the directory, including corrupt-input and partial-failure cases.
- Construct persisted inputs from independent literal JSON and object values that pin the accepted wire format. Do not derive expected documents from production builders.
- Keep reusable setup in small concern-local factories beside the persistence tests. Do not create or restore a generic helper directory.
- Preserve and prove the exact current treatment of unknown fields, legacy versions, corrupt rows, invalid documents, missing files, and empty inputs.

### Migration and replay behavior

- Drive migration behavior through public load and migration entry points. Test exported pure transforms directly where they form part of the public module contract.
- Prove idempotency by sending the migrated result through the same path again and requiring an exact no-op outcome.
- For persistence failures, assert the complete public error or warning, its stable cause and fields, retained in-memory state, and exact filesystem effects.
- Assert complete stored values and exact JSON bytes where byte shape is contractual. Do not replace independent expected values with selected-field assertions or generated snapshots.

### Transaction and rollback schedules

- Fail every meaningful ledger position independently, including the failing phase's own undo path, instead of sampling only the first, middle, and last positions.
- Prove rollback with the complete newest-first call log, structured partial-failure rows, causes, leaks, and final state. Merely observing that an undo function ran is insufficient.
- Use case-local real lock paths for lock lifecycle and contention. Use the existing public dependency seams for deterministic load and save failures.
- Test timing, contention, and retry behavior with controlled promises or injected timing. Do not use real sleeps, shared locks, or broad timeout assumptions.

### Public surface and testability

- Preserve current exports. A production change for testability must be a behavior-preserving extraction or real dependency injection within the owning source-test pair; do not add test-only exports, reset hooks, or state readers.
- Normalize and re-prove every Phase 110 owner, including owners whose accepted-HEAD triage already passes focused coverage. Baseline `PASS` is input, not completion evidence.
- Every owner directly imports its paired production module and proves the complete public contract at 100 percent direct function, line, and branch coverage. Supplemental integration and architecture tests do not replace owner evidence.
- Every runtime case uses separate lowercase `// arrange`, `// act`, and `// assert` phases with the canonical blank lines. Lowercase `// act & assert` is limited to one `assert.throws()` or `assert.rejects()` expression. Data rows use separate phases, and type-only evidence uses `satisfies` or `@ts-expect-error` without artificial runtime phases.

### the agent's Discretion

- Choose names and exact shapes for concern-local factories, provided each factory remains beside its persistence or transaction concern and does not become a generic test-helper layer.
- Choose the precise failure schedule and controlled-promise mechanism needed to discriminate each public transaction branch without real sleeps.
- Make behavior-preserving internal production refactors only when the current public seam cannot provide complete direct coverage, and keep each change within its owning pair.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| MOD-03 | All 12 persistence and transaction pairs complete the pair contract. | The owner matrix gives one direct-coverage closure strategy for each exact pair. The validation map gives the focused command for each owner. [VERIFIED: .planning/REQUIREMENTS.md:108-113,241-256] |
</phase_requirements>

## Summary

Phase 110 is a test-contract refactor over 12 existing modules. It is not a persistence redesign. The production seams already expose loaders, validators, pure migrations, a phase ledger, and explicit state transactions. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:81-160; extensions/pi-claude-marketplace/persistence/migrate-config.ts:105-197; extensions/pi-claude-marketplace/transaction/phase-ledger.ts:153-173; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-104]

Fresh focused runs show that three owners pass direct coverage. Nine owners still miss at least one function, line, or branch. None of the 12 owners contains the locked lowercase phase comments. The guard owner also contains platform-dependent `t.skip()` branches. [VERIFIED: focused direct-coverage runs and owner-test structural scan, 2026-08-29]

Most closure work belongs in owner tests. Three small pair-local production edits are justified. `migrate-config.ts` must narrow the known projection before counting entries. `migrate.ts` must expose the object-only result type that it already returns. Then `state-io.ts` can remove a redundant post-migration object guard. These edits remove unreachable coverage branches without adding a test-only API. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate-config.ts:105-148,184-197; extensions/pi-claude-marketplace/persistence/migrate.ts:209-257; extensions/pi-claude-marketplace/persistence/state-io.ts:421-439]

**Primary recommendation:** Create 12 pair-atomic plans. Normalize each owner, close its measured branch gaps, and run its focused direct-coverage command before commit. [VERIFIED: .planning/REQUIREMENTS.md:63-64,96-103,112-113]

## Project Constraints (from AGENTS.md)

- The repository contains `.codegraph/`. Use CodeGraph before `grep`, `find`, or source-file reads when you locate or understand code. [VERIFIED: AGENTS.md:1-10]
- Prefer the `codegraph_explore` MCP tool when it is available. Use `codegraph explore` as the shell fallback. [VERIFIED: AGENTS.md:4-7]
- Do not create an index when `.codegraph/` is absent. Index creation is the user's decision. [VERIFIED: AGENTS.md:9]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| State, config, and agents-index wire formats | Database / Storage | API / Backend | The persistence modules parse, validate, normalize, and atomically replace local JSON documents. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:66-160; extensions/pi-claude-marketplace/persistence/config-io.ts:106-195; extensions/pi-claude-marketplace/persistence/state-io.ts:367-487] |
| Base/local config merge and write-back | Database / Storage | API / Backend | The merge keeps per-entry provenance. Write-back changes one physical config document. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:41-152; extensions/pi-claude-marketplace/persistence/config-write-back.ts:40-201] |
| Legacy migration and replay | Database / Storage | API / Backend | Pure transforms normalize accepted legacy values. Public load paths validate and persist normalized results. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:186-285; extensions/pi-claude-marketplace/persistence/migrate-config.ts:80-197; extensions/pi-claude-marketplace/persistence/state-io.ts:402-468] |
| Path construction and containment | Database / Storage | API / Backend | `locationsFor` owns scope-root paths and safe name-derived child paths. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:132-281] |
| Phase execution and compensation | API / Backend | Database / Storage | `runPhases` owns ordered work, newest-first undo, and structured rollback data. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:26-173] |
| State lock and explicit save lifecycle | API / Backend | Database / Storage | The guard locks one scope around load, mutation, optional save, and release. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:50-176] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
| --- | --- | --- | --- |
| Node.js | Runtime `v26.7.0`; project floor `>=20.19.0` | `node:test`, strict assertions, real filesystem cases, and built-in direct coverage | The package scripts already use the Node test runner and experimental coverage. Keep cases compatible with the declared Node floor. [VERIFIED: package.json:32-34,75-95; `node --version`, 2026-08-29] |
| TypeScript | `6.0.3` installed | Compile-time contract evidence and direct `.ts` test execution | The project runs `tsc --noEmit`. Type-only evidence stays module-scoped. [VERIFIED: package.json:14-30,95; `npm ls typescript --depth=0`, 2026-08-29] |
| TypeBox | `1.3.14` installed; manifest range `^1.1.38` | Compiled validators for state, config, and agents-index values | The production modules export compiled `Check` and `Errors` validators. Do not replace them. [VERIFIED: package.json:28; `npm ls typebox --depth=0`, 2026-08-29; extensions/pi-claude-marketplace/persistence/agents-index-schema.ts:15-63] |
| `write-file-atomic` | `8.0.0` | Atomic JSON replacement under the existing shared seam | The shared writer serializes same-target writes and emits two-space JSON with one trailing newline. [VERIFIED: package.json:8-12; `npm ls write-file-atomic --depth=0`, 2026-08-29; extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30] |
| `proper-lockfile` | `4.1.2` | Per-scope cross-process lock lifecycle | The guard uses a case-visible lock path and fail-fast acquisition. [VERIFIED: package.json:8-12; `npm ls proper-lockfile --depth=0`, 2026-08-29; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:106-176] |

### Supporting

| Library or tool | Version | Purpose | When to Use |
| --- | --- | --- | --- |
| `strong-mock` | `9.2.2` | Exact interaction expectations and final verification | Use it only for a true interaction mock. A Node test-context method replacement is a case-local stub or spy. [VERIFIED: package.json:14-30; `npm ls strong-mock --depth=0`, 2026-08-29; .planning/REQUIREMENTS.md:46-59] |
| `scripts/test-coverage-direct.mjs` | Repository script | Map one owner to one source and require one complete LCOV record | Run it for every task commit. It rejects missing pair members and incomplete functions, branches, or lines. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,207-264] |
| `node:fs/promises` and `node:test` | Built in | Unique temporary directories and case cleanup | Create each directory inside its case. Register cleanup on that case's test context. [CITED: https://nodejs.org/api/fs.html#fspromisesmkdtempprefix-options] [CITED: https://nodejs.org/api/test.html#contextafterfn-options] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| Existing project stack | A new test runner, in-memory filesystem, deep-merge library, or lock fake | Out of scope. These alternatives bypass the public filesystem and lock behavior that MOD-03 must prove. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:10-66] |

**Installation:** None. Phase 110 installs no package and changes no dependency version. [VERIFIED: phase boundary and current package audit, 2026-08-29]

## Package Legitimacy Audit

Not applicable. The phase installs no external package. The package-legitimacy gate is not required. [VERIFIED: Phase 110 scope audit, 2026-08-29]

## Public Wire and Result Contracts

The planner must treat these values as stable public contracts.

DATA_P4N7K2QD_START

```text
agents-index: schemaVersion: 1; agents
config schemaVersion: optional literal 1
config load status: "absent" | "invalid" | "valid"
state schemaVersion: 1 | 2
state default: { schemaVersion: 2, marketplaces: {} }
```

DATA_P4N7K2QD_END

[VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-schema.ts:40-63; extensions/pi-claude-marketplace/persistence/config-io.ts:59-118; extensions/pi-claude-marketplace/persistence/state-io.ts:281-308]

The agents-index loader distinguishes file corruption from row corruption. A missing file returns an empty version-1 view. Parse, version, and envelope failures throw. Invalid rows are dropped and reported. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:66-143]

DATA_C9V5R8MX_START

```typescript
export type ConfigLoadResult =
  | { readonly status: "absent" }
  | { readonly status: "invalid"; readonly filePath: string; readonly error: string }
  | { readonly status: "valid"; readonly filePath: string; readonly config: ScopeConfig };
```

DATA_C9V5R8MX_END

[VERIFIED: extensions/pi-claude-marketplace/persistence/config-io.ts:115-118]

Config input is lenient for unknown fields. The public loader still distinguishes missing, unreadable, malformed, schema-invalid, and valid documents. The writer validates before containment and atomic replacement. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-io.ts:59-75,121-195]

DATA_H2L6T9WA_START

```text
migration reasons: "existing-valid" | "existing-invalid" | "empty-state"
successful migration: migrated: true
suppressed migration: migrated: false
```

DATA_H2L6T9WA_END

[VERIFIED: extensions/pi-claude-marketplace/persistence/migrate-config.ts:57-78]

First-run config migration writes only when config is absent and projected state is nonempty. A second call observes the created valid file and performs no write. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate-config.ts:150-197]

DATA_J7Q3M5SN_START

```typescript
export interface RunPhasesResult {
  readonly ok: boolean;
  readonly error?: Error;
  readonly rollbackPartials: readonly RollbackPartial[];
  readonly leaks: readonly string[];
}
```

DATA_J7Q3M5SN_END

[VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:62-73]

The ledger runs the failing phase's undo first. Then it compensates completed phases newest-first. Ordinary undo errors become structured rows. A `PathContainmentError` escapes immediately. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:75-173]

DATA_R8D4K1VC_START

```text
"state.json"
".state-lock"
"agents-index.json"
"claude-plugins.json"
"claude-plugins.local.json"
```

DATA_R8D4K1VC_END

[VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:147-160]

## Architecture Patterns

### System Architecture Diagram

```text
Literal JSON or object
        |
        v
public load / pure transform
        |
        +--> parse or read failure --------> exact public error/result
        |
        v
compiled schema validation
        |
        +--> invalid ----------------------> exact rejection, no disk change
        |
        v
normalize legacy value --> replay same path --> exact fixed point
        |
        v
public save --> containment --> atomic temp write + rename --> exact JSON bytes

transaction caller
        |
        v
case-local scope lock --> fresh load --> ordered phases
        |                                  |
        |                                  +--> failure --> own undo
        |                                                   --> newest-first undo
        |                                                   --> structured partials
        v
explicit save on success --> lock release --> retry can acquire
```

The diagram follows the current production sequence. It does not add an abstraction. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-io.ts:129-195; extensions/pi-claude-marketplace/persistence/state-io.ts:378-487; extensions/pi-claude-marketplace/transaction/phase-ledger.ts:153-173; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-176]

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── persistence/          # Nine Phase 110 persistence owners
└── transaction/          # Three Phase 110 transaction owners
tests/
├── persistence/          # One mirrored owner beside concern-local factories
└── transaction/          # One mirrored owner beside schedules and deferred helpers
```

Keep every pair in its current mirrored path. Do not create a generic helper directory. [VERIFIED: .planning/REQUIREMENTS.md:241-256; .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:14-66]

### Pattern 1: Case-Owned Filesystem Fixture

Create the temporary directory inside the `test()` callback. Register `t.after()` immediately. Then create every input in that directory. Node documents `context.after()` as a hook that runs after the current test. [CITED: https://nodejs.org/api/test.html#contextafterfn-options]

Use `rm(directory, { recursive: true, force: true, maxRetries: 3 })` when retries are necessary. Node provides bounded retry behavior for recursive `rm`; a custom sleep loop is not necessary. [CITED: https://nodejs.org/api/fs.html#fspromisesrmpath-options]

### Pattern 2: Independent Wire Values

Write literal JSON text or literal objects. Define the complete expected value separately. Do not call a production builder to create either side. For writer cases, read the file as UTF-8 and compare exact bytes when order and whitespace are contractual. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:14-30; extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30]

### Pattern 3: Public-Path Branch Closure

Reach private helpers through exported functions. A case can replace a mutable compiled validator method with `t.mock.method()` to reach a defensive formatter fallback. The test context restores method replacements after the case. [VERIFIED: runtime property-descriptor probe for compiled validator `Errors`, 2026-08-29] [CITED: https://nodejs.org/api/test.html#mocking]

Use a production refactor only for a logically unreachable branch. Narrow the type at the owner that establishes the invariant. Remove the redundant guard in its consumer during that consumer's pair plan. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:209-257; extensions/pi-claude-marketplace/persistence/state-io.ts:421-439]

### Pattern 4: Deterministic Transaction Schedule

Generate independent tests from named schedule rows. Put lowercase arrange, act, and assert phases inside each generated test callback. Record every `do` and `undo` call. Compare the complete log, result, causes, leaks, and context state. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:32-42,70-76]

For lock contention, let the first transaction resolve an `entered` promise after lock acquisition. Hold its callback on another promise. Start the contender only after `entered` resolves. Release the first callback without a timer. [VERIFIED: public callback placement after acquisition in extensions/pi-claude-marketplace/transaction/with-state-guard.ts:111-152]

### Pattern 5: One Pair per Plan and Commit

Each executable plan owns one production source and its mirrored owner test. Supporting edits stay in that concern. A dependency between pairs becomes plan ordering, not a multi-pair commit. [VERIFIED: .planning/REQUIREMENTS.md:94-106]

### Anti-Patterns to Avoid

- **Shared temporary root:** It creates cross-case state and lock collisions. Create one directory per case. [VERIFIED: .planning/REQUIREMENTS.md:32-44]
- **Fixture-derived expectation:** It can reproduce the same defect on both sides. Use independent literal expected values. [VERIFIED: .planning/REQUIREMENTS.md:46-52]
- **Real sleep:** It makes retry and cleanup timing platform-dependent. Use controlled promises or bounded `rm` retries. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:32-42] [CITED: https://nodejs.org/api/fs.html#fspromisesrmpath-options]
- **Platform skip:** It leaves branches unproved. Replace chmod-based lock failures with a case-local method stub on `lockfile.lock`. [VERIFIED: tests/transaction/with-state-guard.test.ts:501-570; current owner structural scan, 2026-08-29]
- **Aggregate-only rollback assertion:** It can miss order, own-undo, cause, or leak regressions. Assert the complete structured result and call log. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:153-173]
- **Test-only production API:** It violates the production-design contract. Use existing public seams, mutable dependency methods, or a real behavior-preserving type refinement. [VERIFIED: .planning/REQUIREMENTS.md:79-88]
- **Deep config merge:** Local entries replace base entries whole. Field merging changes the durable contract. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:73-123]
- **`mkdtempDisposable`:** Node added it in v24.4.0, but the project supports Node 20.19. Use `mkdtemp` plus `t.after`. [VERIFIED: package.json:32-34] [CITED: https://nodejs.org/api/fs.html#fspromisesmkdtempdisposableprefix-options]

## Owner-by-Owner Planning Guidance

The baseline counts come from fresh focused direct-coverage runs on 2026-08-29. Each plan must still normalize all runtime cases and re-prove the whole owner. [VERIFIED: focused direct-coverage runs, 2026-08-29]

| Pair | Baseline | Prescriptive closure |
| --- | --- | --- |
| P110-01 `agents-index-io.ts` | Functions 4/4, branches 22/24, lines 155/160 | Add a non-ENOENT read failure with a directory at the index path. Stub `AGENTS_INDEX_ENTRY_VALIDATOR.Errors` to an empty list in one invalid-row public-load case. Assert the complete fallback corruption text. Replace file fixtures with literal documents. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:55-64,81-160] |
| P110-02 `agents-index-schema.ts` | Direct coverage passes: branches 1/1, functions 0/0, lines 63/63 | Normalize every case. Keep independent valid rows. Prove optional `originalModel`, every required array, version `1`, rejection of version `2`, and rejection of `entries` in place of `agents`. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-schema.ts:18-63] |
| P110-03 `config-io.ts` | Functions 3/4, branches 15/17, lines 191/195 | Add direct `isDeclaredEnabled` cases for absent, true, and false. Add a root-level invalid document. Stub `CONFIG_VALIDATOR.Errors` empty through a public load or save case. Keep exact absent/invalid/valid results, containment errors, and writer bytes. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-io.ts:81-104,115-195] |
| P110-04 `config-merge.ts` | Direct coverage passes: branches 15/15, functions 2/2, lines 152/152 | Normalize and re-prove empty, base-only, local-only, collision, dangling plugin, and both load arms. Replace cleanup sleep loops with case-owned `t.after`. Assert full provenance and per-file results. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:73-152] |
| P110-05 `config-write-back.ts` | Functions 5/5, branches 16/19, lines 201/201 | Add cascade input with no plugin map. Add a marketplace-only batch and a plugin-only batch to cover both omitted batch arms. Add a batch that creates absent entries. Compare one complete saved document and exact bytes per case. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-write-back.ts:81-105,155-201] |
| P110-06 `locations.ts` | Functions 6/7, branches 14/14, lines 277/281 | Call `sourcesStagingDir` for a safe UUID-like value and assert containment under the exact staging root. Normalize every path and rejection case. Restore `PI_CODING_AGENT_DIR` in the owning case. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:120-129,261-277] |
| P110-07 `migrate-config.ts` | Functions 2/2, branches 16/19, lines 197/197 | Add a nullish stored-source projection and require the exact string form. Narrow `buildConfigFromState`'s return type so `marketplaces` and `plugins` are known present. Remove the redundant `?? {}` entry-count branches. Replay the migrated file and prove byte identity and no rewrite. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate-config.ts:105-148,166-197] |
| P110-08 `migrate.ts` | Functions 7/7, branches 48/51, lines 277/285 | Add one non-object marketplace row and one non-object plugin row. The plugin row closes both resource and enabled skip paths. Refine `MigrationResult.marketplaces` to object-valued rows because the transform already filters other rows. Use literal legacy values, not shared JSON fixtures. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:100-184,209-257] |
| P110-09 `state-io.ts` | Functions 8/9, branches 31/43, lines 458/487 | Cover `isRecordedButDisabled`; clone without `resolvedSha`; root validator detail and empty-error fallback; raw unknown source; null source; stored path, GitHub, valid URL, and invalid URL forms; non-ENOENT read; and post-normalization schema failure. After P110-08 narrows its result, remove the redundant non-object marketplace guard. Pre-register a case-local filesystem watcher for `state.json`, call `loadState`, await the target-file event, and assert exact persisted bytes. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:147-179,252-254,315-365,378-468] [CITED: https://nodejs.org/api/fs.html#fspromiseswatchfilename-options] |
| P110-10 `phase-ledger.ts` | Functions 3/3, branches 26/27, lines 173/173 | Add a non-Error forward throw and require an `Error` result. Replace sampled failure coverage with named rows for every phase position. Include no-undo, own-undo success, own-undo failure, multiple reverse failures, and both containment-error sites. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:75-173] |
| P110-11 `rollback.ts` | Direct coverage passes: branches 6/6, functions 1/1, lines 75/75 | Normalize and re-prove path-containment bypass, zero-partial identity, one or many partials, exact original cause identity, and raw partial preservation. Keep rendering assertions outside this owner. [VERIFIED: extensions/pi-claude-marketplace/transaction/rollback.ts:22-75] |
| P110-12 `with-state-guard.ts` | Functions 9/9, branches 28/32, lines 171/176 | Add duplicate `tx.save()`. Stub lock acquisition to throw an ordinary Error and a non-Error. Stub release to fail after success and after a non-Error body failure. Remove both platform skips. Add a controlled-promise contention and retry case with real case-local paths. Use injected load/save only for their documented failure cases. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:83-176; tests/transaction/with-state-guard.test.ts:501-570] |

### Recommended Plan Dependencies

1. Complete P110-02, P110-06, and P110-11 first. They establish schema, path, and rollback evidence without cross-pair production changes. [VERIFIED: source dependency audit, 2026-08-29]
2. Complete P110-01, P110-03, P110-05, P110-08, and P110-10 next. P110-08 must refine the migration result type. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:23-33; extensions/pi-claude-marketplace/persistence/config-write-back.ts:33-38; extensions/pi-claude-marketplace/persistence/migrate.ts:209-257]
3. Complete P110-04, P110-07, P110-09, and P110-12 last. P110-09 consumes the P110-08 type refinement. P110-12 consumes state and location behavior. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:31-39; extensions/pi-claude-marketplace/persistence/state-io.ts:25-36; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:31-48]

This ordering is a dependency recommendation. Each executable plan and commit still owns one pair. [VERIFIED: .planning/REQUIREMENTS.md:94-106]

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
| --- | --- | --- | --- |
| Atomic JSON replacement | A test writer or custom rename protocol | Public save function through `atomicWriteJson` | The current seam writes a temporary file, syncs by default, renames, and cleans the temporary file on error. [VERIFIED: extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30] [CITED: https://github.com/npm/write-file-atomic] |
| Cross-process lock | Shared boolean, sleep loop, or fake lock file | Real case-local `proper-lockfile` path | The library uses atomic directory creation and exposes an async release function. [CITED: https://github.com/moxystudio/node-proper-lockfile] |
| Config merge | Generic deep-merge helper | `mergeScopeConfigs` whole-entry replacement | Base fields must not leak into a local replacement. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:73-123] |
| Migration oracle | Production builder or generated snapshot | Independent literal legacy input and complete expected normalized value | A shared builder can hide the same regression in setup and assertion. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:14-30] |
| Cleanup helper layer | `tests/helpers` or a shared temp root | Small factory in the owner file plus `t.after` | Each case must own its directory and cleanup. [VERIFIED: .planning/REQUIREMENTS.md:32-44,129-137] |
| Transaction timing | `setTimeout`, broad timeout, or elapsed-time assertion | Controlled promises | The callback itself proves lock acquisition, so a promise gives a deterministic scheduling point. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:111-152] |

**Key insight:** The production seams already own atomicity, validation, and locking. Owner tests must observe those seams instead of duplicating them. [VERIFIED: extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-176]

## Runtime State Inventory

| Category | Items Found | Action Required |
| --- | --- | --- |
| Stored data | The durable local files are `"state.json"`, `"agents-index.json"`, `"claude-plugins.json"`, and `"claude-plugins.local.json"`. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:147-160] | No user-data migration. Tests create literal copies only under fresh temporary scope roots. Production formats and public paths stay unchanged. [VERIFIED: Phase 110 boundary and owner strategy, 2026-08-29] |
| Live service config | None in Phase 110. The 12 sources use local filesystem, schema, path, and lock seams. [VERIFIED: Phase 110 source import audit, 2026-08-29] | None. Do not add live services to unit cases. [VERIFIED: .planning/REQUIREMENTS.md:129-137] |
| OS-registered state | None. The phase does not register a service, task, process, or daemon. [VERIFIED: Phase 110 source audit, 2026-08-29] | None. Real lock sentinels remain inside each case's temporary scope. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:147-160] |
| Secrets and environment variables | The location owner changes `"PI_CODING_AGENT_DIR"` during user-scope cases. [VERIFIED: tests/persistence/locations.test.ts:19-35] | Restore the exact prior value in the same case. Do not use credentials. [VERIFIED: .planning/REQUIREMENTS.md:40-44,128-137] |
| Build artifacts and installed packages | The direct-coverage script creates `"pi-claude-direct-"` temporary directories and removes them in `finally`. [VERIFIED: scripts/test-coverage-direct.mjs:237-264] | No reinstall. Each owner also removes its own case directory. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:14-18] |

After repository edits, no external runtime system retains an old identifier. This phase changes test evidence, not durable names or formats. [VERIFIED: Phase 110 boundary, 110-CONTEXT.md:8-11]

## Common Pitfalls

### Pitfall 1: Treating `PASS` as Completion

**What goes wrong:** The three baseline PASS owners keep old structure and fail the locked case contract. [VERIFIED: owner structural scan and focused runs, 2026-08-29]

**Why it happens:** Direct coverage measures execution. It does not measure lowercase phases, independent values, or pair-atomic evidence. [VERIFIED: scripts/test-coverage-direct.mjs:207-264; .planning/REQUIREMENTS.md:32-59]

**How to avoid:** Rewrite and re-prove P110-02, P110-04, and P110-11 like every other owner. [VERIFIED: .planning/REQUIREMENTS.md:241-256]

**Warning signs:** A plan says “already passes” or contains no owner-test edit. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:50-58]

### Pitfall 2: Polling for Fire-and-Forget Migration

**What goes wrong:** A case sleeps until the background save appears. It becomes slow and timing-dependent. [VERIFIED: current polling in tests/persistence/state-io.test.ts:256-301]

**Why it happens:** `loadState` intentionally does not await `persistMigratedState`. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:367-376,462-466]

**How to avoid:** Start a case-local `fsPromises.watch()` iterator on the temporary scope directory before `loadState`. Await the `state.json` event, close the watcher through an `AbortController` in `t.after`, then assert exact bytes. Do not add a reset hook. [VERIFIED: .planning/REQUIREMENTS.md:79-88] [CITED: https://nodejs.org/api/fs.html#fspromiseswatchfilename-options]

**Warning signs:** `setTimeout`, retry counters, or a broad test timeout in a migration owner. [VERIFIED: current owner scan, 2026-08-29]

### Pitfall 3: Keeping Unreachable Defensive Branches

**What goes wrong:** Tests attempt impossible JSON shapes or add a test-only API to satisfy coverage. [VERIFIED: measured gaps at migrate-config.ts:186 and state-io.ts:433, 2026-08-29]

**Why it happens:** A producer returns a stronger shape than its declared type. The consumer then repeats a guard. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:42-45,209-257; extensions/pi-claude-marketplace/persistence/state-io.ts:421-439]

**How to avoid:** Refine the producer type in P110-08. Remove the redundant consumer guard in P110-09. Narrow the config projection in P110-07. [VERIFIED: owner strategy, 2026-08-29]

**Warning signs:** A new exported reset, a coverage-ignore comment, or an input that JSON cannot produce. [VERIFIED: .planning/REQUIREMENTS.md:79-88,133-137]

### Pitfall 4: Platform-Dependent Lock Failure

**What goes wrong:** chmod-based cases skip on Windows or under root. The suite leaves release branches unproved. [VERIFIED: tests/transaction/with-state-guard.test.ts:501-570]

**Why it happens:** The case depends on host permission semantics. [VERIFIED: current guard owner, 2026-08-29]

**How to avoid:** Keep real paths for lifecycle and contention. Use a case-local method stub only for acquisition and release error injection. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:32-42]

**Warning signs:** `process.platform`, `process.getuid`, `chmod`, `t.skip`, or real sleeps. [VERIFIED: tests/transaction/with-state-guard.test.ts:501-570]

### Pitfall 5: Partial Transaction Assertions

**What goes wrong:** A compensation can run in the wrong order, lose a cause, or mutate final state while the test still passes. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:41-73,153-173]

**Why it happens:** The case asserts one callback or one row instead of the complete schedule. [VERIFIED: .planning/phases/110-persistence-and-transaction/110-CONTEXT.md:32-42]

**How to avoid:** Compare the full log, exact result, original error identity, every partial row, leaks, and final context. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:56-73]

**Warning signs:** `assert.ok(log.includes(...))` or field-by-field assertions that omit result members. [VERIFIED: .planning/REQUIREMENTS.md:46-56]

## Code Examples

### Case-Owned Temp Directory and Exact Bytes

This current completed-owner pattern has the required phase comments and case cleanup. Adapt the pattern, not its values. [VERIFIED: tests/shared/atomic-json.test.ts:9-21]

DATA_F6Z2P9HB_START

```typescript
test("writes two-space JSON with one trailing newline", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "out.json");
  const expectedJsonBytes = '{\n  "ok": true,\n  "count": 7\n}\n';

  // act
  await atomicWriteJson(filePath, { ok: true, count: 7 });
  const jsonBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(jsonBytes, expectedJsonBytes);
});
```

DATA_F6Z2P9HB_END

[VERIFIED: tests/shared/atomic-json.test.ts:9-21]

### Data Rows Keep Their Own Phases

The completed atomic writer owner generates independent tests from rows. Each callback repeats the three runtime phases. Copy that structure from the owner when a Phase 110 test uses rows. Do not lift its data values into persistence expectations. [VERIFIED: tests/shared/atomic-json.test.ts:108-138]

### Public State Transaction Seam

The existing explicit transaction seam injects only state load and save behavior. Keep real locks around those deterministic failures. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:40-48,83-104]

DATA_T5C7N2RK_START

```typescript
export interface LockedStateTransactionDeps {
  readonly loadState?: typeof loadState;
  readonly saveState?: typeof saveState;
}

export async function withLockedStateTransaction<T>(
  locations: ScopedLocations,
  run: (tx: LockedStateTransaction) => Promise<T> | T,
  deps?: LockedStateTransactionDeps,
): Promise<T>
```

DATA_T5C7N2RK_END

[VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:40-48,83-87]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| Shared fixture files for accepted wire values | Independent literal JSON and objects in each owner | Locked for Phase 110 on 2026-08-29 | Expected values cannot drift with a shared production-shaped fixture. [VERIFIED: 110-CONTEXT.md:14-30] |
| Cleanup loops with custom 25 ms sleeps | `t.after` plus recursive `rm` and built-in bounded retries | Available at the declared Node floor | Cleanup stays case-owned without timing logic. [CITED: https://nodejs.org/api/test.html#contextafterfn-options] [CITED: https://nodejs.org/api/fs.html#fspromisesrmpath-options] |
| Sampled first/middle/last ledger failures | One named case per meaningful phase position | Locked for Phase 110 on 2026-08-29 | The suite proves every compensation prefix and own-undo position. [VERIFIED: 110-CONTEXT.md:32-42] |
| chmod-based release failures with skips | Case-local method stubs for error injection, real paths for lifecycle | Recommended for Phase 110 | The same branches run on every supported platform. [VERIFIED: tests/transaction/with-state-guard.test.ts:501-570] |

**Deprecated or outdated:**

- Shared legacy fixture directories are not the Phase 110 oracle. Replace their use with literals in the owner file. [VERIFIED: 110-CONTEXT.md:14-22]
- Real-sleep cleanup and migration polling are not permitted transaction or replay evidence. [VERIFIED: 110-CONTEXT.md:32-42]
- Platform skips in the guard owner are not permitted. CASE-04 requires independent tests without skip markers. [VERIFIED: .planning/REQUIREMENTS.md:43-44]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
| --- | --- | --- | --- |
| — | None. All implementation claims come from current source, fresh focused runs, project decisions, or official documentation. | — | — |

## Open Questions

None. The accepted context resolves fixture ownership, replay expectations, transaction scheduling, and production testability. [VERIFIED: 110-CONTEXT.md:12-66]

## Validation Architecture

### Test Framework

| Property | Value |
| --- | --- |
| Framework | Node.js built-in test runner on runtime `v26.7.0`; package floor `>=20.19.0` [VERIFIED: package.json:32-34,82-95; `node --version`, 2026-08-29] |
| Config file | None. Scripts live in `package.json`. [VERIFIED: package.json:75-95] |
| Quick run command | `npm run test:coverage:direct -- <owner-test-path>` [VERIFIED: package.json:88-90; scripts/test-coverage-direct.mjs:267-289] |
| Full suite command | `npm run check` [VERIFIED: package.json:75-95] |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| MOD-03 / P110-01 | Agents-index file and row failure split; atomic save bytes | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/agents-index-io.test.ts` | Yes; content gap |
| MOD-03 / P110-02 | Agents-index schema and validators | Unit | `npm run test:coverage:direct -- tests/persistence/agents-index-schema.test.ts` | Yes; normalize |
| MOD-03 / P110-03 | Config load trichotomy, leniency, validation, containment, save | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/config-io.test.ts` | Yes; content gap |
| MOD-03 / P110-04 | Whole-entry merge, provenance, per-file outcomes | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/config-merge.test.ts` | Yes; normalize |
| MOD-03 / P110-05 | Physical config patch, cascade, batch, one write | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/config-write-back.test.ts` | Yes; content gap |
| MOD-03 / P110-06 | Scope paths, safe derived paths, frozen bundle | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/locations.test.ts` | Yes; content gap |
| MOD-03 / P110-07 | First-run projection, suppression, persistence, replay | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/migrate-config.test.ts` | Yes; content and type gap |
| MOD-03 / P110-08 | Pure legacy normalization and best-effort warning | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/migrate.test.ts` | Yes; content and type gap |
| MOD-03 / P110-09 | State load, migration, source funnel, schema, atomic save | Unit with real filesystem | `npm run test:coverage:direct -- tests/persistence/state-io.test.ts` | Yes; content gap |
| MOD-03 / P110-10 | Every forward failure and newest-first compensation schedule | Unit | `npm run test:coverage:direct -- tests/transaction/phase-ledger.test.ts` | Yes; content gap |
| MOD-03 / P110-11 | Structured rollback error identity and partials | Unit | `npm run test:coverage:direct -- tests/transaction/rollback.test.ts` | Yes; normalize |
| MOD-03 / P110-12 | Lock, load, save, release, contention, and retry | Unit with real filesystem | `npm run test:coverage:direct -- tests/transaction/with-state-guard.test.ts` | Yes; content gap |

[VERIFIED: .planning/REQUIREMENTS.md:241-256; focused direct-coverage runs, 2026-08-29]

### Sampling Rate

- **Per task commit:** Run the exact focused direct-coverage command for that pair. Run `npm run typecheck` when the pair changes a production type. [VERIFIED: package.json:88-95]
- **Per wave merge:** Run `npm test` and all focused commands for pairs in the wave. [VERIFIED: package.json:82-90]
- **Phase gate:** Run all 12 focused commands, `npm run test:corresponding`, and `npm run check`. [VERIFIED: package.json:75-95; .planning/REQUIREMENTS.md:63-77]

### Wave 0 Gaps

None. All 12 owner files and the direct-coverage runner exist. Each pair plan closes content and structure in its owner. [VERIFIED: .planning/REQUIREMENTS.md:241-256; repository file audit, 2026-08-29]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement` to `false`. [VERIFIED: .planning/config.json:1-53]

### Applicable ASVS 5.0 Categories

| ASVS Category | Applies | Phase Control |
| --- | --- | --- |
| V1 Encoding and Sanitization | Yes | JSON parsing and stored source normalization use one public funnel before later use. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:326-365,393-460] [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x10-V1-Encoding-and-Sanitization.md] |
| V2 Validation and Business Logic | Yes | TypeBox checks enforce stored structures. The ledger, rollback, and lock prove transaction and concurrency controls. [VERIFIED: extensions/pi-claude-marketplace/persistence/config-io.ts:145-195; extensions/pi-claude-marketplace/transaction/phase-ledger.ts:153-173; extensions/pi-claude-marketplace/transaction/with-state-guard.ts:106-176] [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json] |
| V3 Web Frontend Security | No | Phase 110 has no browser or frontend surface. [VERIFIED: Phase 110 source audit, 2026-08-29] |
| V4 API and Web Service | No | Phase 110 has no HTTP or web-service boundary. [VERIFIED: Phase 110 source audit, 2026-08-29] |
| V5 File Handling | Yes | Safe name checks, containment, fixed filenames, atomic replacement, and real lock paths protect local files. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:216-277; extensions/pi-claude-marketplace/persistence/config-io.ts:182-195] [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json] |
| V6 Authentication | No | These modules handle no credentials or authentication decision. [VERIFIED: Phase 110 source audit, 2026-08-29] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
| --- | --- | --- |
| Corrupt or malicious persisted JSON | Tampering | Parse once, validate the full envelope, distinguish row soft failures, and reject invalid saves before disk writes. [VERIFIED: extensions/pi-claude-marketplace/persistence/agents-index-io.ts:81-160; extensions/pi-claude-marketplace/persistence/config-io.ts:129-195; extensions/pi-claude-marketplace/persistence/state-io.ts:378-487] |
| Path traversal or separator-bearing names | Tampering / Elevation of privilege | Use `assertSafeName` before joining untrusted names and `assertPathInside` before returning or writing. [VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:216-277; extensions/pi-claude-marketplace/persistence/config-io.ts:182-195] |
| Lost update from concurrent processes | Tampering | Hold one per-scope `proper-lockfile` lock across load, mutation, save, and release. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:106-176] |
| Partial write or mixed JSON bytes | Tampering / Denial of service | Use the sanctioned atomic writer and compare exact complete bytes in owner tests. [VERIFIED: extensions/pi-claude-marketplace/shared/atomic-json.ts:24-30] [CITED: https://github.com/npm/write-file-atomic] |
| Suppressed rollback failure | Repudiation / Tampering | Preserve the original error, structured newest-first partial rows, and nested causes. [VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:41-73,153-173; extensions/pi-claude-marketplace/transaction/rollback.ts:59-75] |
| Lock or temp-directory leak after failure | Denial of service | Release in `finally`. Register case cleanup immediately through `t.after`. [VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:125-152; tests/shared/atomic-json.test.ts:9-21] |

## Sources

### Primary (HIGH confidence)

- Current Phase 110 production sources and owner tests, read 2026-08-29.
- Fresh focused direct-coverage runs for all 12 owners, 2026-08-29.
- `.planning/REQUIREMENTS.md`, `110-CONTEXT.md`, `.planning/STATE.md`, and `.planning/config.json`.
- `package.json`, installed package tree, and `scripts/test-coverage-direct.mjs`.

### Secondary (MEDIUM confidence)

- https://nodejs.org/api/test.html - Test-context cleanup and automatic mock restoration.
- https://nodejs.org/api/fs.html - Unique temporary directories and bounded recursive removal.
- https://github.com/moxystudio/node-proper-lockfile - Lock acquisition, release, stale, update, retry, and realpath semantics.
- https://github.com/npm/write-file-atomic - Atomic rename, same-target serialization, and temporary-file cleanup.
- https://github.com/sinclairzx81/typebox/discussions/766 - Maintainer guidance for compiled validation.
- https://github.com/OWASP/ASVS - ASVS 5.0 category and requirement references.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. Versions come from the current manifest, installed tree, and runtime probes.
- Architecture: HIGH. The module source and caller imports define every flow.
- Pitfalls: HIGH. Fresh LCOV branch data and current owner structure expose the gaps.
- External library semantics: MEDIUM. Official project and Node documentation support the cited behavior.

**Environment audit:** No live service or external CLI is required beyond the installed Node/npm project environment. Node `v26.7.0` and npm `11.19.0` are available. [VERIFIED: runtime probes, 2026-08-29]

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 for the stable codebase findings. Re-run focused coverage after any source change.
