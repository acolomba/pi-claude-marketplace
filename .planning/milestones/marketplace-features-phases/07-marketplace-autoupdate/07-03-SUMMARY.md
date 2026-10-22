---
phase: 07-marketplace-autoupdate
plan: "03"
subsystem: testing
tags: [cucumber, marketplace, autoupdate, config-layers, docs, changelog]

requires:
  - phase: 07-marketplace-autoupdate
    provides: 07-02's inheritance fix (fc43090a), whose parent a3c37198 is the planted pre-fix autoupdate.ts
provides:
  - "writeLayerText in features/lib/layer-config.ts and the second config-writing step `a config in scope <scope> and layer <layer>, with this text:` (D-09)"
  - "The raw-text read step `the <file> file of the <scope> scope holds this text:`"
  - "The D-05 scenario: a --local flip that needs the inherited value fails closed over a broken base config and changes neither config"
  - "07-03-RED.json: the D-05 scenario failing against the planted pre-fix autoupdate.ts"
  - "Docs (output catalog, both READMEs) and the CHANGELOG bullet state the inherited-value rule, the fail-closed base read, and the scopeless miss"
affects: [07-04, output-catalog, readme, changelog, cucumber-skill]

actuals:
  tokens: 8600
  tasks: 2
  commits: 2
plan_head_before: 59767db07070979d5e705e3218b8d65bfe9edae7
plan_head_after: bd1f44e69c6490c0d4653a734e26660f6fbdd33d

tech-stack:
  added: []
  patterns:
    - "A raw-text config writer that never parses, so a scenario can plant a broken layer config; a raw-text read step that shows the broken file stayed byte for byte"

key-files:
  created:
    - .planning/phases/07-marketplace-autoupdate/07-03-RED.json
  modified:
    - features/lib/layer-config.ts
    - features/step_definitions/config.steps.ts
    - .agents/skills/cucumber/rules/steps.md
    - features/marketplace/autoupdate.feature
    - docs/output-catalog.md
    - README.md
    - README.es.md
    - CHANGELOG.md

key-decisions:
  - "D-09 allows two layer-config writers: the plugins-member writer and the whole-text writer; a raw-text READ step is an ordinary read step, not a third writer."
  - "Docs and CHANGELOG say a nameless flip writes a local entry only when the value that applies to it still differs (not 'its own value'), because an enable also writes a local-only entry without a value, which inherits off."

patterns-established:
  - "Plant-and-restore RED for a fix that already landed: git show <fix>^:<file> > <file>, run the one scenario with a JUnit report, git checkout -- <file>, and git diff --quiet -- extensions/ before any commit."

requirements-completed: [AU-04, AU-06, AU-08]

coverage:
  - id: D1
    description: "A --local noautoupdate of a local entry without a value fails as invalid manifest over a malformed base config; the local config keeps tools without autoupdate and the base config keeps its text byte for byte"
    requirement: AU-04
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Disabling autoupdate with --local fails as invalid manifest when the base config cannot be read"
        status: pass
    human_judgment: false
  - id: D2
    description: "The whole-text config writer step and the raw-text read step, used by the D-05 scenario, with no unused step"
    verification:
      - kind: e2e
        ref: "npm run check:features"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (222 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Output catalog, README.md, README.es.md, and the CHANGELOG bullet state the inherited-value rule, the fail-closed base read, and the scopeless miss"
    requirement: AU-06
    verification:
      - kind: other
        ref: "node --test tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files docs/output-catalog.md README.md README.es.md CHANGELOG.md"
        status: pass
    human_judgment: true
    rationale: "Whether the prose reads clearly and states the rule faithfully is a reading judgment; the checks only prove format and that no catalog block changed."

duration: 7min
completed: 2026-10-20
status: complete
---

# Phase 7 Plan 03: Fail-closed --local flip over a broken base, and the docs Summary

**A second config-writing step (`writeLayerText`) now lets a scenario hand-break the base config, and a real Pi run shows `noautoupdate tools --scope project --local` over a valueless local entry failing as `{invalid manifest}` with both configs unchanged; it failed against the planted pre-fix `autoupdate.ts`. The output catalog, both READMEs, and the CHANGELOG bullet now state the inherited-value rule, the fail-closed base read, and the scopeless miss.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-20T04:23:15Z
- **Completed:** 2026-10-20T04:30:02Z
- **Tasks:** 2
- **Files modified:** 8, plus the new 07-03-RED.json

## Accomplishments

- D-09: `writeLayerText(filePath, text)` creates the scope directory and writes `text` as the whole layer config, with no parse and no added newline. The step `a config in scope {word} and layer {word}, with this text:` writes a doc string through it and asserts the file holds exactly that text. The step `the {string} file of the {word} scope holds this text:` fails on a missing file and on any byte of difference. Both resolve paths only through `layerConfigPath` / `configFilePath` under `world.scopeRoot`.
- steps.md and the fileoverviews of `config.steps.ts` and `layer-config.ts` name both writers; the old "only config step that writes" and "one setup step" wording is gone.
- D-05: the scenario `Disabling autoupdate with --local fails as invalid manifest when the base config cannot be read` passes through a real Pi: one cascade, severity `error`, summary `Some operations have failed.`, one failed `tools` row with `invalid manifest` and the cause `Config file "claude-plugins.json" failed schema validation.`. The local config still declares `tools` without `autoupdate`, and the base config still holds `{ "schemaVersion": 1,`. The real run matched the planned table in every column on the first run.
- D-06 docs: the output catalog's Config files paragraph, README.md, README.es.md, and the CHANGELOG `[Unreleased]` marketplace-layer bullet now state the inherited value, the write-only-on-change rule, the fail-closed base read, and the scopeless miss. The CHANGELOG keeps 10 top-level bullets.

## Task Commits

1. **Task 1: fail a --local flip over a hand-broken base config (D-05, D-09)** - `914d3c45` (test)
2. **Task 2: correct the docs and amend the CHANGELOG bullet** - `bd1f44e6` (docs)

## RED evidence (D-06)

- Planted `git show a3c37198:extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (the parent of the inheritance fix `fc43090a`), ran `npm run --silent test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^Disabling autoupdate with --local fails as invalid manifest when the base config cannot be read$' --format summary --format junit:<scratch>/07-03-red.xml`.
- Exit 1; `1 scenario (1 failed)`, `11 steps (7 passed, 3 skipped, 1 failed)`. The failing step is `the result has these fields:`: severity `info` instead of `error`, and no summary row. Every Given passed (Pi start, both adds, the base-config break). The pre-fix layer check reports an unreadable base only when the local config does not declare the marketplace, so the flip judged the local entry by its own value and wrote the local `false`.
- `gsd-tools check tdd-red-evidence` on 07-03-RED.json: `RED_EVIDENCE_OK target_test_failed`.
- Restored with `git checkout --`; `git status --short` on the file printed nothing and `git diff --quiet -- extensions/` passed before both commits. Neither commit touches `extensions/`.

## D-09 gate search

`grep -rln 'only config step\|one setup step' scripts/ tests/architecture/ eslint.config.js .fallowrc.json` printed nothing (exit 1), and `grep -rln 'writeLayerPlugins\|layer-config\|with these plugins' scripts/ tests/architecture/ eslint.config.js .fallowrc.json features/support` printed nothing. No automated gate enforces the writer rule, so no gate changed.

## Verification

Node v26.11.1, scope project (hermetic cucumber sandbox).

| Command | Result |
| ------- | ------ |
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^Disabling autoupdate ... cannot be read$'` | exit 0, `1 scenario (1 passed)`, 11 steps passed |
| `npm run check:features` | exit 0 |
| `npm run test:cucumber` | exit 0, `222 scenarios (222 passed)`, `2386 steps (2386 passed)` |
| `SKIP=npm-check pre-commit run --files` (task 1 files, then the four Markdown files) | exit 0, no hook failed or rewrote a file |
| `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | 4 tests, 4 pass, 0 fail |
| commit hook `npm run check:commit` on `914d3c45` and `bd1f44e6` | Passed both times, without `--no-verify` |

Task 1 acceptance: `writeLayerText` export 1; `with this text:` 1 and `holds this text:` 1 in config.steps.ts; steps.md `with this text:` 1 and `It is the only config step that writes` 0; `one setup step that writes` under features/ none; `One setup step writes` 0. Task 2 acceptance: the old README/CHANGELOG/Spanish/catalog phrases all 0; `invalid manifest` 2 in each README; 10 top-level `[Unreleased]` bullets; the changed and added sub-bullets have 32, 33, and 24 words.

The combined-tree `npm run check` belongs to 07-04.

## Files Created/Modified

- `features/lib/layer-config.ts` - `writeLayerText`; the fileoverview names both writers
- `features/step_definitions/config.steps.ts` - the whole-text writer step and the raw-text read step; the fileoverview names both writers
- `.agents/skills/cucumber/rules/steps.md` - the config-writer rule allows two writers
- `features/marketplace/autoupdate.feature` - the D-05 scenario
- `docs/output-catalog.md` - Config files paragraph
- `README.md`, `README.es.md` - the nameless-flip bullet and the `--local` sentences
- `CHANGELOG.md` - the marketplace-layer bullet: one rewritten and two new sub-bullets
- `.planning/phases/07-marketplace-autoupdate/07-03-RED.json` - the RED record

## Decisions Made

- A step that only reads a config's raw text is an ordinary read step, as the plan's context says; D-09 limits only the writers.
- The plan's doc wording "in a local entry only when its own value differs" became "only when the value that applies to it still differs" (README) and "only when its setting still differs" (CHANGELOG). An enable without a name also writes a local-only entry that has no value, because it inherits off; "its own value" would describe that case wrong.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc wording for the nameless flip**
- **Found during:** Task 2
- **Issue:** The planned phrase "a local entry only when its own value differs" is wrong for a local-only entry without a value, which an enable writes (07-02 SUMMARY, D-04).
- **Fix:** Worded it as the value that applies (README, catalog) or its setting (CHANGELOG).
- **Files modified:** README.md, README.es.md, docs/output-catalog.md, CHANGELOG.md
- **Commit:** bd1f44e6

**2. [Rule 2 - Prose rule] Two sentences instead of one**
- **Found during:** Task 2
- **Issue:** The plan asked for one added README sentence and one CHANGELOG sentence about the `--local` rule. Each ran to about 30 words, above the 25-word limit of simple-english and changelog/entries.md.
- **Fix:** Split each into two short sentences. The `invalid manifest` count is still 2 in each README.
- **Commit:** bd1f44e6

**Total deviations:** 2 auto-fixed (1 accuracy, 1 prose rule). **Impact:** wording only; every acceptance criterion holds.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 07-04 (the phase gate, `npm run check` on the combined tree).

## Self-Check: PASSED
