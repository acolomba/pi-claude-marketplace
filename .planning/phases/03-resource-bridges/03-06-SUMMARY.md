---
phase: 03-resource-bridges
plan: 06
subsystem: mcp-bridge
tags: [mcp, bridge, atomic-json, collision-detection, marker, wave-2]
dependency_graph:
  requires:
    - extensions/claude-marketplace/persistence/locations.ts (ScopedLocations.mcpJsonPath)
    - extensions/claude-marketplace/shared/atomic-json.ts (atomicWriteJson)
    - extensions/claude-marketplace/shared/errors-bridges.ts (McpServerCollisionError)
    - extensions/claude-marketplace/shared/errors.ts (errorMessage)
    - extensions/claude-marketplace/domain/name.ts (assertSafeName)
  provides:
    - bridges/mcp/types.ts (discriminated PreparedMcpStaging + StagedMcpRecord)
    - bridges/mcp/marker.ts (CLAUDE_MARKETPLACE_MARKER_KEY user contract)
    - bridges/mcp/parse.ts (resolvePluginMcpServers + parseMcpServers)
    - bridges/mcp/collision-slots.ts (MCP_COLLISION_SLOTS named export + loadEffectiveServerNames)
    - bridges/mcp/stage.ts (prepareStageMcpServers / commitPreparedMcp / abortPreparedMcp)
    - bridges/mcp/unstage.ts (unstageMcpServers)
    - bridges/mcp/index.ts (barrel)
  affects:
    - Plan 03-07 (install pipeline) -- imports prepareStageMcpServers + commitPreparedMcp + result.recorded for state.json
    - Phase 5 (state mutations) -- reads StageMcpCommitResult.recorded to populate per-server state entries (W-05)
tech-stack:
  added: []
  patterns:
    - "In-memory prepare → single atomicWriteJson commit → synchronous abort no-op (MC-6 simpler atomicity story than skills/commands)"
    - "Discriminated noop | staged union with embedded StageMcpCommitResult on both branches (uniform Phase 5 hand-off)"
    - "MC-4 cross-slot collision check via MCP_COLLISION_SLOTS named constant (testable + snapshot-able)"
    - "Typed McpServerCollisionError replaces V1 plain Error (instanceof discrimination at install path)"
    - "Per-server _claudeMarketplace marker is byte-for-byte V1-compatible user contract"
key-files:
  created:
    - extensions/claude-marketplace/bridges/mcp/types.ts
    - extensions/claude-marketplace/bridges/mcp/marker.ts
    - extensions/claude-marketplace/bridges/mcp/parse.ts
    - extensions/claude-marketplace/bridges/mcp/collision-slots.ts
    - extensions/claude-marketplace/bridges/mcp/stage.ts
    - extensions/claude-marketplace/bridges/mcp/unstage.ts
    - extensions/claude-marketplace/bridges/mcp/index.ts
    - tests/bridges/mcp/marker.test.ts
    - tests/bridges/mcp/parse.test.ts
    - tests/bridges/mcp/collision-slots.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
  modified: []
decisions:
  - "MCP_COLLISION_SLOTS hoisted to a named export (delta vs V1) so the four-slot user-contract order can be locked by snapshot tests and consumed from stage.ts without re-implementing the slot list."
  - "McpServerCollisionError replaces V1's plain Error throws (delta vs V1) so the install pipeline can instanceof-discriminate the refusal category from generic I/O failures."
  - "StageMcpCommitResult carries `recorded: StagedMcpRecord[]` on BOTH branches of the discriminated union (W-05 fix). Phase 5 reads `recorded` directly without re-deriving per-server `targetPath`. Noop branch has `recorded: []`."
  - "abortPreparedMcp is a synchronous no-op because prepare wrote nothing to disk -- the merged doc lives only inside the discriminated union. Unique among the three component-type bridges (skills + commands + agents all have async cleanup paths)."
  - "unstage rewrites the file ONLY when at least one entry was removed. MC-7 + MC-6 both honored: ENOENT/missing-mcpServers/non-object-mcpServers/no-matches all noop without touching the mtime."
  - "Malformed JSON during unstage propagates with a descriptive error message (cause-chained); the prepare path tolerates malformed scoped JSON by treating it as empty (an existing broken doc was already broken before we showed up). Asymmetric on purpose: unstage is destructive-shaped, surface breakage; stage is constructive-shaped, recover the well-formed shape."
metrics:
  duration_seconds: 5400
  duration_human: "1h 30m (across two attempts -- T-01 in prior session, T-02 in this session)"
  completed: "2026-05-10T14:15:12Z"
  tasks_completed: 2
  files_created: 12
  files_modified: 0
  test_count_delta: 51
  total_tests_passing: 344
---

# Phase 3 Plan 06: MCP Bridge Summary

Wave 2 / parallel-bridge pass for the MCP component type. Lands the seven `bridges/mcp/*.ts` modules (six source + one barrel) and five unit-test files (51 tests total) implementing the prepare/commit/abort/unstage triplet for `mcp.json` server entries with `_claudeMarketplace` markers.

The MCP bridge has the simplest atomicity story among the four Phase 3 bridges: a single `atomicWriteJson` commits the staged doc, prepare wrote nothing to disk, abort is a synchronous no-op. No staging dir, no per-file rename loop, no EXDEV risk.

## Task Sequencing Note

This plan was executed in two sessions:

- **T-01** (`05b6d49`, prior session) -- types + marker + parse + collision-slots + 30 unit tests. Recapped here for completeness.
- **T-02** (`f73512b`, this session) -- stage + unstage + barrel + 21 unit tests.

A prior T-02 attempt was interrupted mid-flight by an API usage cap; that session left no committed changes (the WIP folder referenced in the spawn objective did not exist on disk by the time this session ran). T-02 was re-executed from scratch using the plan + V1 reference + Plan 03-01 SUMMARY as the sole sources of truth.

## What Was Built

### T-01 (recap, prior session) -- Building blocks

**`bridges/mcp/types.ts`** -- Type-only module with:

- `McpServerEntry`, `RawMcpDoc` -- opaque shapes the bridge does not validate per-field (pi-mcp-adapter owns runtime semantics).
- `ResolvedMcpServers` + `McpServersSource` -- MC-1 resolution outcome.
- `StageMcpInput`, `StagedMcpRecord`, `StageMcpCommitResult` -- input bundle and W-05 commit-result shape.
- `PreparedMcpStaging = PreparedMcpNoop | PreparedMcpStaged` -- discriminated union; `_nextDoc` lives only on the staged branch and is intentionally underscored to mark it bridge-internal.
- `UnstageMcpInput`, `UnstageMcpResult` -- symmetric to stage.

**`bridges/mcp/marker.ts`** -- V1 byte-for-byte carry-forward (41 lines).

- `CLAUDE_MARKETPLACE_MARKER_KEY = "_claudeMarketplace"` -- user contract per MC-5; existing V1-installed `mcp.json` documents must remain readable by the successor.
- `readMarker(value)` -- robust against arrays, primitives, partial shapes; never throws.
- `buildMarker(plugin, marketplace)` -- returns `{ plugin, marketplace }`.
- `isOwnedBy(value, plugin, marketplace)` -- convenience predicate.

**`bridges/mcp/parse.ts`** -- V1 carry-forward (100 lines) with explicit MC-3 shape validation per entry.

- `parseMcpServers(value, label)` -- top-level object check, per-entry object check, every name passes `assertSafeName`.
- `resolvePluginMcpServers({ entry, manifest, pluginRoot })` -- MC-1 precedence chain `entry > manifest > standalone .mcp.json`. First-match-wins; malformed at the matched source THROWS (no fallthrough). MC-2 standalone parse accepts both wrapped (`{mcpServers:{...}}`) and unwrapped (`{server-name:{...}}`) forms. Empty wrapped doc → `source: "none"`.

**`bridges/mcp/collision-slots.ts`** -- V1 `effective-config.ts` carry-forward + named-constant delta.

- `MCP_COLLISION_SLOTS(cwd)` -- named export of the four pi-mcp-adapter slot paths in user-contract order: `~/.config/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `<cwd>/.mcp.json`, `<cwd>/.pi/mcp.json`. Returned array is `Object.freeze`d so test snapshots and runtime cannot mutate the contract.
- `loadEffectiveServerNames(cwd)` -- `Map<serverName, owningPath>` with first-declarer-wins. Missing files (`ENOENT`/`ENOTDIR`) and malformed JSON contribute nothing (silent skip -- pi-mcp-adapter owns slot validation). Both wrapped and unwrapped slot shapes recognized via `extractServers`.

### T-02 (this session) -- stage + unstage + barrel

**`bridges/mcp/stage.ts`** -- V1 `mcp/stage.ts` carry-forward (lines 81-173) with two deltas.

- `prepareStageMcpServers(input)` -- Reads scoped `mcp.json`, partitions ours-vs-theirs by marker, runs MC-4 cross-slot collision check (self-replace within own scope is allowed via `ours.has(name)` exemption), short-circuits AS-8 noop branch when no new servers AND no previous-ours, stamps every new entry with the marker (MC-5), builds merged doc IN MEMORY ONLY. Returns the discriminated `PreparedMcpStaging` union.
- `commitPreparedMcp(prepared)` -- Single `atomicWriteJson` for the staged branch; zero-op for noop. Returns `StageMcpCommitResult` with `recorded: StagedMcpRecord[]` (W-05) for Phase 5 hand-off.
- `abortPreparedMcp(_prepared)` -- Synchronous no-op (prepare wrote nothing).

Two deltas vs V1:
1. `MCP_COLLISION_SLOTS` is consumed via the named export from `collision-slots.ts` rather than the V1 inline list.
2. Cross-slot/scope collision throws typed `McpServerCollisionError` carrying `{ serverName, owningPath }` rather than V1's plain `Error("Refusing to stage MCP servers ...")`.

The scoped `readScopedDoc` helper tolerates ENOENT/ENOTDIR (returns `{}`), malformed JSON (returns `{}`), and top-level non-object (returns `{}`) -- the prepare path can recover the well-formed shape via the subsequent commit. This is asymmetric with `unstage`, on purpose.

**`bridges/mcp/unstage.ts`** -- V1 carry-forward (lines 185-206) with explicit MC-7 tolerances.

- `unstageMcpServers(input)` -- Reads scoped `mcp.json`, splits by marker, atomic-writes the kept entries.
- ENOENT/ENOTDIR scoped file → noop (must NOT materialize an empty doc).
- Missing or non-object `mcpServers` field on otherwise-valid scoped doc → noop (MC-7).
- Empty match set (no entries owned by the tuple) → noop (no rewrite -- `mtime` invariant).
- Top-level non-object → noop.
- Malformed JSON → propagate with descriptive `Error` (cause-chained), unlike stage which tolerates malformed input. Rationale: unstage is destructive-shaped, surface breakage so the user can manually intervene; stage is constructive-shaped, recover the well-formed shape from the merged doc.

**`bridges/mcp/index.ts`** -- Barrel re-export of the public surface.

- `prepareStageMcpServers`, `commitPreparedMcp`, `abortPreparedMcp` from `stage.ts`.
- `unstageMcpServers` from `unstage.ts`.
- `resolvePluginMcpServers`, `parseMcpServers` from `parse.ts`.
- `MCP_COLLISION_SLOTS`, `loadEffectiveServerNames` from `collision-slots.ts`.
- Marker primitives: `CLAUDE_MARKETPLACE_MARKER_KEY`, `buildMarker`, `readMarker`, `isOwnedBy`, type `ClaudeMarketplaceMarker`.
- All public types from `types.ts` (the bridge-internal `_nextDoc` field is intentionally NOT exposed via the type re-exports -- consumers must hand the prepared union back to commit/abort or read the user-facing `result` slot).

## Test Coverage

| File                                       | Tests | Focus                                                                                       |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------- |
| `tests/bridges/mcp/marker.test.ts`         | 7     | MC-5 marker key snapshot, readMarker robustness, isOwnedBy tuple equality                   |
| `tests/bridges/mcp/parse.test.ts`          | 13    | MC-1 precedence chain (entry/manifest/standalone), MC-2 wrapped+unwrapped, MC-3 shape       |
| `tests/bridges/mcp/collision-slots.test.ts`| 7     | MC-4 four-slot user-contract order, frozen array, first-declarer-wins, malformed/ENOENT skip |
| `tests/bridges/mcp/stage.test.ts`          | 14    | MC-4/5/6, AS-8 noop branch (no file materialization), self-replace allowed, cross-slot vs same-scope collision, recorded sourcePath, abort no-op |
| `tests/bridges/mcp/unstage.test.ts`        | 7     | MC-6 happy path, MC-7 missing-mcpServers / ENOENT / non-object tolerances, no-rewrite mtime invariant, malformed JSON propagates |

Total project test count: **344 passing** (51-test delta from this plan; 0 failures).

`npm run check` (typecheck + ESLint + Prettier + node --test) all green.

## Design Decisions Carried Through

### D-1: MCP_COLLISION_SLOTS as a named export (delta vs V1)

V1's `effective-config.ts` builds the four-slot list inline inside `loadEffectiveServerNames`. We hoisted it to a named export so:

1. Snapshot tests can lock the user-contract order without reflective access.
2. Future callers (debug commands, list views) can enumerate the slot paths without re-implementing the list.
3. The frozen array (`Object.freeze`) prevents accidental mutation of the user contract by either tests or runtime code.

`tests/bridges/mcp/collision-slots.test.ts` exercises both the order-by-position assertion and the `Object.isFrozen` check.

### D-2: McpServerCollisionError replaces V1 plain Error (delta vs V1)

V1 throws `new Error('Refusing to stage MCP servers for ${marketplaceName}/${pluginName}: name "${name}" already exists in ${owningPath}.')`. The successor carries the same user-visible message via the `super(...)` call but adds:

- `serverName` and `owningPath` accessor fields so the install pipeline can render a custom UI without regex-parsing the message.
- An `instanceof` discriminator so the install pipeline can route collision refusals down a different code path than generic I/O failures (e.g. surface a "remove the colliding entry from `<path>` and try again" hint vs a generic "filesystem error" hint).

The error subclass lives in `shared/errors-bridges.ts` from Plan 03-01.

### D-3: W-05 -- recorded carries StagedMcpRecord[] on both branches

Earlier drafts had `recorded` only on the staged branch, with the noop branch returning `{ stagedNames: [] }`. The W-05 fix in CONTEXT.md (lines 188-200) requires Phase 5 to read `recorded` to populate state.json -- so both branches must expose the same shape.

The noop branch returns `recorded: Object.freeze([])`, the staged branch returns the per-server records. This means Phase 5 has a uniform iteration:

```typescript
for (const record of result.recorded) {
  state.mcpServers[record.generatedName] = { sourcePath: record.sourcePath, ... };
}
```

regardless of whether the bridge took the noop path or actually wrote the file.

### D-4: stage tolerates malformed scoped JSON; unstage propagates

Asymmetric on purpose:

- **stage** is constructive-shaped -- the user just installed a plugin and the prepare path can produce a well-formed `mcp.json` even if the prior file was broken. We treat malformed input as `{}` and write the well-formed merged doc on commit. The user's foreign entries (if any) are lost in this edge case, which is acceptable because a malformed `mcp.json` was already broken before we showed up.
- **unstage** is destructive-shaped -- uninstalling a plugin shouldn't blow away an existing (even non-conforming) user file. We surface malformed JSON as a descriptive error so the user can manually fix it before retrying.

### D-5: abort is synchronous

Unique among the four Phase 3 bridges. Skills, commands, and agents all have async cleanup paths because their prepare phase writes to a staging directory; MCP's prepare phase writes nothing to disk (the merged doc is the `_nextDoc` field of the in-memory union). `abortPreparedMcp` exists for symmetry with the other bridges' triplet shape, not because it has work to do.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- bug] `getMcpServers` and unstage type guard had unnecessary `typeof !== "object"` checks**

- **Found during:** T-02 lint phase.
- **Issue:** ESLint reported `@typescript-eslint/no-unnecessary-condition` because `RawMcpDoc.mcpServers` is typed as `Record<string, unknown> | undefined` (no `null` overlap, no primitive overlap). The defensive `typeof m !== "object" || m === null || Array.isArray(m)` triplet was over-broad.
- **Fix:** Simplified to `m === undefined || Array.isArray(m)` -- TypeScript's type narrowing covers the rest. Same shape applied in `stage.ts::getMcpServers` and `unstage.ts` mid-function check.
- **Files modified:** `extensions/claude-marketplace/bridges/mcp/stage.ts`, `extensions/claude-marketplace/bridges/mcp/unstage.ts`.
- **Commit:** `f73512b`.

**2. [Rule 3 -- blocking] Test file lint failures (import order, void-in-expression, type assertion style)**

- **Found during:** T-02 lint phase.
- **Issue:**
  - `import-x/order` fired because `marker.ts` should sort before `stage.ts` / `unstage.ts` alphabetically.
  - `@typescript-eslint/no-confusing-void-expression` fired on `const ret = abortPreparedMcp(prepared); assert.equal(ret, undefined);` -- `void`-returning calls cannot be assigned to a `const`.
  - `@typescript-eslint/non-nullable-type-assertion-style` fired on `as Record<string, unknown>` where `!` would be more idiomatic.
- **Fix:** Re-ordered imports; replaced the `const ret = ...` pattern with a direct call (the test already asserts the no-side-effect contract via the absence-of-throw + missing-file check); replaced the type assertion with the `!` operator.
- **Files modified:** `tests/bridges/mcp/stage.test.ts`, `tests/bridges/mcp/unstage.test.ts`.
- **Commit:** `f73512b`.

**3. [Rule 3 -- blocking] Prettier flagged two files post-edit**

- **Found during:** T-02 format-check phase.
- **Issue:** Prettier preferred a more compact one-line shape for two of the test setup statements.
- **Fix:** `npx prettier --write` on the two affected files.
- **Files modified:** `tests/bridges/mcp/unstage.test.ts`, `extensions/claude-marketplace/bridges/mcp/index.ts`.
- **Commit:** `f73512b`.

### Auth Gates

None encountered.

## Open Questions for Plan 03-07 Integration

1. **Source-path provenance plumbing.** The bridge accepts `StageMcpInput.sourcePath` as optional and falls back to a synthetic `<plugin>#mcpServers` tag. The install pipeline (Plan 03-07) is the canonical owner of the real source path (one of `<pluginRoot>/.mcp.json`, `<pluginRoot>/<plugin>.json#mcpServers`, or the marketplace-entry inline form). Plan 03-07 should always pass an explicit `sourcePath` -- the synthetic fallback exists only so the bridge's unit tests don't have to fabricate one.

2. **Cross-slot collision policy at uninstall.** The `unstage` path does NOT consult the four-slot collision map -- it only drops entries from the scoped `mcp.json`. If a user has manually copied one of our entries into a different slot (e.g. `~/.config/mcp/mcp.json`), uninstall will leave it behind. This is correct: we never wrote to a slot we don't own. Plan 03-07 should not surprise the user about this; the uninstall completion message should mention only the scoped file.

3. **Concurrent install serialization (T-03-37 acceptance).** The TOCTOU window between the collision check (slot scan + scoped-doc partition) and the `atomicWriteJson` commit is accepted in the threat model -- Phase 5's `withStateGuard` serializes concurrent installs. Plan 03-07 must wrap the prepare/commit pair in `withStateGuard` to honor that disposition; the bridge itself does not enforce it.

4. **Phase 5 state.json shape.** Phase 5 reads `StageMcpCommitResult.recorded` to populate state.json. The exact field names on the state.json side (`generatedName` vs `serverName`?) are a Phase 5 concern; the bridge exposes `generatedName` to be uniform with the other three bridges' record shapes (skills/commands/agents all use `generatedName`).

## Threat Flags

None -- the new surface adds no new network or trust-boundary code beyond what the plan's threat-model already accounts for. All four T-03-34..T-03-40 threats are addressed by the implemented behavior:

- T-03-34 (collision squatting) → MC-4 cross-slot check, throws on foreign declarer regardless of plugin claim.
- T-03-35 (untrusted JSON) → `parseMcpServers` shape validation; slot files with malformed JSON silently skipped (Pi-runtime concern).
- T-03-36 (path traversal via server name) → `assertSafeName` on every server name in `parseMcpServers`.
- T-03-37 (TOCTOU) → accepted; `withStateGuard` is the mitigation at Plan 03-07.
- T-03-38 (info disclosure via owningPath) → accepted; local-only paths, necessary for user resolution.
- T-03-39 (DoS via huge mcp.json) → accepted; O(n) parse + merge.
- T-03-40 (silent slot skip on malformed) → accepted; pi-mcp-adapter's diagnostics are the user-visible signal.

## Self-Check: PASSED

- All 12 created files present on disk: verified.
- Both task commits present in `git log`: T-01 = `05b6d49` (prior session), T-02 = `f73512b` (this session).
- `npm run check` exit 0; 344 tests pass.
- All plan done-criteria grep checks pass (verified during T-02 commit).
- No network calls in `bridges/mcp/` source (NFR-5).
- `_nextDoc` not re-exported from the barrel (verified via index.ts inspection).
