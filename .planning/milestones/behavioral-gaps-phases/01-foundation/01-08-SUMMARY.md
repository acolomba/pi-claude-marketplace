---
phase: 01-foundation
plan: 08
subsystem: testing
tags: [cucumber, planning, parallel-streams, ci-timing, branches]

requires:
  - phase: 01-foundation
    provides: "01-01 to 01-07: the Behavioral gaps layout section, the launch seams, the scripted-model columns, the earlier-release fixtures, the async hook harness, the Device Flow stand-in, and the json, terminal, and picker drivers, each with its seeds"
provides:
  - "The roadmap's Frozen after Phase 1 list names the libraries, the topic module, and the harness tests Phase 1 added, and records that platform/pi-api.ts did not change"
  - "world-and-stand-ins.md documents every Phase 1 stand-in, driver, and fixture writer with its final step texts"
  - "layout.md Seeds lists each stream's seed scenarios and the steps only they use"
  - ".planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md, the brief every child session reads"
  - "The D-CF1-16 row records the local CI leg times at the Phase 1 head"
  - "Fifteen local branches features/behavioral-gaps-phase-2 to -16 at 6c04eb67"
affects: [phases 2-16 child sessions, the parent's merges, the milestone audit]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: 60b8a1bb8eb9a10a75ed36871c9263a2bf868167
plan_head_after: 6c04eb67925f0420fde602bc7efadde25ae9670a

tech-stack:
  added: []
  patterns:
    - "A cucumber dry run over the API (as check:features runs it) maps each seed scenario to its step definitions, which gives the per-stream list of steps only the seeds use"

key-files:
  created:
    - .planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md
  modified:
    - .planning/ROADMAP.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .planning/PROJECT.md

key-decisions:
  - "Each child phase numbers its decisions in its own block, D-BG-N01 to D-BG-N99 (Phase 2 from D-BG-201, Phase 16 from D-BG-1601), so fifteen parallel sessions cannot collide on one sequence"
  - "The CI behavioral timeouts stay at 15 minutes: 1.5 times each locally timed leg (1 min 50 s, 3 min 08 s, 56 s) is under 10 minutes, so ci.yml is unchanged"
  - "The fifteen phase branches point at 6c04eb67, the commit after the gate SHA f01507cd; only planning Markdown differs between them, so the gate evidence carries over"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "The roadmap's frozen list covers every non-planning path Phase 1 changed, or the path is a seed feature file of a stream"
    requirement: FND-02
    verification:
      - kind: other
        ref: "git diff --name-only cf48b0df..HEAD -- features test extensions scripts .github .agents cucumber.json package.json package-lock.json eslint.config.js .fallowrc.json rule-packs (49 paths, each mapped below); grep -q github-device-flow .planning/ROADMAP.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cucumber skill documents every Phase 1 stand-in and lists each stream's seed steps"
    requirement: FND-01
    verification:
      - kind: other
        ref: "scratchpad check-steps.py: 31/31 new step texts in world-and-stand-ins.md; grep -c 'follows when the seeds land' layout.md = 0; SKIP=npm-check pre-commit run on both files exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The child-session brief exists and agrees with the Milestone rules"
    requirement: FND-02
    verification:
      - kind: other
        ref: "grep -- '--only {N}', D-BG-16, D-BG-201 in the brief (exit 0); grep -c 'git push -u origin' = 0; id -u = 1000"
        status: pass
    human_judgment: true
    rationale: "Whether the brief agrees with every Milestone rule is a reading judgment; the rule-to-section map below is the evidence"
  - id: D4
    description: "npm run check (in its parts) and npm run test:modules pass on the combined tree, with the three CI legs timed"
    requirement: FND-02
    verification:
      - kind: e2e
        ref: "check:static, test:unpaired, test:integration, three test:cucumber:profile legs, test:coverage:direct:all, test:modules: all exit 0 at f01507cd"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fifteen local phase branches at the verified head, none pushed"
    requirement: FND-02
    verification:
      - kind: other
        ref: "git branch --list --format='%(refname:short) %(objectname:short)' 'features/behavioral-gaps-phase-*' (15 at 6c04eb67); git branch -r --list 'origin/features/behavioral-gaps-phase-*' (empty)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-08
status: complete
---

# Phase 1 Plan 08: Frozen Record, Brief, Gate, and Branches Summary

**Phase 1 is closed out. The roadmap's frozen list now names everything Phase 1 left frozen. The cucumber skill documents every new stand-in and lists each stream's seed steps. The child-session brief exists, with its facts measured on this machine. `npm run check` (in its parts) and `npm run test:modules` pass at f01507cd. The three CI legs fit their 15-minute timeouts with room to spare. Fifteen local phase branches point at 6c04eb67, and nothing is pushed.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-08T05:25:09Z
- **Completed:** 2026-11-08T05:45:00Z
- **Tasks:** 3
- **Files modified:** 5 (1 created)

## Accomplishments

- The roadmap's "Frozen after Phase 1" list now names `features/lib/github-device-flow/**`, `features/lib/pi-json-mode.ts`, `features/lib/plugin-picker.ts`, the topic module `plugin/picker.steps.ts`, and the three harness tests under `test/architecture/`. It says that `platform/pi-api.ts` already re-exported every event type the streams read, that it did not change, and that Phase 1 added no product seam. "What exists today" now says that every stream feature file exists with its seeds, except `hook/tool-failure.feature` and `hook/session-end.feature`, and that no verb module exists yet.
- `world-and-stand-ins.md` documents every Phase 1 addition with its final step texts (31 of 31 found by a script). It covers the background-child and no-override profile options with the terminal carry-over, the crash and the restart after it, the json-mode driver, the terminal screen model, the terminal command steps, the picker driver, the stale and live state-lock stand-ins, and the earlier-release writers. It also covers the scripted model's `error`, `stop reason`, and `context tokens` columns with the per-call usage, the argument-validation projection, the async hook columns, lifecycle log, release marker, summary rule, and pid files, the Device Flow stand-in, and the fail-closed redirect.
- `layout.md` "Seeds" lists each stream's seeds by title and the steps that only those seeds use, with their modules. A cucumber dry run produced the list. Phases 4, 6, and 13 have no seed. Its frozen list now matches the roadmap's.
- `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` is written in ten sections. Each project rule points at the roadmap section that holds it.
- The phase gate is green, and the CI timing is recorded in the D-CF1-16 row and in the brief.
- The fifteen local branches exist, and no remote branch of those names exists.

## Gate results (Task 3)

Run by one background script at HEAD `f01507cdb5f2845cced3afd1170d762ebbe6ce26`, Node v26.13.0, 28 cores, 2026-11-08T05:32:43Z to 05:41:38Z. Each part's own exit status was written to a results file, and no output went through a pipe.

| Part | Exit | Time | Count |
| --- | --- | --- | --- |
| `npm run check:static` | 0 | 13 s | |
| `npm run test:unpaired` | 0 | 16 s | |
| `npm run test:integration` | 0 | 27 s | |
| adapter lifecycle leg | 0 | 110 s (cucumber 1 m 45 s) | 1186 scenarios, 12219 steps passed |
| adapter components leg | 0 | 188 s (cucumber 3 m 03 s) | 454 scenarios, 5617 steps passed |
| builtin all leg | 0 | 56 s (cucumber 52 s) | 148 scenarios, 1854 steps passed |
| `npm run test:coverage:direct:all` | 0 | 69 s | 350 LCOV records merged |
| `npm run test:modules` | 0 | 55 s | |

The three legs together run every scenario of both profiles, as `test:cucumber` does. Every seed passed in this full parallel, random-order run, and `check:features` (inside `check:static`) passed, so every new shared step is in use. No part failed, so no rerun was needed and no flake was seen.

The branches point at `6c04eb67`, one commit after the gate SHA. `git diff f01507cd -- . ':(exclude,glob).planning/**/*.md'` is empty: the commit changed only `.planning/PROJECT.md` and the brief. So the gate evidence holds for the branch head, under the reuse rule of `.agents/skills/local-verification/rules/gates.md`.

## CI measurement (D-CF1-16)

| Leg | Local time | 1.5 times | Timeout | CI run 42421611502 (main, 2026-11-07) |
| --- | --- | --- | --- | --- |
| adapter lifecycle | 1 m 50 s | 2 m 45 s | 15 min | 4 m 07 s |
| adapter components | 3 m 08 s | 4 m 42 s | 15 min | 5 m 14 s |
| builtin all | 56 s | 1 m 24 s | 15 min | 3 m 03 s |

Each leg fits (1.5 times its time is at most 10 minutes). `.github/workflows/ci.yml` is unchanged. Nothing runs in CI before a push (D-BG-16), so these are local times. A hosted runner was 1.6 to 3.3 times slower than this machine in the baseline. Even at 3.3 times, the slowest leg is about 10 m 21 s, which is still under the 15-minute timeout. That case would need a raise only under the 1.5 rule, and only the parent's post-merge CI check can measure it (Merge procedure).

## Branches (Task 3)

`git rev-parse --abbrev-ref HEAD` printed `features/behavioral-gaps`. No phase branch existed before (`git branch --list "features/behavioral-gaps-phase-*"` printed nothing), so all fifteen were created with one plain `git branch` command each. HEAD: `6c04eb67925f0420fde602bc7efadde25ae9670a`.

```text
features/behavioral-gaps-phase-10 6c04eb67
features/behavioral-gaps-phase-11 6c04eb67
features/behavioral-gaps-phase-12 6c04eb67
features/behavioral-gaps-phase-13 6c04eb67
features/behavioral-gaps-phase-14 6c04eb67
features/behavioral-gaps-phase-15 6c04eb67
features/behavioral-gaps-phase-16 6c04eb67
features/behavioral-gaps-phase-2 6c04eb67
features/behavioral-gaps-phase-3 6c04eb67
features/behavioral-gaps-phase-4 6c04eb67
features/behavioral-gaps-phase-5 6c04eb67
features/behavioral-gaps-phase-6 6c04eb67
features/behavioral-gaps-phase-7 6c04eb67
features/behavioral-gaps-phase-8 6c04eb67
features/behavioral-gaps-phase-9 6c04eb67
```

`git branch -r --list "origin/features/behavioral-gaps-phase-*"` printed nothing. Nothing was pushed. This plan's metadata commit (SUMMARY, STATE, ROADMAP) lands after the branches. Like the parent's later close-out commits, it reaches each child through the brief's merge of the local `features/behavioral-gaps`.

## Frozen-file reconciliation (Task 1)

`git diff --name-only cf48b0df..HEAD -- features test extensions scripts .github .agents cucumber.json package.json package-lock.json eslint.config.js .fallowrc.json rule-packs` listed 49 paths. No `extensions/` path changed. `.fallowrc.json` is not listed, because 01-02 added an entry and 01-07 removed it.

| Paths | Covered by |
| --- | --- |
| `.agents/skills/cucumber/rules/{layout,steps}.md` | frozen: `.agents/skills/cucumber/**` |
| `features/lib/{earlier-version-state,hook-files,hook-recorder,mcp-configuration,pi-commands,pi-process,pi-tui,state-lock-holder}.ts`, `features/lib/https-git-host/server.ts`, `features/lib/scripted-model/{extension,script}.ts`, `features/lib/upstream/{index,pi}.ts` | frozen: `features/lib/**` |
| `features/lib/github-device-flow/{extension,routing,server}.ts`, `features/lib/pi-json-mode.ts`, `features/lib/plugin-picker.ts` | frozen: `features/lib/**`, now named as Phase 1 libraries |
| `features/support/world.ts` | frozen: `features/support/**` |
| `test/e2e/_rpc.ts` | frozen: `test/e2e/_rpc.ts` |
| `test/architecture/{github-device-flow-redirect,pi-tui-screen,hermetic-git-environment}.test.ts` | frozen: now named as the Phase 1 harness tests |
| `features/step_definitions/{command,companion,config,git-host,mcp-configuration,scope-state}.steps.ts` | frozen: shared step modules |
| `features/step_definitions/hook/{messages,prompt-and-stop,runs,session}.steps.ts`, `features/step_definitions/plugin/installation.steps.ts` | frozen: topic modules |
| `features/step_definitions/plugin/picker.steps.ts` | frozen: now named as the topic module Phase 1 adds |
| `features/hook/async.feature` | seed file, Phase 2 |
| `features/hook/stop-failure.feature` | seed file, Phase 3 |
| `features/hook/compaction.feature` | seed file, Phase 5 |
| `features/plugin/state-migration.feature` | seed file, Phase 7 |
| `features/plugin/config-migration.feature` | seed file, Phase 8 |
| `features/mcp-server/legacy-move.feature` | seed file, Phase 9 |
| `features/plugin/model-tools.feature` | seed file, Phase 10 |
| `features/marketplace/device-flow.feature` | seed file, Phase 11 |
| `features/plugin/browse.feature` | seed file, Phase 12 |
| `features/plugin/bootstrap.feature` | seed file, Phase 14 |
| `features/marketplace/state-lock.feature` | seed file, Phase 15 |
| `features/plugin/subagent-child.feature` | seed file, Phase 16 |

`fallow-ignore` markers: `rg -n "fallow-ignore" extensions features test scripts` counts **49**. The plan expected `.planning/codebase/CONVENTIONS.md` to state 47 (research risk 7). The parent has already updated it to 49 (the redirect's default export and `terminalScreen`), so the map and the tree agree. The map was not edited.

## Brief: Milestone rule to brief section

| Roadmap rule (behavioral-gaps) | Brief section |
| --- | --- |
| Parallelism: one child per phase, own worktree and local branch, parent merges with a merge commit | 1, 2 |
| Parallelism: commit only own branch, push nothing unless the user asks, no PR (D-BG-16) | 7 |
| Parallelism: never the milestone lifecycle | 3 |
| Parallelism: merge the local milestone branch, never rebase, never a sibling's branch | 2 (step 4), 7 |
| File ownership: Frozen after Phase 1 | 8 (Frozen files) |
| File ownership: ownership table, reserved names, seeds and their steps | 8 (Ownership) |
| File ownership: Unowned feature files | 8 (Ownership), 10 |
| Phase criteria carrying the Phase 1 product gaps (ASYNC-04, CFGMIG-01, BROWSE-01) | 8 (Product gaps) |
| Upstream parity | 4, 8 (Upstream parity and the bug policy) |
| Bug policy (and when a phase stops with BLOCKED.md) | 4, 8 |
| Shared product files | 8 |
| Append-only closed sets | 8 |
| Behavioral tests (red proof, D-BG-04 profiles, tags) | 8 |
| Never edited by a stream; parent lines; tool-written planning files; WINDOWS prefix | 8, 10 |
| Dubious choices | 5 |
| Commit titles | 7 |
| Gates (and the Threat Flags section) | 8 (Gates, GSD records), 9 |
| Out of scope | 8 |
| Merge procedure (parent-side) | 1, 10 (what the parent reads) |
| Decision IDs (D-BG-15, per-phase blocks) | 6 |

`id -u` printed `1000`. The brief says this machine runs as a normal user, so no `setpriv` wrapper is needed.

## Task Commits

1. **Task 1: Reconcile the frozen-file record and document the stand-ins** - `964137cd` (docs). Tracer gate: the `<verify>` greps and the pre-commit run were green before the commit. Under `end-of-phase` with only automated checks, the plan went on to Task 2.
2. **Task 2: Write the child-session brief** - `f01507cd` (docs)
3. **Task 3: Run the combined-tree gate, measure the CI legs, and create the phase branches** - `6c04eb67` (docs). The branches are refs, not commits.

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md, and REQUIREMENTS.md.

## Files Created/Modified

- `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` - created: the child-session brief
- `.planning/ROADMAP.md` - the frozen list and "What exists today"
- `.agents/skills/cucumber/rules/layout.md` - the per-stream Seeds list and the frozen list
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the Phase 1 stand-ins and drivers
- `.planning/PROJECT.md` - one sentence in the D-CF1-16 row with the local measurement

## Decisions Made

- The per-stream seed list names only the steps that the seeds alone use, because only those can become unused. The common steps are named as a class, with two examples. A full list would repeat the publishing and command steps fifteen times.
- The Seeds list also names the table columns that the seeds use (`error`, `context tokens`, the async hook columns), although `check:features` does not check columns.
- The brief's environment facts include only what was checked on this machine. For example, the Claude Code binary is at `/home/linuxbrew/.linuxbrew/bin/claude`, version 2.1.319.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The config-set fact was stale**
- **Found during:** Task 2
- **Issue:** The plan asked the brief to say that `gsd-tools query config-set` breaks `format:check`. Today neither `format:check` (`package.json`) nor the prettier hook (`.pre-commit-config.yaml`) reads `.planning/config.json`.
- **Fix:** The brief still forbids config-set. It says that an earlier milestone saw it fail `format:check`, that today it leaves only an unrelated diff, and how to restore the file.
- **Files modified:** `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`
- **Committed in:** `f01507cd`

**2. [Rule 1 - Bug] "Every stream feature file now exists" was not true**
- **Found during:** Task 1
- **Issue:** The plan's wording for "What exists today" says that every stream feature file exists with its seed. `hook/tool-failure.feature` and `hook/session-end.feature` do not exist (no seed, as 01-01 decided), and `plugin/prune.feature` has no seed.
- **Fix:** The paragraph names those exceptions.
- **Committed in:** `964137cd`

**3. [Rule 3 - Blocking] markdownlint MD038 in world-and-stand-ins.md**
- **Found during:** Task 1
- **Issue:** The code span `` `, ` `` (the form separator) failed MD038.
- **Fix:** The text says "joined by a comma and a space".
- **Committed in:** `964137cd`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3). **Impact on plan:** wording only.

## Issues Encountered

- **A write to the real home during the gate (not resolved).** A check of `~/.pi` against a marker file made at the gate's start found one new file. At 05:39:05Z, while the builtin leg ran (05:38:37Z to 05:39:33Z), some process wrote `~/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json`, a completion cache file (`schemaVersion` 7, `mcpImplementation` `builtin`, plugin `hello` with status `unavailable`). The marketplace and plugin are those of the unit-test fixture `test/orchestrators/marketplace/_fixtures/valid-marketplace`, and no feature file names that marketplace. No other test run and no other active checkout was found on the machine at that time. I did not find the source. It may be another session, or a hermeticity leak in the suite. I left the file as it is, because I do not know whether an earlier version existed. The brief records this fact for the children. `state.json` and the other files under `~/.pi/agent/pi-claude-marketplace/` were not changed.
- The session's worktree guard refused compound shell commands that named git (or ran bash with a computed value), including one guard run that was joined to an echo. So the commit for Task 1 ran right after a separate guard run had passed in the same cwd, and every later guard run used a plain command of its own. The checks and edits ran from scripts in the scratchpad.
- `git commit -- <path>` refuses an untracked path. So the new brief was staged with `git add` on that one file first.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1's plans are all executed. The orchestrator runs the code review, the verification, and the phase completion. Those commits reach the children through the brief's step 4 merge, so the branches stay where they are.
- Each child session reads `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`. The parent fills in `{N}` and `{NAME}` in its opening message.
- The root log `.planning/DUBIOUS-CHOICES.md` exists. This plan did not edit it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-1-20 is mitigated: the branches were created with plain local `git branch` commands, the remote listing is empty, and brief section 7 says to commit only to the own branch and to push nothing unless the user asks. T-1-21 is mitigated: the frozen record was checked path by path against `git diff --name-only cf48b0df..HEAD`, and the rule-to-section table above maps every Milestone rule to the brief. T-1-SC: no package was installed.

## Dubious Choices

- **Per-phase D-BG blocks (Medium):** the brief has Phase N number its decisions D-BG-N01 to D-BG-N99 (Phase 2 from D-BG-201). This departs from D-BG-15's wording "later phases continue the sequence", because fifteen parallel children would collide on one sequence. The plan dictated the blocks. The D-BG-15 row in PROJECT.md still says "continue the sequence", and the parent may want to amend it.
- **Seed list names only the seed-only steps (Low):** the plan said "the shared steps those seeds use". I listed the steps whose only users are the seeds, which are the steps a stream must keep in use, and named the common steps as a class. A full list would be long and would not change what a stream must keep.
- **Phase 3, 5, and 10 entries name columns, not steps (Low):** their seeds add no step of their own, so their entries name the script columns or the projection the seeds use.
- **Branches point at the CI-records commit, not the gate SHA (Low):** the plan said to create them after the last commit of this plan's work. They point at `6c04eb67`, and the gate ran at `f01507cd`. Only planning Markdown differs, which the local-verification reuse rule allows.
- **config-set fact reworded (Low):** see deviation 1. The plan's literal fact is stale on this tree.
- **The ~/.pi cache write is reported, not cleaned (Medium):** see Issues. Deleting the file could remove a file that existed before. Keeping it leaves a test-fixture cache in the user's real home. The parent or the user decides.
- **The brief's worktree path (Low):** `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-{N}` follows the new-workspace naming (`~/src/<repo>-<name>`). The plan asked only for a path under `/home/acolomba/src/`.
- **Restoring a file that init.sh changes (Low):** the brief tells a child to restore any tracked file that `scripts/init.sh` changed and to report it. I did not run `init.sh` here, because it installs the latest GSD into this worktree. So this step is read from the script, not measured.
- **Local times are on a 28-core machine (Low):** a hosted runner was slower in every baseline leg. The 1.5 rule is applied to the local times, as the plan said, and the projected CI times are given beside them.

## Self-Check: PASSED

- FOUND: `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`, `.agents/skills/cucumber/rules/layout.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
- FOUND: commits `964137cd`, `f01507cd`, `6c04eb67` on `features/behavioral-gaps` (`git rev-list --count 60b8a1bb..HEAD` = 3)
- Task 1 acceptance: every path mapped above; `grep -c "follows when the seeds land"` = 0; 31/31 step texts; the marker count recorded
- Task 2 acceptance: the brief names `features/behavioral-gaps-phase-{N}` (4 times), `--only {N}`, D-BG-16, and D-BG-201; `grep -c "git push -u origin"` = 0; `id -u` = 1000
- Task 3 acceptance: every gate part exited 0; the leg times and the 1.5 check are recorded, and `ci.yml` is unchanged; there are 15 local branches and no remote ones
