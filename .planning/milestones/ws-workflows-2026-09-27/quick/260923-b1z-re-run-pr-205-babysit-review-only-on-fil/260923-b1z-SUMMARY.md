---
phase: 260923-b1z
plan: 01
subsystem: testing
tags: [pr-review, direct-coverage, fallow, sonarcloud]
requires: []
provides:
  - Scoped PR #205 review evidence after 27678153
  - Complete direct coverage for the agent frontmatter pair
affects: [PR-205, workflows]
actuals:
  tokens: 1360
  tasks: 3
  commits: 2
plan_head_before: 27ecfd2350b1990c8c32d800d6baf0ad0c06ccaa
tech-stack:
  added: []
  patterns: [first-parent review manifests, public exact-byte coverage tests]
key-files:
  created: []
  modified:
    - tests/bridges/agents/frontmatter.test.ts
    - docs/workflows-compatibility.md
key-decisions:
  - "Reviewed only paths derived from first-parent history and remerge diffs after 27678153."
  - "Covered emitted aliases through the public agent emitter instead of changing the coverage pin."
requirements-completed: [PR-205]
duration: 6h 10m
completed: 2026-09-23
status: complete
---

# Phase 260923-b1z Plan 01: Scoped PR #205 Babysit Summary

**PR #205 was re-reviewed within its branch-owned manifest, with complete direct coverage for agent aliases and corrected workflow VM compatibility evidence.**

## Performance

- **Tasks:** 3/3
- **Task commits:** `c4c6f38a`, `e8e185d7`
- **Remote:** pushed to `features/workflow`

## Accomplishments

- Added a public exact-byte `emitGeneratedAgentFile` aliases case; the frontmatter pair reports 100% direct lines, branches, and functions.
- Corrected the compatibility document to report the chosen workflow engine's own host-`Function` warning accurately.
- Completed disjoint TypeScript, test, documentation, shell, JSON, Fallow, and fallback broad reviews within the refreshed manifest.

## Review and Verification

- Rebuilt the first-parent and remerge-diff manifest before review and before each staged repair; it contained the planned 27 paths and excluded inherited main changes and the clean lockfile merge.
- `node --test tests/bridges/agents/frontmatter.test.ts` passed (45/45).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` passed at 106/106 branches, 19/19 functions, and 647/647 lines.
- `npm run typecheck`, `npm run lint`, and the full `npm run check` passed. The final negative type-member controls passed 7/7.
- `pre-commit run --files ...` passed for each commit with `SKIP=trufflehog`; the required worktree exclusion avoided TruffleHog's invalid `.git/index` path handling.
- Scoped `fallow review` and pre-commit `fallow audit` passed. `pr-review-toolkit` and Sonar MCP tools were unavailable, so two read-only `gsd-code-reviewer` fallback passes and GitHub PR checks were used.
- GitHub checks: SonarCloud Code Analysis, SonarCloud analysis, Fallow audit, pre-commit, integration, pinned e2e, and direct coverage were successful. `npm run check (Node 24)` remained in progress at summary time; the matching local full check passed.
- Protected local files passed `sha256sum -c` at every final boundary and were never staged: `.claude/settings.json`, `.codex/config.toml`, `.mcp.json`, and `.planning/workstreams/workflows/.verification-ledger.json`.

## Task Commits

1. **Task 1: Re-derive the boundary and close the scoped frontmatter coverage shortfall** — `c4c6f38a` (`test`)
2. **Task 2: Converge scoped TypeScript and broad reviews with disjoint owners** — `e8e185d7` (`docs`)
3. **Task 3: Filter Sonar findings to the refreshed scope and finish the PR loop** — no source commit required; SonarCloud analysis succeeded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation accuracy] Corrected workflow VM escape evidence**
- **Found during:** Task 2 broad review
- **Issue:** The compatibility matrix contradicted the selected engine's source warning about injected bridge functions exposing host `Function`.
- **Fix:** Reworded the selected-engine evidence and separated it from the measured rejected-engine escape.
- **Files modified:** `docs/workflows-compatibility.md`
- **Verification:** Full `npm run check`, scoped Fallow review/audit, and Markdown hooks passed.
- **Committed in:** `e8e185d7`

**Total deviations:** 1 auto-fixed (Rule 1)

## Excluded Findings

The fallback broad review initially raised a VM containment concern and unpinned developer-launcher concern. A follow-up review checked the explicit trusted-plugin and soft-dependency contracts and retracted both as non-blocking; neither required an out-of-scope architecture change.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced.

## Self-Check: PASSED

- `tests/bridges/agents/frontmatter.test.ts` and `docs/workflows-compatibility.md` exist in their recorded commits.
- Task commits `c4c6f38a` and `e8e185d7` exist and are pushed to PR #205.
