---
phase: 97-disabled-state-classification-repair
reviewed: 2026-08-10T00:30:00Z
depth: standard
iteration: 3
files_reviewed: 25
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/edge-deps.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 97: Code Review Report (iteration 3, final)

**Reviewed:** 2026-08-10T00:30:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

All three iteration-2 warnings are genuinely fixed, verified against the source
rather than the fix report. WR-07's shape choice is the strongest part of the
set: the three signals became one exported `EnableDegradationSignals` interface
that is intersected into the local `fresh` sentinel, intersected into the
exported `enabled` outcome arm, and `extends`-inherited by
`PluginEnabledOutcome` — so the two row composers read one type instead of two
hand-synchronized field lists, which is the drift that produced the finding.
Both composers reproduce `install.ts`'s emit order exactly (`orphan rewake` →
per-kind `malformed *` → `narrowUnsupportedKinds(unsupported)`), and the
`malformed.length > 0 ? "warning" : "info"` raise is behaviorally identical to
`install.ts:1808`'s `frontmatterDegradations.length > 0` gate (`degradedKinds`
is a de-duplicated projection of exactly that array, and every `DegradeKind`
member has a token in `MALFORMED_REASON_BY_KIND`, so the two predicates cannot
diverge). The SEV-03 operator ruling survives untouched: a dropped-kind-only
re-enable still stamps `info` on both arms — I confirmed that by reading the
`unsupported.length > 0` arm with `malformed` empty. `orphanRewake` correctly
does NOT move the severity channel, matching install.

WR-08 is correct on the merits and shape-identical to the finalize-path sweep it
mirrors: same `preflight.resolvedSha !== undefined` gate, same D-19-01 swallow,
and genuinely outside the guard — `refreshDisabledRecord`'s `withStateGuard` has
returned before the call, so no nested acquisition is possible. The GC is
derive-not-persist and iterates ALL records including disabled ones, so a
sibling disabled record still protects its own clone; the new sweep cannot
delete a live tree.

WR-09 is fully applied in `enable-disable.ts`: a fresh grep for `WR-0N` / `CR-0N`
in that file returns nothing, and every replacement anchor (`FORCE-05`,
`D-69-01`, `SEV-01`, `D-10`, `ATTR-08`, `RECON-03`, `CMP-3`, `UAT-05`,
`RECON-04`) resolves to a real ID elsewhere in `extensions/` or `docs/` — none
was invented.

Verification I ran myself, not taken from the fix report: `tsc --noEmit` clean;
`eslint` over the nine changed source/test files clean; `node --test` over
`catalog-uat` + `reconcile/notify` + `enable-disable` + `update` = 151 pass / 0
fail; `pre-commit run --files docs/output-catalog.md` — mdformat and
markdownlint-cli2 both pass (the trufflehog failure is the documented worktree
git-mode structural failure, and the repo's prettier hook is scoped to
`\.(js|json|ts)$`, so the markdown file is out of that hook's scope).

One new WARNING: commit `8367bb10` rewrote `enabledRowFromOutcome`'s doc block
to describe the new `warning` raise but left the dispatch-site comment fourteen
lines below asserting the opposite. It is a carrier, not a re-fix.

## Prior-Finding Verification

| ID | Prior severity | Cited commit | Verdict | Evidence |
|----|----------------|--------------|---------|----------|
| WR-07 | WARNING | `8367bb10` | **RESOLVED** | `enable-disable.ts:100-136` defines `EnableDegradationSignals`; `:206-209` and `:155-160` intersect it into both outcome arms; `apply-outcomes.ts:172` inherits it via `extends`. Producer at `:305-316` reads all three off `ledgerCtx`. Consumer 1 `freshEnableRow:1000-1035`; consumer 2 `enabledRowFromOutcome:531-563`. Order matches `install.ts:1767-1779` + `:1825`. Severity matches `install.ts:1808-1810`; the clean partial shortfall still stamps `info` (SEV-03 untouched). Catalog states `enable-degraded` / `enable-orphan-rewake` at `docs/output-catalog.md:2138-2165` with fixtures at `catalog-uat.test.ts:3621-3675`. End-to-end byte + severity pin at `enable-disable.test.ts:649-692`; three projection pins at `notify.test.ts:495-568` including the all-three ordering assertion. No missed call site: `status: "enabled"` is consumed only at `apply.ts:694`, and `kind: "plugin-enabled"` only at `notify.ts:642`. |
| WR-08 | WARNING | `97b600b7` | **RESOLVED** | `update.ts:1584-1590` runs the sweep on the disabled arm, after `await refreshDisabledRecord` has released its guard, gated on `preflight.resolvedSha !== undefined`, swallowed per D-19-01 — byte-for-byte the shape of the finalize call at `:1840-1846`. `clone-gc.ts:38-51` iterates every record in `state.marketplaces`, disabled included, so a sibling disabled record keeps protecting its clone. Pin at `update.test.ts:4230-4237` asserts `readdir(pluginClonesDir)` equals exactly `[pluginCloneKey(cloneUrl, SHA_NEW)]`. `clone-gc.ts` remains fs-only, so no git token entered the module. |
| WR-09 | WARNING | `72316b7e` | **RESOLVED (as scoped)** | `grep -n "WR-0[0-9]\|CR-0[0-9]" enable-disable.ts` → no matches. `apply.ts:988`, `:1040`, `:1085`, `:1108` now read `RECON-04`. All replacement anchors verified present elsewhere in the tree. The residual legacy anchors in `apply.ts` / `update.ts` / `plan.ts` are the repo-wide sweep the finding did not ask for; correctly noted, not carried. |
| WR-02 / WR-04 / WR-06 / WR-05-residual | WARNING | `d601e0fb`, `276122a` | **DEFERRED — carriers confirmed** | Not re-raised per declared policy. |
| IN-01..IN-06 | INFO | — | **STILL OPEN** | Re-listed below unchanged. |

## Structural Findings (fallow)

None supplied for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

None. No BLOCKER found; the two iteration-1 BLOCKERs remain resolved.

## Warnings

### WR-10: the `plugin-enabled` dispatch comment asserts the severity rule WR-07 just replaced

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:652-657`

**Issue:**
`8367bb10` rewrote the doc block above `enabledRowFromOutcome` (`:512-530`) to
describe the new split — `info` for a dropped-kind-only re-enable, `warning` for
a malformed component — but left the comment at the `case "plugin-enabled":`
dispatch site untouched:

```ts
// ENBL-07 / FSTAT-07 / D-66-04: a re-enable that went through the partial
// gate dropped component kinds, so it takes the `(partially-installed)`
// projection instead -- the SAME split the standalone enable verb and the
// `plugin-backfilled` arm make, and the row the very next `list` renders
// for that record. SEV-03: both arms stay `info` -- the degradation
// predates the enable, so the requested transition was fully carried out.
block.plugins.push(enabledRowFromOutcome(outcome));
```

The last sentence is now false for the function it introduces: fourteen lines
earlier, `enabledRowFromOutcome:539` computes
`const severity = malformed.length > 0 ? "warning" : "info"`, and
`notify.test.ts:495-516` pins that a `degradedKinds: ["skill"]` enable projects
at `warning`. A reader who trusts the dispatch comment over the code reads the
`warning` stamp as a regression against SEV-03 and "restores" it — which is
exactly the operator ruling this comment is trying to protect, inverted. It is
the same defect class WR-09 was raised for (an anchor/claim that no longer means
what the code does), in a comment the same commit walked past.

`enable-disable.ts` has no twin problem: its `dispatchOutcome` site carries no
severity claim, and `freshEnableRow`'s doc block was updated in full.

**Fix:** restate the last clause to name the split the function actually
implements, and keep the SEV-03 anchor on the half it still governs.

```ts
// ENBL-07 / FSTAT-07 / D-66-04: a re-enable that went through the partial
// gate dropped component kinds, so it takes the `(partially-installed)`
// projection instead -- the SAME split the standalone enable verb and the
// `plugin-backfilled` arm make, and the row the very next `list` renders
// for that record. SEV-03: a dropped-kind-only re-enable stays `info` --
// that shortfall predates the enable, so the requested transition was fully
// carried out. WARN-01: a component this ledger just degraded takes the
// `warning` raise instead; see `enabledRowFromOutcome`.
```

## Info

### IN-07: the reconcile install arm still drops `orphanRewake`, so the cascade now names it for enable but not for install

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1856-1865`; `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:494-505`

**Issue:** `installPlugin`'s orchestrated return carries `degradedKinds` but not
`orphanRewake` (and not `unsupported`), so `installedRowFromOutcome` can only
ever emit `(installed)` with malformed tokens. After WR-07 the enable arm of the
same cascade carries all three. A load-time reconcile that installs a plugin
with an orphan `rewakeMessage` handler renders a bare `(installed)` row, while a
re-enable of that identical plugin in the same cascade renders
`(installed) {orphan rewake}` — the inverse of the asymmetry WR-07 closed, now
sitting in one file.

The gap predates this phase on the install arm (WR-07 did not create it and
correctly did not widen its scope to fix it), and the enable arm's behavior is
the more truthful of the two, so nothing here needs reverting. But no carrier
currently names it: WR-06's todo is scoped to `dependencies` / soft-dep markers
only.

**Fix:** add `...(installCtx.resolved.orphanRewake === true && { orphanRewake: true })`
to the orchestrated `InstallPluginOutcome` and compose it in
`installedRowFromOutcome` through the same `EnableDegradationSignals`-shaped
seam, or record the divergence on the Phase 98 carrier so it is not rediscovered
as a third-generation finding.

### IN-01: retired `force-*` vocabulary survives in the touched test titles and comments

**Classification:** INFO
**File:** `tests/orchestrators/edge-deps.test.ts:357-359`, `:370`, `:474`, `:481`, `:491`, `:509-510`, `:517-518`, `:526-527`, `:556-561`, `:766`, `:772`

**Issue:** Carried unchanged (declared out of fix scope). The classifications are
`partially-installed*` / `partially-upgradable`, but the comments still say
`force-installed-upgradable`, `force-upgradable`, `force-installed` and
`update --force`. `tests/architecture/partial-vocabulary-guard.test.ts` does not
reserve these spellings.

**Fix:** rename to the current tokens; consider reserving the three `force-*`
spellings in the vocabulary guard.

### IN-02: the planner's disable-branch comment still describes the retired empty-resources marker

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:306`

**Issue:** Carried unchanged. The file header and the enable-branch comment were
corrected; `:306` still reads "exactly `recorded with empty resources + config
enabled: false`", the one surviving statement of the retired rule in a file this
phase edited.

**Fix:** restate as "recorded with `enabled: false` + config `enabled: false`".

### IN-03: the completion fixture seeds disabled records in a shape `DisabledPluginRecord` forbids

**Classification:** INFO
**File:** `tests/orchestrators/edge-deps.test.ts:437-444`

**Issue:** Carried unchanged. `skills: [`${p.name}-skill`]` is written for every
record and `enabled: p.disabled !== true` set afterwards, producing a disabled
record with populated `resources.skills` — the quadrant
`DisabledPluginRecord`'s empty-tuple typing exists to make unrepresentable.

**Fix:** zero the `resources` arrays when `p.disabled === true`, matching
`toDisabledRecord`.

### IN-04: the drift gate over-matches on any `.enabled` field and under-strips trailing comments

**Classification:** INFO
**File:** `tests/orchestrators/reconcile/plan.test.ts:749-758`, `:778-782`

**Issue:** Carried unchanged. `INLINE_REDERIVATIONS` matches `[\w.]+\.enabled` on
any object, and `stripComments` strips only line comments that START a line, so
a future unrelated `enabled` field or a trailing explanatory comment fails the
gate with the wrong instruction.

**Fix:** anchor the regexes to the record shape rather than the field name, and
strip `//` to end-of-line anywhere outside a string.

### IN-05: `PluginToggleAxes.buildSuccess` still cannot express the enable-only constraint

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:637-651`, `:821-840`

**Issue:** Narrowed by WR-07, not closed. The loose `unsupported?` field became a
single `degradation?: EnableDegradationSignals` carrier, and the disable axis now
destructures it off explicitly (`{ degradation: _degradation, ...info }`) instead
of relying on the caller never passing it — a real improvement. Object spread
still bypasses the excess-property check, so the type cannot forbid a disable
outcome carrying degradation signals; the invariant remains enforced by control
flow at `:694`.

**Fix:** give the two axes distinct `buildSuccess` signatures, or make
`PluginToggleAxes` generic over the outcome it builds.

### IN-06: the catalog asserts a state "breaks IL-2" where the code documents a sanctioned exception

**Classification:** INFO
**File:** `docs/output-catalog.md:1531`

**Issue:** Carried unchanged. The catalog says the disabled inventory row "breaks
IL-2"; `info.ts::emitFetchSkip` and `reconcile/README.md` frame the same second
notification as the sanctioned RECON-04 single-emit carve-out.

**Fix:** restate as "emits a second notification under the same sanctioned
exception the disabled inventory row uses (RECON-04 / IL-2 single-emit
carve-out)".

---

_Reviewed: 2026-08-10T00:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3 (final — loop cap reached)_
