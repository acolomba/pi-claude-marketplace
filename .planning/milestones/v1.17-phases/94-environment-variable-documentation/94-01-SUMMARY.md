---
phase: 94-environment-variable-documentation
plan: 01
subsystem: docs
tags: [env-vars, substitution, session-env, hooks, mcp, documentation]

# Dependency graph
requires:
  - phase: 90-session-environment-initialization
    provides: session-env injection (CLAUDECODE / CLAUDE_CODE_SESSION_ID / CLAUDE_SESSION_ID) + PI_CLAUDE_MARKETPLACE_PATH PATH ledger
  - phase: 91-hook-environment-parity
    provides: both hook spawn lanes' env contract + WR-02 no-scrub disposition
  - phase: 92-mcp-staging-parity
    provides: MCP substitution/injection + T-92-06 user-scope CLAUDE_PROJECT_DIR disposition
  - phase: 93-substitution-completion
    provides: four-token content substitution (skillDir, project-scope projectDir, user-scope pass-through)
provides:
  - docs/env-vars.md — authoritative per-variable × per-surface env matrix, two-mechanism model, divergences, and not-delivered sections
  - docs/hooks-compatibility.md env table reconciled against docs/env-vars.md
affects: [env-vars, hooks-compatibility, future env/effort-mapping phases]

# Actuals (#2632)
actuals:
  tokens: 5807
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overview matrix encodes the delivery mechanism per cell (S/E/—/✗) with one legend line; caveats footnoted to a single citable divergences subsection (no duplicated caveat text)"
    - "Pi-only vars get real matrix rows with the Claude Code column set to — rather than being hidden"

key-files:
  created:
    - docs/env-vars.md
  modified:
    - docs/hooks-compatibility.md

key-decisions:
  - "Hybrid doc structure (D-94-01): compact overview matrix first, then house-register per-surface tables"
  - "Cited 91-SECURITY.md / 92-SECURITY.md finding+threat IDs (WR-02, T-91-01, T-92-06) rather than restating the registers (C-6)"
  - "CLAUDE_ENV_FILE and CLAUDE_PROJECT_DIR conditional cells rendered ⚠ in the hook-scoped register; SessionStart-lane-only and project-scope-only footnoted"

patterns-established:
  - "Documented-absence is affirmative: CLAUDE_CODE_REMOTE and user-scope MCP CLAUDE_PROJECT_DIR recorded, not left to silence"

requirements-completed: [DOC-06, DOC-07]

coverage:
  - id: D1
    description: "docs/env-vars.md: two-mechanism model prose, overview matrix + legend (all delivered rows incl. the two pi-only rows with Claude Code column —), and the worked bash-children detail table stating the CLAUDE_PROJECT_DIR bash-parity fact"
    requirement: DOC-06
    verification:
      - kind: automated
        ref: "grep(PI_CLAUDE_MARKETPLACE_PATH, CLAUDE_SESSION_ID, substitution, injection, legend) + pre-commit mdformat markdownlint-cli2 --files docs/env-vars.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/env-vars.md: per-surface tables (skills/commands/agents/hooks/MCP config/MCP env), Divergences section covering carrier items C-1..C-6 (no-scrub / PATH ledger / session-id alias / MCP resolveEnv+spawn-order+staleness / user-scope pass-through / SECURITY citations), and Not-delivered section"
    requirement: DOC-06
    verification:
      - kind: automated
        ref: "grep(not scrubbed, spawn-order, staleness, resolveEnv, out of scope, CLAUDE_EFFORT, CLAUDE_CODE_ENTRYPOINT, 91-SECURITY|92-SECURITY; PI_CLAUDE_MARKETPLACE_PATH count>=2) + lint exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/hooks-compatibility.md env table: CLAUDE_ENV_FILE flipped to supported under Pi, rows added for CLAUDECODE / CLAUDE_CODE_SESSION_ID / pi-only CLAUDE_SESSION_ID, one authority line naming docs/env-vars.md authoritative on conflict; only the ## Environment variables region changed"
    requirement: DOC-07
    verification:
      - kind: automated
        ref: "grep(CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_SESSION_ID, env-vars.md; CLAUDE_ENV_FILE line has no ✗) + single-hunk git diff + lint exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every matrix cell and divergence claim is accurate to the shipped code (not just present)"
    verification: []
    human_judgment: true
    rationale: "Grep/lint prove presence and structure, not semantic fidelity of each S/E/—/✗ cell against vars.ts / session-env.ts / dispatch-exec.ts / async-rewake/registry.ts / mcp/substitute.ts; a reviewer must spot-check cells against the source."

# Metrics
duration: 12min
completed: 2026-08-03
status: complete
---

# Phase 94 Plan 01: Environment-variable documentation Summary

**New docs/env-vars.md presents the per-variable × per-surface env matrix (S/E/—/✗ legend), the install-time-substitution vs runtime-env-injection model, the six carrier divergences (incl. the pi-mcp-adapter resolveEnv inheritance finding), and reconciles the hooks-compatibility env table against it.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-03T20:37Z
- **Completed:** 2026-08-03T20:46Z
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `docs/env-vars.md`: two-mechanism model, an 11-row overview matrix across 8 surface columns with a single S/E/—/✗ legend, seven per-surface house-register tables, a Divergences section covering carrier items C-1..C-6, and a Not-delivered (out of scope) section with affirmative absences.
- Recorded the verified pi-mcp-adapter 2.10.0 `resolveEnv` finding (`{...process.env, ...interpolated(config.env)}`, config keys win, interpolation on env/cwd/headers/bearerToken not command/args) plus the spawn-order caveat and session-switch staleness (C-4).
- Reconciled `docs/hooks-compatibility.md`: `CLAUDE_ENV_FILE` flipped to supported under Pi, three shipped rows added (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, pi-only `CLAUDE_SESSION_ID`), one authority line pointing at `docs/env-vars.md`; no other section touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: env-vars.md skeleton + two-mechanism prose + overview matrix + bash-children table** - `c0b87093` (docs)
2. **Task 2: per-surface tables + Divergences (C-1..C-6) + Not-delivered** - `ce4e6048` (docs)
3. **Task 3: reconcile hooks-compatibility.md env table (DOC-07)** - `7c2f4830` (docs)

**Plan metadata:** final tracking commit below (docs: complete plan).

## Files Created/Modified

- `docs/env-vars.md` - New authoritative env-var reference: two-mechanism model, overview matrix, per-surface tables, divergences, not-delivered.
- `docs/hooks-compatibility.md` - `## Environment variables` table corrected/extended + authority line (only this section changed).

## Decisions Made

- Rendered conditional Pi cells (`CLAUDE_ENV_FILE` SessionStart-lane-only; `CLAUDE_PROJECT_DIR` project-scope-only) as `⚠` in the hook-scoped house register, with the condition in the note — consistent with the doc's existing `✓/✗/⚠` legend.
- Used plain-text references to divergence-subsection titles (not `[]()` fragment links) to avoid markdownlint MD051 fragment-resolution churn while keeping the single-citable-home invariant.
- Kept the `CLAUDE_CODE_REMOTE` documented-absence as a real matrix row (hooks `✗`) in addition to the Not-delivered mention, so a reader scanning the matrix sees the absence.

## Deviations from Plan

None - plan executed exactly as written. No source code touched; all `<verify>` blocks are automated (grep + `pre-commit mdformat markdownlint-cli2`) and passed.

## Issues Encountered

- `pre-commit run` rejects two hook ids in one invocation; ran `mdformat` and `markdownlint-cli2` as separate invocations. `mdformat` reformats table column widths on first pass (exit 1) — re-ran to a clean pass and restaged, per house commit protocol.

## User Setup Required

None - docs-only phase, no external service configuration required.

## Next Phase Readiness

- `docs/env-vars.md` is the authoritative env reference; `docs/hooks-compatibility.md` no longer contradicts it. Phase 94 is the milestone's last phase (v1.17 env-parity).
- D4 (semantic accuracy of each cell vs source) is flagged for the verifier to spot-check.

## Self-Check: PASSED

- Files exist: `docs/env-vars.md`, `docs/hooks-compatibility.md`, `94-01-SUMMARY.md`.
- Commits exist: `c0b87093`, `ce4e6048`, `7c2f4830`.

---
*Phase: 94-environment-variable-documentation*
*Completed: 2026-08-03*
