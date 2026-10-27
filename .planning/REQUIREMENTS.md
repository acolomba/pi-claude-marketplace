# Requirements: pi-claude-marketplace — plugin-lifecycle

**Defined:** 2026-10-26
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Milestone goal:** Every open `BACKLOG.md` entry about the marketplace and plugin lifecycle (install, enable, disable, update, reinstall, uninstall, prune, apply, pending, import, fetch, marketplace add/remove/update/autoupdate) is fixed, implemented, or closed with a recorded decision, with Claude Code's `/plugin` behavior as the reference.

Each requirement names the backlog entry it settles. The backlog text is a
lower bound, and some entries were already partly fixed (triage at `639bd8b5`,
2026-10-26). Each phase re-reads its entries against the code before planning.

**Decision policy:** Claude Code's behavior is the default for every
user-visible choice (AGENTS.md, Upstream parity). Only a recorded project
decision with an ID or a Pi capability gap licenses a divergence. A phase
makes the most consistent choice on its own, records it with an ID, and lists
every choice it was not sure of under `## Uncertain choices (for user review)`
in its CONTEXT.md and in its final report, so the user can revise it.

**Behavior policy:** a change a user can see ships with a cucumber scenario
under `features/` that fails without it (AGENTS.md, Behavioral tests).

## v1 Requirements

### Staging warnings (WRN)

- [ ] **WRN-01**: `enable` shows the discovery warnings its re-materialization produces, as `install` does for the same plugin (ENWARN-01)
- [ ] **WRN-02**: A cascade update or reinstall (`marketplace update`, autoupdate, `apply` catalog moves) renders the warnings each plugin's materialization produced, with one placement rule shared by the three cascades, and the diagnostic header names the scope (UPCASC-01)
- [ ] **WRN-03**: Each bridge tags a staging warning at the producer as discovery or hygiene, and the orchestrators partition on that tag, so swapping the two channels is a compile error (WCHAN-01)
- [ ] **WRN-04**: A failed install, update, or reinstall reports the prepare warnings the phases that ran before the failure collected (WARN-01)
- [ ] **WRN-05**: A forced agents commit keeps an `agents-index.json` row that the plugin's own staging did not produce (AGIDX-01)
- [ ] **WRN-06**: `update` shows the MCP notices of the dependencies it installs (LCORCH-01 b3)
- [ ] **WRN-07**: The reinstall outcome carries `resourcesChanged` again, and a reinstall drops the completion cache once (LCORCH-01 b4)

### Reconcile and apply (RCN)

- [x] **RCN-01**: `pending` previews the move that `apply` makes for a plugin whose moved dependency needs a plugin MISS-01 installs (PENDMOVE-01)
- [x] **RCN-02**: `apply` installs a missing dependency that needs a version the same `apply` moves to, in one run, and `pending` previews the same order (MISSORDER-01)
- [x] **RCN-03**: A scenario proves that a dependent whose dependency a config edit uninstalls is disabled in the same `apply` (RECON-REPLAN-01, close with proof)
- [x] **RCN-04**: The dependency walk's failure unit (whole scope vs one record) is decided, recorded with an ID, and the backlog entry closed (STALE-DECLARER-01)
- [x] **RCN-05**: The enable closure and the update preflight read an installed plugin's declarations from its installed copy, as Claude Code reads the installed `plugin.json` (ENDEPS-01, UPDDEP-01 b3)
- [x] **RCN-06**: `marketplace add`, `bootstrap`, and the autoupdate cascade resolve missing dependencies the way Claude Code does after those commands (MISS-MPADD-01)
- [x] **RCN-07**: `apply`'s report for a missing dependency MISS-01 refuses matches Claude Code, or the difference is recorded with an ID (PARITYGV-01 b4)
- [x] **RCN-08**: Installed-copy containment for a delisted plugin offers only the owning clone root of its source kind (LCORCH-01 b6)

### Dependency cascade rows and status (CAS)

- [ ] **CAS-01**: A failed install closure gives a row to each member that resolved but did not install (CLOSUREROW-01)
- [ ] **CAS-02**: `install` of a root name outside the token alphabet gets a verdict that names the real cause, not a dependency cause (ROOTKEY-01)
- [ ] **CAS-03**: A plugin whose dependency is partially available shows that on `list`, `info`, and install rows, with a reason naming the dependency, or the choice not to is recorded with an ID (DEPS-STATUS-01)
- [ ] **CAS-04**: `list` shows upgrade state for git-source plugins as Claude Code does (PARITYGV-01 b1)
- [ ] **CAS-05**: A refusal for a non-root cascade member names every declarer that required it, and names and ranges in those refusals are truncated as Claude Code truncates them (PARITYGV-01 b2, b3)
- [ ] **CAS-06**: The offline refusal of an install that would move a git dependency names the next step (UPDDEP-01 b2)
- [ ] **CAS-07**: A hold row's cause never interpolates an unbounded catalog `version` string (VERSTR-01)

### Dependency resolver (RSV)

- [ ] **RSV-01**: A fresh unpinned git dependency installs the commit the plan previewed, with one network resolve (UPDDEP-01 b1)
- [ ] **RSV-02**: Whether one bad dependency refuses the root under `apply` before its moves land is decided against Claude Code and implemented (UPDDEP-01 b4)
- [ ] **RSV-03**: The greedy resolver's completeness is compared with Claude Code's resolver; it is made complete or its limit is recorded with an ID (UPDDEP-01 b5)
- [ ] **RSV-04**: An agent-target refusal in an update is found before any move lands (UPDDEP-01 b6)
- [ ] **RSV-05**: The `no-matching-tag` outcome's range field is read or removed, and the failed arm of `InstallMissingDependencyOutcome` declares `rollbackPartials` (LCCODE-01 b2, b3)

### Marketplace commands (MKT)

- [ ] **MKT-01**: `marketplace add` refuses Claude Code's reserved official marketplace names, with `bootstrap` still able to add the official marketplace (MKTPAR-01 b1)
- [ ] **MKT-02**: `marketplace add` accepts a plain https URL to a hosted `marketplace.json`, and `marketplace update` refreshes it, as Claude Code does (MKTPAR-01 b2)
- [ ] **MKT-03**: `/claude:plugin market` is an alias of `marketplace` (MKTPAR-01 b3)
- [ ] **MKT-04**: Marketplace-level failure rows carry the marketplace as their JSON id, not `<mp>@<mp>` (ROWID-01)
- [ ] **MKT-05**: The `owner/repo@ref` shorthand splits as Claude Code splits it, or D-76-04 is recorded as a divergence (SHORTREF-01)
- [ ] **MKT-06**: `marketplace remove` reports the dependents it strands as Claude Code does, or the choice is recorded with an ID (PRUNE-GUARD-MR-01)
- [ ] **MKT-07**: `marketplace add` tells a malformed manifest from a crash, repairs or refuses an "already added" record whose clone is gone, and maps EISDIR as `list` and `info` do; its no-op returns a no-op status (LCORCH-01 b1, LCCODE-01 b6)
- [ ] **MKT-08**: The cascade `dropped` fold is exhaustive over the unstage axes, and `marketplace remove` uses it, hooks axis included (CASCADEAX-01)

### Import (MIM)

- [ ] **MIM-01**: `import` handles a settings marketplace whose source the scope records under another name as Claude Code does (IMPNAME-01)
- [ ] **MIM-02**: `import` adds the `extraKnownMarketplaces` entries Claude Code adds, referenced or not (IMPEXTRA-01)
- [ ] **MIM-03**: `import` and `apply` report a partial rollback with the detail `install` shows (LCORCH-01 b2)
- [ ] **MIM-04**: The import enable outcome carries the companion facts once (LCCODE-01 b7)

### Git errors and lock discipline (GLK)

- [ ] **GLK-01**: Every remote git access classifies a host's HTTP answer through one entry point with an explicit per-operation 404/410 rule, so plugin install, update, fetch, and info report it as marketplace add and update do (GITERR-01)
- [ ] **GLK-02**: The autoupdate cascade classifies an unclassified error as the direct update path does, not as `{not in manifest}` (CASCREASON-01)
- [ ] **GLK-03**: Clone cleanup runs under the state lock at every call site (CLONEGC-01)
- [ ] **GLK-04**: A marketplace-tag-pinned update copies the marketplace git data under a lock (TAGCOPY-01)
- [ ] **GLK-05**: `fetch` and `info --fetch` read their result row inside the lock (FETCHROW-01)
- [ ] **GLK-06**: Two update intent marks in the same millisecond are told apart (INTENTMS-01)
- [ ] **GLK-07**: `fetch`, tab completion, and `browse` show the version `list` and `info` show (ENTRYVER-01)
- [ ] **GLK-08**: A tag-ref reinstall with a warm mirror resolves the tag offline (LCORCH-01 b5)

### Background autoupdate (AUP)

- [ ] **AUP-01**: With autoupdate on for a marketplace, a session refreshes that marketplace and updates its installed plugins in the background after a delay, as Claude Code does, without blocking or racing a foreground command (AUTOUP-01)
- [ ] **AUP-02**: The default autoupdate setting per marketplace and the operator opt-outs match Claude Code, mapped to Pi where Pi lacks the concept, with each mapping recorded (AUTOUP-01)
- [ ] **AUP-03**: When a background update changed anything, the user gets one passive notice that names what changed and the `/reload` step (AUTOUP-01)

### Plugin package dependencies (PKD)

- [ ] **PKD-01**: Installing or updating a plugin whose root ships `package.json` and a supported lockfile runs the same frozen, script-free, time-bounded install Claude Code runs, in the staged copy (PKGDEP-01)
- [ ] **PKD-02**: A failed, timed-out, or skipped package install degrades the plugin with a warning and never blocks it (PKGDEP-01)
- [ ] **PKD-03**: NFR-5 and the process-spawn rules are amended with a recorded ID for the package install (PKGDEP-01)

### Tests and harness (TST)

- [ ] **TST-01**: Every open LCTEST-01 scenario and unit gap has a scenario or unit case, or is recorded as unit-only by a harness limit (LCTEST-01)
- [ ] **TST-02**: The LCHARN-01 harness items are fixed: clone listing, data-directory listing, unknown run tokens, the rules-doc conflict, the unpinned-mirror revision, the `list` filter fixture, and the `browse` fixed waits; the network guard is built or recorded as declined (LCHARN-01)
- [ ] **TST-03**: `install-flow.test.ts`'s `conflictingMarketplaceRecord` fixture has a loadable manifest, through a seeding helper that writes a record and its manifest together (TEST-PHANTOMMP-01)

### Cleanup and docs (CLN)

- [ ] **CLN-01**: The LCCODE-01 dead code, optional fields, duplicates, misplacements, the `prototypeReads` pin, and the over-long literals are fixed (LCCODE-01 b1, b4, b5, b8-b11)
- [ ] **CLN-02**: `orchestrators/plugin/install-flow.ts` is split so no module passes the size the project's other split verbs keep (UPDDEP-01 b7)
- [ ] **CLN-03**: CHANGELOG, the PRD, the output catalog, stale comments, the feature descriptions, and PROJECT.md decision rows match the shipped behavior (LCDOC-01)
- [ ] **CLN-04**: Every lifecycle backlog entry this milestone settles is closed in `BACKLOG.md` with its disposition

## Future Requirements

None.

## Out of Scope

| Item | Reason |
|------|--------|
| PSRC-01 (`npm` and `archive` plugin sources) | A new acquisition subsystem, not lifecycle behavior of existing sources |
| USRCFG-01 (`userConfig`) | Plugin configuration with no Pi primitive to build on |
| MIGR-01 (staleness gate in place of migration) | Persistence format work, not a lifecycle command |
| NAMEFOLD-01 (case-folded name collisions) | Generated-name policy across bridges, not a lifecycle command |
| DBLEMIT-01 (rows print twice in a new session) | A Pi host bug; the fix is a report to Pi |
| Hooks, environment, workflow-engine, and live-canary entries | Not marketplace or plugin lifecycle |
| Entries found already fixed at triage: PDEP-01, PMAN-01, UDISP-01, PENDING-VERDICT-01, TEST-TMPLEAK-01 | Closed in `BACKLOG.md` at milestone start |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WRN-01 | Phase 1 | Pending |
| WRN-02 | Phase 1 | Pending |
| WRN-03 | Phase 1 | Pending |
| WRN-04 | Phase 1 | Pending |
| WRN-05 | Phase 1 | Pending |
| WRN-06 | Phase 1 | Pending |
| WRN-07 | Phase 1 | Pending |
| RCN-01 | Phase 2 | Complete |
| RCN-02 | Phase 2 | Complete |
| RCN-03 | Phase 2 | Complete |
| RCN-04 | Phase 2 | Complete |
| RCN-05 | Phase 2 | Complete |
| RCN-06 | Phase 2 | Complete |
| RCN-07 | Phase 2 | Complete |
| RCN-08 | Phase 2 | Complete |
| CAS-01 | Phase 3 | Pending |
| CAS-02 | Phase 3 | Pending |
| CAS-03 | Phase 3 | Pending |
| CAS-04 | Phase 3 | Pending |
| CAS-05 | Phase 3 | Pending |
| CAS-06 | Phase 3 | Pending |
| CAS-07 | Phase 3 | Pending |
| RSV-01 | Phase 4 | Pending |
| RSV-02 | Phase 4 | Pending |
| RSV-03 | Phase 4 | Pending |
| RSV-04 | Phase 4 | Pending |
| RSV-05 | Phase 4 | Pending |
| MKT-01 | Phase 5 | Pending |
| MKT-02 | Phase 5 | Pending |
| MKT-03 | Phase 5 | Pending |
| MKT-04 | Phase 5 | Pending |
| MKT-05 | Phase 5 | Pending |
| MKT-06 | Phase 5 | Pending |
| MKT-07 | Phase 5 | Pending |
| MKT-08 | Phase 5 | Pending |
| MIM-01 | Phase 6 | Pending |
| MIM-02 | Phase 6 | Pending |
| MIM-03 | Phase 6 | Pending |
| MIM-04 | Phase 6 | Pending |
| GLK-01 | Phase 7 | Pending |
| GLK-02 | Phase 7 | Pending |
| GLK-03 | Phase 7 | Pending |
| GLK-04 | Phase 7 | Pending |
| GLK-05 | Phase 7 | Pending |
| GLK-06 | Phase 7 | Pending |
| GLK-07 | Phase 7 | Pending |
| GLK-08 | Phase 7 | Pending |
| AUP-01 | Phase 8 | Pending |
| AUP-02 | Phase 8 | Pending |
| AUP-03 | Phase 8 | Pending |
| PKD-01 | Phase 9 | Pending |
| PKD-02 | Phase 9 | Pending |
| PKD-03 | Phase 9 | Pending |
| TST-01 | Phase 10 | Pending |
| TST-02 | Phase 10 | Pending |
| TST-03 | Phase 10 | Pending |
| CLN-01 | Phase 11 | Pending |
| CLN-02 | Phase 11 | Pending |
| CLN-03 | Phase 11 | Pending |
| CLN-04 | Phase 11 | Pending |

**Coverage:** 60 requirements, 60 mapped, 0 unmapped.
