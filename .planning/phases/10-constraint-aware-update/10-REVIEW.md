---
phase: 10-constraint-aware-update
reviewed: 2026-09-22T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - CHANGELOG.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/check-unused-type-members.exceptions.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/marketplace-update.ts
  - tests/architecture/catalog-uat/fixtures/plugin-update.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/types.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-constraint-gate.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/types.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-reasons.test.ts
findings:
  critical: 2
  warning: 10
  info: 3
  total: 15
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

The two-stage gate is structurally sound. I traced every arm of `evaluateUpdateConstraint` and could not construct a path where an out-of-range version lands with neither stage running: a pinned verdict always reaches `resolveUpdateCandidate` through `resolvePluginPin`'s `source.sha !== undefined` branch (`clone-cache.ts:551`) or through `deriveSourcePluginRoot`'s `pathPluginPin` branch (`plugin-resolver.ts:392`), and both of those turn a non-materialized pin into a resolver throw rather than a silent fallback. The stage-two skip on a pinned verdict (`update-preflight.ts:729`) is deliberate and correctly conditioned. Per-holder attribution on the stage-two arm filters on the holder's OWN range, as required; I brute-forced 1728 three-range folds × 11 versions and found zero cases where the fold rejects but no individual range does. Credential handling is clean: `update-constraint-gate.ts` reads no credential value, and `decodeTagProbe` drops the probe's raw `cause` and carries only the closed-set transport classification, so a URL with embedded credentials cannot reach a row. The fail-closed walk's cause line is path-redacted at every producer (`dependency-index.ts:190`, `dependency-declaration-read.ts:281`) and names the unreadable declarer, not the target. `npm run tsc --noEmit` is clean and all 442 tests in the eight modules I ran are green.

Two defects are shipping-blocking. The D-10-18 tag memo on the autoupdate seam is allocated at **extension-load** scope, not per run, so it goes stale for the life of the Pi process — this contradicts D-10-18's own text and the sibling comment in `updatePluginsWith`. And the gate's tag pin silently overrides a manifest entry's declared `sha`, moving an explicitly commit-pinned installed plugin off that commit, with no decision, no test, and no doc line covering it.

Beyond that the dominant concern is test quality, exactly where the phase brief predicted: the two SC3 "unconstrained regression" cases never connect the gate verdict to the rendered outcome, the doc-agreement case is a pass-through self-comparison, and the two `fallow-ignore-next-line unused-export` suppressions both cover exports that exist only to serve tests — one of which buys the test nothing at all.

## Critical Issues

### CR-01: The autoupdate cascade's tag memo is process-lifetime, not run-lifetime

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:1027-1044`

**Issue:** `createPluginUpdateOperations` allocates the two constraint memos in its own body and closes the `pluginUpdate` seam over them. That function is called **once per extension load** — `extensions/pi-claude-marketplace/index.ts:52` — not once per command. Every `/marketplace update` in a Pi session therefore shares one memo pair that is never cleared.

`listCandidateTags` (`dependency-tag-probe.ts:118`) and `listMarketplaceCandidateTags` (`marketplace-tag-probe.ts:87`) both serve a memoized listing unconditionally when the key is present. So after the first autoupdate cascade in a session:

- a newly published `<plugin>--v<version>` release tag is invisible to the constraint gate until the process restarts;
- a constrained plugin that was held on `no-satisfying-tag` stays held forever even once a satisfying tag is pushed;
- for a `path` source the failure is worse: `marketplace update` pulls the marketplace clone to a new commit and then runs the cascade, so the clone's *current* tag set is exactly what the stale memo hides.

This directly contradicts D-10-18 ("**One tag memo per run**") and the sibling comment at `update-flow.ts:265-268`, which says a memo that "would outlive the run and serve a stale listing" is the thing the per-run allocation exists to prevent.

No test covers it. `tests/orchestrators/plugin/update-flow.test.ts:7410` ("two separate `updatePlugins` invocations do not share a memo") exercises only the bulk path, whose memo IS allocated per call inside `updatePluginsWith` (`update-flow.ts:270-271`) — and its comment ("each `updatePlugins(...)` in this test module composes a fresh `createPluginUpdateOperations`, matching production's own per-command construction") misstates production, which composes it once at load.

**Fix:** the memo must be bounded by the cascade run, not by the binding's lifetime. Either clear at the run boundary the cascade already owns, or give the seam a run scope:

```ts
// Option A -- clear at the cascade boundary (marketplace/update.ts owns the run).
export interface PluginUpdateOperations {
  readonly updatePlugins: UpdatePluginsFn;
  /** Allocates a fresh per-cascade `PluginUpdateFn`; one call per autoupdate run. */
  readonly beginPluginUpdateRun: () => PluginUpdateFn;
}

// in createPluginUpdateOperations:
const beginPluginUpdateRun = (): PluginUpdateFn => {
  const constraintTagMemo = new Map<string, readonly RemoteTag[]>();
  const constraintMarketplaceTagMemo = new Map<string, readonly ReleaseTagCandidate[]>();
  return (plugin, marketplace, scope) =>
    updateSinglePluginWith(hooksRouting, completionCache, runPluginUpdate, plugin, marketplace, scope, {
      tagMemo: constraintTagMemo,
      marketplaceTagMemo: constraintMarketplaceTagMemo,
    });
};
```

Whichever shape is chosen, add the missing lifetime case: two `marketplace update` cascades driven through ONE `createPluginUpdateOperations`, with a tag-listing transport that counts negotiations, asserting **two** listings and not one.

### CR-02: A constraint pin silently overrides a manifest entry's declared `sha`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:341-343`

**Issue:** `resolveUpdateCandidate` rewrites the entry source's commit identity whenever the gate produced a pin:

```ts
resolveGitPluginRoot(
  options.pin === undefined ? gitSource : { ...gitSource, sha: options.pin.oid },
),
```

`constraintTagSource` (`update-constraint-gate.ts:265-276`) routes a `url` / `git-subdir` / `github` entry to the tag probe **without checking whether the entry already carries its own `sha`**. `UrlSource`, `GitSubdirSource` and `GitHubSource` all declare `readonly sha?: string` (`domain/source.ts:36,44,53`), and `resolvePluginPin` honours it (`clone-cache.ts:551`).

So for a manifest entry pinned to commit `X`, plus any other installed record declaring a range for that plugin:

- before this phase, `update` re-resolved `X`, derived `shaVersion(X)`, matched the record and rendered `{up-to-date}`;
- now the gate lists the repository's tags, pins the highest satisfying tag's oid, that oid replaces `X`, and `deriveUpdateToVersion` returns the **tag's** version (`update-preflight.ts:286-288`). The record's `version` and `resolvedSha` both move off the declared pin.

Stage two never catches this, because the verdict carries a pin (`postFetchGuard` returns `undefined` at `update-preflight.ts:729`). An entry-declared `sha` is the strongest statement a marketplace author can make about which commit a plugin is; overriding it is a behaviour change no D-10-* decision authorises and no doc line mentions. The install cascade has the same shape (`install-cascade.ts:592-595`), which suggests this may be an intended house pattern — but on install there is no already-pinned installed record being moved, so the precedent does not carry.

**Fix:** leave a self-pinned source alone and let stage two measure it, which is the "cannot decide, defer" shape D-10-16 already uses:

```ts
function constraintTagSource(entry: PluginEntry): ConstraintTagSource {
  const parsed = parsePluginSource(entry.source);
  if (parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github") {
    // An entry that names its own commit is not a tag search: the author already
    // chose the version. Admit the range unpinned and let stage two measure what
    // that commit resolves to.
    return parsed.sha === undefined ? { kind: "git", source: parsed } : { kind: "absent" };
  }
  ...
}
```

If the override IS intended, it needs a decision ID, a `docs/dependency-resolution.md` sentence, and a paired test asserting that a `sha`-pinned constrained entry moves to the tag oid.

## Warnings

### WR-01: `admitResolvedVersion` can emit a held cause with a dangling `required by`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:495-501`

**Issue:** when every holder in `admits.holders` has no declared `range`, the filter returns `[]`, `describeConstraint` joins nothing, and the cause line ends `... -- required by ` with no subject — a row the user cannot act on, which is precisely what the per-holder filter exists to prevent. The paired test at `update-constraint-gate.test.ts:1032` ("a holder with no declared range never rejects") constructs exactly that verdict and asserts only `assert.doesNotMatch(result.cause, /a@mp/)`, so it pins the malformed shape instead of guarding it. (I could not reach the state from `evaluateUpdateConstraint` — a rangeless-only holder set folds to `*` and returns `unconstrained` at line 455-457 — but `admitResolvedVersion` is exported and the type admits the shape.)

**Fix:** close the hole at the composer and assert the whole string:

```ts
const rejecting = admits.holders.filter(
  (holder) => holder.range !== undefined && !recordedVersionSatisfies(toVersion, holder.range),
);
// A version outside the fold is outside at least one declared range, so this is
// never empty in practice; fall back to the whole holder set rather than emit a
// cause line naming nobody.
const named = rejecting.length > 0 ? rejecting : admits.holders;
return { kind: "held", cause: describeConstraint(admits.range, named, "out-of-range", toVersion) };
```

and replace the negative assertion with `assert.strictEqual(result.cause, '<the exact expected line>')`.

### WR-02: The ceiling disclosure claims a ceiling that was never established

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:296`

**Issue:** `admitsRange` composes `disclosure: describeConstraint(range, holders, "already-resolved")` on **every** `admits` verdict — including the two that found no tag at all:

- `decodeTagProbe`'s `no-matching-tag` arm (line 327-329);
- `probePathStageOne`'s current-copy fallback (line 408-410);
- the `npm` / `unknown` arm that makes no probe call (line 470);
- the git arm that skipped the query for want of a `ctx` (line 362-364).

When such a verdict reaches the `unchanged` row (`update-preflight.ts:889-901`), the cause line asserts *"already the highest version the combined range admits"* even though the search that would establish a ceiling never ran or found nothing. D-10-13's stated purpose is to let the user tell "nothing newer exists" from "nothing newer is allowed"; on these arms the line asserts the second when only the first is known.

**Fix:** either compose the `already-resolved` clause only when a pin selected this exact version, and use a neutral clause otherwise (e.g. a new `ARM_CLAUSE` member `"held to"` → `"held to the combined range"`), or carry a flag on the verdict so `constraintFromVerdict` can pick the truthful clause. Add a case that drives a `no-matching-tag` verdict all the way to an `unchanged` row and asserts the cause line.

### WR-03: Both SC3 regression cases skip the link they claim to prove

**File:** `tests/orchestrators/plugin/update-cascade.test.ts:587-675`, `tests/orchestrators/marketplace/update.messaging.test.ts:626-670`

**Issue:** each case runs the real `evaluateUpdateConstraint`, asserts `{ kind: "unconstrained" }`, and then builds a **hand-written** outcome literal with `constraint: undefined` and renders that. The verdict is never fed into the outcome. The production step that turns an `unconstrained` verdict into `constraint: undefined` — `constraintFromVerdict` at `update-preflight.ts:767-773` — is never exercised by either case. A wrong implementation (e.g. `constraintFromVerdict` returning a disclosure for the `unconstrained` arm) would leave both cases green while breaking the NREG-01 claim they are titled after. Structurally the cases also have two acts and carry an assertion inside the arrange block.

**Fix:** derive the outcome from the verdict, or drive the whole preflight. The simplest honest form:

```ts
// act
const prepared = await preparePluginUpdate({ ...seedOptions });
assert.ok(!("partition" in prepared));
const outcomes = [{ target, outcome: { ...updatedOutcomeFrom(prepared), constraint: prepared.constraint } }];
composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");
```

At minimum, replace the hardcoded `constraint: undefined` with `constraint: constraintFromVerdict(verdict)` so the link under test is the thing that runs.

### WR-04: The doc-agreement case is a pass-through self-comparison

**File:** `tests/architecture/dependency-doc-agreement.test.ts:375-402`

**Issue:** the case writes `reasons: ["dependents constrain"]` into its own input outcome, calls `projectSkippedOutcome`, and then reads `message.reasons[0]` back out. `projectSkippedOutcome` copies `reasons: outcome.reasons` verbatim (`update-cascade.ts:93`), so the "token under test" is the literal the test body just supplied. The comment's claim — *"the token under test comes from `projectSkippedOutcome`'s returned message, never as a literal copied into this test body"* — is false: it is copied into the body one line above the call. The only thing actually asserted is that `docs/dependency-resolution.md` contains `{dependents constrain}`, which a plain string constant would assert just as well.

**Fix:** derive the token from the production closed set instead of from the test's own input — e.g. iterate the `REASONS` tuple member and assert the doc section names it — or drop the composer round-trip and the export it justifies (see WR-05).

### WR-05: Two `fallow-ignore-next-line unused-export` suppressions cover test-only exports

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts:64`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:190` and `:194`

**Issue:** both suppressions are genuine in the sense that fallow really cannot see a consumer — because there is no production consumer. Grep confirms the only importers are tests:

- `projectSkippedOutcome` → only `tests/architecture/dependency-doc-agreement.test.ts:42`, for the vacuous case in WR-04.
- `describeConstraint` → only `tests/orchestrators/plugin/update-constraint-gate.test.ts:9`, for one case (line 945) whose assertion is byte-identical to the end-to-end `disjoint` case at line 144. Exporting it also forces the **second** suppression, the `private-type-leak` on `ConstraintArm` at line 194.

`skills/typescript-unit-testing-review/SKILL.md` is explicit: *"An export ... added for a test is a finding — the production design changes, never the test's access."* Both exports are that.

**Fix:** unexport `describeConstraint` (its behaviour is already fully covered through `evaluateUpdateConstraint`'s four arm cases and `admitResolvedVersion`'s cases) and delete the `describeConstraint` describe block plus both suppressions. Fix WR-04 so `projectSkippedOutcome` can be unexported too.

### WR-06: Widening `PluginSkippedMessage.cause` removed a guard and replaced it with nothing

**File:** `extensions/pi-claude-marketplace/shared/notification-types.ts:469-479`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1642-1648`, `tests/orchestrators/plugin/info.messaging.test.ts:16-23`

**Issue:** `cause?: Error` is now legal on **every** `skipped` plugin row across every command, and `composePluginLinesWith` renders a cause trailer for all of them. The change deleted the `@ts-expect-error skipped rows structurally exclude failure causes` negative that previously proved `info`'s cascade rows could not carry one. The production comment asserts *"every other `skipped` producer omits `cause` and keeps its byte-frozen row"* — but nothing now enforces that; any of the ~12 `status: "skipped"` producers (`install-cascade.messaging.ts`, `reinstall.messaging.ts`, `enable-disable.ts`, `fetch.ts`, `info.ts`, `autoupdate.ts`, …) can grow a cause and silently change a byte-frozen row.

**Fix:** either narrow the carrier to the update surface (a dedicated `PluginUpdateSkippedMessage extends PluginSkippedMessage` with the `cause` slot, referenced only from `UpdateMsg` / `UpdateRowMsg`), or add an architecture gate enumerating the producers permitted to set `cause` on a `skipped` row — the same shape `notify-closed-set-locks.test.ts` already applies to the reason set.

### WR-07: The four-axis emit order on the `updated` row is documented but untested

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:97-101`, `tests/orchestrators/plugin/update-row.test.ts:346-371`

**Issue:** the composer's doc block states the order *"current copy, then orphan rewake, then malformed kinds, then dropped kinds"*, but no case combines `constraint.fellBackToCurrentCopy: true` with `orphanRewake` and `degradedKinds`. The pre-existing "preserves orphan, malformed, and dropped reason order" case (line 172) predates the new token and does not carry it. The new D-10-15 case asserts `result.reasons?.[0]` and `result.severity` only, where its ten sibling cases in the same file all `assert.deepStrictEqual` the whole message — so it does not discriminate an implementation that appends the token instead of prepending it.

**Fix:** add one case carrying all four axes, asserting the whole message with `deepStrictEqual` and the complete reasons array `["dependency current copy", "orphan rewake", "malformed command", "malformed skill", ...]`; convert the D-10-15 case to a whole-value assertion.

### WR-08: SC3 test seed helpers are duplicated verbatim across two modules

**File:** `tests/orchestrators/plugin/update-cascade.test.ts:16-73`, `tests/orchestrators/marketplace/update.messaging.test.ts:20-77`

**Issue:** `sc3PluginRecord()` and `seedUnconstrainedTarget()` — ~58 lines including the on-disk manifest fixture and its doc comment — are byte-identical copies in two test modules. A change to the seeded manifest shape has to be made twice or the two "identical" SC3 proofs drift apart, which is the exact failure mode the phase brief flags ("a verification set omitted the file the change broke").

**Fix:** move both into one seed module beside the concern they serve (e.g. `tests/orchestrators/plugin/seed-unconstrained-target.ts`) and import it from both cases, per `skills/typescript-unit-testing-review/SKILL.md`'s "cross-case seeds live in the concern's seed module".

### WR-09: "returns the complete prepared candidate" does not assert the member this phase added

**File:** `tests/orchestrators/plugin/update-preflight.test.ts:253-267`

**Issue:** the title promises the *complete* prepared candidate but the body asserts five properties one at a time, and it was not updated when `PreparedPluginUpdate` gained the required `constraint` member. Grepping `tests/orchestrators/plugin/update-preflight.test.ts` for `prepared.constraint` returns nothing: the prepared (non-`unchanged`) arm's `constraint` is never asserted in the module that owns `preparePluginUpdate`. The forwarding is covered one module over in `update-swap.test.ts:363,421`, but the preflight's own production of the slot is not.

**Fix:** assert the whole value, which also makes the new member impossible to forget next time:

```ts
assert.deepStrictEqual(prepared, {
  state: prepared.state, record: prepared.record, entry: prepared.entry,
  installable: prepared.installable,
  fromVersion: "1.0.0", toVersion: "2.0.0", constraint: undefined,
});
```

### WR-10: New documentation carries GSD planning-artifact references

**File:** `docs/output-catalog.md:1636`, `docs/output-catalog.md:1658`

**Issue:** two new catalog entries name planning steps rather than durable IDs: *"The same `{dependents constrain}` token **plan 10-01** minted carries this arm too"* and *"the success row reuses **Phase 7's** existing `{dependency current copy}` token"*. `.claude/rules/typescript-style.md` → `skills/typescript-comments/SKILL.md` bans `Phase NN` / `Plan NN` references and keeps only decision and requirement IDs; both sentences already carry a decision ID (D-10-10, D-10-15) that says the same thing durably. These references go stale the moment the phase directory is archived.

**Fix:** drop both tokens — `"The same `{dependents constrain}` token carries this arm too (D-10-10)"` and `"the success row reuses the existing `{dependency current copy}` token (D-10-15)"`.

## Info

### IN-01: A doubly-declared dependency is named twice on the cause line

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:234-246`

**Issue:** `collectHolders` pushes one holder per matching declaration, and `parseDeclaredDependencies` (`domain/dependencies.ts:210`) performs no de-duplication — its own doc says *"duplicate handling remain the caller's rules"*. A manifest declaring `["shared-lib@^1.0.0", {"name": "shared-lib", "version": "^1.2.0"}]` produces two holders with the same key, so the cause line reads `required by "alpha@mp", "alpha@mp"`.

**Fix:** de-duplicate by `key` when the ranges are identical, or fold one declarer's several ranges into one holder before naming. At minimum add a case pinning the current rendering so it is a decision rather than an accident.

### IN-02: The ceiling disclosure never reaches a plural manual bulk `update`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts:162-164`

**Issue:** `groupCascadeOutcomes` drops every `unchanged` outcome at `cardinality === "plural"`, so the D-10-13 cause line is reachable only from a single-target `update <plugin>@<mp>` (and from the autoupdate cascade when at least one sibling changed). `docs/dependency-resolution.md` states the behaviour unconditionally: *"When the plugin is already at the highest version its dependents admit, the row still reads `{up-to-date}`, and the `cause:` line names the range and its holders."*

**Fix:** qualify the doc sentence ("on a targeted update; a bulk run omits up-to-date rows entirely"), or reconsider the plural filter for constrained `unchanged` rows.

### IN-03: The disjoint detail counts ranges while the line names holders

**File:** `extensions/pi-claude-marketplace/domain/dependency-range.ts:229` with `update-constraint-gate.ts:449-452`

**Issue:** `ranges` excludes holders that declared no version (line 449), but `holders` — the list `describeConstraint` names — includes them. A target held by two ranged declarers plus one rangeless one renders `no version satisfies all 2 declared ranges -- required by "a@mp", "b@mp", "c@mp"`: three names, two ranges. Accurate but confusing.

**Fix:** either say "declared ranges" with the count of names, or mark rangeless holders on the line the way disabled ones are marked (`"c@mp" (no range declared)`).

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
