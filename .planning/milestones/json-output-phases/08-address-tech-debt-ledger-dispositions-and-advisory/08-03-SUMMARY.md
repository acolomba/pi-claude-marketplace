---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
plan: "03"
subsystem: planning-records
tags: [backlog, deferred-items, validation, brace-expansion, npm-shrinkwrap, nyquist]

requires:
  - phase: 08-address-tech-debt-ledger-dispositions-and-advisory
    provides: "08-01 lock commit a12dfa16 (root brace-expansion 5.0.12); 08-02 resolver commits 3f20490a and 9829a30e"
provides:
  - "BACKLOG.md carrier WOUT-01 (from WINDOWS #84), which 08-04 cites when it waives entry 84"
  - "BACKLOG.md carrier DEPADV-01 (from DEP-07-03-01) with the measured Pi shrinkwrap version boundary"
  - "DEP-07-03-01 points at DEPADV-01 and records the 5.0.12 root fix; TEST-07-06-01 records the resolver fix and WINDOWS #89"
  - "03-VALIDATION.md reads nyquist_compliant: true; 01-VALIDATION.md stays false with a consistent checklist"
affects: [08-04, milestone-audit]

actuals:
  tokens: 1940
  tasks: 2
  commits: 2
plan_head_before: 80f5dcc29e2667e9a0cf62687394c674ba0de9a4
plan_head_after: c30cce5ad6f5c1b3879bfcad6772d1a6e444e3aa

tech-stack:
  added: []
  patterns:
    - "BACKLOG carrier shape: heading, Carried from line, fact paragraphs, a To settle it paragraph, no Closed paragraph"

key-files:
  created: []
  modified:
    - .planning/BACKLOG.md
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md
    - .planning/phases/01-presentation-model/01-VALIDATION.md
    - .planning/phases/03-typed-raw-surfaces/03-VALIDATION.md

key-decisions:
  - "DEPADV-01 clears only when the lock resolves Pi >=1.0.1, the first release with no npm-shrinkwrap.json; Pi 1.0.0 (origin/main #250) still pins nested brace-expansion 5.0.9 (re-measured 2026-10-10)"
  - "Wave gate ran a fresh npm run check (exit 0 at c30cce5a) because the literal reuse diff against 9829a30e was not empty (.planning/state.json)"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "BACKLOG.md ends with WOUT-01 then DEPADV-01, each heading once, each with its required facts and a To settle it recipe, append-only against a876e321"
    verification:
      - kind: other
        ref: "08-03-01 verify 1 (node heading/fact check) and verify 3 (git diff --numstat a876e321 -- .planning/BACKLOG.md: 68 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DEP-07-03-01 names DEPADV-01 and the 5.0.12 root fix and keeps the no-npm-audit-claim sentence; TEST-07-06-01 names WINDOWS #89; WINDOWS.md unchanged"
    verification:
      - kind: other
        ref: "08-03-01 verify 2 (node deferred-items check) and verify 4 (git diff --exit-code a876e321 -- .planning/WINDOWS.md)"
        status: pass
    human_judgment: false
  - id: D3
    description: "03-VALIDATION.md frontmatter true; 01-VALIDATION.md frontmatter false with its flag sign-off box unticked; one changed line per file"
    verification:
      - kind: other
        ref: "08-03-02 verify 1 (node line check) and verify 2 (git diff --numstat a876e321: 1 1 for each file)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Wave gate: npm run check on the combined tree"
    verification:
      - kind: other
        ref: "npm run check (exit 0 at c30cce5a, node v26.11.1)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-10
status: complete
---

# Phase 8 Plan 03: Planning Records for Open Debt and Validation Flags Summary

**BACKLOG.md now carries WOUT-01 (unobserved workflow output, from WINDOWS #84) and DEPADV-01 (Pi's shrinkwrap pins nested brace-expansion 5.0.9 until the lock resolves Pi >=1.0.1); DEP-07-03-01 points at DEPADV-01; 03-VALIDATION.md reads compliant and 01-VALIDATION.md stays partial with a consistent checklist.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-10T20:12:54Z
- **Completed:** 2026-10-10T20:16:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- WOUT-01 records the 2026-09-22 measurement from WINDOWS #84 (engine 3.13.0, pi 0.85.1, `tmp/pi-uat`, `modernize-harden-scan` completed in 16.5 s with zero findings, the `SCHEMA_NONCOMPLIANCE` negative control, the `agent.ts:818` default tools) and the settle recipe: an Anthropic key in `tmp/pi-uat/agent` and one re-run.
- DEPADV-01 records the three GHSA IDs, the >=5.0.12 fix range, lock commit `a12dfa16`, Pi's `npm-shrinkwrap.json` pin, why deleting nested lock entries is not a fix, the peer-floor fixture decision, the measured version boundary, and the clearing action.
- DEP-07-03-01 states the root fix and names DEPADV-01. It keeps the sentence that the record does not claim that npm audit passes. TEST-07-06-01 records the two resolver commits and WINDOWS #89.
- 03-VALIDATION.md frontmatter reads `nyquist_compliant: true`. 01-VALIDATION.md stays `false` (404 s against a 180 s target), and its flag sign-off box on line 124 is now unticked.

## Measured DEPADV-01 Facts (2026-10-10)

`npm view @earendil-works/pi-coding-agent@V _hasShrinkwrap`:

| Version | `_hasShrinkwrap` |
| --- | --- |
| 0.87.1 | true |
| 0.99.2 | true |
| 1.0.0 | true |
| 1.0.1 | false |
| 1.1.0 | false |

- `git rev-parse --short origin/main` after `git fetch origin main`: `94160614` (`feat(mcp)!: move plugin MCP servers to pi-mcp-adapter 5 on Pi 1.0 (#250)`).
- `origin/main:package-lock.json`: `@earendil-works/pi-coding-agent` 1.0.0 (`hasShrinkwrap: true`), its nested `brace-expansion` 5.0.9, root `node_modules/brace-expansion` 5.0.9.
- This branch's lock: Pi 0.87.1 (`hasShrinkwrap: true`), nested `brace-expansion` 5.0.9 and `minimatch` 10.2.6, root `brace-expansion` 5.0.12.

All values match the planning measurements in the plan context.

## Task Commits

1. **08-03-01: Carry the unobserved workflow output and the nested advisory, and point the deferred items at their resolutions** - `afce1b02` (docs). `SKIP=npm-check pre-commit run --files` passed with no rewrites. The commit hook passed every hook, including gitlint. `npm-check` did not run because `.planning/` files are not build inputs.
2. **08-03-02: Make the two validation records agree with their own checklists** - `c30cce5a` (docs). Pre-commit run and commit hook passed the same way, with no rewrites.

**Plan metadata:** the docs commit that adds this SUMMARY with STATE.md and ROADMAP.md.

## Verification

- Tracer feedback gate (08-03-01): auto mode off, `human_verify_mode` end-of-phase, tracer `<verify>` automated only. All four verify commands passed before the commit, and the hook rewrote nothing, so the plan continued to 08-03-02 with no checkpoint.
- 08-03-01 verify: heading/fact check `{ once: true, last: true, gaps: [] }`; deferred-items check `{ ok: true }`; BACKLOG.md numstat against `a876e321` is `68 0`; WINDOWS.md diff against `a876e321` exits 0.
- 08-03-02 verify: line check prints `nyquist_compliant: false | nyquist_compliant: true | - [ ] \`nyquist_compliant: true\` set in frontmatter`; numstat is `1 1` for each file.
- **Wave gate:** the reuse check (verify 3) exited 1. `git diff 9829a30e -- . ':(exclude,glob).planning/**/*.md'` lists `.planning/config.json` (the orchestrator toggle) and `.planning/state.json` (changed by the 08-02 docs commit `80f5dcc2`). Neither is a build input, but the local-verification rule needs an empty diff and a result from this session, so the reuse was void. `npm run check` ran instead: exit 0 at `c30cce5ad6f5c1b3879bfcad6772d1a6e444e3aa`, `node --version` v26.11.1, output redirected to a file, not piped.

## D-12: Phase 07 Verification Stays Stale

`07-VERIFICATION.md` lists both `deferred-items.md` and `package-lock.json` in its `covered_files`. 08-01 changed the lock and this plan changed `deferred-items.md`, so the staleness check keeps reporting phase 07's verification as `stale`. This is accepted and is not a regression: the edits record the planned advisory remediation and its carrier, and phase 07's verified behavior does not depend on them.

## Files Created/Modified

- `.planning/BACKLOG.md` - WOUT-01 and DEPADV-01 appended after GHADD-01 (68 added lines, 0 deleted)
- `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md` - DEP-07-03-01 and TEST-07-06-01 edited in place
- `.planning/phases/01-presentation-model/01-VALIDATION.md` - line 124 sign-off box unticked
- `.planning/phases/03-typed-raw-surfaces/03-VALIDATION.md` - line 7 frontmatter set to true

## Decisions Made

- DEPADV-01's settle recipe names Pi 1.0.1 as the first release with no shrinkwrap. Merging main's Pi 1.0 floor alone (it locks 1.0.0) does not clear the copy; the lock must move past 1.0.0. This sharpens D-08 with measured facts and does not change its decision.

## Deviations from Plan

None - plan executed exactly as written. The fresh `npm run check` is the plan's own fallback for a failed reuse condition. The reuse check was applied with `.planning/config.json` excluded, as the orchestrator directed; it still failed on `.planning/state.json`.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 08-04. WOUT-01 exists, so 08-04 can waive WINDOWS entry 84 with a reason that cites it. WINDOWS.md is unchanged by this plan.

## Self-Check: PASSED

- FOUND: .planning/BACKLOG.md (WOUT-01 and DEPADV-01 are the last two headings)
- FOUND: .planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md (DEPADV-01, #89)
- FOUND: afce1b02 and c30cce5a are ancestors of HEAD
