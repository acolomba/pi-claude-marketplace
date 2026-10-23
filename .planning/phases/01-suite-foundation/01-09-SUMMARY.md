---
phase: 01-suite-foundation
plan: 09
subsystem: testing
tags: [cucumber, layer-config, claude-code-settings, pending, import, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "01-02: session payload steps; 01-06: `the user has run` accepts any number of info payloads; 01-07: `{project dir}` and `{agent dir}` run tokens (`RunTokens.projectDir`); 01-08: `requireColumns` exported from path-marketplace.ts"
provides:
  - "features/lib/layer-config.ts: `LayerMarketplace`, `readLayerMarketplaces(table)`, `writeLayerMarketplaces(filePath, marketplaces)`; the plugins and marketplaces writers share one private read-modify-write"
  - "Step `Given a config in scope {word} and layer {word}, with these marketplaces:` (`| name | source | autoupdate |`)"
  - "features/step_definitions/claude-code-settings.steps.ts: step `Given the claude code settings file of the {word} scope holds this text:`"
  - "Seeds in features/plugin/pending.feature (owned by Phase 11 afterwards): base-config and local-config hand edits, and the reconcile-pending-empty result"
  - "Seeds in features/plugin/import.feature (owned by Phase 13 afterwards): import from the user's and from the project's settings file"
  - "The config rule of the cucumber skill names three writers"
affects: [phase-11-pending-reconcile, phase-13-import, 01-10]

actuals:
  tokens: 5390
  tasks: 2
  commits: 2

plan_head_before: 052351a8b448bbb262f83eedb9902bf05c49643a
plan_head_after: e033f850019b46569ef289461821a4cb9ebd711f

tech-stack:
  added: []
  patterns:
    - "A layer-config writer replaces one member and keeps the others through one shared private writer (`writeLayerMember`)"
    - "A step that writes a file a user owns builds its path only from the sandbox tokens, writes with flag wx, registers a release, and reads the file back"

key-files:
  created:
    - features/step_definitions/claude-code-settings.steps.ts
    - features/plugin/pending.feature
    - features/plugin/import.feature
  modified:
    - features/lib/layer-config.ts
    - features/step_definitions/config.steps.ts
    - .agents/skills/cucumber/rules/steps.md

key-decisions:
  - "The marketplaces step expands the run tokens in each source; the table keeps `{home}/marketplaces/<name>`"
  - "The settings step module is named after the file a Claude Code user keeps (`claude-code-settings`), not after the import verb, so Phase 13 and later phases share it"
  - "readLayerPlugins and readLayerMarketplaces reuse `requireColumns` from path-marketplace.ts and one `readFlag` cell reader, so fallow finds no clone"

patterns-established:
  - "Pending seeds state the tally fields (`Reconcile pending`, success count) and every plugin row column"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A scenario can hand-edit the marketplaces of a scope's base or local config; one pending seed per layer reads them from that layer's file"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists the install that a marketplace and a plugin declared by hand in the base config would cause"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists the install that a marketplace and a plugin declared by hand in the local config would cause"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending reports reconcile-pending-empty when the configs and the records agree"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending reports nothing when the configs and the records agree"
        status: pass
    human_judgment: false
  - id: D3
    description: "A scenario can write a Claude Code settings file in the sandbox for either scope; one import seed per scope reads it from that scope's path"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/import.feature#Importing the user's claude code settings adds their marketplace and installs their enabled plugin"
        status: pass
      - kind: e2e
        ref: "features/plugin/import.feature#Importing the project's claude code settings adds their marketplace and installs their enabled plugin in the project scope"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step is used, and the suite and the feature gate pass"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (457 scenarios passed)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 09: Hand-edited marketplaces and Claude Code settings Summary

**A marketplaces writer for a scope's base and local configs, and a sandbox-only Claude Code settings step, each seeded per form: pending in each layer and its empty result, and import from the user's and the project's settings file**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-23T04:10:26Z
- **Completed:** 2026-10-23T04:22:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `writeLayerMarketplaces` replaces the `marketplaces` member of one layer config and keeps every other member. It shares one private writer with `writeLayerPlugins`. Its step expands the run tokens in each source and reads the config back.
- The settings step writes `{home}/.claude/settings.json` for the user scope or `{project dir}/.claude/settings.json` for the project scope. The path comes only from `this.tokens`. The write uses flag `wx`, and a release removes the file.
- Five seeds. Each layer form of the config writer and each scope form of the settings writer has its own seed, and the planted checks show that a wrong file fails that seed. The empty pending result is seeded too.

## Final step texts

- `Given a config in scope {word} and layer {word}, with these marketplaces:` with the table `| name | source | autoupdate |`. `autoupdate` is `true`, `false`, or empty.
- `Given the claude code settings file of the {word} scope holds this text:` with a doc string. `{word}` is `user` or `project`.

## Seeds (values from the actual runs)

- `pending.feature` "Pending lists the install that a marketplace and a plugin declared by hand in the base config would cause": `cascade`, severity `info`, needs reload `false`, tally `Reconcile pending` 0/0, success count 1. Row: `fixtures` `project`, `demo@fixtures` `will install`, no reasons. There is no marketplace row, because adding a marketplace is immediate (WILL-01).
- The same seed for the local config gives the same result, measured in its own run.
- "Pending reports nothing when the configs and the records agree": `reconcile-pending-empty`, severity `info`, needs reload `false`.
- `import.feature`, user scope: `cascade`, severity `info`, needs reload `true`, tally `Import` 0/0, success count 2. Row: marketplace `fixtures` `user` `added`, `demo@fixtures` `installed`, no reasons, scope `user`, and no `version` field. A new session then offers `/skill:demo-skill`.
- `import.feature`, project scope: the same result with scope `project`.

## Planted checks (each planted by hand, run, and reverted)

1. **Task 1 (a): the source keeps `{home}` unexpanded.** The plant replaced the expanded HOME with `{home}` before the write. The base seed **passed** (1 scenario, 9 steps passed). `pending` never reads the source of a marketplace it would add: it is read-only and network-free (DIFF-01, NFR-5), and it shows no row for the add. To prove that something does read the source, an uncommitted probe ran the same Givens followed by `When the user starts a new pi session`. With the plant, `Then the session offers these skills:` failed with no skills offered. Without the plant, every step passed. The only remaining failure was the expected uncompared `reconcile-applied-cascade marketplaces` rows of the probe. The probe was then deleted. This is a deviation, recorded below and in WINDOWS #110.
2. **Task 1 (b): the marketplaces step swaps the layer files** (`base` writes `claude-plugins.local.json`, `local` writes `claude-plugins.json`; the plugins step was unchanged). Both layer seeds failed: 2 scenarios failed, 14 steps passed, 2 failed, 2 skipped. `the result has these fields:` got severity `error`, summary `A plugin operation has failed.`, and tally failures `1`. This is the LAYER-06 failure that `findLayerMarketplaceGaps` reports. The field step failed first, so the row step never ran.
3. **Task 2 (a): the user settings are written to `{home}/settings.json`.** The user seed failed and the project seed passed. Import found nothing: needs reload `false` and no tally fields.
4. **Task 2 (b): the project settings are written to the user path `{home}/.claude/settings.json`.** The project seed failed and the user seed passed, again with needs reload `false` and no tally. `import --scope project` reads only `{project dir}/.claude/`.

## Task Commits

1. **Task 1: Hand-edit the marketplaces of a config** - `a9064124` (test). Hook: `npm run check:commit` passed and gitlint passed on the first attempt.
2. **Task 2: Write Claude Code settings in the sandbox** - `e033f850` (test). Hook: `npm run check:commit` passed and gitlint passed on the first attempt.

The tracer gate after Task 1 ran its verify again (8 scenarios, 81 steps passed, and `check:features` exit 0), then continued to Task 2.

## Files Created/Modified

- `features/lib/layer-config.ts` - `LayerMarketplace`, `readLayerMarketplaces`, `writeLayerMarketplaces`, and the private `writeLayerMember` and `readFlag`
- `features/step_definitions/config.steps.ts` - the marketplaces step, and a shared `assertDeclared` read-back for both member writers
- `features/step_definitions/claude-code-settings.steps.ts` - the settings file step
- `features/plugin/pending.feature` - three seeds (new feature, owned by Phase 11 afterwards)
- `features/plugin/import.feature` - two seeds (new feature, owned by Phase 13 afterwards)
- `.agents/skills/cucumber/rules/steps.md` - the config rule names three writers

## Decisions Made

- The step expands the tokens of each source, not the table reader. `readLayerMarketplaces` keeps the source as written, so the reader stays a pure table parser.
- The import seeds also start a new session and check that it offers `/skill:demo-skill`. That second `When` follows the plan. The session had no payloads, so it had no rows to compare.

## Deviations from Plan

### Protection gap (not auto-fixed)

**1. [Planted check] An unexpanded token in a marketplace source fails no committed seed**
- **Found during:** Task 1, planted check (a)
- **Issue:** The plan expected the base pending seed to fail when the step leaves `{home}` in a source. `pending` never reads that source (DIFF-01, NFR-5). It reports `will install` whatever the source names. No pending seed can show the mistake.
- **Action:** Proved with an uncommitted new-session probe that a scenario which reads the source does catch the plant. The project bans committed negative controls, so the probe was deleted. Recorded the gap as WINDOWS #110 (`deviation`, `[lifecycle-coverage]`). Phase 11 can close it with a reconcile seed whose new session adds a marketplace that only this writer declared. `pending.feature` and `reconcile.feature` belong to that phase.
- **Files modified:** `.planning/WINDOWS.md` (via `gsd-tools windows append`)

---

**Total deviations:** 1 (a protection gap carried to Phase 11; nothing auto-fixed)
**Impact on plan:** The layer forms (planted check b) and the scope forms (Task 2 a and b) fail their seeds as planned. Only the token expansion of the marketplaces writer has no committed seed yet.

## Bug candidates (not fixed; none blocks a seed)

- **Phase 13 (import):** the `installed` rows of `import` carry no `version` field, but `install` reports `version 1.0.0` for the same plugin. The seeds state the rows as observed, without a version column.
- **Phase 11 (pending):** `pending` lists `will install` for a plugin whose hand-declared marketplace source does not exist. It never reads the source, so the next session would fail. Pending is read-only by design (DIFF-01), so this may be intended. Phase 11 decides.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx cucumber-js features/plugin/pending.feature features/plugin/import.feature features/plugin/configuration.feature`: every scenario passed (5 in pending and import, plus 6 in configuration).
- `npm run check:features`: exit 0.
- `npm run test:cucumber`: 457 scenarios and 4322 steps passed.
- Acceptance greps: every count matches the plan, and `homedir` appears 0 times in the settings step module.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 01-10. Phase 11 owns `pending.feature` and Phase 13 owns `import.feature`, and each phase extends its own file. WINDOWS #110 waits for a Phase 11 reconcile seed.

## Self-Check: PASSED

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
