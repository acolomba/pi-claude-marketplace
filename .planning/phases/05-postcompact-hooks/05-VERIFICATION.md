---
phase: 05-postcompact-hooks
status: passed
score: 3/3
verified: 2026-11-08
verifier: phase orchestrator, inline (P5-DC-17)
head: af79dc588849102d7b28628aceccdbbe294668c9
---

# Phase 5 Verification: PostCompact Hooks

Verified inline by the orchestrator following `.claude/agents/gsd-verifier.md` (the coordinator ruled that this session's subagents stall), so it is not independent of the author (P5-DC-17).

## Goal

Every compaction, manual or automatic, runs the plugin's `PostCompact` hooks with its trigger, and matchers select them by trigger (PCOMP-01).

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A compaction Pi starts on its own runs PostCompact with trigger `auto` and Claude Code's payload; `/compact` gives `manual` | VERIFIED | `features/hook/compaction.feature`: the seed (threshold) and "A compaction after a context overflow runs PostCompact with trigger auto" pin `auto` with the payload columns; red runs A and B fail them. `hook/session.feature` pins `manual`. |
| 2 | Matcher `auto` selects only the automatic run, `manual` only the manual run | VERIFIED | "A trigger matcher auto selects the PostCompact run of an automatic compaction" records only `post-auto` (red run B fails it); `hook/session.feature` "A compaction trigger matcher selects the PreCompact and PostCompact runs" pins the manual side. |
| 3 | Output and exit code handled as Claude Code does; the session continues | VERIFIED | Scenario 4: one notice lists each hook's end in Claude Code 2.1.319's wording (red before the change); scenario 5: nothing after an automatic compaction (red before); scenario 6: the next prompt gets a normal turn with no hook output (red run C). Unit pairs at 100% direct coverage pin the run derivation, the wording, and every process end. |

## Decisions

D-BG-501 to D-BG-504 are in the product (`exec-result.ts`, `payloads/post-compact.ts`, `hook-labels.ts`, `dispatch-exec.ts`, `dispatch.ts`); D-BG-505 to D-BG-507 in `features/hook/compaction.feature` (six untagged scenarios, `hook/session.feature` unchanged); D-BG-508 in `docs/hooks-compatibility.md` and the parent lines of 05-02-SUMMARY.md.

## Gates

- Wave 1 gate (parts, `--parallel 3`): static, unpaired, integration, builtin (148 passed), coverage green; adapter 1641/1642 with `background-update.feature:90` timing out under load, passed on rerun.
- Phase gate on the merged tree (HEAD `af79dc58`, after merging `features/behavioral-gaps` with Phase 3 and others): `npm run check` reached the adapter cucumber leg with 1719/1723 passing; the four failures (`skill/collisions.feature:156`, `marketplace/remove.feature:630`, `plugin/install-dependencies.feature:562`, `plugin/update.feature:484`) are outside the hook modules and passed on one rerun. The remaining parts ran separately: builtin profile 152 passed, `test:coverage:direct:all` exit 0, `npm run test:modules` exit 0.
- Nothing under the real `~/.pi` changed during the runs.

## Edge assumption (edge probe)

The PCOMP-01 edges covered: the closed trigger set, the closed matcher set, zero runs, out-of-order finishes, hooks with no run (`asyncRewake`), timeout, and start failure. No other edge was found.

## Human verification

None needed.
