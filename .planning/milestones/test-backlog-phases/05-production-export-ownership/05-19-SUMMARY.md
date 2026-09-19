---
phase: 05-production-export-ownership
plan: "19"
subsystem: testing
tags: [dead-code, fallow, orchestrators, install, reinstall, notifications, plugin-path]

requires:
  - phase: 05-production-export-ownership
    provides: "05-07 bridge barrels composing concrete Node construction behind injected ports"
provides:
  - "narrowResolverReasons is module-private; the install failure row is its public carrier"
  - "collectBinDirs is module-private; recomputePluginPath's ledger and PATH are its public carrier"
  - "replaceReinstalledPlugin, rollbackReinstalledPlugin, finalizeReinstalledPlugin and runPostSuccessMaintenance are module-private behind REAL_REINSTALL_TRANSACTION"
  - "outcomeToPluginMessage and ReinstallMsg are module-private; renderReinstallPartitionAndNotify's exact bytes are their public carrier"
  - "The cross-surface reason-parity gate drives the public install row instead of importing the private narrowing helper"
affects: [05-16, 05-17, 05-18, 05-20, 05-23, 05-28]

actuals:
  tokens: 11559
  tasks: 2
  commits: 2
  plan_head_before: 856d12a942f9554f0c7c6a71686d150e21e7b43e

tech-stack:
  added: []
  patterns:
    - "A privatized helper's cases move to the public result that carries it, and the old expected value survives verbatim inside that result"
    - "A branch that only a removed export could reach is retired with caller evidence rather than left as an uncoverable shortfall"

key-files:
  created:
    - .planning/tdd-evidence/05-19-01.json
    - .planning/tdd-evidence/05-19-02.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - tests/orchestrators/plugin/install.messaging.test.ts
    - tests/orchestrators/plugin-path.test.ts
    - tests/architecture/cross-surface-reason-parity.test.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts
    - tests/orchestrators/plugin/reinstall.messaging.test.ts

key-decisions:
  - "ReinstallTransaction declares each schedule step as an explicit signature instead of `typeof` its now-private implementation, so REAL_REINSTALL_TRANSACTION's annotation is where a signature drift fails."
  - "outcomeToPluginMessage's marketplaceScope argument was retired: its sole caller groups outcomes by (scope, marketplace), so the row scope always matched its block and the orphan-fold branch had no reachable caller. Keeping it would have left a measured 58/62 branch shortfall."
  - "ReinstallMsg was privatized in the same change because privatizing outcomeToPluginMessage left no exported signature naming it; its required-dependency proof retargets at the public row composer's return type."
  - "The parity gate keeps comparing the two surfaces to each other, but both are also pinned to an independent literal, so neither side derives its expectation from the other formatter."

patterns-established:
  - "Privatization ledger: every removed call site names the public result that now carries its assertion, and a case that a sibling public case already subsumes is recorded as subsumed rather than duplicated."
  - "Planted-offender controls run against the rewritten public cases before the commit, with the benign control re-run after every revert."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "Resolver-note narrowing keeps every closed-set mapping, arm-dependent component routing, precedence and first-seen dedup while narrowResolverReasons is module-private"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.messaging.test.ts#resolver reason narrowing through the install failure row (19 cases)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts (branches 88/88, functions 18/18, lines 636/636)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The install and read-only surfaces still agree on every note and component reason, measured on the public install row rather than the private helper"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/cross-surface-reason-parity.test.ts (17 tests, 17 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plugin-PATH keeps its insertion order, disabled-record exclusion and invalid-root drop diagnostics while collectBinDirs is module-private"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin-path.test.ts#recomputePluginPath (10 tests, 10 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin-path.ts (branches 16/16, functions 2/2, lines 115/115)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The reinstall replacement schedule keeps its handles, operation order, compensation order, leak strings and warnings while its four steps are module-private behind REAL_REINSTALL_TRANSACTION"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-replace.test.ts (10 tests, 10 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts (branches 46/46, functions 16/16, lines 536/536)"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/reinstall-flow.test.ts (121 tests, 121 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The reinstall cascade emits byte-identical rows, severities and reload trailers for every outcome partition while outcomeToPluginMessage is module-private"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.messaging.test.ts (19 tests, 19 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts (branches 58/58, functions 14/14, lines 438/438)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Seven identities leave the production finding census with zero additions"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (red by design: 7 removals from this plan, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The census equality gates are red by design until the parent applies its single Wave 6 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."

duration: 42 min
completed: 2026-09-14
status: complete
---

# Phase 5 Plan 19: Plugin Outcome and Replacement Owners Summary

**Seven install, PATH, reinstall-replacement and reinstall-projection helpers became module-private, and each one's cases now assert the public result that carries it: the `unavailable` row `classifyEntityShapeError` composes, the ledger and `PATH` `recomputePluginPath` writes, the `REAL_REINSTALL_TRANSACTION` schedule steps, and the exact notification bytes `renderReinstallPartitionAndNotify` emits.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-14T20:03:35Z
- **Completed:** 2026-09-14T20:46:01Z
- **Tasks:** 2
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- Privatized `narrowResolverReasons` and `collectBinDirs`. Their 22 existing cases were repointed at the public install failure row and at `recomputePluginPath`'s ledger/`PATH` result without losing a single expected value.
- Rewrote the cross-surface reason-parity gate so the install side is the actual public row, not an import of the command-private narrowing helper. Both surfaces stay pinned to independent literals, so neither derives its expectation from the other formatter.
- Privatized the four reinstall replacement steps and declared each one on `ReinstallTransaction` as an explicit signature. `REAL_REINSTALL_TRANSACTION`'s annotation is now the single place a signature drift fails to compile.
- Privatized `outcomeToPluginMessage` and moved its nine projection cases onto `renderReinstallPartitionAndNotify`, where each one pins the complete notification string and severity rather than a row object.
- Retired `outcomeToPluginMessage`'s orphan-fold row-scope path with caller evidence after measuring that privatization left it at branches 58/62, and dispositioned the one transitive census finding the change exposed (`ReinstallMsg`) inside the same owner file.

## Task Commits

1. **Task 1: Observe resolver reasons and PATH through their public outputs** — `accb1fcd` (refactor)
2. **Task 2: Exercise replacements and notifications through owned contracts** — `0f5f9d4c` (refactor)

**Plan metadata:** see the final `docs:` commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` — `narrowResolverReasons` loses its `export` (one-line diff).
- `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` — `collectBinDirs` loses its `export` (one-line diff).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts` — four schedule steps lose their `export`; `ReinstallTransaction` declares each as an explicit signature.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` — `outcomeToPluginMessage` and `ReinstallMsg` lose their `export`; the unreachable row-scope argument and its three conditional spreads are retired.
- `tests/orchestrators/plugin/install.messaging.test.ts` — 19 cases drive `classifyEntityShapeError` through one `installFailureReasons` helper.
- `tests/orchestrators/plugin-path.test.ts` — three `collectBinDirs` cases become three `recomputePluginPath` cases.
- `tests/architecture/cross-surface-reason-parity.test.ts` — six call sites drive the public install row through one `installSurfaceReasons` helper.
- `tests/orchestrators/plugin/reinstall-replace.test.ts` — eleven call sites go through `REAL_REINSTALL_TRANSACTION`; the factory-identity case becomes a complete transaction-shape case.
- `tests/orchestrators/plugin/reinstall.messaging.test.ts` — eight projection cases assert exact notification bytes; two type-only proofs retarget the public row composer.
- `.planning/tdd-evidence/05-19-01.json`, `.planning/tdd-evidence/05-19-02.json` — the two validated RED records.

## Census Identity Delta (for the parent's Wave 6 reconciliation)

This is this plan's contribution only. 05-15 contributes one more removal; two sibling Wave 6 plans contribute their own.

**Removed (7):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts\|narrowResolverReasons` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin-path.ts\|collectBinDirs` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts\|finalizeReinstalledPlugin` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts\|replaceReinstalledPlugin` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts\|rollbackReinstalledPlugin` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts\|runPostSuccessMaintenance` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts\|outcomeToPluginMessage` |

The matching `UNOWNED_EXPORT_CENSUS` keys go with them. `install.messaging.ts`, `plugin-path.ts` and `reinstall.messaging.ts` each had exactly one member, so all three keys go; `reinstall-replace.ts` had exactly those four members, so its key goes too.

**Added (0):** none.

**The one transitive finding, and its disposition.** Privatizing `outcomeToPluginMessage` removed the last exported signature naming `ReinstallMsg`, and the live census immediately reported a NEW identity: `unused_types|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts|ReinstallMsg`. It is not left for the parent. `ReinstallMsg`'s only consumer outside its own module was two type-only proofs in the owner test, so it was privatized in the same change (D-03) and the proofs retarget `ReturnType<typeof reinstalledRowFromOutcome>` — a public export of the same module. The re-measured report reads `now unowned but not pinned (0): none`.

**Evidence of each disposition.** `grep -rn` over `extensions`, `tests` and `scripts` shows each privatized name has exactly one in-module caller and no remaining external reference: `narrowResolverReasons` ← `classifyEntityShapeError`; `collectBinDirs` ← `recomputePluginPath`; the four replacement steps ← `REAL_REINSTALL_TRANSACTION` (itself reached from `reinstall-flow.ts:220`); `outcomeToPluginMessage` ← `renderReinstallPartitionAndNotify`.

The measured gate output reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (8): extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts#createInstallPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts#narrowResolverReasons, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#finalizeReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#replaceReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#rollbackReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#runPostSuccessMaintenance, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts#outcomeToPluginMessage, extensions/pi-claude-marketplace/orchestrators/plugin-path.ts#collectBinDirs
```

The eighth entry is 05-15's `createInstallPlugin`, not this plan's. Live census `total_issues` moves 31 -> 24. The wave was serialized, so no sibling writer was active during the reading, but the parent still re-measures on the stable snapshot before editing the pin.

## Assertion Ledger

### `tests/orchestrators/plugin/install.messaging.test.ts` — 19 cases

Every case kept its exact `assert.deepStrictEqual(<reasons>, [<literal>])`. Only the subject changed: `narrowResolverReasons(reasons, kinds, partialable)` became `installFailureReasons(reasons, kinds, partialable)`, which throws the equivalent `not-installable` `PluginShapeError` at `classifyEntityShapeError` and returns the composed row's `reasons`. The three parameters map one-to-one onto `err.shape.reasons`, `err.shape.unsupportedKinds` and `err.shape.partialable`, which is exactly what the production call site passes.

| # | Original assertion subject | Disposition | Proof |
| --- | --- | --- | --- |
| 1-10 | `narrowResolverReasons([note])` for the ten hooks/errno/parse note families | Repointed, expected literal byte-identical | parameterized loop, 10/10 pass |
| 11 | `narrowResolverReasons(["contains lspServers"])` | Repointed | `["lsp"]` verbatim |
| 12 | `narrowResolverReasons(["contains monitors"], ["monitors"], true)` | Repointed | `["unsupported component"]` verbatim |
| 13 | `narrowResolverReasons(["contains monitors"], [], false)` | Repointed | `["unsupported source"]` verbatim |
| 14 | malformed-MCP precedence over an embedded parse phrase | Repointed | `["malformed mcp"]` verbatim |
| 15 | `"source"` substring catch-all | Repointed | `["unsupported source"]` verbatim |
| 16 | empty note | Repointed | `["unsupported source"]` verbatim |
| 17 | every optional input omitted | Repointed | `["unsupported source"]` verbatim |
| 18 | wholly unclassifiable note | Repointed | `["unsupported source"]` verbatim |
| 19 | typed-kind precedence and first-seen dedup | Repointed | `["unsupported component", "lsp"]` verbatim |

**Added (1 per case):** `assert.ok(entityErrorRow, "a not-installable shape must classify to an entity error row")` inside the helper — the classifier returns `EntityErrorRow | undefined`, so the presence of a row is now asserted 19 times where the old subject could not fail that way.

**Removed: none.** The file's existing `classifyEntityShapeError` describe still asserts the complete row (kind, name, marketplace, scope, status, reasons, partialable) for four shapes, so the whole-row contract is unchanged.

### `tests/architecture/cross-surface-reason-parity.test.ts` — 6 call sites, 17 tests

Each case keeps all three of its assertions: the install result against an independent literal, the read-only result against the same literal, and the two against each other. Only the install measurement changed, from `narrowResolverReasons(...)` to `installSurfaceReasons(...)`, which returns `classifyEntityShapeError(...).reasons`. The read-only side still measures `narrowResolverNotes` / `narrowUnsupportedKinds` — the real seams the `list` and `info` rows consume. The `XSURF-03` rendered-brace case was not touched.

**Added (1 per case):** the same `assert.ok(entityErrorRow, ...)` presence check inside the helper.
**Removed: none.**

### `tests/orchestrators/plugin-path.test.ts` — 3 cases

| Original assertion | Replacement public assertion | Proof |
| --- | --- | --- |
| `assert.deepStrictEqual(collectBinDirs(state), ["/plugins/second/bin", "/plugins/first/bin", "/plugins/last/bin"])` — marketplace-then-plugin insertion order with one disabled record excluded | `assert.deepStrictEqual(pathEnvironmentShape(), { ledger: { present: true, value: "<those three joined by the PATH delimiter>" }, path: { present: true, value: "<baseline + those three>" } })` | The ledger string is the ordered list verbatim; a disabled record's bin would appear in it. Plus a new `assert.deepStrictEqual(pathUpdate, { skipped: [] })`. |
| `assert.deepStrictEqual(collectBinDirs({ schemaVersion: 2, marketplaces: {} }), [])` | `assert.deepStrictEqual(pathEnvironmentShape(), { ledger: { present: false }, path: { present: true, value: baseline } })` | A seeded marketplace-free state leaves an already-set `PATH` byte-identical and never materializes the ledger, which is only true when the collected list is empty. Plus `{ skipped: [] }`. |
| `assert.deepStrictEqual(collectBinDirs(state), ["/plugins/valid/bin"])` and the three exact `console.error` diagnostic lines for the empty / relative / PATH-delimiter roots | The diagnostic assertion is preserved **verbatim**, including all three exact strings and their order; the dropped-roots claim becomes `ledger.value === "/plugins/valid/bin"` and `path.value === "<baseline>:/plugins/valid/bin"` | The invalid roots are provably absent from the real `PATH`, which is the property WR-01 exists to protect. Plus `{ skipped: [] }`. |

**Removed: none.** **Added: 3** (one `{ skipped: [] }` per case) plus the `PATH` half of each environment shape.

### `tests/orchestrators/plugin/reinstall-replace.test.ts` — 1 rewritten case, 11 repointed call sites

| Original assertion | Disposition | Proof |
| --- | --- | --- |
| `assert.strictEqual(REAL_REINSTALL_TRANSACTION.replaceReinstalledPlugin, replaceReinstalledPlugin)` | **Retired with its subject.** The identity comparison needs the private implementation as a second operand, which no caller can name. Replaced by a complete shape assertion over `Object.entries(REAL_REINSTALL_TRANSACTION)`: all six members present with the right value kinds. | A dropped or renamed member is a missing key. Control E (an extra member added to the real transaction) fails exactly this case. |
| The 11 direct calls to the four steps | Repointed to `REAL_REINSTALL_TRANSACTION.<step>(...)`, arguments unchanged | Every downstream assertion — the 17-entry ordered `calls` array, both warning arrays, both leak arrays, the two `ManualRecoveryError` rejections, the abort-order slices, the hook-entry projection, the `Object.isFrozen` checks and the exact two deferred-maintenance warning strings — is byte-identical. |

**Removed: 1** (the factory-identity comparison, with its unreachable subject). **Added: 6** (one per transaction member in the shape assertion).

### `tests/orchestrators/plugin/reinstall.messaging.test.ts` — 9 cases become 8

Each old case asserted a row object; each new case asserts the complete notification string plus the notify severity argument through the strict `strong-mock` boundary. The mapping from row field to observable byte is total:

| Row field | Observable in the public result |
| --- | --- |
| `status` | the rendered status token — `(reinstalled)`, `(skipped)`, `(failed)`, `(manual recovery)` |
| `name` | the row subject |
| `reasons` | the `{...}` brace, in order, comma-separated |
| `severity` | `ui.notify(message)` for `info` versus `ui.notify(message, "warning" \| "error")`, plus the leading `A plugin operation needs attention.` / `has failed.` sentence |
| `needsReload` | the presence or absence of the `/reload to pick up changes` trailer |
| `dependencies` | the `{requires pi-subagents}` / `{requires pi-mcp}` markers (exercised by the pre-existing plural cascade case) |

| Original case | Disposition |
| --- | --- |
| projects a clean reinstalled outcome without row scope | Repointed: `● official [project]` / `  ● alpha v1.0.0 (reinstalled)` + reload trailer, `info` (one-argument notify) |
| gives a missing installed target error severity | **Subsumed**, not duplicated. The file's pre-existing `renderReinstallPartitionAndNotify omits tally and reload for a single missing target` drives the identical outcome (`skipped` / `alpha` / `official` / `project` / `["not installed"]`) and asserts the complete bytes plus `"error"` severity — strictly more than the old row object. |
| preserves ordered idempotent skip reasons and orphan scope | Repointed for the reason order and `info` severity; the `scope: "project"` half is **retired** (see below) |
| gives an opaque skipped note warning severity | Repointed: `{unreadable}` + `"warning"` |
| gives an empty skipped reason set warning severity | Repointed: a brace-less `(skipped)` row + `"warning"` |
| gives manual recovery precedence over typed reasons | Repointed: `(manual recovery) {rollback partial}` + `"warning"`; the `scope: "user"` half is **retired** |
| preserves typed failed reasons over note fallback | Repointed: `(failed) {permission denied, source missing}` + `"error"`; the `scope: "project"` half is **retired** |
| replaces an empty typed failed reason set with unreadable | Repointed: `(failed) {unreadable}` + `"error"` |
| narrows a rollback note for an ordinary failure | Repointed: `(failed) {rollback partial}` + `"error"` |

**The three retired row-scope assertions.** They asserted that a row carries a `scope` when it differs from its marketplace block's scope. `renderReinstallPartitionAndNotify` is the sole caller of `outcomeToPluginMessage`; it keys blocks on `` `${outcome.scope}:${outcome.marketplace}` `` and sets `block.scope = outcome.scope`, so every outcome in a block has that block's scope and the argument could only ever be equal. The assertions had no reachable subject, and keeping the code produced a measured `branches 58/62` direct-coverage shortfall. The implementation and its assertions were retired together, per D-03's "retire truly unreachable implementations with caller evidence".

**The two type-only proofs.** `satisfies ReinstallMsg` became `satisfies ReturnType<typeof reinstalledRowFromOutcome>`. The negative half still discriminates: making `dependencies` optional on `PluginReinstalledMessage` produces `tests/orchestrators/plugin/reinstall.messaging.test.ts(39,3): error TS2578: Unused '@ts-expect-error' directive.` — measured, then reverted.

## Verification Results

| Command | Result |
| --- | --- |
| `node --test tests/orchestrators/plugin/install.messaging.test.ts tests/orchestrators/plugin-path.test.ts tests/architecture/cross-surface-reason-parity.test.ts` (task 1 verify) | **74 tests, 74 pass, 0 fail** — identical to the 74 measured on the base commit |
| `node --test tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/plugin/reinstall.messaging.test.ts` (task 2 verify) | **29 tests, 29 pass, 0 fail** — 30 on the base commit; the net −1 is the subsumed projection case |
| `node --test tests/orchestrators/plugin/reinstall-flow.test.ts` | 121 tests, 121 pass, 0 fail |
| `npm test` (full unit) | **6244 tests, 6242 pass, 2 fail** — the two failures are exactly the parent-owned census equality gates. Baseline 6245/6243/2; the net −1 is the same subsumed case. |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail, exit 0** — matches the 32 baseline |
| `npm run typecheck` | exit 0 |
| `npx eslint extensions tests` | exit 0, no output |
| `npx prettier --check "extensions/**/*.ts" "tests/**/*.ts"` | All matched files use Prettier code style |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold; dupes: not above the gate) |
| `npm run test:corresponding` / `:negative` | both passed |
| `npm run test:coverage:direct:negative` | passed; `scripts/test-coverage-direct.pin.json` unchanged, both pinned shortfalls matched exactly |
| `npm run format:check` | All matched files use Prettier code style |
| `SKIP=trufflehog pre-commit run --files ...` | passed on both commits' exact file sets |

### Direct coverage, changed production modules

Every one measures hit == found before and after, so none needs a pin.

| Module | Before | After |
| --- | --- | --- |
| `orchestrators/plugin/install.messaging.ts` | branches 88/88, functions 18/18, lines 636/636 | unchanged |
| `orchestrators/plugin-path.ts` | branches 16/16, functions 2/2, lines 115/115 | unchanged |
| `orchestrators/plugin/reinstall-replace.ts` | branches 46/46, functions 16/16, lines 518/518 | branches 46/46, functions 16/16, lines 536/536 |
| `orchestrators/plugin/reinstall.messaging.ts` | branches 63/63, functions 14/14, lines 446/446 | branches 58/58, functions 14/14, lines 438/438 |

`reinstall.messaging.ts` loses 5 branches and 8 lines because the retired row-scope path is gone; the intermediate state, with the code kept and the export removed, was measured at **branches 58/62** and is the evidence that the path was unreachable. `reinstall-replace.ts` gains 18 lines from the explicit interface signatures, all of them type positions.

### Discrimination controls

A green suite proves nothing on its own, so each rewritten owner was run against planted offenders. Every offender was reverted immediately and the benign control re-run.

| Control | Planted defect | Result |
| --- | --- | --- |
| A (recorded, `05-19-01.json`) | the manifest-field carve-out in `classifyResolverReason` returns `"unsupported source"` instead of the mapped token | 6 failures across both rewritten gates; `gsd-tools check tdd-red-evidence` returns `RED_EVIDENCE_OK` / `target_test_failed` (64 discovered, 58 pass, 6 fail) |
| B | `collectBinDirs` stops skipping disabled records | 2 of the 3 migrated PATH cases fail |
| B2 | `collectBinDirs` drops the `asAbsolutePluginRoot` containment guard | the invalid-root diagnostic case fails |
| C (recorded, `05-19-02.json`) | the failed arm drops the `"unreadable"` fallback for an empty typed reason set | the matching projection case fails on the exact notify bytes; `RED_EVIDENCE_OK` / `target_test_failed` (19 discovered, 18 pass, 1 fail) |
| D | `rollbackReplacements` stops reversing the replacement list | the atomic-order case and the malformed-hooks compensation case both fail |
| E | an extra member is added to `REAL_REINSTALL_TRANSACTION` | the transaction-shape case fails |
| F | `dependencies` made optional on `PluginReinstalledMessage` | `TS2578` on the retargeted `@ts-expect-error`, proving the type-only proof still discriminates restoration |
| benign ×3 | none | install/PATH/parity 74/74, replacement 10/10, projection 19/19 |

## Decisions Made

- **Explicit signatures on `ReinstallTransaction` instead of `typeof`.** `typeof finalizeReinstalledPlugin` in an exported interface points at a module-private declaration, which is the shape the file already carries one `fallow-ignore private-type-leak` for. The explicit form avoids four more of those and is strictly stronger: with `typeof`, a change to the implementation silently changes the interface; with the explicit signature, `REAL_REINSTALL_TRANSACTION`'s annotation refuses to compile.
- **Retiring the row-scope path rather than pinning a shortfall.** D-01 forbids reducing coverage and the phase forbids adding a pin to absorb one. The alternatives were: keep an unreachable branch and record a shortfall (forbidden), keep `outcomeToPluginMessage` exported (contradicts the plan's action), or retire the branch with caller evidence (D-03). Only the third satisfies every constraint.
- **`ReinstallMsg` handled here, not deferred.** It is in this plan's declared owner set and the finding was created by this plan's change, so leaving it would have handed the parent an unexplained census addition — the one thing 05-VALIDATION calls a failure rather than a delta.
- **The parity gate keeps its surface-to-surface comparison.** The instruction forbids deriving expected output from another formatter. Both surfaces are pinned to an independent literal first, so the third assertion adds the parity claim on top of two independent pins rather than replacing them.
- **`installFailureReasons` / `installSurfaceReasons` return the reason array, not the whole row.** The whole-row form was considered and rejected: repeating an eight-field literal across 25 cases invites a `fallow dupes` clone group, and the file's existing `classifyEntityShapeError` describe already pins the complete row for four shapes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The unreachable row-scope path was retired to keep direct coverage at 100%**

- **Found during:** Task 2
- **Issue:** Privatizing `outcomeToPluginMessage` as the task directs leaves its `marketplaceScope` parameter with no caller that can pass a differing scope, because the sole production caller groups outcomes by scope. `npm run test:coverage:direct` measured the result at `branches 58/62` and the negative-control gate refused the unpinned shortfall. D-01 forbids reducing coverage and this plan may not add a pin.
- **Fix:** Retired the parameter, the `rowScope` ternary and the three conditional `scope` spreads, with the grouping invariant recorded as the caller evidence. `reinstalledRowFromOutcome` keeps its public `rowScope` parameter and its own coverage.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`, `tests/orchestrators/plugin/reinstall.messaging.test.ts`
- **Verification:** direct coverage returns to branches 58/58, functions 14/14, lines 438/438; 19/19 focused tests pass; 121/121 reinstall-flow tests pass; integration 32/32.
- **Committed in:** `0f5f9d4c`

**2. [Rule 3 - Blocking] `ReinstallMsg` privatized to absorb the transitive census finding**

- **Found during:** Task 2 census measurement
- **Issue:** After `outcomeToPluginMessage` went private, no exported signature named `ReinstallMsg`, and the live census reported a new `unused_types` identity for it — an addition, which 05-VALIDATION treats as a wave failure rather than a delta.
- **Fix:** Privatized `ReinstallMsg` (its only external consumer was two type-only proofs in the owner test) and retargeted those proofs at `ReturnType<typeof reinstalledRowFromOutcome>`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`, `tests/orchestrators/plugin/reinstall.messaging.test.ts`
- **Verification:** re-measured census reports `now unowned but not pinned (0): none`; control F proves the retargeted negative proof still yields TS2578 when the contract is restored.
- **Committed in:** `0f5f9d4c`

**3. [Rule 3 - Blocking] RED recorded as validated evidence rather than a separate commit**

- **Found during:** Tasks 1 and 2
- **Issue:** The TDD reference asks for a `test(...)` commit holding the failing test. This repository's `.pre-commit-config.yaml` runs a `npm direct coverage (changed pairs)` hook that executes the focused test for every changed source/test pair, so a commit whose test is red cannot pass the chain, and CLAUDE.md forbids `--no-verify` and forbids recovering from a failed hook after the fact.
- **Fix:** RED ran as a real gate at both tasks. For a privatization the meaningful RED is discrimination — the rewritten public case must fail when the privatized behaviour breaks — so a defect was planted in each privatized helper, the target case failed on its behavioural assertion, and both runs were machine-validated with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK` / `target_test_failed`). Records are committed at `.planning/tdd-evidence/05-19-01.json` and `05-19-02.json`.
- **Files modified:** the two evidence records.
- **Verification:** both verdicts are reproducible from the committed records.
- **Committed in:** `accb1fcd`, `0f5f9d4c`

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking).
**Impact on plan:** No scope creep and no weakening. Deviations 1 and 2 are the direct consequence of doing exactly what the task's action directs, resolved inside this plan's own declared owner files under D-03. Deviation 3 is a commit-granularity consequence of this repository's gate chain, not a change to what was built or asserted. Every file, action and verify command in both tasks was executed as written.

## Issues Encountered

- The two census equality gates are red at this plan's HEAD. This is the designed state for a cleanup plan mid-wave and matches the Wave 5 and 05-15 precedent; the parent applies one reviewed pin edit at the Wave 6 reconciliation.
- No other failure. The eight hand-authored notification byte literals were correct on first run, and no fixture was generated from the implementation under test.

## Known Stubs

None. Every planted offender existed only inside this session and was reverted before the commit that followed it; no commit contains one.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Blocking for the parent:** the Wave 6 census reconciliation must remove exactly the seven identities listed above on behalf of this plan, and must re-measure on the stable wave snapshot rather than trusting the live reading here.
- **Advisory for 05-16 / 05-17 / 05-18:** `reinstall-replace.ts`'s schedule steps are now reachable only through `REAL_REINSTALL_TRANSACTION`. A later plan that moves that composition into `orchestrators/plugin/operations.ts` inherits a transaction whose members are already explicit signatures, so no `typeof` of a private implementation has to be untangled first.
- **Advisory for 05-23:** `reinstall.messaging.ts` no longer exports a message union, so a later notification-vocabulary plan should read `REINSTALL_CONTEXT` and `reinstalledRowFromOutcome` as that module's public surface.
- Aggregate production unit coverage was deliberately **not** measured here. 05-VALIDATION assigns it to the parent once per stable wave.
- `.planning/ROADMAP.md`'s phase-5 row was hand-edited to `18/28` and diff-checked; `roadmap.update-plan-progress` was not run, per the phase constraint recording its corruption during 05-24.

## Self-Check: PASSED

- `.planning/tdd-evidence/05-19-01.json` — FOUND
- `.planning/tdd-evidence/05-19-02.json` — FOUND
- all nine modified source/test files — FOUND
- commit `accb1fcd` — FOUND
- commit `0f5f9d4c` — FOUND
- `git rev-list --count 856d12a9..HEAD` — 2, matching the two task commits recorded above

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*
