---
phase: 08-enablement-parity-for-dependencies
reviewed: 2026-09-22T01:21:57Z
depth: standard
iteration: 4
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - docs/dependency-resolution.md
  - docs/plugin-enablement.md
  - scripts/check-unused-type-members.contracts.json
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
findings:
  critical: 0
  warning: 1
  info: 9
  total: 10
status: issues_found
---

# Phase 08: Code Review Report (iteration 4, narrow re-review)

**Reviewed:** 2026-09-22T01:21:57Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Narrow re-review of the one seam that regressed across iterations 1-3 (the install cascade's re-enable closure), at HEAD `ea686608`, diff base `3a0bd2c2` (three commits: `e9c12cd4` restructure, `1de413eb` comments, `ea686608` docs). Every claim below was re-derived from the current `install-cascade.ts` against `domain/dependency-closure.ts`'s walk (`walkDependencyEdge` guard chain, `recordEdge` before every guard, `visited` memo, post-order `ctx.order`), not from the fix report. `install-flow.test.ts` and `enable-disable.test.ts` are unchanged in this range; `enable-disable.ts`, `shared.ts` and `install-cascade.messaging.ts` changed in comments only.

The restructure resolves CR-08 and WR-12 correctly, and the seam is now structurally simpler than any of the three previous shapes: the OUTER `resolveDependencyClosure` receives `liveInstalledKeys(state, options.installedKeys)` (`install-cascade.ts:747-761`, `:1123`), so a disabled record is walked like a never-installed one; `resolveMemberConstraints` (`:837-862`) partitions the single post-ordered closure by `disabledRecordOf` (`:724-735`) into exactly one `install` or `re-enable` phase per member; `checkRecordedMembers` (`:811-825`) runs RESV-05 over the walk's `alreadyInstalled` (enabled hits) and every disabled closure member before any tag query. No synthetic key, no second walk, no discovery/fold split and no `asserts` on a caller-supplied record survive; the only remaining assertion (`assertReEnableLedgerInstalled`, `:968-972`) narrows on the marketplace slot the partition read the record from, which a member's ledger never removes.

The seven items the orchestrator asked me to verify:

1. **CR-08, both graphs.** `foo -> bar`, `bar -> {baz, qux}` (bar/baz disabled, qux never installed): the walk yields `closure = [baz, qux, bar, foo]`; the partition tags `baz` re-enable (record), `qux` install (pin), `bar` re-enable, `foo` install. The diamond `foo -> {bar, qux}` adds a second `recordEdge` on `qux` that the memo short-circuits, so `qux` stays one member with `requiredBy: bar` (first reach). One phase per member, correct kind, post-order, no `undefined.version` dereference possible because `buildReEnableMemberPhase` now takes `record` as a parameter (`:1008`) and the partition is the only producer. `CascadeMemberOutcome.requiredBy` can only carry a real walk key. The two new tests (`install-cascade.test.ts:2091`, `:2133`) assert the whole `{key, reEnabledFromRecord, requiredBy}` list via `memberOrigins`, which is the discriminating assertion the iteration-3 finding asked for.
2. **WR-12.** A transitively reached disabled member lands in `closure` with `ranges` merged by `recordEdge` across every declaring branch (it runs before the `installedKeys` guard and on memo hits alike), so `checkRecordedMembers`'s `disabled` filter feeds `checkInstalledMember` the full intersection; the enabled members a disabled member declares a range on now land in the OUTER walk's `alreadyInstalled` rather than a discarded `sub.alreadyInstalled`. Tests at `:2175` (`installed-unsatisfied` with `range: ">=1.0.0 <2.0.0-0"`, footprint unchanged) and `:2216` (disabled range diamond -> `contradictory-declarations` on `qux`) discriminate both.
3. **WR-11(a) and the N=1 freeze.** A recorded ENABLED key stays in `live`, so `walkDependencyEdge` returns at `dependency-closure.ts:369` before its marketplace or catalog is read; the WR-11(a) test (`:1959`) still records `qux` unqueried. For a closure with no disabled record, `liveInstalledKeys` is a copy of `installedKeys`, `checkRecordedMembers` iterates exactly the old `alreadyInstalled`, every member takes the `install` arm through the unchanged `resolveOneMember`, and `alreadyInstalled` is projected from the same list `leftAlone` used to equal. The single-plugin block is byte-frozen by construction and by the surviving `:2692` case.
4. **The 9 `[bar]: []` fixtures.** Those tests previously omitted `bar`'s catalog entry because the old guard chain never looked a disabled member up; none of them asserted that non-lookup (no lookup spy exists in any of the nine), so adding the entry weakens nothing they prove. The CR-07 case (`:1908`) keeps its `not-found` assertion with `requiredBy: foo`, and the new `:2255` case pins the same failure one level down (`requiredBy: bar`).
5. **`install-flow.ts` consumption.** `writeReEnabledCascadeMemberConfigEntries` (`:963-975`) filters `reEnabledFromRecord` over the whole `installed.members`, so transitively re-enabled members reach `overwriteDisabledMemberEntries`; `hydrateInstalledHooks` (`:1698-1705`) hydrates every member outcome; `collectInstalledKeys` (`:460`) and `collectInstallReachableMarketplaces` (`shared.ts:454-470`) guarantee a recorded member's marketplace is always in `knownMarketplaces`, so a disabled member can never hit the `marketplace-not-added` guard the old skip used to shield it from; `lookupCascadeDependencies` (`:487-513`) reads through `readDependencyDeclaration`, which is fs-only and falls back to the marketplace entry when the plugin's own (off-disk) manifest is absent, so the catalog read on a disabled record cannot throw.
6. **WR-13/WR-15 and WR-14.** The six WR-13 sites now state present facts; the orphaned block and both consecutive-JSDoc sites are gone with the functions they described. The docs describe what the code does, including the fixer's stance below. One residue remains: see WR-16.
7. **contracts.json.** The three pins for deleted types are dropped; `471:60`, `501:50` and `956:61` resolve to the `readonly ok` / `readonly kind` members they claim (column-checked against the current lines); the `enable-disable.ts` pins are shifted by the -4 hunk delta of `1de413eb`.

**On the fixer's stated deviation** (a disabled dependency absent from its own manifest is `not-found`, not root-exempt): the stance is correct. `enableCascadeLookup` (`enable-disable.ts:534-560`) already fails closed on every non-root member whose manifest entry is absent (`EnableRefusedError("unreadable")`), exempting only the ROOT; re-materializing such a record would fail in the ledger's own PI-3 lookup anyway; and the uniform guard is what lets one walk own every member's `requiredBy`. It is documented in `dependency-resolution.md:112` and `:238` and pinned by two tests. A sub-walk with root exemption would have tolerated a member the ledger then refuses, which is the worse outcome.

Status is `issues_found` on one Warning only: two comments the restructure left describing the previous cascade. The code is correct; nothing Critical remains.

## Verdicts on iteration-3 findings

| ID | Verdict |
| --- | --- |
| CR-08 | resolved -- one walk, one phase per member, `record` is a parameter of `buildReEnableMemberPhase`, no synthetic key exists; both graphs pinned at `install-cascade.test.ts:2091` and `:2133` |
| WR-12 | resolved -- `checkRecordedMembers` covers enabled hits and disabled closure members; ranges merge in `recordEdge` across every branch; pinned at `:2175` and `:2216` |
| WR-13 | resolved for the six cited sites; one uncited site of the same class survives in the paired messaging test (WR-16) |
| WR-14 | resolved -- `dependency-resolution.md:112`, `:120`, `:238` and `plugin-enablement.md:40` describe the transitive re-enable, the never-installed-through-disabled install, the walk stopping at an enabled member, and the fail-closed failures; `:120` no longer contradicts `:112` |
| WR-15 | resolved by deletion -- every remaining JSDoc block in `install-cascade.ts` sits on the declaration it documents, with one pre-existing exception (IN-10) |
| IN-01 | still present (`enable-disable.ts:485`, `:936`, `:987`) |
| IN-02 | still present (`enable-disable.ts:451`, `:1392`) |
| IN-03 | still present (`install-cascade.test.ts:2692` "byte-identical to today") |
| IN-04 | still present (`enable-disable.ts:743`) |
| IN-05 | still present (`enable-disable.ts:503`) |
| IN-06 | partially resolved -- the false "post order" comment went with the short-circuit; `hydrateReEnabledMemberHooks` (`enable-disable.ts:1632`) / `hydrateInstalledHooks` (`install-flow.ts:357`) duplication remains |
| IN-07 | still present (`enable-disable.ts:713`) |
| IN-08 | still present (`install-flow.ts:1608-1631`) |

## Narrative Findings (AI reviewer)

## Warnings

### WR-16: Two comments still describe the cascade the restructure removed -- one names the deleted `partitionAlreadyInstalled`, one states an invariant `liveInstalledKeys` now falsifies

**File:** `tests/orchestrators/plugin/install-cascade.messaging.test.ts:227-229`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:454-459`
**Issue:** The fix report says the messaging SOURCE comment naming a removed symbol was rewritten (`install-cascade.messaging.ts:248-250`, confirmed), but the paired test's arrange comment still reads "`partitionAlreadyInstalled` never routes an enabled member here through the `installed` loop" -- a function that no longer exists anywhere in the tree (`grep partitionAlreadyInstalled` finds only this line). The `collectInstalledKeys` doc comment in `install-flow.ts` says "A dependency in this set is skipped by the closure walk and therefore never becomes a cascade phase, so nothing can reinstall it and no rollback can reach it." That is false for every disabled key in the set: `runInstallCascade` strips them via `liveInstalledKeys` before the walk, each becomes a `re-enable` phase, and `buildReEnableMemberPhase.undo` reaches it to put it back to disabled. Both are the WR-13 class (`skills/typescript-comments/SKILL.md`: a comment describes the code as it stands), and the second one sits on the exact input this iteration's seam reinterprets, so a reader of the caller is told the opposite of what the callee does. The messaging test is outside this iteration's file list; it is listed because it is residue of the reviewed restructure.
**Fix:** `install-cascade.messaging.test.ts:227-229` -> "`linter` is already installed and ENABLED -- the control for the re-enabled case above. An enabled record is a walk wall, so it reaches only this loop and the skip stays the single benign token." `install-flow.ts:454-459` -> "RESV-05: every `<plugin>@<marketplace>` key the target scope already records. The cascade keeps a recorded ENABLED key as a walk wall -- it never becomes a phase and no rollback reaches it -- and strips a recorded DISABLED key so the walk re-enables it as a member (EDEP-03, `liveInstalledKeys`)."

## Info

### IN-01: `EnableCascadeMember.record` is optional where the disposition already decides it (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:485`, `:936`, `:987`
**Fix:** Discriminated union `{ disposition: "re-enabled" | "already-enabled"; record } | { disposition: "not-installed" }`.

### IN-02: Names that no longer describe what the code does (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:451` (`EnableRefusedError` carries disable refusals), `:1392` (`readEnabledDependents` returns `void` and throws)
**Fix:** `EnableDisableRefusedError`; `assertNoEnabledDependents`.

### IN-03: Test structure drift in the messaging suite (unchanged)

**File:** `tests/orchestrators/plugin/enable-disable.messaging.test.ts:585`, `:680`; `tests/orchestrators/plugin/install-cascade.test.ts:2692` ("byte-identical to today")
**Fix:** One style per file; retitle to "a plugin that declares nothing composes the single-row block".

### IN-04: `unstageBackToDisabled` defends an arm the sibling branch narrows away (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:743`; `tests/orchestrators/plugin/enable-disable.test.ts:5698`
**Fix:** `throw outcome.cause` behind `isFailedUnstageOutcome`; delete the fallback test.

### IN-05: `isDeclarerAbsentFromManifest` discriminates on an error-message suffix (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:503`; `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:196-200`
**Fix:** A structured `kind` on `IndexFailure`.

### IN-06: One remaining helper duplication (partially resolved)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1632` vs `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:357`
**Issue:** The false "post order" comment is gone with the short-circuit it described. `hydrateReEnabledMemberHooks` and `hydrateInstalledHooks` still differ only in log prefix.
**Fix:** Parameterize `hydrateInstalledHooks` by log prefix and call it from both.

### IN-07: `EnableCascadeRun.root`'s comment still says the root phase is the ledger's last phase (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:713`
**Fix:** "set by `buildEnableRootPhase` once `materializeEnableRoot` completes".

### IN-08: The install cascade's config write-back still runs outside the ledger, after the members committed (unchanged)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1608-1631`
**Fix:** Mirror WR-08 -- a final `"config"` phase inside `runInstallCascade`'s ledger, or a catch around the two writes that runs the members' undos before rethrowing.

### IN-09: The D-04-07 promotion re-materializes a disabled dependency-provenance root alone, without the cascade that `enable <plugin>` and the install cascade now run

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:867-901` (`promoteDependencyRecord`), `:1005-1029` (`materializePromotedRecord`), `:1391-1415` (the promotion returns BEFORE `runInstallCascade`)
**Issue:** Outside this iteration's seam and predating the diff base; recorded because it is the phase's own parity theme. `install foo` on a record that is disabled with `provenance: "dependency"` takes the promotion arm: one `runInstallLedger` call over `foo` alone, then `tx.save()` and return. Its own disabled dependencies are never walked, so `foo` comes up with a dependency still down -- the state `enable foo` (EDEP-01 cascade) and a cascade-routed install (EDEP-03 walk) both close. The comment at `:856-857` says the promotion re-materializes "the way the enable branch re-materializes it", which was true before the enable branch grew a cascade. Whether the next reload's reconcile closes the gap is not traced here, so no user-visible harm is proven; listed as Info for that reason.
**Fix:** Either route the disabled-record promotion through `runInstallCascade` (with the promotion's provenance flip applied to the root's record before the walk) or state in the `:856` comment that the promotion deliberately re-materializes the root only and why.

### IN-10: `probeMemberPin`'s doc comment is orphaned above `toMemberConstraintOutcome`, which carries two consecutive JSDoc blocks (pre-existing, WR-15 class)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:575-590` (two back-to-back `/** */` blocks), `:627` (`probeMemberPin` has no doc comment)
**Issue:** Predates this phase (`git blame` -> `071d7ff1`, 2026-09-15). The block at `:575-582` ("Query a constrained member's release tags and turn the answer into a pin. The auth bundle is lifted from ...") describes `probeMemberPin` but sits above `toMemberConstraintOutcome`'s own block; tooling attaches only the second. Same shape WR-15 flagged and the restructure fixed elsewhere in this file.
**Fix:** Move the `:575-582` block down to sit directly on `probeMemberPin` at `:627`.

---

_Reviewed: 2026-09-22T01:21:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 4_
