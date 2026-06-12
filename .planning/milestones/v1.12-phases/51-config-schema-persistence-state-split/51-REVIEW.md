---
phase: 51-config-schema-persistence-state-split
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - tests/architecture/config-state-write-seams.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/persistence/config-io.test.ts
  - tests/persistence/config-merge.test.ts
  - tests/persistence/fixtures/legacy/state-with-autoupdate.json
  - tests/persistence/locations.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
findings:
  critical: 0
  warning: 5
  info: 6
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the new persistence seams (`config-io.ts`, `config-merge.ts`), the
STATE_SCHEMA autoupdate carve-out (`state-io.ts`, `migrate.ts`), the
`ScopedLocations` config-path additions, the SPLIT-01 mechanical cast sites
across six orchestrator files, and the full Phase-51 test surface.

Verification performed:

- All 143 tests in the 12 in-scope test files pass (`node --test`).
- `saveConfig` ordering (validate → `assertPathInside` → `atomicWriteJson`)
  satisfies NFR-1/NFR-10; the SPLIT-02 architecture walker correctly catches
  synthetic offenders and `saveConfig` has no production callers yet (Phase
  52 wires it), so the write-seam allow-list is accurate.
- The CFG-03 trichotomy is sound: a 0-byte file lands in `invalid` via the
  JSON.parse arm (Pitfall 51-1 closed); typebox `Errors()` returns an array
  with `instancePath`/`message`, so the error-detail helpers work as written.
- `mergeScopeConfigs` correctly implements entry-level wholesale replacement
  (D-01) for both maps, and `loadMergedScopeConfig` preserves the per-file
  results (Pitfall 51-4).
- The SPLIT-01 cast sites (`(record as unknown as Record<string, unknown>).autoupdate === true`)
  are consistent across all six orchestrator files and preserve the D-04
  `undefined === false` semantics.

Two defects were confirmed by runtime reproduction (WR-01, WR-02). No
Critical-tier findings: no security gaps, no data corruption of validated
state, no containment escapes. The main concerns are an incorrect closed-set
failure reason on a network-free path (contradicting the file's own ATTR-10
intent), a fragile D-13 gate that silently destroys the autoupdate flag in a
user-reachable intermediate state, and a documentation-contract violation in
`migrate.ts`.

## Warnings

### WR-01: Path-source update failure renders the lying `{network unreachable}` reason

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:563-575` (and `:773`)
**Issue:** `reasonsFromCascadeError` unwraps ONE level of `cause` for
`InvalidMarketplaceManifestError` (lines 556-561) but NOT for errno-bearing
FS errors (lines 563-572). `refreshOneMarketplace`'s catch always receives the
error wrapped in `MarketplaceUpdateError { cause }` (thrown by
`refreshRecord:410`), so the `code` check runs against the wrapper — which has
no errno — and falls through to `?? ["network unreachable"]` at line 773.

Reproduced: a **path-source** marketplace whose manifest is missing on disk
(`marketplace update mp`) emits:

```
⊘ mp [project] (failed)
  ⊘ mp (failed) {network unreachable}
    cause: Failed to update marketplace "mp". -> ENOENT: no such file or directory, open '.../gone/.claude-plugin/marketplace.json'
```

A path-source refresh is network-free (NFR-5); the comment block at lines
548-555 explicitly states this class "MUST NOT fall through to the
`?? ["network unreachable"]` default" — but the implemented unwrap only covers
the typed manifest error, not ENOENT/ENOTDIR/EACCES/EPERM. The correct
closed-set reasons (`source missing` / `permission denied`) already exist in
the same function. (Pre-existing before the Phase-51 diff, but the file is in
review scope and the defect contradicts its own ATTR-10/D-48-B comments.)
**Fix:** mirror the one-level cause unwrap for the errno checks:

```ts
if (err instanceof Error) {
  const errnoBearer =
    (err as NodeJS.ErrnoException).code !== undefined
      ? (err as NodeJS.ErrnoException)
      : err.cause instanceof Error
        ? (err.cause as NodeJS.ErrnoException)
        : undefined;
  const code = errnoBearer?.code;
  if (code === "EACCES" || code === "EPERM") return ["permission denied"] as const;
  if (code === "ENOENT" || code === "ENOTDIR") return ["source missing"] as const;
}
```

### WR-02: D-13 gate on bare file existence makes the autoupdate flag silently evaporate

**File:** `extensions/pi-claude-marketplace/persistence/migrate.ts:168`, `extensions/pi-claude-marketplace/persistence/state-io.ts:192`
**Issue:** The autoupdate scrub fires whenever `<scopeRoot>/claude-plugins.json`
exists — regardless of whether Phase 52 has actually captured the legacy
intent. `claude-plugins.json` is by definition a USER-AUTHORED file (CFG-01),
so a user can create it by hand today, before Phases 52-56 rewire the
autoupdate read/write paths. In that state every `loadState` deletes
`autoupdate` from the in-memory records AND fire-and-forget persists the
scrubbed state, while ALL SPLIT-01 cast sites (`applyAutoupdateFlipInPlace`,
`marketplace list/info`, `plugin list/info`, `update`) still read and write
`autoupdate` on the state record.

Reproduced: seed `state.json` with `autoupdate: true`, create an empty
`claude-plugins.json` sibling, call `loadState` — both the in-memory record
and the persisted `state.json` lose the flag. Net effect:
`marketplace autoupdate on` becomes persistently non-durable (each flip
survives only until the next load), with no warning to the user.

This is the locked D-13 Mechanism A and is acceptable ONLY if the
window provably closes when the milestone ships as a whole. It must not
survive past Phase 54-56.
**Fix:** Either (a) gate the scrub on a positive Phase-52 capture marker
(e.g. the config file validating AND containing a `marketplaces` record for
the scope, or a dedicated migration sentinel) instead of bare `existsSync`,
or (b) add an explicit Phase 54-56 verification item asserting that by the
time the config write-path lands, no production site reads/writes
`record.autoupdate` on state — and document the hand-authoring hazard in the
51-SUMMARY in the meantime.

### WR-03: `migrateLegacyMarketplaceRecords` violates its documented purity contract

**File:** `extensions/pi-claude-marketplace/persistence/migrate.ts:127-128, 163-168`
**Issue:** The docstring states "Pure function -- does NOT touch disk", but
the Phase-51 change added `existsSync(configJsonPath)` inside the function
body — a synchronous disk stat on every `loadState`. The justifying comment
("Async `fs.stat` would interleave with the per-marketplace loop and break
the gate's atomicity guarantee") is incorrect reasoning: the function is
fully synchronous after the gate read, so an async stat performed by the
CALLER before invocation would be exactly as race-free. The false purity
claim is the real hazard — a future caller relying on the documented
contract (e.g. calling it in a context where disk access is forbidden, or
unit-testing it as a pure reducer) will be misled.
**Fix:** Hoist the gate to the caller and pass a boolean:

```ts
// state-io.ts (loadState)
const scrubAutoupdate = existsSync(configJsonPath); // or async stat
const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
  parsed, extensionRoot, scrubAutoupdate,
);
```

This restores purity, removes hidden I/O from the migrator, and makes the
D-13 gate decision visible at the load seam where the path is derived.
Alternatively, at minimum correct the docstring ("performs one read-only
`existsSync` probe").

### WR-04: `loadState`'s configJsonPath derivation is untested (gate-open path never exercised through loadState)

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:192`, `tests/persistence/state-io.test.ts:218-245`
**Issue:** `loadState` derives the D-13 gate path as
`path.join(path.dirname(extensionRoot), "claude-plugins.json")`, duplicating
the `locationsFor` construction with a comment claiming byte-for-byte
equivalence — but no test pins that equivalence, and no test exercises the
gate-OPEN path through `loadState` at all. `state-io.test.ts` only covers the
gate-CLOSED case ("legacy state.json with autoupdate still loads"); the
gate-open scrub is tested exclusively at the `migrateLegacyMarketplaceRecords`
unit level with an explicitly passed path. If the derivation at line 192 were
wrong (e.g. joined onto `extensionRoot` instead of its parent), every current
test would stay green while the D-13 scrub never fires in production.
**Fix:** Add a state-io test that materializes
`<scopeRoot>/claude-plugins.json` next to a tmp `extensionRoot =
<scopeRoot>/pi-claude-marketplace`, loads the `state-with-autoupdate.json`
fixture via `loadState`, and asserts the loaded record lacks `autoupdate`
(plus, after a flush, that the persisted state.json lacks it). Optionally
also assert `path.join(path.dirname(loc.extensionRoot), "claude-plugins.json")
=== loc.configJsonPath` as a drift guard.

### WR-05: Hermetic-HOME test harnesses do not neutralize `PI_CODING_AGENT_DIR`

**File:** `tests/orchestrators/marketplace/autoupdate.test.ts:43-62` (same pattern in `tests/orchestrators/marketplace/info.test.ts:72-91`, `tests/orchestrators/marketplace/list.test.ts:53-72`, `tests/orchestrators/plugin/bootstrap.test.ts:73-92`, `tests/edge/handlers/plugin/bootstrap.test.ts:52-69`)
**Issue:** `withHermeticHome` swaps `process.env.HOME` but leaves
`PI_CODING_AGENT_DIR` untouched. `getAgentDir()` (the user-scope root per
SC-1) checks `PI_CODING_AGENT_DIR` FIRST and only falls back to
`homedir()`. Any developer or CI environment that sets that variable — which
the project's own contract encourages — causes every "hermetic" user-scope
test to read AND WRITE the developer's real Pi agent dir: `saveState` writes
a real `state.json`, and the bootstrap tests install a
`claude-plugins-official` marketplace record into it. That is both test
pollution (cross-test interference, order-dependent failures) and a
destructive hazard against real user data. `tests/persistence/locations.test.ts`
already has the correct `withPiAgentDir` save/restore helper.
**Fix:** In each `withHermeticHome`, also save/clear (or point into the tmp
home) `PI_CODING_AGENT_DIR` and restore it in the `finally` block:

```ts
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
delete process.env.PI_CODING_AGENT_DIR; // HOME-based fallback now applies
// ... finally: restore originalAgentDir
```

Consider extracting the helper into `tests/helpers/` so the five copies
cannot drift.

## Info

### IN-01: Fixed-name gate-closed sentinel paths in shared tmpdir can collide

**File:** `tests/persistence/migrate.test.ts:33, 124`
**Issue:** `NO_CONFIG` and `missingConfig` use deterministic filenames
directly under `os.tmpdir()` (e.g. `no-such-config-for-migrate-tests.json`).
If a leftover file with that name ever exists, the D-13 gate silently opens
and the "gate CLOSED" tests assert the wrong branch.
**Fix:** Derive the sentinel from a per-test `mkdtemp` dir (guaranteed empty)
instead of a fixed name in the shared tmpdir.

### IN-02: Stale hard-coded line references in locations.ts comment

**File:** `extensions/pi-claude-marketplace/persistence/locations.ts:131-132`
**Issue:** The CFG-01 comment refers to "the locations.ts comment block below
(lines 134-143)" — the referenced T-03-04 block actually sits at lines
145-153 and will drift further with any edit. Hard-coded line numbers in
comments are guaranteed to rot.
**Fix:** Refer to the block by name ("the T-03-04 disposition comment below")
instead of line numbers.

### IN-03: Dead test scaffolding kept only to silence lint

**File:** `tests/persistence/config-merge.test.ts:173-184`
**Issue:** The test constructs `loc = locationsFor("user", root)`, immediately
documents that it is unusable for the test, builds `projLoc` instead, and
then asserts `typeof loc.scopeRoot === "string"` purely "to keep
unused-binding lint quiet". Dead scaffolding plus a no-value assertion.
**Fix:** Delete the `loc` binding and its placeholder assertion.

### IN-04: `new URL(import.meta.url).pathname` instead of `fileURLToPath`

**File:** `tests/orchestrators/plugin/bootstrap.test.ts:119-125`, `tests/edge/handlers/plugin/bootstrap.test.ts:71-82`
**Issue:** `URL.pathname` keeps percent-encoding, so a checkout path
containing spaces or non-ASCII characters yields a fixture path that does not
exist on disk. Sibling tests (`tests/persistence/migrate.test.ts:22`) already
use `fileURLToPath(import.meta.url)`, which decodes correctly.
**Fix:** `path.dirname(fileURLToPath(import.meta.url))`.

### IN-05: `narrowListFailReason` docs overstate its distinctness

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:768-786`
**Issue:** The 18-line docstring presents `narrowListFailReason` as a
"dedicated closed-set Reason narrower" distinct from `narrowProbeError`, but
the body is a one-line delegation to the SAME shared classifier the other
helper wraps — the distinction is name-only. The shared classifier's doc
acknowledges "two semantic names", but this docstring reads as if a different
classification table exists, which can mislead a maintainer hunting a
misclassified list failure.
**Fix:** Trim the docstring to state explicitly that the body is intentionally
identical and only the semantic name differs.

### IN-06: `MergedConfig` aliases live entry objects from the per-file load results

**File:** `extensions/pi-claude-marketplace/persistence/config-merge.ts:96-120`
**Issue:** `MergedConfigEntry.entry` holds a reference to the same object
stored in the `base`/`local` `ConfigLoadResult`s (no copy, no freeze). The
fields are typed `readonly`, but a downstream consumer mutating an entry
through a cast (the SPLIT-01 cast idiom is already endemic) would silently
corrupt the per-file results that Phase 56 write-back depends on.
**Fix:** `Object.freeze` the entry objects (or shallow-copy them) in
`mergeScopeConfigs`, or document the aliasing explicitly in the
`MergedConfigEntry` JSDoc.

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
