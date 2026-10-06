---
phase: 261004-t4g
plan: 01
subsystem: lint
tags: [eslint, fallow, il-2, build-inputs]
status: complete
requires: []
provides:
  - "ESLint BLOCK A as the only stdio call gate (one OUTPUT_DISCIPLINE_SELECTORS entry)"
affects: [eslint.config.js, .fallowrc.json, ci.yml, check-changed.mjs, package.json, .pre-commit-config.yaml]
tech-stack:
  added: []
  patterns: ["esquery regex attribute selector for stdout|stderr members"]
key-files:
  created: []
  modified:
    - eslint.config.js
    - .fallowrc.json
    - .github/workflows/ci.yml
    - scripts/check-changed.mjs
    - package.json
    - .pre-commit-config.yaml
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - CHANGELOG.md
  deleted:
    - rule-packs/architecture.json
decisions:
  - "D-01 applied: the Fallow rule pack is deleted; ESLint bans any call on a process.stdout/process.stderr member"
requirements: [T4G-01, T4G-02, T4G-03, T4G-04]
metrics:
  duration: "~5 min"
  completed: 2026-10-04
actuals:
  tokens: 4700
  tasks: 2
  commits: 1
plan_head_before: c53df4d7
plan_head_after: 1da67a83
---

# Quick Task 261004-t4g: Fold the Fallow stdio rule pack into ESLint Summary

ESLint's `OUTPUT_DISCIPLINE_SELECTORS` now bans any call on `process.stdout` or `process.stderr` with one IL-2 selector. The Fallow rule pack `rule-packs/architecture.json` is deleted, and its directory is gone from all four build-input lists.

## Commit

- `1da67a83` refactor(lint): fold the fallow stdio rule pack into ESLint (10 paths: 9 modified, 1 deleted; `.planning/STATE.md` not included)

## Evidence

**Probe** (`extensions/pi-claude-marketplace/zz-stdio-probe.ts`, deleted after the run, never staged; `git status --porcelain --untracked-files=all extensions` printed nothing):

```text
  1:1  error  Direct process.stdout.* and process.stderr.* calls are forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers  no-restricted-syntax
  2:1  error  Direct process.stdout.* and process.stderr.* calls are forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers  no-restricted-syntax
  3:1  error  Direct process.stdout.* and process.stderr.* calls are forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notification-dispatch.ts wrappers  no-restricted-syntax
✖ 3 problems (3 errors, 0 warnings)
PROBE_EXIT=1
```

Line 4, the `process.cwd()` negative control, drew no finding. The regex selector parsed on the first try.

**Lint:** `LINT_EXIT=0` (0 errors, 19 warnings, all pre-existing unused `no-await-in-loop` disable directives; no `no-restricted-syntax` finding).

**Fallow:** `FALLOW_EXIT=0` after the pack and the `rulePacks` key were removed.

**Pre-commit:** every hook passed, `PRECOMMIT_EXIT=0`. The `npm changed checks` hook selected scope `broad` ("Broad check required by .fallowrc.json, .github/workflows/ci.yml, eslint.config.js, package.json, scripts/check-changed.mjs") and ran `format:check`, `typecheck`, `lint`, `lint:workflows`, `fallow`, and `test:corresponding`, all green.

**Gitlint:** passed on the commit message.

**Fallow audit:** verdict `pass` (29 changed files against the branch merge base).

Both task `<verify>` blocks exited 0 (Task 1 before the commit, Task 2 after).

Verification scope: focused task verification passed; full phase/PR verification pending.

## Coverage gap recorded (T-t4g-02)

ESLint does not cover `shared/notification-dispatch.ts`, `shared/debug-log.ts`, or `persistence/migrate.ts`, because each turns `no-restricted-syntax` off. The deleted pack covered them. At commit time none of the three contains `process.std` (grep count 0 in each). `CONVENTIONS.md` now names them as outside the ban.

## Left unchanged on purpose

- `CHANGELOG.md:73` (history)
- `tests/architecture/no-shell-out.test.ts:28` (history)
- `.planning/codebase/STRUCTURE.md:91` and `.planning/codebase/ARCHITECTURE.md:242` (speak of stdout/stderr writes in general and stay accurate)

## Follow-ups (out of scope)

- Narrow the three per-file overrides so the stdio selector stays on in those files.
- Aliased stdio access (`const { stdout } = process`, `process["stdout"]`) is not covered by either the old pack or the new selector.

## Deviations from Plan

None - plan executed exactly as written. The CHANGELOG line uses the E14 wording unchanged; it passed the simple-english and humanizer self-checks (25 words after the `Internal:` label, no banned words or punctuation).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `1da67a83` exists in `git log`.
- `rule-packs/` and the probe file do not exist; all nine modified paths are present.
