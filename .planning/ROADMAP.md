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

- [ ] **Phase 1: Suite Foundation** — Every driver, fixture, stand-in, and shared step that more than one later phase needs, each with a seed scenario, so Phases 2-15 add only their own files
- [ ] **Phase 2: Plugin Enable and Disable** — Skills come and go across sessions while the plugin stays installed, no-ops skip, scopes stay separate, and dependencies follow Claude Code
- [ ] **Phase 3: Install Dependencies, Partial, and User Scope** — The dependency closure, an unresolvable closure, `--partial`, and the user scope
- [ ] **Phase 4: Git-Source Plugins** — Install, refusal, update, and uninstall of git-source plugins against the loopback git host, with the request log
- [ ] **Phase 5: Install and Update Rollback** — An install or update that fails partway leaves the scope as it was, and a retry succeeds
- [ ] **Phase 6: Uninstall Data and Prune Flags** — `uninstall` removes or keeps the plugin data directory and prunes unneeded dependencies
- [ ] **Phase 7: Plugin Update by Marketplace, Constraint, and Partial** — `update @<marketplace>`, a blocking version constraint, and `update --partial`
- [ ] **Phase 8: Plugin Reinstall** — Single-plugin reinstall, restoring deleted skill files, and the not-installed failure
- [ ] **Phase 9: Plugin List** — Every row status, the filters, marketplace and scope selection, and `--remote`
- [ ] **Phase 10: Plugin Info** — Installed, available, partial, and unavailable plugins, `--fetch`, and the not-in-manifest failure
- [ ] **Phase 11: Pending and Reconcile** — `pending` after hand-edited configs, and a new session converging on them
- [ ] **Phase 12: Fetch and Prune** — Refreshing git-source plugin caches, and removing orphaned dependencies and unused clones
- [ ] **Phase 13: Plugin Import** — Importing enabled plugins and marketplaces from a Claude Code settings file
- [ ] **Phase 14: Bootstrap, Browse, Help, and Usage Errors** — `bootstrap`, the non-TUI `browse` refusal, plugin `help`, and every plugin usage rejection
- [ ] **Phase 15: State Lock and Marketplace Failure Cleanup** — A held state lock refuses plugin and marketplace commands, a failed `marketplace add` leaves nothing, and `marketplace remove` cleans plugin clones

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

**Plans:** 9/10 plans executed

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
- [ ] 01-10-PLAN.md — Tracer: the git host arms plugin repositories, seeded by a retried fetch in `plugin/fetch.feature`; the git clones of a scope, seeded by two uninstalls in `plugin/git-source.feature` and an update in `plugin/git-source-update.feature`

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
4. Enabling a plugin whose dependencies are disabled or absent enables or installs them and reports each one. Disabling a plugin that an enabled plugin depends on is refused or cascaded as Claude Code's `/plugin` does, and the scenario title says which (ENA-05).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 3: Install Dependencies, Partial, and User Scope

**Goal:** Install scenarios cover a plugin's dependency closure, a closure that cannot be resolved, a partially available plugin with and without `--partial`, and installs into the user scope.
**Depends on:** Phase 1
**Requirements:** INS-01, INS-02, INS-03, INS-04
**Files:** `features/plugin/install.feature`, `features/plugin/install-dependencies.feature`, `features/plugin/partial-install.feature`; `plugin/install.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. Installing a plugin that declares dependencies installs the whole closure in dependency order, reports a row for each member, and a new session offers the skills of every member (INS-01).
2. A closure with a missing dependency, or with a version constraint no offered version satisfies, fails with its reason and installs nothing: `list` shows no member installed, and a new session offers none of their skills (INS-02).
3. A plugin with skills and an unsupported component fails to install without `--partial`. With `--partial`, it installs only the skills, and `info` then names the component that was left out (INS-03).
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
2. An update whose new version breaks a dependency's version constraint is blocked with its reason, and the installed versions, records, and offered skills stay unchanged (UPD-03).
3. `update --partial` updates a plugin whose new version became partially available, and `info` names what was left out. Without the flag, the update fails and the installed version stays (UPD-05).
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
4. `list --remote` reports a git-source plugin whose source has a newer revision on the git host, and `list` without the flag makes no request (LST-04).
5. The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green.

**Plans:** TBD

### Phase 10: Plugin Info

**Goal:** `info` has scenarios for installed, available, partially available, and unavailable plugins, for `--fetch`, and for a plugin the marketplace does not offer.
**Depends on:** Phase 1
**Requirements:** INF-01, INF-02, INF-03, INF-04, INF-05
**Files:** `features/plugin/info.feature`; `plugin/info.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `info` on an installed plugin shows its version, scope, source, and skills. On an available plugin that is not installed, it shows what installing it would provide (INF-01, INF-02).
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

**Goal:** `fetch` refreshes the cached sources of git-source plugins without installing new versions, and `prune` removes orphaned dependencies and unused clones.
**Depends on:** Phase 1
**Requirements:** FET-01, FET-02, FET-03, PRN-01, PRN-02, PRN-03
**Files:** `features/plugin/fetch.feature`, `features/plugin/prune.feature`; `plugin/fetch.steps.ts` and `plugin/prune.steps.ts` if needed.
**Success Criteria** (what must be TRUE):

1. `fetch <plugin>@<marketplace>` refreshes a git-source plugin's cached source from the git host, as the request log shows, and installs no new version: `list` still shows the installed version (FET-01).
2. `fetch @<marketplace>` and a bare `fetch` refresh every git-source plugin in scope. When the host refuses one plugin, the others are still fetched and the failure is reported. A path-source plugin makes no request and reports nothing to fetch (FET-02, FET-03).
3. `prune` removes orphaned dependencies and unused clones and reports a row for each one. `prune --dry-run` reports the same rows and removes nothing (PRN-01, PRN-02).
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

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Suite Foundation | 9/10 | In Progress | - |
| 2. Plugin Enable and Disable | 0/TBD | Not started | - |
| 3. Install Dependencies, Partial, and User Scope | 0/TBD | Not started | - |
| 4. Git-Source Plugins | 0/TBD | Not started | - |
| 5. Install and Update Rollback | 0/TBD | Not started | - |
| 6. Uninstall Data and Prune Flags | 0/TBD | Not started | - |
| 7. Plugin Update by Marketplace, Constraint, and Partial | 0/TBD | Not started | - |
| 8. Plugin Reinstall | 0/TBD | Not started | - |
| 9. Plugin List | 0/TBD | Not started | - |
| 10. Plugin Info | 0/TBD | Not started | - |
| 11. Pending and Reconcile | 0/TBD | Not started | - |
| 12. Fetch and Prune | 0/TBD | Not started | - |
| 13. Plugin Import | 0/TBD | Not started | - |
| 14. Bootstrap, Browse, Help, and Usage Errors | 0/TBD | Not started | - |
| 15. State Lock and Marketplace Failure Cleanup | 0/TBD | Not started | - |

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
