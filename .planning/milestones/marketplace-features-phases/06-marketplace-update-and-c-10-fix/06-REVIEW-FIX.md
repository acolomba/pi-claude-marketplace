---
phase: 06-marketplace-update-and-c-10-fix
fixed_at: 2026-10-19T09:02:28Z
review_path: .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 15
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-19
**Source review:** .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 15 (CR-01, WR-01 through WR-14)
- Fixed: 15
- Skipped: 0

## Verification location

All edits, focused checks, and commits ran in an isolated git worktree
(`.claude/worktrees/rf-06-*` on a temporary `gsd-reviewfix/06-*` branch) whose
`node_modules` was a symlink to this checkout's `node_modules`. The branch was
fast-forwarded into `features/cucumber-behavioral-tests` afterwards, so every
result below is reproducible from this checkout. Every commit passed the
pre-commit hook, including `npm run check:commit`. The full `npm run check` was
not run (left to the orchestrator).

Focused checks run on the final tree:

- `node --test tests/orchestrators/marketplace/update.test.ts tests/orchestrators/marketplace/info.test.ts tests/shared/errors.test.ts`: 248 pass, exit 0
- `npm run test:coverage:direct -- <source>` for `orchestrators/marketplace/update.ts` and `shared/errors.ts`: exit 0
- `node --test tests/integration/reserved-record-keys.test.ts`: 14 pass, exit 0
- `npm run test:cucumber` (whole suite, after the last feature edit): 208 scenarios pass, exit 0
- `npm run check:features`: exit 0
- `npx fallow audit --base ef4a76a3`: exit 0

## Fixed Issues

### CR-01: "autoupdate ignores a newly declared plugin" does not pin what it claims

**Files modified:** `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 1660aab4
**Applied fix:** The case now compares the whole plugin map of the marketplace and the whole notification array.

### WR-01: A corrupt `lastSuccessfulManifest` blocks updates and reports `{network unreachable}`

**Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/shared/errors.test.ts`, `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 25bbb025
**Applied fix:** Fail closed, as the project rule decides. A new `MarketplaceBaselineUnreadableError` is thrown when the saved baseline does not parse. The parse runs before any source read or fetch. `reasonsFromCascadeError` maps it to `{unreadable}`, and the record stays unchanged. There are red-first unit cases for the path, github, and url kinds, with forbidden git ops that prove no fetch. Status: fixed, requires human verification. The cause line wording, "The saved manifest of marketplace "x" in state.json is unreadable.", is user-visible. Recovery still needs `marketplace remove` plus `add`, or a hand edit.

### WR-02: A path-source refresh reads `record.manifestPath` as stored, and legacy records are never repaired

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`, `tests/orchestrators/marketplace/info.test.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 04d1b35d
**Applied fix:** Operator decision, 2026-10-19. Git clones and local path sources are treated alike, because a marketplace is a directory on disk. `add`, `info`, and `update` locate the manifest through one helper, `recordedManifestPath`. `info` shows the recorded manifest file of a file source and the recorded root of a directory source (D-01), and no longer resolves `source.logical` against `addedFromCwd`. Those two fields are provenance only. Legacy records are not supported, so no repair or migration was written, and the clone-path repair in `update` was removed with its legacy-only unit case. This also resolves IN-02.

### WR-03: A legacy git record with an invalid on-disk manifest still cannot recover

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/update.test.ts`
**Commit:** b3b6ed0d
**Applied fix:** `manifestContentKey` maps every pre-fetch read failure to "no comparison", as D-07 requires. The fetched manifest is still validated. A new red-first case shows a repaired fetch now reports `(updated)` and saves the baseline. The old WR-02 case still fails when the manifest stays corrupt, and its comment was corrected. Status: fixed, requires human verification (logic change).

### WR-04: The comparison scenarios keep their point in step code, through two identical steps

**Files modified:** `features/marketplace/update.feature`, `features/step_definitions/marketplace/update.steps.ts`, `features/step_definitions/marketplace/publishing.steps.ts`
**Commit:** 286d1e7a
**Applied fix:** The scenarios now state both manifests as doc strings. A new `the marketplace {string} publishes this manifest:` step sets the manifest before the add, and the existing `update source contains this manifest:` step sets it after. In outlines, the JSON comes from Examples cells, with `\n` escapes for line breaks. `COMPARISON_FIXTURES` and the three fixture steps were deleted. The IN-03 lookup message went away with the fixtures.

### WR-05: Kind-agnostic update behaviors run only the `dir` kind

**Files modified:** `features/marketplace/update.feature`
**Commit:** 34a18ce3
**Applied fix:** All five scenarios are now outlines over `<source kind>`, with dir and file rows and tagged url and github blocks. In "A bare update continues after a marketplace fails", only the failing marketplace varies its kind. The url and github rows are not run until their stand-ins land. Their cause chains (`Marketplace "zeta" clone advanced but manifest could not be persisted., ...`) and sources come from reading the code and are not verified.

### WR-06: The "has failed as invalid manifest" Given asserts with `assert.ok` and `includes`

**Files modified:** `features/step_definitions/marketplace/update.steps.ts`
**Commit:** f5700c91
**Applied fix:** The Given now compares only severity `error` and the marketplace's `failed` status with reasons `[["invalid manifest"]]`. The full failure payload, including the cause chain, is already compared through the Then tables of the "An invalid refreshed manifest leaves installed plugins unchanged" outline, so no new scenario was added.

### WR-07: Fourteen Gherkin tables are misaligned

**Files modified:** `features/marketplace/update.feature`, `features/marketplace/file-source-update.feature`, `features/marketplace/info.feature`
**Commit:** c206b081
**Applied fix:** Every misaligned table in the three files was re-padded, including the older `info.feature` tables at lines 130 and 143. The change is whitespace only: `git diff -w` is empty. A display-width check now finds no misaligned table in any `.feature` file.

### WR-08: The `ownedTarget` guard accepts the parent of the published root

**Files modified:** `features/lib/published-marketplace.ts`
**Commit:** 59e215b2
**Applied fix:** The guard now also rejects `relative === ".."`, and it no longer exempts the empty relative path from the absolute-path check.

### WR-09: The rows step now skips MCP notices silently

**Files modified:** `features/support/world.ts`, `features/step_definitions/command.steps.ts`, `.agents/skills/cucumber/rules/steps.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 8237a74b
**Applied fix:** The world now records the MCP config notice results of each `When`. `the command reports these results:` marks them compared through `markNoticesCompared()`. A scenario that leaves a notice uncompared fails at its next `When` or when it ends, the same way uncompared rows fail. A mutation check (removing the mark call) failed the notice scenario as expected. The cucumber rules name the second Then-side world write.

### WR-10: The unreadable-skill Given never checks that the file is unreadable

**Files modified:** `features/lib/published-marketplace.ts`, `features/step_definitions/marketplace/update.steps.ts`
**Commit:** a6a22303
**Applied fix:** `publishUnreadableSkillFile` now returns the file path. The Given asserts that `readFile` rejects with `EACCES`.

### WR-11: Data rows are looped inside one test case

**Files modified:** `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 8274e4c7
**Applied fix:** Each row now has its own sibling case, `semantic comparison reports <title> as updated`, with a fresh hermetic home.

### WR-12: The D-01 info cases build the expected path with production-shaped conditional logic

**Files modified:** `tests/orchestrators/marketplace/info.test.ts`
**Commit:** c40dcda5
**Applied fix:** Each row carries an `expectedPath(cwd, home)` built with `path.join`. The conditional tilde expansion in the loop body is gone.

### WR-13: Partial notification checks and an assertion inside "act" in new update cases

**Files modified:** `tests/orchestrators/marketplace/update.test.ts`
**Commit:** 372c66d1
**Applied fix:** The invalid-manifest rows and the missing-source case now compare the whole `{ message, severity }` arrays. The invalid-manifest and failed-save cases capture `callsAfterFailure` and assert it in the assert phase. The failed-save case now also compares the whole notification (commit 31ee314d).

### WR-14: (out-of-phase) An integration test edits the baseline in `state.json` to keep its old expectation

**Files modified:** `tests/integration/reserved-record-keys.test.ts`
**Commit:** 48ada852
**Applied fix:** The test no longer edits `state.json` and no longer imports `saveState`. It now expects `● mp [project] (updated)` from the real flow: add at 1.0.0, publish 1.1.0, then `marketplace update`.

## Skipped Issues

None.

## Follow-ups found while fixing

- Resolved (operator decision, 2026-10-19, commits ea3bfed1 and 31ee314d): A state-save failure during `marketplace update` rendered `{network unreachable}` (found in WR-13). A local state-save failure now renders a failed row with no reason and prints its cause chain. Errno codes are not mapped on the save path, because only a refresh failure is classified. A held state lock renders `{lock held}`, as autoupdate does. ENOENT/ENOTDIR as `{source missing}`, and the transport classifications, stay on the refresh-read path. `{network unreachable}` is kept for connection failures. An HTTP answer from the git host other than 401/403 renders the new reason `{network error}`, and the first frame of the cause line names the status and the URL. The fallback reason was removed, so a failure no rule classifies carries no reason. UPD-11 and Phase 9's success criterion 3 now expect `{network error}` with the status and URL.

---

_Fixed: 2026-10-19_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
