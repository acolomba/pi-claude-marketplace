---
phase: 18-update-and-reinstall-unification
fixed_at: 2026-10-23T23:12:32Z
review_path: .planning/phases/18-update-and-reinstall-unification/18-REVIEW.md
iteration: 1
findings_in_scope: 18
fixed: 15
skipped: 3
status: partial
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-10-23T23:12:32Z
**Source review:** .planning/phases/18-update-and-reinstall-unification/18-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 18 (all tiers; the operator named every finding)
- Fixed: 15
- Skipped: 3 (WR-06 by the operator's decision; IN-05 and IN-06 deferred to phases 25 and 26)

Each fix is its own commit. Each one has a test that fails without the fix, except the comment and doc fixes (IN-01, IN-07), which have no behavior to test. Every fix commit passed the `check:commit` hook.

**Verification:** `npm run check` ran in the main checkout of this worktree (`lc-p18-update-reinstall-742f3f`), not in an isolated review-fix worktree, on the final tree at `d8fb1eab`. It exited 0: static checks, unpaired tests, integration, 744/744 cucumber scenarios, and direct coverage for all pairs (279 records merged).

## Fixed Issues

### CR-01: `commitPreparedAgents({ force })` deletes unvalidated, unowned paths read from the agents index

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, `test/bridges/agents/stage.test.ts`
**Commit:** a00fac45
**Applied fix:** A forced commit now runs `assertPathInside(agentsDir, targetPath, "previous agent file")` on every row it removes, before any `rm`. A row that escapes refuses the commit with `PathContainmentError`, cleans up staging, and leaves every file and the index unchanged. New test: a forced commit over a row outside `agentsDir`. The reviewer also suggested keeping rows with a non-generated basename. That was not added: the deleted replace path checked containment only, and the operator asked for containment.

### CR-02: `refreshSource: false` installs the mirror's checked-out HEAD, not the ref the marketplace declares

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`
**Commit:** 26c5ed3f
**Status:** fixed: requires human verification
**Applied fix:** The fix lives in the clone-cache helper `materializeOrRefreshPluginMirror`, so phase 26's shared copy helper can absorb it. With `refresh: false`, a warm mirror now answers the commit its last fetch recorded for the entry's own ref: `refs/remotes/origin/HEAD` when no ref is declared, else `refs/remotes/origin/<ref>`. It does this through a new helper, `resolveFetchedRefOffline`. If the mirror holds no such ref (a tag, or a branch no fetch brought in), the code treats it as a cache miss and refreshes. Tests: a declared ref read while HEAD is another ref's commit, with no fetch; a never-fetched ref that refreshes; a non-NotFound read error that propagates; and a reinstall-level case recording the declared ref's commit. The D-14 scenario (no request after `fetch`) still passes against real isomorphic-git.

### WR-01: The phase-3 recovery hint tells a reinstall user to uninstall + install

**Files modified:** `extensions/pi-claude-marketplace/shared/markers.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/shared/markers.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `docs/prd/pi-claude-marketplace-prd.md`
**Commit:** c79a3a69
**Applied fix:** The drift-guarded PUP-6 marker is now `Run /claude:plugin reinstall`. The swap composes `Run /claude:plugin reinstall <plugin>@<marketplace> to repair it.`, and update and reinstall share this text, as the operator asked. The wording is "to repair it" rather than "again": the update user never ran reinstall. The PRD PUP-6 row, the marker drift guard, and every test that pinned the old hint changed with it.

### WR-02: Agents target collisions are found after the intent mark

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, `extensions/pi-claude-marketplace/bridges/agents/index.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/bridges/agents/stage.test.ts`, `test/bridges/agents/index.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`
**Commit:** fccea929
**Applied fix:** The commit's pre-removal refusals (the forced-row containment and the "file no index row names at a new target" check) are now exported as `assertAgentCommitTargets`. The swap runs it before `markUpdateInProgress`, so a refusal aborts the prepared handles and changes nothing. A retry then converges once the file is gone. The commit still runs it as the backstop. This applies to both verbs. Two update-flow tests used an occupied agent target to force a phase-3a agents failure. They now use a read-only agents directory instead, so they still exercise phase-3a aggregation.

### WR-03: A failed reinstall drops the MCP config notices

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`, `test/orchestrators/plugin/reinstall-record.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`
**Commit:** c2c03ea3
**Applied fix:** `ReinstallFailedOutcome.mcpConfigNotices` is new. `reinstallOutcomeFromRun` copies the run's notices on the failed arm. `runReinstall` returns them for failed runs, and the bulk path and the self-rendered path both show them after the failed row. The false JSDoc ("a failed reinstall restores the file's exact bytes") is corrected. A test where the finalize save is refused after the MCP commit pins the failed row followed by the notice. The test that refuses every save was retitled: it now says the reinstall is refused at its intent mark.

### WR-04: Same-plugin reinstalls in two processes are not serialized

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/orchestrators/plugin/update-swap.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`
**Commit:** 2875ef24
**Status:** fixed: requires human verification
**Applied fix:** The intent mark now restamps `updatedAt`, and the ST-9 check also requires the stamp the run read (`sRecord.updatedAt !== preflight.record.updatedAt`). The reviewer's note said the mark already restamped `updatedAt`. It did not, so the restamp was added. A run that read the record before another run's mark fails `concurrently updated` before it commits anything. A run that reads the marked record afterwards, such as a retry after a crash, proceeds. New test: two preflights, the first swap stops after its intent mark, the second rejects, and a fresh run converges. Residual risk: two marks inside the same millisecond would write the same stamp.

### WR-05: A range hold silently cancels a backfill promotion and the gate closes

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`, `test/orchestrators/reconcile/backfill.test.ts`
**Commit:** b148e140
**Status:** fixed: requires human verification
**Applied fix:** A reinstall skipped with `dependents constrain` now returns `true` from `maybeBackfillPlugin`, with no row, so the version gate stays open and a later load retries. Other skips stay benign. New test: a recorded `app` declares `hello@^1.0.0` while the marketplace offers hello 2.0.0. The backfill emits nothing and does not stamp the version. Each load retries the plugin silently until the dependents admit the offered version.

### WR-07: A reinstall row reads `(reinstalled)` / info while the swap dropped components or held the version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/orchestrators/plugin/reinstall.messaging.test.ts`, `test/orchestrators/plugin/reinstall-record.test.ts`, `docs/output-catalog.md`, `test/architecture/catalog-uat/fixtures/plugin-reinstall.ts`, catalog count pins
**Commit:** 2b979978
**Applied fix:** `ReinstallReinstalledOutcome` carries `partialDegrade` and `constraint` from the runner. Each is optional and omitted when absent (NREG-01). The row keeps `(reinstalled)` and mirrors update's row:

- `{dependency current copy}` comes first and moves no severity.
- Each left-out kind is named with the token the partially-installed rows use, placed after the `{malformed ...}` tokens.
- The row is raised to `warning` when the record left nothing out before (`newlyDegraded`).

Tests: unit cases on the row and the projection, an end-to-end `reinstall` row `● hello v1.0.0 (reinstalled) {lsp}` at warning, and the new catalog state `reinstall-partial-component`. Deferred part: the constraint disclosure as a cause line. `PluginReinstalledMessage` has no `cause` slot, and update's `(updated)` row does not render it either. It belongs with phase 25's row work.

### WR-08: The output catalog was not updated for reinstall's new rows

**Files modified:** `docs/output-catalog.md`, `test/architecture/catalog-uat/fixtures/plugin-reinstall.ts`, `test/architecture/catalog-uat/catalog-contract.test.ts`, `test/architecture/catalog-uat/catalog-parser.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts`
**Commit:** 286198fc
**Applied fix:** Four catalog states were added, each with a fixture that renders its exact bytes:

- `reinstall-held-by-dependents`
- `reinstall-runner-skips` (`{no longer installable}`, `{not in manifest}`)
- `reinstall-dependency-walk-unreadable`
- `reinstall-rollback-partial`

The workflow-command state now says "the names the shared swap staged". The catalog state count went from 295 to 300 across this commit and WR-07's.

### WR-09: `update` behavior changed outside D-11 and D-17

**Files modified:** `test/orchestrators/plugin/update-flow.test.ts`
**Commit:** cafb8fe1
**Applied fix:** `update --partial` keeps recording `installable: false`, which is the truthful record and matches install. New unit test: a direct `update --partial` of a clean record pins the whole compatibility block (`installable: false`, the left-out kinds). The test fails if the swap goes back to `true`.

User-visible change: after `update --partial` degrades a plugin, its record reads `installable: false`. Enable's partial gate, install's refusal, and backfill eligibility now treat it as a consented partial install, the same as after `install --partial`.

The phase-3 text change (`Plugin "x" failed during physical replace.` without "update") is kept and documented, not restored. Update and reinstall share this message, and the operator asked to keep both verbs on the same text (WR-01).

### IN-01: Stale comments that name the deleted locked ledger and replace path

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`, `extensions/pi-claude-marketplace/domain/plugin-resolver.ts`, `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`
**Commit:** 066a0fb5
**Applied fix:** Every cited comment now describes the shared runner and swap. One extra stale pointer was also corrected: update-swap's hooks slot named `reinstall.ts::commitHooks`. The agents header now states the `force` exception.

### IN-02: The policy is optional with a silent `update` default

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/orchestrators/plugin/update-swap.test.ts`, `test/orchestrators/plugin/update-preflight.test.ts`, `test/orchestrators/plugin/update-cascade.test.ts`, `test/orchestrators/marketplace/update.messaging.test.ts`
**Commit:** d4be53ab
**Applied fix:** `PreparePluginUpdateOptions.policy` and the `policy` parameter of `swapPluginUpdate` are now required. The swap reads `policy.overwrite` directly. Tests name an explicit `UPDATE_POLICY`. Two compile-time pins (`true satisfies undefined extends ... ? false : true`) fail if either becomes optional again. `MaterializationPolicy` was not moved into `materialize-latest.ts`, because a type-only import back into preflight and swap would close an import cycle that the fallow cycle gate may flag.

### IN-03: A reinstall that races a disable writes the disabled record's pin

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts`, `test/orchestrators/plugin/update-preflight.test.ts`
**Commit:** d8fb1eab
**Applied fix:** The disabled-record branch now goes through `finishDisabledPreflight`. Under a policy with `skipSameRevision: false` (reinstall's), it returns `skipped {already disabled}` without writing. This reuses the existing knob, as the reviewer offered, so the policy keeps exactly three knobs (D-04). New test: reinstall's policy on a disabled record returns the skip and leaves state.json bytes unchanged. The `unchanged` arm comment in `reinstallOutcomeFromRun` now says reinstall never reaches it.

### IN-04: The D-13 "equivalence" scenario does not run `reinstall`

**Files modified:** `features/plugin/reinstall.feature`
**Commit:** fc8a05b4
**Applied fix:** The scenario is renamed "Reinstalling and updating after the same marketplace update record the same version". It installs demo in both scopes and moves the marketplace to 1.1.0. Then it runs `reinstall` in the project scope and `update` in the user scope, checks each row, and checks that both records hold 1.1.0. `npm run check:features` passes.

### IN-07: The user guide cites a GSD decision ID

**Files modified:** `docs/mcp-compatibility.md`, `docs/output-catalog.md`
**Commit:** 384a9ab2
**Applied fix:** Removed "(D-18-04)" from the remedy cell. The new catalog heading's ambiguous "D-07" is now "D-18-07".

## Skipped Issues

### WR-06: D-17 lets one delisted plugin block every reinstall and update in its scope

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:458-466`
**Reason:** The operator's decision. The behavior is left as is, and it needs a user decision before anything changes.
**Original issue:** A record whose marketplace no longer declares it counts as "cannot read", so under D-17 every reinstall and update in that scope fails `{unreadable}`. A backfill candidate also emits a `(failed)` row on every load.

### IN-05: A cold-cache clone failure renders `{no longer installable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:957-972`
**Reason:** Deferred to phase 25 (`{source missing}`), as instructed. The shared preflight is the one site that fixes both verbs. The new `reinstall-runner-skips` catalog state documents the current behavior.
**Original issue:** A transport failure from the clone seam becomes `skipped {no longer installable}` for both verbs.

### IN-06: `RemovalOps.rename` is now an orphan member

**File:** `extensions/pi-claude-marketplace/shared/fs-utils.ts:60, 75`
**Reason:** Deferred to phase 26, as instructed. The port is reshaped with the shared copy helper there.
**Original issue:** The only production caller of `rename` was deleted in this phase.

## Needs the user's attention

- **WR-06:** decide whether a delisted record should keep blocking its scope.
- **Decisions to record:** add the WR-09 changes as decisions in `18-CONTEXT.md` or a later phase. They are update's `installable: false` after `--partial`, and the verb-neutral phase-3 text. Also record WR-02, which moves update's occupied-agent-target failure from `rollback partial` to a clean failure before the intent mark. This report does not edit planning decisions.
- **WR-05:** the backfill now retries a range-held promotion on every load with no row. A user whose dependents never admit the offered version gets no message. Confirm that silent retry is wanted, or ask for a warning row.
- **CR-02:** a declared tag ref (no `refs/remotes/origin/<tag>`) falls back to a refresh, so a tag-ref reinstall touches the network. The tag could be resolved offline instead, but that needs a peel helper that `GitOps` does not have.

______________________________________________________________________

_Fixed: 2026-10-23T23:12:32Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
