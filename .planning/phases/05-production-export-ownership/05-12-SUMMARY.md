---
phase: 05-production-export-ownership
plan: "12"
subsystem: persistence
tags: [typescript, node-test, typebox, fallow, persistence, completion-cache]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "Wave 4 hook callback/constant/facade privatization and the strengthened barrel absence proofs (05-05, 05-11)"
  - phase: 05-production-export-ownership
    provides: "05-02's persistence groundwork this plan's owner tests build on"
provides:
  - "CONFIG_VALIDATOR, PLUGIN_INDEX_CACHE_SCHEMA, PLUGIN_INSTALL_RECORD_SCHEMA, STATE_SCHEMA and STATE_VALIDATOR private to their defining modules"
  - "MARKETPLACE_NAMES_CACHE_SCHEMA and the EnabledPluginRecord alias retired with no-caller evidence"
  - "Validity and the diagnostic taken from the compiled validator's first Errors entry, retiring the unreachable no-detail branch"
  - "Exact public type proofs for the persisted record key set, the accepted state versions, the required resource arrays and the closed cache row status"
  - "Measured production finding delta 39 -> 32, exactly seven removals, zero additions, for the parent wave reconciliation"
affects: [05-24, 05-28, 05-15, wave-5-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 2
  commits: 2
  plan_head_before: 882d7a381470bde828e2a9c58d4856f01a684bde
  # tokens: deliberately omitted. Actual token telemetry is unavailable in this
  # environment and the user decision on record forbids reporting diff
  # characters divided by four as an actual. See 05-CONTEXT.md / handoff.

tech-stack:
  added: []
  patterns:
    - "A compiled TypeBox validator's first Errors entry decides validity and supplies the diagnostic; the installed accelerated path keeps the valid-input check and removes the duplicate check on invalid input"
    - "An exact public type equality (IsExact<Actual, Expected> with an independently written Expected) replaces private JSON Schema introspection in an architecture gate"

key-files:
  created:
    - .planning/phases/05-production-export-ownership/deferred-items.md
  modified:
    - extensions/pi-claude-marketplace/persistence/config-io.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - tests/persistence/config-io.test.ts
    - tests/shared/completion-cache.test.ts
    - tests/persistence/state-io.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts

key-decisions:
  - "Take validity from the compiled validator's first Errors entry rather than a Check call followed by a second Errors call. The installed typebox 1.3.28 Errors runs the accelerated Check first and returns [] on success, so the valid path keeps its fast check and the invalid path stops repeating it."
  - "Retire the two no-detail fallbacks and the forced loader-root diagnostic instead of preserving them. Both were reachable only by replacing Errors inside a test; no real JSON value produces the split-pass state. The real root diagnostic is now proved through saveState(null) with unchanged existing bytes."
  - "Retire MARKETPLACE_NAMES_CACHE_SCHEMA outright rather than privatizing it: its only reader, the marketplace-name cache reader, was already removed, so a private declaration would be dead code. Live invalidation and unlink-error contracts are untouched."
  - "Retire the EnabledPluginRecord alias rather than keep it private. It was PluginInstallRecord intersected with enabled:true and no live signature used the narrower form; the surviving positive record and incomplete-record negative go through PluginInstallRecord."
  - "Replace private schema introspection in the two architecture gates with exact public type equalities instead of moving the introspection behind a new export. Six isolated controls prove each equality fails to compile on the drift it guards."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates fail by design until 05-24 also lands."

patterns-established:
  - "Behaviour-preservation proof for a validation refactor: apply the owner test rewrite alone, run it green against the OLD production, then apply the production change and re-run. Both tasks did this (56/56 and 187/187 before the production edit)."
  - "A library property a refactor depends on is proved by reading the installed implementation AND by running a generated corpus through it, not by assertion. 644 JSON-compatible cases confirm Check and empty-Errors agree and that validation does not mutate its input."
  - "Every retained assertion claim is machine-verified against the committed files, not asserted: 831 of 864 original assert nodes were re-located by AST in the same test case with identical text."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "persistence/config-io.ts keeps CONFIG_VALIDATOR private and takes validity plus the diagnostic from its first Errors entry; loadConfig and saveConfig retain every absent/invalid/valid result, error message, containment refusal and byte contract."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "tests/persistence/config-io.test.ts#loadConfig / accepts a complete version-1 config"
        status: pass
      - kind: unit
        ref: "tests/persistence/config-io.test.ts#saveConfig / rejects invalid data before containment and preserves existing bytes"
        status: pass
      - kind: unit
        ref: "node --test tests/persistence/config-io.test.ts tests/shared/completion-cache.test.ts (56 tests, 56 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/persistence/config-io.ts (branches 17/17, functions 4/4, lines 195/195)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared/completion-cache.ts keeps PLUGIN_INDEX_CACHE_SCHEMA private and drops MARKETPLACE_NAMES_CACHE_SCHEMA; cache hydration, rebuild, TTL, poison, invalidation and unlink-error behaviour are unchanged and now asserted through exact serialized bytes."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#hydrates every supported plugin status and retains exact cache bytes"
        status: pass
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#rebuilds a cache with {11 malformed fields} into complete current bytes"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/shared/completion-cache.ts (branches 48/48, functions 15/15, lines 389/389)"
        status: pass
    human_judgment: false
  - id: D3
    description: "persistence/state-io.ts keeps PLUGIN_INSTALL_RECORD_SCHEMA, STATE_SCHEMA and STATE_VALIDATOR private and drops the unused EnabledPluginRecord alias; loadState and saveState retain every version, normalization, corrupted-state, refusal and no-write contract."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#loads {schema version 1 | schema version 2 | optional reconciliation stamp} through the state contract"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#rejects a nonobject save without replacing state bytes"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#rejects {a plugin without hooks | a plugin with non-array hooks | a plugin without enabled} before saving state"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/persistence/state-io.ts (branches 54/54, functions 9/9, lines 494/494)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The COMPAT-01 and hook-foundation gates still reject an added persisted field, an added or widened row status, an added state version, an optional hooks resource array and a dropped persisted field in the saved bytes."
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "drift controls re-run against the committed code in /tmp/05-12-controls-live: benign-types exit 0; added-persisted-field, added-status, broad-status, added-state-version and optional-hook-resource each exit 2 with TS1360 at the named gate; benign-serialization pass 38; dropped-persisted-field exits 1 with ERR_ASSERTION"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/hooks-foundation.test.ts (part of the 187-test task 2 run, 0 fail)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replacing Check-then-Errors with a single Errors call preserves the accept/reject verdict, the diagnostic and the input, for every JSON-compatible shape the two schemas admit."
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "typebox corpus probe re-run live against the committed schemas: config 126 cases (19 accepted, 107 rejected), state 518 (112, 406), 644 total; both validators accelerated; Check and empty-Errors agree on every case; JSON bytes unchanged; every rejection carries a string instancePath and message"
        status: pass
      - kind: other
        ref: "node_modules/typebox/build/compile/validator.mjs Errors(value): `if (this.IsAccelerated() && this.Check(value)) return []`"
        status: pass
    human_judgment: false
  - id: D6
    description: "Production finding census moves 39 -> 32 with exactly seven removals and zero additions; the single pin edit is deferred to the parent wave reconciliation."
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json -> total_issues 32, schema 9, fallow 3.22.0, 11 entry points, normal issue exit 1"
        status: pass
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts (7 tests, 5 pass, 2 fail - each failing on exactly the ten Wave 5 identities so far, zero additions)"
        status: fail
    human_judgment: true
    rationale: "The pin edit is explicitly parent-owned ('do not edit the shared census pin from this plan'). The two failing gates are the designed hand-off signal, so the parent must review the combined delta and update tests/architecture/gate-targets.ts once, after 05-24 also lands."

# Metrics
duration: 33 min
completed: 2026-09-14
status: complete
---

# Phase 05 Plan 12: Persistence and Cache Schema Ownership Summary

**Config, state and completion-cache validation is now owned entirely inside its three modules -- seven test-only schema and validator exports retired (39 -> 32 findings) -- with every private-schema assertion replaced by a public load/save/hydrate result, an exact serialized byte string, or an exact public type equality proved by six isolated compiler controls.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-14T17:53:00Z
- **Completed:** 2026-09-14T18:26:00Z
- **Tasks:** 2
- **Files modified:** 9 (plus one new phase `deferred-items.md`)

## Accomplishments

- `persistence/config-io.ts` keeps `CONFIG_VALIDATOR` private. `loadConfig` and `saveConfig` now read the compiled validator's first `Errors` entry for both the verdict and the diagnostic, so an invalid value no longer runs `Check` and then re-walks the same schema for its message. Every absent / invalid / valid result, every exact error string, the containment refusal and the two-space byte output are unchanged.
- `shared/completion-cache.ts` keeps `PLUGIN_INDEX_CACHE_SCHEMA` private and drops `MARKETPLACE_NAMES_CACHE_SCHEMA` entirely -- its only reader was removed before this plan. The two JSON Schema representation tests are replaced by a nine-status hydration case that also asserts the cache file bytes are untouched, and eleven malformed-field cases that each rebuild into a complete, exact serialized cache.
- `persistence/state-io.ts` keeps `PLUGIN_INSTALL_RECORD_SCHEMA`, `STATE_SCHEMA` and `STATE_VALIDATOR` private and drops the `EnabledPluginRecord` alias no signature consumed. `loadState` and `saveState` use the same single-`Errors` shape. Four `STATE_VALIDATOR.Check` booleans became complete public load outputs; three malformed-plugin `Check === false` results became `saveState` rejections carrying the exact error class, name, path-qualified message and `cause`, each with the pre-existing bytes proved unchanged.
- The two architecture gates that navigated the private schema now pin exact public types: `keyof PluginInstallRecord` equals its nine independently written keys, `Extract<keyof PluginInstallRecord, {seven forbidden spellings}>` equals `never`, `ExtensionState["schemaVersion"]` equals `1 | 2`, `PluginInstallRecord["resources"]` equals the five required string arrays, and `PluginIndexRow["status"]` equals its nine literals.
- The two `install-flow` sites that used `STATE_VALIDATOR.Check` to narrow a `JSON.parse` result now take a typed before-snapshot from the real `loadState`, selected by the exact pre-existing state bytes. Every outcome, error, notification, rollback, retry, byte and interaction assertion in both cases is unchanged.
- Measured finding delta 39 -> 32: exactly seven identities removed, zero added. No new production module, no test-only export, no artificial reader, no analyzer exception, no relaxed gate.

## Task Commits

1. **Task 1 (tracer): Observe validation through persisted config and cache behavior** - `13a65732` (refactor)
2. **Task 2: Preserve state compatibility through the state contract** - `fccb598a` (refactor)

Measured commit count for this plan: `git rev-list --count 882d7a381470bde828e2a9c58d4856f01a684bde..HEAD` = **2** (before this metadata commit).

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/config-io.ts` - `CONFIG_VALIDATOR` private; `firstConfigValidationErrorDetail` takes the issue instead of re-deriving it; both public operations read the first `Errors` entry; the `saveConfig` order docblock names the call it now makes.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - `MARKETPLACE_NAMES_CACHE_SCHEMA` removed; `PLUGIN_INDEX_CACHE_SCHEMA` private.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` - three schema/validator bindings private; `EnabledPluginRecord` removed; `firstValidationErrorDetail` takes the issue; `loadState` and `saveState` read the first `Errors` entry; one documented assertion each after zero issues.
- `tests/persistence/config-io.test.ts` - the validator `Check` case became a full `loadConfig` result comparison; the forced no-detail case is retired.
- `tests/shared/completion-cache.test.ts` - both schema representation cases replaced by one nine-status hydration case with byte retention, eleven malformed-field rebuild cases with exact output bytes, and one exact public status type equality.
- `tests/persistence/state-io.test.ts` - four version `Check` booleans and the complete-record `Check` became `loadState` comparisons; the forced loader-root and no-detail cases became a real `saveState(null)` rejection; three malformed-plugin `Check` results became `saveState` rejections with exact messages and retained bytes.
- `tests/architecture/compat-01-no-expansion.test.ts` - three schema introspection cases replaced by three exact public type equalities; the docblock's "eight fields" corrected to nine (the list always held nine).
- `tests/architecture/hooks-foundation.test.ts` - two schema traversal cases replaced by two exact public type equalities; header rewritten to describe the technique now used.
- `tests/orchestrators/plugin/install-flow.test.ts` - two validator-based `JSON.parse` narrowing sites replaced by `loadState` snapshots selected on exact bytes.
- `.planning/phases/05-production-export-ownership/deferred-items.md` - two out-of-scope consequences recorded (see Deferred Items below).

## Finding Dispositions

A clean count is not a disposition. Each identity below has explicit caller or privatization evidence, gathered with CodeGraph plus a whole-tree grep over `extensions`, `tests` and `scripts` before the export was removed.

| Category | Path | Identity | Disposition | Evidence |
| --- | --- | --- | --- | --- |
| unused_exports | `persistence/config-io.ts` | `CONFIG_VALIDATOR` | Privatized | Still compiled from `CONFIG_SCHEMA` in the same module and still the sole validation boundary for `loadConfig` and `saveConfig`. The only cross-module reader was `tests/persistence/config-io.test.ts`. |
| unused_exports | `persistence/state-io.ts` | `PLUGIN_INSTALL_RECORD_SCHEMA` | Privatized | `MARKETPLACE_RECORD_SCHEMA` embeds it and the public `PluginInstallRecord` type is still derived from it. The only cross-module readers were `tests/architecture/compat-01-no-expansion.test.ts` and `tests/architecture/hooks-foundation.test.ts`. |
| unused_exports | `persistence/state-io.ts` | `STATE_SCHEMA` | Privatized | `STATE_VALIDATOR` compiles it and the public `ExtensionState` type is still derived from it. Same two test readers. |
| unused_exports | `persistence/state-io.ts` | `STATE_VALIDATOR` | Privatized | `loadState` and `saveState` validate through it. The cross-module readers were `tests/persistence/state-io.test.ts` and two `tests/orchestrators/plugin/install-flow.test.ts` narrowing sites, both now using public `loadState`. |
| unused_exports | `shared/completion-cache.ts` | `MARKETPLACE_NAMES_CACHE_SCHEMA` | **Retired** with its exclusive representation test | No runtime reader in production or tests beyond the schema-shape assertion. The marketplace-name cache reader was removed before this plan, and the file's own owner test still asserts its absence. `invalidateMarketplaceNames` still unlinks the names cache and still propagates a non-ENOENT unlink error. |
| unused_exports | `shared/completion-cache.ts` | `PLUGIN_INDEX_CACHE_SCHEMA` | Privatized | `PLUGIN_INDEX_VALIDATOR` compiles it in the same module and still validates every disk cache for the public `CompletionCache` operations. |
| unused_types | `persistence/state-io.ts` | `EnabledPluginRecord` | **Retired** unused alias | `PluginInstallRecord & { enabled: true }`, consumed only by two type expressions in `tests/persistence/state-io.test.ts`. No live public signature used the narrower alias. The live `DisabledPluginRecord`, `toDisabledRecord` and `isRecordedButDisabled` contracts are untouched. |

Production consumers of the three public modules are unchanged and still reach them through the same entry points: `loadConfig`/`saveConfig` from `persistence/config-io.ts`, `loadState`/`saveState`/`DEFAULT_STATE`/`clonePluginRecord`/`toDisabledRecord`/`isRecordedButDisabled` from `persistence/state-io.ts`, and `createCompletionCache`/`ManifestSoftFailError` from `shared/completion-cache.ts`.

## Assertion Ledger

`assertion-ledger.json` in the preparation bundle assigns a disposition to **each of the 864 original `assert` call nodes** across the six owned test files. The distribution, **re-verified by AST against the files actually committed here** (not against the preparation copies):

| Disposition | Count |
| --- | --- |
| retained-verbatim (identical text, same test case) | 831 |
| migrated | 5 |
| migrated-compile | 7 |
| migrated-compile-runtime | 13 |
| migrated-root-retired-loader-prefix | 3 |
| retired-impossible | 4 |
| retired-no-reader | 1 |
| **total** | **864** |

The 831 retained-verbatim claims were machine-checked: an AST walk over the committed files re-located every one of them in the same named test case with byte-identical assertion text. **831 of 831 verified, 0 unverified.**

The 33 migrated or retired assertions, by original proof:

| Removed original assertion | Replacement public observation | Evidence |
| --- | --- | --- |
| `config-io.test.ts` "CONFIG_VALIDATOR / accepts a complete version-1 config": `assert.strictEqual(CONFIG_VALIDATOR.Check(config), true)` | The same complete document is written to disk and loaded through `loadConfig`; the whole `{ status, filePath, config }` result is compared to an independently written literal. | `config-io.ts` direct coverage 17/17 B, 4/4 F, 195/195 L. |
| `config-io.test.ts` "uses the no-detail fallback when validation exposes no errors" (mocked `Errors` to `[]` after `Check` rejected `null`) | **Retired as impossible.** No real JSON value produces a split-pass state; the corpus below proves `Check` and empty-`Errors` agree on all 644 cases. The real root diagnostic case (`<root>: must be object` for `null`) is retained byte-identically. | typebox corpus, live re-run. |
| `completion-cache.test.ts` "publishes marketplace names schema version 2" (JSON Schema representation) | **Retired with the declaration.** The existing absent-reader assertion, the invalidation success/idempotency cases and the non-ENOENT unlink-error case all remain. | `completion-cache.ts` direct coverage 48/48 B, 15/15 F, 389/389 L. |
| `completion-cache.test.ts` "publishes plugin index schema version 6 with every status" (full JSON Schema representation incl. `anyOf` ordering) | One runtime case hydrates a version-6 cache carrying **all nine status literals** with complete name/status/version rows and asserts the cache file bytes are byte-unchanged. Eleven further cases prove required `schemaVersion`/`lastRefreshedAt`/`plugins`, required row `name`/`status`, and the types of `lastRefreshedAt`/`manifestRef`/`_loadError`/`plugins`/`name`/`version`, each through a real rebuild into an exact complete serialized cache. `void (true satisfies IsExact<PluginIndexRow["status"], {nine literals}>)` keeps the vocabulary closed, including against widening to `string`. The JSON Schema metadata shape and union ordering are private representation and are explicitly retired. | Controls `added-status` and `broad-status` both fail to compile at that exact line (TS1360). |
| `state-io.test.ts` four version `Check` booleans (`v1` true, `v2` true, `v3` false, optional stamp true) | Three accepted cases assert complete public `loadState` outputs (v1 normalizes to v2, v2 stays v2, the optional stamp rides through). The `v3` rejection maps to the pre-existing exact unsupported-version error case with the future bytes retained; the existing v1 save exact-byte case also remains. | 187/187 task 2 owner tests. |
| `state-io.test.ts` "validates complete hook and resolved-sha plugin records": `Check === true` | Real `loadState` compares the whole result to the independently written literal input record; the existing exact-byte `hookEntries`/`resolvedSha` save-load round trip remains. | same run. |
| `state-io.test.ts` "formats a root validator failure through the public loader" (mocked `Check` to false and `Errors` to a different value's errors) | The manufactured loader prefix is **explicitly retired**. `saveState(extensionRoot, null)` now proves the real root diagnostic: `Error`, name `Error`, exact `saveState refused: ... <root>: must be object`, `cause: undefined`, and the existing `{}` bytes unchanged. Real legacy `null` still loads as empty without rewriting its bytes (that case is retained verbatim). | same run. |
| `state-io.test.ts` "uses the no-detail fallback when an invalid save has no validator errors" | **Retired as impossible**, same reason as the config twin. The no-write guarantee it carried is retained by the real invalid-save case and strengthened on the three malformed-plugin cases. | typebox corpus, live re-run. |
| `state-io.test.ts` three malformed-plugin `Check === false` results | Each now rejects `saveState` with the error class, name, exact path-qualified first message and `cause: undefined`, and asserts the complete pre-existing file bytes are unchanged. The intentionally unchecked input carries a negative compiler directive rather than a second type assertion. | same run. |
| `compat-01` "the persisted install record holds exactly its inherited key set" (runtime `Object.keys` over the private schema) | `void (true satisfies IsExact<keyof PluginInstallRecord, {nine independently written keys}>)`. Exact in both directions: an added key and a removed key both fail. | Control `added-persisted-field` fails to compile at that line (TS1360); the paired owner keeps the full saved-record byte assertions. |
| `compat-01` "no manifest-snapshot or orphan field reached the install record" (seven spellings absent from the private schema) | `void (true satisfies IsExact<Extract<keyof PluginInstallRecord, {same seven spellings}>, never>)`, preserving the seven names verbatim; the nine-key equality independently rejects any new key. | typecheck. |
| `compat-01` "the state schema version union is unchanged" (`STATE_SCHEMA.properties.schemaVersion.anyOf` member consts) | `void (true satisfies IsExact<ExtensionState["schemaVersion"], 1 \| 2>)`, plus the retained `DEFAULT_STATE.schemaVersion === 2` case and the real v1/v2 load and save cases. | Control `added-state-version` fails to compile at that line (TS1360). |
| `hooks-foundation` four `STATE_SCHEMA` version-union introspection assertions | The same exact public version equality, plus the public load/save/rejection cases in the persistence owner. The private `anyOf` representation and member-count plumbing are retired. | Control `added-state-version` also fires at `hooks-foundation.test.ts` (TS1360). |
| `hooks-foundation` thirteen schema traversal / resource assertions (`patternProperties` navigation, `required` membership, `items.type`) | `void (true satisfies IsExact<PluginInstallRecord["resources"], { skills: string[]; prompts: string[]; agents: string[]; mcpServers: string[]; hooks: string[] }>)` preserves all five required string arrays including `hooks`, exactly. Real missing and non-array `hooks` reject `saveState` with their exact messages, and full resource records round-trip. Schema-navigation existence assertions are retired as private representation plumbing. | Control `optional-hook-resource` fails to compile at that line (TS1360). |
| `install-flow.test.ts` two `STATE_VALIDATOR.Check` narrowing sites inside `JSON.parse` mocks | Typed before-snapshots come from the real `loadState`, selected by the exact pre-existing state bytes. **All outcome, error, notification, rollback, retry, byte and interaction assertions in both cases remain identical.** No new production seam, no validator mutation. | 187/187 task 2 owner tests, including both race cases. |

No non-redundant behaviour assertion was discarded. Where a public case subsumes a private one, the public case asserts strictly more: a whole result object or a complete byte string instead of a boolean.

## Verification Commands and Results

| Command | Result |
| --- | --- |
| `node --test tests/persistence/config-io.test.ts tests/shared/completion-cache.test.ts` (task 1 `<verify>`) | tests 56, pass 56, fail 0 |
| `node --test tests/persistence/state-io.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/hooks-foundation.test.ts tests/orchestrators/plugin/install-flow.test.ts` (task 2 `<verify>`) | tests 187, pass 187, fail 0 |
| All six owners together | tests 243, pass 243, fail 0 |
| `npm run typecheck` | clean (run after each task's interface change) |
| `npx eslint` over the nine owned files | exit 0, no findings |
| `npx prettier --check` over the nine owned files | all match |
| `node scripts/test-coverage-direct.mjs` x3 | config-io 17/17 B, 4/4 F, 195/195 L; completion-cache 48/48, 15/15, 389/389; state-io 54/54, 9/9, 494/494 - every pair hit == found, matching the recorded pin |
| `SKIP=trufflehog pre-commit run --files <task files>` x2 (once per task, before each commit) | all hooks Passed, including `npm fallow`, `npm lint`, `npm typecheck`, `npm format check` and `npm direct coverage (changed pairs)` |
| `npm test` (full unit suite) | tests 6244, pass 6242, fail 2 - both the parent-owned census pin gates, nothing else |
| `npm run test:integration` | tests 32, pass 32, fail 0 |
| `npm run test:corresponding` | Corresponding-test gate passed |
| `node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json` | `total_issues` 32, schema_version 9, fallow 3.22.0, 11 discovered entry points, normal issue exit 1 |
| drift controls re-run in `/tmp/05-12-controls-live` (a copy of this checkout) | 8 of 8 reproduce: `benign-types` 0; `added-persisted-field` 2 / TS1360 at `compat-01`; `added-status` 2 / TS1360 at `completion-cache`; `broad-status` 2 / TS1360 at `completion-cache`; `added-state-version` 2 / TS1360 at `compat-01`; `optional-hook-resource` 2 / TS1360 at `hooks-foundation`; `benign-serialization` 0 / `pass 38`; `dropped-persisted-field` 1 / `ERR_ASSERTION` |
| typebox corpus probe re-run against the live schemas | config 126 cases (19 accepted, 107 rejected), state 518 (112, 406), **644 total**; both validators accelerated; `Check(v) === (Errors(v).length === 0)` on every case; input JSON bytes unchanged; every rejection carries a string `instancePath` and `message`; 100k-iteration valid-input loops: config Check 55.9ms / Errors 50.7ms, state Check 137.7ms / Errors 132.8ms (noisy local measurements, not a speed claim) |
| AST re-verification of the assertion ledger against the committed files | 831 of 831 retained-verbatim assertions re-located in the same test case with identical text; 0 unverified |

**Behaviour-preservation proof (run before each production edit):** the rewritten owner tests were applied alone and executed against the pre-change production. Task 1 passed 56/56 and task 2 passed 187/187 at that point, so the new public assertions describe behaviour that already existed. Each production edit then re-ran identically green. Baselines before any change were 47/47 and 194/194 respectively.

**Instrument sanity (phase constraint 5):** every run above reports its discovered test count alongside its failure count, and each was compared to the expected baseline before the result was accepted. No run reported file-level success with zero discovered tests.

## Measured Finding Delta

Measured by two independent instruments in the live checkout, after both task commits:

1. `node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json` -> `total_issues` **32**, against the **39** plan 05-07 left. Category breakdown: 1 unused file, 28 unused exports, 1 unused type, 1 unused class member, 1 duplicate-export group, 0 private type leaks.
2. `tests/architecture/unowned-exports-census.test.ts` re-measures the same question inside the repository and fails with exactly ten `-` lines and **zero** `+` lines. Seven of the ten are this plan's:

```
- 'unused_exports|.../persistence/config-io.ts|CONFIG_VALIDATOR'
- 'unused_exports|.../persistence/state-io.ts|PLUGIN_INSTALL_RECORD_SCHEMA'
- 'unused_exports|.../persistence/state-io.ts|STATE_SCHEMA'
- 'unused_exports|.../persistence/state-io.ts|STATE_VALIDATOR'
- 'unused_exports|.../shared/completion-cache.ts|MARKETPLACE_NAMES_CACHE_SCHEMA'
- 'unused_exports|.../shared/completion-cache.ts|PLUGIN_INDEX_CACHE_SCHEMA'
- 'unused_types|.../persistence/state-io.ts|EnabledPluginRecord'
```

The other three are plan 05-07's (`createWriteHookConfig`, `hookConfigPathFor`, `createUnstagePluginSkills`). No identity remains in any of this plan's three production owner files. The `RingBuffer.read` class member and the ten-member `translate` duplicate group are untouched, as required.

**For the parent wave reconciliation:** the combined Wave 5 target of 42 -> 32 is already reached by 05-07 and 05-12 together; plan 05-24 changes `translate` duplicate-group MEMBERSHIP without changing the group count, so the total should stay 32 after it lands. Compare the group's exact member identities, not just the count.

## Deviations from Plan

### 1. [Rule 3 - Blocking, by plan instruction] Census pin left failing for the parent

- **Found during:** Task 1 verification sweep.
- **Issue:** `tests/architecture/gate-targets.ts` pins both `UNOWNED_EXPORT_CENSUS` and `PRODUCTION_FINDING_CENSUS` to identities this plan removes, so two gates in `tests/architecture/unowned-exports-census.test.ts` fail.
- **Fix:** None applied, deliberately. Both tasks state "do not edit the shared census pin from this plan" and the plan's `<verification>` assigns the single pin edit to the parent wave reconciliation. Editing it here would race plan 05-24 for the same lines.
- **Files modified:** none.
- **Verification:** the census file's own path/name resolution stays intact (the three discriminating "rejects addition / removal / equal-count swap" cases in the same file all pass); only the two equality gates fail, on exactly the expected identities with zero additions.
- **Committed in:** n/a.

### 2. [Rule 1 - Accuracy] Stale method name in the `saveConfig` order docblock

- **Found during:** Task 1, after applying the production change.
- **Issue:** the `saveConfig` docblock listed step 1 as `` `CONFIG_VALIDATOR.Check(config)` ``, a call the function no longer makes. `.claude/rules/typescript-comments.md` requires a comment to describe the code as it stands.
- **Fix:** changed the named call to `` `CONFIG_VALIDATOR.Errors(config)` ``. Nothing else in the docblock changed; the ordering contract it states is unaltered.
- **Files modified:** `extensions/pi-claude-marketplace/persistence/config-io.ts`.
- **Verification:** `npm run typecheck`, `npx eslint`, `npx prettier --check` and the 56-test owner run all clean afterwards.
- **Committed in:** `13a65732`.
- **Note:** this is the only byte in the nine applied files that differs from the prepared payload other than deviation 3.

### 3. [Rule 3 - Blocking] Four stray `<C,>` type-parameter spellings in the prepared payload

- **Found during:** Task 2, at `npx prettier --check`.
- **Issue:** the prepared `install-flow.test.ts` payload rewrote four existing `async <C>(...)` arrow generics to `async <C,>(...)`. This is unrelated to the plan's objective and is an artifact of the preparation formatting through Prettier's API without a filepath, which infers a TSX-safe spelling. The repository's own Prettier run rejects it.
- **Fix:** ran `npx prettier --write` on the file, which restored all four to the original `async <C>` spelling. The resulting diff against `HEAD` is exactly the two intended narrowing-site changes and the one import removal, nothing else.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`.
- **Verification:** `npx prettier --check` exit 0; `npx eslint` exit 0; `npm run typecheck` clean; the 187-test task 2 run identical before and after.
- **Committed in:** `fccb598a`.

### 4. [Documented] `tdd="true"` tasks executed as behaviour-preserving refactors

- **Found during:** Task 1 planning.
- **Issue:** both tasks carry `tdd="true"`, but the work removes visibility from declarations and swaps one validator call for an equivalent one. A RED attempt would be an unexpected green, which the TDD fail-fast rules say to stop on rather than fake.
- **Fix:** substituted the equivalent, stronger discipline used by the preceding plan in this wave: apply the owner test rewrite alone, prove it green against the OLD production, then apply the production change and re-run. Commits are `refactor(...)` rather than `test(...)` -> `feat(...)`.
- **Files modified:** n/a.
- **Verification:** pre-change runs 56/56 (task 1) and 187/187 (task 2); post-change runs identical.
- **Committed in:** `13a65732`, `fccb598a`.

### 5. [Documented] Commit subjects omit the `(phase-plan)` scope

- **Found during:** Task 1 commit.
- **Issue:** the GSD commit protocol asks for `{type}({phase}-{plan}): ...`, but this repository's `CLAUDE.md` forbids phase, plan, milestone and wave identifiers in commit messages.
- **Fix:** applied the `CLAUDE.md` rule, which takes precedence. Subjects are plain Conventional Commits within the 5-72 character limit and body lines stay under 80 characters, matching the surrounding history.
- **Files modified:** n/a.
- **Verification:** `git log --oneline` shows the same shape as the preceding phase commits.
- **Committed in:** `13a65732`, `fccb598a`.

### 6. [Documented] Worktree branch namespace and the amended plan file

- **Found during:** Task 1 commit.
- **Issue (a):** the executor's worktree commit protocol asserts an `agent-*` / `worktree-agent-*` branch namespace. This linked worktree is the user's own, on `features/test-backlog`, and the orchestrator dispatched in sequential mode on it explicitly. **Issue (b):** the preparation bundle contains an amended `05-12-PLAN.md` that expands the two task `<action>` texts to record the approved validation-flow retirement.
- **Fix:** (a) the namespace assertion does not apply to a user-owned worktree named by the dispatch; the real safety checks were kept -- HEAD attached, not a protected or default branch, explicit path staging, never `git add -A`, and the supplied-root pin re-run before each commit. This matches the preceding plan in the same wave. (b) `PLAN.md` was left as committed: it is not in `files_modified`, the preceding plan set the same precedent, and the approved refinement is already recorded in `.continue-here.md`'s decisions and is restated in full in this summary.
- **Files modified:** n/a.
- **Verification:** `git rev-parse --abbrev-ref HEAD` = `features/test-backlog`; `git symbolic-ref HEAD` resolves (not detached); the plan file's SHA-256 still matches its committed baseline.
- **Committed in:** n/a.

---

**Total deviations:** 6 (1 plan-mandated deferral, 2 auto-fixes, 3 documented method/format adaptations).
**Impact on plan:** no scope creep. The nine declared files are the only source files touched; the only added file is the phase `deferred-items.md` this plan's out-of-scope findings required.

## Deferred Items

Recorded in `.planning/phases/05-production-export-ownership/deferred-items.md`, both out of this plan's declared owner set:

1. Six comments in `persistence/config-write-back.ts`, `persistence/migrate-config.ts` and `persistence/migrate.ts` still name `CONFIG_VALIDATOR.Check` / `STATE_VALIDATOR.Check` by method. Each comment's behavioural claim is still true; only the method name drifted. Those files belong to other owners under the phase's disjoint-file rule.
2. `.planning/spikes/003-force-reinstall-on-version-mismatch/prototype.ts` imports the now-private `STATE_VALIDATOR`. It is an archived planning artifact: outside `tsconfig.json`'s `include`, inside ESLint's ignored paths, absent from fallow's entry graph, and run by no npm script, so no gate reads it. D-09 preserves historical evidence, so it was left as recorded.

`.planning/WINDOWS.md` was deliberately not appended to. Its JSON holds only previous-milestone entries (phases 86-117) and no plan in this milestone, including 05-07, has written to it; the phase `deferred-items.md` is the register this phase actually uses, and it is what `audit-open` scans.

## TDD Gate Compliance

`workflow.tdd_mode` is not enabled in `.planning/config.json` and the plan frontmatter is `type: execute`, so the RED/GREEN/REFACTOR gate sequence is not enforced for this plan. No `test(...)` or `feat(...)` gate commits exist by design; see deviation 4 for the substituted evidence.

## Issues Encountered

- The prepared payload carried four out-of-scope `<C,>` reformats that the repository's Prettier rejects (deviation 3). Caught by running `prettier --check` in the real checkout rather than trusting the preparation's formatting log.
- Everything else re-verified clean. All 9 prepared baseline file hashes matched the committed tree at HEAD `882d7a38` before any edit, and after application 7 of the 9 files are byte-identical to the prepared payload; the two that differ are the two deliberate fixes above.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO, FIXME, or unwired component was introduced. The retirements removed declarations outright rather than leaving inert ones behind.

## Threat Flags

None. No network endpoint, auth path, file access pattern, or schema at a trust boundary was added. The register's `mitigate` dispositions are satisfied:

- **T-05-12-01 (Tampering, `persistence/config-io.ts`):** every validation, error, state and byte assertion is preserved or strengthened; the 831-of-864 machine-verified retained-assertion check and the three 100% direct-coverage owners are the evidence. Callers were traced with CodeGraph plus a whole-tree grep before any export was removed.
- **T-05-12-02 (Repudiation, finding census):** the seven exact identities are recorded above with per-identity evidence, measured twice by independent instruments; the pin edit is left to the parent's stable-wave snapshot.
- **T-05-12-03 (Information disclosure, test filesystem and subprocess boundaries):** every new case uses an `mkdtemp` root with `t.after` cleanup and a fixed argument vector; no live credential, external service, network call or fixed shared path is used. The drift controls and the typebox probe ran entirely inside `/tmp` scratch trees with source restoration in `finally`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for the parent Wave 5 reconciliation once plan 05-24 lands. Blocking item for the parent, not for this plan: update `tests/architecture/gate-targets.ts` once, removing this plan's seven identities plus 05-07's three from `UNOWNED_EXPORT_CENSUS` and `PRODUCTION_FINDING_CENSUS`. For `UNOWNED_EXPORT_CENSUS` that means deleting the whole `persistence/config-io.ts` entry, the whole `shared/completion-cache.ts` entry, and the whole `persistence/state-io.ts` entry.
- Live production total is already **32**; 05-24 should leave it at 32 while changing `translate` duplicate-group membership. Re-measure before writing the pin.
- The aggregate production unit baseline is unchanged: the full unit suite is 6242 passing with only the two parent-owned pin gates failing, and all three changed production modules stay at 100% on their direct owners with hit == found.
- Plan 05-15 depends on this plan and its partial preparation references an applied-05-12 manifest; the three production modules are now in their post-05-12 shape, so that dependency is satisfied.
- `.fallowrc.json` `production` mode and the `RingBuffer.read` adjacency exception remain untouched and stay plan 05-28's atomic job.
- `EXPORT-01` is declared by many Phase 5 plans and stays Pending until the last declaring plan finishes; it is listed in `requirements-completed` per the template's verbatim-copy rule, not as a claim that the requirement is closed.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*
