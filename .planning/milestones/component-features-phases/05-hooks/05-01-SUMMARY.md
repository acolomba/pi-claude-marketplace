---
phase: 05-hooks
plan: 01
subsystem: hooks
tags: [hooks, session-start, session-end, compaction, cucumber, pi-tui]

requires:
  - phase: 01-harness
    provides: profile Pi, scripted model, hook recorder, TUI driver, hook runs step
provides:
  - SESSION_START_SOURCES / SESSION_END_REASONS closed sets and their literal types
  - claudeSessionStartSource / claudeSessionEndReason, the one mapping site per event
  - Claude-side SessionStart / SessionEnd events dispatched by the router and filtered on
  - SessionStart compact between PreCompact and PostCompact, PostCompact compact_summary
  - PreCompact / PostCompact trigger matcher filtering
  - no session hook on Pi reload
  - hook session step family (new session, compact, fork, RPC stop, terminal reload and quit)
  - any-order runs step, no-runs step, embedded session-id projection
affects: [05-hooks later waves, docs/hooks-compatibility.md (D-CF5-21)]

actuals:
  tokens: 29300
  tasks: 3
  commits: 4
plan_head_before: 74829438fbe192908f25198d7d8749e02886f8be
plan_head_after: 05320995a72a12f6c430fd3a06fabe8d1c209d58

tech-stack:
  added: []
  patterns:
    - "Router maps Pi's session reason once into a Claude-side event; dispatch and the translator read the same value"
    - "Session action steps record a turn from the stand-in log lines a non-prompt action added"

key-files:
  created:
    - features/hook/session.feature
    - features/step_definitions/hook/session.steps.ts
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - features/plugin/session-start-hooks.feature
    - features/step_definitions/hook/runs.steps.ts
    - test/domain/components/hook-events.test.ts
    - test/domain/components/hooks/partition.test.ts
    - test/bridges/hooks/payloads/session-start.test.ts
    - test/bridges/hooks/payloads/session-end.test.ts
    - test/bridges/hooks/payloads/post-compact.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts

key-decisions:
  - "The terminal reload and quit scenarios install through a profile Pi, not the run's shared Pi, so no SessionEnd hook stays routed in the shared Pi for the next scenario's reset"
  - "A failed compaction SessionStart leg is debug-logged and PostCompact still runs; a stale generation stops both"
  - "The SSDEDUP-01 key keeps Pi's raw reason; the reload check runs after the hydrate, rebuild, and shared-directory step"

patterns-established:
  - "recordSessionAction(world, prompt, action): read log lengths, act, keep records and new log lines as the turn"
  - "Any-order runs comparison sorts stated and recorded body rows on every column, drops nothing"

requirements-completed: [HOOK-01, HOOK-02, HOOK-03]

coverage:
  - id: D1
    description: "Pi new reaches SessionStart and SessionEnd hooks as clear; matchers filter on the mapped value"
    requirement: HOOK-01
    verification:
      - kind: e2e
        ref: "features/hook/session.feature#A new session runs SessionEnd with reason clear and SessionStart with source clear"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#A clear matcher selects the SessionStart run of a new session"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#A SessionEnd matcher selects the run for its reason"
        status: pass
      - kind: e2e
        ref: "features/plugin/session-start-hooks.feature"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#filters SessionStart matchers on the Claude-side source clear (D-CF5-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each compaction runs PreCompact, SessionStart compact, then PostCompact with compact_summary; two compactions run SessionStart twice; trigger matchers filter"
    requirement: HOOK-03
    verification:
      - kind: e2e
        ref: "features/hook/session.feature#A compaction runs SessionStart with source compact between PreCompact and PostCompact"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#A second compaction in a session runs SessionStart compact again"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#A compaction trigger matcher selects the PreCompact and PostCompact runs"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#session_compact runs SessionStart with source compact to completion, then PostCompact (D-CF5-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fork sends SessionEnd resume and SessionStart fork; RPC stop sends other; terminal quit sends prompt_input_exit; terminal reload runs no session hook; resume pinned by unit cases"
    requirement: HOOK-02
    verification:
      - kind: e2e
        ref: "features/hook/session.feature#Forking a session runs SessionEnd with reason resume and SessionStart with source fork"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#Stopping an RPC session runs SessionEnd with reason other"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#Reloading pi in the terminal runs no session hook"
        status: pass
      - kind: e2e
        ref: "features/hook/session.feature#Quitting pi in the terminal runs SessionEnd with reason prompt_input_exit"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#session_start dispatches SessionStart with source resume for Pi resume (D-CF5-01)"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 01: Hook session events Summary

**Session hooks now get Claude Code 2.1.316's values from one mapping site per event: Pi `new` is `clear` on SessionStart and SessionEnd, each compaction runs SessionStart `compact` between PreCompact and PostCompact (with `compact_summary`), fork is SessionEnd `resume` then SessionStart `fork`, a quit is `prompt_input_exit` in the terminal and `other` elsewhere, and Pi `/reload` runs neither event.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-01T15:00:00Z (approximate)
- **Completed:** 2026-11-01T15:50:28Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `hook-events.ts`: `SESSION_START_SOURCES` (`startup, resume, clear, compact, fork`) and `SESSION_END_REASONS` (`clear, resume, logout, prompt_input_exit, other`) build the closed matcher sets, so `clear`/`compact`/`fork` groups install without `--partial`.
- `claudeSessionStartSource` and `claudeSessionEndReason(reason, mode)` are the only mapping sites. The router builds the Claude-side event, `entryFires` filters on it, and the translator writes it to stdin.
- `session_start` keeps the SSDEDUP-01 key on Pi's raw reason, and returns before dispatch on `reload` once the hydrate, rebuild, and shared directories are done. `session_shutdown` is a `bind` wrapper with the same mode guard. It maps the reason with the live mode and returns on `reload`.
- `session_compact` runs SessionStart `{ source: "compact" }` to completion, then PostCompact, inside the same registration. The two paths share one extracted `prepareSessionStartDataDirs` helper. There are still 11 `pi.on` registrations.
- PreCompact and PostCompact matchers filter on `compactTrigger(reason)`, which fixes the bug where every entry fired. PostCompact stdin now carries `compact_summary`.
- Harness: the hook session step family, the any-order runs step, the no-runs step, and the embedded session-id projection.

## Task Commits

1. **Task 1: Send `clear` for Pi `new` end to end** - `6fcf732` (fix)
2. **Task 2: SessionStart `compact` between PreCompact and PostCompact** - `c05d6de` (fix)
3. **Task 3: Fork, quit, and reload through RPC and the terminal** - `04b6b71` (test)
4. **Deviation: dispatch-exec translator byte cases** - `0532099` (test)

## Step texts added (for later plans)

`features/step_definitions/hook/session.steps.ts`:

- `Given pi keeps only one recent token when the hooks session compacts` (must come before `pi runs with the scripted model`)
- `Given the user has prompted {string} with the hooks recording` (setup prompt; no turn)
- `Given the user has compacted the session with the hooks recording` (setup compaction; no turn)
- `Given the user has started pi in the terminal with the hooks recording` (needs a profile Pi first; waits for the terminal Pi's SessionStart `startup` run)
- `When the user starts a new pi session with the hooks recording`
- `When the user compacts the session with the hooks recording`
- `When the user forks the session at its first prompt with the hooks recording`
- `When the user quits pi with the hooks recording` (stops the profile Pi)
- `When the user reloads pi in the terminal with the hooks recording`
- `When the user quits pi in the terminal with the hooks recording`

`features/step_definitions/hook/runs.steps.ts`:

- `Then the hooks record these runs in any order:`
- `Then the hooks record no runs`
- The runs projection now replaces a session id inside a cell with its ordinal, for example `{project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env`.

## Red proofs

Task 1 (`npx cucumber-js features/hook features/plugin/session-start-hooks.feature`, seed 925247, before the product change): 5 of 6 scenarios failed.
- `session-start-hooks.feature`, both scenarios: the `source` column read `new` where `clear` was expected.
- "A new session runs SessionEnd with reason clear and SessionStart with source clear": the SessionEnd `reason` and the SessionStart `source` were both `new`. Every other column, including the projected `CLAUDE_ENV_FILE`, matched.
- "A clear matcher selects ..." and "A SessionEnd matcher selects ...": the setup install failed with `partially-available` / `unsupported hooks` (the `clear` and `other` groups dropped as `closed-set`).

Task 2 (`npx cucumber-js features/hook/session.feature`, seed of the red file in the scratchpad, before the product change): 3 of 6 scenarios failed.
- Compaction: no SessionStart row and no `compact summary` column.
- Second compaction: the runs table was empty, because no SessionStart `compact` ran.
- Trigger matcher: the `pre-auto` and `post-auto` hooks ran on a manual compaction.

Task 3: the four scenarios ran against the base product sources, which I put back in place for this one run and then restored to HEAD. All 4 failed.
- Fork: the install failed with `unsupported hooks`, because the `fork` group dropped.
- RPC stop: SessionEnd `reason: 'quit'`.
- Terminal quit: SessionEnd `reason: 'quit'`.
- Terminal reload: two runs, SessionEnd `reason: 'reload'` and SessionStart `source: 'reload'`.

The `compact_summary` literal comes from Pi. With `keepRecentTokens: 1`, the first compaction of a one-turn session is a split turn, and Pi writes `No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.` as the compaction entry's summary. D-CF5-04 asks for exactly that value, so the scenarios state it whole. The script needs one reply for the first compaction and two for the second, as the research spike measured.

## Gate seeds (three green runs of `features/hook` + `features/plugin/session-start-hooks.feature`, 13 scenarios each)

- 231485: 13 passed
- 852427: 13 passed
- 880484: 13 passed

## Verification

- `node --test` on the paired tests, `test/architecture/hooks-*.test.ts`, `test/bridges/hooks/**`, and `test/domain/components/**`: 1019/1019 passed.
- `npm run test:modules`: exit 0. `npm run test:unpaired`: exit 0. Hook integration tests (`test/integration/hooks-*.test.ts`), `test/index.test.ts`, and `test/edge/register.test.ts`: 386/386 passed.
- `npm run test:coverage:direct` for `hook-events.ts`, `session-start.ts`, `session-end.ts`, `post-compact.ts`, `dispatch.ts`, `event-router.ts`, and `dispatch-exec.ts`: exit 0 (100%).
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed.
- Acceptance greps: `SESSION_START_SOURCES` 4, `SESSION_END_REASONS` 4, `claudeSessionStartSource(` in the router 1, `| new |` in the migrated feature 0, `pi.on(` 11, funnel counts `hydrateScopeFromState(` 3 / `tryHydrateOnePlugin(` 2 / `hydrateProjectScopeForCwdWith(` 3 (unchanged).

## Decisions Made

- The terminal reload and quit scenarios start a profile Pi first, and install the plugin to the user scope through it. The terminal Pi then runs beside it in the same sandbox. See the deviations below.
- When the SessionStart leg of a compaction fails, it is debug-logged (`session_compact SessionStart skipped: ...`) and PostCompact still runs. A generation that goes stale during either leg stops the dispatch.
- The `session_shutdown` and `session_compact` callbacks are module-level helpers (`sessionShutdownCallback`, `sessionCompactCallback`, `runCompactionSessionStart`), and `CompositeHandler<E>` is a local type, so every closure stays under both complexity gates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The terminal scenarios use a profile Pi, not the shared Pi with a hand-made harness directory**
- **Found during:** Task 3
- **Issue:** The plan's terminal Given creates `harnessDirectory(home)` and installs through the run's shared Pi. The shared Pi then keeps the plugin's SessionEnd hook routed in memory. The next scenario's `Before()` empties the sandbox and runs RPC `new_session` on that shared Pi, so the stale SessionEnd hook runs the recorder. The recorder recreates `<home>/harness`, and the next profile Pi's `mkdir(harness)` fails.
- **Fix:** Both terminal scenarios start with `Given pi runs with the scripted model` and install through the profile Pi, which the scenario's release stops. The terminal Given reads `this.profileHarness()`.
- **Files modified:** features/hook/session.feature, features/step_definitions/hook/session.steps.ts
- **Committed in:** 04b6b71

**2. [Rule 3 - Blocking] Edited `test/bridges/hooks/dispatch-exec.test.ts`, which sibling plan 05-02 lists**
- **Found during:** wide unit run after Task 3
- **Issue:** Two translator byte cases failed. The SessionStart case passed Pi's event and expected `source` from it; the PostCompact case expected no `compact_summary`.
- **Fix:** A minimal edit to those two `TRANSLATOR_CASES` entries. The SessionStart case now passes `{ source: "startup" }` (benign omission `source`), and the PostCompact case expects `compact_summary: "summary"`. No import changed, which keeps the merge surface small.
- **Files modified:** test/bridges/hooks/dispatch-exec.test.ts
- **Committed in:** 0532099

**3. [Plan order] The Task 3 unit cases landed with Task 1**
- The resume, fork, and quit/mode cases in `session-start.test.ts`, `session-end.test.ts`, and `event-router.test.ts` were written with the mapping in Task 1, so the Task 3 commit holds only scenarios and steps.

**4. [Plan note] `test/architecture/hooks-lifecycle.test.ts` is unchanged**
- It pins only the order of the 11 registrations and the reload inertness, and both still hold.

---

**Total deviations:** 2 auto-fixed (both blocking), plus 2 notes on plan order.
**Impact on plan:** Both fixes were needed for a passing, non-leaking suite. There is no scope creep.

## Issues Encountered

- Inside this worktree, the isolation guard refused some compound shell commands, such as heredoc edits combined with npm or git. I made those edits through script files or the Edit tool instead.

## Parent lines

- `.agents/skills/cucumber/rules/features.md`, Run tokens. Replace the hooks ordinal bullet with: "In the hooks runs step, a cell whose whole value is a session id reads as the session's ordinal: `first`, `second`, `third`, or `fourth`, counted by the order in which each session first appears across the runs. A session id inside a cell, such as the one in the `claude-env-<id>.env` file that `CLAUDE_ENV_FILE` names, reads as the same ordinal in its place (D-CF5-26). A command never expands an ordinal."
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` (optional). Add: "A hook scenario that needs a Pi in the terminal starts a profile Pi first and installs through it, because a plugin installed through the run's shared Pi keeps its SessionEnd hook routed there until the next scenario's reset starts a new session."
- CHANGELOG candidate (for the docs plan's merged entry): "Plugin session hooks now receive Claude Code's values. A new session sends `clear`, each compaction runs SessionStart `compact` and gives PostCompact `compact_summary`, a fork sends SessionEnd `resume` and SessionStart `fork`, a quit sends `prompt_input_exit` in the terminal and `other` elsewhere, and `/reload` runs no session hook. Matchers on these values, and PreCompact/PostCompact `manual`/`auto`, now filter. Reinstall a plugin whose `clear`, `compact`, or `fork` hooks were dropped at install."

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later hook plans can use the session step family and the any-order and no-runs steps. They should not redefine them.
- `dispatch.ts` was changed in `entryFires` and `CompositeEventFor` only. The wave-2 fold rewrite can start from it.

## Self-Check: PASSED

- FOUND: features/hook/session.feature, features/step_definitions/hook/session.steps.ts, .planning/phases/05-hooks/05-01-SUMMARY.md
- FOUND commits: 6fcf732, c05d6de, 04b6b71, 0532099

---
*Phase: 05-hooks*
*Completed: 2026-11-01*
