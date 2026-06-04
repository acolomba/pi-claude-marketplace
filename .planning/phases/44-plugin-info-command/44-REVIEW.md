---
phase: 44-plugin-info-command
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/index.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/router.test.ts
  - docs/output-catalog.md
  - tests/architecture/catalog-uat.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: fixes_applied
fix_commit: 1debb76
fix_status:
  WR-01: fixed
  WR-02: fixed
  WR-03: deferred
  IN-01: deferred
  IN-02: deferred
  IN-03: deferred
  IN-04: deferred
---

# Phase 44: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** deep
**Files Reviewed:** 17 (15 in Wave 1 + 2 in Wave 2)
**Status:** issues_found (no blockers; 3 warnings + 4 info)

## Summary

Adversarial review of `c3ecc53` (Wave 1: production surface) and `c4a5f0d`
(Wave 2: catalog + UAT). All eleven review-focus areas check out and the
contract-critical guarantees hold:

1. **INFO-02 + INFO-05 end-to-end.** The `getPluginInfo` orchestrator
   projects local state + on-disk manifest resolution into the Phase 42
   `PluginInfoMessage` / new `PluginInfoCascadeMessage` shapes; the
   shim + router wire the surface; 9 catalog states cover every
   reachable byte form.
2. **Byte-equality carry-forward.** The `git diff c3ecc53^..c3ecc53 --
   extensions/pi-claude-marketplace/shared/notify.ts` confirms the
   forbidden function list (`composeMarketplaceBlock`, `renderMpHeader`,
   `renderPluginRow`, `composePluginLines`, `joinTokens`,
   `composeReasons`, `renderMarketplaceInfo`, `composeMpInfoHeader`,
   `renderMarketplaceInfoCascade`, `renderPluginInfo`, `wrapDescription`,
   `pluginInfoStatusGlyph`, `appendResolvedComponentLines`) is bodied
   unchanged. Only ADDITIONS / dispatcher widening / short-circuit
   predicate extensions. The new variant composes via REUSE of
   `renderPluginInfo` per the contract.
3. **NFR-5 enforcement.** Two grep-gates: (a) an in-file
   comment-stripped grep in `tests/orchestrators/plugin/info.test.ts`
   ("NFR-5: info.ts has zero imports from platform/git, ...");
   (b) the extension to `tests/architecture/no-orchestrator-network.test.ts`
   adding BOTH `orchestrators/plugin/info.ts` AND
   `orchestrators/marketplace/info.ts` to the FORBIDDEN_TARGETS list.
   Both gates use `stripComments` so the documenting header doesn't
   false-positive. Either gate alone would fail on regression.
4. **Rule-3 deviation #1 (failed rows use `componentsResolved: true`).**
   Traced through `renderPluginInfo` (notify.ts:2007-2072). The carve-out
   predicate (lines 2018-2031) demands `reasons === ["not added"]` to
   emit the bare row. Every OTHER failed-row path (`{not in manifest}`
   / `{unreadable}`) goes through the standard body that runs the
   `switch (plugin.componentsResolved)` UNCONDITIONALLY (line 2058).
   The orchestrator's choice to emit `componentsResolved: true` with
   `components: {}` for these non-carve-out failed rows correctly
   suppresses the `components: not resolved` marker -- INFO-05
   semantics are preserved (marker fires only for installed/available
   external sources where discovery is genuinely deferred).
5. **Rule-3 deviation #4 (destructure pattern).** The new branch shape
   (`const [sole, ...rest] = found; if (sole !== undefined &&
   rest.length === 0) { ... }`) eliminates Phase 43's WR-02 fall-through
   hazard: when `found.length === 1`, `[sole]` is defined and `rest`
   is empty, and execution hits `return`. When `found.length === 2`,
   the predicate is false and execution falls through to the fan-out
   branch. There is no ambiguous "guard failed -> wrong variant" path.
6. **Rule-3 deviation #5 (assertNever on ParsedSource).** Verified at
   `info.ts:139-153`: switch arms cover `path | github | url |
   git-subdir | npm | unknown`; default calls `assertNever(src)`. A
   hypothetical 7th `ParsedSource.kind` would compile-error here
   because TS would narrow `src` to the new kind (NOT `never`) at the
   default arm.
7. **TC-6 "info" mode.** `getInfoPluginToMarketplacesMap` walks BOTH
   scopes' marketplaces and YIELDS every row with NO `row.status`
   filter (no install-state exclusion). The function signature does
   NOT accept `explicitScope` -- the scope filter intentionally does
   not narrow the candidate set, deferring scope-mismatch handling to
   the orchestrator's INFO-04 carve-out.
8. **Atomic commit footprint.** Wave 1 = 15 files in ONE commit; Wave
   2 = 2 files in ONE commit. No scope creep observed.
9. **Test discipline.** No pre-existing tests deleted or weakened. The
   "Rule 1" updates in `provider.test.ts` (adding `"info"` to the TC-1
   keyword set) and `router.test.ts` (adding `pluginInfo:
   mk("pluginInfo")` to the makeHandlers factory) are symmetric
   extensions forced by the type-side additions; both ADD assertions
   rather than removing them.
10. **IL-2 single-site discipline.** All four code paths through
    `getPluginInfo` (`{not added}` carve-out, single-block, two-block
    fan-out) make exactly ONE `notify(opts.ctx, opts.pi, ...)` call.
    The handler shim never bypasses through direct `ctx.ui.notify`.
11. **5-arm exhaustiveness.** `dispatchInfoMessage`'s switch (notify.ts:
    2116-2132) covers all four info kinds + `assertNever` default; the
    top-level `notify()` dispatcher (lines 2192-2200) preserves the
    `assertNever` after narrowing to `CascadeNotificationMessage`. The
    `_l10b` proof in `notify-types.test.ts` locks the union arity at
    compile time.

Findings below are quality-tier (3 warnings + 4 info); none gate
shipping. WR-01 is the most interesting: the silent-swallow of
`resolveStrict` throws in `buildInstalledRow` discards information
that `list.ts`'s `narrowProbeError` would have surfaced, regressing
the post-Phase-29 / UXG-08 contract for that one code path.

## Warnings

### WR-01: `buildInstalledRow` silently swallows `resolveStrict` throws and `installable: false`, regressing the post-Phase-29 narrowProbeError discipline

**fix_status:** fixed (commit `1debb76`)
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:447-484`
**Issue:** When an INSTALLED plugin's `resolveStrict` returns
`installable: false` (lines 466-472) or THROWS (lines 473-484), the
orchestrator unconditionally emits `componentsResolved: false` with
NO `reasons` field. The renderer then emits
`components: not resolved` -- but provides no signal to the user
about WHY the components are missing. The sibling `list.ts:299-316`
`narrowProbeError` ladder maps `EACCES → permission denied`,
`ENOENT → source missing`, `SyntaxError → unparseable`, other →
`unreadable` -- explicitly to STOP hiding real failure causes (per
the `narrowProbeError` JSDoc: "This replaces the previous behavior of
substring-matching every caught error through `narrowResolverNotes`
-- which only recognises `hooks` / `lspServers` and silently degraded
EVERY OTHER throw to `{unsupported source}`, hiding real failure
causes from the user."). The info surface re-introduces the
information-hiding pattern that list explicitly fixed: a user running
`/claude:plugin info foo@mp --scope user` against an installed-but-
corrupted plugin learns the components are "not resolved" but has no
idea whether it's a permission issue, a missing source, an
unparseable plugin.json, or an external-source kind that
deliberately defers resolution. The two cases (deliberate INFO-05
defer vs. probe failure on a path-source installed plugin) currently
render IDENTICALLY. This contradicts the file header comment's claim
that the marker is "reserved for external-source `(installed)` /
`(available)` rows" -- in practice it ALSO fires on path-source
probe failures.

Note: this is a CORRECTNESS issue (user-facing semantics), not a
crash. The handler still returns successfully and the renderer still
emits valid bytes -- the user just loses diagnostic information that
`list` provides.

**Fix:** Surface the probe-failure reason on `(installed)` rows by
adopting the `narrowProbeError` pattern from `list.ts`. Two paths:
(a) keep `status: "installed"` but add a `reasons: [<narrowed>]`
field that the renderer composes into the row brace `(installed)
{unreadable}` -- requires no shape changes since `PluginInfoRowBase`
already carries `reasons?: readonly Reason[]`; (b) demote the row to
`status: "failed"` with reasons (e.g. `["unreadable"]`) when the
probe throws on a recorded-as-installed plugin. Either keeps the user
informed of the disagreement between persistence and disk. The
`!resolved.installable` case (line 466) should at minimum forward
`narrowResolverNotes(resolved.notes)` as `reasons`. Recommend also
re-importing the `narrowProbeError` shared core from `list.ts`
(extract to `shared/`) so both surfaces stay in lockstep.

### WR-02: `buildNotInstalledRow` hardcodes `reasons: ["unreadable"]` on probe-throw without `narrowProbeError` ladder

**fix_status:** fixed (commit `1debb76`)
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:502-517`
**Issue:** Companion to WR-01. The not-installed code path catches a
`resolveStrict` throw (line 505) and emits a single hardcoded reason
`"unreadable"`. The comment claims this "mirrors
`orchestrators/plugin/list.ts::narrowProbeError` semantics" -- it does
not. `narrowProbeError` distinguishes `permission denied` /
`source missing` / `unparseable` / `unreadable` (list.ts:299-316).
Hardcoding `"unreadable"` flattens that distinction for the info
surface. A `EACCES` on a marketplace dir will render
`{unreadable}` here but `{permission denied}` on `plugin list` -- two
read-only surfaces over the same persistence layer producing
DIFFERENT user-facing reasons for the same underlying failure.

**Fix:** Import the `narrowProbeError` helper from `list.ts` (or
extract to `shared/probe-errors.ts` if the cross-orchestrator import
is undesirable per `shared/` layering) and call
`narrowProbeError(err)` in place of the hardcoded `"unreadable"`:
```ts
} catch (err) {
  const reason = narrowProbeError(err);
  return {
    status: "unavailable",
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    reasons: [reason],
    componentsResolved: false,
  };
}
```

### WR-03: `nameFromEntry` cannot distinguish a real Pi skill (subdirectory with `SKILL.md`) from a noise subdirectory; info surface may surface garbage names

**fix_status:** deferred -- non-blocking; surfaces only non-skill subdirs as skills, byte-form remains valid; full SKILL.md discovery is a v1.9 plugin-schema task.
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:185-195`
**Issue:** `nameFromEntry` for `kind === "skills"` returns the bare
subdirectory name without checking for a `SKILL.md` file inside. The
JSDoc justifies this as "the info surface displays the authoring
intent; the bridges' filtering only affects install-time staging" --
but the catalog states (e.g. `installed-single-scope`:
`skills: commit-summary`) imply the rendered name represents a real
Pi skill. If a plugin author adds an `assets/`, `examples/`, or
`fixtures/` subdirectory under `skills/`, those names will appear
in the rendered output as if they were skills -- visually
indistinguishable from real `SKILL.md`-bearing subdirectories. For a
read-only inspection surface this is a UX/quality issue: the user
asks "what does this plugin install?" and gets a list that
overstates the answer. The bridge layer's `isSkillDir` predicate
EXISTS precisely for this distinction and the orchestrator could
reuse it without violating the layering rules (the bridges live in
`bridges/`, not `platform/`, so `orchestrators/` can import). The
similar concern applies to commands/agents (any `.md` file is
counted, including potential README.md / NOTES.md sitting in those
dirs).

Note: this is a quality concern, not a correctness bug. The choice
to surface "authoring intent" is documented and consistent. Flagged
because the catalog narrative (and the bridge contract) treat skill
names as load-bearing artifacts.

**Fix:** Either (a) gate skills by `SKILL.md` existence: extend
`nameFromEntry` to accept the parent directory path so it can probe
`<parent>/<entry.name>/SKILL.md` via `statKindOf`; or (b) lock the
"authoring intent" choice with an explicit catalog state that shows
a plugin with `skills/README.md` rendered as a "skill" so the
ambiguity is named in the user contract rather than implicit. Option
(a) preserves the documented INFO-02 byte form; option (b) prevents
contributors from "fixing" what is currently a deliberate design
choice.

## Info

### IN-01: `getInfoPluginToMarketplacesMap` is called from a branch with `options.targetScope` available, but discards it -- the signature mismatch is silent

**fix_status:** deferred -- INFO-tier maintainability concern; current behavior is correct (the scope filter MUST NOT narrow the candidate set per the TC-6 contract). Recommended renames or `_unused`-prefixed signature parameter are purely cosmetic.
**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:354-373` and `386-388`
**Issue:** The provider's `pluginRefBranchConfig` (provider.ts:206-222)
DOES include `targetScope` in the returned config when `explicitScope
!== undefined`. The dispatcher then passes the config through to
`getPluginToMarketplacesMap`, which at line 386-388 routes to
`getInfoPluginToMarketplacesMap(resolver)` -- silently dropping the
`targetScope` field. This is by design (the comment at lines
345-352 explicitly says the filter MUST NOT narrow the candidate
set), but the function signature gives no type-level signal of the
intent. A future contributor narrowing the function to accept
`targetScope?` and forgetting to ignore it would silently break the
TC-6 contract. The other two helpers in this file
(`getInstalledPluginToMarketplacesMap` and
`getInstallPluginToMarketplacesMap`) BOTH accept and use
`explicitScope` / `targetScope`; the info variant is the lone
exception.

**Fix:** No code change required if the contract is treated as
load-bearing. Optionally either (a) accept `_explicitScope?: Scope`
in the signature with a leading underscore + a brief comment that
the parameter is intentionally unused, OR (b) add a `_options:
PluginMapOptions` parameter that is unpacked but not consumed, to
make the discarded-parameter intent explicit at the type level. The
current implementation works correctly; the concern is purely
maintainability.

### IN-02: INFO-04 carve-out `marketplaceScope: opts.scope ?? "user"` carries the same "placeholder relies on renderer carve-out staying invariant" hazard called out in Phase 43 IN-02 -- now duplicated across two orchestrators

**fix_status:** deferred -- INFO-tier structural-protection suggestion; renderer predicate ordering is currently correct (verified in review focus area #4). Recommended notify-v2 test addition is a follow-up hardening task, not a contract bug.
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:597-600`
**Issue:** Plugin-info's `{not added}` carve-out emits
`marketplaceScope: opts.scope ?? "user"` as an "arbitrary value;
never rendered" placeholder, matching the same pattern flagged in
Phase 43 IN-02 in `marketplace/info.ts:170-175`. The same hazard
applies: the renderer's `INFO-04 carve-out` predicate at
`renderPluginInfo:2018-2031` early-returns BEFORE the standard path
touches `marketplaceScope` -- but a future renderer change that adds
an arm consuming `marketplaceScope` before the carve-out check would
leak the placeholder value into the output. The Phase 43 IN-02
remediation suggestion ("add a notify-v2 test that varies
`marketplaceScope` across `user`/`project` for an INFO-04 `{not
added}` payload and asserts the rendered output is byte-identical")
was NOT acted on in Phase 43, so Phase 44 carries forward the same
unprotected contract surface across two orchestrators now.

**Fix:** No code change strictly required (the renderer's predicate
ordering is currently correct), but the structural protection would
be cheap: add a single notify-v2 test that constructs the `{not
added}` payload twice -- once with `marketplaceScope: "user"`, once
with `marketplaceScope: "project"` -- and asserts byte-identical
output. This locks the renderer's "doesn't touch the placeholder"
invariant for both orchestrators in one assertion.

### IN-03: `installablePluginDirs` is not actually consumed by `seedPathMarketplace` in some test cases (b/c) -- the dirs are created but never referenced for component discovery; coverage gap on the implicit-by-convention `resolveStrict` path

**fix_status:** deferred -- INFO-tier coverage gap; the missing "installed with completely empty component dirs" fixture is a quality nicety, not a correctness gap. Existing tests already cover `componentsResolved: true` with non-empty components AND the `componentsResolved: false` marker arm.
**File:** `tests/orchestrators/plugin/info.test.ts:113-183, 260-265, 304-321`
**Issue:** The test helper creates `installablePluginDirs: ["bar"]`
or `["legacy"]` -- a directory tree under `mpRoot/<dir>` -- so
`resolveStrict`'s `statKindOf` probe can find the plugin source.
But for tests (b) `available` and (c) `unavailable`, the plugin dir
exists but no subdirectories or `.md` files were seeded under it
(except for (b) which has `componentDirs: { bar: ["skills/s1"] }`).
The `unavailable` test (c) intentionally omits component dirs
because the `hooks` field makes the plugin uninstallable before
component-discovery matters. This is fine, BUT no test exercises
the case where a path-source plugin is INSTALLABLE with COMPLETELY
EMPTY component dirs -- i.e. `componentsResolved: true,
components: {}` (which the renderer renders as just the row +
description with NO per-kind lines and NO `components: not resolved`
marker). The catalog state matrix also doesn't have a fixture for
this "installed but no components declared" case. Minor coverage
gap.

**Fix:** Add an orchestrator test seeding a path-source plugin with
zero component dirs but a valid plugin.json (or omitted plugin.json)
that resolves as installable. Assert the rendered body is just the
marketplace header + plugin row + optional description -- NO
component lines, NO marker. Optionally add a matching
`installed-zero-components` catalog state for completeness.

### IN-04: `buildBlock` uses awaited `resolveStrict` inside `buildInstalledRow` and `buildNotInstalledRow` in serial across the fan-out path, but `getPluginInfo` parallelizes the per-scope blocks via `Promise.all`

**fix_status:** deferred -- INFO-tier performance/symmetry concern explicitly flagged as out-of-v1-scope per the review charter. Behavior is correct.
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:631-633` (vs. internal serial awaits)
**Issue:** The fan-out path calls `Promise.all(found.map((f) =>
buildBlock(...)))` -- parallelizing the two scopes -- but each
`buildBlock` then runs sequential awaits (`loadMarketplaceManifest`,
`resolveStrict`, `composeResolvedComponents` which itself awaits
three `discoverComponentNames` calls in sequence at lines 280-286).
For info this is acceptable performance-wise (small fan-out, local
FS), but the asymmetry (parallel at one layer, serial at the next)
is worth a quick note. The three `discoverComponentNames` awaits at
`composeResolvedComponents:280-287` could trivially be
`Promise.all`-ed; the cost of the current shape is minimal but the
inconsistency is a maintainability flag. Performance issues are
explicitly out of v1 scope per the review charter, so this is
recorded as info only -- no fix required.

**Fix:** No change required. If revisited later, parallelize the
three `discoverComponentNames` calls inside
`composeResolvedComponents` via `Promise.all` for symmetry with the
outer `getPluginInfo` fan-out parallelization.

---

## Review Focus Coverage

| # | Focus area                                                                | Result |
|---|---------------------------------------------------------------------------|--------|
| 1 | Correctness (INFO-02 + INFO-05 end-to-end; 9 catalog states present)      | PASS   |
| 2 | Byte-equality carry-forward (notify.ts diff confirms forbidden list)      | PASS   |
| 3 | NFR-5 enforcement (both grep-gates exist + fire on regression)            | PASS   |
| 4 | Rule-3 dev #1 (failed rows + componentsResolved:true preserves INFO-05)   | PASS   |
| 5 | Rule-3 dev #4 (destructure pattern eliminates Phase 43 WR-02 hazard)      | PASS   |
| 6 | Rule-3 dev #5 (assertNever on ParsedSource; 7th kind fails typecheck)     | PASS   |
| 7 | TC-6 "info" mode (no status filter, no scope narrowing)                   | PASS   |
| 8 | Atomic commit footprint (Wave 1 ONE commit, Wave 2 ONE commit)            | PASS   |
| 9 | Test discipline (no deletions; Rule 1 updates symmetric)                  | PASS   |
| 10 | Output channel IL-2 (single notify() per invocation)                     | PASS   |
| 11 | 5-arm union exhaustiveness (assertNever in dispatcher + dispatchInfo)    | PASS   |

---

## Notes on Phase 43 Findings Carry-Forward

Phase 43 review findings cross-checked against Phase 44 implementation:

- **Phase 43 WR-01** (stale forward-compat comment in `marketplace/info.ts`):
  Phase 44 file header in `plugin/info.ts` enumerates ALL six
  `ParsedSource.kind` values explicitly with their resolved-vs-unresolved
  mapping. WR-01 hazard avoided for the new file.
- **Phase 43 WR-02** (silent fall-through in `found.length === 1`):
  Phase 44 uses the destructure pattern (`const [sole, ...rest] = found`)
  explicitly to eliminate this hazard. Verified.
- **Phase 43 IN-01** (loose `as` cast losing ParsedSource narrowing):
  Phase 44's `isLocallyResolvable` uses a typed `switch (src.kind)`
  over `ParsedSource` with `assertNever` exhaustiveness. Verified.
- **Phase 43 IN-02** (placeholder relies on renderer carve-out invariant):
  Phase 44 carries the SAME pattern forward (IN-02 in this review)
  without acting on Phase 43's optional test-strengthening suggestion.
  Hazard is duplicated across two orchestrators now.
- **Phase 43 IN-04** (Wave 1 commit included an unexpected test file):
  Phase 44 Plan 44-01's `files_modified` pre-listed
  `tests/edge/router.test.ts` proactively. Lesson learned.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
