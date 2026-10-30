---
phase: 09-plugin-package-dependencies
plan: "02"
subsystem: features
tags: [cucumber, npm, loopback-registry, hooks]

requires:
  - phase: 09-plugin-package-dependencies
    provides: "the packages ledger phase (09-01)"
provides:
  - "features/lib/npm-registry.ts: NpmRegistry (loopback, deterministic tarballs, request log, arm 404/500), readNpmPackages, npmConfigText, pluginPackageFiles, npmRequestTable"
  - "world.useNpmRegistry / requireNpmRegistry / npmRequestsOfLastCommand and the npm request window hook"
  - "writePublishedPluginFiles: several plugin files in one publication change"
  - "features/plugin/package-dependencies.feature with three scenarios (success, 404 failure, session start hook loads the package)"
affects: [09-03, 09-04, 09-05]

actuals:
  tokens: 7704
  tasks: 3
  commits: 2
plan_head_before: 8e46e3ab99e0582f95cb9ae2beb920eeeedaf107
plan_head_after: caf36f6b390603a06d97ae392d482ed9a43f47e6

tech-stack:
  added: []
  patterns:
    - "A scenario-owned stand-in started lazily by the world (useNpmRegistry), with its config file and close registered as releases"

key-files:
  created:
    - features/lib/npm-registry.ts
    - features/support/npm-registry.ts
    - features/step_definitions/npm-registry.steps.ts
    - features/step_definitions/plugin/packages.steps.ts
    - features/plugin/package-dependencies.feature
  modified:
    - features/lib/published-marketplace.ts
    - features/support/world.ts

key-decisions:
  - "D-PL9-17 settled by a real hook run: the spike was positive, so a session start hook scenario proves require resolution from the plugin root"
  - "The npm registry is started per scenario by the first serving step, which writes the sandbox .npmrc before any plugin ships package files"

requirements-completed: []

duration: 22min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 02: Plugin Package Dependencies Scenarios Summary

**A loopback npm registry stand-in with deterministic ustar/gzip tarballs drives the real Pi, extension, and npm 11 through three scenarios: a lockfile package lands in the plugin's `node_modules`, a 404 leaves the plugin installed with Claude Code's `Plugin dependency install failed (npm): no output` note, and a session start hook of the installed plugin loads the package.**

## Performance

- **Duration:** about 22 min (2026-10-26T23:44 to 2026-10-27T00:06 local)
- **Tasks:** 3 of 3
- **Files:** 5 created, 2 modified

## SPIKE

SPIKE: positive -- SPIKE RESULT: ran from /tmp/pi-cm-features-GHuwb5/project/.pi/pi-claude-marketplace/sources/tools/plugins/pkp -- SPIKE PAYLOADS: []

The spike run reported `1 scenario (1 passed)`. Both spike files were removed by the shell `trap`, and `git status --porcelain -- features` printed nothing. The line is also in `09-02-SPIKE.txt` (uncommitted). Task 3 took the positive branch.

## Accomplishments

- `features/lib/npm-registry.ts`: `NpmRegistry` listens on `127.0.0.1` port 0 (`once(server, "listening")`). It builds each tarball once (a ustar archive of `package/package.json` and `package/index.js`, gzipped), serves it at `/<name>/-/<name>-<version>.tgz`, answers 404 to every other path, logs `{ method, path, status }`, and can be armed to answer 404 or 500 for a served package. `close()` calls `closeAllConnections()` first. The module also has `readNpmPackages`, `npmConfigText` (the five lines), `pluginPackageFiles` (package.json and a lockfileVersion 3 package-lock.json with the loopback `resolved` and the sha512 `integrity`), and `npmRequestTable`.
- `world.ts`: the `npmRegistry` and `npmRequestWindow` fields, and `useNpmRegistry()`, which starts the registry once, writes `<sandbox home>/.npmrc` with flag `wx`, checks the read-back, and registers releases that close the registry and remove the file. It also has `requireNpmRegistry()` and `npmRequestsOfLastCommand()`.
- `support/npm-registry.ts`: a `BeforeStep` that opens the window at each Action step when the scenario has a registry.
- `published-marketplace.ts`: `writePublishedPluginFiles`, which writes or replaces several files in one `changePublication`, so a git publication gets one commit.
- The steps: `the npm registry serves these packages:`, `the npm registry answers {int} for the package {string}`, `the npm registry receives these requests:`, `the npm registry receives no request`, `the published plugin {string} of the marketplace {string} depends on these npm packages:`, `the published plugin ... has a session start hook that writes what the npm package {string} exports to the project file {string}`, `the project directory holds the file {string} with the text {string}`, `the plugin {string} installed in the {word} scope has these npm packages:`, and `... has no npm packages`.
- Scenarios: "Installing a plugin whose lockfile lists an npm package installs the package into the plugin", "A package install that fails leaves the plugin installed with a warning", and "A session start hook of an installed plugin loads the npm package its lockfile lists".

## Task Commits

1. **Task 1: D-PL9-17 spike.** No commit (by design).
2. **Task 2: stand-in, steps, success and failure scenarios.** `9eee85ff` test(features): prove plugin package installs end to end
3. **Task 3: hook-proof scenario (positive branch).** `caf36f6b` test(features): prove a plugin hook loads its npm package

The pre-commit hook passed on both commits (`npm run check:commit` Passed, gitlint Passed).

## RED runs

- **Task 2:** with `packagesPhase,` removed from the ledger array in `install-outcome.ts`, `npx cucumber-js features/plugin/package-dependencies.feature` reported `2 scenarios (2 failed)` and `26 steps (19 passed, 5 skipped, 2 failed)`. The success scenario failed at `the npm registry receives these requests:` because no request was made. The failure scenario failed at `the command reports these results:` because there was one result instead of two. I restored the file from a scratch copy, and `git diff --quiet` on it exited 0.
- **Task 3:** with the same edit, the run reported `3 scenarios (3 failed)` and `38 steps (29 passed, 6 skipped, 3 failed)`. The hook scenario failed at `the project directory holds the file "pkd-proof.txt" with the text "pkd-dep 1.0.0"` with ENOENT, because the hook's `require("pkd-dep")` threw before it wrote the file. I restored the file, and `git diff --quiet` exited 0.

No part of either RED edit was committed.

## Verification

| Check | Exit |
| --- | --- |
| T1 verify (no spike file, clean `features/`, SPIKE line present) | 0 |
| T2 verify 1: feature run, `2 scenarios (2 passed)` | 0 |
| T2 verify 2: `check:features`, ESLint over the six TypeScript files, typecheck | 0 |
| T2 verify 3: `npm run --silent fallow` | 0 (first run 1, see Deviations) |
| T2 verify 4: HEAD holds the seven files, with the exact subject | 0 (`{"missing":[],"extra":[]}`) |
| T3 verify 1: feature run, `3 scenarios (3 passed)` | 0 |
| T3 verify 2: `check:features` and ESLint over packages.steps.ts (and npm-registry.steps.ts) | 0 |
| T3 extra: `npx fallow dupes`, typecheck | 0, 0 |

I did not run the full `npm run check`. Plan 09-05 owns the phase gate.

## Deviations from Plan

**1. [Rule 3 - Blocking] `the npm registry receives no request` moved from Task 2 to Task 3**
- **Found during:** Task 2 verify 2
- **Issue:** `npm run check:features` failed with `unused step definition "the npm registry receives no request"`. In Task 2 no scenario uses the step. Only Task 3's hook scenario does.
- **Fix:** I left the step out of the Task 2 commit and added it in the Task 3 commit. So the Task 3 commit holds `features/step_definitions/npm-registry.steps.ts` as well as the two files the plan names for it.
- **Commit:** caf36f6b

**2. [Rule 1 - Clone] request-log projection moved into the library**
- **Found during:** Task 2 verify 3 (`npm run fallow`: 1 clone group, 7 lines, `git-host.steps.ts:137-143` and `npm-registry.steps.ts:37-43`)
- **Fix:** I added the exported `npmRequestTable(requests)` to `features/lib/npm-registry.ts`. The step now compares `npmRequestTable(this.npmRequestsOfLastCommand())` with `table.raw()`. No suppression marker. After this change, fallow exited 0.
- **Commit:** 9eee85ff

**3. Small shape choices beyond the plan text**
- `world.ts` imports `NpmRegistry` and `npmConfigText` as values. The plan said "import type", but `useNpmRegistry()` calls `NpmRegistry.start()` and `npmConfigText`. Only `NpmRegistryRequest` is a type import.
- `pluginPackageFiles` returns `Readonly<Record<string, string>>` (by file name), not a named interface, so it passes straight to `writePublishedPluginFiles`. An exported interface used by nothing else would be a fallow unused-type risk.
- `arm(name, status)` also fails when the registry serves no package `name`. This way an arm step with a typo fails in the `Given`.
- The two plugin-file Givens share a module-private `writePluginFiles` helper in packages.steps.ts that writes and checks the read-back.
- The record lookup in packages.steps.ts was written in its own shape. Fallow did not pair it with `git-source.steps.ts`, so `features/lib/installation-record.ts` was not created and `git-source.steps.ts` was not touched.

## Files outside files_modified

None. `features/step_definitions/npm-registry.steps.ts` is in files_modified. It is only in a different task's commit than the plan says (Deviation 1).

## Uncertain choices

- `requirements-completed` is empty, and I did not tick PKD-01 or PKD-02 in REQUIREMENTS.md. This follows 09-01's reasoning: PKD-01's update half and the update-side PKD-02 path belong to plan 09-03.
- In the failure scenario, the diagnostic's `needs reload` cell is `false`. It is stated as the payload carries it, as the plan allows.
- The hook scenario needs no `the session reports these results:` step. The session reported no payload, as the spike also showed (`SPIKE PAYLOADS: []`), and the world's uncompared-session check passed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-09-12 is mitigated. The only step that writes plugin package files calls `requireNpmRegistry()`. That registry was started by `useNpmRegistry()`, which wrote the sandbox `.npmrc` (registry pinned to `http://127.0.0.1:<port>/`, `fetch-retries=0`, `update-notifier=false`, `logs-max=0`, `loglevel=silent`) before any plugin package file existed. The lockfile `resolved` URLs point at loopback, and each scenario's request-log step states every request. T-09-13 is mitigated: the registry listens on 127.0.0.1 port 0 only, and the world releases remove the `.npmrc` and close all connections and the server. T-09-14 is mitigated by the spike `trap` and the Task 1 verify.

## Next Phase Readiness

- Plan 09-03 can add update scenarios to `features/plugin/package-dependencies.feature` with the same steps. For a later revision, `writePublishedPluginFiles` replaces existing files.
- `the npm registry receives no request` is available for NFR-5 offline claims.

## Self-Check: PASSED

- FOUND: features/lib/npm-registry.ts
- FOUND: features/support/npm-registry.ts
- FOUND: features/step_definitions/npm-registry.steps.ts
- FOUND: features/step_definitions/plugin/packages.steps.ts
- FOUND: features/plugin/package-dependencies.feature
- FOUND: 9eee85ff (ancestor of HEAD)
- FOUND: caf36f6b (ancestor of HEAD)
