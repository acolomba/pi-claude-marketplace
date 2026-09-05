# Phase 2: Containment and Input Safety - Research

**Researched:** 2026-09-05
**Domain:** Brownfield TypeScript input classification, filesystem containment, and Pi resource-discovery lifecycle recovery
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Production-first sequence

- Implement the malformed-MCP boundary first.
- Repair the shared containment chokepoint next, then verify every affected live consumer against it.
- Implement lifecycle containment and recovery last.
- Keep the three requirement changes independently reviewable even though they share the Phase 2 safety boundary.

### Path containment (`PDEF-02`)

- Centralize the repair in the shared containment owner at `extensions/pi-claude-marketplace/shared/path-safety.ts`; do not create per-consumer containment policies.
- Cover terminal manifest- and state-derived runtime paths and the current lenient plugin-info discovery path. The affected-consumer audit must include the current uses represented by `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `extensions/pi-claude-marketplace/bridges/commands/stage.ts`, and `extensions/pi-claude-marketplace/persistence/locations.ts`, plus every other live caller that relies on the same chokepoint.
- Preserve absolute paths that are contained within their owning root.
- Reject lexical traversal and any normalized path outside the owning root before a read or write.
- Reject an escape through any existing symlink component before a read or write, including an intermediate component rather than only the leaf.
- Preserve the existing typed containment-error family unless a minimal internal naming adjustment is needed to express the repaired behavior.
- The historic MCP-home escape in `AUDIT-007` is repaired and remains evidence-only. It must not generate implementation work.

### Malformed MCP boundary (`PDEF-03`)

- Model `RawMcpDoc.mcpServers` truthfully as `unknown` at the raw JSON boundary in `extensions/pi-claude-marketplace/bridges/mcp/types.ts`.
- Use one shared classifier for both stage and unstage. Do not let those paths drift into separate malformed-value policies.
- A missing `mcpServers` field remains a clean no-op.
- A present object continues through the normal stage or unstage behavior.
- A present malformed value, including `null`, a string, or an array, produces a stable typed fail-closed outcome at the public stage or unstage flow and causes no configuration write.
- Existing string/array no-op expectations may change. Safety and truthful boundary typing override preservation of those expectations.
- Do not broaden this work into general JSON-schema cleanup or rewrite the policy for unrelated malformed top-level documents.

### Lifecycle containment and recovery (`PDEF-04`)

- Contain an aggregate resource-discovery failure at the `resources_discover` boundary in `extensions/pi-claude-marketplace/index.ts`.
- Reconcile and plugin-`PATH` work that completed before discovery failed remains completed. Preserve that exact partial state; do not roll it back or replay it inside the failed invocation.
- The failed invocation returns the stable empty discovery result: empty `skillPaths` and `promptPaths`.
- A later reload must run normally and succeed after the transient discovery failure is removed. The failure must not poison later invocations.
- Attempt skipped-scope warning notifications independently. Failure of one notification must not suppress later scope warnings or escape the lifecycle boundary.
- Do not redesign the overall lifecycle, reconciliation, or resource-discovery architecture.

### Verification contract

- Use a case-owned temporary filesystem for path and lifecycle evidence.
- Do not use the real user home, network access, or process-global patching.
- Add direct source-test pairs for each changed owner and each affected consumer whose behavior changes.
- Assert exact typed errors or results, exact persisted state, and exact file bytes where a write is relevant.
- Prove both first-invocation failure and second-invocation recovery for the transient lifecycle case.
- For malformed MCP input, prove stage and unstage share the classification, emit the intended typed result, and leave configuration bytes unchanged.

### the agent's Discretion

- Choose internal error/type names and the smallest shared helper placement that fit current public contracts.
- Adjust local implementation structure only as needed for the three safety fixes. No Phase 6 module split is approved here.

### Deferred Ideas (OUT OF SCOPE)

- The repaired MCP-home escape (`AUDIT-007`) remains evidence-only.
- The unused-type-member gate remains outside this phase.
- Do not prescribe a GAUTH sentinel in this phase.
- Host-notification visibility/reason unification and notification test infrastructure remain on their existing later routes.
- Broad lifecycle redesign is not approved.
- Assertion strength, coverage enforcement, gate work, module splits, naming cleanup, and every other Phase 3+ route remain deferred to their existing phases.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                                                | Research Support                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDEF-02               | Terminal manifest- and state-derived path flows preserve their allowed root and reject traversal, symlink escape, and lenient-read escape. | Shared normalization algorithm, live caller census, owner/consumer regression matrix, and pre-I/O byte/state assertions. [VERIFIED: `.planning/REQUIREMENTS.md:23-24`; `extensions/pi-claude-marketplace/shared/path-safety.ts:42-137`]                                                                                                                               |
| PDEF-03               | The terminal malformed-MCP input case returns its typed stable failure without an unexpected throw or configuration write.                 | Truthful raw type, one classifier used by stage and unstage, exact malformed-value matrix, and byte-preservation tests. [VERIFIED: `.planning/REQUIREMENTS.md:25-26`; `extensions/pi-claude-marketplace/bridges/mcp/types.ts:10-20`; `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:62-100`; `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:53-99`] |
| PDEF-04               | Terminal resource-discovery and lifecycle-mutation failures preserve their exact partial state and remain recoverable through `/reload`.   | Boundary-local catch after completed reconcile/PATH work, empty result fallback, independent warning attempts, and two-call recovery proof. [VERIFIED: `.planning/REQUIREMENTS.md:27-28`; `extensions/pi-claude-marketplace/index.ts:64-137`]                                                                                                                         |
| </phase_requirements> |

## Summary

Phase 2 needs no new package and no external research. It is a repository-local correction of three terminal defects confirmed by Phase 1: `ABG-021` for malformed scoped MCP values, `MF-003`/`SHC-F001`/`SHC-F051` for path containment, and `RID-F004`/`RID-F008` for lifecycle containment. `AUDIT-007` is explicitly stale and cannot authorize work. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, finding records `ABG-021`, `MF-003`, `SHC-F001`, `SHC-F051`, `RID-F004`, `RID-F008`, and `AUDIT-007`]

The implementation order should be three independently reviewable waves: MCP classification, shared path containment plus affected consumers, then root lifecycle recovery. The first wave must make the raw boundary truthful and route stage and unstage through one classifier. The second must normalize the root and child before both lexical comparison and segment walking, then refuse every existing symlink component. The third must catch only aggregate discovery at the root callback after prior lifecycle work has completed, return empty paths, and leave the next invocation clean. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:15-94`]

The six legacy research documents were examined completely: `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `STACK.md`, `SUMMARY.md`, and `v1.10-attribution-audit.md`. This research carries forward only current principles: preserve the live architecture, use mirrored owner tests, test exported behavior, keep filesystem state case-owned, assert complete values/bytes, and avoid network or test-only production seams. Their v1.19 module counts, phase numbers, and old completion baselines are historical and are not Phase 2 planning inputs. [VERIFIED: `.planning/research/ARCHITECTURE.md`; `.planning/research/FEATURES.md`; `.planning/research/PITFALLS.md`; `.planning/research/STACK.md`; `.planning/research/SUMMARY.md`; `.planning/research/v1.10-attribution-audit.md`]

**Primary recommendation:** Plan exactly three production-first waves, keep each safety policy at its existing owner, and require focused red/green regressions plus exact no-write or partial-state evidence before advancing.

## Architectural Responsibility Map

| Capability                              | Primary Tier                            | Secondary Tier                              | Rationale                                                                                                                                                                                                                               |
| --------------------------------------- | --------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw scoped MCP field classification     | Bridge / input boundary                 | Orchestrator callers                        | Stage and unstage parse the scoped `mcp.json`; callers consume their public typed outcome. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:62-100`; `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:36-105`] |
| Manifest/state-derived path containment | Shared filesystem safety                | Bridges, domain, persistence, orchestrators | `assertPathInside` is the common pre-I/O policy used by all live tiers. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:42-137`; CodeGraph caller census on 2026-09-05]                                              |
| Resource-discovery failure containment  | Pi extension entry / lifecycle boundary | Discovery orchestrator                      | The aggregator correctly reports complete failures; the host callback owns the stable fallback. [VERIFIED: `extensions/pi-claude-marketplace/index.ts:64-137`; `extensions/pi-claude-marketplace/orchestrators/discover.ts:17-52`]      |
| Reconcile and plugin-PATH progress      | Lifecycle orchestrators                 | Pi extension entry                          | These operations precede discovery and their completed effects must survive a later discovery failure. [VERIFIED: `extensions/pi-claude-marketplace/index.ts:78-132`]                                                                   |

## Standard Stack

### Core

| Tool/API                                                                               | Version                      | Purpose                                                                                        | Why Standard                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js built-ins (`node:path`, `node:fs/promises`, `node:test`, `node:assert/strict`) | Repository floor `>=20.19.0` | Normalize paths, inspect symlinks, build hermetic filesystem tests, and assert exact outcomes. | Already used by the production owners and paired tests; no dependency is required. [VERIFIED: `package.json`, quoted constraint `">=20.19.0"`; `extensions/pi-claude-marketplace/shared/path-safety.ts:1-2`; `tests/shared/path-safety.test.ts`] |
| TypeScript                                                                             | `^6.0.3`                     | Enforce `unknown` narrowing and discriminated/typed public outcomes.                           | Current repository compiler. [VERIFIED: `package.json`, quoted value `"^6.0.3"`]                                                                                                                                                                 |
| Repository direct-pair runner                                                          | current in-repo script       | Prove focused source-test coverage after behavior tests pass.                                  | Current script is `npm run test:coverage:direct -- <path>`. [VERIFIED: `package.json`, quoted script `"test:coverage:direct": "node scripts/test-coverage-direct.mjs"`]                                                                          |

### Supporting

| Tool/API                        | Version                          | Purpose                                                     | When to Use                                                                                                                                                 |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier / ESLint / Fallow      | `^3.8.3` / `^10.4.0` / `^3.17.0` | Formatting, TypeScript policy, dependency/dead-code checks. | Run after focused source-test verification and at wave boundaries. [VERIFIED: `package.json`, quoted versions]                                              |
| `mkdtemp` + `t.after()` cleanup | Node built-in                    | One private filesystem root per test case.                  | Every traversal, symlink, byte-preservation, and reload-recovery case. [VERIFIED: `tests/bridges/mcp/unstage.test.ts:10-14`; `tests/index.test.ts:185-236`] |

**Installation:** None. This phase must not add external packages. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:15-94`]

## Package Legitimacy Audit

Not applicable. Phase 2 installs no package.

## Current Owners and Call Paths

### PDEF-03: malformed scoped MCP input

The raw type currently states `readonly mcpServers?: Record<string, unknown>;`, which is untruthful immediately after `JSON.parse`. Replace that exact member with `readonly mcpServers?: unknown;` and narrow once through a shared classifier. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/types.ts:17-20`, verbatim current value `readonly mcpServers?: Record<string, unknown>;`]

Current stage path: `prepareStageMcpServers` -> `readScopedDoc` -> `getMcpServers` -> `partitionExistingServers` -> collision check -> in-memory prepared handle -> later atomic commit. `getMcpServers` rejects only `undefined` and arrays, so `null` reaches `Object.entries` and a string can be enumerated as character keys. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:62-149`; `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `ABG-021.validation.observed`]

Current unstage path: `unstageMcpServers` -> `JSON.parse` -> top-level object check -> direct `doc.mcpServers` check -> `Object.entries` -> optional atomic rewrite. It also treats only `undefined` and arrays as no-op; the policy is duplicated and already differs from stage's top-level parse behavior. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:36-105`]

Recommended classifier contract:

```typescript
// Source: repository pattern derived from the locked Phase 2 contract.
type ScopedMcpServersClassification =
  | { readonly kind: "missing" }
  | { readonly kind: "present"; readonly servers: Record<string, unknown> }
  | { readonly kind: "malformed"; readonly error: MalformedMcpServersError };
```

The exact quoted values required by the contract are `"missing"`, `"present"`, and `"malformed"`; these are recommended internal values, not existing repository values. [ASSUMED] The planner may rename them, but it must preserve a three-way total classification and one stable typed error/outcome consumed identically by stage and unstage. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:41-54`]

Keep malformed top-level JSON/document handling unchanged. Feed the shared field classifier only after each existing consumer has accepted its top-level document according to its current policy. This prevents PDEF-03 from silently changing stage's existing malformed-document warning or unstage's conservative parse error/no-rewrite behavior. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:62-89`; `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:53-69`]

### PDEF-02: shared path containment

Current `assertPathInside` first applies `path.relative(parent, child)` to unnormalized arguments, then splits that same relative result and walks from the original `parent`. The confirmed probes show both a normalization-precondition escape and an intermediate-symlink escape. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:42-137`; `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, records `SHC-F001` and `SHC-F051`]

Recommended algorithm:

1. Compute `normalizedParent = path.resolve(parent)` and `normalizedChild = path.resolve(child)` before any containment decision. [VERIFIED: locked behavior in `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:29-36`]
2. Apply the existing `path.relative` containment predicate to those normalized absolute paths. Preserve equality and absolute child paths that remain inside the normalized root. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:42-51`; `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:29-36`]
3. Walk normalized relative segments from the normalized parent. `lstat` each existing component in order, including intermediates and an existing leaf. Refuse the first symbolic link using the existing `SymlinkRefusedError`; stop cleanly at the first `ENOENT` because descendants cannot yet exist. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:87-137`; `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:33-36`]
4. Report normalized `parent` and `child` on `PathContainmentError` so the typed fields match the path decision. Preserve the existing class relationship: `SymlinkRefusedError extends PathContainmentError`. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:9-40`]
5. Keep the documented time-of-check/time-of-use residual risk unchanged; this phase prevents plugin-authored lexical and existing-symlink escapes, not a concurrent local attacker replacing a component after the check. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:71-75`]

The live caller census found calls in agents stage, commands stage/unstage, hook PID-table/event-router/environment/stage, skills stage/unstage, the resolver, plugin info, configuration persistence, scoped locations, and Git-subdirectory helpers. This broad fan-out is why the owner fix must land before consumer regressions. [VERIFIED: CodeGraph `assertPathInside` exploration and `rg -n "assertPathInside\\(" extensions/pi-claude-marketplace`, 2026-09-05]

The required affected-consumer audit must cover at least these behavior routes:

| Consumer                       | Runtime input                                           | Required proof                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/resolver.ts`           | Marketplace path source, component paths, MCP reference | Contained absolute paths survive; normalized traversal and an existing intermediate symlink fail before reads. [VERIFIED: `extensions/pi-claude-marketplace/domain/resolver.ts:613,990,1107`]                                                                 |
| `orchestrators/plugin/info.ts` | Path source and state-only hook slug                    | Lenient/unavailable info cannot read a declared path outside `marketplaceRoot`; state-only hook degradation stays closed-set after containment refusal. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:236-242,476-529,1308-1378`] |
| `bridges/commands/stage.ts`    | Staging, target, previous-file, and backup paths        | Refusal precedes read/write/rename and preserves target bytes. [VERIFIED: `extensions/pi-claude-marketplace/bridges/commands/stage.ts:195-210,308,382-397`]                                                                                                   |
| `persistence/locations.ts`     | Marketplace/plugin/clone/cache name-derived paths       | Returned contained absolute paths stay accepted; invalid normalized paths never reach I/O. [VERIFIED: `extensions/pi-claude-marketplace/persistence/locations.ts:216-277`]                                                                                    |
| Remaining live callers         | Manifest/state-derived paths reaching the same helper   | Run focused owner suites to detect changed typed fields/messages and add a regression only where observable behavior changes. [VERIFIED: CodeGraph caller census, 2026-09-05]                                                                                 |

Do not create work for `AUDIT-007`. Phase 1 records it as `evidenceStatus: "stale"`, route `"evidence-only closure"`, because current project MCP locations are already case-owned and do not construct a user-home MCP escape. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `AUDIT-007`, verbatim values `"stale"` and `"evidence-only closure"`]

### PDEF-04: lifecycle containment and retry

Current order is deferred hook hydrate, `applyReconcile`, `recomputePluginPath` plus skipped-scope warnings, and finally `aggregateDiscoveredResources`. The aggregator call at lines 129-132 is the only stage outside a containing `try`, so its designed `AggregateResourcesDiscoverError` rejects the host callback. [VERIFIED: `extensions/pi-claude-marketplace/index.ts:64-137`; `extensions/pi-claude-marketplace/orchestrators/discover.ts:17-52`; `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `RID-F008`]

Wrap only aggregate discovery and result projection. On failure, record through the existing debug seam if appropriate and return the exact public value `{ skillPaths: [], promptPaths: [] }`. Do not enclose reconcile/PATH in a transaction, repeat them, or undo them. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:57-68`; `tests/index.test.ts:109`, verbatim existing value `const EMPTY_DISCOVERY: ResourcesDiscoverResult = { skillPaths: [], promptPaths: [] };`]

The skipped-scope loop already has a per-item notification `try/catch`. `RID-F004` shows the current owner suite does not prove that boundary. Add a two-scope case in which every notification refuses: both exact warning attempts must be recorded, neither refusal may escape, and discovery must still return. [VERIFIED: `extensions/pi-claude-marketplace/index.ts:103-127`; `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `RID-F004`]

Recovery needs two calls through the same registered callback. First create a transient project discovery fault after reconcile/PATH can make observable progress, then assert empty discovery plus exact persisted/PATH state. Remove only the fault, call the callback again with reload semantics, and assert the expected non-empty resource result without rebuilding the extension or resetting module state. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:57-75`]

## Architecture Patterns

### System architecture diagram

```text
Pi resources_discover event
        |
        v
deferred hook hydrate (contained)
        |
        v
applyReconcile (contained; completed effects persist)
        |
        v
recomputePluginPath (scope-isolated)
        |
        +--> warning for each skipped scope (each attempt isolated)
        |
        v
aggregateDiscoveredResources
        |
        +--> success --> copy skillPaths/promptPaths --> Pi
        |
        `--> failure --> empty skillPaths/promptPaths --> Pi
                           |
                           `--> later reload runs the full sequence again
```

[VERIFIED: `extensions/pi-claude-marketplace/index.ts:64-137`; locked recovery contract in `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:57-75`]

### Recommended project structure

Keep the existing tree. A tiny MCP field classifier may live beside the MCP bridge contracts; do not split lifecycle or plugin-info modules. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:97-100,134-140`]

```text
extensions/pi-claude-marketplace/
├── bridges/mcp/                  # raw scoped MCP classification, stage, unstage
├── shared/path-safety.ts         # sole path-containment policy owner
├── orchestrators/plugin/info.ts  # lenient read consumer
├── orchestrators/discover.ts     # complete failure aggregation remains unchanged
└── index.ts                      # Pi lifecycle containment and fallback

tests/
├── bridges/mcp/                  # classifier + stage/unstage no-write regressions
├── shared/path-safety.test.ts    # normalization and intermediate-symlink owner proof
├── orchestrators/plugin/info.test.ts
├── bridges/commands/stage.test.ts
├── persistence/locations.test.ts
└── index.test.ts                 # partial-state, notification isolation, retry
```

### Pattern 1: classify once, consume twice

The shared classifier must distinguish absence from malformed presence with `Object.hasOwn` or equivalent presence semantics. A value of `undefined` needs the policy chosen by the locked contract: the field is missing only when it is absent; if present with a non-object value, it is malformed. [ASSUMED] This detail should be made explicit in the plan because ordinary optional-property access cannot distinguish the two cases.

### Pattern 2: check before effect

All path rejections and malformed-MCP rejections happen before enumeration that assumes an object and before any read/write/rename that uses the refused path or document. Tests should snapshot complete bytes before the action and compare them afterward. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:29-54,70-75`]

### Pattern 3: contain at the host boundary

Keep `aggregateDiscoveredResources` fail-loud and complete. Convert that aggregate error to a stable empty result only where `index.ts` implements Pi's `resources_discover` contract. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/discover.ts:17-52`; `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:57-68`]

### Anti-patterns to avoid

- Do not duplicate malformed-value predicates in stage and unstage. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:41-54`]
- Do not use `realpath(child)` as the only containment mechanism. The leaf may not exist before a write, while an existing intermediate component still needs `lstat` refusal. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:103-137`]
- Do not preserve an absolute child by joining it under the root; preserve it only when normalized containment succeeds. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:29-36`]
- Do not catch path containment at every consumer and translate it inconsistently. Preserve `PathContainmentError` / `SymlinkRefusedError` policy. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:9-40`; `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:35-36`]
- Do not swallow discovery inside `orchestrators/discover.ts`; callers other than the host boundary need its complete failure set. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/discover.ts:17-52`]
- Do not patch `process.env`, `homedir`, builtin modules, or network functions globally for Phase 2 evidence. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:70-75`]

## Don't Hand-Roll

| Problem                    | Don't Build                    | Use Instead                                                        | Why                                                                                                                                                                                                  |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lexical path normalization | Separator and `..` parser      | `path.resolve` + `path.relative` + `path.isAbsolute`               | Cross-platform normalization already exists in Node. [VERIFIED: current imports in `extensions/pi-claude-marketplace/shared/path-safety.ts:1-2`]                                                     |
| Existing symlink detection | Target-string heuristics       | Per-component `lstat`, then `readlink` only for error detail       | `lstat` identifies the directory entry without following it. [VERIFIED: `extensions/pi-claude-marketplace/shared/path-safety.ts:103-145`]                                                            |
| MCP document writes        | Direct `writeFile` replacement | Existing prepared handle / `atomicWriteJson` flows                 | Existing stage/unstage paths own atomicity and no-op behavior. [VERIFIED: `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`; `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:93-104`] |
| Lifecycle rollback         | New cross-stage transaction    | Existing completed reconcile/PATH semantics plus boundary fallback | The locked contract preserves partial progress. [VERIFIED: `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md:57-68`]                                                                   |

## Common Pitfalls

### Pitfall 1: normalization occurs after the decision

**What goes wrong:** A syntactically contained path normalizes outside the root, or the walk checks components that do not match the effective path. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `SHC-F051`]
**Avoidance:** Resolve both operands first and use only normalized values for comparison, walking, and typed error fields. [VERIFIED: locked PDEF-02 contract]

### Pitfall 2: stopping the walk at the leaf

**What goes wrong:** An intermediate directory symlink redirects later I/O outside the root. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `SHC-F001`]
**Avoidance:** `lstat` every existing component from root to leaf and refuse the first symlink. [VERIFIED: locked PDEF-02 contract]

### Pitfall 3: accidental JavaScript coercion becomes policy

**What goes wrong:** `Object.entries(null)` throws while strings become numeric character entries. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `ABG-021`]
**Avoidance:** Narrow raw `unknown` before enumeration and share the same result across both consumers.

### Pitfall 4: broad catch changes unrelated malformed-document behavior

**What goes wrong:** PDEF-03 unintentionally converts malformed JSON or a top-level primitive into the new field error. [VERIFIED: current distinct policies in `stage.ts:62-89` and `unstage.ts:53-69`]
**Avoidance:** Insert classification after each existing top-level policy, not around the entire parse pipeline.

### Pitfall 5: lifecycle containment erases completed work

**What goes wrong:** A catch around the full callback replays or rolls back reconcile/PATH, or a stale failure flag poisons reload. [VERIFIED: locked PDEF-04 contract]
**Avoidance:** Catch only aggregation, keep fallback local, and use no persistent failure state.

### Pitfall 6: notification evidence proves only the first scope

**What goes wrong:** One host notification throw stops the skipped-scope loop, hiding later warnings. `RID-F004` survived mutation because this was not proven. [VERIFIED: `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `RID-F004`]
**Avoidance:** Generate two skipped scopes and record every attempted notification while each attempt throws.

### Pitfall 7: tests pass by touching machine state

**What goes wrong:** A path or lifecycle test reads the real Pi directory or changes process-wide state. [VERIFIED: locked verification contract]
**Avoidance:** Create one temporary home/cwd tree per case, pass the scope through existing helpers, register cleanup before acting, and avoid concurrent process-global mutation.

## Validation Architecture

### Test framework

| Property      | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Framework     | Node test runner via `node:test` [VERIFIED: current test imports]                      |
| Assertions    | `node:assert/strict` [VERIFIED: current paired tests]                                  |
| Configuration | No separate runner config; commands live in `package.json`. [VERIFIED: `package.json`] |
| Quick run     | `node --test <focused-test-path>` [VERIFIED: `package.json`]                           |
| Direct pair   | `npm run test:coverage:direct -- <source-or-test-path>` [VERIFIED: `package.json`]     |
| Full suite    | `npm run check` [VERIFIED: `package.json`]                                             |

### Requirements to test map

| Requirement | Owner regression                                                                                   | Consumer/integration regression                                                                                                                                                                     | Exact evidence                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDEF-03     | `tests/bridges/mcp/types.test.ts` for truthful type/classifier; `stage.test.ts`; `unstage.test.ts` | Focused install/reinstall/update or marketplace-shared suites only where the typed outcome changes caller behavior                                                                                  | Table-driven `null`, string, and array cases; exact typed failure; unchanged bytes and metadata; missing remains frozen no-op; object path still works. [VERIFIED: current test owners and locked contract]                                                                   |
| PDEF-02     | `tests/shared/path-safety.test.ts`                                                                 | `tests/orchestrators/plugin/info.test.ts`, `tests/bridges/commands/stage.test.ts`, `tests/persistence/locations.test.ts`, resolver tests, then focused suites for other observably affected callers | Contained absolute child accepted; `a/../../outside` refused; intermediate symlink to outside refused; nonexistent contained leaf accepted; exact error class/fields; no outside read/write; target bytes unchanged. [VERIFIED: current owner/caller map and locked contract] |
| PDEF-04     | `tests/index.test.ts`                                                                              | Existing `tests/orchestrators/discover.test.ts` remains the fail-loud aggregator proof                                                                                                              | First call: discovery fault yields exact empty result after exact reconcile/PATH progress. Second call: fault removed, same callback returns resources. Two failing notifications both attempted. [VERIFIED: `index.ts:64-137`; locked contract]                              |

### Suggested execution waves

1. **Wave 1, MCP boundary:** Change truthful raw typing and shared field classification; update stage/unstage; run their owner tests, typecheck, and relevant lifecycle callers. [VERIFIED: locked sequence]
2. **Wave 2, containment:** Repair `path-safety.ts`; land owner red/green proof; audit all live callers; add consumer regressions only for changed observable behavior; run all affected bridge/resolver/persistence/info suites. [VERIFIED: locked sequence]
3. **Wave 3, lifecycle:** Extend `index.test.ts` with aggregate failure, exact partial state, independent notifications, and recovery; then add the narrow boundary catch in `index.ts`. [VERIFIED: locked sequence]
4. **Phase gate:** Run focused direct coverage for each changed source-test pair, `npm run typecheck`, relevant architecture tests, then `npm run check`. [VERIFIED: repository testing skill and `package.json`]

### Wave 0 gaps

- Add malformed present-value cases to both MCP stage and unstage owner suites; current tests preserve primitive/array no-op behavior instead of the locked fail-closed outcome. [VERIFIED: `tests/bridges/mcp/unstage.test.ts:277-367`; CodeGraph review of `tests/bridges/mcp/stage.test.ts`]
- Add the normalized traversal and intermediate-symlink owner cases to `tests/shared/path-safety.test.ts`. [VERIFIED: Phase 1 records `SHC-F001` and `SHC-F051`]
- Add an aggregate-discovery callback failure and two-invocation recovery case to `tests/index.test.ts`; its own constants currently document the fourth cwd read as uncontained. [VERIFIED: `tests/index.test.ts:109-128`]
- Add a two-skipped-scope, refusing-notification case to `tests/index.test.ts`. [VERIFIED: Phase 1 record `RID-F004`]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement: false`. [VERIFIED: `.planning/config.json`]

### Applicable ASVS categories

| ASVS category         | Applies                           | Standard control                                                                                                               |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | No                                | Phase 2 does not change authentication. [VERIFIED: phase boundary]                                                             |
| V3 Session Management | No                                | Phase 2 does not change sessions. [VERIFIED: phase boundary]                                                                   |
| V4 Access Control     | Yes, filesystem boundary analogue | Normalize and enforce the owning-root boundary before I/O. [VERIFIED: PDEF-02]                                                 |
| V5 Input Validation   | Yes                               | Treat parsed JSON as `unknown`, classify field presence/shape once, and fail closed on malformed presence. [VERIFIED: PDEF-03] |
| V6 Cryptography       | No                                | No cryptographic operation changes. [VERIFIED: phase boundary]                                                                 |

### Known threat patterns

| Pattern                                          | STRIDE                             | Mitigation                                                                                          |
| ------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `..` normalization escape                        | Tampering                          | Normalize both root and child, then enforce relative containment before I/O. [VERIFIED: `SHC-F051`] |
| Intermediate symlink escape                      | Tampering / Elevation of privilege | `lstat` every existing component and refuse symlinks. [VERIFIED: `SHC-F001`]                        |
| Malformed scoped JSON field coerced into entries | Tampering / Denial of service      | `unknown` boundary plus shared total classifier and typed no-write failure. [VERIFIED: `ABG-021`]   |
| Aggregate discovery rejection aborts host load   | Denial of service                  | Catch at host callback, return empty paths, allow clean retry. [VERIFIED: `RID-F008`]               |
| One failed warning suppresses another            | Repudiation / Denial of service    | Per-warning isolation and complete attempted-notification assertion. [VERIFIED: `RID-F004`]         |

## Scope Exclusions

- No `AUDIT-007` implementation. [VERIFIED: stale evidence record]
- No general MCP JSON schema cleanup, per-server semantic validation, or unrelated top-level document policy change. [VERIFIED: locked PDEF-03 boundary]
- No lifecycle, reconcile, PATH, notification-system, or discovery-aggregator redesign. [VERIFIED: locked PDEF-04 boundary]
- No Phase 6 module splits, broad assertion cleanup, direct-coverage policy changes, naming cleanup, gate work, or Phase 3+ defect work. [VERIFIED: context deferred section]
- No network, real home, global module patching, or test-only reset/export seam. [VERIFIED: locked verification contract]

## Assumptions Log

| #   | Claim                                                                                      | Section                | Risk if Wrong                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Use internal classification values `"missing"`, `"present"`, and `"malformed"`.            | PDEF-03 recommendation | Low; names are discretionary, but the three-way semantics are locked.                                                               |
| A2  | A present own property whose value is `undefined` should be malformed rather than missing. | Classify once pattern  | Medium; the context names missing fields, not explicit `undefined`, so the planner should lock this boundary before implementation. |

## Open Questions

1. **What exact public typed failure shape should stage and unstage expose?**
   - What is known: malformed presence must have one shared classification, be stable and typed, and cause no write. [VERIFIED: locked decision]
   - What is unclear: whether the existing public convention favors a typed rejection class or a discriminated result arm for both exports. [ASSUMED]
   - Recommendation: inspect the immediate install/reinstall/update/marketplace-shared callers while planning Wave 1, then select the smallest shape that they can consume consistently without broad lifecycle churn.

2. **Should explicit `mcpServers: undefined` count as missing?**
   - What is known: JSON cannot contain `undefined`, so disk-parsed documents cannot produce it. [VERIFIED: ECMAScript JSON data model as exercised by `JSON.parse`; no external dependency]
   - What is unclear: tests or in-memory callers can construct that shape. [VERIFIED: TypeScript structural inputs]
   - Recommendation: classify by own-property presence and treat it as malformed, then pin the decision in the classifier test. [ASSUMED]

## Sources

### Primary, HIGH confidence

- `.planning/phases/02-containment-and-input-safety/02-CONTEXT.md` - locked boundary, sequence, behavior, verification, and exclusions.
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` - active Phase 2 requirements and success criteria.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` - terminal records `MF-003`, `SHC-F001`, `SHC-F051`, `ABG-021`, `RID-F004`, `RID-F008`, plus stale `AUDIT-007`.
- `.planning/phases/01-live-evidence-revalidation/01-69-SUMMARY.md` - sealed Phase 1 census and planning authorization.
- `extensions/pi-claude-marketplace/shared/path-safety.ts` and all live callers identified by CodeGraph - containment owner and blast radius.
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`, `stage.ts`, and `unstage.ts` - raw type and current duplicated field handling.
- `extensions/pi-claude-marketplace/index.ts` and `orchestrators/discover.ts` - lifecycle order, failure boundary, and aggregate behavior.
- Mirrored tests under `tests/shared`, `tests/bridges/mcp`, `tests/orchestrators/plugin`, `tests/persistence`, and `tests/index.test.ts` - current evidence gaps and hermetic patterns.
- `package.json` and `.planning/config.json` - current scripts, versions, runtime floor, and enabled Nyquist validation.

### Historical project research examined, principles only

- `.planning/research/ARCHITECTURE.md`
- `.planning/research/FEATURES.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/STACK.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/v1.10-attribution-audit.md`

No external sources were needed. [VERIFIED: repository-local scope in `.planning/REQUIREMENTS.md:139-146`]

## Project Constraints (from AGENTS.md)

- When `.codegraph/` exists, use CodeGraph before grep/find or direct source reads for code discovery. This research did so for all three requirement areas. [VERIFIED: `AGENTS.md`; `.codegraph/` present]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all tools and commands come from the current repository.
- Architecture: HIGH - owners and call paths were read from current source through CodeGraph and targeted line reads.
- Pitfalls: HIGH - each primary failure mode has a terminal Phase 1 record or current source proof.
- Test strategy: HIGH - it extends existing mirrored owner suites and follows current project testing rules.

**Research date:** 2026-09-05
**Valid until:** 2026-10-05, or until any listed owner/call path changes.
