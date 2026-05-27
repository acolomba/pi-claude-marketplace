---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 6
type: execute
wave: 1
depends_on: [20-05]
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - tests/orchestrators/import/execute.test.ts
autonomous: true
gap_closure: true
requirements: [SNM-23]
tags: [gap-closure, citation-hygiene, cross-scope-regression-test, comment-quality]

must_haves:
  truths:
    - "No line-anchored citations (matching the pattern `execute.ts:NNN-NNN` or `importClaudeSettings:NNN`) remain in the three Plan-20-05-modified files; every reference is function-anchored per D-20-06 (REVIEW.md WR-01 Option B)."
    - "A sibling test next to the existing in-scope WR-02 lock-test exercises cross-scope continuation: with `selectedScopes: [\"project\", \"user\"]` and `installPlugin` throwing on scope A and succeeding on scope B, BOTH scopes are attempted, scope B's installed plugin still appears, AND a SINGLE merged `notify()` fires for both scopes."
    - "`npm run check` exits 0 (typecheck + ESLint + Prettier + tests all GREEN)."
    - "`node --test tests/orchestrators/import/execute.test.ts` exits 0 with the new cross-scope subtest passing."
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
      provides: "Function-anchored comment block (no `execute.ts:NNN-NNN` line refs)"
      contains: "executeScopedPlan"
    - path: extensions/pi-claude-marketplace/orchestrators/import/execute.ts
      provides: "Function-anchored citation in WR-02 try/catch comment (no `importClaudeSettings:NNN` refs)"
      contains: "importClaudeSettings"
    - path: tests/orchestrators/import/execute.test.ts
      provides: "Function-anchored citations in WR-02 lock-test comments + new cross-scope sibling test"
      contains: "cross-scope"
  key_links:
    - from: tests/orchestrators/import/execute.test.ts
      to: extensions/pi-claude-marketplace/orchestrators/import/execute.ts
      via: "Cross-scope sibling test mocks `installPlugin` throw on scope A and verifies outer `for (const scopePlan of plan.scopes)` loop continues to scope B with a single merged notify() emission."
      pattern: "selectedScopes:\\s*\\[\\s*\"project\"\\s*,\\s*\"user\"\\s*\\]"
    - from: extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
      to: extensions/pi-claude-marketplace/orchestrators/import/execute.ts
      via: "Comment block at top of handler references `executeScopedPlan`'s three named try blocks (state-load, marketplaces-ensure, pluginsToInstall) and `importClaudeSettings`'s final notify()"
      pattern: "executeScopedPlan"
  coverage_constraints:
    - "ZERO matches for `grep -E 'execute\\.ts:[0-9]+' extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts` in COMMENTS (code error messages and test data strings are exempt). After this plan: 0."
    - "ZERO matches for `grep -E ':[0-9]{2,4}\\b' extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts | grep -v '^.*://'` against `importClaudeSettings` / `executeScopedPlan` anchor names."
    - "The new cross-scope subtest name matches the regex `/cross.scope|both.scopes.*continue|selectedScopes.*\\bproject.*user\\b/i` AND exit code 0."
---

<objective>
Close the 2 remaining post-Plan-20-05 advisory gaps from `20-VERIFICATION.md` `human_verification[]` and `20-REVIEW.md` (post-closure) WR-01/WR-02:

1. **Citation drift (WR-01 post-closure):** Plan 20-05 itself re-introduced the same stale-line-citation bug class that the v1 REVIEW's WR-03 had closed. Three off-by-N references currently exist:
   - `edge/handlers/plugin/import.ts:52-53` cites `execute.ts:518-528` and `execute.ts:577-608` (actual: 521-531 and 580-611)
   - `orchestrators/import/execute.ts:644` cites `importClaudeSettings:787` (actual final notify(): 808)
   - `tests/orchestrators/import/execute.test.ts:435,494` carry the same `importClaudeSettings:787` drift
   Per the human disposition recorded in this plan run (REVIEW.md WR-01 §Option B), replace ALL line-anchored citations with function-anchored citations. This is the durable mitigation: function names do not drift on edits below the citation point.

2. **Cross-scope regression test gap (WR-02 post-closure):** Plan 20-05's lock-test (`execute.test.ts:429-507`) exercises in-scope per-plugin continuation on `selectedScopes: ["project"]` only. The outer-loop guarantee (scope A throws unexpectedly → scope B still runs → single merged notify()) is not regression-guarded. A future refactor could silently break cross-scope continuation. Add a sibling test that locks this.

Purpose: Make the import error-boundary comments durable against line-shifts AND lock the cross-scope continuation guarantee against regression. This is a REFINEMENT of already-VERIFIED-GREEN work; SNM-23 is functionally complete (Plans 20-01..20-05 closed it).

Output: Three modified files, one new sibling test, an updated SUMMARY.md.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-VERIFICATION.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-05-SUMMARY.md
@extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
@extensions/pi-claude-marketplace/orchestrators/import/execute.ts
@tests/orchestrators/import/execute.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace line-anchored citations with function-anchored citations across all three Plan-20-05-modified files (WR-01 post-closure Option B)</name>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts,
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts,
    tests/orchestrators/import/execute.test.ts
  </files>
  <read_first>
    - `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` lines 40-64 (current 12-line comment block at 52-63; established by Plan 20-05 Task 2)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 630-680 (the WR-02 try/catch block; comment at 641-644 cites `importClaudeSettings:787`)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 780-812 (the outer for-loop and the final `notify()` call at line 808 -- confirms the function-anchor target)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` line 511 (the `async function executeScopedPlan(` declaration -- the function-anchor used by the import.ts comment)
    - `tests/orchestrators/import/execute.test.ts` lines 429-507 (existing WR-02 in-scope lock-test; comments at 435, 488, 494, 500 carry line-anchored citations to replace)
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` §WR-01 "Fix" section (the Option B function-anchored proposal -- this task implements EXACTLY that)
  </read_first>
  <action>
Replace every line-anchored citation (`execute.ts:NNN-NNN` or `importClaudeSettings:NNN`) in comments across the three files with function-anchored citations. Code (non-comment) line refs in error messages or test data are EXEMPT. Apply these exact substitutions:

**File 1: `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`** -- Rewrite the comment block currently at lines 52-63 so it reads (preserve outer indentation `    //`):

```
    // No try/catch: importClaudeSettings wraps loadState (in executeScopedPlan's
    // state-load try block), addMarketplace (in executeScopedPlan's
    // marketplacesToEnsure loop), and installPlugin (in executeScopedPlan's
    // pluginsToInstall loop, per Plan 20-05 WR-02 gap closure) per-scope;
    // expected installPlugin failures already route through the discriminated
    // {status: "failed"} return. With WR-02 in place, unexpected installPlugin
    // throws are ALSO caught and routed to result.unexpectedPluginFailures; the
    // per-scope loop continues and the final notify() at the end of
    // importClaudeSettings still fires. Only uncaught throws from the inline
    // cascade builder (buildImportNotificationMarketplaces) or from code paths
    // NOT covered by these wraps would abort the loop -- per D-20-03 such
    // catastrophic throws bubble to Pi runtime where a stack trace is more
    // useful than a polished message that masks the bug.
```

Outcome: `execute.ts:518-528` and `execute.ts:577-608` are removed; the three named wraps are anchored to `executeScopedPlan`'s named sub-blocks (state-load try block, marketplacesToEnsure loop, pluginsToInstall loop), all of which are unique grep-able identifiers in `execute.ts`.

**File 2: `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`** -- Rewrite the comment currently at lines 641-644 (above the WR-02 try/catch) to read:

```
    // WR-02 (gap closure, Plan 20-05): catch unexpected installPlugin throws
    // and route them to result.unexpectedPluginFailures matching
    // dispatchFailedOutcome's shape; per-scope loop continues and the final
    // notify() at the end of importClaudeSettings still fires.
```

Outcome: `importClaudeSettings:787` removed; replaced with "at the end of importClaudeSettings" (the function-anchor).

**File 3: `tests/orchestrators/import/execute.test.ts`** -- Rewrite all four line-anchored comments inside the existing WR-02 lock-test (test block at lines 429-507):

3a. Comment at line 435 currently reads:
```
  // importClaudeSettings:787 to fire exactly once with the cascade row.
```
Rewrite to:
```
  // the final notify() at the end of importClaudeSettings to fire exactly once with the cascade row.
```

3b. Comment at line 488 currently reads:
```
  // dispatchFailedOutcome's shape (execute.ts:737-745).
```
Rewrite to:
```
  // dispatchFailedOutcome's shape (the catch arm in executeScopedPlan's pluginsToInstall loop).
```

3c. Comment at line 494 currently reads:
```
  // (3) final notify() at importClaudeSettings:787 fired exactly once;
```
Rewrite to:
```
  // (3) final notify() at the end of importClaudeSettings fired exactly once;
```

3d. Comment at line 500 currently reads:
```
  // buildImportNotificationMarketplaces (execute.ts:457-465) to the V2
```
Rewrite to:
```
  // buildImportNotificationMarketplaces (the V2 cascade builder in execute.ts) to the V2
```

Preserve all surrounding code (try/catch behavior, test logic, indentation, blank lines) exactly. Only the cited comment LINES change. Do NOT alter executable lines or test assertions.

Run pre-commit: `pre-commit run --files extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts`. If running from a worktree, prefix the git commit with `SKIP=trufflehog`.

Commit message (Conventional Commits, ≤72 char title):
```
docs(20): function-anchor citations across import path (WR-01)
```
Body (≤80 char lines, optional):
```
Replace line-anchored comment refs (execute.ts:NNN-NNN, importClaudeSettings:
NNN) with function-anchored refs per REVIEW.md WR-01 Option B. Citations now
point at executeScopedPlan's named sub-blocks (state-load try block,
marketplacesToEnsure loop, pluginsToInstall loop) and "the end of
importClaudeSettings", which do not drift on line-number shifts below.
```
  </action>
  <verify>
    <automated>grep -cE "execute\.ts:[0-9]+|importClaudeSettings:[0-9]+" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts | awk -F: '{s+=$NF} END {exit !(s==0)}'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "execute\\.ts:[0-9]+" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts` returns ZERO matches (was 4 before this task: 2 in import.ts at lines 52-53, 2 in execute.test.ts at lines 488, 500).
    - `grep -nE "importClaudeSettings:[0-9]+" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts` returns ZERO matches (was 3 before: execute.ts:644, execute.test.ts:435, execute.test.ts:494).
    - `grep -c "executeScopedPlan" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` >= 3 (the new comment block cites each of executeScopedPlan's three named sub-blocks: state-load, marketplacesToEnsure, pluginsToInstall -- task-level gate tightened to match plan-level Gate 2).
    - `grep -c "end of importClaudeSettings" extensions/pi-claude-marketplace/orchestrators/import/execute.ts tests/orchestrators/import/execute.test.ts` returns >= 3 across the two files (execute.ts WR-02 comment + execute.test.ts comments at 435 and 494).
    - `grep -c "pluginsToInstall loop" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts tests/orchestrators/import/execute.test.ts` >= 2 (import.ts comment + execute.test.ts:488 comment).
    - `npm run check` exits 0.
    - `node --test tests/orchestrators/import/execute.test.ts` exits 0 and the existing `ok 7 - importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)` still PASSES.
    - `git log --oneline -1` shows the new commit with title matching `docs(20): function-anchor citations`.
  </acceptance_criteria>
  <done>
    All four line-anchored citations are replaced with function-anchored equivalents. No `execute.ts:NNN` or `importClaudeSettings:NNN` patterns remain in any of the three files. `npm run check` GREEN. Behavior unchanged (commit is comment-only). Single Conventional Commit landed with `docs(20):` prefix.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add sibling cross-scope continuation regression test (WR-02 post-closure)</name>
  <files>tests/orchestrators/import/execute.test.ts</files>
  <read_first>
    - `tests/orchestrators/import/execute.test.ts` lines 1-50 (imports, `makeCtx()` scaffold, `NotifyRecord` type)
    - `tests/orchestrators/import/execute.test.ts` lines 343-427 (the test immediately preceding the WR-02 in-scope test -- establishes mock conventions for `loadSettings`, `loadState`, `addMarketplace`, `installPlugin` with multiple plugins on a single scope)
    - `tests/orchestrators/import/execute.test.ts` lines 429-507 (the existing WR-02 in-scope lock-test; the new test is its SIBLING and uses the same mock-deps pattern but TWO scopes)
    - `tests/orchestrators/import/execute.test.ts` lines 907-940 (existing `keeps user and project operations independent` test -- establishes the scope-parameterized `loadSettings: async (scope) => ({...})` pattern; the new test reuses this exact pattern but adds an `installPlugin` throw branch on one scope)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 780-812 (the outer `for (const scopePlan of plan.scopes)` loop and final `notify()` -- confirms cross-scope iteration behavior the test is locking)
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` §WR-02 "Fix" section (the minimal sibling scaffold proposed there -- this task implements the same idea, adapted to local mock conventions)
  </read_first>
  <behavior>
    The new sibling test, inserted IMMEDIATELY AFTER the existing WR-02 in-scope test (current end at line 507; insertion at line 508 before the `classifies uninstallable plugins as warnings` test at line 509), MUST lock these five assertions:

    1. **Both scopes attempted (outer loop iterates across throw):** `attempted` records calls on both scopes -- e.g. `["project:boom"]` then `["user:other"]` -- proving the throw on scope A did not abort the outer `for (const scopePlan of plan.scopes)` loop.
    2. **Single unexpected failure record:** `result.unexpectedPluginFailures.length === 1` AND `result.unexpectedPluginFailures[0]?.scope === "project"` (the throwing scope) AND `result.unexpectedPluginFailures[0]?.plugin === "boom"`.
    3. **Scope B's plugin still installed:** `result.installed` (or the equivalent successful-install bucket) contains an entry with `scope === "user"` and the user-scope plugin's name. Use whatever shape Plan 20-05's WR-02 in-scope test already inspects for the "after" plugin -- read execute.ts to find the canonical bucket if `result.installed` doesn't exist; the canonical predicate is "scope B's plugin appears as `(installed)` in the final cascade message" (assertion 5 below covers this end-to-end).
    4. **Single merged notify() emission:** `notifications.length === 1` -- the final `notify()` fires EXACTLY ONCE for the combined cascade across both scopes, NOT one-per-scope.
    5. **Merged cascade rendering:** The single notification's `message` contains BOTH `⊘ boom (failed) {not in manifest}` (scope A's caught throw) AND a `(installed)` row for scope B's plugin (e.g. `● other (installed)` or whatever name the test selects for the user-scope plugin).

    The test name MUST match the regex `/cross.scope|both.scopes.*continue|selectedScopes.*\bproject.*user\b/i`. Suggested literal name: `importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)`.
  </behavior>
  <action>
Insert ONE new `test(...)` block immediately AFTER the existing WR-02 in-scope test (after the closing `});` at line 507 and BEFORE the `importClaudeSettings classifies uninstallable plugins as warnings` test at line 509). Do NOT modify, duplicate, or delete the existing in-scope WR-02 test.

The new test uses the scope-parameterized `loadSettings: async (scope) => ({...})` pattern from the existing `keeps user and project operations independent` test at line 907. Plugin names per scope: `"boom"` on scope `"project"` (throws), `"other"` on scope `"user"` (succeeds). Marketplace `"mp"` is shared across both scopes via the same `extraKnownMarketplaces` pattern.

Exact test body (use this verbatim, adjusting only to match local lint/prettier formatting):

```ts
test("importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)", async () => {
  // Plan 20-06 WR-02 cross-scope sibling: locks that an unexpected
  // installPlugin throw on scope A does NOT abort the outer
  // for (const scopePlan of plan.scopes) loop. Scope B still runs to
  // completion and a SINGLE merged notify() emits the combined cascade
  // for both scopes (the in-scope sibling at line 429 only covers
  // per-plugin loop continuation within a single scope).
  const { ctx, pi, notifications } = makeCtx();
  const attempted: string[] = [];

  const result = await importClaudeSettings({
    ctx,
    pi,
    cwd: "/tmp/project",
    selectedScopes: ["project", "user"],
    deps: {
      loadSettings: async (scope) => ({
        paths: { basePath: "base", localPath: "local" },
        settings: {
          enabledPlugins: { [`${scope === "project" ? "boom" : "other"}@mp`]: true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        },
        diagnostics: [],
      }),
      loadState: async () => ({
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", raw: "./mp", logical: "./mp" },
            addedFromCwd: "/tmp/project",
            manifestPath: "/tmp/mp/.claude-plugin/marketplace.json",
            marketplaceRoot: "/tmp/mp",
            plugins: {},
          },
        },
      }),
      addMarketplace: async () => undefined,
      installPlugin: async (opts) => {
        attempted.push(`${opts.scope}:${opts.plugin}`);
        if (opts.scope === "project") {
          throw new Error("scope-A host crash");
        }

        return {
          status: "installed",
          resourcesChanged: true,
          declaresAgents: false,
          declaresMcp: false,
        };
      },
    },
  });

  // (1) Outer for (const scopePlan of plan.scopes) loop iterates across the
  // throw: BOTH scopes attempted.
  assert.deepEqual(attempted, ["project:boom", "user:other"]);

  // (2) Only the throwing scope's plugin lands in unexpectedPluginFailures.
  assert.equal(result.unexpectedPluginFailures.length, 1);
  assert.equal(result.unexpectedPluginFailures[0]?.scope, "project");
  assert.equal(result.unexpectedPluginFailures[0]?.plugin, "boom");

  // (3) Final notify() at the end of importClaudeSettings fires EXACTLY
  // ONCE for the combined cascade across both scopes (NOT one-per-scope).
  assert.equal(notifications.length, 1);

  // (4) The single notification renders BOTH scope A's failed row AND
  // scope B's installed row, proving cross-scope merge end-to-end.
  const message = notifications[0]?.message ?? "";
  assert.match(message, /⊘ boom \(failed\) \{not in manifest\}/);
  assert.match(message, /● other \(installed\)/);
});
```

Verify the inserted test parses and passes BEFORE committing:
- `node --test tests/orchestrators/import/execute.test.ts` exits 0
- The new subtest name appears in the output and is marked `ok`

If `result.installed` is not the actual bucket name in the orchestrator's return shape, assertion (4) (the end-to-end cascade-message match) already covers behavior 3 from `<behavior>` -- adjust ONLY if `assert.match(message, /● other \(installed\)/)` fails. Do NOT add brittle structural assertions on bucket names that the WR-02 in-scope test doesn't already use.

Run pre-commit: `pre-commit run --files tests/orchestrators/import/execute.test.ts`. If running from a worktree, prefix git commit with `SKIP=trufflehog`.

Commit message (Conventional Commits, ≤72 char title):
```
test(20): lock cross-scope continuation after installPlugin throw
```
Body (≤80 char lines, optional):
```
Add sibling regression test next to the existing WR-02 in-scope lock-test.
Exercises selectedScopes: ["project", "user"] with installPlugin throwing
on scope A and succeeding on scope B. Asserts (1) both scopes attempted
(outer for-loop iterates across the throw), (2) only the throwing scope's
plugin records in unexpectedPluginFailures, (3) a single merged notify()
emits one cascade for both scopes, and (4) the message contains both the
scope-A failed row and the scope-B installed row.

Closes 20-REVIEW.md (post-closure) WR-02.
```
  </action>
  <verify>
    <automated>node --test tests/orchestrators/import/execute.test.ts 2>&1 | grep -iE "cross.scope|both.scopes.*continue|selectedScopes.*\bproject.*user\b" | grep -c "^ok"</automated>
  </verify>
  <acceptance_criteria>
    - `node --test tests/orchestrators/import/execute.test.ts` exits 0.
    - The new test name appears in the test runner output and matches `/cross.scope|both.scopes.*continue|selectedScopes.*\bproject.*user\b/i` AND is marked `ok` (passing).
    - `grep -c "scope-A host crash" tests/orchestrators/import/execute.test.ts` >= 1 (the new throw message is present).
    - `grep -cE "selectedScopes:\\s*\\[\\s*\"project\"\\s*,\\s*\"user\"\\s*\\]" tests/orchestrators/import/execute.test.ts` >= 1 (the cross-scope param shape is present in at least one test).
    - The existing `ok 7 - importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)` still PASSES (in-scope test untouched).
    - Total `test(` declarations in `execute.test.ts` is exactly ONE more than before the task (delta +1; no duplications).
    - `npm run check` exits 0 (typecheck + ESLint + Prettier + full test suite all GREEN).
    - `git log --oneline -1` shows the new commit with title matching `test(20): lock cross-scope continuation`.
  </acceptance_criteria>
  <done>
    Cross-scope regression test landed as a sibling to the in-scope WR-02 lock-test. Both scopes attempted, single merged notify() asserted, both failed-row and installed-row matched in the message. Full check suite GREEN. No modification to the existing WR-02 in-scope test or any unrelated test. Single Conventional Commit landed with `test(20):` prefix.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary             | Description                                                                                                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| host → installPlugin | Pi runtime invokes `installPlugin` via `executeScopedPlan`. Plan 20-05's WR-02 try/catch (unchanged by this plan) routes unexpected throws into `result.unexpectedPluginFailures` → `errorMessage(err)` → V2 cascade row. This plan adds a regression test asserting the boundary holds across multiple scopes per import. |

## STRIDE Threat Register

| Threat ID   | Category               | Component                                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-20-06-01  | Information Disclosure | `errorMessage(err)` in `executeScopedPlan` catch handler (execute.ts:664, unchanged)     | accept      | This plan does NOT change the catch handler. The existing `errorMessage(err)` helper already strips stack traces and returns a sanitized string; the new cross-scope test asserts the sanitized message round-trips into the cascade row (`⊘ boom (failed) {not in manifest}`), not the raw error.            |
| T-20-06-02  | Tampering              | npm install (no new packages)                                                            | accept      | This plan adds ZERO new dependencies. `package.json` is unchanged. RESEARCH.md `## Package Legitimacy Audit` is not required.                                                                                                                                                                                  |
| T-20-06-SC  | Tampering              | No package-manager install tasks in this plan                                            | accept      | No `npm install`, no `pip install`, no `cargo add`. Standard supply-chain checkpoint not required.                                                                                                                                                                                                             |
| T-20-06-03  | Repudiation            | Comment-only edits in Task 1                                                              | accept      | Comment text is not load-bearing; no behavioral change. All edits are tracked via Conventional Commits (`docs(20):` prefix). Git history preserves auditable trail.                                                                                                                                            |
</threat_model>

<verification>
**Phase-level gates (apply after BOTH tasks complete):**

```bash
# Gate 1: Zero line-anchored citations remain in the three files
grep -nE "execute\.ts:[0-9]+" \
  extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts \
  extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
  tests/orchestrators/import/execute.test.ts
# EXPECTED: empty (exit 1 from grep with no matches)

grep -nE "importClaudeSettings:[0-9]+" \
  extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts \
  extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
  tests/orchestrators/import/execute.test.ts
# EXPECTED: empty (exit 1)

# Gate 2: Function-anchors present
grep -c "executeScopedPlan" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
# EXPECTED: >= 3 (one per named sub-block: state-load, marketplacesToEnsure, pluginsToInstall)

grep -c "end of importClaudeSettings" \
  extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
  tests/orchestrators/import/execute.test.ts
# EXPECTED: >= 3 total across both files

# Gate 3: Cross-scope sibling test exists and PASSES
node --test tests/orchestrators/import/execute.test.ts 2>&1 \
  | grep -iE "cross.scope|both.scopes.*continue|selectedScopes.*\bproject.*user\b"
# EXPECTED: at least one matching line starting with "ok"

# Gate 4: In-scope WR-02 test still PASSES (no regression)
node --test tests/orchestrators/import/execute.test.ts 2>&1 \
  | grep -E "partial cascade row \(WR-02\)"
# EXPECTED: matching line marked "ok"

# Gate 5: Full check suite GREEN
npm run check
# EXPECTED: exit 0; 1364+ pass / 0 fail (one new test added → expect 1365 pass)

# Gate 6: Catalog UAT byte-equality unchanged (sanity)
node --test tests/architecture/catalog-uat.test.ts
# EXPECTED: exit 0; 3/3 pass
```
</verification>

<success_criteria>
- Zero line-anchored `execute.ts:NNN-NNN` and `importClaudeSettings:NNN` citations remain in comments across the three Plan-20-05-modified files (Gate 1 passes; was 4+3 = 7 matches before this plan, must be 0 after).
- Function-anchored comments cite stable identifiers (`executeScopedPlan`'s named sub-blocks + "end of importClaudeSettings") that do not drift on line-shifts (Gate 2 passes).
- One new cross-scope regression test is added next to the existing WR-02 in-scope lock-test; it asserts both scopes attempted, single merged notify() emission, and merged cascade rendering across scopes (Gate 3 passes).
- Existing WR-02 in-scope lock-test still PASSES untouched (Gate 4 passes).
- `npm run check` exits 0 with one additional passing test (Gate 5 passes).
- Catalog UAT byte-equality remains GREEN (Gate 6 passes; sanity check that comment-only edits and a new test did not perturb the V2 renderer).
- Two Conventional Commits landed: `docs(20): function-anchor citations across import path (WR-01)` and `test(20): lock cross-scope continuation after installPlugin throw`. Both ≤72-char titles, body lines ≤80 chars, no `--no-verify`. Worktree-prefix `SKIP=trufflehog` applied if applicable.
- 20-REVIEW.md (post-closure) WR-01 and WR-02 are observably CLOSED by direct codebase inspection. SNM-23 remains SATISFIED (refinement, not new requirement satisfaction).
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-06-SUMMARY.md` after both tasks complete.

The SUMMARY.md MUST record:
- Frontmatter with `phase: 20-migration-wave-3-edge-handlers-usageerror`, `plan: 6`, `requires: [20-05]`, `provides:` (function-anchored citations + cross-scope regression test), `affects:` (the three modified files), `decisions:` (WR-01 Option B locked + WR-02 sibling test landed), `metrics:` (tasks_completed: 2, commits: 2).
- A gap-closure outcome table mapping WR-01 post-closure → CLOSED (Option B) and WR-02 post-closure → CLOSED (cross-scope sibling test).
- Plan-level gate results (the 6 gates above).
- Two commit hashes with their Conventional Commits subjects.
- A self-check section confirming both files contain the expected anchors (no line citations, function-anchors present, new test in place).
</output>
