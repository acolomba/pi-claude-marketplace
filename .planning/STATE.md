---
gsd_state_version: "1.0"
milestone: v1.20
milestone_name: transitive-dependencies
current_phase: 5
current_phase_name: Prune on uninstall
status: planning
stopped_at: Phase 5 context gathered
last_updated: "2026-09-16T20:01:54.442Z"
last_activity: 2026-09-16
last_activity_desc: Phase 04 complete, transitioned to Phase 5
state_head: 189afc3d70f9d24e4a63fe08665a70fb5d21340a
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 19
  completed_plans: 19
  percent: 80
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-14 after manifest verification)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 04 — Install provenance
Installing a plugin that declares dependencies should install what it needs.
25 requirements across 5 phases. v1.19 Unit Test Refactor closed 2026-09-04 and
is archived under `.planning/milestones/v1.19-*`.

## Current Position

Phase: 5 — Prune on uninstall
Plan: Not started
Status: Ready to plan

**Phase 4 closed 2026-09-16**, verified 9/9 must-haves; the one human item
(the promoted row's legibility in a live session) was accepted on the pinned
bytes. Six plans ran in six sequential waves on this checkout (worktree
isolation degraded per #683). Every install record now carries
`provenance: "explicit" | "dependency"` at `state.json` schemaVersion 3,
back-filled `"explicit"` silently for older documents; reconcile keeps a
`"dependency"` record out of its uninstall bucket AND retains a
recorded-but-undeclared marketplace that holds one; Phase 3's cascade config
write is retired, proven load-bearing both ways (reverting the exemption
turned the reload-survival case red); and `install <plugin>` on a
`"dependency"` record promotes it, reporting the new closed-set
`{already installed, dependency promoted}` on an `installed` row.

**The code review took four fix passes to converge** (16 fix commits;
`04-REVIEW-FIX.md`). Three operator rulings shaped them and are recorded in
`04-REVIEW.md` § Operator Decisions: the planner, not the config, keeps a
CMP-3-adopted dependency marketplace alive (D-04-02 stays pure); `import`
naming a dependency record promotes it; and **a plugin asked for by name is
enabled** — promoting a disabled record re-materializes it through the enable
path and stamps `{ enabled: true }` in whichever config file declares its key
(base or local), so the reload its row asks for cannot disable it again. A
version pin refuses promotion, `--partial` is the consent gate for a
partially-installed record, `--map-model` has no bearing.

**Two rulings were deliberately backlogged, not shipped** (`BACKLOG.md`
ENBL-DEP-01, DEPS-STATUS-01): the cascade should ENABLE a disabled,
already-installed dependency (upstream parity; reverses RESV-05's warning
skip), and a plugin whose dependency is partially installed is itself partial
with reasons. Phase 5 must not read either as done.

**What Phase 5 inherits.** `--prune` reads `provenance` and re-derives the
declarer set; nothing remembers who declared what. `plan.ts` sits at
`diffMarketplaces` 14 / `buildUninstallBucket` 13 cognitive after the
`isRetainedRecorded` extraction — one point of headroom less than it had. The
operator's dev tree carries inert pre-milestone residue (04-05-SUMMARY,
Pitfall H) — a `--prune` surprise there is not a prune defect. Executor
commit-shape note for the planner: the `npm-typecheck` and
`npm-coverage-direct` pre-commit hooks reject a red-test or half-swept commit,
so a plan that pairs a production change with its covering tests must expect
them to land as one commit.

**Phase 3 closed 2026-09-15**, verified 5/5 must-haves with both human
verification items run against running systems. A code review found 16 issues
(5 blocker, 8 warning, 3 info); all 13 blocker+warning findings were fixed
across 13 atomic commits, each with a test observed failing against the
unfixed code. The load-bearing defect was CR-01: the cascade never declared
its dependencies on the ORCHESTRATED install path, so `buildUninstallBucket`
would have swept every cascade-installed dependency on the next
`resources_discover` — RESV-01 would have read as satisfied while being false.
Confirmed fixed in a live Pi session: after `/reload`, both dependencies
survived.

Live UAT also settled what no fake transport could: an annotated tag peels to
its commit, a constraint selects over an advertised newer tag, and a no-match
fails WITHOUT falling back to repository head (D-03-09). See `03-UAT.md`.

**Three items carried out of Phase 3.** A SUCCESSFUL credential challenge is
unexercised — `findProviderForHost` matches only github.com and gitlab.com
(PROV-01), so no self-hosted fixture can reach Device Flow; the 401 arm was
verified. WR-05 asked to close or re-scope PDEP-01 / DFEN-V2-01, which still
sit in `BACKLOG.md` and `REQUIREMENTS.md`. And zero of the 297 plugins in
`anthropics/claude-plugins-official` declare dependencies, so the cascade
ships with no real-world consumer today.

**Branching is settled, but the fix is uncommitted.** `config.json` carried
`branching_strategy: milestone` with
`milestone_branch_template: features/{milestone}`, resolving to
`features/v1.20` — a branch that does not exist locally. `handle_branching`
creates a missing milestone branch off `origin/main`, which would have
stranded this milestone's work on `features/manifest`. Phase 3 was immune only
because execute-phase reads config once at init, before that setting arrived
via a merge of origin/main (commit `257f8827`). It is now
`branching_strategy: none` — an agent-made edit deliberately left UNCOMMITTED,
because the same file also carries the operator's own
`model_profile_overrides.codex` edit that should not be bundled in. The
setting reads from disk, so Phases 4-5 honor it either way; do not revert the
file.

Plan 03-06 made the cascade legible. A dependency cascade now renders one row
per closure member beside the requesting plugin's own row, and a cascade that
failed names the DEPENDENCY as the row's subject with a closed-set reason and
its cause — not the plugin the user typed, for something one of its
dependencies did. The closed reason vocabulary grew by exactly seven members
(`no matching version`, `version conflict`, `constraint too complex`,
`invalid version constraint`, `dependency marketplace not added`,
`dependency cycle`, `dependency failed`), each carrying an inline note
recording why no inherited member states the same fact; four of the twelve
outcomes are carried by members that already existed, including the probe's
own transport classification for a listing that could not be read. One token
covers both `version conflict` subjects, separated by `{already installed,
version conflict}` and the recorded version beside it rather than by a second
member. The COMPAT-01 pinned enumeration was amended by equality in the same
commit as the members — not loosened — and the length lock, the owner's own
vocabulary test and both catalog counts moved with it.
`install-cascade.messaging.ts` SPREADS install's render map instead of
restating it, so a no-dependency install's bytes stay frozen and the one added
arm (the RESV-05 skip) is the whole diff. Both interim prose formatters were
deleted rather than extended: `cascadeFailureCause` hands the orchestrator the
SAME Error the row carries. Twelve catalog states record the rendered bytes,
produced by running the composition rather than typed by hand (the file moved
24,145 → 27,100 UTF-8 bytes). RESV-01, RESV-03, RESV-04 and RESV-06 are
Complete. Decision IDs through D-03-35 are allocated; a later plan mints from
D-03-36. One UAT item is open (D10): the block has never been read by an
operator in a live Pi session.
Plan 03-05 is where RESV-03 actually fires. `resolveMemberConstraints` in
`install-cascade.ts` sits between the closure walk and the ledger phase
array, and that position is the whole rollback story: every constraint
verdict is reached before a single `Phase` exists, so no failure arm has
anything to unwind. A member's accumulated ranges are intersected; a real
range selects a release tag through the injected probe and re-pins that
member's install to the tag's commit, carried by the caller's own ledger
options builder into the new `InstallLedgerOptions.sourcePinOverride`, which
routes the EXISTING clone probe down its already-pinned arm. The wildcard
short-circuit keeps the common case offline, and `isUnconstrainedRange`
tests canonicalization rather than string identity — `["*", "x"]` intersects
to `"* *"`, so a string comparison would have turned two authors both
writing "any version" into a network query and, for a source with no release
tags, into a failed install.
RESV-05 is now a check and never a touch: an already-installed dependency is
checked against the constraint before anything else (that check makes no
query, so a cascade that will fail on disk state never reaches a remote), is
left exactly as it was when it satisfies, and fails the whole install naming
both the recorded version and the constraint when it does not. D-03-04 is
upheld unguarded — the two fallback version forms diverge under coercion
(`hash-123456789abc` becomes `123456789.0.0`, `sha-0123456789ab` becomes
nothing at all), which is the unpredictability the decision accepted.
Six constraint discriminants are stable for the messaging plan, all carrying
the member key and a bounded range and no filesystem path. The inherited
census debt is paid: `domain/dependency-range.ts`'s entry is gone and
`install-cascade.ts#resolveMemberConstraints` took its place, justified
inline. The plan's two-file list had to grow: `install-flow.ts` and
`install-outcome.ts` carry the four lines that make the re-pin reach a real
checkout, without which the probe's answer would have stopped at the ledger
options boundary. RESV-05 is Complete; RESV-03 stays Pending because 03-06
also declares it. Decision IDs through D-03-29 are allocated.
Plan 03-04 gave the phase live tag resolution, the one genuinely new
capability RESV-03 introduces. `platform/git.ts::listRemoteTags` reads a
remote's tag advertisement through the single `isomorphic-git` chokepoint
with `prefix: "refs/tags/"` and `peelTags: true`, so an annotated tag
resolves to the commit it points at and yields one result, not two.
`orchestrators/plugin/dependency-tag-probe.ts` turns an intersected
constraint into the highest `<pluginName>--v<semver>` release tag that
satisfies it, or into `no-matching-tag` / `tag-listing-failed`. Only tags
carrying the dependency's OWN release prefix are candidates, so a crafted
tag named for a different plugin can never be selected and no arbitrary
unpinned ref is reachable. Satisfaction comes from
`domain/dependency-range.ts`, not a second evaluator. The probe is absent
from `NETWORK_FREE_TARGETS` while both install owners stay in it — the
`install-clone-probe.ts` arrangement — so the NFR-5 gate needed no edit and
neither owner gained a git surface.
Task 2 was a `blocking-human` decision checkpoint on D-03-02's one-way
rating. The developer replied `proceed-as-decided`, so D-03-09 stands: a
no-match is the same failure in BOTH query arms and there is no fallback to
the repository head anywhere, even where upstream soft-degrades. RESV-03
stays Pending in REQUIREMENTS.md because plans 03-05 and 03-06 also declare
it.
One gate drift was found and closed: `tests/architecture/gate-targets.ts`'s
`UNOWNED_EXPORT_CENSUS` had not been amended for `listRemoteTags`, so
`npm run check` had been red since this plan's own task-1 commit. The census
recorded `domain/dependency-range.ts`'s three exports with the removal
condition named inline; plan 03-05 dropped that entry when it composed the
probe.
Plan 03-07 closed the phase's stated dependency on the manifest-read work.
`orchestrators/plugin/dependency-declaration-read.ts` answers what one plugin
declares in the D-01-32 order — the plugin's own manifest wherever it is
readable offline, the marketplace entry otherwise — and `install-flow.ts`'s
cascade lookup is now a call into it. A plugin whose real metadata lives in
its own bare manifest therefore has its dependencies installed, which the
entry-only read could not see. The read is offline by construction rather
than by convention: its injected seam exposes a stat, a text read and the
fs-only clone presence probe, so there is no materializing operation in the
module to reach from any flag, and a git-source dependency with no
materialized clone falls back to its entry instead of fetching. A
present-but-unusable manifest falls back to the entry and is never read as a
plugin that declares nothing. The `manifest-read-agreement` gate gained a
fourth reader so the cascade read and `info`'s render cannot drift. One
latent defect surfaced: three cascade fixtures declared the dependency on
the marketplace entry alone, so the seeded plugin's own manifest suppressed
it and the cases went vacuous — the seed now writes both sides in agreement
(D-03-25). RESV-02 is Complete; RESV-01 stays Pending because a later plan
in this phase also declares it.
Plan 03-03 landed the phase's two documentation obligations before the
network leaf that depends on them. The NFR-5 network policy now names the
constrained-dependency tag query as a declared exception, in byte-identical
wording in `.planning/PROJECT.md` and `CLAUDE.md` (D-03-03). A future reader
meets it as a stated constraint rather than as a surprise from a failing
architecture test. `docs/dependency-resolution.md` is RESV-03's written
grammar: the two declared element shapes and their character rules, the
constraint forms the evaluator handles, how several declarations intersect,
both project-owned size caps, the plugin-release tag convention and why most
third-party sources report no matching tag today, and a nine-cause failure
list that the reason tokens plan 03-06 mints must agree with. It also states
that nothing is added or cloned to satisfy a dependency, which is the
user-facing form of the D-03-08 trust boundary. Both READMEs link it.
Plan 03-02 made `semver` this package's own declared runtime dependency and
added `domain/dependency-range.ts`, which folds the N ranges declared for one
dependency name into one effective range or into `invalid`, `disjoint` or
`too-complex`. Both denial-of-service caps are walked to completion before
any work they bound is allocated.
Plan 03-01 shipped the phase's tracer. `install foo@mp` now installs the
plugins `foo` declares as dependencies: `domain/dependency-closure.ts` is a
pure two-structure walk (a path stack that is the only cycle test, a separate
visited memo that dedupes a diamond) whose post-order accumulator IS the
install order, and `orchestrators/plugin/install-cascade.ts` is an outer
`runPhases` ledger — one phase per closure member — driven inside
`install-flow.ts`'s existing single `withLockedStateTransaction`. Every member
is declared in the requesting plugin's own physical config file via the one
batched write, so the reconcile uninstall bucket does not sweep a
cascade-installed dependency on the next `resources_discover`. RESV-01, -02,
-04, -05 and -06 are all exercised but stay Pending in REQUIREMENTS.md: every
one of them is also declared by a later plan in this phase.
One data-loss defect was found and fixed during the tracer: the ledger's
failing phase runs its OWN undo first (TR-02), so an install of an
already-recorded plugin would have unstaged the very install its throw was
reporting. Each phase now records itself in a `materialized` sentinel and
`undo` acts only on what it finds there. Version constraints (RESV-03), live
tag resolution, per-member reporting and the plugin-manifest-first read order
are the remaining plans; `ClosureMember.ranges` and the injected
`ClosureLookup` are already shaped for them.
Phase 2 is complete and verified. `uninstall --keep-data` preserves the data
directory; omitting it deletes without a prompt at both the explicit command
and the load-time reconcile path (D-02-04, reaffirmed after a code-review
challenge during Phase 2 — reconcile has no command line, so it stays on the
promptless-delete default by design). The flag catalog declares
`--keep-data`, the handler's consuming scanner forwards `keepData` to the
operation plan 02-01 built, and `--delete-data`, `-y`, `--yes` and `--prune`
reject before any mutation. DATA-01, DATA-02 and DATA-03 are marked Complete
in REQUIREMENTS.md; FLAG-01 stays Pending for Phase 5's `--prune`.
All of Phase 2's gates are closed: code review found 13 issues (1 critical
— the reaffirmed D-02-04 tradeoff — 7 warning, 5 info), 9 were fixed, 1
(WR-07) was fixed then reverted per operator decision, 3 (CR-01, WR-04,
WR-05) were explicitly scoped out; Nyquist validation passed with 0 gaps;
security audit passed with `threats_open: 0` across 6 STRIDE threats;
regression covered by two full `npm run check` runs (0 failures); goal
verification passed 10/10 must-haves. See `02-REVIEW.md`, `02-REVIEW-FIX.md`,
`02-VALIDATION.md`, `02-SECURITY.md`, and `02-VERIFICATION.md`.
Phase 1 verified: 7/7 requirements, 37/37 decisions, 5/5 acceptance criteria.
Last activity: 2026-09-16 — Phase 04 complete, transitioned to Phase 5
Quick task `260914-aer` resolved WR-01 under D-01-35. The operator approved the
whitespace-only `.mcp.json` formatting.
Milestone progress is 3 of 5 phases complete (60%).
See `01-VERIFICATION.md` for passing automated and real-plugin evidence.
Phase 2 context records the user preference to follow existing output and help conventions.

**Phase numbering restarts at 1 for this milestone** (operator decision,
2026-09-09). Phases 1-117 belong to archived milestones. A bare phase number in
v1.20 context always means a v1.20 phase.

**The five phases:**

| # | Phase | Requirements | Depends on |
|---|-------|--------------|------------|
| 1 | Manifest read fidelity | MANF-01..05, DEPS-01, DEPS-02 | nothing |
| 2 | Uninstall data disposition and the uninstall option seam | DATA-01..03 | nothing |
| 3 | Dependency resolution | RESV-01..06 | Phase 1 |
| 4 | Install provenance | PROV-01..04 | Phase 3 |
| 5 | Prune on uninstall | PRUNE-01..04, FLAG-01 | Phases 4 and 2 |

Execution order 1 → 3 → 4 → 5, with 2 free to run at any point before 5.

## Performance Metrics

**Velocity:**

- Total plans completed: 170
- Average recorded duration: 11.9 min
- Total recorded execution time: 30 hr 1 min

**By Phase:**

| Phase                           | Plans | Total           | Avg/Plan          |
| ------------------------------- | ----: | --------------- | ----------------- |
| 108. Domain and Platform        |    23 | 10h 58m         | 28.6 min          |
| 109. Shared Contracts           |    19 | 3h 19m          | 10.5 min          |
| 110                             |    12 | -               | -                 |
| 111. Non-Hook Component Bridges |    31 | -               | -                 |
| 112. Hook Runtime               |    31 | 7h 58m          | 15.4 min          |
| 113. Orchestrator Support       |    35 | 7h 46m recorded | 16.6 min recorded |
| 1 | 4 | - | - |
| 02 | 2 | - | - |
| 3 | 7 | - | - |
| 04 | 6 | - | - |

**Recent Trend:** 35 Phase 113 plans completed with all direct owner, review, validation, verification, security, and clean-repository gates green.
**Per-Plan Metrics:**

| Plan          | Duration | Tasks   | Files   |
| ------------- | -------- | ------- | ------- |
| Phase 116 P19 | 45 min   | 1 tasks | 1 files |
| Phase 116 P15 | 40 min   | 1 tasks | 1 files |
| Phase 116 P14 | 45 min   | 1 tasks | 1 files |
| Phase 108 P01 | 10 min   | 2 tasks | 1 files |
| Phase 108 P06 | 18 min   | 3 tasks | 7 files |
| Phase 108 P08 | 13 min   | 2 tasks | 1 files |
| Phase 108 P09 | 15 min   | 2 tasks | 1 files |
| Phase 108 P10 | 12 min   | 2 tasks | 1 files |
| Phase 108 P11 | 14 min   | 2 tasks | 1 files |
| Phase 108 P13 | 14 min   | 2 tasks | 1 files |
| Phase 108 P14 | 10 min   | 2 tasks | 1 files |
| Phase 108 P15 | 10 min   | 2 tasks | 1 files |
| Phase 108 P16 | 16 min   | 2 tasks | 1 files |
| Phase 108 P17 | 26 min   | 2 tasks | 1 files |
| Phase 108 P19 | 28 min   | 3 tasks | 5 files |
| Phase 108 P20 | 12 min   | 2 tasks | 1 files |
| Phase 108 P18 | 43 min   | 3 tasks | 8 files |
| Phase 108 P21 | 3h 40m   | 3 tasks | 9 files |
| Phase 108 P12 | 27 min   | 3 tasks | 5 files |
| Phase 108 P22 | 42 min   | 3 tasks | 8 files |
| Phase 108 P02 | 20 min   | 3 tasks | 7 files |
| Phase 108 P03 | 19 min   | 3 tasks | 8 files |
| Phase 108 P04 | 22 min   | 3 tasks | 5 files |
| Phase 108 P05 | 20 min   | 3 tasks | 8 files |
| Phase 108 P07 | 27 min   | 3 tasks | 9 files |
| Phase 108 P23 | 20 min   | 3 tasks | 5 files |
| Phase 109 P01 | 7 min    | 2 tasks | 1 files |
| Phase 109 P02 | 10 min   | 2 tasks | 1 files |
| Phase 109 P03 | 12 min   | 2 tasks | 1 files |
| Phase 109 P04 | 7 min    | 2 tasks | 1 files |
| Phase 109 P05 | 5 min    | 2 tasks | 1 files |
| Phase 109 P06 | 7 min    | 2 tasks | 1 files |
| Phase 109 P07 | 16min    | 2 tasks | 1 files |
| Phase 109 P08 | 6min     | 2 tasks | 1 files |
| Phase 109 P09 | 19 min   | 2 tasks | 2 files |
| Phase 109 P10 | 9 min    | 2 tasks | 1 files |
| Phase 109 P11 | 6 min    | 2 tasks | 1 files |
| Phase 109 P12 | 12 min   | 2 tasks | 1 files |
| Phase 109 P13 | 6 min    | 2 tasks | 1 files |
| Phase 109 P14 | 40 min   | 3 tasks | 9 files |
| Phase 109 P15 | 6 min    | 2 tasks | 1 files |
| Phase 109 P16 | 9 min    | 2 tasks | 1 files |
| Phase 109 P17 | 11 min   | 2 tasks | 1 files |
| Phase 109 P18 | 4 min    | 2 tasks | 1 files |
| Phase 109 P19 | 7 min    | 2 tasks | 1 files |
| Phase 110 P02 | 11 min   | 2 tasks | 1 files |
| Phase 110 P06 | 7 min    | 2 tasks | 1 files |
| Phase 110 P11 | 7 min    | 2 tasks | 1 files |
| Phase 110 P01 | 8min     | 2 tasks | 1 files |
| Phase 110 P03 | 11 min   | 2 tasks | 1 files |
| Phase 110 P05 | 10 min   | 2 tasks | 1 files |
| Phase 110 P08 | 10min    | 2 tasks | 2 files |
| Phase 110 P10 | 9 min    | 2 tasks | 1 files |
| Phase 110 P04 | 11 min   | 2 tasks | 1 files |
| Phase 110 P07 | 16 min   | 2 tasks | 2 files |
| Phase 110 P09 | 19 min   | 2 tasks | 3 files |
| Phase 110 P12 | 17 min   | 2 tasks | 1 files |
| Phase 111 P01 | 14 min   | 2 tasks | 2 files |
| Phase 111 P02 | 10 min   | 2 tasks | 1 files |
| Phase 112 P01 | 14 min   | 2 tasks | 1 files |
| Phase 112 P03 | 9 min    | 2 tasks | 1 files |
| Phase 112 P08 | 8 min    | 2 tasks | 1 files |
| Phase 112 P09 | 9 min    | 2 tasks | 1 files |
| Phase 112 P10 | 14 min   | 2 tasks | 1 files |
| Phase 112 P12 | 12 min   | 2 tasks | 1 files |
| Phase 112 P15 | 6 min    | 2 tasks | 1 files |
| Phase 112 P16 | 7 min    | 2 tasks | 1 files |
| Phase 112 P17 | 7 min    | 2 tasks | 1 files |
| Phase 112 P18 | 3 min    | 2 tasks | 1 files |
| Phase 112 P19 | 5 min    | 2 tasks | 1 files |
| Phase 112 P20 | 5 min    | 2 tasks | 1 files |
| Phase 112 P21 | 8 min    | 2 tasks | 1 files |
| Phase 112 P22 | 20 min   | 2 tasks | 1 files |
| Phase 112 P23 | 10 min   | 2 tasks | 1 files |
| Phase 112 P24 | 10 min   | 2 tasks | 1 files |
| Phase 112 P27 | 19 min   | 2 tasks | 1 files |
| Phase 112 P28 | 28 min   | 2 tasks | 3 files |
| Phase 112 P29 | 13 min   | 2 tasks | 1 files |
| Phase 112 P30 | 17 min   | 2 tasks | 1 files |
| Phase 112 P31 | 17 min   | 2 tasks | 1 files |
| Phase 112 P11 | 14 min   | 2 tasks | 2 files |
| Phase 112 P13 | 20 min   | 2 tasks | 2 files |
| Phase 112 P25 | 12 min   | 2 tasks | 1 files |
| Phase 112 P02 | 45 min   | 2 tasks | 3 files |
| Phase 112 P06 | 26 min   | 2 tasks | 3 files |
| Phase 112 P04 | 33 min   | 2 tasks | 3 files |
| Phase 112 P05 | 18 min   | 2 tasks | 2 files |
| Phase 112 P26 | 19 min   | 2 tasks | 2 files |
| Phase 112 P07 | 34 min   | 2 tasks | 3 files |
| Phase 112 P14 | 16 min   | 2 tasks | 1 file  |
| Phase 115 P02 | 96 min | 3 tasks | 2 files |
| Phase 115 P05 | 90min | 3 tasks | 5 files |
| Phase 116 P00 | 35 min | 2 tasks | 5 files |
| Phase 116 P01 | 25 min | 1 tasks | 1 files |
| Phase 116 P02 | 20 min | 1 tasks | 1 files |
| Phase 116 P04 | 25 min | 1 tasks | 1 files |
| Phase 116 P06 | 65 min | 1 tasks | 3 files |
| Phase 116 P30 | 40 min | 1 tasks | 1 files |
| Phase 116 P12 | 45 min | 1 tasks | 1 files |
| Phase 116 P23 | 50 min | 1 tasks | 1 files |
| Phase 116 P26 | 45 min | 1 tasks | 1 files |
| Phase 116 P27 | 70 min | 2 tasks | 2 files |
| Phase 116 P29 | 20 min | 1 tasks | 1 files |
| Phase 116 P03 | 45 min | 1 tasks | 1 files |
| Phase 116 P10 | 45 min | 1 tasks | 1 files |
| Phase 116 P13 | 50 min | 1 tasks | 1 files |
| Phase 116 P07 | 35 min | 1 tasks | 1 files |
| Phase 116 P11 | 35 min | 1 tasks | 1 files |
| Phase 116 P05 | 30 min | 1 tasks | 1 files |
| Phase 116 P17 | 40 min | 2 tasks | 1 files |
| Phase 116 P28 | 30 min | 1 tasks | 1 files |
| Phase 117 P01 | 11 min | 1 tasks | 1 files |
| Phase 117 P02 | 15 min | 2 tasks | 10 files |
| Phase 117 P03 | 16 min | 1 tasks | 27 files |
| Phase 117 P04 | 22 min | 2 tasks | 2 files |
| Phase 117 P05 | 9 min | 1 tasks | 2 files |
| Phase 117 P06 | 13 min | 1 tasks | 2 files |
| Phase 117 P07 | 28 min | 2 tasks | 17 files |
| Phase 117 P08 | 22 min | 2 tasks | 4 files |
| Phase 117 P09 | 13 min | 1 tasks | 2 files |
| Phase 117 P10 | 12 min | 1 tasks | 1 files |
| Phase 117 P11 | 50 min | 1 tasks | 4 files |
| Phase 117 P11 | 2h 20m | 2 tasks | 16 files |
| Phase 02 P01 | 58 min | 3 tasks | 5 files |
| Phase 02 P02 | 28min | 2 tasks | 6 files |
| Phase 03 P01 | 89min | 3 tasks | 8 files |
| Phase 03 P02 | 41min | 2 tasks | 4 files |
| Phase 03 P03 | 4min | 2 tasks | 6 files |
| Phase 03 P07 | 43min | 2 tasks | 6 files |
| Phase 03 P04 | 7h 5m | 3 tasks | 5 files |
| Phase 03 P06 | 72 min | 2 tasks | 16 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.

- Each executable plan and implementation commit owns one source-test pair.
- Runtime tests use separate lowercase `// arrange`, `// act`, and `// assert` phases.
- Lowercase `// act & assert` is reserved for one `assert.throws()` or `assert.rejects()` expression.
- Type-only evidence stays module-scoped and uses `satisfies` or `@ts-expect-error` without fake runtime phases.
- Retained commits and HEAD triage labels do not close a pair.
- [Phase 110]: Kept agents-index-schema.ts byte-identical because its compiled validators expose the complete public contract.
- [Phase 110]: Agents-index schema evidence uses independent literals plus module-scope satisfies and targeted @ts-expect-error checks.
- [Phase 110]: Kept locations.ts byte-identical because its public seams expose the complete contract.
- [Phase 110]: Locations evidence uses complete bundles and adjacent safe-path probes with platform-aware separators.
- [Phase 110]: Kept rollback.ts byte-identical because its public formatter exposes every bypass and wrapping branch.
- [Phase 110]: Rollback evidence compares whole structured results before pinning original cause and raw partial identities.
- [Phase 110]: Kept agents-index-io.ts byte-identical because its public load and save functions expose every real branch.
- [Phase 110]: Agents-index I/O evidence uses case-owned literal documents, complete loaded values, structured failures, and exact stored bytes.
- [Phase 110]: Kept config-io.ts byte-identical because its public loader, validator, predicate, and saver expose every real branch.
- [Phase 110]: Config I/O evidence uses independent literal documents, complete load results, and unchanged bytes across validation and containment failures.
- [Phase 110]: Kept config-write-back.ts byte-identical because its five public operations expose every real write-back branch.
- [Phase 110]: Config write-back evidence uses independent complete JSON bytes for patches, deletes, cascades, omitted batch arms, and absent-entry creation.
- [Phase 110]: Refined MigrationResult.marketplaces to object-valued rows while preserving migration runtime logic and exports.
- [Phase 110]: Kept invalid plugin rows unfilled so the downstream state schema remains the rejection boundary instead of silently coercing corrupt values.
- [Phase 110]: Migration evidence uses complete independent results, exact fixed-point replay, and complete warning and filesystem effects.
- [Phase 110]: Kept phase-ledger.ts byte-identical because runPhases exposes every compensation and error branch through its public contract.
- [Phase 110]: Phase-ledger evidence uses the literal skills, commands, agents, hooks, mcp, state order with complete logs, results, causes, leaks, and final context.
- [Phase 110]: Kept config-merge.ts byte-identical because its two public functions expose every real merge and load branch.
- [Phase 110]: Used independent complete reducer values and all nine base/local status pairs to keep provenance and fallback behavior explicit.
- [Phase 110]: Narrowed buildConfigFromState with an inline intersection return type so existing exports stay unchanged while marketplace and plugin records become statically present.
- [Phase 110]: Removed only the redundant entry-count fallbacks and left migration runtime ordering, stored bytes, and result arms unchanged.
- [Phase 110]: Used independent complete state and config values plus exact bytes and metadata to prove first-run replay without sleeps or shared fixtures.
- [Phase 110]: Removed the redundant post-migration marketplace guard and assertion because Plan 110-08 guarantees object-valued MigrationResult rows.
- [Phase 110]: State migration persistence uses a pre-registered case-local filesystem watcher and exact file metadata to prove no-write replay without sleeps or polling.
- [Phase 110]: Kept with-state-guard.ts byte-identical because its public state operations and lockfile collaborator expose every real lifecycle branch.
- [Phase 110]: Used entered and release promises to prove real lock contention without sleeps, polling, elapsed-time checks, or platform skips.
- [Phase 110]: Used the existing loadState and saveState dependency seam for deterministic persistence failures and case-local proper-lockfile method restoration for acquisition and release failures.
- [Phase 111]: Every mirrored owner uses complete case-local inputs and independent expected outcomes; shared fixtures were removed after their last legitimate consumer.
- [Phase 111]: Supplemental suites remain only for genuine cross-module behavior, and all 31 direct owner gates pass at complete line, branch, and function coverage.
- [Phase 111]: MCP provenance markers require own outer and identity properties, rejecting inherited marker, plugin, and marketplace values.
- [Phase 111]: Two provably unreachable private skills-stage fallbacks were removed without adding a test-only seam, export, pragma, or behavior change.
- [Phase 112]: Kept pid-table.ts byte-for-byte unchanged and covered every branch through its public filesystem contract.
- [Phase 112]: Used a case-owned _shared regular-file boundary for deterministic filesystem failures without a test seam.
- [Phase 112]: Kept ring-buffer.ts byte-for-byte unchanged and proved every byte boundary through its public API.
- [Phase 112]: RingBuffer evidence uses fresh case-local byte inputs and independent complete text/truncation outcomes.
- [Phase 112]: Kept exec-result.ts byte-for-byte unchanged because its exported type and assertNever function expose the complete contract.
- [Phase 112]: Kept all HookExecResult positive and negative type evidence at module scope, with runtime execution only for assertNever.
- [Phase 112]: Proved allow, deny, and ask inline without introducing a new permission type export.
- [Phase 112]: Kept exec-timer.ts byte-for-byte unchanged because its public timer ladder exposes every scheduling branch.
- [Phase 112]: Observed exact handles, unref calls, clears, and pending state through the current TestContext fake timers only.
- [Phase 112]: Kept hook-env.ts byte-for-byte unchanged because prepareHookEnv exposes every environment branch through its public contract.
- [Phase 112]: Hook environment evidence preserves inherited-key non-interference while proving case-local remote-key absence and exact process restoration.
- [Phase 112]: Kept glob.ts byte-for-byte unchanged because its public compiled Bash and path objects expose every matching and defensive branch.
- [Phase 112]: Glob owner evidence uses complete independent metadata and named outcome maps for command boundaries, six anchors, normalization, containment, and globstar behavior.
- [Phase 112]: Covered defensive sparse and unknown compiled metadata through exported objects with Reflect, without casts, test seams, or production surface changes.
- [Phase 112]: Kept post-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the incomplete double assertion with complete SessionCompactEvent values checked by satisfies.
- [Phase 112]: Treated empty strings as valid context values and did not fabricate an out-of-contract null case.
- [Phase 112]: Kept post-tool-use-failure.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: PostToolUseFailure owner evidence uses complete ToolResultEvent values, independent whole envelopes, and nested identity and non-mutation assertions.
- [Phase 112]: Kept malformed process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept post-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced PostToolUse double assertions and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Kept malformed PostToolUse process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept pre-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the PreCompact double assertion and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Treated empty strings as valid PreCompact context values and did not add an unsupported null context case.
- [Phase 112]: Kept pre-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract.
- [Phase 112]: PreToolUse evidence uses independent built-in and custom six-key envelopes with nested identity and non-mutation checks.
- [Phase 112]: Kept malformed PreToolUse input in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept session-end.ts byte-for-byte unchanged because translate exposes the complete SessionEnd payload contract through its public signature.
- [Phase 112]: Used one explicit case per shutdown reason plus a dedicated empty-context case, with input-only target session files omitted from exact five-key envelopes.
- [Phase 112]: Kept malformed SessionEnd input in Plan 112-04 and left the supplemental translator suite unchanged.
- [Phase 112]: Kept session-start.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: SessionStart evidence uses independent whole envelopes for every source branch and accepted empty context values.
- [Phase 112]: Kept stop-failure.ts byte-for-byte unchanged because its public translator and classifier expose the complete contract.
- [Phase 112]: Used explicit sibling cases for classifier precedence and status partitions instead of a shared table or test seam.
- [Phase 112]: Kept object and cause wrapping in Plan 112-27 instead of expanding the StopFailure owner scope.
- [Phase 112]: Kept stop.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: Used separate case-local values and whole six-key expectations for active, inactive, and empty-text Stop partitions.
- [Phase 112]: Kept Stop re-entry and observer behavior in Plan 112-26 instead of widening the direct payload owner.
- [Phase 112]: Kept user-prompt-submit.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: UserPromptSubmit evidence uses separate case-local values and whole five-key expectations for ordinary, multi-line, empty, and multi-byte prompts.
- [Phase 112]: Kept malformed process-output behavior in Plan 112-04 instead of widening the direct payload owner.
- [Phase 112]: Preserved spawn planning while the security gate strengthened oversized serialization to a strict final 256 KiB UTF-8 bound.
- [Phase 112]: Treated defined args, including an empty array, as exec form with shell disabled; absent args retain shell-form behavior.
- [Phase 112]: Made the truncation marker authoritative without mutating object, primitive, or array inputs and bounded the final UTF-8 output, including metadata, to 256 KiB.
- [Phase 112]: Removed only the private stage stack-pop undefined guard after live CodeGraph proof established that its guarded state is unreachable.
- [Phase 112]: Retained readSymlinkTargetSafe as a reachable TOCTOU defense and proved it through restored Node filesystem bindings without a production seam.
- [Phase 112]: Absorbed the symlink supplemental's unique containment evidence into the stage owner before deleting the duplicate carrier.
- [Phase 112]: Kept timeout.ts byte-for-byte unchanged because resolveTimeoutSeconds exposes every validation, default, and diagnostic branch through its public contract.
- [Phase 112]: Preserved every finite positive value exactly, including fractional and large values, while rejecting zero, negative, nonnumeric, and nonfinite declarations.
- [Phase 112]: Kept scheduling, timer clamping, cancellation, and races in Plan 112-09 instead of widening this pure validation owner.
- [Phase 112]: Kept translation-context.ts byte-for-byte unchanged because buildTranslationContext exposes the complete snapshot and fallback contract through its public result.
- [Phase 112]: Used real case-owned file-backed and in-memory SessionManager instances with independently authored whole-context expectations.
- [Phase 112]: Kept translation-context readonly evidence at module scope and preserved its internal-only barrel scope.
- [Phase 112]: Kept wire-protocol.ts byte-for-byte unchanged because parseHookStdout exposes every live exit, JSON-shape, precedence, mutation, and no-op branch through its public result.
- [Phase 112]: Proved semantic diagnostics by category, hook destination, relevant detail, and outcome while separately asserting that reporting never throws.
- [Phase 112]: Kept every wire case independent and explicit instead of generalizing the mutation contract through a table or shared oracle.
- [Phase 112]: Restored documented stable first-seen Bash candidate deduplication with only a Set spread after direct evidence exposed the missing behavior. — The Rule 1 fix satisfies the public contract without adding an export, symbol, seam, helper, or parser restructuring.
- [Phase 112]: Bash if-field evidence uses complete literal commands and independently authored ordered results without invoking a shell. — Direct parser and matcher calls prove syntax, wrapper, recursion, fail-open, and specificity behavior without executing untrusted command text.
- [Phase 112]: Left the hooks-if-field supplemental file unchanged so Plan 112-13 remains its only final carrier. — The Bash owner absorbs the unique leaf evidence while avoiding a competing shared-file edit.
- [Phase 112]: Kept if-field/index.ts byte-for-byte unchanged because its public composition exports expose every required compile and evaluation partition.
- [Phase 112]: Retained only the unique parseHooksConfig side-map-to-RoutingEntry chain, including exact predicate object identity and declaration order.
- [Phase 112]: Kept the exact five predicate arms and all re-export evidence module-scoped without widening production metadata or adding a test seam.
- [Phase 112]: Kept routing-state.ts byte-for-byte unchanged because its public operations expose every required state transition and reset effect.
- [Phase 112]: Used only public lifecycle operations for routing-state setup, observation, and cleanup, without a private-state reader or test-only reset export.
- [Phase 112]: Left the additional-context supplemental unchanged because Plan 112-07 is its sole deletion carrier and Plan 112-13 owns the unique parser chain.
- [Phase 112]: Removed the two CodeGraph-confirmed registry test readers and obsolete promise-tracking cell without adding another observer or test seam.
- [Phase 112]: Retained fire-and-forget PID persistence on async child exit and error, observing rewrites through public filesystem and shutdown effects.
- [Phase 112]: Restricted the async-rewake supplemental to two cross-lane environment-parity cases and one routing-epoch reload case.
- [Phase 112]: Proved default orphan probes behind a mocked process.kill signal-0 boundary and used injected probes for all orphan safety partitions.
- [Phase 112]: Removed the legacy adaptObservationResult export after CodeGraph and historical call-site proof found no production caller.
- [Phase 112]: Consolidated every direct adapter contract and the duplicate architecture suite into the mirrored event-adapters owner.
- [Phase 112]: Left the mixed SessionStart additional-context supplemental unchanged for Plan 112-07 to remove after dependent evidence is absorbed.
- [Phase 112]: Kept dispatch-exec.ts byte-for-byte unchanged because dispatchHookExec exposes the complete process, stream, stdin, timer, parse, and delegation contract.
- [Phase 112]: Used synchronous child stdin and direct stdout/stderr descriptor writes to remove the portable fixture fast-exit race without sleeps or production changes.
- [Phase 112]: Consolidated all single-module execution evidence in the dispatch-exec owner and deleted hooks-exec.test.ts.
- [Phase 112]: Retained only translator-module completeness and shared built-in/custom tool-name mapping in hooks-translators.test.ts.
- [Phase 112]: Used a live failing diagnostic sink to prove the outer async delegation catch while preserving never-throw noop behavior.
- [Phase 112]: Kept dispatch.ts byte-for-byte unchanged because its public collection and composite-handler exports expose every reducer and adaptation partition through an injected executor.
- [Phase 112]: Consolidated all single-module reducer evidence in the mirrored dispatch owner, then deleted hooks-reducer.test.ts.
- [Phase 112]: Kept hooks-dispatch.test.ts byte-for-byte unchanged as the locked repository-wide static carrier for Plan 112-07.
- [Phase 112]: Used only public routing lifecycle operations for case-local state setup and cleanup, without a private state reader, reset seam, or shared oracle.
- [Phase 112]: Removed settleCacheSnapshot and loopProtectionState after live CodeGraph proof showed no production callers, without adding a replacement introspection seam.
- [Phase 112]: Proved settle state only through public lifecycle handlers, executor events, sent messages, notifications, and fresh follow-up calls.
- [Phase 112]: Kept StopFailure observation-only: matching noop, block, mutate, and stop results run in declaration order and are all discarded.
- [Phase 112]: Alphabetized inventories and presentation expectations while preserving exact production declaration and registration order where order is contractual.
- [Phase 112]: Kept event-router.ts byte-for-byte unchanged because its public cache, hydration, rebuild, handler, and registration operations expose the complete lifecycle contract.
- [Phase 112]: Split in-memory and persisted child fixtures across user and project cleanup surfaces so exit persistence cannot race the orphan tracer.
- [Phase 112]: Alphabetized the hook-barrel runtime identity and compiler-negative inventories while leaving production export declarations unchanged.
- [Phase 113]: Completed all 35 mirrored owners; 33 executable sources reached 971/971 branches, 216/216 functions, and 7,941/7,941 lines, while both type-only owners passed compiler contracts.
- [Phase 113]: Kept runtime tests on separate lowercase `// arrange`, `// act`, and `// assert` phases and kept presentation-only inventories alphabetical.
- [Phase 113]: Preserved caller, scope, reason, and lifecycle order wherever sequence carries behavior.
- [Phase 113]: Proved presenter structure and exact rendered bytes, including severity, dependency, omission, tally, trailer, and reload partitions.
- [Phase 113]: Proved classifiers, discovery, clone helpers, probes, scope fan-out, import planning, and reconcile planning through complete case-local values.
- [Phase 113]: Kept read-only support paths offline through fail-fast fakes and architecture prohibitions; all mutable state and collaborators are case-owned.
- [Phase 113]: Absorbed single-module evidence into mirrored owners and removed seven redundant supplemental suites without losing their unique contracts.
- [Phase 113]: Removed one unreachable closed-union presenter default instead of fabricating an impossible test value.
- [Phase 113]: Restored shipped barrel and interface exports after review showed aggregate dead-code cleanup had narrowed public contracts.
- [Phase 113]: Replaced passive-value mocks and every broad `anyTimes()` expectation with fresh typed data and exact, explicitly verified interaction doubles.
- [Phase 115]: Removed five structurally unreachable arms from the import cascade after a caller trace, narrowing two private types so a wrong token is a compile error rather than a runtime signal.
- [Phase 115]: Deleted the last c8 ignore in the extensions tree by running the entrypoint twice with no dependency bundle, so the production default state loader's own answer is what changes the second outcome.
- [Phase 115]: A defensive guard can be reached and still not be discriminating; the repair builder's undeclared-source guard is redundant with the already-declared merge check and is reported rather than removed.
- [Phase 115]: D-115-10 delivered: the three reconcile producers carry the mode-discriminated overload, so a dropped cascade row is a gate failure rather than a silent continue.
- [Phase 115]: Removed the marketplace-add, plugin-install and plugin-toggle catch clauses as unreachable; kept and proved the removal and uninstall clauses with a competing-writer race.
- [Phase 115]: Deleted all eight source-text pins outright; none encoded a rule that is not already gated by its own owner, so nothing was re-homed under tests/architecture/.
- [Phase 116]: strong-mock times(0) is inert, so the notification boundary omits the expectation entirely when a count is 0
- [Phase 116]: The args-schema owner records onError with a plain closure asserted as a whole array, never as an interaction mock — The module promise is its return value; a declared callback parameter is not a port, so its call count proves nothing the result does not
- [Phase 116]: The tokenizer-failure cases declare a required positional the input satisfies, so an undefined result can only mean the early return fired — It proves the short-circuit through the public result instead of observing an internal call, and a plant that removed the short-circuit turned all three cases RED
- [Phase 116]: The direct-coverage branch denominator is a property of the suite, not of the source: edge/args.ts measures branches 28/29 under its rewritten owner where it measured 25/26 under the old one, with the same single uncovered branch — V8 emits a block range only when that block's execution count diverges from the enclosing range, so a guard whose false arm is never taken is collapsed and never enters the lcov denominator at all. Covering the false arm raises BRH and BRF together. Diffing BRDA records between the two suites over the same source shows three new ranges (args.ts:46, :75, :84) and no lost ones. Consequence: a full-line coverage verdict pin cannot be authored before the rewrite that strengthens the suite. D-116-01a's recorded number for edge/args.ts is superseded by measurement and the three other claimants (116-26, 116-21, 116-17) carry the same exposure. Operator ratification required; nothing was edited.
- [Phase 116]: 116-06: deleted the unreachable optional-description branch in completionFlagEntries by making FlagEntry.description required, rather than adding a coverage exception; the exported return type is unchanged
- [Phase 116]: 116-06: where an architecture gate already pins a data table exactly, the mirrored owner proves the derivation shape (filter, order, key presence, exclusion) and asserts nothing about the table contents
- [Phase 116]: 116-30: the type-only owner pins EdgeDeps required-versus-optional split only; enumerating the member set or asserting the export surface would restate what the compiler and fallow dead-code already enforce
- [Phase 116]: 116-30: a clean tsc is itself proof that every ts-expect-error in a file binds, because an unattached directive raises TS2578; the moved-marker plant showed the multi-line satisfies diagnostic landing on the closing line
- [Phase 116]: The closed-over-API case builds two distinct Pi values instead of one shared value: a same-instance case only repeats the delegation case and cannot discriminate.
- [Phase 116]: 116-23: a double for a generic export derives from an instantiation-expression type query (Parameters<typeof fn<Chosen>>[N]); the uninstantiated form collapses the type parameter to unknown and loses the exact-argument match
- [Phase 116]: 116-23: input tokens that the module under test derives from another module are hand-authored literals, not read back from that module; feeding the derivation back in is tautological and cannot fail
- [Phase 116]: 116-26: a whitespace row set must separate the two claims it looks like one of — dropping empty tokens and splitting on a whitespace CLASS are independent, and a spaces-only row pins neither because /\s+/ is greedy
- [Phase 116]: 116-26: a D-116-01a pair pins the shortfall identity (one uncovered branch, the exact uncovered line set) and records the measured branch numbers as an observation; the denominator tracks suite strength, so a number pin cannot be authored before the rewrite it gates
- [Phase 116]: 116-27: all four tools.ts switches are gated — three by TS2366 because their return type excludes undefined, and the version reader by TS7030 because noImplicitReturns makes the end of a default-less switch reachable once an arm goes missing; research's "compiles clean" premise is disproved
- [Phase 116]: 116-27: an unreachable switch arm is removed by giving the function its producer's row union, derived from the producer's return type rather than named or hand-excluded; re-adding a removed arm raises TS2678, which is the control that proves the removal was forced
- [Phase 116]: 116-27: a defensive narrowing copied from a shared helper is a branch the local pair can never reach; calling the helper removes it without a cast, a behavior change, or a coverage exception
- [Phase 116]: 116-27: a mock for a generic method restates that member as a property, because reading a method as a value is an unbound-method lint error; the shared notification boundary cannot serve a registerTool capture for that reason
- [Phase 116]: 116-29: the two subcommand vocabularies deliberately overlap on list, ls, info and update, so "no marketplace name is also handled by the top level" is false; the anti-shadowing promise is carried instead by proving the shared token reaches a different handler member per dispatch
- [Phase 116]: 116-29: alias identity is one case with one expectation at a definite count of 2, driven once by the alias and once by the canonical name; two separate cases prove two dispatches, not one identity
- [Phase 116]: 116-29: a "no duplicate entries" claim cannot be written by deduplicating the exported constant and comparing it back — that is an expectation transformed from an actual; comparing the export against the hand-authored row table that serves it catches the same defect
- [Phase 116]: 116-24: a destructive seamless verb is owned through its FOOTPRINT — every case, rejections included, compares the surviving install records of both scope roots as one whole value beside the notification; a notification-only proof of an uninstall passes while proving nothing about whether state changed
- [Phase 116]: 116-24: `parseCommandArgs` with ONE REQUIRED positional rejects zero but DROPS a surplus, because it iterates the schema rather than the input; the arity truth's lower half holds and its surplus half does not
- [Phase 116]: 116-24: `uninstallPlugin` reads `opts.local` only to pick the CFG-03 precondition target and then sweeps BOTH config layers unconditionally, so the scope-target flag is invisible in the message AND in the footprint on a healthy workspace; the discriminating fixture is an override layer that FAILS SCHEMA VALIDATION, where supplying the flag aborts the command and omitting it completes it
- [Phase 116]: 116-24: one Group-C plant can yield three distinct frames on a single module when the scope selection is what reaches `locationsFor` — a user-scope call never calls `path.join`, so it runs to completion and is caught by the emission count instead of by an ERR_INVALID_ARG_TYPE
- [Phase 116]: 116-24: an offline zero needs BOTH reachability questions answered; where the module can reach no transport at all, the zero is an NFR-5 regression guard with neither a positive control nor a reachable input, and must be labelled as one rather than presented as a measurement
- [Phase 116]: 116-03: the `--partial` option is not an install/update-only narrowing — it SHIFTS the install candidate set (drops `remote`, admits `partially-available`) and narrows uninstall, reinstall, enable and disable identically to update, because it is threaded into the same shared installed-inventory helper
- [Phase 116]: 116-03: `tests/architecture/scope-order-drift.test.ts` walks `extensions/` only, so a hand-authored scope literal in a test file is not gated; four existing test files already carry one
- [Phase 116]: 116-03: a counter exposed on a returned interface must be declared `readonly f: () => number`, not `f(): number` — a method signature makes every destructuring site an unbound-method lint error even though the value is a closure
- [Phase 116]: 116-03: `data.ts:188`'s `allTokens.at(-1) ?? ""` fallback is a fifth D-116-01a-class unreachable branch, outside the four-claimant list; proved unreachable by construction, by a 65,536-code-point probe, and by a plant that stayed green, and left at 109/110 rather than pinned or excepted
- [Phase 116]: 116-10: an EMPTY positional schema does not reject a surplus token — `parseCommandArgs` iterates the SCHEMA, not the input, so every extra token is dropped and the handler still delegates; the phase-wide `must_haves` truth that both out-of-range arities are "rejected with a usage error" is false for a zero-positional handler
- [Phase 116]: 116-10: `marketplace/list.ts` never calls `extractLocalFlag`, so the scope-target flag reaches the tokenizer as a positional and is swallowed; supplying it beside `--scope` is accepted, not rejected, and the phase-wide mutually-exclusive-selectors truth has no target on this handler
- [Phase 116]: 116-10: the Group-C negative fires on the FIRST unstated boundary read, not on the emission count — a handler that forwards `ctx.cwd` dies in `path.join` on strong-mock's pending-call proxy before it can emit, so the G5 excerpt's stated "second `ctx.ui` access past its `times(1)` count" mechanism is only the fallback for handlers that read no `cwd`
- [Phase 116]: 116-10: a Group-C rejecting case seeds BOTH scopes so the workflow it must not reach would have rows to emit; an unseeded tree makes the negative weaker because the unreached workflow would emit only the empty-state sentinel
- [Phase 116]: The marketplace update handler's usage-string collapse arm is unreachable through its exports, so the pair stands at branches 11/12 and the shortfall is reported, not pinned or excepted — parseCommandArgs passes the usage string to the callback only for a REQUIRED positional; this schema declares its sole positional optional. Proven by construction, by a 170-shape brute force, by a plant that stayed GREEN, and by an inverted-condition plant that went RED. 116-13 is not a D-116-01a claimant and both production licences are spent, so the reversible default applies. Identity: BRDA:41,11,0,0 in the pair's own lcov.
- [Phase 116]: An injected port forwarded from two call sites needs one plant per site; a single-site plant leaves the sibling arm's claim unproven — Removing the all-marketplaces arm's pluginUpdate forward left both named-marketplace rows GREEN; removing the single-marketplace arm's forward left the bare and scope-narrowed cases GREEN. Applies to 116-07, 116-14 and 116-17, the remaining injected-port owners.
- [Phase 116]: 116-07: the marketplace add owner proves the injected git port by driving a url source on a provider-less host and comparing the whole clone recorder, with the randomUUID staging leaf replaced by a token only under the expected scope root
- [Phase 116]: 116-07: scope and the scope-target flag are proven as an on-disk footprint (which scope root holds state.json, and whether the write-back landed in claude-plugins.json or claude-plugins.local.json) because the edge tier has no injection point against the options bag
- [Phase 116]: 116-14: a RECORDER-based port-forward proof is weaker than a structural exact-argument `when()` — a re-boxed port AND a port with one member wrapped around a delegating call both stay GREEN under a recorder, while 116-17's `when()` goes RED on the wrapped member; only replacing the implementation goes RED under both, so the claim states that the operation is carried out by the injected implementation
- [Phase 116]: 116-14: a guard order is only pinnable with an input that satisfies TWO guards at once — the plan's unrecognised-scope-with-no-positional input passes under any order, while `--scope user --local` proves the positional guard precedes the scope guard and `extra --scope nope` proves the parse failure precedes both
- [Phase 116]: 116-14: `plugin/bootstrap.ts` calls `parseArgs`, the second handler measured to do so, and answers all three inherited questions like `plugin/import.ts` rather than like the marketplace tier — a surplus positional IS rejected, there is no arity below the accepted zero, and `--local` lands on positional
- [Phase 116]: 116-14: a github-source workflow cannot be driven through a bare `createGitOpsFake` — the GitHub provider attaches a credential bundle whose functions are not structured-clonable and the fake's recorder clones every call, so the port must drop that downstream-owned bundle while still delegating every operation to the fake
- [Phase 117]: The unit-suite glob control lands before the amendment it guards, so the later glob change must turn it RED and back GREEN rather than tune it to agree
- [Phase 117]: 117-02: a support-module relocation ships as ONE commit carrying the `git mv` and its consumer import rewrites — a pure-move commit leaves the consumers importing a path that no longer exists, so it cannot typecheck, and git still reports the rename at 96 to 98 percent
- [Phase 117]: 117-02: ESLint and Prettier disagree on the shape of a shortened import — `eslint --fix` split the two integration children's import onto four lines and `prettier --check` then failed, because the shorter sibling specifier let the statement fit one 94-character line; run both, never either alone
- [Phase 117]: 117-03: shortening an import specifier re-sorts it INSIDE the parent group, not only across groups — the boundary move reddened `import-x/order` in six suites where the plan predicted two, so the ordering must be read off ESLint rather than reasoned about
- [Phase 117]: 117-03: a 100 percent rename reading is only evidence once the consumer edits are confirmed staged — the identical number was false in 117-02, produced by an aborted `git add`, so cross-check it against `md5sum` and `git log --follow`
- [Phase 117]: D-117-04a: both orphan supplements relocate to tests/architecture/ rather than fold into a mirrored owner, because each spans several production modules and none of them owns it — The correspondence gate exempts the architecture root structurally (nonCorrespondingRoots), so the relocation needed no gate change and no exemption entry -- which is what keeps the SUITE-04 ban on name-keyed opt-outs intact
- [Phase 117]: D-117-04b: each move is one commit carrying the move plus its specifier fix, not a move commit and a rewrite commit — A pure-move commit would leave the reason-parity suite importing a path one level too deep, so it would not typecheck; git still recorded the rename at 95 percent, and the materialization-gate move at 100 percent
- [Phase 117]: The device-flow prompt supplement folds into tests/domain/github-auth.test.ts as one case, not two: its ordering case restated the owner existing reports-denied-authorization row, so the surviving case pins the catalog byte form on the denied poll and carries both claims at once.
- [Phase 117]: The folded case builds its transport with createDeviceFlowFake while the credential and notify ports stay strong-mocks, because the house role table makes notifying a mock and a third copy of the owner mock-DeviceFlowHttp arrange block would have risked the fallow dupes threshold of 3.
- [Phase 117]: 117-06: plant at the granularity the case claims — deleting the whole production step fails the case on its returned outcome, so it cannot prove an on-disk read is load-bearing — The plan's literal plant removed the cascade's hooks slot and the merged case failed on dropped.hooks, not on the readdir; deleting only the rm inside removeHookConfig left the outcome correct and failed exactly one case in the suite, on the disk read
- [Phase 117]: The seed's own three production specifiers gained a climb because its new home is one directory deeper; no consumer rewrite reveals that, only reading the module does.
- [Phase 117]: The helpers glob alternative was removed for honesty, not function: both globs match the same 248 paths with and without it, and the 117-01 completeness control is the independent proof.
- [Phase 117]: Shortening an import specifier re-sorts it inside the parent group with no predictable direction: 13 handler suites moved a line, the mirror image of 117-03's effect.
- [Phase 117]: The extension entry pair asserts two notifications for an unreadable install state, not one: the reconcile renders its own failure cascade for the same file before the plugin-PATH warning, and the legacy filtered assertion concealed it. — Measured on this tree; the whole two-element notification list is now compared.
- [Phase 117]: Both entry-pair fixtures use a schema violation rather than a syntax error, because the reconcile renders the runtime JSON parser text into a user-visible message and that text is not part of any contract. — Keeps the whole-value cascade comparisons stable across Node versions; this tree runs v26.7.0 while CI pins 24.
- [Phase 117]: Barrel-proxy ownership is named as its own gate verdict, proxy-owned, split from wrong-import and decided from the import graph the gate already builds. — D-117-21 gives the verdict its spelling; the split needs no name list, registry or exemption entry, and both sides are planted in the control.
- [Phase 117]: D-117-20 amended to 190 + 7 + 7: 190 complete numeric records, 7 accepted D-116-01a shortfalls, 7 type-only — Operator decision after plan 117-11 measured it; the gate is deliberately unchanged, no ledger-keyed verdict and no production licence, because a ledger-keyed pass would be the coverage-exception pragma D-116-01a bans
- [Phase 117]: Concurrency is NOT added to the all-pair run, decided against a measured 533.2 s for all 204 rows — Under nine minutes at a phase boundary does not justify D-117-11's obligation of a second planting control proving a failing pair is still detected under interleaving
- [Phase 117]: An errno path and errno message text are runtime-owned, not contractual; assertions pin name, code and syscall, and read the runtime's wording back where production composes around it — A package upgrade changed the EISDIR wording mid-phase and reddened 11 assertions with no behaviour change; the ten hardened suites are now identical on v22.22.2 and v26.8.1
- [Phase 02]: `keepData` guards only data-path resolution and the data `rm`; completion-cache invalidation, hook-route removal, unused-clone collection, config write-back and artifact removal keep their established scheduling — D-02-06; proven by the symlinked-data-dir case that still retires routes, cache and the last clone
- [Phase 02]: The consuming scanner form takes `{ consumeLongFlags: readonly string[] }` and returns `consumedFlags: ReadonlySet<string>`; the omitted and `readonly string[]` fourth-argument forms keep their exact existing result shape — D-02-05; one token walk owns scope-value precedence, extraction and unknown-option rejection
- [Phase 02]: DATA-01..03 are NOT marked complete by plan 02-01 — each names the `uninstall --keep-data` command surface, which plan 02-02 delivers; 02-01 proves the operation underneath it
- [Phase 02]: TruffleHog's pre-commit git-mode scan cannot run in this checkout because `.git` is a worktree file; commits use `SKIP=trufflehog` per CLAUDE.md and a filesystem-mode scan covers the exact staged files
- [Phase 02]: uninstall keepData is forwarded only when --keep-data is present, so the operation's own default stays the single statement of the promptless deletion policy.
- [Phase 02]: The uninstall handler joins install/update as a catalog-consuming verb via passThroughFlagNames, so one catalog entry drives usage, completions, the parse set and the drift pin.
- [Phase 02]: The uninstall handler owner's whole-footprint observation carries both scopes' data bytes, so rejection cases prove no silent deletion rather than only a surviving record.
- [Phase 02 code review]: D-02-04 reaffirmed — reconcile stays on the promptless-delete default with no `keepData` opt-out despite a code-review critical finding (CR-01); the operator confirmed this is DATA-03 working as specified, not a gap. See `PROJECT.md` Key Decisions for the full rationale.
- [Phase 02 code review]: WR-07 (route a symlink-containment refusal through the cleanup swallow-catch instead of letting it propagate) was applied then reverted (commit `eeeb80eb`) per operator decision — the original NFR-10 propagating behavior stands. DATA-01..03 are marked Complete in REQUIREMENTS.md via plan 02-02.
- [Phase 03]: D-03-12: the cascade root is exempt from the closure walk's already-installed, marketplace-known and catalog-absent guards — All three are preconditions of the REQUESTED plugin, and the install ledger owns them: it applies the CMP-3 cross-scope marketplace fallback a pure walk over one snapshot cannot see, and it reports each miss against the right subject (the marketplace for an unadded one, the plugin row for a plugin its manifest does not declare). Enforcing them in the walk pre-empted both with a dependency-shaped verdict on a plugin that is nobody's dependency.
- [Phase 03]: D-03-13: a cascade phase's undo gates on a context-set 'materialized' sentinel, not on runPhases' executed array alone — The executed array covers the REVERSE walk only. Per the phase ledger's TR-02 contract the FAILING phase runs its own undo first, so installing an already-recorded plugin reached its phase, threw from inside do, and then unstaged the pre-existing install its throw was reporting. Phase.undo's own contract prescribes the remedy: an undo cannot assume its do ran to completion and must gate on a context-set sentinel.
- [Phase 03]: D-03-14: ClosureLookup takes an already-split subject, and the parse-result mapping lives in domain/ — Handing the lookup {key, name, marketplace} removes a key re-parse from every reader, and with it the unreachable split guard install-flow.ts would otherwise carry under its direct-coverage gate. toClosureLookupResult lives beside the walk so the parse-failure arm has one definition and a reader whose own source cannot produce a failure (loadMarketplaceManifest isolates an unparseable dependencies entry before returning) does not carry an arm its tests cannot reach.
- [Phase 03]: D-03-15: the conjunct cap walks every input's projected branch count BEFORE any cross-product is allocated, so nothing is built even on the input that trips it; the first input needs no separate check because the running product after it IS its own branch count
- [Phase 03]: D-03-16: the satisfiability filter tests semver.minVersion ONLY -- the upstream re-validation arm is structurally unreachable here (a conjunct is a concatenation of comparator sets validRange itself produced) and the direct-coverage gate admits no unreachable branch
- [Phase 03]: D-03-17: the intersected range is rejoined with a bare || and NOT re-validated; validRange renders a union exactly that way, so the result is canonical by construction and carries no second unreachable null arm
- [Phase 03]: D-03-18: all three dependency-range caps (4096 input chars, 1024 conjuncts, 200 rendered chars) are documented PROJECT-OWNED; research assumption A1 records the upstream conjunct value as inferred, so only the guard-before-the-work mechanism claims parity
- [Phase 03]: D-03-19: semver ships as a declared runtime dependency because resolution needs a real evaluator, not because one is already present -- the hoisted copy is from the ESLint dev chain and the nested copy from the pi-coding-agent peer, so neither survives a consumer's production install
- [Phase 03]: D-03-20: the NFR-5 amendment names the constrained-dependency tag query in both files that carry the network policy, and the two bullets are now byte-identical — D-03-03 requires a visible constraint amendment rather than a fact a reader later discovers from a failing architecture test. PROJECT.md's em dash is normalized to the double hyphen CLAUDE.md already carried, because the fix-unicode-dashes pre-commit hook excludes .planning/ and would otherwise keep the two apart on every future edit.
- [Phase 03]: D-03-21: docs/dependency-resolution.md is RESV-03's written grammar and the nine-cause failure list the later reason tokens must agree with — RESV-03's success criterion states the grammar in writing rather than leaving it implicit. The document also carries the two user-facing trust statements the syntax cannot imply: the plugin-release tag convention is not a git standard, so most third-party sources report no matching tag today, and nothing is added or cloned to satisfy a dependency, so a plugin cannot introduce a new source of code by declaring one.
- [Phase 03]: D-03-22: the dependency declaration read takes the marketplace entry and parses its `source` itself rather than taking a pre-parsed source beside it — two inputs describing the same thing can disagree, one cannot, and it keeps parsePluginSource out of install-flow.ts
- [Phase 03]: D-03-23: the declaration read requires an entry and carries no no-entry arm — without an entry there is no source, so no plugin root and no manifest, and install-flow already returns absent for a plugin its marketplace does not declare; the arm would have been unreachable from production, which the direct-coverage gate does not admit
- [Phase 03]: D-03-24: the declaration read's options omit the plugin key's name and marketplace because nothing in the read consumes them — the entry already answers which plugin this is
- [Phase 03]: D-03-25: a seeded declareDependencies declaration now lands on BOTH the marketplace entry and the plugin's own manifest — under D-01-32 an entry-only fixture has its own manifest suppress the declaration, which silently turned three cascade cases vacuous, one of them still passing while proving nothing
- [Phase 03]: D-03-09 confirmed on the record: the tag probe hard-fails a no-match in BOTH query arms, with no fallback to the repository head — Answered at a blocking-human decision checkpoint; the developer replied proceed-as-decided over soften-no-match and stop-and-rescope. Upstream soft-degrades a marketplace-repository no-match to a head copy; this project does not port that asymmetry, matching D-03-08.
- [Phase 03]: D-03-26: dependency-tag-probe.ts is NOT a CREDENTIAL_LEAK_TARGETS member — It composes a host credential bundle and threads it into the listing call without reading, storing or rendering a credential value, exactly as install-clone-probe.ts does. The gate scans state-write field names and git-credential.ts error interpolation, neither of which has a surface here, and its members are destructured positionally against a pinned module order.
- [Phase 03]: The tag probe parses and orders candidate versions with semver, but asks domain/dependency-range.ts whether a version satisfies a range — Parsing and ordering a version is not evaluating a range, so one module keeps owning the satisfaction contract and no second evaluator exists.
- [Phase 03]: D-03-30: the dependency cascade mints exactly seven closed-set reason members and reuses four inherited ones; a listing that could not be read keeps the probe's own transport classification
- [Phase 03]: D-03-31: dependency marketplace not added is a ContentReason on the marketplace in user scope precedent; the three structural markers are Excluded from ContentReason and cannot type-check into a plugin row
- [Phase 03]: D-03-32/33: the cascade emits cardinality single and always routes through CASCADE_CONTEXT, so a no-dependency install's bytes stay frozen with no branch
- [Phase 03]: D-03-34/35: a root-keyed member failure stays on the single-plugin path, and the cascade error is derived from the subject rather than the caught value, which removed an uncoverable branch instead of pinning it

### Pending Todos

Four open decisions carried by the v1.20 roadmap, each bound to the discuss
session that must settle it:

1. **Version-constraint grammar (RESV-03) — Phase 3 discuss.** No semver library
   is in the dependency tree and PL-5 compares versions as strings deliberately.
   Add a dependency or document a constraint subset with a stated refusal.
2. **Where a dependency-installed plugin stands relative to
   `claude-plugins.json` — Phase 3 discuss.** `buildUninstallBucket`
   (`orchestrators/reconcile/plan.ts:352`) uninstalls every recorded plugin the
   merged config does not name, so a cascade install must be reconciled with that
   config or it vanishes on the next `/reload`.
3. **Stale-record wording and recovery command (PROV-04) — Phase 4 discuss.**
   MIGR-01's own unresolved design question, scoped to the "stale state, absent
   config" message. Answer that much only.
4. **`--prune`'s value on the reconcile path — Phase 5 discuss.**
   `applyPluginUninstalls()` carries no command line and takes the default.

### Blockers/Concerns

- Resolved 2026-09-14: The supported workstream completion command archived
  defaults-enabled, milestone and workflows-detection under `.planning/milestones/`.
  All 32 tracked files retain their original bytes. GSD recognizes v1.20 in flat
  mode. The archive operation did not waive historical verification debt.
- RESOLVED: Phase 1's canonical verification report (`01-VERIFICATION.md`) exists
  and passed — this note was stale (the report was already on disk when it was
  written). Phase 2 also closed clean: `02-VERIFICATION.md` passed 10/10.
- RESOLVED by 117-12: D-117-20 in `117-CONTEXT.md` now reads 190 complete numeric records + 7 accepted D-116-01a shortfalls + 7 type-only, matching the operator decision taken in plan 117-11 and the retained all-pair artifact. The superseded 197 + 7 wording is gone.

### Quick Tasks Completed

Latest implementation: `260914-aer` — upstream dependency rejection, 2026-09-14.
The review-fix pass includes this implementation. The formatting blocker is resolved.
See [task summary](./quick/260914-aer-match-upstream-rejection-of-invalid-depe/260914-aer-SUMMARY.md).

| #          | Description                                                                                                 | Date       | Commit   | Directory                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| 260907-l4w | Fix issue #155: agents bridge frontmatter parser mangles YAML multiline (block scalar) description values | 2026-09-07 | c82a731b | [260907-l4w-fix-issue-155-agents-bridge-frontmatter-](./quick/260907-l4w-fix-issue-155-agents-bridge-frontmatter-/) |
| 260907-m38 | Implement SKFM-01: repair a single-line frontmatter scalar whose only defect is an unquoted colon | 2026-09-07 | 66be4e43 | [260907-m38-implement-skfm-01-repair-single-line-fro](./quick/260907-m38-implement-skfm-01-repair-single-line-fro/) |
| 260907-qar | mark backlog entries WFLW-01 and DFEN-01 closed | 2026-09-07 | 32396cff | [260907-qar-mark-backlog-entries-wflw-01-and-dfen-01](./quick/260907-qar-mark-backlog-entries-wflw-01-and-dfen-01/) |
| 260907-qqo | HKPS-01: if-field PowerShell(...) rule prefix support in the hooks bridge | 2026-09-07 | ae06d27f | [260907-qqo-hkps-01-if-field-powershell-rule-prefix-](./quick/260907-qqo-hkps-01-if-field-powershell-rule-prefix-/) |
| 260907-qsx | adopt SonarJS recommended ruleset for extensions | 2026-09-07 | fe1313c6 | [260907-qsx-adopt-sonarjs-recommended-ruleset-for-ex](./quick/260907-qsx-adopt-sonarjs-recommended-ruleset-for-ex/) |
| 260907-q0h | Fix issue #143: make generated command name separator platform-dependent so Windows installs stop failing with EINVAL | 2026-09-07 | bf53dec0 | [260907-q0h-fix-issue-143-make-generated-command-nam](./quick/260907-q0h-fix-issue-143-make-generated-command-nam/) |
| 6 | Switch the Windows command name separator from dash to dot (follow-up to 260907-q0h, #143) | 2026-09-08 | 7ce485b1 | — |
| 260907-uzb | FMBOM-01: strip leading UTF-8 BOM at skill and agent frontmatter read sites | 2026-09-08 | fb54c5d7 | [260907-uzb-fmbom-01-strip-leading-utf-8-bom-at-skil](./quick/260907-uzb-fmbom-01-strip-leading-utf-8-bom-at-skil/) |
| 260909-g1l | correct UDISP-01 backlog entry and add bare plugin.json manifest-path entry | 2026-09-09 | 9a8f740b | [260909-g1l-correct-udisp-01-backlog-entry-and-add-b](./quick/260909-g1l-correct-udisp-01-backlog-entry-and-add-b/) |

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
| -------- | ---- | ------ | ----------- | --------- |
| Tooling | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted) | Pending | Phase 116 discussion | v1.19 |
| quick_tasks | 260720-d8i-move-agent-provenance-from-body-comment- | unknown | 2026-09-04 | v1.19 |
| todos | 2026-09-02-detect-unused-code-and-type-members.md | (presence-only) | 2026-09-04 | v1.19 |
| uat_gaps | 89/89-UAT.md (archived v1.16) | passed | 2026-09-04 | v1.19 |
| uat_gaps | 63/63-UAT.md (archived v1.13) | passed | 2026-09-04 | v1.19 |
| uat_gaps | 56/56-UAT-FIX-2.md (archived v1.12) | all_fixed | 2026-09-04 | v1.19 |
| uat_gaps | 56/56-UAT-FIX.md (archived v1.12) | all_fixed | 2026-09-04 | v1.19 |
| deferred_items | 112/deferred-items.md: Phase 112 deferred items - `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 1. Stale test path in an `install.messaging.ts` doc comment - **Found during:** 117-04 Task 1 - **File:** `extensions/pi-claude-marketplace/orchestrat | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 2. Stale byte-form-lock path in the output catalog - **Found during:** 117-05 Task 1 - **File:** `docs/output-catalog.md` (the `### Device Flow user-c | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 3. Stale `tests/helpers/` references throughout the codebase map - **Found during:** 117-07 Task 1 - **File:** `.planning/codebase/TESTING.md` (lines  | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 4. RESOLVED - `--all` cannot complete: the seven D-116-01a shortfalls are accepted - **Found during:** 117-11 Task 2 - **File:** `scripts/test-coverag | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 5. RESOLVED - The PATH interpreter was upgraded mid-phase and reddened 11 tests - **Found during:** 117-11 Task 2 - **File:** ten test suites, led by  | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 117/deferred-items.md: 6. RESOLVED - The direct-coverage sweeps still have no automated control **Resolved 2026-09-04 by operator decision.** Two parts, closed differently:  | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 90/deferred-items.md (archived v1.17): 90-03 execution - **Pre-existing environment failure (pi-subagents global peer):** two integration tests in `tests/integration/skill-path-resolution.t | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 86/deferred-items.md (archived v1.15): Pre-existing integration test failures (NOT introduced by Plan 03) Two `tests/integration/*` cases fail on the current branch. They fail IDENTICALLY w | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 85/deferred-items.md (archived v1.14): Pre-existing integration-test failures (unrelated to this phase) `npm run test:integration` reports 2 failures that also fail on the base commit `2aa2 | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 50/deferred-items.md (archived v1.11): Pre-existing test failure: reinstall README documentation gap - **Test:** `tests/architecture/reinstall-docs.test.ts` -- "PRL-01/03/04/05/13/14/15/16: | acknowledged | 2026-09-04 | v1.19 |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `tests/e2e/import-command.test.ts` 3 failures (`import imports enabled Claude settings across both scopes`, `import --scope project narrows writes to  | acknowledged | 2026-09-04 | v1.19 |

**One item could NOT be suppressed by the tool** - `deferred_items` phase 25 (archived
v1.4.1). Its deferred items live in a markdown TABLE, not a bullet list: the scanner
synthesizes that row's `text` by joining cells with ` - ` while the file stores them as
` | `, so the acknowledge writer's literal-text search can never match and it refuses with
`no deferred item matched --text`. The other 17 were suppressed normally. This one is
disclosed here instead and WILL resurface at the next milestone close - it was not silently
discarded, and the archived file was deliberately left byte-identical rather than
restructured to satisfy a scanner. Its content is a pre-existing
`tests/e2e/import-command.test.ts` failure already disclosed when v1.4.1 closed, and
`tests/e2e/**` is excluded from `npm run check`.

## Session Continuity

**Stopped at:** Phase 5 context gathered

**Resume file:** .planning/phases/05-prune-on-uninstall/05-CONTEXT.md
`HANDOFF.json` were consumed and removed on 2026-09-15. Their still-live
content was folded into `04-CONTEXT.md`: the supersession warning and the
ordering constraint into `<decisions>`, and the operational anti-patterns
(forcing the isolation sentinel per dispatch, `phase.complete`'s false
"file not on disk" warnings, the verifier `covered_digest` hazard) into a
carried-notes block under `<specifics>`.

**Read beside it:** `.planning/phases/04-install-provenance/04-CONTEXT.md`

Last session: 2026-09-16T20:01:54.268Z
resumed a paused Phase 4 discussion, answered its two open questions (the
config-write reversal lands entirely in Phase 4 in a fixed order; reconcile
keeps sweeping genuine orphans with one exemption), wrote `04-CONTEXT.md` and
`04-DISCUSSION-LOG.md`, reworded PROV-04, and reconciled the ROADMAP's Phase 4
criteria and notes against the decisions.

**Next:** Plan Phase 4 via `/gsd-plan-phase 4`. CONTEXT.md exists. The one
thing a planner must not get wrong is D-04-04's three-step order — step 3
(remove the config write) must never land in an earlier wave than step 2
(reconcile respects provenance).
Milestone v1.19 already closed.

### Historical v1.19 completion record

Plan counts here are MEASURED, not carried: 220 total and 220 complete, counted by `find` over
`1??-??-{PLAN,SUMMARY}.md` after this plan's SUMMARY landed. Every phase 108-117 has a SUMMARY for
every PLAN.

### What Phase 117 delivered, and what it left open

- **The last pair is closed.** `extensions/pi-claude-marketplace/index.ts` → `tests/index.test.ts`
  landed in 117-08 and the pair total is 204 of 204.
- **The `tests/edge/index-handler.test.ts` orphan is gone** — 117-08 deleted both legacy proxies
  while writing the entry owner, so the edge tier carries no unmirrored test and none of the 7
  `as any` / `as unknown as` casts it held.
- **The all-pair duration blocker is discharged.** Plan 117-11 measured 533.2 s for all 204 rows on
  Node v26.8.1, read from the runner's own printed line, and decided NOT to add concurrency against
  that number. No Node 24 is installed on this machine; CI pins it.
- **22 open Broken Windows entries** out of 29 rows, counted in 117-12 by a script that tallies the
  rows rather than reading the header. Seven are the D-116-01a coverage shortfalls (15-19, 21, 22),
  pinned by identity and closable only by a production rewrite; they must stay open. Entry 20 is the
  two `edge/register.ts` comments (18-20 and 104-106) asserting a registration-time `process.cwd()`
  capture the code does not make — it is read inside the completion arrow, per invocation. Entries
  23-26 and 29 are stale documentation references this phase created or found; entries 27 and 28,
  opened and closed by 117-11, are the all-pair reading and the errno hardening.
- **`BOOLEAN_FLAGS` is still re-exported from `edge/handlers/plugin/list.ts`** solely for
  `tests/architecture/flag-catalog-drift.test.ts` (`list.ts:82`, consumed at
  `flag-catalog-drift.test.ts:48`). Verified still present in 117-12 and left alone under D-117-13,
  which opened no production licence.
- **`tests/orchestrators/edge-deps.test.ts` still watches `globalThis.fetch`** — the precedent that
  spread the wrong door across twelve edge suites. It sits outside the edge tier so phase 116 left it;
  the git transport reaches the wire through `simple-get` → `https.request`, and `globalThis.fetch` has
  exactly one production caller (`domain/github-auth.ts`'s device flow, correctly watched by
  `tests/domain/github-auth.test.ts`).

### One open operator decision

1. **The tool's `available` / `unavailable` parameter DESCRIPTIONS** now admit a bucket their wording
   does not mention, after D-116-15's CR-01 fix made the `remote` and `partially-available` arms
   reachable. Changing them alters the LLM-facing contract and the pinned registration schema. Held
   open deliberately by D-117-14: the change is ONE-WAY, so a later revert is a second contract
   change rather than an undo. 117-12 records it and does NOT decide it.

**Closed by 117-12:** the REQUIREMENTS.md status drift. Measured before the sweep at **154** rows
reading `Open` — across phases 110, 111, 112, 113, 114, **116** and the phase-117 entry row, not the
~115 across 110-114 the earlier estimate claimed, because phase 116's own 30 rows were missed
entirely. All 154 are closed, and MOD-07 and MOD-10 are closed in both the checklist and the
requirement-to-phase mapping.

### Historical environment notes from v1.19

The current instructions in `CLAUDE.md` supersede the old commit recipe that follows.
The approved `.mcp.json` formatting removed the format blocker. All required hooks
must pass. Only `trufflehog` uses the documented filesystem-scan substitute.
The workstream archive removed the old routing blocker.

- **`npm run check` NEVER runs the tests.** `format:check` fails on the operator's pre-existing
  untracked files and short-circuits before `test`. Run `npm run typecheck`, `npm run lint`,
  `npm run fallow`, `npm test` and `npm run test:integration` SEPARATELY, checking each exit code.
- **Git hooks are not installed in this checkout** — a successful commit is not evidence hooks passed.
  Use the operator-approved recipe: filesystem trufflehog, per-file `prettier --check`, then
  `SKIP=trufflehog,npm-format-check pre-commit run --files <explicit paths>`.
- **This is a linked worktree**, so trufflehog needs the filesystem route.
- **This shell does not word-split**, and backticks inside `git commit -m` execute — use `git commit -F`.
- **`workflow.use_worktrees=false`**, so executors run sequentially on the shared tree, one at a time.
- **`phase.complete` cannot write the root planning files** under workstream mode — neither workstream
  holds v1.19 — so every phase transition is hand-applied. 114, 115, 116 and 117 all were, and the
  milestone close will be too.
- **`roadmap.update-plan-progress` mangles ROADMAP.md every single time** (31 for 31 in phase 116):
  hand-edit instead. ROADMAP carries the plan count in TWO places that drift independently.
- **`state.record-metric` double-increments `completed_plans`**; `state.update-progress` writes nothing;
  `state.advance-plan` increments without appending the plan id.
- **NEVER name a non-plan artifact `*-SUMMARY.md`** — that glob is counted as a plan summary by
  `find-phase`, `phase-plan-index` and `progress.bar`, and it silently inflates the phase count.

## Operator Next Steps

- Plan Phase 4 (Install provenance, PROV-01..04) via `/gsd-plan-phase 4`.
  `04-CONTEXT.md` exists and carries six decisions plus a fixed three-step
  ordering contract the plan must honor.
- **Decided 2026-09-15: `.planning/config.json` stays uncommitted.** It carries
  an agent-made `git.branching_strategy: milestone → none` alongside the
  operator's own `model_profile_overrides.codex` edit. The setting reads from
  disk, so Phases 4-5 honor it either way. Do not re-raise this, and do not
  revert the file.
- Optional, non-blocking: provide a genuinely private repository on github.com
  or gitlab.com to close UAT 2's last sub-item — a SUCCESSFUL credential
  challenge is still unexercised. The 401 arm was verified end to end.
- Optional, non-blocking: confirm whether alpha/beta/gamma were manually
  uninstalled from the UAT home. `tmp/pi-uat` ends with zero plugins in both
  `state.json` and `claude-plugins.json`, but only zeta and omega were
  uninstalled in the transcript. Most likely a deliberate teardown; if not, an
  unexplained removal would be a live reconcile bug.
- The UAT git server was still running at resume (`node tmp/uat-git/server.mjs`,
  `https://localhost:8443`). It is only needed to re-run UAT 2, and its TLS
  certs expire 2026-09-17.
- Phase 1 and Phase 2 verification both passed. Phase 2's full gate set (code
  review, Nyquist, security, regression, goal verification) is closed.
- Plan v1.20 phases with the UI gate skipped. No phase in this milestone is a
  frontend phase, but the keyword gate false-positives on "component", the flag
  "surface", and the `ui5` / `ui-theme-designer` plugin names.
