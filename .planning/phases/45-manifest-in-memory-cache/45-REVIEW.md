---
phase: 45-manifest-in-memory-cache
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/manifest-cache.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - tests/domain/manifest-cache.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Resolution (2026-06-07)

Operator decision: apply both warnings; accept the three info items as-is.

- **WR-01 -- FIXED** (commit `3fe6b46`): the cache now re-stats after the loader
  returns and keys the entry on the post-load stat. The hit path stays a single
  `stat` (CACHE-01 criterion #1 holds); output is byte-identical (catalog-uat
  green).
- **WR-02 -- FIXED** (commit `3fe6b46`): the negative arm now stores and re-throws
  the exact thrown value (`thrown: unknown`) instead of coercing non-Error throws,
  preserving `.code`/structured fields and matching the D-02 stat-fail path.
- **Info CR-03/04/05 -- ACCEPTED**: the `as Promise<MarketplaceManifest>` cast,
  the bindingless `catch {}`, and the "no locking" comment are left as intentional
  (the comment was reworded in `3fe6b46` to not overstate atomicity).

`npm run check` green (1473/1473) after the fixes.

## Summary

Phase 45 wraps `loadMarketplaceManifest` in a process-lifetime in-memory cache keyed
per-path on `(mtimeMs, size)`, adding exactly one `stat` per read and no extra file
content reads (CACHE-06 holds). I reviewed the cache factory, the `manifest.ts` wiring,
and the behavioral test suite at standard depth, and I traced every consumer of
`loadMarketplaceManifest` (`install.ts`, `add.ts`, `info.ts`, `list.ts`,
`reinstall.ts`, `marketplace/update.ts`, `plugin/update.ts`, `edge-deps.ts`) to verify
the by-reference / read-only contract and the NFR-5 (no-network) / NFR-10 (containment)
invariants.

The implementation is correct against its locked design. All 7 tests pass; typecheck and
ESLint are clean on both source files. The locked residual risks (same-size rewrite
collision on `(mtimeMs, size)`, unbounded cache, no in-flight de-dup, by-reference return,
stat-fail as pure miss) are all intentional per the phase intent and are NOT flagged as
defects. I verified the by-reference mutation hazard is contained: every consumer reads
the result read-only (`.find()`, `.description`, `JSON.stringify`, `Object.keys`); the
`plugin/update.ts` accessor even types `plugins` as `readonly`. NFR-5/NFR-10 hold -- the
cache adds only `stat`, no network and no writes.

No blocking defects found. The findings below are two robustness warnings on the
TOCTOU-vs-negative-cache interaction and the negative-cache error-shape coercion, plus
three quality/clarity items.

## Warnings

### WR-01: Negative cache keys on the pre-read stat, so a TOCTOU rewrite can persist a stale parse error across two reads

**File:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts:96-104`
**Issue:** The cache `stat()`s the file (line 78), then calls the injected loader, which
performs its OWN independent `readFile` inside `domain/manifest.ts`. The entry -- positive
or negative -- is stored under the `(mtimeMs, size)` captured at line 78, NOT the stat of
the bytes the loader actually read. If the file is rewritten in the window between the
cache's `stat` and the loader's `readFile` (the `await` at line 78 yields the event loop),
the loader observes content for `(mtime=T2, size=S2)` while the entry is recorded under
the now-stale `(mtime=T1, size=S1)`.

For a SUCCESS this self-heals: the next read's `stat` returns the real `(T2, S2)`, mismatches
the stored `(T1, S1)`, and reloads. But for a FAILURE the same self-heal exists only if the
file changes again -- a parse error captured against a `(T1, S1)` that never matched real bytes
is served until the file's stat moves off `(T1, S1)`. Worst case: the file was briefly truncated
(causing a parse error) then restored to its original `(T1, S1)` size+mtime; the negative entry
keyed on `(T1, S1)` now masks the restored-good file on the next read. This is a sharper edge
than the documented "same-size rewrite" Pitfall 3, because here the stored key never described
the loaded bytes at all.

This is low-probability (sub-millisecond window, sequential call sites) and the loader's
own error still propagates byte-identically the FIRST time, so it is a Warning, not a Blocker.
**Fix:** Re-`stat` after the load completes and store the entry under the post-load stat, so
the key always describes the bytes that were actually read:
```ts
try {
  const value = await load(manifestPath);
  const post = await stat(manifestPath).catch(() => st); // fall back to pre-stat
  entries.set(manifestPath, { mtimeMs: post.mtimeMs, size: post.size, ok: true, value });
  return value;
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  const post = await stat(manifestPath).catch(() => st);
  entries.set(manifestPath, { mtimeMs: post.mtimeMs, size: post.size, ok: false, error });
  throw error;
}
```
Alternatively, document this stat/read non-atomicity explicitly in the D-02/Pitfall-3 comment
block, since the current comment only addresses same-size rewrites between two separate reads,
not the stat-vs-readFile skew within a single read. (If the documented residual-risk acceptance
is intended to cover this case too, treat this as a doc-clarity item rather than a code change.)

### WR-02: Non-`Error` loader rejections are wrapped into a fresh `Error`, silently dropping `.code` and other fields the byte-identical-propagation contract depends on

**File:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts:101`
**Issue:** On a load failure the cache does
`const error = err instanceof Error ? err : new Error(String(err));`. The real loader
(`loadMarketplaceManifestUncached`) throws either a plain `Error` (schema-invalid) or a
Node `ErrnoException` (an `Error` subtype carrying `.code`, e.g. `EACCES`/`EISDIR` from
`readFile`) -- both pass `instanceof Error`, so today no real loader path loses fields.
However, the D-02 contract and the test at `tests/domain/manifest-cache.test.ts:227-234`
explicitly assert that the original `.code` (e.g. `ENOENT`) "propagates byte-identically."
A loader that rejected with a non-`Error` value (a `string`, or a `{code, message}` plain
object) would have that value coerced to `new Error(String(err))` and re-thrown on the
NEGATIVE-cache path -- discarding `.code` and any structured fields the consumer narrows on
(`(err as NodeJS.ErrnoException).code === "ENOENT"` is used in `marketplace/update.ts:324`
and `plugin/list.ts` error narrowing).

The stat-fail path at line 82 (`return load(manifestPath)`) correctly propagates the raw
rejection unchanged; only the negative-cache arm at line 101 coerces. The behavior is therefore
inconsistent between the two miss paths.
**Fix:** Store and re-throw the original rejection value unchanged so structured fields survive,
mirroring the stat-fail path. Either widen the negative entry to hold `unknown`:
```ts
} catch (err) {
  entries.set(manifestPath, { mtimeMs: st.mtimeMs, size: st.size, ok: false, error: err });
  throw err; // re-throw the original instance; preserves .code and any structured fields
}
```
(adjusting `ManifestCacheEntry.error` to `unknown`), or -- if the `error: Error` invariant is
load-bearing for the by-reference re-throw type -- at minimum copy `.code` onto the wrapper.
Given the injected loader only ever throws `Error` subtypes in production, this is a robustness
Warning rather than a live bug.

## Info

### IN-01: `as Promise<MarketplaceManifest>` cast launders the cache's `unknown` without re-validation

**File:** `extensions/pi-claude-marketplace/domain/manifest.ts:82`
**Issue:** `loadMarketplaceManifest` returns `manifestCache.load(manifestPath) as Promise<MarketplaceManifest>`.
The cache is typed `Promise<unknown>` and the cast asserts the validated shape. This is sound
TODAY because the only loader wired into `manifestCache` is `loadMarketplaceManifestUncached`,
which runs `MARKETPLACE_VALIDATOR.Check` before returning. But the cast is unchecked: if a future
edit injected a different loader, the type system would not catch a shape mismatch here -- the
guarantee lives entirely in the convention that this cache is constructed with the validating
loader. The narrowing is correct but invisible to the compiler.
**Fix:** Acceptable as-is given D-01's single-loader design. Optionally tighten by parameterizing
the cache generic -- `createManifestCache<T>(load: (p: string) => Promise<T>): { load(p: string): Promise<T> }` --
so `manifest.ts` gets `Promise<MarketplaceManifest>` without a cast and the type flows from the
loader signature. This removes the `as` entirely.

### IN-02: Bare `catch {}` discards the stat error, masking the distinction between "file absent" and "stat misconfigured"

**File:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts:79`
**Issue:** The `catch {}` on the `stat` call swallows the error unconditionally to implement the
D-02 pure-miss fallthrough. This is intentional and correct for the cache's purpose (the loader's
own `readFile` will reproduce the real error). The downside is purely diagnostic: an unexpected
`stat` failure mode (e.g. a transient FS error that the loader's later `readFile` does NOT
reproduce identically) is silently dropped, and the bindingless `catch {}` reads as a no-op to a
maintainer. ESLint's `no-empty` is not configured here so this passes lint.
**Fix:** No functional change needed -- this is the locked D-02 behavior. Optionally add a one-word
binding/comment intent marker so the swallow is self-documenting, e.g.
`catch { /* D-02: stat failure is a pure miss; defer to loader for the real error */ }`
(the existing inline comment at lines 80-81 already does this -- consider moving it onto the same
line as the `catch` for grep-visibility).

### IN-03: The "Single-threaded JS event loop = no locking" comment overstates atomicity given the `await` yields

**File:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts:66`
**Issue:** The doc comment states "Single-threaded JS event loop = no locking." While true that
there is no data race on the `Map` itself, the `load` method `await`s twice (`stat`, then the
loader) and the event loop CAN interleave other `load` calls for the same path between those
awaits -- which is exactly the WR-01 TOCTOU and the explicitly-out-of-scope "no in-flight de-dup"
(D-04). The comment is accurate about Map mutation safety but a reader may over-read it as "the
whole method is atomic," which it is not.
**Fix:** Narrow the claim, e.g. "Single-threaded JS = no `Map` data race; the method is NOT
atomic across its `await` points -- concurrent in-flight de-dup is out of scope (D-04)." Pure
comment clarity; no code change.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
