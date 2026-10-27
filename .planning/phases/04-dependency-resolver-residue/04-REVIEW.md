---
phase: 04-dependency-resolver-residue
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/target-check.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/lib/published-marketplace.ts
  - features/plugin/install-dependencies.feature
  - features/plugin/update-dependencies.feature
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - test/bridges/agents/index.test.ts
  - test/bridges/agents/target-check.test.ts
  - test/domain/release-tag.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-tag-probe.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Scope: `git diff 2829db68..HEAD -- extensions test features`, checked against D-PL4-01..07.

What holds up:

- **Previewed-commit hand-off (D-PL4-01).** `memberLedgerPin` gives a release-tag pin (`pin.oid` plus `resolvedVersion`) precedence over `previewedCommit`. When the preview ran with that pin, the preview's commit is the same oid anyway. `previewedCommit` carries no `resolvedVersion`, so `deriveInstallVersion` takes its third tier and records what an unpinned install of the same commit records.
- **Path sources.** These never produce a `previewedCommit`. `preflightInstallResolve` sets `resolvedSha` only from `resolveGitPluginRoot`, or from `resolvePathPluginRoot` when a pin already exists.
- **Clone keys.** The pinned arm (`materializePluginClone`) and the unpinned arm (`materializePluginCommitCopy`) both key on `pluginCloneKey(cloneUrl, sha)`. So the install finds the preview's copy and records the same `resolvedSource`.
- **Clone cleanup between preview and install.** Move steps use `leaveClonesToTheSweep`, so no cleanup removes the preview's copy before the install reads it.
- **`rootCommit`.** It is set only by `planInstallMoves`, and an update plan has no root.
- **Agent-target check (D-PL4-04).** The write-free check follows the agents commit's non-force rule: the plugin's own index rows whose files pass `isOwnedAgentFile` are replaced, and any other existing file at a new target is refused.
- **Swap split.** The swap keeps `assertNamesFree` (names only). Reinstall (`overwrite: true`) never reaches the move judge or WR-C, and the existing RINST-01 forced-overwrite tests in `reinstall-flow.test.ts` would fail if the swap ran the full check.
- **Redaction (D-PL4-07).** It is applied once, in `unmovable`, and it is idempotent.
- **Test strength.** The new install-flow tests discriminate: they count mirror resolves and pinned clones (`mirrors: 1`, `pins: [HOST_HEAD]`). The D-PL4-02 and D-PL4-03 plan tests pin the refusal and the walk/judge order.
- **Test run.** The targeted tests (`target-check`, `dependency-plan`, `update-swap`) pass.

No Critical issues. The findings are about consistency and maintainability:

- The new refusal is an untyped `Error`. Because of that, the new update scenario pins a misleading `unreadable manifest` reason.
- One failure (an occupied agent target) now renders three different ways across the new scenarios.
- The write-free check copies the commit rule instead of sharing it.
- The target-check unit tests use one generated name per case.

## Warnings

### WR-01: The occupied-agent-target refusal is an untyped `Error`, and the new update scenario pins a misleading `unreadable manifest` reason for it

**File:** `extensions/pi-claude-marketplace/bridges/agents/target-check.ts:46`, `features/plugin/update-dependencies.feature:61` (with `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:957`)

**Issue:** `assertAgentTargetsFree` throws a plain `Error`, copying the commit's plain `Error` in `bridges/agents/stage.ts:328`. CONVENTIONS.md requires one typed error class per failure mode, and callers narrow with `instanceof`. Because the error has no type:

- In WR-C, `narrowDirectFailReason` can only reach the generic fallback, `"unreadable manifest"`.
- The new cucumber scenario "Updating a plugin whose new version would overwrite a user's agent file..." now asserts `reasons: unreadable manifest` for a refusal that has nothing to do with a manifest. A behavioral test should not lock in a misleading reason.
- Every new test (`target-check.test.ts`, `install-outcome.test.ts`, `update-swap.test.ts`, the install-flow D-PL4-04 case) can only assert the message string. The unit-test rules say to assert errors by class and structured fields.

**Fix:** Add a typed error in `shared/errors-bridges.ts` and throw it from both `assertAgentCommitTargets` and `assertAgentTargetsFree`. Keep the message, as D-PL4-04 requires:

```ts
export class AgentTargetOccupiedError extends Error {
  readonly targetPath: string;
  constructor(targetPath: string) {
    super(`Cannot replace agent target with non-previous content at ${targetPath}`);
    this.name = "AgentTargetOccupiedError";
    this.targetPath = targetPath;
  }
}
```

Then map it in `typedDirectFailReason` to an accurate reason. The closed vocabulary has no fitting member, so adding one is a user-visible choice: ask the user. Update the tests to assert `instanceof AgentTargetOccupiedError` and `targetPath`.

### WR-02: The same occupied-target failure renders three different ways in the new scenarios

**File:** `features/plugin/install-dependencies.feature:938`, `features/plugin/install-dependencies.feature:970`, `features/plugin/update-dependencies.feature:61`; `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts:193`

**Issue:** D-PL4-07's stated reason is "the same failure should read the same wherever it is found". But redaction is applied only to the move-refusal subject (`unmovable`). The three new scenarios now pin three spellings of one failure:

- **A move refused by the judge** (line 938): `... at pi-claude-marketplace-zzz-helper.md` (basename).
- **A fresh dependency refused by `previewInstall`** (line 970): `... at {project dir}/.pi/agents/pi-claude-marketplace-kit-helper.md`. The `previewFresh` member subject carries the raw error.
- **The update root refused in WR-C** (`update-dependencies.feature:61`): the full path again.

The full-path forms also contradict T-55-02-02's basename policy for row causes. The phase added both of those surfaces as new early-refusal points.

**Fix:** Pick one rendering and apply it at the plan's other refusal point:

- In `previewFresh` (`dependency-plan.ts:461-469`), wrap the caught error with `redactCauseChain` (`shared/redact-absolute-paths.ts`), as `dependency-move.ts:307` does for a failed move.
- Make the WR-C rendering match.

If keeping the full path for non-move rows is deliberate, record that under D-PL4-07 so the scenarios do not read as an accident.

### WR-03: The write-free check duplicates the agents commit rule instead of sharing it, so the two can drift silently

**File:** `extensions/pi-claude-marketplace/bridges/agents/target-check.ts:27-49` vs `extensions/pi-claude-marketplace/bridges/agents/stage.ts:156-176,314-333`

**Issue:** D-PL4-04's guarantee is that the plan refuses exactly what the commit would refuse. `assertAgentTargetsFree` gets there by copying three things:

- the AG-5 partition loop from `prepareStagePluginAgents` (step 6),
- the occupied-target loop from `assertAgentCommitTargets`,
- the target-path derivation (`path.join(agentsDir, name + ".md")`) from step 7.

No test compares the two rules against each other. A later change to one side would let the plan admit a target that the commit then refuses after moves have landed (the b6 failure this phase closes), or refuse one the commit would accept. Examples: the forced-row containment check, a new marker, a different target spelling. Nothing would report the drift.

**Fix:** Extract the shared parts in the agents bridge and use them from both sides. For example:

- `agentTargetPath(locations, generatedName)`
- `findOccupiedAgentTarget(replacedTargets: ReadonlySet<string>, targets: readonly string[]): Promise<string | undefined>`

`assertAgentCommitTargets` would pass `previous.replaced` targets, and `assertAgentTargetsFree` would pass the targets of the rows that `isOwnedAgentFile` admits. As a minimum, add a table-driven test in `test/bridges/agents/` that runs the same fixtures through `prepareStagePluginAgents` + `assertAgentCommitTargets` and through `assertAgentTargetsFree`, and asserts the same verdict.

### WR-04: The target-check unit tests pass one generated name per case, so a check that inspects only the first name passes all of them

**File:** `test/bridges/agents/target-check.test.ts:63-128`

**Issue:** All five cases call `assertAgentTargetsFree(..., [GENERATED_NAME])`. Two plausible wrong implementations pass the whole suite:

- one that checks only `generatedNames[0]`;
- one that returns as soon as one name is free (for example `if (!(await pathExists(target))) return;`).

A plugin with several agents, where only the second agent's target is occupied, is exactly the RSV-04 shape. The unit-test rules make "a case a wrong implementation would pass" the top finding.

**Fix:** Add a case with two names where the first target is free (or owned and replaced) and the second holds a user file. Assert the refusal names the second target:

```ts
test("D-PL4-04: refuses an occupied target that follows a free one", async (t) => {
  // arrange
  const locations = await createScope(t);
  const second = path.join(locations.agentsDir, "pi-claude-marketplace-acme-second.md");
  await writeFile(second, USER_BYTES);

  // act & assert
  await assert.rejects(
    assertAgentTargetsFree(locations, { marketplace: "catalog", plugin: "acme" }, [
      GENERATED_NAME,
      "pi-claude-marketplace-acme-second",
    ]),
    assertOccupiedRefusal(second),
  );
});
```

## Info

### IN-01: `assertUpdateNamesFree` no longer describes what it checks, and `assertNamesFree`'s doc names the wrong caller

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1362-1368`, `:1391`

**Issue:** The exported `assertUpdateNamesFree` now also refuses occupied agent targets. Its name still says "names", so a reader at `dependency-move.ts:186` or `install-flow.ts:3712` cannot tell that it reads the agents index and the disk.

The doc on the now-private `assertNamesFree` still says "UPD-DEP-D1's plan runs it before any dependency moves". The plan now runs the wrapper, and the only direct caller left is the swap.

**Fix:** Rename the export, for example to `assertUpdateTargetsFree`. If touching `dependency-move.ts` is out of scope, defer the rename and reword the `assertNamesFree` doc so it names the swap as its direct caller.

### IN-02: The `rollbackPartials` doc on `InstallMissingDependencyOutcome` claims a consumer that does not exist

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2992-2996`

**Issue:** The doc says the field exists "so an orchestrated caller reports `{rollback partial}` as the standalone row does". The only orchestrated caller, `orchestrators/reconcile/apply.ts:670-730`, never reads it. D-PL4-06 defers that rendering (LCORCH-01). A reader would assume `apply` already renders it.

**Fix:** Describe the field without the consumer claim. For example: "REC-06: the undo steps the failed install's own ledger could not finish; omitted when every undo finished (NREG-01). `apply` does not render it yet (LCORCH-01)."

### IN-03: The write-free check does not cover prepare's AG-9 index-ownership refusal

**File:** `extensions/pi-claude-marketplace/bridges/agents/target-check.ts:32-33`

**Issue:** `prepareStagePluginAgents` throws `AgentOwnershipConflictError` when another `(marketplace, plugin)` owns a generated name in the agents index (`stage.ts:126-136`). The write-free check reads the same index but ignores the other-owner rows.

In the usual case the state-based PI-6 check catches this first. But when the index and `state.json` disagree (a hand-edited or partly rolled-back index) and the target file is absent, the plan admits the member. The ledger then refuses with AG-9 after earlier moves have landed. This is the failure order RSV-04 closes, in a narrow drift case.

**Fix:** Optionally run `findOwnershipConflicts(other, generatedNames)` in the same function and throw `AgentOwnershipConflictError`, as prepare does. Or record the limit next to D-PL4-04.

### IN-04: The new agents-directory `Given` creates a directory that no release removes

**File:** `features/step_definitions/plugin/installation.steps.ts:188`

**Issue:** `the agents directory of the {word} scope holds the file ...` runs `mkdir(directory, { recursive: true })`, but only the file gets an `onRelease`. The directory sits inside the scenario sandbox, so nothing leaks today.

There is also an asymmetry with the data-directory step. That step asserts the directory already exists ("so the install did not create it"). This step creates the shared `agents/` directory itself. So a scenario cannot tell whether an install would have created `agents/` without being asked.

**Fix:** If the sandbox removal does not already cover it, register a release for the created directory (only when the step created it). Optionally state in the step module's `@fileoverview` that this step creates `agents/`.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
