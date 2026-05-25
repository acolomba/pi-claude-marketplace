---
phase: quick-260525-aub
plan: 01
subsystem: orchestrators
tags: [typed-errors, discriminated-unions, redos, sonarcloud-s5852, cr-06, nfr-7]

# Dependency graph
requires:
  - phase: 13
    provides: ManualRecoveryError + AgentsUnstageFailureError typed-carrier precedent (CR-06)
  - phase: 13
    provides: closed REASONS set + `permission denied` / `source missing` additions
provides:
  - PluginShapeError discriminated typed error (kinds not-in-manifest, already-installed, not-installable, no-longer-installable)
  - PluginUpdateOutcome.reasons readonly Reason[] (producer-narrowed cascade contract)
  - Typed catch-site dispatch in install (classifyEntityShapeError / classifyInstallFailure), remove (narrowCascadeFailure), update (narrowSkipReason / narrowFailReason, outcomeToCascadeRow)
  - SonarCloud typescript:S5852 ReDoS hotspot at legacy install.ts:902 eliminated (regex deleted)
affects: [next-milestone, sonarcloud, future-cleanup-of-PluginUpdateOutcome.notes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated typed errors with constructor-as-single-source-of-message-truth (PluginShapeError joins ManualRecoveryError + AgentsUnstageFailureError precedent)"
    - "Producer-narrowed closed-set Reason on outcome contracts (cascade consumer reads outcome.reasons[0] directly; substring fallback retained transitionally)"
    - "Test-seam re-export under __test_* alias for private catch-site helpers (mirrors __test_outcomeToCascadeRow precedent in reinstall.ts)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - tests/shared/errors.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "PluginShapeError.reasons typed as readonly string[] (not readonly Reason[]) -- resolver r.notes are free-form strings; closed-set narrowing happens at the renderer boundary in classifyEntityShapeError"
  - "PluginUpdateOutcome.notes retained for cause-chain trailer text composition; consumers prefer .reasons for classification"
  - "Test-seam exports under __test_* alias rather than widening helper visibility (architecture rule: private surface for production, narrow exposure for tests)"
  - "reinstall.ts catch sites left unchanged -- existing narrowReason substring fallback already handles the new PluginShapeError byte-equal .message text via the legacy `not in manifest` mapping"
  - "Textual fallback branches in narrowCascadeFailure (`unreadable`/`unparseable`) retained as defensive last resort, documented as transitional"

patterns-established:
  - "Throw site composes message via discriminated constructor; catch site dispatches on instanceof + .kind"
  - "Producer-narrowed Reason at outcome construction time; substring re-narrow at consumer is fallback-only (transitional)"
  - "Typed cause discrimination via NodeJS.ErrnoException.code (locale-independent, NFR-4 compatible)"

requirements-completed: [CR-02]

# Metrics
duration: 29min
completed: 2026-05-25
---

# Quick Task 260525-aub: Typed Error Refactor Summary

**Replaced free-text Error.message parsing in 4 catch sites with discriminated typed dispatch; deleted SonarCloud typescript:S5852 ReDoS hotspot regex at install.ts:902.**

## Performance

- **Duration:** ~29 min
- **Started:** 2026-05-25T11:59:53Z
- **Completed:** 2026-05-25T12:28:20Z
- **Tasks:** 2 of 2
- **Files modified:** 11

## Accomplishments

- Introduced `PluginShapeError` discriminated typed error class (4 kinds: not-in-manifest, already-installed, not-installable, no-longer-installable) with byte-equal `.message` text to the legacy `new Error("Plugin "X" ...")` form.
- Migrated 4 throw sites: `resolver.ts::requireInstallable` (PR-6) and `install.ts:263 / 285 / 294` (PI-3 / PI-5) all throw `PluginShapeError`.
- Migrated 5 catch sites to typed dispatch:
  - `install.ts::classifyEntityShapeError` -- `instanceof PluginShapeError` + `.kind` switch.
  - `install.ts::classifyInstallFailure` -- `instanceof PluginShapeError` + `.kind` switch (with `ConcurrentInstallError` typed branch retained).
  - `marketplace/remove.ts::narrowCascadeFailure` -- `instanceof AgentsUnstageFailureError` + `NodeJS.ErrnoException.code` (EACCES/EPERM -> "permission denied", ENOENT -> "source missing").
  - `marketplace/update.ts::narrowSkipReason` / `narrowFailReason` -- read `outcome.reasons[0]` first; legacy substring parse retained only as back-compat fallback.
  - `plugin/update.ts::outcomeToCascadeRow` (direct-update consumer) -- same `outcome.reasons` preference.
- Eliminated SonarCloud `typescript:S5852` ReDoS hotspot by **deleting** the `/is not installable:\s*(.+)$/` regex at the legacy install.ts:902 site; the typed dispatch path doesn't need it.
- Added `PluginUpdateOutcome.reasons?: readonly Reason[]` to the contract; producers in `plugin/update.ts` populate it on every skipped/failed return site (preflight, requireInstallable catch, cascade-safe catch, phase-3 aggregate).
- 16 new dispatch tests added; test count went from 1254 to 1276; `npm run check` (typecheck + lint + format + tests) green.
- No new REASONS member; drift guard at `tests/architecture/grammar-frontmatter.test.ts` stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PluginShapeError + migrate throw sites + extend PluginUpdateOutcome** -- `ab1a937` (refactor)
2. **Task 2: Migrate catch sites to typed dispatch + delete S5852 regex + update marketplace consumers** -- `da04709` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts` -- Added `PluginShapeError` typed class with `PluginShapeErrorShape` discriminated union and `PluginShapeErrorKind` literal alias. Constructor is single source of truth for the byte-equal `.message` text.
- `extensions/pi-claude-marketplace/domain/resolver.ts` -- `requireInstallable` now throws `PluginShapeError` (kind = "not-installable" or "no-longer-installable"); passes through `r.notes` as the `reasons` array.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- Migrated 3 throw sites (PI-3/PI-5 already-installed / not-in-manifest). Rewrote `classifyEntityShapeError` and `classifyInstallFailure` with typed dispatch; deleted the S5852 regex. Added `__test_classifyEntityShapeError` / `__test_classifyInstallFailure` test seams.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- Populates `reasons: readonly Reason[]` on all 5 producer sites (preflight skipped paths + requireInstallable catch + cascade-safe outer catch + phase-3 aggregate failure return). Local `outcomeToCascadeRow` now prefers `outcome.reasons` over `narrowSkipReasons` / `narrowFailReasons`. Added `reasonsFromTypedError` helper for typed-error -> Reason mapping.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- Rewrote `narrowSkipReason` / `narrowFailReason` to take the full `PluginUpdateOutcome` and prefer `outcome.reasons[0]`; legacy notes parse retained as transitional fallback. Added `__test_outcomeToCascadeRow` test seam.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- Rewrote `narrowCascadeFailure` with typed dispatch on `instanceof AgentsUnstageFailureError` + `NodeJS.ErrnoException.code`. Added `isErrnoException` structural predicate. Textual fallback retained defensively. Added `__test_narrowCascadeFailure` test seam.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- Added `PluginUpdateOutcome.reasons?: readonly Reason[]`. Documented the contract: cascade consumer prefers `reasons` over `notes`; `notes` retained for cause-chain trailer composition.
- `tests/shared/errors.test.ts` -- 7 new `PluginShapeError` tests covering all 4 kinds, byte-equal message forms, `ErrorOptions.cause` wiring, and instanceof narrowing.
- `tests/orchestrators/plugin/install.test.ts` -- 6 new dispatch tests for `classifyEntityShapeError` and `classifyInstallFailure` (one assertion per kind, plus a fallthrough test).
- `tests/orchestrators/marketplace/remove.test.ts` -- 5 new dispatch tests for `narrowCascadeFailure` (NodeJS.ErrnoException.code = EACCES / ENOENT, AgentsUnstageFailureError, defensive textual fallback, permissive default).
- `tests/orchestrators/marketplace/update.test.ts` -- 4 new dispatch tests for `outcomeToCascadeRow` (typed reasons preferred over notes for skipped + failed; back-compat fallback exercised for both partitions).

## Decisions Made

- **PluginShapeError.reasons typed as `readonly string[]` (not `readonly Reason[]`):** The plan's `<interfaces>` block asserted `r.notes is readonly Reason[] on the ResolvedPluginNotInstallable variant` -- but inspection of `domain/resolver.ts` showed `r.notes` is declared as `Type.Array(Type.String())` and populated with free-form strings ("source dir does not exist", "contains hooks", "malformed mcpServers", "declares dependencies that must be installed manually", etc.). The byte-equal `.message` contract requires those strings to flow through verbatim. The closed-set `Reason` narrowing happens at the renderer boundary in `classifyEntityShapeError` (mirrors the legacy `narrowNotInstallableReasons` logic, but now reads structural `err.reasons` instead of re-parsing the message). Documented in deviation below.
- **`PluginUpdateOutcome.notes` retained:** The cause-chain trailer composition path (`composeErrorWithCauseChain`) requires the free-text blob; consumers should never read `notes` for classification (now blocked by preferring `.reasons`). A future cleanup task can delete `notes` once every consumer reads `Error.cause` directly via `notifyError`.
- **reinstall.ts left unchanged:** The audit showed its catch sites already handle the new `PluginShapeError` via the existing substring fallback in `narrowReason` -- the byte-equal `.message` text means the `not in manifest` mapping (the documented permissive default) still applies. No code change needed; documented here.
- **Test seam re-exports under `__test_*` alias:** Mirrors the `__test_outcomeToCascadeRow` precedent in `reinstall.ts`. Keeps the production API surface narrow (helpers stay private) while letting tests exercise the dispatch branches directly without architectural disturbance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Bug in plan spec] `PluginShapeError.reasons` typed as `readonly string[]`, not `readonly Reason[]`**

- **Found during:** Task 1 (before any code change)
- **Issue:** The plan's `<interfaces>` block at lines 148-159 stated:
  > "Note: `r.notes` is `readonly Reason[]` on the `ResolvedPluginNotInstallable` variant, so the typed reasons array is ALREADY available; the throw site just needs to pass it through instead of `join("; ")`-ing it."
  Inspection of `domain/resolver.ts` showed this premise was incorrect: `r.notes` is declared as `Type.Array(Type.String())` (line 65 of resolver.ts) and is populated with free-form strings like `"source dir does not exist"`, `"contains hooks"`, `"malformed mcpServers: <err>"`, `"declares dependencies that must be installed manually"`, `"component declarations conflict: manifest declares ..."`, etc. None of these are members of the closed `Reason` set in `shared/grammar/reasons.ts`.
- **Fix:** Typed `PluginShapeError.reasons: readonly string[]` on the (not-)installable kinds. Preserves the byte-equal `.message` contract (the resolver's free-form notes are joined verbatim into the message text). The closed-set `Reason` narrowing is performed at the renderer boundary in `classifyEntityShapeError` via the `narrowResolverReasons` helper (which mirrors the legacy `narrowNotInstallableReasons` logic but reads `err.reasons` directly, no message parse).
- **Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`, `extensions/pi-claude-marketplace/domain/resolver.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- **Verification:** Existing `tests/domain/resolver-strict.test.ts:346-368` assertions (`err.message.includes("source dir does not exist")`) stay green unchanged because the resolver's raw notes flow through verbatim. The PI-4 test at `tests/orchestrators/plugin/install.test.ts:401-404` still produces `⊘ hello@mp [project] (unavailable) {unsupported source}` because `narrowResolverReasons` maps the `"source"` substring to the closed `"unsupported source"` Reason at the catch site.
- **Committed in:** `ab1a937` (Task 1)

**2. [Rule 2 -- Plan completeness] Added test-seam re-exports for catch-site helpers**

- **Found during:** Task 2 (adding the discriminated-dispatch tests)
- **Issue:** The plan's Task 2 Step 6 calls for "2 NEW tests asserting `classifyEntityShapeError`'s and `classifyInstallFailure`'s typed dispatch" plus 1 test for `narrowCascadeFailure` and 1 test for `outcomeToCascadeRow` -- but these helpers are all private (non-exported) functions. The plan acknowledged this for `narrowCascadeFailure` with "Skip the test entirely if `narrowCascadeFailure` is not exported" but the architectural precedent at `reinstall.ts` (the `__test_outcomeToCascadeRow` re-export) shows a cleaner pattern.
- **Fix:** Added `__test_classifyEntityShapeError`, `__test_classifyInstallFailure`, `__test_narrowCascadeFailure`, and `__test_outcomeToCascadeRow` (marketplace/update.ts) re-exports following the existing `__test_*` precedent. The production API surface stays narrow; tests get a direct exercise surface for the dispatch branches without architectural disturbance.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
- **Verification:** All 16 new dispatch tests pass; no other test file is affected by the new exports.
- **Committed in:** `da04709` (Task 2)

**3. [Rule 2 -- Plan completeness] Cascade-row consumer in `plugin/update.ts::outcomeToCascadeRow` also prefers `outcome.reasons` over `narrowSkipReasons`/`narrowFailReasons`**

- **Found during:** Task 2 (after migrating the marketplace/update.ts consumer, found the plugin/update.ts direct-update consumer had the same notes-parsing pattern)
- **Issue:** The plan focused on `marketplace/update.ts::outcomeToCascadeRow` for the consumer migration but the analogous direct-update consumer at `plugin/update.ts::outcomeToCascadeRow` (line ~894+) also reads `outcome.notes` via local `narrowSkipReasons`/`narrowFailReasons` helpers. With Task 1's producer migration populating `outcome.reasons`, this consumer should also prefer the typed array.
- **Fix:** Changed `reasons: narrowSkipReasons(outcome.notes)` to `reasons: outcome.reasons ?? narrowSkipReasons(outcome.notes)` (same pattern for failed partition). The hasPhaseFailures short-circuit for `"rollback partial"` still takes precedence.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Verification:** Existing PUP-4 tests stay green (`tests/orchestrators/plugin/update.test.ts:332` `(skipped) {no longer installable}` assertion).
- **Committed in:** `da04709` (Task 2)

## SonarCloud S5852 Resolution

The `/is not installable:\s*(.+)$/` regex at the legacy `install.ts:902` site is **DELETED**. Verification:

```
$ grep -rn 'is not installable:\\s' extensions/pi-claude-marketplace/orchestrators/
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:885:  // SonarCloud S5852 ReDoS regex (`/is not installable:\s*(.+)$/`).
```

The only remaining match is a comment line referencing the deletion. The runtime regex is gone; the typed dispatch path replaces it.

## REASONS Set Audit

No new REASONS member was introduced. The `permission denied` and `source missing` Reasons used in `narrowCascadeFailure` were already members of the closed set (added in Phase 13 Wave 3 plan 13-03-01 per the catalog UAT precedent). The drift guard at `tests/architecture/grammar-frontmatter.test.ts` stays green.

## PluginUpdateOutcome.notes Retention Rationale

`PluginUpdateOutcome.notes` is **retained** alongside the new `.reasons` field. Rationale:

- The cascade producer at `plugin/update.ts::updateSinglePlugin` (line ~290) composes the cause-chain trailer text via `composeErrorWithCauseChain(err)` and stores it in `notes`. The marketplace cascade renderer or notifyError path may surface this text trailer to the user.
- Test fixtures in `tests/orchestrators/marketplace/update.test.ts` construct `PluginUpdateOutcome` shapes with notes-only outcomes (e.g., the `narrowSkipReason fallback` test at line 461). Removing `notes` would break them.
- The cascade consumer (`marketplace/update.ts::outcomeToCascadeRow`) now PREFERS `reasons` over `notes` for classification; the legacy notes parse fires only when `reasons` is undefined.

A future cleanup task can:
1. Migrate every test fixture in `update.test.ts` to populate `reasons` instead of `notes`.
2. Confirm no consumer reads `notes` for classification (only for cause-chain trailer composition).
3. Delete the notes-fallback branches in `narrowSkipReason` / `narrowFailReason` / `narrowSkipReasons` / `narrowFailReasons`.
4. Consider whether to remove `notes` from the `PluginUpdateOutcome` contract entirely once the trailer composition can read `Error.cause` directly via `notifyError` (D-CMC-12 auto-trailer).

## reinstall.ts Audit Finding

`orchestrators/plugin/reinstall.ts` was audited per the plan's Task 2 Step 3. Finding:

- Its `narrowReason` function (line 671-712) does **not** match the legacy `"is not installable"` substring -- it uses exact-match prefixes (`"not installed"`, `"not in manifest"`, etc.) and a `"rollback"` substring fallback.
- The new `PluginShapeError.message` text (`'Plugin "X" is not installable: ...'` or `'Plugin "X" is no longer installable: ...'`) flows through `composeErrorWithCauseChain(err)` into `outcome.notes` -- but `narrowReason` doesn't recognize this text and falls through to the documented permissive default `"not in manifest"`.
- This is **byte-equal** to the pre-quick-task behavior: the legacy `new Error("Plugin "X" is not installable: ...")` also didn't match any `narrowReason` substring branch and produced `"not in manifest"`.

**Conclusion:** No code change needed in `reinstall.ts`. The structural `failureClass: "manual-recovery"` tag for the `ManualRecoveryError` path is the existing CMC-16 typed-dispatch precedent and continues to work. A future enhancement could add a `PluginShapeError`-aware branch to `narrowReason` to produce `"no longer installable"` directly, but it's not part of this quick task's scope.

## Self-Check: PASSED

Verification of claimed artifacts:

- `extensions/pi-claude-marketplace/shared/errors.ts::PluginShapeError` -- FOUND (line ~334-393)
- `extensions/pi-claude-marketplace/orchestrators/types.ts::PluginUpdateOutcome.reasons` -- FOUND
- Commit `ab1a937` (refactor: define PluginShapeError + migrate throw sites) -- FOUND in `git log --all`
- Commit `da04709` (refactor: migrate catch sites to typed dispatch) -- FOUND in `git log --all`
- S5852 regex deleted -- VERIFIED (only comment-line match remains)
- 1276/1276 tests green (`npm run check` clean) -- VERIFIED
