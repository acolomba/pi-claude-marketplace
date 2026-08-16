---
phase: 101-manifest-field-and-precedence-resolution
plan: 03
subsystem: domain
tags: [typebox, schema, validation, defaultEnabled, characterization, tests]

# Dependency graph
requires:
  - 101-01
provides:
  - "The DFEN-01 schema accept/reject matrix on both compiled validators, covering both booleans on the accept side and a non-boolean on the reject side at each declaration site"
  - "The whole-manifest rejection proof: one malformed `defaultEnabled` on one entry rejects the entire `marketplace.json`, with the contrast to the per-plugin containment precedent stated in the test"
  - "The D-09 lenient unknown-key guard from the schema side, on both validators"
  - "Two additive `seedPathMarketplaceWithPlugin` knobs — `defaultEnabled` (marketplace entry) and `pluginJsonDefaultEnabled` (the plugin's own `plugin.json`)"
  - "The criterion-5 characterization: a plugin declaring `defaultEnabled: false` on either site still installs enabled with its artifacts materialized, and `plugin info` renders byte-identically"
affects:
  - "102 — reason token, install write-through and notification (these tests are the ones that must be deliberately changed there)"
  - "104 — pre-install read surfaces"
  - "105 — the full six-surface byte-identical sweep (DFEN-08)"

actuals:
  tokens: 3750
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Blast-radius contrast comment: when two tests in one file assert opposite containment outcomes for superficially similar defects, the newer one names the older and says why they differ"

key-files:
  created: []
  modified:
    - tests/domain/manifest.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "The whole-manifest rejection test is placed directly after the MCPR-03 per-plugin containment test rather than beside the D-48-B template it copies, because adjacency is what makes the contrast legible to the reader who would otherwise try to reconcile the two."
  - "The accept side uses two separate one-line tests for `false` and `true` rather than one test with two asserts, so a regression on one boolean names itself in the failure output."
  - "The invented unknown key is `vendorSpecificTelemetryKnob` — deliberately not a near-miss of any real field, so the case cannot be misread as a typo-tolerance test."

patterns-established:
  - "Two-site fixture knob: an entry-level and a manifest-level knob for the same field are named distinctly (`defaultEnabled` / `pluginJsonDefaultEnabled`), following the existing `pluginVersion` / `pluginJsonVersion` precedent, because a single knob could not express the entry-silent case."
  - "Materialization-aware characterization: a no-observable-change test asserts the recorded resources alongside the recorded flag, so 'installed enabled' cannot be confused with 'recorded but not materialized'."

requirements-completed: [DFEN-01]

coverage:
  - id: D1
    description: "`PLUGIN_ENTRY_VALIDATOR.Check` accepts an entry declaring `defaultEnabled: false` and one declaring `true`, and rejects a non-boolean; `PLUGIN_MANIFEST_VALIDATOR.Check` accepts and rejects the same way"
    requirement: DFEN-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#DFEN-01 PLUGIN_ENTRY accepts defaultEnabled false / true / rejects defaultEnabled as string; DFEN-01 PLUGIN_MANIFEST accepts defaultEnabled false / rejects defaultEnabled as string"
        status: pass
      - kind: unit
        ref: "node --test tests/domain/manifest.test.ts — 40 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D2
    description: "One malformed `defaultEnabled` on one plugin entry makes `loadMarketplaceManifest` throw `InvalidMarketplaceManifestError` for the WHOLE marketplace.json, naming the offending instance path; the valid sibling entry does not survive"
    requirement: DFEN-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#DFEN-01 one malformed defaultEnabled rejects the WHOLE marketplace.json — two entries written, `err instanceof InvalidMarketplaceManifestError`, message matched against /marketplace\\.json schema invalid/ AND /\\/plugins\\/0\\/defaultEnabled/"
        status: pass
      - kind: other
        ref: "The test carries a comment naming the MCPR-03 per-plugin containment precedent in the same file and why the two outcomes differ"
        status: pass
    human_judgment: false
  - id: D3
    description: "An entry carrying an unrelated unknown key still validates, and so does a `plugin.json` carrying one — adding a named optional property narrowed nothing (D-09)"
    requirement: DFEN-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#DFEN-01 PLUGIN_ENTRY / PLUGIN_MANIFEST accepts an unrelated unknown key alongside defaultEnabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Installing a plugin whose marketplace entry declares `defaultEnabled: false` produces no error notification, an installation record with `enabled: true`, and the seeded skill present in the record's resources; the same holds when the declaration is on the plugin's own plugin.json with the entry silent"
    requirement: DFEN-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#DFEN-01 marketplace entry declares defaultEnabled false / plugin.json declares defaultEnabled false with a silent entry — each asserts 0 error notifications, `record.enabled === true`, and `record.resources.skills` deep-equals `[\"hello-tool\"]`"
        status: pass
      - kind: integration
        ref: "node --test \"tests/orchestrators/**/*.test.ts\" — 1174 pass, 0 fail (was 1172 before this plan; the two new tests are the delta and every pre-existing test still passes unmodified)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`plugin info` renders a byte-identical message for a plugin whose entry declares `defaultEnabled: false` and for the same fixture without the declaration — one notification, `severity` `undefined`, no enablement line and no reason token"
    requirement: DFEN-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#DFEN-01 an entry declaring defaultEnabled renders the same info message as one that does not — expected message spelled out as a joined literal, not derived from a second getPluginInfo call"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/info.test.ts — 68 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D6
    description: "The seeding fixture gained one entry-level and one manifest-level knob and no default behavior — a seeding call that passes neither produces a byte-identical marketplace entry and plugin.json to today"
    requirement: DFEN-01
    verification:
      - kind: other
        ref: "Both knobs are written only inside an `opts.<knob> !== undefined` guard with no default value; the 100 pre-existing tests in install.test.ts pass unmodified"
        status: pass
    human_judgment: false
  - id: D7
    description: "No production file was modified — this plan is tests only, and the scope fence held"
    verification:
      - kind: other
        ref: "git diff --name-only c99818f8~1 HEAD -- extensions/ is empty; the full diff lists exactly the three test files"
        status: pass
      - kind: other
        ref: "npm run check exits 0 (typecheck + lint + format:check + test + test:integration)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 03: Manifest field and precedence resolution Summary

**Both compiled validators now accept a boolean `defaultEnabled` and reject a non-boolean on both declaration sites, one malformed value is proven to reject the whole `marketplace.json` with its contrast to per-plugin containment stated in the test, and a plugin declaring `false` is characterized as still installing enabled with its artifacts materialized and rendering byte-identically in `plugin info`.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-08-14T15:04Z
- **Completed:** 2026-08-14T15:21Z
- **Tasks:** 3
- **Files modified:** 3 (all test files; zero production files)

## Accomplishments

- The schema matrix covers both booleans on the accept side, not just one. The field's whole point is that either value is legal, and asserting only `false` would leave the `true` half of the contract unpinned.
- The whole-manifest rejection test writes two entries — a malformed first and a valid second — so the "surviving sibling" reading is excluded by construction rather than by prose. Its comment names the MCPR-03 precedent a hundred lines above it and says why the outcomes differ: there the schema accepts the value and the defect is resolution-time and per-plugin; here the entry schema itself rejects, and because it is validated as a member of the marketplace schema there is no per-plugin skip to fall back to.
- The message assertion matches both the `marketplace.json schema invalid` prefix and the `/plugins/0/defaultEnabled` instance path, so a future change that kept the throw but lost the location would fail.
- The D-09 lenient unknown-key posture is now guarded from the schema side on both validators. Plan 101-02 guards the same regression from the resolution side; between them, a narrowing of the TypeBox default fails at whichever layer it happens.
- The two install characterizations assert the recorded resources as well as the recorded flag. That is what separates "installed enabled" from "recorded but not materialized" — the two outcomes the next phase will pull apart — and is the reason this characterization was worth writing before they diverge rather than after.
- `plugin info` cost one line of fixture: `manifest.plugins` in that file is already typed `readonly Record<string, unknown>[]`, so the entry-level key needed no seeder plumbing at all.

## Task Commits

1. **Task 1: Schema accept/reject on both validators, and the whole-manifest rejection with its contrast** - `c99818f8` (test)
2. **Task 2: The install path still installs enabled — characterization for both declaration sites** - `4cfe9ad0` (test)
3. **Task 3: `plugin info` renders byte-identically for a declaring plugin** - `af572504` (test)

## Files Created/Modified

- `tests/domain/manifest.test.ts` - five accept/reject cases across the two compiled validators, two lenient unknown-key guards, and the whole-manifest rejection test placed directly after the MCPR-03 containment precedent it contrasts with
- `tests/orchestrators/plugin/install.test.ts` - the `defaultEnabled` and `pluginJsonDefaultEnabled` seeder knobs, plus a delimited section holding the two no-observable-change characterizations
- `tests/orchestrators/plugin/info.test.ts` - one byte-identical rendering test filed with the single-scope installed cases, and the file-header coverage map extended to list it

## Decisions Made

- **Placement of the whole-manifest rejection test.** The plan named the `D-48-B` test as the shape template and the `MCPR-03` test as the contrast. It was filed next to `MCPR-03` rather than next to `D-48-B`, because the shape is copied once and read never, while the contrast is what a later reader has to resolve. Adjacency does that work; a cross-reference alone would not.
- **One test per boolean on the accept side.** `false` and `true` got separate one-line tests instead of one test with two asserts. The file's whole idiom is one-liner cases, and a combined test would report a single failure for either half.
- **The unknown key is `vendorSpecificTelemetryKnob`.** Deliberately not a near-miss of `defaultEnabled`, `description` or `version`, so nobody reads the case as typo tolerance. Both the entry-side and manifest-side guards use the same name so the pair reads as one fact asserted twice.
- **The install characterizations assert `record.resources.skills`, not just `record.enabled`.** A change that recorded a plugin enabled but skipped materialization — or the reverse — would pass a flag-only assertion. The plan called for this and it is the assertion most likely to earn its keep in the next phase.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule fired; no auto-fix was needed.

One judgment call inside planned work, recorded rather than left implicit: the plan asked for the `info` case to be "filed with the single-scope installed cases and listed in the file-header coverage map". Rather than opening a new letter `(m)` at the end of an alphabetical map whose test would sit under `(a)`, the existing `(a)` bullet was extended. That keeps map order and file order in agreement.

## Issues Encountered

- The `trufflehog` pre-commit hook fails structurally in a linked worktree (`.git` is a file, so the git-mode scan cannot read the index). Handled by the project's sanctioned procedure all three times: a clean `trufflehog filesystem` scan over the exact path being committed (`verified_secrets: 0`, `unverified_secrets: 0` each time), then `pre-commit run --files ...` with every other hook passing, then `SKIP=trufflehog git commit`. No other hook was skipped and `--no-verify` was never used.

## Verification

- `npm run check` exits 0 — typecheck, lint, format:check, the unit suite and the integration suite (18 pass, 0 fail) all green. This is the last plan of the phase, so the full chain was run rather than the per-task subset.
- Per-file counts taken during execution: `tests/domain/manifest.test.ts` 40 pass, `tests/orchestrators/plugin/install.test.ts` 102 pass, `tests/orchestrators/plugin/info.test.ts` 68 pass, and the whole `tests/orchestrators/**` suite 1174 pass / 0 fail.
- `git diff --name-only c99818f8~1 HEAD -- extensions/` is empty across all three commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scope fence held. No install was recorded disabled, nothing was written to `claude-plugins.json`, no reason token was added, and no notification or read surface changed. Acting on the resolved value remains phase 102's work.
- Phase 102 inherits two fixture knobs it will reuse and three tests it must deliberately change. The two install characterizations and the `info` byte-identity test are exactly the assertions that will need updating when the behavior changes; they are written to state today's contract rather than to predict when it moves, so the edit will be a clear rewrite rather than a silent drift.
- DFEN-01 is closed at both the schema boundary (this plan) and at resolution time (plan 101-02).

## Self-Check: PASSED

All three modified files exist on disk; all three task commits (`c99818f8`, `4cfe9ad0`, `af572504`) are present in `git log`; `git diff --name-only c99818f8~1 HEAD -- extensions/` is empty, confirming no production file was touched.

---
*Phase: 101-manifest-field-and-precedence-resolution*
*Completed: 2026-08-14*
