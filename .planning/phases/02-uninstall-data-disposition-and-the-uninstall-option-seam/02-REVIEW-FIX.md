---
phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam
fixed_at: 2026-09-14T20:05:00Z
review_path: .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 10
skipped: 3
status: partial
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-09-14T20:05:00Z
**Source review:** `.planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 13 (the review's full set)
- Fixed: 10 (WR-01, WR-02, WR-03, WR-06, WR-07, IN-01..IN-05)
- Skipped: 3 (CR-01, WR-04, WR-05 — explicitly out of scope per the operator)

**Verification:** `npm run check` ran in the **main checkout** (`workflow.use_worktrees` is
false for this project; no worktree was created, so the numbers below are reproducible from
the tree as it stands). Exit 0 across typecheck, lint, workflow lint, fallow (dead-code +
health + dupes), Prettier, corresponding-tests, direct-coverage pairs, 6181 unit tests and
32 integration tests. `pre-commit run --files <changed>` was run before every commit and is
clean apart from TruffleHog, whose git-mode scan cannot read this linked worktree's `.git`
file; `trufflehog filesystem` over all 21 changed files reports 0 verified and 0 unverified
secrets.

## Fixed Issues

### WR-01: The `--keep-data` literal is duplicated in the handler and fails open toward deletion

**Files modified:** `extensions/pi-claude-marketplace/edge/flag-catalog.ts`,
`extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts`,
`tests/edge/flag-catalog.test.ts`
**Commit:** `10d4ffc5`
**Applied fix:** Lifted the uninstall entry into a named `KEEP_DATA_FLAG_ENTRY` and exported
`KEEP_DATA_FLAG` from it, mirroring `SCOPE_TARGET_FLAG`; the handler now imports the name
instead of restating it, so a catalog rename is a compile break at the mapping site rather
than a silent deletion of data the operator asked to keep. Added an owner case pinning the
identity relation (`passThroughFlagNames("uninstall")` is exactly `[KEEP_DATA_FLAG]`).

### WR-02: The user-visible top-level help still documents the old uninstall flag set

**Files modified:** `extensions/pi-claude-marketplace/edge/router.ts`,
`tests/architecture/flag-catalog-drift.test.ts`, `tests/edge/router.test.ts`
**Commit:** `da1847f7`
**Applied fix:** `TOP_LEVEL_USAGE`'s uninstall line now reads
`[--scope user|project] [--keep-data] [--local]`, and the byte pin in the router owner moved
with it.

The reviewer's proposed fourth reconciliation ("assert each catalog verb's `complete: true`
names appear in that verb's `TOP_LEVEL_USAGE` line") was **adapted**: asserted as written, it
fails for install, update, list, info and reinstall, none of which document their extra flags
in that block today. Rewriting the whole help block is outside this phase. The gate instead
partitions each verb's completable flags into `documented` and `omitted`, requires the union
to equal the catalog's complete-set exactly, requires every `documented` flag to appear as
`[--flag]` in that verb's line and every `omitted` flag to be absent from it. A newly
catalogued flag is therefore a red test until someone decides which list it belongs in — the
same deliberate-bump discipline the closed-set locks use. Verified by planting: reverting the
router line alone fails the new case with
`TOP_LEVEL_USAGE's "uninstall" line must document --keep-data`.

### WR-03: Consuming and non-consuming scanner modes disagree on a flag in the scope-value position

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts`
**Commit:** `a3d0e7fb`
**Applied fix:** Replaced the comment that denied the divergence with one that states it: what
each mode does with a scope-target token in the `--scope` value position, which downstream
message each produces, and that both modes still strip the token in every other position. The
modes were **not** converged — the two behaviours are pinned by two existing cases, and the
consuming message is the better one; naming the split was the part that was missing.

### WR-06: Both dispositions render byte-identical output, so the irreversible branch is unreported

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`,
`extensions/pi-claude-marketplace/shared/notify-reasons.ts`,
`extensions/pi-claude-marketplace/shared/notification-grammar.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`,
`docs/output-catalog.md`, `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts`,
`tests/architecture/catalog-uat/catalog-contract.test.ts`,
`tests/architecture/catalog-uat/catalog-parser.test.ts`,
`tests/architecture/compat-01-no-expansion.test.ts`,
`tests/architecture/notify-closed-set-locks.test.ts`,
`tests/shared/notification-types.test.ts`, `tests/shared/notification-grammar.test.ts`,
`tests/edge/handlers/plugin/uninstall.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`
**Commit:** `860123d0`
**Applied fix:**

**Token chosen: `data kept`**, rendering as `○ demo v1.0.0 (uninstalled) {data kept}`. The
reasoning behind the wording and placement, since the finding left both to judgement:

- **Wording.** The catalog's reasons are 1-3 lowercase words, and the neighbouring
  command-private members are bare state facts (`not installed`, `plugins remain`,
  `installs disabled`). `data kept` matches that register and echoes the flag the operator
  typed (`--keep-data`), so the row confirms the request in the operator's own words. `data
  preserved` and `data retained` read as prose; `kept data` inverts the subject-first row
  grammar.
- **Placement.** Appended at the tail of `REASONS`, following the precedent the
  `compat-01-no-expansion` gate states in its own failure message ("a new token appends at the
  tail and arrives with its catalog row, renderer arm, and fixture in the same change").
  Render order is moot in practice: the token is the only reason an `(uninstalled)` row can
  carry.
- **Which branch carries it.** The PRESERVING branch only. The destructive branch keeps the
  byte-frozen bare row, so D-02-01's "no separate retained-data report, no path trailer" holds
  and the absence of the brace is what states the destruction. Reconcile's orchestrated
  outcome contract is untouched — it has no command line, so it has no disposition to report.
- **Classification.** Enrolled in `CommandPrivateReason` in `notify-reasons.ts` (uninstall
  owns it, like `not installed`), not in a shared topic group.

Mechanically: `PluginUninstalledMessage` gained an optional `reasons`, `renderUninstalledRow`
threads it (`marketplace remove`'s rows carry none and stay byte-identical), the catalog gained
a `success-keep-data` state with its fixture, and the four closed-set pins
(`REASONS` length 44 to 45, the two enumeration lists, the catalog state count 191 to 192 plus
its byte total) moved in the same change. Handler and orchestrator cases that exercise
`--keep-data` now assert the `{data kept}` row, which also makes a flag that stopped reaching
the orchestrator observable at the edge.

One incidental refactor: the extra conditional spread pushed
`uninstallPluginWithTransaction` to cognitive 16 under fallow's `maxCognitive: 15` (ESLint's
sonarjs still scored it under its own ceiling — the two algorithms disagree, as
CONVENTIONS.md warns). Extracting the row construction into `buildUninstalledRow` returns it
to 14.

### WR-07: A symlinked data directory makes the default disposition throw out of the command handler after the state commit

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`,
`tests/orchestrators/plugin/uninstall.test.ts`
**Commit:** `0cf56ba9`
**Applied fix:** `locations.pluginDataDir(...)` now resolves inside the same `try` that guards
the `rm`, so a `SymlinkRefusedError` on the cleanup path is swallowed like every other
post-commit hygiene outcome (D-19-01). Containment is unchanged — the assertion still fires
before the `rm`, so the escape target is never touched. Added the deleting half of the symlink
fixture the preservation case already plants (`WR-07: deletion over a symlinked data dir is
refused, and the rest of the hygiene still runs`), asserting the `(uninstalled)` row renders,
the symlink and its target survive, and the clone GC that follows the data step still runs.

### IN-01: Handler file header documents the pre-change flag set

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts`
**Commit:** `ea0b51ba`
**Applied fix:** Header now mirrors the `USAGE` string and qualifies the install comparison —
same thin-shim shape, different scanner mode (install passes the array form, uninstall the
consuming form).

### IN-02: `isUnknownFlag`'s allow-list test is unreachable in consuming mode

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts`
**Commit:** `70202638`
**Applied fix:** Split into `isOptionToken` (consuming mode: every accepted flag is already
consumed, so any surviving `-` token is unknown by construction) and `isUnacceptedLongFlag`
(array form: the live allow-list). `rejectionTestFor(flags)` picks one ONCE from the caller's
own flags argument, before the loop, so neither predicate carries a dead term, the scanner's
cognitive complexity is unchanged, and no boolean selector parameter is introduced (an earlier
shape tripped `sonarjs/no-selector-parameter`).

### IN-03: The consuming overload promises a non-optional `consumedFlags` the implementation types as optional

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts`
**Commit:** `ce781277`
**Applied fix:** Took the finding's compile-time option: the consuming return branch carries a
`satisfies` annotation requiring `consumedFlags`, so dropping the field is a TS1360 error at
the branch rather than a runtime `has()` failure at the call site. Verified by planting the
omission (TS1360 fires, as quoted in the commit's verification). No owner-suite pin was added
on top: every consuming case already compares the whole result object including the field.

### IN-04: The NFR-10 comment now sits above a conditional it no longer describes

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
**Commit:** `24bc1a11`
**Applied fix:** Moved the NFR-10 note inside the `if (!keepData)` block it describes and noted
that the preserving branch resolves no name-derived path at all (the marketplace segment is
still asserted by `pluginCacheFile` above it). Superseded in part by WR-07, which rewrote the
note again once the refusal became a caught cleanup outcome.

### IN-05: The cleanup seam's `typeof` contract does not force a double to observe `keepData`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
**Commit:** `f265b1d3`
**Applied fix:** `runPostUninstallCleanup` now takes a `PostUninstallCleanupOptions` bag
(`completionCache`, `locations`, `scope`, `marketplace`, `plugin`, `keepData`), so a double
injected through `UninstallTransaction.runPostCommitCleanup` cannot satisfy the `typeof` seam
while silently ignoring the disposition — TypeScript's fewer-parameters allowance does not
apply to a missing bag field.

## Skipped Issues

### CR-01: Load-time reconcile destroys persistent plugin data with no user action and no opt-out

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:350-358`
**Reason:** D-02-04 explicitly reaffirmed by operator; not a phase defect. The operator was
asked directly whether to revisit the decision and chose to keep it as decided
(`02-CONTEXT.md`: "Omission still deletes data without prompting, including reconcile").
`apply.ts` was not touched and no `keepData` argument was added there.
**Original issue:** `applyPluginUninstalls` calls `uninstallPlugin` without `keepData`, so a
`resources_discover` triggered by a pull, merge, branch switch or hand-edit that drops a plugin
from `claude-plugins.json` silently deletes that plugin's persistent data tree.

### WR-04: The `--keep-data` promise is scoped to one verb; two sibling verbs still hard-delete the same directory

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:615`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts:274-277`
**Reason:** Out of phase scope — touches `marketplace remove` and `reinstall`, not `uninstall`;
log as a backlog candidate instead of fixing here. This phase's requirements are DATA-01..03 on
`uninstall` alone.
**Original issue:** The same data directory is destroyed by three code paths; only `uninstall`
got an opt-out, and nothing states that the other two always discard.
**Note:** the catalog edit made for WR-06 partially addresses the documentation half the
finding offers as its alternative: the `(uninstalled)` token row now records that
`marketplace remove` has no such opt-out and its rows are always bare. The threading of
`keepData` through those two verbs remains open.

### WR-05: Data retained by `--keep-data` has no supported removal path afterwards

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:771-773,793-800`
**Reason:** Out of phase scope — same reasoning as WR-04. Extending removal semantics to other
flows or commands is beyond this phase (D-02-06 also puts retained-data collection outside it).
**Original issue:** After `uninstall --keep-data` removes the record, a second `uninstall`
returns through `emitAlreadyGone` before the cleanup call, so the retained tree can never be
removed by `uninstall`, is invisible to `list`, and is not swept by
`garbageCollectPluginClones`.

## Notes for the reviewer

1. **WR-07 reverses a previously-pinned invariant.** Two cases pinned the OPPOSITE contract —
   `NFR-10: pluginDataDir containment failure PROPAGATES; it is not swallowed as a cleanup
   leak` and the `retry proof` for a refused data-dir escape — with the stated rationale
   "D-19-01 sanctions swallowing the cleanup, not the assertion guarding it." Applying WR-07 as
   written required rewriting both to the new contract (no throw; escape target intact; the
   `(uninstalled)` row still renders; the clone GC after the data step now runs, which it did
   not when the refusal escaped). Containment itself is unaffected — nothing outside the scope
   root is read, written or deleted on that path. **Worth a human confirmation** that trading
   the loud refusal for a silent one is the intended direction, since it is a decision reversal
   rather than a defect repair.
2. **WR-06 narrows D-02-01.** The decision reads "Preserve the current uninstall success
   format; do not introduce a separate retained-data report or path trailer." A reason brace is
   neither of the two named prohibitions and is the house convention for exactly this kind of
   distinction, which is the reviewer's own argument; the destructive default stays byte-frozen.
   The catalog prose was updated to say so rather than left contradicting the code.
3. **Commit title format.** The orchestrator specified `fix({padded_phase}): {id} {description}`
   and all ten commits follow it. Note that `CLAUDE.md` asks commit titles to avoid GSD
   milestone/phase mentions; if the `(02)` scope is unwanted on this branch, the titles are
   local and unpushed.
4. **Pre-existing dirty state** (`.claude/settings.json`, `.codex/config.toml`,
   `.planning/config.json`, `.planning/state.json`, `.claude/CLAUDE.md`, `.codegraph/`,
   `.mcp.json`, `AGENTS.md`, `.planning/milestone.lock`) was left untouched and unstaged.

---

_Fixed: 2026-09-14T20:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
