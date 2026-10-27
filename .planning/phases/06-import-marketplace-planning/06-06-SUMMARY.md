---
phase: 06-import-marketplace-planning
plan: 06
subsystem: orchestrators
status: complete
tags: [mim-04, import, enable, outcome-shape, phase-gate]
requires:
  - phase: 06-import-marketplace-planning
    provides: "06-03 and 06-04 edits of execute.ts; the finished phase tree for the gate"
provides:
  - "The import enable outcome carries each staged-kind fact once, in the required declares* members (D-PL6-06)"
  - "enableSignals narrowed to unsupported, orphanRewake, degradedKinds"
  - "Phase gate: npm run check exit 0 on 94461694"
  - "The merge sections: CHANGELOG line, decision rows, backlog dispositions, uncertain choices"
affects: [phase merge, milestone audit]
tech-stack:
  added: []
  patterns: ["a row composer rebuilds optional staged inputs from required facts with conditional spreads"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - test/orchestrators/import/execute.test.ts
key-decisions:
  - "enableDegradation builds the three degradation facts with conditional spreads; degradationFromEnable stays unchanged for reconcile/apply.ts"
  - "A new unit case pins the degradedKinds fact on an import re-enable, because the new spread branch had no direct coverage"
requirements: [MIM-04]
requirements_completed_by_phase: [MIM-01, MIM-02, MIM-03, MIM-04]
metrics:
  duration: 16min
  completed: 2026-10-27
estimate:
  tokens: 45000
  tasks: 2
actuals:
  tokens: 1400
  tasks: 2
  commits: 1
plan_head_before: 2582e7dba12e0b81880d3adfc1d60793900d5abd
plan_head_after: 94461694ecdae8f87a8953efb8ced419e5bd0bdd
---

# Phase 6 Plan 06: One copy of each enable companion fact, and the phase gate Summary

The import enable outcome now keeps the staged agents, MCP servers, and workflows facts only in its required `declaresAgents`, `declaresMcp`, and `declaresWorkflows` members. `enableSignals` holds only the degradation facts. The enable rows render byte for byte as before. `npm run check` passes on the finished phase tree.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | The import enable outcome carries each companion fact once (tracer) | 94461694 | execute.ts, execute.test.ts |
| 2 | Phase gate and the merge sections of the SUMMARY | (this SUMMARY's docs commit) | 06-06-SUMMARY.md |

`actuals.commits: 1` is the measured `git rev-list --count 2582e7db..HEAD` at SUMMARY time. The docs commit of this SUMMARY follows it. `actuals.tokens` is chars/4 over the code diff (5,545 bytes).

## What changed in execute.ts

- `PluginInstalledOutcome.enableSignals` is now `Omit<EnableDegradationSignals, "stagedAgents" | "stagedMcpServers" | "stagedWorkflows">`. Its doc comment says the staged facts live only in `declares*` (LCCODE-01).
- New module-private `enableDegradation(signals)` sits directly above `enableOnePlannedPlugin`. It returns `unsupported`, `orphanRewake`, and `degradedKinds`, each present only when set. The `enabled` arm of `enableOnePlannedPlugin` calls it in place of `degradationFromEnable`. The `degradationFromEnable` import is gone from execute.ts. `plugin/shared.ts` is unchanged, and `reconcile/apply.ts` still uses the function.
- `installedRow` passes `enabledRowFromOutcome` the degradation facts plus `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows`, each spread only when its `declares*` member is true.

## TDD evidence

- RED: the IMP-05 enable case was changed to expect `enableSignals: {}` for alpha. It failed before the code change (`✖ IMP-05: enables a plugin the scope records disabled and declares it enabled`).
- GREEN: 92/92 passed after the change. The rendered text of that case, `● alpha v1.0.0 (installed) {requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}`, did not change. The partial case still expects `enableSignals: { unsupported: ["outputStyles"], orphanRewake: true }` and its `(partially-installed)` row.
- Coverage: the first green run left one branch uncovered (311/312), the `degradedKinds` spread. No import enable case set `degradedKinds`. The new case "IMP-10: re-enabling a record with a malformed skill keeps the degraded kind" covers it. It pins `enableSignals: { degradedKinds: ["skill"] }` and the warning row `● degraded (installed) {malformed skill}`, which is the row reconcile renders for the same re-enable. After it, 93/93 pass and direct coverage of execute.ts is 100% (exit 0).

## Phase gate

| Field | Value |
| ----- | ----- |
| Command | `npm run check` (unpiped, output redirected to a file, exit status read from the shell) |
| Exit status | 0 |
| Commit | 94461694ecdae8f87a8953efb8ced419e5bd0bdd (clean tree) |
| Node | v26.12.1 (uid 1000) |
| Scope | the whole tree: `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, `test:integration`, `test:cucumber` (909 scenarios, 9082 steps, all passed, random seed 649856), `test:coverage:direct:all` (291 records merged) |

The commit hook (`npm run check:commit`) also passed on 94461694.

## Acceptance checks

- `grep -c 'readonly enableSignals?: EnableDegradationSignals;' execute.ts`: 0 (baseline 1).
- `grep -c 'stagedAgents: true' execute.ts`: 1 (baseline 0).
- `git diff --name-only 9df64669 -- CHANGELOG.md .planning/PROJECT.md .planning/BACKLOG.md`: empty.
- No rendered `message` string of an existing case changed in 94461694. The test diff changes one `enableSignals` expectation and adds one case (see Deviations).

## CHANGELOG line

A sub-bullet for the milestone's `[Unreleased]` entry. It has 36 words in two sentences, each under 25 words:

```markdown
  - `import` now adds every marketplace your Claude settings list, and reuses one you already added under another name. `import` and `apply` now name each step that a failed install could not roll back, as `install` does.
```

MIM-04 has no user-visible change, so the line does not mention it.

## Decision rows

Rows for the Key Decisions table of `.planning/PROJECT.md` (`| Decision | Rationale | Outcome |`). Each Outcome is `✓ Good` because its scenario or unit case passed in this phase, and the phase gate above passed.

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| **D-PL6-01 (plugin-lifecycle, Phase 6): `import` plans every `extraKnownMarketplaces` entry, referenced or not** — the enabled plugins' marketplaces come first, then the rest, each in settings order; an unmappable unreferenced entry gets the `unmappable-marketplace-source` diagnostic; an added one is declared by the post-pass, and an unreferenced entry alone makes a scope take its lock. D-PL6-08: an unreferenced `claude-plugins-official` entry is not planned | Upstream parity: Claude Code 2.1.310's startup reconciler (`zF`, `W7r`, `CRn`) registers every declared entry and adds the official marketplace only when an enabled plugin names it (`sourceIsFallback`) | ✓ Good |
| **D-PL6-02 (plugin-lifecycle, Phase 6): `import` follows a one-to-one source claim; supersedes lifecycle-coverage D-07 (phase 19)** — when the scope records a settings marketplace's source under exactly one other name that the settings do not declare, import adds nothing, reports `<recorded> (skipped) {already added}`, installs or enables `p@<settings name>` as `p@<recorded name>`, and declares the marketplace (with the settings source) and the plugins under the name the scope config already uses for that record, else the recorded name (review fix CR-01). A conflicted claim stays a `{source mismatch}`. D-PL6-10: the claim map comes from `reconcile/plan.ts::marketplaceSourceClaims`, the planner's own `buildMarketplaceClaims`, so import and reconcile cannot disagree; aliasing rewrites each claimed ref's `marketplace` and `raw` | Claude Code's add reuses a source recorded under another name without error (`Lle`, "Source already materialized"); the reconcile planner already aliases one-to-one claims (Phase 3 Key Decision); D-07's failure, a next load that uninstalled the plugin, is gone because the config now declares both under the recorded name and a following `pending` is empty | ✓ Good |
| **D-PL6-03/04/05 (plugin-lifecycle, Phase 6): `import` and `apply` report a partial rollback with `install`'s detail** — import's failed install or enable row carries the per-phase `[<phase>] (rollback failed)` rows from `rollbackPartials` (D-PL6-03); a dependency's partial gets its own `<plugin>@<marketplace> (failed) {rollback partial}` row beside the requested plugin's bare `{dependency failed}` row, both under the requested plugin's block (D-PL6-04); `apply`'s failed-install row (`applyPluginInstalls` only) reads `(failed) {rollback partial}` with the redacted cause and phase rows, and a dependency's partial gets its own row under the dependency's marketplace by its bare name (D-PL6-05). D-PL6-11: the orchestrated enable failure carries `rollbackPartials`. D-PL6-12: each phase cause is redacted like the row's cause. D-PL6-13: a sixth scenario covers apply's dependency rows | A partial rollback can leave files behind; a bare `{dependency failed}` or a reason with no phase rows hides that from the user, while `install` already names each phase | ✓ Good |
| **D-PL6-06 (plugin-lifecycle, Phase 6): the import enable outcome carries each companion fact once** — the staged-kind facts live only in the required `declaresAgents`, `declaresMcp`, `declaresWorkflows`; `enableSignals` holds `unsupported`, `orphanRewake`, `degradedKinds`; `installedRow` rebuilds the enable row's staged inputs from `declares*` | One fact in two fields can drift; the rendered rows, companion markers included, do not change | ✓ Good |
| **D-PL6-09 (plugin-lifecycle, Phase 6): a settings marketplace the planner reports as a source mismatch is checked before the add, and an unreferenced one takes a `(failed)` block** — through `recordMarketplaceAddFailure`, reason `add-failed`, with the mismatch text as the cause | Import has always blocked a source mismatch rather than replacing the recorded marketplace; with no plugin to carry `{source mismatch}`, a skip would be silent | ✓ Good |
| **D-PL6-07/14 (plugin-lifecycle, Phase 6): partial-rollback scenarios use a real undo failure** — a plugin ships a skill with a read-only (0555) directory, and a directory blocks the scope's `mcp-adapter.json`, so the mcp phase fails and the skills undo fails with EACCES; the fixture's release step restores write permission first; the scenarios cannot run as root. D-PL6-14: the cucumber harness projects a non-empty `rollback partial` JSON cell into tokens, and projects the path-cut form of each error token so cause cells match on Node 24 and Node 26 | A double that throws from undo would not prove the real bridge leaves files behind; Node 26 appends the path to fs errno messages and Node 24 does not | ✓ Good |

## Backlog dispositions

- **IMPNAME-01: fixed** by MIM-01 (D-PL6-02, D-PL6-10). Commit 9120ea32 (`fix(import): reuse a marketplace recorded under another name`). Scenario: "Importing settings that name a known marketplace under another name installs the plugin under the recorded marketplace".
- **IMPEXTRA-01: fixed** by MIM-02 (D-PL6-01, D-PL6-08). Commit 9986012b (`feat(import): add every extra known marketplace of the settings`). Scenario: "Importing adds an extra known marketplace that no enabled plugin names".
- **LCORCH-01, second bullet ("Rollback-partial detail"): fixed** by MIM-03 (D-PL6-03 to D-PL6-05, D-PL6-11 to D-PL6-13). All three of its points are covered: import's per-phase rows, the dependency's own row in an import cascade, and reconcile's failed-install row. Commits:
  - outcomes: e1dbd1e0 (install dependency partials), ea683e87 (enable partials), 969f39a1 (`PluginInstallFailedOutcome`);
  - import rows: e747bfae, 425d29cd;
  - apply rows: da7bcd32, 00006f07;
  - fixture and token projection: e72392ff, 635c0360.
  The other LCORCH-01 bullets (the `marketplace add` classification, `update` MCP notices, the reinstall regressions, the tag-ref reinstall refresh, and the delisted-copy containment) stay open for their phases.
- **LCCODE-01, seventh bullet (the import enable outcome carries the companion facts twice): fixed** by MIM-04 (D-PL6-06). Commit 94461694 (`refactor(import): carry each enable companion fact once`). The other LCCODE-01 bullets stay open for Phases 4 and 11. That includes the undeclared `rollbackPartials` on `InstallMissingDependencyOutcome`, which MISS-01 rows need.

## Uncertain choices (for user review)

From 06-CONTEXT.md:

1. **D-PL6-02, alias instead of Claude Code's plugin error.** Import installs `p@<settings name>` as `p@<recorded name>` and declares both under the recorded name. Alternative: reuse the recorded marketplace but report each `p@<settings name>` as `(failed) {marketplace not added}`, as Claude Code does (E2).
2. **D-PL6-02, the row names the recorded marketplace.** `<recorded> (skipped) {already added}`, with no row under the settings name. Alternative: show the settings name.
3. **D-PL6-05, apply's dependency row placement.** The dependency's row goes under its own marketplace by its bare name. Alternative: under the requested plugin's block by its full key, as `install` and import do.
4. **D-PL6-05, MISS-01 left out.** Only `applyPluginInstalls`'s failed-install row shows the partials. The missing-dependency row waits for Phase 11's type fix.
5. **D-PL6-01, unreferenced marketplace order.** Referenced marketplaces first, then unreferenced ones, each in settings order. Alternative: one pass in `extraKnownMarketplaces` order.
6. **D-PL6-09, an unreferenced source mismatch fails.** A `(failed)` block. Alternative: re-add with the new source, as Claude Code's reconciler does for `sourceChanged`.
7. **D-PL6-11/D-PL6-05, Phase 1 files.** Small additive edits to `enable-disable.ts` and `apply-outcomes.ts`. Alternative: leave the enable and apply partials unreported.

Planner choices in the plans:

8. **06-01: the install rollback scenario as the harness tracer.** A new `install-rollback.feature` scenario, "An install whose skills rollback cannot finish names the skills phase", proves the fixture before import and apply use it.
9. **06-04: the import enable-partial scenario.** "Importing a disabled plugin whose enable rollback cannot finish names the rollback phase" covers the enable arm, which MIM-03 names but no listed scenario did.
10. **06-03: a plugin-less source mismatch uses the `add-failed` reason with no brace token.** It renders `⊘ <mp> [scope] (failed)` with a `cause:` row. Alternative: a new `{source mismatch}` brace on the cause row.
11. **06-03: the conflicted-claim cause (superseded by review fix WR-02).** Import now names what conflicts: `Claude settings source <src> matches more than one recorded marketplace: a, b.` or `Recorded marketplace <name> is claimed by more than one Claude settings marketplace.` The `pending` wording is unchanged.
12. **06-03: `ref.raw` is rewritten to the recorded key.** An aliased plugin's `ref` reads `plugin@<recorded>`, not the settings text.
13. **06-04: the dependency-partial rows are ordered by name** (`compareByNameThenScope`, as `install`'s `sortRows` does).

Choices that executor SUMMARYs reported:

14. **06-01/06-04: a failed skills undo leaves the skill staged, and the row's `leaks` cell is empty.** The scenarios pin the staged `demo-skill` with an empty installation record. The `{rollback partial}` row tells the user that files may remain, but no leak row names the skill. Decide whether a staged leftover needs a leak entry.
15. **06-03: a marketplace-only import has no `/reload` line.** When the settings name only an extra marketplace, the result reads `● tools [user] (added)` / `Import: 1 success`, as `marketplace add` does.
16. **06-04: `failedDependency` carries only the key and the phases.** The dependency row's cause is the outcome's own redacted cause and chain, so it is not stored twice.
17. **06-05: apply does not sort the pair.** The requested plugin's `{dependency failed}` row comes before the dependency's row, in the order the plan states them. Import sorts the pair by name. The two usually sit in different blocks in apply, but they share one when the dependency comes from the same marketplace.
18. **06-02: the standalone `handleCascadeThrow` return is unchanged.** Nothing reads it, and the standalone rows already render the partials.
19. **06-06: a new unit case beside the expectation change.** The plan limited the test diff to `enableSignals` expectations. The new `degradedKinds` branch needed a case for 100% direct coverage, so one case was added. No existing rendered string changed.
20. **06-06: the CHANGELOG line says "a failed install".** Import also names the phases of a failed enable. The line keeps to install so that it does not imply apply's enable rows changed (they did not).
21. **Review fix WR-01, no alias to a name the settings declare.** When the settings also declare the recorded name, import does not alias another settings name to it, and that name's add fails with `already exists`. Claude Code reuses the record with no error (E2). Import fails closed because the claim is ambiguous.
22. **Review fix IN-05, error-token path matching.** `features/lib/run-tokens.ts` now matches a quoted path in any error token's message by its last segment, not only in the new read-only-skill token. This loosens every error-token cell; all 914 scenarios pass.

## Requirements completed by this phase

MIM-01, MIM-02, MIM-03, MIM-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] A unit case for the `degradedKinds` fact**

- **Found during:** Task 1
- **Issue:** The new conditional spread for `degradedKinds` had no direct coverage (branches 311/312). Before the change, `degradationFromEnable` in `plugin/shared.ts` held that branch, so it did not count against execute.ts.
- **Fix:** Added "IMP-10: re-enabling a record with a malformed skill keeps the degraded kind". It pins the outcome and the rendered warning row. Reusing `degradationFromEnable` and dropping the staged keys by destructuring would add no branch, but `sonarjs/no-unused-vars` rejects the unused destructured names.
- **Files modified:** test/orchestrators/import/execute.test.ts
- **Commit:** 94461694

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-13 is mitigated as planned: `installedRow` rebuilds the staged facts from the required `declares*` members, and the unchanged rendered text of the IMP-05 enable case proves that the companion markers render as before.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/import/execute.ts, test/orchestrators/import/execute.test.ts
- FOUND: 94461694 (an ancestor of HEAD)
- `npm run check` exit 0 on 94461694.

## Handoff: user decisions on uncertain choices (2026-10-27)

Applied through quick tasks 261027-9e2, 261027-9jj and 261027-ac6 (their SUMMARYs under `.planning/quick/` carry the full decision rows and the new uncertain choices).

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| **D-PL6-15:** `apply` sorts the requested/dependency failed-row pair by name | Same order as `import` | ✓ Good |
| **D-PL6-16:** any-directory path matching only for the read-only-skill error token | Keeps every other error-token cell strict | ✓ Good |
| **D-PL6-17 (reverses D-PL6-02, D-PL6-10):** a settings marketplace whose source is recorded under another name reuses the record silently; each `p@<settings name>` fails `not added` and nothing is installed or declared | Upstream parity: Claude Code's add reuses the source silently and plugin ids are not aliased (E2) | ✓ Good |
| **D-PL6-18 (reverses the WR-01 fix):** reuse silently even when the settings also declare the recorded name | Upstream parity (E2) | ✓ Good |
| **D-PL6-19 (reverses D-PL6-09):** a declared source that differs from the record re-adds the marketplace in place; installed plugins are left to the next `pending`/`apply` | Upstream parity (E3: `W7r` `sourceChanged` → `CRn` → `Lle` overwrite) | ✓ Good |
| **D-PL6-20:** a skill a failed skills undo leaves staged is listed in `leaks` | The user must see what a partial rollback left behind | ✓ Good |

Backlog dispositions:
- **forceRemoveDeletedPlugins delisting enforcement:** not honored anywhere in the codebase; new backlog candidate.

Cross-phase items (the parent carries these into Phase 10, which owns `reconcile/apply.ts` and `notify.ts`):
- The official marketplace's `{source mismatch}` rows (upstream treats it as up to date, `sourceIsFallback`).
- The import post-pass writes only the base config layer.
- `apply` and the load should re-add a marketplace in place on a declared source change, as `import` now does under D-PL6-19; reconcile still aliases one-to-one source claims, so import and reconcile diverge until then.

Superseded entries above: uncertain choices 1, 2, 6, 11, 12, 21 (reversed or removed), 14 (now D-PL6-20), 17 (now D-PL6-15), 22 (now D-PL6-16). Choice 4 (MISS-01) moves to Phase 10 with the parent.
