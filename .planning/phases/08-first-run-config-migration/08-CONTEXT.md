# Phase 8: First-Run Config Migration - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted.

<domain>
## Phase Boundary

Phase 8 covers the first-run config migration (MIG-01) with behavioral scenarios and fixes the gaps they expose in its own files. A scope that has a `state.json` and no `claude-plugins.json` gets a config written once, on its first load, from the installation records, in the user scope and in the project scope. From then on the config belongs to the user: no load rewrites it, and a config that is not valid is reported and never overwritten.

The phase owns `features/plugin/config-migration.feature` (with its two Phase 1 seeds), the verb module `features/step_definitions/plugin/config-migration.steps.ts` (created only if a scenario needs a step that no module has), `persistence/migrate-config.ts`, the invalid-config handling in `persistence/config-io.ts`, the MIG-01 step in `orchestrators/reconcile/read-pass.ts`, and the unit pairs of those files. It adds no product feature beyond the bugs its scenarios expose (Milestone rules, Out of scope).

</domain>

<decisions>
## Implementation Decisions

### What the rebuild declares (CFGMIG-01; D-BG-801 to D-BG-804)

- **D-BG-801 — the rebuild writes the config the user's own commands wrote for these records.** `install` writes `{}`, `disable` writes `{ "enabled": false }`, and `enable` writes `{ "enabled": true }` (`orchestrators/plugin/enable-disable.ts::writeEnabledFlagBack`); D-04 reads an absent `enabled` as enabled. So `buildConfigFromState` writes `{ "enabled": false }` for a record the user disabled and `{}` for every other projected plugin. "The user disabled it" is `isRecordedButDisabled(record)` (the single ENBL-05 predicate from `persistence/state-io.ts`; `test/architecture/disabled-state-classification.test.ts` rejects any local re-derivation such as `!record.enabled` or `.enabled === false`) and no `dependencyDisabled: true` marker. This fixes the Phase 1 gap (P1-DC-34): the deleted-config seed is rewritten to state `enabled` false, the load then reports no results, and `pending` shows nothing to apply. Alternative rejected: write `enabled: true|false` on every entry (it differs from what `install` writes, so a rebuilt config would not match the one the user had).
- **D-BG-802 — a cascade-installed dependency stays out of the rebuilt config unless the user disabled it.** D-04-02 (v1.20) rules that the desired-state config names only the plugins the user asked for; a `provenance: "dependency"` record keeps itself through its record. Today the rebuild declares every record, so a deleted config comes back naming dependencies the user never named, and a later uninstall of the dependent leaves a declaration that plans a reinstall. The rebuild leaves out a `provenance: "dependency"` record, except one the user disabled by name (EDEP-02 makes the user disable the dependent first, then the dependency, and `disable` writes `{ "enabled": false }` for it), which keeps its `{ "enabled": false }` entry. CFGMIG-01's "every recorded plugin" is read as every plugin the user's commands declared; a release before the config files (0.4.3) has no dependency records (its records migrate to `provenance: "explicit"`), so the upgrade path still declares every record. Logged as P8-DC-01.
- **D-BG-803 — a record the dependency check holds down is written `{}`.** A record with the `dependencyDisabled` marker (LOAD-01 / D-06-02) was disabled by the check, not by the user, so the config the user had declared it enabled. Writing `{ "enabled": false }` would make the hold permanent, because neither lift (`classifyDeclaredPlugin`, `buildDependencyDisabledLift`) overturns a config-declared `enabled: false`. The marker is read in `migrate-config.ts` itself through a small local predicate (persistence cannot import `orchestrators/reconcile/plan.ts::isAlreadyDependencyDisabled`), and the `orchestrators/reconcile/README.md` line "Exactly three readers decide anything on it" gains this fourth reader.
- **D-BG-804 — the legacy `autoupdate` field keeps today's projection.** Only an exact `true` or `false` on a release-0.4.3 marketplace record reaches the config (D-13, SPLIT-01); an absent field writes no `autoupdate`. A current-schema record carries no `autoupdate` (it lives in the config since D-13), so a config the user deletes under a current release comes back without it. That is a limit of what `state.json` records, not a gap this phase can fix; logged as P8-DC-03.
- **Every recorded marketplace is declared** in both scopes, as today: an install that adds a marketplace to the scope (D-MF-04) also declares it (`writeAdoptingConfigEntries`), so the records and the declarations agree. A soft-degraded record (`compatibility.installable === false`) is declared like any other, as today.
- **`--local` declarations (FIX-02) keep today's rule.** A marketplace or plugin key that `claude-plugins.local.json` declares stays out of the base config; a scope whose records the local config declares in full gets no base config at all (the `empty-state` arm); and an unreadable local config makes the migration write nothing (`local-invalid`). Scenarios pin all three in the project scope, where `--local` is used.

### Once only, and the user's edits survive (CFGMIG-02; D-BG-805, D-BG-806)

- **D-BG-805 — "first run" stays "the base config is absent".** The guard is the existing `loadConfig` trichotomy in `migrateFirstRunConfig`: a valid or an invalid `claude-plugins.json` stops the migration before any write; only an absent one triggers it. No marker file or state field is added. So a config the user deletes later is rebuilt on the next load (the Phase 1 seed pins this), and a config the user edits is never rewritten.
- **The edit scenario writes the user's own text** with `a config in scope <scope> and layer base, with this text:` after the first load wrote the config, using formatting the extension would not produce (the user's own indentation and a hand edit, such as `"enabled": false` for an installed plugin). A later load reports the pending change the edit asks for and changes nothing, and `the "claude-plugins.json" file of the <scope> scope holds this text:` proves the bytes survive. Red proof: remove the `existing-valid` short-circuit and the step fails.
- **D-BG-806 — `/reload`.** A new session stands in for a later load, as the suite already does ("a new session as Pi's /reload gives it", `features/agent/lifecycle.feature`), because Pi runs the same `resources_discover` load on a session start and on `/reload`. The planner adds one scenario that reloads Pi in the terminal with the existing step `the user reloads pi in the terminal and then prompts {string}` (with `pi runs with the scripted model`), if those existing steps support it without a frozen-file change; otherwise the new session stands in for `/reload` too, and the choice is logged (P8-DC-02 records the decision either way).
- **Research item for the planner:** check whether a load with `autoapply` on (AAP-01) writes `claude-plugins.json` after it exists, for example through an install's config write-back during the apply. If it does, that rewrite is a CFGMIG-02 gap in files this phase does not own (the add and install paths), so it becomes a parent line and a dubious choice, not a direct edit.

### An invalid existing config (CFGMIG-02; D-BG-807)

- **D-BG-807 — what the user sees is today's report.** The load reports the existing `invalid manifest` row for the file (subject `claude-plugins.json` or `claude-plugins.local.json`, scope, severity error, the loader's cause such as `JSON parse failed: ...` or `schema validation failed: ...`), and `pending` reports the same block. No new reason is added (Milestone rules, append-only closed sets: prefer an existing reason). The load changes nothing: the config and `state.json` bytes stay as they were (`the config and installation record bytes of the <scope> scope are remembered` / `are unchanged`, or `holds this text:`), and the installed plugins keep loading from their records (the session still offers their skills).
- **The pinned cause text is identical on every supported Node major.** CI runs Node 24 and this machine runs Node 26. A JSON syntax error's message comes from V8; the planner pins one only after checking that Node 22, 24, and 26 word it the same (for example an empty file's `Unexpected end of JSON input`), and otherwise uses a schema error, whose text comes from typebox (`schema validation failed: /plugins/demo@fixtures/enabled: must be boolean`).
- **Coverage:** an invalid base config at the first load in the user scope (a `state.json` and a broken `claude-plugins.json`: reported, bytes kept, nothing written), and an unreadable local config with no base config in the project scope (FIX-02 `local-invalid`: reported, the local config kept byte for byte, and no `claude-plugins.json` created).

### Scenarios, steps, and tests (D-BG-808)

- **D-BG-808 — scenario plan.** All scenarios live in `features/plugin/config-migration.feature`, carry no implementation tag (no MCP surface; they run once, under `adapter`, D-BG-04), and use existing steps wherever one exists. Planned coverage:
  - user scope: the 0.4.3 upgrade seed (kept); the deleted-config seed, rewritten to the fixed output (`enabled` false, the load reports no results); a deleted config with a cascade-installed dependency (D-BG-802: only the plugin the user named is declared); the user's edit surviving a later load (and `/reload` per D-BG-806); an invalid base config reported and kept.
  - project scope: the 0.4.3 upgrade (`Given the project scope holds what release 0.4.3 left: ...`), with the `autoupdate` the user set, so the project scope's MIG-01 output is pinned; the `--local`-only scope that gets no base config; and the unreadable local config.
  - `pending` after the migrating load shows nothing to apply in each scope: the load printing no results is the observable (the load prints the same block `pending` prints, RECON-05), and at least one scenario per scope runs `/claude:plugin pending` after `the user has started a new pi session` to show `reconcile-pending-empty` literally.
- **Every scenario fails without the behavior it names**, and each plan SUMMARY records the red proof (Milestone rules). Where a scenario covers behavior that already works (FIX-02, the invalid arm, the once-only guard), the red proof breaks that behavior in the product temporarily and restores it.
- **Seeds keep their shared steps in use**: `the {word} scope holds what release 0.4.3 left: its installation record and no config` (`plugin/installation.steps.ts`) and `the user has deleted the config files of the {word} scope` (`config.steps.ts`).
- **The verb module `plugin/config-migration.steps.ts`** is created only for a step no module has, such as deleting only one layer's config; a helper stays private to it. No file under `features/support/` or `features/lib/` changes (frozen).
- **Unit tests:** `test/persistence/migrate-config.test.ts` gains the projection cases of D-BG-801 to D-BG-803 (user-disabled explicit, dependency-check hold, enabled dependency left out, user-disabled dependency kept), and every touched source file keeps 100% direct coverage.

### Claude's Discretion

- The split into plans and waves, the exact scenario titles and tables, and which existing steps each scenario uses.
- Whether the `/reload` scenario of D-BG-806 is feasible with the existing steps.
- The form of the local predicate that reads the `dependencyDisabled` marker in `migrate-config.ts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `persistence/migrate-config.ts`: `buildConfigFromState(state, local)` (pure projection; today every plugin entry is `{}`) and `migrateFirstRunConfig(loc, state)` (the ENOENT-gated orchestrator with the `existing-valid` / `existing-invalid` / `empty-state` / `local-invalid` arms).
- `persistence/config-io.ts`: `loadConfig` (absent / invalid / valid; never throws), `saveConfig` (schema check, containment, atomic write), `isDeclaredEnabled`.
- `persistence/state-io.ts`: `isRecordedButDisabled` (the sole disabled predicate, ENBL-05), the record schema with `provenance` and the optional `dependencyDisabled` marker.
- `orchestrators/reconcile/read-pass.ts::readScopeLocked`: step (1) runs MIG-01 inside the scope lock and wraps a save failure in `MigrateConfigSaveError`; step (3) turns an invalid base or local config into an `invalid-block` row with reason `invalid manifest`.
- Steps that already exist: `the {word} scope holds what release 0.4.3 left: its installation record and no config`; `the user has deleted the config files of the {word} scope`; `a config in scope {word} and layer {word}, with this text:` / `with these plugins:` / `with these marketplaces:`; `the {string} file of the {word} scope declares these marketplaces:` / `declares these plugins:` / `holds this text:` / `does not exist` / `declares no plugins`; `the config and installation record bytes of the {word} scope are remembered` / `are unchanged`; `the user has started a new pi session`; `the user starts a new pi session`; `the session reports no results` / `reports these results:`; `the results list these marketplaces and plugins:`; `the session offers these skills:`; `the user runs {string}` with `the result has these fields:`; the dependency publishing step `the marketplace {string} offers these plugins with dependencies:`.
- `features/lib/earlier-version-state.ts`: the 0.4.3 rewrite copies each marketplace's `autoupdate` from the scope's base config onto its record, then deletes the configs.

### Established Patterns

- Config write-back: `install` writes `{}`, `disable` `{ "enabled": false }`, `enable` `{ "enabled": true }`; a cascade-installed dependency is never declared (D-04-02); `enable` of a dependent overwrites a member's `enabled: false` entry to `true` (CR-06).
- The load is read-only (APL-D1, RECON-05): it prints the pending block on a mismatch and nothing on a match. Each session reports its payloads twice in the cucumber harness (see the existing load scenarios' doubled rows).
- An invalid config is never coerced to an empty desired state (CFG-03); the plan is not built for that scope.
- `migrate-config.ts`'s result is informational; the load is silent about a successful migration (NFR-2).

### Integration Points

- `orchestrators/reconcile/read-pass.ts` step (1) is the only caller of `migrateFirstRunConfig` (shared load path, Phases 7, 8, 9, 16: edit only the MIG-01 step, never reorder).
- `persistence/state-io.ts::loadState` opens the D-13 `autoupdate` scrub gate on the base config's existence (Phase 7 owns the load functions there; this phase does not edit them).
- The `orchestrators/reconcile/README.md` reader list of `dependencyDisabled` (D-BG-803).

</code_context>

<specifics>
## Specific Ideas

- The rewritten deleted-config seed's title states the fixed behavior ("... writes it with a disabled plugin's enabled state"), and its plugin table gains the `enabled` column with `false`.
- A rebuilt config for an enabled plugin stays `{}`, so the first seed's plugin table keeps only its `id` column.

</specifics>

<deferred>
## Deferred Ideas

- Recovering a marketplace's `autoupdate` after a current-release user deletes the config: `state.json` no longer records it (D-13). Out of scope (P8-DC-03).
- A load with `autoapply` on that rewrites the config, if research finds one: a parent line for the owning phase or the parent (D-BG-806 research item).

</deferred>
