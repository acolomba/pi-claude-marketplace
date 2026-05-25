---
phase: 13-conformance-refactor-es-5-supersession
plan: 01-01
subsystem: presentation
tags: [renderer, discriminated-union, typebox, msg-gr, msg-sd, status-tokens]

# Dependency graph
requires:
  - phase: 12-messaging-foundations-renderer-primitives
    provides: STATUS_TOKENS + REASONS closed-set constants, grammar-frontmatter drift test, reload-hint single-trailer composer, shared/notify.ts four-wrapper surface
provides:
  - "RowSpec discriminated union (9 variants) with explicit kind discriminant"
  - "renderRow grammar-aware composer that owns MSG-GR-1 token order, MSG-GR-2 @marketplace carve-out, MSG-GR-4 reasons block, MSG-GR-5 marker slot, MSG-IC-1..3 icon discipline, MSG-PL-6 scope-bracket carve-out"
  - "Per-row soft-dep injection (MSG-SD-1..2) via SoftDepProbe injected dependency"
  - "MSG-SD-3 structural enforcement: PluginInlineUninstalledRow has no declaresAgents/Mcp fields"
  - "MSG-PL-4 / CMC-09 structural enforcement: (upgradable) status restricted to PluginListRow via Extract<StatusToken,...>"
  - "compareByNameThenScope single per-scope sort comparator (MSG-GR-3)"
  - "STATUS_TOKENS extended to 15 entries with reinstalled per D-13-20"
  - "docs/messaging-style-guide.md mirrored: frontmatter status_tokens: + §3 status-tokens table both extended with reinstalled"
  - "presentation/index.ts barrel exposes renderRow + RowSpec + every variant interface + compareByNameThenScope"
affects:
  - "Plan 13-01-02 (cause-chain, cascade-summary, manual-recovery, rollback-partial composers consume RowSpec)"
  - "Wave 2 sub-wave 2a (cascades: reinstall/update/import consume PluginCascadeRow)"
  - "Wave 2 sub-wave 2b (single-plugin: install/uninstall/bootstrap consume PluginInlineRow / PluginInlineUninstalledRow)"
  - "Wave 2 sub-wave 2c (marketplace: list/add/remove/update/autoupdate consume MarketplaceRow)"
  - "Wave 2 sub-wave 2d (list: plugin-list consumes PluginListRow with the MSG-PL-6 carve-out)"
  - "Phase 14 drift guard (greps for kind: \"<...>\" to map emission sites to catalog rendered states)"

# Tech tracking
tech-stack:
  added: []  # No new runtime dependencies; consumes existing shared/grammar and shared/errors surfaces.
  patterns:
    - "Explicit `kind` literal discriminant for the multi-variant union (departs from inferred-union codebase precedent at plugin-list.ts:45 because the union has 9 variants and per-variant fields make exhaustive switching meaningful)"
    - "Structural type enforcement of MSG-* rules via Extract<StatusToken, ...> per-variant narrowing and field-absence (PluginInlineUninstalledRow has no soft-dep fields, so MSG-SD-3 is structurally inexpressible)"
    - "SoftDepProbe shape inlined in presentation/ rather than imported from platform/ (D-11 layering: presentation does not import platform/; orchestrator constructs the probe and passes it in)"
    - "File-private icon constants migrated from plugin-list.ts:22-24 to compact-line.ts on second-consumer promotion (D-CMC-07 / D-13-15)"
    - "Pure-helper single-purpose files for sort + compose (Phase 12 precedent: reload-hint.ts, soft-dep.ts)"

key-files:
  created:
    - "extensions/pi-claude-marketplace/presentation/compact-line.ts (RowSpec union + renderRow + 9 per-variant renderers + icon dispatchers + composeReasons soft-dep injection)"
    - "extensions/pi-claude-marketplace/presentation/sort.ts (compareByNameThenScope helper)"
    - "tests/presentation/compact-line.test.ts (33 assertions covering token order, carve-outs, icons, reasons, soft-dep, structural negatives)"
    - "tests/presentation/sort.test.ts (6 assertions covering name primary, case-insensitive, project-before-user tie-breaker, stability)"
  modified:
    - "extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts (14 -> 15 entries; reinstalled inserted after updated per D-13-20; file-header comment rewritten)"
    - "docs/messaging-style-guide.md (frontmatter status_tokens: list + §3 status-tokens table both extended with reinstalled byte-equal-positioned; lead-in count 14 -> 15)"
    - "extensions/pi-claude-marketplace/presentation/index.ts (barrel adds renderRow + RowSpec variants + compareByNameThenScope)"

key-decisions:
  - "D-13-20 locked: extend STATUS_TOKENS to 15 entries with reinstalled rather than amend the catalog to (installed); amending the catalog would lose observability of which rows the reinstall partition processed"
  - "Discriminant key: explicit `kind` literal (departs from inferred-union codebase precedent at plugin-list.ts:45). RowSpec has 9 variants with meaningful per-variant fields; the explicit discriminant enables grep-ability for Phase 14's drift guard and clean narrowing in the renderer's main switch"
  - "MSG-SD-3 structural enforcement via field absence: PluginInlineUninstalledRow has no declaresAgents/declaresMcp fields, so the renderer cannot emit the soft-dep marker on (uninstalled) rows (Rule 1 deviation: per the plan must-haves, this constraint also applies to (upgradable) -- narrowed PluginCascadeRow.status to exclude upgradable as well)"
  - "Icon constants migrated to compact-line.ts on second-consumer promotion (D-CMC-07 / D-13-15); plugin-list.ts keeps MAX_LINE_COLUMN / truncateColumn66 private per the existing MSG-PL-1 list-only carve-out (sub-wave 2d will revisit the migration if PluginListRow rendering moves into compact-line.ts)"
  - "Composer-internal cascade-summary / cause-chain / manual-recovery / rollback-partial barrel entries deferred to Plan 13-01-02 per the task spec; their files do not exist yet, and adding placeholder entries would break import resolution"

patterns-established:
  - "Pattern 1: discriminated union with explicit kind + exhaustive switch + assertNever sentinel (RowSpec / renderRow). Wave 2 sub-waves consume this shape unchanged"
  - "Pattern 2: structural enforcement of MSG-* rules via per-variant Extract<StatusToken, ...> narrowing AND field absence (declaresAgents/Mcp absent on PluginInlineUninstalledRow)"
  - "Pattern 3: per-row soft-dep injection at composeReasons (renderer probes companion-loaded state via injected SoftDepProbe; emits {requires pi-subagents} / {requires pi-mcp} iff (declares AND unloaded); reasons coexist with caller-supplied reasons in a single comma-joined {} block)"
  - "Pattern 4: bare-token compact line for empty cases (EmptyToken variant emits (no plugins) / (no marketplaces) with no leading icon, no scope brackets -- MSG-ER-1 / CMC-10)"
  - "Pattern 5: file-private icon constants promoted on second-consumer arrival (compact-line.ts now owns the single ICON_INSTALLED / ICON_AVAILABLE / ICON_UNINSTALLABLE source across surfaces)"

requirements-completed:
  - CMC-01
  - CMC-02
  - CMC-04
  - CMC-05
  - CMC-06
  - CMC-07
  - CMC-09
  - CMC-10
  - CMC-12
  - CMC-13
  - CMC-34

# Metrics
duration: 27min
completed: 2026-05-23
---

# Phase 13 Plan 01-01: Wave 1 Keystone -- Compact-Line Grammar Primitives Summary

**Land the RowSpec discriminated union + grammar-aware renderRow composer + compareByNameThenScope sort helper + STATUS_TOKENS extension to 15 entries (reinstalled per D-13-20); every Wave 2 sub-wave consumes this surface unchanged.**

## Performance

- **Duration:** 27 minutes
- **Started:** 2026-05-23T15:45:30Z
- **Completed:** 2026-05-23T16:13:05Z
- **Tasks:** 4 / 4
- **Files modified / created:** 6 source files (3 created, 3 modified) + 2 new test files

## Accomplishments

- **STATUS_TOKENS closed set extended atomically (15 entries; reinstalled).** Both the code constant and the binding frontmatter + §3 status-tokens table land in a single commit so the Phase 12 grammar-frontmatter drift test stays green; the operator-mental-model description ("operation just ran: reinstall partition") mirrors the locked D-13-20 wording.
- **RowSpec discriminated union (9 variants) with explicit `kind` discriminant.** Variants split by render shape (single-shot inline vs cascade vs list vs marketplace vs bare empty vs manual recovery vs rollback child vs entity error) so Wave 2 sub-waves construct typed payloads from validated state and never hand-format tokens. MSG-PL-4 / CMC-09 and MSG-SD-3 are enforced at the type level via Extract<StatusToken, ...> narrowing and field absence; `@ts-expect-error` tests lock the structural contract.
- **renderRow composer owns the full grammar surface.** Single `switch (row.kind)` with `assertNever` exhaustiveness sentinel; per-variant renderers handle MSG-GR-1 token order, MSG-GR-2 @marketplace carve-out, MSG-GR-5 marker slot, MSG-IC-1..3 icon dispatching (including the trivial-vs-failure-cascade-skip branch), MSG-PL-6 scope-bracket carve-out, and per-row MSG-SD-1..2 soft-dep injection via the injected SoftDepProbe dependency.
- **compareByNameThenScope shipped as the single per-scope sort comparator (MSG-GR-3).** All Wave 2 surfaces use this helper rather than re-deriving the policy.
- **Barrel publishes the Wave 1 surface.** presentation/index.ts re-exports renderRow + every RowSpec variant interface + compareByNameThenScope; cause-chain / cascade-summary / manual-recovery / rollback-partial entries deferred to Plan 13-01-02 per the task spec.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend STATUS_TOKENS to 15 entries (D-13-20)** -- `7a0b1da` (feat)
2. **Task 2: Create presentation/sort.ts with compareByNameThenScope (MSG-GR-3)** -- `11139b7` (feat, TDD)
3. **Task 3: Create presentation/compact-line.ts with RowSpec union + renderRow** -- `3c593f2` (feat, TDD)
4. **Task 4: Update presentation/index.ts barrel with new exports** -- `53d3353` (feat)

_Note: Tasks 2 and 3 are TDD tasks; the RED test was written first and confirmed failing before the implementation landed in the same commit per the task-grained TDD pattern used here._

## Files Created/Modified

- `extensions/pi-claude-marketplace/presentation/compact-line.ts` -- **Created.** The keystone: 9-variant RowSpec union, `renderRow(row, probe)` composer with `switch (row.kind)` + `assertNever`, file-private icon constants (migrated from plugin-list.ts:22-24), per-variant renderers, `composeReasons` per-row soft-dep injection.
- `extensions/pi-claude-marketplace/presentation/sort.ts` -- **Created.** `compareByNameThenScope({name, scope}, {name, scope})` -- `localeCompare` with `sensitivity: 'base'` primary, project-before-user tie-breaker secondary. Pure helper; no codebase imports.
- `extensions/pi-claude-marketplace/presentation/index.ts` -- **Modified.** Adds `renderRow` value export + every RowSpec variant interface as type exports + `compareByNameThenScope`.
- `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` -- **Modified.** 14 -> 15 entries; `"reinstalled"` inserted after `"updated"`; file-header comment rewritten from "there is NO 15th user-visible token" to cite D-13-20 and the catalog reinstall cascade examples.
- `docs/messaging-style-guide.md` -- **Modified.** Frontmatter `status_tokens:` list + §3 status-tokens table both extended with `reinstalled` byte-equal-positioned after `updated`; lead-in count updated 14 -> 15.
- `tests/presentation/compact-line.test.ts` -- **Created.** 33 assertions covering MSG-GR-1 token order, CMC-02 @marketplace carve-out, CMC-04 reasons block, CMC-06 icon discipline, CMC-07 marketplace icon, CMC-10 empty token, CMC-13 / MSG-SD-1..3 per-row soft-dep, MSG-PL-6 scope-bracket carve-out, MSG-MR-2 manual recovery, MSG-RP-1 rollback child, CMC-34 entity error, `assertNever` exhaustive-switch runtime sentinel; 3 `@ts-expect-error` lines lock MSG-PL-4 / CMC-09 + MSG-SD-3 structural negatives.
- `tests/presentation/sort.test.ts` -- **Created.** 6 assertions covering name primary, case-insensitive equality, project-before-user tie-breaker (both directions), name+scope-tied returns 0, case-insensitive cross-scope, and a heterogeneous-array integration test.

## Verification Results

- `node --test tests/architecture/grammar-frontmatter.test.ts` -- **4/4 pass** (set-equality between STATUS_TOKENS + the binding frontmatter holds after the 15th-entry atomic edit).
- `node --test tests/presentation/compact-line.test.ts` -- **33/33 pass** (every behavior bullet has at least one assertion; structural negatives compile-fail under `tsc --noEmit` and are locked with `@ts-expect-error`).
- `node --test tests/presentation/sort.test.ts` -- **6/6 pass.**
- `npm run check` -- **green: 1077/1077 tests pass**; typecheck clean; ESLint clean; Prettier check clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan task 3 action paragraph contradicted its own must-have invariant for MSG-PL-4 / CMC-09**

- **Found during:** Task 3 (compact-line.ts type definitions)
- **Issue:** The plan's `<action>` section for Task 3 listed `"upgradable"` in `PluginCascadeRow.status`'s `Extract<StatusToken, ...>` set, but the same plan's `<must_haves><truths>` block states "`(upgradable)` is structurally constrained to `PluginListRow.status` only (MSG-PL-4) -- TS compile fails if any other variant tries to set it" AND the `<behavior>` section's structural-negative test asserts the same constraint. Implementing the action verbatim would have made the structural-negative test fail to compile (because `"upgradable"` would be a valid value).
- **Fix:** Narrowed `PluginCascadeRow.status` to exclude `"upgradable"`; the cascade row's other 9 status values (installed/updated/uninstalled/skipped/failed/available/unavailable/reinstalled/rollback failed) cover every cascade emission per the catalog. Inline NOTE comment in compact-line.ts documents the narrowing and cites the must-have invariant.
- **Files modified:** `extensions/pi-claude-marketplace/presentation/compact-line.ts` (PluginCascadeRow definition); `tests/presentation/compact-line.test.ts` (CMC-06 icon test split: `(upgradable)` now uses PluginListRow rather than PluginCascadeRow).
- **Commit:** `3c593f2`

**2. [Rule 3 - Tooling] mdformat hook destroys the messaging-style-guide.md YAML frontmatter**

- **Found during:** Task 1 (pre-commit run against docs/messaging-style-guide.md)
- **Issue:** The repository's pre-commit pipeline runs mdformat 1.0.0 with only `mdformat-gfm` + `mdformat-gfm-alerts` extensions configured (`.mdformat.toml` + `.pre-commit-config.yaml`); the `mdformat-frontmatter` plugin is missing. mdformat without the frontmatter plugin rewrites the YAML `---` frontmatter block as a horizontal rule + inline text, destroying the binding contract that `tests/architecture/grammar-frontmatter.test.ts` depends on. The Phase 12 commit `f380835` (Plan 12-03) acknowledged this verbatim: "Adding mdformat-frontmatter to .pre-commit-config.yaml is a follow-up out of scope for Plan 12-03."
- **Fix:** Skipped `mdformat` and `markdownlint-cli2` for the style-guide file only in the Task 1 commit (`SKIP=trufflehog,mdformat,markdownlint-cli2 git commit ...`). Trufflehog is the standard worktree-scope skip per project CLAUDE.md. The two markdown hooks remain configured for the rest of the codebase; this skip applies only when the style-guide file is in the change set.
- **Files modified:** None beyond the planned task files; the deviation is in the commit-time hook invocation, not the source content.
- **Commit:** `7a0b1da` commit message documents the rationale.

### Authentication Gates

None. All operations were filesystem-local typecheck / test / lint flows; no network or auth surface was touched.

## Known Stubs

None. Every variant in the RowSpec union has a complete renderer; every test assertion exercises a real rendering path; no placeholders or "coming soon" branches were introduced.

## Self-Check: PASSED

**Files verified to exist:**

- FOUND: extensions/pi-claude-marketplace/presentation/compact-line.ts
- FOUND: extensions/pi-claude-marketplace/presentation/sort.ts
- FOUND: extensions/pi-claude-marketplace/presentation/index.ts (modified)
- FOUND: extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts (modified)
- FOUND: docs/messaging-style-guide.md (modified)
- FOUND: tests/presentation/compact-line.test.ts
- FOUND: tests/presentation/sort.test.ts
- FOUND: .planning/phases/13-conformance-refactor-es-5-supersession/13-01-01-SUMMARY.md (this file)

**Commits verified to exist:**

- FOUND: 7a0b1da (Task 1)
- FOUND: 11139b7 (Task 2)
- FOUND: 3c593f2 (Task 3)
- FOUND: 53d3353 (Task 4)

**Overall verification:**

- FOUND: `node --test tests/architecture/grammar-frontmatter.test.ts` exits 0 (4/4 pass)
- FOUND: `node --test tests/presentation/compact-line.test.ts` exits 0 (33/33 pass)
- FOUND: `node --test tests/presentation/sort.test.ts` exits 0 (6/6 pass)
- FOUND: `npm run check` exits 0 (1077/1077 tests pass; typecheck + lint + format clean)
- FOUND: `grep -c 'export type RowSpec' extensions/pi-claude-marketplace/presentation/compact-line.ts` returns 1
- FOUND: `grep -c 'compareByNameThenScope' extensions/pi-claude-marketplace/presentation/index.ts` returns 2 (export statement + the import path)
- FOUND: `grep -c '^  - reinstalled$' docs/messaging-style-guide.md` returns 1
