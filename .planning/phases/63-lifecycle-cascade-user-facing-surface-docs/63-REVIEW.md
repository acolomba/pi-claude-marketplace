---
phase: 63-lifecycle-cascade-user-facing-surface-docs
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - tests/bridges/hooks/symlink-escape.test.ts
  - tests/bridges/hooks/stage.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 63 Re-Review (post-63-08 gap closure)

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found
**Scope:** Re-review of the three files touched by plan 63-08 — CR-01 gap
closure for the symlink-escape walker. The full Phase 63 surface (30 files)
was already reviewed in the prior pass; only delta and regressions are
covered here.

## Summary

Plan 63-08 closes CR-01 from the prior review. The walker in
`assertNoSymlinkEscapeInHooksSubtree` has been rewritten from a single
`readdir({ recursive: true, withFileTypes: true })` call to a hand-rolled
explicit stack walk that calls `readdir` ONE LEVEL at a time and uses
`lstat` to classify each entry. Symlink entries are never pushed onto the
walk stack, so the walker provably never issues an `fs` call against a
path outside `<pluginRoot>/hooks/`. The `SymlinkRefusedError` rejection
contract (D-17 / PI-14, subclass of `PathContainmentError`, narrower
discriminator preserved) is unchanged — `assertSymlinkEntryContained`
still routes through `assertPathInside` and translates a bare
`PathContainmentError` to a `SymlinkRefusedError` carrying the in-tree
`linkPath` as both label-subject and `linkPath` field. The new Case A
test in `symlink-escape.test.ts` actively asserts both halves of the
guarantee: (i) the rejection SUBJECT is the in-tree path
`<pluginRoot>/hooks/sub/escape`, and (ii) no externalDir-resident
sentinel filename leaks into the error message — proving the walker
never enumerated the external tree. The `HOOKS_VALUE` fixtures in both
test files have also been corrected to the schema-valid top-level
event-keys shape (WR-05 from the prior review is resolved as a
side-effect — see "Resolved findings" below).

Two warnings remain after the rewrite. The walker introduces a mid-walk
ENOENT propagation hazard (a concurrent file removal between `readdir`
and `lstat` crashes `writeHookConfig` instead of degrading cleanly), and
the inline duplication of the `readSymlinkTarget` helper drifts from the
single-source-of-truth pattern in `shared/path-safety.ts`. One info
finding flags that `assertSymlinkEntryContained`'s reliance on
`assertPathInside`'s `PathContainmentError`-to-`SymlinkRefusedError`
translation is load-bearing on macOS (where `mkdtemp` produces a
`/var/folders/.../` symlink to `/private/var/folders/.../`) but the
translation path is not directly covered by a test, so a future
refactor of `assertPathInside` could silently regress it.

## Resolved findings from prior review

### CR-01 — CLOSED

**Prior finding:** `assertNoSymlinkEscapeInHooksSubtree` follows symlinks
to directories before rejecting; `readdir({ recursive: true })` enumerates
external tree contents before reaching the symlink-entry rejection point.

**Verification:**
- `stage.ts:67-108` — the walker now uses an explicit `stack: string[]`
  seeded with `hooksRoot`, calls `readdir(dir, { withFileTypes: true })`
  one level at a time via `readEntriesOrSkip`, and classifies each entry
  with `lstat` (not `stat`). Symlink entries are handed to
  `assertSymlinkEntryContained` and then `continue`'d past — they are
  never pushed onto `stack`, so the walker has no code path that
  descends through a symlink. Only entries whose `lstat` reports
  `isDirectory() && !isSymbolicLink()` (the `isDirectory()` check on a
  `Stats` from `lstat` reports `false` for symlinks-to-directories
  natively, so the symlink-first `if` branch is technically redundant
  for the non-descent guarantee — but it is the right shape for
  clarity and for the rejection short-circuit).
- `symlink-escape.test.ts:50-123` — Case A actively pins both halves of
  CR-01's claim: (i) `subjectMatch[1] === expectedInTreePath` (the
  rejection SUBJECT must be `<pluginRoot>/hooks/sub/escape`, NOT a
  path inside `externalDir`), and (ii) `msg` must NOT contain the
  sentinel filenames `sentinel-do-not-read-PROBE` or
  `deep-sentinel-PROBE` written into the externalDir tree. A walker
  that descended through the symlink would surface one of these in
  the error message via `entry.parentPath`-style enumeration.
- The Case A externalDir setup (one top-level sentinel + one nested
  directory containing a deep sentinel) exercises both the
  single-level and recursive-descent failure modes of the old
  `recursive: true` walker.

CR-01 is closed.

### WR-05 (HOOKS_VALUE fixture shape) — CLOSED

**Prior finding:** The bridge tests used `{ hooks: { PreToolUse: [...] } }`
which is not a valid `HOOKS_CONFIG_SCHEMA` (the schema is
`Record<string, HOOK_EVENT_ARRAY>` with event keys at the TOP level).

**Verification:**
- `stage.test.ts:40-42` now uses
  `{ PreToolUse: [{ matcher: "Bash", hooks: [...] }] }` — top-level
  event keys, parity with `cascade.test.ts` and `lifecycle-cascade.test.ts`.
- `symlink-escape.test.ts:43` uses `{}` (an empty record) which is also
  schema-valid (`Record<string, HOOK_EVENT_ARRAY>` accepts zero entries).
  Comment on line 41-42 documents the choice: "Rejection happens before
  the value is read, so an empty record is sufficient AND parse-valid."

Both fixtures are now schema-valid. WR-05 is closed.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Mid-walk ENOENT between `readdir` and `lstat` propagates as an unhandled crash

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:91`
**Issue:** Between the `readdir(dir, { withFileTypes: true })` snapshot
in `readEntriesOrSkip` and the per-entry `lstat(linkPath)` in the
inner loop, an entry can be removed by a concurrent process (e.g. a
build tool sweeping its own tempdir, or a plugin author running
`rm -rf` while `pi /claude:plugin install` is in flight). `lstat` will
throw `ENOENT`. The inner loop has no try/catch — the error escapes
`assertNoSymlinkEscapeInHooksSubtree`, escapes `writeHookConfig`, and
unwinds the orchestrator's hooks phase as a generic non-PI-14 throw.

The `readEntriesOrSkip` helper centralizes the ENOENT/ENOTDIR
translation for the top-level `readdir` call (so a missing `hooks/`
dir is a clean skip — Case E in the tests pins this). The per-entry
`lstat` and the eventual `realpath` in `assertSymlinkEntryContained`
have no equivalent translation. The pre-rewrite walker had the same
hazard (the symlink resolution inside `realpath` could race), so this
is not a NEW regression of the gap closure — but the explicit walk now
has TWO race windows where the old code had one, and the test suite
does not cover the race.

The orchestrator-side blast radius:
- `install.ts` / `reinstall.ts` / `update.ts` invoke `writeHookConfig`
  inside the ledger's hooks phase; an unhandled non-`PathContainmentError`
  throw triggers the rollback-partial path (per the prior WR-01 in the
  earlier review).
- A user sees `(failed) {rollback partial}` for a transient FS race that
  has nothing to do with the plugin's hooks config.

**Fix:** Wrap the per-entry `lstat` in the same `ENOENT/ENOTDIR → skip`
shape used by `readEntriesOrSkip`. The race is "the entry vanished
between enumeration and classification" — treating it as a clean
skip is correct because (a) a vanished entry cannot mount a
symlink-escape attack, (b) the subsequent `atomicWriteJson` will
write `hooks.json` from the in-memory parsed value regardless of
on-disk subtree state, and (c) idempotency (NFR-3) is preserved.

```ts
let stat: import("node:fs").Stats;
try {
  stat = await lstat(linkPath);
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    continue;
  }
  throw err;
}
```

Optionally apply the same shape to the `realpath` call inside
`assertSymlinkEntryContained` (symlink target could be removed between
`lstat` and `realpath`, with the same race-window logic).

### WR-02: `readSymlinkTargetSafe` duplicates a near-identical helper in `shared/path-safety.ts`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:164-170`
**Issue:** `shared/path-safety.ts:139` already defines
`readSymlinkTarget(current)` which calls `readlink` and returns the
target (with its own error handling). The new helper in `stage.ts`
named `readSymlinkTargetSafe` does almost the same thing — calls
`readlink`, swallows any error, returns `<unreadable>`. The two
helpers diverge on the placeholder string (the path-safety version
returns the original path as a fallback; the stage.ts version
returns `<unreadable>`) and on what is caught (`SymlinkRefusedError`
construction in the path-safety call site uses a different fallback
shape).

This is single-source-of-truth drift: the bridge re-implements a
helper the shared module already provides. If a future change tightens
the placeholder format in `path-safety.ts`
(`"<unreadable: ${code}>"` for diagnostic clarity, say), the
bridge-local helper will silently keep its old `<unreadable>` string
and the error formats will drift apart.

**Fix:** Either (a) export `readSymlinkTarget` from
`shared/path-safety.ts` and reuse it in `stage.ts`, or (b) standardize
on the bridge-local `<unreadable>` placeholder and document why the
two helpers exist independently (different error-message contracts).
Option (a) is the smaller change.

## Info

### IN-01: `assertSymlinkEntryContained`'s `PathContainmentError → SymlinkRefusedError` translation is not directly covered

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:142-161`
**Issue:** The translation block converts a bare
`PathContainmentError` thrown by `assertPathInside` (the
"string-level isPathInside returned false, no symlink in the walked
segments" case) into a `SymlinkRefusedError` so callers can
`instanceof`-discriminate the symlink-escape contract. On Linux,
`mkdtemp` returns `/tmp/...` directly and `realpath` of an external
symlink returns the same `/tmp/...` prefix, so `isPathInside` may
return false WITHOUT the inner lstat walk firing a
`SymlinkRefusedError` — the translation path is the one that runs.
On macOS, `mkdtemp` returns `/var/folders/...` which `realpath`
resolves to `/private/var/folders/...`; the same translation path
runs.

The test suite covers the "translation happens AND the resulting
error is a `SymlinkRefusedError`" assertion via `assert.rejects(..., err
=> err instanceof SymlinkRefusedError)`. It does NOT independently
cover the "raw `assertPathInside` returned a `PathContainmentError`
because the lstat walk completed without finding a symlink" branch
versus the "raw `assertPathInside` ALREADY threw a
`SymlinkRefusedError` from an intermediate macOS `/private/var`
segment" branch — both produce the same observable `instanceof
SymlinkRefusedError` outcome.

This means a future refactor of `assertPathInside` that drops the
`PathContainmentError` throw (e.g. by tightening the string-level
check to always lstat-walk first) would silently make the
translation block dead code. The block would still compile and
typecheck; only the comment on lines 142-149 would become a lie.

This is informational only — the current code is correct and the
comment explicitly names the macOS `/private/var` case. The note is
that the rejection-contract test set asserts the OUTCOME but not the
BRANCH, so the translation block's reason-for-existence relies on
prose discipline.

**Fix:** Optional. Add a unit test that constructs a synthetic
scenario where `isPathInside` returns false but `assertPathInside`
does NOT throw `SymlinkRefusedError` from its own walk (e.g. an
absolute symlink target on Linux pointing to `/var/tmp/...` from a
`pluginRoot` of `/tmp/...`), and asserts the translation produces a
`SymlinkRefusedError` (not a bare `PathContainmentError`). Or
extract the translation into a labeled helper with its own
docstring naming the branch contract so it survives future audits.

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (post-63-08 gap-closure re-review)_
