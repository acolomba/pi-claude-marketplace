---
phase: 03-dependency-resolution
reviewed: 2026-09-15T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/domain/manifest-path.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/dependency-closure.test.ts
  - tests/domain/dependency-range.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/orchestrators/plugin/dependency-declaration-read.test.ts
  - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/platform/git.test.ts
  - tests/shared/notification-types.test.ts
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - scripts/test-coverage-direct.pin.json
  - package.json
  - CLAUDE.md
  - README.md
  - README.es.md
findings:
  critical: 5
  warning: 8
  info: 3
  total: 16
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

The phase ships a dependency closure walk, a semver intersection algebra, an offline
declaration read, a network tag probe, an outer cascade ledger, and a closed-set
notification amendment. The structural disciplines the phase set out to honor hold up
under inspection:

- **NFR-5 gate placement is sound.** `install-flow.ts` and `install-outcome.ts` carry no
  `gitOps` / `platform/git` / `DEFAULT_GIT_OPS` / `refreshGitHubClone` token; the probe
  is reached through a field named `tagProbe`, which the gate's bare-identifier match
  does not see. `dependency-declaration-read.ts` reaches only `stat`/`readFile` and the
  fs-only presence probe — no materializing path exists in it.
- **The wildcard short-circuit really is offline.** I verified with the shipped `semver`
  that `validRange(">=0.0.0")`, `validRange("x")` and `validRange("* *")` all canonicalize
  to `"*"`, so `isUnconstrainedRange` does collapse every unconstrained spelling and an
  unconstrained member makes no query.
- **Lock re-entrancy is clean.** The cascade calls the guard-free `runInstallLedger` and
  opens no guard of its own; `installPlugin` is never re-entered.
- **Constraint resolution ordering is correct.** `resolveMemberConstraints` runs strictly
  between `resolveDependencyClosure` and the `Phase[]` construction, so no constraint
  verdict can reach rollback.
- **The closed vocabulary was amended by equality, not loosened.** `compat-01-no-expansion.test.ts`
  still deep-equals a hand-written list, each of the seven new members carries an inline
  justification, and `notify-closed-set-locks.test.ts` bumped 45 → 52. No cascade row
  interpolates a filesystem path or a credential value.
- **Cycle/diamond separation is right.** I traced the two-structure walk (`path` for
  cycles, `visited` as a success memo) over a diamond and a nested cycle; the post-order
  accumulator is a correct install order and no key can land in `visited` without landing
  in `order` or `path`.

What does not hold up is the cascade's behavior at four seams the module headers claim to
have covered: the config declaration on the orchestrated path, the cross-scope marketplace
precondition, the rollback-failure report, and the version the pin is recorded under. Each
is a real, reachable defect with a user-visible consequence, and none is covered by a test.
`npx tsc --noEmit` is clean, which is exactly why none of these surfaces as a build failure.

## Critical Issues

### CR-01: Cascade dependencies are never declared on the orchestrated path, so the next reload uninstalls them

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1080-1145`
**Issue:**
`runInstallCascade` runs on **every** `installPlugin` call, standalone and orchestrated
alike — the mode only gates the write-back. The declaration of cascade-installed
dependencies rides `dependencyPluginPatches` inside `writeAdoptingConfigEntries`, and that
call sits under `if (opts.notifications?.mode !== "orchestrated")`. The `else` arm writes
at most the root's own `enabled: false` (`writePluginConfigEntry`, line 1137); it carries
no dependency keys.

The two orchestrated callers are the reconcile apply loop
(`orchestrators/reconcile/apply.ts:223`, driven from `resources_discover`) and the import
cascade (`orchestrators/import/execute.ts:704`). Import's own post-pass
(`writeBatchedConfigForScope`) builds its patch from `result.installedPlugins`, which holds
only the plugins the source config planned — it never sees a cascade member.

Consequence, traced end to end: reconcile installs `helper@official`, which pulls in
`formatter@tools`. `state.json` records `formatter@tools`; no config file declares it. On
the next `resources_discover`, `buildUninstallBucket`
(`orchestrators/reconcile/plan.ts:501-506`) finds a recorded key absent from
`declaredPluginKeys` and plans its **uninstall**. The dependency is silently removed while
the parent stays installed and is now broken. This is precisely the failure the
`dependencyPluginPatches` doc comment on line 1104 says the field exists to prevent — the
prevention just never reaches the orchestrated arm.

No test covers it: `install-flow.test.ts` has 28 orchestrated-mode cases and none asserts
anything about dependency declarations.

**Fix:** Mirror the DFEN-04 precedent — write the dependency keys in orchestrated mode too,
through the single-entry writer, so WR-09's "no full write-back" rule stays intact:

```ts
if (opts.notifications?.mode !== "orchestrated") {
  await writeAdoptingConfigEntries({ /* unchanged */ });
} else {
  // RESV-01's reload clause applies in BOTH modes: a recorded-but-undeclared
  // dependency is swept by buildUninstallBucket on the next resources_discover.
  // WR-09 forbids the full write-back, not the keys the cascade itself created.
  const dependencyKeys = installed.members
    .map((m) => m.key)
    .filter((key) => key !== rootKey);
  if (dependencyKeys.length > 0 || disabledInstall.landed) {
    await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
      plugins: {
        ...Object.fromEntries(dependencyKeys.map((key) => [key, {}])),
        ...(disabledInstall.landed && { [rootKey]: { enabled: false } }),
      },
    });
  }
}
```

Add a reconcile-path regression test that runs two `applyReconcile` passes over a
dependency-declaring plugin and asserts the dependency survives the second pass.

### CR-02: A project-scope install from a user-scope marketplace fails outright once the plugin declares a dependency

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:970-981`, `extensions/pi-claude-marketplace/domain/dependency-closure.ts:277-288`
**Issue:**
`knownMarketplaces` is built as `new Set(Object.keys(state.marketplaces))` — the raw
**target-scope** key set. But the closure's own catalog read,
`lookupCascadeDependencies` (line 304), resolves the marketplace through
`resolveInstallMarketplaceSource`, which performs the CMP-3 project → user fallback. Two
different notions of "which marketplaces are reachable" are in play in one walk, and the
guard runs **before** the lookup (`walkEdge`, `dependency-closure.ts:367-382`), so the
stricter one wins.

Reachable scenario, entirely within the supported CMP-2..4 flow:

1. `marketplace add owner/official` at user scope (the default).
2. `/claude:plugin install helper@official --scope project`.
3. `helper` declares `["formatter"]` — a sibling in the **same** marketplace.

The root is exempt from the marketplace guard, so its lookup succeeds via CMP-3 and returns
`[formatter]`. The child edge `formatter@official` is not the root, project
`state.marketplaces` has no `official` key, and `guardEdge` returns
`marketplace-not-added`. The whole cascade fails with:

> `Dependency "formatter@official" requires marketplace "official", which is not added. Run marketplace add <source> to add it.`

The user *has* added it, installing `helper` alone works, and the suggested remedy is
wrong. The message is also the only one in the phase with a trust rule behind it
(D-03-08), so this failure mode reads to the user as a security refusal when it is a
resolution bug.

The same defect sits in `resolveMemberTagSource`
(`install-cascade.ts:368`), which reads `state.marketplaces[member.marketplace]` directly
rather than through the CMP-3-aware resolver; fixing only the guard would move the failure
there.

**Fix:** Seed the guard from the same resolver the lookup uses. The cheapest correct form
is to compute the reachable set once, before the cascade, and pass it in:

```ts
// D-03-08 must gate on the marketplaces this install can actually READ, which is
// the CMP-3-aware set, not the raw target-scope key set -- otherwise the guard
// refuses a marketplace the walk's own lookup would have resolved.
const declaredMarketplaces = new Set(Object.keys(state.marketplaces));
if (await resolveInstallMarketplaceSource({
  targetScope: scope, cwd, marketplace, targetState: state,
}) !== undefined) {
  declaredMarketplaces.add(marketplace);
}
// ... knownMarketplaces: declaredMarketplaces
```

and make `resolveMemberTagSource` take the resolved source record rather than re-reading
`state.marketplaces`. Add a case to `install-flow.test.ts` alongside the existing
`CMP-3 / PI-16` test (line 3425) where the plugin declares a same-marketplace dependency.

### CR-03: A failed cascade rollback is reported as a clean one, and the only test proving otherwise uses a double that cannot match production

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:596-616`
**Issue:**
`cascadeUnstagePlugin` **never throws**. Its whole body is wrapped in a try/catch that
returns `{ ok: false, dropped, cause }`
(`orchestrators/marketplace/shared.ts:379-392`). `buildMemberPhase.undo` discards that
return value entirely and then unconditionally drops the record:

```ts
await seam.cascadeUnstagePlugin(member.name, member.marketplace, options.locations, installed);
delete marketplaceRecord.plugins[member.name];
```

Because `undo` resolves normally, `runPhases` records **no** `RollbackPartial`. So
`failureFacts` (`install-cascade.messaging.ts:352-357`) sees an empty
`rollbackPartials`, emits no `{rollback partial}` token, and the user is told the cascade
unwound cleanly. Meanwhile the member's skills/commands/agents/hooks/mcp artifacts are
still on disk, `state.json` was never saved (the throw aborts before `tx.save()`), and so
those artifacts are owned by no record at all. The next `resources_discover` aggregates
them as live resources belonging to nothing, with no remediation path and no message.

`docs/output-catalog.md`'s `dependency-install-failed` state states the opposite as
contract: "Everything this command had already materialized is unwound."

The single-plugin ledger does not have this hole — its bridge phases throw on undo failure,
which is exactly how `{rollback partial}` normally fires. The cascade's outer undo broke
the chain.

The test that appears to cover this,
`tests/orchestrators/plugin/install-cascade.test.ts:471` ("an undo that itself fails
surfaces a rollback partial without throwing"), injects
`Promise.reject(new Error("unstage denied"))` — a failure mode the real primitive is
structurally incapable of producing. It proves `runPhases`' plumbing and nothing about the
production path. Compare line 529, which wraps the *real* `cascadeUnstagePlugin`, and never
faults it.

**Fix:** Read the outcome and convert it to a throw so the ledger can report it; gate the
record deletion on a clean unstage so `state.json`'s in-memory view stays truthful about
what remains on disk:

```ts
undo: async (run) => {
  if (!run.materialized.has(member.key)) { return; }
  const marketplaceRecord = options.state.marketplaces[member.marketplace];
  const installed = marketplaceRecord?.plugins[member.name];
  if (marketplaceRecord === undefined || installed === undefined) { return; }

  const outcome = await seam.cascadeUnstagePlugin(
    member.name, member.marketplace, options.locations, installed,
  );
  if (!outcome.ok) {
    // The primitive reports rather than throws; the ledger's partial-rollback
    // channel is a throw, so convert. Subtracting what DID drop keeps the record
    // honest about the artifacts still on disk (NFR-3).
    applyPartialCascadeFold(installed, outcome.dropped);
    throw outcome.cause ?? new Error(`Rollback of "${member.key}" did not complete.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- token-checked plugin name.
  delete marketplaceRecord.plugins[member.name];
},
```

Replace the throwing double at line 471 with one that returns `{ ok: false, cause, dropped }`,
so the case actually exercises the production contract.

### CR-04: A tag-pinned dependency is recorded under a sha version, so re-running the same install fails the constraint it just satisfied

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:424-428`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:339-356`
**Issue:**
`probeDependencyTags` returns `{ kind: "pinned", tag, oid, version }` — it knows the exact
semver the tag carries. `probeMemberPin` keeps `tag` and `oid` and **discards `version`**:

```ts
member: { ...member, pinnedRef: probed.tag, pinnedOid: probed.oid },
```

`install-flow.ts:968` threads only `pinnedOid` down as `sourcePin`, so `deriveInstallVersion`
takes its git-source branch and records `shaVersion(resolvedSha)` — `sha-<12hex>`.

Now RESV-05 cannot work for the only source kind RESV-03 can pin.
`resolveMemberTagSource` returns a source only for `url`/`git-subdir`/`github`, so every
pinnable dependency is git-backed, and every git-backed install records `sha-<12hex>`. On
the next install that constrains that dependency, `checkInstalledMember` runs
`recordedVersionSatisfies("sha-<12hex>", "^1.2.0")`. I measured the actual behavior with
the shipped `semver`:

```
sha-0123456789ab -> coerce = null          -> satisfies nothing
sha-deadbeefcafe -> coerce = null          -> satisfies nothing
sha-1234567890ab -> coerce = 1234567890.0.0 -> satisfies an arbitrary >= range
```

So the second run of the *same* command fails with
`⊘ formatter@tools v sha-0123456789ab (failed) {already installed, version conflict}` —
directly contradicting `docs/dependency-resolution.md:124` ("run the same command again.
It starts from the same state as the first attempt") and making the cascade's own output
non-idempotent.

D-03-04 documents this normalization hazard as an **accepted inherited risk** for legacy
records. It is a different thing for the new code path to manufacture the hazard when it
holds the correct value and the mechanism to record it: `InstallLedgerOptions.pinVersionOverride`
already takes precedence over the sha branch (`install-outcome.ts:345-347`) and is used by
`enable-disable.ts` for exactly this purpose.

**Fix:** Carry the semver on the resolved member and record it:

```ts
// install-cascade.ts
export interface ResolvedCascadeMember extends ClosureMember {
  readonly pinnedRef?: string;
  readonly pinnedOid?: string;
  /** The semver the selected tag carries; recorded so RESV-05 can read it back. */
  readonly pinnedVersion?: string;
}
// ...
member: { ...member, pinnedRef: probed.tag, pinnedOid: probed.oid, pinnedVersion: probed.version },

// install-flow.ts, inside ledgerOptionsFor
...(member.pinnedOid !== undefined && { sourcePin: member.pinnedOid }),
...(member.pinnedVersion !== undefined && { pinVersion: member.pinnedVersion }),
```

with `buildInstallLedgerOptions` mapping `core.pinVersion` onto `pinVersionOverride`. Add a
test that installs a constrained dependency twice and asserts the second run reports
`(skipped) {already installed}`.

### CR-05: A declared `sha` pin is silently dropped by the entire cascade

**File:** `extensions/pi-claude-marketplace/domain/dependency-closure.ts:307-335`, `docs/dependency-resolution.md:31`
**Issue:**
`DeclaredDependency` carries `sha`, `parseDeclaredDependencies` validates it against
`SHA_PATTERN`, and `docs/dependency-resolution.md:31` presents it to users as one of the
object shape's four accepted keys: *"The `sha` field holds a git object name."*

`buildChildEdge` reads only `dependency.marketplace` and `dependency.version`. `sha` is
never placed on a `WalkEdge`, never reaches `ClosureMember`, and has no consumer anywhere
in `install-cascade.ts` or `dependency-tag-probe.ts` — I grepped the whole extension tree;
the only reader is `orchestrators/plugin/info.ts`, which renders it for display.

So `{"name": "formatter", "sha": "abc1234"}` installs whatever ref the marketplace entry
names, with no warning, no row, and no reason token. The user believes the dependency is
pinned to a commit; it is not.

This is the exact failure `domain/dependencies.ts:24-26` and
`docs/dependency-resolution.md:41` say the design exists to prevent: *"A constraint that
disappears quietly is worse than a declaration that is refused, because the install would
then pin a version nobody asked for."*

No test in `dependency-closure.test.ts` or `install-cascade.test.ts` mentions a declared
`sha`.

**Fix:** Pick one and make it explicit. Cheapest honest option — refuse the element, since
the refusal machinery already exists:

```ts
// buildChildEdge, before the edge is built:
if (args.dependency.sha !== undefined) {
  // RESV-03 resolves a dependency by version range only. A declared commit pin
  // is a constraint this walk cannot honor, and honoring it silently as "no
  // constraint" would install a commit nobody asked for.
  return {
    kind: "failed",
    failure: {
      ok: false,
      reason: "unusable-declaration",
      key: args.declaringKey,
      detail: `dependencies.${args.index}: sha pinning is not supported`,
    },
  };
}
```

If the intent is to support it, route `sha` to `sourcePinOverride` the same way `pinnedOid`
already is. Either way, state the behavior in `docs/dependency-resolution.md`.

## Warnings

### WR-01: A disabled dependency counts as "already installed" and is skipped at info severity

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:272-281`, `extensions/pi-claude-marketplace/domain/dependency-closure.ts:269-275`
**Issue:** `collectInstalledKeys` walks `record.plugins` with no enablement filter, and a
disabled record is still in that map (`isRecordedButDisabled` exists precisely because a
disabled plugin keeps its record and its name reservations — see
`orchestrators/plugin/shared.ts:1022-1033`). A disabled plugin has had its artifacts
unstaged, so the parent installs against a dependency that is recorded but materializes
nothing. `guardEdge` skips it, `composeCascadeMemberRows` renders
`(skipped) {already installed}`, and with no `severity` stamped the row computes `info`.
The user is told everything is fine.
**Fix:** Either treat a disabled record as not-satisfying (fail the cascade with a truthful
reason), or keep the skip but raise the row to `warning` and add a reason the user can act
on. At minimum, state the chosen behavior in `docs/dependency-resolution.md`'s "What
happens to a dependency you already installed" section, which currently says only "the
target scope already has it".

### WR-02: A cascade-installed dependency's hooks never reach the routing table

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1194-1215`
**Issue:** The post-save `readAndCachePluginHooks` + `rebuildRoutingTables` block runs once,
for `installCtx` — the **root** only. A dependency whose ledger staged a `hooks.json` gets
the file written but no routing entry, so its hooks stay inert until the next `/reload`.
That is the exact divergence the block's own WR-03 comment says it exists to close
("starts dispatching to the new plugin's hooks immediately, without requiring `/reload`").
NFR-2 is not violated (a reload does fix it), but the standalone-install contract is
now inconsistent between a plugin the user named and one the cascade installed.
**Fix:** Iterate `cascadeMembers` for the hooks hydrate, calling
`readAndCachePluginHooks` per member that declares a hooks config, then
`rebuildRoutingTables()` once at the end. The member's `resolved.hooksConfigPath` and
`resolved.pluginRoot` are already on its `InstallLedgerSummary`; today
`CascadeMemberOutcome` drops them, so it needs the two fields carried through.

### WR-03: A path-source dependency can never satisfy a constraint, and the asymmetry is undocumented

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:364-383`
**Issue:** `resolveMemberTagSource` returns `undefined` for `path`, `npm` and `unknown`
sources, and `probeMemberPin` converts that into `no-matching-tag`. So a **not-yet-installed**
path-source dependency fails every non-wildcard constraint unconditionally, while an
**already-installed** one is checked against its recorded version by `checkInstalledMember`
(line 495) and can pass. Same plugin, same version, opposite verdict depending on whether it
happens to be installed already.

Path sources are the dominant Claude marketplace layout (`"source": "./plugins/foo"`), so
this is the common case, not an edge. `docs/dependency-resolution.md:86` gestures at it
("most repositories outside Anthropic do not use it") but frames it as a tag-naming
convention issue, not as "a path-source dependency can never be version-constrained".
**Fix:** Document the source-kind precondition explicitly in the "How a constrained
dependency is resolved" section. If the asymmetry is unintended, read the candidate's
`plugin.json` version for a path source instead of reporting a tag no-match.

### WR-04: The documented failure table does not agree with the shipped reason set

**File:** `docs/dependency-resolution.md:100-113`
**Issue:** Checked row by row against the code's failure arms
(`closureFailureFacts` / `constraintFailureFacts`, `install-cascade.messaging.ts:226-335`):

- **No row for `tag-listing-failed`.** A transport failure reading the tag list is a real
  terminal arm (`network unreachable` / `authentication required` / `unreadable`) with its
  own catalog state, and the table has nothing for it. Line 82 tells the user a network
  read happens and never says what happens when it fails.
- **No row for `unusable-declaration`.** A malformed `dependencies` array fails the install
  with `{invalid manifest}`; the table omits it (line 41 describes the refusal, but the
  table is what a user scans).
- **No row for `dependency failed`**, the token stamped on the requesting plugin's own row.
- **Row 1 is a duplicate.** "No version satisfies the combined constraint / The constraint is
  valid, but no version of the dependency matches it" has no distinct code arm; it restates
  either row 2 (`no-matching-tag`) or row 4 (`disjoint`).

This confirms the open item raised in the review scope: the table and the seven new
`REASONS` members do **not** agree today, and nothing fails when they drift.
**Fix:** Add the three missing rows, delete or disambiguate row 1, and — since prose
agreement is what failed here — add a gate. `docs/output-catalog.md` is already scanned by
`VOCABULARY_GUARD_DOC_TARGETS`; register `docs/dependency-resolution.md` there and assert
its failure table names every cascade reason token exactly once.

### WR-05: A doc this phase links to now states the opposite of what the phase shipped

**File:** `docs/dependency-resolution.md:128`
**Issue:** The Further Reading entry points at `docs/plugin-enablement.md` "including why a
plugin required by another one is not enabled on its behalf". That document's line 40 now
reads as plainly false:

> "nothing here resolves a plugin's own dependency declarations … its single consumer is
> the `info` surface … never resolved, never auto-installed … With no resolution mechanism,
> nothing can know that a plugin is required by an active one … Closing the gap is tracked
> as PDEP-01 in the backlog"

The gap is closed. A reader following the link this phase added lands on a paragraph
describing the pre-phase world as current fact.
**Fix:** Rewrite `docs/plugin-enablement.md`'s paragraph to state the shipped behavior
(dependencies are resolved and installed; enablement is still not written on a dependency's
behalf, and why), and close or re-scope PDEP-01.

### WR-06: `notify-reasons.ts`'s header still describes a 44-entry closed set

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:9-15`
**Issue:** The module header says "the 44-entry membership AND order must stay
byte-identical" and "the flat 44-entry set", and its running narrative stops at
`workflows` (43 → 44). The tuple now holds 52. This phase added 7 of the 8 missing members
and updated `notify-closed-set-locks.test.ts` (45 → 52) and `docs/output-catalog.md`
(45 → 52) but not this header — the one place a reader goes to learn what the set *is*.
**Fix:** Update both counts to 52 and extend the narrative with the `data kept` (44 → 45)
and RESV-02..06 (45 → 52) steps, mirroring the wording already in
`notify-closed-set-locks.test.ts:51-59`.

### WR-07: `ResolvedCascadeMember.pinnedRef` is written and never read

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:191-196, 427`
**Issue:** `pinnedRef` is declared ("The release tag the constraint selected"), assigned in
`probeMemberPin`, and read by nothing — only `pinnedOid` is consumed
(`install-flow.ts:968`). An unread interface property is invisible to `fallow dead-code`
and to the unowned-export census, so nothing will ever flag it. The doc comment implies the
tag participates in the install; it does not.
**Fix:** Remove the field, or put it to use — it is the natural carrier for a
`{pinned <tag>}`-style diagnostic, and it pairs with the `pinnedVersion` CR-04 asks for.

### WR-08: Root-scoped install options are copied onto every cascade member

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:233-264, 962-969`
**Issue:** `ledgerOptionsFor` calls `buildInstallLedgerOptions(opts, core)` per member, and
that helper unconditionally copies `opts.mapModel`, `opts.partial`, `opts.pinVersionOverride`
and `opts.cloneCacheSeam` from the root's options into every member's. `pinVersionOverride`
is the dangerous one: it takes absolute precedence in `deriveInstallVersion`, so any caller
that sets it on `installPlugin` would record **every** dependency under the root's version
string. No production caller sets it today (only `enable-disable.ts`, which calls
`runInstallLedger` directly), so this is latent rather than live — but nothing prevents it,
and `--partial` silently widening the resolver gate for every dependency is a policy
decision that was never stated.
**Fix:** Split the per-member option set from the root's. Pass `pinVersionOverride` only
when `core.plugin === opts.plugin`, and state in `InstallPluginOptions.partial`'s doc
comment whether `--partial` is meant to apply cascade-wide.

## Info

### IN-01: The tag memo's failure-delete is unreachable-effect dead code

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:148`
**Issue:** `request.memo?.delete(request.url)` in the catch block can never remove anything.
The memo is written only on success (line 143), and a memo hit returns at line 137 before
the `try`, so the `try` is reached only when the key is absent. The comment above it —
"the memo entry is dropped on failure so a later attempt in the same cascade re-queries
instead of replaying a transient error" — describes a caching-of-failures behavior that
does not exist, which is more misleading than the line is harmful.
**Fix:** Delete the call and reword the comment to state what is actually true: the memo
holds successful listings only, so a failure leaves nothing behind and a later attempt
re-queries by construction.

### IN-02: The RESV-05 skipped row does not stamp its severity

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:213-220`
**Issue:** The skipped row omits `severity`, relying on the renderer's `?? "info"` default
(`notification-summary.ts:159-161`). Every other skipped-row producer in the tree stamps it,
usually via `skipSeverity` — which exists for exactly this classification and would return
`"info"` for `["already installed"]`. The output is correct today; the producer-stamps-its-own-verdict
convention is not honored, and the row would silently stay `info` if a non-idempotent reason
were ever added to it (see WR-01).
**Fix:** `severity: skipSeverity(["already installed"])`, or stamp `"info"` with a comment
citing the idempotent set.

### IN-03: The marketplace manifest is re-read per member during constraint resolution

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:364-383`
**Issue:** `resolveMemberTagSource` calls `loadMarketplaceManifest` once per constrained
member, duplicating work `lookupCascadeDependencies` already did during the walk, and
reaching `state.marketplaces` directly instead of through the resolver the walk used (the
second half is the root cause shared with CR-02). The read is memoized so the cost is
small; the duplication is the maintenance hazard — two sites now answer "which source backs
this member" and can diverge.
**Fix:** Have the closure lookup return the resolved source alongside the dependencies, or
thread a per-run source map, so one resolution serves both the walk and the pin probe.

---

_Reviewed: 2026-09-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
