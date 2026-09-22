---
phase: 10-constraint-aware-update
reviewed: 2026-09-22T19:45:00Z
depth: standard
scope: fix-pass re-review (git diff 533537ce..HEAD)
files_reviewed: 30
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/register.test.ts
  - tests/edge/types.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/seed-unconstrained-target.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-constraint-gate.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/scripts/check-unused-type-members.negative.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 10 fix pass: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** standard (narrow re-review of `533537ce..HEAD`)
**Files Reviewed:** 30
**Status:** issues_found (no blockers)

## Summary

Every fix was mutation-tested in a throwaway sandbox copy of the tree (`extensions/`,
`tests/`, `scripts/` + a `node_modules` symlink); the reviewed working tree was never
modified. Results:

- **CR-01 is genuinely fixed and genuinely proven at the factory.** `beginPluginUpdateRun`
  allocates the memo pair per call; `edge/handlers/marketplace/update.ts:59` calls it once
  per command invocation, before the two command forms branch, and no other holder of a
  long-lived `PluginUpdateFn` exists in production (`index.ts:212` passes the factory, not a
  function). Hoisting the memo pair back beside the binding makes the new case
  `D-10-18: a tag published between two cascade runs is visible to the second` fail with
  exactly `'1.0.0' !== '1.2.0'` — the negative control the fixer claimed is real.
- **WR-03 is real:** mutating `constraintFromVerdict` to return a disclosure on the
  non-`admits` arm fails BOTH SC3 cases. They now run the production preflight.
- **WR-04 is real:** mutating `preparePluginUpdate`'s held arm to stamp `"orphan rewake"`
  fails the doc-agreement case with `the document never names {orphan rewake}`. The token
  now comes from production, not from the test body.
- **WR-02 is real:** forcing `already-resolved` on every admitting arm fails the new
  end-to-end `D-10-13` row case in `update-flow.test.ts`.
- **WR-05/WR-10 are done:** all three `fallow-ignore` suppressions are gone,
  `describeConstraint` and `projectSkippedOutcome` are file-private again, and the two
  planning-step references in `docs/output-catalog.md` are gone.
- **The `84475523` remap is correct:** `tests/scripts/check-unused-type-members.negative.test.ts`
  passes 21/21 against a git-initialised sandbox, including
  `rejects a gate that describes a different member at the planted coordinates`.
- Tree health: `tsc --noEmit` clean, `eslint` clean on the changed files,
  `prettier --check` clean, `fallow dead-code --fail-on-issues` clean (exit 0, `✓ No issues
  found`), and the full orchestrator + edge + index suite is 3722/3722 green. The
  architecture doc/catalog gates pass in the real tree (24/24, including
  `catalog contract matches all 20 fixture modules to 227 exact documented states` — no
  catalog state count drift from the new `range-only` arm).

Two things did not survive scrutiny. First, the seam reshape's own claim — "this handler IS
the run boundary" — has no test anywhere: relocating that one line from the returned closure
to the factory body reinstates CR-01 in full and leaves 3722 tests green (proven by
mutation). Second, WR-06's narrowing is weaker than the comments it shipped with say it is:
`PluginNotificationMessage` also names `PluginUpdateSkippedMessage`, and that membership is
load-bearing, so "only `UpdateMsg` and `UpdateRowMsg` name this type" is false in the same
file that asserts it.

None of the locked decisions (D-10-05, D-10-06/07/08, D-10-12, D-10-17a, D-10-20) are
re-opened here.

## Warnings

### WR-F1: The run boundary the CR-01 fix depends on is untested — a one-line hoist silently reinstates the bug

**File:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts:59`,
`tests/edge/handlers/marketplace/update.test.ts:260,299,357,385,422,489`

**Issue:** the fix moved the run boundary out of `createPluginUpdateOperations` and into the
marketplace update handler. The memo's *per-run* scope is proven at the factory
(`D-10-18: a tag published between two cascade runs is visible to the second`), but that case
calls `operations.beginPluginUpdateRun()` directly and never goes through the edge. The edge
seam — the thing that makes "one run" mean "one command" — is pinned by nothing: all six
handler cases inject `beginPluginUpdateRun: () => pluginUpdate`, a factory that returns the
same function however many times it is called, so they are invariant to *when* the handler
calls it.

Verified by mutation in the sandbox. Moving the allocation out of the returned closure:

```ts
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const pluginUpdate = deps.beginPluginUpdateRun();   // <- registration scope again
  return async (args, ctx): Promise<void> => {
```

restores exactly CR-01's original defect (one memo pair for the whole extension load, now
one level up) and the suite reports **3722 pass, 0 fail** across
`tests/edge/**`, `tests/orchestrators/**` and `tests/index.test.ts`. Grep confirms no other
test references `beginPluginUpdateRun` in a way that would catch it. A Critical fixed this
way can be un-fixed by a refactor with no red anywhere.

**Fix:** add one handler case that counts factory invocations and pins the per-command
allocation:

```ts
test("D-10-18: each marketplace update invocation begins its own cascade run", async () => {
  // arrange
  let runs = 0;
  const handler = makeMarketplaceUpdateHandler(pi, {
    completionCache: createCompletionCache(),
    gitOps: git.gitOps,
    beginPluginUpdateRun: () => {
      runs += 1;
      return pluginUpdate;
    },
  });

  // act
  await handler("", ctx);
  await handler("", ctx);

  // assert -- one run per command, and never one at registration.
  assert.strictEqual(runs, 2);
});
```

A companion assertion that `runs === 0` immediately after `makeMarketplaceUpdateHandler`
returns closes the registration-scope direction, and a bare-vs-named case asserting `runs === 1`
for a single `marketplace update` closes the per-plugin direction the handler comment claims
("Both command forms share that one allocation").

### WR-F2: `PluginUpdateSkippedMessage` documents an invariant the type graph does not give it

**File:** `extensions/pi-claude-marketplace/shared/notification-types.ts:474-487` with `:542`,
`extensions/pi-claude-marketplace/shared/notification-grammar.ts:1641-1657`

**Issue:** the new variant's doc block says:

> The slot lives on this variant rather than on `PluginSkippedMessage` so the roughly a dozen
> other `skipped` producers cannot grow one: a row literal typed as the base that sets `cause`
> is an excess-property error. **Only `UpdateMsg` and `UpdateRowMsg` name this type.**

The last sentence is false eight lines further down the same file: `PluginNotificationMessage`
(line 542) names it too, and that membership is **load-bearing**, not decorative. Deleting it
in the sandbox produces four compile errors:

```
tests/architecture/catalog-uat/fixtures/marketplace-update.ts(139,17): error TS2353: ... 'cause' does not exist in type 'PluginSkippedMessage'.
tests/architecture/catalog-uat/fixtures/plugin-update.ts(535,17|569,17|629,17): error TS2353: ...
```

i.e. four catalog fixtures already set `cause` on a `skipped` row purely because the dispatcher
union admits it (`CatalogFixture.message: NotificationMessage`). So the guard is not "the slot
lives on update's variant alone"; it is "the slot lives on update's variant **and on anything
typed on the dispatcher union**". Today no production surface composes rows at that type
(`browse.ts:82` only forwards list rows), so behaviour is correct — but the grammar's companion
comment repeats the overstatement ("every other `skipped` producer has no `cause` to set and
keeps its byte-frozen row"), and the renderer reads the slot with `"cause" in p`, which under
`renderIndentedCauseChain(cause: unknown)` gives the check no type-level teeth at all. A future
surface that types its rows as `PluginNotificationMessage` gets a trailer on a byte-frozen row
for free, with nothing red.

**Fix:** state the real mechanism and gate it, rather than asserting the stronger one:

```ts
 * The slot lives on this variant rather than on `PluginSkippedMessage`, so a row literal
 * typed as the base -- every non-update surface's own `*Msg` union -- is an excess-property
 * error when it sets `cause`. The dispatcher union `PluginNotificationMessage` names this
 * variant too (the catalog fixtures compose at that type), so a producer that composes rows
 * at the dispatcher type is NOT narrowed by this split; `notify-closed-set-locks.test.ts`
 * enumerates the surfaces permitted to set `cause` on a `skipped` row.
```

and add the enumerating case WR-06 offered as its second option, in the same shape
`notify-closed-set-locks.test.ts` already applies to the reason set.

## Info

### IN-F1: WR-01's guard covers an unreachable state and is still partial in that state

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:511-521`,
`tests/orchestrators/plugin/update-constraint-gate.test.ts:1010-1025`

**Issue:** `named = rejecting.length > 0 ? rejecting : admits.holders` cannot take its second
arm from production. `rejecting` is empty only when no holder declares a range; a holder set
with no declared ranges folds `ranges` to `[]`, `intersectDependencyRanges([])` yields `*`, and
`evaluateUpdateConstraint` returns `{ kind: "unconstrained" }` at line 466-468 before any
`admits` verdict exists. The paired case therefore hand-builds a verdict production cannot
produce (`admits("^1.0.0", [{ key: "a@mp", disabled: false }])` — a fold that no holder's range
could have produced), which the 100%-branch gate then requires. The guard is also incomplete
in its own hypothetical: `admits.holders === []` leaves `named` empty and the line still ends
`-- required by ` with no subject, which is the exact shape the guard was added to prevent.

**Fix:** either close it at the composer, where it is total —
`describeConstraint` returning without the `-- required by` clause when `holders.length === 0` —
or drop the branch and assert the precondition instead (`assert holders.some(h => h.range !== undefined)`),
so no fabricated verdict has to exist to keep the coverage gate green.

### IN-F2: Two added comments narrate the shape the fix replaced

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:1034-1042`,
`tests/orchestrators/plugin/update-preflight.test.ts:262-265`

**Issue:** `.claude/rules/typescript-comments.md` (→ `skills/typescript-comments/SKILL.md`) bans
narration of code that no longer exists and asks for the rationale restated as a present-tense
fact. Both new comments are written against the removed shape:

- `update-flow.ts`: *"allocated inside this factory **rather than in `createPluginUpdateOperations`'s
  own body**. The binding this function belongs to lives for the whole extension load, so a memo
  pair **allocated beside it would outlive every run** and serve a stale listing"*.
- `update-preflight.test.ts`: *"so a member added to `PreparedPluginUpdate` cannot slip past this
  case **the way `constraint` did**"*.

**Fix:** state the invariant, not the counterfactual — e.g. *"D-10-18: one memo pair per
autoupdate run. The pair is allocated by `beginPluginUpdateRun`, so its lifetime is the run's;
a release tag pushed between two runs is visible to the second."* and *"asserts the whole
prepared value, so a member added to `PreparedPluginUpdate` is a red case here."*

### IN-F3: The `range-only` cause line ships without a catalog example or fixture

**File:** `docs/output-catalog.md:1669`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:170-175`

**Issue:** the new clause is a new user-visible byte form on the `up-to-date` row
(`cause: constrained to the combined range (…) -- required by "…"`). It is documented only as
an inline backtick inside the existing D-10-13 state's prose, so the catalog parser does not
see it as a tuple and no `catalog-uat` fixture pins it; the contract test still counts 227
states. The bytes are pinned once, in
`tests/orchestrators/plugin/update-flow.test.ts:7548`. That is one end-to-end assertion for a
form the catalog treats as undocumented.

**Fix:** either give the arm its own catalog state + fixture beside
`update-constrained-ceiling`, or note in the D-10-13 state that the alternate clause is pinned
by the flow case rather than by a catalog tuple, so a later catalog census does not read the
form as undocumented drift.

### IN-F4: Neither SC3 case asserts the shared seed's declaration walk actually saw `beta`

**File:** `tests/orchestrators/plugin/seed-unconstrained-target.ts:8-11`,
`tests/orchestrators/plugin/update-cascade.test.ts:553-560`,
`tests/orchestrators/marketplace/update.messaging.test.ts:551-558`

**Issue:** the extraction itself is right (one seed, two proofs, no drift). But the seed's stated
purpose — *"so the declaration walk genuinely runs and returns an empty holder set for `alpha`"* —
is asserted by neither case. Both assert only `prepared.constraint === undefined`, which is also
what a walk that silently stopped parsing `beta`'s `dependencies: ["gamma"]` would produce. With
one shared seed, that single regression now makes both "identical" proofs vacuous at once — the
concentration risk the extraction introduced.

**Fix:** have one of the two cases assert the walk's own output — e.g. drive
`evaluateUpdateConstraint` once against the same seed and assert
`{ kind: "unconstrained" }` *plus* that `beta`'s declaration was parsed (a `gamma`-targeted
holder set is non-empty), so a walk that returns nothing at all is distinguishable from a walk
that correctly finds no holder for `alpha`.

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard — fix-pass re-review_
