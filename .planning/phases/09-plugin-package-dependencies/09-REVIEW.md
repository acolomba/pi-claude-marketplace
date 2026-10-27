---
phase: 09-plugin-package-dependencies
reviewed: 2026-10-27T05:26:57Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/step_definitions/npm-registry.steps.ts
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/npm-registry.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/no-shell-out.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/platform/package-manager.test.ts
findings:
  critical: 2
  warning: 5
  info: 8
  total: 15
status: issues_found
fixed_at: 2026-10-27
fix_status: partial
fixed: 6
skipped: 9
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-27T05:26:57Z
**Depth:** standard (scoped to `git diff d98660a7..HEAD`; callers of the two new hooks traced)
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The new process module and the package step are mostly careful. The spawn has no shell, the work dir is isolated and contained, the install ledger's `do` cannot throw, and the undo removes only what `do` created. The unit tests cover the lockfile table, the refusals, the failure notes, the move, and the restore well.

The defects are at the seams where the step joins the existing update runner:

1. Reinstall uses `policy.skipSameRevision` to decide whether to force the install. Reinstall can move to a new revision (REI-04), so it keeps the old version's `node_modules`. No command repairs this afterwards.
2. The update hook reports a failure only through the `updated` outcome's `notes`. The `apply` catalog move (and autoapply at load) and the dependency moves drop `notes`, so on those paths a failed package install produces no warning at all, which breaks PKD-02.

Smaller issues:

- The 60-second limit depends on the child's `close` event.
- Path redaction removes the folder that the D-PL9-03 note exists to name.
- Uninstall leaves `node_modules` behind, so a later install skips the package step and keeps stale modules.
- Raw multi-line package-manager output goes straight into a diagnostic line.
- The package ops are hard-wired at both production call sites, so no test reaches the contained path through the ledger or the runner. A test there would have caught CR-01.

I checked the upstream 2.1.310 binary for parity. Its install path also returns the yarn/pnpm and `bun.lockb` refusals before any listing check, and it also drops the parked `previous-node_modules` when a restore fails. So neither of those is reported as a divergence.

## Critical Issues

### CR-01: Reinstall that moves to a new version keeps the old version's node_modules

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:488-507` (with `materialize-latest.ts:103-115`, `reinstall-flow.ts:207-211,400`)

**Issue:** `installUpdatedPackages` passes `target.policy.skipSameRevision` as `force`. The doc comment assumes that a policy with `skipSameRevision: false` "re-materializes the recorded revision". That is wrong for reinstall. Reinstall runs the same `materializeLatestVersion` runner, and that runner installs the version the marketplace offers now (reinstall-flow header: "a reinstall installs the version the marketplace offers now and records it (REI-04, D-18-08)").

Some plugin roots are shared across revisions: a path-in-clone plugin of a git marketplace (`sources/<mp>/plugins/x`), or an unpinned git mirror (`plugin-clones/<urlhash12>`). For those, take this sequence:

1. `marketplace update` brings in a new lockfile.
2. `reinstall` returns `partition: "updated"` for the new version.
3. `detectInstall(..., force=false)` sees the existing `node_modules` and returns `SKIP`.

The plugin's hooks and MCP servers now run the new code against the packages of the old lockfile. Nothing repairs it:

- `update` reports the plugin up to date (PKGDEP-02 retry is deferred).
- A second `reinstall` skips again.
- See WR-03 for uninstall plus install.

This contradicts D-PL9-06, which allows the skip only for "an unchanged clone".

**Fix:** Decide `force` from the move itself, not from the policy:
```ts
// materialize-latest.ts (both call sites)
const swapped = await swapPluginUpdate(args, preflight, policy);
const move = preflightMove(preflight);
const revisionChanged =
  move.toCommit !== move.fromCommit || move.toVersion !== move.fromVersion;
return installUpdatedPackages(DEFAULT_PACKAGE_INSTALL_OPS, swapped, {
  locations: args.locations,
  pluginRoot: preflight.installable.pluginRoot,
  force: revisionChanged,
});
```
Then drop `policy` from `UpdatedPackagesTarget`. Add a cucumber scenario: "Reinstalling a plugin after its marketplace moved it to a new lockfile installs the new packages". It must fail on the current code.

**Resolution:** fixed in `05c6c9c3` (fix(plugin): install the new packages when a reinstall moves a plugin). `materializeLatestVersion` now passes `force: revisionMoved(move)` (commit or version changed) and `UpdatedPackagesTarget` lost `policy` (now `PackageStepTarget`). Unit cases drive every policy through the runner with a contained plugin; the new scenario "Reinstalling a plugin after its marketplace moved it to a new lockfile installs the new packages" failed before the fix (no request for `pkd-dep-2.0.0.tgz`).

### CR-02: A package-install failure during `apply`'s catalog move or a dependency move produces no warning

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:101-115`; dropped at `orchestrators/reconcile/notify.ts:423-445` (`convergedMoveOutcomes`), `orchestrators/reconcile/apply.ts:1745-1764` (`grownMoveOutcomes`), `orchestrators/plugin/dependency-move.ts:216-228` (`moveRow`)

**Issue:** D-PL9-14 sends the update hook's note only into `outcome.notes`. Only two consumers render `notes` on an `updated` outcome:

- `update-flow.ts::surfaceUpdateDiscoveryWarnings`, for a direct `update`
- `reinstall-flow.ts:426`

Every other caller of `materializeLatestVersion` turns the outcome into rows and never reads `notes`:

- `apply`'s converge path through `convergePluginWith` → `convergedMoveOutcomes` / `grownMoveOutcomes`. This also covers autoapply at load (AAP-D1).
- Dependency moves during `update` and `install` cascades, through `runDependencyMove` → `moveRow`.

On those paths npm runs (D-PL9-10 names `apply` explicitly), and a failure leaves the plugin moved without its packages. The user sees nothing. PKD-02 requires "installs with a warning", and D-PL9-09 says the row "is the one place the user learns it". No test or scenario covers `apply` or a dependency move with a lockfile.

**Fix:** Carry the package note on these paths. Either:

- add the note to the converged/backfilled outcome and to `UpdateDependencyRow`, and render it the way `surfaceDiscoveryWarnings` does; or
- return it in a dedicated field (for example `packageNote`) that the apply and cascade composers must handle.

Add a cucumber scenario: "`/claude:plugin apply` that moves a plugin whose package install fails reports the warning".

**Resolution:** fixed in `adb28310` (fix(plugin): report package notes from apply and dependency moves). The updated outcome also carries the note as `packageNote`; `convergedMoveOutcomes` and `grownMoveOutcomes` lift it to `postCommitWarnings`, which `surfacePostCommitWarnings` now prints for converged and backfilled outcomes too; `moveRow` puts it on the moved dependency row's cause line (after any range disclosure) at warning severity. No reason token; `notify-reasons.ts` and `notification-types.ts` untouched. New scenario "Apply that moves a plugin whose package install fails reports the warning" failed before the fix (no diagnostic result). Residue: `marketplace update` with autoupdate renders update rows through `orchestrators/marketplace/update.messaging.ts` and still drops `notes`/`packageNote`.

## Warnings

### WR-01: The 60-second limit holds only if the child's stdio closes

**File:** `extensions/pi-claude-marketplace/platform/package-manager.ts:99-116,134-149`

**Issue:** The run settles only on `error` or `close`. `close` fires only after the child's stdio pipes close. The ladder ends with one `SIGKILL` to the direct child, and nothing settles the run after that. Two cases break the limit:

- A launcher shim that spawns the real npm as a child with inherited stdio (Volta-style shims) dies on the signal, while the grandchild keeps both pipes open.
- With the sanitizer deferred (D-PL9-08), git dependencies are allowed, so npm can have `git` children still running.

In either case the install, and the state lock it holds, waits for the grandchild, not for 65 seconds. Also, Node emits `error` for a `kill()` that fails while the process is still running. That settles the run early, and `finally` then deletes the work dir under a live npm.

**Fix:**
- Spawn with `detached: true` and signal the process group (`process.kill(-child.pid, sig)`).
- Also settle on `exit`, or on a hard deadline after the SIGKILL grace, whichever comes first.
- Settle on `error` only when no `pid` was assigned (a spawn failure), not when a kill fails.

**Resolution:** fixed in `fb837d45` (fix(plugin): bound a package install even when its process never closes). The run settles one kill grace after SIGKILL whether or not `close` arrives, and `error` settles it only when the process has no `pid` (never started). The caller's work-dir removal stays best effort and a timed-out run moves nothing. Process-group signalling (`detached: true`) was not added.

### WR-02: Path redaction removes the folder that the D-PL9-03 note exists to name

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:263-268`; rendered through `orchestrators/plugin/shared.ts:1822`

**Issue:** The outside-root note says "its folder `<abs path>` is outside … run "npm ci …" in that folder". Every surface (`surfaceDiscoveryWarnings`) passes notes through `redactAbsolutePaths`, which reduces the path to its basename. The user actually sees "its folder pkp is outside …" (`package-dependencies.feature:97` pins exactly this). The note cannot tell the user where to run the command, which is its only purpose under D-PL9-03.

**Fix:** Name the folder in a form that survives redaction and is still usable, such as `~`-relative or `<marketplace>/<relative plugin path>`. Or route this note through a channel that is not redacted (the folder is the user's own, not an internal path). Update the scenario to assert the usable form.

**Resolution:** fixed in `869eff2a` (fix(plugin): name the marketplace in the local-folder package note). The note now reads "its folder in the marketplace \"<name>\" is outside ..." and contains no absolute path; the scenario asserts the new text.

### WR-03: Uninstall leaves node_modules, so a later install skips the step and keeps stale modules

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:281-284`

**Issue:** Uninstall never removes the `node_modules` that the package step wrote into a shared clone root (only `package-install.ts` names `node_modules`). Take this sequence:

1. Install v1.
2. Uninstall.
3. `marketplace update` brings in a v2 lockfile.
4. Install again. `hasNodeModules && !force` returns `SKIP`.

The plugin now runs v2 code against v1 packages. Uncertain choice 5 in 09-CONTEXT says such a stale `node_modules` "is only refreshed by the plugin's update", but `update` reports the plugin up to date. CR-01 shows reinstall also skips. So no command ever refreshes it.

**Fix:** Do one of the following:
- Record the lockfile digest that the installed `node_modules` came from, for example a `.pi-claude-marketplace-lock` marker inside `node_modules`, and force when it differs.
- Remove the step-created `node_modules` on uninstall when the root is inside the extension root.

At minimum, correct the recorded mitigation.

**Resolution:** skipped: out of this fix pass's scope (recorded follow-up).

### WR-04: Raw multi-line package-manager output goes straight into a diagnostic line

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:334-341`

**Issue:** `failureDetail` uses `run.stderr.trim()` as the note body. That text can be up to 500 characters of npm output: several lines, often beginning with `npm warn …` lines before the actual error. Any control characters npm prints, or relays from a registry error body, pass through too. The lockfile's `resolved` hosts are not restricted, because the sanitizer is deferred. The text becomes one `lines` entry of a warning diagnostic, so embedded newlines break the row grammar in the TUI. The only scenario uses `loglevel=silent` (`features/lib/npm-registry.ts:267`), so it sees "no output" and never exercises this path.

**Fix:** Normalise the detail before building the note:
1. Strip ANSI and C0 control characters.
2. Drop leading `npm warn` lines.
3. Remove the `npm error`/`npm ERR!` prefixes. The upstream `npm pack` path does this with `/^npm (ERR!|error) ?/`.
4. Join the remaining lines with `"; "`.

Add a unit case with multi-line stderr.

**Resolution:** fixed in `eba851ee` (fix(plugin): compact package manager output in the failure note). Escape sequences and control characters are stripped, `npm warn` lines are dropped when anything else was printed, `npm error`/`npm ERR!` prefixes are removed, and lines are joined with "; " before the 500-character cut.

### WR-05: Package ops are hard-wired at both production call sites, so the contained path is never tested through the ledger or the runner

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:1527`, `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:104,112`

**Issue:** Both call sites bind `DEFAULT_PACKAGE_INSTALL_OPS` directly, and neither `runInstallLedger` nor `materializeLatestVersion` takes the ops as a parameter. This is against the CONVENTIONS rule on dependency injection over hard-wired dependencies. As a result:

- The new ledger and runner tests (`install-outcome.test.ts`, `materialize-latest.test.ts`) can only use outside-root plugins. A contained plugin would spawn the real `npm`.
- No test proves that the packages phase's undo runs when `statePhase` fails inside the real ledger.
- No test proves which `force` value each policy produces at the runner. That test would have caught CR-01.

**Fix:** Add an optional `packageInstallOps` to the ledger's existing injection seam (next to `transaction`) and to `ThreePhaseArgs`, defaulting to `DEFAULT_PACKAGE_INSTALL_OPS`. Then add contained-root tests:
- ledger state-phase failure removes the created `node_modules`;
- `update`, `converge`, `reinstall`, and `rematerialize` each pass the expected force.

**Resolution:** fixed in `a5ec61b8` (refactor(plugin): inject the package step's ports into ledger and runner). `InstallLedgerTransaction.packageInstallOps` and an optional third parameter of `materializeLatestVersion` default to `DEFAULT_PACKAGE_INSTALL_OPS`. New cases: a state-phase failure removes the node_modules a contained plugin's packages phase created; the runner's force per policy (extended in `05c6c9c3`).

## Info

### IN-01: A failed restore deletes the parked node_modules

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:371-375,419`

**Issue:** The restore failure is ignored, and then `finally` runs `rm(workDir)`, which deletes `previous-node_modules` with it. The plugin is left with no modules at all. The comment says "running update again repeats the install", but update of an up-to-date plugin does not. This matches upstream (`vSs` + `rl(s)` in 2.1.310), so it is recorded here, not counted as a defect.

**Fix:** If the restore fails, leave the work dir in place (skip the `rm`) and name it in the note.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-02: A plugin root that cannot be listed produces a dependency warning for a plugin with no package.json

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:231-241,435-436`

**Issue:** Any `readdir` error other than ENOENT becomes "Skipped installing this plugin's dependencies: EACCES …", even when the plugin ships no `package.json`. The changed assertion in `update-flow.test.ts:8345-8348` accepts that extra warning. Upstream only logs this case at debug level.

**Fix:** Treat an unreadable root as a quiet skip, or report it only when the bridge phases have not already failed on the same root.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-03: The BLOCK C zone exempts by basename, not by the seam path

**File:** `eslint.config.js:521`

**Issue:** `**/!(package-install).ts` exempts every file named `package-install.ts` in any folder. `PACKAGE_INSTALL_SEAM` appears only in the message.

**Fix:** Express the exemption with the exact path, for example with `except`, or narrow the target glob.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-04: Captured output can garble multi-byte characters

**File:** `extensions/pi-claude-marketplace/platform/package-manager.ts:92-94`; `package-install.ts:183,327`

**Issue:** Each chunk is decoded separately, so a UTF-8 sequence split across two chunks becomes U+FFFD. Separately, `.slice(0, 500)` can cut a surrogate pair in half.

**Fix:** Use `setEncoding("utf8")` (a StringDecoder) on the streams. Truncate by code point.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-05: The diagnostic header calls the package note a "declared component"

**File:** `features/plugin/package-dependencies.feature:51,97,115` (header from `orchestrators/plugin/shared.ts:1823-1826`)

**Issue:** The header reads "Plugin "pkp" installed; 1 declared component has a note." A package-install failure is not a declared component. The wording carries over from the reused channel (D-PL9-14), and PKGDEP-04 is filed for the row reason.

**Fix:** Address it together with PKGDEP-04.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-06: A rolled-back install cascade leaves the node_modules its members created

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:454-473`

**Issue:** The phase's undo runs only inside the inner ledger. When a later member of the outer cascade fails, `cascadeUnstagePlugin` undoes the members that completed but does not remove their `node_modules`. The modules stay in the clone, and the next install skips the step because of them.

**Fix:** Expose the created path on the ledger summary so the cascade undo can remove it.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-07: The timeout note uses the constant, not the runner's timeout

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:335-337`

**Issue:** The note reads "timed out after 60 seconds" from `PACKAGE_INSTALL_TIMEOUT_MS`. An injected runner with a different timeout would report the wrong number.

**Fix:** Carry `timeoutMs` on `PackageManagerRun`, or on the ops.

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

### IN-08: An update that drops its dependencies keeps the old node_modules

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:276-303`

**Issue:** A forced run whose new version has no `package.json`, no listed packages, or no lockfile returns `SKIP`. The previous version's `node_modules` stays in a shared root.

**Fix:** When `force` is set and the detection is `skip` but `node_modules` exists, remove a `node_modules` that the step created (see the marker in WR-03).

**Resolution:** skipped: Info finding, out of this fix pass's scope (recorded follow-up).

---

_Reviewed: 2026-10-27T05:26:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
