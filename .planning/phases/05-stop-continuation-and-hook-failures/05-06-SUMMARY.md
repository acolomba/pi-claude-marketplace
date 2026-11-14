---
phase: 05-stop-continuation-and-hook-failures
plan: "06"
subsystem: hooks-docs
status: complete
tags: [hooks, docs, changelog, stop, live-uat]
requires: ["05-01", "05-02", "05-03", "05-04", "05-05"]
provides:
  - "docs/hooks-compatibility.md: the Stop continuation section, the failure, missing-script, and stop notices, the 10,000-character limit with its files, and the plain async lane"
  - "docs/output-catalog.md: hook-notice and stop-cap prose that matches the shipped notices"
  - "CHANGELOG.md: six reader-facing hook lines under the Unreleased entry of this pull request"
affects:
  - docs/hooks-compatibility.md
  - docs/output-catalog.md
  - docs/research/issue-103-stop-stopfailure-promotion.md
  - docs/research/claude-hooks-vs-pi-events.md
  - CHANGELOG.md
  - test/live-uat/
  - test/pi-runtime.ts
tech-stack:
  added: []
  patterns:
    - "An em dash in a quoted notice is written in words between two code spans, so the dash fixer has nothing to rewrite"
key-files:
  created: []
  modified:
    - docs/hooks-compatibility.md
    - docs/output-catalog.md
    - docs/research/issue-103-stop-stopfailure-promotion.md
    - docs/research/claude-hooks-vs-pi-events.md
    - CHANGELOG.md
    - test/live-uat/README.md
    - test/live-uat/manifest-absence-canary.mjs
    - test/live-uat/openai-stub-server.mjs
    - test/pi-runtime.ts
  deleted:
    - test/live-uat/stop-canary.mjs
decisions:
  - "The Stop canary is removed, not updated (open question 6 of 05-RESEARCH.md); the prompt-and-stop scenarios replace its scripted half."
  - "With the duplication marker removed, `npx fallow dupes` exits 0, so the marker is not restored and its comment is deleted whole."
metrics:
  duration: "~35 min"
  completed: 2026-11-14
estimate:
  tokens: 76000
actuals:
  tokens: 42300
  tasks: 3
  commits: 3
commits: 3
plan_head_before: d27eed86ccd693ee7a68eb6b9995327b668ac34c
plan_head_after: b2cd94fa5d21381b03ccf4eb5e539f94c6c356a0
---

# Phase 5 Plan 06: The Stop, Failure, Limit, and Async Records Summary

The hook compatibility page, the output catalog prose, two research notes, and the CHANGELOG now state what plans 05-01 to 05-05 shipped: a blocked `Stop` continues the same run on `agent_before_settle`, a failed hook shows its first stderr line, a missing script does not block, a `stopReason` shows, context over 10,000 characters goes to a file, and a plain `async` hook has no timeout. The operator-run Stop canary that asserted one `agent_settled` per block is gone.

`actuals.tokens` is chars/4 over the realized diff `d27eed86..b2cd94fa` (169,275 characters, most of it the deleted canary). The plan estimate counted reading as well.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-06-01 | `d9ab9dc1` | docs(hooks): describe the stop continuation and hook failure notices | 1 |
| 05-06-02 | `07f79e22` | docs(hooks): record the stop continuation in the catalog and changelog | 4 |
| 05-06-03 | `b2cd94fa` | test(hooks): remove the stop canary that counts a settlement per block | 5 (one deletion) |

Each commit went through the real hook on the first attempt. Tasks 1 and 2 stage no build input, so `npm run check:commit` was skipped. Task 3 stages `test/pi-runtime.ts`, and `npm run check:commit` reported Passed. Node v26.13.1, Linux. No Pi ran, no hook ran, and the canary was not run.

## Changed passages, by heading

docs/hooks-compatibility.md:

- "Current tool contract": the sentence that said Stop remains on `agent_settled` and that its migration belongs to a later phase now says that Stop runs on `agent_before_settle` and that the cap variable is not read (D-PG5-01, D-PG5-04).
- "Hooks in pi-subagents children": "sends the main session back for another turn" became "would continue the main session's run".
- "Events", row `Stop`: a blocked stop continues the same run, with a link to the renamed section.
- "Turn-boundary timing shift" is now "Stop continuation": the boundary event, the hidden message, one `agent_settled`, no second `before_agent_start`, `agent_start` and `agent_end` per continuation, the four modes on Pi 1.5.0 and 1.5.2 with no fallback, `StopFailure` on `agent_settled`, the five differences (async answer, busy session with typed input and Escape, other extensions, queued follow-up, no working indicator in one Pi 1.5.0 measurement), the two source-read statements marked as not measured, and the two scenario citations.
- "Handler fields", rows `timeout` and `async` (D-PG5-17).
- "`onFailure`": the missing-script failure on `UserPromptSubmit`, the stderr detail where Claude Code 2.1.323 writes its sentence, and `Stop` ignoring the field.
- "stdin, stdout, exit codes": rows `stop_hook_active` (continuation, and the rewake during `Stop` hooks), `Exit 2` (continuation, and a pointer to the missing-script row), `Other exit` (the notice, the 200-character cut, the seven events, the cases with no notice, the two start-failure texts, once per event and command in a bridge load, one notice for equal pair failures, the JSON array as plain text from 05-02), a new row `Missing script on exit 2`, `Large stdout or stderr`, `continue: false` (the three stop notices, the events with none, the reason not kept in the conversation), and `decision: "block"`.
- "Additional context": the `Stop` row, and new paragraphs on the limit, the wrapper, the preview cut, the file name, the folder for a user plugin and for a project plugin (inside the project directory, with a note on version control), the 30-day removal at a bridge load, the write-failure text, and the scenario citation.
- "Messages to the user": the count is now eleven, and seven new list items name the failure notice, the two start-failure texts, the missing-script notice, and the three stop notices, plus the unchanged model-facing `PreToolUse` reason.
- "Async and lifecycle", row `Long-running handlers` (D-PG5-18).

docs/output-catalog.md: the prose after the fenced block of "Hook notice" and of "Stop hook override cap reached". No heading, no catalog-state comment, and no fenced line changed.

docs/research/issue-103-stop-stopfailure-promotion.md: one dated note under the title. docs/research/claude-hooks-vs-pi-events.md: the key-findings `Stop` bullet and the mapping-table `Stop` row only (the new row text has the old cell lengths, so mdformat repadded no other row).

CHANGELOG.md: "hooks" joins the top line of the first Unreleased entry, and six sub-bullets follow its last one.

## Verification

| Command | Exit | Result |
|---|---|---|
| `SKIP=npm-check pre-commit run --files docs/hooks-compatibility.md` (final run) | 0 | mdformat repadded the tables on the first run; markdownlint MD038 flagged a code span with a trailing space, fixed |
| `SKIP=npm-check pre-commit run --files docs/output-catalog.md docs/research/... CHANGELOG.md` (final run) | 0 | clean |
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/hooks-notice-notify.test.ts test/architecture/catalog-uat/catalog-contract.test.ts` | 0 | 6 tests, 6 pass (324 states; the byte total unchanged) |
| `SKIP=npm-check pre-commit run --files test/live-uat/README.md test/live-uat/manifest-absence-canary.mjs test/live-uat/openai-stub-server.mjs test/pi-runtime.ts` (final run) | 0 | clean |
| `npx fallow dupes --quiet`, with the marker removed | 0 | no clone group; the marker was not restored |
| `npm run fallow` | 0 | clean |

Acceptance greps on the final tree: `agent_before_settle` 2 lines and `D-PG5-` 21 lines in the page; `Failed with non-blocking status code` 3, `Hook script appears to be missing` 2, `em dash` 3, `Operation stopped by hook` 3, `10,000` 3, `hook-output` 1 line. No literal U+2014 in any edited file outside `.planning/`. `stop-canary` appears 0 times in the README, the manifest-absence canary, the stub, and `test/pi-runtime.ts`. `hook error` and `D-PG5-` each appear on the expected prose lines of the catalog. `10,000` and `stopReason` each appear once in CHANGELOG.md.

The full `npm run check` (the wave 4 and phase gate) was not run, as the dispatch said. The orchestrator owns it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale statement] Two passages outside the interfaces list**
- The "Current tool contract" paragraph said Stop remains on `agent_settled` and that its migration belongs to a later phase. The child paragraph said a `Stop` hook "sends the main session back for another turn". Both are false after D-PG5-01, so I corrected them. The removed text named a phase; the new text names none.
- **Commit:** `d9ab9dc1`

**2. [Rule 1 - Accuracy] `Other exit` keeps its `⚠`**
- I first set the row to `✓`, then restored `⚠` with one sentence: upstream shows a `Stop` failure in its summary row, and the bridge shows a notice (record U4).

**3. [Rule 1 - Accuracy] The reload residual is narrower than the plan wording**
- The `Long-running handlers` row says that the next start stops a live process only on Linux, so on macOS and Windows nothing stops a plain `async` hook that never ends after the Pi that started it quits or crashes. A `/reload` in the same process still stops it on every system: `runtime.shutdownChildren()` sends SIGKILL with no platform gate. The Linux-only gate is in the orphan reap (`registry.ts`, `process.platform !== "linux"`).

**4. [Rule 1 - Comment accuracy] `test/pi-runtime.ts` lists the MCP adapter canary**
- The header listed two canaries. After the deletion one would remain, but `mcp-adapter-canary.mjs` also calls `resolvePiRuntime`. The comment now names both remaining canaries. Comment lines only.

**5. Small choices**
- README: "Unlike the scripted canary (which carries a synthetic always-block hook)" became "Unlike a synthetic always-block hook", and "What this proves beyond the scripted canary" became "What this run proved", so the dated record names no removed script. The observing hook's comment and items 3 and 4 say "always-block hook" for the `stop-observe.sh` variant, not "canary".
- README item 2 also says that Pi reads a queued message before `agent_before_settle`, so the Stop hooks run once after the drain.
- The manifest-absence comment above the removed marker said only that the block repeats in the deleted canary, so nothing true was left and the whole comment went.
- The catalog stop-cap prose says that the `8` in the notice text is the number of granted continuations, because the fenced text says "blocked 8 times in a row" while the ninth block trips it.

## Not documented (left for the verifier)

- The timed-out exit-2 edge of 05-03 (a hook that traps SIGTERM after its timeout and then exits 2 with a missing-file stderr passes as a plain noop). It is a flagged assumption, not a shipped behavior, so the page does not state it.

## Retained flags

- A1 (follow-up context edge), A2 (`SessionStart` context after a compaction): stated on the page as read from source and not measured.
- A3 (whether Claude Code delivers an async answer to a Stop continuation): not stated; the page says only what the bridge does.
- A5 (no working indicator): stated as one measurement on Pi 1.5.0.
- A4 (05-03), A6 (Linux only), A7 (05-04 write-failure cut), A8 (labels), A9 (Node 24 spawn text): unchanged.
- PG-HOOK-02 and PG-HOOK-21 unclassified edges: unresolved, as 05-01 and 05-05 left them.
- The prohibition (hook output in files without telling the user): resolved by the "Additional context" paragraphs, which name both folders, say that the project folder lies inside the project directory, and state the 30-day removal.

## Parent lines for the orchestrator

Collected from 05-01 to 05-05 and this plan. I edited none of these files.

1. PROJECT.md, the eight amendments of 05-CONTEXT.md "Parent lines for the orchestrator", with D-PG5-10, D-PG5-11, D-PG5-13, D-PG5-15, and D-PG5-18 marked as accepted without review.
2. BACKLOG.md:
   - close HOOKPROMPTSTOP-01;
   - narrow HOOKERRNOTE-01 to its `SessionEnd` half (`Stop` shows failure notices now);
   - ASYNCRELOADTABLE-01: a plain `async` hook has no timer after D-PG5-17, so outside Linux nothing stops one that never ends after a quit or a crash;
   - new: the follow-up context edge (A1);
   - new: an `async` answer that a Stop continuation does not read (F4, A3; the `deliverAs: "nextTurn"` question, open question 7);
   - new: no committed check of a Stop continuation in json and print mode, which research measured once;
   - new: the model-facing `PreToolUse` stop reason (`Operation stopped by hook` against upstream's `Execution stopped by PreToolUse hook`, U5);
   - new: a `stopReason` kept in the conversation;
   - new: `async` hooks left running when a print or json run ends;
   - reword the `asyncRewake` missing-script item to upstream's own rule (U2);
   - new: the per-entry and per-dispatch limits of Claude Code (U8).
3. `.planning/codebase/CONVENTIONS.md`: the `fallow-ignore` count goes down by one for this plan (the `code-duplication` marker in `manifest-absence-canary.mjs` is gone) and up by one for 05-01 (`unused-export` on `features/lib/run-start-probe.ts`). The `code-duplication` count drops from 28 to 27, and the sentence and list items about the spawn-and-timeout clone shared with `stop-canary.mjs` must go (two places: the dupes bullet and the Suppressions bullet). The `write-file-atomic-chokepoint` bullet still names `bridges/agents/stage.ts` (05-04).
4. `.planning/codebase/TESTING.md:194` names `stop-canary.mjs` among the live-UAT drivers.
5. `.planning/codebase/STACK.md` and `ARCHITECTURE.md`: `shared/atomic-json.ts` now also has `atomicWriteText` (05-04); the hooks bridge registers 13 `pi.on` call sites and Stop runs on `agent_before_settle` (05-01, optional).
6. `.planning/WINDOWS.md` entry 73 (`tests/live-uat/stop-canary.mjs`, a sandbox guard in the deleted file): its subject file is gone. Resolve it through a `gsd-tools windows` verb, prefixed `[parity-gaps]`, not by hand.
7. `.agents/skills/cucumber/rules/`: layout.md (the Stop continuation `When`, the run-start `Given`, the counts `Then`, `features/lib/run-start-probe.ts`, the saved-outputs `Then` of additional-context.steps.ts); features.md (the `{em dash}` run token); world-and-stand-ins.md (a plain `async` hook with `waits` no longer blocks its prompt).
8. VALIDATION.md: merge the evidence of all six summaries; PG-HOOK-21 wording says exit code 3, not 0, for the timeout scenario (05-05).
9. ROADMAP.md: the Phase 5 notes cite `docs/hooks-compatibility.md` lines that moved; the section is now "Stop continuation".
10. `rule-packs/architecture.json` (optional): the `write-file-atomic-chokepoint` message could also name `atomicWriteText`.
11. Before the pull request: offer to bump the version in `package.json`, `sonar-project.properties`, and `package-lock.json`.
12. The wave 4 and phase gate: `npm run check` on the combined tree, not run here.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-20: the page states each residual with its decision ID (the plain `async` hook outside Linux, D-PG5-18; the busy session while a Stop hook runs, D-PG5-07; other extensions at the boundary, D-PG5-05; the saved files, their folders, and the 30-day removal, D-PG5-15; the missing-script downgrade, D-PG5-08 and D-PG5-09). T-05-21: the marker was removed and not restored, because `npx fallow dupes` exits 0 without it, and `npm run fallow` exits 0. T-05-SC: no package installed or changed.

## Self-Check: PASSED

- FOUND: `d9ab9dc1`, `07f79e22`, `b2cd94fa` (each an ancestor of HEAD)
- `git rev-list --count d27eed86..b2cd94fa` = 3
- ABSENT as planned: test/live-uat/stop-canary.mjs
- FOUND: every file in key-files.modified
