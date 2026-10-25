# Phase 4: Git-Source Plugins - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

Phase 4 gives git-source plugins (`github`, `url`, `git-subdir` sources served
by the loopback git host) cucumber coverage for install, a refused install,
update, and uninstall, with the git host request log showing when Pi reaches
the network and when it reuses a clone. Requirements: INS-05, INS-06, UPD-02,
UNI-03.

Files this phase owns: `features/plugin/git-source.feature`,
`features/plugin/git-source-update.feature`, and
`features/step_definitions/plugin/git-source.steps.ts` if a step is missing.
Phase 1 already seeded both feature files: the install Outline over the three
kinds, a pinned install that reuses a clone with no request, two uninstall
seeds (clone kept, clone removed), and an update on a cache miss. Phase 4
extends them and fixes the product bugs the new scenarios expose.

</domain>

<decisions>
## Implementation Decisions

### Coverage already seeded (kept, re-checked)
- **D-01:** INS-05 is covered by the Phase 1 Outline (one install per source
  kind, a new session offering the skill) and the pinned-reuse seed (a second
  install pinned to an already-cloned commit makes no request). Phase 4 keeps
  both and updates the Outline's request log to the fixed behavior (D-05).
- **D-02:** UNI-03 is covered by the two Phase 1 uninstall seeds (one clone
  shared by two pinned plugins is kept, the only installation's clone is
  removed). No new uninstall scenario.

### New scenarios
- **D-03:** INS-06 gets one Scenario Outline in `git-source.feature` over the
  three refusals of a github-source plugin repository: 404 (`source missing`),
  401 with no stored credential (`authentication required`, armed with the
  existing `requires the user ... with the password ...` step, because the
  plain `answers {int}` step refuses 401), and a dropped connection
  (`network unreachable`). Each row compares the whole result (kind, severity,
  needs reload, summary, and the plugin row with reasons and cause chain), the
  request log, and then asserts the project scope has no installed plugins,
  holds no git clones, and a new session offers no skills.
- **D-04:** UPD-02's "no request when the cache already holds the revision"
  gets a scenario in `git-source-update.feature`: two plugins pinned to one
  commit of `mono` are installed, `mono` gets a second revision and both are
  re-pinned to it, the first update fetches it (setup), and updating the
  second plugin reports `updated` from `{mono revision 1}` to
  `{mono revision 2}` with no request to the git host. Measured by a probe:
  it passes on the current product.

### Product bugs (bug policy: fix in this phase)
- **D-05:** A first install of an UNPINNED git plugin clones the mirror and
  then refreshes it at once, so the git host sees the upload-pack pair twice.
  Claude Code clones a plugin source once, and `marketplace add` (the parity
  D-79.1-02 names) makes the pair once. Fix: `materializeOrRefreshPluginMirror`
  in `orchestrators/plugin/clone-cache.ts` skips the refresh when this call
  just created the mirror (`promoteStagingToClone` returned `"renamed"`); a
  warm mirror and a `raced` promotion still refresh (D-79.1-02, D-79.1-03).
  The install Outline's request log drops to one pair.
- **D-06:** An install whose git clone the host answers with 404 or whose
  connection drops fails with an EMPTY reasons list, while `marketplace add`
  reports `source missing` and `network unreachable` for the same failures
  (ADD-09, `classifyGitSourceAccessFailure`) and `fetch` reports a reason for
  every git failure. Claude Code has no reason vocabulary, so the precedent of
  the other commands settles it. Fix: `composeInstallFailureMessage` in
  `orchestrators/plugin/install.messaging.ts` classifies a runtime throw with
  `classifyGitSourceAccessFailure`. `authentication required` keeps the bare
  row with no cause (D-79-03); every other reason keeps its cause chain, as
  fetch's failed row does. This supersedes the "install keeps only its auth
  classification" note of D-76-08 for the source-access reasons, and the
  milestone requirement INS-06 ("fails with the matching reason") is the
  authority for it.

### Steps
- **D-07:** Every step the new scenarios need already exists (Phase 1). No
  `git-source.steps.ts` is created unless the executor finds a gap.

### Claude's Discretion
- Scenario titles and Outline column names, within
  `.agents/skills/cucumber/rules/features.md`.
- Unit-test shape for the two fixes, within the `typescript-unit-tests` skill;
  each fix keeps 100% direct coverage of its source-test pair.
- A `CHANGELOG.md` line for the two user-visible fixes.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` -- "### Phase 4: Git-Source Plugins" (goal, success criteria, files)
- `.planning/REQUIREMENTS.md` -- INS-05, INS-06, UPD-02, UNI-03
- `.planning/phases/01-suite-foundation/01-08-SUMMARY.md`, `01-10-SUMMARY.md` -- the seeds and the two bug candidates
- `.agents/skills/cucumber/SKILL.md` and `rules/*.md` -- suite rules and parallel-work ownership
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` -- `materializeOrRefreshPluginMirror`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` -- `composeInstallFailureMessage`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` -- `classifyGitSourceAccessFailure`
- `.planning/milestones/fetch-plugin-phases/79.1-mutable-mirror-clones-for-unpinned-git-plugin-sources/79.1-CONTEXT.md` -- D-79.1-02, D-79.1-03

</canonical_refs>

<code_context>
## Existing Code Insights

- Measured (probe scenarios, reverted): install 404 -> `failed`, reasons empty,
  cause `HTTP Error: 404 Not Found[, fetched https://{git host}/acme/ghp.git]`;
  dropped connection -> reasons empty, cause `socket hang up, fetched ...`;
  401 with no credential -> `authentication required`, no cause. Every one
  reports kind `cascade`, severity `error`, needs reload `false`, summary
  `A plugin operation has failed.`
- `marketplace add` request log for a url clone: one upload-pack pair.
- Steps available: `the {word} scope has no installed plugins`,
  `the {word} scope holds no git clones`, `the session offers no skills`,
  `the git host answers {int} for the {git repository}` (404/500/502/503),
  `the git host drops the connection for the {git repository}`,
  `the git host requires the user {string} with the password {string} for the {git repository}`.

</code_context>

<deferred>
## Deferred Ideas

None.

</deferred>
