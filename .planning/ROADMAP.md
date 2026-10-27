# Roadmap: pi-claude-marketplace

## Milestones

- **plugin-lifecycle** Marketplace and Plugin Lifecycle Backlog — in progress on branch `features/plugin-lifecycle`, started 2026-10-26.
- **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- **mcp-4 (MCP 4)** — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)


Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

### In progress plugin-lifecycle -- Marketplace and Plugin Lifecycle Backlog

**Milestone goal:** Every open `BACKLOG.md` entry about the marketplace and
plugin lifecycle is fixed, implemented, or closed with a recorded decision,
with Claude Code's `/plugin` behavior as the reference.

#### Parallelism

Phases 1-9 are wave 1. Each depends on nothing in this milestone, and each
runs in its own session and git worktree, branched from
`features/plugin-lifecycle`. The `Files` line of each phase names the
production files it owns. Where two phases must touch one file, the line says
so, and they edit different functions in it. Phases 10 and 11 are wave 2: they
start after every wave-1 branch is merged back, because they sweep tests,
docs, and shared modules that wave 1 changes. Phases 10 and 11 can run in
parallel with each other.

Inside a phase, plans in one wave must own disjoint files, so the executor can
run them in parallel.

Shared files that no wave-1 phase edits: `CHANGELOG.md`, `.planning/PROJECT.md`
(Key Decisions), and `.planning/BACKLOG.md`. A phase writes its CHANGELOG line,
its decision rows, and its backlog dispositions into its own SUMMARY.md; the
parent session applies them at merge.

- [ ] **Phase 1: Staging Warning Channels** - every staging verb reports its warnings, on success, on failure, and inside cascades
- [ ] **Phase 2: Apply Ordering and Installed Declarations** - `pending` and `apply` agree, and dependency reads come from the installed copy
- [ ] **Phase 3: Dependency Cascade Rows and Status** - cascade rows name every member, declarer, and degraded dependency
- [ ] **Phase 4: Dependency Resolver Residue** - the resolver installs what it previewed and refuses before it moves
- [ ] **Phase 5: Marketplace Command Parity** - reserved names, hosted manifests, `market` alias, row ids, shorthand, remove reporting
- [ ] **Phase 6: Import Marketplace Planning** - import plans marketplaces the way Claude Code registers them
- [ ] **Phase 7: Git Errors and Lock Discipline** - one git-host classifier, and every clone read or cleanup under the lock
- [ ] **Phase 8: Background Autoupdate** - autoupdate updates in the background, as Claude Code does
- [ ] **Phase 9: Plugin Package Dependencies** - a plugin's own npm or bun dependencies install with it
- [ ] **Phase 10: Lifecycle Test and Harness Gaps** - the open scenario, unit, and harness gaps are closed
- [ ] **Phase 11: Cleanup, Split, and Docs** - dead code, the install-flow split, docs, and backlog closures

## Phase Details

### Phase 1: Staging Warning Channels

**Goal:** `enable`, the update and reinstall cascades, and a failed install, update, or reinstall show the staging warnings a standalone install shows, and the two warning channels are told apart by type.
**Depends on:** nothing (wave 1)
**Requirements:** WRN-01, WRN-02, WRN-03, WRN-04, WRN-05, WRN-06, WRN-07
**Backlog:** ENWARN-01, UPCASC-01, WCHAN-01, WARN-01, AGIDX-01, LCORCH-01 b3 b4
**Files:** `bridges/{skills,commands,agents,mcp,hooks,workflows}/` (stage and types), `orchestrators/plugin/{install-outcome,update-swap,materialize-latest,reinstall-flow,enable-disable,dependency-settle,install.messaging}.ts`, `orchestrators/plugin/shared.ts` (warning functions only), `orchestrators/marketplace/update.messaging.ts`, `orchestrators/reconcile/apply-outcomes.ts`, `orchestrators/types.ts` (update and reinstall outcome arms). Shared with Phase 2 (`enable-disable.ts`: the enable warning surface only), Phase 4 (`install-outcome.ts`, `update-swap.ts`: different functions), Phase 7 (`update-swap.ts`).
**Success Criteria** (what must be TRUE):

1. Enabling a plugin whose skills collide reports the same skip `install` reports for it, and a scenario proves it (WRN-01).
2. A `marketplace update` cascade, an autoupdate cascade, and an `apply` catalog move each render a moved plugin's warnings under one header that names the plugin and its scope (WRN-02).
3. Every bridge returns tagged warnings, and assigning a hygiene warning to the discovery channel fails `npm run typecheck` (WRN-03).
4. An install whose mcp phase fails after the skills phase skipped a duplicate shows that skip beside the `(failed)` row (WRN-04).
5. A reinstall keeps a hand-named `agents-index.json` row; `update` shows a dependency's MCP notices; a reinstall drops the completion cache once (WRN-05, WRN-06, WRN-07).

### Phase 2: Apply Ordering and Installed Declarations

**Goal:** `pending` previews exactly what `apply` does, one `apply` settles a missing dependency that needs a moved version, and dependency declarations of an installed plugin come from its installed copy.
**Depends on:** nothing (wave 1)
**Requirements:** RCN-01, RCN-02, RCN-03, RCN-04, RCN-05, RCN-06, RCN-07, RCN-08
**Backlog:** PENDMOVE-01, MISSORDER-01, RECON-REPLAN-01, STALE-DECLARER-01, ENDEPS-01, UPDDEP-01 b3, MISS-MPADD-01, PARITYGV-01 b4, LCORCH-01 b6
**Research flag:** yes. Claude Code's `resolveMissingDependencies` call sites (marketplace add, post-install) and whether it reads declarations from the installed `plugin.json`.
**Files:** `orchestrators/reconcile/{apply,pending,convergence,dependency-verdict,read-pass}.ts`, `orchestrators/plugin/{dependency-index,dependency-declaration-read,update-constraint-gate}.ts`, `orchestrators/marketplace/{add,autoupdate}.ts` (dependency step only), `orchestrators/plugin/bootstrap.ts`. Shared with Phase 1 (`enable-disable.ts`), Phase 5 (`marketplace/add.ts`: Phase 5 owns classification and reserved names), Phase 6 (`apply.ts` rollback reporting), Phase 7 (`apply.ts` clone cleanup).
**Success Criteria** (what must be TRUE):

1. For the PENDMOVE-01 and MISSORDER-01 shapes, `pending` lists the rows one `apply` then makes, and a second `apply` reports nothing to change (RCN-01, RCN-02).
2. A scenario edits the config to uninstall a dependency and shows its dependent disabled in the same `apply` (RCN-03).
3. STALE-DECLARER-01 has a recorded decision ID, and the code and tests match it (RCN-04).
4. An enable after the marketplace changed a plugin's dependencies uses the installed copy's declarations, and the update preflight reads other plugins' ranges the same way (RCN-05).
5. `marketplace add`, `bootstrap`, and autoupdate settle missing dependencies as Claude Code does; the MISS-01 refusal report and delisted-copy containment match RCN-07 and RCN-08 (RCN-06, RCN-07, RCN-08).

### Phase 3: Dependency Cascade Rows and Status

**Goal:** Cascade rows and refusals name every member and declarer the way Claude Code does, and a plugin degraded by its dependency says so.
**Depends on:** nothing (wave 1)
**Requirements:** CAS-01, CAS-02, CAS-03, CAS-04, CAS-05, CAS-06, CAS-07
**Backlog:** CLOSUREROW-01, ROOTKEY-01, DEPS-STATUS-01, PARITYGV-01 b1 b2 b3, UPDDEP-01 b2, VERSTR-01
**Research flag:** yes. Claude Code's wording for unresolved closure members, invalid root names, `required by` lists, the 120-character truncation, and git-source upgrade state.
**Files:** `orchestrators/plugin/{install-cascade,install-cascade.messaging,constraint-fold,dependency-move,list-installed-row,list-flow,list-candidate-version}.ts`, `orchestrators/plugin/info.ts` (row status only), `domain/{dependency-closure,dependency-range}.ts`, `domain/components/plugin.ts` (version bound), `shared/notification-types.ts`, `shared/notify-reasons.ts`, `docs/output-catalog.md` (new states). Shared with Phase 7 (`info.ts`: fetch locking only).
**Success Criteria** (what must be TRUE):

1. The two `install-dependencies.feature` failure scenarios show a row for `lib` and `mid` (CAS-01).
2. `install _x@mp` reports the resolver's real cause, and the pinned integration case changes with it (CAS-02).
3. A plugin depending on a partially available plugin shows the decided status on `list`, `info`, and install, or the decision not to is recorded (CAS-03).
4. Git-source `list` rows, `required by` lists, and truncation match Claude Code or carry a recorded ID (CAS-04, CAS-05).
5. The offline git-move refusal names a next step, and no hold cause carries an unbounded `version` string (CAS-06, CAS-07).

### Phase 4: Dependency Resolver Residue

**Goal:** The dependency resolver installs the commit it previewed, refuses before any move lands, and its completeness and `apply` behavior are decided against Claude Code.
**Depends on:** nothing (wave 1)
**Requirements:** RSV-01, RSV-02, RSV-03, RSV-04, RSV-05
**Backlog:** UPDDEP-01 b1 b4 b5 b6, LCCODE-01 b2 b3
**Research flag:** yes. Claude Code's dependency resolver: complete or greedy, and what one bad dependency does to the root.
**Files:** `orchestrators/plugin/{dependency-plan,dependency-tag-probe}.ts`, `domain/release-tag.ts`, `orchestrators/plugin/install-flow.ts` (planning and missing-dependency functions only), `orchestrators/plugin/install-outcome.ts` (preview hand-off only), `orchestrators/plugin/update-swap.ts` (agent-target check only). Shared with Phase 1 and Phase 7 on `install-outcome.ts` and `update-swap.ts`, and with Phase 7 on `dependency-tag-probe.ts` (Phase 7 owns its error classification).
**Success Criteria** (what must be TRUE):

1. A fresh unpinned git dependency resolves once over the network and installs the previewed commit (RSV-01).
2. RSV-02 and RSV-03 each have a recorded decision, and the code and tests match it (RSV-02, RSV-03).
3. An update whose agent target is occupied refuses before any earlier move lands (RSV-04).
4. The `no-matching-tag` range and the `rollbackPartials` declaration are settled (RSV-05).

### Phase 5: Marketplace Command Parity

**Goal:** The marketplace commands match Claude Code on reserved names, hosted manifests, the `market` alias, shorthand parsing, row ids, and remove reporting.
**Depends on:** nothing (wave 1)
**Requirements:** MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08
**Backlog:** MKTPAR-01, ROWID-01, SHORTREF-01, PRUNE-GUARD-MR-01, LCORCH-01 b1, LCCODE-01 b6, CASCADEAX-01
**Research flag:** yes. Claude Code's reserved names list, hosted `marketplace.json` add and refresh, and shorthand regex (`claude-code-compat-research`, upstream binary).
**Files:** `domain/source.ts`, `domain/name.ts`, `edge/router.ts`, `edge/completions/*`, `orchestrators/marketplace/{add,add.messaging,remove,remove.messaging,shared,update,info}.ts`, `orchestrators/plugin/shared.ts` (cascade fold only), a new hosted-manifest fetch seam, `rule-packs/architecture.json` and `eslint.config.js` (network seams), `docs/json-output.md`. Shared with Phase 2 (`marketplace/add.ts`), Phase 7 (`marketplace/{shared,update,remove}.ts`: git classification and clone cleanup only).
**Success Criteria** (what must be TRUE):

1. `marketplace add` refuses a reserved name with Claude Code's wording, and `bootstrap` still adds the official marketplace (MKT-01).
2. A scenario adds a marketplace from an https URL to a hosted `marketplace.json`, installs from it, and updates it, with the network amendment recorded (MKT-02).
3. `market` works wherever `marketplace` does; failure rows carry the bare marketplace id; the shorthand rule is settled (MKT-03, MKT-04, MKT-05).
4. `marketplace remove` reporting of stranded dependents is settled, and its fold covers the hooks axis through the shared exhaustive fold (MKT-06, MKT-08).
5. `marketplace add` classifies a crash apart from a malformed manifest, handles a missing clone behind a record, and maps EISDIR (MKT-07).

### Phase 6: Import Marketplace Planning

**Goal:** `import` registers marketplaces as Claude Code does and reports partial rollbacks with install's detail.
**Depends on:** nothing (wave 1)
**Requirements:** MIM-01, MIM-02, MIM-03, MIM-04
**Backlog:** IMPNAME-01, IMPEXTRA-01, LCORCH-01 b2, LCCODE-01 b7
**Research flag:** yes. What Claude Code does with an `extraKnownMarketplaces` entry no enabled plugin uses, and with a settings name for a source it knows under another name.
**Files:** `orchestrators/import/{marketplaces,execute}.ts`, `orchestrators/reconcile/apply.ts` (failed-install row only), `shared/notification-grammar.ts` (rollback rows only), `features/plugin/import.feature`. Shared with Phase 2 and Phase 7 on `apply.ts`.
**Success Criteria** (what must be TRUE):

1. Scenarios cover a renamed known source and an unreferenced extra marketplace, with Claude Code's outcome (MIM-01, MIM-02).
2. A partial rollback during `import` and during `apply` shows the per-phase detail `install` shows (MIM-03).
3. The import enable outcome carries each companion fact once (MIM-04).

### Phase 7: Git Errors and Lock Discipline

**Goal:** One classifier reports every git host failure, and no clone read, copy, or cleanup runs outside the state lock.
**Depends on:** nothing (wave 1)
**Requirements:** GLK-01, GLK-02, GLK-03, GLK-04, GLK-05, GLK-06, GLK-07, GLK-08
**Backlog:** GITERR-01, CASCREASON-01, CLONEGC-01, TAGCOPY-01, FETCHROW-01, INTENTMS-01, ENTRYVER-01, LCORCH-01 b5
**Research flag:** yes. Claude Code's reporting of a host's 404 and 5xx on plugin install, update, and fetch.
**Files:** `shared/git-failure-classifiers.ts`, `orchestrators/plugin/{fetch,clone-gc,clone-cache,update-preflight,update-flow,uninstall,dependency-bindings,edge-deps}.ts`, `orchestrators/edge-deps.ts`, `orchestrators/plugin/info.ts` (fetch path only), `orchestrators/plugin/dependency-tag-probe.ts` (classification only), `orchestrators/marketplace/{shared,update,remove}.ts` (classification and clone cleanup only), `orchestrators/reconcile/apply.ts` (clone cleanup only), `orchestrators/plugin/update-swap.ts` (intent mark and cleanup only), `orchestrators/plugin/reinstall-flow.ts` (cleanup only). Shared with Phases 1, 2, 4, 5, and 6 as listed there.
**Success Criteria** (what must be TRUE):

1. A host 404 and 5xx on plugin install, update, fetch, and info report as marketplace add and update report them, through one entry point (GLK-01, GLK-02).
2. A unit test holds the lock in a second operation and shows each clone cleanup, the tag copy, and the fetch row read wait for it (GLK-03, GLK-04, GLK-05).
3. Two intent marks in one millisecond are distinguished (GLK-06).
4. A `fetch` scenario for a plugin whose `plugin.json` and entry disagree shows the `list` version; a warm tag reinstall makes no network call (GLK-07, GLK-08).

### Phase 8: Background Autoupdate

**Goal:** A marketplace with autoupdate on is refreshed and its plugins updated in the background after a session starts, as Claude Code does, with one passive notice.
**Depends on:** nothing (wave 1)
**Requirements:** AUP-01, AUP-02, AUP-03
**Backlog:** AUTOUP-01
**Research flag:** yes. Claude Code's delay, defaults per marketplace kind, `DISABLE_AUTOUPDATER` and `FORCE_AUTOUPDATE_PLUGINS`, and the notice wording.
**Files:** `index.ts` (session hook only), a new `orchestrators/marketplace/background-update.ts` (or similar), `orchestrators/marketplace/autoupdate.ts` (defaults only), `shared/notification-types.ts` (one new message kind), `docs/`. Shared with Phase 2 (`autoupdate.ts`), Phase 3 (`notification-types.ts`).
**Success Criteria** (what must be TRUE):

1. After a session starts, a marketplace with autoupdate on is refreshed and its plugins updated without a command, after the decided delay (AUP-01).
2. A foreground command running at the same time is never refused or corrupted by the background run (AUP-01).
3. Defaults and opt-outs match Claude Code, with each Pi mapping recorded (AUP-02).
4. One notice names the updated plugins and `/reload`; a run that changed nothing is silent (AUP-03).

### Phase 9: Plugin Package Dependencies

**Goal:** A plugin that ships `package.json` with a supported lockfile gets its dependencies installed as Claude Code installs them, without ever blocking the plugin.
**Depends on:** nothing (wave 1)
**Requirements:** PKD-01, PKD-02, PKD-03
**Backlog:** PKGDEP-01
**Research flag:** yes. Claude Code's lockfile order, commands, timeout, and session-start rerun.
**Files:** a new `platform/` process module and a new install-phase module, `orchestrators/plugin/install-outcome.ts` (ledger array only), `orchestrators/plugin/materialize-latest.ts` (update hook only), `shared/notify-reasons.ts`, `rule-packs/architecture.json`, `eslint.config.js`. Shared with Phase 1 and Phase 4 on `install-outcome.ts` and `materialize-latest.ts`, and Phase 3 on `notify-reasons.ts`.
**Success Criteria** (what must be TRUE):

1. Installing a plugin with `package.json` and `package-lock.json` runs `npm ci --ignore-scripts` (or the bun equivalent) in the staged copy, and its hook or MCP server finds its modules (PKD-01).
2. A failing or timed-out package install, or one with a lockfile Claude Code refuses (`bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`), leaves the plugin installed with a warning; a `package.json` with no lockfile stays silent, as Claude Code does (PKD-02, D-PL9-02).
3. The NFR-5 amendment and the spawn rule carry a decision ID, and `npm run check` is green (PKD-03).

### Phase 10: Lifecycle Test and Harness Gaps

**Goal:** Every behavior lifecycle-coverage left without a scenario or unit case has one, and the harness items are fixed.
**Depends on:** Phases 1-9 merged
**Requirements:** TST-01, TST-02, TST-03, CAS-08, MIM-05, XPH-01
**Backlog:** LCTEST-01, LCHARN-01, TEST-PHANTOMMP-01
**Files:** `features/**`, `test/e2e/_rpc.ts`, `test/edge/handlers/plugin/browse.test.ts`, `test/orchestrators/plugin/install-flow.test.ts`, `.agents/skills/cucumber/rules/*`; for CAS-08, the failure-row paths in `orchestrators/plugin/install-flow.ts`, `install-cascade.ts`, `install-cascade.messaging.ts`, and `update-cascade.ts`; for MIM-05, `orchestrators/reconcile/apply.ts` and `apply-outcomes.ts`; both landing before Phase 11 splits `install-flow.ts`.
**Success Criteria** (what must be TRUE):

1. Each LCTEST-01 item has a scenario or unit case, or a recorded unit-only reason (TST-01).
2. Each LCHARN-01 item is fixed or recorded as declined (TST-02).
3. No fixture builds a marketplace record without its manifest (TST-03).
4. A failed closure on the root-ledger, plan-step, and mid-walk lookup routes shows a row for each member that resolved but did not install, pinned by a cucumber scenario per route (CAS-08).
5. A partial rollback of `apply`'s missing-dependency install shows install's per-phase detail, pinned by a cucumber scenario (MIM-05).
6. Each XPH-01 residue item is fixed or pinned by a scenario (XPH-01).

### Phase 11: Cleanup, Split, and Docs

**Goal:** The milestone ends with no lifecycle dead code, a split install flow, docs that match behavior, and a backlog with every settled entry closed.
**Depends on:** Phases 1-9 merged; the CLN-02 split of `install-flow.ts` waits for Phase 10's CAS-08 change to land
**Requirements:** CLN-01, CLN-02, CLN-03, CLN-04
**Backlog:** LCCODE-01 b1 b4 b5 b8-b11, UPDDEP-01 b7, LCDOC-01, all entries settled by Phases 1-9
**Files:** `orchestrators/plugin/install-flow.ts` and new sibling modules, the LCCODE-01 sites, test lock helpers, `docs/**`, `CHANGELOG.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`.
**Success Criteria** (what must be TRUE):

1. Every LCCODE-01 item is fixed, and `npm run fallow` reports nothing new (CLN-01).
2. `install-flow.ts` is split into a flow root and leaf modules, with no behavior change (CLN-02).
3. Docs, CHANGELOG, and PROJECT.md decision rows match the shipped behavior (CLN-03).
4. `BACKLOG.md` marks every entry this milestone settled closed with its disposition (CLN-04).

## Carried Forward

- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap
  pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return
  `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead
  would set Pi's error flag.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in
  [BACKLOG.md](BACKLOG.md), out of this milestone's scope.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
