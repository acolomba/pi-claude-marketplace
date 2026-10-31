---
phase: 05-mode-selected-json-sink
fixed_at: 2026-10-07T15:26:35.905Z
review_path: .planning/phases/05-mode-selected-json-sink/05-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-10-07T15:26:35.905Z
**Source review:** .planning/phases/05-mode-selected-json-sink/05-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: Fresh hook callbacks bypass unsupported-mode rejection

**Status:** fixed; independently verified by gsd-code-reviewer
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `tests/bridges/hooks/event-router.test.ts`
**Commit:** `cd569d2aeb02f2691a636e325fc3c7976c4952c1`

**Applied fix:** Added a private registration wrapper for fresh dispatch on
`session_shutdown`, `session_before_compact`, `session_compact`, `input`,
`tool_call`, and `tool_result`. It checks the live context mode inside a narrow
catch, logs validation failures through the existing opt-in hook logger, and
returns without calling the dispatch handler. The generation check still runs
first. Handler execution stays outside the catch, preserving executor errors.

The dispatch and executor modules were read and traced; no changes were needed
there. Existing independent shutdown cleanup, terminal-child cleanup, startup
handling, and settle handling remain in their current owners.

Added 70 behavioral cases through the real callback registrations and populated
routing buckets. They cover both tool-result outcomes, unknown modes, throwing
mode getters, rejected startup, and a supported callback followed by a rejected
live mode. Successful dispatch is covered for tui, print, json, and rpc.

## Verification

All checks below ran in the isolated worktree
`/home/acolomba/src/pi-claude-marketplace-json/.claude/worktrees/rf-05-hook-mode`
on Node `v26.10.0`, using an independent copy of the existing dependencies.
No packages were installed.

- RED: `node --test --test-reporter=tap --test-name-pattern='rejects fresh|then rejects a live' tests/bridges/hooks/event-router.test.ts`
  exited 1 before the production edit. All 70 cases failed on unexpected fresh
  executor calls.
- GREEN: `node --test --test-reporter=tap tests/bridges/hooks/event-router.test.ts`
  exited 0: 108 passed, zero failed, skipped, or todo. Existing lifecycle and
  rejecting-executor cases passed.
- Re-read both modified sections and confirmed the guard scope, registration
  wiring, and surrounding code.
- Final `node_modules/.bin/fallow audit --base HEAD --format json --quiet`
  exited 0 against `e5aae6d6`: two changed files, no dead-code, complexity,
  or duplication findings.
- `SKIP=npm-check pre-commit run --files <both modified files>` passed after
  formatting and the two lint corrections described below.
- The successful commit's mandatory `npm run check:commit` hook passed:
  static checks, unpaired tests, and staged-pair direct coverage. This enforces
  100% line, function, and branch coverage for the event-router source/test pair.
  Commit-message hooks also passed.

The parent workflow must run `npm run check` on the combined checkout after the
fast-forward. The commit hook is not a phase gate. This report does not resolve
A-05-01, A-05-02, P-05-01, or P-05-02 and does not mark the phase complete.
The independent reviewer subsequently verified the original reproduction now
blocks fresh dispatch, confirmed stale generations never touch the context,
and reran the owner and lifecycle architecture suites successfully. It found
no remaining defect or human-only verification item; see 05-REVIEW.md.

The parent then ran `npm run check` in the combined checkout at
`cd569d2aeb02f2691a636e325fc3c7976c4952c1` on Node `v26.10.0`. It exited 0,
including all 264 direct-coverage pairs. The log is
`/tmp/json-phase5-fixed-parent-check.log`. This supersedes the pre-fix full gate
and also covers the prior phases' regression suites.

## Failed Attempts and Corrections

- The first sandboxed test invocation exited before running test cases and
  supplied no useful diagnostic. Tests were rerun outside the sandbox.
- Initial test contexts spread a getter-bearing fixture, which read its
  deliberately throwing model-registry getter during setup. Contexts now use
  proxies to preserve lazy reads. A strict executor mock also traversed those
  getters while formatting unexpected calls; the tests use the existing
  execution-recording seam so assertions report the actual forbidden dispatch.
  These attempts were not counted as RED evidence.
- The first fixer preflight changed formatting through Prettier; the next run
  passed.
- `gsd-tools query commit` killed the first commit attempt at its hard-coded
  30-second timeout while the mandatory hook was running. No commit was
  created. Process inspection confirmed no remaining hook process. A direct
  foreground `git commit` retained every hook and avoided that wrapper limit.
- The first direct commit attempt passed type checking but failed ESLint on
  two missing blank lines in the added tests. Both were corrected, the
  preflight and audit were rerun, and a new commit attempt passed every hook.
  No amend, rebase, or hook bypass was used.

---

_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
