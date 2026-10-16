---
phase: 03-marketplace-add
plan: 01
subsystem: testing
tags: [cucumber, marketplace-add, fixtures, gherkin]
status: complete

requires:
  - phase: 01-suite-foundation
    provides: the headless Pi driver, the world, the publishing steps, the kind-dispatched fixture library, and the feature gate
provides:
  - The add verb module features/step_definitions/marketplace/add.steps.ts (three add-only Given steps)
  - writeMalformedManifest and a single manifestText builder in features/lib/path-marketplace.ts
  - ManifestProblem and a problem-aware invalidateManifest in features/lib/published-marketplace.ts
  - The ADD-06 source-missing Outline and the ADD-07 invalid-manifest Outline in features/marketplace/add.feature
affects: [03-02, 03-03, url source kind, marketplace info]

actuals:
  tokens: 4359
  tasks: 2
  commits: 2
plan_head_before: 7aa48c90b9e828fa958743bddbf424d362712336
plan_head_after: 8be82946479423556ec3e59a1caea891ef3546f6

tech-stack:
  added: []
  patterns:
    - "A fixture problem is a closed string union mapped to writers by a total Readonly<Record<...>>, so the kind switch stays single"
    - "A step variant chosen by an Examples column is a literal step text per value, so a typo in an excluded row is an undefined step"

key-files:
  created:
    - features/step_definitions/marketplace/add.steps.ts
  modified:
    - features/lib/path-marketplace.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/add.feature

key-decisions:
  - "invalidateManifest takes a ManifestProblem and picks the writer from a total record, not a second kind switch, so no fallow clone group appears"
  - "The malformed manifest is the valid no-plugin manifest minus its last character (56 bytes, against 57 valid and 61 schema-invalid), so the manifest cache never serves another content's parse"
  - "The empty-directory step proves its precondition with assert.rejects(stat(manifest), { code: ENOENT })"

requirements-completed: [ADD-06, ADD-07]

coverage:
  - deliverable: "ADD-07: a malformed or schema-invalid manifest fails add as invalid manifest, named by the typed source"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest'"
        status: pass
      - kind: command
        ref: "CI=1 npm run check:features"
        status: pass
  - deliverable: "ADD-06: a path with no manifest fails add as source missing, named as typed"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx cucumber-js --parallel 1 --name 'Adding a path that holds no marketplace manifest fails as source missing, named as typed'"
        status: pass
      - kind: command
        ref: "npm run test:cucumber"
        status: pass
  - deliverable: "Three manifest contents at one path have three sizes"
    human_judgment: false
    verification:
      - kind: command
        ref: "node size probe from the plan (prints 57 61 56)"
        status: pass

duration: 7 min
completed: 2026-10-16
---

# Phase 3 Plan 01: Invalid-manifest and missing-source add failures Summary

**Two `marketplace add` failure Outlines, one for a broken manifest (`invalid manifest`) and one for a missing source (`source missing`). Each failed row names the source exactly as typed. A new add verb module drives them, and a malformed-manifest fixture mode is chosen through a `ManifestProblem` record, with no cloned kind switch.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-16T12:36:32Z
- **Completed:** 2026-10-16T12:43:21Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- ADD-07 Outline: a malformed JSON or schema-invalid manifest, for dir and file, fails with the error envelope and one row `<source> | project | failed | invalid manifest`. Four untagged rows run now. Two `@url` rows are dry-run by the feature gate (D-04, D-05).
- ADD-06 Outline: `{home}/marketplaces/missing`, `~/marketplaces/missing`, the missing manifest file path, and an existing empty directory all fail as `source missing`, each named exactly as typed. The `~/` row keeps the `~` (D-03, D-05).
- `features/step_definitions/marketplace/add.steps.ts`: the add verb module. All three step texts name `add`.
- `writeMalformedManifest` and a single module-private `manifestText` builder. The three manifest contents at one path measure 57, 61, and 56 bytes.

## Task Commits

1. **Task 1 (tracer): a malformed or schema-invalid manifest fails add as invalid manifest (ADD-07)**: `a673811e` (test). Hook `npm run check:commit`: Passed.
2. **Task 2: a path with no marketplace manifest fails as source missing (ADD-06)**: `8be82946` (test). Hook `npm run check:commit`: Passed.

Tracer feedback gate: after commit `a673811e`, the tracer verify ran again on the committed tree and printed `4 scenarios (4 passed)`. Task 2 started after that.

## Verification Results

| Command | Result |
| --- | --- |
| Precondition: `CI=1 npm run check:features` / `npm run test:cucumber` | `Feature gate passed: 30 scenarios, 17 step definitions.` / `26 scenarios (26 passed)` |
| Task 1 `npx cucumber-js --parallel 1 --name 'Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest'` | `4 scenarios (4 passed)` |
| Task 1 `npm run test:cucumber` | `30 scenarios (30 passed)` |
| Task 1 `CI=1 npm run check:features` | `Feature gate passed: 36 scenarios, 19 step definitions.` |
| Task 1 size probe | `57 61 56` |
| `npx fallow audit --base 25d7ae50` verdict (after Task 1, and again after Task 2) | `pass`, `pass` |
| Task 2 `npx cucumber-js --parallel 1 --name 'Adding a path that holds no marketplace manifest fails as source missing, named as typed'` | `4 scenarios (4 passed)` |
| Task 2 `npm run test:cucumber` | `34 scenarios (34 passed)` |
| Task 2 `CI=1 npm run check:features` | `Feature gate passed: 40 scenarios, 20 step definitions.` |

Acceptance greps: the step-text check printed `2 true` after Task 1 and `3 true` after Task 2. `writeMalformedManifest`: 1. `ManifestProblem`: 1. `case "url":`: 2. `"schema-invalid"` in publishing.steps.ts: 1. Each Outline title: 1. `| manifest problem`: 2. `~/marketplaces/missing`: 1. The last two `Scenario` lines are ADD-06 (line 82) and then ADD-07 (line 101).

The phase gate (`npm run check`) belongs to the last plan of the phase. This plan did not run it.

## Planted Checks (each reverted, none committed)

**(a) ADD-07 name cell `<source>` changed to `tools`.** `npx cucumber-js --parallel 1 --name 'Adding a marketplace with a malformed or schema-invalid manifest fails as invalid manifest'` exited 1 with `4 scenarios (4 failed)`:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected
+     '{home}/marketplaces/tools',
-     'tools',
```

The file rows showed the same diff with `'{home}/marketplaces/tools/.claude-plugin/marketplace.json'`. The subject is the typed source, not the manifest name. Restored from a backup copy.

**(b) `writeMalformedManifest` writes the full valid text** (`.slice(0, -1)` removed). The same command exited 1 with `4 scenarios (2 passed, 2 failed)`. The two malformed rows failed, and the add succeeded, so the envelope step failed first:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  [ 'severity',
+     'info'
-     'error'
```

The add reported success (severity `info`, no summary), so its row would read `added`. The schema-invalid rows still passed. Restored.

**(c) `is not valid json` misspelled as `is not valid jsno` in the `@url` block.** `CI=1 npm run check:features` exited 1:

```
features/marketplace/add.feature:84: undefined step "the manifest of the marketplace \"tools\" to add is not valid jsno" (.agents/skills/cucumber/rules/steps.md)
Feature gate failed with 1 finding(s).
```

Restored.

**(d) ADD-06 name cell `<source>` replaced by the literal `{home}/marketplaces/missing`.** `npx cucumber-js --parallel 1 --name 'Adding a path that holds no marketplace manifest fails as source missing, named as typed'` exited 1 with `4 scenarios (1 passed, 3 failed)`. The failing rows' actual names were `'~/marketplaces/missing'`, `'{home}/marketplaces/missing/.claude-plugin/marketplace.json'`, and `'{home}/marketplaces/empty'`. The `~/` row failed too, though it resolves to the same path. Restored.

## Decisions Made

- The step texts follow the plan's suggestions: `the manifest of the marketplace {string} to add is not valid json`, `the manifest of the marketplace {string} to add breaks the manifest schema`, and `the directory {string} to add holds no marketplace manifest`.
- `MANIFEST_WRITERS` is a module-level `Readonly<Record<ManifestProblem, ...>>`. Prettier unquotes the `malformed` key and keeps `"schema-invalid"` quoted. That mix is prettier's own output (`quoteProps: as-needed`), so it stays.
- The empty-directory step proves that the manifest is absent with `assert.rejects(stat(...), { code: "ENOENT" })`, after it registers its release and creates the directory.

## Deviations from Plan

None - plan executed exactly as written.

## Hermeticity Review

- Every fixture path is `path.join(world.marketplacesRoot, <name from the feature file>)`. The `~/marketplaces/missing` row is typed literally and expanded by the extension inside Pi, whose HOME is the sandbox. No step expands `~`, and no step reads or writes the real HOME, `~/.pi/agent`, or git config (T-03-01, T-03-02).
- The url rows stay excluded by `cucumber.json` (`not @url and not @github`), and the url and github arms still throw `noStandIn` (T-03-05).
- The size probe ran in a `mkdtemp` directory under the OS temp directory and removed it afterwards.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 03-02. The add verb module exists for the next add-only steps (ADD-04's second-directory publish). The `ManifestProblem` record lets the url source kind fill its arm behind the same signature.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/step_definitions/marketplace/add.steps.ts
- FOUND: a673811e, 8be82946 (both ancestors of HEAD)
- Commits measured: `git rev-list --count 7aa48c90..HEAD` = 2
