---
phase: 09-plugin-package-dependencies
verified: 2026-10-27T09:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/09-plugin-package-dependencies/09-01-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-01-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-02-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-02-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-03-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-03-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-04-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-04-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-05-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - features/plugin/package-dependencies.feature
  - rule-packs/architecture.json
  - test/architecture/no-shell-out.test.ts
covered_digest: "v4:sha256:c057e414a975011be1e8ed28103dc6e526101376ef1395be8d2b98d9aa75c9e9"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
deferred:
  - truth: "A package-install note reaches the user on a `marketplace update` / autoupdate cascade row"
    addressed_in: "Phase 1 (WRN-02)"
    evidence: "Phase 1 criterion 2: 'A marketplace update cascade, an autoupdate cascade, and an apply catalog move each render a moved plugin's warnings under one header that names the plugin and its scope (WRN-02)'. The install still runs and never blocks; only the cascade row drops the note today (update.messaging.ts reads no packageNote)."
advisory:
  - finding: "ROADMAP Phase 9 criterion 2 says 'lockfile-less'; the phase (D-PL9-02, as Claude Code does) keeps a missing lockfile silent and warns for refused lockfiles only"
    category: other
    reason: "Known handoff (uncertain choice 12): parent edits the criterion to 'refused' or overrules D-PL9-02"
    evidence_status: "none needed; deliberate"
  - finding: "PROJECT.md / AGENTS.md NFR-5 amendment, D-PL9-10/11 decision rows, CHANGELOG line and backlog entries (PKGDEP-02..05) are not yet applied"
    category: other
    reason: "Known handoff: forbidden to this phase; texts are in 09-05-SUMMARY (## CHANGELOG line, ## Decision rows, ## Backlog dispositions) and count as the recorded decisions for PKD-03"
    evidence_status: "none needed; deliberate"
  - finding: "WR-03 uninstall leaves node_modules in a kept clone, so a later install skips the package step (PKGDEP-05 proposed); a grandchild holding the pipes can outlive a timed-out run (no process-group kill)"
    category: other
    reason: "Recorded residue in 09-REVIEW-DISPOSITION.md and 09-05-SUMMARY; neither blocks a plugin or violates a PKD requirement"
    evidence_status: "none provided"
---

# Phase 9: Plugin Package Dependencies Verification Report

**Phase Goal:** A plugin that ships `package.json` with a supported lockfile gets a frozen, `--ignore-scripts`, 60 s-bounded `npm ci` or `bun install --frozen-lockfile` when it is installed, updated, or reinstalled, matching Claude Code 2.1.310. A package-install failure or refusal never blocks the plugin; it leaves a warning note. NFR-5 gets an amendment and the spawn rule a decision ID (D-PL9-10, D-PL9-11).
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Lockfile table and flags match Claude Code 2.1.310, first present wins (PKD-01, SC1) | VERIFIED | `package-install.ts` `LOCKFILE_TABLE`: `bun.lock` -> `bun install --frozen-lockfile --ignore-scripts`; `npm-shrinkwrap.json` then `package-lock.json` -> `npm ci --ignore-scripts --workspaces=false --no-audit --no-fund`; `bun.lockb` refused (verbatim text); yarn/pnpm-only note. Runs only when package.json lists `dependencies`/`optionalDependencies`/`peerDependencies`/`workspaces`. Order is data (`.find` over the table). Scenario Outline (3 refused-lockfile rows) and unit tests pass. |
| 2 | The runner is shell-free, 60 s-bounded, kills, and never rejects (PKD-01/02) | VERIFIED | `platform/package-manager.ts`: `shell: false`, `stdio ["ignore","pipe","pipe"]`, async `spawn`; `DEFAULT_PACKAGE_INSTALL_OPS` binds `timeoutMs 60_000`, `killGraceMs 5_000`; SIGTERM at timeout, SIGKILL after grace, settles one grace later even if `close` never fires; output capped at 64 KiB; spawn throw and `error` resolve, not reject. Targeted unit tests (timeout, SIGKILL, never-closes, no-pid error, real child) all pass (package-manager.test.ts). Behavior-dependent invariants have passing named tests, so they are not PRESENT_BEHAVIOR_UNVERIFIED. |
| 3 | The step runs on install (ledger), update, and reinstall, in the staged copy (PKD-01) | VERIFIED | `install-outcome.ts`: `packagesPhase` in the literal array `[..., workflowsPhase, packagesPhase, statePhase]`, injected via `transaction.packageInstallOps`; undo removes only a node_modules the phase created. `materialize-latest.ts` calls `installUpdatedPackages` on both swap paths with `force: revisionMoved(move)`; update-flow, reinstall-flow, and dependency-move all go through `materializeLatestVersion`. Work dir under `sourcesStagingDir`, only package.json + lockfile copied (no plugin `.npmrc`), node_modules renamed in, replaced one parked and restored on failure. Containment via `assertPathInside` on `extensionRoot`; local path-source folders are never written (D-PL9-03 note). Scenarios: install, update, reinstall (no request when installed; new lockfile after move) pass. |
| 4 | Plugin's hook finds its modules (SC1) | VERIFIED | Scenario "A session start hook of an installed plugin loads the npm package its lockfile lists" passes (real npm against loopback registry stand-in). |
| 5 | A failed, timed-out, or refused install never blocks and leaves a warning note (PKD-02, SC2) | VERIFIED | `installPluginPackages` catches every detect/run error into a note; `do` of the packages phase only pushes to `discoveryWarnings`; `installUpdatedPackages` adds `notes` + `packageNote` to the `updated` outcome and never converts it to a failure. Notes reach the user on: install (`discoveryWarnings` -> postCommitWarnings; scenario "A package install that fails leaves the plugin installed with a warning"), update and reinstall (`notes`; scenarios), apply catalog move (`carriedPackageNote` -> post-commit warning; scenario "Apply that moves a plugin whose package install fails reports the warning"), dependency move (`withPackageNote` on the moved row; `dependency-move.test.ts`), refused lockfiles (Outline) and local folder (scenario). Note text capped at 500, control chars/ANSI stripped, path-redacted. "Lockfile-less" read as "refused lockfile": deliberate handoff (advisory). |
| 6 | NFR-5 amendment and spawn rule carry IDs and are gated (PKD-03, SC3) | VERIFIED | D-PL9-10 (amendment text, also rewriting the path-source clause) and D-PL9-11 (spawn rule text) are recorded in 09-05-SUMMARY (accepted as the recorded decisions). Gates: `rule-packs/architecture.json` `child-process-chokepoint` (4 exclusions: git-credential, dispatch-exec, async-rewake/registry, package-manager); `rg -l child_process` shows the other hits (`exec-timer.ts`, `spawn-helpers.ts`, `ring-buffer.ts`) are comments only; `no-shell-out.test.ts` whitelist "exactly four files" + `SHELL_OUT_EXEMPT_TARGETS` updated; `eslint.config.js` `PACKAGE_INSTALL_SEAM` BLOCK C zone allows only `package-install.ts` to import `platform/package-manager.ts`. `package-install.ts` is the sole importer. |
| 7 | `npm run check` is green on the final code (SC3) | VERIFIED | Log `fix-check.log`: `CHECK_EXIT=0` at adb28310 (912 scenarios, direct coverage merged). `git diff adb28310 HEAD -- . ':(exclude).planning'` is empty. Not re-run, per instructions. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | Package-install note on `marketplace update` / autoupdate cascade rows | Phase 1 (WRN-02) | Phase 1 criterion 2 requires cascade rows to render a moved plugin's warnings. Today `orchestrators/marketplace/update.messaging.ts` reads no `packageNote`/`notes` for the updated arm, so the note is dropped there; the install itself runs and never blocks. Phase 1 is a parallel wave-1 phase, so the parent should confirm WRN-02 renders the updated arm's `notes`. |

### Advisory (carried handoffs, none blocking)

| # | Finding | Category | Why advisory |
| - | ------- | -------- | ------------ |
| 1 | ROADMAP SC2 "lockfile-less" vs D-PL9-02 silent skip | other | Known handoff (uncertain choice 12) |
| 2 | PROJECT.md/AGENTS.md NFR-5 text, decision rows, CHANGELOG, backlog PKGDEP-02..05 not applied | other | Known handoff; texts ready in 09-05-SUMMARY |
| 3 | Uninstall leaves node_modules in a kept clone (WR-03); no process-group kill | other | Recorded residue |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `orchestrators/plugin/package-install.ts` | table, detection, work dir, phase, update hook | VERIFIED | 534 lines, substantive, imported by `install-outcome.ts`, `materialize-latest.ts` |
| `platform/package-manager.ts` | shell-free bounded runner | VERIFIED | 205 lines, sole importer `package-install.ts` |
| `install-outcome.ts` packages phase | ledger slot | VERIFIED | literal 8-phase array |
| `materialize-latest.ts` update hook | package step after swap | VERIFIED | both swap branches |
| `rule-packs/architecture.json` | chokepoint rule | VERIFIED | `child-process-chokepoint` |
| `eslint.config.js` | seam zone | VERIFIED | `PACKAGE_INSTALL_SEAM` |
| `test/architecture/no-shell-out.test.ts`, `gate-targets.ts` | four-file whitelist | VERIFIED | |
| `features/plugin/package-dependencies.feature` | scenarios | VERIFIED | 11 scenarios (9 + 3-row outline) pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `install-outcome.ts` | `createPackagesPhase` | ledger array | WIRED |
| `materialize-latest.ts` | `installUpdatedPackages` | after `swapPluginUpdate` / `swapAfterSettle` | WIRED |
| `update-flow.ts`, `reinstall-flow.ts`, `dependency-move.ts` | `materializeLatestVersion` | call | WIRED |
| `package-install.ts` | `createPackageManagerRunner` | `DEFAULT_PACKAGE_INSTALL_OPS` | WIRED |
| updated outcome `packageNote` | apply post-commit warning / dependency row cause | `carriedPackageNote`, `withPackageNote` | WIRED |
| ledger `discoveryWarnings` | install notification | postCommitWarnings | WIRED (scenario) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| failure note | `run.stderr`/`stdout`/`error` | real child process output | yes | FLOWING |
| `node_modules` in plugin root | work-dir install result | real npm against loopback registry (scenarios) | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit + architecture tests for the phase's modules | `node --test` on package-install, package-manager, no-shell-out, materialize-latest, install-outcome, dependency-move, apply, notify, apply-outcomes tests | 506 pass, 0 fail | PASS |
| Package scenarios | `npx cucumber-js features/plugin/package-dependencies.feature` | 11 scenarios, 140 steps passed | PASS |

### Probe Execution

SKIPPED: the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PKD-01 | 09-01..04 | frozen, script-free, bounded install in the staged copy | SATISFIED | Truths 1-4 |
| PKD-02 | 09-01..04 | failure/timeout/skip degrades with a warning, never blocks | SATISFIED | Truth 5 (cascade-row gap deferred to WRN-02) |
| PKD-03 | 09-01, 09-05 | NFR-5 and spawn rules amended with IDs | SATISFIED | Truth 6 (text recorded in 09-05-SUMMARY; PROJECT.md edit is the parent's handoff) |

No orphaned requirements: REQUIREMENTS.md maps only PKD-01..03 to Phase 9.

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX markers in the phase's source files. Grep of `package-install.ts` and `package-manager.ts` shows no stubs; the `ignoreFailure` best-effort cleanups are deliberate and commented.

### Human Verification Required

None.

### Gaps Summary

No gaps. The goal is achieved: frozen, `--ignore-scripts`, 60 s-bounded npm/bun installs run on install, update, reinstall (and apply and dependency moves), a failure never blocks, and the spawn and seam gates exist and passed in the full `npm run check`. Open items are known handoffs for the parent (ROADMAP SC2 wording, PROJECT.md/AGENTS.md/CHANGELOG/BACKLOG edits) and one deferred surface (marketplace-update cascade rows, WRN-02).

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
