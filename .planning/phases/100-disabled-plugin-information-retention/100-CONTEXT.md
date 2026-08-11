# Phase 100: Disabled-plugin information retention - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>

## Phase Boundary

Disabling a plugin deregisters its resources from Pi without discarding the
installation record's description of them, so `info` on a disabled plugin
reports what the plugin contains -- including when the marketplace manifest no
longer declares it -- while still reporting the plugin as disabled.

In scope: the disable write path, the three surviving resources-emptiness
readers, the persisted hook-entry detail, the `info` disabled arm's render
shape, and the `{not in manifest}` reason on disabled rows.

Out of scope: converging reinstall/update's old-version removal onto the shared
record-driven cascade primitive (see Deferred Ideas), and any change to how
`info` resolves a plugin that is still declared in a readable manifest.

</domain>

<decisions>

## Implementation Decisions

### Correction to the roadmap's scoping premise (read this first)

The ROADMAP Phase 100 section states: *"Nothing reads resources-emptiness as a
signal any more; ENBL-05 removed the last reader, so relaxing the shape breaks
no predicate."* **That claim is false.** Three live readers were found during
discuss, and the first is a correctness hazard rather than a cosmetic one:

- **`bridges/hooks/event-router.ts:596`** -- `hydrateScopeFromState` iterates
  every plugin record and hydrates hooks whenever `resources.hooks.length > 0`.
  It carries **no `enabled` guard**. Emptiness *is* the disabled filter for hook
  routing today. Keeping `resources.hooks` populated on disable without adding
  that guard re-registers a disabled plugin's hooks on the next `/reload`. The
  current safety comes from file-absence (disable deletes `hooks.json`, so the
  read fails and logs), not from any check.
- **`orchestrators/plugin/list.ts:389-390`** -- `declaresAgents` /
  `declaresMcp` derived from `resources.agents.length > 0` /
  `resources.mcpServers.length > 0`, driving the soft-dependency markers.
- **`orchestrators/plugin/reinstall.ts:1761-1762`** -- the same derivation.

The phase's real spine is therefore ENBL-05 one axis over: replace these
emptiness reads with `enabled` reads. Any plan that treats retention as a
one-line change to `toDisabledRecord` is wrong.

### Hook detail while disabled

- **D-100-01:** Hook entries are **persisted on the installation record** under
  a new **top-level optional key**, following the `resolvedSha` precedent
  (`persistence/state-io.ts:62-68`): optional, additive, a legacy record without
  it loads unchanged, no migrate fill, **no `schemaVersion` bump**. Nesting the
  key inside `resources` was rejected: it would pass COMPAT-01's key-set clause
  only because that clause reads top-level properties, which is dodging the gate
  rather than amending it. Widening `resources.hooks`' element type was rejected
  because legacy records hold plain strings, forcing a union or a
  `schemaVersion: 3` migration the milestone promised not to require.
  — **Reversibility:** costly — the key ships in on-disk `state.json` records;
  removing it later means either tolerating an unknown key on read or writing a
  migration, and every install/update/reinstall write site has to be unwound.
- **D-100-02:** The persisted payload is **supported entries only** (event plus
  matcher) -- byte-parity with the hooks line today, because the materialized
  file is the filtered supported subset by construction. Recording the
  dropped/unsupported handlers an install partitions out was considered and
  deferred: that is information the record has never held, not information this
  phase is preventing the loss of.
- **D-100-03:** `readStateOnlyHookEntries` (`orchestrators/plugin/info.ts:540`)
  **survives as a legacy fallback**. The record wins when the key is present;
  the materialized-file read covers its absence. This prevents a regression for
  existing **enabled** manifest-absent records, which read correctly today and
  would otherwise report no hooks until something rewrote them. Records
  self-heal on the next install/update/reinstall/enable.
- **D-100-04:** Disable **keeps calling `removeHookConfig`**. Artifact removal
  stays symmetric across all five kinds; only the record's *description* is
  retained. The alternative -- leaving `hooks.json` on disk and letting the new
  hydrate guard do the deregistration -- was put to the operator twice, in two
  independent framings, and rejected both times.
- **D-100-05:** `hydrateScopeFromState` **gains an `enabled` guard**, read
  through `persistence/state-io.ts::isRecordedButDisabled` rather than the raw
  boolean, so the site cannot drift from the ENBL-05 definition. This is
  mandatory, not optional -- see the correction above.

### Rendered output

- **D-100-06:** `declaresAgents` / `declaresMcp` guard on `enabled` at both
  derivation sites (`list.ts:389-390`, `reinstall.ts:1761-1762`) so a disabled
  row renders **byte-identically to today**. Soft-dependency markers state a
  runtime concern that is suspended while the plugin is disabled. Preserves
  D-97-01's bare disabled row.
- **D-100-07:** A disabled row may carry **`{not in manifest}` and no other
  reason**, on both `list` and `info`. The governing rule, recorded for future
  authors as a refinement of D-95's durable-vs-transient guidance: **render
  durable facts that constrain what the user can do next; suppress facts about
  runtime behavior that is currently suspended.** Manifest absence qualifies
  because it is load-bearing -- `runEnableBranch` (`enable-disable.ts:251`)
  re-runs `runInstallLedger`, which resolves from the marketplace manifest, so a
  disabled manifest-absent record **cannot be re-enabled** and today's bare row
  gives no warning before the attempt. Stamping the full applicable reason set
  was rejected because it would reverse D-97-01 (moving the disabled-partial
  row's bytes and catalog fixture) and would sit inconsistently beside D-100-06.
- **D-100-08:** The disabled arm **routes through `buildBlock`**.
  `partitionDisabledScopes` (`info.ts:2073`) stops short-circuiting, and
  `PluginInfoRowBase`'s `Extract<PluginStatus, ...>` (`notify.ts:1337`) widens
  with `disabled`. This is a **per-surface subset widening, not a new status
  token**: `disabled` is already one of the 19 `PLUGIN_STATUSES` members, so
  COMPAT-01's status clause (`compat-01-no-expansion.test.ts:230`) and SNM-02's
  19-entry lock both stay green. FSTAT-07 / D-66-04 widened this exact `Extract`
  once before, to add `partially-installed`, with the rationale recorded inline
  at `notify.ts:1332`.

  Two consequences the planner must carry deliberately rather than inherit:
  the D-96-04 `{already disabled}` fetch-skip note must survive the reroute, and
  the disabled `info` row's bytes move (it gains description and components), so
  catalog states and byte fixtures move with it. One thing gets *simpler*: the
  mixed-message-kind problem the code flags at `info.ts:2352-2356` dissolves,
  because a disabled scope stops being a foreign shape needing its own
  `notifyWithContext` call.

### Backfill

- **D-100-09:** **No backfill.** Enable overwrites `resources` wholesale, so the
  next enable/disable cycle repopulates a record. Combined with D-100-08 --
  which lets a still-declared disabled plugin resolve from the manifest exactly
  as an uninstalled one does -- the unrecoverable population is bounded to:
  *disabled before this ships, AND the manifest later drops the entry, AND never
  re-enabled.* A record-only reconcile scan was rejected because it would reopen
  the region ENBL-08 fenced off (`reconcile/apply.ts:1096`), weakening that
  invariant from "never scan a disabled record" to "never materialize and never
  flip `enabled`", and because the names it wrote would predict what an install
  *would* generate rather than record what it did. Opportunistic
  persist-on-read was rejected outright: it would make `list`/`info` writers,
  and they are today lock-free, network-free and mutation-free with coverage
  asserting exactly that.

### Type invariant

- **D-100-10:** `DisabledPluginRecord`'s empty-tuple pin is **re-pointed at the
  new invariant** rather than narrowed or dropped. `toDisabledRecord`
  (`state-io.ts:122`) becomes generic in its resources shape -- input
  `resources: R`, output `enabled: false` with `resources: R` -- so "disable
  changed the inventory" is a compile error at the producer. The type stops
  pinning the retired marker and starts pinning this phase's central guarantee.
  Narrowing the brand to `enabled: false` alone was rejected because structural
  typing makes it pin nothing while still reading as a guarantee. The existing
  sole-producer / replace-the-map-slot discipline (`enable-disable.ts:599`)
  stays. Because the generic constrains only the producer, a **behavioral test
  that disable preserves the inventory exactly** is still required.

### Test-suite disposition

- **D-100-11:** The roadmap's "14 test files assert the disabled+empty shape"
  is numerically correct but the framing overstates the work. Those 14 are
  mostly **fixtures** that construct a disabled record with empty resources as
  *input*. This change makes disabled+empty **legal but no longer mandatory** (a
  hooks-only plugin, a legacy record), so those fixtures stay valid. Only
  assertions that disable *zeroes* the arrays are wrong. The brand itself is
  narrower than the roadmap states: 2 test files
  (`tests/persistence/state-io.test.ts`,
  `tests/orchestrators/plugin/update.test.ts`) plus 2 source files. Judge each
  site as pinning the retired marker or the still-correct behavior; do not
  bulk-edit.

  The 14 fixture files:
  `tests/orchestrators/edge-deps.test.ts`,
  `tests/orchestrators/marketplace/autoupdate.test.ts`,
  `tests/orchestrators/marketplace/update.test.ts`,
  `tests/orchestrators/plugin/enable-disable.test.ts`,
  `tests/orchestrators/plugin/info-manifest-absent.test.ts`,
  `tests/orchestrators/plugin/list-manifest-absent.test.ts`,
  `tests/orchestrators/plugin/plugin-state-classifier.test.ts`,
  `tests/orchestrators/plugin/reinstall.test.ts`,
  `tests/orchestrators/plugin/update.test.ts`,
  `tests/orchestrators/reconcile/apply.test.ts`,
  `tests/orchestrators/reconcile/backfill.test.ts`,
  `tests/orchestrators/reconcile/plan.test.ts`,
  `tests/persistence/migrate.test.ts`,
  `tests/shared/plugin-path.test.ts`.

### Claude's Discretion

- Requirement IDs for this phase (the ENBL family continues at ENBL-10+); the
  roadmap leaves assignment to discuss and no operator preference was expressed.
- The exact name of the new top-level record key.
- Whether the hydrate `enabled` guard is covered by the existing ENBL-05
  whole-tree drift gate or needs its own clause.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and prior decisions

- `.planning/ROADMAP.md` § "Phase 100: Disabled-plugin information retention" --
  the phase goal, the operator decision of 2026-08-11, and the three open
  decisions this discussion closed. **Its "nothing reads resources-emptiness"
  scoping claim is false; see the correction in `<decisions>`.**
- `.planning/STATE.md` -- current position, and the v1.18 decision list whose
  D-95/D-96/D-97/D-98 entries constrain this phase.
- `.planning/phases/97-disabled-state-classification-repair/` -- ENBL-05..09,
  the disabled-state predicate collapse this phase extends one axis over.
- `.planning/phases/96-installation-record-backed-plugin-info/` -- D-96-01
  (record-backed component inventory), D-96-03 (the truthful-split
  discriminant), D-96-04 (the fetch-skip note this phase must preserve).

### Production code this phase changes

- `extensions/pi-claude-marketplace/persistence/state-io.ts:90-162` --
  `DisabledPluginRecord`, `toDisabledRecord`, `isRecordedButDisabled`, and the
  `PLUGIN_INSTALL_RECORD_SCHEMA` the new key joins.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:328-384`
  -- `runDisableBranch`; and `:251` `runEnableBranch`, whose manifest resolution
  is what makes D-100-07's reason load-bearing.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:584-617` --
  `hydrateScopeFromState`, the unguarded emptiness reader.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- `:505-600`
  `readStateOnlyHookEntries`, `:1036` `composeStateOnlyComponents`, `:2030`
  `buildDisabledInventoryBlock`, `:2073` `partitionDisabledScopes`, `:2266-2372`
  the notify-partition control flow.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:389-390` and
  `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1761-1762`
  -- the soft-dep derivation sites.
- `extensions/pi-claude-marketplace/shared/notify.ts:1311-1387` --
  `PluginInfoRow`, its `Extract<PluginStatus, ...>` status subset, and the
  `componentsResolved` arms.
- `extensions/pi-claude-marketplace/domain/manifest-cache.ts:1-36` -- the cache
  invalidates per read on `(mtimeMs, size)`. It is a parse cache of the current
  file, **not a snapshot**, which is why a dropped manifest entry is
  unrecoverable and the record has to answer.

### Gates that constrain the change

- `tests/architecture/compat-01-no-expansion.test.ts:342` (record key set --
  **this one is amended**), `:230` (plugin status tuple -- stays green), `:412`
  (schema version union -- stays green).
- `tests/architecture/notify-closed-set-locks.test.ts:50` -- SNM-02's 19-entry
  `PLUGIN_STATUSES` lock; stays green.
- `tests/orchestrators/reconcile/plan.test.ts` -- the ENBL-05 whole-tree
  disabled-predicate drift gate the new hydrate guard must satisfy.
- `tests/architecture/catalog-uat.test.ts` and `docs/output-catalog.md` -- the
  byte-fixture gate the moved disabled `info` row and the new `{not in
  manifest}` disabled row must both land in, in the same commit as their
  catalog states.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1096` --
  the ENBL-08 fence D-100-09 declines to reopen.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`buildBlock` (`info.ts:806`)** already implements the manifest-backed →
  state-only fallback ladder. D-100-08 makes the disabled arm inherit it rather
  than reimplement it; this is the single biggest reuse in the phase.
- **`isRecordedButDisabled` (`state-io.ts:160`)** is the one predicate every new
  guard reads, keeping all four new guard sites off the drift gate.
- **`resolvedSha` (`state-io.ts:62-68`)** is the worked precedent for an
  additive optional record key with no `schemaVersion` bump -- its comment
  states the rule the new key follows.
- **The `Extract<PluginStatus, ...>` widening at `notify.ts:1337`** has been
  done before (FSTAT-07 added `partially-installed`), so D-100-08 follows a
  path with an existing rationale comment beside it.
- **`StateOnlyHookRead`'s discriminant (`info.ts:535-538`)** is the shape the
  record-vs-file fallback in D-100-03 slots into.

### Established Patterns

- Orchestrators stamp reasons; `notify.ts` renders them with no allowlist in the
  render path (D-95-01/02/03). D-100-07's single-reason rule is therefore an
  **orchestrator** decision, not a render filter.
- Additive optional record keys never bump `schemaVersion`; absence needs no
  migrate fill.
- A closed-set change ships its catalog state and its byte fixture in the **same
  commit**, so neither direction of the gate can pass on a half-landed pair.
- Architecture gates read files directly rather than shelling out to `grep`.

### Integration Points

- `state.json` install record ← the new optional hook-entries key (written by
  install, update, reinstall, enable; preserved by disable).
- `hydrateScopeFromState` ← the new `enabled` guard; this is the seam that lets
  disable stop relying on file-absence for routing safety.
- `info`'s notify partition ← collapses as the disabled arm joins the ordinary
  `plugin-info` path.
- `list`/`reinstall` soft-dep derivation ← the `enabled` guard that keeps
  rendered bytes still.

</code_context>

<specifics>

## Specific Ideas

- The operator's framing of the installation record: *"it's a manifest of
  installed resources, so the system should never inspect the resources to find
  out information about what's installed. So it needs to be comprehensive enough
  for the info command."* Recorded as the intent behind D-100-01: the record is
  self-sufficient for describing an installation, rather than a pointer into
  artifacts that have to be inspected.
- Refined by the operator immediately after: `info` on an **uninstalled** plugin
  resolves everything from the marketplace manifest and should keep doing so.
  The record answers for **installed** state -- installed, disabled, and the
  manifest-absent case where nothing else can answer. D-100-08 and D-100-09 both
  rest on this split.
- The reasons rule as stated during discussion: *render durable facts that
  constrain what the user can do next; suppress facts about runtime behavior
  that is currently suspended.* Worth carrying into the output catalog's
  disabled-row section as the successor to the "user-requested state, not a
  failure state" rationale.

</specifics>

<deferred>

## Deferred Ideas

- **Converge reinstall/update's old-version removal onto `cascadeUnstagePlugin`.**
  Raised by the operator during discuss. Today `cascadeUnstagePlugin`
  (`orchestrators/marketplace/shared.ts:334`) serves uninstall, `marketplace
  remove` and disable, while reinstall hand-rolls a replace-in-place off
  `oldRecord.resources.skills` / `.prompts` (`reinstall.ts:1527`, `:1538`) plus a
  direct `removeHookConfig` (`reinstall.ts:1639`). The convergence is real work
  and is complicated by reinstall's removal not being a plain removal -- it
  hands previous names to the stage path so a re-stage can supersede them, which
  the cascade primitive does not model. Its own phase.
- **Persist the dropped/unsupported handler detail an install partitions out**,
  so `info` can name the handlers a partially-installed plugin does *not* run.
  `HookSummaryEntry` already has a `lenient` arm carrying `supported: boolean`
  for exactly this. Out of scope here: it captures information the record has
  never held, rather than preventing the loss of information it did.

### Reviewed Todos (not folded)

- `2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md`
  ("Coverage: exclusion versus tests for the out-of-bound orchestrators") --
  matched on the keyword "marketplace" alone, score 0.6. Unrelated to disabled-
  record retention; stays pending for the next milestone's discuss.

</deferred>

---

*Phase: 100-disabled-plugin-information-retention*
*Context gathered: 2026-08-11*
