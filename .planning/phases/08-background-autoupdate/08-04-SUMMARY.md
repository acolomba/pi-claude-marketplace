---
phase: 08-background-autoupdate
plan: 04
subsystem: testing
tags: [autoupdate, background, cucumber, behavioral-test, rpc, phase-gate]

requires:
  - "08-01: background gate, pass, and scheduler; the input listener in index.ts"
  - "08-02: RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS"
  - "08-03: the background-update payload kind and notifyBackgroundUpdate"
provides:
  - "features/marketplace/background-update.feature: Feature: Marketplace background update, one Scenario Outline over dir, file, url, and github"
  - "features/step_definitions/marketplace/background-update.steps.ts: Given pi runs with the background update delay {string}"
  - "features/step_definitions/session.steps.ts: When the user sends the message {string}"
  - "features/support/world.ts: usePiWithBackgroundUpdateDelay(value) over a private usePiWith(environment)"
  - "features/lib/pi-commands.ts: sendMessage(pi, message), BACKGROUND_RESULT_TIMEOUT_MS, BACKGROUND_RESULT_POLL_MS, a private readCustomEntries shared with readSession"
  - "features/lib/result-rows.ts: plugins in ROW_FIELDS; a background-update arm in pluginRowRecords"
affects: [phase merge (CHANGELOG, PROJECT.md, AGENTS.md, BACKLOG.md lines below), Phase 10 (owns features/** and _rpc.ts later)]

actuals:
  tokens: 9000
  tasks: 2
  commits: 1
plan_head_before: b945adb45c4cdd3a7f1bcd941cc12e8a68cc9028
plan_head_after: ff1f85ec310a5b3f2ee3985153634b599ef36044

tech-stack:
  added: []
  patterns:
    - "A plain RPC prompt fires Pi's input handlers and is then refused for want of a model; the driver reads the session entries that follow it until a payload arrives"
    - "Scenario-owned Pi starts share one private world helper that takes the whole environment"

key-files:
  created:
    - features/marketplace/background-update.feature
    - features/step_definitions/marketplace/background-update.steps.ts
  modified:
    - features/step_definitions/session.steps.ts
    - features/support/world.ts
    - features/lib/pi-commands.ts
    - features/lib/result-rows.ts
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "Step texts: `pi runs with the background update delay \"0\"` (mirrors the GitHub base address Given) and `the user sends the message \"hello\"`"
  - "sendMessage returns as soon as a claude-plugin payload follows the message; every payload present at that read is returned, so a leaked per-marketplace cascade fails the kind field or lastResult()'s exactly-one check"
  - "The private entries reader returns only custom entries (the filter readSession already applied), so both callers count and slice the same list"

requirements-completed: [AUP-01, AUP-02, AUP-03]

coverage:
  - id: D1
    description: "In a real Pi in RPC mode, the first plain message yields one background-update result (info, needs reload true, one plugin row demo | tools | project | 1.0.0 | 1.10.0), and list then shows demo at 1.10.0, for dir, file, url, and github marketplaces"
    requirement: AUP-01
    verification:
      - kind: behavioral
        ref: "features/marketplace/background-update.feature#The first message updates the plugins of an autoupdate marketplace in the background (4 rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The scenario fails without the change: with the input registration removed from index.ts every row fails at the message step"
    requirement: AUP-03
    verification:
      - kind: other
        ref: "local RED run (never committed), recorded under Gate evidence"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run check exits 0 on the phase's combined tree"
    requirement: AUP-02
    verification:
      - kind: other
        ref: "npm run check (Gate evidence)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-27
status: complete
---

# Phase 8 Plan 04: Background Update Behavioral Proof and Phase Gate Summary

**A cucumber Scenario Outline starts its own Pi with no background update delay, sends a plain message, and reads exactly one `background-update` result naming `demo` 1.0.0 -> 1.10.0 for dir, file, url, and github marketplaces; with the `input` listener removed, every row fails at the message step.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-27T04:43:07Z
- **Completed:** 2026-10-27T04:52:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified) plus this SUMMARY

## Accomplishments

- `features/marketplace/background-update.feature`: one Outline that mirrors `update.feature`'s "Autoupdate exposes the offered version in a new session" setup, then `When the user sends the message "hello"`, the field step (`kind background-update`, `severity info`, `needs reload true`), the plugin row step (`name | marketplace | scope | from version | to version`), and `list --scope project` showing `demo` at `1.10.0`. Examples: untagged `dir`/`file`, `@url`, `@github`.
- `sendMessage` reads the session's custom entries, sends `{ type: "prompt", message }`, asserts the exchange was quiet and that Pi refused the prompt (`command: "prompt"`, `success: false`), then polls `get_entries` every 100 ms for up to 20 s until a `claude-plugin` payload follows the message, validating each against the payload schema (DRV-01).
- The world's `usePiWithGitHubBaseUrl` and the new `usePiWithBackgroundUpdateDelay` share one private `usePiWith(environment)`, so no clone group forms.
- `result-rows.ts` hides a `background-update`'s `plugins` from the field steps and lets `the result lists these plugins:` read them, one record per row.
- The cucumber world rules name the new helper, the new row array, and how the driver reads a plain message's background result.

## Task Commits

1. **Task 1: A scenario proves the background update after the first message** - `ff1f85ec` (test). The commit hook ran `npm run check:commit` (Passed), without `--no-verify`.
2. **Task 2: The phase gate passes and the SUMMARY carries the phase deliverables** - this SUMMARY's docs commit (no code change).

## Files Created/Modified

- `features/marketplace/background-update.feature` - the Outline over the four marketplace kinds
- `features/step_definitions/marketplace/background-update.steps.ts` - the delay Given
- `features/step_definitions/session.steps.ts` - the send-message When; fileoverview extended
- `features/support/world.ts` - `usePiWithBackgroundUpdateDelay`, private `usePiWith`, `pi` getter doc
- `features/lib/pi-commands.ts` - `sendMessage`, the two constants, `readCustomEntries`, `SESSION_ENTRY`
- `features/lib/result-rows.ts` - `plugins` row array and the `background-update` arm
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - three rule sentences

## CHANGELOG line

For the parent session to place under `## [Unreleased]` (as a sub-bullet of the milestone PR's entry, per the changelog skill; the PR number goes on the top line):

- After your first message, Pi updates the plugins of each autoupdate marketplace in the background. One notice names them and asks for `/reload`. Claude Code's opt-out variables, such as `DISABLE_AUTOUPDATER`, turn this off.

## Decision rows

Rows in PROJECT.md's Key Decisions shape, for the parent session to append at merge:

| Decision | Rationale | Outcome |
| --- | --- | --- |
| D-PL8-01: the background autoupdate pass is not a load. A load still changes no installation state (APL-D1); the pass is a separate run after the first message that runs `marketplace update`'s refresh and cascade for each marketplace whose autoupdate is on. NFR-5 amended. | Claude Code updates opted-in marketplaces unattended; reusing the command keeps one refresh and cascade. | ✓ Good |
| D-PL8-02 / D-PL8-13: the pass arms on the first Pi `input` of an extension runtime in `tui` or `rpc` mode, from any input source, and runs once per runtime after a random delay of up to ten minutes on an unref'd timer. | Divergence, licensed by a Pi capability gap: Claude Code claims once per process, and Pi has no process-lifetime hook for an extension (`/reload`, new, resume, and fork rebuild the runtime). | ✓ Good |
| D-PL8-03 / D-PL8-15: `session_shutdown` cancels the timer and stops further steps; for every reason but `quit` it awaits the step in flight. A stopped runtime never notifies; no throw leaves the input, shutdown, or timer handlers (NFR-2). | The next runtime's load never meets this runtime's state lock; a stale context never receives a notice. | ✓ Good |
| D-PL8-04 / D-PL8-05: an in-process gate runs every `/claude:plugin` command through `runForeground`, so a command waits for at most one background step, silently. A step that meets another process's state lock is skipped for this runtime. | No upstream position (Claude Code has no state lock); chosen from project constraints, with D-06 (`retries: 0`) unchanged. Known limit: the gate has no timeout. | ✓ Good |
| D-PL8-06: the pass reuses `updateMarketplace` with a silent load-origin run and the update runner wrapped to yield before each plugin and collect `updated` outcomes. | One refresh, cascade, rollback, and cache-drop path. | ✓ Good |
| D-PL8-07: a marketplace's autoupdate default stays "off unless the config sets it"; `marketplace/autoupdate.ts` is unchanged. | The official marketplace gets `autoupdate: true` from `bootstrap` and MKT-01 keeps `bootstrap` the route to an official name; Claude Code's other default-on sources (`claudeai`, `pluginDirectory`) have no Pi counterpart (Pi capability gap). | ✓ Good |
| D-PL8-08: Claude Code's opt-out variables `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `FORCE_AUTOUPDATE_PLUGINS` are honored with Claude Code's names and rule. | Upstream parity: a user migrating from Claude Code already knows these names. | ✓ Good |
| D-PL8-09 / D-PL8-14: the Pi-only `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` replaces the ten-minute maximum; a value that is not whole digits, or is above 2147483647, is ignored. | Divergence, licensed as a recorded project decision: the behavioral test and an operator need the pass without a ten-minute wait; Node clamps larger delays to 1 ms. | ✓ Good |
| D-PL8-10 / D-PL8-16: one load-origin `background-update` notice at `info` severity, `Plugin updated: <name> · Run /reload to apply` (two names joined with "and", three or more counted), deduplicated by plugin and marketplace; the JSON payload has `needsReload: true` and one row per updated install with an optional `fromVersion`. | Divergence, licensed by a Pi capability gap: `/reload` for Claude Code's `/reload-plugins` (Pi's command name). Divergence, licensed by a Pi capability gap: Pi's `ctx.ui.notify` has no priority or timeout, where Claude Code's notice is low priority with a ten-second timeout. | ✓ Good |
| D-PL8-11: no in-session reload; the notice always asks for `/reload`. | Divergence, licensed by a Pi capability gap: Claude Code reloads only command-sourced plugins in session, and this project has no command source kind. | ✓ Good |
| D-PL8-12: the pass uses stored credentials only, with no Device Flow, through the load-origin run. | Parity with Claude Code's "never prompts" background check (AAP-02 / D-13 behavior reused). | ✓ Good |

### NFR-5 amendment text

Apply in both places at merge:

- `.planning/PROJECT.md`: the NFR-5 heading today reads "amended by url-source, by D-03-03, and by D-MF-04". Make it "amended by url-source, by D-03-03, by D-MF-04, and by D-PL8-01".
- `AGENTS.md`: the NFR-5 heading today reads "amended by url-source, by D-03-03, by D-MF-04, and by AAP-D1". Make it "amended by url-source, by D-03-03, by D-MF-04, by AAP-D1, and by D-PL8-01".
- In both, add this sentence after the AAP-D1 sentence (PROJECT.md: after the D-MF-04 sentence): "The background autoupdate pass runs `marketplace update`'s code for each marketplace with autoupdate on, so it may use the network as that command does, with stored credentials only (D-PL8-01, D-PL8-12)."
- Phase 9 (PKD-03) also amends NFR-5; merge the two amendments in one heading.
| D-PL8-17: a background pass that ends early on an invalid GitHub base override still raises the notice for plugins already moved. | No Claude Code position (its pass has no such failure); follows AUP-03. | ✓ Good |
| D-PL8-18: before each plugin update the pass re-reads the marketplace's `autoupdate`; a mid-cascade `noautoupdate` stops the rest of that marketplace. | No Claude Code position (single-process model); follows the user's opt-out. | ✓ Good |

## Backlog dispositions

- `AUTOUP-01` (autoupdate is a manual-trigger flag, not a background update): **closed**, resolved by this phase (AUP-01, AUP-02, AUP-03) through D-PL8-01 through D-PL8-16. The flag now also opts a marketplace into the unattended pass after the first message, with Claude Code's opt-outs and its notice.
- Out of scope, stays deferred: retrying a marketplace another process held within one runtime; a visible waiting line while a command waits on the gate; the missing-dependency settle after a background update, which Phase 2 owns through RCN-06 (the pass inherits whatever the reused cascade does).

## Files touched outside the Files line

ROADMAP Phase 8's Files line names `index.ts` (session hook only), a new `orchestrators/marketplace/background-update.ts` (or similar), `orchestrators/marketplace/autoupdate.ts` (defaults only), `shared/notification-types.ts`, and `docs/`. From `git diff --stat 1f9e4435 -- . ':(exclude).planning'`, the phase also touched:

- `extensions/pi-claude-marketplace/edge/register.ts` - the gate's command wrap: the command handler is the only place a `/claude:plugin` command can run through `runForeground` (08-01).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts` and `background-pass.ts` - the extra background modules beside `background-update.ts`: the gate, and the pass that reuses `updateMarketplace`, each with its own paired test (08-01, 08-03).
- `extensions/pi-claude-marketplace/shared/notification-{resolve,grammar,json,wire,dispatch}.ts` - each is an exhaustive consumer of the raw surface union, so the new kind needs an arm in each (08-03).
- `schema/claude-plugin.schema.json` - regenerated from the payload schema; the wire-schema drift test compares it (08-03).
- `test/e2e/_rpc.ts` - the delay knob reaches the scenario's Pi; `rpcChildEnvironment` is an allowlist (08-02).
- `features/marketplace/background-update.feature`, `features/step_definitions/marketplace/background-update.steps.ts`, `features/step_definitions/session.steps.ts`, `features/support/world.ts`, `features/lib/pi-commands.ts`, `features/lib/result-rows.ts` - the behavioral test AGENTS.md requires (08-04).
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the cucumber rules describe the new world helper, row array, and driver behavior (08-04).
- Test files: `test/orchestrators/marketplace/background-{gate,pass,update}.test.ts`, `test/edge/register.test.ts`, `test/index.test.ts` (08-01); `test/architecture/hermetic-git-environment.test.ts` (08-02); `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts`, `test/architecture/{background-update-notice,wire-schema,no-credential-leak}.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts` (08-03). Each is a paired owner test needed for 100% direct coverage, or a gate that pins the payload kinds.

`extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` is unchanged (D-PL8-07). `CHANGELOG.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`, and `AGENTS.md` are unchanged; the parent session applies the lines above at merge.

## Uncertain choices (for user review)

From 08-CONTEXT.md:

1. D-PL8-02: the mode gate counts `rpc` as interactive, beside `tui`. Alternative: `tui` only, treating `rpc` like Claude Code's SDK or `-p`.
2. D-PL8-02: the pass arms again in each extension runtime (`/reload`, new, resume, fork). Alternative: once per process through process-global state.
3. D-PL8-03: `quit` does not wait for the step in flight. Alternative: wait on every shutdown reason, which could hold Pi's exit on a slow fetch.
4. D-PL8-04: a command waits silently on the gate. Alternative: a "waiting" line, or refusing the background step.
5. D-PL8-05: cross-process contention is unchanged; a command in another Pi process can still get `{lock held}`. Alternative: lock retries for foreground commands, which reverses D-06.
6. D-PL8-07: no read-time official-name default. Gap: an official-named marketplace declared without `autoupdate` stays off here and is on in Claude Code.
7. D-PL8-08: Claude Code's own variable names are read in Pi. Unsettled: whether Claude Code's `D.bool()` accepts exactly `1`, `true`, `yes`, and `on`.
8. D-PL8-09: a Pi-only delay variable with no Claude Code counterpart.
9. D-PL8-10: Claude Code's one-line notice wording instead of the house row grammar.
10. Known limit: the gate has no timeout, so a stalled background fetch holds a waiting command.

Made while planning and executing:

11. The gate, the pass, and the scheduler are three modules (`background-gate.ts`, `background-pass.ts`, `background-update.ts`).
12. The scheduler uses Node's global timers, driven in tests by `t.mock.timers`, with `random` and `env` injected.
13. A plugin update skipped after shutdown is a failed outcome with the note `the session ended before this update ran` and an empty reason list (08-01).
14. The resolve step redacts all four string fields of a row (`name`, `marketplace`, `fromVersion`, `toVersion`); the credential-leak row plants the URL in the name as well as the version, because the one-plugin text shows only the name (08-03).
15. `needsReload` is narrowed to `true` in the schema.
16. `plugins` is a cucumber row array: the field steps hide it and `the result lists these plugins:` compares it.
17. Deduplication by plugin and marketplace prints "alpha and alpha" for two same-named plugins of two marketplaces, where Claude Code, which strips `@marketplace` before it deduplicates, prints "alpha" (RESEARCH A5).
18. 08-01 test readings: scheduler case 8 as the cross product of six opt-outs with three force spellings (18 rows); the NFR-2 case split per handler; the index arming case deletes all four Claude Code variables; pass case 10 observes the wait through a wrapper around `beginStep`.
19. 08-02: the docs H2 is "Variables that control the background update", not "Variables the extension reads", because the extension reads other variables that section does not list.
20. 08-03 test readings: the pass's notice case uses two marketplaces in two scopes rather than one plugin in both scopes; the stopped-runtime case stops after the last marketplace.
21. 08-04, after review WR-01: the message step polls until the payload count holds for a 1 s quiet window (`BACKGROUND_RESULT_QUIET_MS`), and asserts the prompt's own answer carries no payload (WR-02). Alternative: a longer window, at the cost of scenario time.
- Known limit (review IN-04): the shutdown wait for a background step in flight has no timeout, so a stalled fetch also holds `/reload`, new, resume, and fork. Alternative: a wait cap, after which the next runtime may meet `{lock held}` at load.

## Artifacts this phase produces

- 08-01: `orchestrators/marketplace/background-gate.ts` (`createBackgroundGate`, `BackgroundGate`), `background-pass.ts` (`createBackgroundPass`, `BackgroundPassDeps`, `BackgroundContext`), `background-update.ts` (`createBackgroundUpdate`, `BackgroundUpdate`); `registerClaudePluginCommand`'s optional `runForeground`; `index.ts` registers `input` and `session_shutdown` listeners.
- 08-02: `RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`; hermetic cases for the five variables; `docs/env-vars.md` "Variables that control the background update".
- 08-03: `BackgroundUpdatePlugin`, `BackgroundUpdateSurface`; `notifyBackgroundUpdate(ctx, run, plugins)`; wire payload kind `background-update` (23 members in `schema/claude-plugin.schema.json`); `docs/json-output.md` kind and row sections; `docs/output-catalog.md` `background-update-{one,two,many}` blocks locked by `test/architecture/background-update-notice.test.ts`.
- 08-04: `features/marketplace/background-update.feature`; `features/step_definitions/marketplace/background-update.steps.ts`; the send-message When in `session.steps.ts`; `usePiWithBackgroundUpdateDelay` and private `usePiWith` in `world.ts`; `sendMessage` and its constants in `pi-commands.ts`; the `plugins` row array in `result-rows.ts`; the cucumber rule sentences.

## Gate evidence

- **Command:** `npm run check` (output redirected to a file; exit status read from the shell, not through a pipe)
- **Exit status:** 0
- **Commit:** `ff1f85ec` (HEAD after Task 1; the tree was clean apart from this untracked SUMMARY)
- **Node:** v26.12.1
- **Scope:** the whole tree, the phase's combined tree (08-01 through 08-04)
- **Steps:** `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, `test:integration`, `test:cucumber` (905 scenarios, 9044 steps, all passed), `test:coverage:direct:all` (294 merged records in `coverage/direct.lcov`)

RED proof (Task 1, local only, never committed): with `pi.on("input", backgroundUpdate.onInput);` deleted from `extensions/pi-claude-marketplace/index.ts`, `npx cucumber-js --name 'The first message updates the plugins of an autoupdate marketplace in the background'` exited 1: 4 scenarios (4 failed), 60 steps (36 passed, 20 skipped, 4 failed). Every row failed at `When the user sends the message "hello"` (`features/step_definitions/session.steps.ts:53`) with `AssertionError [ERR_ASSERTION]: no claude-plugin result followed the message "hello" within 20000 ms`. The line was restored with an Edit, and `git status --short extensions/` printed nothing. With the line in place the same command exited 0: 4 scenarios (4 passed), 60 steps (60 passed).

## Deviations from Plan

None - plan executed as written. The plan restored the RED edit with `git checkout -- extensions/pi-claude-marketplace/index.ts`; the orchestrator required an Edit instead, so the line was restored with an Edit and checked with `git status --short extensions/`.

## Issues Encountered

None. The scenario passed on its first run, and the Task 1 commit passed the hook on its first attempt.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The parent session applies the CHANGELOG line, the decision rows, the NFR-5 amendment, and the AUTOUP-01 disposition at merge.
- Phase 8 is complete: AUP-01, AUP-02, and AUP-03 are proven.

---
*Phase: 08-background-autoupdate*
*Completed: 2026-10-27*

## Self-Check: PASSED

- FOUND: features/marketplace/background-update.feature, features/step_definitions/marketplace/background-update.steps.ts
- FOUND: ff1f85ec (ancestor of HEAD)
- Every section, decision ID (D-PL8-01..16), and backlog ID the Task 2 verify lists is present; CHANGELOG.md, PROJECT.md, BACKLOG.md, and AGENTS.md are unchanged since 1f9e4435.

## Follow-up decisions (2026-10-27)

Quick task 261027-9nh carried out five user decisions after this phase closed. The decisions below reverse or extend the ones above.

- **D-PL8-07 (reversed).** With no value in either config layer, a marketplace's autoupdate is Claude Code's default: on when its lowercased name is one of the 14 official names other than `knowledge-work-plugins` and `first-party-plugins`, off otherwise. Every reader applies it (`domain/official-marketplaces.ts::effectiveMarketplaceAutoupdate`). Claude Code's `claudeai` and `pluginDirectory` default-on sources stay a Pi capability gap.
- **D-PL8-02, mode half (reversed).** Only `tui` arms the background update; `rpc`, `json`, and `print` never arm it. Per-runtime re-arming is unchanged.
- **D-PL8-19.** `bootstrap` writes no autoupdate value; its autoupdate step reports `(skipped) {already autoupdate}` unless a config layer set the value off.
- **D-PL8-20.** The cucumber suite drives Pi over RPC only, so `background-update.feature` proves the RPC negative. The pass, the notice dedupe, and the wait cap are proven by unit tests. The `background-update` wire kind stays in the schema, although no json or rpc session emits it.
- **D-PL8-21 (amends D-PL8-10).** The notice dedupes by the bare plugin name in first-seen order; the JSON payload keeps one row per updated install.
- **D-PL8-22.** A plugin update the pass did not run (runtime stopped, or pass halted after an abort) is a skipped outcome with a note and an empty reason list. D-PL8-18's autoupdate-off outcome stays failed.
- **D-PL8-23.** `runForeground` and a reload, new, resume, or fork shutdown wait at most 30 000 ms for the step in flight. At the cap the gate aborts the step's signal, logs one debug line, and waits for the step to end. `quit` is unchanged. There is no environment knob.
- **D-PL8-24.** The abort reaches git through an `AsyncLocalStorage` scope in `platform/git.ts` (`runWithGitAbortSignal`). It stops HTTP hops and response bodies, and it fails a network call that the scope aborted while it ran, so an aborted step fails like a network drop mid-request.
- **D-PL8-25.** After an aborted step the pass runs no further step in that runtime. An unfinished aborted plugin update is skipped; a finished one keeps its outcome. The plugins that moved before the abort are still named while the runtime is alive.

D-PL8-23 closes the "no gate timeout" known limit and review IN-04. These decisions settle 08-04 uncertain choices 1 (D-PL8-02), 6 (D-PL8-07), 10 (D-PL8-23), 13 (D-PL8-22), and 17 (D-PL8-21).
