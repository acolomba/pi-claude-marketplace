---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 08
subsystem: hooks-bridge / read-side defense
tags:
  - LIFE-03
  - CR-01
  - WR-05
  - symlink-walker
  - hand-rolled-stack-walk
dependency_graph:
  requires:
    - extensions/pi-claude-marketplace/shared/path-safety.ts (assertPathInside / SymlinkRefusedError / PathContainmentError)
    - extensions/pi-claude-marketplace/domain/name.ts (assertSafeName)
    - extensions/pi-claude-marketplace/shared/atomic-json.ts (atomicWriteJson)
  provides:
    - assertNoSymlinkEscapeInHooksSubtree(pluginRoot) — hand-rolled lstat-based stack walk, never enumerates outside <pluginRoot>/hooks/
  affects:
    - writeHookConfig (LIFE-03 read-side gate; signature unchanged)
tech_stack:
  added: []
  patterns:
    - "Hand-rolled stack walk over readdir(dir, { withFileTypes: true }) with lstat-per-entry classification — symbolic links are boundaries"
    - "Cognitive-complexity reduction via small named helpers (readEntriesOrSkip / assertSymlinkEntryContained / readSymlinkTargetSafe)"
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - tests/bridges/hooks/symlink-escape.test.ts
    - tests/bridges/hooks/stage.test.ts
decisions: []
metrics:
  duration: ~35min
  completed_date: "2026-06-16"
  tasks: 2
  files: 3
  tests_passing: "2273 unit + 10 integration + 1 skip (== Phase 63 baseline; no regression)"
requirements:
  - LIFE-03
---

# Phase 63 Plan 08: CR-01 / LIFE-03 Symlink-Walker Hardening Summary

One-liner: replace `readdir({recursive:true})`-backed symlink-escape walker
in the hooks bridge with a hand-rolled `lstat`-classified stack walk that
NEVER enumerates paths outside `<pluginRoot>/hooks/`, and tighten the Case A
regression assertions so the in-tree rejection subject and the absence of
external-tree contents in the error message are pinned. Closes CR-01 and
WR-05 from `63-REVIEW.md`; fully closes the LIFE-03 INTENT gap recorded as
Truth #2 in `63-VERIFICATION.md`.

## What was built

### Task 1 — RED: tightened regression assertions + WR-05 fixture cleanup

Commit `ba6632d` (`test(63-08): tighten LIFE-03 walker regression assertions`).

- `tests/bridges/hooks/stage.test.ts`: `HOOKS_VALUE` switched from the
  outer-wrapper `{ hooks: { PreToolUse: [...] } }` shape to the schema-valid
  top-level-event-keys `{ PreToolUse: [...] }` shape — parity with
  `tests/orchestrators/marketplace/cascade.test.ts:166` and
  `tests/transaction/lifecycle-cascade.test.ts:147`. The 7 existing
  round-trip tests `deepEqual` the same constant, so the byte change is
  transparent. (WR-05)

- `tests/bridges/hooks/symlink-escape.test.ts`:
  - `HOOKS_VALUE` switched to `{}` (rejection fires before the value is
    read; the schema-valid empty record is sufficient).
  - Case A extended with two new regression assertions:
    1. The rejection message's `hooks subtree symlink <PATH>` SUBJECT is
       parsed via regex and asserted equal to the IN-TREE symlink path
       (`<pluginRoot>/hooks/sub/escape`). Never an external-tree path.
    2. The rejection message must not contain the names of sentinel files
       seeded inside the external dir (`sentinel-do-not-read-PROBE`,
       `deep-sentinel-PROBE`) or the `externalDir/nested` subpath — if the
       walker had descended through the symlink, these names would have
       surfaced as candidate symlinks (with `parentPath` inside the
       external tree) or as containment-error citations.

  The plan's preferred technique (`t.mock.method(fsPromises, 'readdir')` to
  count FS calls against `externalDir`) was attempted but cannot work on
  Node 22.x: ESM module-namespace property descriptors are
  `configurable: false`, so `MockTracker.method` throws
  `Cannot redefine property: readdir`. (`mock.module` is available only
  under `--experimental-test-module-mocks`, which is not in the project's
  `npm test` flags.) The plan explicitly listed sentinel-based behavioral
  observation as the fallback technique (b); the in-tree-subject parse plus
  the sentinel-name-absence check is the load-bearing behavioral signal
  that pins T-63-08-PROBE and T-63-08-MSG.

### Task 2 — GREEN: hand-rolled lstat-based stack walk

Commit `9c347d1` (`fix(63-08): replace recursive readdir with lstat-based stack walk`).

- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`:
  - `lstat` added to the `node:fs/promises` import (alphabetical).
  - `Dirent` added as a type-only import (for the entries-helper signature).
  - Body of `assertNoSymlinkEscapeInHooksSubtree` replaced with a
    hand-rolled stack walk:
    - `stack: string[] = [hooksRoot]`, `while (stack.length > 0)`.
    - One `readdir(dir, { withFileTypes: true })` per popped dir — NO
      `recursive: true`. ENOENT/ENOTDIR is translated to a clean continue
      via the `readEntriesOrSkip` helper, preserving the existing
      "missing hooks/ dir is a clean return" contract.
    - `lstat(linkPath)` per entry — NOT `stat`, so symbolic links are
      classified WITHOUT issuing any FS call against their target. This is
      the core of the containment guarantee that closes CR-01.
    - Directory entries are pushed onto the stack only when they are real
      directories AND not symbolic links. Every symbolic link is a
      boundary; the walker never descends through one, even when the
      symlink's `realpath` resolves inside `pluginRoot`.
    - Symlinks are still fed through `realpath` +
      `assertPathInside(pluginRoot, ...)`; the existing
      `SymlinkRefusedError` / `PathContainmentError` translation block is
      preserved verbatim inside the new `assertSymlinkEntryContained`
      helper. The LIFE-03 rejection contract (SymlinkRefusedError on
      escape, PI-14 instanceof handling via PathContainmentError
      inheritance, D-17) is unchanged.
  - The walker body was split into three small named helpers
    (`readEntriesOrSkip`, `assertSymlinkEntryContained`,
    `readSymlinkTargetSafe`) to satisfy the project's sonarjs
    cognitive-complexity ceiling (was 28, now under 15).
  - JSDoc rewritten to describe the new walker shape: stack walk, lstat
    classification, never descend through symlinks, never enumerate paths
    outside `<pluginRoot>/hooks/`. LIFE-03 / D-17 traceability anchors
    preserved per `.claude/rules/typescript-comments.md`.

## Verification

`npm run check` — GREEN end-to-end on a clean tree:

- typecheck: clean
- lint: clean
- prettier: clean
- unit tests: 2273 pass / 0 fail / 1 skip (Phase 63 baseline matched, no
  regression)
- integration tests: 10 pass / 0 fail

Acceptance-criteria greps from the plan all pass:

| Check | Result |
|---|---|
| `grep -n "readdir(hooksRoot, { recursive: true" stage.ts` | 0 matches |
| `grep -cn "lstat" stage.ts` | 4 (import + 3 references in walker/JSDoc) |
| `grep -cn "assertPathInside(pluginRoot" stage.ts` | 2 (chokepoint + JSDoc) |
| `grep -cn "SymlinkRefusedError" stage.ts` | 8 (import + 7 references) |
| `grep -n "hooks: {" tests/bridges/hooks/{stage,symlink-escape}.test.ts` | 0 matches |
| `grep -n "PreToolUse" tests/bridges/hooks/stage.test.ts` | 1 match (schema-valid fixture) |
| `grep -nE "expectedInTreePath\|subjectMatch" tests/bridges/hooks/symlink-escape.test.ts` | 4 matches (in-tree-subject assertion wired) |

All 12 hook-bridge tests GREEN (5 symlink-escape cases + 7 stage-write
cases). Case A's two new regression assertions are GREEN both before AND
after the walker swap on Node v22.22.2 — the current Node version's
recursive `readdir` does not in fact follow directory symlinks for the
specific fixture shape, so the message-subject parse and the
sentinel-name-absence check happen to pass on the buggy walker too. The
assertions still serve as forward-regression pins for the walker's
invariants, and the walker rewrite is correct hardening that closes the
LIFE-03 INTENT gap independent of Node version.

## Truth #2 / LIFE-03 INTENT closure

From `63-VERIFICATION.md` (Truth #2 / Gap §):

> The LIFE-03 success-criterion wording ("a symlinked-escape command path
> is rejected at install with a notify error via fs.realpath +
> assertPathInside(<pluginRoot>, realpath)") is technically satisfied for
> the eventual rejection, but the criterion's INTENT (refuse to read
> outside pluginRoot) is violated.

After this plan:

- The walker NEVER calls `readdir` or `lstat` against any path outside
  `<pluginRoot>/hooks/`. Symbolic links are detected by `lstat` (which does
  not follow them) and rejected before any descent.
- The rejection error message's `hooks subtree symlink <PATH>` SUBJECT is
  the IN-TREE symlink path. The error body's `target:` field still names
  the symlink's target (intentional — the caller needs to see the escape
  target for diagnostic purposes), but no external-tree sub-path or
  enumerated child name appears.
- Even an in-tree-resolving symlink is NOT descended through. Every
  symbolic link is a boundary.

The LIFE-03 rejection contract (`SymlinkRefusedError` raised; `fs.realpath`
+ `assertPathInside(pluginRoot, resolved, ...)` containment check) is
preserved verbatim. The existing 5 fixture cases continue to pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint cognitive-complexity ceiling required helper extraction**
- **Found during:** Task 2
- **Issue:** The plan's sketch placed the entire walker body inline (stack
  loop + readdir try/catch + lstat + symlink handling + translation
  block). The combined function tripped sonarjs/cognitive-complexity at 28
  (ceiling 15) and also @typescript-eslint/no-non-null-assertion on
  `stack.pop()!`.
- **Fix:** Extracted `readEntriesOrSkip(dir)` and
  `assertSymlinkEntryContained(pluginRoot, linkPath)` as named helpers next
  to the walker. The pre-existing `readSymlinkTargetSafe(linkPath)` was
  preserved unchanged. Replaced the `!` non-null assertion with an
  explicit `if (dir === undefined) break;` guard clause. No behavior
  change; the symlink-rejection contract and the new "never descend
  through symlink" invariant are identical to the inline shape.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/stage.ts
- **Commit:** 9c347d1

**2. [Rule 3 - Blocking] TypeScript readdir overload picked `Dirent<NonSharedBuffer>`**
- **Found during:** Task 2
- **Issue:** `Promise<Awaited<ReturnType<typeof readdir>> | null>` as the
  return type of `readEntriesOrSkip` resolved to a `Dirent<NonSharedBuffer>[]`
  overload that doesn't match `string`-named entries; downstream
  `path.join(dir, entry.name)` failed typecheck.
- **Fix:** Imported `Dirent` as a type-only import from `node:fs` and
  declared the return type as `Promise<Dirent[] | null>` (which defaults
  the type parameter to `string`).
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/stage.ts
- **Commit:** 9c347d1

### Deviations from preferred technique

**[Plan-acknowledged fallback] FS-call counter via `t.mock.method` not viable on Node 22.x ESM**
- **Found during:** Task 1
- **Issue:** The plan's preferred Case A assertion technique (a) was
  `t.mock.method(fsPromises, 'readdir')` and `t.mock.method(fsPromises, 'lstat')`
  to record call paths and assert no path resolves under `externalDir`.
  `MockTracker.method` calls `Object.defineProperty`, which throws
  `Cannot redefine property: readdir` because Node's `node:fs/promises`
  ESM namespace exports have `configurable: false`. `mock.module` would
  work but requires `--experimental-test-module-mocks` which is not in the
  project's `npm test` flags.
- **Fix:** Used the plan's fallback technique (b) — sentinel-based
  behavioral check. Two sentinel files are seeded inside the external dir
  before the call; the rejection error message is asserted to (i) name the
  in-tree symlink path as its SUBJECT and (ii) not contain any sentinel
  filename. A buggy walker that enumerated into the external dir would
  surface those names in the error (either as candidate-symlink
  `parentPath` strings or as nested-containment-error citations). The plan
  explicitly listed technique (b) as the documented fallback.
- **Commit:** ba6632d

## Known Stubs

None — this plan modifies pre-existing wiring; no UI rendering or new
data-flow surfaces were introduced.

## Threat Flags

None — the change strictly tightens (not expands) the existing LIFE-03
trust boundary. No new network endpoints, no new file-access surfaces, no
schema changes.

## Self-Check: PASSED

Files verified to exist:

- FOUND: `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` (with
  walker rewrite)
- FOUND: `tests/bridges/hooks/symlink-escape.test.ts` (with Case A
  tightened assertions + WR-05 fixture cleanup)
- FOUND: `tests/bridges/hooks/stage.test.ts` (with WR-05 fixture cleanup)

Commits verified to exist on `features/v1.13-hook-bridge`:

- FOUND: `ba6632d` — `test(63-08): tighten LIFE-03 walker regression assertions`
- FOUND: `9c347d1` — `fix(63-08): replace recursive readdir with lstat-based stack walk`

`npm run check` GREEN end-to-end; baseline 2273 unit / 10 integration / 1
skip preserved.
