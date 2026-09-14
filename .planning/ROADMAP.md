# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **v1.20 transitive-dependencies** — Phases 1-5 (planning opened 2026-09-09, branch `features/manifest`) — record how each installed plugin got there so `uninstall --prune` can remove the ones nothing needs any more, and close the two adjacent gaps that land on the same surfaces
- ✅ **refine-unit-tests — Refine Unit Tests** — Phases 1-9 (shipped 2026-09-13) — full detail: [`milestones/refine-unit-tests-ROADMAP.md`](milestones/refine-unit-tests-ROADMAP.md)
- ✅ **v1.19 Unit Test Refactor** — Phases 108-117 (completed 2026-09-04) — full detail: [`milestones/v1.19-ROADMAP.md`](milestones/v1.19-ROADMAP.md)

Earlier milestones are recorded in [`.planning/MILESTONES.md`](MILESTONES.md);
each one's full phase detail is archived under
[`.planning/milestones/`](milestones/).

## Phases

### In progress v1.20 transitive-dependencies

**Phase numbering:** this milestone restarts the counter at 1 (operator decision,
2026-09-09). Phases 1-117 belong to archived milestones and live under
`.planning/milestones/`; inside this section a bare phase number always means a
v1.20 phase. Decimal phases (2.1, 3.1) are urgent insertions only, marked
`INSERTED`.

- [x] **Phase 1: Manifest read fidelity** — open the manifest where it actually sits and stop discarding what it says. A bare `<pluginRoot>/plugin.json` is read at both call sites that hardcode the wrapped path, `"./skills/"` and `skills` collapse to one component path so the fallback does not enumerate a directory twice, and `info` renders object-shaped `{name, version, marketplace}` dependency entries instead of filtering them out. Independent of the dependency machinery; the cheapest phase in the milestone. (MANF-01, MANF-02, MANF-03, MANF-04, MANF-05, DEPS-01, DEPS-02) (completed 2026-09-14)
- [ ] **Phase 2: Uninstall data disposition and the uninstall option seam** — `uninstall --keep-data` preserves the plugin's data directory; without it the directory is deleted with no prompt, including on the reconcile path that carries no command line. This phase also establishes the single seam through which a per-invocation uninstall option is parsed, carried into `uninstallPlugin()` and defaulted for callers with no command line, so `--prune` joins an existing structure in Phase 5 rather than a second mechanism being invented for it. Independent of the dependency work. (DATA-01, DATA-02, DATA-03)
- [ ] **Phase 3: Dependency resolution** — installing a plugin installs what it declares it needs, retiring the PI-13 / PR-5 no-auto-resolution decision. Marketplace attribution, a stated version-constraint grammar, cycle termination, no reinstall of what is already there, and a named failure that leaves nothing half-materialized. Maps onto the existing `orchestrators/import/` cascade and the `orchestrators/plugin/bootstrap.ts` composer rather than adding a second cascade beside them. (RESV-01, RESV-02, RESV-03, RESV-04, RESV-05, RESV-06)
- [ ] **Phase 4: Install provenance** — each install record states whether the user asked for the plugin by name or another plugin declared it, with the promotion and retention rules that keep the two from overwriting each other, and a pre-milestone record reported as stale rather than silently repaired. This is the record `--prune` reads. (PROV-01, PROV-02, PROV-03, PROV-04)
- [ ] **Phase 5: Prune on uninstall** — `uninstall --prune` removes the dependency-installed plugins no remaining plugin declares, never a directly-installed one and never a still-needed one, and says which ones it removed. The uninstall flag surface closes here at exactly the two flags upstream defines. (PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04, FLAG-01)

**Settled going in.** These are decided; planning should not reopen them.

1. **PI-13 / PR-5 are retired, not worked around.** The standing no-auto-resolution
   scope decision is superseded by the RESV requirements. Every surface that
   documents "install dependencies manually" is stale from Phase 3 onward.
2. **All RESV and PROV test data is synthetic, and its shapes come from upstream.**
   290 of 292 official-marketplace manifests were checked at the shas their
   `marketplace.json` entries pin. Exactly one (`salesforce-development`) carries a
   `dependencies` key at all, and its value is `[]`. There is no in-the-wild fixture
   to characterize against, so pin the accepted element shapes from the installed
   Claude Code binary rather than inventing a plausible sample.
3. **No `-y` / `--yes`, no `--delete-data`, no size prompt before deleting data.**
   Each is recorded with its reason in the REQUIREMENTS.md Out of Scope table. The
   `--keep-data` / `--delete-data` mutex belongs to the competitor's model, not
   upstream's.
4. **MANF-01 and MANF-03 are one change, not two.** MANF-01 without a normalized
   dedup key is a net output regression on exactly the plugins it exists to rescue:
   reading the four known bare manifests enumerates one skills directory twice,
   emitting 8 spurious duplicate-skill warnings for `ui5` and 2 for
   `ui-theme-designer`. They share Phase 1 so no phase boundary ships that.

**Open decisions.** Each names the discuss session that must settle it.

1. **The version-constraint grammar (RESV-03) — Phase 3 discuss.** There is no
   semver library in the dependency tree, and PL-5 compares versions as strings
   deliberately. RESV-03 needs either a new runtime dependency or a documented
   constraint subset with a stated refusal for anything outside it. Decide; do not
   assume semver is available.
2. **Where a dependency-installed plugin stands relative to `claude-plugins.json` —
   Phase 3 discuss.** `buildUninstallBucket` (`orchestrators/reconcile/plan.ts:352`)
   uninstalls every recorded plugin the merged declared config does not name. So a
   cascade install that is not reconciled with that config is removed on the next
   `/reload`; a cascade install written in as an ordinary declared entry makes the
   config and `--prune` disagree about who owns it. RESV-01 is not delivered until a
   dependency survives a reload, so this cannot wait for Phase 4.
3. **What a stale record's notification says and which command it points at
   (PROV-04) — Phase 4 discuss.** This is MIGR-01's own unresolved design question,
   scoped down to the "stale state, absent config" wording and recovery command.
   Answer that much and no more; MIGR-01's deletion of `persistence/migrate.ts` and
   replacement of `migrate-config.ts` stay in the backlog.
4. **`--prune`'s value on the reconcile path — Phase 5 discuss.**
   `applyPluginUninstalls()` (`orchestrators/reconcile/apply.ts`) runs from
   `resources_discover` / `session_start` with no command line, so it takes the
   default. State that default and hold it there. The alternative is one operation
   with two behaviors depending on which entry point reached it — the same trap
   DATA-02 and DATA-03 agree in order to avoid.

<details>
<summary>✅ v1.19 Unit Test Refactor (Phases 108-117) — completed 2026-09-04</summary>

Every production TypeScript module now has exactly one mirrored owner test that
imports it directly. 204 pairs, corresponding-test gate at zero violations.

- [x] Phase 108: Domain and Platform (24/24 plans) — completed 2026-08-29
- [x] Phase 109: Shared Contracts (19/19 plans) — completed 2026-08-29
- [x] Phase 110: Persistence and Transaction (12/12 plans) — completed 2026-08-30
- [x] Phase 111: Non-Hook Component Bridges (31/31 plans) — completed 2026-08-30
- [x] Phase 112: Hook Runtime (31/31 plans) — completed 2026-08-31
- [x] Phase 113: Orchestrator Support and Presenters (35/35 plans) — completed 2026-09-01
- [x] Phase 114: Plugin and Marketplace Lifecycle (17/17 plans) — completed 2026-09-01
- [x] Phase 115: Composition Orchestrators (8/8 plans) — completed 2026-09-02
- [x] Phase 116: Edge Surface (31/31 plans) — completed 2026-09-03
- [x] Phase 117: Extension Entry and Final Gate (12/12 plans) — completed 2026-09-04

**Archive:** [`milestones/v1.19-ROADMAP.md`](milestones/v1.19-ROADMAP.md) ·
[`milestones/v1.19-REQUIREMENTS.md`](milestones/v1.19-REQUIREMENTS.md) ·
[`milestones/v1.19-MILESTONE-AUDIT.md`](milestones/v1.19-MILESTONE-AUDIT.md)

</details>

## Phase Details

### Phase 1: Manifest read fidelity

**Goal**: Everything a plugin's `plugin.json` declares reaches the user. Two things are silently discarded today, both on the read path of the same file: a manifest sitting at the bare `<pluginRoot>/plugin.json` is never opened, and an object-shaped `{name, version, marketplace}` dependency entry is filtered out before `info` renders it. Neither defect needs any of the dependency machinery this milestone builds, and both precede it in the plain sense that a declaration nobody can read is a declaration nobody can resolve.

**Depends on**: Nothing. First phase, and independent of every other phase in the milestone.

**Requirements**: MANF-01, MANF-02, MANF-03, MANF-04, MANF-05, DEPS-01, DEPS-02

**Success Criteria** (what must be TRUE):

1. A plugin whose only manifest is a bare `<pluginRoot>/plugin.json` has that manifest honored, and the two independent readers agree on which file they read — `domain/resolver.ts::readManifest` and `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1 each build the wrapped path on their own today, so a fallback added to one and not the other makes them disagree about where a plugin's manifest is. (MANF-01)
2. A plugin shipping both locations resolves from `.claude-plugin/plugin.json`; the bare file cannot change the outcome. (MANF-02)
3. Installing a plugin that declares `"./skills/"` and also ships a conventional `skills/` directory emits no duplicate-skill warning — one normalized component path, one enumeration. Verified against the two plugins where the raw relative-path dedup key would otherwise bite: `ui5` (8 skill directories, so 8 spurious warnings) and `ui-theme-designer` (2). (MANF-03)
4. A malformed bare `plugin.json` resolves `(unavailable)` carrying the existing `malformed plugin.json:` reason instead of being skipped, and a plugin with no manifest at either location still installs — the absent-manifest miss stays non-fatal. (MANF-04, MANF-05)
5. `info` on a plugin whose `dependencies` array mixes bare strings with `{name, version, marketplace}` objects lists every element with its version constraint; nothing is dropped. (DEPS-01, DEPS-02)

**Plans**: 4/4 plans complete

- [x] `01-01-PLAN.md` — the ordered manifest candidate list, and both hardcoded manifest readers rewired to it (wave 1; MANF-01, MANF-02, MANF-04, MANF-05)
- [x] `01-02-PLAN.md` — the dependency element parser, the `info` render with its constraint parenthetical, and the new catalogued byte form (wave 1; DEPS-01, DEPS-02)
- [x] `01-03-PLAN.md` — component-path normalization plus the same-resolved-directory skill dedup that keeps MANF-01 from being a net output regression (wave 2, after 01-01; MANF-03)
- [x] `01-04-PLAN.md` — `info` sources dependencies from the plugin's own `plugin.json` when readable offline, with the marketplace entry as the fallback (wave 2, after 01-01 and 01-02; DEPS-01, DEPS-02)

**Notes.** This phase closes `PMAN-01` and the display half of `PDEP-01`. PMAN-01 is a parity gap with no in-the-wild victim in the official marketplace today — the convention probe in `collectStrictComponentKind` already yields the same skill set the four bare-manifest plugins declare, their declared versions are unreachable because a resolved sha replaces the whole version ladder for git-subdir sources, and the manifest `description` is consumed nowhere in `extensions/`. That is why it is a safe warm-up rather than a blocker. PDEP-01's separate still-open question — whether the dependency note should also reappear on `install` and `list` — is not in this milestone: DEPS-01 and DEPS-02 both name `info` and only `info`.

### Phase 2: Uninstall data disposition and the uninstall option seam

**Goal**: `uninstall` stops destroying a plugin's data directory with no way to opt out. `--keep-data` preserves it; without the flag the directory is still deleted, still without a prompt, at both entry points. The phase also establishes the seam this milestone's second uninstall flag will join: one place where a per-invocation uninstall option is parsed, carried into `uninstallPlugin()`, and defaulted for the caller that has no command line. That is the design-once answer to why the two uninstall flags share a milestone — the surface is built here, with the first flag; the second flag is an entry in it, not a new mechanism beside it.

**Depends on**: Nothing. It needs no dependency data, so it is free to run at any point before Phase 5, which extends the seam it builds.

**Requirements**: DATA-01, DATA-02, DATA-03

**Success Criteria** (what must be TRUE):

1. `uninstall --keep-data <plugin>` removes the plugin's artifacts and its installation record but leaves the plugin's data directory under `<scopeRoot>/pi-claude-marketplace/data/` on disk with its contents intact. (DATA-01)
2. `uninstall <plugin>` with no flag deletes the data directory and prompts for nothing. (DATA-02)
3. Dropping a plugin from `claude-plugins.json` and reloading deletes its data directory too, because the reconcile path carries no command line and therefore takes the promptless default. The operation has one behavior at both entry points. (DATA-03)
4. `uninstall` documents `--keep-data` in its usage text and offers it in completions, and rejects `--delete-data` and `-y` as unknown flags. Neither exists upstream; adopting either would import a model this milestone recorded as the wrong one to copy.

**Plans**: TBD

**Notes.** Closes `UDISP-01`. No cross-scope data check: `dataRoot` is already per-scope (`persistence/locations.ts`), so a user-scope uninstall cannot reach project-scope data and the data-loss case upstream's cross-scope check defends against cannot arise here. A GC sweep for data directories retained by `--keep-data` is a separate follow-on, not a blocker — keeping is opt-in under this model, so it is not a default-driven accumulation path.

### Phase 3: Dependency resolution

**Goal**: Installing a plugin installs what it declares it needs. This supersedes the PI-13 / PR-5 no-auto-resolution decision rather than working around it. The cascade maps onto the machinery that already exists — `orchestrators/import/` cascade-installs an entire config with per-entry outcomes, and `orchestrators/plugin/bootstrap.ts` is an existing composer — instead of a second cascade being introduced beside them.

**Depends on**: Phase 1. A dependency declared in a bare `plugin.json` cannot be seen until MANF-01 opens that file, so a cascade built first would silently miss exactly the plugins Phase 1 rescues.

**Requirements**: RESV-01, RESV-02, RESV-03, RESV-04, RESV-05, RESV-06

**Success Criteria** (what must be TRUE):

1. Installing a plugin that declares dependencies leaves those dependencies installed as well, with a per-entry outcome the user can read, and they are still installed after a `/reload`. (RESV-01)
2. A dependency that names a marketplace resolves from that marketplace; one that names none resolves from the depending plugin's marketplace. (RESV-02)
3. A dependency whose version constraint no available plugin satisfies fails the install with a reason naming the constraint, under a version-constraint grammar this milestone states in writing rather than leaves implicit. (RESV-03)
4. A dependency cycle terminates and reports instead of installing forever, and a dependency that is already installed is left alone rather than reinstalled. (RESV-04, RESV-05)
5. A dependency that cannot be installed tells the user which dependency failed and why, leaves no half-materialized plugin behind, and re-running the same command produces the same result. (RESV-06, NFR-3)

**Plans**: TBD

**Notes.** Criterion 1's reload clause is the load-bearing half. `buildUninstallBucket` (`orchestrators/reconcile/plan.ts:352`) plans an uninstall for every recorded plugin the merged declared config does not name, so a cascade install that never reaches `claude-plugins.json` is removed on the next session start and RESV-01 is not actually delivered. Settling that is open decision 2, and it belongs to this phase's discuss because it governs what the cascade writes. The transaction shape is also this phase's problem, not a later one: `withLockedStateTransaction` is not re-entrant (`proper-lockfile`, `retries: 0`), so a cascade that recursively calls the guarded `installPlugin` self-deadlocks — the guard-free ledger bodies (`runInstallLedger`, `runInstallLedgerBody`) exist for exactly this class of caller.

### Phase 4: Install provenance

**Goal**: Each install record states how the plugin got there — the user asked for it by name, or another plugin declared it — together with the rules that keep the two from overwriting each other, and a truthful answer for a record written before the field existed. This is the record `--prune` reads.

**Depends on**: Phase 3.

**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04

**Success Criteria** (what must be TRUE):

1. After installing a plugin that declares dependencies, the persisted state marks the named plugin as directly requested and each installed dependency as having arrived through another plugin. (PROV-01)
2. A plugin the user installed directly stays directly-installed when a later install declares it as a dependency. (PROV-02)
3. A plugin first installed as a dependency becomes directly-installed when the user installs it by name, and no other record changes. (PROV-03)
4. An install record written before this milestone is reported as stale, in wording that names a recovery command, rather than being silently repaired or silently read as a request to uninstall. (PROV-04)

**Plans**: TBD

**Notes.**

- **Why this is adjacent to Phase 3 rather than fused with it.** The two share exactly one branch: the cascade meeting an already-installed dependency must both skip the install (RESV-05) and decline to downgrade that plugin's provenance (PROV-02). They stay separate because provenance is a persistence change with its own pinned gate and its own unresolved wording question, while a cascade is a complete, verifiable capability without it. The order is fixed rather than incidental — until Phase 3's cascade exists, every record's provenance is "explicit" and PROV-01 through PROV-03 have no interesting case to verify. The cost of the split is one forced resync mid-milestone: PROV-01's required field invalidates every record written before it, including records Phase 3 itself wrote. That is PROV-04's own mechanism working as designed, it lands on development trees only, and this milestone releases as a single version.
- **The COMPAT-01 amendment is deliberate.** PROV-01 adds a key to the persisted install record, whose key set `tests/architecture/compat-01-no-expansion.test.ts` pins by enumeration equality — v1.18's no-expansion promise. Tripping that gate is the point of having it: the key set grows only on purpose. Amend the pinned list in this phase, alongside the existing `resolvedSha` / `hookEntries` precedent. Do not loosen the equality assertion into a subset check.
- **A required field is the staleness detector, not a bug.** `enabled` is already required at schemaVersion 2 and above, so a required provenance field makes every pre-existing record fail `STATE_VALIDATOR.Check()` on the raw JSON. That failure is precisely why PROV-04 is phrased as "reported as stale" and not "migrated".
- **Scope of the borrowed MIGR-01 answer.** PROV-04 needs the guard half of MIGR-01 — the notify wording and the recovery command for "stale state, absent config" — and nothing else. Deleting `persistence/migrate.ts` and replacing `migrate-config.ts` stays MIGR-01's own scope in the backlog. Note that `migrate-config.ts` is what currently stops "config file absent" from being read as "uninstall everything" by `reconcile/plan.ts`, so it is not free to touch here.

### Phase 5: Prune on uninstall

**Goal**: `uninstall --prune` removes the dependency-installed plugins that no remaining plugin needs, and nothing else, and says which ones it removed. With it the uninstall flag surface closes at exactly the two extra flags upstream defines.

**Depends on**: Phase 4 (it reads the provenance field) and Phase 2 (it joins the uninstall option seam rather than opening a second one). FLAG-01 can only be satisfied once both flags exist, which is why it lands here and not earlier.

**Requirements**: PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04, FLAG-01

**Success Criteria** (what must be TRUE):

1. `uninstall --prune <plugin>` also removes each dependency-installed plugin that no remaining installed plugin declares. (PRUNE-01)
2. `--prune` never removes a plugin the user installed directly, including one that some other installed plugin also happens to declare as a dependency. (PRUNE-02)
3. `--prune` never removes a dependency while any remaining installed plugin still declares it. (PRUNE-03)
4. The user is told which plugins `--prune` removed. (PRUNE-04)
5. `uninstall` accepts exactly `--keep-data` and `--prune` as its extra flags — the shared `--local` and the global `--scope` unchanged — and the flag-catalog drift guard (`tests/architecture/flag-catalog-drift.test.ts`) pins that set, so a later flag cannot be added silently. (FLAG-01)

**Plans**: TBD

**Notes.** `uninstall`'s handler hard-rejects unknown long flags inline rather than consuming `edge/flag-catalog.ts`, so FLAG-01 has two sides to reconcile: the handler's accepted set and the catalog entry the completions are derived from. Today the catalog lists only the shared write-target flag for `uninstall`. The reconcile path is the other obligation here: `applyPluginUninstalls()` runs from `resources_discover` / `session_start` with no command line and therefore takes `--prune`'s default, whatever open decision 4 settles it to be — and that default must hold there as firmly as DATA-02's does, or the operation acquires two behaviors depending on which entry point reached it.

## Progress

**Execution order:** 1 → 3 → 4 → 5, with 2 free to run at any point before 5.
Phase 1 and Phase 2 are each independent of everything else and of each other;
Phase 1 goes first only because Phase 3 needs it. Phase 2 can be pulled forward
or run alongside the dependency lane, but it must precede Phase 5, which extends
the option seam it builds. Phases 3, 4 and 5 are a strict chain: the cascade
writes the provenance the prune reads.

**Gate for every phase:** `npm run check` stays green — typecheck, ESLint,
`fallow` (dead code, health, duplication), Prettier, unit tests and integration
tests (NFR-6). Disk mutations stay atomic (NFR-1); no fix may require a Pi
restart, `/reload` must suffice (NFR-2); every operation is idempotent or
fail-clean (NFR-3); containment holds (NFR-10); all user-visible output goes
through `shared/notify.ts` (IL-2).

**Planning note:** no phase here is a frontend phase. The UI keyword gate
false-positives on words this milestone uses in their ordinary sense —
"component" paths, the flag "surface", and the `ui5` / `ui-theme-designer`
plugin names — so plan these phases with the UI gate skipped.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Manifest read fidelity | v1.20 | 4/4 | Complete   | 2026-09-14 |
| 2. Uninstall data disposition and the uninstall option seam | v1.20 | 0/— | Not started | — |
| 3. Dependency resolution | v1.20 | 0/— | Not started | — |
| 4. Install provenance | v1.20 | 0/— | Not started | — |
| 5. Prune on uninstall | v1.20 | 0/— | Not started | — |

## Carried Forward

Two things v1.20 inherits from v1.19, both deliberate rather than unfinished:

- **Seven accepted D-116-01a shortfalls** — `edge/args.ts`, `edge/completions/data.ts`,
  `edge/completions/provider.ts`, `edge/handlers/marketplace/update.ts`,
  `edge/handlers/plugin/import.ts`, `edge/handlers/plugin/pending.ts` and
  `edge/handlers/shared.ts` each fall exactly one branch short. Five are
  compiler-forced, two structurally unreachable, and `!`/`as` are barred
  throughout `extensions/`, so each closes only by a production rewrite. They are
  pinned by identity in their own pairs and filed as ledger entries 15-19, 21 and
  22. While any of them stands, `npm run test:coverage:direct:all` exits 1 on a
  clean tree by design.
- **Documentation drift from the relocations** — five ledger entries naming test
  paths that phases 117-02/04/05 vacated, plus `.planning/codebase/TESTING.md`
  and `CONVENTIONS.md` describing the pre-refactor tree. None affects a gate; two
  live under `extensions/`, which phase 117 had no licence to touch.

Full ledger: [`.planning/WINDOWS.md`](WINDOWS.md).
