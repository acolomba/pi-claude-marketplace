---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 06
subsystem: docs
tags: [docs, hooks, user-facing, architecture-lint]

requires:
  - phase: 58
    provides: "BUCKET_A_EVENTS 8-tuple + TOOL-01 bidirectional tool-name map (the binding closed sets the doc enumerates)"
  - phase: 60
    provides: "CLAUDE_PROJECT_DIR / CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA env vars set in the hook child process (the bridge contract the doc documents)"
  - phase: 62
    provides: "asyncRewake / rewakeMessage / rewakeSummary semantics (the binding the background-security worked example demonstrates)"
provides:
  - "docs/hooks.md first-time-reader hook-support reference (257 lines, 9 sections, 8 supported events + 6 worked examples + tool-name mapping + decision tree + marketplace coverage)"
  - "README.md ## Hook support section linking to docs/hooks.md"
  - "tests/docs/hooks-doc.test.ts architecture lint (8 invariants: doc exists, README link, 8-event coverage, two cross-refs, zero internal-jargon tokens, no decision-IDs / Phase-numbers, no .planning leaks, 6 worked examples)"
  - "npm test glob extended to tests/docs/ (one-line script edit)"
affects: [v1.14+, future hook-support docs, v1.13 PR description, milestone-close UAT]

tech-stack:
  added: []
  patterns:
    - "Architecture-lint pattern for reader-facing docs: forbidden-token list + closed-set coverage list + cross-ref pin, all driven off a single cached readFile, one assertion per invariant"
key-files:
  created:
    - "docs/hooks.md"
    - "tests/docs/hooks-doc.test.ts"
  modified:
    - "README.md"
    - "package.json"

key-decisions:
  - "Test directory placement: tests/docs/ (new), with package.json test glob extended to include it -- required so the lint runs under npm run check; chose extending the glob over relocating the test to an existing dir because docs-doc is its own audience and other future doc lints will share the directory."
  - "Forbidden-token list authored as a single typed const tuple inside the test file rather than as a separate frontmatter contract; one-line edit to extend in the future and the test itself is the binding contract."
  - "Worked-example presence test uses case-insensitive substring matching on the example name (auto-formatter / bash-safety / session start / prompt audit / background security / compaction snapshot) so trivial heading-case variations (mdformat reformatting, sentence-case tweaks) do not red-fail the test."
  - "All six examples shipped per the binding example list (no trim); the background-security example exercises the asyncRewake + rewakeMessage + rewakeSummary triple to anchor the v1.13 async-rewake feature in reader-facing prose."
  - "Marketplace coverage figure kept at the research-doc value (10 of 13) -- the bundled marketplace fixtures in this repo are stubs rather than the real Anthropic marketplace, so the doc cites the audited 13-plugin figure rather than the local fixture count; if the live marketplace count drifts in a future milestone, the doc is the place to amend."

patterns-established:
  - "Reader-facing doc lint: forbidden-token + closed-set-coverage + cross-ref-pin pattern, replicable for future docs/* additions (one cached readFile, one node:test invocation per invariant)."
  - "Doc cross-reference shape: external URL ([text](url)) for the Claude Code authority, package-name-only (no URL) for the @mariozechner/pi-coding-agent peer dep to hedge against URL drift on a peer-dep package the project does not control."

requirements-completed: [SURF-06]

duration: 20min
completed: 2026-06-16
---

# Phase 63 Plan 06: User-Facing Hook-Support Docs Summary

**First-time-reader hook-support doc (docs/hooks.md, 257 lines, 9 sections, 8 supported events, 6 worked examples) plus README ## Hook support section linking to it, plus architecture-lint test pinning jargon prohibition, 8-event coverage, two cross-refs, and worked-example presence.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-16T11:54:49Z
- **Completed:** 2026-06-16T12:15:00Z
- **Tasks:** 3
- **Files created:** 2 (`docs/hooks.md`, `tests/docs/hooks-doc.test.ts`)
- **Files modified:** 2 (`README.md`, `package.json`)

## Accomplishments

- Authored `docs/hooks.md` (257 lines) following the binding nine-section structure: intro, how-hooks-run-under-Pi (with the three bridge-set env vars grounded in `bridges/hooks/dispatch-exec.ts:329` and `bridges/hooks/async-rewake/registry.ts:608`), supported-events table (all 8 bucket-A events verbatim), six worked examples (auto-formatter, bash-safety net with `if: "Bash(rm -rf:*)"` glob, session start rule injection, prompt audit log with `timeout`, background security review demonstrating the `asyncRewake` + `rewakeMessage` + `rewakeSummary` triple, compaction snapshot), unsupported-events groups (deferred / upstream-blocked / permanently-inapplicable), Pi-to-Claude tool-name mapping table with currently-unmapped list (`MultiEdit`, `NotebookEdit`, `WebFetch`, etc.), what-happens-to-my-plugin decision tree, marketplace coverage (10/13), and further-reading cross-references.
- Added `## Hook support` to README.md between `## Configuration files` and `## /claude:plugin reference`, sentence-case matching adjacent section style, one short paragraph + a markdown link.
- Authored `tests/docs/hooks-doc.test.ts` architecture lint: 8 invariants pinning doc existence, README link, 8-event coverage, both cross-references, zero internal-jargon tokens (`bucket-X`, `REQ-`, `Phase`, `D-NN-NN`, `<lossy synthesis>`, `Pitfall`, `Pattern N`, `.planning/`, `RESEARCH.md`, `CONTEXT.md`), and all 6 worked-example presence.
- Extended `npm test` and `test:coverage:unit` globs to include `tests/docs/` so the lint runs under `npm run check`.

## Task Commits

Each task was committed atomically:

1. **Task 3 (TDD RED):** `2e835a9` (test) — `tests/docs/hooks-doc.test.ts` + `package.json` glob extension; 8 failing tests pinning the SURF-06 contract.
2. **Task 1 (TDD GREEN, part 1):** `5fbf9e6` (docs) — `docs/hooks.md` author; turns 7 of 8 tests green.
3. **Task 2 (TDD GREEN, part 2):** `10888ed` (docs) — `README.md` `## Hook support` section; turns the 8th test (README link) green.

_TDD plan executed RED → GREEN, with Task 3 authored first so the SURF-06 lint pinned the contract before any doc bytes were written. No REFACTOR commit needed -- the test scaffolding was clean on first lint pass after fixing six routine eslint-flagged style issues (import order, nullish-coalescing assignment, `RegExp#exec` over `String#match`, padding-line-between-statements) during the RED commit pre-commit run._

## Files Created/Modified

- `docs/hooks.md` — first-time-reader hook-support doc (NEW, 257 lines after mdformat).
- `README.md` — added `## Hook support` section (3 prose lines + 1 link) between Configuration files and the /claude:plugin reference (MODIFIED, +6 lines).
- `tests/docs/hooks-doc.test.ts` — 8-invariant architecture lint over the new doc and the README link (NEW, ~180 lines).
- `package.json` — extended `test` and `test:coverage:unit` globs to include `tests/docs/` so the lint runs under `npm run check` (MODIFIED, 2 single-character edits).

## Decisions Made

- See `key-decisions` in the frontmatter. The two load-bearing ones for downstream context:
  - Test placement at `tests/docs/` with a package.json glob extension; future doc-lints share the directory.
  - Marketplace coverage figure (10/13) cited verbatim from the audited research; the local bundled fixture is a stub and not a usable cross-check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended `package.json` test glob to include `tests/docs/`**

- **Found during:** Task 3 setup, before authoring the test file.
- **Issue:** The `npm test` script glob (`tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`) did not include `tests/docs/`. Authoring the lint at the plan-locked path `tests/docs/hooks-doc.test.ts` without amending the glob would have produced a silent invariant: the test would exist on disk but never run under `npm run check`, leaving the SURF-06 contract effectively unguarded.
- **Fix:** Added `docs,` to the alternation in both the `test` script and the `test:coverage:unit` script (single-character edit per script).
- **Files modified:** `package.json`.
- **Verification:** `npm run check` GREEN (2240 unit tests + 10 integration). The new 8 tests appear in the unit-test count, replacing the prior 2232/2241 figure with 2240/2241 (1 unchanged intentional skip on a non-Linux orphan-reap test from Phase 62).
- **Committed in:** `2e835a9` (Task 3 RED commit).

---

**Total deviations:** 1 auto-fixed (Rule 2 — critical-functionality completion).
**Impact on plan:** The plan locked the test path but not the glob amendment; without the auto-fix the architecture-lint would have been a dead artefact. No scope creep, no new dependencies, no source-surface changes.

## Issues Encountered

- `pre-commit run` on the initial RED commit surfaced six routine eslint findings (import order with empty line in import group, prefer `??=` over `if (x === null) x = ...`, prefer `RegExp#exec()` over `String#match()` on two regex tests, prefer padding-line-between-statements). Fixed inline before commit; not a deviation from the plan because they are routine project-lint compliance.
- `pre-commit` `mdformat` hook reformatted `docs/hooks.md` on first commit attempt (table column alignment + ASCII reflow); re-added and re-ran -- formatting now stable. The reformatted doc passed all 7 of 8 lint tests on first run (only the README-link test was still red, pending Task 2).

## User Setup Required

None.

## Next Phase Readiness

- SURF-06 closed. The reader-facing hook-support reference is shipped, discoverable from README, and lint-pinned so a future doc edit cannot regress the contract.
- The bundled marketplace coverage figure (10/13) is a research-doc citation; if the next milestone re-audits the live Anthropic marketplace and the count drifts, the doc is the place to amend.
- Phase 63 is the final v1.13 phase per the operator next-step in STATE.md; remaining v1.13 phase plans (63-02, 63-04, 63-05, 63-07) carry the rest of the LIFE-\* and SURF-\* requirements. This plan's SURF-06 closure does not gate any of them (no shared-doc collisions, no source-surface changes).

## Threat Flags

None. Doc-only deliverables; the only marginal threat (cross-reference URL spoofing, T-63-06-XR in the plan threat model) is mitigated by hard-coding both cross-references in `docs/hooks.md` and pinning their presence in `tests/docs/hooks-doc.test.ts`.

## Self-Check: PASSED

- `docs/hooks.md` — FOUND (`[ -f docs/hooks.md ]` == true, 257 lines).
- `README.md` `## Hook support` section — FOUND (`grep -c "## Hook support" README.md` == 1; `grep -c "docs/hooks.md" README.md` == 1).
- `tests/docs/hooks-doc.test.ts` — FOUND.
- `package.json` glob extension — FOUND (`tests/{architecture,bridges,docs,domain,…}` in `test` script).
- Commits — `git log --oneline` shows `2e835a9` (test RED), `5fbf9e6` (Task 1 docs), `10888ed` (Task 2 README) on the working branch.
- `npm run check` — GREEN (2240/2241 unit, 1 intentional non-Linux skip; 10/10 integration).
- Plan grep predicates — all pass: 0 jargon, 0 `Phase ` refs, 1 `code.claude.com/docs/en/hooks` ref, 1 `pi-coding-agent` ref, 3 `CLAUDE_PLUGIN_DATA` refs, 1 README `## Hook support`, 1 README `docs/hooks.md`.

---

_Phase: 63-lifecycle-cascade-user-facing-surface-docs_
_Completed: 2026-06-16_
