---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 5
subsystem: orchestrators/import + edge/handlers/plugin + lint config
tags: [gap-closure, error-boundary, lint-doc, readonly-types, freeze-discipline]
requires:
  - 20-04 (full V2 cascade migration GREEN per 20-VERIFICATION.md)
provides:
  - Hardened error boundary on `importClaudeSettings`: unexpected `installPlugin`
    throws no longer abort the per-plugin loop; they are recorded in
    `result.unexpectedPluginFailures` and round-trip into the V2 cascade as
    `PluginFailedMessage { reasons: ["not in manifest"] }` rows.
  - Accurate documentation of the import-handler error-boundary contract
    (`edge/handlers/plugin/import.ts:52-63`).
  - ESLint MSG-Block 1b doc note paralleling `orchestrators/plugin/**` with
    `orchestrators/import/**`.
  - Defense-in-depth comments on the three remaining `Object.freeze` sites in
    the import orchestrator.
  - Readonly modifiers on `MarketplaceBlock.name` and `MarketplaceBlock.scope`.
affects:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - tests/orchestrators/import/execute.test.ts
  - eslint.config.js
tech-stack:
  added: []
  patterns:
    - "try/catch wrap on `await installPlugin({...})` inside `executeScopedPlan`,
      push-to-`unexpectedPluginFailures` + `continue` (mirrors the existing
      loadState wrap at execute.ts:518-528 and addMarketplace wrap at 577-608)"
    - "KEEP-with-comment pattern for Object.freeze on `readonly`-typed arrays
      (codebase convention: 30+ sites across bridges/** and orchestrators/discover.ts)"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - tests/orchestrators/import/execute.test.ts
    - eslint.config.js
decisions:
  - "WR-02 Option A locked: catch unexpected installPlugin throws, push to
    result.unexpectedPluginFailures matching dispatchFailedOutcome's shape,
    continue. No outer try/catch added on executeScopedPlan or
    importClaudeSettings (D-20-03 still applies: truly catastrophic throws
    bubble to Pi runtime where a stack trace is more useful than a polished
    masked-bug message)."
  - "IN-02 KEEP-with-comment chosen over DROP: dropping only the three
    import.ts freezes would be inconsistent with the 30+ codebase-wide
    sites that freeze readonly-typed arrays."
  - "IN-03 readonly applied to MarketplaceBlock.name + .scope after
    precheck confirmed zero callers reassign those fields."
  - "IN-04 explicitly DEFERRED (per <gap_inputs> decision 6 in the plan)."
metrics:
  duration: "~25 minutes"
  completed: "2026-05-27T18:30:00Z"
  tasks_completed: 3
  files_modified: 4
  commits: 3
---

# Phase 20 Plan 5: Importer Error Boundary and Polish Summary

One-liner: Wrapped `installPlugin` in a try/catch inside `executeScopedPlan`
to route unexpected throws into the V2 cascade, corrected the edge-handler
error-boundary comment to match post-WR-02 reality, and applied IN-* polish
(ESLint doc note + freeze-discipline comments + readonly fields on
`MarketplaceBlock`).

## Gap Closure Outcome

| Item  | Disposition | Notes                                                                                                                                |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| WR-01 | CLOSED      | Comment block at `edge/handlers/plugin/import.ts:52-63` rewritten -- three named wraps cited with current line refs.                  |
| WR-02 | CLOSED      | `installPlugin` call wrapped in try/catch; new test locks all four behavioral guarantees.                                            |
| WR-03 | CLOSED      | Same comment rewrite (WR-01 + WR-03 collapsed into one edit).                                                                        |
| IN-01 | CLOSED      | ESLint Block 1b comment extended with the `orchestrators/import/**` parallel paragraph (Plan-20-02 anchor named).                    |
| IN-02 | CLOSED      | Three `Object.freeze` sites carry the `// defense-in-depth: typed readonly + runtime freeze (codebase convention)` single-line comment. |
| IN-03 | CLOSED      | `MarketplaceBlock.name` and `.scope` flipped to `readonly`; precheck confirmed no callers reassign.                                  |
| IN-04 | DEFERRED    | Explicitly deferred per plan `<gap_inputs>` decision 6 (sonarjs cognitive-complexity disable).                                       |

## Tasks Completed

### Task 1: WR-02 -- Wrap `installPlugin` + lock-test

**Commit:** `2ae0aab`
**Files:**
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- try/catch
  added around the `await installPlugin({...})` call inside
  `executeScopedPlan`. Catch handler pushes one
  `UnexpectedPluginFailureOutcome` entry matching `dispatchFailedOutcome`'s
  shape (`kind: "plugin-failure"`, `scope`, `plugin`, `marketplace`, `ref`,
  `reason: "unexpected-failure"`, `cause: errorMessage(err)`), then `continue`s.
  `outcome` declared as `let` (was previously `const`).
- `tests/orchestrators/import/execute.test.ts` -- new test
  `importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)`.
  Scaffolds three plugins (`before`, `boom`, `after`) on the `project` scope;
  `installPlugin` mock throws for `boom`, succeeds for the other two. Asserts:
    1. `attempted === ["before", "boom", "after"]` (loop continues)
    2. `result.unexpectedPluginFailures` records the throw with
       `reason="unexpected-failure"` and `cause="simulated host crash"`
    3. `notifications.length === 1` and `severity === "error"` (final
       `notify()` fires once)
    4. Cascade renders `⊘ boom (failed) {not in manifest}` plus
       `● before (installed)` and `● after (installed)`.

### Task 2: WR-01/WR-03 -- Correct error-boundary comment

**Commit:** `fe9afe3`
**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`

Rewrote the comment block at lines 52-55. The new 12-line comment:
- Cites the three per-statement wraps inside `executeScopedPlan`
  (`loadState` at `execute.ts:518-528`, `addMarketplace` at `577-608`,
  `installPlugin` per Plan 20-05 WR-02).
- Drops the stale `execute.ts:745-755` citation (that range pointed at
  `dispatchFailedOutcome`, NOT a try/catch).
- Drops the overstated "per-scope try/catch via executeScopedPlan" phrasing
  (`executeScopedPlan` itself has no function-level catch).
- Acknowledges WR-02's installPlugin wrap and the per-scope loop continuation
  guarantee.
- Preserves D-20-03 escape hatch: uncaught throws from
  `buildImportNotificationMarketplaces` or from non-wrapped code paths still
  bubble to Pi runtime where a stack trace is more useful than a polished
  masked-bug message.

### Task 3: IN-01 + IN-02 + IN-03 -- Polish

**Commit:** `48920cb`
**Files:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `eslint.config.js`

- **IN-01:** Added a paragraph to the MSG-Block 1b comment in `eslint.config.js`
  noting that Phase 20 Plan 20-02 extended the same Block-1-ignore /
  Block-1b-keep pattern from `orchestrators/plugin/**` to
  `orchestrators/import/**`, since MSG-GR-3 project-first iteration discipline
  is V1-wrapper-INDEPENDENT.
- **IN-02:** Added single-line `// defense-in-depth: typed readonly + runtime
  freeze (codebase convention)` comment above each of the three `Object.freeze`
  sites in `execute.ts` (lines 354, 491 + 500 after the line-number shift from
  the new comments).
- **IN-03:** Flipped `name: string` → `readonly name: string` and
  `scope: Scope` → `readonly scope: Scope` in the `MarketplaceBlock` interface.
  `status?`, `reasons?`, `plugins` remain mutable (the builder writes to them
  across the per-outcome loops in `buildImportNotificationMarketplaces`).

## IN-03 Precheck

Per the plan's `<read_first>` directive, ran:

```
grep -nE "\.name\s*=|\.scope\s*=" extensions/pi-claude-marketplace/orchestrators/import/execute.ts
```

**Result:** no matches. No callers reassign `.name` or `.scope` on a
`MarketplaceBlock` instance after construction -- the only construction site
is `ensureMarketplaceBlock` at lines 311-330, which sets both fields via the
object literal at construction time. The readonly modifiers are safe.

## IN-02 Choice Rationale

The plan called for KEEP-with-comment instead of DROP. The codebase
convention is `Object.freeze(...)` on `readonly`-typed arrays as
defense-in-depth -- confirmed by `grep -rn "Object.freeze" extensions/`
returning 30+ sites across `bridges/**` and `orchestrators/discover.ts`.
Dropping only the three `import.ts` freezes would be inconsistent.

## Plan-Level Gate Results

| Gate                                                                                                     | Result                  |
| -------------------------------------------------------------------------------------------------------- | ----------------------- |
| `grep -c "result.unexpectedPluginFailures.push" execute.ts` ≥ 2                                          | **PASS** (2)            |
| `grep -c "execute.ts:518-528" edge/handlers/plugin/import.ts` ≥ 1                                        | **PASS** (1)            |
| `grep -c "execute.ts:745-755" edge/handlers/plugin/import.ts` = 0                                        | **PASS** (0)            |
| `grep -c "orchestrators/import" eslint.config.js` ≥ 2                                                    | **PASS** (3)            |
| `grep -B1 "Object.freeze" execute.ts \| grep -c "defense-in-depth"` ≥ 3                                  | **PASS** (3)            |
| `grep -E "readonly name:\|readonly scope:" execute.ts` ≥ 1 each (within `MarketplaceBlock` body)         | **PASS** (verified)     |
| New test name in `tests/orchestrators/import/execute.test.ts` matches `/installPlugin.*unexpected.*throw|partial.*cascade/i` | **PASS** (ok 7)         |
| `npm run check` exits 0                                                                                  | **PASS** (1364/0 fail)  |
| `node --test tests/architecture/catalog-uat.test.ts` exits 0                                             | **PASS**                |

## Deviations from Plan

None. Plan executed exactly as written.

## SNM-23 Behavioral Surface

The plan stated this is a refinement, not a new requirement closure. SNM-23
was already verified GREEN by Plans 20-01..20-04 (per 20-VERIFICATION.md).
This plan hardens the behavioral surface: previously, an unexpected
`installPlugin` throw on scope A would abort the per-plugin loop, the
per-scope outer loop would still iterate to scope B, but the FINAL
`notify()` would fire with a cascade missing the failed plugin row and any
unprocessed installs from scope A. Now the failed plugin appears as a
`PluginFailedMessage { reasons: ["not in manifest"] }` row and the
surviving installs from scope A are still recorded.

## Commits

| Commit    | Type     | Summary                                                |
| --------- | -------- | ------------------------------------------------------ |
| `2ae0aab` | fix      | catch unexpected installPlugin throws (WR-02)          |
| `fe9afe3` | docs     | correct error-boundary comment in edge import handler  |
| `48920cb` | refactor | IN-01/IN-02/IN-03 polish on import orchestrator        |

## Self-Check: PASSED

Verified each commit exists in git log and each modified file contains the
expected anchor:

- `2ae0aab` -- FOUND: `git log --oneline | grep -q 2ae0aab` ✓
- `fe9afe3` -- FOUND: `git log --oneline | grep -q fe9afe3` ✓
- `48920cb` -- FOUND: `git log --oneline | grep -q 48920cb` ✓
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- present;
  contains `result.unexpectedPluginFailures.push` (×2), `readonly name:`,
  `readonly scope:`, three `defense-in-depth` comments
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- present;
  contains `execute.ts:518-528`, `execute.ts:577-608`, `WR-02`, `Plan 20-05`
- `tests/orchestrators/import/execute.test.ts` -- present; subtest `ok 7`
  with name matching the required regex
- `eslint.config.js` -- present; `orchestrators/import` appears 3 times
  (Block 1 ignore at line 163 + Block 1b doc note + Block 1b inline anchor)
