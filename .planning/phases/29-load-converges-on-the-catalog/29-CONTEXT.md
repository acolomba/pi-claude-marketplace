# Phase 29: Load Converges on the Catalog - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning
**Mode:** autonomous smart discuss (`--auto`); the orchestrating session relayed the user's 2026-10-24 decision and asked for a run without prompts, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

CAT-01..04: a load (`/reload`, session start) applies the desired state
against one internally consistent catalog version per marketplace. Every
enabled installed plugin whose recorded revision differs from what its
marketplace's catalog on disk offers moves to the catalog revision, offline.
A move that cannot happen offline (an uncached git target) stays put silently
and reads `upgradable` in `list`. A move that is blocked (a dependent's range,
or a new version that would drop components from a clean record) stays put
with a warning row on every load and appears in `pending`.

This replaces two things:

- the load-time backfill of partially installed plugins
  (`orchestrators/reconcile/backfill.ts`, BFILL-01..03 / WCONV-01), which
  phase 18 routed through `reinstall` and which only fired when the extension
  version changed;
- phase 18 WR-05's silent retry, where a range hold kept the backfill gate
  open with no row.

Out of scope: marketplace autoupdate (unchanged; it already moves plugins
over the network); the `update` and `reinstall` verbs' user-visible behavior;
disabled records (ENBL-08 stays: a load never re-materializes a plugin the
user disabled); delisted plugins (DLS-D1 stays: no catalog entry, so no
move, and the phase 28 `{not in manifest}` row and installed-copy dependency
read stay as they are); UAT-02 (Pi erases reload-time rows; it stays in
BACKLOG.md, which is why `pending` must preview everything).

</domain>

<decisions>
## Implementation Decisions

### Upstream position
- **D-01:** Claude Code keeps an installed plugin at its cached version until
  the user runs `/plugin marketplace update <name>` / `claude plugin update`,
  or until background auto-update (off by default per marketplace) runs.
  Evidence, retrieved 2026-10-24:
  `https://code.claude.com/docs/en/plugins/host-marketplace.md` ("Keep users
  up to date": "Without auto-update, users receive your changes when they run
  `/plugin marketplace update <name>` in a session or `claude plugin update
  <plugin>@<name>` in the shell"; "Bump `version` on each release: users stay
  on their cached copy until the string changes"; "Background auto-update is
  off for your marketplace by default"). One upstream case already converges
  at load: a plugin loaded in place from a marketplace added from a local path
  "loads your current files at every session start, whatever its version
  string says" (same page, "Release a new version"; also
  `plugin-marketplaces` "Test an edit to a plugin"). Phase 18 D-01 (binary
  2.1.309) established that an upstream install or reinstall always takes the
  catalog's current version. Confidence: high for the default (docs are
  explicit); the binary grep was not repeated for this phase (a whole-binary
  `grep -oa` with context timed out).

### The divergence (CAT-D1)
- **D-02 (CAT-D1, user, 2026-10-24):** a load moves every enabled installed
  plugin to its marketplace catalog's revision on disk, so a scope never runs
  plugins from two catalog versions of one marketplace (a dependent from the
  new catalog beside a dependency from the old one). Upstream keeps installed
  versions until `update` or auto-update. License: a recorded project decision
  (this ID). It extends upstream's own in-place behavior for local-path
  marketplaces to every source the load can serve offline, and it stays
  inside NFR-5 (D-05). REQUIREMENTS.md CAT-01..04 and PROJECT.md decisions
  cite CAT-D1.

### What counts as a move (CAT-01, CAT-04)
- **D-03:** a recorded plugin is a move candidate when it is enabled, its
  marketplace manifest lists it, and its offline candidate differs from the
  record: the candidate's version, sha, or plugin root differs (phase 18
  D-11's same-revision test), OR its supported component set strictly grew
  (the BFILL-01 growth test, now evaluated on every load). The candidate is
  derived by the same offline resolution `list` uses for `upgradable`
  (`resolveListCandidate` / the one version rule), so `list`, `pending` and
  the load agree on every plugin.
- **D-04:** CAT-04 — the growth test and the version test are one predicate
  in one pass; there is no separate backfill scan. `backfill.ts` as a module
  is replaced (renamed or rewritten) by the convergence pass; its fault
  isolation (per-plugin try/catch, per-scope `runScopeIsolated`), its RECON-04
  already-touched dedupe, its ENBL-08 disabled filter, and its SF-01/SF-02
  failed-row behavior carry over.
- **D-05:** the extension-version gate (`lastReconciledExtensionVersion`,
  D-68-01/D-68-03) no longer gates anything: a catalog can change without the
  extension version changing, so the pass runs on every load. RECON-05 holds
  because a load with no move candidate writes nothing (no stamp, no record
  write, state.json mtime unchanged). The persisted field stays readable in
  the schema (no migration); whether it is still written is the planner's
  call, but no write may happen on a no-change load.

### Network (CAT-02, NFR-5)
- **D-06 (option b):** the load makes no network request. A git-source
  candidate whose target commit is not already in the scope's cache (mirror
  or per-commit copy) is not a move: the plugin stays at its version, the
  load emits no row for it, `pending` lists no move for it, and `list` reads
  `upgradable` for it (where the catalog shows a different target offline,
  e.g. a sha/ref pin or a version that differs from the record). `update`
  fetches it. The shared runner gets whatever policy knob it needs so a load
  never clones a missing mirror and never refreshes one (today
  `refreshSource: false` still clones a missing mirror).
- **D-07:** the dependency-constraint gate runs offline at load: it never
  lists a dependency repository's tags (D-03-03's network read is for the
  verbs). A candidate a dependent's range does not admit is blocked (D-09);
  the load does not look for an admitting tag.

### One catalog version (CAT-01)
- **D-08:** ranges are judged against the scope as it will stand after the
  load: a dependent that also moves this load is judged by the declarations
  of its catalog candidate, a dependent that stays (blocked, uncached,
  disabled, delisted) by its recorded or installed-copy declarations (DLS-D1).
  So when a catalog bumps a dependency and widens its dependent's range
  together, both move. The ordering or fixed-point that achieves this is the
  planner's call; the result must be deterministic and identical between the
  load and `pending`.

### Blocked moves (CAT-03)
- **D-09:** two block reasons, each a warning row on every load (no silent
  retry; WR-05's silent gate-open is gone):
  - a dependent's range does not admit the candidate: the update verb's
    range-hold row shape, `(skipped) {dependents constrain}` at `warning`;
  - a clean record (`installable: true`) whose candidate resolves
    `partially-available` (it would drop components): the update decline row,
    `(partially-upgradable)` at `warning` with its `--partial` hint (XSURF-03),
    because flipping a clean record to degraded is a consent the user has not
    given (WCONV-01's stance, unchanged). A record already `installable:
    false` was installed under that consent and moves.
  A blocked plugin stays at its recorded version and the load writes nothing
  for it.
- **D-10:** a move that fails at materialization (EACCES, bridge failure)
  keeps backfill's `(failed)` row with its closed-set reason and is retried on
  the next load; that retry is visible because the row repeats.

### Rows (load cascade)
- **D-11:** a move whose version changed renders as the update row,
  `(updated) <from> → <to>` (same composer as the `update` verb's row), inside
  the reload cascade. A growth-only move (same version, supported set grew)
  keeps the existing backfill rows (`(installed)` / `(partially-installed)`
  with the WCONV-03 `{components now supported}` marker). When both happen,
  the `(updated)` row carries the convergence marker; the exact composition is
  the planner's call within `docs/output-catalog.md`'s grammar. RECON-04
  single-emit stays: one row per plugin per load. Severity follows the
  existing projections (a clean move is `info`; blocked rows are `warning`).

### Pending (CAT-03, CAT-04)
- **D-12:** `pending` previews exactly what the next load would do, from the
  same planning function the load runs (one async, offline convergence
  planner shared by `apply.ts` and `pending.ts`, beside the synchronous
  `planReconcile`). It lists every move as a `(will update) <from> → <to>`
  row (a new pending-tense status, with a growth-only move at equal versions
  as the D-18-11 precedent allows) and every blocked plugin with the row the
  load would emit (D-09). D-66-05 ("no `will partially update` analog,
  because the plan has no update bucket") is superseded: the plan now has
  one. The empty advisory (`Pending: next reload will apply 0 actions.`)
  still renders when there is no move and no block.
- **D-13:** adding a pending status touches a closed set
  (`PLUGIN_STATUSES`, the pending row policies, the output catalog's status
  table and count, completions and LLM-tool projections that switch over it).
  Every switch over the set must handle it explicitly (the optional-field
  silent-omission class); `docs/output-catalog.md` gains the new rows and its
  counts are updated.

### Scenarios
- **D-14:** cucumber coverage, in a new `features/plugin/reconcile-catalog.feature`
  plus `pending.feature` additions (and `update.feature` only if an existing
  scenario's expectation changes), each scenario hermetic:
  1. after `marketplace update` moves a path-source plugin and a git-source
     plugin whose new commit is already cached, `/reload` reports both
     `(updated)` and the records, `list`, and a new session show the catalog
     versions; a second `/reload` changes nothing and writes nothing (CAT-01);
  2. a git-source plugin whose new commit is not cached stays, `list` reads
     `upgradable`, and the request log shows no request during the load
     (CAT-02);
  3. a range-blocked plugin and a clean plugin whose new version drops a
     component each stay with their warning rows, `pending` lists both, and a
     second load shows the same rows again (CAT-03);
  4. a partially installed plugin whose components became supported is made
     whole by the load, and `pending` beforehand shows the move (CAT-04).
  Existing scenarios and unit tests that assert a load leaves a moved catalog
  alone are updated to CAT-D1, each change named in the plan.

### Claude's Discretion
- Module names (the convergence planner, the replacement for `backfill.ts`),
  the policy knob's name and shape, and how the shared planner is threaded
  into `apply.ts` and `pending.ts`.
- Whether `lastReconciledExtensionVersion` is still written on a load that
  moved something (D-05 bounds it).
- Exact row composition for the combined version-plus-growth move (D-11) and
  the `(will update)` glyph, within the output catalog's grammar.
- Scenario titles and step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 29; `.planning/REQUIREMENTS.md` CAT-01..04
- `.planning/phases/18-update-and-reinstall-unification/18-CONTEXT.md` (D-04 policy knobs, D-11 same-revision test, D-12 backfill via reinstall)
- `.planning/phases/18-update-and-reinstall-unification/18-REVIEW.md` WR-05 (silent retry being replaced)
- `.planning/phases/28-delisted-plugin-dependency-walk/28-CONTEXT.md` (DLS-D1, kept)
- `.planning/BACKLOG.md` UAT-02 (reload rows erased; reason `pending` must preview)
- `docs/output-catalog.md` (backfill rows WCONV-03, `(partially-upgradable)` decline XSURF-03, `(updated)` row, status table)
- `.agents/skills/claude-code-compat-research/SKILL.md`; upstream docs `https://code.claude.com/docs/en/plugins/host-marketplace.md`
- `.agents/skills/cucumber/`, `.agents/skills/local-verification/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/materialize-latest.ts::materializeLatestVersion(args, policy)` — the shared update/reinstall runner; `MaterializationPolicy` (`update-preflight.ts`) has `refreshSource`, `skipSameRevision`, `overwrite`.
- `orchestrators/plugin/update-constraint-gate.ts::evaluateUpdateConstraint` — the range gate (has a tag-listing network path the load must not take).
- `orchestrators/plugin/list-installed-row.ts::upgradeCandidate` and `resolveListCandidate` — offline candidate + version rule used for `upgradable`.
- `orchestrators/reconcile/backfill.ts` — fault isolation, dedupe, disabled filter, failed rows, growth test (`supportedSetGrew`), WCONV-01 clean-record refusal.
- `orchestrators/reconcile/notify.ts::resolvePendingForceInstalls` / `buildReconcilePendingNotification` — pending projection.

### Established Patterns
- Guard-free bodies under one per-scope lock; `proper-lockfile` is not re-entrant (backfill runs with no outer lock).
- BLOCK F network-free ESLint rule over `orchestrators/` and `domain/`; reconcile `apply.ts`/`types.ts` are `NETWORK_SEAMS`, `pending.ts` is not.
- RECON-05 mtime invariant; RECON-04 single-emit per plugin per load.

### Integration Points
- `orchestrators/reconcile/apply.ts` calls `applyBackfillForScopeIsolated` per scope after `applyPlan`.
- `orchestrators/reconcile/pending.ts::pendingReconcile` builds plans then the projection.

</code_context>

<specifics>
## Specific Ideas

- The user's words: "one internally consistent catalog version per marketplace"; "No load retries silently."

</specifics>

<deferred>
## Deferred Ideas

- UAT-02 (Pi erases reload-time rows) stays in BACKLOG.md.
- Offering an admitting tag at load for a range-blocked plugin (needs the network; `update` does it).

</deferred>

---

*Phase: 29-load-converges-on-the-catalog*
*Context gathered: 2026-10-24*
