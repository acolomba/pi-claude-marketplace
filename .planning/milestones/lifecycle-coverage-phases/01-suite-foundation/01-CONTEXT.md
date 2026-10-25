# Phase 1: Suite Foundation - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the user asked for an autonomous, non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 1 builds every shared piece of the cucumber suite that the plugin
lifecycle phases (2-15) need: drivers, fixtures, stand-ins, shared steps, and
result-row support. After Phase 1, each later phase adds only its own feature
files and phase-local step modules and never edits a Phase 1 file, so phases
2-15 can run in parallel. Each capability is proven by one seed scenario that
lives in the feature file of the later phase that needs it.

The **Provides** list and the four research questions in the ROADMAP Phase 1
section are the scope. Test plugins carry skills only.

</domain>

<decisions>
## Implementation Decisions

### Step module layout and file ownership
- Move `features/step_definitions/plugin.steps.ts` into
  `features/step_definitions/plugin/` as topic modules, in a commit of its own
  (layout rule D-08). Topic modules never take a verb name. Reserved verb
  names, which later phases own: `install`, `uninstall`, `enable`, `disable`,
  `update`, `reinstall`, `list`, `info`, `pending`, `reconcile`, `fetch`,
  `prune`, `import`, `bootstrap`, `browse`, `help`, `git-source`, `rollback`,
  `state-lock`, and `marketplace/remove`.
- A step that names a plugin's installation (record, data directory, clones,
  staged skills) goes in a plugin topic module. A step about publishing a
  plugin stays with the existing publishing steps
  (`marketplace/publishing.steps.ts`) or moves to a plugin publishing topic
  module if the plugin steps outgrow it. Any such move is its own commit.
- The git-host steps serve plugin repositories as well as marketplaces. Arming
  (401, 404, connection drop, required credential) and the request log take a
  repository named as a marketplace or a plugin. Keep the existing marketplace
  step text working, and do not add a second module with the same text.
- The state-lock setup step belongs to the function of the thing it names, the
  scope's state, not to a verb. The planner chooses the module name under the
  layout rules (no `common`, `shared`, `utils`, `helpers`, `support`, or
  `misc`).
- Amend the cucumber skill (`.agents/skills/cucumber/rules/layout.md`, or a
  short milestone note that it links to) with this milestone's ownership rule:
  phases 2-15 add only their own feature files and step modules, and a step a
  second phase needs goes back to a Phase 1 topic module in a follow-up commit,
  not into another phase's file.

### Seed scenarios
- Each **Provides** capability has exactly one seed scenario. The seed is a
  real behavioral scenario that meets the cucumber rules (whole-result
  comparison, setup `Given`s that assert their effect), not a placeholder. It
  lives in the feature file of the later phase that needs it, and that phase
  extends the file.
- Seed feature files follow the layout rule
  `features/<function>/<capability>.feature`, with the names the ROADMAP file
  ownership table gives (for example `features/plugin/list.feature` and
  `features/plugin/git-source.feature`).
- A seed must fail under a plausible wrong implementation of the capability it
  proves. When one scenario can prove two capabilities without becoming
  unclear, it may cover both.

### Failure injection and helper processes
- **State lock:** a helper child process under `features/lib/` takes the
  scope's lock with `proper-lockfile`, the same library the product uses
  (`transaction/with-state-guard.ts`: lockfile `locations.stateLockFile`,
  `realpath: false`, `stale: 10_000`, `update: 2_000`). It prints a ready line,
  keeps the lock fresh until it is killed, and the world's release kills it
  and asserts that the lock is gone. The `Given` asserts that the lock is held
  before it returns. Do not fake the lock by creating the lock directory,
  because a stale mtime makes the lock look free after 10 s.
- **Unwritable install-phase target:** prefer an obstruction of the wrong file
  type (a regular file where the phase writes a directory, or a directory
  where it writes a file), because that also stops root. Use a mode-bit change
  only if the obstruction is reported as a collision before staging instead of
  as a phase failure. In that case, the `Given` must confirm that a write
  really fails, so a run as root fails loudly instead of passing. Choose the
  target that install rollback (INS-07) and update rollback (UPD-04) each need,
  and record the choice in the plan.
- **Git host arming per plugin repository:** reuse the existing arming in
  `features/lib/https-git-host/` (401, 404, 5xx, connection drop, credential),
  generalized from a marketplace name to a repository name, with a disarm
  ("can stop doing so") that the release also runs.
- Every armed failure, the held lock, and the unwritable target are freed by
  the world's release, which runs the most recent release first.

### Driver, payload kinds, and source kinds
- The result steps learn every payload kind a plugin lifecycle command or a
  new session emits, from `shared/notification-wire.ts` and the
  `*.messaging.ts` files: at least `cascade`, `plugin-info`,
  `plugin-info-cascade`, `reconcile-applied-cascade`,
  `reconcile-pending-empty`, `reconcile-aborted`, `prune-empty`,
  `prune-committed-warning`, `usage-error`, and `usage-info`. The planner's
  research confirms the full list. A scenario that leaves the rows of any
  emitted payload uncompared fails, the same as the existing DRV-01 driver
  contract.
- "Git, github, url" plugin sources map to the three git-clonable source kinds
  in `domain/source.ts`: `github` (served through
  `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`), `url` (an https git URL on the
  loopback host), and `git-subdir` (a url plus a path). Each fixture can
  publish a new revision.
- The official marketplace (`anthropics/claude-plugins-official`) is served
  by the git host through the GitHub base override, for `bootstrap` and
  `import`.
- A "new session in another project directory" and a new session's own
  payloads (its reconcile report) are read through the existing session and
  process harness (`features/lib/pi-process.ts`, `features/support/pi-process.ts`).
  If the long-lived Pi process cannot change its working directory, the
  planner chooses between a second Pi process for that scenario and a
  different seed. Starting a slow process per scenario is allowed only under
  the slow-process rule in `rules/world-and-stand-ins.md`.

### Decisions after research (orchestrator, autonomous run, 2026-10-22)
- `startSession()` reads a new session's payloads through the RPC
  `get_entries` request, so the reconcile report reaches the driver. The six
  existing scenarios that then get an uncompared reconcile report gain the
  missing comparison in Phase 1. That includes the two in
  `plugin/configuration.feature` and `marketplace/update.feature`, which the
  ROADMAP otherwise leaves untouched. Phase 1 finishes before phases 2-15
  start, so this edit does not break their file ownership.
- A session in another project directory uses a second `PiProcess` with the
  same HOME and agent directory and a fresh cwd, started only by the scenario
  that needs it and released by the world.
- The state-lock helper is one `features/lib/` module that the step imports
  and also runs as a child process (fallow flags a lib file that nothing
  imports). The child keeps its stdin open, holds the lock, and exits when
  stdin closes. The Phase 1 seed uses `uninstall`, which already reports
  `lock held`. Inconsistent lock-held reasons on other verbs belong to
  Phase 15 under the bug policy.
- The rollback obstruction is a directory in place of
  `<scopeRoot>/mcp-adapter.json` (EISDIR in the mcp phase after skills
  commit; it does not depend on file mode). One obstruction serves INS-07
  and UPD-04.
- Git versions (`sha-<hash>`) and clone keys (a URL hash that includes the
  random port) get run tokens. Clones are shown by origin URL. The git host
  serves owner `anthropics` as well as `acme`, for the official marketplace.
- `reconcile-aborted` and `prune-committed-warning` have no reliable trigger
  and no row arrays. The field steps already compare them, so they get no
  seed scenario.
- Product bugs that research found (lock-held reasons, EISDIR reported as
  `unreadable manifest`, no reason on a git 404 install, `installed` rows
  without a version, empty `list --remote`, `info --fetch` missing the new
  revision) belong to the phases that own those verbs. Phase 1 fixes only a
  bug that blocks one of its own seeds.

### Claude's Discretion
- Exact step text, module names (within the rules above), and how the fixture
  builders are split inside `features/lib/`.
- Which existing step a new step should generalize, rather than adding a
  near-duplicate.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/support/world.ts`: `ScenarioWorld` with `scopeRoot(scope)`,
  `onRelease()`, and `release()` (most recent first, `AggregateError` on
  failure).
- `features/lib/pi-commands.ts` and `features/support/pi-process.ts`: run
  `/claude:plugin` in a headless Pi in RPC mode, collect every payload, and
  validate each against the notification schema. `startSession()` returns the
  offered skills.
- `features/lib/https-git-host/{server,cgi}.ts`: the loopback HTTPS git host
  with arming and a request log. `features/lib/hermetic-git.ts` holds the
  hermetic git environment.
- `features/lib/published-marketplace.ts`, `path-marketplace.ts`,
  `git-marketplace.ts`: marketplace and plugin fixtures. The "offers these
  plugins with dependencies" step already exists in
  `marketplace/publishing.steps.ts`.
- `features/step_definitions/config.steps.ts`: hand-edited configs ("a config
  in scope {word} and layer {word}, with these plugins:" / "with this text:")
  and config assertions.
- `features/lib/run-tokens.ts`: run-specific tokens substituted in both
  directions.
- `test/e2e/install-soft-deps.test.ts` and `test/e2e/import-command.test.ts`:
  prior art for import and peers. Under the boundary rule, a driver may reuse
  a `test/` process harness, and nothing else under `features/` imports from
  `test/`.

### Established Patterns
- Cucumber rules: `.agents/skills/cucumber/SKILL.md` and `rules/*.md`.
  `npm run check:features` (inside `check:static`) gates layout, feature-file
  rules, and unused, undefined, or ambiguous steps.
- `cucumber.json` runs scenarios in random order with `parallel: 8`, so every
  stand-in, lock helper, and obstruction must be per-scenario and released.
- Results are compared whole: payload kind, status, reasons, severity,
  needs-reload, and no-op. Never compare a sample of the rows.

### Integration Points
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` (lock),
  `persistence/locations.ts` (`stateLockFile`, `pluginDataDir`, clone
  directories), `shared/notification-wire.ts` (payload schema),
  `domain/source.ts` (source kinds), `orchestrators/plugin/clone-cache.ts`
  (`plugin-clones/`).

</code_context>

<specifics>
## Specific Ideas

- **Bug policy (PROJECT.md, user decision 2026-10-22):** if a seed scenario
  exposes a product bug, fix it in this phase, with Claude Code's `/plugin`
  behavior as the reference (`claude-code-compat-research`). Stop for the user
  only on a plain contradiction with an established pi-claude-marketplace
  principle that the precedent of other commands does not settle.
- **Execution notes from earlier runs:**
  - Run executors in this worktree with worktree isolation off; an agent
    worktree has no `node_modules`.
  - Parallel executors share one git index. Commit with the pathspec form
    `git commit -F <plan-scoped-msgfile> -- <paths>`. A "files were modified
    by this hook" message during a sibling's write is spurious; run it again.
  - Every test that touches Pi state uses the sandbox or hermetic home, never
    the real `~/.pi/agent`.
  - Do not run `gsd-tools config-set`; it reformats `.planning/config.json` and
    breaks `format:check`.
- The gate is `npm run check` (which includes `test:cucumber` and
  `check:features`), run once on the combined tree at the phase gate.

</specifics>

<deferred>
## Deferred Ideas

- Component-kind scenarios (commands, agents with `--map-model`, MCP, hooks,
  workflows) and missing optional peers: the later component milestone.

</deferred>
