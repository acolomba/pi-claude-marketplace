---
phase: 08-clear-milestone-debt
plan: 09
subsystem: shared own-key helper, domain name rule, plugin resolver, marketplace add
tags: [d-08-07, ownkey-01, debt-04, ma-8, prototype-keys]

requires: []
provides:
  - "`shared/own-key.ts`: `ownValue<T>(map: Readonly<Record<string, T>> | undefined, key: string): T | undefined` (an `Object.hasOwn` read) and `setOwn<T>(map: Record<string, T>, key: string, value: T): void` (an own enumerable data property through `Object.defineProperty`), paired with `tests/shared/own-key.test.ts` at 100% direct coverage (D-08-07)"
  - "`isReservedRecordKey(name: string): boolean` in `domain/name.ts`, true for `__proto__` only (D-08-07 operator ruling)"
  - "Resolver: a marketplace entry named `__proto__` resolves `(unavailable)` with the note `malformed marketplace entry: plugin name \"__proto__\" is reserved`"
  - "`marketplace add` reads and writes state by own keys: a marketplace named `constructor` adds, and a manifest named `__proto__` fails as `invalid manifest` with state.json unchanged"
affects: [08-15, 08-16, 08-17, 08-18 (OWNKEY-01 read and write sweep imports shared/own-key.ts), 08-19 (end-to-end proof), 08-21 (DEBT-04 ledger)]

actuals:
  tokens: 3275
  tasks: 2
  commits: 2
plan_head_before: ece010025b9c8d69c6f847c4b083b1c8371e6009
plan_head_after: 9e36c6940b8a299dbb8816a5a434d1cc3c2a3299

tech-stack:
  added: []
  patterns:
    - "Own-key state access: `ownValue(map, name)` for name-indexed reads, `setOwn(map, name, record)` for keyed writes"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/own-key.ts
    - tests/shared/own-key.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/orchestrators/marketplace/add.test.ts
    - extensions/pi-claude-marketplace/domain/name.ts
    - tests/domain/name.test.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - tests/domain/plugin-resolver.test.ts

key-decisions:
  - "`setOwn` always defines the property through `Object.defineProperty`, with no `__proto__` branch. For a new key on a plain object this gives the same descriptor as an assignment."
  - "marketplace add reads the manifest name through one helper, `newMarketplaceName`, which runs the `__proto__` check and the MA-8 duplicate check for both the cloned and the path source. Two inline copies of the check formed a new clone group, so the fallow audit read `warn`."

patterns-established:
  - "Name-indexed state reads go through `ownValue`; keyed state writes go through `setOwn`"

requirements-completed: []

duration: 10min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 09: Own-key helper and the `__proto__` name rule Summary

**`shared/own-key.ts` adds `ownValue` (reads own keys only) and `setOwn` (writes an own data property). `marketplace add` now uses both, so a marketplace named `constructor` adds. Before, the `in` check matched the inherited `constructor` member and refused it as a duplicate. `isReservedRecordKey` reserves only `__proto__`. With it, the resolver reports a `__proto__` plugin entry as a malformed entry (`{unsupported source}`), and `marketplace add` refuses a `__proto__` manifest as `invalid manifest`. `constructor`, `toString` and the other prototype names stay valid.**

## Performance

- **Duration:** about 10 min (2026-10-10T04:22Z to 04:32Z)
- **Tasks:** 2/2
- **Files:** 2 created, 6 modified

## Exported signatures

```ts
// shared/own-key.ts
export function ownValue<T>(map: Readonly<Record<string, T>> | undefined, key: string): T | undefined;
export function setOwn<T>(map: Record<string, T>, key: string, value: T): void;
// domain/name.ts
export function isReservedRecordKey(name: string): boolean; // true only for "__proto__"
```

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | foundation delivered: the shared helper, the `__proto__` rule at the resolver and at `marketplace add`, and the `marketplace add` sites moved to own keys. Plans 08-15 to 08-18 move the remaining sites, and 08-19 proves the sweep end to end | c8faf222, 9e36c694 |

## Task Commits

1. **Task 1: The own-key helper, end to end through marketplace add of a marketplace named constructor.** Commit `c8faf222` (`fix(marketplace): read and write state by own keys on add`). RED: the `constructor` add case failed (it rendered `(failed) {duplicate name}`, and state held no marketplace), and `own-key.test.ts` failed (module missing). Pre-commit log: the first run was `PRECOMMIT_EXIT=1` because prettier wrote the `é` and `́` escapes as literal characters. I restaged, added a comment that names the NFC and NFD forms, and the rerun gave `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: The `__proto__` name rule at the resolver and at marketplace add.** Commit `9e36c694` (`fix(names): refuse a __proto__ plugin or marketplace name`). RED: the `name.test.ts` module failed (the export was missing). The `__proto__` resolver case failed, and both `__proto__` add cases failed (the add succeeded). The `constructor` resolver case passed before the change, as the ruling expects. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1: `TMPDIR=/var/tmp/mcp4-p8-09 node --test tests/shared/own-key.test.ts tests/orchestrators/marketplace/add.test.ts` gave `ℹ tests 116`, `ℹ pass 116`, `ℹ fail 0`. `npm run test:coverage:direct -- …/shared/own-key.ts …/orchestrators/marketplace/add.ts` exit 0, no shortfall. `node scripts/check-corresponding-tests.mjs` exit 0.
- Task 2: `TMPDIR=/var/tmp/mcp4-p8-09 node --test tests/domain/name.test.ts tests/domain/plugin-resolver.test.ts tests/orchestrators/marketplace/add.test.ts` gave `ℹ tests 409`, `ℹ pass 409`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- …/domain/name.ts …/domain/plugin-resolver.ts …/orchestrators/marketplace/add.ts` exit 0, no shortfall. `npx tsc --noEmit -p .` exit 0.
- Audit check (Task 2 verify): `verdict pass introduced-here 0 introduced-all 0`, exit 0.
- Acceptance: `grep -nE "in state\.marketplaces|state\.marketplaces\[derivedName\]" …/add.ts` prints nothing. `grep -n "export function" …/shared/own-key.ts` prints the two lines (`ownValue`, `setOwn`). The `awk` slice of `assertSafeName` contains no `__proto__`. `isReservedRecordKey` is called in plugin-resolver.ts:517 and add.ts:333 (inside `newMarketplaceName`).
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 3 - Blocking] One helper for the manifest-name checks in add.ts**
- **Found during:** Task 2 audit verify
- **Issue:** With the `__proto__` check placed before the duplicate check at both add paths, as the plan specified, `fallow audit` read `warn`. It found 1 introduced clone group: add.ts 874-882 and 1075-1083, the manifest load, the reserved check and the duplicate check.
- **Fix:** `newMarketplaceName(manifestPath, marketplaces, scope)` loads the manifest, throws `InvalidMarketplaceManifestError("marketplace.json schema invalid: name \"__proto__\" is reserved")` for a reserved name, and throws `MarketplaceDuplicateNameError` for a held name. Both paths call it. The checks run in the order the plan gives: reserved, then duplicate, both before any state mutation. The audit then read `pass` with 0 introduced groups.
- **Commit:** 9e36c694

**2. [Rule 2 - Edge] Unicode case in own-key.test.ts**
- The must-have "own-key lookups compare keys by exact string" has its own case: an NFC key looked up by its NFD form returns undefined.

**3. Requirements not marked complete**
- DEBT-04 covers the whole phase. Plan 08-21 owns it.

**Total deviations:** 2 (helper extraction for the audit, one extra edge case). **Impact:** the behavior matches the plan.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations applied:
- T-08-20: `isReservedRecordKey` refuses `__proto__` where a name becomes a state key (resolver `preflightStages`, `marketplace add`), and `setOwn` defines own properties.
- T-08-21: `ownValue` replaces the `in` duplicate check, so `constructor` adds.

## Notes for later plans

- 08-15 to 08-18: import `{ ownValue, setOwn }` from `shared/own-key.ts`. `ownValue` accepts an undefined map, so `x.marketplaces?.[name]` becomes `ownValue(x.marketplaces, name)`. `orchestrators/reconcile/mcp-migration.ts:159-162` still has its private `ownValue`. Replace it with the import.
- Other sites that create a marketplace or plugin key from a name still use bracket writes. The research lists them under "Write sites that drop a `__proto__` record". The resolver now refuses a `__proto__` plugin entry, so install paths that go through `resolveStrict` never see that name.
- `bridges/mcp/safe-set.ts` is unchanged.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/own-key.ts` and `tests/shared/own-key.test.ts` exist.
- Commits c8faf222 and 9e36c694 are ancestors of HEAD.
