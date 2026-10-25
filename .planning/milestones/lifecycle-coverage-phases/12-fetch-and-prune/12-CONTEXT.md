# Phase 12: Fetch and Prune - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the orchestrating session asked for an autonomous, non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 12 adds cucumber coverage for two `/claude:plugin` verbs:

- `fetch` warms the cached clone of git-source plugins without installing a
  new version (FET-01..FET-03).
- `prune` uninstalls the auto-installed dependencies that no installed plugin
  needs any more, together with their clones, and `--dry-run` previews that
  (PRN-01..PRN-03).

The phase owns `features/plugin/fetch.feature` and `features/plugin/prune.feature`
(both already hold one Phase 1 seed scenario that stays), and may add
`features/step_definitions/plugin/fetch.steps.ts` / `prune.steps.ts`. It edits
no Phase 1 file and no other phase's file.
</domain>

<decisions>
## Implementation Decisions

### Upstream parity (claude-code-compat-research)

Evidence: `strings` over the Claude Code 2.1.308 binary
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.308/claude`),
grepped 2026-10-23.

- `claude plugin prune` exists upstream: `.command("prune")` with
  `-s, --scope <scope>` (default `user`), `--dry-run` ("List what would be
  removed without removing") and `-y, --yes`. It removes only auto-installed
  plugins that are "no longer needed", deletes their data directory
  (`deleteDataDir:!0`), and reports `Nothing to prune (...)` when nothing is
  orphaned. Confidence: high (binary strings).
- Claude Code has no `fetch` verb (no `.command("fetch")` and no `plugin fetch`
  string in the binary). `fetch` is a Pi-only surface under the recorded
  project decisions FTCH-01 / D-81-01 / D-81-02. Confidence: high.

- **D-01:** `prune` scenarios follow Claude Code: only auto-installed
  dependencies are removed, a plugin the user installed by name stays even when
  nothing depends on it, and `--dry-run` removes nothing. The product already
  matches (prototype run, below); no divergence.
- **D-02:** A successful `fetch` reports the row status `available` (Phase 1
  summary 01-10 asked Phase 12 to judge this). Keep it: there is no upstream
  `fetch` to match, and D-81-02 defines the fetch row as the DERIVED
  installability of the freshly fetched source (`available` /
  `partially-available` / `unavailable`, `skipped {up-to-date}` for a no-op),
  not the install state. The scenarios state `available` and are not a bug fix.
- **D-03:** A path-source plugin, and a pinned git-source plugin whose clone is
  already present, report `skipped` with the reason `up-to-date` and make no
  request (FTCH-03). This is the "reports nothing to fetch" of FET-03.

### Scenario design

- **D-04:** FET-01's "installs no new version" is proven by a separate scenario
  that runs `list` after a fetch of a newer revision and shows the plugin still
  `installed` at `{ghp revision 1}`. The shared step
  `the installation record of the <scope> scope holds these plugins:` does not
  project revision tokens (it prints the raw `sha-...` version), and it is a
  Phase 1 file, so the phase does not use it for git-source versions.
- **D-05:** The fetch row checks (FET-01) and the "list still shows the
  installed version" check are two scenarios, each with one `When`, as the
  cucumber skill's one-behavior rule asks.
- **D-06:** FET-02 has two scenarios: `fetch @gits` over a marketplace that
  offers a path plugin, an unpinned github plugin the host refuses (404), and a
  pinned url plugin; and a bare `fetch --scope project` over two marketplaces
  that each offer one git-source plugin. Both state every row, the tally
  fields, and the full request log.
- **D-07:** PRN-01 has two scenarios: a path-source orphan (`lib`, left by
  `uninstall app` without `--prune`) is uninstalled with the reason
  `dependency pruned` and the scope has no installed plugins afterwards; and a
  git-source orphan (`ghp`) is uninstalled and its clone is removed
  (`the project scope holds no git clones`).
- **D-08:** PRN-02 states the dry-run rows (`will uninstall {dependency pruned}`,
  needs reload `false`) and then that the installation record still holds the
  orphan (path source, plain version `1.2.0`, so the record step works).
- **D-09:** PRN-03 keeps the Phase 1 seed (empty scope) and adds two more
  `prune-empty` scenarios: a dependency an installed plugin still needs, and a
  plugin the user installed by name (D-01 parity).
- **D-10:** No new step is needed: every step the scenarios use already exists
  in the Phase 1 shared modules. So the phase adds no `fetch.steps.ts` or
  `prune.steps.ts`. If the executor finds a missing step, it goes in the verb
  module with text that names the verb (D-08 of the milestone).
- **D-11:** No product code changes are planned; the prototype run found no
  product bug. A bug found during execution is fixed in this phase with Claude
  Code as the reference (milestone bug policy).

### Decisions after verification (autonomous run, 2026-10-23)

- **D-12:** PRN-01's "unused clones" is read as the clones that pruning
  leaves unused, the clones of the dependencies it removes. Prune does not
  sweep clones that no installed plugin uses when it removes nothing, and it
  reports no row for a clone. Claude Code's `claude plugin prune` removes only
  auto-installed plugins that are no longer needed, so a general cache sweep
  would be a divergence with no license. Recorded as a verification override;
  the user may narrow the PRN-01 wording or ask for a product change.

### Claude's Discretion

Scenario titles, feature descriptions, and the order of scenarios in each file.
</decisions>

<code_context>
## Existing Code Insights

### Product surface

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`: the fetch
  set is manifest-driven (every entry of every marketplace in scope, not just
  installed plugins). Non-git source -> `skipped {up-to-date}`; pinned and
  present -> `skipped {up-to-date}` with no request; otherwise materialize, then
  the fresh row. A per-plugin failure is a `failed` row with `severity: error`
  and the sweep continues. Single form (`<plugin>@<mp>`) has no tally; the
  `@<mp>` and bare forms carry the `Plugin fetch` tally.
- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`: the default
  scope is `user` (upstream parity); `--dry-run` emits `will uninstall` rows or
  `prune-empty`; a real prune emits `uninstalled {dependency pruned}` rows with
  needs reload `true`, then removes the pruned members' clones
  (`finalizePrunedMembers`).

### Shared steps used (all Phase 1)

`the git repository {string} holds these plugins:`, `the marketplace {string}
offers these plugins:`, `... offers these plugins with dependencies:`,
`... offers these plugins from git repositories:`, `the marketplace {string} is
published as a dir source`, `... is added to the project scope`, `the user has
run {string}`, `the git host answers {int} for the {git repository}`, `the user
runs {string}`, `the result has these fields:`, `the result lists these
plugins:`, `the git host receives these requests:`, `the git host receives no
request`, `the project scope holds no git clones`, `the project scope has no
installed plugins`, `the installation record of the project scope holds these
plugins:`.

### Observed output (prototype run, 2026-10-23, scratch feature outside the repo)

- `fetch ghp@gits` after `ghp` gained revision 2: fields `cascade / info /
  false`; one row `gits | project | ghp@gits | ghp | available | (no reasons)`;
  requests `GET /acme/ghp.git/info/refs?service=git-upload-pack 200`,
  `POST /acme/ghp.git/git-upload-pack 200`.
- `list --scope project` after that fetch: tally `Plugin list` 0/0/1; row
  `gits | project | ghp@gits | ghp | installed | | project | {ghp revision 1}`.
- `fetch @gits` (demo path, ghp unpinned github armed 404, urlp pinned url):
  fields `cascade / error / false / A plugin operation has failed.`, tally
  `Plugin fetch` failures 1, warnings 0, success 2. Rows (columns `marketplace
  name | marketplace scope | id | name | status | reasons | scope | version |
  cause chain | cause truncated | leaks | rollback partial`):
  `demo@gits skipped up-to-date project 1.0.0`;
  `ghp@gits failed source missing project`, cause chain
  `HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git`, cause
  truncated `false`; `urlp@gits available`. Requests: ghp `GET 404`, urlp
  `GET 200`, `POST 200`.
- bare `fetch --scope project` (gits: ghp github unpinned; more: urlp url
  unpinned): tally `Plugin fetch` 0/0/2; rows `ghp@gits available`,
  `urlp@more available`.
- `fetch demo@fixtures` (path): `cascade / info / false`; row
  `fixtures | project | demo@fixtures | demo | skipped | up-to-date | project | 1.0.0`.
- `fetch subp@gits` (pinned git-subdir, installed): `cascade / info / false`;
  row `gits | project | subp@gits | subp | skipped | up-to-date | project`;
  no request.
- `prune --scope project` after `install app` + `uninstall app` (app -> lib):
  `cascade / info / true`; row `tools | project | lib@tools | lib | uninstalled
  | dependency pruned | project | 1.2.0`.
- `prune --scope project --dry-run` in the same state: `cascade / info / false`;
  row `tools | project | lib@tools | lib | will uninstall | dependency pruned |
  project` (no version column).
- git-source orphan `ghp` pruned: row `gits | project | ghp@gits | ghp |
  uninstalled | dependency pruned | project | {ghp revision 1}`; afterwards the
  project scope holds no git clones.
- `prune` with `app` still installed, and with `lib` installed by name and
  `app` uninstalled: `prune-empty / info / false / scope project`.
</code_context>

<specifics>
## Specific Ideas

- Keep the Phase 1 seeds as they are (the 404-retry fetch and the empty prune).
- Request logs appear only in `fetch.feature` (git-source scenarios) and in the
  git-source prune scenario if it states requests; the cucumber skill allows
  log steps in features whose scenarios use git sources.
</specifics>

<deferred>
## Deferred Ideas

- The installation-record step does not project `{<repo> revision N}` tokens.
  A Phase 1 follow-up could add the projection; this phase works around it
  (D-04).
</deferred>
