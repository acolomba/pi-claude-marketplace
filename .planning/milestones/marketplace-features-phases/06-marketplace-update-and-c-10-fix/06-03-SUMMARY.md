---
phase: 06-marketplace-update-and-c-10-fix
plan: "03"
subsystem: marketplace
tags: [marketplace-update, autoupdate, cascade, cucumber]

requires:
  - phase: 06-marketplace-update-and-c-10-fix
    plan: "02"
    provides: Semantic refresh comparison and fail-clean refresh baselines
provides:
  - Whole-result behavioral coverage for autoupdate off and on, including new-session versions
  - Idempotent no-op autoupdate coverage
  - Catalog membership coverage for newly offered and dropped plugins
  - Ordered cascade continuation after an ordinary per-plugin failure
affects: [marketplace-update, plugin-update, behavioral-tests]

actuals:
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - A per-plugin failure fixture must fail after the scope-wide dependency walk, or D-10-05 holds every target

key-files:
  created: []
  modified:
    - features/lib/published-marketplace.ts
    - features/marketplace/update.feature
    - features/step_definitions/marketplace/update.steps.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Tasks 1-3 needed tests only; the production cascade already met the contract, so update.ts is unchanged."
  - "Task 3 fails zeta with an unreadable file in its refreshed skill instead of an invalid plugin.json, keeping D-10-05 unchanged."
  - "The installed order is state record insertion order, not refreshed catalog order."

patterns-established:
  - "Ordinary cascade failures are staged in the publication root as a file the plugin's own staging cannot copy."

requirements-completed: [UPD-03, UPD-04, UPD-05, UPD-06, UPD-13]

coverage:
  - id: D1
    description: "Autoupdate off keeps installed versions, repeated refreshes included."
    requirement: UPD-03
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate off preserves installed versions"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#autoupdate off never invokes a plugin update"
        status: pass
    human_judgment: false
  - id: D2
    description: "Autoupdate on installs the offered version, visible in a new session, and does not reinstall on repeat."
    requirement: UPD-04
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate exposes the offered version in a new session"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Repeating an autoupdate does not reinstall a plugin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a repeated autoupdate collapses after the first run changes a plugin"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unchanged autoupdate collapses to skipped up-to-date with no plugin rows."
    requirement: UPD-05
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#An unchanged autoupdate is up to date"
        status: pass
    human_judgment: false
  - id: D4
    description: "Newly offered plugins stay uninstalled."
    requirement: UPD-06
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate does not install newly offered plugins"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#autoupdate ignores a newly declared plugin that has no installed record"
        status: pass
    human_judgment: false
  - id: D5
    description: "A plugin dropped from the catalog stays installed and enabled with a skipped not in manifest row."
    requirement: UPD-13
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate keeps a plugin removed from the catalog"
        status: pass
    human_judgment: false
  - id: D6
    description: "The cascade runs in installed order, continues after an ordinary failure, and keeps the marketplace row updated (D-08, D-10)."
    requirement: UPD-04
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Autoupdate continues in installed order after a plugin fails"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#autoupdate continues in installed order after an ordinary plugin failure"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#autoupdate calls each installed plugin in record order"
        status: pass
    human_judgment: false

completed: 2026-10-19
status: complete
---

# Phase 6 Plan 03: Autoupdate Cascade Summary

**Marketplace autoupdate now has real-Pi coverage for installed versions, no-op runs, catalog membership, and ordered continuation after a plugin fails.**

## Accomplishments

- Autoupdate off keeps installed versions across repeated refreshes. Autoupdate on installs the offered version, a new session shows it, and a repeat run does not reinstall.
- An unchanged autoupdate reports the marketplace as up to date with no plugin rows.
- Newly offered plugins stay uninstalled. A plugin dropped from the catalog stays installed and enabled, with a `skipped {not in manifest}` row.
- With zeta installed before alpha and the catalog listing alpha first, zeta fails its own update, alpha still updates, the rows keep installed order, and the marketplace row stays `updated`. zeta keeps 1.0.0 in `list` and in a new session.

## Task Commits

1. **Task 1: Observe installed versions with autoupdate off and on** - `c5b349df` (test)
2. **Task 2: Preserve the installed set across unchanged and changed catalogs** - `ef20d8a0` (test)
3. **Task 3: Continue the ordered cascade after a plugin failure** - `d0566ff6` (test)

**Checkpoint:** `deef4bd1` (docs). **Plan metadata:** this commit (docs).

## Deviations from Plan

### Task 3 failure fixture

The plan said to make zeta's refreshed `plugin.json` invalid, through an `invalidatePublishedPlugin` helper. That cannot produce an ordinary per-plugin failure. Before any target updates, `evaluateUpdateConstraint` asks `buildScopeDeclarationDetail` for the dependencies of every installed plugin in the scope. An unreadable `plugin.json` fails that walk, and D-10-05 then holds every target. Both zeta and alpha came back `skipped {dependents constrain}`, the result was a warning, and alpha did not update.

D-10-05 stays as it is. The scenario instead adds an unreadable `notes.md` (mode `000`) to zeta's refreshed skill through `publishUnreadableSkillFile`. Preflight passes. zeta's swap then fails while staging the skill copy, with `EACCES`, so its row is `failed {permission denied}`. No state or artifact changes for zeta.

A skill-name collision with alpha was tried first and cannot happen: `generatedSkillName` puts the plugin name in every skill name, so the PI-6 cross-plugin guard cannot fire between two different plugins.

The scenario's expected result changed to match the real failure: severity `error`, `needs reload` true (alpha updated), and summary `A plugin operation has failed.`

## Observations

- zeta's failed cascade row has no cause chain. `cascadeAutoupdates` receives a `failed` outcome, not a thrown error, from `updateSinglePluginWith`, and that outcome carries no `cause` unless cleanup failed. The table therefore pins `leaks` and `rollback partial` as empty and has no `cause chain` column. This matches current behavior. It is recorded here, not changed.
- The scenario's chmod fixture assumes a non-root test user. Root ignores mode `000`.

## Concurrency Evidence

- **UPD-03 backstop:** `snapshotAfterRefresh` reads `autoupdate` from config outside the lock, then refreshes the record inside one `withLockedStateTransaction` and saves it. With autoupdate off, `cascadeAutoupdates` returns `[]` before any plugin call. The owner test `autoupdate off never invokes a plugin update` pins this. No whole-command lock is claimed.
- **UPD-04 backstop:** the marketplace transaction returns its snapshot (record plugin names) and releases the lock before `cascadeAutoupdates` runs. Each `pluginUpdate` is awaited one at a time and takes its own scope lock (`retries: 0`). The Task 3 scenario shows a failed member leaves zeta at 1.0.0 while alpha's own transaction completes. No nested-lock deadlock appeared in any run.

## Flagged assumptions from the spec-less probe

- `UPD-05 / unclassified / unresolved`: the no-op cascade scenario is the manual-review target; the probe named no additional edge shape.
- `UPD-06 / unclassified / unresolved`: complete installed and session inventories prove the stated non-installation behavior; the unclassified probe remains flagged.
- `UPD-13 / unclassified / unresolved`: retained install and enablement and the complete warning row prove the stated behavior; no unspecified edge is claimed resolved.

## Checks run

- Task 1 focused Cucumber: 6 scenarios, 110 steps passed.
- Task 2 focused Cucumber: 6 scenarios, 98 steps passed.
- Task 3 focused Cucumber (`^Autoupdate continues in installed order after a plugin fails$`): 2 scenarios, 38 steps passed.
- `node --test tests/orchestrators/marketplace/update.test.ts`: 85 passed.
- `npm run check:features` passed.
- Direct coverage for `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` passed.
- Commit hooks passed for all three task commits.
- Full `npm run check` passed at `d0566ff6` on Node 26.11.1 (exit 0): static checks, unpaired and integration tests, 187 scenarios and 2,048 steps, and 280 direct-coverage records.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All three task commits descend from the plan head `5dd3d034`.
- No production source, package, network behavior, or out-of-scope filesystem target was added. The new fixture writes only under the recorded publication root, through `ownedTarget`.

---

*Phase: 06-marketplace-update-and-c-10-fix*
*Completed: 2026-10-19*
