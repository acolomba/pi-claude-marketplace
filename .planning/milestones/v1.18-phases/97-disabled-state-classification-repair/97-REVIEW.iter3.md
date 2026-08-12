---
phase: 97-disabled-state-classification-repair
reviewed: 2026-08-09T00:00:00Z
depth: standard
iteration: 2
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
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 97: Code Review Report (iteration 2)

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Both prior BLOCKERs are genuinely fixed, not merely claimed. CR-01's fix reaches
`result.installCtx.resolved` inside `runEnableBranch`, carries the dropped kinds
on the `fresh` outcome, and branches BOTH consumers (`freshEnableRow` for the
standalone verb, `enabledRowFromOutcome` for the reconcile projection); the
`enable-partial` catalog block exists with a matching byte-equality fixture, and
the ENBL-07 test now runs against a fixture that really resolves
`partially-available` (`seedRealDisabledMarketplace` with `unsupportedKind:
"lspServers"`) rather than asserting the old `(installed)` bytes. The SEV-03
`info` stamp matches `install --partial`'s `successSeverity` and the
`plugin-backfilled` partial arm at `reconcile/notify.ts:606`, so the operator's
row-consistency ruling is implemented consistently on both arms and in the docs.
CR-02 writes `resolvedSha` inside the SAME pre-existing `withStateGuard` (no
nested lock), mirroring `finalizeUpdateRecord`'s conditional write verbatim.

WR-01's fix is the strongest of the set: both inline twins (`reconcile/apply.ts`
backfill gate, `plugin-path.ts::collectBinDirs`) now call the single predicate,
and the gate was rewritten from a four-entry allowlist into a walk of
`extensions/pi-claude-marketplace/**/*.ts`. I verified independently that the
three `INLINE_REDERIVATIONS` spellings do NOT match the surviving legitimate
`.enabled` reads (`config-io.ts:89` `entry.enabled !== false`, `migrate.ts:175`
`pl.enabled === undefined`, `enable-disable.ts:538` optional-chain read), so the
gate is green on merit rather than on an exemption. WR-05's disposition is also
correct on the merits: `preflightUpdate` returns the `unchanged` outcome at
`update.ts:1101` BEFORE `runThreePhaseUpdate` reaches the disabled branch at
`:1573`, so the reported unconditional rewrite cannot occur, and the replacement
pin now asserts `state.json` mtime and `updatedAt` directly.

Three new defects survive. Two are gaps the CR-01/CR-02 fixes opened a seam over
but did not close: the enable row still discards two of the three degradation
signals the same ledger produces (`frontmatterDegradations`, `orphanRewake`),
which is the identical "the row contradicts the ledger" class CR-01 fixed for
the third; and `refreshDisabledRecord` moves a plugin's clone reference without
the `garbageCollectPluginClones` sweep every other clone-reference mutator runs
under D-78-01. The third is traceability: the fix comments landed unqualified
`WR-01` / `WR-03` / `CR-01` anchors into files that already used those exact
tokens for unrelated findings from earlier reviews.

## Prior-Finding Verification

| ID | Prior severity | Cited commit | Verdict | Evidence |
|----|----------------|--------------|---------|----------|
| CR-01 | BLOCKER | `b94684c8` + `96a05a92` | **RESOLVED** | `enable-disable.ts:265-273` threads `resolved.unsupported`; `:955-986` `freshEnableRow` branches; `reconcile/notify.ts:522-548` `enabledRowFromOutcome` branches; `apply.ts:688-698` threads through the toggle axis; `docs/output-catalog.md:2125-2138` `enable-partial` block + `catalog-uat.test.ts:3592-3616` fixture; ENBL-07 test repinned to the degraded bytes with `severity === undefined`. Both arms stamp `info`, matching `install.ts:1799-1830` `successSeverity` and `reconcile/notify.ts:606` per SEV-03. |
| CR-02 | BLOCKER | `e755bc92` | **RESOLVED** | `update.ts:1358` destructures `resolvedSha`; `:1379-1381` writes it inside the existing guard, byte-for-byte the same conditional `finalizeUpdateRecord:1479-1482` uses. Regression test seeds a DISABLED record at `SHA_OLD` against a manifest pinned at `SHA_NEW` and asserts `version === sha-<resolvedSha[0:12]>`. |
| WR-01 | WARNING | `9d4431b4` | **RESOLVED** | `apply.ts:1060` and `plugin-path.ts:42` now call `isRecordedButDisabled`; `plan.test.ts:754-770` walks the whole extension tree; `state-io.ts:134-137` claim updated to describe the walk. Gate passes (72/72 in that file). Independently confirmed no false positive on the config axis. See IN-04 for the residual gate weakness. |
| WR-03 | WARNING | `93bd994d` (+ CR-01 for the signalling half) | **RESOLVED** | `enable-disable.ts:224-234` records the automatic-opt-in decision citing the SEV-03 / D-69-01 autoupdate-cascade precedent and notes `requirePartialInstallable` still blocks a structurally unavailable candidate. The signalling half is delivered by CR-01 on both arms. |
| WR-05 | WARNING | `ad794396` | **CORRECTLY RECLASSIFIED** | Premise independently disproved: `update.ts:1101` returns the `unchanged` partition on `toVersion === fromVersion` before `runThreePhaseUpdate:1573` reaches `refreshDisabledRecord`. The reverted deep-equal short-circuit would have been dead code. Test strengthened from a `updatedAt`-excluding field compare to direct mtime + `updatedAt` assertions. Residual (missing write when the version is stable but `resolvedSource` moved) carried at `.planning/todos/pending/2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md`. |
| WR-02 | WARNING | `d601e0fb` | **DEFERRED — carrier confirmed** | `.planning/todos/pending/2026-08-09-enable-partial-remediation-affordance.md`, `resolves_phase: 98`. Not re-raised. |
| WR-04 | WARNING | `d601e0fb` | **DEFERRED — carrier confirmed** | `.planning/todos/pending/2026-08-09-update-partial-completion-excludes-disabled-records.md`, `resolves_phase: 98`. Not re-raised. |
| WR-06 | WARNING | `d601e0fb` | **DEFERRED — carrier confirmed** | `.planning/todos/pending/2026-08-09-enable-row-suppresses-soft-dep-markers.md`, `resolves_phase: 98`. Scope is `dependencies` / soft-dep markers ONLY — see WR-07 below for the signals it does not cover. |
| IN-01 / IN-02 / IN-03 | INFO | — | **STILL OPEN** | Out of fix scope by declared policy; re-listed below as IN-01..IN-03 with current line numbers. |

Verification runs (targeted, not a full suite re-run): `node --test` over
`catalog-uat.test.ts` + `reconcile/plan.test.ts` + `reconcile/notify.test.ts`
(72 pass / 0 fail) and `enable-disable.test.ts` + `update.test.ts` +
`plugin-state-classifier.test.ts` + `edge-deps.test.ts` + `backfill.test.ts` +
`list.test.ts` (233 pass / 0 fail). `npx eslint` over the six changed source
files: clean.

## Structural Findings (fallow)

None supplied for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

None. Both prior BLOCKERs verified resolved; no new BLOCKER found.

## Warnings

### WR-07: the enable row still discards two of the three degradation signals the same ledger produces

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:265-273`, `:955-986`; `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:522-548`

**Issue:**
`b94684c8` opened the seam CR-01 needed — `runEnableBranch` now reads
`result.installCtx` — but took exactly one field off it:

```ts
// enable-disable.ts:265-273
const resolved = result.installCtx.resolved;
return {
  kind: "fresh",
  version: recordedVersion,
  ...(resolved.state === "partially-available" && { unsupported: [...resolved.unsupported] }),
};
```

`installPlugin` composes THREE signals off the same `installCtx` for the same
ledger outcome (`install.ts:1767-1779`, `:1806-1817`):

- `installCtx.resolved.orphanRewake === true` → `{orphan rewake}` (SURF-05 / D-63-08)
- `malformedReasonsForKinds(installCtx.frontmatterDegradations.map(d => d.kind))`
  → `{malformed skill}` / `{malformed command}` (WARN-01 / D-86-03)
- `installCtx.frontmatterDegradations.length > 0` → severity raised to `warning`

The enable branch runs the **same** `runInstallLedger` over the **same** bridges,
so all three are reachable on a re-enable. None is threaded. A re-enable of a
plugin whose agent frontmatter is malformed therefore renders
`● foo-plugin v1.2.3 (installed)` at `info` severity, while `install` of the
identical plugin renders `● foo-plugin v1.2.3 (installed) {malformed skill}` at
`warning`. That is the exact divergence class CR-01 was raised for — the row
contradicting the ledger that produced it — left open for two of the three
inputs.

This is NOT covered by WR-06's carrier. That todo's scope is stated as
`dependencies: []` and the `{requires pi-...}` / SEV-01 companion raise
(`2026-08-09-enable-row-suppresses-soft-dep-markers.md:9-15, 33-37`);
`frontmatterDegradations` and `orphanRewake` appear nowhere in it, so nothing
currently carries them. Not a BLOCKER because the gap genuinely predates ENBL-07
(it applies to a clean fully-installable re-enable too, so the widened gate did
not create it) and the row still names the correct status token.

**Fix:** thread the two remaining signals off the seam CR-01 already opened, and
preserve `install.ts`'s reason ORDER (`orphan rewake` → `malformed *` → dropped
kinds) so the braces stay byte-comparable across verbs.

```ts
// runEnableBranch
const ctxLocal = result.installCtx;
return {
  kind: "fresh",
  version: recordedVersion,
  degraded: {
    orphanRewake: ctxLocal.resolved.orphanRewake === true,
    malformedKinds: ctxLocal.frontmatterDegradations.map((d) => d.kind),
    unsupported:
      ctxLocal.resolved.state === "partially-available" ? [...ctxLocal.resolved.unsupported] : [],
  },
};

// freshEnableRow (and enabledRowFromOutcome, via EnableDisablePluginOutcome)
const reasons: ContentReason[] = [
  ...(degraded.orphanRewake ? (["orphan rewake"] as const) : []),
  ...malformedReasonsForKinds(degraded.malformedKinds),
  ...narrowUnsupportedKinds(degraded.unsupported),
];
// WARN-01 / D-86-03: a degraded-but-installed component is carried out but short.
const severity = degraded.malformedKinds.length > 0 ? "warning" : "info";
```

New catalog states + `catalog-uat.test.ts` fixtures are needed for the
`(installed) {malformed skill}` and `(installed) {orphan rewake}` enable rows. If
that surface is judged too wide for this phase, add the two signals to the WR-06
carrier explicitly — today they are carried by nothing.

### WR-08: `refreshDisabledRecord` moves the clone reference without the D-78-01 GC sweep

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1354-1394`, `:1573-1582`

**Issue:**
`clone-gc.ts:28-54` derives the live clone-key set from each record's
`resolvedSource` (gated on `resolvedSha !== undefined`). `refreshDisabledRecord`
writes BOTH:

```ts
sRecord.resolvedSource = installable.pluginRoot;   // now the NEW clone root
if (resolvedSha !== undefined) { sRecord.resolvedSha = resolvedSha; }
```

so after the refresh the OLD `plugin-clones/<key>/` directory is unreferenced.
The disabled branch then returns the `unchanged` outcome at `:1574-1582` — a path
that never reaches the GC-after-swap call at `:1823-1829`, which is the only
`garbageCollectPluginClones` invocation in this file and is reachable only after
`finalizeUpdateRecord`. Meanwhile `preflightUpdate` has already materialized the
NEW clone through `makeUpdateCloneProbe` (`:1069-1081`), so the command reliably
leaves two clone trees on disk and sweeps neither.

`clone-gc.ts:8-10` states the contract: "`uninstall`, `update`, and
`marketplace/remove` call it AFTER their state mutation commits." This is a
state mutation that changes clone liveness and does not. The orphan is not
permanent — the next git-source update of any plugin in the same scope sweeps it
— but every repeated `update` on disabled git-source plugins accumulates one
more orphan until an unrelated command happens to run, which is precisely the
condition the derive-not-persist GC was designed to make impossible.

**Fix:** run the same gated sweep on the disabled arm, outside the state guard
and with the same D-19-01 swallow.

```ts
if (isRecordedButDisabled(preflight.record)) {
  await refreshDisabledRecord(args, preflight);
  // PURL-06 / D-78-01: the refresh re-pointed resolvedSource/resolvedSha at the
  // new clone, so the old key is unreferenced -- sweep it here, because this
  // arm returns before the finalize-path GC.
  if (preflight.resolvedSha !== undefined) {
    try {
      await garbageCollectPluginClones(args.locations);
    } catch {
      // D-19-01: hygienic cleanup never fails the command.
    }
  }

  return { partition: "unchanged", /* unchanged */ };
}
```

Extend the existing ENBL-09 git-source test to assert that
`plugin-clones/` holds exactly one key after the refresh.

### WR-09: the fix comments reuse review-finding IDs that already mean something else in the same files

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:225` vs `:321`, `:354`, `:364`, `:526`, `:1022`; `:964`; `:11` / `:204`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1019-1020` / `:1064`

**Issue:**
`93bd994d` added `// WR-03 / FORCE-05: this is a DELIBERATE departure...` at
`enable-disable.ts:225`. The same file already carries five unrelated `WR-03`
anchors from an earlier review (`:321` cascade unstaging, `:354` hooks.json
removal, `:364` parsed-config cache drop, `:526` state-side truth, `:1022` the
`{not installed}` taxonomy). `b94684c8` likewise added `// WR-06:` at `:964`
next to pre-existing `WR-01` anchors at `:920` / `:929` that mean "the narrowing
cast is sound", while THIS review's WR-01 is the predicate collapse. `CR-01`
names the locking model at `:11` / `:204` and the enable row in the commit
subjects. `reconcile/apply.ts` now has `WR-03` meaning "already-touched dedupe"
at `:1064` sitting three lines from an `ENBL-08` anchor added by the same fix.

`WR-NN` / `CR-NN` are permitted anchors under `.claude/rules/typescript-comments.md`,
so this is not a policy violation. It IS the hazard that rule bans bare
`Pitfall N` for: per-review numbering restarts, the source review is archived,
and a reader cannot tell which `WR-03` a comment means. Three distinct meanings
for one token in one file makes the anchor worthless as traceability.

**Fix:** qualify review-finding anchors with something durable — the requirement
ID the finding maps to, which every one of these comments already has beside it.
`WR-03 / FORCE-05` → `FORCE-05 / D-69-01`; `WR-06:` → `SEV-01:`; the enable-arm
`WR-01` narrowing comments → the `D-10` render-map-totality anchor they are
actually about. Where no requirement ID exists, drop the anchor and let the
prose carry the rationale, exactly as the `Pitfall N` clause prescribes.

## Info

### IN-01: retired `force-*` vocabulary survives in the touched test titles and comments

**Classification:** INFO
**File:** `tests/orchestrators/edge-deps.test.ts:357-359`, `:370`, `:474`, `:481`, `:491`, `:509-510`, `:517-518`, `:526-527`, `:556-561`, `:766`, `:772`

**Issue:** Carried unchanged from iteration 1 (out of fix scope). The
classifications are `partially-installed*` / `partially-upgradable`, but the
comments still say `force-installed-upgradable`, `force-upgradable`,
`force-installed` and `update --force`. `tests/architecture/partial-vocabulary-guard.test.ts`
does not reserve these spellings.

**Fix:** rename to the current tokens; consider adding the three `force-*`
spellings to the vocabulary guard's reserved set.

### IN-02: the planner's disable-branch comment still describes the retired empty-resources marker

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:306`

**Issue:** Carried unchanged. The file header (`:18-23`) and the enable-branch
comment (`:329-331`) were corrected, but `:306` still reads "exactly `recorded
with empty resources + config enabled: false`". `state-io.ts:148-151` now
documents emptied arrays as a consequence, never the marker, so this is the one
surviving statement of the retired rule in a file the phase edited.

**Fix:** restate as "recorded with `enabled: false` + config `enabled: false`".

### IN-03: the completion fixture seeds disabled records in a shape `DisabledPluginRecord` forbids

**Classification:** INFO
**File:** `tests/orchestrators/edge-deps.test.ts:437-444`

**Issue:** Carried unchanged. `skills: [`${p.name}-skill`]` is written for every
record and `enabled: p.disabled !== true` set afterwards, producing a disabled
record with populated `resources.skills` — the fourth quadrant
`DisabledPluginRecord`'s empty-tuple typing (`state-io.ts:100-109`) exists to
make unrepresentable. The typebox schema is permissive, so `saveState` accepts
it.

**Fix:** zero the `resources` arrays when `p.disabled === true`, matching
`toDisabledRecord`.

### IN-04: the new drift gate over-matches on any `.enabled` field and under-strips trailing comments

**Classification:** INFO
**File:** `tests/orchestrators/reconcile/plan.test.ts:749-758`, `:778-782`

**Issue:** Two mechanical weaknesses in an otherwise sound gate:

- `INLINE_REDERIVATIONS` matches `[\w.]+\.enabled` on ANY object. The gate is
  green today only because the surviving unrelated reads happen to use spellings
  it does not cover (`entry.enabled !== false`, `pl.enabled === undefined`). A
  future field named `enabled` on an unrelated type — a hooks entry, a settings
  block — fails the gate with "call isRecordedButDisabled instead", which is the
  wrong instruction.
- `stripComments` strips only line comments that START a line
  (`/^\s*\/\/.*$/gm`). A trailing `// guarded by !rec.enabled` explanatory
  comment survives stripping and trips the gate as a false positive.

Neither blocks anything today; both make the gate's failure message misleading
the first time it fires.

**Fix:** anchor the regexes to the record shape rather than the field name
(e.g. require the identifier to be one of `record` / `rec` / `installed`, or
require a sibling `compatibility` / `resources` access in the same file), and
extend `stripComments` to strip `//` to end-of-line anywhere outside a string.

### IN-05: `PluginToggleAxes.buildSuccess` accepts `unsupported` on the disable axis too

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:637-649`, `:816-820`

**Issue:** The `unsupported?: readonly string[]` field was added to the shared
`buildSuccess` parameter type, which both axes use. The disable builder is
`(info) => ({ kind: "plugin-disabled", ...info })`, and object spread bypasses
TypeScript's excess-property check — so a `PluginDisabledOutcome` carrying a
stray `unsupported` field would type-check silently. No runtime effect today
(`applyPluginToggles:690` guarantees an empty array on the disable arm), but the
comment's claim that "the disable arm's outcome shape is unchanged" is enforced
by control flow, not by the type.

**Fix:** give the two axes distinct `buildSuccess` signatures, or make
`PluginToggleAxes` generic over the outcome it builds so the disable arm cannot
express the field.

### IN-06: the catalog asserts a state "breaks IL-2" where the code documents a sanctioned exception

**Classification:** INFO
**File:** `docs/output-catalog.md:1531`

**Issue:** "The disabled inventory row above breaks IL-2 in the same manner and
for the same reason." The corresponding source comment
(`info.ts::emitFetchSkip`) frames the same second notification as an explicit,
justified exception, and `reconcile/README.md:72` names RECON-04 as the
single-emit rule with its own sanctioned second-call carve-out. A user-facing
catalog asserting a constraint is BROKEN, when the code asserts it is a
documented exception, will read as a known defect to the next person who greps
for `IL-2`.

**Fix:** restate as "emits a second notification under the same sanctioned
exception the disabled inventory row uses (RECON-04 / IL-2 single-emit
carve-out)".

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
