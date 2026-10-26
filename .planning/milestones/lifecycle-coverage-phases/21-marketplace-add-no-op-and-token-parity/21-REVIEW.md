---
phase: 21-marketplace-add-no-op-and-token-parity
reviewed: 2026-10-23T15:19:59Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - docs/output-catalog.md
  - features/lib/published-marketplace.ts
  - features/marketplace/add.feature
  - features/marketplace/failed-add.feature
  - features/marketplace/help.feature
  - features/marketplace/update.feature
  - features/plugin/bootstrap.feature
  - features/step_definitions/marketplace/add.steps.ts
  - features/step_definitions/marketplace/update.steps.ts
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixtures/marketplace-add.ts
  - test/architecture/catalog-uat/fixtures/plugin-bootstrap.ts
  - test/edge/router.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/bootstrap.test.ts
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-10-23T15:19:59Z
**Depth:** standard (plus the callers of `classifyAddError` and `reasonsFromCascadeError`)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The review covered the uncommitted diff against HEAD for MPA-01..03. The core
logic is correct. The same-source no-op (`redeclareRecordedSource` ->
`alreadyAdded`) runs inside the lock. It returns before `addMarketplaceToState`,
`writeMarketplaceConfigEntry`, `tx.save()` and `settleAddedMarketplace`, so it
writes nothing. A target layer that declares the name with another source
still throws `MarketplaceDuplicateNameError`. `ConfigInvalidError` still reads
`{invalid manifest}`, because `narrowProbeError` gives a cause-less
`InvalidMarketplaceManifestError` that token. The `update.ts` unwrap matches
the old semantics. The router arm matches `rejectUnknownFlag`.

Checks run (all green, except one test that failed only because of the
reviewer's long TMPDIR and passed on a rerun with the default tmpdir): the
`node --test` suites for add, update, bootstrap, router, install-outcome,
install.messaging, reconcile/apply and import/execute, the three catalog-uat
tests, and `npx cucumber-js` on the five touched feature files (155 scenarios
passed).

The findings fall into four groups:

- The new behavior-test scenario does not prove the "changes nothing" claim in
  its title.
- The new EACCES/EPERM arm is broader than D-06 intends.
- The `unparseable` change reaches orchestrated surfaces that nobody updated.
- Several comments and catalog passages now contradict the code.

## Critical Issues

### CR-01: The "changes nothing" scenario passes an implementation that re-clones or re-saves

**File:** `features/marketplace/add.feature:208-236`
**Issue:** The scenario `Adding again a marketplace from the source it was added
from changes nothing` checks only three things: the result fields, the
`(skipped) {already added}` row, and the contents of `claude-plugins.json`. A
plausible wrong implementation would pass it. One example: let the add fall
through to the clone, catch the `MarketplaceDuplicateNameError` that
`newMarketplaceName` throws, and turn it into the skipped row when the sources
match. That implementation makes git requests on the `url`/`github` rows,
which D-01 forbids ("no clone, no git call"). An implementation that re-saves
`state.json` or runs the settle would pass too. The cucumber skill classifies
"a scenario a plausible wrong implementation still passes" as a BLOCKER. The
unit test (`add.test.ts:1271`) covers only the github clone count and the
state and config bytes. The feature file is the user-level proof of MPA-01,
and it does not check them.
**Fix:** Add the existing step to the scenario. Also assert that state did not
change, through a state-level step or by checking that the `sources/` tree is
unchanged:
```gherkin
    Then the git host receives no request
```
The same gap exists in `Adding again with --local a marketplace that the local
layer declares changes nothing` (`add.feature:265`). That scenario does not
check that the base `claude-plugins.json` stays absent.

## Warnings

### WR-01: The EACCES/EPERM arm blames the source for any refused write, with no cause line

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:336-339`
**Issue:** The arm is documented as "an unreadable manifest reads as it does on
`list` and `info`". In fact it classifies any EACCES/EPERM that leaves
`runAddInGuard` (after one cause unwrap). That includes the state lock
directory, the `claude-plugins.json`/`.local.json` write, `tx.save()`, and the
`sources/` mkdir and rename. `failedAddRow` renders no cause for this reason
(`add.ts:795-805`). As a result, a read-only scope root renders as
`⊘ <typed source> [scope] (failed) {permission denied}`. The row names the
source, the source was readable, and the row gives no path. Before this
change, the raw error reached the user with its path. The rewritten test
`LAYER-01 / MPA-02: a refused re-declaration write fails as permission denied`
(`add.test.ts:3544`) locks this misattribution in: the refused file there is
the local config. The rule also contradicts the sibling design in
`update.ts::refreshFailureReasons` (`update.ts:~722`), which maps an errno
only when the refresh itself raised it, never when the state load, the save,
or the lock raised it. The same broadening reaches
`install-outcome.ts:507` (`recordAsInstallFailure`). There, an EACCES during
the target-scope add now becomes `InstallMarketplaceAddError("permission
denied")` and not the raw error.
**Fix:** Classify the errno only where the source is read. In
`addPathInGuard` (around the `stat` and the manifest read) and in the
manifest read after the clone, wrap EACCES/EPERM in a typed error, for example
a source-read variant of `UnreadableSourceCloneError` with
`failure: "permission-denied"`, which `classifyAddError` already maps. Then
remove the bare errno arm from `errorAddReason`. As an alternative, keep the
arm but render the cause child for `permission denied` so that the user sees
the path.

### WR-02: Comments now contradict the bootstrap and classifier behavior

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:217-224`, `add.ts:1033-1035`, `extensions/pi-claude-marketplace/shared/errors.ts:651-654`
**Issue:**
- `add.ts:217-224` (`rethrowPreconditionErrors` doc) still says: "Bootstrap
  relies on catching `MarketplaceDuplicateNameError` to detect the idempotent
  re-run and SUPPRESS a duplicate add notification". Bootstrap no longer does
  this (D-05).
- `add.ts:1033-1035` still gives "swallow the idempotent duplicate-name
  re-run" as the example.
- `errors.ts:651-654` says that `classifyAddError` and `reasonsFromCascadeError`
  map `InvalidMarketplaceManifestError` to `invalid manifest`. Malformed JSON
  now maps to `unparseable`.

**Fix:** Change the doc to say that bootstrap rethrows so it can skip the
autoupdate step after any failed add, and that a re-run gets the add's own
`(skipped) {already added}` row. In `errors.ts`, change the two bullets to
"-> `narrowProbeError` (`unparseable` for a `SyntaxError` cause, else
`invalid manifest`)".

### WR-03: Output catalog prose still documents malformed JSON as `{invalid manifest}`

**File:** `docs/output-catalog.md:2466`, `docs/output-catalog.md:2590`, `docs/output-catalog.md:4092`
**Issue:** `add-invalid-manifest` (2590) and `update-path-invalid-manifest`
(4092) both say that a manifest that is "malformed JSON or schema-invalid"
renders `{invalid manifest}`. Since MPA-02, malformed JSON renders
`{unparseable}`. Line 2466 still lists "the five `marketplace add`
preconditions", but the list is now longer: it has no `unparseable`, no
`permission denied`, and no `already added` skip. The catalog is the user
contract, and these passages now describe behavior that the features
(`add.feature:328-358`, `failed-add.feature:89`) contradict.
**Fix:** Change both states to "a schema-invalid manifest (a malformed-JSON
manifest renders `{unparseable}`, as on `list`/`info`)". Change the 2466
paragraph to list the current reasons.

### WR-04: Unrelated thematic-break churn in the catalog (27 lines)

**File:** `docs/output-catalog.md` (for example, lines 104, 132, 170, 553, ...)
**Issue:** 27 `______________________________________________________________________`
separators became `---`. This change does not come from the phase. It is the
form Prettier writes, but this repository formats Markdown with mdformat
(`.pre-commit-config.yaml:75-84`), and mdformat writes the underscore form.
The fixer will rewrite these lines on commit, so the first commit attempt
fails with "files were modified". The change also breaks the AGENTS.md
surgical-change rule.
**Fix:** Revert the separator lines with `git checkout -p docs/output-catalog.md`
and keep only the bootstrap and `already-added` hunks. Alternatively, run
mdformat on the file.

### WR-05: `unparseable` now has two meanings on the orchestrated add outcome

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:155-166`, `add.ts:881-887`, `add.ts:910-923`
**Issue:** `classifyAddError` now returns `unparseable` for a malformed
manifest. `handleAddFailure` already returns `unparseable` as the orchestrated
fallback for an unforeseen error. Because of this, reconcile
(`reconcile/apply.ts:452`, `mp-add-failed`) and import
(`import/execute.ts:1138`) cannot tell a malformed manifest from an
unclassified catastrophic throw. The `AddMarketplaceOutcome` doc (155-166) and
the `handleAddFailure` doc (881-887) still describe `unparseable` as only the
catastrophic fallback, chosen because "every recognised add precondition
yields a typed error". No reconcile or import test covers the new reason for
a malformed manifest (both suites pass unchanged, so they do not assert it).
**Fix:** Update both docs so that they list `unparseable` as a classified
reason (malformed JSON) as well as the fallback. If callers need to tell the
two apart, they can narrow on `outcome.error instanceof
InvalidMarketplaceManifestError`. Add one orchestrated test (reconcile
`applyMarketplaceAdds`) that asserts `reason: "unparseable"` for a
malformed-JSON source.

### WR-06: Test gaps for the no-op contract and for the changed callers

**File:** `test/orchestrators/marketplace/add.test.ts:1271`, `test/orchestrators/plugin/install-outcome.test.ts`, `test/orchestrators/marketplace/update.test.ts`
**Issue:**
- D-01 says the no-op runs no cache settle. No standalone test asserts that
  the completion cache is not invalidated on the skip path. The cache test
  at `add.test.ts:2132` is orchestrated only, and there the add still fails as
  a duplicate. An implementation that settled before the `alreadyAdded`
  branch would pass.
- `recordAsInstallFailure` (`install-outcome.ts:500-514`) now produces
  `{unparseable}` and `{permission denied}` install rows for the target-scope
  add. No test pins either.
- The raw (unwrapped) `InvalidMarketplaceManifestError` arm of
  `reasonsFromCascadeError` (`update.ts:658-661`, the `cascadeAutoupdates`
  catch) has no test that asserts `unparseable`. Only the wrapped refresh path
  is covered.

**Fix:** Pass a `createCompletionCacheRecorder()` cache to the MPA-01 skip
test and assert `recorder.calls` is `[]`. Add an install-outcome case where
the injected `marketplaceAdd.record` throws a malformed-manifest
`InvalidMarketplaceManifestError` and assert `reasons: ["unparseable"]`. Add a
cascade case in which `pluginUpdate` throws a raw malformed-manifest error.

## Info

### IN-01: Stale test comments

**File:** `test/orchestrators/marketplace/add.test.ts:2446-2447`, `test/orchestrators/marketplace/update.test.ts:1854-1857`
**Issue:** The comment above the renamed `MPA-01 (path source)` test still says
the second add "renders the structured (failed) {duplicate name} row". The
update banner comment still says that a malformed or schema-invalid manifest
renders `{invalid manifest}`.
**Fix:** Delete the add comment, because the test title says the same thing.
Split the update banner into `{unparseable}` for malformed JSON and
`{invalid manifest}` for an invalid schema.

### IN-02: The no-op returns `status: "added"` and does not check the recorded clone

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1043-1059`, `add.ts:472-479`
**Issue:**
- The `alreadyAdded` arm returns `{ status: "added" }`. Today no caller can
  see this, because orchestrated adds never redeclare (WR-09, D-04). If that
  ever changes, a reconcile or import caller would render a no-op as `(added)`
  and nothing in the types would catch it.
- The no-op also reports `already added` without checking that the recorded
  clone or manifest still exists. A record whose `sources/<name>` was deleted
  reads as healthy. Before this change it read as `duplicate name`, which was
  just as unhelpful, so this is not a regression.

**Fix:** Add a short guard such as `if (orchestrated) { /* unreachable,
WR-09 */ }`, or a comment that names the coupling. You could also mention
`marketplace update` or `remove` as the repair for a missing clone, if that
is wanted later.

---

_Reviewed: 2026-10-23T15:19:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
