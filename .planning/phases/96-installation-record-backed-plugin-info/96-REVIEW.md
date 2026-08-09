---
phase: 96-installation-record-backed-plugin-info
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/list-manifest-absent.test.ts
findings:
  critical: 1
  warning: 9
  info: 0
  total: 10
status: issues_found
---

# Phase 96: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the diff `5481c5ae^..HEAD` (19 commits) covering the state-only info arm
(INFO-09..12, BOUND-01/02, D-96-01..04). Verification performed: traced
`buildBlock`'s new arm split against `persistence/state-io.ts`'s record schema;
traced `readStateOnlyHookEntries` against the hooks-bridge write site
(`bridges/hooks/stage.ts::writeHookConfig`, `install.ts` `hooksValue = parsed.value`)
and against the hydrate read site (`bridges/hooks/event-router.ts`); verified
`assertPathInside` semantics in `shared/path-safety.ts`; verified the `skipped`
render arm is byte-identical to `shared/notify.ts:2288`; verified
`severity: "warning"` really is load-bearing (`cascadeSeverity` defaults absent
severity to `info`); verified the `emitStateOnlyFetchSkip` call sites against all
four `getPluginInfo` exit paths; ran ESLint over the changed source and the new
suite (clean).

The implementation is careful and the new test suite is unusually strong (whole-message
byte equality, real negative controls, injected-seam zero-call counters rather than
control-flow reading). The defects below are real regressions and boundary
violations the suite does not cover, not stylistic quibbles.

The headline problem is that the phase's own stated invariant -- "the disabled
carve-out runs BEFORE the state-only arm" -- does not hold for the exact record
class the new arm was built to describe (`partially-installed`), and the test that
claims to pin it seeds only the half of the input space where the invariant is true.

Deferrals honored: stale `shared/notify.ts` comments, retired RLD-04/D-08 anchors,
the path-source live-resolver vs persisted-record non-unification, and the
`pluginRow`/notify closed-set architecture are not reported.

## Critical Issues

### CR-01: A DISABLED soft-degraded record escapes the disabled carve-out and renders a false `(partially-installed)` row

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:907-930` (arm),
`:1965-1992` (`partitionDisabledScopes`), gate in
`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:272-276`

**Issue:**
`partitionDisabledScopes` routes a scope away from the new state-only arm only when
`isRecordedButDisabled(record)` is true, and that predicate is
`record.compatibility.installable && !record.enabled`. It therefore returns **false**
for a record that is explicitly disabled but whose install persisted
`compatibility.installable: false` (any soft-degraded / partially-installed plugin,
e.g. one carrying `unsupported: ["lspServers"]`).

That path is reachable: `enable-disable.ts` places no `installable` guard on the
disable branch (`:476` computes `isCurrentlyDisabled` with the same predicate, so a
soft-degraded record never reads as "already disabled"), runs `runDisableBranch`,
unstages every artifact, and stores `toDisabledRecord(...)` -- `enabled: false` with
all five `resources.*` arrays emptied (`state-io.ts:117-127`).

`info` on such a record after its manifest entry disappears now produces:

```text
● mp [user] <no autoupdate>
  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}
```

with `componentsResolved: true` and an empty components map. That is a positive false
claim on a read-only surface: it asserts the plugin is installed *and* that its
component inventory was resolved and is genuinely empty, for a plugin whose artifacts
were deliberately unstaged. Before this diff the same input rendered
`(failed) {not in manifest}` -- also wrong, but not an installed-ness claim. The arm's
own doc comment says `componentsResolved: true` is "load-bearing" precisely because
`false` "would deny components this arm actually knows"; here it affirms an inventory
the arm does not know.

The root predicate defect predates this phase and affects the untouched manifest-backed
arm identically, so it is not a new bug in `isRecordedButDisabled`. What is new is that
this phase (a) added a code path that consumes the predicate to make a stronger claim,
and (b) shipped a guard test that reads as coverage but is not:
`tests/orchestrators/plugin/info-manifest-absent.test.ts:841-863` seeds
`{ version: "1.0.0", disabled: true }`, which the fixture factory turns into
`unsupported: []` -> `installable: true` (`:193, :199`). Only the arm of the predicate
that already works is exercised.

**Fix:** Make the state-only arm's status derivation honor the explicit disable marker
rather than inheriting the `installable`-conditioned predicate. Minimal, local change:

```ts
// info.ts, in buildBlock arm (b)
if (installed !== undefined) {
  // ENBL-02: `enabled: false` is the sole disable marker. `isRecordedButDisabled`
  // additionally requires `compatibility.installable`, so a soft-degraded record
  // that was explicitly disabled reaches here; it must NOT claim installed-ness.
  if (!installed.enabled) {
    return wrapBlock(
      marketplace,
      scope,
      marketplaceDetails,
      /* the disabled-inventory shape, or fall through to the `(failed)` arm */
    );
  }

  return wrapBlock(/* ... buildStateOnlyInstalledRow ... */);
}
```

Preferred alternative (single fix for both arms): widen `partitionDisabledScopes` to
partition on `installed.enabled === false` directly, leaving `isRecordedButDisabled`
for the reconcile planner that needs the `installable` conjunct.

Either way, add the missing fixture axis -- a `disabled: true` **plus**
`unsupported: ["lspServers"]` record -- to
`tests/orchestrators/plugin/info-manifest-absent.test.ts:841`, so the carve-out claim
is pinned across the whole predicate, not half of it.

## Warnings

### WR-01: An NFR-10 containment refusal is folded into `{unreadable}` with no diagnostic, contradicting the file's own stated rule

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:517-539`

**Issue:** The `try` block wraps `assertPathInside`, so a `PathContainmentError` /
`SymlinkRefusedError` raised by a tampered `resources.hooks` slug is caught at `:537`
and classified by `narrowProbeError(err)` -> `"unreadable"` (the classifier has no
containment arm, `shared/probe-classifiers.ts:38-66`). Two problems:

1. It directly contradicts the rule this same file states 500 lines later at
   `:1030-1037`: *"`derivePluginRootForInfo`'s own throws -- the programmer-bug `Error`
   ... AND the `PathContainmentError` from `assertPathInside` -- propagate unmasked ...;
   classifying them as IO probe failures would mis-route a path-escape as a transient
   disk error."* The new reader does exactly the mis-routing that comment forbids.
   `PathContainmentError`'s own class doc (`shared/path-safety.ts:5-8`) says it
   "always propagates loudly".
2. The read-site precedent it claims to mirror does not swallow silently: the hydrate
   path logs the violation before returning
   (`bridges/hooks/event-router.ts:634-641`, `hookDebugLog("hydrate: containment
   violation ...")`). The new reader emits nothing, so an actual tampering attempt is
   indistinguishable from a disk hiccup in both the UI and the debug log.

No read occurs, so this is not an exploitable containment hole -- it is an
observability and consistency defect. `tests/.../info-manifest-absent.test.ts:663`
and the catalog prose codify the `{unreadable}` outcome, so changing the token is a
decision; adding the log is not.

**Fix:** At minimum, emit the diagnostic before folding:

```ts
} catch (err) {
  if (err instanceof PathContainmentError) {
    hookDebugLog(`info: containment violation for hooks slug "${slug}": ${errorMessage(err)}`);
  }

  return { degraded: narrowProbeError(err) };
}
```

Alternatively hoist the `assertPathInside` call out of the `try` and give the
containment arm its own handling, matching `:1030-1037`.

### WR-02: `hookConfigPathFor` is deep-imported past the hooks barrel, which documents it as deliberately private

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:33`

**Issue:** `bridges/hooks/index.ts:25-28` states: *"Private helpers
(`assertNoSymlinkEscapeInHooksSubtree`, `hookConfigPathFor`) are NOT re-exported --
callers use only the two verbs below."* Every other consumer honors that: `install.ts`,
`update.ts`, `reinstall.ts`, `uninstall.ts`, `enable-disable.ts`,
`marketplace/shared.ts`, `reconcile/apply.ts` and `index.ts` all import from
`../../bridges/hooks/index.ts`. Only the new code reaches into
`../../bridges/hooks/stage.ts` to pull the private helper. No ESLint zone rule catches
it (`eslint.config.js:204-212` gates direction, not barrel usage), so the boundary is
comment-enforced and the comment is now false.

**Fix:** Either re-export the helper from the barrel and update the barrel comment, or
avoid the dependency entirely -- the expression is one `path.join`:

```ts
const hooksJsonPath = path.join(locations.hooksDir, slug, "hooks.json");
```

which is exactly what the sibling read site already does
(`bridges/hooks/event-router.ts:604`). Do not leave a documented-private helper
consumed across the layer with a stale barrel comment.

### WR-03: `isStateOnlyInfoBlock` infers the producing arm from rendered reason strings, and its tripwire covers only one direction

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2004-2008`

**Issue:** The fetch-skip note is gated on
`status !== "failed" && reasons.includes("not in manifest")`. The comment concedes the
hazard ("a future arm stamping the same reason on a non-failed row would silently
acquire a skip note") and names
`tests/orchestrators/plugin/info-manifest-absent.test.ts` as the tripwire -- but the
only negative control there (`:1110`) asserts a *manifest-declared* plugin emits no
note. That proves the true-negative direction; nothing pins the false-positive
direction, which is the one the comment worries about. A silently acquired skip note is
a `warning`-severity notification on a read-only surface.

`buildStateOnlyInstalledRow` is the sole producer of this shape and could return the
fact instead of hiding it in a string. The block builders already return typed rows;
threading a discriminator costs one field.

**Fix:** Return the arm identity rather than re-deriving it:

```ts
// buildBlock arm (b)
return { ...wrapBlock(...), stateOnly: true } // or a parallel Set<Scope> collected in getPluginInfo

// emitStateOnlyFetchSkip
const skipBlocks = blocks.filter((b) => stateOnlyScopes.has(b.marketplaceScope));
```

If the inference is kept, add the missing control: a fixture whose non-failed row
carries `not in manifest` from some other producer must be impossible-by-construction,
or the assertion must be that `buildStateOnlyInstalledRow` is the unique producer of
that reason on a non-failed row.

### WR-04: `--fetch` accounting is incomplete -- the all-disabled path and declared path-source plugins still swallow the flag

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2143-2147`,
`:2062-2082`

**Issue:** The D-96-04 rationale is explicit: *"A flag that renders identical bytes with
and without it teaches the user it worked, so the request is accounted for out loud."*
Two paths still fail that test after this change:

1. **All-disabled early return** (`:2143-2147`): when every found scope holds the
   disabled marker, `getPluginInfo` emits the disabled cascade and returns before
   `emitStateOnlyFetchSkip` is ever reached. `--fetch` on a disabled git-source plugin
   fetches nothing and says nothing -- byte-identical to a bare run. This is the same
   defect D-96-04 was written to close, on a sibling branch of the same function.
2. **Declared path-source plugin** (`:2062-2066`): the filter is keyed on the state-only
   arm, so a manifest-declared `path`-source plugin under `--fetch` also renders
   byte-identical bytes with no note. `buildInstalledRow` short-circuits at `:1417`
   before any probe exists.

Case 1 is the stronger one: it is an unconditional early return in the function this
diff edited, and the fix is one line.

**Fix:** Move the skip accounting to cover the disabled branch too, and decide
explicitly (in the catalog) whether a non-fetchable *source kind* also warrants the
note:

```ts
if (infoFound.length === 0) {
  const rows: Plural<MarketplaceRows<PluginInfoCascadeMsg>> = disabledBlocks;
  notifyWithContext(opts.ctx, opts.pi, PLUGIN_INFO_CONTEXT, rows);
  emitDisabledFetchSkip(opts, disabledBlocks); // or fold into the cascade as a second row
  return;
}
```

### WR-05: The same marketplace and scope render two different headers in one invocation

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2028-2031`;
catalog `docs/output-catalog.md` `state-only-fetch-skipped`

**Issue:** A single-scope `info --fetch` on a state-only record now prints, in order:

```text
● mp [user] <no autoupdate>          <- standalone info block (marketplaceDetails required)
...
● mp [user]                          <- fetch-skip note (list-arm header, marker omitted when false)
```

`buildFetchSkipBlock` copies `buildDisabledInventoryBlock`'s `details`-only-when-true
convention, and `renderMpHeader` omits the marker entirely when `details.autoupdate`
is false (`shared/notify.ts:1691-1692`), while the standalone info header always
renders `<autoupdate>` / `<no autoupdate>`. The disabled precedent never produced both
headers for the *same* (marketplace, scope) pair in one run; this one does, and the
tests at `:1059` and `:1187` bake the divergence in.

Given the project's recorded position that row/header grammar is a closed-set catalog
concern, two spellings of one header in one command's output is worth a decision rather
than an accident.

**Fix:** Either always stamp `details: { autoupdate }` on the skip block so the marker
tracks the info block, or record the divergence explicitly in the catalog's
`state-only-fetch-skipped` prose (it currently shows the bare header without comment).

### WR-06: The hooks-parse preamble is duplicated, and the copy uses `process.cwd()` where the command's `cwd` is in scope

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:521-526`
(duplicate of `:469-471`)

**Issue:** Five lines -- `ifCtx`, `noopCompileIf`, the `parseHooksConfig(..., { skipIfMap:
true })` call -- are copy-pasted from `readHookSummaryEntries`. Both copies build
`ifCtx` from `process.cwd()` even though `getPluginInfo` receives an explicit
`opts.cwd` (used for `locationsFor`) and the hydrate path threads its `cwd` through for
exactly this purpose (`bridges/hooks/event-router.ts:667-669`). Today the value is
inert because `skipIfMap: true` returns an empty Map without invoking `compileIf`
(`domain/components/hooks.ts:448-450`), so this is latent, not live. But the diff
doubled the number of sites that will be wrong the day `skipIfMap` is dropped, and a
project-scope `info` invoked from a different cwd would then compile predicates against
the wrong project root.

**Fix:** Extract the shared preamble and thread the real cwd:

```ts
function parseHooksForInfo(raw: string, cwd: string): HookConfigParseResult<null> {
  const ifCtx = { homedir: homedir(), cwd, projectRoot: cwd };
  return parseHooksConfig(raw, ifCtx, () => null, { skipIfMap: true });
}
```

and pass `opts.cwd` down from `buildBlock` (which already computes `locationsFor(scope, cwd)`).

### WR-07: `detailsField` construction is duplicated verbatim between the two cascade-block builders

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2028-2030`
(duplicate of `:1938-1940`)

**Issue:** Identical four-line conditional-spread construction in
`buildDisabledInventoryBlock` and `buildFetchSkipBlock`, including the identical
`readonly details?: { autoupdate: boolean }` annotation. The diff took care to extract
`derivePersistedInstalledStatus` for exactly this reason ("so the two arms cannot
drift"); the same reasoning applies here and was not applied.

**Fix:**

```ts
function autoupdateDetails(autoupdate: boolean): { readonly details?: { autoupdate: boolean } } {
  return autoupdate ? { details: { autoupdate: true } } : {};
}
```

### WR-08: `readStateOnlyHookEntries`'s `slugs.length === 0` early return is redundant with the loop it precedes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:509-511`

**Issue:** With zero slugs the `for` loop body never runs and the function returns
`{ entries: [] }`. The caller's guard is
`entries !== undefined && entries.length > 0` (`:981`) and `degraded` is undefined in
both shapes, so `{}` and `{ entries: [] }` render identically. The branch encodes no
behavior. The doc comment sells it as the D-96-03 "truthful split" (real negative vs
marker), but the split is actually carried by `degraded`, not by the presence of
`entries` -- which makes the comment describe a distinction the types do not enforce
and the caller does not read.

**Fix:** Drop the branch, or make the distinction real by returning a discriminated
result (`{ kind: "none" } | { kind: "listed"; entries } | { kind: "degraded"; reason }`)
so the caller cannot conflate the three cases.

### WR-09: `info.ts` contains a literal NUL byte, which makes standard tooling treat the file as binary

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:417`

**Issue:** `const key = \`${drop.event}\0${matcher ?? ""}\`` embeds a raw `U+0000` in the
source (byte offset 17823). `grep` classifies the file as binary and refuses to print
matches, and the review prompt for this phase had to carry a workaround instruction as
a result. This is **pre-existing and outside the diff** (`projectDroppedHookEntries` is
untouched), reported only because it obstructs review and tooling on the file this
phase modifies most heavily.

**Fix:** Use an escape sequence rather than a literal control character:

```ts
const key = `${drop.event} ${matcher ?? ""}`;
```

or switch the composite key to a nested `Map`/`Set<string>` keyed on a printable
separator that cannot occur in an event name.

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
