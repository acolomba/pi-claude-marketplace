# Phase 110: Persistence and Transaction - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 24 files in 12 source-owner pairs
**Analogs found:** 12 / 12 pairs

## Scope contract

Each plan owns exactly one production source and its mirrored owner test. A plan can leave the production source unchanged, but it must normalize and re-prove the owner. Do not add a generic helper directory or a test-only production API.

Every runtime case must use this exact structure:

```typescript
// arrange

// act

// assert
```

Use lowercase `// act & assert` only when the phase contains one `assert.throws()` or `assert.rejects()` expression. Generated data-row callbacks keep separate runtime phases. Keep true type-only evidence at module scope with `satisfies` or `@ts-expect-error`; do not add fake runtime phases.

## File Classification

| Pair    | Production Source                                                     | Mirrored Owner                                  | Production Role       | Data Flow                                        | Closest Completed Analog                | Match Quality           |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------- | --------------------- | ------------------------------------------------ | --------------------------------------- | ----------------------- |
| P110-01 | `extensions/pi-claude-marketplace/persistence/agents-index-io.ts`     | `tests/persistence/agents-index-io.test.ts`     | storage service       | file-I/O, validation, transform                  | `tests/shared/completion-cache.test.ts` | exact flow              |
| P110-02 | `extensions/pi-claude-marketplace/persistence/agents-index-schema.ts` | `tests/persistence/agents-index-schema.test.ts` | schema model          | validation, transform                            | `tests/shared/completion-cache.test.ts` | exact role              |
| P110-03 | `extensions/pi-claude-marketplace/persistence/config-io.ts`           | `tests/persistence/config-io.test.ts`           | storage service       | file-I/O, validation                             | `tests/shared/completion-cache.test.ts` | exact flow              |
| P110-04 | `extensions/pi-claude-marketplace/persistence/config-merge.ts`        | `tests/persistence/config-merge.test.ts`        | reducer service       | transform, file-I/O                              | `tests/domain/source.test.ts`           | role-match              |
| P110-05 | `extensions/pi-claude-marketplace/persistence/config-write-back.ts`   | `tests/persistence/config-write-back.test.ts`   | storage service       | CRUD, batch, file-I/O                            | `tests/shared/atomic-json.test.ts`      | exact flow              |
| P110-06 | `extensions/pi-claude-marketplace/persistence/locations.ts`           | `tests/persistence/locations.test.ts`           | path utility/provider | path derivation, file-I/O                        | `tests/shared/fs-utils.test.ts`         | exact flow              |
| P110-07 | `extensions/pi-claude-marketplace/persistence/migrate-config.ts`      | `tests/persistence/migrate-config.test.ts`      | migration service     | transform, file-I/O, replay                      | `tests/shared/completion-cache.test.ts` | exact flow              |
| P110-08 | `extensions/pi-claude-marketplace/persistence/migrate.ts`             | `tests/persistence/migrate.test.ts`             | migration service     | transform, file-I/O warning                      | `tests/domain/source.test.ts`           | exact transform         |
| P110-09 | `extensions/pi-claude-marketplace/persistence/state-io.ts`            | `tests/persistence/state-io.test.ts`            | storage service       | file-I/O, validation, migration replay           | `tests/shared/completion-cache.test.ts` | exact flow              |
| P110-10 | `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`        | `tests/transaction/phase-ledger.test.ts`        | transaction service   | event-driven compensation                        | `tests/shared/fs-utils.test.ts`         | exact compensation flow |
| P110-11 | `extensions/pi-claude-marketplace/transaction/rollback.ts`            | `tests/transaction/rollback.test.ts`            | transaction utility   | structured-error transform                       | `tests/shared/fs-utils.test.ts`         | role-match              |
| P110-12 | `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`    | `tests/transaction/with-state-guard.test.ts`    | transaction guard     | file-I/O, concurrency, request-response callback | `tests/shared/fs-utils.test.ts`         | role and flow match     |

All mirrored owners have role `test`. Their data flow matches the production pair and must directly import that pair's production source.

## Selected completed analogs

The map stops at five strong analogs. Git history identifies them as completed Phase 108 or Phase 109 owners.

| Analog                                  | Completion Evidence                               | Pattern to Copy                                                                                            |
| --------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tests/shared/atomic-json.test.ts`      | `c2af1f85`, `cb5f059a` (`109-01`)                 | exact JSON bytes, case-owned temporary directories, data rows with phases inside callbacks                 |
| `tests/shared/completion-cache.test.ts` | `e1817022`, `d9db0f61` (`109-02` plus review fix) | durable JSON load/rebuild, schema publication, cause identity, replay-like rehydration, `satisfies` values |
| `tests/domain/source.test.ts`           | `c4ac4b32`, `7f8fff9e` (`108-24` plus review fix) | independent literal transform rows and complete discriminated-union results                                |
| `tests/shared/fs-utils.test.ts`         | `eaadff50`, `3a00f26b` (`109-09`)                 | real filesystem state, case-local method stubs, newest-first operation logs, complete leak lists           |
| `tests/shared/notify-context.test.ts`   | `d4618917`, `565bb222` (`109-12`)                 | true interaction mocks, exact verification, module-scoped `satisfies`, complete call logs                  |

## Pattern Assignments

### P110-01: agents-index I/O

**Files:** `extensions/pi-claude-marketplace/persistence/agents-index-io.ts` and `tests/persistence/agents-index-io.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:109-130`, with exact-byte shape from `tests/shared/atomic-json.test.ts:9-21`.

Copy the case-owned directory, literal input, and exact-byte pattern. Drive file-level and row-level failures through `loadAgentsIndex`. Use `t.mock.method()` only for the empty `AGENTS_INDEX_ENTRY_VALIDATOR.Errors` fallback. Assert the full `LoadedAgentsIndex`, full corruption strings, thrown cause, and unchanged disk state. Add the non-`ENOENT` read case by placing a directory at the index path. Keep the production source unchanged unless direct coverage proves that the public seam cannot reach a real branch.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/agents-index-io.test.ts
```

### P110-02: agents-index schema

**Files:** `extensions/pi-claude-marketplace/persistence/agents-index-schema.ts` and `tests/persistence/agents-index-schema.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:24-85`.

Copy the independent expected-schema pattern. Exercise both compiled validators with literal positive and negative values. Prove every required array, optional `originalModel`, schema version `1`, rejection of version `2`, and rejection of `entries` in place of `agents`. Use `satisfies AgentsIndexEntry` and `satisfies AgentsIndex` for compile-time evidence without fake runtime phases. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/agents-index-schema.test.ts
```

### P110-03: config I/O

**Files:** `extensions/pi-claude-marketplace/persistence/config-io.ts` and `tests/persistence/config-io.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:109-130,175-220`.

Copy the absent, malformed, adjacent-version, and exact replacement structure. Add direct `isDeclaredEnabled` cases for absent, `true`, and `false`. Reach the empty validator-error fallback through a public load or save call with `t.mock.method(CONFIG_VALIDATOR, "Errors", ...)`. Assert complete `ConfigLoadResult` values for absent, invalid, and valid documents. Assert containment failures and complete writer bytes. Keep the production source unchanged unless direct coverage proves otherwise.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/config-io.test.ts
```

### P110-04: config merge

**Files:** `extensions/pi-claude-marketplace/persistence/config-merge.ts` and `tests/persistence/config-merge.test.ts`

**Analog:** `tests/domain/source.test.ts:627-643,716-817`.

Copy the named literal-row transform pattern. Give each row independent base and local values plus one complete expected `ScopeLoadOutcome` or `MergedConfig`. Cover empty, base-only, local-only, collision, dangling plugin, valid load arms, and invalid or absent load arms. Assert whole-entry replacement and full provenance; never deep-merge fields. For loader cases, create and clean a fresh directory inside the generated callback. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/config-merge.test.ts
```

### P110-05: config write-back

**Files:** `extensions/pi-claude-marketplace/persistence/config-write-back.ts` and `tests/persistence/config-write-back.test.ts`

**Analog:** `tests/shared/atomic-json.test.ts:9-21,108-138`.

Copy the complete writer-byte and generated-row structure. Exercise marketplace write, marketplace cascade delete, plugin write, plugin delete, and batch patch through their public functions. Add a cascade input without a plugin map, marketplace-only and plugin-only batches, and a batch that creates absent entries. Each case compares the complete saved document and exact bytes. Keep each expected document independent from the production patch result. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/config-write-back.test.ts
```

### P110-06: locations

**Files:** `extensions/pi-claude-marketplace/persistence/locations.ts` and `tests/persistence/locations.test.ts`

**Analog:** `tests/shared/fs-utils.test.ts:456-535,612-698`.

Copy the complete path-result and adjacent-rejection style. Assert the full frozen `ScopedLocations` bundle for user and project scope. Exercise every derived path function with safe and separator-bearing names. Call `sourcesStagingDir` with a safe UUID-like value and assert exact containment under the staging root. If a case changes `PI_CODING_AGENT_DIR`, capture and restore its exact prior state in that case's cleanup. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/persistence/locations.test.ts
```

### P110-07: config migration

**Files:** `extensions/pi-claude-marketplace/persistence/migrate-config.ts` and `tests/persistence/migrate-config.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:193-251,399-434`.

Copy the invalid-input rebuild and rehydration pattern, but require an exact fixed point. Give `buildConfigFromState` an explicit result type whose `marketplaces` and `plugins` records are known present. Remove the now-redundant `?? {}` entry-count fallbacks in this pair only. Add a nullish stored-source projection and assert its exact string form. Call `migrateFirstRunConfig` twice against the same case-local path. Assert the second result, unchanged bytes, and no rewrite effect.

**Focused commands:**

```bash
npm run test:coverage:direct -- tests/persistence/migrate-config.test.ts
npm run typecheck
```

### P110-08: state migration transforms

**Files:** `extensions/pi-claude-marketplace/persistence/migrate.ts` and `tests/persistence/migrate.test.ts`

**Analog:** `tests/domain/source.test.ts:30-326,627-643`.

Copy the large literal input/result matrix with phases inside each callback. Replace shared JSON fixtures with readable legacy literals. Add non-object marketplace and plugin rows and assert the complete normalized result. Refine `MigrationResult.marketplaces` to the object-valued record shape that `migrateState` already returns. Do not add an export only for tests. For `persistMigratedState`, use a case-owned real path, replace `console.warn` only at the public seam when needed, and assert the complete warning plus retained in-memory value and exact disk effect.

**Focused commands:**

```bash
npm run test:coverage:direct -- tests/persistence/migrate.test.ts
npm run typecheck
```

### P110-09: state I/O

**Files:** `extensions/pi-claude-marketplace/persistence/state-io.ts` and `tests/persistence/state-io.test.ts`

**Analogs:** `tests/shared/completion-cache.test.ts:109-130,193-251,399-434` and `tests/domain/source.test.ts:627-643`.

Copy the durable JSON and source-normalization patterns. Cover `isRecordedButDisabled`, cloning without `resolvedSha`, validator root detail and empty-error fallback, raw unknown and null sources, stored path, GitHub, valid URL, invalid URL, non-`ENOENT` reads, and post-normalization schema failure. After P110-08 narrows `MigrationResult`, remove only the redundant post-migration non-object marketplace guard. Observe fire-and-forget persistence with a pre-registered case-local `fsPromises.watch()` iterator and an `AbortController`; do not poll or sleep. Assert the complete returned state and exact persisted bytes.

**Focused commands:**

```bash
npm run test:coverage:direct -- tests/persistence/state-io.test.ts
npm run typecheck
```

### P110-10: phase ledger

**Files:** `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` and `tests/transaction/phase-ledger.test.ts`

**Analog:** `tests/shared/fs-utils.test.ts:304-364,396-453`.

Copy the exact operation-log and complete leak-list assertions. Define named schedule rows for every meaningful forward failure position. Each generated callback records every `do` and `undo`, then compares the full newest-first log, result, original error identity, partial rows, causes, leaks, and final context. Include no undo, own-undo success, own-undo failure, several reverse failures, both `PathContainmentError` sites, and a non-`Error` forward throw. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/transaction/phase-ledger.test.ts
```

### P110-11: rollback formatting

**Files:** `extensions/pi-claude-marketplace/transaction/rollback.ts` and `tests/transaction/rollback.test.ts`

**Analogs:** `tests/shared/fs-utils.test.ts:396-453` and `tests/shared/completion-cache.test.ts:88-106`.

Copy the complete structured-error and cause-identity assertions. Re-prove path-containment bypass, zero-partial identity, one partial, several partials, original cause identity, and raw partial preservation. Compare the whole `RollbackErrorResult`; do not render user-facing text in this owner. Keep the production source unchanged.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/transaction/rollback.test.ts
```

### P110-12: locked state guard

**Files:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` and `tests/transaction/with-state-guard.test.ts`

**Analogs:** `tests/shared/fs-utils.test.ts:30-85,304-364` for case-local real filesystem state and method replacement; `tests/shared/notify-context.test.ts:110-169` for exact collaborator verification and call logs.

Keep real case-local lock paths for lifecycle, contention, and retry. Use the public `loadState` and `saveState` dependency seams only for their failure cases. Use `t.mock.method(lockfile, ...)` for ordinary and non-`Error` acquisition failures and release failures. Add duplicate `tx.save()`, release-after-success, and release-after-non-`Error` body cases. Replace platform skips with deterministic method replacement. For contention, resolve an `entered` promise inside the first callback, hold that callback on a second promise, start the contender only after `entered`, and release without a timer. Assert the full error or result, save log, lock release, retry outcome, and final state. Keep the production source unchanged unless direct coverage proves otherwise.

**Focused command:**

```bash
npm run test:coverage:direct -- tests/transaction/with-state-guard.test.ts
```

## Concrete Analog Excerpts

### Case-owned filesystem and exact bytes

**Source:** `tests/shared/atomic-json.test.ts:1-21`

```typescript
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

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

### Data rows keep phases inside the callback

**Source:** `tests/shared/atomic-json.test.ts:108-138`

```typescript
for (const { name, content, expectedJsonBytes } of rows) {
  test(name, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-number-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "number.json");

    // act
    await atomicWriteJson(filePath, content);
    const jsonBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(jsonBytes, expectedJsonBytes);
  });
}
```

### Schema and structured cause assertions

**Source:** `tests/shared/completion-cache.test.ts:24-40,88-105`

```typescript
test("publishes marketplace names schema version 2", () => {
  // arrange
  const expectedSchema = {
    type: "object",
    required: ["schemaVersion", "names"],
    properties: {
      schemaVersion: { type: "number", const: 2 },
      names: { type: "array", items: { type: "string" } },
    },
  };

  // act
  const schema = JSON.parse(JSON.stringify(MARKETPLACE_NAMES_CACHE_SCHEMA)) as unknown;

  // assert
  assert.deepStrictEqual(schema, expectedSchema);
});

test("retains the manifest failure as a structured cause", () => {
  // arrange
  const cause = new Error("manifest unavailable");

  // act
  const error = new ManifestSoftFailError(cause);

  // assert
  assert.deepStrictEqual(
    { name: error.name, message: error.message, cause: error.cause },
    {
      name: "ManifestSoftFailError",
      message: "Manifest load failure: manifest unavailable",
      cause,
    },
  );
});
```

### Independent transform rows

**Source:** `tests/domain/source.test.ts:627-643`

```typescript
describe("parsePluginSource", () => {
  for (const { name, raw, source } of [
    ...PARSE_CASES,
    ...UNKNOWN_PARSE_CASES,
    ...INVALID_INPUT_CASES,
  ]) {
    test(name, () => {
      // arrange
      const expectedSource = source;

      // act
      const parsedSource = parsePluginSource(raw);

      // assert
      assert.deepStrictEqual(parsedSource, expectedSource);
    });
  }
});
```

### Reverse-order transaction log

**Source:** `tests/shared/fs-utils.test.ts:304-364`

```typescript
const operations: string[] = [];
t.mock.method(fs, "rm", async (target: PathLike, options?: RmOptions) => {
  operations.push(`rm ${String(target)} ${JSON.stringify(options)}`);
  await remove(target, options);
});
t.mock.method(fs, "rename", async (from: PathLike, to: PathLike) => {
  operations.push(`rename ${String(from)} -> ${String(to)}`);
  await rename(from, to);
});
const expectedOperations = [
  `rm ${secondReplacement} {"force":true}`,
  `rm ${firstReplacement} {"force":true}`,
  `rename ${secondBackup} -> ${secondRestored}`,
  `rename ${firstBackup} -> ${firstRestored}`,
  `rm ${stagingRoot} {"recursive":true,"force":true}`,
  `rm ${backupRoot} {"recursive":true,"force":true}`,
];

// act
const leaks = await rollbackReplacementCommon(input);

// assert
assert.deepStrictEqual(leaks, []);
assert.deepStrictEqual(operations, expectedOperations);
```

### True interaction mock and type-only evidence

**Source:** `tests/shared/notify-context.test.ts:4-17,40-41,110-169`

```typescript
import { mock, verify, when } from "strong-mock";

void (((row: PluginAvailableMessage, probe: SoftDepStatus, scope: Scope) =>
  `${row.name}:${probe.piSubagentsLoaded.toString()}:${scope}`) satisfies RenderFn<PluginAvailableMessage>);

const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
when(() => ctx.ui).thenReturn(ui);

// assert
assert.deepStrictEqual(controlled.calls, []);
verify(harness.ctx);
verify(harness.pi);
verify(harness.ui);
```

Use `strong-mock` only for a true collaborator interaction. Use `t.mock.method()` for a mutable validator, filesystem method, console method, or lockfile method that acts as a case-local stub or spy.

## Shared Patterns

### Imports

- Use Node built-ins through `node:` specifiers.
- Import the paired production source through its direct relative `.ts` path.
- Keep `import type` declarations separate when a value import is not required.
- Use `satisfies` for expected records and schedule rows when their types are part of the contract.

### Filesystem ownership

- Create one temporary directory inside each test callback.
- Register `t.after()` immediately after creation.
- Keep corrupt, missing, invalid, and failure fixtures inside that directory.
- Use `rm(directory, { recursive: true, force: true, maxRetries: 3 })` only when bounded retry support is necessary.
- Do not use a shared temporary root, a generic helper directory, or cleanup sleeps.

### Durable values

- Write independent literal JSON or literal objects.
- Build the complete expected value separately from the production function.
- Compare exact UTF-8 bytes when whitespace, key order, or the trailing newline is contractual.
- Replay migrated state through the same public path and compare the complete second result and unchanged bytes.

### Errors and validation

- Assert error identity when the public contract propagates the same error.
- Assert `name`, `message`, `cause`, stable custom fields, and disk effects when wrapping is contractual.
- Reach defensive validator-detail fallbacks through exported load or save functions plus a case-local method replacement.
- Do not export a private formatter or add a reset hook for coverage.

### Transaction schedules

- Generate one independent test for every meaningful failure position.
- Record complete `do` and `undo` logs.
- Assert the failing phase's own undo first, then completed phases newest-first.
- Assert every rollback partial, cause, leak, and final context value.
- Use controlled promises for contention. No completed Phase 108/109 owner provides the exact two-promise lock pattern, so follow `110-RESEARCH.md:264-268` rather than copying a sleep-based case.

### Production changes

- P110-07 can narrow the config projection and remove its own redundant nullish fallbacks.
- P110-08 can refine `MigrationResult.marketplaces` to the object-valued shape already returned.
- P110-09 can consume that type and remove its redundant post-migration object guard.
- All other pair plans start as owner-only changes. A production edit requires a behavior-preserving extraction or real dependency injection inside that pair.
- Never add a test-only export, reset function, state reader, coverage ignore, or generic test seam.

## Validation Commands

Run the exact focused command in each pair section before that pair's commit. Run these broader gates after wave integration:

```bash
npm test
npm run test:corresponding
npm run check
```

Run `npm run typecheck` in P110-07, P110-08, and P110-09 because those pairs change or consume production types.

## No Analog Found

No Phase 110 pair lacks a close role or data-flow analog. The controlled two-promise lock-contention schedule has no completed exact analog. Its implementation comes from the accepted Phase 110 research and the public callback position in `with-state-guard.ts`, not from a test-only production seam.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{persistence,transaction}`, `tests/{domain,persistence,shared,transaction}`, and completed Phase 108/109 git history

**Files scanned:** 12 Phase 110 production sources, 12 mirrored owners, and 5 selected completed analog owners

**Pattern extraction date:** 2026-08-29
