---
phase: 12-fetch-and-prune
review: 12-REVIEW.md
fixed: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-10]
deferred: [WR-07, WR-08, WR-09, IN-02]
accepted: [IN-01]
status: all_blockers_fixed
---

# Phase 12: Code Review Fix Report

All fixes landed in one commit, `test(features): check what fetch and prune leave behind`.
`npx cucumber-js features/plugin/fetch.feature features/plugin/prune.feature` passes
13 scenarios and 154 steps, and `npm run check:features` exits 0.

## Fixed

- **CR-01:** A new phase-local step, `the fetched copy of the plugin {string} in the {word} scope holds revision {int} of its repository`, is in `features/step_definitions/plugin/fetch.steps.ts`. It finds the one plugin clone whose `origin` is the plugin's repository and compares its `HEAD` with that revision. The fetch scenario now expects revision 2. Negative check: expecting revision 1 fails the scenario.
- **CR-02:** The dry-run scenario now also states that the project scope still stages `skill | lib-skill`.
- **WR-01:** The `list`-after-fetch scenario and the git-source prune scenario now state `the git host receives no request`.
- **WR-02:** The git-source prune scenario now states `the project scope has no installed plugins`. No step can show the clone before the `When`. The Phase 1 uninstall seed proves that an install leaves the clone.
- **WR-03:** Both `prune-empty` "keeps" scenarios now state the installation record they leave.
- **WR-04:** The bare-fetch scenario adds a user-scope marketplace, `others`, that offers `subp` from `mono`. With `--scope project`, that marketplace shows no row and no request.
- **WR-05:** A Gherkin comment above the bare-fetch request log explains why it shows two rounds per repository. A new mirror is cloned and then refreshed at once, which is recorded decision D-79.1-02.
- **WR-06:** The scenario where the host refuses one plugin now states the clones it leaves: only `urlp`, pinned at `{urlp revision 1}`.
- **WR-10:** Both feature descriptions are updated. Fetch covers every git-source plugin a marketplace offers, installed or not. Prune mentions the git host.

## Deferred (product questions for the user; see 12-VERIFICATION.md "For the orchestrator")

- **WR-07:** PRN-01 says prune removes "unused clones". The product removes only the clones of the plugins it prunes. This matches Claude Code: `claude plugin prune` removes auto-installed plugins only. A clone that `fetch` warmed for a plugin nobody installed stays. The requirement wording needs narrowing, or prune needs a cache sweep. Phases may not edit REQUIREMENTS.md.
- **WR-08:** The dry-run `will uninstall` row has no version. Claude Code's prune preview prints `name (version)`. Adding it changes the shared `PluginWillUninstallMessage` type and the published payload schema, which reconcile and pending also use. So it is deferred to avoid a conflict with phases running in parallel.
- **WR-09:** An unpinned git-source plugin's installed root is the shared mirror. `fetch` (and install or update of another plugin from the same source) refreshes that mirror in place, so the installed plugin's files move to the new revision while its record and `list` still show the old one. This predates the phase and needs a design decision.
- **IN-02:** Clone cleanup after uninstall, update, or prune deletes every clone that no installed plugin references. That includes caches that `fetch` warmed for plugins that are not installed.

## Accepted

- **IN-01:** The bare form shares the per-plugin failure loop with `@<marketplace>`, so the one failure scenario covers both.
