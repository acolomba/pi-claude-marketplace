---
phase: 113-update-enable-disable-reconcile
reviewed: 2026-09-06T00:00:00Z
depth: standard
diff_base: 02e1fa45
files_reviewed: 18
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 113: Code Review Report

**Reviewed:** 2026-09-06
**Depth:** standard (diff-scoped against `02e1fa45`)
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed only the phase-113 diff. What I traced end to end, and found correct, is
listed first so the findings below are read against a verified baseline:

- **Record narrowing on both update exits.** `preflight.record` comes from
  `preflightUpdate`'s own `loadState` (`update.ts:1193`) and `markUpdateInProgress`
  mutates a *different* object loaded inside `withStateGuard`
  (`with-state-guard.ts:71`), so `applyPerBridgeResources`' `previousWorkflowNames`
  really is the pre-update inventory. The success exit (`stagedNames`) is safe
  because `placed === staged` whenever the commit returns without a failure, and
  the failure exit (`previous ∪ placed`) is safe because `onPlaced` fires on every
  throw path in `commitPreparedWorkflows` (`stage.ts:437`).
- **Stale-token reachability from reload.** `freshOutcomeToTypedResult` drops the
  flag, `setPluginEnabled` returns the typed result before `dispatchOutcome` in
  orchestrated mode (`enable-disable.ts:914`), `emitCascadeFailure`/`uninstallPlugin`
  return orchestrated shapes without it, and `updateSinglePlugin` is wired only to
  `registerClaudePluginCommand` (`index.ts:158`), not to `resources_discover`. The
  token cannot be stamped from the reload path.
- **Uninstall's sentinel.** `cascadeUnstagePlugin` catches internally and always
  returns (`marketplace/shared.ts:430`), so `retiredWorkflowCommand` is always
  assigned; workflows is the 6th cascade slot, so an AG-5 throw provably leaves
  `dropped.workflows` empty and the omitted token is truthful.
- **Scan vs sweep.** `scanRetainedWorkflowsStaging` performs only `readdir`/`lstat`/
  `assertPathInside`, is total (every arm resolves to a value), and
  `garbageCollectWorkflowsStaging` keeps its `Promise<string[]>` signature. Both
  share `readDisplacedEnvelopes`, so the retention predicate cannot drift.
- **Disclosure.** The retained-tree advisory renders a bare directory name
  (`notify.ts:3312`); `info`'s preview advisories go through `redactAbsolutePaths`
  (`info.ts:1787`) and update's standalone arm through `surfaceDiscoveryWarnings`
  (`update.ts:503`), which redacts. `workflowsStagingDir`/`workflowsHomeDir` really
  are scope-independent (`locations.ts:235,248`), so pending's single scan is correct.
- **Severity composition.** `companionSeverity` returns only `"info" | "warning"`
  (`notify-reasons.ts:91`), so the `stale.length > 0 ? "warning" : companionSeverity(...)`
  short-circuit in `freshEnableRow` cannot downgrade an error. `renderDisabledRow`
  already threads `p.reasons` (`notify.ts:2562`), so the disable token does render.

The one finding I could not talk myself out of is CR-01: this phase introduces the
first place where a workflow name reaches `state.json` *before* the envelope is
placed, and the whole ownership model of the workflows bridge rests on the opposite
invariant.

## Critical Issues

### CR-01: The intent-mark union can permanently record a foreign envelope name, which a later removal then deletes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1572-1587`
(narrow half at `:1946-1948`)

**Issue:**
`markUpdateInProgress` now persists

```ts
sRecord.resources.workflows = [
  ...new Set([...sRecord.resources.workflows, ...handles.workflows.result.stagedNames]),
];
```

and `withStateGuard` **saves** that record before phase 3a runs. `stagedNames` is
the *prepared* list (`stage.ts:196-204`) — names the commit has not yet placed and
may be forbidden from placing.

Before this phase every writer of `resources.workflows` recorded only names the
commit reported through `onPlaced`: install (`install.ts:1234`), reinstall
(`reinstall.ts:984`), enable (via the install ledger). That gave the bridge a hard
invariant — *the record only names envelopes this extension actually placed* — and
the entire foreign-content protection depends on it:

- `assertTargetsUnoccupied` refuses a target that is occupied *after*
  `displacePreviousTargets` has moved every `_previousNames` target aside
  (`stage.ts:305-317`). A name in `_previousNames` is therefore **never**
  ownership-checked; it is renamed aside and, on a successful commit, deleted with
  the staging root.
- `unstagePluginWorkflows` unlinks strictly by recorded name with no marker, no
  content check and no ownership check (`unstage.ts:41-53`).

The narrow half at `:1946` handles the ordinary failure exit correctly (it drops the
un-placed name, and its own comment names exactly this hazard). But it only runs if
`finalizeUpdateRecord` runs. A crash, kill or power loss anywhere in the
intent-mark → phase-3a → finalize window — the window the intent mark exists to
survive — leaves the union on disk permanently. There is no reconcile pass that
re-narrows it.

Concrete loss sequence:

1. The user (or another plugin) has a hand-saved envelope at
   `<workflowsSavedDir>/<plugin>:foo.json`.
2. `update <plugin>` prepares `<plugin>:foo`; the intent mark writes and saves
   `resources.workflows ∋ "<plugin>:foo"`.
3. The process dies before finalize.
4. Any later `uninstall`/`disable` unlinks the foreign file
   (`unstage.ts:52`); any later `update`/`enable`/`reinstall` passes it as
   `previousWorkflowNames`, so `displacePreviousTargets` renames it into
   `.previous/` and the successful commit's `cleanupStaging` deletes it.

The user's file is destroyed silently — the exact outcome WR-06's occupancy refusal
exists to prevent, reached by routing around the refusal through the record.

The design note at `:1578-1582` justifies over-naming with "removal and re-staging
are both ENOENT-tolerant, so a name that never landed costs a no-op". That is true
only for a name nothing else owns; it is false precisely for the collision case the
occupancy pre-check was written for.

**Fix:** do not let an unverified name enter the owned inventory. Cheapest correct
option — move the occupancy question into prepare and union only names that are
provably safe:

```ts
// In prepareStageWorkflows (or a new exported probe), record per-pair whether the
// target is absent or already in `_previousNames`. Expose it on the handle, e.g.
// `result.unownedNames: readonly string[]`.

sRecord.resources.workflows = [
  ...new Set([
    ...sRecord.resources.workflows,
    ...handles.workflows.result.stagedNames.filter(
      (n) => !unowned.has(n), // a target occupied by content this plugin does not own
    ),
  ]),
];
```

Alternative, if the prepare-time probe is unwanted: persist the pending names under
a distinct provisional key (e.g. `compatibility.notes` payload or a new
`resources.workflowsPending`) that only update's own crash-recovery reads, and that
`cascadeUnstagePlugin` / `prepareStageWorkflows` never treat as owned inventory.
Whichever route, add a test that plants a foreign envelope at a generated name,
kills the update between the intent mark and finalize, and asserts a subsequent
`uninstall` leaves the foreign file on disk.

## Warnings

### WR-01: A staging-cleanup leak on a *successful* workflows commit makes the record over-name retired envelopes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2208-2219`
(consumed at `:1946-1948`)

**Issue:** `commitUpdateWorkflows` converts a non-`undefined` return from
`commitPreparedWorkflows` — which means *the commit fully succeeded but the
recursive `rm` of the staging root failed* — into a `phase: "workflows"`
`Phase3Failure`. `finalizeUpdateRecord` then sees `failedPhases.has("workflows")`
and takes the failure branch, writing `previous ∪ placed`.

On that path `placed === staged`, so the record keeps every previous name the
commit just retired. Those envelopes are no longer at their target paths (they are
in the leaked `<stagingRoot>/.previous/`), so the record now names files that do
not exist. Two user-visible consequences:

- `retiresWorkflowCommand` on the **next** update sees those names in
  `previousNames` and not in `stagedNames`, so it stamps a false
  `{stale workflow command}` token.
- `composeStateOnlyComponents` (`info.ts:1298`) renders `record.resources.workflows`
  verbatim, so `info` lists phantom `workflows:` entries.

The leak-as-failure shape mirrors the skills/agents arms, so the classification
itself is consistent; the defect is that the *record* branch keys off
`failedPhases`, which conflates "the commit failed" with "the cleanup leaked".

**Fix:** distinguish the two. Keep the leak in `failures` for the aggregate/row, but
carry the commit's own verdict for the record write:

```ts
async function commitUpdateWorkflows(...): Promise<{
  readonly failure: UpdatePhase3Failure | undefined;
  readonly committed: boolean;          // false only when the commit threw
  readonly placedNames: readonly string[];
}>
```

and in `applyPerBridgeResources` narrow on `committed` rather than
`failedPhases.has("workflows")`.

### WR-02: The `Phase 3a` doc block is orphaned; `commitUpdatePhase3a` is now undocumented

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2165-2177`

**Issue:** the block that documents phase 3a (D-03 continue-across-failures, the
six-commit order, per-bridge atomicity) is followed by a blank line, then
`commitUpdateWorkflows`' own JSDoc, then `commitUpdateWorkflows` at `:2194`.
`commitUpdatePhase3a` at `:2227` has no doc comment at all. Any reader — or tooling
— that binds a doc comment to the next declaration now attributes the phase-3a
contract to the single-bridge helper.

**Fix:** move the `Phase 3a: physical replace...` block down so it sits immediately
above `async function commitUpdatePhase3a(` at `:2227`, leaving
`commitUpdateWorkflows` with only its own JSDoc.

### WR-03: Stale comment — `update.ts` now *can* produce a workflows phase-3 failure

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1483-1486`

**Issue:**

```
//    WLIF-02: the `workflows` member is carried so an update re-stage can be
//    REPRESENTED. `update.ts` cannot produce a workflows failure today and
//    gains no behavior from the widening; landing it here is what lets that
//    re-stage arrive without a second type commit.
```

This phase added exactly that producer: `commitUpdateWorkflows` pushes
`{ phase: "workflows", ... }` at `:2212` and `:2222`, and `finalizeUpdateRecord`
branches on it at `:1946`. The comment now tells a future reader the opposite of
what the file does, on the one member whose failure branch is not a no-op.

**Fix:** replace the second paragraph with a present-tense statement, e.g.
`WLIF-02: the workflows member is produced by commitUpdateWorkflows and read by
applyPerBridgeResources, which narrows resources.workflows on it.`

### WR-04: `notify-reasons.ts` misstates who stamps `stale workflow command` and how

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:258-262`

**Issue:** the comment says "The four user-typed retiring verbs (uninstall /
disable / reinstall / update) **each compute their own previous-minus-staged
difference** and stamp it on their own row." Both halves are wrong:

- **Five** verbs stamp the token: `freshEnableRow` (`enable-disable.ts:1244`)
  stamps it too, from `retiresWorkflowCommand` at `:367`. (The parallel comment in
  `notify.ts:245-248` gets this right and names enable separately, so the two
  catalog comments now disagree.)
- Uninstall and disable do **not** compute a previous-minus-staged difference; they
  read `cascade.dropped.workflows.length > 0` (`uninstall.ts:680`,
  `enable-disable.ts:423,463`). `shared.ts:1461-1465` says so explicitly.

This file is the closed-set catalog's documentation of record; a wrong producer list
here is what a later edit will reason from.

**Fix:**

```ts
  // WLIF-06: the retired-workflow-command marker. Five verbs stamp it. The three
  // that RE-MATERIALIZE (enable / reinstall / update) take the
  // previous-minus-placed difference through `retiresWorkflowCommand`; the two
  // that only REMOVE (uninstall / disable) read what their cascade reported
  // dropping. Named here for the proof rather than promoted to a shared topic
  // group. Like the cross-scope pair above, it IS a `ContentReason`.
```

### WR-05: Comment narrates the code shape that was just replaced

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:147-148`

**Issue:**

```
 * `inspect` and `read` land on the same file one step apart, so a shared phrase
 * claimed a read at the site where the `lstat` had not opened anything.
```

`.claude/rules/typescript-comments.md` forbids narration of code that no longer
exists ("A comment describes the code as it stands, not the shape it replaced").
This sentence is a past-tense description of the single-phrase
`readFailureWarning` this diff deleted, and the rule requires restating the
rationale as a present-tense fact about the current code.

**Fix:**

```
 * `inspect` and `read` land on the same file one step apart, so each site states
 * its own phrase: nothing has been opened when the `lstat` fails, so only the
 * `read` site may claim a read.
```

### WR-06: `notifyWithContext` now takes 7 positional parameters, 4 of them optional

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:143-151`;
call site `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:320-328`

**Issue:** the new `advisories` parameter is appended as a 7th positional, forcing

```ts
notifyWithContext(opts.ctx, opts.pi, PENDING_CONTEXT, marketplaces, undefined, undefined, advisories);
```

Two `undefined` placeholders carry no type distinction from each other
(`kind?: "cascade"` and `cardinality?: "single" | "plural"` are both optional
unions), so a transposed argument at a future call site is silently accepted for
`kind`/`cardinality` and only caught for `advisories` if the types happen to
disagree. `CONVENTIONS.md` ("Function Design → Parameters") says to switch to an
`opts` object for anything with optional/named fields; this signature is three
optional trailing fields past that threshold.

**Fix:** collapse the three optionals into one bag, keeping the required four
positional:

```ts
export function notifyWithContext<...>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext,
  rows: readonly MarketplaceRows<Msg>[],
  opts?: {
    readonly kind?: "cascade";
    readonly cardinality?: "single" | "plural";
    readonly advisories?: readonly string[];
  },
): void
```

Existing call sites that pass 4 or 5 arguments migrate mechanically.

## Info

### IN-01: The workflows phase-3 failure message leaks an absolute staging path to the user

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2214`

**Issue:** `msg: \`workflows staging cleanup leak: ${leak}\`` — `leak` embeds
`prepared.stagingRoot` (`stage.ts:414,466`), an absolute path under the user's home
directory. That `msg` reaches the user through
`composePhase3FailureOutcome`'s `notes` / `phaseFailures` (`update.ts:2347,2352`)
without passing `redactAbsolutePaths`, unlike every other workflow-derived string
this phase surfaces. The pre-existing skills/agents arms have the same shape, so
this is a consistency note rather than a regression introduced here.

**Fix:** route phase-failure `msg` through `redactAbsolutePaths` at the render site,
for all six arms at once.

### IN-02: `info` now reads every candidate script body twice, uncapped, on a read-only surface

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1770-1780`
→ `bridges/workflows/discover.ts:185-206`

**Issue:** `previewWorkflows` runs the full discovery pass, which `readFile`s each
candidate and then allocates a second buffer for the UTF-8 round-trip check
(`Buffer.from(source, "utf8").equals(raw)`). `info` is bounded to one plugin across
at most two scopes, so this is not a DoS, but it does mean a read-only,
network-free command now buffers arbitrary-size third-party files — including for
plugins the user has never installed — with no size ceiling.

**Fix:** if a bound is wanted, `stat` first and route anything over a fixed ceiling
into the existing `read` soft-fail channel with a "too large to inspect" reason;
the tense tables already have the slot.

---

_Reviewed: 2026-09-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
