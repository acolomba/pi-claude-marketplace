---
phase: 52-first-run-migration
reviewed: 2026-06-10T12:14:08Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/persistence/migrate-config.ts
  - tests/persistence/migrate-config.test.ts
  - tests/persistence/fixtures/legacy/state-populated-mixed.json
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-06-10T12:14:08Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 52 first-run migration seam (`buildConfigFromState` pure
projection + `migrateFirstRunConfig` ENOENT-gated orchestrator), its test
suite (20 tests, all currently green), and the populated legacy fixture.
Cross-referenced against `config-io.ts` (saveConfig/loadConfig contracts),
`state-io.ts` (ST-6 source normalization), `migrate.ts` (D-13 gate),
`locations.ts`, `config-merge.ts`, and `domain/source.ts`.

The core invariants hold: never-overwrite (valid AND invalid arms
short-circuit, proven by tests), atomicity/containment/revalidation inherited
from the `saveConfig` seam, no console/notify in this module (IL-2/IL-3
clean), soft-degraded plugins included, flat-key collision avoidance, and
exact-boolean defense on the SPLIT-01 `autoupdate` cast.

One critical defect was found and reproduced: the unguarded
`(mp.source as ParsedSource).raw` cast wedges the migration permanently when
state contains a forward-compat `unknown`-kind source record without a string
`raw` — a shape that `loadState` explicitly admits per ST-6 / NFR-12. The
defense-in-depth discipline applied to `autoupdate` (exact-boolean check) was
not applied to `source`, the only other field recovered through a cast.

## Critical Issues

### CR-01: Unguarded `.raw` cast wedges first-run migration on forward-compat source records

**File:** `extensions/pi-claude-marketplace/persistence/migrate-config.ts:65`
**Issue:** `buildConfigFromState` recovers the source string via
`(mp.source as ParsedSource).raw` with no runtime guard. `loadState`'s ST-6
funnel documents three legal storage shapes, and shape 3 — "unknown-kind
object (forward-compat / NFR-12) -> accept verbatim" — is accepted by
`normalizeStoredSource` (state-io.ts:140) **without** checking that `raw`
exists or is a string. A state.json marketplace with
`"source": { "kind": "unknown", "reason": "future kind" }` survives
`loadState` (STATE_SCHEMA declares `source: Type.Unknown()`), but the
projection then emits `{ source: undefined }`. Reproduced:

```
buildConfigFromState(state)  ->  {"schemaVersion":1,"marketplaces":{"mp-x":{}},"plugins":{}}
CONFIG_VALIDATOR.Check(cfg)  ->  false
```

`saveConfig` then throws `saveConfig refused: in-memory config failed schema
validation`, so `migrateFirstRunConfig` rejects. Because the failure happens
before any disk write, `claude-plugins.json` is never created, the ENOENT arm
re-fires on **every** subsequent load, and the migration fails identically
forever — one forward-compat marketplace record permanently blocks migration
for the entire scope, with no self-recovery path (retry can never succeed,
violating the spirit of NFR-3 fail-clean-and-retry). The D-13 autoupdate
scrub gate also never opens for that scope. Note the asymmetry: the SPLIT-01
`autoupdate` cast two lines below gets exact-boolean defense-in-depth; the
`source` cast — the only required field in `MARKETPLACE_CONFIG_ENTRY_SCHEMA`
— gets none.
**Fix:** Guard the recovery and fall back to a string that round-trips, e.g.:

```typescript
import { sourceLogical, type ParsedSource } from "../domain/source.ts";

const parsed = mp.source as ParsedSource;
const sourceRaw =
  typeof parsed?.raw === "string" ? parsed.raw : sourceLogical(parsed);
```

(`sourceLogical`'s `unknown` arm also returns `.raw`, so if the team prefers
a hard policy, the alternative is: skip the marketplace, collect it into a
`skipped: string[]` field on `MigrateFirstRunResult`, and let Phase 55
surface it. Either way the projection must never emit a non-string `source`.)
Add a regression test using `{ kind: "unknown" }` without `raw` (see WR-02).

## Warnings

### WR-01: Skip arm conflates "existing valid config" with "existing invalid config" and discards the CFG-03 error detail

**File:** `extensions/pi-claude-marketplace/persistence/migrate-config.ts:108-111`
**Issue:** `migrateFirstRunConfig` collapses the `loadConfig` trichotomy into
a bare `migrated: false` for both the `valid` and `invalid` arms. CFG-03
treats an invalid `claude-plugins.json` as an **abort signal** that must be
surfaced to the user, and `loadConfig` already produces a precise
`{ filePath, error }` payload on the `invalid` arm — but this function throws
that information away. The Phase 55 caller, which "narrows on `migrated` to
decide whether/how to surface the migration" (per the interface doc at
lines 30-33), cannot distinguish "nothing to do, config already declared"
from "migration was suppressed because your config file is corrupt." It is
forced to re-probe with a second `loadConfig` call, creating a divergence
window between the two reads and duplicating the I/O the module comment
says it avoids.
**Fix:** Carry the skip reason on the false arm, e.g.:

```typescript
export type MigrateFirstRunResult =
  | { readonly migrated: true; readonly entryCount: number; readonly filePath: string }
  | {
      readonly migrated: false;
      readonly reason: "existing-valid" | "existing-invalid";
      readonly error?: string; // loadConfig's invalid-arm detail
      readonly filePath: string;
    };
```

This is a pure additive change to a not-yet-consumed seam (no callers exist
outside the test file), so the cost is lowest now, before Phase 55 wires it.

### WR-02: No test coverage for the fresh-install (empty-state) arm or the CR-01 trigger

**File:** `tests/persistence/migrate-config.test.ts:112-354`
**Issue:** Every Section A/B test drives the populated fixture. Two
load-bearing input classes are untested:

1. **Empty state (fresh install)** — the single most common production path.
   `loadState` returns `DEFAULT_STATE` on ENOENT; the migration then writes
   `{"schemaVersion":1,"marketplaces":{},"plugins":{}}` and returns
   `entryCount: 0` with `migrated: true`. Nothing proves this file
   validates, that `migrated: true` with `entryCount: 0` is the intended
   signal shape for Phase 55 messaging, or that creating the file correctly
   opens the D-13 scrub gate on a box that never had V1 state.
2. **Forward-compat `unknown`-kind source** (the CR-01 input): no test feeds
   `{ kind: "unknown" }` (raw-less) through `buildConfigFromState`, which is
   why the wedge shipped undetected despite the suite's otherwise thorough
   defense-in-depth tests for `autoupdate` tampering.

**Fix:** Add `buildConfigFromState({ schemaVersion: 1, marketplaces: {} })`
and a `migrateFirstRunConfig` round-trip on empty state asserting
`migrated: true`, `entryCount: 0`, and `loadConfig(...).status === "valid"`;
add a raw-less unknown-source projection test pinning whatever policy CR-01's
fix selects.

## Info

### IN-01: New module not exported from the persistence barrel

**File:** `extensions/pi-claude-marketplace/persistence/index.ts:1-13`
**Issue:** `index.ts` declares itself "public API surface for the
persistence/ tier... so callers can import from `../persistence` without
coupling to internal file layout," but `migrate-config.ts` (like Phase 51's
`config-io.ts` / `config-merge.ts`) is not re-exported. Phase 55 will have to
deep-import, further eroding the barrel's stated purpose.
**Fix:** Either re-export `buildConfigFromState` / `migrateFirstRunConfig` /
`MigrateFirstRunResult` (and the Phase 51 config symbols), or update the
barrel comment to scope its claim.

### IN-02: Test helper reimplements source classification; fixture is not the "faithful transcript" its doc claims

**File:** `tests/persistence/migrate-config.test.ts:61-79`
**Issue:** `loadPopulatedState` hand-rolls the path/github heuristic
(`./`, `../`, `/`, `~`, `~/` prefixes) instead of calling the production
`parsePluginSource` funnel — if the fixture ever gains a source form the
heuristic misroutes (e.g. `~user/...`), `githubSource()` throws a confusing
factory error. Separately, the doc comment says "the fixture itself stays a
faithful state.json transcript," but the fixture omits the **required**
`schemaVersion: 1` field (STATE_SCHEMA `Type.Literal(1)`); the helper patches
it in via spread at line 78, so the fixture would not actually load through
`loadState`.
**Fix:** Use `parsePluginSource(src)` (assert `kind !== "unknown"`) for
normalization, and add `"schemaVersion": 1` to the fixture so it is a real
transcript.

### IN-03: Dead `scopeRoot` return field and redundant per-test mkdir

**File:** `tests/persistence/migrate-config.test.ts:81-106`
**Issue:** `tmpScopeRoot` creates `<dir>/.pi` and returns `scopeRoot`, but
every caller destructures only `{ tmpDir, cleanup }`, recomputes the same
path via `locationsFor("project", tmpDir)`, and then redundantly
`mkdir(loc.scopeRoot, { recursive: true })` (e.g. lines 233, 249) — the
directory already exists.
**Fix:** Drop the `scopeRoot` field and the helper-side `mkdir` (keep the
per-test one), or vice versa.

### IN-04: Flat plugin key `${pluginName}@${mpName}` is ambiguous when names contain "@"

**File:** `extensions/pi-claude-marketplace/persistence/migrate-config.ts:83`
**Issue:** `assertSafeName` (domain/name.ts) permits `@` in marketplace and
plugin names, so plugin `a@b` in marketplace `c` and plugin `a` in
marketplace `b@c` both project to the key `a@b@c`. The D-01 flat-key contract
is a Phase 51/53 decision, not introduced here, but this is the first writer
that materializes such keys to disk.
**Fix:** Confirm the D-01 consumers (Phase 53 `planReconcile`) split on the
**last** `@`, or tighten name validation to reject `@`; pin whichever with a
test.

---

_Reviewed: 2026-06-10T12:14:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
