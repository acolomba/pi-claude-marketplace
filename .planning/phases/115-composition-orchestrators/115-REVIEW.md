---
phase: 115-composition-orchestrators
reviewed: 2026-09-02T04:54:10Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - tests/integration/reconcile-plan-convergence.test.ts
  - tests/orchestrators/edge-deps.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/import/index.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/scope-tree-inventory.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
findings:
  critical: 1
  warning: 11
  info: 0
  total: 12
status: issues_found
---

# Phase 115: Code Review Report

**Reviewed:** 2026-09-02T04:54:10Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

I traced every deleted guard, catch clause, and exhaustiveness arm in the production
diff back to the narrowing that was supposed to replace it, and I built two minimal
TypeScript repros to test the two load-bearing claims the phase rests on. The test
suites are, on the whole, unusually strong: byte-exact authored expectations, sized
notification boundaries, mapped-type outcome tables, typed-class rejection assertions.
Very little of the "tests that cannot fail" class survived here.

The production side is where the defects are, and they share one shape: **a deleted
defense was replaced by a claim of compile-time enforcement that TypeScript does not
actually make.**

Two experiments, both run against this repo's own `tsc`:

1. **A `void`-returning `switch` with a missing arm compiles silently.** Only a
   *value*-returning switch errors on a missing case. So deleting
   `default: assertNever(x)` from a `void` function deletes the exhaustiveness proof
   outright; deleting it from a value-returning function is safe. The phase did both,
   and the surviving comments do not distinguish them.
2. **An overload signature whose return type is narrower than the implementation's is
   accepted with no error, even when the implementation demonstrably returns the
   excluded value on that path.** The D-115-10 overload pair is therefore an *unchecked
   assertion*, not a proof.

Answering the three questions the brief posed directly:

- **Claim 3 (unreachable-arm removal that went too far):** partly. Three removals are
  genuinely safe; three are not. `.planning/WINDOWS.md` records **one** of the residual
  exposures (#9, the removed catches) and understates its blast radius. It does not
  record CR-01, WR-01, WR-03, or WR-04. The list is **not complete**.
- **Claim 4 (D-115-10 is type-level only):** the *runtime-neutrality* half is true —
  overloads erase, the implementation signature is untouched, and I verified every
  orchestrated arm of `addMarketplace`, `removeMarketplace`, `uninstallPlugin`, and
  `setPluginEnabled` returns a defined outcome today. The *soundness* half is false; see
  WR-01.
- **Claim 5 (real correctness bugs in the diffs):** I found no live behavioral defect.
  The `import/execute.ts` sibling-map restructuring is order-preserving and, given the
  planner's construction, header-complete. The `reconcile/apply.ts` cascade ordering is
  unchanged. Every finding below is a latent exposure, a lost gate, or a quality defect.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review, so there is no
structural pre-pass substrate to reconcile against. I did run `fallow dupes` directly
to check one narrative finding (WR-08) that a gate might otherwise have covered; the
result is reported inline there.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `installOnePlannedPlugin` lost its exhaustiveness gate, and the comment left behind claims the opposite

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:667-697`

**Issue:**

The removal of `default: assertNever(outcome)` was justified in the surviving comment:

```ts
// Switch rather than an `if (failed) ... return` fall-through: a third
// `InstallPluginOutcome` arm must become a compile error here, not get
// counted as a successful install in the cascade totals. D-05: the union has
// exactly the two arms below, so TypeScript proves the switch exhaustive and
// the former `default: assertNever(outcome)` was unreachable dead code.
switch (outcome.status) {
  case "failed":  ... return;
  case "installed": ... return;
}
```

`installOnePlannedPlugin` returns `Promise<void>`. TypeScript **does not** check a
`switch` for exhaustiveness in a `void`-returning function — it only does so when the
declared return type forces a value on every path. I verified this against this repo's
own compiler:

```ts
type Outcome = { kind: "a" } | { kind: "b" } | { kind: "c" };

function apply(o: Outcome): void {
  switch (o.kind) { case "a": return; case "b": return; }
}   // <- compiles clean; "c" silently no-ops

function render(o: Outcome): string {
  switch (o.kind) { case "a": return "a"; case "b": return "b"; }
}   // <- error TS2366: Function lacks ending return statement
```

`tsc --strict` reports the error on `render` only. `apply` is exactly the shape of
`installOnePlannedPlugin`.

So the stated guarantee does not exist. If a third `InstallPluginOutcome` arm is ever
added, this switch falls through, `installOnePlannedPlugin` records the plugin in **no**
result bucket, `buildImportNotificationMarketplaces` renders **no row** for it, and the
`Import: N successes` tally under-counts — with `typecheck`, `eslint`, `fallow`, and the
whole owner suite green. That is precisely the "silently vanishing row" the fail-loud
work in this file was originally built to prevent (see the `recordMarketplaceAddFailure`
/ "returned no outcome in orchestrated mode" machinery at `execute.ts:744`).

Two aggravating factors specific to this site, which is why this is the one Critical:

- **No compensating gate exists.** Its twin in `reconcile/notify.ts` (see WR-03) at least
  has `tests/orchestrators/reconcile/notify.test.ts:52-58`, whose `AppliedOutcomeRows`
  mapped type over `PerEntryOutcome["kind"]` makes a new kind a compile error in the
  test file. `tests/orchestrators/import/execute.test.ts` has **no** mapped table over
  `InstallPluginOutcome["status"]` — I grepped for one. Nothing anywhere fires.
- **The comment is actively misleading.** The next editor reading "must become a compile
  error here" has been told they are protected when they are not.

The same class applies to the two sibling removals in this file's dependency, but they
are correctly safe and should be left alone — `importWarningReason` (`execute.ts:343`)
and `blockToMarketplaceMessage` (`execute.ts:515`) both *return values*, so their
narrowed unions genuinely are checked. Do not "fix" those.

**Fix:**

Restore the arm. It costs one line and re-establishes the property the comment already
promises:

```ts
  switch (outcome.status) {
    case "failed":
      dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause);
      return;
    case "installed":
      // ... unchanged ...
      return;
    default:
      // The switch sits in a void-returning function, so TypeScript does NOT
      // prove it exhaustive on its own: a third InstallPluginOutcome arm would
      // fall through and drop the plugin from every result bucket. This arm is
      // what makes that a compile error.
      assertNever(outcome);
  }
```

and re-add `assertNever` to the `shared/errors.ts` import at `execute.ts:14`.

If the phase would rather keep the module free of `assertNever`, the equivalent
alternative is to give the function a value-returning shape (e.g. have it return the
outcome bucket it wrote and have the caller discard it), which restores the TS2366
check. Either way, correct the comment to say which mechanism is doing the work.

## Warnings

### WR-01: the D-115-10 overloads are unchecked assertions, not compile-time proofs

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:519-526`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:639-646`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:492-499`

**Issue:**

Each of the three overload pairs declares an orchestrated-mode return of
`Promise<TOutcome>` over an implementation typed `Promise<TOutcome | undefined>`.
TypeScript checks overload signatures against the implementation only *loosely*: a
narrower overload return is accepted with no diagnostic, and the compiler never verifies
that the implementation body honours it. I confirmed this against this repo's compiler
with a body that deliberately violates the contract:

```ts
export function f(o: Opts & { notifications: { mode: "orchestrated" } }): Promise<Outcome>;
export function f(o: Opts): Promise<Outcome | undefined>;
export async function f(o: Opts): Promise<Outcome | undefined> {
  if (o.notifications?.mode === "orchestrated") { return undefined; }  // violates overload 1
  return { status: "ok" };
}
const r = await f({ notifications: { mode: "orchestrated" } });
return r.status;   // no guard, no error
```

`tsc --strict --noEmit` exits **0**. The narrowing is functionally a relocated non-null
assertion: the phase context states the `reconcile/apply.ts` guards were deleted
"WITHOUT a non-null assertion", but the assertion was not removed — it was moved from the
consumer to the producer's signature, where nothing checks it either.

This matters because three runtime guards were deleted on the strength of it
(`apply.ts` marketplace-remove, plugin-uninstall, and — via the earlier Y3 cut — the
toggle loop). If any orchestrated path ever returns `undefined`, `foldRemoveOutcome`
receives `undefined` or `result.status` dereferences `undefined`.

I traced all four producers and **every orchestrated arm currently returns a defined
outcome**, so this is latent, not live:

- `add.ts` — `handleAddFailure` (`add.ts:459-484`) returns a typed outcome on both the
  classified and unclassified branches when `orchestrated`; the success arm returns at
  `add.ts:597`. The `rethrowPreconditionErrors` branch throws rather than returning
  `undefined`, which does not violate the overload.
- `remove.ts` — `resolveScopeOrFailedOutcome` (`remove.ts:184-214`) returns
  `{ scope, locations } | RemoveMarketplaceOutcome` with no `undefined` arm;
  `emitPartialFailure`, `surfaceCfgInvalid`, and the clean arm all branch on
  `orchestrated` first.
- `uninstall.ts` — including the deliberate `{ status: "converged" }` at
  `uninstall.ts:464`.
- `enable-disable.ts` — `emitResolutionFailure` (`enable-disable.ts:814`) and the
  transaction catch both return typed outcomes.

**Fix:** the overloads are worth keeping — they do improve call sites — but the
invariant needs a real enforcement point. Cheapest option, one per module: keep the
implementation signature honest and make the orchestrated arm structurally total by
splitting the entrypoint, so the narrow overload delegates to a function whose *declared*
return type is `Promise<TOutcome>`:

```ts
export function addMarketplace(
  opts: AddMarketplaceOptions & { notifications: { mode: "orchestrated" } },
): Promise<AddMarketplaceOutcome>;
export function addMarketplace(
  opts: AddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined>;
export async function addMarketplace(
  opts: AddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined> {
  const result = await addMarketplaceInner(opts);       // : AddMarketplaceOutcome | undefined
  return result;
}
```
where the orchestrated arms are lifted into a helper returning
`Promise<AddMarketplaceOutcome>` and the standalone arms into one returning
`Promise<undefined>`. TypeScript then checks each half.

If that restructuring is out of scope for this phase, record the exposure in
`.planning/WINDOWS.md` alongside #9 — it is currently absent — and note in each doc
comment that the narrowing is asserted, not proved.

### WR-02: three per-entry catch clauses removed from the load-time reconcile, with no seam that lets any test plant the throw

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:282-320`
(`applyMarketplaceAdds`), `:377-491` (`applyPluginInstalls`), `:541-608`
(`applyPluginToggles`)

**Issue:**

`.planning/WINDOWS.md` #9 records this removal, so the team is aware of it. Two things
the ledger entry does not capture, both of which change how serious it is:

1. **The blast radius is not "one entry loses its failed row" — it is the whole
   reconcile.** `applyPlan` is called bare inside `applyReconcile`'s per-scope loop
   (`apply.ts:756`), unlike its neighbours `applyBackfillForScopeIsolated` and
   `rebuildScopeRoutingTableIsolated`, which are both wrapped in `runScopeIsolated`, and
   unlike the read pass, which has its own `try` at `apply.ts:744`. An escape from any of
   the three uncaught loops therefore: aborts the remaining entries in that bucket, skips
   backfill and the routing-table rebuild for that scope, skips the sibling scope
   entirely (project runs first, so a project-scope throw means user scope never
   reconciles), and **discards every outcome accumulated so far** because
   `notifyReconcileAppliedWithContext` at `apply.ts:816` is never reached. The user gets
   a raw error out of `resources_discover` instead of a cascade.
2. **No test can ever prove the loops safe.** `installPlugin`, `addMarketplace`, and
   `setPluginEnabled` are static imports (`apply.ts:60-63`) and `ApplyReconcileOptions`
   exposes no injection seam for them, so `tests/orchestrators/reconcile/apply.test.ts`
   physically cannot plant a throwing collaborator. Contrast the two loops that kept
   their catch, which *are* covered — `apply.test.ts:2520` and `:2569` drive the
   half-written-state-file case through `raceStateFromRead`. This is the failure mode
   `CONVENTIONS.md` warns about: "a gate wants a test that plants the violation."

I traced all three entrypoints and could not reach a live escape today, which is why this
is a Warning and not a Blocker. The reasoning in the new header comment is accurate as
far as it goes. Two things it does not mention, which narrow the margin:

- `installPlugin` has one awaited statement outside its `try`
  (`install.ts:2372`, `collectPostCommitWarnings`) plus `buildInstalledOutcome`, both of
  which dereference `installCtx`, declared with a definite-assignment assertion
  (`install.ts:1930`). It is safe only because `runInstallLedgerBody` returns a
  two-armed union — an invariant in a different function 500 lines away.
- `handleInstallThrow` (`install.ts:1864`) composes a full failure message *before* the
  `if (orchestrated)` branch and then discards it on the orchestrated path. Any future
  throw added inside `composeInstallFailureMessage` would escape from inside the
  entrypoint's own catch handler.

**Fix:** either restore the three catches (they cost four lines each and
`classifyOrchestratorThrow` is still imported and used by the surviving loops), or —
better, and consistent with the DI convention in `CONVENTIONS.md` — add the three
orchestrators to `ApplyReconcileOptions` as optional injected collaborators exactly as
`ImportDeps` does in `import/execute.ts:158-168`, and add one owner case per loop that
injects a throwing collaborator and asserts a single `(failed)` row plus an otherwise
intact cascade. The second option converts an unenforced comment into a planted-violation
gate.

### WR-03: three `default: assertNever` arms removed from `void`-returning switches in the reconcile projection

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:729`
(`applyMarketplaceOutcomeToBlock`), `:833` (`applyPluginOutcomeToBlock`), `:861`
(`applyOutcomeToBlock`) — all three now end without a `default`

**Issue:**

All three functions return `void`, so — per the CR-01 proof — TypeScript no longer
proves any of their switches exhaustive. Adding a member to `PerEntryOutcome` now
compiles clean at all three sites and the outcome silently produces no row. The comments
that were deleted said so in as many words:

```
// The caller's own `assertNever` only proves the OUTER union is fully
// routed; without this arm a newly-added plugin-subject kind would be
// widened into the `Extract<>` above and silently drop the row.
```

The deleted comment was correct, and the reasoning that replaced it (the `Extract<>`
parameter type makes the switch exhaustive) is true of the *union* but not of the
*check*: exhaustiveness of a `void` switch is unenforced regardless of how narrow the
union is.

This is a Warning rather than a Blocker only because a real compensating gate exists:
`tests/orchestrators/reconcile/notify.test.ts:52-58` defines `AppliedOutcomeRows` as a
mapped type over `PerEntryOutcome["kind"]`, and `:422` iterates every cell with an exact
`deepStrictEqual`. A new kind fails to compile in the test file until a cell is added,
and the cell's hand-authored `expected` then fails at runtime because the production
switch no-ops it. That gate does hold — but it is weaker than the deleted one in two
ways: it fires in a different file from the edit, and it only fires if the author
hand-authors the expected value rather than pasting the actual output.

The fourth removal in this file — the `default: assertNever` and `case undefined:` in
`blockToMarketplaceMessage` (`notify.ts:139-170`) — **is** correctly safe, because that
function returns a value. Leave it.

**Fix:** restore the `default: assertNever(outcome)` arm on all three `void` functions,
with a comment naming the actual mechanism:

```ts
    default:
      // This switch returns void, so TypeScript does not prove it exhaustive on
      // its own. A newly-added PerEntryOutcome kind would fall through and drop
      // the row; this arm is what makes that a compile error at the edit site.
      assertNever(outcome);
```

and restore the `assertNever` import at `notify.ts:43`.

### WR-04: plugin rows whose (scope, marketplace) key has no header are now silently discarded

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:498-502`,
with the invariant documented at `:283-296`

**Issue:**

Moving plugin rows into the sibling `rowsByMp` map means the render pass iterates
`byMp` and looks rows up by key:

```ts
    [...byMp.values()]
      .sort((a, b) => compareByNameThenScope(a, b))
      .map((block) => blockToMarketplaceMessage(block, rowsByMp.get(block.key) ?? []))
```

The `?? []` fallback is the problem: any entry in `rowsByMp` whose key is absent from
`byMp` is never visited and its rows vanish without trace. Before the change,
`ensureMarketplaceBlock` created the header on demand from the row loops and
`blockToMarketplaceMessage`'s `case undefined:` arm rendered a plain list header, so
orphan rows still reached the user.

I verified the invariant holds today. Every `pushMarketplaceRow` call site is reachable
only for a plugin in `scopePlan.pluginsToInstall` that passed the `blockedMarketplaces`
gate at `execute.ts:810`, and `scopedPlan` (`import/marketplaces.ts:132-158`) derives
`pluginsToInstall` and `marketplacesToEnsure` from the same `refs` set under one
`input.scope`, so the keys always match and the ensure loop always assigns a status on
every non-blocking path. Ordering is also unchanged: the final `.sort` is by
`(name, scope)`, which is the map key, so no tie can expose insertion order.

But that is a four-function invariant with nothing structural behind it, and the doc
comment overstates what is enforced:

> `status` is REQUIRED: every marketplace that reaches the cascade carries a
> marketplace-level outcome ... so a row can never conjure a header carrying no outcome.

Making `status` required prevents a *statusless header*. It does not prevent a *headerless
row* — the `?? []` is what quietly absorbs that case. The `unknown-stored` branch at
`execute.ts:585-598` is already an existing marketplace that gets no status and no rows;
one edit that stops blocking it (or a fourth `samePlannedSource` token added to that
`void` switch, which is unguarded for the same reason as CR-01) turns it into a silent
row drop.

**Fix:** make the drop impossible rather than documented. Iterate the union of both key
sets and fail loud on a headerless row:

```ts
  const blocks = [...byMp.values()].sort((a, b) => compareByNameThenScope(a, b));
  const rendered = new Set(blocks.map((b) => b.key));
  for (const key of rowsByMp.keys()) {
    if (!rendered.has(key)) {
      throw new Error(`import cascade: plugin rows for ${key} carry no marketplace header`);
    }
  }

  return Object.freeze(
    blocks.map((block) => blockToMarketplaceMessage(block, rowsByMp.get(block.key) ?? [])),
  );
```

A cheaper alternative that keeps the module throw-free is to keep the `?? []` but assert
`rowsByMp.size <= byMp.size` and route a mismatch into `pushDiagnostic`. Either way,
soften the doc comment so it describes what is enforced.

### WR-05: "touches the config file once" asserts "at least once"

**File:** `tests/orchestrators/import/execute.test.ts:1783-1822`

**Issue:**

```ts
test("touches the config file once for a multi-entry batch", async (t) => {
  ...
  assert.ok(after.mtimeMs > before.mtimeMs, "the post-pass should have rewritten the config once");
```

`mtimeMs > before.mtimeMs` is satisfied by one write, by three writes, and by thirty. The
property in the test title, the property in the assertion message, and the property the
WB-03 batched post-pass actually promises ("exactly ONE saveConfig call", `execute.ts:855`)
are all "once" — and none of them is what is checked. The test cannot fail if the batching
regresses into a per-entry write loop, which is the single regression it exists to catch.

Secondary: the case is otherwise a verbatim duplicate of the preceding test at `:1740`
(same arrange, same act, same `assert.strictEqual(readFile(...), expectedBytes)`), so its
only unique contribution is the one assertion that does not discriminate. And on a
filesystem with coarse `mtime` granularity a same-millisecond rewrite makes `>` false, so
the assertion is simultaneously too weak for its stated property and mildly flaky.

**Fix:** count the writes instead of timing them. The suite already has the machinery —
`raceStateFromRead` in `apply.test.ts:487-513` shows the `createRequire` +
`t.mock.method` + `syncBuiltinESMExports` pattern. Applied here:

```ts
  const writes = countWritesTo(t, project.configJsonPath);   // wraps fs.rename / writeFile
  await importClaudeSettings({ /* ... */ });
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  assert.strictEqual(writes(), 1);
```

If intercepting the atomic writer is judged too invasive, drop the `mtimeMs` assertion
and delete the test — the preceding case already pins the resulting bytes, and a test
that names a property it does not check is worse than no test.

### WR-06: an unrecognized stored source reports "(no marketplaces)" at info severity

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:585-598`,
locked in by `tests/orchestrators/import/execute.test.ts:932-977`

**Issue:**

When a recorded marketplace's stored source is in an unrecognized format,
`reconcileExistingMarketplace` blocks it, records a diagnostic, and sets no status. The
diagnostic has no notification representation by design (`execute.ts:491-493`), so the
user's entire `/claude:plugin import` renders:

```
(no marketplaces)
```

with no severity argument — i.e. **info**. The owner test asserts exactly that. Per the
project's tri-state severity model (info = desired state reached), the command reports
that nothing needed doing, when in fact a marketplace and all of its declared plugins
were skipped because of a real, actionable data problem the user is being told nothing
about. The remedy text ("Verify state.json or remove and re-add the marketplace") exists
and is well written — it just never reaches a human.

The behaviour predates this phase, but the phase hardened it: `RenderedWarningReason`
(`execute.ts:338-341`) now makes routing this class of reason to a row a compile error,
and the new owner case pins the silence as the contract.

**Fix:** give the blocked marketplace a `failed` header carrying an existing closed-set
reason so the row appears in the cascade:

```ts
    case "unknown-stored":
      blockedMarketplaces.add(marketplace.marketplace);
      result.marketplaceFailures.push({
        kind: "marketplace-failure",
        scope: marketplace.scope,
        marketplace: marketplace.marketplace,
        reason: "add-failed",
        cause: "unrecognized stored source format",
      });
      pushDiagnostic(/* unchanged */);
      break;
```

That reuses the existing `marketplaceFailures -> setMarketplaceStatus("failed")` path at
`execute.ts:397-399` with no new vocabulary, and updates the owner test's expected
cascade from `"(no marketplaces)"` to a real `⊘ mp [user] (failed)` row. If the silence
is genuinely intended, say so in the doc comment and cite the decision — right now the
comment reads as though the diagnostic is a sufficient channel, and it is not one the
operator can see.

### WR-07: `remove.ts` carries an `if` whose two branches return the same value

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:511-518`

**Issue:**

```ts
  if (orchestrated) {
    const r = await resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);
    if ("status" in r) {
      return r;
    }

    return r;
  }
```

Both arms of the inner `if` return `r` unchanged. The branch is pure noise; it reads as a
narrowing that was needed once and is no longer, and it survives every gate because it is
not dead *code*, just dead *branching*. It sits directly in the resolver the D-115-10
overload contract depends on (WR-01), which is precisely the function a future reader
will be auditing for whether an `undefined` can escape — and this branch makes that audit
harder than it needs to be.

Pre-existing, not introduced by this phase, but `remove.ts` is in scope and the phase
edited it.

**Fix:**

```ts
  if (orchestrated) {
    return resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);
  }

  return resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);
```

### WR-08: ~50 lines of byte-identical notification-boundary scaffolding duplicated across the new owner suites

**File:** `tests/orchestrators/import/execute.test.ts:74-128`,
`tests/orchestrators/reconcile/pending.test.ts:36-90`,
`tests/orchestrators/reconcile/apply.test.ts:88-128` (near-identical variant with one
extra parameter), `tests/orchestrators/plugin/bootstrap.test.ts:103` (third variant)

**Issue:**

I diffed `pending.test.ts:36-90` against `execute.test.ts:74-128`: **byte-identical
except for four lines of doc comment**. That is the `NotificationSeverity` /
`NotificationUi` / `Notification` / `NotificationBoundary` declarations plus the whole
`createNotificationBoundary` factory, copied verbatim. `apply.test.ts` carries the same
block with a `toolProbes` parameter added; `bootstrap.test.ts` carries a third spelling.

I ran `fallow dupes` directly to check whether the gate covers this. It does scan `tests/`
(it reports the two `tests/live-uat/*.mjs` clone groups), but the JSON output contains no
reference to `import/execute.test.ts`, `reconcile/pending.test.ts`, or
`reconcile/apply.test.ts`. The gate does not see this clone, so it is exactly the class of
finding the review is asked to surface.

This matters beyond aesthetics: the four copies encode the *same* contract — "one
soft-dep probe per emission, two `getAllTools()` reads per probe" — and that contract
belongs to `shared/notify.ts`. When the probe count changes, four unrelated suites break
in four places, and the odds of one drifting into a wrong `times()` count (which silently
weakens the IL-2 sizing proof rather than failing loudly) are high. The phase itself set
the right precedent by extracting `retryTree` into
`tests/orchestrators/plugin/scope-tree-inventory.ts` for exactly this reason, and
`CONVENTIONS.md` names `tests/helpers/` as the home for shared mock factories.

**Fix:** extract one `tests/helpers/notification-boundary.ts` exporting the four types
plus a single factory whose signature covers all callers:

```ts
export function createNotificationBoundary(
  emissions: number,
  toolProbes = emissions * 2,
): NotificationBoundary
```

`apply.test.ts` already uses that exact signature, and the other three call sites pass
only `emissions`. Keep the per-suite doc comments where they explain suite-specific
reasoning; move the mechanism.

### WR-09: cross-references this phase's own renames invalidated

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:465`,
`:565`; `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:82`

**Issue:**

Three cross-module references now point at the wrong thing, all as a direct result of
this phase's edits to `import/execute.ts`:

- `apply.ts:465` — "mirrors `import/execute.ts:699-703` pushDiagnostic channel". Lines
  699-703 are now the middle of `addOnePlannedMarketplace`'s doc comment. The
  `pushDiagnostic` call is at `execute.ts:693`.
- `apply.ts:565` — "without duplicating the `import/execute.ts:613` fail-loud wording".
  Line 613 is now inside `reconcileExistingMarketplace`'s source-mismatch branch. The
  "returned no outcome in orchestrated mode" string is at `execute.ts:744`.
- `reconcile/README.md:82` — claims `import/execute.ts` shares "the same `MarketplaceBlock`
  shape, same `ensureMarketplaceBlock(byMp, scope, mpName)` factory". Both are now false:
  this phase renamed the factory to `setMarketplaceStatus` / `pushMarketplaceRow` and
  split the rows into a sibling map, so `MarketplaceBlock` no longer carries `plugins`
  and `ensureMarketplaceBlock` exists only in `reconcile/notify.ts`. I grepped the whole
  tree — this README line is the sole stale reference to the deleted name.

Line-number citations into a sibling module are a rot generator by construction; the two
in `apply.ts` were already fragile and this phase broke both in one commit.

**Fix:** replace all three with symbol references, which survive edits:

- `apply.ts:465` — "mirrors the `pushDiagnostic` channel in
  `import/execute.ts::installOnePlannedPlugin`"
- `apply.ts:565` — "without duplicating the fail-loud wording in
  `import/execute.ts::addOnePlannedMarketplace`"
- `README.md:82` — drop the `ensureMarketplaceBlock` and `MarketplaceBlock` clauses;
  the `compareByNameThenScope` final sort and the block/rows-then-sort structure are
  still shared and are the parts worth citing.

### WR-10: the import barrel is not the single entry it was made production-reachable to be

**File:** `extensions/pi-claude-marketplace/orchestrators/import/index.ts`,
`extensions/pi-claude-marketplace/edge/types.ts:20`

**Issue:**

D-115-01 pruned the barrel to the two symbols the import command consumes and repointed
`edge/handlers/plugin/import.ts` at it, which is what let eight `fallow-ignore` markers
be deleted — a good trade. But `edge/types.ts:20` still imports from
`../orchestrators/import/execute.ts` directly. The edge layer therefore reaches the same
module by two different paths, and `tests/orchestrators/import/index.test.ts` pins the
barrel's export surface (`ImportRuntimeExport satisfies "importClaudeSettings"`,
`index.test.ts:21`, plus seven `@ts-expect-error` negatives) as though it were the sole
door.

The consequence is narrow but real: the barrel test's negatives now guard a surface that
one production file bypasses, so "the barrel does not re-export X" no longer implies "the
edge layer cannot reach X". A future edge file that needs `buildClaudeImportPlan` will
reach for `execute.ts` directly, the barrel negatives will stay green, and the boundary
the test exists to describe will have quietly moved.

For the record, the type-level evidence in `index.test.ts` is otherwise correct — I checked
the placement of all eight `@ts-expect-error` directives. Each covers exactly one line,
each has exactly one error site on it, and the self-comparison at `:59-60`
(`Same<importBarrel.EnabledPluginRef, importBarrel.EnabledPluginRef>`) does behave as its
comment claims: the missing member is the only cause of failure, so re-adding the type
export leaves the suppression unused and breaks `typecheck`. No "evidence attached to
nothing" in this file.

**Fix:** repoint `edge/types.ts:20` at `../orchestrators/import/index.ts` so the barrel is
the only door, and add `ImportClaudeSettingsOptions` / `ClaudeImportExecutionResult` to
the barrel if `edge/types.ts` needs more than those two (it currently imports from the
same three-symbol set, so the existing barrel already suffices).

### WR-11: two environment-dependent test mechanisms that fail open or fail loud for the wrong reason

**File:** `tests/orchestrators/reconcile/apply.test.ts:241,258` (the `denyWrites` helper);
`tests/integration/reconcile-plan-convergence.test.ts:104-146`

**Issue:**

Two smaller test-robustness problems, grouped because both are about a case not testing
what it names:

**(a) `chmod 0o555` as a permission-denial mechanism.** `denyWrites` sets a directory to
`0o555` to force EACCES for the MIG-01 and read-pass-throw cases. Running as `root` —
the default in most Docker-based CI images — a `0o555` directory is still writable, so the
EACCES never happens. This fails loudly rather than silently (the expected cascade would
not match), so it is a portability defect rather than a false-green, but the failure
message will point at the reconcile logic instead of at the environment. GitHub Actions'
`ubuntu-latest` runs as non-root so this is green today; it will bite the first person who
runs the suite in a container.

*Fix:* guard the mechanism at the source so the diagnosis is immediate:
```ts
    denyWrites: async (directory: string): Promise<void> => {
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        throw new Error("denyWrites cannot deny root; run this suite as a non-root user");
      }
      denied.push(directory);
      await chmod(directory, 0o555);
    },
```

**(b) The convergence proof never pins its own input.** Both cases build the config they
feed to `planReconcile` by running production code over the same state they assert
converges:

```ts
  const state = populatedMixedState();
  const config = buildConfigFromState(state);      // production
  const merged = mergeScopeConfigs(config, {});    // production
  const result = planReconcile(merged, state, "project");
  assert.deepStrictEqual(result, { /* all buckets empty */ });
```

This is a genuine fixed-point property and the file names itself as such, so it is not
the "expected value derived from the code under test" anti-pattern in its crudest form —
and it does catch gross breakage (an empty `config` would produce a mass-uninstall plan,
not an empty one). But it cannot see a *correlated* blind spot: any field that
`buildConfigFromState` stops emitting and `planReconcile` stops reading stays green, which
covers the `enabled` flag among others. The intermediate `config` is never asserted, and
`mergeScopeConfigs(config, {})` never exercises the local layer at all.

*Fix:* pin the intermediate so the round-trip has an independent anchor at both ends:
```ts
  const config = buildConfigFromState(state);
  assert.deepStrictEqual(config, {
    schemaVersion: 1,
    marketplaces: { "mp-path": { source: "./mp-path-local" }, "mp-github": { source: "acme/tools" } },
    plugins: { "code-reviewer@mp-path": {}, "soft-degraded@mp-path": {}, "formatter@mp-github": {} },
  });
```
(shape to be confirmed against `migrate-config.ts` — the point is that it be an authored
literal, not a derived value.)

---

_Reviewed: 2026-09-02T04:54:10Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
