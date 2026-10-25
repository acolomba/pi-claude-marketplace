# Phase 29: Apply Command and Read-Only Reload - Context

**Gathered:** 2026-10-24 (revised the same day)
**Status:** Ready for planning
**Mode:** autonomous smart discuss (`--auto`). The orchestrating session relayed the user's 2026-10-24 decision and asked for a run without prompts, so every recommended answer below was taken without a prompt. This revision supersedes the first version of this file (decision CAT-D1, "load converges on the catalog"), which is withdrawn.

<domain>
## Phase Boundary

APL-01..04: changing installation state is always an explicit command.
`/claude:plugin apply` reaches the desired state. A load (`/reload`, session
start) only reloads resources and reports what is pending.

- **Load:** no install, uninstall, enable, disable, update, reinstall or
  backfill. Resource discovery, the hook routing table and the plugin path
  keep running. On a mismatch the load prints the block `pending` prints,
  with a trailer that says to run `/claude:plugin apply`. A matching state
  prints nothing.
- **`apply`:** makes every change `pending` lists, converges every installed
  plugin on its marketplace's catalog version on disk (this includes the old
  partial-plugin backfill), and ends by suggesting `/reload`.
- **`pending`:** advises `apply` instead of `/reload`.

Out of scope: UAT-02 (Pi erases rows emitted during `/reload`; it stays in
BACKLOG.md). Marketplace autoupdate is unchanged: the explicit
`marketplace update` verb keeps its plugin cascade, and no session-start
network refresh is added (D-09, D-27).

</domain>

<decisions>
## Implementation Decisions

### Upstream position
- **D-01:** Claude Code separates three stages: declared (settings
  `enabledPlugins` / `extraKnownMarketplaces`), fetched (on disk), and loaded
  (the running session). Evidence from
  `https://code.claude.com/docs/en/plugins/loading.md`, retrieved 2026-10-24:
  - "Plugins load at session start from `installed_plugins.json` and the
    cache without using the network."
  - "Changes to settings or to disk don't reach this layer until you run
    `/reload-plugins` or start a new session."
  - After the session starts, a background pass clones a declared marketplace
    that `known_marketplaces.json` lacks, "then reloads plugins and downloads
    enabled plugins that aren't cached yet". A changed marketplace source is
    re-fetched with "Plugins changed. Run /reload-plugins to activate."
  - A plugin enabled only in the project's `.claude/settings.json` with an
    external source is NOT fetched: "Plugin "<name>" is enabled in project
    settings but isn't installed here". The user installs it by command.
    Relative-path plugins load from the marketplace copy with no install.
  - Background auto-update (off by default except for official marketplaces)
    "refreshes every marketplace with auto-update on and updates the plugins
    installed from them on disk. The running session keeps the versions it
    loaded, and you see `Plugin updated: <name> · Run /reload-plugins to
    apply`".
  - `org.md` (same date): managed-settings `enabledPlugins` plugins are
    installed "at the start of the user's next session", in the background.
  - `host-marketplace.md` (same date): without auto-update, users get changes
    from `/plugin marketplace update` or `claude plugin update`. "Users stay
    on their cached copy until the string changes".

  So upstream's load itself never changes what is installed. The disk
  changes (declared installs from user/managed settings, auto-updates) happen
  in an automatic background pass after start, and the user activates them
  with `/reload-plugins`. Confidence: high (explicit docs). The binary was not
  grepped for this revision.

### The divergence (APL-D1)
- **D-02 (APL-D1, user, 2026-10-24):** a load changes no installation state.
  Every install, uninstall, enable, disable, update, reinstall and backfill
  that the declared config or the catalog implies waits for an explicit
  `/claude:plugin apply`. Upstream matches the read-only load. It diverges in
  two places:
  - Upstream installs declared user/managed-settings plugins and auto-updates
    in an unattended background pass. Pi does neither until `apply` runs.
  - Upstream `/reload-plugins` activates what is on disk. Pi's `apply` writes
    the disk, and `/reload` activates.

  License: a recorded project decision (this ID). It also covers Pi's own
  extra: `apply` converges installed plugins on the catalog version
  (APL-02), which upstream only does through `update` or auto-update.
- **D-03 (APL-D2, user, 2026-10-24):** NFR-2 is amended. "`Run /reload` must
  suffice" becomes "`/claude:plugin apply`, then `/reload`, must suffice". No
  fix may require a Pi process restart. AGENTS.md (Constraints, Recovery
  model) and `.planning/PROJECT.md` carry the amended wording, done in this
  discuss commit. REQUIREMENTS.md's NFR-2 text, if it carries one, follows in
  the plan.

### Load (APL-03)
- **D-04:** at load, the reconcile apply step (`applyPlan`'s installs,
  uninstalls, enables, disables, dependency-disables) and the backfill pass
  stop running. What keeps running:
  - resource discovery (`aggregateDiscoveredResources`)
  - the hook routing rebuild
  - `recomputePluginPath`
  - the phase 28 delisted `{not in manifest}` warning (DLS-D1 kept)
  - the load-time format migrations that change no installed set: MIG-01
    first-run config migration, the `mcp.json` -> `mcp-adapter.json` move
    (mcp-migration), and the legacy state migration

  The planner confirms each migration against "changes no installation
  state". Any doubt goes to the deferred list rather than being dropped.
- **D-05:** on a mismatch, the load emits one block: the same composer and
  rows `pending` uses, with the reload's own trailer `Run /claude:plugin
  apply to apply these changes.` (exact wording is the planner's call, within
  `docs/output-catalog.md`'s grammar). It sends no `Run /reload` hint, since
  nothing changed. A matching state emits nothing (RECON-05 also holds: a load
  writes nothing to state.json). The rows the load used to emit for applied
  transitions (`reconcile-applied-cascade`) are no longer emitted at load.
  Their composers move to `apply`'s report.
- **D-06:** the load computes the same offline plan `pending` computes
  (NFR-5: a load and `pending` never touch the network). This includes the
  catalog moves of D-10 and the blocked rows of D-12. The load's block and
  `pending`'s rows are byte-identical apart from the trailer.

### `apply` (APL-01, APL-02)
- **D-07:** `/claude:plugin apply [--scope user|project]` takes the same scope
  flags as `pending`. With no flag it covers both scopes, project first
  (MSG-GR-3). It runs the existing reconcile apply machinery
  (`applyReconcile`'s plan + apply step + the catalog convergence pass) under
  the per-scope state lock, using the same lock discipline the load used.
  Proper-lockfile is not re-entrant (CR-01), so guard-free bodies stay as
  they are.
- **D-08:** `apply` reports one row per change: the composers the load used
  (`reconcile-applied-cascade` rows for install/uninstall/enable/disable,
  backfill rows), plus `(updated) <from> → <to>` for a catalog move. It ends
  with the `Run /reload` hint, because `apply` changed state that the running
  session has not loaded. With nothing to do, it reports so, uses the same
  empty advisory form `pending` uses but in apply's wording, and writes
  nothing. Afterwards `pending` lists nothing except blocked moves (D-12).
- **D-09 (autoupdate):** unchanged. No load path runs a marketplace
  autoupdate today (`autoupdate.ts` only flips the config flag), and none is
  added. An explicit `marketplace update` on an autoupdate marketplace keeps
  updating its plugins. Superseded the earlier "refresh marketplaces only"
  wording; see D-27.

### Catalog convergence inside `apply` (APL-02)
- **D-10:** a recorded plugin is a move when all of these hold:
  - it is enabled
  - its marketplace manifest lists it (delisted plugins are DLS-D1:
    no move)
  - its catalog candidate differs from the record: the version, sha or
    plugin root differs (phase 18 D-11's same-revision test), OR its
    supported component set strictly grew (the BFILL-01 growth test,
    evaluated on every `apply`, so the extension-version stamp no longer
    gates it)

  Disabled records are never moved (ENBL-08).
- **D-11:** `apply` materializes moves through the shared runner
  (`materialize-latest.ts`, phase 18), the same path `update` uses. It may
  clone a git target on a cache miss and may list a dependency's tags for a
  constraint, as install and update do (NFR-5 allows it, D-03-03). `pending`
  and the load preview moves offline. A git target `pending` cannot resolve
  offline shows as a move when the catalog shows a different target offline
  (a different sha/ref pin or version). Otherwise it is not previewed. The
  planner chooses whether `apply` refreshes an unpinned mirror (update's
  `refreshSource: true`) or reads the mirror's HEAD (`false`). The
  recommended default is `false`, so `apply` applies exactly what `pending`
  previewed, and `update` stays the verb that fetches.
- **D-12 (blocked moves):** two reasons. Each stays put with a warning row in
  `apply`'s report, and `pending` keeps listing it with the same row:
  - a dependent's range does not admit the candidate:
    `(skipped) {dependents constrain}` at `warning`, the update verb's
    range-hold row;
  - a clean record (`installable: true`) whose candidate resolves
    `partially-available` (it would drop components without consent):
    `(partially-upgradable)` at `warning`, the update decline row with its
    `--partial` hint (XSURF-03). WCONV-01's consent stance is unchanged. A
    record already `installable: false` moves.

  Phase 18 WR-05's silent gate-open retry is gone: no row, no retry. Ranges
  are judged against the scope as it will stand after `apply`. A dependent
  that also moves is judged by its candidate's declarations, and one that
  stays is judged by its recorded or installed-copy declarations (DLS-D1).
  The algorithm (ordering or fixed point) is the planner's call. It must be
  deterministic and shared by `apply`, `pending` and the load.
- **D-12a (amends D-12, user decision 2026-10-25):** a dependent that stays
  put is judged by its catalog declarations plus its installed copy's, not
  by the installed copy alone. A range that either copy names holds the move.
  Reason: the load-time dependency check, `update`'s gate and `apply`'s runner
  all read a listed plugin's catalog copy (D-05-06), so judging by the
  installed copy alone let `pending` list a move that `apply` then held, or
  let `apply` make a move the next load's dependency check rejected.
- **D-12b (user decision 2026-10-25, superseded the same day):** the user
  accepted a release-only rule, where one `apply` may lift a dependency hold
  on a dependent whose dependency the plan moves into range but never adds a
  hold, so a missed hold takes effect on the next `apply`. The code that
  carried it (121c6168) was reverted in 288f5c6b before the decision arrived,
  because its third review showed real failures beyond the accepted cost: a
  released dependent could move to a version whose range stays unmet with no
  later pass reporting it, and a planned move that never lands released the
  dependent on every pass. As shipped, a dependent and the newer dependency
  it needs, shipped together, converge in two applies. One-apply convergence
  for that case is deferred.
- **D-13:** a move that fails at materialization (EACCES, a bridge failure)
  gets the `(failed)` row with its closed-set reason. `apply` is safe to
  retry (NFR-3). The extension-version stamp (`lastReconciledExtensionVersion`)
  no longer gates the backfill. It stays readable in the schema with no
  migration, and whether `apply` still writes it is the planner's call
  (fallow dead-code must stay green).

### Pending (APL-04)
- **D-14:** `pending` lists every change `apply` would make: the existing
  plan buckets, plus `(will update) <from> → <to>` for each catalog move (a
  new pending-tense status; a growth-only move renders with equal versions,
  the D-18-11 precedent), plus the D-12 blocked rows. D-66-05 ("no `will
  partially update` analog, because the plan has no update bucket") is
  superseded. The trailer and the empty advisory change from `/reload` to
  `/claude:plugin apply`.
- **D-15:** a new status is a closed-set change: `PLUGIN_STATUSES`, the
  pending row policies, the output catalog's status table and counts,
  completions, the browser and the LLM-tool projections. Every switch over
  the set handles the new member explicitly (the optional-field
  silent-omission class).

### Command surface (APL-04)
- **D-16:** `apply` gets an edge handler, a router entry, args-schema and
  flag-catalog entries, completions, help text, the JSON output wire format
  (`docs/json-output.md`), and `docs/output-catalog.md` catalog states for
  its rows and its empty case. Use the closest existing verb (`pending` /
  `import`) as the template. `apply` is not an LLM tool unless the existing
  read-only tool policy says otherwise; the planner checks `edge/handlers/tools.ts`.

### Kept behavior
- **D-17:** `import` (phase 19) still installs directly through the reconcile
  planner. It is an explicit command, so it keeps changing state.
- **D-18:** phase 28's DLS-D1 (a delisted plugin's dependencies come from its
  installed copy) and the per-session `{not in manifest}` warning at load
  stay.

### Scenarios
- **D-19:** a new `features/plugin/apply.feature` covers APL-01/02:
  - apply makes every pending change, after which pending is empty;
  - apply with nothing pending writes nothing;
  - after `marketplace update` moves a path-source and a git-source plugin,
    apply installs both at the catalog version;
  - a range-blocked move and a consent-needing partial move stay put with
    warning rows and remain in pending;
  - a partially installed plugin whose kind became supported is made whole.

  `reconcile*.feature` and `pending.feature` cover APL-03/04:
  - `/reload` after hand-editing the config changes no state and prints the
    pending block with the `apply` trailer;
  - `/reload` with nothing pending prints nothing;
  - pending names `apply`.

  Existing scenarios that trigger installation changes through a reload or a
  new session move to `apply`. They keep their assertions; only the trigger
  and the trailer change, and the plan names each moved scenario. All
  scenarios are hermetic.

### Research follow-ups (decided 2026-10-24, from 29-RESEARCH.md open questions)
- **D-20:** marketplace add and remove that a hand-edited config declares
  move to `apply`. A git add clones, and a load stays offline. `pending` and
  the load's block gain marketplace-level rows (`will add` / `will remove`),
  superseding WILL-01's "add is immediate, not previewed". `marketplace add`
  and `marketplace remove` as verbs are unchanged.
- **D-21:** the LOAD-01 dependency-disable is a disable, so it moves to
  `apply`, and `pending` lists it as `will disable`. Until `apply` runs, the
  load's block names it.
- **D-22:** the AMIG-01 MCP format move stays at load (it changes no
  installed set). `apply` also runs the same sweep after it installs, so a
  plugin `apply` installs gets its entries moved too.
- **D-23:** `apply` takes the catalog version only and never searches for a
  matching release tag (the constraint gate's tag listing is off for
  `apply`). A range that does not admit the catalog version is a D-12
  `{dependents constrain}` warning. `update` stays the verb that searches
  tags. This keeps `pending` and `apply` identical.
- **D-24:** the `(partially-upgradable)` row's hint in `apply` and `pending`
  names the per-plugin consent command, `update <plugin>@<marketplace>
  --partial` (the remedy matches the failure axis). The row stays `warning`
  in every cardinality. `apply` gets no `--partial` flag.
- **D-25:** "reinstall" in APL-01 means the partial-plugin backfill (a
  growth-only move, D-10). `apply` never restores deleted artifacts: a
  config-to-record reconciliation does not detect them, and `reinstall` is
  the repair verb.
- **D-26:** catalog moves go through a new runner entry beside
  `beginPluginUpdateRun`, NOT through reinstall. Reinstall deletes the plugin
  data directory and overwrites user-edited agents. The policy is
  `refreshSource: false, skipSameRevision: true, overwrite: false`, with
  `partial` admitted only for records already `installable: false`, and an
  explicit `cwd`.
- **D-27 (user, 2026-10-24, option C):** leave marketplace autoupdate as it
  is. Success criterion 4 and the APL-03 autoupdate clause are dropped. No
  session-start network refresh is added, so NFR-5 is unchanged.
  `orchestrators/marketplace/autoupdate.ts` is out of scope.

### Claude's Discretion
- Module names and the split between `apply.ts`, `backfill.ts` and a new
  convergence planner, and how the shared offline planner is threaded into
  the load, `pending` and `apply`.
- Exact trailer and empty-advisory wording, the `(will update)` glyph, and
  the combined version-plus-growth row composition, within the output
  catalog's grammar.
- `refreshSource` for `apply` (D-11's default recommended).
- Scenario titles and step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 29: Apply Command and Read-Only Reload"; `.planning/REQUIREMENTS.md` APL-01..04
- `AGENTS.md` Constraints (NFR-2, NFR-5, Upstream parity); `.planning/PROJECT.md`
- `.planning/phases/18-update-and-reinstall-unification/18-CONTEXT.md` (D-04 policy knobs, D-11 same-revision test, D-12 backfill via reinstall), `18-REVIEW.md` WR-05
- `.planning/phases/19-*/` (import on the reconcile path, kept)
- `.planning/phases/28-delisted-plugin-dependency-walk/28-CONTEXT.md` (DLS-D1, kept)
- `.planning/BACKLOG.md` UAT-02
- `docs/output-catalog.md`, `docs/json-output.md`
- Upstream: `https://code.claude.com/docs/en/plugins/loading.md`, `.../plugins/org.md`, `.../plugins/host-marketplace.md` (retrieved 2026-10-24)
- `.agents/skills/claude-code-compat-research/SKILL.md`, `.agents/skills/cucumber/`, `.agents/skills/local-verification/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/reconcile/apply.ts::applyReconcile`: plan + apply + backfill + delisted scan, called from `index.ts` `resources_discover`. The apply machinery moves behind the new verb.
- `orchestrators/reconcile/pending.ts::pendingReconcile` and `notify.ts::buildReconcilePendingNotification`: the block the load and `pending` share.
- `orchestrators/plugin/materialize-latest.ts::materializeLatestVersion` (`MaterializationPolicy`: `refreshSource`, `skipSameRevision`, `overwrite`), `update-constraint-gate.ts::evaluateUpdateConstraint`.
- `orchestrators/plugin/list-installed-row.ts::upgradeCandidate` / `resolveListCandidate`: the offline candidate and version rule.
- `orchestrators/reconcile/backfill.ts`: growth test, WCONV-01 refusal, per-plugin fault isolation.

### Established Patterns
- One `notify()` per command (IL-2). Guard-free bodies under per-scope locks (not re-entrant).
- BLOCK F network-free rule: `pending.ts` is not a NETWORK_SEAM. `reconcile/apply.ts`/`types.ts` are.
- RECON-04 single-emit per plugin. RECON-05 no write on a no-change pass.

### Integration Points
- `extensions/pi-claude-marketplace/index.ts` (`resources_discover`, `session_start`), `edge/router.ts`, `edge/register.ts`, `edge/handlers/`, `edge/completions/`, help.

</code_context>

<specifics>
## Specific Ideas

- The user's words: "Changing installation state is always an explicit command."

</specifics>

<deferred>
## Deferred Ideas

- UAT-02 (Pi erases reload-time rows) stays in BACKLOG.md. The load's pending block is visible at session start but may be erased on `/reload`. `pending` and `apply` are the reliable surfaces.

</deferred>

---

*Phase: 29-apply-command-and-read-only-reload*
*Context gathered: 2026-10-24 (revised)*
