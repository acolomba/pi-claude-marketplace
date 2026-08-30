---
phase: 110-persistence-and-transaction
reviewed: 2026-08-30T04:26:52Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/persistence/migrate-config.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - tests/architecture/no-hooks-strict-additional-properties.test.ts
  - tests/persistence/agents-index-io.test.ts
  - tests/persistence/agents-index-schema.test.ts
  - tests/persistence/config-io.test.ts
  - tests/persistence/config-merge.test.ts
  - tests/persistence/config-write-back.test.ts
  - tests/persistence/locations.test.ts
  - tests/persistence/migrate-config.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
  - tests/transaction/phase-ledger.test.ts
  - tests/transaction/rollback.test.ts
  - tests/transaction/with-state-guard.test.ts
findings:
  critical: 4
  warning: 3
  info: 0
  total: 7
status: issues_found
---

# Phase 110: Code review report

**Reviewed:** 2026-08-30T04:26:52Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Narrative Findings (AI reviewer)

### Summary

The focused 13-file test run and `npm run typecheck` pass. The review still found four blocker-level correctness and tampering defects. The new tests miss each defect while claiming complete validation or non-Error coverage.

Three warnings cover test hangs, the locked lowercase phase convention, and false single-write evidence.

## Critical Issues

### CR-01: Unsupported state versions are silently downgraded and can overwrite future data

**Classification:** BLOCKER

**Files:** `extensions/pi-claude-marketplace/persistence/state-io.ts:421-460`, `tests/persistence/state-io.test.ts:212-231`

**Issue:** `loadState` passes every parsed document through the legacy migrator, rebuilds the result with `schemaVersion: 2`, and validates only that rebuilt value. It never validates a present input version. Thus `{"schemaVersion":3,"marketplaces":{}}` loads successfully as version 2 even though `STATE_VALIDATOR` rejects version 3. If a version-3 document also triggers a legacy fill, line 460 persists the downgraded document and can erase future fields. The test suite checks version 3 only against `STATE_VALIDATOR`; it does not use the public loader or examine disk effects.

**Fix:** Reject a present version unless it is 1 or 2 before migration. Continue to support a missing version only if that is the legacy contract. Add a public `loadState` case for version 3 and prove that the original bytes stay unchanged.

```typescript
const parsedRecord =
  typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;

if (
  parsedRecord !== undefined &&
  Object.hasOwn(parsedRecord, "schemaVersion") &&
  parsedRecord.schemaVersion !== 1 &&
  parsedRecord.schemaVersion !== 2
) {
  throw new Error(`state.json at ${stateJsonPath} has an unsupported schema version`);
}
```

### CR-02: A JSON `null` state bypasses validation and crashes on a property read

**Classification:** BLOCKER

**Files:** `extensions/pi-claude-marketplace/persistence/state-io.ts:441-449`, `tests/persistence/state-io.test.ts:804-829`

**Issue:** The migrator accepts a `null` root and returns an empty marketplace map. `loadState` then casts the original `null` value and reads `parsedRoot.lastReconciledExtensionVersion`. This throws `TypeError: Cannot read properties of null` before the published validation/error path runs. The root-error test mocks the validator against `{}` and therefore reaches the formatter without exercising a real root-invalid document.

**Fix:** Read the optional stamp only from a non-null object. Add a real `state.json` containing `null` and assert the intended public result or contextual error, including unchanged disk bytes.

```typescript
const reconciliationStamp =
  typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).lastReconciledExtensionVersion
    : undefined;
```

### CR-03: Prototype-named persistence keys corrupt merged and migrated maps

**Classification:** BLOCKER

**Files:** `extensions/pi-claude-marketplace/persistence/migrate.ts:234-253`, `extensions/pi-claude-marketplace/persistence/migrate-config.ts:110-147`, `tests/persistence/config-merge.test.ts:36-152`, `tests/persistence/migrate.test.ts:283-367`

**Issue:** The reviewed migration and projection functions accumulate untrusted record keys into plain `{}` objects with bracket assignment. A JSON marketplace named `__proto__` changes the accumulator prototype instead of creating an own property, so the marketplace disappears from `Object.keys` and serialized output. The imported `mergeScopeConfigs` path has the same setter problem and also reads inherited names such as `constructor` from an otherwise empty local map. A valid base `constructor` entry is therefore replaced by the inherited `Function` object and labeled as a local override. These are tampering and data-loss paths at the persistence boundary, but the new data rows use only ordinary keys.

**Fix:** Build dynamic-key maps with `Map` plus `Object.fromEntries`, or define keys with `Object.defineProperty`. In merge logic, use `Object.hasOwn` instead of treating inherited property reads as entries. Add JSON-derived cases for `__proto__`, `constructor`, and `toString` to the migration, projection, and merge owners.

```typescript
const entries: Array<[string, Record<string, unknown>]> = [];
// ...
entries.push([mpName, mp]);
const marketplaces = Object.fromEntries(entries);
```

### CR-04: `undefined` callback and release rejections are reported as success

**Classification:** BLOCKER

**Files:** `tests/transaction/with-state-guard.test.ts:306-349`, `tests/transaction/with-state-guard.test.ts:629-665`; called source: `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:125-149`

**Issue:** The lock wrapper uses `undefined` as both "no primary error" and a legal JavaScript rejection value. If the transaction callback rejects with `undefined`, the catch stores `undefined`, the final check treats it as success, and the public promise resolves. A successful callback followed by a release function that rejects with `undefined` is also reported as success. The new non-Error tests use strings, so they do not test the sentinel collision.

**Fix:** Track error presence with a separate boolean. Add callback and release cases that use `Promise.reject(undefined)` and require `Error("undefined")`.

```typescript
let hasPrimaryError = false;
let primaryError: unknown;
try {
  result = await body();
} catch (error) {
  hasPrimaryError = true;
  primaryError = error;
}

// Apply the same boolean when release fails.
if (hasPrimaryError) throw toError(primaryError);
```

## Warnings

### WR-01: Fire-and-forget watcher tests can hang forever

**Classification:** WARNING

**File:** `tests/persistence/state-io.test.ts:441-467,990-1012`

**Issue:** Both watcher helpers loop until they see `state.json`, but neither case has a test timeout or a bounded abort. The only abort runs in `t.after`, which cannot run while the test is stuck awaiting `stateJsonChanged`. If persistence stops, writes a different filename, or the platform misses the event, the suite hangs until an external process kills it.

**Fix:** Add a bounded test-level timeout or a bounded abort signal. Keep the watcher event as the correctness assertion; use the timeout only as a fail-safe with a clear error.

### WR-02: Changed runtime cases do not all follow the locked lowercase phase contract

**Classification:** WARNING

**Files:** `tests/architecture/no-hooks-strict-additional-properties.test.ts:43-122`, `tests/persistence/state-io.test.ts:831-888`

**Issue:** The two architecture runtime cases have no canonical `// arrange`, `// act`, and `// assert` phases. In `state-io.test.ts`, the cases starting at lines 831 and 860 use `// act & assert` for an `assert.rejects()` call and then perform another disk assertion in the same phase. The locked contract permits `// act & assert` only when that phase contains one throwing or rejection expression.

**Fix:** Normalize the architecture cases to the three lowercase phases. For the two save-refusal cases, capture the error in `// act`, read the retained bytes there, and assert both values under a separate `// assert` phase.

### WR-03: The batched-write tests do not prove their claimed single-write guarantee

**Classification:** WARNING

**File:** `tests/persistence/config-write-back.test.ts:341-479`

**Issue:** The three test names claim one complete write, but the assertions check only final bytes and `readdir(scopeRoot)`. An implementation that calls `saveConfig` twice with the same final document produces the same bytes and the same one-file directory listing, so all three cases still pass. This leaves the T-110-05-02 repeated-write control as a false positive.

**Fix:** Add deterministic structural evidence that `writeBatchedConfigEntries` contains one `saveConfig` call outside both patch loops, using the TypeScript AST as the existing architecture gates do. Keep the runtime cases for final bytes and entry preservation.

---

_Reviewed: 2026-08-30T04:26:52Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
