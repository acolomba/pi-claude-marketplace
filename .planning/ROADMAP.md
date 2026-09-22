# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **v1.20 transitive-dependencies** — Phases 1-12 (planning opened 2026-09-09, branch `features/manifest`; Phases 6-12 added 2026-09-18) — record how each installed plugin got there so `uninstall --prune` can remove the ones nothing needs any more, close the two adjacent gaps that land on the same surfaces, then align the shipped dependency feature with the Claude Code dependency docs
- **test-backlog** — shipped 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — shipped 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — shipped 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

### In progress v1.20 transitive-dependencies

**Phase numbering:** this milestone restarts the counter at 1 (operator decision,
2026-09-09). Phases 1-117 belong to archived milestones and live under
`.planning/milestones/`; inside this section a bare phase number always means a
v1.20 phase. Decimal phases (2.1, 3.1) are urgent insertions only, marked
`INSERTED`.

- [x] **Phase 1: Manifest read fidelity** — open the manifest where it actually sits and stop discarding what it says. A bare `<pluginRoot>/plugin.json` is read at both call sites that hardcode the wrapped path, `"./skills/"` and `skills` collapse to one component path so the fallback does not enumerate a directory twice, and `info` renders object-shaped `{name, version, marketplace}` dependency entries instead of filtering them out. Independent of the dependency machinery; the cheapest phase in the milestone. (MANF-01, MANF-02, MANF-03, MANF-04, MANF-05, DEPS-01, DEPS-02) (completed 2026-09-14)
- [x] **Phase 2: Uninstall data disposition and the uninstall option seam** — `uninstall --keep-data` preserves the plugin's data directory; without it the directory is deleted with no prompt, including on the reconcile path that carries no command line. This phase also establishes the single seam through which a per-invocation uninstall option is parsed, carried into `uninstallPlugin()` and defaulted for callers with no command line, so `--prune` joins an existing structure in Phase 5 rather than a second mechanism being invented for it. Independent of the dependency work. (DATA-01, DATA-02, DATA-03) (completed 2026-09-14)
- [x] **Phase 3: Dependency resolution** — installing a plugin installs what it declares it needs, retiring the PI-13 / PR-5 no-auto-resolution decision. Marketplace attribution, a stated version-constraint grammar, cycle termination, no reinstall of what is already there, and a named failure that leaves nothing half-materialized. Maps onto the existing `orchestrators/import/` cascade and the `orchestrators/plugin/bootstrap.ts` composer rather than adding a second cascade beside them. (RESV-01, RESV-02, RESV-03, RESV-04, RESV-05, RESV-06) (completed 2026-09-15)
- [x] **Phase 4: Install provenance** — each install record states whether the user asked for the plugin by name or another plugin declared it, with the promotion and retention rules that keep the two from overwriting each other, and a pre-milestone record upgraded with a truthful default rather than misreported. This phase also retires the cascade-dependency config write Phase 3 shipped, so the desired-state config names only what the user asked for; provenance is what keeps reconcile from sweeping a dependency once that write is gone. This is the record `--prune` reads. (PROV-01, PROV-02, PROV-03, PROV-04) (completed 2026-09-16)
- [x] **Phase 5: Prune on uninstall** — `uninstall --prune` removes the dependency-installed plugins no remaining plugin declares, never a directly-installed one and never a still-needed one, and says which ones it removed. The uninstall flag surface closes here at exactly the two flags upstream defines. (PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04, PRUNE-05, FLAG-01) (completed 2026-09-16)

**Parity extension (added 2026-09-18).** Phases 1-5 shipped as PR #198 and
passed the milestone audit. A doc-vs-shipped comparison against the Claude
Code dependency docs (binary 2.1.267) then found thirteen divergences; nine
are aligned by Phases 6-12, three are kept with their reason, one is skipped.
The decision table is `.planning/HANDOFF-upstream-dependency-parity.md`. The
operator chose to extend this milestone rather than open a new one, and to
lead with the load-time check: Phase 7's no-matching-tag fallback, Phase 8's
"disabled as a consequence" record and Phase 9's failed-install path all land
on the check Phase 6 builds, so shipping any of them first would leave a
constraint silently unchecked for a phase.

- [x] **Phase 6: Load-time dependency check and allowed uninstall** — reconcile checks every installed plugin's declarations against the scope's records; a dependent whose dependency is missing, disabled or out of range is disabled with the upstream remedy, the disable is a recorded consequence reconcile respects until the dependency is satisfied, and `uninstall` stops refusing a still-needed plugin: it proceeds, names the dependents, and leaves them to the check. Retires PRUNE-05 / D-05-14..16 and the reload-path refusal. (LOAD-01, LOAD-02, LOAD-03) (completed 2026-09-19)
- [x] **Phase 7: Marketplace-repository tag resolution for path-source dependencies** — a constrained dependency whose marketplace entry is a relative path resolves against the marketplace repository's `{name}--v{version}` tags, read from the local clone offline; no satisfying tag installs the current copy and defers to Phase 6's check. Also records the kept `sha` divergence. (TAGS-01, TAGS-02, TAGS-03, DIVG-01) (completed 2026-09-19)
- [x] **Phase 8: Enablement parity for dependencies** — `enable` cascades to declared dependencies and lists them, `disable` is refused while an enabled dependent needs the plugin and names the dependents to disable first (D-08-01), and a cascade enables a disabled already-installed dependency through its record instead of skipping it. Closes BACKLOG ENBL-DEP-01. (EDEP-01, EDEP-02, EDEP-03) (completed 2026-09-21)
- [x] **Phase 9: Reload installs missing declared dependencies** — a reload installs any declared dependency an installed plugin lacks, through the cascade with provenance `dependency`; a dependency that cannot be installed is reported on its own row and the dependent falls to Phase 6's check. (MISS-01, MISS-02) (completed 2026-09-22)
- [ ] **Phase 10: Constraint-aware update** — `update` and `autoupdate` move a constrained plugin only to the highest version every installed dependent's range accepts, and skip-and-report when none does, naming the constraining plugin. (UPDT-01, UPDT-02)
- [ ] **Phase 11: Cross-marketplace dependency allowlist** — a dependency in another marketplace is refused unless the root marketplace's `marketplace.json` lists it in `allowCrossMarketplaceDependenciesOn`; an already-installed dependency still satisfies. (XMKT-01, XMKT-02)
- [ ] **Phase 12: Standalone prune with dry-run** — `prune` sweeps the scope's orphaned dependency-installed plugins without uninstalling anything else, `--dry-run` shows the sweep without running it, and the flag surface closes at `--dry-run` alone (no prompt, no `-y`). Closes BACKLOG PRUNE-CMD-01. (PRUNE-06, PRUNE-07, FLAG-02)

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
2. ~~**Where a dependency-installed plugin stands relative to
   `claude-plugins.json` — Phase 3 discuss.**~~ **SETTLED, then reversed.** Phase 3
   answered it by writing every cascade dependency into the declared config, which
   is what stops `buildUninstallBucket` sweeping it on the next `/reload`. D-04-02
   ruled that wrong: the desired-state config holds ONLY explicitly-requested
   plugins. Phase 4 retires the write and makes provenance the thing reconcile
   respects instead, in a fixed order (field → exemption → removal). The second
   horn of the original question — "the config and `--prune` disagree about who owns
   it" — is exactly the conflation that reversal removes.
3. ~~**What a stale record's notification says and which command it points at
   (PROV-04) — Phase 4 discuss.**~~ **SETTLED in the opposite direction.** D-04-03
   makes the upgrade SILENT — a legacy record is back-filled `"explicit"` before
   validation, on the `enabled` / ENBL-02 precedent — so there is no notification
   and no recovery command to word. PROV-04 was reworded to match (D-04-06). The
   "stale state, absent config" wording returns to MIGR-01 in the backlog intact,
   alongside the `persistence/migrate.ts` deletion; this milestone borrows nothing
   from it.
4. ~~**`--prune`'s value on the reconcile path — Phase 5 discuss.**~~ **SETTLED.**
   D-05-08: reconcile NEVER prunes. The flag's absent value is "no prune" and
   `applyPluginUninstalls()` takes it exactly as it takes DATA-03's delete
   default — one behavior at both entry points. Orphaned `"dependency"` records
   survive `/reload` (D-04-05 stays unconditional) and are removed only by an
   explicit `uninstall … --prune`. The operator first chose a standing sweep
   and reversed it once the two-behaviors, wider-promptless-deletion, and
   fail-closed-on-every-reload consequences were laid out (see
   `.planning/phases/05-prune-on-uninstall/05-CONTEXT.md`).

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

<details>
<summary>test-backlog (Phases 1-8) — shipped 2026-09-18</summary>

- [x] Phase 1: Reliable Negative Controls (2/2 plans) — completed 2026-09-14
- [x] Phase 2: Sonar Rules for Tests (1/1 plans) — completed 2026-09-14
- [x] Phase 3: Reachable Agent Collision Contract (4/4 plans) — completed 2026-09-14
- [x] Phase 4: Strict Command Arguments (3/3 plans) — completed 2026-09-14
- [x] Phase 5: Production Export Ownership (28/28 plans) — completed 2026-09-15
- [x] Phase 6: Unused Type Member Gate (17/17 plans) — completed 2026-09-17
- [x] Phase 7: Reliable Coverage Metrics (8/8 plans) — completed 2026-09-18
- [x] Phase 8: Final Verification and Reconciliation (2/2 plans) — completed 2026-09-18

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

**Plans**: 2/2 plans executed

**Wave 1**

- [x] 02-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md

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

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: the dependency cascade end to end on the unconstrained path, plus the closure walk's cycle, diamond, already-installed and unadded-marketplace edges and the all-or-nothing rollback footprint (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — `semver` as a declared runtime dependency and the pure cross-manifest range intersection and satisfaction algebra (wave 2)
- [x] 03-03-PLAN.md — The NFR-5 network-policy amendment, the corrected ledger-consumer claim, and the written version-constraint grammar (wave 2)
- [x] 03-07-PLAN.md — The plugin-manifest-first dependency declaration read, so a dependency declared only in a bare plugin manifest is visible to the cascade (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-04-PLAN.md — Remote tag listing through the single git chokepoint and the network-legal tag probe, behind a one-way decision gate (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-05-PLAN.md — Constraint resolution wired into the cascade, including the already-installed conflict check (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-06-PLAN.md — The closed reason-vocabulary amendment and per-member cascade reporting (wave 5)

**Notes.** Criterion 1's reload clause is the load-bearing half. `buildUninstallBucket` (`orchestrators/reconcile/plan.ts:352`) plans an uninstall for every recorded plugin the merged declared config does not name, so a cascade install that never reaches `claude-plugins.json` is removed on the next session start and RESV-01 is not actually delivered. Settling that is open decision 2, and it belongs to this phase's discuss because it governs what the cascade writes. The transaction shape is also this phase's problem, not a later one: `withLockedStateTransaction` is not re-entrant (`proper-lockfile`, `retries: 0`), so a cascade that recursively calls the guarded `installPlugin` self-deadlocks — the guard-free ledger bodies (`runInstallLedger`, `runInstallLedgerBody`) exist for exactly this class of caller.

### Phase 4: Install provenance

**Goal**: Each install record states how the plugin got there — the user asked for it by name, or another plugin declared it — together with the rules that keep the two from overwriting each other, and a truthful answer for a record written before the field existed. This is the record `--prune` reads.

**Depends on**: Phase 3.

**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04

**Success Criteria** (what must be TRUE):

1. After installing a plugin that declares dependencies, the persisted state marks the named plugin as directly requested and each installed dependency as having arrived through another plugin. (PROV-01)
2. A plugin the user installed directly stays directly-installed when a later install declares it as a dependency. (PROV-02)
3. A plugin first installed as a dependency becomes directly-installed when the user installs it by name, and no other record changes. (PROV-03)
4. An install record written before this milestone is upgraded to the current schema with a truthful default, no record is misreported as a dependency, and none is silently read as a request to uninstall. (PROV-04)
5. A cascade-installed dependency survives `/reload` without being declared in `claude-plugins.json` — the desired-state config names only plugins the user asked for, and reconcile keeps a dependency because its record says so. (D-04-02, D-04-04, D-04-05)

**Plans**: 6/6 plans executed

- [x] 04-01-PLAN.md
- [x] 04-02-PLAN.md
- [x] 04-03-PLAN.md
- [x] 04-04-PLAN.md
- [x] 04-05-PLAN.md
- [x] 04-06-PLAN.md

Six waves, strictly sequential: every plan touches files an earlier one changed, and D-04-04's three-step order is a correctness contract rather than a preference. Step 2 is wave 4 and step 3 is wave 5; the ordering lives in `depends_on`, not only in prose.

- [ ] `04-01-PLAN.md` — the provenance field end to end: schema, schemaVersion 3, every write site, the cascade decision site, and the silent migrate fill (wave 1; PROV-01, PROV-04)
- [ ] `04-02-PLAN.md` — the four architecture pins amended by equality, and the persistence contracts re-established at schemaVersion 3 (wave 2; PROV-01, PROV-04)
- [ ] `04-03-PLAN.md` — the fixture sweep back to a green gate, and PROV-02's whole-record ratchet proof (wave 3; PROV-01, PROV-02)
- [ ] `04-04-PLAN.md` — step 2: `buildUninstallBucket`'s single dependency exemption, with its negative control (wave 4; PROV-01)
- [ ] `04-05-PLAN.md` — step 3: both config-write arms retired, their parameters removed, the reload survival proven through `applyReconcile`, and the docs rewritten (wave 5; PROV-01, PROV-02)
- [ ] `04-06-PLAN.md` — PROV-03's promotion on the mutating arm, plus the nine catalog surfaces D-04-07 amends (wave 6; PROV-03)

**Notes.**

- **Why this is adjacent to Phase 3 rather than fused with it.** The two share exactly one branch: the cascade meeting an already-installed dependency must both skip the install (RESV-05) and decline to downgrade that plugin's provenance (PROV-02). They stay separate because provenance is a persistence change with its own pinned gate and its own unresolved wording question, while a cascade is a complete, verifiable capability without it. The order is fixed rather than incidental — until Phase 3's cascade exists, every record's provenance is "explicit" and PROV-01 through PROV-03 have no interesting case to verify. The cost of the split is one forced resync mid-milestone: PROV-01's required field invalidates every record written before it, including records Phase 3 itself wrote. That is PROV-04's own mechanism working as designed, it lands on development trees only, and this milestone releases as a single version.
- **The COMPAT-01 amendment is deliberate.** PROV-01 adds a key to the persisted install record, whose key set `tests/architecture/compat-01-no-expansion.test.ts` pins by enumeration equality — v1.18's no-expansion promise. Tripping that gate is the point of having it: the key set grows only on purpose. Amend the pinned list in this phase, alongside the existing `resolvedSha` / `hookEntries` precedent. Do not loosen the equality assertion into a subset check.
- **SUPERSEDED by D-04-03 — a required field is NOT the staleness detector here.** The original reasoning was that `enabled` is required at schemaVersion 2 and above, so a required provenance field would make every pre-existing record fail `STATE_VALIDATOR.Check()`, and that failure would be PROV-04's "reported as stale" mechanism. The discussion settled on the opposite: provenance is required at schemaVersion 3 AND back-filled with `"explicit"` in `persistence/migrate.ts` before the check runs, exactly as `enabled` itself is. A required field with a migrate fill detects nothing and reports nothing — which is the intent. See `.planning/phases/04-install-provenance/04-CONTEXT.md` D-04-03.
- **SUPERSEDED by D-04-06 — nothing is borrowed from MIGR-01.** PROV-04 was reworded to match the silent upgrade, so it emits no stale-state report and needs no recovery-command wording. The notify text and recovery command for "stale state, absent config" returns to MIGR-01 in the backlog, alongside the `persistence/migrate.ts` deletion. `migrate-config.ts` — which is what currently stops "config file absent" from being read as "uninstall everything" by `reconcile/plan.ts` — stays untouched by this phase either way.
- **The desired-state config reversal lands here, in a fixed order.** Phase 3's CR-01 fix writes every cascade-installed dependency into `claude-plugins.json`. D-04-02 rules that wrong: the desired-state config names only plugins the user asked for. Phase 4 retires that write, in the order provenance field → reconcile skips `provenance: "dependency"` → remove the write. That order is a correctness contract, not a preference: the config write is currently the only thing stopping `buildUninstallBucket` from sweeping dependencies on the next `resources_discover`. Phase 3 stays closed and verified; its artifacts describe the config write as correct and are superseded on this point only.

### Phase 5: Prune on uninstall

**Goal**: `uninstall --prune` removes the dependency-installed plugins that no remaining plugin needs, and nothing else, and says which ones it removed. With it the uninstall flag surface closes at exactly the two extra flags upstream defines.

**Depends on**: Phase 4 (it reads the provenance field) and Phase 2 (it joins the uninstall option seam rather than opening a second one). FLAG-01 can only be satisfied once both flags exist, which is why it lands here and not earlier.

**Requirements**: PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04, PRUNE-05, FLAG-01

**Success Criteria** (what must be TRUE):

1. `uninstall --prune <plugin>` also removes each dependency-installed plugin that no remaining installed plugin declares. (PRUNE-01)
2. `--prune` never removes a plugin the user installed directly, including one that some other installed plugin also happens to declare as a dependency. (PRUNE-02)
3. `--prune` never removes a dependency while any remaining installed plugin still declares it. (PRUNE-03)
4. The user is told which plugins `--prune` removed. (PRUNE-04)
5. `uninstall` accepts exactly `--keep-data` and `--prune` as its extra flags — the shared `--local` and the global `--scope` unchanged — and the flag-catalog drift guard (`tests/architecture/flag-catalog-drift.test.ts`) pins that set, so a later flag cannot be added silently. (FLAG-01)
6. `uninstall <plugin>` refuses to remove a plugin that another installed plugin in the same scope still declares — a disabled declarer included — and names the dependents; nothing is removed, and the load-time reconcile path refuses the same way. (PRUNE-05, folded in during the Phase 5 discussion — D-05-14..16)

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — The dependents guard on both entry points (PRUNE-05): declaration index leaf, refusal inside the lock, `dependents remain` landed in full, reconcile cause line

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — `--prune` on the catalog-owned flag surface (FLAG-01), the pure orphan fixpoint, the whole-scope sweep in the one transaction, `dependency pruned` landed in full (PRUNE-01..04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — Edge-to-sweep end-to-end proof, user docs for prune and the guard, backlog entry for `marketplace remove`, phase gate

**Notes.** `uninstall`'s handler hard-rejects unknown long flags inline rather than consuming `edge/flag-catalog.ts`, so FLAG-01 has two sides to reconcile: the handler's accepted set and the catalog entry the completions are derived from. Today the catalog lists only the shared write-target flag for `uninstall`. The reconcile path is the other obligation here: `applyPluginUninstalls()` runs from `resources_discover` / `session_start` with no command line and therefore takes `--prune`'s default, whatever open decision 4 settles it to be — and that default must hold there as firmly as DATA-02's does, or the operation acquires two behaviors depending on which entry point reached it.

### Phase 6: Load-time dependency check and allowed uninstall

**Goal**: An installed plugin whose declared dependency is missing, disabled or out of range no longer loads as if nothing were wrong: reconcile disables it, says why, and names the remedy. With that check in place `uninstall` can stop refusing a still-needed plugin and report the consequence instead, the way upstream does.

**Depends on**: Phase 5 (the declaration index `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` and the `dependents remain` row it reads) and Phase 4 (records carry `provenance`; the check reads records, never the config).

**Requirements**: LOAD-01, LOAD-02, LOAD-03

**Success Criteria** (what must be TRUE):

1. On `/reload`, an installed plugin whose declared dependency is not installed, is disabled, or has a recorded version outside the declared range is disabled and reported on its own row with the upstream remedy shape — `Install "X" or uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to satisfy R, or uninstall "Y"` — through new closed-set tokens landed on every pin surface. (LOAD-01)
2. The disable is recorded as a consequence, not a user choice: the next reconcile pass neither re-enables the dependent while the dependency stays unsatisfied nor flips it back and forth, and once the dependency is installed, enabled and in range the dependent is enabled again without the user touching the config. (LOAD-02)
3. `uninstall <plugin>` removes a plugin other installed plugins in the scope still declare; the row names the dependents, and each dependent is reported unsatisfied at the next load. The reload-path refusal goes with it. `--prune` semantics are unchanged. (LOAD-03)
4. PRUNE-05's refusal (`assertNoDependents`, D-05-14..16), its `dependents remain` row and the `docs/dependency-resolution.md` §138 "documents this for `disable`; this extension applies it to `uninstall`" sentences are retired, with a decision record superseding D-05-14; BACKLOG `PRUNE-GUARD-MR-01` is re-triaged, since a `marketplace remove` that leaves dependents dangling is now reported by the check rather than needing a guard.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Tracer: an unsatisfied declaration disables its dependent at reload and says why (schema marker, constraint-preserving walk, verdict module with the propagation fixpoint, plan bucket, apply step, row)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — The disabled and out-of-range arms, the lift, and the convergence proof that the disable does not oscillate

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-03-PLAN.md — LOAD-03: uninstall proceeds and names the dependents; the refusal and its vocabulary are retired (carries a blocking decision checkpoint)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-04-PLAN.md — Documentation, the supersession record, and the backlog re-triage

**Notes.** The design point to settle in discuss, before any row is worded: how the "disabled as a consequence" state is persisted so reconcile respects it. The config cannot carry it (D-04-02: the config names only what the user asked for, and enablement there is the user's word), so it is a record-level flag or reason that `orchestrators/reconcile/plan.ts` reads when it buckets enables — and the lift condition (dependency installed, enabled, in range) is the same predicate the check runs. `recordedVersionSatisfies` in `domain/dependency-range.ts` already answers the range half. Interaction with the update family: Phase 10 keeps an update from moving a dependency out of range, so the range arm here fires only on hand-edited records and pre-Phase-10 updates. Owners: `orchestrators/reconcile/plan.ts` / `apply.ts` (new outcome kinds), `orchestrators/plugin/uninstall.ts`, `shared/notification-types.ts` + `notify-reasons.ts` + `docs/output-catalog.md` + `tests/architecture/catalog-uat` for the tokens.

### Phase 7: Marketplace-repository tag resolution for path-source dependencies

**Goal**: A version constraint on a path-source dependency — the common case — resolves the way upstream resolves it: against the marketplace repository's `{name}--v{version}` tags, offline, with a stated fallback when no tag matches.

**Depends on**: Phase 6 (TAGS-02's fallback installs the current copy and relies on the load-time check to catch a copy outside the range; without it the constraint would be silently unchecked) and Phase 3 (the tag probe and the cascade's `probeMemberPin` seam).

**Requirements**: TAGS-01, TAGS-02, TAGS-03, DIVG-01

**Success Criteria** (what must be TRUE):

1. A constrained dependency whose marketplace entry is a relative path is resolved by listing the marketplace clone's tags of the form `{name}--v{version}`, selecting the highest that satisfies the constraint, with no network access (`list`, `info`, `uninstall` unaffected; install on a warm clone stays offline — NFR-5). (TAGS-01)
2. When no tag satisfies, the install proceeds with the marketplace's current copy and the row says so; the constraint is then checked at load by Phase 6 rather than failing the install with `{no matching version}`. (TAGS-02)
3. When a tag satisfies, the plugin's files come from the marketplace repository at that tag — not the current checkout — and the record's version reflects it. (TAGS-03)
4. `docs/dependency-resolution.md` says that upstream accepts a `sha` field on a dependency element and that this extension refuses it (D-03-36), next to the divergences it already lists; §"What a version constraint can say" and §path source describe the new resolution. (DIVG-01)

**Plans**: 3 plans

Plans:

- [x] 07-01-PLAN.md — tracer: a constrained path-source dependency installs from the marketplace tag that satisfies it (TAGS-01, TAGS-03)
- [x] 07-02-PLAN.md — no satisfying tag installs the current copy and the row says so (TAGS-02)
- [x] 07-03-PLAN.md — `docs/dependency-resolution.md` records the new resolution and the `sha` divergence (DIVG-01)

**Notes.** `orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags` today lists the *dependency's own source repository* tags over the network; a path source has no such repository, which is why every non-wildcard constraint fails. The marketplace clone is local, so tag listing goes through `platform/git.ts` against the clone (isomorphic-git `listTags`), not the advertised-refs path — and `no-orchestrator-network.test.ts` must keep passing for the gated install owners. Materializing "the plugin at that tag" from a clone whose checkout is at a different commit is the open mechanics question for discuss: a second worktree-like checkout under the plugin's clone root, or reading the tree at the tag oid into the staging directory. Containment (NFR-10) applies either way.

### Phase 8: Enablement parity for dependencies

**Goal**: `enable` and `disable` understand dependencies the way `install` and `uninstall` now do: enabling a plugin enables what it declares, disabling a plugin that an enabled dependent still needs is refused with a plain-English instruction naming the dependents in order (D-08-01: `disable` takes one target, so no chained form exists), and a cascade turns a disabled dependency back on rather than leaving the dependent broken.

**Depends on**: Phase 6 (the "disabled as a consequence" record: an enable cascade must lift it, and EDEP-02's refusal reads the same declaration index) and Phase 4 (D-04-07: promotion re-enables through the enable path; this phase generalises that write).

**Requirements**: EDEP-01, EDEP-02, EDEP-03

**Success Criteria** (what must be TRUE):

1. `enable <plugin>` enables the plugin's declared dependencies, transitively, in the same scope, and lists each one on its own row. (EDEP-01)
2. `disable <plugin>` is refused while an enabled installed plugin in the scope declares it; the refusal names the dependents, in the order to disable them, as a plain-English instruction — not a chained command, since `disable` takes exactly one target (D-08-01). (EDEP-02)
3. Installing or enabling a plugin whose already-installed dependency is disabled enables that dependency through its record — the config never names it (D-04-02) — and reports it on the row with a new closed-set token; RESV-05's `{already installed, dependency disabled}` warning skip is removed from the catalog (fixture, both contract constants, length lock, both enumeration pins), and `docs/plugin-enablement.md` §"Dependencies" is rewritten, not appended, since it argues the divergence this phase reverses. (EDEP-03)
4. BACKLOG `ENBL-DEP-01` is closed by this phase; `DEPS-STATUS-01` (partial dependency degrades the dependent) stays open — it is not upstream parity and is not pulled in here.

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — `enable` cascades to its declared dependency closure and reports every member (EDEP-01, EDEP-03 enable arm)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — `disable` is refused while an installed, enabled plugin in the scope declares it (EDEP-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — the install cascade enables a disabled already-installed dependency and the old skip leaves the catalog (EDEP-03 install arm)

**Notes.** `orchestrators/plugin/enable-disable.ts`'s existing "dependencies" are the soft-dep companion extensions (pi-subagents, pi-mcp-adapter), not plugin dependencies — the naming collision is the first thing the planner should disambiguate. The enable branch already reuses `runInstallLedger` for materialization; the cascade order comes from `domain/dependency-closure.ts`'s post-order. The disable refusal text upstream: `X is still required by A, B. Disable those plugins first, or disable everything together: <chained command>`.

### Phase 9: Reload installs missing declared dependencies

**Goal**: A desired plugin implies its dependencies. A reload that finds an installed plugin missing a declared dependency installs it, the way `install` would have, instead of leaving the dependent to be disabled.

**Depends on**: Phase 6 (a dependency that cannot be installed hands the dependent to the check) and Phase 7 (the cascade's tag probe, which the reload reuses for path sources).

**Requirements**: MISS-01, MISS-02

**Success Criteria** (what must be TRUE):

1. On `/reload`, every declared dependency of an installed plugin that is not installed in the scope is installed through the install cascade with provenance `dependency`, from the marketplace the declaration resolves to (a not-added marketplace is still not auto-added — D-03-08). (MISS-01)
2. When such a dependency cannot be installed, the reload completes, the failure is reported on its own row with its cause, and the dependent is disabled by Phase 6's check with the install remedy; nothing is half-materialized (NFR-1/NFR-3). (MISS-02)
3. A reload with nothing missing installs nothing and stays offline (NFR-5); the new reconcile bucket is exercised by `tests/integration/reconcile-plan-convergence.test.ts` alongside the existing ones.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — the planner's ninth bucket from the verdict's missing arm, the provenance-independent lift, the `{dependency installed}` token on every pin, and the convergence proof (MISS-01, D-09-01/02/05/08/09/16)
- [x] 09-02-PLAN.md — the install cascade's root-range input and disabled-as-wall option (MISS-01, D-09-04/05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-03-PLAN.md — the orchestrated entry point, the reload-only apply step with its re-plan, and `event.reason` threaded from `index.ts`; every failure on the dependency's own row (MISS-01, MISS-02, D-09-03/06/07/10/11/13/14)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — the two-row failure catalog state, the docs, the changelog, the backlog carriers, the type-member pin remap and the full gate (MISS-02)

**Notes.** `orchestrators/reconcile/plan.ts` buckets declared-vs-recorded today; this adds a bucket derived from the declaration index rather than the config, so D-04-02 holds (the config still names only what the user asked for). Upstream also runs this on `marketplace add` and autoupdate; whether Pi's `bootstrap.ts` composer and `marketplace/autoupdate.ts` reach the same reconcile is a planning question, not a requirement.

### Phase 10: Constraint-aware update

**Goal**: An update never moves a dependency out of the range its dependents declare. When every installed dependent's constraints leave room, the update takes the highest version inside it; when they leave none, that plugin's update is skipped and the user is told which plugin is holding it.

**Depends on**: Phase 7 (tag listing on the marketplace clone for path sources; git-source updates already read tags) and Phase 3 (`domain/dependency-range.ts::intersectDependencyRanges`).

**Requirements**: UPDT-01, UPDT-02

**Success Criteria** (what must be TRUE):

1. `update <plugin>`, `update` (all) and `autoupdate` of a plugin that installed plugins in the scope constrain select the highest available version satisfying the intersection of every dependent's range, for both git-source and path-source dependencies. (UPDT-01)
2. When no available version satisfies the intersection, that plugin's update is skipped and reported on its row with a reason naming the constraining plugin(s); the rest of the update proceeds. (UPDT-02)
3. An unconstrained plugin updates exactly as before; the update family stays inside its network policy (warm cache offline; `update-flow.ts` / `update-preflight.ts` remain the only git consumers per `no-orchestrator-network.test.ts`).

**Plans**: 4 plans

Plans:

- [ ] 10-01-PLAN.md — the held row end to end: the constraint gate leaf, its call site in the preflight, the new closed-set token, the `skipped` row's cause channel, and the catalog state (UPDT-02)
- [ ] 10-02-PLAN.md — stage one: probe the plugin's release tags on both source kinds, pin the highest satisfying one through the resolver's own callbacks, record the version the tag names, and bound tag listings to one per repository per run (UPDT-01)
- [ ] 10-03-PLAN.md — stage two: re-check the version that actually landed, hold naming only the rejecting dependents, report the current-copy fallback and the ceiling case, and give the autoupdate cascade the same row (UPDT-01, UPDT-02)
- [ ] 10-04-PLAN.md — amend the dependency documentation and hold it to the code, prove the unconstrained path and the network policy unchanged, and close on a green whole-tree gate (UPDT-01, UPDT-02)

**Notes.** Owners: `orchestrators/plugin/update-flow.ts`, `update-preflight.ts`, `update-swap.ts`, `update-row.ts`, `update.messaging.ts`, `orchestrators/marketplace/autoupdate.ts`. `update-preflight.ts` is the natural place to compute the intersection from the declaration index before the swap decides a target. A version-pinned record already refuses promotion (D-04-07); a pinned record's update is out of scope here as before.

### Phase 11: Cross-marketplace dependency allowlist

**Goal**: A plugin may only pull a dependency from another marketplace when its own marketplace says so, matching the upstream `allowCrossMarketplaceDependenciesOn` field, while a dependency the user already installed by hand keeps satisfying the declaration.

**Depends on**: Phase 3 (the closure walk and its guard order — the D-03-10 record-before-guard note).

**Requirements**: XMKT-01, XMKT-02

**Success Criteria** (what must be TRUE):

1. A dependency that resolves from a marketplace other than the root plugin's is refused with a closed-set reason naming `allowCrossMarketplaceDependenciesOn` unless the root marketplace's `marketplace.json` lists the target marketplace there; the cascade fails clean as it does for any unresolvable dependency (D-03-07). (XMKT-01)
2. A dependency already installed in the scope satisfies the declaration whatever the allowlist says. (XMKT-02)
3. A `marketplace.json` without the field behaves as an empty allowlist; `info` and the cascade read the same parsed value.

**Plans**: 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 11 to break down)

**Notes.** Owners: `domain/manifest.ts` (schema field), `domain/dependency-closure.ts` (the guard slots after the already-installed check and before resolution, per D-03-10), a new closed-set reason on every pin surface. D-03-08 parity holds: upstream never auto-adds a marketplace to satisfy a dependency, and neither does this.

### Phase 12: Standalone prune with dry-run

**Goal**: A user can see and remove the scope's orphaned dependency-installed plugins without uninstalling anything, through a `prune` verb whose flag surface closes at `--dry-run`.

**Depends on**: Phase 5 (`finalizePrunedMembers` and `domain/dependency-orphans.ts::pruneOrphans` are the sweep; this phase gives them an entry point that removes no primary) and Phase 6 (LOAD-03 changed what "orphaned" can mean after an allowed uninstall; the sweep's `provenance: "dependency"` + undeclared predicate is unchanged, but the docs and rows are written after that change).

**Requirements**: PRUNE-06, PRUNE-07, FLAG-02

**Success Criteria** (what must be TRUE):

1. `prune` removes every `provenance: "dependency"` record in the scope that no installed plugin declares, renders each as `(uninstalled) {dependency pruned}`, and removes nothing else; the sweep runs to the same fixpoint `uninstall --prune` reaches, in one locked transaction. (PRUNE-06)
2. `prune --dry-run` renders the same rows as a would-remove listing and mutates nothing on disk or in `state.json`. (PRUNE-07)
3. `prune` accepts exactly `--dry-run` as its extra flag beside the shared scope flags; the flag-catalog drift guard (`tests/architecture/flag-catalog-drift.test.ts`) pins that set, and FLAG-01's `uninstall` set is untouched. No confirmation prompt and no `-y` (REQUIREMENTS Out of Scope). (FLAG-02)
4. BACKLOG `PRUNE-CMD-01` is closed; its `{orphaned}` inventory marker on `list` / `info` is NOT part of this phase (upstream shows none), and is re-filed or dropped in discuss.

**Plans**: 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 12 to break down)

**Notes.** Owners: `edge/router.ts` (new subcommand + completions), `edge/flag-catalog.ts` (amend the FLAG-01 drift guard deliberately — a new `prune` entry, not a change to `uninstall`'s), `orchestrators/plugin/uninstall.ts` (extract the sweep so `prune` reaches it without a primary). `--dry-run` must not open the write lock for nothing: plan the read-only path through the same `pruneOrphans` predicate.

## Progress

**Execution order:** 1 → 3 → 4 → 5, with 2 free to run at any point before 5.
Phase 1 and Phase 2 are each independent of everything else and of each other;
Phase 1 goes first only because Phase 3 needs it. Phase 2 can be pulled forward
or run alongside the dependency lane, but it must precede Phase 5, which extends
the option seam it builds. Phases 3, 4 and 5 are a strict chain: the cascade
writes the provenance the prune reads.

**Parity phases (6-12):** 6 → 7 → {8, 9, 10} → 11 → 12. Phase 6 leads because
7, 8 and 9 each land on its check. Phase 7 precedes 9 and 10 because both reuse
its marketplace-clone tag listing. Phases 8, 9 and 10 are independent of each
other once 6 and 7 are in. Phase 11 is independent of everything after Phase 3
and sits late only because it is the smallest. Phase 12 goes last so its docs
and rows describe the post-LOAD-03 model.

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
| 2. Uninstall data disposition and the uninstall option seam | v1.20 | 2/2 | Complete    | 2026-09-14 |
| 3. Dependency resolution | v1.20 | 7/7 | Complete    | 2026-09-15 |
| 4. Install provenance | v1.20 | 6/6 | Complete    | 2026-09-16 |
| 5. Prune on uninstall | v1.20 | 3/3 | Complete    | 2026-09-16 |
| 6. Load-time dependency check and allowed uninstall | v1.20 | 4/4 | Complete    | 2026-09-19 |
| 7. Marketplace-repository tag resolution for path-source dependencies | v1.20 | 3/3 | Complete    | 2026-09-19 |
| 8. Enablement parity for dependencies | v1.20 | 3/3 | Complete    | 2026-09-21 |
| 9. Reload installs missing declared dependencies | v1.20 | 4/4 | Complete    | 2026-09-22 |
| 10. Constraint-aware update | v1.20 | 0/0 | Not started | — |
| 11. Cross-marketplace dependency allowlist | v1.20 | 0/0 | Not started | — |
| 12. Standalone prune with dry-run | v1.20 | 0/0 | Not started | — |

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
