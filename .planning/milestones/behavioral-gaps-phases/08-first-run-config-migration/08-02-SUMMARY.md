---
phase: 08-first-run-config-migration
plan: 02
subsystem: testing
tags: [config-migration, cucumber, reload, invalid-config, fix-02]
status: complete

requires:
  - phase: 08-first-run-config-migration
    provides: "08-01: the fixed rebuild and the nine CFGMIG-01 scenarios"
provides:
  - "Four CFGMIG-02 scenarios: a later load and a terminal reload keep the user's edit byte for byte; an invalid base config and an unreadable local config are reported and kept"
  - "The phase's Parent lines"
affects: [parent merge, layout.md seeds, PROJECT.md Key Decisions, BACKLOG]

actuals:
  tokens: 2900
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - features/plugin/config-migration.feature

key-decisions:
  - "D-BG-805: first run stays 'the base config is absent'; the existing-valid and existing-invalid short-circuits are the once-only guard"
  - "D-BG-806: one terminal /reload scenario with the existing steps; a new session stands in for other later loads"
  - "D-BG-807: an invalid config is reported with the existing invalid manifest row; no new reason"

patterns-established: []

requirements-completed: [CFGMIG-02]

coverage:
  - id: D1
    description: "No later load or terminal reload rewrites the user's config; an invalid base or local config is reported and kept"
    requirement: CFGMIG-02
    verification:
      - kind: e2e
        ref: "npx cucumber-js features/plugin/config-migration.feature (13 scenarios, 13 passed)"
        status: pass
---

# Phase 8 Plan 02: The config belongs to the user Summary

**Four scenarios pin that no later load, and no `/reload` in the terminal, rewrites the config the first load wrote, and that an invalid base or local config is reported with today's row and kept byte for byte while the installed plugin keeps loading.**

Executed inline in the phase session (P8-DC-21). No product file changed.

## Task Commits

1. **Task 1: S-U6, a later load keeps the user's edit** - `109f0097` (test) - hook `npm run check:commit` Passed
2. **Task 2: S-U7, a terminal reload keeps the user's edit** - `0c7f938a` (test) - hook Passed
3. **Task 3: S-U8 and S-P4, invalid base and local configs** - `8bd67a4c` (test) - hook Passed

Every commit touched only `features/plugin/config-migration.feature`.

## Checks run

- `npx cucumber-js features/plugin/config-migration.feature`: `13 scenarios (13 passed)`, `178 steps (178 passed)`.
- `npm run check:features`: exit 0 after each task.
- All measured outputs matched the plan's Scenario reference.

## Red proofs

Each break was applied to `extensions/pi-claude-marketplace/persistence/migrate-config.ts`, the scenarios run, the committed copy restored, and `git diff --exit-code` on the file exited 0 after every restore. Logs are under `/tmp/claude-1000/bg-phase-8/`.

| Scenario | Break | Failing step | Other failures |
| --- | --- | --- | --- |
| S-U6 a later load keeps the edit | `existing-valid` short-circuit disabled | `Then the session reports these results:` | both 0.4.3 scenarios at their marketplaces tables (the session's second load rebuilt the config after the D-13 scrub) (`u6-red.log`) |
| S-U7 a terminal reload keeps the edit | `existing-valid` short-circuit disabled, S-U7 only (`--name`) | `Then the config and installation record bytes of the user scope are unchanged` | - (`u7-red.log`) |
| S-U8 invalid base config kept | `existing-invalid` arm falls through | `Then the session reports these results:` | - (`u8-red.log`) |
| S-P4 unreadable local config, no base config written | `local-invalid` arm falls through | `Then the "claude-plugins.json" file of the project scope does not exist` | - (`p4-red.log`) |

Limit of the S-U7 proof (P8-DC-02): the terminal Pi's start also runs the load, so the red run shows that a terminal start plus `/reload` would rewrite the config; it cannot single out `/reload` alone. Pi 1.5.0's `reload()` runs the same `resources_discover` load as a session start (research Q4).

## Real-home check

`find /home/acolomba/.pi/agent -newer /tmp/claude-1000/bg-phase-8/home-marker-08-02` listed nothing.

## Unowned feature files changed

None.

## Parent lines

The parent applies these at the merge. Each was checked against the tree.

1. **Frozen `.agents/skills/cucumber/rules/layout.md`, line 206 (Seeds, Phase 8):** rename the second seed to "The first load after the user deleted the config writes it with a disabled plugin's enabled state", and drop the sentence "The second seed pins a product gap that Phase 8 fixes (CFGMIG-01)." Phase 8 fixed that gap (CFGMIG-01, P1-DC-34).
2. **Frozen `test/architecture/gate-targets.ts`, optional:** `persistence/migrate-config.ts` now calls `isRecordedButDisabled`. Registering it in `DISABLED_STATE_TARGETS`, with the `DECLARED_MODULE_ORDER` of `test/architecture/disabled-state-classification.test.ts`, is optional; no gate requires it (P8-DC-07).
3. **`CHANGELOG.md`, draft line:** "A config that a load writes from the installation records, after an upgrade from a release with no config or after you delete it, now keeps a plugin you disabled disabled and no longer declares plugins that were installed only as dependencies."
4. **`README.md` and `README.es.md`:** none. `grep -n -i 'first load\|rebuil\|upgrad' README.md README.es.md` printed no line.
5. **`.planning/PROJECT.md` Key Decisions, one row each (behavioral-gaps, Phase 8, settled with the recommended answer, pending user review):**
   - D-BG-801: the MIG-01 rebuild writes the config the user's own commands wrote: `{ "enabled": false }` for a record the user disabled, `{}` for every other projected plugin. Rationale: `install` writes `{}` and `disable` writes `{ "enabled": false }`; writing `{}` for a disabled plugin made the next load plan "will enable".
   - D-BG-802: a `provenance: "dependency"` record stays out of the rebuilt config unless the user disabled it by name. Rationale: D-04-02 (the config names only what the user asked for); a declared dependency is reinstalled after its dependent's uninstall.
   - D-BG-803: a record the dependency check holds down (`dependencyDisabled`) is rebuilt as `{}`. Rationale: no lift overturns a declared `enabled: false`, so writing it would make the hold permanent.
   - D-BG-804: the legacy `autoupdate` projection is unchanged (only exact booleans of a 0.4.3 record). Rationale: a current-schema record carries no `autoupdate` (D-13), so a deleted config cannot get it back.
   - D-BG-805: "first run" stays "the base config is absent"; a valid or invalid `claude-plugins.json` stops the migration; no marker. Rationale: the existing `loadConfig` trichotomy already guards it.
   - D-BG-806: a new session stands in for later loads, plus one terminal `/reload` scenario with existing steps. Rationale: Pi runs the same load on a session start and on `/reload`.
   - D-BG-807: an invalid config is reported with the existing `invalid manifest` row and kept byte for byte; no new reason. Rationale: append-only closed sets prefer an existing reason; CFG-03 never coerces an invalid config.
   - D-BG-808: all scenarios in `features/plugin/config-migration.feature`, untagged, existing steps only, each with a red proof. Rationale: D-BG-04 and the milestone's behavioral-test rule.
6. **`.planning/BACKLOG.md`:**
   - (a) `shared/redact-absolute-paths.ts` reads a JSON pointer with more than one segment in a schema-error cause, such as `/plugins/demo@fixtures/enabled`, as an absolute path and cuts it to `demo@fixtures/enabled` (P8-DC-05; owner: the shared redaction and the invalid-config step of the read pass).
   - (b) With autoapply on, a load stamps `enabled: false` into `claude-plugins.json` for a declared `defaultEnabled: false` plugin and writes the file again in its own format. It is the one load-time config write once the file exists (D-102-02, DFEN-04, P8-DC-08; owner: the install path).
7. **Parent line candidates from 08-01:** none.

## Deviations from Plan

- Executed inline instead of in a subagent (P8-DC-21). No content deviation.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- S-U7's red proof cannot tell the terminal start's load from the `/reload` load (planned, P8-DC-02).
