# Roadmap: pi-claude-marketplace

## Milestones

- **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — in progress, Phases 1-15, branch `claude/plugin-lifecycle-coverage-b1d431`, started 2026-10-22
- **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, not yet merged); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- **mcp-4 (MCP 4)** — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md). marketplace-features'
phase details are in [its roadmap archive](milestones/marketplace-features-ROADMAP.md),
and its phase and quick-task records are under
[marketplace-features-phases](milestones/marketplace-features-phases/) and
`milestones/marketplace-features-quick/`.

## Phases

### In progress lifecycle-coverage -- Plugin Lifecycle Behavioral Tests

**Milestone goal:** The cucumber suite covers every `/claude:plugin` lifecycle
command, so a regression in plugin install, enable, update, or any other
lifecycle behavior fails a scenario named after it, as marketplace-features did
for the marketplace commands.

#### Parallelism

Phase 1 is the only foundation phase. Phases 2-15 each depend on Phase 1 and on
nothing else, and they may run in parallel once Phase 1 lands. No two of them
edit the same feature file or the same step module.

```text
W0  Phase 1 (Suite Foundation)
W1  Phases 2 3 4 5 6 7 8 9 10 11 12 13 14 15   (each needs Phase 1 only)
```

#### File ownership

- **Phase 1 owns every shared file:** `features/support/**`, `features/lib/**`,
  `cucumber.json`, `scripts/check-features.mjs`, the cucumber skill
  (`.agents/skills/cucumber/**`), the shared step modules
  (`features/step_definitions/{command,config,session,mcp-configuration}.steps.ts`),
  `features/step_definitions/marketplace/publishing.steps.ts`, the git-host
  steps, and the plugin topic modules under `features/step_definitions/plugin/`
  that replace `plugin.steps.ts`. Support that lives in one of these files
  belongs to Phase 1 even when only one later phase uses it.
- **Seeds:** Phase 1 gives each new shared step its first use in a real seed
  scenario, in the feature file of the later phase that needs it (the
  marketplace-features D-06 rule). Once Phase 1 lands, that feature file belongs
  to that later phase alone.
- **Later phases:** a later phase edits only the files in the table below. A
  step it adds goes in its own module, and the step text names that phase's
  verb or topic, so two parallel phases cannot register the same text (D-08).
  A later phase that needs a shared step Phase 1 did not provide defines a
  phase-local step in its own module. It never edits a Phase 1 file.
- **Untouched:** `features/plugin/configuration.feature`,
  `features/plugin/cross-scope-install.feature`, and every
  `features/marketplace/*.feature` except `remove.feature` stay as they are
  after Phase 1. Phase 1 edits `features/plugin/configuration.feature` and
  `features/marketplace/update.feature` once, before phases 2-15 start, so
  that their scenarios compare the reconcile report of a new session.
- Phase 1's plugin topic modules take none of the module names reserved below.

| Phase | Feature files | Step modules (only if needed) |
| --- | --- | --- |
| 2 | `features/plugin/enable.feature`, `features/plugin/disable.feature` | `plugin/enable.steps.ts`, `plugin/disable.steps.ts` |
| 3 | `features/plugin/install.feature`, `features/plugin/install-dependencies.feature` (new), `features/plugin/partial-install.feature` (new) | `plugin/install.steps.ts` |
| 4 | `features/plugin/git-source.feature` (new), `features/plugin/git-source-update.feature` (new) | `plugin/git-source.steps.ts` |
| 5 | `features/plugin/install-rollback.feature` (new), `features/plugin/update-rollback.feature` (new) | `plugin/rollback.steps.ts` |
| 6 | `features/plugin/uninstall.feature` | `plugin/uninstall.steps.ts` |
| 7 | `features/plugin/update.feature` | `plugin/update.steps.ts` |
| 8 | `features/plugin/reinstall.feature` | `plugin/reinstall.steps.ts` |
| 9 | `features/plugin/list.feature` (new) | `plugin/list.steps.ts` |
| 10 | `features/plugin/info.feature` (new) | `plugin/info.steps.ts` |
| 11 | `features/plugin/pending.feature` (new), `features/plugin/reconcile.feature` (new) | `plugin/pending.steps.ts`, `plugin/reconcile.steps.ts` |
| 12 | `features/plugin/fetch.feature` (new), `features/plugin/prune.feature` (new) | `plugin/fetch.steps.ts`, `plugin/prune.steps.ts` |
| 13 | `features/plugin/import.feature` (new) | `plugin/import.steps.ts` |
| 14 | `features/plugin/bootstrap.feature` (new), `features/plugin/browse.feature` (new), `features/plugin/help.feature` (new), `features/plugin/usage-errors.feature` | `plugin/bootstrap.steps.ts`, `plugin/browse.steps.ts`, `plugin/help.steps.ts` |
| 15 | `features/plugin/state-lock.feature` (new), `features/marketplace/state-lock.feature` (new), `features/marketplace/failed-add.feature` (new), `features/marketplace/remove.feature` | `marketplace/remove.steps.ts` (new) |

Step module paths are relative to `features/step_definitions/`.

#### Milestone rules

- **Gates.** Each phase leaves `npm run check` green. `npm run test:cucumber`
  runs every scenario, and `npm run check:features` (part of `check:static`) is
  the usage gate: it fails on an unused, undefined, or ambiguous step (FND-02).
  A phase branch joins the milestone branch by a merge, never a rebase.
  Whichever phase merges later keeps the combined tree green, and the
  `npm run check` merge gate enforces this.
- **Scenarios.** Test plugins carry skills only. A scenario compares the whole
  command result (payload kind, status, reasons, severity, needs-reload) and,
  where the command changes what a session offers, what a new session offers.
  No scenario reaches the public network, a real account, Device Flow, or the
  developer's home directory or git config. `Then` steps read the command
  payloads, a follow-up `list` or `info`, a new session, the user-owned configs,
  and the git host request log. They read an installation record, a plugin data
  directory, or a clone directory only where a requirement names that leftover.
- **Bug policy (user decision 2026-10-22).** A scenario that exposes a product
  bug fixes the bug in the same phase, with Claude Code's `/plugin` behavior as
  the reference (research it with `claude-code-compat-research`). The run is
  autonomous and non-interactive. It stops for the user only when Claude Code
  plainly contradicts an established pi-claude-marketplace principle (a
  recorded divergence such as SC-1 or D-MF-04, or the layer model) and the
  precedent of other commands does not settle which one wins.
- **Overlapping fixes.** File ownership covers `features/` only. Two parallel
  phases can fix bugs in the same production module or add to `CHANGELOG.md`;
  the later merge resolves the overlap and runs `npm run check` again.

- [x] **Phase 1: Suite Foundation** — Every driver, fixture, stand-in, and shared step that more than one later phase needs, each with a seed scenario, so Phases 2-15 add only their own files (completed 2026-10-23)
- [x] **Phase 2: Plugin Enable and Disable** — Skills come and go across sessions while the plugin stays installed, no-ops skip, scopes stay separate, and dependencies follow Claude Code (completed 2026-10-23)
- [x] **Phase 3: Install Dependencies, Partial, and User Scope** — The dependency closure, an unresolvable closure, `--partial`, and the user scope (completed 2026-10-23)
- [x] **Phase 4: Git-Source Plugins** — Install, refusal, update, and uninstall of git-source plugins against the loopback git host, with the request log (completed 2026-10-23)
- [x] **Phase 5: Install and Update Rollback** — An install or update that fails partway leaves the scope as it was, and a retry succeeds (completed 2026-10-23)
- [x] **Phase 6: Uninstall Data and Prune Flags** — `uninstall` removes or keeps the plugin data directory and prunes unneeded dependencies (completed 2026-10-23)
- [x] **Phase 7: Plugin Update by Marketplace, Constraint, and Partial** — `update @<marketplace>`, a blocking version constraint, and `update --partial` (completed 2026-10-23)
- [x] **Phase 8: Plugin Reinstall** — Single-plugin reinstall, restoring deleted skill files, and the not-installed failure (completed 2026-10-23)
- [x] **Phase 9: Plugin List** — Every row status, the filters, marketplace and scope selection, and `--remote` (completed 2026-10-23)
- [x] **Phase 10: Plugin Info** — Installed, available, partial, and unavailable plugins, `--fetch`, and the not-in-manifest failure (completed 2026-10-23)
- [x] **Phase 11: Pending and Reconcile** — `pending` after hand-edited configs, and a new session converging on them (completed 2026-10-23)
- [x] **Phase 12: Fetch and Prune** — Refreshing git-source plugin caches, and removing orphaned dependencies and their clones (completed 2026-10-23)
- [x] **Phase 13: Plugin Import** — Importing enabled plugins and marketplaces from a Claude Code settings file (completed 2026-10-23)
- [x] **Phase 14: Bootstrap, Browse, Help, and Usage Errors** — `bootstrap`, the non-TUI `browse` refusal, plugin `help`, and every plugin usage rejection (completed 2026-10-23)
- [x] **Phase 15: State Lock and Marketplace Failure Cleanup** — A held state lock refuses plugin and marketplace commands, a failed `marketplace add` leaves nothing, and `marketplace remove` cleans plugin clones (completed 2026-10-23)
- [x] **Phase 16: Git Plugin Copies and Version Rule** — Unpinned git installs get their own per-commit copy, the mirror becomes a cache, and one version rule serves install, info, and list
- [x] **Phase 17: Reconcile Stale-Declarer Warning** — A plugin whose catalog dropped it or whose manifest broke is reported as a warning with its real reason and cause
- [x] **Phase 18: Update and Reinstall Unification** — `reinstall` takes the latest known version and reports it, through one code path shared with `update`
- [x] **Phase 19: Import on the Reconcile Path** — `import` uses reconcile's desired-state path, reports what it skipped, and refuses under a held state lock
- [x] **Phase 20: Path-Source Version and Missing Source** — Path-source rows follow the one version rule, and a missing path directory reads `{source missing}`
- [x] **Phase 21: Marketplace Add No-Op and Token Parity** — Re-adding a marketplace is a skipped no-op, and write-path manifest faults use list/info's tokens
- [x] **Phase 22: Install Failure Reasons** — Every install failure in a cascade, a leaked cleanup, or a missing pinned commit carries its reason
- [x] **Phase 23: Uninstall and Prune Parity** — `will uninstall` rows show versions, prune's lock cause matches other commands, and uninstall of a disabled-only dependency matches Claude Code
- [x] **Phase 24: Import Reasons** — `import` reports the same reasons and statuses as `install` and reconcile
- [x] **Phase 25: Update and Reinstall Rows** — Same-version updates show commits, and update and reinstall rows carry their versions and consistent reasons
- [x] **Phase 26: Git Mirror Access** — Mirror refreshes take the state lock, one copy helper serves all clones, and a cold `info --fetch` contacts the host once
- [x] **Phase 27: Install and Reconcile Reason Residue** — Dependency ranges read as upstream, pinned-commit failures read cleanly, reconcile and import narrow reasons like install, and marketplace remove ignores disabled holders
- [x] **Phase 28: Delisted Plugin Dependency Walk** — A plugin its marketplace no longer lists keeps its dependencies from its installed copy, so it no longer blocks the scope's dependency walk
- [ ] **Phase 29: Apply Command and Read-Only Reload** — A new `apply` makes every pending change and converges plugins on the catalog version; `/reload` only reloads resources and prints what is pending

## Phase Details

### Phase 1: Suite Foundation

**Goal:** Every later phase can write its scenarios by adding only its own feature files and phase-local steps: the drivers, fixtures, stand-ins, shared steps, and result-row support that the plugin lifecycle scenarios need all exist, and each is used by a seed scenario.
**Depends on:** Nothing (first phase)
**Requirements:** FND-01, FND-02
**Research flag:** yes. (1) How another process holds a scope's state lock: `transaction/with-state-guard.ts` takes it through `proper-lockfile` with `retries: 0`. Settle how a helper process takes the lock, keeps it fresh for as long as a command runs, and frees it on release. (2) How to make one install phase's target unwritable on every runner. A read-only mode bit does not stop root, so choose a method that works for root too, and choose the target that install rollback and update rollback each use. (3) List every payload kind that each plugin lifecycle command and a new session's reconcile emit (`shared/notification-wire.ts` and the `*.messaging.ts` files), so the row steps learn all of them in this phase. (4) Which plugin source kinds the requirement's "git, github, url" maps to (`github`, `url`, and `git-subdir` in `domain/source.ts`).
**Provides** (each used by a seed scenario):

- Plugin fixtures: plugins with dependencies that carry version constraints; a plugin whose skills sit beside an unsupported component (such as `outputStyles`), so it is partially available; and a way to publish a new version of a plugin.
- Git-source plugins: plugins with `github`, `url`, and `git-subdir` sources on the loopback git host, each able to publish a new revision. The git host can make a plugin repository answer 401 or 404 or drop the connection, and can stop doing so. Request-log steps state the requests of a plugin clone or fetch as well as a marketplace one.
- The official marketplace (`anthropics/claude-plugins-official`) served by the git host through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, for `bootstrap` and `import`.
- Setup steps: hand-edit a scope's base and local configs (plugins with their enabled state, and marketplaces); hold the scope's state lock from another process; plant a file in a plugin's data directory; delete an installed plugin's skill files; write a Claude Code settings file (`~/.claude/settings.json` or `<project>/.claude/settings.json`) in the sandbox; make one install phase's target unwritable, and writable again.
- Observation steps: the plugins a scope's installation record holds; the files in a plugin data directory; the `plugin-clones/` entries and marketplace clone directories of a scope; a new session started in another project directory; and a new session's own payloads, such as its reconcile report.

**Success Criteria** (what must be TRUE):

1. Every capability listed under **Provides** exists, each with a seed scenario that passes in `npm run test:cucumber`, in the feature file of the later phase that needs it. Every setup `Given` asserts that its setup took effect, and every armed failure, the held lock, and the unwritable target are freed by the world's release.
2. The result steps read the rows of every payload kind that a plugin lifecycle command or a new session emits (including `plugin-info-cascade`, `reconcile-applied-cascade`, `reconcile-pending-empty`, `reconcile-aborted`, `prune-empty`, `prune-committed-warning`, and `usage-info`), and a scenario that leaves the rows of any of them uncompared fails.
3. The plugin steps live under `features/step_definitions/plugin/` in topic modules that take no verb name and none of the reserved module names. The git-host steps serve plugin repositories as well as marketplaces. The cucumber skill documents this milestone's file ownership: a later phase adds only its own feature files and step modules, and never edits a Phase 1 file.
4. `npm run check:features` (the usage gate: no unused, undefined, or ambiguous step) and `npm run check` are green, and every existing scenario still passes.

**Plans:** 10/10 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Tracer: move the plugin steps into the topic module `plugin/installation.steps.ts` and the git host steps to the top level, each a move-only commit; the parallel-work ownership rule in the cucumber skill

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Tracer: a new session's payloads reach the steps through `get_entries`; the row steps read `reconcile-applied-cascade`; `the session reports these results:`; the six existing session reports compared; seed in `plugin/reconcile.feature`

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Tracer: a setup command that must fail, seeded in `marketplace/failed-add.feature`; `plugin-info-cascade` rows and `prune-empty`, seeded in `plugin/info.feature` and `plugin/prune.feature`
- [x] 01-04-PLAN.md — Tracer: the installation record table, seeded in `plugin/enable.feature`; plant and list plugin data files and delete installed skills, seeded in `plugin/uninstall.feature` and `plugin/reinstall.feature`
- [x] 01-05-PLAN.md — Tracer: a new session in another project (a second Pi), seeded in `plugin/install.feature`; a partially available plugin and a constrained dependency, seeded in `plugin/partial-install.feature` and `plugin/install-dependencies.feature`

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-06-PLAN.md — Tracer: the git host arms and disarms any owner's repositories through `{git repository}`, every arm released by the world, seeded by a retried add in `marketplace/failed-add.feature`; the official marketplace and multi-payload setup, seeded in `plugin/bootstrap.feature`
- [x] 01-07-PLAN.md — Tracer: `{project dir}` and `{agent dir}` tokens and another process holding a scope's state lock, seeded in `plugin/state-lock.feature`; a directory blocking `mcp-adapter.json`, seeded by a retried install in `plugin/install-rollback.feature`

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-08-PLAN.md — Tracer: plugin repositories on the git host offered as github, url, and git-subdir sources, pinned or not, with revision tokens, seeded in `plugin/git-source.feature`
- [x] 01-09-PLAN.md — Tracer: hand-edited config marketplaces, seeded in `plugin/pending.feature` with the empty pending result; a Claude Code settings file in the sandbox, seeded in `plugin/import.feature`

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-10-PLAN.md — Tracer: the git host arms plugin repositories, seeded by a retried fetch in `plugin/fetch.feature`; the git clones of a scope, seeded by two uninstalls in `plugin/git-source.feature` and an update in `plugin/git-source-update.feature`

### Phase 2: Plugin Enable and Disable

**Goal:** `enable` and `disable` have scenarios for every lifecycle behavior: skills come and go across sessions while the plugin stays installed, a no-op is skipped, each scope changes alone, dependencies behave as in Claude Code, and a plugin that is not installed fails.
**Depends on:** Phase 1
**Requirements:** ENA-01, ENA-02, ENA-03, ENA-04, ENA-05, ENA-06
**Research flag:** yes. ENA-05: before writing the scenario, read with `claude-code-compat-research` whether Claude Code refuses or cascades a disable of a plugin that an enabled plugin depends on.
**Files:** `features/plugin/enable.feature`, `features/plugin/disable.feature`; `plugin/enable.steps.ts` and `plugin/disable.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. After `disable`, a new session offers none of the plugin's skills and `list` shows the plugin installed and disabled. After `enable`, a new session offers its skills again and the scope still holds exactly one installation record for it (ENA-01, ENA-02).
2. Enabling an enabled plugin and disabling a disabled one each report a skipped row with the matching no-op reason. Enable and disable of a plugin that is not installed fail with the not-installed reason (ENA-03, ENA-06).
3. With `--scope user` and with `--scope project`, enable and disable change only the named scope: the other scope's `list` rows, configs, and offered skills stay the same (ENA-04).
4. Enabling a plugin whose dependencies are disabled enables them and reports each one; a dependency that is absent refuses the enable with `{dependency unsatisfied}`, as Claude Code does. Disabling a plugin that an enabled plugin depends on is refused or cascaded as Claude Code's `/plugin` does, and the scenario title says which (ENA-05).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 3: Install Dependencies, Partial, and User Scope

**Goal:** Install scenarios cover a plugin's dependency closure, a closure that cannot be resolved, a partially available plugin with and without `--partial`, and installs into the user scope.
**Depends on:** Phase 1
**Requirements:** INS-01, INS-02, INS-03, INS-04
**Files:** `features/plugin/install.feature`, `features/plugin/install-dependencies.feature`, `features/plugin/partial-install.feature`; `plugin/install.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. Installing a plugin that declares dependencies installs the whole closure in dependency order (proven by the `RESV-01` unit tests), reports a row for each member, and a new session offers the skills of every member (INS-01).
2. A closure with a missing dependency, or with a version constraint no offered version satisfies, fails with its reason and installs nothing: `list` shows no member installed, and a new session offers none of their skills (INS-02).
3. A plugin with skills and an unsupported component fails to install without `--partial`. With `--partial`, it installs only the skills, and `info` then reports it as `unsupported component` (INS-03).
4. Installing with no `--scope`, and with `--scope user`, records the plugin in the user scope only (`list --scope project` shows no installation of it), and a new session started in another project offers its skills (INS-04).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 4: Git-Source Plugins

**Goal:** A plugin whose source is a git repository installs, fails, updates, and uninstalls against the loopback git host, and the request log shows when the network is used and when the clone cache is.
**Depends on:** Phase 1
**Requirements:** INS-05, INS-06, UPD-02, UNI-03
**Files:** `features/plugin/git-source.feature`, `features/plugin/git-source-update.feature`; `plugin/git-source.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. A plugin with each git source kind (`github`, `url`, `git-subdir`) installs from the git host, and a new session offers its skills. A second install of the same pinned source reuses the clone, and the git host receives no request (INS-05).
2. When the host answers 404 or 401 for a plugin source, or drops the connection, the install fails with the matching reason and leaves no installation record, no `plugin-clones/` entry, and no skill in a new session (INS-06).
3. Updating a git-source plugin to a new revision fetches it on a cache miss, as the request log shows, and makes no request when the cache already holds that revision (UPD-02).
4. Uninstalling a git-source plugin removes its `plugin-clones/` entry when no other installation uses it, and keeps the entry while another installation still does (UNI-03).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 5: Install and Update Rollback

**Goal:** An install or an update that fails partway leaves the scope as it was before the command, and the same command succeeds once the cause is gone.
**Depends on:** Phase 1
**Requirements:** INS-07, UPD-04
**Files:** `features/plugin/install-rollback.feature`, `features/plugin/update-rollback.feature`; `plugin/rollback.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. An install whose later phase cannot write its target fails with its reason, and nothing the earlier phases wrote is left: no installation record, no declaration, and no skill in a new session (INS-07).
2. Once the target is writable again, the same install succeeds, and a new session offers the plugin's skills (INS-07).
3. An update that fails partway keeps the installed version: `list` and `info` show the old version, a new session offers the old version's skills, and the installation record is unchanged (UPD-04).
4. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 6: Uninstall Data and Prune Flags

**Goal:** `uninstall` removes or keeps a plugin's data directory and its unneeded dependencies as its flags say.
**Depends on:** Phase 1
**Requirements:** UNI-01, UNI-02
**Files:** `features/plugin/uninstall.feature`; `plugin/uninstall.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. Uninstalling a plugin removes its data directory. `uninstall --keep-data` keeps the directory, and the file planted in it keeps its content (UNI-01).
2. `uninstall --prune` also uninstalls each dependency that no other installed plugin needs and reports each one, and it keeps a dependency that another installed plugin still needs (UNI-02).
3. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 7: Plugin Update by Marketplace, Constraint, and Partial

**Goal:** `update` has scenarios for updating every plugin of one marketplace, for a version constraint that blocks an update, and for a new version that became partially available.
**Depends on:** Phase 1
**Requirements:** UPD-01, UPD-03, UPD-05
**Files:** `features/plugin/update.feature`; `plugin/update.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `update @<marketplace>` updates every outdated plugin of that marketplace and reports each move. The outdated plugins of another marketplace keep their installed versions (UPD-01).
2. An update whose new version a dependent's version constraint does not accept is blocked with its reason, and the installed versions, records, and offered skills stay unchanged (UPD-03).
3. `update --partial` updates a plugin whose new version became partially available, Without the flag, the update is not applied, is reported as a `partially-upgradable` warning, and the installed version stays (UPD-05).
4. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 8: Plugin Reinstall

**Goal:** Reinstalling one plugin rewrites its artifacts at the same version, repairs deleted skill files, and fails for a plugin that is not installed.
**Depends on:** Phase 1
**Requirements:** REI-01, REI-02, REI-03
**Files:** `features/plugin/reinstall.feature`; `plugin/reinstall.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. Reinstalling one installed plugin reports it reinstalled, and `list` shows it at the same version and in the same scope (REI-01).
2. After a plugin's installed skill files are deleted, a new session lacks those skills. Reinstalling restores the files, and the next session offers the skills again (REI-02).
3. Reinstalling a plugin that is not installed fails with the not-installed reason and changes nothing (REI-03).
4. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 9: Plugin List

**Goal:** `list` has scenarios for every row status and every filter, for selecting one marketplace or one scope, and for `--remote`.
**Depends on:** Phase 1
**Requirements:** LST-01, LST-02, LST-03, LST-04, LST-05
**Files:** `features/plugin/list.feature`; `plugin/list.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `list` shows installed, available, unavailable, and partially available plugins, each with its status and scope, compared as one whole table (LST-01).
2. `--installed`, `--available`, `--unavailable`, and `--partial` each keep only their own rows, and two combined filters keep the union of their rows (LST-02).
3. `list <marketplace>` keeps only that marketplace's plugins, and an unknown marketplace fails as not added. `--scope user` and `--scope project` keep only that scope's installations (LST-03, LST-05).
4. `list --remote` filters to plugins from remote (git) sources (RSTA-07), and `list` makes no network request (LST-04, NFR-5).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 10: Plugin Info

**Goal:** `info` has scenarios for installed, available, partially available, and unavailable plugins, for `--fetch`, and for a plugin the marketplace does not offer.
**Depends on:** Phase 1
**Requirements:** INF-01, INF-02, INF-03, INF-04, INF-05
**Files:** `features/plugin/info.feature`; `plugin/info.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `info` on an installed plugin shows its version, marketplace, scope, and skills. On an available plugin that is not installed, it shows what installing it would provide (INF-01, INF-02).
2. `info` on a partially available plugin names what an install would leave out, and on an unavailable plugin it names the reasons (INF-03).
3. `info --fetch` reads the remote source and reports a newer revision, and `info` without the flag makes no request (INF-04).
4. `info` on a plugin the marketplace does not offer fails as not in the manifest (INF-05).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 11: Pending and Reconcile

**Goal:** After a config is edited by hand, `pending` shows what the next session will change, and the next session makes those changes.
**Depends on:** Phase 1
**Requirements:** PND-01, PND-02, REC-01, REC-02, REC-03, REC-04
**Files:** `features/plugin/pending.feature`, `features/plugin/reconcile.feature`; `plugin/pending.steps.ts` and `plugin/reconcile.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. After hand edits to a config, `pending` lists every install, uninstall, enable, and disable that the edits cause. When the configs and the records agree, it reports the empty result (PND-01).
2. `pending --scope user` and `pending --scope project` keep only that scope's changes (PND-02).
3. After a plugin is added to a config by hand, the next session installs it and offers its skills. After a plugin is removed by hand, the next session uninstalls it. After a plugin is set to enabled or disabled by hand, the next session enables or disables it (REC-01, REC-02, REC-03).
4. When the reconcile cannot install one plugin, the session's reconcile report names it, and the other changes from the same edit are applied (REC-04).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 12: Fetch and Prune

**Goal:** `fetch` refreshes the cached sources of git-source plugins without installing new versions, and `prune` removes orphaned dependencies and the clones of the dependencies it removes.
**Depends on:** Phase 1
**Requirements:** FET-01, FET-02, FET-03, PRN-01, PRN-02, PRN-03
**Files:** `features/plugin/fetch.feature`, `features/plugin/prune.feature`; `plugin/fetch.steps.ts` and `plugin/prune.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `fetch <plugin>@<marketplace>` refreshes a git-source plugin's cached source from the git host, as the request log shows, and installs no new version: `list` still shows the installed version (FET-01).
2. `fetch @<marketplace>` and a bare `fetch` refresh every git-source plugin in scope. When the host refuses one plugin, the others are still fetched and the failure is reported. A path-source plugin makes no request and reports nothing to fetch (FET-02, FET-03).
3. `prune` removes orphaned dependencies and the clones of the dependencies it removes, and reports a row for each one. `prune --dry-run` reports the same rows and removes nothing (PRN-01, PRN-02).
4. `prune` with nothing to remove reports the empty result (PRN-03).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 13: Plugin Import

**Goal:** `import` brings the enabled plugins and extra known marketplaces of a Claude Code settings file into a scope, once, and reports what it cannot provide.
**Depends on:** Phase 1
**Requirements:** IMP-01, IMP-02, IMP-03, IMP-04
**Files:** `features/plugin/import.feature`; `plugin/import.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `import` reads the enabled plugins and extra known marketplaces from a Claude Code settings file in the sandbox, adds the marketplaces, installs the plugins, and a new session offers their skills (IMP-01).
2. Running `import` a second time is a no-op and changes nothing (IMP-02).
3. An enabled plugin that its marketplace cannot provide is reported unavailable, and the other plugins still install (IMP-03).
4. `import --scope user` and `import --scope project` read only that scope's settings file and change only that scope (IMP-04).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 14: Bootstrap, Browse, Help, and Usage Errors

**Goal:** The remaining plugin subcommands have scenarios: `bootstrap`, the `browse` refusal outside the TUI, plugin `help`, and the usage rejection of every plugin subcommand.
**Depends on:** Phase 1
**Requirements:** BOO-01, BOO-02, BRW-01, HLP-01, USE-01
**Files:** `features/plugin/bootstrap.feature`, `features/plugin/browse.feature`, `features/plugin/help.feature`, `features/plugin/usage-errors.feature`; `plugin/bootstrap.steps.ts`, `plugin/browse.steps.ts`, and `plugin/help.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `bootstrap` adds the official marketplace to the user scope through the GitHub base override, and a second run is a no-op. `bootstrap` with an argument or with `--scope` is rejected with its usage (BOO-01, BOO-02).
2. `browse` outside the TUI is refused with a message that names `list` (BRW-01).
3. `help` shows the plugin usage, and `help <unknown topic>` is rejected (HLP-01).
4. Every plugin subcommand rejects a flag it does not accept, extra positional arguments, and a bad `--scope` value, with the same result shape the marketplace usage-error feature checks (USE-01).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 15: State Lock and Marketplace Failure Cleanup

**Goal:** A command run while another process holds the state lock changes nothing, a failed `marketplace add` leaves nothing behind, and `marketplace remove` cleans up the clones of the plugins it uninstalls.
**Depends on:** Phase 1
**Requirements:** FLR-01, FLR-02, FLR-03, FLR-04
**Files:** `features/plugin/state-lock.feature`, `features/marketplace/state-lock.feature`, `features/marketplace/failed-add.feature`, `features/marketplace/remove.feature`; `marketplace/remove.steps.ts` (new) if needed.
**Success Criteria** (what must be TRUE):

1. Each plugin command that changes a scope, run while another process holds that scope's state lock, fails with the lock-held reason, and the scope's records, configs, and offered skills are unchanged (FLR-01).
2. `marketplace add`, `remove`, and `update`, run while another process holds the state lock, fail with the lock-held reason and change nothing (FLR-02).
3. A `marketplace add` that fails with 404, an invalid manifest, or a dropped connection leaves no clone directory and no record, and the same add succeeds once the cause is gone (FLR-03).
4. `marketplace remove` deletes the `plugin-clones/` entries of the git-source plugins it uninstalls, and keeps an entry that another installation still uses (FLR-04).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 16: Git Plugin Copies and Version Rule

**Goal:** An installed git-source plugin runs exactly the code its record names, and every command reports a plugin's version the same way.
**Depends on:** Phase 15 (merged milestone tree)
**Decision:** 2026-10-23 (user): no per-plugin version pinning; install the latest version the scope knows about. Unpinned installs get a per-commit copy like pinned ones; the URL-keyed mirror is only a download cache. One version rule: declared version first, `sha-<12hex>` only when none is declared (supersedes D-77-01's "sha replaces the ladder"; verify upstream precedence in the Claude Code binary first).
**Requirements:** GIT-01, GIT-02, VER-01
**Files:** `orchestrators/plugin/clone-cache.ts`, `clone-gc.ts`, `install-outcome.ts` (`deriveInstallVersion`), `domain/version.ts`, the list and info row builders; `features/plugin/git-source.feature`, `git-source-update.feature`, `fetch.feature`, and the `info`/`list` scenarios that state git versions.
**Success Criteria** (what must be TRUE):

1. After `fetch` refreshes an unpinned plugin's mirror, the installed plugin's files and the code a session runs are unchanged until `update` or `reinstall` (GIT-01).
2. Clone cleanup keeps the per-commit copy of every installed plugin and deletes clones no installation uses (GIT-02).
3. A git plugin that declares a version is recorded and shown with that version by `install`, `info`, and `list`; one that declares none shows `sha-<12hex>`; `update` still detects a new revision through the stored sha (VER-01).
4. `npm run check` stays green.

### Phase 17: Reconcile Stale-Declarer Warning

**Goal:** A new session tells the truth about a plugin that is still installed but whose marketplace no longer describes it.
**Depends on:** Phase 15 (merged milestone tree)
**Decision:** 2026-10-23 (user): replace `failed {unreadable}` with a `warning` naming the real fault and its cause, still emitted every session until fixed (BACKLOG STALE-DECLARER-01, D-10).
**Requirements:** REC-05
**Files:** `orchestrators/reconcile/apply.ts` (`reportUnreadableDeclarer`); the rows in `features/marketplace/update.feature`, `features/marketplace/remove.feature`, `features/plugin/uninstall.feature`, `features/plugin/update.feature`, `features/plugin/reinstall.feature`, `features/plugin/reconcile.feature`.
**Success Criteria** (what must be TRUE):

1. A plugin whose marketplace catalog dropped it is reported at each new session as a `warning` row with `{not in manifest}` and a cause chain, and it keeps working (REC-05).
2. A plugin whose marketplace manifest is broken is reported the same way with the token `list`/`info` use for that fault: `{unparseable}`, `{source missing}`, `{permission denied}`, or `{invalid manifest}` (REC-05, D-11).
3. `npm run check` stays green.

### Phase 18: Update and Reinstall Unification

**Goal:** After a marketplace update, `update` and `reinstall` behave as one operation that installs the latest known version and reports it truthfully.
**Depends on:** Phase 16, Phase 17
**Decision:** 2026-10-23 (user): reinstall installs whatever version the marketplace offers (same or newer) and must record and report it (supersedes D-68-02); unify the `update` and `reinstall` paths as much as possible.
**Requirements:** REI-04, UPR-01
**Files:** `orchestrators/plugin/update-flow.ts`, `update-swap.ts`, `reinstall-flow.ts` and its `reinstall-*` leaves; `features/plugin/reinstall.feature`, `features/plugin/update.feature`.
**Success Criteria** (what must be TRUE):

1. When the marketplace now offers a newer version, `reinstall` installs it and its row, the record, `list`, `info`, and the next session all show the new version (REI-04).
2. `reinstall` of an up-to-date plugin still restores deleted artifacts at the same version (REI-01/REI-02 hold).
3. `update` and `reinstall` share one materialization path; their remaining differences (target selection, messaging) are the only per-verb code (UPR-01).
4. `npm run check` stays green.

### Phase 19: Import on the Reconcile Path

**Goal:** `import` is reconcile with Claude Code settings as its source: it never reinstalls, reports what it skipped, and respects the state lock.
**Depends on:** Phase 17
**Decision:** 2026-10-23 (user): import shares reconcile's desired-state path; unlike reconcile's silent startup no-op, it reports skips (`skipped {already installed}`, and a marketplace already added as a skipped no-op at `info`). Fix the bug that import under a held lock reports `unexpected-failure`.
**Requirements:** IMP-05, IMP-06, IMP-07
**Files:** `orchestrators/import/*`, the reconcile entry points it reuses; `features/plugin/import.feature`.
**Success Criteria** (what must be TRUE):

1. `import` installs, enables, and adds marketplaces through the reconcile desired-state path, and an already-installed plugin is not reinstalled (IMP-05).
2. A second `import` reports each plugin as `skipped {already installed}` and each marketplace as a skipped no-op, with the result at `info` severity (IMP-06).
3. `import` run while another process holds the state lock fails with `lock held` and its cause chain, and changes nothing (IMP-07).
4. `npm run check` stays green.

### Phase 20: Path-Source Version and Missing Source

**Goal:** A path-source plugin reports its version and a missing source the same way a git-source plugin does.
**Depends on:** Phase 16
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules. Path and git sources behave the same in most respects (user: a git source is a path source from a cloned repo).
**Requirements:** VER-02, SRC-01
**Files:** `orchestrators/plugin/list-candidate-row.ts`, `orchestrators/plugin/info.ts`, `shared/probe-classifiers.ts`; `features/plugin/list.feature`, `features/plugin/info.feature`, `features/plugin/install.feature`.
**Success Criteria** (what must be TRUE):

1. A path-source plugin whose plugin.json declares a version different from its marketplace entry shows plugin.json's version in `list`, `info`, and after `install` (VER-02).
2. A path-source plugin whose directory is missing reads `{source missing}` in `info`, `install`, and `list` (SRC-01).
3. `npm run check` stays green.

### Phase 21: Marketplace Add No-Op and Token Parity

**Goal:** Marketplace write commands treat an already-added marketplace as a no-op and name manifest faults with the read commands' tokens.
**Depends on:** Phase 19
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules.
**Requirements:** MPA-01, MPA-02, MPA-03
**Files:** `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/bootstrap.ts`, the marketplace help handler; `features/marketplace/*.feature`, `features/plugin/bootstrap.feature`.
**Success Criteria** (what must be TRUE):

1. `marketplace add` and `bootstrap` of a marketplace already added with the same source report `(skipped) {already added}` at `info` and change nothing (MPA-01).
2. A malformed, missing, or unreadable marketplace manifest reads the same token in `marketplace add`/`update` as in `list`/`info` and the stale-declarer row (MPA-02).
3. `marketplace help --bogus` reports `Unknown flag: "--bogus".` (MPA-03).
4. `npm run check` stays green.

### Phase 22: Install Failure Reasons

**Goal:** No install failure renders without its reason.
**Depends on:** Phase 16
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules.
**Requirements:** INR-01, INR-02, INR-03, INR-04
**Files:** `orchestrators/plugin/install-cascade.ts` (`handleCascadeThrow`), `install-outcome.ts`, `install.messaging.ts`, the staging-leak helper (`appendLeakToError`); `features/plugin/install*.feature`, `features/plugin/git-source.feature`.
**Success Criteria** (what must be TRUE):

1. A cascade whose dependency clone the host refuses names the reason on that member's row and after `/reload` (INR-01).
2. A staging cleanup leak keeps the failure's reason (INR-02).
3. An install pinned to a commit the remote lacks fails with a reason (INR-03).
4. Both `{version conflict}` causes print ranges in one form (INR-04).
5. `npm run check` stays green.

### Phase 23: Uninstall and Prune Parity

**Goal:** Uninstall and prune previews and refusals read as Claude Code's do and as the other commands' do.
**Depends on:** Phase 16
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules.
**Requirements:** PRN-02, PRN-03, UNI-01
**Files:** `shared/notification-types.ts` (`PluginWillUninstallMessage`), its payload schema, the prune, pending, and reconcile `will uninstall` producers, `orchestrators/plugin/uninstall.ts`; `features/plugin/prune.feature`, `features/plugin/uninstall.feature`, `features/plugin/pending.feature`.
**Success Criteria** (what must be TRUE):

1. Every `will uninstall` row (prune `--dry-run`, pending, reconcile) shows the plugin's version (PRN-02).
2. `prune` under a held lock prints the lock path as the other commands do (PRN-03).
3. `uninstall` of a dependency whose only dependents are disabled behaves as Claude Code 2.1.30x does (UNI-01).
4. `npm run check` stays green.

### Phase 24: Import Reasons

**Goal:** `import` reports the same reasons and statuses as `install` and reconcile.
**Depends on:** Phase 19
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules.
**Requirements:** IMP-08, IMP-09, IMP-10
**Files:** `orchestrators/import/*`; `features/plugin/import.feature`.
**Success Criteria** (what must be TRUE):

1. A first-time import of an uninstallable plugin shows the narrowed reason `install` shows (IMP-08).
2. An unclassified import failure is not rendered as `{not in manifest}` (IMP-09).
3. Import re-enabling a partially installed plugin reports `(partially-installed)` (IMP-10).
4. `npm run check` stays green.

### Phase 25: Update and Reinstall Rows

**Goal:** Update and reinstall rows always say which version and commit moved, and refusals match `uninstall`.
**Depends on:** Phase 18
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules. User: show the commit when the version is the same: `1.0.0 (bfgaef) -> 1.0.0 (abe2a)`.
**Requirements:** UPR-02, UPR-03, UPR-04
**Files:** the update and reinstall messaging after Phase 18's unification, `shared/notification-grammar.ts`; `features/plugin/update.feature`, `features/plugin/reinstall.feature`.
**Success Criteria** (what must be TRUE):

1. An update to a new commit at the same declared version renders `1.0.0 (<sha7>) → 1.0.0 (<sha7>)` (UPR-02).
2. `partially-installed` and `failed` update rows show the version and from/to where known (UPR-03).
3. `reinstall` of a plugin that is not installed reports `failed {not installed}` (UPR-04).
4. `npm run check` stays green.

### Phase 26: Git Mirror Access

**Goal:** The git download cache is refreshed safely and fetched once.
**Depends on:** Phase 18
**Decision:** 2026-10-23 (user + orchestrator, second round): follow Claude Code unless a recorded divergence applies; resolve the rest per upstream and existing rules.
**Requirements:** GIT-03, GIT-04, GIT-05
**Files:** `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/fetch.ts`, `orchestrators/plugin/info.ts` (`--fetch`), the marketplace tag-clone helper; `features/plugin/fetch.feature`, `features/plugin/info.feature`.
**Success Criteria** (what must be TRUE):

1. `fetch` and `info --fetch` refresh the mirror under the state lock; with the lock held they fail with `lock held` (GIT-03).
2. Per-commit copies and tag clones use one copy-and-checkout helper that handles a symlink-only directory (GIT-04).
3. A cold `info --fetch` of an unpinned source makes one request round to the host (GIT-05).
4. `npm run check` stays green.

### Phase 27: Install and Reconcile Reason Residue

**Goal:** The reasons phases 22-24 aligned read the same in every remaining command.
**Depends on:** Phase 22, Phase 23, Phase 24
**Decision:** 2026-10-23 (orchestrator, from phase 22-24 reports): follow Claude Code's range form; carry install's narrowed reasons into reconcile and import; match named uninstall's disabled-holder rule.
**Requirements:** INR-05, INR-06, REC-06, MPR-01
**Files:** `orchestrators/plugin/install-cascade.ts`, `install.messaging.ts`, `platform/git.ts` (fetch tags), `orchestrators/reconcile/apply-outcomes.ts`, `orchestrators/import/execute.ts`, `orchestrators/marketplace/remove.ts`; matching features.
**Success Criteria** (what must be TRUE):

1. `{version conflict}` and `{no matching version}` causes print declared ranges joined with `, ` and unquoted, so a `||` range keeps its meaning (INR-05).
2. A pin the remote lacks fails with a cause that names the commit without git-library advice; a pin reachable only from a tag installs through the ref-hint clone (INR-06).
3. Reconcile's failed install shows install's narrowed reasons, and `import` shows `{rollback partial}` (REC-06).
4. `marketplace remove` is not refused by a dependent that is disabled (MPR-01).
5. `npm run check` stays green.

### Phase 28: Delisted Plugin Dependency Walk

**Goal:** A delisted plugin stays "installed, not in manifest" (v1.18) everywhere, including the dependency walk.
**Depends on:** Phase 25, Phase 26
**Decision:** 2026-10-24 (user): a delisted plugin is not marketplace corruption; it can be used as is or uninstalled. Read its dependencies from its installed copy, after confirming upstream does the same. Upstream check (Claude Code 2.1.309): upstream does not load a delisted plugin (`plugin-not-found`), so it reads no dependencies for it. 2026-10-24 (user, DLS-D1): a delisted plugin that Pi keeps running (v1.18 divergence) keeps its dependencies from its installed copy, so it still protects its dependencies and constrains other plugins; upstream skips the plugin entirely because it does not load it. A path-source plugin whose directory is gone still fails closed with `{unreadable}`. The phase 17 per-session `{not in manifest}` warning stays as its own row, our counterpart to `plugin-not-found`, independent of the walk.
**Requirements:** DLS-01
**Files:** `orchestrators/plugin/dependency-index.ts` (`readRecordDeclarations`), `orchestrators/plugin/update-constraint-gate.ts`, the reconcile backfill; `features/plugin/update.feature`, `reinstall.feature`, `uninstall.feature`, `enable-disable.feature`, `pending.feature`.
**Success Criteria** (what must be TRUE):

1. With one plugin delisted, `update` and `reinstall` of another plugin in the scope succeed, and the delisted plugin's own declared ranges still constrain them (DLS-01).
2. `uninstall` of a dependency the delisted plugin needs is refused as it would be if the plugin were listed, and the enable cascade reads its dependencies the same way (DLS-01).
3. `/reload` with a delisted plugin emits no `(failed)` backfill row (DLS-01).
4. A delisted plugin whose installed copy is unreadable still fails the walk closed with `{unreadable}` (D-17).
5. `npm run check` stays green.

### Phase 29: Apply Command and Read-Only Reload

**Goal:** Changing installation state is always an explicit command: `apply` reaches the desired state, and a load only reloads resources and reports what is pending.
**Depends on:** Phase 28
**Decision:** 2026-10-24 (user), superseding the same day's "load converges on the catalog": a load (`/reload`, session start) changes no installation state; on a mismatch it prints `pending`'s block and advises `/claude:plugin apply`. `apply` makes every change `pending` lists, converges installed plugins on their marketplace's catalog version (including the partial-plugin backfill), may clone on cache miss, and then suggests `/reload`. `marketplace update` on an autoupdate marketplace keeps updating its plugins as before (explicit command; no session-start refresh exists). Amends NFR-2 ("`/reload` must suffice" becomes "`apply`, then `/reload`"); record both as decision IDs, with the Claude Code comparison.
**Requirements:** APL-01, APL-02, APL-03, APL-04
**Files:** `orchestrators/reconcile/*` (`plan.ts`, `apply.ts`, `backfill.ts`, `notify.ts`, `pending.ts`), `index.ts` (`resources_discover`, `session_start`), a new edge handler and router entry for `apply`, help, completions, `docs/output-catalog.md`, `docs/json-output.md`; `features/plugin/pending.feature`, `features/plugin/reconcile*.feature`, a new `features/plugin/apply.feature`.
**Success Criteria** (what must be TRUE):

1. `apply` makes every change `pending` listed, then `pending` lists nothing; `apply` with nothing pending reports so and writes nothing (APL-01).
2. After `marketplace update` moves a path-source and a git-source plugin, `apply` installs both at the catalog version; a range-blocked move and a consent-needing partial move stay put with warning rows and remain in `pending` (APL-02).
3. `/reload` after hand-editing the config changes no state and prints `pending`'s block with the `apply` trailer; `/reload` with nothing pending prints nothing (APL-03).
4. `pending`, help, completions and the docs name `apply` (APL-04).
5. `npm run check` stays green.

**Plans:** 9/14 plans executed

Plans:
**Wave 1**
- [x] 29-01-PLAN.md — Tracer: the `/claude:plugin apply` verb (handler, router, register, flag catalog, help, completions, JSON outcome)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 29-02-PLAN.md — A load changes no installation state: `load.ts` and the shared `read-pass.ts`; the reload scenarios move to `apply`
- [x] 29-03-PLAN.md — `pending` ends with the `/claude:plugin apply` trailer and carries `needsApply`

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 29-04-PLAN.md — An empty `apply` reports `Apply: nothing to change.`; the empty pending advisory names `apply`; the catalog's `apply` section

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 29-05-PLAN.md — `apply` ends with the reload trailer and installs missing dependencies on every run

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 29-06-PLAN.md — `pending` lists marketplace adds and removes as `(will add)` / `(will remove)` (D-20)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 29-07-PLAN.md — `pending` lists the LOAD-01 dependency disables and missing-dependency installs (D-21)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 29-08-PLAN.md — A load prints `pending`'s block on a mismatch and nothing on a match

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 29-09-PLAN.md — `(will update)` and the offline convergence planner for path-source catalog moves

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 29-10-PLAN.md — Range holds and consent declines in `pending` and the load; the network-free constraint fold

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 29-11-PLAN.md — Git-source and supported-set growth moves in the preview

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 29-12-PLAN.md — `apply` converges plugins on the catalog through a new runner entry and keeps blocked moves

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 29-13-PLAN.md — `apply` makes partial plugins whole; the backfill and the extension-version stamp retire

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 29-14-PLAN.md — APL-D1 and APL-D2 decision records, README, CHANGELOG and internal docs

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Suite Foundation | 10/10 | Complete    | 2026-10-23 |
| 2. Plugin Enable and Disable | 2/2 | Complete    | 2026-10-23 |
| 3. Install Dependencies, Partial, and User Scope | 1/1 | Complete    | 2026-10-23 |
| 4. Git-Source Plugins | 2/2 | Complete    | 2026-10-23 |
| 5. Install and Update Rollback | 1/1 | Complete    | 2026-10-23 |
| 6. Uninstall Data and Prune Flags | 1/1 | Complete    | 2026-10-23 |
| 7. Plugin Update by Marketplace, Constraint, and Partial | 1/1 | Complete    | 2026-10-23 |
| 8. Plugin Reinstall | 1/1 | Complete    | 2026-10-23 |
| 9. Plugin List | 2/2 | Complete    | 2026-10-23 |
| 10. Plugin Info | 1/1 | Complete    | 2026-10-23 |
| 11. Pending and Reconcile | 1/1 | Complete    | 2026-10-23 |
| 12. Fetch and Prune | 2/2 | Complete    | 2026-10-23 |
| 13. Plugin Import | 1/1 | Complete    | 2026-10-23 |
| 14. Bootstrap, Browse, Help, and Usage Errors | 3/3 | Complete    | 2026-10-23 |
| 15. State Lock and Marketplace Failure Cleanup | 4/4 | Complete    | 2026-10-23 |
| 16. Git Plugin Copies and Version Rule | 2/2 | Complete    | 2026-10-23 |
| 17. Reconcile Stale-Declarer Warning | 1/1 | Complete    | 2026-10-23 |
| 18. Update and Reinstall Unification | 7/7 | Complete    | 2026-10-23 |
| 19. Import on the Reconcile Path | 1/1 | Complete    | 2026-10-23 |
| 20. Path-Source Version and Missing Source | 1/1 | Complete    | 2026-10-23 |
| 21. Marketplace Add No-Op and Token Parity | 1/1 | Complete    | 2026-10-23 |
| 22. Install Failure Reasons | 1/1 | Complete    | 2026-10-23 |
| 23. Uninstall and Prune Parity | 1/1 | Complete    | 2026-10-23 |
| 24. Import Reasons | 1/1 | Complete    | 2026-10-23 |
| 25. Update and Reinstall Rows | 8/8 | Complete    | 2026-10-24 |
| 26. Git Mirror Access | 1/1 | Complete    | 2026-10-23 |
| 27. Install and Reconcile Reason Residue | 1/1 | Complete    | 2026-10-23 |
| 28. Delisted Plugin Dependency Walk | 1/1 | Complete    | 2026-10-24 |
| 29. Apply Command and Read-Only Reload | 9/14 | In Progress | - |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap
  pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return
  `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead
  would set Pi's error flag.
- `ROOTKEY-01`, carried from mcp-4, remains in [BACKLOG.md](BACKLOG.md): a root
  plugin name outside the dependency token alphabet gets a misleading
  dependency cause.
- `MKTPAR-01` is in [BACKLOG.md](BACKLOG.md): Claude Code's reserved official
  marketplace names, hosted `marketplace.json` URLs, and the `/plugin market`
  alias stayed out of marketplace-features.
- `SHORTREF-01` and `ROWID-01`, from marketplace-features, are in
  [BACKLOG.md](BACKLOG.md): the `owner/repo@ref` shorthand splits at the last
  `@` where Claude Code splits at the first, and marketplace-level failure rows
  carry a plugin-shaped `<mp>@<mp>` JSON id.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
