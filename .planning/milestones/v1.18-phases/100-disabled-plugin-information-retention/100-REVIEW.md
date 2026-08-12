---
phase: 100-disabled-plugin-information-retention
reviewed: 2026-08-11T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list-manifest-absent.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 100: Code Review Report

**Reviewed:** 2026-08-11
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 100 keeps a disabled plugin's installation record self-describing: `toDisabledRecord` no longer zeroes `resources.*`, a new optional `hookEntries` key records the materialized hook events, `info` routes disabled records through the shared block builder, and both `list` and `info` narrow the disabled row's reason brace to `{not in manifest}`.

The two guards retention would otherwise break are both correctly placed and both funnel through the single `isRecordedButDisabled` predicate. The hydrate guard (`event-router.ts:607`) sits inside `hydrateScopeFromState`, which is the only body both `hydrateCacheFromDisk` and `hydrateProjectScopeForCwd` reach, so no hydrate path bypasses it; the paired disabled/enabled fixture tests write a real `hooks.json` so file presence cannot mask the guard. The self-conflict exclusion (`install.ts:109`) is applied unconditionally and is safe on the fresh-install path because the PI-15 early-sanity throw at `install.ts:762` already fires before it. The `hookEntries` absence-vs-present-empty distinction is preserved end to end (schema optional, no migrate fill, `info.ts:1092-1095` branches on `=== undefined` and routes present-empty into the `listed` arm), and no handler payload can reach `state.json` — every writer goes through `projectHookSummaryEntries`, which emits `event` + `matcher` only. `partitionDisabledScopes`, `info.messaging.ts`'s disabled arm, and the two private `removePluginRecord` copies are fully removed with no dangling callers; `npm run typecheck` and ESLint are clean on every changed file, and the affected suites pass.

The defects are on the surfaces the phase widened rather than in the retention mechanics. One is a live contradiction between what `info --fetch` does and what it reports, reproduced against the injected git mock. The rest are narrowing-too-far, a behavior change the retention silently produced on the install surface, and a set of invariant comments the phase falsified but did not update.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `info --fetch` on a disabled plugin the manifest still declares hits the network, then reports that it fetched nothing

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:860-880` (arm `(c)`), `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:974-983` (`skipReasonFor`)
**Severity:** BLOCKER

**Issue:** `buildBlock` arm `(c)` threads `fetchCtx` into `buildInstalledRow` unconditionally (`info.ts:871`) and then stamps `skipReasonFor(installed, false)` (`info.ts:878`), which returns `"already disabled"` whenever the record is disabled. For a git-source plugin the fetch probe therefore runs for real, while `emitFetchSkip` emits a `warning`-severity `(skipped) {already disabled}` note whose entire purpose is to say the fetch did nothing.

The code contradicts three of its own written contracts:

- `InfoBlock.skipReason` (`info.ts:751-754`): "Why a `--fetch` fetched nothing for this block. ABSENT means the block is fetchable and the flag was honored."
- `buildFetchSkipBlock` (`info.ts:2078-2082`): `already disabled` means "no materialized artifacts to refresh".
- `docs/output-catalog.md:1649`: "If EVERY found scope is disabled, no probe runs at all."

**Reproduction (run against this worktree, injected `makeMockGitOps` seam, single user scope, manifest declaring `alpha` with `source: "https://example.com/alpha.git"`, record `enabled: false`):**

```text
CLONE CALLS: [{"dir":".../sources-staging/<uuid>","url":"https://example.com/alpha"}]
FETCH CALLS: [{"dir":".../plugin-clones/e83d4639a1b3","remote":"origin"}]
--- severity: undefined
● mp [user] <no autoupdate>
  ◍ alpha v1.0.0 (disabled)
    components: not resolved
--- severity: warning
A plugin operation needs attention.
● mp [user]
  ⊘ alpha v1.0.0 (skipped) {already disabled}
```

Both `clone` and `fetch` were called. The note says nothing was fetched.

A second, milder face of the same bug: a disabled PATH-source plugin the manifest still declares also gets the `{already disabled}` note, while an ENABLED path-source plugin under `--fetch` gets no note at all even though nothing is fetched for it either. The note tracks `enabled`, not fetchability.

**Fix:** make `skipReason` and the fetch decision the same decision. Gate the fetch context off for a disabled record so the arm genuinely declines, which is what the catalog and the doc comments already describe:

```ts
// info.ts, buildBlock arm (c)
if (installed !== undefined) {
  // D-100-08 / ENBL-17: a disabled record has no materialized artifacts to
  // refresh, so the fetch is DECLINED here -- which is what makes the
  // `already disabled` skip note true rather than merely stamped.
  const blockFetchCtx = isRecordedButDisabled(installed) ? undefined : fetchCtx;
  const row = await buildInstalledRow({
    ...
    ...(blockFetchCtx !== undefined && { fetchCtx: blockFetchCtx }),
  });
  ...
}
```

Add a counter-based test mirroring `tests/orchestrators/plugin/info-manifest-absent.test.ts`'s INFO-12 zero-call suite, but with a manifest that DOES declare the disabled plugin — the existing disabled `--fetch` tests all use `manifest: { name: "mp", plugins: [] }`, so this path has no coverage at all.

## Warnings

### WR-01: `applyDisabledRowShape` discards failure-class reasons that block `enable`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:953-966`

**Issue:** The allow-list keeps only `"not in manifest"`. Because neither `narrowProbeError` nor `narrowResolverNotes` can produce that token, the filter is effectively "drop every reason" on arm `(c)` — including the failure-class members `source missing`, `unreadable`, `permission denied`, `network unreachable`, `authentication required`. D-100-07's own rule is "render durable facts that constrain what the user can do next; suppress facts about runtime behavior that is currently suspended", and those five are the first kind, not the second: `enable` re-runs the install ledger against the same source, so a source that cannot be read is exactly what stops the next action.

Visible in the CR-01 reproduction above: `buildInstalledGitRow`'s catch classified the failure and attached the reason, `applyDisabledRowShape` filtered it away, and the row rendered `◍ alpha v1.0.0 (disabled)` followed by `components: not resolved` with no explanation whatsoever. The unsupported-kind suppression the phase actually wanted (`{unsupported skills}` etc.) is correct; the failure-class suppression is collateral.

**Fix:** allow-list the durable blockers alongside manifest absence rather than a single token:

```ts
const DISABLED_ROW_REASONS: ReadonlySet<ContentReason> = new Set([
  "not in manifest",
  "source missing",
  "unreadable",
  "permission denied",
  "network unreachable",
  "authentication required",
]);
...
reasons: (row.reasons ?? []).filter((r) => DISABLED_ROW_REASONS.has(r)),
```

If the narrower set is genuinely intended, the catalog state should say so explicitly ("a disabled row whose source is unreadable renders bare") so the silence is documented rather than incidental.

### WR-02: disabled records now reserve generated names and refuse unrelated installs

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:623-649` (`collectOwners`), `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:695-712`

**Issue:** `collectOwners` walks every plugin record in the scope with no `enabled` filter. Before ENBL-18 a disabled record's `resources.*` were empty, so a disabled plugin owned no names; now it owns all of them. Failure scenario: plugin `A` is disabled (its skill `a-foo` still recorded, nothing on disk); the user installs unrelated plugin `B`, which generates `a-foo`. The pre-flight guard throws `CrossPluginConflictError` with `skill "a-foo" already owned by plugin "A"` and the install is refused against a name that occupies no disk slot. The message gives no hint that `A` is disabled, so the remedy (`uninstall A`) is not discoverable from the row.

This may well be the preferable semantics — it is what lets `enable A` succeed later, and it is what keeps a disabled record's `cascadeUnstagePlugin` on `uninstall` from deleting another plugin's artifacts by name. But it is an unannounced behavior change on the install surface with no test, no catalog state, and no mention in the phase description.

**Fix:** decide the semantics explicitly. Either exclude disabled records from `collectOwners`, or keep the reservation and (a) carry the owner's disabled-ness into `CrossPluginConflictError.conflicts` (`skill "a-foo" already owned by disabled plugin "A"`), (b) add a `shared.test.ts` case pinning that a disabled owner still conflicts, and (c) record the state in `docs/output-catalog.md`.

### WR-03: `update` of a disabled record moves the version pin but leaves the retained inventory describing the old version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1533-1585` (`refreshDisabledRecord`)

**Issue:** `refreshDisabledRecord` writes `version`, `resolvedSource`, `resolvedSha` and `compatibility`, and touches neither `resources.*` nor the new `hookEntries`. That was consistent while a disabled record's inventory was empty. It is not consistent now: after `disable` → `update` the record claims version B while its `resources.*` and `hookEntries` describe what version A materialized. If the marketplace entry is later dropped, `info` renders `◍ p vB (disabled) {not in manifest}` over version A's skill/command/hook list — precisely the self-describing claim this phase exists to make trustworthy.

**Fix:** at minimum document the skew at the `refreshDisabledRecord` call site and in the `state-only-disabled-with-components` catalog state ("the inventory describes the installation, which may predate the current pin"). Better: have the refresh clear `hookEntries` and `resources.*` when the pin moves, or refuse to move the pin without re-materializing, so `version` and inventory cannot disagree.

### WR-04: `PluginDisabledMessage.reasons` is silently dropped by two of the four disabled render arms

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:97-106`, `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:214-222`

**Issue:** The phase added an optional `reasons` field to `PluginDisabledMessage` (`notify.ts:797`) and threaded it in two of the four arms that render the variant (`notify.ts:2446`, `list.messaging.ts:170`). The other two still call `composeReasons(undefined, false, false, probe)` and their doc comments still assert the variant "carries no reasons" / "NO reasons". A future producer stamping `reasons` on a disable-cascade or reconcile row loses it with no compile error and no test failure — the field is present on the type, so nothing catches the omission.

**Fix:** thread `p.reasons` in both arms (they are byte-identical bodies otherwise, so behavior is unchanged while every producer stamps nothing), and update the two comments. If the bare form is deliberate for those surfaces, say so in the comment and note that the field is intentionally ignored.

### WR-05: comments still assert the removed "disabled implies empty resources" invariant

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1520`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1853`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:305-306`, `tests/orchestrators/plugin/enable-disable.test.ts:282`

**Issue:** Four surviving comments describe the invariant this phase deleted:

- `update.ts:1520`: "Resources.\* stay empty (the plugin is still disabled)."
- `update.ts:1853`: "refresh the record's version, resolvedSource and compatibility ... but keep `resources.*` empty."
- `plan.ts:305-306`: "the terminal state of a successful disable is exactly 'recorded with empty resources + config `enabled: false`'."
- `enable-disable.test.ts:282`: "the KEPT disabled record -- empty resources + the pinned version".

`plan.ts` is the highest-risk of the four: it narrates the convergence rule a maintainer reads before touching the disable bucket, and the code beside it correctly reads `isRecordedButDisabled` alone. The repo's comment policy treats these anchors as load-bearing, and a false invariant is worse than no comment.

**Fix:** rewrite each to the ENBL-18 / D-100-10 rule — disable changes `enabled` and `updatedAt` and nothing else; `resources.*` are preserved and are no part of the marker.

## Info

### IN-01: `PersistedHookEntry` is exported with no consumer

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:60-61`
**Issue:** The type is exported but referenced nowhere in `extensions/` or `tests/` (the record's `hookEntries` is consumed through `PluginInstallRecord`). Unlike `PLUGIN_INSTALL_RECORD_SCHEMA`, which carries a documented COMPAT-01 reason for its unused export, this one carries none.
**Fix:** drop the `export`, or add the one-line rationale the sibling export has.

### IN-02: `applyDisabledRowShape` always emits a `reasons` key, sometimes empty

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:961-965`
**Issue:** Every other row composer in this file uses `...(reasons.length > 0 && { reasons })`; this one always sets the field, so an arm-`(c)` disabled row carries `reasons: []`. Byte output is unaffected (`composeReasons` returns `""` for an empty list), but any consumer that treats the key's presence as a signal now sees a false positive, and the inconsistency invites one.
**Fix:** `...(filtered.length > 0 && { reasons: filtered })`, matching the file convention.

### IN-03: `skipReasonFor`'s second parameter is a boolean trap

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:974-983`, call sites at `info.ts:832` and `info.ts:878`
**Issue:** Both call sites pass a bare `true` / `false` positional literal; the meaning is only recoverable from the callee. Swapping the two values is a silent behavior change (a manifest-present disabled record would start claiming `not in manifest`).
**Fix:** take a named option (`{ manifestAbsent: true }`) or split into two small helpers named for their arm.

### IN-04: `hookSummaryEntriesFromPersisted` asserts rather than narrows

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:1032-1042`
**Issue:** The doc says "the narrowing to the renderer's closed `HookSummaryEntry` union happens once, at the read boundary", but the body performs two unchecked `as` casts from an open `event: string` with no `BUCKET_A_EVENTS` membership test. A state.json carrying an event token outside the supported set renders as an ordinary supported hook line, with no `(unsupported)` suffix — the lenient arm exists precisely for that case and is never used here. The schema comment acknowledges the exposure ("a fabricated entry can mislead `info` but cannot run"), so this is a documented tradeoff, not a surprise; it is nonetheless an assertion where the file name promises a narrowing.
**Fix:** route a non-bucket-A `event` to the lenient arm with `supported: false`, which costs one branch and makes the rendered line honest:

```ts
if (!BUCKET_A_MEMBERS.has(entry.event)) {
  return { kind: "lenient", event: entry.event, supported: false,
           ...(entry.matcher !== undefined && { matcher: entry.matcher }) };
}
```

---

_Reviewed: 2026-08-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
