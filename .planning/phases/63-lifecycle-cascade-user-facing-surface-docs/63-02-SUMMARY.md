---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 02
subsystem: bridges
tags: [typescript, hooks-bridge, atomic-write, symlink-escape, life-03]

# Dependency graph
requires:
  - phase: 63-lifecycle-cascade-user-facing-surface-docs
    provides: 63-01 hook type seam (ClaudeHookEvent / HookSummaryEntry); 63-07 scope-fences architecture lint already in place
  - phase: 57-schema-component-type-payload-extension-tolerance
    provides: D-57-03 hooksDir field on ScopedLocations
provides:
  - writeHookConfig(input) exported from bridges/hooks/stage.ts
  - removeHookConfig(input) exported from bridges/hooks/stage.ts
  - hookConfigPathFor(locations, plugin) helper exported from bridges/hooks/stage.ts
  - assertNoSymlinkEscapeInHooksSubtree private helper (NOT re-exported from barrel)
  - bridges/hooks/index.ts re-exports of writeHookConfig + removeHookConfig + 4 input/output type aliases
  - SymlinkRefusedError narrowing on hooks-subtree escapes (Rule 1 deviation surfaced by Cases A+B)
affects: [63-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flatter writer/remover verb pair for single-file bridge artefacts (RESEARCH Open Question 2 resolution; mcp-bridge keeps the 3-verb prepare/commit/abort pair because of partition-and-merge complexity, hooks-bridge does NOT)"
    - "PathContainmentError -> SymlinkRefusedError translation in subtree walks: catch the generic class from assertPathInside and rethrow the narrower subclass when the failure mode is provably a symlink escape (entry.isSymbolicLink() === true)"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - tests/bridges/hooks/stage.test.ts
    - tests/bridges/hooks/symlink-escape.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts

key-decisions:
  - "[Phase 63] assertNoSymlinkEscapeInHooksSubtree throws the narrower SymlinkRefusedError on subtree escapes (Rule 1 fix). The original implementation propagated PathContainmentError verbatim from assertPathInside, but Cases A (buried symlink) and B (leaf symlink) require SymlinkRefusedError because the failure mode is provably a symlink escape (the loop only enters the assertion branch when entry.isSymbolicLink() === true). The narrower class lets callers instanceof-discriminate symlink escapes from generic containment failures; SymlinkRefusedError already inherits PathContainmentError so PI-14 handling is unaffected."

patterns-established:
  - "Subtree symlink walks before atomic single-file writes (LIFE-03): readdir({recursive, withFileTypes}) -> for each isSymbolicLink() entry -> realpath -> assertPathInside; ENOENT/ENOTDIR is a clean return (a plugin with no hooks/ subtree has nothing to check); first violation throws SymlinkRefusedError."

requirements-completed: [LIFE-03]

# Metrics
duration: ~30min
completed: 2026-06-16
---

# Phase 63 Plan 02: Hooks Bridge Stage/Unstage Summary

**writeHookConfig + removeHookConfig at bridges/hooks/stage.ts with LIFE-03 subtree symlink walk + NFR-1 atomic write. Flatter verb pair per RESEARCH Open Question 2 -- the single-file artefact does not justify the mcp bridge's 3-verb prepare/commit/abort shape.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-16T12:32:47Z
- **Completed:** 2026-06-16T13:03:06Z
- **Tasks:** 3 (committed atomically; 1 RED test + 1 GREEN impl + 1 symlink test bundled with the narrow-class fix)
- **Files created:** 3 (stage.ts, stage.test.ts, symlink-escape.test.ts)
- **Files modified:** 1 (bridges/hooks/index.ts)

## Accomplishments

- `bridges/hooks/stage.ts` ships `writeHookConfig` + `removeHookConfig` + `hookConfigPathFor` + private `assertNoSymlinkEscapeInHooksSubtree` + private `readSymlinkTargetSafe` helper.
- `writeHookConfig({locations, pluginName, pluginRoot, hooksValue})` order of operations:
  1. `assertSafeName(pluginName, "hooks bridge plugin name")` -- rejects "/", "\", ".", "..", control chars before any FS touch.
  2. `assertNoSymlinkEscapeInHooksSubtree(pluginRoot)` -- recursive readdir over `<pluginRoot>/hooks/`, realpath + assertPathInside per symlink entry, narrowed throw class.
  3. `assertPathInside(hooksDir, target, "hooks bridge write target")` -- belt-and-suspenders NFR-10 containment on the constructed `<hooksDir>/<plugin>/hooks.json` target.
  4. `atomicWriteJson(target, hooksValue)` -- single tmp+rename+fsync (NFR-1).
  Returns `{written: true, path: target}`.
- `removeHookConfig({locations, pluginName})` calls assertSafeName + assertPathInside + `rm(dir, {recursive: true, force: true})`. Idempotent (NFR-3). Returns `{removed: pluginName}`.
- `bridges/hooks/index.ts` re-exports the two verbs and the four input/output type aliases. The private helpers (`assertNoSymlinkEscapeInHooksSubtree`, `hookConfigPathFor`, `readSymlinkTargetSafe`) are NOT re-exported.

## Task Commits

Each task committed atomically:

1. **Task 2: failing tests for hooks bridge write/remove (RED)** — `93e942f` (test)
2. **Task 1: writeHookConfig/removeHookConfig hooks bridge implementation (GREEN)** — `18c4346` (feat)
3. **Task 3: LIFE-03 symlink-escape fixtures + narrow throw class (Rule 1 fix)** — `1c824a6` (test)

Task 2 landed before Task 1 to honor the TDD discipline (the plan's `tdd="true"` task gate requires a failing test commit before the implementation).

## Exact line locations (post-commit file state)

- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:1-14` -- module preamble (LIFE-03 / D-63-02 traceability anchors)
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:16-26` -- imports + ScopedLocations type alias
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:33-35` -- `hookConfigPathFor` exported helper
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:54-106` -- `assertNoSymlinkEscapeInHooksSubtree` private helper
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:108-114` -- `readSymlinkTargetSafe` private helper
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:116-135` -- `WriteHookConfigInput` / `WriteHookConfigResult` interfaces
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:136-151` -- `writeHookConfig` body
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:153-176` -- `RemoveHookConfigInput` / `RemoveHookConfigResult` + `removeHookConfig` body
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts:25-33` -- re-exports of the two verbs + 4 type aliases
- `tests/bridges/hooks/stage.test.ts` -- 7 cases (5 plan-specified + 2 negative guards)
- `tests/bridges/hooks/symlink-escape.test.ts` -- 5 cases (A buried, B leaf, C valid-real, D in-tree symlink, E missing subtree)

## Test count added

12 new tests (7 stage + 5 symlink-escape):

stage.test.ts:
1. `writeHookConfig writes <hooksDir>/<plugin>/hooks.json and returns absolute path`
2. `writeHookConfig is idempotent: second call yields identical content and does not throw`
3. `removeHookConfig removes <hooksDir>/<plugin>/ recursively and returns the plugin name`
4. `removeHookConfig is idempotent: removing a never-staged plugin does not throw`
5. `hookConfigPathFor returns path.join(locations.hooksDir, plugin, 'hooks.json')`
6. `writeHookConfig rejects pluginName containing '..' via assertSafeName BEFORE any filesystem access`
7. `removeHookConfig rejects pluginName containing '/' via assertSafeName BEFORE any filesystem access`

symlink-escape.test.ts:
1. `Case A (buried symlink): <pluginRoot>/hooks/sub/escape -> external dir rejects via SymlinkRefusedError`
2. `Case B (leaf symlink): <pluginRoot>/hooks/escape.sh -> external file rejects via SymlinkRefusedError`
3. `Case C (valid real path): regular files under <pluginRoot>/hooks/ succeed`
4. `Case D (in-tree symlink): <pluginRoot>/hooks/alias.sh -> ./scripts/format.sh succeeds`
5. `Case E (missing hooks subtree): pluginRoot without hooks/ succeeds (ENOENT clean return)`

Cases A, B, D are gated on `process.platform !== "win32"` (defensive skip; CI runs Linux).

## Verification

- `node --test tests/bridges/hooks/stage.test.ts tests/bridges/hooks/symlink-escape.test.ts` -- 12 pass / 0 fail (12 tests)
- `npm run check` -- green (typecheck + lint + format:check + unit + integration)
- `grep -n "writeHookConfig\|removeHookConfig" extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- 1 line, both names present
- `grep -c "assertPathInside" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` -- 8 (1 import + 4 docstring/comment + 3 call-sites: subtree walk, write-target, unstage-target). Above the plan's >=2 floor.
- `grep -c "assertSafeName" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` -- 5 (1 import + 2 docstring + 2 call-sites in writeHookConfig + removeHookConfig). Above the plan's >=2 floor.
- `grep -c "atomicWriteJson" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` -- 4 (1 import + 2 docstring/comment + 1 call-site). The plan asked for "exactly 1 call site" -- there is exactly 1 call site (line 148); the grep counts string matches incl. comments.
- `pre-commit run --files <changed files>` -- all hooks passed (trufflehog run separately, also passed).

## Decisions Made

- **Flatter verb pair (writeHookConfig + removeHookConfig) instead of the mcp bridge's 3-verb prepare/commit/abort triple.** The hooks bridge owns exactly one file per plugin (`<hooksDir>/<plugin>/hooks.json`). The mcp bridge's prepare/commit/abort shape exists to defer the disk write past a collision-detection pass that partitions ours-vs-theirs servers and merges with foreign entries. The hooks bridge has no foreign-entry merge surface (each plugin's hooks live in its own dir), so the prepare phase would be pure CPU work with no commit-time disk effect; collapsing to a single verb removes a layer of state representation without losing any guarantee. Decision recorded in 63-RESEARCH.md Open Question 2; final form chosen per the plan's `<must_haves>`.

- **assertNoSymlinkEscapeInHooksSubtree throws SymlinkRefusedError instead of propagating PathContainmentError verbatim (Rule 1 deviation surfaced by Cases A+B).** See Deviations section below for the full rationale; the narrower class matches the LIFE-03 failure mode (entry IS a symlink AND its realpath escapes pluginRoot), keeps the PI-14 instance-check handling intact via inheritance, and lets callers `err instanceof SymlinkRefusedError`-discriminate the symlink-escape vector from a generic containment failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] assertNoSymlinkEscapeInHooksSubtree threw PathContainmentError where the plan spec required SymlinkRefusedError**

- **Found during:** Task 3 (symlink-escape.test.ts Cases A + B initial failure)
- **Issue:** The first implementation in commit 18c4346 called `assertPathInside(pluginRoot, resolved, label)` directly inside the symlink loop. For a buried/leaf symlink whose realpath escapes pluginRoot, assertPathInside's string-level containment check fails FIRST and throws `PathContainmentError` (not the narrower SymlinkRefusedError subclass, which only fires when an intermediate path SEGMENT is a symlink). Cases A and B both asserted `err instanceof SymlinkRefusedError && err.message.includes("hooks subtree symlink")` per the plan's `<behavior>` block; the actual error satisfied the message predicate but not the instanceof check.
- **Fix:** Wrap the `assertPathInside` call in try/catch. On PathContainmentError, look up the symlink target via a defensive `readlink` helper and re-throw as `SymlinkRefusedError(pluginRoot, resolved, label, linkPath, linkTarget)`. The narrower class is the correct semantic match because the loop only enters the assertion branch when `entry.isSymbolicLink() === true` -- the failure IS a symlink escape, not just any containment failure. SymlinkRefusedError instances pass through unchanged (the intermediate-segment case where a parent dir of `resolved` is itself a symlink, e.g. macOS `/private/var` tmpdir resolution).
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/stage.ts
- **Verification:** Cases A + B now pass (`SymlinkRefusedError` instanceof check satisfied); Cases C, D, E (positive paths) still pass; the full `npm run check` is green.
- **Committed in:** 1c824a6 (folded into Task 3 commit since the test and the implementation correction land together to keep the bridge surface internally consistent)

**2. [Rule 3 - Blocking] entry.parentPath ?? hooksRoot tripped @typescript-eslint/no-unnecessary-condition**

- **Found during:** Task 1 pre-commit (npm lint stage)
- **Issue:** The plan's prescribed expression `path.join(entry.parentPath ?? hooksRoot, entry.name)` is a defensive nullish-coalesce on a property that, per the project's TypeScript types, is `string` (non-nullable when `withFileTypes` returns Dirent instances). ESLint flagged the `??` as unnecessary.
- **Fix:** Dropped the `?? hooksRoot` fallback and use `path.join(entry.parentPath, entry.name)` directly. The plan's defensive fallback was a belt-and-suspenders guard against a Node API quirk that does not apply on the project's Node baseline (>=22.18); the type system already proves the property is non-nullable.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/stage.ts
- **Verification:** `npm run lint` green.
- **Committed in:** 18c4346 (Task 1 commit, before the test file landed)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 narrowing, 1 Rule-3 lint-blocking)
**Impact on plan:** The Rule-1 narrowing is a semantic refinement on the plan's spec -- the plan's `<behavior>` for Cases A and B already required `SymlinkRefusedError`, so the implementation was internally inconsistent with the test contract. Fix preserves the plan's stated semantics. The Rule-3 lint-blocking fix is a one-token-pair deletion. No new code paths, no new exports beyond what the plan lists, no new tokens.

## Issues Encountered

- None beyond the deviations above.

## User Setup Required

None.

## Next Phase Readiness

Plan 63-04 (4-site cascade wiring across install/update/reinstall/uninstall) can now:

1. Import `{ writeHookConfig, removeHookConfig }` from `bridges/hooks/index.ts` (the public surface barrel).
2. Call `writeHookConfig` in each install/update/reinstall cascade site, passing the resolved plugin's `pluginRoot` so the LIFE-03 subtree walk fires per call. The bridge owns the assertSafeName + assertPathInside + atomicWriteJson sequence -- callers do not duplicate any of these guards.
3. Call `removeHookConfig` in the uninstall cascade site. The idempotent `rm` makes the call safe to invoke on plugins that never had hooks.
4. Catch `SymlinkRefusedError` (or the parent `PathContainmentError`) at the cascade-row boundary and surface as a refusal row -- PI-14 instance-check handling already propagates upward.

The single source of truth for the write path is `hookConfigPathFor(locations, plugin)`; if a later hydrate-side reader needs the same composition, it can import the helper from `bridges/hooks/stage.ts` directly. Ready for plan 63-04 cascade wiring.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` -- FOUND (created)
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- FOUND (modified)
- `tests/bridges/hooks/stage.test.ts` -- FOUND (created)
- `tests/bridges/hooks/symlink-escape.test.ts` -- FOUND (created)
- Commit `93e942f` -- FOUND in git log
- Commit `18c4346` -- FOUND in git log
- Commit `1c824a6` -- FOUND in git log

---
*Phase: 63-lifecycle-cascade-user-facing-surface-docs*
*Completed: 2026-06-16*
