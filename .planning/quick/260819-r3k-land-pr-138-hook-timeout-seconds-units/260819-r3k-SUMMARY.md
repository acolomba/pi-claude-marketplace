---
id: 260819-r3k
slug: land-pr-138-hook-timeout-seconds-units
description: Land PR #138 -- hook timeout read as seconds
date: 2026-08-19
status: complete
branch: fix/hook-timeout-seconds-units
contributor_commit: 2fbaaca3 fix: interpret hook timeout as seconds (Claude Code parity)
commits:
  - e9645f2f Merge origin/main into fix/hook-timeout-seconds-units
  - 9ae808e6 test(hooks): pin the timeout unit at both exec call sites
  - fb332294 docs: state the hook timeout unit and record the fix
---

# Quick Task 260819-r3k Summary

## What shipped

**The contributor's fix, unrewritten.** Commit `2fbaaca3` by @rakesh-vs stands
as submitted. `origin/main` was merged into the branch rather than rebased onto
it, so the branch carries `v0.16.1` and the release-automation change without
touching the contributor's authorship or content.

**Call-site gates, one per exec lane.**
`tests/architecture/hooks-exec.test.ts` and
`tests/architecture/hooks-async-rewake.test.ts` each gain a test that dispatches
a handler declaring `timeout: 2`, ticks mock timers to 1999 ms and asserts no
kill, then ticks one more and asserts exactly `["SIGTERM"]`. Each file already
owned its lane's EXEC-02 invariants and already carried a spawn spy whose mock
child records kill signals, so the fixture cost was one optional `timeout`
field on each file's `makeEntry`.

**The unit is on the page.** `docs/hooks-compatibility.md`'s `timeout` row said
"per-handler override; 600 s default" and never named the input unit. It now
says seconds.

**Recorded.** `CHANGELOG.md` carries the fix under a new `[Unreleased]`
heading, crediting @rakesh-vs and #138. `.planning/BACKLOG.md` gains `HKTO-01`,
and `.planning/STATE.md` the quick-task row.

## Verified

- **The seconds reading is upstream's, from the primary source.**
  `code.claude.com/docs/en/hooks`, Common fields table: "`timeout` | no |
  Seconds before canceling. Defaults: 600 for `command`, `http`, and
  `mcp_tool`; 30 for `prompt`; 60 for `agent`."
- **The repository had already recorded it.**
  `docs/research/claude-hook-config-syntax.md` line 60 lists `timeout` as
  `number (seconds)` and maps it to EXEC-02. The v1.13 implementation drifted
  from research that was correct at the time it was written.
- **Both read sites are covered, and there is no third.** Grep over the
  extension tree finds exactly two consumers of `entry.handlerDecl.timeout`:
  `bridges/hooks/dispatch-exec.ts` and
  `bridges/hooks/async-rewake/registry.ts`.
- **The new gates were proved by planting the violation, not by passing.**
  Re-inlining `typeof raw === "number" ? raw : DEFAULT_TIMEOUT_MS` at both call
  sites turns both new tests red (`# fail 2`) while all six cases in
  `tests/shared/timeout.test.ts` stay green -- which is precisely the blind
  spot they were added to cover. Source restored and re-run green afterward.
- `npm run check` green on the finished branch, and `pre-commit` run at
  `--all-files` scope, which is the scope CI uses.

## Deviations from plan

- The task opened as artifacts-only. Two review findings were folded in on the
  operator's call: the call-site gates and the compatibility-doc unit. The
  contributor's own five files are unmodified.
- No version bump. `0.16.1` is published; the fix sits under `[Unreleased]`,
  matching how #127 was handled.

## Not done

- **HKTO-01 is filed, not fixed.** Upstream lowers the 600 s default per event
  (`UserPromptSubmit` to 30 s, `MessageDisplay` to 10 s, `SessionEnd` to a
  shared 1.5 s budget). The bridge applies a flat 600 s from a constant
  duplicated across both lanes. This PR corrects the unit, not the default.
- **No cap on a large `timeout`.** A plugin that wrote its timeout in
  milliseconds to suit the old bridge behavior -- `timeout: 300000` appears in
  the wild, recorded in `docs/research/claude-hook-config-syntax.md` -- now
  gets 300000 seconds. That is what Claude Code has always given it, so parity
  is preserved and no clamp was added. The sync lane awaits its child, so a
  hook that never exits holds the turn for as long as its declared timeout.
- **No `timeout` on the non-command handler types.** `prompt` (30 s) and
  `agent` (60 s) are unsupported handler types in the bridge, so their upstream
  defaults have nothing to attach to.
