---
phase: 01-foundation
verified: 2026-11-08T07:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .agents/skills/cucumber/rules/layout.md
  - .planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md
  - .planning/phases/01-foundation/01-01-PLAN.md
  - .planning/phases/01-foundation/01-01-SUMMARY.md
  - .planning/phases/01-foundation/01-02-PLAN.md
  - .planning/phases/01-foundation/01-02-SUMMARY.md
  - .planning/phases/01-foundation/01-03-PLAN.md
  - .planning/phases/01-foundation/01-03-SUMMARY.md
  - .planning/phases/01-foundation/01-04-PLAN.md
  - .planning/phases/01-foundation/01-04-SUMMARY.md
  - .planning/phases/01-foundation/01-05-PLAN.md
  - .planning/phases/01-foundation/01-05-SUMMARY.md
  - .planning/phases/01-foundation/01-06-PLAN.md
  - .planning/phases/01-foundation/01-06-SUMMARY.md
  - .planning/phases/01-foundation/01-07-PLAN.md
  - .planning/phases/01-foundation/01-07-SUMMARY.md
  - .planning/phases/01-foundation/01-08-PLAN.md
  - .planning/phases/01-foundation/01-08-SUMMARY.md
  - features/lib/earlier-version-state.ts
  - features/lib/github-device-flow/extension.ts
  - features/lib/github-device-flow/routing.ts
  - features/lib/github-device-flow/server.ts
  - features/lib/hook-files.ts
  - features/lib/hook-recorder.ts
  - features/lib/pi-json-mode.ts
  - features/lib/pi-process.ts
  - features/lib/pi-tui.ts
  - features/lib/plugin-picker.ts
  - features/lib/scripted-model/script.ts
  - features/lib/state-lock-holder.ts
  - features/support/world.ts
covered_digest: "v4:sha256:e4d6aa31ea3024666f85bad21e2b38cfe8d841e74126ac9aab81773ced9e40c4"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Every stream phase can write its scenarios by adding only its own feature files and verb step modules. The stand-ins, fixture writers, drivers, and shared steps the streams name exist, each proven by a seed scenario; every shared file is frozen; the child sessions have their brief; and the combined tree passes `npm run check`.
**Verified:** 2026-11-08T07:30:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Gate evidence (cited, not re-run)

`npm run check` passed on the combined tree at HEAD `c82fe347`: static checks all passed, cucumber 1640 adapter and 148 builtin scenarios passed, direct coverage merged 350 records, exit 0. The verifier re-ran only narrow checks (below).

## Goal Achievement

### Observable Truths (ROADMAP Phase 1 success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each named stand-in, fixture writer, and driver has a passing seed (FND-01) | VERIFIED | Every seed title the layout rules list exists in the stream's feature file (table below, 23 of 24 by exact title, the 24th retitled). Libraries exist: `hook-recorder.ts`, `hook-files.ts`, `github-device-flow/{extension,server,routing}.ts`, `pi-tui.ts`, `plugin-picker.ts`, `pi-json-mode.ts`, `earlier-version-state.ts`, `state-lock-holder.ts`, `scripted-model/**`. Verifier re-ran `features/hook/async.feature` + `features/plugin/browse.feature` under `adapter`: 11 scenarios, 119 steps passed, and no `hooks/wake.sh` process left behind. |
| 2 | The derived stand-ins have passing seeds (error turn, automatic compaction, json and terminal run, stale lock) (FND-01) | VERIFIED | `hook/stop-failure.feature` (error turn), `hook/compaction.feature` (auto compaction), `plugin/bootstrap.feature` (json mode and terminal), `marketplace/state-lock.feature` (dead holder's lock). All covered by the green gate. |
| 3 | Every seed passes `test:cucumber` under both profiles; only an MCP-surface seed is `@mcp`; `check:features` green; layout rules carry the ownership table and reserve names (FND-01, FND-02) | VERIFIED | Gate: 1640 adapter + 148 builtin passed, `check:static` (includes `check:features`) passed. Only `mcp-server/legacy-move.feature` carries `@mcp` among the 12 seed files (grep). `layout.md` "Behavioral gaps" section holds the frozen list, the 16-row ownership table, the reserved names for Phases 2-16, and a per-phase Seeds list. |
| 4 | Frozen list matches what Phase 1 left; child-session brief exists and agrees with Milestone rules; root `DUBIOUS-CHOICES.md` exists (FND-02) | VERIFIED | `layout.md` lines 134-143 match the ROADMAP "Frozen after Phase 1" bullets. Brief (103 lines) covers branch, workspace, push-nothing (D-BG-16), commit titles with no identifiers, no `--no-verify`/rebase, frozen files, parent lines, never-edited files, `[behavioral-gaps]` WINDOWS prefix, `## Threat Flags`, dubious-choices protocol, gates, BLOCKED.md. Root log `.planning/DUBIOUS-CHOICES.md` exists. All 8 plan SUMMARYs have `## Threat Flags`. No product code changed since the branch point (`git diff --stat` over `extensions/` empty); only `test/e2e/_rpc.ts` among the other frozen build/harness paths changed outside `features/`, as planned. |
| 5 | `npm run check` passes at the Phase 1 head; CI timeouts hold the measured run; the fifteen local branches exist (D-BG-16, FND-02) | VERIFIED (with a note) | Gate passed at HEAD. Legs timed locally in the brief: 1 min 50 s, 3 min 08 s, and the builtin leg, against 15-minute job timeouts. `git branch --list` shows `features/behavioral-gaps-phase-2` through `-16`, all local. Note: they sit at `6c04eb67`, before the 17 review-fix commits (see Findings). The brief tells each child to merge the local milestone branch first, so this is covered. |

**Score:** 5/5 truths verified, 0 behavior-unverified.

### Seed coverage per stream (goal-backward)

| Phase | Feature file | Seed(s) found by exact title | Shared steps/stand-ins it exercises |
| --- | --- | --- | --- |
| 2 | `hook/async.feature` | all 5 | async recorder lifecycle, release, rewake summary, crash (`PiProcess.crash`), terminal reload |
| 3 | `hook/stop-failure.feature` | 1 of 1 | scripted-model `error` column |
| 4 | none (no seed by design) | n/a | Phase 4 creates the file |
| 5 | `hook/compaction.feature` | 1 of 1 | scripted-model `context tokens` column, `keepRecentTokens: 1` Given |
| 6 | none (no seed by design) | n/a | Phase 6 creates the file |
| 7 | `plugin/state-migration.feature` | 3 of 3 | 0.6.0, 0.19.2, and newer-schema writers |
| 8 | `plugin/config-migration.feature` | 2 of 2 | 0.4.3 writer, config-deletion step |
| 9 | `mcp-server/legacy-move.feature` | 1 of 1 (`@mcp`) | 0.19.2 `mcp.json` writer beside user entry |
| 10 | `plugin/model-tools.feature` | 2 of 2 | scripted model tool calls, argument-validation projector |
| 11 | `marketplace/device-flow.feature` | 2 of 2 | loopback Device Flow stand-in, in-process redirect, routing rule, terminal routing |
| 12 | `plugin/browse.feature` | 2 of 3 by title | picker driver over `pi-tui.ts` (list, choose, cancel) |
| 13 | `plugin/prune.feature` | none, by design | n/a |
| 14 | `plugin/bootstrap.feature` | 2 of 2 | json-mode run, terminal run |
| 15 | `marketplace/state-lock.feature` | 1 of 1 | dead-process stale lock |
| 16 | `plugin/subagent-child.feature` | 1 of 1 | `PI_SUBAGENT_CHILD=1` background-child profile Pi |

Verb modules (`hook/async.steps.ts` etc.) do not exist yet, by design: the layout rules reserve them and every seed's steps live in shared and topic modules. Verified by `ls`.

### Required Artifacts / Wiring

All libraries above exist, are substantive (the seeds drive them end to end through real Pi processes, a loopback server, and a pty), and are wired (`check:features` fails on any unused shared step, and it passed). Level 4: the seeds read real Pi output, request logs, files on disk, and the terminal screen model, not canned data.

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| FND-01 | SATISFIED | Truths 1-3 |
| FND-02 | SATISFIED | Truths 3-5 |

No orphaned requirements: REQUIREMENTS.md maps only FND-01 and FND-02 to Phase 1.

### Review and security records

- `01-REVIEW.md`: 3 Critical, 11 Warning, 7 Info. `01-REVIEW-FIX.md`: 18 fixed, 2 skipped by judgment (IN-05, IN-06 after a measurement), 1 no change needed (IN-03). All three Criticals (CR-01 crash group kill, CR-02 release marker, CR-03 cancel scenario) are fixed with recorded red proofs.
- `01-SECURITY.md`: `threats_open: 0`.
- `01-VALIDATION.md`: all tasks green, no manual-only items.

## Findings (none block the goal)

Classification: no BLOCKER. Items below are WARNING or Info and need parent follow-up or user review, not a Phase 1 rework.

### The three "requires human verification" review fixes (CR-02, WR-05, WR-07): accepted

- **CR-02 / WR-07** (`hook-files.ts` marker `rm`, `waitForHookLifecycle` reads only new log lines, `hook-recorder.ts`, `session.steps.ts`, world `callsPastScript()`): the diff is small and sound (the script removes the marker it took, so one release frees one run). Behavioral evidence: `async.feature` 5/5 green in the fixer's run, in the gate, and in the verifier's run, with a recorded red proof (no `rm` fails `:57`). The remaining unknown is flake rate on a slow CI runner, which a single local measurement cannot settle. Accepted as covered.
- **WR-05** (picker notice heuristic: a row counts when its trimmed text appears after the mark, second word is the plugin, and it has a `(status)`): `browse.feature` 6/6 green here, red check recorded. The known limit (a full redraw that rewrites an old notice still matches) is logged as P1-DC-61. Accepted; Phase 12 owns the file and may tighten it.

### Fifteen branches sit at `6c04eb67`, not at the final head (WARNING, parent action)

ROADMAP criterion 5 and the brief ("created ... at the verified Phase 1 head") say the branches are at the verified head. They were created by plan 01-08 and the milestone branch then gained the review, security, validation, review-fix, and this verification commits. P1-DC-16 and P1-DC-56 record this, and brief step 4 has each child run `git merge features/behavioral-gaps` before anything else, so no child can miss the fixes. Because no child exists yet, the parent can cheaply fast-forward each branch to the commit that carries this report (a plain `git branch -f` from the milestone checkout, or `git branch -f` per branch) before launching the children; that removes the extra merge and makes the brief literally true. Not required for the goal.

### Stray write to the real `~/.pi` (Medium, open, recurring)

`/home/acolomba/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json` has `lastRefreshedAt` 2026-11-08T07:15:22Z, which falls in the gate run that just passed. The earlier logged write was 05:39:05Z. So the file is rewritten on every `npm run check`, which is a hermeticity leak in the existing test suite. The verifier ran the four suspects (`test/orchestrators/marketplace/{update,add}.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/architecture/config-state-consistency.test.ts`) under a scratch `HOME` with `PI_CODING_AGENT_DIR` unset: all passed and none wrote the file under the scratch home. The writer is still unknown and is probably outside those four. Phase 1 changed no product code or unit test beyond three `test/architecture` harness tests, so this is not attributable to Phase 1, and it does not affect the goal. Left for the user (P1-DC-53, P1-DC-68).

### Documentation drift (Low, parent lines)

- `.agents/skills/cucumber/rules/layout.md:214` (frozen) names the Phase 12 seed "Cancelling the terminal picker installs nothing"; CR-03 retitled it "Cancelling the terminal picker at the install scope installs nothing" in `browse.feature:68`. `check:features` does not check titles. Phase 12 will find the scenario by file.
- `01-VALIDATION.md` frontmatter has `nyquist_compliant: false` while its sign-off checklist says it was set to true.
- ROADMAP still shows the Phase 1 checklist line as unchecked and the progress table pending; the parent updates these at the phase transition.

### Product gaps carried to later phases (deferred, with carriers in ROADMAP)

| Gap | Carrier |
| --- | --- |
| Project-scope install: next start after a Pi crash does not reap orphaned async hooks (`index.ts` registers the bridge with `cwd: homedir()`); the Phase 1 crash seed installs at user scope | Phase 2 criterion 4 (ASYNC-04), P1-DC-40 |
| Rebuilding a deleted config writes every plugin as `{}`, losing a disabled plugin's `enabled: false` | Phase 8 criterion 1 (CFGMIG-01), P1-DC-34 |
| The picker's marketplace row counts installed, not offered, plugins (seed pins `0 plugin(s)`) | Phase 12 BROWSE-01 criterion, P1-DC-48 |

These are seeds that state today's behavior on purpose, each tracked in a later phase's success criteria. They are not gaps in Phase 1's goal.

## Anti-pattern scan

No `TBD`, `FIXME`, or `XXX` marker in `features/lib`, `features/support`, or `features/step_definitions` (grep). The gate's static checks (lint, fallow, format) passed on the same tree.

## Human verification

None required. The three review-fix items above were checked by reading the diffs, the recorded red proofs, and a fresh run of the two affected feature files.

## Dubious Choices

- **V-DC-01 (Low).** Classified the three fixer-flagged "requires human verification" items as accepted on code reading plus one fresh run of `async.feature` and `browse.feature`, not on a CI flake-rate measurement, so the status is `passed` rather than `human_needed`. The user may prefer to watch the first CI run of those two files.
- **V-DC-02 (Low).** Classified the branches-behind-head issue as a parent action, not a failure of criterion 5, because the brief makes each child merge the milestone branch first and P1-DC-16 and P1-DC-56 already record it.
- **V-DC-03 (Low).** Classified the stray `~/.pi` write as outside Phase 1's goal; it recurs on every gate, so the user should look at it before the milestone closes.
- **V-DC-04 (Low).** Ran the four suspect unit-test files for the stray write under a scratch `HOME` (not the real one) and then stopped looking; the search was time-boxed.
- **V-DC-05 (Low).** Set `status: passed` although the seeds for Phases 4, 6, and 13 do not exist; that is the stated design (those streams create or already own their files), and the layout rules say so.

---

_Verified: 2026-11-08T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
