---
phase: 08-enablement-parity-for-dependencies
reviewed: 2026-09-21T18:30:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-disable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-enable.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 5
  warning: 7
  info: 3
  total: 15
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-09-21T18:30:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 08 adds the `enable` dependency cascade (EDEP-01), the `disable` dependents guard (EDEP-02), and the install cascade's re-enable arm for disabled already-installed dependencies (EDEP-03), plus the closed-set amendments and a behaviour-preserving `install-flow.ts` refactor (cd11171c, which I read in full and found sound: every former sentinel maps onto exactly one `InstallTransactionOutcome` arm and the post-guard `switch` preserves the original branch order, including the D-102-02 fall-through that saves before reporting).

The messaging layer, the closed-set bookkeeping (all ten surfaces agree at 60 members with `dependency enabled` then `dependents remain` at the tail), the catalog swap, and the EDEP-02 guard itself are correct as far as I could trace them. The defects are in the enable cascade's transaction shape and in the install cascade's re-enable arm:

1. Both cascades re-enable a dependency through its state record but never touch a config entry that already says `enabled: false` for it -- which is exactly what `disable <dep>` writes. The next reconcile pass plans the disable back and then holds the dependent down (CR-01). The executors handled this identical hazard for the ROOT (D-04-07's promotion overwrites the entry; `resolveIdempotentOutcome` promotes config truth) and did not carry it to members.
2. `assertOnlyCycleReachable`'s evidence is false: a `sha`-pinned declaration reaches the walk's `unusable-declaration` arm, and the cycle-only composer then dereferences `failure.chain` on an arm that has none (CR-02, reproduced).
3. The enable cascade's members run in their own `runPhases` ledger while the root runs afterwards outside it, so any root failure after the members committed leaves the members' artifacts on disk with no state save -- the code's own "Known gap" comment, which is reachable through several tested paths (CR-03).
4. The install cascade's re-enable arm is not transitive: the walk stops at a disabled already-installed member because `collectInstalledKeys` includes disabled records, so that member's own disabled dependencies stay disabled and LOAD-01 holds the freshly re-enabled member down on the next pass (CR-04).
5. The three EDEP-01 unwind/undo fault-injection tests assert only state.json on a path that never saves, so a no-op `undo` passes them (CR-05).

Two test fixtures were weakened under the new guard in a way their own arrange comments no longer describe truthfully (WR-05), and several new source comments violate the project's comment policy (WR-06).

## Critical Issues

### CR-01: A re-enabled dependency whose config entry says `enabled: false` is reverted by the next reconcile pass

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:616-660` (member phase), `:1545-1554` and `:1586-1590` (only the root reaches `writeEnabledFlagBack`); `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:948-999` (`buildReEnableMemberPhase`)
**Issue:** The canonical way a dependency becomes installed-and-disabled is `disable <dep>`, and that verb always writes `{ "<dep>@<mp>": { "enabled": false } }` into the scope config (`writeEnabledFlagBack` -> `writeAdoptingConfigEntries`, `shared.ts:794-817`; the pre-phase `install-flow.test.ts` and `import/execute.test.ts` fixtures relied on exactly this). EDEP-02 makes the mandated sequence `disable A` (dependent) then `disable B`; both writes land. A later `enable A` (or `install A`) re-enables `B` through its record only -- D-04-02 is read as "never touch the config for a member" -- and reports `(installed) {dependency enabled}` with a `/reload` trailer. On that reload `plan.ts::classifyDeclaredPlugin` (lines 480-500) sees `enabled === false` declared and a record that is not disabled and plans `disable B` (orchestrated, so the EDEP-02 guard is skipped by design), after which `dependency-verdict.ts` holds `A` down as `dependencyDisabled`. The command's result does not survive the reload it asks for. The same phase's own D-04-07 fixtures state the hazard for the root ("A bare key merged over that entry would leave `enabled: false` in the file and hand the reload the row asks for a disable to plan") and the promotion path overwrites the entry; `resolveIdempotentOutcome` (lines 1271-1286) likewise promotes config truth for the root. Neither treatment was applied to cascade members. No test seeds a config entry for a member (`seedEnableCascadeFixture` writes no config file at all; `install-cascade.test.ts` asserts the config files do not exist).
**Fix:** Treat an explicit `enabled: false` for a member as the divergence it is. Inside the same lock, after the member ledger runs, patch the declaring file (base or local, chosen the way `selectDeclaringConfigWriteTarget` chooses for the root) to `enabled: true` -- upstream's documented behaviour ("Claude Code writes `true` for it at install or enable time") -- or delete the key. Leave a member with no entry untouched (that keeps D-04-02 for the "never add a key" case). Add a test that seeds `{"b@official": {"enabled": false}}`, runs `enable a`, and asserts `planReconcile(merged, stateAfter, scope)` equals `emptyReconcilePlan(scope)`, the assertion the D-04-07 fixtures already use for the root.

```ts
// runEnableCascadeStep, after materialized.ok: for each re-enabled member whose key the
// target-scope config declares with enabled === false, write { enabled: true } through
// transaction.writeConfigEntries using the member's own declaring-file selection.
```

### CR-02: `assertOnlyCycleReachable` is wrong -- a `sha`-pinned declaration crashes the enable with a TypeError

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:499-527`
**Issue:** The assertion's evidence claims `unusable-declaration` "needs a lookup that reports `"unusable"` -- this one never does". That is not the only producer: `domain/dependency-closure.ts::buildChildEdge` (lines 285-325) returns `{ reason: "unusable-declaration" }` itself for a declared `sha` (D-03-36) and for an unrenderable filled-in marketplace, before any lookup. `AddressedDependency extends DeclaredDependency` and keeps `sha` (`dependency-index.ts:97`; its header at lines 44-45 says so explicitly: "A declaration HOLDS its key whatever `version` or `sha` constraint it carries"). So a root whose closure contains a `sha`-pinned declaration reaches `enableCascadeClosureFailure`, which reads `failure.chain.join(...)` on an arm that has no `chain`. Reproduced with the real walk: `{"ok":false,"reason":"unusable-declaration","key":"a@mp","detail":"dependencies.0: sha pinning is not supported"}` followed by `TypeError: Cannot read properties of undefined (reading 'join')`. The TypeError escapes the closure, the outer catch renders a brace-less `(failed)` row whose cause line is the TypeError text. The install cascade's `closureFailureFacts` handles this arm; the enable cascade does not. Reachable whenever the clone's `plugin.json` gained a `sha` pin after the record was written (marketplace update), which the install-time refusal cannot prevent.
**Fix:** Replace the assertion with a switch over the two reachable arms and keep an assertion only for the two that are genuinely unreachable (`not-found`, `marketplace-not-added`):

```ts
function enableCascadeClosureFailure(failure: ClosureFailure): EnableRefusedError {
  switch (failure.reason) {
    case "cycle":
      return new EnableRefusedError("dependency cycle", `Dependency cycle: ${failure.chain.join(" -> ")}.`);
    case "unusable-declaration":
      return new EnableRefusedError("invalid version constraint", `${failure.key}: ${failure.detail}.`);
    default:
      assertNotFoundAndMarketplaceUnreachable(failure);
  }
}
```

Add a test that declares `{ name: "b", sha: "abc123" }` on the root and asserts the refusal row bytes and that nothing is saved.

### CR-03: A root failure after the cascade members committed leaves member artifacts on disk with no state save

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:716-772` (`runEnableCascadeMembers`), `:1556-1590` (root dispatch, config write, save)
**Issue:** The members are materialized through their own `runPhases` ledger, which completes and returns before the root's `runEnableBranch` runs (via `dispatchBranch`) and before `writeEnabledFlagBack` and `tx.save()`. Nothing after that point can unwind the members. If the root's ledger fails (line 1574-1576 returns `enable-failed` without saving), or `writeEnabledFlagBack` throws (the file already tests "a config-write failure leaves the state bytes unchanged" for the root), or `tx.save()` throws, the members' skills/commands/agents/hooks are already staged on disk while state.json still records them disabled. The comment at lines 725-729 admits this ("Known gap ... Not reachable by any case this plan tests") -- but reachability is a property of the code, not the test set: ENBL-03 (missing clone), WR-02 (stale gate), WARN-01-class malformed content, and the config-write EACCES case all reach it whenever the root has a disabled dependency. This is the exact NFR-3 violation the `cascadeNeedsSave` save at line 1545-1551 was written to prevent for the idempotent arm.
**Fix:** Make the root's enable the last phase of the same `runPhases` ledger so the members' `undo` runs when it throws, and move the config write-back inside that ledger (or run the members' undos explicitly on every post-cascade failure before returning). Sketch:

```ts
const phases = [...memberPhases, {
  name: rootKey,
  do: async (run) => { run.root = await runEnableBranchOrThrow(...); },
  undo: /* nothing: the ledger already rolled the root back before rethrowing */ undefined,
}];
```

Add a fault-injection test: root's `runInstallLedger` rejects after `b` materialized; assert `b`'s skill directory is absent afterwards.

### CR-04: The install cascade's re-enable arm is not transitive -- a re-enabled member's own disabled dependencies stay disabled and LOAD-01 holds it down again

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:851-876` (`partitionAlreadyInstalled`), `:1085-1103`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:459-468, 1453` (`collectInstalledKeys`)
**Issue:** `collectInstalledKeys` adds every record, enabled or disabled, to `installedKeys`, and `walkDependencyEdge` (`dependency-closure.ts:363-375`) returns WITHOUT recursing on an `installedKeys` hit. So for `install R` where `R -> D -> E` and both `D` and `E` are installed-and-disabled, the walk puts `D` in `alreadyInstalled` and never visits `E`. `partitionAlreadyInstalled` re-enables `D`; `E` is untouched. The row says `(installed) D@mp {already installed, dependency enabled}`, but `dependency-verdict.ts`'s "its record is disabled" arm (LOAD-01) holds `D` down on the next pass and the fixpoint then holds `R` down too. The enable cascade avoided precisely this by passing an empty `installedKeys` (`enable-disable.ts:577-582`, whose comment names the truncation); the install cascade did not get the same treatment. `docs/dependency-resolution.md:112` and `docs/plugin-enablement.md:40` promise "the install turns it back on" without this limit.
**Fix:** For each `toReEnable` member, resolve its own closure the way the enable cascade does (empty `installedKeys`, lookup over the scope declaration map) and re-enable every disabled member of that sub-closure in post-order, before the root's phases. Alternatively exclude disabled records from `installedKeys` only when the walk can classify them (then route them to `buildReEnableMemberPhase` rather than `buildMemberPhase`). Add an `install-cascade.test.ts` case with a depth-2 disabled chain asserting both records end enabled.

### CR-05: The EDEP-01 unwind and undo fault-injection tests cannot observe the behaviour their titles claim

**File:** `tests/orchestrators/plugin/enable-disable.test.ts:4794-4842`, `:4883-4936`, `:4940-5001`
**Issue:** All three cases fail the enable (member `c`'s ledger rejects) and then assert `enabled === false` for `a`, `b`, `c` in state.json plus `assert.match(message, /\(failed\)/)`. On this path the closure returns `enable-failed` and never calls `tx.save()`, so state.json is byte-for-byte the seed regardless of whether `b`'s `undo` ran, whether the partial-unstage fold happened, or whether the vanished-record guard fired. A `buildEnableCascadeMemberPhase` with `undo: undefined` passes all three. The only observable of the unwind is the on-disk footprint (`b`'s `s1` skill staged by `do`, unstaged by `undo`), which none of them read. The `/\(failed\)/` match also lets a row that names the wrong subject, drops the cause, or leaks an absolute path pass. This is the sole proof of the D-03-07 all-or-nothing stance the cascade claims.
**Fix:** Assert the footprint and the exact row bytes:

```ts
await assert.rejects(stat(path.join(scopeRoot, "skills", "b:s1")), { code: "ENOENT" });
assert.equal(notifications[0]!.message, [
  "A plugin operation has failed.", "", "● official [user]",
  "  ⊘ a v1.0.0 (failed)", "    cause: c's ledger failed",
].join("\n"));
```

For the fold case, drive `cascadeUnstagePlugin` to leave one real file behind and assert the on-disk remainder together with whatever the fix for WR-01 persists.

## Warnings

### WR-01: The enable cascade discards every rollback-partial signal and its undo swallows an unfinished unstage

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:629` (member `capture` never read), `:662-687` (undo swallows `!outcome.ok`), `:765-771` (`result.rollbackPartials` dropped), `:833-841` (outcome carries no `rollbackPartials`)
**Issue:** A member's ledger creates an `InstallFailureCapture` and passes it to `runInstallLedger`, but the capture is discarded; `runEnableCascadeMembers` returns only `result.error` and drops `result.rollbackPartials`; and the member undo folds a partial unstage into `installedNow` and returns normally instead of rethrowing, so `runPhases` records no partial either. The failed row therefore never carries `{rollback partial}` or the per-phase children the root's own `enableFailedRow` renders (lines 2078-2103), and because the closure does not save on this path the fold itself is thrown away -- the undo's comment ("puts the member BACK to disabled ... state.json never claims artifacts gone from disk") describes an in-memory mutation nothing persists. Plan 08-03 recorded the install cascade's rethrow as a deliberate divergence from this code; the divergence is in the wrong direction here.
**Fix:** Rethrow after the fold (as `buildReEnableMemberPhase` does), thread `result.rollbackPartials` and the member capture's partials into the `enable-failed` outcome's `rollbackPartials`, and either save the folded record (mirroring `saveShrunken` on the disable branch) or state in the row that artifacts remain.

### WR-02: Re-enabled cascade members' hooks are never hydrated into the routing cache

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:616-660`, `:1591`
**Issue:** After the save, only the root's `addRoutesAfterSave` reaches `addCachedHooksAfterSave`. A member re-enabled through `buildEnableCascadeMemberPhase` whose ledger staged a `hooks.json` has the file on disk and no routing entry until the next `/reload`. `install-flow.ts` hydrates every materialized member for exactly this reason (its RESV-01 comment: "A dependency whose ledger staged a hooks.json otherwise has the file on disk and no routing entry ... exactly the divergence this block exists to close"), and the install cascade's re-enable arm inherits that because its members land in `installed.members`. The enable cascade is the one path where a re-enabled plugin's hooks stay inert in-process while the row says `(installed)`.
**Fix:** Record `{ hooksJsonPath, resolvedSource }` per re-enabled member in `EnableCascadeRun` (the summary already carries `resolved.pluginRoot` and `resolved.hooksConfigPath`), return them on the `ran` arm, and call `addCachedHooks` for each after `tx.save()` on both the fresh and the idempotent-root save paths.

### WR-03: The whole-scope fail-closed declaration read misattributes a manifest-absent root as `{unreadable}` and blocks unrelated plugins

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:569-572`, `:977-980`; `tests/orchestrators/plugin/enable-disable.test.ts:1633-1650`
**Issue:** `resolveEnableCascade` and `readEnabledDependents` build the declaration index for EVERY record in the scope before anything else, and any unreadable record refuses the command. Two consequences the phase accepted silently: (a) the ENBL-07 / D-97-01 case ("enable on a manifest-absent disabled PARTIAL") changed its rendered bytes from `⊘ foo-plugin v1.2.3 (failed)` + `cause: Plugin "foo-plugin" not found in marketplace "mp".` to `⊘ foo-plugin (failed) {unreadable}` + `cause: cannot read the dependencies of foo-plugin@mp: not declared by its marketplace` -- the manifest IS readable and the plugin is absent from it, which the file's own ATTR-08 comment (lines 2126-2131) says is `{not in manifest}`, and the version slot vanished; (b) `enable foo` / `disable foo` for a plugin that declares nothing and that nothing declares is now refused when some unrelated record in the scope has an unreadable manifest. `uninstall`'s D-05-07 guard is the cited precedent, but that guard was retired (D-06-06); `enable`/`disable` are now the only verbs with a scope-wide fail-closed gate.
**Fix:** For `enable`, read only the root's declaration first and refuse on the root's own read failure with the ATTR-08 taxonomy (`not in manifest` when the manifest is readable and the plugin absent, `unreadable` otherwise, keeping `recordedVersion` on the row), then read members lazily from the walk's lookup. For `disable`, keep the scope index but map a per-record "not declared by its marketplace" detail to a non-blocking "declares nothing" for records other than the target, or document the new blocking behaviour in `docs/plugin-enablement.md`.

### WR-04: A not-installed declared dependency renders an `error` block over an `(installed)` root row whose enable the next reload undoes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:704-713`; `tests/orchestrators/plugin/enable-disable.test.ts:4551-4593`
**Issue:** The `not-installed` disposition stamps `severity: "error"` on the member row and the block renders `A plugin operation has failed.` above `● a v1.0.0 (installed)` and `/reload to pick up changes`. The enable WAS carried out (info by the tri-state model), yet the header says failed; and on the reload the trailer asks for, LOAD-01's `missing` arm holds `a` down as `dependencyDisabled`, so the `(installed)` promise is one reload long. The install cascade refuses the same situation (`not-found` fails the cascade); the enable cascade reports it and proceeds, producing a row and a trailer that contradict each other and the next pass.
**Fix:** Either refuse the enable through `EnableRefusedError` with a reason naming the missing dependency (parity with the install cascade and with what LOAD-01 will do anyway), or keep proceeding but stamp `warning` ("carried out but short") and drop the reload trailer's implication that the result stands. Document the chosen behaviour in the `enable-cascade` catalog prose, which currently describes the current mixed block.

### WR-05: Two promotion fixtures no longer seed the `enabled: false` config entry their arrange comments still describe

**File:** `tests/orchestrators/import/execute.test.ts:2952-3056` (first D-04-07 fixture), `tests/orchestrators/plugin/install-flow.test.ts:5797-5828` and `:5896-5907`
**Issue:** In `import/execute.test.ts` the first D-04-07 fixture now calls only `seedDisabledDependencyRecord` (state + skill removal) yet its comment says the post-pass "writes the enable path's own `{ enabled: true }` over the seeded entry" -- no config entry is seeded, so the case no longer exercises the overwrite-an-explicit-false behaviour the comment (and the original test) named; only the `--local` sibling still seeds it. In `install-flow.test.ts`, `disableSeededDependency` switched to orchestrated mode, which skips the config write-back, but the "--local promotion" case's arrange comment (lines 5900-5903) still claims "the disable verb stamped `{ enabled: false }` in the base file. A bare local key would replace that entry wholesale (CFG-02) and enable the plugin by omission" -- `baseBefore` now contains no such entry, so the CFG-02 shadowing hazard the case was written for is not exercised. Both are the "assertion that used to fire on a real path now fires on a fixture shortcut" pattern.
**Fix:** Seed the config precondition explicitly in both fixtures (`writeUnder(project.configJsonPath, configBytes({... "dep@fixture-mp": { enabled: false }}))` in the import fixture; write `some-other-plugin@mp: { enabled: false }` into the base file after the orchestrated disable in `disableSeededDependency`) and update the comments to say the entry is seeded directly.

### WR-06: New source comments violate the project comment policy

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:612-614`, `:728`, `:1436-1438`, `:1955-1958`; `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:143-147`; `extensions/pi-claude-marketplace/shared/notification-types.ts:163-164`; `extensions/pi-claude-marketplace/shared/notify-reasons.ts:368-369`
**Issue:** `skills/typescript-comments/SKILL.md` forbids GSD phase/plan references and narration of removed code. Violations introduced by this phase: "the Phase 6 consequence marker cleared" (enable-disable.ts:613 -- a GSD phase, not a domain phase); "Not reachable by any case this plan tests" (:728) and "in every case this plan does not change" (:1437); "byte-identical to the pre-EDEP-01 single-row form" (messaging.ts:146, enable-disable.ts:1437 and :1958 -- the skill names "byte-identical to what came before" as the example to remove: name the gate or say nothing); "Retires the `{already installed, dependency disabled}` skip this token replaces" (notification-types.ts:163-164, notify-reasons.ts:368-369 -- "replacing the former X"). The `notify-reasons.ts` header paragraph (lines 63-78) and the `notify-closed-set-locks.test.ts` running arithmetic are the file's established count ledger and I have not flagged them.
**Fix:** Rewrite as present-tense facts: "the LOAD-02 consequence marker (`dependencyDisabled`)"; drop the "this plan" sentences (CR-03 removes the gap the first one describes); replace "byte-identical to the pre-EDEP-01 form" with "a one-element sort is a no-op, so a root with no members composes to `[rootRow]` (pinned by the `enable-fresh` catalog state)"; replace "Retires the ... skip this token replaces" with nothing or with "a member re-enabled through its record is an `installed` row, never a skip".

### WR-07: The standalone/orchestrated asymmetry is undocumented and leaves the same intent with two outcomes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:805-818`, `:964-975`; `docs/plugin-enablement.md:38-42`
**Issue:** Both the cascade and the guard no-op for orchestrated calls. That is defensible for the reconcile disable bucket (LOAD-02 propagation would deadlock otherwise), but the docs now state "`enable <plugin>` reaches the same outcome for the declared dependency closure" without saying that the config-driven path does not: setting `A: {}` in `claude-plugins.json` and reloading enables `A` alone, leaves its disabled dependency `B` disabled, and the same pass holds `A` down as `dependencyDisabled`; the command form turns `B` on. Likewise `B: {enabled: false}` in the config disables `B` and cascades `A` off, where `disable B` is refused with `{dependents remain}`. The reconcile side's own handling (`dependency-verdict.ts` LOAD-01/02) only ever holds records DOWN; nothing on that path lifts a dependency, so the executors' "the reconcile path has its own dependency handling" justification covers disable but not enable. Combined with CR-01 this is what makes a `disable`/`enable` round trip land on the config-driven outcome.
**Fix:** Either run the enable cascade for orchestrated enables too (with the config patch from CR-01, and with EDEP-02 still skipped for orchestrated disables), or document in `docs/plugin-enablement.md` that a config-declared enable does not turn on a disabled dependency and that LOAD-01 will hold the dependent down until the user runs `enable`.

## Info

### IN-01: `EnableCascadeMember.record` is optional where the disposition already decides it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:443-449`, `:750-762`, `:697`
**Issue:** `record?` plus a string `disposition` means `runEnableCascadeMembers` needs an `if (member.record !== undefined)` guard whose `else` silently drops a `re-enabled` member -- no phase and no row at all -- and `enableCascadeSkipRow` carries a conditional spread on a field that is always present for `already-enabled`. Both are the "optional field silent omission" class.
**Fix:** Make it a discriminated union: `{ disposition: "re-enabled" | "already-enabled"; record: InstalledPluginRecord } | { disposition: "not-installed" }`, and remove both guards.

### IN-02: Names that no longer describe what the code does

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:414` (`EnableRefusedError` now also carries disable refusals), `:964` (`readEnabledDependents` returns `void` and throws)
**Issue:** `EnableRefusedError` is thrown for `{dependents remain}` on `disable`; `readEnabledDependents` is a guard, not a read. A reader of the catch site at line 1623 sees "enable refused" on a disable row.
**Fix:** `PluginToggleRefusedError` (or `EnableDisableRefusedError`) and `refuseDisableWithEnabledDependents` / `assertNoEnabledDependents`.

### IN-03: Test structure drift in the messaging suite

**File:** `tests/orchestrators/plugin/enable-disable.messaging.test.ts` (new `describe` blocks), `tests/orchestrators/plugin/install-cascade.test.ts` ("byte-identical to today" title)
**Issue:** The messaging test file was flat `test()` cases and now mixes two `describe()` groups (`composeEnableCascadeRows`, `composeDisableRefusalCause`) with bare cases, which is the shape `skills/typescript-unit-testing-review` asks to avoid (one style per file, `describe` per exported entrypoint when the module has several). "byte-identical to today" is a time-relative title; the fact is "a plugin that declares nothing composes the single-row block".
**Fix:** Either wrap every entrypoint's cases in its own `describe` or keep the file flat with prefixed titles; retitle the install-cascade case.

---

_Reviewed: 2026-09-21T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
