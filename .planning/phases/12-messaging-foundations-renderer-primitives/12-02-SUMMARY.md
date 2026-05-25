---
phase: 12-messaging-foundations-renderer-primitives
plan: 02
subsystem: messaging
tags: [messaging, reload-hint, presentation, callsite-migration, MSG-RH-1, D-CMC-06, D-CMC-07, D-CMC-08, D-CMC-10]

# Dependency graph
requires:
  - phase: 12-01
    provides: shared/grammar/ closed-set constants (independent of this plan but same Phase 12 baseline)
  - phase: 12-03
    provides: docs/messaging-style-guide.md §14.1 wording landed (independent of this plan but same Phase 12 baseline)
  - phase: 12-04
    provides: shared/notify.ts CMC-19 inventory affirmation (independent of this plan but same Phase 12 baseline)
provides:
  - "presentation/reload-hint.ts single-trailer composer with file-private RELOAD_HINT_TRAILER const (D-CMC-07)"
  - "presentation/index.ts barrel without ReloadVerb re-export"
  - "8 orchestrator callsites migrated to the 1-arg signature"
  - "tests/presentation/reload-hint.test.ts rewritten to 5 assertions matching the new contract"
  - "Integration test fixtures across install / uninstall / update / reinstall / marketplace remove + update / import (e2e + execute) brought into conformance with the new trailer"
  - "presentation/README.md synchronized with the new composer behavior"
  - "CHANGELOG.md Unreleased entry citing the D-CMC-10 carve-out (binding per W-1 / Task 2 acceptance criterion)"
affects: [phase-13-mechanical-refactor, phase-13-MSG-RH-1-blank-line-conformance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-private trailer-literal const (D-CMC-07) analog of the MAX_LINE_COLUMN private-const idiom in presentation/plugin-list.ts:30 -- one-consumer literal does not earn extraction"
    - "Atomic typecheck-breaking signature change: composer rewrite + barrel edit + all callsite migrations + all integration-test fixture updates land in a single commit so `npm run check` stays green at every history step"
    - "Stale verb-comment cleanup as part of the callsite edit (research §2.3 cleanliness concern), so the reviewer diff is self-consistent"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/presentation/reload-hint.ts
    - extensions/pi-claude-marketplace/presentation/index.ts
    - extensions/pi-claude-marketplace/presentation/README.md
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - tests/presentation/reload-hint.test.ts
    - tests/e2e/import-command.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - CHANGELOG.md

key-decisions:
  - "Combined Task 1 (test rewrite) and Task 2 (composer + barrel + 8 callsites + fixture updates) into a single atomic commit (cca874f). The plan's `must_haves.truths` explicitly requires this: 'the signature change is type-level breaking, so all 8 callsites + test rewrite + barrel edit MUST land atomically'. A separate Task 1 RED commit would have left `npm run typecheck` red between commits because `reloadHint([])` cannot satisfy the legacy 2-arg signature."
  - "Updated 12 integration-test fixtures (install / uninstall / update / reinstall / marketplace remove + update / import e2e + execute) to assert the new trailer `/reload to pick up changes`. The plan's `files_modified` frontmatter listed only `tests/presentation/reload-hint.test.ts` but the `<verification>` block binds `npm run check` to green. The D-CMC-10 carve-out explicitly authorizes the user-visible trailer change, so the integration fixtures are coupled to the wording and MUST update with it. Documented as a Rule 3 (auto-fix blocking) under Deviations."
  - "Updated stale verb-comments at each callsite (uninstall.ts:235 'verb \"drop\"', update.ts:730 'verb \"refresh\"', marketplace/remove.ts:276 'verb \"drop\"') to MSG-RH-1 language. Plan `<action>` block called this a cleanliness concern, not mandatory; doing it inline preserves diff self-consistency."
  - "Updated `presentation/README.md` Purpose paragraph and `Planned Contents` reload-hint bullet to reflect Phase 12's composer collapse. The README's `Allowed Imports` rule about ES-5 prefix-string consumption is unchanged (still valid for the 5 ES-5 markers that stay in shared/markers.ts under D-CMC-08)."
  - "CHANGELOG.md `[Unreleased] - v1.3 Phase 12 messaging foundations` entry created with the D-CMC-10 carve-out citation: contains the literal strings 'D-CMC-10', 'roadmap criterion #2 authorizes', and '8 reload-hint callsite trailers now emit /reload to pick up changes; Phase 12 carve-out per D-CMC-10' (binding per Task 2 acceptance criterion / W-1)."
  - "Reverted out-of-scope pre-commit auto-edits (Unicode-dash normalization) on .planning/12-01-SUMMARY.md, .planning/12-03-SUMMARY.md, .planning/12-CONTEXT.md, .planning/12-DISCUSSION-LOG.md, and docs/messaging-style-guide.md. Those normalizations were artifacts of `pre-commit run --files` against pre-existing em-dashes in dependency artifacts; this plan must not modify them per scope_carve_outs."

patterns-established:
  - "MSG-RH-1 conformance: composer outputs the literal canonical trailer `/reload to pick up changes` on non-empty names; names are checked for non-emptiness only and are NOT interpolated into the trailer (a deliberate regression in user-data exposure from the legacy quoted-names form)"
  - "D-CMC-07 trailer-literal locality: when a Phase 12-introduced literal has exactly one consumer in presentation/, it lives as a file-private const in that consumer (not in shared/markers.ts, not in shared/grammar/)"
  - "Integration-test fixture coupling: when a user-contract wording changes under a roadmap-authorized carve-out, the integration tests that pin the old wording MUST be updated in the same commit -- the plan's `npm run check green` binding forces this even when the test file is not on the `files_modified` list"

requirements-completed: [CMC-14]

# Metrics
duration: ~16m
completed: 2026-05-22
---

# Phase 12 Plan 02: Reload-hint composer collapse + 8 callsite migration Summary

**Collapsed `reloadHint` to the single canonical trailer `/reload to pick up changes` (style guide MSG-RH-1), retired the three-verb selector, migrated all 8 orchestrator callsites and 12 integration-test fixtures in one atomic typecheck-breaking edit; npm run check is green (1038/1038 tests).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-22T21:29:00Z
- **Completed:** 2026-05-22T21:45:00Z
- **Tasks:** 2 (collapsed into 1 atomic commit per the plan's MUST-land-atomically truth)
- **Files modified:** 21 (1 composer + 1 barrel + 1 README + 7 orchestrator callsites + 1 plan-specified test + 9 integration-test fixtures + 1 CHANGELOG)

## Accomplishments

- `presentation/reload-hint.ts` is now a ~20-line file exporting `reloadHint(names: readonly string[]): string` returning `RELOAD_HINT_TRAILER` (`"/reload to pick up changes"`) or `""`; `ReloadVerb` deleted; `RELOAD_HINT_PREFIX` import dropped. `appendReloadHint(body, hint)` body unchanged with a Phase 13 TODO citing MSG-RH-1's blank-line-above requirement.
- `presentation/index.ts` barrel no longer re-exports `ReloadVerb`; value re-exports for `reloadHint` and `appendReloadHint` intact.
- All 8 reloadHint callsites migrated to the 1-arg signature (`install.ts:690`, `uninstall.ts:237`, `update.ts:731`, `reinstall.ts:372`, `reinstall.ts:871`, `marketplace/update.ts:358`, `marketplace/remove.ts:278`, `import/execute.ts:339-341`). Stale "verb 'load'/'refresh'/'drop'" comments updated to MSG-RH-1 language inline.
- `tests/presentation/reload-hint.test.ts` rewritten to exactly 5 assertions: 3 `MSG-RH-1: ...` composer tests (empty / single / multi) + 2 `appendReloadHint: ...` tests (suppression / join). No remaining references to `ReloadVerb`, verb-literal first-args, or `RELOAD_HINT_PREFIX`.
- 9 integration-test fixtures updated to assert the new trailer `/reload to pick up changes` in place of the legacy `Run /reload to <verb> "..."`: `tests/orchestrators/{plugin,marketplace,import}/*.test.ts` plus `tests/e2e/import-command.test.ts`.
- `presentation/README.md` Purpose paragraph and Planned Contents reload-hint bullet rewritten to reflect Phase 12's composer collapse.
- `CHANGELOG.md` `[Unreleased] - v1.3 Phase 12 messaging foundations` entry created with the D-CMC-10 carve-out citation (binding per Task 2 acceptance criterion).
- D-CMC-08 retention preserved: `RELOAD_HINT_PREFIX` in `shared/markers.ts` and the byte-equality assertion in `tests/architecture/markers-snapshot.test.ts` are byte-untouched. Phase 13's atomic three-file edit will delete the constant, the snapshot row, and the PRD §6.12 row in one commit.
- `npm run check` green at end of plan: typecheck + ESLint + Prettier + 1038/1038 tests pass.

## D-CMC-10 Carve-Out

**This plan does change user-visible output in 8 places beyond `migrate.ts` -- a deliberate carve-out authorized by Roadmap Phase 12 Success Criterion #2 ("the three-verb selector is gone from `presentation/reload-hint.ts`").**

Roadmap Phase 12 Success Criterion #4 says "user-visible output is unchanged except for the single migrate.ts diagnostic." Removing the verb selector from the composer (Criterion #2) structurally requires the trailer to change wherever the composer is called. The two criteria are read together: criterion #2 specifies WHAT changes (the composer's contract), and criterion #4 specifies WHAT ELSE does NOT change (the rest of the user-visible surface area -- Phase 13 owns the per-command catalog conformance).

Concrete user-visible impact across 8 surfaces (the 8 reloadHint callsites):

- `install` -- old `Run /reload to load it.` -> new `/reload to pick up changes`
- `uninstall` -- old `Run /reload to drop it.` -> new `/reload to pick up changes`
- `update` (single + cascade) -- old `Run /reload to refresh it.` / `Run /reload to refresh "a", "b".` -> new `/reload to pick up changes`
- `reinstall` (single + cascade) -- old `Run /reload to refresh it.` / `Run /reload to refresh "a", "b".` -> new `/reload to pick up changes`
- `marketplace update` -- old `Run /reload to refresh "a", "b".` -> new `/reload to pick up changes`
- `marketplace remove` -- old `Run /reload to drop "a", "b".` -> new `/reload to pick up changes`
- `import` -- old `Run /reload to load "a", "b".` -> new `/reload to pick up changes`

CHANGELOG.md `[Unreleased]` entry cites this carve-out so a reviewer reading criterion #4 in isolation does not mis-read the diff as a roadmap violation. The CHANGELOG entry contains the literal strings `D-CMC-10`, `Phase 12 carve-out per D-CMC-10`, `roadmap criterion #2 authorizes`, and `8 reload-hint callsite trailers now emit /reload to pick up changes` -- satisfying the structural ship-gate.

Phase 13's mechanical refactor scope owns all other user-visible-output conformance (per-command catalog rendering, blank-line-above for the reload hint, MSG-CC-1 cause-chain rewrite); none of that surface area is touched in this plan.

## Task Commits

The plan defined Task 1 (test rewrite, RED) and Task 2 (composer + barrel + callsites, GREEN). Per the plan's `must_haves.truths` ("the signature change is type-level breaking, so all 8 callsites + test rewrite + barrel edit MUST land atomically") and the worktree parallel-execution guidance, both tasks landed in a single atomic commit:

1. **Task 1 + Task 2 (atomic): Collapse reload-hint to single canonical trailer (MSG-RH-1)** -- `cca874f` (feat) -- composer rewrite, barrel edit, 8 callsite migrations, plan-specified test rewrite, 9 integration-test fixture updates, README sync, CHANGELOG D-CMC-10 citation.

_Note on TDD shape: a separate Task 1 RED commit would have left `npm run typecheck` red between commits, because `reloadHint([])` (the new test's invocation) does not type-check against the legacy 2-arg signature. The plan explicitly forbids that mid-plan red state (NFR-6). The composer, barrel, all callsites, and the test rewrite all participate in the same type-level boundary; they must move together._

## Files Created/Modified

### Modified (21 files)

**Composer + barrel + docs (3):**

- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- full file replacement (~52 lines): header rewrites cite CMC-14 / MSG-RH-1 / D-CMC-06 / D-CMC-07 / D-CMC-08; new `RELOAD_HINT_TRAILER` private const; new 1-arg `reloadHint(names: readonly string[]): string`; `ReloadVerb` type deleted; `RELOAD_HINT_PREFIX` import dropped; `appendReloadHint` body unchanged with a Phase 13 TODO comment.
- `extensions/pi-claude-marketplace/presentation/index.ts` -- single-line deletion of `export type { ReloadVerb } from "./reload-hint.ts";`; value re-exports unchanged.
- `extensions/pi-claude-marketplace/presentation/README.md` -- Purpose paragraph rewritten to cite the new MSG-RH-1 trailer and note the Phase 12 retirement of the verb form; Planned Contents reload-hint bullet checked off with a Phase 12 note.

**Orchestrator callsites (7):**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- line 690: drop `"load",`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- line 237: drop `"drop",`; comment block at lines 234-236 reworded to MSG-RH-1.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- line 731: drop `"refresh",`; comment at line 730 reworded.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- lines 372 and 871: drop `"refresh",`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- line 358: drop `"refresh",`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- line 278: drop `"drop",`; comment block at lines 276-277 reworded.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- lines 339-345: multi-line callsite collapsed to a single-argument call (the `"load",` line and its trailing comma dropped; the names-expression fits on one line of acceptable width).

**Tests (10):**

- `tests/presentation/reload-hint.test.ts` -- full file rewrite (~31 lines): 5 assertions (3 MSG-RH-1 composer cases + 2 appendReloadHint cases); no `ReloadVerb`, no verb-literal first-args, no `RELOAD_HINT_PREFIX` import.
- `tests/orchestrators/plugin/install.test.ts` -- two assertions migrated.
- `tests/orchestrators/plugin/uninstall.test.ts` -- three assertions migrated (two `assert.match`, one inverse `includes`).
- `tests/orchestrators/plugin/update.test.ts` -- four assertions migrated.
- `tests/orchestrators/plugin/reinstall.test.ts` -- four assertions migrated.
- `tests/orchestrators/marketplace/update.test.ts` -- four assertions migrated; test name updated.
- `tests/orchestrators/marketplace/remove.test.ts` -- two assertions migrated; test name updated.
- `tests/orchestrators/marketplace/add.test.ts` -- one inverse assertion migrated.
- `tests/orchestrators/import/execute.test.ts` -- two assertions migrated; test name updated.
- `tests/e2e/import-command.test.ts` -- one assertion migrated.

**CHANGELOG (1):**

- `CHANGELOG.md` -- new `[Unreleased] - v1.3 Phase 12 messaging foundations` entry citing the D-CMC-10 carve-out (binding per Task 2 acceptance criterion).

## Decisions Made

See `key-decisions` frontmatter list above for the substantive choices. The locking decisions D-CMC-06, D-CMC-07, D-CMC-08, D-CMC-09, D-CMC-10 from the plan were honored without deviation; the executor's discretionary calls were (a) combining Task 1 + Task 2 into one commit (mandatory per `must_haves.truths`), (b) including 9 integration-test fixture updates beyond the plan's `files_modified` list because the D-CMC-10 carve-out's user-visible trailer change couples those fixtures to the wording (without these updates `npm run check` would have been red on 12 tests), (c) updating stale verb-comments inline at each callsite, (d) updating `presentation/README.md` to reflect the new composer behavior, and (e) reverting the pre-commit Unicode-dash auto-edits on out-of-scope `.planning/` artifacts and the style guide.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 9 integration-test fixtures to assert the new trailer**

- **Found during:** verification (`npm test`) after Task 2 source edits landed.
- **Issue:** The plan's `files_modified` frontmatter listed only `tests/presentation/reload-hint.test.ts`, but `npm run check` is a binding verification gate, and 12 integration tests across 9 files were pinned to the legacy `Run /reload to <verb> "..."` trailer (e.g., `assert.match(notifications[0]?.message ?? "", /Run \/reload to drop it\.$/)`). Without updating those fixtures, `npm run check` failed and the plan's `<verification>` block could not be satisfied.
- **Fix:** Migrated each assertion to the new trailer literal `/reload to pick up changes`. Updated the affected test names to drop the legacy `RH-1 / RH-2` ID and use `MSG-RH-1` where they referenced the wording. Updated inverse `includes("Run /reload")` checks to `includes("/reload to pick up changes")` so the assertion intent matches the new trailer.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `tests/orchestrators/plugin/update.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/marketplace/remove.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/import/execute.test.ts`, `tests/e2e/import-command.test.ts`.
- **Verification:** All 1038 tests pass; `grep -rE "Run \\\\/reload to (load|refresh|drop)" tests/ extensions/` returns 0 matches.
- **Committed in:** `cca874f` (same atomic commit).

**2. [Rule 2 - Critical] Updated `presentation/README.md` to reflect the new composer**

- **Found during:** Task 2 source edits.
- **Issue:** `presentation/README.md` Purpose paragraph (line 5) and Planned Contents reload-hint bullet (line 15) described the composer's behavior as `Run /reload to <verb> "n1", "n2", ...".` -- a documentation surface that now contradicts the source code.
- **Fix:** Rewrote the Purpose paragraph to cite the MSG-RH-1 canonical trailer and note Phase 12's retirement of the verb form; checked off the Planned Contents bullet with a Phase 12 reference. The `Allowed Imports` rule about ES-5 prefix-string consumption is unchanged (still applies to the 5 ES-5 markers under D-CMC-08).
- **Files modified:** `extensions/pi-claude-marketplace/presentation/README.md`.
- **Verification:** `grep -F "/reload to pick up changes" extensions/pi-claude-marketplace/presentation/README.md` returns a match.
- **Committed in:** `cca874f` (same atomic commit).

**3. [Rule 3 - Blocking] Reverted pre-commit Unicode-dash auto-edits on out-of-scope files**

- **Found during:** running `pre-commit run --files` before the commit.
- **Issue:** The `Fix Unicode dash characters` pre-commit hook auto-rewrote em-dashes (`--`) to `--` ASCII in `.planning/phases/12-messaging-foundations-renderer-primitives/12-01-SUMMARY.md`, `.planning/.../12-03-SUMMARY.md`, `.planning/.../12-CONTEXT.md`, `.planning/.../12-DISCUSSION-LOG.md`, and `docs/messaging-style-guide.md`. Those files are explicitly out of scope for this plan (scope_carve_outs: `docs/messaging-style-guide.md` is Plan 12-03's surface; the `.planning/` artifacts are owned by prior plans).
- **Fix:** Used `git checkout -- <file>` (sanctioned by destructive_git_prohibition for specific-file reverts) to discard the unintended changes before staging the commit. Re-verified `git status --short` showed only the in-scope files.
- **Verification:** `git diff --name-only HEAD -- docs/messaging-style-guide.md .planning/phases/12-messaging-foundations-renderer-primitives/12-01-SUMMARY.md .planning/.../12-03-SUMMARY.md .planning/.../12-CONTEXT.md .planning/.../12-DISCUSSION-LOG.md` returns empty.

---

**Total deviations:** 3 auto-fixed (2× Rule 3 blocking; 1× Rule 2 critical documentation sync). No Rule 4 (architectural) deviations; no checkpoint required. All three deviations stay within the plan's stated scope (test-fixture coupling to the D-CMC-10 carve-out is structurally implied; the README documentation sync is an obvious correctness adjacent edit; the pre-commit auto-revert defends the plan's scope_carve_outs).

## Issues Encountered

- **Trufflehog hook failed in worktree:** Same known sandbox issue documented across prior Phase 12 plans -- `trufflehog` cannot open `.git/index` because in a Claude Code worktree, `.git` is a file (a gitlink) not a directory. Per project CLAUDE.md, the sanctioned worktree workaround is to prefix the commit with `SKIP=trufflehog`. The underlying scan (run from a non-worktree context) is clean for this diff -- it contains only text changes in known-tracked files, no secrets, no new opaque blobs.
- **Pre-commit hooks ran on non-staged files:** `pre-commit run --files <list>` ran the Unicode-dash-normalizer hook against the explicitly listed files but those files included none of the out-of-scope `.planning/` artifacts. The hook silently modified files outside the `<list>` because pre-commit's filesystem scope includes the whole repo for those normalizer hooks. Reverted with `git checkout --` on the specific affected paths.

## User Setup Required

None -- no external service configuration required.

## Threat Flags

None -- the new trailer is a fixed literal with NO name interpolation. The composer EMITS LESS user data than the old form (which interpolated quoted plugin/marketplace names into the trailer). The threat-model dispositions in the plan (`T-12.02-01..03`) are all satisfied:

- T-12.02-01 (Information Disclosure): the new trailer is a fixed literal; no plugin names emitted.
- T-12.02-02 (Tampering / RELOAD_HINT_PREFIX retention): `grep "RELOAD_HINT_PREFIX" extensions/pi-claude-marketplace/shared/markers.ts` returns the export line; the constant value is byte-identical to `"Run /reload to "`. No optional `// D-CMC-08: do-not-delete` comment was added (the verification gate is satisfied by the markers-snapshot test which is byte-untouched; the R1 mitigation was marked OPTIONAL in the plan).
- T-12.02-03 (Denial of Service / missed callsite): `grep -rE "reloadHint\(\"(load|refresh|drop)\"" extensions/pi-claude-marketplace/` returns 0 matches; typecheck would have caught any missed callsite (signature is type-level breaking).

## Self-Check: PASSED

All claims verified:

- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- FOUND; contains `const RELOAD_HINT_TRAILER = "/reload to pick up changes";` and `export function reloadHint(names: readonly string[]): string`; does NOT contain `ReloadVerb` or `RELOAD_HINT_PREFIX` import.
- `extensions/pi-claude-marketplace/presentation/index.ts` -- FOUND; does NOT contain `ReloadVerb`; still exports `appendReloadHint, reloadHint`.
- `tests/presentation/reload-hint.test.ts` -- FOUND; exactly 5 `test(` invocations; 3 `MSG-RH-1` entries; 5 `appendReloadHint` mentions; no `ReloadVerb` / verb-literal / `RELOAD_HINT_PREFIX`.
- `grep -rE "reloadHint\\(\"(load|refresh|drop)\"" extensions/` -- 0 matches.
- `grep -rF "ReloadVerb" extensions/` -- 0 matches.
- 8 reloadHint callsites distributed across 7 orchestrator files (install / uninstall / update / reinstall [twice] / marketplace/update / marketplace/remove / import/execute).
- `grep "RELOAD_HINT_PREFIX" extensions/pi-claude-marketplace/shared/markers.ts` -- returns the export line with value `"Run /reload to "` (D-CMC-08 retention not regressed).
- `git diff --name-only HEAD~1 HEAD -- eslint.config.js` -- empty (CMC-37 discipline preserved).
- `git diff --name-only HEAD~1 HEAD -- docs/messaging-style-guide.md` -- empty (Plan 12-03 owns it; pre-commit auto-edit reverted).
- `git diff --name-only HEAD~1 HEAD -- tests/architecture/markers-snapshot.test.ts` -- empty (snapshot test not touched).
- `grep -F "D-CMC-10" CHANGELOG.md` -- matches the new Unreleased entry (binding citation present).
- `grep -F "8 reload-hint callsite trailers now emit /reload to pick up changes; Phase 12 carve-out per D-CMC-10" CHANGELOG.md` -- matches verbatim in the new Unreleased entry.
- `grep -F "roadmap criterion #2 authorizes" CHANGELOG.md` -- matches verbatim.
- `npm run check` -- exits 0 (typecheck + ESLint + Prettier + 1038 tests pass).
- Commit `cca874f` -- FOUND in `git log` with the title `feat(12-02): collapse reload-hint to single canonical trailer (MSG-RH-1)`.

## Next Phase Readiness

- **Plan 12-05 (if any) / wave 2 sibling plans:** unblocked; this plan's atomic commit leaves the worktree typecheck-green for any downstream wave-2 plan to layer onto.
- **Phase 13 mechanical refactor:** inherits a single-trailer composer; the MSG-RH-1 blank-line-above conformance (currently a TODO in `appendReloadHint`) is a one-line `\n${hint}` -> `\n\n${hint}` edit owned by Phase 13's per-command catalog conformance pass.
- **Phase 13 atomic three-file ES-5 edit:** still owns the deletion of `RELOAD_HINT_PREFIX` from `shared/markers.ts`, the corresponding row in `tests/architecture/markers-snapshot.test.ts`, and the PRD §6.12 row. D-CMC-08 retention is intact at end of Phase 12.

---
*Phase: 12-messaging-foundations-renderer-primitives*
*Completed: 2026-05-22*
