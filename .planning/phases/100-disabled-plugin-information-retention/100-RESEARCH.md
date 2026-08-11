# Phase 100: Disabled-plugin information retention - Research

**Researched:** 2026-08-11
**Domain:** In-repo TypeScript refactor — persisted-record shape, disabled-state predicate propagation, render-path reroute
**Confidence:** HIGH (every claim below was read from source this session; line numbers are current as of this worktree)

## Summary

CONTEXT.md is accurate on the three readers it names, but its reader inventory is
**incomplete in one direction and mischaracterized in two others**. The research
found a fourth reader that breaks the phase outright if left alone, and it found
that two of the three named "readers" do not actually need the guard CONTEXT
prescribes.

The single most important finding: **retaining `resources.*` on disable breaks
`plugin enable` completely.** `runEnableBranch` calls `runInstallLedger`, and
`runInstallLedger` runs `assertNoCrossPluginConflicts(scope, generatedNames, state)`
against the **raw** state at `install.ts:863`. Today the disabled record's arrays
are empty, so it contributes nothing to the owner map and the enable's own
generated names cannot self-collide. Retain the arrays and every enable of a
plugin owning at least one skill, command, or agent throws
`CrossPluginConflictError` against its own record. The two sibling call sites
(`update.ts:1859`, `reinstall.ts:1224`) already wrap the state in
`removePluginRecord(...)` for exactly this reason and document why; `install.ts`
is the one that does not.

Two secondary corrections: the disabled row on `list` is already structurally
incapable of carrying a soft-dep marker (the disabled early-return at
`list.ts:412` precedes any use of `declaresAgents`/`declaresMcp`, and
`PluginDisabledMessage` has no `dependencies` field), and `reinstall.ts:1761-1762`
reads **freshly staged handles**, not a persisted record. D-100-06 is therefore
already satisfied by construction at both sites — it needs a *pinning test*, not a
code change. Separately, D-100-07 and D-100-08 each require one more type change
than CONTEXT enumerates: `PluginDisabledMessage` has no `reasons` field at all
(its absence is documented as what makes INV-04 *structural*), and
`pluginInfoStatusGlyph` ends in `assertNever`, so widening the `Extract` without
adding a `case "disabled"` arm is a compile error.

**Primary recommendation:** Sequence the phase as (1) the new record key + write
sites, (2) the `hydrateScopeFromState` guard **and** the `install.ts` conflict-guard
fix landing together with the retention change in one plan — retention without
either is a shipped regression, (3) the render reroute, (4) catalog + fixtures.
Do not let the retention change land in a wave before the two guards.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-100-01:** Hook entries are **persisted on the installation record** under a new **top-level optional key**, following the `resolvedSha` precedent (`persistence/state-io.ts:62-68`): optional, additive, a legacy record without it loads unchanged, no migrate fill, **no `schemaVersion` bump**. Nesting the key inside `resources` was rejected: it would pass COMPAT-01's key-set clause only because that clause reads top-level properties, which is dodging the gate rather than amending it. Widening `resources.hooks`' element type was rejected because legacy records hold plain strings, forcing a union or a `schemaVersion: 3` migration the milestone promised not to require. — **Reversibility:** costly — the key ships in on-disk `state.json` records; removing it later means either tolerating an unknown key on read or writing a migration, and every install/update/reinstall write site has to be unwound.
- **D-100-02:** The persisted payload is **supported entries only** (event plus matcher) — byte-parity with the hooks line today, because the materialized file is the filtered supported subset by construction. Recording the dropped/unsupported handlers an install partitions out was considered and deferred: that is information the record has never held, not information this phase is preventing the loss of.
- **D-100-03:** `readStateOnlyHookEntries` (`orchestrators/plugin/info.ts:540`) **survives as a legacy fallback**. The record wins when the key is present; the materialized-file read covers its absence. This prevents a regression for existing **enabled** manifest-absent records, which read correctly today and would otherwise report no hooks until something rewrote them. Records self-heal on the next install/update/reinstall/enable.
- **D-100-04:** Disable **keeps calling `removeHookConfig`**. Artifact removal stays symmetric across all five kinds; only the record's *description* is retained. The alternative — leaving `hooks.json` on disk and letting the new hydrate guard do the deregistration — was put to the operator twice, in two independent framings, and rejected both times.
- **D-100-05:** `hydrateScopeFromState` **gains an `enabled` guard**, read through `persistence/state-io.ts::isRecordedButDisabled` rather than the raw boolean, so the site cannot drift from the ENBL-05 definition. This is mandatory, not optional.
- **D-100-06:** `declaresAgents` / `declaresMcp` guard on `enabled` at both derivation sites (`list.ts:389-390`, `reinstall.ts:1761-1762`) so a disabled row renders **byte-identically to today**. Soft-dependency markers state a runtime concern that is suspended while the plugin is disabled. Preserves D-97-01's bare disabled row.
- **D-100-07:** A disabled row may carry **`{not in manifest}` and no other reason**, on both `list` and `info`. The governing rule: **render durable facts that constrain what the user can do next; suppress facts about runtime behavior that is currently suspended.** Manifest absence qualifies because it is load-bearing — `runEnableBranch` (`enable-disable.ts:251`) re-runs `runInstallLedger`, which resolves from the marketplace manifest, so a disabled manifest-absent record **cannot be re-enabled** and today's bare row gives no warning before the attempt.
- **D-100-08:** The disabled arm **routes through `buildBlock`**. `partitionDisabledScopes` (`info.ts:2073`) stops short-circuiting, and `PluginInfoRowBase`'s `Extract<PluginStatus, ...>` (`notify.ts:1337`) widens with `disabled`. This is a **per-surface subset widening, not a new status token**. Two consequences the planner must carry deliberately: the D-96-04 `{already disabled}` fetch-skip note must survive the reroute, and the disabled `info` row's bytes move (it gains description and components), so catalog states and byte fixtures move with it.
- **D-100-09:** **No backfill.** Enable overwrites `resources` wholesale. A record-only reconcile scan was rejected because it would reopen the region ENBL-08 fenced off (`reconcile/apply.ts:1096`). Opportunistic persist-on-read was rejected outright: it would make `list`/`info` writers.
- **D-100-10:** `DisabledPluginRecord`'s empty-tuple pin is **re-pointed at the new invariant**. `toDisabledRecord` (`state-io.ts:122`) becomes generic in its resources shape — input `resources: R`, output `enabled: false` with `resources: R` — so "disable changed the inventory" is a compile error at the producer. The existing sole-producer / replace-the-map-slot discipline (`enable-disable.ts:599`) stays. Because the generic constrains only the producer, a **behavioral test that disable preserves the inventory exactly** is still required.
- **D-100-11:** The 14 files are mostly **fixtures** that construct a disabled record with empty resources as *input*. This change makes disabled+empty **legal but no longer mandatory**, so those fixtures stay valid. Only assertions that disable *zeroes* the arrays are wrong. Judge each site; do not bulk-edit.

### Claude's Discretion

- Requirement IDs for this phase (the ENBL family continues at ENBL-10+).
- The exact name of the new top-level record key.
- Whether the hydrate `enabled` guard is covered by the existing ENBL-05 whole-tree drift gate or needs its own clause.

### Deferred Ideas (OUT OF SCOPE)

- **Converge reinstall/update's old-version removal onto `cascadeUnstagePlugin`.** Its own phase.
- **Persist the dropped/unsupported handler detail an install partitions out.** Out of scope here.
- Reviewed todo `2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md` — not folded.

## Phase Requirements

CONTEXT left ID assignment to Claude's Discretion. Proposed set: **ENBL-10 .. ENBL-19**,
mapped one-to-one onto the decisions plus one requirement for a hazard no decision covers.

| ID | Description | Source | Research Support |
|----|-------------|--------|------------------|
| **ENBL-10** | The installation record carries a new top-level **optional** key holding the plugin's supported hook entries. Additive, no `schemaVersion` bump, a legacy record without it loads unchanged, no migrate fill. | D-100-01 | § New Record Key — schema shape verified against the `resolvedSha` precedent at `state-io.ts:62-68`; COMPAT-01 amendment identified |
| **ENBL-11** | The persisted payload is the **supported** entries only (event plus matcher), byte-parity with today's rendered hooks line. | D-100-02 | § New Record Key — `HookSummaryEntry` located at `shared/concerns/hooks.ts`, consumed by `PluginInfoComponentsResolved.hooks` (`notify.ts:1371`) |
| **ENBL-12** | `info` reads hook entries from the record when the key is present and falls back to `readStateOnlyHookEntries`' materialized-file read when it is absent. | D-100-03 | § Fallback Ladder — `StateOnlyHookRead` discriminant at `info.ts:535-538`; sole consumer `composeStateOnlyComponents` at `info.ts:1048` |
| **ENBL-13** | Disable continues to unstage all five artifact kinds, `removeHookConfig` included; only the record's description is retained. | D-100-04 | § Disable Write Path — `cascadeUnstagePlugin` call at `enable-disable.ts:335` is unchanged |
| **ENBL-14** | `hydrateScopeFromState` does not hydrate hooks for a record that `isRecordedButDisabled` reports disabled. | D-100-05 | § Reader Inventory R1 — verified unguarded at `event-router.ts:594-598`; file currently has no `isRecordedButDisabled` import |
| **ENBL-15** | A disabled row on `list` renders byte-identically to today: no soft-dependency marker, whatever the record's retained inventory. | D-100-06 | § Reader Inventory R2/R3 — **already true by construction**; needs a pinning test, not a code change |
| **ENBL-16** | A disabled row may carry `{not in manifest}` and no other reason, on both `list` and `info`. Supersedes INV-04. | D-100-07 | § Reason on the Disabled Row — requires adding `reasons?` to `PluginDisabledMessage` and threading it at `notify.ts:2421` |
| **ENBL-17** | `info` on a disabled record routes through `buildBlock`, reporting description and components; the D-96-04 `{already disabled}` fetch-skip note survives. | D-100-08 | § The buildBlock Reroute — carrier for the skip note identified; `pluginInfoStatusGlyph` arm required |
| **ENBL-18** | Disable preserves the record's inventory exactly; the producer type makes any change to it a compile error. | D-100-10 | § Type Invariant — current signature and both consumers located |
| **ENBL-19** | Enabling a disabled plugin does not self-conflict against its own retained resource names. | **discovered — no decision covers it** | § Hazard 1 — `install.ts:863` uses raw state; the two sibling sites already use `removePluginRecord` |

D-100-09 (no backfill) is a **scope exclusion**, not a requirement — it states what the
phase does *not* build. D-100-11 (test disposition) is process guidance. Neither takes an ID.

**INV-04 conflict.** `.planning/REQUIREMENTS.md:15` records INV-04 as shipped and
complete: *"A disabled installation record absent from a successfully loaded manifest
remains `(disabled)` **without** a `{not in manifest}` reason."* ENBL-16 reverses it
directly. This is not a nuance — `notify.ts:765-770` states the absence of the `reasons`
field is *"what makes 'a disabled row never carries `{not in manifest}`' structural
rather than test-enforced."* The plan must amend INV-04's text and mark it superseded,
and must rewrite that JSDoc paragraph, `docs/output-catalog.md:338`, and the
INV-04 test at `tests/orchestrators/plugin/list-manifest-absent.test.ts:437`.
CONTEXT did not surface this conflict. `[VERIFIED: .planning/REQUIREMENTS.md:15; extensions/pi-claude-marketplace/shared/notify.ts:765-770]`

## Project Constraints (from CLAUDE.md)

- **No direct `process.stdout` / `process.stderr`** in extension code (IL-2); all output through `shared/notify.ts` helpers.
- **`npm run check` must stay green** — typecheck + ESLint + Prettier + tests (NFR-6).
- **Atomic disk mutations** (NFR-1). The new record key rides the existing `saveState` atomic write; no new write primitive.
- **No Pi restart required** — `/reload` must suffice (NFR-2). Bears directly on ENBL-14: the hydrate guard is what makes disable's routing safety survive a reload.
- **`list` / `info` MUST NOT touch the network** (NFR-5), and must remain lock-free and mutation-free — this is what D-100-09 rejects persist-on-read to protect.
- **Comment policy** (`.claude/rules/typescript-comments.md`): decision and requirement IDs are encouraged anchors; `Phase NN` / `Wave N` / `Pitfall N` references are forbidden in comments and test titles.
- **`sonarjs/no-identical-functions` is an error** — relevant to the `removePluginRecord` hoist (§ Hazard 1).
- **`sonarjs/cognitive-complexity: 15`** — relevant to `getPluginInfo`, which already carries an `eslint-disable` for this on a sibling function and whose partition logic was extracted specifically to stay under budget (`info.ts:2065-2066`).
- Markdown is formatted by **mdformat**, not prettier (`format:check` covers js/json/ts only) — applies to `docs/output-catalog.md` edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| New persisted record key + schema | `persistence/state-io.ts` | — | Sole validation boundary for the record; COMPAT-01 reads its key set |
| Populating the key on write | `orchestrators/plugin/{install,update,reinstall}.ts` | — | Orchestrators own record composition; bridges return names, not records |
| Preserving the key on disable | `persistence/state-io.ts::toDisabledRecord` | `orchestrators/plugin/enable-disable.ts` | The producer type is the enforcement point (D-100-10) |
| Hook-routing suppression while disabled | `bridges/hooks/event-router.ts` | `persistence/state-io.ts::isRecordedButDisabled` | The bridge owns the cache; the predicate is imported, never re-derived |
| Self-conflict exclusion on enable | `orchestrators/plugin/install.ts` | `orchestrators/plugin/shared.ts` | Guard lives in the shared orchestrator tier; the exclusion is the caller's job |
| Disabled row reason stamping | `orchestrators/plugin/{list,info}.ts` | — | Orchestrators stamp reasons; `notify.ts` renders with no allowlist (D-95-01/02/03) |
| Disabled `info` row shape | `orchestrators/plugin/info.ts::buildBlock` | `shared/notify.ts` (type + glyph arm) | Reuse the existing fallback ladder rather than reimplement |
| Byte contract | `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | — | Catalog state and fixture ship in the same commit |

## Reader Inventory — verified, with two corrections and one addition

The sweep was whole-tree over `extensions/`, matching `resources.<kind>.length`,
`.length === 0` / `> 0` near resource identifiers, and every `.resources` member read.
Results below are exhaustive for the extension source tree.
`[VERIFIED: grep over extensions/, this session]`

### R1 — `bridges/hooks/event-router.ts:594-598` — CONFIRMED, correctness hazard

```ts
    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      const hookSlugs = pluginRecord.resources.hooks;
      if (hookSlugs.length === 0) {
        continue;
      }
```

CONTEXT cites `:596` and phrases it as `resources.hooks.length > 0`; the actual
spelling is the inverse continue-on-empty at `:596`, semantically identical. The
function is `hydrateScopeFromState` (`:584-617`), called once per scope from
`hydrateCacheFromDisk` (`:571`). **No `enabled` guard, and the file has no
`isRecordedButDisabled` import.** `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:584-617]`

Control flow a task must edit: the guard goes inside the `for (const [pluginId,
pluginRecord] of Object.entries(mpRecord.plugins))` loop, before or beside the
`hookSlugs.length === 0` continue. The loop body's only other statement is the
inner `for (const slug of hookSlugs)` calling `tryHydrateOnePlugin`. Adding the
import plus one `if (isRecordedButDisabled(pluginRecord)) { continue; }` is the
whole edit; no signature changes.

`rebuildRoutingTables` (`:407`) is **not** a second state reader — it walks the
parsed-config cache (`collectAllCachedPlugins`, `:418`), not `state.json`. The
comment at `reinstall.ts:1717-1718` describing "`rebuildRoutingTables`' state walk
(gated on `resources.hooks.length > 0`)" is describing the *hydrate* walk that
feeds it, and is loosely worded. `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:407-427]`

### R2 — `orchestrators/plugin/list.ts:389-390` — CONFIRMED present, but **already harmless**

```ts
  const declaresAgents = record.resources.agents.length > 0;
  const declaresMcp = record.resources.mcpServers.length > 0;
```

Both values are computed at `:389-390`, but the disabled early-return is at `:412-424`
and returns an object literal containing **only** `status`, `name`, `version`,
`scopeField`, `descriptionField`, `severity`, `needsReload`. Neither `declaresAgents`
nor `declaresMcp` appears in it. Furthermore `PluginDisabledMessage`
(`notify.ts:775-781`) declares no `dependencies` field, so the values are
**type-incapable** of reaching a disabled row, and the renderer's `disabled` arm
hard-codes `composeReasons(undefined, false, false, probe)` at `notify.ts:2421`.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:389-424; extensions/pi-claude-marketplace/shared/notify.ts:775-781, 2408-2422]`

**Consequence for D-100-06:** the list half needs **no code change**. Retaining
resources changes the *value* of two locals that a disabled record's row never
reads. The correct deliverable is a **pinning test** — a disabled record with
populated `resources.agents` / `resources.mcpServers` renders the byte-identical
bare `◍ name vX (disabled)` row — plus, optionally, moving the two derivations
below the disabled return so a future author cannot wire them in by accident.
Adding an `enabled` guard to these two lines would be dead code.

### R3 — `orchestrators/plugin/reinstall.ts:1761-1762` — **mischaracterized; not a record reader**

```ts
function successOutcome(...) {
  const resources = resourcesFromHandles(handles);      // :1735
  ...
    declaresAgents: resources.agents.length > 0,        // :1761
    declaresMcp: resources.mcpServers.length > 0,       // :1762
```

`resources` here is `resourcesFromHandles(handles)` (`:1735`, defined `:1705-1726`) —
the names the reinstall **just staged**, mapped off the prepared bridge handles. It
is not `oldRecord.resources` and not any persisted record. Retaining resources on
disable cannot change these values. `reinstall.ts` additionally carries **no**
`isRecordedButDisabled` guard anywhere, so it has no disabled arm for a guard to
attach to. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1705-1766; grep for isRecordedButDisabled in reinstall.ts returns nothing]`

**Consequence for D-100-06:** the reinstall half is a no-op. The plan should record
the finding rather than schedule an edit.

### R4 — `orchestrators/plugin/shared.ts:623-649` `collectOwners` — **NEW, phase-breaking**

Not in CONTEXT's inventory. Walks **every** plugin record in the scope's state and
registers each `resources.skills` / `.prompts` / `.agents` entry into an owner map
consumed by `assertNoCrossPluginConflicts` (`:695-712`). See § Hazard 1 — this is
the finding that most changes the shape of the phase.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:623-712]`

### R5 — `orchestrators/plugin/reinstall.ts:1768-1782` `resourcesChanged` — reads the old record, but insensitive

```ts
  return (
    next.skills.length > 0 || next.prompts.length > 0 ||
    next.agents.length > 0 || next.mcpServers.length > 0 ||
    !sameStrings(oldResources.skills, next.skills) || ...
```

`oldResources` **is** `oldRecord.resources` (`:1763`). But the four leading
short-circuits read `next` (freshly staged), so whenever the reinstall staged
anything the result is `true` regardless of the old record. The only case where
`oldResources` decides is an all-empty `next` — a hooks-only plugin, whose
`skills`/`prompts`/`agents`/`mcpServers` are empty in both the retained and the
zeroed form (`hooks` is not compared at all). **No behavior change.** Recorded so a
planner sweeping for `.resources` reads does not treat it as unexamined.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1763-1786]`

### Sites that read `.resources` but are not emptiness-as-signal

`info.ts:1044-1048` (state-only component composition — this is the arm the phase
*wants* to be populated), `marketplace/shared.ts:351,357` and `reinstall.ts:1527,1538`
(previous-name threading into the stage path), `update.ts:1198,1209,1708-1733` and
`reinstall.ts:2023-2028` (write sites / clone), `marketplace/remove.ts:385-390` and
`shared.ts:797-813` (partial-cascade folds), `plugin-path.ts` (already reads the
`enabled` boolean, not resources — `:24,:40`). None change behavior under retention.
`[VERIFIED: grep over extensions/, this session]`

## Hazard 1 (BLOCKING) — retention breaks `plugin enable`

**Mechanism.** `runEnableBranch` (`enable-disable.ts:250-265`) calls
`runInstallLedger(state, locations, { ..., allowExistingRecord: true, partial })`.
`runInstallLedger` is defined at `install.ts:715`; at `install.ts:854-863` it
discovers the candidate generated names and calls:

```ts
  // PI-6 / RN-3: pre-flight cross-bridge conflict guard. Throws
  // CrossPluginConflictError BEFORE any disk write if a generated name
  // is already owned by a different plugin IN THE SAME SCOPE.
  assertNoCrossPluginConflicts(scope, generatedNames, state);
```

`state` is the **raw** state, still holding the plugin's own record. Today that
record is disabled with five empty arrays, so `collectOwners` registers nothing for
it and the enable's own names pass. **Retain the arrays and every enable of a plugin
that owns ≥1 skill, command, or agent throws `CrossPluginConflictError` against
itself.** Enable is the primary way a user recovers a disabled plugin; this is a
total functional break, not a degraded row.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:250-265; install.ts:715, 854-863; shared.ts:623-712]`

**The fix has two precedents already in the tree.** `update.ts:1852-1860`:

```ts
  // PI-6 cross-plugin guard: re-check generated names against the SAME-SCOPE
  // state EXCLUDING this plugin's currently-recorded resources -- updating
  // your own plugin against your own state must not count as cross-plugin
  // conflict (a plugin updating its skill names from {a,b} -> {a,c} would
  // otherwise self-conflict on "a").

  const generatedNames = await discoverGeneratedNames(plugin, installable);
  const stateForGuard = removePluginRecord(preflight.state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);
```

and `reinstall.ts:1221-1225`:

```ts
  assertNoCrossPluginConflicts(
    scope,
    { skills: generated.skills, commands: generated.commands, agents: generated.agents },
    removePluginRecord(tx.state, marketplace, plugin),
  );
```

`install.ts` is the only one of the three without the exclusion — safe until now
precisely because a fresh install has no record and an enable's record was empty.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1852-1860; reinstall.ts:1221-1225]`

**Recommended fix (ENBL-19).** Apply `removePluginRecord` unconditionally at
`install.ts:863`. A fresh install has no record, so the exclusion is a no-op there;
the enable path gets the same self-exclusion its two siblings already have.

**Do not add a third copy of `removePluginRecord`.** Two near-identical private
copies already exist — `update.ts:3037-3056` and `reinstall.ts:2036-2055`, differing
only in a local variable name and an eslint-disable comment. `sonarjs/no-identical-functions`
is an **error** in this repo. Hoist the helper into `orchestrators/plugin/shared.ts`
(the file that already owns `assertNoCrossPluginConflicts`) and have all three import
it. That is a three-file refactor but it is the only variant that stays lint-green.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:3037-3056; reinstall.ts:2036-2055; .planning/codebase/CONVENTIONS.md lint rules]`

**Second-order note.** `clonePluginRecord` (`reinstall.ts:2018-2034`) deep-copies each
`resources.*` array by spread, including `hooks: [...record.resources.hooks]` at
`:2028`. The new top-level key must be added to that clone or a reinstall's old-record
snapshot silently drops it. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:2018-2034]`

## New Record Key (D-100-01 / ENBL-10, ENBL-11)

### The `resolvedSha` precedent, verbatim

```ts
export const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  // D-77-02 / PURL-09: the full 40-hex resolved commit sha for git-source
  // installs. OPTIONAL and additive -- NO schemaVersion bump (mirrors the
  // lastReconciledExtensionVersion precedent), so a legacy record without it
  // loads unchanged and absence needs no migrate fill. Git-source-only:
  // path/github-name installs omit it. Reinstall uses THIS full sha as its
  // re-clone checkout pin; clone GC presence-checks it to derive live keys.
  resolvedSha: Type.Optional(Type.String()),
  compatibility: Type.Object({ ... }),
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(Type.String()),
  }),
  enabled: Type.Boolean(),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});
```

`[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:59-85]`

So the declaration shape for the new key is `Type.Optional(Type.Array(Type.Object({...})))`
placed as a sibling of `resolvedSha`, carrying a doc comment in the same form
(requirement ID, "OPTIONAL and additive — NO schemaVersion bump", what absence means).
`Type.Static` derives the TS type automatically; `PluginInstallRecord` picks it up
with no separate declaration.

### Payload type (D-100-02 / ENBL-11)

The already-existing shape is `HookSummaryEntry`, declared in
`extensions/pi-claude-marketplace/shared/concerns/hooks.ts` and imported by
`info.ts:89`. It is the element type of `PluginInfoComponentsResolved["components"]["hooks"]`
(`notify.ts:1371`), i.e. exactly what the renderer already consumes — so persisting
this shape means the record's value flows to the row with no adapter.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:89; shared/notify.ts:1371]`

`HookSummaryEntry` has a `lenient` arm carrying `supported: boolean`
(recorded in CONTEXT's Deferred Ideas). Per D-100-02 the persisted payload is the
**supported** subset only — the same subset `projectHookSummaryEntries(parsed.value)`
produces at `info.ts:573`, and the same subset the materialized `hooks.json` holds by
construction (`info.ts:568-572` states this explicitly). `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:568-573]`

**Planner caution:** persisting `HookSummaryEntry` verbatim couples the on-disk record
to a type that also models the lenient/unsupported arm. The typebox schema is the
validation boundary and should declare the *supported-entry* shape (event plus matcher)
directly rather than trying to mirror the whole union. Whether the persisted schema
type and `HookSummaryEntry` are declared as one type or two with a mapping is a
plan-level call; the safer read is **two**, with a narrow projector, so the deferred
"persist dropped handlers" idea does not become a schema change by accident. `[ASSUMED]`

### Write sites that must populate the key

| Site | File:line | What it writes today |
|------|-----------|----------------------|
| Install ledger record composition | `install.ts` (record built after `deriveInstallVersion`, `:865-880` region) | `resources.hooks` = `[plugin]` when `hooksConfigPath !== undefined` |
| Update finalize | `update.ts:1733` — `sRecord.resources.hooks = installable.hooksConfigPath === undefined ? [] : [plugin];` | same conditional |
| Reinstall | `reinstall.ts:1724` — `hooks: plugin !== undefined && installable?.hooksConfigPath !== undefined ? [plugin] : []` | same conditional |
| Enable | via `runInstallLedger` — inherits the install site, no separate write | — |
| Reinstall old-record snapshot | `reinstall.ts:2028` `clonePluginRecord` | must copy the new key |
| Disable | `state-io.ts:122` `toDisabledRecord` | must **preserve**, not clear (ENBL-18) |

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1733; reinstall.ts:1724, 2028; persistence/state-io.ts:122-132]`

Every write site sits beside an existing `resources.hooks` assignment, so the new key's
population is a sibling line at each — but note the ledger must have the *parsed* config
in hand at that point. Install/update/reinstall each resolve `installable.hooksConfigPath`;
whether the parsed entries are still in scope at the record-composition point, or must be
threaded from the hooks bridge's stage result, is the one genuinely unknown piece of
plumbing in this phase and should be a first-task spike. `[ASSUMED]`

### Naming recommendation

**Recommended: `hookEntries`.**

Rationale, and the constraint CONTEXT did not surface: `compat-01-no-expansion.test.ts:388`
holds a clause titled *"no manifest-snapshot or orphan field reached the install record"*
which asserts the record's property set contains **none** of
`["manifestSnapshot", "manifest", "manifestEntry", "entry", "orphan", "orphanRewake", "orphaned"]`.
Any name drawn from that list — `entry` and `manifestEntry` are the plausible ones —
trips a gate whose stated promise is *"the install record caches no manifest material."*
`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:388-410]`

`hookEntries` also:
- reads as a *description of the installation* rather than a pointer, matching the operator's framing recorded in CONTEXT's `<specifics>`;
- does not collide with `resources.hooks` (which holds the container **slug**, a different fact — `state-io.ts:41-47`);
- sorts between `enabled` and `installedAt` in the COMPAT-01 key-set clause's `localeCompare` order, making the amendment a one-line insertion;
- matches the `HookSummaryEntry` type name the payload derives from.

Alternatives considered: `hooks` (collides conceptually with `resources.hooks`, invites
confusion at every read site), `hookSummary` (implies a lossy digest), `declaredHooks`
(false — the record describes what was *materialized*, not what the manifest declared).

## Fallback Ladder (D-100-03 / ENBL-12)

`StateOnlyHookRead` is the discriminant the ladder slots into:

```ts
type StateOnlyHookRead =
  | { readonly kind: "none" }
  | { readonly kind: "listed"; readonly entries: readonly HookSummaryEntry[] }
  | { readonly kind: "degraded"; readonly reason: ContentReason };
```

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:535-538]`

Its sole consumer is `composeStateOnlyComponents` (`info.ts:1036-1066`), one call at
`:1048`: `const hooksRead = await readStateOnlyHookEntries(record.resources.hooks, locations, cwd);`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1036-1066]`

The record-wins ladder therefore lands as a branch **above** that call: when the new key
is present, return `{ kind: "listed", entries: <record key> }` without any disk read;
when absent, fall through to `readStateOnlyHookEntries` unchanged. The three-way
discriminant is preserved, which matters — `info.ts:1054-1058` documents that a `listed`
read with zero entries is a *different fact* from `none` and from `degraded`, and the
record path must respect that: a present-but-empty key is `listed` with zero entries, an
absent key is not `none` but "fall through and let the file answer."

This also means the record path is **network-free and disk-free**, strengthening the
`buildStateOnlyInstalledRow` NFR-5-by-signature property documented at `info.ts:964-974`.

## Type Invariant (D-100-10 / ENBL-18)

Current signature and body:

```ts
export function toDisabledRecord(
  record: PluginInstallRecord,
  updatedAt: string,
): DisabledPluginRecord {
  return {
    ...record,
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: false,
    updatedAt,
  };
}
```

with

```ts
export type DisabledPluginRecord = PluginInstallRecord & {
  enabled: false;
  resources: { skills: []; prompts: []; agents: []; mcpServers: []; hooks: [] };
};
```

`[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:105-132]`

**Generic form that pins the new invariant.** Make the function generic in the record's
resources shape and return the *same* `R`:

```ts
export function toDisabledRecord<R extends PluginInstallRecord["resources"]>(
  record: PluginInstallRecord & { resources: R },
  updatedAt: string,
): PluginInstallRecord & { enabled: false; resources: R } {
  return { ...record, enabled: false, updatedAt };
}
```

Dropping the `resources:` override from the body is what makes retention happen; the
`resources: R` in the return type is what makes *changing* it a compile error at the
producer. `DisabledPluginRecord` then becomes the generic alias
`DisabledPluginRecord<R> = PluginInstallRecord & { enabled: false; resources: R }`,
or a non-generic `PluginInstallRecord & { enabled: false }` used at the two
consumption sites that do not care about `R`. **The exact spelling is a plan
decision**; what is verified is that the two consumers below both accept a widened
`resources`. `[ASSUMED — the generic body above is a recommendation, not read from code]`

**Every call site of `toDisabledRecord` (production):** exactly one —
`enable-disable.ts:375`, `const disabled = toDisabledRecord(installed, new Date().toISOString());`
inside `runDisableBranch`. `[VERIFIED: grep for toDisabledRecord across extensions/ returns state-io.ts:122 (definition) and enable-disable.ts:58 (import), :375 (call)]`

**Every consumer of the `DisabledPluginRecord` type (production):** two, both in
`enable-disable.ts` — the type-only import at `:93` and the return-type field
`disabled?: DisabledPluginRecord` on `runDisableBranch` at `:333`. The map-slot
replacement discipline is at `:599-606`.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:93, 333, 599-606]`

**Comment debt.** `enable-disable.ts:363-374` and `state-io.ts:90-120` both narrate the
zeroing as the invariant, in detail. `state-io.ts:152-156` additionally documents that
`isRecordedButDisabled` does not read the arrays because *"emptiness is a consequence of
disabling, never the marker"* — that sentence stays true and becomes more load-bearing, not
less. `enable-disable.ts:365-368` cites D-63-04 as the reason hooks are zeroed alongside
the other four; that rationale is what this phase reverses and its replacement text must
say why removal-without-forgetting is now the rule.
`[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:90-120, 152-156; orchestrators/plugin/enable-disable.ts:363-374]`

## Reason on the Disabled Row (D-100-07 / ENBL-16)

CONTEXT treats this as an orchestrator-side stamping decision. It is that, **plus two
type/render changes it does not name**:

1. `PluginDisabledMessage` (`notify.ts:775-781`) declares **no `reasons` field**:

```ts
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}
```

2. The renderer's `disabled` arm hard-codes `undefined` (`notify.ts:2415-2422`):

```ts
      return joinTokens([
        ICON_DISABLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(disabled)",
        composeReasons(undefined, false, false, probe),
      ]);
```

Both must change: add `readonly reasons?: readonly ContentReason[]`, and pass
`p.reasons` at `:2421`. The `false, false` soft-dep arguments stay hard-coded — that is
what keeps D-100-06's byte guarantee structural on this row rather than test-enforced.
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:775-781, 2408-2422]`

3. The JSDoc at `notify.ts:760-770` explicitly justifies the absence
(*"the absent `reasons` field is what makes 'a disabled row never carries
`{not in manifest}`' structural rather than test-enforced. A row type with no reasons
field cannot emit a manifest-absence reason"*). That paragraph is now false and must be
rewritten, along with `docs/output-catalog.md:338`'s *"the variant carries no `reasons`
(a disabled plugin is in the user-requested state, not a failure state)"*.

4. `not in manifest` is already a member of the `REASONS` closed set (it is stamped on
`buildStateOnlyInstalledRow` at `info.ts:993` and on list rows at `list.ts:330`), so
**COMPAT-01's `REASONS` clause at `:126` stays green** — no new reason token.
`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:126; extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:993; list.ts:330]`

## The `buildBlock` Reroute (D-100-08 / ENBL-17)

### What `partitionDisabledScopes` must stop doing

```ts
function partitionDisabledScopes(opts, found): { disabled: DisabledScope[]; infoFound: [...] } {
  const disabled: DisabledScope[] = [];
  const infoFound: ... = [];
  for (const f of found) {
    const installed = f.record.plugins[opts.plugin];
    if (installed !== undefined && isRecordedButDisabled(installed)) {
      disabled.push({ scope: f.scope, installed, autoupdate: f.autoupdate });
    } else {
      infoFound.push(f);
    }
  }
  return { disabled, infoFound };
}
```

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2073-2092]`

It must stop **diverting** disabled scopes out of `infoFound` — every found scope goes
to `buildBlock`. That collapses four downstream branches in `getPluginInfo`:

| Site | File:line | Disposition |
|------|-----------|-------------|
| `disabledBlocks` construction | `info.ts:2271-2273` | deleted |
| all-disabled early return | `info.ts:2278-2286` | deleted (`infoFound.length === 0` becomes unreachable when `found.length > 0`) |
| `disabledBlocks.length === 0` conjunct on the single-scope fast path | `info.ts:2292` | simplifies to `sole !== undefined && rest.length === 0` |
| mixed disabled+info second notify | `info.ts:2357-2360` | deleted — this is the "mixed-message-kind problem dissolves" CONTEXT predicts, and the `info.ts:2352-2356` comment goes with it |

`buildDisabledInventoryBlock` (`:2030-2053`) and the `DisabledScope` interface
(`:2056-2060`) become unreferenced. Whether they are deleted or repurposed depends on the
fetch-skip carrier decision below. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2266-2373]`

### Where the disabled record lands inside `buildBlock`

`buildBlock` branches (`:806-879+`): (a) manifest read failure → `(failed)`; (b) manifest
loaded but name absent → `buildStateOnlyInstalledRow` when a record exists, else
`(failed) {not in manifest}`; (c)…(e) declared cases. A disabled record hits (b) when the
manifest dropped it and (c)/(d)/(e) when it is still declared — which is precisely the
D-100-09 bound (a still-declared disabled plugin resolves from the manifest exactly as an
uninstalled one does). Both paths currently derive status via
`derivePersistedInstalledStatus` (`:1008-1012`), which returns only
`"installed" | "partially-installed"` — it reads `compatibility.unsupported.length`, never
`enabled`. **The disabled status must be injected ahead of that derivation on every arm
that can see an installed record**, not inside it, or a disabled plugin renders
`(installed)`. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:806-879, 976-1012]`

### The type changes on the render path — **two, not one**

CONTEXT says the `notify.ts:1337` `Extract<PluginStatus, ...>` widening is the only type
change. It is not.

**(i)** The `Extract`, currently 7 members, gains `"disabled"`:

```ts
interface PluginInfoRowBase {
  // FSTAT-07 / D-66-04: `partially-installed` widens the info row status set so an
  // installed plugin re-resolving `partially-available` reports `(partially-installed)` on
  // the info surface. `partially-upgradable` is deliberately omitted -- it is a
  // list-inventory-only concept (an installed plugin's info is partially-installed
  // or installed, never partially-upgradable).
  readonly status: Extract<
    PluginStatus,
    | "installed" | "available" | "remote" | "unavailable"
    | "partially-available" | "failed" | "partially-installed"
  >;
```

That is the FSTAT-07 rationale comment CONTEXT cites, quoted verbatim from `notify.ts:1332-1336`.
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:1331-1353]`

**(ii)** `pluginInfoStatusGlyph` (`notify.ts:3243-3269`) is an exhaustive switch ending in
`assertNever(status)`. Widening the `Extract` without adding a `case "disabled": return ICON_DISABLED;`
arm is a **typecheck failure**, not a silent gap. `ICON_DISABLED = "◍"` (`notify.ts:1592`) is
the same glyph the current disabled row uses, so the glyph slot stays byte-identical.
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:1592, 3243-3269]`

**Confirmed green:** `disabled` is already `PLUGIN_STATUSES[14]` of 19
(`notify.ts:472-509`), so COMPAT-01's status-tuple clause
(`compat-01-no-expansion.test.ts:206`, which CONTEXT cites as `:230` — the clause *starts*
at `:206`, the tuple literal spans `:208-231`) and SNM-02's 19-entry lock
(`notify-closed-set-locks.test.ts:50`) both stay green with no edit.
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:472-509; tests/architecture/compat-01-no-expansion.test.ts:206-232]`

### Carrying the D-96-04 `{already disabled}` note through the reroute

`emitFetchSkip` (`info.ts:2168-2214`) builds its skip sources from **two** inputs:

```ts
  const sources: readonly SkipSource[] = [
    ...built.filter(({ stateOnly }) => stateOnly).map(...  reason: "not in manifest" ...),
    ...disabled.map((d): SkipSource => ({ ... reason: "already disabled", ... })),
  ];
```

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2183-2200]`

Once `partitionDisabledScopes` stops populating `disabled`, the second spread is empty and
the `{already disabled}` note vanishes — taking the `disabled-fetch-skipped` and
`mixed-fetch-skipped` catalog states with it.

**Recommended carrier: extend the `InfoBlock` discriminator.** `InfoBlock` already exists
for exactly this purpose, with a rationale that generalizes:

```ts
interface InfoBlock {
  readonly block: PluginInfoMessage;
  /** The block came from `buildStateOnlyInstalledRow` (there is nothing to fetch). */
  readonly stateOnly: boolean;
}
```

whose doc comment (`info.ts:776-786`) argues the flag is *"reported by the producer rather
than re-derived from the rendered row… A discriminator costs one field and cannot drift."*
The same argument applies verbatim to disabled-ness. Replace or supplement `stateOnly`
with a producer-reported skip reason — e.g. `skipReason?: ContentReason` — so `emitFetchSkip`
maps one list instead of concatenating two.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:776-791, 932-949]`

**Open decision the planner must make (not settled by CONTEXT):** a record that is *both*
disabled *and* manifest-absent would today satisfy `stateOnly` **and** the disabled arm.
With the current two-list concatenation that would emit **two** skip rows for one scope;
with a single `skipReason` field it emits one and the producer picks. Given D-100-07 makes
`{not in manifest}` the load-bearing reason on a disabled row, the consistent choice is
`already disabled` for the fetch-skip note (it names why the *fetch* did nothing) and
`{not in manifest}` on the inventory row (it names what constrains the user next) — but
this is a genuine decision, and the catalog's `mixed-fetch-skipped` state
(`docs/output-catalog.md:1645`) describes the two-cause composition as scope-disjoint,
which this case is not. `[ASSUMED]`

### Catalog states and byte fixtures that move

| Catalog state | `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | Disposition |
|---|---|---|---|
| `disabled-inventory` | `:331-341` | `:655-676` | **stays** — the `list` surface row is unchanged (ENBL-15) except when it gains `{not in manifest}` (ENBL-16) |
| `disabled-inventory-with-description` | `:344-358` | `:679-700` | stays |
| info-surface disabled prose | `:1688` | — | **rewritten** — it currently states the info surface renders via the list-arm cascade and defers bytes to `disabled-inventory` ("Byte form: see the list section's `disabled-inventory` state") |
| *new*: disabled info row | — | — | **NEW state + NEW fixture** — the info disabled row gains description and component lines, so it needs its own byte block rather than a cross-reference |
| `disabled-fetch-skipped` | `:1634-1643` | `:3059-3080` | stays green **only if** the carrier above is implemented |
| `mixed-fetch-skipped` | `:1645-1656` | `~:3090-3105` | same; plus the disjointness question above |
| `disabled-record-refresh` | `:1038-1046` | `:2059-2080` | unaffected — `update`'s disabled short-circuit, not `info` |
| `update-autoupdate-disabled-repin` | `:2101-2111` | `:3450-3470` | unaffected |
| Severity-routing prose | `:1531` | — | check: it enumerates the info surface's success states; a disabled state joining the `info`-severity list may need naming |

`[VERIFIED: grep "disabled" over docs/output-catalog.md and tests/architecture/catalog-uat.test.ts, this session]`

The catalog note at `:1688` is the one CONTEXT under-weights: because the info disabled row
today has **no byte fixture of its own** (it borrows the list state's), the reroute is an
**addition** of a catalog state, not a relocation of one. The same-commit pairing rule
applies to the new state and its fixture.

## COMPAT-01 Amendments

| Clause | Line | Verdict |
|---|---|---|
| `REASONS` holds exactly its inherited members | `:126` | **stays green** — `not in manifest` and `already disabled` are both existing members |
| `STATUS_TOKENS` holds exactly its inherited members | `:173` | stays green |
| `PLUGIN_STATUSES` holds exactly its inherited members | `:206` | **stays green** (D-100-08 confirmed: `disabled` is already member 15 of 19) |
| `MARKETPLACE_STATUSES` | `:234` | stays green |
| every glyph constant holds its inherited code point | `:250` | stays green — no new glyph; `ICON_DISABLED` is reused |
| the notify module declares no eighth glyph export | `:301` | stays green — no new glyph |
| **the persisted install record holds exactly its inherited key set** | **`:342`** | **AMENDED** |
| the install outcome inherits exactly the signals `installPlugin` populates | `:359` | stays green — no new install-outcome signal |
| **no manifest-snapshot or orphan field reached the install record** | **`:388`** | stays green **iff the new key avoids 7 forbidden names** — see § Naming |
| the state schema version union is unchanged | `:412` | **stays green** (D-100-01 confirmed: no bump) |
| the default state still declares the current schema version | `:420` | stays green |
| the network clause | `:428` | stays green — no new network reach |

`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts, all clause line numbers via grep for "^test(" this session]`

### The `:342` clause exactly as it reads now

```ts
test("COMPAT-01: the persisted install record holds exactly its inherited key set", () => {
  assert.deepEqual(
    Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties).sort((a, b) => a.localeCompare(b)),
    [
      "compatibility",
      "enabled",
      "installedAt",
      "resolvedSha",
      "resolvedSource",
      "resources",
      "updatedAt",
      "version",
    ],
    "COMPAT-01: no field may be added to or removed from the persisted install record.",
  );
});
```

`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:342-357]`

**Minimal edit:** insert the new key name in `localeCompare` order and extend the
assertion message to record *why* the addition is sanctioned. With `hookEntries` the
insertion is between `"enabled"` and `"installedAt"`. The message currently reads as an
absolute prohibition; it should become a statement that the set is *pinned*, with the
additive-optional rule named, so a future author reads a rule rather than a wall.

**The `:388` clause is the naming constraint** (see § Naming). Its `shapes` array —
`["manifestSnapshot", "manifest", "manifestEntry", "entry", "orphan", "orphanRewake", "orphaned"]` —
is checked with `Object.hasOwn` against the schema's properties, so a key literally named
`entry` or `manifestEntry` fails it. `hookEntries` does not appear in the list and
`Object.hasOwn` is exact-match, so it passes.

## The ENBL-05 Drift Gate — discretion question answered

**Answer: the new `hydrateScopeFromState` guard needs NO new clause. It is already covered.**

The gate at `tests/orchestrators/reconcile/plan.test.ts:991-1027` walks **every `.ts` file
under the extension source tree** — not an allowlist:

```ts
  const offenders: string[] = [];
  for (const rel of await extensionSourceFiles()) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (TWO_AXIS_CONJUNCTION.test(stripped)) { offenders.push(...); }
    if (rel === PREDICATE_DEFINITION_SITE) { continue; }
    for (const re of INLINE_REDERIVATIONS) {
      if (re.test(stripped)) { offenders.push(...); }
    }
  }
```

with `extensionSourceFiles()` a recursive `readdir` walk from `EXTENSION_SOURCE_ROOT`
collecting every `.ts` (`:863-880`), and `state-io.ts` the sole exemption
(`PREDICATE_DEFINITION_SITE`). The pattern set is six regexes (`:793-800`):
`/!\s*[\w.]+\.enabled\b/`, `/\.enabled\s*===\s*false/`, `/\.enabled\s*!==\s*true/`,
plus the destructured-binding, bracket-access and `Boolean()`-coercion twins.
`[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:761-800, 863-880, 991-1027]`

`bridges/hooks/event-router.ts` is therefore already in the walk. Writing the guard as
`isRecordedButDisabled(pluginRecord)` passes; writing it as `!pluginRecord.enabled` or any
of the five other twin spellings is rejected automatically, by name, with a remediation
message. The gate's own comment (`:992-998`) records that it was widened from a
four-site allowlist precisely because *"a fifth twin (`!record.enabled`) landed in
`orchestrators/reconcile/apply.ts` with the gate green."* Adding a clause naming
`event-router.ts` would reintroduce the allowlist shape the widening removed.

**One thing the plan should do instead:** the gate's sibling truth-table fixture
`recordWith(installable, enabled)` at `:913-929` encodes `skills: enabled ? ["s1"] : []`,
i.e. the assumption "disabled ⇒ empty" as *test data*. It stays functionally valid
(the predicate never reads the arrays), but under ENBL-18 that fixture no longer
represents the only legal disabled shape. Consider adding a truth-table cell for
disabled-with-populated-resources so the predicate's array-independence is proven against
the shape this phase creates, not only against the shape it retires. The companion test
at `:977-989` ("the transient all-empty-resources shape with enabled: true is NOT
disabled") already proves the other diagonal.

## Test-Suite Disposition (D-100-11)

Classification key: **(a)** fixture-input-only, stays valid untouched · **(b)** asserts
disable ZEROES the arrays, must change · **(c)** asserts the brand/type, must change with
the new generic signature.

### The brand files — CONTEXT says 2 test files; research finds **1**

| File | Test / symbol | Line | Class | Disposition |
|---|---|---|---|---|
| `tests/persistence/state-io.test.ts` | `"ENBL-02: toDisabledRecord empties all resources, sets enabled:false, preserves identity + restamps updatedAt"` | `:645-689` | **(b)+(c)** | Rename and invert. The `assert.deepEqual(disabled.resources, {skills:[],...})` at `:657-663` becomes an assert that `disabled.resources` deep-equals the **input** record's populated `{skills:["s"],prompts:["p"],agents:["a"],mcpServers:["m"],hooks:["h"]}` from `:650`. The identity-preservation asserts (`:665-668`), the `updatedAt` restamp (`:670`) and the `STATE_VALIDATOR.Check` round-trip (`:672-688`) all stay — the validator clause is now *more* valuable, since it proves a disabled+populated record is a legal stored shape. |
| `tests/persistence/state-io.test.ts` | `"ENBL-02: DisabledPluginRecord forbids non-empty resources at compile time"` | `:691-714` | **(c)** | Rewrite. The `@ts-expect-error` at `:696-697` (`const badSkills: DisabledSkills = ["x"]`) inverts — populated is now legal. The new compile-time proof must target the **producer**: a call to `toDisabledRecord` whose result is asserted to carry the input's `R`, with a `@ts-expect-error` on an attempt to assign a *different* resources shape. Keep the `EnabledPluginRecord` half at `:703-713` unchanged. |
| `tests/persistence/state-io.test.ts` | `"D-77-02 toDisabledRecord preserves resolvedSha through the disable transform"` | `:472-490` | **(a)** | Stays. Direct precedent for the new key's own preservation test. |
| `tests/orchestrators/plugin/update.test.ts` | `makeDisabledPluginRecord(version)` | `:139-148` | **(a)** | **Stays untouched.** CONTEXT lists this file as one of "2 test files [asserting] the brand". It is not: this is a local **fixture factory** returning `PluginRecord`, constructing disabled+empty as *input*. It imports neither `DisabledPluginRecord` nor `toDisabledRecord`. `[VERIFIED: grep for DisabledPluginRecord\|toDisabledRecord across tests/ — update.test.ts matches only the similarly-named local helper]` |
| `tests/orchestrators/plugin/update.test.ts` | `makeDisabledPartialPluginRecord` and its 8 call sites (`:159, :3000, :3077, :3158, :3300, :3354, :3669, :3717, :3783`) | — | **(a)** | All fixture input. Stay. |

**Production brand consumers (the "2 source files" CONTEXT names — confirmed):**
`persistence/state-io.ts:105-132` (definition + producer) and
`orchestrators/plugin/enable-disable.ts:93, 333, 599-606` (type import, return-type field,
map-slot replacement). `[VERIFIED]`

### `tests/orchestrators/plugin/enable-disable.test.ts` — the (b) concentration

| Test | Line | Assertions | Class | Becomes |
|---|---|---|---|---|
| `"ENBL-02: disable preserves version pin and empties resources arrays"` | `:397` | `:457-461` — four `assert.deepEqual(rec.resources.X, [], "resources.X emptied")` | **(b)** | Rename (drop "and empties resources arrays"; the version-pin half stays the point). The four asserts invert to deep-equal against the seeded record's populated arrays at `:439+`. This is **the** behavioral test D-100-10 requires. |
| `"D-63-04: disable of a hooks-only plugin empties resources.hooks"` | `:474` | `:526-530` — five asserts including `"resources.hooks emptied (D-63-04)"` | **(b)** | Rename and invert. D-63-04's rationale (symmetry with what landed on disk) is what ENBL-13 preserves for *artifacts* and ENBL-18 reverses for the *record*; the test title and comment at `:468-472` must say so. Hooks is the highest-value case — it is the kind the new record key exists for. |
| unnamed block asserting five empty arrays plus a `"resources"` key check | `:940-965` | `:954-958`, `:965` | **(b)** — verify | Sits inside `"ENBL-07 / D-97-01: enable on a manifest-absent disabled PARTIAL fails clean -- nothing materialized, record stays disabled"` (`:894`). The asserts pin *post-failed-enable* state. Because the enable **failed**, nothing re-materialized, so the record keeps whatever it had — under retention that is the populated form. Must change, and it is also the test most likely to catch Hazard 1 regressing. |
| `"CR-01: fresh enable succeeds end-to-end… state re-populated"` | `:538` | `:593-594` `rec.resources.skills.length > 0` | **(a)** | Stays — asserts enable *re*-populates, still true. **This test is the Hazard-1 canary**: it enables a plugin with a skill. If ENBL-19 is not implemented, this test fails with `CrossPluginConflictError`. |
| `"ENBL-07: enable on a disabled PARTIAL re-materializes…"` | `:618` | `:684` `rec.resources.skills.length > 0` | **(a)** | Stays; second Hazard-1 canary. |
| `"I3: disable cascade partial failure mutates state.resources to drop the cascaded artifacts (TR-03 fold) and surfaces (failed)"` | `:1731` | — | **(a)** | **Stays.** The partial-cascade path calls `applyPartialCascadeFold` (`enable-disable.ts:342`, `shared.ts:797-813`) and returns **before** `toDisabledRecord`. Shrinking the record to match what actually got unstaged is still correct; that path is unaffected by ENBL-18. |
| seed helper `resources` switch | `:114-126` | — | **(a)** | Stays (three shapes: all-empty, hooks-only, skills-only) |
| `disabled: false, // populated resources = enabled` | `:1506` | — | **(a)** — comment | The inline comment now states a falsehood. Fix the comment. |

`[VERIFIED: grep "resources" over tests/orchestrators/plugin/enable-disable.test.ts + test-name extraction, this session]`

### The remaining 12 fixture files — all class (a), with per-file notes

Each was measured for `enabled: false` occurrences; all construct disabled records as
*input*, none assert that disable performed the zeroing (that assertion lives only in
`enable-disable.test.ts` and `state-io.test.ts`).

| File | `enabled: false` count | Class | Note |
|---|---|---|---|
| `tests/orchestrators/reconcile/plan.test.ts` | 17 | (a) | Highest count; also hosts the drift gate (§ above) and the `recordWith` truth-table fixture at `:913-929` — consider **adding** a disabled+populated cell |
| `tests/orchestrators/plugin/update.test.ts` | 5 | (a) | See brand table |
| `tests/orchestrators/reconcile/apply.test.ts` | 5 | (a) | ENBL-08 fence coverage; D-100-09 declines to reopen it |
| `tests/orchestrators/plugin/enable-disable.test.ts` | 4 | (a)+(b) | See table above |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 4 | (a) | Classifier reads `enabled`, not arrays |
| `tests/persistence/migrate.test.ts` | 3 | (a) | Pins `ensurePluginEnabled` / `ensurePluginResources` fills; the new key needs **no** migrate fill (D-100-01), so add a clause proving a legacy record without it loads unchanged |
| `tests/orchestrators/edge-deps.test.ts` | 2 | (a) | — |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts` | 2 | (a) | **Also the ENBL-17 home** — the zero-network `--fetch` counters at `:951+` region are the NFR-5 proof that must survive the reroute |
| `tests/orchestrators/plugin/reinstall.test.ts` | 2 | (a) | — |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | 1 | (a) | — |
| `tests/orchestrators/marketplace/update.test.ts` | 1 | (a) | Byte-pins the cascade `{already disabled}` skip row |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts` | 1 | (a) + **INV-04** | `:437` `"INV-04: a manifest-absent CANONICAL disabled record renders `(disabled)` with no reason brace"` — **must change under ENBL-16**; this is the single test that directly contradicts D-100-07 |
| `tests/orchestrators/reconcile/backfill.test.ts` | 1 | (a) | `:728` comment references `assertNoCrossPluginConflicts` tripping — worth re-reading when ENBL-19 lands |
| `tests/shared/plugin-path.test.ts` | 1 | (a) | `plugin-path.ts` reads the boolean, not arrays — unaffected |

Additionally **outside CONTEXT's 14**: `tests/orchestrators/plugin/list.test.ts:1069`
(`"ENBL-06 / INV-04: a disabled PARTIAL renders bare `(disabled)` beside an enabled
partial's `(partially-installed) {lsp}` in the same block"`) and its `:1065` comment
about *"INV-04's 'never `{not in manifest}` on a disabled row'"* — **class (b)-adjacent**,
must be revisited under ENBL-16.
`[VERIFIED: grep "INV-04" over tests/, this session]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Excluding a plugin's own record from the conflict guard | A bespoke filter in `install.ts` | `removePluginRecord`, hoisted to `orchestrators/plugin/shared.ts` | Two identical copies already exist; a third trips `sonarjs/no-identical-functions` (error) |
| Reading "is this record disabled" | `!record.enabled` at the new hydrate site | `isRecordedButDisabled` from `persistence/state-io.ts` | The whole-tree drift gate rejects all six twin spellings automatically |
| Manifest-backed → state-only fallback for the disabled `info` arm | A parallel disabled-specific builder | `buildBlock`'s existing ladder (`info.ts:806`) | It is the single biggest reuse in the phase; `buildDisabledInventoryBlock` becomes dead |
| The disabled row's component inventory | New composition | `composeStateOnlyComponents` (`info.ts:1036`) | Already record-backed, already sorted, already carries the D-96-03 three-way hooks discriminant |
| An additive record key with a schema bump | `schemaVersion: 3` + migration | The `resolvedSha` pattern (`state-io.ts:62-68`) | Optional + additive + no migrate fill is the established, gate-approved shape |
| Skip-note provenance | Re-deriving "was this disabled" from the rendered row | A producer-reported field on `InfoBlock` | `info.ts:776-786` argues this exact case: *"A discriminator costs one field and cannot drift"* |

**Key insight:** almost every piece of this phase already exists somewhere in the tree
with a rationale comment beside it. The failure mode here is not inventing a bad solution;
it is missing a site (Hazard 1) or duplicating a helper (`removePluginRecord`).

## Common Pitfalls

### Pitfall: retention lands before its two guards
**What goes wrong:** ENBL-18 (retention) merged in an earlier wave than ENBL-14 (hydrate
guard) or ENBL-19 (conflict-guard exclusion) ships a build where disabled plugins'
hooks re-register on `/reload` and enable throws.
**Why it happens:** ENBL-18 is a two-line change to `toDisabledRecord`, so it reads as the
trivial first task.
**How to avoid:** put the retention change, the hydrate guard and the conflict-guard fix
in **one plan**. Their tests are mutually load-bearing.
**Warning signs:** `tests/orchestrators/plugin/enable-disable.test.ts:538` (`CR-01: fresh
enable succeeds end-to-end`) failing with `CrossPluginConflictError`.

### Pitfall: widening the `Extract` without the glyph arm
**What goes wrong:** `npm run typecheck` fails at `notify.ts:3266` `assertNever(status)`.
**How to avoid:** the two edits are one unit; `case "disabled": return ICON_DISABLED;`.
**Warning signs:** a `Argument of type '"disabled"' is not assignable to parameter of type 'never'` error.

### Pitfall: stamping the reason without widening the row type
**What goes wrong:** `PluginDisabledMessage` has no `reasons` field, so the orchestrator's
stamp is an excess-property error — or worse, is spread into an object typed loosely
enough to accept it and then silently dropped by `composeReasons(undefined, ...)` at
`notify.ts:2421`.
**How to avoid:** treat ENBL-16 as three edits (type field, renderer argument, orchestrator
stamp) plus three prose rewrites (JSDoc, catalog, REQUIREMENTS).
**Warning signs:** a green typecheck with an unchanged rendered byte.

### Pitfall: the fetch-skip note disappears silently
**What goes wrong:** `partitionDisabledScopes` stops populating `disabled`, `emitFetchSkip`
receives an empty array, and `--fetch` on an all-disabled marketplace renders bytes
identical to a bare run — the exact regression D-96-04 exists to prevent.
**Why it happens:** nothing fails to compile; the catalog fixture is the only guard.
**How to avoid:** implement the `InfoBlock` carrier in the same task as the partition change.
**Warning signs:** `catalog-uat.test.ts` `disabled-fetch-skipped` / `mixed-fetch-skipped`.

### Pitfall: the new key omitted from `clonePluginRecord`
**What goes wrong:** reinstall's old-record snapshot (`reinstall.ts:2018-2034`) enumerates
fields explicitly rather than spreading, so a new key is dropped from the snapshot without
any compile error.
**How to avoid:** add the key at `:2028`'s sibling position and add a preservation assert
to `tests/orchestrators/plugin/reinstall.test.ts`.

### Pitfall: mistaking `reinstall.ts:1761-1762` for a record read
**What goes wrong:** a task adds an `enabled` guard to a derivation that reads freshly
staged handles; the guard is dead code and the reviewer has to re-derive why.
**How to avoid:** see § Reader Inventory R3.

### Pitfall: the disabled record renders `(installed)` on the info surface
**What goes wrong:** `derivePersistedInstalledStatus` (`info.ts:1008-1012`) reads only
`compatibility.unsupported.length` and returns `"installed" | "partially-installed"`.
Routing a disabled record through `buildBlock` without injecting the disabled status ahead
of that derivation renders a disabled plugin as installed.
**Warning signs:** the new info-disabled catalog fixture showing `●` and `(installed)`.

## Code Examples

### The current unguarded hydrate loop (ENBL-14's edit site)

```ts
// extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:589-616
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (mpRecord.scope !== loc.scope) {
      continue;
    }

    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      const hookSlugs = pluginRecord.resources.hooks;
      if (hookSlugs.length === 0) {
        continue;
      }

      // D-57-03: `resources.hooks` carries the per-plugin hooks-container-dir
      // generatedName; the on-disk file is `<hooksDir>/<generatedName>/hooks.json`.
      // Zero or one entry today; iterate defensively for forward-compat.
      for (const slug of hookSlugs) {
        const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
        await tryHydrateOnePlugin(
          loc.scope, mpName, pluginId, pluginRecord.resolvedSource,
          hooksJsonPath, loc.hooksDir, cwd,
        );
      }
    }
  }
```

### The exclusion pattern to copy into `install.ts` (ENBL-19)

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1221-1225
  assertNoCrossPluginConflicts(
    scope,
    { skills: generated.skills, commands: generated.commands, agents: generated.agents },
    removePluginRecord(tx.state, marketplace, plugin),
  );
```

### The additive-optional key precedent (ENBL-10)

```ts
// extensions/pi-claude-marketplace/persistence/state-io.ts:62-68
  // D-77-02 / PURL-09: the full 40-hex resolved commit sha for git-source
  // installs. OPTIONAL and additive -- NO schemaVersion bump (mirrors the
  // lastReconciledExtensionVersion precedent), so a legacy record without it
  // loads unchanged and absence needs no migrate fill. Git-source-only:
  // path/github-name installs omit it. Reinstall uses THIS full sha as its
  // re-clone checkout pin; clone GC presence-checks it to derive live keys.
  resolvedSha: Type.Optional(Type.String()),
```

### The three-way hooks discriminant the record path must respect (ENBL-12)

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:535-538
type StateOnlyHookRead =
  | { readonly kind: "none" }
  | { readonly kind: "listed"; readonly entries: readonly HookSummaryEntry[] }
  | { readonly kind: "degraded"; readonly reason: ContentReason };
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), Node >= 20.19.0, TypeScript run natively (no build step) |
| Config file | none — `package.json` scripts + `tsconfig.json` (`noEmit`, strict) |
| Quick run command | `node --test tests/persistence/state-io.test.ts tests/orchestrators/plugin/enable-disable.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests) |
| Fs mocking | `memfs` (persistence/platform suites); orchestrator suites use real tmpdirs |
| Byte contract | `tests/architecture/catalog-uat.test.ts` against `<!-- catalog-state: NAME -->` blocks in `docs/output-catalog.md` |
| Whole-tree gates | `tests/orchestrators/reconcile/plan.test.ts` (ENBL-05 drift), `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/no-orchestrator-network.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts` |

`[VERIFIED: .planning/codebase/STACK.md; direct reads of the named test files]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENBL-10 | New optional key validates; a legacy record without it loads unchanged; no `schemaVersion` bump | unit | `node --test tests/persistence/state-io.test.ts` | ✅ extend (`:472` resolvedSha test is the template) |
| ENBL-10 | COMPAT-01 key-set clause amended, `:388` forbidden-name clause still green | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ amend `:342` |
| ENBL-10 | Migration performs **no** fill for the new key | unit | `node --test tests/persistence/migrate.test.ts` | ✅ add clause |
| ENBL-11 | Persisted payload is the supported subset; entries round-trip to the rendered `hooks:` line byte-identically | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ extend |
| ENBL-12 | **Record wins** when the key is present (assert zero disk reads on the hooks path) | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ extend |
| ENBL-12 | **Legacy path**: key absent → `readStateOnlyHookEntries` still answers from the materialized file | unit | same | ✅ extend — this is the regression D-100-03 exists to prevent |
| ENBL-12 | Key present but empty renders no `hooks:` line and stamps no reason (`listed`-with-zero ≠ `none` ≠ `degraded`) | unit | same | ❌ Wave 0 |
| ENBL-13 | Disable still deletes `hooks.json` and all four other artifact kinds from disk | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:474` (invert the record half, keep the disk half) |
| **ENBL-14** | **A disabled plugin with populated `resources.hooks` is NOT hydrated on reload** | unit | `node --test tests/bridges/…/event-router*.test.ts` | ❌ **Wave 0 — the phase's central correctness test** |
| ENBL-14 | Guard reads `isRecordedButDisabled`, not a twin spelling | architecture | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ automatic, no new clause |
| ENBL-15 | A disabled record with populated `agents`/`mcpServers` renders the byte-identical bare `(disabled)` list row | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ❌ Wave 0 |
| ENBL-16 | A manifest-absent disabled record renders `(disabled) {not in manifest}` and **no other reason** | unit | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ invert `:437` |
| ENBL-16 | Same on the info surface | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ Wave 0 |
| ENBL-16 | A disabled **partial** carries `{not in manifest}` and not the kind tokens | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ amend `:1069` |
| ENBL-17 | Disabled `info` reports description + components | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ Wave 0 |
| ENBL-17 | New disabled-info catalog state + byte fixture | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ❌ Wave 0 (fixture **and** catalog block, same commit) |
| ENBL-17 | `{already disabled}` fetch-skip survives; `disabled-fetch-skipped` + `mixed-fetch-skipped` still render | architecture | same | ✅ existing fixtures must stay green |
| ENBL-17 | The disabled info path still performs **zero** network calls under `--fetch` | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ the `:951+` zero-counter suite — must be extended to cover the rerouted disabled arm |
| ENBL-17 | Glyph/token stay `◍` / `(disabled)`; SNM-02 19-entry lock green | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ no change expected |
| **ENBL-18** | **Disable preserves the inventory exactly** (all five arrays deep-equal the pre-disable record) | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ invert `:397` — **mandatory: the generic constrains only the producer** |
| ENBL-18 | Same for a hooks-only plugin | unit | same | ✅ invert `:474` |
| ENBL-18 | Producer generic makes an inventory change a compile error | typecheck | `npm run typecheck` | ✅ rewrite `tests/persistence/state-io.test.ts:691` |
| ENBL-18 | A disabled+populated record is a legal stored shape (`STATE_VALIDATOR.Check`) | unit | `node --test tests/persistence/state-io.test.ts` | ✅ `:672-688` already does this; input changes |
| ENBL-18 | Partial-cascade fold still SHRINKS the record (the fold path bypasses `toDisabledRecord`) | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:1731` stays green unmodified — treat a failure here as a signal the fold path was touched by mistake |
| **ENBL-19** | **Enable of a disabled plugin owning skills/commands/agents succeeds** (no self-conflict) | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:538` + `:618` are existing canaries; add an explicit named test |
| ENBL-19 | A *genuine* cross-plugin conflict is still rejected on the enable path | unit | `node --test tests/orchestrators/plugin/shared.test.ts` | ❌ Wave 0 — proves the exclusion did not disable the guard |
| INV-04 supersession | REQUIREMENTS.md text amended; no stale test asserts the bare row | docs/unit | `node --test tests/docs/` + the two list suites | ✅ amend |

### Sampling Rate

- **Per task commit:** the narrowest suite the task touches, e.g.
  `node --test tests/persistence/state-io.test.ts` or
  `node --test tests/orchestrators/plugin/enable-disable.test.ts` (each < 30s).
- **Per wave merge:** `npm run typecheck && node --test tests/architecture/ tests/persistence/ tests/orchestrators/plugin/`.
  The architecture directory is non-negotiable at wave boundaries — COMPAT-01, the
  drift gate and the catalog gate are the three that fail *late* otherwise.
- **Phase gate:** full `npm run check` green before `/gsd-verify-work`.
- **Byte-fixture rule:** any commit touching `docs/output-catalog.md`'s
  `<!-- catalog-state: … -->` blocks must, in the same commit, touch
  `tests/architecture/catalog-uat.test.ts` — neither direction of the gate may pass on a
  half-landed pair.

### Wave 0 Gaps

- [ ] `tests/bridges/hooks/…` — **a disabled record with populated `resources.hooks` is not hydrated** (ENBL-14). No such test exists; check whether an existing `event-router` / hooks-bridge suite already stands up a state fixture and extend it rather than creating a new file.
- [ ] `tests/orchestrators/plugin/list.test.ts` — disabled record with populated `agents`/`mcpServers` renders the bare row (ENBL-15).
- [ ] `tests/orchestrators/plugin/info-manifest-absent.test.ts` — disabled `info` reports description + components (ENBL-17); `{not in manifest}` on the info disabled row (ENBL-16); key-present-but-empty renders no `hooks:` line (ENBL-12).
- [ ] `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — new disabled-info catalog state and byte fixture (ENBL-17).
- [ ] `tests/orchestrators/plugin/shared.test.ts` — a genuine cross-plugin conflict is still rejected after the exclusion (ENBL-19).
- [ ] `tests/persistence/migrate.test.ts` — legacy record without the new key loads unchanged, no fill (ENBL-10).
- [ ] Framework install: none — `node:test` is built in.

## Security Domain

Security enforcement is not disabled in `.planning/config.json`, so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase (git credential flow untouched) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user model; scope separation is a data-partition concern, unchanged here |
| V5 Input Validation | **yes** | The new record key is **state-supplied data** validated by `PLUGIN_INSTALL_RECORD_SCHEMA` (typebox `Compile`) — the same single validation boundary the rest of the record uses |
| V6 Cryptography | no | None introduced |
| V12 File / Path handling | **yes** | `assertPathInside` (`shared/path-safety.ts`), NFR-10 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A tampered `state.json` supplies a traversal slug used as a path component | Tampering | `assertPathInside` runs **before** `readFile` at both hooks read sites (`event-router.ts:635`, `info.ts:561`), each with a comment naming the write-site mirror. **The new record key reduces exposure here**: when it is present, `info` answers from the record and performs no path join at all. |
| A tampered record supplies fabricated hook entries that render as trusted inventory | Spoofing / Information disclosure | The entries are **rendered only**, never dispatched — routing comes from the parsed-config cache (`rebuildRoutingTables`, `event-router.ts:407`), which is fed by the hydrate walk over the on-disk `hooks.json`. A fabricated record entry can therefore lie to `info` but cannot register a handler. **This separation must be preserved**: the plan must not let the new key feed `hydrateScopeFromState`, only `composeStateOnlyComponents`. |
| A disabled plugin's hooks stay dispatchable after `/reload` | Elevation of privilege | **This is the vulnerability ENBL-14 closes.** Today the safety is incidental — disable deletes `hooks.json`, so the hydrate read fails and logs. Retention without the guard converts an incidental protection into a live one, since the record would then name a slug whose file may be restored by any means. |
| An unbounded record key grows `state.json` without limit | Denial of service | Entries are the supported subset of a plugin's own declared hooks — bounded by the plugin manifest, same order of magnitude as `resources.skills`. No new bound needed. `[ASSUMED]` |

`[VERIFIED for the first three rows: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:407, 628-641; orchestrators/plugin/info.ts:516-519, 555-561]`

## Environment Availability

No new external dependencies. The phase is entirely in-repo TypeScript.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | >= 20.19.0 per `engines` | — |
| `typebox` | the new schema key | ✓ | `^1.1.38`, already a direct + peer dep | — |
| `node:test` | all tests | ✓ | built in | — |
| `memfs` | persistence suites | ✓ | `^4.57.2` | — |
| `pi-subagents` (global) | 2 integration tests | ✗ (env-dependent) | — | Those two tests resolve the peer from `npm root -g`, skip in CI, and fail locally on a stale global — **environmental, not a branch regression** |

**Missing dependencies with no fallback:** none.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No `npm install` occurs; no
new entry is added to `package.json`. The legitimacy gate has no input.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Emptiness of `resources.*` as the disabled marker | `enabled: boolean` read through `isRecordedButDisabled` | ENBL-05 (Phase 97) | This phase completes the migration: emptiness stops being *produced* as well as stopping being *read* |
| A four-site allowlist drift gate | Whole-extension-tree source walk | D-99-02b | A new guard site is covered automatically; adding a named clause would regress the design |
| `info` on a manifest-absent record reads artifacts back off disk | Record-backed component inventory | D-96-01 (Phase 96) | This phase extends record-backing to hooks, the last kind that still required a disk read |
| A disabled row is structurally reason-free | A disabled row may carry `{not in manifest}` | **this phase (ENBL-16)** | Reverses INV-04 and the `PluginDisabledMessage` no-reasons guarantee |

**Deprecated by this phase:**
- `buildDisabledInventoryBlock` (`info.ts:2030`) and the `DisabledScope` interface (`:2056`) — dead once the reroute lands, unless repurposed as the fetch-skip carrier.
- The D-63-04 rationale that the disabled record's `hooks` array must be zeroed "to stay consistent with what landed on disk" (`enable-disable.ts:365-368`) — the record now describes the installation, not the current disk contents.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The parsed hook config is in scope at each ledger's record-composition point, or is cheaply threadable from the hooks bridge's stage result | New Record Key § write sites | HIGH — if not, ENBL-10/11 needs a plumbing change through `prepareStageHooks`' return shape. **Recommend a first-task spike.** |
| A2 | The persisted schema should declare the supported-entry shape directly rather than mirroring the whole `HookSummaryEntry` union | New Record Key § payload | MEDIUM — mirroring the union would let the deferred "persist dropped handlers" idea become an accidental schema change |
| A3 | The exact generic body proposed for `toDisabledRecord` type-checks as written | Type Invariant | LOW — the shape is standard TS; only the spelling is unverified. The *requirement* (producer-pinned `R`) is locked by D-100-10 |
| A4 | For a record that is both disabled and manifest-absent, `already disabled` is the right fetch-skip reason and `{not in manifest}` the right inventory reason | buildBlock Reroute | MEDIUM — affects `mixed-fetch-skipped`, whose catalog prose assumes the two causes are scope-disjoint. **Needs an operator or planner decision.** |
| A5 | The new record key's size is bounded by the plugin manifest and needs no explicit cap | Security Domain | LOW |
| A6 | No hooks-bridge test file currently stands up a `state.json` fixture for `hydrateScopeFromState`, so ENBL-14's test is a genuine Wave 0 gap rather than an extension | Validation Architecture | LOW — worst case the test is cheaper than estimated |

## Open Questions

1. **Where does the ledger get the parsed hook entries at record-composition time?** (A1)
   - What we know: all three ledgers already know `installable.hooksConfigPath` at the point they write `resources.hooks`; `info.ts` proves the parse-and-project pipeline exists (`projectHookSummaryEntries`).
   - What's unclear: whether the *parsed* config survives to the record-composition point, or is discarded inside the hooks bridge's stage step.
   - Recommendation: make this the phase's first task — a read-only spike over `bridges/hooks/stage.ts`'s return shape. It sizes ENBL-10/11 and nothing downstream can be estimated without it.

2. **Disabled + manifest-absent: one skip row or two, and which reason?** (A4)
   - Recommendation: single `skipReason` on `InfoBlock`, `already disabled` wins for the fetch note. Put it to the operator if the planner is not comfortable deciding — the catalog's `mixed-fetch-skipped` prose will need editing either way.

3. **Is `buildDisabledInventoryBlock` deleted or repurposed?**
   - If the fetch-skip carrier becomes an `InfoBlock` field, the block builder and `DisabledScope` are dead code. If instead the planner keeps a thin disabled-scope list purely to feed `emitFetchSkip`, they survive in reduced form. The first is cleaner; the second is a smaller diff.
   - Recommendation: delete. `getPluginInfo`'s cognitive-complexity budget benefits, and the "mixed message kinds" comment at `info.ts:2352-2356` becomes removable rather than half-true.

## Sources

### Primary (HIGH confidence — read this session)

- `extensions/pi-claude-marketplace/persistence/state-io.ts:1-220` — schema, brand, producer, predicate
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:395-427, 540-650` — hydrate walk, routing rebuild, containment guard
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:715, 810-880` — ledger body, conflict guard call
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:230-415, 599-606` — enable/disable branches
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:330-450` — installed row builder, disabled early return
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1205-1230, 1700-1800, 2018-2055` — conflict guard, outcome derivation, clone, removePluginRecord
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1150-1250, 1599-1650, 1700-1745, 1820-1875, 3030-3056` — disabled refresh, write sites, guard, removePluginRecord
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:590-712, 797-813` — collectOwners, conflict guard, partial-cascade fold
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:500-600, 760-1012, 1020-1071, 1995-2379` — hooks reads, buildBlock, state-only row, partition, notify flow
- `extensions/pi-claude-marketplace/shared/notify.ts:470-540, 758-790, 1300-1390, 1576-1625, 2390-2425, 3243-3270, 3371-3413, 3760-3790` — status tuple, disabled message, info row type, glyphs, renderers
- `tests/architecture/compat-01-no-expansion.test.ts:126-435` — all clause line numbers and bodies
- `tests/orchestrators/reconcile/plan.test.ts:695-1065` — the ENBL-05 whole-tree drift gate
- `tests/persistence/state-io.test.ts:472-490, 640-714` — brand and producer tests
- `tests/orchestrators/plugin/enable-disable.test.ts` — resources assertions and test names
- `tests/orchestrators/plugin/update.test.ts:130-170` — the fixture factory CONTEXT misclassifies
- `docs/output-catalog.md` — disabled states, fetch-skip states, INV-04 prose
- `.planning/REQUIREMENTS.md` — ENBL-01..09 and INV-04
- `.planning/config.json` — `nyquist_validation: true`

### Secondary (MEDIUM confidence)

- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` — stack, lint rules, layer boundaries (dated 2026-08-07; consistent with everything read this session)
- `.claude/rules/typescript-comments.md` — comment/test-title policy

### Tertiary (LOW confidence)

- None. No web search was performed; this phase has no external-technology surface.

## Metadata

**Confidence breakdown:**
- Reader inventory: **HIGH** — exhaustive grep over the extension tree plus per-site reads; the two corrections and one addition were each traced to a call site
- Hazard 1 (enable self-conflict): **HIGH** — call chain read end to end, and both sibling precedents read in full
- COMPAT-01 disposition: **HIGH** — every clause enumerated by line and read
- Drift-gate answer: **HIGH** — the walk implementation was read, not inferred
- Test-suite disposition: **HIGH** for the brand + enable-disable files (read directly); **MEDIUM** for the 12 remaining fixture files (classified by `enabled: false` occurrence plus targeted greps, not full reads — the class-(a) verdict is well-supported but individual line-level surprises are possible)
- Record-key plumbing (A1): **LOW** — the one genuinely unverified area; flagged as a spike
- Catalog/fixture inventory: **MEDIUM** — states located by grep and cross-checked against the fixture file; exact fixture line ranges were not read in full

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (30 days — in-repo, stable; invalidated earlier by any merge touching `state-io.ts`, `info.ts`, or `install.ts`)
