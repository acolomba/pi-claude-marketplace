---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
plan: "01"
subsystem: infra
tags: [npm, package-lock, brace-expansion, advisory, supply-chain]

requires:
  - phase: 07-mode-refusals-real-pi-verification-and-docs
    provides: "07-PEER-FLOOR-AUDIT.md transitive advisory disposition (DEP-07-03-01)"
provides:
  - "Root package-lock.json pins node_modules/brace-expansion at 5.0.12 with the registry integrity"
  - "Pi-nested brace-expansion 5.0.9 left as the single npm audit path (D-08)"
affects: [08-03 BACKLOG DEPADV-01, ci npm ci installs]

actuals:
  tokens: 200
  tasks: 3
  commits: 1
plan_head_before: 9422ebef8bcec300f12df8e086342a5e51ac1614
plan_head_after: a12dfa162ce619b0aee4379acde28f7bb086d43d

tech-stack:
  added: []
  patterns:
    - "Lock-only advisory fix: rehearse npm audit fix --package-lock-only on copies, human legitimacy gate, then apply and commit the lock alone"

key-files:
  created: []
  modified:
    - package-lock.json

key-decisions:
  - "D-07 applied: root brace-expansion bumped 5.0.9 -> 5.0.12 lock-only with --ignore-scripts, after the user approved the artifact at checkpoint 08-01-02"
  - "D-08 honored: the Pi-shrinkwrapped nested copy stays at 5.0.9 and remains the only npm audit path; no override, no nested-entry edit"

patterns-established:
  - "Advisory bumps on a too-new package go through a blocking-human legitimacy checkpoint before the real lock changes"

requirements-completed: []

coverage:
  - id: D1
    description: "Root package-lock.json node_modules/brace-expansion at 5.0.12 with the registry dist.integrity, in a commit that holds only package-lock.json"
    verification:
      - kind: other
        ref: "git diff --numstat a876e321 -- package-lock.json (3 3 package-lock.json)"
        status: pass
      - kind: other
        ref: "lock integrity == npm view brace-expansion@5.0.12 dist.integrity; nested entry reads 5.0.9"
        status: pass
      - kind: other
        ref: "git show --name-only of the newest lock commit == package-lock.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm audit --package-lock-only reports only node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion"
    verification:
      - kind: other
        ref: "npm audit --package-lock-only --json node list check"
        status: pass
    human_judgment: false
  - id: D3
    description: "package.json, tests/e2e/pi-peer-floor/, and .github/workflows/ unchanged; npm run check green"
    verification:
      - kind: other
        ref: "git diff --exit-code a876e321 -- package.json tests/e2e/pi-peer-floor/ .github/workflows/"
        status: pass
      - kind: other
        ref: "npm run check (exit 0 at a12dfa16)"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-10-10
status: complete
---

# Phase 8 Plan 01: Brace-expansion Lock Bump Summary

**Root lock moves brace-expansion from 5.0.9 to 5.0.12 (registry integrity verified and human-approved). The copy pinned by Pi's shrinkwrap stays at 5.0.9 and is now the only path npm audit reports.**

## Performance

- **Duration:** about 28 min, including the wait at the 08-01-02 checkpoint
- **Started:** 2026-10-10T19:35:00Z (approximate; phase execution start commit 9422ebef)
- **Completed:** 2026-10-10T20:03:00Z
- **Tasks:** 3 of 3 (tracer rehearsal, human legitimacy checkpoint, apply and commit)
- **Files modified:** 1 (`package-lock.json`)

## Accomplishments

- `node_modules/brace-expansion` in the root lock now reads 5.0.12. It resolves from `https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz`, with integrity `sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==`. That equals the registry `dist.integrity`.
- The diff against `a876e321` is exactly 3 added and 3 removed lines (version, resolved, integrity). The real lock is byte-identical to the rehearsed lock.
- `npm audit --package-lock-only` lists one vulnerable node: `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion`, which still reads 5.0.9 (D-08).
- `package.json`, `tests/e2e/pi-peer-floor/`, and `.github/workflows/` are byte-identical to `a876e321`. No override, no fixture change, no CI audit step (D-10).

## Task Commits

1. **08-01-01: Rehearse the lock-only fix on copies** - no commit (the plan forbids one; scratch only)
2. **08-01-02: Confirm the brace-expansion 5.0.12 artifact** - checkpoint, no commit; user answered "approved"
3. **08-01-03: Apply the approved bump, commit the lock alone, run the wave gate** - `a12dfa16` (fix)

**Plan metadata:** the docs commit that adds this SUMMARY

## Checkpoint 08-01-02 (normal flow)

The previous executor stopped at the blocking-human legitimacy checkpoint with this evidence block. The user answered **"approved"**.

| Fact | Value |
| --- | --- |
| Selected version | 5.0.12 |
| Resolved URL / tarball | https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz |
| Rehearsed lock integrity | sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ== |
| Registry dist.integrity | same string |
| Repository | github.com/juliangruber/brace-expansion |
| gitHead | f3410159d768f56c9d9f4511d3e1b46425fc1099 |
| Maintainers | juliangruber, isaacs |
| Install-time scripts | none (no preinstall, install, or postinstall) |
| Rehearsal diff | 3 lines in the root `node_modules/brace-expansion` entry only |
| Audit nodes afterwards | `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion` only |

## Gate Results

- **Lock commit:** `a12dfa16` (`fix(deps): bump root brace-expansion to 5.0.12`). It holds only `package-lock.json`. Before the commit, `SKIP=npm-check pre-commit run --files package-lock.json` passed with no rewrites. The commit hook passed every hook. That includes `npm run check:commit`, which a staged lock widens to every direct-coverage pair, and gitlint.
- **Wave gate:** `npm run check` exited 0 at HEAD `a12dfa162ce619b0aee4379acde28f7bb086d43d`, on `node --version` v26.11.1. It ran unpiped in the foreground.
- **Plan verify commands:** all six passed (numstat 3/3, no diff in package.json, the fixture, or the workflows, integrity and versions, single audit node, lock-only commit, npm run check).
- `npm audit fix` and `npm audit` exited 1 as the plan expects, because the nested copy stays. The assertions read the JSON and the lock bytes, not the exit status.

## Lock-only Install Caveat

The fix changes only the lock. The local `node_modules` still holds brace-expansion 5.0.9, so the local `npm run check` did not run 5.0.12. CI's `npm ci` is the first place that installs 5.0.12.

## D-12: Phase 07 Verification Reads Stale (accepted)

`07-VERIFICATION.md` lists `package-lock.json` in its `covered_files`. This commit changes that file, so the staleness check now reports phase 07's verification as `stale`. This is accepted and is not a regression. The change is the planned advisory remediation, and phase 07's verified behavior does not depend on the brace-expansion version.

## Files Created/Modified

- `package-lock.json` - root `node_modules/brace-expansion` entry at 5.0.12 (version, resolved, integrity)

## Decisions Made

- Applied D-07 exactly as approved. The real `npm audit fix --package-lock-only --ignore-scripts` output was byte-identical to the rehearsal, so no new decision was needed.

## Deviations from Plan

None - plan executed exactly as written.

The resume instructions scoped task 3's "nothing in flight" check (`git diff --quiet`) to exclude `.planning/config.json`. That file is an orchestrator toggle (`workflow.use_worktrees: false`), not lock work. It was never staged or committed. This was an orchestrator instruction, not a deviation.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-08-01 and T-08-SC are mitigated: the integrity matches the registry, the diff is 3 lines, the change is lock-only with `--ignore-scripts`, and a human approved it at the blocking checkpoint. T-08-02 is mitigated: the nested entry is untouched and is the single reported node. T-08-03 is transferred to Pi's shrinkwrap. Plan 08-03 records it as BACKLOG DEPADV-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 08-02. Plan 08-03 must record the Pi-nested residual (brace-expansion 5.0.9 pinned by Pi's `npm-shrinkwrap.json`) as BACKLOG DEPADV-01.

## Self-Check: PASSED

- FOUND: package-lock.json (root brace-expansion 5.0.12)
- FOUND: a12dfa16 is an ancestor of HEAD
- FOUND: this SUMMARY file

---
*Phase: 08-address-tech-debt-ledger-dispositions-and-advisory*
*Completed: 2026-10-10*
