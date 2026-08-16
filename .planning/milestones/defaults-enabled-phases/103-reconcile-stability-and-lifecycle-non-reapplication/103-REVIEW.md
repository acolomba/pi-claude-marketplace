---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - tests/architecture/no-lifecycle-default-enabled-read.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
findings:
  critical: 1
  warning: 5
  info: 0
  total: 6
status: fixed
fixed:
  - id: CR-01
    commit: e6b03b08
    note: >-
      both halves. The selector returns a discriminated `unreadable` arm that
      TypeScript forces both callers to handle, and the adoption gate now
      receives `sibling: ScopeConfig | undefined` where `undefined` means
      unreadable, never "declares nothing"
  - id: WR-01
    commit: e6b03b08
    note: same root as CR-01
  - id: WR-02
    commit: e6b03b08
    note: the inaccurate lock claim in the helper's doc comment
  - id: WR-03
    commit: 810c2785
    note: >-
      `selectConfigWriteTarget` kept but no longer exported; it is still used
      internally by the declaring-file selector
  - id: WR-04
    commit: e6b03b08
    note: >-
      the selector now returns both files' parses, so each config is read once
      per operation; `readDeclaredEnabled` and `synthesizeAdoptedMarketplaceSource`
      became synchronous as a result
  - id: WR-05
    commit: a05fce3c
    note: the stale reconcile comment invalidated by the reinstall change
intended_behavior_changes:
  - >-
    A flagless verb over an unreadable `claude-plugins.local.json` now aborts
    with `(failed) {invalid manifest}` naming that file, where it previously
    proceeded. This removes an inconsistency rather than adding a restriction:
    `applyReconcile` already treats an invalid `claude-plugins.local.json` as a
    hard block for the whole scope and renders the same row, so the standalone
    verbs were the outlier, guessing around a file the load-time path refuses to
    guess around.
  - >-
    An unreadable sibling config now SKIPS the marketplace adoption write
    instead of coercing the file to empty and synthesizing an entry. Skipping is
    safe because the reconcile pass refuses to plan at all for a scope with
    either file invalid, so no dangling declaration can be acted on before the
    user repairs it.
---

# Phase 103: Code Review Report

**Reviewed:** 2026-08-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the phase-103 diff against `1c997555`: one new shared helper
(`selectDeclaringConfigWriteTarget`), three production call-site fixes
(`install.ts`, `enable-disable.ts`, `reinstall.ts`), one comment-only change in
`reconcile/apply.ts`, one new architecture gate, and ~1700 lines of test.

The three things the brief asked me to look hardest at hold up:

- **Lock discipline is correct.** `selectDeclaringConfigWriteTarget` is called
  from exactly two sites (`install.ts:1610`, `enable-disable.ts:550`), both
  inside an already-open `withLockedStateTransaction`. Neither opens a new
  guard, and `loadConfig` takes no lock of its own, so the `retries: 0`
  re-entrancy hazard is not touched.
- **`targetIsLocal` is derived from the selection, not the flag.** The only
  consumer is `readDeclaredEnabled` (`install.ts:1661-1666`). I traced all three
  arms (`--local` typed; flagless + declared locally; flagless + not declared
  locally) and in each the `localPlugins`/`basePlugins` labelling matches the
  physical file identity. The base-`{}` + local-`{enabled:true}` regression case
  is pinned by a real test.
- **The reinstall guard sits early enough.** It is placed after the
  `oldRecord === undefined` check and before `clonePluginRecord`, the cached
  manifest load, the resolve and every bridge prepare. It returns without
  `tx.save()` on an explicit-save transaction, so `state.json` bytes and mtime
  are untouched, and `runPostSuccessMaintenance` (cache drop + data-dir `rm`)
  never runs. `narrowReason`'s `already disabled` arm is an exact-string match,
  `already disabled` is in `IDEMPOTENT_REASONS` so `skipSeverity` yields `info`,
  matching `update.ts`'s deliberate stance for the same row. No reason collision.

Test quality is high. The fixed-point helper re-reads state and config from disk
after the last pass rather than reusing an in-memory twin; the manifest-flip
control in `update.test.ts` bumps the version through the tier-2 ladder
(`omitPluginJsonVersion: true`) so a stale `(mtimeMs, size)` manifest cache
cannot green the assertion for the wrong reason; the reinstall flip case cannot
use a version control at all and substitutes a direct `loadMarketplaceManifest`
read through the same process cache, which is the right substitution; and every
"the file gained the key" claim is backed by a `loadMergedScopeConfig` read,
which is the only view CFG-02 shadowing cannot fake. I found no vacuous
assertion and no fixed-point pass reusing stale in-memory state.

What is wrong is concentrated in one place: **the new helper collapses "the
local config says the key is not there" with "the local config could not be
read"**, and the two callers were re-plumbed so that the CFG-03 abort now
follows that same collapsed decision. That opens one newly reachable
misbehavior (CR-01) and leaves the phase's own rule violated on the invalid arm
(WR-01). The remaining findings are smaller: an unused export the change
orphaned, an inaccurate lock claim used as load-bearing rationale, redundant
re-reads of the same file inside one lock, and one stale comment in
`reconcile/apply.ts` that the phase's own behavior change invalidated.

Findings are scoped to lines this phase authored or moved. I did not flag the
settled decisions listed in the brief (`--local` still winning, the fourth
flag-aimed write in `maybeWritePluginConfigBack`, the DFEN-08 non-widening, the
missing output-catalog block, or the pre-existing `Phase 65/69` comment).

## Critical Issues

### CR-01: an invalid base config no longer aborts a flagless install/enable/disable, and the marketplace-adoption gate then coerces it to empty

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1610-1626`, `1734-1739`; `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:550-562`, `669-674`

**Issue:**

Before this phase a flagless `installPlugin` / `setPluginEnabled` always aimed
at `claude-plugins.json`, so `loadConfig(targetConfigPath)` inspected the base
file and an invalid base file aborted the whole operation through CFG-03 before
`runInstallLedger` ran. After the change the target follows the declaration, so
when the plugin key is declared in a *valid* `claude-plugins.local.json` the
CFG-03 gate inspects the local file and **the base file is never validated by
the verb at all**.

The base file is not merely unread — it is read and silently coerced. Both
callers pass `siblingConfigPath` (now the base file) to
`synthesizeAdoptedMarketplaceSource`, which does:

```ts
const siblingCfg = await loadConfig(opts.siblingConfigPath);
const sibling: ScopeConfig =
  siblingCfg.status === "valid" ? siblingCfg.config : { schemaVersion: 1 };
```

`loadConfig` never throws — an EACCES, an EIO, a truncated mid-save file, or a
schema violation all return `status: "invalid"` (`config-io.ts:129-165`). So an
invalid base file that *does* declare the marketplace contributes `{}` to the
UAT-05 membership gate, `synthesizeUndeclaredMarketplaceSource` concludes the
marketplace is undeclared, and the caller writes a synthesized
`marketplaces: { [mp]: { source: raw } }` entry into the **local** file. Under
CFG-02 that bare entry replaces the base entry wholesale, so once the base file
is repaired the user's `autoupdate: false` is silently gone and the marketplace
becomes auto-updating — a network-touching setting flipped with no command and
no prompt. This is precisely the hazard the UAT-05 sibling-membership gate was
added to prevent; the change makes it reachable on a path that previously could
not get past CFG-03.

Reachability: (a) the plugin key is declared in a valid `claude-plugins.local.json`,
(b) `claude-plugins.json` is invalid or unreadable, (c) the marketplace is
declared only in that base file. Narrow, but (b) is not exotic — a truncated
write from an editor, a permission change, or a typed `"enabled": "false"`
string all produce it, and the verb reports success either way. It is not
covered by any test in this phase.

**Fix:** keep the CFG-03 abort spanning both physical files whenever the write
target was chosen by declaration rather than by a typed flag. Minimal form —
have the selector surface the arm it currently swallows and let the callers
abort on it:

```ts
// shared.ts
export async function selectDeclaringConfigWriteTarget(opts: {
  readonly locations: ScopedLocations;
  readonly local: boolean | undefined;
  readonly key: string;
}): Promise<
  | { readonly kind: "unreadable-local"; readonly filePath: string }
  | {
      readonly kind: "selected";
      readonly targetConfigPath: string;
      readonly siblingConfigPath: string;
      readonly targetIsLocal: boolean;
    }
> {
  if (opts.local === true) {
    return { kind: "selected", ...selectConfigWriteTarget(opts.locations, true), targetIsLocal: true };
  }

  const localCfg = await loadConfig(opts.locations.configLocalJsonPath);
  if (localCfg.status === "invalid") {
    // We cannot know whether the key is declared here, so we cannot know which
    // file a write would land in. Abort rather than guess the shadowed one.
    return { kind: "unreadable-local", filePath: opts.locations.configLocalJsonPath };
  }
  ...
}
```

and, in `install.ts` / `enable-disable.ts`, route `kind === "unreadable-local"`
into the existing `configInvalid` / `invalid-config` sentinel so the verb
renders the `{invalid manifest}` row it already owns. Then also validate the
sibling before the adoption gate (or skip the adoption write when the sibling
is invalid), so an unreadable file is never read as "declares nothing."

## Warnings

### WR-01: `selectDeclaringConfigWriteTarget` treats an unreadable local config as "not declared locally", re-opening the exact defect the phase fixes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:466-472`

**Issue:**

```ts
const localCfg = await loadConfig(opts.locations.configLocalJsonPath);
const declaredLocally =
  localCfg.status === "valid" && localCfg.config.plugins?.[opts.key] !== undefined;
```

`localCfg.status === "valid" && ...` folds three distinct answers into one:
"the file does not exist" (`absent`), "the file exists and does not declare the
key" (`valid`, no entry), and "we could not read or parse the file"
(`invalid`). Only the first two justify targeting the base file. On the third,
the code guesses, and the guess is the shadowed file.

Concretely: `claude-plugins.local.json` contains
`{"plugins": {"foo@mp": {"enabled": false}}}` but is momentarily unreadable, or
carries a schema violation elsewhere in the file. `/claude:plugin enable foo@mp`
targets the base file, writes `enabled: true` there, and reports success. Once
the local file is readable again its entry replaces the base entry wholesale
(CFG-02), the merged view still reads `enabled: false`, and the next `/reload`
plans a disable. That is the failure the phase's own header comment describes
verbatim — "the verb reports success, the merged view the reconcile planner
reads is unmoved, and the next pass plans the opposite of the command."

The doc comment justifies the collapse by analogy:

> `absent` / `invalid` local arms mean "not declared locally" and yield the base
> target, mirroring the D-18 merge fallback

The analogy does not hold. `config-merge.ts:131-136` is explicit that the merge
does the opposite: *"The merged view never silently swallows the invalid signal:
the caller inspects `base.status` and `local.status` to decide what to do."* The
merge coerces the *contribution* while preserving the *signal*; this helper
coerces both, and unlike the merge it is choosing a write target, not computing
a read.

This is not a regression — a flagless verb wrote the base file before the phase
too — but it is an incomplete fix resting on an inaccurate cited precedent, and
the citation is what will keep a future reader from fixing it.

**Fix:** as in CR-01, distinguish the `invalid` arm and refuse to select a
target from an unreadable file. If the abort is judged too aggressive, at
minimum correct the doc comment to state that the `invalid` arm is a *known
gap* rather than a mirror of D-18, so the claim does not read as settled.

### WR-02: the helper's doc claims a lock exclusion the state lock does not provide

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:445-448`

**Issue:** the comment reads:

> WB-01 / UAT-05: the read is membership-test-only and never serialized back,
> and callers hold the scope lock, so the file inspected here cannot change
> before the write lands.

`withLockedStateTransaction` acquires a `proper-lockfile` advisory lock on
`locations.extensionRoot` with `lockfilePath: locations.stateLockFile`
(`transaction/with-state-guard.ts:156-159`). That excludes other
*pi-claude-marketplace* processes that take the same lock. It does not exclude
anything from writing `claude-plugins.local.json` — that file is user-authored
and is exactly the file a person edits by hand, which is the whole premise of
the reconcile design. So "cannot change before the write lands" is false as
stated.

The claim matters more here than at the pre-existing sites that make it
(`synthesizeAdoptedMarketplaceSource`), because those use the read for a
membership test written back atomically in the same patch, whereas this one uses
it to *decide which file the patch addresses*. A concrete inconsistency: the
selector sees the key present in the local file at T1 and selects it; the user
saves an edit removing that key; `loadConfig(targetConfigPath)` at T2 returns a
config without it, `readDeclaredEnabled` reports `enabled` absent, the install
lands disabled, and the stamp re-creates the key the user just deleted. The
practical impact is small (the outcome still matches the manifest declaration),
but the comment tells a future reader the window does not exist.

**Fix:** soften the claim to what the lock actually buys — mutual exclusion
against other extension processes — and state the residual window explicitly:

```ts
 * WB-01 / UAT-05: the read is membership-test-only and never serialized back.
 * Callers hold the scope's state lock, which excludes other extension
 * processes; it does NOT exclude a user editing the config file, so a
 * concurrent hand-edit between this read and the write is possible. The write
 * itself is atomic, so the worst case is a target chosen from a config one
 * edit old, not a torn file.
```

### WR-03: `selectConfigWriteTarget` is now an unused export

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:401-416`

**Issue:** both former call sites (`install.ts:1551`, `enable-disable.ts:517`
at the base commit) migrated to `selectDeclaringConfigWriteTarget`. A repo-wide
grep over `extensions/` and `tests/` shows the only remaining references are the
two internal delegations inside `selectDeclaringConfigWriteTarget` itself
(`shared.ts:463`, `shared.ts:470`). No production caller, no test caller.

Nothing in `npm run check` catches this: `@typescript-eslint/no-unused-vars`
does not analyse exports, and `noUnusedLocals` does not apply to exported
declarations. So the module's public surface silently grew a second, subtly
different write-target selector that a future caller can pick by mistake —
which is precisely the "aim the write with the flag" defect this phase spent
three call sites removing.

**Fix:** drop the `export` keyword so the compiler enforces its
internal-helper role:

```ts
function selectConfigWriteTarget(
  locations: ScopedLocations,
  local: boolean | undefined,
): { readonly targetConfigPath: string; readonly siblingConfigPath: string } {
```

If a test needs it, expose it under the file's established `__test_*` seam
convention rather than as a plain export.

### WR-04: the local config file is read two to three times per operation inside one lock

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1610-1622`, `1661-1666`, `1734-1739`

**Issue:** for one flagless `installPlugin` call, `claude-plugins.local.json` is
opened and parsed:

1. by `selectDeclaringConfigWriteTarget` (membership probe), then
2. either by `loadConfig(targetConfigPath)` (when it was selected) or by
   `readDeclaredEnabled`'s sibling read (when it was not), and
3. again by `synthesizeAdoptedMarketplaceSource`'s sibling read.

Each read re-parses and re-validates against the compiled typebox schema, and
each can observe different bytes (see WR-02). Beyond the waste, the three reads
are three independent chances for the decision inputs to disagree — the sort of
divergence the phase's own `install.ts:1593-1609` comment argues against for
`targetIsLocal` ("asking it is exact where any second derivation is a chance to
disagree"), applied to the file identity but not to the file contents.

`enable-disable.ts` has the same shape at `550`, `558` and `669-674`.

**Fix:** have the selector return the `ConfigLoadResult` it already fetched, so
the callers thread one parse through the whole closure:

```ts
// returns { targetConfigPath, siblingConfigPath, targetIsLocal, localCfg }
const { targetConfigPath, siblingConfigPath, targetIsLocal, localCfg } =
  await selectDeclaringConfigWriteTarget({ locations, local: opts.local, key });
```

and pass `localCfg` into `readDeclaredEnabled` / `synthesizeAdoptedMarketplaceSource`
instead of letting each re-read. This also makes the `invalid` arm from CR-01 /
WR-01 available to every consumer at no extra I/O cost.

### WR-05: `reconcile/apply.ts`'s `skipped` arm comment was invalidated by this phase's reinstall change and not updated

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1251-1256`

**Issue:** the phase deliberately rewrote the ENBL-08 comment 100 lines above
(`apply.ts:1150-1159`) to account for reinstall's new refusal, but left this one:

```ts
if (outcome.partition === "skipped") {
  // Benign concurrent uninstall: the record was removed under us, so there is
  // no promotion row and nothing to retry -- NOT a failure. The gate may still
  // close.
  return false;
}
```

`reinstallPlugin` now has a *second* way to return `skipped` — the new
`isRecordedButDisabled` short-circuit at `reinstall.ts:1230-1241`, which returns
`notes: ["already disabled"]`. That is not a concurrent uninstall.

The arm is still reachable with that meaning: `scanForceInstalledBackfills`
iterates an `ExtensionState` **snapshot** (`apply.ts:1089`, `1100-1101`) while
`reinstallPlugin` self-locks and re-reads fresh state, so a concurrent
cross-process disable between the snapshot and the reinstall lands here. The
`false` return is still the right answer, so this is a correctness-of-comment
issue rather than a behavior bug — but it is exactly the kind of stale narration
the phase's revision of the sibling comment was meant to prevent, and a reader
debugging a skipped backfill will now be told the wrong cause.

**Fix:**

```ts
if (outcome.partition === "skipped") {
  // Two benign shapes reach here and neither is a failure: the record was
  // removed under us (concurrent uninstall), or it was disabled under us
  // between this scan's state snapshot and reinstall's own fresh read
  // (ENBL-05 -- reinstall refuses a disabled record). Either way there is no
  // promotion row and nothing to retry, so the gate may still close.
  return false;
}
```

---

_Reviewed: 2026-08-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
