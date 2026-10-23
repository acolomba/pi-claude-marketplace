# Phase 15: State Lock and Marketplace Failure Cleanup - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the orchestrating session asked for an autonomous, non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 15 adds cucumber coverage for four failure-cleanup guarantees and fixes
the product where a scenario exposes a bug:

- FLR-01: every plugin command that changes a scope fails with the lock-held
  reason while another process holds that scope's state lock, and changes
  nothing.
- FLR-02: `marketplace add`, `remove`, and `update` do the same.
- FLR-03: a failed `marketplace add` (404, invalid manifest, dropped
  connection) leaves no clone and no record, and the same add succeeds once
  the cause is gone.
- FLR-04: `marketplace remove` deletes the `plugin-clones/` entries of the
  git-source plugins it uninstalls and keeps an entry that another
  installation of the scope still uses.

Owned files: `features/plugin/state-lock.feature`,
`features/marketplace/state-lock.feature` (new),
`features/marketplace/failed-add.feature`,
`features/marketplace/remove.feature`, and phase-local step modules under
`features/step_definitions/marketplace/` if needed. Product fixes go in
`extensions/pi-claude-marketplace/**` with their paired unit tests.

</domain>

<decisions>
## Implementation Decisions

### Upstream position
- **D-01:** No upstream analogue applies. The Claude Code 2.1.308 binary
  (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.308/claude`,
  `strings` + grep for `ELOCKED`, `lockfile`, `another process`,
  `already in progress`, `installed_plugins.json`) shows no cross-process
  lock on plugin state and no lock-held message; its `installed_plugins.json`
  strings concern rebuilding an unreadable file. The state lock is
  pi-claude-marketplace machinery (`transaction/with-state-guard.ts`,
  NFR-3), so the house precedent settles the result shape: the commands that
  already handle `StateLockHeldError` (uninstall, reinstall, prune,
  marketplace update, marketplace autoupdate/noautoupdate, reconcile) report
  the reason `lock held` with the `StateLockHeldError` cause chain. Every
  other command aligns to that.

### Measured lock-held results (2026-10-23, project scope, this worktree)
| Command | Result today | Verdict |
| --- | --- | --- |
| `install` | row failed, reasons empty, StateLockHeldError cause chain | bug: reasons must be `lock held` |
| `enable`, `disable` | row failed, reasons empty, cause chain | bug: reasons must be `lock held` |
| `update <p>` with an update due | row failed, reasons `unreadable manifest`, cause chain | bug: reasons must be `lock held` |
| `reinstall` | row failed, reasons `lock held`, no cause chain | aligned reason; cause chain missing (D-05) |
| `uninstall` | row failed, `lock held`, cause chain | reference shape |
| `prune` | `(prune)@(prune)` failed, `lock held`, cause names `(.state-lock)` | aligned reason (D-06) |
| `marketplace update`, `autoupdate` | marketplace row failed, `<mp>@<mp>` row `lock held`, cause chain | reference shape for marketplace commands |
| `marketplace add`, `marketplace remove` | `internal-error`, `Command failed unexpectedly.`, truncated cause | bug: must match marketplace update (D-04) |

### Product fixes (bug policy)
- **D-02:** A failed `install`, `enable`, or `disable` row whose cause is a
  `StateLockHeldError` carries the reasons `["lock held"]`. Its cause chain
  stays as it is (the StateLockHeldError message with the absolute lock path,
  then `Lock file is already being held`). Fix it where each orchestrator
  classifies a throw out of the state guard, with the `instanceof
  StateLockHeldError` check the other orchestrators use, never a message match.
- **D-03:** A failed `update` row whose cause is a `StateLockHeldError`
  carries `["lock held"]` instead of `["unreadable manifest"]`. A genuinely
  unreadable manifest keeps `unreadable manifest`.
- **D-04:** `marketplace add` and `marketplace remove` run under a held lock
  return the same cascade result `marketplace update` returns: kind
  `cascade`, severity `error`, the marketplace row with marketplace status
  `failed`, and one synthetic `<marketplace>@<marketplace>` plugin row with
  status `failed`, reasons `lock held`, and the StateLockHeldError cause
  chain. Never `internal-error`. Reuse the marketplace-failure row helper that
  update/autoupdate already use rather than a new renderer. For `add`, the
  row names the marketplace the add would have created.
- **D-04 (amended):** The lock-held `marketplace add` rows are named by the
  typed source, not by the marketplace the add would have created, because
  the add takes the lock before it reads a manifest (ATTR-07 A2). The child
  row is a marketplace subject, so its JSON id is the bare source (ADD-10),
  like every other failed-add child row, not `<source>@<source>`.
- **D-05:** `reinstall`'s lock-held row also carries the StateLockHeldError
  cause chain, like uninstall. If the planner finds this needs more than a
  local change in the reinstall failure projection, leave it as is and record
  it as deferred; the reason is already aligned.
- **D-06:** `prune`'s cause chain names only `(.state-lock)` while every other
  command prints the absolute lock path. This is a redaction inconsistency,
  not a reason mismatch; it stays as is and the scenario states the observed
  text. Recorded under Deferred.

### Scenarios
- **D-07:** `features/plugin/state-lock.feature` keeps the two seed
  scenarios (uninstall, project and user scope) and adds one scenario per
  command and scope for `install`, `enable`, `disable`, `update` (update
  due), `reinstall`, and `prune`. Each asserts the result fields, the full
  row (status, reasons `lock held`, cause chain with `{project dir}` or
  `{agent dir}`), and that the record, the `claude-plugins.json`
  declarations, and the staged skills are unchanged. Scenario Outlines over
  scope are allowed only where the cause chain can come from an Examples
  column; otherwise write each scope out.
- **D-08:** `features/marketplace/state-lock.feature` (new) covers
  `marketplace add`, `remove`, and `update` under a held lock in both scopes,
  and asserts the config declarations, the installation record, and the
  staged skills are unchanged (and for `add`, that the config does not exist
  and the scope holds no git clones).
- **D-09:** `features/marketplace/failed-add.feature` keeps its two retry
  scenarios and adds: a url-source add that fails with 404, with a dropped
  connection, and with a manifest that is not valid JSON, each asserting that
  the scope holds no marketplace checkout, no git clones, that
  `claude-plugins.json` does not exist, and that `marketplace list` lists no
  marketplaces (in a separate scenario or via a retry check), plus a retry
  that succeeds after a dropped connection. Measured today: each failure
  leaves only an empty `sources-staging/` directory and no `state.json`, so
  FLR-03 needs no product fix.
- **D-10:** A failed add can leave a partial checkout that has no `.git`
  directory, which `readGitClones` would not see. Add a phase-local `Then`
  that asserts the scope's `sources/` and `sources-staging/` directories hold
  no entries (a missing directory counts as empty), in a new phase-local
  module `features/step_definitions/marketplace/failed-add.steps.ts`. Its
  step text names the topic, for example
  `the {word} scope holds no marketplace checkout`.
- **D-11:** `features/marketplace/remove.feature` adds two FLR-04 scenarios
  with git-source plugins: removing a marketplace whose plugins are the only
  users of their clones leaves no `plugin-clones/` entry, and removing a
  marketplace keeps a pinned clone that a plugin of another marketplace in
  the same scope still uses (two marketplaces offering `git-subdir` plugins
  of one repository pinned to one commit). Measured today: both already
  behave, so FLR-04 needs no product fix.
- **D-12:** Use existing shared steps wherever they exist (lock holder,
  git-host arms, `which failed`, record/config/stage/git-clone
  observations). A step that is needed and missing goes into a phase-local
  module named for this phase's topic (`marketplace/remove.steps.ts`,
  `marketplace/failed-add.steps.ts`, `marketplace/state-lock.steps.ts`);
  Phase 1 files are never edited.

### Claude's Discretion
- How each orchestrator reaches the `lock held` reason, as long as it narrows
  with `instanceof StateLockHeldError`, keeps 100% direct coverage of every
  touched source-test pair, and leaves `npm run check` green.
- Scenario titles and order within each feature file, within the cucumber
  skill's rules.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/state-lock-holder.ts` and the step `another process holds the state
  lock of the {word} scope` hold a real `proper-lockfile` lock in a child
  process, released by the world.
- Git-host arms: `the git host answers {int} for the {git repository}`,
  `the git host drops the connection for the {git repository}`,
  `the git host serves the {git repository} again`.
- `the user has run {string}, which failed` runs a setup command that must
  fail.
- Observations: `the installation record of the {word} scope holds these
  plugins:`, `the {string} file of the {word} scope declares ...`,
  `the {word} scope stages these skills and prompts:`,
  `the {word} scope holds these git clones:` / `holds no git clones`.
- Product reason mappings to copy: `refreshFailureReasons`
  (`orchestrators/marketplace/update.ts`), `autoupdateFailedReason`
  (`orchestrators/marketplace/autoupdate.ts`), the uninstall and
  enable-disable `lock held` branches, `reinstall-record.ts`.

### Established Patterns
- `StateLockHeldError` is thrown by `withLockedStateTransaction` on ELOCKED
  (`transaction/with-state-guard.ts`). Callers narrow it with `instanceof`.
- Install routes a guard throw through `handleInstallThrow` /
  `classifyInstallFailure` (`orchestrators/plugin/install-flow.ts`);
  a generic error gets `reasons: []` today.
- `marketplace add` rethrows non-enumerated errors (`add.ts` ~:848), which
  the edge turns into `internal-error`.

### Integration Points
- `features/plugin/state-lock.feature` already exists (Phase 1 seed); this
  phase extends it.
- `npm run check` includes `test:cucumber` and `check:features`.

</code_context>

<specifics>
## Specific Ideas

- Lock paths in cause chains use `{project dir}/.pi/pi-claude-marketplace/.state-lock`
  and `{agent dir}/pi-claude-marketplace/.state-lock`.
- For the update scenario, publish `1.1.0` after installing `1.0.0` so an
  update is due before the lock is taken.

</specifics>

<deferred>
## Deferred Ideas

- `prune` redacts the lock path in its cause chain to the basename while other
  commands print the absolute path (D-06).
- `import` that cascades installs under a held lock is Phase 13's surface;
  the install fix (D-02) applies to its rows if it routes through the same
  classifier.

</deferred>
