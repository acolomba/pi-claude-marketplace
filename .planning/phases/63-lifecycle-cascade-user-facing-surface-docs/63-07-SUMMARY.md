---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 07
subsystem: testing
tags: [architecture-lint, scope-fence, hooks, surf, hook-04, surf-03, surf-04, d-58-01]

# Dependency graph
requires:
  - phase: 58
    provides: D-58-01 atomic supersession — `"hooks"` removed from `MANIFEST_FIELD_REASONS`; `"unsupported hooks"` added to REASONS
  - phase: 63-03
    provides: SURF-05 orphan-rewake row added (the only install-arm warning emission allowed in v1.13)
provides:
  - Architecture-lint test pinning SURF-03 absence (no lossy-synthesis tokens in shared/notify.ts)
  - Architecture-lint test pinning SURF-04 absence (no `/claude:plugin hooks` edge handler; no hook-count list column)
  - Architecture-lint test pinning HOOK-04 prior completion (`"unsupported hooks"` present; `MANIFEST_FIELD_REASONS` excludes `"hooks"`)
affects: [v1.13 milestone close-out, v1.14+ synthesis-caveat work, future hooks UX phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [absence-pin architecture lint, grep-by-readFile invariant assertion, decision-ID-as-traceability-anchor in test docstrings]

key-files:
  created:
    - tests/architecture/scope-fences-63.test.ts
  modified: []

key-decisions:
  - "Architecture lint uses grep over readFile (the project's established pattern for invariant pins — mirrors no-shell-out.test.ts and no-telemetry-deps.test.ts) rather than an AST walk; the assertion surfaces (string literals in REASONS, file presence in a directory, single-line Set declaration) are stable enough that substring matches are sufficient and produce clearer error messages."
  - "The SURF-04 'no /claude:plugin hooks edge handler' assertion scans BOTH the actual `extensions/pi-claude-marketplace/edge/handlers/plugin/` directory used in this repo AND the historical `commands/plugin/` path mentioned in the planning artifacts; a non-existent directory makes its per-path assertion trivially satisfied, so the test is forward-compatible with a future edge → commands rename without weakening the invariant."
  - "The HOOK-04 MANIFEST_FIELD_REASONS assertion targets the single-line `new Set(...)` declaration ONLY, not lookup call-sites like `MANIFEST_FIELD_REASONS.has(token)`; lookup lines may legitimately compare against literal `\"hooks\"` in future callers without re-opening the supersession."

patterns-established:
  - "Absence-pin architecture lint: when a milestone's contribution is recorded-NON-ADDITION rather than code, a single `tests/architecture/*.test.ts` with substring/regex assertions captures the invariant; the test passing immediately is the intended state, not a TDD RED-skip violation, because the test pins what is ALREADY absent and would fail loudly on any future re-introduction."
  - "Decision-ID + REQ-ID traceability in test docstrings: per `.claude/rules/typescript-comments.md`, the file's top-level doc-comment cites SURF-03 / SURF-04 / HOOK-04 / D-58-01 by ID — no phase numbers, no `Pitfall N` planning artifacts."

requirements-completed: [SURF-03, SURF-04]

# Metrics
duration: ~15min
completed: 2026-06-16
---

# Phase 63 Plan 07: Scope-Fence Architecture Lint Summary

**Single architecture-lint test pinning SURF-03 / SURF-04 NON-additions + HOOK-04 prior completion via 5 grep-by-readFile invariants — zero source edits, v1.13 milestone close-out ready.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-16T12:24Z (approx)
- **Completed:** 2026-06-16T12:28Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- Created `tests/architecture/scope-fences-63.test.ts` (203 lines, 5 invariant assertions, all passing).
- Pinned SURF-03 (deferred to v1.14+) by asserting zero `"lossy synthesis"` / `<lossy synthesis>` / `"LOSSY_SYNTHESIS"` tokens in `shared/notify.ts`.
- Pinned SURF-04 (perma-forbidden in v1.13) by asserting (a) no `hooks.{ts,js,cjs,mjs}` file exists under `edge/handlers/plugin/` or `commands/plugin/`, and (b) no `hookCount` / `hook_count` / `hooks count` / `hooks-column` / `hookColumn` string literal appears in either `orchestrators/plugin/list.ts` or `edge/handlers/plugin/list.ts`.
- Confirmed HOOK-04 (D-58-01 atomic supersession from Phase 58) is still in place: `"unsupported hooks"` is present in `shared/notify.ts` at **line 81** of REASONS; `MANIFEST_FIELD_REASONS` at `orchestrators/plugin/install.ts:1573` is declared as `new Set(["lspServers"])` and does NOT contain `"hooks"`.
- Test passes 5/5 in isolation (`node --test tests/architecture/scope-fences-63.test.ts`); `npm run typecheck`, `npm run lint`, `npm run format:check` all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: pin SURF-03 / SURF-04 absences + HOOK-04 presence** — `83fc441` (test)

_TDD note: this task carries `tdd="true"` in the plan but is an absence-pin architecture lint with no GREEN companion implementation — the test passing immediately is the intended state because it pins what is ALREADY absent in the codebase, and any future re-introduction (synthesis token, hooks edge handler, hook-count column, regression of D-58-01) fails it loudly. There is no separate `feat` commit because the plan explicitly forbids touching any application source file._

## Invariant assertions (5 total)

| #   | Test                                                              | Source file targeted                                          | Assertion                                                     |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | SURF-03: no lossy-synthesis tokens in shared/notify.ts            | `extensions/pi-claude-marketplace/shared/notify.ts`           | Zero occurrences of 5 token variants                          |
| 2   | SURF-04: no /claude:plugin hooks edge handler                     | `extensions/pi-claude-marketplace/edge/handlers/plugin/` (+ historical `commands/plugin/`) | No file matching `/^hooks\.(ts|js|cjs|mjs)$/` |
| 3   | SURF-04: no hook-count column on list                             | `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` + `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | Zero occurrences of 5 token variants |
| 4   | HOOK-04: REASONS contains `"unsupported hooks"`                   | `extensions/pi-claude-marketplace/shared/notify.ts`           | Token present (verified at line 81 of REASONS)                |
| 5   | HOOK-04: MANIFEST_FIELD_REASONS excludes `"hooks"`                | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (line 1573) | Declaration line contains `"lspServers"` AND does NOT contain `"hooks"` |

## Files Created/Modified

- `tests/architecture/scope-fences-63.test.ts` — new architecture-lint test, 5 invariants, 203 lines.

## Decisions Made

See `key-decisions` in frontmatter. Summary:

1. Grep-by-readFile over AST walk for stability + clearer error messages.
2. SURF-04 directory scan covers BOTH `edge/handlers/plugin/` (current shape) and `commands/plugin/` (planning-artifact shape) so the test is forward-compatible with a future rename without weakening the invariant.
3. HOOK-04 MANIFEST_FIELD_REASONS assertion targets the single-line `new Set(...)` declaration ONLY, not `.has(token)` lookup sites, so future legitimate lookups against literal `"hooks"` don't re-open the supersession.

## Deviations from Plan

None — plan executed exactly as written. The plan documented an ambiguity around `commands/plugin/` vs `orchestrators/plugin/` paths (the planning text references the V1 `commands/plugin/` shape; this repository uses `edge/handlers/plugin/`); the test handles both by trivially-satisfying the assertion when the directory does not exist, so no plan rewrite or scope adjustment was needed.

## Issues Encountered

- ESLint flagged an unused `EXTENSION_ROOT` constant on the first auto-fix pass (it was a holdover from the no-shell-out.test.ts style baseline that the new test doesn't need); removed in the same iteration before commit. Captured by the lint gate, not a runtime issue.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Scope fences locked; v1.13 milestone close-out ready.
- SURF-03 (deferred to v1.14+) is recorded as covered by absence-pin: any v1.14+ phase that ships a synthesis-caveat warning surface MUST update or remove this test in the same commit as the REASONS catalog + byte-UAT changes (atomic-supersession lesson from v1.3).
- SURF-04 is perma-forbidden in v1.13; the test will guard against accidental hook-count column additions or `/claude:plugin hooks` edge handlers in any subsequent v1.13 patch work.
- HOOK-04 invariant remains pinned as long as `shared/notify.ts::REASONS` contains `"unsupported hooks"` and `MANIFEST_FIELD_REASONS` excludes `"hooks"`; D-58-01 atomic supersession is now test-locked.

## Self-Check: PASSED

- `tests/architecture/scope-fences-63.test.ts` exists (verified via `git log -1 --stat`).
- Commit `83fc441` exists on `features/v1.13-hook-bridge` (verified via `git rev-parse --short HEAD`).
- All 5 invariants pass against the current codebase (verified via `node --test tests/architecture/scope-fences-63.test.ts` — `# tests 5 / # pass 5`).
- `npm run typecheck`, `npm run lint`, `npm run format:check` all green post-commit.

---

_Phase: 63-lifecycle-cascade-user-facing-surface-docs_
_Completed: 2026-06-16_
