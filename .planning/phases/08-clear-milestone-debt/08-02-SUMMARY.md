---
phase: 08-clear-milestone-debt
plan: 02
subsystem: reconcile-migration
tags: [mcp-migration, notification-dispatch, output-catalog, amig-01, d-08-05]

requires: []
provides:
  - "`source-outdated` migration row (`McpMigrationSourceOutdatedRow`) naming `/claude:plugin update <plugin>@<marketplace>` for a warm recorded-sha clone with no plugin at the declared path (D-08-05)"
  - "`McpMigrationOperations.readLegacyMcpOwners`: both mcp.json reads go through the operations, and a broken locked re-read gives the `file-unreadable` row"
  - "A throwing project stub probe gives one `unfinished` row per staged owner and keeps their legacy entries"
  - "`notifyMcpMigration` sends notices when a report has no rows"
  - "`printable` escapes `\\p{Cc}`, `\\p{Cf}`, `\\p{Zl}`, `\\p{Zp}` code points per UTF-16 code unit"
  - "D-05-02 amendment (D-08-05) in 05-CONTEXT.md"
affects: [08-04 reinstall mirror fallback (named in the D-05-02 amendment), 08-21 ledger plan]

actuals:
  tokens: 6672
  tasks: 3
  commits: 3
plan_head_before: d652291f9712e49921e531ed2416d03df9696925
plan_head_after: e0187b8bf42ad83f5fd9939cd4797f8cf9518c9e

tech-stack:
  added: []
  patterns:
    - "A Unicode property class regex (`/^[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]$/u`) tested per code point, escaped per code unit"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - tests/orchestrators/reconcile/mcp-migration.test.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - tests/shared/notification-dispatch.test.ts
    - docs/output-catalog.md
    - tests/architecture/mcp-migration-notice.test.ts
    - .planning/phases/05-automatic-migration-on-reload/05-CONTEXT.md

key-decisions:
  - "A warm recorded-sha clone with no plugin at the declared path (`missing-subdir` or `escapes`) gets a new `source-outdated` row whose remedy is `/claude:plugin update`; the resolve's catch arm keeps its two-way choice (D-08-05)"
  - "A failed project stub probe keeps every staged owner's legacy entries with an `unfinished` row, because no owner can tell whether it has a stub (NFR-2, NFR-3)"
  - "A migration report with notices and no rows sends them through `notifyMcpConfigNotices`, one warning per section"

patterns-established:
  - "Migration reads of mcp.json go through `McpMigrationOperations`, like its writes"

requirements-completed: []

coverage:
  - id: D1
    description: "A recorded commit with no plugin at the declared path gives one source-outdated row and no write"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01 / D-08-05: a recorded commit with no plugin at the declared path gives one source-outdated row and no write"
        status: pass
    human_judgment: false
  - id: D2
    description: "The source-outdated row renders the target text and is byte-equal to the catalog block"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#D-08-05: a source-outdated row names an update and sorts by plugin beside a marketplace-unreadable row"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-migration-notice.test.ts#AMIG-03: the mcp-migration-left-in-place notice is byte-equal to its catalog block"
        status: pass
    human_judgment: false
  - id: D3
    description: "A broken locked re-read gives the file-unreadable row; a throwing stub probe gives per-owner unfinished rows"
    requirement: "DEBT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-01: an mcp.json that stops parsing before the locked re-read gives one file-unreadable row and no write"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/mcp-migration.test.ts#AMIG-02: a project stub probe that throws keeps a user owner's legacy entry with an unfinished row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Orphan notices are sent; format characters and separators are escaped; the override fold rule is pinned"
    requirement: "DEBT-02"
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts (305 pass with both architecture locks) and direct coverage 100%"
        status: pass
    human_judgment: false
  - id: D5
    description: "Header documents the one-reload lag; D-05-02 carries the D-08-05 amendment"
    requirement: "DEBT-02"
    verification:
      - kind: other
        ref: "grep -n source-outdated .planning/phases/05-automatic-migration-on-reload/05-CONTEXT.md"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-09
status: complete
---

# Phase 08 Plan 02: Migration remedies and notice fixes Summary

**A git plugin whose recorded commit has no plugin at its declared path now gets a `source-outdated` row naming `/claude:plugin update`. The migration reports a broken re-read and a failed stub probe per cause. The notice sends orphan notices and escapes format characters and line separators.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-10-10T03:01Z
- **Completed:** 2026-10-10T03:18Z
- **Tasks:** 3/3
- **Files modified:** 7

## Findings closed

| Finding  | Disposition | Commit   |
| -------- | ----------- | -------- |
| P5 IN-01 | fixed (header sentence on the one-reload lag) | 70f91bd8 |
| P5 IN-02 | fixed       | e0187b8b |
| P5 IN-03 | fixed       | 70f91bd8 |
| P5 IN-05 | fixed       | e0187b8b |
| P5 IN-06 | fixed       | 70f91bd8 |
| P5 IN-07 | fixed: the warm-clone case gets the `source-outdated` row; the missing-checkout case keeps `marketplace-unreadable`, and the catalog now explains its remedy (remove and add the marketplace again, or uninstall) | 14c70964 |
| P2 IN-01 | fixed (fold-rule case) | e0187b8b |

The D-05-02 amendment (70f91bd8) also names the reinstall fallback for an unreadable mirror HEAD. That code is plan 08-04's work, not this plan's.

## First-wins mutation record (P2 IN-01)

- **Mutation:** in `standingOverrideNotices`, `standing.set(...)` became `if (!standing.has(key)) standing.set(...)`.
- **Mutated run** (`--test-name-pattern="override-kept"`): `ℹ pass 8 / ℹ fail 1`. The only failing case was `AFILE-06: a later override-kept notice for a server replaces the earlier one in its first position`. The older "repeated notice renders once" case still passed, which is why the finding existed.
- **Restored run:** `ℹ pass 9 / ℹ fail 0`. The file was restored from a copy, and the commit carries the unmutated fold.
- A "delete, then set" fold (last position) would also fail the new case, because the case expects the `srv` line before the `other` line.

## Task Commits

1. **Task 1: A moved plugin path gets a source-outdated row that names update** - `14c70964` (feat). Hook: `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed.
2. **Task 2: Report a broken re-read and a failed stub probe per cause, and record the amended D-05-02** - `70f91bd8` (fix). Hook: `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed.
3. **Task 3: Notices without rows, wider printable escaping, and the override fold rule pinned** - `e0187b8b` (fix). Hook: `PRECOMMIT_EXIT=0`; `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1: `mcp-migration.test.ts` + `notification-dispatch.test.ts` + `mcp-migration-notice.test.ts`: `ℹ pass 339 / ℹ fail 0`. `npm run test:coverage:direct -- …/mcp-migration.ts …/notification-dispatch.ts` exited 0. Audit check: `verdict pass introduced-here 0` (exit 0).
- Task 2: `mcp-migration.test.ts` + `apply.test.ts`: `ℹ pass 170 / ℹ fail 0`. `npm run test:coverage:direct -- …/mcp-migration.ts` exited 0.
- Task 3: `notification-dispatch.test.ts` + `mcp-migration-notice.test.ts` + `mcp-config-notices.test.ts`: `ℹ pass 305 / ℹ fail 0`. `npm run test:coverage:direct -- …/notification-dispatch.ts` exited 0. Audit check on the Task 3 tree: `verdict pass introduced-here 0` (exit 0).
- Extra check: `apply.test.ts` + `tests/integration/mcp-migration.test.ts` after Task 3: `ℹ pass 122 / ℹ fail 0`. `apply.ts` is the only caller of `notifyMcpMigration`, and it sends the notices nowhere else, so orphan notices are not sent twice.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## TDD evidence

The project hook runs direct coverage for the staged pairs, so a commit with failing tests cannot pass it. RED was therefore observed locally, and each task has one commit (as the plan's three-commit output states). No separate `test(...)` RED commit exists.

- Task 1 RED: 5 failures. The migration case got `marketplace-unreadable` instead of `source-outdated`, which shows that the seed reaches `missing-subdir`. The dispatch case and the three catalog-lock cases failed because the renderer had no arm for the row.
- Task 2 RED: the re-read case moved both owners (6 operations logged), because the reads did not go through the operations. The stub-probe case ended with EISDIR escaping the scope.
- Task 3 RED: the orphan-notice case and the two escape cases failed. The fold case passed before and after the change, as intended; the mutation above shows that it discriminates.

## Deviations from Plan

**1. [Rule 3 - test setup] The stub-probe case makes the path a directory after the commit, not at seed time**
- **Found during:** Task 2
- **Issue:** The plan says to create a directory at the project `mcp-adapter.json` path in a hermetic project. With that seed, the user-scope stage walks the same config sources and fails first with EISDIR. The owner gets a per-owner `stopped` row, and the stub probe never runs.
- **Fix:** The case wraps `commitPreparedMcp`. After the real commit, it replaces the project `mcp-adapter.json` with a directory. The probe then throws EISDIR, and the case asserts one `unfinished` row (detail `EISDIR: illegal operation on a directory, read 'mcp-adapter.json'`), the log `prepare, commit`, and an unchanged user `mcp.json`. This setup matches the real trigger: the file changes between the stage and the probe.
- **Files:** tests/orchestrators/reconcile/mcp-migration.test.ts. **Commit:** 70f91bd8.

**2. Probe extracted into `ownersWithStubs`**
- I moved the `Promise.all` probe and its catch into a small helper that returns `undefined` after the rows. This keeps `clearProjectStubs` flat for both cognitive-complexity gates and avoids a `let` assigned inside a `try`.

**3. `isControlCodeUnit` replaced by a regex constant, with no wrapper function**
- The plan suggests renaming the helper to `isEscapedCodePoint`. The class test is one regex call, so `printable` calls `ESCAPED_CODE_POINT.test(char)` directly, and a `codeUnitEscapes` helper writes each UTF-16 code unit. An astral `Cf` code point (U+E0001) is written as both surrogates, `󠀁`. A test covers this.

**4. Acceptance grep count for "Amended"**
- `grep -n "Amended" 05-CONTEXT.md` prints three lines, not two. D-05-02 holds two of them (the earlier 2026-10-09 amendment and the new D-08-05 one). The third, at line 164, is an older amendment to a different decision that already existed.

**5. The existing "no row sends nothing, even with config notices" case was replaced**
- That case asserted the behavior that P5 IN-02 changes. Two cases replace it: no rows and no notices send nothing, and notices without rows send their section.

**6. Requirements not marked complete**
- DEBT-02 and DEBT-04 cover the whole phase. The 08-21 ledger plan owns the phase-wide verdicts, so I did not run `requirements.mark-complete`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations: T-08-03 (cases for U+2028, U+2029, U+202E, U+200B and U+E0001 in a moved row and a leftover line), T-08-04 (the orphan-notice case), T-08-05 (the stub-probe case), and T-08-06 (the `source-outdated` row interpolates only the plugin, marketplace and old names through `printable`, and carries no path).

## Self-Check: PASSED

- All seven modified files exist, and commits 14c70964, 70f91bd8 and e0187b8b are ancestors of HEAD.

## Audit follow-up

The phase security audit found a T-08-03 gap. The MCP config notice lines printed `notice.plugin` without escaping. Four of them (override-kept, variables-missing, credentials-blanked, tool-rules-unenforced) also printed `notice.server` without escaping. `assertSafeName` allows U+2028 and U+202E, so a hostile plugin name could end a line or reverse text in a notice. Commit 0717559f (`fix(notify): escape plugin names in MCP config notices`) sends every plugin and server name in the five lines through `printable`. Two new cases in `tests/shared/notification-dispatch.test.ts` failed before the fix and pass after it. They cover the plugin name in the leftover line, and the plugin and server names in the other four lines. The file's 271 tests pass, the catalog lock tests pass 70/70, and the hook's `check:commit` passed. The `names` and `fields` lists are still printed as they come; this fix did not change them.

## Review follow-up

The phase code review narrowed the `source-outdated` row (WR-04, 9003e476):
only `missing-subdir` gets it, and `escapes` now gets the
`marketplace-unreadable` row, because an escaping path fails in every commit.
The row also says "the cached source" instead of naming an installed commit.
